#!/usr/bin/env python3
"""Original soundtrack plus eSpeak NG character lines for Nash's Viking Chronicles."""
from __future__ import annotations

import math
import os
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "public" / "audio"
SR = 22050

# Distinct eSpeak voices. Pitch is 0-99. Grogs are pitched down again in ffmpeg.
CAST = {
    "ralph": ("en-gb-x-rp", 32, 118, False),
    "donna": ("en+f3", 40, 122, False),
    "ryan": ("en-gb", 50, 142, False),
    "billy": ("en-us-nyc", 64, 176, False),
    "landin": ("en-gb-scotland", 38, 128, False),
    "gavin": ("en-gb-x-gbclan", 54, 138, False),
    "haydin": ("en-gb-scotland", 60, 150, False),
    "kali": ("en+f4", 52, 140, False),
    "area": ("en+f5", 66, 156, False),
    "jesse": ("en-us", 48, 158, False),
    "jayden": ("en+f2", 70, 162, False),
    "james": ("en-gb-x-gbcwmd", 36, 124, False),
    "lana": ("en+f3", 58, 148, False),
    "anna": ("en+f3", 46, 128, False),
    "alain": ("en-gb-x-rp", 44, 134, False),
    "emma": ("en+f4", 60, 144, False),
    "gorgrath": ("en+m1", 18, 108, True),
    "mogdura": ("en+f5", 24, 102, True),
    "brakka": ("en+m2", 12, 88, True),
    "zug": ("en+m3", 28, 168, True),
    "sharga": ("en+f2", 30, 138, True),
    "krull": ("en+m4", 26, 152, True),
    "grimtusk": ("en+m1", 16, 112, True),
    "urzog": ("en+m1", 8, 76, True),
}

