import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { asset } from "@/art"
import { playSfx } from "@/audio"
import { Button } from "@/components/ui/button"
import type { UnitClass } from "@/shared/army.ts"
import { UNIT_INFO } from "@/shared/army.ts"
import type { BattleResult, Faction } from "@/shared/types.ts"

type Fig = {
  id: string
  name: string
  side: "atk" | "def"
  cls: UnitClass
  faction: Faction
  art: string | null
  hp: number
  max: number
  alive: boolean
  group: THREE.Group
  arm: THREE.Group
  body: THREE.Mesh
  portrait: THREE.Mesh
  flash: number
  swing: number
  dead: number
  home: THREE.Vector3
}

type Bolt = { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; onHit: () => void }
type FloatNum = { sprite: THREE.Sprite; life: number }

const CLS: UnitClass[] = ["infantry", "archer", "cavalry", "monster"]

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
  const api = useRef<{ strike: (kind: "melee" | "shot" | "charge") => void; retreat: () => void; focus: (id: string) => void } | null>(null)
  const fallbackRef = useRef(onFallback)
  fallbackRef.current = onFallback
  const [target, setTarget] = useState("the line")
  const [phase, setPhase] = useState("The lines form")
  const [done, setDone] = useState(false)
  const [low, setLow] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" })
    } catch {
      fallbackRef.current()
      return
    }
    const coarse = window.matchMedia("(pointer: coarse)").matches
    const cores = navigator.hardwareConcurrency || 4
    const detail = coarse || cores <= 4
    setLow(detail)
    const ratio = detail ? 1 : Math.min(1.5, window.devicePixelRatio || 1)
    renderer.setPixelRatio(ratio)
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = !detail
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setClearColor(0x14110e)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x1a1612, 0.045)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80)
    const camBase = new THREE.Vector3(0, 8, 12)
    const fit = () => {
      const aspect = el.clientWidth / Math.max(1, el.clientHeight)
      camera.aspect = aspect
      camera.fov = aspect < 0.85 ? 62 : 46
      camBase.set(0, aspect < 0.85 ? 7.4 : 6.2, aspect < 0.85 ? 10.2 : 11)
      camera.position.copy(camBase)
      camera.updateProjectionMatrix()
      camera.lookAt(0, 1.05, 0)
    }
    fit()

    scene.add(new THREE.HemisphereLight(0x8aa0b4, 0x2a1c12, 0.85))
    const sun = new THREE.DirectionalLight(0xffe0b0, 1.35)
    sun.position.set(-6, 10, 4)
    if (!detail) {
      sun.castShadow = true
      sun.shadow.mapSize.set(512, 512)
      sun.shadow.camera.near = 1
      sun.shadow.camera.far = 30
      sun.shadow.camera.left = -10
      sun.shadow.camera.right = 10
      sun.shadow.camera.top = 10
      sun.shadow.camera.bottom = -10
    }
    scene.add(sun)
    const rim = new THREE.DirectionalLight(0x6f8cff, 0.45)
    rim.position.set(6, 4, -6)
    scene.add(rim)

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(16, detail ? 24 : 48),
      new THREE.MeshStandardMaterial({ color: 0x3a3428, roughness: 0.95, metalness: 0.02 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = !detail
    scene.add(ground)
    const mud = new THREE.Mesh(
      new THREE.CircleGeometry(7.5, 24),
      new THREE.MeshStandardMaterial({ color: 0x2a241c, roughness: 1 }),
    )
    mud.rotation.x = -Math.PI / 2
    mud.position.y = 0.01
    scene.add(mud)
    buildTerrain(scene, detail)

    const figs: Fig[] = []
    const bolts: Bolt[] = []
    const floats: FloatNum[] = []
    const focus = { id: "" }
    let shake = 0
    let clockAcc = 0
    let blows = 0
    const maxBlows = 7
    let retreating = false
    let ended = false
    let alive = true

    const atkFaction = battle.attackerFaction
    const defFaction: Faction = battle.defenderFaction === "grog" ? "grog" : "viking"
    const atkRoster = roster(battle, "atk", atkFaction)
    const defRoster = roster(battle, "def", defFaction)
    atkRoster.forEach((u, i) => figs.push(spawn(scene, u, i, atkRoster.length, "atk", detail)))
    defRoster.forEach((u, i) => figs.push(spawn(scene, u, i, defRoster.length, "def", detail)))
    if (figs[0]) focus.id = figs.find((f) => f.side === "def")?.id ?? figs[0].id

    const ray = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const onPointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
      ray.setFromCamera(pointer, camera)
      const hits = ray.intersectObjects(figs.filter((f) => f.alive).map((f) => f.group), true)
      const hit = hits[0]?.object
      let node: THREE.Object3D | null = hit ?? null
      while (node && !node.userData.figId) node = node.parent
      if (!node) return
      focus.id = String(node.userData.figId)
      const fig = figs.find((f) => f.id === focus.id)
      if (fig) setTarget(fig.name)
      strike("melee")
    }
    renderer.domElement.addEventListener("pointerdown", onPointer)

    function living(side: "atk" | "def") {
      return figs.filter((f) => f.side === side && f.alive)
    }

    function hurt(fig: Fig, amount: number) {
      fig.hp = Math.max(0, fig.hp - amount)
      fig.flash = 1
      shake = Math.min(0.55, shake + 0.18)
      spawnNumber(fig, amount)
      burst(fig.group.position, 0x8e2d24)
      const mat = fig.body.material as THREE.MeshStandardMaterial
      mat.emissive.setHex(0x6a1a12)
      if (fig.hp <= 0) {
        fig.alive = false
        fig.dead = 0.01
        playSfx("shield")
      }
    }

    function spawnNumber(fig: Fig, amount: number) {
      const canvas = document.createElement("canvas")
      canvas.width = 128
      canvas.height = 64
      const g = canvas.getContext("2d")
      if (!g) return
      g.font = "bold 42px Palatino, serif"
      g.fillStyle = "#f2d2a0"
      g.strokeStyle = "#1a100c"
      g.lineWidth = 6
      g.strokeText(String(amount), 8, 46)
      g.fillText(String(amount), 8, 46)
      const tex = new THREE.CanvasTexture(canvas)
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
      sprite.position.copy(fig.group.position)
      sprite.position.y += 2.2
      sprite.scale.set(0.9, 0.45, 1)
      scene.add(sprite)
      floats.push({ sprite, life: 0.9 })
    }

    function burst(at: THREE.Vector3, color: number) {
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), new THREE.MeshBasicMaterial({ color }))
        m.position.copy(at)
        m.position.y += 1.2
        m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 2, 1.2 + Math.random(), (Math.random() - 0.5) * 2)
        m.userData.life = 0.45
        scene.add(m)
        floats.push({ sprite: m as unknown as THREE.Sprite, life: 0.45 })
      }
    }

    function strike(kind: "melee" | "shot" | "charge") {
      if (ended || retreating) return
      const attackers = living("atk")
      const defenders = living("def")
      if (!attackers.length || !defenders.length || blows >= maxBlows) {
        finish()
        return
      }
      blows += 1
      const progress = blows / maxBlows
      const wantDef = battle.win ? Math.max(0, 1 - progress) : Math.max(0.35, 1 - progress * 0.45)
      const wantAtk = battle.win ? Math.max(0.45, 1 - progress * 0.35) : Math.max(0, 1 - progress)
      setPhase(kind === "shot" ? "Shafts in the air" : kind === "charge" ? "Charge" : "The clash")
      if (kind === "charge") {
        playSfx("horn")
        for (const f of attackers) f.group.position.x += 0.7
        shake = 0.4
      }
      attackers.forEach((fig, i) => {
        const foe = (focus.id && defenders.find((d) => d.id === focus.id && d.alive)) || defenders[i % defenders.length]
        if (!foe) return
        if (fig.cls === "archer" || kind === "shot") {
          loose(fig, foe)
        } else {
          fig.swing = 1
          window.setTimeout(() => {
            if (!foe.alive) return
            const targetHp = foe.max * wantDef
            const amount = Math.max(4, Math.round((foe.hp - targetHp) * 0.55 + 6))
            hurt(foe, amount)
            playSfx(fig.cls === "monster" ? "roar" : "clash")
            if (fig.faction === "grog") playSfx("axe")
          }, 180)
        }
      })
      if (Math.random() < 0.65) {
        const back = defenders[0]
        const prey = attackers[0]
        if (back && prey) {
          window.setTimeout(() => {
            if (!prey.alive) return
            const targetHp = prey.max * wantAtk
            hurt(prey, Math.max(3, Math.round((prey.hp - targetHp) * 0.4 + 4)))
            playSfx("shield")
          }, 320)
        }
      }
      if (blows >= maxBlows) window.setTimeout(finish, 700)
    }

    function loose(from: Fig, to: Fig) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4),
        new THREE.MeshStandardMaterial({ color: 0xd8c49a, metalness: 0.2, roughness: 0.4 }),
      )
      mesh.rotation.z = Math.PI / 2
      const start = from.group.position.clone()
      start.y += 1.4
      const end = to.group.position.clone()
      end.y += 1.2
      mesh.position.copy(start)
      scene.add(mesh)
      playSfx("arrow")
      bolts.push({
        mesh,
        from: start,
        to: end,
        t: 0,
        onHit: () => {
          if (!to.alive) return
          hurt(to, Math.max(5, Math.round(to.max * 0.18)))
          playSfx("clash")
        },
      })
    }

    function finish() {
      if (ended) return
      ended = true
      for (const fig of figs) {
        if (battle.win && fig.side === "def" && fig.alive) {
          fig.hp = 0
          fig.alive = false
          fig.dead = 0.01
        }
        if (!battle.win && fig.side === "atk" && fig.alive && fig !== figs.find((f) => f.side === "atk")) {
          fig.hp = Math.max(1, Math.round(fig.max * 0.2))
        }
      }
      playSfx(battle.win ? "horn" : "drums")
      setDone(true)
      setPhase(battle.win ? "Victory" : "Defeat")
    }

    function retreat() {
      if (ended) return
      retreating = true
      setPhase("Fall back")
      playSfx("horn")
      window.setTimeout(finish, 900)
    }

    api.current = { strike, retreat, focus: (id) => { focus.id = id } }

    if (auto) window.setTimeout(() => strike("charge"), 400)

    const clock = new THREE.Clock()
    const loop = () => {
      if (!alive) return
      const dt = Math.min(0.05, clock.getDelta())
      shake = Math.max(0, shake - dt * 1.4)
      camera.position.set(
        camBase.x + (Math.random() - 0.5) * shake,
        camBase.y + (Math.random() - 0.5) * shake * 0.4,
        camBase.z,
      )
      if (retreating) camBase.z += dt * 1.2
      camera.lookAt(0, 1.1, 0)
      for (const fig of figs) {
        const breathe = Math.sin(clock.elapsedTime * 2 + fig.home.z) * 0.03
        if (fig.dead > 0) {
          fig.dead = Math.min(1, fig.dead + dt * 1.4)
          fig.group.rotation.z = fig.side === "atk" ? fig.dead * 1.3 : -fig.dead * 1.3
          fig.group.position.y = Math.max(0, 0.15 - fig.dead * 0.1)
        } else {
          fig.group.position.y = breathe
          fig.swing = Math.max(0, fig.swing - dt * 2.4)
          fig.arm.rotation.x = -0.5 - Math.sin(fig.swing * Math.PI) * 1.35
          fig.flash = Math.max(0, fig.flash - dt * 2.5)
          const mat = fig.body.material as THREE.MeshStandardMaterial
          mat.emissive.setRGB(fig.flash * 0.45, fig.flash * 0.05, fig.flash * 0.04)
          const bar = fig.group.getObjectByName("hp") as THREE.Mesh | undefined
          if (bar) bar.scale.x = Math.max(0.04, fig.hp / fig.max)
        }
        const spot = new THREE.Vector3()
        fig.group.getWorldPosition(spot)
        fig.portrait.position.set(spot.x, spot.y + 1.25 * (fig.cls === "monster" ? 1.35 : 1), spot.z)
        fig.portrait.quaternion.copy(camera.quaternion)
        fig.portrait.visible = fig.dead < 0.85
      }
      for (let i = bolts.length - 1; i >= 0; i--) {
        const bolt = bolts[i]
        bolt.t += dt * 2.4
        bolt.mesh.position.lerpVectors(bolt.from, bolt.to, Math.min(1, bolt.t))
        if (bolt.t >= 1) {
          bolt.onHit()
          scene.remove(bolt.mesh)
          bolts.splice(i, 1)
        }
      }
      for (let i = floats.length - 1; i >= 0; i--) {
        const item = floats[i]
        item.life -= dt
        item.sprite.position.y += dt * 0.8
        const mat = item.sprite.material as THREE.SpriteMaterial
        if (mat?.opacity != null) mat.opacity = Math.max(0, item.life)
        if (item.life <= 0) {
          scene.remove(item.sprite)
          floats.splice(i, 1)
        }
      }
      if (auto && !ended) {
        clockAcc += dt
        if (clockAcc > 0.85) {
          clockAcc = 0
          strike(blows % 3 === 1 ? "shot" : blows % 3 === 2 ? "charge" : "melee")
        }
      }
      renderer.render(scene, camera)
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    window.setTimeout(() => strike("melee"), 350)

    const onResize = () => {
      if (!el) return
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
        <div className="b3-phase"><p className="eyebrow">{auto ? "Auto-battle" : "The field"}{low ? " · light" : ""}</p><strong>{phase}</strong></div>
        <div><b>{battle.defenderFaction === "grog" ? "Grogs" : "Nash"}</b><span>{battle.defenderName}</span></div>
      </header>
      <div ref={host} className="b3-stage" />
      <p className="b3-target">Target: {target}. Tap a figure.</p>
      <div className="b3-controls">
        <Button onClick={() => api.current?.strike("charge")}>Charge</Button>
        <Button variant="outline" onClick={() => api.current?.strike("shot")}>Loose arrows</Button>
        <Button variant="secondary" onClick={() => api.current?.strike("melee")}>Shield wall</Button>
        <Button variant="destructive" onClick={() => api.current?.retreat()}>Retreat</Button>
      </div>
      {done && (
        <div className={`b3-end ${battle.win ? "win" : "loss"}`}>
          <h2>{battle.win ? "Victory" : "Defeat"}</h2>
          <p>{battle.summary}</p>
          <Button onClick={onClose}>{auto ? "Onward" : "Back to the road"}</Button>
        </div>
      )}
    </section>
  )
}

