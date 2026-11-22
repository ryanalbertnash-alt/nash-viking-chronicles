import { useEffect, useRef, useState } from "react"
import { asset } from "@/art"
import { playSfx } from "@/audio"
import { Button } from "@/components/ui/button"
import { championClass } from "@/shared/army.ts"
import { championById } from "@/shared/catalog.ts"
import type { UnitClass } from "@/shared/army.ts"
import type { BattleResult, Faction } from "@/shared/types.ts"

type Pose = "idle" | "run" | "attack" | "shoot" | "hit" | "dead"

type Fighter = {
  id: string
  name: string
  side: "atk" | "def"
  cls: UnitClass
  faction: Faction
  hero: boolean
  art: string
  hp: number
  alive: boolean
  x: number
  z: number
  state: Pose
  stateT: number
  flash: number
  knock: number
  fall: number
  struck: boolean
}

type Arrow = { on: boolean; t: number; fromX: number; fromZ: number; toX: number; toZ: number; hit: number }
type Spark = { on: boolean; x: number; y: number; vx: number; vy: number; life: number; blood: boolean }
type Ember = { x: number; y: number; vx: number; vy: number; life: number; smoke: boolean }

const VIKINGS = ["ryan", "ralph", "billy", "gavin", "haydin", "lana", "emma", "donna", "kali", "anna", "landin", "james", "jayden", "jesse", "alain", "area"]
const GROGS = ["gorgrath", "mogdura", "brakka", "zug", "sharga", "krull", "grimtusk", "urzog"]