LINES = {
    "ralph": {
        "recruit": "The old oath holds. Ralph Nash will stand with you.",
        "cry": "The hall stands!",
        "victory": "The hall still stands. That is enough.",
        "defeat": "Fall back to the hall. We are not finished.",
        "low": "I am nearly spent. Bind these wounds.",
    },
    "donna": {
        "recruit": "I saw you on the road. Donna Nash will read the runes for you.",
        "cry": "The runes have spoken.",
        "victory": "The runes were right. Take what is yours.",
        "defeat": "The runes warned me. We leave while we can.",
        "low": "My strength thins. A draught, child.",
    },
    "ryan": {
        "recruit": "Ryan Nash. Axe and shield. I march at the front.",
        "cry": "For the Nash! Hold the line!",
        "victory": "The line held. Chesterville would be proud.",
        "defeat": "We gave ground. We will take it back.",
        "low": "Still standing. Barely. Heal me.",
    },
    "billy": {
        "recruit": "Billy Nash. Two axes. Point me at them.",
        "cry": "Blood and axes!",
        "victory": "Ha! They broke. I want another.",
        "defeat": "Not enough blood. I hate losing.",
        "low": "I can still swing. Get me up.",
    },
    "landin": {
        "recruit": "Landin Nash. My shield is yours.",
        "cry": "Shields up!",
        "victory": "The wall held. Nobody passed.",
        "defeat": "Shields down. Reform behind me.",
        "low": "The shield is heavy. I need a rest.",
    },
    "gavin": {
        "recruit": "Gavin Nash. I fight clean, and I finish it.",
        "cry": "Steel, not noise.",
        "victory": "Measured, and done.",
        "defeat": "A poor cut. We withdraw.",
        "low": "I am cut. It is not deep. Yet.",
    },
    "haydin": {
        "recruit": "Haydin Nash. I hunt from the tree line.",
        "cry": "Loose!",
        "victory": "They never saw the shafts.",
        "defeat": "Out of arrows. Out of time.",
        "low": "I can't draw. My arm is gone numb.",
    },
    "kali": {
        "recruit": "Kali Nash. None pass my shield.",
        "cry": "None pass!",
        "victory": "None passed. The gate is ours.",
        "defeat": "They passed. I will not forgive that.",
        "low": "I held as long as I could.",
    },
    "area": {
        "recruit": "Area Nash. The sky answers when I call.",
        "cry": "The sky answers!",
        "victory": "Lightning took them. The road is clear.",
        "defeat": "The storm broke the wrong way.",
        "low": "The lightning hurts me too. Help.",
    },
    "jesse": {
        "recruit": "Jesse Nash. I know where they keep the gold.",
        "cry": "Take it all!",
        "victory": "Sack it. Every coin.",
        "defeat": "Empty handed. I hate that.",
        "low": "Leave me the gold. And a bandage.",
    },
    "jayden": {
        "recruit": "Jayden Nash. I was already behind them.",
        "cry": "Already behind you.",
        "victory": "Flanked, and finished.",
        "defeat": "They saw me. We run.",
        "low": "Too slow. I'm bleeding.",
    },
    "james": {
        "recruit": "James Nash. Hot iron, and a hammer that means it.",
        "cry": "Hot iron!",
        "victory": "Tempered, and true. The gate is down.",
        "defeat": "Back to the forge. We mend, then we return.",
        "low": "Even iron cracks. I need the fire and a draught.",
    },
    "lana": {
        "recruit": "Lana Nash. Pick a mark. I will hit it.",
        "cry": "On the wind.",
        "victory": "One shot. One mark. Done.",
        "defeat": "The wind turned. So do we.",
        "low": "I can't hold the string.",
    },
    "anna": {
        "recruit": "Anna Nash. Stay with me, and I will keep you standing.",
        "cry": "Stay with me.",
        "victory": "They live. That is the victory I wanted.",
        "defeat": "Bring them to me. I can still help.",
        "low": "I cannot heal myself this time.",
    },
    "alain": {
        "recruit": "Alain Nash. The jarl's champion. The debt comes due.",
        "cry": "The jarl's due!",
        "victory": "Paid in full.",
        "defeat": "A debt delayed. Not forgiven.",
        "low": "Champions bleed too. Quickly.",
    },
    "emma": {
        "recruit": "Emma Nash. I choose who falls. It will not be you.",
        "cry": "Not this one.",
        "victory": "I kept them. All of them.",
        "defeat": "I could not choose fast enough.",
        "low": "Even I am fading. Don't let me fall.",
    },
    "gorgrath": {
        "recruit": "Gorgrath. Skulls. I split them.",
        "cry": "Split them!",
        "victory": "Broken. The sack is mine.",
        "defeat": "Grahh. We come back louder.",
        "low": "Not dead. Angry.",
    },
    "mogdura": {
        "recruit": "Mog'Dura. The bones already know your name.",
        "cry": "Bones hear me.",
        "victory": "Their bones joined mine.",
        "defeat": "The bones went quiet. Bad sign.",
        "low": "My own bones ache. Bloodrite. Now.",
    },
    "brakka": {
        "recruit": "Brakka. Hit me. You can't.",
        "cry": "Can't dent me.",
        "victory": "Still standing. They are not.",
        "defeat": "Dented. I hate dents.",
        "low": "Something got through. Fix it.",
    },
    "zug": {
        "recruit": "Zug. Guts. I rip them.",
        "cry": "Guts!",
        "victory": "Messy. Good.",
        "defeat": "Not enough guts. Mine are leaking.",
        "low": "Still ripping. Slower.",
    },
    "sharga": {
        "recruit": "Sharga Blackfang. One arrow. One throat.",
        "cry": "One fang is enough.",
        "victory": "Fang found meat.",
        "defeat": "Missed. I don't miss twice.",
        "low": "The fang arm shakes.",
    },
    "krull": {
        "recruit": "Krull. The wolf runs first. I follow.",
        "cry": "Run them down!",
        "victory": "The wolf ate well.",
        "defeat": "The wolf wants to leave. So do I.",
        "low": "The wolf is limping. So am I.",
    },
    "grimtusk": {
        "recruit": "Grimtusk. I forge the ugly things that win.",
        "cry": "From the forge!",
        "victory": "Scrap won. As I said it would.",
        "defeat": "Back to the anvil.",
        "low": "The smith is bent. Not broken.",
    },
    "urzog": {
        "recruit": "Urzog. The mountain walks with you now.",
        "cry": "The mountain walks.",
        "victory": "The mountain sat on them.",
        "defeat": "Even mountains stumble.",
        "low": "The mountain... is tired.",
    },
}


def midi(n: float) -> float:
    return 440.0 * (2.0 ** ((n - 69.0) / 12.0))


def adsr(n: int, a=0.01, d=0.08, s=0.7, r=0.12, sr=SR) -> np.ndarray:
    na, nd, nr = int(a * sr), int(d * sr), int(r * sr)
    ns = max(0, n - na - nd - nr)
    env = np.concatenate([
        np.linspace(0, 1, max(na, 1), endpoint=False),
        np.linspace(1, s, max(nd, 1), endpoint=False),
        np.full(ns, s),
        np.linspace(s, 0, max(nr, 1), endpoint=False),
    ])
    if len(env) < n:
        env = np.pad(env, (0, n - len(env)))
    return env[:n]


