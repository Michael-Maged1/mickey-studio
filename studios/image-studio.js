/**
 * Mickey Studio - Image Studio Module
 * Dynamic Studio Chunk: Photorealistic image generator, style & aspect selector, queue integration.
 */
(function (root) {
  'use strict';

  function updateModelTag(modelName) {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    if (STATE?.image) STATE.image.model = modelName;
    const tag = document.getElementById('current-model-tag');
    if (tag) tag.textContent = modelName.toUpperCase();
    if (SFX?.playClick) SFX.playClick();
  }

  function selectRatio(buttonEl, width, height) {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    if (STATE?.image) {
      STATE.image.width = width;
      STATE.image.height = height;
    }
    document.querySelectorAll('#image-ratio-selector .ratio-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    if (buttonEl) buttonEl.classList.add('active');
    if (SFX?.playClick) SFX.playClick();
  }

  function selectStyle(btnEl, styleKey) {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    if (STATE?.image) STATE.image.selectedStyle = styleKey;
    document.querySelectorAll('#image-style-tags .pill-option').forEach(btn => {
      btn.classList.remove('active');
    });
    if (btnEl) btnEl.classList.add('active');
    if (SFX?.playClick) SFX.playClick();
  }

  function randomizeSeed() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const seed = Math.floor(Math.random() * 999999999);
    if (STATE?.image) STATE.image.seed = seed;
    const input = document.getElementById('image-seed-input');
    if (input) input.value = seed;
    if (SFX?.playClick) SFX.playClick();
  }

  function setBatchCount(btnOrCount, maybeCount) {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    let count = typeof btnOrCount === 'number' ? btnOrCount : (maybeCount || 1);
    let btnEl = (btnOrCount && btnOrCount.nodeType) ? btnOrCount : (window.event && window.event.currentTarget) || null;
    if (STATE?.image) STATE.image.batchCount = count;
    document.querySelectorAll('.batch-count-btn').forEach(btn => {
      btn.classList.remove('active', 'bg-cyan-500/20', 'text-cyan-neon', 'border-cyan-500/40');
      btn.classList.add('bg-white/5', 'text-slate-300', 'border-white/10');
    });
    if (btnEl) {
      btnEl.classList.add('active', 'bg-cyan-500/20', 'text-cyan-neon', 'border-cyan-500/40');
      btnEl.classList.remove('bg-white/5', 'text-slate-300', 'border-white/10');
    }
    if (SFX?.playClick) SFX.playClick();
  }

  async function generateImage() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    const promptInput = document.getElementById('image-prompt-input');
    let prompt = promptInput ? promptInput.value.trim() : '';

    if (!prompt) {
      if (showToast) showToast('يرجى إدخال وصف للصورة المراد توليدها!', 'warning');
      if (promptInput) promptInput.focus();
      return;
    }

    if (window.MickeyStudio.authorizeAndConsume) {
      if (!await window.MickeyStudio.authorizeAndConsume('image', STATE?.image?.batchCount || 1)) return;
    }

    if (SFX?.playLaser) SFX.playLaser();

    // Register into persistent background job queue
    let activeJob = null;
    if (window.MickeyJobQueue) {
      activeJob = await window.MickeyJobQueue.addJob({
        type: 'image',
        title: `توليد صورة: ${prompt.slice(0, 35)}...`,
        params: { prompt, width: STATE.image.width, height: STATE.image.height, model: STATE.image.model }
      });
    }

    const generateBtn = document.getElementById('btn-generate-image');
    const laserScanner = document.getElementById('image-laser-scanner');
    const emptyState = document.getElementById('image-empty-state');
    const resultGrid = document.getElementById('image-result-grid');
    const actionsBar = document.getElementById('image-actions-bar');
    const statusPill = document.getElementById('image-status-pill');

    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.classList.add('opacity-70');
    }
    if (laserScanner) laserScanner.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (resultGrid) resultGrid.classList.add('hidden');
    if (actionsBar) actionsBar.classList.add('opacity-0', 'pointer-events-none');
    if (statusPill) {
      statusPill.textContent = 'جاري إعداد معايير التصوير والواقعية...';
      statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-cyan-400';
    }

    const seedVal = parseInt(document.getElementById('image-seed-input')?.value) || Math.floor(Math.random() * 9999999);
    if (STATE?.image) {
      STATE.image.seed = seedVal;
      STATE.image.lastPrompt = prompt;
    }

    try {
      if (activeJob && window.MickeyJobQueue) {
        await window.MickeyJobQueue.updateJob(activeJob.id, { progress: 25, progressText: 'تحسين ومعالجة الوصف السينمائي...' });
      }

      const autoBoost = document.getElementById('auto-prompt-boost')?.checked !== false;
      let finalPrompt = prompt;

      if ((autoBoost || /[\u0600-\u06FF]/.test(prompt)) && window.MickeyStudio.craftMasterPhotorealisticPrompt) {
        if (statusPill) statusPill.textContent = 'جاري تحويل الوصف لمعايير كاميرا واقعية احترافية...';
        finalPrompt = await window.MickeyStudio.craftMasterPhotorealisticPrompt(prompt, STATE.image.selectedStyle);
      }
      if (STATE?.image) STATE.image.lastEnhancedPrompt = finalPrompt;

      if (activeJob && window.MickeyJobQueue) {
        await window.MickeyJobQueue.updateJob(activeJob.id, { progress: 55, progressText: 'الاتصال بمحرك التوليد عالي الدقة...' });
      }

      // Route 1: Gemini Nano Banana 2.1
      if (STATE.image.model === 'nano-banana' && window.MickeyStudio.gatewayFetch) {
        if (statusPill) statusPill.textContent = 'جاري التوليد عبر Google Nano Banana 2.1 (2K)...';
        const aspectRatioStr = STATE.image.width > STATE.image.height ? '16:9' : STATE.image.height > STATE.image.width ? '9:16' : '1:1';
        const res = await window.MickeyStudio.gatewayFetch('generate_image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: finalPrompt, aspectRatio: aspectRatioStr })
        });
        const data = await res.json().catch(() => ({}));
        if (data?.quota?.tool && window.MickeyStudio.updateQuotaBadge) window.MickeyStudio.updateQuotaBadge(data.quota.tool, data.quota.remaining, data.quota.limit);
        if (res.status === 429 && window.MickeyStudio.updateQuotaBadge) window.MickeyStudio.updateQuotaBadge('images', 0);
        if (!res.ok || !data.success || !data.image_base64) throw new Error(data.error || 'تعذر التوليد عبر Google Nano Banana 2.1.');
        
        const b64 = data.image_base64;
        const mime = data.mime_type || 'image/jpeg';
        const blob = window.MickeyStudio.base64ToBlob ? window.MickeyStudio.base64ToBlob(b64, mime) : null;
        const dataUrl = `data:${mime};base64,${b64}`;
        STATE.image.lastGeneratedBlob = blob;
        STATE.image.lastGeneratedUrl = dataUrl;

        renderSingleResult(dataUrl, prompt, resultGrid, laserScanner, actionsBar, statusPill, 'Google Nano Banana 2.1');
        if (activeJob && window.MickeyJobQueue) {
          await window.MickeyJobQueue.updateJob(activeJob.id, { status: 'completed', progress: 100, progressText: 'تم التوليد بنجاح', resultUrl: dataUrl });
        }
        if (SFX?.playSuccess) SFX.playSuccess();
        if (showToast) showToast('تم توليد الصورة عبر Google Nano Banana بنجاح!', 'success');
        return;
      }

      // Route 4: FLUX Photorealistic (Default)
      if (statusPill) statusPill.textContent = 'جاري التوليد الفوتوغرافي الفائق عبر FLUX...';
      const cleanPrompt = finalPrompt.replace(/\//g, ' ');
      const encodedPrompt = encodeURIComponent(cleanPrompt);
      const count = STATE.image.batchCount || 1;
      const loadedItems = [];

      for (let i = 0; i < count; i++) {
        const currentSeed = seedVal + i;
        const candidates = [
          `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${STATE.image.width}&height=${STATE.image.height}&seed=${currentSeed}&model=flux&nologo=true`,
          `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${STATE.image.width}&height=${STATE.image.height}&seed=${currentSeed}&nologo=true`
        ];

        let itemBlob = null;
        let itemUrl = null;

        for (const candidateUrl of candidates) {
          try {
            const resp = await fetch(candidateUrl);
            if (resp.ok) {
              const b = await resp.blob();
              if (b && b.size > 1000 && b.type.startsWith('image/')) {
                itemBlob = b;
                itemUrl = URL.createObjectURL(b);
                break;
              }
            }
          } catch (e) {}
        }

        if (!itemBlob || !itemUrl) {
          const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${STATE.image.width}&height=${STATE.image.height}&seed=${currentSeed}&model=flux&nologo=true`;
          await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              itemUrl = fallbackUrl;
              resolve();
            };
            img.onerror = () => reject(new Error('خدمة التوليد مشغولة حالياً أو واجهت ضغطاً مؤقتاً. أعد المحاولة بعد ثوانٍ.'));
            img.src = fallbackUrl;
          });
        }

        loadedItems.push({ blob: itemBlob, url: itemUrl });
      }

      // Render images
      resultGrid.innerHTML = '';
      if (count === 1) {
        renderSingleResult(loadedItems[0].url, prompt, resultGrid, laserScanner, actionsBar, statusPill, 'FLUX.1 Ultra');
      } else {
        resultGrid.className = 'w-full grid grid-cols-1 sm:grid-cols-2 gap-3 p-2';
        loadedItems.forEach(({ url }, idx) => {
          const card = document.createElement('div');
          card.className = 'relative rounded-xl overflow-hidden group cursor-pointer border border-white/10 hover:border-white/30 transition-all';
          card.innerHTML = `
            <img src="${url}" alt="Variation ${idx + 1}" loading="lazy" class="w-full h-48 object-cover">
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button onclick="MickeyStudio.openLightbox('${url}')" class="p-2 rounded-lg bg-white text-black text-xs font-bold" aria-label="تكبير الصورة">
                <i class="fa-solid fa-expand"></i>
              </button>
            </div>
          `;
          resultGrid.appendChild(card);
        });
        if (laserScanner) laserScanner.classList.add('hidden');
        if (resultGrid) resultGrid.classList.remove('hidden');
        if (actionsBar) actionsBar.classList.remove('opacity-0', 'pointer-events-none');
        if (statusPill) {
          statusPill.textContent = 'اكتمل التوليد الواقعي (FLUX.1 Ultra)';
          statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-emerald-500/30 text-emerald-300';
        }
      }

      STATE.image.lastGeneratedUrl = loadedItems[0].url;
      STATE.image.lastGeneratedBlob = loadedItems[0].blob;

      if (activeJob && window.MickeyJobQueue) {
        await window.MickeyJobQueue.updateJob(activeJob.id, {
          status: 'completed',
          progress: 100,
          progressText: 'تم التوليد بنجاح',
          resultUrl: loadedItems[0].url
        });
      }

      if (SFX?.playSuccess) SFX.playSuccess();
      if (showToast) showToast('تم إنتاج الصورة بجودة واقعية مذهلة!', 'success');

    } catch (err) {
      console.error(err);
      if (activeJob && window.MickeyJobQueue) {
        await window.MickeyJobQueue.updateJob(activeJob.id, {
          status: 'failed',
          progress: 0,
          progressText: 'فشل التوليد',
          error: err.message
        });
      }
      if (laserScanner) laserScanner.classList.add('hidden');
      if (emptyState) emptyState.classList.remove('hidden');
      if (statusPill) {
        statusPill.textContent = 'خطأ في التوليد';
        statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-red-400';
      }
      if (showToast) showToast(err.message || 'حدث خطأ أثناء التوليد، يرجى المحاولة ثانية', 'error');
    } finally {
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.classList.remove('opacity-70');
      }
    }
  }

  function renderSingleResult(url, prompt, resultGrid, laserScanner, actionsBar, statusPill, modelTitle) {
    if (!resultGrid) return;
    resultGrid.innerHTML = '';
    resultGrid.className = 'w-full h-full flex items-center justify-center p-2';
    const imgEl = document.createElement('img');
    imgEl.src = url;
    imgEl.alt = prompt;
    imgEl.className = 'max-h-[500px] w-auto rounded-xl object-contain shadow-2xl transition-all cursor-pointer hover:scale-[1.01]';
    imgEl.onclick = () => window.MickeyStudio.openLightbox ? window.MickeyStudio.openLightbox(imgEl.src) : null;
    resultGrid.appendChild(imgEl);

    if (laserScanner) laserScanner.classList.add('hidden');
    resultGrid.classList.remove('hidden');
    if (actionsBar) actionsBar.classList.remove('opacity-0', 'pointer-events-none');
    if (statusPill) {
      statusPill.textContent = `اكتمل التوليد (${modelTitle})`;
      statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-emerald-500/30 text-emerald-400';
    }
  }

  function downloadCurrentImage() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    if (!STATE?.image?.lastGeneratedBlob && !STATE?.image?.lastGeneratedUrl) return;
    if (SFX?.playClick) SFX.playClick();
    if (STATE.image.lastGeneratedBlob && window.MickeyStudio.downloadBlob) {
      window.MickeyStudio.downloadBlob(STATE.image.lastGeneratedBlob, `mickey_studio_${Date.now()}.png`);
    } else {
      window.open(STATE.image.lastGeneratedUrl, '_blank');
    }
    if (showToast) showToast('جاري تحميل الصورة بدقة PNG الأصلية...', 'info');
  }

  function transferToVideoStudio() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    if (!STATE?.image?.lastGeneratedUrl) {
      if (showToast) showToast('يرجى توليد صورة أولاً لنقلها إلى استوديو الفيديو!', 'warning');
      return;
    }
    if (SFX?.playClick) SFX.playClick();
    window.MickeyStudio.switchTab('video-studio');
    if (window.MickeyStudio.useLastGeneratedImageForVideo) {
      window.MickeyStudio.useLastGeneratedImageForVideo();
    }
    if (showToast) showToast('تم نقل الصورة إلى استوديو الفيديو السينمائي بنجاح!', 'success');
  }

  function transferToPhotoLab() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    if (!STATE?.image?.lastGeneratedUrl) {
      if (showToast) showToast('يرجى توليد صورة أولاً لنقلها إلى مختبر التعديل!', 'warning');
      return;
    }
    if (SFX?.playClick) SFX.playClick();
    window.MickeyStudio.switchTab('photo-lab');
    if (window.MickeyStudio.useLastImageForPhotoLab) {
      window.MickeyStudio.useLastImageForPhotoLab();
    }
    if (showToast) showToast('تم تحميل الصورة في مختبر التعديل وتكبير الجودة!', 'success');
  }

  // Example Prompt Inserter
  function insertExamplePrompt(text) {
    const input = document.getElementById('image-prompt-input');
    if (input) {
      input.value = text;
      input.focus();
      if (window.MickeyStudio.SFX?.playClick) window.MickeyStudio.SFX.playClick();
      if (window.MickeyStudio.showToast) window.MickeyStudio.showToast('تم إدراج النموذج في صندوق الوصف ✨', 'info');
    }
  }

  const exports = {
    updateModelTag,
    selectRatio,
    selectStyle,
    randomizeSeed,
    setBatchCount,
    generateImage,
    downloadCurrentImage,
    transferToVideoStudio,
    transferToPhotoLab,
    insertExamplePrompt
  };

  if (typeof window.MickeyStudio !== 'undefined') {
    Object.assign(window.MickeyStudio, exports);
  }

  root.ImageStudio = exports;

})(typeof window !== 'undefined' ? window : this);