export function Battle3D({
  battle,
  auto,
  onClose,
  onFallback,
}: {
  battle: BattleResult
  auto: boolean
  onClose: () => void
  onFallback: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<{ strike: (kind: "melee" | "shot" | "charge") => void; retreat: () => void } | null>(null)
  const fallbackRef = useRef(onFallback)
  fallbackRef.current = onFallback
  const [phase, setPhase] = useState("The lines form")
  const [kills, setKills] = useState(0)
  const [combo, setCombo] = useState(0)
  const [cds, setCds] = useState({ charge: 0, volley: 0, wall: 0 })
  const [done, setDone] = useState(false)
  const [target, setTarget] = useState("the line")
  const leadAtk = battle.attackerChamps[0]
  const leadDef = battle.defenderChamps[0]

  useEffect(() => {
    const el = host.current
    if (!el) return
    const canvas = document.createElement("canvas")
    canvas.style.width = "100%"
    canvas.style.height = "100%"
    canvas.style.touchAction = "none"
    el.appendChild(canvas)
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      fallbackRef.current()
      return
    }
    const stage = el
    const images = new Map<string, HTMLImageElement>()
    let alive = true
    let ended = false
    const fighters = buildRoster(battle, 8)
    const arrows: Arrow[] = Array.from({ length: 28 }, () => ({ on: false, t: 0, fromX: 0, fromZ: 0, toX: 0, toZ: 0, hit: -1 }))
    const sparks: Spark[] = Array.from({ length: 70 }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, blood: true }))
    const embers: Ember[] = Array.from({ length: 36 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.02,
      vy: -0.04 - Math.random() * 0.05,
      life: Math.random(),
      smoke: i % 4 === 0,
    }))
    const cd = { charge: 0, volley: 0, wall: 0 }
    let kills = 0
    let combo = 0
    let comboLeft = 0
    let shake = 0
    let age = 0
    let formLeft = 0.85
    const focus = { id: fighters.find((u) => u.side === "def")?.id ?? "" }
    const board = paintBoard(battle.defenderFaction === "grog")

    const ids = new Set<string>([...VIKINGS, ...GROGS])
    let pending = ids.size
    for (const id of ids) {
      const img = new Image()
      img.onload = () => {
        images.set(id, img)
        pending -= 1
        if (pending === 0 && alive) stage.dataset.ready = "yes"
      }
      img.onerror = () => {
        pending -= 1
        if (pending === 0 && alive) stage.dataset.ready = "yes"
      }
      img.src = asset(`standees/${id}.png`)
    }

    function spawnSpark(px: number, py: number, blood: boolean) {
      const slot = sparks.find((s) => !s.on)
      if (!slot) return
      slot.on = true
      slot.x = px
      slot.y = py
      slot.vx = (Math.random() - 0.5) * 90
      slot.vy = -40 - Math.random() * 70
      slot.life = 0.45
      slot.blood = blood
    }

    function hurt(u: Fighter, amount: number) {
      if (!u.alive || ended) return
      u.hp -= amount
      u.flash = 0.22
      u.knock = u.side === "atk" ? -0.08 : 0.08
      shake = Math.min(10, shake + 4)
      const p = project(u.x, u.z, canvas.width, canvas.height)
      for (let i = 0; i < 6; i++) spawnSpark(p.x, p.y - 40 * p.scale, true)
      if (u.hp <= 0) {
        u.alive = false
        u.state = "dead"
        u.stateT = 0
        kills += 1
        combo += 1
        comboLeft = 2.2
        setKills(kills)
        setCombo(combo)
        playSfx(u.faction === "grog" ? "roar" : "shield")
      } else {
        u.state = "hit"
        u.stateT = 0
        playSfx("clash")
      }
    }

    function loose(from: Fighter, to: Fighter, count = 1) {
      for (let n = 0; n < count; n++) {
        const slot = arrows.find((a) => !a.on)
        if (!slot) return
        slot.on = true
        slot.t = -n * 0.06
        slot.fromX = from.x
        slot.fromZ = from.z + (n - (count - 1) / 2) * 0.08
        slot.toX = to.x + (n - (count - 1) / 2) * 0.12
        slot.toZ = to.z
        slot.hit = fighters.indexOf(to)
      }
      playSfx("arrow")
    }

    function nearest(from: Fighter) {
      let best: Fighter | null = null
      let bestD = 99
      for (const other of fighters) {
        if (!other.alive || other.side === from.side) continue
        if (focus.id && other.id === focus.id) return other
        const d = Math.hypot(other.x - from.x, (other.z - from.z) * 0.6)
        if (d < bestD) { bestD = d; best = other }
      }
      return best
    }

    function strike(kind: "melee" | "shot" | "charge") {
      if (ended) return
      if (kind === "charge") {
        if (cd.charge > 0) return
        cd.charge = 5
        formLeft = 0
        playSfx("horn")
        setPhase("Charge")
        stage.dataset.phase = "charge"
        for (const u of fighters) if (u.alive && u.side === "atk") { u.state = "run"; u.stateT = 0 }
      } else if (kind === "shot") {
        if (cd.volley > 0) return
        cd.volley = 3.5
        setPhase("Shafts in the air")
        for (const u of fighters) if (u.alive && u.side === "atk" && u.cls === "archer") {
          u.state = "shoot"
          u.stateT = 0
          const foe = nearest(u)
          if (foe) loose(u, foe, 4)
        }
      } else {
        if (cd.wall > 0) return
        cd.wall = 6
        playSfx("shield")
        setPhase("Shield wall")
      }
    }

    function finish() {
      if (ended) return
      ended = true
      setDone(true)
      setPhase(battle.win ? "Victory" : "Defeat")
      playSfx(battle.win ? "horn" : "drums")
    }

    api.current = { strike, retreat: finish }
    let last = performance.now()
    let hudTick = 0
    let frame = 0
    const loop = (now: number) => {
      if (!alive) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      age += dt
      frame = now / 1000
      if (formLeft > 0) formLeft -= dt
      shake = Math.max(0, shake - dt * 18)
      cd.charge = Math.max(0, cd.charge - dt)
      cd.volley = Math.max(0, cd.volley - dt)
      cd.wall = Math.max(0, cd.wall - dt)
      if (comboLeft > 0) {
        comboLeft -= dt
        if (comboLeft <= 0) { combo = 0; setCombo(0) }
      }
      hudTick += dt
      if (hudTick > 0.25) {
        hudTick = 0
        setCds({ charge: cd.charge, volley: cd.volley, wall: cd.wall })
      }

      for (const u of fighters) {
        u.stateT += dt
        u.flash = Math.max(0, u.flash - dt)
        u.knock *= 0.86
        if (u.state === "dead") {
          u.fall = Math.min(1, u.fall + dt * 1.6)
          continue
        }
        if (!u.alive) continue
        const foe = nearest(u)
        const dist = foe ? Math.abs(foe.x - u.x) : 99
        const ranged = u.cls === "archer"
        const reach = ranged ? 0.55 : 0.22
        if (formLeft > 0) {
          u.state = "idle"
        } else if (u.state === "hit" && u.stateT > 0.28) {
          u.state = foe && dist < reach ? (ranged ? "shoot" : "attack") : "run"
          u.stateT = 0
          u.struck = false
        } else if (u.state === "attack" || u.state === "shoot") {
          if (!u.struck && u.stateT > 0.18) {
            u.struck = true
            if (u.state === "attack" && foe) hurt(foe, u.faction === "grog" ? 11 : 7)
            if (u.state === "shoot" && foe) loose(u, foe, 3)
          }
          if (u.stateT > 0.55) {
            u.struck = false
            u.state = foe && dist < reach + 0.05 ? (ranged ? "shoot" : "attack") : "run"
            u.stateT = 0
          }
        } else if (foe && dist < reach) {
          u.state = ranged ? "shoot" : "attack"
          u.stateT = 0
        } else if (foe) {
          const step = 0.42 * dt
          u.x += Math.sign(foe.x - u.x) * step
          u.state = "run"
        }
      }

      for (const a of arrows) {
        if (!a.on) continue
        a.t += dt * 0.42
        if (a.t >= 1) {
          a.on = false
          const victim = fighters[a.hit]
          if (victim?.alive) hurt(victim, 5)
        }
      }
      for (const s of sparks) {
        if (!s.on) continue
        s.life -= dt
        s.vy += 180 * dt
        s.x += s.vx * dt
        s.y += s.vy * dt
        if (s.life <= 0) s.on = false
      }
      for (const e of embers) {
        e.life -= dt * 0.15
        e.x += e.vx * dt
        e.y += e.vy * dt
        if (e.life <= 0 || e.y < 0) {
          e.life = 1
          e.x = 0.15 + Math.random() * 0.7
          e.y = 0.55 + Math.random() * 0.3
          e.smoke = Math.random() < 0.25
        }
      }

      const near = fighters.some((u) => u.alive && u.side === "atk" && fighters.some((v) => v.alive && v.side === "def" && Math.abs(v.x - u.x) < 0.4))
      if (near && !stage.dataset.opened) {
        const shooter = fighters.find((u) => u.alive && u.cls === "archer") ?? fighters.find((u) => u.alive && u.side === "atk")
        const victim = fighters.find((u) => u.alive && u.side === "def" && u.cls !== "archer")
        if (shooter && victim) loose(shooter, victim, 6)
        if (victim) hurt(victim, victim.hp)
        stage.dataset.opened = "yes"
      }
      const flying = arrows.some((a) => a.on && a.t > 0.15 && a.t < 0.8)
      const falling = fighters.some((u) => u.state === "dead" && u.fall > 0.2 && u.fall < 0.9)
      if (flying && falling && stage.dataset.phase !== "clash") {
        stage.dataset.phase = "clash"
        setPhase("Clash")
      } else if (formLeft > 0) {
        stage.dataset.phase = "lines"
      }

      draw(ctx, canvas, board, images, fighters, arrows, sparks, embers, frame, shake)

      if (!ended && fighters.length && (!fighters.some((u) => u.alive && u.side === "atk") || !fighters.some((u) => u.alive && u.side === "def"))) finish()
      if (auto && !ended && formLeft <= 0 && age > 1.2 && Math.random() < dt * 0.35) strike(Math.random() < 0.5 ? "charge" : "shot")
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)

    const onPointer = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = (ev.clientX - rect.left) * (canvas.width / rect.width)
      const y = (ev.clientY - rect.top) * (canvas.height / rect.height)
      let best: Fighter | null = null
      let bestD = 80
      for (const u of fighters) {
        if (!u.alive) continue
        const p = project(u.x, u.z, canvas.width, canvas.height)
        const d = Math.hypot(p.x - x, p.y - 30 * p.scale - y)
        if (d < bestD) { bestD = d; best = u }
      }
      if (!best) return
      focus.id = best.id
      setTarget(best.name)
      if (best.side === "def") strike("melee")
    }
    canvas.addEventListener("pointerdown", onPointer)
    const onResize = () => fitCanvas(canvas, el)
    fitCanvas(canvas, el)
    window.addEventListener("resize", onResize)
    return () => {
      alive = false
      window.removeEventListener("resize", onResize)
      canvas.removeEventListener("pointerdown", onPointer)
      el.removeChild(canvas)
      delete stage.dataset.ready
      delete stage.dataset.phase
      api.current = null
    }
  }, [battle, auto])

  return (
    <section className="battle3d" data-phase="lines">
      <header className="b3-top">
        <div className="b3-side">
          <img className="b3-face" alt="" src={asset(leadAtk?.art || "champions/ryan.jpg")} />
          <div><b>{battle.attackerFaction === "grog" ? "Grogs" : "Nash clan"}</b><span>{leadAtk?.name ?? battle.attackerName}</span></div>
        </div>
        <div className="b3-phase">
          <p className="eyebrow">{auto ? "Auto-battle" : "The field"} · {kills} fallen{combo > 1 ? ` · ${combo} combo` : ""}</p>
          <strong>{phase}</strong>
        </div>
        <div className="b3-side">
          <img className="b3-face" alt="" src={asset(leadDef?.art || (battle.defenderFaction === "grog" ? "champions/gorgrath.jpg" : "scenes/wolves.jpg"))} />
          <div><b>{battle.defenderFaction === "grog" ? "Grogs" : "Nash"}</b><span>{leadDef?.name ?? battle.defenderName}</span></div>
        </div>
      </header>
      <div ref={host} className="b3-stage" />
      <p className="b3-target">Target: {target}. Tap a fighter.</p>
      <div className="b3-controls">
        <Button disabled={cds.charge > 0} onClick={() => api.current?.strike("charge")}>Charge{cds.charge > 0 ? ` ${cds.charge.toFixed(0)}` : ""}</Button>
        <Button variant="outline" disabled={cds.volley > 0} onClick={() => api.current?.strike("shot")}>Loose arrows{cds.volley > 0 ? ` ${cds.volley.toFixed(0)}` : ""}</Button>
        <Button variant="secondary" disabled={cds.wall > 0} onClick={() => api.current?.strike("melee")}>Shield wall{cds.wall > 0 ? ` ${cds.wall.toFixed(0)}` : ""}</Button>
        <Button variant="destructive" onClick={() => api.current?.retreat()}>Retreat</Button>
      </div>
      {done && (
        <div className={`b3-end ${battle.win ? "win" : "loss"}`}>
          <h2>{battle.win ? "Victory" : "Defeat"}</h2>
          <p>{kills} fallen. {battle.summary}</p>
          <Button onClick={onClose}>{auto ? "Onward" : "Back to the road"}</Button>
        </div>
      )}
    </section>
  )
}

