import {
  BUILDINGS,
  CLAIM_RADIUS,
  ATTACK_RADIUS,
  PASS_TIERS,
  rivals as RIVALS,
  SEASON_NAME,
  START_TOWNS,
  TOWN_POWER,
  WORLD_VERSION,
  buildingWorth,
  championById,
  itemById,
  itemPrice,
  townById,
  towns,
  warbandCap,
} from "../src/shared/catalog.ts"
import { formatMeters, haversine, homeSpot, nearestOnLine, offsetMeters, pointAlong, routeLength } from "../src/shared/geo.ts"
import { nearestPost } from "../src/shared/posts.ts"
import { REPORT_INFO, type ReportType } from "../src/shared/reports.ts"
import { riverRoute } from "../src/shared/routes.ts"
import type {
  BattleResult,
  Board,
  BuildingId,
  Faction,
  GameEvent,
  GameState,
  Player,
  PrivateYou,
  PublicPlayer,
  PublicShip,
  PublicTown,
  PublicWorld,
  SagaLine,
  Ship,
  Stance,
  TownDef,
} from "../src/shared/types.ts"

const RIVER_LEN = routeLength(riverRoute)
const WORDS = ["FJORD", "RAVEN", "AXE", "NATION", "SEAWAY", "IRON", "OATH", "WOLF", "HALL", "RUNE", "DRAKE", "PINE", "GOLD", "SPEAR", "STORM", "NASH"]

export type ActionResult = { error?: string; event?: GameEvent; result?: BattleResult }

type Side = {
  name: string
  faction: string
  hp: number
  maxHp: number
  attack: number
  defense: number
  goldMod: number
  healMod: number
  save: boolean
  hasRanged: boolean
  champs: (BattleResult["attackerChamps"][number] & { cry: string })[]
}

export function freshState(): GameState {
  const owned = new Map<string, string>()
  for (const rival of RIVALS) for (const id of rival.holds) owned.set(id, rival.id)
  const players: Record<string, Player> = {}
  for (const rival of RIVALS) {
    const town = townById(rival.townId)!
    const home = offsetMeters(town, rival.north, 40)
    players[rival.id] = blankPlayer({
      id: rival.id,
      name: rival.name,
      token: null,
      recovery: null,
      isAI: true,
      faction: rival.faction,
      lat: home.lat,
      lng: home.lng,
      homeLat: home.lat,
      homeLng: home.lng,
      villageName: `${rival.name.split(" ")[0]}'s Hall`,
      hall: rival.hall,
      forge: rival.forge,
      walls: rival.walls,
      dock: rival.dock,
      gold: rival.gold,
      wins: rival.wins,
      raids: rival.raids,
      ai: rival.ai,
    })
  }
  const now = Date.now()
  return {
    version: WORLD_VERSION,
    players,
    towns: towns.map((t) => ({ id: t.id, ownerId: owned.get(t.id) ?? null })),
    ships: [
      { id: "ship-raven", name: "Raven of Nash", faction: "viking", art: "items/raven-of-nash.jpg", progress: 0.18, dir: 1, ownerId: null, raid: null },
      { id: "ship-wolf", name: "Wolf-Prowed Drakkar", faction: "viking", art: "items/wolf-prowed-drakkar.jpg", progress: 0.46, dir: 1, ownerId: null, raid: null },
      { id: "ship-hulk", name: "Gorgrath's War Hulk", faction: "grog", art: "items/gorgrath-war-hulk.jpg", progress: 0.72, dir: -1, ownerId: null, raid: null },
    ],
    saga: [
      line(now, "The Seaway is awake. Jarl Harald holds Winchester. Bogra Gutlash holds Morrisburg."),
      line(now, "Urzog the Mountain has not left Long Sault."),
    ],
    flavorAt: now,
    economyAt: now,
    reports: [],
  }
}

export function normalize(state: GameState): GameState {
  for (const town of towns) {
    if (!state.towns.some((t) => t.id === town.id)) state.towns.push({ id: town.id, ownerId: null })
  }
  if (!state.flavorAt) state.flavorAt = Date.now()
  if (!state.economyAt) state.economyAt = Date.now()
  if (!state.reports) state.reports = []
  for (const p of Object.values(state.players)) if (typeof p.scouts !== "number") p.scouts = 0
  return state
}