function roster(battle: BattleResult, side: "atk" | "def", faction: Faction) {
  const units = side === "atk" ? battle.attackerUnits : battle.defenderUnits
  const champs = side === "atk" ? battle.attackerChamps : battle.defenderChamps
  const out: { name: string; cls: UnitClass; art: string | null; faction: Faction }[] = []
  const list = units.length ? units : [{ name: side === "atk" ? battle.attackerName : battle.defenderName, cls: "infantry" }]
  list.slice(0, 4).forEach((u, i) => {
    const cls = CLS.includes(u.cls as UnitClass) ? u.cls as UnitClass : "infantry"
    out.push({ name: champs[i]?.name ?? u.name, cls, art: champs[i]?.art ?? champs[0]?.art ?? null, faction })
  })
  if (champs[0] && !out.some((u) => u.art === champs[0].art)) {
    out[0] = { name: champs[0].name, cls: out[0]?.cls ?? "infantry", art: champs[0].art, faction }
  }
  return out.slice(0, 4)
}

function spawn(
  scene: THREE.Scene,
  unit: { name: string; cls: UnitClass; art: string | null; faction: Faction },
  index: number,
  count: number,
  side: "atk" | "def",
  detail: boolean,
): Fig {
  const spread = (index - (count - 1) / 2) * 1.15
  const x = side === "atk" ? -1.85 : 1.85
  const group = new THREE.Group()
  group.position.set(x, 0, spread)
  group.lookAt(side === "atk" ? 0.2 : -0.2, 1.1, 2.4)
  const big = unit.cls === "monster" ? 1.35 : 1
  const grog = unit.faction === "grog"
  const skin = new THREE.MeshStandardMaterial({ color: grog ? 0x5d7a3a : 0xc49a78, roughness: 0.7 })
  const leather = new THREE.MeshStandardMaterial({ color: grog ? 0x4a3424 : 0x6b4228, roughness: 0.8 })
  const steel = new THREE.MeshStandardMaterial({ color: grog ? 0x6a6560 : 0x9aa7b2, metalness: 0.72, roughness: 0.32 })
  const fur = new THREE.MeshStandardMaterial({ color: grog ? 0x2a241c : 0x8a6a45, roughness: 1 })
  const cloth = new THREE.MeshStandardMaterial({ color: grog ? 0x6a3030 : 0x7d2e2a, roughness: 0.85 })

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62 * big, 0.68 * big, 0.08, detail ? 12 : 20), new THREE.MeshStandardMaterial({ color: 0x1a120c, metalness: 0.2, roughness: 0.6 }))
  base.position.y = 0.04
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62 * big, 0.035, 6, detail ? 12 : 20), new THREE.MeshStandardMaterial({ color: side === "atk" ? 0xe2c07a : 0xc45a32, metalness: 0.5, roughness: 0.4 }))
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.08
  group.add(base, rim)

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28 * big, 0.55 * big, 4, 8), leather)
  body.position.y = 1.05 * big
  body.castShadow = !detail
  group.add(body)
  const cape = new THREE.Mesh(new THREE.BoxGeometry(0.7 * big, 0.7 * big, 0.08), fur)
  cape.position.set(0, 1.15 * big, -0.22 * big)
  group.add(cape)
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * big, 0.38 * big, 0.45 * big, 8), cloth)
  skirt.position.y = 0.55 * big
  group.add(skirt)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22 * big, 12, 10), skin)
  head.position.y = 1.62 * big
  group.add(head)
  if (grog) {
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 6), steel)
    const hornR = hornL.clone()
    hornL.position.set(-0.12, 1.82 * big, 0)
    hornR.position.set(0.12, 1.82 * big, 0)
    hornL.rotation.z = 0.4
    hornR.rotation.z = -0.4
    group.add(hornL, hornR)
  } else {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.18 * big, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel)
    helm.position.y = 1.7 * big
    group.add(helm)
  }

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95 * big, 1.35 * big),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.02, side: THREE.DoubleSide }),
  )
  scene.add(face)
  if (unit.art) paintFace(unit.art, face, skin, leather, steel)

  const arm = new THREE.Group()
  arm.position.set(0.28 * big, 1.25 * big, 0.05)
  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.07 * big, 0.28 * big, 3, 6), skin)
  upper.position.y = -0.18 * big
  arm.add(upper)
  weapon(arm, unit.cls, grog, steel, leather, big)
  group.add(arm)

  if (unit.cls === "infantry" || unit.cls === "cavalry") {
    const shield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28 * big, 0.28 * big, 0.06, 16),
      steel,
    )
    shield.rotation.x = Math.PI / 2
    shield.position.set(-0.38 * big, 1.15 * big, 0.12)
    group.add(shield)
  }
  if (unit.cls === "cavalry") {
    const mount = grog ? boar(steel, leather, skin) : horse(leather, fur)
    mount.position.y = 0.15
    group.add(mount)
    group.position.y = 0.55
  }

  const hp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: side === "atk" ? 0x7fa8b8 : 0xc45a32 }))
  hp.name = "hp"
  hp.position.y = 2.15 * big
  group.add(hp)

  group.userData.figId = `${side}-${index}-${unit.name}`
  group.traverse((obj: THREE.Object3D) => { obj.userData.figId = group.userData.figId })
  scene.add(group)

  const max = unit.cls === "monster" ? 28 : UNIT_INFO[unit.cls].hp
  return {
    id: String(group.userData.figId),
    name: unit.name,
    side,
    cls: unit.cls,
    faction: unit.faction,
    art: unit.art,
    hp: max,
    max,
    alive: true,
    group,
    arm,
    body,
    portrait: face,
    flash: 0,
    swing: 0,
    dead: 0,
    home: group.position.clone(),
  }
}

