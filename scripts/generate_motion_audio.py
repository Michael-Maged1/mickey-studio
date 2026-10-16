from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1] / "assets" / "motion-audio"
RATE = 22050
DURATION = 32.0
FRAMES = int(RATE * DURATION)


def midi(number: int) -> float:
    return 440.0 * (2.0 ** ((number - 69) / 12.0))


def pan_stereo(signal: np.ndarray, pan: float) -> np.ndarray:
    angle = (max(-1.0, min(1.0, pan)) + 1.0) * math.pi / 4.0
    return np.column_stack((signal * math.cos(angle), signal * math.sin(angle)))


def add_note(mix: np.ndarray, start: float, length: float, frequency: float, amplitude: float,
             voice: str = "pluck", pan: float = 0.0, phase: float = 0.0) -> None:
    begin = max(0, int(start * RATE))
    end = min(FRAMES, int((start + length) * RATE))
    if end <= begin:
        return
    t = np.arange(end - begin, dtype=np.float64) / RATE
    attack = min(0.18, max(0.008, length * 0.18))
    release = min(0.45 if voice == "pad" else 0.18, max(0.02, length * 0.35))
    envelope = np.minimum(1.0, t / attack)
    envelope *= np.minimum(1.0, np.maximum(0.0, (length - t) / release))
    if voice == "pad":
        wobble = np.sin(2 * np.pi * 0.12 * t) * 0.7
        wave_value = (np.sin(2 * np.pi * frequency * t + phase + wobble) * 0.66
                      + np.sin(2 * np.pi * frequency * 2.003 * t + phase) * 0.22
                      + np.sin(2 * np.pi * frequency * 3.0 * t + phase) * 0.08)
    elif voice == "bass":
        wave_value = np.sin(2 * np.pi * frequency * t + phase) * 0.72
        wave_value += np.sin(2 * np.pi * frequency * 2 * t + phase) * 0.2
    elif voice == "bell":
        wave_value = np.sin(2 * np.pi * frequency * t + phase) * 0.72
        wave_value += np.sin(2 * np.pi * frequency * 2.76 * t + phase) * 0.2
        wave_value += np.sin(2 * np.pi * frequency * 4.1 * t + phase) * 0.08
        envelope *= np.exp(-t * 2.8)
    else:
        wave_value = np.sin(2 * np.pi * frequency * t + phase) * 0.78
        wave_value += np.sin(2 * np.pi * frequency * 2.01 * t + phase) * 0.16
        envelope *= np.exp(-t * 1.7)
    mix[begin:end] += pan_stereo(wave_value * envelope * amplitude, pan)


def add_drum(mix: np.ndarray, start: float, kind: str, amount: float = 0.1) -> None:
    length = 0.28 if kind == "kick" else 0.12
    begin = int(start * RATE)
    end = min(FRAMES, begin + int(length * RATE))
    if begin < 0 or end <= begin:
        return
    t = np.arange(end - begin, dtype=np.float64) / RATE
    if kind == "kick":
        frequency = 82 - 38 * np.minimum(1, t / 0.2)
        phase = 2 * np.pi * np.cumsum(frequency) / RATE
        signal = np.sin(phase) * np.exp(-t * 19) * amount
    elif kind == "snare":
        noise = np.random.default_rng(int(start * 100000 + 31)).uniform(-1, 1, len(t))
        signal = (noise * 0.74 + np.sin(2 * np.pi * 190 * t) * 0.26) * np.exp(-t * 32) * amount
    else:
        noise = np.random.default_rng(int(start * 100000 + 13)).uniform(-1, 1, len(t))
        signal = noise * np.exp(-t * 44) * amount
    mix[begin:end] += pan_stereo(signal, 0.12 if kind == "hat" else 0.0)


