/**
 * Mickey Studio - Motion Editor (v2) Controller
 * Professional, deterministic, RTL motion graphics editor.
 * Uses shared/motion-engine.js for rendering and evaluation.
 */

(function () {
  'use strict';

  // -----------------------------------------------------------------
  // 1. DEFAULT SCENE & TEMPLATES
  // -----------------------------------------------------------------
  const DEFAULT_SCENE = {
    version: 2,
    id: 'sc_' + Date.now().toString(36),
    name: 'مشهد ترويجي جديد',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5.0,
    background: {
      type: 'color',
      color: '#0d0f18'
    },
    layers: [
      {
        id: 'bg_shape',
        type: 'shape',
        name: 'حلقة ديكور دائرية',
        start: 0,
        duration: 5.0,
        locked: false,
        visible: true,
        transform: { x: 1650, y: 240, w: 260, h: 260, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 0.35 },
        style: { fill: '#6366f1', stroke: '#06b6d4', strokeWidth: 4, radius: 130 },
        content: { shape: 'donut', innerRadius: 85 },
        presets: { loop: { name: 'spin', speed: 0.15 } }
      },
      {
        id: 'title_text',
        type: 'text',
        name: 'العنوان الرئيسي',
        start: 0.2,
        duration: 4.8,
        locked: false,
        visible: true,
        transform: { x: 960, y: 380, w: 1400, h: 140, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: {
          fill: '#ffffff',
          font: 'Cairo',
          fontSize: 76,
          fontWeight: '900',
          align: 'center',
          direction: 'rtl',
          shadow: { color: 'rgba(99, 102, 241, 0.5)', blur: 24, x: 0, y: 6 }
        },
        content: { text: 'محرر الموشن جرافيك السريع' },
        presets: {
          in: { name: 'pop', dur: 0.8, ease: 'easeOutBack' },
          loop: { name: 'float', period: 3.5, params: { amplitude: 10 } }
        }
      },
      {
        id: 'sub_text',
        type: 'text',
        name: 'العنوان الفرعي',
        start: 0.6,
        duration: 4.4,
        locked: false,
        visible: true,
        transform: { x: 960, y: 510, w: 1100, h: 70, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: {
          fill: '#94a3b8',
          font: 'Tajawal',
          fontSize: 32,
          fontWeight: '500',
          align: 'center',
          direction: 'rtl'
        },
        content: { text: 'تحكم كامل في النصوص العربية، المسارات الزمنية، ومفاتيح الحركة' },
        presets: { in: { name: 'slideUp', dur: 0.6, ease: 'easeOutCubic' } }
      },
      {
        id: 'metric_counter',
        type: 'counter',
        name: 'عداد التفاعل',
        start: 1.0,
        duration: 4.0,
        locked: false,
        visible: true,
        transform: { x: 960, y: 720, w: 420, h: 90, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: {
          fill: '#06b6d4',
          font: 'Inter',
          fontSize: 64,
          fontWeight: '800',
          align: 'center',
          direction: 'ltr'
        },
        content: { startVal: 0, endVal: 50000, prefix: '+', suffix: '', decimals: 0, separator: ',' },
        keyframes: {
          'content.value': [
            { t: 0, v: 0, ease: 'easeOutCubic' },
            { t: 2.2, v: 50000, ease: 'easeOutCubic' }
          ]
        },
        presets: { loop: { name: 'pulse', period: 2.0, params: { scale: 1.04 } } }
      }
    ]
  };

  const TEMPLATES = {
    promo_social: {
      version: 2,
      id: 'sc_promo_social',
      name: 'برومو سوشيال ميديا (9:16)',
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 5.0,
      background: { type: 'color', color: '#090a12' },
      layers: [
        {
          id: 'bg_donut',
          type: 'shape',
          name: 'حلقة ديكور نيون',
          start: 0,
          duration: 5.0,
          transform: { x: 920, y: 350, w: 320, h: 320, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 0.3 },
          style: { fill: '#6366f1', stroke: '#06b6d4', strokeWidth: 5, radius: 160 },
          content: { shape: 'donut', innerRadius: 110 },
          presets: { loop: { name: 'spin', speed: 0.2 } }
        },
        {
          id: 'headline',
          type: 'text',
          name: 'عنوان رئيسي جذاب',
          start: 0.3,
          duration: 4.7,
          transform: { x: 540, y: 720, w: 900, h: 180, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
          style: { fill: '#ffffff', font: 'Cairo', fontSize: 88, fontWeight: '900', align: 'center', direction: 'rtl' },
          content: { text: 'ضاعف مشاهداتك في ثوانٍ' },
          presets: { in: { name: 'pop', dur: 0.7, ease: 'easeOutBack' } }
        },
        {
          id: 'counter_reels',
          type: 'counter',
          name: 'عداد المتابعين',
          start: 0.8,
          duration: 4.2,
          transform: { x: 540, y: 1150, w: 600, h: 120, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
          style: { fill: '#10b981', font: 'Inter', fontSize: 92, fontWeight: '900', align: 'center', direction: 'ltr' },
          content: { startVal: 0, endVal: 100000, prefix: '+', decimals: 0, separator: ',' },
          keyframes: {
            'content.value': [
              { t: 0, v: 0, ease: 'easeOutExpo' },
              { t: 2.0, v: 100000, ease: 'easeOutExpo' }
            ]
          }
        }
      ]
    },

    lower_third: {
      version: 2,
      id: 'sc_lower_third',
      name: 'شريط تعريفي سفلي (16:9)',
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 6.0,
      background: { type: 'transparent' },
      layers: [
        {
          id: 'lt_bar',
          type: 'shape',
          name: 'شريط الخلفية',
          start: 0.3,
          duration: 5.4,
          transform: { x: 480, y: 920, w: 720, h: 90, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 0.95 },
          style: { fill: '#131624', stroke: '#6366f1', strokeWidth: 2, radius: 12 },
          content: { shape: 'rounded-rect' },
          presets: { in: { name: 'slideUp', dur: 0.5 } }
        },
        {
          id: 'lt_name',
          type: 'text',
          name: 'اسم الشخص أو المتحدث',
          start: 0.5,
          duration: 5.2,
          transform: { x: 480, y: 895, w: 660, h: 40, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
          style: { fill: '#ffffff', font: 'Readex Pro', fontSize: 34, fontWeight: '700', align: 'right', direction: 'rtl' },
          content: { text: 'م. مايكل ماجد' },
          presets: { in: { name: 'fade', dur: 0.4 } }
        },
        {
          id: 'lt_role',
          type: 'text',
          name: 'المسمى الوظيفي',
          start: 0.7,
          duration: 5.0,
          transform: { x: 480, y: 940, w: 660, h: 30, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
          style: { fill: '#06b6d4', font: 'Tajawal', fontSize: 22, fontWeight: '500', align: 'right', direction: 'rtl' },
          content: { text: 'مؤسس ومدير إبداعي • استوديو ميكي' },
          presets: { in: { name: 'fade', dur: 0.4 } }
        }
      ]
    },

    stats_counter: {
      version: 2,
      id: 'sc_stats_counter',
      name: 'كارت إحصائيات وأرباح (1:1)',
      width: 1080,
      height: 1080,
      fps: 30,
      duration: 5.0,
      background: { type: 'color', color: '#0b0d14' },
      layers: [
        {
          id: 'card_bg',
          type: 'shape',
          name: 'خلفية الكارت',
          start: 0.2,
          duration: 4.8,
          transform: { x: 540, y: 540, w: 780, h: 560, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 0.95 },
          style: { fill: '#141724', stroke: '#262c44', strokeWidth: 2, radius: 24 },
          content: { shape: 'rounded-rect' },
          presets: { in: { name: 'pop', dur: 0.6 } }
        },
        {
          id: 'card_title',
          type: 'text',
          name: 'عنوان الكارت',
          start: 0.5,
          duration: 4.5,
          transform: { x: 540, y: 400, w: 680, h: 60, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
          style: { fill: '#94a3b8', font: 'Almarai', fontSize: 32, fontWeight: '700', align: 'center', direction: 'rtl' },
          content: { text: 'إجمالي الأرباح الشهرية' }
        },
        {
          id: 'currency_num',
          type: 'counter',
          name: 'رقم الأرباح',
          start: 0.8,
          duration: 4.2,
          transform: { x: 540, y: 530, w: 680, h: 100, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
          style: { fill: '#10b981', font: 'Inter', fontSize: 80, fontWeight: '900', align: 'center', direction: 'ltr' },
          content: { startVal: 0, endVal: 84750.25, prefix: '$', decimals: 2, separator: ',' },
          keyframes: {
            'content.value': [
              { t: 0, v: 0, ease: 'easeOutExpo' },
              { t: 2.2, v: 84750.25, ease: 'easeOutExpo' }
            ]
          },
          presets: { loop: { name: 'pulse', period: 2.0, params: { scale: 1.05 } } }
        }
      ]
    },

    bar_chart: {
      version: 2,
      id: 'sc_bar_chart',
      name: 'مخطط بياني تصاعدي (16:9)',
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 5.0,
      background: { type: 'color', color: '#090a12' },
      layers: [
        {
          id: 'chart_headline',
          type: 'text',
          name: 'عنوان التقرير',
          start: 0.2,
          duration: 4.8,
          transform: { x: 960, y: 220, w: 1000, h: 80, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
          style: { fill: '#ffffff', font: 'Cairo', fontSize: 56, fontWeight: '800', align: 'center', direction: 'rtl' },
          content: { text: 'مؤشرات النمو والتفاعل الأسبوعي' },
          presets: { in: { name: 'slideDown', dur: 0.5 } }
        },
        {
          id: 'main_bar_chart',
          type: 'chart',
          name: 'المخطط البياني',
          start: 0.6,
          duration: 4.4,
          transform: { x: 960, y: 620, w: 1100, h: 420, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
          style: { fill: '#6366f1', stroke: '#818cf8', strokeWidth: 2, font: 'Readex Pro', fontSize: 20 },
          content: {
            chartType: 'bar',
            data: [
              { label: 'السبت', value: 35, color: '#6366f1' },
              { label: 'الأحد', value: 55, color: '#8b5cf6' },
              { label: 'الإثنين', value: 80, color: '#06b6d4' },
              { label: 'الثلاثاء', value: 115, color: '#10b981' },
              { label: 'الأربعاء', value: 140, color: '#f59e0b' }
            ]
          },
          keyframes: {
            'style.progress': [
              { t: 0, v: 0, ease: 'easeOutCubic' },
              { t: 1.8, v: 1, ease: 'easeOutCubic' }
            ]
          }
        }
      ]
    },

    typewriter_quote: {
      version: 2,
      id: 'sc_tw_quote',
      name: 'اقتباس الآلة الكاتبة (4:5)',
      width: 1080,
      height: 1350,
      fps: 30,
      duration: 6.0,
      background: { type: 'color', color: '#0c0e18' },
      layers: [
        {
          id: 'quote_text',
          type: 'text',
          name: 'نص الاقتباس',
          start: 0.5,
          duration: 5.5,
          transform: { x: 540, y: 640, w: 900, h: 400, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
          style: {
            fill: '#38bdf8',
            font: 'Noto Kufi Arabic',
            fontSize: 52,
            fontWeight: '700',
            align: 'center',
            direction: 'rtl',
            lineHeight: 1.5
          },
          content: { text: 'الإتقان في التفاصيل الصغيرة هو ما يصنع العمل السينمائي العظيم.' },
          presets: { in: { name: 'typewriter', dur: 3.2, ease: 'linear' } }
        }
      ]
    }
  };

  // -----------------------------------------------------------------
  // 2. APPLICATION STATE
  // -----------------------------------------------------------------
  const STATE = {
    project: {
      version: 2,
      id: 'proj_' + Date.now().toString(36),
      name: 'مشروع موشن جديد',
      scenes: [JSON.parse(JSON.stringify(DEFAULT_SCENE))],
      transitions: []
    },
    activeSceneIndex: 0,
    scene: null,
    selectedLayerIds: ['title_text'],
    currentTime: 0,
    isPlaying: false,
    isPlayingAllScenes: false,
    projectCurrentTime: 0,
    playbackSpeed: 1.0,
    zoomLevel: 'fit', // 'fit' or numeric scale (1.0, 0.75, etc.)
    scale: 1.0,
    panX: 0,
    panY: 0,
    snapEnabled: true,
    gridEnabled: false,
    safeZoneEnabled: false,
    checkerboardEnabled: true,
    timelineZoom: 1.0, // pixels per second multiplier
    undoStack: [],
    redoStack: [],
    currentUser: null,
    autoSaveDebounce: null,
    animFrameId: null,
    lastFrameTime: 0,
    presetsList: [],
    brandKit: {
      colors: {
        primary: '#6366f1',
        secondary: '#06b6d4',
        accent: '#f59e0b',
        dark: '#0d0f18',
        light: '#ffffff',
        extra: '#10b981'
      },
      fonts: {
        heading: 'Cairo',
        body: 'Tajawal'
      },
      watermark: {
        enabled: false,
        type: 'text',
        text: '@MickeyStudio',
        image: '',
        position: 'bottom-right',
        opacity: 0.75,
        scale: 1.0
      }
    },
    templatesIndex: [],
    templatesCache: {},
    myTemplates: [],
    templateActiveCategory: 'all',
    templateSearchQuery: '',
    templateLang: 'ar',
    bgMusicAudio: null,
    bgMusicSourceNode: null,
    bgMusicGainNode: null,
    bgMusicMuted: false,
    triggeredSFXTimes: new Set()
  };
  STATE.scene = STATE.project.scenes[0];

  // -----------------------------------------------------------------
  // 3. DOM ELEMENT REFERENCES
  // -----------------------------------------------------------------
  const mainCanvas = document.getElementById('mainCanvas');
  const canvasContainer = document.getElementById('canvasContainer');
  const viewportStage = document.getElementById('viewportStage');
  const transformBox = document.getElementById('transformBox');
  const gridOverlay = document.getElementById('gridOverlay');
  const safeZoneOverlay = document.getElementById('safeZoneOverlay');
  const canvasCheckerWrap = document.getElementById('canvasCheckerWrap');

  const layersListContainer = document.getElementById('layersListContainer');
  const layerSearchInput = document.getElementById('layerSearchInput');
  const tabBtnLayers = document.getElementById('tabBtnLayers');
  const tabBtnPresets = document.getElementById('tabBtnPresets');
  const tabBtnTemplates = document.getElementById('tabBtnTemplates');
  const tabBtnAi = document.getElementById('tabBtnAi');
  const layersTabView = document.getElementById('layersTabView');
  const presetsTabView = document.getElementById('presetsTabView');
  const presetsCardsList = document.getElementById('presetsCardsList');
  const templatesTabView = document.getElementById('templatesTabView');
  const aiTabView = document.getElementById('aiTabView');
  const aiMotionQuotaBadge = document.getElementById('aiMotionQuotaBadge');
  const aiPromptInput = document.getElementById('aiPromptInput');
  const aiAspectSelector = document.getElementById('aiAspectSelector');
  const aiUseBrandKit = document.getElementById('aiUseBrandKit');
  const btnAiGenerateScene = document.getElementById('btnAiGenerateScene');
  const aiChatMessages = document.getElementById('aiChatMessages');
  const aiChatInput = document.getElementById('aiChatInput');
  const btnAiSendChat = document.getElementById('btnAiSendChat');
  const btnAiAuditScene = document.getElementById('btnAiAuditScene');
  const aiSuggestionsList = document.getElementById('aiSuggestionsList');
  const aiErrorBox = document.getElementById('aiErrorBox');
  const aiErrorFriendlyMsg = document.getElementById('aiErrorFriendlyMsg');
  const aiErrorTechDetails = document.getElementById('aiErrorTechDetails');
  const btnAddLayerBtn = document.getElementById('btnAddLayerBtn');
  const addLayerDropdown = document.getElementById('addLayerDropdown');

  const timeRulerCanvas = document.getElementById('timeRulerCanvas');
  const timelineTracksContainer = document.getElementById('timelineTracksContainer');
  const timelineTracksViewport = document.getElementById('timelineTracksViewport');
  const timelineHeadersContainer = document.getElementById('timelineHeadersContainer');
  const playheadLine = document.getElementById('playheadLine');
  const playheadHead = document.getElementById('playheadHead');
  const timecodeDisplay = document.getElementById('timecodeDisplay');

  // Multi-Scene Timeline Bar
  const sceneTabsList = document.getElementById('sceneTabsList');
  const btnAddSceneBtn = document.getElementById('btnAddSceneBtn');
  const sceneTransitionSelector = document.getElementById('sceneTransitionSelector');
  const sceneTransitionDur = document.getElementById('sceneTransitionDur');
  const btnPlayAllScenes = document.getElementById('btnPlayAllScenes');

  const btnPlayPause = document.getElementById('btnPlayPause');
  const playPauseIcon = document.getElementById('playPauseIcon');
  const playPauseText = document.getElementById('playPauseText');
  const btnStopTimeline = document.getElementById('btnStopTimeline');
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  const saveStatusIndicator = document.getElementById('saveStatusIndicator');
  const saveStatusText = document.getElementById('saveStatusText');
  const projectTitleInput = document.getElementById('projectTitleInput');
  const aspectPresetSelector = document.getElementById('aspectPresetSelector');
  const canvasZoomSelector = document.getElementById('canvasZoomSelector');

  const btnToggleSnap = document.getElementById('btnToggleSnap');
  const btnToggleGrid = document.getElementById('btnToggleGrid');
  const btnToggleSafeZone = document.getElementById('btnToggleSafeZone');
  const btnToggleCheckerboard = document.getElementById('btnToggleCheckerboard');

  const btnAlignLeft = document.getElementById('btnAlignLeft');
  const btnAlignCenterH = document.getElementById('btnAlignCenterH');
  const btnAlignRight = document.getElementById('btnAlignRight');
  const btnAlignTop = document.getElementById('btnAlignTop');
  const btnAlignCenterV = document.getElementById('btnAlignCenterV');
  const btnAlignBottom = document.getElementById('btnAlignBottom');
  const btnDuplicateLayer = document.getElementById('btnDuplicateLayer');
  const btnGroupLayers = document.getElementById('btnGroupLayers');
  const btnStaggerLayers = document.getElementById('btnStaggerLayers');
  const btnDeleteLayer = document.getElementById('btnDeleteLayer');

  const toastContainer = document.getElementById('toastContainer');
  const modalShortcuts = document.getElementById('modalShortcuts');
  const btnShortcutsHelp = document.getElementById('btnShortcutsHelp');
  const modalCustomAspect = document.getElementById('modalCustomAspect');
  const modalStagger = document.getElementById('modalStagger');
  const staggerOffsetInput = document.getElementById('staggerOffsetInput');
  const btnApplyStagger = document.getElementById('btnApplyStagger');
  const btnExportScene = document.getElementById('btnExportScene');
  const btnSendPremiere = document.getElementById('btnSendPremiere');
  const imageFileInput = document.getElementById('imageFileInput');

  // Property Inputs
  const propX = document.getElementById('propX');
  const propY = document.getElementById('propY');
  const propW = document.getElementById('propW');
  const propH = document.getElementById('propH');
  const propRot = document.getElementById('propRot');
  const propOpacity = document.getElementById('propOpacity');
  const propParentId = document.getElementById('propParentId');
  const propFillPicker = document.getElementById('propFillPicker');
  const propFillText = document.getElementById('propFillText');
  const propStrokePicker = document.getElementById('propStrokePicker');
  const propStrokeWidth = document.getElementById('propStrokeWidth');
  const propRadius = document.getElementById('propRadius');
  const propShadowBlur = document.getElementById('propShadowBlur');
  const propShadowY = document.getElementById('propShadowY');

  // Text Inputs & Effects
  const propSectionText = document.getElementById('propSectionText');
  const propTextContent = document.getElementById('propTextContent');
  const propFontFamily = document.getElementById('propFontFamily');
  const propFontSize = document.getElementById('propFontSize');
  const propTextAlign = document.getElementById('propTextAlign');
  const propTextGradToggle = document.getElementById('propTextGradToggle');
  const propTextGradControls = document.getElementById('propTextGradControls');
  const propTextGradColor1 = document.getElementById('propTextGradColor1');
  const propTextGradColor2 = document.getElementById('propTextGradColor2');
  const propTextGradAngle = document.getElementById('propTextGradAngle');
  const propTextGlowToggle = document.getElementById('propTextGlowToggle');
  const propTextGlowControls = document.getElementById('propTextGlowControls');
  const propTextGlowColor = document.getElementById('propTextGlowColor');
  const propTextGlowBlur = document.getElementById('propTextGlowBlur');
  const propTextBgBoxToggle = document.getElementById('propTextBgBoxToggle');
  const propTextBgBoxControls = document.getElementById('propTextBgBoxControls');
  const propTextBgBoxColor = document.getElementById('propTextBgBoxColor');
  const propTextBgBoxPadding = document.getElementById('propTextBgBoxPadding');
  const propTextBgBoxRadius = document.getElementById('propTextBgBoxRadius');
  const propTextPerLineBgToggle = document.getElementById('propTextPerLineBgToggle');
  const propTextPerLineBgControls = document.getElementById('propTextPerLineBgControls');
  const propTextPerLineBgColor = document.getElementById('propTextPerLineBgColor');
  const propTextPerLineBgPadding = document.getElementById('propTextPerLineBgPadding');
  const propTextPerLineBgRadius = document.getElementById('propTextPerLineBgRadius');

  // Shape Inputs
  const propSectionShape = document.getElementById('propSectionShape');
  const propShapeType = document.getElementById('propShapeType');
  const propShapeSidesGroup = document.getElementById('propShapeSidesGroup');
  const propShapeSides = document.getElementById('propShapeSides');
  const propTrimStart = document.getElementById('propTrimStart');
  const propTrimEnd = document.getElementById('propTrimEnd');

  // Counter Inputs
  const propSectionCounter = document.getElementById('propSectionCounter');
  const propCounterStart = document.getElementById('propCounterStart');
  const propCounterEnd = document.getElementById('propCounterEnd');
  const propCounterPrefix = document.getElementById('propCounterPrefix');
  const propCounterSuffix = document.getElementById('propCounterSuffix');

  // Progress Inputs
  const propSectionProgress = document.getElementById('propSectionProgress');
  const propProgressValue = document.getElementById('propProgressValue');
  const propProgressThickness = document.getElementById('propProgressThickness');
  const propProgressTrackPicker = document.getElementById('propProgressTrackPicker');
  const propProgressTrackText = document.getElementById('propProgressTrackText');

  // Chart Inputs
  const propSectionChart = document.getElementById('propSectionChart');
  const propChartType = document.getElementById('propChartType');
  const propChartDataRaw = document.getElementById('propChartDataRaw');

  // Image Inputs
  const propSectionImage = document.getElementById('propSectionImage');
  const btnChangeImageFile = document.getElementById('btnChangeImageFile');
  const propImageMask = document.getElementById('propImageMask');
  const propImageKenBurns = document.getElementById('propImageKenBurns');
  const btnRemoveImageBg = document.getElementById('btnRemoveImageBg');

  const presetInName = document.getElementById('presetInName');
  const presetInDur = document.getElementById('presetInDur');
  const presetLoopName = document.getElementById('presetLoopName');
  const selectedLayerBadge = document.getElementById('selectedLayerBadge');

  // Brand Kit Elements
  const btnBrandKit = document.getElementById('btnBrandKit');
  const modalBrandKit = document.getElementById('modalBrandKit');
  const btnSaveBrandKit = document.getElementById('btnSaveBrandKit');
  const btnApplyBrandToScene = document.getElementById('btnApplyBrandToScene');
  const bkColorPrimary = document.getElementById('bkColorPrimary');
  const bkColorPrimaryText = document.getElementById('bkColorPrimaryText');
  const bkColorSecondary = document.getElementById('bkColorSecondary');
  const bkColorSecondaryText = document.getElementById('bkColorSecondaryText');
  const bkColorAccent = document.getElementById('bkColorAccent');
  const bkColorAccentText = document.getElementById('bkColorAccentText');
  const bkColorDark = document.getElementById('bkColorDark');
  const bkColorDarkText = document.getElementById('bkColorDarkText');
  const bkColorLight = document.getElementById('bkColorLight');
  const bkColorLightText = document.getElementById('bkColorLightText');
  const bkColorExtra = document.getElementById('bkColorExtra');
  const bkColorExtraText = document.getElementById('bkColorExtraText');
  const bkFontHeading = document.getElementById('bkFontHeading');
  const bkFontBody = document.getElementById('bkFontBody');
  const bkWatermarkEnabled = document.getElementById('bkWatermarkEnabled');
  const bkWatermarkControls = document.getElementById('bkWatermarkControls');
  const bkWatermarkType = document.getElementById('bkWatermarkType');
  const bkWatermarkPos = document.getElementById('bkWatermarkPos');
  const bkWatermarkText = document.getElementById('bkWatermarkText');
  const bkWatermarkTextGroup = document.getElementById('bkWatermarkTextGroup');
  const bkWatermarkImageGroup = document.getElementById('bkWatermarkImageGroup');
  const btnUploadBrandLogo = document.getElementById('btnUploadBrandLogo');
  const bkLogoFileInput = document.getElementById('bkLogoFileInput');
  const bkLogoFileName = document.getElementById('bkLogoFileName');
  const bkWatermarkOpacity = document.getElementById('bkWatermarkOpacity');
  const bkWatermarkScale = document.getElementById('bkWatermarkScale');

  // Template Browser Elements
  const templateSearchInput = document.getElementById('templateSearchInput');
  const templateCategoryPills = document.getElementById('templateCategoryPills');
  const templatesListContainer = document.getElementById('templatesListContainer');
  const btnTplLangAr = document.getElementById('btnTplLangAr');
  const btnTplLangEn = document.getElementById('btnTplLangEn');
  const btnSaveAsTemplate = document.getElementById('btnSaveAsTemplate');
  const btnQuickSaveTemplate = document.getElementById('btnQuickSaveTemplate');
  const modalSaveTemplate = document.getElementById('modalSaveTemplate');
  const saveTplName = document.getElementById('saveTplName');
  const saveTplCategory = document.getElementById('saveTplCategory');
  const saveTplDesc = document.getElementById('saveTplDesc');
  const btnConfirmSaveTemplate = document.getElementById('btnConfirmSaveTemplate');
  const modalShareTemplate = document.getElementById('modalShareTemplate');
  const shareTplUrlInput = document.getElementById('shareTplUrlInput');
  const btnCopyShareUrl = document.getElementById('btnCopyShareUrl');

  // SFX & Audio Elements
  const presetInSFX = document.getElementById('presetInSFX');
  const btnPreviewSFX = document.getElementById('btnPreviewSFX');
  const btnUploadMusic = document.getElementById('btnUploadMusic');
  const musicFileInput = document.getElementById('musicFileInput');
  const btnToggleMusicMute = document.getElementById('btnToggleMusicMute');
  const btnRemoveMusic = document.getElementById('btnRemoveMusic');
  const musicBtnLabel = document.getElementById('musicBtnLabel');
  const musicMuteIcon = document.getElementById('musicMuteIcon');

  // -----------------------------------------------------------------
  // 4. TOAST NOTIFICATIONS & STATUS
  // -----------------------------------------------------------------
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type === 'success') toast.style.borderRightColor = 'var(--accent-emerald)';
    else if (type === 'error') toast.style.borderRightColor = 'var(--danger)';
    else if (type === 'warning') toast.style.borderRightColor = 'var(--accent-amber)';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function setSavingStatus(status, text) {
    saveStatusIndicator.className = 'status-badge ' + (status === 'saving' ? 'saving' : '');
    saveStatusText.textContent = text;
  }

  // -----------------------------------------------------------------
  // 5. UNDO / REDO HISTORY SYSTEM
  // -----------------------------------------------------------------
  function pushUndo() {
    STATE.undoStack.push(JSON.stringify(STATE.scene));
    if (STATE.undoStack.length > 80) STATE.undoStack.shift();
    STATE.redoStack = [];
    updateUndoRedoUI();
    scheduleAutoSave();
  }

  function undo() {
    if (!STATE.undoStack.length) return;
    STATE.redoStack.push(JSON.stringify(STATE.scene));
    const prev = STATE.undoStack.pop();
    STATE.scene = JSON.parse(prev);
    updateUndoRedoUI();
    renderAll();
    showToast('تم التراجع', 'info');
    scheduleAutoSave();
  }

  function redo() {
    if (!STATE.redoStack.length) return;
    STATE.undoStack.push(JSON.stringify(STATE.scene));
    const next = STATE.redoStack.pop();
    STATE.scene = JSON.parse(next);
    updateUndoRedoUI();
    renderAll();
    showToast('تمت الإعادة', 'info');
    scheduleAutoSave();
  }

  function updateUndoRedoUI() {
    btnUndo.disabled = STATE.undoStack.length === 0;
    btnRedo.disabled = STATE.redoStack.length === 0;
  }

  // -----------------------------------------------------------------
  // 6. PERSISTENCE: LOCALSTORAGE & FIRESTORE AUTO-SAVE
  // -----------------------------------------------------------------
  function scheduleAutoSave() {
    setSavingStatus('saving', 'جاري الحفظ...');
    clearTimeout(STATE.autoSaveDebounce);
    STATE.autoSaveDebounce = setTimeout(async () => {
      // 1. LocalStorage draft
      try {
        const payload = {
          version: 2,
          project: STATE.project,
          scene: STATE.scene,
          activeSceneIndex: STATE.activeSceneIndex
        };
        localStorage.setItem('mickey_motion_editor_draft_v2', JSON.stringify(payload));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }

      // 2. Firestore Cloud Vault (if user logged in)
      if (STATE.currentUser && window.firebase) {
        try {
          const db = firebase.firestore();
          await db.collection('users').doc(STATE.currentUser.uid)
            .collection('vault').doc('motion_scene_current')
            .set({
              project: STATE.project,
              scene: STATE.scene,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          const nowStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
          setSavingStatus('saved', `✓ محفوظ سحابياً (${nowStr})`);
        } catch (err) {
          console.warn('Firestore autosave warning:', err);
          setSavingStatus('saved', 'محفوظ محلياً');
        }
      } else {
        const nowStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        setSavingStatus('saved', `✓ محفوظ محلياً (${nowStr})`);
      }
    }, 800);
  }

  function tryRestoreDraft() {
    try {
      const draft = localStorage.getItem('mickey_motion_editor_draft_v2');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed) {
          if (parsed.project && Array.isArray(parsed.project.scenes) && parsed.project.scenes.length) {
            STATE.project = parsed.project;
            STATE.activeSceneIndex = Math.min(parsed.activeSceneIndex || 0, STATE.project.scenes.length - 1);
            STATE.scene = STATE.project.scenes[STATE.activeSceneIndex];
            projectTitleInput.value = STATE.scene.name || 'مشروع محفوظ';
            showToast('تمت استعادة مسودة المشروع بنجاح', 'success');
          } else if (parsed.version === 2 && Array.isArray(parsed.layers)) {
            STATE.scene = parsed;
            STATE.project = {
              version: 2,
              id: 'proj_' + Date.now().toString(36),
              name: STATE.scene.name || 'مشروع موشن جديد',
              scenes: [STATE.scene],
              transitions: []
            };
            STATE.activeSceneIndex = 0;
            projectTitleInput.value = STATE.scene.name || 'مشهد محفوظ';
            showToast('تمت استعادة مسودة العمل الأخيرة بنجاح', 'success');
          }
        }
      }
    } catch (err) {
      console.warn('Draft recovery failed:', err);
    }
  }

  // -----------------------------------------------------------------
  // 7. FIREBASE AUTH INTEGRATION
  // -----------------------------------------------------------------
  function initFirebaseAuth() {
    if (!window.firebase) return;
    try {
      const config = {
        apiKey: "AIzaSyAbwmXwJkb5nl2sUDCZ0ing_cWs0lbYAWg",
        authDomain: "mickey-gemini-studio.firebaseapp.com",
        projectId: "mickey-gemini-studio",
        storageBucket: "mickey-gemini-studio.firebasestorage.app",
        messagingSenderId: "539974179095",
        appId: "1:539974179095:web:5e36791365e6a2cdefff52"
      };
      if (!firebase.apps.length) firebase.initializeApp(config);
      firebase.auth().onAuthStateChanged(async (user) => {
        STATE.currentUser = user;
        if (user) {
          // Sync Brand Kit and My Templates for user
          loadBrandKit(user);
          loadMyTemplates(user);

          // Check if remote scene is newer
          try {
            const db = firebase.firestore();
            const doc = await db.collection('users').doc(user.uid).collection('vault').doc('motion_scene_current').get();
            if (doc.exists && doc.data().scene) {
              const remoteScene = doc.data().scene;
              if (remoteScene && remoteScene.version === 2) {
                // Keep local if user already modified, else restore
                if (!localStorage.getItem('mickey_motion_editor_draft_v2')) {
                  STATE.scene = remoteScene;
                  renderAll();
                }
              }
            }
          } catch (e) {
            console.warn('Cloud sync check:', e);
          }
        }
      });
    } catch (e) {
      console.warn('Firebase init warning:', e);
    }
  }

  // -----------------------------------------------------------------
  // 8. CANVAS & VIEWPORT LAYOUT & ZOOM/PAN
  // -----------------------------------------------------------------
  function getSelectedLayer() {
    if (!STATE.selectedLayerIds.length) return null;
    return STATE.scene.layers.find(l => l.id === STATE.selectedLayerIds[0]) || null;
  }

  function calculateFitScale() {
    const padding = 40;
    const cw = canvasContainer.clientWidth - padding * 2;
    const ch = canvasContainer.clientHeight - padding * 2;
    if (cw <= 0 || ch <= 0) return 0.5;
    const scaleX = cw / STATE.scene.width;
    const scaleY = ch / STATE.scene.height;
    return Math.min(scaleX, scaleY);
  }

  function updateViewportTransform() {
    let targetScale = 1.0;
    if (STATE.zoomLevel === 'fit') {
      targetScale = calculateFitScale();
    } else {
      targetScale = parseFloat(STATE.zoomLevel) || 1.0;
    }
    STATE.scale = targetScale;

    // Center in container
    const sceneW = STATE.scene.width * targetScale;
    const sceneH = STATE.scene.height * targetScale;
    const containerW = canvasContainer.clientWidth;
    const containerH = canvasContainer.clientHeight;

    const baseLeft = Math.max(20, (containerW - sceneW) / 2);
    const baseTop = Math.max(20, (containerH - sceneH) / 2);

    viewportStage.style.transform = `translate(${baseLeft + STATE.panX}px, ${baseTop + STATE.panY}px) scale(${targetScale})`;

    updateTransformHandles();
  }

  // -----------------------------------------------------------------
  // 9. RENDER ENGINE: CANVAS RENDER & TRANSFORM HANDLES
  // -----------------------------------------------------------------
  function renderCanvasFrame() {
    // 1. Sync canvas dimension with scene
    if (mainCanvas.width !== STATE.scene.width || mainCanvas.height !== STATE.scene.height) {
      mainCanvas.width = STATE.scene.width;
      mainCanvas.height = STATE.scene.height;
      viewportStage.style.width = STATE.scene.width + 'px';
      viewportStage.style.height = STATE.scene.height + 'px';
    }

    // 2. Render through shared motion-engine.js
    if (window.MotionEngine) {
      MotionEngine.renderFrame(STATE.scene, STATE.currentTime, mainCanvas);
    }

    // 3. Update overlays
    updateTransformHandles();
  }

  function updateTransformHandles() {
    const layer = getSelectedLayer();
    if (!layer || layer.visible === false) {
      transformBox.style.display = 'none';
      return;
    }

    // Evaluate sampled transform at current time
    const t = layer.transform;
    const sampledX = MotionEngine.sampleProperty(layer, 'transform.x', STATE.currentTime);
    const sampledY = MotionEngine.sampleProperty(layer, 'transform.y', STATE.currentTime);
    const sampledW = t.w;
    const sampledH = t.h;
    const sampledRot = MotionEngine.sampleProperty(layer, 'transform.rotation', STATE.currentTime);

    const anchorX = t.anchorX !== undefined ? t.anchorX : 0.5;
    const anchorY = t.anchorY !== undefined ? t.anchorY : 0.5;

    const left = sampledX - sampledW * anchorX;
    const top = sampledY - sampledH * anchorY;

    transformBox.style.display = 'block';
    transformBox.style.left = left + 'px';
    transformBox.style.top = top + 'px';
    transformBox.style.width = sampledW + 'px';
    transformBox.style.height = sampledH + 'px';
    transformBox.style.transformOrigin = `${anchorX * 100}% ${anchorY * 100}%`;
    transformBox.style.transform = `rotate(${sampledRot}deg)`;
  }

  // -----------------------------------------------------------------
  // 10. INTERACTIVE TRANSFORM & SELECTION HANDLERS
  // -----------------------------------------------------------------
  let isDraggingLayer = false;
  let isTransformingHandle = false;
  let activeHandle = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialLayerTransform = null;
  let isPanningCanvas = false;
  let panStartX = 0;
  let panStartY = 0;

  function initCanvasInteractions() {
    // 1. Canvas click selection & dragging
    canvasContainer.addEventListener('mousedown', (e) => {
      // Middle click or space-down initiates pan
      if (e.button === 1 || e.code === 'Space' || e.shiftKey && e.button === 0 && e.target === canvasContainer) {
        isPanningCanvas = true;
        panStartX = e.clientX - STATE.panX;
        panStartY = e.clientY - STATE.panY;
        canvasContainer.classList.add('panning-active');
        e.preventDefault();
        return;
      }

      // Handle interaction
      if (e.target.classList.contains('transform-handle') || e.target.classList.contains('handle-rot')) {
        isTransformingHandle = true;
        activeHandle = e.target.dataset.handle;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const layer = getSelectedLayer();
        if (layer) initialLayerTransform = JSON.parse(JSON.stringify(layer.transform));
        pushUndo();
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      // Transform box body drag
      if (e.target === transformBox) {
        isDraggingLayer = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const layer = getSelectedLayer();
        if (layer) initialLayerTransform = JSON.parse(JSON.stringify(layer.transform));
        pushUndo();
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      // Hit test layers from front to back
      const rect = mainCanvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) * (STATE.scene.width / rect.width);
      const clickY = (e.clientY - rect.top) * (STATE.scene.height / rect.height);

      let hitLayer = null;
      for (let i = STATE.scene.layers.length - 1; i >= 0; i--) {
        const l = STATE.scene.layers[i];
        if (l.visible === false || l.locked === true) continue;
        const lx = l.transform.x;
        const ly = l.transform.y;
        const lw = l.transform.w;
        const lh = l.transform.h;
        const ax = l.transform.anchorX !== undefined ? l.transform.anchorX : 0.5;
        const ay = l.transform.anchorY !== undefined ? l.transform.anchorY : 0.5;
        const minX = lx - lw * ax;
        const maxX = minX + lw;
        const minY = ly - lh * ay;
        const maxY = minY + lh;

        if (clickX >= minX && clickX <= maxX && clickY >= minY && clickY <= maxY) {
          hitLayer = l;
          break;
        }
      }

      if (hitLayer) {
        if (e.shiftKey || e.ctrlKey) {
          if (STATE.selectedLayerIds.includes(hitLayer.id)) {
            STATE.selectedLayerIds = STATE.selectedLayerIds.filter(id => id !== hitLayer.id);
          } else {
            STATE.selectedLayerIds.push(hitLayer.id);
          }
        } else {
          STATE.selectedLayerIds = [hitLayer.id];
        }
        isDraggingLayer = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialLayerTransform = JSON.parse(JSON.stringify(hitLayer.transform));
        pushUndo();
      } else {
        // Clicked empty canvas background
        if (!e.shiftKey && !e.ctrlKey) {
          STATE.selectedLayerIds = [];
        }
      }

      renderAll();
    });

    window.addEventListener('mousemove', (e) => {
      // Panning
      if (isPanningCanvas) {
        STATE.panX = e.clientX - panStartX;
        STATE.panY = e.clientY - panStartY;
        updateViewportTransform();
        return;
      }

      // Dragging layer position
      if (isDraggingLayer && initialLayerTransform) {
        const layer = getSelectedLayer();
        if (!layer) return;

        const deltaScreenX = e.clientX - dragStartX;
        const deltaScreenY = e.clientY - dragStartY;
        const deltaCanvasX = deltaScreenX / STATE.scale;
        const deltaCanvasY = deltaScreenY / STATE.scale;

        let newX = Math.round(initialLayerTransform.x + deltaCanvasX);
        let newY = Math.round(initialLayerTransform.y + deltaCanvasY);

        // Snapping
        if (STATE.snapEnabled) {
          const snapThreshold = 12;
          const centerX = STATE.scene.width / 2;
          const centerY = STATE.scene.height / 2;
          if (Math.abs(newX - centerX) < snapThreshold) newX = centerX;
          if (Math.abs(newY - centerY) < snapThreshold) newY = centerY;
        }

        layer.transform.x = newX;
        layer.transform.y = newY;
        renderCanvasFrame();
        updatePropertiesPanel();
        return;
      }

      // Resizing / Rotating handle
      if (isTransformingHandle && initialLayerTransform) {
        const layer = getSelectedLayer();
        if (!layer) return;

        const deltaScreenX = e.clientX - dragStartX;
        const deltaScreenY = e.clientY - dragStartY;
        const deltaCanvasX = deltaScreenX / STATE.scale;
        const deltaCanvasY = deltaScreenY / STATE.scale;

        if (activeHandle === 'rot') {
          // Calculate angle relative to center
          const rect = mainCanvas.getBoundingClientRect();
          const centerX = rect.left + (initialLayerTransform.x / STATE.scene.width) * rect.width;
          const centerY = rect.top + (initialLayerTransform.y / STATE.scene.height) * rect.height;
          const rad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
          let deg = Math.round((rad * 180 / Math.PI) + 90);
          if (e.shiftKey) deg = Math.round(deg / 15) * 15; // 15 degree snapping
          layer.transform.rotation = deg;
        } else {
          // Scale handles
          let newW = initialLayerTransform.w;
          let newH = initialLayerTransform.h;
          let newX = initialLayerTransform.x;
          let newY = initialLayerTransform.y;

          if (activeHandle.includes('e')) newW = Math.max(20, initialLayerTransform.w + deltaCanvasX);
          if (activeHandle.includes('w')) {
            const dw = deltaCanvasX;
            newW = Math.max(20, initialLayerTransform.w - dw);
            newX = initialLayerTransform.x + dw / 2;
          }
          if (activeHandle.includes('s')) newH = Math.max(20, initialLayerTransform.h + deltaCanvasY);
          if (activeHandle.includes('n')) {
            const dh = deltaCanvasY;
            newH = Math.max(20, initialLayerTransform.h - dh);
            newY = initialLayerTransform.y + dh / 2;
          }

          // Keep aspect ratio if Shift is held
          if (e.shiftKey && (activeHandle === 'nw' || activeHandle === 'ne' || activeHandle === 'se' || activeHandle === 'sw')) {
            const aspect = initialLayerTransform.w / initialLayerTransform.h;
            newH = Math.round(newW / aspect);
          }

          layer.transform.w = Math.round(newW);
          layer.transform.h = Math.round(newH);
          layer.transform.x = Math.round(newX);
          layer.transform.y = Math.round(newY);
        }

        renderCanvasFrame();
        updatePropertiesPanel();
      }
    });

    window.addEventListener('mouseup', () => {
      if (isPanningCanvas) {
        isPanningCanvas = false;
        canvasContainer.classList.remove('panning-active');
      }
      if (isDraggingLayer || isTransformingHandle) {
        isDraggingLayer = false;
        isTransformingHandle = false;
        activeHandle = null;
        initialLayerTransform = null;
        scheduleAutoSave();
      }
    });

    // Zoom on wheel (Ctrl + Wheel or Pinch)
    canvasContainer.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        let cur = STATE.scale;
        cur = Math.max(0.15, Math.min(3.0, cur * factor));
        STATE.zoomLevel = cur;
        canvasZoomSelector.value = cur.toFixed(2);
        updateViewportTransform();
      }
    }, { passive: false });
  }

  // -----------------------------------------------------------------
  // 11. LAYERS PANEL CONTROLLER (DRAG-REORDER, VISIBILITY, LOCK)
  // -----------------------------------------------------------------
  function renderLayersPanel() {
    layersListContainer.innerHTML = '';
    const query = (layerSearchInput.value || '').trim().toLowerCase();

    // Layers ordered from top (index N) to bottom (index 0) in stack
    const reversed = [...STATE.scene.layers].reverse();

    reversed.forEach((layer) => {
      if (query && !layer.name.toLowerCase().includes(query)) return;

      const row = document.createElement('div');
      const isSelected = STATE.selectedLayerIds.includes(layer.id);
      row.className = `layer-row ${isSelected ? 'selected' : ''}`;
      row.draggable = true;
      row.dataset.layerId = layer.id;

      // Type Icon
      let iconClass = 'fa-shapes';
      if (layer.type === 'text') iconClass = 'fa-font';
      else if (layer.type === 'counter') iconClass = 'fa-stopwatch-20';
      else if (layer.type === 'chart') iconClass = 'fa-chart-column';
      else if (layer.type === 'image') iconClass = 'fa-image';

      row.innerHTML = `
        <div class="layer-icon"><i class="fa-solid ${iconClass}"></i></div>
        <span class="layer-name-label" title="انقر نقراً مزدوجاً لتعديل الاسم">${layer.name}</span>
        <div class="layer-actions">
          <button class="icon-btn btn-lock ${layer.locked ? 'active' : ''}" title="${layer.locked ? 'إلغاء القفل' : 'قفل الطبقة'}">
            <i class="fa-solid ${layer.locked ? 'fa-lock' : 'fa-lock-open'}"></i>
          </button>
          <button class="icon-btn btn-vis ${layer.visible === false ? 'active' : ''}" title="${layer.visible === false ? 'إظهار الطبقة' : 'إخفاء الطبقة'}">
            <i class="fa-regular ${layer.visible === false ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
        </div>
      `;

      // Selection click
      row.addEventListener('click', (e) => {
        if (e.target.closest('.layer-actions')) return;
        if (e.shiftKey || e.ctrlKey) {
          if (STATE.selectedLayerIds.includes(layer.id)) {
            STATE.selectedLayerIds = STATE.selectedLayerIds.filter(id => id !== layer.id);
          } else {
            STATE.selectedLayerIds.push(layer.id);
          }
        } else {
          STATE.selectedLayerIds = [layer.id];
        }
        renderAll();
      });

      // Inline rename on double-click
      const label = row.querySelector('.layer-name-label');
      label.addEventListener('dblclick', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'layer-name-input';
        input.value = layer.name;
        label.replaceWith(input);
        input.focus();
        input.select();

        function finishRename() {
          const val = input.value.trim();
          if (val) {
            pushUndo();
            layer.name = val;
          }
          renderLayersPanel();
          renderTimelineTracks();
        }

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') finishRename();
          if (ke.key === 'Escape') renderLayersPanel();
        });
      });

      // Lock toggle
      row.querySelector('.btn-lock').addEventListener('click', () => {
        pushUndo();
        layer.locked = !layer.locked;
        renderAll();
      });

      // Visibility toggle
      row.querySelector('.btn-vis').addEventListener('click', () => {
        pushUndo();
        layer.visible = layer.visible === undefined ? false : !layer.visible;
        renderAll();
      });

      // Drag and drop reordering
      row.addEventListener('dragstart', (de) => {
        de.dataTransfer.setData('text/plain', layer.id);
      });

      row.addEventListener('dragover', (de) => {
        de.preventDefault();
        row.style.borderTop = '2px solid var(--accent)';
      });

      row.addEventListener('dragleave', () => {
        row.style.borderTop = '';
      });

      row.addEventListener('drop', (de) => {
        de.preventDefault();
        row.style.borderTop = '';
        const sourceId = de.dataTransfer.getData('text/plain');
        if (sourceId && sourceId !== layer.id) {
          reorderLayers(sourceId, layer.id);
        }
      });

      layersListContainer.appendChild(row);
    });
  }

  function reorderLayers(sourceId, targetId) {
    const srcIdx = STATE.scene.layers.findIndex(l => l.id === sourceId);
    const dstIdx = STATE.scene.layers.findIndex(l => l.id === targetId);
    if (srcIdx === -1 || dstIdx === -1) return;

    pushUndo();
    const [moved] = STATE.scene.layers.splice(srcIdx, 1);
    STATE.scene.layers.splice(dstIdx, 0, moved);
    renderAll();
  }

  // -----------------------------------------------------------------
  // 12. TIMELINE PANEL CONTROLLER (TRACKS, CLIPS, KEYFRAMES, SCRUB)
  // -----------------------------------------------------------------
  const BASE_PPS = 120; // 120 pixels per second at 1.0 zoom

  function renderTimelineRuler() {
    const pps = BASE_PPS * STATE.timelineZoom;
    const dur = STATE.scene.duration;
    const totalW = Math.max(timelineTracksViewport.clientWidth, dur * pps + 100);
    timeRulerCanvas.width = totalW;
    timelineTracksContainer.style.width = totalW + 'px';

    const ctx = timeRulerCanvas.getContext('2d');
    ctx.clearRect(0, 0, totalW, 26);
    ctx.strokeStyle = '#252a3d';
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, sans-serif';
    ctx.lineWidth = 1;

    // Draw second and sub-second ticks
    const stepSec = STATE.timelineZoom > 1.2 ? 0.2 : 0.5;
    for (let t = 0; t <= dur + 0.1; t += stepSec) {
      const x = Math.round(t * pps);
      const isWhole = Math.abs(t - Math.round(t)) < 0.05;
      ctx.beginPath();
      ctx.moveTo(x, isWhole ? 10 : 18);
      ctx.lineTo(x, 26);
      ctx.stroke();

      if (isWhole) {
        ctx.fillText(`${Math.round(t)}s`, x + 4, 18);
      }
    }
  }

  function renderTimelineTracks() {
    renderTimelineRuler();
    timelineHeadersContainer.innerHTML = '';
    timelineTracksContainer.innerHTML = '';

    const pps = BASE_PPS * STATE.timelineZoom;

    // Render tracks in order
    STATE.scene.layers.forEach((layer) => {
      const isSelected = STATE.selectedLayerIds.includes(layer.id);

      // Header row
      const headerRow = document.createElement('div');
      headerRow.className = `timeline-header-row ${isSelected ? 'selected' : ''}`;
      headerRow.innerHTML = `<span>${layer.name}</span>`;
      headerRow.addEventListener('click', () => {
        STATE.selectedLayerIds = [layer.id];
        renderAll();
      });
      timelineHeadersContainer.appendChild(headerRow);

      // Track row
      const trackRow = document.createElement('div');
      trackRow.className = 'timeline-track-row';

      // Duration Clip Bar
      const startX = layer.start * pps;
      const barW = Math.max(12, layer.duration * pps);

      const clipBar = document.createElement('div');
      clipBar.className = `timeline-clip-bar ${isSelected ? 'selected' : ''}`;
      clipBar.style.left = startX + 'px';
      clipBar.style.width = barW + 'px';
      clipBar.innerHTML = `
        <div class="clip-handle clip-handle-left" title="قص البداية"></div>
        <span style="pointer-events:none; overflow:hidden; text-overflow:ellipsis;">${layer.name}</span>
        <div class="clip-handle clip-handle-right" title="قص النهاية"></div>
      `;

      // Clip dragging logic
      initClipBarInteractions(clipBar, layer, pps);

      // Render Keyframe Diamonds (◆)
      if (layer.keyframes) {
        Object.keys(layer.keyframes).forEach((propPath) => {
          const kfs = layer.keyframes[propPath];
          kfs.forEach((kf, idx) => {
            const diamond = document.createElement('div');
            diamond.className = 'keyframe-diamond';
            diamond.title = `${propPath}: ${kf.v} (${kf.ease || 'linear'})`;
            const kfTime = (layer.start + kf.t) * pps;
            diamond.style.left = kfTime + 'px';

            diamond.addEventListener('click', (de) => {
              de.stopPropagation();
              STATE.currentTime = layer.start + kf.t;
              renderAll();
              promptKeyframeEasing(layer, propPath, idx);
            });

            trackRow.appendChild(diamond);
          });
        });
      }

      trackRow.appendChild(clipBar);
      timelineTracksContainer.appendChild(trackRow);
    });

    updatePlayheadPosition();
  }

  function initClipBarInteractions(clipBar, layer, pps) {
    let mode = null; // 'move', 'trim-left', 'trim-right'
    let startMouseX = 0;
    let initialStart = 0;
    let initialDur = 0;

    clipBar.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      STATE.selectedLayerIds = [layer.id];
      renderAll();

      if (e.target.classList.contains('clip-handle-left')) mode = 'trim-left';
      else if (e.target.classList.contains('clip-handle-right')) mode = 'trim-right';
      else mode = 'move';

      startMouseX = e.clientX;
      initialStart = layer.start;
      initialDur = layer.duration;
      pushUndo();

      function onMove(me) {
        const deltaSec = (me.clientX - startMouseX) / pps;
        if (mode === 'move') {
          let newStart = Math.max(0, initialStart + deltaSec);
          if (STATE.snapEnabled && Math.abs(newStart - STATE.currentTime) < 0.1) newStart = STATE.currentTime;
          layer.start = Math.round(newStart * 100) / 100;
        } else if (mode === 'trim-left') {
          let newStart = Math.max(0, initialStart + deltaSec);
          let newDur = Math.max(0.1, initialDur - (newStart - initialStart));
          layer.start = Math.round(newStart * 100) / 100;
          layer.duration = Math.round(newDur * 100) / 100;
        } else if (mode === 'trim-right') {
          let newDur = Math.max(0.1, initialDur + deltaSec);
          layer.duration = Math.round(newDur * 100) / 100;
        }
        renderTimelineTracks();
        renderCanvasFrame();
      }

      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        scheduleAutoSave();
      }

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  function updatePlayheadPosition() {
    const pps = BASE_PPS * STATE.timelineZoom;
    const playheadX = STATE.currentTime * pps;
    playheadLine.style.left = playheadX + 'px';

    const min = Math.floor(STATE.currentTime / 60).toString().padStart(2, '0');
    const sec = (STATE.currentTime % 60).toFixed(2).padStart(5, '0');
    const totalMin = Math.floor(STATE.scene.duration / 60).toString().padStart(2, '0');
    const totalSec = (STATE.scene.duration % 60).toFixed(2).padStart(5, '0');
    const frameNum = Math.floor(STATE.currentTime * STATE.scene.fps);

    timecodeDisplay.textContent = `${min}:${sec} / ${totalMin}:${totalSec} (#${frameNum})`;
  }

  // Scrubbing on Time Ruler
  function initTimeRulerScrubbing() {
    function scrubToEvent(e) {
      const rect = timeRulerCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pps = BASE_PPS * STATE.timelineZoom;
      let newTime = Math.max(0, Math.min(STATE.scene.duration, clickX / pps));
      STATE.currentTime = Math.round(newTime * 100) / 100;
      STATE.triggeredSFXTimes.clear();
      syncBgMusicTime();
      renderAll();
    }

    timeRulerCanvas.addEventListener('mousedown', (e) => {
      scrubToEvent(e);
      function onScrubMove(me) { scrubToEvent(me); }
      function onScrubUp() {
        window.removeEventListener('mousemove', onScrubMove);
        window.removeEventListener('mouseup', onScrubUp);
      }
      window.addEventListener('mousemove', onScrubMove);
      window.addEventListener('mouseup', onScrubUp);
    });
  }

  // -----------------------------------------------------------------
  // 13. PROPERTIES PANEL CONTROLLER (INPUT SYNC & NUMBER SCRUBBING)
  // -----------------------------------------------------------------
  function updatePropertiesPanel() {
    const layer = getSelectedLayer();
    if (!layer) {
      selectedLayerBadge.textContent = 'لا يوجد تحديد';
      propSectionText.style.display = 'none';
      propSectionCounter.style.display = 'none';
      propSectionShape.style.display = 'none';
      propSectionProgress.style.display = 'none';
      propSectionChart.style.display = 'none';
      propSectionImage.style.display = 'none';
      return;
    }

    selectedLayerBadge.textContent = `${layer.name} (${layer.type})`;

    // Transform
    propX.value = Math.round(layer.transform.x);
    propY.value = Math.round(layer.transform.y);
    propW.value = Math.round(layer.transform.w);
    propH.value = Math.round(layer.transform.h);
    propRot.value = Math.round(layer.transform.rotation || 0);
    propOpacity.value = Math.round((layer.transform.opacity !== undefined ? layer.transform.opacity : 1) * 100);

    // Parent Layer Dropdown
    propParentId.innerHTML = '<option value="">بدون أب (مستقلة)</option>';
    STATE.scene.layers.forEach(other => {
      if (other.id !== layer.id) {
        const opt = document.createElement('option');
        opt.value = other.id;
        opt.textContent = `${other.name} (${other.type})`;
        if (layer.parentId === other.id) opt.selected = true;
        propParentId.appendChild(opt);
      }
    });

    // Style
    propFillPicker.value = (layer.style && layer.style.fill && layer.style.fill.startsWith('#')) ? layer.style.fill : '#6366f1';
    propFillText.value = (layer.style && layer.style.fill) ? layer.style.fill : '#6366f1';
    propStrokePicker.value = (layer.style && layer.style.stroke) ? layer.style.stroke : '#ffffff';
    propStrokeWidth.value = (layer.style && layer.style.strokeWidth) || 0;
    propRadius.value = (layer.style && layer.style.radius) || 0;
    propShadowBlur.value = (layer.style && layer.style.shadow && layer.style.shadow.blur) || 0;
    propShadowY.value = (layer.style && layer.style.shadow && layer.style.shadow.y) || 0;

    // Text Properties & Effects
    if (layer.type === 'text') {
      propSectionText.style.display = 'block';
      propTextContent.value = (layer.content && layer.content.text) || '';
      propFontFamily.value = (layer.style && layer.style.font) || 'Cairo';
      propFontSize.value = (layer.style && layer.style.fontSize) || 64;
      propTextAlign.value = (layer.style && layer.style.align) || 'center';

      // Gradient
      const hasGrad = !!(layer.style && layer.style.gradient);
      propTextGradToggle.checked = hasGrad;
      propTextGradControls.style.display = hasGrad ? 'flex' : 'none';
      if (hasGrad && layer.style.gradient.colors) {
        propTextGradColor1.value = layer.style.gradient.colors[0] || '#6366f1';
        propTextGradColor2.value = layer.style.gradient.colors[1] || '#06b6d4';
        propTextGradAngle.value = layer.style.gradient.angle !== undefined ? layer.style.gradient.angle : 45;
      }

      // Glow
      const hasGlow = !!(layer.style && layer.style.glow);
      propTextGlowToggle.checked = hasGlow;
      propTextGlowControls.style.display = hasGlow ? 'flex' : 'none';
      if (hasGlow) {
        propTextGlowColor.value = layer.style.glow.color || '#06b6d4';
        propTextGlowBlur.value = layer.style.glow.blur || 20;
      }

      // Background Box
      const hasBgBox = !!(layer.style && layer.style.backgroundBox);
      propTextBgBoxToggle.checked = hasBgBox;
      propTextBgBoxControls.style.display = hasBgBox ? 'flex' : 'none';
      if (hasBgBox) {
        propTextBgBoxColor.value = layer.style.backgroundBox.fill || '#1e293b';
        propTextBgBoxPadding.value = layer.style.backgroundBox.padding !== undefined ? layer.style.backgroundBox.padding : 12;
        propTextBgBoxRadius.value = layer.style.backgroundBox.radius !== undefined ? layer.style.backgroundBox.radius : 8;
      }

      // Per-Line Background
      const hasPerLine = !!(layer.style && layer.style.perLineBackground);
      propTextPerLineBgToggle.checked = hasPerLine;
      propTextPerLineBgControls.style.display = hasPerLine ? 'flex' : 'none';
      if (hasPerLine) {
        propTextPerLineBgColor.value = layer.style.perLineBackground.fill || '#0f172a';
        propTextPerLineBgPadding.value = layer.style.perLineBackground.padding !== undefined ? layer.style.perLineBackground.padding : 8;
        propTextPerLineBgRadius.value = layer.style.perLineBackground.radius !== undefined ? layer.style.perLineBackground.radius : 6;
      }
    } else {
      propSectionText.style.display = 'none';
    }

    // Counter Properties
    if (layer.type === 'counter') {
      propSectionCounter.style.display = 'block';
      propCounterStart.value = (layer.content && layer.content.startVal !== undefined) ? layer.content.startVal : 0;
      propCounterEnd.value = (layer.content && layer.content.endVal !== undefined) ? layer.content.endVal : 100;
      propCounterPrefix.value = (layer.content && layer.content.prefix) || '';
      propCounterSuffix.value = (layer.content && layer.content.suffix) || '';
    } else {
      propSectionCounter.style.display = 'none';
    }

    // Shape Properties
    if (layer.type === 'shape') {
      propSectionShape.style.display = 'block';
      propShapeType.value = (layer.content && layer.content.shape) || 'rounded-rect';
      const isPoly = propShapeType.value === 'polygon' || propShapeType.value === 'star';
      propShapeSidesGroup.style.display = isPoly ? 'block' : 'none';
      propShapeSides.value = (layer.content && layer.content.sides) || 5;
      propTrimStart.value = Math.round(((layer.style && layer.style.trimStart) || 0) * 100);
      propTrimEnd.value = Math.round((layer.style && layer.style.trimEnd !== undefined ? layer.style.trimEnd : 1) * 100);
    } else {
      propSectionShape.style.display = 'none';
    }

    // Progress Properties
    const isProg = layer.type === 'progress' || (layer.content && (layer.content.shape === 'progressBar' || layer.content.shape === 'progressRing'));
    if (isProg) {
      propSectionProgress.style.display = 'block';
      propProgressValue.value = Math.round(((layer.content && layer.content.value !== undefined) ? layer.content.value : 0.75) * 100);
      propProgressThickness.value = (layer.style && layer.style.thickness) || 12;
      propProgressTrackPicker.value = (layer.style && layer.style.trackColor) || '#232738';
      propProgressTrackText.value = (layer.style && layer.style.trackColor) || '#232738';
    } else {
      propSectionProgress.style.display = 'none';
    }

    // Chart Properties
    if (layer.type === 'chart') {
      propSectionChart.style.display = 'block';
      propChartType.value = (layer.content && layer.content.chartType) || 'bar';
      if (layer.content && Array.isArray(layer.content.data)) {
        propChartDataRaw.value = layer.content.data.map(d => `${d.label}:${d.value}`).join(', ');
      } else {
        propChartDataRaw.value = '';
      }
    } else {
      propSectionChart.style.display = 'none';
    }

    // Image Properties
    if (layer.type === 'image') {
      propSectionImage.style.display = 'block';
      propImageMask.value = (layer.content && layer.content.mask) || 'none';
      propImageKenBurns.checked = !!(layer.content && layer.content.kenBurns);
    } else {
      propSectionImage.style.display = 'none';
    }

    // Presets
    presetInName.value = (layer.presets && layer.presets.in && layer.presets.in.name) || 'none';
    presetInDur.value = (layer.presets && layer.presets.in && layer.presets.in.dur) || 0.6;
    presetLoopName.value = (layer.presets && layer.presets.loop && layer.presets.loop.name) || 'none';
    if (presetInSFX) presetInSFX.value = (layer.presets && layer.presets.in && layer.presets.in.sfx) || '';
  }

  function initPropertyInputs() {
    function applyPropChange(fn) {
      const layer = getSelectedLayer();
      if (!layer) return;
      pushUndo();
      fn(layer);
      renderCanvasFrame();
      renderTimelineTracks();
    }

    // Number inputs
    propX.addEventListener('input', () => applyPropChange(l => l.transform.x = parseFloat(propX.value) || 0));
    propY.addEventListener('input', () => applyPropChange(l => l.transform.y = parseFloat(propY.value) || 0));
    propW.addEventListener('input', () => applyPropChange(l => l.transform.w = Math.max(10, parseFloat(propW.value) || 10)));
    propH.addEventListener('input', () => applyPropChange(l => l.transform.h = Math.max(10, parseFloat(propH.value) || 10)));
    propRot.addEventListener('input', () => applyPropChange(l => l.transform.rotation = parseFloat(propRot.value) || 0));
    propOpacity.addEventListener('input', () => applyPropChange(l => l.transform.opacity = (parseFloat(propOpacity.value) || 0) / 100));

    // Parent Layer selector
    propParentId.addEventListener('change', () => applyPropChange(l => {
      l.parentId = propParentId.value || undefined;
    }));

    // Style inputs
    propFillPicker.addEventListener('input', () => {
      propFillText.value = propFillPicker.value;
      applyPropChange(l => { if (!l.style) l.style = {}; l.style.fill = propFillPicker.value; });
    });
    propFillText.addEventListener('change', () => {
      applyPropChange(l => { if (!l.style) l.style = {}; l.style.fill = propFillText.value; });
    });

    propStrokePicker.addEventListener('input', () => {
      applyPropChange(l => { if (!l.style) l.style = {}; l.style.stroke = propStrokePicker.value; });
    });
    propStrokeWidth.addEventListener('input', () => {
      applyPropChange(l => { if (!l.style) l.style = {}; l.style.strokeWidth = parseFloat(propStrokeWidth.value) || 0; });
    });
    propRadius.addEventListener('input', () => {
      applyPropChange(l => { if (!l.style) l.style = {}; l.style.radius = parseFloat(propRadius.value) || 0; });
    });

    // Brand Palette Swatches
    document.querySelectorAll('.brand-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        const col = sw.dataset.color;
        propFillPicker.value = col;
        propFillText.value = col;
        applyPropChange(l => { if (!l.style) l.style = {}; l.style.fill = col; });
      });
    });

    // Eyedropper API
    const btnEyedropper = document.getElementById('btnEyedropper');
    if (window.EyeDropper) {
      btnEyedropper.addEventListener('click', async () => {
        try {
          const eye = new EyeDropper();
          const res = await eye.open();
          propFillPicker.value = res.sRGBHex;
          propFillText.value = res.sRGBHex;
          applyPropChange(l => { if (!l.style) l.style = {}; l.style.fill = res.sRGBHex; });
        } catch (e) {
          console.warn('Eyedropper cancelled:', e);
        }
      });
    } else {
      btnEyedropper.style.display = 'none';
    }

    // Text inputs & effects
    propTextContent.addEventListener('input', () => applyPropChange(l => { if (!l.content) l.content = {}; l.content.text = propTextContent.value; }));
    propFontFamily.addEventListener('change', () => applyPropChange(l => { if (!l.style) l.style = {}; l.style.font = propFontFamily.value; }));
    propFontSize.addEventListener('input', () => applyPropChange(l => { if (!l.style) l.style = {}; l.style.fontSize = parseFloat(propFontSize.value) || 32; }));
    propTextAlign.addEventListener('change', () => applyPropChange(l => { if (!l.style) l.style = {}; l.style.align = propTextAlign.value; }));

    // Text Effect: Gradient
    propTextGradToggle.addEventListener('change', () => {
      const active = propTextGradToggle.checked;
      propTextGradControls.style.display = active ? 'flex' : 'none';
      applyPropChange(l => {
        if (!l.style) l.style = {};
        if (active) {
          l.style.gradient = {
            type: 'linear',
            colors: [propTextGradColor1.value, propTextGradColor2.value],
            angle: parseFloat(propTextGradAngle.value) || 45
          };
        } else {
          delete l.style.gradient;
        }
      });
    });
    propTextGradColor1.addEventListener('input', () => applyPropChange(l => {
      if (l.style && l.style.gradient) l.style.gradient.colors[0] = propTextGradColor1.value;
    }));
    propTextGradColor2.addEventListener('input', () => applyPropChange(l => {
      if (l.style && l.style.gradient) l.style.gradient.colors[1] = propTextGradColor2.value;
    }));
    propTextGradAngle.addEventListener('input', () => applyPropChange(l => {
      if (l.style && l.style.gradient) l.style.gradient.angle = parseFloat(propTextGradAngle.value) || 0;
    }));

    // Text Effect: Glow
    propTextGlowToggle.addEventListener('change', () => {
      const active = propTextGlowToggle.checked;
      propTextGlowControls.style.display = active ? 'flex' : 'none';
      applyPropChange(l => {
        if (!l.style) l.style = {};
        if (active) {
          l.style.glow = { color: propTextGlowColor.value, blur: parseFloat(propTextGlowBlur.value) || 20 };
        } else {
          delete l.style.glow;
        }
      });
    });
    propTextGlowColor.addEventListener('input', () => applyPropChange(l => {
      if (l.style && l.style.glow) l.style.glow.color = propTextGlowColor.value;
    }));
    propTextGlowBlur.addEventListener('input', () => applyPropChange(l => {
      if (l.style && l.style.glow) l.style.glow.blur = parseFloat(propTextGlowBlur.value) || 10;
    }));

    // Text Effect: Background Box
    propTextBgBoxToggle.addEventListener('change', () => {
      const active = propTextBgBoxToggle.checked;
      propTextBgBoxControls.style.display = active ? 'flex' : 'none';
      applyPropChange(l => {
        if (!l.style) l.style = {};
        if (active) {
          l.style.backgroundBox = {
            fill: propTextBgBoxColor.value,
            padding: parseFloat(propTextBgBoxPadding.value) || 12,
            radius: parseFloat(propTextBgBoxRadius.value) || 8
          };
        } else {
          delete l.style.backgroundBox;
        }
      });
    });
    propTextBgBoxColor.addEventListener('input', () => applyPropChange(l => {
      if (l.style && l.style.backgroundBox) l.style.backgroundBox.fill = propTextBgBoxColor.value;
    }));
    propTextBgBoxPadding.addEventListener('input', () => applyPropChange(l => {
      if (l.style && l.style.backgroundBox) l.style.backgroundBox.padding = parseFloat(propTextBgBoxPadding.value) || 0;
    }));
    propTextBgBoxRadius.addEventListener('input', () => applyPropChange(l => {
      if (l.style && l.style.backgroundBox) l.style.backgroundBox.radius = parseFloat(propTextBgBoxRadius.value) || 0;
    }));

    // Text Effect: Per-Line Background
    propTextPerLineBgToggle.addEventListener('change', () => {
      const active = propTextPerLineBgToggle.checked;
      propTextPerLineBgControls.style.display = active ? 'flex' : 'none';
      applyPropChange(l => {
        if (!l.style) l.style = {};
        if (active) {
          l.style.perLineBackground = {
            fill: propTextPerLineBgColor.value,
            padding: parseFloat(propTextPerLineBgPadding.value) || 8,
            radius: parseFloat(propTextPerLineBgRadius.value) || 6
          };
        } else {
          delete l.style.perLineBackground;
        }
      });
    });
    propTextPerLineBgColor.addEventListener('input', () => applyPropChange(l => {
      if (l.style && l.style.perLineBackground) l.style.perLineBackground.fill = propTextPerLineBgColor.value;
    }));
    propTextPerLineBgPadding.addEventListener('input', () => applyPropChange(l => {
      if (l.style && l.style.perLineBackground) l.style.perLineBackground.padding = parseFloat(propTextPerLineBgPadding.value) || 0;
    }));
    propTextPerLineBgRadius.addEventListener('input', () => applyPropChange(l => {
      if (l.style && l.style.perLineBackground) l.style.perLineBackground.radius = parseFloat(propTextPerLineBgRadius.value) || 0;
    }));

    // Counter inputs
    propCounterStart.addEventListener('input', () => applyPropChange(l => { if (!l.content) l.content = {}; l.content.startVal = parseFloat(propCounterStart.value) || 0; }));
    propCounterEnd.addEventListener('input', () => applyPropChange(l => { if (!l.content) l.content = {}; l.content.endVal = parseFloat(propCounterEnd.value) || 0; }));
    propCounterPrefix.addEventListener('input', () => applyPropChange(l => { if (!l.content) l.content = {}; l.content.prefix = propCounterPrefix.value; }));
    propCounterSuffix.addEventListener('input', () => applyPropChange(l => { if (!l.content) l.content = {}; l.content.suffix = propCounterSuffix.value; }));

    // Shape inputs
    propShapeType.addEventListener('change', () => applyPropChange(l => {
      if (!l.content) l.content = {};
      l.content.shape = propShapeType.value;
      const isPoly = l.content.shape === 'polygon' || l.content.shape === 'star';
      propShapeSidesGroup.style.display = isPoly ? 'block' : 'none';
    }));
    propShapeSides.addEventListener('input', () => applyPropChange(l => {
      if (!l.content) l.content = {};
      l.content.sides = parseInt(propShapeSides.value) || 5;
    }));
    propTrimStart.addEventListener('input', () => applyPropChange(l => {
      if (!l.style) l.style = {};
      l.style.trimStart = (parseFloat(propTrimStart.value) || 0) / 100;
    }));
    propTrimEnd.addEventListener('input', () => applyPropChange(l => {
      if (!l.style) l.style = {};
      l.style.trimEnd = (parseFloat(propTrimEnd.value) || 100) / 100;
    }));

    // Progress inputs
    propProgressValue.addEventListener('input', () => applyPropChange(l => {
      if (!l.content) l.content = {};
      l.content.value = (parseFloat(propProgressValue.value) || 0) / 100;
    }));
    propProgressThickness.addEventListener('input', () => applyPropChange(l => {
      if (!l.style) l.style = {};
      l.style.thickness = parseFloat(propProgressThickness.value) || 12;
    }));
    propProgressTrackPicker.addEventListener('input', () => {
      propProgressTrackText.value = propProgressTrackPicker.value;
      applyPropChange(l => { if (!l.style) l.style = {}; l.style.trackColor = propProgressTrackPicker.value; });
    });
    propProgressTrackText.addEventListener('change', () => {
      applyPropChange(l => { if (!l.style) l.style = {}; l.style.trackColor = propProgressTrackText.value; });
    });

    // Chart inputs
    propChartType.addEventListener('change', () => applyPropChange(l => {
      if (!l.content) l.content = {};
      l.content.chartType = propChartType.value;
    }));
    propChartDataRaw.addEventListener('change', () => applyPropChange(l => {
      if (!l.content) l.content = {};
      const pairs = propChartDataRaw.value.split(',').map(p => p.trim()).filter(Boolean);
      const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
      l.content.data = pairs.map((pair, idx) => {
        const [label, valStr] = pair.split(':');
        return {
          label: (label || `بند ${idx + 1}`).trim(),
          value: parseFloat(valStr) || 10,
          color: colors[idx % colors.length]
        };
      });
    }));

    // Image inputs
    btnChangeImageFile.addEventListener('click', () => {
      imageFileInput.dataset.mode = 'replace';
      imageFileInput.click();
    });
    propImageMask.addEventListener('change', () => applyPropChange(l => {
      if (!l.content) l.content = {};
      l.content.mask = propImageMask.value;
    }));
    propImageKenBurns.addEventListener('change', () => applyPropChange(l => {
      if (!l.content) l.content = {};
      l.content.kenBurns = propImageKenBurns.checked;
    }));
    btnRemoveImageBg.addEventListener('click', () => {
      const layer = getSelectedLayer();
      if (layer && layer.type === 'image') removeImageBackground(layer);
    });

    // Presets
    presetInName.addEventListener('change', () => applyPropChange(l => {
      if (!l.presets) l.presets = {};
      if (presetInName.value === 'none') delete l.presets.in;
      else {
        if (!l.presets.in) l.presets.in = {};
        l.presets.in.name = presetInName.value;
        l.presets.in.dur = parseFloat(presetInDur.value) || 0.6;
        if (presetInSFX && presetInSFX.value) l.presets.in.sfx = presetInSFX.value;
      }
    }));
    presetInDur.addEventListener('input', () => applyPropChange(l => {
      if (l.presets && l.presets.in) l.presets.in.dur = parseFloat(presetInDur.value) || 0.6;
    }));
    if (presetInSFX) {
      presetInSFX.addEventListener('change', () => applyPropChange(l => {
        if (!l.presets) l.presets = {};
        if (!l.presets.in) l.presets.in = { name: presetInName.value !== 'none' ? presetInName.value : 'pop', dur: parseFloat(presetInDur.value) || 0.6 };
        if (presetInSFX.value) l.presets.in.sfx = presetInSFX.value;
        else delete l.presets.in.sfx;
      }));
    }
    if (btnPreviewSFX) {
      btnPreviewSFX.addEventListener('click', () => {
        const sfx = presetInSFX ? presetInSFX.value : '';
        if (sfx && window.MotionAudio) {
          MotionAudio.playSFX(sfx, 0.9);
        } else {
          showToast('يرجى اختيار مؤثر صوتي أولاً للمعاينة', 'info');
        }
      });
    }
    presetLoopName.addEventListener('change', () => applyPropChange(l => {
      if (!l.presets) l.presets = {};
      if (presetLoopName.value === 'none') delete l.presets.loop;
      else l.presets.loop = { name: presetLoopName.value };
    }));
  }

  // -----------------------------------------------------------------
  // 14. PLAYBACK ENGINE (RAF LOOP)
  // -----------------------------------------------------------------
  function play() {
    if (STATE.currentTime >= STATE.scene.duration) {
      STATE.currentTime = 0;
      STATE.triggeredSFXTimes.clear();
    }
    STATE.isPlaying = true;
    playPauseIcon.className = 'fa-solid fa-pause';
    playPauseText.textContent = 'إيقاف مؤقت';
    playBgMusic();
    STATE.lastFrameTime = performance.now();
    STATE.animFrameId = requestAnimationFrame(playbackTick);
  }

  function pause() {
    STATE.isPlaying = false;
    playPauseIcon.className = 'fa-solid fa-play';
    playPauseText.textContent = 'تشغيل';
    pauseBgMusic();
    if (STATE.animFrameId) {
      cancelAnimationFrame(STATE.animFrameId);
      STATE.animFrameId = null;
    }
  }

  function togglePlayPause() {
    if (STATE.isPlaying) pause();
    else play();
  }

  function playbackTick(timestamp) {
    if (!STATE.isPlaying) return;
    const deltaSec = (timestamp - STATE.lastFrameTime) / 1000 * STATE.playbackSpeed;
    const prevTime = STATE.currentTime;
    STATE.lastFrameTime = timestamp;

    STATE.currentTime += deltaSec;
    if (STATE.currentTime >= STATE.scene.duration) {
      STATE.currentTime = STATE.scene.duration;
      pause();
    }

    // Check layer entrance audio SFX & ducking triggers
    checkAudioTriggers(prevTime, STATE.currentTime);

    renderCanvasFrame();
    updatePlayheadPosition();

    if (STATE.isPlaying) {
      STATE.animFrameId = requestAnimationFrame(playbackTick);
    }
  }

  // -----------------------------------------------------------------
  // 15. KEYFRAME MANAGEMENT & EASING POPUP
  // -----------------------------------------------------------------
  function addKeyframeAtPlayhead() {
    const layer = getSelectedLayer();
    if (!layer) {
      showToast('يرجى تحديد طبقة لإضافة مفتاح حركة لها', 'warning');
      return;
    }

    pushUndo();
    if (!layer.keyframes) layer.keyframes = {};

    const relTime = Math.max(0, Math.min(layer.duration, STATE.currentTime - layer.start));
    if (!layer.keyframes['transform.y']) {
      layer.keyframes['transform.y'] = [
        { t: 0, v: layer.transform.y, ease: 'easeOutCubic' },
        { t: layer.duration, v: layer.transform.y, ease: 'easeOutCubic' }
      ];
    } else {
      layer.keyframes['transform.y'].push({
        t: Math.round(relTime * 100) / 100,
        v: layer.transform.y,
        ease: 'easeOutCubic'
      });
      layer.keyframes['transform.y'].sort((a, b) => a.t - b.t);
    }

    renderTimelineTracks();
    showToast('تمت إضافة مفتاح حركة (Keyframe)', 'success');
  }

  function promptKeyframeEasing(layer, propPath, idx) {
    const kf = layer.keyframes[propPath][idx];
    const currentEase = kf.ease || 'linear';
    const options = ['linear', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic', 'easeOutBack', 'easeOutBounce', 'easeOutElastic'];
    const chosen = prompt(`اختر منحنى السرعة (Easing) لمفتاح الحركة:\n(${options.join(', ')})`, currentEase);
    if (chosen && options.includes(chosen.trim())) {
      pushUndo();
      kf.ease = chosen.trim();
      renderAll();
      showToast(`تم تعيين منحنى السرعة: ${kf.ease}`, 'success');
    }
  }

  // -----------------------------------------------------------------
  // 16. LAYER OPERATIONS (DUPLICATE, DELETE, ALIGNMENT)
  // -----------------------------------------------------------------
  function duplicateSelectedLayer() {
    const layer = getSelectedLayer();
    if (!layer) return;

    pushUndo();
    const clone = JSON.parse(JSON.stringify(layer));
    clone.id = 'layer_' + Date.now().toString(36);
    clone.name = layer.name + ' (نسخة)';
    clone.transform.x += 30;
    clone.transform.y += 30;

    STATE.scene.layers.push(clone);
    STATE.selectedLayerIds = [clone.id];
    renderAll();
    showToast('تم تكرار الطبقة بنجاح', 'success');
  }

  function deleteSelectedLayer() {
    const layer = getSelectedLayer();
    if (!layer) return;

    pushUndo();
    STATE.scene.layers = STATE.scene.layers.filter(l => l.id !== layer.id);
    STATE.selectedLayerIds = [];
    renderAll();
    showToast('تم حذف الطبقة', 'info');
  }

  function alignSelectedLayer(type) {
    const layer = getSelectedLayer();
    if (!layer) return;

    pushUndo();
    const sw = STATE.scene.width;
    const sh = STATE.scene.height;
    const lw = layer.transform.w;
    const lh = layer.transform.h;

    switch (type) {
      case 'left': layer.transform.x = lw / 2; break;
      case 'centerH': layer.transform.x = sw / 2; break;
      case 'right': layer.transform.x = sw - lw / 2; break;
      case 'top': layer.transform.y = lh / 2; break;
      case 'centerV': layer.transform.y = sh / 2; break;
      case 'bottom': layer.transform.y = sh - lh / 2; break;
    }

    renderAll();
  }

  // -----------------------------------------------------------------
  // 16. IMAGE HANDLING & PHOTO LAB INTEGRATION
  // -----------------------------------------------------------------
  function handleImageUpload(file, isReplacing = false) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('يرجى اختيار ملف صورة صالح', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Compress & scale to max 1920x1080 to keep lightweight (<2MB)
        const maxW = 1920;
        const maxH = 1080;
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const offCanvas = document.createElement('canvas');
        offCanvas.width = w;
        offCanvas.height = h;
        const ctx = offCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = offCanvas.toDataURL('image/jpeg', 0.85);

        pushUndo();
        if (isReplacing) {
          const sel = getSelectedLayer();
          if (sel) {
            if (!sel.content) sel.content = {};
            sel.content.src = dataUrl;
            sel.transform.w = Math.min(w, STATE.scene.width * 0.8);
            sel.transform.h = Math.round(sel.transform.w * (h / w));
            renderAll();
            showToast('تم تحديث الصورة', 'success');
          }
        } else {
          const newId = 'img_' + Date.now().toString(36);
          const layerW = Math.min(w, STATE.scene.width * 0.5);
          const layerH = Math.round(layerW * (h / w));
          const newLayer = {
            id: newId,
            type: 'image',
            name: file.name.replace(/\.[^/.]+$/, '').slice(0, 20) || 'صورة',
            start: STATE.currentTime,
            duration: Math.max(2.0, STATE.scene.duration - STATE.currentTime),
            transform: {
              x: STATE.scene.width / 2,
              y: STATE.scene.height / 2,
              w: layerW,
              h: layerH,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              anchorX: 0.5,
              anchorY: 0.5,
              opacity: 1
            },
            style: { radius: 12 },
            content: { src: dataUrl, mask: 'none', kenBurns: false },
            presets: { in: { name: 'pop', dur: 0.6 } }
          };
          STATE.scene.layers.push(newLayer);
          STATE.selectedLayerIds = [newId];
          renderAll();
          showToast(`تمت إضافة الصورة: ${newLayer.name}`, 'success');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function removeImageBackground(layer) {
    if (!layer || layer.type !== 'image' || !layer.content || !layer.content.src) return;
    showToast('جاري إزالة الخلفية...', 'info');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = img.width;
      offCanvas.height = img.height;
      const ctx = offCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height);
      const data = imgData.data;

      // Sample top-left corner color
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];
      const threshold = 38;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
        if (dist < threshold) {
          data[i + 3] = 0; // Transparent
        }
      }

      ctx.putImageData(imgData, 0, 0);
      pushUndo();
      layer.content.src = offCanvas.toDataURL('image/png');
      renderAll();
      showToast('تمت إزالة الخلفية بنجاح', 'success');
    };
    img.src = layer.content.src;
  }

  // -----------------------------------------------------------------
  // 17. GROUPING & STAGGER TOOL
  // -----------------------------------------------------------------
  function groupSelectedLayers() {
    if (STATE.selectedLayerIds.length < 2) {
      showToast('يرجى تحديد أكثر من طبقة لتجميعها', 'warning');
      return;
    }
    pushUndo();
    const parentId = STATE.selectedLayerIds[0];
    const isAlreadyGrouped = STATE.selectedLayerIds.slice(1).every(id => {
      const l = STATE.scene.layers.find(x => x.id === id);
      return l && l.parentId === parentId;
    });

    if (isAlreadyGrouped) {
      STATE.selectedLayerIds.forEach(id => {
        const l = STATE.scene.layers.find(x => x.id === id);
        if (l && l.parentId === parentId) delete l.parentId;
      });
      showToast('تم فك التجميع', 'info');
    } else {
      STATE.selectedLayerIds.slice(1).forEach(id => {
        const l = STATE.scene.layers.find(x => x.id === id);
        if (l) l.parentId = parentId;
      });
      showToast('تم تجميع الطبقات', 'success');
    }
    renderAll();
  }

  function staggerSelectedLayers(offsetSec) {
    let targetLayers = [];
    if (STATE.selectedLayerIds.length > 1) {
      targetLayers = STATE.scene.layers.filter(l => STATE.selectedLayerIds.includes(l.id));
    } else {
      targetLayers = STATE.scene.layers;
    }

    if (targetLayers.length < 2) {
      showToast('يجب توفر طبقتين على الأقل لإجراء التوزيع الزمني', 'warning');
      return;
    }

    pushUndo();
    if (window.MotionEngine && MotionEngine.staggerLayers) {
      MotionEngine.staggerLayers(targetLayers, offsetSec);
    } else {
      targetLayers.forEach((layer, idx) => {
        layer.start = idx * offsetSec;
      });
    }

    modalStagger.classList.remove('active');
    renderAll();
    showToast(`تم توزيع ${targetLayers.length} طبقات بفاصل ${offsetSec} ثوانٍ`, 'success');
  }

  // -----------------------------------------------------------------
  // 18. MULTI-SCENE TIMELINE & TRANSITIONS
  // -----------------------------------------------------------------
  function renderSceneTabs() {
    if (!sceneTabsList) return;
    sceneTabsList.innerHTML = '';
    STATE.project.scenes.forEach((sc, idx) => {
      const tab = document.createElement('div');
      tab.className = 'scene-tab' + (idx === STATE.activeSceneIndex ? ' active' : '');
      tab.textContent = sc.name || `مشهد ${idx + 1}`;
      tab.title = `انقر للانتقال لمشهد: ${sc.name}`;
      tab.addEventListener('click', () => switchScene(idx));

      if (STATE.project.scenes.length > 1) {
        const delBtn = document.createElement('i');
        delBtn.className = 'fa-solid fa-xmark mr-1';
        delBtn.style.fontSize = '10px';
        delBtn.style.opacity = '0.6';
        delBtn.style.cursor = 'pointer';
        delBtn.title = 'حذف المشهد';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteScene(idx);
        });
        tab.appendChild(delBtn);
      }

      sceneTabsList.appendChild(tab);
    });

    if (sceneTransitionSelector) {
      const currentTrans = STATE.project.transitions.find(t => t.fromSceneId === STATE.scene.id);
      if (currentTrans) {
        sceneTransitionSelector.value = currentTrans.type || 'fade';
        if (sceneTransitionDur) sceneTransitionDur.value = currentTrans.duration || 0.5;
      }
    }
  }

  function switchScene(index) {
    if (index < 0 || index >= STATE.project.scenes.length) return;
    if (STATE.isPlaying || STATE.isPlayingAllScenes) pause();
    STATE.activeSceneIndex = index;
    STATE.scene = STATE.project.scenes[index];
    STATE.currentTime = 0;
    STATE.selectedLayerIds = STATE.scene.layers.length ? [STATE.scene.layers[0].id] : [];
    projectTitleInput.value = STATE.scene.name || 'مشهد';
    renderAll();
    renderSceneTabs();
  }

  function addNewScene() {
    pushUndo();
    const newSceneId = 'sc_' + Date.now().toString(36);
    const newSceneNum = STATE.project.scenes.length + 1;
    const newScene = {
      version: 2,
      id: newSceneId,
      name: `مشهد ${newSceneNum}`,
      width: STATE.scene.width,
      height: STATE.scene.height,
      fps: STATE.scene.fps,
      duration: 5.0,
      background: { type: 'color', color: '#0d0f18' },
      layers: [
        {
          id: 'text_' + Date.now().toString(36),
          type: 'text',
          name: 'عنوان المشهد',
          start: 0.2,
          duration: 4.8,
          transform: { x: STATE.scene.width / 2, y: STATE.scene.height / 2, w: 900, h: 120, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
          style: { fill: '#ffffff', font: 'Cairo', fontSize: 68, fontWeight: '800', align: 'center', direction: 'rtl' },
          content: { text: `المشهد رقم ${newSceneNum}` },
          presets: { in: { name: 'slideUp', dur: 0.6 } }
        }
      ]
    };

    const prevScene = STATE.project.scenes[STATE.project.scenes.length - 1];
    STATE.project.transitions.push({
      fromSceneId: prevScene.id,
      toSceneId: newScene.id,
      type: sceneTransitionSelector ? sceneTransitionSelector.value : 'fade',
      duration: sceneTransitionDur ? (parseFloat(sceneTransitionDur.value) || 0.5) : 0.5
    });

    STATE.project.scenes.push(newScene);
    switchScene(STATE.project.scenes.length - 1);
    scheduleAutoSave();
    showToast(`تمت إضافة مشهد جديد: ${newScene.name}`, 'success');
  }

  function deleteScene(index) {
    if (STATE.project.scenes.length <= 1) {
      showToast('لا يمكن حذف المشهد الوحيد في المشروع', 'warning');
      return;
    }
    if (!confirm('هل تريد بالتأكيد حذف هذا المشهد؟')) return;
    pushUndo();
    const deletedId = STATE.project.scenes[index].id;
    STATE.project.scenes.splice(index, 1);
    STATE.project.transitions = STATE.project.transitions.filter(t => t.fromSceneId !== deletedId && t.toSceneId !== deletedId);

    if (STATE.activeSceneIndex >= STATE.project.scenes.length) {
      STATE.activeSceneIndex = STATE.project.scenes.length - 1;
    }
    STATE.scene = STATE.project.scenes[STATE.activeSceneIndex];
    STATE.currentTime = 0;
    renderAll();
    renderSceneTabs();
    scheduleAutoSave();
    showToast('تم حذف المشهد', 'info');
  }

  function togglePlayAllScenes() {
    if (STATE.isPlayingAllScenes) {
      pauseAllScenes();
    } else {
      playAllScenes();
    }
  }

  function playAllScenes() {
    pause();
    STATE.isPlayingAllScenes = true;
    STATE.projectCurrentTime = 0;
    btnPlayAllScenes.innerHTML = '<i class="fa-solid fa-pause"></i><span>إيقاف الكل</span>';
    STATE.lastFrameTime = performance.now();
    STATE.animFrameId = requestAnimationFrame(playAllScenesTick);
  }

  function pauseAllScenes() {
    STATE.isPlayingAllScenes = false;
    btnPlayAllScenes.innerHTML = '<i class="fa-solid fa-clapperboard"></i><span>تشغيل الكل</span>';
    if (STATE.animFrameId) {
      cancelAnimationFrame(STATE.animFrameId);
      STATE.animFrameId = null;
    }
    renderCanvasFrame();
  }

  function playAllScenesTick(timestamp) {
    if (!STATE.isPlayingAllScenes) return;
    const deltaSec = (timestamp - STATE.lastFrameTime) / 1000 * STATE.playbackSpeed;
    STATE.lastFrameTime = timestamp;

    STATE.projectCurrentTime += deltaSec;

    let totalDur = 0;
    STATE.project.scenes.forEach(s => totalDur += (s.duration || 5));
    STATE.project.transitions.forEach(t => totalDur -= (t.duration || 0));

    if (STATE.projectCurrentTime >= totalDur) {
      STATE.projectCurrentTime = totalDur;
      pauseAllScenes();
      return;
    }

    if (window.MotionEngine && MotionEngine.renderProjectFrame) {
      MotionEngine.renderProjectFrame(STATE.project, STATE.projectCurrentTime, mainCanvas);
    }

    const min = Math.floor(STATE.projectCurrentTime / 60).toString().padStart(2, '0');
    const sec = (STATE.projectCurrentTime % 60).toFixed(2).padStart(5, '0');
    timecodeDisplay.textContent = `[كل المشاهد] ${min}:${sec} / ${(totalDur % 60).toFixed(2)}`;

    if (STATE.isPlayingAllScenes) {
      STATE.animFrameId = requestAnimationFrame(playAllScenesTick);
    }
  }

  // -----------------------------------------------------------------
  // 19. PRESETS LIBRARY & HOVER PREVIEWS
  // -----------------------------------------------------------------
  const BUNDLED_PRESETS = [
    { id: "fade_in", name: "تلاشي للداخل (Fade In)", category: "in", defaultDur: 0.5, description: "ظهور ناعم بتزايد الشفافية من 0% إلى 100%", icon: "fa-solid fa-cloud-arrow-up" },
    { id: "slide_up", name: "انزلاق للأعلى (Slide Up)", category: "in", defaultDur: 0.6, description: "حركة صعود عمودية ناعمة مع ظهور الشفافية", icon: "fa-solid fa-arrow-up" },
    { id: "slide_down", name: "انزلاق للأسفل (Slide Down)", category: "in", defaultDur: 0.6, description: "هبوط انسيابي من الأعلى إلى موضع العنصر", icon: "fa-solid fa-arrow-down" },
    { id: "slide_left", name: "انزلاق لليسار (Slide Left)", category: "in", defaultDur: 0.6, description: "دخول أفقي من اليمين باتجاه اليسار", icon: "fa-solid fa-arrow-left" },
    { id: "slide_right", name: "انزلاق لليمين (Slide Right)", category: "in", defaultDur: 0.6, description: "دخول أفقي من اليسار باتجاه اليمين", icon: "fa-solid fa-arrow-right" },
    { id: "pop_in", name: "تكبير نطّاط (Scale Pop)", category: "in", defaultDur: 0.7, description: "تكبير ديناميكي سريع مع ارتداد جذاب في النهاية", icon: "fa-solid fa-expand" },
    { id: "rotate_in", name: "دوران ودخول (Rotate In)", category: "in", defaultDur: 0.7, description: "دخول العنصر مع دوران سلس من زاوية جانبية", icon: "fa-solid fa-rotate-right" },
    { id: "blur_in", name: "تمويه للداخل (Blur In)", category: "in", defaultDur: 0.6, description: "ظهور سينمائي يبدأ من تمويه ضبابي حتى اكتمال الحدة", icon: "fa-solid fa-water" },
    { id: "wipe_reveal", name: "مسح وقناع (Wipe Reveal)", category: "in", defaultDur: 0.7, description: "كشف تدريجي للعنصر بواسطة قناع خطي من اليمين لليسار", icon: "fa-solid fa-bars-progress" },
    { id: "bounce", name: "ارتداد فيزيائي (Bounce)", category: "in", defaultDur: 0.9, description: "هبوط حركي مع كرات ارتداد متعددة تحاكي الجاذبية", icon: "fa-solid fa-basketball" },
    { id: "elastic", name: "مطاطي نابض (Elastic)", category: "in", defaultDur: 1.0, description: "حركة اهتزازية نابضة تشبه السبرينغ المطاطي", icon: "fa-solid fa-arrows-split-up-and-left" },
    { id: "typewriter", name: "آلة كاتبة (Typewriter)", category: "in", defaultDur: 2.0, description: "ظهور النص حرفاً بحرف مع الحفاظ التام على تشبيك الحروف العربية", icon: "fa-solid fa-keyboard" },
    { id: "word_by_word", name: "كلمة بكلمة (Word by Word)", category: "in", defaultDur: 1.8, description: "ظهور النص بالتتابع كلمة تلو الأخرى", icon: "fa-solid fa-font" },
    { id: "line_by_line", name: "سطر بسطر (Line by Line)", category: "in", defaultDur: 2.0, description: "كشف الأسطر النصية بالتتابع من الأعلى للأسفل", icon: "fa-solid fa-align-right" },
    { id: "character_cascade", name: "شلال الحروف (Cascade)", category: "in", defaultDur: 1.5, description: "تساقط الحروف واحداً تلو الآخر في حركة مصفوفة انسيابية", icon: "fa-solid fa-water" },
    { id: "highlight_sweep", name: "مسح تمييز ضوئي (Highlight)", category: "in", defaultDur: 0.8, description: "مرور شريط إضاءة تمييزية فوق الكلمات", icon: "fa-solid fa-highlighter" },
    { id: "underline_draw", name: "رسم خط سفلي (Underline)", category: "in", defaultDur: 0.7, description: "رسم خط زخرفي تحت النص بنعومة", icon: "fa-solid fa-underline" },
    { id: "counter_rollup", name: "تدحرج الأرقام (Counter Roll)", category: "in", defaultDur: 2.0, description: "دوران الأرقام بسرعة تصاعدية حتى الاستقرار", icon: "fa-solid fa-arrow-up-1-9" },
    { id: "shake", name: "هزة تنبيهية (Shake)", category: "loop", defaultDur: 0.5, description: "رجفة واهتزاز سريع للفت الانتباه", icon: "fa-solid fa-bell" },
    { id: "float_loop", name: "عوم هادئ (Float Loop)", category: "loop", defaultDur: 3.0, description: "حركة تموج عمودية هادئة تحاكي الطفو في الهواء", icon: "fa-solid fa-feather" },
    { id: "pulse_loop", name: "نبض دوري (Pulse Loop)", category: "loop", defaultDur: 2.0, description: "نبضات تكبير وتصغير مستمرة", icon: "fa-solid fa-heart-pulse" },
    { id: "spin_loop", name: "دوران لا نهائي (Spin Loop)", category: "loop", defaultDur: 4.0, description: "دوران دائري مستمر بزاوية 360 درجة", icon: "fa-solid fa-arrows-rotate" }
  ];

  async function loadPresetsLibrary() {
    try {
      const res = await fetch('shared/presets.json');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.presets)) {
          STATE.presetsList = data.presets;
        }
      }
    } catch (e) {
      console.warn('Presets JSON fetch fallback:', e);
    }
    if (!STATE.presetsList || !STATE.presetsList.length) {
      STATE.presetsList = BUNDLED_PRESETS;
    }
    renderPresetsList('all');
  }

  function renderPresetsList(filter = 'all') {
    if (!presetsCardsList) return;
    presetsCardsList.innerHTML = '';

    const list = STATE.presetsList.filter(p => filter === 'all' || p.category === filter);
    list.forEach(preset => {
      const card = document.createElement('div');
      card.className = 'preset-card';

      let animClass = 'anim-pop';
      if (preset.id.includes('slide')) animClass = 'anim-slide-up';
      else if (preset.id.includes('bounce')) animClass = 'anim-bounce';
      else if (preset.id.includes('pulse')) animClass = 'anim-pulse';
      else if (preset.id.includes('spin')) animClass = 'anim-spin';

      const badgeClass = preset.category === 'in' ? 'badge-in' : (preset.category === 'out' ? 'badge-out' : 'badge-loop');
      const badgeText = preset.category === 'in' ? 'دخول' : (preset.category === 'out' ? 'خروج' : 'مستمر');

      card.innerHTML = `
        <div class="preset-header">
          <span class="preset-name"><i class="${preset.icon || 'fa-solid fa-wand-magic'} text-indigo-400"></i> ${preset.name}</span>
          <span class="preset-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="preset-desc">${preset.description}</div>
        <div class="preset-preview-box">
          <div class="preset-preview-target ${animClass}">معاينة الحركة</div>
        </div>
      `;

      card.addEventListener('click', () => {
        applyPresetToSelectedLayer(preset);
      });

      presetsCardsList.appendChild(card);
    });
  }

  function applyPresetToSelectedLayer(preset) {
    const layer = getSelectedLayer();
    if (!layer) {
      showToast('يرجى تحديد طبقة أولاً لتطبيق الحركة عليها', 'warning');
      return;
    }
    pushUndo();
    if (!layer.presets) layer.presets = {};

    if (preset.category === 'in') {
      layer.presets.in = {
        name: preset.id,
        dur: preset.defaultDur || 0.6,
        params: preset.params || {}
      };
    } else if (preset.category === 'out') {
      layer.presets.out = {
        name: preset.id,
        dur: preset.defaultDur || 0.6,
        params: preset.params || {}
      };
    } else {
      layer.presets.loop = {
        name: preset.id,
        period: preset.defaultDur || 2.5,
        params: preset.params || {}
      };
    }

    renderAll();
    showToast(`تم تطبيق حركة "${preset.name}" على الطبقة`, 'success');
  }

  // -----------------------------------------------------------------
  // 20. ADD NEW LAYER DISPATCHER
  // -----------------------------------------------------------------
  function addNewLayer(type) {
    pushUndo();
    const newId = 'l_' + Date.now().toString(36);
    let newLayer = null;

    if (type === 'text') {
      newLayer = {
        id: newId,
        type: 'text',
        name: 'نص عربي',
        start: STATE.currentTime,
        duration: Math.max(2.0, STATE.scene.duration - STATE.currentTime),
        transform: { x: STATE.scene.width / 2, y: STATE.scene.height / 2, w: 600, h: 100, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: '#ffffff', font: 'Cairo', fontSize: 52, align: 'center', direction: 'rtl' },
        content: { text: 'نص قابل للتعديل' },
        presets: { in: { name: 'pop', dur: 0.6 } }
      };
    } else if (type === 'shape-rounded' || type === 'shape-rect') {
      newLayer = {
        id: newId,
        type: 'shape',
        name: 'مستطيل مستدير',
        start: STATE.currentTime,
        duration: Math.max(2.0, STATE.scene.duration - STATE.currentTime),
        transform: { x: STATE.scene.width / 2, y: STATE.scene.height / 2, w: 400, h: 250, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: '#6366f1', radius: 16 },
        content: { shape: 'rounded-rect' },
        presets: { in: { name: 'pop', dur: 0.5 } }
      };
    } else if (type === 'shape-circle') {
      newLayer = {
        id: newId,
        type: 'shape',
        name: 'دائرة',
        start: STATE.currentTime,
        duration: Math.max(2.0, STATE.scene.duration - STATE.currentTime),
        transform: { x: STATE.scene.width / 2, y: STATE.scene.height / 2, w: 260, h: 260, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: '#06b6d4', radius: 130 },
        content: { shape: 'circle' },
        presets: { in: { name: 'pop', dur: 0.5 } }
      };
    } else if (type === 'shape-donut') {
      newLayer = {
        id: newId,
        type: 'shape',
        name: 'حلقة دونات',
        start: STATE.currentTime,
        duration: Math.max(2.0, STATE.scene.duration - STATE.currentTime),
        transform: { x: STATE.scene.width / 2, y: STATE.scene.height / 2, w: 260, h: 260, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: '#06b6d4', stroke: '#10b981', strokeWidth: 4, radius: 130 },
        content: { shape: 'donut', innerRadius: 85 },
        presets: { loop: { name: 'spin', speed: 0.2 } }
      };
    } else if (type === 'shape-arrow') {
      newLayer = {
        id: newId,
        type: 'shape',
        name: 'سهم توجيهي',
        start: STATE.currentTime,
        duration: Math.max(2.0, STATE.scene.duration - STATE.currentTime),
        transform: { x: STATE.scene.width / 2, y: STATE.scene.height / 2, w: 220, h: 100, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: '#f59e0b' },
        content: { shape: 'arrow' },
        presets: { in: { name: 'slideRight', dur: 0.5 } }
      };
    } else if (type === 'shape-star') {
      newLayer = {
        id: newId,
        type: 'shape',
        name: 'نجمة خماسية',
        start: STATE.currentTime,
        duration: Math.max(2.0, STATE.scene.duration - STATE.currentTime),
        transform: { x: STATE.scene.width / 2, y: STATE.scene.height / 2, w: 240, h: 240, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: '#eab308' },
        content: { shape: 'star', sides: 5 },
        presets: { loop: { name: 'pulse', period: 2.0 } }
      };
    } else if (type === 'counter') {
      newLayer = {
        id: newId,
        type: 'counter',
        name: 'عداد أرقام',
        start: STATE.currentTime,
        duration: Math.max(2.0, STATE.scene.duration - STATE.currentTime),
        transform: { x: STATE.scene.width / 2, y: STATE.scene.height / 2, w: 450, h: 100, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: '#10b981', font: 'Inter', fontSize: 72, fontWeight: '800', align: 'center', direction: 'ltr' },
        content: { startVal: 0, endVal: 1000, prefix: '+', decimals: 0, separator: ',' },
        keyframes: {
          'content.value': [
            { t: 0, v: 0, ease: 'easeOutCubic' },
            { t: 2.0, v: 1000, ease: 'easeOutCubic' }
          ]
        }
      };
    } else if (type === 'progressBar') {
      newLayer = {
        id: newId,
        type: 'progress',
        name: 'شريط تقدم',
        start: STATE.currentTime,
        duration: Math.max(2.0, STATE.scene.duration - STATE.currentTime),
        transform: { x: STATE.scene.width / 2, y: STATE.scene.height / 2, w: 500, h: 30, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: '#06b6d4', trackColor: '#232738', radius: 10, thickness: 16 },
        content: { shape: 'progressBar', value: 0.8 },
        keyframes: {
          'content.value': [
            { t: 0, v: 0, ease: 'easeOutCubic' },
            { t: 1.8, v: 0.8, ease: 'easeOutCubic' }
          ]
        }
      };
    } else if (type === 'progressRing') {
      newLayer = {
        id: newId,
        type: 'progress',
        name: 'حلقة تقدم دائرية',
        start: STATE.currentTime,
        duration: Math.max(2.0, STATE.scene.duration - STATE.currentTime),
        transform: { x: STATE.scene.width / 2, y: STATE.scene.height / 2, w: 260, h: 260, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: '#10b981', trackColor: '#1e2436', thickness: 18, radius: 130 },
        content: { shape: 'progressRing', value: 0.75 },
        keyframes: {
          'content.value': [
            { t: 0, v: 0, ease: 'easeOutCubic' },
            { t: 2.0, v: 0.75, ease: 'easeOutCubic' }
          ]
        }
      };
    } else if (type === 'chart-bar' || type === 'chart') {
      newLayer = {
        id: newId,
        type: 'chart',
        name: 'مخطط بياني (أعمدة)',
        start: STATE.currentTime,
        duration: Math.max(2.0, STATE.scene.duration - STATE.currentTime),
        transform: { x: STATE.scene.width / 2, y: STATE.scene.height / 2, w: 600, h: 260, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: '#6366f1', stroke: '#818cf8', strokeWidth: 2, font: 'Readex Pro', fontSize: 16 },
        content: {
          chartType: 'bar',
          data: [
            { label: 'أ', value: 40, color: '#6366f1' },
            { label: 'ب', value: 75, color: '#06b6d4' },
            { label: 'ج', value: 110, color: '#10b981' }
          ]
        },
        keyframes: {
          'style.progress': [
            { t: 0, v: 0, ease: 'easeOutCubic' },
            { t: 1.5, v: 1, ease: 'easeOutCubic' }
          ]
        }
      };
    } else if (type === 'chart-line') {
      newLayer = {
        id: newId,
        type: 'chart',
        name: 'مخطط بياني (خطي)',
        start: STATE.currentTime,
        duration: Math.max(2.0, STATE.scene.duration - STATE.currentTime),
        transform: { x: STATE.scene.width / 2, y: STATE.scene.height / 2, w: 600, h: 260, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { fill: '#ec4899', stroke: '#ec4899', strokeWidth: 3, font: 'Readex Pro', fontSize: 16 },
        content: {
          chartType: 'line',
          data: [
            { label: 'يناير', value: 20, color: '#ec4899' },
            { label: 'فبراير', value: 65, color: '#ec4899' },
            { label: 'مارس', value: 90, color: '#ec4899' }
          ]
        },
        keyframes: {
          'style.progress': [
            { t: 0, v: 0, ease: 'easeOutCubic' },
            { t: 1.5, v: 1, ease: 'easeOutCubic' }
          ]
        }
      };
    } else if (type === 'chart-pie') {
      newLayer = {
        id: newId,
        type: 'chart',
        name: 'مخطط بياني (دائري)',
        start: STATE.currentTime,
        duration: Math.max(2.0, STATE.scene.duration - STATE.currentTime),
        transform: { x: STATE.scene.width / 2, y: STATE.scene.height / 2, w: 320, h: 320, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1 },
        style: { strokeWidth: 2, font: 'Readex Pro', fontSize: 14 },
        content: {
          chartType: 'pie',
          data: [
            { label: 'حصة أ', value: 45, color: '#6366f1' },
            { label: 'حصة ب', value: 35, color: '#06b6d4' },
            { label: 'حصة ج', value: 20, color: '#f59e0b' }
          ]
        },
        keyframes: {
          'style.progress': [
            { t: 0, v: 0, ease: 'easeOutCubic' },
            { t: 1.5, v: 1, ease: 'easeOutCubic' }
          ]
        }
      };
    } else if (type === 'image-upload') {
      imageFileInput.dataset.mode = 'new';
      imageFileInput.click();
      return;
    }

    if (newLayer) {
      STATE.scene.layers.push(newLayer);
      STATE.selectedLayerIds = [newLayer.id];
      renderAll();
      showToast(`تمت إضافة: ${newLayer.name}`, 'success');
    }
  }

  // -----------------------------------------------------------------
  // 17. BRAND KIT CONTROLLER
  // -----------------------------------------------------------------
  async function loadBrandKit(user = STATE.currentUser) {
    try {
      const local = localStorage.getItem('mickey_brand_kit');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && parsed.colors) {
          STATE.brandKit = Object.assign(STATE.brandKit, parsed);
        }
      }
    } catch (e) {
      console.warn('Local brand kit load notice:', e);
    }

    if (user && window.firebase) {
      try {
        const db = firebase.firestore();
        const doc = await db.collection('users').doc(user.uid).collection('vault').doc('brand_kit').get();
        if (doc.exists && doc.data()) {
          const remoteKit = doc.data();
          if (remoteKit && remoteKit.colors) {
            STATE.brandKit = Object.assign(STATE.brandKit, remoteKit);
            localStorage.setItem('mickey_brand_kit', JSON.stringify(STATE.brandKit));
          }
        }
      } catch (e) {
        console.warn('Firestore brand kit load notice:', e);
      }
    }

    syncBrandKitModalUI();
    if (STATE.scene) STATE.scene.brandKit = STATE.brandKit;
  }

  function syncBrandKitModalUI() {
    const bk = STATE.brandKit;
    if (!bk) return;

    if (bk.colors) {
      if (bk.colors.primary && bkColorPrimary) { bkColorPrimary.value = bk.colors.primary; bkColorPrimaryText.value = bk.colors.primary; }
      if (bk.colors.secondary && bkColorSecondary) { bkColorSecondary.value = bk.colors.secondary; bkColorSecondaryText.value = bk.colors.secondary; }
      if (bk.colors.accent && bkColorAccent) { bkColorAccent.value = bk.colors.accent; bkColorAccentText.value = bk.colors.accent; }
      if (bk.colors.dark && bkColorDark) { bkColorDark.value = bk.colors.dark; bkColorDarkText.value = bk.colors.dark; }
      if (bk.colors.light && bkColorLight) { bkColorLight.value = bk.colors.light; bkColorLightText.value = bk.colors.light; }
      if (bk.colors.extra && bkColorExtra) { bkColorExtra.value = bk.colors.extra; bkColorExtraText.value = bk.colors.extra; }
    }

    if (bk.fonts) {
      if (bk.fonts.heading && bkFontHeading) bkFontHeading.value = bk.fonts.heading;
      if (bk.fonts.body && bkFontBody) bkFontBody.value = bk.fonts.body;
    }

    if (bk.watermark && bkWatermarkEnabled) {
      bkWatermarkEnabled.checked = !!bk.watermark.enabled;
      if (bkWatermarkControls) bkWatermarkControls.style.display = bk.watermark.enabled ? 'flex' : 'none';
      if (bk.watermark.type && bkWatermarkType) bkWatermarkType.value = bk.watermark.type;
      if (bk.watermark.position && bkWatermarkPos) bkWatermarkPos.value = bk.watermark.position;
      if (bk.watermark.text && bkWatermarkText) bkWatermarkText.value = bk.watermark.text;
      if (bk.watermark.opacity !== undefined && bkWatermarkOpacity) bkWatermarkOpacity.value = bk.watermark.opacity;
      if (bk.watermark.scale !== undefined && bkWatermarkScale) bkWatermarkScale.value = bk.watermark.scale;

      if (bk.watermark.type === 'image') {
        if (bkWatermarkTextGroup) bkWatermarkTextGroup.style.display = 'none';
        if (bkWatermarkImageGroup) bkWatermarkImageGroup.style.display = 'block';
        if (bkLogoFileName) bkLogoFileName.textContent = bk.watermark.image ? 'تم اختيار الشعار' : 'لم يتم اختيار ملف';
      } else {
        if (bkWatermarkTextGroup) bkWatermarkTextGroup.style.display = 'block';
        if (bkWatermarkImageGroup) bkWatermarkImageGroup.style.display = 'none';
      }
    }
  }

  async function saveBrandKit() {
    STATE.brandKit = {
      colors: {
        primary: bkColorPrimary ? bkColorPrimary.value : '#6366f1',
        secondary: bkColorSecondary ? bkColorSecondary.value : '#06b6d4',
        accent: bkColorAccent ? bkColorAccent.value : '#f59e0b',
        dark: bkColorDark ? bkColorDark.value : '#0d0f18',
        light: bkColorLight ? bkColorLight.value : '#ffffff',
        extra: bkColorExtra ? bkColorExtra.value : '#10b981'
      },
      fonts: {
        heading: bkFontHeading ? bkFontHeading.value : 'Cairo',
        body: bkFontBody ? bkFontBody.value : 'Tajawal'
      },
      watermark: {
        enabled: bkWatermarkEnabled ? bkWatermarkEnabled.checked : false,
        type: bkWatermarkType ? bkWatermarkType.value : 'text',
        text: bkWatermarkText ? bkWatermarkText.value.trim() : '@MickeyStudio',
        image: STATE.brandKit.watermark?.image || '',
        position: bkWatermarkPos ? bkWatermarkPos.value : 'bottom-right',
        opacity: bkWatermarkOpacity ? parseFloat(bkWatermarkOpacity.value) || 0.75 : 0.75,
        scale: bkWatermarkScale ? parseFloat(bkWatermarkScale.value) || 1.0 : 1.0
      }
    };

    localStorage.setItem('mickey_brand_kit', JSON.stringify(STATE.brandKit));

    if (STATE.currentUser && window.firebase) {
      try {
        const db = firebase.firestore();
        await db.collection('users').doc(STATE.currentUser.uid).collection('vault').doc('brand_kit').set(STATE.brandKit, { merge: true });
      } catch (err) {
        console.warn('Firestore save brand kit error:', err);
      }
    }

    if (STATE.scene) {
      STATE.scene.brandKit = STATE.brandKit;
      if (STATE.brandKit.watermark.enabled) {
        STATE.scene.watermark = STATE.brandKit.watermark;
      } else {
        delete STATE.scene.watermark;
      }
    }

    renderCanvasFrame();
    showToast('تم حفظ الهوية البصرية بنجاح', 'success');
  }

  function applyBrandKitToActiveScene() {
    saveBrandKit();
    if (!STATE.scene) return;
    pushUndo();

    if (window.MotionEngine && typeof MotionEngine.applyBrandKitToScene === 'function') {
      MotionEngine.applyBrandKitToScene(STATE.scene, STATE.brandKit);
    }
    if (STATE.brandKit.watermark?.enabled) {
      STATE.scene.watermark = STATE.brandKit.watermark;
    } else {
      delete STATE.scene.watermark;
    }

    renderAll();
    if (modalBrandKit) modalBrandKit.classList.remove('active');
    showToast('تم تطبيق الهوية البصرية وتوحيد ألوان وخطوط المشهد بنجاح', 'success');
  }

  function initBrandKitListeners() {
    if (btnBrandKit) {
      btnBrandKit.addEventListener('click', () => {
        syncBrandKitModalUI();
        if (modalBrandKit) modalBrandKit.classList.add('active');
      });
    }

    if (btnSaveBrandKit) btnSaveBrandKit.addEventListener('click', saveBrandKit);
    if (btnApplyBrandToScene) btnApplyBrandToScene.addEventListener('click', applyBrandKitToActiveScene);

    // Color text input two-way binding
    const bindColorPair = (picker, text) => {
      if (!picker || !text) return;
      picker.addEventListener('input', () => text.value = picker.value);
      text.addEventListener('change', () => picker.value = text.value);
    };
    bindColorPair(bkColorPrimary, bkColorPrimaryText);
    bindColorPair(bkColorSecondary, bkColorSecondaryText);
    bindColorPair(bkColorAccent, bkColorAccentText);
    bindColorPair(bkColorDark, bkColorDarkText);
    bindColorPair(bkColorLight, bkColorLightText);
    bindColorPair(bkColorExtra, bkColorExtraText);

    // Watermark toggle & type
    if (bkWatermarkEnabled) {
      bkWatermarkEnabled.addEventListener('change', () => {
        if (bkWatermarkControls) bkWatermarkControls.style.display = bkWatermarkEnabled.checked ? 'flex' : 'none';
      });
    }

    if (bkWatermarkType) {
      bkWatermarkType.addEventListener('change', () => {
        const isImg = bkWatermarkType.value === 'image';
        if (bkWatermarkTextGroup) bkWatermarkTextGroup.style.display = isImg ? 'none' : 'block';
        if (bkWatermarkImageGroup) bkWatermarkImageGroup.style.display = isImg ? 'block' : 'none';
      });
    }

    // Logo upload for watermark
    if (btnUploadBrandLogo && bkLogoFileInput) {
      btnUploadBrandLogo.addEventListener('click', () => bkLogoFileInput.click());
      bkLogoFileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (!STATE.brandKit.watermark) STATE.brandKit.watermark = {};
          STATE.brandKit.watermark.image = ev.target.result;
          if (bkLogoFileName) bkLogoFileName.textContent = file.name;
          showToast(`تم اختيار شعار الهوية: ${file.name}`, 'info');
        };
        reader.readAsDataURL(file);
      });
    }
  }

  // -----------------------------------------------------------------
  // 17b. TEMPLATES & MY TEMPLATES CONTROLLER (24+ ORIGINAL TEMPLATES)
  // -----------------------------------------------------------------
  async function loadTemplatesIndex() {
    try {
      const res = await fetch('shared/templates/templates-index.json');
      if (res.ok) {
        STATE.templatesIndex = await res.json();
      }
    } catch (e) {
      console.warn('Failed to load templates-index.json:', e);
    }
    await loadMyTemplates();
    renderTemplatesList();
  }

  async function loadMyTemplates(user = STATE.currentUser) {
    try {
      const local = localStorage.getItem('mickey_my_templates');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) STATE.myTemplates = parsed;
      }
    } catch (e) {
      console.warn('My templates local read:', e);
    }

    if (user && window.firebase) {
      try {
        const db = firebase.firestore();
        const snap = await db.collection('users').doc(user.uid).collection('templates').get();
        const remoteList = [];
        snap.forEach(doc => remoteList.push(doc.data()));
        if (remoteList.length) {
          const idMap = new Map();
          STATE.myTemplates.forEach(t => idMap.set(t.id, t));
          remoteList.forEach(t => idMap.set(t.id, t));
          STATE.myTemplates = Array.from(idMap.values());
          localStorage.setItem('mickey_my_templates', JSON.stringify(STATE.myTemplates));
        }
      } catch (e) {
        console.warn('My templates Firestore read:', e);
      }
    }
  }

  async function getTemplateScene(tpl) {
    if (tpl.scene) return tpl.scene;
    if (STATE.templatesCache[tpl.id]) return STATE.templatesCache[tpl.id];
    if (tpl.file) {
      try {
        const res = await fetch(tpl.file);
        if (res.ok) {
          const scene = await res.json();
          STATE.templatesCache[tpl.id] = scene;
          return scene;
        }
      } catch (e) {
        console.warn('Error fetching template scene:', tpl.file, e);
      }
    }
    return null;
  }

  async function renderTemplatesList() {
    if (!templatesListContainer) return;
    templatesListContainer.innerHTML = '';

    const cat = STATE.templateActiveCategory || 'all';
    const query = (STATE.templateSearchQuery || '').trim().toLowerCase();
    const lang = STATE.templateLang || 'ar';

    let list = [];
    if (cat === 'my_templates') {
      list = STATE.myTemplates;
    } else {
      list = (STATE.templatesIndex || []).filter(t => {
        if (cat !== 'all' && t.category !== cat) return false;
        return true;
      });
    }

    if (query) {
      list = list.filter(t => {
        const name = (t.name || '').toLowerCase();
        const nameEn = (t.nameEn || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const category = (t.category || '').toLowerCase();
        return name.includes(query) || nameEn.includes(query) || desc.includes(query) || category.includes(query);
      });
    }

    if (list.length === 0) {
      templatesListContainer.innerHTML = `
        <div style="text-align:center; padding:30px 10px; color:var(--text-dim); font-size:12px;">
          <i class="fa-regular fa-folder-open" style="font-size:24px; margin-bottom:8px; display:block;"></i>
          ${cat === 'my_templates' ? 'لا توجد قوالب خاصة محفوظة بعد. احفظ مشهدك الحالي كنموذج!' : 'لم يتم العثور على نماذج تطابق بحثك.'}
        </div>
      `;
      return;
    }

    for (const tpl of list) {
      const card = document.createElement('div');
      card.className = 'template-card-v2';
      card.dataset.tplId = tpl.id;

      const title = lang === 'en' && tpl.nameEn ? tpl.nameEn : tpl.name;
      const isCustom = !!tpl.isCustom || cat === 'my_templates';

      card.innerHTML = `
        <div class="template-card-header">
          <div class="template-card-title" title="${title}">${title}</div>
          <span class="template-card-badge ${isCustom ? 'badge-my-template' : ''}">${isCustom ? 'قالب خاص' : (tpl.aspect || '16:9')}</span>
        </div>
        <div class="template-preview-canvas-wrap">
          <canvas class="template-preview-canvas" width="320" height="180"></canvas>
          <div style="position:absolute; bottom:4px; right:6px; font-size:9px; background:rgba(0,0,0,0.7); padding:1px 4px; border-radius:3px; color:#fff;">
            ${tpl.duration || 5}s
          </div>
        </div>
        <div class="template-card-desc">${tpl.description || ''}</div>
        <div class="template-card-actions">
          <button class="btn btn-primary btn-apply-tpl" style="flex:1;">
            <i class="fa-solid fa-play"></i> استخدام
          </button>
          ${isCustom ? `
            <button class="icon-btn btn-dup-tpl" title="تكرار النموذج"><i class="fa-regular fa-copy"></i></button>
            <button class="icon-btn btn-share-tpl" title="مشاركة رابط النموذج"><i class="fa-solid fa-share-nodes"></i></button>
            <button class="icon-btn btn-del-tpl text-danger" title="حذف النموذج"><i class="fa-regular fa-trash-can"></i></button>
          ` : `
            <button class="icon-btn btn-share-tpl" title="مشاركة رابط النموذج"><i class="fa-solid fa-share-nodes"></i></button>
          `}
        </div>
      `;

      // Live thumbnail rendering with engine
      const previewCanvas = card.querySelector('.template-preview-canvas');
      renderTemplateThumbnail(tpl, previewCanvas);

      // Event handlers
      card.querySelector('.btn-apply-tpl').addEventListener('click', async (e) => {
        e.stopPropagation();
        const scene = await getTemplateScene(tpl);
        if (scene) loadTemplateSceneIntoEditor(scene, tpl.name);
      });

      card.querySelector('.btn-share-tpl').addEventListener('click', async (e) => {
        e.stopPropagation();
        const scene = await getTemplateScene(tpl);
        if (scene) openShareModalForScene(scene, tpl.name);
      });

      if (isCustom) {
        card.querySelector('.btn-dup-tpl')?.addEventListener('click', (e) => {
          e.stopPropagation();
          duplicateCustomTemplate(tpl);
        });
        card.querySelector('.btn-del-tpl')?.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteCustomTemplate(tpl.id);
        });
      }

      templatesListContainer.appendChild(card);
    }
  }

  async function renderTemplateThumbnail(tpl, canvas) {
    if (!canvas || !window.MotionEngine) return;
    const scene = await getTemplateScene(tpl);
    if (!scene) return;
    try {
      const previewTime = Math.min(1.2, (scene.duration || 5) * 0.4);
      MotionEngine.renderFrame(scene, previewTime, canvas);
    } catch (e) {
      console.warn('Thumbnail render notice:', e);
    }
  }

  function loadTemplateSceneIntoEditor(tplScene, name = 'نموذج موشن') {
    if (confirm(`هل تريد استبدال المشهد الحالي بنموذج "${name}"؟`)) {
      pushUndo();
      STATE.scene = JSON.parse(JSON.stringify(tplScene));
      if (STATE.brandKit) STATE.scene.brandKit = STATE.brandKit;
      STATE.currentTime = 0;
      STATE.selectedLayerIds = STATE.scene.layers.length ? [STATE.scene.layers[STATE.scene.layers.length - 1].id] : [];
      projectTitleInput.value = STATE.scene.name || name;

      // Update Aspect selector
      if (STATE.scene.width === 1080 && STATE.scene.height === 1920) aspectPresetSelector.value = '9:16';
      else if (STATE.scene.width === 1920 && STATE.scene.height === 1080) aspectPresetSelector.value = '16:9';
      else if (STATE.scene.width === 1080 && STATE.scene.height === 1080) aspectPresetSelector.value = '1:1';
      else if (STATE.scene.width === 1080 && STATE.scene.height === 1350) aspectPresetSelector.value = '4:5';
      else aspectPresetSelector.value = 'custom';

      renderAll();
      showToast(`تم تحميل نموذج: ${name}`, 'success');
    }
  }

  // Backward-compatible loadTemplate
  function loadTemplate(tplKey) {
    const tpl = TEMPLATES[tplKey];
    if (tpl) {
      loadTemplateSceneIntoEditor(tpl, tpl.name);
    }
  }

  async function saveCurrentSceneAsTemplate(name, category, description) {
    if (!name) name = STATE.scene.name || 'قالب مخصص جديد';
    const newTpl = {
      id: 'tpl_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4),
      name: name,
      nameEn: name,
      category: category || 'lower_thirds',
      description: description || 'نموذج مخصص تم تصميمه في محرر الموشن',
      aspect: `${STATE.scene.width}:${STATE.scene.height}`,
      width: STATE.scene.width,
      height: STATE.scene.height,
      duration: STATE.scene.duration,
      createdAt: Date.now(),
      isCustom: true,
      scene: JSON.parse(JSON.stringify(STATE.scene))
    };

    STATE.myTemplates.unshift(newTpl);
    localStorage.setItem('mickey_my_templates', JSON.stringify(STATE.myTemplates));

    if (STATE.currentUser && window.firebase) {
      try {
        const db = firebase.firestore();
        await db.collection('users').doc(STATE.currentUser.uid).collection('templates').doc(newTpl.id).set(newTpl);
      } catch (e) {
        console.warn('Firestore template save notice:', e);
      }
    }

    renderTemplatesList();
    if (modalSaveTemplate) modalSaveTemplate.classList.remove('active');
    showToast(`تم حفظ "${name}" في قائمة قوالبي`, 'success');
  }

  async function duplicateCustomTemplate(tpl) {
    const copy = JSON.parse(JSON.stringify(tpl));
    copy.id = 'tpl_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
    copy.name = copy.name + ' (نسخة)';
    copy.nameEn = (copy.nameEn || copy.name) + ' (Copy)';
    copy.createdAt = Date.now();
    STATE.myTemplates.unshift(copy);
    localStorage.setItem('mickey_my_templates', JSON.stringify(STATE.myTemplates));

    if (STATE.currentUser && window.firebase) {
      try {
        const db = firebase.firestore();
        await db.collection('users').doc(STATE.currentUser.uid).collection('templates').doc(copy.id).set(copy);
      } catch (e) {}
    }

    renderTemplatesList();
    showToast('تم تكرار النموذج بنجاح', 'success');
  }

  async function deleteCustomTemplate(tplId) {
    if (!confirm('هل أنت متأكد من حذف هذا النموذج من قوالبك؟')) return;
    STATE.myTemplates = STATE.myTemplates.filter(t => t.id !== tplId);
    localStorage.setItem('mickey_my_templates', JSON.stringify(STATE.myTemplates));

    if (STATE.currentUser && window.firebase) {
      try {
        const db = firebase.firestore();
        await db.collection('users').doc(STATE.currentUser.uid).collection('templates').doc(tplId).delete();
      } catch (e) {}
    }

    renderTemplatesList();
    showToast('تم حذف النموذج', 'info');
  }

  function openShareModalForScene(scene, name = 'Motion Template') {
    try {
      const jsonStr = JSON.stringify(scene);
      const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
      const shareUrl = `${window.location.origin}${window.location.pathname}?shareTpl=${encoded}`;
      if (shareTplUrlInput) shareTplUrlInput.value = shareUrl;
      if (modalShareTemplate) modalShareTemplate.classList.add('active');
    } catch (e) {
      console.warn('Error generating share link:', e);
      showToast('تعذر إنشاء رابط المشاركة', 'error');
    }
  }

  function checkUrlForSharedTemplate() {
    try {
      const params = new URLSearchParams(window.location.search);
      const shareData = params.get('shareTpl');
      if (shareData) {
        const jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(shareData))));
        const parsed = JSON.parse(jsonStr);
        if (parsed && (parsed.version === 2 || parsed.layers)) {
          STATE.scene = parsed;
          if (STATE.brandKit) STATE.scene.brandKit = STATE.brandKit;
          projectTitleInput.value = parsed.name || 'نموذج مشارك';
          renderAll();
          showToast('تم استيراد النموذج المشترك بنجاح!', 'success');
        }
      }
    } catch (e) {
      console.warn('Error parsing shared template from URL:', e);
    }
  }

  function initTemplateBrowserListeners() {
    // Search input
    if (templateSearchInput) {
      templateSearchInput.addEventListener('input', () => {
        STATE.templateSearchQuery = templateSearchInput.value;
        renderTemplatesList();
      });
    }

    // Category pills
    if (templateCategoryPills) {
      templateCategoryPills.querySelectorAll('.tpl-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          templateCategoryPills.querySelectorAll('.tpl-cat-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          STATE.templateActiveCategory = btn.dataset.cat;
          renderTemplatesList();
        });
      });
    }

    // Language toggle
    if (btnTplLangAr && btnTplLangEn) {
      btnTplLangAr.addEventListener('click', () => {
        STATE.templateLang = 'ar';
        btnTplLangAr.classList.add('btn-primary');
        btnTplLangEn.classList.remove('btn-primary');
        renderTemplatesList();
      });
      btnTplLangEn.addEventListener('click', () => {
        STATE.templateLang = 'en';
        btnTplLangEn.classList.add('btn-primary');
        btnTplLangAr.classList.remove('btn-primary');
        renderTemplatesList();
      });
    }

    // Save As Template Modal
    const openSaveModal = () => {
      if (saveTplName) saveTplName.value = STATE.scene.name || '';
      if (modalSaveTemplate) modalSaveTemplate.classList.add('active');
    };
    if (btnSaveAsTemplate) btnSaveAsTemplate.addEventListener('click', openSaveModal);
    if (btnQuickSaveTemplate) btnQuickSaveTemplate.addEventListener('click', openSaveModal);

    if (btnConfirmSaveTemplate) {
      btnConfirmSaveTemplate.addEventListener('click', () => {
        const name = saveTplName ? saveTplName.value.trim() : '';
        const cat = saveTplCategory ? saveTplCategory.value : 'lower_thirds';
        const desc = saveTplDesc ? saveTplDesc.value.trim() : '';
        saveCurrentSceneAsTemplate(name, cat, desc);
      });
    }

    // Copy share link button
    if (btnCopyShareUrl && shareTplUrlInput) {
      btnCopyShareUrl.addEventListener('click', () => {
        navigator.clipboard.writeText(shareTplUrlInput.value).then(() => {
          showToast('تم نسخ رابط مشاركة النموذج إلى الحافظة', 'success');
        }).catch(() => {
          shareTplUrlInput.select();
          document.execCommand('copy');
          showToast('تم نسخ الرابط', 'success');
        });
      });
    }
  }

  // -----------------------------------------------------------------
  // 17c. AUDIO SFX & BACKGROUND MUSIC CONTROLLER
  // -----------------------------------------------------------------
  function checkAudioTriggers(prevTime, curTime) {
    if (!window.MotionAudio || !STATE.scene.layers) return;
    STATE.scene.layers.forEach(layer => {
      if (layer.visible === false) return;
      const sfx = layer.presets?.in?.sfx;
      if (sfx) {
        if (layer.start >= prevTime && layer.start < curTime) {
          const triggerKey = `${layer.id}_${layer.start}`;
          if (!STATE.triggeredSFXTimes.has(triggerKey)) {
            STATE.triggeredSFXTimes.add(triggerKey);
            MotionAudio.playSFX(sfx, 0.85);

            // Automatic Ducking on background music
            if (STATE.bgMusicGainNode && STATE.bgMusicAudio && !STATE.bgMusicAudio.paused) {
              MotionAudio.duckGainNode(STATE.bgMusicGainNode, 0.2, 0.55, 0.75);
            }
          }
        }
      }
    });
  }

  function setupBgMusic(dataUrl, fileName = 'موسيقى خلفية') {
    if (STATE.bgMusicAudio) {
      STATE.bgMusicAudio.pause();
      STATE.bgMusicAudio.src = '';
    }

    const audio = new Audio();
    audio.src = dataUrl;
    audio.loop = true;
    STATE.bgMusicAudio = audio;

    if (window.MotionAudio) {
      const ctx = MotionAudio.getAudioContext();
      if (ctx) {
        try {
          if (!STATE.bgMusicSourceNode) {
            const source = ctx.createMediaElementSource(audio);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.75, ctx.currentTime);
            source.connect(gain);
            gain.connect(ctx.destination);
            STATE.bgMusicSourceNode = source;
            STATE.bgMusicGainNode = gain;
          }
        } catch (e) {
          console.warn('Audio graph notice:', e);
        }
      }
    }

    STATE.scene.audio = [{
      id: 'bg_music',
      name: fileName,
      src: dataUrl,
      start: 0,
      volume: 0.75,
      ducking: true
    }];

    if (btnUploadMusic) btnUploadMusic.classList.add('btn-music-active');
    if (musicBtnLabel) musicBtnLabel.textContent = fileName.length > 10 ? fileName.substr(0, 8) + '...' : fileName;
    if (btnToggleMusicMute) btnToggleMusicMute.style.display = 'inline-flex';
    if (btnRemoveMusic) btnRemoveMusic.style.display = 'inline-flex';
    showToast(`تمت إضافة المسار الصوتي: ${fileName}`, 'success');
  }

  function playBgMusic() {
    if (STATE.bgMusicAudio && STATE.bgMusicAudio.src) {
      try {
        STATE.bgMusicAudio.currentTime = Math.max(0, STATE.currentTime);
        STATE.bgMusicAudio.play().catch(() => {});
      } catch (e) {}
    }
  }

  function pauseBgMusic() {
    if (STATE.bgMusicAudio) {
      try {
        STATE.bgMusicAudio.pause();
      } catch (e) {}
    }
  }

  function syncBgMusicTime() {
    if (STATE.bgMusicAudio) {
      try {
        STATE.bgMusicAudio.currentTime = Math.max(0, STATE.currentTime);
      } catch (e) {}
    }
  }

  function initMusicControlsListeners() {
    if (btnUploadMusic && musicFileInput) {
      btnUploadMusic.addEventListener('click', () => musicFileInput.click());
      musicFileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setupBgMusic(ev.target.result, file.name);
        reader.readAsDataURL(file);
      });
    }

    if (btnToggleMusicMute) {
      btnToggleMusicMute.addEventListener('click', () => {
        if (!STATE.bgMusicAudio) return;
        STATE.bgMusicMuted = !STATE.bgMusicMuted;
        STATE.bgMusicAudio.muted = STATE.bgMusicMuted;
        if (musicMuteIcon) {
          musicMuteIcon.className = STATE.bgMusicMuted ? 'fa-solid fa-volume-xmark text-danger' : 'fa-solid fa-volume-high';
        }
        showToast(STATE.bgMusicMuted ? 'تم كتم الموسيقى' : 'تم تشغيل صوت الموسيقى', 'info');
      });
    }

    if (btnRemoveMusic) {
      btnRemoveMusic.addEventListener('click', () => {
        if (STATE.bgMusicAudio) {
          STATE.bgMusicAudio.pause();
          STATE.bgMusicAudio = null;
        }
        delete STATE.scene.audio;
        if (btnUploadMusic) btnUploadMusic.classList.remove('btn-music-active');
        if (musicBtnLabel) musicBtnLabel.textContent = 'موسيقى';
        if (btnToggleMusicMute) btnToggleMusicMute.style.display = 'none';
        if (btnRemoveMusic) btnRemoveMusic.style.display = 'none';
        showToast('تمت إزالة مسار الموسيقى من المشهد', 'info');
      });
    }
  }

  // -----------------------------------------------------------------
  // 17.5 AI ASSISTANT, CHAT EDIT & DESIGN AUDIT
  // -----------------------------------------------------------------
  function getMotionWorkerUrl() {
    return String(localStorage.getItem('mickey_cloudflare_worker_url') || 'https://mickey-studio-api.kma279500.workers.dev').trim().replace(/\/$/, '');
  }

  async function getMotionAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'X-Anonymous-ID': localStorage.getItem('mickey_anonymous_id') || 'guest_' + Math.random().toString(36).substring(2)
    };
    if (STATE.currentUser && window.firebase) {
      try {
        const token = await STATE.currentUser.getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (_) {}
    }
    return headers;
  }

  function updateMotionQuotaBadge(quota) {
    if (!aiMotionQuotaBadge) return;
    if (!quota) {
      aiMotionQuotaBadge.textContent = '10 طلبات / اليوم';
      return;
    }
    if (quota.unlimited) {
      aiMotionQuotaBadge.textContent = 'غير محدود (Admin)';
      aiMotionQuotaBadge.style.color = '#10b981';
      aiMotionQuotaBadge.style.borderColor = 'rgba(16,185,129,0.4)';
      return;
    }
    const rem = typeof quota.remaining === 'number' ? quota.remaining : 10;
    const limit = quota.limit || 10;
    aiMotionQuotaBadge.textContent = `متبقي لك ${rem} من ${limit} اليوم`;
    if (rem === 0) {
      aiMotionQuotaBadge.style.color = '#ef4444';
      aiMotionQuotaBadge.style.borderColor = 'rgba(239,68,68,0.4)';
    } else if (rem <= 3) {
      aiMotionQuotaBadge.style.color = '#f59e0b';
      aiMotionQuotaBadge.style.borderColor = 'rgba(245,158,11,0.4)';
    } else {
      aiMotionQuotaBadge.style.color = '#38bdf8';
      aiMotionQuotaBadge.style.borderColor = 'rgba(56,189,248,0.4)';
    }
  }

  async function fetchMotionQuotas() {
    try {
      const headers = await getMotionAuthHeaders();
      const res = await fetch(`${getMotionWorkerUrl()}/api?action=get_user_quotas`, { headers });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.quotas?.motion) {
        updateMotionQuotaBadge(data.quotas.motion);
      }
    } catch (e) {
      console.warn('[MotionEditor] fetchMotionQuotas notice:', e);
    }
  }

  function showAiError(friendlyMsg, techData = null) {
    if (!aiErrorBox) return;
    aiErrorBox.style.display = 'flex';
    if (aiErrorFriendlyMsg) aiErrorFriendlyMsg.textContent = friendlyMsg;
    if (aiErrorTechDetails) {
      if (techData) {
        const detailsObj = typeof techData === 'object' ? techData : { raw: techData };
        aiErrorTechDetails.textContent = JSON.stringify(detailsObj, null, 2);
      } else {
        aiErrorTechDetails.textContent = 'لا توجد معلومات تقنية إضافية.';
      }
    }
  }

  function hideAiError() {
    if (aiErrorBox) aiErrorBox.style.display = 'none';
  }

  function sanitizeSceneForWorker(scene) {
    if (!scene || typeof scene !== 'object') return {};
    const cloned = JSON.parse(JSON.stringify(scene));
    if (Array.isArray(cloned.layers)) {
      for (const layer of cloned.layers) {
        if (layer.content && typeof layer.content === 'object' && layer.content.src) {
          if (String(layer.content.src).startsWith('data:') || String(layer.content.src).length > 256) {
            layer.content.src = '[image_asset]';
          }
        }
      }
    }
    return cloned;
  }

  function autoRepairScene(rawOrParsed, aspect = '16:9') {
    let scene = rawOrParsed;
    if (typeof scene === 'string') {
      try {
        const cleaned = scene.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        scene = JSON.parse(cleaned);
      } catch (_) {
        const match = scene.match(/\{[\s\S]*\}/);
        if (match) {
          try { scene = JSON.parse(match[0]); } catch (e) {}
        }
      }
    }
    if (!scene || typeof scene !== 'object') scene = {};

    const dims = {
      '16:9': { w: 1920, h: 1080 },
      '9:16': { w: 1080, h: 1920 },
      '1:1': { w: 1080, h: 1080 },
      '4:5': { w: 1080, h: 1350 }
    }[aspect] || { w: 1920, h: 1080 };

    scene.version = 2;
    scene.id = String(scene.id || `sc_ai_${Date.now()}`);
    scene.name = String(scene.name || 'مشهد بالذكاء الاصطناعي');
    scene.width = Number(scene.width) || dims.w;
    scene.height = Number(scene.height) || dims.h;
    scene.fps = 30;
    scene.duration = Math.max(2.0, Math.min(30.0, Number(scene.duration) || 5.0));

    if (!scene.background || typeof scene.background !== 'object') {
      scene.background = { type: 'color', color: '#0b0d14' };
    } else if (!scene.background.type) {
      scene.background.type = scene.background.color ? 'color' : 'transparent';
    }

    if (!Array.isArray(scene.layers)) scene.layers = [];

    scene.layers = scene.layers.map((layer, idx) => {
      if (!layer || typeof layer !== 'object') layer = {};
      const lid = String(layer.id || `layer_${idx + 1}`);
      const isTextLike = typeof layer.content === 'string' || Boolean(layer.content?.text) || Boolean(layer.text);
      const ltype = ['text', 'shape', 'counter', 'image', 'chart', 'progressBar', 'progressRing'].includes(layer.type)
        ? layer.type
        : (isTextLike ? 'text' : 'shape');
      const start = Math.max(0, Number(layer.start) || 0);
      const duration = Math.max(0.5, Math.min(scene.duration - start, Number(layer.duration) || (scene.duration - start)));

      const tf = layer.transform || {};
      const transform = {
        x: Number.isFinite(Number(tf.x)) ? Number(tf.x) : Math.round(scene.width / 2),
        y: Number.isFinite(Number(tf.y)) ? Number(tf.y) : Math.round(scene.height / 2),
        w: Math.max(20, Number(tf.w) || (ltype === 'text' ? Math.round(scene.width * 0.7) : 300)),
        h: Math.max(10, Number(tf.h) || (ltype === 'text' ? 80 : 100)),
        rotation: Number(tf.rotation) || 0,
        scaleX: Number.isFinite(Number(tf.scaleX)) ? Number(tf.scaleX) : 1,
        scaleY: Number.isFinite(Number(tf.scaleY)) ? Number(tf.scaleY) : 1,
        anchorX: Number.isFinite(Number(tf.anchorX)) ? Number(tf.anchorX) : 0.5,
        anchorY: Number.isFinite(Number(tf.anchorY)) ? Number(tf.anchorY) : 0.5,
        opacity: Number.isFinite(Number(tf.opacity)) ? Number(tf.opacity) : 1
      };

      const st = layer.style || {};
      const style = { ...st };
      if (ltype === 'text') {
        style.fill = style.fill || '#ffffff';
        style.font = style.font || 'Readex Pro';
        style.fontSize = Math.max(16, Number(style.fontSize) || 48);
        style.fontWeight = style.fontWeight || '700';
        style.align = style.align || 'center';
        style.direction = style.direction || 'rtl';
      } else if (ltype === 'shape') {
        style.fill = style.fill || '#6366f1';
        style.radius = Number(style.radius) || 12;
      }

      let content = layer.content;
      if (ltype === 'text') {
        const textVal = typeof content === 'string' ? content : (content?.text || layer.text || layer.name || 'نص جديد');
        content = { text: String(textVal) };
      } else if (!content || typeof content !== 'object') {
        content = { shape: 'rounded-rect' };
      }

      let presets = layer.presets;
      if (typeof presets === 'string') {
        presets = { in: { name: presets, dur: 0.5 } };
      } else if (presets && typeof presets === 'object') {
        if (typeof presets.in === 'string') presets.in = { name: presets.in, dur: 0.5 };
        if (typeof presets.out === 'string') presets.out = { name: presets.out, dur: 0.4 };
        if (typeof presets.loop === 'string') presets.loop = { name: presets.loop, dur: 2.0 };
      }

      return {
        id: lid,
        type: ltype,
        name: String(layer.name || (ltype === 'text' ? 'نص' : 'شكل')),
        start,
        duration,
        transform,
        style,
        content,
        presets: presets || undefined
      };
    });

    return scene;
  }

  function findFallbackTemplate(prompt) {
    const p = String(prompt || '').toLowerCase();
    const index = Array.isArray(STATE.templatesIndex) ? STATE.templatesIndex : [];
    if (!index.length) return null;
    if (/شريط|تعريفي|third|lower|ضيف|اسم|مذيع/i.test(p)) {
      return index.find(t => t.category === 'lower_thirds') || index[0];
    }
    if (/اقتباس|حكمة|مقولة|quote/i.test(p)) {
      return index.find(t => t.category === 'quote_cards') || index[0];
    }
    if (/سوشيال|انستقرام|تيك|reels|social/i.test(p)) {
      return index.find(t => t.category === 'social_cards') || index[0];
    }
    if (/اشتراك|قناة|تفاعل|لايك|subscribe|cta/i.test(p)) {
      return index.find(t => t.category === 'subscribe_cta') || index[0];
    }
    if (/عداد|أرقام|إحصائيات|أرباح|counter/i.test(p)) {
      return index.find(t => t.category === 'countdown_counters') || index[0];
    }
    return index.find(t => t.category === 'titles_intros') || index[0];
  }

  async function generateSceneWithAi(promptText, aspectVal, useBrand) {
    hideAiError();
    const prompt = String(promptText || '').trim();
    if (!prompt) {
      showToast('اكتب فكرة المشهد أولاً!', 'warning');
      return;
    }

    if (btnAiGenerateScene) {
      btnAiGenerateScene.disabled = true;
      btnAiGenerateScene.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>جاري التوليد بالذكاء الاصطناعي...</span>';
    }

    try {
      const headers = await getMotionAuthHeaders();
      const payload = {
        prompt,
        aspectRatio: aspectVal || '16:9',
        brandKit: useBrand ? STATE.brandKit : null
      };

      const doRequest = async (overridePrompt = null) => {
        const bodyData = { ...payload };
        if (overridePrompt) bodyData.prompt = overridePrompt;
        const res = await fetch(`${getMotionWorkerUrl()}/api?action=motion_ai_generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyData)
        });
        const jsonRes = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data: jsonRes };
      };

      let attempt = await doRequest();
      if (attempt.data?.quota) updateMotionQuotaBadge(attempt.data.quota);

      if (!attempt.ok || !attempt.data?.success) {
        if (attempt.status === 429) {
          throw { status: 429, friendly: 'لقد استهلكت رصيدك اليومي المجاني لمشاهد الموشن (10/10). يتجدد رصيدك عند منتصف الليل بتوقيت UTC.', data: attempt.data };
        }
        throw { status: attempt.status, friendly: attempt.data?.error || 'تعذر توليد المشهد من خدمة الذكاء الاصطناعي.', data: attempt.data };
      }

      let repaired = autoRepairScene(attempt.data.scene || attempt.data.raw, aspectVal);
      let validation = MotionEngine.validateScene(repaired);

      // Retry once if invalid
      if (!validation.valid) {
        console.warn('[MotionEditor AI] First attempt invalid, retrying once...', validation.errors);
        const retryPrompt = `Fix schema errors and generate strict valid scene JSON v2 for: ${prompt}. Previous errors: ${validation.errors.join(', ')}`;
        attempt = await doRequest(retryPrompt);
        if (attempt.data?.quota) updateMotionQuotaBadge(attempt.data.quota);
        if (attempt.ok && attempt.data?.success) {
          repaired = autoRepairScene(attempt.data.scene || attempt.data.raw, aspectVal);
          validation = MotionEngine.validateScene(repaired);
        }
      }

      // If still invalid, fall back to nearest template
      if (!validation.valid) {
        console.warn('[MotionEditor AI] Validation failed after retry. Falling back to nearest template...');
        const tplMeta = findFallbackTemplate(prompt);
        if (tplMeta) {
          const tplScene = await loadTemplateScene(tplMeta);
          if (tplScene) {
            repaired = JSON.parse(JSON.stringify(tplScene));
            repaired.name = prompt.slice(0, 30);
            const textLayer = repaired.layers?.find(l => l.type === 'text');
            if (textLayer && textLayer.content) {
              textLayer.content.text = prompt;
            }
            validation = MotionEngine.validateScene(repaired);
            showToast('تم استخدام نموذج مطابق ذكي لضمان استقرار المشهد', 'info');
          }
        }
      }

      if (!validation.valid) {
        throw { status: 502, friendly: 'أعاد الذكاء الاصطناعي بنية غير مطابقة للمواصفات.', data: validation.errors };
      }

      pushUndo();
      STATE.scene = repaired;
      if (aspectPresetSelector) aspectPresetSelector.value = aspectVal;
      renderAll();
      scheduleAutoSave();
      showToast('✓ تم توليد وتطبيق المشهد بنجاح!', 'success');

      appendChatMessage('assistant', `تم توليد المشهد بنجاح بناءً على فكرتك: "${prompt}". يمكنك الآن طلب تعديلات إضافية هنا بالمحادثة.`);
    } catch (err) {
      console.error('[MotionEditor AI Generate Error]:', err);
      const friendly = err.friendly || (err.status === 429 ? 'استهلكت حد الموشن اليومي المجاني (10/10).' : 'تعذر إكمال التوليد بالذكاء الاصطناعي.');
      showAiError(friendly, err.data || err.message || err);
      showToast(friendly, 'error');
    } finally {
      if (btnAiGenerateScene) {
        btnAiGenerateScene.disabled = false;
        btnAiGenerateScene.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>توليد المشهد بالذكاء الاصطناعي</span>';
      }
    }
  }

  function appendChatMessage(sender, text) {
    if (!aiChatMessages) return;
    const msg = document.createElement('div');
    msg.className = `chat-msg ${sender}`;
    msg.textContent = text;
    aiChatMessages.appendChild(msg);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  }

  function applyScenePatches(patches) {
    if (!Array.isArray(patches) || !patches.length) return false;
    let appliedCount = 0;

    for (const patch of patches) {
      if (!patch || !patch.op) continue;
      const op = patch.op;

      if (op === 'set') {
        const pathParts = String(patch.path || '').split('.');
        let target = STATE.scene;
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          const match = part.match(/^layers\[(\d+)\]$/);
          if (match) {
            target = target.layers?.[parseInt(match[1])];
          } else {
            target = target[part];
          }
          if (!target) break;
        }
        if (target) {
          const lastPart = pathParts[pathParts.length - 1];
          const match = lastPart.match(/^layers\[(\d+)\]$/);
          if (match) {
            if (STATE.scene.layers) STATE.scene.layers[parseInt(match[1])] = patch.value;
          } else {
            target[lastPart] = patch.value;
          }
          appliedCount++;
        }
      } else if (op === 'merge') {
        const pathParts = String(patch.path || '').split('.');
        let target = STATE.scene;
        for (let i = 0; i < pathParts.length; i++) {
          const part = pathParts[i];
          const match = part.match(/^layers\[(\d+)\]$/);
          if (match) {
            target = target.layers?.[parseInt(match[1])];
          } else {
            target = target[part];
          }
          if (!target) break;
        }
        if (target && typeof target === 'object' && typeof patch.value === 'object') {
          Object.assign(target, patch.value);
          appliedCount++;
        }
      } else if (op === 'add_layer') {
        if (patch.layer && typeof patch.layer === 'object') {
          if (!Array.isArray(STATE.scene.layers)) STATE.scene.layers = [];
          STATE.scene.layers.push(patch.layer);
          appliedCount++;
        }
      } else if (op === 'remove_layer') {
        if (patch.id && Array.isArray(STATE.scene.layers)) {
          STATE.scene.layers = STATE.scene.layers.filter(l => l.id !== patch.id);
          appliedCount++;
        } else if (typeof patch.index === 'number' && Array.isArray(STATE.scene.layers)) {
          STATE.scene.layers.splice(patch.index, 1);
          appliedCount++;
        }
      }
    }
    return appliedCount > 0;
  }

  async function editSceneWithChat(instructionText) {
    hideAiError();
    const instruction = String(instructionText || '').trim();
    if (!instruction) return;

    appendChatMessage('user', instruction);
    if (aiChatInput) aiChatInput.value = '';

    const pendingMsg = document.createElement('div');
    pendingMsg.className = 'chat-msg assistant';
    pendingMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin ml-1 text-cyan-400"></i> جاري تحليل التعديل المطلوب وتطبيقه...';
    aiChatMessages.appendChild(pendingMsg);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

    if (btnAiSendChat) btnAiSendChat.disabled = true;

    try {
      const headers = await getMotionAuthHeaders();
      const sanitizedScene = sanitizeSceneForWorker(STATE.scene);

      const res = await fetch(`${getMotionWorkerUrl()}/api?action=motion_ai_edit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instruction,
          scene: sanitizedScene
        })
      });

      const data = await res.json().catch(() => ({}));
      if (data?.quota) updateMotionQuotaBadge(data.quota);

      if (!res.ok || !data?.success) {
        if (res.status === 429) {
          throw { status: 429, friendly: 'استهلكت الحد اليومي المجاني للموشن (10/10). يتجدد رصيدك عند منتصف الليل بتوقيت UTC.', data };
        }
        throw { status: res.status, friendly: data?.error || 'تعذر تطبيق التعديل بالذكاء الاصطناعي.', data };
      }

      pushUndo();
      const applied = applyScenePatches(data.patches);
      if (applied) {
        renderAll();
        scheduleAutoSave();
        pendingMsg.textContent = '✓ تم تطبيق التعديل بنجاح! يمكنك التراجع في أي وقت بـ (Ctrl+Z).';
        showToast('✓ تم تطبيق التعديل على المشهد', 'success');
      } else {
        pendingMsg.textContent = 'لم أتمكن من استخراج تعديلات مطابقة. حاول صياغة الطلب بشكل أوضح (مثال: "اجعل لون الخلفية أحمر").';
      }
    } catch (err) {
      console.error('[MotionEditor AI Chat Edit Error]:', err);
      const friendly = err.friendly || 'تعذر تطبيق التعديل.';
      pendingMsg.textContent = `عذراً: ${friendly}`;
      showAiError(friendly, err.data || err.message || err);
      showToast(friendly, 'error');
    } finally {
      if (btnAiSendChat) btnAiSendChat.disabled = false;
    }
  }

  // --- WCAG Contrast & Deterministic Design Audit ---
  function parseColorToRgb(colorStr) {
    if (!colorStr) return [11, 13, 20];
    if (colorStr.startsWith('brand.')) {
      const token = colorStr.split('.')[1];
      colorStr = STATE.brandKit?.colors?.[token] || '#6366f1';
    }
    if (colorStr.startsWith('#')) {
      let hex = colorStr.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      if (hex.length >= 6) {
        return [
          parseInt(hex.slice(0, 2), 16) || 0,
          parseInt(hex.slice(2, 4), 16) || 0,
          parseInt(hex.slice(4, 6), 16) || 0
        ];
      }
    }
    return [255, 255, 255];
  }

  function getRelativeLuminance(rgb) {
    const srgb = rgb.map(v => {
      const s = Math.max(0, Math.min(255, v)) / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }

  function getContrastRatio(rgb1, rgb2) {
    const l1 = getRelativeLuminance(rgb1);
    const l2 = getRelativeLuminance(rgb2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function runDeterministicAudit(scene) {
    const issues = [];
    const width = scene.width || 1920;
    const height = scene.height || 1080;
    const bgColor = scene.background?.color || '#0b0d14';
    const bgRgb = parseColorToRgb(bgColor);

    const layers = Array.isArray(scene.layers) ? scene.layers : [];

    for (const layer of layers) {
      if (layer.type === 'text') {
        const text = String(layer.content?.text || '').trim();
        const fill = layer.style?.fill || '#ffffff';
        const fontSize = Number(layer.style?.fontSize) || 48;
        const duration = Number(layer.duration) || 1;

        // 1. Contrast Check
        const textRgb = parseColorToRgb(fill);
        const ratio = getContrastRatio(textRgb, bgRgb);
        if (ratio < 4.5) {
          const isDarkBg = getRelativeLuminance(bgRgb) < 0.5;
          const targetColor = isDarkBg ? '#ffffff' : '#0f172a';
          issues.push({
            id: `iss_contrast_${layer.id}`,
            layerId: layer.id,
            type: 'contrast',
            severity: 'warning',
            title: 'ضعف تباين لون النص (WCAG)',
            description: `نسبة تباين النص "${layer.name}" هي ${ratio.toFixed(1)}:1 (أقل من معيار الوضوح 4.5:1). قد يصعب قراءته على الخلفية الحالية.`,
            autoFixLabel: 'ضبط التباين تلقائياً',
            applyFix: () => {
              pushUndo();
              layer.style.fill = targetColor;
              renderAll();
              scheduleAutoSave();
            }
          });
        }

        // 2. Mobile Font Size Check
        const isMobileOrVertical = width <= 1080 || height > width;
        const minSize = isMobileOrVertical ? 28 : 24;
        if (fontSize < minSize) {
          issues.push({
            id: `iss_size_${layer.id}`,
            layerId: layer.id,
            type: 'size',
            severity: 'warning',
            title: 'حجم الخط صغير للشاشات الصغيرة',
            description: `حجم الخط للطبقة "${layer.name}" هو ${fontSize}px. يفضل ألا يقل عن ${minSize}px للشاشات الرأسية والهواتف الذكية.`,
            autoFixLabel: `تكبير الخط إلى ${minSize + 6}px`,
            applyFix: () => {
              pushUndo();
              layer.style.fontSize = minSize + 6;
              renderAll();
              scheduleAutoSave();
            }
          });
        }

        // 3. Safe Area Bounds Check
        const tf = layer.transform || { x: width / 2, y: height / 2, w: 400, h: 80, anchorX: 0.5, anchorY: 0.5 };
        const anchorX = typeof tf.anchorX === 'number' ? tf.anchorX : 0.5;
        const anchorY = typeof tf.anchorY === 'number' ? tf.anchorY : 0.5;
        const left = tf.x - tf.w * anchorX;
        const right = tf.x + tf.w * (1 - anchorX);
        const top = tf.y - tf.h * anchorY;
        const bottom = tf.y + tf.h * (1 - anchorY);

        const safeMarginX = width * 0.05;
        const safeMarginY = height * 0.05;

        if (left < safeMarginX || right > width - safeMarginX || top < safeMarginY || bottom > height - safeMarginY) {
          issues.push({
            id: `iss_safe_${layer.id}`,
            layerId: layer.id,
            type: 'safe_area',
            severity: 'danger',
            title: 'عنصر خارج منطقة الأمان (Safe Area)',
            description: `الطبقة "${layer.name}" تقترب من حواف الشاشة وقد يتم اقتطاعها على بعض الشاشات أو أشرطة واجهات منصات الفيديو.`,
            autoFixLabel: 'محاذاة داخل منطقة الأمان',
            applyFix: () => {
              pushUndo();
              if (left < safeMarginX) tf.x = safeMarginX + tf.w * anchorX;
              if (right > width - safeMarginX) tf.x = width - safeMarginX - tf.w * (1 - anchorX);
              if (top < safeMarginY) tf.y = safeMarginY + tf.h * anchorY;
              if (bottom > height - safeMarginY) tf.y = height - safeMarginY - tf.h * (1 - anchorY);
              renderAll();
              scheduleAutoSave();
            }
          });
        }

        // 4. Text Reading Density / Speed Check
        const words = text ? text.split(/\s+/).length : 0;
        const speed = duration > 0 ? (words / duration) : 0;
        if (speed > 3.0 || (words > 22 && speed > 2.5)) {
          const neededDuration = Math.max(duration + 1.5, Math.ceil(words / 2.2));
          issues.push({
            id: `iss_density_${layer.id}`,
            layerId: layer.id,
            type: 'density',
            severity: 'info',
            title: 'سرعة قراءة النص عالية',
            description: `الطبقة "${layer.name}" تحتوي على ${words} كلمة بمدة ${duration} ثانية (${speed.toFixed(1)} كلمة/ثانية). يوصى بزيادة المدة لراحة المشاهد.`,
            autoFixLabel: 'تمديد مدة العرض تلقائياً',
            applyFix: () => {
              pushUndo();
              layer.duration = neededDuration;
              if (layer.start + neededDuration > scene.duration) {
                scene.duration = Math.ceil(layer.start + neededDuration);
              }
              renderAll();
            }
          });
        }
      }
    }

    return issues;
  }

  function renderAuditResults(issues, creativeSuggestions = []) {
    if (!aiSuggestionsList) return;
    aiSuggestionsList.innerHTML = '';

    if (!issues.length && !creativeSuggestions.length) {
      aiSuggestionsList.innerHTML = `
        <div style="padding:12px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:8px; color:#34d399; font-size:11px; text-align:center;">
          <i class="fa-solid fa-circle-check ml-1 text-emerald-400"></i>
          تصميم المشهد متقن ومثالي! التباين ممتاز، وأبعاد الخطوط ومناطق الأمان متوافقة تماماً.
        </div>
      `;
      return;
    }

    for (const issue of issues) {
      const card = document.createElement('div');
      card.className = `suggestion-issue-card ${issue.severity || 'warning'}`;
      card.id = issue.id;

      const icon = issue.severity === 'danger' ? 'fa-triangle-exclamation text-red-400'
        : (issue.severity === 'warning' ? 'fa-triangle-exclamation text-amber-400' : 'fa-circle-info text-cyan-400');

      card.innerHTML = `
        <div class="suggestion-issue-header">
          <div class="suggestion-issue-title">
            <i class="fa-solid ${icon}"></i>
            <span>${issue.title}</span>
          </div>
          <span style="font-size:9px; color:var(--text-dim); text-transform:uppercase;">${issue.type}</span>
        </div>
        <div class="suggestion-issue-desc">${issue.description}</div>
      `;

      if (issue.applyFix) {
        const btnFix = document.createElement('button');
        btnFix.className = 'btn-autofix';
        btnFix.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>${issue.autoFixLabel || 'إصلاح تلقائي'}</span>`;
        btnFix.addEventListener('click', () => {
          issue.applyFix();
          btnFix.disabled = true;
          btnFix.innerHTML = '<i class="fa-solid fa-check"></i> <span>تم الإصلاح ✓</span>';
          btnFix.style.background = 'rgba(16,185,129,0.3)';
          card.classList.remove('warning', 'danger');
          card.classList.add('success');
          showToast('✓ تم تطبيق الإصلاح بنجاح', 'success');
        });
        card.appendChild(btnFix);
      }
      aiSuggestionsList.appendChild(card);
    }

    for (const sug of creativeSuggestions) {
      const card = document.createElement('div');
      card.className = 'suggestion-issue-card info';
      card.innerHTML = `
        <div class="suggestion-issue-header">
          <div class="suggestion-issue-title">
            <i class="fa-solid fa-lightbulb text-amber-400"></i>
            <span>${sug.title || 'اقتراح جمالي'}</span>
          </div>
          <span style="font-size:9px; color:var(--text-dim);">AI TIP</span>
        </div>
        <div class="suggestion-issue-desc">${sug.description || ''}</div>
      `;
      if (Array.isArray(sug.patch) && sug.patch.length) {
        const btnPatch = document.createElement('button');
        btnPatch.className = 'btn-autofix';
        btnPatch.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>تطبيق الاقتراح</span>';
        btnPatch.addEventListener('click', () => {
          pushUndo();
          applyScenePatches(sug.patch);
          renderAll();
          scheduleAutoSave();
          btnPatch.disabled = true;
          btnPatch.innerHTML = '<i class="fa-solid fa-check"></i> <span>تم التطبيق ✓</span>';
          showToast('✓ تم تطبيق اقتراح الذكاء الاصطناعي', 'success');
        });
        card.appendChild(btnPatch);
      }
      aiSuggestionsList.appendChild(card);
    }
  }

  async function auditScene() {
    hideAiError();
    if (btnAiAuditScene) {
      btnAiAuditScene.disabled = true;
      btnAiAuditScene.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-emerald-400"></i><span>جاري الفحص واستخراج الاقتراحات...</span>';
    }

    try {
      const deterministicIssues = runDeterministicAudit(STATE.scene);
      renderAuditResults(deterministicIssues, []);

      const headers = await getMotionAuthHeaders();
      const sanitizedScene = sanitizeSceneForWorker(STATE.scene);

      const res = await fetch(`${getMotionWorkerUrl()}/api?action=motion_ai_suggest`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          scene: sanitizedScene,
          issues: deterministicIssues.map(i => ({ type: i.type, title: i.title, description: i.description }))
        })
      });

      const data = await res.json().catch(() => ({}));
      if (data?.quota) updateMotionQuotaBadge(data.quota);

      const creative = Array.isArray(data?.suggestions) ? data.suggestions : [];
      renderAuditResults(deterministicIssues, creative);
      showToast('✓ اكتمل فحص التصميم بنجاح', 'success');
    } catch (err) {
      console.warn('[MotionEditor AI Audit notice]:', err);
    } finally {
      if (btnAiAuditScene) {
        btnAiAuditScene.disabled = false;
        btnAiAuditScene.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart text-emerald-400"></i><span>فحص واقتراحات التحسين</span>';
      }
    }
  }

  function initAiAssistantListeners() {
    if (btnAiGenerateScene) {
      btnAiGenerateScene.addEventListener('click', () => {
        const prompt = aiPromptInput ? aiPromptInput.value.trim() : '';
        const aspect = aiAspectSelector ? aiAspectSelector.value : '16:9';
        const useBrand = aiUseBrandKit ? aiUseBrandKit.checked : true;
        generateSceneWithAi(prompt, aspect, useBrand);
      });
    }

    document.querySelectorAll('.ai-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-prompt');
        if (aiPromptInput && text) {
          aiPromptInput.value = text;
          aiPromptInput.focus();
        }
      });
    });

    if (btnAiSendChat) {
      btnAiSendChat.addEventListener('click', () => {
        const text = aiChatInput ? aiChatInput.value.trim() : '';
        editSceneWithChat(text);
      });
    }
    if (aiChatInput) {
      aiChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const text = aiChatInput.value.trim();
          editSceneWithChat(text);
        }
      });
    }

    document.querySelectorAll('.ai-edit-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-edit');
        if (aiChatInput && text) {
          aiChatInput.value = text;
          editSceneWithChat(text);
        }
      });
    });

    if (btnAiAuditScene) {
      btnAiAuditScene.addEventListener('click', auditScene);
    }
  }

  // -----------------------------------------------------------------
  // 18. EXPORT SCENE & SEND TO PREMIERE (V2)
  // -----------------------------------------------------------------
  function exportSceneJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(STATE.scene, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = (STATE.scene.name || 'motion-scene') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('تم تصدير ملف المشهد (JSON v2)', 'success');
  }

  async function computeSha256(text) {
    try {
      if (window.crypto && crypto.subtle) {
        const enc = new TextEncoder().encode(text);
        const hashBuf = await crypto.subtle.digest('SHA-256', enc);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (_) {}
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  async function sendSceneToWorker(payload, onProgress) {
    const jsonStr = JSON.stringify(payload);
    const CHUNK_SIZE = 512 * 1024; // 512KB safe KV chunk limit
    const headers = await getMotionAuthHeaders();

    if (jsonStr.length <= CHUNK_SIZE) {
      const res = await fetch(`${getMotionWorkerUrl()}/api?action=motion_scene_submit`, {
        method: 'POST',
        headers,
        body: jsonStr
      });
      return await res.json();
    }

    // Chunked transmission for larger scenes
    const chunkId = 'chk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const totalChunks = Math.ceil(jsonStr.length / CHUNK_SIZE);
    let lastResult = null;

    for (let i = 0; i < totalChunks; i++) {
      const chunkData = jsonStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      if (onProgress) onProgress(i + 1, totalChunks);
      const chunkBody = {
        chunkId,
        chunkIndex: i,
        totalChunks,
        chunkData
      };
      const res = await fetch(`${getMotionWorkerUrl()}/api?action=motion_scene_submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify(chunkBody)
      });
      lastResult = await res.json();
      if (!res.ok || lastResult?.success === false) {
        throw new Error(lastResult?.error || `فشل إرسال الجزء ${i + 1} من ${totalChunks}`);
      }
    }
    return lastResult;
  }

  function openSendPremiereModal() {
    const modal = document.getElementById('modalSendPremiere');
    if (!modal) {
      sendToPremiereLegacy();
      return;
    }
    const nameEl = document.getElementById('premiereSceneName');
    const metaEl = document.getElementById('premiereSceneMeta');
    const badgeEl = document.getElementById('premiereLayerCountBadge');

    updateVersionUI();

    if (nameEl) nameEl.textContent = `${STATE.scene.name || 'مشهد بدون عنوان'} (v${STATE.scene.versionNumber || 1})`;
    if (metaEl) metaEl.textContent = `${STATE.scene.width || 1920}×${STATE.scene.height || 1080} • ${STATE.scene.fps || 30} fps • ${(STATE.scene.duration || 5).toFixed(1)} ثوانٍ`;
    if (badgeEl) badgeEl.textContent = `${(STATE.scene.layers || []).length} طبقات`;

    modal.classList.add('active');
  }

  function closeSendPremiereModal() {
    const modal = document.getElementById('modalSendPremiere');
    if (modal) modal.classList.remove('active');
  }

  async function confirmSendPremiere() {
    const confirmBtn = document.getElementById('btnConfirmSendPremiere');
    const modeEl = document.querySelector('input[name="sendPremiereMode"]:checked');
    const targetEl = document.querySelector('input[name="sendPremiereTarget"]:checked');
    const nestedEl = document.getElementById('chkSendPremiereNested');

    const mode = modeEl ? modeEl.value : 'editable';
    const target = targetEl ? targetEl.value : 'playhead';
    const createNestedSequence = nestedEl ? nestedEl.checked : false;

    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin ml-1"></i> جارٍ الإرسال...';
    }

    try {
      showToast('جارٍ تشفير وحساب بصمة المشهد وإرساله لـ Premiere...', 'info');
      const sceneJson = JSON.stringify(STATE.scene);
      const contentHash = await computeSha256(sceneJson);

      const payload = {
        scene: STATE.scene,
        version: 2,
        contentHash,
        mode,
        target,
        createNestedSequence,
        ttl: 86400, // 24 hours
        timestamp: Date.now()
      };

      // Always save to localStorage so the extension can pick it up immediately
      try {
        localStorage.setItem('mickey_pending_motion_scene_v2', JSON.stringify(payload));
      } catch (_) {}

      // Attempt send to Cloudflare Worker
      let workerSuccess = false;
      try {
        const result = await sendSceneToWorker(payload, (cur, total) => {
          showToast(`جارٍ رفع أجزاء المشهد (${cur}/${total})…`, 'info');
        });
        if (result && result.success) {
          workerSuccess = true;
        }
      } catch (workerErr) {
        console.warn('[SendToPremiere] Worker delivery note:', workerErr);
      }

      // Also persist to user vault in Firestore if authenticated
      if (STATE.currentUser && window.firebase) {
        try {
          const db = firebase.firestore();
          await db.collection('users').doc(STATE.currentUser.uid).collection('vault').doc('motion_pending_receive').set(payload);
        } catch (_) {}
      }

      closeSendPremiereModal();
      showToast(`✓ تم إرسال المشهد بنجاح! (${contentHash.slice(0, 8)}) افتح بريمير لاستلامه.`, 'success');
    } catch (err) {
      showToast(err.message || 'تعذر إرسال المشهد، تم الحفظ محلياً.', 'warning');
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-paper-plane ml-1"></i> إرسال إلى بريمير';
      }
    }
  }

  function sendToPremiere() {
    openSendPremiereModal();
  }

  async function sendToPremiereLegacy() {
    showToast('جاري تحضير المشهد وإرساله لـ Premiere...', 'info');
    const payload = {
      scene: STATE.scene,
      version: 2,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem('mickey_pending_motion_scene_v2', JSON.stringify(payload));
      if (STATE.currentUser && window.firebase) {
        const db = firebase.firestore();
        await db.collection('users').doc(STATE.currentUser.uid).collection('vault').doc('motion_pending_receive').set(payload);
      }
      showToast('✓ تم إرسال المشهد بنجاح! افتح إضافة بريمير لاستلامه فوراً.', 'success');
    } catch (e) {
      exportSceneJSON();
      showToast('تم حفظ المشهد محلياً، يمكنك تصديره وسحبه داخل الإضافة.', 'warning');
    }
  }

  // -----------------------------------------------------------------
  // 18.2 VERSION HISTORY & IN-PLACE PREMIERE UPDATE (Task 8)
  // -----------------------------------------------------------------
  const MAX_VERSIONS = 20;

  function getSceneVersionsKey(sceneId) {
    return `mickey_scene_versions_${sceneId || STATE.scene.id || 'default'}`;
  }

  function loadSceneVersions(sceneId) {
    try {
      const raw = localStorage.getItem(getSceneVersionsKey(sceneId));
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function saveSceneVersionSnapshot(scene, versionNum, diffSummary) {
    try {
      const sid = scene.id || STATE.scene.id;
      const key = getSceneVersionsKey(sid);
      let list = loadSceneVersions(sid);
      const snapshot = {
        versionNumber: versionNum || Number(scene.versionNumber) || (list.length + 1),
        timestamp: Date.now(),
        sceneName: scene.name || 'مشهد بدون عنوان',
        layerCount: (scene.layers || []).length,
        duration: Number(scene.duration) || 5,
        diffSummary: diffSummary || 'تحديث المشهد وحفظ نسخة جديدة',
        sceneData: JSON.parse(JSON.stringify(scene))
      };
      list = [snapshot, ...list.filter(item => item.versionNumber !== snapshot.versionNumber)];
      if (list.length > MAX_VERSIONS) list = list.slice(0, MAX_VERSIONS);
      localStorage.setItem(key, JSON.stringify(list));

      if (STATE.currentUser && window.firebase) {
        try {
          const db = firebase.firestore();
          db.collection('users').doc(STATE.currentUser.uid)
            .collection('scenes').doc(sid)
            .collection('versions').doc(String(snapshot.versionNumber)).set(snapshot).catch(() => {});
        } catch (_) {}
      }
      return list;
    } catch (e) {
      console.warn('Error saving scene version snapshot:', e);
      return [];
    }
  }

  function calculateSceneDiff(prevScene, newScene) {
    if (!prevScene) return 'إنشاء المشهد الأولي';
    const oldLayers = prevScene.layers || [];
    const newLayers = newScene.layers || [];
    const oldIds = new Set(oldLayers.map(l => l.id));
    const newIds = new Set(newLayers.map(l => l.id));

    const added = newLayers.filter(l => !oldIds.has(l.id)).map(l => l.name || l.type);
    const removed = oldLayers.filter(l => !newIds.has(l.id)).map(l => l.name || l.type);

    const modified = [];
    newLayers.forEach(nl => {
      const ol = oldLayers.find(l => l.id === nl.id);
      if (ol && JSON.stringify(ol) !== JSON.stringify(nl)) {
        modified.push(nl.name || nl.type);
      }
    });

    const parts = [];
    if (added.length) parts.push(`+${added.length} طبقة جديدة (${added.slice(0, 2).join('، ')})`);
    if (removed.length) parts.push(`-${removed.length} طبقة محذوفة`);
    if (modified.length) parts.push(`تعديل ${modified.length} طبقة (${modified.slice(0, 2).join('، ')})`);

    const durDiff = Math.round(((newScene.duration || 5) - (prevScene.duration || 5)) * 10) / 10;
    if (Math.abs(durDiff) > 0.05) {
      parts.push(`المدة: ${(newScene.duration || 5).toFixed(1)}ث (${durDiff > 0 ? '+' : ''}${durDiff}ث)`);
    }

    return parts.length ? parts.join(' • ') : 'تحديثات في الحركة ومواقع العناصر';
  }

  function updateVersionUI() {
    const ver = Number(STATE.scene.versionNumber) || 1;
    const nextVer = ver + 1;
    const badge = document.getElementById('currentVersionBadge');
    if (badge) badge.textContent = `v${ver}`;
    const nextPill = document.getElementById('nextVersionPill');
    if (nextPill) nextPill.textContent = `v${nextVer}`;
    const modalNextPill = document.getElementById('modalNextVersionPill');
    if (modalNextPill) modalNextPill.textContent = `v${nextVer}`;

    const btnUpdate = document.getElementById('btnUpdatePremiere');
    const btnSendAsUpdate = document.getElementById('btnSendAsUpdate');
    const isVersioned = ver >= 1;
    if (btnUpdate) {
      btnUpdate.style.display = isVersioned ? 'inline-flex' : 'none';
    }
    if (btnSendAsUpdate) {
      btnSendAsUpdate.style.display = isVersioned ? 'inline-flex' : 'none';
    }
  }

  function openVersionHistoryModal() {
    const modal = document.getElementById('modalVersionHistory');
    const listEl = document.getElementById('versionHistoryList');
    if (!modal || !listEl) return;

    let versions = loadSceneVersions(STATE.scene.id);
    if (!versions.length) {
      saveSceneVersionSnapshot(STATE.scene, STATE.scene.versionNumber || 1, 'النسخة الحالية');
      versions = loadSceneVersions(STATE.scene.id);
    }

    listEl.innerHTML = '';
    versions.forEach(v => {
      const isCurrent = Number(v.versionNumber) === (Number(STATE.scene.versionNumber) || 1);
      const row = document.createElement('div');
      row.style.cssText = `background:${isCurrent ? '#1e293b' : '#141824'}; border:1px solid ${isCurrent ? '#6366f1' : '#2d3343'}; border-radius:10px; padding:12px; display:flex; justify-content:space-between; align-items:center; gap:12px;`;

      const dateStr = new Date(v.timestamp).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
      row.innerHTML = `
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background:${isCurrent ? '#6366f1' : '#334155'}; color:#ffffff; font-size:11px; font-weight:800; padding:2px 8px; border-radius:6px;">v${v.versionNumber}</span>
            <span style="font-weight:700; color:#f8fafc; font-size:13px;">${v.sceneName || 'مشهد'}</span>
            ${isCurrent ? '<span style="font-size:10px; color:#38bdf8; border:1px solid #0284c7; padding:1px 5px; border-radius:4px;">الإصدار الحالي</span>' : ''}
          </div>
          <div style="font-size:11px; color:#94a3b8; margin-top:4px; line-height:1.4;">
            ${v.diffSummary || ''}
          </div>
          <div style="font-size:10px; color:#64748b; margin-top:4px;">
            ${dateStr} • ${(v.duration || 5).toFixed(1)} ث • ${v.layerCount || 0} طبقات
          </div>
        </div>
        <div>
          ${isCurrent ? '<button disabled class="btn btn-secondary" style="font-size:11px; opacity:0.6;">الحالي</button>' : `<button type="button" class="btn btn-secondary btn-restore-version" data-ver="${v.versionNumber}" style="font-size:11px; border-color:#06b6d4; color:#38bdf8;"><i class="fa-solid fa-clock-rotate-left ml-1"></i> استعادة</button>`}
        </div>
      `;

      const restoreBtn = row.querySelector('.btn-restore-version');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', () => {
          restoreSceneVersion(v);
          closeVersionHistoryModal();
        });
      }

      listEl.appendChild(row);
    });

    modal.classList.add('active');
  }

  function closeVersionHistoryModal() {
    const modal = document.getElementById('modalVersionHistory');
    if (modal) modal.classList.remove('active');
  }

  function restoreSceneVersion(versionRecord) {
    if (!versionRecord || !versionRecord.sceneData) return;
    pushUndoState();
    STATE.scene = JSON.parse(JSON.stringify(versionRecord.sceneData));
    if (projectTitleInput) projectTitleInput.value = STATE.scene.name || 'مشهد مستعاد';
    updateVersionUI();
    renderAll();
    showToast(`✓ تمت استعادة الإصدار v${versionRecord.versionNumber} بنجاح!`, 'success');
  }

  async function updateInPremiere() {
    const currentVer = Number(STATE.scene.versionNumber) || 1;
    const nextVer = currentVer + 1;

    const versions = loadSceneVersions(STATE.scene.id);
    const prevSnapshot = versions.find(v => v.versionNumber === currentVer)?.sceneData || STATE.scene;
    const diff = calculateSceneDiff(prevSnapshot, STATE.scene);

    saveSceneVersionSnapshot(STATE.scene, nextVer, diff);
    STATE.scene.versionNumber = nextVer;
    updateVersionUI();

    showToast(`جارٍ إرسال التحديث (v${nextVer}) إلى Premiere واستبدال المقاطع في التايملاين...`, 'info');

    const sceneJson = JSON.stringify(STATE.scene);
    const contentHash = await computeSha256(sceneJson);

    const payload = {
      scene: STATE.scene,
      version: 2,
      isUpdate: true,
      versionNumber: nextVer,
      previousVersionNumber: currentVer,
      diffSummary: diff,
      contentHash,
      mode: 'editable',
      target: 'track',
      ttl: 86400,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem('mickey_pending_motion_scene_v2', JSON.stringify(payload));
    } catch (_) {}

    try {
      const result = await sendSceneToWorker(payload);
      if (result && result.success) {
        showToast(`✓ تم إرسال التحديث (v${nextVer}) بنجاح إلى Premiere! افتح الإضافة لتأكيد استبدال المقاطع.`, 'success');
      } else {
        showToast(`تم حفظ التحديث محلياً (v${nextVer}). افتح الإضافة لاستلامه.`, 'warning');
      }
    } catch (err) {
      showToast(`تم حفظ التحديث محلياً (v${nextVer}). ${err.message}`, 'warning');
    }
  }

  async function checkUrlForSceneId() {
    try {
      const params = new URLSearchParams(window.location.search);
      const sceneId = params.get('sceneId');
      if (!sceneId) return;

      showToast(`جارٍ تحميل المشهد المطلوب (${sceneId})…`, 'info');

      // 1. Check local scene versions / draft
      const versions = loadSceneVersions(sceneId);
      if (versions.length > 0 && versions[0].sceneData) {
        STATE.scene = JSON.parse(JSON.stringify(versions[0].sceneData));
        if (projectTitleInput) projectTitleInput.value = STATE.scene.name || 'مشهد مستورد';
        updateVersionUI();
        renderAll();
        showToast(`✓ تم فتح المشهد (${STATE.scene.name}) للتعديل (v${STATE.scene.versionNumber || 1})!`, 'success');
        return;
      }

      // 2. Fetch from Worker API pollMotionScene with sceneId
      try {
        const headers = await getMotionAuthHeaders();
        const res = await fetch(`${getMotionWorkerUrl()}/api?action=motion_scene_poll&sceneId=${encodeURIComponent(sceneId)}`, { headers });
        const data = await res.json();
        if (data && data.success && data.scene) {
          STATE.scene = data.scene;
          STATE.scene.id = data.sceneId || sceneId;
          STATE.scene.versionNumber = data.versionNumber || data.version || 1;
          if (projectTitleInput) projectTitleInput.value = STATE.scene.name || 'مشهد مستورد';
          saveSceneVersionSnapshot(STATE.scene, STATE.scene.versionNumber, 'تم فتحه من بريمير');
          updateVersionUI();
          renderAll();
          showToast(`✓ تم فتح المشهد (${STATE.scene.name}) للتعديل (v${STATE.scene.versionNumber})!`, 'success');
          return;
        }
      } catch (workerErr) {
        console.warn('Worker scene fetch notice:', workerErr);
      }

      // 3. Fallback: check pending localStorage scene
      try {
        const raw = localStorage.getItem('mickey_pending_motion_scene_v2');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.scene && (parsed.scene.id === sceneId || parsed.sceneId === sceneId)) {
            STATE.scene = parsed.scene;
            STATE.scene.id = sceneId;
            STATE.scene.versionNumber = parsed.versionNumber || 1;
            if (projectTitleInput) projectTitleInput.value = STATE.scene.name || 'مشهد مستورد';
            updateVersionUI();
            renderAll();
            showToast(`✓ تم استرداد المشهد (${STATE.scene.name}) محلياً!`, 'success');
          }
        }
      } catch (_) {}
    } catch (e) {
      console.warn('checkUrlForSceneId error:', e);
    }
  }

  // -----------------------------------------------------------------
  // 19. KEYBOARD SHORTCUTS CONTROLLER
  // -----------------------------------------------------------------
  function initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't intercept if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

      // Space: Play / Pause
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
        return;
      }

      // Ctrl + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl + Y or Ctrl + Shift + Z: Redo
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl + D: Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelectedLayer();
        return;
      }

      // Delete / Backspace: Delete layer
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedLayer();
        return;
      }

      // K: Add Keyframe
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        addKeyframeAtPlayhead();
        return;
      }

      // Arrow keys: Nudge
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const layer = getSelectedLayer();
        if (!layer) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft') layer.transform.x -= step;
        if (e.key === 'ArrowRight') layer.transform.x += step;
        if (e.key === 'ArrowUp') layer.transform.y -= step;
        if (e.key === 'ArrowDown') layer.transform.y += step;
        renderCanvasFrame();
        updatePropertiesPanel();
        scheduleAutoSave();
        return;
      }

      // Ctrl + A: Select All
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        STATE.selectedLayerIds = STATE.scene.layers.map(l => l.id);
        renderAll();
        return;
      }

      // Ctrl + 0: Fit Viewport
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        STATE.zoomLevel = 'fit';
        canvasZoomSelector.value = 'fit';
        STATE.panX = 0;
        STATE.panY = 0;
        updateViewportTransform();
        return;
      }

      // ?: Help overlay
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        modalShortcuts.classList.toggle('active');
        return;
      }
    });
  }

  // -----------------------------------------------------------------
  // 20. MASTER RENDER & WIRE-UP
  // -----------------------------------------------------------------
  function renderAll() {
    updateViewportTransform();
    renderCanvasFrame();
    renderLayersPanel();
    renderTimelineTracks();
    updatePropertiesPanel();
    renderSceneTabs();
  }

  function initUIListeners() {
    // Top bar actions
    btnUndo.addEventListener('click', undo);
    btnRedo.addEventListener('click', redo);
    btnPlayPause.addEventListener('click', togglePlayPause);
    btnStopTimeline.addEventListener('click', () => {
      pause();
      STATE.currentTime = 0;
      STATE.triggeredSFXTimes.clear();
      syncBgMusicTime();
      renderAll();
    });

    projectTitleInput.addEventListener('change', () => {
      pushUndo();
      STATE.scene.name = projectTitleInput.value.trim() || 'مشهد موشن';
      renderSceneTabs();
    });

    aspectPresetSelector.addEventListener('change', (e) => {
      const val = e.target.value;
      pushUndo();
      if (val === '16:9') { STATE.scene.width = 1920; STATE.scene.height = 1080; }
      else if (val === '9:16') { STATE.scene.width = 1080; STATE.scene.height = 1920; }
      else if (val === '1:1') { STATE.scene.width = 1080; STATE.scene.height = 1080; }
      else if (val === '4:5') { STATE.scene.width = 1080; STATE.scene.height = 1350; }
      else if (val === 'custom') {
        modalCustomAspect.classList.add('active');
        return;
      }
      renderAll();
    });

    document.getElementById('btnApplyCustomAspect').addEventListener('click', () => {
      pushUndo();
      STATE.scene.width = parseInt(document.getElementById('customWInput').value) || 1920;
      STATE.scene.height = parseInt(document.getElementById('customHInput').value) || 1080;
      STATE.scene.fps = parseInt(document.getElementById('customFpsInput').value) || 30;
      STATE.scene.duration = parseFloat(document.getElementById('customDurInput').value) || 5.0;
      modalCustomAspect.classList.remove('active');
      renderAll();
      showToast('تم تطبيق المقاس المخصص', 'success');
    });

    canvasZoomSelector.addEventListener('change', (e) => {
      STATE.zoomLevel = e.target.value;
      STATE.panX = 0;
      STATE.panY = 0;
      updateViewportTransform();
    });

    // Toggle Buttons
    btnToggleSnap.addEventListener('click', () => {
      STATE.snapEnabled = !STATE.snapEnabled;
      btnToggleSnap.classList.toggle('active', STATE.snapEnabled);
      showToast(STATE.snapEnabled ? 'تم تفعيل المحاذاة الذكية' : 'تم تعطيل المحاذاة الذكية', 'info');
    });

    btnToggleGrid.addEventListener('click', () => {
      STATE.gridEnabled = !STATE.gridEnabled;
      btnToggleGrid.classList.toggle('active', STATE.gridEnabled);
      gridOverlay.classList.toggle('active', STATE.gridEnabled);
    });

    btnToggleSafeZone.addEventListener('click', () => {
      STATE.safeZoneEnabled = !STATE.safeZoneEnabled;
      btnToggleSafeZone.classList.toggle('active', STATE.safeZoneEnabled);
      safeZoneOverlay.classList.toggle('active', STATE.safeZoneEnabled);
    });

    btnToggleCheckerboard.addEventListener('click', () => {
      STATE.checkerboardEnabled = !STATE.checkerboardEnabled;
      btnToggleCheckerboard.classList.toggle('active', STATE.checkerboardEnabled);
      canvasCheckerWrap.className = STATE.checkerboardEnabled ? 'canvas-checkerboard' : '';
    });

    // Alignment buttons
    btnAlignLeft.addEventListener('click', () => alignSelectedLayer('left'));
    btnAlignCenterH.addEventListener('click', () => alignSelectedLayer('centerH'));
    btnAlignRight.addEventListener('click', () => alignSelectedLayer('right'));
    btnAlignTop.addEventListener('click', () => alignSelectedLayer('top'));
    btnAlignCenterV.addEventListener('click', () => alignSelectedLayer('centerV'));
    btnAlignBottom.addEventListener('click', () => alignSelectedLayer('bottom'));
    btnDuplicateLayer.addEventListener('click', duplicateSelectedLayer);
    btnGroupLayers.addEventListener('click', groupSelectedLayers);
    btnStaggerLayers.addEventListener('click', () => modalStagger.classList.add('active'));
    btnDeleteLayer.addEventListener('click', deleteSelectedLayer);

    // Stagger Modal apply
    btnApplyStagger.addEventListener('click', () => {
      const off = parseFloat(staggerOffsetInput.value) || 0.2;
      staggerSelectedLayers(off);
    });

    // Multi-Scene Timeline bar
    btnAddSceneBtn.addEventListener('click', addNewScene);
    btnPlayAllScenes.addEventListener('click', togglePlayAllScenes);
    sceneTransitionSelector.addEventListener('change', () => {
      pushUndo();
      let tr = STATE.project.transitions.find(t => t.fromSceneId === STATE.scene.id);
      if (!tr && STATE.project.scenes.length > 1) {
        const idx = STATE.activeSceneIndex;
        const nextScene = STATE.project.scenes[(idx + 1) % STATE.project.scenes.length];
        tr = { fromSceneId: STATE.scene.id, toSceneId: nextScene.id, type: 'fade', duration: 0.5 };
        STATE.project.transitions.push(tr);
      }
      if (tr) tr.type = sceneTransitionSelector.value;
      scheduleAutoSave();
    });
    sceneTransitionDur.addEventListener('input', () => {
      let tr = STATE.project.transitions.find(t => t.fromSceneId === STATE.scene.id);
      if (tr) tr.duration = parseFloat(sceneTransitionDur.value) || 0.5;
      scheduleAutoSave();
    });

    // Image file upload input listener
    imageFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageUpload(e.target.files[0], imageFileInput.dataset.mode === 'replace');
      }
      imageFileInput.value = '';
    });

    // Left Panel Tabs
    tabBtnLayers.addEventListener('click', () => {
      tabBtnLayers.classList.add('active');
      tabBtnPresets.classList.remove('active');
      tabBtnTemplates.classList.remove('active');
      if (tabBtnAi) tabBtnAi.classList.remove('active');
      layersTabView.style.display = 'flex';
      presetsTabView.style.display = 'none';
      templatesTabView.style.display = 'none';
      if (aiTabView) aiTabView.style.display = 'none';
    });

    tabBtnPresets.addEventListener('click', () => {
      tabBtnPresets.classList.add('active');
      tabBtnLayers.classList.remove('active');
      tabBtnTemplates.classList.remove('active');
      if (tabBtnAi) tabBtnAi.classList.remove('active');
      presetsTabView.style.display = 'flex';
      layersTabView.style.display = 'none';
      templatesTabView.style.display = 'none';
      if (aiTabView) aiTabView.style.display = 'none';
    });

    tabBtnTemplates.addEventListener('click', () => {
      tabBtnTemplates.classList.add('active');
      tabBtnLayers.classList.remove('active');
      tabBtnPresets.classList.remove('active');
      if (tabBtnAi) tabBtnAi.classList.remove('active');
      templatesTabView.style.display = 'flex';
      layersTabView.style.display = 'none';
      presetsTabView.style.display = 'none';
      if (aiTabView) aiTabView.style.display = 'none';
    });

    if (tabBtnAi) {
      tabBtnAi.addEventListener('click', () => {
        tabBtnAi.classList.add('active');
        tabBtnLayers.classList.remove('active');
        tabBtnPresets.classList.remove('active');
        tabBtnTemplates.classList.remove('active');
        if (aiTabView) aiTabView.style.display = 'flex';
        layersTabView.style.display = 'none';
        presetsTabView.style.display = 'none';
        templatesTabView.style.display = 'none';
        fetchMotionQuotas();
      });
    }

    // Presets Filter Buttons
    document.querySelectorAll('.preset-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-filter-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
        btn.classList.add('active', 'btn-primary');
        renderPresetsList(btn.dataset.filter);
      });
    });

    layerSearchInput.addEventListener('input', renderLayersPanel);

    // Add Layer Dropdown
    btnAddLayerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = addLayerDropdown.style.display === 'block';
      addLayerDropdown.style.display = open ? 'none' : 'block';
    });

    document.querySelectorAll('.layer-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        addNewLayer(item.dataset.type);
        addLayerDropdown.style.display = 'none';
      });
    });

    window.addEventListener('click', () => {
      addLayerDropdown.style.display = 'none';
    });

    // Brand Kit, Templates Browser & Music Controls
    initBrandKitListeners();
    initTemplateBrowserListeners();
    initMusicControlsListeners();
    initAiAssistantListeners();

    // Timeline Zoom & Keyframes
    document.getElementById('btnZoomInTimeline').addEventListener('click', () => {
      STATE.timelineZoom = Math.min(3.0, STATE.timelineZoom + 0.25);
      renderTimelineTracks();
    });
    document.getElementById('btnZoomOutTimeline').addEventListener('click', () => {
      STATE.timelineZoom = Math.max(0.5, STATE.timelineZoom - 0.25);
      renderTimelineTracks();
    });
    document.getElementById('btnZoomFitTimeline').addEventListener('click', () => {
      STATE.timelineZoom = 1.0;
      renderTimelineTracks();
    });
    document.getElementById('btnAddKeyframe').addEventListener('click', addKeyframeAtPlayhead);

    // Modals
    btnShortcutsHelp.addEventListener('click', () => modalShortcuts.classList.add('active'));
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modalShortcuts.classList.remove('active');
        modalCustomAspect.classList.remove('active');
        modalStagger.classList.remove('active');
        if (modalBrandKit) modalBrandKit.classList.remove('active');
        if (modalSaveTemplate) modalSaveTemplate.classList.remove('active');
        if (modalShareTemplate) modalShareTemplate.classList.remove('active');
        const modalSend = document.getElementById('modalSendPremiere');
        if (modalSend) modalSend.classList.remove('active');
        const modalVersion = document.getElementById('modalVersionHistory');
        if (modalVersion) modalVersion.classList.remove('active');
      });
    });

    // Version History & Update in Premiere Buttons
    const btnVersionHistory = document.getElementById('btnVersionHistory');
    const btnCloseVersionHistory = document.getElementById('btnCloseVersionHistory');
    const btnUpdatePremiere = document.getElementById('btnUpdatePremiere');
    const btnSendAsUpdate = document.getElementById('btnSendAsUpdate');

    if (btnVersionHistory) btnVersionHistory.addEventListener('click', openVersionHistoryModal);
    if (btnCloseVersionHistory) btnCloseVersionHistory.addEventListener('click', closeVersionHistoryModal);
    if (btnUpdatePremiere) btnUpdatePremiere.addEventListener('click', updateInPremiere);
    if (btnSendAsUpdate) btnSendAsUpdate.addEventListener('click', () => {
      closeSendPremiereModal();
      updateInPremiere();
    });

    // Send to Premiere Modal Buttons
    const btnConfirmSendPremiere = document.getElementById('btnConfirmSendPremiere');
    const btnCancelSendPremiere = document.getElementById('btnCancelSendPremiere');
    const btnCloseSendPremiere = document.getElementById('btnCloseSendPremiere');
    if (btnConfirmSendPremiere) btnConfirmSendPremiere.addEventListener('click', confirmSendPremiere);
    if (btnCancelSendPremiere) btnCancelSendPremiere.addEventListener('click', closeSendPremiereModal);
    if (btnCloseSendPremiere) btnCloseSendPremiere.addEventListener('click', closeSendPremiereModal);

    // Export & Send
    btnExportScene.addEventListener('click', exportSceneJSON);
    btnSendPremiere.addEventListener('click', sendToPremiere);

    // Window resize
    window.addEventListener('resize', () => {
      updateViewportTransform();
      renderTimelineRuler();
    });
  }

  // -----------------------------------------------------------------
  // 21. INITIALIZATION ON DOM READY
  // -----------------------------------------------------------------
  async function init() {
    tryRestoreDraft();
    initUIListeners();
    initCanvasInteractions();
    initTimeRulerScrubbing();
    initPropertyInputs();
    initKeyboardShortcuts();
    initFirebaseAuth();
    await loadBrandKit();
    await loadPresetsLibrary();
    await loadTemplatesIndex();
    checkUrlForSharedTemplate();
    fetchMotionQuotas();
    updateVersionUI();
    await checkUrlForSceneId();

    // Ensure fonts loaded
    if (window.MotionEngine) {
      try {
        await MotionEngine.ensureFontsLoaded(['Cairo', 'Tajawal', 'Almarai', 'Noto Kufi Arabic', 'Readex Pro', 'Inter'], 2500);
      } catch (err) {
        console.warn('Font loading notice:', err);
      }
    }

    renderAll();
    initMobileSimplifiedMode();
  }

  // -----------------------------------------------------------------
  // 22. SIMPLIFIED MOBILE PHONE MODE ("Preview + Edit Text/Colors Only")
  // -----------------------------------------------------------------
  let isMobileSimplifiedMode = false;

  function toggleMobileSimplifiedMode(force) {
    isMobileSimplifiedMode = typeof force === 'boolean' ? force : !isMobileSimplifiedMode;

    const container = document.getElementById('motionMobileSimplifiedContainer');
    const desktopWorkspace = document.querySelector('.workspace-body');
    const desktopTimeline = document.querySelector('.panel-timeline');
    const toggleBtn = document.getElementById('btnToggleMobileMode');
    const toggleText = document.getElementById('mobileModeToggleText');
    const canvas = document.getElementById('mainCanvas');
    const mobileDock = document.getElementById('mobileCanvasDock');
    const desktopDock = document.getElementById('canvasCheckerWrap');

    if (isMobileSimplifiedMode) {
      if (container) container.style.display = 'flex';
      if (desktopWorkspace) desktopWorkspace.style.display = 'none';
      if (desktopTimeline) desktopTimeline.style.display = 'none';
      if (toggleText) toggleText.textContent = 'الوضع المتقدم (المكتبي)';
      if (toggleBtn) toggleBtn.classList.add('active');

      if (canvas && mobileDock && canvas.parentNode !== mobileDock) {
        mobileDock.appendChild(canvas);
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = '100%';
        canvas.style.objectFit = 'contain';
      }

      renderMobileSimplifiedControls();
    } else {
      if (container) container.style.display = 'none';
      if (desktopWorkspace) desktopWorkspace.style.display = 'grid';
      if (desktopTimeline) desktopTimeline.style.display = 'flex';
      if (toggleText) toggleText.textContent = 'وضع الهاتف المبسط';
      if (toggleBtn) toggleBtn.classList.remove('active');

      if (canvas && desktopDock && canvas.parentNode !== desktopDock) {
        desktopDock.appendChild(canvas);
        canvas.style.maxWidth = '';
        canvas.style.maxHeight = '';
        canvas.style.objectFit = '';
      }
      updateViewportTransform();
    }
  }

  function renderMobileSimplifiedControls() {
    const textList = document.getElementById('mobileTextLayersList');
    const colorList = document.getElementById('mobileColorControlsList');
    if (!textList || !colorList || !activeScene) return;

    // 1. Text Layers
    textList.innerHTML = '';
    const textLayers = (activeScene.layers || []).filter(l => l.type === 'text' || l.content?.text);
    if (textLayers.length === 0) {
      textList.innerHTML = '<div style="font-size:11px; color:#A1A1AA; text-align:center; padding:10px;">لا توجد نصوص في هذا المشهد</div>';
    } else {
      textLayers.forEach((l, idx) => {
        const card = document.createElement('div');
        card.style = 'background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:6px;';
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:11px; font-weight:700; color:#38bdf8;">${l.name || ('نص ' + (idx + 1))}</span>
            <span style="font-size:9px; font-family:\'JetBrains Mono\', monospace; color:#A1A1AA;">${l.style?.fontFamily || 'Cairo'}</span>
          </div>
          <input type="text" class="mobile-text-input form-input" value="${l.content?.text || ''}" style="width:100%; font-size:12px; padding:8px 10px; border-radius:6px; background:#09090b; color:#fff;" placeholder="اكتب النص هنا...">
        `;
        const inp = card.querySelector('.mobile-text-input');
        inp.addEventListener('input', () => {
          if (!l.content) l.content = {};
          l.content.text = inp.value;
          renderCanvasFrame();
          scheduleAutoSave();
        });
        textList.appendChild(card);
      });
    }

    // 2. Color Controls
    colorList.innerHTML = '';
    const bgCard = document.createElement('div');
    bgCard.style = 'display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px;';
    bgCard.innerHTML = `
      <span style="font-size:11px; font-weight:600; color:#fff;">لون خلفية المشهد</span>
      <input type="color" class="mobile-bg-color-picker" value="${activeScene.background?.color || '#09090b'}" style="width:40px; height:30px; border-radius:6px; cursor:pointer; background:none; border:none;">
    `;
    const bgPicker = bgCard.querySelector('.mobile-bg-color-picker');
    bgPicker.addEventListener('input', () => {
      if (!activeScene.background) activeScene.background = { type: 'color', color: '#09090b' };
      activeScene.background.color = bgPicker.value;
      renderCanvasFrame();
      scheduleAutoSave();
    });
    colorList.appendChild(bgCard);

    textLayers.forEach((l, idx) => {
      const colCard = document.createElement('div');
      colCard.style = 'display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px;';
      colCard.innerHTML = `
        <span style="font-size:11px; font-weight:600; color:#fff;">لون ${l.name || ('نص ' + (idx + 1))}</span>
        <input type="color" class="mobile-fill-color-picker" value="${l.style?.fill || '#ffffff'}" style="width:40px; height:30px; border-radius:6px; cursor:pointer; background:none; border:none;">
      `;
      const fillPicker = colCard.querySelector('.mobile-fill-color-picker');
      fillPicker.addEventListener('input', () => {
        if (!l.style) l.style = {};
        l.style.fill = fillPicker.value;
        renderCanvasFrame();
        scheduleAutoSave();
      });
      colorList.appendChild(colCard);
    });

    const scrubber = document.getElementById('mobileTimelineScrubber');
    if (scrubber) {
      scrubber.max = String(activeScene.duration || 5);
      scrubber.value = String(currentTime || 0);
    }
    updateMobileTimecode();
  }

  function initMobileSimplifiedMode() {
    const toggleBtn = document.getElementById('btnToggleMobileMode');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => toggleMobileSimplifiedMode());
    }

    const playPauseBtn = document.getElementById('btnMobilePlayPause');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        togglePlayPause();
        const icon = playPauseBtn.querySelector('i');
        if (icon) icon.className = isPlaying ? 'fa-solid fa-pause text-xs' : 'fa-solid fa-play text-xs';
      });
    }

    const scrubber = document.getElementById('mobileTimelineScrubber');
    if (scrubber) {
      scrubber.addEventListener('input', () => {
        currentTime = parseFloat(scrubber.value) || 0;
        renderCanvasFrame();
        updateMobileTimecode();
      });
    }

    const btnMobUpdate = document.getElementById('btnMobileUpdatePremiere');
    if (btnMobUpdate) {
      btnMobUpdate.addEventListener('click', () => {
        const btnMainUpdate = document.getElementById('btnUpdatePremiere');
        if (btnMainUpdate) btnMainUpdate.click();
      });
    }

    const btnMobSend = document.getElementById('btnMobileSendPremiere');
    if (btnMobSend) {
      btnMobSend.addEventListener('click', () => {
        const btnMainSend = document.getElementById('btnSendPremiere');
        if (btnMainSend) btnMainSend.click();
      });
    }

    if (window.innerWidth <= 640) {
      toggleMobileSimplifiedMode(true);
    }
  }

  function updateMobileTimecode() {
    const disp = document.getElementById('mobileTimecodeDisplay');
    if (disp) {
      const cur = formatTime(currentTime);
      const total = formatTime(activeScene?.duration || 5);
      disp.textContent = `${cur} / ${total}`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