function paintFace(file: string, face: THREE.Mesh, skin: THREE.MeshStandardMaterial, leather: THREE.MeshStandardMaterial, steel: THREE.MeshStandardMaterial) {
  const img = new Image()
  img.crossOrigin = "anonymous"
  img.onload = () => {
    const canvas = document.createElement("canvas")
    canvas.width = 256
    canvas.height = 320
    const g = canvas.getContext("2d")
    if (!g) return
    g.drawImage(img, 0, 0, 256, 320)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = face.material as THREE.MeshStandardMaterial
    mat.map = tex
    mat.needsUpdate = true
    const px = g.getImageData(128, 70, 1, 1).data
    const mid = g.getImageData(128, 150, 1, 1).data
    const low = g.getImageData(128, 230, 1, 1).data
    skin.color.setRGB(px[0] / 255, px[1] / 255, px[2] / 255)
    leather.color.setRGB(low[0] / 255, low[1] / 255, low[2] / 255)
    steel.color.setRGB(
      Math.min(1, mid[0] / 255 + 0.15),
      Math.min(1, mid[1] / 255 + 0.15),
      Math.min(1, mid[2] / 255 + 0.15),
    )
  }
  img.src = asset(file)
}

function weapon(arm: THREE.Group, cls: UnitClass, grog: boolean, steel: THREE.Material, leather: THREE.Material, big: number) {
  if (cls === "archer") {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.22 * big, 0.02, 6, 12, Math.PI), leather)
    bow.position.y = -0.35 * big
    arm.add(bow)
    return
  }
  const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7 * big, 6), leather)
  haft.position.y = -0.4 * big
  const blade = new THREE.Mesh(new THREE.BoxGeometry(grog ? 0.22 : 0.16, 0.28 * big, 0.04), steel)
  blade.position.set(grog ? 0.08 : 0.1, -0.62 * big, 0)
  arm.add(haft, blade)
}

