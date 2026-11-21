import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { playSfx } from "@/audio"
import { Button } from "@/components/ui/button"
import { championClass } from "@/shared/army.ts"
import { championById } from "@/shared/catalog.ts"
import type { UnitClass } from "@/shared/army.ts"
import type { BattleResult, Faction } from "@/shared/types.ts"

const BONES = 13
const PARENT = [-1, 0, 1, 2, 3, 3, 3, 5, 6, 1, 1, 9, 10]
const REST: [number, number, number][] = [
  [0, 0, 0],
  [0, 0.92, 0],
  [0, 0.16, 0],
  [0, 0.28, 0],
  [0, 0.34, 0],
  [-0.24, 0.12, 0],
  [0.24, 0.12, 0],
  [0, -0.28, 0],
  [0, -0.28, 0],
  [-0.1, -0.08, 0],
  [0.1, -0.08, 0],
  [0, -0.32, 0],
  [0, -0.32, 0],
]

type Weapon = "axe" | "sword" | "bow" | "maul"
type State = "idle" | "run" | "attack" | "shoot" | "hit" | "dead"

type Unit = {
  id: string
  name: string
  side: "atk" | "def"
  cls: UnitClass
  faction: Faction
  art: string | null
  hero: boolean
  hp: number
  max: number
  alive: boolean
  x: number
  y: number
  z: number
  scale: number
  state: State
  stateT: number
  seed: number
  rot: Float32Array
  weapon: Weapon
  beard: boolean
  horns: boolean
  tusks: boolean
  mount: "none" | "horse" | "boar"
  guard: number
  boost: number
  skin: number
  hair: number
  leather: number
  metal: number
  cloth: number
  fur: number
}

type Part = {
  mesh: THREE.InstancedMesh
  bone: number
  ox: number
  oy: number
  oz: number
  rx: number
  ry: number
  rz: number
  sx: number
  sy: number
  sz: number
  color: (u: Unit) => number
  show: (u: Unit) => boolean
}

