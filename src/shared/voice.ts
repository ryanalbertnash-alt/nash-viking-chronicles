import type { ReportType } from "./reports.ts"
import type { Stance } from "./types.ts"

export type VoiceCommand =
  | { type: "wake" }
  | { type: "passenger"; on: boolean }
  | { type: "hold" }
  | { type: "ride" }
  | { type: "turn" }
  | { type: "raid"; target?: string }
  | { type: "heal" }
  | { type: "recruit" }
  | { type: "claim" }
  | { type: "status" }
  | { type: "warband" }
  | { type: "shop" }
  | { type: "board" }
  | { type: "build"; part: "hall" | "forge" | "walls" | "dock" }
  | { type: "raise"; cls: "infantry" | "archer" | "cavalry" | "monster" }
  | { type: "craft"; key: string }
  | { type: "mute" }
  | { type: "unmute" }
  | { type: "center" }
  | { type: "rest" }
  | { type: "attack"; stance: Stance; target?: string }
  | { type: "road"; kind: ReportType }
  | { type: "navigate"; target: string }
  | { type: "confirm"; still: boolean }
  | { type: "restock" }
  | { type: "unknown"; heard: string }

export function normalizeSpeech(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\bval\s*halla\b/g, "valhalla")
    .replace(/\bvalhalla\b/g, "valhalla")
    .replace(/\s+/g, " ")
    .trim()
}

export function parseCommand(raw: string, requireWake: boolean): VoiceCommand | null {
  const norm = normalizeSpeech(raw)
  if (!norm) return null
  const at = norm.indexOf("valhalla")
  let body = norm
  if (requireWake) {
    if (at < 0) return null
    body = norm.slice(at + "valhalla".length).trim()
    if (!body) return { type: "wake" }
  } else if (at >= 0) {
    body = norm.slice(at + "valhalla".length).trim() || norm.replace(/\b(hey|ok|okay|hi|yo|oi)\s+valhalla\b/g, "").trim()
    if (!body) return { type: "wake" }
  }
  return parseBody(body)
}

