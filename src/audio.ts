const file = (path: string) => `${import.meta.env.BASE_URL}${path}`

export type SfxName = "clash" | "sword" | "axe" | "shield" | "horn" | "drums" | "roar" | "oars" | "coins" | "drink" | "bell"
export type VoiceLine = "recruit" | "cry" | "victory" | "defeat" | "low"
type Track = "explore-viking" | "explore-grog" | "battle-viking" | "battle-grog" | "victory" | "defeat"

let ctx: AudioContext | null = null
let musicBus: GainNode | null = null
let sfxBus: GainNode | null = null
let voiceBus: GainNode | null = null
let musicLevel = 0.7
let muted = false
let driving = false
let ducked = false
let faction: "viking" | "grog" = "viking"
let mode: "explore" | "battle" | "victory" | "defeat" = "explore"
let alive: HTMLAudioElement | null = null
let aliveId: Track | null = null
let fading = 0

const beds = new Map<Track, HTMLAudioElement>()

function trackFor(): Track {
  if (mode === "victory") return "victory"
  if (mode === "defeat") return "defeat"
  if (mode === "battle") return faction === "grog" ? "battle-grog" : "battle-viking"
  return faction === "grog" ? "explore-grog" : "explore-viking"
}

function musicGain() {
  if (muted) return 0
  const bed = mode === "battle" ? 0.34 : mode === "explore" ? 0.22 : 0.3
  const road = driving ? 0.62 : 1
  const duck = ducked ? 0.18 : 1
  return bed * musicLevel * road * duck
}

function applyMusic() {
  if (!musicBus || !ctx) return
  musicBus.gain.setTargetAtTime(musicGain(), ctx.currentTime, 0.08)
}

export function unlockMusic() {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  if (!ctx) {
    ctx = new AC()
    musicBus = ctx.createGain()
    sfxBus = ctx.createGain()
    voiceBus = ctx.createGain()
    musicBus.connect(ctx.destination)
    sfxBus.connect(ctx.destination)
    voiceBus.connect(ctx.destination)
    sfxBus.gain.value = 0.55
    voiceBus.gain.value = 0.95
  }
  void ctx.resume()
  for (const id of ["explore-viking", "explore-grog", "battle-viking", "battle-grog", "victory", "defeat"] as Track[]) {
    if (beds.has(id)) continue
    const audio = new Audio(file(`audio/music/${id}.mp3`))
    audio.preload = "auto"
    audio.loop = id !== "victory" && id !== "defeat"
    beds.set(id, audio)
  }
  void ensure(trackFor())
  applyMusic()
}

export function setMusicMuted(next: boolean) {
  muted = next
  applyMusic()
  if (sfxBus) sfxBus.gain.value = next ? 0 : 0.55
  if (voiceBus) voiceBus.gain.value = next ? 0 : 0.95
}

export function setMusicLevel(level: number) {
  musicLevel = Math.max(0, Math.min(1, level))
  applyMusic()
}

export function setDrivingAudio(next: boolean) {
  driving = next
  applyMusic()
}

export function setMusicFaction(isGrog: boolean) {
  faction = isGrog ? "grog" : "viking"
  if (mode === "explore" || mode === "battle") void ensure(trackFor())
}

export function setMusicBattle(next: boolean) {
  mode = next ? "battle" : "explore"
  void ensure(trackFor())
  applyMusic()
}

export function playSting(win: boolean) {
  mode = win ? "victory" : "defeat"
  const audio = beds.get(trackFor())
  if (audio) audio.currentTime = 0
  void ensure(trackFor())
  window.setTimeout(() => {
    if (mode === "victory" || mode === "defeat") {
      mode = "explore"
      void ensure(trackFor())
    }
  }, win ? 5000 : 4500)
}

async function ensure(id: Track) {
  if (aliveId === id && alive && !alive.paused) return
  const next = beds.get(id)
  if (!next) return
  next.loop = id !== "victory" && id !== "defeat"
  if (alive && alive !== next) {
    const prev = alive
    fade(prev, 0).then(() => { prev.pause() })
  }
  alive = next
  aliveId = id
  try {
    await next.play()
    await fade(next, 1)
  } catch {
    /* autoplay waits for a gesture */
  }
}

function fade(audio: HTMLAudioElement, to: number) {
  const from = audio.volume
  const started = performance.now()
  fading += 1
  const mine = fading
  return new Promise<void>((resolve) => {
    const step = () => {
      if (mine !== fading && to === 1) { resolve(); return }
      const t = Math.min(1, (performance.now() - started) / 1200)
      audio.volume = from + (to - from) * t
      if (t < 1) requestAnimationFrame(step)
      else resolve()
    }
    step()
  })
}

export function playSfx(name: SfxName) {
  if (muted) return
  const audio = new Audio(file(`audio/sfx/${name}.mp3`))
  audio.volume = (driving ? 0.45 : 0.7) * (ducked ? 0.35 : 1)
  void audio.play().catch(() => {})
}

export function playVoice(id: string, line: VoiceLine): Promise<void> {
  if (muted) return Promise.resolve()
  return playFile(file(`audio/voices/${id}/${line}.mp3`), true)
}

export async function narrate(text: string): Promise<void> {
  if (muted || !text.trim()) return
  ducked = true
  applyMusic()
  try {
    const res = await fetch("/api/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 420) }),
    })
    if (!res.ok) throw new Error("narrator")
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    await playFile(url, true)
    URL.revokeObjectURL(url)
  } catch {
    await browserSpeak(text)
  } finally {
    ducked = false
    applyMusic()
  }
}

function playFile(src: string, voice: boolean): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(src)
    audio.volume = voice ? 1 : 0.8
    if (voice) {
      ducked = true
      applyMusic()
    }
    const done = () => {
      if (voice) {
        ducked = false
        applyMusic()
      }
      resolve()
    }
    audio.onended = done
    audio.onerror = done
    void audio.play().catch(done)
  })
}

function browserSpeak(text: string): Promise<void> {
  if (!("speechSynthesis" in window)) return Promise.resolve()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = "en-CA"
    u.rate = 0.96
    u.pitch = 0.95
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}

export function duckSpeech(on: boolean) {
  ducked = on
  applyMusic()
}
