/**
 * Mickey Studio - Motion Scene Engine (v2) Unit Tests
 * Runs on plain Node.js without third-party frameworks.
 */

const assert = require('assert');
const path = require('path');
const MotionEngine = require('../motion-engine.js');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✕ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('\n======================================================');
console.log(' MICKEY STUDIO MOTION ENGINE (v2) - UNIT TEST SUITE');
console.log('======================================================\n');

// -----------------------------------------------------------------
// 1. EASING TESTS
// -----------------------------------------------------------------
console.log('--- 1. Easing Library & Cubic-Bezier Tests ---');

test('Linear easing boundary and intermediate', () => {
  const linear = MotionEngine.getEasing('linear');
  assert.strictEqual(linear(0), 0);
  assert.strictEqual(linear(0.5), 0.5);
  assert.strictEqual(linear(1), 1);
});

test('Quad, Cubic, and Expo easings', () => {
  const quadIn = MotionEngine.getEasing('easeInQuad');
  const cubicOut = MotionEngine.getEasing('easeOutCubic');
  const expoInOut = MotionEngine.getEasing('easeInOutExpo');

  assert.strictEqual(quadIn(0), 0);
  assert.strictEqual(quadIn(1), 1);
  assert.strictEqual(quadIn(0.5), 0.25);

  assert.strictEqual(cubicOut(0), 0);
  assert.strictEqual(cubicOut(1), 1);
  assert(cubicOut(0.5) > 0.5, 'easeOut should be greater than linear at 0.5');

  assert.strictEqual(expoInOut(0), 0);
  assert.strictEqual(expoInOut(1), 1);
});

test('Back, Elastic, and Bounce easings', () => {
  const back = MotionEngine.getEasing('easeOutBack');
  const elastic = MotionEngine.getEasing('easeOutElastic');
  const bounce = MotionEngine.getEasing('easeOutBounce');

  assert.strictEqual(back(0), 0);
  assert.strictEqual(back(1), 1);
  assert(back(0.8) > 1.0, 'easeOutBack should overshoot 1.0 near the end');

  assert.strictEqual(elastic(0), 0);
  assert.strictEqual(elastic(1), 1);

  assert.strictEqual(bounce(0), 0);
  assert.strictEqual(bounce(1), 1);
});

test('Cubic-Bezier solver parses and solves accurately', () => {
  const easeCSS = MotionEngine.getEasing('cubic-bezier(0.25, 0.1, 0.25, 1.0)');
  assert(typeof easeCSS === 'function', 'Should return a solver function');
  assert.strictEqual(easeCSS(0), 0);
  assert.strictEqual(easeCSS(1), 1);
  const mid = easeCSS(0.5);
  assert(mid > 0.5 && mid < 1.0, `Midpoint should be eased, got ${mid}`);
});

// -----------------------------------------------------------------
// 2. SCHEMA VALIDATION TESTS
// -----------------------------------------------------------------
console.log('\n--- 2. Scene Schema v2 Validation Tests ---');

