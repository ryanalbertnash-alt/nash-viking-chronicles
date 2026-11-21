import { API_ORIGIN } from "@/shared/app.ts"

type Cap = { isNativePlatform?: () => boolean; getPlatform?: () => string }

function capacitor(): Cap | undefined {
  return (window as unknown as { Capacitor?: Cap }).Capacitor
}

export function isNativeApp(): boolean {
  return Boolean(capacitor()?.isNativePlatform?.())
}

/** Relative on the website. Absolute on the installed app, which has no host of its own. */
export function apiUrl(path: string): string {
  if (!isNativeApp()) return path
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`
}

export function socketUrl(): string {
  if (!isNativeApp()) {
    const proto = location.protocol === "https:" ? "wss" : "ws"
    return `${proto}://${location.host}/ws`
  }
  const host = API_ORIGIN.replace(/^https?:\/\//, "")
  return `wss://${host}/ws`
}
