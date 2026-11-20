export type LatLng = { lat: number; lng: number }

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000
  const p1 = (a.lat * Math.PI) / 180
  const p2 = (b.lat * Math.PI) / 180
  const dφ = ((b.lat - a.lat) * Math.PI) / 180
  const dλ = ((b.lng - a.lng) * Math.PI) / 180
  const s = Math.sin(dφ / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dλ / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

export function bearing(a: LatLng, b: LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180
  const φ2 = (b.lat * Math.PI) / 180
  const dλ = ((b.lng - a.lng) * Math.PI) / 180
  const y = Math.sin(dλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

export function offsetMeters(origin: LatLng, north: number, east: number): LatLng {
  const dLat = north / 111320
  const dLng = east / (111320 * Math.cos((origin.lat * Math.PI) / 180))
  return { lat: origin.lat + dLat, lng: origin.lng + dLng }
}

export function formatMeters(meters: number): string {
  if (meters < 950) return `${Math.max(1, Math.round(meters))} m`
  const km = meters / 1000
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}

export type Proj = { along: number; off: number; lng: number; lat: number; heading: number }

export function routeLength(coords: [number, number][]): number {
  let walked = 0
  for (let i = 0; i < coords.length - 1; i++) {
    walked += haversine(toLL(coords[i]), toLL(coords[i + 1]))
  }
  return walked
}

export function projectRoute(coords: [number, number][], lat: number, lng: number): Proj {
  const first = toLL(coords[0])
  let best: Proj = { along: 0, off: Infinity, lng: first.lng, lat: first.lat, heading: 0 }
  let walked = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const a = toLL(coords[i])
    const b = toLL(coords[i + 1])
    const seg = haversine(a, b)
    const latScale = 111320
    const lngScale = 111320 * Math.cos((a.lat * Math.PI) / 180)
    const ax = a.lng * lngScale
    const ay = a.lat * latScale
    const bx = b.lng * lngScale
    const by = b.lat * latScale
    const px = lng * lngScale
    const py = lat * latScale
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy || 1
    let t = ((px - ax) * dx + (py - ay) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const q = { lng: (ax + dx * t) / lngScale, lat: (ay + dy * t) / latScale }
    const off = haversine({ lat, lng }, q)
    if (off < best.off) {
      best = { along: walked + seg * t, off, lng: q.lng, lat: q.lat, heading: bearing(a, b) }
    }
    walked += seg
  }
  return best
}

export function pointAlong(coords: [number, number][], along: number): { lng: number; lat: number; heading: number } {
  let walked = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const a = toLL(coords[i])
    const b = toLL(coords[i + 1])
    const seg = haversine(a, b)
    if (walked + seg >= along || i === coords.length - 2) {
      const t = seg === 0 ? 0 : Math.min(1, Math.max(0, (along - walked) / seg))
      return {
        lng: a.lng + (b.lng - a.lng) * t,
        lat: a.lat + (b.lat - a.lat) * t,
        heading: bearing(a, b),
      }
    }
    walked += seg
  }
  const last = toLL(coords[coords.length - 1])
  return { ...last, heading: 0 }
}

export function nearestOnLine(coords: [number, number][], lat: number, lng: number): { distance: number; progress: number; lat: number; lng: number; heading: number } {
  const proj = projectRoute(coords, lat, lng)
  const total = routeLength(coords) || 1
  return { distance: proj.off, progress: proj.along / total, lat: proj.lat, lng: proj.lng, heading: proj.heading }
}

function toLL(pair: [number, number]): LatLng {
  return { lng: pair[0], lat: pair[1] }
}

export function inSeaway(lat: number, lng: number): boolean {
  return lat > 44.35 && lat < 45.75 && lng < -74.25 && lng > -76.45
}

export function homeSpot(origin: LatLng, salt: string): LatLng {
  let h = 2166136261
  for (const c of salt) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  h >>>= 0
  const angle = ((h % 360) * Math.PI) / 180
  const dist = 200 + (h % 180)
  return offsetMeters(origin, Math.cos(angle) * dist, Math.sin(angle) * dist)
}
