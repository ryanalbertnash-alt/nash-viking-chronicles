import type { BuildingId, ChampionDef, ItemDef, RivalDef, TownDef, TownKind } from "./types.ts"

export const WORLD_VERSION = 3
export const CLAIM_RADIUS = 1000
export const ATTACK_RADIUS = 1300
export const LOCK_KMH = 10
export const SEASON_NAME = "Seaway Season"

const art = (file: string) => file

export const champions: ChampionDef[] = [
  { id: "ralph", name: "Ralph Nash", title: "Elder chieftain", faction: "viking", role: "Great axe", weaponName: "Great axe", attack: 72, defense: 86, health: 156, ability: "Oath of the Hall", abilityText: "The old oath steadies every shield in the warband.", cry: "The hall stands!", art: art("champions/ralph.jpg"), ranged: false, attackMod: 0, defenseMod: 0.12, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "donna", name: "Donna Nash", title: "Matriarch and seer", faction: "viking", role: "Runestaff", weaponName: "Runestaff", attack: 58, defense: 70, health: 124, ability: "Rune Sight", abilityText: "She reads the road. The warband hits truer and the sack is heavier.", cry: "The runes have spoken.", art: art("champions/donna.jpg"), ranged: true, attackMod: 0.08, defenseMod: 0.04, goldMod: 0.12, raidMod: 0, healMod: 0, save: false },
  { id: "ryan", name: "Ryan Nash", title: "Warlord", faction: "viking", role: "Axe and shield", weaponName: "Axe and shield", attack: 80, defense: 78, health: 142, ability: "Shield Wall", abilityText: "Locks the line. Defense rises for the whole warband.", cry: "For the Nash! Hold the line!", art: art("champions/ryan.jpg"), ranged: false, attackMod: 0.04, defenseMod: 0.14, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "billy", name: "Billy Nash", title: "Berserker", faction: "viking", role: "Dual axes", weaponName: "Dual axes", attack: 94, defense: 46, health: 118, ability: "Red Fury", abilityText: "Both axes, no patience. Attack surges.", cry: "Blood and axes!", art: art("champions/billy.jpg"), ranged: false, attackMod: 0.16, defenseMod: 0, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "landin", name: "Landin Nash", title: "Shieldbearer", faction: "viking", role: "Spear and shield", weaponName: "Spear", attack: 64, defense: 92, health: 150, ability: "Spearwall", abilityText: "A wall of spears. The warband is hard to break.", cry: "Shields up!", art: art("champions/landin.jpg"), ranged: false, attackMod: 0, defenseMod: 0.15, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "gavin", name: "Gavin Nash", title: "Swordsman", faction: "viking", role: "Longsword", weaponName: "Longsword", attack: 78, defense: 72, health: 128, ability: "Measured Steel", abilityText: "He spends nothing. A clean gain to attack and defense.", cry: "Steel, not noise.", art: art("champions/gavin.jpg"), ranged: false, attackMod: 0.06, defenseMod: 0.08, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "haydin", name: "Haydin Nash", title: "Hunter", faction: "viking", role: "Bow", weaponName: "Hunting bow", attack: 86, defense: 50, health: 108, ability: "Volley", abilityText: "The first shafts land before the lines meet.", cry: "Loose!", art: art("champions/haydin.jpg"), ranged: true, attackMod: 0.1, defenseMod: 0, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "kali", name: "Kali Nash", title: "Shieldmaiden", faction: "viking", role: "Shield and seax", weaponName: "Seax", attack: 70, defense: 88, health: 136, ability: "Hold Fast", abilityText: "She does not give ground.", cry: "None pass!", art: art("champions/kali.jpg"), ranged: false, attackMod: 0, defenseMod: 0.12, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "area", name: "Area Nash", title: "Storm-caller", faction: "viking", role: "Lightning staff", weaponName: "Lightning staff", attack: 98, defense: 48, health: 110, ability: "Storm Call", abilityText: "Lightning on the road. A hard surge of attack.", cry: "The sky answers!", art: art("champions/area.jpg"), ranged: true, attackMod: 0.18, defenseMod: 0, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "jesse", name: "Jesse Nash", title: "Raider", faction: "viking", role: "Boarding axe", weaponName: "Boarding axe", attack: 82, defense: 54, health: 120, ability: "Sack", abilityText: "He knows where the gold is kept.", cry: "Take it all!", art: art("champions/jesse.jpg"), ranged: false, attackMod: 0.06, defenseMod: 0, goldMod: 0.25, raidMod: 0.1, healMod: 0, save: false },
  { id: "jayden", name: "Jayden Nash", title: "Scout", faction: "viking", role: "Twin knives", weaponName: "Twin knives", attack: 80, defense: 56, health: 104, ability: "Flank", abilityText: "Already behind them.", cry: "Already behind you.", art: art("champions/jayden.jpg"), ranged: false, attackMod: 0.1, defenseMod: 0, goldMod: 0, raidMod: 0.06, healMod: 0, save: false },
  { id: "james", name: "James Nash", title: "Blacksmith", faction: "viking", role: "War hammer", weaponName: "War hammer", attack: 74, defense: 82, health: 146, ability: "Forge Temper", abilityText: "The line holds like quenched iron.", cry: "Hot iron!", art: art("champions/james.jpg"), ranged: false, attackMod: 0.04, defenseMod: 0.1, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "lana", name: "Lana Nash", title: "Archer", faction: "viking", role: "Longbow", weaponName: "Longbow", attack: 90, defense: 46, health: 104, ability: "Long Shot", abilityText: "She picks a mark and does not miss twice.", cry: "On the wind.", art: art("champions/lana.jpg"), ranged: true, attackMod: 0.12, defenseMod: 0, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "anna", name: "Anna Nash", title: "Healer", faction: "viking", role: "Draught and staff", weaponName: "Healer's staff", attack: 40, defense: 62, health: 116, ability: "Healing Hands", abilityText: "After the clash she keeps people standing.", cry: "Stay with me.", art: art("champions/anna.jpg"), ranged: false, attackMod: 0, defenseMod: 0.04, goldMod: 0, raidMod: 0, healMod: 0.14, save: false },
  { id: "alain", name: "Alain Nash", title: "Jarl's champion", faction: "viking", role: "Dane axe", weaponName: "Dane axe", attack: 96, defense: 74, health: 148, ability: "Jarl's Due", abilityText: "The champion's axe is a debt the enemy pays.", cry: "The jarl's due!", art: art("champions/alain.jpg"), ranged: false, attackMod: 0.12, defenseMod: 0.04, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "emma", name: "Emma Nash", title: "Valkyrie", faction: "viking", role: "Spear", weaponName: "Winged spear", attack: 88, defense: 70, health: 132, ability: "Choose the Slain", abilityText: "One champion refuses to fall.", cry: "Not this one.", art: art("champions/emma.jpg"), ranged: false, attackMod: 0.08, defenseMod: 0.06, goldMod: 0, raidMod: 0, healMod: 0.04, save: true },
  { id: "gorgrath", name: "Gorgrath Skullsplitter", title: "Warchief", faction: "grog", role: "Skull cleaver", weaponName: "Skull cleaver", attack: 100, defense: 72, health: 164, ability: "Skullsplit", abilityText: "The first hit is the argument.", cry: "Split them!", art: art("champions/gorgrath.jpg"), ranged: false, attackMod: 0.14, defenseMod: 0.04, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "mogdura", name: "Mog'Dura the Bone Witch", title: "Shaman", faction: "grog", role: "Skull staff", weaponName: "Skull staff", attack: 56, defense: 64, health: 120, ability: "Bloodrite", abilityText: "Bones knit, and the enemy's luck rots.", cry: "Bones hear me.", art: art("champions/mogdura.jpg"), ranged: true, attackMod: 0.08, defenseMod: 0.04, goldMod: 0, raidMod: 0, healMod: 0.14, save: false },
  { id: "brakka", name: "Brakka Ironhide", title: "Brute", faction: "grog", role: "Scrap plate", weaponName: "Iron fists", attack: 70, defense: 98, health: 176, ability: "Ironhide", abilityText: "Blows land and do not matter.", cry: "Can't dent me.", art: art("champions/brakka.jpg"), ranged: false, attackMod: 0, defenseMod: 0.16, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "zug", name: "Zug the Gutripper", title: "Berserker", faction: "grog", role: "Jagged blades", weaponName: "Jagged blades", attack: 102, defense: 40, health: 124, ability: "Gutrip", abilityText: "Ugly, fast, and too close.", cry: "Guts!", art: art("champions/zug.jpg"), ranged: false, attackMod: 0.18, defenseMod: 0, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "sharga", name: "Sharga Blackfang", title: "Huntress", faction: "grog", role: "Bow", weaponName: "Blackfang bow", attack: 92, defense: 48, health: 108, ability: "Blackfang Arrow", abilityText: "One fang is enough if it is placed.", cry: "One fang is enough.", art: art("champions/sharga.jpg"), ranged: true, attackMod: 0.12, defenseMod: 0, goldMod: 0, raidMod: 0.05, healMod: 0, save: false },
  { id: "krull", name: "Krull Wolfrider", title: "Scout", faction: "grog", role: "Dire wolf", weaponName: "Wolf spear", attack: 84, defense: 60, health: 130, ability: "Wolf Rush", abilityText: "The wolf hits first, and harder from the water.", cry: "Run them down!", art: art("champions/krull.jpg"), ranged: false, attackMod: 0.08, defenseMod: 0, goldMod: 0, raidMod: 0.16, healMod: 0, save: false },
  { id: "grimtusk", name: "Grimtusk the Forgemaster", title: "Smith", faction: "grog", role: "War maul", weaponName: "War maul", attack: 78, defense: 84, health: 150, ability: "Temper", abilityText: "Scrap becomes plate. Defense rises.", cry: "From the forge!", art: art("champions/grimtusk.jpg"), ranged: false, attackMod: 0.04, defenseMod: 0.11, goldMod: 0, raidMod: 0, healMod: 0, save: false },
  { id: "urzog", name: "Urzog the Mountain", title: "Giant boss", faction: "grog", role: "War maul", weaponName: "Mountain maul", attack: 112, defense: 88, health: 220, ability: "Mountainfall", abilityText: "The ground takes a side.", cry: "The mountain walks.", art: art("champions/urzog.jpg"), ranged: false, attackMod: 0.2, defenseMod: 0.06, goldMod: 0.1, raidMod: 0, healMod: 0, save: false },
]