function horse(leather: THREE.Material, fur: THREE.Material) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 4, 8), leather)
  body.rotation.z = Math.PI / 2
  body.position.y = 0.45
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.35, 3, 6), fur)
  neck.position.set(0.45, 0.75, 0)
  neck.rotation.z = -0.8
  g.add(body, neck)
  return g
}

function boar(steel: THREE.Material, leather: THREE.Material, skin: THREE.Material) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), skin)
  body.scale.set(1.4, 0.8, 0.9)
  body.position.y = 0.4
  const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), steel)
  tusk.rotation.z = Math.PI / 2
  tusk.position.set(0.45, 0.35, 0.1)
  const tusk2 = tusk.clone()
  tusk2.position.z = -0.1
  g.add(body, tusk, tusk2)
  void leather
  return g
}

function buildTerrain(scene: THREE.Scene, detail: boolean) {
  const stone = new THREE.MeshStandardMaterial({ color: 0x6d675c, roughness: 0.9 })
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.85 })
  const spots: [number, number, number, number][] = [[-2, 0, -3.2, 1.4], [2.4, 0, -2.6, 1.8], [0.2, 0, 3.4, 1.1], [-4.2, 0, 1.2, 0.8]]
  for (const [x, , z, h] of spots) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 * h, 0), stone)
    rock.position.set(x, 0.3 * h, z)
    rock.castShadow = !detail
    scene.add(rock)
  }
  for (let i = 0; i < 5; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.4, 6), wood)
    log.position.set(-5.2, 0.7, -2 + i * 0.9)
    scene.add(log)
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.35), stone)
  lintel.position.set(0, 2.1, -4.2)
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 0.35), stone)
  left.position.set(-0.7, 1.1, -4.2)
  const right = left.clone()
  right.position.x = 0.7
  scene.add(lintel, left, right)
}