const _m = new THREE.Matrix4()
const _o = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _s = new THREE.Vector3()
const _one = new THREE.Vector3(1, 1, 1)
const _c = new THREE.Color()

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

  useEffect(() => {
    const el = host.current
    if (!el) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" })
    } catch {
      fallbackRef.current()
      return
    }
    const cores = navigator.hardwareConcurrency || 4
    const low = cores <= 4
    const cap = low ? 14 : 22
    renderer.setPixelRatio(low ? 1 : Math.min(1.5, window.devicePixelRatio || 1))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = !low
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setClearColor(0x8eafd0)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0xc5d4b8, 14, 32)
    scene.background = new THREE.Color(0x8eafd0)
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80)
    const camBase = new THREE.Vector3(0, 7.2, 11)
    const fit = () => {
      const aspect = el.clientWidth / Math.max(1, el.clientHeight)
      camera.aspect = aspect
      camera.fov = aspect < 0.85 ? 64 : 46
      camBase.set(0, aspect < 0.85 ? 7.6 : 6.2, aspect < 0.85 ? 10.4 : 12.2)
      camera.updateProjectionMatrix()
    }
    fit()

    scene.add(new THREE.HemisphereLight(0xfff2d2, 0x6a8a48, 1.15))
    const sun = new THREE.DirectionalLight(0xffe2b0, 1.55)
    sun.position.set(-8, 14, 6)
    if (!low) {
      sun.castShadow = true
      sun.shadow.mapSize.set(1024, 1024)
      sun.shadow.camera.near = 2
      sun.shadow.camera.far = 40
      sun.shadow.camera.left = -12
      sun.shadow.camera.right = 12
      sun.shadow.camera.top = 12
      sun.shadow.camera.bottom = -12
    }
    scene.add(sun)
    const torch = new THREE.PointLight(0xff8830, 8, 14)
    torch.position.set(0, 1.6, -1)
    scene.add(torch)

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(18, low ? 24 : 48),
      new THREE.MeshStandardMaterial({ map: fieldTexture(), roughness: 1, metalness: 0 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = !low
    scene.add(ground)
    dressField(scene, low)

    const units = buildRoster(battle, cap)
    const boneWorld = units.map(() => Array.from({ length: BONES }, () => new THREE.Matrix4()))
    const parts = makeParts(units.length)
    for (const part of parts) scene.add(part.mesh)
    paintColors(parts, units)

    const arrows = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 4), new THREE.MeshBasicMaterial({ color: 0xf4e2b0 }), 48)
    arrows.frustumCulled = false
    arrows.count = 48
    scene.add(arrows)
    const arrowState = Array.from({ length: 48 }, () => ({ on: false, t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), hit: -1 }))

    const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 4, 3), new THREE.MeshBasicMaterial({ color: 0xff5a2a }), low ? 40 : 90)
    sparks.frustumCulled = false
    scene.add(sparks)
    const sparkState = Array.from({ length: sparks.count }, () => ({ on: false, life: 0, v: new THREE.Vector3(), p: new THREE.Vector3() }))

    const nums = poolNumbers(scene, 12)
    const cd = { charge: 0, volley: 0, wall: 0 }
    let kills = 0
    let combo = 0
    let comboLeft = 0
    let slow = 0
    let shake = 0
    let ended = false
    let hudTick = 0
    let alive = true
    const focus = { id: units.find((u) => u.side === "def")?.id ?? "" }

    const ray = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const onPointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
      ray.setFromCamera(pointer, camera)
      const hits = ray.intersectObjects(parts.map((p) => p.mesh))
      const hit = hits[0]
      if (!hit || hit.instanceId == null) return
      const u = units[hit.instanceId]
      if (!u?.alive) return
      focus.id = u.id
      setTarget(u.name)
      if (u.side === "def") strike("melee")
    }
    renderer.domElement.addEventListener("pointerdown", onPointer)

    function nearest(from: Unit) {
      let best: Unit | null = null
      let bestD = 1e9
      for (const o of units) {
        if (!o.alive || o.side === from.side) continue
        if (focus.id && o.id === focus.id && o.side !== from.side) return o
        const d = (o.x - from.x) ** 2 + (o.z - from.z) ** 2
        if (d < bestD) { bestD = d; best = o }
      }
      return best
    }

    function spawnSpark(x: number, y: number, z: number, color: number) {
      const slot = sparkState.find((s) => !s.on)
      if (!slot) return
      slot.on = true
      slot.life = 0.45
      slot.p.set(x, y, z)
      slot.v.set((Math.random() - 0.5) * 3, 1.4 + Math.random() * 2, (Math.random() - 0.5) * 3)
      _c.setHex(color)
      sparks.setColorAt(sparkState.indexOf(slot), _c)
    }

    function popNum(x: number, y: number, z: number, text: string) {
      const slot = nums.find((n) => n.life <= 0)
      if (!slot) return
      const g = slot.ctx
      g.clearRect(0, 0, 128, 64)
      g.font = "bold 44px Palatino, serif"
      g.lineWidth = 6
      g.strokeStyle = "#1a100c"
      g.fillStyle = "#f4e2b0"
      g.strokeText(text, 8, 48)
      g.fillText(text, 8, 48)
      slot.tex.needsUpdate = true
      slot.sprite.position.set(x, y, z)
      slot.sprite.visible = true
      slot.life = 0.7
    }

    function hurt(u: Unit, amount: number, from: Unit) {
      if (!u.alive) return
      const dmg = Math.max(1, Math.round(amount * (u.guard > 0 ? 0.45 : 1)))
      u.hp -= dmg
      u.state = u.hp <= 0 ? "dead" : "hit"
      u.stateT = 0
      const dir = from.side === "atk" ? 1 : -1
      u.x += dir * 0.28
      shake = Math.min(0.45, shake + (u.hero ? 0.22 : 0.1))
      for (let i = 0; i < (low ? 2 : 5); i++) spawnSpark(u.x, 1.2, u.z, u.hp <= 0 ? 0xffd27a : 0x9a1c14)
      if (u.hero || u.hp <= 0) popNum(u.x, 2.1, u.z, u.hp <= 0 ? "FALL" : String(dmg))
      if (u.hp <= 0) {
        u.alive = false
        kills += 1
        combo += 1
        comboLeft = 2.2
        slow = 0.35
        playSfx(u.cls === "monster" ? "roar" : "shield")
        setKills(kills)
        setCombo(combo)
      } else playSfx("clash")
    }

    function loose(from: Unit, to: Unit) {
      const slot = arrowState.find((a) => !a.on)
      if (!slot) return
      slot.on = true
      slot.t = 0
      slot.from.set(from.x, 1.35, from.z)
      slot.to.set(to.x, 1.15, to.z)
      slot.hit = units.indexOf(to)
      playSfx("arrow")
    }

    function strike(kind: "melee" | "shot" | "charge") {
      if (ended) return
      if (kind === "charge") {
        if (cd.charge > 0) return
        cd.charge = 5
        playSfx("horn")
        setPhase("Charge")
        for (const u of units) if (u.alive && u.side === "atk") { u.state = "run"; u.boost = 1.4; u.stateT = 0 }
      } else if (kind === "shot") {
        if (cd.volley > 0) return
        cd.volley = 3.5
        setPhase("Shafts in the air")
        for (const u of units) if (u.alive && u.side === "atk" && (u.cls === "archer" || u.weapon === "bow")) {
          u.state = "shoot"
          u.stateT = 0
        }
      } else {
        if (cd.wall > 0) return
        cd.wall = 6
        playSfx("shield")
        setPhase("Shield wall")
        for (const u of units) if (u.alive && u.side === "atk") u.guard = 2.4
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

    const clock = new THREE.Clock()
    let autoT = 0.4
    const loop = () => {
      if (!alive) return
      const real = Math.min(0.05, clock.getDelta())
      const dt = real * (slow > 0 ? 0.35 : 1)
      if (slow > 0) slow -= real
      shake = Math.max(0, shake - real * 1.6)
      cd.charge = Math.max(0, cd.charge - real)
      cd.volley = Math.max(0, cd.volley - real)
      cd.wall = Math.max(0, cd.wall - real)
      if (comboLeft > 0) {
        comboLeft -= real
        if (comboLeft <= 0) { combo = 0; setCombo(0) }
      }
      hudTick += real
      if (hudTick > 0.25) {
        hudTick = 0
        setCds({ charge: cd.charge, volley: cd.volley, wall: cd.wall })
      }

      for (const u of units) {
        if (u.state === "dead") { u.stateT += dt; continue }
        u.guard = Math.max(0, u.guard - dt)
        u.boost = Math.max(1, u.boost - dt)
        const foe = nearest(u)
        const dist = foe ? Math.abs(foe.x - u.x) : 99
        const reach = u.cls === "archer" || u.weapon === "bow" ? 4.2 : 1.15
        if (u.state === "run") {
          if (foe && dist < reach) {
            u.state = reach > 2 ? "shoot" : "attack"
            u.stateT = 0
          } else {
            const dir = u.side === "atk" ? 1 : -1
            u.x += dir * 2.15 * u.boost * dt
          }
        } else if (u.state === "attack" || u.state === "shoot" || u.state === "hit") {
          const prev = u.stateT
          u.stateT += dt
          if (u.state === "attack" && prev < 0.22 && u.stateT >= 0.22 && foe) hurt(foe, u.cls === "monster" ? 9 : 5, u)
          if (u.state === "shoot" && prev < 0.16 && u.stateT >= 0.16 && foe) loose(u, foe)
          const limit = u.state === "hit" ? 0.28 : u.state === "shoot" ? 0.48 : 0.55
          if (u.stateT > limit) {
            u.state = foe && dist < reach + 0.4 ? (reach > 2 ? "shoot" : "attack") : "run"
            u.stateT = 0
          }
        } else u.stateT += dt
      }

      for (let i = 0; i < units.length; i++) pose(units[i], clock.elapsedTime)
      for (let i = 0; i < units.length; i++) writeBones(units[i], boneWorld[i])
      for (const part of parts) {
        for (let i = 0; i < units.length; i++) writePart(part, units[i], i, boneWorld[i])
        part.mesh.instanceMatrix.needsUpdate = true
      }

      for (let i = 0; i < arrowState.length; i++) {
        const a = arrowState[i]
        if (!a.on) {
          _m.makeScale(0.0001, 0.0001, 0.0001)
          arrows.setMatrixAt(i, _m)
          continue
        }
        a.t += dt * 2.6
        _v.lerpVectors(a.from, a.to, Math.min(1, a.t))
        _m.compose(_v, _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.to.clone().sub(a.from).normalize()), _one)
        arrows.setMatrixAt(i, _m)
        if (a.t >= 1) {
          a.on = false
          const victim = units[a.hit]
          if (victim?.alive) hurt(victim, 6, units.find((u) => u.side !== victim.side) ?? victim)
        }
      }
      arrows.instanceMatrix.needsUpdate = true

      for (let i = 0; i < sparkState.length; i++) {
        const s = sparkState[i]
        if (!s.on) {
          _m.makeScale(0.0001, 0.0001, 0.0001)
          sparks.setMatrixAt(i, _m)
          continue
        }
        s.life -= dt
        s.v.y -= dt * 6
        s.p.addScaledVector(s.v, dt)
        if (s.life <= 0 || s.p.y < 0.05) s.on = false
        _m.compose(s.p, _q.identity(), _s.set(1, 1, 1))
        sparks.setMatrixAt(i, _m)
      }
      sparks.instanceMatrix.needsUpdate = true
      if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true

      for (const n of nums) {
        if (n.life <= 0) continue
        n.life -= real
        n.sprite.position.y += real * 0.7
        n.sprite.visible = n.life > 0
      }

      let ax = 0
      let az = 0
      let an = 0
      for (const u of units) if (u.alive) { ax += u.x; az += u.z; an++ }
      if (!an) finish()
      const aspect = camera.aspect
      const gap = lineGap(units)
      const zoom = THREE.MathUtils.clamp(gap / 5.5, 0.62, 1)
      const baseZ = aspect < 0.85 ? 10.2 : 12
      const baseY = aspect < 0.85 ? 7.2 : 6
      camBase.set((an ? ax / an : 0) * 0.25, baseY * (0.75 + 0.25 * zoom), baseZ * zoom)
      camera.position.lerp(camBase, 0.08)
      camera.position.x += (Math.random() - 0.5) * shake
      camera.position.y += (Math.random() - 0.5) * shake * 0.35
      camera.lookAt(an ? ax / an : 0, 1, an ? az / an : 0)

      if (auto && !ended) {
        autoT -= real
        if (autoT <= 0) {
          autoT = 1.6
          strike(Math.random() < 0.5 ? "charge" : "shot")
        }
      }
      const livingDef = units.some((u) => u.alive && u.side === "def")
      const livingAtk = units.some((u) => u.alive && u.side === "atk")
      if (!ended && (!livingDef || !livingAtk)) finish()

      renderer.render(scene, camera)
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)

    const onResize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight)
      fit()
    }
    window.addEventListener("resize", onResize)
    return () => {
      alive = false
      window.removeEventListener("resize", onResize)
      renderer.domElement.removeEventListener("pointerdown", onPointer)
      renderer.dispose()
      el.removeChild(renderer.domElement)
      api.current = null
    }
  }, [battle, auto])

  return (
    <section className="battle3d">
      <header className="b3-top">
        <div><b>{battle.attackerFaction === "grog" ? "Grogs" : "Nash clan"}</b><span>{battle.attackerName}</span></div>
        <div className="b3-phase">
          <p className="eyebrow">{auto ? "Auto-battle" : "The field"} · {kills} fallen{combo > 1 ? ` · ${combo} combo` : ""}</p>
          <strong>{phase}</strong>
        </div>
        <div><b>{battle.defenderFaction === "grog" ? "Grogs" : "Nash"}</b><span>{battle.defenderName}</span></div>
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

function lineGap(units: Unit[]) {
  let a = 0
  let b = 0
  let na = 0
  let nb = 0
  for (const u of units) {
    if (!u.alive) continue
    if (u.side === "atk") { a += u.x; na++ } else { b += u.x; nb++ }
  }
  if (!na || !nb) return 6
  return Math.abs(a / na - b / nb)
}

function pose(u: Unit, time: number) {
  const r = u.rot
  r.fill(0)
  const set = (b: number, x: number, y: number, z: number) => { r[b * 3] = x; r[b * 3 + 1] = y; r[b * 3 + 2] = z }
  const k = u.stateT
  if (u.state === "run") {
    const w = Math.sin(time * 10 + u.seed)
    set(2, 0.28, w * 0.08, 0)
    set(5, -w * 0.7, 0, 0.25)
    set(6, w * 0.7, 0, -0.25)
    set(9, w * 0.95, 0, 0)
    set(10, -w * 0.95, 0, 0)
    set(11, Math.max(0, -w) * 1.1, 0, 0)
    set(12, Math.max(0, w) * 1.1, 0, 0)
  } else if (u.state === "attack") {
    const s = Math.sin(Math.min(1, k / 0.45) * Math.PI)
    set(3, 0.1, s * 0.7, 0)
    set(6, -0.3 - s * 1.7, 0, -0.15)
    set(8, -0.4 * s, 0, 0)
    set(5, 0.4, 0, 0.4)
  } else if (u.state === "shoot") {
    const p = Math.min(1, k / 0.35)
    set(5, -1.15 * p, 0, 0.2)
    set(7, -0.3 * p, 0, 0)
    set(6, -0.45 * p, 0.2, -0.5)
  } else if (u.state === "hit") {
    set(2, -0.45, 0, 0)
    set(3, -0.25, 0, 0)
    set(6, 0.6, 0, -0.4)
  } else if (u.state === "dead") {
    const p = Math.min(1, k / 0.5)
    set(1, p * 1.45, 0, 0)
    set(9, -0.4 * p, 0, 0)
    set(10, 0.5 * p, 0, 0)
    set(6, 0.8 * p, 0, 0)
  } else {
    const w = Math.sin(time * 2 + u.seed)
    set(2, w * 0.04, 0, 0)
    set(5, 0.15, 0, 0.22)
    set(6, 0.2, 0, -0.28)
  }
}

function writeBones(u: Unit, world: THREE.Matrix4[]) {
  const yaw = u.side === "atk" ? -Math.PI / 2 : Math.PI / 2
  _e.set(0, yaw, u.state === "dead" ? Math.min(1, u.stateT) * (u.side === "atk" ? 0.4 : -0.4) : 0)
  _q.setFromEuler(_e)
  _v.set(u.x, u.state === "dead" ? Math.max(0.05, 0.2 - u.stateT * 0.15) : u.y, u.z)
  _s.set(u.scale, u.scale, u.scale)
  world[0].compose(_v, _q, _s)
  for (let b = 1; b < BONES; b++) {
    _e.set(u.rot[b * 3], u.rot[b * 3 + 1], u.rot[b * 3 + 2])
    _q.setFromEuler(_e)
    _v.set(REST[b][0], REST[b][1], REST[b][2])
    _m.compose(_v, _q, _one)
    world[b].multiplyMatrices(world[PARENT[b]], _m)
  }
}

function writePart(part: Part, u: Unit, index: number, world: THREE.Matrix4[]) {
  if (!part.show(u)) {
    _o.makeScale(0.0001, 0.0001, 0.0001)
    part.mesh.setMatrixAt(index, _o)
    return
  }
  _e.set(part.rx, part.ry, part.rz)
  _q.setFromEuler(_e)
  _v.set(part.ox, part.oy, part.oz)
  _s.set(part.sx, part.sy, part.sz)
  _m.compose(_v, _q, _s)
  _o.multiplyMatrices(world[part.bone], _m)
  part.mesh.setMatrixAt(index, _o)
}

function makeParts(count: number): Part[] {
  const skin = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62 })
  const leather = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 })
  const metal = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.72, roughness: 0.34 })
  const fur = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })
  const cloth = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 })
  const wood = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
  const geo = {
    torso: new THREE.CapsuleGeometry(0.2, 0.34, 4, 8),
    hips: new THREE.CylinderGeometry(0.16, 0.22, 0.28, 8),
    head: new THREE.SphereGeometry(0.16, 10, 8),
    hair: new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    beard: new THREE.ConeGeometry(0.09, 0.22, 6),
    helm: new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2.2),
    horn: new THREE.ConeGeometry(0.045, 0.28, 5),
    cloak: new THREE.BoxGeometry(0.46, 0.55, 0.08),
    arm: new THREE.CapsuleGeometry(0.06, 0.22, 3, 6),
    leg: new THREE.CapsuleGeometry(0.07, 0.26, 3, 6),
    boot: new THREE.BoxGeometry(0.12, 0.1, 0.2),
    shield: new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12),
    haft: new THREE.CylinderGeometry(0.025, 0.03, 0.55, 5),
    blade: new THREE.BoxGeometry(0.18, 0.22, 0.04),
    sword: new THREE.BoxGeometry(0.06, 0.5, 0.02),
    bow: new THREE.TorusGeometry(0.18, 0.018, 5, 10, Math.PI),
    mount: new THREE.CapsuleGeometry(0.22, 0.55, 4, 8),
    base: new THREE.CylinderGeometry(0.42, 0.46, 0.06, 12),
  }
  const inst = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const mesh = new THREE.InstancedMesh(g, m, count)
    mesh.frustumCulled = false
    mesh.castShadow = true
    return mesh
  }
  const P = (
    mesh: THREE.InstancedMesh, bone: number,
    ox: number, oy: number, oz: number, sx: number, sy: number, sz: number,
    color: (u: Unit) => number, show: (u: Unit) => boolean,
  ): Part => ({ mesh, bone, ox, oy, oz, rx: 0, ry: 0, rz: 0, sx, sy, sz, color, show })
  const parts: Part[] = [
    P(inst(geo.base, metal), 0, 0, 0.03, 0, 1, 1, 1, (u) => u.side === "atk" ? 0xc9a15a : 0x8a3a28, () => true),
    P(inst(geo.hips, cloth), 1, 0, 0, 0, 1, 1, 1, (u) => u.cloth, () => true),
    P(inst(geo.torso, leather), 3, 0, -0.02, 0, 1, 1.05, 1, (u) => u.leather, () => true),
    P(inst(geo.torso, metal), 3, 0, 0.02, -0.04, 0.72, 0.55, 0.55, (u) => u.metal, () => true),
    P(inst(geo.head, skin), 4, 0, 0, 0, 1, 1, 1, (u) => u.skin, () => true),
    P(inst(geo.hair, fur), 4, 0, 0.06, 0.02, 1, 0.7, 1, (u) => u.hair, () => true),
    P(inst(geo.beard, fur), 4, 0, -0.1, -0.08, 1, 1, 0.7, (u) => u.hair, (u) => u.beard),
    P(inst(geo.helm, metal), 4, 0, 0.05, 0, 1, 0.85, 1, (u) => u.metal, () => true),
    P(inst(geo.horn, metal), 4, -0.1, 0.16, 0, 1, 1, 1, (u) => u.metal, (u) => u.horns),
    P(inst(geo.horn, metal), 4, 0.1, 0.16, 0, 1, 1, 1, (u) => u.metal, (u) => u.horns),
    P(inst(geo.horn, skin), 4, -0.06, -0.02, -0.14, 0.6, 0.45, 1, (u) => u.skin, (u) => u.tusks),
    P(inst(geo.horn, skin), 4, 0.06, -0.02, -0.14, 0.6, 0.45, 1, (u) => u.skin, (u) => u.tusks),
    P(inst(geo.cloak, fur), 3, 0, -0.05, 0.2, 1, 1, 1, (u) => u.fur, () => true),
    P(inst(geo.arm, skin), 5, 0, -0.14, 0, 1, 1, 1, (u) => u.skin, () => true),
    P(inst(geo.arm, skin), 6, 0, -0.14, 0, 1, 1, 1, (u) => u.skin, () => true),
    P(inst(geo.arm, leather), 7, 0, -0.12, 0, 0.9, 0.9, 0.9, (u) => u.leather, () => true),
    P(inst(geo.arm, leather), 8, 0, -0.12, 0, 0.9, 0.9, 0.9, (u) => u.leather, () => true),
    P(inst(geo.shield, wood), 7, 0.02, -0.05, -0.16, 1, 0.35, 1, (u) => u.cloth, (u) => u.weapon !== "bow" && u.cls !== "monster"),
    P(inst(geo.haft, wood), 8, 0, -0.28, -0.02, 1, 1, 1, () => 0x6b4228, (u) => u.weapon === "axe" || u.weapon === "maul"),
    P(inst(geo.blade, metal), 8, 0.1, -0.48, 0, 1, 1, 1, (u) => u.metal, (u) => u.weapon === "axe" || u.weapon === "maul"),
    P(inst(geo.sword, metal), 8, 0, -0.42, -0.02, 1, 1, 1, (u) => u.metal, (u) => u.weapon === "sword"),
    P(inst(geo.bow, wood), 7, 0, -0.05, -0.12, 1, 1, 1, () => 0x6b4228, (u) => u.weapon === "bow"),
    P(inst(geo.leg, leather), 9, 0, -0.16, 0, 1, 1, 1, (u) => u.leather, () => true),
    P(inst(geo.leg, leather), 10, 0, -0.16, 0, 1, 1, 1, (u) => u.leather, () => true),
    P(inst(geo.leg, leather), 11, 0, -0.14, 0, 0.85, 0.85, 0.85, (u) => u.leather, () => true),
    P(inst(geo.leg, leather), 12, 0, -0.14, 0, 0.85, 0.85, 0.85, (u) => u.leather, () => true),
    P(inst(geo.boot, leather), 11, 0, -0.28, -0.04, 1, 1, 1, (u) => u.leather, () => true),
    P(inst(geo.boot, leather), 12, 0, -0.28, -0.04, 1, 1, 1, (u) => u.leather, () => true),
    P(inst(geo.mount, leather), 0, 0, 0.45, 0.15, 1.3, 0.85, 0.9, (u) => u.mount === "boar" ? u.skin : u.leather, (u) => u.mount !== "none"),
  ]
  parts[6].rx = Math.PI
  parts[8].rz = 0.55
  parts[9].rz = -0.55
  parts[17].rx = Math.PI / 2
  parts[28].rx = Math.PI / 2
  return parts
}