test('Valid v2 scene passes validation', () => {
  const scene = {
    version: 2,
    id: 'sc_valid_01',
    name: 'Test Promo',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5.0,
    background: { type: 'color', color: '#000000' },
    layers: [
      {
        id: 'l1',
        type: 'text',
        name: 'Title',
        start: 0,
        duration: 5.0,
        transform: { x: 960, y: 540, w: 400, h: 100, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        content: { text: 'Hello' }
      }
    ]
  };
  const res = MotionEngine.validateScene(scene);
  assert.strictEqual(res.valid, true, `Errors: ${res.errors.join(', ')}`);
  assert.strictEqual(res.errors.length, 0);
});

test('Rejects invalid version and dimensions', () => {
  const bad = {
    version: 1,
    width: -100,
    height: 0,
    duration: -5,
    layers: 'not-an-array'
  };
  const res = MotionEngine.validateScene(bad);
  assert.strictEqual(res.valid, false);
  assert(res.errors.some(e => e.includes('version')), 'Should report version error');
  assert(res.errors.some(e => e.includes('width')), 'Should report width error');
  assert(res.errors.some(e => e.includes('duration')), 'Should report duration error');
});

test('Catches duplicate layer IDs and unsupported layer types', () => {
  const bad = {
    version: 2,
    id: 's2',
    name: 'Dupe Test',
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 3,
    layers: [
      { id: 'dup_id', type: 'text', start: 0, duration: 1 },
      { id: 'dup_id', type: 'unsupported_3d_mesh', start: 1, duration: 1 }
    ]
  };
  const res = MotionEngine.validateScene(bad);
  assert.strictEqual(res.valid, false);
  assert(res.errors.some(e => e.includes('Duplicate layer id')), 'Should catch duplicate ID');
  assert(res.errors.some(e => e.includes('unsupported type')), 'Should catch unsupported type');
});

// -----------------------------------------------------------------
// 3. KEYFRAME & SAMPLING TESTS
// -----------------------------------------------------------------
console.log('\n--- 3. Keyframe Sampling & Presets Tests ---');

test('Keyframe interpolation (numeric)', () => {
  const layer = {
    id: 'l_kf',
    type: 'shape',
    start: 1.0,
    duration: 4.0,
    transform: { x: 100, y: 200, opacity: 1 },
    keyframes: {
      'transform.x': [
        { t: 0, v: 100, ease: 'linear' },
        { t: 2.0, v: 500, ease: 'linear' }
      ]
    }
  };

  // Before start
  assert.strictEqual(MotionEngine.sampleProperty(layer, 'transform.x', 0.5), 100);
  // Exactly at keyframe 0 (t = 1.0s scene time -> relTime = 0s)
  assert.strictEqual(MotionEngine.sampleProperty(layer, 'transform.x', 1.0), 100);
  // Halfway through (t = 2.0s scene time -> relTime = 1.0s)
  assert.strictEqual(MotionEngine.sampleProperty(layer, 'transform.x', 2.0), 300);
  // At keyframe 1 (t = 3.0s scene time -> relTime = 2.0s)
  assert.strictEqual(MotionEngine.sampleProperty(layer, 'transform.x', 3.0), 500);
  // Past last keyframe
  assert.strictEqual(MotionEngine.sampleProperty(layer, 'transform.x', 4.5), 500);
});

test('Keyframe interpolation (color)', () => {
  const layer = {
    id: 'l_col',
    type: 'shape',
    start: 0,
    duration: 2,
    style: { fill: '#000000' },
    keyframes: {
      'style.fill': [
        { t: 0, v: '#000000', ease: 'linear' },
        { t: 1.0, v: '#ffffff', ease: 'linear' }
      ]
    }
  };
  const midColor = MotionEngine.sampleProperty(layer, 'style.fill', 0.5);
  assert(midColor.includes('128') || midColor.includes('127'), `Should interpolate to gray, got ${midColor}`);
});

test('Preset evaluation (slideUp and loop float)', () => {
  const layer = {
    id: 'l_preset',
    type: 'text',
    start: 0,
    duration: 4,
    transform: { y: 500, opacity: 1 },
    presets: {
      in: { name: 'slideUp', dur: 1.0, ease: 'linear' },
      loop: { name: 'float', period: 2.0, params: { amplitude: 20 } }
    }
  };

  // At t=0, slideUp starts offset by +80
  const yAt0 = MotionEngine.sampleProperty(layer, 'transform.y', 0);
  assert(yAt0 > 550, `Should have slide offset, got ${yAt0}`);

  // At t=1.0, inPreset has completed; loop float at 1.0s (phase = 0.5) has sin(pi) = 0
  const yAt1 = MotionEngine.sampleProperty(layer, 'transform.y', 1.0);
  assert(Math.abs(yAt1 - 500) < 1.0, `Should settle near base 500 at halfway float, got ${yAt1}`);
});

// -----------------------------------------------------------------
// 4. ARABIC SHAPING & RTL TESTS
// -----------------------------------------------------------------
console.log('\n--- 4. Arabic Shaping & RTL Text Tests ---');

test('Detects RTL text accurately', () => {
  assert.strictEqual(MotionEngine.isRTLText('مرحبا بالعالم'), true);
  assert.strictEqual(MotionEngine.isRTLText('Hello World'), false);
  assert.strictEqual(MotionEngine.isRTLText('Mickey Studio - استوديو ميكي'), true);
});

test('Shapes Arabic connected letters and Laam-Alef ligatures', () => {
  const raw = 'لا';
  const shaped = MotionEngine.shapeArabic(raw);
  assert(shaped.charCodeAt(0) >= 0xfef5 && shaped.charCodeAt(0) <= 0xfefc,
    `Laam-Alef should shape to Unicode ligature, got code 0x${shaped.charCodeAt(0).toString(16)}`);

  const rawWord = 'مكتب';
  const shapedWord = MotionEngine.shapeArabic(rawWord);
  // Meem should be Initial, Kaaf Medial, Taa Medial, Baa Final
  assert.notStrictEqual(shapedWord, rawWord, 'Shaped word should use Presentation Forms glyphs');
});

test('Multi-line text layout wraps properly without breaking words', () => {
  const text = 'تصميم احترافي للمشاهد القصيرة بالذكاء الاصطناعي';
  const lines = MotionEngine.layoutTextLines(text, 150, t => t.length * 8);
  assert(lines.length >= 2, `Should wrap into multiple lines, got ${lines.length}`);
  lines.forEach(l => {
    assert(l.text.length > 0);
    assert(l.isRTL === true);
  });
});

// -----------------------------------------------------------------
// 5. DETERMINISTIC RENDER FRAME MOCK TEST
// -----------------------------------------------------------------
console.log('\n--- 5. Deterministic Canvas Render Mock Test ---');

test('Mock Canvas renderFrame executes deterministically', () => {
  const drawCalls = [];
  const mockCtx = {
    save: () => drawCalls.push('save'),
    restore: () => drawCalls.push('restore'),
    clearRect: (x, y, w, h) => drawCalls.push(`clearRect(${x},${y},${w},${h})`),
    fillRect: (x, y, w, h) => drawCalls.push(`fillRect(${x},${y},${w},${h})`),
    fillText: (text, x, y) => drawCalls.push(`fillText(${text},${x},${y})`),
    strokeText: () => {},
    translate: (x, y) => drawCalls.push(`translate(${Math.round(x)},${Math.round(y)})`),
    rotate: (r) => drawCalls.push(`rotate(${r.toFixed(2)})`),
    scale: (sx, sy) => drawCalls.push(`scale(${sx},${sy})`),
    beginPath: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    arc: () => {},
    measureText: (txt) => ({ width: txt.length * 10 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} })
  };

  const mockCanvas = {
    width: 1920,
    height: 1080,
    getContext: () => mockCtx
  };

  const scene = {
    version: 2,
    id: 'mock_render',
    name: 'Mock',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 3,
    background: { type: 'color', color: '#111111' },
    layers: [
      {
        id: 'layer_mock_title',
        type: 'text',
        name: 'Title',
        start: 0,
        duration: 3,
        transform: { x: 960, y: 540, w: 400, h: 100, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        content: { text: 'Mickey' }
      }
    ]
  };

  // Run twice at exact same timestamp t = 1.0s
  MotionEngine.renderFrame(scene, 1.0, mockCanvas);
  const firstRun = [...drawCalls];

  drawCalls.length = 0;
  MotionEngine.renderFrame(scene, 1.0, mockCanvas);
  const secondRun = [...drawCalls];

  assert.deepStrictEqual(firstRun, secondRun, 'Subsequent renders with identical input and time must be identical');
  assert(firstRun.some(c => c.includes('fillText')), 'Should have rendered text');
});

console.log('\n======================================================');
console.log(` RESULT: ${passedTests} / ${totalTests} tests passed successfully.`);
console.log('======================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
