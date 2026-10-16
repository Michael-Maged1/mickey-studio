'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const MOTION_SCENE_SEEN_KEY = 'mickey_motion_scene_seen_job_v1';
  const MOTION_SCENE_DISMISSED_KEY = 'mickey_motion_scene_dismissed_job_v1';
  function readMotionSceneStorage(key) { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } }
  function writeMotionSceneStorage(key, value) { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch (error) { console.warn('[MickeyStudio] Could not save motion scene state:', error?.message || error); } }
  const state = { kind: 'image', busy: false, effects: [], currentAsset: null, brollClips: [], brollSuggestions: [], chapterClips: [], chapterSuggestions: [], promptTemplates: [], toastTimer: 0, voiceoverBytes: null, voiceoverUrl: '', voiceoverNativePath: '', voiceoverFileName: '', motionPendingScene: null, motionPollTimer: 0, motionPollInProgress: false, motionPollError: '', motionExecuting: false, motionSeenJobId: readMotionSceneStorage(MOTION_SCENE_SEEN_KEY), motionDismissedJobId: readMotionSceneStorage(MOTION_SCENE_DISMISSED_KEY) };
  const FAV_KEY = 'mickey_effect_favorites_v2';
  const IMAGE_STYLE_PROMPTS = {
    'hyper-real': 'award-winning RAW candid photography, natural lighting, shot on Sony Alpha A7R V, 50mm f1.4 GM lens, shallow depth of field, authentic natural textures, lifelike reflections, sharp focus, 8k resolution',
    portrait: 'masterpiece 85mm portrait photography, shot on Hasselblad, f1.4 aperture, creamy bokeh, studio catchlights in eyes, natural skin tones, fine hair strands, high-fashion magazine aesthetic',
    cinematic: 'cinematic 35mm film still, shot on Arri Alexa 65, anamorphic lens, Kodak Portra 400 color science, moody atmosphere, natural volumetric shadows, dramatic dynamic range',
    product: 'high-end commercial product photography, professional 3-point softbox studio lighting, 100mm macro lens, clean reflections, crystal clear textures, luxury advertising catalog shot',
    landscape: 'award-winning landscape photography, shot on Phase One 150MP, golden hour sunlight, deep atmospheric perspective, detailed natural terrain, crystal-clear water and sky, RAW photograph'
  };

  function toast(message, type = '') {
    const el = $('toast'); el.textContent = message; el.className = `toast show ${type}`;
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => { el.className = 'toast'; }, 3400);
  }
  function getFavorites() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (_) { return []; } }
  function setFavorites(list) { localStorage.setItem(FAV_KEY, JSON.stringify(list)); renderFavorites(); }
  function safeText(value) { return String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function base64ToBytes(value) {
    if (typeof Buffer !== 'undefined') {
      const buf = Buffer.from(value, 'base64');
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    const binary = atob(value);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function bindNavigation() {
    document.querySelectorAll('.mode-tab').forEach(button => button.addEventListener('click', () => {
      state.kind = button.dataset.kind;
      document.querySelectorAll('.mode-tab').forEach(tab => tab.classList.toggle('active', tab === button));
    }));
  }

  // Keep sidebar navigation independent from the rest of panel initialization.
  // Premiere UXP can delay or interrupt init while querying host APIs, so the
  // page switches should be wired as soon as this script is evaluated.
  document.addEventListener('click', event => {
    const button = event.target.closest?.('.nav-item');
    if (!button) return;
    const pageId = `page-${button.dataset.page}`;
    const targetPage = document.getElementById(pageId);
    if (!targetPage) {
      console.warn(`[MickeyStudio] Sidebar page not found: ${pageId}`);
      return;
    }
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item === button));
    document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page === targetPage));
  });

  function bindUxPButtons() {
    document.addEventListener('keydown', event => {
      if ((event.key === 'r' && (event.ctrlKey || event.metaKey)) || event.key === 'F5') {
        window.location.reload();
        return;
      }
      const control = event.target.closest?.('[role="button"]');
      if (!control || control.getAttribute('aria-disabled') === 'true') return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        control.click();
      }
    });

    // Capture-phase delegation ensures clicks on voiceover-generate, reload, and settings are never dropped
    document.addEventListener('click', event => {
      const vg = event.target?.closest?.('#voiceover-generate');
      if (vg) {
        event.preventDefault();
        createVoiceover();
        return;
      }
      const rl = event.target?.closest?.('#btn-reload-extension');
      if (rl) {
        event.preventDefault();
        rl.classList.add('spinning');
        setTimeout(() => {
          window.location.reload(true);
        }, 120);
        return;
      }
      const so = event.target?.closest?.('#settings-open, #btn-quick-connect');
      if (so) {
        event.preventDefault();
        openSettings();
        return;
      }
      const sc = event.target?.closest?.('#settings-close');
      if (sc) {
        event.preventDefault();
        document.body.classList.remove('modal-open');
        if (typeof window.hideAccountDialog === 'function') {
          window.hideAccountDialog();
        } else if (typeof MickeyStudioAPI !== 'undefined' && typeof MickeyStudioAPI.hideAccountDialog === 'function') {
          MickeyStudioAPI.hideAccountDialog();
        } else {
          $('settings-dialog')?.classList.add('hidden');
        }
        return;
      }
    }, true);
  }

  function openSettings() {
    document.body.classList.add('modal-open');
    if (typeof window.showAccountDialog === 'function') {
      window.showAccountDialog();
    } else if (typeof MickeyStudioAPI !== 'undefined' && typeof MickeyStudioAPI.showAccountDialog === 'function') {
      MickeyStudioAPI.showAccountDialog();
    } else {
      const dialog = $('settings-dialog');
      if (dialog) {
        dialog.classList.remove('hidden');
      }
    }
  }

  async function assertAccountActive() {
    const devKey = StudioStorage.getDeveloperApiKey ? StudioStorage.getDeveloperApiKey() : '';
    if (devKey) {
      return { status: 'active', devKey: true };
    }
    const email = StudioStorage.getAccountEmail();
    const refreshToken = await StudioStorage.getAccountRefreshToken();
    if (!email || !refreshToken) {
      console.warn('[MickeyStudio] Proceeding in online direct/guest mode.');
      return { status: 'active', guest: true };
    }
    try {
      const access = await MickeyStudioAPI.ensureAccountAccess();
      if (access && access.status === 'suspended') {
        const err = '⚠️ تم إيقاف هذا الحساب من قبل إدارة المنصة.';
        toast(err, 'error');
        throw new Error(err);
      }
      return access;
    } catch (err) {
      if (err.message && err.message.includes('موقوف')) throw err;
      console.warn('[MickeyStudio] Account check warning, proceeding online:', err);
      return { status: 'active', guest: true };
    }
  }

  async function generateImage(prompt, ratio, style) {
    const stylePrompt = IMAGE_STYLE_PROMPTS[style] || IMAGE_STYLE_PROMPTS['hyper-real'];
    let finalPrompt = prompt;
    if ($('auto-enhance-image')?.checked !== false) {
      $('progress-detail').textContent = 'نحسّن الوصف ونترجمه تلقائيًا…';
      try { finalPrompt = await MickeyStudioAPI.enhancePrompt(prompt); }
      catch (error) { console.warn('[MickeyStudio] Prompt enhancement failed; using original prompt:', error); }
    }
    if (stylePrompt && !finalPrompt.toLowerCase().includes(stylePrompt.slice(0, 28).toLowerCase())) finalPrompt = `${finalPrompt}, ${stylePrompt}`;
    $('progress-detail').textContent = 'نرسل الوصف إلى محرك الصور المحدد…';
    const image = await MickeyStudioAPI.generateImage(finalPrompt, ratio, $('image-model')?.value || 'flux');
    return PremiereMedia.saveAndInsertImage(image.base64Data, image.mimeType || 'image/png', prompt, { insertToTimeline: false });
  }

  async function generate() {
    await assertAccountActive();
    const prompt = $('prompt').value.trim();
    if (!prompt) { toast('اكتب وصف المشهد أولًا.', 'error'); $('prompt').focus(); return; }
    if (state.busy) return;
    state.busy = true; $('generate').classList.add('busy'); $('generate').setAttribute('aria-disabled', 'true'); $('progress').classList.remove('hidden'); $('result').classList.add('hidden');
    try {
      let result;
      if (state.kind === 'image') {
        $('progress-title').textContent = 'جاري إنشاء الصورة'; $('progress-detail').textContent = 'نجهّز محرك الصور والوصف…';
        result = await generateImage(prompt, $('ratio').value, $('style').value);
        result.type = 'ai-image';
        state.currentAsset = result;
      }
      $('result-name').textContent = result.fileName || result.name;
      $('result-detail').textContent = 'تم الحفظ والاستيراد إلى المشروع. اضغط «إضافة للتايملاين» لإدراجها عند المؤشر.';
      $('insert-again').textContent = 'إضافة للتايملاين';
      $('result').classList.remove('hidden'); toast('تم إنشاء الصورة وحفظها في المشروع. يمكنك إضافتها للتايملاين بالزر الظاهر.', 'success');
      renderLibrary();
    } catch (error) { console.error('[MickeyStudio]', error); toast(error.message || 'تعذر إتمام العملية.', 'error'); }
    finally { state.busy = false; $('generate').classList.remove('busy'); $('generate').removeAttribute('aria-disabled'); $('progress').classList.add('hidden'); }
  }

  async function enhancePrompt() {
    const input = $('prompt');
    const text = input ? input.value.trim() : '';
    if (!text) {
      toast('اكتب فكرة سريعة أو كلمات مفتاحية في الصندوق أولاً لتحسينها.', 'info');
      input?.focus();
      return;
    }
    const button = $('enhance-prompt');
    if (button) {
      button.setAttribute('aria-disabled', 'true');
      button.classList.add('busy');
    }
    try {
      toast('🪄 جاري تحليل فكرتك وتحويلها لبرومبت سينمائي 8K...', 'info');
      const enhanced = await MickeyStudioAPI.enhancePrompt(text);
      if (enhanced && enhanced !== text) {
        if (input) input.value = enhanced;
        toast('✨ تم تحسين وصياغة البرومبت بنجاح!', 'success');
      } else {
        toast('تمت معالجة البرومبت، يمكنك إضافة المزيد من التفاصيل.', 'info');
      }
    } catch (err) {
      console.warn('[MickeyStudio] Enhance prompt error:', err);
      toast(`تعذر تحسين البرومبت: ${err.message || err}`, 'error');
    } finally {
      if (button) {
        button.removeAttribute('aria-disabled');
        button.classList.remove('busy');
      }
    }
  }

  function renderPromptTemplates() {
    const select = $('prompt-templates');
    if (!select) return;
    const templates = state.promptTemplates || [];
    select.innerHTML = '<option value="">قوالب الأوصاف المحفوظة</option>' +
      templates.map((tpl, i) => `<option value="${i}">${safeText(tpl.name || `قالب ${i + 1}`)}</option>`).join('');
  }

  function savePromptTemplate() {
    const nameInput = $('prompt-template-name');
    const name = nameInput ? nameInput.value.trim() : '';
    const promptInput = $('prompt');
    const prompt = promptInput ? promptInput.value.trim() : '';
    if (!prompt) {
      toast('اكتب وصفًا أولاً لحفظه كقالب.', 'error');
      return;
    }
    const templateName = name || `قالب ${state.promptTemplates.length + 1}`;
    state.promptTemplates.push({ name: templateName, prompt });
    StudioStorage.setPromptTemplates(state.promptTemplates);
    renderPromptTemplates();
    if (nameInput) nameInput.value = '';
    $('prompt-save-form')?.classList.add('hidden');
    toast(`تم حفظ القالب: ${templateName}`, 'success');
  }

  async function insertAsset(asset) {
    try {
      const project = await PremiereAPI.getActiveProject();
      if (!project) throw new Error('افتح مشروع Premiere أولًا.');
      const fileName = asset.fileName || asset.name;
      const nativePath = asset.destPath || asset.nativePath;
      // Resolve a new UXP ProjectItem proxy when the user clicks Insert. The
      // proxy returned during generation may have expired by then.
      let item = await PremiereAPI.findProjectItemWithRetry(project, fileName, nativePath, 6, 200);
      if (!item) {
        await PremiereAPI.importFileToProject(nativePath);
        const refreshedProject = await PremiereAPI.getActiveProject();
        item = await PremiereAPI.findProjectItemWithRetry(refreshedProject, fileName, nativePath, 10, 350);
      }
      if (!item) throw new Error('لم أجد الملف في لوحة المشروع بعد استيراده.');
      await PremiereAPI.insertProjectItemToTimeline(item); toast('تم إدراج الملف عند موضع المؤشر.', 'success');
      return true;
    } catch (error) { toast(error.message, 'error'); return false; }
  }

  function updateImageModelHint() {
    const hints = {
      flux: 'FLUX.1 Photorealistic · مجاني وسريع، بنفس محرك الموقع الافتراضي.',
      'cloudflare-flux': 'FLUX.2 klein 4B · يطبّق الأبعاد المختارة عبر Cloudflare Workers AI.',
      'nano-banana': 'Nano Banana 2.1 · جودة Gemini 2K؛ قد يتطلب حصة Gemini متاحة.'
    };
    const hint = $('image-model-hint');
    if (hint) hint.textContent = hints[$('image-model')?.value] || hints.flux;
  }

  function showMotionSceneDialog(queued) {
    const overlay = $('motion-scene-overlay');
    if (!overlay || !queued?.scene) return;
    const card = overlay.querySelector('.motion-scene-card');
    const title = $('motion-scene-title');
    if (!card || !title) return;
    let actions = $('motion-scene-actions-runtime');
    if (!actions) {
      actions = document.createElement('div');
      actions.id = 'motion-scene-actions-runtime';
      actions.setAttribute('style', 'display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:9px!important;width:100%!important;height:auto!important;min-height:0!important;overflow:visible!important;visibility:visible!important;opacity:1!important;margin:12px 0!important;');
      title.insertAdjacentElement('afterend', actions);
    }
    let createButton = $('motion-scene-create');
    if (!createButton) {
      createButton = document.createElement('button');
      createButton.id = 'motion-scene-create';
      createButton.type = 'button';
    }
    const dismissButton = $('motion-scene-dismiss');
    actions.appendChild(createButton);
    if (dismissButton) actions.appendChild(dismissButton);
    card.querySelectorAll('.motion-scene-actions:not(#motion-scene-actions-runtime)').forEach(node => node.remove());
    createButton.classList.remove('hidden');
    createButton.hidden = false;
    createButton.disabled = false;
    createButton.textContent = 'إنشاء المشهد على التايملاين';
    createButton.onclick = executePendingMotionScene;
    const buttonStyles = {
      display: 'flex', visibility: 'visible', opacity: '1', position: 'relative', zIndex: '20',
      boxSizing: 'border-box', width: '100%', minHeight: '54px', height: 'auto', maxHeight: 'none',
      margin: '0', padding: '14px 18px', overflow: 'visible', transform: 'none',
      alignItems: 'center', justifyContent: 'center', background: '#ff8a32',
      border: '1px solid #ff9b52', borderRadius: '13px', color: '#17110d',
      fontFamily: 'inherit', fontSize: '14px', fontWeight: '800', lineHeight: '1.5', cursor: 'pointer'
    };
    Object.keys(buttonStyles).forEach(property => createButton.style.setProperty(property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), buttonStyles[property], 'important'));
    if (dismissButton) {
      dismissButton.classList.remove('hidden');
      dismissButton.hidden = false;
      dismissButton.textContent = 'إغلاق';
      dismissButton.onclick = dismissMotionSceneDialog;
      dismissButton.style.setProperty('display', 'block', 'important');
      dismissButton.style.setProperty('visibility', 'visible', 'important');
      dismissButton.style.setProperty('width', '100%', 'important');
    }
    const elements = Array.isArray(queued.scene.elements) ? queued.scene.elements : [];
    const soundEffects = elements.filter(item => item?.type === 'sfx').length;
    const audioCount = soundEffects + (queued.scene.music ? 1 : 0);
    const longestEnd = elements.reduce((end, item) => Math.max(end, (Number(item?.startTime) || 0) + (Number(item?.duration) || 0)), 0);
    const duration = Math.max(Number(queued.scene.music?.duration) || 0, longestEnd);
    $('motion-scene-element-count').textContent = String(elements.filter(item => ['graphic', 'mogrt', 'color_matte'].includes(item?.type)).length);
    $('motion-scene-duration').textContent = duration ? `${Number(duration.toFixed(1))} ث` : '—';
    $('motion-scene-audio').textContent = audioCount ? `${audioCount} مسار` : 'بدون صوت';
    $('motion-scene-error').textContent = '';
    $('motion-scene-error').classList.add('hidden');
    $('motion-scene-progress')?.classList.add('hidden');
    if ($('motion-scene-create')) $('motion-scene-create').disabled = false;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    createButton.focus();
  }

  function hideMotionSceneDialog() {
    const overlay = $('motion-scene-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }

  async function pollMotionScene(options = {}) {
    if (state.motionPollInProgress || state.motionExecuting) return state.motionPendingScene;
    state.motionPollInProgress = true;
    try {
      const email = StudioStorage.getAccountEmail?.();
      const refreshToken = await StudioStorage.getAccountRefreshToken?.();
      if (!email || !refreshToken) {
        const message = 'اربط الإضافة بحساب Mickey Studio نفسه المفتوح في الموقع لاستلام المشاهد.';
        if (options.showEmpty || state.motionPollError !== message) toast(message, 'warning');
        state.motionPollError = message;
        return null;
      }
      const queued = await MickeyStudioAPI.request('motion_scene_poll');
      state.motionPollError = '';
      if (queued?.status === 'pending' && queued.scene && queued.jobId) {
        const isNewJob = state.motionSeenJobId !== queued.jobId;
        if (isNewJob) {
          state.motionSeenJobId = queued.jobId;
          state.motionDismissedJobId = '';
          writeMotionSceneStorage(MOTION_SCENE_SEEN_KEY, queued.jobId);
          writeMotionSceneStorage(MOTION_SCENE_DISMISSED_KEY, '');
        }
        state.motionPendingScene = queued;
        const dismissedForThisJob = state.motionDismissedJobId === queued.jobId;
        if (!dismissedForThisJob && (isNewJob || options.forceOpen || $('motion-scene-overlay')?.classList.contains('hidden'))) showMotionSceneDialog(queued);
        return queued;
      }
      state.motionPendingScene = null;
      hideMotionSceneDialog();
      return null;
    } catch (error) {
      const message = error?.message || 'تعذر التحقق من المشاهد المرسلة.';
      console.warn('[MickeyStudio] Motion scene check failed:', message);
      if (options.showEmpty || state.motionPollError !== message) toast(`تعذر استقبال المشهد: ${message}`, 'error');
      state.motionPollError = message;
      return null;
    } finally {
      state.motionPollInProgress = false;
    }
  }

  function startMotionSceneWatcher() {
    if (state.motionPollTimer) return;
    window.setTimeout(() => pollMotionScene(), 900);
    state.motionPollTimer = window.setInterval(() => pollMotionScene(), 4500);
    window.addEventListener('focus', () => pollMotionScene());
  }

  function dismissMotionSceneDialog() {
    if (state.motionPendingScene?.jobId) {
      state.motionSeenJobId = state.motionPendingScene.jobId;
      state.motionDismissedJobId = state.motionPendingScene.jobId;
      writeMotionSceneStorage(MOTION_SCENE_SEEN_KEY, state.motionSeenJobId);
      writeMotionSceneStorage(MOTION_SCENE_DISMISSED_KEY, state.motionDismissedJobId);
    }
    hideMotionSceneDialog();
  }

  async function executePendingMotionScene() {
    if (state.motionExecuting) return;
    let queued = state.motionPendingScene;
    if (!queued) queued = await pollMotionScene({ forceOpen: true, showEmpty: true });
    if (!queued?.scene || !queued.jobId) return;
    const button = $('motion-scene-create');
    const errorBox = $('motion-scene-error');
    state.motionExecuting = true;
    if (button) { button.disabled = true; button.textContent = 'جارٍ إنشاء المشهد…'; }
    if (errorBox) { errorBox.textContent = ''; errorBox.classList.add('hidden'); }
    hideMotionSceneDialog();
    $('motion-scene-progress')?.classList.remove('hidden');
    if ($('motion-scene-progress')) $('motion-scene-progress').textContent = 'جارٍ تجهيز طبقات المشهد وإضافتها إلى التايملاين…';
    if ($('motion-handoff-status')) $('motion-handoff-status').textContent = 'جارٍ إنشاء المشهد على التايملاين…';
    toast('بدأ إنشاء المشهد على التايملاين. ستظهر رسالة عند اكتماله.', 'info');
    try {
      const result = await PremiereAPI.executeMotionScene(queued.scene, queued.audioAssetEndpoint || '', message => {
        if ($('motion-handoff-status')) $('motion-handoff-status').textContent = message;
        if ($('motion-scene-progress')) $('motion-scene-progress').textContent = message || 'جارٍ إنشاء المشهد على التايملاين…';
      });
      await MickeyStudioAPI.request('motion_scene_ack', { jobId: queued.jobId });
      state.motionPendingScene = null;
      state.motionDismissedJobId = '';
      state.motionSeenJobId = '';
      writeMotionSceneStorage(MOTION_SCENE_SEEN_KEY, '');
      writeMotionSceneStorage(MOTION_SCENE_DISMISSED_KEY, '');
      hideMotionSceneDialog();
      $('motion-scene-progress')?.classList.add('hidden');
      if ($('motion-handoff-status')) $('motion-handoff-status').textContent = `تم إنشاء المشهد وإضافة ${result.inserted} عنصر إلى التايملاين.`;
      const details = result.errors?.length ? ` لم تُنفذ بعض العناصر: ${result.errors.join(' | ')}` : '';
      toast(`تم إنشاء المشهد وإضافة ${result.inserted} عنصر إلى التايملاين.${details}`, result.errors?.length ? 'warning' : 'success');
    } catch (error) {
      console.error('[MickeyStudio] Motion scene execution failed:', error);
      showMotionSceneDialog(queued);
      if (errorBox) { errorBox.textContent = error.message || 'تعذر إنشاء المشهد. صحح الخطأ وحاول مرة أخرى.'; errorBox.classList.remove('hidden'); }
      if ($('motion-handoff-status')) $('motion-handoff-status').textContent = error.message || 'تعذر إنشاء المشهد.';
      if (button) button.textContent = 'إعادة المحاولة';
      $('motion-scene-progress')?.classList.add('hidden');
    } finally {
      state.motionExecuting = false;
      if (button) button.disabled = false;
    }
  }

  async function analyzeChapters() {
    await assertAccountActive();
    toast('تحليل الفصول الذكي غير متاح حاليًا عبر بوابة Mickey Studio.', 'error');
  }

  async function analyzeBroll() {
    await assertAccountActive();
    toast('تحليل B-roll غير متاح حاليًا عبر بوابة Mickey Studio.', 'error');
  }

  async function refineVoiceoverText() {
    const input = $('voiceover-text');
    const text = input.value.trim();
    if (!text) { toast('اكتب النص الذي تريد تحسينه أولاً.', 'error'); input.focus(); return; }
    if (text.length > 6000) { toast('النص طويل جدًا. الحد الأقصى 6000 حرف.', 'error'); return; }
    const button = $('voiceover-refine');
    button.disabled = true; button.classList.add('busy');
    try {
      const dialect = $('voiceover-dialect')?.selectedOptions?.[0]?.textContent?.trim() || 'العربية';
      const data = await MickeyStudioAPI.request('refine_voiceover', { text, dialect });
      const refined = data.refined || data.text || '';
      if (!refined.trim()) throw new Error('لم تُرجع خدمة Mickey Studio نصًا محسنًا.');
      input.value = refined.trim();
      toast('تم تحسين النص للإلقاء. راجعه قبل إنشاء الصوت.', 'success');
    } catch (error) { toast(error.message || 'تعذر تحسين النص.', 'error'); }
    finally { button.disabled = false; button.classList.remove('busy'); }
  }

  function suggestVoiceScript() {
    const scripts = [
      'مرحباً بكم في ميكي ستوديو، الأفق الجديد للذكاء الاصطناعي. هنا حيث تتحول الأفكار إلى واقع سينمائي مبهر بلا حدود.',
      'في عالم يتسارع فيه الابتكار، تصنع الريادة بالقرارات الجريئة. استمتع بأقوى أدوات الإبداع الرقمي بين يديك الآن.',
      'هل تساءلت يوماً كيف تبدو مدن المستقبل؟ استكشف آفاق الخيال العلمي وحوّل رؤيتك الفنية إلى لوحات سينمائية فائقة الدقة.',
      'سواء كنت صانع محتوى، مصمماً، أو فناناً رقمياً، هذه المنصة هي محطتك المتكاملة للإنتاج الاحترافي مجاناً وبلا قيود.'
    ];
    $('voiceover-text').value = scripts[Math.floor(Math.random() * scripts.length)];
    toast('أُضيف نص مقترح. يمكنك تعديله قبل التوليد.', 'success');
  }

  function downloadVoiceover() {
    if (!state.voiceoverUrl) { toast('أنشئ التعليق الصوتي أولاً.', 'error'); return; }
    const link = document.createElement('a');
    link.href = state.voiceoverUrl;
    link.download = state.voiceoverFileName || `Mickey_Voiceover_${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast('جاري تنزيل الملف الصوتي.', 'success');
  }

  // -----------------------------------------------------------------
  // Audio Player & Spectrum Waveform Engine
  // -----------------------------------------------------------------
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
    const playIcon = $('icon-custom-play');
    const timeCurrent = $('audio-time-current');
    const timeTotal = $('audio-time-total');
    const waveformContainer = $('waveform-container');

    if (!audioEl._playerBound) {
      audioEl._playerBound = true;

      audioEl.addEventListener('play', () => {
        const icon = $('icon-custom-play');
        if (icon) icon.textContent = '⏸';
      });

      audioEl.addEventListener('pause', () => {
        const icon = $('icon-custom-play');
        if (icon) icon.textContent = '▶';
      });

      audioEl.addEventListener('ended', () => {
        const icon = $('icon-custom-play');
        if (icon) icon.textContent = '▶';
        const cur = $('audio-time-current');
        if (!audioEl.loop && cur) {
          cur.textContent = formatAudioTime(0);
        }
      });

      audioEl.addEventListener('timeupdate', () => {
        const cur = $('audio-time-current');
        if (cur) cur.textContent = formatAudioTime(audioEl.currentTime);
        const seek = $('audio-seek-slider');
        if (seek && audioEl.duration && isFinite(audioEl.duration) && !seek._dragging) {
          seek.value = Math.round((audioEl.currentTime / audioEl.duration) * 1000);
        }
      });

      audioEl.addEventListener('loadedmetadata', () => {
        const tot = $('audio-time-total');
        if (tot) tot.textContent = formatAudioTime(audioEl.duration);
      });
      audioEl.addEventListener('durationchange', () => {
        const tot = $('audio-time-total');
        if (tot) tot.textContent = formatAudioTime(audioEl.duration);
      });
    }

    if (playIcon) playIcon.textContent = audioEl.paused ? '▶' : '⏸';
    if (audioEl.duration && isFinite(audioEl.duration) && timeTotal) {
      timeTotal.textContent = formatAudioTime(audioEl.duration);
    }

    const seekSlider = $('audio-seek-slider');
    if (seekSlider && !seekSlider._sliderBound) {
      seekSlider._sliderBound = true;
      seekSlider.addEventListener('input', () => {
        seekSlider._dragging = true;
        if (audioEl.duration && isFinite(audioEl.duration)) {
          const newTime = (Number(seekSlider.value) / 1000) * audioEl.duration;
          if (timeCurrent) timeCurrent.textContent = formatAudioTime(newTime);
        }
      });
      seekSlider.addEventListener('change', () => {
        seekSlider._dragging = false;
        if (audioEl.duration && isFinite(audioEl.duration)) {
          audioEl.currentTime = (Number(seekSlider.value) / 1000) * audioEl.duration;
        }
      });
    }

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
    const audioEl = $('final-rendered-audio');
    if (!audioEl) return;
    if (audioEl.paused) {
      if (audioEl.src && typeof audioEl.play === 'function') {
        audioEl.play().catch(e => console.warn('[MickeyStudio] Play error:', e));
      }
    } else {
      if (typeof audioEl.pause === 'function') {
        audioEl.pause();
      }
    }
  }

  const AUDIO_SPEEDS = [1.0, 1.25, 1.5, 1.75, 2.0];
  let currentSpeedIdx = 0;
  function cycleAudioSpeed() {
    const audioEl = $('final-rendered-audio');
    const speedBtn = $('btn-audio-speed');
    currentSpeedIdx = (currentSpeedIdx + 1) % AUDIO_SPEEDS.length;
    const speed = AUDIO_SPEEDS[currentSpeedIdx];
    if (audioEl) audioEl.playbackRate = speed;
    if (speedBtn) speedBtn.textContent = `${speed.toFixed(speed % 1 === 0 ? 1 : 2)}x`;
  }

  let previousAudioVolume = 1.0;
  function setVolume(val) {
    const audioEl = $('final-rendered-audio');
    const volIcon = $('volume-icon');
    const slider = $('audio-volume-slider');
    const v = Math.max(0, Math.min(1, parseFloat(val)));
    if (audioEl) {
      audioEl.volume = v;
      audioEl.muted = (v === 0);
    }
    if (slider) slider.value = v;
    if (volIcon) {
      if (v === 0) volIcon.textContent = '🔇';
      else if (v < 0.5) volIcon.textContent = '🔉';
      else volIcon.textContent = '🔊';
    }
    if (v > 0) previousAudioVolume = v;
  }

  function toggleMute() {
    const audioEl = $('final-rendered-audio');
    if (!audioEl) return;
    if (audioEl.muted || audioEl.volume === 0) {
      const restoreVol = previousAudioVolume > 0 ? previousAudioVolume : 1.0;
      setVolume(restoreVol);
    } else {
      previousAudioVolume = audioEl.volume || 1.0;
      setVolume(0);
    }
  }

  function skipAudio(seconds) {
    const audioEl = $('final-rendered-audio');
    if (!audioEl) return;
    const duration = audioEl.duration || 0;
    const newTime = Math.max(0, Math.min(duration, audioEl.currentTime + seconds));
    audioEl.currentTime = newTime;
    const timeCurrent = $('audio-time-current');
    if (timeCurrent) timeCurrent.textContent = formatAudioTime(newTime);
  }

  function toggleAudioLoop() {
    const audioEl = $('final-rendered-audio');
    const loopBtn = $('btn-audio-loop');
    if (!audioEl) return;
    audioEl.loop = !audioEl.loop;
    if (loopBtn) {
      loopBtn.classList.toggle('active', audioEl.loop);
      loopBtn.style.color = audioEl.loop ? '#5da7eb' : '';
    }
  }

  let spectrumAnimId = null;
  function setupAudioSpectrumVisualizer(audioEl) {
    const canvas = $('audio-spectrum-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (spectrumAnimId) {
      cancelAnimationFrame(spectrumAnimId);
      spectrumAnimId = null;
    }

    const container = canvas.parentElement;
    if (container && container.clientWidth > 0) {
      canvas.width = container.clientWidth;
    }

    const barsCount = 64;
    let wavePhase = 0;

    function drawWaveform(isPlaying) {
      const w = canvas.width || 300;
      const h = canvas.height || 44;
      ctx.clearRect(0, 0, w, h);

      if (isPlaying) wavePhase += 0.08;

      const duration = (audioEl && isFinite(audioEl.duration) && audioEl.duration > 0) ? audioEl.duration : 1;
      const currentTime = audioEl ? (audioEl.currentTime || 0) : 0;
      const progressRatio = Math.max(0, Math.min(1, currentTime / duration));

      const centerY = h / 2;
      const minBarHeight = 3;
      const maxBarHeight = h * 0.78;
      const barWidth = 2.4;
      const step = (w - barWidth) / (barsCount - 1);

      for (let i = 0; i < barsCount; i++) {
        const u = i / (barsCount - 1);
        const x = i * step;

        const envelope = Math.pow(Math.abs(Math.sin(u * 4 * Math.PI)), 0.95);
        let barHeight = minBarHeight + envelope * (maxBarHeight - minBarHeight);

        if (isPlaying) {
          const breathing = 0.92 + 0.08 * Math.sin(wavePhase + u * 6.28);
          barHeight *= breathing;
        }

        const topY = centerY - (barHeight / 2);

        if (u <= progressRatio) {
          ctx.fillStyle = '#66ddc5';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
        }

        ctx.fillRect(x, topY, barWidth, barHeight);
      }
    }

    let lastAnimTime = 0;
    function animLoop(now) {
      if (!audioEl || audioEl.paused || audioEl.ended) {
        drawWaveform(false);
        spectrumAnimId = null;
        return; // Stop animation loop when audio is not playing to prevent CPU throttling
      }
      if (!now || (now - lastAnimTime) > 40) {
        lastAnimTime = now;
        drawWaveform(true);
      }
      spectrumAnimId = requestAnimationFrame(animLoop);
    }

    if (!audioEl._visualizerBound) {
      audioEl._visualizerBound = true;
      audioEl.addEventListener('play', () => {
        if (!spectrumAnimId) {
          spectrumAnimId = requestAnimationFrame(animLoop);
        }
      });
      audioEl.addEventListener('pause', () => {
        if (spectrumAnimId) {
          cancelAnimationFrame(spectrumAnimId);
          spectrumAnimId = null;
        }
        drawWaveform(false);
      });
      audioEl.addEventListener('ended', () => {
        if (spectrumAnimId) {
          cancelAnimationFrame(spectrumAnimId);
          spectrumAnimId = null;
        }
        drawWaveform(false);
      });
      audioEl.addEventListener('timeupdate', () => {
        if (audioEl.paused) {
          drawWaveform(false);
        }
      });
    }

    drawWaveform(false);
  }

  async function insertVoiceoverIntoPremiere() {
    if (!state.voiceoverBytes) throw new Error('أنشئ التعليق الصوتي أولاً.');
    const project = await PremiereAPI.getActiveProject();
    if (!project) throw new Error('الصوت جاهز للاستماع والتنزيل. افتح مشروع Premiere محفوظًا لإدراجه.');
    const fs = require('fs');
    if (!state.voiceoverNativePath || !fs.existsSync(state.voiceoverNativePath)) {
      const { mediaFolder } = await GeminiTransfer.resolveProjectMediaFolder();

      // Accurately determine extension based on audio binary signature
      const isWav = state.voiceoverBytes.length > 12 &&
        state.voiceoverBytes[0] === 0x52 && state.voiceoverBytes[1] === 0x49 &&
        state.voiceoverBytes[2] === 0x46 && state.voiceoverBytes[3] === 0x46;
      const ext = isWav ? 'wav' : 'mp3';

      state.voiceoverFileName = `Mickey_Voiceover_${Date.now()}.${ext}`;
      state.voiceoverNativePath = `${mediaFolder}\\${state.voiceoverFileName}`;

      const buffer = typeof Buffer !== 'undefined' ? Buffer.from(state.voiceoverBytes) : state.voiceoverBytes;
      fs.writeFileSync(state.voiceoverNativePath, buffer);

      // Brief wait to ensure OS releases file handle cleanly
      await new Promise(r => setTimeout(r, 60));
    }

    await PremiereAPI.importFileToProject(state.voiceoverNativePath);

    // Brief settle time for Premiere to register the new asset in project items
    await new Promise(r => setTimeout(r, 80));

    const projectItem = await PremiereAPI.findProjectItemWithRetry(project, state.voiceoverFileName, state.voiceoverNativePath, 5, 150);
    if (!projectItem) throw new Error(`تم إنشاء الصوت وحفظه في ${state.voiceoverNativePath}، لكن Premiere لم يعثر عليه في المشروع.`);

    let insertedToTimeline = false;
    const activeSeq = await project.getActiveSequence();
    if (activeSeq) {
      try {
        await PremiereAPI.insertProjectItemToTimeline(projectItem, {
          videoTrackIndex: -1, // -1 is required for audio-only clips to prevent invalid script object dereference
          audioTrackIndex: 0,
          overwrite: true // Overwrite mode places the audio cleanly on the audio track
        });
        insertedToTimeline = true;
      } catch (insertErr) {
        console.warn('[MickeyStudio] Timeline insert error:', insertErr);
        toast(`تم إدراج الصوت في نافذة المشروع (Project Panel) ولكن تعذر وضعه على التايملاين تلقائياً: ${insertErr.message || insertErr}`, 'warning');
      }
    }
    const alreadyListed = StudioStorage.getRecentFiles().some(item => item.nativePath === state.voiceoverNativePath);
    if (!alreadyListed) StudioStorage.addRecentFile({ name: state.voiceoverFileName, nativePath: state.voiceoverNativePath, type: 'ai-audio' });
    renderLibrary();
    return insertedToTimeline;
  }

  async function createVoiceover() {
    console.log('[MickeyStudio] createVoiceover triggered');
    const textInput = $('voiceover-text');
    const text = (textInput?.value || '').trim();
    if (!text) {
      toast('اكتب نص التعليق الصوتي أولاً.', 'error');
      textInput?.focus();
      return;
    }
    if (text.length > 6000) {
      toast('النص طويل جدًا. الحد الأقصى 6000 حرف.', 'error');
      return;
    }
    if (state.busy) {
      toast('جاري تنفيذ عملية أخرى حالياً، يرجى الانتظار...', 'info');
      return;
    }

    const button = $('voiceover-generate');
    if (button?.getAttribute('aria-disabled') === 'true') return;
    state.busy = true;
    button?.setAttribute('aria-disabled', 'true');
    button?.classList.add('busy');

    const statusBadge = $('voice-process-status');
    const scanner = $('voice-laser-scanner');
    const emptyState = $('voice-empty-state');
    const activeControls = $('voice-active-controls');
    const audioEl = $('final-rendered-audio');

    if (spectrumAnimId) {
      cancelAnimationFrame(spectrumAnimId);
      spectrumAnimId = null;
    }

    if (statusBadge) {
      statusBadge.textContent = 'جاري هندسة النبرات الصوتية...';
      statusBadge.classList.add('active');
    }
    if (scanner) scanner.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (activeControls) activeControls.classList.add('hidden');

    try {
      await assertAccountActive();
      const chosenEngine = $('voiceover-engine')?.value || (typeof StudioStorage?.getVoiceoverEngine === 'function' ? StudioStorage.getVoiceoverEngine() : (typeof StudioStorage?.get === 'function' ? StudioStorage.get('mickey_voiceover_engine') : '')) || 'gemini';

      const options = {
        dialect: $('voiceover-dialect')?.value || 'egyptian',
        gender: $('voiceover-gender')?.value || 'male',
        age: $('voiceover-age')?.value || 'adult',
        performance: $('voiceover-performance')?.value || 'neutral',
        warmth: $('voiceover-warmth')?.value || 'balanced',
        emotion: $('voiceover-emotion')?.value || 'medium',
        intensity: $('voiceover-intensity')?.value || 'medium',
        rate: Number($('voiceover-rate')?.value || 1.0),
        pitch: Number($('voiceover-pitch')?.value || 1.0),
        engine: chosenEngine,
      };

      const audio = await MickeyStudioAPI.generateVoiceover(text, options);
      if (!audio || !audio.base64Data) {
        throw new Error('لم يتم استلام بيانات الصوت من المحرك.');
      }

      const bytes = base64ToBytes(audio.base64Data);
      state.voiceoverBytes = bytes;
      state.voiceoverNativePath = '';
      const isWav = audio.isWav || (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46);
      state.voiceoverFileName = `Mickey_Voiceover_${Date.now()}.${isWav ? 'wav' : 'mp3'}`;
      if (state.voiceoverUrl) URL.revokeObjectURL(state.voiceoverUrl);
      state.voiceoverUrl = URL.createObjectURL(new Blob([bytes], { type: isWav ? 'audio/wav' : 'audio/mpeg' }));

      if (audioEl) {
        try {
          audioEl.src = state.voiceoverUrl;
          if (typeof audioEl.load === 'function') audioEl.load();
        } catch (e) {
          console.warn('[MickeyStudio] audioEl setup:', e);
        }
      }

      if (scanner) scanner.classList.add('hidden');
      if (activeControls) activeControls.classList.remove('hidden');

      const engineUsed = audio.engineUsed || (isWav ? 'gemini' : 'neural');
      const isGemini = engineUsed === 'gemini';
      const engineName = isGemini ? 'Gemini 3.8 Flash TTS' : 'Edge Neural TTS';

      if (statusBadge) {
        const dText = $('voiceover-dialect')?.selectedOptions?.[0]?.textContent || '';
        const gText = $('voiceover-gender')?.value === 'female' ? 'نسائي' : 'رجالي';
        statusBadge.textContent = `اكتمل · ${engineName} · ${dText} (${gText})`;
      }

      if (audioEl) {
        try {
          setupCustomAudioPlayer(audioEl);
          setupAudioSpectrumVisualizer(audioEl);
        } catch (e) {
          console.warn('[MickeyStudio] Audio player init:', e);
        }
      }

      if (audio.note && audio.note.includes('تحويل')) {
        toast(`تم توليد التعليق بنجاح عبر ${engineName} (تم التبديل تلقائياً لاستمرار العمل)`, 'info');
      } else {
        toast(`تم توليد التعليق الصوتي بنجاح عبر ${engineName}! استمع إليه أو اضغط "إدراج في Premiere".`, 'success');
      }
    } catch (error) {
      console.error('[MickeyStudio] Voiceover generation error:', error);
      if (statusBadge) {
        statusBadge.textContent = 'فشل التوليد';
        statusBadge.classList.remove('active');
      }
      const errText = error.message || 'تعذر إنشاء التعليق الصوتي.';
      toast(errText, 'error');
    } finally {
      state.busy = false;
      if (scanner) scanner.classList.add('hidden');
      button?.classList.remove('busy');
      button?.removeAttribute('aria-disabled');
    }
  }

  function renderLibrary() {
    const list = StudioStorage.getRecentFiles().filter(item => item.nativePath && !String(item.nativePath).startsWith('blob:'));
    const root = $('library-list');
    if (!list.length) { root.innerHTML = '<div class="empty-state">ستظهر ملفاتك هنا بعد إنشائها.</div>'; return; }
    root.innerHTML = list.map((item, i) => `<div class="library-row"><span>${item.type === 'ai-video' ? '▣' : '▧'} &nbsp;${safeText(item.name)}</span><div role="button" tabindex="0" data-insert="${i}">إدراج</div></div>`).join('');
    root.querySelectorAll('[data-insert]').forEach(button => button.addEventListener('click', () => insertAsset(list[Number(button.dataset.insert)])));
  }

  function renderEffects(query = '') {
    const list = state.effects.filter(effect => effect.name.toLowerCase().includes(query.toLowerCase())).slice(0, 100);
    const root = $('effect-results');
    if (!list.length) { root.innerHTML = `<div class="empty-state">${state.effects.length ? 'لا توجد نتائج مطابقة.' : 'تعذر تحميل قائمة المؤثرات.'}</div>`; return; }
    root.innerHTML = list.map((effect, index) => `<div class="effect-row"><span>${safeText(effect.name)}</span><div role="button" tabindex="0" data-effect="${index}">إضافة للمفضلة</div></div>`).join('');
    root.querySelectorAll('[data-effect]').forEach(button => button.addEventListener('click', () => {
      const effect = list[Number(button.dataset.effect)]; const favorites = getFavorites();
      if (!favorites.some(item => item.matchName === effect.matchName)) favorites.push(effect);
      setFavorites(favorites); toast(`أُضيف ${effect.name} إلى المفضلة.`, 'success');
    }));
  }
  function renderFavorites() {
    const list = getFavorites(); const root = $('favorites'); $('favorite-count').textContent = String(list.length);
    if (!list.length) { root.innerHTML = '<div class="empty-state">أضف مؤثراتك المفضلة من البحث لتظهر هنا كبطاقات سريعة.</div>'; return; }
    root.innerHTML = list.map((effect, index) => `<div class="favorite-card" role="button" tabindex="0" data-apply="${index}" aria-label="تطبيق ${safeText(effect.name)}"><div class="favorite-card-top"><span class="favorite-card-mark">FX</span><div class="favorite-card-remove" role="button" tabindex="0" data-remove="${index}" aria-label="حذف من المفضلة" title="حذف">×</div></div><span class="favorite-card-title">${safeText(effect.name)}</span><span class="favorite-card-hint">اضغط للتطبيق</span></div>`).join('');
    root.querySelectorAll('.favorite-card[data-apply]').forEach(card => card.addEventListener('click', async () => {
      if (card.getAttribute('aria-disabled') === 'true') return;
      card.setAttribute('aria-disabled', 'true');
      try { const count = await PremiereAPI.applyVideoEffectToSelection(list[Number(card.dataset.apply)].matchName); toast(`تمت إضافة المؤثر إلى ${count} مقطع.`, 'success'); }
      catch (error) { toast(error.message || 'تعذر تطبيق المؤثر.', 'error'); }
      finally { card.removeAttribute('aria-disabled'); }
    }));
    root.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); setFavorites(getFavorites().filter((_, index) => index !== Number(button.dataset.remove))); }));
  }

  // =================================================================
  // AUDIO BUFFER INSERTER FOR PREMIERE PRO TIMELINE
  // =================================================================
  async function insertAudioBufferIntoPremiere(audioBytes, prefix = 'Mickey_Audio') {
    if (!audioBytes || !audioBytes.length) throw new Error('لا توجد بيانات صوتية صالحة للإدراج.');
    const project = await PremiereAPI.getActiveProject();
    if (!project) throw new Error('الصوت جاهز. افتح مشروع Premiere للإدراج المباشر في التايملاين.');
    const fs = require('fs');
    const { mediaFolder } = await GeminiTransfer.resolveProjectMediaFolder();

    const isWav = audioBytes.length > 12 &&
      audioBytes[0] === 0x52 && audioBytes[1] === 0x49 &&
      audioBytes[2] === 0x46 && audioBytes[3] === 0x46;
    const ext = isWav ? 'wav' : 'mp3';

    const fileName = `${prefix}_${Date.now()}.${ext}`;
    const nativePath = `${mediaFolder}\\${fileName}`;

    const buffer = typeof Buffer !== 'undefined' ? Buffer.from(audioBytes) : audioBytes;
    fs.writeFileSync(nativePath, buffer);
    await new Promise(r => setTimeout(r, 60));

    await PremiereAPI.importFileToProject(nativePath);
    await new Promise(r => setTimeout(r, 80));

    const projectItem = await PremiereAPI.findProjectItemWithRetry(project, fileName, nativePath, 5, 150);
    if (!projectItem) throw new Error(`تم حفظ الملف في ${nativePath} لكن تعذر العثور عليه في المشروع.`);

    let insertedToTimeline = false;
    const activeSeq = await project.getActiveSequence();
    if (activeSeq) {
      try {
        await PremiereAPI.insertProjectItemToTimeline(projectItem, {
          videoTrackIndex: -1,
          audioTrackIndex: 0,
          overwrite: true
        });
        insertedToTimeline = true;
      } catch (insertErr) {
        console.warn('[MickeyStudio] Timeline insert error:', insertErr);
      }
    }
    StudioStorage.addRecentFile({ name: fileName, nativePath, type: 'ai-audio' });
    renderLibrary();
    return { fileName, nativePath, insertedToTimeline };
  }

  function concatWavBuffers(buffers) {
    if (buffers.length === 1) return new Blob([buffers[0]], { type: 'audio/wav' });
    const firstView = new DataView(buffers[0]);
    const isWav = buffers[0].byteLength >= 44 && 
                  String.fromCharCode(firstView.getUint8(0), firstView.getUint8(1), firstView.getUint8(2), firstView.getUint8(3)) === 'RIFF';

    if (!isWav) return new Blob(buffers, { type: 'audio/mpeg' });

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

  // =================================================================
  // SAVIO STUDIO PERSONAS IN PREMIERE EXTENSION
  // =================================================================
  const EXT_PERSONAS = {
    male: [
      { id: 'yusuf', name: 'يوسف', role: 'وثائقي قوي', fullName: 'يوسف · وثائقي قوي', short: 'يوسف · وثائقي' },
      { id: 'malik', name: 'مالك', role: 'إعلاني سريع', fullName: 'مالك · إعلاني سريع', short: 'مالك · إعلان' },
      { id: 'rami', name: 'رامي', role: 'بودكاست هادئ', fullName: 'رامي · بودكاست هادئ', short: 'رامي · بودكاست' },
      { id: 'saif', name: 'سيف', role: 'درامي عاطفي', fullName: 'سيف · درامي عاطفي', short: 'سيف · درامي' },
      { id: 'zaid', name: 'زيد', role: 'راوٍ قصصي', fullName: 'زيد · راوٍ قصصي', short: 'زيد · قصصي' },
      { id: 'neutral', name: 'متوازن', role: 'متوازن وطبيعي', fullName: 'متوازن · طبيعي وواضح', short: 'متوازن' }
    ],
    female: [
      { id: 'mariam', name: 'مريم', role: 'صوت قصصي', fullName: 'مريم · صوت قصصي', short: 'مريم · قصصي' },
      { id: 'laila', name: 'ليلى', role: 'إعلان وتسويق', fullName: 'ليلى · إعلان وتسويق', short: 'ليلى · إعلان' },
      { id: 'sama', name: 'سما', role: 'بودكاست واجتماعي', fullName: 'سما · بودكاست واجتماعي', short: 'سما · بودكاست' },
      { id: 'salma', name: 'سلمى', role: 'درامي عاطفي', fullName: 'سلمى · درامي عاطفي', short: 'سلمى · درامي' },
      { id: 'farida', name: 'فريدة', role: 'وثائقي رصين', fullName: 'فريدة · وثائقي رصين', short: 'فريدة · وثائقي' },
      { id: 'neutral', name: 'متوازنة', role: 'متوازنة وطبيعية', fullName: 'متوازنة · طبيعي وواضح', short: 'متوازنة' }
    ]
  };

  function updateVoiceoverPersonas() {
    const gender = $('voiceover-gender')?.value || 'male';
    const list = EXT_PERSONAS[gender] || EXT_PERSONAS.male;
    const perfSelect = $('voiceover-performance');
    if (perfSelect) {
      const current = perfSelect.value;
      perfSelect.innerHTML = list.map(p => 
        `<option value="${p.id}" ${p.id === current ? 'selected' : ''}>${p.fullName}</option>`
      ).join('');
      if (!list.some(p => p.id === current)) {
        perfSelect.value = list[0].id;
      }
    }
    const ind = $('voiceover-gender-indicator');
    if (ind) {
      ind.textContent = gender === 'female' ? 'أصوات نسائية (Savio)' : 'أصوات رجالية (Savio)';
      ind.style.color = gender === 'female' ? '#f472b6' : '#66ddc5';
    }
    renderVoiceoverChips(gender);
  }

  function renderVoiceoverChips(gender) {
    const chipsEl = $('voiceover-character-chips');
    if (!chipsEl) return;
    const list = EXT_PERSONAS[gender] || EXT_PERSONAS.male;
    const currentPerf = $('voiceover-performance')?.value;
    const isFemale = gender === 'female';
    const activeColor = isFemale ? '#f472b6' : '#66ddc5';

    chipsEl.innerHTML = list.map(p => {
      const isActive = p.id === currentPerf;
      return `
        <div role="button" tabindex="0" data-extperf="${p.id}" class="secondary-button" 
             style="padding:3px 7px; font-size:9px; border-radius:6px; cursor:pointer; margin:0; ${isActive ? `background:${activeColor}; color:#101214; border-color:${activeColor}; font-weight:bold;` : ''}">
          ${p.short}
        </div>
      `;
    }).join('');

    chipsEl.querySelectorAll('[data-extperf]').forEach(btn => {
      btn.addEventListener('click', () => {
        if ($('voiceover-performance')) {
          $('voiceover-performance').value = btn.dataset.extperf;
          renderVoiceoverChips(gender);
        }
      });
    });
  }

  // =================================================================
  // PODCAST STUDIO FOR PREMIERE EXTENSION
  // =================================================================
  let extPodcastBytes = null;
  let extPodcastUrl = null;

  async function generatePodcastScriptExt() {
    const topic = ($('podcast-ext-topic')?.value || '').trim() || 'الذكاء الاصطناعي في المونتاج';
    const btn = $('btn-podcast-ext-genscript');
    if (btn) btn.disabled = true;
    toast('جاري تأليف حوار بودكاست بالذكاء الاصطناعي...', 'info');

    try {
      const prompt = `اكتب سيناريو حلقة بودكاست حوارية عربية قصيرة بين المحاور والضيف حول موضوع: "${topic}".
كل سطر يبدأ بـ "المحاور: " أو "الضيف: ". الحوار من 4 إلى 6 أسطر طبيعية.`;
      const res = await MickeyStudioAPI.enhancePrompt(prompt);
      if (res && res.text) {
        $('podcast-ext-dialog').value = res.text.trim();
        toast('تم تأليف سيناريو البودكاست!', 'success');
        return;
      }
      throw new Error();
    } catch (_) {
      $('podcast-ext-dialog').value = 
`المحاور: مرحباً بكم في بودكاست اليوم، وحديثنا عن ${topic}.
الضيف: أهلاً بك، سعيد بتواجدي معكم لمناقشة هذا التطور المذهل.
المحاور: كيف ترى تأثير أدوات الذكاء الاصطناعي في اختصار وقت المونتاج؟
الضيف: إنها نقلة نوعية تتيح للمونتير التركيز على الإبداع والسرد البصري.
المحاور: رائع جداً، شكراً لك ونلتقي في الحلقة القادمة.`;
      toast('تم إدراج نموذج حوار بودكاست جاهز!', 'success');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function generatePodcastAudioExt() {
    const dialog = ($('podcast-ext-dialog')?.value || '').trim();
    if (!dialog) { toast('اكتب سيناريو الحوار أولاً.', 'error'); return; }

    const s1Voice = $('podcast-ext-s1-voice')?.value || 'rami';
    const s2Voice = $('podcast-ext-s2-voice')?.value || 'mariam';
    const engine = $('podcast-ext-engine')?.value || 'gemini';
    const dialect = $('podcast-ext-dialect')?.value || 'egyptian';

    const btn = $('podcast-ext-generate');
    const label = $('podcast-ext-generate-label');
    if (btn) btn.classList.add('busy');
    if (label) label.textContent = 'جاري إنتاج أصوات المتحاورين...';
    toast('جاري إنتاج حلقة البودكاست الثنائية ودمجها...', 'info');

    try {
      const lines = dialog.split('\n').map(l => l.trim()).filter(Boolean);
      const audioBuffers = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let speakerVoice = s1Voice;
        let speakerGender = ['mariam', 'laila', 'sama', 'salma', 'farida'].includes(s1Voice) ? 'female' : 'male';
        let cleanText = line;

        if (line.startsWith('الضيف')) {
          speakerVoice = s2Voice;
          speakerGender = ['mariam', 'laila', 'sama', 'salma', 'farida'].includes(s2Voice) ? 'female' : 'male';
          cleanText = line.replace(/^الضيف\s*[:：]\s*/i, '');
        } else if (line.startsWith('المحاور')) {
          cleanText = line.replace(/^المحاور\s*[:：]\s*/i, '');
        }

        if (!cleanText.trim()) continue;

        const res = await MickeyStudioAPI.generateVoiceover(cleanText, {
          performance: speakerVoice,
          gender: speakerGender,
          dialect,
          engine,
        });

        if (res && res.base64Data) {
          audioBuffers.push(base64ToBytes(res.base64Data).buffer);
        }
      }

      if (!audioBuffers.length) throw new Error('لم يتم استخراج أي أسطر صوتية صالحة.');

      const unifiedBlob = concatWavBuffers(audioBuffers);
      const arrayBuffer = await unifiedBlob.arrayBuffer();
      extPodcastBytes = new Uint8Array(arrayBuffer);
      if (extPodcastUrl) URL.revokeObjectURL(extPodcastUrl);
      extPodcastUrl = URL.createObjectURL(unifiedBlob);

      const resultCard = $('podcast-ext-result');
      const audioEl = $('podcast-ext-audio');
      if (resultCard) resultCard.classList.remove('hidden');
      if (audioEl) {
        audioEl.src = extPodcastUrl;
        audioEl.play().catch(() => {});
      }

      const insResult = await insertAudioBufferIntoPremiere(extPodcastBytes, 'Mickey_Podcast');
      toast(insResult.insertedToTimeline ? 'تم إنتاج البودكاست وإدراجه في التايملاين بنجاح!' : 'تم إنتاج البودكاست وحفظه في المشروع.', 'success');
    } catch (err) {
      console.error('[Podcast Ext]', err);
      toast(err.message || 'تعذر إنتاج حلقة البودكاست.', 'error');
    } finally {
      if (btn) btn.classList.remove('busy');
      if (label) label.textContent = 'إنتاج البودكاست وإدراجه في التايملاين';
    }
  }

  // =================================================================
  // AUDIOBOOK STUDIO FOR PREMIERE EXTENSION
  // =================================================================
  let extAudiobookBytes = null;
  let extAudiobookUrl = null;

  async function generateAudiobookChapterExt() {
    const text = ($('audiobook-ext-text')?.value || '').trim();
    if (!text) { toast('اكتب نص الفصل أولاً.', 'error'); return; }

    const book = ($('audiobook-ext-book')?.value || 'كتاب').trim();
    const chapter = ($('audiobook-ext-chapter')?.value || 'الفصل الأول').trim();
    const narrator = $('audiobook-ext-narrator')?.value || 'mariam';
    const gender = ['mariam', 'farida', 'salma'].includes(narrator) ? 'female' : 'male';
    const mood = $('audiobook-ext-mood')?.value || 'mystery';
    const pace = Number($('audiobook-ext-pace')?.value || 1.0);

    const btn = $('audiobook-ext-generate');
    const label = $('audiobook-ext-generate-label');
    if (btn) btn.classList.add('busy');
    if (label) label.textContent = 'جاري تسجيل الفصل الصوتي...';
    toast('جاري تسجيل الفصل وإدراجه في التايملاين...', 'info');

    try {
      const res = await MickeyStudioAPI.generateVoiceover(text, {
        performance: narrator,
        gender,
        dialect: 'fusha',
        rate: pace,
        engine: 'gemini',
        style: `Audiobook chapter reading for "${book} - ${chapter}". Atmospheric mood: ${mood}. Professional literary storytelling narration with proper dramatic pauses.`
      });

      if (!res || !res.base64Data) throw new Error('فشل تسجيل الفصل الصوتي.');

      const bytes = base64ToBytes(res.base64Data);
      extAudiobookBytes = bytes;
      if (extAudiobookUrl) URL.revokeObjectURL(extAudiobookUrl);
      extAudiobookUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));

      const resultCard = $('audiobook-ext-result');
      const audioEl = $('audiobook-ext-audio');
      if (resultCard) resultCard.classList.remove('hidden');
      if (audioEl) {
        audioEl.src = extAudiobookUrl;
        audioEl.play().catch(() => {});
      }

      const insResult = await insertAudioBufferIntoPremiere(extAudiobookBytes, `Audiobook_${chapter.replace(/\s+/g, '_')}`);
      toast(insResult.insertedToTimeline ? `تم تسجيل "${chapter}" وإدراجه في التايملاين!` : 'تم تسجيل الفصل وحفظه في المشروع.', 'success');
    } catch (e) {
      console.error('[Audiobook Ext]', e);
      toast(e.message || 'تعذر إنتاج الفصل الصوتي.', 'error');
    } finally {
      if (btn) btn.classList.remove('busy');
      if (label) label.textContent = 'تسجيل الفصل وإدراجه في التايملاين';
    }
  }

  // =================================================================
  // TRANSCRIPT STUDIO FOR PREMIERE EXTENSION
  // =================================================================
  let extTranscriptSRT = '';

  function reflowSrt(srt, maxChars = 42, maxWords = 6) {
    const parseTime = value => {
      const match = value.match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/);
      return match ? ((Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000 + Number(match[4])) : null;
    };
    const formatTime = ms => {
      const safe = Math.max(0, Math.round(ms));
      const hours = Math.floor(safe / 3600000), minutes = Math.floor((safe % 3600000) / 60000), seconds = Math.floor((safe % 60000) / 1000), millis = safe % 1000;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
    };
    const limitChars = Math.max(12, Math.min(80, Number(maxChars) || 42));
    const limitWords = Math.max(1, Math.min(12, Number(maxWords) || 6));
    const entries = String(srt || '').trim().split(/\r?\n\s*\r?\n/).filter(Boolean);
    const output = [];
    for (const entry of entries) {
      const lines = entry.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const timingIndex = lines.findIndex(line => line.includes('-->'));
      if (timingIndex < 0 || !lines[timingIndex + 1]) continue;
      const timing = lines[timingIndex].match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
      if (!timing) continue;
      const start = parseTime(timing[1]), end = parseTime(timing[2]);
      if (start === null || end === null || end <= start) continue;
      const words = lines.slice(timingIndex + 1).join(' ').split(/\s+/).filter(Boolean);
      const groups = [];
      let group = [];
      for (const word of words) {
        const candidate = [...group, word].join(' ');
        if (group.length && (group.length >= limitWords || candidate.length > limitChars)) { groups.push(group); group = [word]; }
        else group.push(word);
      }
      if (group.length) groups.push(group);
      const weights = groups.map(part => Math.max(1, part.join(' ').length));
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      let offset = 0;
      groups.forEach((part, index) => {
        const cueStart = start + (end - start) * offset / totalWeight;
        offset += weights[index];
        const cueEnd = index === groups.length - 1 ? end : start + (end - start) * offset / totalWeight;
        output.push(`${output.length + 1}\n${formatTime(cueStart)} --> ${formatTime(cueEnd)}\n${part.join(' ')}`);
      });
    }
    return output.join('\n\n');
  }

  function analyzeSilence(audioBuffer, thresholdDb, minimumSeconds) {
    const windowSize = Math.max(1, Math.floor(audioBuffer.sampleRate * 0.1));
    const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
    const silentWindows = [];
    for (let start = 0; start < audioBuffer.length; start += windowSize) {
      const end = Math.min(audioBuffer.length, start + windowSize);
      let energy = 0, count = 0;
      for (const channel of channels) for (let sample = start; sample < end; sample++) { energy += channel[sample] * channel[sample]; count++; }
      const rms = Math.sqrt(energy / Math.max(1, count));
      silentWindows.push(20 * Math.log10(Math.max(rms, 1e-7)) <= thresholdDb);
    }
    const ranges = [];
    let runStart = -1;
    silentWindows.forEach((silent, index) => {
      if (silent && runStart < 0) runStart = index;
      if ((!silent || index === silentWindows.length - 1) && runStart >= 0) {
        const runEnd = silent && index === silentWindows.length - 1 ? index + 1 : index;
        const startSeconds = runStart * windowSize / audioBuffer.sampleRate;
        const endSeconds = Math.min(audioBuffer.duration, runEnd * windowSize / audioBuffer.sampleRate);
        if (endSeconds - startSeconds >= minimumSeconds) ranges.push({ startSeconds, endSeconds });
        runStart = -1;
      }
    });
    return ranges;
  }

  async function extractSelectedClipWav(clip) {
    const sourceIn = Number(clip?.sourceInSeconds);
    const sourceOut = Number(clip?.sourceOutSeconds);
    if (!Number.isFinite(sourceIn) || !Number.isFinite(sourceOut) || sourceIn < 0 || sourceOut <= sourceIn) {
      throw new Error('تعذر قراءة نقطتي In وOut للمقطع المحدد. أعد تحديد المقطع في التايملاين.');
    }
    const rangeSeconds = sourceOut - sourceIn;
    if (rangeSeconds > 360) throw new Error('الجزء المحدد أطول من 6 دقائق. قلّص In/Out ثم أعد المحاولة لتسريع التفريغ.');

    const fs = require('fs');
    let stat = null;
    try {
      if (typeof fs.lstatSync === 'function') stat = fs.lstatSync(clip.mediaPath);
      else if (typeof fs.lstat === 'function') stat = await fs.lstat(clip.mediaPath);
    } catch (_) {}
    if (Number(stat?.size) > 250_000_000) {
      throw new Error('الملف الأصلي كبير جدًا لقراءته داخل الإضافة. استخدم نسخة أخف من الملف ثم أعد المحاولة.');
    }
    const fileBytes = typeof fs.readFileSync === 'function' ? fs.readFileSync(clip.mediaPath) : await fs.readFile(clip.mediaPath);
    const sourceBuffer = fileBytes instanceof Uint8Array
      ? fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength)
      : fileBytes;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('تعذر تشغيل قارئ الصوت داخل Premiere. حدّث Premiere أو استخدم ملفًا صوتيًا مدعومًا مثل WAV أو MP3.');
    const context = new AudioContextClass();
    let decoded;
    try {
      decoded = await context.decodeAudioData(sourceBuffer);
    } catch (error) {
      throw new Error(`تعذر قراءة صيغة الملف داخل الإضافة (${error?.message || error}). جرّب WAV أو MP3. لن يتم فتح Media Encoder.`);
    } finally {
      try { await context.close(); } catch (_) {}
    }

    const sourceRate = decoded.sampleRate;
    const startFrame = Math.max(0, Math.floor(sourceIn * sourceRate));
    const endFrame = Math.min(decoded.length, Math.ceil(sourceOut * sourceRate));
    if (endFrame <= startFrame) throw new Error('الجزء المحدد لا يحتوي على مدة صوتية قابلة للتفريغ.');
    const sampleRate = 16000;
    const frameCount = Math.ceil((endFrame - startFrame) * sampleRate / sourceRate);
    const pcmBytes = frameCount * 2;
    if (pcmBytes + 44 > 13_000_000) throw new Error('الجزء المحدد أطول من الحد المسموح. قلّص In/Out إلى نحو 6 دقائق ثم أعد المحاولة.');
    const wav = new ArrayBuffer(44 + pcmBytes);
    const view = new DataView(wav);
    const writeAscii = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    writeAscii(0, 'RIFF'); view.setUint32(4, 36 + pcmBytes, true); writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeAscii(36, 'data'); view.setUint32(40, pcmBytes, true);
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
    for (let i = 0; i < frameCount; i++) {
      const sourcePosition = startFrame + i * sourceRate / sampleRate;
      const leftIndex = Math.min(endFrame - 1, Math.floor(sourcePosition));
      const rightIndex = Math.min(endFrame - 1, leftIndex + 1);
      const fraction = sourcePosition - leftIndex;
      let sample = 0;
      for (const channel of channels) sample += channel[leftIndex] * (1 - fraction) + channel[rightIndex] * fraction;
      sample /= channels.length || 1;
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(44 + i * 2, clamped < 0 ? clamped * 32768 : clamped * 32767, true);
    }
    return new Uint8Array(wav);
  }

  async function analyzeQuickCut() {
    const button = $('quickcut-analyze');
    const results = $('quickcut-results');
    if (button) button.setAttribute('aria-disabled', 'true');
    if (results) { results.classList.remove('hidden'); results.textContent = 'جاري تحليل صوت المقطع المحدد…'; }
    try {
      const selectedClips = await PremiereAPI.getSelectedClipTranscripts();
      const clip = selectedClips.find(item => item?.mediaPath && Number(item.durationSeconds) > 0);
      if (!clip) throw new Error('حدد مقطعًا صوتيًا أو فيديو مرتبطًا بملف في لوحة المشروع.');
      const wav = await extractSelectedClipWav(clip);
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('تحليل الصوت غير مدعوم في إصدار Premiere الحالي.');
      const context = new AudioContextClass();
      let decoded;
      try { decoded = await context.decodeAudioData(wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength)); }
      finally { try { await context.close(); } catch (_) {} }
      const threshold = Number($('quickcut-threshold')?.value || -38);
      const minimum = Number($('quickcut-min-duration')?.value || 0.5);
      const silences = analyzeSilence(decoded, threshold, minimum);
      if (!silences.length) {
        if (results) results.textContent = 'لم يُعثر على فترات صمت أطول من الإعداد المحدد. جرّب عتبة أكثر حساسية أو مدة أقصر.';
        return;
      }
      const markers = silences.map((range, index) => ({
        startSeconds: Number(clip.startSeconds || 0) + range.startSeconds,
        name: `مراجعة صمت ${index + 1}`,
        comments: `من ${range.startSeconds.toFixed(2)} إلى ${range.endSeconds.toFixed(2)} ثانية من مصدر المقطع. راجع قبل القص.`
      }));
      await PremiereAPI.addSequenceMarkers(markers);
      if (results) results.textContent = `تم العثور على ${silences.length} فترة صمت وإضافة علامات مراجعة إلى الـ Sequence. لم يتم حذف أي صوت أو إغلاق فجوات.`;
      toast(`تم تحديد ${silences.length} فترة صمت بعلامات على التايملاين.`, 'success');
    } catch (error) {
      if (results) results.textContent = error.message || 'تعذر تحليل المقطع المحدد.';
      toast(error.message || 'تعذر تحليل الصمت.', 'error');
    } finally {
      if (button) button.removeAttribute('aria-disabled');
    }
  }

  async function processTranscriptionExt() {
    const fileInput = $('transcript-ext-file');
    const file = fileInput?.files?.[0];
    const btn = $('transcript-ext-process');
    const label = $('transcript-ext-process-label');
    if (btn) btn.classList.add('busy');
    if (label) label.textContent = 'جاري التفريغ وتحليل الكلام عبر المنصة...';
    toast(file ? 'جاري تحليل ملف الصوت وتوليد ملف الترجمة...' : 'جاري قراءة المقطع المحدد في التايملاين...', 'info');

    try {
      const dialect = $('transcript-ext-dialect')?.value || 'auto';
      let textOutput = '';
      let resultData;
      // UXP panels do not always expose the browser File constructor. Avoid
      // evaluating `instanceof File` when that global is unavailable so the
      // selected Premiere timeline clip can be transcribed instead.
      const isBrowserFile = typeof File !== 'undefined' && file instanceof File;
      if (isBrowserFile) {
        const ab = await file.arrayBuffer();
        const bytes = new Uint8Array(ab);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
        resultData = await MickeyStudioAPI.request('transcribe_audio', {
          audio_base64: btoa(binary),
          mime_type: file.type || 'audio/mp3',
          dialect
        });
      } else {
        // In Premiere, timeline clips are not browser File objects. Read the
        // selected clip's original project media through its filesystem path.
        const selectedClips = await PremiereAPI.getSelectedClipTranscripts();
        const seenPaths = new Set();
        const selectedMedia = selectedClips.find(clip => {
          const mediaPath = String(clip?.mediaPath || '').trim();
          if (!mediaPath || seenPaths.has(mediaPath)) return false;
          seenPaths.add(mediaPath);
          return true;
        });
        if (!selectedMedia) throw new Error('لم أجد ملفًا أصليًا للمقطع المحدد. تأكد أن المقطع متصل بملف في لوحة المشروع.');
        const inLabel = Number(selectedMedia.sourceInSeconds || 0).toFixed(2);
        const outLabel = Number(selectedMedia.sourceOutSeconds || 0).toFixed(2);
        if (label) label.textContent = `جاري تجهيز In ${inLabel}s → Out ${outLabel}s للمقطع المحدد...`;
        if (label) label.textContent = `جاري تجهيز الجزء المحدد فقط (${inLabel}s–${outLabel}s) دون Media Encoder...`;
        const selectedWav = await extractSelectedClipWav(selectedMedia);
        if (label) label.textContent = `جاري تفريغ الجزء المحدد فقط (${inLabel}s–${outLabel}s)...`;
        const transcription = await MickeyStudioAPI.transcribeBytes(selectedWav, 'audio/wav', dialect);
        textOutput = transcription.transcript;
        resultData = transcription.raw;
      }

      if (!textOutput) {
        const data = resultData || {};
        textOutput = data.transcript || data.text || data.data?.transcript || '';
      }
      if (!textOutput) throw new Error('لم تُرجع خدمة التفريغ نصًا. تحقق من إعدادات الخدمة ثم أعد المحاولة.');
      extTranscriptSRT = $('transcript-ext-opt')?.value === 'text' ? '' : (resultData?.data?.srt || resultData?.srt || '');
      extTranscriptSRT = reflowSrt(extTranscriptSRT, $('transcript-ext-max-chars')?.value, $('transcript-ext-max-words')?.value);
      if ($('transcript-ext-srt-output')) $('transcript-ext-srt-output').value = extTranscriptSRT;
      const srtStatus = $('transcript-ext-srt-status');
      if (srtStatus) srtStatus.textContent = $('transcript-ext-opt')?.value === 'text'
        ? 'اخترت النص المجرد؛ لا يوجد ملف SRT للاستيراد.'
        : extTranscriptSRT
          ? 'تم تجهيز SRT بالتوقيتات التي أعادها المحرك. راجعها قبل التسليم؛ لم نغيّر إجمالي توقيت كل بطاقة.'
          : 'النص جاهز، لكن المحرك لم يُرجع توقيتات SRT؛ لم ننشئ توقيتات تخمينية. جرّب التفريغ مجددًا أو استخدم النص فقط.';

      const outBox = $('transcript-ext-output-box');
      const outText = $('transcript-ext-result-text');
      if (outBox) outBox.classList.remove('hidden');
      if (outText) outText.value = textOutput;

      toast('اكتمل تفريغ وتحليل الصوت بنجاح!', 'success');
    } catch (err) {
      console.error('[Transcript Ext]', err);
      toast(err.message || 'تعذر إتمام التفريغ.', 'error');
    } finally {
      if (btn) btn.classList.remove('busy');
      if (label) label.textContent = 'بدء تفريغ وتحليل الصوت';
    }
  }

  async function insertSRTIntoPremiere() {
    extTranscriptSRT = $('transcript-ext-srt-output')?.value || extTranscriptSRT;
    if (!extTranscriptSRT) {
      toast('لا توجد توقيتات SRT حقيقية للاستيراد. أعد التفريغ أو استخدم النص فقط.', 'error');
      return;
    }
    const project = await PremiereAPI.getActiveProject();
    if (!project) {
      toast('افتح مشروع Premiere لإدراج ملف الترجمة.', 'error');
      return;
    }
    try {
      const fs = require('fs');
      const { mediaFolder } = await GeminiTransfer.resolveProjectMediaFolder();
      const srtPath = `${mediaFolder}\\Subtitles_${Date.now()}.srt`;
      fs.writeFileSync(srtPath, extTranscriptSRT, 'utf8');
      await PremiereAPI.importFileToProject(srtPath);
      toast('تم تصدير ملف SRT واستيراده إلى مشروع Premiere بنجاح!', 'success');
    } catch (e) {
      toast(`فشل تصدير SRT: ${e.message || e}`, 'error');
    }
  }

  async function init() {
    // Bind the primary actions before the first await. Premiere host checks can
    // be delayed by UXP; they must not prevent the panel controls from working.
    $('settings-open')?.addEventListener('click', openSettings);
    $('motion-scene-close')?.addEventListener('click', dismissMotionSceneDialog);
    $('motion-scene-dismiss')?.addEventListener('click', dismissMotionSceneDialog);
    const motionCreateButton = $('motion-scene-create');
    if (motionCreateButton) motionCreateButton.onclick = executePendingMotionScene;
    $('motion-scene-overlay')?.addEventListener('click', event => {
      if (event.target?.id === 'motion-scene-overlay') dismissMotionSceneDialog();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !$('motion-scene-overlay')?.classList.contains('hidden')) dismissMotionSceneDialog();
    });
    startMotionSceneWatcher();
    $('generate')?.addEventListener('click', generate);
    $('image-model')?.addEventListener('change', updateImageModelHint);
    updateImageModelHint();
    $('enhance-prompt')?.addEventListener('click', enhancePrompt);
    $('voiceover-generate')?.addEventListener('click', createVoiceover);
    $('voiceover-suggested')?.addEventListener('click', suggestVoiceScript);
    $('voiceover-refine')?.addEventListener('click', refineVoiceoverText);
    $('voiceover-refine')?.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); refineVoiceoverText(); } });
    $('voiceover-download')?.addEventListener('click', downloadVoiceover);
    $('voiceover-insert')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const inserted = await insertVoiceoverIntoPremiere();
        toast(inserted ? 'تم إدراج التعليق الصوتي عند موضع المؤشر.' : 'تم استيراد الصوت. افتح Sequence لإدراجه.', 'success');
      } catch (error) { toast(error.message || 'تعذر إدراج الصوت في Premiere.', 'error'); }
      finally { button.disabled = false; }
    });
    $('voiceover-rate')?.addEventListener('input', event => { $('voiceover-rate-label').textContent = `${Number(event.target.value).toFixed(2).replace(/0$/, '')}×`; });
    $('voiceover-pitch')?.addEventListener('input', event => { $('voiceover-pitch-label').textContent = Number(event.target.value).toFixed(2).replace(/0$/, ''); });

    // Dynamic Persona gender change in extension
    $('voiceover-gender')?.addEventListener('change', updateVoiceoverPersonas);
    updateVoiceoverPersonas();

    // Podcast Studio Listeners in Extension
    $('btn-podcast-ext-genscript')?.addEventListener('click', generatePodcastScriptExt);
    $('podcast-ext-generate')?.addEventListener('click', generatePodcastAudioExt);
    $('btn-podcast-ext-download')?.addEventListener('click', () => {
      if (!extPodcastUrl) return;
      const a = document.createElement('a'); a.href = extPodcastUrl; a.download = `podcast_${Date.now()}.wav`; a.click();
    });
    $('btn-podcast-ext-reinsert')?.addEventListener('click', async () => {
      if (!extPodcastBytes) return;
      try {
        await insertAudioBufferIntoPremiere(extPodcastBytes, 'Mickey_Podcast');
        toast('تم إدراج البودكاست في التايملاين مجدداً!', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });

    // Audiobook Studio Listeners in Extension
    $('audiobook-ext-generate')?.addEventListener('click', generateAudiobookChapterExt);
    $('btn-audiobook-ext-download')?.addEventListener('click', () => {
      if (!extAudiobookUrl) return;
      const a = document.createElement('a'); a.href = extAudiobookUrl; a.download = `audiobook_${Date.now()}.wav`; a.click();
    });
    $('btn-audiobook-ext-reinsert')?.addEventListener('click', async () => {
      if (!extAudiobookBytes) return;
      try {
        await insertAudioBufferIntoPremiere(extAudiobookBytes, 'Mickey_Audiobook');
        toast('تم إدراج الفصل في التايملاين مجدداً!', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });

    // Transcript Studio Listeners in Extension
    $('transcript-ext-dropzone')?.addEventListener('click', () => $('transcript-ext-file')?.click());
    $('transcript-ext-file')?.addEventListener('change', e => {
      const f = e.target.files?.[0];
      if (f && $('transcript-ext-filename')) $('transcript-ext-filename').textContent = f.name;
    });
    $('transcript-ext-process')?.addEventListener('click', processTranscriptionExt);
    $('btn-transcript-ext-insert-srt')?.addEventListener('click', insertSRTIntoPremiere);
    const reflowTranscriptSrtFromControls = () => {
      extTranscriptSRT = reflowSrt($('transcript-ext-srt-output')?.value || extTranscriptSRT, $('transcript-ext-max-chars')?.value, $('transcript-ext-max-words')?.value);
      if ($('transcript-ext-srt-output')) $('transcript-ext-srt-output').value = extTranscriptSRT;
    };
    $('transcript-ext-max-chars')?.addEventListener('change', reflowTranscriptSrtFromControls);
    $('transcript-ext-max-words')?.addEventListener('change', reflowTranscriptSrtFromControls);
    $('transcript-ext-srt-output')?.addEventListener('input', event => { extTranscriptSRT = event.target.value; });
    $('quickcut-analyze')?.addEventListener('click', analyzeQuickCut);
    $('btn-transcript-ext-copy')?.addEventListener('click', () => {
      const txt = $('transcript-ext-result-text')?.value || '';
      if (!txt) return;
      navigator.clipboard.writeText(txt).then(() => toast('تم نسخ النص المفرغ!', 'success'));
    });

    const engineSelect = $('voiceover-engine');
    if (engineSelect) {
      const savedEngine = (typeof StudioStorage?.getVoiceoverEngine === 'function' ? StudioStorage.getVoiceoverEngine() : (typeof StudioStorage?.get === 'function' ? StudioStorage.get('mickey_voiceover_engine') : '')) || 'gemini';
      engineSelect.value = savedEngine;
      const updateVoiceoverEngineStatus = () => {
        const isGemini = engineSelect.value === 'gemini';
        const badge = $('engine-status-badge');
        if (badge) {
          badge.textContent = isGemini ? 'WAV استوديو عالي الدقة (افتراضي)' : 'Edge Neural (مجاني بلا حدود)';
          badge.style.color = isGemini ? '#66ddc5' : '#38bdf8';
        }
        const statusBox = $('voiceover-gemini-status');
        if (!statusBox) return;
        if (isGemini) {
          statusBox.style.display = 'block';
          statusBox.onclick = null;
          statusBox.style.cursor = 'default';
          statusBox.innerHTML = '<div style="display:flex; align-items:center; gap:6px; color:#66ddc5; font-size:10px; background:rgba(102,221,197,0.08); border:1px solid rgba(102,221,197,0.22); padding:5px 8px; border-radius:8px;"><span>✨</span><span>توليد عبر Gemini 3.8 Flash TTS بجودة استوديو WAV فائقة الدقة عبر منصة الذكاء الاصطناعي.</span></div>';
        } else {
          statusBox.style.display = 'block';
          statusBox.onclick = null;
          statusBox.style.cursor = 'default';
          statusBox.innerHTML = '<div style="display:flex; align-items:center; gap:6px; color:#38bdf8; font-size:10px; background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.2); padding:5px 8px; border-radius:8px;"><span>⚡</span><span>محرك Edge Neural TTS مجاني وسريع 100% عبر خادم المنصة.</span></div>';
        }
      };
      window.updateVoiceoverEngineStatus = updateVoiceoverEngineStatus;
      updateVoiceoverEngineStatus();
      engineSelect.addEventListener('change', () => {
        if (typeof StudioStorage?.setVoiceoverEngine === 'function') {
          StudioStorage.setVoiceoverEngine(engineSelect.value);
        } else if (typeof StudioStorage?.set === 'function') {
          StudioStorage.set('mickey_voiceover_engine', engineSelect.value);
        }
        updateVoiceoverEngineStatus();
      });
    }

    // Custom Audio Player Listeners
    $('btn-custom-play')?.addEventListener('click', toggleCustomPlay);
    $('btn-volume-icon')?.addEventListener('click', toggleMute);
    $('audio-volume-slider')?.addEventListener('input', e => setVolume(e.target.value));
    $('btn-audio-speed')?.addEventListener('click', cycleAudioSpeed);
    $('btn-audio-skip-back')?.addEventListener('click', () => skipAudio(-10));
    $('btn-audio-skip-fwd')?.addEventListener('click', () => skipAudio(10));
    $('btn-audio-loop')?.addEventListener('click', toggleAudioLoop);

    bindNavigation(); bindUxPButtons(); renderFavorites(); renderLibrary();
    state.promptTemplates = StudioStorage.getPromptTemplates(); renderPromptTemplates();
    // Check account status on launch
    (async () => {
      const email = StudioStorage.getAccountEmail();
      const refreshToken = await StudioStorage.getAccountRefreshToken();
      if (!email || !refreshToken) {
        MickeyStudioAPI.updateAccountLinkStatus('', false);
      } else {
        try {
          const access = await MickeyStudioAPI.ensureAccountAccess();
          MickeyStudioAPI.updateAccountLinkStatus(access.email || email, true);
        } catch (err) {
          console.warn('[MickeyStudio] Startup access verification:', err);
        }
      }
    })();

    Promise.resolve().then(() => PremiereAPI.getPremiereState()).then(stateInfo => {
      $('host-state').textContent = stateInfo.hasSequence ? `متصل · ${stateInfo.sequenceName}` : stateInfo.hasProject ? 'متصل · افتح Sequence' : stateInfo.isAvailable ? 'متصل · افتح مشروعًا' : 'افتح داخل Premiere Pro';
      $('host-state').parentElement.classList.toggle('connected', stateInfo.isAvailable);
    }).catch(error => {
      console.warn('[MickeyStudio] Premiere status unavailable:', error);
      if ($('host-state')) $('host-state').textContent = 'لوحة Mickey Studio جاهزة';
    });

    // Generation & Tools Event Listeners
    $('broll-analyze')?.addEventListener('click', analyzeBroll);
    $('chapters-analyze')?.addEventListener('click', analyzeChapters);

    // Photo Lab UI & Processing
    $('tab-photolab-bg')?.addEventListener('click', () => {
      $('tab-photolab-bg').classList.add('active');
      $('tab-photolab-upscale').classList.remove('active');
      $('photolab-panel-bg').classList.remove('hidden');
      $('photolab-panel-upscale').classList.add('hidden');
    });
    $('tab-photolab-upscale')?.addEventListener('click', () => {
      $('tab-photolab-upscale').classList.add('active');
      $('tab-photolab-bg').classList.remove('active');
      $('photolab-panel-upscale').classList.remove('hidden');
      $('photolab-panel-bg').classList.add('hidden');
    });

    let photolabBgFile = null;
    let photolabUpscaleFile = null;

    $('btn-photolab-bg-browse')?.addEventListener('click', () => $('photolab-bg-input')?.click());
    $('photolab-bg-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        photolabBgFile = file;
        $('photolab-bg-name').textContent = `الملف المختار: ${file.name}`;
      }
    });
    $('btn-photolab-bg-use-last')?.addEventListener('click', () => {
      if (state.currentAsset?.nativePath || state.currentAsset?.destPath) {
        photolabBgFile = state.currentAsset;
        $('photolab-bg-name').textContent = `الصورة الحالية: ${state.currentAsset.fileName || state.currentAsset.name}`;
      } else {
        toast('لا توجد صورة منشأة مسبقاً في هذه الجلسة.', 'info');
      }
    });

    $('btn-photolab-upscale-browse')?.addEventListener('click', () => $('photolab-upscale-input')?.click());
    $('photolab-upscale-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        photolabUpscaleFile = file;
        $('photolab-upscale-name').textContent = `الملف المختار: ${file.name}`;
      }
    });
    $('btn-photolab-upscale-use-last')?.addEventListener('click', () => {
      if (state.currentAsset?.nativePath || state.currentAsset?.destPath) {
        photolabUpscaleFile = state.currentAsset;
        $('photolab-upscale-name').textContent = `الصورة الحالية: ${state.currentAsset.fileName || state.currentAsset.name}`;
      } else {
        toast('لا توجد صورة منشأة مسبقاً في هذه الجلسة.', 'info');
      }
    });

    // Execute BG Removal
    $('photolab-bg-generate')?.addEventListener('click', async () => {
      try {
        await assertAccountActive();
        if (!photolabBgFile) {
          toast('يرجى اختيار صورة أولاً لعزل خلفيتها.', 'warning');
          return;
        }
        $('photolab-bg-progress').classList.remove('hidden');
        $('photolab-bg-generate').setAttribute('aria-disabled', 'true');

        let base64 = '';
        let mime = 'image/png';
        if (photolabBgFile instanceof File) {
          const ab = await photolabBgFile.arrayBuffer();
          const bytes = new Uint8Array(ab);
          let binary = '';
          for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
          base64 = btoa(binary);
          mime = photolabBgFile.type || 'image/png';
        } else if (photolabBgFile.nativePath || photolabBgFile.destPath) {
          const fs = require('fs');
          const p = photolabBgFile.destPath || photolabBgFile.nativePath;
          const buf = fs.readFileSync(p);
          base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        }

        const result = await MickeyStudioAPI.removeBackground(base64, mime);
        const saved = await PremiereMedia.saveAndInsertImage(result.base64Data, 'image/png', 'Mickey_NoBG', { videoTrackIndex: 1, overwrite: false });
        renderLibrary();
        toast('تم عزل الخلفية وإدراج PNG شفاف بنجاح في التايملاين (V2)!', 'success');
      } catch (err) {
        toast(err.message || 'تعذر عزل الخلفية.', 'error');
      } finally {
        $('photolab-bg-progress').classList.add('hidden');
        $('photolab-bg-generate').removeAttribute('aria-disabled');
      }
    });

    // Execute Upscaling
    $('photolab-upscale-generate')?.addEventListener('click', async () => {
      try {
        await assertAccountActive();
        if (!photolabUpscaleFile) {
          toast('يرجى اختيار صورة أولاً لتكبيرها.', 'warning');
          return;
        }
        $('photolab-upscale-progress').classList.remove('hidden');
        $('photolab-upscale-generate').setAttribute('aria-disabled', 'true');

        let base64 = '';
        let mime = 'image/png';
        if (photolabUpscaleFile instanceof File) {
          const ab = await photolabUpscaleFile.arrayBuffer();
          const bytes = new Uint8Array(ab);
          let binary = '';
          for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
          base64 = btoa(binary);
          mime = photolabUpscaleFile.type || 'image/png';
        } else if (photolabUpscaleFile.nativePath || photolabUpscaleFile.destPath) {
          const fs = require('fs');
          const p = photolabUpscaleFile.destPath || photolabUpscaleFile.nativePath;
          const buf = fs.readFileSync(p);
          base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        }

        const factor = Number($('photolab-upscale-factor')?.value || 4);
        const result = await MickeyStudioAPI.upscaleImage(base64, mime, factor);
        const saved = await PremiereMedia.saveAndInsertImage(result.base64Data, 'image/png', `Mickey_4K_${factor}x`, { overwrite: false });
        renderLibrary();
        toast(`تم تكبير وتوضيح الصورة بدقة ${factor}X وحفظها بالمشروع!`, 'success');
      } catch (err) {
        toast(err.message || 'تعذر تكبير الصورة.', 'error');
      } finally {
        $('photolab-upscale-progress').classList.add('hidden');
        $('photolab-upscale-generate').removeAttribute('aria-disabled');
      }
    });

    $('prompt-templates')?.addEventListener('change', event => {
      if (!event.target.value) return;
      const index = Number(event.target.value);
      if (Number.isInteger(index) && state.promptTemplates[index]) $('prompt').value = state.promptTemplates[index].prompt;
    });
    $('prompt-save-toggle')?.addEventListener('click', () => {
      $('prompt-save-form')?.classList.remove('hidden'); $('prompt-template-name')?.focus();
    });
    $('prompt-save-confirm')?.addEventListener('click', savePromptTemplate);
    $('insert-again')?.addEventListener('click', async () => {
      if (!state.currentAsset) return;
      if (await insertAsset(state.currentAsset)) {
        $('result-detail').textContent = 'تم إدراج الصورة عند موضع مؤشر التشغيل في التايملاين.';
        $('insert-again').textContent = 'إدراج مرة أخرى';
      }
    });
    $('effect-search')?.addEventListener('input', event => renderEffects(event.target.value));
    try { state.effects = await PremiereAPI.getVideoEffects(); renderEffects($('effect-search')?.value || ''); }
    catch (error) { const er = $('effect-results'); if (er) er.innerHTML = `<div class="empty-state">${safeText(error.message)}</div>`; }
  }
  function bootRebuild() {
    init().catch(error => {
      console.error('[MickeyStudio] Extension UI initialization failed:', error);
      try { toast(`تعذر تهيئة أزرار الإضافة: ${error.message || error}`, 'error'); } catch (_) {}
    });
  }

  // UXP may evaluate this panel after DOMContentLoaded has already fired.
  // In that case a DOMContentLoaded-only listener leaves every control inert.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootRebuild, { once: true });
  } else {
    bootRebuild();
  }
})();

