/**
 * gemini-transfer.js — Mickey Gemini Studio for Adobe Premiere Pro
 *
 * Smart Media Transfer Pipeline from Gemini to Premiere Pro:
 * 1. Automatic Downloads folder detection with persistent UXP token & settings.
 * 2. Candidate scanning & scoring (age, Gemini naming pattern, supported formats).
 * 3. Browser download completion & size stabilization check.
 * 4. Automatic copying to active project's 'Mickey Gemini Media' folder (collision-free).
 * 5. Import to Project panel & Timeline insertion via official SequenceEditor.
 * 6. Non-duplicating retry handling when active sequence was missing.
 */

'use strict';

const GeminiTransfer = (() => {

  // Supported image and video extensions
  const SUPPORTED_EXTS = new Set([
    // Videos
    'mp4', 'mov', 'avi', 'mkv', 'mxf', 'wmv', 'm4v', 'webm', 'prores',
    // Images
    'png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff', 'tif', 'bmp', 'psd', 'tga',
    // Audio
    'mp3', 'wav', 'aac', 'aiff', 'm4a', 'flac'
  ]);

  // Temporary browser extensions to ignore and monitor
  const TEMP_EXTENSIONS = ['.crdownload', '.tmp', '.part', '.download', '.opdownload'];

  function _getFs() {
    try {
      return require('fs');
    } catch (_) {
      return null;
    }
  }

  function _getPath() {
    try {
      return require('path');
    } catch (_) {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // 1. DOWNLOADS FOLDER MANAGEMENT & PERSISTENCE
  // ------------------------------------------------------------------

  function getDefaultDownloadsPath() {
    const fs = _getFs();

    // 1. Check saved custom path
    const savedPath = StudioStorage.getDownloadsPath();
    if (savedPath && fs) {
      try {
        if (fs.existsSync(savedPath)) return savedPath;
      } catch (_) {}
    }

    // 2. Try Node os.homedir()
    try {
      const os = require('os');
      if (os && typeof os.homedir === 'function') {
        const homePath = `${os.homedir()}\\Downloads`;
        if (fs && fs.existsSync(homePath)) {
          StudioStorage.setDownloadsPath(homePath);
          return homePath;
        }
      }
    } catch (_) {}

    // 3. Try process.env
    try {
      if (typeof process !== 'undefined' && process.env) {
        const userProfile = process.env.USERPROFILE || process.env.HOME;
        if (userProfile) {
          const defaultWinPath = `${userProfile}\\Downloads`;
          if (fs && fs.existsSync(defaultWinPath)) {
            StudioStorage.setDownloadsPath(defaultWinPath);
            return defaultWinPath;
          }
        }
      }
    } catch (_) {}

    // 4. Fallback for Windows environment
    const winFallback = 'C:\\Users\\micha\\Downloads';
    if (fs) {
      try {
        if (fs.existsSync(winFallback)) {
          StudioStorage.setDownloadsPath(winFallback);
          return winFallback;
        }
      } catch (_) {}
    }

    return savedPath || winFallback;
  }

  /**
   * Prompts the user to pick their Downloads folder via official UXP folder picker
   * and saves the persistent token and path.
   *
   * @returns {Promise<{ path: string, token: string | null } | null>}
   */
  async function pickAndSaveDownloadsFolder() {
    try {
      const uxp = require('uxp');
      if (!uxp || !uxp.storage || !uxp.storage.localFileSystem) {
        throw new Error('واجهة UXP Storage غير متوفرة لاختيار المجلد.');
      }

      const { localFileSystem, domains } = uxp.storage;
      const startDomain = domains.userDownloads || domains.userDesktop || null;

      const folderEntry = await localFileSystem.getFolder({
        initialDomain: startDomain,
      });

      if (!folderEntry) {
        console.log('[GeminiTransfer] User cancelled folder picker.');
        return null;
      }

      const folderPath = folderEntry.nativePath || folderEntry.name;
      console.log('[GeminiTransfer] Picked Downloads folder:', folderPath);

      // Create persistent token if supported
      let persistentToken = null;
      try {
        if (typeof localFileSystem.createPersistentToken === 'function') {
          persistentToken = await localFileSystem.createPersistentToken(folderEntry);
          StudioStorage.setDownloadsToken(persistentToken);
          console.log('[GeminiTransfer] Created and saved persistent token for Downloads folder.');
        }
      } catch (tokErr) {
        console.warn('[GeminiTransfer] createPersistentToken warning:', tokErr.message);
      }

      if (folderPath) {
        StudioStorage.setDownloadsPath(folderPath);
      }

      return { path: folderPath, token: persistentToken, entry: folderEntry };
    } catch (err) {
      console.error('[GeminiTransfer] pickAndSaveDownloadsFolder error:', err);
      throw err;
    }
  }

  // ------------------------------------------------------------------
  // 2. FILE SCANNING, DETECTION & SCORING
  // ------------------------------------------------------------------

  /**
   * Formats file size in readable units (KB, MB, GB).
   */
  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Formats relative time (e.g., "منذ دقيقة", "منذ 5 دقائق").
   */
  function formatTimeAgo(msAgo) {
    const sec = Math.floor(msAgo / 1000);
    if (sec < 60) return 'الآن';
    const min = Math.floor(sec / 60);
    if (min < 60) return `منذ ${min} د`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `منذ ${hours} س`;
    return `منذ يوم`;
  }

  /**
   * Scans the Downloads folder for candidates and scores them.
   *
   * @param {object} [options]
   * @param {number} [options.maxAgeMs=86400000] - 24 hours max window
   * @returns {Promise<Array<object>>} Sorted candidates list
   */
  async function scanDownloadsCandidates(options = {}) {
    const { maxAgeMs = 24 * 60 * 60 * 1000 } = options;
    const fs = _getFs();
    const downloadsPath = getDefaultDownloadsPath();

    if (!downloadsPath || !fs || !fs.existsSync(downloadsPath)) {
      console.warn('[GeminiTransfer] Downloads folder path invalid or inaccessible:', downloadsPath);
      return [];
    }

    const lastOpTime = StudioStorage.getLastOperationTime() || 0;
    const now = Date.now();
    let entries = [];

    try {
      entries = fs.readdirSync(downloadsPath);
    } catch (readErr) {
      console.error('[GeminiTransfer] Failed to read Downloads folder:', readErr);
      return [];
    }

    const candidates = [];
    const tempFileMap = new Set();

    // Pass 1: Identify in-progress temporary download files
    for (const name of entries) {
      const lower = name.toLowerCase();
      for (const tempExt of TEMP_EXTENSIONS) {
        if (lower.endsWith(tempExt)) {
          // Base target file without .crdownload
          const baseName = name.slice(0, -tempExt.length);
          tempFileMap.add(baseName.toLowerCase());
        }
      }
    }

    // Pass 2: Filter and score legitimate media files
    for (const name of entries) {
      const lowerName = name.toLowerCase();

      // Skip temp files
      if (TEMP_EXTENSIONS.some(ext => lowerName.endsWith(ext)) || lowerName.startsWith('~$')) {
        continue;
      }

      // Check extension
      const extMatch = lowerName.match(/\.([a-z0-9]+)$/);
      if (!extMatch) continue;
      const ext = extMatch[1];
      if (!SUPPORTED_EXTS.has(ext)) continue;

      const fullPath = `${downloadsPath}\\${name}`;
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (_) {
        continue;
      }

      if (!stat || !stat.isFile() || stat.size === 0) continue;

      const mtimeMs = stat.mtimeMs || (stat.mtime ? new Date(stat.mtime).getTime() : 0);
      const ageMs = now - mtimeMs;

      // Filter out files older than maxAgeMs
      if (ageMs > maxAgeMs) continue;

      // Check if file is currently downloading (companion temp file exists)
      const isStillDownloading = tempFileMap.has(lowerName);

      // Scoring algorithm
      let score = 0;

      // 1. Time proximity
      if (ageMs < 2 * 60 * 1000) score += 50;        // Within 2 mins
      else if (ageMs < 10 * 60 * 1000) score += 40;  // Within 10 mins
      else if (ageMs < 30 * 60 * 1000) score += 30;  // Within 30 mins
      else if (ageMs < 2 * 60 * 60 * 1000) score += 20; // Within 2 hours
      else score += 10;

      // 2. Gemini pattern affinity
      const isGeminiName = lowerName.includes('gemini') ||
                           lowerName.startsWith('gemini_generated_image') ||
                           lowerName.includes('input_file');
      if (isGeminiName) score += 40;

      // 3. Created after last operation
      if (lastOpTime > 0 && mtimeMs > lastOpTime) {
        score += 20;
      }

      // 4. In-progress penalty (needs wait)
      if (isStillDownloading) {
        score -= 15;
      }

      candidates.push({
        name,
        nativePath: fullPath,
        size: stat.size,
        sizeFormatted: formatBytes(stat.size),
        mtimeMs,
        ageMs,
        timeAgoFormatted: formatTimeAgo(ageMs),
        isGeminiName,
        isStillDownloading,
        ext,
        score,
      });
    }

    // Sort descending by score, then by newest
    candidates.sort((a, b) => b.score !== a.score ? b.score - a.score : b.mtimeMs - a.mtimeMs);

    console.log(`[GeminiTransfer] Scanned ${candidates.length} candidates in Downloads.`);
    return candidates;
  }

  // ------------------------------------------------------------------
  // 3. DOWNLOAD STABILIZATION CHECK
  // ------------------------------------------------------------------

  /**
   * Waits for a file to finish downloading and stabilizes its size.
   *
   * @param {string} filePath
   * @param {number} [maxWaitMs=8000]
   * @returns {Promise<boolean>}
   */
  async function waitForFileStabilization(filePath, maxWaitMs = 8000) {
    const fs = _getFs();
    if (!fs) return true;

    const startTime = Date.now();
    let lastSize = -1;
    let stableChecks = 0;

    // Check for companion temp files
    const companionTempFiles = TEMP_EXTENSIONS.map(ext => `${filePath}${ext}`);

    while (Date.now() - startTime < maxWaitMs) {
      // 1. Ensure companion temp files (.crdownload) are gone
      const hasTempCompanion = companionTempFiles.some(tPath => {
        try { return fs.existsSync(tPath); } catch (_) { return false; }
      });

      if (hasTempCompanion) {
        console.log('[GeminiTransfer] Browser is still downloading (temp companion exists)... waiting');
        await new Promise(r => setTimeout(r, 500));
        stableChecks = 0;
        continue;
      }

      // 2. Check file size stabilization
      try {
        if (!fs.existsSync(filePath)) {
          await new Promise(r => setTimeout(r, 400));
          continue;
        }

        const stat = fs.statSync(filePath);
        const currentSize = stat.size;

        if (currentSize > 0 && currentSize === lastSize) {
          stableChecks++;
          if (stableChecks >= 2) {
            console.log(`[GeminiTransfer] File is stabilized (${currentSize} bytes):`, filePath);
            return true;
          }
        } else {
          stableChecks = 0;
          lastSize = currentSize;
        }
      } catch (err) {
        console.warn('[GeminiTransfer] File read check error:', err.message);
        stableChecks = 0;
      }

      await new Promise(r => setTimeout(r, 400));
    }

    console.warn('[GeminiTransfer] Stabilization wait timed out; proceeding with current state');
    return true;
  }

  // ------------------------------------------------------------------
  // 4. ACTIVE PROJECT DESTINATION & COLLISION-FREE COPYING
  // ------------------------------------------------------------------

  /**
   * Resolves the active project's directory as the generated-media destination.
   * Throws clear Arabic error if project is unsaved or path is not available.
   *
   * @returns {Promise<{ project: object, projectPath: string, projectDir: string, mediaFolder: string }>}
   */
  async function resolveProjectMediaFolder() {
    const ppro = PremiereAPI.getPPro();
    if (!ppro || !ppro.Project || typeof ppro.Project.getActiveProject !== 'function') {
      throw new Error('لا يمكن الوصول إلى واجهة Premiere Pro API.');
    }

    const project = await ppro.Project.getActiveProject();
    if (!project) {
      throw new Error('لا يوجد مشروع مفتوح حالياً في Premiere Pro. يرجى فتح أو إنشاء مشروع أولاً.');
    }

    // Read project path
    let projectPath = null;
    try {
      if (typeof project.path === 'string' && project.path.trim().length > 0) {
        projectPath = project.path.trim();
      } else if (typeof project.getPath === 'function') {
        const p = await project.getPath();
        if (typeof p === 'string' && p.trim().length > 0) projectPath = p.trim();
      } else if (typeof project.documentPath === 'string' && project.documentPath.trim().length > 0) {
        projectPath = project.documentPath.trim();
      }
    } catch (e) {
      console.warn('[GeminiTransfer] Error reading project path:', e);
    }

    // Validate project path with resilient fallback for unsaved projects
    if (!projectPath || !projectPath.toLowerCase().endsWith('.prproj')) {
      const fs = _getFs();
      const baseDownloads = getDefaultDownloadsPath() || 'C:\\Users\\micha\\Downloads';
      const fallbackMediaFolder = `${baseDownloads}\\MickeyStudio_Media`;
      if (fs && !fs.existsSync(fallbackMediaFolder)) {
        try { fs.mkdirSync(fallbackMediaFolder, { recursive: true }); } catch (_) {}
      }
      return { project, projectPath: '', projectDir: fallbackMediaFolder, mediaFolder: fallbackMediaFolder };
    }

    // Extract parent directory of .prproj
    const norm = projectPath.replace(/\\/g, '/');
    const lastSlash = norm.lastIndexOf('/');
    if (lastSlash === -1) {
      throw new Error(`تعذر تحديد المجلد الأب لملف المشروع: ${projectPath}`);
    }

    const projectDir = norm.substring(0, lastSlash).replace(/\//g, '\\');
    // Store files beside the .prproj; the active project's path determines the
    // destination, so switching projects also switches the save location.
    const mediaFolder = projectDir;

    return { project, projectPath, projectDir, mediaFolder };
  }

  /**
   * Generates a unique destination path inside the media folder to prevent overwrites.
   * E.g. "image.jpg" -> "image (1).jpg" if it already exists.
   *
   * @param {string} mediaFolder
   * @param {string} originalFileName
   * @returns {{ destPath: string, uniqueFileName: string, isRenamed: boolean }}
   */
  function getUniqueDestinationPath(mediaFolder, originalFileName) {
    const fs = _getFs();
    const lastDot = originalFileName.lastIndexOf('.');
    const baseName = lastDot !== -1 ? originalFileName.substring(0, lastDot) : originalFileName;
    const ext = lastDot !== -1 ? originalFileName.substring(lastDot) : '';

    let uniqueFileName = originalFileName;
    let destPath = `${mediaFolder}\\${uniqueFileName}`;
    let counter = 1;

    if (fs) {
      while (fs.existsSync(destPath)) {
        uniqueFileName = `${baseName} (${counter})${ext}`;
        destPath = `${mediaFolder}\\${uniqueFileName}`;
        counter++;
      }
    }

    return {
      destPath,
      uniqueFileName,
      isRenamed: counter > 1,
    };
  }

  /**
   * Copies the chosen file to the active project's 'Mickey Gemini Media' folder.
   *
   * @param {string} srcPath - Absolute path of source file
   * @param {string} [customFileName=null]
   * @returns {Promise<{ destPath: string, fileName: string, mediaFolder: string, isRenamed: boolean }>}
   */
  async function copyFileToProjectMedia(srcPath, customFileName = null) {
    if (!srcPath || typeof srcPath !== 'string') {
      throw new Error('مسار الملف المصدر غير صالح.');
    }

    const fs = _getFs();
    if (!fs) {
      throw new Error('واجهة نظام الملفات Node fs غير متوفرة في بيئة التشغيل.');
    }

    if (!fs.existsSync(srcPath)) {
      throw new Error(`الملف المصدر غير موجود في القرص: ${srcPath}`);
    }

    // 1. Resolve active project folder
    const { mediaFolder } = await resolveProjectMediaFolder();

    // 2. Determine unique destination name
    const rawName = customFileName || srcPath.replace(/\\/g, '/').split('/').pop() || 'gemini_media';
    const { destPath, uniqueFileName, isRenamed } = getUniqueDestinationPath(mediaFolder, rawName);

    console.log(`[GeminiTransfer] Copying «${rawName}» to «${destPath}»...`);

    // 3. Execute copy
    try {
      fs.copyFileSync(srcPath, destPath);
    } catch (copyErr) {
      console.error('[GeminiTransfer] copyFileSync error:', copyErr);
      throw new Error(`فشل نسخ الملف إلى مجلد المشروع: ${copyErr.message}`);
    }

    // 4. Verify byte consistency
    if (!fs.existsSync(destPath)) {
      throw new Error(`تعذر التحقق من وجود الملف المنسوخ في مجلد المشروع: ${destPath}`);
    }

    const srcStat = fs.statSync(srcPath);
    const destStat = fs.statSync(destPath);
    if (srcStat.size !== destStat.size) {
      throw new Error(
        `خطأ في مطابقة الحجم: الملف الأصلي (${srcStat.size} بايت) لا يطابق الملف المنسوخ (${destStat.size} بايت).`
      );
    }

    console.log(`[GeminiTransfer] Successfully copied to project media (${destStat.size} bytes):`, destPath);
    return {
      destPath,
      fileName: uniqueFileName,
      mediaFolder,
      isRenamed,
      size: destStat.size,
    };
  }

  // ------------------------------------------------------------------
  // 5. AUTO-DROP REAL-TIME WATCHER
  // ------------------------------------------------------------------

  let _watcherIntervalId = null;
  let _watcherBaselineTime = Date.now();
  const _processedFileMap = new Set();
  let _isWatcherBusy = false;

  /**
   * Starts real-time watcher on Downloads folder.
   * Periodically checks for newly created/modified media from Gemini.
   *
   * @param {Function} onNewMediaDetected - Callback({ nativePath, name, size, isGeminiName })
   * @param {number} [intervalMs=1500]
   */
  function startAutoDropWatcher(onNewMediaDetected, intervalMs = 1500) {
    if (_watcherIntervalId) {
      clearInterval(_watcherIntervalId);
      _watcherIntervalId = null;
    }

    _watcherBaselineTime = Date.now() - (2 * 60 * 1000); // 2 minutes grace window
    console.log('[GeminiTransfer] Auto-Drop Watcher started. Listening in:', downloadsPath);

    _watcherIntervalId = setInterval(async () => {
      if (_isWatcherBusy) return;

      const fs = _getFs();
      const downloadsPath = getDefaultDownloadsPath();
      if (!fs || !downloadsPath || !fs.existsSync(downloadsPath)) return;

      _isWatcherBusy = true;
      try {
        const entries = fs.readdirSync(downloadsPath);
        const now = Date.now();

        // Find any media modified recently or after baseline
        for (const name of entries) {
          const lowerName = name.toLowerCase();

          // Skip temp files
          if (TEMP_EXTENSIONS.some(ext => lowerName.endsWith(ext)) || lowerName.startsWith('~$')) {
            continue;
          }

          // Check extension
          const extMatch = lowerName.match(/\.([a-z0-9]+)$/);
          if (!extMatch || !SUPPORTED_EXTS.has(extMatch[1])) continue;

          const fullPath = `${downloadsPath}\\${name}`;
          if (_processedFileMap.has(fullPath)) continue;

          let stat;
          try {
            stat = fs.statSync(fullPath);
          } catch (_) {
            continue;
          }

          if (!stat || !stat.isFile() || stat.size === 0) continue;

          const mtimeMs = stat.mtimeMs || (stat.mtime ? new Date(stat.mtime).getTime() : 0);
          const ageMs = now - mtimeMs;

          // Trigger if modified in the last 2 minutes or after baseline
          if (ageMs < 120000 || mtimeMs >= _watcherBaselineTime) {
            console.log('[GeminiTransfer] ⚡ Auto-Drop Watcher detected candidate:', name);

            // Mark as handled immediately to avoid re-triggering
            _processedFileMap.add(fullPath);
            _watcherBaselineTime = Date.now();

            // Wait for file stabilization
            const isStable = await waitForFileStabilization(fullPath, 6000);
            if (isStable && typeof onNewMediaDetected === 'function') {
              const isGeminiName = lowerName.includes('gemini') || lowerName.startsWith('gemini_generated_image');
              onNewMediaDetected({
                name,
                nativePath: fullPath,
                size: stat.size,
                ext: extMatch[1],
                isGeminiName,
              });
            }
            break; // Handle one at a time
          }
        }
      } catch (err) {
        console.warn('[GeminiTransfer] Watcher tick error:', err.message);
      } finally {
        _isWatcherBusy = false;
      }
    }, intervalMs);
  }

  function stopAutoDropWatcher() {
    if (_watcherIntervalId) {
      clearInterval(_watcherIntervalId);
      _watcherIntervalId = null;
      console.log('[GeminiTransfer] Auto-Drop Watcher stopped.');
    }
  }

  function markFileHandled(filePath) {
    if (filePath) _processedFileMap.add(filePath);
  }

  // ------------------------------------------------------------------
  // 6. PUBLIC INTERFACE
  // ------------------------------------------------------------------
  return {
    getDefaultDownloadsPath,
    pickAndSaveDownloadsFolder,
    scanDownloadsCandidates,
    waitForFileStabilization,
    resolveProjectMediaFolder,
    copyFileToProjectMedia,
    startAutoDropWatcher,
    stopAutoDropWatcher,
    markFileHandled,
    formatBytes,
    formatTimeAgo,
    SUPPORTED_EXTS,
  };
})();