export const items: ItemDef[] = [
  { id: "trail-worn-clan-leather", name: "Trail-Worn Clan Leather", kind: "skin", rarity: "common", price: 800, art: "items/trail-worn-clan-leather.jpg", blurb: "Nash riding leather, salt-stained and honest.", attack: 0, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "nash" },
  { id: "frostfjord-hall-guard", name: "Frostfjord Hall Guard", kind: "skin", rarity: "uncommon", price: 1200, art: "items/frostfjord-hall-guard.jpg", blurb: "Blue steel and wolf fur for a door that must hold.", attack: 0, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "nash" },
  { id: "wolf-pelt-raider", name: "Wolf-Pelt Raider", kind: "skin", rarity: "rare", price: 1500, art: "items/wolf-pelt-raider.jpg", blurb: "A grey pelt over mail. The concession roads know it.", attack: 0, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "either" },
  { id: "runebound-seer-cloak", name: "Runebound Seer Cloak", kind: "skin", rarity: "legendary", price: 2000, art: "items/runebound-seer-cloak.jpg", blurb: "Donna's pattern. Runes stitched where the rain hits first.", attack: 0, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "nash" },
  { id: "gold-wing-valkyrie", name: "Gold-Wing Valkyrie", kind: "skin", rarity: "legendary", price: 2000, art: "items/gold-wing-valkyrie.jpg", blurb: "Emma's gold. Wings on the helm, spear at the shoulder.", attack: 0, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "nash" },
  { id: "gorgrath-war-paint", name: "Gorgrath War Paint", kind: "skin", rarity: "common", price: 800, art: "items/gorgrath-war-paint.jpg", blurb: "Ash, ochre, and a handprint across the brow.", attack: 0, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "grog" },
  { id: "bone-crown-shaman", name: "Bone-Crown Shaman", kind: "skin", rarity: "rare", price: 1500, art: "items/bone-crown-shaman.jpg", blurb: "Mog'Dura's crown. It clicks when the wind is wrong.", attack: 0, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "grog" },
  { id: "scrap-tyrant-plate", name: "Scrap-Tyrant Plate", kind: "skin", rarity: "uncommon", price: 1200, art: "items/scrap-tyrant-plate.jpg", blurb: "Road signs, chain, and a chest plate that used to be a hopper.", attack: 0, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "grog" },
  { id: "raven-of-nash", name: "Raven of Nash", kind: "longship", rarity: "rare", price: 1200, art: "items/raven-of-nash.jpg", blurb: "Black sail, raven prow. A Nash ship for the Seaway.", attack: 0, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0.12, side: "nash" },
  { id: "wolf-prowed-drakkar", name: "Wolf-Prowed Drakkar", kind: "longship", rarity: "uncommon", price: 800, art: "items/wolf-prowed-drakkar.jpg", blurb: "A wolf at the stem. Fast along the north shore.", attack: 0, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0.08, side: "either" },
  { id: "gorgrath-war-hulk", name: "Gorgrath's War Hulk", kind: "longship", rarity: "rare", price: 1500, art: "items/gorgrath-war-hulk.jpg", blurb: "Scrap, skulls, and a ram that was once a bridge pier.", attack: 0, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0.16, side: "grog" },
  { id: "ash-wood-hand-axe", name: "Ash-Wood Hand Axe", kind: "weapon", rarity: "common", price: 500, art: "items/ash-wood-hand-axe.jpg", blurb: "A working axe. Ash haft, honest edge.", attack: 6, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "either" },
  { id: "scrap-choppa", name: "Scrap Choppa", kind: "weapon", rarity: "common", price: 500, art: "items/scrap-choppa.jpg", blurb: "A jagged Grog axe beaten out of a ploughshare.", attack: 8, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "grog" },
  { id: "sky-piercer", name: "Sky-Piercer", kind: "weapon", rarity: "uncommon", price: 800, art: "items/sky-piercer.jpg", blurb: "A spear balanced for the throw and the brace.", attack: 7, defense: 4, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "nash" },
  { id: "bone-howl-bow", name: "Bone-Howl Bow", kind: "weapon", rarity: "uncommon", price: 800, art: "items/bone-howl-bow.jpg", blurb: "Laminated bone and sinew. It hums before the shot.", attack: 10, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "either" },
  { id: "hall-breaker", name: "Hall-Breaker", kind: "weapon", rarity: "rare", price: 1200, art: "items/hall-breaker.jpg", blurb: "A bearded axe for doors, shields, and arguments.", attack: 12, defense: 2, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "nash" },
  { id: "storm-bit-staff", name: "Storm-Bit Staff", kind: "weapon", rarity: "rare", price: 1200, art: "items/storm-bit-staff.jpg", blurb: "Area's pattern. The head bites like weather.", attack: 14, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "nash" },
  { id: "jarls-due", name: "Jarl's Due", kind: "weapon", rarity: "rare", price: 1200, art: "items/jarls-due.jpg", blurb: "Alain's Dane axe, inlaid and heavy.", attack: 13, defense: 3, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "nash" },
  { id: "skullsplitter-cleaver", name: "Skullsplitter Cleaver", kind: "weapon", rarity: "legendary", price: 1500, art: "items/skullsplitter-cleaver.jpg", blurb: "Gorgrath's cleaver. The name is not a metaphor.", attack: 16, defense: 0, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "grog" },
  { id: "grimtusk-war-maul", name: "Grimtusk War Maul", kind: "weapon", rarity: "legendary", price: 1500, art: "items/grimtusk-war-maul.jpg", blurb: "A smith's hammer scaled up until it became a weapon.", attack: 12, defense: 6, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "grog" },
  { id: "mogduras-skull-staff", name: "Mog'Dura's Skull Staff", kind: "weapon", rarity: "legendary", price: 1500, art: "items/mogduras-skull-staff.jpg", blurb: "A staff that whispers the names of the unwary.", attack: 11, defense: 4, heal: 0, buffAttack: 0, buffDefense: 0, raid: 0, side: "grog" },
  { id: "field-poultice", name: "Field Poultice", kind: "potion", rarity: "common", price: 200, art: "items/field-poultice.jpg", blurb: "Linen, yarrow, and pressure. Stops a march from ending.", attack: 0, defense: 0, heal: 40, buffAttack: 0, buffDefense: 0, raid: 0, side: "either" },
  { id: "annas-healing-draught", name: "Anna's Healing Draught", kind: "potion", rarity: "uncommon", price: 500, art: "items/annas-healing-draught.jpg", blurb: "Gold in the bottle. Anna's recipe, sweet and strong.", attack: 0, defense: 0, heal: 85, buffAttack: 0, buffDefense: 0, raid: 0, side: "nash" },
  { id: "berserker-mead", name: "Berserker Mead", kind: "potion", rarity: "uncommon", price: 500, art: "items/berserker-mead.jpg", blurb: "A horn of mead that makes the next fight louder.", attack: 0, defense: 0, heal: 20, buffAttack: 0.15, buffDefense: 0, raid: 0, side: "either" },
  { id: "rune-ward-tonic", name: "Rune Ward Tonic", kind: "potion", rarity: "uncommon", price: 500, art: "items/rune-ward-tonic.jpg", blurb: "Bitter. The next blows land lighter.", attack: 0, defense: 0, heal: 15, buffAttack: 0, buffDefense: 0.2, raid: 0, side: "nash" },
  { id: "mogduras-bloodrite", name: "Mog'Dura's Bloodrite", kind: "potion", rarity: "rare", price: 800, art: "items/mogduras-bloodrite.jpg", blurb: "Dark, warm, and not to be asked about.", attack: 0, defense: 0, heal: 50, buffAttack: 0.12, buffDefense: 0, raid: 0, side: "grog" },
  { id: "ironhide-draught", name: "Ironhide Draught", kind: "potion", rarity: "rare", price: 800, art: "items/ironhide-draught.jpg", blurb: "Tastes like a nail. Skin takes the next fight better.", attack: 0, defense: 0, heal: 25, buffAttack: 0, buffDefense: 0.28, raid: 0, side: "either" },
]

