import { useEffect, useState, type ReactNode } from "react"
import { playSfx } from "@/audio"
import { Art, asset } from "@/art"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { RECIPES, UNIT_INFO, UNIT_ORDER, championClass, companyUnlock, unitName, unitStats } from "@/shared/army.ts"
import { BUILDINGS, OFFERS, PASS_TIERS, TOWN_POWER, champions, itemById, itemPrice, items, monthlyShop } from "@/shared/catalog.ts"
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

export function TownPanel({ town, you, world, send, onClose, onStance, near }: {
  town: PublicTown
  you: PrivateYou
  world: PublicWorld
  send: Send
  onClose: () => void
  onStance: (stance: Stance) => void
  near?: boolean
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
        {near && !held && !mine && <Button onClick={() => onStance("smash")}>Claim in person</Button>}
        {near && held && <Button variant="destructive" onClick={() => onStance("smash")}>{(world.players.find((p) => p.id === town.ownerId)?.walls ?? 0) >= 2 ? "Besiege the fort" : "Attack in person"}</Button>}
        {!near && !mine && <Button onClick={() => send({ t: "do", action: "march", kind: "warband", townId: town.id })}>Send the war band</Button>}
        {!near && <Button variant="outline" onClick={() => send({ t: "do", action: "march", kind: "raven", townId: town.id })}>Send a raven</Button>}
        {!near && town.shore && you.dock >= 1 && !mine && <Button variant="secondary" onClick={() => send({ t: "do", action: "march", kind: "longship", townId: town.id })}>Launch the longship</Button>}
        {!near && !town.shore && you.dock >= 1 && !mine && <Button variant="secondary" onClick={() => send({ t: "do", action: "march", kind: "longship", townId: town.id })}>Send the longship</Button>}
        {mine && <Button onClick={() => send({ t: "do", action: "tribute", townId: town.id })}>Take tribute</Button>}
        {same && near && <Button variant="secondary" onClick={() => send({ t: "do", action: "recruit", townId: town.id })}>Recruit {town.guardianName?.split(" ")[0]}</Button>}
        {same && !near && <Button variant="secondary" onClick={() => send({ t: "do", action: "march", kind: "warband", townId: town.id })}>Send for {town.guardianName?.split(" ")[0]}</Button>}
        {mine && near && <Button variant="outline" onClick={() => send({ t: "do", action: "rest" })}>Rest</Button>}
      </div>
      <p className="fine">{near ? "You are here. The sack is double, and the town falls now." : `Worth about ${TOWN_POWER[town.kind].wealth} gold. A march takes time. Driving here pays double.`} Say “claim town”, “attack”, or “recruit”.</p>
      {held && <p className="fine">{town.ownerName}'s army: {world.players.find((p) => p.id === town.ownerId)?.army ?? "a levy"}.</p>}
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
        <Button variant="destructive" onClick={onAttack}>{dist < 1300 ? `Besiege ${person.name}` : "Send a siege"}</Button>
        {you.dock >= 1 && <Button variant="outline" onClick={() => {
          const shore = world.towns.find((t) => t.ownerId === person.id && t.shore) ?? world.towns.find((t) => t.ownerId === person.id)
          if (shore) send({ t: "do", action: "march", kind: "longship", townId: shore.id })
          else send({ t: "do", action: "march", kind: "warband", playerId: person.id })
        }}>Raid</Button>}
      </Sheet>
    )
  }
  let income = you.hall * 4
  for (const id of you.townIds) {
    const town = world.towns.find((t) => t.id === id)
    if (town) income += TOWN_POWER[town.kind].income
  }
  return (
    <Sheet title={you.villageName} onClose={onClose}>
      <p className="muted" style={{ margin: 0 }}>About {income} gold every half minute, plus hearth gold you can take. Warband cap {you.warbandCap}. Recovery word: <b className="gold">{you.recovery}</b></p>
      <div className="row">
        <Button size="sm" onClick={() => send({ t: "do", action: "idle" })}>Take hearth gold · {you.idleGold}</Button>
        <Button size="sm" variant="outline" onClick={() => { void shareInvite(you.inviteCode, you.name) }}>Invite friends</Button>
      </div>
      <p className="fine">Invite link: {location.origin}/join/{you.inviteCode}. The hall can move once a month.</p>
      {you.quests.map((q) => <p key={q.id} className="fine">{q.claimed ? "Done" : `${q.progress}/${q.goal}`} · {q.title} · {q.reward} gold</p>)}
      <MoveHall send={send} />
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
      <p className="muted" style={{ margin: 0 }}>Heroes marching {you.warband.length} of {you.warbandCap}. The hall unlocks more. Infantry beats cavalry, cavalry beats archers, archers beat infantry, and a monster breaks a shield wall.</p>
      {UNIT_ORDER.map((cls) => {
        const rule = companyUnlock(you, cls)
        const have = you.companies.find((c) => c.cls === cls)
        const info = UNIT_INFO[cls]
        return (
          <article key={cls} className="card">
            <h3>{unitName(you.faction, cls)} · {info.title}</h3>
            <p className="fine">{info.blurb} Beats {UNIT_INFO[info.beats].title}. Attack {unitStats(you.faction, cls).attack} · Defense {unitStats(you.faction, cls).defense} · Health {unitStats(you.faction, cls).hp}.</p>
            <p className="muted" style={{ margin: 0 }}>{have ? `${have.strength} strong` : "Not raised."}{rule.ok ? ` · cap ${rule.cap}` : ""}</p>
            {rule.ok ? <Button size="sm" onClick={() => send({ t: "do", action: "raise", cls })}>{have ? "Refill" : "Raise"} · {rule.cost} gold</Button> : <p className="fine">{rule.why}</p>}
          </article>
        )
      })}
      <article className="card">
        <h3>Forge · mail rank {you.mail}</h3>
        <p className="fine">Craft arms for gold. Equip them on a hero. Mail is worn by the whole army.</p>
        <div className="row">
          {RECIPES.filter((r) => !r.faction || r.faction === you.faction).map((r) => (
            <Button key={r.key} size="sm" variant="outline" onClick={() => send({ t: "do", action: "craft", key: r.key })}>{r.label} · forge {r.forge}</Button>
          ))}
        </div>
      </article>
      <p className="muted" style={{ margin: 0 }}>Heroes</p>
      {you.champions.map((c) => (
        <article key={c.id} className="card champ-row">
          <Art file={c.art} alt="" />
          <div>
            <h3>{c.name}</h3>
            <p className="muted" style={{ margin: 0 }}>{c.title} · {UNIT_INFO[championClass(champions.find((d) => d.id === c.id) ?? { id: c.id, ranged: false })].title} · level {c.level} · {c.ability}</p>
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
      <div className="demo-flag">The game is free. Skins, weapons, draughts, the Battle Pass, and Nash Points are optional extras. You can claim towns, recruit, and fight without buying any of them. This demo charges nothing. Shelf prices, if a player wants points later: 800 NP $8.99, 2,400 NP $22.99, 4,500 NP $36.99, 12,500 NP $89.99.</div>
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
              <p className={`muted rarity rarity-${it.rarity}`} style={{ margin: 0 }}>{it.rarity} · {it.kind}{deal ? " · this moon, 20% off" : ""}{owned ? ` · owned ${owned}` : ""}</p>
              <p className="fine">{it.blurb}</p>
              <Button size="sm" onClick={() => setSku(it.id)}>Placeholder · {cost} NP{deal ? ` (was ${it.price})` : ""}</Button>
            </div>
          </article>
        )
      })}
      {tab === "points" && (
        <>
          <article className="card">
            <h3>Seaway Battle Pass · 800 NP</h3>
            <p className="fine">Optional. Playing already pays the free track in gold. The pass adds extra weapons, draughts, and a cloak. Tier {you.freeTier} of {PASS_TIERS.length}. {you.pass ? "Pass owned." : "Not bought."} Season {you.seasonXp} xp.</p>
            <div className="pips">{PASS_TIERS.map((tier, i) => <i key={tier.xp} className={i < you.freeTier ? "on" : ""} />)}</div>
            {!you.pass && <Button onClick={() => setSku("battle-pass")}>Optional pass · 800 NP</Button>}
          </article>
          {OFFERS.filter((o) => o.kind === "pack").map((o) => (
            <article key={o.sku} className="card">
              <h3>{o.name}</h3>
              <p className="fine">{o.blurb}</p>
              <Button size="sm" variant="secondary" onClick={() => setSku(o.sku)}>Placeholder · ${o.usd.toFixed(2)}</Button>
            </article>
          ))}
        </>
      )}
      <Dialog open={!!sku} onOpenChange={(open) => !open && setSku(null)}>
        <DialogContent>
          <DialogTitle>Optional extra</DialogTitle>
          <DialogDescription>
            {item && `${item.name} for ${price} Nash Points. `}
            {offer?.kind === "pack" && `${offer.name}. The shelf price is $${offer.usd.toFixed(2)} US. `}
            {offer?.kind === "pass" && "Seaway Battle Pass for 800 Nash Points. "}
            The game is already complete without this. Nothing is charged.
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

export function SagaPanel({ world, you, send, onClose }: { world: PublicWorld; you: PrivateYou; send: Send; onClose: () => void }) {
  const total = world.board.clans.viking + world.board.clans.grog || 1
  const [tab, setTab] = useState<"war" | "towns" | "gold" | "raids" | "scouts" | "live" | "friends" | "log">("live")
  const friends = [...you.friends].sort((a, b) => b.wins - a.wins || b.townCount - a.townCount)
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
        <Button size="sm" variant={tab === "live" ? "default" : "outline"} onClick={() => setTab("live")}>Players</Button>
        <Button size="sm" variant={tab === "scouts" ? "default" : "outline"} onClick={() => setTab("scouts")}>Seers</Button>
        <Button size="sm" variant={tab === "friends" ? "default" : "outline"} onClick={() => setTab("friends")}>Friends</Button>
        <Button size="sm" variant={tab === "log" ? "default" : "outline"} onClick={() => setTab("log")}>Log</Button>
      </div>
      {tab === "war" && world.board.warriors.map((r) => <p key={r.name} style={{ margin: 0 }}>{r.name} · {r.wins} wins · {r.faction}</p>)}
      {tab === "towns" && world.board.towns.map((r) => <p key={r.name} style={{ margin: 0 }}>{r.name} · {r.count} towns</p>)}
      {tab === "gold" && world.board.richest.map((r) => <p key={r.name} style={{ margin: 0 }}>{r.name} · {r.worth} worth</p>)}
      {tab === "raids" && world.board.raids.map((r) => <p key={r.name} style={{ margin: 0 }}>{r.name} · {r.raids} raids</p>)}
      {tab === "scouts" && world.board.scouts.map((r) => <p key={r.name} style={{ margin: 0 }}>{r.name} · {r.scouts} warnings on the real road · {r.faction}</p>)}
      {tab === "live" && (world.board.live.length ? world.board.live.map((r) => <p key={r.name} style={{ margin: 0 }}>{r.name} · {r.towns} towns · {r.wins} wins · {r.faction === "grog" ? "Grogs" : "Nash"}</p>) : <p className="fine">No living players on the road yet.</p>)}
      {tab === "friends" && (friends.length ? friends.map((f) => (
        <article key={f.id} className="card">
          <h3>{f.name}</h3>
          <p className="muted" style={{ margin: 0 }}>{f.villageName} · {f.wins} wins · {f.townCount} towns · {f.online ? "on the road" : "away"}</p>
          <div className="row">
            <Button size="sm" variant="destructive" onClick={() => send({ t: "do", action: "march", kind: "warband", playerId: f.id })}>Siege</Button>
            <Button size="sm" variant="outline" onClick={() => send({ t: "do", action: "march", kind: "longship", playerId: f.id })}>Raid</Button>
          </div>
        </article>
      )) : <p className="fine">No friends at the hearth yet. Invite one from your hall.</p>)}
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
    if (step === 0) { playSfx("horn"); if (battle.siege) playSfx("drums") }
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
    <section className={`battle ${battle.siege ? "siege" : ""}`}>
      <div className="battle-bg" aria-hidden="true">
        <img src={asset(left)} alt="" />
        <img src={asset(right)} alt="" />
      </div>
      <p className="eyebrow">{battle.win ? "Victory" : "Thrown back"} · {battle.siege ? "siege" : battle.kind}</p>
      <h2>{battle.townName ?? battle.defenderName}</h2>
      <div className="unit-lines">
        <p>{battle.attackerUnits.map((u) => u.name).join(" · ") || battle.attackerName}</p>
        <p>{battle.defenderUnits.map((u) => u.name).join(" · ") || battle.defenderName}</p>
      </div>
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

function MoveHall({ send }: { send: Send }) {
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<{ id?: string; name: string }[]>([])
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); void fetch(`/api/geocode?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((rows) => setHits(rows as { id?: string; name: string }[])) }}>
      <p className="fine">Move the hall once a month.</p>
      <input className="name-field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="A new town" />
      <Button type="submit" size="sm" variant="outline">Search</Button>
      {hits.map((hit) => hit.id ? <Button key={hit.id} size="sm" variant="ghost" onClick={() => send({ t: "do", action: "moveHome", placeId: hit.id })}>{hit.name}</Button> : null)}
    </form>
  )
}

async function shareInvite(code: string, name: string) {
  const url = `${location.origin}/join/${code}`
  const text = `${name} calls you to the longhouse.`
  if (navigator.share) {
    try {
      await navigator.share({ title: "Nash's Viking Chronicles", text, url })
      return
    } catch (err) {
      if ((err as Error).name === "AbortError") return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    window.prompt("Copy this invite link", url)
  }
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
