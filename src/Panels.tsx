import { useEffect, useState, type ReactNode } from "react"
import { playSfx } from "@/audio"
import { Art, asset } from "@/art"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { BUILDINGS, OFFERS, PASS_TIERS, TOWN_POWER, itemById, itemPrice, items, monthlyShop } from "@/shared/catalog.ts"
import { driveRoutes } from "@/shared/routes.ts"
import { formatMeters, haversine } from "@/shared/geo.ts"
import type { BattleResult, BuildingId, PrivateYou, PublicPlayer, PublicTown, PublicWorld, Stance } from "@/shared/types.ts"

type Send = (msg: unknown) => void

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <section className="sheet" role="dialog" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </header>
      <div className="sheet-body">{children}</div>
    </section>
  )
}

export function TownPanel({ town, you, world, send, onClose, onStance }: {
  town: PublicTown
  you: PrivateYou
  world: PublicWorld
  send: Send
  onClose: () => void
  onStance: (stance: Stance) => void
}) {
  const dist = haversine(you, town)
  const mine = town.ownerId === you.id
  const held = !!town.ownerId && !mine
  const same = town.guardianFaction === you.faction && town.guardianFree
  return (
    <Sheet title={town.name} onClose={onClose}>
      <div className="champ-row">
        {town.guardianArt && <Art file={town.guardianArt} alt={town.guardianName ?? ""} />}
        <div>
          <p className="muted" style={{ margin: 0 }}>{town.blurb}</p>
          <p style={{ margin: "6px 0 0" }}>{mine ? "You hold it." : held ? `Held by ${town.ownerName}.` : "Unclaimed."} {formatMeters(dist)} from you.</p>
          {town.shore && <p className="muted">On the Seaway. A longship can raid this shore.</p>}
        </div>
      </div>
      <div className="row">
        {!held && !mine && <Button onClick={() => onStance("smash")}>Claim</Button>}
        {held && <Button variant="destructive" onClick={() => onStance("smash")}>Attack</Button>}
        {mine && <Button onClick={() => send({ t: "do", action: "tribute", townId: town.id })}>Take tribute</Button>}
        {same && <Button variant="secondary" onClick={() => send({ t: "do", action: "recruit", townId: town.id })}>Recruit {town.guardianName?.split(" ")[0]}</Button>}
        {mine && <Button variant="outline" onClick={() => send({ t: "do", action: "rest" })}>Rest</Button>}
      </div>
      <p className="fine">Worth about {TOWN_POWER[town.kind].wealth} gold. Say “claim town”, “attack”, or “recruit”.</p>
      <p className="fine">{world.saga[0]?.text}</p>
    </Sheet>
  )
}

export function HallPanel({ person, you, world, send, onClose, onAttack, onLeave }: {
  person: PublicPlayer
  you: PrivateYou
  world: PublicWorld
  send: Send
  onClose: () => void
  onAttack: () => void
  onLeave?: () => void
}) {
  if (person.id !== you.id) {
    const dist = haversine({ lat: you.lat, lng: you.lng }, { lat: person.homeLat, lng: person.homeLng })
    return (
      <Sheet title={person.villageName} onClose={onClose}>
        <p style={{ margin: 0 }}>{person.name} {person.isAI ? "keeps a rival hall" : person.online ? "is on the road" : "is away"}.</p>
        <p className="muted">{person.townCount} towns · {person.wins} wins · {person.raids} raids · {formatMeters(dist)}</p>
        <p className="muted">Hall {person.hall} · Forge {person.forge} · Walls {person.walls} · Dock {person.dock}</p>
        {!person.isAI && <Button variant="destructive" onClick={onAttack}>Attack the hall</Button>}
        {person.isAI && <Button variant="destructive" onClick={onAttack}>Attack {person.name}</Button>}
      </Sheet>
    )
  }
  let income = you.hall * 4
  for (const id of you.townIds) {
    const town = world.towns.find((t) => t.id === id)
    if (town) income += TOWN_POWER[town.kind].income
  }
  if (you.sub) income = Math.round(income * 1.25)
  return (
    <Sheet title={you.villageName} onClose={onClose}>
      <p className="muted" style={{ margin: 0 }}>About {income} gold every half minute. Warband cap {you.warbandCap}. Recovery word: <b className="gold">{you.recovery}</b></p>
      {onLeave && <Button variant="ghost" onClick={onLeave}>Leave this name</Button>}
      {(Object.keys(BUILDINGS) as BuildingId[]).map((part) => {
        const def = BUILDINGS[part]
        const level = you[part]
        const cost = def.costs[level]
        return (
          <article key={part} className="card">
            <h3>{def.name}</h3>
            <div className="pips" aria-label={`Level ${level}`}>{[0, 1, 2].map((i) => <i key={i} className={i < level ? "on" : ""} />)}</div>
            <p className="muted">{def.text}</p>
            {level < 3 ? (
              <Button size="sm" onClick={() => send({ t: "do", action: "build", part })}>Raise to {level + 1} · {cost} gold</Button>
            ) : <p className="gold">Finished.</p>}
          </article>
        )
      })}
    </Sheet>
  )
}