def osc(freq, n, kind="saw", phase=0.0):
    t = (np.arange(n) / SR) * freq + phase
    if kind == "sine":
        return np.sin(2 * math.pi * t)
    if kind == "square":
        return np.sign(np.sin(2 * math.pi * t))
    if kind == "tri":
        return 2 * np.abs(2 * (t % 1) - 1) - 1
    # band-limited-ish saw
    y = 2 * (t % 1) - 1
    return y


def lowpass(x, cutoff):
    rc = 1.0 / (2 * math.pi * cutoff)
    dt = 1.0 / SR
    a = dt / (rc + dt)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc)
        y[i] = acc
    return y


def note(buf, start, freq, dur, vol, kind="saw", cutoff=1800):
    n = int(dur * SR)
    i0 = int(start * SR)
    if n <= 0 or i0 >= len(buf):
        return
    wave = osc(freq, n, kind) * adsr(n, 0.02, 0.1, 0.65, min(0.2, dur * 0.4))
    if kind != "sine":
        wave = lowpass(wave, cutoff)
    i1 = min(len(buf), i0 + n)
    buf[i0:i1] += wave[: i1 - i0] * vol


def kick(buf, start, vol=0.9):
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    freq = 140 * np.exp(-t * 18) + 42
    phase = np.cumsum(freq) / SR
    wave = np.sin(2 * math.pi * phase) * np.exp(-t * 10)
    i0 = int(start * SR)
    i1 = min(len(buf), i0 + n)
    buf[i0:i1] += wave[: i1 - i0] * vol


def snare(buf, start, vol=0.35):
    n = int(0.16 * SR)
    rng = np.random.default_rng(int(start * 1000) + 3)
    noise = rng.standard_normal(n)
    t = np.arange(n) / SR
    body = np.sin(2 * math.pi * 180 * t) * np.exp(-t * 30)
    wave = (lowpass(noise, 3200) * 0.7 + body) * np.exp(-t * 16)
    i0 = int(start * SR)
    i1 = min(len(buf), i0 + n)
    buf[i0:i1] += wave[: i1 - i0] * vol


def hat(buf, start, vol=0.08):
    n = int(0.04 * SR)
    rng = np.random.default_rng(int(start * 5000) + 9)
    noise = rng.standard_normal(n)
    t = np.arange(n) / SR
    wave = noise * np.exp(-t * 80)
    i0 = int(start * SR)
    i1 = min(len(buf), i0 + n)
    buf[i0:i1] += wave[: i1 - i0] * vol


def render(seconds, seed=1):
    np.random.seed(seed)
    return np.zeros(int(seconds * SR), dtype=np.float64)


def normalize(buf, peak=0.89):
    # tiny edge fade so loops don't click
    fade = int(0.04 * SR)
    ramp = np.linspace(0, 1, fade)
    buf[:fade] *= ramp
    buf[-fade:] *= ramp[::-1]
    m = np.max(np.abs(buf)) or 1
    return np.clip(buf / m * peak, -1, 1)


def write_wav(path: Path, buf: np.ndarray):
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (buf * 32767).astype(np.int16)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def to_mp3(wav: Path, mp3: Path, kbps=112):
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", f"{kbps}k", str(mp3)],
        check=True,
    )
    wav.unlink(missing_ok=True)


def compose_explore(grog: bool):
    bpm = 84 if grog else 96
    beats = 32
    beat = 60 / bpm
    dur = beats * beat
    buf = render(dur)
    root = 34 if grog else 38  # A1 / D2
    fifth = root + (6 if grog else 7)
    for bar in range(8):
        t0 = bar * 4 * beat
        note(buf, t0, midi(root), beat * 4, 0.22, "sine", 400)
        note(buf, t0, midi(fifth), beat * 4, 0.12, "saw", 500 if grog else 700)
        if grog and bar % 2 == 1:
            note(buf, t0, midi(root + 1), beat * 2, 0.08, "square", 300)
    melody = [0, 3, 5, 7, 10, 7, 5, 3] if not grog else [0, 1, 6, 7, 6, 1, 0, 6]
    for i, step in enumerate(melody * 2):
        note(buf, i * beat * 2, midi(root + 24 + step), beat * 1.6, 0.16, "tri", 1400 if not grog else 900)
    for i in range(beats):
        if i % 4 == 0:
            kick(buf, i * beat, 0.55 if not grog else 0.75)
        elif grog and i % 4 == 2:
            kick(buf, i * beat, 0.4)
        if i % 8 == 4:
            snare(buf, i * beat, 0.18 if not grog else 0.28)
        if not grog and i % 2 == 1:
            hat(buf, i * beat, 0.05)
    return normalize(buf, 0.8)


