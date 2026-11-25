/**
 * Mickey Studio - Cloud Color Filters & 3D LUTs Library Studio
 * Interactive Before/After comparison, live Color Grading sliders,
 * .cube file inspector, and 33x33x33 3D .cube LUT generator & exporter.
 */
'use strict';

window.MickeyLutStudio = (function () {
  const clamp01 = v => (v < 0 ? 0 : (v > 1 ? 1 : v));
  const sCurve = (x, contrast = 1.0, lift = 0.0) => {
    const v = clamp01(x);
    return clamp01((v - 0.5) * contrast + 0.5 + lift * (1 - v));
  };
  const slog3ToRec709 = x => {
    const v = clamp01(x);
    let lin = v >= 171.2102946929 / 1023.0
      ? Math.pow(10, (v * 1023.0 - 420.0) / 261.5) * 0.19 - 0.01
      : (v * 1023.0 - 95.0) * 0.01125 / (171.2102946929 - 95.0);
    lin = Math.max(0, lin);
    const m = (lin / (1 + lin * 0.35)) * 1.32;
    return clamp01(m < 0.018 ? 4.5 * m : 1.099 * Math.pow(m, 0.45) - 0.099);
  };
  const clogToRec709 = x => {
    const lin = Math.max(0, (Math.pow(10, (clamp01(x) - 0.0730597) / 0.529136) - 1) / 10.1596);
    const m = (lin / (1 + lin * 0.3)) * 1.25;
    return clamp01(m < 0.018 ? 4.5 * m : 1.099 * Math.pow(m, 0.45) - 0.099);
  };
  const vlogToRec709 = x => {
    const v = clamp01(x);
    const lin = Math.max(0, v < 0.181 ? (v - 0.125) / 5.6 : Math.pow(10, (v - 0.428891) / 0.241514) - 0.00873);
    const m = (lin / (1 + lin * 0.32)) * 1.28;
    return clamp01(m < 0.018 ? 4.5 * m : 1.099 * Math.pow(m, 0.45) - 0.099);
  };

  const LUT_PRESETS = [
    {
      id: 'teal_orange',
      name: 'Teal & Orange سينمائي',
      category: 'cinema',
      badge: 'الأكثر طلباً',
      swatch: ['#06b6d4', '#f97316'],
      desc: 'دفء سينمائي للبشرة مع ظلال تيل عميقة وتباين متوازن للأفلام واليوتيوب.',
      fn: (r, g, b) => {
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const sh = Math.pow(1 - clamp01(luma), 1.6);
        const hi = Math.pow(clamp01(luma), 1.4);
        return [
          clamp01(sCurve(r, 1.14, 0) - sh * 0.065 + hi * 0.085),
          clamp01(sCurve(g, 1.11, 0) + sh * 0.015 + hi * 0.02),
          clamp01(sCurve(b, 1.11, 0) + sh * 0.08 - hi * 0.07)
        ];
      }
    },
    {
      id: 'kodak_2383',
      name: 'Kodak 2383 أفلام كلاسيك',
      category: 'film',
      badge: 'سينمائي',
      swatch: ['#f59e0b', '#78350f'],
      desc: 'محاكاة طباعة أفلام 35mm بألوان ذهبية دافئة وتدرج ناعم في الظلال.',
      fn: (r, g, b) => [
        clamp01(0.02 + sCurve(r, 1.2, 0.01) * 1.04),
        clamp01(0.015 + sCurve(g, 1.16, 0.005) * 0.99),
        clamp01(0.025 + sCurve(b, 1.1, 0) * 0.89)
      ]
    },
    {
      id: 'fuji_eterna',
      name: 'Fuji Eterna نظيف وطبيعي',
      category: 'film',
      badge: 'هادئ',
      swatch: ['#34d399', '#1e293b'],
      desc: 'ألوان هادئة مريحة للعين وتباين ناعم مثالي للفلوجات والمقابلات.',
      fn: (r, g, b) => [
        clamp01(0.03 + sCurve(r, 1.07, 0.01) * 0.96),
        clamp01(0.03 + sCurve(g, 1.09, 0.01) * 0.98),
        clamp01(0.035 + sCurve(b, 1.07, 0.01) * 0.96)
      ]
    },
    {
      id: 'golden_hour',
      name: 'Golden Hour الغروب الذهبي',
      category: 'cinema',
      badge: 'دافئ',
      swatch: ['#fbbf24', '#ea580c'],
      desc: 'إشراقة دافئة وتوهج ذهبي في الإضاءات العالية للبورتريه والسفر.',
      fn: (r, g, b) => {
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const hi = Math.pow(clamp01(luma), 1.25);
        return [
          clamp01(sCurve(r, 1.09, 0.015) + hi * 0.09),
          clamp01(sCurve(g, 1.08, 0.01) + hi * 0.045),
          clamp01(sCurve(b, 1.05, 0) - hi * 0.07)
        ];
      }
    },
    {
      id: 'cyber_steel',
      name: 'Cold Thriller ليلي بارد',
      category: 'cinema',
      badge: 'مودرن',
      swatch: ['#38bdf8', '#4f46e5'],
      desc: 'درجات فولاذية وزرقاء عميقة للمشاهد التقنية والدرامية والتشويق.',
      fn: (r, g, b) => {
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return [
          clamp01(sCurve(r * 0.76 + luma * 0.24, 1.16, 0) * 0.92),
          clamp01(sCurve(g * 0.84 + luma * 0.16, 1.15, 0) * 0.99),
          clamp01(sCurve(b * 0.9 + luma * 0.1, 1.15, 0) * 1.1)
        ];
      }
    },
    {
      id: 'noir_bw',
      name: 'Silver Noir أبيض وأسود',
      category: 'film',
      badge: 'أحادي',
      swatch: ['#e4e4e7', '#27272a'],
      desc: 'تباين غني بالأبيض والأسود مع تدرجات فضية عميقة ووضوح حاد.',
      fn: (r, g, b) => {
        const y = clamp01(sCurve(0.28 * r + 0.62 * g + 0.1 * b, 1.3, 0));
        return [y, y, y];
      }
    },
    {
      id: 'slog3_rec709',
      name: 'Sony S-Log3 → Rec.709',
      category: 'log',
      badge: 'Log Convert',
      swatch: ['#a855f7', '#ec4899'],
      desc: 'تحويل تقني قياسي للقطات كاميرات Sony S-Log3 إلى ألوان Rec.709 متوازنة.',
      fn: (r, g, b) => [slog3ToRec709(r), slog3ToRec709(g), slog3ToRec709(b)]
    },
    {
      id: 'clog_rec709',
      name: 'Canon C-Log → Rec.709',
      category: 'log',
      badge: 'Log Convert',
      swatch: ['#ef4444', '#f59e0b'],
      desc: 'تحويل تقني للقطات Canon Cinema Log مع الحفاظ على درجات البشرة.',
      fn: (r, g, b) => [clogToRec709(r), clogToRec709(g), clogToRec709(b)]
    },
    {
      id: 'vlog_rec709',
      name: 'Panasonic V-Log → Rec.709',
      category: 'log',
      badge: 'Log Convert',
      swatch: ['#10b981', '#3b82f6'],
      desc: 'استعادة مدى التباين والألوان للقطات Lumix / Panasonic V-Log.',
      fn: (r, g, b) => [vlogToRec709(r), vlogToRec709(g), vlogToRec709(b)]
    }
  ];

  const state = {
    initialized: false,
    presetId: 'teal_orange',
    customCube: null,
    filterCategory: 'all',
    splitRatio: 0.52,
    adjust: {
      intensity: 100,
      exposure: 0,
      contrast: 0,
      temperature: 0,
      saturation: 100,
      fade: 0
    },
    sourceImg: null,
    sourceData: null,
    gradedData: null
  };

  function parseCubeText(text, name = 'Custom.cube') {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
    let size = 0;
    const nums = [];
    for (const raw of lines) {
      const line = raw.split('#')[0].trim();
      if (!line) continue;
      if (/^LUT_3D_SIZE/i.test(line)) {
        size = parseInt(line.split(/\s+/)[1], 10) || 0;
        continue;
      }
      if (/^(TITLE|DOMAIN_|LUT_)/i.test(line)) continue;
      const parts = line.split(/[\s,;]+/);
      if (parts.length >= 3) {
        const r = parseFloat(parts[0]), g = parseFloat(parts[1]), b = parseFloat(parts[2]);
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) nums.push(r, g, b);
      }
    }
    if (!size) {
      const root = Math.round(Math.cbrt(nums.length / 3));
      if (root >= 2 && root * root * root * 3 <= nums.length) size = root;
    }
    if (!size || nums.length < size * size * size * 3) {
      throw new Error(`ملف LUT غير صالح: ${name}`);
    }
    return { name, size, data: new Float32Array(nums.slice(0, size * size * size * 3)) };
  }

  function sampleCustomCube(cube, rIn, gIn, bIn) {
    const N = cube.size, d = cube.data;
    const fr = clamp01(rIn) * (N - 1), fg = clamp01(gIn) * (N - 1), fb = clamp01(bIn) * (N - 1);
    const r0 = Math.floor(fr), r1 = Math.min(N - 1, r0 + 1), tr = fr - r0;
    const g0 = Math.floor(fg), g1 = Math.min(N - 1, g0 + 1), tg = fg - g0;
    const b0 = Math.floor(fb), b1 = Math.min(N - 1, b0 + 1), tb = fb - b0;
    const idx = (ri, gi, bi) => ((bi * N + gi) * N + ri) * 3;
    const out = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const c00 = d[idx(r0, g0, b0) + c] * (1 - tr) + d[idx(r1, g0, b0) + c] * tr;
      const c10 = d[idx(r0, g1, b0) + c] * (1 - tr) + d[idx(r1, g1, b0) + c] * tr;
      const c01 = d[idx(r0, g0, b1) + c] * (1 - tr) + d[idx(r1, g0, b1) + c] * tr;
      const c11 = d[idx(r0, g1, b1) + c] * (1 - tr) + d[idx(r1, g1, b1) + c] * tr;
      out[c] = clamp01((c00 * (1 - tg) + c10 * tg) * (1 - tb) + (c01 * (1 - tg) + c11 * tg) * tb);
    }
    return out;
  }

  function transformRgb(rIn, gIn, bIn) {
    const preset = LUT_PRESETS.find(p => p.id === state.presetId);
    const intensity = Math.max(0, Math.min(1.5, (state.adjust.intensity || 100) / 100));
    let r = rIn, g = gIn, b = bIn;

    if (state.customCube) {
      [r, g, b] = sampleCustomCube(state.customCube, rIn, gIn, bIn);
    } else if (preset && preset.fn) {
      [r, g, b] = preset.fn(rIn, gIn, bIn);
    }

    r = clamp01(rIn + (r - rIn) * intensity);
    g = clamp01(gIn + (g - gIn) * intensity);
    b = clamp01(bIn + (b - bIn) * intensity);

    const expMul = Math.pow(2, (state.adjust.exposure || 0) * 0.55);
    const con = 1 + (state.adjust.contrast || 0) / 140;
    const temp = (state.adjust.temperature || 0) / 320;
    const sat = Math.max(0, (state.adjust.saturation ?? 100) / 100);
    const fade = Math.max(0, (state.adjust.fade || 0) / 400);

    r = clamp01(((r * expMul - 0.5) * con + 0.5) + temp);
    g = clamp01(((g * expMul - 0.5) * con + 0.5));
    b = clamp01(((b * expMul - 0.5) * con + 0.5) - temp);

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = clamp01(luma + (r - luma) * sat + fade);
    g = clamp01(luma + (g - luma) * sat + fade);
    b = clamp01(luma + (b - luma) * sat + fade);
    return [r, g, b];
  }

  function buildSampleStudioImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');

    // Scenic sunset + moody teal skyline + warm highlights so LUTs visibly pop
    const sky = ctx.createLinearGradient(0, 0, 960, 540);
    sky.addColorStop(0, '#1e3a5f');
    sky.addColorStop(0.5, '#64748b');
    sky.addColorStop(0.8, '#d97706');
    sky.addColorStop(1, '#1e293b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 540);

    // Sun glow
    const sun = ctx.createRadialGradient(700, 180, 12, 700, 180, 260);
    sun.addColorStop(0, '#fef3c7');
    sun.addColorStop(0.3, 'rgba(251, 146, 60, 0.75)');
    sun.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, 960, 540);

    // Silhouetted mountain & foreground depth
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(0, 540); ctx.lineTo(0, 380); ctx.lineTo(220, 290); ctx.lineTo(430, 390);
    ctx.lineTo(660, 270); ctx.lineTo(960, 365); ctx.lineTo(960, 540);
    ctx.closePath();
    ctx.fill();

    // Color skin-tone & foliage test patches on subtle studio subject card
    const skin = ctx.createRadialGradient(340, 265, 10, 340, 265, 125);
    skin.addColorStop(0, '#f3c6a5');
    skin.addColorStop(0.65, '#c68b67');
    skin.addColorStop(1, '#5b3727');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(340, 265, 110, 0, Math.PI * 2);
    ctx.fill();

    // Accent neon rim & foliage tones
    const ring = ctx.createLinearGradient(220, 160, 460, 380);
    ring.addColorStop(0, '#22d3ee');
    ring.addColorStop(1, '#f97316');
    ctx.strokeStyle = ring;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(340, 265, 124, 0, Math.PI * 2);
    ctx.stroke();

    // Subtle foliage & sky swatches along bottom edge for color-check accuracy
    const swatches = ['#0f766e', '#10b981', '#f59e0b', '#e11d48', '#6366f1', '#f8fafc'];
    swatches.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(42 + i * 38, 470, 28, 28);
    });

    state.sourceImg = canvas;
    processAndRender();
  }

  function processAndRender() {
    const previewCanvas = document.getElementById('lut-preview-canvas');
    if (!previewCanvas || !state.sourceImg) return;

    const srcW = state.sourceImg.width || 960;
    const srcH = state.sourceImg.height || 540;
    const maxW = 960;
    const scale = Math.min(1, maxW / srcW);
    const w = Math.max(160, Math.round(srcW * scale));
    const h = Math.max(90, Math.round(srcH * scale));

    if (previewCanvas.width !== w) previewCanvas.width = w;
    if (previewCanvas.height !== h) previewCanvas.height = h;

    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tCtx = tmp.getContext('2d', { willReadFrequently: true });
    tCtx.drawImage(state.sourceImg, 0, 0, w, h);
    const srcImgData = tCtx.getImageData(0, 0, w, h);
    const outImgData = new ImageData(new Uint8ClampedArray(srcImgData.data), w, h);

    const sd = srcImgData.data, od = outImgData.data;
    for (let i = 0; i < sd.length; i += 4) {
      const [rr, gg, bb] = transformRgb(sd[i] / 255, sd[i + 1] / 255, sd[i + 2] / 255);
      od[i] = Math.round(rr * 255);
      od[i + 1] = Math.round(gg * 255);
      od[i + 2] = Math.round(bb * 255);
    }

    state.sourceData = srcImgData;
    state.gradedData = outImgData;
    drawComparison();
  }

  function drawComparison() {
    const previewCanvas = document.getElementById('lut-preview-canvas');
    if (!previewCanvas || !state.sourceData || !state.gradedData) return;
    const ctx = previewCanvas.getContext('2d');
    const w = previewCanvas.width, h = previewCanvas.height;
    const splitX = Math.round(w * clamp01(state.splitRatio));

    // Left/Base: graded full frame, then clip Original on left of split line (Before | After)
    ctx.putImageData(state.gradedData, 0, 0);

    if (splitX > 0) {
      const origCanvas = document.createElement('canvas');
      origCanvas.width = w; origCanvas.height = h;
      origCanvas.getContext('2d').putImageData(state.sourceData, 0, 0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, h);
      ctx.clip();
      ctx.drawImage(origCanvas, 0, 0);
      ctx.restore();
    }

    // Divider line & Before / After pills
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, h);
    ctx.stroke();

    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(splitX, h / 2, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⇄', splitX, h / 2 + 1);
    ctx.restore();
  }

  function renderPresetCards() {
    const grid = document.getElementById('lut-presets-grid');
    if (!grid) return;
    const filtered = state.filterCategory === 'all'
      ? LUT_PRESETS
      : LUT_PRESETS.filter(p => p.category === state.filterCategory);

    grid.innerHTML = filtered.map(p => {
      const active = !state.customCube && state.presetId === p.id;
      return `
        <button type="button" onclick="MickeyLutStudio.selectPreset('${p.id}')" class="text-right p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${active ? 'border-indigo-400 bg-indigo-500/15 shadow-lg shadow-indigo-500/10' : 'border-white/10 bg-zinc-900/60 hover:bg-zinc-800/70 hover:border-white/20'}">
          <div class="flex items-center justify-between gap-2 w-full">
            <div class="flex items-center gap-2">
              <span class="w-5 h-5 rounded-full border border-white/20 shrink-0" style="background: linear-gradient(135deg, ${p.swatch[0]}, ${p.swatch[1]});"></span>
              <span class="text-xs font-bold text-white">${p.name}</span>
            </div>
            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/10">${p.badge}</span>
          </div>
          <p class="text-[11px] text-zinc-400 leading-relaxed">${p.desc}</p>
        </button>
      `;
    }).join('');
  }

  function selectPreset(id) {
    state.presetId = id;
    state.customCube = null;
    const badge = document.getElementById('lut-active-badge');
    const found = LUT_PRESETS.find(p => p.id === id);
    if (badge && found) badge.textContent = found.name;
    renderPresetCards();
    processAndRender();
  }

  function setCategory(cat) {
    state.filterCategory = cat || 'all';
    document.querySelectorAll('.lut-cat-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === state.filterCategory);
    });
    renderPresetCards();
  }

  function updateAdjust(key, val) {
    state.adjust[key] = Number(val) || 0;
    const lbl = document.getElementById(`lut-val-${key}`);
    if (lbl) lbl.textContent = key === 'intensity' || key === 'saturation' ? `${Math.round(state.adjust[key])}%` : String(state.adjust[key]);
    processAndRender();
  }

  function resetAdjustments() {
    state.adjust = { intensity: 100, exposure: 0, contrast: 0, temperature: 0, saturation: 100, fade: 0 };
    ['intensity', 'exposure', 'contrast', 'temperature', 'saturation', 'fade'].forEach(k => {
      const inp = document.getElementById(`lut-range-${k}`);
      if (inp) inp.value = state.adjust[k];
      const lbl = document.getElementById(`lut-val-${k}`);
      if (lbl) lbl.textContent = (k === 'intensity' || k === 'saturation') ? `${state.adjust[k]}%` : String(state.adjust[k]);
    });
    processAndRender();
  }

  function downloadCube() {
    const N = 33;
    const inv = 1 / (N - 1);
    const activeName = state.customCube?.name?.replace(/\.cube$/i, '') || (LUT_PRESETS.find(p => p.id === state.presetId)?.id || 'mickey_lut');
    const lines = [
      `TITLE "Mickey Studio - ${activeName}"`,
      `LUT_3D_SIZE ${N}`,
      'DOMAIN_MIN 0.0 0.0 0.0',
      'DOMAIN_MAX 1.0 1.0 1.0'
    ];
    for (let bi = 0; bi < N; bi++) {
      const b = bi * inv;
      for (let gi = 0; gi < N; gi++) {
        const g = gi * inv;
        for (let ri = 0; ri < N; ri++) {
          const [rr, gg, bb] = transformRgb(ri * inv, g, b);
          lines.push(`${rr.toFixed(5)} ${gg.toFixed(5)} ${bb.toFixed(5)}`);
        }
      }
    }
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MickeyStudio_${activeName}_33x.cube`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function downloadGradedImage() {
    if (!state.gradedData) return;
    const c = document.createElement('canvas');
    c.width = state.gradedData.width;
    c.height = state.gradedData.height;
    c.getContext('2d').putImageData(state.gradedData, 0, 0);
    c.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MickeyStudio_Graded_${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/png');
  }

  function init() {
    if (!state.initialized) {
      state.initialized = true;
      renderPresetCards();

      document.getElementById('lut-split-slider')?.addEventListener('input', e => {
        state.splitRatio = (Number(e.target.value) || 50) / 100;
        drawComparison();
      });

      document.getElementById('lut-upload-image')?.addEventListener('change', async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          state.sourceImg = img;
          processAndRender();
          URL.revokeObjectURL(url);
        };
        img.src = url;
      });

      document.getElementById('lut-upload-cube')?.addEventListener('change', async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          state.customCube = parseCubeText(await file.text(), file.name);
          const badge = document.getElementById('lut-active-badge');
          if (badge) badge.textContent = `${file.name} (${state.customCube.size}³)`;
          renderPresetCards();
          processAndRender();
        } catch (err) {
          alert(err?.message || 'تعذر قراءة ملف .cube');
        }
      });

      buildSampleStudioImage();
    } else {
      drawComparison();
    }
  }

  return {
    init,
    selectPreset,
    setCategory,
    updateAdjust,
    resetAdjustments,
    downloadCube,
    downloadGradedImage,
    LUT_PRESETS
  };
})();
