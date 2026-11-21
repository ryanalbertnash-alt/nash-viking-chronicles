import { apiUrl } from "@/native.ts"

const file = (path: string) => `${import.meta.env.BASE_URL}${path}`

export type SfxName = "clash" | "sword" | "axe" | "shield" | "horn" | "drums" | "roar" | "oars" | "coins" | "drink" | "bell" | "arrow"
export type VoiceLine = "recruit" | "cry" | "victory" | "defeat" | "low"
export type MusicScene = "village" | "march" | "battle"

let ctx: AudioContext | null = null
let musicBus: GainNode | null = null
let sfxBus: GainNode | null = null
let voiceBus: GainNode | null = null
let musicLevel = 0.7
let muted = false
let driving = false
let ducked = false
let faction: "viking" | "grog" = "viking"
let scene: MusicScene = "village"
let mode: MusicScene | "victory" | "defeat" = "village"
let current: HTMLAudioElement | null = null
let currentId = ""
const beds = new Map<string, HTMLAudioElement>()

function musicGain() {
  if (muted) return 0
  const bed = mode === "battle" ? 0.42 : mode === "march" ? 0.32 : mode === "village" ? 0.28 : 0.36
  const road = driving ? 0.62 : 1
  const duck = ducked ? 0.16 : 1
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
  syncMusic()
  applyMusic()
}

export function setMusicScene(next: MusicScene) {
  scene = next
  if (mode === "victory" || mode === "defeat") return
  mode = next
  syncMusic()
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
  if (next) scene = "march"
  else if (scene === "march") scene = "village"
  if (mode !== "battle" && mode !== "victory" && mode !== "defeat") mode = scene
  syncMusic()
  applyMusic()
}

export function setMusicFaction(isGrog: boolean) {
  faction = isGrog ? "grog" : "viking"
  if (current) current.playbackRate = isGrog ? 0.94 : 1
}

export function setMusicBattle(next: boolean) {
  mode = next ? "battle" : scene === "march" || driving ? "march" : "village"
  syncMusic()
  applyMusic()
}

export function playSting(win: boolean) {
  mode = win ? "victory" : "defeat"
  syncMusic()
  applyMusic()
  window.setTimeout(() => {
    if (mode === "victory" || mode === "defeat") {
      mode = driving ? "march" : scene === "battle" ? "village" : scene
      syncMusic()
      applyMusic()
    }
  }, win ? 7000 : 6400)
}

function scoreId() {
  if (mode === "victory") return "victory-sting"
  if (mode === "defeat") return "defeat-sting"
  if (mode === "battle") return "battle"
  if (mode === "march") return "march"
  return "village"
}

function syncMusic() {
  if (!ctx || !musicBus) return
  const id = scoreId()
  if (currentId === id && current && !current.paused) {
    current.playbackRate = faction === "grog" ? 0.94 : 1
    return
  }
  if (!beds.has(id)) {
    const audio = new Audio(file(`audio/music/${id}.mp3`))
    audio.loop = id !== "victory-sting" && id !== "defeat-sting"
    audio.preload = "auto"
    const src = ctx.createMediaElementSource(audio)
    src.connect(musicBus)
    beds.set(id, audio)
  }
  const next = beds.get(id)
  if (!next) return
  if (current && current !== next) current.pause()
  current = next
  currentId = id
  next.playbackRate = faction === "grog" ? 0.94 : 1
  if (id === "victory-sting" || id === "defeat-sting") next.currentTime = 0
  void next.play().catch(() => {})
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
    const res = await fetch(apiUrl("/api/narrate"), {
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
