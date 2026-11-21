import { useState } from "react"
import { Art, asset } from "@/art"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { START_TOWNS, townById } from "@/shared/catalog.ts"
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
  const [gpsSpot, setGpsSpot] = useState<{ lat: number; lng: number } | null>(null)
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
        <p className="lede">The real road is the warboard. Drive the towns. Meet the other warbands.</p>
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

        {phase === "faction" && (
          <div>
            <p className="fine">Where is your hall?</p>
            <div className="starts">
              {START_TOWNS.map((id) => (
                <Button key={id} type="button" size="sm" variant={start === id ? "default" : "outline"} onClick={() => setStart(id)}>
                  {townById(id)?.name}
                </Button>
              ))}
              <Button type="button" size="sm" variant={gpsSpot ? "default" : "secondary"} onClick={() => {
                unlock()
                if (!navigator.geolocation) { setNote("This phone will not share a location. Pick a town."); return }
                navigator.geolocation.getCurrentPosition((pos) => {
                  setGpsSpot({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                  setNote("Location locked. Now swear to a clan. The hall goes where you are, if you are in the Seaway.")
                }, () => setNote("No location yet. Pick Chesterville, Morrisburg, or Cornwall."), { enableHighAccuracy: true, timeout: 8000 })
              }}>{gpsSpot ? "Using this phone" : "Use this phone's location"}</Button>
            </div>
            <div className="faction-grid">
              <button className="faction-card" onClick={() => { unlock(); send(gpsSpot ? { t: "choose", faction: "viking", ...gpsSpot } : { t: "choose", faction: "viking", startTownId: start }) }}>
                <img className="bg" src={asset("scenes/wolves.jpg")} alt="" />
                <Art className="face" file="champions/ryan.jpg" alt="Ryan Nash" />
                <div>
                  <h2>Nash clan</h2>
                  <p>Sixteen champions, from Ralph's great axe to Emma's spear. You start with Ryan Nash, warlord, axe and shield. A field poultice is in the satchel.</p>
                </div>
              </button>
              <button className="faction-card" onClick={() => { unlock(); send(gpsSpot ? { t: "choose", faction: "grog", ...gpsSpot } : { t: "choose", faction: "grog", startTownId: start }) }}>
                <div className="grog-mosaic" aria-hidden="true">
                  <img src={asset("scenes/orc-braids.jpg")} alt="" />
                  <img src={asset("scenes/orc-forest.jpg")} alt="" />
                  <img src={asset("scenes/orc-horned.webp")} alt="" />
                  <img src={asset("scenes/orc-brute.webp")} alt="" />
                </div>
                <Art className="face" file="champions/gorgrath.jpg" alt="Gorgrath Skullsplitter" />
                <div>
                  <h2>The Grogs</h2>
                  <p>Gorgrath Skullsplitter leads. Mog'Dura binds bone, and Urzog the Mountain still waits at Long Sault. You start with the warchief.</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