export const towns: TownDef[] = [
  { id: "chesterville", name: "Chesterville", lat: 45.10243, lng: -75.22892, kind: "village", blurb: "Home of the saga. The South Nation runs past the fairgrounds, and the roads leave in every direction.", shore: false, threat: 1 },
  { id: "winchester", name: "Winchester", lat: 45.09288, lng: -75.35299, kind: "town", blurb: "North Dundas town. Ralph Nash keeps the old oath here with the great axe.", guardianId: "ralph", shore: false, threat: 1 },
  { id: "morewood", name: "Morewood", lat: 45.17749, lng: -75.28544, kind: "village", blurb: "A straight village north of the Winchester road. Riders see you coming.", shore: false, threat: 1 },
  { id: "hallville", name: "Hallville", lat: 45.06178, lng: -75.51759, kind: "hamlet", blurb: "A crossroads west of Winchester, on the way to Kemptville.", shore: false, threat: 1 },
  { id: "south-mountain", name: "South Mountain", lat: 44.99027, lng: -75.45126, kind: "village", blurb: "High farms in North Dundas. Sharga Blackfang hunts the fencelines.", guardianId: "sharga", shore: false, threat: 1 },
  { id: "inkerman", name: "Inkerman", lat: 45.03652, lng: -75.39475, kind: "hamlet", blurb: "A hamlet on the flats between Winchester and the mountain.", shore: false, threat: 1 },
  { id: "winchester-springs", name: "Winchester Springs", lat: 45.03233, lng: -75.29346, kind: "hamlet", blurb: "Springs and a short street south of Chesterville.", shore: false, threat: 1 },
  { id: "dunbar", name: "Dunbar", lat: 45.04488, lng: -75.22783, kind: "hamlet", blurb: "A South Dundas hamlet a few minutes south of Chesterville.", shore: false, threat: 1 },
  { id: "williamsburg", name: "Williamsburg", lat: 44.97486, lng: -75.24367, kind: "village", blurb: "The village on County Road 31 before the land drops to the Seaway.", shore: false, threat: 1 },
  { id: "morrisburg", name: "Morrisburg", lat: 44.8977, lng: -75.18295, kind: "town", blurb: "Seaway town. Donna Nash reads the water here.", guardianId: "donna", shore: true, threat: 1 },
  { id: "iroquois", name: "Iroquois", lat: 44.84928, lng: -75.31511, kind: "village", blurb: "A village the Seaway moved inland. Kali Nash holds the new shore.", guardianId: "kali", shore: true, threat: 1 },
  { id: "cardinal", name: "Cardinal", lat: 44.7877, lng: -75.3801, kind: "village", blurb: "Mill village on the river. Brakka Ironhide does not step aside.", guardianId: "brakka", shore: true, threat: 1 },
  { id: "johnstown", name: "Johnstown", lat: 44.74462, lng: -75.46529, kind: "hamlet", blurb: "A hamlet by the bridge ramps, where ships can smell a shore party.", shore: true, threat: 1 },
  { id: "prescott", name: "Prescott", lat: 44.71841, lng: -75.51917, kind: "town", blurb: "River town with a fort in its memory. Gavin Nash drills on the green.", guardianId: "gavin", shore: true, threat: 1 },
  { id: "maitland", name: "Maitland", lat: 44.6361, lng: -75.6119, kind: "village", blurb: "Between Brockville and Prescott, close enough to hear freighters.", shore: true, threat: 1 },
  { id: "brockville", name: "Brockville", lat: 44.60392, lng: -75.70168, kind: "town", blurb: "Where Highway 2 meets the islands. Jesse Nash raids from this shore.", guardianId: "jesse", shore: true, threat: 1 },
  { id: "spencerville", name: "Spencerville", lat: 44.8433, lng: -75.54637, kind: "village", blurb: "Inland from the river. Grimtusk's forge smells of coal and scale.", guardianId: "grimtusk", shore: false, threat: 1 },
  { id: "kemptville", name: "Kemptville", lat: 45.01542, lng: -75.64457, kind: "town", blurb: "Rideau town. Landin Nash is the shield at the south gate.", guardianId: "landin", shore: false, threat: 1 },
  { id: "oxford-mills", name: "Oxford Mills", lat: 44.96544, lng: -75.67816, kind: "village", blurb: "Stone mills on a south branch. The wheel still has a voice.", shore: false, threat: 1 },
  { id: "burritts-rapids", name: "Burritts Rapids", lat: 44.98072, lng: -75.79703, kind: "hamlet", blurb: "A stone lock village. The rapids talk all night.", shore: false, threat: 1 },
  { id: "merrickville", name: "Merrickville", lat: 44.91611, lng: -75.83693, kind: "village", blurb: "Lock town on the Rideau. James Nash hammers war-iron here.", guardianId: "james", shore: false, threat: 1 },
  { id: "smiths-falls", name: "Smiths Falls", lat: 44.90133, lng: -76.02121, kind: "town", blurb: "Falls, mills, and a railway bridge. A rich town if you can hold it.", shore: false, threat: 1.1 },
  { id: "finch", name: "Finch", lat: 45.14322, lng: -75.08493, kind: "village", blurb: "North Stormont. Haydin Nash hunts the bush lots east of the Nation.", guardianId: "haydin", shore: false, threat: 1 },
  { id: "berwick", name: "Berwick", lat: 45.1757, lng: -75.10904, kind: "hamlet", blurb: "A short village east of Chesterville. Good ground for a first claim.", shore: false, threat: 1 },
  { id: "crysler", name: "Crysler", lat: 45.21848, lng: -75.15275, kind: "village", blurb: "North of the Nation, where the road bends toward Casselman.", shore: false, threat: 1 },
  { id: "newington", name: "Newington", lat: 45.11659, lng: -75.0137, kind: "village", blurb: "South Stormont village between the heartland and the Seaway.", shore: false, threat: 1 },
  { id: "avonmore", name: "Avonmore", lat: 45.17202, lng: -74.96707, kind: "village", blurb: "Western door of Glengarry. Farms and a long main street.", shore: false, threat: 1 },
  { id: "monkland", name: "Monkland", lat: 45.1958, lng: -74.87662, kind: "village", blurb: "On the road to Maxville. You can hear a fair from here on the right weekend.", shore: false, threat: 1 },
  { id: "moose-creek", name: "Moose Creek", lat: 45.26211, lng: -74.96973, kind: "village", blurb: "Creek, concession roads, and a village that minds its own until you arrive.", shore: false, threat: 1 },
  { id: "maxville", name: "Maxville", lat: 45.28859, lng: -74.85549, kind: "village", blurb: "Glengarry village. Lana Nash keeps a bow for the games and the wars.", guardianId: "lana", shore: false, threat: 1 },
  { id: "apple-hill", name: "Apple Hill", lat: 45.22092, lng: -74.77087, kind: "hamlet", blurb: "Orchards and a short street east of Monkland.", shore: false, threat: 1 },
  { id: "greenfield", name: "Greenfield", lat: 45.29507, lng: -74.76335, kind: "hamlet", blurb: "A North Glengarry hamlet between Maxville and Alexandria.", shore: false, threat: 1 },
  { id: "alexandria", name: "Alexandria", lat: 45.31794, lng: -74.63976, kind: "town", blurb: "Glengarry's town. Jayden Nash scouts the eastern roads.", guardianId: "jayden", shore: false, threat: 1 },
  { id: "lancaster", name: "Lancaster", lat: 45.14127, lng: -74.49995, kind: "village", blurb: "Last village before Quebec, with the river at its shoulder.", shore: true, threat: 1 },
  { id: "williamstown", name: "Williamstown", lat: 45.14667, lng: -74.57956, kind: "village", blurb: "A loyalist village in South Glengarry with a long memory.", shore: false, threat: 1 },
  { id: "martintown", name: "Martintown", lat: 45.1546, lng: -74.7106, kind: "village", blurb: "Mill village on the Raisin, south of the highway.", shore: false, threat: 1 },
  { id: "st-andrews", name: "St. Andrews West", lat: 45.09615, lng: -74.79694, kind: "village", blurb: "Just north of Cornwall. Church, side roads, and the city's weather.", shore: false, threat: 1 },
  { id: "cornwall", name: "Cornwall", lat: 45.047, lng: -74.73338, kind: "city", blurb: "The eastern city on the Seaway. Billy Nash fights in its streets.", guardianId: "billy", shore: true, threat: 1.25 },
  { id: "ingleside", name: "Ingleside", lat: 44.99549, lng: -74.98674, kind: "town", blurb: "A Seaway town raised above the flood. Zug the Gutripper likes the ditches.", guardianId: "zug", shore: true, threat: 1 },
  { id: "long-sault", name: "Long Sault", lat: 45.02831, lng: -74.89647, kind: "village", blurb: "Parkway and islands. Urzog the Mountain is the boss of this shore.", guardianId: "urzog", shore: true, threat: 1.75 },
  { id: "vernon", name: "Vernon", lat: 45.16089, lng: -75.46203, kind: "village", blurb: "Osgoode country. Krull Wolfrider runs the open concessions.", guardianId: "krull", shore: false, threat: 1 },
  { id: "kenmore", name: "Kenmore", lat: 45.22789, lng: -75.41453, kind: "village", blurb: "North of Vernon. The ride to the city starts to shorten.", shore: false, threat: 1 },
  { id: "metcalfe", name: "Metcalfe", lat: 45.23622, lng: -75.47264, kind: "town", blurb: "Osgoode's town. Barns, a main street, and Ottawa weather.", shore: false, threat: 1 },
  { id: "greely", name: "Greely", lat: 45.2627, lng: -75.56003, kind: "village", blurb: "South of the city. Busy by day, a dark grid at night.", shore: false, threat: 1 },
  { id: "osgoode", name: "Osgoode", lat: 45.14088, lng: -75.61546, kind: "village", blurb: "A village west of Vernon on the country roads.", shore: false, threat: 1 },
  { id: "manotick", name: "Manotick", lat: 45.22644, lng: -75.68606, kind: "village", blurb: "Mill village on the Rideau. Emma Nash keeps a spear by the dam.", guardianId: "emma", shore: false, threat: 1 },
  { id: "north-gower", name: "North Gower", lat: 45.13326, lng: -75.71653, kind: "village", blurb: "Stevens Creek and a main street west of the Rideau.", shore: false, threat: 1 },
  { id: "richmond", name: "Richmond", lat: 45.19433, lng: -75.83863, kind: "village", blurb: "At the city's west edge, on the road toward the ridges.", shore: false, threat: 1 },
  { id: "ottawa", name: "Ottawa", lat: 45.42088, lng: -75.69011, kind: "city", blurb: "The capital, where the rivers meet. Area Nash calls the storm down.", guardianId: "area", shore: false, threat: 1.35 },
  { id: "embrun", name: "Embrun", lat: 45.2742, lng: -75.27491, kind: "town", blurb: "Russell's busiest town. Anna Nash binds wounds on a quiet side street.", guardianId: "anna", shore: false, threat: 1 },
  { id: "russell", name: "Russell", lat: 45.25732, lng: -75.35833, kind: "village", blurb: "The village the township is named for. Alain Nash is champion here.", guardianId: "alain", shore: false, threat: 1 },
  { id: "casselman", name: "Casselman", lat: 45.31353, lng: -75.08675, kind: "town", blurb: "A town on the South Nation. Mog'Dura keeps a hut on the edge.", guardianId: "mogdura", shore: false, threat: 1 },
  { id: "navan", name: "Navan", lat: 45.42111, lng: -75.42595, kind: "village", blurb: "East of Ottawa, where the subdivisions thin into fields.", shore: false, threat: 1.05 },
]

