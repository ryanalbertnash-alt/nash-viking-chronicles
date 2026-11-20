import { WebSocket } from "ws"
import { start } from "../server/index.ts"

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

type Msg = { t: string; token?: string; you?: { id: string; faction: string | null; name: string }; world?: { players: { id: string; name: string; faction: string | null }[] }; message?: string; result?: { summary: string } }

async function connect(port: number): Promise<{ ws: WebSocket; read: () => Promise<Msg>; send: (m: unknown) => void }> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
  const queue: Msg[] = []
  let wait: ((m: Msg) => void) | null = null
  ws.on("message", (buf) => {
    const msg = JSON.parse(String(buf)) as Msg
    if (wait) { const fn = wait; wait = null; fn(msg) }
    else queue.push(msg)
  })
  const read = () => queue.length ? Promise.resolve(queue.shift()!) : new Promise<Msg>((resolve) => { wait = resolve })
  await awaitOpen(ws)
  return { ws, read, send: (m) => ws.send(JSON.stringify(m)) }
}

function awaitOpen(ws: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve())
    ws.once("error", reject)
  })
}

async function until(read: () => Promise<Msg>, pred: (m: Msg) => boolean) {
  for (let i = 0; i < 8; i++) {
    const msg = await read()
    if (pred(msg)) return msg
  }
  throw new Error("no matching socket message")
}

export async function runWs() {
  const srv = await start({ port: 0, vite: false, dataFile: `/tmp/nvc-ws-${Date.now()}.json` })
  const a = await connect(srv.port)
  const b = await connect(srv.port)
  a.send({ t: "join", name: "Wulf" })
  b.send({ t: "join", name: "Grish" })
  const helloA = await until(a.read, (m) => m.t === "hello" && m.you?.name === "Wulf")
  const helloB = await until(b.read, (m) => m.t === "hello" && m.you?.name === "Grish")
  assert(helloA.token && helloB.token, "tokens")
  a.send({ t: "choose", faction: "viking", startTownId: "chesterville" })
  b.send({ t: "choose", faction: "grog", startTownId: "morrisburg" })
  const seen = await until(a.read, (m) => !!m.world?.players.some((p) => p.name === "Grish" && p.faction === "grog"))
  assert(seen.world?.players.some((p) => p.name === "Wulf"), "wulf is on the shared map")
  assert(seen.world?.players.some((p) => p.name === "Jarl Harald"), "rivals are seeded")
  a.ws.close()
  b.ws.close()
  await srv.close()
  console.log("socket tests passed")
}

const isMain = process.argv[1]?.includes("ws.test")
if (isMain) runWs().catch((err) => { console.error(err); process.exit(1) })
