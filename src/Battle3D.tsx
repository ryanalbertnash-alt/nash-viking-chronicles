import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js"
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
  hero: boolean
  hp: number
  alive: boolean
  x: number
  z: number
  state: Pose
  root: THREE.Group
  mixer: THREE.AnimationMixer
  actions: Map<string, THREE.AnimationAction>
  playing: string
  struck: boolean
  flash: number
  materials: THREE.MeshStandardMaterial[]
}

const BODY_URL = asset("models/quaternius-mannequin.glb")

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
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" })
    } catch (err) {
      console.error("battle-gl", err)
      fallbackRef.current()
      return
    }
    const low = (navigator.hardwareConcurrency || 4) <= 4
    const cap = low ? 6 : 8
    renderer.setPixelRatio(Math.min(low ? 1 : 1.5, window.devicePixelRatio || 1))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setClearColor(0x9aa3aa)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0xc5c8c2, 28, 48)
    scene.background = new THREE.Color(0x9aa3aa)
    const camera = new THREE.PerspectiveCamera(52, 1, 0.2, 80)
    const fit = () => {
      const aspect = el.clientWidth / Math.max(1, el.clientHeight)
      camera.aspect = aspect
      camera.fov = aspect < 0.85 ? 54 : 42
      camera.updateProjectionMatrix()
    }
    fit()
    camera.position.set(5.6, 6.4, 7.4)
    camera.lookAt(0, 0.7, 0)
    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.target.set(0, 0.7, 0)
    orbit.enablePan = false
    orbit.enableDamping = true
    orbit.minDistance = 8
    orbit.maxDistance = 28
    orbit.minPolarAngle = 0.55
    orbit.maxPolarAngle = 1.05
    orbit.update()

    scene.add(new THREE.HemisphereLight(0xe7eef6, 0x8d8778, 0.72))
    const sun = new THREE.DirectionalLight(0xfff6ea, 1.2)
    sun.position.set(-8, 16, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.near = 2
    sun.shadow.camera.far = 40
    sun.shadow.camera.left = -14
    sun.shadow.camera.right = 14
    sun.shadow.camera.top = 14
    sun.shadow.camera.bottom = -14
    scene.add(sun)
    const fire = new THREE.PointLight(0xff7a3a, 2.4, 3.2)
    fire.position.set(-2.2, 0.45, -4.2)
    const fire2 = new THREE.PointLight(0xff8a40, 1.6, 2.6)
    fire2.position.set(2.4, 0.4, 3.2)
    scene.add(fire, fire2)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 12),
      new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.92, metalness: 0 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)
    dressBoard(scene, battle.defenderFaction === "grog")

    const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 5, 4), new THREE.MeshBasicMaterial({ color: 0xff3a22 }), 80)
    sparks.frustumCulled = false
    scene.add(sparks)
    const sparkState = Array.from({ length: sparks.count }, () => ({ on: false, life: 0, v: new THREE.Vector3(), p: new THREE.Vector3(), blood: true }))
    const arrows = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), new THREE.MeshStandardMaterial({ color: 0xd8c49a, roughness: 0.5 }), 24)
    arrows.frustumCulled = false
    scene.add(arrows)
    const arrowState = Array.from({ length: 24 }, () => ({ on: false, t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), hit: -1 }))

    let alive = true
    let ended = false
    const fighters: Fighter[] = []
    const cd = { charge: 0, volley: 0, wall: 0 }
    let kills = 0
    let combo = 0
    let comboLeft = 0
    let shake = 0
    let slow = 0
    const focus = { id: "" }
    const _c = new THREE.Color()
    const _m = new THREE.Matrix4()
    const _q = new THREE.Quaternion()
    const _v = new THREE.Vector3()

    function spawnSpark(x: number, y: number, z: number, blood: boolean) {
      const slot = sparkState.find((s) => !s.on)
      if (!slot) return
      slot.on = true
      slot.blood = blood
      slot.life = 0.45
      slot.p.set(x, y, z)
      slot.v.set((Math.random() - 0.5) * 2.2, 1.2 + Math.random() * 1.6, (Math.random() - 0.5) * 2.2)
      sparks.setColorAt(sparkState.indexOf(slot), _c.setHex(blood ? 0x8a1410 : 0xffb15a))
    }

    function hurt(u: Fighter, amount: number) {
      if (!u.alive || ended) return
      u.hp -= amount
      u.flash = 0.18
      for (let i = 0; i < 4; i++) spawnSpark(u.x, 1, u.z, true)
      if (u.hp <= 0) {
        u.alive = false
        u.state = "dead"
        setClip(u, "dead")
        kills += 1
        combo += 1
        comboLeft = 2
        slow = 0.28
        shake = Math.min(0.2, shake + 0.08)
        setKills(kills)
        setCombo(combo)
        playSfx(u.cls === "monster" ? "roar" : "shield")
      } else {
        u.state = "hit"
        setClip(u, "hit")
        playSfx("clash")
      }
    }

    const loader = new GLTFLoader()
    const ready = loader.loadAsync(BODY_URL).then((body) => {
      if (!alive) return
      const roster = buildRoster(battle, cap)
      for (const spec of roster) {
        const root = cloneSkinned(body.scene) as THREE.Group
        prepare(root, spec.faction === "grog" ? 1.9 : 1.72, spec.faction === "grog", spec.cls)
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.38, 0.05, 18),
          new THREE.MeshStandardMaterial({ color: spec.side === "atk" ? 0xc9a15a : 0x6e2e28, metalness: 0.35, roughness: 0.5 }),
        )
        base.position.y = 0.025
        base.receiveShadow = true
        const holder = new THREE.Group()
        holder.add(base)
        holder.add(root)
        holder.position.set(spec.x, 0, spec.z)
        holder.rotation.y = spec.side === "atk" ? Math.PI / 2 : -Math.PI / 2
        scene.add(holder)
        const mixer = new THREE.AnimationMixer(root)
        const actions = new Map<string, THREE.AnimationAction>()
        for (const clip of body.animations) actions.set(clip.name, mixer.clipAction(clip, root))
        const materials: THREE.MeshStandardMaterial[] = []
        root.traverse((obj) => {
          const mesh = obj as THREE.Mesh
          if (!mesh.isMesh) return
          mesh.castShadow = true
          mesh.frustumCulled = false
          const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const mat of list) {
            if (mat instanceof THREE.MeshStandardMaterial) materials.push(mat)
          }
        })
        const fighter: Fighter = {
          ...spec,
          alive: true,
          state: "idle",
          root: holder,
          mixer,
          actions,
          playing: "",
          struck: false,
          flash: 0,
          materials,
        }
        setClip(fighter, "idle")
        fighters.push(fighter)
      }
      focus.id = fighters.find((u) => u.side === "def")?.id ?? ""
      el.dataset.ready = "yes"
    }).catch((err) => {
      console.error("battle-models", err)
      if (alive) fallbackRef.current()
    })
    void ready

    function nearest(from: Fighter) {
      let best: Fighter | null = null
      let bestD = 1e9
      for (const other of fighters) {
        if (!other.alive || other.side === from.side) continue
        if (focus.id && other.id === focus.id && other.side !== from.side) return other
        const d = (other.x - from.x) ** 2 + (other.z - from.z) ** 2
        if (d < bestD) { bestD = d; best = other }
      }
      return best
    }

    function loose(from: Fighter, to: Fighter, count = 1) {
      for (let n = 0; n < count; n++) {
        const slot = arrowState.find((a) => !a.on)
        if (!slot) return
        slot.on = true
        slot.t = -n * 0.08
        slot.from.set(from.x, 1.35, from.z + (n - (count - 1) / 2) * 0.18)
        slot.to.set(to.x + (n - (count - 1) / 2) * 0.45, 1.05, to.z)
        slot.hit = fighters.indexOf(to)
      }
      playSfx("arrow")
    }

    function strike(kind: "melee" | "shot" | "charge") {
      if (ended) return
      if (kind === "charge") {
        if (cd.charge > 0) return
        cd.charge = 5
        playSfx("horn")
        setPhase("Charge")
        for (const u of fighters) if (u.alive && u.side === "atk") { u.state = "run"; setClip(u, "run") }
      } else if (kind === "shot") {
        if (cd.volley > 0) return
        cd.volley = 3.5
        setPhase("Shafts in the air")
        for (const u of fighters) if (u.alive && u.side === "atk" && u.cls === "archer") { u.state = "shoot"; setClip(u, "shoot") }
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
    const clock = new THREE.Clock()
    let autoT = 1.4
    let formLeft = 0.7
    let hudTick = 0
    const loop = () => {
      if (!alive) return
      const real = Math.min(0.05, clock.getDelta())
      const dt = real * (slow > 0 ? 0.35 : 1)
      if (slow > 0) slow -= real
      shake = Math.max(0, shake - real)
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
      for (const u of fighters) {
        u.mixer.update(dt)
        if (!u.alive) continue
        const foe = nearest(u)
        const dist = foe ? Math.hypot(foe.x - u.x, foe.z - u.z) : 99
        const ranged = u.cls === "archer"
        const reach = ranged ? 3.2 : 0.85
        if (u.state === "hit" || u.state === "attack" || u.state === "shoot") {
          const action = u.actions.get(u.playing)
          const t = action ? action.time / Math.max(0.05, action.getClip().duration) : 1
          if (!u.struck && t > 0.42 && (u.state === "attack" || u.state === "shoot")) {
            u.struck = true
            if (u.state === "attack" && foe) hurt(foe, u.cls === "monster" ? 10 : 6)
            if (u.state === "shoot" && foe) loose(u, foe, 4)
          }
          if (t > 0.92) {
            u.struck = false
            u.state = foe && dist < reach + 0.3 ? (ranged ? "shoot" : "attack") : "run"
            setClip(u, u.state)
          }
        } else if (formLeft > 0) {
          if (u.state !== "idle") { u.state = "idle"; setClip(u, "idle") }
        } else if (foe && dist < reach) {
          u.state = ranged ? "shoot" : "attack"
          setClip(u, u.state)
        } else if (foe) {
          const step = 2.6 * dt
          u.x += Math.sign(foe.x - u.x) * step
          u.z += Math.sign(foe.z - u.z) * Math.min(step, Math.abs(foe.z - u.z))
          if (u.state !== "run") { u.state = "run"; setClip(u, "run") }
        }
        u.root.position.x = u.x
        u.root.position.z = u.z
        if (u.flash > 0) {
          u.flash = Math.max(0, u.flash - real)
          for (const mat of u.materials) {
            mat.emissive.setHex(u.flash > 0 ? 0x8a1814 : 0x000000)
            mat.emissiveIntensity = u.flash > 0 ? 0.8 : 0
          }
        }
      }
      for (let i = 0; i < arrowState.length; i++) {
        const a = arrowState[i]
        if (!a.on) {
          _m.makeScale(0.0001, 0.0001, 0.0001)
          arrows.setMatrixAt(i, _m)
          continue
        }
        a.t += dt * 1.6
        if (a.t < 0) {
          _m.makeScale(0.0001, 0.0001, 0.0001)
          arrows.setMatrixAt(i, _m)
          continue
        }
        _v.lerpVectors(a.from, a.to, Math.min(1, a.t))
        _m.compose(_v, _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.to.clone().sub(a.from).normalize()), new THREE.Vector3(1, 1, 1))
        arrows.setMatrixAt(i, _m)
        if (a.t >= 1) {
          a.on = false
          const victim = fighters[a.hit]
          if (victim?.alive) hurt(victim, 5)
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
        s.life -= real
        s.v.y -= real * 4
        s.p.addScaledVector(s.v, real)
        if (s.life <= 0 || s.p.y < 0.05) s.on = false
        _m.makeTranslation(s.p.x, s.p.y, s.p.z)
        sparks.setMatrixAt(i, _m)
      }
      sparks.instanceMatrix.needsUpdate = true
      if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true

      if (formLeft > 0) formLeft -= real
      orbit.update()
      if (fighters.length) {
        if (shake > 0) camera.position.x += (Math.random() - 0.5) * shake * 0.15
        if (formLeft <= 0 && !el.dataset.clash) {
          const atk = fighters.filter((u) => u.alive && u.side === "atk")
          const def = fighters.filter((u) => u.alive && u.side === "def")
          if (atk.length && def.length) {
            const ax = atk.reduce((sum, u) => sum + u.x, 0) / atk.length
            const dx = def.reduce((sum, u) => sum + u.x, 0) / def.length
            if (Math.abs(dx - ax) < 1.8) {
              el.dataset.clash = "yes"
              setPhase("Clash")
            }
          }
        }
        if (auto && !ended && formLeft <= 0) {
          autoT -= real
          if (autoT <= 0) {
            autoT = 1.8
            strike(Math.random() < 0.55 ? "charge" : "shot")
          }
        }
        const livingDef = fighters.some((u) => u.alive && u.side === "def")
        const livingAtk = fighters.some((u) => u.alive && u.side === "atk")
        if (!ended && (!livingDef || !livingAtk)) finish()
      }
      renderer.render(scene, camera)
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)

    const ray = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const onPointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
      ray.setFromCamera(pointer, camera)
      const hits = ray.intersectObjects(fighters.map((u) => u.root), true)
      const hit = hits[0]
      if (!hit) return
      const owner = fighters.find((u) => isInside(u.root, hit.object))
      if (!owner?.alive) return
      focus.id = owner.id
      setTarget(owner.name)
      if (owner.side === "def") strike("melee")
    }
    renderer.domElement.addEventListener("pointerdown", onPointer)

    const onResize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight)
      fit()
    }
    window.addEventListener("resize", onResize)
    return () => {
      alive = false
      window.removeEventListener("resize", onResize)
      renderer.domElement.removeEventListener("pointerdown", onPointer)
      orbit.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
      delete el.dataset.ready
      api.current = null
    }
  }, [battle, auto])

  return (
    <section className="battle3d">
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

function isInside(root: THREE.Object3D, obj: THREE.Object3D) {
  let cur: THREE.Object3D | null = obj
  while (cur) {
    if (cur === root) return true
    cur = cur.parent
  }
  return false
}

function setClip(u: Fighter, pose: Pose) {
  const names = clipNames(u, pose)
  const name = names.find((n) => u.actions.has(n)) ?? [...u.actions.keys()][0]
  if (!name || u.playing === name) return
  const next = u.actions.get(name)
  if (!next) return
  const once = pose === "dead" || pose === "attack" || pose === "shoot" || pose === "hit"
  next.reset()
  next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity)
  next.clampWhenFinished = pose === "dead"
  next.fadeIn(0.1).play()
  const prev = u.actions.get(u.playing)
  prev?.fadeOut(0.1)
  u.playing = name
}