TRACKS = {
    "social_upbeat": {"bpm": 120, "key": 60, "progression": [0, 7, 9, 5], "scale": [0, 4, 7, 11, 12, 16, 19], "brightness": 1.0, "drums": True, "bell": False},
    "kids_playful": {"bpm": 112, "key": 60, "progression": [0, 5, 7, 0], "scale": [0, 2, 4, 7, 9, 12, 14], "brightness": 1.12, "drums": True, "bell": True},
    "tech_corporate": {"bpm": 110, "key": 62, "progression": [0, 9, 5, 7], "scale": [0, 2, 4, 7, 9, 12, 14], "brightness": 0.78, "drums": False, "bell": False},
    "luxury_ambient": {"bpm": 84, "key": 57, "progression": [0, 7, 9, 5], "scale": [0, 2, 4, 7, 9, 12, 14], "brightness": 0.58, "drums": False, "bell": True},
    "cyber_drive": {"bpm": 124, "key": 54, "progression": [0, 3, 10, 7], "scale": [0, 3, 5, 7, 10, 12, 15], "brightness": 1.0, "drums": True, "bell": False},
    "cinematic_inspire": {"bpm": 96, "key": 57, "progression": [0, 5, 9, 7], "scale": [0, 4, 7, 11, 12, 16, 19], "brightness": 0.8, "drums": False, "bell": True},
    "stats_pulse": {"bpm": 116, "key": 62, "progression": [0, 5, 9, 7], "scale": [0, 2, 4, 7, 9, 12, 14], "brightness": 0.82, "drums": True, "bell": False},
}


def make_music(identifier: str, spec: dict) -> np.ndarray:
    np.random.seed(sum(ord(char) for char in identifier))
    mix = np.zeros((FRAMES, 2), dtype=np.float64)
    beat = 60.0 / spec["bpm"]
    bar = beat * 4
    progression = spec["progression"]
    scale = spec["scale"]
    root = spec["key"]
    for bar_index in range(math.ceil(DURATION / bar)):
        start = bar_index * bar
        offset = progression[bar_index % len(progression)]
        chord_root = root + offset
        chord = [chord_root, chord_root + 4, chord_root + 7]
        if identifier in ("luxury_ambient", "cinematic_inspire"):
            chord = [chord_root, chord_root + 3 if identifier == "luxury_ambient" else chord_root + 4, chord_root + 7, chord_root + 12]
        for note_index, note in enumerate(chord):
            add_note(mix, start, bar + 0.65, midi(note - 12), 0.037 * spec["brightness"], "pad", (-0.52 if note_index % 2 == 0 else 0.52), note_index * 0.3)
        bass_note = chord_root - 24
        for beat_index in (0, 2):
            add_note(mix, start + beat * beat_index, beat * 1.8, midi(bass_note), 0.105, "bass", -0.08)
        arp_step = beat / 2
        for step in range(8):
            pitch = root + offset + 12 + scale[(step + bar_index) % len(scale)]
            pan = math.sin((bar_index * 8 + step) * 0.53) * 0.55
            voice = "bell" if spec["bell"] and step in (3, 7) else "pluck"
            amp = (0.055 if voice == "bell" else 0.042) * spec["brightness"]
            add_note(mix, start + step * arp_step, arp_step * 0.95, midi(pitch), amp, voice, pan)
        if spec["drums"]:
            for beat_index in range(4):
                moment = start + beat_index * beat
                if beat_index in (0, 2):
                    add_drum(mix, moment, "kick", 0.13 if identifier != "kids_playful" else 0.09)
                elif identifier != "kids_playful":
                    add_drum(mix, moment, "snare", 0.045)
                for half in (0, 1):
                    add_drum(mix, moment + half * beat / 2, "hat", 0.018 if half == 0 else 0.011)
    # Gentle stereo modulation and a short, click-free loop boundary.
    envelope = np.ones(FRAMES, dtype=np.float64)
    edge = int(RATE * 0.08)
    envelope[:edge] = np.linspace(0.0, 1.0, edge)
    envelope[-edge:] = np.linspace(1.0, 0.0, edge)
    mix[:, 0] *= envelope
    mix[:, 1] *= envelope
    mix = np.tanh(mix * 1.65)
    peak = float(np.max(np.abs(mix))) or 1.0
    mix *= 0.79 / peak
    return mix


