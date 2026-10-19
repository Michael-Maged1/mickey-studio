/**
 * shared/motion-parser.js
 * Mickey Studio - Robust Motion Scene JSON Parser & Auto-Repair Engine
 * Extracts balanced JSON from LLM text, repairs common formatting flaws,
 * normalizes parameters to the Motion Scene v2 schema, and produces friendly Arabic diagnostics.
 */
'use strict';

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./motion-engine.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    const MotionEngine = require('./motion-engine.js');
    module.exports = factory(MotionEngine);
  } else {
    root.MotionParser = factory(root.MotionEngine);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (MotionEngine) {

  const PRESET_MAPPINGS = {
    // In presets
    'fade': 'pop',
    'fadein': 'pop',
    'fade_in': 'pop',
    'zoom': 'pop',
    'zoomin': 'pop',
    'zoom_in': 'pop',
    'scale': 'pop',
    'scalein': 'pop',
    'scalepop': 'pop',
    'slide': 'slideUp',
    'slideup': 'slideUp',
    'slide_up': 'slideUp',
    'slidedown': 'slideDown',
    'slide_down': 'slideDown',
    'slideleft': 'slideLeft',
    'slide_left': 'slideLeft',
    'slideright': 'slideRight',
    'slide_right': 'slideRight',
    'bounce': 'bounce',
    'bouncein': 'bounce',
    'bounce_in': 'bounce',
    'elastic': 'elastic',
    'elasticin': 'elastic',
    'rotate': 'rotateIn',
    'rotatein': 'rotateIn',
    'rotate_in': 'rotateIn',
    'blur': 'blurIn',
    'blurin': 'blurIn',
    'blur_in': 'blurIn',

    // Out presets
    'fadeout': 'slideDown',
    'fade_out': 'slideDown',
    'zoomout': 'scaleDown',
    'zoom_out': 'scaleDown',
    'scaledown': 'scaleDown',
    'scale_down': 'scaleDown',
    'scale_down_out': 'scaleDown',
    'slide_down_out': 'slideDown',
    'slide_up_out': 'slideUp',
    'slide_left_out': 'slideLeft',
    'slide_right_out': 'slideRight',
    'rotateout': 'rotateOut',
    'rotate_out': 'rotateOut',

    // Loop presets
    'spin': 'spin',
    'rotate_loop': 'spin',
    'float': 'float',
    'hover': 'float',
    'pulse': 'pulse',
    'heartbeat': 'pulse',
    'wiggle': 'wiggle',
    'shake': 'wiggle'
  };

  /**
   * Sanitizes text: strips BOM, zero-width chars, smart quotes, comments, and markdown.
   * Extracts the first balanced JSON object.
   */
  function extractBalancedJson(text) {
    if (!text || typeof text !== 'string') return '';

    // Strip BOM and invisible characters
    let cleaned = text
      .replace(/[\uFEFF\u200B\u200C\u200D]/g, '')
      .replace(/[“”„‟]/g, '"')
      .replace(/[‘’‚‛]/g, "'");

    // Remove markdown code fences if present (e.g. ```json ... ```)
    cleaned = cleaned.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();

    // Remove JavaScript comments outside string literals
    let inString = false;
    let stringChar = '';
    let escaped = false;
    let commentCleaned = '';

    for (let i = 0; i < cleaned.length; i++) {
      const c = cleaned[i];
      const next = cleaned[i + 1] || '';

      if (inString) {
        commentCleaned += c;
        if (escaped) {
          escaped = false;
        } else if (c === '\\') {
          escaped = true;
        } else if (c === stringChar) {
          inString = false;
        }
        continue;
      }

      if (c === '"' || c === "'") {
        inString = true;
        stringChar = c;
        commentCleaned += c;
        continue;
      }

      // Check single-line comment //
      if (c === '/' && next === '/') {
        const lineEnd = cleaned.indexOf('\n', i);
        if (lineEnd === -1) break;
        i = lineEnd;
        continue;
      }

      // Check multi-line comment /* */
      if (c === '/' && next === '*') {
        const commentEnd = cleaned.indexOf('*/', i + 2);
        if (commentEnd === -1) break;
        i = commentEnd + 1;
        continue;
      }

      commentCleaned += c;
    }

    // Find the first balanced opening brace '{'
    const startIdx = commentCleaned.indexOf('{');
    if (startIdx === -1) return '';

    let depth = 0;
    inString = false;
    escaped = false;
    let endIdx = -1;

    for (let i = startIdx; i < commentCleaned.length; i++) {
      const c = commentCleaned[i];

      if (inString) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inString = false;
        continue;
      }

      if (c === '"') {
        inString = true;
        continue;
      }

      if (c === '{') {
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }

    let jsonSlice = endIdx !== -1
      ? commentCleaned.slice(startIdx, endIdx + 1)
      : commentCleaned.slice(startIdx);

    // Remove trailing commas before } or ]
    jsonSlice = jsonSlice.replace(/,\s*([}\]])/g, '$1');

    return jsonSlice.trim();
  }

  /**
   * Translates internal validation errors into clean, informative Arabic messages.
   */
  function translateErrorToArabic(err) {
    if (!err) return '';
    const str = String(err);

    if (/payload must be an object/i.test(str)) return 'النص المستلم ليس كائن JSON صالحاً للمشهد.';
    if (/invalid version/i.test(str)) return 'إصدار المشهد يجب أن يكون 2 (v2 schema).';
    if (/width must be a positive/i.test(str)) return 'أبعاد العرض (width) غير محددة أو غير صالحة.';
    if (/height must be a positive/i.test(str)) return 'أبعاد الارتفاع (height) غير محددة أو غير صالحة.';
    if (/duration must be a positive/i.test(str)) return 'مدة المشهد (duration) يجب أن تكون رقماً موجباً بالثواني.';
    if (/layers must be an array/i.test(str)) return 'طبقات المشهد (layers) يجب أن تكون مصفوفة عناصر صالحة.';
    if (/missing unique id/i.test(str)) return 'إحدى الطبقات تفتقر إلى معرّف فريد (id).';
    if (/duplicate layer id/i.test(str)) return str.replace(/Duplicate layer id: "(.*)" at index (\d+)/i, 'تكرار لمعرّف الطبقة "$1" في الطبقة رقم $2.');
    if (/unsupported type/i.test(str)) return str.replace(/Layer "(.*)" has unsupported type: "(.*)"/i, 'الطبقة "$1" تحتوي على نوع غير مدعوم: "$2". الأنواع المدعومة: text, shape, counter.');
    if (/start time must be non-negative/i.test(str)) return 'وقت بدء إحدى الطبقات (start) غير صالح أو سالب.';
    if (/duration must be greater than 0/i.test(str)) return 'مدة ظهور إحدى الطبقات (duration) يجب أن تكون أكبر من الصفر.';

    return str;
  }

  /**
   * Main Parsing & Auto-Repair Function
   * Never throws. Returns { scene, warnings, errors, valid }
   */
  function parseAndRepairScene(rawText, options = {}) {
    const warnings = [];
    const errors = [];

    const trimmed = String(rawText || '').trim();
    if (!trimmed) {
      return {
        valid: false,
        errors: ['النص المدخل فارغ. الرجاء لصق رد JSON من الذكاء الاصطناعي.'],
        warnings: []
      };
    }

    const extracted = extractBalancedJson(trimmed);
    if (!extracted) {
      return {
        valid: false,
        errors: ['لم يتم العثور على كائن JSON صالح داخل النص. تأكد من نسخ رد الذكاء الاصطناعي كاملاً.'],
        warnings: [],
        raw: trimmed
      };
    }

    let parsed = null;
    try {
      parsed = JSON.parse(extracted);
    } catch (parseErr) {
      // Try secondary cleanup for single quotes
      try {
        const secondary = extracted
          .replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3')
          .replace(/:\s*'([^']*)'/g, ':"$1"');
        parsed = JSON.parse(secondary);
        warnings.push('تم إصلاح علامات الاقتباس الفردية تلقائياً.');
      } catch (_) {
        return {
          valid: false,
          errors: [`خطأ في بنية JSON: ${parseErr.message}. استخدم زر "انسخ طلب الإصلاح" لإرساله للذكاء الاصطناعي.`],
          warnings: [],
          raw: extracted
        };
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        valid: false,
        errors: ['محتوى المشهد ليس كائن JSON صالحاً.'],
        warnings: [],
        raw: extracted
      };
    }

    // -------------------------------------------------------------
    // Auto-Repair Pipeline
    // -------------------------------------------------------------
    const targetAspect = String(options.aspectRatio || parsed.aspectRatio || '16:9').toLowerCase();
    const aspectDims = {
      '16:9': { w: 1920, h: 1080 },
      '9:16': { w: 1080, h: 1920 },
      'vertical': { w: 1080, h: 1920 },
      '1:1': { w: 1080, h: 1080 },
      'square': { w: 1080, h: 1080 }
    }[targetAspect] || { w: 1920, h: 1080 };

    // 1. Version & Metadata
    if (parsed.version !== 2) {
      warnings.push(`تم تحديث إصدار المشهد من ${parsed.version || 1} إلى 2.`);
      parsed.version = 2;
    }
    parsed.id = String(parsed.id || `sc_${Date.now().toString(36)}`);
    parsed.name = String(parsed.name || 'مشهد موشن جرافيك جديد');

    // 2. Canvas Dimensions
    const w = Number(parsed.width);
    const h = Number(parsed.height);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) {
      parsed.width = aspectDims.w;
      parsed.height = aspectDims.h;
      warnings.push(`تم ضبط مقاس المشهد تلقائياً إلى ${parsed.width}×${parsed.height}.`);
    } else {
      parsed.width = Math.min(7680, Math.max(320, Math.round(w)));
      parsed.height = Math.min(7680, Math.max(320, Math.round(h)));
    }

    // 3. FPS & Duration
    parsed.fps = 30;
    const dur = Number(parsed.duration);
    if (!Number.isFinite(dur) || dur <= 0) {
      parsed.duration = 5.0;
      warnings.push('تم تعيين مدة المشهد الافتراضية 5 ثوانٍ.');
    } else {
      parsed.duration = Math.max(1.0, Math.min(60.0, Math.round(dur * 10) / 10));
    }

    // 4. Background
    if (!parsed.background || typeof parsed.background !== 'object') {
      parsed.background = { type: 'color', color: '#0d1117' };
    } else {
      parsed.background.type = parsed.background.type || 'color';
      parsed.background.color = parsed.background.color || '#0d1117';
    }

    // 5. Layers Normalization & Clamping
    if (!Array.isArray(parsed.layers)) {
      parsed.layers = [];
      warnings.push('تم تهيئة مصفوفة الطبقات لأنها كانت مفقودة.');
    }

    const seenIds = new Set();
    const repairedLayers = [];

    parsed.layers.forEach((layer, idx) => {
      if (!layer || typeof layer !== 'object') return;

      // Unique ID
      let id = String(layer.id || `layer_${idx + 1}`).trim();
      if (!id || seenIds.has(id)) {
        id = `${id || 'layer'}_${idx + 1}_${Math.random().toString(36).slice(2, 5)}`;
      }
      seenIds.add(id);
      layer.id = id;

      // Layer Type
      const validTypes = new Set(['text', 'shape', 'counter', 'chart', 'progressBar', 'progressRing', 'image', 'group']);
      if (!validTypes.has(layer.type)) {
        const isTextLike = typeof layer.content === 'string' || Boolean(layer.content?.text) || Boolean(layer.text);
        layer.type = isTextLike ? 'text' : 'shape';
        warnings.push(`تم تحويل الطبقة "${id}" إلى نوع "${layer.type}".`);
      }

      // Timing Clamping
      let start = Number(layer.start);
      if (!Number.isFinite(start) || start < 0) start = 0;
      start = Math.min(start, Math.max(0, parsed.duration - 0.5));
      layer.start = Math.round(start * 100) / 100;

      let lDur = Number(layer.duration);
      if (!Number.isFinite(lDur) || lDur <= 0) lDur = parsed.duration - layer.start;
      lDur = Math.max(0.3, Math.min(lDur, parsed.duration - layer.start));
      layer.duration = Math.round(lDur * 100) / 100;

      // Transform
      const tf = layer.transform || {};
      layer.transform = {
        x: Number.isFinite(Number(tf.x)) ? Number(tf.x) : Math.round(parsed.width / 2),
        y: Number.isFinite(Number(tf.y)) ? Number(tf.y) : Math.round(parsed.height / 2),
        w: Math.max(20, Number(tf.w) || (layer.type === 'text' ? Math.round(parsed.width * 0.7) : 300)),
        h: Math.max(10, Number(tf.h) || (layer.type === 'text' ? 80 : 100)),
        rotation: Number(tf.rotation) || 0,
        scaleX: Number.isFinite(Number(tf.scaleX)) ? Number(tf.scaleX) : 1,
        scaleY: Number.isFinite(Number(tf.scaleY)) ? Number(tf.scaleY) : 1,
        anchorX: Number.isFinite(Number(tf.anchorX)) ? Number(tf.anchorX) : 0.5,
        anchorY: Number.isFinite(Number(tf.anchorY)) ? Number(tf.anchorY) : 0.5,
        opacity: Number.isFinite(Number(tf.opacity)) ? Math.max(0, Math.min(1, Number(tf.opacity))) : 1
      };

      // Style & Content Defaults
      layer.style = layer.style && typeof layer.style === 'object' ? layer.style : {};
      if (layer.type === 'text') {
        layer.style.fill = layer.style.fill || '#ffffff';
        layer.style.font = layer.style.font || 'Cairo';
        layer.style.fontSize = Math.max(14, Number(layer.style.fontSize) || 48);
        layer.style.fontWeight = layer.style.fontWeight || '700';
        layer.style.align = layer.style.align || 'center';
        layer.style.direction = 'rtl'; // Mandatory for Arabic
        if (!layer.content || typeof layer.content !== 'object') {
          layer.content = { text: String(layer.content || layer.text || 'نص توضيحي') };
        } else if (!layer.content.text) {
          layer.content.text = String(layer.text || 'نص توضيحي');
        }
      } else if (layer.type === 'shape') {
        layer.style.fill = layer.style.fill || '#6366f1';
        layer.style.radius = Number(layer.style.radius) || 12;
        if (!layer.content || typeof layer.content !== 'object') {
          layer.content = { shape: 'rect' };
        }
      } else if (layer.type === 'counter') {
        layer.style.fill = layer.style.fill || '#06b6d4';
        layer.style.fontSize = Math.max(18, Number(layer.style.fontSize) || 54);
        layer.content = layer.content && typeof layer.content === 'object' ? layer.content : {};
        layer.content.startVal = Number(layer.content.startVal) || 0;
        layer.content.endVal = Number.isFinite(Number(layer.content.endVal)) ? Number(layer.content.endVal) : 100;
      }

      // Preset Name Normalization
      if (layer.presets && typeof layer.presets === 'object') {
        if (layer.presets.in && typeof layer.presets.in === 'object') {
          const rawName = String(layer.presets.in.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const mapped = PRESET_MAPPINGS[rawName];
          if (mapped) layer.presets.in.name = mapped;
          else if (!['pop', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'bounce', 'elastic', 'rotateIn', 'blurIn'].includes(layer.presets.in.name)) {
            layer.presets.in.name = 'pop';
          }
        }
        if (layer.presets.out && typeof layer.presets.out === 'object') {
          const rawName = String(layer.presets.out.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const mapped = PRESET_MAPPINGS[rawName];
          if (mapped) layer.presets.out.name = mapped;
          else if (!['slideDown', 'slideUp', 'slideLeft', 'slideRight', 'scaleDown', 'rotateOut'].includes(layer.presets.out.name)) {
            layer.presets.out.name = 'slideDown';
          }
        }
        if (layer.presets.loop && typeof layer.presets.loop === 'object') {
          const rawName = String(layer.presets.loop.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const mapped = PRESET_MAPPINGS[rawName];
          if (mapped) layer.presets.loop.name = mapped;
          else if (!['spin', 'float', 'pulse', 'wiggle'].includes(layer.presets.loop.name)) {
            layer.presets.loop.name = 'pulse';
          }
        }
      }

      repairedLayers.push(layer);
    });

    parsed.layers = repairedLayers;

    // Validate with MotionEngine
    if (MotionEngine && typeof MotionEngine.validateScene === 'function') {
      const valResult = MotionEngine.validateScene(parsed);
      if (!valResult.valid) {
        valResult.errors.forEach(e => errors.push(translateErrorToArabic(e)));
      }
      if (valResult.warnings) {
        valResult.warnings.forEach(w => warnings.push(w));
      }
    }

    return {
      valid: errors.length === 0,
      scene: parsed,
      errors,
      warnings
    };
  }

  /**
   * Builds an AI Repair Prompt to paste back into Claude / ChatGPT / Gemini
   */
  function buildRepairPrompt(invalidText, errors = [], options = {}) {
    const errorList = errors.length > 0
      ? errors.map(e => `- ${e}`).join('\n')
      : '- General schema non-compliance or unexpected syntax.';

    const rawSnippet = String(invalidText || '').slice(0, 3000);

    return `Please fix this Motion Scene JSON so it strictly validates against the Mickey Motion v2 schema.

VALIDATION ERRORS FOUND:
${errorList}

INVALID JSON PAYLOAD:
${rawSnippet}

REPAIR RULES:
1. Return strictly ONE valid JSON object.
2. Absolutely NO markdown code fences (\`\`\`json or \`\`\`), NO explanations, and NO intro/outro text.
3. Root object must have "version": 2, "fps": 30, and valid positive "width", "height", "duration".
4. Every layer must have unique "id", valid "type" ("text", "shape", "counter"), "start" >= 0, and ("start" + "duration") <= scene duration.
5. Allowed presets: in: [pop, slideUp, slideDown, slideLeft, slideRight, bounce, elastic, rotateIn, blurIn], out: [slideDown, slideUp, slideLeft, slideRight, scaleDown, rotateOut], loop: [spin, float, pulse, wiggle].
6. All Arabic text must include "style": { "direction": "rtl", "align": "center", "font": "Cairo" | "Readex Pro" }.

Now return ONLY the corrected, fully-compliant JSON object.`;
  }

  return {
    extractBalancedJson,
    parseAndRepairScene,
    buildRepairPrompt,
    translateErrorToArabic,
    PRESET_MAPPINGS
  };
});
