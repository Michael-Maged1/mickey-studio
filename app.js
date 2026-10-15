/**
 * ===================================================================
 * MICKEY STUDIO - ALL-IN-ONE FUTURISTIC AI CREATIVE STUDIO
 * Core Logic: Prompt Architect, Image Studio, 3D Motion Video Engine,
 * Photo Lab (BG Remover + 4K Upscale), Voiceover Lab, IndexedDB Vault, Firebase.
 * ===================================================================
 */

'use strict';

// Global Application Controller Namespace
window.MickeyStudio = (function () {

  // -----------------------------------------------------------------
  // 1. STATE & CONFIGURATION
  // -----------------------------------------------------------------
  const STATE = {
    activeTab: 'image-studio',
    soundEnabled: true,
    user: null,
    userProfile: null,
    
    // Image Studio State
    image: {
      model: 'flux',
      width: 1024,
      height: 1024,
      seed: Math.floor(Math.random() * 9999999),
      batchCount: 1,
      selectedStyle: 'hyper-real',
      lastGeneratedBlob: null,
      lastGeneratedUrl: null,
      lastPrompt: '',
      lastEnhancedPrompt: ''
    },

    // Video Studio State
    video: {
      engine: 'canvas', // 'canvas' | 'gradio'
      sourceImage: null,
      sourceImageUrl: null,
      cameraMotion: 'zoom-in',
      particles: 'neon-sparks',
      duration: 3,
      soundtrack: 'none',
      renderedVideoBlob: null,
      renderedVideoUrl: null,
      isRendering: false
    },

    // Photo Lab State
    photoLab: {
      subTab: 'bg-remover', // 'bg-remover' | 'upscaler'
      bgSourceImage: null,
      bgSourceFile: null,
      bgMode: 'transparent',
      bgResultBlob: null,
      upscaleSourceImage: null,
      upscaleSourceFile: null,
      upscaleMultiplier: 2,
      upscaleResultBlob: null
    },

    // Voiceover Lab State
    voice: {
      speaker: 'Tariq',
      rate: 1.0,
      pitch: 1.0,
      lastAudioBlob: null,
      lastAudioUrl: null,
      audioCtx: null,
      analyser: null,
      animId: null
    },

    // Transcribe & Speech Analysis State
    transcribe: {
      mode: 'upload', // 'upload' | 'record'
      audioFile: null,
      audioBlob: null,
      audioUrl: null,
      audioBase64: null,
      audioMime: 'audio/webm',
      duration: 0,
      isRecording: false,
      mediaRecorder: null,
      recInterval: null,
      recSeconds: 0,
      audioStream: null,
      audioContext: null,
      analyser: null,
      lastResult: null,
      outputTab: 'transcript'
    },

    // Vault State
    vault: {
      currentFilter: 'all',
      searchQuery: ''
    },

    // Developer API State
    devApi: {
      activeKey: localStorage.getItem('mickey_dev_api_key') || '',
      selectedEndpoint: 'transcribe_audio',
      selectedLang: 'curl',
      keyVisible: false
    },

    // Settings (API Vault)
    settings: {
      cloudflareWorkerUrl: localStorage.getItem('mickey_cloudflare_worker_url') || '',
      gradioSpace: localStorage.getItem('mickey_gradio_space') || 'Lightricks/LTX-Video',
      sfxEnabled: localStorage.getItem('mickey_sfx_enabled') !== 'false'
    }
  };

  // -----------------------------------------------------------------
  // 2. WEB AUDIO API SYNTHESIZER (FUTURISTIC SFX)
  // -----------------------------------------------------------------
  let sfxAudioCtx = null;
  function getAudioCtx() {
    if (!sfxAudioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) sfxAudioCtx = new AudioCtx();
    }
    if (sfxAudioCtx && sfxAudioCtx.state === 'suspended') {
      sfxAudioCtx.resume();
    }
    return sfxAudioCtx;
  }

  const SFX = {
    playClick() {
      if (!STATE.settings.sfxEnabled) return;
      try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } catch (e) {}
    },

    playSuccess() {
      if (!STATE.settings.sfxEnabled) return;
      try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.08, now + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.25);
        });
      } catch (e) {}
    },

    playLaser() {
      if (!STATE.settings.sfxEnabled) return;
      try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.09, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } catch (e) {}
    }
  };

  // -----------------------------------------------------------------
  // 2.5. CRYPTO VAULT (CLIENT-SIDE AES-GCM 256-BIT ENCRYPTION)
  // -----------------------------------------------------------------
  const CryptoVault = {
    _derivedKey: null,

    async _getKey() {
      if (this._derivedKey) return this._derivedKey;
      
      let saltHex = localStorage.getItem('mickey_vault_salt');
      if (!saltHex || saltHex.length < 32) {
        saltHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('mickey_vault_salt', saltHex);
      }

      const enc = new TextEncoder();
      const baseKeyMaterial = enc.encode('MickeyStudio_ClientVault_MasterSeed_2026_' + saltHex);
      
      const importedMaterial = await crypto.subtle.importKey(
        'raw',
        baseKeyMaterial,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      this._derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: enc.encode('MickeyStudio_Salt_' + saltHex),
          iterations: 100000,
          hash: 'SHA-256'
        },
        importedMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      return this._derivedKey;
    },

    async encrypt(plainText) {
      if (!plainText || typeof plainText !== 'string' || !plainText.trim()) return '';
      try {
        const key = await this._getKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const enc = new TextEncoder();
        const cipherBuffer = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          enc.encode(plainText)
        );

        const ivB64 = btoa(String.fromCharCode(...iv));
        const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));
        return `enc:v2:aes256:${ivB64}:${cipherB64}`;
      } catch (err) {
        console.warn('CryptoVault encryption fallback:', err);
        return 'enc:v1:' + btoa(encodeURIComponent(plainText));
      }
    },

    async decrypt(cipherText) {
      if (!cipherText || typeof cipherText !== 'string' || !cipherText.trim()) return '';
      if (!cipherText.startsWith('enc:')) {
        return cipherText;
      }

      try {
        if (cipherText.startsWith('enc:v2:aes256:')) {
          const parts = cipherText.split(':');
          if (parts.length >= 5) {
            const iv = Uint8Array.from(atob(parts[3]), c => c.charCodeAt(0));
            const cipherData = Uint8Array.from(atob(parts[4]), c => c.charCodeAt(0));
            const key = await this._getKey();
            const decryptedBuffer = await crypto.subtle.decrypt(
              { name: 'AES-GCM', iv },
              key,
              cipherData
            );
            const dec = new TextDecoder();
            return dec.decode(decryptedBuffer);
          }
        } else if (cipherText.startsWith('enc:v1:')) {
          return decodeURIComponent(atob(cipherText.replace('enc:v1:', '')));
        }
      } catch (err) {
        console.warn('CryptoVault decryption failed:', err);
        return '';
      }
      return cipherText;
    }
  };

  // -----------------------------------------------------------------
  // 3. INDEXEDDB PERSISTENCE (MY AI VAULT)
  // -----------------------------------------------------------------
  const DB_NAME = 'MickeyStudioVaultDB';
  const DB_STORE = 'vault_assets';
  let dbInstance = null;

  function initIndexedDB() {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          const store = db.createObjectStore(DB_STORE, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      request.onsuccess = (e) => {
        dbInstance = e.target.result;
        updateVaultCountBadge();
        resolve(dbInstance);
      };
      request.onerror = () => {
        console.warn('IndexedDB unavailable, falling back to in-memory store');
        resolve(null);
      };
    });
  }

  function saveAssetToDB(asset) {
    return new Promise((resolve) => {
      if (!dbInstance) return resolve(false);
      try {
        const tx = dbInstance.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        store.put(asset);
        tx.oncomplete = () => {
          updateVaultCountBadge();
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      } catch (err) {
        resolve(false);
      }
    });
  }

  function getAllAssetsFromDB() {
    return new Promise((resolve) => {
      if (!dbInstance) return resolve([]);
      try {
        const tx = dbInstance.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (err) {
        resolve([]);
      }
    });
  }

  function deleteAssetFromDB(id) {
    return new Promise((resolve) => {
      if (!dbInstance) return resolve(false);
      try {
        const tx = dbInstance.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        store.delete(id);
        tx.oncomplete = () => {
          updateVaultCountBadge();
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      } catch (err) {
        resolve(false);
      }
    });
  }

  function clearAllAssetsFromDB() {
    return new Promise((resolve) => {
      if (!dbInstance) return resolve(false);
      try {
        const tx = dbInstance.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        store.clear();
        tx.oncomplete = () => {
          updateVaultCountBadge();
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      } catch (err) {
        resolve(false);
      }
    });
  }

  async function updateVaultCountBadge() {
    const assets = await getAllAssetsFromDB();
    const badge = document.getElementById('vault-count-badge');
    const badgeAll = document.getElementById('vault-count-all');
    const badgeImages = document.getElementById('vault-count-images');
    const badgeVideos = document.getElementById('vault-count-videos');
    const badgeAudios = document.getElementById('vault-count-audios');
    const badgeTranscripts = document.getElementById('vault-count-transcripts');

    if (badge) badge.textContent = assets.length;
    if (badgeAll) badgeAll.textContent = assets.length;
    if (badgeImages) badgeImages.textContent = assets.filter(a => a.type === 'image').length;
    if (badgeVideos) badgeVideos.textContent = assets.filter(a => a.type === 'video').length;
    if (badgeAudios) badgeAudios.textContent = assets.filter(a => a.type === 'audio').length;
    if (badgeTranscripts) badgeTranscripts.textContent = assets.filter(a => a.type === 'transcribe').length;
  }

  // -----------------------------------------------------------------
  // 4. TOAST NOTIFICATIONS & UI HELPERS
  // -----------------------------------------------------------------
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'sci-fi-toast';

    let iconClass = 'fa-solid fa-circle-info text-cyan-neon';
    if (type === 'success') iconClass = 'fa-solid fa-circle-check text-emerald-400';
    if (type === 'error') iconClass = 'fa-solid fa-triangle-exclamation text-pink-neon';
    if (type === 'warning') iconClass = 'fa-solid fa-bell text-amber-400';

    toast.innerHTML = `
      <i class="${iconClass} text-lg"></i>
      <span class="flex-1 font-semibold">${message}</span>
      <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white text-xs">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  function downloadBlob(blob, filename) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // -----------------------------------------------------------------
  // 5. MASTER PHOTOREALISTIC PROMPT ARCHITECT & TRANSLATOR
  // -----------------------------------------------------------------
  const PHOTOREALISTIC_STYLES = {
    'hyper-real': 'award-winning RAW candid photography, natural lighting, shot on Sony Alpha A7R V, 50mm f1.4 GM lens, shallow depth of field, authentic micro skin texture, visible pores, lifelike reflections, sharp focus, 8k resolution, unedited authentic real-life photo',
    'portrait': 'masterpiece 85mm portrait photography, shot on Hasselblad, f1.4 aperture, creamy bokeh, studio catchlights in eyes, ultra-realistic facial anatomy, natural skin tones, fine hair strands, high-fashion magazine aesthetic',
    'cinematic': 'cinematic 35mm film still, shot on Arri Alexa 65, anamorphic lens, Kodak Portra 400 color science, moody cinematic atmosphere, natural volumetric shadows, dramatic dynamic range, hyper-detailed movie scene',
    'product': 'high-end commercial product photography, professional 3-point softbox studio lighting, 100mm macro lens, ultra-clean reflections, crystal clear textures, elegant minimalist luxury advertising catalog shot',
    'landscape': 'National Geographic award-winning landscape photography, shot on Phase One 150MP, golden hour sunlight, deep atmospheric perspective, hyper-detailed natural terrain, crystal-clear water and sky, RAW photograph'
  };

  function base64ToBlob(base64, mimeType = 'image/jpeg') {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  async function translateToEnglish(text) {
    if (!text || !text.trim()) return '';
    const clean = text.trim();
    // If text does not contain any Arabic letters, return directly
    if (!/[\u0600-\u06FF]/.test(clean)) {
      return clean;
    }

    // 1. High-speed Google Translate GTX API (<200ms, free, zero-config)
    try {
      const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(clean)}`;
      const res = await fetch(gtxUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data[0] && Array.isArray(data[0])) {
          const translated = data[0].map(item => item[0]).filter(Boolean).join(' ');
          if (translated && translated.trim().length > 0) {
            return translated.trim();
          }
        }
      }
    } catch (e) {}

    // 3. Fallback to api.php proxy
    try {
      const phpRes = await gatewayFetch('enhance_prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: clean })
      });
      if (phpRes.ok) {
        const json = await phpRes.json();
        if (json.success && json.enhanced) return json.enhanced.trim();
      }
    } catch (e) {}

    return clean;
  }

  async function craftMasterPhotorealisticPrompt(userPrompt, styleKey = null) {
    const raw = (userPrompt || '').trim();
    if (!raw) return '';

    // Step 1: Translate to English if needed
    const englishBase = await translateToEnglish(raw);

    // Step 2: Pick selected photorealistic preset
    const activeStyle = styleKey || STATE.image.selectedStyle || 'hyper-real';
    const styleSnippet = PHOTOREALISTIC_STYLES[activeStyle] || PHOTOREALISTIC_STYLES['hyper-real'];

    // Step 3: Combine with camera parameters & realistic optics
    let combined = englishBase;
    const lower = combined.toLowerCase();
    if (!lower.includes('shot on') && !lower.includes('photography') && !lower.includes('lens')) {
      combined = `${combined}, ${styleSnippet}`;
    } else {
      combined = `${combined}, award-winning RAW photograph, natural volumetric lighting, shallow depth of field, authentic micro skin texture, visible pores, sharp focus, 8k resolution, unedited real life`;
    }

    return combined;
  }

  async function generateWithHuggingFaceZImage(prompt, width, height, seed) {
    const { Client } = await import('https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js');
    const space = await Client.connect('mrfakename/Z-Image-Turbo');
    const result = await space.predict('/generate_image', [prompt, height, width, 9, seed, false]);
    const image = result?.data?.[0];
    const imageUrl = typeof image === 'string' ? image : (image?.url || image?.path);
    if (!imageUrl) throw new Error('لم تُرجع خدمة Z-Image صورة. أعد المحاولة لاحقًا.');
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('تعذر تنزيل الصورة الناتجة من Hugging Face.');
    return await response.blob();
  }

  async function generateWithCloudflareFlux(prompt, width, height, seed) {
    const workerUrl = String(STATE.settings.cloudflareWorkerUrl || '').trim().replace(/\/$/, '');
    if (!workerUrl) throw new Error('أضف رابط Cloudflare Worker من الإعدادات أولًا. انشر مجلد cloudflare-worker الموجود في الموقع ثم انسخ رابطه هنا.');
    let parsedUrl;
    try { parsedUrl = new URL(workerUrl); } catch { throw new Error('رابط Cloudflare Worker غير صحيح.'); }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
      throw new Error('يجب أن يبدأ رابط Cloudflare Worker بـ https://.');
    }

    const response = await fetch(`${workerUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, width, height, seed })
    });
    if (!response.ok) {
      let message = '';
      try { message = (await response.json()).error || ''; } catch {}
      if (response.status === 429 || /quota|neuron|daily limit/i.test(message)) {
        throw new Error('وصل حساب Cloudflare إلى الحصة المجانية اليومية. تتجدد الحصة عند بداية اليوم بتوقيت UTC.');
      }
      throw new Error(message || `تعذر التوليد عبر Cloudflare (رمز ${response.status}).`);
    }
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('أعاد Cloudflare استجابة غير صالحة كصورة.');
    return blob;
  }

  function huggingFaceErrorMessage(error, fallback) {
    const message = String(error?.message || error || '');
    if (/zerogpu quota|quota.*left|exceeded.*quota/i.test(message)) {
      return false
        ? 'انتهت حصة ZeroGPU المجانية لحساب Hugging Face. الحصة مشتركة بين المساحات وتُجدد لاحقًا؛ جرّب خدمة أخرى أو انتظر التجديد.'
        : 'انتهت حصة ZeroGPU المشتركة مؤقتًا. انتظر تجدد الحصة أو جرّب محركًا آخر.';
    }
    if (/queue|queued|pending/i.test(message)) return 'الخدمة مزدحمة حاليًا وتنتظر دورها. أعد المحاولة بعد قليل.';
    return message || fallback;
  }

  async function enhancePrompt(targetContext = 'image') {
    SFX.playClick();
    let promptInput = document.getElementById('image-prompt-input');
    const originalText = promptInput ? promptInput.value.trim() : '';
    if (!originalText) {
      showToast('يرجى كتابة وصف أولي في الحقل أولاً!', 'warning');
      return;
    }

    const btn = document.getElementById('btn-enhance-image-prompt');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>جاري التحسين...</span>`;
    }

    SFX.playLaser();
    const enhancedResult = await craftMasterPhotorealisticPrompt(originalText, STATE.image.selectedStyle);

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i> <span>تحسين تلقائي ✨</span>`;
    }

    SFX.playSuccess();

    // Show in Modal
    document.getElementById('architect-original-text').textContent = originalText;
    document.getElementById('architect-enhanced-text').textContent = enhancedResult;
    
    const applyBtn = document.getElementById('btn-apply-enhanced-prompt');
    applyBtn.onclick = () => {
      if (promptInput) promptInput.value = enhancedResult;
      document.getElementById('modal-prompt-architect').classList.add('hidden');
      showToast('تم تطبيق الوصف الفوتوغرافي الواقعي في الحقل بنجاح!', 'success');
      SFX.playClick();
    };

    document.getElementById('modal-prompt-architect').classList.remove('hidden');
  }

  function showUsedPromptModal() {
    if (!STATE.image.lastPrompt && !STATE.image.lastEnhancedPrompt) {
      showToast('يرجى توليد صورة أولاً لمشاهدة البرومبت!', 'warning');
      return;
    }
    SFX.playClick();
    document.getElementById('architect-original-text').textContent = STATE.image.lastPrompt || '—';
    document.getElementById('architect-enhanced-text').textContent = STATE.image.lastEnhancedPrompt || STATE.image.lastPrompt;
    const applyBtn = document.getElementById('btn-apply-enhanced-prompt');
    applyBtn.onclick = () => {
      const promptInput = document.getElementById('image-prompt-input');
      if (promptInput) promptInput.value = STATE.image.lastEnhancedPrompt;
      document.getElementById('modal-prompt-architect').classList.add('hidden');
      showToast('تم نسخ البرومبت إلى حقل الوصف!', 'success');
    };
    document.getElementById('modal-prompt-architect').classList.remove('hidden');
  }

  // -----------------------------------------------------------------
  // 6. STUDIO 1: MASTER PHOTOREALISTIC IMAGE GENERATOR
  // -----------------------------------------------------------------
  function updateModelTag(modelName) {
    STATE.image.model = modelName;
    const tag = document.getElementById('current-model-tag');
    if (tag) tag.textContent = modelName.toUpperCase();
    SFX.playClick();
  }

  function selectRatio(buttonEl, width, height) {
    STATE.image.width = width;
    STATE.image.height = height;
    document.querySelectorAll('#image-ratio-selector .ratio-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    buttonEl.classList.add('active');
    SFX.playClick();
  }

  function selectStyle(btnEl, styleKey) {
    STATE.image.selectedStyle = styleKey;
    document.querySelectorAll('#image-style-tags .pill-option').forEach(btn => {
      btn.classList.remove('active');
    });
    if (btnEl) btnEl.classList.add('active');
    SFX.playClick();
  }

  function randomizeSeed() {
    const seed = Math.floor(Math.random() * 999999999);
    STATE.image.seed = seed;
    const input = document.getElementById('image-seed-input');
    if (input) input.value = seed;
    SFX.playClick();
  }

  function setBatchCount(btnOrCount, maybeCount) {
    let count = typeof btnOrCount === 'number' ? btnOrCount : (maybeCount || 1);
    let btnEl = (btnOrCount && btnOrCount.nodeType) ? btnOrCount : (window.event && window.event.currentTarget) || null;
    STATE.image.batchCount = count;
    document.querySelectorAll('.batch-count-btn').forEach(btn => {
      btn.classList.remove('active', 'bg-cyan-500/20', 'text-cyan-neon', 'border-cyan-500/40');
      btn.classList.add('bg-white/5', 'text-slate-300', 'border-white/10');
    });
    if (btnEl) {
      btnEl.classList.add('active', 'bg-cyan-500/20', 'text-cyan-neon', 'border-cyan-500/40');
      btnEl.classList.remove('bg-white/5', 'text-slate-300', 'border-white/10');
    }
    SFX.playClick();
  }

  async function generateImage() {
    const promptInput = document.getElementById('image-prompt-input');
    let prompt = promptInput ? promptInput.value.trim() : '';
    if (!prompt) {
      showToast('يرجى إدخال وصف للصورة المراد توليدها!', 'warning');
      if (promptInput) promptInput.focus();
      return;
    }
    if (!await authorizeAndConsume('image', STATE.image.batchCount || 1)) return;

    SFX.playLaser();

    const generateBtn = document.getElementById('btn-generate-image');
    const laserScanner = document.getElementById('image-laser-scanner');
    const emptyState = document.getElementById('image-empty-state');
    const resultGrid = document.getElementById('image-result-grid');
    const actionsBar = document.getElementById('image-actions-bar');
    const statusPill = document.getElementById('image-status-pill');

    // UI Busy State
    generateBtn.disabled = true;
    generateBtn.classList.add('opacity-70');
    laserScanner.classList.remove('hidden');
    emptyState.classList.add('hidden');
    resultGrid.classList.add('hidden');
    actionsBar.classList.add('opacity-0', 'pointer-events-none');
    statusPill.textContent = 'جاري إعداد معايير التصوير والواقعية...';
    statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-cyan-400';

    const seedVal = parseInt(document.getElementById('image-seed-input')?.value) || Math.floor(Math.random() * 9999999);
    STATE.image.seed = seedVal;
    STATE.image.lastPrompt = prompt;

    try {
      // Step A: Determine whether to boost/translate prompt to English photorealistic
      const autoBoost = document.getElementById('auto-prompt-boost')?.checked !== false;
      let finalPrompt = prompt;

      if (autoBoost || /[\u0600-\u06FF]/.test(prompt)) {
        statusPill.textContent = 'جاري تحويل الوصف لمعايير كاميرا واقعية احترافية...';
        finalPrompt = await craftMasterPhotorealisticPrompt(prompt, STATE.image.selectedStyle);
      }
      STATE.image.lastEnhancedPrompt = finalPrompt;

      // Route 1: Google Imagen 3 through the server-side key proxy.
      if (STATE.image.model === 'nano-banana') {
        statusPill.textContent = 'جاري التوليد عبر Google Imagen 3.0 (2K Ultra)...';
        const aspectRatioStr = STATE.image.width > STATE.image.height ? '16:9' : STATE.image.height > STATE.image.width ? '9:16' : '1:1';
        const res = await gatewayFetch('generate_image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: finalPrompt, aspectRatio: aspectRatioStr }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success || !data.image_base64) throw new Error(data.error || 'تعذر التوليد عبر Google Imagen 3.');
        const b64 = data.image_base64;
        const mime = data.mime_type || 'image/jpeg';
        const blob = base64ToBlob(b64, mime);
        const dataUrl = `data:${mime};base64,${b64}`;
        STATE.image.lastGeneratedBlob = blob;
        STATE.image.lastGeneratedUrl = dataUrl;
        resultGrid.innerHTML = '';
        resultGrid.className = 'w-full h-full flex items-center justify-center p-2';
        const imgEl = document.createElement('img');
        imgEl.src = dataUrl;
        imgEl.alt = prompt;
        imgEl.className = 'max-h-[500px] w-auto rounded-xl object-contain shadow-2xl transition-all cursor-pointer hover:scale-[1.01]';
        imgEl.onclick = () => MickeyStudio.openLightbox(imgEl.src);
        resultGrid.appendChild(imgEl);
        laserScanner.classList.add('hidden');
        resultGrid.classList.remove('hidden');
        actionsBar.classList.remove('opacity-0', 'pointer-events-none');
        statusPill.textContent = 'اكتمل التوليد (Google Imagen 3.0 Ultra)';
        statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-emerald-500/30 text-emerald-400';
        SFX.playSuccess();
        showToast('تم توليد الصورة بأعلى دقة واقعية عبر Google Imagen 3.0!', 'success');
        return;
      }

      // Route 2: Cloudflare FLUX
      if (STATE.image.model === 'cloudflare-flux') {
        statusPill.textContent = 'جاري التوليد عبر FLUX.1-schnell على Cloudflare...';
        const blob = await generateWithCloudflareFlux(finalPrompt, STATE.image.width, STATE.image.height, seedVal);
        const imageUrl = URL.createObjectURL(blob);
        STATE.image.lastGeneratedBlob = blob;
        STATE.image.lastGeneratedUrl = imageUrl;
        resultGrid.innerHTML = '';
        resultGrid.className = 'w-full h-full flex items-center justify-center p-2';
        const imgEl = document.createElement('img');
        imgEl.src = imageUrl;
        imgEl.alt = prompt;
        imgEl.className = 'max-h-[500px] w-auto rounded-xl object-contain shadow-2xl transition-all cursor-pointer hover:scale-[1.01]';
        imgEl.onclick = () => MickeyStudio.openLightbox(imgEl.src);
        resultGrid.appendChild(imgEl);
        laserScanner.classList.add('hidden');
        resultGrid.classList.remove('hidden');
        actionsBar.classList.remove('opacity-0', 'pointer-events-none');
        statusPill.textContent = 'اكتمل التوليد (FLUX.1-schnell / Cloudflare)';
        statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-200';
        SFX.playSuccess();
        showToast('تم توليد الصورة عبر FLUX.1-schnell بنجاح.', 'success');
        return;
      }

      // Route 3: Hugging Face Z-Image-Turbo
      if (STATE.image.model === 'zimage-hf') {
        statusPill.textContent = 'جاري الاتصال بـ Z-Image-Turbo على Hugging Face...';
        const blob = await generateWithHuggingFaceZImage(
          finalPrompt,
          STATE.image.width,
          STATE.image.height,
          seedVal
        );
        const imageUrl = URL.createObjectURL(blob);
        STATE.image.lastGeneratedBlob = blob;
        STATE.image.lastGeneratedUrl = imageUrl;
        resultGrid.innerHTML = '';
        resultGrid.className = 'w-full h-full flex items-center justify-center p-2';
        const imgEl = document.createElement('img');
        imgEl.src = imageUrl;
        imgEl.alt = prompt;
        imgEl.className = 'max-h-[500px] w-auto rounded-xl object-contain shadow-2xl transition-all cursor-pointer hover:scale-[1.01]';
        imgEl.onclick = () => MickeyStudio.openLightbox(imgEl.src);
        resultGrid.appendChild(imgEl);
        laserScanner.classList.add('hidden');
        resultGrid.classList.remove('hidden');
        actionsBar.classList.remove('opacity-0', 'pointer-events-none');
        statusPill.textContent = 'اكتمل التوليد (Z-Image-Turbo / Hugging Face)';
        statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-200';
        SFX.playSuccess();
        showToast('تم التوليد عبر Z-Image بعد تحسين الوصف.', 'success');
        return;
      }

      // Route 4: FLUX Photorealistic (DEFAULT - Free & High-Definition)
      statusPill.textContent = 'جاري التوليد الفوتوغرافي الفائق عبر FLUX...';
      const cleanPrompt = finalPrompt.replace(/\//g, ' ');
      const encodedPrompt = encodeURIComponent(cleanPrompt);
      const count = STATE.image.batchCount;
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

      // Render images in Viewport
      resultGrid.innerHTML = '';
      if (count === 1) {
        resultGrid.className = 'w-full h-full flex items-center justify-center p-2';
        const imgEl = document.createElement('img');
        imgEl.src = loadedItems[0].url;
        imgEl.alt = prompt;
        imgEl.className = 'max-h-[500px] w-auto rounded-xl object-contain shadow-2xl transition-all cursor-pointer hover:scale-[1.01]';
        imgEl.onclick = () => MickeyStudio.openLightbox(imgEl.src);
        resultGrid.appendChild(imgEl);
      } else {
        resultGrid.className = 'w-full grid grid-cols-2 gap-3 p-2';
        loadedItems.forEach(({ url }, idx) => {
          const card = document.createElement('div');
          card.className = 'relative rounded-xl overflow-hidden group cursor-pointer border border-white/10 hover:border-white/30 transition-all';
          card.innerHTML = `
            <img src="${url}" alt="Variation ${idx + 1}" class="w-full h-48 object-cover">
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button onclick="MickeyStudio.openLightbox('${url}')" class="p-2 rounded-lg bg-white text-black text-xs font-bold">
                <i class="fa-solid fa-expand"></i>
              </button>
            </div>
          `;
          resultGrid.appendChild(card);
        });
      }

      // Safe Blob capture
      STATE.image.lastGeneratedUrl = loadedItems[0].url;
      STATE.image.lastGeneratedBlob = loadedItems[0].blob;
      if (!STATE.image.lastGeneratedBlob && loadedItems[0].url) {
        try {
          const response = await fetch(loadedItems[0].url);
          STATE.image.lastGeneratedBlob = await response.blob();
        } catch (e) {}
      }

      // UI Success State
      laserScanner.classList.add('hidden');
      resultGrid.classList.remove('hidden');
      actionsBar.classList.remove('opacity-0', 'pointer-events-none');
      statusPill.textContent = 'اكتمل التوليد الواقعي (FLUX.1 Ultra)';
      statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-emerald-500/30 text-emerald-300';

      SFX.playSuccess();
      showToast('تم إنتاج الصورة بجودة واقعية مذهلة!', 'success');

    } catch (err) {
      console.error(err);
      laserScanner.classList.add('hidden');
      emptyState.classList.remove('hidden');
      statusPill.textContent = 'خطأ في التوليد';
      statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-red-400';
      showToast(huggingFaceErrorMessage(err, 'حدث خطأ أثناء الاتصال بمحرك التوليد، يرجى المحاولة ثانية'), 'error');
    } finally {
      generateBtn.disabled = false;
      generateBtn.classList.remove('opacity-70');
    }
  }

  function downloadCurrentImage() {
    if (!STATE.image.lastGeneratedBlob && !STATE.image.lastGeneratedUrl) return;
    SFX.playClick();
    if (STATE.image.lastGeneratedBlob) {
      downloadBlob(STATE.image.lastGeneratedBlob, `mickey_studio_${Date.now()}.png`);
    } else {
      window.open(STATE.image.lastGeneratedUrl, '_blank');
    }
    showToast('جاري تحميل الصورة بدقة PNG الأصلية...', 'info');
  }

  function transferToVideoStudio() {
    if (!STATE.image.lastGeneratedUrl) {
      showToast('يرجى توليد صورة أولاً لنقلها إلى استوديو الفيديو!', 'warning');
      return;
    }
    SFX.playClick();
    switchTab('video-studio');
    useLastGeneratedImageForVideo();
    showToast('تم نقل الصورة إلى استوديو الفيديو السينمائي بنجاح!', 'success');
  }

  function transferToPhotoLab() {
    if (!STATE.image.lastGeneratedUrl) {
      showToast('يرجى توليد صورة أولاً لنقلها إلى مختبر التعديل!', 'warning');
      return;
    }
    SFX.playClick();
    switchTab('photo-lab');
    useLastImageForPhotoLab();
    showToast('تم تحميل الصورة في مختبر التعديل وتكبير الجودة!', 'success');
  }

  // -----------------------------------------------------------------
  // 7. STUDIO 2: AI VIDEO & MOTION STUDIO (3D PARALLAX & CANVAS)
  // -----------------------------------------------------------------
  function setVideoEngine(engine) {
    STATE.video.engine = engine;
    document.getElementById('btn-engine-canvas').classList.toggle('active', engine === 'canvas');
    document.getElementById('btn-engine-gradio').classList.toggle('active', engine === 'gradio');

    SFX.playClick();
    if (engine === 'gradio') {
      showToast('وضع ZeroGPU السحابي نشط (يتصل بسبيس HuggingFace المحدد في الإعدادات)', 'info');
    } else {
      showToast('محرك الحركة اللحظي نشط (مضمون 100% وبدون طوابير انتطار)', 'success');
    }
  }

  function useLastGeneratedImageForVideo() {
    if (!STATE.image.lastGeneratedUrl) {
      showToast('لا توجد صورة مولدة سابقة بعد!', 'warning');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      STATE.video.sourceImage = img;
      STATE.video.sourceImageUrl = STATE.image.lastGeneratedUrl;
      document.getElementById('video-source-img').src = STATE.image.lastGeneratedUrl;
      document.getElementById('video-source-preview').classList.remove('hidden');
      document.getElementById('video-source-empty').classList.add('hidden');
      SFX.playClick();
    };
    img.src = STATE.image.lastGeneratedUrl;
  }

  function handleVideoImageUpload(fileInput) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        STATE.video.sourceImage = img;
        STATE.video.sourceImageUrl = e.target.result;
        document.getElementById('video-source-img').src = e.target.result;
        document.getElementById('video-source-preview').classList.remove('hidden');
        document.getElementById('video-source-empty').classList.add('hidden');
        SFX.playSuccess();
        showToast('تم تحميل الصورة بنجاح!', 'success');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function selectCameraMotion(btnEl, motionType) {
    STATE.video.cameraMotion = motionType;
    document.querySelectorAll('#camera-motion-selector .cam-motion-btn').forEach(b => {
      b.classList.remove('active');
    });
    btnEl.classList.add('active');
    SFX.playClick();
  }

  function setVideoDuration(btnOrSec, maybeSec) {
    let seconds = typeof btnOrSec === 'number' ? btnOrSec : (maybeSec || 3);
    let btnEl = (btnOrSec && btnOrSec.nodeType) ? btnOrSec : (window.event && window.event.currentTarget) || null;
    STATE.video.duration = seconds;
    document.querySelectorAll('.video-dur-btn').forEach(btn => {
      btn.classList.remove('active', 'bg-cyan-500/20', 'text-cyan-neon', 'border-cyan-500/40');
      btn.classList.add('bg-white/5', 'text-slate-300', 'border-white/10');
    });
    if (btnEl) {
      btnEl.classList.add('active', 'bg-cyan-500/20', 'text-cyan-neon', 'border-cyan-500/40');
      btnEl.classList.remove('bg-white/5', 'text-slate-300', 'border-white/10');
    }
    SFX.playClick();
  }

  // Guaranteed Real-time 3D Cinematic Motion Engine (HTML5 Canvas + MediaRecorder API)
  async function renderVideo() {
    if (!STATE.video.sourceImage) {
      showToast('يرجى اختيار صورة مصدر لإنتاج الفيديو أولاً!', 'warning');
      return;
    }
    if (!await authorizeAndConsume('video')) return;

    if (STATE.video.engine === 'gradio') {
      renderGradioVideo();
      return;
    }

    SFX.playLaser();
    STATE.video.isRendering = true;

    const canvas = document.getElementById('motion-render-canvas');
    const videoEl = document.getElementById('final-rendered-video');
    const emptyState = document.getElementById('video-empty-state');
    const scanner = document.getElementById('video-laser-scanner');
    const actionsBar = document.getElementById('video-actions-bar');
    const renderCounter = document.getElementById('video-render-counter');
    const progressPill = document.getElementById('video-render-progress');

    // UI Busy State
    scanner.classList.remove('hidden');
    emptyState.classList.add('hidden');
    videoEl.classList.add('hidden');
    canvas.classList.remove('hidden');
    actionsBar.classList.add('opacity-0', 'pointer-events-none');
    progressPill.textContent = 'جاري إنتاج الفيديو...';
    progressPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-400';

    // Canvas Dimensions
    const W = 1280;
    const H = 720;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const durationSec = STATE.video.duration;
    const fps = 30;
    const totalFrames = durationSec * fps;
    const motionType = STATE.video.cameraMotion;
    const particleType = document.getElementById('video-particles-select')?.value || 'neon-sparks';
    const soundTrackChoice = document.getElementById('video-soundtrack-select')?.value || 'none';

    // Initialize Particles
    const particles = [];
    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() * 3.5 + 1,
        speedX: (Math.random() - 0.5) * 1.5,
        speedY: (Math.random() - 0.5) * 1.8 - 0.8,
        alpha: Math.random() * 0.7 + 0.3,
        hue: Math.random() > 0.5 ? 185 : 280 // Cyan or Purple
      });
    }

    // Audio mixing setup
    let audioStreamTrack = null;
    let audioContext = null;
    let osc = null;

    if (soundTrackChoice === 'voiceover-custom' && STATE.voice.lastAudioBlob) {
      try {
        const audio = new Audio(URL.createObjectURL(STATE.voice.lastAudioBlob));
        const actx = new (window.AudioContext || window.webkitAudioContext)();
        const src = actx.createMediaElementSource(audio);
        const dest = actx.createMediaStreamDestination();
        src.connect(dest);
        src.connect(actx.destination);
        audioStreamTrack = dest.stream.getAudioTracks()[0];
        audio.play();
      } catch (e) {}
    } else if (soundTrackChoice !== 'none') {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioContext.createMediaStreamDestination();
        osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, audioContext.currentTime); // Deep cinematic drone
        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        audioStreamTrack = dest.stream.getAudioTracks()[0];
      } catch (e) {}
    }

    // Capture Canvas Stream & Setup MediaRecorder
    const canvasStream = canvas.captureStream(fps);
    if (audioStreamTrack) {
      canvasStream.addTrack(audioStreamTrack);
    }

    let recordedChunks = [];
    let mediaRecorder = null;
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    try {
      mediaRecorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 6000000 });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.start();
    } catch (e) {
      console.warn('MediaRecorder fallback to default options');
      mediaRecorder = new MediaRecorder(canvasStream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.start();
    }

    const img = STATE.video.sourceImage;
    let currentFrame = 0;

    function renderLoop() {
      if (currentFrame >= totalFrames) {
        // Finish Recording
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        if (osc) {
          try { osc.stop(); } catch(e){}
        }

        mediaRecorder.onstop = () => {
          const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
          STATE.video.renderedVideoBlob = videoBlob;
          STATE.video.renderedVideoUrl = URL.createObjectURL(videoBlob);

          videoEl.src = STATE.video.renderedVideoUrl;
          videoEl.classList.remove('hidden');
          canvas.classList.add('hidden');
          scanner.classList.add('hidden');
          actionsBar.classList.remove('opacity-0', 'pointer-events-none');
          progressPill.textContent = 'تم إنتاج الفيديو بنجاح ✓';
          progressPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 text-zinc-200';

          videoEl.play();
          SFX.playSuccess();
          showToast('تم تصدير الفيديو السينمائي بنجاح وبدقة فائقة!', 'success');
          STATE.video.isRendering = false;
        };
        return;
      }

      const progress = currentFrame / totalFrames; // 0.0 to 1.0
      renderCounter.textContent = `RENDERING: ${Math.round(progress * 100)}%`;

      // Clear Canvas
      ctx.fillStyle = '#05050A';
      ctx.fillRect(0, 0, W, H);

      // Camera Transformation Matrix
      ctx.save();
      let scale = 1.0;
      let transX = 0;
      let transY = 0;
      let rot = 0;

      if (motionType === 'zoom-in') {
        scale = 1.0 + progress * 0.28;
      } else if (motionType === 'zoom-out') {
        scale = 1.28 - progress * 0.28;
      } else if (motionType === 'pan-horizontal') {
        scale = 1.15;
        transX = (progress - 0.5) * 120;
      } else if (motionType === 'shake-3d') {
        scale = 1.1;
        transX = Math.sin(progress * 25) * 8;
        transY = Math.cos(progress * 20) * 6;
        rot = (Math.sin(progress * 15) * 0.015);
      }

      ctx.translate(W / 2 + transX, H / 2 + transY);
      ctx.rotate(rot);
      ctx.scale(scale, scale);

      // Draw Base Image Center-Fitted
      const imgAspect = img.width / img.height;
      const canvasAspect = W / H;
      let drawW, drawH;

      if (imgAspect > canvasAspect) {
        drawH = H;
        drawW = H * imgAspect;
      } else {
        drawW = W;
        drawH = W / imgAspect;
      }

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // Atmospheric Particles Overlay
      if (particleType !== 'none') {
        particles.forEach(p => {
          ctx.save();
          if (particleType === 'neon-sparks') {
            ctx.fillStyle = p.hue === 185 ? `rgba(0, 240, 255, ${p.alpha})` : `rgba(112, 0, 255, ${p.alpha})`;
            ctx.shadowColor = p.hue === 185 ? '#00F0FF' : '#7000FF';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            p.y += p.speedY * 1.5;
            p.x += p.speedX;
            if (p.y < 0) p.y = H;
            if (p.x < 0) p.x = W;
            if (p.x > W) p.x = 0;
          } else if (particleType === 'cyber-rain') {
            ctx.strokeStyle = `rgba(0, 240, 255, ${p.alpha * 0.8})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - 3, p.y + 18);
            ctx.stroke();
            p.y += 9;
            p.x -= 1.5;
            if (p.y > H) { p.y = -10; p.x = Math.random() * W; }
          } else if (particleType === 'cosmic-dust') {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(Math.sin(progress * 10 + p.x)) * 0.7})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
            ctx.fill();
            p.x += Math.sin(progress * 5 + p.y) * 0.4;
          }
          ctx.restore();
        });
      }

      // Vignette & Cinematic Letterbox
      const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      currentFrame++;
      requestAnimationFrame(renderLoop);
    }

    renderLoop();
  }

  // HuggingFace Gradio Client Video Integration
  async function renderGradioVideo() {
    showToast('جاري الاتصال بـ Hugging Face Space...', 'info');
    const spaceId = STATE.settings.gradioSpace || 'Lightricks/LTX-Video';

    try {
      const { Client } = await import('https://cdn.jsdelivr.net/npm/@gradio/client@latest/dist/index.min.js');
      const client = await Client.connect(spaceId);
      showToast('تم الاتصال بالسبيس! جاري إرسال الإطارات...', 'info');

      // If Space requires inputs, call predict
      // Fallback to Canvas engine if queue is too long
    } catch (err) {
      console.warn('Gradio space busy or unavailable, auto-switching to instant Canvas engine');
      showToast('المساحة السحابية مشغولة، جاري التحويل التلقائي للمحرك اللحظي المضمون...', 'warning');
      setVideoEngine('canvas');
      renderVideo();
    }
  }

  function downloadCurrentVideo() {
    if (!STATE.video.renderedVideoBlob) return;
    SFX.playClick();
    downloadBlob(STATE.video.renderedVideoBlob, `mickey_cinema_${Date.now()}.webm`);
    showToast('جاري تحميل ملف الفيديو السينمائي...', 'info');
  }

  function toggleVideoPlayback() {
    const videoEl = document.getElementById('final-rendered-video');
    if (!videoEl) return;
    SFX.playClick();
    if (videoEl.paused) {
      videoEl.play();
    } else {
      videoEl.pause();
    }
  }

  // -----------------------------------------------------------------
  // 8. STUDIO 3: AI PHOTO LAB (BG REMOVER + 4K UPSCALER)
  // -----------------------------------------------------------------
  function setPhotoLabTab(tabKey) {
    STATE.photoLab.subTab = tabKey;
    const btnBg = document.getElementById('btn-subtab-bg-remover');
    const btnUp = document.getElementById('btn-subtab-upscaler');
    const viewBg = document.getElementById('photolab-view-bg-remover');
    const viewUp = document.getElementById('photolab-view-upscaler');

    if (tabKey === 'bg-remover') {
      btnBg.className = 'px-3.5 py-2 text-xs font-bold rounded-lg bg-pink-neon text-white shadow-[0_0_15px_rgba(255,0,122,0.4)]';
      btnUp.className = 'px-3.5 py-2 text-xs font-bold rounded-lg text-slate-300 hover:text-white';
      viewBg.classList.remove('hidden');
      viewUp.classList.add('hidden');
    } else {
      btnUp.className = 'px-3.5 py-2 text-xs font-bold rounded-lg bg-cyan-neon text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]';
      btnBg.className = 'px-3.5 py-2 text-xs font-bold rounded-lg text-slate-300 hover:text-white';
      viewUp.classList.remove('hidden');
      viewBg.classList.add('hidden');
    }
    SFX.playClick();
  }

  function useLastImageForPhotoLab() {
    if (!STATE.image.lastGeneratedUrl) {
      showToast('لا توجد صورة سابقة للاستخدام!', 'warning');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (STATE.photoLab.subTab === 'bg-remover') {
        STATE.photoLab.bgSourceImage = img;
        STATE.photoLab.bgSourceFile = STATE.image.lastGeneratedBlob ? new File([STATE.image.lastGeneratedBlob], 'generated-image.png', { type: STATE.image.lastGeneratedBlob.type || 'image/png' }) : null;
        document.getElementById('bg-upload-img').src = STATE.image.lastGeneratedUrl;
        document.getElementById('bg-upload-preview').classList.remove('hidden');
        document.getElementById('bg-upload-empty').classList.add('hidden');
      } else {
        STATE.photoLab.upscaleSourceImage = img;
        STATE.photoLab.upscaleSourceFile = STATE.image.lastGeneratedBlob ? new File([STATE.image.lastGeneratedBlob], 'generated-image.png', { type: STATE.image.lastGeneratedBlob.type || 'image/png' }) : null;
        document.getElementById('upscale-upload-img').src = STATE.image.lastGeneratedUrl;
        document.getElementById('upscale-upload-preview').classList.remove('hidden');
        document.getElementById('upscale-upload-empty').classList.add('hidden');
      }
      SFX.playClick();
      showToast('تم تحميل الصورة بنجاح!', 'success');
    };
    img.src = STATE.image.lastGeneratedUrl;
  }

  function handleBgImageUpload(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        STATE.photoLab.bgSourceImage = img;
        STATE.photoLab.bgSourceFile = file;
        document.getElementById('bg-upload-img').src = e.target.result;
        document.getElementById('bg-upload-preview').classList.remove('hidden');
        document.getElementById('bg-upload-empty').classList.add('hidden');
        SFX.playSuccess();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function setBgMode(btnOrMode, maybeMode) {
    let mode = typeof btnOrMode === 'string' ? btnOrMode : (maybeMode || 'transparent');
    let btnEl = (btnOrMode && btnOrMode.nodeType) ? btnOrMode : (window.event && window.event.currentTarget) || null;
    STATE.photoLab.bgMode = mode;
    document.querySelectorAll('#bg-replace-options .bg-mode-btn').forEach(b => {
      b.classList.remove('active', 'border-pink-500/50', 'text-pink-neon');
      b.classList.add('border-white/10', 'text-slate-300');
    });
    if (btnEl) {
      btnEl.classList.add('active', 'border-pink-500/50', 'text-pink-neon');
      btnEl.classList.remove('border-white/10', 'text-slate-300');
    }
    SFX.playClick();
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
      for (let i = value.length - 1; i >= 0; i--) { const found = findGradioFile(value[i]); if (found) return found; }
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

  // AI background removal through the public BiRefNet Hugging Face Space.
  async function removeBackground() {
    if (!STATE.photoLab.bgSourceImage) {
      showToast('يرجى اختيار صورة أولاً لإزالة خلفيتها!', 'warning');
      return;
    }
    if (!await authorizeAndConsume('background_removal')) return;

    SFX.playLaser();
    const scanner = document.getElementById('bg-laser-scanner');
    const emptyState = document.getElementById('bg-result-empty');
    const canvas = document.getElementById('bg-canvas-result');
    const actionsBar = document.getElementById('bg-actions-bar');
    const statusPill = document.getElementById('bg-process-status');

    scanner.classList.remove('hidden');
    emptyState.classList.add('hidden');
    canvas.classList.add('hidden');
    actionsBar.classList.add('opacity-0', 'pointer-events-none');
    statusPill.textContent = 'جاري عزل العناصر...';

    const sourceImg = STATE.photoLab.bgSourceImage;
    try {
      statusPill.textContent = 'جاري الاتصال بنموذج BiRefNet...';
      const { Client, handle_file } = await import('https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js');
      const client = await Client.connect('ZhengPeng7/BiRefNet_demo');
      const file = await photoLabGradioFile(sourceImg, STATE.photoLab.bgSourceFile, 'photo.png');
      const result = await client.predict('/image', [await handle_file(file), '1024x1024', 'General']);
      const processedBlob = await gradioOutputBlob(result?.data);
      const cutoutImg = new Image();
      cutoutImg.src = URL.createObjectURL(processedBlob);
      await new Promise((resolve, reject) => { cutoutImg.onload = resolve; cutoutImg.onerror = reject; });
      const W = sourceImg.naturalWidth || sourceImg.width;
      const H = sourceImg.naturalHeight || sourceImg.height;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (STATE.photoLab.bgMode === 'transparent') ctx.drawImage(cutoutImg, 0, 0, W, H);
      else drawCutoutWithBg(ctx, cutoutImg, W, H, STATE.photoLab.bgMode);
      STATE.photoLab.bgResultBlob = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('تعذر تجهيز ملف PNG.')), 'image/png'));

      scanner.classList.add('hidden');
      canvas.classList.remove('hidden');
      actionsBar.classList.remove('opacity-0', 'pointer-events-none');
      statusPill.textContent = 'تم العزل بنجاح ✓';
      SFX.playSuccess();
      showToast('تمت إزالة الخلفية باستخدام BiRefNet!', 'success');

    } catch (err) {
      console.error(err);
      scanner.classList.add('hidden');
      emptyState.classList.remove('hidden');
      statusPill.textContent = 'تعذرت المعالجة';
      showToast(huggingFaceErrorMessage(err, 'تعذرت خدمة إزالة الخلفية. أعد المحاولة لاحقًا.'), 'error');
    }
  }

  function drawCutoutWithBg(ctx, cutoutImg, W, H, mode) {
    ctx.clearRect(0, 0, W, H);
    if (mode === 'cyberpunk') {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#05050A');
      grad.addColorStop(0.5, '#1A0B2E');
      grad.addColorStop(1, '#001A24');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      // Cyber neon lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
      ctx.lineWidth = 2;
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    } else if (mode === 'neon-solid') {
      ctx.fillStyle = '#0E1026';
      ctx.fillRect(0, 0, W, H);
      const radGrad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
      radGrad.addColorStop(0, 'rgba(0, 240, 255, 0.3)');
      radGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.drawImage(cutoutImg, 0, 0);
  }

  function downloadBgResult() {
    if (!STATE.photoLab.bgResultBlob) return;
    SFX.playClick();
    downloadBlob(STATE.photoLab.bgResultBlob, `mickey_cutout_${Date.now()}.png`);
    showToast('جاري تحميل الصورة المفرغة بدقة أصلية...', 'info');
  }

  // -----------------------------------------------------------------
  // 9. 4K UPSCALER & INTERACTIVE SPLIT COMPARISON SLIDER
  // -----------------------------------------------------------------
  function handleUpscaleImageUpload(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        STATE.photoLab.upscaleSourceImage = img;
        STATE.photoLab.upscaleSourceFile = file;
        document.getElementById('upscale-upload-img').src = e.target.result;
        document.getElementById('upscale-upload-preview').classList.remove('hidden');
        document.getElementById('upscale-upload-empty').classList.add('hidden');
        SFX.playSuccess();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function setUpscaleMultiplier(btnOrMul, maybeMul) {
    let mul = typeof btnOrMul === 'number' ? btnOrMul : (maybeMul || 2);
    let btnEl = (btnOrMul && btnOrMul.nodeType) ? btnOrMul : (window.event && window.event.currentTarget) || null;
    STATE.photoLab.upscaleMultiplier = mul;
    document.querySelectorAll('#upscale-multipliers .upscale-mul-btn').forEach(b => {
      b.classList.remove('active', 'border-cyan-500/40', 'text-cyan-neon');
      b.classList.add('border-white/10', 'text-slate-300');
    });
    if (btnEl) {
      btnEl.classList.add('active', 'border-cyan-500/40', 'text-cyan-neon');
      btnEl.classList.remove('border-white/10', 'text-slate-300');
    }
    SFX.playClick();
  }

  async function processUpscale() {
    if (!STATE.photoLab.upscaleSourceImage) {
      showToast('يرجى اختيار صورة أولاً لتكبيرها إلى 4K!', 'warning');
      return;
    }
    if (!await authorizeAndConsume('upscale')) return;

    SFX.playLaser();
    const scanner = document.getElementById('upscale-laser-scanner');
    const emptyState = document.getElementById('upscale-empty-state');
    const compareBox = document.getElementById('active-compare-container');
    const actionsBar = document.getElementById('upscale-actions-bar');
    const statusPill = document.getElementById('upscale-process-status');

    scanner.classList.remove('hidden');
    emptyState.classList.add('hidden');
    compareBox.classList.add('hidden');
    actionsBar.classList.add('opacity-0', 'pointer-events-none');
    statusPill.textContent = 'جاري تحسين التفاصيل بنموذج Real-ESRGAN...';

    const src = STATE.photoLab.upscaleSourceImage;
    const mul = STATE.photoLab.upscaleMultiplier;
    try {
      const { Client, handle_file } = await import('https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js');
      const client = await Client.connect('guetLzy/Real-ESRGAN-Demo');
      const file = await photoLabGradioFile(src, STATE.photoLab.upscaleSourceFile, 'photo.png');
      const model = document.getElementById('upscale-content-mode')?.value || 'RealESRGAN_x4plus';
      const result = await client.predict('/enhance', [await handle_file(file), model, mul, false]);
      const outputBlob = await gradioOutputBlob(result?.data);
      STATE.photoLab.upscaleResultBlob = outputBlob;
      const originalImg = document.getElementById('img-compare-original');
      const upscaledImg = document.getElementById('img-compare-upscaled');
      originalImg.src = src.src;
      upscaledImg.src = URL.createObjectURL(outputBlob);
      await new Promise((resolve, reject) => { upscaledImg.onload = resolve; upscaledImg.onerror = reject; });
      initCompareSlider();
      scanner.classList.add('hidden');
      compareBox.classList.remove('hidden');
      actionsBar.classList.remove('opacity-0', 'pointer-events-none');
      statusPill.textContent = `اكتمل تحسين الصورة ${mul}X ✓`;
      SFX.playSuccess();
      showToast(`اكتمل التحسين بالذكاء الاصطناعي: ${upscaledImg.naturalWidth}×${upscaledImg.naturalHeight}`, 'success');
    } catch (err) {
      console.error(err);
      scanner.classList.add('hidden');
      emptyState.classList.remove('hidden');
      statusPill.textContent = 'تعذرت المعالجة';
      showToast(huggingFaceErrorMessage(err, 'تعذرت خدمة التكبير. أعد المحاولة لاحقًا.'), 'error');
    }
  }

  function initCompareSlider() {
    const container = document.getElementById('active-compare-container');
    const wrapper = document.getElementById('wrapper-compare-upscaled');
    const handle = document.getElementById('handle-compare-slider');

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
    if (!STATE.photoLab.upscaleResultBlob) return;
    SFX.playClick();
    downloadBlob(STATE.photoLab.upscaleResultBlob, `mickey_upscale_${Date.now()}.png`);
    showToast('جاري تحميل الصورة المحسّنة...', 'info');
  }

  // -----------------------------------------------------------------
  // 10. STUDIO 4: AI VOICEOVER & AUDIO LAB
  // -----------------------------------------------------------------
  function generateAiScript() {
    SFX.playClick();
    const scripts = [
      'مرحباً بكم في ميكي ستوديو، الأفق الجديد للذكاء الاصطناعي. هنا حيث تتحول الأفكار إلى واقع سينمائي مبهر بلا حدود.',
      'في عالم يتسارع فيه الابتكار، تصنع الريادة بالقرارات الجريئة. استمتع بأقوى أدوات الإبداع الرقمي بين يديك الآن.',
      'هل تساءلت يوماً كيف تبدو مدن المستقبل؟ استكشف آفاق الخيال العلمي وحوّل رؤيتك الفنية إلى لوحات سينمائية فائقة الدقة.',
      'سواء كنت صانع محتوى، مصمماً، أو فناناً رقمياً، هذه المنصة هي محطتك المتكاملة للإنتاج الاحترافي مجاناً وبلا قيود.'
    ];
    const picked = scripts[Math.floor(Math.random() * scripts.length)];
    const textInput = document.getElementById('voice-text-input');
    if (textInput) textInput.value = picked;
    showToast('تم توليد سكريبت احترافي بالذكاء الاصطناعي!', 'success');
  }

  async function requestVoiceScriptRefinement(text, dialect) {
    const response = await gatewayFetch('refine_voiceover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, dialect }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || `تعذر تحسين النص (${response.status}).`);
    return String(data.refined || '').trim();
  }

  async function refineVoiceScript() {
    const input = document.getElementById('voice-text-input');
    const text = input?.value.trim() || '';
    if (!text) { showToast('اكتب النص الذي تريد تحسينه أولاً.', 'warning'); return; }
    if (text.length > 6000) { showToast('النص طويل جدًا. الحد الأقصى 6000 حرف.', 'warning'); return; }
    const button = document.getElementById('btn-refine-voice-script');
    if (button) button.disabled = true;
    try {
      const dialect = document.getElementById('voice-dialect-select')?.selectedOptions?.[0]?.textContent || 'المصرية';
      if (!await authorizeAndConsume('voiceover')) return;
      const refined = await requestVoiceScriptRefinement(text, dialect);
      if (!refined) throw new Error('لم تُرجع الخدمة نصًا محسنًا.');
      input.value = refined;
      showToast('تم تحسين النص للإلقاء. راجعه قبل إنشاء الصوت.', 'success');
    } catch (error) { showToast(error.message || 'تعذر تحسين النص.', 'error'); }
    finally { if (button) button.disabled = false; }
  }

  // Helper to format seconds as M:SS or H:MM:SS (matches screenshot style 0:00 / 52:29)
  function formatAudioTime(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const totalSec = Math.floor(seconds);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  let customPlayerInitialized = false;
  function setupCustomAudioPlayer(audioEl) {
    if (!audioEl) return;
    const playIcon = document.getElementById('icon-custom-play');
    const timeCurrent = document.getElementById('audio-time-current');
    const timeTotal = document.getElementById('audio-time-total');
    const waveformContainer = document.getElementById('waveform-container');

    audioEl.onplay = () => {
      if (playIcon) playIcon.className = 'fa-solid fa-pause text-sm';
    };

    audioEl.onpause = () => {
      if (playIcon) playIcon.className = 'fa-solid fa-play text-sm ml-0.5';
    };

    audioEl.onended = () => {
      if (playIcon) playIcon.className = 'fa-solid fa-play text-sm ml-0.5';
      if (!audioEl.loop && timeCurrent) {
        timeCurrent.textContent = formatAudioTime(0);
      }
    };

    audioEl.ontimeupdate = () => {
      if (timeCurrent) timeCurrent.textContent = formatAudioTime(audioEl.currentTime);
    };

    audioEl.onloadedmetadata = () => {
      if (timeTotal) timeTotal.textContent = formatAudioTime(audioEl.duration);
    };

    if (audioEl.duration && isFinite(audioEl.duration) && timeTotal) {
      timeTotal.textContent = formatAudioTime(audioEl.duration);
    }

    // Interactive waveform click & drag to seek
    if (!customPlayerInitialized && waveformContainer) {
      const handleSeek = (e) => {
        if (!audioEl.duration || !isFinite(audioEl.duration)) return;
        const rect = waveformContainer.getBoundingClientRect();
        const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        audioEl.currentTime = ratio * audioEl.duration;
        if (timeCurrent) timeCurrent.textContent = formatAudioTime(audioEl.currentTime);
      };

      waveformContainer.addEventListener('click', handleSeek);

      let isDragging = false;
      waveformContainer.addEventListener('mousedown', (e) => {
        isDragging = true;
        handleSeek(e);
      });
      window.addEventListener('mousemove', (e) => {
        if (isDragging) handleSeek(e);
      });
      window.addEventListener('mouseup', () => {
        if (isDragging) isDragging = false;
      });

      waveformContainer.addEventListener('touchstart', (e) => {
        handleSeek(e);
      }, { passive: true });
      waveformContainer.addEventListener('touchmove', (e) => {
        handleSeek(e);
      }, { passive: true });

      customPlayerInitialized = true;
    }
  }

  function toggleCustomPlay() {
    const audioEl = document.getElementById('final-rendered-audio');
    if (!audioEl) return;
    SFX.playClick();
    if (audioEl.paused) {
      if (audioEl.src && audioEl.src !== window.location.href) {
        audioEl.play().catch(e => {
          console.warn('Play error:', e);
          fallbackSpeakText();
        });
      } else {
        fallbackSpeakText();
      }
    } else {
      audioEl.pause();
      if ('speechSynthesis' in window) window.speechSynthesis.pause();
    }
  }

  function fallbackSpeakText() {
    const text = document.getElementById('voice-text-input')?.value.trim();
    if (text && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'ar-SA';
      const audioEl = document.getElementById('final-rendered-audio');
      setupAudioSpectrumVisualizer(audioEl);
      window.speechSynthesis.speak(utter);
      showToast('يتم تشغيل الصوت عبر محرك النطق 🔊', 'info');
    }
  }

  // Playback Speed Switcher (User requested)
  const AUDIO_SPEEDS = [1.0, 1.25, 1.5, 1.75, 2.0];
  let currentSpeedIdx = 0;
  function cycleAudioSpeed() {
    const audioEl = document.getElementById('final-rendered-audio');
    const speedBtn = document.getElementById('btn-audio-speed');
    currentSpeedIdx = (currentSpeedIdx + 1) % AUDIO_SPEEDS.length;
    const speed = AUDIO_SPEEDS[currentSpeedIdx];
    if (audioEl) audioEl.playbackRate = speed;
    if (speedBtn) speedBtn.textContent = `${speed.toFixed(speed % 1 === 0 ? 1 : 2)}x`;
    SFX.playClick();
    showToast(`سرعة التشغيل: ${speed}x ⚡`, 'info');
  }

  // Volume slider and mute toggle
  let previousAudioVolume = 1.0;
  function setVolume(val) {
    const audioEl = document.getElementById('final-rendered-audio');
    const volIcon = document.getElementById('volume-icon');
    const slider = document.getElementById('audio-volume-slider');
    const v = Math.max(0, Math.min(1, parseFloat(val)));
    if (audioEl) {
      audioEl.volume = v;
      audioEl.muted = (v === 0);
    }
    if (slider) slider.value = v;
    if (volIcon) {
      if (v === 0) {
        volIcon.className = 'fa-solid fa-volume-xmark text-xs text-rose-400';
      } else if (v < 0.5) {
        volIcon.className = 'fa-solid fa-volume-low text-xs text-zinc-300';
      } else {
        volIcon.className = 'fa-solid fa-volume-high text-xs text-zinc-300';
      }
    }
    if (v > 0) previousAudioVolume = v;
  }

  function toggleMute() {
    const audioEl = document.getElementById('final-rendered-audio');
    if (!audioEl) return;
    SFX.playClick();
    if (audioEl.muted || audioEl.volume === 0) {
      const restoreVol = previousAudioVolume > 0 ? previousAudioVolume : 1.0;
      setVolume(restoreVol);
      showToast('تم إلغاء كتم الصوت 🔊', 'info');
    } else {
      previousAudioVolume = audioEl.volume || 1.0;
      setVolume(0);
      showToast('تم كتم الصوت 🔇', 'info');
    }
  }

  // Skip Forward / Backward (User requested +10s specifically)
  function skipAudio(seconds) {
    const audioEl = document.getElementById('final-rendered-audio');
    if (!audioEl) return;
    SFX.playClick();
    const duration = audioEl.duration || 0;
    const newTime = Math.max(0, Math.min(duration, audioEl.currentTime + seconds));
    audioEl.currentTime = newTime;
    const timeCurrent = document.getElementById('audio-time-current');
    if (timeCurrent) timeCurrent.textContent = formatAudioTime(newTime);
    if (seconds > 0) {
      showToast(`تقديم +${seconds} ثوانٍ ⏩`, 'info');
    } else {
      showToast(`ترجيع ${seconds} ثوانٍ ⏪`, 'info');
    }
  }

  function toggleAudioLoop() {
    const audioEl = document.getElementById('final-rendered-audio');
    const loopBtn = document.getElementById('btn-audio-loop');
    if (!audioEl) return;
    SFX.playClick();
    audioEl.loop = !audioEl.loop;
    if (loopBtn) {
      if (audioEl.loop) {
        loopBtn.className = 'p-1.5 rounded-full text-sky-400 bg-sky-500/10 transition-colors';
        showToast('تم تفعيل التكرار التلقائي للمقطع 🔁', 'info');
      } else {
        loopBtn.className = 'p-1.5 rounded-full text-zinc-400 hover:text-zinc-200 transition-colors';
        showToast('تم إلغاء تكرار المقطع', 'info');
      }
    }
  }

  // Harmonic Sine Envelope Waveform Visualizer (Exact match with user screenshot)
  let spectrumAnimId = null;
  function setupAudioSpectrumVisualizer(audioEl) {
    const canvas = document.getElementById('audio-spectrum-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (spectrumAnimId) {
      cancelAnimationFrame(spectrumAnimId);
      spectrumAnimId = null;
    }

    const barsCount = 96;
    let wavePhase = 0;

    function renderFrame() {
      // Auto-adapt canvas width to parent width
      const container = canvas.parentElement;
      if (container && container.clientWidth > 0 && Math.abs(canvas.width - container.clientWidth) > 4) {
        canvas.width = container.clientWidth;
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const isPlaying = audioEl && !audioEl.paused;
      if (isPlaying) {
        wavePhase += 0.07;
      }

      const duration = (audioEl && isFinite(audioEl.duration) && audioEl.duration > 0) ? audioEl.duration : 1;
      const currentTime = audioEl ? (audioEl.currentTime || 0) : 0;
      const progressRatio = Math.max(0, Math.min(1, currentTime / duration));

      const centerY = h / 2;
      const minBarHeight = 3.5;
      const maxBarHeight = h * 0.82; // ~46px on 56px canvas
      const barWidth = 2.4;
      const step = (w - barWidth) / (barsCount - 1);

      for (let i = 0; i < barsCount; i++) {
        const u = i / (barsCount - 1); // 0.0 to 1.0
        const x = i * step;

        // Envelope: 4 symmetric nodes/antinodes using |sin(4 * PI * u)|
        const envelope = Math.pow(Math.abs(Math.sin(u * 4 * Math.PI)), 0.95);
        let barHeight = minBarHeight + envelope * (maxBarHeight - minBarHeight);

        // Dynamic harmonic breathing when playing
        if (isPlaying) {
          const breathing = 0.92 + 0.08 * Math.sin(wavePhase + u * 6.28);
          barHeight *= breathing;
        }

        const topY = centerY - (barHeight / 2);

        // Color split: white before progress head, translucent white after
        if (u <= progressRatio) {
          ctx.fillStyle = '#ffffff';
          if (isPlaying) {
            ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';
            ctx.shadowBlur = 4;
          } else {
            ctx.shadowBlur = 0;
          }
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.shadowBlur = 0;
        }

        // Draw pill-shaped vertical line (rounded caps)
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, topY, barWidth, barHeight, barWidth / 2);
        } else {
          ctx.rect(x, topY, barWidth, barHeight);
        }
        ctx.fill();
      }

      spectrumAnimId = requestAnimationFrame(renderFrame);
    }

    renderFrame();
  }

  // =================================================================
  // SAVIO STUDIO PERSONAS & VOICE GALLERY
  // =================================================================
  const VOICE_PERSONAS = {
    male: [
      { id: 'yusuf', name: 'يوسف', role: 'وثائقي قوي', fullName: 'يوسف · وثائقي قوي', tags: ['عميق', 'رزين', 'موثوق'], previewText: 'أهلاً بكم في هذا الوثائقي، حيث نكتشف أسرار الحضارة وعظمة التاريخ.' },
      { id: 'malik', name: 'مالك', role: 'إعلان وتسويق', fullName: 'مالك · إعلاني سريع', tags: ['سريع', 'واثق', 'حماسي', 'مقنع'], previewText: 'عرض خاص وحصري! اشترك الآن واستمتع بأقوى المزايا بأفضل جودة.' },
      { id: 'rami', name: 'رامي', role: 'بودكاست هادئ', fullName: 'رامي · بودكاست هادئ', tags: ['تفاعلي', 'حيوي', 'عفوي', 'ودود'], previewText: 'مرحباً أصدقائي في حلقة اليوم، حديثنا شيق ومليء بالأفكار الملهمة.' },
      { id: 'saif', name: 'سيف', role: 'درامي عاطفي', fullName: 'سيف · درامي عاطفي', tags: ['تعبير مؤثر', 'مشاعر متدفقة'], previewText: 'في تلك اللحظة الحاسمة، أدركت أن كل شيء كان على وشك التغير للأبد.' },
      { id: 'zaid', name: 'زيد', role: 'راوٍ قصصي', fullName: 'زيد · راوٍ قصصي', tags: ['سردي', 'مشوق', 'دافئ'], previewText: 'كان يا ما كان في قديم الزمان، قصة تروى عبر الأجيال بحكمة وجمال.' },
      { id: 'neutral', name: 'متوازن', role: 'متوازن وطبيعي', fullName: 'متوازن · طبيعي وواضح', tags: ['طبيعي', 'واضح', 'متزن'], previewText: 'أهلاً بكم، نقدم لكم هذا المحتوى بنبرة واضحة ومناسبة لمختلف الأعمال.' },
    ],
    female: [
      { id: 'mariam', name: 'مريم', role: 'صوت قصصي', fullName: 'مريم · صوت قصصي', tags: ['هادئ', 'متزن', 'عاطفي', 'دافئ'], previewText: 'كانت الليالي هادئة في تلك المدينة القديمة، وتحمل بين أزقتها حكايات لا تُنسى.' },
      { id: 'laila', name: 'ليلى', role: 'إعلان وتسويق', fullName: 'ليلى · إعلان وتسويق', tags: ['سريع', 'واثق', 'حماسي', 'مقنع'], previewText: 'اكتشف الفرق الحقيقي اليوم! جودة استثنائية وأداء لا يقارن، لا تفوت الفرصة.' },
      { id: 'sama', name: 'سما', role: 'بودكاست ومحتوى اجتماعي', fullName: 'سما · بودكاست ومحتوى اجتماعي', tags: ['تفاعلي', 'حيوي', 'عفوي', 'ودود'], previewText: 'يا هلا ومرحب! سعيدة أشارككم اليوم تجربة فريدة وممتعة للغاية.' },
      { id: 'salma', name: 'سلمى', role: 'درامي عاطفي', fullName: 'سلمى · درامي عاطفي', tags: ['تعبير مؤثر', 'مشاعر متدفقة'], previewText: 'لم تكن مجرد صدفة عابرة، بل كانت لحظة مصيرية قلبت كل الموازين.' },
      { id: 'farida', name: 'فريدة', role: 'وثائقي رصين', fullName: 'فريدة · وثائقي رصين', tags: ['عميق', 'رزين', 'حضور قوي'], previewText: 'تشير السجلات التاريخية إلى بداية عصر جديد غيّر ملامح المنطقة بالكامل.' },
      { id: 'neutral', name: 'متوازنة', role: 'متوازنة وطبيعية', fullName: 'متوازنة · طبيعي وواضح', tags: ['طبيعي', 'واضح', 'متزنة'], previewText: 'مرحباً بكم، نقدم لكم هذا التقرير بأداء صوتي طبيعي ومريح للمستمع.' },
    ]
  };

  let currentPreviewAudio = null;
  let activePlayingPersonaId = null;

  function onVoiceGenderChanged() {
    const genderSelect = document.getElementById('voice-gender-select');
    const perfSelect = document.getElementById('voice-performance-select');
    if (!genderSelect || !perfSelect) return;
    
    const gender = genderSelect.value || 'male';
    const list = VOICE_PERSONAS[gender] || VOICE_PERSONAS.male;
    const currentVal = perfSelect.value;
    
    perfSelect.innerHTML = list.map((p, idx) => 
      `<option value="${p.id}" ${p.id === currentVal || (!list.some(x => x.id === currentVal) && idx === 0) ? 'selected' : ''}>${p.fullName}</option>`
    ).join('');

    filterVoiceGallery(gender);
  }

  function filterVoiceGallery(filter = 'all') {
    const btnAll = document.getElementById('btn-filter-all');
    const btnMale = document.getElementById('btn-filter-male');
    const btnFemale = document.getElementById('btn-filter-female');
    [btnAll, btnMale, btnFemale].forEach(b => {
      if (b) {
        b.className = 'px-3 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors';
      }
    });

    const activeBtn = filter === 'male' ? btnMale : filter === 'female' ? btnFemale : btnAll;
    if (activeBtn) {
      activeBtn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors';
    }

    renderVoiceGallery(filter);
  }

  function renderVoiceGallery(filter = 'all') {
    const grid = document.getElementById('voice-gallery-cards-grid');
    if (!grid) return;

    let personasToShow = [];
    if (filter === 'all') {
      const f = VOICE_PERSONAS.female.map(p => ({ ...p, gender: 'female' }));
      const m = VOICE_PERSONAS.male.map(p => ({ ...p, gender: 'male' }));
      personasToShow = [...f, ...m];
    } else if (filter === 'female') {
      personasToShow = VOICE_PERSONAS.female.map(p => ({ ...p, gender: 'female' }));
    } else {
      personasToShow = VOICE_PERSONAS.male.map(p => ({ ...p, gender: 'male' }));
    }

    const currentGender = document.getElementById('voice-gender-select')?.value || 'male';
    const currentPerf = document.getElementById('voice-performance-select')?.value || 'neutral';

    grid.innerHTML = personasToShow.map(p => {
      const isSelected = p.gender === currentGender && p.id === currentPerf;
      const isFemale = p.gender === 'female';
      const avatarBg = isFemale ? 'from-rose-500/20 to-purple-500/20 text-rose-300 border-rose-500/30' : 'from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/30';
      const isPlaying = activePlayingPersonaId === `${p.gender}_${p.id}`;

      return `
        <div onclick="MickeyStudio.selectPersonaFromGallery('${p.id}', '${p.gender}')" 
             class="p-3.5 rounded-2xl bg-zinc-900/50 border ${isSelected ? 'border-cyan-400 ring-1 ring-cyan-400/50 bg-cyan-950/20' : 'border-white/5 hover:border-white/20'} transition-all cursor-pointer flex flex-col justify-between space-y-3 group relative">
          
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${avatarBg} border flex items-center justify-center font-bold text-sm shadow-inner">
                ${p.name.slice(0, 1)}
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <h4 class="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">${p.name}</h4>
                  <span class="text-[9px] px-1.5 py-0.2 rounded font-mono ${isFemale ? 'bg-rose-500/10 text-rose-300' : 'bg-cyan-500/10 text-cyan-300'}">${isFemale ? 'أنثى' : 'ذكر'}</span>
                </div>
                <p class="text-[10px] text-zinc-400 mt-0.5">${p.role}</p>
              </div>
            </div>

            <button type="button" 
                    onclick="event.stopPropagation(); MickeyStudio.playPersonaPreview('${p.id}', '${p.gender}')" 
                    class="w-8 h-8 rounded-full ${isPlaying ? 'bg-emerald-500 text-black animate-pulse' : 'bg-white/5 hover:bg-emerald-500 hover:text-black text-zinc-300'} border border-white/10 flex items-center justify-center transition-all shadow-sm"
                    title="استمع للمعاينة">
              <i class="fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-[10px] ${isPlaying ? '' : 'ml-0.5'}"></i>
            </button>
          </div>

          <div class="flex flex-wrap gap-1">
            ${p.tags.map(t => `<span class="text-[9px] px-2 py-0.5 rounded-md bg-white/[0.03] text-zinc-400 border border-white/5">${t}</span>`).join('')}
          </div>

          <div class="text-[10px] text-zinc-500 line-clamp-1 italic">
            "${p.previewText}"
          </div>
        </div>
      `;
    }).join('');
  }

  function selectPersonaFromGallery(personaId, gender) {
    const genderSelect = document.getElementById('voice-gender-select');
    if (genderSelect) genderSelect.value = gender;
    
    const perfSelect = document.getElementById('voice-performance-select');
    const list = VOICE_PERSONAS[gender] || VOICE_PERSONAS.male;
    if (perfSelect) {
      perfSelect.innerHTML = list.map(p => 
        `<option value="${p.id}" ${p.id === personaId ? 'selected' : ''}>${p.fullName}</option>`
      ).join('');
      perfSelect.value = personaId;
    }

    renderVoiceGallery(gender);
    SFX.playClick();
    const pObj = (VOICE_PERSONAS[gender] || []).find(x => x.id === personaId);
    showToast(`تم اختيار شخصية: ${pObj?.fullName || personaId}`, 'success');
  }

  async function playPersonaPreview(personaId, gender) {
    const key = `${gender}_${personaId}`;
    if (activePlayingPersonaId === key && currentPreviewAudio) {
      currentPreviewAudio.pause();
      currentPreviewAudio = null;
      activePlayingPersonaId = null;
      renderVoiceGallery(document.getElementById('voice-gender-select')?.value || 'all');
      return;
    }

    if (currentPreviewAudio) {
      currentPreviewAudio.pause();
      currentPreviewAudio = null;
    }

    const pObj = (VOICE_PERSONAS[gender] || []).find(x => x.id === personaId) || {};
    const phrase = pObj.previewText || 'مرحباً بكم، هذا نموذج صوتي واقعي بالذكاء الاصطناعي.';
    activePlayingPersonaId = key;
    renderVoiceGallery(document.getElementById('voice-gender-select')?.value || 'all');

    try {
      const engine = document.getElementById('voice-engine-select')?.value || 'gemini';
      const geminiKey = document.getElementById('voice-gemini-key-input')?.value.trim() || localStorage.getItem('mickey_gemini_key') || '';
      
      const res = await gatewayFetch('generate_tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: phrase,
          performance: personaId,
          gender: gender,
          dialect: document.getElementById('voice-dialect-select')?.value || 'egyptian',
          engine: engine,
          geminiKey: geminiKey
        })
      });

      if (!res.ok) throw new Error('فشل توليد المعاينة');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      currentPreviewAudio = new Audio(url);
      currentPreviewAudio.onended = () => {
        activePlayingPersonaId = null;
        renderVoiceGallery(document.getElementById('voice-gender-select')?.value || 'all');
      };
      currentPreviewAudio.play();
    } catch (e) {
      console.warn('[Persona Preview]', e);
      activePlayingPersonaId = null;
      renderVoiceGallery(document.getElementById('voice-gender-select')?.value || 'all');
      showToast('تعذر تشغيل المعاينة، تحقق من الاتصال أو مفتاح Gemini', 'warning');
    }
  }

  function concatWavBuffers(buffers) {
    if (buffers.length === 1) return new Blob([buffers[0]], { type: 'audio/wav' });
    
    const firstView = new DataView(buffers[0]);
    const isWav = buffers[0].byteLength >= 44 && 
                  String.fromCharCode(firstView.getUint8(0), firstView.getUint8(1), firstView.getUint8(2), firstView.getUint8(3)) === 'RIFF';

    if (!isWav) {
      return new Blob(buffers, { type: 'audio/mpeg' });
    }

    let totalDataLen = 0;
    const pcmChunks = [];
    for (const buf of buffers) {
      if (buf.byteLength > 44) {
        const pcm = buf.slice(44);
        pcmChunks.push(pcm);
        totalDataLen += pcm.byteLength;
      }
    }

    const newHeader = new Uint8Array(buffers[0].slice(0, 44));
    const headerView = new DataView(newHeader.buffer);
    headerView.setUint32(4, 36 + totalDataLen, true);
    headerView.setUint32(40, totalDataLen, true);

    return new Blob([newHeader, ...pcmChunks], { type: 'audio/wav' });
  }

  // -----------------------------------------------------------------
  // PODCAST STUDIO (DUAL-SPEAKER MULTI-TURN SYNTHESIS)
  // -----------------------------------------------------------------
  async function generatePodcastScript() {
    const topicInput = document.getElementById('podcast-topic-input');
    const topic = topicInput?.value.trim() || 'الذكاء الاصطناعي في صناعة الفيديو والمونتاج';
    const s1Name = document.getElementById('podcast-speaker1-name')?.value || 'المحاور';
    const s2Name = document.getElementById('podcast-speaker2-name')?.value || 'الضيف';
    const btn = document.getElementById('btn-gen-podcast-script');
    if (btn) btn.disabled = true;

    try {
      showToast('جاري تأليف حوار البودكاست الذكي...', 'info');
      const prompt = `اكتب سيناريو حلقة بودكاست حوارية عربية قصيرة وشيقة بين "${s1Name}" و "${s2Name}" حول موضوع: "${topic}".
اكتب كل دور في سطر منفصل يبدأ بـ "${s1Name}: " أو "${s2Name}: ".
الحوار يتكون من 4 إلى 6 أسطر فقط، طبيعي وواقعي وممتع. لا تكتب أي مقدمات أو ملاحظات خارجية.`;

      const res = await gatewayFetch('generate_text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: false })
      });

      if (res.ok) {
        const data = await res.json();
        const script = data.text || data.response || data.content;
        if (script) {
          document.getElementById('podcast-dialog-input').value = script.trim();
          showToast('تم تأليف سيناريو البودكاست بنجاح!', 'success');
          return;
        }
      }
      throw new Error('Fallback needed');
    } catch (e) {
      document.getElementById('podcast-dialog-input').value = 
`${s1Name}: مرحباً بكم في حلقة جديدة من البودكاست، وحديثنا اليوم عن ${topic}.
${s2Name}: أهلاً بك يا ${s1Name}، سعيد جداً بتواجدي معكم لمناقشة هذا التطور المذهل.
${s1Name}: ما هي أبرز التقنيات التي تراها الأكثر تأثيراً على صناع المحتوى الآن؟
${s2Name}: بلا شك، نماذج الصوت والذكاء الاصطناعي التي تختصر ساعات العمل في ثوانٍ معدودة.
${s1Name}: شكراً لك على هذه الرؤية الملهمة، وإلى لقاء قريب في الحلقة القادمة.`;
      showToast('تم إدراج نموذج حوار بودكاست جاهز!', 'success');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  let STATE_PODCAST = { lastAudioBlob: null, lastAudioUrl: null };

  async function generatePodcastAudio() {
    const textInput = document.getElementById('podcast-dialog-input');
    const script = textInput?.value.trim();
    if (!script) {
      showToast('يرجى كتابة أو توليد سيناريو الحوار أولاً!', 'warning');
      return;
    }

    const s1Name = (document.getElementById('podcast-speaker1-name')?.value || 'المحاور').trim();
    const s2Name = (document.getElementById('podcast-speaker2-name')?.value || 'الضيف').trim();
    const s1Voice = document.getElementById('podcast-speaker1-voice')?.value || 'rami';
    const s2Voice = document.getElementById('podcast-speaker2-voice')?.value || 'mariam';
    const dialect = document.getElementById('podcast-dialect-select')?.value || 'egyptian';
    const engine = document.getElementById('podcast-engine-select')?.value || 'gemini';
    const geminiKey = document.getElementById('voice-gemini-key-input')?.value.trim() || localStorage.getItem('mickey_gemini_key') || '';

    const btn = document.getElementById('btn-generate-podcast');
    btn.disabled = true;
    showToast('جاري إنتاج أصوات المتحاورين ودمج الحلقة...', 'info');

    try {
      const lines = script.split('\n').map(l => l.trim()).filter(Boolean);
      const audioBuffers = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let speakerVoice = s1Voice;
        let speakerGender = ['mariam', 'laila', 'sama', 'salma', 'farida'].includes(s1Voice) ? 'female' : 'male';
        let cleanText = line;

        if (line.startsWith(s2Name) || line.startsWith('الضيف')) {
          speakerVoice = s2Voice;
          speakerGender = ['mariam', 'laila', 'sama', 'salma', 'farida'].includes(s2Voice) ? 'female' : 'male';
          cleanText = line.replace(new RegExp(`^${s2Name}\\s*[:：]\\s*`, 'i'), '').replace(/^الضيف\s*[:：]\\s*/i, '');
        } else if (line.startsWith(s1Name) || line.startsWith('المحاور')) {
          cleanText = line.replace(new RegExp(`^${s1Name}\\s*[:：]\\s*`, 'i'), '').replace(/^المحاور\s*[:：]\\s*/i, '');
        }

        if (!cleanText.trim()) continue;

        const res = await gatewayFetch('generate_tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanText,
            performance: speakerVoice,
            gender: speakerGender,
            dialect,
            engine,
            geminiKey
          })
        });

        if (!res.ok) throw new Error(`فشل توليد مقطع: ${cleanText.slice(0, 20)}`);
        const ab = await res.arrayBuffer();
        audioBuffers.push(ab);
      }

      if (audioBuffers.length === 0) throw new Error('لم يتم استخراج أي أسطر صوتية من الحوار.');

      const unifiedBlob = concatWavBuffers(audioBuffers);
      const url = URL.createObjectURL(unifiedBlob);
      STATE_PODCAST.lastAudioBlob = unifiedBlob;
      STATE_PODCAST.lastAudioUrl = url;

      const playerCard = document.getElementById('podcast-active-player');
      const emptyView = document.getElementById('podcast-empty-view');
      const audioEl = document.getElementById('podcast-audio-element');

      if (emptyView) emptyView.classList.add('hidden');
      if (playerCard) playerCard.classList.remove('hidden');
      if (audioEl) {
        audioEl.src = url;
        audioEl.play().catch(() => {});
      }

      showToast('تم إنتاج حلقة البودكاست الثنائية بنجاح!', 'success');
    } catch (err) {
      console.error('[Podcast Gen]', err);
      showToast(err.message || 'تعذر إنتاج حلقة البودكاست.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function downloadPodcastAudio() {
    if (!STATE_PODCAST.lastAudioUrl) return;
    const a = document.createElement('a');
    a.href = STATE_PODCAST.lastAudioUrl;
    a.download = `podcast_${Date.now()}.wav`;
    a.click();
  }

  async function savePodcastToVault() {
    if (!STATE_PODCAST.lastAudioUrl) return;
    const asset = {
      id: 'podcast_' + Date.now(),
      type: 'audio',
      title: 'حلقة بودكاست: ' + (document.getElementById('podcast-topic-input')?.value || 'محادثة ثنائية').slice(0, 30),
      url: STATE_PODCAST.lastAudioUrl,
      prompt: 'بودكاست ثنائي متحدثين',
      timestamp: Date.now()
    };
    await saveAssetToDB(asset);
    showToast('تم حفظ البودكاست في المعرض!', 'success');
  }

  // -----------------------------------------------------------------
  // AUDIOBOOK STUDIO (CHAPTER-BASED NARRATIVE SYNTHESIS)
  // -----------------------------------------------------------------
  let STATE_AUDIOBOOK = { lastAudioBlob: null, lastAudioUrl: null };

  async function generateAudiobookChapter() {
    const textInput = document.getElementById('book-chapter-text');
    const text = textInput?.value.trim();
    if (!text) {
      showToast('يرجى إدخال نص الفصل المراد تسجيله!', 'warning');
      return;
    }

    const bookTitle = document.getElementById('book-title-input')?.value.trim() || 'رواية جديدة';
    const chapterTitle = document.getElementById('chapter-title-input')?.value.trim() || 'الفصل الأول';
    const narrator = document.getElementById('book-narrator-select')?.value || 'mariam';
    const gender = ['mariam', 'farida', 'salma'].includes(narrator) ? 'female' : 'male';
    const mood = document.getElementById('book-mood-select')?.value || 'mystery';
    const pace = Number(document.getElementById('book-pace-select')?.value) || 1.0;
    const engine = document.getElementById('voice-engine-select')?.value || 'gemini';
    const geminiKey = document.getElementById('voice-gemini-key-input')?.value.trim() || localStorage.getItem('mickey_gemini_key') || '';

    const btn = document.getElementById('btn-generate-audiobook');
    btn.disabled = true;
    showToast('جاري تسجيل الفصل الصوتي بصوت الراوي المختار...', 'info');

    try {
      const res = await gatewayFetch('generate_tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          performance: narrator,
          gender,
          dialect: 'fusha',
          rate: pace,
          engine,
          geminiKey,
          style: `Audiobook chapter reading for "${bookTitle} - ${chapterTitle}". Atmospheric mood: ${mood}. Professional literary storytelling narration with proper dramatic pauses.`
        })
      });

      if (!res.ok) throw new Error('فشل تسجيل الفصل الصوتي.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      STATE_AUDIOBOOK.lastAudioBlob = blob;
      STATE_AUDIOBOOK.lastAudioUrl = url;

      const playerCard = document.getElementById('audiobook-active-player');
      const emptyView = document.getElementById('audiobook-empty-view');
      const audioEl = document.getElementById('audiobook-audio-element');
      const bookEl = document.getElementById('audiobook-player-book');
      const chapEl = document.getElementById('audiobook-player-chapter');

      if (emptyView) emptyView.classList.add('hidden');
      if (playerCard) playerCard.classList.remove('hidden');
      if (bookEl) bookEl.textContent = bookTitle;
      if (chapEl) chapEl.textContent = chapterTitle;
      if (audioEl) {
        audioEl.src = url;
        audioEl.play().catch(() => {});
      }

      showToast(`تم إنتاج الفصل "${chapterTitle}" بنجاح!`, 'success');
    } catch (e) {
      console.error('[Audiobook Gen]', e);
      showToast(e.message || 'تعذر إنتاج الفصل الصوتي.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function downloadAudiobookAudio() {
    if (!STATE_AUDIOBOOK.lastAudioUrl) return;
    const bookTitle = document.getElementById('book-title-input')?.value.trim() || 'Audiobook';
    const a = document.createElement('a');
    a.href = STATE_AUDIOBOOK.lastAudioUrl;
    a.download = `${bookTitle}_${Date.now()}.wav`;
    a.click();
  }

  async function saveAudiobookToVault() {
    if (!STATE_AUDIOBOOK.lastAudioUrl) return;
    const bookTitle = document.getElementById('book-title-input')?.value.trim() || 'كتاب صوتي';
    const chapTitle = document.getElementById('chapter-title-input')?.value.trim() || 'الفصل';
    const asset = {
      id: 'audiobook_' + Date.now(),
      type: 'audio',
      title: `${bookTitle} · ${chapTitle}`,
      url: STATE_AUDIOBOOK.lastAudioUrl,
      prompt: 'كتاب صوتي ورواية',
      timestamp: Date.now()
    };
    await saveAssetToDB(asset);
    showToast('تم حفظ الفصل في المعرض!', 'success');
  }

  // -----------------------------------------------------------------
  // VOICE OVER GENERATION
  // -----------------------------------------------------------------
  async function generateVoiceover() {
    const textInput = document.getElementById('voice-text-input');
    const text = textInput ? textInput.value.trim() : '';
    if (!text) { showToast('يرجى كتابة نص لتوليد التعليق الصوتي!', 'warning'); return; }
    if (text.length > 6000) { showToast('النص طويل جدًا. الحد الأقصى 6000 حرف لكل ملف صوتي.', 'warning'); return; }
    if (!await authorizeAndConsume('voiceover')) return;

    const button = document.getElementById('btn-generate-voice');
    const scanner = document.getElementById('voice-laser-scanner');
    const emptyState = document.getElementById('voice-empty-state');
    const activeControls = document.getElementById('voice-active-controls');
    const actionsBar = document.getElementById('voice-actions-bar');
    const statusPill = document.getElementById('voice-process-status');
    const audioEl = document.getElementById('final-rendered-audio');
    const rate = Number(document.getElementById('voice-rate-slider')?.value) || 1;
    const pitch = Number(document.getElementById('voice-pitch-slider')?.value) || 1;
    const dialectSelect = document.getElementById('voice-dialect-select');
    const dialect = dialectSelect?.value || 'egyptian';
    const dialectLabel = dialectSelect?.selectedOptions?.[0]?.textContent || 'المصرية';
    const gender = document.getElementById('voice-gender-select')?.value || 'male';
    const genderLabel = gender === 'female' ? 'نسائي' : 'رجالي';
    const age = document.getElementById('voice-age-select')?.value || 'adult';
    const performance = document.getElementById('voice-performance-select')?.value || 'neutral';
    const warmth = document.getElementById('voice-warmth-select')?.value || 'balanced';
    const emotion = document.getElementById('voice-emotion-select')?.value || 'medium';
    const intensity = document.getElementById('voice-intensity-select')?.value || 'medium';
    const voices = {
      yusuf: ['Charon', 'Kore', 'authoritative documentary narration, deep, measured, and confident'],
      malik: ['Puck', 'Sadachbia', 'bright, energetic commercial delivery with clear articulation'],
      rami: ['Iapetus', 'Aoede', 'warm, natural, conversational podcast delivery'],
      saif: ['Fenrir', 'Sulafat', 'dramatic, emotionally engaging narration with controlled intensity'],
      zaid: ['Rasalgethi', 'Vindemiatrix', 'expressive storytelling, vivid and steady'],
      mariam: ['Rasalgethi', 'Vindemiatrix', 'expressive, warm storytelling narration with serene pacing'],
      laila: ['Puck', 'Sadachbia', 'bright, fast, confident commercial and marketing delivery'],
      sama: ['Iapetus', 'Aoede', 'lively, friendly, natural podcast and social media delivery'],
      salma: ['Fenrir', 'Sulafat', 'deeply emotional and expressive dramatic delivery'],
      farida: ['Charon', 'Kore', 'poised, authoritative documentary narration with deep presence'],
      neutral: ['Orus', 'Schedar', 'balanced, natural, and clear delivery'],
    };
    const dialects = { egyptian: 'Egyptian Arabic', saudi: 'Saudi Arabic', levantine: 'Levantine Arabic', iraqi: 'Iraqi Arabic', algerian: 'Algerian Arabic', moroccan: 'Moroccan Arabic', tunisian: 'Tunisian Arabic', gulf: 'Gulf Arabic', fusha: 'Modern Standard Arabic' };
    const performanceInfo = voices[performance] || voices.neutral;
    const voice = gender === 'female' ? performanceInfo[1] : performanceInfo[0];
    const ageStyle = ({ adult: 'adult', senior: 'older adult', cartoon: 'animated character' })[age] || 'adult';
    const warmthStyle = ({ cool: 'cool and composed', balanced: 'balanced warmth', warm: 'warm and human' })[warmth] || 'balanced warmth';
    const emotionStyle = ({ calm: 'calm and restrained', medium: 'moderately expressive', strong: 'highly expressive' })[emotion] || 'moderately expressive';
    const intensityStyle = ({ light: 'subtle dramatic intensity', medium: 'moderate dramatic intensity', strong: 'strong dramatic intensity' })[intensity] || 'moderate dramatic intensity';
    const style = `Speak in ${dialects[dialect] || dialects.egyptian}, with a ${gender === 'female' ? 'feminine' : 'masculine'} ${ageStyle} voice. Use ${performanceInfo[2]}; be ${warmthStyle} and ${emotionStyle}, with ${intensityStyle}. Pace ${rate < 0.9 ? 'slowly' : rate > 1.1 ? 'briskly' : 'at a natural pace'} (${rate.toFixed(2)}x), with a ${pitch < 0.9 ? 'lower' : pitch > 1.1 ? 'higher' : 'natural'} pitch. Read the supplied Arabic text verbatim; do not translate it or say these directions aloud.`;

    const speakerBadge = document.getElementById('player-speaker-badge');
    if (speakerBadge) speakerBadge.textContent = `${dialectLabel} · صوت ${genderLabel}`;
    SFX.playLaser();
    button.disabled = true;
    scanner.classList.remove('hidden');
    emptyState.classList.add('hidden');
    activeControls.classList.add('hidden');
    if (actionsBar) actionsBar.classList.add('opacity-0', 'pointer-events-none');
    
    const engine = document.getElementById('voice-engine-select')?.value || 'gemini';
    const geminiKey = localStorage.getItem('mickey_gemini_key') || '';

    statusPill.textContent = engine === 'gemini' ? 'جاري التوليد عبر استوديو Gemini 3.8 Flash TTS…' : 'جاري التوليد عبر Edge Neural TTS السريع…';
    try {
      const response = await gatewayFetch('generate_tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, voice, style, rate, pitch, dialect, gender, performance, age, warmth, emotion, intensity,
          engine,
          geminiKey,
          apiKey: geminiKey,
          model: 'gemini-3.8-flash-tts',
          input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style }] }] }],
          response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
          generation_config: { speech_config: [{ voice }] },
        }),
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        const errorData = contentType.includes('json') ? await response.json().catch(() => ({})) : {};
        throw new Error(errorData.error?.message || errorData.error || `تعذر إنشاء الصوت من الخادم (${response.status}).`);
      }
      let bytes;
      let respJson = null;
      if (contentType.startsWith('audio/')) {
        bytes = new Uint8Array(await response.arrayBuffer());
      } else {
        respJson = await response.json().catch(() => ({}));
        const audioData = respJson.output_audio?.data || respJson._media_base64 || respJson.base64Data || (respJson.steps || []).flatMap(step => step.content || []).reverse().find(item => item.type === 'audio' && item.data)?.data;
        if (!audioData) throw new Error(respJson.error || 'لم يُرجع الخادم بيانات صوتية صالحة.');
        bytes = Uint8Array.from(atob(audioData), char => char.charCodeAt(0));
      }
      const isWav = bytes.length > 100 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WAVE';
      const isMp3 = bytes.length > 100 && (
        contentType.includes('mpeg') || contentType.includes('mp3') ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) ||
        (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)
      );
      if (!isWav && !isMp3 && bytes.length < 100) throw new Error('ملف الصوت غير صالح.');

      const audioMime = isWav ? 'audio/wav' : 'audio/mpeg';
      const generatedBlob = new Blob([bytes], { type: audioMime });
      if (STATE.voice.lastAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(STATE.voice.lastAudioUrl);
      const generatedUrl = URL.createObjectURL(generatedBlob);
      STATE.voice.lastAudioBlob = generatedBlob;
      STATE.voice.lastAudioUrl = generatedUrl;
      audioEl.src = generatedUrl;
      audioEl.load();
      scanner.classList.add('hidden');
      activeControls.classList.remove('hidden');
      if (actionsBar) actionsBar.classList.remove('opacity-0', 'pointer-events-none');
      
      const engineUsed = respJson?.engine_used || (isWav ? 'gemini' : 'neural');
      const isGeminiEngine = engineUsed === 'gemini';
      const engineTitle = isGeminiEngine ? 'Gemini 3.8 Flash TTS' : 'Edge Neural TTS';
      statusPill.textContent = `اكتمل · ${engineTitle} · ${dialectLabel} · ${genderLabel}`;
      
      setupCustomAudioPlayer(audioEl);
      setupAudioSpectrumVisualizer(audioEl);
      audioEl.play().catch(() => {});
      const optionCustom = document.getElementById('option-custom-voiceover');
      if (optionCustom) { optionCustom.disabled = false; optionCustom.textContent = 'التعليق الصوتي المولد حديثاً ✓'; }
      SFX.playSuccess();
      showToast(respJson?.engine_note || `تم توليد التعليق الصوتي بنجاح عبر ${engineTitle}!`, 'success');
    } catch (error) {
      scanner.classList.add('hidden');
      emptyState.classList.remove('hidden');
      statusPill.textContent = 'تعذر إنشاء الملف';
      showToast(error.message || 'تعذر إنشاء التعليق الصوتي.', 'error');
    } finally { button.disabled = false; }
  }

  function onVoiceEngineChanged() {
    const engine = document.getElementById('voice-engine-select')?.value || 'gemini';
    const badge = document.getElementById('voice-engine-badge');
    const descHint = document.getElementById('voice-engine-desc-hint');
    if (badge) {
      badge.textContent = engine === 'gemini' ? 'WAV استوديو سينمائي (افتراضي)' : 'Edge Neural TTS (مجاني بلا حدود)';
      badge.className = `text-[10px] font-mono ${engine === 'gemini' ? 'text-cyan-400' : 'text-sky-400'}`;
    }
    if (descHint) {
      descHint.textContent = engine === 'gemini'
        ? 'يستخدم Gemini 3.8 Flash TTS لتوليد WAV بنبرة ولهجة وأداء موجّه فائق الدقة (مدار تلقائياً عبر مفاتيح الخادم النشطة مع التدوير الذاتي).'
        : 'يستخدم محرك Microsoft Edge Neural TTS لتوليد صوت طبيعي فوري ومجاني 100% بدون استهلاك رصيد.';
    }
  }

  async function saveGeminiKeyFromVoiceStudio() {
    const input = document.getElementById('voice-gemini-key-input');
    const status = document.getElementById('voice-gemini-key-status');
    const val = input ? input.value.trim() : '';
    if (!val) {
      localStorage.removeItem('mickey_gemini_key');
      if (status) status.textContent = 'تم مسح المفتاح';
      showToast('تم مسح مفتاح Gemini من الخزنة.', 'info');
      return;
    }
    localStorage.setItem('mickey_gemini_key', val);
    try {
      await gatewayFetch('save_gemini_key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiKey: val, action: 'save_gemini_key' })
      });
      if (status) status.textContent = '✓ محفوظ بالخزنة والسيرفر';
      showToast('تم حفظ مفتاح Google Gemini في الخزنة والسيرفر بنجاح ✓', 'success');
    } catch (e) {
      if (status) status.textContent = '✓ محفوظ بالخزنة';
      showToast('تم حفظ مفتاح Gemini في الخزنة بنجاح.', 'success');
    }
  }

  async function downloadCurrentAudio() {
    SFX.playClick();
    const filename = `mickey_voiceover_${Date.now()}.wav`;
    if (STATE.voice.lastAudioBlob) {
      downloadBlob(STATE.voice.lastAudioBlob, filename);
      showToast('جاري تنزيل التعليق الصوتي بصيغة WAV.', 'success');
      return;
    }
    showToast('أنشئ التعليق الصوتي أولاً، ثم نزّله من المشغل.', 'warning');
  }
  function transferAudioToVideoStudio() {
    if (!STATE.voice.lastAudioBlob) {
      showToast('يرجى توليد تعليق صوتي أولاً لنقله!', 'warning');
      return;
    }
    SFX.playClick();
    switchTab('video-studio');

    const select = document.getElementById('video-soundtrack-select');
    const badge = document.getElementById('video-attached-audio-badge');
    if (select) select.value = 'voiceover-custom';
    if (badge) badge.classList.remove('hidden');

    showToast('تم دمج التعليق الصوتي في استوديو الفيديو تلقائياً!', 'success');
  }

  // -----------------------------------------------------------------
  // 11. STUDIO 5: ARABIC SPEECH-TO-TEXT & AUDIO ANALYSIS STUDIO
  // -----------------------------------------------------------------
  function setTranscribeMode(mode) {
    STATE.transcribe.mode = mode;
    SFX.playClick();

    const btnUpload = document.getElementById('btn-mode-upload');
    const btnRecord = document.getElementById('btn-mode-record');
    const containerUpload = document.getElementById('transcribe-upload-container');
    const containerRecord = document.getElementById('transcribe-record-container');

    if (mode === 'upload') {
      if (btnUpload) btnUpload.classList.add('active');
      if (btnRecord) btnRecord.classList.remove('active');
      if (containerUpload) containerUpload.classList.remove('hidden');
      if (containerRecord) containerRecord.classList.add('hidden');
    } else {
      if (btnRecord) btnRecord.classList.add('active');
      if (btnUpload) btnUpload.classList.remove('active');
      if (containerRecord) containerRecord.classList.remove('hidden');
      if (containerUpload) containerUpload.classList.add('hidden');
    }
  }

  function handleTranscribeFileUpload(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    SFX.playClick();
    STATE.transcribe.audioFile = file;
    STATE.transcribe.audioBlob = file;
    STATE.transcribe.audioMime = file.type || 'audio/mp3';
    STATE.transcribe.audioUrl = URL.createObjectURL(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const b64 = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;
      STATE.transcribe.audioBase64 = b64;
    };
    reader.readAsDataURL(file);

    const previewEl = document.getElementById('transcribe-file-preview');
    const emptyEl = document.getElementById('transcribe-upload-empty');
    const nameEl = document.getElementById('transcribe-file-name');
    const sizeEl = document.getElementById('transcribe-file-size');
    const statusPill = document.getElementById('transcribe-status-pill');

    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    if (previewEl) previewEl.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (statusPill) statusPill.textContent = 'تم اختيار الملف - جاهز للتفريغ والتحليل ✓';

    const player = document.getElementById('transcribe-audio-player');
    if (player) {
      player.src = STATE.transcribe.audioUrl;
    }
    const titleEl = document.getElementById('transcribe-audio-title');
    if (titleEl) titleEl.textContent = file.name;

    showToast('تم تحميل الملف الصوتي بنجاح!', 'success');
  }

  function clearTranscribeFile() {
    STATE.transcribe.audioFile = null;
    STATE.transcribe.audioBlob = null;
    STATE.transcribe.audioUrl = null;
    STATE.transcribe.audioBase64 = null;

    const input = document.getElementById('transcribe-file-input');
    if (input) input.value = '';

    const previewEl = document.getElementById('transcribe-file-preview');
    const emptyEl = document.getElementById('transcribe-upload-empty');
    const statusPill = document.getElementById('transcribe-status-pill');

    if (previewEl) previewEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (statusPill) statusPill.textContent = 'جاهز للتفريغ والتحليل';
    SFX.playClick();
  }

  async function loadSampleArabicAudio() {
    SFX.playClick();
    showToast('جاري تحميل عينة صوتية عربية فصيحة...', 'info');

    const sampleText = 'مرحباً بكم في استوديو ميكي للذكاء الاصطناعي. نقدم لكم اليوم تجربة متكاملة لتحويل الكلام العربي المنطوق إلى نصوص مكتوبة بدقة فائقة، مع استخراج ملفات الترجمة لبرامج المونتاج مثل بريمير، وتحليل المشاعر ونبرة الصوت.';
    const sampleUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Tariq&text=${encodeURIComponent(sampleText)}`;

    try {
      const res = await fetch(sampleUrl);
      if (!res.ok) throw new Error('Failed to fetch sample');
      const blob = await res.blob();
      STATE.transcribe.audioBlob = blob;
      STATE.transcribe.audioMime = 'audio/mp3';
      STATE.transcribe.audioUrl = URL.createObjectURL(blob);

      const reader = new FileReader();
      reader.onload = (e) => {
        const b64 = e.target.result.split('base64,')[1];
        STATE.transcribe.audioBase64 = b64;
      };
      reader.readAsDataURL(blob);

      setTranscribeMode('upload');
      const previewEl = document.getElementById('transcribe-file-preview');
      const emptyEl = document.getElementById('transcribe-upload-empty');
      const nameEl = document.getElementById('transcribe-file-name');
      const sizeEl = document.getElementById('transcribe-file-size');
      const titleEl = document.getElementById('transcribe-audio-title');
      const player = document.getElementById('transcribe-audio-player');
      const statusPill = document.getElementById('transcribe-status-pill');

      if (nameEl) nameEl.textContent = 'عينة_صوت_عربي_فصحى.mp3';
      if (sizeEl) sizeEl.textContent = (blob.size / 1024).toFixed(1) + ' KB';
      if (previewEl) previewEl.classList.remove('hidden');
      if (emptyEl) emptyEl.classList.add('hidden');
      if (titleEl) titleEl.textContent = 'عينة_صوت_عربي_فصحى.mp3';
      if (player) player.src = STATE.transcribe.audioUrl;
      if (statusPill) statusPill.textContent = 'العينة التجريبية جاهزة للتفريغ والتحليل ✓';

      SFX.playSuccess();
      showToast('تم تحميل العينة الصوتية! اضغط على "بدء تفريغ وتحليل الصوت".', 'success');
    } catch (err) {
      showToast('تعذر تحميل العينة، يرجى رفع ملف أو استخدام الميكروفون', 'warning');
    }
  }

  let liveSpeechRecInstance = null;
  let liveSpeechTranscriptAccumulated = '';

  async function toggleLiveRecording() {
    if (STATE.transcribe.isRecording) {
      stopLiveRecording();
    } else {
      await startLiveRecording();
    }
  }

  async function startLiveRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      STATE.transcribe.audioStream = stream;
      STATE.transcribe.isRecording = true;
      SFX.playClick();

      const pulseRing = document.getElementById('rec-pulse-ring');
      const recBtnIcon = document.getElementById('rec-btn-icon');
      const recStatus = document.getElementById('rec-status-label');
      const recLiveMeter = document.getElementById('rec-live-meter');
      const timerEl = document.getElementById('rec-timer');

      if (pulseRing) pulseRing.classList.remove('hidden');
      if (recBtnIcon) recBtnIcon.className = 'fa-solid fa-stop text-lg text-white';
      if (recStatus) recStatus.textContent = 'جاري التسجيل المباشر... تحدث بوضوح';
      if (recLiveMeter) recLiveMeter.classList.remove('hidden');

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const actx = new AudioCtx();
        const src = actx.createMediaStreamSource(stream);
        const analyser = actx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const volBar = document.getElementById('rec-volume-bar');

        function updateMeter() {
          if (!STATE.transcribe.isRecording) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const pct = Math.min(100, Math.round((avg / 128) * 100));
          if (volBar) volBar.style.width = pct + '%';
          requestAnimationFrame(updateMeter);
        }
        updateMeter();
      } catch (e) {}

      STATE.transcribe.recSeconds = 0;
      if (timerEl) timerEl.textContent = '00:00';
      clearInterval(STATE.transcribe.recInterval);
      STATE.transcribe.recInterval = setInterval(() => {
        STATE.transcribe.recSeconds++;
        const mins = String(Math.floor(STATE.transcribe.recSeconds / 60)).padStart(2, '0');
        const secs = String(STATE.transcribe.recSeconds % 60).padStart(2, '0');
        if (timerEl) timerEl.textContent = `${mins}:${secs}`;
      }, 1000);

      const recordedChunks = [];
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : (MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : '');
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      STATE.transcribe.mediaRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(recordedChunks, { type: mimeType || 'audio/webm' });
        STATE.transcribe.audioBlob = audioBlob;
        STATE.transcribe.audioMime = mimeType || 'audio/webm';
        STATE.transcribe.audioUrl = URL.createObjectURL(audioBlob);

        const reader = new FileReader();
        reader.onload = (e) => {
          const b64 = e.target.result.split('base64,')[1];
          STATE.transcribe.audioBase64 = b64;
        };
        reader.readAsDataURL(audioBlob);

        const player = document.getElementById('transcribe-audio-player');
        if (player) player.src = STATE.transcribe.audioUrl;
        const titleEl = document.getElementById('transcribe-audio-title');
        if (titleEl) titleEl.textContent = `تسجيل_مباشر_${new Date().toLocaleTimeString('ar-EG')}.webm`;

        const statusPill = document.getElementById('transcribe-status-pill');
        if (statusPill) statusPill.textContent = 'تم اكتمال التسجيل - جاهز للتفريغ والتحليل ✓';
      };

      recorder.start(250);

      liveSpeechTranscriptAccumulated = '';
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          liveSpeechRecInstance = new SpeechRecognition();
          liveSpeechRecInstance.continuous = true;
          liveSpeechRecInstance.interimResults = true;
          const dialect = document.getElementById('transcribe-dialect-select')?.value || 'auto';
          liveSpeechRecInstance.lang = dialect === 'egyptian' ? 'ar-EG' : (dialect === 'gulf' ? 'ar-SA' : (dialect === 'maghrebi' ? 'ar-MA' : 'ar-SA'));

          liveSpeechRecInstance.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                liveSpeechTranscriptAccumulated += event.results[i][0].transcript + ' ';
              } else {
                interim += event.results[i][0].transcript;
              }
            }
          };
          liveSpeechRecInstance.start();
        } catch (e) {}
      }

    } catch (err) {
      console.error(err);
      showToast('تعذر الوصول إلى الميكروفون، يرجى منح الإذن للمتصفح', 'error');
    }
  }

  function stopLiveRecording() {
    STATE.transcribe.isRecording = false;
    SFX.playClick();

    const pulseRing = document.getElementById('rec-pulse-ring');
    const recBtnIcon = document.getElementById('rec-btn-icon');
    const recStatus = document.getElementById('rec-status-label');
    const recLiveMeter = document.getElementById('rec-live-meter');

    if (pulseRing) pulseRing.classList.add('hidden');
    if (recBtnIcon) recBtnIcon.className = 'fa-solid fa-microphone text-xl text-white';
    if (recStatus) recStatus.textContent = 'تم حفظ التسجيل! اضغط على زر التفريغ بالأسفل';
    if (recLiveMeter) recLiveMeter.classList.add('hidden');

    clearInterval(STATE.transcribe.recInterval);

    if (STATE.transcribe.mediaRecorder && STATE.transcribe.mediaRecorder.state !== 'inactive') {
      STATE.transcribe.mediaRecorder.stop();
    }

    if (STATE.transcribe.audioStream) {
      STATE.transcribe.audioStream.getTracks().forEach(track => track.stop());
      STATE.transcribe.audioStream = null;
    }

    if (liveSpeechRecInstance) {
      try { liveSpeechRecInstance.stop(); } catch (e) {}
      liveSpeechRecInstance = null;
    }

    SFX.playSuccess();
    showToast('تم حفظ التسجيل الصوتي بنجاح!', 'success');
  }

  function setTranscribeOutputTab(tabKey) {
    STATE.transcribe.outputTab = tabKey;
    SFX.playClick();

    ['transcript', 'srt', 'insights'].forEach(key => {
      const btn = document.getElementById('tab-out-' + key);
      const view = document.getElementById('view-transcribe-' + key);
      if (btn) {
        if (key === tabKey) btn.classList.add('active');
        else btn.classList.remove('active');
      }
      if (view) {
        if (key === tabKey) view.classList.remove('hidden');
        else view.classList.add('hidden');
      }
    });
  }

  function generateSrtFromTranscript(text, totalDurationSec = 30) {
    if (!text || !text.trim()) return '';
    const sentences = text
      .split(/(?<=[.،؟!؛\n])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sentences.length === 0) return '';
    const durPerSent = Math.max(2.5, totalDurationSec / sentences.length);

    let srt = '';
    sentences.forEach((sentence, idx) => {
      const start = idx * durPerSent;
      const end = (idx + 1) * durPerSent;
      const formatTime = (sec) => {
        const h = String(Math.floor(sec / 3600)).padStart(2, '0');
        const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
        const s = String(Math.floor(sec % 60)).padStart(2, '0');
        const ms = String(Math.floor((sec % 1) * 1000)).padStart(3, '0');
        return `${h}:${m}:${s},${ms}`;
      };

      srt += `${idx + 1}\n${formatTime(start)} --> ${formatTime(end)}\n${sentence}\n\n`;
    });
    return srt.trim();
  }

  async function processAudioTranscription() {
    if (!STATE.transcribe.audioBlob && !STATE.transcribe.audioBase64) {
      showToast('يرجى اختيار ملف صوتي أو تسجيل صوتك أولاً!', 'warning');
      return;
    }
    if (!await authorizeAndConsume('transcription')) return;

    if (!STATE.transcribe.audioBase64 && STATE.transcribe.audioBlob) {
      try {
        STATE.transcribe.audioBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const d = e.target.result;
            resolve(d.includes('base64,') ? d.split('base64,')[1] : d);
          };
          reader.onerror = reject;
          reader.readAsDataURL(STATE.transcribe.audioBlob);
        });
      } catch (e) {}
    }

    SFX.playLaser();
    const scanner = document.getElementById('transcribe-laser-scanner');
    const emptyState = document.getElementById('transcribe-empty-state');
    const resultsContainer = document.getElementById('transcribe-results-container');
    const actionsBar = document.getElementById('transcribe-actions-bar');
    const statusPill = document.getElementById('transcribe-status-pill');

    if (scanner) scanner.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.add('hidden');
    if (actionsBar) actionsBar.classList.add('opacity-0', 'pointer-events-none');
    if (statusPill) statusPill.textContent = 'جاري تحليل الموجات الصوتية وتفريغ الكلام العربي...';

    const engine = document.getElementById('transcribe-engine-select')?.value || 'gemini-multimodal';
    const dialect = document.getElementById('transcribe-dialect-select')?.value || 'auto';

    let dialectLabel = 'فصحى معاصرة';
    if (dialect === 'egyptian') dialectLabel = 'لهجة مصرية';
    else if (dialect === 'gulf') dialectLabel = 'لهجة خليجية';
    else if (dialect === 'levantine') dialectLabel = 'لهجة شامية';
    else if (dialect === 'maghrebi') dialectLabel = 'لهجة مغاربية';
    else if (dialect === 'bilingual') dialectLabel = 'عربي + إنجليزي';

    let parsedResult = null;
    let providerName = 'Google Gemini 1.5 Flash';
    let isSuccess = false;
    let lastGeminiError = '';

    // Determine and clean MIME type
    let cleanMime = (STATE.transcribe.audioMime || '').split(';')[0].trim();
    const fileName = (STATE.transcribe.audioFile?.name || '').toLowerCase();
    if (!cleanMime || cleanMime === 'application/octet-stream') {
      if (fileName.endsWith('.mp4')) cleanMime = 'video/mp4';
      else if (fileName.endsWith('.mp3')) cleanMime = 'audio/mp3';
      else if (fileName.endsWith('.wav')) cleanMime = 'audio/wav';
      else if (fileName.endsWith('.m4a')) cleanMime = 'audio/mp4';
      else if (fileName.endsWith('.webm')) cleanMime = 'audio/webm';
      else if (fileName.endsWith('.ogg')) cleanMime = 'audio/ogg';
      else cleanMime = 'audio/mp3';
    }

    const promptInstruction = "أنت خبير فائق الذكاء في تفريغ وتحليل الصوت والكلام العربي بجميع لهجاته (الفصحى، المصرية، الخليجية، الشامية، المغاربية). "
      + "استمع للصوت العربي المرفق جيداً، وقم بتفريغه وتحليله بدقة متناهية. "
      + (dialect !== 'auto' ? `ملاحظة: المتحدث قد يتحدث بـ (${dialectLabel}). راعِ المفردات الدارجة بدقة. ` : "")
      + "المطلوب منك إخراج كائن JSON فقط (Strict valid JSON) بدون أي كتل برمجية، يحتوي على:\n"
      + "{\n"
      + '  "transcript": "النص الكامل الدقيق للكلام العربي المنطوق، مع وضع علامات الترقيم الصحيحة (الفواصل، النقاط، علامات الاستفهام)، وتنسيق الفقرات بسلاسة.",' + "\n"
      + '  "srt": "توليد ملف ترجمة تزامني قياسي بصيغة SRT مع أرقام الفقرات والتوقيتات التقديرية 00:00:00,000 --> 00:00:00,000 جاهز للمونتاج في بريمير.",' + "\n"
      + '  "dialect": "اللهجة المكتشفة في الصوت (مثال: فصحى معاصرة، لهجة مصرية، لهجة خليجية، شامية، مغاربية)",' + "\n"
      + '  "tone": "نبرة الصوت والمشاعر (مثال: نبرة رسمية وهادئة، حماسية وتشويقية، تعليمية، عاطفية)",' + "\n"
      + '  "summary": "ملخص ذكي وموجز في سطرين لأهم ما جاء في التسجيل الصوتي.",' + "\n"
      + '  "key_points": ["نقطة رئيسية 1", "نقطة رئيسية 2", "نقطة رئيسية 3"],' + "\n"
      + '  "words_count": 0,' + "\n"
      + '  "estimated_speed": "معتدلة (~130 كلمة/دقيقة)"' + "\n"
      + "}";

    // Provider keys remain on the server; all remote transcription runs through api.php.
    if (STATE.transcribe.audioBase64) {
      try {
        const response = await gatewayFetch('transcribe_audio', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio_base64: STATE.transcribe.audioBase64, mime_type: cleanMime, dialect })
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success && data.data) {
          parsedResult = data.data; providerName = data.provider || 'خدمة Mickey Studio'; isSuccess = true;
        } else { lastGeminiError = data.error || `تعذر التفريغ (${response.status}).`; }
      } catch (error) { lastGeminiError = error.message || 'تعذر الاتصال بخادم التفريغ.'; }
    }

    // 4. Fallback to Web Speech text if available
    if (!parsedResult && liveSpeechTranscriptAccumulated && liveSpeechTranscriptAccumulated.trim()) {
      const text = liveSpeechTranscriptAccumulated.trim();
      parsedResult = {
        transcript: text,
        dialect: dialectLabel,
        tone: 'طبيعية ومباشرة',
        summary: text.slice(0, 140) + '...',
        key_points: ['تم تفريغ الصوت مباشرة عبر محرك المتصفح المحلي.'],
        words_count: text.split(/\s+/).length,
        estimated_speed: 'مباشرة'
      };
      providerName = 'محرك المتصفح المباشر (Web Speech API)';
      isSuccess = true;
    }

    // If neither the server nor browser speech recognition returned a transcript.
    if (!parsedResult) {
      const friendlyError = lastGeminiError || 'لم تُرجع خدمة التفريغ نصًا. حاول مجددًا لاحقًا.';
      parsedResult = {
        transcript: `تعذر تفريغ الملف الصوتي:\n${friendlyError}`, dialect: dialectLabel, tone: 'غير محدد',
        summary: friendlyError, key_points: ['تحقق من توفر خدمات التفريغ على الخادم.'], words_count: 0, estimated_speed: '0'
      };
      isSuccess = false;
    }

    if (!parsedResult.srt || !parsedResult.srt.trim()) {
      parsedResult.srt = generateSrtFromTranscript(parsedResult.transcript);
    }

    const wordsCount = parsedResult.words_count || (parsedResult.transcript ? parsedResult.transcript.trim().split(/\s+/).filter(Boolean).length : 0);
    const estSpeed = parsedResult.estimated_speed || `~120 كلمة/دقيقة`;

    const textOutput = document.getElementById('transcribe-text-output');
    const srtOutput = document.getElementById('transcribe-srt-output');
    const summaryText = document.getElementById('transcribe-summary-text');
    const keyPointsList = document.getElementById('transcribe-key-points-list');
    const metricDialect = document.getElementById('metric-dialect');
    const metricWords = document.getElementById('metric-words');
    const metricTone = document.getElementById('metric-tone');
    const metricProvider = document.getElementById('metric-provider');

    if (textOutput) textOutput.value = parsedResult.transcript || '';
    if (srtOutput) srtOutput.value = parsedResult.srt || '';
    if (summaryText) summaryText.textContent = parsedResult.summary || 'تم تفريغ الصوت بنجاح.';

    if (keyPointsList) {
      const points = Array.isArray(parsedResult.key_points) ? parsedResult.key_points : [parsedResult.summary || 'تفريغ صوتي'];
      keyPointsList.innerHTML = points.map(pt => `<li class="flex items-start gap-2"><span class="text-indigo-400 mt-0.5">•</span> <span>${pt}</span></li>`).join('');
    }

    if (metricDialect) {
      metricDialect.innerHTML = `<i class="fa-solid fa-language text-zinc-400 text-[11px]"></i> <span>${parsedResult.dialect || dialectLabel}</span>`;
    }
    if (metricWords) {
      metricWords.innerHTML = `<i class="fa-solid fa-align-right text-zinc-400 text-[11px]"></i> <span>${isSuccess ? wordsCount + ' كلمة (' + estSpeed + ')' : '0 كلمة'}</span>`;
    }
    if (metricTone) {
      metricTone.innerHTML = `<i class="fa-solid fa-chart-line text-zinc-400 text-[11px]"></i> <span>${parsedResult.tone || (isSuccess ? 'طبيعية ومتوازنة' : 'غير محدد')}</span>`;
    }
    if (metricProvider) {
      metricProvider.innerHTML = `<i class="fa-solid fa-microchip text-zinc-400 text-[11px]"></i> <span>${providerName}</span>`;
    }

    STATE.transcribe.lastResult = parsedResult;

    if (scanner) scanner.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.remove('hidden');
    if (actionsBar) actionsBar.classList.remove('opacity-0', 'pointer-events-none');

    if (isSuccess) {
      if (statusPill) {
        statusPill.textContent = 'اكتمل التفريغ والتحليل الصوتي بنجاح ✓';
        statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400';
      }
      SFX.playSuccess();
      showToast('تم تفريغ وتحليل الصوت العربي بنجاح!', 'success');
    } else {
      if (statusPill) {
        statusPill.textContent = 'فشلت المعالجة (تحقق من مفتاح API)';
        statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400';
      }
      SFX.playClick();
      showToast('تعذر معالجة الملف الصوتي، يرجى فحص المفتاح في الخزنة', 'error');
    }
  }

  function copyTranscribeCurrentText() {
    SFX.playClick();
    let textToCopy = '';
    const tab = STATE.transcribe.outputTab;

    if (tab === 'srt') {
      textToCopy = document.getElementById('transcribe-srt-output')?.value || '';
    } else if (tab === 'insights') {
      const summary = document.getElementById('transcribe-summary-text')?.textContent || '';
      const points = Array.from(document.querySelectorAll('#transcribe-key-points-list li')).map(li => li.textContent).join('\n');
      textToCopy = `الملخص التنفيذي:\n${summary}\n\nالنقاط الرئيسية:\n${points}`;
    } else {
      textToCopy = document.getElementById('transcribe-text-output')?.value || '';
    }

    if (!textToCopy.trim()) {
      showToast('لا يوجد نص لنسخه!', 'warning');
      return;
    }

    navigator.clipboard.writeText(textToCopy)
      .then(() => showToast('تم نسخ المحتوى إلى الحافظة بنجاح!', 'success'))
      .catch(() => showToast('تعذر النسخ تلقائياً', 'error'));
  }

  function downloadTranscribeTxt() {
    const text = document.getElementById('transcribe-text-output')?.value || '';
    if (!text.trim()) {
      showToast('لا يوجد نص للتحميل!', 'warning');
      return;
    }
    SFX.playClick();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `mickey_transcript_${Date.now()}.txt`);
    showToast('جاري تحميل ملف النص TXT...', 'info');
  }

  function downloadTranscribeSrt() {
    const srt = document.getElementById('transcribe-srt-output')?.value || '';
    if (!srt.trim()) {
      showToast('لا يوجد ملف ترجمة SRT للتحميل!', 'warning');
      return;
    }
    SFX.playClick();
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `mickey_subtitles_${Date.now()}.srt`);
    showToast('جاري تحميل ملف ترجمة بريمير SRT...', 'info');
  }

  function transferTranscribeToImageStudio() {
    const text = document.getElementById('transcribe-text-output')?.value || '';
    if (!text.trim()) {
      showToast('يرجى تفريغ الصوت أولاً لنقل النص!', 'warning');
      return;
    }
    SFX.playClick();
    const summary = document.getElementById('transcribe-summary-text')?.textContent;
    const promptInput = document.getElementById('image-prompt-input');
    if (promptInput) {
      promptInput.value = summary || text.slice(0, 160);
    }
    switchTab('image-studio');
    showToast('تم نقل ملخص الصوت كوصف للمشهد في استوديو الصور!', 'success');
  }

  function transferTranscribeToVoiceStudio() {
    const text = document.getElementById('transcribe-text-output')?.value || '';
    if (!text.trim()) {
      showToast('يرجى تفريغ الصوت أولاً لنقل النص!', 'warning');
      return;
    }
    SFX.playClick();
    const voiceInput = document.getElementById('voice-text-input');
    if (voiceInput) {
      voiceInput.value = text;
    }
    switchTab('voice-studio');
    showToast('تم إرسال النص المفرغ إلى استوديو التعليق الصوتي!', 'success');
  }

  // -----------------------------------------------------------------
  // 12. STUDIO 6: MY AI VAULT (INDEXEDDB & ASSET STORAGE)
  // -----------------------------------------------------------------
  async function saveCurrentToVault(type) {
    SFX.playClick();
    let asset = null;
    const now = Date.now();

    if (type === 'image') {
      if (!STATE.image.lastGeneratedBlob && !STATE.image.lastGeneratedUrl) return;
      asset = {
        id: 'img_' + now,
        type: 'image',
        title: STATE.image.lastPrompt.slice(0, 45) || 'صورة ذكاء اصطناعي',
        url: STATE.image.lastGeneratedUrl,
        prompt: STATE.image.lastPrompt,
        timestamp: now
      };
    } else if (type === 'video') {
      if (!STATE.video.renderedVideoUrl) return;
      asset = {
        id: 'vid_' + now,
        type: 'video',
        title: 'فيديو سينمائي 3D',
        url: STATE.video.renderedVideoUrl,
        prompt: 'حركة كاميرا: ' + STATE.video.cameraMotion,
        timestamp: now
      };
    } else if (type === 'transcribe') {
      const textOutput = document.getElementById('transcribe-text-output');
      const transcriptText = textOutput ? textOutput.value.trim() : '';
      if (!transcriptText) {
        showToast('لا يوجد نص مفرغ لحفظه في الخزنة!', 'warning');
        return;
      }
      const srtText = document.getElementById('transcribe-srt-output')?.value || '';
      const summaryText = document.getElementById('transcribe-summary-text')?.textContent || '';
      const dialectText = document.getElementById('metric-dialect')?.textContent?.trim() || 'عربي';

      asset = {
        id: 'trn_' + now,
        type: 'transcribe',
        title: transcriptText.slice(0, 45) + (transcriptText.length > 45 ? '...' : ''),
        url: STATE.transcribe.audioUrl || '',
        prompt: `لهجة: ${dialectText} | ${summaryText || transcriptText.slice(0, 70)}`,
        transcript: transcriptText,
        srt: srtText,
        summary: summaryText,
        timestamp: now
      };
    }

    if (asset) {
      await saveAssetToDB(asset);
      SFX.playSuccess();
      showToast('تم الحفظ في خزنة أعمالك السحابية بنجاح!', 'success');
    }
  }

  async function saveBgResultToVault() {
    if (!STATE.photoLab.bgResultBlob) return;
    const url = URL.createObjectURL(STATE.photoLab.bgResultBlob);
    const asset = {
      id: 'bg_' + Date.now(),
      type: 'image',
      title: 'صورة مفرغة الخلفية PNG',
      url: url,
      prompt: 'عزل خلفية ذكي',
      timestamp: Date.now()
    };
    await saveAssetToDB(asset);
    SFX.playSuccess();
    showToast('تم حفظ الصورة المفرغة بالخزنة!', 'success');
  }

  async function saveUpscaledToVault() {
    if (!STATE.photoLab.upscaleResultBlob) return;
    const url = URL.createObjectURL(STATE.photoLab.upscaleResultBlob);
    const asset = {
      id: 'up_' + Date.now(),
      type: 'image',
      title: 'صورة محسّنة بالذكاء الاصطناعي',
      url: url,
      prompt: 'تكبير وتحسين الصورة باستخدام Real-ESRGAN',
      timestamp: Date.now()
    };
    await saveAssetToDB(asset);
    SFX.playSuccess();
    showToast('تم حفظ الصورة المحسّنة بالخزنة!', 'success');
  }

  async function saveAudioToVault() {
    if (!STATE.voice.lastAudioBlob) return;
    const asset = {
      id: 'aud_' + Date.now(),
      type: 'audio',
      title: document.getElementById('voice-text-input')?.value.slice(0, 35) || 'تعليق صوتي WAV',
      url: STATE.voice.lastAudioUrl,
      prompt: 'صوت: ' + document.getElementById('voice-dialect-select')?.selectedOptions?.[0]?.textContent + ' · ' + document.getElementById('voice-performance-select')?.selectedOptions?.[0]?.textContent,
      timestamp: Date.now()
    };
    await saveAssetToDB(asset);
    SFX.playSuccess();
    showToast('تم حفظ التعليق الصوتي بالخزنة!', 'success');
  }

  async function renderVaultGallery() {
    const grid = document.getElementById('vault-items-grid');
    const emptyView = document.getElementById('vault-empty-view');
    if (!grid) return;

    const assets = await getAllAssetsFromDB();
    const filter = STATE.vault.currentFilter;
    const query = STATE.vault.searchQuery.toLowerCase();

    let filtered = assets.filter(a => {
      if (filter !== 'all' && a.type !== filter) return false;
      if (query && !a.title.toLowerCase().includes(query) && !a.prompt.toLowerCase().includes(query)) return false;
      return true;
    });

    filtered.sort((a, b) => b.timestamp - a.timestamp);

    grid.innerHTML = '';
    if (filtered.length === 0) {
      grid.classList.add('hidden');
      emptyView.classList.remove('hidden');
      return;
    }

    grid.classList.remove('hidden');
    emptyView.classList.add('hidden');

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'studio-card p-3 flex flex-col justify-between space-y-3 group border border-white/5 hover:border-white/20 transition-all rounded-xl bg-zinc-900/60';
      
      let previewHtml = '';
      if (item.type === 'image') {
        previewHtml = `<div class="w-full h-40 rounded-lg overflow-hidden bg-black/60 cursor-pointer" onclick="MickeyStudio.openLightbox('${item.url}')"><img src="${item.url}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform"></div>`;
      } else if (item.type === 'video') {
        previewHtml = `<div class="w-full h-40 rounded-lg overflow-hidden bg-black/80 flex items-center justify-center"><video src="${item.url}" controls class="w-full h-full object-cover"></video></div>`;
      } else if (item.type === 'audio') {
        previewHtml = `<div class="w-full h-40 rounded-lg bg-black/60 p-3 flex flex-col items-center justify-center space-y-2"><i class="fa-solid fa-microphone-lines text-emerald-400 text-3xl"></i><audio src="${item.url}" controls class="w-full"></audio></div>`;
      } else if (item.type === 'transcribe') {
        const snippet = (item.transcript || item.prompt || '').slice(0, 140);
        previewHtml = `
          <div class="w-full h-40 rounded-lg bg-zinc-950/80 border border-white/5 p-3 flex flex-col justify-between overflow-hidden">
            <div class="flex items-center justify-between text-indigo-400 text-[11px] font-semibold">
              <span class="flex items-center gap-1.5"><i class="fa-solid fa-file-audio text-xs"></i> تفريغ صوتي</span>
              <span class="text-[10px] text-zinc-500 font-mono">${(item.transcript || '').split(/\s+/).filter(Boolean).length} كلمة</span>
            </div>
            <p class="text-[11px] text-zinc-300 leading-relaxed overflow-hidden line-clamp-3 select-text font-sans">${snippet}...</p>
            ${item.url ? `<audio src="${item.url}" controls class="w-full h-7 mt-1"></audio>` : '<div class="text-[10px] text-zinc-500 font-mono">ملف نصي مفرغ</div>'}
          </div>
        `;
      }

      const actionBtnHtml = item.type === 'transcribe'
        ? `<button onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(item.transcript || '')}')); showToast('تم نسخ النص المفرغ!', 'success');" class="text-xs text-zinc-300 hover:text-white flex items-center gap-1 font-semibold"><i class="fa-regular fa-copy"></i> <span>نسخ النص</span></button>`
        : `<a href="${item.url}" download="vault_${item.id}" class="text-xs text-zinc-300 hover:text-white flex items-center gap-1 font-semibold"><i class="fa-solid fa-download"></i> <span>تحميل</span></a>`;

      card.innerHTML = `
        ${previewHtml}
        <div>
          <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase font-mono">${item.type}</span>
            <span>${new Date(item.timestamp).toLocaleDateString('ar-EG')}</span>
          </div>
          <h4 class="text-xs font-bold text-white truncate" title="${item.title}">${item.title}</h4>
          <p class="text-[11px] text-slate-500 truncate" title="${item.prompt}">${item.prompt}</p>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-white/10">
          ${actionBtnHtml}
          <button onclick="MickeyStudio.deleteVaultItem('${item.id}')" class="text-xs text-red-400 hover:text-red-300 p-1" title="حذف">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function filterVault(filterKey) {
    STATE.vault.currentFilter = filterKey;
    document.querySelectorAll('.vault-filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.getElementById('vault-filter-' + filterKey);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
    SFX.playClick();
    renderVaultGallery();
  }

  function searchVault(query) {
    STATE.vault.searchQuery = query;
    renderVaultGallery();
  }

  async function deleteVaultItem(id) {
    SFX.playClick();
    await deleteAssetFromDB(id);
    renderVaultGallery();
    showToast('تم حذف العنصر من الخزنة', 'info');
  }

  async function clearVaultConfirm() {
    if (confirm('هل أنت متأكد من رغبتك في مسح كافة العناصر المحفوظة في الخزنة؟')) {
      SFX.playClick();
      await clearAllAssetsFromDB();
      renderVaultGallery();
      showToast('تم تفريغ الخزنة بالكامل', 'info');
    }
  }

  async function exportVaultBackup() {
    SFX.playClick();
    const assets = await getAllAssetsFromDB();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(assets, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `mickey_vault_backup_${Date.now()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('تم تصدير النسخة الاحتياطية بنجاح!', 'success');
  }

  // -----------------------------------------------------------------
  // 12. TAB SWITCHER & LIGHTBOX
  // -----------------------------------------------------------------
  function switchTab(tabId) {
    STATE.activeTab = tabId;
    SFX.playClick();

    // Hide all sections
    document.querySelectorAll('.studio-section').forEach(sec => sec.classList.add('hidden'));

    // Show target section
    const targetSection = document.getElementById('section-' + tabId);
    if (targetSection) targetSection.classList.remove('hidden');

    // Update navigation button active state
    document.querySelectorAll('.sidebar-nav-item, .nav-tab-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById('tab-btn-' + tabId);
    if (targetBtn) targetBtn.classList.add('active');

    // If Vault tab, refresh assets
    if (tabId === 'vault-gallery') {
      renderVaultGallery();
    }

    // If Developer API tab, initialize docs & playground
    if (tabId === 'developer-api') {
      initDeveloperApiSection();
    }
  }

  function openLightbox(url) {
    SFX.playClick();
    const container = document.getElementById('lightbox-content-container');
    container.innerHTML = `<img src="${url}" class="max-h-[85vh] max-w-[90vw] object-contain rounded-xl">`;
    document.getElementById('modal-lightbox').classList.remove('hidden');
  }

  function closeLightbox() {
    document.getElementById('modal-lightbox').classList.add('hidden');
  }

  // Provider credentials are managed only in admin.html and stay on the PHP server.

  function toggleSound(forceState) {
    if (typeof forceState === 'boolean') {
      STATE.settings.sfxEnabled = forceState;
    } else {
      STATE.settings.sfxEnabled = !STATE.settings.sfxEnabled;
    }
    localStorage.setItem('mickey_sfx_enabled', STATE.settings.sfxEnabled);
    const icon = document.getElementById('sfx-icon');
    if (icon) {
      icon.className = STATE.settings.sfxEnabled ? 'fa-solid fa-volume-high text-sm' : 'fa-solid fa-volume-xmark text-sm text-red-400';
    }
    if (STATE.settings.sfxEnabled) SFX.playClick();
    showToast(STATE.settings.sfxEnabled ? 'المؤثرات الصوتية مفعلة' : 'تم كتم الصوت', 'info');
  }

  // -----------------------------------------------------------------
  // 14. DEVELOPER REST API GATEWAY & CODE GENERATOR
  // -----------------------------------------------------------------
  const DEV_API_DOCS = {
    transcribe_audio: {
      name: 'تفريغ وتحليل الصوت العربي (STT)',
      method: 'POST',
      action: 'transcribe_audio',
      tag: 'Audio AI',
      description: 'تفريغ دقيق للكلام العربي المنطوق وتحويله لنصوص مكتوبة، مع استخراج علامات الترقيم، وتوليد ملفات الترجمة لبريمير (SRT)، وتحليل نبرة الصوت والمشاعر والملخص التنفيذي.',
      headers: {
        'Authorization': 'Bearer mk_live_YOUR_KEY',
        'Content-Type': 'application/json'
      },
      params: [
        { name: 'action', type: 'string', req: 'مطلوب', desc: 'اسم العملية: transcribe_audio' },
        { name: 'audio_base64', type: 'string (base64)', req: 'مطلوب', desc: 'تشفير Base64 لملف الصوت (MP3, WAV, WEBM, M4A)' },
        { name: 'mime_type', type: 'string', req: 'اختياري', desc: 'نوع MIME مثل audio/mp3 أو audio/webm (الافتراضي: audio/webm)' },
        { name: 'dialect', type: 'string', req: 'اختياري', desc: 'اللهجة المستهدفة: auto, fusha, egyptian, gulf, levantine, maghrebi' }
      ],
      sampleBody: {
        action: 'transcribe_audio',
        audio_base64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        mime_type: 'audio/wav',
        dialect: 'fusha'
      },
      sampleResponse: {
        success: true,
        provider: 'Google Gemini 2.5 Flash Multimodal',
        data: {
          transcript: 'مرحباً بكم في استوديو ميكي للذكاء الاصطناعي. نقدم لكم اليوم تجربة متكاملة لتحويل الصوت إلى نص.',
          srt: "1\n00:00:00,000 --> 00:00:03,000\nمرحباً بكم في استوديو ميكي.\n",
          dialect: 'فصحى معاصرة',
          tone: 'حماسية ورسمية',
          summary: 'مقدمة تعريفية عن المنصة والخدمات الذكية.',
          key_points: ['تحويل الصوت إلى نص', 'دعم ملفات SRT لبريمير'],
          words_count: 16,
          estimated_speed: '~125 كلمة/دقيقة'
        }
      }
    },
    generate_image: {
      name: 'توليد الصور الواقعية (Image Generation)',
      method: 'POST',
      action: 'generate_image',
      tag: 'Visual AI',
      description: 'توليد صور فوتوغرافية وسينمائية فائقة الدقة عبر محرك Google Imagen 3 أو FLUX مباشرة بجودة تصل إلى 2K.',
      headers: {
        'Authorization': 'Bearer mk_live_YOUR_KEY',
        'Content-Type': 'application/json'
      },
      params: [
        { name: 'action', type: 'string', req: 'مطلوب', desc: 'اسم العملية: generate_image' },
        { name: 'prompt', type: 'string', req: 'مطلوب', desc: 'وصف المشهد الفني أو الفوتوغرافي بالعربية أو الإنجليزية' },
        { name: 'aspectRatio', type: 'string', req: 'اختياري', desc: 'أبعاد الصورة: 1:1, 16:9, 9:16, 4:3, 3:4' }
      ],
      sampleBody: {
        action: 'generate_image',
        prompt: 'صقر عربي مهيب على قمة صخرية وقت الغروب، إضاءة سينمائية ذهبية، تصوير احترافي بدقة 8k',
        aspectRatio: '16:9'
      },
      sampleResponse: {
        success: true,
        provider: 'Google Imagen 3.0 (2K Ultra)',
        mime_type: 'image/jpeg',
        image_base64: '...[base64_jpeg_bytes]...'
      }
    },
    generate_tts: {
      name: 'التعليق الصوتي الفوري (Text to Speech)',
      method: 'POST / GET',
      action: 'generate_tts',
      tag: 'Voice AI',
      description: 'تحويل النص العربي إلى ملف WAV عبر Gemini TTS مع توجيه اللهجة والشخصية والأداء.',
      headers: {
        'Authorization': 'Bearer mk_live_YOUR_KEY',
        'Content-Type': 'application/json'
      },
      params: [
        { name: 'action', type: 'string', req: 'مطلوب', desc: 'اسم العملية: generate_tts' },
        { name: 'text', type: 'string', req: 'مطلوب', desc: 'النص العربي المراد قراءته' },
        { name: 'voice', type: 'string', req: 'اختياري', desc: 'اسم المعلق: Tariq, Zeina, Maged, Laila' }
      ],
      sampleBody: {
        action: 'generate_tts',
        text: 'مرحباً بكم في استوديو ميكي، الأفق الجديد للذكاء الاصطناعي.',
        voice: 'Tariq'
      },
      sampleResponse: 'Audio stream binary data (audio/mpeg)'
    },
    enhance_prompt: {
      name: 'تحسين البرومبت للواقعية (Prompt Architect)',
      method: 'POST',
      action: 'enhance_prompt',
      tag: 'NLP AI',
      description: 'ترجمة النص تلقائياً للإنجليزية وتزويده بتفاصيل الكاميرات السينمائية والعدسات والإضاءة وخامات الجلد الحقيقية.',
      headers: {
        'Authorization': 'Bearer mk_live_YOUR_KEY',
        'Content-Type': 'application/json'
      },
      params: [
        { name: 'action', type: 'string', req: 'مطلوب', desc: 'اسم العملية: enhance_prompt' },
        { name: 'prompt', type: 'string', req: 'مطلوب', desc: 'النص الأولي البسيط بالعربية' }
      ],
      sampleBody: {
        action: 'enhance_prompt',
        prompt: 'شاب في مقهى قديم يقرأ كتاباً'
      },
      sampleResponse: {
        success: true,
        provider: 'studio-photorealistic',
        original: 'شاب في مقهى قديم يقرأ كتاباً',
        enhanced: 'A young man in a vintage aesthetic cafe reading an old leather-bound book, award-winning RAW candid photography, natural lighting...'
      }
    },
    status: {
      name: 'فحص جاهزية الخادم والمحركات (Health Check)',
      method: 'GET',
      action: 'status',
      tag: 'System',
      description: 'استعلام سريع عن حالة البوابة ومحركات الذكاء الاصطناعي النشطة وإصدار النظام.',
      headers: {},
      params: [
        { name: 'action', type: 'اختياري', req: 'اختياري', desc: 'status (الافتراضي)' }
      ],
      sampleBody: { action: 'status' },
      sampleResponse: {
        status: 'online',
        system: 'Mickey Studio Nano Banana AI Gateway',
        version: '3.7.0',
        engines: {
          nano_banana: 'gemini-nano-banana-2.1',
          flux_natural: 'pollinations flux-realism (external service)'
        }
      }
    }
  };

  function getApiBaseUrl() {
    const loc = window.location;
    const path = loc.pathname.replace(/\/[^/]*$/, '');
    return `${loc.protocol}//${loc.host}${path}/api.php`;
  }

  function ensureDeveloperApiKey() {
    if (!STATE.devApi.activeKey) {
      const generated = 'mk_live_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      STATE.devApi.activeKey = generated;
      CryptoVault.encrypt(generated).then(enc => localStorage.setItem('mickey_dev_api_key', enc));
    }
    return STATE.devApi.activeKey;
  }

  function initDeveloperApiSection() {
    ensureDeveloperApiKey();

    const baseUrlCode = document.getElementById('dev-api-base-url');
    if (baseUrlCode) baseUrlCode.textContent = getApiBaseUrl();

    updateApiKeyDisplay();
    selectApiDocEndpoint(STATE.devApi.selectedEndpoint || 'generate_tts');
    setApiSnippetLang(STATE.devApi.selectedLang || 'curl');
  }

  function openDeveloperApiModal() {
    switchTab('developer-api');
  }

  function closeDeveloperApiModal() {
    const modal = document.getElementById('modal-developer-api');
    if (modal) modal.classList.add('hidden');
  }

  function updateApiKeyDisplay() {
    const keyInput = document.getElementById('dev-api-key-input');
    const eyeIcon = document.getElementById('dev-api-key-eye-icon');
    if (!keyInput) return;

    if (STATE.devApi.keyVisible) {
      keyInput.type = 'text';
      keyInput.value = STATE.devApi.activeKey;
      if (eyeIcon) eyeIcon.className = 'fa-solid fa-eye-slash text-xs';
    } else {
      keyInput.type = 'password';
      keyInput.value = STATE.devApi.activeKey;
      if (eyeIcon) eyeIcon.className = 'fa-solid fa-eye text-xs';
    }
  }

  function toggleApiKeyVisibility() {
    STATE.devApi.keyVisible = !STATE.devApi.keyVisible;
    SFX.playClick();
    updateApiKeyDisplay();
  }

  function copyDeveloperApiKey() {
    ensureDeveloperApiKey();
    navigator.clipboard.writeText(STATE.devApi.activeKey)
      .then(() => {
        SFX.playSuccess();
        showToast('تم نسخ مفتاح الـ API بنجاح!', 'success');
      })
      .catch(() => showToast('تعذر نسخ المفتاح', 'error'));
  }

  function regenerateDeveloperApiKey() {
    if (!confirm('هل تريد توليد مفتاح API جديد؟ سيتطلب ذلك تحديث المفتاح في تطبيقاتك.')) return;
    SFX.playClick();
    const newKey = 'mk_live_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    STATE.devApi.activeKey = newKey;
    CryptoVault.encrypt(newKey).then(enc => localStorage.setItem('mickey_dev_api_key', enc));
    updateApiKeyDisplay();
    renderApiCodeSnippet();
    SFX.playSuccess();
    showToast('تم توليد وتحديث مفتاح API جديد بنجاح!', 'success');
  }

  function copyApiBaseUrl() {
    navigator.clipboard.writeText(getApiBaseUrl())
      .then(() => {
        SFX.playClick();
        showToast('تم نسخ رابط الـ API الأساسي (Base URL)!', 'success');
      });
  }

  function selectApiDocEndpoint(endpointKey) {
    STATE.devApi.selectedEndpoint = endpointKey;

    document.querySelectorAll('#dev-api-endpoint-tabs .pill-option').forEach(tab => {
      tab.classList.remove('active');
    });
    const activeTab = document.getElementById('doc-tab-' + endpointKey);
    if (activeTab) activeTab.classList.add('active');

    renderApiEndpointDetails();
    setApiSnippetLang(STATE.devApi.selectedLang || 'curl');
  }

  function setApiSnippetLang(langKey) {
    STATE.devApi.selectedLang = langKey;

    document.querySelectorAll('#dev-api-lang-tabs .pill-option').forEach(tab => {
      tab.classList.remove('active');
    });
    const activeTab = document.getElementById('snippet-tab-' + langKey);
    if (activeTab) activeTab.classList.add('active');

    renderApiCodeSnippet();
  }

  function renderApiEndpointDetails() {
    const container = document.getElementById('dev-api-doc-details');
    const doc = DEV_API_DOCS[STATE.devApi.selectedEndpoint];
    if (!container || !doc) return;

    const baseUrl = getApiBaseUrl();
    const endpointUrl = `${baseUrl}?action=${doc.action}`;

    let paramsHtml = '';
    if (doc.params && doc.params.length > 0) {
      paramsHtml = `
        <div class="space-y-1.5 pt-2 border-t border-white/5">
          <span class="text-zinc-400 font-semibold text-[11px] block">معاملات الطلب (Parameters):</span>
          <div class="overflow-x-auto">
            <table class="w-full text-[11px] text-right font-sans">
              <thead>
                <tr class="text-zinc-500 border-b border-white/5">
                  <th class="py-1">المعامل</th>
                  <th class="py-1">النوع</th>
                  <th class="py-1">الحالة</th>
                  <th class="py-1">الوصف</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5 text-zinc-300">
                ${doc.params.map(p => `
                  <tr>
                    <td class="py-1.5 font-mono text-indigo-300">${p.name}</td>
                    <td class="py-1.5 font-mono text-zinc-400 text-[10px]">${p.type}</td>
                    <td class="py-1.5"><span class="px-1.5 py-0.5 rounded text-[9px] ${p.req === 'مطلوب' ? 'bg-red-500/10 text-red-300' : 'bg-zinc-800 text-zinc-400'}">${p.req}</span></td>
                    <td class="py-1.5 text-zinc-400">${p.desc}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/5">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded font-mono font-bold text-[10px] ${doc.method.includes('POST') ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">${doc.method}</span>
          <code class="font-mono text-white text-[11px] select-all">${endpointUrl}</code>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">${doc.tag}</span>
      </div>

      <p class="text-xs text-zinc-300 leading-relaxed">${doc.description}</p>
      ${paramsHtml}
    `;

    const testBodyEl = document.getElementById('dev-api-test-body');
    if (testBodyEl) {
      testBodyEl.value = JSON.stringify(doc.sampleBody, null, 2);
    }
  }

  function renderApiCodeSnippet() {
    const snippetCode = document.getElementById('dev-api-code-snippet');
    const doc = DEV_API_DOCS[STATE.devApi.selectedEndpoint];
    if (!snippetCode || !doc) return;

    const baseUrl = getApiBaseUrl();
    const apiKey = STATE.devApi.activeKey || 'mk_live_YOUR_API_KEY';
    const lang = STATE.devApi.selectedLang || 'curl';
    const endpointUrl = `${baseUrl}?action=${doc.action}`;

    let code = '';
    if (lang === 'curl') {
      if (doc.method === 'GET') {
        code = `curl -X GET "${endpointUrl}" \\\n  -H "Authorization: Bearer ${apiKey}"`;
      } else {
        code = `curl -X POST "${endpointUrl}" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(doc.sampleBody)}'`;
      }
    } else if (lang === 'python') {
      if (doc.method === 'GET') {
        code = `import requests\n\nurl = "${endpointUrl}"\nheaders = {\n    "Authorization": "Bearer ${apiKey}"\n}\n\nresponse = requests.get(url, headers=headers)\nprint(response.json())`;
      } else {
        code = `import requests\n\nurl = "${endpointUrl}"\nheaders = {\n    "Authorization": "Bearer ${apiKey}",\n    "Content-Type": "application/json"\n}\npayload = ${JSON.stringify(doc.sampleBody, null, 4)}\n\nresponse = requests.post(url, headers=headers, json=payload)\ndata = response.json()\nprint("Mickey Studio Response:", data)`;
      }
    } else if (lang === 'javascript') {
      if (doc.method === 'GET') {
        code = `// JavaScript / Node.js\nconst response = await fetch("${endpointUrl}", {\n  method: "GET",\n  headers: {\n    "Authorization": "Bearer ${apiKey}"\n  }\n});\nconst data = await response.json();\nconsole.log(data);`;
      } else {
        code = `// JavaScript / Node.js\nconst response = await fetch("${endpointUrl}", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer ${apiKey}",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify(${JSON.stringify(doc.sampleBody, null, 2)})\n});\nconst data = await response.json();\nconsole.log("Mickey Studio AI Result:", data);`;
      }
    } else if (lang === 'premiere') {
      code = `// ============================================================\n// Adobe Premiere Pro CEP / ExtendScript Integration Snippet\n// ============================================================\nasync function callMickeyStudioAI() {\n  const apiKey = "${apiKey}";\n  const endpoint = "${endpointUrl}";\n  const payload = ${JSON.stringify(doc.sampleBody, null, 2)};\n\n  try {\n    const res = await fetch(endpoint, {\n      method: "${doc.method.split(' ')[0]}",\n      headers: {\n        "Authorization": "Bearer " + apiKey,\n        "Content-Type": "application/json"\n      },\n      body: JSON.stringify(payload)\n    });\n\n    const result = await res.json();\n    if (result.success && result.data && result.data.srt) {\n      // Subtitles are ready for Premiere Timeline insertion!\n      alert("تم استلام ملف الترجمة بنجاح! جاهز للإدراج في المسار الزمني لبريمير.");\n    }\n    return result;\n  } catch (err) {\n    alert("خطأ في استدعاء الـ API: " + err.message);\n  }\n}`;
    }

    snippetCode.textContent = code;
  }

  function copyCurrentCodeSnippet() {
    const snippetCode = document.getElementById('dev-api-code-snippet');
    if (!snippetCode || !snippetCode.textContent) return;
    navigator.clipboard.writeText(snippetCode.textContent)
      .then(() => {
        SFX.playSuccess();
        showToast('تم نسخ الكود البرمجي إلى الحافظة بنجاح!', 'success');
      });
  }

  async function executeLiveApiTest() {
    const doc = DEV_API_DOCS[STATE.devApi.selectedEndpoint];
    if (!doc) return;

    const testBodyEl = document.getElementById('dev-api-test-body');
    const resultBox = document.getElementById('dev-api-test-result-box');
    const responseCode = document.getElementById('dev-api-response-code');
    const statusPill = document.getElementById('dev-api-response-status');
    const timePill = document.getElementById('dev-api-response-time');
    const testBadge = document.getElementById('dev-api-test-badge');
    const btnExecute = document.getElementById('btn-execute-api-test');

    let bodyData = {};
    if (doc.method !== 'GET') {
      try {
        bodyData = JSON.parse(testBodyEl.value);
      } catch (e) {
        showToast('صيغة JSON غير صالحة في حقل الطلب التجريبي!', 'error');
        return;
      }
    }

    SFX.playLaser();
    if (testBadge) testBadge.textContent = 'جاري إرسال الطلب...';
    if (btnExecute) btnExecute.disabled = true;

    const startTime = performance.now();
    const baseUrl = getApiBaseUrl();
    const endpointUrl = `${baseUrl}?action=${doc.action}`;
    const apiKey = STATE.devApi.activeKey || 'mk_live_tester';

    try {
      let res = null;
      if (doc.method === 'GET') {
        res = await fetch(endpointUrl, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
      } else {
        res = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bodyData)
        });
      }

      const elapsed = Math.round(performance.now() - startTime);
      if (timePill) timePill.textContent = `${elapsed}ms`;

      let outputText = '';
      if (res.ok) {
        const json = await res.json();
        outputText = JSON.stringify(json, null, 2);
        if (statusPill) {
          statusPill.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
          statusPill.textContent = `${res.status} ${res.statusText || 'OK'}`;
        }
      } else {
        const errText = await res.text();
        outputText = errText;
        if (statusPill) {
          statusPill.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20';
          statusPill.textContent = `${res.status} Response`;
        }
      }

      if (responseCode) responseCode.textContent = outputText;
      if (resultBox) resultBox.classList.remove('hidden');
      if (testBadge) testBadge.textContent = 'اكتمل الاختبار ✓';
      SFX.playSuccess();
      showToast('تم تنفيذ الاختبار التجريبي بنجاح!', 'success');

    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      if (timePill) timePill.textContent = `${elapsed}ms`;
      if (statusPill) {
        statusPill.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        statusPill.textContent = '200 OK (Simulation)';
      }
      const simResponse = doc.sampleResponse || { success: true, message: 'Simulated API Response' };
      if (responseCode) responseCode.textContent = JSON.stringify(simResponse, null, 2);
      if (resultBox) resultBox.classList.remove('hidden');
      if (testBadge) testBadge.textContent = 'تم الاختبار (Simulated)';
      SFX.playSuccess();
      showToast('تم اختبار استجابة الـ API بنجاح!', 'success');
    } finally {
      if (btnExecute) btnExecute.disabled = false;
    }
  }

  function copyApiTestResponse() {
    const responseCode = document.getElementById('dev-api-response-code');
    if (!responseCode || !responseCode.textContent) return;
    navigator.clipboard.writeText(responseCode.textContent)
      .then(() => {
        SFX.playClick();
        showToast('تم نسخ استجابة الـ JSON بنجاح!', 'success');
      });
  }

  // -----------------------------------------------------------------
  // 15. FIREBASE AUTH & FIRESTORE CLOUD VAULT
  // -----------------------------------------------------------------
  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAbwmXwJkb5nl2sUDCZ0ing_cWs0lbYAWg",
    authDomain: "mickey-gemini-studio.firebaseapp.com",
    projectId: "mickey-gemini-studio",
    storageBucket: "mickey-gemini-studio.firebasestorage.app",
    messagingSenderId: "539974179095",
    appId: "1:539974179095:web:5e36791365e6a2cdefff52",
    measurementId: "G-LH4V8X9TQ9"
  };

  function getActiveFirebaseConfig() { return DEFAULT_FIREBASE_CONFIG; }

  const ADMIN_EMAIL = 'michaelmagednew@gmail.com';
  const API_BASE_URL = new URL('api.php', window.location.href).href;
  let phoneConfirmation = null;
  let phoneRecaptcha = null;
  let pendingPairCode = '';
  let firebaseAuthObserverAttached = false;

  function getAnonymousId() {
    let id = localStorage.getItem('mickey_anonymous_id');
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(24)), value => value.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('mickey_anonymous_id', id);
    }
    return id;
  }

  async function accountHeaders() {
    const headers = { 'X-Anonymous-ID': getAnonymousId() };
    if (firebase.auth().currentUser) headers.Authorization = `Bearer ${await firebase.auth().currentUser.getIdToken()}`;
    return headers;
  }

  async function gatewayFetch(action, options = {}) {
    const headers = { ...(options.headers || {}), ...(await accountHeaders()) };
    const signedInUser = firebase?.auth?.().currentUser;
    let requestOptions = options;
    // Some shared hosts remove Authorization before PHP sees it. Carry the
    // short-lived Firebase ID token in the JSON body as an authenticated fallback.
    if (signedInUser && typeof options.body === 'string') {
      try {
        const requestBody = JSON.parse(options.body);
        requestBody.idToken = await signedInUser.getIdToken();
        requestOptions = { ...options, body: JSON.stringify(requestBody) };
      } catch (_) {}
    }
    const tool = ({ generate_image: 'image', generate_tts: 'voiceover', refine_voiceover: 'voiceover', transcribe_audio: 'transcription', enhance_prompt: 'prompt' })[action] || action;
    let permits = {};
    try { permits = JSON.parse(sessionStorage.getItem('mickey_generation_permits') || '{}'); } catch (_) {}
    const permit = permits[tool];
    if (permit) headers['X-Generation-Permit'] = permit;
    const response = await fetch(`${API_BASE_URL}?action=${encodeURIComponent(action)}`, { ...requestOptions, headers });
    if (permit) { delete permits[tool]; sessionStorage.setItem('mickey_generation_permits', JSON.stringify(permits)); }
    return response;
  }

  async function accountRequest(action, body = {}) {
    const user = firebase.auth().currentUser;
    const headers = { 'Content-Type': 'application/json', 'X-Anonymous-ID': getAnonymousId() };
    if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
    const requestBody = { action, ...body };
    // InfinityFree/shared Apache may drop Authorization before PHP receives it.
    // Include the short-lived ID token in this HTTPS request body as a fallback.
    if (['pair_complete', 'consume_generation'].includes(action) && user) requestBody.idToken = await user.getIdToken();
    const response = await fetch(`${API_BASE_URL}?action=${encodeURIComponent(action)}`, {
      method: 'POST', headers, body: JSON.stringify(requestBody)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.error || data.message || `تعذر تنفيذ الطلب (${response.status}).`);
    if (action === 'consume_generation' && data.permit) {
      let permits = {};
      try { permits = JSON.parse(sessionStorage.getItem('mickey_generation_permits') || '{}'); } catch (_) {}
      permits[body.tool || 'tool'] = data.permit;
      sessionStorage.setItem('mickey_generation_permits', JSON.stringify(permits));
    }
    return data;
  }

  async function ensureActiveProfile(user) {
    const profileRef = firebase.firestore().collection('users').doc(user.uid);
    let snapshot = await profileRef.get();
    if (!snapshot.exists) {
      const email = user.email && !user.email.includes('@phone.mickey.studio') ? user.email : '';
      const phone = user.phoneNumber || (user.email && user.email.includes('@phone.mickey.studio') ? user.email.replace(/^u_/, '').replace(/@phone\.mickey\.studio$/, '') : '');
      await profileRef.set({
        uid: user.uid,
        email: email,
        displayName: user.displayName || phone || 'مستخدم Mickey Studio',
        phoneNumber: phone,
        photoURL: user.photoURL || '',
        status: 'active',
        plan: 'free',
        role: user.email?.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      snapshot = await profileRef.get();
    }
    const profile = snapshot.data() || {};
    if (profile.status !== 'active') {
      await firebase.auth().signOut();
      STATE.user = null; STATE.userProfile = null;
      throw new Error('هذا الحساب موقوف من قبل إدارة Mickey Studio. تواصل مع الدعم الفني.');
    }
    STATE.userProfile = profile;
    return profile;
  }

  function updateGuestBadge() {
    const badge = document.getElementById('guest-usage-badge');
    const text = document.getElementById('guest-remaining-text');
    if (STATE.user || (window.firebase && firebase.apps.length && firebase.auth().currentUser)) {
      if (badge) badge.classList.add('hidden');
      return;
    }
    if (badge) badge.classList.remove('hidden');
    const used = Number(localStorage.getItem('mickey_guest_generations') || 0);
    const remaining = Math.max(0, 5 - used);
    if (text) text.textContent = `${remaining} من 5`;
  }

  async function authorizeAndConsume(tool, count = 1) {
    const signedInUser = STATE.user || (window.firebase ? firebase.auth().currentUser : null);
    if (signedInUser) {
      STATE.user = signedInUser;
      try {
        if (!STATE.userProfile || STATE.userProfile.uid !== signedInUser.uid) await ensureActiveProfile(signedInUser);
      } catch (error) {
        showToast(error.message || 'تعذر التحقق من حسابك. أعد تسجيل الدخول ثم حاول مجددًا.', 'error');
        return false;
      }
      if (STATE.userProfile && STATE.userProfile.status !== 'active') {
        showToast('هذا الحساب موقوف من قبل الإدارة.', 'error');
        return false;
      }
      return true;
    }

    const currentUsed = Number(localStorage.getItem('mickey_guest_generations') || 0);
    if (currentUsed >= 5) {
      showToast('استنفذت الـ 5 محاولات المجانية للضيف. أنشئ حسابًا مجانيًا للمتابعة بدون حدود!', 'warning');
      openAccountModal();
      return false;
    }

    try {
      await accountRequest('consume_generation', { tool, count: Math.max(1, Math.min(20, Number(count) || 1)) });
      const newUsed = currentUsed + (Number(count) || 1);
      localStorage.setItem('mickey_guest_generations', newUsed);
      updateGuestBadge();
      const remaining = Math.max(0, 5 - newUsed);
      showToast(`استخدام الضيف: تبقّى ${remaining} من 5 محاولات مجانية.`, 'info');
      return true;
    } catch (error) {
      if (error.message && error.message.includes('الخمس')) {
        localStorage.setItem('mickey_guest_generations', 5);
        updateGuestBadge();
        showToast(error.message, 'warning');
        openAccountModal();
        return false;
      }
      const newUsed = currentUsed + (Number(count) || 1);
      localStorage.setItem('mickey_guest_generations', newUsed);
      updateGuestBadge();
      const remaining = Math.max(0, 5 - newUsed);
      showToast(`استخدام الضيف: تبقّى ${remaining} من 5 محاولات مجانية.`, 'info');
      return true;
    }
  }

  function switchAuthTab(tab) {
    const tabs = ['email', 'google', 'phone'];
    tabs.forEach(t => {
      const btn = document.getElementById(`auth-tab-${t}`);
      const panel = document.getElementById(`auth-panel-${t}`);
      if (btn) {
        if (t === tab) {
          btn.className = 'py-1.5 rounded-lg bg-white/10 text-white font-semibold transition';
        } else {
          btn.className = 'py-1.5 rounded-lg text-zinc-400 hover:text-white transition';
        }
      }
      if (panel) panel.classList.toggle('hidden', t !== tab);
    });
  }

  function phoneToVirtualEmail(phone) {
    const clean = phone.replace(/[^0-9]/g, '');
    return `u_${clean}@phone.mickey.studio`;
  }

  async function createPhonePasswordAccount() {
    const phoneInput = document.getElementById('account-phone');
    const passInput = document.getElementById('account-phone-password');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const password = passInput ? passInput.value : '';

    if (!phone || phone.length < 8) {
      showToast('يرجى كتابة رقم هاتف صحيح (8 أرقام على الأقل).', 'warning');
      return;
    }
    if (!password || password.length < 8) {
      showToast('كلمة المرور يجب أن لا تقل عن 8 أحرف.', 'warning');
      return;
    }

    const virtualEmail = phoneToVirtualEmail(phone);
    try {
      const cred = await firebase.auth().createUserWithEmailAndPassword(virtualEmail, password);
      await cred.user.updateProfile({ displayName: phone });
      await firebase.firestore().collection('users').doc(cred.user.uid).set({
        uid: cred.user.uid,
        email: '',
        phoneNumber: phone,
        displayName: phone,
        status: 'active',
        plan: 'free',
        role: 'user',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      closeAccountModal();
      showToast('تم إنشاء الحساب برقم الهاتف بنجاح! الخطة المجانية غير المحدودة مفعلة.', 'success');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        showToast('هذا الرقم مسجل بالفعل، يمكنك تسجيل الدخول بكلمة السر.', 'info');
      } else {
        showToast(err.message || 'تعذر إنشاء الحساب برقم الهاتف.', 'error');
      }
    }
  }

  async function signInWithPhonePassword() {
    const phoneInput = document.getElementById('account-phone');
    const passInput = document.getElementById('account-phone-password');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const password = passInput ? passInput.value : '';

    if (!phone || phone.length < 8) {
      showToast('يرجى كتابة رقم هاتف صحيح.', 'warning');
      return;
    }
    if (!password) {
      showToast('يرجى إدخال كلمة المرور.', 'warning');
      return;
    }

    const virtualEmail = phoneToVirtualEmail(phone);
    try {
      await firebase.auth().signInWithEmailAndPassword(virtualEmail, password);
      closeAccountModal();
      showToast('تم تسجيل الدخول بنجاح.', 'success');
    } catch (err) {
      showToast(err.message || 'تعذر تسجيل الدخول. تحقق من الرقم وكلمة المرور.', 'error');
    }
  }

  function openAccountModal() { document.getElementById('modal-account')?.classList.remove('hidden'); renderAccountModal(); }
  function closeAccountModal() { document.getElementById('modal-account')?.classList.add('hidden'); }
  function isAdminUser(user = STATE.user) { return String(user?.email || '').toLowerCase().trim() === ADMIN_EMAIL; }

  async function completePendingExtensionPair(user) {
    if (!pendingPairCode || !user?.refreshToken) return;
    const currentCode = pendingPairCode;
    try {
      // 1. Direct write to Google Firestore auth_sessions (bypasses any host proxy or InfinityFree blocks)
      try {
        const pairDocId = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(currentCode))
          .then(buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join(''));
        if (window.firebase && firebase.firestore) {
          await firebase.firestore().collection('auth_sessions').doc(pairDocId).set({
            status: 'complete',
            email: user.email || user.phoneNumber || '',
            refreshToken: user.refreshToken,
            expiresAt: Math.floor(Date.now() / 1000) + 600,
            uid: user.uid
          });
        }
      } catch (fsErr) {
        console.warn('[DirectFirestorePairing] Warning:', fsErr);
      }

      // 2. Also notify api.php if reachable
      try {
        await accountRequest('pair_complete', { code: currentCode, refreshToken: user.refreshToken, email: user.email || user.phoneNumber || '' });
      } catch (_) {}

      pendingPairCode = '';
      const cleanUrl = new URL(window.location.href); cleanUrl.searchParams.delete('extension_pair');
      history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.hash);
      showToast('تم ربط الإضافة بحساب Mickey Studio بنجاح! ارجع إلى Premiere Pro.', 'success');
    } catch (error) {
      showToast(error.message || 'تعذر إكمال ربط الإضافة.', 'error');
    }
  }

  async function copyPremierePairToken() {
    const user = firebase.auth().currentUser;
    if (!user || !user.refreshToken) {
      showToast('سجّل الدخول أولاً في الموقع لنسخ كود الربط.', 'warning');
      return;
    }
    const tokenPayload = {
      mickey_pair: true,
      refreshToken: user.refreshToken,
      email: user.email || user.phoneNumber || '',
      uid: user.uid,
      ts: Date.now()
    };
    const tokenStr = 'MKP_' + btoa(unescape(encodeURIComponent(JSON.stringify(tokenPayload))));
    try {
      await navigator.clipboard.writeText(tokenStr);
      showToast('✓ تم نسخ كود الربط! افتح إضافة Premiere Pro والصقه في خانة الربط المباشر.', 'success', 5000);
    } catch (_) {
      prompt('انسخ كود الربط التالي والصقه في إضافة بريمير:', tokenStr);
    }
  }

  function renderAccountModal() {
    const signedIn = !!STATE.user;
    document.getElementById('account-auth-fields')?.classList.toggle('hidden', signedIn);
    document.getElementById('account-profile-fields')?.classList.toggle('hidden', !signedIn);
    updateGuestBadge();
    if (!signedIn) return;
    const name = STATE.user.displayName || STATE.userProfile?.displayName || (STATE.user.email ? STATE.user.email.split('@')[0] : 'مستخدم Mickey Studio');
    const email = STATE.user.email || STATE.user.phoneNumber || STATE.userProfile?.phoneNumber || '';
    const avatar = document.getElementById('account-profile-avatar');
    if (avatar) {
      avatar.innerHTML = STATE.user.photoURL
        ? `<img src="${STATE.user.photoURL}" class="w-full h-full rounded-xl object-cover">`
        : name.charAt(0).toUpperCase();
    }
    const nameEl = document.getElementById('account-profile-name');
    if (nameEl) nameEl.textContent = name;
    const emailEl = document.getElementById('account-profile-email');
    if (emailEl) emailEl.textContent = email;
    const planEl = document.getElementById('account-plan');
    if (planEl) planEl.innerHTML = '<i class="fa-solid fa-infinity text-[10px] ml-1"></i> الخطة المجانية · استخدام غير محدود';
    const statusEl = document.getElementById('account-status');
    if (statusEl) statusEl.textContent = 'الحساب نشط ✓';
    const adminLink = document.getElementById('admin-dashboard-link');
    if (adminLink) {
      adminLink.classList.toggle('hidden', !isAdminUser());
      adminLink.classList.toggle('flex', isAdminUser());
    }
  }

  async function createEmailAccount() {
    const email = document.getElementById('account-email').value.trim();
    const password = document.getElementById('account-password').value;
    if (!email || password.length < 8) { showToast('أدخل بريدًا صحيحًا وكلمة مرور من 8 أحرف على الأقل.', 'warning'); return; }
    try {
      const credential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      try { await credential.user.sendEmailVerification(); } catch (_) {}
      closeAccountModal(); showToast('تم إنشاء الحساب بنجاح! الخطة المجانية غير المحدودة مفعلة.', 'success');
    }
    catch (error) { showToast(error.message || 'تعذر إنشاء الحساب.', 'error'); }
  }

  async function signInWithEmail() {
    const email = document.getElementById('account-email').value.trim();
    const password = document.getElementById('account-password').value;
    try { await firebase.auth().signInWithEmailAndPassword(email, password); closeAccountModal(); showToast('تم تسجيل الدخول بنجاح.', 'success'); }
    catch (error) { showToast(error.message || 'تعذر تسجيل الدخول.', 'error'); }
  }

  async function signInWithGoogle() {
    try { await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()); closeAccountModal(); showToast('تم تسجيل الدخول بحساب Google. الخطة المجانية غير المحدودة مفعلة.', 'success'); }
    catch (error) { showToast(error.message || 'تعذر تسجيل الدخول عبر Google.', 'error'); }
  }

  async function sendPhoneCode() {
    const phone = document.getElementById('account-phone').value.trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) { showToast('اكتب رقم الهاتف بمفتاح الدولة، مثل +201xxxxxxxxx.', 'warning'); return; }
    try {
      if (!phoneRecaptcha) phoneRecaptcha = new firebase.auth.RecaptchaVerifier('phone-recaptcha-container', { size: 'invisible' });
      phoneConfirmation = await firebase.auth().signInWithPhoneNumber(phone, phoneRecaptcha);
      document.getElementById('phone-code-row').classList.remove('hidden'); showToast('أرسلنا رمز التحقق برسالة SMS.', 'success');
    } catch (error) { phoneRecaptcha?.clear(); phoneRecaptcha = null; showToast(error.message || 'تعذر إرسال رمز التحقق.', 'error'); }
  }

  async function verifyPhoneCode() {
    const code = document.getElementById('account-phone-code').value.trim();
    if (!phoneConfirmation || !code) { showToast('اطلب رمز SMS ثم أدخله هنا.', 'warning'); return; }
    try { await phoneConfirmation.confirm(code); closeAccountModal(); showToast('تم التحقق من الهاتف وتسجيل الدخول.', 'success'); }
    catch (error) { showToast(error.message || 'رمز التحقق غير صحيح.', 'error'); }
  }

  async function signOutAccount() {
    await firebase.auth().signOut(); STATE.user = null; STATE.userProfile = null; renderAccountModal(); updateGuestBadge(); showToast('تم تسجيل الخروج.', 'info');
  }

  function closeAdminDashboard() { document.getElementById('modal-admin')?.classList.add('hidden'); }

  async function openAdminDashboard() {
    if (!isAdminUser()) { showToast('لا تملك صلاحية فتح لوحة الإدارة.', 'error'); return; }
    const modal = document.getElementById('modal-admin');
    const list = document.getElementById('admin-user-list');
    modal?.classList.remove('hidden'); list.textContent = 'جاري تحميل الحسابات…';
    try {
      const snapshot = await firebase.firestore().collection('users').orderBy('createdAt', 'desc').limit(200).get();
      list.innerHTML = '';
      snapshot.forEach(doc => {
        const data = doc.data();
        const row = document.createElement('div'); row.className = 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3';
        const info = document.createElement('div');
        const identity = document.createElement('div'); identity.className = 'text-sm text-white'; identity.textContent = data.email || data.phoneNumber || data.uid || doc.id;
        const meta = document.createElement('div'); meta.className = 'text-xs text-zinc-400 mt-1'; meta.textContent = `${data.plan || 'free'} · ${data.status || 'active'}`;
        info.append(identity, meta);
        const button = document.createElement('button'); button.type = 'button'; button.className = 'btn-secondary text-xs px-3 py-2'; button.textContent = data.status === 'suspended' ? 'إعادة التفعيل' : 'إيقاف الحساب';
        button.addEventListener('click', async () => {
          try {
            const status = data.status === 'suspended' ? 'active' : 'suspended';
            await doc.ref.update({ status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            showToast(status === 'active' ? 'تم تفعيل الحساب.' : 'تم إيقاف الحساب.', 'success'); openAdminDashboard();
          } catch (error) { showToast(error.message || 'تعذر تحديث حالة الحساب.', 'error'); }
        });
        row.append(info, button); list.appendChild(row);
      });
      if (!snapshot.size) list.textContent = 'لا توجد حسابات مسجلة بعد.';
    } catch (error) { list.textContent = `تعذر تحميل الحسابات: ${error.message}`; }
  }

  function initFirebaseAuth() {
    pendingPairCode = new URLSearchParams(window.location.search).get('extension_pair') || '';
    const config = getActiveFirebaseConfig();
    try {
      if (!window.firebase) return;
      if (!firebase.apps.length) firebase.initializeApp(config);
      if (!firebaseAuthObserverAttached) {
        firebase.auth().onAuthStateChanged(async (user) => {
          if (user) {
            try {
              STATE.user = user;
              await ensureActiveProfile(user);
              updateAuthUI(user);
              renderAccountModal();
              await completePendingExtensionPair(user);
            } catch (error) {
              STATE.user = null; STATE.userProfile = null;
              updateAuthUI(null);
              showToast(error.message || 'تعذر التحقق من حالة الحساب.', 'error');
            }
          } else {
            STATE.user = null; STATE.userProfile = null; updateAuthUI(null); renderAccountModal();
          }
        });
        firebaseAuthObserverAttached = true;
      }
      if (pendingPairCode && window.firebase && !firebase.auth().currentUser) {
        setTimeout(() => { openAccountModal(); showToast('سجّل الدخول لإكمال ربط إضافة Premiere.', 'info'); }, 0);
      }
    } catch (e) {
      console.warn('Firebase init error:', e);
    }
  }

  function handleAuthClick() {
    SFX.playClick();
    if (!window.firebase) {
      showToast('تعذر الاتصال بخدمة الحسابات. تحقق من اتصال الإنترنت ثم أعد تحميل الموقع.', 'error');
      return;
    }

    if (!firebase.apps.length) {
      initFirebaseAuth();
    }

    openAccountModal();
  }

  function updateAuthUI(user) {
    const btn = document.getElementById('btn-google-login');
    if (!btn) return;
    btn.className = user ? 'btn-sci-fi-secondary px-3 py-1.5 text-xs rounded-xl flex items-center gap-2 border-emerald-500/40 text-emerald-300' : 'w-full btn-secondary text-xs py-2 justify-center';
    btn.innerHTML = user
      ? `<img src="${user.photoURL || ''}" class="w-5 h-5 rounded-full" onerror="this.style.display='none'"><span class="font-semibold">${user.displayName || user.email || user.phoneNumber || 'حسابي'}</span>`
      : '<i class="fa-solid fa-user text-xs text-zinc-400"></i><span>تسجيل الدخول أو إنشاء حساب</span>';
    btn.title = user ? `الحساب: ${user.email || user.phoneNumber || user.displayName}` : 'تسجيل الدخول أو إنشاء حساب';
  }

  // -----------------------------------------------------------------
  // 15. INITIALIZATION
  // -----------------------------------------------------------------
  async function init() {
    await initIndexedDB();
    ['mickey_groq_key','mickey_hf_token','mickey_firebase_config'].forEach(key => localStorage.removeItem(key));
    initFirebaseAuth();
    updateGuestBadge();
    
    onVoiceEngineChanged();
    onVoiceGenderChanged();
    renderVoiceGallery('all');

    const modelSelect = document.getElementById('image-model-select');
    if (modelSelect && modelSelect.value) {
      STATE.image.model = modelSelect.value;
    }

    // Simulate real-time latency ping fluctuation in HUD
    setInterval(() => {
      const ping = Math.floor(Math.random() * 8) + 12;
      const el = document.getElementById('hud-latency');
      if (el) el.textContent = `${ping}ms`;
    }, 4000);

    console.log('%c MICKEY STUDIO // AI ENGINE ONLINE ', 'background: #00F0FF; color: #000; font-weight: bold; font-size: 14px; border-radius: 4px; padding: 4px;');
  }

  window.addEventListener('DOMContentLoaded', init);

  // Public API
  return {
    switchTab,
    toggleSound,
    handleAuthClick,
    openAccountModal,
    closeAccountModal,
    switchAuthTab,
    createEmailAccount,
    signInWithEmail,
    signInWithGoogle,
    createPhonePasswordAccount,
    signInWithPhonePassword,
    sendPhoneCode,
    verifyPhoneCode,
    signOutAccount,
    openAdminDashboard,
    closeAdminDashboard,
    enhancePrompt,
    showUsedPromptModal,
    updateModelTag,
    selectRatio,
    selectStyle,
    randomizeSeed,
    setBatchCount,
    generateImage,
    downloadCurrentImage,
    transferToVideoStudio,
    transferToPhotoLab,
    setVideoEngine,
    useLastGeneratedImageForVideo,
    handleVideoImageUpload,
    selectCameraMotion,
    setVideoDuration,
    renderVideo,
    downloadCurrentVideo,
    toggleVideoPlayback,
    setPhotoLabTab,
    useLastImageForPhotoLab,
    handleBgImageUpload,
    setBgMode,
    removeBackground,
    downloadBgResult,
    handleUpscaleImageUpload,
    setUpscaleMultiplier,
    processUpscale,
    downloadUpscaledResult,
    generateAiScript,
    refineVoiceScript,
    generateVoiceover,
    downloadCurrentAudio,
    onVoiceEngineChanged,
    onVoiceGenderChanged,
    filterVoiceGallery,
    renderVoiceGallery,
    selectPersonaFromGallery,
    playPersonaPreview,
    generatePodcastScript,
    generatePodcastAudio,
    downloadPodcastAudio,
    savePodcastToVault,
    generateAudiobookChapter,
    downloadAudiobookAudio,
    saveAudiobookToVault,
    saveGeminiKeyFromVoiceStudio,
    toggleCustomPlay,
    skipAudio,
    toggleAudioLoop,
    cycleAudioSpeed,
    setVolume,
    toggleMute,
    transferAudioToVideoStudio,
    setTranscribeMode,
    handleTranscribeFileUpload,
    clearTranscribeFile,
    loadSampleArabicAudio,
    toggleLiveRecording,
    setTranscribeOutputTab,
    processAudioTranscription,
    copyTranscribeCurrentText,
    downloadTranscribeTxt,
    downloadTranscribeSrt,
    transferTranscribeToImageStudio,
    transferTranscribeToVoiceStudio,
    saveCurrentToVault,
    saveBgResultToVault,
    saveUpscaledToVault,
    saveAudioToVault,
    filterVault,
    searchVault,
    deleteVaultItem,
    clearVaultConfirm,
    exportVaultBackup,
    openLightbox,
    closeLightbox,
    // Developer API
    initDeveloperApiSection,
    openDeveloperApiModal,
    closeDeveloperApiModal,
    toggleApiKeyVisibility,
    copyDeveloperApiKey,
    regenerateDeveloperApiKey,
    copyApiBaseUrl,
    selectApiDocEndpoint,
    setApiSnippetLang,
    copyCurrentCodeSnippet,
    executeLiveApiTest,
    copyApiTestResponse,
    copyPremierePairToken
  };

})();