function fitCanvas(canvas: HTMLCanvasElement, el: HTMLElement) {
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.max(1, Math.floor(el.clientWidth * ratio))
  canvas.height = Math.max(1, Math.floor(el.clientHeight * ratio))
}

function project(x: number, z: number, w: number, h: number) {
  const depth = (z + 1.15) / 2.3
  const y = h * (0.22 + depth * 0.5)
  const spread = 0.55 + depth * 0.5
  return { x: w * 0.5 + x * w * 0.34 * spread, y, scale: 0.42 + depth * 0.7 }
}

function paintBoard(grog: boolean) {
  const c = document.createElement("canvas")
  c.width = 640
  c.height = 480
  const g = c.getContext("2d")!
  g.fillStyle = "#2f3a28"
  g.fillRect(0, 0, 640, 480)
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = i % 3 === 0 ? "#3d4a30" : i % 3 === 1 ? "#24301c" : "#4a3a28"
    g.fillRect(Math.random() * 640, Math.random() * 480, 3, 2)
  }
  g.fillStyle = "#5a4632"
  g.fillRect(250, 40, 140, 400)
  g.fillStyle = "#6e5840"
  for (let i = 0; i < 18; i++) g.fillRect(258 + (i % 3) * 40, 50 + Math.floor(i / 3) * 62, 28, 22)
  g.fillStyle = "#3e5870"
  g.beginPath()
  g.moveTo(40, 0)
  g.quadraticCurveTo(120, 240, 70, 480)
  g.lineTo(0, 480)
  g.lineTo(0, 0)
  g.fill()
  g.strokeStyle = "rgba(180,200,210,0.35)"
  g.stroke()
  if (grog) {
    g.fillStyle = "#3a2a22"
    g.fillRect(430, 40, 90, 50)
    g.fillStyle = "#2a2018"
    g.beginPath()
    g.moveTo(420, 50)
    g.lineTo(475, 18)
    g.lineTo(530, 50)
    g.fill()
  } else {
    g.fillStyle = "#5c4030"
    g.fillRect(400, 36, 120, 62)
    g.fillStyle = "#6a4a28"
    g.beginPath()
    g.moveTo(390, 48)
    g.lineTo(460, 12)
    g.lineTo(530, 48)
    g.fill()
  }
  return c
}

