/**
 * Mickey Studio - Online Media Studio & AutoCut Suite Editor
 * Full-featured Web Studio Editor:
 * - Live Video & Canvas Preview Stage with Subtitle Rendering
 * - Animated Captions Editor (Karaoke Word Glow, Pop-in, Arabic Fonts, Colors, Timings)
 * - Real-time Audio Cleanup Studio (Web Audio API Denoise, De-reverb, Vocal Clarity, A/B Comparison Switch)
 * - Smart Silence Cut & Auto-Zoom Suite
 * - Multi-Format Export (Premiere Pro XML, Transparent Video, SRT, VTT, MP4)
 */
(function (root) {
  'use strict';

  const SFX = (window.MickeyStudio && window.MickeyStudio.SFX) || {
    playClick: () => {},
    playSuccess: () => {},
    playError: () => {}
  };
  const showToast = (window.MickeyStudio && window.MickeyStudio.showToast) || ((msg) => console.log(msg));

  // Default sample subtitles for instant demonstration
  const SAMPLE_SUBTITLES = [
    {
      id: 1,
      start: 0.2,
      end: 2.8,
      text: "مرحباً بكم في استوديو ميكي الذكي",
      words: [
        { text: "مرحباً", start: 0.2, end: 0.7 },
        { text: "بكم", start: 0.8, end: 1.2 },
        { text: "في", start: 1.3, end: 1.5 },
        { text: "استوديو", start: 1.6, end: 2.2 },
        { text: "ميكي", start: 2.3, end: 2.5 },
        { text: "الذكي", start: 2.6, end: 2.8 }
      ]
    },
    {
      id: 2,
      start: 3.1,
      end: 5.6,
      text: "تحرير الكابشنز وتنقية الصوت في واجهة واحدة",
      words: [
        { text: "تحرير", start: 3.1, end: 3.6 },
        { text: "الكابشنز", start: 3.7, end: 4.3 },
        { text: "وتنقية", start: 4.4, end: 4.8 },
        { text: "الصوت", start: 4.9, end: 5.6 }
      ]
    },
    {
      id: 3,
      start: 6.0,
      end: 8.5,
      text: "تصدير فوري لبريمير برو وجميع المنصات",
      words: [
        { text: "تصدير", start: 6.0, end: 6.5 },
        { text: "فوري", start: 6.6, end: 7.1 },
        { text: "لبريمير", start: 7.2, end: 7.7 },
        { text: "برو", start: 7.8, end: 8.5 }
      ]
    }
  ];

  // Editor Internal State
  const STATE = {
    mode: 'captions',
    mediaFile: null,
    mediaUrl: '',
    mediaType: 'video', // 'video' | 'audio'
    duration: 8.5,
    currentTime: 0,
    isPlaying: false,
    aspectRatio: '16:9', // '16:9' | '9:16'
    
    // Captions styling & settings
    captions: {
      // Demo captions are loaded only when the user selects the demo sample.
      items: [],
      font: 'Cairo',
      fontSize: 32,
      textColor: '#ffffff',
      glowColor: '#38bdf8', // Neon Cyan
      strokeColor: '#000000',
      strokeWidth: 4,
      animation: 'karaoke', // 'karaoke' | 'pop' | 'clean'
      position: 'bottom', // 'bottom' | 'center' | 'top'
      bgPill: true,
      pillColor: 'rgba(15, 23, 42, 0.75)'
    },

    // Audio Cleanup Settings & WebAudio Nodes
    audio: {
      denoise: 75, // 0 - 100 %
      dereverb: 50, // 0 - 100 %
      clarity: 65, // 0 - 100 %
      previewMode: 'clean', // 'clean' (studio enhanced) | 'original' (raw)
      isAudioInitialized: false,
      audioCtx: null,
      sourceNode: null,
      bassFilter: null,
      presenceFilter: null,
      airFilter: null,
      compressor: null,
      dryGain: null,
      wetGain: null
    },

    // Silence Cut Settings
    silence: {
      threshold: -35, // dB
      padding: 150, // ms
      cuts: [],
      envelope: [],
      samples: [],
      analyzed: false
    },

    // Auto-Zoom Settings
    zoom: {
      level: 1.25,
      interval: 4
    },
    muteRanges: [],
    viralClips: [],
    selectedViralClip: null,
    exportRange: null
  };

  /**
   * Initializes the Online Media Editor
   */
  function init() {
    bindEventListeners();
    initCanvasRenderer();
    updateSilenceCutCalculations();
  }

  /**
   * Sets the active tool mode ('captions', 'audio-clean', 'silence-cut', 'auto-zoom')
   */
  function setMode(newMode) {
    if (!newMode) return;
    const validModes = ['captions', 'audio-clean', 'silence-cut', 'auto-zoom', 'word-mute', 'viral-clips', 'yt-chapters'];
    if (!validModes.includes(newMode)) return;
    STATE.mode = newMode;
    SFX.playClick();

    // Update Tab Navigation Pills
    document.querySelectorAll('.media-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === newMode);
    });

    // Update Sub-Panels
    document.querySelectorAll('.media-tool-panel').forEach(panel => {
      panel.classList.add('hidden');
    });
    const activePanel = document.getElementById(`media-panel-${newMode}`);
    if (activePanel) {
      activePanel.classList.remove('hidden');
    }

    // Update Header Badge
    const badgeEl = document.getElementById('media-editor-badge');
    if (badgeEl) {
      const modeData = {
        'captions': { title: '💬 الكابشنز المتحركة', class: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
        'audio-clean': { title: '✨ تحسين نبرة الصوت', class: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
        'silence-cut': { title: '✂️ قص السكتات والوقفات', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
        'auto-zoom': { title: '🔍 الزووم السينمائي', class: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
        'word-mute': { title: '🔇 حجب الكلمات', class: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
        'viral-clips': { title: '🔥 اقتراح المقاطع', class: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
        'yt-chapters': { title: '🔖 فصول يوتيوب', class: 'bg-red-500/10 text-red-400 border-red-500/20' }
      };
      const info = modeData[newMode] || modeData['captions'];
      badgeEl.textContent = info.title;
      badgeEl.className = `px-3 py-1 rounded-full text-xs font-bold border transition-colors ${info.class}`;
    }

    // Re-render
    renderSubtitlesList();
    updateWaveformDisplay();
  }

  /**
   * Binds UI events and controls
   */
  function bindEventListeners() {
    // Mode Switchers
    document.querySelectorAll('.media-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const mode = btn.getAttribute('data-mode');
        setMode(mode);
      });
    });

    // File Input Dropzone
    const fileInput = document.getElementById('media-editor-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          loadMediaFile(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    // Drag and Drop
    const dropzone = document.getElementById('media-upload-dropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-teal-400', 'bg-teal-950/20');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-teal-400', 'bg-teal-950/20');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-teal-400', 'bg-teal-950/20');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          loadMediaFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Playback Controls
    const video = document.getElementById('media-editor-video');
    const playBtn = document.getElementById('btn-media-play');
    if (playBtn && video) {
      playBtn.addEventListener('click', togglePlayback);
    }
    if (video) {
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('ended', () => {
        STATE.isPlaying = false;
        updatePlayButton();
      });
    }

    // Timeline Scrubber
    const scrubber = document.getElementById('media-timeline-scrubber');
    if (scrubber && video) {
      scrubber.addEventListener('input', (e) => {
        const time = (parseFloat(e.target.value) / 100) * (video.duration || STATE.duration);
        video.currentTime = time;
        STATE.currentTime = time;
        drawCaptionsFrame(time);
      });
    }

    // Aspect Ratio Switcher (16:9 / 9:16)
    document.querySelectorAll('.aspect-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ratio = btn.getAttribute('data-ratio');
        setAspectRatio(ratio);
      });
    });

    // Captions Form Controls
    const fontSelect = document.getElementById('caption-font-family');
    if (fontSelect) {
      fontSelect.addEventListener('change', (e) => {
        STATE.captions.font = e.target.value;
        drawCaptionsFrame(STATE.currentTime);
      });
    }

    const sizeInput = document.getElementById('caption-font-size');
    if (sizeInput) {
      sizeInput.addEventListener('input', (e) => {
        STATE.captions.fontSize = parseInt(e.target.value, 10);
        const valEl = document.getElementById('caption-font-size-val');
        if (valEl) valEl.textContent = `${e.target.value}px`;
        drawCaptionsFrame(STATE.currentTime);
      });
    }

    const glowColorInput = document.getElementById('caption-glow-color');
    if (glowColorInput) {
      glowColorInput.addEventListener('input', (e) => {
        STATE.captions.glowColor = e.target.value;
        drawCaptionsFrame(STATE.currentTime);
      });
    }

    const textColorInput = document.getElementById('caption-text-color');
    if (textColorInput) {
      textColorInput.addEventListener('input', (e) => {
        STATE.captions.textColor = e.target.value;
        drawCaptionsFrame(STATE.currentTime);
      });
    }

    document.querySelectorAll('.caption-anim-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.caption-anim-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STATE.captions.animation = btn.getAttribute('data-anim');
        drawCaptionsFrame(STATE.currentTime);
      });
    });

    // Audio Cleanup Sliders
    const denoiseSlider = document.getElementById('audio-denoise-slider');
    if (denoiseSlider) {
      denoiseSlider.addEventListener('input', (e) => {
        STATE.audio.denoise = parseInt(e.target.value, 10);
        const valEl = document.getElementById('audio-denoise-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        applyAudioFilterParams();
      });
    }

    const dereverbSlider = document.getElementById('audio-dereverb-slider');
    if (dereverbSlider) {
      dereverbSlider.addEventListener('input', (e) => {
        STATE.audio.dereverb = parseInt(e.target.value, 10);
        const valEl = document.getElementById('audio-dereverb-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        applyAudioFilterParams();
      });
    }

    const claritySlider = document.getElementById('audio-clarity-slider');
    if (claritySlider) {
      claritySlider.addEventListener('input', (e) => {
        STATE.audio.clarity = parseInt(e.target.value, 10);
        const valEl = document.getElementById('audio-clarity-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        applyAudioFilterParams();
      });
    }

    // Audio A/B Mode Toggle Button
    const btnAudioAB = document.getElementById('btn-audio-ab-toggle');
    if (btnAudioAB) {
      btnAudioAB.addEventListener('click', toggleAudioABComparison);
    }

    // Silence Cut Sliders
    const silenceSlider = document.getElementById('silence-threshold-slider');
    if (silenceSlider) {
      silenceSlider.addEventListener('input', (e) => {
        STATE.silence.threshold = parseInt(e.target.value, 10);
        const valEl = document.getElementById('silence-threshold-val');
        if (valEl) valEl.textContent = `${e.target.value} dB`;
        STATE.silence.analyzed = false;
        STATE.silence.cuts = [];
        updateSilenceCutCalculations();
      });
    }

    const analyzeSilenceBtn = document.getElementById('btn-analyze-silence');
    if (analyzeSilenceBtn) analyzeSilenceBtn.addEventListener('click', analyzeSilence);

    // Keyboard Shortcuts (Space toggles play/pause)
    window.addEventListener('keydown', (e) => {
      const activeSection = document.getElementById('section-autocut-suite');
      if (!activeSection || activeSection.classList.contains('hidden')) return;
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        togglePlayback();
      }
    });
  }

  /**
   * Loads a media file into the editor stage
   */
  function loadMediaFile(file) {
    if (!file) return;
    SFX.playClick();

    STATE.mediaFile = file;
    STATE.mediaType = file.type && file.type.startsWith('audio') ? 'audio' : 'video';
    STATE.captions.items = [];
    STATE.silence.cuts = [];
    STATE.silence.envelope = [];
    STATE.silence.samples = [];
    STATE.silence.analyzed = false;
    updateSilenceCutCalculations();
    STATE.currentTime = 0;
    STATE.isPlaying = false;
    if (STATE.mediaUrl) URL.revokeObjectURL(STATE.mediaUrl);
    STATE.mediaUrl = URL.createObjectURL(file);

    const video = document.getElementById('media-editor-video');
    if (video) {
      video.pause();
      video.srcObject = null;
      video.src = STATE.mediaUrl;
      video.load();
    }
    renderSubtitlesList();

    // Update UI View
    const dropzone = document.getElementById('media-upload-dropzone');
    const stage = document.getElementById('media-player-container');
    const fileNameEl = document.getElementById('media-filename-display');
    if (dropzone) dropzone.classList.add('hidden');
    if (stage) stage.classList.remove('hidden');
    if (fileNameEl) {
      fileNameEl.textContent = file.name || 'فيديو تم استيراده';
      fileNameEl.title = file.name;
    }

    initWebAudioGraph(video);
    showToast(`تم تحميل الملف بنجاح: ${file.name}`, 'success');
  }

  /**
   * Loads the built-in Interactive Demo Sample Video with pre-configured captions & audio
   */
  function loadDemoSample() {
    SFX.playClick();
    showToast('جاري تجهيز مقطع العرض التوضيحي المباشر…', 'info');
    STATE.mediaFile = null;
    STATE.silence.cuts = [];
    STATE.silence.envelope = [];
    STATE.silence.samples = [];
    STATE.silence.analyzed = false;
    updateSilenceCutCalculations();
    STATE.captions.items = JSON.parse(JSON.stringify(SAMPLE_SUBTITLES));
    renderSubtitlesList();

    // Create an animated canvas video stream
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    let frame = 0;
    function drawDemoBackground() {
      // Luxury dark gradient with moving particle sparkles
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#090b14');
      grad.addColorStop(0.5, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Radial animated spotlight
      const spotX = (canvas.width / 2) + Math.sin(frame * 0.03) * 150;
      const spotY = (canvas.height / 2) + Math.cos(frame * 0.03) * 80;
      const spotGrad = ctx.createRadialGradient(spotX, spotY, 20, spotX, spotY, 400);
      spotGrad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = spotGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Watermark title
      ctx.save();
      ctx.font = 'bold 24px Cairo, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.textAlign = 'center';
      ctx.fillText('Mickey Studio — Online Media Editor Sample', canvas.width / 2, 80);
      ctx.restore();

      frame++;
    }

    // Build synthetic MediaStream
    const stream = canvas.captureStream(30);
    setInterval(drawDemoBackground, 1000 / 30);

    const video = document.getElementById('media-editor-video');
    if (video) {
      video.srcObject = stream;
      video.play().catch(() => {});
      STATE.isPlaying = true;
      updatePlayButton();
    }

    // Show Stage
    const dropzone = document.getElementById('media-upload-dropzone');
    const stage = document.getElementById('media-player-container');
    const fileNameEl = document.getElementById('media-filename-display');
    if (dropzone) dropzone.classList.add('hidden');
    if (stage) stage.classList.remove('hidden');
    if (fileNameEl) fileNameEl.textContent = 'مقطع تجريبي حي (Mickey Demo Reel)';

    STATE.duration = 8.5;
    renderSubtitlesList();
    showToast('تم تحميل مقطع العرض التجريبي! يمكنك الآن تعديل الكابشنز ونسب الصوت حياً.', 'success');
  }

  /**
   * Toggles video playback
   */
  function togglePlayback() {
    const video = document.getElementById('media-editor-video');
    if (!video) return;

    // Resume AudioContext if suspended
    if (STATE.audio.audioCtx && STATE.audio.audioCtx.state === 'suspended') {
      STATE.audio.audioCtx.resume();
    }

    if (video.paused) {
      video.play().then(() => {
        STATE.isPlaying = true;
        updatePlayButton();
      }).catch(() => {});
    } else {
      video.pause();
      STATE.isPlaying = false;
      updatePlayButton();
    }
  }

  function updatePlayButton() {
    const playBtn = document.getElementById('btn-media-play');
    if (!playBtn) return;
    if (STATE.isPlaying) {
      playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      playBtn.title = 'إيقاف مؤقت (Space)';
    } else {
      playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      playBtn.title = 'تشغيل (Space)';
    }
  }

  /**
   * Video Time Update Callback
   */
  function onTimeUpdate(e) {
    const video = e.target;
    STATE.currentTime = video.currentTime;
    STATE.duration = video.duration || STATE.duration || 1;

    // Update timecode display
    const timeEl = document.getElementById('media-timecode-display');
    if (timeEl) {
      timeEl.textContent = `${formatTime(STATE.currentTime)} / ${formatTime(STATE.duration)}`;
    }

    // Update Scrubber
    const scrubber = document.getElementById('media-timeline-scrubber');
    if (scrubber && !scrubber.matches(':active')) {
      const pct = (STATE.currentTime / STATE.duration) * 100;
      scrubber.value = pct;
    }

    // Render Captions
    drawCaptionsFrame(STATE.currentTime);
    highlightActiveSubtitleItem(STATE.currentTime);
  }

  function onLoadedMetadata(e) {
    const video = e.target;
    STATE.duration = video.duration;
    const timeEl = document.getElementById('media-timecode-display');
    if (timeEl) {
      timeEl.textContent = `00:00 / ${formatTime(STATE.duration)}`;
    }
    resizeCaptionCanvas();
    drawCaptionsFrame(0);
  }

  function setAspectRatio(ratio) {
    STATE.aspectRatio = ratio;
    const stage = document.getElementById('media-stage-box');
    if (stage) {
      if (ratio === '9:16') {
        stage.style.aspectRatio = '9 / 16';
        stage.style.maxWidth = '360px';
      } else {
        stage.style.aspectRatio = '16 / 9';
        stage.style.maxWidth = '880px';
      }
    }
    document.querySelectorAll('.aspect-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-ratio') === ratio);
    });
    setTimeout(resizeCaptionCanvas, 100);
  }

  /**
   * Canvas Setup for Subtitle Rendering Over Video
   */
  function initCanvasRenderer() {
    window.addEventListener('resize', resizeCaptionCanvas);
    setTimeout(resizeCaptionCanvas, 200);
  }

  function resizeCaptionCanvas() {
    const canvas = document.getElementById('media-editor-canvas');
    const video = document.getElementById('media-editor-video');
    if (!canvas || !video) return;

    const rect = video.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width * (window.devicePixelRatio || 1);
      canvas.height = rect.height * (window.devicePixelRatio || 1);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      drawCaptionsFrame(STATE.currentTime);
    }
  }

  /**
   * Draws Animated Subtitles onto Canvas Frame
   */
  function drawCaptionsFrame(currentTime) {
    const canvas = document.getElementById('media-editor-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const scale = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find active segment
    const activeSub = STATE.captions.items.find(item => currentTime >= item.start && currentTime <= item.end);
    if (!activeSub) return;

    ctx.save();
    ctx.scale(scale, scale);

    const w = canvas.width / scale;
    const h = canvas.height / scale;

    const fontSize = STATE.captions.fontSize || 32;
    ctx.font = `bold ${fontSize}px ${STATE.captions.font}, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';

    // Calculate Y position
    let posY = h * 0.82; // Bottom default
    if (STATE.captions.position === 'center') posY = h * 0.5;
    if (STATE.captions.position === 'top') posY = h * 0.18;

    // Background Pill Box
    if (STATE.captions.bgPill) {
      const textMetrics = ctx.measureText(activeSub.text);
      const boxW = textMetrics.width + 36;
      const boxH = fontSize * 1.5;
      const boxX = (w / 2) - (boxW / 2);
      const boxY = posY - (boxH / 2);

      ctx.fillStyle = STATE.captions.pillColor || 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 12);
      ctx.fill();
    }

    // Text Outline / Stroke
    if (STATE.captions.strokeWidth > 0) {
      ctx.lineWidth = STATE.captions.strokeWidth;
      ctx.strokeStyle = STATE.captions.strokeColor || '#000000';
      ctx.lineJoin = 'round';
      ctx.strokeText(activeSub.text, w / 2, posY);
    }

    // Animation: Karaoke Word Glow / Pop / Clean
    if (STATE.captions.animation === 'karaoke' && activeSub.words && activeSub.words.length > 0) {
      // Find current word
      const currentWord = activeSub.words.find(word => currentTime >= word.start && currentTime <= word.end);
      
      // Default text fill
      ctx.fillStyle = STATE.captions.textColor || '#ffffff';
      ctx.fillText(activeSub.text, w / 2, posY);

      // If a word is actively being spoken, draw glowing highlight
      if (currentWord) {
        ctx.shadowColor = STATE.captions.glowColor || '#38bdf8';
        ctx.shadowBlur = 18;
        ctx.fillStyle = STATE.captions.glowColor || '#38bdf8';
        ctx.fillText(activeSub.text, w / 2, posY);
      }
    } else {
      ctx.fillStyle = STATE.captions.textColor || '#ffffff';
      ctx.fillText(activeSub.text, w / 2, posY);
    }

    ctx.restore();
  }

  /**
   * Renders the Subtitles List in the Properties Panel
   */
  function renderSubtitlesList() {
    const listContainer = document.getElementById('media-subtitles-list');
    if (!listContainer) return;

    if (!STATE.captions.items || STATE.captions.items.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-8 text-zinc-500 text-xs">
          <i class="fa-solid fa-comment-slash text-xl mb-2 block"></i>
          لا توجد كابشنز حالياً. انقر على "توليد الكابشنز" أو أضف سطراً جديداً.
        </div>
      `;
      return;
    }

    let html = '';
    STATE.captions.items.forEach((item, index) => {
      html += `
        <div class="sub-item-card p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-teal-500/30 transition-all space-y-2" data-sub-id="${item.id}">
          <div class="flex items-center justify-between text-[11px] text-zinc-400">
            <span class="font-mono text-teal-400 font-bold">${formatTime(item.start)} → ${formatTime(item.end)}</span>
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="MickeyMediaStudio.seekToTime(${item.start})" class="p-1 text-zinc-400 hover:text-white" title="الانتقال للوقت"><i class="fa-solid fa-play text-[10px]"></i></button>
              <button type="button" onclick="MickeyMediaStudio.deleteSubtitle(${item.id})" class="p-1 text-zinc-500 hover:text-red-400" title="حذف السطر"><i class="fa-solid fa-trash text-[10px]"></i></button>
            </div>
          </div>
          <input 
            type="text" 
            class="w-full bg-[#090b10] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-teal-400 outline-none"
            value="${escapeHtml(item.text)}" 
            oninput="MickeyMediaStudio.updateSubtitleText(${item.id}, this.value)"
          />
        </div>
      `;
    });

    listContainer.innerHTML = html;
  }

  function highlightActiveSubtitleItem(currentTime) {
    document.querySelectorAll('.sub-item-card').forEach(card => {
      const id = parseInt(card.getAttribute('data-sub-id'), 10);
      const item = STATE.captions.items.find(i => i.id === id);
      if (item && currentTime >= item.start && currentTime <= item.end) {
        card.classList.add('border-teal-400', 'bg-teal-950/20');
      } else {
        card.classList.remove('border-teal-400', 'bg-teal-950/20');
      }
    });
  }

  function updateSubtitleText(id, newText) {
    const item = STATE.captions.items.find(i => i.id === id);
    if (item) {
      item.text = newText;
      drawCaptionsFrame(STATE.currentTime);
    }
  }

  function addSubtitleAtPlayhead() {
    const start = Math.max(0, STATE.currentTime);
    const end = start + 2.5;
    const newId = Date.now();
    STATE.captions.items.push({
      id: newId,
      start,
      end,
      text: "سطر كابشن جديد...",
      words: [{ text: "سطر", start, end }]
    });
    STATE.captions.items.sort((a, b) => a.start - b.start);
    renderSubtitlesList();
    drawCaptionsFrame(STATE.currentTime);
    SFX.playClick();
  }

  function deleteSubtitle(id) {
    STATE.captions.items = STATE.captions.items.filter(i => i.id !== id);
    renderSubtitlesList();
    drawCaptionsFrame(STATE.currentTime);
    SFX.playClick();
  }

  async function generateCaptionsFromMedia() {
    if (!STATE.mediaFile) {
      showToast('ارفع فيديو أو ملفاً صوتياً أولاً لتوليد الكابشنز.', 'warning');
      return false;
    }
    if (window.MickeyStudio?.authorizeAndConsume && !await window.MickeyStudio.authorizeAndConsume('transcription')) return false;
    const button = document.getElementById('btn-generate-media-captions');
    if (button) { button.disabled = true; button.textContent = 'جارٍ تفريغ الكلام…'; }
    try {
      const audioBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split('base64,')[1] || '');
        reader.onerror = () => reject(new Error('تعذر قراءة الملف.'));
        reader.readAsDataURL(STATE.mediaFile);
      });
      const response = await window.MickeyStudio.gatewayFetch('transcribe_audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_base64: audioBase64,
          mime_type: STATE.mediaFile.type || 'application/octet-stream',
          file_name: STATE.mediaFile.name || 'media'
        })
      });
      const result = await response.json().catch(() => ({}));
      if (result?.quota?.tool) window.MickeyStudio.updateQuotaBadge?.(result.quota.tool, result.quota.remaining, result.quota.limit);
      if (!response.ok || !result.success) throw new Error(result.error || 'تعذر تفريغ الكلام من الملف.');
      const segments = Array.isArray(result.segments) ? result.segments : [];
      if (!segments.length) throw new Error('لم يُرجع التفريغ توقيتات للكلام؛ لا يمكن إنشاء كابشنز متزامنة.');
      STATE.captions.items = segments.filter(segment => segment.text && Number.isFinite(Number(segment.start)) && Number.isFinite(Number(segment.end)))
        .map((segment, index) => {
          const words = String(segment.text).trim().split(/\s+/).filter(Boolean);
          const start = Math.max(0, Number(segment.start));
          const end = Math.max(start + 0.1, Number(segment.end));
          return {
            id: Date.now() + index,
            start,
            end,
            text: String(segment.text).trim(),
            words: words.map((word, wordIndex) => ({
              text: word,
              start: start + (end - start) * wordIndex / words.length,
              end: start + (end - start) * (wordIndex + 1) / words.length
            }))
          };
        });
      if (!STATE.captions.items.length) throw new Error('لم يُعثر على كلام قابل للتحويل إلى كابشنز.');
      renderSubtitlesList();
      drawCaptionsFrame(STATE.currentTime);
      showToast(`تم إنشاء ${STATE.captions.items.length} مقطع كابشن بتوقيتات التفريغ.`, 'success');
      return true;
    } catch (error) {
      console.error('[MickeyMediaStudio] caption generation failed:', error);
      showToast(error.message || 'تعذر توليد الكابشنز.', 'error');
      return false;
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i><span>توليد الكابشنز</span>';
      }
    }
  }

  async function ensureCaptionTranscript() {
    if (STATE.captions.items.length) return true;
    return await generateCaptionsFromMedia();
  }

  async function detectAndMuteWords() {
    if (!await ensureCaptionTranscript()) return;
    const text = STATE.captions.items.map(item => item.text).join('\n');
    const button = document.getElementById('btn-detect-censor-words');
    if (button) { button.disabled = true; button.textContent = 'جارٍ كشف الكلمات…'; }
    try {
      const response = await window.MickeyStudio.gatewayFetch('detect_censor_words', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcription: text })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'تعذر فحص الكلمات.');
      const forbidden = new Set((data.words || []).map(word => String(word).toLocaleLowerCase().replace(/[.,!?،؛:()[\]{}"']/g, '').trim()).filter(Boolean));
      const ranges = [];
      for (const item of STATE.captions.items) {
        const words = item.words?.length ? item.words : String(item.text).split(/\s+/).map((word, index, list) => ({
          text: word,
          start: item.start + (item.end - item.start) * index / list.length,
          end: item.start + (item.end - item.start) * (index + 1) / list.length
        }));
        for (const word of words) {
          const normalized = String(word.text).toLocaleLowerCase().replace(/[.,!?،؛:()[\]{}"']/g, '').trim();
          if (forbidden.has(normalized)) ranges.push({ start: Math.max(0, word.start - 0.04), end: Math.min(STATE.duration, word.end + 0.06), word: word.text });
        }
      }
      STATE.muteRanges = ranges;
      const result = document.getElementById('word-mute-results');
      if (result) result.textContent = ranges.length
        ? `الكلمات المكتشفة: ${ranges.map(range => range.word).join('، ')}. سيستبدلها التصدير بصفارة رقابة.`
        : 'لم يعثر الفحص على كلمات محظورة في التفريغ.';
      showToast(ranges.length ? `تم العثور على ${ranges.length} كلمة، وستُحجب في الملف المصدر.` : 'اكتمل الفحص ولم تُكتشف كلمات محظورة.', 'success');
    } catch (error) {
      showToast(error.message || 'تعذر كشف الكلمات المحظورة.', 'error');
    } finally {
      if (button) { button.disabled = false; button.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i><span>كشف الكلمات وتجهيز صفارة الرقابة</span>'; }
    }
  }

  async function generateViralClips() {
    if (!await ensureCaptionTranscript()) return;
    const button = document.getElementById('btn-generate-viral-clips');
    const results = document.getElementById('viral-clips-results');
    if (button) { button.disabled = true; button.textContent = 'جارٍ تحليل اللحظات…'; }
    try {
      const response = await window.MickeyStudio.gatewayFetch('detect_viral_clips', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcription: STATE.captions.items.map(item => item.text).join('\n') })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !Array.isArray(data.clips) || !data.clips.length) throw new Error(data.error || 'لم ينتج التحليل مقاطع قابلة للاستخدام.');
      STATE.viralClips = data.clips.map(clip => ({
        ...clip,
        start: Math.max(0, Number(clip.start) || 0),
        end: Math.min(STATE.duration, Number(clip.end) || 0)
      })).filter(clip => clip.end > clip.start);
      if (!STATE.viralClips.length) throw new Error('لم تُرجع الخدمة توقيتات صالحة للمقاطع.');
      STATE.selectedViralClip = 0;
      if (results) results.innerHTML = STATE.viralClips.map((clip, index) => `
        <button type="button" class="w-full text-right p-3 rounded-xl bg-white/5 border border-white/10 hover:border-orange-400/50" onclick="MickeyMediaStudio.selectViralClip(${index})">
          <span class="block font-bold text-orange-300">${escapeHtml(clip.title || `المقطع ${index + 1}`)}</span>
          <span class="block text-[10px] text-zinc-400 mt-1">${formatTime(clip.start)} – ${formatTime(clip.end)} · ${escapeHtml(clip.reason || '')}</span>
        </button>`).join('');
      showToast(`تم اقتراح ${STATE.viralClips.length} مقاطع للمراجعة.`, 'success');
    } catch (error) {
      if (results) results.textContent = error.message || 'تعذر تحليل المقاطع.';
      showToast(error.message || 'تعذر تحليل المقاطع الفيروسية.', 'error');
    } finally {
      if (button) { button.disabled = false; button.innerHTML = '<i class="fa-solid fa-fire"></i><span>تحليل واقتراح المقاطع</span>'; }
    }
  }

  function selectViralClip(index) {
    const clip = STATE.viralClips[index];
    if (!clip) return;
    STATE.selectedViralClip = index;
    STATE.exportRange = { start: clip.start, end: clip.end };
    seekToTime(clip.start);
    document.getElementById('media-timeline-scrubber')?.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('btn-export-viral-clip')?.removeAttribute('disabled');
  }

  async function generateYouTubeChapters() {
    if (!await ensureCaptionTranscript()) return;
    const button = document.getElementById('btn-generate-yt-chapters');
    const output = document.getElementById('yt-chapters-output');
    if (button) { button.disabled = true; button.textContent = 'جارٍ إعداد الفصول…'; }
    try {
      const response = await window.MickeyStudio.gatewayFetch('generate_chapters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcription: STATE.captions.items.map(item => item.text).join('\n') })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.chapters) throw new Error(data.error || 'تعذر توليد فصول يوتيوب.');
      if (output) output.value = data.chapters;
      showToast('تم إنشاء فصول الفيديو من التفريغ. راجع توقيتاتها قبل النشر.', 'success');
    } catch (error) {
      showToast(error.message || 'تعذر إنشاء الفصول.', 'error');
    } finally {
      if (button) { button.disabled = false; button.innerHTML = '<i class="fa-solid fa-list-ol"></i><span>توليد فصول يوتيوب</span>'; }
    }
  }

  async function copyYouTubeChapters() {
    const output = document.getElementById('yt-chapters-output');
    if (!output?.value.trim()) { showToast('أنشئ الفصول أولاً.', 'warning'); return; }
    await navigator.clipboard.writeText(output.value);
    showToast('تم نسخ الفصول إلى الحافظة.', 'success');
  }

  function setZoomScale(button, level) {
    STATE.zoom.level = Number(level) === 1.3 ? 1.3 : 1.15;
    document.querySelectorAll('.zoom-scale-btn').forEach(item => {
      item.classList.toggle('bg-teal-500/10', item === button);
      item.classList.toggle('border-teal-500/30', item === button);
      item.classList.toggle('text-teal-400', item === button);
      item.classList.toggle('bg-white/5', item !== button);
      item.classList.toggle('border-white/5', item !== button);
      item.classList.toggle('text-zinc-400', item !== button);
    });
  }

  function seekToTime(time) {
    const video = document.getElementById('media-editor-video');
    if (video) {
      video.currentTime = time;
      STATE.currentTime = time;
      drawCaptionsFrame(time);
    }
  }

  /**
   * Web Audio API Filter Graph for Real-time Audio Cleanup & A/B Listening
   */
  function initWebAudioGraph(videoElement) {
    if (!videoElement || STATE.audio.isAudioInitialized) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      STATE.audio.audioCtx = ctx;

      const source = ctx.createMediaElementSource(videoElement);
      STATE.audio.sourceNode = source;

      // 1. Highpass filter to eliminate sub-bass rumble (< 80Hz)
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'highpass';
      bassFilter.frequency.value = 85;
      STATE.audio.bassFilter = bassFilter;

      // 2. Peaking filter for Vocal Clarity (2.8kHz - 3.5kHz)
      const presenceFilter = ctx.createBiquadFilter();
      presenceFilter.type = 'peaking';
      presenceFilter.frequency.value = 3200;
      presenceFilter.Q.value = 1.2;
      presenceFilter.gain.value = 4.5;
      STATE.audio.presenceFilter = presenceFilter;

      // 3. High-shelf filter to cut high-frequency hiss (> 9kHz)
      const airFilter = ctx.createBiquadFilter();
      airFilter.type = 'highshelf';
      airFilter.frequency.value = 9500;
      airFilter.gain.value = -3.0;
      STATE.audio.airFilter = airFilter;

      // 4. Dynamics Compressor for broadcast punch & voice leveling
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 10;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.15;
      STATE.audio.compressor = compressor;

      // 5. Dry / Wet Gain Crossfade Nodes
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      STATE.audio.dryGain = dryGain;
      STATE.audio.wetGain = wetGain;

      // Chain: Source -> Filters -> Compressor -> Wet Gain -> Destination
      source.connect(bassFilter);
      bassFilter.connect(presenceFilter);
      presenceFilter.connect(airFilter);
      airFilter.connect(compressor);
      compressor.connect(wetGain);
      wetGain.connect(ctx.destination);

      // Raw Source -> Dry Gain -> Destination
      source.connect(dryGain);
      dryGain.connect(ctx.destination);

      STATE.audio.isAudioInitialized = true;
      applyAudioFilterParams();
    } catch (err) {
      console.warn('[MickeyMediaStudio] WebAudio graph init note:', err);
    }
  }

  /**
   * Applies slider parameters to the WebAudio nodes
   */
  function applyAudioFilterParams() {
    if (!STATE.audio.isAudioInitialized) return;

    const denoiseRatio = STATE.audio.denoise / 100; // 0 to 1
    const clarityRatio = STATE.audio.clarity / 100; // 0 to 1

    if (STATE.audio.bassFilter) {
      // More denoise = higher cutoff of rumble
      STATE.audio.bassFilter.frequency.value = 80 + (denoiseRatio * 40);
    }
    if (STATE.audio.airFilter) {
      // More denoise = cut more high hiss
      STATE.audio.airFilter.gain.value = -(denoiseRatio * 6);
    }
    if (STATE.audio.presenceFilter) {
      // More clarity = boost vocal presence up to +7dB
      STATE.audio.presenceFilter.gain.value = clarityRatio * 7;
    }
    if (STATE.audio.compressor) {
      const compression = Math.max(0, Math.min(1, STATE.audio.dereverb / 100));
      STATE.audio.compressor.ratio.value = 1 + compression * 7;
      STATE.audio.compressor.threshold.value = -8 - compression * 18;
    }

    // Set A/B Wet vs Dry gains
    if (STATE.audio.previewMode === 'clean') {
      STATE.audio.wetGain.gain.value = 1.0;
      STATE.audio.dryGain.gain.value = 0.0;
    } else {
      STATE.audio.wetGain.gain.value = 0.0;
      STATE.audio.dryGain.gain.value = 1.0;
    }
  }

  /**
   * Toggles A/B listening comparison (Clean Studio Enhanced vs Raw Original)
   */
  function toggleAudioABComparison() {
    SFX.playClick();
    const isCurrentlyClean = (STATE.audio.previewMode === 'clean');
    STATE.audio.previewMode = isCurrentlyClean ? 'original' : 'clean';

    applyAudioFilterParams();

    const btn = document.getElementById('btn-audio-ab-toggle');
    const statusLabel = document.getElementById('audio-ab-status-text');

    if (btn) {
      if (STATE.audio.previewMode === 'clean') {
        btn.classList.add('bg-teal-500/20', 'border-teal-400', 'text-teal-300');
        btn.classList.remove('bg-zinc-800', 'border-zinc-700', 'text-zinc-400');
        if (statusLabel) statusLabel.textContent = 'الآن تستمع إلى: ✨ الصوت المنقى (Studio Enhanced)';
        showToast('وضع الاستماع: تطبيق المرشحات الصوتية الأساسية.', 'info');
      } else {
        btn.classList.remove('bg-teal-500/20', 'border-teal-400', 'text-teal-300');
        btn.classList.add('bg-zinc-800', 'border-zinc-700', 'text-zinc-400');
        if (statusLabel) statusLabel.textContent = 'الآن تستمع إلى: 🔊 الصوت الأصلي الخام (Original Raw)';
        showToast('وضع الاستماع: الصوت الأصلي الخام 🔊', 'info');
      }
    }
  }

  function updateWaveformDisplay() {
    const canvas = document.getElementById('media-waveform-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!STATE.silence.envelope.length) {
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(0, h / 2 - 1, w, 2);
      return;
    }

    // Draw bars from the decoded audio envelope and mark detected silence.
    const barsCount = 64;
    const barW = (w / barsCount) * 0.6;
    const gap = (w / barsCount) * 0.4;

    for (let i = 0; i < barsCount; i++) {
      const x = i * (barW + gap);
      const envelopeIndex = Math.min(STATE.silence.envelope.length - 1,
        Math.floor(i / barsCount * STATE.silence.envelope.length));
      const amplitude = STATE.silence.envelope[Math.max(0, envelopeIndex)] || 0;
      const barH = Math.max(2, amplitude * (h * 0.9));
      const time = (i / barsCount) * (STATE.duration || 0);
      const isSilence = STATE.silence.cuts.some(cut => time >= cut.start && time < cut.end);

      if (isSilence && STATE.mode === 'silence-cut') {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)'; // Red for silence cut
      } else {
        ctx.fillStyle = '#38bdf8';
      }

      ctx.beginPath();
      ctx.roundRect(x, (h / 2) - (barH / 2), barW, barH, 2);
      ctx.fill();
    }
  }

  function updateSilenceCutCalculations() {
    const countEl = document.getElementById('silence-cuts-count');
    const savedEl = document.getElementById('silence-time-saved');
    const total = STATE.silence.cuts.reduce((sum, cut) => sum + cut.duration, 0);
    if (countEl) countEl.textContent = STATE.silence.analyzed
      ? `${STATE.silence.cuts.length} وقفات` : 'لم يتم التحليل';
    if (savedEl) savedEl.textContent = STATE.silence.analyzed
      ? `${total.toFixed(1)} ثانية` : '—';
    const exportBtn = document.getElementById('btn-export-silence-cuts');
    if (exportBtn) exportBtn.disabled = !STATE.silence.analyzed || STATE.silence.cuts.length === 0;
    const analyzeBtn = document.getElementById('btn-analyze-silence');
    if (analyzeBtn && !analyzeBtn.textContent.includes('جارٍ')) analyzeBtn.disabled = !STATE.mediaFile;
    updateWaveformDisplay();
  }

  async function analyzeSilence() {
    if (!STATE.mediaFile) {
      showToast('اختر ملف فيديو أو صوت أولاً، ثم ابدأ تحليل السكتات.', 'error');
      return;
    }
    const button = document.getElementById('btn-analyze-silence');
    if (button) { button.disabled = true; button.textContent = 'جارٍ تحليل الصوت…'; }
    try {
      const video = document.getElementById('media-editor-video');
      const audioContext = STATE.audio.audioCtx;
      if (!video || !audioContext || !STATE.audio.sourceNode) {
        throw new Error('تعذر تهيئة قارئ صوت الفيديو في هذا المتصفح.');
      }
      await audioContext.resume();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      STATE.audio.sourceNode.connect(analyser);
      analyser.connect(silentGain);
      silentGain.connect(audioContext.destination);

      const initialTime = video.currentTime || 0;
      const wasPlaying = !video.paused;
      const duration = video.duration || STATE.duration;
      const wave = new Float32Array(analyser.fftSize);
      const samples = [];
      video.currentTime = 0;
      await new Promise(resolve => {
        if (video.readyState >= 2) return resolve();
        video.addEventListener('seeked', resolve, { once: true });
      });
      await video.play();
      await new Promise((resolve, reject) => {
        let lastSampleAt = -1;
        const sampleFrame = () => {
          try {
            if (video.ended || video.currentTime >= duration) return resolve();
            if (video.currentTime - lastSampleAt >= 0.045) {
              analyser.getFloatTimeDomainData(wave);
              let sum = 0;
              for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
              samples.push({ time: video.currentTime, rms: Math.sqrt(sum / wave.length) });
              lastSampleAt = video.currentTime;
              if (button) button.textContent = `جارٍ تحليل الصوت… ${Math.round(video.currentTime / duration * 100)}٪`;
            }
            requestAnimationFrame(sampleFrame);
          } catch (error) { reject(error); }
        };
        video.addEventListener('ended', resolve, { once: true });
        requestAnimationFrame(sampleFrame);
      });
      video.pause();
      video.currentTime = Math.min(initialTime, duration);
      if (wasPlaying) await video.play().catch(() => {});
      STATE.duration = duration;
      STATE.silence.samples = samples;
      STATE.silence.envelope = samples.map(sample => Math.min(1, sample.rms * 4));
      const pad = STATE.silence.padding / 1000;
      const cuts = [];
      for (let i = 0; i < samples.length;) {
        if (20 * Math.log10(Math.max(samples[i].rms, 1e-8)) >= STATE.silence.threshold) { i++; continue; }
        const startIndex = i;
        while (i < samples.length && 20 * Math.log10(Math.max(samples[i].rms, 1e-8)) < STATE.silence.threshold) i++;
        const rawStart = samples[startIndex].time;
        const rawEnd = i < samples.length ? samples[i].time : duration;
        if (rawEnd - rawStart < 0.25) continue;
        const start = Math.max(0, rawStart + pad);
        const end = Math.min(duration, rawEnd - pad);
        if (end > start) cuts.push({ start, end, duration: end - start });
      }
      STATE.silence.cuts = cuts;
      STATE.silence.analyzed = true;
      updateSilenceCutCalculations();
      showToast(cuts.length ? `اكتمل التحليل: تم العثور على ${cuts.length} فترة صمت.` : 'اكتمل التحليل ولم يتم العثور على سكتات تتجاوز الحد الأدنى.', 'success');
      STATE.audio.sourceNode.disconnect(analyser);
      analyser.disconnect();
      silentGain.disconnect();
    } catch (error) {
      console.error('[MickeyMediaStudio] silence analysis failed:', error);
      showToast(error && error.message ? error.message : 'تعذر تحليل الصوت في هذا الملف.', 'error');
      const video = document.getElementById('media-editor-video');
      if (video) video.pause();
    } finally {
      if (button) { button.disabled = false; button.innerHTML = '<i class="fa-solid fa-waveform-lines"></i><span>تحليل الصوت واكتشاف السكتات</span>'; }
    }
  }

  /**
   * Export Options Generators
   */
  function exportSubtitlesSrt() {
    SFX.playClick();
    let srtContent = '';
    STATE.captions.items.forEach((item, idx) => {
      srtContent += `${idx + 1}\n`;
      srtContent += `${formatSrtTime(item.start)} --> ${formatSrtTime(item.end)}\n`;
      srtContent += `${item.text}\n\n`;
    });

    downloadBlob(new Blob([srtContent], { type: 'text/plain;charset=utf-8' }), 'captions.srt');
    showToast('تم تصدير ملف الترجمة SRT بنجاح!', 'success');
  }

  function exportPremiereXml() {
    SFX.playClick();
    if (STATE.mode === 'silence-cut' && !STATE.silence.analyzed) {
      showToast('حلّل الصوت أولاً قبل تصدير القطع.', 'error');
      return;
    }
    const sourceDuration = STATE.duration || 0;
    const keptSegments = [];
    let cursor = 0;
    for (const cut of STATE.silence.cuts) {
      if (cut.start > cursor) keptSegments.push({ start: cursor, end: cut.start });
      cursor = Math.max(cursor, cut.end);
    }
    if (cursor < sourceDuration) keptSegments.push({ start: cursor, end: sourceDuration });
    const clips = STATE.mode === 'silence-cut' && STATE.silence.analyzed
      ? keptSegments : [{ start: 0, end: sourceDuration }];
    let timelineFrame = 0;
    const clipItems = clips.filter(clip => clip.end > clip.start).map((clip, index) => {
      const start = Math.round(clip.start * 30);
      const end = Math.round(clip.end * 30);
      const timelineStart = timelineFrame;
      timelineFrame += end - start;
      return `          <clipitem id="clip-${index + 1}"><name>${escapeHtml(STATE.mediaFile?.name || 'Source Clip')}</name><start>${timelineStart}</start><end>${timelineFrame}</end><in>${start}</in><out>${end}</out></clipitem>`;
    }).join('\n');
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence>
    <name>Mickey Studio - Timeline Export</name>
    <duration>${timelineFrame || Math.round(STATE.duration * 30)}</duration>
    <rate><timebase>30</timebase><ntsc>FALSE</ntsc></rate>
    <media>
      <video>
        <track>
          <!-- Source media must be relinked in Premiere after import. -->
${clipItems}
        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;

    downloadBlob(new Blob([xmlContent], { type: 'application/xml;charset=utf-8' }), 'mickey-timeline.xml');
    showToast(STATE.mode === 'silence-cut'
      ? 'تم تصدير مقاطع التايملاين بعد حذف السكتات. أعد ربط الملف الأصلي داخل Premiere عند الطلب.'
      : 'تم تصدير ملف التايملاين لبريمير برو (XML) بنجاح!', 'success');
  }

  function exportTransparentVideo() {
    SFX.playClick();
    showToast('تصدير فيديو شفاف غير متاح حالياً في محرر الموقع. يمكنك تنزيل ملف SRT أو فيديو عادي بالكابشنز.', 'warning');
  }

  async function exportRenderedMp4() {
    SFX.playClick();
    const video = document.getElementById('media-editor-video');
    if (!STATE.mediaFile || !video || !Number.isFinite(video.duration) || video.duration <= 0) {
      showToast('ارفع فيديو وانتظر اكتمال تحميله قبل التصدير.', 'warning');
      return;
    }
    if (STATE.mode === 'silence-cut' && !STATE.silence.analyzed) {
      showToast('حلّل الصوت أولاً قبل تصدير الفيديو بعد قص السكتات.', 'warning');
      return;
    }
    if (STATE.mode === 'word-mute' && !STATE.muteRanges.length) {
      showToast('اكشف الكلمات المحظورة أولاً قبل تصدير نسخة الرقابة.', 'warning');
      return;
    }
    if (STATE.mode === 'viral-clips' && !STATE.exportRange) {
      showToast('حلل المقاطع واختر مقطعاً قبل التصدير.', 'warning');
      return;
    }
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      showToast('تصدير الفيديو غير مدعوم في هذا المتصفح. جرّب أحدث إصدار من Edge أو Chrome.', 'error');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = STATE.aspectRatio === '9:16' ? 720 : 1280;
    canvas.height = STATE.aspectRatio === '9:16' ? 1280 : 720;
    const ctx = canvas.getContext('2d');
    const canvasStream = canvas.captureStream(30);
    let audioDestination = null;
    let exportAudioGain = null;
    let beepGain = null;
    let beepOscillator = null;
    let audioTracks = [];
    if (STATE.audio.audioCtx && STATE.audio.wetGain && STATE.audio.dryGain) {
      audioDestination = STATE.audio.audioCtx.createMediaStreamDestination();
      exportAudioGain = STATE.audio.audioCtx.createGain();
      STATE.audio.wetGain.connect(exportAudioGain);
      STATE.audio.dryGain.connect(exportAudioGain);
      exportAudioGain.connect(audioDestination);
      if (STATE.mode === 'word-mute' && STATE.muteRanges.length) {
        beepGain = STATE.audio.audioCtx.createGain();
        beepGain.gain.value = 0;
        beepOscillator = STATE.audio.audioCtx.createOscillator();
        beepOscillator.type = 'sine';
        beepOscillator.frequency.value = 880;
        beepOscillator.connect(beepGain);
        beepGain.connect(audioDestination);
        beepOscillator.start();
      }
      audioTracks = audioDestination.stream.getAudioTracks();
    } else if (video.captureStream || video.mozCaptureStream) {
      audioTracks = (video.captureStream || video.mozCaptureStream).call(video).getAudioTracks();
    }
    const stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
    const mimeType = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4',
      'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'
    ].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      stream.getTracks().forEach(track => track.stop());
      showToast('هذا المتصفح لا يوفر ترميز MP4 أو WebM.', 'error');
      return;
    }

    const initialTime = video.currentTime || 0;
    const wasPlaying = !video.paused;
    const segments = [];
    let cursor = 0;
    if (STATE.mode === 'silence-cut') {
      for (const cut of STATE.silence.cuts) {
        if (cut.start > cursor) segments.push({ start: cursor, end: cut.start });
        cursor = Math.max(cursor, cut.end);
      }
    }
    if (cursor < video.duration) segments.push({ start: cursor, end: video.duration });
    const parts = STATE.mode === 'silence-cut' ? segments
      : STATE.mode === 'viral-clips' && STATE.exportRange ? [STATE.exportRange]
        : [{ start: 0, end: video.duration }];
    if (!parts.length) {
      stream.getTracks().forEach(track => track.stop());
      showToast('لم يتبق أي مقطع بعد القص. خفف الحساسية وأعد التحليل.', 'error');
      return;
    }

    let recorder;
    try { recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000, audioBitsPerSecond: 192000 }); }
    catch (error) {
      stream.getTracks().forEach(track => track.stop());
      audioDestination?.stream.getTracks().forEach(track => track.stop());
      showToast(error.message || 'تعذر بدء ترميز الفيديو في هذا المتصفح.', 'error');
      return;
    }
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = event => reject(event.error || new Error('فشل ترميز الفيديو.'));
    });
    const exportButtons = Array.from(document.querySelectorAll('[onclick="MickeyMediaStudio.exportRenderedMp4()"]'));
    exportButtons.forEach(button => { button.disabled = true; button.dataset.originalText = button.innerHTML; button.textContent = 'جارٍ إنشاء الفيديو…'; });
    const playbackButton = document.getElementById('btn-media-play');
    const scrubber = document.getElementById('media-timeline-scrubber');
    if (playbackButton) playbackButton.disabled = true;
    if (scrubber) scrubber.disabled = true;
    const seek = time => new Promise((resolve, reject) => {
      if (Math.abs(video.currentTime - time) < 0.03) return resolve();
      const timeout = setTimeout(() => reject(new Error('تعذر الانتقال إلى مقطع الفيديو.')), 10000);
      video.addEventListener('seeked', () => { clearTimeout(timeout); resolve(); }, { once: true });
      video.currentTime = time;
    });
    const drawCaption = time => {
      const item = STATE.captions.items.find(caption => time >= caption.start && time <= caption.end);
      if (!item) return;
      const size = STATE.captions.fontSize || 32;
      const y = STATE.captions.position === 'top' ? canvas.height * 0.18 : STATE.captions.position === 'center' ? canvas.height * 0.5 : canvas.height * 0.82;
      ctx.save();
      ctx.font = `bold ${size}px ${STATE.captions.font || 'Cairo'}, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
      const width = ctx.measureText(item.text).width;
      if (STATE.captions.bgPill) {
        ctx.fillStyle = STATE.captions.pillColor || 'rgba(15,23,42,.75)';
        ctx.beginPath(); ctx.roundRect((canvas.width - width - 48) / 2, y - size, width + 48, size * 2, 14); ctx.fill();
      }
      ctx.lineWidth = STATE.captions.strokeWidth || 0;
      ctx.strokeStyle = STATE.captions.strokeColor || '#000';
      ctx.fillStyle = STATE.captions.textColor || '#fff';
      if (ctx.lineWidth) ctx.strokeText(item.text, canvas.width / 2, y);
      ctx.fillText(item.text, canvas.width / 2, y);
      ctx.restore();
    };

    try {
      if (STATE.audio.audioCtx?.state === 'suspended') await STATE.audio.audioCtx.resume();
      recorder.start(250);
      for (let index = 0; index < parts.length; index++) {
        const part = parts[index];
        await seek(part.start);
        await video.play();
        await new Promise((resolve, reject) => {
          const drawFrame = () => {
            const censored = STATE.mode === 'word-mute' && STATE.muteRanges.some(range => video.currentTime >= range.start && video.currentTime <= range.end);
            if (exportAudioGain && STATE.audio.audioCtx) exportAudioGain.gain.setTargetAtTime(censored ? 0 : 1, STATE.audio.audioCtx.currentTime, 0.005);
            if (beepGain && STATE.audio.audioCtx) beepGain.gain.setTargetAtTime(censored ? 0.32 : 0, STATE.audio.audioCtx.currentTime, 0.005);
            if (video.currentTime >= part.end || video.ended) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height); drawCaption(video.currentTime); video.pause(); resolve(); return;
            }
            if (video.videoWidth && video.videoHeight) {
              const zoom = STATE.mode === 'auto-zoom' ? Math.max(1, Number(STATE.zoom.level) || 1) : 1;
              const cropWidth = video.videoWidth / zoom;
              const cropHeight = video.videoHeight / zoom;
              const fit = Math.min(canvas.width / cropWidth, canvas.height / cropHeight);
              const drawWidth = cropWidth * fit;
              const drawHeight = cropHeight * fit;
              ctx.drawImage(video,
                (video.videoWidth - cropWidth) / 2, (video.videoHeight - cropHeight) / 2, cropWidth, cropHeight,
                (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
            } else {
              ctx.fillStyle = '#090b10'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            drawCaption(video.currentTime);
            const progress = Math.round((index + (video.currentTime - part.start) / Math.max(part.end - part.start, 0.1)) / parts.length * 100);
            exportButtons.forEach(button => { button.textContent = `جارٍ إنشاء الفيديو… ${progress}٪`; });
            requestAnimationFrame(drawFrame);
          };
          video.addEventListener('error', () => reject(new Error('تعذرت قراءة إطارات الفيديو.')), { once: true });
          requestAnimationFrame(drawFrame);
        });
      }
      recorder.stop();
      await stopped;
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      if (!blob.size) throw new Error('لم يتم إنشاء ملف فيديو صالح.');
      const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
      downloadBlob(blob, `mickey-edited-${Date.now()}.${extension}`);
      showToast(extension === 'mp4'
        ? 'اكتمل إنشاء MP4 مع تطبيق الكابشنز والقص.'
        : 'تم إنشاء WebM فعلياً؛ هذا المتصفح لا يتيح ترميز MP4 مباشرة.', extension === 'mp4' ? 'success' : 'warning');
    } catch (error) {
      if (recorder.state !== 'inactive') recorder.stop();
      console.error('[MickeyMediaStudio] video export failed:', error);
      showToast(error.message || 'تعذر إنشاء ملف الفيديو.', 'error');
    } finally {
      video.pause();
      await seek(Math.min(initialTime, video.duration)).catch(() => {});
      if (wasPlaying) video.play().catch(() => {});
      stream.getTracks().forEach(track => track.stop());
      audioDestination?.stream.getTracks().forEach(track => track.stop());
      try { beepOscillator?.stop(); } catch (_) {}
      exportAudioGain?.disconnect();
      beepGain?.disconnect();
      exportButtons.forEach(button => { button.disabled = false; if (button.dataset.originalText) button.innerHTML = button.dataset.originalText; });
      if (playbackButton) playbackButton.disabled = false;
      if (scrubber) scrubber.disabled = false;
    }
  }

  // Utilities
  function formatTime(sec) {
    if (isNaN(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function formatSrtTime(sec) {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const exports = {
    init,
    setMode,
    loadMediaFile,
    loadDemoSample,
    togglePlayback,
    setAspectRatio,
    updateSubtitleText,
    generateCaptionsFromMedia,
    addSubtitleAtPlayhead,
    deleteSubtitle,
    detectAndMuteWords,
    generateViralClips,
    selectViralClip,
    generateYouTubeChapters,
    copyYouTubeChapters,
    setZoomScale,
    seekToTime,
    toggleAudioABComparison,
    exportSubtitlesSrt,
    exportPremiereXml,
    exportTransparentVideo,
    exportRenderedMp4
  };

  if (typeof window.MickeyStudio !== 'undefined') {
    Object.assign(window.MickeyStudio, exports);
  }

  root.MickeyMediaStudio = exports;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 50);
  }

})(typeof window !== 'undefined' ? window : this);
