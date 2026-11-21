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
import type { PrivateYou, PublicWorld } from "@/shared/types.ts"

const style = {
  version: 8 as const,
  sources: {
    carto: {
      type: "raster" as const,
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [{ id: "carto", type: "raster" as const, source: "carto" }],
}

export function WarMap({
  you,
  world,
  pos,
  follow,
  moving,
  route,
  river,
  locked,
  onTown,
  onHall,
  onReport,
  onPost,
  onFree,
}: {
  you: PrivateYou
  world: PublicWorld
  pos: { lat: number; lng: number; heading: number }
  follow: boolean
  moving: boolean
  route: [number, number][]
  river: [number, number][]
  locked: boolean
  onTown: (id: string) => void
  onHall: (id: string) => void
  onReport: (id: string) => void
  onPost: (id: string) => void
  onFree: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const marks = useRef(new Map<string, maplibregl.Marker>())
  const [booted, setBooted] = useState(false)
  const cb = useRef({ onTown, onHall, onReport, onPost, onFree, locked })
  cb.current = { onTown, onHall, onReport, onPost, onFree, locked }
  const posRef = useRef(pos)
  posRef.current = pos

  useEffect(() => {
    if (!host.current) return
    const map = new maplibregl.Map({
      container: host.current,
      style,
      center: [posRef.current.lng, posRef.current.lat],
      zoom: 13.2,
      pitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.on("load", () => {
      map.addSource("river", { type: "geojson", data: line(river) })
      map.addSource("route", { type: "geojson", data: line(route) })
      map.addLayer({ id: "river", type: "line", source: "river", paint: { "line-color": "#7fa8b8", "line-width": 3, "line-opacity": 0.45, "line-dasharray": [1.2, 1.2] } })
      map.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#e2c07a", "line-width": 4, "line-opacity": 0.8 } })
      setBooted(true)
    })
    map.on("zoom", () => host.current?.classList.toggle("map-far", map.getZoom() < 11))
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
          marks.current.set(id, marker)
        }
        return
      }
      marks.current.set(id, new maplibregl.Marker({ element: node, anchor }).setLngLat([lng, lat]).addTo(map))
    }

    for (const town of world.towns) {
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
      const ai = p.isAI
      const sig = `${p.faction}:${p.villageName}:${p.leaderArt ?? ""}:${p.hall}`
      const html = ai
        ? `<div class="rival-mark ${p.faction}" data-sig="${sig}"><div class="badge">${p.faction === "grog" ? "G" : "V"}</div><div class="label">${escapeHtml(p.name)}</div></div>`
        : `<div class="hall-mark" data-sig="${sig}"><img alt="" src="${asset(p.leaderArt || (p.faction === "grog" ? "scenes/orc-brute.webp" : "scenes/wolves.jpg"))}" /><div class="label">${escapeHtml(p.villageName)}</div></div>`
      const node = nodeOf(html)
      node.addEventListener("click", () => { if (!cb.current.locked) cb.current.onHall(p.id) })
      put(`hall:${p.id}`, p.homeLng, p.homeLat, node, "bottom")
      const away = haversine({ lat: p.lat, lng: p.lng }, { lat: p.homeLat, lng: p.homeLng })
      if (p.id !== you.id && away > 150) {
        const ship = p.faction === "viking"
        const face = ship ? "marks/longship.svg" : "marks/warband.svg"
        const title = ship ? "Longship" : "Rival warband"
        const puck = nodeOf(`<div class="rider ${p.faction}" data-sig="ride-${p.id}-${p.faction}"><img data-heading="${p.heading}" alt="" src="${asset(face)}" /><div class="label"><b>${escapeHtml(p.name)}</b><small>${title} · another driver</small></div></div>`)
        put(`ride:${p.id}`, p.lng, p.lat, puck, "center")
      }
    }
    const me = nodeOf(`<div class="puck" data-sig="me"><i data-heading="${pos.heading}"></i></div>`)
    put("me", pos.lng, pos.lat, me, "center")
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
    marks.current.get("me")?.getElement().querySelector("i")?.setAttribute("data-heading", String(pos.heading))
    for (const p of world.players) {
      marks.current.get(`ride:${p.id}`)?.getElement().querySelector("[data-heading]")?.setAttribute("data-heading", String(p.heading))
    }
    for (const ship of world.ships) {
      marks.current.get(`ship:${ship.id}`)?.getElement().querySelector("img")?.setAttribute("data-heading", String(ship.heading))
    }
    spin(map)
  }, [world, you.id, booted, pos.lat, pos.lng, pos.heading])

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
