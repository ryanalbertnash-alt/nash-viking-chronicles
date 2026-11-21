import { useEffect, useRef, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { narrate, playSfx, playSting, playVoice, setDrivingAudio, setMusicBattle, setMusicFaction, setMusicLevel, setMusicMuted, unlockMusic } from "@/audio"
import { BattleView, HallPanel, RoadsPanel, SagaPanel, Sheet, ShopPanel, TownPanel, WarbandPanel } from "@/Panels"
import { WarMap } from "@/WarMap"
import { LOCK_KMH, champions, itemById } from "@/shared/catalog.ts"
import { formatMeters, haversine, pointAlong, projectRoute, routeLength } from "@/shared/geo.ts"
import { driveRoutes, riverRoute } from "@/shared/routes.ts"
import type { PublicPlayer, PublicTown, Stance } from "@/shared/types.ts"
import type { VoiceCommand } from "@/shared/voice.ts"
import { REPORT_INFO, REPORT_TYPES, reportSpeech } from "@/shared/reports.ts"
import type { NavPlan } from "@/shared/nav.ts"
import { matchName, parseCommand } from "@/shared/voice.ts"
import { useSession } from "@/session"
import { canListen, listenOnce, onCaption, setVoiceFaction, speak, startAmbient, unlockSpeech } from "@/speech"

type Sheet = null | { kind: "town" | "hall" | "warband" | "shop" | "saga" | "roads" | "report"; id?: string }
type Pending = { kind: "town" | "player"; id: string; action: "claim" | "attackTown" | "attackPlayer" }

export function Play() {
  const { you, world, feed, send, link, signOut } = useSession()
  if (!you || !world || !you.faction) return null
  return <Board you={you} world={world} feed={feed} send={send} link={link} signOut={signOut} />
}

function Board({
  you, world, feed, send, link, signOut,
}: {
  you: NonNullable<ReturnType<typeof useSession>["you"]>
  world: NonNullable<ReturnType<typeof useSession>["world"]>
  feed: ReturnType<typeof useSession>["feed"]
  send: ReturnType<typeof useSession>["send"]
  link: ReturnType<typeof useSession>["link"]
  signOut: () => void
}) {
  const [pos, setPos] = useState({ lat: you.lat, lng: you.lng, heading: you.heading || 0 })
  const [speed, setSpeed] = useState(0)
  const [passenger, setPassenger] = useState(false)
  const [follow, setFollow] = useState(true)
  const [muted, setMuted] = useState(false)
  const [caption, setCaption] = useState("Say Hey Valhalla. Claim the town you stand in, then raise the hall.")
  const [sheet, setSheet] = useState<Sheet>(null)
  const [battle, setBattle] = useState<typeof feed.result>()
  const [pending, setPending] = useState<Pending | null>(null)
  const [hot, setHot] = useState(false)
  const [gps, setGps] = useState(false)
  const [routeId, setRouteId] = useState("heartland")
  const [scale, setScale] = useState(10)
  const [nav, setNav] = useState<NavPlan | null>(null)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<{ name: string; lat: number; lng: number }[]>([])
  const [level, setLevel] = useState(70)
  const [roadLimit, setRoadLimit] = useState<number | null>(null)
  const roadLimitRef = useRef<number | null>(null)
  roadLimitRef.current = roadLimit
  const navRef = useRef<NavPlan | null>(null)
  navRef.current = nav
  const said = useRef(new Set<string>())
  const limitWarned = useRef("")
  const offRoute = useRef(0)
  const guideRef = useRef<(here: { lat: number; lng: number; heading: number }, speedKmh: number) => void>(() => {})
  const sim = useRef({ playing: false, distance: 0, dir: 1 as 1 | -1, speed: 72, stopped: new Set<string>(), ready: false })
  const posRef = useRef(pos)
  posRef.current = pos
  const speedRef = useRef(0)
  const passRef = useRef(passenger)
  passRef.current = passenger
  const youRef = useRef(you)
  youRef.current = you
  const worldRef = useRef(world)
  worldRef.current = world
  const gpsRef = useRef(gps)
  gpsRef.current = gps
  const routeRef = useRef(routeId)
  routeRef.current = routeId
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  const route = driveRoutes.find((r) => r.id === routeId) ?? driveRoutes[0]
  const locked = speed > LOCK_KMH && !passenger
  const nearest = nearestTown(pos, world.towns)
  const ahead = nextAhead(route.coordinates, sim.current.distance, sim.current.dir, world.towns)

  useEffect(() => {
    onCaption(setCaption)
    setVoiceFaction(you.faction)
    setMusicFaction(you.faction === "grog")
    unlockSpeech()
    unlockMusic()
    if (!sim.current.ready) {
      const here = posRef.current
      const best = driveRoutes
        .map((r) => ({ r, p: projectRoute(r.coordinates, here.lat, here.lng) }))
        .sort((a, b) => a.p.off - b.p.off)[0]
      if (best) {
        sim.current.ready = true
        sim.current.distance = best.p.along
        setRouteId(best.r.id)
      }
    }
    return startAmbient((text) => {
      const cmd = parseCommand(text, true)
      if (!cmd) return
      runRef.current(cmd)
    })
  }, [you.faction])

  useEffect(() => {
    if (speed > LOCK_KMH && !passenger) {
      setSheet(null)
      setPending(null)
      setBattle(undefined)
    }
  }, [speed, passenger])

  const seenFeed = useRef(0)
  useEffect(() => {
    if (feed.n === seenFeed.current) return
    seenFeed.current = feed.n
    const text = feed.result?.summary || feed.error || feed.event?.speech
    if (!text) return
    setCaption(text)
    const result = feed.result
    if (result) {
      const tactical = speedRef.current <= LOCK_KMH || passRef.current
      setMusicBattle(true)
      playSfx("horn")
      if (youRef.current.faction === "grog") playSfx("roar")
      const lead = youRef.current.warband[0]
      if (tactical) {
        if (lead) void playVoice(lead, "cry")
        setBattle(result)
      } else {
        void (async () => {
          if (lead) await playVoice(lead, "cry")
          playSfx(result.win ? "clash" : "shield")
          await narrate(result.summary)
          playSting(result.win)
          if (lead) await playVoice(lead, result.win ? "victory" : "defeat")
          const hurt = youRef.current.champions.find((c) => youRef.current.warband.includes(c.id) && c.hp / c.maxHp < 0.35)
          if (hurt) await playVoice(hurt.id, "low")
          if (result.gold > 0) playSfx("coins")
        })()
      }
      return
    }
    const joined = champions.find((c) => text.startsWith(c.name) && text.includes("joins"))
    if (joined) {
      void playVoice(joined.id, "recruit")
      return
    }
    if (/draught|poultice|mends/i.test(text)) playSfx("drink")
    if (/longship|turns for/i.test(text)) playSfx("oars")
    if (/gold/i.test(text)) playSfx("coins")
    speak(text, true)
  }, [feed])

  useEffect(() => {
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min(0.4, (now - last) / 1000)
      last = now
      if (gpsRef.current || !sim.current.playing) return
      const roadCoords = navRef.current?.coords ?? (driveRoutes.find((r) => r.id === routeRef.current) ?? driveRoutes[0]).coordinates
      const len = routeLength(roadCoords)
      sim.current.distance += (sim.current.speed / 3.6) * dt * scaleRef.current * sim.current.dir
      if (sim.current.distance >= len - 25 || sim.current.distance <= 20) {
        sim.current.playing = false
        speedRef.current = 0
        setSpeed(0)
        setDrivingAudio(false)
        speak(navRef.current ? `You have arrived at ${navRef.current.label}.` : "The road ends. Say turn around, or pick another.", true)
        if (navRef.current) setNav(null)
        return
      }
      const p = pointAlong(roadCoords, sim.current.distance)
      const heading = sim.current.dir === 1 ? p.heading : (p.heading + 180) % 360
      const next = { lat: p.lat, lng: p.lng, heading }
      posRef.current = next
      speedRef.current = sim.current.speed
      setPos(next)
      setSpeed(sim.current.speed)
      setDrivingAudio(sim.current.speed > LOCK_KMH)
      guideRef.current(next, sim.current.speed)
      for (const town of worldRef.current.towns) {
        const dist = haversine(next, town)
        if (dist < 680 && !sim.current.stopped.has(town.id)) {
          sim.current.stopped.add(town.id)
          sim.current.playing = false
          speedRef.current = 0
          setSpeed(0)
          setDrivingAudio(false)
          setPos(next)
          const holder = town.ownerName ? `${town.ownerName} holds it.` : "It is unclaimed."
          const who = town.guardianName && town.guardianFree ? ` ${town.guardianName} is here.` : ""
          speak(`You are in ${town.name}. ${holder}${who}`, true)
          setSheet({ kind: "town", id: town.id })
        }
        if (dist > 1300) sim.current.stopped.delete(town.id)
      }
    }, 120)
    const ping = window.setInterval(() => {
      const p = posRef.current
      send({ t: "pos", lat: p.lat, lng: p.lng, heading: p.heading, speed: speedRef.current })
    }, 1000)
    return () => { window.clearInterval(id); window.clearInterval(ping) }
  }, [send])

  useEffect(() => {
    const asked = { at: 0, lat: 0, lng: 0 }
    const id = window.setInterval(() => {
      if (navRef.current || speedRef.current < 8) return
      const here = posRef.current
      if (Date.now() - asked.at < 20000) return
      if (asked.at && haversine(here, asked) < 180) return
      asked.at = Date.now()
      asked.lat = here.lat
      asked.lng = here.lng
      void fetch(`/api/road?lat=${here.lat}&lng=${here.lng}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((row: { limit?: number } | null) => {
          if (row && typeof row.limit === "number") setRoadLimit(row.limit)
        })
        .catch(() => {})
    }, 5000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!gps) return
    const watch = navigator.geolocation?.watchPosition((fix) => {
      const prev = posRef.current
      const heading = fix.coords.heading ?? bearingFrom(prev, { lat: fix.coords.latitude, lng: fix.coords.longitude })
      const kph = Math.max(0, (fix.coords.speed ?? 0) * 3.6)
      const next = { lat: fix.coords.latitude, lng: fix.coords.longitude, heading }
      posRef.current = next
      speedRef.current = kph
      setPos(next)
      setSpeed(kph)
      setDrivingAudio(kph > LOCK_KMH)
      guideRef.current(next, kph)
    }, () => speak("The phone lost the road.", true), { enableHighAccuracy: true, maximumAge: 2000 })
    return () => { if (watch != null) navigator.geolocation.clearWatch(watch) }
  }, [gps])

  function hold() {
    sim.current.playing = false
    speedRef.current = 0
    setSpeed(0)
    speak("Holding here.", true)
  }
  function ride() {
    if (gps) { speak("You are already on the real road.", true); return }
    for (const town of worldRef.current.towns) {
      if (haversine(posRef.current, town) < 900) sim.current.stopped.add(town.id)
    }
    const road = driveRoutes.find((r) => r.id === routeRef.current) ?? driveRoutes[0]
    const proj = projectRoute(road.coordinates, posRef.current.lat, posRef.current.lng)
    if (proj.off > 6000) { speak("That road does not reach your hall. Pick another.", true); return }
    sim.current.distance = proj.along
    sim.current.playing = true
    speedRef.current = sim.current.speed
    setSpeed(sim.current.speed)
    setFollow(true)
    setSheet(null)
    const next = { lat: proj.lat, lng: proj.lng, heading: proj.heading }
    posRef.current = next
    setPos(next)
    speak(`${road.name}. Ride on.`, true)
  }

  function launch(pendingHit: Pending, stance: Stance) {
    setPending(null)
    if (pendingHit.action === "attackPlayer") send({ t: "do", action: "attackPlayer", playerId: pendingHit.id, stance })
    else send({ t: "do", action: pendingHit.action, townId: pendingHit.id, stance })
  }

  function consider(next: Pending) {
    if (speedRef.current > LOCK_KMH && !passRef.current) launch(next, "smash")
    else setPending(next)
  }

  guideRef.current = (here, speedKmh) => {
    const plan = navRef.current
    const reports = worldRef.current.reports
    const proj = plan ? projectRoute(plan.coords, here.lat, here.lng) : null
    if (plan && proj) {
      if (proj.off > 140) {
        offRoute.current += 1
        if (offRoute.current === 10) {
          offRoute.current = 0
          void followNav(plan.label, plan.steps.at(-1)?.lat ?? here.lat, plan.steps.at(-1)?.lng ?? here.lng)
          speak("You left the road. Finding it again.", true)
        }
      } else offRoute.current = 0
      const next = plan.steps.find((s) => s.at > proj.along + 30)
      if (next) {
        const dist = next.at - proj.along
        if (dist < 800 && dist > 140 && !said.current.has(`${next.at}:far`)) {
          said.current.add(`${next.at}:far`)
          speak(`${next.say} In ${formatMeters(dist)}.`, true)
        }
        if (dist <= 70 && !said.current.has(`${next.at}:now`)) {
          said.current.add(`${next.at}:now`)
          speak(next.say, true)
        }
      }
      const on = [...plan.steps].reverse().find((s) => s.at <= proj.along + 10)
      const cap = on?.limit ?? 50
      if (speedKmh > cap + 8 && limitWarned.current !== `${on?.road}:${cap}`) {
        limitWarned.current = `${on?.road}:${cap}`
        speak(`The usual limit on this road is ${cap}. You are over.`, true)
      }
    } else {
      const cap = roadLimitRef.current
      if (cap && speedKmh > cap + 8 && limitWarned.current !== `road:${cap}`) {
        limitWarned.current = `road:${cap}`
        speak(`The usual limit on this road is ${cap}. You are over.`, true)
      }
    }
    for (const report of reports) {
      let dist = haversine(here, report)
      if (plan && proj) {
        const mark = projectRoute(plan.coords, report.lat, report.lng)
        const ahead = mark.along - proj.along
        if (mark.off > 70 || ahead < 40 || ahead > 900) continue
        dist = ahead
      } else {
        if (dist > 900 || dist < 40) continue
        const face = bearingFrom(here, report)
        let delta = Math.abs(face - here.heading) % 360
        if (delta > 180) delta = 360 - delta
        if (delta > 70) continue
      }
      if (said.current.has(report.id)) continue
      said.current.add(report.id)
      speak(reportSpeech(report.type, dist), true)
    }
  }

  async function beginNav(target: string) {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(target)}`)
    const places = (await res.json()) as { name: string; lat: number; lng: number }[]
    const place = places[0]
    if (!place) { speak(`I cannot find ${target}.`, true); return }
    await followNav(place.name, place.lat, place.lng)
  }

  async function followNav(label: string, lat: number, lng: number) {
    const here = posRef.current
    const res = await fetch(`/api/route?flat=${here.lat}&flng=${here.lng}&tlat=${lat}&tlng=${lng}&label=${encodeURIComponent(label)}`)
    if (!res.ok) { speak("The road-finder did not answer.", true); return }
    const plan = (await res.json()) as NavPlan
    said.current.clear()
    for (const town of worldRef.current.towns) {
      if (haversine(here, town) < 900) sim.current.stopped.add(town.id)
    }
    setNav(plan)
    const proj = projectRoute(plan.coords, here.lat, here.lng)
    sim.current.distance = proj.along
    sim.current.dir = 1
    speak(`${label}. ${formatMeters(plan.meters)}. About ${Math.max(1, Math.round(plan.seconds / 60))} minutes.`, true)
    if (!gpsRef.current) {
      sim.current.playing = true
      speedRef.current = sim.current.speed
      setSpeed(sim.current.speed)
      setFollow(true)
    }
  }

  const runRef = useRef<(cmd: VoiceCommand) => void>(() => {})
  runRef.current = (cmd) => {
    const me = youRef.current
    const map = worldRef.current
    const here = posRef.current
    if (cmd.type === "road") {
      send({ t: "do", action: "report", kind: cmd.kind })
      return
    }
    if (cmd.type === "confirm") {
      const nearestMark = [...map.reports].sort((a, b) => haversine(here, a) - haversine(here, b))[0]
      if (!nearestMark) { speak("No road mark is close.", true); return }
      send({ t: "do", action: "confirm", reportId: nearestMark.id, still: cmd.still })
      return
    }
    if (cmd.type === "navigate") {
      void beginNav(cmd.target)
      return
    }
    if (cmd.type === "wake") { speak("Valhalla listens.", true); return }
    if (cmd.type === "unknown") { speak("Say attack, recruit, claim town, status, heal, or raid.", true); return }
    if (cmd.type === "passenger") { setPassenger(cmd.on); speak(cmd.on ? "Passenger mode. The menus are open." : "Passenger mode off.", true); return }
    if (cmd.type === "hold") { hold(); return }
    if (cmd.type === "ride") { ride(); return }
    if (cmd.type === "turn") {
      sim.current.dir = sim.current.dir === 1 ? -1 : 1
      speak(sim.current.dir === 1 ? "Forward again." : "Turning the warband around.", true)
      return
    }
    if (cmd.type === "mute") { setMuted(true); setMusicMuted(true); return }
    if (cmd.type === "unmute") { setMuted(false); setMusicMuted(false); speak("The drums are back.", true); return }
    if (cmd.type === "center") { setFollow(true); return }
    if (cmd.type === "status") {
      const town = nearestTown(here, map.towns)
      const dist = town ? formatMeters(haversine(here, town)) : "nowhere"
      const marching = me.champions.filter((c) => me.warband.includes(c.id)).map((c) => c.name).join(", ")
      speak(`${me.name}, ${me.faction === "viking" ? "Nash clan" : "Grogs"}. ${me.gold} gold. ${me.np} Nash Points. Marching: ${marching || "no one"}. ${town ? `${town.name} is ${dist}. ${town.ownerName ? town.ownerName + " holds it." : "It is unclaimed."}` : ""} Towns held: ${me.townIds.length}.`, true)
      return
    }
    if (cmd.type === "warband") {
      const lines = me.champions.filter((c) => me.warband.includes(c.id)).map((c) => `${c.name}, level ${c.level}, ${c.hp} health`)
      speak(lines.join(". ") || "The hall is empty.", true)
      return
    }
    if (cmd.type === "shop" || cmd.type === "board") {
      if (speedRef.current > LOCK_KMH && !passRef.current) { speak("Pull over before you open that.", true); return }
      setSheet({ kind: cmd.type === "shop" ? "shop" : "saga" })
      return
    }
    if (cmd.type === "build") { send({ t: "do", action: "build", part: cmd.part }); return }
    if (cmd.type === "rest") { send({ t: "do", action: "rest" }); return }
    if (cmd.type === "heal") {
      const potion = me.inventory.map((s) => itemById(s.id)).filter((i) => i && i.kind === "potion").sort((a, b) => (b?.heal ?? 0) - (a?.heal ?? 0))[0]
      if (!potion) speak("No draughts in the satchel.", true)
      else send({ t: "do", action: "potion", itemId: potion.id })
      return
    }
    if (cmd.type === "recruit" || cmd.type === "claim") {
      const town = nearestTown(here, map.towns)
      if (!town) return
      const dist = haversine(here, town)
      if (dist > 1000) { speak(`${town.name} is ${formatMeters(dist)} off. Ride closer.`, true); return }
      if (cmd.type === "recruit") send({ t: "do", action: "recruit", townId: town.id })
      else if (town.ownerId && town.ownerId !== me.id) consider({ kind: "town", id: town.id, action: "attackTown" })
      else send({ t: "do", action: "claim", townId: town.id, stance: "smash" })
      return
    }
    if (cmd.type === "raid") {
      const town = cmd.target ? matchName(cmd.target, map.towns.filter((t) => t.shore)) : undefined
      send({ t: "do", action: "raid", townId: town?.id })
      return
    }
    if (cmd.type === "attack") {
      const hit = resolveAttack(cmd.target, here, map.towns, map.players, me.id)
      if (!hit) { speak("Nobody is close enough to fight.", true); return }
      if (cmd.stance && cmd.stance !== "smash") { launch({ ...hit, action: hit.kind === "player" ? "attackPlayer" : "attackTown" }, cmd.stance); return }
      consider({ kind: hit.kind, id: hit.id, action: hit.kind === "player" ? "attackPlayer" : hit.owner ? "attackTown" : "claim" })
    }
  }

  async function pushTalk() {
    setHot(true)
    const heard = await listenOnce()
    setHot(false)
    if (!heard) {
      speak(canListen() ? "Valhalla did not catch that." : "This browser cannot hear you. Use Passenger Mode, or pull over and tap.", true)
      return
    }
    setCaption(heard)
    const cmd = parseCommand(heard, false)
    if (!cmd || cmd.type === "unknown") speak(`I heard ${heard}. Say attack, claim, police, construction, or navigate to a town.`, true)
    else runRef.current(cmd)
  }

  const town = sheet?.kind === "town" ? world.towns.find((t) => t.id === sheet.id) : undefined
  const person = sheet?.kind === "hall" ? world.players.find((p) => p.id === sheet.id) : undefined
  const along = nav ? projectRoute(nav.coords, pos.lat, pos.lng) : null
  const limit = nav && along ? ([...nav.steps].reverse().find((s) => s.at <= along.along + 10)?.limit ?? 50) : roadLimit
  const nextTurn = nav && along ? nav.steps.find((s) => s.at > along.along + 30) : null
  const eta = nav && along ? Math.max(1, Math.round((nav.seconds * Math.max(0, 1 - along.along / Math.max(nav.meters, 1))) / 60)) : null
  const objective = !you.townIds.length
    ? `Claim ${nearest?.name ?? "the town you stand in"}.`
    : you.hall < 1
      ? "Raise the Great Hall."
      : you.champions.length < 2
        ? "Recruit a champion in the next village."
        : "Take a rival town, or raid the shore."

  return (
    <main className="game">
      <WarMap
        you={you}
        world={world}
        pos={pos}
        follow={follow}
        moving={speed > 5}
        route={nav?.coords ?? route.coordinates}
        river={riverRoute}
        locked={locked}
        onTown={(id) => setSheet({ kind: "town", id })}
        onHall={(id) => setSheet({ kind: "hall", id })}
        onReport={(id) => setSheet({ kind: "report", id })}
        onFree={() => setFollow(false)}
      />
      <div className="hud">
        <div className="topbar">
          <div className="top-row">
            <div className="who">
              <strong>{you.name}</strong>
              <span>{you.faction === "viking" ? "Nash clan" : "Grogs"} · {you.villageName}</span>
            </div>
            <div className="purse">
              <div><span>Gold</span><br /><b>{you.gold}</b></div>
              <div><span>NP</span><br /><b>{you.np}</b></div>
              <label className="fine">
                Volume
                <input className="volume" type="range" min={0} max={100} value={level} aria-label="Volume" onChange={(e) => { const n = Number(e.target.value); setLevel(n); setMusicLevel(n / 100); if (n === 0) { setMuted(true); setMusicMuted(true) } else if (muted) { setMuted(false); setMusicMuted(false) } }} />
              </label>
              <Button variant="ghost" size="icon" aria-label={muted ? "Unmute" : "Mute"} onClick={() => { const next = !muted; setMuted(next); setMusicMuted(next) }}>
                {muted ? <VolumeX /> : <Volume2 />}
              </Button>
            </div>
          </div>
          <div className="drive-row">
            <div className={`speed-block ${limit != null && speed > limit + 8 ? "over-limit" : ""}`}>
              <strong>{Math.round(speed)}</strong>
              <em>km/h{!gps && scale !== 1 ? ` · ${scale}×` : ""}{limit != null ? ` · usual ${limit}` : ""}</em>
            </div>
            <div className="next-town">
              {speed > 5 && ahead ? (
                <>
                  <b>{ahead.town.name}</b>
                  <span>{formatMeters(ahead.ahead)} · {ahead.town.ownerName ?? "unclaimed"}</span>
                </>
              ) : (
                <>
                  <b>{nearest ? nearest.name : route.name}</b>
                  <span>{nearest ? `${formatMeters(haversine(pos, nearest))} · ${objective}` : route.name}</span>
                </>
              )}
            </div>
          </div>
          {link !== "live" && <div className="banner link-down">Reconnecting to the saga.</div>}
          {nextTurn && (
            <div className="banner">
              <b>{nextTurn.say}</b>
              <span> · {formatMeters(Math.max(0, nextTurn.at - (along?.along ?? 0)))}{eta != null ? ` · ETA ${eta} min` : ""}{nav ? ` · ${nav.label}` : ""}</span>
            </div>
          )}
          {locked && <div className="banner">Hands on the wheel. Say Hey Valhalla. Passenger Mode opens the menus. Ontario does not allow a driver to hold this phone.</div>}
        </div>

        <div />

        <div className="bottom">
          {caption && <p className="caption" aria-live="polite">{caption}</p>}
          {!locked && nearest && haversine(pos, nearest) < 900 && sheet?.kind !== "town" && !battle && (
            <div className="arrival">
              <h2>{nearest.name}</h2>
              <p className="muted" style={{ marginTop: 0 }}>{nearest.ownerId === you.id ? "Yours." : nearest.ownerName ? `${nearest.ownerName} holds it.` : "Unclaimed."} {nearest.guardianName && nearest.guardianFree ? `${nearest.guardianName} can be recruited.` : ""}</p>
              <div className="row">
                <Button onClick={() => setSheet({ kind: "town", id: nearest.id })}>Enter</Button>
                {!follow && <Button variant="outline" onClick={() => setFollow(true)}>Recenter</Button>}
              </div>
            </div>
          )}
          <div className="voice-row">
            <button
              className={`voice ${hot ? "hot" : ""}`}
              aria-label="Hey Valhalla"
              onPointerDown={() => {
                const timer = window.setTimeout(() => { hold(); setHot(false) }, 550)
                const up = () => {
                  window.clearTimeout(timer)
                  window.removeEventListener("pointerup", up)
                  if (speedRef.current > 0 && !passRef.current) return
                }
                window.addEventListener("pointerup", up)
              }}
              onClick={() => { void pushTalk() }}
            >
              <small>Hey</small>
              <b>Valhalla</b>
            </button>
            <label className="pass-toggle">
              <Switch checked={passenger} onCheckedChange={setPassenger} aria-label="Passenger mode" />
              Passenger
            </label>
          </div>
          {!locked && (
            <>
            <Button onClick={() => setSheet({ kind: "report" })}>Mark the road</Button>
            <div className="dock">
              <button onClick={() => setSheet({ kind: "hall", id: you.id })}>Hall</button>
              <button onClick={() => setSheet({ kind: "warband" })}>Warband</button>
              <button onClick={() => setSheet({ kind: "roads" })}>Roads</button>
              <button onClick={() => setSheet({ kind: "saga" })}>Saga</button>
              <button onClick={() => setSheet({ kind: "shop" })}>Hoard</button>
            </div>
            </>
          )}
        </div>

        {!locked && sheet?.kind === "town" && town && (
          <TownPanel town={town} you={you} world={world} send={send} onClose={() => setSheet(null)} onStance={() => consider(town.ownerId && town.ownerId !== you.id ? { kind: "town", id: town.id, action: "attackTown" } : { kind: "town", id: town.id, action: "claim" })} />
        )}
        {!locked && sheet?.kind === "hall" && person && (
          <HallPanel person={person} you={you} world={world} send={send} onClose={() => setSheet(null)} onAttack={() => consider({ kind: "player", id: person.id, action: "attackPlayer" })} onLeave={person.id === you.id ? signOut : undefined} />
        )}
        {!locked && sheet?.kind === "warband" && <WarbandPanel you={you} send={send} onClose={() => setSheet(null)} />}
        {!locked && sheet?.kind === "shop" && <ShopPanel you={you} send={send} onClose={() => setSheet(null)} />}
        {!locked && sheet?.kind === "saga" && <SagaPanel world={world} onClose={() => setSheet(null)} />}
        {!locked && sheet?.kind === "roads" && (
          <RoadsPanel
            routeId={routeId}
            scale={scale}
            gps={gps}
            onClose={() => setSheet(null)}
            onRoute={(id) => { setRouteId(id); const road = driveRoutes.find((r) => r.id === id)!; const proj = projectRoute(road.coordinates, posRef.current.lat, posRef.current.lng); sim.current.distance = proj.along }}
            onScale={setScale}
            onGps={() => { setGps(true); sim.current.playing = false; speedRef.current = 0; setSpeed(0); speak("Listening for the real road.", true) }}
            onRide={() => { setGps(false); ride() }}
            query={query}
            hits={hits}
            onQuery={setQuery}
            onSearch={() => { void fetch(`/api/geocode?q=${encodeURIComponent(query)}`).then((r) => r.json()).then((rows) => setHits(rows as { name: string; lat: number; lng: number }[])) }}
            onPick={(hit) => { setSheet(null); void followNav(hit.name, hit.lat, hit.lng) }}
          />
        )}
        {!locked && sheet?.kind === "report" && !sheet.id && (
          <Sheet title="Mark the road" onClose={() => setSheet(null)}>
            <p className="fine">The real meaning is always on the label. The theme is how the warband sees it. Other drivers can say still there, or not there.</p>
            <div className="grid-2">
              {REPORT_TYPES.map((kind) => (
                <Button key={kind} variant="outline" onClick={() => { send({ t: "do", action: "report", kind }); setSheet(null) }}>{REPORT_INFO[kind].label}</Button>
              ))}
            </div>
          </Sheet>
        )}
        {!locked && sheet?.kind === "report" && sheet.id && (
          <Sheet title="A mark on the road" onClose={() => setSheet(null)}>
            {(() => {
              const mark = world.reports.find((r) => r.id === sheet.id)
              const info = mark ? REPORT_INFO[mark.type] : null
              return <p>{info ? `${info.label}. ${info.theme}.` : "That mark has faded."} {mark ? `Marked by ${mark.reporterName}.` : ""}</p>
            })()}
            <div className="row">
              <Button onClick={() => send({ t: "do", action: "confirm", reportId: sheet.id, still: true })}>Still there</Button>
              <Button variant="outline" onClick={() => send({ t: "do", action: "confirm", reportId: sheet.id, still: false })}>Not there</Button>
            </div>
          </Sheet>
        )}
      </div>

      {battle && <BattleView battle={battle} onClose={() => {
        const done = battle
        setBattle(undefined)
        playSting(done.win)
        const lead = you.warband[0]
        if (lead) void playVoice(lead, done.win ? "victory" : "defeat")
        if (done.gold > 0) playSfx("coins")
      }} />}

      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogTitle>How do you meet them?</DialogTitle>
          <DialogDescription>On the road this chooses itself. Parked, you can pick.</DialogDescription>
          <div className="grid-2" style={{ marginTop: 12 }}>
            <Button onClick={() => pending && launch(pending, "smash")}>Smash</Button>
            <Button variant="outline" onClick={() => pending && launch(pending, "guard")}>Guard</Button>
            <Button variant="outline" onClick={() => pending && launch(pending, "volley")}>Volley</Button>
            <Button variant="secondary" onClick={() => pending && launch(pending, "heal")}>Drink, then fight</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function nearestTown(pos: { lat: number; lng: number }, towns: PublicTown[]) {
  return [...towns].sort((a, b) => haversine(pos, a) - haversine(pos, b))[0]
}

function nextAhead(coords: [number, number][], distance: number, dir: 1 | -1, towns: PublicTown[]) {
  let best: { town: PublicTown; ahead: number } | null = null
  for (const town of towns) {
    const proj = projectRoute(coords, town.lat, town.lng)
    if (proj.off > 1600) continue
    const ahead = dir === 1 ? proj.along - distance : distance - proj.along
    if (ahead < 200) continue
    if (!best || ahead < best.ahead) best = { town, ahead }
  }
  return best
}

function resolveAttack(target: string | undefined, here: { lat: number; lng: number }, towns: PublicTown[], players: PublicPlayer[], self: string) {
  if (target) {
    const town = matchName(target, towns)
    if (town) return { kind: "town" as const, id: town.id, owner: town.ownerId }
    const rival = matchName(target, players.filter((p) => p.id !== self))
    if (rival) return { kind: "player" as const, id: rival.id, owner: rival.id }
  }
  const town = nearestTown(here, towns)
  if (town && haversine(here, town) < 1300) return { kind: "town" as const, id: town.id, owner: town.ownerId }
  const halls = players.filter((p) => p.id !== self).map((p) => ({ p, dist: haversine(here, { lat: p.homeLat, lng: p.homeLng }) })).sort((a, b) => a.dist - b.dist)
  if (halls[0] && halls[0].dist < 1300) return { kind: "player" as const, id: halls[0].p.id, owner: halls[0].p.id }
  return null
}

function bearingFrom(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const y = Math.sin(((b.lng - a.lng) * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180)
  const x = Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) - Math.sin((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.cos(((b.lng - a.lng) * Math.PI) / 180)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
