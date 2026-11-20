let ctx: AudioContext | null = null
let master: GainNode | null = null
let droneA: OscillatorNode | null = null
let droneB: OscillatorNode | null = null
let timer = 0
let battle = false
let muted = false
let grog = false

export function unlockMusic() {
  if (!ctx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    ctx = new Ctx()
    master = ctx.createGain()
    master.gain.value = 0.16
    master.connect(ctx.destination)
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = 280
    filter.connect(master)
    droneA = ctx.createOscillator()
    droneB = ctx.createOscillator()
    droneA.type = "sine"
    droneB.type = "triangle"
    droneA.frequency.value = 55
    droneB.frequency.value = 82.4
    const g1 = ctx.createGain()
    const g2 = ctx.createGain()
    g1.gain.value = 0.35
    g2.gain.value = 0.08
    droneA.connect(g1).connect(filter)
    droneB.connect(g2).connect(filter)
    droneA.start()
    droneB.start()
    pulse()
  }
  void ctx.resume()
  applyMute()
}

export function setMusicMuted(next: boolean) {
  muted = next
  applyMute()
}

export function setMusicFaction(isGrog: boolean) {
  grog = isGrog
  if (!droneA || !droneB) return
  droneA.frequency.value = isGrog ? 49 : 55
  droneB.frequency.value = isGrog ? 73.4 : 82.4
}

export function setMusicBattle(next: boolean) {
  battle = next
}

function applyMute() {
  if (!master || !ctx) return
  master.gain.setTargetAtTime(muted ? 0 : battle ? 0.22 : 0.15, ctx.currentTime, 0.05)
}

function pulse() {
  if (!ctx || !master) return
  const t = ctx.currentTime
  hit(t, grog ? 90 : 110, 0.22)
  if (battle) hit(t + 0.28, 70, 0.12)
  const wait = battle ? 560 : 1400
  timer = window.setTimeout(pulse, wait)
}

function hit(time: number, freq: number, gain: number) {
  if (!ctx || !master) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = "sine"
  o.frequency.setValueAtTime(freq, time)
  o.frequency.exponentialRampToValueAtTime(36, time + 0.16)
  g.gain.setValueAtTime(gain, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.22)
  o.connect(g).connect(master)
  o.start(time)
  o.stop(time + 0.24)
}

export function stopMusic() {
  if (timer) window.clearTimeout(timer)
  droneA?.stop()
  droneB?.stop()
  void ctx?.close()
  ctx = null
}
