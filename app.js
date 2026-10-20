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
      width: 1280,
      height: 720,
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
        autocut: {
      subTab: 'silence',
      silenceFile: null,
      lastSilences: [],
      lastViralClips: [],
      lastChapters: [],
      lastCensorMatches: []
    },
    settings: {
      cloudflareWorkerUrl: localStorage.getItem('mickey_cloudflare_worker_url') || 'https://mickey-studio-api.kma279500.workers.dev',
      gradioSpace: localStorage.getItem('mickey_gradio_space') || 'Lightricks/ltx-video-distilled',
      sfxEnabled: false
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
      // تم إلغاء أصوات اللمس والنقر داخل الموقع نهائياً بناءً على طلب المستخدم
      return;
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
  window.CryptoVault = CryptoVault;

  // -----------------------------------------------------------------
  // 3. INDEXEDDB PERSISTENCE (MY AI VAULT)
  // -----------------------------------------------------------------
  const DB_NAME = 'MickeyStudioVaultDB';
  const DB_STORE = 'vault_assets';
  let dbInstance = null;

  function initIndexedDB() {
    return new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
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
      } catch (err) {
        console.warn('IndexedDB unavailable:', err);
        resolve(null);
      }
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
  window.showToast = showToast;

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

  function findGradioFile(value) {
    if (!value) return null;
    if (Array.isArray(value)) {
      for (const item of value) { const found = findGradioFile(item); if (found) return found; }
    } else if (typeof value === 'object') {
      if (value.url || value.path) return value.url || value.path;
      for (const child of Object.values(value)) { const found = findGradioFile(child); if (found) return found; }
    } else if (typeof value === 'string' && /^(https?:|blob:|data:|\/)/i.test(value)) {
      return value;
    }
    return null;
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

  async function generateWithCloudflareFlux(prompt, width, height) {
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
      body: JSON.stringify({ prompt, width, height })
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

  // -----------------------------------------------------------------
  // DYNAMIC STUDIO MODULE LOADER (Item 1: Lazy-Loading)
  // -----------------------------------------------------------------
  const STUDIO_MODULE_MAP = {
    'image-studio': 'studios/image-studio.js',
    'video-studio': 'studios/video-studio.js',
    'photo-lab': 'studios/photo-lab.js',
    'voice-studio': 'studios/voice-studio.js',
    'podcast-studio': 'studios/voice-studio.js',
    'audiobook-studio': 'studios/voice-studio.js',
    'transcribe-studio': 'studios/transcribe-studio.js',
    'autocut-suite': 'studios/autocut-suite.js',
    'vault-gallery': 'studios/vault-gallery.js',
    'developer-api': 'studios/developer-api.js'
  };

  const loadedStudioScripts = new Set();
  const loadingPromises = new Map();

  async function ensureStudioLoaded(tabId) {
    const scriptPath = STUDIO_MODULE_MAP[tabId];
    if (!scriptPath) return;
    if (loadedStudioScripts.has(scriptPath)) return;

    if (loadingPromises.has(scriptPath)) {
      return loadingPromises.get(scriptPath);
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptPath + '?v=2.6';
      script.async = true;
      script.onload = () => {
        loadedStudioScripts.add(scriptPath);
        loadingPromises.delete(scriptPath);
        resolve();
      };
      script.onerror = () => {
        loadingPromises.delete(scriptPath);
        reject(new Error('فشل تحميل الاستوديو: ' + scriptPath));
      };
      document.head.appendChild(script);
    });

    loadingPromises.set(scriptPath, promise);
    return promise;
  }

  // 12. TAB SWITCHER & LIGHTBOX
  // -----------------------------------------------------------------
  function switchTab(tabId) {
    if (!tabId) tabId = 'landing';
    if (tabId === 'dashboard') {
      if (!STATE.user) {
        showToast('لوحة التحكم مخصصة للمستخدمين المسجلين. يرجى تسجيل الدخول أولاً.', 'warning');
        openAccountModal();
        if (STATE.activeTab && STATE.activeTab !== 'dashboard') return;
        tabId = 'landing';
      } else if (!isDashboardAllowed(STATE.user)) {
        showToast('لوحة التحكم متاحة فقط للإيميل المحدد المسجل في فاير بيز.', 'warning');
        if (STATE.activeTab && STATE.activeTab !== 'dashboard') return;
        tabId = 'landing';
      }
    }
    STATE.activeTab = tabId;
    SFX.playClick();

    if (window.location.hash !== '#' + tabId) {
      window.history.pushState(null, '', '#' + tabId);
    }

    // Hide all web views and studio sections
    document.querySelectorAll('.web-view, .studio-section').forEach(sec => sec.classList.add('hidden'));

    // Show target section
    const targetSection = document.getElementById('section-' + tabId);
    if (targetSection) {
      targetSection.classList.remove('hidden');
    }

    // Update navigation active states
    document.querySelectorAll('.top-nav-link').forEach(link => link.classList.remove('active'));
    const targetNavLink = document.getElementById('nav-btn-' + tabId);
    if (targetNavLink) targetNavLink.classList.add('active');

    // Update universal studio subnav visibility & active state
    const subNav = document.getElementById('mickey-studio-subnav');
    if (subNav) {
      if (tabId === 'landing' || tabId === 'dashboard') {
        subNav.classList.add('hidden');
      } else {
        subNav.classList.remove('hidden');
        const label = document.getElementById('studio-current-label');
        if (label) {
          const titles = {
            'image-studio': '🎨 استوديو توليد الصور',
            'video-studio': '🎬 استوديو الفيديو',
            'voice-studio': '🎙️ التعليق الصوتي',
            'motion-builder': '✨ محرر الموشن',
            'photo-lab': '🔬 معمل الصور',
            'transcribe-studio': '📝 تفريغ وتحليل الصوت',
            'podcast-studio': '🎙️ استوديو البودكاست',
            'audiobook-studio': '📖 الكتب والروايات',
            'autocut-suite': '✂️ قص السكتات والزووم',
            'vault-gallery': '📁 معرض أعمالي',
            'developer-api': '💻 بوابة المطورين'
          };
          label.textContent = titles[tabId] || 'استوديو نشط';
        }
      }
    }

    // Scroll smoothly to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close mobile drawer if open
    const mobileDrawer = document.getElementById('mobile-nav-drawer');
    if (mobileDrawer && !mobileDrawer.classList.contains('hidden')) {
      mobileDrawer.classList.add('hidden');
    }

    // Tab-specific lifecycle actions
    if (tabId === 'dashboard') {
      renderDashboardProjects('all');
      updateDashboardMeters();
    }
    if (tabId === 'vault-gallery') {
      renderVaultGallery();
    }
    if (tabId === 'developer-api') {
      initDeveloperApiSection();
    }
    if (tabId === 'motion-builder') initMotionBuilder();
    if (tabId === 'motion-editor') {
      initMotionEditorControls();
      if (motionEditorScene) motionEditorRender();
    }
  }

  // -----------------------------------------------------------------
  // 12.5 UNIFIED TOOLS REGISTRY RENDERER
  // -----------------------------------------------------------------
  async function loadAndRenderToolsGrid() {
    const container = document.getElementById('studios-registry-grid');
    if (!container) return;

    let registry = (typeof window !== 'undefined' && window.MickeyToolsRegistry) ? window.MickeyToolsRegistry : null;
    if (!registry) {
      try {
        const res = await fetch('shared/tools-registry.json?v=' + Date.now());
        if (res.ok) {
          registry = await res.json();
        }
      } catch (err) {
        console.warn('Could not fetch tools-registry.json, checking fallback:', err);
      }
    }

    if (!registry || !Array.isArray(registry.tools)) {
      container.innerHTML = '<div class="p-6 text-center text-zinc-400 text-xs">تعذر تحميل سجل الأدوات المشترك.</div>';
      return;
    }

    const groups = registry.groups || [
      'المونتاج',
      'النص والمحتوى',
      'الصوت',
      'الصور والفيديو',
      'الموشن والمنصات',
      'أدوات المشروع'
    ];

    const groupDescriptions = {
      'المونتاج': 'أدوات المونتاج الذكي وقص المشاهد وتعديل الإيقاع الزمني',
      'النص والمحتوى': 'استخراج وتعديل النصوص والكابشنز وصناعة المقاطع الفيروسية',
      'الصوت': 'توليد الأصوات الطبيعية وتفريغ التسجيلات وتنقية الصوت',
      'الصور والفيديو': 'توليد وتحريك الصور وتعديلها بنماذج الذكاء الاصطناعي',
      'الموشن والمنصات': 'تصميم مشاهد الموشن جرافيك والمقاسات الآمنة للشبكات',
      'أدوات المشروع': 'إدارة وتنظيم ملفات المشروع والنسخ الاحتياطي وبوابة المطورين'
    };

    const groupColors = {
      'المونتاج': 'emerald',
      'النص والمحتوى': 'cyan',
      'الصوت': 'violet',
      'الصور والفيديو': 'indigo',
      'الموشن والمنصات': 'amber',
      'أدوات المشروع': 'rose'
    };

    const iconMap = {
      'scissors': '<i class="fa-solid fa-scissors"></i>',
      'zoom-in': '<i class="fa-solid fa-magnifying-glass-plus"></i>',
      'file-text': '<i class="fa-regular fa-file-lines"></i>',
      'file-audio': '<i class="fa-solid fa-file-audio"></i>',
      'captions': '<i class="fa-solid fa-closed-captioning"></i>',
      'volume-x': '<i class="fa-solid fa-volume-xmark"></i>',
      'flame': '<i class="fa-solid fa-fire"></i>',
      'bookmark': '<i class="fa-regular fa-bookmark"></i>',
      'sparkles': '<i class="fa-solid fa-wand-magic-sparkles"></i>',
      'mic': '<i class="fa-solid fa-microphone"></i>',
      'podcast': '<i class="fa-solid fa-podcast"></i>',
      'book-open': '<i class="fa-solid fa-book-open"></i>',
      'image': '<i class="fa-regular fa-image"></i>',
      'wand-sparkles': '<i class="fa-solid fa-wand-sparkles"></i>',
      'film': '<i class="fa-solid fa-film"></i>',
      'layers': '<i class="fa-solid fa-layer-group"></i>',
      'smartphone': '<i class="fa-solid fa-mobile-screen"></i>',
      'star': '<i class="fa-regular fa-star"></i>',
      'folder-tree': '<i class="fa-solid fa-folder-tree"></i>',
      'folder-archive': '<i class="fa-regular fa-folder"></i>',
      'activity': '<i class="fa-solid fa-chart-line"></i>',
      'code': '<i class="fa-solid fa-code"></i>',
      'list-todo': '<i class="fa-solid fa-list-check"></i>'
    };

    let html = '';
    let groupIndex = 1;

    for (const groupName of groups) {
      const toolsInGroup = registry.tools.filter(t => t.group === groupName && !t.deprecated && !t.hideFromGrid);
      if (toolsInGroup.length === 0) continue;

      toolsInGroup.sort((a, b) => (a.order || 99) - (b.order || 99));

      const color = groupColors[groupName] || 'indigo';
      const desc = groupDescriptions[groupName] || 'أدوات احترافية متكاملة';

      html += `
        <div class="space-y-6 pt-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-${color}-500/10 border border-${color}-500/20 text-${color}-400 flex items-center justify-center font-bold text-sm">${groupIndex}</div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-bold text-white">${groupName}</h3>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">${toolsInGroup.length} أدوات</span>
              </div>
              <p class="text-xs text-zinc-400 mt-0.5">${desc}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      `;

      for (const tool of toolsInGroup) {
        const targetTab = tool.target?.site ? tool.target.site.replace('section-', '') : null;
        const targetSection = targetTab ? document.getElementById('section-' + targetTab) : null;
        const isWeb = (tool.availableIn === 'site' || tool.availableIn === 'both') && targetSection !== null;
        const iconHtml = iconMap[tool.icon] || '<i class="fa-solid fa-cube"></i>';

        if (isWeb) {
          const badgeHtml = tool.badge
            ? `<span class="mega-badge text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">${tool.badge}</span>`
            : '';

          html += `
            <div class="feature-card group cursor-pointer" onclick="MickeyStudio.switchTab('${targetTab}')">
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <div class="w-10 h-10 rounded-xl bg-${color}-500/10 border border-${color}-500/20 text-${color}-400 flex items-center justify-center text-lg">
                    ${iconHtml}
                  </div>
                  ${badgeHtml}
                </div>
                <div>
                  <h4 class="text-sm font-bold text-white group-hover:text-${color}-300 transition-colors">${tool.arabicName}</h4>
                  <p class="text-xs text-zinc-400 mt-1 leading-relaxed">${tool.shortBenefit}</p>
                </div>
              </div>
              <div class="pt-4 border-t border-white/5 mt-4 flex items-center justify-between">
                <span class="text-[10px] font-mono text-zinc-500">متاح أونلاين</span>
                <button type="button" class="btn-secondary text-xs py-1 px-3 pointer-events-none group-hover:bg-zinc-800 group-hover:text-white transition-colors">افتح الاستوديو ↗</button>
              </div>
            </div>
          `;
        } else {
          html += `
            <div class="feature-card tool-card-disabled opacity-60 cursor-not-allowed">
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <div class="w-10 h-10 rounded-xl bg-zinc-800/80 border border-white/10 text-zinc-400 flex items-center justify-center text-lg">
                    ${iconHtml}
                  </div>
                  <span class="badge-premiere-only">متاح في بريمير</span>
                </div>
                <div>
                  <h4 class="text-sm font-bold text-zinc-300">${tool.arabicName}</h4>
                  <p class="text-xs text-zinc-500 mt-1 leading-relaxed">${tool.shortBenefit}</p>
                </div>
              </div>
              <div class="pt-4 border-t border-white/5 mt-4 flex items-center justify-between text-zinc-500">
                <span class="text-[10px] font-mono">Adobe Premiere Pro CEP</span>
                <span class="text-xs text-zinc-500">حصري للإضافة 🔒</span>
              </div>
            </div>
          `;
        }
      }

      html += `
          </div>
        </div>
      `;

      groupIndex++;
    }

    container.innerHTML = html;
  }

  let dashboardCurrentFilter = 'all';
  async function renderDashboardProjects(filter = 'all') {
    dashboardCurrentFilter = filter;
    const grid = document.getElementById('dashboard-projects-grid');
    if (!grid) return;

    ['all', 'image', 'video', 'audio'].forEach(f => {
      const btn = document.getElementById('dash-filter-' + f);
      if (btn) {
        if (f === filter) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });

    try {
      const allAssets = await getAllAssetsFromDB();
      const filtered = filter === 'all' ? allAssets : allAssets.filter(item => item.type === filter);

      if (!filtered.length) {
        grid.innerHTML = `
          <div class="col-span-full p-12 text-center text-zinc-500 bg-zinc-900/30 rounded-2xl border border-dashed border-white/10 space-y-3">
            <i class="fa-regular fa-folder-open text-3xl text-zinc-600"></i>
            <p class="text-sm text-zinc-400">لا توجد ملفات أو مشاريع محفوظة في هذا القسم بعد.</p>
            <button type="button" onclick="MickeyStudio.switchTab('image-studio')" class="btn-primary text-xs py-2 px-4">ابدأ بإنشاء أول مشروع ↗</button>
          </div>
        `;
        return;
      }

      const sorted = filtered.sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0)).slice(0, 12);
      grid.innerHTML = '';
      sorted.forEach(item => {
        const card = document.createElement('div');
        card.className = 'studio-card p-3 flex flex-col justify-between space-y-3 group border border-white/5 hover:border-white/20 transition-all rounded-xl bg-zinc-900/60';

        let previewHtml = '';
        const thumbUrl = item.thumbUrl || item.thumbnailUrl || item.url;
        const typeBadge = item.type === 'image' ? 'صورة' : item.type === 'video' ? 'فيديو' : item.type === 'audio' ? 'صوت' : 'تفريغ';

        if (item.type === 'image') {
          previewHtml = `
            <div class="w-full h-36 rounded-lg overflow-hidden bg-black/60 cursor-pointer relative" onclick="MickeyStudio.openLightbox('${item.url}')">
              <img src="${thumbUrl}" alt="صورة" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200">
              <span class="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-md text-[9px] font-mono text-zinc-300 px-1.5 py-0.5 rounded">${typeBadge}</span>
            </div>
          `;
        } else if (item.type === 'video') {
          previewHtml = `
            <div class="w-full h-36 rounded-lg overflow-hidden bg-black/80 flex items-center justify-center relative">
              <video src="${item.url}" preload="metadata" controls class="w-full h-full object-cover"></video>
              <span class="absolute top-1.5 right-1.5 bg-cyan-500/20 text-cyan-300 text-[9px] font-bold px-1.5 py-0.5 rounded">${typeBadge}</span>
            </div>
          `;
        } else if (item.type === 'audio') {
          previewHtml = `
            <div class="w-full h-36 rounded-lg bg-black/60 p-3 flex flex-col items-center justify-center space-y-2">
              <i class="fa-solid fa-microphone-lines text-emerald-400 text-2xl"></i>
              <audio src="${item.url}" preload="none" controls class="w-full"></audio>
            </div>
          `;
        } else {
          previewHtml = `
            <div class="w-full h-36 rounded-lg bg-zinc-950/80 border border-white/5 p-3 flex flex-col justify-between overflow-hidden">
              <span class="text-[10px] text-indigo-400 font-semibold"><i class="fa-solid fa-file-audio text-xs"></i> تفريغ صوتي</span>
              <p class="text-[11px] text-zinc-300 line-clamp-3 leading-relaxed">${(item.transcript || item.prompt || '').slice(0, 100)}...</p>
            </div>
          `;
        }

        const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleDateString('ar-EG') : '';

        card.innerHTML = `
          ${previewHtml}
          <div class="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-white/5">
            <span>${dateStr}</span>
            <div class="flex items-center gap-2">
              ${item.url ? `<a href="${item.url}" download="project_${item.id}" class="text-zinc-300 hover:text-white" title="تنزيل"><i class="fa-solid fa-download text-xs"></i></a>` : ''}
              <button type="button" class="text-zinc-500 hover:text-red-400" title="حذف" onclick="MickeyStudio.deleteDashboardProject('${item.id}')"><i class="fa-regular fa-trash-can text-xs"></i></button>
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
    } catch (e) {
      console.warn('Dashboard projects render error:', e);
    }
  }

  function filterDashboardProjects(filter) {
    SFX.playClick();
    renderDashboardProjects(filter);
  }

  async function deleteDashboardProject(id) {
    if (!confirm('هل تريد بالتأكيد حذف هذا الملف من المعرض؟')) return;
    SFX.playClick();
    await deleteAssetFromDB(id);
    renderDashboardProjects(dashboardCurrentFilter);
    updateDashboardMeters();
    showToast('تم حذف الملف من المعرض بنجاح.', 'info');
  }

  async function updateDashboardMeters() {
    try {
      const allAssets = await getAllAssetsFromDB();
      const assetsCountEl = document.getElementById('dashboard-meter-assets');
      if (assetsCountEl) assetsCountEl.textContent = allAssets.length;

      const user = STATE.user || (window.firebase && firebase.auth ? firebase.auth().currentUser : null);
      const meterGenEl = document.getElementById('dashboard-meter-generations');
      const meterSubtextEl = document.getElementById('dashboard-meter-subtext');
      const meterBarEl = document.getElementById('dashboard-meter-bar');
      const planEl = document.getElementById('dashboard-meter-plan');

      if (user) {
        if (meterGenEl) meterGenEl.textContent = 'غير محدود';
        if (meterSubtextEl) meterSubtextEl.textContent = 'حسابك مفعل بالكامل';
        if (meterBarEl) meterBarEl.style.width = '100%';
        if (planEl) planEl.textContent = 'حساب مجاني بالكامل';

        const nameEl = document.getElementById('dashboard-user-name');
        if (nameEl) nameEl.textContent = `مرحباً، ${user.displayName || user.email || 'المبدع'}`;
        const emailEl = document.getElementById('dashboard-user-email');
        if (emailEl) emailEl.textContent = user.email || user.phoneNumber || '';
        const avatarEl = document.getElementById('dashboard-user-avatar');
        if (avatarEl) {
          avatarEl.innerHTML = user.photoURL
            ? `<img src="${user.photoURL}" class="w-full h-full rounded-2xl object-cover">`
            : `<i class="fa-solid fa-user"></i>`;
        }
      } else {
        const used = Number(localStorage.getItem('mickey_guest_generations') || 0);
        const remaining = Math.max(0, 5 - used);
        if (meterGenEl) meterGenEl.textContent = `${remaining} تجريبية`;
        if (meterSubtextEl) meterSubtextEl.textContent = 'أنشئ حساباً مجانياً للاستخدام غير المحدود';
        if (meterBarEl) meterBarEl.style.width = `${(remaining / 5) * 100}%`;
        if (planEl) planEl.textContent = 'زائر (تجريبي)';
      }
    } catch (e) {
      console.warn('updateDashboardMeters error:', e);
    }
  }

  function toggleMobileMenu() {
    SFX.playClick();
    const drawer = document.getElementById('mobile-nav-drawer');
    if (drawer) drawer.classList.toggle('hidden');
  }

  function initBeforeAfterSlider() {
    const container = document.getElementById('landing-before-after');
    const overlay = document.getElementById('before-after-overlay');
    const handle = document.getElementById('before-after-handle');
    if (!container || !overlay || !handle) return;

    let isDragging = false;
    function updatePosition(clientX) {
      const rect = container.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      let pct = (offsetX / rect.width) * 100;
      pct = Math.max(5, Math.min(95, pct));
      const rightPct = 100 - pct;
      overlay.style.width = rightPct + '%';
      handle.style.left = pct + '%';
    }

    container.addEventListener('pointerdown', (e) => {
      isDragging = true;
      updatePosition(e.clientX);
      container.setPointerCapture(e.pointerId);
    });

    container.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      updatePosition(e.clientX);
    });

    container.addEventListener('pointerup', (e) => {
      isDragging = false;
      try { container.releasePointerCapture(e.pointerId); } catch (_) {}
    });

    container.addEventListener('pointercancel', () => {
      isDragging = false;
    });
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
  const SPECIFIC_DASHBOARD_EMAILS = [
    ADMIN_EMAIL.toLowerCase()
  ];

  function isAdminUser(user = STATE.user) {
    return String(user?.email || '').toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
  }

  function isDashboardAllowed(user = STATE.user) {
    if (!user) return false;
    const email = String(user.email || '').toLowerCase().trim();
    if (!email) return false;
    if (SPECIFIC_DASHBOARD_EMAILS.includes(email)) return true;
    if (email === ADMIN_EMAIL.toLowerCase()) return true;
    if (STATE.userProfile?.role === 'admin' || STATE.userProfile?.is_admin === true) return true;
    const custom = (localStorage.getItem('mickey_specific_dashboard_email') || '').toLowerCase().trim();
    if (custom && email === custom) return true;
    return false;
  }

  const DEFAULT_WORKER_API_URL = 'https://mickey-studio-api.kma279500.workers.dev/api.php';
  const API_BASE_URL = (function() {
    const configured = String(window.MICKEY_API_BASE_URL || '').trim();
    if (!configured) return DEFAULT_WORKER_API_URL;
    try {
      const parsed = new URL(configured, window.location.href);
      // Never fall back to the Vercel site itself: it does not host the API
      // endpoint and can return a generic Forbidden response for /api.php.
      if (parsed.origin === window.location.origin) return DEFAULT_WORKER_API_URL;
      return parsed.href;
    } catch (_) {
      return DEFAULT_WORKER_API_URL;
    }
  })();
  const MOTION_SCENE_API_URL = 'https://mickey-studio-api.kma279500.workers.dev';
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

  function updateQuotaBadge(tool, remaining, limit) {
    const normalizedTool = ({
      image: 'images',
      images: 'images',
      voice: 'voice',
      voiceover: 'voice',
      tts: 'voice',
      transcription: 'transcription',
      transcribe: 'transcription',
      motion: 'motion',
      motion_scene: 'motion'
    })[String(tool || '').toLowerCase()] || tool;

    const badgeId = ({
      images: 'quota-badge-images',
      voice: 'quota-badge-voice',
      transcription: 'quota-badge-transcription',
      motion: 'quota-badge-motion'
    })[normalizedTool];

    if (!badgeId) return;
    const badge = document.getElementById(badgeId);
    if (!badge) return;

    badge.classList.remove('hidden');

    if (remaining === undefined || remaining === null) {
      badge.textContent = 'متبقي لك -- اليوم';
      return;
    }

    const remNum = Number(remaining);
    if (!Number.isFinite(remNum)) {
      badge.textContent = 'متبقي لك -- اليوم';
      return;
    }

    if (remNum >= 90000) {
      badge.textContent = 'غير محدود (مشرف)';
      badge.classList.remove('text-amber-300', 'text-red-400');
      badge.classList.add('text-emerald-400');
      badge.title = 'حساب المشرف يتمتع بحصة غير محدودة';
      return;
    }

    if (remNum <= 0) {
      badge.textContent = '0 متبقي اليوم';
      badge.classList.remove('text-amber-300', 'text-emerald-400');
      badge.classList.add('text-red-400');
      badge.title = 'نفدت الحصة اليومية لهذا القسم';
    } else {
      badge.textContent = `متبقي لك ${remNum} اليوم`;
      badge.classList.remove('text-red-400', 'text-emerald-400');
      badge.classList.add('text-amber-300');
      badge.title = limit ? `متبقي ${remNum} من أصل ${limit} لهذا اليوم` : `متبقي لك ${remNum} اليوم`;
    }
  }

  async function fetchUserQuotas() {
    try {
      const user = firebase?.auth?.()?.currentUser;
      const headers = { 'X-Anonymous-ID': getAnonymousId() };
      if (user) {
        try { headers.Authorization = `Bearer ${await user.getIdToken()}`; } catch (_) {}
      }
      const response = await fetch(`${API_BASE_URL}?action=get_user_quotas`, { headers });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.success && data?.quotas) {
        for (const [toolKey, item] of Object.entries(data.quotas)) {
          if (item && typeof item.remaining !== 'undefined') {
            updateQuotaBadge(toolKey, item.remaining, item.limit);
          }
        }
      }
    } catch (e) {
      console.warn('[MickeyStudio] fetchUserQuotas error:', e);
    }
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
    const tool = ({ generate_image: 'images', generate_tts: 'voice', refine_voiceover: 'voice', transcribe_audio: 'transcription', enhance_prompt: 'prompt' })[action] || action;
    let permits = {};
    try { permits = JSON.parse(sessionStorage.getItem('mickey_generation_permits') || '{}'); } catch (_) {}
    const permit = permits[tool];
    if (permit) headers['X-Generation-Permit'] = permit;
    const response = await fetch(`${API_BASE_URL}?action=${encodeURIComponent(action)}`, { ...requestOptions, headers });
    if (permit) { delete permits[tool]; sessionStorage.setItem('mickey_generation_permits', JSON.stringify(permits)); }

    // Intercept quota headers
    const qTool = response.headers.get('X-Quota-Tool') || tool;
    const qRem = response.headers.get('X-Quota-Remaining');
    const qLim = response.headers.get('X-Quota-Limit');
    if (qRem !== null && qRem !== undefined) {
      updateQuotaBadge(qTool, parseInt(qRem, 10), parseInt(qLim || '0', 10));
    }

    return response;
  }

  async function accountRequest(action, body = {}) {
    const user = firebase.auth().currentUser;
    const headers = { 'Content-Type': 'application/json', 'X-Anonymous-ID': getAnonymousId() };
    if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
    const requestBody = { action, ...body };
    // InfinityFree/shared Apache may drop Authorization before PHP receives it.
    // Include the short-lived ID token in this HTTPS request body as a fallback.
    if (['pair_complete', 'pair2_complete', 'consume_generation', 'device_list', 'device_revoke', 'get_user_quotas', 'record_usage'].includes(action) && user) requestBody.idToken = await user.getIdToken();
    const response = await fetch(`${API_BASE_URL}?action=${encodeURIComponent(action)}`, {
      method: 'POST', headers, body: JSON.stringify(requestBody)
    });
    const data = await response.json().catch(() => ({}));

    // Intercept quota in body or headers
    if (data?.quota?.tool && typeof data.quota.remaining === 'number') {
      updateQuotaBadge(data.quota.tool, data.quota.remaining, data.quota.limit);
    } else {
      const qTool = response.headers.get('X-Quota-Tool') || body.tool;
      const qRem = response.headers.get('X-Quota-Remaining');
      const qLim = response.headers.get('X-Quota-Limit');
      if (qRem !== null && qRem !== undefined && qTool) {
        updateQuotaBadge(qTool, parseInt(qRem, 10), parseInt(qLim || '0', 10));
      }
    }

    if (!response.ok || data.success === false) {
      if (response.status === 429 && data.code === 'QUOTA_EXCEEDED' && data.tool) {
        updateQuotaBadge(data.tool, 0, data.limit);
      }
      const errorMessage = (value) => {
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (Array.isArray(value)) return value.map(errorMessage).filter(Boolean).join('، ');
        if (value && typeof value === 'object') {
          for (const key of ['message', 'publicMessage', 'detail', 'error', 'description']) {
            const nested = errorMessage(value[key]);
            if (nested) return nested;
          }
        }
        return '';
      };
      throw new Error(errorMessage(data.error) || errorMessage(data.message) || `تعذر تنفيذ الطلب (${response.status}).`);
    }
    if (action === 'consume_generation' && data.permit) {
      let permits = {};
      try { permits = JSON.parse(sessionStorage.getItem('mickey_generation_permits') || '{}'); } catch (_) {}
      permits[body.tool || 'tool'] = data.permit;
      sessionStorage.setItem('mickey_generation_permits', JSON.stringify(permits));
    }
    return data;
  }

  async function recordUsage(tool) {
    return accountRequest('record_usage', { tool, event_id: crypto.randomUUID() });
  }

  const MOTION_STYLE_GUIDES = {
    social: 'Match a polished social-media motion reference: near-black midnight-navy background, a restrained violet glow in the upper right and cobalt-blue glow in the lower right; crisp bold white Arabic typography with short key words highlighted in hot magenta and electric blue using separate whole-word text layers in natural right-to-left order; thin outlined rings and a few small floating reaction or subject-relevant symbol badges (♥, ↗, ✦). Use concise two-line kinetic headlines, clear negative space, tasteful dark-violet UI cards, and coordinated pop/slide/scale reveals. Use a phone or app-interface motif only when the brief is about apps or social engagement, and use counters or charts only for facts explicitly supplied by the user. Preserve the user’s actual subject as the hero visual; never replace it with generic decoration. Avoid green/gold palettes, bright grids, dense particles, repeated cards, invented metrics, and text-only scenes.',
    kids: 'Playful shapes, bright colors and friendly, readable typography.',
    tech: 'Grid-driven interface visuals, precise motion and cool high-contrast colors.',
    luxury: 'Elegant spacing, restrained gold accents and smooth premium motion.',
    cyber: 'Dark cyberpunk palette, crisp neon geometry and controlled visual density.',
    marketing: 'Clear product hierarchy, direct offer emphasis and punchy transitions.',
    stats: 'Data-led layout, accurate numeric hierarchy and legible chart moments.'
  };
  const MOTION_MOGRT_IDS = ['bg_aurora', 'bg_grid', 'text_kinetic', 'text_badge', 'widget_counter', 'widget_donut_ring', 'widget_social_card', 'logo_outro', 'color_matte'];
  const MOTION_SFX_IDS = ['whoosh', 'pop', 'click', 'riser', 'impact', 'sparkle', 'soft_whoosh', 'swipe', 'bass_hit', 'notification'];
  const MOTION_MUSIC_IDS = ['social_upbeat', 'kids_playful', 'tech_corporate', 'luxury_ambient', 'cyber_drive', 'cinematic_inspire', 'stats_pulse'];
  const MOTION_STYLE_MUSIC = { social: 'social_upbeat', kids: 'kids_playful', tech: 'tech_corporate', luxury: 'luxury_ambient', cyber: 'cyber_drive', marketing: 'social_upbeat', stats: 'stats_pulse' };
  let motionPalette = [];
  let motionBuilderInitialized = false;
  let motionEditorScene = null;
  let motionEditorDuration = 15;
  let motionEditorSelectedIndex = -1;
  let motionEditorTime = 0;
  let motionEditorPlaying = false;
  let motionEditorFrame = 0;
  let motionEditorLastFrame = 0;
  let motionEditorAspect = '16:9';
  let motionEditorAudioContext = null;
  let motionEditorAudioNodes = [];
  let motionEditorExporting = false;
  const motionEditorAudioCache = new Map();
  function motionNotice(text, error = false, targetId = 'motion-status') {
    const node = document.getElementById(targetId);
    if (node) { node.textContent = text; node.className = `text-xs ${error ? 'text-red-300' : 'text-emerald-300'}`; }
  }

  function renderMotionPalette() {
    const host = document.getElementById('motion-palette');
    if (!host) return;
    host.replaceChildren();
    motionPalette.forEach((color, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.title = `${color} — اضغط لنسخ اللون`;
      button.className = 'h-9 w-9 rounded-full border border-white/30 shadow'; button.style.backgroundColor = color;
      button.addEventListener('click', async () => { try { await navigator.clipboard.writeText(motionPalette[index]); motionNotice(`تم نسخ اللون ${motionPalette[index]}`); } catch (_) {} });
      button.addEventListener('dblclick', () => { const value = prompt('عدّل اللون بصيغة #RRGGBB', motionPalette[index]); if (value && /^#[0-9a-f]{6}$/i.test(value)) { motionPalette[index] = value.toUpperCase(); renderMotionPalette(); } });
      host.appendChild(button);
    });
  }

  async function motionReadImage(file) {
    if (!file || !file.type.startsWith('image/')) { motionNotice('اختر ملف صورة صالحاً.', true); return; }
    const image = new Image(); image.src = URL.createObjectURL(file);
    try {
      await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 120;
      const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, 120, 120);
      const pixels = context.getImageData(0, 0, 120, 120).data, counts = new Map();
      for (let i = 0; i < pixels.length; i += 16) {
        if (pixels[i + 3] < 96) continue;
        const key = `#${[pixels[i], pixels[i + 1], pixels[i + 2]].map(v => (Math.round(v / 32) * 32).toString(16).padStart(2, '0')).map(v => (parseInt(v, 16) > 255 ? 'ff' : v)).join('').toUpperCase()}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      motionPalette = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([color]) => color);
      renderMotionPalette(); motionNotice(`استخرجت ${motionPalette.length} ألوان من ${file.name}.`);
    } catch (error) { motionNotice(`تعذرت قراءة الصورة: ${error.message}`, true); }
    finally { URL.revokeObjectURL(image.src); }
  }

  function motionSceneVisualDirection(idea) {
    const brief = String(idea || '').normalize('NFKC').toLowerCase();
    const directions = [
      [/(قهوة|القهوة|بُن|البن|حبوب القهوة|coffee|espresso|cappuccino|latte)/i, 'Show the actual coffee subject prominently: a recognizable steaming cup, coffee beans, crema or a pour, with restrained morning-sunlight cues. The cup and beans are the hero visual, not generic abstract lines.'],
      [/(طعام|أكل|وجبة|طبخ|مطعم|food|recipe|cooking|restaurant)/i, 'Show the exact dish or ingredient named in the brief as the hero subject, with appetizing but tasteful food details. Do not replace it with generic gradients or unrelated props.'],
      [/(رياضة|تمرين|لياقة|جيم|عضلات|fitness|workout|gym|sport)/i, 'Show the activity and equipment named in the brief as the hero subject, with a clear action pose and energetic supporting shapes. Avoid unrelated data widgets.'],
      [/(سفر|رحلة|سياحة|مدينة|شاطئ|travel|trip|tourism|beach)/i, 'Show the actual destination or travel object named in the brief as the hero subject; use map, route, luggage, transport, or landscape cues only when relevant. Do not invent a specific landmark.'],
      [/(تعليم|تعلم|دراسة|مدرسة|جامعة|كتاب|education|learning|study|school|university)/i, 'Show a recognizable learning object or activity tied to the brief, such as the relevant book, lesson, or study setting. Keep the visual concrete and avoid generic abstract decoration.'],
      [/(تقنية|ذكاء اصطناعي|تطبيق|برنامج|هاتف|حاسوب|technology|artificial intelligence|\bai\b|app|software|phone|computer)/i, 'Show the actual product or technology named in the brief, such as a device or purposeful interface. Use clean interface geometry only as support; avoid generic sci-fi imagery.'],
      [/(طبيعة|نبات|زهور|شجرة|حيوان|بحر|جبل|nature|plant|flower|tree|animal|ocean|mountain)/i, 'Show the exact natural subject named in the brief as a recognizable hero visual. Keep its colors and supporting details grounded in that subject.']
    ];
    const match = directions.find(([pattern]) => pattern.test(brief));
    return match?.[1] || 'Identify the main concrete subject in the user brief and make it the unmistakable hero visual. Choose supporting motifs, setting, and colors from that subject; never use generic abstract decoration as a substitute for the subject.';
  }

  function motionScenePromptRaw() {
    let idea = document.getElementById('motion-idea')?.value.trim();
    const duration = Number(document.getElementById('motion-duration')?.value);
    if (!idea) throw new Error('اكتب فكرة الفيديو أولاً.');
    if (!Number.isFinite(duration) || duration < 1 || duration > 180) throw new Error('المدة يجب أن تكون بين 1 و180 ثانية.');
    const visualDirection = motionSceneVisualDirection(idea);
    idea = `Create a finished premium motion-graphics video, not a wireframe or preview board. Avoid a bright full-frame grid, an empty gradient, a lone oversized title, and generic centered-title layouts. Prefer a restrained aurora or color-matte background; use bg_grid only as a subtle texture. Build a clear hierarchy with a strong Arabic headline, concise supporting copy, and a complementary graphic or accent. Give the opening, middle, and ending distinct compositions with balanced negative space, safe margins, polished contrast, and readable text. Avoid decorative clutter, repeated cards, long copy, and invented facts. Never show the same price, number, or claim twice at the same time; use one clear primary treatment for each key fact. Preserve the user's Arabic wording and meaning.\n\nTOPIC-SPECIFIC VISUAL DIRECTION: ${visualDirection}\nDo not invent template IDs, element types, image fields, or unsupported JSON properties. Use only the supplied schema; keep the visual direction present through the selected supported templates, concise labels, and coherent palette.\n\nUSER'S IDEA: ${idea}`;
    const styleSelect = document.getElementById('motion-style'); const styleName = styleSelect.options[styleSelect.selectedIndex].text;
    const musicControl = document.getElementById('motion-music-track');
    const requestedMusic = musicControl?.value === 'auto' || !musicControl?.value ? MOTION_STYLE_MUSIC[styleSelect.value] : musicControl.value;
    const musicEnabled = document.getElementById('motion-music-enabled')?.checked !== false;
    const musicVolume = Math.max(10, Math.min(50, Number(document.getElementById('motion-music-volume')?.value) || 28)) / 100;
    const variationId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const variationDirections = [
      'Open with a huge cropped title, then reveal a small supporting badge and finish with a clean logo card.',
      'Use asymmetric editorial composition: anchor the title to one side, balance it with a graphic widget on the other, and change alignment between beats.',
      'Build a sequence of three distinct visual chapters: atmospheric opening, focused information card, and energetic closing.',
      'Use a bold diagonal rhythm with alternating left/right title placement, varied scale, and a compact closing line.',
      'Begin with a minimal single word, expand into layered supporting information, then resolve into a spacious end card.',
      'Use a data-led composition with one prominent widget, short labels, and a contrasting typographic opening and ending.',
      'Create a playful collage of staggered cards and small accents while preserving clear Arabic reading order.',
      'Use cinematic negative space, a restrained title treatment, a strong color transition, and one memorable closing visual.'
    ];
    const variation = variationDirections[Math.floor(Math.random() * variationDirections.length)];
    return `You are a senior Motion Graphics Director designing a polished Arabic motion-graphics scene for a Premiere Pro UXP extension. Return exactly one valid JSON object and absolutely no Markdown, preamble, or explanation. Preserve the user's Arabic idea and spelling. Produce a visually coherent edit with clear hierarchy, deliberate pacing, readable Arabic typography, and a strong opening and ending.\n\nCREATIVE VARIATION ID: ${variationId}. Treat this as a new art direction, not a reusable preset.\nMANDATORY COMPOSITION DIRECTION FOR THIS GENERATION: ${variation}\nDo not repeat a generic centered-title-on-gradient layout. Vary title alignment, scale, negative space, graphic choice, card shape, color balance, and entrance animation. Use at least three visibly different layout treatments across the opening, middle, and ending. Avoid repeating identical timing and positions across separate scenes.\nART DIRECTION: Design an actual motion-graphics spot, not plain text on a dark gradient. Give the hero copy a designed treatment using a glass/solid card, clipped color band, icon medallion, geometric frame, orbital accent, or a purposeful combination. Use icons and shapes as visual storytelling, not random decoration. Animate typography and graphic motifs in coordinated beats; use small supporting labels and clear scale contrast. Keep copy concise, Arabic letterforms unobstructed, and avoid placing titles at arbitrary scattered coordinates. Create a visual payoff at the ending.\n\nUSER BRIEF (Arabic):\n${idea}\n\nVISUAL STYLE: ${styleName}. ${MOTION_STYLE_GUIDES[styleSelect.value]}\nTOTAL DURATION: ${duration} seconds.\nREFERENCE PALETTE: ${motionPalette.length ? motionPalette.join(', ') : 'Use a sophisticated palette appropriate to the selected style.'}\n\nOUTPUT CONTRACT\nRoot schema: {"version":1,"elements":[...]}. Return 7-20 elements (maximum 30), including at least 3 sound-effect elements. Each element occupies its own visual/audio layer; use trackIndex 0 for background, 1 for primary title, 2 for supporting text, 3+ for accents/widgets. Put simultaneous elements on different trackIndex values so they do not overwrite. Keep visuals inside the requested duration and leave comfortable margins. Use 1920x1080 canvas coordinates; position is the layer anchor [x,y]. Use natural concise Arabic copy and don't invent facts or numbers.\n\nAllowed schemas:\nGraphic: {"type":"graphic","templateId":"bg_aurora|bg_grid|text_kinetic|text_badge|widget_counter|widget_donut_ring|widget_social_card|logo_outro","trackIndex":1,"startTime":0,"duration":3,"position":[960,540],"scale":100,"animationIn":"none|pop-in|zoom-in|bounce-in|slide-up|slide-left|slide-right|word-reveal|fade-in","animationOut":"none|fade-out|zoom-out|slide-down|slide-left|slide-right","params":{"text":"Arabic text","fontFamily":"Readex Pro","fontSize":72,"textColor":"#FFFFFF","color1":"#RRGGBB","color2":"#RRGGBB","numberValue":100,"label":"Arabic label"}}\nSolid background: {"type":"color_matte","trackIndex":0,"startTime":0,"duration":${duration},"position":[960,540],"scale":100,"animationIn":"none","animationOut":"none","params":{"color1":"#10131F"}}\nSound effect: {"type":"sfx","sfxId":"whoosh|pop|click|riser|impact|sparkle|soft_whoosh|swipe|bass_hit|notification","trackIndex":0,"startTime":1.2,"duration":0.5,"params":{}}\nMusic (root field, separate from elements): ${musicEnabled ? `"music":{"musicId":"${requestedMusic}","duration":${duration},"volume":${musicVolume.toFixed(2)},"fadeIn":1.2,"fadeOut":1.5}` : 'omit the music property because the user disabled background music'}\n\nGraphic IDs: ${MOTION_MOGRT_IDS.filter(id => id !== 'color_matte').join(', ')}. SFX IDs: ${MOTION_SFX_IDS.join(', ')}. Music IDs: ${MOTION_MUSIC_IDS.join(', ')}. Background templates render full-frame backgrounds; foreground templates render transparent overlays. Use hex colors, font sizes 30-130, scale 70-115, and valid times. Distribute beats across the full duration; do not stack unrelated content or put all elements at time zero. Include 3-5 varied SFX precisely synchronized to meaningful visual reveals. Use varied entrance/exit animations (pop-in, zoom-in, bounce-in, slide-left/right/up, or word-reveal) that match each beat. Keep at least one visual motif recurring across scenes for cohesion. Return JSON only.`;
  }

  function motionScenePrompt() {
    return motionScenePromptRaw().replace(
      'Each element occupies its own visual/audio layer; use trackIndex 0 for background, 1 for primary title, 2 for supporting text, 3+ for accents/widgets. Put simultaneous elements on different trackIndex values so they do not overwrite. Keep visuals inside the requested duration and leave comfortable margins.',
      'trackIndex controls timeline layer order only; it never determines screen position, and elements on different tracks can still overlap visually. Give every visible element a deliberate position independent of trackIndex. For simultaneous elements, reserve separate composition zones: keep headlines and supporting copy apart, balance text against a complementary widget on the opposite side when possible, and leave 7% safe margins.'
    );
  }

  async function motionGeneratePrompt() {
    try { await navigator.clipboard.writeText(motionScenePrompt()); motionNotice('تم نسخ الطلب. الصقه في ChatGPT أو Claude أو Gemini.'); }
    catch (error) { motionNotice(error.message || 'تعذر نسخ الطلب.', true); }
  }

  function cleanMotionJSON(value) {
    let text = String(value || '').trim();
    if (/Repair this Premiere motion scene\./i.test(text) && /Return JSON only/i.test(text)) {
      throw new Error('هذا هو برومبت التصحيح وليس رد الذكاء الاصطناعي. أرسله إلى ChatGPT أو Claude، ثم الصق الرد الذي يبدأ بكائن JSON هنا.');
    }
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    text = text.replace(/\\([_\[\]])/g, '$1');
    const start = text.indexOf('{');
    if (start < 0) return text;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === '{') depth += 1;
      else if (character === '}') {
        depth -= 1;
        if (depth === 0) return text.slice(start, index + 1);
      }
    }
    return text.slice(start);
  }

  function parseMotionJSON(value) {
    const text = cleanMotionJSON(value);
    try { return JSON.parse(text); }
    catch (_) { throw new Error('رد الذكاء الاصطناعي ليس JSON صالحاً. الصق كود JSON فقط، ولا تلصق برومبت التصحيح نفسه.'); }
  }

  function motionAutoLayoutScene(scene) {
    const aspect = ['16:9', '9:16', '1:1'].includes(scene.aspectRatio) ? scene.aspectRatio : '16:9';
    const canvasSize = aspect === '9:16' ? { width: 720, height: 1280 } : aspect === '1:1' ? { width: 1080, height: 1080 } : { width: 1280, height: 720 };
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const context = canvas.getContext('2d');
    if (!context) return { adjusted: 0, unresolved: 0 };
    const safe = { left: canvas.width * .07, right: canvas.width * .93, top: canvas.height * .08, bottom: canvas.height * .92 };
    const items = scene.elements
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => ['graphic', 'mogrt'].includes(item.type) && !['bg_aurora', 'bg_grid'].includes(item.templateId) && motionEditorIsText(item))
      .sort((left, right) => Number(left.item.startTime) - Number(right.item.startTime) || right.index - left.index);
    const placed = [];
    const layoutStats = { adjusted: 0, unresolved: 0 };

    function measure(item, scaleFactor = 1) {
      const params = item.params || {};
      const fontSize = Math.max(22, Math.min(canvas.height * .16, (Number(params.fontSize) || 68) * canvas.height / 1080));
      const text = String(params.text || params.label || (params.numberValue != null ? params.numberValue : '')).trim();
      context.font = `800 ${fontSize}px "${String(params.fontFamily || 'Readex Pro').replace(/["\\]/g, '')}", Cairo, Arial, sans-serif`;
      const maxWidth = item.templateId === 'widget_counter' ? canvas.width * .7 : item.templateId === 'widget_social_card' ? canvas.width * .68 : canvas.width * .84;
      const lines = [];
      let line = '';
      text.split(/\s+/).forEach(word => {
        const test = line ? `${line} ${word}` : word;
        if (line && context.measureText(test).width > maxWidth) { lines.push(line); line = word; }
        else line = test;
      });
      if (line) lines.push(line);
      const shown = lines.slice(0, 4);
      const textWidth = Math.max(1, ...shown.map(part => context.measureText(part).width));
      const lineHeight = fontSize * 1.24;
      let width = Math.min(maxWidth, textWidth + fontSize * .8);
      let height = Math.max(lineHeight, shown.length * lineHeight) + fontSize * .8;
      if (item.templateId === 'text_badge') { width = Math.min(canvas.width * .86, Math.max(fontSize * 4.8, textWidth + fontSize * 2.15)); height = Math.max(height, fontSize * 1.86); }
      if (item.templateId === 'widget_counter') { width = Math.min(canvas.width * .78, fontSize * 8); height = Math.max(height, fontSize * 4.2); }
      if (item.templateId === 'widget_social_card') { width = Math.min(canvas.width * .78, Math.max(fontSize * 6, textWidth + fontSize * 2.1)); height = Math.max(height, fontSize * 2.15); }
      if (item.templateId === 'widget_donut_ring') { width = height = Math.min(canvas.width, canvas.height) * .46; }
      const visualScale = Math.max(.02, Math.min(3, (Number(item.scale) || 100) / 100 * scaleFactor));
      width = width * visualScale + canvas.width * .035;
      height = height * visualScale + canvas.height * .045;
      return { width, height };
    }

    function boundsAt(item, x, y, box) {
      const px = x / 1920 * canvas.width;
      const py = y / 1080 * canvas.height;
      return { left: px - box.width / 2, right: px + box.width / 2, top: py - box.height / 2, bottom: py + box.height / 2 };
    }

    function overlaps(left, right) {
      const leftStart = Number(left.item.startTime) || 0;
      const rightStart = Number(right.item.startTime) || 0;
      const timeOverlap = leftStart < rightStart + (Number(right.item.duration) || 0) && rightStart < leftStart + (Number(left.item.duration) || 0);
      const a = left.bounds, b = right.bounds;
      return timeOverlap && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    items.forEach(({ item, index }) => {
      const original = Array.isArray(item.position) ? [Number(item.position[0]) || 960, Number(item.position[1]) || 540] : [960, 540];
      const columns = aspect === '9:16' ? [.22, .5, .78] : [.2, .5, .8];
      const rows = aspect === '9:16' ? [.14, .31, .48, .65, .82] : [.16, .33, .5, .67, .84];
      const candidates = [[original[0] / 1920, original[1] / 1080]];
      rows.forEach(y => columns.forEach(x => candidates.push([x, y])));
      const unique = candidates.filter((candidate, candidateIndex) => candidates.findIndex(value => value[0] === candidate[0] && value[1] === candidate[1]) === candidateIndex)
        .sort((left, right) => Math.hypot(left[0] - original[0] / 1920, left[1] - original[1] / 1080) - Math.hypot(right[0] - original[0] / 1920, right[1] - original[1] / 1080));
      let selected = null;
      let selectedScale = 1;
      for (const scaleFactor of [1, .9, .8, .7, .62]) {
        const box = measure(item, scaleFactor);
        for (const [x, y] of unique) {
          const px = Math.max(safe.left + box.width / 2, Math.min(safe.right - box.width / 2, x * canvas.width));
          const py = Math.max(safe.top + box.height / 2, Math.min(safe.bottom - box.height / 2, y * canvas.height));
          const position = [px / canvas.width * 1920, py / canvas.height * 1080];
          const candidate = { item, bounds: boundsAt(item, position[0], position[1], box) };
          if (placed.every(other => !overlaps(candidate, other))) { selected = position; selectedScale = scaleFactor; break; }
        }
        if (selected) break;
      }
      if (!selected) { layoutStats.unresolved += 1; selected = original; }
      if (Math.abs(selected[0] - original[0]) > 1 || Math.abs(selected[1] - original[1]) > 1 || selectedScale < 1) layoutStats.adjusted += 1;
      item.position = selected.map(value => Math.round(value));
      if (selectedScale < 1) item.scale = Math.max(60, Math.round((Number(item.scale) || 100) * selectedScale));
      const box = measure(item);
      placed.push({ item, index, bounds: boundsAt(item, item.position[0], item.position[1], box) });
    });
    return layoutStats;
  }

  function validateMotionScene(scene) {
    if (!scene || !Array.isArray(scene.elements) || !scene.elements.length || scene.elements.length > 30) throw new Error('يجب أن يحتوي JSON على 1 إلى 30 عنصراً داخل elements.');
    scene.elements.forEach((item, index) => {
      const id = item?.type === 'mogrt' || item?.type === 'graphic' ? item.templateId : item?.type === 'sfx' ? item.sfxId : item?.type === 'color_matte' ? 'color_matte' : '';
      if (!id || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error(`معرّف العنصر ${index + 1} غير صالح.`);
      if ((item.type === 'mogrt' || item.type === 'graphic') && !MOTION_MOGRT_IDS.includes(id)) throw new Error(`قالب غير معروف: ${id}`);
      if (item.type === 'sfx' && !MOTION_SFX_IDS.includes(id)) throw new Error(`مؤثر صوتي غير معروف: ${id}`);
      if (!Number.isInteger(Number(item.trackIndex)) || Number(item.trackIndex) < 0 || !Number.isFinite(Number(item.startTime)) || Number(item.startTime) < 0 || !Number.isFinite(Number(item.duration)) || Number(item.duration) <= 0) throw new Error(`التوقيت أو المسار غير صالح في العنصر ${index + 1}.`);
    });
    if (scene.music != null && (!MOTION_MUSIC_IDS.includes(scene.music.musicId) || !Number.isFinite(Number(scene.music.volume)) || Number(scene.music.volume) < 0.05 || Number(scene.music.volume) > 0.8 || !Number.isFinite(Number(scene.music.duration)) || Number(scene.music.duration) < 1 || Number(scene.music.duration) > 180)) throw new Error('اختيار الموسيقى أو مستوى صوتها أو مدتها غير صالح.');
    return scene;
  }

  async function motionSendToPremiere() {
    const button = document.getElementById('motion-send') || document.getElementById('motion-editor-send');
    const statusId = document.getElementById('section-motion-editor')?.classList.contains('hidden') ? 'motion-status' : 'motion-editor-status';
    try {
      if (!window.firebase?.auth?.().currentUser) throw new Error('سجّل الدخول إلى الموقع أولاً بالحساب المرتبط بإضافة Premiere.');
      const scene = parseMotionJSON(document.getElementById('motion-json').value);
      validateMotionScene(scene);
      const style = document.getElementById('motion-style')?.value || 'social';
      const musicEnabled = document.getElementById('motion-music-enabled')?.checked !== false;
      const selectedMusic = document.getElementById('motion-music-track')?.value || 'auto';
      if (musicEnabled) {
        const musicId = selectedMusic === 'auto' ? MOTION_STYLE_MUSIC[style] : selectedMusic;
        const volume = Math.max(10, Math.min(50, Number(document.getElementById('motion-music-volume')?.value) || 28)) / 100;
        scene.music = { musicId, duration: Number(document.getElementById('motion-duration')?.value) || 15, volume, fadeIn: 1.2, fadeOut: 1.5 };
      } else delete scene.music;
      const layout = motionAutoLayoutScene(scene);
      if (motionEditorEnsureTextContrast(scene)) {
        const jsonField = document.getElementById('motion-json');
        if (jsonField) jsonField.value = JSON.stringify(scene, null, 2);
      }
      const jsonField = document.getElementById('motion-json');
      if (jsonField && layout.adjusted) jsonField.value = JSON.stringify(scene, null, 2);
      const sfxElements = scene.elements.filter(item => item.type === 'sfx').slice(0, 2);
      scene.elements = scene.elements.filter(item => item.type !== 'sfx').concat(sfxElements.map((item, index) => ({
        ...item,
        sfxId: index === 0 ? 'soft_whoosh' : 'click',
        duration: Math.min(Number(item.duration) || 0.5, index === 0 ? 0.65 : 0.2),
      })));
      motionNotice('جارٍ تجهيز الطبقات الرسومية من الموقع…', false, statusId);
      await motionAttachRenderedLayers(scene);
      validateMotionScene(scene);
      if (button) button.disabled = true;
      motionNotice('جارٍ إرسال المشهد إلى حسابك…', false, statusId);
      const user = firebase.auth().currentUser;
      const response = await fetch(`${MOTION_SCENE_API_URL}/?action=motion_scene_submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ scene })
      });
      const result = await response.json().catch(() => ({}));
      if (result?.quota?.tool) updateQuotaBadge(result.quota.tool, result.quota.remaining, result.quota.limit);
      if (response.status === 429) updateQuotaBadge('motion', 0);
      if (!response.ok || !result.success) throw new Error(result.error || `تعذر إرسال المشهد (${response.status}).`);
      motionNotice('تم إرسال المشهد. ستظهر شاشة استلام كاملة داخل Premiere تلقائياً، وستظل مفتوحة حتى تنشئ المشهد أو تغلقها.', false, statusId);
      if (layout.unresolved) motionNotice(`تم الإرسال، لكن تعذر تفادي ${layout.unresolved} تداخلات تلقائياً. راجع المعاينة قبل إدراج المشهد.`, true, statusId);
      else if (layout.adjusted) motionNotice(`تم إرسال المشهد بعد إعادة ترتيب ${layout.adjusted} عنصر تلقائياً لمنع التداخل.`, false, statusId);
    } catch (error) { motionNotice(error.message || 'تعذر إرسال المشهد.', true, statusId); }
    finally { if (button) button.disabled = false; }
  }

  function motionComputeElementKeyframes(item) {
    const dur = Math.max(0.1, Number(item.duration) || 5);
    const animIn = String(item.animationIn || 'none').toLowerCase();
    const animOut = String(item.animationOut || 'none').toLowerCase();
    const basePos = Array.isArray(item.position) ? [Number(item.position[0]), Number(item.position[1])] : [960, 540];
    const baseScale = Number(item.scale) || 100;
    const inDur = animIn === 'word-reveal' ? 0.85 : 0.48;
    const outDur = 0.42;

    const keyframes = { position: [], scale: [], opacity: [] };

    let startPos = [...basePos];
    let startScale = baseScale;
    let startOp = 1.0;

    if (animIn === 'pop-in') {
      startScale = 0;
      startOp = 0.05;
    } else if (['zoom-in', 'bounce-in'].includes(animIn)) {
      startScale = animIn === 'bounce-in' ? 10 : 20;
      startOp = 0.05;
    } else if (animIn === 'slide-up') {
      startPos = [basePos[0], basePos[1] + 78];
      startOp = 0.05;
    } else if (animIn === 'slide-left') {
      startPos = [basePos[0] + 110, basePos[1]];
      startOp = 0.05;
    } else if (animIn === 'slide-right') {
      startPos = [basePos[0] - 110, basePos[1]];
      startOp = 0.05;
    } else if (animIn === 'fade-in' || animIn === 'word-reveal') {
      startOp = 0.05;
    }

    keyframes.position.push({ time: 0, value: startPos });
    keyframes.scale.push({ time: 0, value: startScale });
    keyframes.opacity.push({ time: 0, value: startOp });

    if (animIn !== 'none' && dur > inDur) {
      keyframes.position.push({ time: inDur, value: [...basePos] });
      keyframes.scale.push({ time: inDur, value: baseScale });
      keyframes.opacity.push({ time: inDur, value: 1.0 });
    }

    const holdEnd = Math.max(inDur, dur - outDur);
    if (animOut !== 'none' && holdEnd > inDur && holdEnd < dur) {
      keyframes.position.push({ time: holdEnd, value: [...basePos] });
      keyframes.scale.push({ time: holdEnd, value: baseScale });
      keyframes.opacity.push({ time: holdEnd, value: 1.0 });
    }

    let endPos = [...basePos];
    let endScale = baseScale;
    let endOp = animOut === 'none' ? 1.0 : 0.0;

    if (animOut === 'slide-down') {
      endPos = [basePos[0], basePos[1] + 78];
    } else if (animOut === 'slide-left') {
      endPos = [basePos[0] - 90, basePos[1]];
    } else if (animOut === 'slide-right') {
      endPos = [basePos[0] + 90, basePos[1]];
    } else if (animOut === 'zoom-out') {
      endScale = baseScale * 0.76;
    }

    keyframes.position.push({ time: dur, value: endPos });
    keyframes.scale.push({ time: dur, value: endScale });
    keyframes.opacity.push({ time: dur, value: endOp });

    return keyframes;
  }

  function motionSerializeEditableScene(scene) {
    const v2 = {
      version: 2,
      aspectRatio: ['16:9', '9:16', '1:1'].includes(scene.aspectRatio) ? scene.aspectRatio : '16:9',
      duration: Number(scene.duration) || 15,
      music: scene.music ? { ...scene.music } : undefined,
      elements: []
    };

    (scene.elements || []).forEach((item, index) => {
      if (!item) return;

      if (item.type === 'sfx') {
        v2.elements.push({
          type: 'sfx',
          sfxId: item.sfxId || (index === 0 ? 'soft_whoosh' : 'click'),
          startTime: Number(item.startTime) || 0,
          duration: Number(item.duration) || 0.5,
          volume: Number(item.volume) || 0.5,
          trackIndex: Number(item.trackIndex) || 0
        });
        return;
      }

      if (item.type === 'text' || motionEditorIsText(item)) {
        const text = item.params?.text || item.text || item.params?.label || '';
        const params = item.params || {};
        v2.elements.push({
          type: 'text',
          templateId: item.templateId || 'text_kinetic',
          text: String(text).trim(),
          label: String(params.label || '').trim(),
          fontFamily: String(params.fontFamily || item.fontFamily || 'Readex Pro').replace(/["\\]/g, ''),
          fontSize: Math.round(Number(params.fontSize || item.fontSize || 68)),
          textColor: params.textColor || item.textColor || '#FFFFFF',
          color1: params.color1 || item.color1 || '#FB923C',
          color2: params.color2 || item.color2 || '#3F2A70',
          alignment: params.alignment || item.alignment || 'center',
          trackIndex: Number(item.trackIndex) || 0,
          startTime: Number(item.startTime) || 0,
          duration: Number(item.duration) || 5,
          position: Array.isArray(item.position) ? [Number(item.position[0]), Number(item.position[1])] : [960, 540],
          scale: Number(item.scale) || 100,
          opacity: 1.0,
          animationIn: item.animationIn || 'pop-in',
          animationOut: item.animationOut || 'fade-out',
          keyframes: motionComputeElementKeyframes(item)
        });
        return;
      }

      if (item.type === 'shape' || item.type === 'color_matte' || ['bg_aurora', 'bg_grid'].includes(item.templateId)) {
        const p = item.params || {};
        const shapeType = item.type === 'color_matte' ? 'solid' : (item.templateId === 'bg_grid' ? 'grid' : (item.templateId === 'bg_aurora' ? 'aurora' : (item.shapeType || 'rect')));
        v2.elements.push({
          type: 'shape',
          templateId: item.templateId || 'color_matte',
          shapeType: shapeType,
          color1: p.color1 || item.color1 || '#1A2744',
          color2: p.color2 || item.color2 || '#3F2A70',
          strokeColor: p.strokeColor || '#FFFFFF22',
          trackIndex: Number(item.trackIndex) || 0,
          startTime: Number(item.startTime) || 0,
          duration: Number(item.duration) || 15,
          position: Array.isArray(item.position) ? [Number(item.position[0]), Number(item.position[1])] : [960, 540],
          scale: Number(item.scale) || 100,
          opacity: 1.0,
          keyframes: motionComputeElementKeyframes(item)
        });
        return;
      }

      if (item.type === 'image' || item.imageData || item.renderedPng) {
        v2.elements.push({
          type: 'image',
          imageData: item.imageData || item.renderedPng || '',
          trackIndex: Number(item.trackIndex) || 0,
          startTime: Number(item.startTime) || 0,
          duration: Number(item.duration) || 5,
          position: Array.isArray(item.position) ? [Number(item.position[0]), Number(item.position[1])] : [960, 540],
          scale: Number(item.scale) || 100,
          opacity: 1.0,
          animationIn: item.animationIn || 'fade-in',
          animationOut: item.animationOut || 'fade-out',
          keyframes: motionComputeElementKeyframes(item)
        });
        return;
      }

      v2.elements.push({
        ...item,
        type: item.type || 'graphic',
        keyframes: motionComputeElementKeyframes(item)
      });
    });

    return v2;
  }

  async function motionCompressImageDataUrl(dataUrl, maxWidth = 1920, quality = 0.82) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return dataUrl;
    if (typeof Image === 'undefined') return dataUrl;
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, width, height);
        let compressed = canvas.toDataURL('image/webp', quality);
        if (!compressed || !compressed.startsWith('data:image/webp')) {
          compressed = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(compressed && compressed.length < dataUrl.length ? compressed : dataUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function motionChunkPayloadString(jsonString, maxChunkBytes = 1.5 * 1024 * 1024) {
    if (!jsonString || jsonString.length <= maxChunkBytes) return null;
    const chunks = [];
    for (let i = 0; i < jsonString.length; i += maxChunkBytes) {
      chunks.push(jsonString.slice(i, i + maxChunkBytes));
    }
    return chunks;
  }

  async function motionSendEditableSceneToPremiere() {
    const button = document.getElementById('motion-send-v2') || document.getElementById('motion-editor-send-v2');
    const statusId = document.getElementById('section-motion-editor')?.classList.contains('hidden') ? 'motion-status' : 'motion-editor-status';
    try {
      if (!window.firebase?.auth?.().currentUser) throw new Error('سجّل الدخول إلى الموقع أولاً بالحساب المرتبط بإضافة Premiere.');
      const sourceJSON = document.getElementById('motion-json')?.value || '';
      const rawScene = motionEditorScene ? JSON.parse(JSON.stringify(motionEditorScene)) : parseMotionJSON(sourceJSON);
      validateMotionScene(rawScene);

      const layout = motionAutoLayoutScene(rawScene);
      motionEditorEnsureTextContrast(rawScene);

      const style = document.getElementById('motion-style')?.value || 'social';
      const musicEnabled = document.getElementById('motion-music-enabled')?.checked !== false;
      const selectedMusic = document.getElementById('motion-music-track')?.value || 'auto';
      if (musicEnabled) {
        const musicId = selectedMusic === 'auto' ? MOTION_STYLE_MUSIC[style] || 'social_upbeat' : selectedMusic;
        const volume = Math.max(10, Math.min(50, Number(document.getElementById('motion-music-volume')?.value) || 28)) / 100;
        rawScene.music = { musicId, duration: Number(document.getElementById('motion-duration')?.value) || 15, volume, fadeIn: 1.2, fadeOut: 1.5 };
      } else delete rawScene.music;

      const sfxElements = rawScene.elements.filter(item => item.type === 'sfx').slice(0, 2);
      rawScene.elements = rawScene.elements.filter(item => item.type !== 'sfx').concat(sfxElements.map((item, index) => ({
        ...item,
        sfxId: index === 0 ? 'soft_whoosh' : 'click',
        duration: Math.min(Number(item.duration) || 0.5, index === 0 ? 0.65 : 0.2),
      })));

      motionNotice('جارٍ تحويل المشهد إلى عناصر قابلة للتعديل (v2)…', false, statusId);
      if (button) button.disabled = true;

      const v2Scene = motionSerializeEditableScene(rawScene);

      for (const el of v2Scene.elements) {
        if (el.type === 'image' && el.imageData) {
          el.imageData = await motionCompressImageDataUrl(el.imageData);
        }
      }

      const serialized = JSON.stringify({ scene: v2Scene, version: 2 });
      const user = firebase.auth().currentUser;
      const token = await user.getIdToken();
      const chunks = motionChunkPayloadString(serialized);

      motionNotice('جارٍ إرسال المشهد القابل للتعديل إلى حسابك…', false, statusId);

      if (chunks && chunks.length > 1) {
        const chunkId = 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        for (let i = 0; i < chunks.length; i++) {
          motionNotice(`جارٍ إرسال المشهد (جزء ${i + 1} من ${chunks.length})…`, false, statusId);
          const resp = await fetch(`${MOTION_SCENE_API_URL}/?action=motion_scene_submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ chunkId, chunkIndex: i, totalChunks: chunks.length, chunkData: chunks[i], version: 2 })
          });
          const resData = await resp.json().catch(() => ({}));
          if (resData?.quota?.tool) updateQuotaBadge(resData.quota.tool, resData.quota.remaining, resData.quota.limit);
          if (resp.status === 429) updateQuotaBadge('motion', 0);
          if (!resp.ok || !resData.success) throw new Error(resData.error || `تعذر إرسال الجزء ${i + 1} (${resp.status}).`);
        }
      } else {
        const response = await fetch(`${MOTION_SCENE_API_URL}/?action=motion_scene_submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: serialized
        });
        const result = await response.json().catch(() => ({}));
        if (result?.quota?.tool) updateQuotaBadge(result.quota.tool, result.quota.remaining, result.quota.limit);
        if (response.status === 429) updateQuotaBadge('motion', 0);
        if (!response.ok || !result.success) throw new Error(result.error || `تعذر إرسال المشهد (${response.status}).`);
      }

      motionNotice('تم إرسال المشهد القابل للتعديل (v2). افتح Premiere Pro لتطبيقه كنصوص وعناصر أصلية.', false, statusId);
      if (layout.unresolved) motionNotice(`تم الإرسال (v2)، لكن تعذر تفادي ${layout.unresolved} تداخلات تلقائياً. راجع النص بعد الإدراج.`, true, statusId);
      else if (layout.adjusted) motionNotice(`تم إرسال المشهد (v2) بعد ضبط موضع ${layout.adjusted} عنصر تلقائياً.`, false, statusId);
    } catch (error) {
      motionNotice(error.message || 'تعذر إرسال المشهد القابل للتعديل.', true, statusId);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function motionAttachRenderedLayers(scene) {
    const visualItems = scene.elements.filter(item => ['graphic', 'mogrt', 'color_matte'].includes(item.type));
    if (!visualItems.length) return;
    if (typeof HTMLCanvasElement === 'undefined' || typeof HTMLCanvasElement.prototype.toDataURL !== 'function') {
      throw new Error('متصفح الموقع لا يدعم تجهيز طبقات PNG المطلوبة. افتح Mickey Studio في Chrome أو Edge ثم أعد الإرسال.');
    }
    const canvas = document.createElement('canvas');
    const outputSize = scene.aspectRatio === '9:16' ? { width: 720, height: 1280 } : scene.aspectRatio === '1:1' ? { width: 1080, height: 1080 } : { width: 1280, height: 720 };
    canvas.width = outputSize.width;
    canvas.height = outputSize.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('تعذر إنشاء لوحة تجهيز الرسومات في الموقع.');
    if (document.fonts?.ready) await document.fonts.ready;
    const previousScene = motionEditorScene;
    const semanticText = scene.elements.filter(motionEditorIsText).flatMap(item => [item.params?.text, item.params?.label]).filter(Boolean).join(' ');
    const hero = scene.elements.find(item => motionEditorIsText(item) && ['text_kinetic', 'logo_outro'].includes(item.templateId)) || scene.elements.find(motionEditorIsText);
    const semanticAnchor = Array.isArray(hero?.position) ? hero.position : null;
    let totalBytes = 0;
    try {
      for (let index = 0; index < visualItems.length; index += 1) {
        const source = visualItems[index];
        const item = { ...source, startTime: 0, duration: 180, position: [960, 540], scale: 100, animationIn: 'none', animationOut: 'none' };
        const isBackground = item.type === 'color_matte' || ['bg_aurora', 'bg_grid'].includes(item.templateId);
        const renderTime = Number(source.startTime) + Number(source.duration) / 2;
        const hasHigherBackground = scene.elements.some(candidate => candidate !== source && (candidate.type === 'color_matte' || ['bg_aurora', 'bg_grid'].includes(candidate.templateId)) && Number(candidate.trackIndex) > Number(source.trackIndex) && renderTime >= Number(candidate.startTime) && renderTime <= Number(candidate.startTime) + Number(candidate.duration));
        motionEditorScene = { ...scene, semanticText, semanticAnchor, semanticBackdrop: isBackground && !hasHigherBackground, elements: [item] };
        context.clearRect(0, 0, canvas.width, canvas.height);
        motionEditorDrawExportFrame(context, 0.5, canvas.width, canvas.height, !isBackground);
        const png = canvas.toDataURL('image/png');
        if (!png.startsWith('data:image/png;base64,')) throw new Error(`تعذر تجهيز الطبقة الرسومية رقم ${index + 1}.`);
        totalBytes += png.length;
        if (totalBytes > 18 * 1024 * 1024) throw new Error('حجم الطبقات الرسومية كبير جداً. قلل عدد العناصر أو أرسل المشهد على دفعتين.');
        source.renderedPng = png;
      }
    } finally {
      motionEditorScene = previousScene;
    }
  }

  let motionMiniAnimId = null;
  let motionParsedValidScene = null;
  let motionLastValidationErrors = [];
  let motionUndoStack = [];
  let motionRedoStack = [];
  const MOTION_DRAFT_KEY = 'mickey_motion_builder_draft';

  function motionGetDraftState() {
    const activeChip = document.querySelector('#motion-aspect-chips .motion-aspect-chip.active');
    const aspect = activeChip ? activeChip.getAttribute('data-aspect') : '16:9';
    return {
      idea: document.getElementById('motion-idea')?.value || '',
      aspectRatio: aspect || '16:9',
      duration: Number(document.getElementById('motion-duration')?.value) || 5,
      style: document.getElementById('motion-style')?.value || 'social',
      primaryColor: document.getElementById('motion-brand-primary')?.value || '#6366f1',
      secondaryColor: document.getElementById('motion-brand-secondary')?.value || '#06b6d4',
      musicEnabled: document.getElementById('motion-music-enabled')?.checked !== false,
      musicTrack: document.getElementById('motion-music-track')?.value || 'auto',
      referenceNote: document.getElementById('motion-reference-note')?.value || '',
      pastedJson: document.getElementById('motion-json')?.value || ''
    };
  }

  function motionSaveDraft() {
    try {
      const state = motionGetDraftState();
      localStorage.setItem(MOTION_DRAFT_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function motionRestoreDraft() {
    try {
      const raw = localStorage.getItem(MOTION_DRAFT_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      if (!state || typeof state !== 'object') return;

      const ideaEl = document.getElementById('motion-idea');
      if (ideaEl && state.idea !== undefined) ideaEl.value = state.idea;

      if (state.aspectRatio) {
        document.querySelectorAll('#motion-aspect-chips .motion-aspect-chip').forEach(chip => {
          const match = chip.getAttribute('data-aspect') === state.aspectRatio;
          chip.classList.toggle('active', match);
          if (match) {
            chip.classList.add('border-orange-500/50', 'bg-orange-500/10', 'text-orange-200');
            chip.classList.remove('bg-zinc-900/50', 'text-zinc-300');
          } else {
            chip.classList.remove('border-orange-500/50', 'bg-orange-500/10', 'text-orange-200');
            chip.classList.add('bg-zinc-900/50', 'text-zinc-300');
          }
        });
      }

      if (state.duration) {
        const durInput = document.getElementById('motion-duration');
        const durRange = document.getElementById('motion-duration-range');
        if (durInput) durInput.value = state.duration;
        if (durRange) durRange.value = state.duration;
      }

      if (state.style) {
        const styleEl = document.getElementById('motion-style');
        if (styleEl) styleEl.value = state.style;
      }

      if (state.primaryColor) {
        const pColor = document.getElementById('motion-brand-primary');
        if (pColor) pColor.value = state.primaryColor;
      }

      if (state.secondaryColor) {
        const sColor = document.getElementById('motion-brand-secondary');
        if (sColor) sColor.value = state.secondaryColor;
      }

      if (state.musicEnabled !== undefined) {
        const mCheck = document.getElementById('motion-music-enabled');
        if (mCheck) mCheck.checked = Boolean(state.musicEnabled);
      }

      if (state.musicTrack) {
        const mTrack = document.getElementById('motion-music-track');
        if (mTrack) mTrack.value = state.musicTrack;
      }

      if (state.referenceNote !== undefined) {
        const refEl = document.getElementById('motion-reference-note');
        if (refEl) refEl.value = state.referenceNote;
      }

      if (state.pastedJson) {
        const jsonEl = document.getElementById('motion-json');
        if (jsonEl && !jsonEl.value) {
          jsonEl.value = state.pastedJson;
          motionValidateAndRenderLive();
        }
      }
    } catch (_) {}
  }

  function motionBuildCurrentPrompt() {
    const draft = motionGetDraftState();
    if (window.MotionPrompt && typeof window.MotionPrompt.buildPrompt === 'function') {
      return window.MotionPrompt.buildPrompt(draft.idea, {
        aspectRatio: draft.aspectRatio,
        duration: draft.duration,
        style: draft.style,
        primaryColor: draft.primaryColor,
        secondaryColor: draft.secondaryColor,
        referenceNote: draft.referenceNote
      });
    }
    return `Generate a Motion Scene JSON for: "${draft.idea}". Duration: ${draft.duration}s. Aspect: ${draft.aspectRatio}.`;
  }

  async function motionCopyPromptToClipboard() {
    try {
      const prompt = motionBuildCurrentPrompt();
      await navigator.clipboard.writeText(prompt);
      const label = document.getElementById('btn-copy-prompt-label');
      if (label) {
        const oldText = label.textContent;
        label.textContent = '✓ تم نسخ البرومت بنجاح! الصقه في المساعد';
        setTimeout(() => { if (label) label.textContent = oldText; }, 2600);
      }
      showToast('تم نسخ البرومت الكامل. افتح Claude أو ChatGPT أو Gemini والصقه هناك.', 'success');
      motionSaveDraft();
    } catch (err) {
      showToast('تعذر النسخ إلى الحافظة. يمكنك تحديد النص ونسخه يدوياً.', 'error');
    }
  }

  async function motionPasteFromClipboard() {
    try {
      if (!navigator.clipboard?.readText) throw new Error('المتصفح لا يدعم القراءة المباشرة من الحافظة.');
      const text = await navigator.clipboard.readText();
      const jsonField = document.getElementById('motion-json');
      if (jsonField) {
        jsonField.value = text;
        motionValidateAndRenderLive();
        showToast('تم اللصق من الحافظة وفحص المشهد.', 'info');
      }
    } catch (err) {
      showToast('استخدم اختصار اللصق (Ctrl+V) داخل مربع الرد.', 'info');
    }
  }

  function motionValidateAndRenderLive() {
    const jsonField = document.getElementById('motion-json');
    const errorCard = document.getElementById('motion-error-card');
    const errorList = document.getElementById('motion-error-list');
    const successCard = document.getElementById('motion-success-card');
    const summaryBadge = document.getElementById('motion-scene-summary-badge');
    const miniCanvas = document.getElementById('motion-mini-preview-canvas');

    if (motionMiniAnimId) {
      cancelAnimationFrame(motionMiniAnimId);
      motionMiniAnimId = null;
    }

    const rawText = jsonField?.value?.trim() || '';
    motionSaveDraft();

    if (!rawText) {
      if (errorCard) errorCard.classList.add('hidden');
      if (successCard) successCard.classList.add('hidden');
      motionParsedValidScene = null;
      motionLastValidationErrors = [];
      return;
    }

    const activeChip = document.querySelector('#motion-aspect-chips .motion-aspect-chip.active');
    const aspect = activeChip ? activeChip.getAttribute('data-aspect') : '16:9';

    if (!window.MotionParser) return;

    const parseRes = window.MotionParser.parseAndRepairScene(rawText, { aspectRatio: aspect });

    if (!parseRes.valid || (parseRes.errors && parseRes.errors.length > 0)) {
      motionParsedValidScene = null;
      motionLastValidationErrors = parseRes.errors;
      if (successCard) successCard.classList.add('hidden');
      if (errorCard) {
        errorCard.classList.remove('hidden');
        if (errorList) {
          errorList.innerHTML = parseRes.errors.map(err => `<li>${err}</li>`).join('');
        }
      }
    } else {
      motionParsedValidScene = parseRes.scene;
      motionLastValidationErrors = [];
      if (errorCard) errorCard.classList.add('hidden');
      if (successCard) {
        successCard.classList.remove('hidden');
        const layerCount = Array.isArray(parseRes.scene.layers) ? parseRes.scene.layers.length : (parseRes.scene.elements?.length || 0);
        const dur = Number(parseRes.scene.duration) || 5;
        const w = parseRes.scene.width || 1920;
        const h = parseRes.scene.height || 1080;
        if (summaryBadge) {
          summaryBadge.textContent = `${layerCount} طبقات · ${dur.toFixed(1)} ثانية · ${w}×${h}`;
        }
      }

      // Start Mini Canvas Animation Loop
      if (miniCanvas && window.MotionEngine && typeof window.MotionEngine.renderFrame === 'function') {
        const scene = parseRes.scene;
        miniCanvas.width = scene.width;
        miniCanvas.height = scene.height;
        let startTimestamp = null;
        const animDuration = Math.max(1, scene.duration || 5);

        function renderMiniLoop(timestamp) {
          if (!startTimestamp) startTimestamp = timestamp;
          const elapsed = ((timestamp - startTimestamp) / 1000) % animDuration;
          try {
            window.MotionEngine.renderFrame(scene, elapsed, miniCanvas, { resizeCanvas: false });
          } catch (_) {}
          motionMiniAnimId = requestAnimationFrame(renderMiniLoop);
        }

        motionMiniAnimId = requestAnimationFrame(renderMiniLoop);
      }
    }
  }

  async function motionCopyRepairPrompt() {
    try {
      const jsonField = document.getElementById('motion-json');
      const rawText = jsonField?.value || '';
      if (!rawText.trim()) throw new Error('لا يوجد نص ملصوق لإصلاحه.');

      if (!window.MotionParser) throw new Error('مكتبة MotionParser غير متاحة.');
      const repairPrompt = window.MotionParser.buildRepairPrompt(rawText, motionLastValidationErrors);
      await navigator.clipboard.writeText(repairPrompt);

      const copiedBadge = document.getElementById('motion-repair-copied-badge');
      if (copiedBadge) {
        copiedBadge.classList.remove('hidden');
        setTimeout(() => copiedBadge.classList.add('hidden'), 4000);
      }
      showToast('تم نسخ طلب الإصلاح. الصقه في محادثتك مع الذكاء الاصطناعي.', 'success');
    } catch (err) {
      showToast(err.message || 'تعذر نسخ طلب الإصلاح.', 'error');
    }
  }

  async function motionAutoGenerate() {
    if (typeof authorizeAndConsume === 'function') {
      if (!await authorizeAndConsume('motion')) return;
    }
    const btn = document.getElementById('btn-motion-auto-generate');
    const prompt = motionBuildCurrentPrompt();
    try {
      if (btn) btn.disabled = true;
      showToast('جارٍ التواصل مع الذكاء الاصطناعي لتوليد المشهد...', 'info');

      const response = await fetch('api.php?action=generate_motion_scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, action: 'generate_motion_scene' })
      });

      const data = await response.json().catch(() => ({}));
      if (data?.quota?.tool) updateQuotaBadge(data.quota.tool, data.quota.remaining, data.quota.limit);
      if (!response.ok || !data.success) {
        throw new Error(data.error || `فشل التوليد التلقائي (${response.status})`);
      }

      const reply = data.raw_reply || '';
      const jsonField = document.getElementById('motion-json');
      if (jsonField) {
        jsonField.value = reply;
        motionValidateAndRenderLive();
      }
      showToast('تم استلام المشهد والتحقق من توافقه بنجاح!', 'success');
    } catch (err) {
      showToast(err.message || 'تعذر التوليد التلقائي.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function motionApplyExample(idea) {
    const ideaEl = document.getElementById('motion-idea');
    if (ideaEl && idea) {
      ideaEl.value = idea;
      motionSaveDraft();
      showToast('تم تطبيق فكرة المثال.', 'info');
    }
  }

  function initMotionBuilder() {
    if (motionBuilderInitialized) {
      motionRestoreDraft();
      return;
    }
    motionBuilderInitialized = true;

    // Example Chips
    document.querySelectorAll('#motion-example-chips .motion-example-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const idea = chip.getAttribute('data-idea');
        motionApplyExample(idea);
      });
    });

    // Aspect Ratio Chips
    document.querySelectorAll('#motion-aspect-chips .motion-aspect-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#motion-aspect-chips .motion-aspect-chip').forEach(c => {
          c.classList.remove('active', 'border-orange-500/50', 'bg-orange-500/10', 'text-orange-200');
          c.classList.add('bg-zinc-900/50', 'text-zinc-300');
        });
        chip.classList.add('active', 'border-orange-500/50', 'bg-orange-500/10', 'text-orange-200');
        chip.classList.remove('bg-zinc-900/50', 'text-zinc-300');
        motionSaveDraft();
        motionValidateAndRenderLive();
      });
    });

    // Input listeners for live draft saving
    document.getElementById('motion-idea')?.addEventListener('input', motionSaveDraft);
    const durRange = document.getElementById('motion-duration-range');
    const durInput = document.getElementById('motion-duration');
    durRange?.addEventListener('input', () => {
      if (durInput) durInput.value = durRange.value;
      motionSaveDraft();
    });
    durInput?.addEventListener('input', () => {
      if (durRange) durRange.value = durInput.value;
      motionSaveDraft();
    });
    document.getElementById('motion-style')?.addEventListener('change', motionSaveDraft);
    document.getElementById('motion-brand-primary')?.addEventListener('input', motionSaveDraft);
    document.getElementById('motion-brand-secondary')?.addEventListener('input', motionSaveDraft);
    document.getElementById('motion-music-enabled')?.addEventListener('change', motionSaveDraft);
    document.getElementById('motion-music-track')?.addEventListener('change', motionSaveDraft);
    document.getElementById('motion-reference-note')?.addEventListener('input', motionSaveDraft);

    // Copy Prompt Button
    document.getElementById('btn-copy-motion-prompt')?.addEventListener('click', motionCopyPromptToClipboard);

    // Paste Button & JSON input
    document.getElementById('btn-motion-paste-clip')?.addEventListener('click', motionPasteFromClipboard);
    document.getElementById('motion-json')?.addEventListener('input', motionValidateAndRenderLive);

    // Repair Prompt Copy Button
    document.getElementById('btn-copy-repair-prompt')?.addEventListener('click', motionCopyRepairPrompt);

    // Auto Generate Button
    document.getElementById('btn-motion-auto-generate')?.addEventListener('click', motionAutoGenerate);

    // Open Editor Button
    document.getElementById('btn-motion-open-editor')?.addEventListener('click', motionOpenEditor);

    // Window focus restores draft if user navigated to external AI tab and back
    window.addEventListener('focus', () => {
      motionRestoreDraft();
    });

    motionRestoreDraft();
    motionValidateAndRenderLive();
  }

  function motionOpenEditor() {
    try {
      let scene = motionParsedValidScene;
      if (!scene) {
        const rawText = document.getElementById('motion-json')?.value?.trim();
        if (rawText && window.MotionParser) {
          const res = window.MotionParser.parseAndRepairScene(rawText);
          if (res.valid) scene = res.scene;
        }
      }

      if (!scene) {
        showToast('يرجى لصق رد JSON صالح أولاً لفتح المحرر.', 'warning');
        return;
      }

      motionEditorScene = JSON.parse(JSON.stringify(scene));
      motionUndoStack = [JSON.parse(JSON.stringify(motionEditorScene))];
      motionRedoStack = [];

      const nameInput = document.getElementById('motion-scene-name');
      if (nameInput) nameInput.value = motionEditorScene.name || 'مشهد موشن جرافيك';

      motionEditorAspect = (motionEditorScene.width === 1080 && motionEditorScene.height === 1920) ? '9:16'
        : (motionEditorScene.width === motionEditorScene.height) ? '1:1' : '16:9';

      const aspectSelect = document.getElementById('motion-aspect-ratio');
      if (aspectSelect) aspectSelect.value = motionEditorAspect;

      motionEditorDuration = Number(motionEditorScene.duration) || 5;
      const playhead = document.getElementById('motion-playhead');
      if (playhead) {
        playhead.max = motionEditorDuration;
        playhead.value = 0;
      }

      motionEditorSelectedIndex = 0;
      motionEditorTime = 0;
      motionEditorPlaying = false;
      if (motionEditorFrame) cancelAnimationFrame(motionEditorFrame);
      motionEditorFrame = 0;

      switchTab('motion-editor');
      initMotionEditorControls();
      motionEditorRender();
    } catch (err) {
      showToast('تعذر فتح المشهد في المحرر: ' + err.message, 'error');
    }
  }

  function motionBackToLanding() {
    switchTab('motion-builder');
    motionRestoreDraft();
  }

  function motionEditorRender() {
    if (!motionEditorScene) return;
    motionEditorUpdateAspectPreview();
    motionEditorRenderTimeline();
    motionEditorRenderProperties();
    motionEditorRenderPreview();
    motionEditorUpdatePlaybackControls();
  }

  function motionEditorAspectDimensions() {
    if (motionEditorAspect === '9:16') return { width: 1080, height: 1920, ratio: 9 / 16 };
    if (motionEditorAspect === '1:1') return { width: 1080, height: 1080, ratio: 1 };
    return { width: 1920, height: 1080, ratio: 16 / 9 };
  }

  function motionEditorSetAspect(value) {
    if (!['16:9', '9:16', '1:1'].includes(value)) return;
    motionEditorAspect = value;
    if (motionEditorScene) motionEditorScene.aspectRatio = value;
    const layout = motionEditorScene ? motionAutoLayoutScene(motionEditorScene) : { adjusted: 0, unresolved: 0 };
    motionEditorUpdateAspectPreview();
    const jsonField = document.getElementById('motion-json');
    if (jsonField && motionEditorScene) jsonField.value = JSON.stringify(motionEditorScene, null, 2);
    motionEditorRenderPreview();
    if (layout.adjusted) motionNotice(`أُعيد توزيع ${layout.adjusted} عنصر ليتناسب مع مقاس الفيديو الجديد.`, false, 'motion-editor-status');
  }

  function motionEditorUpdateAspectPreview() {
    const dimensions = motionEditorAspectDimensions();
    const select = document.getElementById('motion-aspect-ratio');
    const label = document.getElementById('motion-preview-resolution');
    const stage = document.getElementById('motion-preview-stage');
    if (select) select.value = motionEditorAspect;
    if (label) label.textContent = `${dimensions.width} × ${dimensions.height}`;
    if (!stage) return;
    stage.style.aspectRatio = `${dimensions.width} / ${dimensions.height}`;
    const wrap = stage.parentElement;
    const bounds = wrap?.getBoundingClientRect();
    const availableHeight = Math.max(120, (bounds?.height || Math.max(180, window.innerHeight - 470)) - 4);
    const availableWidth = Math.max(160, (bounds?.width || window.innerWidth - 330) - 8);
    const width = Math.min(940, availableWidth, availableHeight * dimensions.ratio);
    stage.style.width = `${Math.max(160, width)}px`;
  }

  async function motionEditorLoadAudio(kind, id) {
    const cacheKey = `${kind}:${id}`;
    if (motionEditorAudioCache.has(cacheKey)) return motionEditorAudioCache.get(cacheKey);
    const loading = fetch(`assets/motion-audio/${kind}/${encodeURIComponent(id)}.wav`, { cache: 'force-cache' })
      .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer(); })
      .then(data => {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Web Audio غير مدعوم في هذا المتصفح.');
        if (!motionEditorAudioContext) motionEditorAudioContext = new AudioContextClass();
        return motionEditorAudioContext.decodeAudioData(data.slice(0));
      });
    motionEditorAudioCache.set(cacheKey, loading);
    try { const buffer = await loading; motionEditorAudioCache.set(cacheKey, buffer); return buffer; }
    catch (error) { motionEditorAudioCache.delete(cacheKey); throw error; }
  }

  async function motionEditorPreloadAudio() {
    if (!motionEditorScene) return;
    const jobs = motionEditorScene.elements.filter(item => item.type === 'sfx').map(item => ['sfx', item.sfxId]);
    if (motionEditorScene.music?.musicId) jobs.push(['music', motionEditorScene.music.musicId]);
    await Promise.allSettled(jobs.map(([kind, id]) => motionEditorLoadAudio(kind, id)));
  }

  function motionEditorStopAudio() {
    motionEditorAudioNodes.forEach(node => { try { node.stop(); } catch (_) {} try { node.disconnect(); } catch (_) {} });
    motionEditorAudioNodes = [];
  }

  async function motionEditorScheduleAudio(offsetSeconds, outputNode = null) {
    if (!motionEditorScene) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('تشغيل الصوت يحتاج متصفحاً يدعم Web Audio.');
    if (!motionEditorAudioContext) motionEditorAudioContext = new AudioContextClass();
    await motionEditorAudioContext.resume();
    const context = motionEditorAudioContext;
    const now = context.currentTime + 0.08;
    const destination = outputNode || context.destination;
    const audioItems = motionEditorScene.elements.filter(item => item.type === 'sfx');
    const jobs = audioItems.map(item => ({ kind: 'sfx', id: item.sfxId, time: Number(item.startTime) || 0, duration: Number(item.duration) || 0.5, volume: 0.2 }));
    if (motionEditorScene.music?.musicId) jobs.push({ kind: 'music', id: motionEditorScene.music.musicId, time: 0, duration: Number(motionEditorScene.music.duration) || motionEditorDuration, volume: Math.max(0.05, Math.min(0.8, Number(motionEditorScene.music.volume) || 0.28)) });
    const buffers = await Promise.all(jobs.map(async job => ({ job, buffer: await motionEditorLoadAudio(job.kind, job.id) })));
    if (!outputNode && !motionEditorPlaying) return;
    buffers.forEach(({ job, buffer }) => {
      const remaining = job.time + job.duration - offsetSeconds;
      if (remaining <= 0) return;
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = job.kind === 'music';
      const gain = context.createGain(); gain.gain.value = job.volume; source.connect(gain); gain.connect(destination);
      const startAt = now + Math.max(0, job.time - offsetSeconds);
      const bufferOffset = job.kind === 'music' ? Math.max(0, offsetSeconds - job.time) % Math.max(0.01, buffer.duration) : Math.max(0, offsetSeconds - job.time);
      if (job.kind === 'sfx' && bufferOffset >= buffer.duration) return;
      source.start(startAt, bufferOffset);
      source.stop(now + Math.max(0.02, Math.min(remaining, motionEditorDuration - offsetSeconds)));
      motionEditorAudioNodes.push(source, gain);
    });
  }

  function motionEditorRenderTimeline() {
    const timeline = document.getElementById('motion-timeline');
    if (!timeline) return;
    timeline.replaceChildren();
    const elements = motionEditorScene.elements;
    const maxTrack = Math.max(0, ...elements.map(item => Math.max(0, Math.floor(Number(item.trackIndex) || 0))));
    const ruler = document.createElement('div');
    ruler.className = 'motion-ruler';
    ruler.style.minWidth = `${Math.max(500, 92 + motionEditorDuration * 44)}px`;
    const tickCount = Math.min(12, Math.max(2, Math.ceil(motionEditorDuration / 2)));
    for (let i = 0; i <= tickCount; i += 1) {
      const tick = document.createElement('span');
      tick.className = 'motion-ruler-tick';
      tick.style.left = `${i / tickCount * 100}%`;
      tick.textContent = `${(motionEditorDuration * i / tickCount).toFixed(i === tickCount ? 0 : 1)}s`;
      ruler.appendChild(tick);
    }
    timeline.appendChild(ruler);

    if (Boolean(motionEditorScene.layers)) {
      motionEditorScene.layers.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'motion-track-row';
        const label = document.createElement('span');
        label.className = 'motion-track-label';
        const itemName = item.name || item.content?.text || (item.type === 'text' ? 'نص' : item.type === 'counter' ? 'عداد' : 'شكل');
        label.textContent = itemName.slice(0, 14);
        label.title = itemName;

        const lane = document.createElement('div');
        lane.className = 'motion-track-lane';

        const clip = document.createElement('button');
        clip.type = 'button';
        const clipType = item.type === 'text' ? 'clip-text' : item.type === 'counter' ? 'clip-sfx' : 'clip-mogrt';
        clip.className = `motion-clip ${clipType}${index === motionEditorSelectedIndex ? ' is-selected' : ''}`;
        const start = Math.max(0, Number(item.start) || 0);
        const duration = Math.max(0.1, Number(item.duration) || 1);
        clip.style.left = `${Math.min(100, (start / motionEditorDuration) * 100)}%`;
        clip.style.width = `${Math.max(2, Math.min(100 - (start / motionEditorDuration) * 100, (duration / motionEditorDuration) * 100))}%`;
        clip.title = `${itemName} · ${start.toFixed(2)}s — ${(start + duration).toFixed(2)}s`;
        clip.textContent = itemName;
        clip.addEventListener('click', () => {
          motionEditorSelectedIndex = index;
          motionEditorTime = start;
          motionEditorRender();
        });

        lane.appendChild(clip);
        row.append(label, lane);
        timeline.appendChild(row);
      });
    } else {
      for (let track = maxTrack; track >= 0; track -= 1) {
        const row = document.createElement('div');
        row.className = 'motion-track-row';
        const label = document.createElement('span');
        label.className = 'motion-track-label';
        label.textContent = `مسار ${track + 1}`;
        const lane = document.createElement('div');
        lane.className = 'motion-track-lane';
        elements.forEach((item, index) => {
          if (Math.floor(Number(item.trackIndex) || 0) !== track) return;
          const clip = document.createElement('button');
          clip.type = 'button';
          const isText = motionEditorIsText(item);
          clip.className = `motion-clip ${item.type === 'sfx' ? 'clip-sfx' : isText ? 'clip-text' : 'clip-mogrt'}${index === motionEditorSelectedIndex ? ' is-selected' : ''}`;
          const start = Math.max(0, Number(item.startTime) || 0);
          const duration = Math.max(.1, Number(item.duration) || .1);
          clip.style.left = `${Math.min(100, start / motionEditorDuration * 100)}%`;
          clip.style.width = `${Math.max(2, Math.min(100 - start / motionEditorDuration * 100, duration / motionEditorDuration * 100))}%`;
          clip.title = `${motionEditorLabel(item)} · ${start.toFixed(2)}s — ${(start + duration).toFixed(2)}s`;
          clip.textContent = motionEditorLabel(item);
          clip.addEventListener('click', () => {
            motionEditorSelectedIndex = index;
            motionEditorTime = start;
            motionEditorRender();
          });
          lane.appendChild(clip);
        });
        row.append(label, lane);
        timeline.appendChild(row);
      }
    }
    if (motionEditorScene.music?.musicId) {
      const musicRow = document.createElement('div');
      musicRow.className = 'motion-track-row';
      const musicLabel = document.createElement('span');
      musicLabel.className = 'motion-track-label';
      musicLabel.textContent = 'موسيقى';
      const musicLane = document.createElement('div');
      musicLane.className = 'motion-track-lane';
      const musicClip = document.createElement('button');
      musicClip.type = 'button';
      musicClip.className = 'motion-clip clip-music';
      musicClip.style.left = '0%';
      musicClip.style.width = `${Math.min(100, (Number(motionEditorScene.music.duration) || motionEditorDuration) / motionEditorDuration * 100)}%`;
      musicClip.textContent = `♫ ${motionEditorScene.music.musicId}`;
      musicClip.title = `موسيقى خلفية · ${motionEditorScene.music.musicId}`;
      musicClip.addEventListener('click', () => { const status = document.getElementById('motion-editor-status'); if (status) status.textContent = 'الموسيقى ستعمل أثناء المعاينة والتصدير.'; });
      musicLane.appendChild(musicClip);
      musicRow.append(musicLabel, musicLane);
      timeline.insertBefore(musicRow, timeline.children[1] || null);
    }
    const playhead = document.createElement('div');
    playhead.className = 'motion-playhead-line';
    timeline.appendChild(playhead);
    motionEditorUpdatePlayheadLine();
    const summary = document.getElementById('motion-timeline-summary');
    const totalCount = motionEditorScene.layers ? motionEditorScene.layers.length : elements.length;
    if (summary) summary.textContent = `${totalCount} طبقات · ${motionEditorDuration.toFixed(1)} ثانية`;
  }

  function motionEditorUpdatePlayheadLine() {
    const timeline = document.getElementById('motion-timeline');
    const playhead = timeline?.querySelector('.motion-playhead-line');
    if (!timeline || !playhead) return;
    const contentWidth = Math.max(1, timeline.scrollWidth - 92);
    playhead.style.left = `${92 + contentWidth * Math.min(1, motionEditorTime / motionEditorDuration)}px`;
  }

  function motionEditorIsText(item) {
    return (item.type === 'mogrt' || item.type === 'graphic') && ['text_kinetic', 'text_badge', 'widget_counter', 'widget_donut_ring', 'widget_social_card', 'logo_outro'].includes(item.templateId);
  }

  function motionEditorSemanticTopic(scene) {
    const copy = [scene?.semanticText || '', ...(scene?.elements || []).filter(motionEditorIsText).flatMap(item => [item.params?.text, item.params?.label])].join(' ').toLowerCase();
    if (/(قهوة|القهوة|بُن|البن|حبوب القهوة|coffee|espresso|cappuccino|latte)/i.test(copy)) return 'coffee';
    return '';
  }

  function motionEditorApplySemanticPalette(scene) {
    if (!scene?.elements || motionPalette.length) return false;
    const topic = motionEditorSemanticTopic(scene);
    if (topic !== 'coffee') return false;
    let changed = false;
    scene.elements.forEach(item => {
      const params = item.params && typeof item.params === 'object' ? item.params : (item.params = {});
      if (item.type === 'color_matte' || ['bg_aurora', 'bg_grid'].includes(item.templateId)) {
        if (params.color1 !== '#241710') { params.color1 = '#241710'; changed = true; }
        if (params.color2 !== '#70482F') { params.color2 = '#70482F'; changed = true; }
      }
      if (!motionEditorIsText(item)) return;
      if (params.color1 !== '#C9884D') { params.color1 = '#C9884D'; changed = true; }
      if (params.color2 !== '#E3B77E') { params.color2 = '#E3B77E'; changed = true; }
      if (params.textColor !== '#FFF4E2') { params.textColor = '#FFF4E2'; changed = true; }
    });
    return changed;
  }

  function motionEditorColorLuminance(color) {
    if (!/^#[0-9a-f]{6}$/i.test(String(color || ''))) return 0;
    const channels = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4));
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  }

  function motionEditorContrastRatio(foreground, background) {
    const first = motionEditorColorLuminance(foreground), second = motionEditorColorLuminance(background);
    return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
  }

  function motionEditorEnsureTextContrast(scene) {
    if (!scene?.elements) return false;
    let changed = motionEditorApplySemanticPalette(scene);
    const backgrounds = scene.elements.filter(item => item.type === 'color_matte' || ['bg_aurora', 'bg_grid'].includes(item.templateId));
    scene.elements.forEach(item => {
      if (!motionEditorIsText(item)) return;
      const params = item.params && typeof item.params === 'object' ? item.params : (item.params = {});
      const requested = /^#[0-9a-f]{6}$/i.test(params.textColor || '') ? params.textColor : '#FFFFFF';
      const midpoint = (Number(item.startTime) || 0) + (Number(item.duration) || 0) / 2;
      const background = backgrounds.filter(candidate => midpoint >= (Number(candidate.startTime) || 0) && midpoint <= (Number(candidate.startTime) || 0) + (Number(candidate.duration) || 0)).reduce((top, candidate) => !top || Number(candidate.trackIndex) >= Number(top.trackIndex) ? candidate : top, null);
      const backgroundColor1 = /^#[0-9a-f]{6}$/i.test(background?.params?.color1 || '') ? background.params.color1 : '#1A2744';
      const backgroundColor2 = /^#[0-9a-f]{6}$/i.test(background?.params?.color2 || '') ? background.params.color2 : '#3F2A70';
      const card = ['text_badge', 'widget_counter', 'widget_social_card'].includes(item.templateId);
      const surfaces = card ? ['#0A0D12'] : [backgroundColor1, backgroundColor2, '#080A10'];
      const score = color => Math.min(...surfaces.map(surface => motionEditorContrastRatio(color, surface)));
      if (score(requested) >= 4.5) return;
      const replacement = score('#FFF4E2') >= 4.5 ? '#FFF4E2' : score('#FFFFFF') >= 4.5 ? '#FFFFFF' : score('#11131F') >= 4.5 ? '#11131F' : '#FFFFFF';
      if (params.textColor !== replacement) { params.textColor = replacement; changed = true; }
    });
    return changed;
  }

  function motionEditorDrawCoffeeIllustration(context, width, height, time, scene) {
    const textItems = (scene?.elements || []).filter(motionEditorIsText);
    const candidates = [[.22, .27], [.78, .27], [.22, .72], [.78, .72]];
    const anchor = candidates.map(([cx, cy]) => ({ x: width * cx, y: height * cy })).map(point => ({ ...point, clearance: textItems.reduce((score, item) => {
      const position = Array.isArray(item.position) ? item.position : [960, 540];
      return score + Math.hypot(point.x - Number(position[0]) / 1920 * width, point.y - Number(position[1]) / 1080 * height);
    }, 0) })).sort((a, b) => b.clearance - a.clearance)[0];
    const size = Math.min(width * .27, height * .48);
    const scale = size / 360;
    const x = scene?.semanticAnchor ? (Number(scene.semanticAnchor[0]) < 960 ? width * .78 : width * .22) : anchor.x;
    const y = scene?.semanticAnchor ? (Number(scene.semanticAnchor[1]) < 540 ? height * .72 : height * .27) : anchor.y;
    const cream = '#F4DDB7', roast = '#A76B3E', coffee = '#4A2B1B';
    context.save(); context.translate(x, y); context.scale(scale, scale); context.globalAlpha = .97;
    const glow = context.createRadialGradient(0, 0, 24, 0, 0, 190);
    glow.addColorStop(0, '#D39B5A38'); glow.addColorStop(1, '#D39B5A00'); context.fillStyle = glow;
    context.beginPath(); context.arc(0, 0, 190, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#F0D5AE35'; context.lineWidth = 2; context.beginPath(); context.arc(0, 0, 165, time * .1, time * .1 + Math.PI * 1.52); context.stroke();
    context.save(); context.shadowColor = '#00000085'; context.shadowBlur = 24; context.shadowOffsetY = 17;
    const saucer = context.createLinearGradient(-120, 90, 120, 140); saucer.addColorStop(0, '#F8E8CF'); saucer.addColorStop(.55, '#D6B58B'); saucer.addColorStop(1, '#FFF2DA');
    context.fillStyle = saucer; context.beginPath(); context.ellipse(0, 105, 124, 26, 0, 0, Math.PI * 2); context.fill(); context.restore();
    context.strokeStyle = '#F7E8D1'; context.lineWidth = 18; context.beginPath(); context.ellipse(89, -8, 45, 59, .18, -.9, Math.PI * .9); context.stroke();
    const cup = context.createLinearGradient(-92, -72, 90, 88); cup.addColorStop(0, '#FFF0D8'); cup.addColorStop(.32, '#D8B58B'); cup.addColorStop(.7, '#F2D8B3'); cup.addColorStop(1, '#B9885C');
    context.fillStyle = cup; context.beginPath(); context.moveTo(-94, -54); context.quadraticCurveTo(-83, 67, -49, 80); context.quadraticCurveTo(0, 96, 48, 80); context.quadraticCurveTo(83, 59, 94, -54); context.closePath(); context.fill();
    context.strokeStyle = '#FFF4E2'; context.lineWidth = 8; context.beginPath(); context.ellipse(0, -53, 95, 23, 0, 0, Math.PI * 2); context.stroke();
    const crema = context.createLinearGradient(0, -76, 0, -31); crema.addColorStop(0, '#6B3D24'); crema.addColorStop(.62, '#362015'); crema.addColorStop(1, '#9C6239');
    context.fillStyle = crema; context.beginPath(); context.ellipse(0, -53, 86, 15, 0, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#E7BC84'; context.lineWidth = 3; context.globalAlpha = .78; context.beginPath(); context.ellipse(0, -53, 49, 7, -.12, .2, Math.PI * 1.45); context.stroke(); context.globalAlpha = .97;
    for (let index = 0; index < 3; index += 1) {
      const phase = time * 1.4 + index * 1.9;
      context.save(); context.globalAlpha = .5 + .28 * Math.sin(phase); context.strokeStyle = cream; context.lineWidth = 4; context.lineCap = 'round';
      context.beginPath(); context.moveTo(-35 + index * 34, -85); context.bezierCurveTo(-55 + index * 34, -112 - Math.sin(phase) * 8, -8 + index * 34, -130, -32 + index * 34, -161 - Math.cos(phase) * 10); context.stroke(); context.restore();
    }
    const beans = [[-137, 29, -.42], [137, 73, .6], [119, -112, -.8]];
    beans.forEach(([bx, by, angle], index) => {
      context.save(); context.translate(bx, by + Math.sin(time * 1.3 + index) * 3); context.rotate(angle);
      context.fillStyle = index === 1 ? roast : coffee; context.beginPath(); context.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#E5B67F'; context.lineWidth = 2.5; context.beginPath(); context.moveTo(-13, 1); context.bezierCurveTo(-5, -10, 4, 11, 14, -2); context.stroke(); context.restore();
    });
    motionEditorDrawSparkle(context, -124, -91, 8, '#F8D79E', time * .3, .9);
    motionEditorDrawSparkle(context, 130, -34, 7, '#F8D79E', -time * .4, .75);
    context.restore();
  }

  function motionEditorLabel(item) {
    if (item.type === 'sfx') return item.sfxId || 'مؤثر صوتي';
    if (item.type === 'color_matte') return 'خلفية لونية';
    const text = String(item.params?.text || '').trim();
    return text || item.templateId || 'قالب';
  }

  function motionEditorRenderProperties() {
    const empty = document.getElementById('motion-editor-empty');
    const fields = document.getElementById('motion-text-properties');
    const indexBadge = document.getElementById('motion-property-index');

    if (!motionEditorScene) return;
    const isV2 = Boolean(motionEditorScene.layers);
    const elementsList = isV2 ? motionEditorScene.layers : (motionEditorScene.elements || []);
    const item = elementsList[motionEditorSelectedIndex];
    const editable = isV2 ? (item && (item.type === 'text' || item.type === 'counter' || item.type === 'shape')) : (item && motionEditorIsText(item));

    if (empty) empty.classList.toggle('hidden', Boolean(editable));
    if (fields) fields.classList.toggle('hidden', !editable);
    if (indexBadge) indexBadge.textContent = item ? `${String(motionEditorSelectedIndex + 1).padStart(2, '0')} / ${String(elementsList.length).padStart(2, '0')}` : '—';

    if (!editable) {
      if (empty) empty.querySelector('p').textContent = 'اختر طبقة من خط الزمن أو المعاينة لتعديلها.';
      return;
    }

    const textField = document.getElementById('motion-edit-text');
    const fontField = document.getElementById('motion-edit-font');
    const sizeField = document.getElementById('motion-edit-size');
    const colorField = document.getElementById('motion-edit-color');
    const presetIn = document.getElementById('motion-edit-preset-in');
    const presetOut = document.getElementById('motion-edit-preset-out');
    const presetLoop = document.getElementById('motion-edit-preset-loop');

    if (isV2) {
      const textVal = item.content?.text || (item.type === 'counter' ? String(item.content?.endVal ?? '') : (item.name || ''));
      if (textField && document.activeElement !== textField) textField.value = textVal;
      if (fontField) fontField.value = item.style?.font || 'Cairo';
      if (sizeField && document.activeElement !== sizeField) sizeField.value = item.style?.fontSize || 56;
      if (colorField) colorField.value = item.style?.fill || '#ffffff';
      if (presetIn) presetIn.value = item.presets?.in?.name || 'pop';
      if (presetOut) presetOut.value = item.presets?.out?.name || 'none';
      if (presetLoop) presetLoop.value = item.presets?.loop?.name || 'none';
    } else {
      const params = item.params || (item.params = {});
      if (textField && document.activeElement !== textField) textField.value = params.text || '';
      if (fontField) fontField.value = ['Cairo', 'Readex Pro', 'Tajawal', 'Almarai', 'Inter'].includes(params.fontFamily) ? params.fontFamily : 'Cairo';
      if (sizeField && document.activeElement !== sizeField) sizeField.value = Math.max(12, Math.min(220, Number(params.fontSize) || 64));
      if (colorField) colorField.value = /^#[0-9a-f]{6}$/i.test(params.textColor || '') ? params.textColor : '#FFFFFF';
    }
  }

  function motionEditorRenderPreview() {
    const stage = document.getElementById('motion-preview-stage');
    if (!stage) return;
    stage.replaceChildren();
    if (!motionEditorScene) return;
    const dimensions = motionEditorAspectDimensions();
    const canvas = document.createElement('canvas');
    canvas.className = 'motion-preview-canvas';
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (context) {
      if (motionEditorScene.layers && window.MotionEngine) {
        window.MotionEngine.renderFrame(motionEditorScene, motionEditorTime, canvas, { resizeCanvas: false });
      } else {
        motionEditorDrawExportFrame(context, motionEditorTime, canvas.width, canvas.height, false, motionEditorSelectedIndex);
      }
    }
    canvas.addEventListener('click', event => {
      const isV2 = Boolean(motionEditorScene.layers);
      const elementsList = isV2 ? motionEditorScene.layers : motionEditorScene.elements;
      if (!elementsList?.length) return;
      const bounds = canvas.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * dimensions.width;
      const y = ((event.clientY - bounds.top) / bounds.height) * dimensions.height;

      const candidates = elementsList.map((item, index) => ({ item, index })).filter(({ item }) => {
        const start = isV2 ? (Number(item.start) || 0) : (Number(item.startTime) || 0);
        const dur = Number(item.duration) || 1;
        return motionEditorTime >= start && motionEditorTime <= start + dur;
      });
      if (!candidates.length) return;

      const nearest = candidates.reduce((best, candidate) => {
        const pos = isV2 ? [candidate.item.transform?.x || dimensions.width / 2, candidate.item.transform?.y || dimensions.height / 2] : (Array.isArray(candidate.item.position) ? candidate.item.position : [960, 540]);
        const distance = Math.hypot(x - Number(pos[0]), y - Number(pos[1]));
        return distance < best.distance ? { index: candidate.index, distance } : best;
      }, { index: candidates[0].index, distance: Infinity });

      motionEditorSelectedIndex = nearest.index;
      motionEditorRender();
    });
    stage.appendChild(canvas);
  }

  function motionEditorBackground(item) {
    if (!item) return 'radial-gradient(ellipse at 50% 110%, #293950 0%, #141b2b 48%, #090b13 100%)';
    const color1 = /^#[0-9a-f]{6}$/i.test(item.params?.color1 || '') ? item.params.color1 : '#171722';
    const color2 = /^#[0-9a-f]{6}$/i.test(item.params?.color2 || '') ? item.params.color2 : '#25263D';
    if (item.type === 'color_matte') {
      return `radial-gradient(ellipse at 15% 15%, ${color2}88 0%, transparent 50%), linear-gradient(145deg, ${color1}, #09090b)`;
    }
    if (item.templateId === 'bg_grid') return `radial-gradient(ellipse at 15% 15%, ${color1}55 0%, transparent 48%), linear-gradient(145deg, ${color1}33, ${color2}28 55%, #09090b)`;
    return `radial-gradient(ellipse at 20% 10%, ${color1} 0%, transparent 38%), radial-gradient(ellipse at 85% 88%, ${color2} 0%, transparent 40%), linear-gradient(145deg, #121326, #080a12 70%)`;
  }

  function motionEditorLayerAnimation(item, atTime = motionEditorTime) {
    const start = Number(item.startTime) || 0;
    const end = start + (Number(item.duration) || 0);
    const elapsed = Math.max(0, atTime - start);
    const remaining = Math.max(0, end - atTime);
    const result = { scale: 1, offsetX: 0, offsetY: 0, opacity: 1 };
    const animationIn = String(item.animationIn || 'none').toLowerCase();
    const entranceDuration = animationIn === 'word-reveal' ? .85 : .48;
    if (animationIn === 'pop-in' && elapsed < .48) {
      const progress = elapsed / .48;
      const eased = 1 - Math.pow(1 - progress, 3);
      result.scale = Math.max(.02, eased * 1.08);
      if (eased > .82) result.scale = 1 + (eased - .82) * .44;
    } else if (['zoom-in', 'bounce-in'].includes(animationIn) && elapsed < .58) {
      const progress = Math.min(1, elapsed / .58);
      const eased = animationIn === 'bounce-in' ? 1 - Math.pow(1 - progress, 3) + Math.sin(progress * Math.PI) * .12 * (1 - progress) : 1 - Math.pow(1 - progress, 4);
      result.scale = Math.max(.02, eased);
      result.opacity = Math.min(1, progress * 1.5);
    } else if (['slide-up', 'slide-left', 'slide-right'].includes(animationIn) && elapsed < .52) {
      const progress = elapsed / .42;
      const eased = 1 - Math.pow(1 - progress, 3);
      if (animationIn === 'slide-up') result.offsetY = (1 - eased) * 78;
      else result.offsetX = (1 - eased) * (animationIn === 'slide-left' ? 110 : -110);
      result.opacity = Math.max(.05, eased);
    } else if (animationIn === 'fade-in' && elapsed < .45) {
      result.opacity = Math.max(.05, 1 - Math.pow(1 - elapsed / .45, 3));
    } else if (animationIn === 'word-reveal' && elapsed < entranceDuration) {
      result.opacity = Math.min(1, .35 + elapsed / entranceDuration);
    }
    const animationOut = String(item.animationOut || 'none').toLowerCase();
    if (animationOut === 'fade-out' && remaining < .45) {
      result.opacity *= Math.max(0, remaining / .45);
    } else if (animationOut === 'slide-down' && remaining < .42) {
      const progress = 1 - remaining / .42;
      result.offsetY += progress * 78;
      result.opacity *= 1 - progress;
    } else if (['slide-left', 'slide-right'].includes(animationOut) && remaining < .42) {
      const progress = 1 - remaining / .42;
      result.offsetX += progress * (animationOut === 'slide-left' ? -90 : 90);
      result.opacity *= 1 - progress;
    } else if (animationOut === 'zoom-out' && remaining < .42) {
      const progress = 1 - remaining / .42;
      result.scale *= 1 - progress * .24;
      result.opacity *= 1 - progress;
    }
    return result;
  }

  function motionEditorDrawSparkle(context, x, y, size, color, rotation = 0, alpha = 1) {
    context.save(); context.translate(x, y); context.rotate(rotation); context.globalAlpha *= alpha;
    context.fillStyle = color; context.beginPath(); context.moveTo(0, -size); context.quadraticCurveTo(size * .12, -size * .12, size, 0); context.quadraticCurveTo(size * .12, size * .12, 0, size); context.quadraticCurveTo(-size * .12, size * .12, -size, 0); context.quadraticCurveTo(-size * .12, -size * .12, 0, -size); context.fill();
    context.restore();
  }

  function motionEditorDrawOrbit(context, x, y, radius, accent, phase = 0) {
    context.save(); context.translate(x, y); context.rotate(phase);
    context.strokeStyle = `${accent}55`; context.lineWidth = Math.max(1, radius * .035); context.beginPath(); context.ellipse(0, 0, radius, radius * .36, -.24, Math.PI * .08, Math.PI * 1.6); context.stroke();
    context.fillStyle = accent; context.shadowColor = accent; context.shadowBlur = radius * .35; context.beginPath(); context.arc(radius * .78, -radius * .16, Math.max(2, radius * .065), 0, Math.PI * 2); context.fill();
    context.restore();
  }

  function motionEditorDisplayText(item) {
    if ((item.templateId === 'widget_counter' || item.templateId === 'widget_donut_ring') && item.params?.numberValue != null) return `${item.params.numberValue}${item.templateId === 'widget_donut_ring' ? '%' : ''}`;
    return String(item.params?.text || (item.templateId === 'widget_counter' ? '١٢٬٥٠٠' : 'اكتب النص هنا'));
  }

  function motionPushUndoState() {
    if (!motionEditorScene) return;
    motionUndoStack.push(JSON.parse(JSON.stringify(motionEditorScene)));
    if (motionUndoStack.length > 30) motionUndoStack.shift();
    motionRedoStack = [];
    motionUpdateUndoRedoButtons();
  }

  function motionEditorUndo() {
    if (motionUndoStack.length <= 1) return;
    const current = motionUndoStack.pop();
    motionRedoStack.push(current);
    motionEditorScene = JSON.parse(JSON.stringify(motionUndoStack[motionUndoStack.length - 1]));
    motionEditorRender();
    motionUpdateUndoRedoButtons();
  }

  function motionEditorRedo() {
    if (!motionRedoStack.length) return;
    const next = motionRedoStack.pop();
    motionUndoStack.push(JSON.parse(JSON.stringify(next)));
    motionEditorScene = JSON.parse(JSON.stringify(next));
    motionEditorRender();
    motionUpdateUndoRedoButtons();
  }

  function motionUpdateUndoRedoButtons() {
    const btnUndo = document.getElementById('btn-motion-undo');
    const btnRedo = document.getElementById('btn-motion-redo');
    if (btnUndo) {
      btnUndo.disabled = motionUndoStack.length <= 1;
      btnUndo.style.opacity = motionUndoStack.length <= 1 ? '0.35' : '1';
    }
    if (btnRedo) {
      btnRedo.disabled = motionRedoStack.length === 0;
      btnRedo.style.opacity = motionRedoStack.length === 0 ? '0.35' : '1';
    }
  }

  function motionEditorUpdateSelected(key, value) {
    if (!motionEditorScene) return;
    const isV2 = Boolean(motionEditorScene.layers);
    const elementsList = isV2 ? motionEditorScene.layers : (motionEditorScene.elements || []);
    const item = elementsList[motionEditorSelectedIndex];
    if (!item) return;

    motionPushUndoState();

    if (isV2) {
      if (!item.style) item.style = {};
      if (!item.presets) item.presets = {};
      if (key === 'text') {
        if (!item.content) item.content = {};
        item.content.text = value;
      } else if (key === 'fontFamily' || key === 'font') {
        item.style.font = value;
      } else if (key === 'fontSize') {
        item.style.fontSize = Math.max(12, Math.min(220, Number(value) || 56));
      } else if (key === 'textColor' || key === 'fill') {
        item.style.fill = value;
      } else if (key === 'presetIn') {
        item.presets.in = { name: value };
      } else if (key === 'presetOut') {
        if (value === 'none') delete item.presets.out;
        else item.presets.out = { name: value };
      } else if (key === 'presetLoop') {
        if (value === 'none') delete item.presets.loop;
        else item.presets.loop = { name: value };
      }
    } else {
      if (!item.params || typeof item.params !== 'object') item.params = {};
      item.params[key] = value;
      motionEditorEnsureTextContrast(motionEditorScene);
    }

    const jsonField = document.getElementById('motion-json');
    if (jsonField) jsonField.value = JSON.stringify(motionEditorScene, null, 2);
    motionEditorRenderTimeline();
    motionEditorRenderPreview();
  }

  function motionEditorSetTime(value) {
    motionEditorTime = Math.max(0, Math.min(motionEditorDuration, Number(value) || 0));
    if (motionEditorPlaying) { motionEditorStopAudio(); motionEditorScheduleAudio(motionEditorTime).catch(error => console.warn('[MotionEditor] Audio preview failed:', error)); }
    motionEditorUpdatePlayheadLine();
    motionEditorRenderPreview();
    motionEditorUpdatePlaybackControls();
  }

  function motionEditorUpdatePlaybackControls() {
    const range = document.getElementById('motion-playhead');
    const timecode = document.getElementById('motion-play-time');
    const button = document.getElementById('motion-play-toggle');
    if (range) { range.max = String(motionEditorDuration); range.value = String(motionEditorTime); }
    if (timecode) timecode.textContent = `${motionFormatTime(motionEditorTime)} / ${motionFormatTime(motionEditorDuration)}`;
    if (button) button.innerHTML = `<i class="fa-solid fa-${motionEditorPlaying ? 'pause' : 'play'}"></i>`;
  }

  function motionFormatTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  }

  function motionTogglePlayback() {
    if (!motionEditorScene) return;
    motionEditorPlaying = !motionEditorPlaying;
    motionEditorLastFrame = 0;
    if (motionEditorPlaying) {
      motionEditorFrame = requestAnimationFrame(motionEditorPlayFrame);
      motionEditorScheduleAudio(motionEditorTime).catch(error => {
        const status = document.getElementById('motion-editor-status');
        if (status) status.textContent = `تعذر تشغيل الصوت: ${error.message}`;
      });
    } else {
      if (motionEditorFrame) cancelAnimationFrame(motionEditorFrame);
      motionEditorStopAudio();
    }
    motionEditorUpdatePlaybackControls();
  }

  function motionEditorPlayFrame(timestamp) {
    if (!motionEditorPlaying) return;
    if (motionEditorLastFrame) motionEditorTime += (timestamp - motionEditorLastFrame) / 1000;
    motionEditorLastFrame = timestamp;
    if (motionEditorTime >= motionEditorDuration) {
      motionEditorTime = 0;
      motionEditorStopAudio();
      motionEditorScheduleAudio(0).catch(error => console.warn('[MotionEditor] Audio loop restart failed:', error));
    }
    motionEditorRenderPreview();
    motionEditorUpdatePlayheadLine();
    motionEditorUpdatePlaybackControls();
    motionEditorFrame = requestAnimationFrame(motionEditorPlayFrame);
  }

  function motionEditorDrawExportFrame(context, time, width, height, transparent = false, selectedIndex = -1) {
    if (motionEditorScene?.layers && window.MotionEngine) {
      window.MotionEngine.renderFrame(motionEditorScene, time, context.canvas, { resizeCanvas: false });
      return;
    }
    const all = motionEditorScene.elements || [];
    const visible = all.map((item, index) => ({ item, index })).filter(({ item }) => item.type !== 'sfx' && time >= (Number(item.startTime) || 0) && time <= (Number(item.startTime) || 0) + (Number(item.duration) || 0)).sort((left, right) => Number(left.item.trackIndex) - Number(right.item.trackIndex) || left.index - right.index).map(({ item }) => item);
    const bg = [...visible].reverse().find(item => item.type === 'color_matte' || ['bg_aurora', 'bg_grid'].includes(item.templateId));
    const p = bg?.params || {};
    const c1 = /^#[0-9a-f]{6}$/i.test(p.color1 || '') ? p.color1 : '#1A2744';
    const c2 = /^#[0-9a-f]{6}$/i.test(p.color2 || '') ? p.color2 : '#3F2A70';
    context.clearRect(0, 0, width, height);
    if (!transparent) {
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#11131A'); gradient.addColorStop(.48, c1); gradient.addColorStop(1, '#080A10'); context.fillStyle = gradient; context.fillRect(0, 0, width, height);
      const glow = context.createRadialGradient(width * .25, height * .16, 0, width * .25, height * .16, Math.max(width, height) * .76);
      glow.addColorStop(0, `${c2}55`); glow.addColorStop(.48, `${c1}24`); glow.addColorStop(1, `${c2}00`); context.fillStyle = glow; context.fillRect(0, 0, width, height);
      const lowerGlow = context.createRadialGradient(width * .86, height * .92, 0, width * .86, height * .92, Math.max(width, height) * .48);
      lowerGlow.addColorStop(0, `${c2}27`); lowerGlow.addColorStop(1, `${c2}00`); context.fillStyle = lowerGlow; context.fillRect(0, 0, width, height);
      const sweepX = ((time * .035) % 1.7 - .35) * width;
      const sweep = context.createLinearGradient(sweepX, 0, sweepX + width * .24, height);
      sweep.addColorStop(0, `${c2}00`); sweep.addColorStop(.5, `${c2}12`); sweep.addColorStop(1, `${c2}00`);
      context.fillStyle = sweep; context.fillRect(0, 0, width, height);
      context.save(); context.globalAlpha = .2;
      for (let index = 0; index < 24; index += 1) {
        const seed = index * 127.1;
        const x = (Math.sin(seed) * .5 + .5) * width;
        const y = (Math.cos(seed * .71) * .5 + .5) * height;
        const pulse = .5 + .5 * Math.sin(time * 1.7 + index * 2.2);
        context.fillStyle = index % 3 === 0 ? c2 : '#FFFFFF';
        context.beginPath(); context.arc(x, y, Math.max(1, width * (.0008 + pulse * .0012)), 0, Math.PI * 2); context.fill();
      }
      context.restore();
      if (bg?.templateId === 'bg_grid') {
        context.save(); context.lineWidth = Math.max(1, width / 2400);
        const step = Math.max(48, Math.round(width / 12));
        for (let x = 0; x <= width; x += step) { context.globalAlpha = x % (step * 4) === 0 ? .12 : .055; context.strokeStyle = c2; context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
        for (let y = 0; y <= height; y += step) { context.globalAlpha = y % (step * 4) === 0 ? .12 : .055; context.strokeStyle = c2; context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
        context.restore();
      }
      if (bg?.templateId === 'bg_aurora') {
        context.save(); context.globalAlpha = .14; context.strokeStyle = c2; context.lineWidth = Math.max(2, width / 700);
        for (let index = 0; index < 3; index += 1) { context.beginPath(); context.ellipse(width * (.18 + index * .32), height * (.84 - index * .12), width * .42, height * (.16 + index * .015), -.18, Math.PI, Math.PI * 1.92); context.stroke(); }
        context.restore();
      }
      if (motionEditorSemanticTopic(motionEditorScene) === 'coffee' && motionEditorScene.semanticBackdrop !== false) motionEditorDrawCoffeeIllustration(context, width, height, time, motionEditorScene);
      const vignette = context.createRadialGradient(width * .5, height * .48, Math.min(width, height) * .18, width * .5, height * .48, Math.max(width, height) * .7);
      vignette.addColorStop(0, '#00000000'); vignette.addColorStop(1, '#03050AB8'); context.fillStyle = vignette; context.fillRect(0, 0, width, height);
      context.save();
      const inset = Math.max(18, width * .035), edge = Math.max(1, width / 1800);
      context.strokeStyle = '#FFFFFF16'; context.lineWidth = edge; context.beginPath(); context.roundRect(inset, inset, width - inset * 2, height - inset * 2, Math.max(12, width * .012)); context.stroke();
      const corner = Math.max(18, width * .026), offset = inset + Math.max(8, width * .01);
      context.strokeStyle = `${c2}99`; context.lineWidth = Math.max(1.5, width / 1100); context.globalAlpha = .7;
      [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([dx, dy]) => {
        const x = dx === 1 ? offset : width - offset, y = dy === 1 ? offset : height - offset;
        context.beginPath(); context.moveTo(x, y + dy * corner); context.lineTo(x, y); context.lineTo(x + dx * corner, y); context.stroke();
      });
      context.restore();
    }
    visible.forEach(item => {
      if (!motionEditorIsText(item)) return;
      const itemIndex = all.indexOf(item);
      const params = item.params || {};
      const x = (Array.isArray(item.position) ? Number(item.position[0]) : 960) / 1920 * width;
      const y = (Array.isArray(item.position) ? Number(item.position[1]) : 540) / 1080 * height;
      const animation = motionEditorLayerAnimation(item, time);
      const scale = Math.max(.02, Math.min(3, (Number(item.scale) || 100) / 100 * animation.scale));
      const fontSize = Math.max(22, Math.min(height * .16, (Number(params.fontSize) || 68) * height / 1080));
      const text = motionEditorDisplayText(item);
      const accent = /^#[0-9a-f]{6}$/i.test(params.color1 || '') ? params.color1 : c1;
      const textColor = /^#[0-9a-f]{6}$/i.test(params.textColor || '') ? params.textColor : '#FFFFFF';
      context.save(); context.globalAlpha = Math.max(0, Math.min(1, animation.opacity));
      context.translate(x + animation.offsetX * width / 1920, y + animation.offsetY * height / 1080); context.scale(scale, scale);
      context.direction = 'rtl'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.font = `800 ${fontSize}px "${String(params.fontFamily || 'Readex Pro').replace(/["\\]/g, '')}", Cairo, Arial, sans-serif`;
      let textOffsetX = 0;
      if (item.templateId === 'text_badge') {
        const boxWidth = Math.min(width * .86, Math.max(fontSize * 4.8, context.measureText(text).width + fontSize * 2.15));
        const boxHeight = fontSize * 1.86;
        context.shadowColor = `${accent}66`; context.shadowBlur = fontSize * .62;
        const badgeGradient = context.createLinearGradient(-boxWidth / 2, -boxHeight / 2, boxWidth / 2, boxHeight / 2);
        badgeGradient.addColorStop(0, '#111722F5'); badgeGradient.addColorStop(1, '#0A0D15F5');
        context.fillStyle = badgeGradient; context.strokeStyle = `${accent}88`; context.lineWidth = Math.max(1, fontSize * .025);
        context.beginPath(); context.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, boxHeight * .42); context.fill(); context.stroke();
        context.shadowBlur = 0; context.fillStyle = `${accent}20`; context.beginPath(); context.arc(boxWidth / 2 - boxHeight * .55, 0, boxHeight * .34, 0, Math.PI * 2); context.fill();
        motionEditorDrawSparkle(context, boxWidth / 2 - boxHeight * .55, 0, boxHeight * .15, accent, time * 1.3);
        context.fillStyle = '#FFFFFF18'; context.beginPath(); context.roundRect(-boxWidth / 2 + 1, -boxHeight / 2 + 1, boxWidth - 2, boxHeight * .1, boxHeight * .08); context.fill();
        textOffsetX = -boxHeight * .18;
      } else if (item.templateId === 'widget_counter') {
        const boxWidth = Math.min(width * .78, fontSize * 8); const boxHeight = fontSize * 4.2;
        context.shadowColor = '#00000066'; context.shadowBlur = fontSize * .55; context.fillStyle = '#0B0E14F2'; context.beginPath(); context.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, fontSize * .38); context.fill();
        context.shadowBlur = 0; context.strokeStyle = '#FFFFFF22'; context.lineWidth = Math.max(1, fontSize / 28); context.stroke();
        context.fillStyle = accent; context.beginPath(); context.roundRect(-boxWidth / 2, -boxHeight / 2, Math.max(4, fontSize * .07), boxHeight, fontSize * .04); context.fill();
        context.fillStyle = `${accent}24`; context.beginPath(); context.arc(boxWidth / 2 - fontSize * .6, -boxHeight / 2 + fontSize * .55, fontSize * .3, 0, Math.PI * 2); context.fill();
        motionEditorDrawSparkle(context, boxWidth / 2 - fontSize * .6, -boxHeight / 2 + fontSize * .55, fontSize * .13, accent, time);
        const label = String(params.label || '').trim();
        if (label) { context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = `600 ${fontSize * .34}px "${String(params.fontFamily || 'Readex Pro').replace(/["\\]/g, '')}", Cairo, Arial, sans-serif`; context.fillStyle = '#B9C1CE'; context.fillText(label, 0, -boxHeight * .23, boxWidth * .8); }
      } else if (item.templateId === 'widget_donut_ring') {
        const radius = Math.min(width, height) * .2; const value = Math.max(0, Math.min(100, Number(params.numberValue) || 72));
        context.lineWidth = Math.max(8, radius * .13); context.strokeStyle = '#FFFFFF26'; context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.stroke();
        context.strokeStyle = accent; context.lineCap = 'round'; context.beginPath(); context.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * value / 100); context.stroke();
        context.font = `800 ${fontSize * 1.1}px "${String(params.fontFamily || 'Readex Pro').replace(/["\\]/g, '')}", Cairo, Arial, sans-serif`;
        context.fillStyle = textColor; context.fillText(`${value}%`, 0, 0); context.restore(); return;
      } else if (item.templateId === 'widget_social_card') {
        const boxWidth = Math.min(width * .78, Math.max(fontSize * 6, context.measureText(text).width + fontSize * 2.1)); const boxHeight = fontSize * 2.15;
        context.shadowColor = '#00000070'; context.shadowBlur = fontSize * .4; context.fillStyle = '#10141BEF'; context.beginPath(); context.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, fontSize * .32); context.fill();
        context.shadowBlur = 0; context.strokeStyle = '#FFFFFF24'; context.lineWidth = Math.max(1, fontSize / 28); context.stroke();
        context.fillStyle = accent; context.beginPath(); context.arc(-boxWidth / 2 + boxHeight * .52, 0, boxHeight * .22, 0, Math.PI * 2); context.fill();
        motionEditorDrawSparkle(context, -boxWidth / 2 + boxHeight * .52, 0, boxHeight * .11, '#FFFFFF', time * .8);
        textOffsetX = boxHeight * .23;
      }
      context.fillStyle = textColor; context.shadowColor = `${accent}55`; context.shadowBlur = fontSize * .24; context.shadowOffsetY = 0;
      const maxWidth = item.templateId === 'widget_counter' ? width * .7 : item.templateId === 'widget_social_card' ? width * .68 : width * .84; const words = String(text).split(/\s+/); const lines = []; let line = '';
      words.forEach(word => { const test = line ? `${line} ${word}` : word; if (line && context.measureText(test).width > maxWidth) { lines.push(line); line = word; } else line = test; });
      if (line) lines.push(line); const shown = lines.slice(0, 4); const lineHeight = fontSize * 1.24;
      context.fillStyle = textColor;
      context.lineWidth = Math.max(1.5, fontSize * .055); context.strokeStyle = '#1B120DE0'; context.lineJoin = 'round';
      const revealProgress = String(item.animationIn || '').toLowerCase() === 'word-reveal' ? Math.min(1, Math.max(0, (time - (Number(item.startTime) || 0)) / .85)) : 1;
      const lineWidths = shown.map(part => context.measureText(part).width);
      const totalWidth = Math.max(...lineWidths, 1);
      shown.forEach((part, index) => {
        const lineY = (index - (shown.length - 1) / 2) * lineHeight;
        if (revealProgress < 1) {
          const revealedWidth = Math.max(0, totalWidth * revealProgress - Math.max(0, totalWidth - lineWidths[index]) / 2);
          context.save(); context.beginPath(); context.rect(textOffsetX + lineWidths[index] / 2 - revealedWidth, lineY - lineHeight * .52, revealedWidth, lineHeight); context.clip();
          context.strokeText(part, textOffsetX, lineY, maxWidth); context.fillText(part, textOffsetX, lineY, maxWidth); context.restore();
        } else { context.strokeText(part, textOffsetX, lineY, maxWidth); context.fillText(part, textOffsetX, lineY, maxWidth); }
      });
      if (['text_kinetic', 'logo_outro'].includes(item.templateId)) {
        context.shadowBlur = 0; context.shadowOffsetY = 0;
        const lineY = (shown.length - 1) * lineHeight / 2 + fontSize * .76;
        const bar = context.createLinearGradient(-width * .29, 0, width * .29, 0); bar.addColorStop(0, `${accent}00`); bar.addColorStop(.26, `${accent}55`); bar.addColorStop(.5, `${accent}EE`); bar.addColorStop(.74, `${c2}77`); bar.addColorStop(1, `${c2}00`); context.fillStyle = bar; context.fillRect(-width * .29, lineY, width * .58, Math.max(3, fontSize * .055));
        motionEditorDrawOrbit(context, -Math.min(width * .3, totalWidth * .65), -fontSize * .5, fontSize * .75, accent, time * .22);
        motionEditorDrawSparkle(context, Math.min(width * .3, totalWidth * .65), -fontSize * .42, fontSize * .16, c2, -time * .7, .88);
        if (item.templateId === 'logo_outro') { context.strokeStyle = `${accent}99`; context.lineWidth = Math.max(2, fontSize * .035); context.beginPath(); context.arc(0, -(shown.length * lineHeight / 2 + fontSize * .55), fontSize * .19, 0, Math.PI * 2); context.stroke(); }
      }
      if (item.templateId === 'text_badge' || item.templateId === 'widget_counter' || item.templateId === 'widget_social_card') { context.shadowBlur = 0; context.shadowOffsetY = 0; }
      if (selectedIndex === itemIndex) {
        context.shadowBlur = 0; context.shadowOffsetY = 0; context.strokeStyle = '#FB923C'; context.lineWidth = Math.max(1.5, width / 1200); context.setLineDash([Math.max(6, width / 110), Math.max(4, width / 180)]);
        const selectionWidth = Math.min(width * .88, Math.max(fontSize * 4.2, ...shown.map(part => context.measureText(part).width + fontSize * .5)));
        context.strokeRect(-selectionWidth / 2, -(shown.length * lineHeight) / 2 - fontSize * .32, selectionWidth, shown.length * lineHeight + fontSize * .95);
      }
      context.restore();
    });
  }

  async function motionExportVideo() {
    if (typeof authorizeAndConsume === 'function') {
      if (!await authorizeAndConsume('motion')) return;
    }
    const button = document.getElementById('motion-editor-export');
    const status = document.getElementById('motion-editor-status');
    if (!motionEditorScene || motionEditorExporting) return;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { if (status) status.textContent = 'تصدير WebM غير مدعوم في هذا المتصفح.'; return; }
    motionEditorExporting = true;
    if (motionEditorPlaying) { motionEditorPlaying = false; if (motionEditorFrame) cancelAnimationFrame(motionEditorFrame); motionEditorFrame = 0; motionEditorStopAudio(); motionEditorUpdatePlaybackControls(); }
    if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin ml-2"></i>جارٍ التصدير…'; }
    let stream = null, recorder = null, exportAudioStream = null, raf = 0;
    try {
      const dimensions = motionEditorAspectDimensions();
      const canvas = document.createElement('canvas'); canvas.width = dimensions.width; canvas.height = dimensions.height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('تعذر تجهيز لوحة تصدير الفيديو.');
      motionEditorDrawExportFrame(context, 0, canvas.width, canvas.height);
      stream = canvas.captureStream(30);
      const hasSfx = Array.isArray(motionEditorScene.elements) && motionEditorScene.elements.some(item => item.type === 'sfx');
      if (motionEditorScene.music?.musicId || hasSfx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('المتصفح لا يدعم تصدير الصوت.');
        if (!motionEditorAudioContext) motionEditorAudioContext = new AudioContextClass();
        exportAudioStream = motionEditorAudioContext.createMediaStreamDestination();
        await motionEditorAudioContext.resume();
        await motionEditorScheduleAudio(0, exportAudioStream);
        exportAudioStream.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      }
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      const stopped = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = event => reject(event.error || new Error('فشل تسجيل الفيديو.')); });
      motionEditorExporting = true;
      const start = performance.now();
      recorder.start(1000);
      if (status) status.textContent = `جارٍ تسجيل ${dimensions.width}×${dimensions.height} مع المؤثرات…`;
      await new Promise((resolve, reject) => {
        const draw = now => {
          if (recorder.state !== 'recording') { resolve(); return; }
          const elapsed = (now - start) / 1000;
          motionEditorDrawExportFrame(context, Math.min(motionEditorDuration, elapsed), canvas.width, canvas.height);
          if (status) status.textContent = `جارٍ التصدير… ${Math.min(100, Math.floor(elapsed / motionEditorDuration * 100))}%`;
          if (elapsed >= motionEditorDuration) { recorder.stop(); resolve(); return; }
          raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        recorder.onerror = event => reject(event.error || new Error('فشل تسجيل الفيديو.'));
      });
      await stopped;
      const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
      if (!blob.size) throw new Error('ملف الفيديو الناتج فارغ.');
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `mickey-motion-${motionEditorAspect.replace(':', 'x')}-${Date.now()}.webm`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      if (status) status.textContent = 'اكتمل التصدير. تم تنزيل ملف WebM بالصوت والمقاس المختار.';
    } catch (error) {
      if (recorder?.state === 'recording') recorder.stop();
      if (status) status.textContent = error.message || 'تعذر تصدير الفيديو.';
    } finally {
      if (raf) cancelAnimationFrame(raf);
      motionEditorStopAudio();
      stream?.getTracks().forEach(track => track.stop());
      exportAudioStream?.stream.getTracks().forEach(track => track.stop());
      motionEditorExporting = false;
      if (button) { button.disabled = false; button.innerHTML = '<i class="fa-solid fa-download ml-2"></i>تصدير WebM'; }
    }
  }

  function motionBackToPrompt() {
    motionEditorPlaying = false;
    if (motionEditorFrame) cancelAnimationFrame(motionEditorFrame);
    motionEditorStopAudio();
    motionEditorFrame = 0;
    switchTab('motion-builder');
  }

  async function motionQuickTweak() {
    const input = document.getElementById('motion-quick-tweak-input');
    const button = document.getElementById('btn-motion-quick-tweak');
    const promptText = (input?.value || '').trim();
    if (!promptText) return;
    if (!motionEditorScene) {
      showToast('لا يوجد مشهد نشط في المحرر لتعديله.', 'warning');
      return;
    }

    const originalBtnHtml = button ? button.innerHTML : 'تطبيق';
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
      motionPushUndoState();

      // Fast local rules for instantaneous feedback
      let localModified = false;
      const lower = promptText.toLowerCase();

      if (/(ذهبي|gold|أصفر|yellow)/i.test(lower)) {
        if (motionEditorScene.layers) {
          motionEditorScene.layers.forEach(l => { if (l.style?.fill) l.style.fill = '#F59E0B'; });
          localModified = true;
        }
      } else if (/(أبيض|white)/i.test(lower)) {
        if (motionEditorScene.layers) {
          motionEditorScene.layers.forEach(l => { if (l.style?.fill) l.style.fill = '#FFFFFF'; });
          localModified = true;
        }
      } else if (/(أزرق|blue|نيلي)/i.test(lower)) {
        if (motionEditorScene.layers) {
          motionEditorScene.layers.forEach(l => { if (l.style?.fill) l.style.fill = '#38BDF8'; });
          localModified = true;
        }
      }

      if (/(كبر|تكبير|أكبر|larger|bigger)/i.test(lower)) {
        if (motionEditorScene.layers) {
          motionEditorScene.layers.forEach(l => { if (l.style?.fontSize) l.style.fontSize = Math.min(200, Math.round(l.style.fontSize * 1.25)); });
          localModified = true;
        }
      } else if (/(صغر|تصغير|أصغر|smaller)/i.test(lower)) {
        if (motionEditorScene.layers) {
          motionEditorScene.layers.forEach(l => { if (l.style?.fontSize) l.style.fontSize = Math.max(16, Math.round(l.style.fontSize * 0.8)); });
          localModified = true;
        }
      }

      if (localModified) {
        showToast('تم تطبيق التعديل السريع على المشهد.', 'success');
        input.value = '';
        motionEditorRender();
        return;
      }

      // If complex request, send to gateway
      const tweakInstruction = `لدينا مشهد موشن جرافيك بصيغة JSON التالية:\n${JSON.stringify(motionEditorScene)}\n\nالمطلوب إجراء التعديل التالي فقط وإرجاع JSON المشهد كاملاً متوافق مع schema v2 دون أي شرح أو markdown:\n${promptText}`;
      const res = await fetch('api.php?action=generate_motion_scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: tweakInstruction })
      });
      const data = await res.json();
      if (data.success && data.text) {
        const parsed = window.MotionParser.parseAndRepairScene(data.text);
        if (parsed.valid && parsed.scene) {
          motionEditorScene = parsed.scene;
          showToast('تم تعديل المشهد بالذكاء الاصطناعي بنجاح.', 'success');
          input.value = '';
          motionEditorRender();
          return;
        }
      }
      showToast('يمكنك تعديل الخصائص مباشرة من اللوحة الجانبية.', 'info');
    } catch (err) {
      showToast('تعذر تطبيق التعديل: ' + err.message, 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = originalBtnHtml;
      }
    }
  }

  function motionShowMoreMenu() {
    if (!motionEditorScene) return;
    const jsonStr = JSON.stringify(motionEditorScene, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        showToast('تم نسخ كود JSON للمشهد إلى الحافظة.', 'success');
      }).catch(() => {
        showToast('تعذر النسخ إلى الحافظة.', 'warning');
      });
    } else {
      showToast('الحافظة غير متوفرة في هذا المتصفح.', 'warning');
    }
  }

  function initMotionEditorControls() {
    const text = document.getElementById('motion-edit-text');
    const font = document.getElementById('motion-edit-font');
    const size = document.getElementById('motion-edit-size');
    const color = document.getElementById('motion-edit-color');
    const presetIn = document.getElementById('motion-edit-preset-in');
    const presetOut = document.getElementById('motion-edit-preset-out');
    const presetLoop = document.getElementById('motion-edit-preset-loop');
    const playhead = document.getElementById('motion-playhead');
    const sceneName = document.getElementById('motion-scene-name');
    const btnUndo = document.getElementById('btn-motion-undo');
    const btnRedo = document.getElementById('btn-motion-redo');
    const btnTweak = document.getElementById('btn-motion-quick-tweak');
    const tweakInput = document.getElementById('motion-quick-tweak-input');
    const btnMore = document.getElementById('btn-motion-more-menu');

    if (!document.getElementById('motion-editor-shell-ready')) {
      text?.addEventListener('input', () => motionEditorUpdateSelected('text', text.value));
      font?.addEventListener('change', () => motionEditorUpdateSelected('fontFamily', font.value));
      size?.addEventListener('input', () => motionEditorUpdateSelected('fontSize', Math.max(12, Math.min(220, Number(size.value) || 64))));
      color?.addEventListener('input', () => motionEditorUpdateSelected('textColor', color.value.toUpperCase()));
      presetIn?.addEventListener('change', () => motionEditorUpdateSelected('presetIn', presetIn.value));
      presetOut?.addEventListener('change', () => motionEditorUpdateSelected('presetOut', presetOut.value));
      presetLoop?.addEventListener('change', () => motionEditorUpdateSelected('presetLoop', presetLoop.value));

      sceneName?.addEventListener('input', () => {
        if (motionEditorScene) motionEditorScene.name = sceneName.value;
      });

      btnUndo?.addEventListener('click', motionEditorUndo);
      btnRedo?.addEventListener('click', motionEditorRedo);
      btnTweak?.addEventListener('click', motionQuickTweak);
      tweakInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          motionQuickTweak();
        }
      });
      btnMore?.addEventListener('click', motionShowMoreMenu);

      playhead?.addEventListener('input', () => motionEditorSetTime(playhead.value));
      document.getElementById('motion-aspect-ratio')?.addEventListener('change', event => motionEditorSetAspect(event.target.value));
      window.addEventListener('resize', motionEditorUpdateAspectPreview);

      // Keyboard shortcuts for Undo / Redo
      window.addEventListener('keydown', e => {
        const editorSection = document.getElementById('section-motion-editor');
        if (!editorSection || editorSection.classList.contains('hidden')) return;
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z' || e.key === 'ئ')) {
          e.preventDefault();
          motionEditorUndo();
        } else if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && (e.key === 'z' || e.key === 'Z' || e.key === 'ئ')) || e.key === 'y' || e.key === 'Y' || e.key === 'إ')) {
          e.preventDefault();
          motionEditorRedo();
        }
      });

      const marker = document.createElement('span');
      marker.id = 'motion-editor-shell-ready';
      marker.hidden = true;
      document.body.appendChild(marker);
    }
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

  async function migrateLegacyGeminiKey(user) {
    const legacyKey = localStorage.getItem('mickey_gemini_key') || '';
    if (!legacyKey || !user) return;
    const response = await gatewayFetch('save_gemini_key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geminiKey: legacyKey, action: 'save_gemini_key' })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || 'تعذر نقل مفتاح Gemini إلى Firestore.');
    localStorage.removeItem('mickey_gemini_key');
    showToast('تم نقل مفتاح Gemini القديم إلى Firestore وحذفه من هذا المتصفح.', 'success');
  }

  function updateGuestBadge() {
    const badge = document.getElementById('guest-usage-badge');
    const text = document.getElementById('guest-remaining-text');
    const topText = document.getElementById('top-quota-text');
    const dashMeterGen = document.getElementById('dashboard-meter-generations');
    const dashMeterBar = document.getElementById('dashboard-meter-bar');
    const freeNoticeBtnText = document.getElementById('free-banner-btn-text');
    const freeNoticeBtn = document.getElementById('free-banner-auth-btn');
    const freeNoticeIcon = freeNoticeBtn && freeNoticeBtn.querySelector('i');

    if (STATE.user || (window.firebase && firebase.apps && firebase.apps.length && firebase.auth().currentUser)) {
      if (badge) badge.classList.add('hidden');
      if (topText) topText.textContent = 'غير محدود';
      if (dashMeterGen) dashMeterGen.textContent = 'غير محدود';
      if (dashMeterBar) dashMeterBar.style.width = '100%';
      if (freeNoticeBtnText) freeNoticeBtnText.textContent = 'حسابك مفعل ✓';
      if (freeNoticeBtn) freeNoticeBtn.classList.add('account-activated');
      if (freeNoticeIcon) freeNoticeIcon.className = 'fa-solid fa-circle-check text-xs';
      return;
    }
    // Keep 5-attempt badge hidden from top UI as requested
    if (badge) badge.classList.add('hidden');
    const used = Number(localStorage.getItem('mickey_guest_generations') || 0);
    const remaining = Math.max(0, 5 - used);
    if (text) text.textContent = `${remaining} من 5`;
    if (topText) topText.textContent = `${remaining} تجريبية`;
    if (dashMeterGen) dashMeterGen.textContent = `${remaining} تجريبية`;
    if (dashMeterBar) dashMeterBar.style.width = `${(remaining / 5) * 100}%`;
    if (freeNoticeBtnText) freeNoticeBtnText.textContent = 'إنشاء حساب مجاني الآن';
    if (freeNoticeBtn) freeNoticeBtn.classList.remove('account-activated');
    if (freeNoticeIcon) freeNoticeIcon.className = 'fa-solid fa-user-plus text-xs';
  }

  async function authorizeAndConsume(tool, count = 1) {
    const signedInUser = STATE.user || (window.firebase && firebase.apps && firebase.apps.length ? firebase.auth().currentUser : null);
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
      showToast('لقد استنفذت الـ 5 محاولات المجانية للزائر. يجب إنشاء حساب مجاني على الموقع لاستخدام المنصة بشكل غير محدود وبدون أي قيود!', 'warning', 8000);
      openAccountModal(true);
      return false;
    }

    try {
      await accountRequest('consume_generation', { tool, count: Math.max(1, Math.min(20, Number(count) || 1)) });
      const newUsed = currentUsed + (Number(count) || 1);
      localStorage.setItem('mickey_guest_generations', newUsed);
      updateGuestBadge();
      if (newUsed >= 5) {
        showToast('تنبيه: لقد استنفذت آخر محاولة مجانية كزائر (5 من 5). ستحتاج لإنشاء حساب مجاني للمحاولة القادمة.', 'warning', 8000);
      } else {
        const remaining = Math.max(0, 5 - newUsed);
        showToast(`استخدام كزائر: تبقّى ${remaining} من 5 محاولات مجانية. أنشئ حسابًا لاستخدام غير محدود!`, 'info');
      }
      return true;
    } catch (error) {
      if (error.message && error.message.includes('الخمس')) {
        localStorage.setItem('mickey_guest_generations', 5);
        updateGuestBadge();
        showToast('لقد استنفذت الـ 5 محاولات المجانية للزائر. يجب إنشاء حساب مجاني على الموقع لاستخدام المنصة بشكل غير محدود وبدون أي قيود!', 'warning', 8000);
        openAccountModal(true);
        return false;
      }
      const newUsed = currentUsed + (Number(count) || 1);
      localStorage.setItem('mickey_guest_generations', newUsed);
      updateGuestBadge();
      if (newUsed >= 5) {
        showToast('تنبيه: لقد استنفذت آخر محاولة مجانية كزائر (5 من 5). ستحتاج لإنشاء حساب مجاني للمحاولة القادمة.', 'warning', 8000);
      } else {
        const remaining = Math.max(0, 5 - newUsed);
        showToast(`استخدام كزائر: تبقّى ${remaining} من 5 محاولات مجانية. أنشئ حسابًا لاستخدام غير محدود!`, 'info');
      }
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

  function openAccountModal(isLimitReached = false) {
    const modal = document.getElementById('modal-account');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
    const alertEl = document.getElementById('guest-limit-alert');
    const guestExceeded = Number(localStorage.getItem('mickey_guest_generations') || 0) >= 5;
    if (alertEl) {
      if (!STATE.user && (isLimitReached || guestExceeded)) {
        alertEl.classList.remove('hidden');
      } else {
        alertEl.classList.add('hidden');
      }
    }
    renderAccountModal();
    if (!STATE.user) {
      setTimeout(() => {
        document.getElementById('account-email')?.focus();
      }, 100);
    }
  }

  function closeAccountModal() {
    const modal = document.getElementById('modal-account');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  // pendingPairCode declared above
  let pendingPair2Code = '';
  let pendingPairCompletionCode = '';

  async function completePendingExtensionPair(user) {
    const code = pendingPair2Code || pendingPairCode;
    if (!code || !user || pendingPairCompletionCode === code) return;
    pendingPairCompletionCode = code;
    try {
      if (pendingPair2Code) {
        try {
          await accountRequest('pair2_complete', { code: pendingPair2Code, deviceName: 'Mickey Studio · Premiere Pro' });
          pendingPair2Code = '';
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('pair2');
          cleanUrl.searchParams.delete('extension_pair2');
          history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.hash);
          showToast('تم ربط الإضافة بنجاح! ارجع إلى Premiere Pro.', 'success');
          refreshConnectedDevices();
          return;
        } catch (error) {
          console.error('[ExtensionPairingV2] Could not complete secure pairing v2:', error);
          showToast('تعذر إكمال الربط التلقائي: ' + (error.message || 'انتهت صلاحية الرمز'), 'error', 9000);
          return;
        }
      }

      if (!pendingPairCode) return;
      await accountRequest('pair_complete', { code: pendingPairCode, deviceName: 'Mickey Studio · Premiere Pro' });

      pendingPairCode = '';
      const cleanUrl = new URL(window.location.href); cleanUrl.searchParams.delete('extension_pair');
      history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.hash);
      showToast('تم ربط الإضافة بحساب Mickey Studio بنجاح! ارجع إلى Premiere Pro.', 'success');
      refreshConnectedDevices();
    } catch (error) {
      console.error('[ExtensionPairing] Could not complete secure pairing:', error);
      showToast('تعذر إكمال الربط التلقائي: ' + (error.message || 'تحقق من تسجيل الدخول وأن الرمز لم تنته صلاحيته.'), 'error', 9000);
    }
  }

  async function copyPremierePairToken() {
    const user = firebase.auth().currentUser;
    if (!user) {
      showToast('سجّل الدخول أولاً في الموقع لنسخ كود الربط.', 'warning');
      return;
    }
    try {
      const start = await accountRequest('pair2_start');
      await accountRequest('pair2_complete', { code: start.code, deviceName: 'Mickey Studio · Premiere Pro' });
      const tokenStr = `MKP2_${start.code}`;
      try { await navigator.clipboard.writeText(tokenStr); }
      catch (_) { prompt('انسخ كود الربط التالي والصقه في إضافة بريمير:', tokenStr); }
      showToast('✓ تم نسخ كود ربط آمن (v2) لمرة واحدة وصالح لدقيقتين. الصقه في إضافة Premiere Pro.', 'success', 6000);
      refreshConnectedDevices();
    } catch (error) {
      try {
        const begin = await accountRequest('pair_begin');
        await accountRequest('pair_complete', { code: begin.code, deviceName: 'Mickey Studio · Premiere Pro' });
        const tokenStr = `MKP_${begin.code}`;
        try { await navigator.clipboard.writeText(tokenStr); }
        catch (_) { prompt('انسخ كود الربط التالي والصقه في إضافة بريمير:', tokenStr); }
        showToast('✓ تم نسخ كود ربط لمرة واحدة وصالح لدقيقتين. الصقه في إضافة Premiere Pro.', 'success', 6000);
        refreshConnectedDevices();
      } catch (err2) {
        showToast(error.message || err2.message || 'تعذر إنشاء كود الربط اليدوي.', 'error');
      }
    }
  }

  async function refreshConnectedDevices() {
    const list = document.getElementById('connected-devices-list');
    if (!list || !firebase.auth().currentUser) return;
    list.innerHTML = '<p class="text-xs text-zinc-500">جاري تحميل الأجهزة…</p>';
    try {
      const result = await accountRequest('device_list');
      if (!result.devices?.length) {
        list.innerHTML = '<p class="text-xs text-zinc-500">لا توجد أجهزة مرتبطة.</p>';
        return;
      }
      list.innerHTML = '';
      for (const device of result.devices) {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2';
        const info = document.createElement('div');
        info.className = 'min-w-0';
        const name = document.createElement('div'); name.className = 'text-xs text-zinc-200 truncate'; name.textContent = device.name || 'جهاز Premiere Pro';
        const date = document.createElement('div'); date.className = 'text-[10px] text-zinc-500'; date.textContent = `تاريخ الربط: ${new Date(device.createdAt).toLocaleString()}`;
        info.append(name, date);
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'shrink-0 text-[10px] text-red-300 hover:text-red-200'; button.textContent = 'إلغاء الربط';
        button.addEventListener('click', async () => {
          if (!confirm('سيُلغى وصول هذا الجهاز فورًا. هل تريد المتابعة؟')) return;
          try { await accountRequest('device_revoke', { deviceId: device.deviceId }); await refreshConnectedDevices(); showToast('تم إلغاء ربط الجهاز.', 'success'); }
          catch (error) { showToast(error.message || 'تعذر إلغاء ربط الجهاز.', 'error'); }
        });
        row.append(info, button); list.append(row);
      }
    } catch (error) {
      list.innerHTML = '<p class="text-xs text-red-300">تعذر تحميل الأجهزة المرتبطة.</p>';
      console.warn('[ConnectedDevices]', error);
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
    const modalDashBtn = document.getElementById('account-modal-dashboard-btn');
    if (modalDashBtn) {
      const allowed = isDashboardAllowed();
      modalDashBtn.classList.toggle('hidden', !allowed);
      modalDashBtn.classList.toggle('flex', allowed);
    }
  }

  async function createEmailAccount() {
    SFX.playClick();
    const emailEl = document.getElementById('account-email');
    const passEl = document.getElementById('account-password');
    const btn = document.getElementById('btn-account-signup') || (window.event && window.event.currentTarget);
    const email = emailEl ? emailEl.value.trim() : '';
    const password = passEl ? passEl.value : '';

    if (!email) {
      showToast('يرجى كتابة البريد الإلكتروني لإنشاء الحساب.', 'warning');
      emailEl?.focus();
      return;
    }
    if (!password || password.length < 8) {
      showToast('كلمة المرور يجب أن لا تقل عن 8 أحرف أو أرقام.', 'warning');
      passEl?.focus();
      return;
    }

    if (!window.firebase) {
      showToast('جاري الاتصال بخدمة فايربيز... يرجى الانتظار ثانية ثم إعادة المحاولة.', 'warning');
      initFirebaseAuth();
      return;
    }
    if (!firebase.apps.length) {
      initFirebaseAuth();
    }

    const originalBtnText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin ml-1.5"></i> جاري الإنشاء...';
    }

    try {
      const credential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      STATE.user = credential.user;
      try { await credential.user.sendEmailVerification(); } catch (_) {}
      closeAccountModal();
      showToast('تم إنشاء الحساب بنجاح! الخطة المجانية غير المحدودة مفعلة.', 'success');
      updateAuthUI(STATE.user);
    } catch (error) {
      console.error('[SignUp Error]', error);
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') {
        msg = 'هذا البريد مسجل بالفعل! اضغط على زر "تسجيل الدخول" للدخول به.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'كلمة المرور ضعيفة. استخدم 8 خانات على الأقل تحتوي أحرفاً وأرقاماً.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'صيغة البريد الإلكتروني غير صحيحة.';
      } else if (error.code === 'auth/network-request-failed') {
        msg = 'فشل الاتصال بالشبكة. تحقق من اتصالك بالإنترنت.';
      }
      showToast(msg || 'تعذر إنشاء الحساب.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
      }
    }
  }

  async function signInWithEmail() {
    SFX.playClick();
    const emailEl = document.getElementById('account-email');
    const passEl = document.getElementById('account-password');
    const btn = document.getElementById('btn-account-signin') || (window.event && window.event.currentTarget);
    const email = emailEl ? emailEl.value.trim() : '';
    const password = passEl ? passEl.value : '';

    if (!email) {
      showToast('يرجى إدخال البريد الإلكتروني.', 'warning');
      emailEl?.focus();
      return;
    }
    if (!password) {
      showToast('يرجى إدخال كلمة المرور.', 'warning');
      passEl?.focus();
      return;
    }

    if (!window.firebase) {
      showToast('جاري الاتصال بخدمة فايربيز... يرجى الانتظار ثانية ثم إعادة المحاولة.', 'warning');
      initFirebaseAuth();
      return;
    }
    if (!firebase.apps.length) {
      initFirebaseAuth();
    }

    const originalBtnText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin ml-1.5"></i> جاري الدخول...';
    }

    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      STATE.user = userCredential.user;
      closeAccountModal();
      showToast('تم تسجيل الدخول بنجاح! مرحباً بك.', 'success');
      updateAuthUI(STATE.user);
    } catch (error) {
      console.error('[Auth Error]', error);
      let msg = error.message;
      if (error.code === 'auth/user-not-found') {
        msg = 'هذا البريد غير مسجل. يمكنك إنشاء حساب جديد بالضغط على زر "إنشاء حساب".';
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد وكلمة المرور.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'صيغة البريد الإلكتروني غير صحيحة.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'تم تعليق المحاولات مؤقتًا لكثرة المحاولات الخاطئة. انتظر دقيقة ثم حاول ثانية.';
      } else if (error.code === 'auth/network-request-failed') {
        msg = 'فشل الاتصال بالشبكة. تحقق من اتصالك بالإنترنت.';
      }
      showToast(msg || 'تعذر تسجيل الدخول. تحقق من بياناتك.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
      }
    }
  }

  async function signInWithGoogle() {
    SFX.playClick();
    if (!window.firebase) {
      showToast('جاري الاتصال بخدمة فايربيز... يرجى الانتظار ثانية ثم إعادة المحاولة.', 'warning');
      initFirebaseAuth();
      return;
    }
    if (!firebase.apps.length) {
      initFirebaseAuth();
    }
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await firebase.auth().signInWithPopup(provider);
      STATE.user = credential.user;
      closeAccountModal();
      showToast('تم تسجيل الدخول بحساب Google. الخطة المجانية غير المحدودة مفعلة.', 'success');
      updateAuthUI(STATE.user);
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') return;
      showToast(error.message || 'تعذر تسجيل الدخول عبر Google.', 'error');
    }
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
    if (window.firebase && firebase.apps?.length) {
      try { await firebase.auth().signOut(); } catch (_) {}
    }
    STATE.user = null;
    STATE.userProfile = null;
    renderAccountModal();
    updateAuthUI(null);
    updateGuestBadge();
    showToast('تم تسجيل الخروج بنجاح.', 'info');
    if (STATE.activeTab === 'dashboard') {
      switchTab('landing');
    }
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
    const searchParams = new URLSearchParams(window.location.search);
    pendingPair2Code = searchParams.get('pair2') || searchParams.get('extension_pair2') || '';
    pendingPairCode = searchParams.get('extension_pair') || '';
    if (!window.firebase) {
      if (!window._firebaseRetryTimer) {
        let attempts = 0;
        window._firebaseRetryTimer = setInterval(() => {
          attempts++;
          if (window.firebase) {
            clearInterval(window._firebaseRetryTimer);
            window._firebaseRetryTimer = null;
            initFirebaseAuth();
          } else if (attempts > 30) {
            clearInterval(window._firebaseRetryTimer);
            window._firebaseRetryTimer = null;
          }
        }, 200);
      }
      return;
    }
    const config = getActiveFirebaseConfig();
    try {
      if (!firebase.apps.length) firebase.initializeApp(config);
      if (!firebaseAuthObserverAttached) {
        firebase.auth().onAuthStateChanged(async (user) => {
          if (user) {
            try {
              STATE.user = user;
              await ensureActiveProfile(user);
              try { await migrateLegacyGeminiKey(user); }
              catch (migrationError) { showToast(migrationError.message || 'تعذر نقل مفتاح Gemini إلى Firestore.', 'warning'); }
              updateAuthUI(user);
              renderAccountModal();
              await completePendingExtensionPair(user);
              fetchUserQuotas();
            } catch (error) {
              STATE.user = null; STATE.userProfile = null;
              updateAuthUI(null);
              fetchUserQuotas();
              showToast(error.message || 'تعذر التحقق من حالة الحساب.', 'error');
            }
          } else {
            STATE.user = null; STATE.userProfile = null; updateAuthUI(null); renderAccountModal();
            fetchUserQuotas();
          }
        });
        firebaseAuthObserverAttached = true;
      }
      if ((pendingPairCode || pendingPair2Code) && window.firebase && !firebase.auth().currentUser) {
        setTimeout(() => { openAccountModal(); showToast('سجّل الدخول لإكمال ربط إضافة Premiere.', 'info'); }, 0);
      }
    } catch (e) {
      console.warn('Firebase init error:', e);
    }
  }

  function handleAuthClick() {
    SFX.playClick();
    if (window.firebase && !firebase.apps.length) {
      try { initFirebaseAuth(); } catch (e) { console.warn(e); }
    } else if (!window.firebase) {
      initFirebaseAuth();
    }
    openAccountModal();
  }

  function updateAuthUI(user) {
    const isAllowed = isDashboardAllowed(user);
    const topDashBtn = document.getElementById('btn-top-dashboard');
    if (topDashBtn) {
      if (isAllowed) {
        topDashBtn.classList.remove('hidden');
        topDashBtn.classList.add('inline-flex');
      } else {
        topDashBtn.classList.add('hidden');
        topDashBtn.classList.remove('inline-flex');
      }
    }

    const btn = document.getElementById('btn-google-login');
    if (btn) {
      btn.className = user ? 'btn-sci-fi-secondary px-3 py-1.5 text-xs rounded-xl flex items-center gap-2 border-emerald-500/40 text-emerald-300' : 'w-full btn-secondary text-xs py-2 justify-center';
      btn.innerHTML = user
        ? `<img src="${user.photoURL || ''}" class="w-5 h-5 rounded-full" onerror="this.style.display='none'"><span class="font-semibold">${user.displayName || user.email || user.phoneNumber || 'حسابي'}</span>`
        : '<i class="fa-solid fa-user text-xs text-zinc-400"></i><span>تسجيل الدخول أو إنشاء حساب</span>';
      btn.title = user ? `الحساب: ${user.email || user.phoneNumber || user.displayName}` : 'تسجيل الدخول أو إنشاء حساب';
    }

    const topAuthBtn = document.getElementById('btn-top-auth');
    if (topAuthBtn) {
      if (user) {
        topAuthBtn.className = 'btn-secondary text-xs py-1.5 px-3 rounded-xl flex items-center gap-2 border-emerald-500/30 text-emerald-300';
        topAuthBtn.innerHTML = `
          ${user.photoURL ? `<img src="${user.photoURL}" class="w-5 h-5 rounded-full object-cover">` : '<i class="fa-solid fa-user-check text-xs"></i>'}
          <span class="font-semibold text-xs">${user.displayName || user.email?.split('@')[0] || 'حسابي'}</span>
        `;
      } else {
        topAuthBtn.className = 'btn-primary text-xs py-2 px-4 gap-2';
        topAuthBtn.innerHTML = `
          <i class="fa-solid fa-user text-xs"></i>
          <span id="top-auth-btn-text">تسجيل الدخول / حساب مجاني</span>
        `;
      }
    }

    updateGuestBadge();
    updateDashboardMeters();
  }

  // -----------------------------------------------------------------
  // 15. INITIALIZATION
  // -----------------------------------------------------------------
  let appInitialized = false;
  async function init() {
    if (appInitialized) return;
    appInitialized = true;
    await initIndexedDB();
    ['mickey_groq_key','mickey_hf_token','mickey_firebase_config'].forEach(key => localStorage.removeItem(key));
    initFirebaseAuth();
    initMotionBuilder();
    initBeforeAfterSlider();
    updateGuestBadge();
    fetchUserQuotas();
    loadAndRenderToolsGrid();

    // Standalone Client-Side Routing
    const initialHash = (window.location.hash || '').replace('#', '');
    if (initialHash === 'dashboard' && !isDashboardAllowed(STATE.user)) {
      switchTab('landing');
    } else if (initialHash && document.getElementById('section-' + initialHash)) {
      switchTab(initialHash);
    } else {
      switchTab('landing');
    }

    window.addEventListener('hashchange', () => {
      const currentHash = (window.location.hash || '').replace('#', '');
      if (currentHash === 'dashboard' && !isDashboardAllowed(STATE.user)) {
        showToast('لوحة التحكم متاحة فقط للإيميل المحدد المسجل في فاير بيز.', 'warning');
        switchTab('landing');
      } else if (currentHash && document.getElementById('section-' + currentHash)) {
        switchTab(currentHash);
      } else {
        switchTab('landing');
      }
    });
    
    if (window.MickeyStudio?.onVoiceEngineChanged) window.MickeyStudio.onVoiceEngineChanged();
    if (window.MickeyStudio?.onVoiceGenderChanged) window.MickeyStudio.onVoiceGenderChanged();
    if (window.MickeyStudio?.renderVoiceGallery) window.MickeyStudio.renderVoiceGallery('all');

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

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  // Public API
  return {
    STATE,
    SFX,
    showToast,
    CryptoVault,
    authorizeAndConsume,
    recordUsage,
    gatewayFetch,
    base64ToBlob,
    downloadBlob,
    findGradioFile,
    craftMasterPhotorealisticPrompt,
    getAllAssetsFromDB,
    saveAssetToDB,
    deleteAssetFromDB,
    clearAllAssetsFromDB,
    huggingFaceErrorMessage,
    switchTab,
    navigateTo: switchTab,
    renderDashboardProjects,
    filterDashboardProjects,
    deleteDashboardProject,
    updateDashboardMeters,
    toggleMobileMenu,
    initBeforeAfterSlider,
    motionGeneratePrompt,
    motionSendToPremiere,
    motionSendEditableSceneToPremiere,
    motionCopyRepairPrompt,
    motionOpenEditor,
    motionOpenInEditor: motionOpenEditor,
    motionBackToLanding,
    motionPasteFromClipboard,
    motionAutoGenerate,
    motionApplyExample,
    motionTogglePlayback,
    motionExportVideo,
    motionBackToPrompt,
    motionEditorUndo,
    motionEditorRedo,
    motionQuickTweak,
    motionShowMoreMenu,
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
    refreshConnectedDevices,
    copyPremierePairToken,
    enhancePrompt,
    showUsedPromptModal,
    openLightbox,
    closeLightbox,
    updateQuotaBadge,
    fetchUserQuotas,
    isDashboardAllowed,
    isAdminUser,
    loadAndRenderToolsGrid,
    renderToolsGrid: loadAndRenderToolsGrid
  };

})();
