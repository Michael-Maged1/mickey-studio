/**
 * premiere-media.js — Mickey Studio for Adobe Premiere Pro for Adobe Premiere Pro
 *
 * Premiere media import and timeline utilities for Mickey Studio:
 * Saves platform-generated media and inserts it into the active Premiere project.
 */

'use strict';

const PremiereMedia = (() => {

  const STYLE_MODIFIERS = {
    cinematic: 'cinematic lighting, dramatic composition, film still, 35mm lens, depth of field, 8k resolution, color graded',
    photoreal: 'hyperrealistic, high detail raw photo, professional photography, natural lighting, 8k, sharp focus',
    cyberpunk: 'cyberpunk style, neon lights, dark dystopian futuristic atmosphere, volumetric fog, glowing reflections, ultra-detailed',
    anime: 'anime art style, vibrant colors, Studio Ghibli inspired, high quality digital illustration, clean line art',
    digitalart: 'stunning digital art, concept art masterpiece, trending on ArtStation, vivid colors, intricate details',
    unreal3d: '3D render, Unreal Engine 5, Octane render, ray tracing, ultra realistic materials, cinematic render',
  };

  function _getFs() {
    try {
      return require('fs');
    } catch (_) {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Save generated media to the active project and timeline
  // ------------------------------------------------------------------

  /**
   * Converts base64 to binary Uint8Array.
   */
  function _base64ToUint8Array(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Saves generated image data into the active project's 'Mickey Gemini Media' folder,
   * imports it into Premiere Pro, and drops it onto the active Timeline.
   *
   * @param {string} base64Data
   * @param {string} mimeType
   * @param {string} [promptLabel='gemini_ai']
   * @returns {Promise<{ destPath: string, fileName: string, projectItem: object, insertedToTimeline: boolean }>}
   */
  async function saveAndInsertImage(base64Data, mimeType = 'image/jpeg', promptLabel = 'gemini_ai', insertOptions = {}) {
    const fs = _getFs();
    const ext = mimeType.includes('png') ? '.png' : '.jpg';
    const timestamp = Date.now();
    const cleanLabel = promptLabel
      .replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')
      .substring(0, 25);
    const baseName = `Mickey_AI_${cleanLabel || 'Image'}_${timestamp}${ext}`;

    // Browser Preview Fallback (outside Premiere UXP environment)
    if (!fs) {
      console.warn('[PremiereMedia] Running in standard browser environment. Triggering blob preview/download.');
      const bytes = _base64ToUint8Array(base64Data);
      const blob = new Blob([bytes], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      // Save into recent history
      StudioStorage.addRecentFile({
        name: baseName,
        nativePath: blobUrl,
        type: 'ai-image',
        timestamp: Date.now(),
      });

      return {
        destPath: blobUrl,
        fileName: baseName,
        projectItem: null,
        insertedToTimeline: false,
        isBrowserPreview: true,
      };
    }

    // 1. Resolve project folder
    const { mediaFolder } = await GeminiTransfer.resolveProjectMediaFolder();

    const destPath = `${mediaFolder}\\${baseName}`;

    // 2. Write binary data
    const bytes = _base64ToUint8Array(base64Data);
    try {
      const buffer = typeof Buffer !== 'undefined' ? Buffer.from(bytes) : bytes;
      fs.writeFileSync(destPath, buffer);
      console.log('[PremiereMedia] Image written to project folder:', destPath);
    } catch (writeErr) {
      console.error('[PremiereMedia] File write error:', writeErr);
      throw new Error(`تعذر حفظ الصورة في مجلد المشروع: ${writeErr.message}`);
    }

    // 3. Import to Project Panel
    await PremiereAPI.importFileToProject(destPath);

    // 4. Resolve ProjectItem
    const ppro = PremiereAPI.getPPro();
    const project = await ppro.Project.getActiveProject();
    const projectItem = await PremiereAPI.findProjectItemWithRetry(project, baseName, destPath, 6, 300);

    if (!projectItem) {
      throw new Error('تم حفظ الصورة بنجاح ولكن تعذر تحديد عنصر المشروع (ProjectItem) في الـ Bins.');
    }

    // 5. Check Sequence and Insert into Timeline
    const sequence = await project.getActiveSequence();
    let insertedToTimeline = false;

    if (sequence && insertOptions.insertToTimeline !== false) {
      await PremiereAPI.insertProjectItemToTimeline(projectItem, insertOptions);
      insertedToTimeline = true;
    }

    // Save into recent history
    StudioStorage.addRecentFile({
      name: baseName,
      nativePath: destPath,
      type: 'ai-image',
      timestamp: Date.now(),
    });

    return {
      destPath,
      fileName: baseName,
      projectItem,
      insertedToTimeline,
    };
  }

  // ------------------------------------------------------------------
  // PUBLIC INTERFACE
  return {
    saveAndInsertImage,
    STYLE_MODIFIERS,
  };
})();
