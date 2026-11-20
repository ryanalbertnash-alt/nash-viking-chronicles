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
  | { type: "mute" }
  | { type: "unmute" }
  | { type: "center" }
  | { type: "rest" }
  | { type: "attack"; stance: Stance; target?: string }
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
  if (/passenger/.test(s) && /\b(off|stop|end|disable)\b/.test(s)) return { type: "passenger", on: false }
  if (/\bpassenger\b/.test(s)) return { type: "passenger", on: true }
  if (/\bpull over\b|\bpark\b|\bwhoa\b|\bhold up\b|^stop$|\bpull up\b/.test(s)) return { type: "hold" }
  if (/\bturn around\b|\bgo back\b|\breverse\b/.test(s)) return { type: "turn" }
  if (/\bride on\b|\bdrive\b|\bonward\b|\bresume\b|\blets go\b|\blet's go\b|\bcontinue\b|\btake the road\b/.test(s)) return { type: "ride" }
  if (/\bbuild\b|\braise\b/.test(s) && /\bforge\b/.test(s)) return { type: "build", part: "forge" }
  if (/\bbuild\b|\braise\b/.test(s) && /\bwall/.test(s)) return { type: "build", part: "walls" }
  if (/\bbuild\b|\braise\b/.test(s) && /\bdock\b|\blongship dock\b/.test(s)) return { type: "build", part: "dock" }
  if (/\bbuild\b|\braise\b/.test(s) && /\bhall\b/.test(s)) return { type: "build", part: "hall" }
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