function clipNames(_u: Fighter, pose: Pose): string[] {
  if (pose === "dead") return ["Death01"]
  if (pose === "hit") return ["Hit_Chest", "Hit_Head"]
  if (pose === "shoot") return ["Spell_Simple_Shoot", "Pistol_Shoot"]
  if (pose === "attack") return ["Sword_Attack", "Punch_Cross", "Punch_Jab"]
  if (pose === "run") return ["Jog_Fwd_Loop", "Sprint_Loop", "Walk_Loop"]
  return ["Idle_Loop", "Sword_Idle"]
}

function prepare(root: THREE.Group, height: number, grog: boolean, cls: UnitClass) {
  const skin = grog ? 0x6f8f3c : 0xd2a07a
  const joint = grog ? 0x4f6a28 : 0xb88862
  root.traverse((obj) => {
    obj.frustumCulled = false
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone()
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of list) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue
      const joints = /joint/i.test(mat.name)
      mat.color.setHex(joints ? joint : skin)
      mat.roughness = 0.72
      mat.metalness = 0.02
      mat.emissive.setHex(0x000000)
      mat.emissiveIntensity = 0
    }
  })
  dressBody(root, grog, cls)
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const scale = height / Math.max(0.001, size.y)
  root.scale.setScalar(scale)
  const fitted = new THREE.Box3().setFromObject(root)
  root.position.y -= fitted.min.y
}

