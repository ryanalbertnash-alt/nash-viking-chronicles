import { useEffect, useRef } from "react"
import { asset } from "@/art"
import { Button } from "@/components/ui/button"
import type { PrivateYou } from "@/shared/types.ts"

type Levels = { hall: number; forge: number; walls: number; dock: number; yard: number; shrine: number }

export function VillageView({
  you, onClose, onBuild, pulse,
}: {
  you: PrivateYou
  onClose: () => void
  onBuild: (part: keyof Levels) => void
  pulse: keyof Levels | null
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const youRef = useRef(you)
  youRef.current = you
  const pulseRef = useRef(pulse)
  pulseRef.current = pulse

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let frame = 0
    let alive = true
    const faces = you.champions.slice(0, 8).map((c) => {
      const img = new Image()
      img.src = asset(c.art)
      return img
    })
    const draw = () => {
      if (!alive) return
      frame += 1
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(320, rect.width)
      const h = Math.max(420, rect.height)
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr)
        canvas.height = Math.floor(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paint(ctx, w, h, frame, youRef.current, pulseRef.current, faces)
      requestAnimationFrame(draw)
    }
    const id = requestAnimationFrame(draw)
    return () => { alive = false; cancelAnimationFrame(id) }
  }, [you.champions, you.faction])

  const grog = you.faction === "grog"
  return (
    <section className="village" aria-label={grog ? "Grog camp" : "Norse village"}>
      <header>
        <div>
          <p className="eyebrow">{grog ? "The camp" : "The longhouse"}</p>
          <h2>{you.villageName}</h2>
          <p className="fine">{you.homePlaceName ?? "Your town"} · hearth gold {you.idleGold}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>Back to the map</Button>
      </header>
      <canvas ref={ref} />
      <div className="village-actions">
        <Button size="sm" onClick={() => onBuild("hall")}>Hall</Button>
        <Button size="sm" variant="outline" onClick={() => onBuild("walls")}>Walls</Button>
        <Button size="sm" variant="outline" onClick={() => onBuild("forge")}>Forge</Button>
        <Button size="sm" variant="outline" onClick={() => onBuild("yard")}>Yard</Button>
        <Button size="sm" variant="outline" onClick={() => onBuild("shrine")}>Shrine</Button>
        <Button size="sm" variant="outline" onClick={() => onBuild("dock")}>Dock</Button>
      </div>
    </section>
  )
}

function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
  you: PrivateYou,
  pulse: keyof Levels | null,
  faces: HTMLImageElement[],
) {
  const grog = you.faction === "grog"
  const t = frame / 60
  const ox = w * 0.52
  const oy = h * 0.34
  const tile = Math.min(w, h) / 14
  const project = (x: number, y: number, z = 0): [number, number] => [
    ox + (x - y) * tile * 0.55,
    oy + (x + y) * tile * 0.28 - z,
  ]
  ctx.clearRect(0, 0, w, h)
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.45)
  sky.addColorStop(0, grog ? "#2c261c" : "#87a888")
  sky.addColorStop(1, grog ? "#4a4030" : "#c3d2a4")
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  for (let y = -2; y < 12; y++) {
    for (let x = -2; x < 12; x++) {
      const grass = grog ? ((x + y) % 2 ? "#3e4630" : "#4a5338") : ((x + y) % 2 ? "#5f8f45" : "#6ea250")
      const field = y > 7 && x < 3
      diamond(ctx, project(x, y), tile, field ? (grog ? "#6a6230" : "#d2b24a") : grass)
    }
  }
  for (const [x, y] of [[-1, 2], [10, 1], [9, 8], [-1, 9], [3, -1]]) {
    const [sx, sy] = project(x, y)
    tree(ctx, sx, sy, grog, t + x)
  }
  const spread = 3 + you.hall
  if (you.walls >= 2) ring(ctx, project, spread + 0.4, you.walls, grog, true, pulse === "walls", t)
  else if (you.walls >= 1) ring(ctx, project, spread, 1, grog, false, pulse === "walls", t)
  house(ctx, project, 4, 4, 1.6 + you.hall * 0.25, 1.1, grog ? "#5a4030" : "#c4a06a", grog ? "#3a2a18" : "#6e8f62", pulse === "hall", t, true)
  if (you.forge > 0) house(ctx, project, 2.2, 5.2, 1.1, 0.8, "#6a5a4a", "#2a2a2a", pulse === "forge", t, false)
  if (you.yard > 0) yard(ctx, project, 6.2, 5.4, you.yard, grog, pulse === "yard", t)
  if (you.shrine > 0) shrine(ctx, project, 5.5, 2.4, you.shrine, grog, pulse === "shrine", t)
  if (you.dock > 0) dock(ctx, project, 3.2, 8.2, you.dock, grog, pulse === "dock", t)
  plaza(ctx, project, 4.2, 5.6, grog)
  const walkers = Math.min(12, 4 + Math.floor(you.companies.reduce((s, c) => s + c.strength, 0) / 24))
  for (let i = 0; i < walkers; i++) {
    const ang = t * 0.55 + i
    const rad = 1.6 + (i % 4) * 0.45
    const [sx, sy] = project(4.2 + Math.cos(ang) * rad, 5.2 + Math.sin(ang) * rad)
    villager(ctx, sx, sy, grog, faces[i % Math.max(1, faces.length)], i)
  }
}

