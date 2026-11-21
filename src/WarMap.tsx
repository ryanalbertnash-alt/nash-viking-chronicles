import { useEffect, useRef, useState } from "react"
import * as maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url"

const gl = maplibregl as unknown as { setWorkerUrl?: (url: string) => void; workerUrl?: string }
if (typeof gl.setWorkerUrl === "function") gl.setWorkerUrl(workerUrl)
else gl.workerUrl = workerUrl
import { asset } from "@/art"
import { haversine } from "@/shared/geo.ts"
import { TRADING_POSTS } from "@/shared/posts.ts"
import { REPORT_INFO } from "@/shared/reports.ts"
import type { PrivateYou, PublicTown, PublicWorld } from "@/shared/types.ts"

const STYLE = "https://tiles.openfreemap.org/styles/dark"

export function WarMap({
  you,
  world,
  places = [],
  pos,
  follow,
  moving,
  speed = 0,
  route,
  river,
  locked,
  onTown,
  onHall,
  onReport,
  onPost,
  onFree,
  onPlaces,
}: {
  you: PrivateYou
  world: PublicWorld
  places?: PublicTown[]
  pos: { lat: number; lng: number; heading: number }
  follow: boolean
  moving: boolean
  speed?: number
  route: [number, number][]
  river: [number, number][]
  locked: boolean
  onTown: (id: string) => void
  onHall: (id: string) => void
  onReport: (id: string) => void
  onPost: (id: string) => void
  onFree: () => void
  onPlaces?: (towns: PublicTown[]) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const marks = useRef(new Map<string, maplibregl.Marker>())
  const [booted, setBooted] = useState(false)
  const cb = useRef({ onTown, onHall, onReport, onPost, onFree, onPlaces, locked })
  cb.current = { onTown, onHall, onReport, onPost, onFree, onPlaces, locked }
  const posRef = useRef(pos)
  posRef.current = pos

  useEffect(() => {
    if (!host.current) return
    const loadPlaces = (m: maplibregl.Map) => {
      if (!m.getBounds()) return
      const b = m.getBounds()
      const q = `south=${b.getSouth()}&west=${b.getWest()}&north=${b.getNorth()}&east=${b.getEast()}`
      void fetch(`/api/places?${q}`).then((r) => (r.ok ? r.json() : [])).then((rows: PublicTown[]) => {
        cb.current.onPlaces?.(Array.isArray(rows) ? rows : [])
      }).catch(() => {})
    }
    const map = new maplibregl.Map({
      container: host.current,
      style: STYLE,
      center: [posRef.current.lng, posRef.current.lat],
      zoom: 13.2,
      pitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: { compact: true },
    })
    map.touchZoomRotate.disableRotation()
    map.on("load", () => {
      map.addSource("river", { type: "geojson", data: line(river) })
      map.addSource("route", { type: "geojson", data: line(route) })
      map.addSource("marches", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
      map.addLayer({ id: "river", type: "line", source: "river", paint: { "line-color": "#7fa8b8", "line-width": 3, "line-opacity": 0.55, "line-dasharray": [1.2, 1.2] } })
      map.addLayer({ id: "marches", type: "line", source: "marches", paint: { "line-color": "#c45a32", "line-width": 3, "line-opacity": 0.8, "line-dasharray": [0.6, 1.2] } })
      map.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#3d8bfd", "line-width": 6, "line-opacity": 0.9 } })
      setBooted(true)
      loadPlaces(map)
    })
    map.on("zoom", () => host.current?.classList.toggle("map-far", map.getZoom() < 11))
    map.on("moveend", () => loadPlaces(map))
    map.on("dragstart", () => { if (!cb.current.locked) cb.current.onFree() })
    map.on("move", () => spin(map))
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      marks.current.clear()
      setBooted(false)
    }
    // The map is created once. Route and river updates go through setData.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !booted) return
    const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined
    src?.setData(line(route))
  }, [route, booted])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !booted) return
    if (locked) map.dragPan.disable()
    else map.dragPan.enable()
  }, [locked, booted])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !booted || !follow) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    map.easeTo({
      center: [pos.lng, pos.lat],
      bearing: pos.heading,
      pitch: moving ? 46 : 0,
      duration: reduce ? 0 : 700,
      padding: { top: 80, bottom: 240, left: 20, right: 20 },
    })
  }, [pos, follow, moving, booted])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !booted) return
    const seen = new Set<string>()
    const put = (id: string, lng: number, lat: number, node: HTMLElement, anchor: maplibregl.PositionAnchor = "center") => {
      seen.add(id)
      const existing = marks.current.get(id)
      if (existing) {
        existing.setLngLat([lng, lat])
        const root = existing.getElement()
        if (root.dataset.sig !== node.dataset.sig) {
          root.replaceWith(node)
          existing.remove()
          const marker = new maplibregl.Marker({ element: node, anchor }).setLngLat([lng, lat]).addTo(map)
          if (id === "me" || id.startsWith("ride:") || id.startsWith("march:")) node.style.zIndex = "5"
          marks.current.set(id, marker)
        }
        return
      }
      if (id === "me" || id.startsWith("ride:") || id.startsWith("march:")) node.style.zIndex = "5"
      marks.current.set(id, new maplibregl.Marker({ element: node, anchor }).setLngLat([lng, lat]).addTo(map))
    }

    const shown = new Set(world.towns.map((t) => t.id))
    for (const town of [...world.towns, ...places.filter((t) => !shown.has(t.id))]) {
      const faction = town.ownerFaction ?? "neutral"
      const mine = town.ownerId === you.id
      const node = nodeOf(`<div class="pin ${faction} ${mine ? "mine" : ""}" data-sig="${faction}:${mine}:${town.name}"><div class="label">${escapeHtml(town.name)}</div><div class="dot"></div></div>`)
      node.addEventListener("click", () => { if (!cb.current.locked) cb.current.onTown(town.id) })
      put(`town:${town.id}`, town.lng, town.lat, node, "bottom")
    }
    for (const report of world.reports) {
      const info = REPORT_INFO[report.type]
      const node = nodeOf(`<div class="pin report ${report.type}" data-sig="${report.type}:${report.still.length}:${report.gone.length}"><div class="label"><b>${escapeHtml(info.title)}</b><small>${escapeHtml(info.label)}</small></div><img class="mark" alt="" src="${asset(info.icon)}" /></div>`)
      node.addEventListener("click", () => { if (!cb.current.locked) cb.current.onReport(report.id) })
      put(`report:${report.id}`, report.lng, report.lat, node, "bottom")
    }
    for (const post of TRADING_POSTS) {
      const node = nodeOf(`<div class="pin post-mark" data-sig="${post.id}"><div class="label"><b>${escapeHtml(post.title)}</b><small>Mead hall · Gas station</small></div><img class="mark" alt="" src="${asset("marks/tavern.svg")}" /></div>`)
      node.addEventListener("click", () => { if (!cb.current.locked) cb.current.onPost(post.id) })
      put(`post:${post.id}`, post.lng, post.lat, node, "bottom")
    }
    for (const p of world.players) {
      if (!p.faction) continue
      const friend = you.friendIds.includes(p.id)
      const sig = `${p.faction}:${p.villageName}:${p.hall}:${friend ? "f" : ""}`
      const node = nodeOf(`<div class="hall-mark ${friend ? "friend" : ""} ${p.faction}" data-sig="${sig}"><img alt="" src="${asset(p.leaderArt || (p.faction === "grog" ? "scenes/orc-brute.webp" : "scenes/wolves.jpg"))}" /><div class="label">${escapeHtml(p.villageName)}</div></div>`)
      node.addEventListener("click", () => { if (!cb.current.locked) cb.current.onHall(p.id) })
      put(`hall:${p.id}`, p.homeLng, p.homeLat, node, "bottom")
      if (p.id === you.id) continue
      const away = haversine({ lat: p.lat, lng: p.lng }, { lat: p.homeLat, lng: p.homeLng })
      if (away > 80 || p.speed > 3) {
        const ride = riderHtml(p.faction ?? "viking", p.leaderArt, p.name, p.heading, p.speed, friend, `ride-${p.id}`)
        put(`ride:${p.id}`, p.lng, p.lat, ride, "center")
      }
    }
    const homeGap = haversine(pos, { lat: you.homeLat, lng: you.homeLng })
    if (homeGap > 40 || speed > 3) {
      const face = you.champions[0]?.art ?? null
      put("me", pos.lng, pos.lat, riderHtml(you.faction ?? "viking", face, you.name, pos.heading, speed, false, "me"), "center")
    }
    for (const march of world.marches ?? []) {
      const t = Math.min(1, Math.max(0, (Date.now() - march.startedAt) / Math.max(1000, march.arriveAt - march.startedAt)))
      const lat = march.fromLat + (march.toLat - march.fromLat) * t
      const lng = march.fromLng + (march.toLng - march.fromLng) * t
      const token = riderHtml(march.faction, null, march.label, 0, 12, march.ownerId !== you.id && you.friendIds.includes(march.ownerId), `march-${march.id}`)
      put(`march:${march.id}`, lng, lat, token, "center")
    }
    const marchSrc = map.getSource("marches") as maplibregl.GeoJSONSource | undefined
    marchSrc?.setData({
      type: "FeatureCollection",
      features: (world.marches ?? []).map((m) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: [[m.fromLng, m.fromLat], [m.toLng, m.toLat]] },
      })),
    })
    for (const ship of world.ships) {
      const node = nodeOf(`<div class="ship-mark" data-sig="${ship.art}:${ship.raiding}"><img data-heading="${ship.heading}" alt="${escapeHtml(ship.name)}" src="${asset(ship.art)}" /><div class="label">${escapeHtml(ship.name)}</div></div>`)
      put(`ship:${ship.id}`, ship.lng, ship.lat, node, "center")
    }
    for (const [id, marker] of marks.current) {
      if (!seen.has(id)) {
        marker.remove()
        marks.current.delete(id)
      }
    }
    marks.current.get("me")?.getElement().setAttribute("data-heading", String(pos.heading))
    for (const p of world.players) {
      marks.current.get(`ride:${p.id}`)?.getElement().setAttribute("data-heading", String(p.heading))
    }
    for (const ship of world.ships) {
      marks.current.get(`ship:${ship.id}`)?.getElement().querySelector("img")?.setAttribute("data-heading", String(ship.heading))
    }
    spin(map)
  }, [world, places, you.id, you.friendIds, you.faction, booted, pos.lat, pos.lng, pos.heading, speed])

  return <div className="map-wrap"><div ref={host} className="map" /></div>
}

