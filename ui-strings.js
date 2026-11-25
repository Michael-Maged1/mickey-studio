/**
 * Mickey Studio - Centralized UI Strings & Benefit-Based Copy Dictionary
 * Maps technical terminology to creator-centric, benefit-based plain Arabic copy.
 * NOTE: Actual replacements in the UI await explicit user approval.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MickeyUIStrings = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const strings = {
    // -------------------------------------------------------------
    // Image Studio
    // -------------------------------------------------------------
    'image.engine.pollinations_flux': {
      technical: 'Pollinations AI FLUX.1 Schnell API (FP8)',
      benefit: 'محرك فوتوغرافي واقعي فائق السرعة',
      tooltip: 'يولد صوراً واقعية بدقة عالية في ثوانٍ معدودة مجاناً'
    },
    'image.aspect_ratio.16_9': {
      technical: 'Aspect Ratio 16:9 Landscape (1920x1080)',
      benefit: 'فيديو أفقي لليوتيوب والشاشات (16:9)',
      tooltip: 'المقاس المثالي لفيديوهات يوتيوب والشاشات الكبيرة'
    },
    'image.aspect_ratio.9_16': {
      technical: 'Aspect Ratio 9:16 Portrait (1080x1920)',
      benefit: 'ريلز وشورتس وتيك توك عمودي (9:16)',
      tooltip: 'المقاس المناسب لمقاطع ريلز وتيك توك وإنستغرام'
    },
    'image.aspect_ratio.1_1': {
      technical: 'Aspect Ratio 1:1 Square (1080x1080)',
      benefit: 'مربع لمنشورات وسائل التواصل (1:1)',
      tooltip: 'الأفضل لبوستات إنستغرام وفيسبوك'
    },
    'image.seed.random': {
      technical: 'Random Seed Integer (Entropy Generator)',
      benefit: 'توليد نتائج مبتكرة ومتنوعة',
      tooltip: 'يغير رقم التكوين لإنتاج أشكال وزوايا جديدة لنفس الفكرة'
    },
    'image.batch.count': {
      technical: 'Batch Concurrency Iterations (1-4)',
      benefit: 'عدد الخيارات المولدة معاً',
      tooltip: 'توليد أكثر من خيار في نفس الوقت لاختيار الأنسب لك'
    },

    // -------------------------------------------------------------
    // Video & 3D Motion Studio
    // -------------------------------------------------------------
    'video.engine.parallax_canvas': {
      technical: 'HTML5 2D Canvas Parallax Depth Transform',
      benefit: 'تحريك سينمائي ثلاثي الأبعاد مع عمق حقيقي',
      tooltip: 'يحول الصورة الثابتة إلى مشهد متحرك بإحساس الكاميرا الاحترافية'
    },
    'video.motion.zoom_in': {
      technical: 'Linear Scale Transform Interpolation (Ken Burns)',
      benefit: 'تقريب سينمائي تدريجي لشد انتباه المشاهد',
      tooltip: 'يقرب الكاميرا ببطء نحو مركز المشهد لإضفاء لمسة وثائقية فخمة'
    },
    'video.motion.pan_right': {
      technical: 'Horizontal Matrix Translation (+X Offset)',
      benefit: 'حركة بانورامية سلسة لليمين',
      tooltip: 'يستكشف تفاصيل المشهد بحركة أفقية انسيابية'
    },
    'video.export.mp4_webm': {
      technical: 'MediaRecorder VP9/H.264 Blob Encoding',
      benefit: 'حفظ الفيديو جاهزاً للنشر والمونتاج',
      tooltip: 'تصدير فيديو عالي الجودة متوافق مع كافة برامج المونتاج'
    },

    // -------------------------------------------------------------
    // Photo Lab (Background Remover & Upscaler)
    // -------------------------------------------------------------
    'photo.bg_remover': {
      technical: 'Semantic Segmentation Alpha Mask Extraction',
      benefit: 'عزل وقص الخلفية بضغطة زر واحدة',
      tooltip: 'يفصل العنصر الأساسي تلقائياً بدقة ويجعله شفافاً جاهزاً للتركيب'
    },
    'photo.upscaler': {
      technical: 'Bicubic / Super-Resolution 4x Interpolation',
      benefit: 'توضيح وتكبير الصور حتى 4 أضعاف الدقة',
      tooltip: 'يعيد بناء التفاصيل الدقيقة ويصلح الصور الباهتة أو صغيرة الحجم'
    },

    // -------------------------------------------------------------
    // Voice & Audio Lab
    // -------------------------------------------------------------
    'voice.engine.gemini_multimodal': {
      technical: 'Gemini 2.0 Flash / Pro Text-to-Speech Route',
      benefit: 'أصوات ذكاء اصطناعي طبيعية وحيوية',
      tooltip: 'نطق بشري فصيح ومؤثر مع تشكيل عربي دقيق'
    },
    'voice.engine.web_speech': {
      technical: 'Browser Native SpeechSynthesis API',
      benefit: 'صوت النظام المباشر (سريع وبدون استهلاك بيانات)',
      tooltip: 'يقرأ النصوص فورياً باستخدام المحرك المدمج في جهازك'
    },
    'voice.podcast_mode': {
      technical: 'Multi-Speaker Dialogue Orchestration',
      benefit: 'صناعة حوار بودكاست احترافي بين شخصيتين',
      tooltip: 'ينشئ حلقة إذاعية كاملة بسيناريو متكامل وتبادل أدوار طبيعي'
    },

    // -------------------------------------------------------------
    // Transcribe & Speech-to-Text
    // -------------------------------------------------------------
    'transcribe.mode.subtitle': {
      technical: 'Word-level Timestamped SubRip SRT Export',
      benefit: 'تفريغ صوتي إلى ملف ترجمة جاهز للتايملاين',
      tooltip: 'يحول الكلام إلى نصوص متزامنة بالمللي ثانية لإدراجها في الفيديو'
    },
    'transcribe.arabic_diacritics': {
      technical: 'Gemini Diacritics & Punctuation Reconstruction',
      benefit: 'تصحيح وتشكيل الحروف وعلامات الترقيم',
      tooltip: 'يضبط قواعد اللغة ونقاط الوقف تلقائياً لقراءة مريحة'
    },

    // -------------------------------------------------------------
    // Silence Cut & Auto Zoom Suite (قص السكتات والزووم)
    // -------------------------------------------------------------
    'autocut.silence': {
      technical: 'RMS Energy Decibel Threshold Silence Detection',
      benefit: 'حذف الوقفات الصامتة والتنفس المزعج تلقائياً',
      tooltip: 'يجعل الفيديو سريع الإيقاع وجذاباً دون فراغات مملة'
    },
    'autocut.auto_zoom': {
      technical: 'Dynamic Keyframe Punch-In on Sentence Start',
      benefit: 'تقريب ديناميكي عند النقاط المهمة لكسر الرتابة',
      tooltip: 'يغير حجم الكاميرا تلقائياً مع الكلمات المؤثرة لشد انتباه المشاهد'
    },
    'autocut.censor': {
      technical: 'Acoustic Sine Wave 1000Hz Bleep Overlay & Mute',
      benefit: 'تغطية الكلمات المحظورة بنغمة تشفير احترافية',
      tooltip: 'يكتم الكلمات الحساسة ويضع صوتاً رقابياً أنيقاً'
    },

    // -------------------------------------------------------------
    // Vault & Storage
    // -------------------------------------------------------------
    'vault.storage': {
      technical: 'Client-side IndexedDB with AES-GCM 256-bit encryption',
      benefit: 'خزنتك الآمنة المشفرة على جهازك الخاص',
      tooltip: 'كل ملفاتك وتصاميمك تُحفظ على متصفحك محلياً دون أن يطلع عليها أحد'
    },
    'vault.export_backup': {
      technical: 'JSON Encrypted Master Seed State Dump',
      benefit: 'تصدير نسخة احتياطية من كل أعمالك لملف آمن',
      tooltip: 'احتفظ بنسخة من تصاميمك لنقلها لأي جهاز آخر وقتما تشاء'
    },

    // -------------------------------------------------------------
    // Premiere Pro Synchronization
    // -------------------------------------------------------------
    'premiere.send_editable': {
      technical: 'Native Transform Keyframes & Alpha ProRes Pipeline',
      benefit: 'إرسال طبقات قابلة للتعديل والتحكم في بريمير',
      tooltip: 'ينزل المشهد في خط الزمن كعناصر مفردة يمكنك تغيير نصوصها وحركتها بحرية'
    },
    'premiere.send_video': {
      technical: 'ProRes 4444 yuva444p10le Master Video Handoff',
      benefit: 'إرسال فيديو شفاف مدمج فائق الجودة',
      tooltip: 'ينزل المشهد كمقطع فيديو جاهز بخلفية شفافة فورية'
    },
    'premiere.in_place_update': {
      technical: 'In-place Clip GUID Replacement & Backups Archiving',
      benefit: 'تحديث المشهد في التايملاين مع حفظ النسخة القديمة احتياطياً',
      tooltip: 'يحدث التعديل في نفس مكان المقطع بالضبط مع الاحتفاظ بنسخة للرجوع لها'
    }
  };

  function get(key, fallback = '') {
    if (strings[key]) {
      return strings[key].benefit;
    }
    return fallback || key;
  }

  function getDetails(key) {
    return strings[key] || null;
  }

  function getAll() {
    return strings;
  }

  return {
    get,
    getDetails,
    getAll,
    strings
  };
});