function paintColors(parts: Part[], units: Unit[]) {
  for (const part of parts) {
    for (let i = 0; i < units.length; i++) {
      _c.setHex(part.color(units[i]))
      part.mesh.setColorAt(i, _c)
    }
    if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true
  }
}

function buildRoster(battle: BattleResult, cap: number): Unit[] {
  const atk = expand(battle, "atk", battle.attackerFaction, cap)
  const defFaction: Faction = battle.defenderFaction === "grog" ? "grog" : "viking"
  const def = expand(battle, "def", defFaction, cap)
  return [...atk, ...def]
}

function expand(battle: BattleResult, side: "atk" | "def", faction: Faction, cap: number): Unit[] {
  const units = side === "atk" ? battle.attackerUnits : battle.defenderUnits
  const champs = side === "atk" ? battle.attackerChamps : battle.defenderChamps
  const out: Unit[] = []
  const push = (name: string, cls: UnitClass, art: string | null, id: string | null, hero: boolean, slot: number) => {
    const look = lookOf(id, faction, cls, art)
    const cols = 5
    const row = Math.floor(slot / cols)
    const col = (slot % cols) - (cols - 1) / 2
    const dir = side === "atk" ? 1 : -1
    out.push({
      id: `${side}-${slot}-${name}`,
      name,
      side,
      cls,
      faction,
      art,
      hero,
      hp: hero ? 34 : cls === "monster" ? 28 : cls === "archer" ? 12 : 16,
      max: hero ? 34 : cls === "monster" ? 28 : cls === "archer" ? 12 : 16,
      alive: true,
      x: (side === "atk" ? -2.5 : 2.5) - dir * row * 0.7,
      y: 0,
      z: col * 0.78,
      scale: look.scale,
      state: "run",
      stateT: Math.random(),
      seed: Math.random() * 6,
      rot: new Float32Array(BONES * 3),
      weapon: look.weapon,
      beard: look.beard,
      horns: look.horns,
      tusks: look.tusks,
      mount: cls === "cavalry" ? (faction === "grog" ? "boar" : "horse") : "none",
      guard: 0,
      boost: 1,
      skin: look.skin,
      hair: look.hair,
      leather: look.leather,
      metal: look.metal,
      cloth: look.cloth,
      fur: look.fur,
    })
  }
  champs.slice(0, 4).forEach((c, i) => {
    const def = championById(c.id)
    const cls = def ? championClass(def) : "infantry"
    push(c.name, cls, c.art, c.id, true, i)
  })
  const pool = units.length ? units : [{ name: side === "atk" ? "Huscarls" : "Levy", cls: "infantry" }]
  let n = 0
  while (out.length < cap) {
    const src = pool[n % pool.length]
    const cls = (["infantry", "archer", "cavalry", "monster"] as string[]).includes(src.cls) ? src.cls as UnitClass : "infantry"
    push(src.name, cls, champs[0]?.art ?? null, null, false, out.length)
    n++
  }
  return out
}