function spin(map: maplibregl.Map) {
  const bearing = map.getBearing()
  map.getContainer().querySelectorAll("[data-heading]").forEach((node) => {
    const el = node as HTMLElement
    const heading = Number(el.dataset.heading ?? 0)
    el.style.transform = `rotate(${heading - bearing}deg)`
  })
}

function line(coordinates: [number, number][]) {
  return { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates } }
}

function nodeOf(html: string) {
  const wrap = document.createElement("div")
  wrap.innerHTML = html
  return wrap.firstElementChild as HTMLElement
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c)
}

function riderHtml(faction: string, art: string | null, name: string, heading: number, speed: number, friend: boolean, sig: string) {
  const gait = speed > 40 ? "gallop" : speed > 4 ? "trot" : "still"
  const mount = faction === "grog" ? monsterSvg(name) : horseSvg()
  const face = art ? `<img class="face" alt="" src="${asset(art)}" />` : ""
  return nodeOf(`<div class="mount-token ${faction} ${gait} ${friend ? "friend" : ""}" data-sig="${sig}:${gait}:${faction}" data-heading="${heading}"><div class="bob">${face}${mount}</div><div class="label">${escapeHtml(name)}</div></div>`)
}

function horseSvg() {
  return `<svg class="beast" viewBox="0 0 64 40" aria-hidden="true"><path fill="#6b3e22" d="M8 26c2-8 8-14 16-14 2 0 4 2 6 2 6 0 8-6 14-6 4 0 8 4 8 8 0 2-2 4-2 6 4 2 6 6 6 8H44c-1 4-4 6-8 6h-4l-2 6h-6l2-6H14l-2 6H6l2-6H4c0-4 2-8 4-8z"/><circle cx="50" cy="14" r="2" fill="#1a120c"/><path fill="#3a2414" d="M18 28l-4 8M30 28l-2 8M40 28l2 8"/></svg>`
}

