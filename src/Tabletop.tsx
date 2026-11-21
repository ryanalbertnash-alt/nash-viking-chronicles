import { useEffect, useMemo, useRef, useState } from "react"
import { asset } from "@/art"
import { playSfx } from "@/audio"
import { Button } from "@/components/ui/button"
import { UNIT_INFO, type UnitClass } from "@/shared/army.ts"
import type { BattleResult } from "@/shared/types.ts"

const PHASES = ["Command", "Movement", "Shooting", "Charge", "Fight", "Morale"] as const
const CARDS = [
  { name: "Shield Wall", cost: 1, text: "The line locks. Save improves." },
  { name: "Berserker Rage", cost: 2, text: "Attack surges for one fight." },
  { name: "Odin's Favor", cost: 2, text: "Reroll a failed wound." },
  { name: "Raven Scout", cost: 1, text: "See the next phase early." },
  { name: "Smoke or Fog", cost: 1, text: "Cover the advance." },
  { name: "Overwatch", cost: 1, text: "Archers shoot as they come." },
]

type Mini = {
  id: string
  name: string
  cls: UnitClass
  art: string | null
  x: number
  y: number
  side: "atk" | "def"
  big: boolean
  hp: number
  max: number
}

export function Tabletop({ battle, auto, onClose }: { battle: BattleResult; auto: boolean; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState(0)
  const [round, setRound] = useState(0)
  const [selected, setSelected] = useState(0)
  const [dice, setDice] = useState<number[]>([])
  const [rolling, setRolling] = useState(false)
  const [cp, setCp] = useState(4)
  const [note, setNote] = useState(battle.rounds[0]?.text ?? "The lines form.")
  const [spent, setSpent] = useState<string | null>(null)
  const images = useRef(new Map<string, HTMLImageElement>())

  const minis = useMemo(() => makeMinis(battle), [battle])
  const current = battle.rounds[Math.min(round, battle.rounds.length - 1)]
  const atkRatio = current ? current.atkHp / Math.max(1, battle.atkMax) : 1
  const defRatio = current ? current.defHp / Math.max(1, battle.defMax) : 1
  const done = round >= battle.rounds.length - 1 && phase >= PHASES.length - 1
  const unit = minis[selected] ?? minis[0]

  useEffect(() => {
    for (const m of minis) {
      if (!m.art || images.current.has(m.art)) continue
      const img = new Image()
      img.src = asset(m.art)
      images.current.set(m.art, img)
    }
  }, [minis])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    let alive = true
    const ctx = c.getContext("2d")
    if (!ctx) return
    const draw = () => {
      if (!alive) return
      const rect = c.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(280, rect.width)
      const h = Math.max(220, rect.height)
      if (c.width !== Math.floor(w * dpr)) {
        c.width = Math.floor(w * dpr)
        c.height = Math.floor(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintField(ctx, w, h, minis, selected, phase, atkRatio, defRatio, battle, images.current)
      requestAnimationFrame(draw)
    }
    const id = requestAnimationFrame(draw)
    return () => { alive = false; cancelAnimationFrame(id) }
  }, [minis, selected, phase, atkRatio, defRatio, battle])

  function roll() {
    const a = 1 + Math.floor(Math.random() * 6)
    const b = 1 + Math.floor(Math.random() * 6)
    setRolling(true)
    setDice([a, b])
    playSfx(phase === 2 ? "horn" : "clash")
    const blow = battle.rounds[Math.min(round, battle.rounds.length - 1)]
    setNote(blow?.text ?? "The dice clatter on the shield.")
    window.setTimeout(() => setRolling(false), 350)
  }

  function endPhase() {
    if (phase < PHASES.length - 1) {
      setPhase((p) => p + 1)
      if (phase === 1 || phase === 2 || phase === 4) roll()
      return
    }
    setPhase(0)
    setRound((r) => Math.min(battle.rounds.length - 1, r + 1))
    playSfx("drums")
  }

  useEffect(() => {
    if (!auto || done) return
    const t = window.setTimeout(endPhase, 900)
    return () => window.clearTimeout(t)
    // auto-battle advances itself while the car is moving
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, phase, round, done])

  function playCard(name: string, cost: number) {
    if (cp < cost) return
    setCp((n) => n - cost)
    setSpent(name)
    setNote(`${name}. The ${unit?.name ?? "squad"} answers.`)
    playSfx(name === "Shield Wall" ? "shield" : "horn")
  }

  const atkModels = Math.max(0, Math.round(5 * atkRatio))
  const defModels = Math.max(0, Math.round(5 * defRatio))

  return (
    <section className={`tabletop ${auto ? "auto" : ""} ${battle.siege ? "siege" : ""}`}>
      <header className="tt-top">
        <div className="tt-side nash">
          <b>{battle.attackerFaction === "grog" ? "Grogs" : "Nash clan"}</b>
          <span>{battle.attackerName}</span>
        </div>
        <div className="tt-mid">
          <p className="eyebrow">Turn {round + 1}</p>
          <strong>{PHASES[phase]}</strong>
          <span>{auto ? "Auto-battle" : "Your phase"}</span>
        </div>
        <div className="tt-side grog">
          <b>{battle.defenderFaction === "grog" ? "Grogs" : battle.defenderFaction === "viking" ? "Nash clan" : "Town"}</b>
          <span>{battle.defenderName}</span>
        </div>
      </header>
      {!auto && (
        <aside className="tt-obj">
          <p>Primary: hold {battle.townName ?? "the ground"}</p>
          <p>Secondary: slay the warlord</p>
        </aside>
      )}
      <div className="tt-body">
        {!auto && unit && (
          <aside className="tt-card">
            <h3>{unit.name}</h3>
            <p className="fine">{UNIT_INFO[unit.cls].title}</p>
            <ul>
              <li>Move {unit.cls === "cavalry" ? "10" : unit.cls === "monster" ? "8" : "6"}</li>
              <li>Toughness {unit.cls === "monster" ? "7" : "4"}</li>
              <li>Save {unit.cls === "infantry" ? "3+" : "4+"}</li>
              <li>Wounds {unit.big ? "8" : "2"}</li>
              <li>Leadership 7</li>
            </ul>
            <p className="fine">{UNIT_INFO[unit.cls].blurb}</p>
            <p>Weapon · range {unit.cls === "archer" ? `24"` : `melee`} · A {unit.cls === "monster" ? 5 : 2} · S {unit.cls === "monster" ? 7 : 4} · D {unit.big ? 3 : 1}</p>
          </aside>
        )}
        <canvas ref={canvas} className="tt-field" />
        {!auto && (
          <ol className="tt-phases">
            {PHASES.map((name, i) => <li key={name} className={i === phase ? "on" : ""}>{name}</li>)}
          </ol>
        )}
      </div>
      <div className="tt-dice" aria-live="polite">
        {dice.map((n, i) => <span key={i} className={rolling ? "die spin" : "die"}>{n}</span>)}
        <p>{note}</p>
      </div>
      {!auto && (
        <div className="tt-strats">
          {CARDS.map((card) => (
            <button key={card.name} disabled={cp < card.cost || spent === card.name} onClick={() => playCard(card.name, card.cost)}>
              <b>{card.name}</b>
              <small>{card.cost} CP · {card.text}</small>
            </button>
          ))}
          <Button onClick={roll}>Roll dice</Button>
        </div>
      )}
      <footer className="tt-bottom">
        <div className="tt-roster">
          {minis.slice(0, 6).map((m, i) => (
            <button key={m.id} className={i === selected ? "on" : ""} onClick={() => setSelected(i)}>
              {m.art ? <img alt="" src={asset(m.art)} /> : <i />}
              <span>{m.name}</span>
              <small>{m.side === "atk" ? atkModels : defModels}/5</small>
            </button>
          ))}
        </div>
        <div className="tt-score">
          <span>CP {cp}</span>
          <span>VP {battle.win ? 8 : 3}–{battle.win ? 2 : 7}</span>
          {done ? <Button onClick={onClose}>{battle.win ? "Victory" : "Defeat"}</Button> : <Button onClick={endPhase}>{auto ? "Onward" : "End phase"}</Button>}
        </div>
      </footer>
      {done && <p className={`tt-banner ${battle.win ? "win" : "loss"}`}>{battle.win ? "Victory" : "Defeat"} · {battle.summary}</p>}
    </section>
  )
}

function makeMinis(battle: BattleResult): Mini[] {
  const out: Mini[] = []
  const place = (units: { name: string; cls: string }[], champs: { name: string; art: string }[], side: "atk" | "def") => {
    const baseX = side === "atk" ? 0.28 : 0.72
    units.slice(0, 4).forEach((u, i) => {
      const cls = (["infantry", "archer", "cavalry", "monster"].includes(u.cls) ? u.cls : "infantry") as UnitClass
      out.push({
        id: `${side}-${i}-${u.name}`,
        name: u.name,
        cls,
        art: champs[i]?.art ?? null,
        x: baseX + (i % 2) * 0.06 * (side === "atk" ? 1 : -1),
        y: 0.32 + i * 0.12,
        side,
        big: cls === "monster",
        hp: 5,
        max: 5,
      })
    })
    if (!units.length && champs[0]) {
      out.push({ id: `${side}-champ`, name: champs[0].name, cls: "infantry", art: champs[0].art, x: baseX, y: 0.5, side, big: false, hp: 5, max: 5 })
    }
  }
  place(battle.attackerUnits, battle.attackerChamps, "atk")
  place(battle.defenderUnits, battle.defenderChamps, "def")
  return out
}

function paintField(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  minis: Mini[],
  selected: number,
  phase: number,
  atkRatio: number,
  defRatio: number,
  battle: BattleResult,
  images: Map<string, HTMLImageElement>,
) {
  ctx.clearRect(0, 0, w, h)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, "#3d4a38")
  g.addColorStop(1, "#1c1814")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = "rgba(226,192,122,0.18)"
  for (let i = -6; i < 12; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 48, h * 0.2)
    ctx.lineTo(i * 48 + h, h)
    ctx.moveTo(w - i * 48, h * 0.2)
    ctx.lineTo(w - i * 48 - h, h)
    ctx.stroke()
  }
  ctx.fillStyle = "#6d6458"
  ctx.fillRect(w * 0.42, h * 0.18, w * 0.16, h * 0.12)
  ctx.fillStyle = "#8a7a62"
  ctx.fillRect(w * 0.46, h * 0.22, 18, 28)
  ctx.fillStyle = "#4a4034"
  ctx.fillRect(w * 0.62, h * 0.55, 36, 18)
  if (battle.siege) {
    ctx.fillStyle = "#c8bfb0"
    ctx.fillRect(w * 0.58, h * 0.28, 16, h * 0.42)
    ctx.fillRect(w * 0.78, h * 0.28, 16, h * 0.42)
    const gate = Math.max(0.15, defRatio)
    ctx.fillStyle = `rgba(90,60,30,${gate})`
    ctx.fillRect(w * 0.66, h * 0.38, w * 0.1, h * 0.22)
    if (phase === 2) {
      ctx.strokeStyle = "#e2c07a"
      ctx.beginPath()
      ctx.moveTo(w * 0.6, h * 0.32)
      ctx.lineTo(w * 0.4, h * 0.48)
      ctx.stroke()
    }
  }
  minis.forEach((m, i) => {
    const ratio = m.side === "atk" ? atkRatio : defRatio
    const x = m.x * w
    const y = m.y * h
    const fallen = ratio < 0.25 && i % 2 === 1
    const r = m.big ? 26 : 16
    ctx.save()
    if (fallen) ctx.rotate(0)
    ctx.fillStyle = "rgba(0,0,0,0.45)"
    ctx.beginPath()
    ctx.ellipse(x, y + r * 0.2, r * 1.1, r * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()
    if (i === selected) {
      ctx.strokeStyle = "#e2c07a"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(x, y + 4, r + 8, (r + 8) * 0.45, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = "rgba(226,192,122,0.8)"
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + (m.side === "atk" ? 54 : -54), y - 16)
      ctx.stroke()
    }
    ctx.fillStyle = m.side === "atk" ? "#1d3a46" : "#4a2018"
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = m.side === "atk" ? "#7fa8b8" : "#c45a32"
    ctx.stroke()
    const img = m.art ? images.get(m.art) : undefined
    if (img && img.complete && img.naturalWidth && !fallen) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y - r * 0.7, r * 0.7, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, x - r, y - r * 1.6, r * 2, r * 2)
      ctx.restore()
    } else {
      ctx.fillStyle = fallen ? "#444" : "#e6c2a0"
      ctx.beginPath()
      ctx.arc(x, y - r * 0.55, r * 0.45, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = "#111"
    ctx.fillRect(x - r, y + r * 0.35, r * 2, 4)
    ctx.fillStyle = m.side === "atk" ? "#7fa8b8" : "#c45a32"
    ctx.fillRect(x - r, y + r * 0.35, r * 2 * Math.max(0, ratio), 4)
    ctx.restore()
  })
}
