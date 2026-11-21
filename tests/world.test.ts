import { champions, items, towns } from "../src/shared/catalog.ts"
import { nearestPlace, searchPlacesLocal } from "../server/places.ts"
import { counter } from "../src/shared/army.ts"
import { usualLimit } from "../src/shared/limits.ts"
import { reportSpeech } from "../src/shared/reports.ts"
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
  const police = parseCommand("hey valhalla police", true)
  assert(police?.type === "road" && police.kind === "police", "police report")
  const wizard = parseCommand("hey valhalla evil wizard", true)
  assert(wizard?.type === "road" && wizard.kind === "police", "wizard is police")
  const carriage = parseCommand("horse and carriage", false)
  assert(carriage?.type === "road" && carriage.kind === "stopped", "carriage is a stopped vehicle")
  const warning = reportSpeech("police", 800)
  assert(warning.includes("evil wizard") && warning.includes("Police"), warning)
  assert(parseCommand("navigate to ottawa", false)?.type === "navigate", "navigate")
  assert(usualLimit("County Road 31").kmh === 80, "county limit")
  assert(usualLimit("Queen Street").kmh === 50, "street limit")
  assert(usualLimit("Highway 417").kmh === 100, "highway limit")
  assert(counter("infantry", "cavalry") > 1, "spears hold riders")
  assert(counter("cavalry", "archer") > 1, "riders catch bows")
  assert(counter("archer", "infantry") > 1, "bows thin spears")
  assert(counter("infantry", "archer") < 1, "spears suffer shafts")
  assert(parseCommand("raise archers", false)?.type === "raise", "raise archers")
  assert(parseCommand("craft a bow", false)?.type === "craft", "craft a bow")

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
  assert(sam.companies.some((c) => c.cls === "infantry" && c.strength > 0), "starts with infantry")
  const seen = game.sight(a.playerId!, "chesterville")
  assert(seen.event?.text.includes("Chesterville"), seen.error ?? "first sight")
  const againSight = game.sight(a.playerId!, "chesterville")
  assert(!againSight.event && !againSight.error, "sight once")
  const yard = game.build(a.playerId!, "yard")
  assert(!yard.error, yard.error ?? "yard")
  assert(game.raise(a.playerId!, "archer").error, "archers need the forge")
  assert(game.craft(a.playerId!, "bow").error, "the forge must exist before a bow")

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
  const oath = game.buy(a.playerId!, "sub-month")
  assert(oath.error?.includes("free"), oath.error ?? "subscription must be gone")
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
  assert(world.towns.length >= towns.length, "public towns")
  assert(world.ships.length >= 4, "ships include the player's")
  assert(world.players.some((p) => p.name === "Jarl Harald"), "ai rivals")
  const scoutGold = game.privateYou(a.playerId!)!.gold
  const marked = game.fileReport(a.playerId!, "police")
  assert(marked.event?.text.includes("Police"), marked.error ?? "report")
  assert(game.privateYou(a.playerId!)!.gold > scoutGold, "scout gold")
  assert(game.publicWorld().reports.some((r) => r.type === "police"), "shared report")
  assert(game.publicWorld().board.scouts[0], "scout board")
  assert(game.publicWorld().board.live.some((p) => p.name === "Sam Nash"), "live players")
  const againMark = game.fileReport(a.playerId!, "police")
  assert(againMark.error, "duplicate report")
  const distant = game.confirmReport(b.playerId!, game.publicWorld().reports[0]!.id, true)
  assert(distant.error, "too far to confirm")

  const berwick = game.march(a.playerId!, { kind: "warband", townId: "berwick" })
  assert(!berwick.error, berwick.error ?? "march")
  assert(game.privateYou(a.playerId!)!.marches.length === 1, "one march")
  const builtQuest = game.privateYou(a.playerId!)!.quests.find((q) => q.kind === "build")
  assert(builtQuest && (builtQuest.claimed || builtQuest.progress >= 1), "build quest")
  let arrived = false
  for (let i = 0; i < 8; i++) {
    const ev = game.tick(Date.now() + (i + 1) * 60000)
    if (ev.some((e) => e.event.text.toLowerCase().includes("berwick"))) arrived = true
  }
  assert(arrived, "war band reached Berwick")
  assert(!game.privateYou(a.playerId!)!.marches.length, "march cleared")

  const dunbar = towns.find((t) => t.id === "dunbar")!
  game.setPos(a.playerId!, { lat: dunbar.lat, lng: dunbar.lng, heading: 0, speed: 0 })
  const stood = game.claim(a.playerId!, "dunbar")
  assert(stood.result?.summary.includes("Double gold"), stood.result?.summary ?? stood.error ?? "presence")

  const idle = game.collectIdle(a.playerId!, Date.now() + 5 * 60_000)
  assert(idle.event?.text.includes("hearth"), idle.error ?? "idle")
  const moved = game.moveHome(a.playerId!, "crysler")
  assert(moved.error?.includes("month"), moved.error ?? "move cooldown")

  const code = game.privateYou(a.playerId!)!.inviteCode
  const beforeHost = game.privateYou(a.playerId!)!.gold
  const beforeGuest = game.privateYou(b.playerId!)!.gold
  const link = game.befriend(b.playerId!, code)
  assert(!link.error, link.error ?? "befriend")
  assert(game.privateYou(a.playerId!)!.gold === beforeHost + 60, "host welcome")
  assert(game.privateYou(b.playerId!)!.gold === beforeGuest + 60, "guest welcome")
  assert(game.privateYou(a.playerId!)!.friendIds.includes(b.playerId!), "friends")
  const againFriend = game.befriend(b.playerId!, code)
  assert(againFriend.event && game.privateYou(a.playerId!)!.gold === beforeHost + 60, "welcome once")

  const chest = nearestPlace(45.10243, -75.22892, 20000)
  assert(chest?.name === "Chesterville", chest?.name ?? "chesterville")
  const vancouver = nearestPlace(49.24966, -123.11934, 30000)
  assert(vancouver?.name === "Vancouver", vancouver?.name ?? "vancouver")
  const dallas = nearestPlace(32.78306, -96.80667, 30000)
  assert(dallas?.name === "Dallas" && dallas.country === "US", dallas?.name ?? "dallas")
  const lubec = searchPlacesLocal("Lubec", 3).find((p) => p.country === "US")
  assert(lubec && Math.abs(lubec.lat - 44.86) < 0.2, lubec?.name ?? "lubec")
  const founded = createGame(undefined, () => 0.5)
  const traveler = founded.join({ name: "Ada Nash" })
  const dallasHall = founded.choose(traveler.playerId!, { faction: "viking", placeId: dallas!.id })
  assert(!dallasHall.error, dallasHall.error ?? "dallas hall")
  assert(founded.privateYou(traveler.playerId!)!.homePlaceName === "Dallas", "home is Dallas")

  const road = createGame(undefined, () => 0.1)
  const rider = road.join({ name: "Bram" })
  road.choose(rider.playerId!, { faction: "viking", startTownId: "chesterville" })
  const home = road.privateYou(rider.playerId!)!
  const steps = road.setPos(rider.playerId!, { lat: home.lat + 0.03, lng: home.lng, heading: 10, speed: 80 })
  assert(steps.some((e) => e.text.includes("Adventure")), "adventure starts")
  let told = false
  let lat = home.lat
  for (let i = 0; i < 12; i++) {
    lat += 0.01
    const ev = road.setPos(rider.playerId!, { lat, lng: home.lng, heading: 10, speed: 80 })
    if (ev.some((e) => /ambush|beast|treasure|war band|mead|home/i.test(e.text))) told = true
  }
  assert(told, "road encounter")

  console.log("world tests passed")
}

const isMain = process.argv[1]?.includes("world.test")
if (isMain) runWorld().catch((err) => { console.error(err); process.exit(1) })
