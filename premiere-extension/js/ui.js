/**
 * ui.js — Mickey Gemini Studio for Adobe Premiere Pro
 *
 * Manages DOM updates, Google Auth profile badge & gate,
 * webview controls, timeline floating dock, 5-stage stepper,
 * candidate selection modal, and toasts.
 */

'use strict';

const StudioUI = (() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    // Header & Auth
    btnHeaderLogin:      () => $('btn-header-login'),
    headerUserPill:      () => $('header-user-pill'),
    headerAvatar:        () => $('header-avatar'),
    headerUserName:      () => $('header-user-name'),

    // Sequence & Status
    seqPill:             () => $('header-sequence-pill'),
    seqDot:              () => $('seq-status-dot'),
    seqNameText:         () => $('seq-name-text'),
    btnReload:           () => $('btn-reload-webview'),
    btnInfoModal:        () => $('btn-info-modal'),

    // Auth Gate Screen
    authGateScreen:      () => $('auth-gate-screen'),
    btnGoogleAuthMain:   () => $('btn-google-auth-main'),
    authWaitingBox:      () => $('auth-waiting-box'),
    inputAuthPin:        () => $('input-auth-pin'),
    btnVerifyPin:        () => $('btn-verify-pin'),
    btnSkipAuth:         () => $('btn-skip-auth'),

    // Webview
    webview:             () => $('gemini-webview'),

    // Auto-Drop Realtime Controls
    switchAutoDrop:      () => $('switch-auto-drop'),
    autoDropDot:         () => $('auto-drop-dot'),
    autoDropHint:        () => $('auto-drop-hint'),
    dockQuickDetected:   () => $('dock-quick-detected'),
    dqdFilename:         () => $('dqd-filename'),
    btnDqdInsert:        () => $('btn-dqd-quick-insert'),

    // Floating Timeline Dock Actions
    btnImportLatest:     () => $('btn-import-latest-download'),
    btnManualPick:       () => $('btn-manual-pick-file'),
    btnChangeFolder:     () => $('btn-change-downloads-folder'),
    btnRetryInsert:      () => $('btn-retry-timeline-insert'),
    stepperBar:          () => $('execution-stepper-bar'),

    // Backward-compat aliases
    btnDirectTimeline:   () => $('btn-import-latest-download'),
    btnDirectProject:    () => $('btn-manual-pick-file'),

    // File Chip
    dockChip:            () => $('dock-file-chip'),
    dfcFilename:         () => $('dfc-filename'),
    dfcStatus:           () => $('dfc-status'),
    dfcDot:              () => $('dfc-dot'),

    // Candidate Picker Modal
    candidateModal:      () => $('candidate-picker-modal'),
    candidateList:       () => $('candidate-list-container'),
    btnConfirmCandidate: () => $('btn-confirm-candidate'),
    btnCancelCandidate:  () => $('btn-cancel-candidate'),
    btnCloseCandidate:   () => $('btn-close-candidate-modal'),

    // Footer Status bar & Toast
    statusDot:           () => $('status-dot'),
    statusText:          () => $('status-text'),
    projectPill:         () => $('project-status-pill'),
    toastContainer:      () => $('toast-container'),

    // Info modal
    infoModal:           () => $('info-modal'),
    btnCloseInfo:        () => $('btn-close-info'),
    btnCloseInfoOk:      () => $('btn-close-info-ok'),

    // Mode Viewports & Tabs
    tabStudio:           () => $('tab-mode-studio'),
    tabWebview:          () => $('tab-mode-webview'),
    viewStudio:          () => $('view-direct-studio'),
    viewWebview:         () => $('view-gemini-webview'),

    // Header API Key Pill
    headerApiKeyDot:     () => $('header-apikey-dot'),
    headerApiKeyLabel:   () => $('header-apikey-label'),
    btnOpenApiKeyModal:  () => $('btn-open-apikey-modal'),

    // API Key Modal
    apiKeyModal:         () => $('apikey-modal'),
    inputApiKey:         () => $('input-gemini-api-key'),
    btnToggleKeyVis:     () => $('btn-toggle-key-visibility'),
    btnTestApiKey:       () => $('btn-test-apikey'),
    apiKeyTestFeedback:  () => $('apikey-test-feedback'),
    btnSaveApiKey:       () => $('btn-save-apikey'),
    btnCancelApiKey:     () => $('btn-cancel-apikey'),
    btnCloseApiKeyModal: () => $('btn-close-apikey-modal'),

    // Direct AI Studio Inputs
    promptInput:         () => $('studio-prompt-input'),
    promptCharCount:     () => $('prompt-char-count'),
    btnClearPrompt:      () => $('btn-clear-prompt'),
    btnEnhancePrompt:    () => $('btn-enhance-prompt'),
    selectImagenModel:   () => $('select-imagen-model'),
    btnStudioGenerate:   () => $('btn-studio-generate'),

    // Stepper & Showcase
    aiStepperContainer:  () => $('ai-stepper-container'),
    aiStepperLabel:      () => $('ai-stepper-label'),
    aiResultShowcase:    () => $('ai-result-showcase'),
    aiPreviewImg:        () => $('ai-result-preview-img'),
    resBadgeAspect:      () => $('res-badge-aspect'),
    resFilename:         () => $('res-filename'),
    resPromptSnippet:    () => $('res-prompt-snippet'),
    btnResReinsert:      () => $('btn-res-reinsert-timeline'),
    btnResCopyPath:      () => $('btn-res-copy-path'),
    btnResRegen:         () => $('btn-res-regenerate'),

    // Filmstrip & Inspect
    recentStrip:         () => $('recent-filmstrip-scroll'),
    recentEmptyHint:     () => $('recent-empty-hint'),
    btnClearRecentHistory: () => $('btn-clear-recent-history'),
    inspectModal:        () => $('image-inspect-modal'),
    inspectImg:          () => $('inspect-full-img'),
    btnCloseInspect:     () => $('btn-close-inspect'),
  };

  // ------------------------------------------------------------------
  // 1. AUTHENTICATION UI
  // ------------------------------------------------------------------

  function setAuthState(user) {
    const btnLogin = els.btnHeaderLogin();
    const userPill = els.headerUserPill();
    const avatar = els.headerAvatar();
    const userName = els.headerUserName();
    const gate = els.authGateScreen();

    if (user && user.uid) {
      if (btnLogin) btnLogin.classList.add('hidden');
      if (userPill) userPill.classList.remove('hidden');
      if (avatar) avatar.src = user.photoURL || 'https://www.gstatic.com/images/branding/product/2x/avatar_square_blue_120dp.png';
      if (userName) userName.textContent = user.name || 'مستخدم Google';
      if (gate) gate.classList.add('hidden');
    } else {
      if (btnLogin) btnLogin.classList.remove('hidden');
      if (userPill) userPill.classList.add('hidden');
    }
  }

  function showAuthGate(show = true) {
    const gate = els.authGateScreen();
    const wv = els.webview();
    if (!gate) return;
    if (show) {
      if (wv) wv.style.display = 'none';
      gate.classList.remove('hidden');
      setAuthWaiting(false);
    } else {
      gate.classList.add('hidden');
      if (wv) wv.style.display = 'block';
    }
  }

  function setAuthWaiting(isWaiting) {
    const box = els.authWaitingBox();
    const btnGoogle = els.btnGoogleAuthMain();
    if (box) {
      if (isWaiting) box.classList.remove('hidden');
      else box.classList.add('hidden');
    }
    if (btnGoogle) {
      btnGoogle.disabled = isWaiting;
      btnGoogle.style.opacity = isWaiting ? '0.6' : '1';
    }
  }

  // ------------------------------------------------------------------
  // 2. STATUS BAR & SEQUENCE PILL
  // ------------------------------------------------------------------

  const STATUS = {
    READY:   'ready',
    LOADING: 'loading',
    ERROR:   'error',
    WARNING: 'warning',
  };

  function setStatus(type, message) {
    const dot = els.statusDot();
    const text = els.statusText();
    if (!dot || !text) return;

    dot.className = `status-dot status-${type}`;
    text.textContent = message || (type === STATUS.READY ? 'جاهز' : '');
  }

  function setProjectInfo(projectName, sequenceName) {
    const projPill = els.projectPill();
    const seqNameText = els.seqNameText();
    const seqDot = els.seqDot();

    if (projPill) {
      projPill.textContent = projectName || 'لا يوجد مشروع مفتوح';
    }

    if (seqNameText) {
      if (sequenceName) {
        seqNameText.textContent = sequenceName;
        if (seqDot) seqDot.className = 'status-pulse-dot';
      } else {
        seqNameText.textContent = 'لا توجد Sequence';
        if (seqDot) seqDot.className = 'status-pulse-dot status-warning';
      }
    }
  }

  function showToast(message, type = 'info', duration = 3500) {
    const container = els.toastContainer();
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `studio-toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
      iconSvg = `<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-icon-wrap">${iconSvg}</div>
      <div class="toast-msg">${_escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, duration);
  }

  // ------------------------------------------------------------------
  // 3. EXECUTION PROGRESS STEPPER (5 STAGES)
  // ------------------------------------------------------------------

  function showExecutionStepper(show = true) {
    const bar = els.stepperBar();
    if (bar) {
      if (show) bar.classList.remove('hidden');
      else bar.classList.add('hidden');
    }
  }

  function resetExecutionStepper() {
    for (let i = 1; i <= 5; i++) {
      const step = document.getElementById(`step-${i}`);
      const bullet = document.getElementById(`bullet-${i}`);
      const line = document.getElementById(`line-${i}`);
      if (step) step.className = 'stepper-step';
      if (bullet) bullet.textContent = String(i);
      if (line) line.className = 'stepper-line';
    }
  }

  /**
   * Sets the state of a specific step in the 5-stage stepper.
   *
   * @param {number} stepNum - 1 to 5
   * @param {'active' | 'success' | 'warning' | 'error' | 'idle'} status
   */
  function setStepperStep(stepNum, status = 'active') {
    showExecutionStepper(true);

    // Prior steps should be marked as success if this step is active or above
    for (let i = 1; i < stepNum; i++) {
      const priorStep = document.getElementById(`step-${i}`);
      const priorBullet = document.getElementById(`bullet-${i}`);
      const priorLine = document.getElementById(`line-${i}`);
      if (priorStep && !priorStep.classList.contains('error')) {
        priorStep.className = 'stepper-step success';
        if (priorBullet) priorBullet.textContent = '✓';
      }
      if (priorLine) priorLine.className = 'stepper-line completed';
    }

    const currentStep = document.getElementById(`step-${stepNum}`);
    const currentBullet = document.getElementById(`bullet-${stepNum}`);
    const currentLine = document.getElementById(`line-${stepNum}`);

    if (currentStep) {
      currentStep.className = `stepper-step ${status}`;
    }
    if (currentBullet) {
      if (status === 'success') currentBullet.textContent = '✓';
      else if (status === 'warning') currentBullet.textContent = '!';
      else if (status === 'error') currentBullet.textContent = '✕';
      else currentBullet.textContent = String(stepNum);
    }
    if (currentLine && status === 'success') {
      currentLine.className = 'stepper-line completed';
    }
  }

  // ------------------------------------------------------------------
  // 4. CANDIDATE SELECTION MODAL
  // ------------------------------------------------------------------

  let _candidateSelectCallback = null;
  let _selectedCandidateIndex = 0;
  let _cachedCandidates = [];

  function showCandidatePickerModal(candidates, onSelect) {
    const modal = els.candidateModal();
    const list = els.candidateList();
    const btnConfirm = els.btnConfirmCandidate();
    const wv = els.webview();

    if (!modal || !list || !candidates || candidates.length === 0) return;

    _cachedCandidates = candidates;
    _candidateSelectCallback = onSelect;
    _selectedCandidateIndex = 0;

    // Temporarily hide webview so modal doesn't bleed behind
    if (wv) wv.style.display = 'none';

    list.innerHTML = '';
    candidates.forEach((cand, idx) => {
      const card = document.createElement('div');
      card.className = `candidate-item-card ${idx === 0 ? 'selected' : ''}`;
      card.dataset.index = idx;

      const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'mxf', 'webm'].includes(cand.ext.toLowerCase());
      const iconSvg = isVideo
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

      card.innerHTML = `
        <div class="candidate-icon">${iconSvg}</div>
        <div class="candidate-item-info">
          <div class="candidate-item-name" title="${_escapeHtml(cand.name)}">${_escapeHtml(cand.name)}</div>
          <div class="candidate-item-meta">
            <span>${cand.sizeFormatted}</span>
            <span>•</span>
            <span>${cand.timeAgoFormatted}</span>
            ${cand.isGeminiName ? '<span class="candidate-badge-gemini">Gemini</span>' : ''}
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        list.querySelectorAll('.candidate-item-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        _selectedCandidateIndex = idx;
        if (btnConfirm) btnConfirm.disabled = false;
      });

      card.addEventListener('dblclick', () => {
        _selectedCandidateIndex = idx;
        closeCandidatePickerModal();
        if (typeof _candidateSelectCallback === 'function') {
          _candidateSelectCallback(candidates[idx]);
        }
      });

      list.appendChild(card);
    });

    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.onclick = () => {
        const chosen = _cachedCandidates[_selectedCandidateIndex];
        closeCandidatePickerModal();
        if (chosen && typeof _candidateSelectCallback === 'function') {
          _candidateSelectCallback(chosen);
        }
      };
    }

    modal.classList.remove('hidden');
  }

  function closeCandidatePickerModal() {
    const modal = els.candidateModal();
    const wv = els.webview();
    if (modal) modal.classList.add('hidden');
    if (wv) wv.style.display = 'block';
  }

  // ------------------------------------------------------------------
  // 5. TIMELINE DOCK FILE CHIP & RETRY BUTTON
  // ------------------------------------------------------------------

  function showFileChip(fileName, statusText, isSuccess = true, showRetry = false, onRetryClick = null) {
    const chip = els.dockChip();
    const nameEl = els.dfcFilename();
    const statusEl = els.dfcStatus();
    const dot = els.dfcDot();
    const btnRetry = els.btnRetryInsert();

    if (!chip || !nameEl || !statusEl) return;

    nameEl.textContent = fileName || 'الملف';
    statusEl.textContent = statusText || (isSuccess ? 'تم الإدراج بنجاح ✓' : 'تعذر الإدراج ✕');
    statusEl.style.color = isSuccess ? '#6ee7b7' : (showRetry ? '#fbbf24' : '#fca5a5');

    if (dot) {
      dot.style.backgroundColor = isSuccess ? 'var(--status-ready)' : (showRetry ? 'var(--status-warning)' : 'var(--status-error)');
    }

    if (btnRetry) {
      if (showRetry && typeof onRetryClick === 'function') {
        btnRetry.classList.remove('hidden');
        btnRetry.onclick = onRetryClick;
      } else {
        btnRetry.classList.add('hidden');
        btnRetry.onclick = null;
      }
    }

    chip.classList.remove('hidden');
  }

  function setDockButtonsProcessing(isProcessing, actionLabel = '') {
    const btnMain = els.btnImportLatest();
    const btnManual = els.btnManualPick();
    const btnFolder = els.btnChangeFolder();

    if (btnMain) btnMain.disabled = isProcessing;
    if (btnManual) btnManual.disabled = isProcessing;
    if (btnFolder) btnFolder.disabled = isProcessing;

    if (isProcessing) {
      setStatus(STATUS.LOADING, actionLabel || 'جارٍ التنفيذ...');
    } else {
      setStatus(STATUS.READY);
    }
  }

  // ------------------------------------------------------------------
  // 6. WEBVIEW HELPERS
  // ------------------------------------------------------------------

  function reloadWebview() {
    const wv = els.webview();
    if (wv) {
      try {
        if (typeof wv.reload === 'function') {
          wv.reload();
        } else {
          wv.src = 'https://gemini.google.com/';
        }
        showToast('جارٍ إعادة تحميل Gemini...', 'info', 2000);
      } catch (err) {
        wv.src = 'https://gemini.google.com/';
      }
    }
  }

  // ------------------------------------------------------------------
  // 7. INFO MODAL
  // ------------------------------------------------------------------

  function openInfoModal() {
    const modal = els.infoModal();
    const wv = els.webview();
    if (wv) wv.style.display = 'none';
    if (modal) modal.classList.remove('hidden');
  }

  function closeInfoModal() {
    const modal = els.infoModal();
    const wv = els.webview();
    if (modal) modal.classList.add('hidden');
    if (wv) wv.style.display = 'block';
  }

  // ------------------------------------------------------------------
  // 6. AUTO-DROP UI HELPERS
  // ------------------------------------------------------------------

  function setAutoDropState(isEnabled) {
    const sw = els.switchAutoDrop();
    const dot = els.autoDropDot();
    const hint = els.autoDropHint();

    if (sw) sw.checked = !!isEnabled;
    if (dot) {
      if (isEnabled) dot.classList.add('active');
      else dot.classList.remove('active');
    }
    if (hint) {
      hint.textContent = isEnabled
        ? 'مفعّل: يدرج الصورة في التايملاين تلقائيًا بمجرد تنزيلها!'
        : 'معطّل: اضغط الزر يدوياً لنقل الوسائط للتايملاين.';
    }
  }

  function showQuickDetected(fileName, onInsertClick) {
    const banner = els.dockQuickDetected();
    const nameEl = els.dqdFilename();
    const btnInsert = els.btnDqdInsert();

    if (!banner) return;
    if (nameEl) nameEl.textContent = fileName || 'وسائط Gemini';
    if (btnInsert && typeof onInsertClick === 'function') {
      btnInsert.onclick = () => {
        hideQuickDetected();
        onInsertClick();
      };
    }
    banner.classList.remove('hidden');
  }

  function hideQuickDetected() {
    const banner = els.dockQuickDetected();
    if (banner) banner.classList.add('hidden');
  }

  function _escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ------------------------------------------------------------------
  // 8. DIRECT AI STUDIO MODE & UI CONTROLS
  // ------------------------------------------------------------------

  function switchMode(mode = 'studio') {
    const tabStudio = els.tabStudio();
    const tabWebview = els.tabWebview();
    const viewStudio = els.viewStudio();
    const viewWebview = els.viewWebview();

    if (mode === 'studio') {
      if (tabStudio) {
        tabStudio.classList.add('active');
        tabStudio.setAttribute('aria-selected', 'true');
      }
      if (tabWebview) {
        tabWebview.classList.remove('active');
        tabWebview.setAttribute('aria-selected', 'false');
      }
      if (viewStudio) {
        viewStudio.classList.remove('hidden');
        viewStudio.classList.add('active');
      }
      if (viewWebview) {
        viewWebview.classList.add('hidden');
        viewWebview.classList.remove('active');
      }
    } else {
      if (tabStudio) {
        tabStudio.classList.remove('active');
        tabStudio.setAttribute('aria-selected', 'false');
      }
      if (tabWebview) {
        tabWebview.classList.add('active');
        tabWebview.setAttribute('aria-selected', 'true');
      }
      if (viewStudio) {
        viewStudio.classList.add('hidden');
        viewStudio.classList.remove('active');
      }
      if (viewWebview) {
        viewWebview.classList.remove('hidden');
        viewWebview.classList.add('active');
      }
    }
  }

  function updateApiKeyHeaderState() {
    const dot = els.headerApiKeyDot();
    const label = els.headerApiKeyLabel();
    const key = StudioStorage.getApiKey();
    const hasKey = key && typeof key === 'string' && key.trim().length > 10;

    if (dot) {
      if (hasKey) dot.classList.add('connected');
      else dot.classList.remove('connected');
    }
    if (label) {
      label.textContent = hasKey ? 'مفتاح API متصل ✓' : 'إعداد مفتاح API ⚠️';
    }
  }

  function showApiKeyModal(show = true) {
    const modal = els.apiKeyModal();
    const input = els.inputApiKey();
    const feedback = els.apiKeyTestFeedback();
    if (!modal) return;

    if (show) {
      if (input) input.value = StudioStorage.getApiKey() || '';
      if (feedback) feedback.classList.add('hidden');
      modal.classList.remove('hidden');
    } else {
      modal.classList.add('hidden');
    }
  }

  function setApiKeyTestFeedback(message, type = 'info') {
    const feedback = els.apiKeyTestFeedback();
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `test-feedback-text ${type}`;
    feedback.classList.remove('hidden');
  }

  function getPrompt() {
    const input = els.promptInput();
    return input ? input.value.trim() : '';
  }

  function setPrompt(text) {
    const input = els.promptInput();
    if (input) {
      input.value = text;
      updatePromptCharCount();
    }
  }

  function updatePromptCharCount() {
    const input = els.promptInput();
    const counter = els.promptCharCount();
    if (input && counter) {
      counter.textContent = `${input.value.length} حرف`;
    }
  }

  function getSelectedAspectRatio() {
    const activeBtn = document.querySelector('.aspect-pill.active, .aspect-option-btn.active');
    return activeBtn ? activeBtn.getAttribute('data-ratio') || '16:9' : '16:9';
  }

  function setSelectedAspectRatio(ratio) {
    const btns = document.querySelectorAll('.aspect-pill, .aspect-option-btn');
    btns.forEach(btn => {
      if (btn.getAttribute('data-ratio') === ratio) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function getSelectedStyle() {
    const sel = document.getElementById('studio-style-select');
    if (sel && sel.value) return sel.value;
    const activeChip = document.querySelector('.style-chip.active');
    return activeChip ? activeChip.getAttribute('data-style') || 'cinematic' : 'cinematic';
  }

  function setSelectedStyle(style) {
    const sel = document.getElementById('studio-style-select');
    if (sel) sel.value = style;
    const chips = document.querySelectorAll('.style-chip');
    chips.forEach(chip => {
      if (chip.getAttribute('data-style') === style) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  function getSelectedModel() {
    const sel = els.selectImagenModel();
    return sel ? sel.value : 'imagen-3.0-generate-002';
  }

  function setGeneratingState(isGenerating, message = '') {
    const btnGen = els.btnStudioGenerate();
    const stepper = els.aiStepperContainer();
    const label = els.aiStepperLabel();

    if (btnGen) {
      btnGen.disabled = isGenerating;
      btnGen.style.opacity = isGenerating ? '0.7' : '1';
    }
    if (stepper) {
      if (isGenerating) stepper.classList.remove('hidden');
      else stepper.classList.add('hidden');
    }
    if (label && message) {
      label.textContent = message;
    }
  }

  function setAiStepperStep(stepNum, status = 'active') {
    const label = els.aiStepperLabel();
    const steps = [
      '⚡ إرسال الطلب لـ Google Imagen 3...',
      '🖼️ معالجة وفك تشفير الصورة...',
      '💾 حفظ في مجلد المشروع Mickey Gemini Media...',
      '🎬 إدراج في التايملاين عند موضع المؤشر...',
    ];
    if (label && steps[stepNum - 1]) {
      label.textContent = steps[stepNum - 1];
    }
  }

  function resetAiStepper() {
    const label = els.aiStepperLabel();
    if (label) label.textContent = 'جاري التوليد بـ Google Imagen 3...';
  }

  function showResultShowcase(data) {
    const showcase = els.aiResultShowcase();
    const img = els.aiPreviewImg();
    const aspect = els.resBadgeAspect();
    const filename = els.resFilename();
    const promptSnippet = els.resPromptSnippet();

    if (!showcase) return;

    if (img) {
      img.src = data.previewUrl || `data:${data.mimeType || 'image/jpeg'};base64,${data.base64Data}`;
    }
    if (aspect) aspect.textContent = data.aspectRatio || '16:9';
    if (filename) filename.textContent = data.fileName || 'Mickey_AI_Image.jpg';
    if (promptSnippet) promptSnippet.textContent = data.prompt || '';

    showcase.classList.remove('hidden');
    try {
      showcase.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (_) {}
  }

  function hideResultShowcase() {
    const showcase = els.aiResultShowcase();
    if (showcase) showcase.classList.add('hidden');
  }

  function updateRecentCreationsStrip(onInsertCallback) {
    const strip = els.recentStrip();
    const emptyHint = els.recentEmptyHint();
    if (!strip) return;

    const recents = StudioStorage.getRecentFiles().filter(f => f.type === 'ai-image');

    if (!recents.length) {
      if (emptyHint) emptyHint.classList.remove('hidden');
      return;
    }

    if (emptyHint) emptyHint.classList.add('hidden');

    // Remove old cards
    const oldCards = strip.querySelectorAll('.recent-card-item');
    oldCards.forEach(c => c.remove());

    recents.forEach(item => {
      const card = document.createElement('div');
      card.className = 'recent-card-item';
      card.title = `${item.name}\n(اضغط للإدراج في Timeline)`;

      const img = document.createElement('img');
      img.src = item.nativePath.startsWith('http') || item.nativePath.startsWith('blob:') || item.nativePath.startsWith('data:')
        ? item.nativePath
        : `file:///${item.nativePath.replace(/\\/g, '/')}`;
      img.onerror = () => {
        img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="45" viewBox="0 0 60 45"><rect width="60" height="45" fill="%231e293b"/><text x="50%" y="55%" fill="%2364748b" font-size="10" text-anchor="middle" dominant-baseline="middle">🖼️ AI</text></svg>';
      };

      const overlay = document.createElement('div');
      overlay.className = 'recent-card-overlay';
      overlay.textContent = '🎬 إدراج';

      card.appendChild(img);
      card.appendChild(overlay);

      card.onclick = () => {
        if (typeof onInsertCallback === 'function') {
          onInsertCallback(item);
        }
      };

      strip.appendChild(card);
    });
  }

  function openInspectModal(src) {
    const modal = els.inspectModal();
    const img = els.inspectImg();
    if (!modal || !img) return;
    img.src = src;
    modal.classList.remove('hidden');
  }

  function closeInspectModal() {
    const modal = els.inspectModal();
    if (modal) modal.classList.add('hidden');
  }

  return {
    STATUS,
    setStatus,
    setProjectInfo,
    showToast,
    setAuthState,
    showAuthGate,
    setAuthWaiting,
    showExecutionStepper,
    resetExecutionStepper,
    setStepperStep,
    showCandidatePickerModal,
    closeCandidatePickerModal,
    showFileChip,
    setDockButtonsProcessing,
    setAutoDropState,
    showQuickDetected,
    hideQuickDetected,
    reloadWebview,
    openInfoModal,
    closeInfoModal,
    // Studio Extensions
    switchMode,
    updateApiKeyHeaderState,
    showApiKeyModal,
    setApiKeyTestFeedback,
    getPrompt,
    setPrompt,
    updatePromptCharCount,
    getSelectedAspectRatio,
    setSelectedAspectRatio,
    getSelectedStyle,
    setSelectedStyle,
    getSelectedModel,
    setGeneratingState,
    setAiStepperStep,
    resetAiStepper,
    showResultShowcase,
    hideResultShowcase,
    updateRecentCreationsStrip,
    openInspectModal,
    closeInspectModal,
  };
})();
