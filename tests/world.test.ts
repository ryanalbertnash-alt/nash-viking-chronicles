import { champions, items, towns } from "../src/shared/catalog.ts"
import { usualLimit } from "../src/shared/limits.ts"
import { parseCommand } from "../src/shared/voice.ts"
import { createGame } from "../server/world.ts"

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

export async function runWorld() {
  assert(champions.length === 24, "24 champions")
  assert(items.length === 27, "27 shop items")
  assert(towns.length >= 40, "towns")
  assert(new Set(towns.map((t) => t.id)).size === towns.length, "unique towns")
  for (const town of towns) {
    if (!town.guardianId) continue
    assert(champions.some((c) => c.id === town.guardianId), town.guardianId)
  }
  const arts = new Set(champions.map((c) => c.id))
  assert(arts.size === 24, "champion ids")

  const wake = parseCommand("hey val halla attack winchester", true)
  assert(wake?.type === "attack" && wake.target?.includes("winchester"), "wake attack")
  const button = parseCommand("recruit", false)
  assert(button?.type === "recruit", "recruit")
  assert(parseCommand("build the longship dock", false)?.type === "build", "dock before raid parse")
  assert(parseCommand("the radio said attack", true) === null, "no wake no attack")
  assert(parseCommand("hey valhalla police", true)?.type === "road", "police report")
  assert(parseCommand("navigate to ottawa", false)?.type === "navigate", "navigate")
  assert(usualLimit("County Road 31").kmh === 80, "county limit")
  assert(usualLimit("Queen Street").kmh === 50, "street limit")
  assert(usualLimit("Highway 417").kmh === 100, "highway limit")

  const game = createGame(undefined, () => 0.5)
  const a = game.join({ name: "Sam Nash" })
  const b = game.join({ name: "Pat" })
  assert(a.playerId && a.token, "join a")
  assert(b.playerId, "join b")
  const again = game.join({ name: "Sam Nash" })
  assert(again.error, "name taken")
  const you = game.privateYou(a.playerId!)
  assert(you?.recovery, "recovery")
  const back = game.join({ name: "Sam Nash", recovery: you!.recovery! })
  assert(back.playerId === a.playerId, "recovery resumes")

  const chosen = game.choose(a.playerId!, { faction: "viking", startTownId: "chesterville" })
  assert(!chosen.error, chosen.error ?? "choose")
  game.choose(b.playerId!, { faction: "grog", startTownId: "morrisburg" })
  const sam = game.privateYou(a.playerId!)!
  assert(sam.champions[0].name === "Ryan Nash", "starter")
  assert(sam.np === 250 && sam.gold === 180, "starting purse")
  assert(sam.inventory.some((i) => i.id === "field-poultice"), "poultice")

  const finch = towns.find((t) => t.id === "finch")!
  game.setPos(a.playerId!, { lat: finch.lat, lng: finch.lng, heading: 0, speed: 0 })
  const far = game.claim(a.playerId!, "ottawa")
  assert(far.error?.includes("Ottawa"), far.error ?? "far claim should fail")
  const claim = game.claim(a.playerId!, "finch")
  assert(claim.result?.win, claim.result?.summary ?? claim.error ?? "finch should fall")
  assert(game.privateYou(a.playerId!)!.townIds.includes("finch"), "owns finch")
  const recruit = game.recruit(a.playerId!, "finch")
  assert(recruit.event?.text.includes("Haydin"), recruit.error ?? recruit.event?.text ?? "recruit")
  const stolen = game.recruit(b.playerId!, "finch")
  game.setPos(b.playerId!, { lat: finch.lat, lng: finch.lng, heading: 0, speed: 0 })
  const stolen2 = game.recruit(b.playerId!, "finch")
  assert(stolen.error || stolen2.error, "second recruit fails")

  const pat = game.privateYou(b.playerId!)!
  game.setPos(a.playerId!, { lat: pat.homeLat, lng: pat.homeLng, heading: 10, speed: 0 })
  const raidHall = game.attackPlayer(a.playerId!, b.playerId!)
  assert(raidHall.result, raidHall.error ?? "village battle")
  const afterA = game.privateYou(a.playerId!)!
  const afterB = game.privateYou(b.playerId!)!
  assert(afterA.wins + afterA.losses >= 2, "sam fought")
  assert(afterB.wins + afterB.losses >= 1, "pat was hit")

  const broke = game.buy(a.playerId!, "gold-wing-valkyrie")
  assert(broke.error, "cannot afford skin yet")
  const pack = game.buy(a.playerId!, "pack-2400")
  assert(pack.event?.text.includes("Nothing was charged"), "demo pack")
  const skin = game.buy(a.playerId!, "gold-wing-valkyrie")
  assert(!skin.error, skin.error ?? "bought skin")
  assert(game.privateYou(a.playerId!)!.skinId === "gold-wing-valkyrie", "wearing skin")

  const hurt = game.privateYou(a.playerId!)!
  const before = hurt.champions.reduce((s, c) => s + c.hp, 0)
  game.drinkPotion(a.playerId!, "field-poultice")
  const after = game.privateYou(a.playerId!)!.champions.reduce((s, c) => s + c.hp, 0)
  assert(after >= before, "potion does not harm")

  const dock = game.build(a.playerId!, "dock")
  assert(!dock.error, dock.error ?? "dock")
  const raid = game.raid(a.playerId!, "lancaster")
  assert(!raid.error, raid.error ?? "raid order")
  let landed = false
  for (let i = 0; i < 40; i++) {
    const ev = game.tick(Date.now() + i * 1000)
    if (ev.some((e) => e.event.text.toLowerCase().includes("lancaster"))) landed = true
  }
  assert(landed, "longship reached Lancaster")
  const board = game.publicWorld().board
  assert(board.clans.viking + board.clans.grog > 0, "clan score")
  assert(board.warriors.length > 0, "warriors")
  const world = game.publicWorld()
  assert(world.towns.length === towns.length, "public towns")
  assert(world.ships.length >= 4, "ships include the player's")
  assert(world.players.some((p) => p.name === "Jarl Harald"), "ai rivals")
  const scoutGold = game.privateYou(a.playerId!)!.gold
  const marked = game.fileReport(a.playerId!, "police")
  assert(marked.event?.text.includes("Police"), marked.error ?? "report")
  assert(game.privateYou(a.playerId!)!.gold > scoutGold, "scout gold")
  assert(game.publicWorld().reports.some((r) => r.type === "police"), "shared report")
  assert(game.publicWorld().board.scouts[0], "scout board")
  const againMark = game.fileReport(a.playerId!, "police")
  assert(againMark.error, "duplicate report")
  const distant = game.confirmReport(b.playerId!, game.publicWorld().reports[0]!.id, true)
  assert(distant.error, "too far to confirm")

  console.log("world tests passed")
}

const isMain = process.argv[1]?.includes("world.test")
if (isMain) runWorld().catch((err) => { console.error(err); process.exit(1) })