export function createGame(state: GameState = freshState(), rng: () => number = Math.random) {
  normalize(state)

  function player(id: string) {
    return state.players[id] ?? null
  }

  function saga(text: string) {
    state.saga.unshift(line(Date.now(), text))
    state.saga = state.saga.slice(0, 40)
  }

  function event(text: string, tone: GameEvent["tone"], speech?: string): GameEvent {
    return { id: nid("e"), text, speech: speech ?? text, tone }
  }

  function join(input: { name?: string; token?: string; recovery?: string }): { error?: string; needName?: boolean; token?: string; playerId?: string } {
    if (input.token) {
      const found = Object.values(state.players).find((p) => p.token === input.token)
      if (!found) return { error: "That device token is spent. Speak your name again.", needName: true }
      found.lastSeen = Date.now()
      return { token: found.token ?? undefined, playerId: found.id }
    }
    const name = cleanName(input.name ?? "")
    if (!name) return { needName: true }
    if (!/^[\p{L}\p{N}][\p{L}\p{N}' .\-]{1,17}$/u.test(name)) {
      return { error: "Use 2 to 18 letters for a name." }
    }
    const existing = Object.values(state.players).find((p) => p.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      const word = (input.recovery ?? "").trim().toUpperCase()
      if (existing.recovery && word && existing.recovery.toUpperCase() === word) {
        existing.lastSeen = Date.now()
        return { token: existing.token ?? undefined, playerId: existing.id }
      }
      return { error: `${existing.name} is already on the saga. Enter the recovery word from the hall, or pick another name.` }
    }
    const id = nid("p")
    const token = crypto.randomUUID()
    const recovery = recoveryCode()
    state.players[id] = blankPlayer({ id, name, token, recovery, isAI: false })
    saga(`${name} takes the road.`)
    return { token, playerId: id }
  }

  function choose(playerId: string, input: { faction: Faction; startTownId?: string; lat?: number; lng?: number }): ActionResult {
    const p = player(playerId)
    if (!p) return { error: "You are not on the saga." }
    if (p.faction) return { error: "The oath is already sworn." }
    if (input.faction !== "viking" && input.faction !== "grog") return { error: "Pick the Nash clan or the Grogs." }
    let homeLat = 0
    let homeLng = 0
    let standLat = 0
    let standLng = 0
    if (typeof input.lat === "number" && typeof input.lng === "number") {
      if (input.lat < 44.35 || input.lat > 45.75 || input.lng > -74.25 || input.lng < -76.45) {
        return { error: "That spot is outside the Seaway saga. Start in Chesterville, Morrisburg, or Cornwall." }
      }
      const spot = homeSpot({ lat: input.lat, lng: input.lng }, p.id)
      homeLat = spot.lat
      homeLng = spot.lng
      standLat = input.lat
      standLng = input.lng
    } else {
      if (!input.startTownId || !START_TOWNS.includes(input.startTownId as (typeof START_TOWNS)[number])) {
        return { error: "Pick Chesterville, Morrisburg, or Cornwall." }
      }
      const town = townById(input.startTownId)!
      const spot = homeSpot(town, p.id)
      homeLat = spot.lat
      homeLng = spot.lng
      standLat = town.lat
      standLng = town.lng
    }
    const starterId = input.faction === "viking" ? "ryan" : "gorgrath"
    const starter = championById(starterId)!
    p.faction = input.faction
    p.lat = standLat
    p.lng = standLng
    p.homeLat = homeLat
    p.homeLng = homeLng
    p.villageName = input.faction === "viking" ? `${p.name}'s Hall` : `${p.name}'s Camp`
    p.gold = 180
    p.np = 250
    p.champions = [{ id: starterId, level: 1, xp: 0, hp: starter.health, weaponId: null }]
    p.warband = [starterId]
    p.inventory = [{ id: "field-poultice", qty: 1 }]
    p.lastSeen = Date.now()
    const who = input.faction === "viking" ? "Ryan Nash marches with you." : "Gorgrath Skullsplitter marches with you."
    const text = `${p.name} swears to the ${input.faction === "viking" ? "Nash clan" : "Grogs"}. ${who} A field poultice is in the satchel. Recovery word: ${p.recovery}.`
    saga(`${p.name} raises a ${input.faction === "viking" ? "hall" : "camp"} on the Seaway.`)
    return { event: event(text, "good") }
  }

  function setPos(playerId: string, pos: { lat: number; lng: number; heading: number; speed: number }) {
    const p = player(playerId)
    if (!p || p.faction == null) return
    if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return
    p.lat = pos.lat
    p.lng = pos.lng
    p.heading = Number.isFinite(pos.heading) ? pos.heading : p.heading
    p.speed = Math.max(0, Math.min(200, pos.speed || 0))
    p.lastSeen = Date.now()
  }

  function recruit(playerId: string, townId: string): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    const town = townById(townId)
    if (!town) return { error: "No such town." }
    const near = distanceError(p, town, CLAIM_RADIUS)
    if (near) return near
    if (!town.guardianId) return { error: `${town.name} has no champion waiting.` }
    const guard = championById(town.guardianId)!
    if (guard.faction !== p.faction) return { error: `${guard.name} will not march under your banner.` }
    const holder = championHolder(guard.id)
    if (holder) return { error: `${guard.name} already marches with ${holder.name}.` }
    if (townOwner(town.id) && townOwner(town.id) !== p.id) return { error: `${town.name} is held. Take the town, then recruit.` }
    p.champions.push({ id: guard.id, level: 1, xp: 0, hp: guard.health, weaponId: null })
    if (p.warband.length < warbandCap(p.hall)) p.warband.push(guard.id)
    const notes = addSeasonXp(p, 40)
    const text = `${guard.name} grips your forearm and joins the warband. ${guard.cry} ${notes.join(" ")}`.trim()
    saga(`${guard.name} joins ${p.name}.`)
    return { event: event(text, "good") }
  }

  function claim(playerId: string, townId: string, stance: Stance = "smash"): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    const town = townById(townId)
    if (!town) return { error: "No such town." }
    const near = distanceError(p, town, CLAIM_RADIUS)
    if (near) return near
    const owner = townOwner(town.id)
    if (owner === p.id) return tribute(playerId, townId)
    if (owner) return { error: `${town.name} is held by ${player(owner)?.name ?? "a rival"}. Say attack.` }
    return fight(p, null, town, "town", stance, "militia")
  }

  function attackTown(playerId: string, townId: string, stance: Stance = "smash"): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    const town = townById(townId)
    if (!town) return { error: "No such town." }
    const near = distanceError(p, town, ATTACK_RADIUS)
    if (near) return near
    const ownerId = townOwner(town.id)
    if (ownerId === p.id) return { error: `You already hold ${town.name}.` }
    if (!ownerId) return fight(p, null, town, "town", stance, "militia")
    const defender = player(ownerId)
    if (!defender) return { error: "The holder has left the saga." }
    return fight(p, defender, town, "town", stance, "field")
  }

  function attackPlayer(playerId: string, defenderId: string, stance: Stance = "smash"): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    const defender = player(defenderId)
    if (!defender || defender.id === p.id) return { error: "There is no rival hall there." }
    const dist = haversine(p, { lat: defender.homeLat, lng: defender.homeLng })
    if (dist > ATTACK_RADIUS) return { error: `${defender.villageName} is ${formatMeters(dist)} off. Ride closer.` }
    return fight(p, defender, undefined, "village", stance, "home")
  }

  function raid(playerId: string, townId?: string): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    if (p.dock < 1) return { error: "Raise a longship dock before the river will take you." }
    ensureShip(p)
    const ship = state.ships.find((s) => s.ownerId === p.id)
    if (!ship) return { error: "The dock is empty." }
    if (ship.raid) return { error: "Your ship is already on a raid." }
    const shores = towns.filter((t) => t.shore && townOwner(t.id) !== p.id)
    let target = townId ? townById(townId) : undefined
    if (townId && (!target || !target.shore)) return { error: "That is not a shoreline town." }
    if (target && townOwner(target.id) === p.id) return { error: `You already hold ${target.name}.` }
    if (!target) {
      const here = pointAlong(riverRoute, ship.progress * RIVER_LEN)
      target = shores.sort((a, b) => haversine(here, a) - haversine(here, b))[0]
    }
    if (!target) return { error: "No shoreline town is left to raid." }
    ship.raid = { attackerId: p.id, targetTownId: target.id }
    const text = `${ship.name} turns for ${target.name}.`
    saga(text)
    return { event: event(text, "info") }
  }

  function build(playerId: string, part: BuildingId): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    const def = BUILDINGS[part]
    if (!def) return { error: "Unknown building." }
    if (p[part] >= 3) return { error: `${def.name} is already as high as it will go.` }
    const cost = def.costs[p[part]]
    if (p.gold < cost) return { error: `Not enough gold. ${def.name} costs ${cost}. You hold ${p.gold}.` }
    p.gold -= cost
    p[part] += 1
    if (part === "dock") ensureShip(p)
    const text = `${def.name} rises to level ${p[part]} at ${p.villageName}.`
    saga(`${p.name} raises ${def.name.toLowerCase()} to level ${p[part]}.`)
    return { event: event(text, "good") }
  }

  function equip(playerId: string, championId: string | null, itemId: string | null): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    if (!itemId) {
      const champ = p.champions.find((c) => c.id === championId)
      if (!champ) return { error: "That champion is not in your hall." }
      champ.weaponId = null
      return { event: event(`${championById(champ.id)?.name ?? "They"} sets the weapon down.`, "info") }
    }
    const item = itemById(itemId)
    if (!item) return { error: "That is not in the hoard." }
    if (!p.inventory.some((s) => s.id === itemId && s.qty > 0)) return { error: `You do not own ${item.name}.` }
    if (item.kind === "skin") {
      p.skinId = item.id
      return { event: event(`You wear ${item.name}.`, "good") }
    }
    if (item.kind === "longship") {
      p.shipId = item.id
      ensureShip(p)
      return { event: event(`${item.name} is your ship on the Seaway.`, "good") }
    }
    if (item.kind === "potion") return drinkPotion(playerId, itemId)
    const champ = p.champions.find((c) => c.id === championId)
    if (!champ) return { error: "Choose who carries it." }
    const used = p.champions.filter((c) => c.weaponId === itemId).length
    const qty = p.inventory.find((s) => s.id === itemId)?.qty ?? 0
    if (used >= qty && champ.weaponId !== itemId) {
      const other = p.champions.find((c) => c.weaponId === itemId && c.id !== champ.id)
      if (other) other.weaponId = null
    }
    champ.weaponId = itemId
    return { event: event(`${championById(champ.id)?.name} takes up ${item.name}.`, "good") }
  }

  function setWarband(playerId: string, ids: string[]): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    const cap = warbandCap(p.hall)
    const unique = [...new Set(ids)].filter((id) => p.champions.some((c) => c.id === id && c.hp > 0))
    if (unique.length > cap) return { error: `The hall can march ${cap}. Raise the great hall to take more.` }
    if (!unique.length) return { error: "Someone has to march." }
    p.warband = unique
    const names = unique.map((id) => championById(id)?.name ?? id).join(", ")
    return { event: event(`The marching warband is ${names}.`, "info") }
  }

  function drinkPotion(playerId: string, itemId: string): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    const item = itemById(itemId)
    if (!item || item.kind !== "potion") return { error: "That is not a draught." }
    if (!spendItem(p, itemId)) return { error: `No ${item.name} left.` }
    const healed = healPool(p, item.heal)
    if (item.buffAttack || item.buffDefense) {
      p.buff = { attack: item.buffAttack, defense: item.buffDefense, label: item.name }
    }
    const buff = p.buff ? ` ${item.name} will bite on the next fight.` : ""
    return { event: event(`${item.name} mends ${healed} wounds.${buff}`, "good") }
  }

  function buy(playerId: string, sku: string): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    if (sku.startsWith("pack-")) {
      const offer = pack(sku)
      if (!offer) return { error: "Unknown pack." }
      p.np += offer.np
      return { event: event(`Demo hoard: ${offer.np} Nash Points added. Nothing was charged. The shelf price would have been $${offer.usd.toFixed(2)} US.`, "good") }
    }
    if (sku === "battle-pass") {
      if (p.pass) return { error: "You already hold the Seaway pass." }
      if (p.np < 800) return { error: "The pass costs 800 Nash Points." }
      p.np -= 800
      p.pass = true
      const notes = syncPass(p)
      return { event: event(`Seaway Battle Pass unlocked. Demo only, no charge. ${notes.join(" ")}`.trim(), "good") }
    }
    if (sku === "sub-trial" || sku === "sub-month" || sku === "sub-year") {
      const plan = sku === "sub-trial" ? "trial" : sku === "sub-month" ? "month" : "year"
      if (plan === "trial" && p.sub) return { error: "The free month is already spent. The demo monthly is $10 and the year is $120, still uncharged." }
      p.sub = { plan }
      const grant = plan === "year" ? 400 : 200
      p.np += grant
      const price = plan === "month" ? "$10 a month" : plan === "year" ? "$120 a year" : "the first month free, then $10 a month or $120 a year"
      return { event: event(`Oath of the Road: ${price}. Demo only, nothing charged. ${grant} Nash Points added. Gold from towns is heavier while the oath holds.`, "good") }
    }
    const item = itemById(sku)
    if (!item) return { error: "The hoard does not stock that." }
    const price = itemPrice(item.id)
    if (p.np < price) return { error: `${item.name} costs ${price} Nash Points. You have ${p.np}.` }
    p.np -= price
    giveItem(p, item.id, 1)
    if (item.kind === "skin" && !p.skinId) p.skinId = item.id
    if (item.kind === "longship" && !p.shipId) {
      p.shipId = item.id
      ensureShip(p)
    }
    return { event: event(`Demo purchase: ${item.name} for ${price} Nash Points. Nothing was charged.`, "good") }
  }

  function rest(playerId: string, now = Date.now()): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    const nearTown = towns.some((t) => townOwner(t.id) === p.id && haversine(p, t) <= CLAIM_RADIUS)
    const nearHall = haversine(p, { lat: p.homeLat, lng: p.homeLng }) <= 1500
    if (!nearTown && !nearHall) return { error: "Rest at your hall or in a town you hold." }
    if (now - p.restAt < 45000) return { error: "The warband is still binding wounds. Give it a moment." }
    p.restAt = now
    let gained = 0
    for (const c of p.champions) {
      const max = maxHealth(c.id, c.level)
      const next = Math.min(max, c.hp + Math.round(max * 0.22))
      gained += next - c.hp
      c.hp = next
    }
    return { event: event(`The warband rests. ${gained} wounds close.`, "good") }
  }

  function tribute(playerId: string, townId: string, now = Date.now()): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    const town = townById(townId)
    if (!town) return { error: "No such town." }
    if (townOwner(town.id) !== p.id) return { error: `You do not hold ${town.name}.` }
    const near = distanceError(p, town, CLAIM_RADIUS)
    if (near) return near
    if (now - (p.tribute[town.id] ?? 0) < 40000) return { error: `${town.name} has already paid this hour.` }
    const gain = TOWN_POWER[town.kind].income * 8
    p.tribute[town.id] = now
    p.gold += gain
    return { event: event(`${town.name} pays ${gain} gold in tribute.`, "good") }
  }

  function fileReport(playerId: string, type: ReportType): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    const info = REPORT_INFO[type]
    if (!info) return { error: "That is not a road mark I know." }
    const near = state.reports.find((r) => r.type === type && haversine(p, r) < 150)
    if (near) return { error: `${info.label} is already marked here.` }
    const now = Date.now()
    state.reports.push({
      id: nid("r"),
      type,
      lat: p.lat,
      lng: p.lng,
      reporterId: p.id,
      reporterName: p.name,
      faction: p.faction!,
      note: info.theme,
      createdAt: now,
      expiresAt: now + info.minutes * 60_000,
      still: [],
      gone: [],
    })
    p.gold += info.gold
    p.scouts += 1
    const notes = addSeasonXp(p, info.xp)
    const text = `${info.title} marked. ${info.label}. You earn ${info.gold} gold for the warning. ${notes.join(" ")}`.trim()
    saga(`${p.name} warns of ${info.title.toLowerCase()}. ${info.label}.`)
    return { event: event(text, "good") }
  }

  function confirmReport(playerId: string, reportId: string, still: boolean): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    const report = state.reports.find((r) => r.id === reportId)
    if (!report) return { error: "That mark has already faded." }
    if (report.reporterId === p.id) return { error: "You marked that yourself." }
    if (haversine(p, report) > 1200) return { error: "Ride closer before you confirm the mark." }
    if (report.still.includes(p.id) || report.gone.includes(p.id)) return { error: "You already spoke on that mark." }
    const info = REPORT_INFO[report.type]
    if (still) {
      report.still.push(p.id)
      report.expiresAt += 15 * 60_000
      p.gold += 8
      p.scouts += 1
      addSeasonXp(p, 15)
      return { event: event(`${info.title} is still there. ${info.label}. Eight gold for confirming.`, "good") }
    }
    report.gone.push(p.id)
    p.gold += 6
    p.scouts += 1
    addSeasonXp(p, 12)
    if (report.gone.length >= 2) state.reports = state.reports.filter((r) => r.id !== report.id)
    return { event: event(`${info.title} may be gone. ${info.label}. Six gold for checking.`, "info") }
  }

  function restock(playerId: string, now = Date.now()): ActionResult {
    const p = mustHuman(playerId)
    if ("error" in p) return p
    const hit = nearestPost(p, 180)
    if (!hit) return { error: "No trading post is close. A trading post is a gas station." }
    if (p.gold < 12) return { error: "Restock costs 12 gold." }
    if (now - p.restAt < 45000) return { error: "The warband is still at the cask. Give it a moment." }
    p.gold -= 12
    p.restAt = now
    let gained = 0
    for (const c of p.champions) {
      const max = maxHealth(c.id, c.level)
      const next = Math.min(max, c.hp + Math.round(max * 0.18))
      gained += next - c.hp
      c.hp = next
    }
    const tended = gained > 0 ? `binds ${gained} wounds and fills the satchel` : "fills the satchel"
    return { event: event(`${hit.post.title} ${tended}. ${hit.post.brand}, ${hit.post.place}. Gas station. Twelve gold.`, "good") }
  }

  function tick(now = Date.now()): { playerId: string; event: GameEvent }[] {
    const events: { playerId: string; event: GameEvent }[] = []
    if (now - state.economyAt >= 30000) {
      state.economyAt = now
      for (const p of Object.values(state.players)) {
        if (!p.faction) continue
        let gold = 0
        for (const t of state.towns) {
          if (t.ownerId !== p.id) continue
          const def = townById(t.id)
          if (def) gold += TOWN_POWER[def.kind].income
        }
        gold += p.hall * 4
        if (p.sub) gold = Math.round(gold * 1.25)
        p.gold += gold
      }
    }
    for (const ship of state.ships) {
      if (ship.raid) {
        const target = townById(ship.raid.targetTownId)
        if (!target) {
          ship.raid = null
          continue
        }
        const spot = nearestOnLine(riverRoute, target.lat, target.lng)
        const dir = spot.progress > ship.progress ? 1 : -1
        ship.dir = dir
        ship.progress = clamp(ship.progress + dir * 0.045, 0, 1)
        if (Math.abs(ship.progress - spot.progress) <= 0.03 || (dir > 0 && ship.progress >= spot.progress) || (dir < 0 && ship.progress <= spot.progress)) {
          ship.progress = spot.progress
          const attacker = player(ship.raid.attackerId)
          const ownerId = townOwner(target.id)
          const defender = ownerId ? player(ownerId) : null
          ship.raid = null
          if (attacker && !attacker.isAI) {
            const outcome = fight(attacker, defender, target, "raid", "smash", defender ? "field" : "militia")
            if (outcome.event) events.push({ playerId: attacker.id, event: outcome.event })
            if (defender && !defender.isAI && outcome.result) {
              const speech = outcome.result.win
                ? `${attacker.name} raided ${target.name} from the water. You lose ${outcome.result.gold} gold.`
                : `${attacker.name}'s ship broke on ${target.name}. The shore holds.`
              events.push({ playerId: defender.id, event: event(speech, outcome.result.win ? "bad" : "good", speech) })
            }
          }
        }
      } else if (ship.ownerId) {
        const owner = player(ship.ownerId)
        if (!owner || owner.dock < 1) continue
        const spot = nearestOnLine(riverRoute, owner.homeLat, owner.homeLng)
        const sway = Math.sin(now / 5000 + ship.progress * 10) * 0.01
        ship.progress = clamp(spot.progress + sway, 0, 1)
        ship.art = shipArt(owner)
      } else {
        ship.progress += ship.dir * 0.008
        if (ship.progress >= 0.97) ship.dir = -1
        if (ship.progress <= 0.03) ship.dir = 1
        ship.progress = clamp(ship.progress, 0, 1)
      }
    }
    state.reports = state.reports.filter((r) => r.expiresAt > now && r.gone.length < 2)
    if (now - state.flavorAt >= 70000) {
      state.flavorAt = now
      const hulk = state.ships.find((s) => s.id === "ship-hulk")
      if (hulk) {
        const at = pointAlong(riverRoute, hulk.progress * RIVER_LEN)
        const near = towns.filter((t) => t.shore).sort((a, b) => haversine(at, a) - haversine(at, b))[0]
        if (near) saga(`Gorgrath's War Hulk is on the water off ${near.name}.`)
      }
    }
    for (const p of Object.values(state.players)) if (!p.isAI && p.dock > 0) ensureShip(p)
    return events
  }

  function fight(attacker: Player, defender: Player | null, town: TownDef | undefined, kind: "town" | "village" | "raid", stance: Stance, mode: "field" | "home" | "militia"): ActionResult {
    if (stance === "heal") {
      const potion = bestPotion(attacker)
      if (!potion) return { error: "No draughts in the satchel." }
      spendItem(attacker, potion.id)
      healPool(attacker, potion.heal)
      if (potion.buffAttack || potion.buffDefense) attacker.buff = { attack: potion.buffAttack, defense: potion.buffDefense, label: potion.name }
    }
    const atk = sideFromPlayer(attacker, "field", kind === "raid")
    let def: Side
    if (mode === "militia" && town) def = militiaSide(town, attacker.faction)
    else if (defender) def = sideFromPlayer(defender, mode === "home" ? "home" : "field", false)
    else def = militiaSide(town!, attacker.faction)
    const defenderName = defender?.name ?? def.name
    const rounds: BattleResult["rounds"] = []
    const opening = atk.champs[0]?.cry
    if (opening) rounds.push({ text: opening, atkHp: atk.hp, defHp: def.hp })
    for (let r = 1; r <= 5 && atk.hp > 0 && def.hp > 0; r++) {
      let deal = atk.attack * 0.62
      let back = def.attack * 0.42
      const use = r === 1 ? stance : "smash"
      if (use === "smash") { deal *= 1.14; back *= 1.08 }
      if (use === "guard") { deal *= 0.76; back *= 0.6 }
      if (use === "volley") deal *= atk.hasRanged ? 1.38 : 1.05
      if (use === "heal") { deal *= 0.72; back *= 0.88 }
      if (def.hp < def.maxHp * 0.34) { deal *= 0.78; back *= 0.82 }
      deal *= 80 / (80 + def.defense) * (0.9 + rng() * 0.2)
      back *= 80 / (80 + atk.defense) * (0.92 + rng() * 0.16)
      def.hp -= deal
      atk.hp -= back
      const actor = atk.champs[r % Math.max(1, atk.champs.length)]?.name ?? attacker.name
      rounds.push({
        text: `${actor} strikes for ${Math.round(deal)}. ${defenderName} answers for ${Math.round(back)}.`,
        atkHp: Math.max(0, Math.round(atk.hp)),
        defHp: Math.max(0, Math.round(def.hp)),
      })
    }
    let win = false
    if (atk.hp <= 0 && def.hp <= 0) win = atk.attack >= def.attack
    else if (def.hp <= 0) win = true
    else if (atk.hp <= 0) win = false
    else win = atk.hp / atk.maxHp >= def.hp / def.maxHp
    if (win && atk.hp <= 0) atk.hp = atk.maxHp * 0.08
    atk.hp = Math.max(0, atk.hp)
    def.hp = Math.max(0, def.hp)
    applyHp(attacker, atk, win)
    if (defender && !defender.isAI) applyHp(defender, def, !win)
    attacker.buff = null
    if (defender) defender.buff = null

    let gold = 0
    let loot: BattleResult["loot"]
    if (win) {
      const wealth = town ? TOWN_POWER[town.kind].wealth : 70
      if (kind === "village" && defender) {
        gold = Math.max(30, Math.round(defender.gold * 0.15))
        defender.gold = Math.max(0, defender.gold - gold)
        if (atk.hp / atk.maxHp > 0.45) damageBuilding(defender)
      } else if (kind === "raid") {
        gold = Math.round(wealth * 0.7 * (1 + atk.goldMod))
        if (defender) {
          const steal = Math.min(defender.gold, Math.max(20, Math.round(gold * 0.5)))
          defender.gold -= steal
          gold = Math.max(gold, steal)
        }
      } else {
        gold = Math.round((wealth + 24) * (1 + atk.goldMod))
        if (defender && !defender.isAI) {
          const steal = Math.min(defender.gold, Math.round(defender.gold * 0.12))
          defender.gold -= steal
          gold += steal
        }
      }
      attacker.gold += gold
      attacker.wins += 1
      if (kind === "raid") attacker.raids += 1
      if (town && kind === "town") setOwner(town.id, attacker.id)
      loot = rollLoot(town)
      if (loot) giveItem(attacker, loot.id, 1)
      if (defender) defender.losses += 1
    } else {
      attacker.losses += 1
      if (defender && kind !== "raid") defender.wins += 1
    }
    const xpNotes = [...addSeasonXp(attacker, win ? 80 : 35), ...grantChampXp(attacker)]
    const place = town?.name ?? defender?.villageName ?? "the field"
    const recruitId = win && town && kind === "town" ? freeRecruit(town, attacker) : undefined
    const summary = narrate({
      faction: attacker.faction ?? "viking",
      win,
      place,
      gold,
      loot: loot?.name,
      recruit: recruitId ? championById(recruitId)?.name : undefined,
      wounded: atk.hp / atk.maxHp < 0.72,
      notes: xpNotes,
      kind,
    })
    if (win && town && kind === "town") saga(`${attacker.name} takes ${town.name}.`)
    else if (win && kind === "village" && defender) saga(`${attacker.name} sacks ${defender.villageName}.`)
    else if (win && kind === "raid" && town) saga(`${attacker.name} raids ${town.name} from the water.`)
    else saga(`${attacker.name} is thrown back at ${place}.`)
    const result: BattleResult = {
      id: nid("b"),
      kind,
      townId: town?.id,
      townName: town?.name,
      attackerName: attacker.name,
      defenderName,
      attackerFaction: attacker.faction ?? "viking",
      defenderFaction: defender?.faction ?? def.faction,
      win,
      gold,
      loot,
      summary,
      rounds,
      atkMax: Math.round(atk.maxHp),
      defMax: Math.round(def.maxHp),
      attackerChamps: atk.champs.map(({ cry: _cry, ...c }) => c),
      defenderChamps: def.champs.map(({ cry: _cry, ...c }) => c),
      recruitId,
    }
    return { result, event: event(summary, win ? "good" : "bad", summary) }
  }

  function sideFromPlayer(p: Player, mode: "field" | "home", raid: boolean): Side {
    const side = emptySide(p.name, p.faction ?? "viking")
    const marching = p.warband
      .map((id) => p.champions.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c && c.hp > 0)
    if (p.isAI && p.ai) {
      const walls = mode === "home" ? p.walls : 0
      side.attack = p.ai.attack * (1 + p.forge * 0.04)
      side.defense = p.ai.defense + walls * 22
      side.hp = side.maxHp = p.ai.hp + (mode === "home" ? p.hall * 30 : 0)
      side.champs = [{ id: p.id, name: p.name, art: p.faction === "grog" ? "scenes/orc-brute.webp" : "scenes/wolves.jpg", hp: side.hp, maxHp: side.maxHp, cry: "" }]
      return side
    }
    for (const owned of marching) {
      const def = championById(owned.id)
      if (!def) continue
      const weapon = owned.weaponId ? itemById(owned.weaponId) : undefined
      const lvl = 1 + (owned.level - 1) * 0.07
      side.attack += (def.attack * lvl + (weapon?.attack ?? 0)) * (1 + def.attackMod + (raid ? def.raidMod : 0))
      side.defense += (def.defense * lvl + (weapon?.defense ?? 0)) * (1 + def.defenseMod)
      const max = maxHealth(owned.id, owned.level)
      side.hp += owned.hp
      side.maxHp += max
      side.goldMod += def.goldMod
      side.healMod += def.healMod
      side.save = side.save || def.save
      side.hasRanged = side.hasRanged || def.ranged
      side.champs.push({ id: def.id, name: def.name, art: def.art, hp: owned.hp, maxHp: max, cry: def.cry })
    }
    if (!side.champs.length) {
      side.attack = 36
      side.defense = 24
      side.hp = side.maxHp = 90
      side.champs = [{ id: "levy", name: "Hall levy", art: p.faction === "grog" ? "scenes/orc-horned.webp" : "scenes/wolves.jpg", hp: 90, maxHp: 90, cry: "" }]
    }
    side.attack *= 1 + p.forge * 0.04
    if (p.buff) {
      side.attack *= 1 + p.buff.attack
      side.defense *= 1 + p.buff.defense
    }
    if (mode === "field") {
      const held = state.towns.filter((t) => t.ownerId === p.id).length
      const stretch = Math.max(0.62, 1 - Math.max(0, held - 1) * 0.06)
      side.attack *= stretch
      side.defense *= stretch
    }
    if (mode === "home") {
      side.defense += p.walls * 22
      side.hp += p.hall * 26
      side.maxHp += p.hall * 26
    }
    if (raid) {
      const shipBonus = p.shipId ? (itemById(p.shipId)?.raid ?? 0) : 0
      side.attack *= 1 + p.dock * 0.07 + shipBonus
    }
    return side
  }

  function militiaSide(town: TownDef, attackerFaction: Faction | null): Side {
    const power = TOWN_POWER[town.kind]
    const side = emptySide(`${town.name} militia`, "militia")
    side.attack = power.attack * town.threat
    side.defense = power.defense * town.threat
    side.hp = side.maxHp = power.hp * town.threat
    const militiaArt = championById(town.guardianId ?? "")?.faction === "grog" ? "scenes/orc-forest.jpg" : "scenes/wolves.jpg"
    side.champs = [{ id: `militia-${town.id}`, name: `${town.name} militia`, art: militiaArt, hp: side.maxHp, maxHp: side.maxHp, cry: "" }]
    if (town.guardianId && !championHolder(town.guardianId)) {
      const guard = championById(town.guardianId)
      if (guard && guard.faction !== attackerFaction) {
        const hp = Math.round(guard.health * 0.7)
        side.attack += guard.attack * 0.62
        side.defense += guard.defense * 0.5
        side.hp += hp
        side.maxHp += hp
        side.champs.push({ id: guard.id, name: guard.name, art: guard.art, hp, maxHp: hp, cry: guard.cry })
      }
    }
    return side
  }

  function applyHp(p: Player, side: Side, won: boolean) {
    const ratio = side.maxHp > 0 ? clamp(side.hp / side.maxHp, 0, 1) : 0
    for (const owned of p.champions.filter((c) => p.warband.includes(c.id))) {
      const max = maxHealth(owned.id, owned.level)
      owned.hp = Math.round(max * ratio)
    }
    const marching = p.champions.filter((c) => p.warband.includes(c.id))
    if (won && side.save && marching.some((c) => c.hp > 0)) {
      for (const c of marching) {
        const max = maxHealth(c.id, c.level)
        if (c.hp < max * 0.2) c.hp = Math.round(max * 0.2)
      }
    }
    if (won && side.healMod > 0 && marching.some((c) => c.hp > 0)) {
      for (const c of marching) {
        const max = maxHealth(c.id, c.level)
        c.hp = Math.min(max, c.hp + Math.round(max * side.healMod))
      }
    }
  }

  function rollLoot(town?: TownDef): { id: string; name: string } | undefined {
    const roll = rng()
    let id: string | undefined
    if (roll < 0.16) id = rng() < 0.5 ? "field-poultice" : "berserker-mead"
    else if (roll < 0.28) id = rng() < 0.5 ? "ash-wood-hand-axe" : "scrap-choppa"
    else if (town && (town.kind === "city" || town.kind === "town") && roll < 0.36) id = "sky-piercer"
    if (!id) return undefined
    const item = itemById(id)
    return item ? { id: item.id, name: item.name } : undefined
  }

  function freeRecruit(town: TownDef, p: Player): string | undefined {
    if (!town.guardianId) return undefined
    const guard = championById(town.guardianId)
    if (!guard || guard.faction !== p.faction) return undefined
    if (championHolder(guard.id)) return undefined
    return guard.id
  }

  function championHolder(id: string): Player | undefined {
    return Object.values(state.players).find((p) => p.champions.some((c) => c.id === id))
  }

  function townOwner(id: string): string | null {
    return state.towns.find((t) => t.id === id)?.ownerId ?? null
  }

  function setOwner(id: string, ownerId: string) {
    const row = state.towns.find((t) => t.id === id)
    if (row) row.ownerId = ownerId
  }

  function ensureShip(p: Player) {
    if (!p.faction || p.dock < 1) {
      state.ships = state.ships.filter((s) => s.ownerId !== p.id)
      return
    }
    let ship = state.ships.find((s) => s.ownerId === p.id)
    if (!ship) {
      const spot = nearestOnLine(riverRoute, p.homeLat, p.homeLng)
      ship = {
        id: `ship-${p.id}`,
        name: `${p.name}'s ship`,
        faction: p.faction,
        art: shipArt(p),
        progress: spot.progress,
        dir: 1,
        ownerId: p.id,
        raid: null,
      }
      state.ships.push(ship)
    }
    ship.art = shipArt(p)
    ship.faction = p.faction
    ship.name = p.shipId ? (itemById(p.shipId)?.name ?? ship.name) : `${p.name}'s ship`
  }

  function publicWorld(): PublicWorld {
    const now = Date.now()
    return {
      towns: state.towns.map((row) => publicTown(row.id, row.ownerId)),
      players: Object.values(state.players).filter((p) => p.faction).map((p) => publicPlayer(p, now)),
      ships: state.ships.map(publicShip),
      saga: state.saga.map((s) => ({ id: s.id, text: s.text })),
      reports: state.reports,
      board: board(),
      season: SEASON_NAME,
    }
  }

  function privateYou(id: string): PrivateYou | null {
    const p = player(id)
    if (!p) return null
    const next = PASS_TIERS.find((t, i) => i >= p.freeTier && p.seasonXp < t.xp)
    return {
      id: p.id,
      name: p.name,
      recovery: p.recovery,
      faction: p.faction,
      lat: p.lat,
      lng: p.lng,
      heading: p.heading,
      speed: p.speed,
      homeLat: p.homeLat,
      homeLng: p.homeLng,
      villageName: p.villageName,
      hall: p.hall,
      forge: p.forge,
      walls: p.walls,
      dock: p.dock,
      gold: p.gold,
      np: p.np,
      champions: p.champions.map((c) => {
        const def = championById(c.id)!
        const weapon = c.weaponId ? itemById(c.weaponId) : undefined
        return {
          ...c,
          name: def?.name ?? c.id,
          title: def?.title ?? "",
          art: def?.art ?? "scenes/wolves.jpg",
          ability: def?.ability ?? "",
          abilityText: def?.abilityText ?? "",
          attack: Math.round((def?.attack ?? 0) * (1 + (c.level - 1) * 0.07) + (weapon?.attack ?? 0)),
          defense: Math.round((def?.defense ?? 0) * (1 + (c.level - 1) * 0.07) + (weapon?.defense ?? 0)),
          maxHp: maxHealth(c.id, c.level),
          weaponName: weapon?.name ?? null,
        }
      }),
      warband: p.warband,
      warbandCap: warbandCap(p.hall),
      inventory: p.inventory.filter((s) => s.qty > 0).map((s) => {
        const item = itemById(s.id)
        return { id: s.id, name: item?.name ?? s.id, kind: item?.kind ?? "weapon", qty: s.qty, art: item?.art ?? "" }
      }),
      skinId: p.skinId,
      shipId: p.shipId,
      buff: p.buff,
      wins: p.wins,
      losses: p.losses,
      raids: p.raids,
      scouts: p.scouts ?? 0,
      seasonXp: p.seasonXp,
      pass: p.pass,
      freeTier: p.freeTier,
      premTier: p.premTier,
      nextTierXp: next ? next.xp : null,
      sub: p.sub,
      townIds: state.towns.filter((t) => t.ownerId === p.id).map((t) => t.id),
    }
  }

  function publicTown(id: string, ownerId: string | null): PublicTown {
    const town = townById(id)!
    const owner = ownerId ? player(ownerId) : null
    const guard = town.guardianId ? championById(town.guardianId) : undefined
    const taken = guard ? !!championHolder(guard.id) : false
    return {
      id: town.id,
      name: town.name,
      lat: town.lat,
      lng: town.lng,
      kind: town.kind,
      blurb: town.blurb,
      shore: town.shore,
      ownerId,
      ownerName: owner?.name ?? null,
      ownerFaction: owner?.faction ?? null,
      guardianId: guard?.id ?? null,
      guardianName: guard?.name ?? null,
      guardianFaction: guard?.faction ?? null,
      guardianArt: guard?.art ?? null,
      guardianFree: !!guard && !taken,
    }
  }

  function publicPlayer(p: Player, now: number): PublicPlayer {
    const leader = p.warband[0] ? championById(p.warband[0]) : undefined
    return {
      id: p.id,
      name: p.name,
      faction: p.faction,
      isAI: p.isAI,
      lat: p.lat,
      lng: p.lng,
      heading: p.heading,
      speed: p.speed,
      online: !p.isAI && now - p.lastSeen < 25000,
      homeLat: p.homeLat,
      homeLng: p.homeLng,
      villageName: p.villageName,
      hall: p.hall,
      forge: p.forge,
      walls: p.walls,
      dock: p.dock,
      gold: p.gold,
      wins: p.wins,
      losses: p.losses,
      raids: p.raids,
      skinId: p.skinId,
      leaderArt: p.skinId ? (itemById(p.skinId)?.art ?? leader?.art ?? null) : (leader?.art ?? null),
      townCount: state.towns.filter((t) => t.ownerId === p.id).length,
    }
  }

  function publicShip(ship: Ship): PublicShip {
    const at = pointAlong(riverRoute, clamp(ship.progress, 0, 1) * RIVER_LEN)
    return {
      id: ship.id,
      name: ship.name,
      faction: ship.faction,
      art: ship.art,
      lat: at.lat,
      lng: at.lng,
      heading: at.heading,
      ownerId: ship.ownerId,
      raiding: !!ship.raid,
    }
  }

  function board(): Board {
    const list = Object.values(state.players).filter((p) => p.faction)
    const clans = { viking: 0, grog: 0 }
    for (const p of list) {
      const score = p.wins * 4 + p.raids * 6 + p.hall * 3 + (p.scouts ?? 0) * 3 + state.towns.filter((t) => t.ownerId === p.id).length * 10
      if (p.faction === "viking") clans.viking += score
      if (p.faction === "grog") clans.grog += score
    }
    const row = (p: Player) => ({ name: p.name, faction: p.faction })
    return {
      clans,
      warriors: [...list].sort((a, b) => b.wins - a.wins).slice(0, 8).map((p) => ({ ...row(p), wins: p.wins })),
      towns: [...list].map((p) => ({ ...row(p), count: state.towns.filter((t) => t.ownerId === p.id).length })).sort((a, b) => b.count - a.count).slice(0, 8),
      richest: [...list].map((p) => ({ ...row(p), worth: p.gold + buildingWorth(p) })).sort((a, b) => b.worth - a.worth).slice(0, 8),
      raids: [...list].sort((a, b) => b.raids - a.raids).slice(0, 8).map((p) => ({ ...row(p), raids: p.raids })),
      scouts: [...list].sort((a, b) => (b.scouts ?? 0) - (a.scouts ?? 0)).slice(0, 8).map((p) => ({ ...row(p), scouts: p.scouts ?? 0 })),
    }
  }

  function mustHuman(id: string): Player | { error: string } {
    const p = player(id)
    if (!p) return { error: "You are not on the saga." }
    if (!p.faction) return { error: "Swear an oath before you ride." }
    p.lastSeen = Date.now()
    return p
  }

  function distanceError(p: Player, town: TownDef, radius: number): ActionResult | null {
    const dist = haversine(p, town)
    if (dist > radius) return { error: `${town.name} is ${formatMeters(dist)} off. Ride closer.` }
    return null
  }

  function addSeasonXp(p: Player, amount: number): string[] {
    p.seasonXp += amount
    return syncPass(p)
  }

  function syncPass(p: Player): string[] {
    const notes: string[] = []
    PASS_TIERS.forEach((tier, index) => {
      if (p.seasonXp < tier.xp) return
      if (index >= p.freeTier) {
        p.gold += tier.freeGold
        p.freeTier = index + 1
        notes.push(`Free season tier ${index + 1}: ${tier.freeGold} gold.`)
      }
      if (p.pass && index >= p.premTier) {
        p.premTier = index + 1
        if (tier.premGold) {
          p.gold += tier.premGold
          notes.push(`Pass tier ${index + 1}: ${tier.premGold} gold.`)
        }
        if (tier.premItem) {
          let itemId = tier.premItem
          if (p.faction === "grog" && itemId === "gold-wing-valkyrie") itemId = "gorgrath-war-paint"
          const item = itemById(itemId)
          if (item) {
            giveItem(p, item.id, 1)
            if (item.kind === "skin" && !p.skinId) p.skinId = item.id
            notes.push(`Pass tier ${index + 1}: ${item.name}.`)
          }
        }
      }
    })
    return notes
  }

  return {
    snapshot: () => state,
    join,
    choose,
    setPos,
    recruit,
    claim,
    attackTown,
    attackPlayer,
    raid,
    build,
    equip,
    setWarband,
    drinkPotion,
    buy,
    rest,
    restock,
    tribute,
    fileReport,
    confirmReport,
    tick,
    publicWorld,
    privateYou,
  }
}

