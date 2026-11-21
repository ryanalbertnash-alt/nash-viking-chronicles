/** Ontario defaults when a posted sign is not in the route data. Highway Traffic Act: 50 in a built-up area, 80 on a rural road, 100 on a King's Highway. */
export function usualLimit(road: string): { kmh: number; source: "usual" } {
  const name = road.toLowerCase()
  if (/\b(interstate|freeway|motorway|autoroute)\b/.test(name) || /\bi-\d+\b/.test(name)) return { kmh: 110, source: "usual" }
  if (/\b(highway|hwy|autoroute)\b/.test(name) || /\b(401|416|417|138)\b/.test(name)) return { kmh: 100, source: "usual" }
  if (/\b(county|regional|cr|rr)\b/.test(name)) return { kmh: 80, source: "usual" }
  return { kmh: 50, source: "usual" }
}
