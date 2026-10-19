/**
 * ===================================================================
 * MICKEY STUDIO - DETERMINISTIC MOTION SCENE ENGINE (v2)
 * Pure JavaScript - Shared by Website & CEP Chromium Panel
 * Zero external runtime dependencies.
 * Deterministic: Same input + same time = identical output.
 * ===================================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MotionEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // -----------------------------------------------------------------
  // 1. DETERMINISTIC SEEDED PRNG (Mulberry32)
  // -----------------------------------------------------------------
  function createPRNG(seed) {
    let s = typeof seed === 'number' ? seed >>> 0 : hashString(String(seed || '12345')) >>> 0;
    return function () {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // -----------------------------------------------------------------
  // 2. EASING LIBRARY & CUBIC-BEZIER SOLVER
  // -----------------------------------------------------------------
  function cubicBezierSolver(x1, y1, x2, y2) {
    const cx = 3.0 * x1;
    const bx = 3.0 * (x2 - x1) - cx;
    const ax = 1.0 - cx - bx;

    const cy = 3.0 * y1;
    const by = 3.0 * (y2 - y1) - cy;
    const ay = 1.0 - cy - by;

    function sampleCurveX(t) {
      return ((ax * t + bx) * t + cx) * t;
    }

    function sampleCurveY(t) {
      return ((ay * t + by) * t + cy) * t;
    }

    function sampleCurveDerivativeX(t) {
      return (3.0 * ax * t + 2.0 * bx) * t + cx;
    }

    function solveCurveX(x, epsilon = 1e-6) {
      let t0, t1, t2 = x, x2Val, d2, i;
      // First try Newton-Raphson
      for (i = 0; i < 8; i++) {
        x2Val = sampleCurveX(t2) - x;
        if (Math.abs(x2Val) < epsilon) return t2;
        d2 = sampleCurveDerivativeX(t2);
        if (Math.abs(d2) < 1e-6) break;
        t2 = t2 - x2Val / d2;
      }
      // Fallback to bisection
      t0 = 0.0;
      t1 = 1.0;
      t2 = x;
      if (t2 < t0) return t0;
      if (t2 > t1) return t1;
      while (t0 < t1) {
        x2Val = sampleCurveX(t2);
        if (Math.abs(x2Val - x) < epsilon) return t2;
        if (x > x2Val) t0 = t2;
        else t1 = t2;
        t2 = (t1 - t0) * 0.5 + t0;
      }
      return t2;
    }

    return function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return sampleCurveY(solveCurveX(t));
    };
  }

  const EASINGS = {
    linear: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return t;
    },

    // Quad
    easeInQuad: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return t * t;
    },
    easeOutQuad: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return t * (2 - t);
    },
    easeInOutQuad: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },

    // Cubic
    easeInCubic: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return t * t * t;
    },
    easeOutCubic: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return (--t) * t * t + 1;
    },
    easeInOutCubic: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    },

    // Expo
    easeInExpo: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return Math.pow(2, 10 * (t - 1));
    },
    easeOutExpo: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return 1 - Math.pow(2, -10 * t);
    },
    easeInOutExpo: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      if ((t *= 2) < 1) return 0.5 * Math.pow(2, 10 * (t - 1));
      return 0.5 * (2 - Math.pow(2, -10 * (t - 1)));
    },

    // Back
    easeInBack: function (t, s = 1.70158) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return t * t * ((s + 1) * t - s);
    },
    easeOutBack: function (t, s = 1.70158) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return ((t = t - 1) * t * ((s + 1) * t + s) + 1);
    },
    easeInOutBack: function (t, s = 1.70158 * 1.525) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      if ((t *= 2) < 1) return 0.5 * (t * t * ((s + 1) * t - s));
      return 0.5 * ((t -= 2) * t * ((s + 1) * t + s) + 2);
    },

    // Elastic
    easeInElastic: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * (2 * Math.PI) / 0.4);
    },
    easeOutElastic: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * (2 * Math.PI) / 0.4) + 1;
    },
    easeInOutElastic: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      t *= 2;
      if (t < 1) return -0.5 * Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * (2 * Math.PI) / 0.4);
      return 0.5 * Math.pow(2, -10 * (t - 1)) * Math.sin((t - 1.1) * (2 * Math.PI) / 0.4) + 1;
    },

    // Bounce
    easeOutBounce: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
    easeInBounce: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return 1 - EASINGS.easeOutBounce(1 - t);
    },
    easeInOutBounce: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return t < 0.5
        ? (1 - EASINGS.easeOutBounce(1 - 2 * t)) * 0.5
        : (1 + EASINGS.easeOutBounce(2 * t - 1)) * 0.5;
    }
  };

  // Common aliases
  EASINGS.easeIn = EASINGS.easeInCubic;
  EASINGS.easeOut = EASINGS.easeOutCubic;
  EASINGS.easeInOut = EASINGS.easeInOutCubic;

  function getEasing(name) {
    if (typeof name === 'function') return name;
    if (typeof name !== 'string') return EASINGS.linear;
    const clean = name.trim();
    if (EASINGS[clean]) return EASINGS[clean];

    // Check for cubic-bezier(...)
    const match = clean.match(/^cubic-bezier\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)$/i);
    if (match) {
      const x1 = Math.max(0, Math.min(1, parseFloat(match[1])));
      const y1 = parseFloat(match[2]);
      const x2 = Math.max(0, Math.min(1, parseFloat(match[3])));
      const y2 = parseFloat(match[4]);
      return cubicBezierSolver(x1, y1, x2, y2);
    }
    return EASINGS.linear;
  }

  // -----------------------------------------------------------------
  // 3. ARABIC SHAPING & RTL TEXT ENGINE
  // -----------------------------------------------------------------
  // Unicode Arabic Presentation Forms-B mapping table
  // Character -> [Isolated, Final, Initial, Medial]
  const ARABIC_GLYPHS = {
    0x0621: [0xfe80, null, null, null], // Hamza
    0x0622: [0xfe81, 0xfe82, null, null], // Alef with Madda
    0x0623: [0xfe83, 0xfe84, null, null], // Alef with Hamza Above
    0x0624: [0xfe85, 0xfe86, null, null], // Waw with Hamza
    0x0625: [0xfe87, 0xfe88, null, null], // Alef with Hamza Below
    0x0626: [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c], // Yaa with Hamza
    0x0627: [0xfe8d, 0xfe8e, null, null], // Alef
    0x0628: [0xfe8f, 0xfe90, 0xfe91, 0xfe92], // Baa
    0x0629: [0xfe93, 0xfe94, null, null], // Taa Marbuta
    0x062a: [0xfe95, 0xfe96, 0xfe97, 0xfe98], // Taa
    0x062b: [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c], // Thaa
    0x062c: [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0], // Jeem
    0x062d: [0xfea1, 0xfea2, 0xfea3, 0xfea4], // Haa
    0x062e: [0xfea5, 0xfea6, 0xfea7, 0xfea8], // Khaa
    0x062f: [0xfea9, 0xfeaa, null, null], // Dal
    0x0630: [0xfeab, 0xfeac, null, null], // Dhal
    0x0631: [0xfead, 0xfeae, null, null], // Raa
    0x0632: [0xfeaf, 0xfeb0, null, null], // Zay
    0x0633: [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4], // Seen
    0x0634: [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8], // Sheen
    0x0635: [0xfeb9, 0xfeba, 0xfebb, 0xfebc], // Saad
    0x0636: [0xfebd, 0xfebe, 0xfebf, 0xfec0], // Daad
    0x0637: [0xfec1, 0xfec2, 0xfec3, 0xfec4], // Taa'
    0x0638: [0xfec5, 0xfec6, 0xfec7, 0xfec8], // Dhaa'
    0x0639: [0xfec9, 0xfeca, 0xfecb, 0xfecc], // Ayn
    0x063a: [0xfecd, 0xfece, 0xfecf, 0xfed0], // Ghayn
    0x0641: [0xfed1, 0xfed2, 0xfed3, 0xfed4], // Faa
    0x0642: [0xfed5, 0xfed6, 0xfed7, 0xfed8], // Qaaf
    0x0643: [0xfed9, 0xfeda, 0xfedb, 0xfedc], // Kaaf
    0x0644: [0xfedd, 0xfede, 0xfedf, 0xfee0], // Laam
    0x0645: [0xfee1, 0xfee2, 0xfee3, 0xfee4], // Meem
    0x0646: [0xfee5, 0xfee6, 0xfee7, 0xfee8], // Noon
    0x0647: [0xfee9, 0xfeea, 0xfeeb, 0xfeec], // Haa'
    0x0648: [0xfeed, 0xfeee, null, null], // Waw
    0x0649: [0xfeef, 0xfef0, null, null], // Alif Maqsura
    0x064a: [0xfef1, 0xfef2, 0xfef3, 0xfef4]  // Yaa
  };

  // Laam-Alef Ligature forms: [Isolated, Final]
  const LAAM_ALEF_LIGATURES = {
    0x0622: [0xfef5, 0xfef6], // Laam + Alef with Madda
    0x0623: [0xfef7, 0xfef8], // Laam + Alef with Hamza Above
    0x0625: [0xfef9, 0xfefa], // Laam + Alef with Hamza Below
    0x0627: [0xfefb, 0xfefc]  // Laam + Alef
  };

  const TASHKEEL_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/;

  function isRTLChar(char) {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return (code >= 0x0600 && code <= 0x06ff) ||
           (code >= 0x0750 && code <= 0x077f) ||
           (code >= 0x08a0 && code <= 0x08ff) ||
           (code >= 0xfb50 && code <= 0xfdff) ||
           (code >= 0xfe70 && code <= 0xfeff);
  }

  function isRTLText(text) {
    if (!text) return false;
    for (let i = 0; i < text.length; i++) {
      if (isRTLChar(text[i])) return true;
    }
    return false;
  }

  function canConnectBefore(code) {
    const forms = ARABIC_GLYPHS[code];
    return Boolean(forms && (forms[1] !== null || forms[3] !== null));
  }

  function canConnectAfter(code) {
    const forms = ARABIC_GLYPHS[code];
    return Boolean(forms && (forms[2] !== null || forms[3] !== null));
  }

  function shapeArabic(text) {
    if (!text) return '';
    const codes = [];
    for (let i = 0; i < text.length; i++) {
      codes.push(text.charCodeAt(i));
    }

    const shapedCodes = [];
    let i = 0;
    while (i < codes.length) {
      const code = codes[i];

      // Tashkeel bypass
      if (TASHKEEL_REGEX.test(String.fromCharCode(code))) {
        shapedCodes.push(code);
        i++;
        continue;
      }

      // Check Laam-Alef Ligature
      if (code === 0x0644 && i + 1 < codes.length) {
        let nextIdx = i + 1;
        while (nextIdx < codes.length && TASHKEEL_REGEX.test(String.fromCharCode(codes[nextIdx]))) {
          nextIdx++;
        }
        if (nextIdx < codes.length) {
          const nextCode = codes[nextIdx];
          const ligature = LAAM_ALEF_LIGATURES[nextCode];
          if (ligature) {
            let prevIdx = i - 1;
            while (prevIdx >= 0 && TASHKEEL_REGEX.test(String.fromCharCode(codes[prevIdx]))) {
              prevIdx--;
            }
            const prevConnected = prevIdx >= 0 && canConnectAfter(codes[prevIdx]);
            shapedCodes.push(prevConnected ? ligature[1] : ligature[0]);
            i = nextIdx + 1;
            continue;
          }
        }
      }

      const glyphForms = ARABIC_GLYPHS[code];
      if (!glyphForms) {
        shapedCodes.push(code);
        i++;
        continue;
      }

      // Check connections
      let prevIdx = i - 1;
      while (prevIdx >= 0 && TASHKEEL_REGEX.test(String.fromCharCode(codes[prevIdx]))) prevIdx--;
      let nextIdx = i + 1;
      while (nextIdx < codes.length && TASHKEEL_REGEX.test(String.fromCharCode(codes[nextIdx]))) nextIdx++;

      const prevConnects = prevIdx >= 0 && canConnectAfter(codes[prevIdx]);
      const nextConnects = nextIdx < codes.length && canConnectBefore(codes[nextIdx]);

      let formIndex = 0; // 0: Isolated, 1: Final, 2: Initial, 3: Medial
      if (prevConnects && nextConnects && glyphForms[3] !== null) formIndex = 3;
      else if (prevConnects && glyphForms[1] !== null) formIndex = 1;
      else if (nextConnects && glyphForms[2] !== null) formIndex = 2;
      else formIndex = 0;

      const shapedCode = glyphForms[formIndex] || glyphForms[0] || code;
      shapedCodes.push(shapedCode);
      i++;
    }

    return String.fromCharCode(...shapedCodes);
  }

  // -----------------------------------------------------------------
  // 4. MULTI-LINE TEXT LAYOUT & CHARACTER SAMPLER
  // -----------------------------------------------------------------
  function layoutTextLines(rawText, maxWidth, measureFn) {
    if (!rawText) return [];
    const paragraphs = String(rawText).split(/\r?\n/);
    const lines = [];

    for (const para of paragraphs) {
      if (!para) {
        lines.push({ text: '', shaped: '', words: [] });
        continue;
      }

      const isRTL = isRTLText(para);
      const words = para.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push({ text: '', shaped: '', words: [] });
        continue;
      }

      let currentLineWords = [];
      let currentLineWidth = 0;

      for (const word of words) {
        const testLine = currentLineWords.length > 0 ? currentLineWords.join(' ') + ' ' + word : word;
        const shapedTest = isRTL ? shapeArabic(testLine) : testLine;
        const testWidth = measureFn ? measureFn(shapedTest) : testLine.length * 10;

        if (currentLineWords.length > 0 && testWidth > maxWidth && maxWidth > 0) {
          const lineStr = currentLineWords.join(' ');
          lines.push({
            text: lineStr,
            shaped: isRTL ? shapeArabic(lineStr) : lineStr,
            isRTL
          });
          currentLineWords = [word];
        } else {
          currentLineWords.push(word);
        }
      }

      if (currentLineWords.length > 0) {
        const lineStr = currentLineWords.join(' ');
        lines.push({
          text: lineStr,
          shaped: isRTL ? shapeArabic(lineStr) : lineStr,
          isRTL
        });
      }
    }
    return lines;
  }

  // -----------------------------------------------------------------
  // 5. COLOR & PROPERTY INTERPOLATION
  // -----------------------------------------------------------------
  function parseColor(str) {
    if (!str || str === 'transparent') return [0, 0, 0, 0];
    str = String(str).trim();
    if (str.startsWith('#')) {
      const hex = str.slice(1);
      if (hex.length === 3) {
        return [
          parseInt(hex[0] + hex[0], 16),
          parseInt(hex[1] + hex[1], 16),
          parseInt(hex[2] + hex[2], 16),
          1
        ];
      }
      if (hex.length === 6) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
          1
        ];
      }
      if (hex.length === 8) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
          parseInt(hex.slice(6, 8), 16) / 255
        ];
      }
    }
    const rgba = str.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
    if (rgba) {
      return [
        parseFloat(rgba[1]),
        parseFloat(rgba[2]),
        parseFloat(rgba[3]),
        rgba[4] !== undefined ? parseFloat(rgba[4]) : 1
      ];
    }
    return [255, 255, 255, 1];
  }

  function formatColor(rgba) {
    const r = Math.max(0, Math.min(255, Math.round(rgba[0])));
    const g = Math.max(0, Math.min(255, Math.round(rgba[1])));
    const b = Math.max(0, Math.min(255, Math.round(rgba[2])));
    const a = Math.max(0, Math.min(1, rgba[3]));
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3).replace(/\.?0+$/, '')})`;
  }

  function interpolateColor(colorA, colorB, t) {
    const a = parseColor(colorA);
    const b = parseColor(colorB);
    return formatColor([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
      a[3] + (b[3] - a[3]) * t
    ]);
  }

  function getNestedProp(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let curr = obj;
    for (const p of parts) {
      if (curr == null) return undefined;
      curr = curr[p];
    }
    return curr;
  }

  // -----------------------------------------------------------------
  // 6. SAMPLE PROPERTY (KEYFRAMES & PRESETS)
  // -----------------------------------------------------------------
  function sampleProperty(layer, propPath, timeSec) {
    if (!layer) return undefined;
    const baseVal = getNestedProp(layer, propPath);
    const layerStart = Number(layer.start || 0);
    const layerDur = Number(layer.duration || 5);
    const relTime = timeSec - layerStart;

    // 1. Evaluate explicit keyframes if present
    if (layer.keyframes && Array.isArray(layer.keyframes[propPath]) && layer.keyframes[propPath].length > 0) {
      const kfs = layer.keyframes[propPath];
      if (kfs.length === 1) return kfs[0].v;

      // Before first keyframe
      if (relTime <= kfs[0].t) return kfs[0].v;
      // After last keyframe
      if (relTime >= kfs[kfs.length - 1].t) return kfs[kfs.length - 1].v;

      // Find segment
      for (let i = 0; i < kfs.length - 1; i++) {
        const kfA = kfs[i];
        const kfB = kfs[i + 1];
        if (relTime >= kfA.t && relTime <= kfB.t) {
          const segDur = kfB.t - kfA.t;
          const rawProgress = segDur > 0 ? (relTime - kfA.t) / segDur : 1;
          const easeFn = getEasing(kfA.ease || 'linear');
          const easeProgress = easeFn(rawProgress);

          if (typeof kfA.v === 'number' && typeof kfB.v === 'number') {
            return kfA.v + (kfB.v - kfA.v) * easeProgress;
          }
          if (typeof kfA.v === 'string' && typeof kfB.v === 'string' && (kfA.v.startsWith('#') || kfA.v.startsWith('rgb'))) {
            return interpolateColor(kfA.v, kfB.v, easeProgress);
          }
          return rawProgress >= 1 ? kfB.v : kfA.v;
        }
      }
    }

    // 2. Evaluate built-in Presets (in / out / loop) if keyframes are not explicitly overriding
    if (layer.presets) {
      const inPreset = layer.presets.in;
      const outPreset = layer.presets.out;
      const loopPreset = layer.presets.loop;

      // Preset: In
      if (inPreset && relTime >= 0 && relTime < (inPreset.dur || 0.6)) {
        const pDur = Number(inPreset.dur || 0.6);
        const progress = Math.max(0, Math.min(1, relTime / pDur));
        const easeFn = getEasing(inPreset.ease || 'easeOutCubic');
        const p = easeFn(progress);

        if (propPath === 'transform.opacity') {
          return p * (baseVal !== undefined ? baseVal : 1);
        }
        if (propPath === 'transform.y') {
          const dist = Number(inPreset.params?.distance || 80);
          if (inPreset.name === 'slideUp' || inPreset.name === 'slide_up') return (Number(baseVal) || 0) + dist * (1 - p);
          if (inPreset.name === 'slideDown' || inPreset.name === 'slide_down') return (Number(baseVal) || 0) - dist * (1 - p);
          if (inPreset.name === 'bounce' || inPreset.name === 'bounce_in') {
            const h = Number(inPreset.params?.height || 180);
            return (Number(baseVal) || 0) - h * (1 - EASINGS.easeOutBounce(progress));
          }
        }
        if (propPath === 'transform.x') {
          const dist = Number(inPreset.params?.distance || 120);
          if (inPreset.name === 'slideLeft' || inPreset.name === 'slide_left') return (Number(baseVal) || 0) + dist * (1 - p);
          if (inPreset.name === 'slideRight' || inPreset.name === 'slide_right') return (Number(baseVal) || 0) - dist * (1 - p);
        }
        if (propPath === 'transform.scaleX' || propPath === 'transform.scaleY') {
          if (inPreset.name === 'pop' || inPreset.name === 'pop_in' || inPreset.name === 'scalePop') {
            return (Number(baseVal) || 1) * EASINGS.easeOutBack(progress);
          }
          if (inPreset.name === 'elastic' || inPreset.name === 'elastic_in') {
            return (Number(baseVal) || 1) * EASINGS.easeOutElastic(progress);
          }
          if (inPreset.name === 'rotateIn' || inPreset.name === 'rotate_in') {
            return (Number(baseVal) || 1) * (0.5 + 0.5 * p);
          }
        }
        if (propPath === 'transform.rotation') {
          if (inPreset.name === 'rotateIn' || inPreset.name === 'rotate_in') {
            const startAng = Number(inPreset.params?.startAngle || -90);
            return (Number(baseVal) || 0) + startAng * (1 - p);
          }
        }
        if (propPath === 'style.blur') {
          if (inPreset.name === 'blurIn' || inPreset.name === 'blur_in') {
            const maxBlur = Number(inPreset.params?.maxBlur || 24);
            return maxBlur * (1 - p);
          }
        }
      }

      // Preset: Out
      if (outPreset && relTime > (layerDur - (outPreset.dur || 0.4))) {
        const pDur = Number(outPreset.dur || 0.4);
        const outStart = layerDur - pDur;
        const progress = Math.max(0, Math.min(1, (relTime - outStart) / pDur));
        const easeFn = getEasing(outPreset.ease || 'easeInCubic');
        const p = easeFn(progress);

        if (propPath === 'transform.opacity') {
          return (1 - p) * (baseVal !== undefined ? baseVal : 1);
        }
        if (propPath === 'transform.y') {
          const dist = Number(outPreset.params?.distance || 90);
          if (outPreset.name === 'slideDown' || outPreset.name === 'slide_down_out') return (Number(baseVal) || 0) + dist * p;
          if (outPreset.name === 'slideUp' || outPreset.name === 'slide_up_out') return (Number(baseVal) || 0) - dist * p;
        }
        if (propPath === 'transform.x') {
          const dist = Number(outPreset.params?.distance || 120);
          if (outPreset.name === 'slideLeft' || outPreset.name === 'slide_left_out') return (Number(baseVal) || 0) - dist * p;
          if (outPreset.name === 'slideRight' || outPreset.name === 'slide_right_out') return (Number(baseVal) || 0) + dist * p;
        }
        if (propPath === 'transform.scaleX' || propPath === 'transform.scaleY') {
          if (outPreset.name === 'scaleDown' || outPreset.name === 'scale_down_out') {
            return (Number(baseVal) || 1) * (1 - p);
          }
        }
        if (propPath === 'transform.rotation') {
          if (outPreset.name === 'rotateOut' || outPreset.name === 'rotate_out') {
            const endAng = Number(outPreset.params?.endAngle || 90);
            return (Number(baseVal) || 0) + endAng * p;
          }
        }
      }

      // Preset: Loop
      if (loopPreset && relTime >= 0 && relTime <= layerDur) {
        const period = Number(loopPreset.period || 2.0);
        const phase = (relTime % period) / period;
        const sinWave = Math.sin(phase * Math.PI * 2);

        if ((loopPreset.name === 'float' || loopPreset.name === 'float_loop') && propPath === 'transform.y') {
          const amp = Number(loopPreset.params?.amplitude || 14);
          return (Number(baseVal) || 0) + sinWave * amp;
        }
        if ((loopPreset.name === 'pulse' || loopPreset.name === 'pulse_loop') && (propPath === 'transform.scaleX' || propPath === 'transform.scaleY')) {
          const amp = Number(loopPreset.params?.amplitude || 0.06);
          return (Number(baseVal) || 1) * (1 + sinWave * amp);
        }
        if ((loopPreset.name === 'spin' || loopPreset.name === 'spin_loop') && propPath === 'transform.rotation') {
          const speed = Number(loopPreset.params?.speed || (1 / period));
          return (Number(baseVal) || 0) + (relTime * speed * 360) % 360;
        }
        if ((loopPreset.name === 'shake' || loopPreset.name === 'shake_loop') && propPath === 'transform.x') {
          const freq = Number(loopPreset.params?.frequency || 8);
          const amp = Number(loopPreset.params?.amplitude || 8);
          return (Number(baseVal) || 0) + Math.sin(relTime * freq * Math.PI * 2) * amp;
        }
        if ((loopPreset.name === 'wiggle' || loopPreset.name === 'wiggle_loop') && propPath === 'transform.rotation') {
          const amp = Number(loopPreset.params?.amplitude || 6);
          return (Number(baseVal) || 0) + sinWave * amp;
        }
      }
    }

    return baseVal;
  }

  // -----------------------------------------------------------------
  // 7. SCHEMA VALIDATION
  // -----------------------------------------------------------------
  function validateScene(json) {
    const errors = [];
    const warnings = [];

    if (!json || typeof json !== 'object') {
      return { valid: false, errors: ['Scene payload must be an object'], warnings };
    }

    if (json.version !== 2) {
      errors.push(`Invalid version: expected 2, got ${json.version}`);
    }

    const width = Number(json.width);
    if (!Number.isFinite(width) || width <= 0 || width > 7680) {
      errors.push('Scene width must be a positive number up to 7680');
    }

    const height = Number(json.height);
    if (!Number.isFinite(height) || height <= 0 || height > 7680) {
      errors.push('Scene height must be a positive number up to 7680');
    }

    const fps = Number(json.fps);
    if (!Number.isFinite(fps) || fps <= 0 || fps > 120) {
      warnings.push(`Invalid fps ${json.fps}; defaulting to 30`);
    }

    const duration = Number(json.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      errors.push('Scene duration must be a positive number in seconds');
    }

    if (!Array.isArray(json.layers)) {
      errors.push('Scene layers must be an array');
    } else {
      const idSet = new Set();
      const validTypes = new Set(['text', 'shape', 'image', 'group', 'counter', 'chart', 'progress', 'progressBar', 'progressRing']);

      json.layers.forEach((layer, idx) => {
        if (!layer || typeof layer !== 'object') {
          errors.push(`Layer [${idx}] is not an object`);
          return;
        }
        if (!layer.id) {
          errors.push(`Layer [${idx}] missing unique id`);
        } else if (idSet.has(layer.id)) {
          errors.push(`Duplicate layer id: "${layer.id}" at index ${idx}`);
        } else {
          idSet.add(layer.id);
        }

        if (!validTypes.has(layer.type)) {
          errors.push(`Layer "${layer.id || idx}" has unsupported type: "${layer.type}"`);
        }

        if (layer.start != null && (!Number.isFinite(Number(layer.start)) || Number(layer.start) < 0)) {
          errors.push(`Layer "${layer.id || idx}" start time must be non-negative number`);
        }

        if (layer.duration != null && (!Number.isFinite(Number(layer.duration)) || Number(layer.duration) <= 0)) {
          errors.push(`Layer "${layer.id || idx}" duration must be greater than 0`);
        }
      });
    }

    if (json.audio && !Array.isArray(json.audio)) {
      errors.push('Scene audio must be an array if provided');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      scene: errors.length === 0 ? json : undefined
    };
  }

  function getDuration(scene) {
    if (!scene) return 0;
    if (Number.isFinite(Number(scene.duration)) && Number(scene.duration) > 0) {
      return Number(scene.duration);
    }
    let maxEnd = 0;
    if (Array.isArray(scene.layers)) {
      for (const l of scene.layers) {
        const end = (Number(l.start) || 0) + (Number(l.duration) || 0);
        if (end > maxEnd) maxEnd = end;
      }
    }
    if (Array.isArray(scene.audio)) {
      for (const a of scene.audio) {
        const end = (Number(a.start) || 0) + (Number(a.duration) || 0);
        if (end > maxEnd) maxEnd = end;
      }
    }
    return maxEnd || 15;
  }

  // -----------------------------------------------------------------
  // 8. BRAND TOKENS & WATERMARK
  // -----------------------------------------------------------------
  function resolveBrandToken(value, brandKit) {
    if (!value || typeof value !== 'string') return value;
    if (!value.startsWith('brand.')) return value;
    const token = value.slice(6).toLowerCase();
    const defaults = {
      primary: '#6366f1',
      secondary: '#06b6d4',
      accent: '#f59e0b',
      dark: '#0f172a',
      light: '#ffffff',
      success: '#10b981',
      heading: 'Cairo',
      body: 'Tajawal'
    };
    if (brandKit) {
      if (brandKit.colors && brandKit.colors[token]) return brandKit.colors[token];
      if (brandKit.fonts && brandKit.fonts[token]) return brandKit.fonts[token];
    }
    return defaults[token] || value;
  }

  function drawWatermark(ctx, watermark, width, height) {
    if (!watermark || !watermark.enabled) return;
    const padding = Number(watermark.padding || 30);
    const opacity = Number(watermark.opacity !== undefined ? watermark.opacity : 0.5);

    ctx.save();
    ctx.globalAlpha = opacity;

    if (watermark.image) {
      const img = watermark.image;
      const scale = Number(watermark.scale || 0.12);
      const imgW = (img.width || 200) * scale;
      const imgH = (img.height || 60) * scale;
      let x = width - imgW - padding;
      let y = height - imgH - padding;
      if (watermark.position === 'top-left') { x = padding; y = padding; }
      else if (watermark.position === 'top-right') { x = width - imgW - padding; y = padding; }
      else if (watermark.position === 'bottom-left') { x = padding; y = height - imgH - padding; }
      try { ctx.drawImage(img, x, y, imgW, imgH); } catch (e) {}
    } else if (watermark.text) {
      const text = watermark.text;
      ctx.font = '700 20px Cairo, sans-serif';
      const textW = ctx.measureText(text).width;
      let x = width - textW - padding;
      let y = height - padding;
      if (watermark.position === 'top-left') { x = padding; y = padding + 20; }
      else if (watermark.position === 'top-right') { x = width - textW - padding; y = padding + 20; }
      else if (watermark.position === 'bottom-left') { x = padding; y = height - padding; }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  }

  function applyBrandKitToScene(scene, brandKit) {
    if (!scene || !brandKit) return scene;
    scene.brandKitId = brandKit.id || 'default';
    scene.brandKit = brandKit;

    const colors = brandKit.colors || {};
    const fonts = brandKit.fonts || {};

    if (Array.isArray(scene.layers)) {
      scene.layers.forEach(layer => {
        if (!layer.style) layer.style = {};
        if (layer.type === 'text') {
          if ((layer.style.fontSize && layer.style.fontSize >= 50) || (layer.id && layer.id.includes('title')) || (layer.name && layer.name.includes('عنوان'))) {
            layer.style.font = fonts.heading || layer.style.font || 'Cairo';
            if (colors.light && (!layer.style.fill || layer.style.fill === '#ffffff' || layer.style.fill.startsWith('brand.'))) {
              layer.style.fill = 'brand.light';
            }
          } else {
            layer.style.font = fonts.body || layer.style.font || 'Tajawal';
            if (colors.secondary && (!layer.style.fill || layer.style.fill.startsWith('brand.'))) {
              layer.style.fill = 'brand.secondary';
            }
          }
        } else if (layer.type === 'shape') {
          if (colors.primary) layer.style.fill = 'brand.primary';
          if (colors.secondary && layer.style.stroke) layer.style.stroke = 'brand.secondary';
        } else if (layer.type === 'counter') {
          if (colors.accent) layer.style.fill = 'brand.accent';
          if (fonts.heading) layer.style.font = fonts.heading;
        } else if (layer.type === 'progressBar' || layer.type === 'progressRing') {
          if (colors.primary) layer.style.fill = 'brand.primary';
          if (colors.dark) layer.style.trackColor = 'brand.dark';
        } else if (layer.type === 'chart') {
          if (fonts.body) layer.style.font = fonts.body;
          if (Array.isArray(layer.content?.data) && colors.primary) {
            const chartPalette = [colors.primary, colors.secondary || '#06b6d4', colors.accent || '#f59e0b', colors.success || '#10b981'];
            layer.content.data.forEach((d, i) => {
              d.color = chartPalette[i % chartPalette.length];
            });
          }
        }
      });
    }

    if (scene.background && scene.background.type === 'color' && colors.dark) {
      scene.background.color = 'brand.dark';
    }

    return scene;
  }

  // -----------------------------------------------------------------
  // 9. DETERMINISTIC RENDER FRAME
  // -----------------------------------------------------------------
  function renderFrame(scene, timeSec, canvas, options = {}) {
    if (!canvas) throw new Error('renderFrame: target canvas is required');
    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return;

    const width = Number(scene.width || canvas.width || 1920);
    const height = Number(scene.height || canvas.height || 1080);
    const time = Math.max(0, Number(timeSec) || 0);

    // Auto resize canvas if requested
    if (options.resizeCanvas !== false) {
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    }

    ctx.save();

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background rendering
    const bg = scene.background || { type: 'color', color: '#09090b' };
    const bgColor = resolveBrandToken(bg.color, scene.brandKit || options.brandKit);
    if (bg.type === 'color' && bgColor && bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    } else if (bg.type === 'gradient' && bg.gradient) {
      const gInfo = bg.gradient;
      let grad;
      if (gInfo.type === 'radial') {
        grad = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, Math.max(width, height) / 2);
      } else {
        const angle = (Number(gInfo.angle || 0) * Math.PI) / 180;
        const x2 = width / 2 + Math.cos(angle) * (width / 2);
        const y2 = height / 2 + Math.sin(angle) * (height / 2);
        grad = ctx.createLinearGradient(0, 0, x2, y2);
      }
      (gInfo.stops || [{ offset: 0, color: '#18181b' }, { offset: 1, color: '#09090b' }]).forEach(stop => {
        grad.addColorStop(stop.offset, resolveBrandToken(stop.color, scene.brandKit || options.brandKit));
      });
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // Layers rendering
    const layers = Array.isArray(scene.layers) ? scene.layers : [];
    for (const layer of layers) {
      if (layer.visible === false) continue;

      const lStart = Number(layer.start || 0);
      const lDur = Number(layer.duration || 5);
      if (time < lStart || time > (lStart + lDur)) continue;

      renderLayer(layer, time, ctx, scene, options);
    }

    // Watermark rendering if configured
    const brandKit = scene.brandKit || options.brandKit;
    if (brandKit && brandKit.watermark && brandKit.watermark.enabled) {
      drawWatermark(ctx, brandKit.watermark, width, height);
    }

    ctx.restore();
  }

  function drawRoundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function computeLayerWorldTransform(layer, timeSec, scene) {
    let opacity = Math.max(0, Math.min(1, Number(sampleProperty(layer, 'transform.opacity', timeSec) ?? 1)));
    let x = Number(sampleProperty(layer, 'transform.x', timeSec) ?? (scene.width / 2));
    let y = Number(sampleProperty(layer, 'transform.y', timeSec) ?? (scene.height / 2));
    let w = Number(sampleProperty(layer, 'transform.w', timeSec) ?? 200);
    let h = Number(sampleProperty(layer, 'transform.h', timeSec) ?? 100);
    let rotation = (Number(sampleProperty(layer, 'transform.rotation', timeSec) ?? 0) * Math.PI) / 180;
    let scaleX = Number(sampleProperty(layer, 'transform.scaleX', timeSec) ?? 1);
    let scaleY = Number(sampleProperty(layer, 'transform.scaleY', timeSec) ?? 1);
    let anchorX = Number(sampleProperty(layer, 'transform.anchorX', timeSec) ?? 0.5);
    let anchorY = Number(sampleProperty(layer, 'transform.anchorY', timeSec) ?? 0.5);

    if (layer.parentId && scene && Array.isArray(scene.layers)) {
      const parent = scene.layers.find(l => l.id === layer.parentId);
      if (parent) {
        const pt = computeLayerWorldTransform(parent, timeSec, scene);
        opacity *= pt.opacity;
        const pRad = pt.rotation;
        const cos = Math.cos(pRad);
        const sin = Math.sin(pRad);
        const relX = (x - (scene.width / 2)) * pt.scaleX;
        const relY = (y - (scene.height / 2)) * pt.scaleY;
        x = pt.x + (relX * cos - relY * sin);
        y = pt.y + (relX * sin + relY * cos);
        rotation += pt.rotation;
        scaleX *= pt.scaleX;
        scaleY *= pt.scaleY;
      }
    }
    return { x, y, w, h, rotation, scaleX, scaleY, anchorX, anchorY, opacity };
  }

  function renderLayer(layer, timeSec, ctx, scene, options) {
    ctx.save();

    // Composite world transform
    const t = computeLayerWorldTransform(layer, timeSec, scene);
    if (t.opacity <= 0) { ctx.restore(); return; }
    ctx.globalAlpha = t.opacity;

    if (layer.blendMode) ctx.globalCompositeOperation = layer.blendMode;

    ctx.translate(t.x, t.y);
    if (t.rotation !== 0) ctx.rotate(t.rotation);
    if (t.scaleX !== 1 || t.scaleY !== 1) ctx.scale(t.scaleX, t.scaleY);

    const originX = -t.w * t.anchorX;
    const originY = -t.h * t.anchorY;
    ctx.translate(originX, originY);

    // Wipe Reveal Clip
    const relTime = timeSec - Number(layer.start || 0);
    const inPreset = layer.presets?.in;
    if (inPreset && (inPreset.name === 'wipe_reveal' || inPreset.name === 'wipe') && relTime >= 0 && relTime < (inPreset.dur || 0.7)) {
      const pDur = Number(inPreset.dur || 0.7);
      const easeWipe = EASINGS.easeInOutCubic(Math.min(1, relTime / pDur));
      ctx.beginPath();
      ctx.rect(0, 0, t.w * easeWipe, t.h);
      ctx.clip();
    }

    // Styles & Glow
    const style = layer.style || {};
    if (style.glow) {
      ctx.shadowColor = style.glow.color || style.shadow?.color || '#06b6d4';
      ctx.shadowBlur = Number(style.glow.blur || 20);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else if (style.shadow) {
      ctx.shadowColor = style.shadow.color || 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = Number(style.shadow.blur || 0);
      ctx.shadowOffsetX = Number(style.shadow.x || 0);
      ctx.shadowOffsetY = Number(style.shadow.y || 0);
    }

    // Render by Layer Type
    switch (layer.type) {
      case 'text':
        renderTextLayer(layer, timeSec, ctx, t.w, t.h, scene);
        break;
      case 'shape':
        renderShapeLayer(layer, timeSec, ctx, t.w, t.h, scene);
        break;
      case 'counter':
        renderCounterLayer(layer, timeSec, ctx, t.w, t.h, scene);
        break;
      case 'progress':
      case 'progressBar':
      case 'progressRing':
        renderProgressLayer(layer, timeSec, ctx, t.w, t.h, scene);
        break;
      case 'chart':
        renderChartLayer(layer, timeSec, ctx, t.w, t.h, scene);
        break;
      case 'image':
        renderImageLayer(layer, timeSec, ctx, t.w, t.h, options, scene);
        break;
    }

    ctx.restore();
  }

  function renderTextLayer(layer, timeSec, ctx, w, h, scene) {
    const content = layer.content || {};
    const style = layer.style || {};
    const brandKit = scene?.brandKit;
    const rawText = content.text || layer.name || '';
    if (!rawText) return;

    const fontSize = Number(sampleProperty(layer, 'style.fontSize', timeSec) ?? (style.fontSize || 48));
    const fontWeight = style.fontWeight || 600;
    const fontFamily = resolveBrandToken(style.font, brandKit) || 'Readex Pro, Cairo, Arial, sans-serif';
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

    const align = style.align || 'center';
    const isRTL = style.direction === 'rtl' || isRTLText(rawText);
    const lineHeight = fontSize * (Number(style.lineHeight || 1.3));

    // Multi-line layout
    const lines = layoutTextLines(rawText, w, text => ctx.measureText(text).width);
    const totalTextHeight = lines.length * lineHeight;
    let startY = (h - totalTextHeight) / 2 + fontSize * 0.85;

    // 1. Text Background Box (Overall)
    if (style.backgroundBox && style.backgroundBox.fill) {
      const pad = Number(style.backgroundBox.padding || 12);
      const rad = Number(style.backgroundBox.radius || 8);
      ctx.save();
      ctx.fillStyle = resolveBrandToken(style.backgroundBox.fill, brandKit);
      drawRoundedRectPath(ctx, -pad, (h - totalTextHeight) / 2 - pad, w + pad * 2, totalTextHeight + pad * 2, rad);
      ctx.fill();
      ctx.restore();
    }

    // 2. Per-Line Background (Lower-Third style)
    if (style.perLineBackground && style.perLineBackground.fill) {
      const pad = Number(style.perLineBackground.padding || 8);
      const rad = Number(style.perLineBackground.radius || 6);
      lines.forEach((lineObj, lIdx) => {
        const lineW = ctx.measureText(lineObj.shaped).width;
        const lineTop = (h - totalTextHeight) / 2 + lIdx * lineHeight;
        let lineLeft = (w - lineW) / 2;
        if (align === 'right') lineLeft = w - lineW;
        else if (align === 'left') lineLeft = 0;
        ctx.save();
        ctx.fillStyle = resolveBrandToken(style.perLineBackground.fill, brandKit);
        drawRoundedRectPath(ctx, lineLeft - pad, lineTop, lineW + pad * 2, lineHeight, rad);
        ctx.fill();
        ctx.restore();
      });
    }

    // Fill style: Gradient or solid color
    let rawFill = sampleProperty(layer, 'style.fill', timeSec) || style.fill || '#FFFFFF';
    let fill = resolveBrandToken(rawFill, brandKit);
    if (style.gradient && Array.isArray(style.gradient.stops) && style.gradient.stops.length > 0) {
      const angleRad = (Number(style.gradient.angle || 0) * Math.PI) / 180;
      const x2 = Math.cos(angleRad) * w;
      const y2 = Math.sin(angleRad) * totalTextHeight;
      const grad = ctx.createLinearGradient(0, startY - fontSize, x2, startY + y2);
      style.gradient.stops.forEach(st => grad.addColorStop(st.offset, resolveBrandToken(st.color, brandKit)));
      fill = grad;
    }
    ctx.fillStyle = fill;

    // Presets for text reveal
    const relTime = timeSec - Number(layer.start || 0);
    const inPreset = layer.presets?.in;
    const pDur = inPreset ? Number(inPreset.dur || 1.0) : 1.0;
    const pProgress = inPreset && pDur > 0 ? Math.max(0, Math.min(1, relTime / pDur)) : 1.0;

    let revealMode = inPreset ? inPreset.name : 'none';
    ctx.textAlign = align;

    lines.forEach((lineObj, lIdx) => {
      let lineText = lineObj.shaped;
      let drawX = w / 2;
      if (align === 'left') drawX = 0;
      else if (align === 'right') drawX = w;

      if (revealMode === 'typewriter') {
        const totalChars = lineObj.text.length;
        const count = Math.round(totalChars * pProgress);
        lineText = isRTL ? lineObj.shaped.slice(-count) : lineObj.shaped.slice(0, count);
      } else if (revealMode === 'word_by_word' || revealMode === 'wordByWord') {
        const words = lineObj.shaped.split(/\s+/);
        const count = Math.ceil(words.length * pProgress);
        lineText = words.slice(0, count).join(' ');
      } else if (revealMode === 'line_by_line' || revealMode === 'lineByLine') {
        if (pProgress < (lIdx / lines.length)) return;
      }

      // Draw stroke
      if (style.strokeWidth && style.stroke) {
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = Number(style.strokeWidth || 1);
        ctx.strokeText(lineText, drawX, startY);
      }
      ctx.fillText(lineText, drawX, startY);

      // Underline Draw Preset
      if (revealMode === 'underline_draw' || revealMode === 'underlineDraw' || style.underline) {
        const lineW = ctx.measureText(lineText).width;
        let uX = (w - lineW) / 2;
        if (align === 'right') uX = w - lineW;
        else if (align === 'left') uX = 0;
        const uProg = revealMode.includes('underline') ? pProgress : 1.0;
        ctx.save();
        ctx.fillStyle = inPreset?.params?.color || style.underlineColor || '#06b6d4';
        const uH = Number(inPreset?.params?.height || 4);
        ctx.fillRect(uX, startY + 6, lineW * uProg, uH);
        ctx.restore();
      }

      // Highlight Sweep Preset
      if ((revealMode === 'highlight_sweep' || revealMode === 'highlightSweep') && pProgress > 0 && pProgress < 1) {
        const lineW = ctx.measureText(lineText).width;
        let sX = (w - lineW) / 2;
        if (align === 'right') sX = w - lineW;
        else if (align === 'left') sX = 0;
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        const sweepCenter = sX + lineW * pProgress;
        const sweepGrad = ctx.createLinearGradient(sweepCenter - 40, 0, sweepCenter + 40, 0);
        sweepGrad.addColorStop(0, 'rgba(255,255,255,0)');
        sweepGrad.addColorStop(0.5, 'rgba(255,255,255,0.85)');
        sweepGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sweepGrad;
        ctx.fillRect(sX, startY - fontSize, lineW, lineHeight);
        ctx.restore();
      }

      startY += lineHeight;
    });
  }

  function renderShapeLayer(layer, timeSec, ctx, w, h, scene) {
    const style = layer.style || {};
    const content = layer.content || {};
    const brandKit = scene?.brandKit;
    const shape = content.shape || 'rounded-rect';
    const rawFill = sampleProperty(layer, 'style.fill', timeSec) || style.fill || '#3b82f6';
    const fill = resolveBrandToken(rawFill, brandKit);
    const rawStroke = sampleProperty(layer, 'style.stroke', timeSec) || style.stroke;
    const stroke = rawStroke ? resolveBrandToken(rawStroke, brandKit) : null;
    const strokeWidth = Number(sampleProperty(layer, 'style.strokeWidth', timeSec) ?? (style.strokeWidth || 0));
    const radius = Number(style.radius || 12);

    ctx.fillStyle = fill;
    if (stroke && strokeWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
    }

    // Trim-Path style draw-on animation
    const trimStart = Number(sampleProperty(layer, 'style.trimStart', timeSec) ?? (style.trimStart || 0));
    const trimEnd = Number(sampleProperty(layer, 'style.trimEnd', timeSec) ?? (style.trimEnd || 1));
    const isTrimmed = trimStart > 0 || trimEnd < 1;

    let approxPerimeter = (w + h) * 2;
    if (shape === 'circle' || shape === 'donut') approxPerimeter = Math.PI * Math.min(w, h);

    if (isTrimmed) {
      const len = Math.max(0, (trimEnd - trimStart) * approxPerimeter);
      ctx.setLineDash([len, approxPerimeter]);
      ctx.lineDashOffset = -trimStart * approxPerimeter;
    }

    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    } else if (shape === 'donut') {
      const outerR = Math.min(w, h) / 2;
      const innerR = outerR * (Number(content.innerRadius || 0.65));
      ctx.arc(w / 2, h / 2, outerR, 0, Math.PI * 2, false);
      ctx.arc(w / 2, h / 2, innerR, 0, Math.PI * 2, true);
    } else if (shape === 'rounded-rect' || shape === 'rect') {
      drawRoundedRectPath(ctx, 0, 0, w, h, shape === 'rect' ? 0 : radius);
    } else if (shape === 'line') {
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
    } else if (shape === 'arrow') {
      const headSize = Math.min(30, h / 2);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w - headSize, h / 2);
      ctx.moveTo(w - headSize, h / 2 - headSize / 2);
      ctx.lineTo(w, h / 2);
      ctx.lineTo(w - headSize, h / 2 + headSize / 2);
    } else if (shape === 'polygon') {
      const sides = Number(content.sides || 3);
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2;
      for (let i = 0; i < sides; i++) {
        const ang = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const px = cx + r * Math.cos(ang);
        const py = cy + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (shape === 'star') {
      const points = 5;
      const cx = w / 2;
      const cy = h / 2;
      const rOut = Math.min(w, h) / 2;
      const rIn = rOut * 0.45;
      for (let i = 0; i < points * 2; i++) {
        const ang = (i * Math.PI) / points - Math.PI / 2;
        const r = i % 2 === 0 ? rOut : rIn;
        const px = cx + r * Math.cos(ang);
        const py = cy + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    if (shape !== 'line' && shape !== 'arrow') {
      ctx.fill();
    }
    if (stroke && strokeWidth > 0) ctx.stroke();
  }

  function renderCounterLayer(layer, timeSec, ctx, w, h, scene) {
    const content = layer.content || {};
    const style = layer.style || {};
    const brandKit = scene?.brandKit;
    const startVal = Number(content.startVal ?? (content.startValue || 0));
    const endVal = Number(sampleProperty(layer, 'content.value', timeSec) ?? (content.endVal ?? (content.endValue || 100)));
    const lStart = Number(layer.start || 0);
    const lDur = Number(layer.duration || 3);
    const relTime = timeSec - lStart;

    const inPreset = layer.presets?.in;
    let currentVal = endVal;
    if (inPreset && (inPreset.name === 'counter_rollup' || inPreset.name === 'counterRollUp')) {
      const pDur = Number(inPreset.dur || 2.0);
      const prog = Math.max(0, Math.min(1, relTime / pDur));
      const easeFn = getEasing(inPreset.ease || 'easeOutExpo');
      currentVal = startVal + (endVal - startVal) * easeFn(prog);
    } else if (layer.keyframes && layer.keyframes['content.value']) {
      currentVal = Number(sampleProperty(layer, 'content.value', timeSec) ?? endVal);
    }

    const prefix = content.prefix || '';
    const suffix = content.suffix || '';
    const decimals = Number(content.decimals || 0);
    const separator = content.separator !== undefined ? content.separator : ',';
    let numStr = decimals > 0 ? currentVal.toFixed(decimals) : Math.round(currentVal).toString();
    if (separator) {
      const parts = numStr.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
      numStr = parts.join('.');
    }
    const text = `${prefix}${numStr}${suffix}`;

    const fontSize = Number(sampleProperty(layer, 'style.fontSize', timeSec) ?? (style.fontSize || 64));
    const font = resolveBrandToken(style.font, brandKit) || 'Inter, Cairo, sans-serif';
    ctx.font = `${style.fontWeight || 700} ${fontSize}px ${font}`;
    const rawFill = sampleProperty(layer, 'style.fill', timeSec) || style.fill || '#FFFFFF';
    ctx.fillStyle = resolveBrandToken(rawFill, brandKit);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
  }

  function renderProgressLayer(layer, timeSec, ctx, w, h, scene) {
    const content = layer.content || {};
    const style = layer.style || {};
    const brandKit = scene?.brandKit;
    const lStart = Number(layer.start || 0);
    const lDur = Number(layer.duration || 3);
    const relTime = timeSec - lStart;

    const targetVal = Number(sampleProperty(layer, 'content.progress', timeSec) ?? (content.progress || 75));
    const animProgress = Math.max(0, Math.min(1, relTime / Math.max(0.1, lDur * 0.75)));
    const curVal = targetVal * EASINGS.easeOutCubic(animProgress);

    const isRing = layer.type === 'progressRing' || content.shape === 'progressRing';
    const rawBarColor = sampleProperty(layer, 'style.fill', timeSec) || style.fill || '#6366f1';
    const barColor = resolveBrandToken(rawBarColor, brandKit);
    const trackColor = resolveBrandToken(style.trackColor || 'rgba(255, 255, 255, 0.12)', brandKit);

    if (isRing) {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2 - 10;
      const sw = Number(style.strokeWidth || 12);

      // Track
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = trackColor;
      ctx.lineWidth = sw;
      ctx.stroke();

      // Progress Arc
      ctx.beginPath();
      const endAngle = -Math.PI / 2 + (curVal / 100) * Math.PI * 2;
      ctx.arc(cx, cy, r, -Math.PI / 2, endAngle, false);
      ctx.strokeStyle = barColor;
      ctx.lineWidth = sw;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Percentage Text
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${Math.round(r * 0.45)}px Inter, Cairo, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(curVal)}%`, cx, cy);
    } else {
      // Horizontal Bar
      const bh = Math.min(h, 28);
      const by = (h - bh) / 2;

      // Track
      ctx.fillStyle = trackColor;
      drawRoundedRectPath(ctx, 0, by, w, bh, bh / 2);
      ctx.fill();

      // Fill
      const fillW = Math.max(bh, (curVal / 100) * w);
      ctx.fillStyle = barColor;
      drawRoundedRectPath(ctx, 0, by, fillW, bh, bh / 2);
      ctx.fill();

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 13px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(curVal)}%`, w / 2, h / 2);
    }
  }

  function renderChartLayer(layer, timeSec, ctx, w, h, scene) {
    const content = layer.content || {};
    const style = layer.style || {};
    const brandKit = scene?.brandKit;
    const chartType = content.chartType || 'bar';
    const rawData = Array.isArray(content.data) ? content.data : [
      { label: 'A', value: 40, color: '#6366f1' },
      { label: 'B', value: 75, color: '#06b6d4' },
      { label: 'C', value: 110, color: '#10b981' }
    ];

    const data = rawData.map(d => typeof d === 'number' ? { label: '', value: d, color: '#6366f1' } : d);
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const lStart = Number(layer.start || 0);
    const lDur = Number(layer.duration || 3);
    const progress = Math.max(0, Math.min(1, (timeSec - lStart) / Math.max(0.1, lDur * 0.7)));
    const ease = EASINGS.easeOutCubic(progress);

    if (chartType === 'pie') {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2 - 10;
      const totalSum = data.reduce((acc, d) => acc + d.value, 0) || 1;
      let startAngle = -Math.PI / 2;

      data.forEach((d) => {
        const sliceAngle = (d.value / totalSum) * Math.PI * 2 * ease;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = d.color || '#6366f1';
        ctx.fill();
        startAngle += sliceAngle;
      });
    } else if (chartType === 'line') {
      if (data.length < 2) return;
      const stepX = w / (data.length - 1);
      const points = data.map((d, i) => ({
        x: i * stepX,
        y: h - 30 - ((d.value / maxVal) * (h - 50) * ease)
      }));

      // Line path
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = style.stroke || '#6366f1';
      ctx.lineWidth = Number(style.strokeWidth || 4);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Points dots
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#06b6d4';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    } else {
      // Default: Bar
      const count = data.length;
      const gap = 12;
      const barW = (w - gap * (count - 1)) / count;
      data.forEach((d, i) => {
        const barH = (d.value / maxVal) * (h - 35) * ease;
        const bx = i * (barW + gap);
        const by = h - 25 - barH;
        ctx.fillStyle = d.color || '#6366f1';
        drawRoundedRectPath(ctx, bx, by, barW, barH, 6);
        ctx.fill();

        // Label
        if (d.label) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = `600 ${Math.min(13, barW * 0.3)}px Readex Pro, Cairo, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(d.label, bx + barW / 2, h - 8);
        }
      });
    }
  }

  function renderImageLayer(layer, timeSec, ctx, w, h, options) {
    const content = layer.content || {};
    const imgObj = content._loadedImage || (options.imageCache && options.imageCache[content.src]);

    ctx.save();
    // Crop / Mask
    if (content.mask === 'circle') {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
      ctx.clip();
    } else if (content.mask === 'rounded') {
      drawRoundedRectPath(ctx, 0, 0, w, h, Number(layer.style?.radius || 16));
      ctx.clip();
    }

    // Ken Burns effect
    let kbScale = 1.0;
    let kbPanX = 0;
    let kbPanY = 0;
    const lStart = Number(layer.start || 0);
    const lDur = Number(layer.duration || 5);
    const relTime = timeSec - lStart;

    if (content.kenBurns || layer.presets?.kenBurns) {
      const kbProg = Math.max(0, Math.min(1, relTime / Math.max(0.1, lDur)));
      kbScale = 1.0 + 0.15 * kbProg;
      kbPanX = (kbProg - 0.5) * (w * 0.05);
      kbPanY = (kbProg - 0.5) * (h * 0.03);
    }

    ctx.translate(w / 2 + kbPanX, h / 2 + kbPanY);
    ctx.scale(kbScale, kbScale);
    ctx.translate(-w / 2, -h / 2);

    if (imgObj && imgObj.complete && imgObj.naturalWidth) {
      ctx.drawImage(imgObj, 0, 0, w, h);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, w, h);
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(layer.name || 'Image Layer', w / 2, h / 2);
    }
    ctx.restore();
  }

  // -----------------------------------------------------------------
  // 9. MULTI-SCENE TRANSITIONS & STAGGER HELPER
  // -----------------------------------------------------------------
  function renderProjectFrame(project, timeSec, canvas, options = {}) {
    if (!project || !Array.isArray(project.scenes) || project.scenes.length === 0) return;
    const scenes = project.scenes;
    if (scenes.length === 1) {
      renderFrame(scenes[0], timeSec, canvas, options);
      return;
    }

    let accTime = 0;
    let activeIdx = 0;
    let localTime = timeSec;

    for (let i = 0; i < scenes.length; i++) {
      const sDur = getDuration(scenes[i]);
      if (timeSec < accTime + sDur || i === scenes.length - 1) {
        activeIdx = i;
        localTime = timeSec - accTime;
        break;
      }
      accTime += sDur;
    }

    const curScene = scenes[activeIdx];
    const nextScene = scenes[activeIdx + 1] || null;
    const trans = (project.transitions && project.transitions[activeIdx]) || { type: 'fade', dur: 0.5 };
    const transDur = Number(trans.dur || 0.5);
    const sceneDur = getDuration(curScene);
    const inTransWindow = nextScene && localTime >= (sceneDur - transDur);

    if (!inTransWindow) {
      renderFrame(curScene, localTime, canvas, options);
    } else {
      const transProgress = Math.max(0, Math.min(1, (localTime - (sceneDur - transDur)) / transDur));
      const width = Number(curScene.width || canvas.width || 1920);
      const height = Number(curScene.height || canvas.height || 1080);

      if (typeof document !== 'undefined' && document.createElement) {
        const cA = document.createElement('canvas');
        cA.width = width; cA.height = height;
        const cB = document.createElement('canvas');
        cB.width = width; cB.height = height;

        renderFrame(curScene, localTime, cA, { resizeCanvas: false });
        renderFrame(nextScene, localTime - (sceneDur - transDur), cB, { resizeCanvas: false });

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        if (trans.type === 'slide') {
          const offX = width * transProgress;
          ctx.drawImage(cA, -offX, 0);
          ctx.drawImage(cB, width - offX, 0);
        } else if (trans.type === 'wipe') {
          ctx.drawImage(cA, 0, 0);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, width * transProgress, height);
          ctx.clip();
          ctx.drawImage(cB, 0, 0);
          ctx.restore();
        } else {
          // Fade / Cross-dissolve
          ctx.globalAlpha = 1 - transProgress;
          ctx.drawImage(cA, 0, 0);
          ctx.globalAlpha = transProgress;
          ctx.drawImage(cB, 0, 0);
          ctx.globalAlpha = 1;
        }
      } else {
        renderFrame(curScene, localTime, canvas, options);
      }
    }
  }

  function staggerLayers(layers, offsetSec = 0.15) {
    if (!Array.isArray(layers)) return;
    layers.forEach((l, idx) => {
      l.start = Math.round((Number(l.start || 0) + idx * offsetSec) * 100) / 100;
    });
  }

  // -----------------------------------------------------------------
  // 9. FONT LOADER HELPER (BROWSER & CEP)
  // -----------------------------------------------------------------
  async function ensureFontsLoaded(fontFamilies = [], timeoutMs = 3000) {
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) {
      return true; // Headless / Node mode
    }
    const fontsToCheck = Array.isArray(fontFamilies) && fontFamilies.length > 0
      ? fontFamilies
      : ['Cairo', 'Tajawal', 'Almarai', 'Noto Kufi Arabic', 'Readex Pro', 'Inter'];

    const promises = fontsToCheck.map(family => {
      return Promise.race([
        document.fonts.load(`16px "${family}"`),
        new Promise(resolve => setTimeout(resolve, timeoutMs))
      ]);
    });

    await Promise.all(promises);
    return true;
  }

  // -----------------------------------------------------------------
  // 10. EXPORTED PUBLIC API
  // -----------------------------------------------------------------
  return {
    version: '2.0.0',
    validateScene,
    renderFrame,
    getDuration,
    sampleProperty,
    getEasing,
    EASINGS,
    cubicBezierSolver,
    shapeArabic,
    isRTLText,
    layoutTextLines,
    ensureFontsLoaded,
    createPRNG,
    interpolateColor,
    parseColor,
    formatColor,
    renderProjectFrame,
    staggerLayers,
    computeLayerWorldTransform,
    resolveBrandToken,
    applyBrandKitToScene,
    drawWatermark
  };
});