export const rivals: RivalDef[] = [
  { id: "ai-harald", name: "Jarl Harald", title: "Iron-Oath", faction: "viking", townId: "winchester", holds: ["winchester", "morewood"], gold: 720, wins: 7, raids: 1, hall: 2, forge: 1, walls: 2, dock: 0, ai: { attack: 156, defense: 148, hp: 430 }, north: 260 },
  { id: "ai-sigrid", name: "Sigrid of the Rideau", title: "Shieldmaiden", faction: "viking", townId: "kemptville", holds: ["kemptville", "hallville", "oxford-mills"], gold: 640, wins: 5, raids: 0, hall: 2, forge: 1, walls: 3, dock: 0, ai: { attack: 132, defense: 160, hp: 400 }, north: 220 },
  { id: "ai-bogra", name: "Bogra Gutlash", title: "River boss", faction: "grog", townId: "morrisburg", holds: ["morrisburg", "iroquois", "williamsburg"], gold: 810, wins: 8, raids: 4, hall: 2, forge: 2, walls: 1, dock: 2, ai: { attack: 176, defense: 124, hp: 440 }, north: 200 },
  { id: "ai-rixa", name: "Rixa Blackpaddle", title: "Shore raider", faction: "grog", townId: "prescott", holds: ["prescott", "cardinal", "johnstown"], gold: 560, wins: 4, raids: 5, hall: 1, forge: 1, walls: 1, dock: 2, ai: { attack: 150, defense: 112, hp: 360 }, north: 180 },
  { id: "ai-torvin", name: "Old Torvin", title: "Hedge jarl", faction: "viking", townId: "embrun", holds: ["embrun", "casselman"], gold: 480, wins: 3, raids: 0, hall: 1, forge: 1, walls: 1, dock: 0, ai: { attack: 118, defense: 108, hp: 300 }, north: 200 },
  { id: "ai-kin", name: "Cornwall Kin", title: "City warband", faction: "grog", townId: "cornwall", holds: ["cornwall", "long-sault"], gold: 980, wins: 9, raids: 6, hall: 3, forge: 2, walls: 2, dock: 3, ai: { attack: 198, defense: 160, hp: 520 }, north: 280 },
]

