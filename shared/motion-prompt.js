/**
 * shared/motion-prompt.js
 * Mickey Studio - Motion Scene Prompt Builder (v2)
 * Pure JavaScript module: Generates structured, deterministic prompts for LLMs (Claude, ChatGPT, Gemini).
 * Output instructions demand strict JSON adhering to Mickey Motion Scene v2 schema.
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

  // Allowed Presets
  const ALLOWED_PRESETS = {
    in: ['pop', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'bounce', 'elastic', 'rotateIn', 'blurIn'],
    out: ['slideDown', 'slideUp', 'slideLeft', 'slideRight', 'scaleDown', 'rotateOut'],
    loop: ['spin', 'float', 'pulse', 'wiggle']
  };

  // Bundled OFL Fonts
  const BUNDLED_FONTS = ['Cairo', 'Readex Pro', 'Tajawal', 'Almarai', 'Inter'];

  // Style Guides
  const STYLE_GUIDES = {
    social: 'Modern social media video style: high contrast, vibrant accents, energetic typography, bold badge or stat callouts, quick pop-in entrance.',
    marketing: 'Corporate and marketing presentation: sleek dark luxury look, gold or emerald accents, neat geometric cards, elegant slide animations.',
    tech: 'Tech, SaaS, and UI explanation: cyan or violet neons, clean sans-serif typography, structured data cards, counters or progress rings.',
    educational: 'Clear explanatory graphic: high-readability fonts, neutral backgrounds, step-by-step sequential appearance, comfortable padding.',
    luxury: 'Premium aesthetic: obsidian and deep slate background, warm champagne/gold highlights, refined typography with ample negative space.'
  };

  // 3 Fully Valid Few-Shot Examples (strictly validated against MotionEngine.validateScene)
  const FEW_SHOT_EXAMPLES = [
    {
      description: "16:9 Social Media Promo (Headline, Subtitle, Metric Counter)",
      scene: {
        version: 2,
        id: "promo_scene_1",
        name: "عرض ترويجي لمتجر إلكتروني",
        width: 1920,
        height: 1080,
        fps: 30,
        duration: 5.0,
        background: { type: "color", color: "#0d1117" },
        layers: [
          {
            id: "decor_circle",
            type: "shape",
            name: "دائرة خلفية",
            start: 0,
            duration: 5.0,
            transform: { x: 1600, y: 260, w: 220, h: 220, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 0.35 },
            style: { fill: "#6366f1", radius: 110 },
            content: { shape: "circle" },
            presets: { loop: { name: "pulse", period: 2.0 } }
          },
          {
            id: "hero_title",
            type: "text",
            name: "العنوان الرئيسي",
            start: 0.3,
            duration: 4.7,
            transform: { x: 960, y: 420, w: 1200, h: 120, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: "#ffffff", font: "Readex Pro", fontSize: 72, fontWeight: "800", align: "center", direction: "rtl" },
            content: { text: "خصم خاص 30% لفترة محدودة" },
            presets: { in: { name: "pop", dur: 0.6, ease: "easeOutBack" } }
          },
          {
            id: "sub_text",
            type: "text",
            name: "النص الفرعي",
            start: 0.7,
            duration: 4.3,
            transform: { x: 960, y: 550, w: 900, h: 60, "rotation": 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: "#94a3b8", font: "Cairo", fontSize: 34, fontWeight: "600", align: "center", direction: "rtl" },
            content: { text: "استخدم كود التخفيض عند الدفع عبر التطبيق" },
            presets: { in: { name: "slideUp", dur: 0.5, ease: "easeOutCubic" } }
          },
          {
            id: "counter_stat",
            type: "counter",
            name: "عداد النسبة",
            start: 1.1,
            duration: 3.9,
            transform: { x: 960, y: 720, w: 360, h: 90, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: "#06b6d4", font: "Inter", fontSize: 56, fontWeight: "800", align: "center", direction: "ltr" },
            content: { startVal: 0, endVal: 30, prefix: "", suffix: "%" },
            presets: { in: { name: "pop", dur: 0.5 } }
          }
        ]
      }
    },
    {
      description: "9:16 Vertical Story / Reels (Pill Badge, Headline, CTA Shape)",
      scene: {
        version: 2,
        id: "reels_story_1",
        name: "قصة ترويجية رأسية",
        width: 1080,
        height: 1920,
        fps: 30,
        duration: 5.0,
        background: { type: "color", color: "#09090b" },
        layers: [
          {
            id: "badge_pill",
            type: "shape",
            name: "شارة علوية",
            start: 0.2,
            duration: 4.8,
            transform: { x: 540, y: 480, w: 320, h: 60, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: "#18181b", stroke: "#f59e0b", strokeWidth: 2, radius: 30 },
            content: { shape: "rect" },
            presets: { in: { name: "slideDown", dur: 0.5 } }
          },
          {
            id: "badge_text",
            type: "text",
            name: "نص الشارة",
            start: 0.3,
            duration: 4.7,
            transform: { x: 540, y: 480, w: 300, h: 40, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: "#f59e0b", font: "Readex Pro", fontSize: 24, fontWeight: "700", align: "center", direction: "rtl" },
            content: { text: "عرض حصري اليوم" },
            presets: { in: { name: "pop", dur: 0.4 } }
          },
          {
            id: "main_heading",
            type: "text",
            name: "العنوان الرأسي",
            start: 0.6,
            duration: 4.4,
            transform: { x: 540, y: 780, w: 880, h: 220, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: "#ffffff", font: "Cairo", fontSize: 68, fontWeight: "800", align: "center", direction: "rtl" },
            content: { text: "طوّر مهاراتك في صناعة المحتوى" },
            presets: { in: { name: "slideUp", dur: 0.6, ease: "easeOutBack" } }
          },
          {
            id: "cta_button",
            type: "shape",
            name: "زر التفاعل",
            start: 1.2,
            duration: 3.8,
            transform: { x: 540, y: 1400, w: 520, h: 90, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: "#6366f1", radius: 45 },
            content: { shape: "rect" },
            presets: { in: { name: "pop", dur: 0.6 }, loop: { name: "pulse", period: 1.8 } }
          },
          {
            id: "cta_text",
            type: "text",
            name: "نص الزر",
            start: 1.3,
            duration: 3.7,
            transform: { x: 540, y: 1400, w: 480, h: 50, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: "#ffffff", font: "Readex Pro", fontSize: 32, fontWeight: "700", align: "center", direction: "rtl" },
            content: { text: "اشترك الآن مجاناً" },
            presets: { in: { name: "pop", dur: 0.5 } }
          }
        ]
      }
    },
    {
      description: "1:1 Square Card (Card Container, Title, Description, Button)",
      scene: {
        version: 2,
        id: "square_offer_1",
        name: "إعلان مربع",
        width: 1080,
        height: 1080,
        fps: 30,
        duration: 5.0,
        background: { type: "color", color: "#111827" },
        layers: [
          {
            id: "card_bg",
            type: "shape",
            name: "بطاقة المحتوى",
            start: 0.2,
            duration: 4.8,
            transform: { x: 540, y: 540, w: 860, h: 720, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: "#1f2937", stroke: "#374151", strokeWidth: 2, radius: 24 },
            content: { shape: "rect" },
            presets: { in: { name: "pop", dur: 0.6 } }
          },
          {
            id: "card_title",
            type: "text",
            name: "عنوان البطاقة",
            start: 0.5,
            duration: 4.5,
            transform: { x: 540, y: 380, w: 760, h: 90, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: "#ffffff", font: "Cairo", fontSize: 48, fontWeight: "800", align: "center", direction: "rtl" },
            content: { text: "باقة المونتاج الاحترافية" },
            presets: { in: { name: "slideUp", dur: 0.5 } }
          },
          {
            id: "card_desc",
            type: "text",
            name: "تفاصيل العرض",
            start: 0.8,
            duration: 4.2,
            transform: { x: 540, y: 500, w: 720, h: 60, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: "#9ca3af", font: "Tajawal", fontSize: 26, fontWeight: "500", align: "center", direction: "rtl" },
            content: { text: "أكثر من 50 قالب موشن جاهز وتأثيرات بصرية مميزة" },
            presets: { in: { name: "slideUp", dur: 0.5 } }
          },
          {
            id: "card_badge",
            type: "shape",
            name: "شارة السعر",
            start: 1.2,
            duration: 3.8,
            transform: { x: 540, y: 680, w: 280, h: 70, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: "#10b981", radius: 16 },
            content: { shape: "rect" },
            presets: { in: { name: "pop", dur: 0.5 } }
          },
          {
            id: "badge_label",
            type: "text",
            name: "نص السعر",
            start: 1.3,
            duration: 3.7,
            transform: { x: 540, y: 680, w: 260, h: 40, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
            style: { fill: "#ffffff", font: "Readex Pro", fontSize: 26, fontWeight: "700", align: "center", direction: "rtl" },
            content: { text: "سعر رمزي الآن" },
            presets: { in: { name: "pop", dur: 0.4 } }
          }
        ]
      }
    }
  ];

  /**
   * Pure function buildPrompt(idea, options)
   * Builds the comprehensive prompt to give to Claude, ChatGPT, or Gemini.
   */
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

    return `You are an expert Motion Graphics Art Director.
Generate a high-production-value Motion Scene adhering strictly to the Mickey Motion Engine v2 JSON specification.

USER BRIEF (Arabic):
"${cleanIdea}"
${refNote}
PRODUCTION PARAMETERS:
- Canvas Format: ${aspectDesc}
- Canvas Resolution: width = ${width}, height = ${height}
- Target Duration: ${duration} seconds
- Framerate: 30 FPS
- Visual Style: ${styleGuide}
- Primary Accent Color: ${brandPrimary} (or use "brand.primary")
- Secondary Accent Color: ${brandSecondary} (or use "brand.secondary")

HARD RULES (MANDATORY):
1. Return ONLY the valid JSON object.
2. NO markdown code blocks (\`\`\`json or \`\`\`), NO introductory text, NO commentary, NO explanations.
3. Root object must have "version": 2.
4. Total layers must be between 3 and 8 layers (balanced, readable, professional).
5. All layer timing must stay within the scene duration: (start >= 0 and start + duration <= ${duration}).
6. All layer coordinates [x, y] must respect anchorX: 0.5, anchorY: 0.5 (center of the layer bounding box).
   Center of canvas is x=${width / 2}, y=${height / 2}. Keep elements inside comfortable safe margins (7% from edges).
7. All Arabic text must have "style": { "direction": "rtl", "align": "center", "font": "Readex Pro" | "Cairo" | "Tajawal" | "Almarai" }.
8. Use ONLY allowed animation preset names:
   - in: ${ALLOWED_PRESETS.in.join(', ')}
   - out: ${ALLOWED_PRESETS.out.join(', ')}
   - loop: ${ALLOWED_PRESETS.loop.join(', ')}
9. Use exact hex colors (e.g. "#ffffff", "#0d1117") or brand tokens ("brand.primary", "brand.secondary").

SCHEMA V2 SUMMARY:
{
  "version": 2,
  "id": "scene_unique_id",
  "name": "Scene Name in Arabic",
  "width": ${width},
  "height": ${height},
  "fps": 30,
  "duration": ${duration}.0,
  "background": { "type": "color", "color": "#0d1117" },
  "layers": [
    {
      "id": "unique_layer_id",
      "type": "text" | "shape" | "counter",
      "name": "Layer Description",
      "start": 0.0,
      "duration": 5.0,
      "transform": { "x": ${width / 2}, "y": ${height / 2}, "w": 600, "h": 100, "rotation": 0, "scaleX": 1, "scaleY": 1, "anchorX": 0.5, "anchorY": 0.5, "opacity": 1 },
      "style": { "fill": "#ffffff", "font": "Cairo", "fontSize": 56, "fontWeight": "700", "align": "center", "direction": "rtl" },
      "content": { "text": "Arabic copy" },
      "presets": { "in": { "name": "pop", "dur": 0.6 } }
    }
  ]
}

FEW-SHOT EXAMPLES THAT PASS VALIDATION:

EXAMPLE 1 (16:9 Promo):
${JSON.stringify(FEW_SHOT_EXAMPLES[0].scene, null, 2)}

EXAMPLE 2 (9:16 Vertical Story):
${JSON.stringify(FEW_SHOT_EXAMPLES[1].scene, null, 2)}

Now, generate the complete, production-ready JSON scene matching the user brief: "${cleanIdea}". Remember: Output JSON only with NO markdown fences.`;
  }

  return {
    buildPrompt,
    ALLOWED_PRESETS,
    BUNDLED_FONTS,
    STYLE_GUIDES,
    FEW_SHOT_EXAMPLES
  };
});