export function WarbandPanel({ you, send, onClose }: { you: PrivateYou; send: Send; onClose: () => void }) {
  const weapons = you.inventory.filter((s) => itemById(s.id)?.kind === "weapon")
  const skins = you.inventory.filter((s) => itemById(s.id)?.kind === "skin")
  const ships = you.inventory.filter((s) => itemById(s.id)?.kind === "longship")
  function toggle(id: string) {
    const has = you.warband.includes(id)
    const ids = has ? you.warband.filter((x) => x !== id) : [...you.warband, id]
    send({ t: "do", action: "warband", ids })
  }
  return (
    <Sheet title="Warband" onClose={onClose}>
      <p className="muted" style={{ margin: 0 }}>Marching {you.warband.length} of {you.warbandCap}. Raise the hall to take more.</p>
      {you.champions.map((c) => (
        <article key={c.id} className="card champ-row">
          <Art file={c.art} alt="" />
          <div>
            <h3>{c.name}</h3>
            <p className="muted" style={{ margin: 0 }}>{c.title} · level {c.level} · {c.ability}</p>
            <p className="fine">{c.abilityText}</p>
            <div className="hp" aria-label={`${c.hp} of ${c.maxHp} health`}><span style={{ width: `${Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100))}%` }} /></div>
            <p className="fine">Attack {c.attack} · Defense {c.defense} · {c.hp}/{c.maxHp}</p>
            <div className="row">
              <Button size="sm" variant={you.warband.includes(c.id) ? "default" : "outline"} onClick={() => toggle(c.id)}>
                {you.warband.includes(c.id) ? "Marching" : "In the hall"}
              </Button>
            </div>
            <select className="arm" value={c.weaponId ?? ""} onChange={(e) => send({ t: "do", action: "equip", championId: c.id, itemId: e.target.value || null })}>
              <option value="">Bare hands</option>
              {weapons.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        </article>
      ))}
      {skins.length > 0 && (
        <label className="stack">Wear a skin
          <select className="arm" value={you.skinId ?? ""} onChange={(e) => send({ t: "do", action: "equip", itemId: e.target.value })}>
            <option value="">Clan cloth</option>
            {skins.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      {ships.length > 0 && (
        <label className="stack">Your longship
          <select className="arm" value={you.shipId ?? ""} onChange={(e) => send({ t: "do", action: "equip", itemId: e.target.value })}>
            <option value="">Yard ship</option>
            {ships.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
    </Sheet>
  )
}

export function ShopPanel({ you, send, onClose }: { you: PrivateYou; send: Send; onClose: () => void }) {
  const shop = monthlyShop()
  const [tab, setTab] = useState<"moon" | "armory" | "points">("moon")
  const [sku, setSku] = useState<string | null>(null)
  const offer = OFFERS.find((o) => o.sku === sku)
  const item = sku ? itemById(sku) : undefined
  const price = item ? itemPrice(item.id) : 0
  const featured = shop.ids.map((id) => itemById(id)).filter((x): x is NonNullable<typeof x> => !!x)
  const list = tab === "moon" ? [...featured, ...items.filter((i) => i.kind === "potion")] : items
  return (
    <Sheet title="The hoard" onClose={onClose}>
      <div className="demo-flag">Demo hoard. Nothing is charged. In the App Store build, Nash Points and the oath go through Apple. Prices below are the real shelf: 800 NP $8.99, 2,400 NP $22.99, 4,500 NP $36.99, 12,500 NP $89.99. The oath is free for a month, then $10 a month or $120 a year.</div>
      <p className="fine">You hold {you.np} Nash Points. Moon of {shop.label}. Next rotation {shop.nextLabel}. Featured pieces are 20% off.</p>
      <div className="tabs">
        <Button size="sm" variant={tab === "moon" ? "default" : "outline"} onClick={() => setTab("moon")}>This moon</Button>
        <Button size="sm" variant={tab === "armory" ? "default" : "outline"} onClick={() => setTab("armory")}>Armory</Button>
        <Button size="sm" variant={tab === "points" ? "default" : "outline"} onClick={() => setTab("points")}>Nash Points</Button>
      </div>
      {tab !== "points" && list.map((it) => {
        const cost = itemPrice(it.id)
        const owned = you.inventory.find((s) => s.id === it.id)?.qty ?? 0
        const deal = shop.ids.includes(it.id)
        return (
          <article key={it.id} className="card item-card">
            <Art file={it.art} alt="" />
            <div>
              <h3>{it.name}</h3>
              <p className="muted" style={{ margin: 0 }}>{it.rarity} · {it.kind}{deal ? " · this moon" : ""}{owned ? ` · owned ${owned}` : ""}</p>
              <p className="fine">{it.blurb}</p>
              <Button size="sm" onClick={() => setSku(it.id)}>{cost} NP{deal ? ` (was ${it.price})` : ""}</Button>
            </div>
          </article>
        )
      })}
      {tab === "points" && (
        <>
          <article className="card">
            <h3>Seaway Battle Pass · 800 NP</h3>
            <p className="fine">Free track pays gold. The pass adds weapons, draughts, and a cloak. Tier {you.freeTier} of {PASS_TIERS.length}. {you.pass ? "Pass owned." : "Pass locked."} Season {you.seasonXp} xp.</p>
            <div className="pips">{PASS_TIERS.map((tier, i) => <i key={tier.xp} className={i < you.freeTier ? "on" : ""} />)}</div>
            {!you.pass && <Button onClick={() => setSku("battle-pass")}>Unlock pass · demo</Button>}
          </article>
          {OFFERS.filter((o) => o.kind === "pack" || o.kind === "sub").map((o) => (
            <article key={o.sku} className="card">
              <h3>{o.name}</h3>
              <p className="fine">{o.blurb}</p>
              <Button size="sm" variant="secondary" onClick={() => setSku(o.sku)}>{o.kind === "pack" ? `Demo $${o.usd.toFixed(2)}` : o.usd ? `Demo $${o.usd}` : "Start free month"}</Button>
            </article>
          ))}
        </>
      )}
      <Dialog open={!!sku} onOpenChange={(open) => !open && setSku(null)}>
        <DialogContent>
          <DialogTitle>Demo purchase</DialogTitle>
          <DialogDescription>
            {item && `${item.name} for ${price} Nash Points. `}
            {offer?.kind === "pack" && `${offer.name}. The shelf price is $${offer.usd.toFixed(2)} US. `}
            {offer?.kind === "pass" && "Seaway Battle Pass for 800 Nash Points. "}
            {offer?.kind === "sub" && `${offer.blurb} `}
            Nothing is charged. This is not a real payment.
          </DialogDescription>
          <div className="row" style={{ marginTop: 12 }}>
            <Button onClick={() => { if (sku) send({ t: "do", action: "buy", sku }); setSku(null) }}>Add it</Button>
            <Button variant="outline" onClick={() => setSku(null)}>Back</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}

export function SagaPanel({ world, onClose }: { world: PublicWorld; onClose: () => void }) {
  const total = world.board.clans.viking + world.board.clans.grog || 1
  const [tab, setTab] = useState<"war" | "towns" | "gold" | "raids" | "scouts" | "log">("war")
  return (
    <Sheet title="The saga" onClose={onClose}>
      <div className="clan-bar">
        <span>Vikings {world.board.clans.viking}</span>
        <span>Grogs {world.board.clans.grog}</span>
        <div className="track"><span style={{ width: `${(world.board.clans.viking / total) * 100}%` }} /></div>
      </div>
      <p className="fine">Seers warn the road. Each warning is a real thing — police, a jam, ice — told as the warband sees it. Those warnings add to the clan's hold on the map.</p>
      <div className="tabs">
        <Button size="sm" variant={tab === "war" ? "default" : "outline"} onClick={() => setTab("war")}>Warriors</Button>
        <Button size="sm" variant={tab === "towns" ? "default" : "outline"} onClick={() => setTab("towns")}>Towns</Button>
        <Button size="sm" variant={tab === "gold" ? "default" : "outline"} onClick={() => setTab("gold")}>Richest</Button>
        <Button size="sm" variant={tab === "raids" ? "default" : "outline"} onClick={() => setTab("raids")}>Raids</Button>
        <Button size="sm" variant={tab === "scouts" ? "default" : "outline"} onClick={() => setTab("scouts")}>Seers</Button>
        <Button size="sm" variant={tab === "log" ? "default" : "outline"} onClick={() => setTab("log")}>Log</Button>
      </div>
      {tab === "war" && world.board.warriors.map((r) => <p key={r.name} style={{ margin: 0 }}>{r.name} · {r.wins} wins · {r.faction}</p>)}
      {tab === "towns" && world.board.towns.map((r) => <p key={r.name} style={{ margin: 0 }}>{r.name} · {r.count} towns</p>)}
      {tab === "gold" && world.board.richest.map((r) => <p key={r.name} style={{ margin: 0 }}>{r.name} · {r.worth} worth</p>)}
      {tab === "raids" && world.board.raids.map((r) => <p key={r.name} style={{ margin: 0 }}>{r.name} · {r.raids} raids</p>)}
      {tab === "scouts" && world.board.scouts.map((r) => <p key={r.name} style={{ margin: 0 }}>{r.name} · {r.scouts} warnings on the real road · {r.faction}</p>)}
      {tab === "log" && world.saga.map((s) => <p key={s.id} className="fine">{s.text}</p>)}
    </Sheet>
  )
}

export function RoadsPanel({
  routeId, scale, gps, onClose, onRoute, onScale, onGps, onRide, query, hits, onQuery, onSearch, onPick,
}: {
  routeId: string
  scale: number
  gps: boolean
  onClose: () => void
  onRoute: (id: string) => void
  onScale: (n: number) => void
  onGps: () => void
  onRide: () => void
  query: string
  hits: { name: string; lat: number; lng: number }[]
  onQuery: (q: string) => void
  onSearch: () => void
  onPick: (hit: { name: string; lat: number; lng: number }) => void
}) {
  return (
    <Sheet title="Roads" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); onSearch() }}>
        <label className="fine">Search a destination. Turn-by-turn uses the real road.</label>
        <input className="name-field" style={{ width: "100%" }} value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Ottawa, Winchester, a street…" />
        <Button type="submit" size="sm">Find the road</Button>
      </form>
      {hits.map((hit) => (
        <button key={`${hit.lat},${hit.lng}`} className="card" style={{ textAlign: "left" }} onClick={() => onPick(hit)}>
          <h3>{hit.name}</h3>
        </button>
      ))}
      <p className="fine">Saga drive follows real roads through Stormont, Dundas, Glengarry, and Ottawa. The clock runs faster than the speedometer so a desk can reach the next town.</p>
      {driveRoutes.map((r) => (
        <button key={r.id} className="card" onClick={() => onRoute(r.id)} style={{ textAlign: "left" }}>
          <h3>{r.name} {routeId === r.id ? "· on this road" : ""}</h3>
          <p className="muted" style={{ margin: 0 }}>{r.blurb} {r.km} km.</p>
        </button>
      ))}
      <div className="row">
        {[4, 10, 24].map((n) => (
          <Button key={n} size="sm" variant={scale === n ? "default" : "outline"} onClick={() => onScale(n)}>{n}× saga time</Button>
        ))}
      </div>
      <div className="row">
        <Button onClick={onRide}>Ride this road</Button>
        <Button variant="secondary" onClick={onGps}>{gps ? "GPS is live" : "Use this phone's GPS"}</Button>
      </div>
    </Sheet>
  )
}

export function BattleView({ battle, onClose }: { battle: BattleResult; onClose: () => void }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (step > 0) playSfx(step % 3 === 0 ? "shield" : step % 2 === 0 ? "axe" : "clash")
    if (step >= battle.rounds.length - 1) return
    const t = window.setTimeout(() => setStep((s) => s + 1), 1100)
    return () => window.clearTimeout(t)
  }, [step, battle])
  const round = battle.rounds[Math.min(step, battle.rounds.length - 1)]
  const done = step >= battle.rounds.length - 1
  const left = battleScene(battle.attackerFaction, "left")
  const right = battleScene(battle.defenderFaction, "right")
  return (
    <section className="battle">
      <div className="battle-bg" aria-hidden="true">
        <img src={asset(left)} alt="" />
        <img src={asset(right)} alt="" />
      </div>
      <p className="eyebrow">{battle.win ? "Victory" : "Thrown back"} · {battle.kind}</p>
      <h2>{battle.townName ?? battle.defenderName}</h2>
      <div className="lines">
        <div>
          <p className="gold">{battle.attackerName}</p>
          <div className="hp"><span style={{ width: `${bar(round?.atkHp ?? battle.atkMax, battle.atkMax)}%` }} /></div>
          {battle.attackerChamps.map((c) => (
            <article key={c.id} className="champ-row" style={{ marginTop: 8 }}>
              <Art file={c.art} alt="" />
              <div><strong>{c.name}</strong><div className="hp"><span style={{ width: `${bar(round?.atkHp ?? c.hp, battle.atkMax)}%` }} /></div></div>
            </article>
          ))}
        </div>
        <div>
          <p>{battle.defenderName}</p>
          <div className="hp"><span style={{ width: `${bar(round?.defHp ?? battle.defMax, battle.defMax)}%` }} /></div>
          {battle.defenderChamps.map((c) => (
            <article key={c.id} className="champ-row" style={{ marginTop: 8 }}>
              <Art file={c.art} alt="" />
              <div><strong>{c.name}</strong></div>
            </article>
          ))}
        </div>
      </div>
      <p className="log">{round?.text}</p>
      <div className="row">
        {!done && <Button onClick={() => setStep((s) => s + 1)}>Next blow</Button>}
        {done && <Button onClick={onClose}>Back to the road</Button>}
        <Button variant="ghost" onClick={() => setStep(battle.rounds.length - 1)}>Skip to the end</Button>
      </div>
      {done && <p className="fine">{battle.summary}</p>}
    </section>
  )
}

function battleScene(faction: string, side: "left" | "right") {
  if (faction === "viking") return "scenes/wolves.jpg"
  if (faction === "grog") return side === "left" ? "scenes/orc-braids.jpg" : "scenes/orc-brute.webp"
  return side === "left" ? "scenes/orc-forest.jpg" : "scenes/orc-horned.webp"
}

function bar(hp: number, max: number) {
  if (!max) return 0
  return Math.max(0, Math.min(100, (hp / max) * 100))
}
