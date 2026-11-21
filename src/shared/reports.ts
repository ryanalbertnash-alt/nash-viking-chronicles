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
  "ice",
  "fog",
  "animal",
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

export type MarkInfo = {
  /** What it really is. Always shown, and never replaced by the fantasy name. */
  label: string
  /** Short fantasy name, used as the title. */
  title: string
  theme: string
  /** Spoken warning. `{dist}` is replaced with the distance. */
  cry: string
  minutes: number
  gold: number
  xp: number
  icon: string
}

export const REPORT_INFO: Record<ReportType, MarkInfo> = {
  police: {
    label: "Police",
    title: "Evil wizard",
    theme: "An evil wizard lurks beside the road.",
    cry: "Beware! An evil wizard lurks {dist} ahead.",
    minutes: 45, gold: 30, xp: 45, icon: "marks/police.svg",
  },
  construction: {
    label: "Construction",
    title: "Fortress wall",
    theme: "Dwarves and trolls are raising a fortress wall.",
    cry: "Dwarves and trolls are raising a fortress wall, {dist} ahead.",
    minutes: 180, gold: 26, xp: 40, icon: "marks/construction.svg",
  },
  crash: {
    label: "Crash",
    title: "Chariot wreck",
    theme: "A chariot lies wrecked in the lane.",
    cry: "A chariot lies wrecked {dist} ahead.",
    minutes: 60, gold: 34, xp: 50, icon: "marks/crash.svg",
  },
  hazard: {
    label: "Hazard",
    title: "Sprung trap",
    theme: "A sprung trap waits in the lane.",
    cry: "A sprung trap waits in the lane, {dist} ahead.",
    minutes: 90, gold: 24, xp: 36, icon: "marks/hazard.svg",
  },
  object: {
    label: "Object on road",
    title: "Fallen boulder",
    theme: "A boulder has fallen, and a chest with it.",
    cry: "A boulder has fallen, and a chest with it, {dist} ahead.",
    minutes: 60, gold: 22, xp: 32, icon: "marks/object.svg",
  },
  stopped: {
    label: "Stopped vehicle",
    title: "Broken carriage",
    theme: "A horse and carriage has broken down on the shoulder.",
    cry: "A horse and carriage has broken down on the shoulder, {dist} ahead.",
    minutes: 40, gold: 20, xp: 30, icon: "marks/stopped.svg",
  },
  pothole: {
    label: "Pothole",
    title: "Troll hole",
    theme: "A troll hole gapes in the road.",
    cry: "A troll hole gapes in the road, {dist} ahead.",
    minutes: 240, gold: 18, xp: 28, icon: "marks/pothole.svg",
  },
  jam: {
    label: "Traffic jam",
    title: "Marching army",
    theme: "A marching army blocks the road.",
    cry: "A marching army blocks the road, {dist} ahead.",
    minutes: 40, gold: 22, xp: 34, icon: "marks/jam.svg",
  },
  closed: {
    label: "Road closed",
    title: "Castle gate",
    theme: "The castle gate is shut.",
    cry: "The castle gate is shut, {dist} ahead.",
    minutes: 180, gold: 32, xp: 48, icon: "marks/closed.svg",
  },
  weather: {
    label: "Weather hazard",
    title: "Storm spirit",
    theme: "A storm spirit walks the road.",
    cry: "A storm spirit walks the road, {dist} ahead.",
    minutes: 90, gold: 24, xp: 36, icon: "marks/weather.svg",
  },
  ice: {
    label: "Ice",
    title: "Frost curse",
    theme: "A frost curse lies on the road.",
    cry: "A frost curse lies on the road, {dist} ahead.",
    minutes: 90, gold: 24, xp: 36, icon: "marks/ice.svg",
  },
  fog: {
    label: "Fog",
    title: "Mist wraiths",
    theme: "Mist wraiths hide the road.",
    cry: "Mist wraiths hide the road, {dist} ahead.",
    minutes: 60, gold: 20, xp: 30, icon: "marks/fog.svg",
  },
  animal: {
    label: "Animal on road",
    title: "Wild beast",
    theme: "A wild beast stands in the lane.",
    cry: "A wild beast stands in the lane, {dist} ahead.",
    minutes: 30, gold: 18, xp: 28, icon: "marks/animal.svg",
  },
  camera: {
    label: "Speed camera",
    title: "All-seeing eye",
    theme: "A wizard's crystal orb watches the road.",
    cry: "An all-seeing eye watches the road, {dist} ahead.",
    minutes: 720, gold: 28, xp: 40, icon: "marks/camera.svg",
  },
  redlight: {
    label: "Red-light camera",
    title: "Watchtower",
    theme: "A watchtower guards the crossing.",
    cry: "A watchtower guards the crossing, {dist} ahead.",
    minutes: 720, gold: 28, xp: 40, icon: "marks/redlight.svg",
  },
}

export function reportDistance(meters: number): string {
  return meters < 950 ? `${Math.max(50, Math.round(meters / 10) * 10)} metres` : `${(meters / 1000).toFixed(1)} kilometres`
}

export function reportSpeech(type: ReportType, meters: number): string {
  const info = REPORT_INFO[type]
  return `${info.cry.replace("{dist}", reportDistance(meters))} ${info.label}.`
}
