import type { MarchKind } from "./types.ts"

export const WELCOME_GOLD = 60
export const MOVE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000
export const RIVAL_METERS = 28000

export function marchSeconds(meters: number, kind: MarchKind): number {
  const m = Math.max(0, meters)
  if (kind === "raven") return clamp(Math.round(8 + m / 700), 8, 90)
  if (kind === "longship") return clamp(Math.round(15 + m / 450), 15, 180)
  return clamp(Math.round(20 + m / 350), 20, 240)
}

export function idleRate(p: { hall: number; shrine?: number; yard?: number }): number {
  return 3 + p.hall * 2 + (p.shrine ?? 0) * 2 + (p.yard ?? 0)
}

export function idlePurse(rate: number, idleAt: number, now: number): number {
  if (!idleAt || now <= idleAt) return 0
  const elapsed = Math.min(now - idleAt, 6 * 60 * 60 * 1000)
  return Math.floor(elapsed / 60_000) * rate
}

export function questDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

export function freshQuests(day: string) {
  return [
    { id: `${day}-build`, kind: "build" as const, title: "Raise a building", goal: 1, progress: 0, reward: 45, claimed: false },
    { id: `${day}-train`, kind: "train" as const, title: "Muster a company", goal: 1, progress: 0, reward: 40, claimed: false },
    { id: `${day}-march`, kind: "march" as const, title: "Send a war band, ship, or raven", goal: 1, progress: 0, reward: 55, claimed: false },
  ]
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