function parseBody(s: string): VoiceCommand {
  const road = roadKind(s)
  if (road) return { type: "road", kind: road }
  if (/\bstill there\b|\byes still\b/.test(s)) return { type: "confirm", still: true }
  if (/\bnot there\b|\bit'?s gone\b|\bno longer there\b/.test(s)) return { type: "confirm", still: false }
  if (/\brestock\b|\btrading post\b|\bfill the satchel\b|\btavern\b/.test(s)) return { type: "restock" }
  if (/\b(navigate|directions|take me)\b/.test(s)) {
    const target = s.replace(/.*\b(?:navigate|directions|take me)\b/, "").replace(/\b(to|towards|toward)\b/g, " ").trim()
    if (target) return { type: "navigate", target }
  }
  if (/passenger/.test(s) && /\b(off|stop|end|disable)\b/.test(s)) return { type: "passenger", on: false }
  if (/\bpassenger\b/.test(s)) return { type: "passenger", on: true }
  if (/\bpull over\b|\bpark\b|\bwhoa\b|\bhold up\b|^stop$|\bpull up\b/.test(s)) return { type: "hold" }
  if (/\bturn around\b|\bgo back\b|\breverse\b/.test(s)) return { type: "turn" }
  if (/\bride on\b|\bdrive\b|\bonward\b|\bresume\b|\blets go\b|\blet's go\b|\bcontinue\b|\btake the road\b/.test(s)) return { type: "ride" }
  if (/\bbuild\b|\braise\b/.test(s) && /\bforge\b/.test(s)) return { type: "build", part: "forge" }
  if (/\bbuild\b|\braise\b/.test(s) && /\bwall/.test(s)) return { type: "build", part: "walls" }
  if (/\bbuild\b|\braise\b/.test(s) && /\bdock\b|\blongship dock\b/.test(s)) return { type: "build", part: "dock" }
  if (/\bbuild\b|\braise\b/.test(s) && /\bhall\b/.test(s)) return { type: "build", part: "hall" }
  if (/\braise\b|\bmuster\b/.test(s) && /\b(archers?|bows?|arrers)\b/.test(s)) return { type: "raise", cls: "archer" }
  if (/\braise\b|\bmuster\b/.test(s) && /\b(rider|riders|cavalry|boar)\b/.test(s)) return { type: "raise", cls: "cavalry" }
  if (/\braise\b|\bmuster\b/.test(s) && /\b(monster|troll|jotun)\b/.test(s)) return { type: "raise", cls: "monster" }
  if (/\braise\b|\bmuster\b/.test(s) && /\b(infantry|spear|huscarl|boyz|shields)\b/.test(s)) return { type: "raise", cls: "infantry" }
  if (/\bcraft\b|\bforge\b/.test(s) && /\b(mail|armor|armour)\b/.test(s)) return { type: "craft", key: "mail" }
  if (/\bcraft\b|\bforge\b/.test(s) && /\b(bow)\b/.test(s)) return { type: "craft", key: "bow" }
  if (/\bcraft\b|\bforge\b/.test(s) && /\b(spear)\b/.test(s)) return { type: "craft", key: "spear" }
  if (/\bcraft\b|\bforge\b/.test(s) && /\b(maul|hammer|heavy)\b/.test(s)) return { type: "craft", key: "maul" }
  if (/\bcraft\b|\bforge\b/.test(s) && /\b(axe|choppa)\b/.test(s)) return { type: "craft", key: "axe" }
  if (/\braid\b|\blongship\b|\bdragon ship\b|\bsend the ship\b/.test(s)) {
    const target = s.replace(/.*\b(?:raid|longship)\b/, "").replace(/\b(with|the|send|to|on)\b/g, " ").trim()
    return { type: "raid", target: target || undefined }
  }
  if (/\bheal\b|\bpotion\b|\bdraught\b|\bdrink\b|\bpoultice\b/.test(s) && /\battack\b|\bfight\b/.test(s)) {
    return { type: "attack", stance: "heal" }
  }
  if (/\bheal\b|\bpotion\b|\bdraught\b|\bdrink\b|\bpoultice\b/.test(s)) return { type: "heal" }
  if (/\brecruit\b|\benlist\b|\bjoin us\b/.test(s)) return { type: "recruit" }
  if (/\bclaim\b|\btake the town\b|\bplant the banner\b/.test(s)) return { type: "claim" }
  if (/\bstatus\b|\breport\b|\bhow are we\b|\bwhere am i\b|\bsituation\b/.test(s)) return { type: "status" }
  if (/\bwarband\b|\bchampions\b|\broster\b|\barmy\b/.test(s)) return { type: "warband" }
  if (/\bshop\b|\bhoard\b|\bstore\b/.test(s)) return { type: "shop" }
  if (/\bsaga\b|\bstanding\b|\bleaderboard\b|\bwho leads\b|\bscore\b/.test(s)) return { type: "board" }
  if (/\bmute\b|\bsilence\b|\bquiet\b/.test(s)) return { type: "mute" }
  if (/\bunmute\b|\bmusic\b/.test(s)) return { type: "unmute" }
  if (/\bcenter\b|\brecenter\b|\bfind me\b/.test(s)) return { type: "center" }
  if (/\brest\b|\bbind wounds\b|\bcamp\b/.test(s)) return { type: "rest" }
  if (/\bvolley\b|\barrows\b|\bshoot\b/.test(s)) {
    const target = tail(s, /volley|arrows|shoot/)
    return { type: "attack", stance: "volley", target }
  }
  if (/\bguard\b|\bshield wall\b|\bshields\b/.test(s) && /\battack\b|\bfight\b|\bhit\b|\bbattle\b/.test(s)) {
    return { type: "attack", stance: "guard", target: tail(s, /attack|fight|hit|battle/) }
  }
  if (/\battack\b|\bfight\b|\bsmash\b|\bcharge\b|\bbattle\b|\bplunder\b|\bsack\b/.test(s)) {
    const stance: Stance = /\bguard\b|\bshield/.test(s) ? "guard" : "smash"
    return { type: "attack", stance, target: tail(s, /attack|fight|smash|charge|battle|plunder|sack/) }
  }
  return { type: "unknown", heard: s }
}

function roadKind(s: string): ReportType | null {
  if (/\bred light\b|\bred-light\b|\bwatchtower\b/.test(s)) return "redlight"
  if (/\bspeed camera\b|\bcamera\b|\ball-seeing\b|\bcrystal\b|\borb\b/.test(s)) return "camera"
  if (/\bcrash\b|\baccident\b|\bcollision\b|\bchariot\b/.test(s)) return "crash"
  if (/\bconstruction\b|\broadwork\b|\bwork zone\b|\bdwarves\b|\bfortress\b/.test(s)) return "construction"
  if (/\bpolice\b|\bcop\b|\brcmp\b|\bopp\b|\bwizard\b/.test(s)) return "police"
  if (/\bpothole\b|\btroll hole\b|\bsinkhole\b/.test(s)) return "pothole"
  if (/\btraffic jam\b|\bjam\b|\btraffic\b|\barmy\b|\bmarching\b/.test(s)) return "jam"
  if (/\broad closed\b|\bclosed road\b|\bclosure\b|\bcastle gate\b/.test(s)) return "closed"
  if (/\bice\b|\bfrost\b|\bblack ice\b/.test(s)) return "ice"
  if (/\bfog\b|\bmist\b/.test(s)) return "fog"
  if (/\banimal\b|\bbeast\b|\bdeer\b|\bmoose\b/.test(s)) return "animal"
  if (/\bweather\b|\bflood\b|\bsnow\b|\bstorm spirit\b/.test(s)) return "weather"
  if (/\bstopped (vehicle|car|truck)\b|\bhorse\b|\bcarriage\b|\bbroken down\b/.test(s)) return "stopped"
  if (/\bobject\b|\bdebris\b|\bboulder\b|\btreasure\b|\bchest\b/.test(s)) return "object"
  if (/\bhazard\b|\btrap\b/.test(s)) return "hazard"
  return null
}

function tail(s: string, re: RegExp): string | undefined {
  const parts = s.split(re)
  const last = parts[parts.length - 1]?.replace(/\b(the|on|at|with|my|a|an|to)\b/g, " ").replace(/\s+/g, " ").trim()
  return last || undefined
}

export function matchName<T extends { name: string }>(target: string, rows: T[]): T | undefined {
  const t = target.toLowerCase().trim()
  if (!t) return undefined
  return (
    rows.find((r) => r.name.toLowerCase() === t) ||
    rows.find((r) => r.name.toLowerCase().includes(t)) ||
    rows.find((r) => t.includes(r.name.toLowerCase()))
  )
}
