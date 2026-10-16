/**
 * premiere-api.js — Mickey Gemini Studio for Adobe Premiere Pro
 *
 * Wraps all interactions with the Premiere Pro UXP API and UXP Storage.
 * Target: Premiere Pro 25.6+ (Official UXP DOM API)
 *
 * Rules:
 * - Official documented APIs only.
 * - Project mutations execute inside lockedAccess + executeTransaction.
 * - Timeline insertion requires an active sequence; scene import creates one when needed.
 *
 * References:
 *   https://developer.adobe.com/premiere-pro/uxp/ppro_reference/
 *   https://developer.adobe.com/premiere-pro/uxp/ppro_reference/api/project/
 *   https://developer.adobe.com/premiere-pro/uxp/ppro_reference/api/sequenceeditor/
 */

'use strict';

const PremiereAPI = (() => {
  // ------------------------------------------------------------------
  // 1. MODULE & STORAGE ACCESS
  // ------------------------------------------------------------------

  function _getPProModule() {
    try {
      const ppro = require('premierepro');
      if (!ppro) throw new Error('Module premierepro returned null/undefined');
      return ppro;
    } catch (err) {
      console.warn('[PremiereAPI] premierepro module unavailable:', err.message);
      return null;
    }
  }

  function _getUxpStorage() {
    try {
      const uxp = require('uxp');
      if (!uxp || !uxp.storage) throw new Error('uxp.storage unavailable');
      return uxp.storage;
    } catch (err) {
      console.warn('[PremiereAPI] UXP storage unavailable:', err.message);
      return null;
    }
  }

  // Supported media extensions accepted by Premiere Pro
  const SUPPORTED_MEDIA_TYPES = [
    // Video
    'mp4', 'mov', 'avi', 'mkv', 'mxf', 'wmv', 'm4v', 'prores',
    // Images
    'png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff', 'tif', 'bmp', 'psd', 'tga',
    // Audio
    'mp3', 'wav', 'aac', 'aiff', 'm4a', 'flac'
  ];

  // ------------------------------------------------------------------
  // 2. DIAGNOSTICS & STATE
  // ------------------------------------------------------------------

  /**
   * Retrieves live Premiere Pro project & sequence state without side effects.
   */
  async function getPremiereState() {
    const state = {
      isAvailable: false,
      hasProject: false,
      projectName: null,
      hasSequence: false,
      sequenceName: null,
      sequenceEditorSupported: false,
      rawVersion: null,
      error: null,
    };

    const ppro = _getPProModule();
    if (!ppro) {
      state.error = 'تطبيق Premiere Pro أو واجهة UXP غير متصلة';
      return state;
    }

    state.isAvailable = true;

    try {
      if (ppro.Application && typeof ppro.Application.getVersion === 'function') {
        state.rawVersion = await ppro.Application.getVersion();
      }
    } catch (_) {}

    try {
      if (!ppro.Project || typeof ppro.Project.getActiveProject !== 'function') {
        state.error = 'واجهة ppro.Project غير مدعومة';
        return state;
      }

      const project = await ppro.Project.getActiveProject();
      if (!project) {
        state.error = 'لا يوجد مشروع مفتوح حالياً في Premiere Pro';
        return state;
      }

      state.hasProject = true;
      state.projectName = project.name || 'مشروع بدون اسم';

      const sequence = await project.getActiveSequence();
      if (sequence) {
        state.hasSequence = true;
        state.sequenceName = sequence.name || 'Sequence نشطة';
      }

      if (ppro.SequenceEditor && typeof ppro.SequenceEditor.getEditor === 'function') {
        state.sequenceEditorSupported = true;
      }
    } catch (err) {
      state.error = err.message;
    }

    return state;
  }

  // ------------------------------------------------------------------
  // 3. FILE PICKER (Single & Multiple Files)
  // ------------------------------------------------------------------

  /**
   * Opens OS file picker allowing multiple selection.
   * @returns {Promise<Array<{ nativePath: string, name: string }>>}
   */
  async function pickLocalFiles() {
    console.log('[PremiereAPI] pickLocalFiles() called');

    const uxpStorage = _getUxpStorage();
    if (!uxpStorage) {
      throw new Error('واجهة UXP Storage غير متاحة. تأكد من تشغيل الإضافة داخل Premiere Pro.');
    }

    const { localFileSystem, domains } = uxpStorage;
    if (!localFileSystem || typeof localFileSystem.getFileForOpening !== 'function') {
      throw new Error('localFileSystem.getFileForOpening غير متاحة في بيئة التشغيل الحالية.');
    }

    let result;
    try {
      const startDomain = domains.userDownloads || domains.userDesktop || domains.userDocuments;
      result = await localFileSystem.getFileForOpening({
        initialDomain: startDomain,
        types: SUPPORTED_MEDIA_TYPES,
        allowMultiple: true,
      });
    } catch (pickerErr) {
      console.warn('[PremiereAPI] File picker cancelled or threw:', pickerErr.message);
      return [];
    }

    if (!result) {
      console.log('[PremiereAPI] File picker cancelled by user.');
      return [];
    }

    // Normalize output to array of objects
    const list = Array.isArray(result) ? result : [result];
    const validFiles = list.filter(f => f && typeof f.nativePath === 'string' && f.nativePath.trim().length > 0);

    console.log(`[PremiereAPI] Selected ${validFiles.length} file(s).`);
    return validFiles;
  }

  /**
   * Backward-compatible single file picker.
   * @returns {Promise<{ nativePath: string, name: string } | null>}
   */
  async function pickLocalFile() {
    const files = await pickLocalFiles();
    return files.length > 0 ? files[0] : null;
  }

  // ------------------------------------------------------------------
  // 4. IMPORT FILES TO PROJECT PANEL
  // ------------------------------------------------------------------

  /**
   * Imports multiple files into the active Premiere Pro project.
   *
   * @param {string[]} nativePaths - Array of absolute OS file paths.
   * @param {object} [targetBin=null] - Optional destination Bin.
   * @returns {Promise<{ success: boolean, importedCount: number, failedCount: number }>}
   */
  async function importFilesToProject(nativePaths, targetBin = null) {
    if (!Array.isArray(nativePaths) || nativePaths.length === 0) {
      throw new Error('لم يتم تحديد أي مسارات ملفات للاستيراد.');
    }

    console.log('[PremiereAPI] importFilesToProject() starting for:', nativePaths);

    const ppro = _getPProModule();
    if (!ppro) {
      throw new Error('لا يمكن الوصول إلى واجهة Premiere Pro API. تأكد من تشغيل الإضافة داخل البرنامج.');
    }

    const project = await ppro.Project?.getActiveProject();
    if (!project) {
      throw new Error('لا يوجد مشروع مفتوح. يرجى فتح مشروع في Premiere Pro أولاً.');
    }

    if (typeof project.importFiles !== 'function') {
      throw new Error('دالة project.importFiles() غير متاحة. تتطلب هذه الميزة Premiere Pro 25.6 أو أحدث.');
    }

    // Filter and sanitize paths
    const cleanPaths = nativePaths
      .filter(p => typeof p === 'string' && p.trim().length > 0)
      .map(p => p.trim());

    if (cleanPaths.length === 0) {
      throw new Error('مسارات الملفات المحددة غير صالحة.');
    }

    let success = false;
    try {
      // Official signature: project.importFiles(filePaths[], suppressUI, targetBin, asNumberedStills)
      success = await project.importFiles(cleanPaths, true, targetBin || null, false);
    } catch (importErr) {
      console.warn('[PremiereAPI] project.importFiles with 4 params failed, trying fallback with 2 params:', importErr.message);
      try {
        success = await project.importFiles(cleanPaths, true);
      } catch (fallbackErr) {
        console.error('[PremiereAPI] project.importFiles fallback completely failed:', fallbackErr);
        throw new Error(`فشل استيراد الملفات: ${fallbackErr.message || importErr.message}`);
      }
    }

    // In some Premiere Pro versions, importFiles returns undefined or void on success
    const isSuccess = success !== false;
    console.log('[PremiereAPI] importFiles returned:', success, 'Resolved status:', isSuccess);

    return {
      success: isSuccess,
      importedCount: cleanPaths.length,
      failedCount: isSuccess ? 0 : cleanPaths.length,
    };
  }

  /**
   * Imports a single file into the project.
   * @param {string} nativePath
   * @param {object} [targetBin=null]
   * @returns {Promise<boolean>}
   */
  async function importFileToProject(nativePath, targetBin = null) {
    const res = await importFilesToProject([nativePath], targetBin);
    return res.success;
  }

  // ------------------------------------------------------------------
  // 5. PROJECT ITEM RESOLUTION (Recursive Bin Search)
  // ------------------------------------------------------------------

  /**
   * Recursively finds a ProjectItem in the active project by filename or nativePath.
   *
   * @param {object} project - Active Project instance.
   * @param {string} fileName - File name to search for.
   * @param {string} [nativePath=null] - Optional native path for exact matching.
   * @returns {Promise<object|null>} ProjectItem or null.
   */
  async function findProjectItemByName(project, fileName, nativePath = null) {
    if (!project || !fileName) return null;

    try {
      const ppro = _getPProModule();
      const activeProject = await ppro?.Project?.getActiveProject() || project;
      const rootItem = await activeProject.getRootItem();
      if (!rootItem) return null;

      const cleanTargetName = String(fileName).trim().toLowerCase();
      const baseNameWithoutExt = cleanTargetName.replace(/\.[^/.]+$/, '');
      const normNativePath = nativePath ? nativePath.replace(/\\/g, '/').toLowerCase() : null;
      function asFolderItem(item) {
        if (!item) return null;
        if (typeof item.getItems === 'function') return item;
        try {
          const folder = ppro?.FolderItem?.cast?.(item);
          return folder && typeof folder.getItems === 'function' ? folder : null;
        } catch (_) { return null; }
      }

      // PASS 1: Fast Name Match (Zero IPC calls to getMediaPath, reversed to check newly imported items first!)
      async function _fastNameSearch(container) {
        const folder = asFolderItem(container);
        if (!folder) return null;
        let items = null;
        try { items = await folder.getItems(); } catch (_) { return null; }
        if (!items || !items.length) return null;

        // Traverse in reverse: Premiere Pro places newly imported items at the end of the items list!
        for (let i = items.length - 1; i >= 0; i--) {
          const item = items[i];
          if (!item) continue;
          const itemName = item.name ? String(item.name).trim().toLowerCase() : '';
          const itemBase = itemName.replace(/\.[^/.]+$/, '');
          if (itemName === cleanTargetName || itemBase === baseNameWithoutExt) {
            return item;
          }
          if (asFolderItem(item)) {
            const childMatch = await _fastNameSearch(item);
            if (childMatch) return childMatch;
          }
        }
        return null;
      }

      const match = await _fastNameSearch(rootItem);
      if (match) return match;

      // PASS 2: Path match ONLY if name match failed and nativePath provided (leaf clips only, capped to avoid IPC lag)
      if (normNativePath) {
        let inspectedCount = 0;
        async function _pathSearch(container) {
          const folder = asFolderItem(container);
          if (!folder) return null;
          let items = null;
          try { items = await folder.getItems(); } catch (_) { return null; }
          if (!items || !items.length) return null;

          // Check recently imported items first (reverse order)
          for (let i = items.length - 1; i >= 0; i--) {
            if (++inspectedCount > 40) return null; // Cap inspection to prevent UI freeze
            const item = items[i];
            if (!item) continue;
            const childFolder = asFolderItem(item);
            if (!childFolder) {
              try {
                let p = null;
                if (typeof item.getMediaPath === 'function') p = await item.getMediaPath();
                else if (item.mediaPath) p = item.mediaPath;
                if (p && String(p).replace(/\\/g, '/').toLowerCase() === normNativePath) {
                  return item;
                }
              } catch (_) {}
            } else {
              const childMatch = await _pathSearch(childFolder);
              if (childMatch) return childMatch;
            }
          }
          return null;
        }
        return await _pathSearch(rootItem);
      }

      return null;
    } catch (err) {
      console.warn('[PremiereAPI] findProjectItemByName error:', err);
      return null;
    }
  }

  /**
   * Searches for a ProjectItem with short retries, allowing Premiere's async media update to settle.
   */
  async function findProjectItemWithRetry(project, fileName, nativePath = null, maxRetries = 5, delayMs = 150) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const item = await findProjectItemByName(project, fileName, nativePath);
      if (item) return item;

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // 6. TIMELINE INSERTION (Active Sequence & Transaction Lock)
  // ------------------------------------------------------------------

  /**
   * Inserts a ProjectItem into the active Sequence Timeline.
   *
   * REQUIREMENTS ENFORCED:
   * - Must have an open project.
   * - Must have an active Sequence.
   * - Uses lockedAccess + executeTransaction for atomic mutation.
   *
   * @param {object} projectItem - ProjectItem from project panel.
   * @param {object} [options]
   * @param {number|null} [options.insertAtSeconds=null] - Specific seconds, or null for playhead.
   * @param {number} [options.videoTrackIndex=0]
   * @param {number} [options.audioTrackIndex=0]
   * @param {boolean} [options.limitShift=true]
   * @param {boolean|null} [options.overwrite=null]
   * @returns {Promise<boolean>}
   */
  async function insertProjectItemToTimeline(projectItem, options = {}) {
    const {
      insertAtSeconds = null,
      videoTrackIndex = 0,
      audioTrackIndex = 0,
      limitShift = true,
      overwrite = null,
    } = options;

    let itemLabel = '';
    try { itemLabel = String(projectItem?.name || ''); } catch (_) {}
    console.log('[PremiereAPI] insertProjectItemToTimeline() initiated for:', itemLabel || 'ProjectItem');

    if (!projectItem) {
      throw new Error('عنصر المشروع (ProjectItem) غير صالح أو غير موجود.');
    }

    const ppro = _getPProModule();
    if (!ppro) {
      throw new Error('لا يمكن الوصول إلى واجهة premierepro API.');
    }

    const project = await ppro.Project?.getActiveProject();
    if (!project) {
      throw new Error('لا يوجد مشروع مفتوح حالياً في Premiere Pro.');
    }

    // 1. Require an active sequence; scene import creates one when needed.
    const sequence = await project.getActiveSequence();
    if (!sequence) {
      throw new Error(
        'لا توجد Sequence نشطة في الـ Timeline. ' +
        'يرجى فتح أو إنشاء تسلسل زمني (Sequence) في التايملاين أولاً قبل الإدراج.'
      );
    }

    // 2. SequenceEditor API verification
    if (!ppro.SequenceEditor || typeof ppro.SequenceEditor.getEditor !== 'function') {
      throw new Error(
        'واجهة SequenceEditor غير مدعومة في إصدار Premiere Pro الحالي. ' +
        'تتطلب هذه الميزة إصدار 25.6 أو أحدث.'
      );
    }

    if (!ppro.TickTime || typeof ppro.TickTime.createWithSeconds !== 'function') {
      throw new Error('واجهة ppro.TickTime غير متاحة في هذا الإصدار.');
    }

    if (typeof project.executeTransaction !== 'function') {
      throw new Error('واجهة project.executeTransaction غير متوفرة في هذا الإصدار.');
    }

    const seqEditor = await ppro.SequenceEditor.getEditor(sequence);
    if (!seqEditor) {
      throw new Error('تعذّر الحصول على أداة التحرير SequenceEditor للـ Sequence النشطة.');
    }

    // Detect audio-only media: audio clips default to overwrite=true
    // This prevents Premiere Pro from performing an unintended full-sequence ripple cut on video tracks!
    const itemName = itemLabel.toLowerCase();
    const isAudioOnly = /\.(wav|mp3|m4a|aac|flac|aif|aiff|ogg)$/i.test(itemName);
    const useOverwrite = overwrite !== null ? overwrite : isAudioOnly;

    // For audio clips, targetVideoTrack MUST be -1 so Premiere does not attempt to resolve non-existent video stream.
    // For video/image clips without audio, targetAudioTrack can be -1.
    const effectiveVideoTrack = isAudioOnly ? -1 : (videoTrackIndex !== undefined && videoTrackIndex !== null ? videoTrackIndex : 0);
    const effectiveAudioTrack = isAudioOnly
      ? (audioTrackIndex !== undefined && audioTrackIndex !== null && audioTrackIndex >= 0 ? audioTrackIndex : 0)
      : (audioTrackIndex !== undefined && audioTrackIndex !== null ? audioTrackIndex : -1);

    console.log(`[PremiereAPI] Effective tracks: video=${effectiveVideoTrack}, audio=${effectiveAudioTrack}, isAudioOnly=${isAudioOnly}, overwrite=${useOverwrite}`);

    // 3. Determine insertion point
    let insertTime = null;
    if (insertAtSeconds !== null && insertAtSeconds !== undefined) {
      insertTime = ppro.TickTime.createWithSeconds(insertAtSeconds);
    } else if (typeof sequence.getPlayerPosition === 'function') {
      try {
        insertTime = await sequence.getPlayerPosition();
      } catch (posErr) {
        console.warn('[PremiereAPI] Could not get player position, fallback to 0s:', posErr);
      }
    }

    if (!insertTime) {
      insertTime = ppro.TickTime.createWithSeconds(0);
    }

    // 4. Atomic Transaction Execution with automatic fallback and retry
    let transactionSuccess = false;
    let transactionError = null;

    const runTransaction = (activeProject, activeEditor, activeItem, activeTime) => {
      let result = false;
      const createAndCommitInsert = () => {
        let insertAction = null;
        if (useOverwrite && typeof activeEditor.createOverwriteItemAction === 'function') {
          try {
            insertAction = activeEditor.createOverwriteItemAction(activeItem, activeTime, effectiveVideoTrack, effectiveAudioTrack);
          } catch (actErr) {
            console.warn('[PremiereAPI] createOverwriteItemAction failed, trying createInsertProjectItemAction:', actErr);
          }
        }
        if (!insertAction && typeof activeEditor.createInsertProjectItemAction === 'function') {
          insertAction = activeEditor.createInsertProjectItemAction(activeItem, activeTime, effectiveVideoTrack, effectiveAudioTrack, limitShift);
        }
        if (!insertAction) {
          throw new Error('فشل إنشاء أمر إدراج المقطع في التايملاين.');
        }
        if (typeof activeProject.executeTransaction === 'function') {
          result = activeProject.executeTransaction(compoundAction => {
            compoundAction.addAction(insertAction);
          }, 'Mickey Studio: Insert Clip');
        } else {
          throw new Error('واجهة تنفيذ معاملات Premiere غير متوفرة.');
        }
      };

      // Adobe requires Action objects to be created while Project.lockedAccess
      // is held; otherwise Premiere can invalidate them before the transaction.
      if (typeof activeProject.lockedAccess === 'function') {
        activeProject.lockedAccess(createAndCommitInsert);
        return result;
      }
      console.warn('[PremiereAPI] Project.lockedAccess unavailable; using legacy transaction path.');
      createAndCommitInsert();
      return result;
    };

    const errorText = error => `${error?.message || ''} ${error?.name || ''} ${String(error || '')}`;
    const isStaleScriptObject = error => /no longer valid|script object.{0,30}(invalid|valid)|object.{0,30}no longer valid/i.test(errorText(error));

    try {
      transactionSuccess = await runTransaction(project, seqEditor, projectItem, insertTime);
    } catch (err) {
      console.warn('[PremiereAPI] First insertion transaction attempt encountered error:', err?.message || err);
      // UXP can invalidate project, sequence, editor, and item proxies between
      // import and the user's later Insert click. Re-resolve all four before retrying.
      if (isStaleScriptObject(err)) {
        try {
          console.log('[PremiereAPI] Re-acquiring fresh project item, sequence, and editor for retry...');
          const freshProject = await ppro.Project?.getActiveProject();
          const freshSeq = await freshProject?.getActiveSequence();
          let freshItem = null;
          if (freshProject && itemName) {
            let mediaPath = '';
            try {
              if (typeof projectItem.getMediaFilePath === 'function') mediaPath = await projectItem.getMediaFilePath();
              else if (typeof projectItem.getMediaPath === 'function') mediaPath = await projectItem.getMediaPath();
            } catch (_) {}
            freshItem = await findProjectItemWithRetry(freshProject, itemName, mediaPath || null, 5, 250);
          }
          if (freshProject && freshSeq && freshItem && ppro.SequenceEditor?.getEditor) {
            const freshEditor = await ppro.SequenceEditor.getEditor(freshSeq);
            let freshTime = null;
            if (insertAtSeconds !== null && insertAtSeconds !== undefined) {
              freshTime = ppro.TickTime.createWithSeconds(insertAtSeconds);
            } else if (typeof freshSeq.getPlayerPosition === 'function') {
              try { freshTime = await freshSeq.getPlayerPosition(); } catch (_) {}
            }
            if (!freshTime) freshTime = ppro.TickTime.createWithSeconds(insertAtSeconds || 0);
            transactionSuccess = await runTransaction(freshProject, freshEditor, freshItem, freshTime);
            transactionError = null;
          } else {
            transactionError = new Error('تغيّر مرجع الملف أثناء الإدراج ولم أتمكن من تحديث عنصر المشروع أو التسلسل. أعد المحاولة بعد تحديد الملف في لوحة المشروع.');
          }
        } catch (retryErr) {
          transactionError = retryErr;
        }
      } else {
        transactionError = err;
      }
    }

    if (transactionError) {
      console.error('[PremiereAPI] Timeline insertion transaction error:', transactionError);
      throw new Error(`خطأ أثناء معاملة الإدراج في الـ Timeline: ${transactionError.message || transactionError}`);
    }

    if (transactionSuccess === false) {
      throw new Error('رفضت Premiere Pro إتمام عملية الإدراج في الـ Timeline.');
    }

    console.log('[PremiereAPI] Clip inserted successfully into timeline:', itemLabel || 'ProjectItem');
    return true;
  }

  async function executeMotionScene(scene, assetsBaseUrl, onProgress = () => {}) {
    const allowedGraphics = new Set(['bg_aurora', 'bg_grid', 'text_kinetic', 'text_badge', 'widget_counter', 'widget_donut_ring', 'widget_social_card', 'logo_outro', 'color_matte']);
    const allowedSfx = new Set(['whoosh', 'pop', 'click', 'riser', 'impact', 'sparkle', 'soft_whoosh', 'swipe', 'bass_hit', 'notification']);
    const allowedMusic = new Set(['social_upbeat', 'kids_playful', 'tech_corporate', 'luxury_ambient', 'cyber_drive', 'cinematic_inspire', 'stats_pulse']);
    const uxp = _getUxpStorage();
    const fs = uxp?.localFileSystem;
    const formats = uxp?.formats;
    if (!fs) throw new Error('تخزين UXP غير متاح لإنشاء ملفات طبقات الموشن محلياً.');
    if (!formats?.binary) throw new Error('تنسيق الملفات الثنائية غير متاح في تخزين UXP.');
    if (!scene || !Array.isArray(scene.elements) || !scene.elements.length || scene.elements.length > 30) throw new Error('المشهد غير صالح أو يتجاوز 30 عنصراً.');
    if (scene.music && (!allowedMusic.has(String(scene.music.musicId || '')) || !Number.isFinite(Number(scene.music.volume)) || Number(scene.music.volume) < 0.05 || Number(scene.music.volume) > 0.8 || !Number.isFinite(Number(scene.music.duration)) || Number(scene.music.duration) < 1 || Number(scene.music.duration) > 180)) throw new Error('بيانات الموسيقى الخلفية غير صالحة.');

    const ppro = _getPProModule();
    let project = await ppro?.Project?.getActiveProject();
    if (!project) throw new Error('افتح مشروعاً في Premiere أولاً.');
    if (!ppro?.SequenceEditor?.getEditor || !ppro?.TickTime?.createWithSeconds) throw new Error('يلزم Premiere Pro 25.6 أو أحدث لواجهة SequenceEditor.');
    if (typeof project.createSequence !== 'function') throw new Error('إنشاء Sequence تلقائياً غير مدعوم في إصدار Premiere الحالي. حدّث Premiere إلى 25.6 أو أحدث.');
    const dimensions = scene.aspectRatio === '9:16' ? { width: 720, height: 1280 } : scene.aspectRatio === '1:1' ? { width: 1080, height: 1080 } : { width: 1280, height: 720 };
    let sequence;
    try {
      sequence = await project.createSequence(`Mickey Motion ${scene.aspectRatio || '16:9'} ${Date.now()}`);
      if (!sequence) throw new Error('لم تُرجع Premiere الـ Sequence الجديدة.');
      const settings = await sequence.getSettings?.();
      if (!settings || typeof settings.setVideoFrameRect !== 'function' || typeof sequence.createSetSettingsAction !== 'function' || !ppro.RectF) {
        throw new Error('تغيير أبعاد الـ Sequence غير مدعوم في إصدار Premiere الحالي.');
      }
      const frameRect = new ppro.RectF();
      frameRect.width = dimensions.width;
      frameRect.height = dimensions.height;
      const settingsChanged = await settings.setVideoFrameRect(frameRect);
      if (settingsChanged === false) throw new Error('رفض Premiere ضبط أبعاد المشهد.');
      let settingsCommitted = false;
      const commitSettings = () => {
        const action = sequence.createSetSettingsAction(settings);
        settingsCommitted = project.executeTransaction(compound => compound.addAction(action), 'Mickey Studio: Set Motion Sequence Size');
      };
      if (project.lockedAccess) project.lockedAccess(commitSettings); else commitSettings();
      if (settingsCommitted === false) throw new Error('تعذر تثبيت أبعاد المشهد في Premiere.');
      if (typeof project.openSequence === 'function' && await project.openSequence(sequence) === false) throw new Error('تعذر فتح الـ Sequence الجديدة.');
      if (typeof project.setActiveSequence === 'function' && await project.setActiveSequence(sequence) === false) throw new Error('تعذر جعل الـ Sequence الجديدة نشطة.');
      project = await ppro.Project.getActiveProject();
      sequence = await project?.getActiveSequence();
      if (!sequence) throw new Error('لم تصبح الـ Sequence الجديدة نشطة في Premiere.');
    } catch (error) {
      throw new Error(`تعذر إنشاء أو فتح Sequence بأبعاد المشهد: ${error.message || error}`);
    }
    if (typeof sequence.getVideoTrackCount !== 'function' || typeof sequence.getAudioTrackCount !== 'function') throw new Error('تعذر قراءة مسارات الفيديو والصوت في الـ Sequence الحالية.');
    const firstNewVideoTrack = 0;
    const firstNewAudioTrack = 0;

    const dataFolder = await fs.getDataFolder();
    async function folder(parent, name) { try { return await parent.getEntry(name); } catch (_) { return parent.createFolder(name); } }
    const cacheRoot = await folder(dataFolder, 'AI_Motion_Builder');
    const scenesFolder = await folder(cacheRoot, 'scenes');
    const sceneKey = `scene_${Date.now()}`;
    const sceneFolder = await folder(scenesFolder, sceneKey);
    const graphicsFolder = await folder(sceneFolder, 'graphics');
    const audioFolder = await folder(sceneFolder, 'audio');
    let sfxCount = 0;
    const elements = scene.elements.map((item, index) => {
      const type = item.type === 'mogrt' ? 'graphic' : item.type;
      let id = type === 'sfx' ? item.sfxId : type === 'color_matte' ? 'color_matte' : item.templateId;
      if (!['graphic', 'color_matte', 'sfx'].includes(type) || !/^[A-Za-z0-9_-]{1,80}$/.test(String(id || ''))) throw new Error(`نوع أو معرّف العنصر ${index + 1} غير صالح.`);
      if ((type === 'graphic' || type === 'color_matte') && !allowedGraphics.has(id)) throw new Error(`قالب رسومي غير مدعوم: ${id}`);
      if (type === 'sfx' && !allowedSfx.has(id)) throw new Error(`مؤثر صوتي غير مدعوم: ${id}`);
      if (type === 'sfx') {
        if (sfxCount >= 2) return null;
        id = sfxCount++ === 0 ? 'soft_whoosh' : 'click';
      }
      const startTime = Number(item.startTime), duration = Number(item.duration), trackIndex = Number(item.trackIndex);
      if (!Number.isInteger(trackIndex) || trackIndex < 0 || trackIndex > 18 || !Number.isFinite(startTime) || startTime < 0 || !Number.isFinite(duration) || duration <= 0 || startTime + duration > 180) throw new Error(`توقيت أو مسار العنصر ${index + 1} غير صالح.`);
      return { ...item, type, id, startTime, duration, trackIndex, params: item.params || {} };
    }).filter(Boolean);
    const occupiedVideoLanes = new Map(), occupiedAudioLanes = new Map();
    elements.forEach(item => {
      const lanes = item.type === 'sfx' ? occupiedAudioLanes : occupiedVideoLanes;
      let lane = item.trackIndex;
      const overlaps = end => item.startTime < end - 0.001;
      while ((lanes.get(lane) || []).some(end => overlaps(end))) lane++;
      item._timelineLane = lane;
      lanes.set(lane, [...(lanes.get(lane) || []), item.startTime + item.duration]);
    });

    function dataUrlBytes(dataUrl) {
      const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(dataUrl || ''));
      const encoded = match && match[1];
      if (!encoded) throw new Error('ملف PNG الجاهز غير موجود أو غير صالح. أعد إرسال المشهد من الموقع بعد تحديثه.');
      const binary = atob(encoded), bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i); return bytes;
    }
    async function writeBinary(targetFolder, name, bytes) { const file = await targetFolder.createFile(name, { overwrite: true }); await file.write(bytes, { format: formats.binary }); return file; }
    function createWav(id, seconds) {
      const rate = 22050, duration = Math.max(.12, Math.min(2.5, seconds)), count = Math.floor(rate * duration), buffer = new ArrayBuffer(44 + count * 2), view = new DataView(buffer);
      const writeString = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
      writeString(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); writeString(8, 'WAVE'); writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeString(36, 'data'); view.setUint32(40, count * 2, true);
      for (let i = 0; i < count; i++) { const t = i / rate, progress = i / count; let sample = 0;
        if (id === 'click') sample = (Math.random() * 2 - 1) * Math.exp(-t * 65) * .48 + Math.sin(2 * Math.PI * (1500 - 500 * progress) * t) * Math.exp(-t * 36) * .3;
        else if (id === 'pop') sample = Math.sin(2 * Math.PI * (150 + 520 * Math.exp(-t * 9)) * t) * Math.exp(-t * 12) * .62 + (Math.random() * 2 - 1) * Math.exp(-t * 32) * .08;
        else if (id === 'riser') sample = (Math.sin(2 * Math.PI * (90 + 900 * progress) * t) * .55 + (Math.random() * 2 - 1) * .12) * progress * progress;
        else sample = ((Math.random() * 2 - 1) * .65 + Math.sin(2 * Math.PI * (1200 - 900 * progress) * t) * .35) * Math.pow(Math.sin(Math.PI * progress), .7);
        const fade = Math.min(1, i / (rate * .012), (count - i) / (rate * .035)); view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample * fade)) * 25000), true);
      }
      return new Uint8Array(buffer);
    }
    async function fetchAudioAsset(kind, id) {
      const candidates = [];
      if (assetsBaseUrl) {
        const endpoint = new URL(assetsBaseUrl);
        endpoint.searchParams.set('action', 'motion_audio_asset'); endpoint.searchParams.set('kind', kind); endpoint.searchParams.set('id', id);
        candidates.push(endpoint.toString());
      }
      candidates.push(`https://mickey-studio-eta.vercel.app/assets/motion-audio/${kind}/${encodeURIComponent(id)}.wav`);
      let lastError = null;
      for (const url of candidates) {
        try {
          const response = await fetch(url, { cache: 'force-cache' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.length < 44 || bytes.length > 24 * 1024 * 1024 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'RIFF') throw new Error('الملف ليس WAV صالحاً أو يتجاوز الحجم المسموح');
          return bytes;
        } catch (error) { lastError = error; }
      }
      throw new Error(`تعذر تحميل ملف ${id} من خدمة الصوت: ${lastError?.message || 'مصادر الصوت غير متاحة'}.`);
    }
    function wavDuration(bytes) {
      try { const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); const rate = view.getUint32(28, true), dataLength = view.getUint32(40, true); return rate > 0 ? dataLength / rate : 0; } catch (_) { return 0; }
    }
    function applyWavGain(bytes, gain) {
      const copy = new Uint8Array(bytes), view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
      const channels = view.getUint16(22, true), bits = view.getUint16(34, true);
      if (bits !== 16 || channels < 1) return copy;
      const multiplier = Math.max(0.05, Math.min(0.8, Number(gain) || 0.28));
      for (let offset = 44; offset + 1 < copy.length; offset += 2) view.setInt16(offset, Math.round(view.getInt16(offset, true) * multiplier), true);
      return copy;
    }
    function createMusicFallback(id, seconds) {
      const rate = 22050, duration = Math.max(1, Math.min(180, seconds)), frames = Math.floor(rate * duration), channels = 2;
      const buffer = new ArrayBuffer(44 + frames * channels * 2), view = new DataView(buffer);
      const writeString = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
      writeString(0, 'RIFF'); view.setUint32(4, 36 + frames * channels * 2, true); writeString(8, 'WAVE'); writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, rate, true); view.setUint32(28, rate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); writeString(36, 'data'); view.setUint32(40, frames * channels * 2, true);
      const roots = id === 'luxury_ambient' ? [110, 164.81, 146.83, 130.81] : id === 'cyber_drive' ? [73.42, 87.31, 98, 82.41] : id === 'kids_playful' ? [130.81, 174.61, 196, 130.81] : [130.81, 196, 220, 174.61];
      const pulse = id === 'social_upbeat' || id === 'stats_pulse' || id === 'cyber_drive';
      for (let i = 0; i < frames; i++) {
        const t = i / rate, root = roots[Math.floor(t / 2) % roots.length], barPhase = (t % 2) / 2;
        const pad = Math.sin(2 * Math.PI * root * t) * .42 + Math.sin(2 * Math.PI * root * 1.25 * t) * .24 + Math.sin(2 * Math.PI * root * 1.5 * t) * .18;
        const bass = Math.sin(2 * Math.PI * root * .5 * t) * .34;
        const arpeggio = Math.sin(2 * Math.PI * root * (2 + Math.floor(barPhase * 4)) * t) * Math.exp(-((t % .25) * 7)) * .14;
        const beat = pulse ? Math.pow(Math.max(0, 1 - ((t % .5) / .5)), 5) * .10 : 0;
        const fade = Math.min(1, i / (rate * .08), (frames - i) / (rate * .1));
        const sample = Math.max(-1, Math.min(1, (pad + bass + arpeggio + beat) * fade * .45));
        view.setInt16(44 + i * 4, Math.round(sample * 12000), true); view.setInt16(46 + i * 4, Math.round(sample * 12000), true);
      }
      return new Uint8Array(buffer);
    }

    const fileRecords = [], skippedSfx = [];
    for (let i = 0; i < elements.length; i++) {
      const item = elements[i]; onProgress(`جاري إنشاء الطبقة ${i + 1} من ${elements.length} محلياً…`);
      const filename = `motion_${sceneKey}_${i}_${item.id}.${item.type === 'sfx' ? 'wav' : 'png'}`;
      let audioBytes = null;
      if (item.type === 'sfx') {
        try { audioBytes = await fetchAudioAsset('sfx', item.id); }
        catch (error) { console.warn('[MotionBuilder] Skipping unavailable SFX:', error.message || error); skippedSfx.push(item.id); continue; }
        audioBytes = applyWavGain(audioBytes, 0.22);
      }
      const graphicBytes = item.type === 'sfx' ? null : dataUrlBytes(item.renderedPng);
      const file = item.type === 'sfx' ? await writeBinary(audioFolder, filename, audioBytes) : await writeBinary(graphicsFolder, filename, graphicBytes);
      fileRecords.push({ item, file, filename, sourceDuration: item.type === 'sfx' ? wavDuration(audioBytes) : 0 });
    }
    let musicRecord = null;
    if (scene.music) {
      onProgress('جاري تجهيز موسيقى الخلفية…');
      let musicBytes;
      try { musicBytes = await fetchAudioAsset('music', scene.music.musicId); }
      catch (error) { console.warn('[MotionBuilder] Falling back to locally synthesized music:', error.message || error); musicBytes = createMusicFallback(scene.music.musicId, Math.min(32, Number(scene.music.duration))); }
      const sourceDuration = wavDuration(musicBytes);
      if (!sourceDuration) throw new Error('ملف موسيقى الخلفية لا يحتوي على توقيت WAV صالح.');
      musicBytes = applyWavGain(musicBytes, scene.music.volume);
      const filename = `motion_${sceneKey}_music_${scene.music.musicId}.wav`;
      const file = await writeBinary(audioFolder, filename, musicBytes);
      const maxLane = Math.max(-1, ...elements.filter(item => item.type === 'sfx').map(item => item._timelineLane));
      musicRecord = { isMusic: true, item: { type: 'music', id: scene.music.musicId, startTime: 0, duration: Number(scene.music.duration), trackIndex: 0, _timelineLane: maxLane + 1, fadeIn: Number(scene.music.fadeIn) || 1.2, fadeOut: Number(scene.music.fadeOut) || 1.5 }, file, filename, sourceDuration };
      fileRecords.push(musicRecord);
    }
    const rootItem = await project.getRootItem();
    function castFolderItem(item) {
      if (item && typeof item.getItems === 'function') return item;
      try {
        const casted = ppro.FolderItem?.cast?.(item);
        if (casted && typeof casted.getItems === 'function') return casted;
      } catch (error) { console.warn('[MotionBuilder] Could not cast project item to FolderItem:', error.message || error); }
      return null;
    }
    async function findOrCreateBin(parent, name) {
      const folderParent = castFolderItem(parent);
      if (!folderParent) throw new Error(`تعذر فتح مجلد ${name} في لوحة المشروع.`);
      let children = await folderParent.getItems() || [];
      let existing = children.filter(item => item?.name === name).map(castFolderItem).find(Boolean);
      if (existing) return existing;
      if (typeof folderParent.createBinAction !== 'function') throw new Error('إنشاء مجلدات داخل لوحة المشروع غير مدعوم في إصدار Premiere الحالي.');
      let committed = false;
      const createAndCommit = () => {
        const action = folderParent.createBinAction(name, false);
        committed = project.executeTransaction(compound => compound.addAction(action), 'Mickey Studio: Organize Motion Scene');
      };
      if (project.lockedAccess) project.lockedAccess(createAndCommit); else createAndCommit();
      if (committed === false) throw new Error(`تعذر إنشاء مجلد ${name} داخل لوحة المشروع.`);
      for (let attempt = 0; attempt < 20; attempt++) {
        children = await folderParent.getItems() || [];
        existing = children.filter(item => item?.name === name).map(castFolderItem).find(Boolean);
        if (existing) return existing;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`لم يظهر مجلد ${name} داخل لوحة المشروع.`);
    }
    const motionBin = await findOrCreateBin(rootItem, 'Mickey Studio');
    const sceneBin = await findOrCreateBin(motionBin, sceneKey);
    const graphicsBin = await findOrCreateBin(sceneBin, 'Graphics');
    const audioBin = await findOrCreateBin(sceneBin, 'Audio');
    const graphicRecords = fileRecords.filter(record => record.item.type !== 'sfx');
    const audioRecords = fileRecords.filter(record => record.item.type === 'sfx' || record.isMusic);
    const imports = await Promise.all([
      graphicRecords.length ? importFilesToProject(graphicRecords.map(record => record.file.nativePath), graphicsBin) : { success: true },
      audioRecords.length ? importFilesToProject(audioRecords.map(record => record.file.nativePath), audioBin) : { success: true },
    ]);
    if (imports.some(result => !result?.success)) throw new Error('تعذر استيراد طبقات الموشن التي أُنشئت محلياً إلى مجلدات المشروع.');
    const insertedRecords = [], errors = skippedSfx.map(id => `تم تخطي المؤثر الصوتي ${id} لعدم توفر ملف صوتي مناسب.`); let insertedCount = 0;
    for (let i = 0; i < fileRecords.length; i++) {
      const record = fileRecords[i], item = record.item, isAudio = item.type === 'sfx';
      if (record.isMusic) continue;
      try {
        onProgress(`إدراج ${i + 1} من ${fileRecords.length}: ${record.filename}`);
        const projectItem = await findProjectItemWithRetry(project, record.filename, record.file.nativePath, 8, 250);
        if (!projectItem) throw new Error(`تعذر العثور على ${record.filename} في لوحة المشروع.`);
        const videoTrack = isAudio ? -1 : firstNewVideoTrack + item._timelineLane, audioTrack = isAudio ? firstNewAudioTrack + item._timelineLane : -1;
        await insertProjectItemToTimeline(projectItem, { insertAtSeconds: item.startTime, videoTrackIndex: videoTrack, audioTrackIndex: audioTrack, overwrite: false, limitShift: false });
        insertedRecords.push({ ...record, projectItem, videoTrack, audioTrack });
        insertedCount++;
      } catch (error) { errors.push(`${record.filename}: ${error.message || error}`); }
    }
    for (const record of insertedRecords) {
      try {
        if (record.item.type === 'sfx') await applyAudioMotion({ ...record, item: { ...record.item, duration: Math.min(record.item.duration, record.sourceDuration || record.item.duration), fadeIn: 0, fadeOut: 0 } });
        else await applyClipMotion(record);
      } catch (error) { errors.push(`${record.filename} (الحركة): ${error.message || error}`); }
    }
    if (musicRecord) {
      const musicProjectItem = await findProjectItemWithRetry(project, musicRecord.filename, musicRecord.file.nativePath, 8, 250);
      if (!musicProjectItem) errors.push('تعذر العثور على الموسيقى في لوحة المشروع.');
      else {
        const musicTrack = firstNewAudioTrack + musicRecord.item._timelineLane;
        let offset = 0;
        while (offset < musicRecord.item.duration - 0.001) {
          const clipDuration = Math.min(musicRecord.sourceDuration, musicRecord.item.duration - offset);
          const clipRecord = { ...musicRecord, projectItem: musicProjectItem, audioTrack: musicTrack, item: { ...musicRecord.item, startTime: offset, duration: clipDuration, fadeIn: offset === 0 ? musicRecord.item.fadeIn : 0, fadeOut: offset + clipDuration >= musicRecord.item.duration - 0.001 ? musicRecord.item.fadeOut : 0 } };
          try {
            onProgress(`إدراج الموسيقى الخلفية (${Math.min(100, Math.round((offset + clipDuration) / musicRecord.item.duration * 100))}%)…`);
            await insertProjectItemToTimeline(musicProjectItem, { insertAtSeconds: offset, videoTrackIndex: -1, audioTrackIndex: musicTrack, overwrite: false, limitShift: false });
            await applyAudioMotion(clipRecord);
            insertedCount++;
          } catch (error) { errors.push(`مقطع الموسيقى عند ${offset.toFixed(1)} ثانية: ${error.message || error}`); break; }
          offset += clipDuration;
        }
      }
    }
    if (!insertedCount) throw new Error(errors.join('\n') || 'لم يتم إدراج أي طبقة.');
    return { inserted: insertedCount, errors, generatedLocally: true, musicIncluded: Boolean(musicRecord) };

    async function applyClipMotion(record) {
      const ppro = _getPProModule(), project = await ppro.Project.getActiveProject(), sequence = await project.getActiveSequence();
      const track = await sequence.getVideoTrack(record.videoTrack);
      const items = await track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
      let target = null;
      for (const candidate of items || []) { try { const pi = await candidate.getProjectItem(); const start = await candidate.getStartTime(); if (pi?.name === record.filename && Math.abs(Number(start?.seconds) - record.item.startTime) < .08) { target = candidate; break; } } catch (_) {} }
      if (!target) throw new Error('تعذر تحديد طبقة الرسوم لإضافة الحركة.');
      const duration = record.item.duration;
      const entrance = String(record.item.animationIn || 'fade-in').toLowerCase();
      const exit = String(record.item.animationOut || 'fade-out').toLowerCase();
      const fadeIn = Math.min(.24, duration * .18);
      const fadeOut = Math.min(.24, duration * .18);
      const frame = await sequence.getFrameSize();
      const centerX = Number(frame?.width) / 2 || 640;
      const centerY = Number(frame?.height) / 2 || 360;
      const offsetX = centerX * .08, offsetY = centerY * .08;
      const motionSpecs = [];
      const chain = await target.getComponentChain?.();
      const components = [];
      for (let ci = 0; ci < (await chain?.getComponentCount?.() || 0); ci++) components.push(await chain.getComponentAtIndex(ci));
      for (const component of components) {
        const matchName = String(await component.getMatchName?.() || '').toLowerCase();
        if (matchName.includes('adbe motion')) {
          const scale = await component.getParam(2);
          const position = await component.getParam(1);
          let scaleKeys = [[0, 100], [duration, 100]];
          if (entrance === 'pop-in') scaleKeys = [[0, 82], [Math.min(.16, duration * .3), 106], [Math.min(.32, duration * .55), 100], [duration, 100]];
          else if (entrance === 'bounce-in') scaleKeys = [[0, 76], [Math.min(.18, duration * .3), 108], [Math.min(.36, duration * .6), 100], [duration, 100]];
          else if (entrance === 'zoom-in') scaleKeys = [[0, 88], [Math.min(.34, duration * .5), 100], [duration, 100]];
          else if (exit === 'zoom-out') scaleKeys = [[0, 100], [Math.max(.02, duration - .26), 100], [duration, 94]];
          if (scale?.createKeyframe && scale?.createAddKeyframeAction) {
            let needsTimeVarying = false;
            try { needsTimeVarying = Boolean(scale.createSetTimeVaryingAction && !(await scale.isTimeVarying?.())); } catch (_) {}
            motionSpecs.push({ param: scale, keyValues: scaleKeys, needsTimeVarying });
          }
          const finalPosition = new ppro.PointF(centerX, centerY);
          const initialPosition = entrance === 'slide-up' ? new ppro.PointF(centerX, centerY + offsetY) : entrance === 'slide-left' ? new ppro.PointF(centerX + offsetX, centerY) : entrance === 'slide-right' ? new ppro.PointF(centerX - offsetX, centerY) : finalPosition;
          const positionKeys = [[0, initialPosition]];
          if (initialPosition !== finalPosition) positionKeys.push([Math.min(.34, duration * .42), finalPosition]);
          const exitPosition = exit === 'slide-down' ? new ppro.PointF(centerX, centerY + offsetY) : exit === 'slide-left' ? new ppro.PointF(centerX - offsetX, centerY) : exit === 'slide-right' ? new ppro.PointF(centerX + offsetX, centerY) : null;
          if (exitPosition) positionKeys.push([Math.max(.02, duration - .26), finalPosition], [duration, exitPosition]);
          if (position?.createKeyframe && position?.createAddKeyframeAction) {
            let needsTimeVarying = false;
            try { needsTimeVarying = Boolean(position.createSetTimeVaryingAction && !(await position.isTimeVarying?.())); } catch (_) {}
            motionSpecs.push({ param: position, keyValues: positionKeys, needsTimeVarying });
          }
        } else if (matchName.includes('adbe opacity')) {
          const opacity = await component.getParam(0);
          const opacityKeys = [[0, 0], [fadeIn, 100], [Math.max(fadeIn, duration - fadeOut), 100], [duration, 0]];
          if (opacity?.createKeyframe && opacity?.createAddKeyframeAction) {
            let needsTimeVarying = false;
            try { needsTimeVarying = Boolean(opacity.createSetTimeVaryingAction && !(await opacity.isTimeVarying?.())); } catch (_) {}
            motionSpecs.push({ param: opacity, keyValues: opacityKeys, needsTimeVarying });
          }
        }
      }
      if (!motionSpecs.length) throw new Error('لم أتمكن من الوصول إلى مؤثرات الحركة والعتامة في طبقة Premiere.');
      let result = false;
      const commit = () => {
        const actions = [];
        if (typeof target.createSetOutPointAction === 'function') actions.push(target.createSetOutPointAction(ppro.TickTime.createWithSeconds(duration)));
        motionSpecs.forEach(({ param, keyValues, needsTimeVarying }) => {
          if (needsTimeVarying) actions.push(param.createSetTimeVaryingAction(true));
          keyValues.forEach(([seconds, value]) => { const key = param.createKeyframe(value); key.position = ppro.TickTime.createWithSeconds(seconds); actions.push(param.createAddKeyframeAction(key)); });
        });
        result = project.executeTransaction(compound => actions.forEach(action => action && compound.addAction(action)), 'Mickey Studio: Animate Motion Layer');
      };
      if (project.lockedAccess) project.lockedAccess(commit); else commit();
      if (result === false) throw new Error('رفض Premiere تطبيق حركة الطبقة.');
    }

    async function applyAudioMotion(record) {
      const ppro = _getPProModule(), project = await ppro.Project.getActiveProject(), sequence = await project.getActiveSequence();
      const track = await sequence.getAudioTrack(record.audioTrack);
      const items = await track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
      let target = null;
      for (const candidate of items || []) { try { const pi = await candidate.getProjectItem(); const start = await candidate.getStartTime(); if (pi?.name === record.filename && Math.abs(Number(start?.seconds) - record.item.startTime) < .08) { target = candidate; break; } } catch (_) {} }
      if (!target) throw new Error('لم أتمكن من تحديد المقطع الصوتي المضاف لضبط مدته ومستوى الموسيقى.');
      const specs = [];
      const chain = await target.getComponentChain?.();
      for (let ci = 0; ci < (await chain?.getComponentCount?.() || 0); ci++) {
        const component = await chain.getComponentAtIndex(ci), matchName = String(await component.getMatchName?.() || '').toLowerCase();
        if (!matchName.includes('adbe volume')) continue;
        const param = await component.getParam(0);
        if (!param?.createKeyframe || !param?.createAddKeyframeAction) continue;
        const duration = record.item.duration, isSfx = record.item.type === 'sfx';
        const fadeIn = isSfx ? Math.min(.045, duration * .2) : Math.min(record.item.fadeIn || 0, duration * .35);
        const fadeOut = isSfx ? Math.min(.12, duration * .3) : Math.min(record.item.fadeOut || 0, duration * .4);
        const level = isSfx ? -14 : 0;
        const keys = [[0, -60], [fadeIn, level], [Math.max(fadeIn, duration - fadeOut), level], [duration, -60]];
        let varying = false; try { varying = Boolean(param.createSetTimeVaryingAction && !(param.isTimeVarying?.())); } catch (_) {}
        specs.push({ param, keys, varying });
      }
      let result = false;
      const commit = () => {
        const actions = [];
        if (typeof target.createSetOutPointAction === 'function') actions.push(target.createSetOutPointAction(ppro.TickTime.createWithSeconds(record.item.duration)));
        specs.forEach(({ param, keys, varying }) => {
          if (varying) actions.push(param.createSetTimeVaryingAction(true));
          if (keys.length === 1 && param.createSetValueAction) actions.push(param.createSetValueAction(param.createKeyframe(keys[0][1]), true));
          else keys.forEach(([seconds, value]) => { const key = param.createKeyframe(value); key.position = ppro.TickTime.createWithSeconds(seconds); actions.push(param.createAddKeyframeAction(key)); });
        });
        result = project.executeTransaction(compound => actions.forEach(action => action && compound.addAction(action)), 'Mickey Studio: Music Fade and Duration');
      };
      if (project.lockedAccess) project.lockedAccess(commit); else commit();
      if (result === false) throw new Error('تعذر تطبيق التلاشي ومدة مقطع الموسيقى.');
    }
  }

  async function getVideoEffects() {
    const ppro = _getPProModule();
    if (!ppro?.VideoFilterFactory?.getDisplayNames || !ppro.VideoFilterFactory.getMatchNames) {
      throw new Error('قائمة مؤثرات الفيديو تتطلب Premiere Pro 25.6 أو أحدث.');
    }
    const [displayNames, matchNames] = await Promise.all([
      ppro.VideoFilterFactory.getDisplayNames(),
      ppro.VideoFilterFactory.getMatchNames(),
    ]);
    return (displayNames || []).map((name, index) => ({ name, matchName: matchNames?.[index] || '' }))
      .filter(effect => effect.name && effect.matchName);
  }

  async function applyVideoEffectToSelection(matchName) {
    const ppro = _getPProModule();
    const project = await ppro?.Project?.getActiveProject();
    const sequence = project && await project.getActiveSequence();
    if (!sequence) throw new Error('افتح Sequence وحدد مقطع فيديو أولًا.');
    const selection = await sequence.getSelection();
    const items = selection && await selection.getTrackItems();
    const clips = (items || []).filter(item => item && typeof item.getComponentChain === 'function');
    if (!clips.length) throw new Error('حدد مقطع فيديو واحدًا على الأقل في التايملاين.');
    const factory = ppro.VideoFilterFactory;
    if (!factory?.createComponent) throw new Error('واجهة إضافة المؤثرات غير متاحة في هذا الإصدار.');
    const components = await Promise.all(clips.map(() => factory.createComponent(matchName)));
    let transactionResult = false;
    // DOM access must be complete before the synchronous transaction callback.
    const chains = await Promise.all(clips.map(clip => clip.getComponentChain()));
    const run = () => {
      transactionResult = project.executeTransaction(compoundAction => {
        chains.forEach((chain, index) => compoundAction.addAction(chain.createAppendComponentAction(components[index])));
      }, 'Mickey Studio: Apply Effect');
    };
    run();
    if (transactionResult === false) throw new Error('لم يتمكن Premiere من إضافة المؤثر.');
    return clips.length;
  }

  async function getSelectedClipTranscripts() {
    const ppro = _getPProModule();
    const project = await ppro?.Project?.getActiveProject();
    const sequence = project && await project.getActiveSequence();
    if (!sequence) throw new Error('افتح Sequence وحدد مقطعًا يحتوي على كلام أولًا.');
    const selection = await sequence.getSelection();
    const selectedItems = selection && await selection.getTrackItems();
    const clips = (selectedItems || []).filter(item => item && typeof item.getProjectItem === 'function' && typeof item.getStartTime === 'function' && typeof item.getDuration === 'function');
    if (!clips.length) throw new Error('حدد مقطع فيديو أو صوت في التايملاين لتحليل الكلام.');
    const output = [];
    const transcriptApi = ppro.Transcript || {};
    let arabicLanguage = null;
    if (typeof transcriptApi.querySupportedLanguages === 'function') {
      try {
        const languages = await transcriptApi.querySupportedLanguages();
        arabicLanguage = (languages || []).find(item => /^ar(?:-|$)/i.test(item.languageCode || '')) || null;
      } catch (error) {
        console.warn('[PremiereAPI] Could not query transcription languages:', error);
      }
    }
    for (const clip of clips.slice(0, 3)) {
      const projectItem = await clip.getProjectItem();
      const clipItem = ppro.ClipProjectItem?.cast ? ppro.ClipProjectItem.cast(projectItem) : projectItem;
      if (!clipItem) continue;
      let transcriptJson = '';
      if (typeof transcriptApi.exportToJSON === 'function') {
        try { transcriptJson = await transcriptApi.exportToJSON(clipItem); } catch (_) {}
      }
      if (transcriptJson && !/[\u0600-\u06FF]/.test(typeof transcriptJson === 'string' ? transcriptJson : JSON.stringify(transcriptJson))) {
        // Premiere may return an empty or wrong-language transcript for Arabic footage.
        // Discard it and let Gemini analyze the source media instead.
        transcriptJson = '';
      }
      if (!transcriptJson && arabicLanguage && typeof transcriptApi.transcribeClipProjectItem === 'function' && typeof transcriptApi.exportToJSON === 'function') {
        const options = arabicLanguage ? { language: arabicLanguage.languageCode } : undefined;
        try {
          const transcribed = await transcriptApi.transcribeClipProjectItem(clipItem, options);
          if (transcribed !== false) transcriptJson = await transcriptApi.exportToJSON(clipItem);
        } catch (error) { console.info('[PremiereAPI] Arabic transcription unavailable; Gemini will analyze the source media.', error); }
        if (transcriptJson && !/[\u0600-\u06FF]/.test(typeof transcriptJson === 'string' ? transcriptJson : JSON.stringify(transcriptJson))) transcriptJson = '';
      }
      if (typeof transcriptJson !== 'string') transcriptJson = JSON.stringify(transcriptJson);
      const safeGet = async (method, fallback = null) => { try { return typeof method === 'function' ? await method() : fallback; } catch (_) { return fallback; } };
      const [start, duration, inPoint, outPoint, trackIndex, name, mediaPath] = await Promise.all([
        safeGet(() => clip.getStartTime()), safeGet(() => clip.getDuration()), safeGet(() => clip.getInPoint()), safeGet(() => clip.getOutPoint()),
        safeGet(() => clip.getTrackIndex(), 0), safeGet(() => clip.getName(), projectItem.name || 'المقطع المحدد'),
        safeGet(() => clipItem.getMediaFilePath(), ''),
      ]);
      const sourceInSeconds = Number(inPoint?.seconds) || 0;
      const sourceOutSeconds = Number.isFinite(Number(outPoint?.seconds))
        ? Number(outPoint.seconds)
        : sourceInSeconds + (Number(duration?.seconds) || 0);
      output.push({
        name: name || projectItem.name || 'المقطع المحدد',
        transcriptJson: String(transcriptJson || '').slice(0, 12000),
        mediaPath: mediaPath || '',
        startSeconds: Number(start?.seconds) || 0,
        durationSeconds: Number(duration?.seconds) || 0,
        sourceInSeconds,
        sourceOutSeconds,
        trackIndex: Number(trackIndex) || 0,
      });
    }
    if (!output.some(clip => clip.transcriptJson || clip.mediaPath)) throw new Error('تعذر الوصول إلى الملف الأصلي للمقطع. تأكد أنه متصل في لوحة المشروع.');
    return output;
  }

  let cachedMp3PresetPath = '';
  function joinFsPath(...parts) {
    const first = String(parts.shift() || '');
    const separator = first.includes('\\') ? '\\' : '/';
    return parts.reduce((joined, part) => {
      const next = String(part || '');
      if (!next) return joined;
      if (!joined) return next;
      return `${joined.replace(/[\\/]+$/, '')}${separator}${next.replace(/^[\\/]+/, '')}`;
    }, first);
  }

  function findMp3Preset() {
    if (cachedMp3PresetPath) return cachedMp3PresetPath;
    const fs = require('fs');
    const path = require('path');
    const uxp = require('uxp');
    const appPath = uxp?.host?.applicationPath || '';
    // UXP's Node-compatible path module may expose join() without dirname().
    // Derive parent folders from either Windows or POSIX application paths.
    const dirname = typeof path.dirname === 'function'
      ? path.dirname.bind(path)
      : value => {
        const normalized = String(value || '').replace(/[\\/]+$/, '');
        const separator = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'));
        return separator > 0 ? normalized.slice(0, separator) : '';
      };
    const adobeRoot = appPath ? dirname(dirname(appPath)) : '';
    const roots = [];
    if (adobeRoot) roots.push(adobeRoot);
    roots.push('C:\\Program Files\\Adobe', 'C:\\Program Files (x86)\\Adobe');
    if (typeof process !== 'undefined' && process.env?.ProgramFiles) roots.push(joinFsPath(process.env.ProgramFiles, 'Adobe'));

    const walk = (dir, depth) => {
      let names = [];
      try { names = fs.readdirSync(dir); } catch (_) { return ''; }
      for (const name of names) {
        if (/^MP3 128kbps\.epr$/i.test(name)) return joinFsPath(dir, name);
      }
      if (depth <= 0 || typeof fs.lstatSync !== 'function') return '';
      for (const name of names) {
        const child = joinFsPath(dir, name);
        try {
          if (fs.lstatSync(child).isDirectory()) {
            const found = walk(child, depth - 1);
            if (found) return found;
          }
        } catch (_) {}
      }
      return '';
    };

    for (const root of [...new Set(roots)]) {
      let installs = [];
      try { installs = fs.readdirSync(root).filter(name => /^Adobe Media Encoder/i.test(name)); } catch (_) {}
      for (const install of installs) {
        const presets = joinFsPath(root, install, 'MediaIO', 'systempresets');
        const found = walk(presets, 5);
        if (found) {
          cachedMp3PresetPath = found;
          return found;
        }
      }
    }
    throw new Error('لم أجد إعداد MP3 الخاص بـAdobe Media Encoder. ثبّت Adobe Media Encoder ثم أعد المحاولة.');
  }

  async function exportClipAudioRangeForTranscription(clip) {
    const ppro = _getPProModule();
    const encoder = ppro?.EncoderManager?.getManager?.();
    if (!encoder || typeof encoder.encodeFile !== 'function') {
      throw new Error('تصدير الجزء المحدد يحتاج واجهة EncoderManager في Premiere Pro 25.6 أو أحدث.');
    }
    if (encoder.isAMEInstalled === false) {
      throw new Error('تصدير الجزء المحدد يحتاج Adobe Media Encoder مثبتًا على الجهاز.');
    }
    const sourceIn = Number(clip?.sourceInSeconds);
    const sourceOut = Number(clip?.sourceOutSeconds);
    if (!Number.isFinite(sourceIn) || !Number.isFinite(sourceOut) || sourceIn < 0 || sourceOut <= sourceIn) {
      throw new Error('تعذر تحديد نقطتي In وOut للمقطع. أعد تحديد المقطع في التايملاين.');
    }

    const presetPath = findMp3Preset();
    const fs = require('fs');
    const path = require('path');
    const { mediaFolder } = await GeminiTransfer.resolveProjectMediaFolder();
    const outputPath = joinFsPath(mediaFolder, `Mickey_Transcript_Range_${Date.now()}.mp3`);
    const inPoint = ppro.TickTime.createWithSeconds(sourceIn);
    const outPoint = ppro.TickTime.createWithSeconds(sourceOut);

    let queued = false;
    try {
      if (typeof encoder.launchEncoder === 'function') await encoder.launchEncoder();
      queued = await encoder.encodeFile(clip.mediaPath, outputPath, presetPath, inPoint, outPoint, 0, true, true);
    } catch (error) {
      throw new Error(`تعذر تصدير الجزء المحدد عبر Adobe Media Encoder: ${error?.message || error}`);
    }
    if (queued === false) throw new Error('رفض Adobe Media Encoder تصدير الجزء المحدد. تأكد من أنه يعمل ثم أعد المحاولة.');

    const timeoutMs = Math.max(180000, Math.min(900000, (Number(clip.durationSeconds) || 30) * 5000));
    const startAt = Date.now();
    let lastSize = -1;
    let stableCount = 0;
    while (Date.now() - startAt < timeoutMs) {
      try {
        const stat = typeof fs.lstatSync === 'function' ? fs.lstatSync(outputPath) : null;
        const size = Number(stat?.size) || 0;
        if (size > 100 && size === lastSize) stableCount++;
        else stableCount = 0;
        if (stableCount >= 6 && Date.now() - startAt >= 10000) {
          return { path: outputPath, sourceInSeconds: sourceIn, sourceOutSeconds: sourceOut };
        }
        lastSize = size;
      } catch (_) { stableCount = 0; lastSize = -1; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('انتهت مهلة تجهيز الجزء المحدد. تأكد من اكتمال التصدير في Adobe Media Encoder ثم أعد المحاولة.');
  }

  function deleteTemporaryMediaFile(filePath) {
    try {
      const fs = require('fs');
      if (typeof fs.unlinkSync === 'function' && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      else if (typeof fs.unlink === 'function') return fs.unlink(filePath);
    } catch (error) { console.warn('[PremiereAPI] Could not remove temporary transcription audio:', error); }
  }

  async function ensureVideoTrackClear(trackIndex, startSeconds, durationSeconds) {
    const ppro = _getPProModule();
    const project = await ppro?.Project?.getActiveProject();
    const sequence = project && await project.getActiveSequence();
    if (!sequence) throw new Error('افتح Sequence قبل إدراج لقطة B-roll.');
    const trackCount = await sequence.getVideoTrackCount();
    if (trackIndex >= trackCount) throw new Error(`أضف مسار فيديو ${trackIndex === 1 ? 'V2' : `V${trackIndex + 1}`} في التايملاين، ثم أعد المحاولة.`);
    const track = await sequence.getVideoTrack(trackIndex);
    const clipType = ppro.Constants?.TrackItemType?.CLIP ?? 1;
    const items = await track.getTrackItems(clipType, false);
    const proposedEnd = startSeconds + durationSeconds;
    for (const item of items || []) {
      const [start, end] = await Promise.all([item.getStartTime(), item.getEndTime()]);
      if (Number(start?.seconds) < proposedEnd && Number(end?.seconds) > startSeconds) {
        throw new Error(`المسار ${trackIndex === 1 ? 'V2' : `V${trackIndex + 1}`} مشغول عند هذا التوقيت. أفرغ المساحة أو غيّر موضع الإدراج حتى لا يتم استبدال أي مقطع.`);
      }
    }
    return true;
  }

  async function addSequenceMarkers(markers) {
    if (!Array.isArray(markers) || !markers.length) throw new Error('اختر علامة فصل واحدة على الأقل.');
    const ppro = _getPProModule();
    const project = await ppro?.Project?.getActiveProject();
    const sequence = project && await project.getActiveSequence();
    if (!sequence) throw new Error('افتح Sequence قبل إضافة علامات الفصول.');
    if (!ppro?.Markers?.getMarkers || !ppro?.TickTime?.createWithSeconds || typeof project.executeTransaction !== 'function') {
      throw new Error('واجهة علامات Premiere غير متاحة في هذا الإصدار.');
    }
    const markerCollection = await ppro.Markers.getMarkers(sequence);
    const actions = markers.map(marker => {
      const seconds = Number(marker.startSeconds);
      if (!Number.isFinite(seconds) || seconds < 0) throw new Error('وجدت توقيت علامة غير صالح.');
      return markerCollection.createAddMarkerAction(
        String(marker.name || 'فصل جديد').slice(0, 80),
        'Chapter',
        ppro.TickTime.createWithSeconds(seconds),
        ppro.TickTime.createWithSeconds(0),
        String(marker.comments || '').slice(0, 500)
      );
    });
    if (actions.some(action => !action)) throw new Error('تعذر تجهيز أوامر علامات الفصول.');
    let transactionResult = false;
    const run = () => {
      transactionResult = project.executeTransaction(compoundAction => {
        actions.forEach(action => compoundAction.addAction(action));
      }, 'Mickey Studio: Add Chapter Markers');
    };
    run();
    if (transactionResult === false) throw new Error('لم يتمكن Premiere من إضافة علامات الفصول.');
    return actions.length;
  }

  async function getActiveProject() {
    const ppro = _getPProModule();
    if (!ppro || !ppro.Project || typeof ppro.Project.getActiveProject !== 'function') return null;
    try {
      return await ppro.Project.getActiveProject();
    } catch (_) {
      return null;
    }
  }

  async function getActiveSequence(project = null) {
    const proj = project || (await getActiveProject());
    if (!proj || typeof proj.getActiveSequence !== 'function') return null;
    try {
      return await proj.getActiveSequence();
    } catch (_) {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // 7. PUBLIC INTERFACE
  // ------------------------------------------------------------------
  return {
    getPremiereState,
    getActiveProject,
    getActiveSequence,
    pickLocalFiles,
    pickLocalFile,
    importFilesToProject,
    importFileToProject,
    findProjectItemByName,
    findProjectItemWithRetry,
    insertProjectItemToTimeline,
    executeMotionScene,
    getVideoEffects,
    applyVideoEffectToSelection,
    getSelectedClipTranscripts,
    exportClipAudioRangeForTranscription,
    deleteTemporaryMediaFile,
    ensureVideoTrackClear,
    addSequenceMarkers,
    getPPro: _getPProModule,
    SUPPORTED_MEDIA_TYPES,
  };
})();