export const TOWN_POWER: Record<TownKind, { wealth: number; income: number; attack: number; defense: number; hp: number }> = {
  hamlet: { wealth: 50, income: 2, attack: 34, defense: 26, hp: 110 },
  village: { wealth: 78, income: 3, attack: 48, defense: 34, hp: 150 },
  town: { wealth: 120, income: 5, attack: 64, defense: 48, hp: 205 },
  city: { wealth: 190, income: 8, attack: 84, defense: 64, hp: 280 },
}

export const BUILDINGS: Record<BuildingId, { name: string; costs: number[]; text: string }> = {
  hall: { name: "Great Hall", costs: [120, 280, 560], text: "The heart of the settlement. Each level marches another hero and a larger infantry levy. At level 2, with a forge, you can raise a monster." },
  forge: { name: "Forge", costs: [90, 210, 420], text: "Unlocks archers. Crafts axes, bows, spears, and mail from gold. At level 2, with the hall, the yard can hold a monster." },
  walls: { name: "Walls and towers", costs: [110, 260, 500], text: "A palisade, then towers that shoot during a siege, then a keep. Defense when the war comes to your town or your hall." },
  dock: { name: "Longship Dock", costs: [150, 340, 640], text: "Unlocks cavalry and the longship. Shore towns can be raided. Higher docks hit harder from the water." },
  yard: { name: "Muster yard", costs: [80, 180, 360], text: "Where the companies drill. Each level raises the cap on infantry, bows, and riders. Level 2 can raise riders without a dock." },
  shrine: { name: "Shrine", costs: [100, 220, 440], text: "Ancestor stones for the Nash, a bone pit for the Grogs. Level 1 lets you raise a monster. Higher levels harden the army in a siege." },
}

