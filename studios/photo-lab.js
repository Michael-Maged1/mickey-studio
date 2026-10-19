/**
 * Mickey Studio - Photo Lab Studio Module
 * Dynamic Studio Chunk: BiRefNet Background Remover, Real-ESRGAN 4K Upscaler, Interactive Compare Slider, and Queue Integration.
 */
(function (root) {
  'use strict';

  function setPhotoLabTab(tabKey) {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    if (STATE?.photoLab) STATE.photoLab.subTab = tabKey;
    const btnBg = document.getElementById('btn-subtab-bg-remover');
    const btnUp = document.getElementById('btn-subtab-upscaler');
    const viewBg = document.getElementById('photolab-view-bg-remover');
    const viewUp = document.getElementById('photolab-view-upscaler');

    if (tabKey === 'bg-remover') {
      if (btnBg) btnBg.className = 'px-3.5 py-2 text-xs font-bold rounded-lg bg-pink-neon text-white shadow-[0_0_15px_rgba(255,0,122,0.4)]';
      if (btnUp) btnUp.className = 'px-3.5 py-2 text-xs font-bold rounded-lg text-slate-300 hover:text-white';
      if (viewBg) viewBg.classList.remove('hidden');
      if (viewUp) viewUp.classList.add('hidden');
    } else {
      if (btnUp) btnUp.className = 'px-3.5 py-2 text-xs font-bold rounded-lg bg-cyan-neon text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]';
      if (btnBg) btnBg.className = 'px-3.5 py-2 text-xs font-bold rounded-lg text-slate-300 hover:text-white';
      if (viewUp) viewUp.classList.remove('hidden');
      if (viewBg) viewBg.classList.add('hidden');
    }
    if (SFX?.playClick) SFX.playClick();
  }

  function useLastImageForPhotoLab() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    if (!STATE?.image?.lastGeneratedUrl) {
      if (showToast) showToast('لا توجد صورة سابقة للاستخدام!', 'warning');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (STATE.photoLab.subTab === 'bg-remover') {
        STATE.photoLab.bgSourceImage = img;
        STATE.photoLab.bgSourceFile = STATE.image.lastGeneratedBlob ? new File([STATE.image.lastGeneratedBlob], 'generated-image.png', { type: STATE.image.lastGeneratedBlob.type || 'image/png' }) : null;
        const uploadImg = document.getElementById('bg-upload-img');
        const uploadPreview = document.getElementById('bg-upload-preview');
        const uploadEmpty = document.getElementById('bg-upload-empty');
        if (uploadImg) uploadImg.src = STATE.image.lastGeneratedUrl;
        if (uploadPreview) uploadPreview.classList.remove('hidden');
        if (uploadEmpty) uploadEmpty.classList.add('hidden');
      } else {
        STATE.photoLab.upscaleSourceImage = img;
        STATE.photoLab.upscaleSourceFile = STATE.image.lastGeneratedBlob ? new File([STATE.image.lastGeneratedBlob], 'generated-image.png', { type: STATE.image.lastGeneratedBlob.type || 'image/png' }) : null;
        const uploadImg = document.getElementById('upscale-upload-img');
        const uploadPreview = document.getElementById('upscale-upload-preview');
        const uploadEmpty = document.getElementById('upscale-upload-empty');
        if (uploadImg) uploadImg.src = STATE.image.lastGeneratedUrl;
        if (uploadPreview) uploadPreview.classList.remove('hidden');
        if (uploadEmpty) uploadEmpty.classList.add('hidden');
      }
      if (SFX?.playClick) SFX.playClick();
      if (showToast) showToast('تم تحميل الصورة بنجاح!', 'success');
    };
    img.src = STATE.image.lastGeneratedUrl;
  }

  function handleBgImageUpload(input) {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        STATE.photoLab.bgSourceImage = img;
        STATE.photoLab.bgSourceFile = file;
        const uploadImg = document.getElementById('bg-upload-img');
        const uploadPreview = document.getElementById('bg-upload-preview');
        const uploadEmpty = document.getElementById('bg-upload-empty');
        if (uploadImg) uploadImg.src = e.target.result;
        if (uploadPreview) uploadPreview.classList.remove('hidden');
        if (uploadEmpty) uploadEmpty.classList.add('hidden');
        if (SFX?.playSuccess) SFX.playSuccess();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function photoLabGradioFile(sourceImage, savedFile, name) {
    if (savedFile) return savedFile;
    const response = await fetch(sourceImage.src);
    if (!response.ok) throw new Error('تعذر قراءة ملف الصورة لإرساله إلى خدمة المعالجة.');
    const blob = await response.blob();
    return new File([blob], name, { type: blob.type || 'image/png' });
  }

  function findGradioFile(value) {
    if (!value) return null;
    if (Array.isArray(value)) {
      for (const item of value) { const found = findGradioFile(item); if (found) return found; }
    } else if (typeof value === 'object') {
      if (value.url || value.path) return value.url || value.path;
      for (const child of Object.values(value)) { const found = findGradioFile(child); if (found) return found; }
    } else if (typeof value === 'string' && /^(https?:|blob:|data:|\/)/i.test(value)) return value;
    return null;
  }

  async function gradioOutputBlob(value) {
    const url = findGradioFile(value);
    if (!url) throw new Error('لم تُرجع خدمة الذكاء الاصطناعي ملف صورة صالحًا.');
    const response = await fetch(url);
    if (!response.ok) throw new Error('تعذر تحميل نتيجة المعالجة من Hugging Face.');
    return response.blob();
  }

  async function hasTransparentPixels(blob) {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(256, bitmap.width);
    canvas.height = Math.min(256, bitmap.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 250) return true;
    }
    return false;
  }

  async function removeBackground() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    if (!STATE?.photoLab?.bgSourceImage) {
      if (showToast) showToast('يرجى اختيار صورة أولاً لإزالة خلفيتها!', 'warning');
      return;
    }
    if (window.MickeyStudio.authorizeAndConsume) {
      if (!await window.MickeyStudio.authorizeAndConsume('background_removal')) return;
    }

    if (SFX?.playLaser) SFX.playLaser();
    const scanner = document.getElementById('bg-laser-scanner');
    const emptyState = document.getElementById('bg-result-empty');
    const canvas = document.getElementById('bg-canvas-result');
    const actionsBar = document.getElementById('bg-actions-bar');
    const statusPill = document.getElementById('bg-process-status');

    if (scanner) scanner.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (canvas) canvas.classList.add('hidden');
    if (actionsBar) actionsBar.classList.add('opacity-0', 'pointer-events-none');
    if (statusPill) statusPill.textContent = 'جاري عزل العناصر...';

    let activeJob = null;
    if (window.MickeyJobQueue) {
      activeJob = await window.MickeyJobQueue.addJob({
        type: 'bg_remove',
        title: 'عزل خلفية الصورة (PNG شفاف)',
        params: {}
      });
    }

    const sourceImg = STATE.photoLab.bgSourceImage;
    try {
      if (statusPill) statusPill.textContent = 'جاري الاتصال بنموذج إزالة الخلفية...';
      const { Client, handle_file } = await import('https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js');
      const client = await Client.connect('ZhengPeng7/BiRefNet_demo');
      const file = await photoLabGradioFile(sourceImg, STATE.photoLab.bgSourceFile, 'photo.png');
      const result = await client.predict('/image', [await handle_file(file), '1024x1024', 'General']);
      const sliderImages = result?.data?.[0];
      const candidates = Array.isArray(sliderImages) ? [...sliderImages].reverse() : [sliderImages];
      let processedBlob = null;
      for (const candidate of candidates) {
        if (!candidate) continue;
        const outputBlob = await gradioOutputBlob(candidate);
        if (await hasTransparentPixels(outputBlob)) {
          processedBlob = outputBlob;
          break;
        }
      }
      if (!processedBlob) throw new Error('لم يُرجع نموذج إزالة الخلفية صورة شفافة. أعد المحاولة أو استخدم صورة أوضح.');
      const cutoutImg = new Image();
      cutoutImg.src = URL.createObjectURL(processedBlob);
      await new Promise((resolve, reject) => { cutoutImg.onload = resolve; cutoutImg.onerror = reject; });
      const W = sourceImg.naturalWidth || sourceImg.width;
      const H = sourceImg.naturalHeight || sourceImg.height;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(cutoutImg, 0, 0, W, H);
      STATE.photoLab.bgResultBlob = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('تعذر تجهيز ملف PNG.')), 'image/png'));

      if (scanner) scanner.classList.add('hidden');
      if (canvas) canvas.classList.remove('hidden');
      if (actionsBar) actionsBar.classList.remove('opacity-0', 'pointer-events-none');
      if (statusPill) statusPill.textContent = 'تم العزل بنجاح ✓';

      const resultUrl = URL.createObjectURL(STATE.photoLab.bgResultBlob);
      if (activeJob && window.MickeyJobQueue) {
        await window.MickeyJobQueue.updateJob(activeJob.id, {
          status: 'completed',
          progress: 100,
          progressText: 'اكتمل عزل الخلفية',
          resultUrl
        });
      }

      if (SFX?.playSuccess) SFX.playSuccess();
      if (showToast) showToast('تمت إزالة الخلفية وحفظ العنصر بصيغة PNG شفافة.', 'success');

    } catch (err) {
      console.error(err);
      if (scanner) scanner.classList.add('hidden');
      if (emptyState) emptyState.classList.remove('hidden');
      if (statusPill) statusPill.textContent = 'تعذرت المعالجة';
      if (activeJob && window.MickeyJobQueue) {
        await window.MickeyJobQueue.updateJob(activeJob.id, {
          status: 'failed',
          progress: 0,
          progressText: 'فشل العزل',
          error: err.message
        });
      }
      const errFn = window.MickeyStudio.huggingFaceErrorMessage || (e => e.message);
      if (showToast) showToast(errFn(err, 'تعذرت خدمة إزالة الخلفية. أعد المحاولة لاحقًا.'), 'error');
    }
  }

  function downloadBgResult() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    if (!STATE?.photoLab?.bgResultBlob) return;
    if (SFX?.playClick) SFX.playClick();
    if (window.MickeyStudio.downloadBlob) {
      window.MickeyStudio.downloadBlob(STATE.photoLab.bgResultBlob, `mickey_cutout_${Date.now()}.png`);
    }
    if (showToast) showToast('جاري تحميل الصورة المفرغة بدقة أصلية...', 'info');
  }

  function handleUpscaleImageUpload(input) {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        STATE.photoLab.upscaleSourceImage = img;
        STATE.photoLab.upscaleSourceFile = file;
        const uploadImg = document.getElementById('upscale-upload-img');
        const uploadPreview = document.getElementById('upscale-upload-preview');
        const uploadEmpty = document.getElementById('upscale-upload-empty');
        if (uploadImg) uploadImg.src = e.target.result;
        if (uploadPreview) uploadPreview.classList.remove('hidden');
        if (uploadEmpty) uploadEmpty.classList.add('hidden');
        if (SFX?.playSuccess) SFX.playSuccess();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function setUpscaleMultiplier(btnOrMul, maybeMul) {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    let mul = typeof btnOrMul === 'number' ? btnOrMul : (maybeMul || 2);
    let btnEl = (btnOrMul && btnOrMul.nodeType) ? btnOrMul : (window.event && window.event.currentTarget) || null;
    if (STATE?.photoLab) STATE.photoLab.upscaleMultiplier = mul;
    document.querySelectorAll('#upscale-multipliers .upscale-mul-btn').forEach(b => {
      b.classList.remove('active', 'border-cyan-500/40', 'text-cyan-neon');
      b.classList.add('border-white/10', 'text-slate-300');
    });
    if (btnEl) {
      btnEl.classList.add('active', 'border-cyan-500/40', 'text-cyan-neon');
      btnEl.classList.remove('border-white/10', 'text-slate-300');
    }
    if (SFX?.playClick) SFX.playClick();
  }

  async function processUpscale() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    if (!STATE?.photoLab?.upscaleSourceImage) {
      if (showToast) showToast('يرجى اختيار صورة أولاً لتحسين جودتها!', 'warning');
      return;
    }
    if (window.MickeyStudio.authorizeAndConsume) {
      if (!await window.MickeyStudio.authorizeAndConsume('upscale')) return;
    }

    if (SFX?.playLaser) SFX.playLaser();
    const scanner = document.getElementById('upscale-laser-scanner');
    const emptyState = document.getElementById('upscale-empty-state');
    const compareBox = document.getElementById('active-compare-container');
    const actionsBar = document.getElementById('upscale-actions-bar');
    const statusPill = document.getElementById('upscale-process-status');

    if (scanner) scanner.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (compareBox) compareBox.classList.add('hidden');
    if (actionsBar) actionsBar.classList.add('opacity-0', 'pointer-events-none');
    if (statusPill) statusPill.textContent = 'جاري تحسين التفاصيل بنموذج Real-ESRGAN...';

    let activeJob = null;
    if (window.MickeyJobQueue) {
      activeJob = await window.MickeyJobQueue.addJob({
        type: 'upscale',
        title: `تكبير وتحسين الصورة ${STATE.photoLab.upscaleMultiplier}X`,
        params: { multiplier: STATE.photoLab.upscaleMultiplier }
      });
    }

    const src = STATE.photoLab.upscaleSourceImage;
    const mul = STATE.photoLab.upscaleMultiplier || 2;
    try {
      const { Client, handle_file } = await import('https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js');
      const client = await Client.connect('guetLzy/Real-ESRGAN-Demo');
      const file = await photoLabGradioFile(src, STATE.photoLab.upscaleSourceFile, 'photo.png');
      const result = await client.predict('/enhance', [await handle_file(file), 'RealESRGAN_x4plus', mul, false]);
      const outputBlob = await gradioOutputBlob(result?.data?.[0]);
      STATE.photoLab.upscaleResultBlob = outputBlob;
      const originalImg = document.getElementById('img-compare-original');
      const upscaledImg = document.getElementById('img-compare-upscaled');
      if (originalImg) originalImg.src = src.src;
      if (upscaledImg) {
        upscaledImg.src = URL.createObjectURL(outputBlob);
        await new Promise((resolve, reject) => { upscaledImg.onload = resolve; upscaledImg.onerror = reject; });
      }
      initCompareSlider();
      if (scanner) scanner.classList.add('hidden');
      if (compareBox) compareBox.classList.remove('hidden');
      if (actionsBar) actionsBar.classList.remove('opacity-0', 'pointer-events-none');
      if (statusPill) statusPill.textContent = `اكتمل تحسين الصورة ${mul}X ✓`;

      const resultUrl = URL.createObjectURL(outputBlob);
      if (activeJob && window.MickeyJobQueue) {
        await window.MickeyJobQueue.updateJob(activeJob.id, {
          status: 'completed',
          progress: 100,
          progressText: 'اكتمل التحسين بنجاح',
          resultUrl
        });
      }

      if (SFX?.playSuccess) SFX.playSuccess();
      if (showToast) showToast(`اكتمل التحسين بالذكاء الاصطناعي: ${upscaledImg.naturalWidth}×${upscaledImg.naturalHeight}`, 'success');
    } catch (err) {
      console.error(err);
      if (scanner) scanner.classList.add('hidden');
      if (emptyState) emptyState.classList.remove('hidden');
      if (statusPill) statusPill.textContent = 'تعذرت المعالجة';
      if (activeJob && window.MickeyJobQueue) {
        await window.MickeyJobQueue.updateJob(activeJob.id, {
          status: 'failed',
          progress: 0,
          progressText: 'فشل التحسين',
          error: err.message
        });
      }
      const errFn = window.MickeyStudio.huggingFaceErrorMessage || (e => e.message);
      if (showToast) showToast(errFn(err, 'تعذرت خدمة التكبير. أعد المحاولة لاحقًا.'), 'error');
    }
  }

  function initCompareSlider() {
    const container = document.getElementById('active-compare-container');
    const wrapper = document.getElementById('wrapper-compare-upscaled');
    const handle = document.getElementById('handle-compare-slider');
    if (!container || !wrapper || !handle) return;

    let isDragging = false;
    function moveDivider(x) {
      const rect = container.getBoundingClientRect();
      let percent = ((x - rect.left) / rect.width) * 100;
      percent = Math.max(0, Math.min(100, percent));
      wrapper.style.width = percent + '%';
      handle.style.left = percent + '%';
    }

    container.onmousedown = (e) => { isDragging = true; moveDivider(e.clientX); };
    window.onmousemove = (e) => { if (isDragging) moveDivider(e.clientX); };
    window.onmouseup = () => { isDragging = false; };

    container.ontouchstart = (e) => { isDragging = true; moveDivider(e.touches[0].clientX); };
    window.ontouchmove = (e) => { if (isDragging) moveDivider(e.touches[0].clientX); };
    window.ontouchend = () => { isDragging = false; };
  }

  function downloadUpscaledResult() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    if (!STATE?.photoLab?.upscaleResultBlob) return;
    if (SFX?.playClick) SFX.playClick();
    if (window.MickeyStudio.downloadBlob) {
      window.MickeyStudio.downloadBlob(STATE.photoLab.upscaleResultBlob, `mickey_upscale_${Date.now()}.png`);
    }
    if (showToast) showToast('جاري تحميل الصورة المحسّنة...', 'info');
  }

  function setBgMode(buttonEl, mode) {
    const STATE = window.MickeyStudio?.STATE;
    const SFX = window.MickeyStudio?.SFX;
    if (STATE?.photoLab) STATE.photoLab.bgMode = mode;
    document.querySelectorAll('#bg-replace-options .bg-mode-btn').forEach(btn => btn.classList.remove('active'));
    if (buttonEl) buttonEl.classList.add('active');
    if (SFX?.playClick) SFX.playClick();
  }

  const exports = {
    setPhotoLabTab,
    useLastImageForPhotoLab,
    handleBgImageUpload,
    removeBackground,
    downloadBgResult,
    handleUpscaleImageUpload,
    setUpscaleMultiplier,
    processUpscale,
    initCompareSlider,
    downloadUpscaledResult,
    setBgMode
  };

  if (typeof window.MickeyStudio !== 'undefined') {
    Object.assign(window.MickeyStudio, exports);
  }

  root.PhotoLabStudio = exports;

})(typeof window !== 'undefined' ? window : this);