def write_wav(path: Path, samples: np.ndarray, rate: int = RATE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(samples, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as file:
        file.setnchannels(2 if pcm.ndim == 2 else 1)
        file.setsampwidth(2)
        file.setframerate(rate)
        file.writeframes(pcm.tobytes())


def make_sfx(identifier: str, duration: float) -> np.ndarray:
    count = int(RATE * duration)
    t = np.arange(count, dtype=np.float64) / RATE
    x = t / duration
    rng = np.random.default_rng(sum(ord(c) for c in identifier))
    noise = rng.uniform(-1, 1, count)
    if identifier in ("whoosh", "soft_whoosh", "swipe"):
        curve = np.sin(np.pi * x) ** (1.2 if identifier == "soft_whoosh" else 0.7)
        sweep = np.sin(2 * np.pi * (1300 - 920 * x) * t)
        signal = (noise * 0.65 + sweep * 0.35) * curve
        if identifier == "soft_whoosh": signal *= 0.55
        if identifier == "swipe": signal *= np.sin(np.pi * np.minimum(1, x * 1.5))
    elif identifier in ("pop", "impact", "bass_hit"):
        frequency = (100 if identifier == "bass_hit" else 145) + 570 * np.exp(-t * (7 if identifier == "pop" else 13))
        phase = 2 * np.pi * np.cumsum(frequency) / RATE
        signal = np.sin(phase) * np.exp(-t * (9 if identifier == "pop" else 15))
        signal += noise * np.exp(-t * 32) * (0.13 if identifier != "bass_hit" else 0.3)
        if identifier == "impact": signal += np.sin(2 * np.pi * 48 * t) * np.exp(-t * 7) * 0.55
    elif identifier in ("click", "notification"):
        base = 1400 if identifier == "click" else 880
        signal = np.sin(2 * np.pi * base * t) * np.exp(-t * (55 if identifier == "click" else 13))
        signal += np.sin(2 * np.pi * (base * 1.49) * t) * np.exp(-t * 24) * 0.28
        signal += noise * np.exp(-t * 80) * 0.16
    elif identifier in ("riser", "sparkle"):
        frequency = (180 + 1450 * x) if identifier == "riser" else 1200 + 1900 * x
        signal = np.sin(2 * np.pi * frequency * t) * (x ** 1.6 if identifier == "riser" else np.exp(-t * 3))
        signal += noise * (x ** 2 if identifier == "riser" else np.exp(-t * 8)) * 0.15
    else:
        signal = noise * np.sin(np.pi * x) ** 0.75
    fade = np.minimum(1.0, t / 0.012) * np.minimum(1.0, (duration - t) / 0.035)
    signal *= fade
    stereo = pan_stereo(signal * 0.64, -0.12)
    peak = float(np.max(np.abs(stereo))) or 1.0
    return stereo * (0.82 / peak)


def main() -> None:
    music_dir = ROOT / "music"
    sfx_dir = ROOT / "sfx"
    for identifier, spec in TRACKS.items():
        print(f"Generating music: {identifier}")
        write_wav(music_dir / f"{identifier}.wav", make_music(identifier, spec))
    sfx_lengths = {
        "whoosh": 0.85, "pop": 0.42, "click": 0.16, "riser": 2.4,
        "impact": 0.85, "sparkle": 1.25, "soft_whoosh": 0.9,
        "swipe": 0.6, "bass_hit": 0.75, "notification": 0.48,
    }
    for identifier, duration in sfx_lengths.items():
        print(f"Generating SFX: {identifier}")
        write_wav(sfx_dir / f"{identifier}.wav", make_sfx(identifier, duration))


if __name__ == "__main__":
    main()