function narrate(input: { faction: Faction; win: boolean; place: string; gold: number; loot?: string; recruit?: string; wounded: boolean; notes: string[]; kind: string }): string {
  const loot = input.loot ? ` The sack also holds ${input.loot}.` : ""
  const wound = input.wounded ? " The warband is wounded." : ""
  const recruit = input.recruit ? ` ${input.recruit} will join if you say recruit.` : ""
  const notes = input.notes.length ? ` ${input.notes.join(" ")}` : ""
  if (input.faction === "grog") {
    if (input.win) return `${input.place} breaks. ${input.gold} gold in the sack.${loot}${recruit}${wound}${notes}`
    return `${input.place} holds. The Grogs fall back, bleeding. A draught would help.${notes}`
  }
  if (input.win) {
    const verb = input.kind === "raid" ? "The longship raids" : "Victory at"
    return `${verb} ${input.place}. You take ${input.gold} gold.${loot}${recruit}${wound}${notes}`
  }
  return `${input.place} holds. The warband falls back, bleeding. Say heal, or pull over.${notes}`
}

function blankPlayer(partial: Partial<Player> & { id: string; name: string }): Player {
  return {
    id: partial.id,
    token: partial.token ?? null,
    recovery: partial.recovery ?? null,
    name: partial.name,
    faction: partial.faction ?? null,
    isAI: partial.isAI ?? false,
    lat: partial.lat ?? 45.10243,
    lng: partial.lng ?? -75.22892,
    heading: 0,
    speed: 0,
    lastSeen: Date.now(),
    homeLat: partial.homeLat ?? partial.lat ?? 45.10243,
    homeLng: partial.homeLng ?? partial.lng ?? -75.22892,
    villageName: partial.villageName ?? `${partial.name}'s Hall`,
    hall: partial.hall ?? 0,
    forge: partial.forge ?? 0,
    walls: partial.walls ?? 0,
    dock: partial.dock ?? 0,
    gold: partial.gold ?? 0,
    np: partial.np ?? 0,
    champions: partial.champions ?? [],
    warband: partial.warband ?? [],
    inventory: partial.inventory ?? [],
    skinId: null,
    shipId: null,
    buff: null,
    wins: partial.wins ?? 0,
    losses: 0,
    raids: partial.raids ?? 0,
    scouts: partial.scouts ?? 0,
    seasonXp: 0,
    pass: false,
    freeTier: 0,
    premTier: 0,
    sub: null,
    restAt: 0,
    tribute: {},
    lastBattleAt: 0,
    ai: partial.ai ?? null,
    createdAt: Date.now(),
  }
}