function dressBody(root: THREE.Group, grog: boolean, cls: UnitClass) {
  const head = findBone(root, "DEF-head")
  const handL = findBone(root, "DEF-handL")
  const handR = findBone(root, "DEF-handR")
  const chest = findBone(root, "DEF-spine003")
  const leather = new THREE.MeshStandardMaterial({ color: grog ? 0x3a2a22 : 0x6b4228, roughness: 0.84, metalness: 0.05 })
  const fur = new THREE.MeshStandardMaterial({ color: grog ? 0x2a2118 : 0x8d6a42, roughness: 1, metalness: 0 })
  const steel = new THREE.MeshStandardMaterial({ color: grog ? 0x6a6560 : 0xb7c0c8, roughness: 0.38, metalness: 0.72 })
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a452c, roughness: 0.8, metalness: 0 })
  if (head) {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel)
    helm.position.set(0, 0.08, 0.02)
    helm.castShadow = true
    head.add(helm)
    if (!grog) {
      const beard = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 6), fur)
      beard.position.set(0, -0.02, 0.08)
      beard.rotation.x = Math.PI
      head.add(beard)
    } else {
      const hornMat = new THREE.MeshStandardMaterial({ color: 0x3a3428, roughness: 0.5, metalness: 0.2 })
      const left = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 6), hornMat)
      const right = left.clone()
      left.position.set(-0.06, 0.12, 0.02)
      right.position.set(0.06, 0.12, 0.02)
      left.rotation.z = 0.45
      right.rotation.z = -0.45
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.06, 5), new THREE.MeshStandardMaterial({ color: 0xe6d8b8, roughness: 0.45 }))
      const tusk2 = tusk.clone()
      tusk.position.set(-0.03, -0.04, 0.09)
      tusk2.position.set(0.03, -0.04, 0.09)
      head.add(left, right, tusk, tusk2)
    }
  }
  if (chest) {
    const tunic = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.16), leather)
    tunic.position.set(0, -0.05, 0.04)
    const cloak = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.06), fur)
    cloak.position.set(0, -0.12, -0.1)
    chest.add(tunic, cloak)
  }
  if (handL && cls !== "archer") {
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16), wood)
    shield.rotation.x = Math.PI / 2
    shield.position.set(0, 0.02, 0.08)
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), steel)
    boss.position.set(0, 0.02, 0.11)
    handL.add(shield, boss)
  }
  if (handL && cls === "archer") {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 12, Math.PI), wood)
    bow.position.set(0, 0.05, 0.06)
    handL.add(bow)
  }
  if (handR && cls !== "archer") {
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.55, 6), wood)
    haft.position.set(0, 0.2, 0.04)
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.03), steel)
    blade.position.set(0.08, 0.42, 0.04)
    handR.add(haft, blade)
  }
}