function lookOf(id: string | null, faction: Faction, cls: UnitClass, _art: string | null) {
  const grog = faction === "grog"
  const known: Record<string, Partial<ReturnType<typeof blankLook>>> = {
    ryan: { hair: 0xd7b15a, beard: true, leather: 0x6b3a28, fur: 0xc4a574, metal: 0xb7c0c8, cloth: 0x7a2a24, weapon: "axe" },
    ralph: { hair: 0xc8c4bc, beard: true, leather: 0x5a4034, weapon: "axe" },
    billy: { hair: 0x8a3a22, beard: true, cloth: 0x8a1e16, weapon: "axe" },
    gavin: { hair: 0x4a3428, beard: true, metal: 0xd0d6dc, weapon: "sword" },
    haydin: { hair: 0x6a4a28, beard: true, weapon: "bow", leather: 0x6d5a32 },
    lana: { hair: 0xc4562a, beard: false, weapon: "bow" },
    emma: { hair: 0xe6d2a4, beard: false, metal: 0xe2c07a, weapon: "sword" },
    donna: { hair: 0xeee6dc, beard: false, cloth: 0x3a4a6a, weapon: "bow" },
    kali: { hair: 0x2a2118, beard: false, metal: 0x9aa4ae },
    anna: { hair: 0xc48a4a, beard: false, cloth: 0xf2efe6 },
    gorgrath: { skin: 0x5f7a38, hair: 0x1a120c, horns: true, tusks: true, beard: true, weapon: "axe", metal: 0x6a6560 },
    urzog: { skin: 0x4e6a32, horns: true, tusks: true, weapon: "maul", scale: 1.45 },
    zug: { skin: 0x6a8a40, horns: true, tusks: true, weapon: "axe" },
    sharga: { skin: 0x567038, horns: true, beard: false, weapon: "bow" },
    brakka: { skin: 0x4a6230, horns: true, tusks: true, metal: 0x8a9094, scale: 1.25 },
  }
  const base = blankLook(grog, cls)
  const extra = id && known[id] ? known[id] : {}
  return { ...base, ...extra }
}