export const PASS_TIERS: { xp: number; freeGold: number; premItem?: string; premGold?: number }[] = [
  { xp: 60, freeGold: 40, premItem: "field-poultice" },
  { xp: 140, freeGold: 60, premItem: "berserker-mead" },
  { xp: 240, freeGold: 80, premItem: "ash-wood-hand-axe" },
  { xp: 360, freeGold: 100, premItem: "rune-ward-tonic" },
  { xp: 520, freeGold: 120, premItem: "trail-worn-clan-leather" },
  { xp: 720, freeGold: 150, premGold: 200 },
  { xp: 960, freeGold: 160, premItem: "hall-breaker" },
  { xp: 1240, freeGold: 180, premItem: "ironhide-draught" },
  { xp: 1560, freeGold: 220, premItem: "wolf-prowed-drakkar" },
  { xp: 1920, freeGold: 320, premItem: "gold-wing-valkyrie" },
]

export const OFFERS = [
  { sku: "pack-800", name: "800 Nash Points", kind: "pack" as const, np: 800, usd: 8.99, blurb: "A fist of points for a potion and change." },
  { sku: "pack-2400", name: "2,400 Nash Points", kind: "pack" as const, np: 2400, usd: 22.99, blurb: "A war chest. A rare weapon, or a skin and a ship." },
  { sku: "pack-4500", name: "4,500 Nash Points", kind: "pack" as const, np: 4500, usd: 36.99, blurb: "Enough for a longship and a cloak." },
  { sku: "pack-12500", name: "12,500 Nash Points", kind: "pack" as const, np: 12500, usd: 89.99, blurb: "The jarl's hoard. The whole armory notices." },
  { sku: "battle-pass", name: "Seaway Battle Pass", kind: "pass" as const, np: 800, usd: 0, blurb: "Optional extra track. Playing already pays the free track." },
]

