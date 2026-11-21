import { useState } from "react"
import { Art, asset } from "@/art"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { START_TOWNS, townById } from "@/shared/catalog.ts"
import type { Faction } from "@/shared/types.ts"
import { apiUrl } from "@/native.ts"
import { useSession } from "@/session"
import { unlockMusic } from "@/audio"
import { unlockSpeech } from "@/speech"

export function Gates() {
  const { phase, link, send, feed } = useSession()
  const [name, setName] = useState("")
  const [recovery, setRecovery] = useState("")
  const [returning, setReturning] = useState(false)
  const [start, setStart] = useState<(typeof START_TOWNS)[number]>("chesterville")
  const [note, setNote] = useState("")
  const [clan, setClan] = useState<Faction | null>(null)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<{ id?: string; name: string; lat: number; lng: number }[]>([])
  const [home, setHome] = useState<{ id?: string; name: string; lat: number; lng: number } | null>(null)
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const installed = window.matchMedia("(display-mode: standalone)").matches

  function unlock() {
    unlockSpeech()
    unlockMusic()
  }

  if (phase === "boot") {
    return (
      <main className="gate loading">
        <img className="scene" src={asset("scenes/wolves.jpg")} alt="" />
        <div className="scrim" />
        <div className="gate-copy">
          <p className="eyebrow">Chesterville, Ontario</p>
          <h1><span>Nash's</span><span>Viking</span><span>Chronicles</span></h1>
          <p className="lede">The horns are sounding.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="gate">
      <img className="scene" src={asset(phase === "faction" ? "scenes/orc-forest.jpg" : "scenes/wolves.jpg")} alt="" />
      <div className="scrim" />
      <div className="gate-copy">
        <p className="eyebrow">Chesterville, Ontario</p>
        <h1><span>Nash's</span><span>Viking</span><span>Chronicles</span></h1>
        <p className="lede">The real road is the warboard. Found a hall in your town, anywhere in Canada or the United States. Drive when you want the road to pay double.</p>
        <p className="fine">Designed by Ryan Nash. You lead a warband. The Nash clan and the Grogs are the champions you find on the road.</p>
        <p className="warn">Ontario law: a driver cannot hold a phone. Above 10 km/h the menus lock. Say “Hey Valhalla”, or hand the phone to a passenger.</p>
        {!window.isSecureContext && <p className="warn">Open the https address. A phone will not share its location or microphone on a plain http link.</p>}
        {ios && !installed && <p className="fine">On iPhone: Share, then Add to Home Screen. The game stays on the phone.</p>}
        {link === "down" && <p className="warn">The saga line dropped. Reconnecting.</p>}
        {(note || feed.error) && phase !== "play" && <p className="warn">{note || feed.error}</p>}

        {phase === "name" && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); unlock(); send({ t: "join", name, recovery: returning ? recovery : undefined }) }}>
            <label className="stack">
              <span className="fine">Your name on the saga</span>
              <Input className="name-field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" maxLength={18} required placeholder="Sam" />
            </label>
            {returning && (
              <label className="stack">
                <span className="fine">Recovery word from your hall</span>
                <Input className="name-field" value={recovery} onChange={(e) => setRecovery(e.target.value)} autoComplete="off" placeholder="FJORD-RAVEN-42" />
              </label>
            )}
            <div className="row">
              <Button type="submit" size="lg" disabled={link !== "live"}>Take the road</Button>
              <Button type="button" variant="ghost" onClick={() => setReturning((v) => !v)}>{returning ? "New warrior" : "I have a recovery word"}</Button>
            </div>
          </form>
        )}

        {phase === "faction" && !clan && (
          <div>
            <p className="fine">Swear first. Then the game finds your town.</p>
            <div className="faction-grid">
              <button className="faction-card" onClick={() => { unlock(); setClan("viking") }}>
                <img className="bg" src={asset("scenes/wolves.jpg")} alt="" />
                <Art className="face" file="champions/ryan.jpg" alt="Ryan Nash" />
                <div>
                  <h2>Nash clan</h2>
                  <p>You start with Ryan Nash, a longhouse, and a few huscarls. The rest of the clan is out in the towns.</p>
                </div>
              </button>
              <button className="faction-card" onClick={() => { unlock(); setClan("grog") }}>
                <div className="grog-mosaic" aria-hidden="true">
                  <img src={asset("scenes/orc-braids.jpg")} alt="" />
                  <img src={asset("scenes/orc-forest.jpg")} alt="" />
                  <img src={asset("scenes/orc-horned.webp")} alt="" />
                  <img src={asset("scenes/orc-brute.webp")} alt="" />
                </div>
                <Art className="face" file="champions/gorgrath.jpg" alt="Gorgrath Skullsplitter" />
                <div>
                  <h2>The Grogs</h2>
                  <p>Gorgrath Skullsplitter starts the camp with a mob of boyz. The other Grogs wait in their towns.</p>
                </div>
              </button>
            </div>
          </div>
        )}
        {phase === "faction" && clan && (
          <form className="stack" onSubmit={(e) => {
            e.preventDefault()
            void fetch(apiUrl(`/api/geocode?q=${encodeURIComponent(query)}`)).then((r) => r.json()).then((rows) => setHits(rows as { id?: string; name: string; lat: number; lng: number }[]))
          }}>
            <p className="fine">Where is your hall? Use this phone, or search any city, town, or village in Canada or the United States.</p>
            <div className="starts">
              {START_TOWNS.map((id) => (
                <Button key={id} type="button" size="sm" variant={start === id && !home ? "default" : "outline"} onClick={() => { setStart(id); setHome(null) }}>
                  {townById(id)?.name}
                </Button>
              ))}
              <Button type="button" size="sm" variant="secondary" onClick={() => {
                unlock()
                if (!navigator.geolocation) { setNote("This phone will not share a location. Search for your town."); return }
                navigator.geolocation.getCurrentPosition(async (pos) => {
                  const res = await fetch(apiUrl(`/api/nearest?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`))
                  const place = await res.json() as { id?: string; name?: string; lat?: number; lng?: number } | null
                  if (!place?.name || place.lat == null || place.lng == null) { setNote("No town in Canada or the United States is close. Search for yours."); return }
                  setHome({ id: place.id, name: place.name, lat: place.lat, lng: place.lng })
                  setNote(`The phone found ${place.name}.`)
                }, () => setNote("Location is off. Search for your town. Chesterville is the saga's home if you want it."), { enableHighAccuracy: true, timeout: 8000 })
              }}>Use this phone's location</Button>
            </div>
            <label className="stack">
              <span className="fine">Search a town</span>
              <Input className="name-field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Vancouver, Dallas, Lubec, Chesterville…" />
            </label>
            <Button type="submit" size="sm" variant="outline">Find it</Button>
            {hits.map((hit) => (
              <button type="button" key={`${hit.id ?? hit.name}:${hit.lat}`} className="card" onClick={() => { setHome(hit); setNote(hit.name) }}>
                <h3>{hit.name}</h3>
              </button>
            ))}
            <Button type="button" size="lg" onClick={() => {
              unlock()
              const invite = sessionStorage.getItem("nvc-invite") ?? undefined
              if (home?.id) send({ t: "choose", faction: clan, placeId: home.id, invite })
              else if (home) send({ t: "choose", faction: clan, lat: home.lat, lng: home.lng, invite })
              else send({ t: "choose", faction: clan, startTownId: start, invite })
            }}>{home ? `Found the hall in ${home.name.split(",")[0]}` : `Found the hall in ${townById(start)?.name ?? "Chesterville"}`}</Button>
          </form>
        )}
      </div>
    </main>
  )
}
