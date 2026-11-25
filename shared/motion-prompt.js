/**
 * shared/motion-prompt.js
 * Mickey Studio - Motion Scene Prompt Builder & Deterministic Art-Director Synthesizer (v2.5)
 * Generates rich, layered prompts for LLMs AND provides an instant local scene synthesizer
 * producing broadcast-grade Arabic motion graphics with gradients, glass cards, glow orbs,
 * kinetic underlines, counters, progress rings, and coordinated exit choreography.
 */
'use strict';

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MotionPrompt = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {

  const ALLOWED_PRESETS = {
    in: ['pop', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'bounce', 'elastic', 'rotateIn', 'blurIn', 'underline_draw', 'word_by_word', 'counter_rollup'],
    out: ['slideDown', 'slideUp', 'slideLeft', 'slideRight', 'scaleDown', 'rotateOut'],
    loop: ['spin', 'float', 'pulse', 'wiggle']
  };

  const BUNDLED_FONTS = ['Readex Pro', 'Cairo', 'Tajawal', 'Almarai', 'Inter'];

  const STYLE_GUIDES = {
    social: 'Vibrant social media motion spot: deep midnight indigo gradient backdrop, soft ambient glow orbs, sleek dark-glass container card with subtle stroke & shadow, bold Arabic kinetic headline with underline accent, vibrant pill badge, punchy pop/bounce/elastic entrances and smooth scaleDown exits.',
    marketing: 'High-converting corporate & e-commerce promo: obsidian-to-slate gradient background, crisp glassmorphic hero card, high-contrast white headline, emerald or indigo CTA pill button with subtle pulse, dynamic counter or progressRing when numbers exist.',
    tech: 'Modern SaaS & AI visual: deep obsidian canvas, cyan & violet neon glow accents, glass UI panel, geometric ring/chart callouts, clean Readex Pro / Inter typography with blurIn and elastic transitions.',
    educational: 'Clean editorial explainer: calm slate-navy gradient backdrop, structured readable card, clear typographic hierarchy, step-by-step staggered reveals, comfortable 8% margins.',
    luxury: 'Editorial luxury dark aesthetic: rich onyx-to-charcoal radial gradient, warm champagne gold (#f59e0b / #fbbf24) accent rules & subtle glow, thin border frame, graceful slideUp and blurIn pacing.'
  };

  const STYLE_PALETTES = {
    social:      { bg0: '#090b16', bg1: '#171230', primary: '#6366f1', secondary: '#ec4899', accent: '#06b6d4', card: 'rgba(20, 22, 38, 0.78)', stroke: 'rgba(129, 140, 248, 0.28)' },
    marketing:   { bg0: '#070b12', bg1: '#0f172a', primary: '#10b981', secondary: '#06b6d4', accent: '#f59e0b', card: 'rgba(15, 23, 42, 0.80)', stroke: 'rgba(16, 185, 129, 0.30)' },
    tech:        { bg0: '#050811', bg1: '#0e172a', primary: '#06b6d4', secondary: '#8b5cf6', accent: '#22d3ee', card: 'rgba(12, 18, 34, 0.82)', stroke: 'rgba(34, 211, 238, 0.30)' },
    educational: { bg0: '#0b101b', bg1: '#162033', primary: '#3b82f6', secondary: '#38bdf8', accent: '#f59e0b', card: 'rgba(20, 30, 48, 0.82)', stroke: 'rgba(96, 165, 250, 0.28)' },
    luxury:      { bg0: '#09090b', bg1: '#181410', primary: '#d97706', secondary: '#fbbf24', accent: '#f59e0b', card: 'rgba(22, 19, 15, 0.84)', stroke: 'rgba(245, 158, 11, 0.35)' }
  };

  const FEW_SHOT_EXAMPLES = [
    {
      description: '16:9 High-Craft Glassmorphic Promo with Ambient Glow, Badge, Kinetic Headline & Metric Ring',
      scene: {
        version: 2,
        id: 'pro_promo_16x9',
        name: 'برومو متجر احترافي',
        width: 1920,
        height: 1080,
        fps: 30,
        duration: 5.0,
        background: {
          type: 'gradient',
          gradient: {
            type: 'radial',
            stops: [
              { offset: 0, color: '#1b163a' },
              { offset: 1, color: '#070912' }
            ]
          }
        },
        layers: [
          {
            id: 'orb_glow_tr',
            type: 'shape',
            name: 'إضاءة محيطية علوية',
            start: 0,
            duration: 5.0,
            transform: { x: 1580, y: 220, w: 520, h: 520, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 0.28 },
            style: { fill: '#6366f1', blur: 60 },
            content: { shape: 'circle' },
            presets: { loop: { name: 'float', period: 4.0, params: { amplitude: 22 } } }
          },
          {
            id: 'orb_glow_bl',
            type: 'shape',
            name: 'إضاءة محيطية سفلية',
            start: 0,
            duration: 5.0,
            transform: { x: 320, y: 860, w: 440, h: 440, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 0.22 },
            style: { fill: '#06b6d4', blur: 55 },
            content: { shape: 'circle' },
            presets: { loop: { name: 'pulse', period: 3.5 } }
          },
          {
            id: 'hero_glass_card',
            type: 'shape',
            name: 'البطاقة الزجاجية الرئيسية',
            start: 0.1,
            duration: 4.9,
            transform: { x: 960, y: 540, w: 1460, h: 740, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: {
              fill: 'rgba(18, 20, 36, 0.78)',
              stroke: 'rgba(129, 140, 248, 0.35)',
              strokeWidth: 2,
              radius: 36,
              shadow: { color: 'rgba(0, 0, 0, 0.55)', blur: 48, x: 0, y: 24 }
            },
            content: { shape: 'rounded-rect' },
            presets: { in: { name: 'pop', dur: 0.6, ease: 'easeOutBack' }, out: { name: 'scaleDown', dur: 0.35 } }
          },
          {
            id: 'top_pill',
            type: 'shape',
            name: 'خلفية الشارة',
            start: 0.25,
            duration: 4.65,
            transform: { x: 960, y: 280, w: 340, h: 58, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: 'rgba(99, 102, 241, 0.18)', stroke: '#6366f1', strokeWidth: 2, radius: 29 },
            content: { shape: 'rounded-rect' },
            presets: { in: { name: 'slideDown', dur: 0.45 }, out: { name: 'slideUp', dur: 0.3 } }
          },
          {
            id: 'top_pill_text',
            type: 'text',
            name: 'نص الشارة',
            start: 0.32,
            duration: 4.55,
            transform: { x: 960, y: 280, w: 310, h: 44, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: '#a5b4fc', font: 'Readex Pro', fontSize: 24, fontWeight: '700', align: 'center', direction: 'rtl' },
            content: { text: 'عرض حصري لفترة محدودة' },
            presets: { in: { name: 'blurIn', dur: 0.4 }, out: { name: 'slideUp', dur: 0.3 } }
          },
          {
            id: 'hero_title',
            type: 'text',
            name: 'العنوان الرئيسي',
            start: 0.45,
            duration: 4.45,
            transform: { x: 960, y: 445, w: 1240, h: 140, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: {
              fill: '#ffffff',
              font: 'Readex Pro',
              fontSize: 78,
              fontWeight: '800',
              align: 'center',
              direction: 'rtl',
              underlineColor: '#06b6d4',
              shadow: { color: 'rgba(99, 102, 241, 0.4)', blur: 24, x: 0, y: 8 }
            },
            content: { text: 'خصم 30% على جميع باقات المتجر' },
            presets: { in: { name: 'underline_draw', dur: 0.7, params: { height: 5 } }, out: { name: 'slideDown', dur: 0.35 } }
          },
          {
            id: 'sub_text',
            type: 'text',
            name: 'النص التوضيحي',
            start: 0.75,
            duration: 4.15,
            transform: { x: 960, y: 585, w: 1020, h: 70, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: '#cbd5e1', font: 'Cairo', fontSize: 34, fontWeight: '600', align: 'center', direction: 'rtl' },
            content: { text: 'تصميم أسرع وجودة أعلى بضغطة زر واحدة' },
            presets: { in: { name: 'slideUp', dur: 0.5 }, out: { name: 'slideDown', dur: 0.35 } }
          },
          {
            id: 'metric_ring',
            type: 'progressRing',
            name: 'حلقة النسبة',
            start: 0.95,
            duration: 3.9,
            transform: { x: 730, y: 760, w: 150, h: 150, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: '#06b6d4', trackColor: 'rgba(255,255,255,0.12)', strokeWidth: 14 },
            content: { progress: 30 },
            presets: { in: { name: 'pop', dur: 0.5 }, out: { name: 'scaleDown', dur: 0.3 } }
          },
          {
            id: 'cta_btn',
            type: 'shape',
            name: 'زر الدعوة لاتخاذ إجراء',
            start: 1.05,
            duration: 3.8,
            transform: { x: 1080, y: 760, w: 420, h: 84, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: {
              fill: '#6366f1',
              radius: 42,
              gradient: { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#06b6d4' }] },
              glow: { color: 'rgba(6, 182, 212, 0.45)', blur: 22 }
            },
            content: { shape: 'rounded-rect' },
            presets: { in: { name: 'elastic', dur: 0.7 }, loop: { name: 'pulse', period: 2.0 }, out: { name: 'scaleDown', dur: 0.3 } }
          },
          {
            id: 'cta_label',
            type: 'text',
            name: 'نص الزر',
            start: 1.15,
            duration: 3.7,
            transform: { x: 1080, y: 760, w: 380, h: 52, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: '#ffffff', font: 'Readex Pro', fontSize: 30, fontWeight: '700', align: 'center', direction: 'rtl' },
            content: { text: 'اطلب العرض الآن ↗' },
            presets: { in: { name: 'pop', dur: 0.4 }, out: { name: 'scaleDown', dur: 0.3 } }
          }
        ]
      }
    }
  ];

  function extractBriefParts(idea, styleKey) {
    const clean = String(idea || '').replace(/\s+/g, ' ').trim() || 'صناعة محتوى ومونتاج احترافي بالذكاء الاصطناعي';
    // Split sentence into title & subcopy cleanly
    const segments = clean.split(/[،,.\n\-—:|]+/).map(s => s.trim()).filter(Boolean);
    let badgeText = 'MICKEY MOTION';
    if (styleKey === 'marketing') badgeText = 'عرض خاص وحصري';
    else if (styleKey === 'tech') badgeText = 'تقنية متطورة';
    else if (styleKey === 'educational') badgeText = 'معلومة سريعة';
    else if (styleKey === 'luxury') badgeText = 'تجربة استثنائية';
    else badgeText = 'جديد ومميز';

    let headline = segments[0] || clean;
    if (headline.length > 48) {
      const words = headline.split(' ');
      const mid = Math.ceil(words.length / 2);
      headline = words.slice(0, Math.min(6, mid)).join(' ');
    }
    let subcopy = segments.slice(1).join(' — ');
    if (!subcopy) {
      const words = clean.split(' ');
      subcopy = words.length > 6 ? words.slice(6).join(' ') : 'جودة سينمائية وسرعة في التنفيذ';
    }
    if (subcopy.length > 68) subcopy = subcopy.slice(0, 65).trim() + '...';

    // Detect explicit number / percentage in user brief
    const pctMatch = clean.match(/(\d+(?:\.\d+)?)\s*%/);
    const numMatch = clean.match(/(\d[\d,]*)\s*(ألف|مليون|K|M|%|ثانية|يوم|ساعة)?/i);
    let stat = null;
    if (pctMatch) {
      stat = { kind: 'ring', value: Math.max(5, Math.min(100, Math.round(Number(pctMatch[1])))), label: `${pctMatch[1]}%` };
    } else if (numMatch) {
      const rawNum = Number(String(numMatch[1]).replace(/,/g, ''));
      if (Number.isFinite(rawNum) && rawNum > 0) {
        const unit = numMatch[2] || '';
        const suffix = unit === 'ألف' ? 'K' : (unit === 'مليون' ? 'M' : (unit ? ` ${unit}` : '+'));
        stat = { kind: 'counter', endVal: rawNum, suffix };
      }
    }

    let ctaText = 'ابدأ التجربة الآن';
    if (/تحميل|تطبيق|app/i.test(clean)) ctaText = 'حمّل التطبيق الآن';
    else if (/خصم|عرض|متجر|شراء|سعر/i.test(clean)) ctaText = 'استفد من العرض ↗';
    else if (/اشترك|متابعة|قناة/i.test(clean)) ctaText = 'اشترك الآن ✦';

    return { badgeText, headline, subcopy, stat, ctaText, rawTitle: clean.slice(0, 36) };
  }

  /**
   * Instant local art-directed scene generator (used as Smart Instant Generate & resilient fallback).
   */
  function synthesizeScene(idea, options = {}) {
    const aspect = String(options.aspectRatio || '16:9').toLowerCase();
    const isVert = aspect === '9:16' || aspect === 'vertical';
    const isSq = aspect === '1:1' || aspect === 'square';
    const width = isVert ? 1080 : 1920;
    const height = isVert ? 1920 : (isSq ? 1080 : 1080);
    const sceneW = isSq ? 1080 : width;

    const duration = Math.max(3, Math.min(30, Number(options.duration) || 5));
    const styleKey = STYLE_PALETTES[String(options.style || 'social').toLowerCase()]
      ? String(options.style || 'social').toLowerCase()
      : 'social';
    const pal = STYLE_PALETTES[styleKey];
    const primary = /^#[0-9a-f]{6}$/i.test(options.primaryColor || '') ? options.primaryColor : pal.primary;
    const secondary = /^#[0-9a-f]{6}$/i.test(options.secondaryColor || '') ? options.secondaryColor : pal.secondary;
    const parts = extractBriefParts(idea, styleKey);

    const cx = sceneW / 2;
    const cy = height / 2;
    const outDur = 0.4;
    const cardW = isVert ? 920 : (isSq ? 900 : 1480);
    const cardH = isVert ? 1320 : (isSq ? 820 : 760);

    const badgeY = isVert ? 470 : (isSq ? 240 : 275);
    const headY = isVert ? 740 : (isSq ? 415 : 440);
    const subY = isVert ? 960 : (isSq ? 555 : 575);
    const statY = isVert ? 1190 : (isSq ? 715 : 750);
    const ctaY = isVert ? (parts.stat ? 1420 : 1260) : (isSq ? 745 : 755);

    const layers = [
      {
        id: 'ambient_orb_top',
        type: 'shape',
        name: 'توهج علوي',
        start: 0,
        duration,
        transform: { x: Math.round(sceneW * 0.82), y: Math.round(height * 0.2), w: isVert ? 540 : 560, h: isVert ? 540 : 560, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 0.30 },
        style: { fill: primary, blur: 65 },
        content: { shape: 'circle' },
        presets: { loop: { name: 'float', period: 4.0, params: { amplitude: 24 } } }
      },
      {
        id: 'ambient_orb_bottom',
        type: 'shape',
        name: 'توهج سفلي',
        start: 0,
        duration,
        transform: { x: Math.round(sceneW * 0.18), y: Math.round(height * 0.82), w: isVert ? 480 : 460, h: isVert ? 480 : 460, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 0.24 },
        style: { fill: secondary, blur: 58 },
        content: { shape: 'circle' },
        presets: { loop: { name: 'pulse', period: 3.4 } }
      },
      {
        id: 'glass_frame_card',
        type: 'shape',
        name: 'بطاقة المشهد الزجاجية',
        start: 0.08,
        duration: Math.max(1, duration - 0.08),
        transform: { x: cx, y: cy, w: cardW, h: cardH, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: {
          fill: pal.card,
          stroke: pal.stroke,
          strokeWidth: 2,
          radius: 36,
          shadow: { color: 'rgba(0, 0, 0, 0.55)', blur: 48, x: 0, y: 22 }
        },
        content: { shape: 'rounded-rect' },
        presets: { in: { name: 'pop', dur: 0.55, ease: 'easeOutBack' }, out: { name: 'scaleDown', dur: outDur } }
      },
      {
        id: 'accent_top_bar',
        type: 'shape',
        name: 'شريط إضاءة علوي',
        start: 0.18,
        duration: Math.max(1, duration - 0.25),
        transform: { x: cx, y: Math.round(cy - cardH / 2 + 6), w: Math.round(cardW * 0.42), h: 6, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 0.95 },
        style: {
          fill: primary,
          gradient: { type: 'linear', angle: 90, stops: [{ offset: 0, color: primary }, { offset: 1, color: secondary }] },
          radius: 3,
          glow: { color: secondary, blur: 16 }
        },
        content: { shape: 'rounded-rect' },
        presets: { in: { name: 'pop', dur: 0.5 }, out: { name: 'scaleDown', dur: 0.3 } }
      },
      {
        id: 'badge_pill',
        type: 'shape',
        name: 'شارة التصنيف',
        start: 0.25,
        duration: Math.max(1, duration - 0.32),
        transform: { x: cx, y: badgeY, w: 340, h: 56, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: 'rgba(255,255,255,0.06)', stroke: primary, strokeWidth: 2, radius: 28 },
        content: { shape: 'rounded-rect' },
        presets: { in: { name: 'slideDown', dur: 0.45 }, out: { name: 'slideUp', dur: 0.3 } }
      },
      {
        id: 'badge_label',
        type: 'text',
        name: 'نص الشارة',
        start: 0.32,
        duration: Math.max(1, duration - 0.38),
        transform: { x: cx, y: badgeY, w: 310, h: 42, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: secondary, font: 'Readex Pro', fontSize: 23, fontWeight: '700', align: 'center', direction: 'rtl' },
        content: { text: parts.badgeText },
        presets: { in: { name: 'blurIn', dur: 0.4 }, out: { name: 'slideUp', dur: 0.3 } }
      },
      {
        id: 'main_headline',
        type: 'text',
        name: 'العنوان الرئيسي',
        start: 0.45,
        duration: Math.max(1, duration - 0.5),
        transform: { x: cx, y: headY, w: cardW - 160, h: isVert ? 240 : 170, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: {
          fill: '#ffffff',
          font: 'Readex Pro',
          fontSize: isVert ? 68 : (isSq ? 58 : 74),
          fontWeight: '800',
          align: 'center',
          direction: 'rtl',
          lineHeight: 1.28,
          underlineColor: secondary,
          shadow: { color: 'rgba(0, 0, 0, 0.45)', blur: 20, x: 0, y: 6 }
        },
        content: { text: parts.headline },
        presets: { in: { name: 'underline_draw', dur: 0.75, params: { height: 5 } }, out: { name: 'slideDown', dur: outDur } }
      },
      {
        id: 'sub_description',
        type: 'text',
        name: 'النص الفرعي',
        start: 0.72,
        duration: Math.max(1, duration - 0.77),
        transform: { x: cx, y: subY, w: cardW - 220, h: isVert ? 140 : 90, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: '#cbd5e1', font: 'Cairo', fontSize: isVert ? 34 : 32, fontWeight: '600', align: 'center', direction: 'rtl', lineHeight: 1.35 },
        content: { text: parts.subcopy },
        presets: { in: { name: 'slideUp', dur: 0.55 }, out: { name: 'slideDown', dur: outDur } }
      }
    ];

    const ctaX = parts.stat && !isVert ? Math.round(cx + 165) : cx;
    const statX = parts.stat && !isVert ? Math.round(cx - 230) : cx;

    if (parts.stat) {
      if (parts.stat.kind === 'ring') {
        layers.push({
          id: 'stat_ring',
          type: 'progressRing',
          name: 'حلقة النسبة المئوية',
          start: 0.92,
          duration: Math.max(1, duration - 0.98),
          transform: { x: statX, y: statY, w: 150, h: 150, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
          style: { fill: secondary, trackColor: 'rgba(255,255,255,0.12)', strokeWidth: 14 },
          content: { progress: parts.stat.value },
          presets: { in: { name: 'pop', dur: 0.5 }, out: { name: 'scaleDown', dur: 0.3 } }
        });
      } else {
        layers.push({
          id: 'stat_counter',
          type: 'counter',
          name: 'عداد الرقم الرئيسي',
          start: 0.92,
          duration: Math.max(1, duration - 0.98),
          transform: { x: statX, y: statY, w: 320, h: 90, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
          style: { fill: secondary, font: 'Inter', fontSize: 58, fontWeight: '800', align: 'center', direction: 'ltr' },
          content: { startVal: 0, endVal: parts.stat.endVal, prefix: '', suffix: parts.stat.suffix },
          presets: { in: { name: 'counter_rollup', dur: 1.4, ease: 'easeOutExpo' }, out: { name: 'scaleDown', dur: 0.3 } }
        });
      }
    }

    layers.push(
      {
        id: 'cta_pill',
        type: 'shape',
        name: 'خلفية زر الإجراء',
        start: 1.05,
        duration: Math.max(1, duration - 1.1),
        transform: { x: ctaX, y: ctaY, w: 420, h: 82, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: {
          fill: primary,
          gradient: { type: 'linear', angle: 90, stops: [{ offset: 0, color: primary }, { offset: 1, color: secondary }] },
          radius: 41,
          glow: { color: secondary, blur: 20 }
        },
        content: { shape: 'rounded-rect' },
        presets: { in: { name: 'elastic', dur: 0.65 }, loop: { name: 'pulse', period: 2.2 }, out: { name: 'scaleDown', dur: 0.3 } }
      },
      {
        id: 'cta_text',
        type: 'text',
        name: 'نص زر الإجراء',
        start: 1.12,
        duration: Math.max(1, duration - 1.18),
        transform: { x: ctaX, y: ctaY, w: 380, h: 52, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: '#ffffff', font: 'Readex Pro', fontSize: 28, fontWeight: '700', align: 'center', direction: 'rtl' },
        content: { text: parts.ctaText },
        presets: { in: { name: 'pop', dur: 0.4 }, out: { name: 'scaleDown', dur: 0.3 } }
      }
    );

    return {
      version: 2,
      id: 'scene_' + Date.now().toString(36),
      name: parts.rawTitle || 'مشهد موشن احترافي',
      width: sceneW,
      height,
      fps: 30,
      duration,
      background: {
        type: 'gradient',
        gradient: {
          type: 'radial',
          stops: [
            { offset: 0, color: pal.bg1 },
            { offset: 1, color: pal.bg0 }
          ]
        }
      },
      layers
    };
  }

  function buildPrompt(idea, options = {}) {
    const rawIdea = String(idea || '').trim();
    const cleanIdea = rawIdea || 'مشهد موشن جرافيك ترويجي احترافي باللغة العربية';

    const aspect = String(options.aspectRatio || '16:9').toLowerCase();
    const duration = Math.max(2, Math.min(30, Number(options.duration) || 5));
    const styleKey = String(options.style || 'social').toLowerCase();
    const styleGuide = STYLE_GUIDES[styleKey] || STYLE_GUIDES.social;

    const brandPrimary = options.brand?.primary || options.primaryColor || '#6366f1';
    const brandSecondary = options.brand?.secondary || options.secondaryColor || '#06b6d4';

    let width = 1920;
    let height = 1080;
    let aspectDesc = '16:9 Widescreen (1920x1080)';
    if (aspect === '9:16' || aspect === 'vertical') {
      width = 1080;
      height = 1920;
      aspectDesc = '9:16 Vertical Video for Reels / Shorts / TikTok (1080x1920)';
    } else if (aspect === '1:1' || aspect === 'square') {
      width = 1080;
      height = 1080;
      aspectDesc = '1:1 Square Post (1080x1080)';
    }

    const refNote = options.referenceNote ? `\nUSER REFERENCE NOTE: ${options.referenceNote}\n` : '';

    return `You are an elite Motion Graphics Art Director creating a studio-grade Arabic motion scene.
Generate a high-production-value Motion Scene adhering strictly to the Mickey Motion Engine v2 JSON specification.

USER BRIEF (Arabic):
"${cleanIdea}"
${refNote}
PRODUCTION PARAMETERS:
- Canvas Format: ${aspectDesc}
- Canvas Resolution: width = ${width}, height = ${height}
- Target Duration: ${duration} seconds
- Framerate: 30 FPS
- Art Direction: ${styleGuide}
- Primary Accent Color: ${brandPrimary}
- Secondary Accent Color: ${brandSecondary}

DESIGN & MOTION RULES (MANDATORY FOR HIGH QUALITY):
1. Return ONLY ONE valid JSON object (NO markdown fences, NO extra text).
2. Root object must have "version": 2 and MUST use "background": { "type": "gradient", "gradient": { "type": "radial"|"linear", "stops": [...] } } for depth — avoid flat dull solid black backgrounds.
3. Build 7 to 12 well-choreographed layers in back-to-front visual hierarchy:
   - 2 ambient blurred glow orbs (shape: "circle", style.blur: 50-70, opacity: 0.2-0.32, loop: "float"|"pulse")
   - 1 glassmorphic container card (shape: "rounded-rect", fill: "rgba(...,0.78)", stroke + strokeWidth: 2, radius: 28-36, shadow)
   - 1 crisp pill category badge + text label
   - 1 bold headline text (underline_draw or pop, underlineColor matching accent)
   - 1 concise Arabic subtitle (slideUp or blurIn)
   - 1 metric widget (progressRing, counter with counter_rollup, or chart) ONLY if the user mentioned metrics/numbers/stats
   - 1 CTA button pill (gradient fill + glow + pulse loop)
4. Every content layer should have both smooth entrance ("in") and coordinated exit ("out") presets, keeping (start + duration) <= ${duration}.
5. Coordinates [x, y] respect anchorX: 0.5, anchorY: 0.5. Keep elements spaced inside 7% safe margins.
6. All Arabic copy must use "direction": "rtl", "align": "center", font in ["Readex Pro", "Cairo", "Tajawal", "Almarai"].

FEW-SHOT REFERENCE SCENE:
${JSON.stringify(FEW_SHOT_EXAMPLES[0].scene, null, 2)}

Now generate the complete, production-ready JSON scene matching: "${cleanIdea}". Output raw JSON only.`;
  }

  return {
    buildPrompt,
    synthesizeScene,
    ALLOWED_PRESETS,
    BUNDLED_FONTS,
    STYLE_GUIDES,
    FEW_SHOT_EXAMPLES
  };
});
