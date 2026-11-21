import type { ChampionDef, Faction } from "./types.ts"

/** Mass troops. Heroes are the named champions, and each hero also has one of these classes. */
export type UnitClass = "infantry" | "archer" | "cavalry" | "monster"

export type Company = { cls: UnitClass; strength: number; xp: number }

export const UNIT_ORDER: UnitClass[] = ["infantry", "archer", "cavalry", "monster"]

export const UNIT_INFO: Record<UnitClass, { title: string; viking: string; grog: string; beats: UnitClass; blurb: string }> = {
  infantry: { title: "Infantry", viking: "Huscarls", grog: "Boyz", beats: "cavalry", blurb: "Spears and shields. They stop a charge." },
  archer: { title: "Archers", viking: "Bowmen", grog: "Arrer boyz", beats: "infantry", blurb: "Shafts land before the lines meet." },
  cavalry: { title: "Cavalry", viking: "Riders", grog: "Boar riders", beats: "archer", blurb: "They close before the volley is finished." },
  monster: { title: "Monster", viking: "Jotun", grog: "Troll", beats: "infantry", blurb: "A body the shield wall cannot hold. Shafts hurt it." },
}

const CAVALRY = new Set(["jesse", "jayden", "krull", "billy", "zug"])
const MONSTERS = new Set(["urzog", "gorgrath", "brakka"])

export function championClass(def: Pick<ChampionDef, "id" | "ranged">): UnitClass {
  if (MONSTERS.has(def.id)) return "monster"
  if (def.ranged) return "archer"
  if (CAVALRY.has(def.id)) return "cavalry"
  return "infantry"
}

export function unitName(faction: Faction | null, cls: UnitClass): string {
  const info = UNIT_INFO[cls]
  return faction === "grog" ? info.grog : info.viking
}

/** Above 1, the attacker has the advantage. Below 1, the defender does. */
export function counter(attacker: UnitClass, defender: UnitClass): number {
  if (attacker === defender) return 1
  if (UNIT_INFO[attacker].beats === defender) return 1.32
  if (UNIT_INFO[defender].beats === attacker) return 0.74
  if (attacker === "monster" && defender === "cavalry") return 1.16
  if (attacker === "cavalry" && defender === "monster") return 0.84
  if (attacker === "archer" && defender === "monster") return 1.22
  if (attacker === "monster" && defender === "archer") return 0.8
  return 1
}

export function matchLine(atkName: string, atk: UnitClass, defName: string, def: UnitClass): string {
  const edge = counter(atk, def)
  if (edge > 1.05) return `${atkName} break ${defName}. ${UNIT_INFO[atk].title} beats ${UNIT_INFO[def].title}.`
  if (edge < 0.95) return `${defName} hold. ${UNIT_INFO[def].title} turns ${UNIT_INFO[atk].title} aside.`
  return `${atkName} lock with ${defName}.`
}

export type Unlock = { ok: true; cap: number; cost: number } | { ok: false; why: string }

export function companyUnlock(buildings: { hall: number; forge: number; walls: number; dock: number }, cls: UnitClass): Unlock {
  if (cls === "infantry") return { ok: true, cap: 36 + buildings.hall * 22, cost: 40 }
  if (cls === "archer") {
    if (buildings.forge < 1) return { ok: false, why: "The forge unlocks archers. Raise it, then muster the bows." }
    return { ok: true, cap: 24 + buildings.forge * 16, cost: 70 }
  }
  if (cls === "cavalry") {
    if (buildings.dock < 1) return { ok: false, why: "The dock unlocks cavalry. Raise it, then muster the riders." }
    return { ok: true, cap: 20 + buildings.dock * 14, cost: 90 }
  }
  if (buildings.hall < 2 || buildings.forge < 2) return { ok: false, why: "A monster needs a hall and a forge both at level 2." }
  return { ok: true, cap: 70 + buildings.forge * 8, cost: 160 }
}

export const RECIPES: { key: string; label: string; forge: number; gold: number; itemId?: string; grogItem?: string; mail?: boolean; faction?: Faction }[] = [
  { key: "axe", label: "Axe", forge: 1, gold: 60, itemId: "ash-wood-hand-axe", grogItem: "scrap-choppa" },
  { key: "bow", label: "Bow", forge: 1, gold: 90, itemId: "bone-howl-bow" },
  { key: "spear", label: "Spear", forge: 2, gold: 120, itemId: "sky-piercer", faction: "viking" },
  { key: "mail", label: "Mail", forge: 2, gold: 80, mail: true },
  { key: "maul", label: "Heavy arm", forge: 3, gold: 200, itemId: "hall-breaker", grogItem: "grimtusk-war-maul" },
]