export const START_TOWNS = ["chesterville", "morrisburg", "cornwall"] as const

export function championById(id: string): ChampionDef | undefined {
  return champions.find((c) => c.id === id)
}

export function itemById(id: string): ItemDef | undefined {
  return items.find((i) => i.id === id)
}

export function townById(id: string): TownDef | undefined {
  return towns.find((t) => t.id === id)
}

export function warbandCap(hall: number): number {
  return 3 + hall
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function monthlyShop(now = Date.now()): { key: number; label: string; nextLabel: string; ids: string[]; discount: number } {
  const d = new Date(now)
  const key = d.getUTCFullYear() * 12 + d.getUTCMonth()
  const label = d.toLocaleString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" })
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  const nextLabel = next.toLocaleString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" })
  const pool = items.filter((i) => i.kind !== "potion").map((i) => i.id)
  const rng = mulberry32(key + 17)
  const ids: string[] = []
  const bag = [...pool]
  while (ids.length < 6 && bag.length) {
    const i = Math.floor(rng() * bag.length)
    ids.push(bag.splice(i, 1)[0])
  }
  return { key, label, nextLabel, ids, discount: 0.2 }
}

export function itemPrice(id: string, now = Date.now()): number {
  const item = itemById(id)
  if (!item) return 0
  const shop = monthlyShop(now)
  if (shop.ids.includes(id)) return Math.max(1, Math.round(item.price * (1 - shop.discount)))
  return item.price
}

export function buildingWorth(p: { hall: number; forge: number; walls: number; dock: number; yard?: number; shrine?: number }): number {
  let worth = 0
  for (const key of ["hall", "forge", "walls", "dock", "yard", "shrine"] as const) {
    for (let i = 0; i < (p[key] ?? 0); i++) worth += BUILDINGS[key].costs[i] ?? 0
  }
  return worth
}
