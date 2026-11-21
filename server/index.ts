import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { createServer } from "node:http"
import express from "express"
import { WebSocketServer, type WebSocket } from "ws"
import { WORLD_VERSION } from "../src/shared/catalog.ts"
import type { BuildingId, Faction, ServerMsg, Stance } from "../src/shared/types.ts"
import { createGame, freshState, normalize } from "./world.ts"
import { buildRoute, roadAt, searchPlaces } from "./route.ts"
import { REPORT_TYPES, type ReportType } from "../src/shared/reports.ts"

type Client = { ws: WebSocket; playerId: string | null }

export type Running = { port: number; close: () => Promise<void> }

export async function start(opts: { port?: number; vite?: boolean; dataFile?: string } = {}): Promise<Running> {
  const dataFile = opts.dataFile || process.env.NVC_DATA || path.join(process.cwd(), "server/data/world.json")
  const state = loadState(dataFile)
  const game = createGame(state)
  const app = express()
  const httpServer = createServer(app)
  const clients = new Set<Client>()
  let saveTimer: NodeJS.Timeout | undefined
  let posDirty = false

  const saveNow = () => {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true })
    const tmp = `${dataFile}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(game.snapshot()))
    fs.renameSync(tmp, dataFile)
  }
  const saveSoon = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveNow, 400)
  }

  app.get("/api/geocode", async (req, res) => {
    const q = String(req.query.q ?? "")
    try {
      res.json(await searchPlaces(q))
    } catch {
      res.status(502).json({ error: "The map search did not answer." })
    }
  })

  app.get("/api/road", async (req, res) => {
    const lat = Number(req.query.lat)
    const lng = Number(req.query.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: "Need a point." })
      return
    }
    try {
      res.json(await roadAt(lat, lng))
    } catch {
      res.json(null)
    }
  })

  app.get("/api/route", async (req, res) => {
    const flat = Number(req.query.flat)
    const flng = Number(req.query.flng)
    const tlat = Number(req.query.tlat)
    const tlng = Number(req.query.tlng)
    const label = String(req.query.label ?? "Destination")
    if (![flat, flng, tlat, tlng].every(Number.isFinite)) {
      res.status(400).json({ error: "Need a start and a destination." })
      return
    }
    try {
      res.json(await buildRoute({ lat: flat, lng: flng }, { lat: tlat, lng: tlng }, label))
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "No road." })
    }
  })

  app.post("/api/narrate", express.json({ limit: "8kb" }), (req, res) => {
    const text = String((req.body as { text?: string } | undefined)?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 420)
    if (!text) {
      res.status(400).end()
      return
    }
    try {
      const hash = createHash("sha1").update(text).digest("hex").slice(0, 16)
      const dir = path.join(process.cwd(), "server/data/narration")
      const mp3 = path.join(dir, `${hash}.mp3`)
      if (!fs.existsSync(mp3)) {
        fs.mkdirSync(dir, { recursive: true })
        const wav = `${mp3}.wav`
        const spoken = spawnSync("espeak-ng", ["-v", "en-gb-x-rp", "-p", "46", "-s", "148", "-w", wav, text], { timeout: 12000 })
        if (spoken.status !== 0) throw new Error("espeak")
        const encoded = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "64k", mp3], { timeout: 12000 })
        fs.unlink(wav, () => {})
        if (encoded.status !== 0) throw new Error("ffmpeg")
      }
      res.sendFile(mp3)
    } catch {
      res.status(503).json({ error: "The narrator is quiet." })
    }
  })

  app.get("/api/health", (_req, res) => {
    const world = game.publicWorld()
    res.json({ ok: true, name: "Nash's Viking Chronicles", players: world.players.length, towns: world.towns.length })
  })

  const prod = process.env.NODE_ENV === "production"
  if (opts.vite === false) {
    app.get("/", (_req, res) => res.type("text").send("Nash's Viking Chronicles socket is up."))
  } else if (prod) {
    const dist = path.join(process.cwd(), "dist")
    app.use(express.static(dist, { index: false, maxAge: "1h" }))
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next()
      res.sendFile(path.join(dist, "index.html"), (err) => (err ? next() : undefined))
    })
  } else {
    const { createServer: createViteServer } = await import("vite")
    const vite = await createViteServer({
      root: process.cwd(),
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    })
    app.use(vite.middlewares)
  }

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" })

  const send = (ws: WebSocket, msg: ServerMsg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
  }

  const broadcastState = () => {
    const world = game.publicWorld()
    for (const client of clients) {
      send(client.ws, { t: "state", you: client.playerId ? game.privateYou(client.playerId) : null, world })
    }
  }

  wss.on("connection", (ws) => {
    const client: Client = { ws, playerId: null }
    clients.add(client)
    ws.on("message", (raw) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(String(raw)) as Record<string, unknown>
      } catch {
        send(ws, { t: "err", message: "The saga could not read that." })
        return
      }
      const t = msg.t
      if (t === "ping") {
        send(ws, { t: "pong" })
        return
      }
      if (t === "join") {
        const joined = game.join({
          name: typeof msg.name === "string" ? msg.name : undefined,
          token: typeof msg.token === "string" ? msg.token : undefined,
          recovery: typeof msg.recovery === "string" ? msg.recovery : undefined,
        })
        if (joined.error && !joined.playerId) {
          send(ws, { t: "err", message: joined.error, needName: joined.needName })
          return
        }
        if (joined.needName) {
          send(ws, { t: "hello", you: null, world: game.publicWorld(), needName: true })
          return
        }
        client.playerId = joined.playerId ?? null
        saveSoon()
        send(ws, {
          t: "hello",
          token: joined.token,
          you: client.playerId ? game.privateYou(client.playerId) : null,
          world: game.publicWorld(),
        })
        broadcastState()
        return
      }
      if (!client.playerId) {
        send(ws, { t: "err", message: "Speak your name first.", needName: true })
        return
      }
      const id = client.playerId
      if (t === "choose") {
        const result = game.choose(id, {
          faction: msg.faction as Faction,
          startTownId: typeof msg.startTownId === "string" ? msg.startTownId : undefined,
          lat: typeof msg.lat === "number" ? msg.lat : undefined,
          lng: typeof msg.lng === "number" ? msg.lng : undefined,
        })
        reply(ws, result)
        return
      }
      if (t === "pos") {
        game.setPos(id, {
          lat: Number(msg.lat),
          lng: Number(msg.lng),
          heading: Number(msg.heading) || 0,
          speed: Number(msg.speed) || 0,
        })
        posDirty = true
        return
      }
      if (t === "do") {
        const action = String(msg.action ?? "")
        const stance = (msg.stance as Stance) || "smash"
        const result = runAction(action, id, msg, stance)
        reply(ws, result)
      }
    })
    ws.on("close", () => clients.delete(client))
  })

  function runAction(action: string, id: string, msg: Record<string, unknown>, stance: Stance) {
    if (action === "recruit") return game.recruit(id, String(msg.townId ?? ""))
    if (action === "claim") return game.claim(id, String(msg.townId ?? ""), stance)
    if (action === "attackTown") return game.attackTown(id, String(msg.townId ?? ""), stance)
    if (action === "attackPlayer") return game.attackPlayer(id, String(msg.playerId ?? ""), stance)
    if (action === "raid") return game.raid(id, typeof msg.townId === "string" ? msg.townId : undefined)
    if (action === "build") return game.build(id, String(msg.part ?? "") as BuildingId)
    if (action === "equip") return game.equip(id, typeof msg.championId === "string" ? msg.championId : null, typeof msg.itemId === "string" ? msg.itemId : null)
    if (action === "warband") return game.setWarband(id, Array.isArray(msg.ids) ? msg.ids.map(String) : [])
    if (action === "potion") return game.drinkPotion(id, String(msg.itemId ?? ""))
    if (action === "buy") return game.buy(id, String(msg.sku ?? ""))
    if (action === "rest") return game.rest(id)
    if (action === "tribute") return game.tribute(id, String(msg.townId ?? ""))
    if (action === "report" && REPORT_TYPES.includes(String(msg.kind) as ReportType)) return game.fileReport(id, String(msg.kind) as ReportType)
    if (action === "confirm") return game.confirmReport(id, String(msg.reportId ?? ""), Boolean(msg.still))
    return { error: "Unknown order." }
  }

  function reply(ws: WebSocket, result: { error?: string; event?: { id: string; text: string; speech?: string; tone: "good" | "bad" | "info" }; result?: import("../src/shared/types.ts").BattleResult }) {
    if (result.error) {
      send(ws, { t: "err", message: result.error })
      return
    }
    saveSoon()
    const you = [...clients].find((c) => c.ws === ws)?.playerId
    const world = game.publicWorld()
    if (result.result && you) {
      send(ws, { t: "result", you: game.privateYou(you)!, world, result: result.result, event: result.event! })
    } else if (result.event && you) {
      send(ws, { t: "event", you: game.privateYou(you), world, event: result.event })
    }
    broadcastState()
  }

  const tickTimer = setInterval(() => {
    const events = game.tick(Date.now())
    posDirty = true
    if (events.length) {
      saveSoon()
      const world = game.publicWorld()
      for (const item of events) {
        for (const client of clients) {
          if (client.playerId !== item.playerId) continue
          send(client.ws, { t: "event", you: game.privateYou(item.playerId), world, event: item.event })
        }
      }
      broadcastState()
    }
  }, 2000)

  const posTimer = setInterval(() => {
    if (!posDirty) return
    posDirty = false
    const world = game.publicWorld()
    const msg = {
      t: "positions" as const,
      players: world.players.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, heading: p.heading, speed: p.speed, online: p.online })),
      ships: world.ships,
    }
    for (const client of clients) {
      if (client.ws.readyState === client.ws.OPEN) client.ws.send(JSON.stringify(msg))
    }
  }, 700)

  const port = opts.port ?? Number(process.env.PORT || 4477)
  await new Promise<void>((resolve) => httpServer.listen(port, "0.0.0.0", () => resolve()))
  const address = httpServer.address()
  const bound = typeof address === "object" && address ? address.port : port

  return {
    port: bound,
    close: async () => {
      clearInterval(tickTimer)
      clearInterval(posTimer)
      if (saveTimer) clearTimeout(saveTimer)
      saveNow()
      for (const client of clients) client.ws.close()
      wss.close()
      await new Promise<void>((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())))
    },
  }
}

function loadState(file: string) {
  try {
    if (!fs.existsSync(file)) return freshState()
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { version?: number; players?: Record<string, { isAI?: boolean }> }
    if (parsed.version !== WORLD_VERSION) {
      const fresh = freshState()
      for (const [id, p] of Object.entries(parsed.players ?? {})) {
        if (!p.isAI) fresh.players[id] = p as never
      }
      return normalize(fresh)
    }
    return normalize(parsed as ReturnType<typeof freshState>)
  } catch (err) {
    console.error("Could not read the saved saga, starting fresh.", err)
    return freshState()
  }
}

const invoked = process.argv[1] && (process.argv[1].endsWith("server/index.ts") || process.argv[1].endsWith("server/index.js"))
if (invoked) {
  const running = await start()
  console.log(`Nash's Viking Chronicles is on http://127.0.0.1:${running.port}`)
}
