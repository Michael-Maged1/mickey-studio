/**
 * Mickey Studio - Vault Gallery Studio Module
 * Features: WebP thumbnail generation, lazy loading, virtualized infinite scrolling for large asset histories.
 */
(function (root) {
  'use strict';

  const PAGE_SIZE = 24;
  let currentFilteredList = [];
  let currentlyRenderedCount = 0;
  let scrollObserver = null;

  // WebP Thumbnail Generator via Offscreen Canvas
  async function generateWebPThumbnail(sourceUrl, maxDim = 320) {
    if (!sourceUrl || typeof sourceUrl !== 'string') return sourceUrl;
    if (sourceUrl.startsWith('data:image/webp')) return sourceUrl;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (w > h) {
            if (w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            }
          } else {
            if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const webp = canvas.toDataURL('image/webp', 0.82);
          resolve(webp.startsWith('data:image/webp') ? webp : sourceUrl);
        } catch (_) {
          resolve(sourceUrl);
        }
      };
      img.onerror = () => resolve(sourceUrl);
      img.src = sourceUrl;
    });
  }

  function createAssetCard(item) {
    const card = document.createElement('div');
    card.className = 'studio-card p-3 flex flex-col justify-between space-y-3 group border border-white/5 hover:border-white/20 transition-all rounded-xl bg-zinc-900/60';
    card.dataset.itemId = item.id;

    let previewHtml = '';
    const thumbUrl = item.thumbUrl || item.thumbnailUrl || item.url;

    if (item.type === 'image') {
      previewHtml = `
        <div class="w-full h-40 rounded-lg overflow-hidden bg-black/60 cursor-pointer relative" onclick="MickeyStudio.openLightbox('${item.url}')">
          <img src="${thumbUrl}" alt="${item.title || 'صورة'}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200">
          <span class="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-md text-[9px] font-mono text-zinc-300 px-1.5 py-0.5 rounded">WEBP</span>
        </div>
      `;
    } else if (item.type === 'video') {
      previewHtml = `
        <div class="w-full h-40 rounded-lg overflow-hidden bg-black/80 flex items-center justify-center relative">
          <video src="${item.url}" preload="metadata" controls class="w-full h-full object-cover"></video>
        </div>
      `;
    } else if (item.type === 'audio') {
      previewHtml = `
        <div class="w-full h-40 rounded-lg bg-black/60 p-3 flex flex-col items-center justify-center space-y-2">
          <i class="fa-solid fa-microphone-lines text-emerald-400 text-3xl"></i>
          <audio src="${item.url}" preload="none" controls class="w-full"></audio>
        </div>
      `;
    } else if (item.type === 'transcribe') {
      const snippet = (item.transcript || item.prompt || '').slice(0, 140);
      const wordCount = (item.transcript || '').split(/\s+/).filter(Boolean).length;
      previewHtml = `
        <div class="w-full h-40 rounded-lg bg-zinc-950/80 border border-white/5 p-3 flex flex-col justify-between overflow-hidden">
          <div class="flex items-center justify-between text-indigo-400 text-[11px] font-semibold">
            <span class="flex items-center gap-1.5"><i class="fa-solid fa-file-audio text-xs"></i> تفريغ صوتي</span>
            <span class="text-[10px] text-zinc-500 font-mono">${wordCount} كلمة</span>
          </div>
          <p class="text-[11px] text-zinc-300 leading-relaxed overflow-hidden line-clamp-3 select-text font-sans">${snippet}...</p>
          ${item.url ? `<audio src="${item.url}" preload="none" controls class="w-full h-7 mt-1"></audio>` : '<div class="text-[10px] text-zinc-500 font-mono">ملف نصي مفرغ</div>'}
        </div>
      `;
    }

    const actionBtnHtml = item.type === 'transcribe'
      ? `<button onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(item.transcript || '')}')); MickeyStudio.showToast('تم نسخ النص المفرغ!', 'success');" class="text-xs text-zinc-300 hover:text-white flex items-center gap-1 font-semibold" aria-label="نسخ النص المفرغ"><i class="fa-regular fa-copy"></i> <span>نسخ النص</span></button>`
      : `<a href="${item.url}" download="vault_${item.id}" class="text-xs text-zinc-300 hover:text-white flex items-center gap-1 font-semibold" aria-label="تحميل الملف"><i class="fa-solid fa-download"></i> <span>تحميل</span></a>`;

    const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleDateString('ar-EG') : '';

    card.innerHTML = `
      ${previewHtml}
      <div>
        <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase font-mono">${item.type}</span>
          <span>${dateStr}</span>
        </div>
        <h4 class="text-xs font-bold text-white truncate" title="${item.title || ''}">${item.title || 'عنصر بدون عنوان'}</h4>
        <p class="text-[11px] text-slate-500 truncate" title="${item.prompt || ''}">${item.prompt || ''}</p>
      </div>
      <div class="flex items-center justify-between pt-2 border-t border-white/10">
        ${actionBtnHtml}
        <button onclick="MickeyStudio.deleteVaultItem('${item.id}')" class="text-xs text-red-400 hover:text-red-300 p-1" title="حذف" aria-label="حذف العنصر">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;

    return card;
  }

  function appendNextChunk(grid) {
    if (currentlyRenderedCount >= currentFilteredList.length) return;

    const nextBatch = currentFilteredList.slice(currentlyRenderedCount, currentlyRenderedCount + PAGE_SIZE);
    const fragment = document.createDocumentFragment();

    nextBatch.forEach(item => {
      fragment.appendChild(createAssetCard(item));
    });

    // Remove existing sentinel if present
    const existingSentinel = document.getElementById('vault-scroll-sentinel');
    if (existingSentinel) existingSentinel.remove();

    grid.appendChild(fragment);
    currentlyRenderedCount += nextBatch.length;

    // If there are still items remaining, add sentinel at bottom
    if (currentlyRenderedCount < currentFilteredList.length) {
      const sentinel = document.createElement('div');
      sentinel.id = 'vault-scroll-sentinel';
      sentinel.className = 'col-span-full h-12 flex items-center justify-center text-zinc-500 text-xs py-4';
      sentinel.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin me-2 text-indigo-400"></i> تحميل المزيد من الأعمال...';
      grid.appendChild(sentinel);

      if (scrollObserver) scrollObserver.observe(sentinel);
    }
  }

  function setupScrollObserver(grid) {
    if (scrollObserver) {
      scrollObserver.disconnect();
    }
    scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          appendNextChunk(grid);
        }
      });
    }, { rootMargin: '200px' });
  }

  async function renderVaultGallery() {
    const grid = document.getElementById('vault-items-grid');
    const emptyView = document.getElementById('vault-empty-view');
    if (!grid) return;

    const assets = await (window.MickeyStudio.getAllAssetsFromDB ? window.MickeyStudio.getAllAssetsFromDB() : []);
    const filter = window.MickeyStudio.STATE?.vault?.currentFilter || 'all';
    const query = (window.MickeyStudio.STATE?.vault?.searchQuery || '').toLowerCase();

    currentFilteredList = assets.filter(a => {
      if (filter !== 'all' && a.type !== filter) return false;
      const t = (a.title || '').toLowerCase();
      const p = (a.prompt || '').toLowerCase();
      if (query && !t.includes(query) && !p.includes(query)) return false;
      return true;
    });

    currentFilteredList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Update count badge in sidebar
    const badge = document.getElementById('vault-count-badge');
    if (badge) badge.textContent = String(assets.length);

    grid.innerHTML = '';
    currentlyRenderedCount = 0;

    if (currentFilteredList.length === 0) {
      grid.classList.add('hidden');
      if (emptyView) emptyView.classList.remove('hidden');
      return;
    }

    grid.classList.remove('hidden');
    if (emptyView) emptyView.classList.add('hidden');

    setupScrollObserver(grid);
    appendNextChunk(grid);
  }

  function filterVault(filterKey) {
    if (window.MickeyStudio.STATE?.vault) {
      window.MickeyStudio.STATE.vault.currentFilter = filterKey;
    }
    document.querySelectorAll('.vault-filter-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('vault-filter-' + filterKey);
    if (activeBtn) activeBtn.classList.add('active');

    if (window.MickeyStudio.SFX?.playClick) window.MickeyStudio.SFX.playClick();
    renderVaultGallery();
  }

  function searchVault(query) {
    if (window.MickeyStudio.STATE?.vault) {
      window.MickeyStudio.STATE.vault.searchQuery = query;
    }
    renderVaultGallery();
  }

  async function deleteVaultItem(id) {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر نهائياً من خزنتك؟')) return;
    if (window.MickeyStudio.deleteAssetFromDB) {
      await window.MickeyStudio.deleteAssetFromDB(id);
    }
    if (window.MickeyStudio.SFX?.playSuccess) window.MickeyStudio.SFX.playSuccess();
    if (window.MickeyStudio.showToast) window.MickeyStudio.showToast('تم حذف العنصر بنجاح!', 'info');
    renderVaultGallery();
  }

  async function clearVaultConfirm() {
    if (!confirm('تحذير: هل أنت متأكد من مسح كافة محتويات الخزنة بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    if (window.MickeyStudio.clearAllAssetsFromDB) {
      await window.MickeyStudio.clearAllAssetsFromDB();
    }
    if (window.MickeyStudio.showToast) window.MickeyStudio.showToast('تم تفريغ الخزنة بالكامل!', 'info');
    renderVaultGallery();
  }

  async function exportVaultBackup() {
    const assets = await (window.MickeyStudio.getAllAssetsFromDB ? window.MickeyStudio.getAllAssetsFromDB() : []);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(assets, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `mickey_vault_backup_${Date.now()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    if (window.MickeyStudio.showToast) window.MickeyStudio.showToast('تم تصدير النسخة الاحتياطية بنجاح!', 'success');
  }

  async function saveCurrentToVault(type) {
    const SFX = window.MickeyStudio?.SFX;
    const STATE = window.MickeyStudio?.STATE;
    const showToast = window.MickeyStudio?.showToast || window.showToast;
    const saveAssetToDB = window.MickeyStudio?.saveAssetToDB;
    if (SFX?.playClick) SFX.playClick();
    let asset = null;
    const now = Date.now();

    if (type === 'image') {
      if (!STATE?.image?.lastGeneratedBlob && !STATE?.image?.lastGeneratedUrl) {
        if (showToast) showToast('لا توجد صورة محفوظة لتسجيلها بالخزنة!', 'warning');
        return;
      }
      asset = {
        id: 'img_' + now,
        type: 'image',
        title: STATE.image.lastPrompt?.slice(0, 45) || 'صورة ذكاء اصطناعي',
        url: STATE.image.lastGeneratedUrl,
        prompt: STATE.image.lastPrompt || '',
        timestamp: now
      };
    } else if (type === 'video') {
      if (!STATE?.video?.renderedVideoUrl) {
        if (showToast) showToast('لا يوجد فيديو لتسجيله بالخزنة!', 'warning');
        return;
      }
      asset = {
        id: 'vid_' + now,
        type: 'video',
        title: 'فيديو سينمائي 3D',
        url: STATE.video.renderedVideoUrl,
        prompt: 'حركة كاميرا: ' + (STATE.video.cameraMotion || ''),
        timestamp: now
      };
    } else if (type === 'transcribe') {
      const textOutput = document.getElementById('transcribe-text-output');
      const transcriptText = textOutput ? textOutput.value.trim() : '';
      if (!transcriptText) {
        if (showToast) showToast('لا يوجد نص مفرغ لحفظه في الخزنة!', 'warning');
        return;
      }
      const srtText = document.getElementById('transcribe-srt-output')?.value || '';
      const summaryText = document.getElementById('transcribe-summary-text')?.textContent || '';
      const dialectText = document.getElementById('metric-dialect')?.textContent?.trim() || 'عربي';

      asset = {
        id: 'trn_' + now,
        type: 'transcribe',
        title: transcriptText.slice(0, 45) + (transcriptText.length > 45 ? '...' : ''),
        url: STATE?.transcribe?.audioUrl || '',
        prompt: `لهجة: ${dialectText} | ${summaryText || transcriptText.slice(0, 70)}`,
        transcript: transcriptText,
        srt: srtText,
        summary: summaryText,
        timestamp: now
      };
    }

    if (asset && saveAssetToDB) {
      await saveAssetToDB(asset);
      if (SFX?.playSuccess) SFX.playSuccess();
      if (showToast) showToast('تم الحفظ في خزنة أعمالك بنجاح!', 'success');
      renderVaultGallery();
    }
  }

  async function saveBgResultToVault() {
    const STATE = window.MickeyStudio?.STATE;
    const SFX = window.MickeyStudio?.SFX;
    const showToast = window.MickeyStudio?.showToast || window.showToast;
    const saveAssetToDB = window.MickeyStudio?.saveAssetToDB;
    if (!STATE?.photoLab?.bgResultBlob) {
      if (showToast) showToast('لا توجد نتيجة تفريغ خلفية لحفظها!', 'warning');
      return;
    }
    const url = URL.createObjectURL(STATE.photoLab.bgResultBlob);
    const asset = {
      id: 'bg_' + Date.now(),
      type: 'image',
      title: 'صورة مفرغة الخلفية PNG',
      url: url,
      prompt: 'عزل خلفية ذكي',
      timestamp: Date.now()
    };
    if (saveAssetToDB) await saveAssetToDB(asset);
    if (SFX?.playSuccess) SFX.playSuccess();
    if (showToast) showToast('تم حفظ الصورة المفرغة بالخزنة!', 'success');
    renderVaultGallery();
  }

  async function saveUpscaledToVault() {
    const STATE = window.MickeyStudio?.STATE;
    const SFX = window.MickeyStudio?.SFX;
    const showToast = window.MickeyStudio?.showToast || window.showToast;
    const saveAssetToDB = window.MickeyStudio?.saveAssetToDB;
    if (!STATE?.photoLab?.upscaleResultBlob) {
      if (showToast) showToast('لا توجد صورة محسنة لحفظها!', 'warning');
      return;
    }
    const url = URL.createObjectURL(STATE.photoLab.upscaleResultBlob);
    const asset = {
      id: 'up_' + Date.now(),
      type: 'image',
      title: 'صورة محسّنة بالذكاء الاصطناعي',
      url: url,
      prompt: 'تكبير وتحسين الصورة',
      timestamp: Date.now()
    };
    if (saveAssetToDB) await saveAssetToDB(asset);
    if (SFX?.playSuccess) SFX.playSuccess();
    if (showToast) showToast('تم حفظ الصورة المحسّنة بالخزنة!', 'success');
    renderVaultGallery();
  }

  async function saveAudioToVault() {
    const STATE = window.MickeyStudio?.STATE;
    const SFX = window.MickeyStudio?.SFX;
    const showToast = window.MickeyStudio?.showToast || window.showToast;
    const saveAssetToDB = window.MickeyStudio?.saveAssetToDB;
    if (!STATE?.voice?.lastAudioBlob && !STATE?.voice?.lastAudioUrl) {
      if (showToast) showToast('لا يوجد تعليق صوتي لحفظه!', 'warning');
      return;
    }
    const asset = {
      id: 'aud_' + Date.now(),
      type: 'audio',
      title: document.getElementById('voice-text-input')?.value.slice(0, 35) || 'تعليق صوتي WAV',
      url: STATE.voice.lastAudioUrl,
      prompt: 'صوت: ' + (document.getElementById('voice-dialect-select')?.selectedOptions?.[0]?.textContent || '') + ' · ' + (document.getElementById('voice-performance-select')?.selectedOptions?.[0]?.textContent || ''),
      timestamp: Date.now()
    };
    if (saveAssetToDB) await saveAssetToDB(asset);
    if (SFX?.playSuccess) SFX.playSuccess();
    if (showToast) showToast('تم حفظ التعليق الصوتي بالخزنة!', 'success');
    renderVaultGallery();
  }

  // Register on MickeyStudio
  const exports = {
    renderVaultGallery,
    filterVault,
    searchVault,
    deleteVaultItem,
    clearVaultConfirm,
    exportVaultBackup,
    generateWebPThumbnail,
    saveCurrentToVault,
    saveBgResultToVault,
    saveUpscaledToVault,
    saveAudioToVault
  };

  if (typeof window.MickeyStudio !== 'undefined') {
    Object.assign(window.MickeyStudio, exports);
  }

  root.VaultGalleryStudio = exports;

})(typeof window !== 'undefined' ? window : this);
