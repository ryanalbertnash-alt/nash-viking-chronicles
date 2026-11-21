/** Change the App Store id here, then run `node scripts/apply-bundle-id.mjs`. */
export const BUNDLE_ID = "com.nash.vikingchronicles"

export const APP_NAME = "Nash's Viking Chronicles"

/** Live game server. The iOS app bundles the site and calls this host. */
export const API_ORIGIN = "https://nash-viking-chronicles.onrender.com"

/**
 * Consumable Nash Points. Prices follow the usual Fortnite V-Bucks shelf
 * (about $8.99 / $22.99 / $36.99 / $89.99, plus a $4.99 small pack).
 * Apple charges these only inside the iOS app. The website does not.
 */
export const POINT_PACKS = [
  { suffix: "points.500", np: 500, usd: 4.99, blurb: "A small purse." },
  { suffix: "points.1000", np: 1000, usd: 8.99, blurb: "A fist of points for a potion and change." },
  { suffix: "points.2800", np: 2800, usd: 22.99, blurb: "A war chest. A rare weapon, or a skin and a ship." },
  { suffix: "points.5000", np: 5000, usd: 36.99, blurb: "Enough for a longship and a cloak." },
  { suffix: "points.13500", np: 13500, usd: 89.99, blurb: "The jarl's hoard. The whole armory notices." },
] as const

export type PointPack = (typeof POINT_PACKS)[number]

export function productId(suffix: string): string {
  return `${BUNDLE_ID}.${suffix}`
}

export function pointPackById(id: string): PointPack | undefined {
  return POINT_PACKS.find((pack) => productId(pack.suffix) === id)
}