function blankLook(grog: boolean, cls: UnitClass) {
  return {
    skin: grog ? 0x5d7a3a : 0xc49a78,
    hair: grog ? 0x24180f : 0x6a4a2a,
    leather: grog ? 0x4a3424 : 0x6b4228,
    metal: grog ? 0x7a756e : 0x9aa6b0,
    cloth: grog ? 0x6a2420 : 0x7d2e2a,
    fur: grog ? 0x3a2c22 : 0xb08958,
    beard: !grog && cls !== "archer",
    horns: grog,
    tusks: grog && cls !== "archer",
    weapon: (cls === "archer" ? "bow" : cls === "monster" ? "maul" : cls === "cavalry" ? "sword" : "axe") as Weapon,
    scale: cls === "monster" ? 1.4 : grog ? 1.12 : 1,
  }
}

function fieldTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 512
  const g = canvas.getContext("2d")
  if (!g) return new THREE.CanvasTexture(canvas)
  g.fillStyle = "#67a34a"
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = i % 2 ? "#5b9440" : "#86b85a"
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 3)
  }
  g.fillStyle = "#8d6b42"
  g.beginPath()
  g.ellipse(256, 270, 150, 110, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = "#6e5234"
  g.beginPath()
  g.ellipse(256, 290, 60, 36, 0, 0, Math.PI * 2)
  g.fill()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function dressField(scene: THREE.Scene, low: boolean) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.9 })
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.92 })
  const leaf = new THREE.MeshStandardMaterial({ color: 0x3f7a34, roughness: 1 })
  const logs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 1.5, 5), wood, 28)
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.45, 0), stone, 10)
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 5), wood, 8)
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(0.7, 1.6, 6), leaf, 8)
  ;[logs, rocks, trunks, crowns].forEach((m) => { m.castShadow = !low; m.receiveShadow = !low; scene.add(m) })
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2
    _v.set(Math.cos(a) * 8.2, 0.75, Math.sin(a) * 6.2)
    _q.setFromEuler(_e.set(0, a, 0))
    _m.compose(_v, _q, _one)
    logs.setMatrixAt(i, _m)
  }
  const rockPos = [[-3.2, 0.3, -2.4], [2.6, 0.35, -1.8], [0.4, 0.25, 2.8], [-1.5, 0.2, 2.2], [3.4, 0.3, 1.6]]
  rockPos.forEach((p, i) => {
    _v.set(p[0], p[1], p[2])
    _m.compose(_v, _q.identity(), _s.set(1, 0.8, 1))
    rocks.setMatrixAt(i, _m)
  })
  const trees = [[-6, -3], [6.2, -2.4], [-5.5, 3.2], [5.4, 3.4], [-2, -4.5], [2.2, -4.6]]
  trees.forEach((p, i) => {
    _v.set(p[0], 0.55, p[1])
    _m.compose(_v, _q.identity(), _one)
    trunks.setMatrixAt(i, _m)
    _v.set(p[0], 1.7, p[1])
    _m.compose(_v, _q.identity(), _one)
    crowns.setMatrixAt(i, _m)
  })
  const ruin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), stone)
  ruin.position.set(-0.8, 1.1, -3.6)
  const ruin2 = ruin.clone()
  ruin2.position.x = 0.8
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2, 0.28, 0.4), stone)
  lintel.position.set(0, 2.2, -3.6)
  scene.add(ruin, ruin2, lintel)
  logs.instanceMatrix.needsUpdate = true
  rocks.instanceMatrix.needsUpdate = true
  trunks.instanceMatrix.needsUpdate = true
  crowns.instanceMatrix.needsUpdate = true
}

function poolNumbers(scene: THREE.Scene, count: number) {
  return Array.from({ length: count }, () => {
    const canvas = document.createElement("canvas")
    canvas.width = 128
    canvas.height = 64
    const ctx = canvas.getContext("2d")!
    const tex = new THREE.CanvasTexture(canvas)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
    sprite.visible = false
    sprite.scale.set(0.8, 0.4, 1)
    scene.add(sprite)
    return { sprite, tex, ctx, life: 0 }
  })
}
