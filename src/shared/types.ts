import type { Company } from "./army.ts"
import type { RoadReport } from "./reports.ts"

export type Faction = "viking" | "grog"
export type TownKind = "hamlet" | "village" | "town" | "city"
export type ItemKind = "skin" | "weapon" | "longship" | "potion"
export type Rarity = "common" | "uncommon" | "rare" | "legendary"
export type Stance = "smash" | "guard" | "volley" | "heal"
export type BuildingId = "hall" | "forge" | "walls" | "dock"

export type ChampionDef = {
  id: string
  name: string
  title: string
  faction: Faction
  role: string
  weaponName: string
  attack: number
  defense: number
  health: number
  ability: string
  abilityText: string
  cry: string
  art: string
  ranged: boolean
  attackMod: number
  defenseMod: number
  goldMod: number
  raidMod: number
  healMod: number
  save: boolean
}

export type ItemDef = {
  id: string
  name: string
  kind: ItemKind
  rarity: Rarity
  price: number
  art: string
  blurb: string
  attack: number
  defense: number
  heal: number
  buffAttack: number
  buffDefense: number
  raid: number
  side: "nash" | "grog" | "either"
}

export type TownDef = {
  id: string
  name: string
  lat: number
  lng: number
  kind: TownKind
  blurb: string
  guardianId?: string
  shore: boolean
  threat: number
}

export type RivalDef = {
  id: string
  name: string
  title: string
  faction: Faction
  townId: string
  holds: string[]
  gold: number
  wins: number
  raids: number
  hall: number
  forge: number
  walls: number
  dock: number
  ai: { attack: number; defense: number; hp: number }
  north: number
}

export type OwnedChampion = {
  id: string
  level: number
  xp: number
  hp: number
  weaponId: string | null
}

export type Buff = { attack: number; defense: number; label: string }

export type Player = {
  id: string
  token: string | null
  recovery: string | null
  name: string
  faction: Faction | null
  isAI: boolean
  lat: number
  lng: number
  heading: number
  speed: number
  lastSeen: number
  homeLat: number
  homeLng: number
  villageName: string
  hall: number
  forge: number
  walls: number
  dock: number
  gold: number
  np: number
  champions: OwnedChampion[]
  companies: Company[]
  mail: number
  warband: string[]
  inventory: { id: string; qty: number }[]
  skinId: string | null
  shipId: string | null
  buff: Buff | null
  wins: number
  losses: number
  raids: number
  scouts: number
  seasonXp: number
  pass: boolean
  freeTier: number
  premTier: number
  restAt: number
  tribute: Record<string, number>
  lastBattleAt: number
  ai: null | { attack: number; defense: number; hp: number }
  createdAt: number
}

export type TownState = { id: string; ownerId: string | null }

export type Ship = {
  id: string
  name: string
  faction: Faction
  art: string
  progress: number
  dir: 1 | -1
  ownerId: string | null
  raid: null | { attackerId: string; targetTownId: string }
}

export type SagaLine = { id: string; text: string; at: number }

export type GameState = {
  version: number
  players: Record<string, Player>
  towns: TownState[]
  ships: Ship[]
  saga: SagaLine[]
  flavorAt: number
  economyAt: number
  reports: RoadReport[]
}

export type ChampView = {
  id: string
  name: string
  art: string
  hp: number
  maxHp: number
}

export type BattleResult = {
  id: string
  kind: "town" | "village" | "raid"
  townId?: string
  townName?: string
  attackerName: string
  defenderName: string
  attackerFaction: Faction
  defenderFaction: string
  win: boolean
  gold: number
  loot?: { id: string; name: string }
  summary: string
  rounds: { text: string; atkHp: number; defHp: number }[]
  siege: boolean
  attackerUnits: { name: string; cls: string }[]
  defenderUnits: { name: string; cls: string }[]
  atkMax: number
  defMax: number
  attackerChamps: ChampView[]
  defenderChamps: ChampView[]
  recruitId?: string
}

export type PublicTown = {
  id: string
  name: string
  lat: number
  lng: number
  kind: TownKind
  blurb: string
  shore: boolean
  ownerId: string | null
  ownerName: string | null
  ownerFaction: Faction | null
  guardianId: string | null
  guardianName: string | null
  guardianFaction: Faction | null
  guardianArt: string | null
  guardianFree: boolean
}

export type PublicPlayer = {
  id: string
  name: string
  faction: Faction | null
  isAI: boolean
  lat: number
  lng: number
  heading: number
  speed: number
  online: boolean
  homeLat: number
  homeLng: number
  villageName: string
  hall: number
  forge: number
  walls: number
  dock: number
  gold: number
  army: string
  wins: number
  losses: number
  raids: number
  skinId: string | null
  leaderArt: string | null
  townCount: number
}

export type PublicShip = {
  id: string
  name: string
  faction: Faction
  art: string
  lat: number
  lng: number
  heading: number
  ownerId: string | null
  raiding: boolean
}

export type Board = {
  clans: { viking: number; grog: number }
  warriors: { name: string; faction: Faction | null; wins: number }[]
  towns: { name: string; faction: Faction | null; count: number }[]
  richest: { name: string; faction: Faction | null; worth: number }[]
  raids: { name: string; faction: Faction | null; raids: number }[]
  scouts: { name: string; faction: Faction | null; scouts: number }[]
}

export type PublicWorld = {
  towns: PublicTown[]
  players: PublicPlayer[]
  ships: PublicShip[]
  saga: { id: string; text: string }[]
  reports: RoadReport[]
  board: Board
  season: string
}

export type PrivateChampion = OwnedChampion & {
  name: string
  title: string
  art: string
  ability: string
  abilityText: string
  attack: number
  defense: number
  maxHp: number
  weaponName: string | null
}

export type PrivateYou = {
  id: string
  name: string
  recovery: string | null
  faction: Faction | null
  lat: number
  lng: number
  heading: number
  speed: number
  homeLat: number
  homeLng: number
  villageName: string
  hall: number
  forge: number
  walls: number
  dock: number
  gold: number
  np: number
  champions: PrivateChampion[]
  companies: Company[]
  mail: number
  warband: string[]
  warbandCap: number
  inventory: { id: string; name: string; kind: ItemKind; qty: number; art: string }[]
  skinId: string | null
  shipId: string | null
  buff: Buff | null
  wins: number
  losses: number
  raids: number
  scouts: number
  seasonXp: number
  pass: boolean
  freeTier: number
  premTier: number
  nextTierXp: number | null
  townIds: string[]
}

export type GameEvent = {
  id: string
  text: string
  speech?: string
  tone: "good" | "bad" | "info"
}

export type ServerHello = { t: "hello"; token?: string; you: PrivateYou | null; world: PublicWorld; needName?: boolean }
export type ServerState = { t: "state"; you: PrivateYou | null; world: PublicWorld }
export type ServerResult = { t: "result"; you: PrivateYou; world: PublicWorld; result: BattleResult; event: GameEvent }
export type ServerEvent = { t: "event"; you: PrivateYou | null; world: PublicWorld; event: GameEvent }
export type ServerErr = { t: "err"; message: string; needName?: boolean }
export type ServerPong = { t: "pong" }
export type ServerMsg = ServerHello | ServerState | ServerResult | ServerEvent | ServerErr | ServerPong
