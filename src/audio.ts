const file = (path: string) => `${import.meta.env.BASE_URL}${path}`

export type SfxName = "clash" | "sword" | "axe" | "shield" | "horn" | "drums" | "roar" | "oars" | "coins" | "drink" | "bell"
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
let scheduler = 0
let nextAt = 0
let beat = 0
let noise: AudioBuffer | null = null

const LYRE = [146.83, 174.61, 196, 220, 261.63, 293.66]

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
  if (!noise) {
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (!scheduler) {
    nextAt = ctx.currentTime + 0.05
    scheduler = window.setInterval(scheduleScore, 120)
  }
  applyMusic()
}

export function setMusicScene(next: MusicScene) {
  scene = next
  if (mode === "victory" || mode === "defeat") return
  mode = next
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
  applyMusic()
}

export function setMusicFaction(isGrog: boolean) {
  faction = isGrog ? "grog" : "viking"
}

export function setMusicBattle(next: boolean) {
  mode = next ? "battle" : scene === "march" || driving ? "march" : "village"
  applyMusic()
}

export function playSting(win: boolean) {
  mode = win ? "victory" : "defeat"
  beat = 0
  applyMusic()
  window.setTimeout(() => {
    if (mode === "victory" || mode === "defeat") {
      mode = driving ? "march" : scene === "battle" ? "village" : scene
      applyMusic()
    }
  }, win ? 4200 : 3800)
}

function scheduleScore() {
  if (!ctx || !musicBus) return
  const horizon = ctx.currentTime + 0.42
  const step = mode === "battle" ? 0.21 : mode === "march" ? 0.28 : mode === "village" ? 0.7 : 0.32
  while (nextAt < horizon) {
    const drop = faction === "grog" ? 0.94 : 1
    if (mode === "village") villageBeat(nextAt, drop)
    else if (mode === "march") marchBeat(nextAt, drop)
    else if (mode === "battle") battleBeat(nextAt, drop)
    else stingBeat(nextAt, mode === "victory", drop)
    nextAt += step
    beat += 1
  }
}

function villageBeat(time: number, drop: number) {
  drone(time, 73.4 * drop, 0.7, 0.03)
  if (beat % 2 === 0) pluck(time, LYRE[beat % LYRE.length] * drop, 0.9, 0.045)
  if (beat % 4 === 0) drum(time, 0.08, 90)
}

function marchBeat(time: number, drop: number) {
  drum(time, beat % 2 === 0 ? 0.16 : 0.09, beat % 4 === 0 ? 78 : 110)
  if (beat % 2 === 0) horn(time, (beat % 4 === 0 ? 146.8 : 220) * drop, 0.26, 0.05)
  if (beat % 4 === 2) pluck(time, 196 * drop, 0.35, 0.03)
  drone(time, 73.4 * drop, 0.28, 0.02)
}

function battleBeat(time: number, drop: number) {
  drum(time, beat % 2 === 0 ? 0.22 : 0.12, 70)
  if (beat % 2 === 1) drum(time + 0.08, 0.08, 160)
  if (beat % 2 === 0) horn(time, (beat % 4 === 0 ? 110 : 164.8) * drop, 0.22, 0.07)
  chant(time, 98 * drop, 0.2)
  if (beat % 4 === 0) horn(time, 220 * drop, 0.16, 0.04)
}

function stingBeat(time: number, win: boolean, drop: number) {
  const up = win ? [146.8, 174.6, 220, 293.7] : [220, 174.6, 146.8, 98]
  const note = up[beat % up.length] * drop
  horn(time, note, 0.45, win ? 0.08 : 0.06)
  if (win && beat % 2 === 0) pluck(time, note * 2, 0.4, 0.04)
  drum(time, win ? 0.1 : 0.06, win ? 120 : 60)
}

function drone(time: number, freq: number, dur: number, gain: number) {
  tone(time, freq, dur, "sine", gain)
  tone(time, freq * 1.5, dur, "triangle", gain * 0.35)
}

function pluck(time: number, freq: number, dur: number, gain: number) {
  tone(time, freq, dur, "triangle", gain)
  tone(time, freq * 2.01, dur * 0.6, "sine", gain * 0.25)
}

function horn(time: number, freq: number, dur: number, gain: number) {
  tone(time, freq, dur, "sawtooth", gain * 0.45)
  tone(time, freq * 1.5, dur * 0.8, "triangle", gain * 0.2)
}

function chant(time: number, freq: number, dur: number) {
  tone(time, freq, dur, "sine", 0.03)
  tone(time, freq * 1.498, dur, "sine", 0.02)
}

function drum(time: number, gain: number, freq: number) {
  if (!ctx || !musicBus) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = "sine"
  o.frequency.setValueAtTime(freq, time)
  o.frequency.exponentialRampToValueAtTime(42, time + 0.14)
  g.gain.setValueAtTime(gain, time)
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18)
  o.connect(g)
  g.connect(musicBus)
  o.start(time)
  o.stop(time + 0.2)
  if (!noise) return
  const src = ctx.createBufferSource()
  src.buffer = noise
  const filter = ctx.createBiquadFilter()
  filter.type = "highpass"
  filter.frequency.value = 900
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(gain * 0.45, time)
  ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.08)
  src.connect(filter)
  filter.connect(ng)
  ng.connect(musicBus)
  src.start(time)
  src.stop(time + 0.09)
}

function tone(time: number, freq: number, dur: number, type: OscillatorType, gain: number) {
  if (!ctx || !musicBus || gain <= 0) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.value = type === "sawtooth" ? 900 : 1800
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, time)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), time + 0.03)
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
  o.connect(filter)
  filter.connect(g)
  g.connect(musicBus)
  o.start(time)
  o.stop(time + dur + 0.02)
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
