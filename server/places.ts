import fs from "node:fs"
import path from "node:path"
import { towns } from "../src/shared/catalog.ts"
import { haversine } from "../src/shared/geo.ts"
import type { TownDef, TownKind } from "../src/shared/types.ts"

export type PlaceRec = {
  id: string
  name: string
  lat: number
  lng: number
  kind: TownKind
  country: "CA" | "US"
  pop: number
}

const KINDS: TownKind[] = ["hamlet", "village", "town", "city"]

const ids: string[] = []
const names: string[] = []
let latA = new Float32Array(0)
let lngA = new Float32Array(0)
let kindA = new Uint8Array(0)
let ccA = new Uint8Array(0)
let popA = new Uint32Array(0)
const byId = new Map<string, number>()
const grid = new Map<number, number[]>()
const byLetter = new Map<string, number[]>()
const suppressed = new Set<number>()

let ready = false

function cellKey(lat: number, lng: number) {
  return Math.floor(lat * 2) * 100000 + Math.floor(lng * 2)
}

export function loadPlaces() {
  if (ready) return
  const file = path.join(process.cwd(), "server/places/na.places")
  const buf = fs.readFileSync(file)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  if (buf.toString("utf8", 0, 4) !== "NAPL") throw new Error("Place index is damaged.")
  const count = view.getUint32(5, true)
  latA = new Float32Array(count)
  lngA = new Float32Array(count)
  kindA = new Uint8Array(count)
  ccA = new Uint8Array(count)
  popA = new Uint32Array(count)
  let o = 9
  for (let i = 0; i < count; i++) {
    const idLen = view.getUint8(o); o += 1
    const id = buf.toString("utf8", o, o + idLen); o += idLen
    const nameLen = view.getUint8(o); o += 1
    const name = buf.toString("utf8", o, o + nameLen); o += nameLen
    const lat = view.getFloat32(o, true); o += 4
    const lng = view.getFloat32(o, true); o += 4
    const kind = view.getUint8(o); o += 1
    const cc = view.getUint8(o); o += 1
    const pop = view.getUint32(o, true); o += 4
    ids.push(id)
    names.push(name)
    latA[i] = lat
    lngA[i] = lng
    kindA[i] = kind
    ccA[i] = cc
    popA[i] = pop
    byId.set(id, i)
    const key = cellKey(lat, lng)
    const bucket = grid.get(key)
    if (bucket) bucket.push(i)
    else grid.set(key, [i])
    const letter = name[0]?.toLowerCase() ?? ""
    if (letter) {
      const list = byLetter.get(letter)
      if (list) list.push(i)
      else byLetter.set(letter, [i])
    }
  }
  for (const town of towns) {
    const cy = Math.floor(town.lat * 2)
    const cx = Math.floor(town.lng * 2)
    const b = town.name.toLowerCase()
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        const bucket = grid.get(y * 100000 + x)
        if (!bucket) continue
        for (const i of bucket) {
          if (haversine(town, { lat: latA[i], lng: lngA[i] }) > 2500) continue
          const a = names[i].toLowerCase()
          if (a === b || a.startsWith(b) || b.startsWith(a)) suppressed.add(i)
        }
      }
    }
  }
  ready = true
}

function rec(i: number): PlaceRec {
  return {
    id: ids[i],
    name: names[i],
    lat: latA[i],
    lng: lngA[i],
    kind: KINDS[kindA[i]] ?? "hamlet",
    country: ccA[i] === 0 ? "CA" : "US",
    pop: popA[i],
  }
}

function fromCatalog(town: TownDef): PlaceRec {
  return {
    id: town.id,
    name: town.name,
    lat: town.lat,
    lng: town.lng,
    kind: town.kind,
    country: "CA",
    pop: town.kind === "city" ? 100000 : town.kind === "town" ? 12000 : 2000,
  }
}

export function placeById(id: string): PlaceRec | null {
  loadPlaces()
  const town = towns.find((t) => t.id === id)
  if (town) return fromCatalog(town)
  const i = byId.get(id)
  if (i == null || suppressed.has(i)) return null
  return rec(i)
}