def compose_battle(grog: bool):
    bpm = 138 if grog else 126
    beats = 32
    beat = 60 / bpm
    buf = render(beats * beat, seed=7 if grog else 3)
    root = 33 if grog else 38
    ost = [0, 0, 3, 1] if grog else [0, 0, 3, 5]
    for i in range(beats):
        kick(buf, i * beat, 0.85)
        if i % 2 == 1:
            snare(buf, i * beat, 0.42)
        if i % 2 == 0:
            hat(buf, i * beat + beat * 0.5, 0.07)
        step = ost[i % 4]
        note(buf, i * beat, midi(root + step), beat * 0.9, 0.2, "saw", 900 if grog else 1400)
        note(buf, i * beat, midi(root + 12 + step), beat * 0.45, 0.1, "square", 1600)
    # brass stab every 4 beats
    for bar in range(8):
        chord = [0, 7, 10] if not grog else [0, 6, 13]
        for c in chord:
            note(buf, bar * 4 * beat, midi(root + 24 + c), beat * 1.2, 0.12, "saw", 1800)
    return normalize(buf, 0.86)


def compose_victory():
    beat = 60 / 110
    buf = render(8 * beat, seed=11)
    root = 50
    for i, step in enumerate([0, 4, 7, 12]):
        note(buf, i * beat, midi(root + step), beat * 1.4, 0.28, "tri", 2200)
        note(buf, i * beat, midi(root - 12 + step), beat * 1.6, 0.18, "sine", 600)
        kick(buf, i * beat, 0.4)
    note(buf, 4 * beat, midi(root + 12), beat * 3.5, 0.3, "saw", 2000)
    return normalize(buf, 0.84)


def compose_defeat():
    beat = 60 / 72
    buf = render(8 * beat, seed=13)
    root = 36
    for i, step in enumerate([12, 10, 7, 1]):
        note(buf, i * beat * 1.4, midi(root + step), beat * 1.8, 0.26, "sine", 500)
        note(buf, i * beat * 1.4, midi(root + step + 1), beat * 1.5, 0.08, "saw", 400)
    return normalize(buf, 0.75)


def synth_horn(path: Path):
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    f = 196
    y = np.sin(2 * math.pi * f * t)
    y += 0.5 * np.sin(2 * math.pi * f * 2 * t)
    y += 0.25 * np.sin(2 * math.pi * f * 3 * t)
    y += 0.12 * np.sin(2 * math.pi * f * 4 * t)
    y *= adsr(n, 0.08, 0.2, 0.7, 0.45)
    # slight pitch rise
    write_wav(path, normalize(y, 0.8))


def synth_drums(path: Path):
    beat = 60 / 120
    buf = render(4 * beat, seed=21)
    for i in range(4):
        kick(buf, i * beat, 0.9)
        if i % 2 == 1:
            snare(buf, i * beat, 0.45)
        hat(buf, i * beat + beat / 2, 0.1)
    write_wav(path, normalize(buf, 0.86))


def synth_drink(path: Path):
    rng = np.random.default_rng(4)
    n = int(0.45 * SR)
    y = np.zeros(n)
    for k in range(6):
        i0 = int((0.03 + k * 0.06) * SR)
        m = int(0.05 * SR)
        bubble = np.sin(2 * math.pi * (600 + k * 90) * np.arange(m) / SR)
        bubble *= np.exp(-np.arange(m) / SR * 30)
        y[i0:i0 + m] += bubble * 0.4
    gulp = lowpass(rng.standard_normal(n), 800) * np.exp(-np.arange(n) / SR * 6) * 0.15
    write_wav(path, normalize(y + gulp, 0.7))


def synth_waves(path: Path, creak: Path | None):
    rng = np.random.default_rng(8)
    n = int(2.2 * SR)
    noise = rng.standard_normal(n)
    water = lowpass(noise, 700) * (0.4 + 0.3 * np.sin(2 * math.pi * 0.4 * np.arange(n) / SR))
    write_wav(path, normalize(water, 0.55))
    if creak and creak.exists():
        mixed = path.with_suffix(".mix.wav")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-i", str(creak),
             "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=first:weights=1 0.45",
             str(mixed)],
            check=True,
        )
        mixed.replace(path)


