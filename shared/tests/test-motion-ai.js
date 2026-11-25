/**
 * Unit Test Suite for Motion AI Assistant, Auto-Repair, Chat Patching, and Deterministic Audit
 */

const fs = require('fs');
const path = require('path');
const MotionEngine = require('../motion-engine.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
    throw new Error(message);
  } else {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  }
}

// Helper auto-repair function matching motion-editor.js
function autoRepairScene(rawOrParsed, aspect = '16:9') {
  let scene = rawOrParsed;
  if (typeof scene === 'string') {
    try {
      const cleaned = scene.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      scene = JSON.parse(cleaned);
    } catch (_) {
      const match = scene.match(/\{[\s\S]*\}/);
      if (match) {
        try { scene = JSON.parse(match[0]); } catch (e) {}
      }
    }
  }
  if (!scene || typeof scene !== 'object') scene = {};

  const dims = {
    '16:9': { w: 1920, h: 1080 },
    '9:16': { w: 1080, h: 1920 },
    '1:1': { w: 1080, h: 1080 },
    '4:5': { w: 1080, h: 1350 }
  }[aspect] || { w: 1920, h: 1080 };

  scene.version = 2;
  scene.id = String(scene.id || `sc_ai_${Date.now()}`);
  scene.name = String(scene.name || 'مشهد بالذكاء الاصطناعي');
  scene.width = Number(scene.width) || dims.w;
  scene.height = Number(scene.height) || dims.h;
  scene.fps = 30;
  scene.duration = Math.max(2.0, Math.min(30.0, Number(scene.duration) || 5.0));

  if (!scene.background || typeof scene.background !== 'object') {
    scene.background = { type: 'color', color: '#0b0d14' };
  } else if (!scene.background.type) {
    scene.background.type = scene.background.color ? 'color' : 'transparent';
  }

  if (!Array.isArray(scene.layers)) scene.layers = [];

  scene.layers = scene.layers.map((layer, idx) => {
    if (!layer || typeof layer !== 'object') layer = {};
    const lid = String(layer.id || `layer_${idx + 1}`);
    const isTextLike = typeof layer.content === 'string' || Boolean(layer.content?.text) || Boolean(layer.text);
    const ltype = ['text', 'shape', 'counter', 'image', 'chart', 'progressBar', 'progressRing'].includes(layer.type)
      ? layer.type
      : (isTextLike ? 'text' : 'shape');
    const start = Math.max(0, Number(layer.start) || 0);
    const duration = Math.max(0.5, Math.min(scene.duration - start, Number(layer.duration) || (scene.duration - start)));

    const tf = layer.transform || {};
    const transform = {
      x: Number.isFinite(Number(tf.x)) ? Number(tf.x) : Math.round(scene.width / 2),
      y: Number.isFinite(Number(tf.y)) ? Number(tf.y) : Math.round(scene.height / 2),
      w: Math.max(20, Number(tf.w) || (ltype === 'text' ? Math.round(scene.width * 0.7) : 300)),
      h: Math.max(10, Number(tf.h) || (ltype === 'text' ? 80 : 100)),
      rotation: Number(tf.rotation) || 0,
      scaleX: Number.isFinite(Number(tf.scaleX)) ? Number(tf.scaleX) : 1,
      scaleY: Number.isFinite(Number(tf.scaleY)) ? Number(tf.scaleY) : 1,
      anchorX: Number.isFinite(Number(tf.anchorX)) ? Number(tf.anchorX) : 0.5,
      anchorY: Number.isFinite(Number(tf.anchorY)) ? Number(tf.anchorY) : 0.5,
      opacity: Number.isFinite(Number(tf.opacity)) ? Number(tf.opacity) : 1
    };

    const st = layer.style || {};
    const style = { ...st };
    if (ltype === 'text') {
      style.fill = style.fill || '#ffffff';
      style.font = style.font || 'Readex Pro';
      style.fontSize = Math.max(16, Number(style.fontSize) || 48);
      style.fontWeight = style.fontWeight || '700';
      style.align = style.align || 'center';
      style.direction = style.direction || 'rtl';
    } else if (ltype === 'shape') {
      style.fill = style.fill || '#6366f1';
      style.radius = Number(style.radius) || 12;
    }

    let content = layer.content;
    if (ltype === 'text') {
      const textVal = typeof content === 'string' ? content : (content?.text || layer.text || layer.name || 'نص جديد');
      content = { text: String(textVal) };
    } else if (!content || typeof content !== 'object') {
      content = { shape: 'rounded-rect' };
    }

    let presets = layer.presets;
    if (typeof presets === 'string') {
      presets = { in: { name: presets, dur: 0.5 } };
    } else if (presets && typeof presets === 'object') {
      if (typeof presets.in === 'string') presets.in = { name: presets.in, dur: 0.5 };
      if (typeof presets.out === 'string') presets.out = { name: presets.out, dur: 0.4 };
      if (typeof presets.loop === 'string') presets.loop = { name: presets.loop, dur: 2.0 };
    }

    return {
      id: lid,
      type: ltype,
      name: String(layer.name || (ltype === 'text' ? 'نص' : 'شكل')),
      start,
      duration,
      transform,
      style,
      content,
      presets: presets || undefined
    };
  });

  return scene;
}

