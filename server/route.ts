import { haversine } from "../src/shared/geo.ts"
import { usualLimit } from "../src/shared/limits.ts"
import type { NavPlan, NavStep } from "../src/shared/nav.ts"
import { towns } from "../src/shared/catalog.ts"

export type Place = { name: string; lat: number; lng: number }

const UA = "NashVikingChronicles/0.1 (location game; chesterville)"

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const local = towns
    .filter((t) => t.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 5)
    .map((t) => ({ name: `${t.name}, Ontario`, lat: t.lat, lng: t.lng }))
  if (local.length) return local
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&q=${encodeURIComponent(q + ", Ontario")}`
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } })
  if (!res.ok) return []
  const rows = (await res.json()) as { display_name?: string; lat: string; lon: string }[]
  return rows.map((r) => ({ name: (r.display_name ?? q).split(",").slice(0, 2).join(","), lat: Number(r.lat), lng: Number(r.lon) }))
}

export async function roadAt(lat: number, lng: number): Promise<{ road: string; limit: number } | null> {
  const res = await fetch("https://valhalla1.openstreetmap.de/locate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ locations: [{ lat, lon: lng }], costing: "auto", verbose: true }),
  })
  if (!res.ok) return null
  const rows = (await res.json()) as { edges?: { edge_info?: { names?: string[] } }[] }[]
  const road = rows[0]?.edges?.[0]?.edge_info?.names?.[0] ?? ""
  if (!road) return null
  return { road, limit: usualLimit(road).kmh }
}

export async function buildRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }, label: string): Promise<NavPlan> {
  const body = {
    locations: [
      { lat: from.lat, lon: from.lng },
      { lat: to.lat, lon: to.lng },
    ],
    costing: "auto",
    units: "kilometers",
    directions_options: { units: "kilometers" },
  }
  const res = await fetch("https://valhalla1.openstreetmap.de/route", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("The road-finder did not answer.")
  const json = (await res.json()) as { trip?: { legs: ValhallaLeg[] }; error?: string }
  const leg = json.trip?.legs?.[0]
  if (!leg) throw new Error(json.error || "No road between those points.")
  const coords = decode(leg.shape)
  const at = cumulative(coords)
  const steps: NavStep[] = leg.maneuvers.map((m) => {
    const i = Math.min(m.begin_shape_index ?? 0, coords.length - 1)
    const road = m.street_names?.[0] ?? ""
    return {
      at: at[i] ?? 0,
      lat: coords[i][1],
      lng: coords[i][0],
      say: m.verbal_pre_transition_instruction || m.instruction,
      road,
      limit: usualLimit(road).kmh,
    }
  })
  return {
    label,
    coords,
    steps,
    meters: Math.round(leg.summary.length * 1000),
    seconds: Math.round(leg.summary.time),
  }
}

type ValhallaLeg = {
  shape: string
  summary: { length: number; time: number }
  maneuvers: { begin_shape_index?: number; instruction: string; verbal_pre_transition_instruction?: string; street_names?: string[] }[]
}

function cumulative(coords: [number, number][]): number[] {
  const out = [0]
  for (let i = 1; i < coords.length; i++) {
    out.push(out[i - 1] + haversine({ lng: coords[i - 1][0], lat: coords[i - 1][1] }, { lng: coords[i][0], lat: coords[i][1] }))
  }
  return out
}

function decode(str: string): [number, number][] {
  let index = 0
  let lat = 0
  let lng = 0
  const out: [number, number][] = []
  const factor = 1e6
  while (index < str.length) {
    let result = 0
    let shift = 0
    let b: number
    do {
      b = str.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    result = 0
    shift = 0
    do {
      b = str.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1
    out.push([lng / factor, lat / factor])
  }
  return out
}