def grit(src: Path, dst: Path, amount: float):
    rate = 0.58 if amount > 0.8 else 0.7
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af",
         f"asetrate={SR}*{rate},aresample={SR},highpass=f=80,lowpass=f=2100,"
         f"equalizer=f=160:width_type=h:width=140:g=8,volume=2.0",
         str(dst)],
        check=True,
    )


def espeak(text: str, voice: str, pitch: int, speed: int, wav: Path):
    subprocess.run(
        ["espeak-ng", "-v", voice, "-p", str(pitch), "-s", str(speed), "-w", str(wav), text],
        check=True,
    )


def build_voices():
    out = AUDIO / "voices"
    tmp = Path("/tmp/nvc-voices")
    tmp.mkdir(exist_ok=True)
    for cid, (voice, pitch, speed, grog) in CAST.items():
        folder = out / cid
        folder.mkdir(parents=True, exist_ok=True)
        for key, text in LINES[cid].items():
            raw = tmp / f"{cid}-{key}.wav"
            espeak(text, voice, pitch, speed, raw)
            if grog:
                grit(raw, raw.with_suffix(".grit.wav"), 1.0 if cid != "sharga" else 0.7)
                src = raw.with_suffix(".grit.wav")
            else:
                src = raw
            to_mp3(src, folder / f"{key}.mp3", 64)
            raw.unlink(missing_ok=True)
            raw.with_suffix(".grit.wav").unlink(missing_ok=True)
        print("voice", cid)


def build_music():
    folder = AUDIO / "music"
    folder.mkdir(parents=True, exist_ok=True)
    pieces = {
        "explore-viking": compose_explore(False),
        "explore-grog": compose_explore(True),
        "battle-viking": compose_battle(False),
        "battle-grog": compose_battle(True),
        "victory": compose_victory(),
        "defeat": compose_defeat(),
    }
    for name, buf in pieces.items():
        wav = folder / f"{name}.wav"
        write_wav(wav, buf)
        to_mp3(wav, folder / f"{name}.mp3", 128)
        print("music", name, (folder / f"{name}.mp3").stat().st_size)


def build_sfx():
    folder = AUDIO / "sfx"
    folder.mkdir(parents=True, exist_ok=True)
    kenney = Path("/tmp/sfx/Audio")
    subprocess.run(["unzip", "-o", "-q", "/tmp/sfx/impact.zip", "-d", "/tmp/sfx/impact"], check=True)
    subprocess.run(["unzip", "-o", "-q", "/tmp/sfx/rpg.zip", "-d", "/tmp/sfx/rpg"], check=True)
    impact = Path("/tmp/sfx/impact/Audio")
    rpg = Path("/tmp/sfx/rpg/Audio")

    def convert(src: Path, name: str):
        to_mp3(src, folder / name, 128) if src.suffix == ".wav" else subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-codec:a", "libmp3lame", "-b:a", "128k", str(folder / name)],
            check=True,
        )

    # Real Kenney CC0 recordings.
    convert(impact / "impactMetal_heavy_000.ogg", "clash.mp3")
    convert(rpg / "knifeSlice.ogg", "sword.mp3")
    convert(impact / "impactPlate_heavy_000.ogg", "shield.mp3")
    convert(impact / "impactWood_heavy_000.ogg", "shield-wood.mp3")
    convert(rpg / "chop.ogg", "axe.mp3")
    convert(rpg / "handleCoins.ogg", "coins.mp3")
    convert(impact / "impactBell_heavy_000.ogg", "bell.mp3")
    # Original effects for the ones Kenney does not cover, plus a roar from eSpeak.
    horn = Path("/tmp/horn.wav")
    drums = Path("/tmp/drums.wav")
    drink = Path("/tmp/drink.wav")
    waves = Path("/tmp/waves.wav")
    synth_horn(horn)
    synth_drums(drums)
    synth_drink(drink)
    synth_waves(waves, rpg / "creak1.ogg")
    for src, name in ((horn, "horn.mp3"), (drums, "drums.mp3"), (drink, "drink.mp3"), (waves, "oars.mp3")):
        to_mp3(src, folder / name, 128)
    roar = Path("/tmp/roar.wav")
    espeak("Hraaaaaagh!", "en+m1", 6, 70, roar)
    grit(roar, roar.with_suffix(".grit.wav"), 1)
    to_mp3(roar.with_suffix(".grit.wav"), folder / "roar.mp3", 96)
    print("sfx", sorted(p.name for p in folder.iterdir()))


if __name__ == "__main__":
    build_music()
    build_sfx()
    build_voices()
    print("done", AUDIO)