function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  board: HTMLCanvasElement,
  images: Map<string, HTMLImageElement>,
  fighters: Fighter[],
  arrows: Arrow[],
  sparks: Spark[],
  embers: Ember[],
  time: number,
  shake: number,
) {
  const { width: w, height: h } = canvas
  ctx.setTransform(1, 0, 0, 1, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake * 0.4)
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, "#1a1618")
  sky.addColorStop(1, "#3a2418")
  ctx.fillStyle = sky
  ctx.fillRect(-10, -10, w + 20, h + 20)
  const top = h * 0.16
  const bot = h * 0.82
  const rows = 72
  for (let i = 0; i < rows; i++) {
    const t = i / rows
    const t2 = (i + 1) / rows
    const y1 = top + (bot - top) * t
    const y2 = top + (bot - top) * t2
    const inset1 = w * 0.18 * (1 - t)
    const inset2 = w * 0.18 * (1 - t2)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(inset1, y1)
    ctx.lineTo(w - inset1, y1)
    ctx.lineTo(w - inset2, y2)
    ctx.lineTo(inset2, y2)
    ctx.clip()
    ctx.drawImage(board, 0, board.height * t, board.width, board.height / rows + 1, inset1 - 2, y1, w - inset1 * 2 + 4, y2 - y1 + 2)
    ctx.restore()
  }
  const fire = 0.35 + Math.sin(time * 6) * 0.08
  const glow = ctx.createRadialGradient(w * 0.3, h * 0.7, 10, w * 0.5, h * 0.55, w * 0.55)
  glow.addColorStop(0, `rgba(255,120,40,${fire})`)
  glow.addColorStop(1, "rgba(255,80,20,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  const sorted = [...fighters].sort((a, b) => a.z - b.z)
  for (const u of sorted) drawFighter(ctx, u, images, w, h, time)
  for (const a of arrows) {
    if (!a.on || a.t < 0) continue
    const arc = Math.sin(Math.min(1, a.t) * Math.PI) * 0.35
    const x = a.fromX + (a.toX - a.fromX) * a.t
    const z = a.fromZ + (a.toZ - a.fromZ) * a.t - arc
    const p = project(x, z, w, h)
    ctx.save()
    ctx.translate(p.x, p.y - 28 * p.scale)
    ctx.rotate(-0.7)
    ctx.strokeStyle = "#ffe7a8"
    ctx.lineWidth = 4
    ctx.shadowColor = "#ffb040"
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.moveTo(-22, 0)
    ctx.lineTo(26, 0)
    ctx.stroke()
    ctx.fillStyle = "#c4482a"
    ctx.fillRect(18, -3, 8, 6)
    ctx.restore()
  }
  for (const s of sparks) {
    if (!s.on) continue
    ctx.globalAlpha = Math.max(0, s.life * 2)
    ctx.fillStyle = s.blood ? "#9a1814" : "#ffb15a"
    ctx.beginPath()
    ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  for (const e of embers) {
    const px = e.x * w
    const py = e.y * h * 0.8
    ctx.globalAlpha = e.life * 0.7
    ctx.fillStyle = e.smoke ? "rgba(180,180,180,0.35)" : "#ff8a30"
    ctx.beginPath()
    ctx.arc(px, py, e.smoke ? 10 : 2.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

function drawFighter(ctx: CanvasRenderingContext2D, u: Fighter, images: Map<string, HTMLImageElement>, w: number, h: number, time: number) {
  const img = images.get(u.art)
  const p = project(u.x + u.knock, u.z, w, h)
  const size = (u.hero ? 150 : 108) * p.scale
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.fillStyle = "rgba(0,0,0,0.45)"
  ctx.beginPath()
  ctx.ellipse(0, 6, size * 0.28, size * 0.08, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = u.side === "atk" ? "#c9a15a" : "#6e2e28"
  ctx.beginPath()
  ctx.ellipse(0, 4, size * 0.22, size * 0.07, 0, 0, Math.PI * 2)
  ctx.fill()
  let rot = Math.sin(time * 2.2 + u.x * 4) * 0.04
  if (u.state === "run") rot += Math.sin(time * 14) * 0.05
  if (u.state === "attack") rot += Math.sin(Math.min(1, u.stateT / 0.4) * Math.PI) * (u.side === "atk" ? 0.35 : -0.35)
  if (u.state === "dead") rot = (u.side === "atk" ? -1 : 1) * 1.25 * u.fall
  ctx.rotate(rot)
  const breathe = 1 + Math.sin(time * 2 + u.z) * 0.015
  ctx.scale((u.side === "def" ? -1 : 1) * (u.hero ? 1 : 0.82), breathe)
  if (u.state === "hit") ctx.translate((Math.random() - 0.5) * 6, 0)
  if (img) {
    if (!u.hero) ctx.filter = u.faction === "grog" ? "brightness(0.82) saturate(0.9)" : "brightness(0.78) saturate(0.85)"
    ctx.drawImage(img, -size / 2, -size, size, size)
    ctx.filter = "none"
  }
  if (u.flash > 0) {
    ctx.globalCompositeOperation = "source-atop"
    ctx.fillStyle = `rgba(180,20,16,${u.flash * 2.2})`
    ctx.fillRect(-size / 2, -size, size, size)
  }
  if (u.state === "attack" && u.stateT < 0.35) {
    ctx.strokeStyle = "rgba(255,220,160,0.85)"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(10, -size * 0.45)
    ctx.quadraticCurveTo(size * 0.4, -size * 0.2, size * 0.15, -size * 0.05)
    ctx.stroke()
  }
  ctx.restore()
}

function buildRoster(battle: BattleResult, cap: number): Fighter[] {
  return [
    ...expand(battle, "atk", battle.attackerFaction, cap),
    ...expand(battle, "def", battle.defenderFaction === "grog" ? "grog" : "viking", cap),
  ]
}

function expand(battle: BattleResult, side: "atk" | "def", faction: Faction, cap: number): Fighter[] {
  const units = side === "atk" ? battle.attackerUnits : battle.defenderUnits
  const champs = side === "atk" ? battle.attackerChamps : battle.defenderChamps
  const pool = faction === "grog" ? GROGS : VIKINGS
  const out: Fighter[] = []
  const push = (name: string, cls: UnitClass, art: string, hero: boolean, slot: number) => {
    const col = slot % 4
    const row = Math.floor(slot / 4)
    const dir = side === "atk" ? 1 : -1
    out.push({
      id: `${side}-${slot}-${name}`,
      name,
      side,
      cls,
      faction,
      hero,
      art,
      hp: hero ? 34 : 16,
      alive: true,
      x: (side === "atk" ? -0.62 : 0.62) - dir * row * 0.22,
      z: (col - 1.5) * 0.28,
      state: "idle",
      stateT: Math.random(),
      flash: 0,
      knock: 0,
      fall: 0,
      struck: false,
    })
  }
  champs.slice(0, 2).forEach((c, i) => {
    const def = championById(c.id)
    push(c.name, def ? championClass(def) : "infantry", standeeOf(c.art, c.id, faction), true, i)
  })
  const srcs = units.length ? units : [{ name: "Huscarl", cls: "infantry" }]
  let n = 0
  while (out.length < cap) {
    const src = srcs[n % srcs.length]
    const cls = (["infantry", "archer", "cavalry", "monster"] as string[]).includes(src.cls) ? src.cls as UnitClass : "infantry"
    const use = cls === "archer" ? (faction === "grog" ? "sharga" : "lana") : pool[(out.length + n) % pool.length]
    push(src.name, cls, use, false, out.length)
    n++
  }
  return out
}

function standeeOf(art: string | null | undefined, id: string, faction: Faction) {
  const fromArt = art?.match(/champions\/([a-z0-9]+)/)?.[1]
  if (fromArt && (VIKINGS.includes(fromArt) || GROGS.includes(fromArt))) return fromArt
  if (VIKINGS.includes(id) || GROGS.includes(id)) return id
  return faction === "grog" ? "gorgrath" : "ryan"
}
