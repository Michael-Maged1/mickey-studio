/**
 * Mickey Studio - Procedural Audio SFX & Ducking Engine
 * 100% Free, CC0 1.0 Universal Public Domain Dedication.
 * Procedurally synthesized sounds via Web Audio API & mathematical PCM buffers.
 * Zero external audio dependencies or copyrighted assets.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MotionAudio = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LICENSE = 'CC0 1.0 Universal - Procedural Web Audio Synthesis - 100% Royalty Free';
  const SAMPLE_RATE = 44100;

  let sharedAudioCtx = null;
  function getAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!sharedAudioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  }

  // -----------------------------------------------------------------
  // 1. MATHEMATICAL SAMPLE GENERATORS (CC0 PROCEDURAL)
  // -----------------------------------------------------------------
  function generateSamples(type) {
    let duration = 0.3;
    if (type === 'whoosh') duration = 0.38;
    else if (type === 'pop') duration = 0.09;
    else if (type === 'click') duration = 0.025;
    else if (type === 'riser') duration = 1.2;
    else if (type === 'impact') duration = 0.55;

    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(numSamples);

    if (type === 'whoosh') {
      // Swept filtered noise
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
      for (let i = 0; i < numSamples; i++) {
        const t = i / numSamples;
        const white = Math.random() * 2 - 1;
        // Envelope: smooth bell shape
        const env = Math.sin(t * Math.PI) ** 2;
        // Simple 4-pole low-pass filter with moving cutoff
        const cutoff = 0.05 + 0.35 * Math.sin(t * Math.PI);
        b0 = b0 + cutoff * (white - b0);
        b1 = b1 + cutoff * (b0 - b1);
        b2 = b2 + cutoff * (b1 - b2);
        b3 = b3 + cutoff * (b2 - b3);
        samples[i] = b3 * env * 1.4;
      }
    } else if (type === 'pop') {
      // Rapid frequency drop sine wave
      let phase = 0;
      for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        const freq = 120 + 850 * Math.exp(-t * 45);
        phase += (2 * Math.PI * freq) / SAMPLE_RATE;
        const env = Math.exp(-t * 38);
        samples[i] = Math.sin(phase) * env * 0.9;
      }
    } else if (type === 'click') {
      // Crisp mechanical snap
      for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        const freq = 1800;
        const env = Math.exp(-t * 220);
        const noise = (Math.random() * 2 - 1) * 0.35;
        samples[i] = (Math.sin(2 * Math.PI * freq * t) + noise) * env * 0.85;
      }
    } else if (type === 'riser') {
      // Climbing tension tone with shimmer
      let phase = 0;
      for (let i = 0; i < numSamples; i++) {
        const t = i / numSamples;
        const freq = 90 + 780 * (t ** 1.8);
        phase += (2 * Math.PI * freq) / SAMPLE_RATE;
        const env = t ** 1.2;
        const shimmer = 1 + 0.15 * Math.sin(t * 50);
        samples[i] = (Math.sin(phase) * 0.7 + Math.sin(phase * 1.5) * 0.3) * env * shimmer * 0.8;
      }
    } else if (type === 'impact') {
      // Heavy punchy bass drop with damped noise transient
      let phase = 0;
      for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        const freq = 45 + 130 * Math.exp(-t * 18);
        phase += (2 * Math.PI * freq) / SAMPLE_RATE;
        const env = Math.exp(-t * 7.5);
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 35) * 0.35;
        samples[i] = (Math.sin(phase) + noise) * env * 0.95;
      }
    }

    return { samples, sampleRate: SAMPLE_RATE, duration };
  }

  // -----------------------------------------------------------------
  // 2. PCM TO WAV DATA URL CONVERTER (CC0 STANDALONE)
  // -----------------------------------------------------------------
  function encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');

    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
    view.setUint16(22, 1, true);  // NumChannels (1 = Mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true);  // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample

    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Float32 to Int16 PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return buffer;
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  const sfxDataUrlCache = {};

  function getSFXDataURL(type) {
    if (sfxDataUrlCache[type]) return sfxDataUrlCache[type];
    const { samples, sampleRate } = generateSamples(type);
    const wavBuffer = encodeWAV(samples, sampleRate);

    // Convert ArrayBuffer to Base64 in Browser or Node
    let base64 = '';
    if (typeof btoa === 'function') {
      const bytes = new Uint8Array(wavBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64 = btoa(binary);
    } else if (typeof Buffer !== 'undefined') {
      base64 = Buffer.from(wavBuffer).toString('base64');
    }

    const dataUrl = 'data:audio/wav;base64,' + base64;
    sfxDataUrlCache[type] = dataUrl;
    return dataUrl;
  }

  // -----------------------------------------------------------------
  // 3. REALTIME WEB AUDIO PLAYBACK
  // -----------------------------------------------------------------
  function playSFX(type, volume = 1.0) {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const { samples, sampleRate } = generateSamples(type);
      const audioBuffer = ctx.createBuffer(1, samples.length, sampleRate);
      audioBuffer.copyToChannel(samples, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(ctx.currentTime);
    } catch (err) {
      console.warn('Audio playback notice:', err);
    }
  }

  // -----------------------------------------------------------------
  // 4. AUTOMATIC AUDIO DUCKING HELPER
  // -----------------------------------------------------------------
  function duckGainNode(gainNode, duckVolume = 0.2, targetDuration = 0.6, normalVolume = 0.8) {
    const ctx = getAudioContext();
    if (!ctx || !gainNode) return;
    const now = ctx.currentTime;
    try {
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      // Fast duck down
      gainNode.gain.linearRampToValueAtTime(duckVolume, now + 0.12);
      // Hold and smoothly recover
      gainNode.gain.setValueAtTime(duckVolume, now + targetDuration);
      gainNode.gain.linearRampToValueAtTime(normalVolume, now + targetDuration + 0.35);
    } catch (e) {
      console.warn('Ducking schedule notice:', e);
    }
  }

  return {
    LICENSE,
    getAudioContext,
    generateSamples,
    getSFXDataURL,
    playSFX,
    duckGainNode
  };
});
