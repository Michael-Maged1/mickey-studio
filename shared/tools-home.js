/**
 * shared/tools-home.js
 * Card-Based Home Screen & Unified Router Engine
 * Shared between Adobe Premiere CEP Extension & Mickey Studio Web Platform
 */
'use strict';

(function (root, factory) {
  var router = factory();
  if (typeof root !== 'undefined' && root) {
    root.MickeyRouter = router;
  }
  if (typeof window !== 'undefined' && window) {
    window.MickeyRouter = router;
  }
  if (typeof globalThis !== 'undefined' && globalThis) {
    globalThis.MickeyRouter = router;
  }
  if (typeof module === 'object' && module && module.exports) {
    module.exports = router;
  }
  if (typeof define === 'function' && define.amd) {
    define([], function () { return router; });
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Pinned Lucide SVG path definitions (v0.468.0, ISC License) for zero-latency offline rendering
  const LUCIDE_ICONS = {
    'scissors': '<circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line>',
    'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path>',
    'mic': '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>',
    'podcast': '<circle cx="12" cy="11" r="1"></circle><path d="M4.93 18.07a10 10 0 0 1 0-14.14"></path><path d="M19.07 3.93a10 10 0 0 1 0 14.14"></path><path d="M7.76 15.24a6 6 0 0 1 0-8.48"></path><path d="M16.24 6.76a6 6 0 0 1 0 8.48"></path><path d="M12 12v10"></path>',
    'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>',
    'file-audio': '<path d="M17.5 22h.5c.5 0 1-.2 1.4-.6.4-.4.6-.9.6-1.4V7.5L14.5 2H6c-.5 0-1 .2-1.4.6C4.2 3 4 3.5 4 4v3"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M10 20v-1a2 2 0 1 1 4 0v1a2 2 0 1 1-4 0Z"></path><path d="M6 20v-1a2 2 0 1 0-4 0v1a2 2 0 1 0 4 0Z"></path><path d="M2 19v-3a6 6 0 0 1 12 0v3"></path>',
    'image': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>',
    'wand-sparkles': '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"></path><path d="m5 2 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z"></path><path d="M20 18l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5.5-1Z"></path>',
    'film': '<rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M7 3v18"></path><path d="M3 7.5h4"></path><path d="M3 12h18"></path><path d="M3 16.5h4"></path><path d="M17 3v18"></path><path d="M17 7.5h4"></path><path d="M17 16.5h4"></path>',
    'sparkles': '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>',
    'layers': '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"></path><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"></path><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"></path>',
    'smartphone': '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path>',
    'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
    'folder-tree': '<path d="M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z"></path><path d="M3 21v-8a2 2 0 0 1 2-2h4"></path><path d="M3 13h4"></path><path d="M3 8V5a2 2 0 0 1 2-2h2"></path><circle cx="17" cy="18" r="3"></circle>',
    'folder-archive': '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path><circle cx="12" cy="13" r="2"></circle><path d="M12 15v5"></path>',
    'activity': '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
    'code': '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>',
    'list-todo': '<rect x="3" y="5" width="6" height="6" rx="1"></rect><path d="m3 17 2 2 4-4"></path><path d="M13 6h8"></path><path d="M13 12h8"></path><path d="M13 18h8"></path>',
    'arrow-right': '<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>',
    'search': '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>',
    'clock': '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
    'x': '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
    'zoom-in': '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line>',
    'captions': '<rect width="18" height="14" x="3" y="5" rx="2" ry="2"></rect><path d="M7 15h4M15 15h2M7 11h2M13 11h4"></path>',
    'volume-x': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="22" y1="9" x2="16" y2="15"></line><line x1="16" y1="9" x2="22" y2="15"></line>',
    'flame': '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>',
    'bookmark': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>',
    'video': '<path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2" ry="2"></rect>'
  };

  function getLucideSvg(iconName, extraClass = '') {
    const paths = LUCIDE_ICONS[iconName] || LUCIDE_ICONS['sparkles'];
    return `<svg class="mickey-card-icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  }

  // Embedded default registry fallback (synced with shared/tools-registry.json)
  const DEFAULT_REGISTRY = {
    groups: ["المونتاج", "النص والمحتوى", "الصوت", "الصور والفيديو", "الموشن والمنصات", "أدوات المشروع"],
    tools: [
      { id: "silence-cut", arabicName: "قص السكتات", shortBenefit: "حذف فترات الصمت والوقفات تلقائياً لتسريع إيقاع الفيديو", icon: "scissors", group: "المونتاج", badge: "جديد", target: { ext: "page-silence-cut", site: "section-autocut-suite" }, availableIn: "both", order: 1 },
      { id: "auto-zoom", arabicName: "الزووم التلقائي", shortBenefit: "تطبيق تقريب مركزي قابل للاختيار على الفيديو", icon: "zoom-in", group: "المونتاج", badge: null, target: { ext: "page-auto-zoom", site: "section-autocut-suite" }, availableIn: "both", order: 2 },
      { id: "text-montage", arabicName: "المونتاج بالنص", shortBenefit: "حذف الكلمات والمشاهد غير المرغوبة من خلال قراءة النص", icon: "file-text", group: "المونتاج", badge: null, target: { ext: "page-text-montage", site: null }, availableIn: "ext", order: 3 },
      { id: "multicam", arabicName: "مالتي كام البودكاست", shortBenefit: "تبديل زاوية الكاميرا تلقائياً على التايملاين بين المتحدثين", icon: "video", group: "المونتاج", badge: null, target: { ext: "page-multicam", site: null }, availableIn: "ext", order: 4 },
      { id: "captions", arabicName: "الكابشنز المتحركة", shortBenefit: "توليد نصوص متحركة وشفافة بتأثيرات كاريوكي وبوب-إن متزامنة حياً للمقاطع", icon: "captions", group: "النص والمحتوى", badge: "جديد", target: { ext: "page-captions", site: "section-autocut-suite" }, availableIn: "both", order: 5 },
      { id: "word-mute", arabicName: "حجب الكلمات", shortBenefit: "كشف وحجب الألفاظ المحظورة مع إدراج صفارة الرقابة الصوتية تلقائياً", icon: "volume-x", group: "النص والمحتوى", badge: null, target: { ext: "page-word-mute", site: "section-autocut-suite" }, availableIn: "both", order: 6 },
      { id: "viral-clips", arabicName: "المقاطع الفيروسية", shortBenefit: "اقتطاع اللحظات الأكثر تفاعلاً وإثارة لصناعة مقاطع ريلز وشورتس", icon: "flame", group: "النص والمحتوى", badge: null, target: { ext: "page-viral-clips", site: "section-autocut-suite" }, availableIn: "both", order: 7 },
      { id: "yt-chapters", arabicName: "فصول يوتيوب", shortBenefit: "توليد فصول وتوقيتات زمنية جاهزة لوصف فيديو يوتيوب مع ماركرز", icon: "bookmark", group: "النص والمحتوى", badge: null, target: { ext: "page-yt-chapters", site: "section-autocut-suite" }, availableIn: "both", order: 8 },
      { id: "transcript-hub", arabicName: "مركز التفريغ", shortBenefit: "تفريغ الكلام وتحويل التسجيلات إلى نصوص دقيقة بالمللي ثانية", icon: "file-audio", group: "النص والمحتوى", badge: null, target: { ext: "page-transcript", site: "section-transcribe-studio" }, availableIn: "both", order: 9 },
      { id: "audio-clean", arabicName: "تحسين نبرة الصوت", shortBenefit: "تشكيل نبرة الصوت بمرشحات ومعادل صوتي للمعاينة والتصدير", icon: "sparkles", group: "الصوت", badge: null, target: { ext: "page-audio-clean", site: "section-autocut-suite" }, availableIn: "both", order: 10 },
      { id: "voice-studio", arabicName: "التعليق الصوتي", shortBenefit: "تحويل النص المكتوب إلى صوت بشري واقعي فائق الجودة", icon: "mic", group: "الصوت", badge: null, target: { ext: "page-voiceover", site: "section-voice-studio" }, availableIn: "both", order: 11 },
      { id: "podcast-studio", arabicName: "استوديو البودكاست", shortBenefit: "إنشاء حوار صوتي احترافي وتفاعلي بين شخصين بنقرة واحدة", icon: "podcast", group: "الصوت", badge: null, target: { ext: "page-podcast", site: "section-podcast-studio" }, availableIn: "both", order: 12 },
      { id: "audiobook-studio", arabicName: "الكتب والروايات", shortBenefit: "قراءة الكتب والمقالات الطويلة بصوت متصل ومريح للسمع", icon: "book-open", group: "الصوت", badge: null, target: { ext: "page-audiobook", site: "section-audiobook-studio" }, availableIn: "both", order: 13 },
      { id: "transcribe-studio", arabicName: "تفريغ وتحليل الصوت", shortBenefit: "استخراج النصوص بدقة عالية من التسجيلات ومقاطع التايملاين", icon: "file-audio", group: "الصوت", badge: null, target: { ext: "page-transcript", site: "section-transcribe-studio" }, availableIn: "both", order: 14 },
      { id: "image-studio", arabicName: "توليد الصور", shortBenefit: "ابتكار صور إبداعية وواقعية بمجرد كتابة وصف باللغة العربية", icon: "image", group: "الصور والفيديو", badge: null, target: { ext: "page-create", site: "section-image-studio" }, availableIn: "both", order: 15 },
      { id: "photo-lab", arabicName: "معمل الصور", shortBenefit: "إزالة خلفيات الصور وتحسين الجودة وتكبير الأبعاد بوضوح", icon: "wand-sparkles", group: "الصور والفيديو", badge: null, target: { ext: "page-photolab", site: "section-photo-lab" }, availableIn: "both", order: 16 },
      { id: "video-studio", arabicName: "استوديو الفيديو", shortBenefit: "تحريك الصور وتوليد مقاطع فيديو سينمائية متحركة بالذكاء الاصطناعي", icon: "film", group: "الصور والفيديو", badge: "تجريبي", target: { ext: "page-video", site: "section-video-studio" }, availableIn: "both", order: 17 },
      { id: "motion-builder", arabicName: "صانع الموشن جرافيك", shortBenefit: "تصميم مشاهد موشن جرافيك احترافية جاهزة للإدراج على الفيديو", icon: "sparkles", group: "الموشن والمنصات", badge: "جديد", target: { ext: "page-library", site: "section-motion-builder" }, availableIn: "both", order: 18 },
      { id: "motion-editor", arabicName: "محرر الموشن الاحترافي", shortBenefit: "تحرير طبقات المشهد وحركات العناصر والإطارات بكامل الحرية", icon: "layers", group: "الموشن والمنصات", badge: "جديد", target: { ext: null, site: "section-motion-editor" }, availableIn: "site", hideFromGrid: true, order: 19 },
      { id: "safezone", arabicName: "سيف زون المنصات", shortBenefit: "معاينة المناطق الآمنة لـ Reels وTikTok وShorts فوق خط الزمن", icon: "smartphone", group: "الموشن والمنصات", badge: null, target: { ext: "page-safezone", site: null }, availableIn: "ext", order: 20 },
      { id: "shortcuts", arabicName: "اختصارات المؤثرات", shortBenefit: "تطبيق مفضلات ومؤثرات بريمير الصوتية والبصرية بنقرة واحدة", icon: "star", group: "أدوات المشروع", badge: null, target: { ext: "page-shortcuts", site: null }, availableIn: "ext", order: 21 },
      { id: "organizer", arabicName: "ترتيب المشروع", shortBenefit: "فرز وتنظيم ملفات المشروع في مجلدات ذكية للحفاظ على الترتيب", icon: "folder-tree", group: "أدوات المشروع", badge: null, target: { ext: "page-organizer", site: null }, availableIn: "ext", order: 22 },
      { id: "library", arabicName: "معرض أعمالي ومكتبتي", shortBenefit: "الوصول السريع إلى كل تصاميمك وملفاتك السابقة والمحفوظة", icon: "folder-archive", group: "أدوات المشروع", badge: null, target: { ext: "page-library", site: "section-vault-gallery" }, availableIn: "both", order: 23 },
      { id: "diagnostics", arabicName: "تشخيص النظام", shortBenefit: "فحص اتصال بريمير وسجل الأخطاء وتحديثات المكونات البرمجية", icon: "activity", group: "أدوات المشروع", badge: null, target: { ext: "page-diagnostics", site: null }, availableIn: "ext", hideFromGrid: true, order: 24 },
      { id: "developer-api", arabicName: "بوابة المطورين (API)", shortBenefit: "مفاتيح الربط البرمجي السحابي والتوثيق للمبرمجين مجاناً", icon: "code", group: "أدوات المشروع", badge: null, target: { ext: null, site: "section-developer-api" }, availableIn: "site", order: 25 },
      { id: "jobs-queue", arabicName: "المهام والعمليات الجارية", shortBenefit: "متابعة قائمة التوليدات ومعالجات الذكاء الاصطناعي الخلفية", icon: "list-todo", group: "أدوات المشروع", badge: null, target: { ext: null, site: "modal-jobs-queue" }, availableIn: "site", order: 26 }
    ]
  };

  // Environment detection
  const isExtension = typeof window !== 'undefined' && Boolean(
    window.__adobe_cep__ ||
    window.CSInterface ||
    (typeof navigator !== 'undefined' && /CEP|ExtendScript/i.test(navigator.userAgent))
  );
  const currentEnv = isExtension ? 'ext' : 'site';

  // Storage key for recent tools
  const STORAGE_KEY_RECENT = 'mickey_recent_tools';
  const MAX_RECENT_TOOLS = 3;

  // Tools that interact directly with Adobe Premiere timeline in CEP extension
  const PREMIERE_DEPENDENT_TOOLS = new Set([
    'silence-cut', 'auto-zoom', 'multicam', 'captions', 'word-mute', 'viral-clips', 'yt-chapters', 'audio-clean', 'autocut', 'text-montage', 'safezone', 'shortcuts', 'organizer'
  ]);

  // Active state
  let _registry = DEFAULT_REGISTRY;
  let _currentRoute = 'home';
  let _loadedScripts = new Set();
  let _searchQuery = '';
  let _activeCategoryFilter = 'all';
  let _containerEl = null;
  let _toolHeaderEl = null;

  /**
   * Helper to verify if the CEP Extension has a verified linked account
   */
  function isExtensionAccountLinked() {
    if (!isExtension) return true;
    try {
      if (typeof window !== 'undefined' && window.StudioStorage && typeof window.StudioStorage.isAccountLinked === 'function') {
        return window.StudioStorage.isAccountLinked();
      }
      if (typeof localStorage !== 'undefined') {
        const email = localStorage.getItem('mickey_studio_account_email') || '';
        const token = localStorage.getItem('mickey_studio_firebase_refresh_token') || '';
        const devKey = localStorage.getItem('mickey_studio_dev_api_key') || '';
        return Boolean((email.trim() && token.trim()) || devKey.trim());
      }
    } catch (_) {}
    return false;
  }

  /**
   * Helper to categorize tools for styling and category filtering
   */
  function getToolCategory(tool) {
    if (!tool) return 'gen';
    if (tool.group === 'استوديوهات التوليد والإنتاج' || ['image-studio', 'video-studio', 'motion-builder', 'photolab'].includes(tool.id)) {
      return 'gen';
    }
    if (['voiceover', 'podcast', 'audiobook', 'transcribe-studio'].includes(tool.id)) {
      return 'audio';
    }
    if (['autocut-suite', 'autocut', 'quickcut', 'safezone', 'shortcuts', 'organizer'].includes(tool.id)) {
      return 'edit';
    }
    return 'project';
  }

  /**
   * Arabic text normalization: removes tashkeel, normalizes alefs, taa marbuta, and spaces.
   */
  function normalizeArabic(text) {
    if (!text) return '';
    return String(text)
      .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel & harakat
      .replace(/[أإآٱ]/g, 'ا') // normalize alefs
      .replace(/[ة]/g, 'ه')   // normalize taa marbuta
      .replace(/[ى]/g, 'ي')   // normalize alif maqsura
      .replace(/[\s\-_]+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // One-time migration: reset stored legacyNav flag from older versions so card nav defaults to active (false)
  (function runLegacyNavMigration() {
    if (typeof localStorage === 'undefined') return;
    try {
      const MIGRATION_FLAG = 'mickey_nav_migration_v2';
      if (!localStorage.getItem(MIGRATION_FLAG)) {
        localStorage.removeItem('legacyNav');
        localStorage.setItem('legacyNav', 'false');
        localStorage.setItem(MIGRATION_FLAG, 'true');
      }
    } catch (_) {}
  })();

  /**
   * Rollback Flag Check: checks window.legacyNav and localStorage('legacyNav')
   */
  function isLegacyNav() {
    if (typeof window !== 'undefined') {
      if (window.legacyNav === true) return true;
      if (window.legacyNav === false) return false;
      try {
        if (localStorage.getItem('legacyNav') === 'true') return true;
      } catch (_) {}
    }
    return false;
  }

  /**
   * Rollback Flag Check: checks window.legacyMotionNav and localStorage('legacyMotionNav')
   * If true, preserves old separate "مساعد الموشن جرافيك" and "محرر الموشن الاحترافي" routes.
   */
  function isLegacyMotionNav() {
    if (typeof window !== 'undefined') {
      if (window.legacyMotionNav === true) return true;
      try {
        if (localStorage.getItem('legacyMotionNav') === 'true') return true;
      } catch (_) {}
    }
    return false;
  }

  /**
   * Checks whether Premiere host is currently available in the CEP environment
   */
  function isPremiereHostConnected() {
    if (!isExtension) return true;
    try {
      if (typeof window !== 'undefined' && window.HostBridge) {
        if (typeof window.HostBridge.isHostAvailable === 'function') {
          const avail = window.HostBridge.isHostAvailable();
          if (avail === false) return false;
          if (avail === true) return true;
        }
      }
      const hostStateEl = document.getElementById('host-state');
      if (hostStateEl && (hostStateEl.textContent.includes('غير متصل') || hostStateEl.textContent.includes('خطأ'))) {
        return false;
      }
    } catch (_) {}
    return true;
  }

  /**
   * Displays an Arabic notice banner inside Premiere-dependent tools when the host is unavailable
   */
  function checkPremiereHostNotice(tool) {
    if (!isExtension || !tool || !PREMIERE_DEPENDENT_TOOLS.has(tool.id)) {
      removeHostNoticeBanner();
      return;
    }

    if (!isPremiereHostConnected()) {
      showHostNoticeBanner(tool);
    } else {
      removeHostNoticeBanner();
    }
  }

  function showHostNoticeBanner(tool) {
    let banner = document.getElementById('mickey-host-notice-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'mickey-host-notice-banner';
      banner.setAttribute('role', 'alert');
      banner.style.cssText = 'margin: 8px 12px 14px; padding: 12px 14px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; direction: rtl; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);';
      
      const content = document.querySelector('.content') || document.body;
      content.insertBefore(banner, content.firstChild);
    }

    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
        <span style="font-size: 20px; line-height: 1;">⚠️</span>
        <div>
          <div style="font-size: 12px; font-weight: 700; color: #fecaca; margin-bottom: 2px;">الاتصال بـ Premiere غير متاح حالياً</div>
          <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">أداة "${_escapeHtml(tool.arabicName)}" تتطلب اتصالاً فعالاً ببرنامج Premiere ومشروعاً مفتوحاً للعمل على التايملاين.</div>
        </div>
      </div>
      <button type="button" class="mickey-lazy-retry-btn" id="mickey-btn-host-retry" style="padding: 6px 14px; font-size: 11px; white-space: nowrap;">
        <span>إعادة المحاولة</span>
      </button>
    `;
    banner.style.display = 'flex';
    banner.classList.remove('hidden');

    const retryBtn = banner.querySelector('#mickey-btn-host-retry');
    if (retryBtn) {
      retryBtn.onclick = async () => {
        retryBtn.disabled = true;
        const originalText = retryBtn.innerHTML;
        retryBtn.innerHTML = '<span>جاري الفحص...</span>';
        try {
          if (typeof window !== 'undefined' && window.HostBridge && typeof window.HostBridge.checkOrReloadHost === 'function') {
            await window.HostBridge.checkOrReloadHost({ forceReload: true });
          }
          if (isPremiereHostConnected()) {
            removeHostNoticeBanner();
            if (typeof window.toast === 'function') window.toast('تم الاتصال بـ Premiere بنجاح', 'success');
          } else {
            throw new Error('لا يزال البرنامج غير مستجيب');
          }
        } catch (err) {
          console.warn('[MickeyRouter] Premiere reconnection retry failed:', err);
          if (typeof window.toast === 'function') window.toast('تعذر الاتصال بـ Premiere. تأكد من فتح مشروع.', 'error');
        } finally {
          retryBtn.disabled = false;
          const currentBtn = document.getElementById('mickey-btn-host-retry');
          if (currentBtn) currentBtn.innerHTML = originalText;
        }
      };
    }
  }

  function removeHostNoticeBanner() {
    const banner = document.getElementById('mickey-host-notice-banner');
    if (banner) {
      banner.style.display = 'none';
      banner.remove();
    }
  }

  /**
   * Checks whether a tool currently has a running job.
   */
  function isToolBusy(toolId) {
    try {
      // 1. Website MickeyJobQueue check
      if (typeof window !== 'undefined' && window.MickeyJobQueue && typeof window.MickeyJobQueue.getActiveJobs === 'function') {
        const active = window.MickeyJobQueue.getActiveJobs();
        if (Array.isArray(active) && active.some(j => j.toolId === toolId || j.type === toolId)) return true;
      }
      // 2. Extension MickeyState checks
      if (typeof window !== 'undefined' && window.MickeyState) {
        const s = window.MickeyState;
        if (toolId === 'autocut' && (s.isProcessing || s.isScanning || s.cutInProgress)) return true;
        if (toolId === 'transcribe-studio' && (s.transcribing || s.installingWhisper)) return true;
        if (toolId === 'voice-studio' && s.ttsGenerating) return true;
        if (toolId === 'image-studio' && s.imageGenerating) return true;
        if (toolId === 'video-studio' && s.videoGenerating) return true;
      }
    } catch (_) {}
    return false;
  }

  /**
   * Recent tools management
   */
  function getRecentToolIds() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(STORAGE_KEY_RECENT);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT_TOOLS) : [];
    } catch (_) {
      return [];
    }
  }

  function recordToolUsage(toolId) {
    try {
      if (typeof localStorage === 'undefined' || !toolId) return;
      const list = getRecentToolIds().filter(id => id !== toolId);
      list.unshift(toolId);
      localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(list.slice(0, MAX_RECENT_TOOLS)));
    } catch (_) {}
  }

  /**
   * Returns list of tools available in the current environment (ext vs site)
   */
  function getAvailableTools(includeHidden = false) {
    const legacyMotion = isLegacyMotionNav();
    return _registry.tools
      .map(t => {
        if (t.id === 'motion-builder') {
          return {
            ...t,
            arabicName: legacyMotion ? 'مساعد الموشن جرافيك' : 'الموشن جرافيك'
          };
        }
        if (t.id === 'motion-editor') {
          return {
            ...t,
            hideFromGrid: legacyMotion ? false : true
          };
        }
        return t;
      })
      .filter(t => (t.availableIn === 'both' || t.availableIn === currentEnv) && (includeHidden || !t.hideFromGrid))
      .sort((a, b) => (a.order || 99) - (b.order || 99));
  }

  function getToolById(toolId) {
    if (!toolId) return null;
    const legacyMotion = isLegacyMotionNav();
    const found = _registry.tools.find(t => t.id === toolId);
    if (!found) return null;
    if (found.id === 'motion-builder') {
      return {
        ...found,
        arabicName: legacyMotion ? 'مساعد الموشن جرافيك' : 'الموشن جرافيك'
      };
    }
    return found;
  }

  /**
   * Dynamic Script Lazy Loader
   */
  function loadScript(src) {
    if (!src || _loadedScripts.has(src)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        _loadedScripts.add(src);
        resolve();
      };
      script.onerror = err => {
        console.warn(`[MickeyRouter] Failed loading script: ${src}`, err);
        reject(new Error(`Failed to load script: ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Lazy load scripts mapped to tool on first open
   */
  async function lazyLoadTool(toolId) {
    const tool = getToolById(toolId);
    if (!tool) return;

    if (tool.scripts) {
      const list = Array.isArray(tool.scripts) ? tool.scripts : (tool.scripts[currentEnv] || []);
      for (const s of list) {
        await loadScript(s);
      }
    }

    if (currentEnv === 'site' && typeof window !== 'undefined' && typeof window.ensureStudioLoaded === 'function') {
      await window.ensureStudioLoaded(toolId);
    }
  }

  /**
   * Universal Error Boundary UI for Tool Mount / Load Failures
   */
  function showToolMountError(toolOrId, error) {
    const tool = (typeof toolOrId === 'object' && toolOrId) ? toolOrId : getToolById(toolOrId);
    const toolName = tool ? tool.arabicName : (toolOrId || 'الأداة');
    const toolId = tool ? tool.id : (toolOrId || 'unknown');

    if (_containerEl) {
      _containerEl.classList.add('hidden');
      _containerEl.style.display = 'none';
    }
    hideAllToolViews();
    removeHostNoticeBanner();
    updateToolHeader(tool || { id: toolId, arabicName: toolName });

    let errorEl = document.getElementById('mickey-lazy-load-error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.id = 'mickey-lazy-load-error';
      errorEl.className = 'mickey-lazy-error-container';
      if (isExtension) {
        const content = document.querySelector('.content') || document.body;
        content.appendChild(errorEl);
      } else {
        const main = document.querySelector('main') || document.body;
        main.appendChild(errorEl);
      }
    }

    const errorMsg = (error && error.message)
      ? error.message
      : 'تعذر فتح ملفات ومكونات الأداة المطلوبة. يرجى إعادة المحاولة.';

    errorEl.innerHTML = `
      <div class="mickey-lazy-error-card">
        <div class="mickey-lazy-error-icon">⚠️</div>
        <h3 class="mickey-lazy-error-title">تعذر فتح الأداة</h3>
        <p class="mickey-lazy-error-desc">${_escapeHtml(errorMsg)}</p>
        <div style="display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: wrap;">
          <button type="button" class="mickey-lazy-retry-btn" id="mickey-btn-retry-lazy">
            <span>إعادة المحاولة</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
              <path d="M16 16h5v5"/>
            </svg>
          </button>
          <button type="button" class="mickey-lazy-retry-btn" id="mickey-btn-error-home" style="background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.18); color: #cbd5e1;">
            <span>الرجوع للرئيسية</span>
          </button>
        </div>
      </div>
    `;
    errorEl.style.display = 'flex';
    errorEl.classList.remove('hidden');

    const retryBtn = errorEl.querySelector('#mickey-btn-retry-lazy');
    if (retryBtn) {
      retryBtn.onclick = () => {
        navigateTo(toolId, { pushHash: false });
      };
    }
    const homeBtn = errorEl.querySelector('#mickey-btn-error-home');
    if (homeBtn) {
      homeBtn.onclick = () => {
        navigateTo('home');
      };
    }
  }

  function showLazyLoadError(tool) {
    showToolMountError(tool, new Error(`حدث خطأ أثناء تحميل ملفات أداة ${tool ? tool.arabicName : ''}. يرجى التأكد من اتصال الإنترنت ثم إعادة المحاولة.`));
  }

  function hideLazyLoadError() {
    const errorEl = document.getElementById('mickey-lazy-load-error');
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.classList.add('hidden');
    }
  }

  /**
   * Renders the card-based Home Screen
   */
  function renderHomeScreen(container) {
    if (!container) return;
    _containerEl = container;

    // Strict Account Lock Guard for CEP Extension
    if (isExtension && !isExtensionAccountLinked()) {
      container.classList.add('hidden');
      container.style.display = 'none';
      if (_toolHeaderEl) _toolHeaderEl.classList.add('hidden');
      hideAllToolViews();
      if (typeof window !== 'undefined' && window.MickeyStudioAPI && typeof window.MickeyStudioAPI.updateAccountLinkStatus === 'function') {
        window.MickeyStudioAPI.updateAccountLinkStatus('', false);
      } else {
        const gate = document.getElementById('mickey-account-gate');
        if (gate) { gate.classList.remove('hidden'); gate.style.display = 'flex'; }
      }
      return;
    }

    // If legacyNav active, hide home screen & restore sidebar
    if (isLegacyNav()) {
      container.classList.add('hidden');
      container.style.display = 'none';
      document.body.classList.add('legacy-nav-active');
      document.documentElement.classList.add('legacy-nav-active');
      const oldSidebar = document.querySelector('.sidebar, aside');
      if (oldSidebar) oldSidebar.style.display = '';
      return;
    }

    container.classList.remove('hidden');
    container.style.display = '';
    document.body.classList.remove('legacy-nav-active');
    document.documentElement.classList.remove('legacy-nav-active');

    // Hide old sidebar
    const oldSidebar = document.querySelector('.sidebar, aside');
    if (oldSidebar) oldSidebar.style.display = 'none';

    // Hide sticky tool header if on home
    if (_toolHeaderEl) _toolHeaderEl.classList.add('hidden');
    removeHostNoticeBanner();

    const availableTools = getAvailableTools();
    const queryNorm = normalizeArabic(_searchQuery);

    // Filter tools by active category if not actively searching
    let categoryFilteredTools = availableTools;
    if (!queryNorm && _activeCategoryFilter && _activeCategoryFilter !== 'all') {
      categoryFilteredTools = availableTools.filter(t => getToolCategory(t) === _activeCategoryFilter);
    }

    // Filter tools if search query present
    const filteredTools = queryNorm ? availableTools.filter(t => {
      const nameNorm = normalizeArabic(t.arabicName);
      const benefitNorm = normalizeArabic(t.shortBenefit);
      return nameNorm.includes(queryNorm) || benefitNorm.includes(queryNorm);
    }) : categoryFilteredTools;

    // Get Recent tools
    const recentIds = getRecentToolIds();
    const recentTools = recentIds
      .map(id => availableTools.find(t => t.id === id))
      .filter(Boolean);

    let html = `
      <div class="mickey-home-screen" id="mickey-home-screen">
    `;

    // Modern Luxury Website Navbar & Hero Banner (Website platform only)
    if (currentEnv === 'site') {
      html += `
        <!-- Luxury Website Topbar -->
        <header class="mickey-site-navbar">
          <div class="mickey-site-brand" onclick="MickeyRouter.navigateTo('home')" role="button" tabindex="0">
            <div class="mickey-brand-logo-wrap">
              <img src="assets/mickey-studio-logo.png" alt="Mickey Studio" class="mickey-brand-logo" onerror="this.style.display='none'">
              <span class="mickey-brand-glow-dot" title="الذكاء الاصطناعي متصل ومتاح"></span>
            </div>
            <div class="mickey-brand-text">
              <div class="mickey-brand-title">MICKEY STUDIO <span class="mickey-brand-tag">v2.9 Pro</span></div>
              <div class="mickey-brand-sub">استوديو الذكاء الاصطناعي للمونتاج وصناع المحتوى</div>
            </div>
          </div>
          <div class="mickey-site-nav-actions">
            <button type="button" class="mickey-site-action-btn" onclick="if(window.MickeyJobQueue&&window.MickeyJobQueue.openModal)window.MickeyJobQueue.openModal();" title="قائمة المهام والعمليات الجارية">
              ${getLucideSvg('list-todo', 'w-3.5 h-3.5 text-indigo-400')}
              <span>المهام</span>
            </button>
            <button type="button" class="mickey-site-action-btn" onclick="MickeyRouter.navigateTo('vault-gallery')" title="معرض أعمالي ومخرجات التوليد">
              ${getLucideSvg('folder-archive', 'w-3.5 h-3.5 text-teal-400')}
              <span>معرض أعمالي</span>
            </button>
            <button type="button" class="mickey-site-action-btn" onclick="if(window.MickeyOnboarding&&window.MickeyOnboarding.showWelcomeModal)window.MickeyOnboarding.showWelcomeModal(true);" title="دليل البداية السريع">
              ${getLucideSvg('book-open', 'w-3.5 h-3.5 text-amber-400')}
              <span>دليل البداية</span>
            </button>
            <button type="button" class="mickey-site-action-btn mickey-site-icon-only" onclick="if(window.MickeyStudio&&window.MickeyStudio.toggleSound)window.MickeyStudio.toggleSound();" title="كتم / تشغيل المؤثرات الصوتية">
              ${getLucideSvg('activity', 'w-3.5 h-3.5 text-zinc-400')}
            </button>
            <button type="button" class="mickey-site-account-btn" onclick="if(window.MickeyStudio&&window.MickeyStudio.openAccountModal)window.MickeyStudio.openAccountModal();" title="إدارة الحساب والاشتراك">
              <span class="mickey-site-account-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><circle cx="12" cy="7" r="4"></circle><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path></svg>
              </span>
              <span class="mickey-site-account-label">حسابي</span>
              <span class="mickey-site-guest-pill" id="site-header-guest-pill">5/5</span>
            </button>
          </div>
        </header>

        <!-- Luxury Studio Hero Banner -->
        <div class="mickey-site-hero">
          <div class="mickey-hero-badge">
            <span class="mickey-hero-sparkle">✨</span>
            <span>استوديو المونتاج والذكاء الاصطناعي الشامل للمبدعين</span>
          </div>
          <h1 class="mickey-hero-title">جميع أدوات الذكاء الاصطناعي في واجهة إبداعية واحدة</h1>
          <p class="mickey-hero-subtitle">توليد الصور والفيديوهات، الموشن جرافيك السريع، وتفريغ وهندسة الصوت بأحدث تقنيات الذكاء الاصطناعي التوليدي</p>
          <div class="mickey-hero-kpi-bar">
            <span class="mickey-hero-kpi"><span class="kpi-bullet">●</span> 12+ استوديو متكامل</span>
            <span class="mickey-hero-kpi"><span class="kpi-bullet">●</span> معالجة فائقة السرعة</span>
            <span class="mickey-hero-kpi"><span class="kpi-bullet">●</span> دعم كامل للغة العربية</span>
            <span class="mickey-hero-kpi"><span class="kpi-bullet">●</span> تكامل مع Premiere Pro</span>
          </div>
        </div>
      `;
    }

    // Category Filter Pills (Interactive on both Site and Extension)
    html += `
      <div class="mickey-filter-tabs" role="tablist" aria-label="تصنيفات الأدوات">
        <button type="button" class="mickey-filter-tab ${_activeCategoryFilter === 'all' ? 'active' : ''}" data-category="all" role="tab">
          <span>الكل</span>
          <span class="mickey-filter-count">${availableTools.length}</span>
        </button>
        <button type="button" class="mickey-filter-tab ${_activeCategoryFilter === 'gen' ? 'active' : ''}" data-category="gen" role="tab">
          <span class="tab-indicator tab-indicator-gen"></span>
          <span>التوليد والمحتوى</span>
        </button>
        <button type="button" class="mickey-filter-tab ${_activeCategoryFilter === 'audio' ? 'active' : ''}" data-category="audio" role="tab">
          <span class="tab-indicator tab-indicator-audio"></span>
          <span>هندسة الصوت والكلام</span>
        </button>
        <button type="button" class="mickey-filter-tab ${_activeCategoryFilter === 'edit' ? 'active' : ''}" data-category="edit" role="tab">
          <span class="tab-indicator tab-indicator-edit"></span>
          <span>المونتاج والمشاريع</span>
        </button>
      </div>

      <!-- Modern Search Bar -->
      <div class="mickey-home-search-wrap">
        <span class="mickey-home-search-icon">${getLucideSvg('search')}</span>
        <input
          type="search"
          id="mickey-home-search"
          class="mickey-home-search-input"
          placeholder="ابحث عن أداة، استوديو، أو خدمة إبداعية... (Ctrl + K)"
          value="${_escapeHtml(_searchQuery)}"
          autocomplete="off"
          aria-label="البحث عن أدوات المنصة"
        />
        <span class="mickey-search-kbd">Ctrl K</span>
        ${_searchQuery ? `
          <button type="button" id="mickey-home-search-clear" class="mickey-home-search-clear" title="مسح البحث">
            ${getLucideSvg('x', 'w-3.5 h-3.5')}
          </button>` : ''}
      </div>
    `;

    // Render "الأحدث استخداماً" if no search active and recents exist
    if (!queryNorm && recentTools.length > 0) {
      html += `
        <div class="mickey-recent-section">
          <div class="mickey-recent-header">
            ${getLucideSvg('clock', 'w-3.5 h-3.5')}
            <span>الأحدث استخداماً</span>
          </div>
          <div class="mickey-recent-list">
            ${recentTools.map(t => `
              <button type="button" class="mickey-recent-chip" data-tool-id="${t.id}">
                ${getLucideSvg(t.icon, 'w-3.5 h-3.5 text-teal-400')}
                <span>${t.arabicName}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Render Groups
    // Requirement 2: Empty state is shown ONLY when the search box has active text and zero matches
    if (queryNorm && filteredTools.length === 0) {
      html += `
        <div class="mickey-search-empty" id="mickey-search-empty">
          <div class="mickey-search-empty-icon">🔍</div>
          <div class="mickey-search-empty-title">لم يتم العثور على أداة مطابقة</div>
          <div class="mickey-search-empty-desc">جرّب استخدام كلمات أخرى مثل: قص، صوت، صور، موشن، تفريغ</div>
        </div>
      `;
    } else {
      const activeGroups = queryNorm ? ["نتائج البحث"] : _registry.groups;

      activeGroups.forEach(groupName => {
        const groupTools = queryNorm
          ? filteredTools
          : filteredTools.filter(t => t.group === groupName);

        if (groupTools.length === 0) return;

        const gridClass = currentEnv === 'site' ? 'mickey-tools-grid website-grid' : 'mickey-tools-grid';

        html += `
          <div class="mickey-tool-group">
            <div class="mickey-group-header">
              <span class="mickey-group-title">${groupName}</span>
              <span class="mickey-group-count">${groupTools.length} أدوات</span>
            </div>
            <div class="${gridClass}">
              ${groupTools.map(t => renderToolCardHtml(t)).join('')}
            </div>
          </div>
        `;
      });
    }

    if (currentEnv === 'ext') {
      html += `
        <div class="mickey-home-support-bar" style="margin-top: 24px; padding: 12px 14px; background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px;">🩺</span>
            <span style="color: #94a3b8;">هل تواجه أي مشكلة في تشغيل الأدوات؟</span>
          </div>
          <button type="button" id="mickey-home-btn-diagnostics" class="secondary-button" style="padding: 5px 12px; font-size: 10.5px; cursor: pointer; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); background: rgba(56, 189, 248, 0.08); border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
            <span>تشخيص النظام والدعم</span>
            <span>←</span>
          </button>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Wire support bar button
    const homeDiagBtn = container.querySelector('#mickey-home-btn-diagnostics');
    if (homeDiagBtn) {
      homeDiagBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('diagnostics');
      });
    }

    // Wire category filter tabs
    container.querySelectorAll('.mickey-filter-tab').forEach(tab => {
      tab.addEventListener('click', e => {
        e.preventDefault();
        const cat = tab.getAttribute('data-category') || 'all';
        _activeCategoryFilter = cat;
        renderHomeScreen(container);
      });
    });

    // Wire search input events
    const searchInput = document.getElementById('mickey-home-search');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        _searchQuery = e.target.value;
        renderHomeScreen(container);
        const newInp = document.getElementById('mickey-home-search');
        if (newInp) {
          newInp.focus();
          newInp.setSelectionRange(newInp.value.length, newInp.value.length);
        }
      });
    }

    const clearBtn = document.getElementById('mickey-home-search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        _searchQuery = '';
        renderHomeScreen(container);
        const newInp = document.getElementById('mickey-home-search');
        if (newInp) newInp.focus();
      });
    }

    // Wire card click events
    container.querySelectorAll('.mickey-tool-card, .mickey-recent-chip').forEach(card => {
      card.addEventListener('click', e => {
        e.preventDefault();
        const toolId = card.getAttribute('data-tool-id');
        console.log(`[MickeyRouter] Card clicked: id='${toolId}', activeQuery='${_searchQuery}'`);
        if (toolId) {
          // Requirement 2: card click must navigate by id, reset the search state, and render the tool
          _searchQuery = '';
          _activeCategoryFilter = 'all';
          const searchInp = document.getElementById('mickey-home-search');
          if (searchInp) searchInp.value = '';
          navigateTo(toolId);
        }
      });
    });
  }

  function renderToolCardHtml(tool) {
    const category = getToolCategory(tool);
    const badgeHtml = tool.badge
      ? `<span class="mickey-card-badge ${tool.badge === 'جديد' ? 'badge-new' : 'badge-exp'}">${tool.badge}</span>`
      : '';
    const busy = isToolBusy(tool.id);
    const busyHtml = busy ? `<span class="mickey-running-dot" title="هناك معالجة قيد التشغيل">جاري...</span>` : '';

    return `
      <button
        type="button"
        class="mickey-tool-card mickey-card-${category}"
        data-tool-id="${tool.id}"
        tabindex="0"
        aria-label="${tool.arabicName} - ${tool.shortBenefit}"
      >
        <div class="mickey-card-glow-bg"></div>
        <div class="mickey-card-top">
          <div class="mickey-card-icon-box mickey-icon-${category}">
            ${getLucideSvg(tool.icon)}
          </div>
          <div class="mickey-card-meta" style="display: flex; align-items: center; gap: 6px;">
            ${busyHtml}
            ${badgeHtml}
          </div>
        </div>
        <div class="mickey-card-body">
          <span class="mickey-card-title">${tool.arabicName}</span>
          <span class="mickey-card-benefit">${tool.shortBenefit}</span>
        </div>
        <div class="mickey-card-footer">
          <span class="mickey-card-action">افتح الأداة</span>
          <span class="mickey-card-arrow">←</span>
        </div>
      </button>
    `;
  }

  /**
   * Slim Sticky Header (~44px) Component inside Tool View
   */
  function ensureToolHeader() {
    let header = document.getElementById('mickey-sticky-tool-header');

    if (!header || !document.contains(header)) {
      if (!header) {
        header = document.createElement('div');
        header.id = 'mickey-sticky-tool-header';
        header.className = 'topbar-tool-nav hidden';
      }

      header.innerHTML = `
        <div class="mickey-header-right">
          <button type="button" id="mickey-btn-back-home" class="mickey-back-btn" title="الرجوع للرئيسية (Esc)">
            <svg class="mickey-back-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
              <path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>
            </svg>
            <span>الرئيسية</span>
          </button>
          <div class="mickey-tool-header-title">
            <span id="mickey-header-tool-name">اسم الأداة</span>
            <span id="mickey-header-tool-badge" class="mickey-card-badge badge-new hidden"></span>
          </div>
        </div>
        <div class="mickey-header-left" id="mickey-header-slot" style="display:none;"></div>
      `;

      // Mount inside .topbar
      if (isExtension) {
        const topbar = document.querySelector('.topbar');
        const settingsOpen = document.getElementById('settings-open');
        if (topbar && settingsOpen) {
          topbar.insertBefore(header, settingsOpen);
        } else if (topbar) {
          topbar.appendChild(header);
        }
      } else {
        const main = document.querySelector('main') || document.body;
        main.insertBefore(header, main.firstChild);
      }
    }

    // Strict Placement Guard for Extension: Ensure header is directly inside .topbar
    if (isExtension) {
      const topbar = document.querySelector('.topbar');
      if (topbar && header && header.parentElement !== topbar) {
        const settingsOpen = document.getElementById('settings-open');
        if (settingsOpen) {
          topbar.insertBefore(header, settingsOpen);
        } else {
          topbar.appendChild(header);
        }
      }
      header.classList.add('topbar-tool-nav');
    }

    const backBtn = header.querySelector('#mickey-btn-back-home');
    if (backBtn) {
      backBtn.onclick = () => navigateTo('home');
    }

    _toolHeaderEl = header;
    return header;
  }

  let _headerGuardObserver = null;

  function initHeaderGuard() {
    if (typeof MutationObserver === 'undefined') return;
    if (_headerGuardObserver) return;

    const target = (typeof document !== 'undefined')
      ? (document.querySelector('.topbar') || document.querySelector('.workspace-area') || document.querySelector('.workspace') || document.body)
      : null;
    if (!target) return;

    _headerGuardObserver = new MutationObserver(() => {
      if (_currentRoute && _currentRoute !== 'home' && _currentRoute !== '/' && _currentRoute !== '#/') {
        const header = document.getElementById('mickey-sticky-tool-header');
        const backBtn = header ? header.querySelector('#mickey-btn-back-home') : null;

        if (!header || !document.contains(header) || !backBtn || !document.contains(backBtn)) {
          const offendingTool = _currentRoute;
          console.warn(`[MickeyShellGuard] Header or back button was detached during '${offendingTool}'. Restoring immediately...`);

          if (typeof window !== 'undefined' && window.Diagnostics && typeof window.Diagnostics.logError === 'function') {
            window.Diagnostics.logError(new Error(`Header or back button was removed while in tool '${offendingTool}'`), {
              type: 'header_guard_restored',
              toolId: offendingTool
            });
          }

          const restoredHeader = ensureToolHeader();
          const currentTool = getToolById(offendingTool);
          if (currentTool) {
            updateToolHeader(currentTool);
          }
        }
      }
    });

    _headerGuardObserver.observe(target, { childList: true, subtree: true });
  }

  function updateToolHeader(tool) {
    const header = ensureToolHeader();
    if (!tool || tool.id === 'home' || tool.id === 'motion-editor') {
      header.classList.add('hidden');
      return;
    }

    header.classList.remove('hidden');
    const titleEl = header.querySelector('#mickey-header-tool-name');
    if (titleEl) titleEl.textContent = tool.arabicName;

    const badgeEl = header.querySelector('#mickey-header-tool-badge');
    if (badgeEl) {
      if (tool.badge) {
        badgeEl.textContent = tool.badge;
        badgeEl.className = `mickey-card-badge ${tool.badge === 'جديد' ? 'badge-new' : 'badge-exp'}`;
        badgeEl.classList.remove('hidden');
      } else {
        badgeEl.classList.add('hidden');
      }
    }

    // Preserve and render account / status indicators in header slot
    const slotEl = header.querySelector('#mickey-header-slot');
    if (slotEl) {
      if (isExtension) {
        // In extension, topbar already has #settings-open. Eliminate duplicate pills to save space
        slotEl.innerHTML = '';
        slotEl.style.display = 'none';
      } else {
        slotEl.innerHTML = `
          <button type="button" class="mickey-header-acc-pill" onclick="if(window.MickeyStudio&&window.MickeyStudio.openAccountModal)window.MickeyStudio.openAccountModal();" title="إدارة الحساب">
            <svg class="w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span>الحساب</span>
          </button>
        `;
      }
    }
  }

  /**
   * Router: Navigate to Home or Tool ID
   */
  async function navigateTo(targetRoute, options = {}) {
    const { pushHash = true } = options;

    // Strict Account Lock Guard for CEP Extension
    if (isExtension && !isExtensionAccountLinked()) {
      console.warn(`[MickeyRouter] Navigation blocked for '${targetRoute}': Extension is locked until a Mickey Studio account is linked.`);
      _currentRoute = 'home';
      hideAllToolViews();
      if (_containerEl) {
        _containerEl.classList.add('hidden');
        _containerEl.style.display = 'none';
      }
      updateToolHeader(null);
      if (typeof window !== 'undefined' && window.MickeyStudioAPI && typeof window.MickeyStudioAPI.updateAccountLinkStatus === 'function') {
        window.MickeyStudioAPI.updateAccountLinkStatus('', false);
      } else {
        const gate = document.getElementById('mickey-account-gate');
        if (gate) { gate.classList.remove('hidden'); gate.style.display = 'flex'; }
      }
      return;
    }

    // Requirement 2: card click must navigate by id, reset the search state, and render the tool
    const prevSearch = _searchQuery;
    _searchQuery = '';
    const searchInp = document.getElementById('mickey-home-search');
    if (searchInp) searchInp.value = '';

    if (!targetRoute || targetRoute === 'home' || targetRoute === '/' || targetRoute === '#/') {
      _currentRoute = 'home';
      hideLazyLoadError();
      removeHostNoticeBanner();
      if (!isExtension && pushHash && window.location.hash !== '#/' && window.location.hash !== '') {
        window.location.hash = '#/';
      }
      hideAllToolViews();
      if (_containerEl) {
        _containerEl.classList.remove('hidden');
        _containerEl.style.display = '';
        renderHomeScreen(_containerEl);
      }
      updateToolHeader(null);
      return;
    }

    console.log(`[MickeyRouter] Navigation requested for '${targetRoute}'. Search filter was: '${prevSearch}'`);
    const tool = getToolById(targetRoute);
    if (!tool) {
      console.error(`[MickeyRouter] Tool ID '${targetRoute}' not found in registry.`);
      // Requirement 2: If tool id is unknown or its loader fails, show specific Arabic error ("تعذر فتح الأداة" + retry), never "no match".
      showToolMountError(targetRoute, new Error(`معرف الأداة '${targetRoute}' غير متوفر أو غير مسجل في النظام.`));
      return;
    }

    // Modal tools (e.g. jobs-queue)
    if (tool.id === 'jobs-queue') {
      if (typeof window !== 'undefined' && window.MickeyJobQueue && typeof window.MickeyJobQueue.openModal === 'function') {
        window.MickeyJobQueue.openModal();
      }
      return;
    }

    _currentRoute = tool.id;
    recordToolUsage(tool.id);

    if (!isExtension && pushHash) {
      window.location.hash = `#/${tool.id}`;
    }

    // Hide home screen container immediately (with both class and inline style)
    if (_containerEl) {
      _containerEl.classList.add('hidden');
      _containerEl.style.display = 'none';
    }

    // Update sticky header
    updateToolHeader(tool);

    // Requirement 4: Global error boundary around each tool mount so one failing tool never blanks the app
    try {
      // Requirement 3: Premiere notice for extension tools requiring host when host is unavailable
      checkPremiereHostNotice(tool);

      // Attempt lazy loading
      await lazyLoadTool(tool.id);
      hideLazyLoadError();

      // Switch tool view (keeping all views mounted-but-hidden to preserve state)
      showToolView(tool);

      // Post-mount header verification guard
      const verifiedHeader = document.getElementById('mickey-sticky-tool-header');
      const verifiedBackBtn = verifiedHeader ? verifiedHeader.querySelector('#mickey-btn-back-home') : null;
      if (!verifiedHeader || !document.contains(verifiedHeader) || !verifiedBackBtn) {
        console.warn(`[MickeyRouter] Tool '${tool.id}' detached the header during mount. Restoring...`);
        ensureToolHeader();
        updateToolHeader(tool);
      }
    } catch (err) {
      console.error(`[MickeyRouter Global Boundary] Tool mount failed for '${tool.id}':`, err);
      if (typeof Diagnostics !== 'undefined' && typeof Diagnostics.logError === 'function') {
        Diagnostics.logError(err, { type: 'tool_mount_boundary', toolId: tool.id });
      }
      showToolMountError(tool, err);
    }
  }

  /**
   * Displays the target section for a tool without destroying DOM of others
   */
  function showToolView(tool) {
    const targetKey = isExtension ? (tool.target && tool.target.ext) : (tool.target && tool.target.site);

    try {
      if (isExtension) {
        // Extension sections use class="page" and id="page-xxx"
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        let targetEl = targetKey ? document.getElementById(targetKey) : null;
        if (!targetEl && tool.target?.ext) {
          targetEl = document.querySelector(`[data-page="${tool.target.ext.replace('page-', '')}"]`);
        }
        if (targetEl) {
          targetEl.classList.add('active');
          targetEl.style.display = '';
        } else {
          throw new Error(`تعذر العثور على عنصر واجهة الأداة (#${targetKey || tool.id})`);
        }

        // Special extension tool handlers
        try {
          if (tool.id === 'captions') {
            if (typeof window.AnimatedCaptions !== 'undefined' && typeof window.AnimatedCaptions.renderSingleFramePreview === 'function') {
              setTimeout(() => {
                try { window.AnimatedCaptions.renderSingleFramePreview(); } catch (_) {}
              }, 50);
            }
          }
          if (tool.id === 'silence-cut') {
            if (typeof window.SilenceDetector !== 'undefined' && typeof window.SilenceDetector.redrawWaveform === 'function') {
              setTimeout(() => {
                try { window.SilenceDetector.redrawWaveform(); } catch (_) {}
              }, 50);
            }
          }
          if (tool.id === 'safezone') {
            if (typeof window.startSafeZoneAutoRefresh === 'function' && document.getElementById('safezone-auto-refresh')?.checked) {
              window.startSafeZoneAutoRefresh();
            }
          } else {
            if (typeof window.stopSafeZoneAutoRefresh === 'function') window.stopSafeZoneAutoRefresh();
          }
          if (tool.id === 'library') {
            if (typeof window.renderTimelineScenesList === 'function') window.renderTimelineScenesList();
            if (typeof window.renderRecentWorksList === 'function') window.renderRecentWorksList();
          }
        } catch (extHandlerErr) {
          console.warn(`[MickeyRouter] Tool handler non-fatal warning for '${tool.id}':`, extHandlerErr);
        }
      } else {
        // Website sections use class="studio-section" and id="section-xxx"
        document.querySelectorAll('.studio-section').forEach(sec => sec.classList.add('hidden'));
        const targetSec = targetKey ? document.getElementById(targetKey) : null;
        if (targetSec) {
          targetSec.classList.remove('hidden');
        } else {
          throw new Error(`تعذر العثور على قسم الاستوديو (#${targetKey || tool.id})`);
        }

        // Special studio hooks (Requirement 7: Motion Tool landing vs editor)
        if (typeof window !== 'undefined' && window.MickeyStudio) {
          try {
            if (tool.id === 'motion-builder' && typeof window.initMotionBuilder === 'function') {
              window.initMotionBuilder();
            } else if (tool.id === 'motion-editor') {
              if (typeof window.initMotionEditorControls === 'function') window.initMotionEditorControls();
              if (window.motionEditorScene && typeof window.motionEditorRender === 'function') window.motionEditorRender();
            } else if (tool.id === 'library' && typeof window.renderVaultGallery === 'function') {
              window.renderVaultGallery();
            } else if (tool.id === 'developer-api' && typeof window.initDeveloperApiSection === 'function') {
              window.initDeveloperApiSection();
            } else if (['captions', 'audio-clean', 'silence-cut', 'auto-zoom', 'word-mute', 'viral-clips', 'yt-chapters'].includes(tool.id)) {
              if (typeof window.MickeyMediaStudio !== 'undefined' && typeof window.MickeyMediaStudio.setMode === 'function') {
                window.MickeyMediaStudio.setMode(tool.id);
              }
            }
          } catch (siteHookErr) {
            console.warn(`[MickeyRouter] Studio hook non-fatal warning for '${tool.id}':`, siteHookErr);
          }
        }
      }
    } catch (viewErr) {
      throw viewErr;
    }
  }

  function hideAllToolViews() {
    if (isExtension) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    } else {
      document.querySelectorAll('.studio-section').forEach(sec => sec.classList.add('hidden'));
    }
  }

  /**
   * Startup Target Verification Check (Requirement 3)
   * Validates that every tool in shared/tools-registry.json matching the current environment
   * has a target DOM section or module loader, and logs any mismatches.
   */
  function verifyTargetMappings() {
    const mismatches = [];
    const available = _registry.tools.filter(t => t.availableIn === 'both' || t.availableIn === currentEnv);

    available.forEach(tool => {
      const targetId = isExtension ? tool.target?.ext : tool.target?.site;
      if (!targetId) {
        mismatches.push({ toolId: tool.id, reason: `Target undefined for '${currentEnv}'` });
        return;
      }

      let targetEl = document.getElementById(targetId);
      if (!targetEl && isExtension && tool.target?.ext) {
        targetEl = document.querySelector(`[data-page="${tool.target.ext.replace('page-', '')}"]`);
      }

      if (!targetEl) {
        const hasLoader = (currentEnv === 'site' && typeof window !== 'undefined' && window.STUDIO_MODULE_MAP && window.STUDIO_MODULE_MAP[tool.id]);
        if (!hasLoader) {
          mismatches.push({ toolId: tool.id, targetId, reason: `Target mismatch: DOM #${targetId} not found and no loader registered` });
        }
      }
    });

    if (mismatches.length > 0) {
      console.warn(`[MickeyRouter Startup Check] Target mismatch detected (${mismatches.length}):`, mismatches);
    } else {
      console.log(`[MickeyRouter Startup Check] All ${available.length} tool targets verified successfully for '${currentEnv}'.`);
    }
    return mismatches;
  }

  /**
   * Startup Self-Check & Timing Diagnostics (Requirement 5)
   * Prints count of tools/groups, resolves loaders, measures timing, and reports to console & Diagnostics.
   */
  function runStartupSelfCheck(timings = {}) {
    const totalTools = _registry.tools.length;
    const totalGroups = _registry.groups.length;
    const availableTools = getAvailableTools(true);

    const loaderFailures = [];
    availableTools.forEach(tool => {
      const targetId = isExtension ? tool.target?.ext : tool.target?.site;
      if (!targetId) {
        loaderFailures.push({ id: tool.id, error: `No target configured for ${currentEnv}` });
        return;
      }
      let el = (typeof document !== 'undefined') ? document.getElementById(targetId) : null;
      if (!el && isExtension && tool.target?.ext && typeof document !== 'undefined') {
        el = document.querySelector(`[data-page="${tool.target.ext.replace('page-', '')}"]`);
      }
      if (!el && typeof document !== 'undefined') {
        const hasLoader = (currentEnv === 'site' && typeof window !== 'undefined' && window.STUDIO_MODULE_MAP && window.STUDIO_MODULE_MAP[tool.id]);
        if (!hasLoader) {
          loaderFailures.push({ id: tool.id, target: targetId, error: 'DOM element not found and no loader registered' });
        }
      }
    });

    const report = {
      timestamp: new Date().toISOString(),
      environment: currentEnv,
      registry: {
        totalTools,
        totalGroups,
        availableCount: availableTools.length
      },
      loaderResolution: {
        totalChecked: availableTools.length,
        failuresCount: loaderFailures.length,
        failures: loaderFailures
      },
      timings: timings
    };

    console.group(`[MickeyRouter Self-Check] Startup Diagnostics (${currentEnv})`);
    console.info(`✓ Registry loaded: ${totalTools} tools across ${totalGroups} groups.`);
    if (loaderFailures.length === 0) {
      console.info(`✓ All ${availableTools.length} tool targets/loaders resolved successfully.`);
    } else {
      console.warn(`⚠️ Target/loader resolution failures (${loaderFailures.length}):`, loaderFailures);
    }
    console.info(`⏱ Init steps timing:`, timings);
    console.groupEnd();

    // Expose on window for Diagnostics UI inspection
    if (typeof window !== 'undefined') {
      window.__mickeyStartupDiagnostics = report;
      if (typeof window.Diagnostics !== 'undefined' && typeof window.Diagnostics.logError === 'function' && loaderFailures.length > 0) {
        window.Diagnostics.logError(new Error(`Startup check detected ${loaderFailures.length} target resolution failures`), {
          type: 'startup_self_check',
          failures: loaderFailures
        });
      }
    }

    return report;
  }

  /**
   * Initializes Router & Listeners
   */
  function init(options = {}) {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const timings = {};

    _registry = options.registry || DEFAULT_REGISTRY;
    timings.registry_load = Number((((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0).toFixed(2));

    // Requirement 3: Startup check that every id in shared/tools-registry.json has a matching target section/loader; log mismatches
    verifyTargetMappings();
    timings.mapping_verification = Number((((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0 - timings.registry_load).toFixed(2));

    // Mount container for Home Screen
    let container = document.getElementById('mickey-home-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'mickey-home-container';

      if (isExtension) {
        const content = document.querySelector('.content') || document.querySelector('.workspace') || document.body;
        content.insertBefore(container, content.firstChild);
      } else {
        const main = document.querySelector('main') || document.body;
        main.insertBefore(container, main.firstChild);
      }
    }

    _containerEl = container;
    ensureToolHeader();
    initHeaderGuard();
    timings.dom_mount = Number((((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0 - timings.registry_load - timings.mapping_verification).toFixed(2));

    // Requirement 3: Skeleton max 300ms watchdog, then render real cards immediately even if everything else fails
    setTimeout(() => {
      if (document.getElementById('mickey-skeleton-screen') && _currentRoute === 'home') {
        console.warn('[MickeyRouter] Skeleton timeout (300ms) reached; rendering real cards from inlined registry.');
        renderHomeScreen(_containerEl || document.getElementById('mickey-home-container'));
      }
    }, 300);

    // Keyboard navigation: Esc returns home, Ctrl+K focuses search
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        // Only return home if not inside an open modal
        const openModal = document.querySelector('.modal:not(.hidden), [role="dialog"]:not(.hidden)');
        if (!openModal && _currentRoute !== 'home') {
          event.preventDefault();
          navigateTo('home');
        }
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K')) {
        const searchInp = document.getElementById('mickey-home-search');
        if (searchInp && _currentRoute === 'home') {
          event.preventDefault();
          searchInp.focus();
          searchInp.select();
        }
      }
    });

    // Hash routing for Website platform
    if (!isExtension) {
      window.addEventListener('hashchange', () => {
        const rawHash = window.location.hash.replace(/^#\/?/, '');
        if (!rawHash || rawHash === '') {
          navigateTo('home', { pushHash: false });
        } else {
          navigateTo(rawHash, { pushHash: false });
        }
      });

      // Initial route on website load
      const initialHash = window.location.hash.replace(/^#\/?/, '');
      if (initialHash && getToolById(initialHash)) {
        navigateTo(initialHash, { pushHash: false });
      } else {
        navigateTo('home', { pushHash: false });
      }
    } else {
      // Extension default is home
      navigateTo('home', { pushHash: false });
    }

    timings.initial_route = Number((((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0).toFixed(2));
    timings.total_init = timings.initial_route;

    // Requirement 5: Print startup self-check diagnostics & timings
    runStartupSelfCheck(timings);

    // Heartbeat for live "جاري..." running status updates on home screen
    function updateRunningDots() {
      if (_currentRoute !== 'home' || !_containerEl) return;
      _containerEl.querySelectorAll('.mickey-tool-card').forEach(card => {
        const toolId = card.getAttribute('data-tool-id');
        if (!toolId) return;
        const busy = isToolBusy(toolId);
        let dot = card.querySelector('.mickey-running-dot');
        if (busy && !dot) {
          const topRow = card.querySelector('.mickey-card-top > div:last-child');
          if (topRow) {
            const newDot = document.createElement('span');
            newDot.className = 'mickey-running-dot';
            newDot.title = 'هناك معالجة قيد التشغيل';
            newDot.textContent = 'جاري...';
            topRow.insertBefore(newDot, topRow.firstChild);
          }
        } else if (!busy && dot) {
          dot.remove();
        }
      });
    }

    try {
      setInterval(updateRunningDots, 2500);
    } catch (_) {}
  }

  function _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    init,
    navigateTo,
    getAvailableTools,
    getToolById,
    isToolBusy,
    isLegacyNav,
    isLegacyMotionNav,
    normalizeArabic,
    verifyTargetMappings,
    runStartupSelfCheck,
    showLazyLoadError,
    showToolMountError,
    hideLazyLoadError,
    ensureToolHeader,
    updateToolHeader,
    initHeaderGuard,
    getCurrentRoute: () => _currentRoute,
    getRegistry: () => _registry,
    getLucideSvg
  };
});