function monsterSvg(name: string) {
  const n = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % 3
  if (n === 0) return `<svg class="beast" viewBox="0 0 64 40" aria-hidden="true"><path fill="#5a4632" d="M6 24c4-10 14-14 24-12 6 1 10-4 16-2 6 2 10 8 8 12 4 2 6 6 4 10H12c-4-2-8-6-6-8z"/><circle cx="46" cy="16" r="2" fill="#e2c07a"/><path fill="#c45a32" d="M50 18l8 2-8 4z"/></svg>`
  if (n === 1) return `<svg class="beast" viewBox="0 0 64 40" aria-hidden="true"><path fill="#3d3a3a" d="M10 22c2-8 12-12 20-10 4 1 6-6 12-4 8 2 12 10 8 16 6 2 8 8 4 10H14c-6 0-10-6-4-12z"/><circle cx="44" cy="16" r="2" fill="#e07060"/><path fill="#222" d="M16 24l-2 10M28 24l0 10M40 24l2 10"/></svg>`
  return `<svg class="beast" viewBox="0 0 72 48" aria-hidden="true"><path fill="#4a5a34" d="M8 30c4-14 18-20 30-16 8 2 12-8 20-4 8 4 10 14 6 18 6 4 8 10 2 12H16c-8 0-12-6-8-10z"/><circle cx="52" cy="18" r="3" fill="#111"/><path fill="#6a3030" d="M58 20l12 4-12 6z"/></svg>`
}
