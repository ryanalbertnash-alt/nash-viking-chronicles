import type { Faction } from "./types.ts"

export const REPORT_TYPES = [
  "police",
  "construction",
  "crash",
  "hazard",
  "object",
  "stopped",
  "pothole",
  "jam",
  "closed",
  "weather",
  "camera",
  "redlight",
] as const

export type ReportType = (typeof REPORT_TYPES)[number]

export type RoadReport = {
  id: string
  type: ReportType
  lat: number
  lng: number
  reporterId: string
  reporterName: string
  faction: Faction
  note: string
  createdAt: number
  expiresAt: number
  still: string[]
  gone: string[]
}

export const REPORT_INFO: Record<ReportType, { label: string; theme: string; minutes: number; gold: number; xp: number }> = {
  police: { label: "Police", theme: "Enemy scouts", minutes: 45, gold: 30, xp: 45 },
  construction: { label: "Construction", theme: "A fort being raised", minutes: 180, gold: 26, xp: 40 },
  crash: { label: "Crash", theme: "A wreck on the road", minutes: 60, gold: 34, xp: 50 },
  hazard: { label: "Hazard", theme: "A trap in the road", minutes: 90, gold: 24, xp: 36 },
  object: { label: "Object on road", theme: "Debris in the lane", minutes: 60, gold: 22, xp: 32 },
  stopped: { label: "Stopped vehicle", theme: "A wagon blocking the lane", minutes: 40, gold: 20, xp: 30 },
  pothole: { label: "Pothole", theme: "A broken patch of road", minutes: 240, gold: 18, xp: 28 },
  jam: { label: "Traffic jam", theme: "A choked road", minutes: 40, gold: 22, xp: 34 },
  closed: { label: "Road closed", theme: "The road is barred", minutes: 180, gold: 32, xp: 48 },
  weather: { label: "Weather hazard", theme: "A storm on the road", minutes: 90, gold: 24, xp: 36 },
  camera: { label: "Speed camera", theme: "A watch-post", minutes: 720, gold: 28, xp: 40 },
  redlight: { label: "Red-light camera", theme: "A watch-post at the crossing", minutes: 720, gold: 28, xp: 40 },
}

export function reportSpeech(type: ReportType, meters: number): string {
  const info = REPORT_INFO[type]
  const dist = meters < 950 ? `${Math.max(50, Math.round(meters / 10) * 10)} metres` : `${(meters / 1000).toFixed(1)} kilometres`
  return `${info.label} reported ahead in ${dist}. ${info.theme}.`
}
