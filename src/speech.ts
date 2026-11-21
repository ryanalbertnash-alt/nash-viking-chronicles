import { duckSpeech } from "@/audio"
import type { Faction } from "@/shared/types.ts"

type Listener = (text: string) => void
let caption: Listener = () => {}
let faction: Faction | null = "viking"
let queue: string[] = []
let speaking = false
let paused = false
let resumeListen: (() => void) | null = null

export function onCaption(fn: Listener) {
  caption = fn
}

export function setVoiceFaction(next: Faction | null) {
  faction = next
}

export function canListen(): boolean {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}

export function unlockSpeech() {
  if (!("speechSynthesis" in window)) return
  const u = new SpeechSynthesisUtterance(" ")
  u.volume = 0
  window.speechSynthesis.speak(u)
}

export function speak(text: string, now = false) {
  if (!text.trim()) return
  caption(text)
  if (!("speechSynthesis" in window)) return
  if (now) {
    queue = []
    window.speechSynthesis.cancel()
    speaking = false
  }
  for (const part of chunks(text)) queue.push(part)
  pump()
}

function chunks(text: string): string[] {
  if (text.length < 170) return [text]
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text]
  const out: string[] = []
  let cur = ""
  for (const part of parts) {
    if ((cur + part).length > 170 && cur) {
      out.push(cur.trim())
      cur = part
    } else cur += part
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function pump() {
  if (speaking || !queue.length || !("speechSynthesis" in window)) return
  const text = queue.shift()!
  const u = new SpeechSynthesisUtterance(text)
  const grog = faction === "grog"
  u.lang = "en-CA"
  u.pitch = grog ? 0.62 : 0.98
  u.rate = grog ? 0.9 : 0.96
  const voices = window.speechSynthesis.getVoices()
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"))
  const pick = grog
    ? en.find((v) => /daniel|fred|david|rishi|male/i.test(v.name))
    : en.find((v) => /samantha|moira|google uk english female|serena/i.test(v.name))
  if (pick) u.voice = pick
  u.onstart = () => {
    speaking = true
    paused = true
    duckSpeech(true)
  }
  u.onend = () => {
    speaking = false
    if (!queue.length) {
      paused = false
      duckSpeech(false)
      resumeListen?.()
    }
    pump()
  }
  u.onerror = () => {
    speaking = false
    paused = false
    duckSpeech(false)
    pump()
  }
  window.speechSynthesis.speak(u)
}

type Rec = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((ev: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function ctor(): (new () => Rec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function startAmbient(onFinal: (text: string) => void): () => void {
  const Ctor = ctor()
  if (!Ctor) return () => {}
  let rec: Rec | null = null
  let dead = false
  const boot = () => {
    if (dead || paused) return
    rec = new Ctor()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = "en-CA"
    rec.onresult = (ev) => {
      let text = ""
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) text += ev.results[i][0]?.transcript ?? ""
      }
      if (text.trim()) onFinal(text.trim())
    }
    rec.onerror = () => {}
    rec.onend = () => {
      if (!dead && !paused) window.setTimeout(boot, 350)
    }
    try { rec.start() } catch { /* already started */ }
  }
  resumeListen = () => { if (!dead) boot() }
  boot()
  return () => {
    dead = true
    resumeListen = null
    try { rec?.stop() } catch { /* already stopped */ }
  }
}

export function listenOnce(ms = 6500): Promise<string> {
  const Ctor = ctor()
  if (!Ctor) return Promise.resolve("")
  return new Promise((resolve) => {
    const rec = new Ctor()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = "en-CA"
    let said = ""
    const finish = () => resolve(said.trim())
    const timer = window.setTimeout(() => {
      try { rec.stop() } catch { /* noop */ }
      finish()
    }, ms)
    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) said += ev.results[i][0]?.transcript ?? ""
    }
    rec.onerror = () => { clearTimeout(timer); finish() }
    rec.onend = () => { clearTimeout(timer); finish() }
    try { rec.start() } catch { finish() }
  })
}