function emptySide(name: string, faction: string): Side {
  return { name, faction, hp: 0, maxHp: 0, attack: 0, defense: 0, goldMod: 0, healMod: 0, save: false, hasRanged: false, champs: [] }
}

function giveItem(p: Player, id: string, qty: number) {
  const slot = p.inventory.find((s) => s.id === id)
  if (slot) slot.qty += qty
  else p.inventory.push({ id, qty })
}

function spendItem(p: Player, id: string): boolean {
  const slot = p.inventory.find((s) => s.id === id && s.qty > 0)
  if (!slot) return false
  slot.qty -= 1
  return true
}

function healPool(p: Player, amount: number): number {
  let left = amount
  let healed = 0
  const order = [...p.champions].sort((a, b) => a.hp / maxHealth(a.id, a.level) - b.hp / maxHealth(b.id, b.level))
  for (const c of order) {
    if (left <= 0) break
    const max = maxHealth(c.id, c.level)
    const add = Math.min(max - c.hp, left)
    c.hp += add
    left -= add
    healed += add
  }
  return healed
}

function bestPotion(p: Player) {
  const owned = p.inventory.filter((s) => s.qty > 0).map((s) => itemById(s.id)).filter((i): i is NonNullable<typeof i> => !!i && i.kind === "potion")
  owned.sort((a, b) => b.heal - a.heal)
  return owned[0]
}