function findBone(root: THREE.Object3D, name: string): THREE.Bone | null {
  let found: THREE.Object3D | null = null
  root.traverse((obj) => {
    if (obj.name === name && (obj as THREE.Bone).isBone) found = obj
  })
  return found as THREE.Bone | null
}

function buildRoster(battle: BattleResult, cap: number) {
  return [...expand(battle, "atk", battle.attackerFaction, cap), ...expand(battle, "def", battle.defenderFaction === "grog" ? "grog" : "viking", cap)]
}

function expand(battle: BattleResult, side: "atk" | "def", faction: Faction, cap: number) {
  const units = side === "atk" ? battle.attackerUnits : battle.defenderUnits
  const champs = side === "atk" ? battle.attackerChamps : battle.defenderChamps
  const out: { id: string; name: string; side: "atk" | "def"; cls: UnitClass; faction: Faction; hero: boolean; hp: number; x: number; z: number }[] = []
  const push = (name: string, cls: UnitClass, hero: boolean, slot: number) => {
    const col = slot % 3
    const row = Math.floor(slot / 3)
    const dir = side === "atk" ? 1 : -1
    out.push({
      id: `${side}-${slot}-${name}`,
      name,
      side,
      cls,
      faction,
      hero,
      hp: hero ? 36 : cls === "monster" ? 30 : 16,
      x: (side === "atk" ? -2.15 : 2.15) - dir * row * 0.9,
      z: (col - 1) * 1.15,
    })
  }
  champs.slice(0, 2).forEach((c, i) => {
    const def = championById(c.id)
    push(c.name, def ? championClass(def) : "infantry", true, i)
  })
  const pool = units.length ? units : [{ name: side === "atk" ? "Huscarl" : "Levy", cls: "infantry" }]
  let n = 0
  while (out.length < cap) {
    const src = pool[n % pool.length]
    const cls = (["infantry", "archer", "cavalry", "monster"] as string[]).includes(src.cls) ? src.cls as UnitClass : "infantry"
    push(src.name, faction === "grog" && cls === "infantry" ? "monster" : cls, false, out.length)
    n++
  }
  return out
}

function boardTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 512
  const g = canvas.getContext("2d")
  if (!g) return new THREE.CanvasTexture(canvas)
  g.fillStyle = "#3e4a32"
  g.fillRect(0, 0, 512, 512)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? "#4a5638" : "#3a3424"
      g.fillRect(x * 64, y * 64, 64, 64)
      g.strokeStyle = "rgba(20,14,8,0.45)"
      g.strokeRect(x * 64 + 0.5, y * 64 + 0.5, 63, 63)
    }
  }
  g.fillStyle = "#5a4632"
  g.fillRect(160, 180, 192, 160)
  g.fillStyle = "#6a5040"
  for (let i = 0; i < 40; i++) g.fillRect(170 + (i % 8) * 22, 190 + Math.floor(i / 8) * 28, 16, 16)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function dressBoard(scene: THREE.Scene, grogCamp: boolean) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3424, roughness: 0.9 })
  const stone = new THREE.MeshStandardMaterial({ color: 0x6e6860, roughness: 0.85 })
  const thatch = new THREE.MeshStandardMaterial({ color: grogCamp ? 0x3a2a18 : 0x6a4a28, roughness: 1 })
  const hall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1), wood)
  hall.position.set(grogCamp ? 3.4 : -3.6, 0.4, -3.4)
  hall.castShadow = true
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.55, 4), thatch)
  roof.position.set(hall.position.x, 0.95, hall.position.z)
  roof.rotation.y = Math.PI / 4
  scene.add(hall, roof)
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 6), new THREE.MeshBasicMaterial({ color: 0xff5a18 }))
  flame.position.set(0.15, 0.28, 1.55)
  const ember = flame.clone()
  ember.position.set(-1.4, 0.32, -0.2)
  scene.add(flame, ember)
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), stone)
  rock.position.set(1.8, 0.16, 1.3)
  rock.castShadow = true
  scene.add(rock)
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 6), wood)
  trunk.position.set(-2.4, 0.35, 1.6)
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x243018, roughness: 1 }))
  crown.position.set(-2.4, 0.95, 1.6)
  scene.add(trunk, crown)
}