// Patch applicator
function applyScenePatches(scene, patches) {
  if (!Array.isArray(patches) || !patches.length) return false;
  let appliedCount = 0;

  for (const patch of patches) {
    if (!patch || !patch.op) continue;
    const op = patch.op;

    if (op === 'set') {
      const pathParts = String(patch.path || '').split('.');
      let target = scene;
      for (let i = 0; i < pathParts.length - 1; i++) {
        let part = pathParts[i];
        const match = part.match(/^layers\[(\d+)\]$/);
        if (match) {
          target = target.layers?.[parseInt(match[1])];
        } else {
          target = target[part];
        }
        if (!target) break;
      }
      if (target) {
        const lastPart = pathParts[pathParts.length - 1];
        const match = lastPart.match(/^layers\[(\d+)\]$/);
        if (match) {
          if (scene.layers) scene.layers[parseInt(match[1])] = patch.value;
        } else {
          target[lastPart] = patch.value;
        }
        appliedCount++;
      }
    } else if (op === 'merge') {
      const pathParts = String(patch.path || '').split('.');
      let target = scene;
      for (let i = 0; i < pathParts.length; i++) {
        let part = pathParts[i];
        const match = part.match(/^layers\[(\d+)\]$/);
        if (match) {
          target = target.layers?.[parseInt(match[1])];
        } else {
          target = target[part];
        }
        if (!target) break;
      }
      if (target && typeof target === 'object' && typeof patch.value === 'object') {
        Object.assign(target, patch.value);
        appliedCount++;
      }
    } else if (op === 'add_layer') {
      if (patch.layer && typeof patch.layer === 'object') {
        if (!Array.isArray(scene.layers)) scene.layers = [];
        scene.layers.push(patch.layer);
        appliedCount++;
      }
    } else if (op === 'remove_layer') {
      if (patch.id && Array.isArray(scene.layers)) {
        scene.layers = scene.layers.filter(l => l.id !== patch.id);
        appliedCount++;
      } else if (typeof patch.index === 'number' && Array.isArray(scene.layers)) {
        scene.layers.splice(patch.index, 1);
        appliedCount++;
      }
    }
  }
  return appliedCount > 0;
}

// WCAG Luminance & Contrast
function parseColorToRgb(colorStr) {
  if (!colorStr) return [11, 13, 20];
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length >= 6) {
      return [
        parseInt(hex.slice(0, 2), 16) || 0,
        parseInt(hex.slice(2, 4), 16) || 0,
        parseInt(hex.slice(4, 6), 16) || 0
      ];
    }
  }
  return [255, 255, 255];
}

