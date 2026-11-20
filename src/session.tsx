import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { BattleResult, GameEvent, PrivateYou, PublicShip, PublicWorld } from "@/shared/types.ts"

type Feed = { n: number; result?: BattleResult; event?: GameEvent; error?: string }
type Positions = {
  t: "positions"
  players: { id: string; lat: number; lng: number; heading: number; speed: number; online: boolean }[]
  ships: PublicShip[]
}

type Session = {
  phase: "boot" | "name" | "faction" | "play"
  link: "connecting" | "live" | "down"
  you: PrivateYou | null
  world: PublicWorld | null
  feed: Feed
  send: (msg: unknown) => void
  signOut: () => void
}

const Ctx = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Session["phase"]>("boot")
  const [link, setLink] = useState<Session["link"]>("connecting")
  const [you, setYou] = useState<PrivateYou | null>(null)
  const [world, setWorld] = useState<PublicWorld | null>(null)
  const [feed, setFeed] = useState<Feed>({ n: 0 })
  const wsRef = useRef<WebSocket | null>(null)
  const tokenRef = useRef(localStorage.getItem("nvc-token") ?? "")
  const retry = useRef(800)

  const send = useCallback((msg: unknown) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem("nvc-token")
    tokenRef.current = ""
    setYou(null)
    setPhase("name")
    wsRef.current?.close()
  }, [])

  useEffect(() => {
    let stopped = false
    let timer = 0
    const connect = () => {
      if (stopped) return
      const proto = location.protocol === "https:" ? "wss" : "ws"
      const ws = new WebSocket(`${proto}://${location.host}/ws`)
      wsRef.current = ws
      ws.onopen = () => {
        setLink("live")
        retry.current = 800
        const token = tokenRef.current
        ws.send(JSON.stringify(token ? { t: "join", token } : { t: "join" }))
      }
      ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data)) as {
          t: string
          token?: string
          you?: PrivateYou | null
          world?: PublicWorld
          needName?: boolean
          message?: string
          result?: BattleResult
          event?: GameEvent
        }
        if (msg.t === "pong") return
        if (msg.t === "positions") {
          const pos = msg as unknown as Positions
          setWorld((prev) => prev && ({
            ...prev,
            players: prev.players.map((p) => {
              const hit = pos.players.find((u) => u.id === p.id)
              return hit ? { ...p, ...hit } : p
            }),
            ships: pos.ships,
          }))
          return
        }
        if (msg.token) {
          tokenRef.current = msg.token
          localStorage.setItem("nvc-token", msg.token)
        }
        if (msg.world) setWorld(msg.world)
        if ("you" in msg) setYou(msg.you ?? null)
        if (msg.t === "hello") {
          if (msg.needName || !msg.you) setPhase("name")
          else if (!msg.you.faction) setPhase("faction")
          else setPhase("play")
        }
        if (msg.t === "err") {
          setFeed((f) => ({ n: f.n + 1, error: msg.message }))
          if (msg.needName) setPhase("name")
        }
        if (msg.t === "result" && msg.result) setFeed((f) => ({ n: f.n + 1, result: msg.result, event: msg.event }))
        if (msg.t === "event" && msg.event) setFeed((f) => ({ n: f.n + 1, event: msg.event }))
        if (msg.you?.faction) setPhase("play")
        else if (msg.you && !msg.you.faction) setPhase("faction")
      }
      ws.onclose = () => {
        setLink("down")
        if (stopped) return
        timer = window.setTimeout(connect, retry.current)
        retry.current = Math.min(8000, retry.current * 1.7)
      }
    }
    connect()
    const ping = window.setInterval(() => send({ t: "ping" }), 20000)
    return () => {
      stopped = true
      window.clearTimeout(timer)
      window.clearInterval(ping)
      wsRef.current?.close()
    }
  }, [send])

  const value = useMemo(() => ({ phase, link, you, world, feed, send, signOut }), [phase, link, you, world, feed, send, signOut])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("session")
  return ctx
}
