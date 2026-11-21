import { haversine } from "./geo.ts"

/** Real fuel stations on the Seaway roads, shown as trading posts. Coordinates from OpenStreetMap. */
export type TradingPost = {
  id: string
  title: string
  brand: string
  place: string
  lat: number
  lng: number
}

export const TRADING_POSTS: TradingPost[] = [
  { id: "macewen-chesterville", title: "The North Gate Tavern", brand: "MacEwen", place: "Chesterville", lat: 45.10307, lng: -75.23037 },
  { id: "stinson-chesterville", title: "Stinson's Trading Post", brand: "Stinson", place: "Chesterville", lat: 45.10135, lng: -75.22917 },
  { id: "francis-winchester", title: "The Winchester Wayside", brand: "Francis", place: "Winchester", lat: 45.07575, lng: -75.34129 },
  { id: "xtr-williamsburg", title: "The Crossroads Cask", brand: "XTR", place: "Williamsburg", lat: 44.97540, lng: -75.24429 },
  { id: "francis-berwick", title: "Francis's Wayside", brand: "Francis", place: "Berwick", lat: 45.17585, lng: -75.10912 },
  { id: "shell-monkland", title: "Monkland Keep", brand: "Shell", place: "Monkland", lat: 45.19736, lng: -74.87200 },
  { id: "ultramar-alexandria", title: "Alexandria's Blue Cask", brand: "Ultramar", place: "Alexandria", lat: 45.31467, lng: -74.63982 },
  { id: "gts-standrews", title: "The Highway Post", brand: "GT's Gas", place: "St. Andrews West", lat: 45.09487, lng: -74.79579 },
  { id: "petro-casselman", title: "Casselman's Maple Post", brand: "Petro-Canada", place: "Casselman", lat: 45.29938, lng: -75.07875 },
  { id: "ultramar-isidore", title: "The Catherine Cask", brand: "Ultramar", place: "St. Isidore", lat: 45.37578, lng: -74.90220 },
  { id: "esso-isidore", title: "The County Rest", brand: "Esso", place: "St. Isidore", lat: 45.34034, lng: -74.89638 },
  { id: "ultramar-russell", title: "The Blue Cask", brand: "Ultramar", place: "Russell Road", lat: 45.36906, lng: -75.45564 },
  { id: "renes", title: "Rene's Corner Tavern", brand: "Rene's Corner", place: "Greely", lat: 45.34252, lng: -75.52472 },
  { id: "petro-greely", title: "Greely's Maple Post", brand: "Petro-Canada", place: "Greely", lat: 45.34478, lng: -75.44256 },
  { id: "ultramar-vernon", title: "The Vernon Cask", brand: "Ultramar", place: "Vernon", lat: 45.27085, lng: -75.31201 },
  { id: "petro-cornwall", title: "The Maple Post", brand: "Petro-Canada", place: "Cornwall", lat: 45.04761, lng: -74.76977 },
  { id: "macewen-mcconnell", title: "The McConnell Mead Hall", brand: "MacEwen", place: "Cornwall", lat: 45.03519, lng: -74.72476 },
  { id: "gts-tollgate", title: "The Tollgate Post", brand: "GTS Gas", place: "Cornwall", lat: 45.05079, lng: -74.73694 },
  { id: "esso-fourteenth", title: "The Tiger's Rest", brand: "Esso", place: "Cornwall", lat: 45.03059, lng: -74.75502 },
  { id: "ultramar-mcconnell", title: "The Second Cask", brand: "Ultramar", place: "Cornwall", lat: 45.04984, lng: -74.73755 },
  { id: "esso-boundary", title: "The Boundary Rest", brand: "Esso", place: "Cornwall", lat: 45.03547, lng: -74.64233 },
  { id: "seaway-gas", title: "The Seaway Cask", brand: "Seaway Gas", place: "Cornwall", lat: 45.05770, lng: -74.68572 },
  { id: "esso-harbour", title: "The Harbour Rest", brand: "Esso", place: "Cornwall", lat: 45.06005, lng: -74.68655 },
  { id: "fuel-seaway", title: "The Second Seaway Post", brand: "Fuel", place: "Cornwall", lat: 45.06075, lng: -74.68605 },
  { id: "macewen-east", title: "MacEwen's East Watch", brand: "MacEwen", place: "Cornwall", lat: 45.05699, lng: -74.68623 },
  { id: "bears-den", title: "The Bear's Den", brand: "Bear's Den", place: "Long Sault", lat: 44.97756, lng: -74.71042 },
  { id: "tas-fuel", title: "Tas's Stores", brand: "Tas Fuel", place: "Cornwall", lat: 45.01877, lng: -74.70272 },
  { id: "esso-south", title: "The South Gate Rest", brand: "Esso", place: "Cornwall", lat: 45.03504, lng: -74.71436 },
  { id: "canadian-tire", title: "The Ironmonger's Yard", brand: "Canadian Tire", place: "Cornwall", lat: 45.02977, lng: -74.73221 },
  { id: "shell-cornwall", title: "The Shell Keep", brand: "Shell", place: "Cornwall", lat: 45.02098, lng: -74.71839 },
  { id: "upi-brookdale", title: "The Brookdale Post", brand: "UPI Energy", place: "Cornwall", lat: 45.02730, lng: -74.75156 },
  { id: "fuel-lancaster", title: "The River Post", brand: "Fuel", place: "Lancaster", lat: 45.08763, lng: -74.59069 },
]

export function postById(id: string) {
  return TRADING_POSTS.find((p) => p.id === id)
}

export function nearestPost(here: { lat: number; lng: number }, maxMeters = 180) {
  let best: TradingPost | null = null
  let meters = maxMeters
  for (const post of TRADING_POSTS) {
    const dist = haversine(here, post)
    if (dist < meters) {
      best = post
      meters = dist
    }
  }
  return best ? { post: best, meters } : null
}

export function postSpeech(meters: number): string {
  const dist = meters < 950 ? `${Math.max(50, Math.round(meters / 10) * 10)} metres` : `${(meters / 1000).toFixed(1)} kilometres`
  return `A mead hall offers rest ${dist} ahead. Gas station.`
}