function getRelativeLuminance(rgb) {
  const srgb = rgb.map(v => {
    const s = Math.max(0, Math.min(255, v)) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function getContrastRatio(rgb1, rgb2) {
  const l1 = getRelativeLuminance(rgb1);
  const l2 = getRelativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function runDeterministicAudit(scene) {
  const issues = [];
  const width = scene.width || 1920;
  const height = scene.height || 1080;
  const bgColor = scene.background?.color || '#0b0d14';
  const bgRgb = parseColorToRgb(bgColor);

  const layers = Array.isArray(scene.layers) ? scene.layers : [];

  for (const layer of layers) {
    if (layer.type === 'text') {
      const text = String(layer.content?.text || '').trim();
      const fill = layer.style?.fill || '#ffffff';
      const fontSize = Number(layer.style?.fontSize) || 48;
      const duration = Number(layer.duration) || 1;

      // 1. Contrast Check
      const textRgb = parseColorToRgb(fill);
      const ratio = getContrastRatio(textRgb, bgRgb);
      if (ratio < 4.5) {
        issues.push({
          type: 'contrast',
          ratio,
          autoFix: () => { layer.style.fill = '#ffffff'; }
        });
      }

      // 2. Mobile Font Size Check
      const isMobile = width <= 1080 || height > width;
      const minSize = isMobile ? 28 : 24;
      if (fontSize < minSize) {
        issues.push({
          type: 'size',
          fontSize,
          autoFix: () => { layer.style.fontSize = 34; }
        });
      }

      // 3. Safe Area Bounds Check
      const tf = layer.transform || { x: width / 2, y: height / 2, w: 400, h: 80, anchorX: 0.5, anchorY: 0.5 };
      const anchorX = typeof tf.anchorX === 'number' ? tf.anchorX : 0.5;
      const anchorY = typeof tf.anchorY === 'number' ? tf.anchorY : 0.5;
      const left = tf.x - tf.w * anchorX;
      const right = tf.x + tf.w * (1 - anchorX);
      const top = tf.y - tf.h * anchorY;
      const bottom = tf.y + tf.h * (1 - anchorY);

      const safeMarginX = width * 0.05;
      const safeMarginY = height * 0.05;

      if (left < safeMarginX || right > width - safeMarginX || top < safeMarginY || bottom > height - safeMarginY) {
        issues.push({
          type: 'safe_area',
          autoFix: () => {
            if (left < safeMarginX) tf.x = safeMarginX + tf.w * anchorX;
            if (right > width - safeMarginX) tf.x = width - safeMarginX - tf.w * (1 - anchorX);
            if (top < safeMarginY) tf.y = safeMarginY + tf.h * anchorY;
            if (bottom > height - safeMarginY) tf.y = height - safeMarginY - tf.h * (1 - anchorY);
          }
        });
      }

      // 4. Text Reading Density Check
      const words = text ? text.split(/\s+/).length : 0;
      const speed = duration > 0 ? (words / duration) : 0;
      if (speed > 3.0 || (words > 22 && speed > 2.5)) {
        issues.push({
          type: 'density',
          words,
          speed,
          autoFix: () => {
            const needed = Math.max(duration + 1.5, Math.ceil(words / 2.2));
            layer.duration = needed;
            if (layer.start + needed > scene.duration) {
              scene.duration = Math.ceil(layer.start + needed);
            }
          }
        });
      }
    }
  }

  return issues;
}

// -------------------------------------------------------------
// RUN TESTS
// -------------------------------------------------------------
console.log('=== Motion AI Suite Unit Tests ===\n');

// 1. Auto-Repair Test
console.log('--- 1. Auto-Repair Common LLM Flaws ---');
const rawLlmOutput = `
\`\`\`json
{
  "name": "مشهد تجريبي غير مكتمل",
  "duration": 4.5,
  "layers": [
    {
      "name": "عنوان رئيسي",
      "content": "مرحباً بكم في استوديو ميكي",
      "presets": { "in": "fade" }
    }
  ]
}
\`\`\`
`;

const repaired = autoRepairScene(rawLlmOutput, '16:9');
assert(repaired.version === 2, 'Auto-repair sets version: 2');
assert(repaired.width === 1920 && repaired.height === 1080, 'Auto-repair supplies 16:9 dimensions');
assert(repaired.layers.length === 1, 'Auto-repair preserves layer array');
assert(repaired.layers[0].type === 'text', 'Auto-repair infers text layer type');
assert(typeof repaired.layers[0].presets.in === 'object' && repaired.layers[0].presets.in.name === 'fade', 'Auto-repair converts string preset to object');
assert(repaired.layers[0].transform.anchorX === 0.5, 'Auto-repair supplies anchorX');
const vRes = MotionEngine.validateScene(repaired);
assert(vRes.valid === true, 'Repaired scene passes validateScene()');

// 2. Chat Patch Applicator Tests
console.log('\n--- 2. Chat Patch Applicator ---');
const patches = [
  { op: 'set', path: 'background.color', value: '#1e3a8a' },
  { op: 'set', path: 'layers[0].style.fontSize', value: 72 },
  { op: 'merge', path: 'layers[0].transform', value: { scaleX: 1.2, scaleY: 1.2 } },
  {
    op: 'add_layer',
    layer: {
      id: 'sub_bar',
      type: 'shape',
      name: 'شريط سفلي',
      start: 0.5,
      duration: 3.5,
      transform: { x: 960, y: 700, w: 400, h: 40, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
      style: { fill: '#06b6d4' },
      content: { shape: 'rounded-rect' }
    }
  }
];

const patchRes = applyScenePatches(repaired, patches);
assert(patchRes === true, 'applyScenePatches reports success');
assert(repaired.background.color === '#1e3a8a', 'Patch op set background.color');
assert(repaired.layers[0].style.fontSize === 72, 'Patch op set fontSize');
assert(repaired.layers[0].transform.scaleX === 1.2, 'Patch op merge transform scaleX');
assert(repaired.layers.length === 2, 'Patch op add_layer added second layer');
assert(MotionEngine.validateScene(repaired).valid === true, 'Patched scene validates successfully');

// 3. WCAG Luminance & Contrast Calculation Tests
console.log('\n--- 3. WCAG Contrast Calculation ---');
const darkRgb = parseColorToRgb('#0b0d14');
const whiteRgb = parseColorToRgb('#ffffff');
const lowContrastRgb = parseColorToRgb('#161a29');

const whiteDarkRatio = getContrastRatio(whiteRgb, darkRgb);
const lowRatio = getContrastRatio(lowContrastRgb, darkRgb);
assert(whiteDarkRatio > 15.0, `White on dark gives high contrast ratio (${whiteDarkRatio.toFixed(1)}:1 > 15:1)`);
assert(lowRatio < 4.5, `Dark slate on dark gives failing contrast ratio (${lowRatio.toFixed(1)}:1 < 4.5:1)`);

// 4. Deterministic Design Audit Tests
console.log('\n--- 4. Deterministic Design Audit & Auto-Fix ---');
const auditScene = {
  version: 2,
  id: 'test_audit_scene',
  name: 'مشهد للاختبار',
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 4.0,
  background: { type: 'color', color: '#0b0d14' },
  layers: [
    {
      id: 'bad_contrast',
      type: 'text',
      name: 'نص خافت',
      start: 0,
      duration: 4.0,
      transform: { x: 960, y: 400, w: 800, h: 80, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
      style: { fill: '#141724', font: 'Readex Pro', fontSize: 18 }, // Low contrast & small font (< 24)
      content: { text: 'نص تجريبي لاختبار التباين' }
    },
    {
      id: 'out_of_safe',
      type: 'text',
      name: 'نص خارج منطقة الأمان',
      start: 0,
      duration: 2.0,
      transform: { x: 30, y: 30, w: 600, h: 60, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 }, // Outside 5% margin (96px, 54px)
      style: { fill: '#ffffff', font: 'Readex Pro', fontSize: 40 },
      content: { text: 'هذا النص طويل جداً ويحتوي على عدد كبير جداً من الكلمات التي يستحيل قراءتها في ثانيتين فقط بدون سرعة خارقة' } // > 16 words in 2s
    }
  ]
};

const issues = runDeterministicAudit(auditScene);
assert(issues.some(i => i.type === 'contrast'), 'Audit detects low contrast issue');
assert(issues.some(i => i.type === 'size'), 'Audit detects small mobile font issue');
assert(issues.some(i => i.type === 'safe_area'), 'Audit detects safe-area violation');
assert(issues.some(i => i.type === 'density'), 'Audit detects text density & reading speed issue');

// Apply auto-fixes
for (const issue of issues) {
  issue.autoFix();
}

// Re-audit after fixes
const issuesAfterFix = runDeterministicAudit(auditScene);
assert(issuesAfterFix.length === 0, 'All issues resolved after auto-fix!');
assert(auditScene.layers[0].style.fill === '#ffffff', 'Contrast auto-fix updated text fill to white');
assert(auditScene.layers[0].style.fontSize === 34, 'Size auto-fix updated fontSize to 34');
assert(auditScene.layers[1].duration >= 8, 'Density auto-fix expanded layer duration for comfortable reading');

console.log(`\n======================================================`);
console.log(` RESULT: ${passed} passed, ${failed} failed.`);
console.log(`======================================================\n`);
if (failed > 0) process.exit(1);
