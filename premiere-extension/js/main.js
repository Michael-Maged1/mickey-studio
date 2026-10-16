/**
 * main.js — Mickey Gemini Studio for Adobe Premiere Pro
 *
 * Core workflow orchestrator:
 * 1. Google Firebase Authentication Bridge.
 * 2. Embedded Gemini inside Premiere panel.
 * 3. Phase 1-6 Smart Media Transfer Pipeline:
 *    - One-click import of latest Gemini download (Auto detection, stabilization check).
 *    - Copying into active project's 'Mickey Gemini Media' folder (collision-free).
 *    - Official Premiere UXP import to Project panel.
 *    - Strict active Sequence insertion via official SequenceEditor & executeTransaction.
 *    - 5-stage visual progress stepper.
 *    - Candidate selection modal when multiple media files are detected.
 *    - Non-duplicating retry mechanism when sequence is opened later.
 *    - Manual file picker fallback.
 */

'use strict';

(() => {
  // ------------------------------------------------------------------
  // STATE MANAGEMENT
  // ------------------------------------------------------------------
  let lastProcessedFile = null;      // { destPath, fileName, mediaFolder, isRenamed }
  let lastResolvedProjectItem = null; // Premiere Pro ProjectItem instance
  let isProcessRunning = false;
  let lastGeneratedAiResult = null;  // Last Imagen 3 generation outcome

  // ------------------------------------------------------------------
  // 1. INITIALIZATION & LIFECYCLE
  // ------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', () => {
    console.log('[MickeyGeminiStudio] Initializing Studio with Smart Transfer Pipeline & Direct AI Studio...');
    _bindEvents();
    _checkInitialAuthState();
    _refreshPremiereStatus();

    // Default: High-Tech Direct AI Studio (Option A)
    StudioUI.switchMode('studio');
    StudioUI.updateApiKeyHeaderState();
    StudioUI.updatePromptCharCount();
    StudioUI.updateRecentCreationsStrip(_insertRecentImageToTimeline);

    // Initialize Auto-Drop Watcher for Webview Mode
    const autoDropEnabled = StudioStorage.getAutoDropEnabled();
    StudioUI.setAutoDropState(autoDropEnabled);
    if (autoDropEnabled) {
      _startAutoDropWatcher();
    }

    // Auto-refresh timeline & project status on panel focus
    window.addEventListener('focus', () => {
      _refreshPremiereStatus();
      _checkBackgroundAuthUpdate();
      StudioUI.updateApiKeyHeaderState();
    });

    console.log('[MickeyGeminiStudio] Studio ready in Direct AI Mode.');
  });

  function _checkInitialAuthState() {
    const user = MickeyFirebaseAuth.getUser();
    if (user && user.uid) {
      StudioUI.setAuthState(user);
      console.log('[MickeyGeminiStudio] User authenticated:', user.name);
    } else {
      StudioUI.setAuthState(null);
      StudioUI.showAuthGate(false);
    }
  }

  function _checkBackgroundAuthUpdate() {
    if (!MickeyFirebaseAuth.isAuthenticated()) {
      try {
        const payloadStr = localStorage.getItem('mickey_firebase_auth_payload');
        if (payloadStr) {
          const payload = JSON.parse(payloadStr);
          if (payload && payload.uid) {
            const saved = MickeyFirebaseAuth.saveUser(payload);
            _onAuthSuccess(saved);
            localStorage.removeItem('mickey_firebase_auth_payload');
          }
        }
      } catch (_) { }
    }
  }

  async function _refreshPremiereStatus() {
    try {
      const state = await PremiereAPI.getPremiereState();
      StudioUI.setProjectInfo(state.projectName, state.sequenceName);

      if (!state.isAvailable) {
        StudioUI.setStatus(StudioUI.STATUS.WARNING, 'Premiere Pro غير متصل');
        return state;
      }

      if (!state.hasProject) {
        StudioUI.setStatus(StudioUI.STATUS.READY, 'افتح مشروعًا للبدء');
      } else if (!state.hasSequence) {
        StudioUI.setStatus(StudioUI.STATUS.READY, 'المشروع مفتوح (افتح Sequence للتايملاين)');
      } else {
        StudioUI.setStatus(StudioUI.STATUS.READY, 'جاهز للعمل مع Premiere Pro');
      }
      return state;
    } catch (err) {
      console.warn('[MickeyGeminiStudio] Status check error:', err);
      StudioUI.setStatus(StudioUI.STATUS.READY, 'جاهز');
      return null;
    }
  }

  // ------------------------------------------------------------------
  // 2. EVENT BINDINGS
  // ------------------------------------------------------------------

  function _bindEvents() {
    // Google Authentication triggers
    document.getElementById('btn-header-login')
      ?.addEventListener('click', () => StudioUI.showAuthGate(true));

    document.getElementById('btn-close-auth-gate')
      ?.addEventListener('click', () => StudioUI.showAuthGate(false));

    document.getElementById('btn-quick-gemini-auth')
      ?.addEventListener('click', _onQuickGeminiAuthConfirm);

    document.getElementById('header-user-pill')
      ?.addEventListener('click', _onUserPillClick);

    document.getElementById('btn-google-auth-main')
      ?.addEventListener('click', _onStartGoogleSignIn);

    document.getElementById('btn-verify-pin')
      ?.addEventListener('click', _onVerifyPin);

    document.getElementById('input-auth-pin')
      ?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _onVerifyPin();
      });

    document.getElementById('btn-skip-auth')
      ?.addEventListener('click', () => {
        StudioUI.showAuthGate(false);
      });

    // Webview controls
    document.getElementById('btn-reload-webview')
      ?.addEventListener('click', () => StudioUI.reloadWebview());

    // PRIMARY ACTION: إضافة آخر تنزيل إلى التايم لاين
    const btnMain = document.getElementById('btn-import-latest-download') ||
                    document.getElementById('btn-insert-timeline');
    btnMain?.addEventListener('click', _onImportLatestGeminiDownload);
    document.getElementById('btn-motion-handoff')
      ?.addEventListener('click', _onReceiveMotionScene);

    // SECONDARY ACTION: اختيار ملف يدويًا
    const btnManual = document.getElementById('btn-manual-pick-file') ||
                      document.getElementById('btn-import-downloaded-media');
    btnManual?.addEventListener('click', _onManualFilePick);

    // Change Downloads folder settings
    document.getElementById('btn-change-downloads-folder')
      ?.addEventListener('click', _onChangeDownloadsFolder);

    // Retry insertion
    document.getElementById('btn-retry-timeline-insert')
      ?.addEventListener('click', _retryTimelineInsertion);

    // Auto-Drop Realtime Toggle Switch
    const switchAuto = document.getElementById('switch-auto-drop');
    if (switchAuto) {
      switchAuto.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        StudioStorage.setAutoDropEnabled(enabled);
        StudioUI.setAutoDropState(enabled);
        if (enabled) {
          _startAutoDropWatcher();
          StudioUI.showToast('⚡ تم تفعيل المستشعر: سيتم إدراج الصور في التايملاين تلقائيًا بمجرد تنزيلها!', 'success', 4000);
        } else {
          GeminiTransfer.stopAutoDropWatcher();
          StudioUI.showToast('تم تعطيل المستشعر التلقائي (يمكنك استخدام الزر يدوياً).', 'info', 3000);
        }
      });
    }

    // Candidate modal buttons
    document.getElementById('btn-close-candidate-modal')
      ?.addEventListener('click', () => StudioUI.closeCandidatePickerModal());

    document.getElementById('btn-cancel-candidate')
      ?.addEventListener('click', () => StudioUI.closeCandidatePickerModal());

    // Help / Info modal
    document.getElementById('btn-info-modal')
      ?.addEventListener('click', () => StudioUI.openInfoModal());

    document.getElementById('btn-close-info')
      ?.addEventListener('click', () => StudioUI.closeInfoModal());

    document.getElementById('btn-close-info-ok')
      ?.addEventListener('click', () => StudioUI.closeInfoModal());

    document.getElementById('info-modal')
      ?.addEventListener('click', (e) => {
        if (e.target.id === 'info-modal') StudioUI.closeInfoModal();
      });

    // ------------------------------------------------------------------
    // DIRECT AI STUDIO (Option A) BINDINGS
    // ------------------------------------------------------------------
    // Mode Switcher
    document.getElementById('tab-mode-studio')
      ?.addEventListener('click', () => StudioUI.switchMode('studio'));

    document.getElementById('tab-mode-webview')
      ?.addEventListener('click', () => StudioUI.switchMode('webview'));

    // API Key Modal triggers
    document.getElementById('btn-open-apikey-modal')
      ?.addEventListener('click', () => StudioUI.showApiKeyModal(true));

    document.getElementById('btn-close-apikey-modal')
      ?.addEventListener('click', () => StudioUI.showApiKeyModal(false));

    document.getElementById('btn-cancel-apikey')
      ?.addEventListener('click', () => StudioUI.showApiKeyModal(false));

    document.getElementById('btn-toggle-key-visibility')
      ?.addEventListener('click', _onToggleApiKeyVisibility);

    document.getElementById('btn-test-apikey')
      ?.addEventListener('click', _onTestApiKey);

    document.getElementById('btn-save-apikey')
      ?.addEventListener('click', _onSaveApiKey);

    document.getElementById('input-gemini-api-key')
      ?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _onSaveApiKey();
      });

    // Prompt tools
    document.getElementById('studio-prompt-input')
      ?.addEventListener('input', () => StudioUI.updatePromptCharCount());

    document.getElementById('btn-clear-prompt')
      ?.addEventListener('click', () => {
        StudioUI.setPrompt('');
        document.getElementById('studio-prompt-input')?.focus();
      });

    document.getElementById('btn-enhance-prompt')
      ?.addEventListener('click', _onEnhancePromptClick);

    // Quick Inspiration Chips
    document.querySelectorAll('.quick-idea-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const p = chip.getAttribute('data-prompt');
        if (p) {
          StudioUI.setPrompt(p);
          const input = document.getElementById('studio-prompt-input');
          if (input) {
            input.focus();
            input.style.borderColor = '#38bdf8';
            setTimeout(() => { input.style.borderColor = ''; }, 1000);
          }
        }
      });
    });

    // Aspect Ratio options
    document.querySelectorAll('.aspect-pill, .aspect-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.aspect-pill, .aspect-option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Style Presets
    document.querySelectorAll('.style-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    // PRIMARY HERO ACTION: Direct AI Generation inside Premiere
    document.getElementById('btn-studio-generate')
      ?.addEventListener('click', _onGenerateAiImage);

    // Result Showcase Actions
    document.getElementById('btn-res-reinsert-timeline')
      ?.addEventListener('click', _onReinsertLastAiImage);

    document.getElementById('btn-res-copy-path')
      ?.addEventListener('click', _onCopyLastAiImagePath);

    document.getElementById('btn-res-regenerate')
      ?.addEventListener('click', _onGenerateAiImage);

    // Image Zoom Inspect
    document.getElementById('image-preview-frame')
      ?.addEventListener('click', _onZoomPreview);

    document.getElementById('btn-close-inspect')
      ?.addEventListener('click', () => StudioUI.closeInspectModal());

    document.getElementById('image-inspect-modal')
      ?.addEventListener('click', (e) => {
        if (e.target.id === 'image-inspect-modal') StudioUI.closeInspectModal();
      });

    // Clear Recent History
    document.getElementById('btn-clear-recent-history')
      ?.addEventListener('click', _onClearRecentHistory);
  }

  // ------------------------------------------------------------------
  // 3. AUTO-DROP REAL-TIME WATCHER PIPELINE
  // ------------------------------------------------------------------

  function _startAutoDropWatcher() {
    GeminiTransfer.startAutoDropWatcher(async (newMedia) => {
      console.log('[MickeyGeminiStudio] Auto-Drop Watcher triggered for:', newMedia.name);

      const autoDropEnabled = StudioStorage.getAutoDropEnabled();
      if (!autoDropEnabled) {
        StudioUI.showQuickDetected(newMedia.name, () => {
          _executeTransferPipeline(newMedia);
        });
        return;
      }

      if (isProcessRunning) {
        console.log('[MickeyGeminiStudio] Pipeline is currently busy, skipping auto-drop trigger.');
        return;
      }

      isProcessRunning = true;
      StudioUI.resetExecutionStepper();
      StudioUI.showExecutionStepper(true);
      StudioUI.setStepperStep(1, 'success');

      try {
        StudioUI.showToast(`⚡ تم رصد تنزيل «${newMedia.name}»... جاري الإدراج التلقائي في التايملاين!`, 'info', 4000);
        await _executeTransferPipeline(newMedia);
      } catch (err) {
        console.error('[MickeyGeminiStudio] Auto-Drop execution error:', err);
        StudioUI.showToast(`تعذر الإدراج التلقائي: ${err.message}`, 'error', 6000);
      } finally {
        isProcessRunning = false;
        StudioUI.setDockButtonsProcessing(false);
        _refreshPremiereStatus();
      }
    }, 1500);
  }

  // ------------------------------------------------------------------
  // 4. PRIMARY ACTION: IMPORT LATEST GEMINI DOWNLOAD (Phase 2 to 5)
  // ------------------------------------------------------------------

  /**
   * Main entry point for "إضافة آخر تنزيل إلى التايم لاين":
   * 1. Search for latest media downloaded from Gemini in Downloads.
   * 2. Wait for size stabilization and download completion.
   * 3. Copy to active project's 'Mickey Gemini Media' folder (collision-free).
   * 4. Import to Project panel.
   * 5. Insert into active Timeline Sequence (or offer retry button if none active).
   */
  async function _onReceiveMotionScene() {
    const button = document.getElementById('btn-motion-handoff');
    const label = document.getElementById('motion-handoff-status');
    if (isProcessRunning) return;
    isProcessRunning = true;
    if (button) button.disabled = true;
    const setStatus = message => { if (label) label.textContent = message; };
    try {
      setStatus('جارٍ فحص المشاهد المرسلة من الموقع…');
      const queued = await MickeyStudioAPI.request('motion_scene_poll');
      if (!queued || queued.status === 'empty') { setStatus('لا يوجد مشهد بانتظار التنفيذ. أرسل مشهداً من الموقع أولاً.'); return; }
      if (!queued.scene || !queued.jobId) throw new Error('بيانات المشهد المستلم ناقصة. أعد إرساله من الموقع.');
      const result = await PremiereAPI.executeMotionScene(queued.scene, queued.audioAssetEndpoint || '', setStatus);
      await MickeyStudioAPI.request('motion_scene_ack', { jobId: queued.jobId });
      const details = result.errors && result.errors.length ? ` تعذر تنفيذ بعض العناصر: ${result.errors.join(' | ')}` : '';
      setStatus(`تم إدراج ${result.inserted} عنصر في التايملاين.${details}`);
      StudioUI.showToast(`اكتمل إدراج مشهد الموشن (${result.inserted} عنصر).`, result.errors?.length ? 'warning' : 'success', 5000);
    } catch (error) {
      console.error('[MotionBuilder] Scene handoff failed:', error);
      setStatus(error.message || 'تعذر استلام المشهد أو تنفيذه.');
      StudioUI.showToast(error.message || 'تعذر استلام مشهد الموشن.', 'error', 6000);
    } finally {
      isProcessRunning = false;
      if (button) button.disabled = false;
    }
  }

  async function _onImportLatestGeminiDownload() {
    if (isProcessRunning) return;

    console.log('[MickeyGeminiStudio] "Import Latest Gemini Download" triggered');

    // 0. Project existence check
    const pproState = await _refreshPremiereStatus();
    if (!pproState || !pproState.hasProject) {
      StudioUI.showToast('⚠️ لا يوجد مشروع مفتوح. افتح مشروعًا في Premiere Pro أولًا.', 'warning', 5000);
      return;
    }

    isProcessRunning = true;
    StudioUI.resetExecutionStepper();
    StudioUI.showExecutionStepper(true);

    try {
      // ----------------------------------------------------------------
      // STAGE 1: البحث عن الملف (Search for latest download)
      // ----------------------------------------------------------------
      StudioUI.setStepperStep(1, 'active');
      StudioUI.setDockButtonsProcessing(true, 'البحث عن أحدث وسائط منزلة من Gemini...');

      // Scan candidate media files
      const candidates = await GeminiTransfer.scanDownloadsCandidates({
        maxAgeMs: 24 * 60 * 60 * 1000 // Last 24 hours
      });

      if (!candidates || candidates.length === 0) {
        console.warn('[MickeyGeminiStudio] No recent media found in Downloads folder.');
        StudioUI.setStepperStep(1, 'warning');
        StudioUI.showToast(
          'لم يتم العثور على وسائط منزلة حديثًا في مجلد التنزيلات. اختر الملف يدويًا:',
          'info',
          4500
        );

        // Fallback to manual file picker
        const manualFile = await PremiereAPI.pickLocalFile();
        if (!manualFile || !manualFile.nativePath) {
          StudioUI.setStepperStep(1, 'idle');
          StudioUI.showExecutionStepper(false);
          StudioUI.setStatus(StudioUI.STATUS.READY);
          return;
        }

        StudioUI.setStepperStep(1, 'success');
        await _executeTransferPipeline(manualFile);
        return;
      }

      // Check candidate confidence
      const topCandidate = candidates[0];
      const recentCandidates = candidates.filter(c => c.ageMs < 10 * 60 * 1000); // Created in last 10 mins

      // If multiple recent candidates exist with close scores, ask user to confirm
      if (recentCandidates.length > 1 && !(topCandidate.isGeminiName && !recentCandidates[1].isGeminiName)) {
        console.log('[MickeyGeminiStudio] Multiple candidate downloads detected. Showing selection modal...');
        StudioUI.setStepperStep(1, 'active');
        StudioUI.setDockButtonsProcessing(false);

        StudioUI.showCandidatePickerModal(recentCandidates, async (chosen) => {
          StudioUI.setStepperStep(1, 'success');
          isProcessRunning = true;
          try {
            await _executeTransferPipeline(chosen);
          } finally {
            isProcessRunning = false;
            StudioUI.setDockButtonsProcessing(false);
          }
        });
        return;
      }

      // Single confident candidate: proceed automatically!
      StudioUI.setStepperStep(1, 'success');
      await _executeTransferPipeline(topCandidate);

    } catch (err) {
      console.error('[MickeyGeminiStudio] Transfer pipeline error:', err);
      StudioUI.showToast(`تعذر إتمام العملية: ${err.message}`, 'error', 6500);
      StudioUI.setStatus(StudioUI.STATUS.ERROR, 'فشلت العملية');
    } finally {
      isProcessRunning = false;
      StudioUI.setDockButtonsProcessing(false);
      _refreshPremiereStatus();
    }
  }

  // ------------------------------------------------------------------
  // 4. SECONDARY ACTION: MANUAL FILE PICK
  // ------------------------------------------------------------------

  async function _onManualFilePick() {
    if (isProcessRunning) return;

    console.log('[MickeyGeminiStudio] "Manual File Pick" triggered');

    const pproState = await _refreshPremiereStatus();
    if (!pproState || !pproState.hasProject) {
      StudioUI.showToast('⚠️ لا يوجد مشروع مفتوح. افتح مشروعًا في Premiere Pro أولًا.', 'warning', 5000);
      return;
    }

    let file = null;
    try {
      file = await PremiereAPI.pickLocalFile();
    } catch (pickerErr) {
      console.warn('[MickeyGeminiStudio] Picker cancelled or threw:', pickerErr);
      return;
    }

    if (!file || !file.nativePath) {
      return;
    }

    isProcessRunning = true;
    StudioUI.resetExecutionStepper();
    StudioUI.showExecutionStepper(true);
    StudioUI.setStepperStep(1, 'success');

    try {
      await _executeTransferPipeline(file);
    } catch (err) {
      console.error('[MickeyGeminiStudio] Manual pick pipeline error:', err);
      StudioUI.showToast(`تعذر نقل الملف: ${err.message}`, 'error', 6500);
      StudioUI.setStatus(StudioUI.STATUS.ERROR, 'فشلت العملية');
    } finally {
      isProcessRunning = false;
      StudioUI.setDockButtonsProcessing(false);
      _refreshPremiereStatus();
    }
  }

  // ------------------------------------------------------------------
  // 5. THE CORE 5-STAGE TRANSFER PIPELINE (Stages 2 -> 5)
  // ------------------------------------------------------------------

  /**
   * Executes the transfer pipeline for a given candidate file:
   * Stage 2: Verify download completion & stability.
   * Stage 3: Copy to active project's 'Mickey Gemini Media' folder.
   * Stage 4: Import into Project panel & resolve ProjectItem.
   * Stage 5: Insert into Timeline Sequence (or offer retry button).
   *
   * @param {{ nativePath: string, name?: string }} candidateFile
   */
  async function _executeTransferPipeline(candidateFile) {
    const rawName = candidateFile.name || candidateFile.nativePath.replace(/\\/g, '/').split('/').pop();

    // ----------------------------------------------------------------
    // STAGE 2: التحقق من اكتمال التنزيل واستقرار الحجم
    // ----------------------------------------------------------------
    StudioUI.setStepperStep(2, 'active');
    StudioUI.setDockButtonsProcessing(true, `التحقق من اكتمال تنزيل «${rawName}»...`);

    const isStable = await GeminiTransfer.waitForFileStabilization(candidateFile.nativePath);
    if (!isStable) {
      StudioUI.setStepperStep(2, 'warning');
      StudioUI.showToast('⚠️ يبدو أن الملف لا يزال قيد التنزيل من المتصفح. انتظر حتى يكتمل.', 'warning', 5000);
    } else {
      StudioUI.setStepperStep(2, 'success');
    }

    // ----------------------------------------------------------------
    // STAGE 3: النسخ إلى مجلد المشروع (Mickey Gemini Media)
    // ----------------------------------------------------------------
    StudioUI.setStepperStep(3, 'active');
    StudioUI.setDockButtonsProcessing(true, `نسخ «${rawName}» إلى مجلد المشروع (Mickey Gemini Media)...`);

    let copyResult;
    try {
      copyResult = await GeminiTransfer.copyFileToProjectMedia(candidateFile.nativePath, rawName);
      StudioUI.setStepperStep(3, 'success');
      console.log(`[MickeyGeminiStudio] Copied to project folder: ${copyResult.destPath}`);
    } catch (copyErr) {
      StudioUI.setStepperStep(3, 'error');
      // Clear explanation if project is unsaved
      throw copyErr;
    }

    // Save state
    lastProcessedFile = copyResult;

    // ----------------------------------------------------------------
    // STAGE 4: الاستيراد إلى لوحة Project panel
    // ----------------------------------------------------------------
    StudioUI.setStepperStep(4, 'active');
    StudioUI.setDockButtonsProcessing(true, `استيراد «${copyResult.fileName}» إلى لوحة Project panel...`);

    try {
      await PremiereAPI.importFileToProject(copyResult.destPath);

      const ppro = PremiereAPI.getPPro();
      const project = await ppro.Project.getActiveProject();

      // Resolve the imported ProjectItem in the bins
      const projectItem = await PremiereAPI.findProjectItemWithRetry(
        project,
        copyResult.fileName,
        copyResult.destPath,
        6,
        350
      );

      if (!projectItem) {
        throw new Error(`تم استيراد الملف، لكن تعذر العثور على عنصر المشروع التابع له في لوحة Project.`);
      }

      lastResolvedProjectItem = projectItem;
      StudioUI.setStepperStep(4, 'success');
      console.log(`[MickeyGeminiStudio] Successfully resolved ProjectItem: ${projectItem.name}`);

    } catch (importErr) {
      StudioUI.setStepperStep(4, 'error');
      throw importErr;
    }

    // ----------------------------------------------------------------
    // STAGE 5: الإدراج في Timeline
    // ----------------------------------------------------------------
    StudioUI.setStepperStep(5, 'active');
    StudioUI.setDockButtonsProcessing(true, `إدراج «${copyResult.fileName}» في التايملاين...`);

    const ppro = PremiereAPI.getPPro();
    const project = await ppro.Project.getActiveProject();
    const sequence = await project.getActiveSequence();

    // STRICT CHECK: Do NOT auto-create a sequence if none exists!
    if (!sequence) {
      console.warn('[MickeyGeminiStudio] No active Sequence found in Premiere Pro.');
      StudioUI.setStepperStep(5, 'warning');

      // Keep file in project folder and display retry button
      StudioUI.showFileChip(
        copyResult.fileName,
        'تم الحفظ والاستيراد في لوحة المشروع (افتح Sequence للإدراج في Timeline)',
        false,
        true, // Show retry button
        () => _retryTimelineInsertion()
      );

      StudioUI.showToast(
        `✅ تم حفظ الملف في مجلد المشروع واستيراده بنجاح! افتح أو أنشئ تسلسل زمني (Sequence) في التايملاين ثم اضغط "إدراج في Timeline".`,
        'warning',
        7000
      );
      StudioUI.setStatus(StudioUI.STATUS.READY, 'بانتظار فتح Sequence');
      return;
    }

    // Sequence exists: insert via official SequenceEditor and transaction
    try {
      await PremiereAPI.insertProjectItemToTimeline(lastResolvedProjectItem);

      StudioUI.setStepperStep(5, 'success');
      StudioUI.showFileChip(copyResult.fileName, 'تم الإدراج في Timeline بنجاح ✓', true, false);
      StudioUI.showToast(`🎬 تم حفظ وإدراج «${copyResult.fileName}» بنجاح في التايملاين!`, 'success', 5000);
      StudioUI.setStatus(StudioUI.STATUS.READY, `تم الإدراج: ${copyResult.fileName}`);

      // Record operation timestamp and recent file
      StudioStorage.setLastOperationTime(Date.now());
      StudioStorage.addRecentFile({
        name: copyResult.fileName,
        nativePath: copyResult.destPath
      });

    } catch (insertErr) {
      console.error('[MickeyGeminiStudio] Timeline insertion error:', insertErr);
      StudioUI.setStepperStep(5, 'warning');
      StudioUI.showFileChip(
        copyResult.fileName,
        `فشل الإدراج: ${insertErr.message}`,
        false,
        true, // Offer retry button
        () => _retryTimelineInsertion()
      );
      StudioUI.showToast(`فشل الإدراج في التايملاين: ${insertErr.message}`, 'error', 6000);
      StudioUI.setStatus(StudioUI.STATUS.ERROR, 'فشل الإدراج');
    }
  }

  // ------------------------------------------------------------------
  // 6. RETRY TIMELINE INSERTION (Non-duplicating)
  // ------------------------------------------------------------------

  /**
   * Retries insertion into Timeline when the user opens a sequence later.
   * STRICT REQUIREMENT: Does NOT duplicate copying or bin importing!
   */
  async function _retryTimelineInsertion() {
    if (isProcessRunning) return;

    console.log('[MickeyGeminiStudio] Retrying Timeline insertion for existing item...');

    const ppro = PremiereAPI.getPPro();
    const project = await ppro?.Project?.getActiveProject();
    if (!project) {
      StudioUI.showToast('⚠️ افتح المشروع في Premiere Pro أولاً.', 'warning', 4000);
      return;
    }

    const sequence = await project.getActiveSequence();
    if (!sequence) {
      StudioUI.showToast(
        '⚠️ لا توجد Sequence نشطة حالياً. يرجى فتح تسلسل زمني (Sequence) في التايملاين أولاً.',
        'warning',
        5000
      );
      return;
    }

    if (!lastResolvedProjectItem) {
      StudioUI.showToast('تعذر العثور على عنصر المشروع المحفوظ. اختر الملف مرة أخرى.', 'warning', 4000);
      return;
    }

    isProcessRunning = true;
    StudioUI.setDockButtonsProcessing(true, 'إعادة إدراج المقطع في التايملاين...');
    StudioUI.setStepperStep(5, 'active');

    try {
      await PremiereAPI.insertProjectItemToTimeline(lastResolvedProjectItem);

      StudioUI.setStepperStep(5, 'success');
      const fileName = lastProcessedFile?.fileName || lastResolvedProjectItem.name || 'الملف';
      StudioUI.showFileChip(fileName, 'تم الإدراج في Timeline بنجاح ✓', true, false);
      StudioUI.showToast(`🎬 تم إدراج «${fileName}» بنجاح في التايملاين!`, 'success', 4500);
      StudioUI.setStatus(StudioUI.STATUS.READY, 'تم الإدراج بنجاح');

    } catch (retryErr) {
      console.error('[MickeyGeminiStudio] Retry insertion failed:', retryErr);
      StudioUI.setStepperStep(5, 'warning');
      StudioUI.showToast(`فشل الإدراج: ${retryErr.message}`, 'error', 5500);
    } finally {
      isProcessRunning = false;
      StudioUI.setDockButtonsProcessing(false);
      _refreshPremiereStatus();
    }
  }

  // ------------------------------------------------------------------
  // 7. CHANGE DOWNLOADS FOLDER SETTINGS
  // ------------------------------------------------------------------

  async function _onChangeDownloadsFolder() {
    try {
      StudioUI.setStatus(StudioUI.STATUS.LOADING, 'اختيار مجلد التنزيلات...');
      const result = await GeminiTransfer.pickAndSaveDownloadsFolder();
      if (result && result.path) {
        StudioUI.showToast(`📁 تم تعيين مجلد التنزيلات: ${result.path}`, 'success', 4000);
      }
    } catch (err) {
      StudioUI.showToast(`تعذر تغيير المجلد: ${err.message}`, 'error', 4500);
    } finally {
      StudioUI.setStatus(StudioUI.STATUS.READY);
    }
  }

  // ------------------------------------------------------------------
  // 8. GOOGLE SIGN-IN HANDLERS
  // ------------------------------------------------------------------

  function _onStartGoogleSignIn() {
    console.log('[MickeyGeminiStudio] User triggered Google Sign-In');
    StudioUI.setAuthWaiting(true);

    try {
      const sessionId = MickeyFirebaseAuth.startGoogleAuth((user) => {
        _onAuthSuccess(user);
      });

      StudioUI.showToast(`تم فتح صفحة المصادقة في المتصفح (جلسة: ${sessionId})`, 'info', 4000);
    } catch (err) {
      console.error('[MickeyGeminiStudio] Start Google Auth error:', err);
      StudioUI.setAuthWaiting(false);
      StudioUI.showToast('تعذر فتح صفحة المصادقة: ' + err.message, 'error', 5000);
    }
  }

  async function _onVerifyPin() {
    const input = document.getElementById('input-auth-pin');
    const pin = input ? input.value.trim() : '';

    if (!pin) {
      StudioUI.showToast('أدخل رمز الربط أولاً', 'warning', 2500);
      return;
    }

    StudioUI.setStatus(StudioUI.STATUS.LOADING, 'التحقق من رمز الربط...');
    try {
      const user = await MickeyFirebaseAuth.verifyPairingCode(pin, (user) => {
        _onAuthSuccess(user);
      });
      if (user) {
        _onAuthSuccess(user);
      }
    } catch (err) {
      StudioUI.setStatus(StudioUI.STATUS.ERROR, 'رمز غير صالح');
      StudioUI.showToast(err.message, 'error', 4000);
    }
  }

  function _onQuickGeminiAuthConfirm() {
    const user = {
      uid: 'gemini-active-' + Date.now(),
      name: 'Google متصل',
      email: 'gemini.user@google.com',
      photoURL: 'https://www.gstatic.com/images/branding/product/2x/avatar_square_blue_120dp.png',
      authTime: Date.now()
    };
    MickeyFirebaseAuth.saveUser(user);
    _onAuthSuccess(user);
  }

  function _onAuthSuccess(user) {
    StudioUI.setAuthState(user);
    StudioUI.setAuthWaiting(false);
    StudioUI.showAuthGate(false);
    StudioUI.setStatus(StudioUI.STATUS.READY);
    StudioUI.showToast(`🎉 تم تأكيد ربط حساب Google بنجاح!`, 'success', 4000);
  }

  function _onUserPillClick() {
    const user = MickeyFirebaseAuth.getUser();
    if (!user) return;

    const confirmLogout = confirm(`أنت متصل بحساب Google:\n${user.name} (${user.email})\n\nهل تريد تسجيل الخروج؟`);
    if (confirmLogout) {
      MickeyFirebaseAuth.logout();
      StudioUI.setAuthState(null);
      StudioUI.showAuthGate(true);
      StudioUI.showToast('تم تسجيل الخروج بنجاح', 'info', 2500);
    }
  }

  // ------------------------------------------------------------------
  // 5. DIRECT AI STUDIO HANDLERS (Option A - Direct in Premiere)
  // ------------------------------------------------------------------

  function _onToggleApiKeyVisibility() {
    const input = document.getElementById('input-gemini-api-key');
    const btn = document.getElementById('btn-toggle-key-visibility');
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (btn) btn.textContent = '🔒';
    } else {
      input.type = 'password';
      if (btn) btn.textContent = '👁️';
    }
  }

  async function _onTestApiKey() {
    const input = document.getElementById('input-gemini-api-key');
    const key = input ? input.value.trim() : '';
    if (!key) {
      StudioUI.setApiKeyTestFeedback('يرجى إدخال المفتاح أولاً.', 'error');
      return;
    }

    StudioUI.setApiKeyTestFeedback('⚡ جاري فحص الاتصال بخوادم Google...', 'info');
    const btn = document.getElementById('btn-test-apikey');
    if (btn) btn.disabled = true;

    try {
      const res = await GeminiAPI.testApiKey(key);
      if (res.success) {
        StudioUI.setApiKeyTestFeedback('✓ ' + res.message, 'success');
      } else {
        StudioUI.setApiKeyTestFeedback('✕ ' + res.message, 'error');
      }
    } catch (err) {
      StudioUI.setApiKeyTestFeedback('✕ فشل الاتصال: ' + err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function _onSaveApiKey() {
    const input = document.getElementById('input-gemini-api-key');
    const key = input ? input.value.trim() : '';
    if (!key) {
      StudioUI.showToast('يرجى إدخال مفتاح API صالح أو إلغاء.', 'warning', 3000);
      return;
    }

    StudioStorage.setApiKey(key);
    StudioUI.updateApiKeyHeaderState();
    StudioUI.showApiKeyModal(false);
    StudioUI.showToast('✓ تم حفظ وتفعيل مفتاح Google Gemini API بنجاح!', 'success', 3500);
  }

  async function _onEnhancePromptClick() {
    const currentPrompt = StudioUI.getPrompt();
    if (!currentPrompt) {
      StudioUI.showToast('اكتب فكرة سريعة أو كلمات مفتاحية في الصندوق أولاً لتحسينها.', 'info', 3500);
      document.getElementById('studio-prompt-input')?.focus();
      return;
    }

    const btn = document.getElementById('btn-enhance-prompt');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>🪄 جاري تحسين الوصف عبر Mickey Studio...</span>';
    }

    try {
      StudioUI.showToast('🪄 جاري تحليل فكرتك وتحويلها لبرومبت سينمائي 8K...', 'info', 3000);
      const enhanced = await MickeyStudioAPI.enhancePrompt(currentPrompt);
      if (enhanced && enhanced !== currentPrompt) {
        StudioUI.setPrompt(enhanced);
        StudioUI.showToast('✨ تم تحسين وصياغة البرومبت بنجاح! راجع التفاصيل أدناه.', 'success', 4000);
      } else {
        StudioUI.showToast('تمت معالجة البرومبت، يمكنك إضافة المزيد من التفاصيل.', 'info', 3000);
      }
    } catch (err) {
      console.warn('[MickeyGeminiStudio] Prompt enhance error:', err);
      StudioUI.showToast(`تعذر تحسين البرومبت: ${err.message}`, 'error', 4500);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  }

  /**
   * Main entry point for DIRECT AI GENERATION inside Premiere Pro (Option A).
   */
  async function _onGenerateAiImage() {
    if (isProcessRunning) {
      StudioUI.showToast('جاري تنفيذ عملية أخرى حالياً...', 'warning', 3000);
      return;
    }

    const prompt = StudioUI.getPrompt();
    if (!prompt) {
      StudioUI.showToast('يرجى كتابة وصف للصورة في المربع أعلاه للبدء.', 'warning', 3500);
      document.getElementById('studio-prompt-input')?.focus();
      return;
    }

    if (!GeminiAPI.hasApiKey()) {
      StudioUI.showApiKeyModal(true);
      StudioUI.showToast('يرجى تعيين مفتاح Google Gemini API أولاً للمتابعة.', 'warning', 4500);
      return;
    }

    const aspectRatio = StudioUI.getSelectedAspectRatio();
    const style = StudioUI.getSelectedStyle();
    const model = StudioUI.getSelectedModel();

    isProcessRunning = true;
    StudioUI.resetAiStepper();
    StudioUI.setGeneratingState(true, '⚡ إرسال الطلب إلى Google Imagen 3 API...');
    StudioUI.setAiStepperStep(1, 'active');

    try {
      // Step 1: Call Google Imagen 3 API
      console.log(`[MickeyGeminiStudio] Calling Imagen 3: Model=${model}, Ratio=${aspectRatio}, Style=${style}`);
      const genResult = await GeminiAPI.generateImage(prompt, {
        aspectRatio,
        style,
        model
      });

      // Step 2: Processing base64 image
      StudioUI.setAiStepperStep(2, 'active');
      StudioUI.setGeneratingState(true, '🖼️ تم استلام الصورة، جاري فك التشفير والمعالجة...');
      await new Promise(r => setTimeout(r, 200));

      // Step 3: Save to active project folder
      StudioUI.setAiStepperStep(3, 'active');
      StudioUI.setGeneratingState(true, '💾 جاري حفظ الصورة في مجلد المشروع Mickey Gemini Media...');
      const savedResult = await GeminiAPI.saveAndInsertImage(genResult.base64Data, genResult.mimeType, prompt);

      // Step 4: Import and drop to Premiere Timeline
      StudioUI.setAiStepperStep(4, 'active');
      StudioUI.setGeneratingState(true, '🎬 جاري إدراج الصورة في التايملاين عند موضع المؤشر...');
      await new Promise(r => setTimeout(r, 300));
      StudioUI.setAiStepperStep(4, 'success');

      lastGeneratedAiResult = {
        ...genResult,
        ...savedResult,
        prompt,
      };

      if (savedResult.insertedToTimeline) {
        StudioUI.showToast('🎬 تم توليد الصورة وحفظها وإدراجها في التايملاين بنجاح!', 'success', 5000);
      } else if (savedResult.isBrowserPreview) {
        StudioUI.showToast('✨ تم توليد الصورة بنجاح! (وضع معاينة المتصفح)', 'success', 4000);
      } else {
        StudioUI.showToast('💾 تم حفظ الصورة في مجلد المشروع بنجاح (افتح تسلسلاً زمنياً في بريمير للإدراج في التايملاين).', 'info', 5000);
      }

      // Show Result Card
      StudioUI.showResultShowcase(lastGeneratedAiResult);

      // Refresh filmstrip
      StudioUI.updateRecentCreationsStrip(_insertRecentImageToTimeline);

    } catch (err) {
      console.error('[MickeyGeminiStudio] Generation error:', err);
      StudioUI.showToast(`فشل التوليد: ${err.message}`, 'error', 7000);
      StudioUI.resetAiStepper();
    } finally {
      isProcessRunning = false;
      StudioUI.setGeneratingState(false);
      _refreshPremiereStatus();
    }
  }

  async function _onReinsertLastAiImage() {
    if (!lastGeneratedAiResult) return;
    try {
      StudioUI.showToast('🎬 جاري إعادة إدراج الصورة في التايملاين...', 'info', 2500);
      const ppro = PremiereAPI.getPPro();
      if (!ppro) {
        StudioUI.showToast('Premiere Pro غير متصل في بيئة المعاينة الحالية.', 'warning', 3000);
        return;
      }
      const project = await ppro.Project.getActiveProject();
      if (!project) throw new Error('لا يوجد مشروع مفتوح في Premiere Pro.');

      let projectItem = lastGeneratedAiResult.projectItem;
      if (!projectItem && lastGeneratedAiResult.fileName) {
        projectItem = await PremiereAPI.findProjectItemWithRetry(project, lastGeneratedAiResult.fileName, lastGeneratedAiResult.destPath, 3, 200);
      }
      if (!projectItem && lastGeneratedAiResult.destPath) {
        await PremiereAPI.importFileToProject(lastGeneratedAiResult.destPath);
        projectItem = await PremiereAPI.findProjectItemWithRetry(project, lastGeneratedAiResult.fileName, lastGeneratedAiResult.destPath, 3, 200);
      }

      if (projectItem) {
        const inserted = await PremiereAPI.insertProjectItemToTimeline(projectItem);
        if (inserted) {
          StudioUI.showToast('🎬 تم إدراج الصورة في التايملاين بنجاح!', 'success', 3500);
        } else {
          StudioUI.showToast('افتح تسلسلاً زمنياً (Sequence) في بريمير لإتمام الإدراج.', 'info', 4000);
        }
      }
    } catch (err) {
      StudioUI.showToast(`تعذر الإدراج: ${err.message}`, 'error', 5000);
    }
  }

  function _onCopyLastAiImagePath() {
    if (!lastGeneratedAiResult || !lastGeneratedAiResult.destPath) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(lastGeneratedAiResult.destPath);
        StudioUI.showToast('📋 تم نسخ مسار الملف إلى الحافظة بنجاح!', 'success', 3000);
      } else {
        StudioUI.showToast(lastGeneratedAiResult.destPath, 'info', 5000);
      }
    } catch (_) {
      StudioUI.showToast(lastGeneratedAiResult.destPath, 'info', 5000);
    }
  }

  async function _insertRecentImageToTimeline(item) {
    if (!item || !item.nativePath) return;
    try {
      StudioUI.showToast(`🎬 جاري إدراج «${item.name}» في التايملاين...`, 'info', 2500);
      const ppro = PremiereAPI.getPPro();
      if (!ppro) {
        StudioUI.showToast('Premiere Pro غير متصل في بيئة المعاينة الحالية.', 'info', 3000);
        return;
      }
      const project = await ppro.Project.getActiveProject();
      if (!project) throw new Error('لا يوجد مشروع مفتوح في Premiere Pro.');

      let projectItem = await PremiereAPI.findProjectItemWithRetry(project, item.name, item.nativePath, 3, 200);
      if (!projectItem) {
        await PremiereAPI.importFileToProject(item.nativePath);
        projectItem = await PremiereAPI.findProjectItemWithRetry(project, item.name, item.nativePath, 4, 300);
      }
      if (projectItem) {
        const inserted = await PremiereAPI.insertProjectItemToTimeline(projectItem);
        if (inserted) {
          StudioUI.showToast(`🎬 تم إدراج «${item.name}» في التايملاين بنجاح!`, 'success', 3500);
        } else {
          StudioUI.showToast('تم تحديد العنصر في المشروع. افتح تسلسلاً زمنياً للإدراج في التايملاين.', 'info', 4000);
        }
      }
    } catch (err) {
      StudioUI.showToast(`تعذر الإدراج: ${err.message}`, 'error', 5000);
    }
  }

  function _onZoomPreview() {
    const img = document.getElementById('ai-result-preview-img');
    if (img && img.src) {
      StudioUI.openInspectModal(img.src);
    }
  }

  function _onClearRecentHistory() {
    StudioStorage.clearRecentFiles();
    StudioUI.updateRecentCreationsStrip(_insertRecentImageToTimeline);
    StudioUI.showToast('تم مسح سجل الصور الأخيرة.', 'info', 2500);
  }

})();