function grantChampXp(p: Player): string[] {
  const notes: string[] = []
  for (const c of p.champions.filter((c) => p.warband.includes(c.id))) {
    c.xp += 40
    while (c.level < 10 && c.xp >= 70 * c.level) {
      c.xp -= 70 * c.level
      c.level += 1
      const max = maxHealth(c.id, c.level)
      c.hp = Math.min(max, c.hp + Math.round(max * 0.3))
      notes.push(`${championById(c.id)?.name ?? "A champion"} reaches level ${c.level}.`)
    }
  }
  return notes
}

function maxHealth(id: string, level: number): number {
  const def = championById(id)
  if (!def) return 100
  return Math.round(def.health * (1 + (level - 1) * 0.08))
}

function damageBuilding(p: Player) {
  const order: BuildingId[] = ["walls", "dock", "forge", "hall"]
  for (const part of order) {
    if (p[part] > 0) {
      p[part] -= 1
      return
    }
  }
}

function shipArt(p: Player): string {
  if (p.shipId) return itemById(p.shipId)?.art ?? "items/wolf-prowed-drakkar.jpg"
  return p.faction === "grog" ? "items/gorgrath-war-hulk.jpg" : "items/raven-of-nash.jpg"
}

function pack(sku: string) {
  const table: Record<string, { np: number; usd: number }> = {
    "pack-800": { np: 800, usd: 8.99 },
    "pack-2400": { np: 2400, usd: 22.99 },
    "pack-4500": { np: 4500, usd: 36.99 },
    "pack-12500": { np: 12500, usd: 89.99 },
  }
  return table[sku]
}

function cleanName(name: string): string {
  return name.replace(/[<>]/g, "").replace(/\s+/g, " ").trim()
}

function recoveryCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(2))
  return `${WORDS[n[0] % WORDS.length]}-${WORDS[n[1] % WORDS.length]}-${(n[0] % 90) + 10}`
}

function line(at: number, text: string): SagaLine {
  return { id: nid("s"), text, at }
}

function nid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