function diamond(ctx: CanvasRenderingContext2D, at: [number, number], tile: number, fill: string) {
  const [x, y] = at
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + tile * 0.55, y + tile * 0.28)
  ctx.lineTo(x, y + tile * 0.56)
  ctx.lineTo(x - tile * 0.55, y + tile * 0.28)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

function tree(ctx: CanvasRenderingContext2D, x: number, y: number, grog: boolean, t: number) {
  ctx.fillStyle = grog ? "#3a2c1c" : "#6a4428"
  ctx.fillRect(x - 3, y, 6, 16)
  ctx.fillStyle = grog ? "#2f4630" : "#2f6a38"
  ctx.beginPath()
  ctx.arc(x, y - 6 + Math.sin(t) * 1.2, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = grog ? "#3d5a3a" : "#3e8a48"
  ctx.beginPath()
  ctx.arc(x - 4, y - 12, 9, 0, Math.PI * 2)
  ctx.fill()
}

function ring(
  ctx: CanvasRenderingContext2D,
  project: (x: number, y: number, z?: number) => [number, number],
  radius: number,
  level: number,
  grog: boolean,
  stone: boolean,
  build: boolean,
  t: number,
) {
  const pts: [number, number][] = []
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    pts.push(project(4.2 + Math.cos(a) * radius, 5 + Math.sin(a) * radius))
  }
  ctx.beginPath()
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]))
  ctx.closePath()
  ctx.strokeStyle = stone ? (grog ? "#6a6458" : "#d9d2c4") : (grog ? "#6a5030" : "#8a5a32")
  ctx.lineWidth = stone ? 10 : 6
  ctx.stroke()
  pts.forEach((p, i) => {
    if (!stone && i % 2) return
    ctx.fillStyle = stone ? (grog ? "#4e493f" : "#efe6d6") : (grog ? "#4a341c" : "#6d4a26")
    ctx.fillRect(p[0] - 5, p[1] - 16 - level * 2, 10, 18)
  })
  if (build) scaffold(ctx, pts[0][0], pts[0][1] - 20, t)
}

function house(
  ctx: CanvasRenderingContext2D,
  project: (x: number, y: number, z?: number) => [number, number],
  x: number,
  y: number,
  bw: number,
  bd: number,
  wall: string,
  roof: string,
  build: boolean,
  t: number,
  door: boolean,
) {
  const a = project(x, y)
  const b = project(x + bw, y)
  const c = project(x + bw, y + bd)
  const d = project(x, y + bd)
  const lift = 28
  ctx.fillStyle = "rgba(0,0,0,0.2)"
  ctx.beginPath()
  ctx.moveTo(a[0], a[1] + 8)
  ctx.lineTo(b[0], b[1] + 8)
  ctx.lineTo(c[0], c[1] + 8)
  ctx.lineTo(d[0], d[1] + 8)
  ctx.fill()
  ctx.fillStyle = wall
  ctx.beginPath()
  ctx.moveTo(d[0], d[1])
  ctx.lineTo(c[0], c[1])
  ctx.lineTo(c[0], c[1] - lift)
  ctx.lineTo(d[0], d[1] - lift)
  ctx.fill()
  ctx.fillStyle = shade(wall)
  ctx.beginPath()
  ctx.moveTo(c[0], c[1])
  ctx.lineTo(b[0], b[1])
  ctx.lineTo(b[0], b[1] - lift)
  ctx.lineTo(c[0], c[1] - lift)
  ctx.fill()
  ctx.fillStyle = roof
  ctx.beginPath()
  ctx.moveTo(a[0], a[1] - lift)
  ctx.lineTo(b[0], b[1] - lift)
  ctx.lineTo((b[0] + c[0]) / 2, (b[1] + c[1]) / 2 - lift - 18)
  ctx.lineTo((a[0] + d[0]) / 2, (a[1] + d[1]) / 2 - lift - 18)
  ctx.fill()
  if (door) {
    ctx.fillStyle = "#1c140e"
    ctx.fillRect(c[0] - 16, c[1] - 18, 10, 16)
  }
  if (build) scaffold(ctx, c[0], c[1] - lift, t)
}

