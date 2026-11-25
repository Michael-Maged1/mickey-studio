/**
 * Mickey Studio - Voice Studio Module (Voiceover, Podcast & Audiobook)
 * Dynamic Studio Chunk: Gemini TTS, Web Speech, Audio waveform player, podcast dialogue, and audiobooks.
 */
(function (root) {
  'use strict';

  // Access core globals via window.MickeyStudio
  const STATE = window.MickeyStudio.STATE;
  const SFX = window.MickeyStudio.SFX;
  const showToast = window.MickeyStudio.showToast || window.showToast;
  const gatewayFetch = window.MickeyStudio.gatewayFetch;
  const updateQuotaBadge = window.MickeyStudio.updateQuotaBadge;
  const authorizeAndConsume = window.MickeyStudio.authorizeAndConsume;
  const downloadBlob = window.MickeyStudio.downloadBlob;
  const saveAssetToDB = (...args) => (window.MickeyStudio?.saveAssetToDB || window.saveAssetToDB)?.(...args);

  // 10. STUDIO 4: AI VOICEOVER & AUDIO LAB
  // -----------------------------------------------------------------
  function generateAiScript() {
    SFX.playClick();
    const scripts = [
      'مرحباً بكم في ميكي ستوديو، الأفق الجديد للذكاء الاصطناعي. هنا حيث تتحول الأفكار إلى واقع سينمائي مبهر بلا حدود.',
      'في عالم يتسارع فيه الابتكار، تصنع الريادة بالقرارات الجريئة. استمتع بأقوى أدوات الإبداع الرقمي بين يديك الآن.',
      'هل تساءلت يوماً كيف تبدو مدن المستقبل؟ استكشف آفاق الخيال العلمي وحوّل رؤيتك الفنية إلى لوحات سينمائية فائقة الدقة.',
      'سواء كنت صانع محتوى، مصمماً، أو فناناً رقمياً، هذه المنصة هي محطتك المتكاملة للإنتاج الاحترافي مجاناً وبلا قيود.'
    ];
    const picked = scripts[Math.floor(Math.random() * scripts.length)];
    const textInput = document.getElementById('voice-text-input');
    if (textInput) textInput.value = picked;
    showToast('تم توليد سكريبت احترافي بالذكاء الاصطناعي!', 'success');
  }

  async function requestVoiceScriptRefinement(text, dialect) {
    const response = await gatewayFetch('refine_voiceover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, dialect }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || `تعذر تحسين النص (${response.status}).`);
    return String(data.refined || '').trim();
  }

  async function refineVoiceScript() {
    const input = document.getElementById('voice-text-input');
    const text = input?.value.trim() || '';
    if (!text) { showToast('اكتب النص الذي تريد تحسينه أولاً.', 'warning'); return; }
    if (text.length > 6000) { showToast('النص طويل جدًا. الحد الأقصى 6000 حرف.', 'warning'); return; }
    const button = document.getElementById('btn-refine-voice-script');
    if (button) button.disabled = true;
    try {
      const dialect = document.getElementById('voice-dialect-select')?.selectedOptions?.[0]?.textContent || 'المصرية';
      if (!await authorizeAndConsume('voiceover')) return;
      const refined = await requestVoiceScriptRefinement(text, dialect);
      if (!refined) throw new Error('لم تُرجع الخدمة نصًا محسنًا.');
      input.value = refined;
      showToast('تم تحسين النص للإلقاء. راجعه قبل إنشاء الصوت.', 'success');
    } catch (error) { showToast(error.message || 'تعذر تحسين النص.', 'error'); }
    finally { if (button) button.disabled = false; }
  }

  // Helper to format seconds as M:SS or H:MM:SS (matches screenshot style 0:00 / 52:29)
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
    const playIcon = document.getElementById('icon-custom-play');
    const timeCurrent = document.getElementById('audio-time-current');
    const timeTotal = document.getElementById('audio-time-total');
    const waveformContainer = document.getElementById('waveform-container');

    audioEl.onplay = () => {
      if (playIcon) playIcon.className = 'fa-solid fa-pause text-sm';
    };

    audioEl.onpause = () => {
      if (playIcon) playIcon.className = 'fa-solid fa-play text-sm ml-0.5';
    };

    audioEl.onended = () => {
      if (playIcon) playIcon.className = 'fa-solid fa-play text-sm ml-0.5';
      if (!audioEl.loop && timeCurrent) {
        timeCurrent.textContent = formatAudioTime(0);
      }
    };

    audioEl.ontimeupdate = () => {
      if (timeCurrent) timeCurrent.textContent = formatAudioTime(audioEl.currentTime);
    };

    audioEl.onloadedmetadata = () => {
      if (timeTotal) timeTotal.textContent = formatAudioTime(audioEl.duration);
    };

    if (audioEl.duration && isFinite(audioEl.duration) && timeTotal) {
      timeTotal.textContent = formatAudioTime(audioEl.duration);
    }

    // Interactive waveform click & drag to seek
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
    const audioEl = document.getElementById('final-rendered-audio');
    if (!audioEl) return;
    SFX.playClick();
    if (audioEl.paused) {
      if (audioEl.src && audioEl.src !== window.location.href) {
        audioEl.play().catch(e => {
          console.warn('Play error:', e);
          fallbackSpeakText();
        });
      } else {
        fallbackSpeakText();
      }
    } else {
      audioEl.pause();
      if ('speechSynthesis' in window) window.speechSynthesis.pause();
    }
  }

  function fallbackSpeakText() {
    const text = document.getElementById('voice-text-input')?.value.trim();
    if (text && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'ar-SA';
      const audioEl = document.getElementById('final-rendered-audio');
      setupAudioSpectrumVisualizer(audioEl);
      window.speechSynthesis.speak(utter);
      showToast('يتم تشغيل الصوت عبر محرك النطق 🔊', 'info');
    }
  }

  // Playback Speed Switcher (User requested)
  const AUDIO_SPEEDS = [1.0, 1.25, 1.5, 1.75, 2.0];
  let currentSpeedIdx = 0;
  function cycleAudioSpeed() {
    const audioEl = document.getElementById('final-rendered-audio');
    const speedBtn = document.getElementById('btn-audio-speed');
    currentSpeedIdx = (currentSpeedIdx + 1) % AUDIO_SPEEDS.length;
    const speed = AUDIO_SPEEDS[currentSpeedIdx];
    if (audioEl) audioEl.playbackRate = speed;
    if (speedBtn) speedBtn.textContent = `${speed.toFixed(speed % 1 === 0 ? 1 : 2)}x`;
    SFX.playClick();
    showToast(`سرعة التشغيل: ${speed}x ⚡`, 'info');
  }

  // Volume slider and mute toggle
  let previousAudioVolume = 1.0;
  function setVolume(val) {
    const audioEl = document.getElementById('final-rendered-audio');
    const volIcon = document.getElementById('volume-icon');
    const slider = document.getElementById('audio-volume-slider');
    const v = Math.max(0, Math.min(1, parseFloat(val)));
    if (audioEl) {
      audioEl.volume = v;
      audioEl.muted = (v === 0);
    }
    if (slider) slider.value = v;
    if (volIcon) {
      if (v === 0) {
        volIcon.className = 'fa-solid fa-volume-xmark text-xs text-rose-400';
      } else if (v < 0.5) {
        volIcon.className = 'fa-solid fa-volume-low text-xs text-zinc-300';
      } else {
        volIcon.className = 'fa-solid fa-volume-high text-xs text-zinc-300';
      }
    }
    if (v > 0) previousAudioVolume = v;
  }

  function toggleMute() {
    const audioEl = document.getElementById('final-rendered-audio');
    if (!audioEl) return;
    SFX.playClick();
    if (audioEl.muted || audioEl.volume === 0) {
      const restoreVol = previousAudioVolume > 0 ? previousAudioVolume : 1.0;
      setVolume(restoreVol);
      showToast('تم إلغاء كتم الصوت 🔊', 'info');
    } else {
      previousAudioVolume = audioEl.volume || 1.0;
      setVolume(0);
      showToast('تم كتم الصوت 🔇', 'info');
    }
  }

  // Skip Forward / Backward (User requested +10s specifically)
  function skipAudio(seconds) {
    const audioEl = document.getElementById('final-rendered-audio');
    if (!audioEl) return;
    SFX.playClick();
    const duration = audioEl.duration || 0;
    const newTime = Math.max(0, Math.min(duration, audioEl.currentTime + seconds));
    audioEl.currentTime = newTime;
    const timeCurrent = document.getElementById('audio-time-current');
    if (timeCurrent) timeCurrent.textContent = formatAudioTime(newTime);
    if (seconds > 0) {
      showToast(`تقديم +${seconds} ثوانٍ ⏩`, 'info');
    } else {
      showToast(`ترجيع ${seconds} ثوانٍ ⏪`, 'info');
    }
  }

  function toggleAudioLoop() {
    const audioEl = document.getElementById('final-rendered-audio');
    const loopBtn = document.getElementById('btn-audio-loop');
    if (!audioEl) return;
    SFX.playClick();
    audioEl.loop = !audioEl.loop;
    if (loopBtn) {
      if (audioEl.loop) {
        loopBtn.className = 'p-1.5 rounded-full text-sky-400 bg-sky-500/10 transition-colors';
        showToast('تم تفعيل التكرار التلقائي للمقطع 🔁', 'info');
      } else {
        loopBtn.className = 'p-1.5 rounded-full text-zinc-400 hover:text-zinc-200 transition-colors';
        showToast('تم إلغاء تكرار المقطع', 'info');
      }
    }
  }

  // Harmonic Sine Envelope Waveform Visualizer (Exact match with user screenshot)
  let spectrumAnimId = null;
  function setupAudioSpectrumVisualizer(audioEl) {
    const canvas = document.getElementById('audio-spectrum-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (spectrumAnimId) {
      cancelAnimationFrame(spectrumAnimId);
      spectrumAnimId = null;
    }

    const barsCount = 96;
    let wavePhase = 0;

    function renderFrame() {
      // Auto-adapt canvas width to parent width
      const container = canvas.parentElement;
      if (container && container.clientWidth > 0 && Math.abs(canvas.width - container.clientWidth) > 4) {
        canvas.width = container.clientWidth;
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const isPlaying = audioEl && !audioEl.paused;
      if (isPlaying) {
        wavePhase += 0.07;
      }

      const duration = (audioEl && isFinite(audioEl.duration) && audioEl.duration > 0) ? audioEl.duration : 1;
      const currentTime = audioEl ? (audioEl.currentTime || 0) : 0;
      const progressRatio = Math.max(0, Math.min(1, currentTime / duration));

      const centerY = h / 2;
      const minBarHeight = 3.5;
      const maxBarHeight = h * 0.82; // ~46px on 56px canvas
      const barWidth = 2.4;
      const step = (w - barWidth) / (barsCount - 1);

      for (let i = 0; i < barsCount; i++) {
        const u = i / (barsCount - 1); // 0.0 to 1.0
        const x = i * step;

        // Envelope: 4 symmetric nodes/antinodes using |sin(4 * PI * u)|
        const envelope = Math.pow(Math.abs(Math.sin(u * 4 * Math.PI)), 0.95);
        let barHeight = minBarHeight + envelope * (maxBarHeight - minBarHeight);

        // Dynamic harmonic breathing when playing
        if (isPlaying) {
          const breathing = 0.92 + 0.08 * Math.sin(wavePhase + u * 6.28);
          barHeight *= breathing;
        }

        const topY = centerY - (barHeight / 2);

        // Color split: white before progress head, translucent white after
        if (u <= progressRatio) {
          ctx.fillStyle = '#ffffff';
          if (isPlaying) {
            ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';
            ctx.shadowBlur = 4;
          } else {
            ctx.shadowBlur = 0;
          }
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.shadowBlur = 0;
        }

        // Draw pill-shaped vertical line (rounded caps)
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, topY, barWidth, barHeight, barWidth / 2);
        } else {
          ctx.rect(x, topY, barWidth, barHeight);
        }
        ctx.fill();
      }

      spectrumAnimId = requestAnimationFrame(renderFrame);
    }

    renderFrame();
  }

  // =================================================================
  // SAVIO STUDIO PERSONAS & VOICE GALLERY
  // =================================================================
  const VOICE_PERSONAS = {
    male: [
      { id: 'yusuf', name: 'يوسف', role: 'وثائقي قوي', fullName: 'يوسف · وثائقي قوي', tags: ['عميق', 'رزين', 'موثوق'], previewText: 'أهلاً بكم في هذا الوثائقي، حيث نكتشف أسرار الحضارة وعظمة التاريخ.' },
      { id: 'malik', name: 'مالك', role: 'إعلان وتسويق', fullName: 'مالك · إعلاني سريع', tags: ['سريع', 'واثق', 'حماسي', 'مقنع'], previewText: 'عرض خاص وحصري! اشترك الآن واستمتع بأقوى المزايا بأفضل جودة.' },
      { id: 'rami', name: 'رامي', role: 'بودكاست هادئ', fullName: 'رامي · بودكاست هادئ', tags: ['تفاعلي', 'حيوي', 'عفوي', 'ودود'], previewText: 'مرحباً أصدقائي في حلقة اليوم، حديثنا شيق ومليء بالأفكار الملهمة.' },
      { id: 'saif', name: 'سيف', role: 'درامي عاطفي', fullName: 'سيف · درامي عاطفي', tags: ['تعبير مؤثر', 'مشاعر متدفقة'], previewText: 'في تلك اللحظة الحاسمة، أدركت أن كل شيء كان على وشك التغير للأبد.' },
      { id: 'zaid', name: 'زيد', role: 'راوٍ قصصي', fullName: 'زيد · راوٍ قصصي', tags: ['سردي', 'مشوق', 'دافئ'], previewText: 'كان يا ما كان في قديم الزمان، قصة تروى عبر الأجيال بحكمة وجمال.' },
      { id: 'neutral', name: 'متوازن', role: 'متوازن وطبيعي', fullName: 'متوازن · طبيعي وواضح', tags: ['طبيعي', 'واضح', 'متزن'], previewText: 'أهلاً بكم، نقدم لكم هذا المحتوى بنبرة واضحة ومناسبة لمختلف الأعمال.' },
    ],
    female: [
      { id: 'mariam', name: 'مريم', role: 'صوت قصصي', fullName: 'مريم · صوت قصصي', tags: ['هادئ', 'متزن', 'عاطفي', 'دافئ'], previewText: 'كانت الليالي هادئة في تلك المدينة القديمة، وتحمل بين أزقتها حكايات لا تُنسى.' },
      { id: 'laila', name: 'ليلى', role: 'إعلان وتسويق', fullName: 'ليلى · إعلان وتسويق', tags: ['سريع', 'واثق', 'حماسي', 'مقنع'], previewText: 'اكتشف الفرق الحقيقي اليوم! جودة استثنائية وأداء لا يقارن، لا تفوت الفرصة.' },
      { id: 'sama', name: 'سما', role: 'بودكاست ومحتوى اجتماعي', fullName: 'سما · بودكاست ومحتوى اجتماعي', tags: ['تفاعلي', 'حيوي', 'عفوي', 'ودود'], previewText: 'يا هلا ومرحب! سعيدة أشارككم اليوم تجربة فريدة وممتعة للغاية.' },
      { id: 'salma', name: 'سلمى', role: 'درامي عاطفي', fullName: 'سلمى · درامي عاطفي', tags: ['تعبير مؤثر', 'مشاعر متدفقة'], previewText: 'لم تكن مجرد صدفة عابرة، بل كانت لحظة مصيرية قلبت كل الموازين.' },
      { id: 'farida', name: 'فريدة', role: 'وثائقي رصين', fullName: 'فريدة · وثائقي رصين', tags: ['عميق', 'رزين', 'حضور قوي'], previewText: 'تشير السجلات التاريخية إلى بداية عصر جديد غيّر ملامح المنطقة بالكامل.' },
      { id: 'neutral', name: 'متوازنة', role: 'متوازنة وطبيعية', fullName: 'متوازنة · طبيعي وواضح', tags: ['طبيعي', 'واضح', 'متزنة'], previewText: 'مرحباً بكم، نقدم لكم هذا التقرير بأداء صوتي طبيعي ومريح للمستمع.' },
    ]
  };

  let currentPreviewAudio = null;
  let activePlayingPersonaId = null;

  function onVoiceGenderChanged() {
    const genderSelect = document.getElementById('voice-gender-select');
    const perfSelect = document.getElementById('voice-performance-select');
    if (!genderSelect || !perfSelect) return;
    
    const gender = genderSelect.value || 'male';
    const list = VOICE_PERSONAS[gender] || VOICE_PERSONAS.male;
    const currentVal = perfSelect.value;
    
    perfSelect.innerHTML = list.map((p, idx) => 
      `<option value="${p.id}" ${p.id === currentVal || (!list.some(x => x.id === currentVal) && idx === 0) ? 'selected' : ''}>${p.fullName}</option>`
    ).join('');

    filterVoiceGallery(gender);
  }

  function filterVoiceGallery(filter = 'all') {
    const btnAll = document.getElementById('btn-filter-all');
    const btnMale = document.getElementById('btn-filter-male');
    const btnFemale = document.getElementById('btn-filter-female');
    [btnAll, btnMale, btnFemale].forEach(b => {
      if (b) {
        b.className = 'px-3 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors';
      }
    });

    const activeBtn = filter === 'male' ? btnMale : filter === 'female' ? btnFemale : btnAll;
    if (activeBtn) {
      activeBtn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors';
    }

    renderVoiceGallery(filter);
  }

  function renderVoiceGallery(filter = 'all') {
    const grid = document.getElementById('voice-gallery-cards-grid');
    if (!grid) return;

    let personasToShow = [];
    if (filter === 'all') {
      const f = VOICE_PERSONAS.female.map(p => ({ ...p, gender: 'female' }));
      const m = VOICE_PERSONAS.male.map(p => ({ ...p, gender: 'male' }));
      personasToShow = [...f, ...m];
    } else if (filter === 'female') {
      personasToShow = VOICE_PERSONAS.female.map(p => ({ ...p, gender: 'female' }));
    } else {
      personasToShow = VOICE_PERSONAS.male.map(p => ({ ...p, gender: 'male' }));
    }

    const currentGender = document.getElementById('voice-gender-select')?.value || 'male';
    const currentPerf = document.getElementById('voice-performance-select')?.value || 'neutral';

    grid.innerHTML = personasToShow.map(p => {
      const isSelected = p.gender === currentGender && p.id === currentPerf;
      const isFemale = p.gender === 'female';
      const avatarBg = isFemale ? 'from-rose-500/20 to-purple-500/20 text-rose-300 border-rose-500/30' : 'from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/30';
      const isPlaying = activePlayingPersonaId === `${p.gender}_${p.id}`;

      return `
        <div onclick="MickeyStudio.selectPersonaFromGallery('${p.id}', '${p.gender}')" 
             class="p-3.5 rounded-2xl bg-zinc-900/50 border ${isSelected ? 'border-cyan-400 ring-1 ring-cyan-400/50 bg-cyan-950/20' : 'border-white/5 hover:border-white/20'} transition-all cursor-pointer flex flex-col justify-between space-y-3 group relative">
          
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${avatarBg} border flex items-center justify-center font-bold text-sm shadow-inner">
                ${p.name.slice(0, 1)}
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <h4 class="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">${p.name}</h4>
                  <span class="text-[9px] px-1.5 py-0.2 rounded font-mono ${isFemale ? 'bg-rose-500/10 text-rose-300' : 'bg-cyan-500/10 text-cyan-300'}">${isFemale ? 'أنثى' : 'ذكر'}</span>
                </div>
                <p class="text-[10px] text-zinc-400 mt-0.5">${p.role}</p>
              </div>
            </div>

            <button type="button" 
                    onclick="event.stopPropagation(); MickeyStudio.playPersonaPreview('${p.id}', '${p.gender}')" 
                    class="w-8 h-8 rounded-full ${isPlaying ? 'bg-emerald-500 text-black animate-pulse' : 'bg-white/5 hover:bg-emerald-500 hover:text-black text-zinc-300'} border border-white/10 flex items-center justify-center transition-all shadow-sm"
                    title="استمع للمعاينة">
              <i class="fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-[10px] ${isPlaying ? '' : 'ml-0.5'}"></i>
            </button>
          </div>

          <div class="flex flex-wrap gap-1">
            ${p.tags.map(t => `<span class="text-[9px] px-2 py-0.5 rounded-md bg-white/[0.03] text-zinc-400 border border-white/5">${t}</span>`).join('')}
          </div>

          <div class="text-[10px] text-zinc-500 line-clamp-1 italic">
            "${p.previewText}"
          </div>
        </div>
      `;
    }).join('');
  }

  function selectPersonaFromGallery(personaId, gender) {
    const genderSelect = document.getElementById('voice-gender-select');
    if (genderSelect) genderSelect.value = gender;
    
    const perfSelect = document.getElementById('voice-performance-select');
    const list = VOICE_PERSONAS[gender] || VOICE_PERSONAS.male;
    if (perfSelect) {
      perfSelect.innerHTML = list.map(p => 
        `<option value="${p.id}" ${p.id === personaId ? 'selected' : ''}>${p.fullName}</option>`
      ).join('');
      perfSelect.value = personaId;
    }

    renderVoiceGallery(gender);
    SFX.playClick();
    const pObj = (VOICE_PERSONAS[gender] || []).find(x => x.id === personaId);
    showToast(`تم اختيار شخصية: ${pObj?.fullName || personaId}`, 'success');
  }

  async function playPersonaPreview(personaId, gender) {
    const key = `${gender}_${personaId}`;
    if (activePlayingPersonaId === key && currentPreviewAudio) {
      currentPreviewAudio.pause();
      currentPreviewAudio = null;
      activePlayingPersonaId = null;
      renderVoiceGallery(document.getElementById('voice-gender-select')?.value || 'all');
      return;
    }

    if (currentPreviewAudio) {
      currentPreviewAudio.pause();
      currentPreviewAudio = null;
    }

    const pObj = (VOICE_PERSONAS[gender] || []).find(x => x.id === personaId) || {};
    const phrase = pObj.previewText || 'مرحباً بكم، هذا نموذج صوتي واقعي بالذكاء الاصطناعي.';
    activePlayingPersonaId = key;
    renderVoiceGallery(document.getElementById('voice-gender-select')?.value || 'all');

    try {
      const engine = document.getElementById('voice-engine-select')?.value || 'gemini';
      const res = await gatewayFetch('generate_tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: phrase,
          performance: personaId,
          gender: gender,
          dialect: document.getElementById('voice-dialect-select')?.value || 'egyptian',
          engine: engine
        })
      });

      if (!res.ok) throw new Error('فشل توليد المعاينة');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      currentPreviewAudio = new Audio(url);
      currentPreviewAudio.onended = () => {
        activePlayingPersonaId = null;
        renderVoiceGallery(document.getElementById('voice-gender-select')?.value || 'all');
      };
      currentPreviewAudio.play();
    } catch (e) {
      console.warn('[Persona Preview]', e);
      activePlayingPersonaId = null;
      renderVoiceGallery(document.getElementById('voice-gender-select')?.value || 'all');
      showToast('تعذر تشغيل المعاينة، تحقق من الاتصال أو مفتاح Gemini', 'warning');
    }
  }

  function concatWavBuffers(buffers) {
    if (buffers.length === 1) return new Blob([buffers[0]], { type: 'audio/wav' });
    
    const firstView = new DataView(buffers[0]);
    const isWav = buffers[0].byteLength >= 44 && 
                  String.fromCharCode(firstView.getUint8(0), firstView.getUint8(1), firstView.getUint8(2), firstView.getUint8(3)) === 'RIFF';

    if (!isWav) {
      return new Blob(buffers, { type: 'audio/mpeg' });
    }

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

  // -----------------------------------------------------------------
  // PODCAST STUDIO (DUAL-SPEAKER MULTI-TURN SYNTHESIS)
  // -----------------------------------------------------------------
  async function generatePodcastScript() {
    const topicInput = document.getElementById('podcast-topic-input');
    const topic = topicInput?.value.trim() || 'الذكاء الاصطناعي في صناعة الفيديو والمونتاج';
    const s1Name = document.getElementById('podcast-speaker1-name')?.value || 'المحاور';
    const s2Name = document.getElementById('podcast-speaker2-name')?.value || 'الضيف';
    const btn = document.getElementById('btn-gen-podcast-script');
    if (btn) btn.disabled = true;

    try {
      showToast('جاري تأليف حوار البودكاست الذكي...', 'info');
      const prompt = `اكتب سيناريو حلقة بودكاست حوارية عربية قصيرة وشيقة بين "${s1Name}" و "${s2Name}" حول موضوع: "${topic}".
اكتب كل دور في سطر منفصل يبدأ بـ "${s1Name}: " أو "${s2Name}: ".
الحوار يتكون من 4 إلى 6 أسطر فقط، طبيعي وواقعي وممتع. لا تكتب أي مقدمات أو ملاحظات خارجية.`;

      const res = await gatewayFetch('generate_text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: false })
      });

      if (res.ok) {
        const data = await res.json();
        const script = data.text || data.response || data.content;
        if (script) {
          document.getElementById('podcast-dialog-input').value = script.trim();
          showToast('تم تأليف سيناريو البودكاست بنجاح!', 'success');
          return;
        }
      }
      throw new Error('Fallback needed');
    } catch (e) {
      document.getElementById('podcast-dialog-input').value = 
`${s1Name}: مرحباً بكم في حلقة جديدة من البودكاست، وحديثنا اليوم عن ${topic}.
${s2Name}: أهلاً بك يا ${s1Name}، سعيد جداً بتواجدي معكم لمناقشة هذا التطور المذهل.
${s1Name}: ما هي أبرز التقنيات التي تراها الأكثر تأثيراً على صناع المحتوى الآن؟
${s2Name}: بلا شك، نماذج الصوت والذكاء الاصطناعي التي تختصر ساعات العمل في ثوانٍ معدودة.
${s1Name}: شكراً لك على هذه الرؤية الملهمة، وإلى لقاء قريب في الحلقة القادمة.`;
      showToast('تم إدراج نموذج حوار بودكاست جاهز!', 'success');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  let STATE_PODCAST = { lastAudioBlob: null, lastAudioUrl: null };

  async function generatePodcastAudio() {
    const textInput = document.getElementById('podcast-dialog-input');
    const script = textInput?.value.trim();
    if (!script) {
      showToast('يرجى كتابة أو توليد سيناريو الحوار أولاً!', 'warning');
      return;
    }

    if (window.MickeyStudio?.authorizeAndConsume) {
      if (!await window.MickeyStudio.authorizeAndConsume('podcast')) return;
    } else if (typeof authorizeAndConsume === 'function') {
      if (!await authorizeAndConsume('podcast')) return;
    }

    const s1Name = (document.getElementById('podcast-speaker1-name')?.value || 'المحاور').trim();
    const s2Name = (document.getElementById('podcast-speaker2-name')?.value || 'الضيف').trim();
    const s1Voice = document.getElementById('podcast-speaker1-voice')?.value || 'rami';
    const s2Voice = document.getElementById('podcast-speaker2-voice')?.value || 'mariam';
    const dialect = document.getElementById('podcast-dialect-select')?.value || 'egyptian';
    const engine = document.getElementById('podcast-engine-select')?.value || 'gemini';
    const btn = document.getElementById('btn-generate-podcast');
    btn.disabled = true;
    showToast('جاري إنتاج أصوات المتحاورين ودمج الحلقة...', 'info');

    try {
      const lines = script.split('\n').map(l => l.trim()).filter(Boolean);
      const audioBuffers = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let speakerVoice = s1Voice;
        let speakerGender = ['mariam', 'laila', 'sama', 'salma', 'farida'].includes(s1Voice) ? 'female' : 'male';
        let cleanText = line;

        if (line.startsWith(s2Name) || line.startsWith('الضيف')) {
          speakerVoice = s2Voice;
          speakerGender = ['mariam', 'laila', 'sama', 'salma', 'farida'].includes(s2Voice) ? 'female' : 'male';
          cleanText = line.replace(new RegExp(`^${s2Name}\\s*[:：]\\s*`, 'i'), '').replace(/^الضيف\s*[:：]\\s*/i, '');
        } else if (line.startsWith(s1Name) || line.startsWith('المحاور')) {
          cleanText = line.replace(new RegExp(`^${s1Name}\\s*[:：]\\s*`, 'i'), '').replace(/^المحاور\s*[:：]\\s*/i, '');
        }

        if (!cleanText.trim()) continue;

        const res = await gatewayFetch('generate_tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanText,
            performance: speakerVoice,
            gender: speakerGender,
            dialect,
            engine
          })
        });

        if (!res.ok) throw new Error(`فشل توليد مقطع: ${cleanText.slice(0, 20)}`);
        const ab = await res.arrayBuffer();
        audioBuffers.push(ab);
      }

      if (audioBuffers.length === 0) throw new Error('لم يتم استخراج أي أسطر صوتية من الحوار.');

      const unifiedBlob = concatWavBuffers(audioBuffers);
      const url = URL.createObjectURL(unifiedBlob);
      STATE_PODCAST.lastAudioBlob = unifiedBlob;
      STATE_PODCAST.lastAudioUrl = url;

      const playerCard = document.getElementById('podcast-active-player');
      const emptyView = document.getElementById('podcast-empty-view');
      const audioEl = document.getElementById('podcast-audio-element');

      if (emptyView) emptyView.classList.add('hidden');
      if (playerCard) playerCard.classList.remove('hidden');
      if (audioEl) {
        audioEl.src = url;
        audioEl.play().catch(() => {});
      }

      showToast('تم إنتاج حلقة البودكاست الثنائية بنجاح!', 'success');
    } catch (err) {
      console.error('[Podcast Gen]', err);
      showToast(err.message || 'تعذر إنتاج حلقة البودكاست.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function downloadPodcastAudio() {
    if (!STATE_PODCAST.lastAudioUrl) return;
    const a = document.createElement('a');
    a.href = STATE_PODCAST.lastAudioUrl;
    a.download = `podcast_${Date.now()}.wav`;
    a.click();
  }

  async function savePodcastToVault() {
    if (!STATE_PODCAST.lastAudioUrl) return;
    const asset = {
      id: 'podcast_' + Date.now(),
      type: 'audio',
      title: 'حلقة بودكاست: ' + (document.getElementById('podcast-topic-input')?.value || 'محادثة ثنائية').slice(0, 30),
      url: STATE_PODCAST.lastAudioUrl,
      prompt: 'بودكاست ثنائي متحدثين',
      timestamp: Date.now()
    };
    await saveAssetToDB(asset);
    showToast('تم حفظ البودكاست في المعرض!', 'success');
  }

  // -----------------------------------------------------------------
  // AUDIOBOOK STUDIO (CHAPTER-BASED NARRATIVE SYNTHESIS)
  // -----------------------------------------------------------------
  let STATE_AUDIOBOOK = { lastAudioBlob: null, lastAudioUrl: null };

  async function generateAudiobookChapter() {
    const textInput = document.getElementById('book-chapter-text');
    const text = textInput?.value.trim();
    if (!text) {
      showToast('يرجى إدخال نص الفصل المراد تسجيله!', 'warning');
      return;
    }

    if (window.MickeyStudio?.authorizeAndConsume) {
      if (!await window.MickeyStudio.authorizeAndConsume('audiobook')) return;
    } else if (typeof authorizeAndConsume === 'function') {
      if (!await authorizeAndConsume('audiobook')) return;
    }

    const bookTitle = document.getElementById('book-title-input')?.value.trim() || 'رواية جديدة';
    const chapterTitle = document.getElementById('chapter-title-input')?.value.trim() || 'الفصل الأول';
    const narrator = document.getElementById('book-narrator-select')?.value || 'mariam';
    const gender = ['mariam', 'farida', 'salma'].includes(narrator) ? 'female' : 'male';
    const mood = document.getElementById('book-mood-select')?.value || 'mystery';
    const pace = Number(document.getElementById('book-pace-select')?.value) || 1.0;
    const engine = document.getElementById('voice-engine-select')?.value || 'gemini';
    const btn = document.getElementById('btn-generate-audiobook');
    btn.disabled = true;
    showToast('جاري تسجيل الفصل الصوتي بصوت الراوي المختار...', 'info');

    try {
      const res = await gatewayFetch('generate_tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          performance: narrator,
          gender,
          dialect: 'fusha',
          rate: pace,
          engine,
          style: `Audiobook chapter reading for "${bookTitle} - ${chapterTitle}". Atmospheric mood: ${mood}. Professional literary storytelling narration with proper dramatic pauses.`
        })
      });

      if (!res.ok) throw new Error('فشل تسجيل الفصل الصوتي.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      STATE_AUDIOBOOK.lastAudioBlob = blob;
      STATE_AUDIOBOOK.lastAudioUrl = url;

      const playerCard = document.getElementById('audiobook-active-player');
      const emptyView = document.getElementById('audiobook-empty-view');
      const audioEl = document.getElementById('audiobook-audio-element');
      const bookEl = document.getElementById('audiobook-player-book');
      const chapEl = document.getElementById('audiobook-player-chapter');

      if (emptyView) emptyView.classList.add('hidden');
      if (playerCard) playerCard.classList.remove('hidden');
      if (bookEl) bookEl.textContent = bookTitle;
      if (chapEl) chapEl.textContent = chapterTitle;
      if (audioEl) {
        audioEl.src = url;
        audioEl.play().catch(() => {});
      }

      showToast(`تم إنتاج الفصل "${chapterTitle}" بنجاح!`, 'success');
    } catch (e) {
      console.error('[Audiobook Gen]', e);
      showToast(e.message || 'تعذر إنتاج الفصل الصوتي.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function downloadAudiobookAudio() {
    if (!STATE_AUDIOBOOK.lastAudioUrl) return;
    const bookTitle = document.getElementById('book-title-input')?.value.trim() || 'Audiobook';
    const a = document.createElement('a');
    a.href = STATE_AUDIOBOOK.lastAudioUrl;
    a.download = `${bookTitle}_${Date.now()}.wav`;
    a.click();
  }

  async function saveAudiobookToVault() {
    if (!STATE_AUDIOBOOK.lastAudioUrl) return;
    const bookTitle = document.getElementById('book-title-input')?.value.trim() || 'كتاب صوتي';
    const chapTitle = document.getElementById('chapter-title-input')?.value.trim() || 'الفصل';
    const asset = {
      id: 'audiobook_' + Date.now(),
      type: 'audio',
      title: `${bookTitle} · ${chapTitle}`,
      url: STATE_AUDIOBOOK.lastAudioUrl,
      prompt: 'كتاب صوتي ورواية',
      timestamp: Date.now()
    };
    await saveAssetToDB(asset);
    showToast('تم حفظ الفصل في المعرض!', 'success');
  }

  // -----------------------------------------------------------------
  // VOICE OVER GENERATION
  // -----------------------------------------------------------------
  async function generateVoiceover() {
    const textInput = document.getElementById('voice-text-input');
    const text = textInput ? textInput.value.trim() : '';
    if (!text) { showToast('يرجى كتابة نص لتوليد التعليق الصوتي!', 'warning'); return; }
    if (text.length > 6000) { showToast('النص طويل جدًا. الحد الأقصى 6000 حرف لكل ملف صوتي.', 'warning'); return; }
    if (!await authorizeAndConsume('voiceover')) return;

    const button = document.getElementById('btn-generate-voice');
    const scanner = document.getElementById('voice-laser-scanner');
    const emptyState = document.getElementById('voice-empty-state');
    const activeControls = document.getElementById('voice-active-controls');
    const actionsBar = document.getElementById('voice-actions-bar');
    const statusPill = document.getElementById('voice-process-status');
    const audioEl = document.getElementById('final-rendered-audio');
    const rate = Number(document.getElementById('voice-rate-slider')?.value) || 1;
    const pitch = Number(document.getElementById('voice-pitch-slider')?.value) || 1;
    const dialectSelect = document.getElementById('voice-dialect-select');
    const dialect = dialectSelect?.value || 'egyptian';
    const dialectLabel = dialectSelect?.selectedOptions?.[0]?.textContent || 'المصرية';
    const gender = document.getElementById('voice-gender-select')?.value || 'male';
    const genderLabel = gender === 'female' ? 'نسائي' : 'رجالي';
    const age = document.getElementById('voice-age-select')?.value || 'adult';
    const performance = document.getElementById('voice-performance-select')?.value || 'neutral';
    const warmth = document.getElementById('voice-warmth-select')?.value || 'balanced';
    const emotion = document.getElementById('voice-emotion-select')?.value || 'medium';
    const intensity = document.getElementById('voice-intensity-select')?.value || 'medium';
    const voices = {
      yusuf: ['Charon', 'Kore', 'authoritative documentary narration, deep, measured, and confident'],
      malik: ['Puck', 'Sadachbia', 'bright, energetic commercial delivery with clear articulation'],
      rami: ['Iapetus', 'Aoede', 'warm, natural, conversational podcast delivery'],
      saif: ['Fenrir', 'Sulafat', 'dramatic, emotionally engaging narration with controlled intensity'],
      zaid: ['Rasalgethi', 'Vindemiatrix', 'expressive storytelling, vivid and steady'],
      mariam: ['Rasalgethi', 'Vindemiatrix', 'expressive, warm storytelling narration with serene pacing'],
      laila: ['Puck', 'Sadachbia', 'bright, fast, confident commercial and marketing delivery'],
      sama: ['Iapetus', 'Aoede', 'lively, friendly, natural podcast and social media delivery'],
      salma: ['Fenrir', 'Sulafat', 'deeply emotional and expressive dramatic delivery'],
      farida: ['Charon', 'Kore', 'poised, authoritative documentary narration with deep presence'],
      neutral: ['Orus', 'Schedar', 'balanced, natural, and clear delivery'],
    };
    const dialects = { egyptian: 'Egyptian Arabic', saudi: 'Saudi Arabic', levantine: 'Levantine Arabic', iraqi: 'Iraqi Arabic', algerian: 'Algerian Arabic', moroccan: 'Moroccan Arabic', tunisian: 'Tunisian Arabic', gulf: 'Gulf Arabic', fusha: 'Modern Standard Arabic' };
    const performanceInfo = voices[performance] || voices.neutral;
    const voice = gender === 'female' ? performanceInfo[1] : performanceInfo[0];
    const ageStyle = ({ adult: 'adult', senior: 'older adult', cartoon: 'animated character' })[age] || 'adult';
    const warmthStyle = ({ cool: 'cool and composed', balanced: 'balanced warmth', warm: 'warm and human' })[warmth] || 'balanced warmth';
    const emotionStyle = ({ calm: 'calm and restrained', medium: 'moderately expressive', strong: 'highly expressive' })[emotion] || 'moderately expressive';
    const intensityStyle = ({ light: 'subtle dramatic intensity', medium: 'moderate dramatic intensity', strong: 'strong dramatic intensity' })[intensity] || 'moderate dramatic intensity';
    const style = `Speak in ${dialects[dialect] || dialects.egyptian}, with a ${gender === 'female' ? 'feminine' : 'masculine'} ${ageStyle} voice. Use ${performanceInfo[2]}; be ${warmthStyle} and ${emotionStyle}, with ${intensityStyle}. Pace ${rate < 0.9 ? 'slowly' : rate > 1.1 ? 'briskly' : 'at a natural pace'} (${rate.toFixed(2)}x), with a ${pitch < 0.9 ? 'lower' : pitch > 1.1 ? 'higher' : 'natural'} pitch. Read the supplied Arabic text verbatim; do not translate it or say these directions aloud.`;

    const speakerBadge = document.getElementById('player-speaker-badge');
    if (speakerBadge) speakerBadge.textContent = `${dialectLabel} · صوت ${genderLabel}`;
    SFX.playLaser();
    button.disabled = true;
    scanner.classList.remove('hidden');
    emptyState.classList.add('hidden');
    activeControls.classList.add('hidden');
    if (actionsBar) actionsBar.classList.add('opacity-0', 'pointer-events-none');
    
    const engine = document.getElementById('voice-engine-select')?.value || 'gemini';
    statusPill.textContent = engine === 'gemini' ? 'جاري التوليد عبر استوديو Gemini 3.8 Flash TTS…' : 'جاري التوليد عبر Google Translate TTS…';
    try {
      const response = await gatewayFetch('generate_tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, voice, style, rate, pitch, dialect, gender, performance, age, warmth, emotion, intensity,
          engine,
          model: 'gemini-3.8-flash-tts',
          input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style }] }] }],
          response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
          generation_config: { speech_config: [{ voice }] },
        }),
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        const errorData = contentType.includes('json') ? await response.json().catch(() => ({})) : {};
        if (response.status === 429) updateQuotaBadge('voice', 0);
        throw new Error(errorData.error?.message || errorData.error || `تعذر إنشاء الصوت من الخادم (${response.status}).`);
      }
      let bytes;
      let respJson = null;
      if (contentType.startsWith('audio/')) {
        bytes = new Uint8Array(await response.arrayBuffer());
      } else {
        respJson = await response.json().catch(() => ({}));
        if (respJson?.quota?.tool) updateQuotaBadge(respJson.quota.tool, respJson.quota.remaining, respJson.quota.limit);
        const audioData = respJson.output_audio?.data || respJson._media_base64 || respJson.base64Data || (respJson.steps || []).flatMap(step => step.content || []).reverse().find(item => item.type === 'audio' && item.data)?.data;
        if (!audioData) throw new Error(respJson.error || 'لم يُرجع الخادم بيانات صوتية صالحة.');
        bytes = Uint8Array.from(atob(audioData), char => char.charCodeAt(0));
      }
      const isWav = bytes.length > 100 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WAVE';
      const isMp3 = bytes.length > 100 && (
        contentType.includes('mpeg') || contentType.includes('mp3') ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) ||
        (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)
      );
      if (!isWav && !isMp3 && bytes.length < 100) throw new Error('ملف الصوت غير صالح.');

      const audioMime = isWav ? 'audio/wav' : 'audio/mpeg';
      const generatedBlob = new Blob([bytes], { type: audioMime });
      if (STATE.voice.lastAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(STATE.voice.lastAudioUrl);
      const generatedUrl = URL.createObjectURL(generatedBlob);
      STATE.voice.lastAudioBlob = generatedBlob;
      STATE.voice.lastAudioUrl = generatedUrl;
      audioEl.src = generatedUrl;
      audioEl.load();
      scanner.classList.add('hidden');
      activeControls.classList.remove('hidden');
      if (actionsBar) actionsBar.classList.remove('opacity-0', 'pointer-events-none');
      
      const reportedEngine = response.headers.get('X-TTS-Engine') || '';
      const engineUsed = respJson?.engine_used || (reportedEngine.includes('Gemini') || (!reportedEngine && isWav) ? 'gemini' : 'google-translate');
      const isGeminiEngine = engineUsed === 'gemini';
      const engineTitle = isGeminiEngine ? 'Gemini 3.8 Flash TTS' : 'Google Translate TTS';
      statusPill.textContent = `اكتمل · ${engineTitle} · ${dialectLabel} · ${genderLabel}`;
      
      setupCustomAudioPlayer(audioEl);
      setupAudioSpectrumVisualizer(audioEl);
      audioEl.play().catch(() => {});
      const optionCustom = document.getElementById('option-custom-voiceover');
      if (optionCustom) { optionCustom.disabled = false; optionCustom.textContent = 'التعليق الصوتي المولد حديثاً ✓'; }
      SFX.playSuccess();
      showToast(respJson?.engine_note || `تم توليد التعليق الصوتي بنجاح عبر ${engineTitle}!`, 'success');
    } catch (error) {
      scanner.classList.add('hidden');
      emptyState.classList.remove('hidden');
      statusPill.textContent = 'تعذر إنشاء الملف';
      showToast(error.message || 'تعذر إنشاء التعليق الصوتي.', 'error');
    } finally { button.disabled = false; }
  }

  function onVoiceEngineChanged() {
    const engine = document.getElementById('voice-engine-select')?.value || 'gemini';
    const badge = document.getElementById('voice-engine-badge');
    const descHint = document.getElementById('voice-engine-desc-hint');
    if (badge) {
      badge.textContent = engine === 'gemini' ? 'WAV استوديو سينمائي (افتراضي)' : 'Google Translate TTS (مجاني)';
      badge.className = `text-[10px] font-mono ${engine === 'gemini' ? 'text-cyan-400' : 'text-sky-400'}`;
    }
    if (descHint) {
      descHint.textContent = engine === 'gemini'
        ? 'يستخدم Gemini 3.8 Flash TTS لتوليد WAV بنبرة ولهجة وأداء موجّه فائق الدقة (مدار تلقائياً عبر مفاتيح الخادم النشطة مع التدوير الذاتي).'
        : 'يستخدم Google Translate TTS مجانًا. هذا الخيار لا يدعم اختيار شخصية الصوت أو ضمان نوعه.';
    }
  }

  async function saveGeminiKeyFromVoiceStudio() {
    const input = document.getElementById('voice-gemini-key-input');
    const status = document.getElementById('voice-gemini-key-status');
    const val = input ? input.value.trim() : '';
    try {
      const response = await gatewayFetch('save_gemini_key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiKey: val, action: 'save_gemini_key' })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'تعذر حفظ المفتاح في Firestore.');
      if (input) input.value = '';
      localStorage.removeItem('mickey_gemini_key');
      if (status) status.textContent = val ? `✓ محفوظ في Firestore (${data.masked_key})` : 'تم حذف المفتاح من Firestore';
      showToast(data.message || (val ? 'تم حفظ مفتاح Google Gemini بشكل آمن في Firestore.' : 'تم حذف مفتاح Gemini من Firestore.'), 'success');
    } catch (e) {
      if (status) status.textContent = 'تعذر الحفظ في Firestore';
      showToast(e.message || 'تعذر حفظ مفتاح Gemini في Firestore.', 'error');
    }
  }

  async function downloadCurrentAudio() {
    SFX.playClick();
    const filename = `mickey_voiceover_${Date.now()}.wav`;
    if (STATE.voice.lastAudioBlob) {
      downloadBlob(STATE.voice.lastAudioBlob, filename);
      showToast('جاري تنزيل التعليق الصوتي بصيغة WAV.', 'success');
      return;
    }
    showToast('أنشئ التعليق الصوتي أولاً، ثم نزّله من المشغل.', 'warning');
  }
  function transferAudioToVideoStudio() {
    if (!STATE.voice.lastAudioBlob) {
      showToast('يرجى توليد تعليق صوتي أولاً لنقله!', 'warning');
      return;
    }
    SFX.playClick();
    switchTab('video-studio');

    const select = document.getElementById('video-soundtrack-select');
    const badge = document.getElementById('video-attached-audio-badge');
    if (select) select.value = 'voiceover-custom';
    if (badge) badge.classList.remove('hidden');

    showToast('تم دمج التعليق الصوتي في استوديو الفيديو تلقائياً!', 'success');
  }

  // -----------------------------------------------------------------

  const exports = {
    generateAiScript,
    refineVoiceScript,
    generateVoiceover,
    downloadCurrentAudio,
    onVoiceEngineChanged,
    onVoiceGenderChanged,
    filterVoiceGallery,
    renderVoiceGallery,
    selectPersonaFromGallery,
    playPersonaPreview,
    generatePodcastScript,
    generatePodcastAudio,
    downloadPodcastAudio,
    savePodcastToVault,
    generateAudiobookChapter,
    downloadAudiobookAudio,
    saveAudiobookToVault,
    saveGeminiKeyFromVoiceStudio,
    toggleCustomPlay,
    skipAudio,
    toggleAudioLoop,
    cycleAudioSpeed,
    setVolume,
    toggleMute,
    transferAudioToVideoStudio
  };

  if (typeof window.MickeyStudio !== 'undefined') {
    Object.assign(window.MickeyStudio, exports);
  }

  root.VoiceStudio = exports;

})(typeof window !== 'undefined' ? window : this);