export function resolveTown(id: string): TownDef | null {
  const town = towns.find((t) => t.id === id)
  if (town) return town
  const place = placeById(id)
  if (!place) return null
  const where = place.country === "CA" ? "Canada" : "the United States"
  return {
    id: place.id,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    kind: place.kind,
    blurb: `${place.name}, ${where}. A real town on the live map.`,
    shore: false,
    threat: place.kind === "city" ? 1.35 : place.kind === "town" ? 1.1 : 1,
  }
}

export function nearestPlace(lat: number, lng: number, maxMeters = 40000): PlaceRec | null {
  loadPlaces()
  let best: PlaceRec | null = null
  let bestD = maxMeters
  for (const town of towns) {
    const d = haversine(town, { lat, lng })
    if (d < bestD) {
      best = fromCatalog(town)
      bestD = d
    }
  }
  const reach = Math.max(1, Math.ceil(maxMeters / 40000))
  const cy = Math.floor(lat * 2)
  const cx = Math.floor(lng * 2)
  for (let y = cy - reach; y <= cy + reach; y++) {
    for (let x = cx - reach; x <= cx + reach; x++) {
      const bucket = grid.get(y * 100000 + x)
      if (!bucket) continue
      for (const i of bucket) {
        if (suppressed.has(i)) continue
        const d = haversine({ lat, lng }, { lat: latA[i], lng: lngA[i] })
        if (d < bestD) {
          best = rec(i)
          bestD = d
        }
      }
    }
  }
  return best
}

export function placesInBbox(south: number, west: number, north: number, east: number, limit = 80): PlaceRec[] {
  loadPlaces()
  const span = Math.max(north - south, east - west)
  const hits: { p: PlaceRec; d: number; pop: number }[] = []
  const mid = { lat: (south + north) / 2, lng: (west + east) / 2 }
  const y0 = Math.floor(south * 2)
  const y1 = Math.floor(north * 2)
  const x0 = Math.floor(west * 2)
  const x1 = Math.floor(east * 2)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const bucket = grid.get(y * 100000 + x)
      if (!bucket) continue
      for (const i of bucket) {
        if (suppressed.has(i)) continue
        const lat = latA[i]
        const lng = lngA[i]
        if (lat < south || lat > north || lng < west || lng > east) continue
        hits.push({ p: rec(i), d: haversine(mid, { lat, lng }), pop: popA[i] })
      }
    }
  }
  for (const town of towns) {
    if (town.lat < south || town.lat > north || town.lng < west || town.lng > east) continue
    hits.push({ p: fromCatalog(town), d: haversine(mid, town), pop: fromCatalog(town).pop })
  }
  hits.sort((a, b) => span > 1.5 ? b.pop - a.pop || a.d - b.d : a.d - b.d)
  const seen = new Set<string>()
  const out: PlaceRec[] = []
  for (const hit of hits) {
    if (seen.has(hit.p.id)) continue
    seen.add(hit.p.id)
    out.push(hit.p)
    if (out.length >= limit) break
  }
  return out
}

export function searchPlacesLocal(query: string, limit = 8, bias?: { lat: number; lng: number }): PlaceRec[] {
  loadPlaces()
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const letter = byLetter.get(q[0]) ?? []
  const scored: { p: PlaceRec; score: number }[] = []
  const consider = (p: PlaceRec, pop: number) => {
    const name = p.name.toLowerCase()
    if (!name.includes(q) && !q.includes(name)) return
    let score = pop / 1000
    if (name === q) score += 5000
    else if (name.startsWith(q)) score += 1200
    if (!p.id.startsWith("g")) score += 8000
    if (bias) score -= haversine(bias, p) / 1000
    scored.push({ p, score })
  }
  for (const town of towns) consider(fromCatalog(town), fromCatalog(town).pop)
  for (const i of letter) {
    if (suppressed.has(i)) continue
    const name = names[i].toLowerCase()
    if (!name.includes(q)) continue
    consider(rec(i), popA[i])
    if (scored.length > 400) break
  }
  scored.sort((a, b) => b.score - a.score)
  const seen = new Set<string>()
  const out: PlaceRec[] = []
  for (const row of scored) {
    if (seen.has(row.p.id)) continue
    seen.add(row.p.id)
    out.push(row.p)
    if (out.length >= limit) break
  }
  return out
}

export function placeCount(): number {
  loadPlaces()
  return ids.length - suppressed.size + towns.length
}