function shade(hex: string) {
  return hex === "#c4a06a" ? "#a68450" : "#3a3228"
}

function yard(
  ctx: CanvasRenderingContext2D,
  project: (x: number, y: number, z?: number) => [number, number],
  x: number,
  y: number,
  level: number,
  grog: boolean,
  build: boolean,
  t: number,
) {
  for (let i = 0; i < 2 + level; i++) {
    const [sx, sy] = project(x + i * 0.45, y)
    ctx.strokeStyle = grog ? "#c4a06a" : "#f2efe6"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(sx, sy + Math.sin(t * 3 + i) * 2, 8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = "#c4553a"
    ctx.beginPath()
    ctx.arc(sx, sy, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  if (build) scaffold(ctx, project(x, y)[0], project(x, y)[1], t)
}

function shrine(
  ctx: CanvasRenderingContext2D,
  project: (x: number, y: number, z?: number) => [number, number],
  x: number,
  y: number,
  level: number,
  grog: boolean,
  build: boolean,
  t: number,
) {
  const [sx, sy] = project(x, y, 10 + level * 4)
  ctx.fillStyle = grog ? "#6a6860" : "#efe6d4"
  ctx.beginPath()
  ctx.moveTo(sx, sy - 26)
  ctx.lineTo(sx + 12, sy + 10)
  ctx.lineTo(sx - 12, sy + 10)
  ctx.fill()
  ctx.fillStyle = grog ? "#8a3030" : "#e2c07a"
  ctx.font = "14px Palatino, serif"
  ctx.fillText(grog ? "x" : "R", sx - 4, sy + Math.sin(t * 2))
  if (build) scaffold(ctx, sx, sy - 20, t)
}

function dock(
  ctx: CanvasRenderingContext2D,
  project: (x: number, y: number, z?: number) => [number, number],
  x: number,
  y: number,
  level: number,
  grog: boolean,
  build: boolean,
  t: number,
) {
  const [sx, sy] = project(x, y)
  ctx.fillStyle = grog ? "#24343c" : "#3d7ea6"
  ctx.beginPath()
  ctx.ellipse(sx, sy + 10, 34 + level * 4, 14, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = grog ? "#5a4632" : "#8b6240"
  ctx.fillRect(sx - 18, sy, 40 + level * 6, 8)
  ctx.fillStyle = grog ? "#3a2a22" : "#6d4c32"
  ctx.beginPath()
  ctx.moveTo(sx + 8, sy - 10 + Math.sin(t) * 2)
  ctx.lineTo(sx + 36, sy)
  ctx.lineTo(sx + 8, sy + 6)
  ctx.fill()
  if (build) scaffold(ctx, sx, sy - 16, t)
}

function plaza(
  ctx: CanvasRenderingContext2D,
  project: (x: number, y: number, z?: number) => [number, number],
  x: number,
  y: number,
  grog: boolean,
) {
  const [sx, sy] = project(x, y)
  ctx.fillStyle = grog ? "#3a342c" : "#c8b49a"
  ctx.beginPath()
  ctx.ellipse(sx, sy, 22, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = grog ? "#6a3030" : "#8ec4d8"
  ctx.beginPath()
  ctx.arc(sx, sy - 4, 6, 0, Math.PI * 2)
  ctx.fill()
}

function villager(ctx: CanvasRenderingContext2D, x: number, y: number, grog: boolean, face: HTMLImageElement | undefined, n: number) {
  ctx.fillStyle = "rgba(0,0,0,0.3)"
  ctx.beginPath()
  ctx.ellipse(x, y + 10, 7, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = grog ? "#6a3a28" : (n % 2 ? "#7d2a2a" : "#2d4a6a")
  ctx.fillRect(x - 5, y - 6, 10, 14)
  ctx.beginPath()
  ctx.arc(x, y - 10, 6, 0, Math.PI * 2)
  ctx.fillStyle = "#e6c2a0"
  ctx.fill()
  if (face && face.complete && face.naturalWidth) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y - 10, 6, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(face, x - 6, y - 16, 12, 12)
    ctx.restore()
  }
}

function scaffold(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.strokeStyle = "#e2c07a"
  ctx.lineWidth = 2
  ctx.strokeRect(x - 24, y, 48, 28)
  ctx.beginPath()
  ctx.moveTo(x - 24, y)
  ctx.lineTo(x + 24, y + 28)
  ctx.moveTo(x + 24, y)
  ctx.lineTo(x - 24, y + 28)
  ctx.stroke()
  ctx.fillStyle = `rgba(226,192,122,${0.3 + Math.sin(t * 8) * 0.2})`
  ctx.fillRect(x - 30, y + 30, 60, 4)
}

