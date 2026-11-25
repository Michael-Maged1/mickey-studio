/**
 * Mickey Studio - Speech-to-Text & Transcribe Studio Module
 * Dynamic Studio Chunk: Arabic Speech-to-text, Web Speech API, SRT and Insights Generation.
 */
(function (root) {
  'use strict';

  const STATE = window.MickeyStudio.STATE;
  const SFX = window.MickeyStudio.SFX;
  const showToast = window.MickeyStudio.showToast || window.showToast;
  const gatewayFetch = window.MickeyStudio.gatewayFetch;
  const updateQuotaBadge = window.MickeyStudio.updateQuotaBadge;
  const authorizeAndConsume = window.MickeyStudio.authorizeAndConsume;

  // 11. STUDIO 5: ARABIC SPEECH-TO-TEXT & AUDIO ANALYSIS STUDIO
  // -----------------------------------------------------------------
  function setTranscribeMode(mode) {
    STATE.transcribe.mode = mode;
    SFX.playClick();

    const btnUpload = document.getElementById('btn-mode-upload');
    const btnRecord = document.getElementById('btn-mode-record');
    const containerUpload = document.getElementById('transcribe-upload-container');
    const containerRecord = document.getElementById('transcribe-record-container');

    if (mode === 'upload') {
      if (btnUpload) btnUpload.classList.add('active');
      if (btnRecord) btnRecord.classList.remove('active');
      if (containerUpload) containerUpload.classList.remove('hidden');
      if (containerRecord) containerRecord.classList.add('hidden');
    } else {
      if (btnRecord) btnRecord.classList.add('active');
      if (btnUpload) btnUpload.classList.remove('active');
      if (containerRecord) containerRecord.classList.remove('hidden');
      if (containerUpload) containerUpload.classList.add('hidden');
    }
  }

  function handleTranscribeFileUpload(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    SFX.playClick();
    STATE.transcribe.audioFile = file;
    STATE.transcribe.audioBlob = file;
    STATE.transcribe.audioMime = file.type || 'audio/mp3';
    STATE.transcribe.audioUrl = URL.createObjectURL(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const b64 = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;
      STATE.transcribe.audioBase64 = b64;
    };
    reader.readAsDataURL(file);

    const previewEl = document.getElementById('transcribe-file-preview');
    const emptyEl = document.getElementById('transcribe-upload-empty');
    const nameEl = document.getElementById('transcribe-file-name');
    const sizeEl = document.getElementById('transcribe-file-size');
    const statusPill = document.getElementById('transcribe-status-pill');

    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    if (previewEl) previewEl.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (statusPill) statusPill.textContent = 'تم اختيار الملف - جاهز للتفريغ والتحليل ✓';

    const player = document.getElementById('transcribe-audio-player');
    if (player) {
      player.src = STATE.transcribe.audioUrl;
    }
    const titleEl = document.getElementById('transcribe-audio-title');
    if (titleEl) titleEl.textContent = file.name;

    showToast('تم تحميل الملف الصوتي بنجاح!', 'success');
  }

  function clearTranscribeFile() {
    STATE.transcribe.audioFile = null;
    STATE.transcribe.audioBlob = null;
    STATE.transcribe.audioUrl = null;
    STATE.transcribe.audioBase64 = null;

    const input = document.getElementById('transcribe-file-input');
    if (input) input.value = '';

    const previewEl = document.getElementById('transcribe-file-preview');
    const emptyEl = document.getElementById('transcribe-upload-empty');
    const statusPill = document.getElementById('transcribe-status-pill');

    if (previewEl) previewEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (statusPill) statusPill.textContent = 'جاهز للتفريغ والتحليل';
    SFX.playClick();
  }

  async function loadSampleArabicAudio() {
    SFX.playClick();
    showToast('جاري تحميل عينة صوتية عربية فصيحة...', 'info');

    const sampleText = 'مرحباً بكم في استوديو ميكي للذكاء الاصطناعي. نقدم لكم اليوم تجربة متكاملة لتحويل الكلام العربي المنطوق إلى نصوص مكتوبة بدقة فائقة، مع استخراج ملفات الترجمة لبرامج المونتاج مثل بريمير، وتحليل المشاعر ونبرة الصوت.';
    const sampleUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Tariq&text=${encodeURIComponent(sampleText)}`;

    try {
      const res = await fetch(sampleUrl);
      if (!res.ok) throw new Error('Failed to fetch sample');
      const blob = await res.blob();
      STATE.transcribe.audioBlob = blob;
      STATE.transcribe.audioMime = 'audio/mp3';
      STATE.transcribe.audioUrl = URL.createObjectURL(blob);

      const reader = new FileReader();
      reader.onload = (e) => {
        const b64 = e.target.result.split('base64,')[1];
        STATE.transcribe.audioBase64 = b64;
      };
      reader.readAsDataURL(blob);

      setTranscribeMode('upload');
      const previewEl = document.getElementById('transcribe-file-preview');
      const emptyEl = document.getElementById('transcribe-upload-empty');
      const nameEl = document.getElementById('transcribe-file-name');
      const sizeEl = document.getElementById('transcribe-file-size');
      const titleEl = document.getElementById('transcribe-audio-title');
      const player = document.getElementById('transcribe-audio-player');
      const statusPill = document.getElementById('transcribe-status-pill');

      if (nameEl) nameEl.textContent = 'عينة_صوت_عربي_فصحى.mp3';
      if (sizeEl) sizeEl.textContent = (blob.size / 1024).toFixed(1) + ' KB';
      if (previewEl) previewEl.classList.remove('hidden');
      if (emptyEl) emptyEl.classList.add('hidden');
      if (titleEl) titleEl.textContent = 'عينة_صوت_عربي_فصحى.mp3';
      if (player) player.src = STATE.transcribe.audioUrl;
      if (statusPill) statusPill.textContent = 'العينة التجريبية جاهزة للتفريغ والتحليل ✓';

      SFX.playSuccess();
      showToast('تم تحميل العينة الصوتية! اضغط على "بدء تفريغ وتحليل الصوت".', 'success');
    } catch (err) {
      showToast('تعذر تحميل العينة، يرجى رفع ملف أو استخدام الميكروفون', 'warning');
    }
  }

  let liveSpeechRecInstance = null;
  let liveSpeechTranscriptAccumulated = '';

  async function toggleLiveRecording() {
    if (STATE.transcribe.isRecording) {
      stopLiveRecording();
    } else {
      await startLiveRecording();
    }
  }

  async function startLiveRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      STATE.transcribe.audioStream = stream;
      STATE.transcribe.isRecording = true;
      SFX.playClick();

      const pulseRing = document.getElementById('rec-pulse-ring');
      const recBtnIcon = document.getElementById('rec-btn-icon');
      const recStatus = document.getElementById('rec-status-label');
      const recLiveMeter = document.getElementById('rec-live-meter');
      const timerEl = document.getElementById('rec-timer');

      if (pulseRing) pulseRing.classList.remove('hidden');
      if (recBtnIcon) recBtnIcon.className = 'fa-solid fa-stop text-lg text-white';
      if (recStatus) recStatus.textContent = 'جاري التسجيل المباشر... تحدث بوضوح';
      if (recLiveMeter) recLiveMeter.classList.remove('hidden');

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const actx = new AudioCtx();
        const src = actx.createMediaStreamSource(stream);
        const analyser = actx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const volBar = document.getElementById('rec-volume-bar');

        function updateMeter() {
          if (!STATE.transcribe.isRecording) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const pct = Math.min(100, Math.round((avg / 128) * 100));
          if (volBar) volBar.style.width = pct + '%';
          requestAnimationFrame(updateMeter);
        }
        updateMeter();
      } catch (e) {}

      STATE.transcribe.recSeconds = 0;
      if (timerEl) timerEl.textContent = '00:00';
      clearInterval(STATE.transcribe.recInterval);
      STATE.transcribe.recInterval = setInterval(() => {
        STATE.transcribe.recSeconds++;
        const mins = String(Math.floor(STATE.transcribe.recSeconds / 60)).padStart(2, '0');
        const secs = String(STATE.transcribe.recSeconds % 60).padStart(2, '0');
        if (timerEl) timerEl.textContent = `${mins}:${secs}`;
      }, 1000);

      const recordedChunks = [];
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : (MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : '');
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      STATE.transcribe.mediaRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(recordedChunks, { type: mimeType || 'audio/webm' });
        STATE.transcribe.audioBlob = audioBlob;
        STATE.transcribe.audioMime = mimeType || 'audio/webm';
        STATE.transcribe.audioUrl = URL.createObjectURL(audioBlob);

        const reader = new FileReader();
        reader.onload = (e) => {
          const b64 = e.target.result.split('base64,')[1];
          STATE.transcribe.audioBase64 = b64;
        };
        reader.readAsDataURL(audioBlob);

        const player = document.getElementById('transcribe-audio-player');
        if (player) player.src = STATE.transcribe.audioUrl;
        const titleEl = document.getElementById('transcribe-audio-title');
        if (titleEl) titleEl.textContent = `تسجيل_مباشر_${new Date().toLocaleTimeString('ar-EG')}.webm`;

        const statusPill = document.getElementById('transcribe-status-pill');
        if (statusPill) statusPill.textContent = 'تم اكتمال التسجيل - جاهز للتفريغ والتحليل ✓';
      };

      recorder.start(250);

      liveSpeechTranscriptAccumulated = '';
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          liveSpeechRecInstance = new SpeechRecognition();
          liveSpeechRecInstance.continuous = true;
          liveSpeechRecInstance.interimResults = true;
          const dialect = document.getElementById('transcribe-dialect-select')?.value || 'auto';
          liveSpeechRecInstance.lang = dialect === 'egyptian' ? 'ar-EG' : (dialect === 'gulf' ? 'ar-SA' : (dialect === 'maghrebi' ? 'ar-MA' : 'ar-SA'));

          liveSpeechRecInstance.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                liveSpeechTranscriptAccumulated += event.results[i][0].transcript + ' ';
              } else {
                interim += event.results[i][0].transcript;
              }
            }
          };
          liveSpeechRecInstance.start();
        } catch (e) {}
      }

    } catch (err) {
      console.error(err);
      showToast('تعذر الوصول إلى الميكروفون، يرجى منح الإذن للمتصفح', 'error');
    }
  }

  function stopLiveRecording() {
    STATE.transcribe.isRecording = false;
    SFX.playClick();

    const pulseRing = document.getElementById('rec-pulse-ring');
    const recBtnIcon = document.getElementById('rec-btn-icon');
    const recStatus = document.getElementById('rec-status-label');
    const recLiveMeter = document.getElementById('rec-live-meter');

    if (pulseRing) pulseRing.classList.add('hidden');
    if (recBtnIcon) recBtnIcon.className = 'fa-solid fa-microphone text-xl text-white';
    if (recStatus) recStatus.textContent = 'تم حفظ التسجيل! اضغط على زر التفريغ بالأسفل';
    if (recLiveMeter) recLiveMeter.classList.add('hidden');

    clearInterval(STATE.transcribe.recInterval);

    if (STATE.transcribe.mediaRecorder && STATE.transcribe.mediaRecorder.state !== 'inactive') {
      STATE.transcribe.mediaRecorder.stop();
    }

    if (STATE.transcribe.audioStream) {
      STATE.transcribe.audioStream.getTracks().forEach(track => track.stop());
      STATE.transcribe.audioStream = null;
    }

    if (liveSpeechRecInstance) {
      try { liveSpeechRecInstance.stop(); } catch (e) {}
      liveSpeechRecInstance = null;
    }

    SFX.playSuccess();
    showToast('تم حفظ التسجيل الصوتي بنجاح!', 'success');
  }

  function setTranscribeOutputTab(tabKey) {
    STATE.transcribe.outputTab = tabKey;
    SFX.playClick();

    ['transcript', 'srt', 'insights'].forEach(key => {
      const btn = document.getElementById('tab-out-' + key);
      const view = document.getElementById('view-transcribe-' + key);
      if (btn) {
        if (key === tabKey) btn.classList.add('active');
        else btn.classList.remove('active');
      }
      if (view) {
        if (key === tabKey) view.classList.remove('hidden');
        else view.classList.add('hidden');
      }
    });
  }

  function generateSrtFromTranscript(text, totalDurationSec = 30) {
    if (!text || !text.trim()) return '';
    const sentences = text
      .split(/(?<=[.،؟!؛\n])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sentences.length === 0) return '';
    const durPerSent = Math.max(2.5, totalDurationSec / sentences.length);

    let srt = '';
    sentences.forEach((sentence, idx) => {
      const start = idx * durPerSent;
      const end = (idx + 1) * durPerSent;
      const formatTime = (sec) => {
        const h = String(Math.floor(sec / 3600)).padStart(2, '0');
        const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
        const s = String(Math.floor(sec % 60)).padStart(2, '0');
        const ms = String(Math.floor((sec % 1) * 1000)).padStart(3, '0');
        return `${h}:${m}:${s},${ms}`;
      };

      srt += `${idx + 1}\n${formatTime(start)} --> ${formatTime(end)}\n${sentence}\n\n`;
    });
    return srt.trim();
  }

  async function processAudioTranscription() {
    if (!STATE.transcribe.audioBlob && !STATE.transcribe.audioBase64) {
      showToast('يرجى اختيار ملف صوتي أو تسجيل صوتك أولاً!', 'warning');
      return;
    }
    if (!await authorizeAndConsume('transcription')) return;

    if (!STATE.transcribe.audioBase64 && STATE.transcribe.audioBlob) {
      try {
        STATE.transcribe.audioBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const d = e.target.result;
            resolve(d.includes('base64,') ? d.split('base64,')[1] : d);
          };
          reader.onerror = reject;
          reader.readAsDataURL(STATE.transcribe.audioBlob);
        });
      } catch (e) {}
    }

    SFX.playLaser();
    const scanner = document.getElementById('transcribe-laser-scanner');
    const emptyState = document.getElementById('transcribe-empty-state');
    const resultsContainer = document.getElementById('transcribe-results-container');
    const actionsBar = document.getElementById('transcribe-actions-bar');
    const statusPill = document.getElementById('transcribe-status-pill');

    if (scanner) scanner.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.add('hidden');
    if (actionsBar) actionsBar.classList.add('opacity-0', 'pointer-events-none');
    if (statusPill) statusPill.textContent = 'جاري تحليل الموجات الصوتية وتفريغ الكلام العربي...';

    const engine = document.getElementById('transcribe-engine-select')?.value || 'gemini-multimodal';
    const dialect = document.getElementById('transcribe-dialect-select')?.value || 'auto';

    let dialectLabel = 'فصحى معاصرة';
    if (dialect === 'egyptian') dialectLabel = 'لهجة مصرية';
    else if (dialect === 'gulf') dialectLabel = 'لهجة خليجية';
    else if (dialect === 'levantine') dialectLabel = 'لهجة شامية';
    else if (dialect === 'maghrebi') dialectLabel = 'لهجة مغاربية';
    else if (dialect === 'bilingual') dialectLabel = 'عربي + إنجليزي';

    let parsedResult = null;
    let providerName = 'Google Gemini 1.5 Flash';
    let isSuccess = false;
    let lastGeminiError = '';

    // Determine and clean MIME type
    let cleanMime = (STATE.transcribe.audioMime || '').split(';')[0].trim();
    const fileName = (STATE.transcribe.audioFile?.name || '').toLowerCase();
    if (!cleanMime || cleanMime === 'application/octet-stream') {
      if (fileName.endsWith('.mp4')) cleanMime = 'video/mp4';
      else if (fileName.endsWith('.mp3')) cleanMime = 'audio/mp3';
      else if (fileName.endsWith('.wav')) cleanMime = 'audio/wav';
      else if (fileName.endsWith('.m4a')) cleanMime = 'audio/mp4';
      else if (fileName.endsWith('.webm')) cleanMime = 'audio/webm';
      else if (fileName.endsWith('.ogg')) cleanMime = 'audio/ogg';
      else cleanMime = 'audio/mp3';
    }

    const promptInstruction = "أنت خبير فائق الذكاء في تفريغ وتحليل الصوت والكلام العربي بجميع لهجاته (الفصحى، المصرية، الخليجية، الشامية، المغاربية). "
      + "استمع للصوت العربي المرفق جيداً، وقم بتفريغه وتحليله بدقة متناهية. "
      + (dialect !== 'auto' ? `ملاحظة: المتحدث قد يتحدث بـ (${dialectLabel}). راعِ المفردات الدارجة بدقة. ` : "")
      + "المطلوب منك إخراج كائن JSON فقط (Strict valid JSON) بدون أي كتل برمجية، يحتوي على:\n"
      + "{\n"
      + '  "transcript": "النص الكامل الدقيق للكلام العربي المنطوق، مع وضع علامات الترقيم الصحيحة (الفواصل، النقاط، علامات الاستفهام)، وتنسيق الفقرات بسلاسة.",' + "\n"
      + '  "srt": "توليد ملف ترجمة تزامني قياسي بصيغة SRT مع أرقام الفقرات والتوقيتات التقديرية 00:00:00,000 --> 00:00:00,000 جاهز للمونتاج في بريمير.",' + "\n"
      + '  "dialect": "اللهجة المكتشفة في الصوت (مثال: فصحى معاصرة، لهجة مصرية، لهجة خليجية، شامية، مغاربية)",' + "\n"
      + '  "tone": "نبرة الصوت والمشاعر (مثال: نبرة رسمية وهادئة، حماسية وتشويقية، تعليمية، عاطفية)",' + "\n"
      + '  "summary": "ملخص ذكي وموجز في سطرين لأهم ما جاء في التسجيل الصوتي.",' + "\n"
      + '  "key_points": ["نقطة رئيسية 1", "نقطة رئيسية 2", "نقطة رئيسية 3"],' + "\n"
      + '  "words_count": 0,' + "\n"
      + '  "estimated_speed": "معتدلة (~130 كلمة/دقيقة)"' + "\n"
      + "}";

    // Provider keys remain on the server; all remote transcription runs through api.php.
    if (STATE.transcribe.audioBase64) {
      try {
        const response = await gatewayFetch('transcribe_audio', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio_base64: STATE.transcribe.audioBase64, mime_type: cleanMime, dialect })
        });
        const data = await response.json().catch(() => ({}));
        if (data?.quota?.tool) updateQuotaBadge(data.quota.tool, data.quota.remaining, data.quota.limit);
        if (response.status === 429) updateQuotaBadge('transcription', 0);
        if (response.ok && data.success && data.data) {
          parsedResult = data.data; providerName = data.provider || 'خدمة Mickey Studio'; isSuccess = true;
        } else { lastGeminiError = data.error || `تعذر التفريغ (${response.status}).`; }
      } catch (error) { lastGeminiError = error.message || 'تعذر الاتصال بخادم التفريغ.'; }
    }

    // 4. Fallback to Web Speech text if available
    if (!parsedResult && liveSpeechTranscriptAccumulated && liveSpeechTranscriptAccumulated.trim()) {
      const text = liveSpeechTranscriptAccumulated.trim();
      parsedResult = {
        transcript: text,
        dialect: dialectLabel,
        tone: 'طبيعية ومباشرة',
        summary: text.slice(0, 140) + '...',
        key_points: ['تم تفريغ الصوت مباشرة عبر محرك المتصفح المحلي.'],
        words_count: text.split(/\s+/).length,
        estimated_speed: 'مباشرة'
      };
      providerName = 'محرك المتصفح المباشر (Web Speech API)';
      isSuccess = true;
    }

    // If neither the server nor browser speech recognition returned a transcript.
    if (!parsedResult) {
      const friendlyError = lastGeminiError || 'لم تُرجع خدمة التفريغ نصًا. حاول مجددًا لاحقًا.';
      parsedResult = {
        transcript: `تعذر تفريغ الملف الصوتي:\n${friendlyError}`, dialect: dialectLabel, tone: 'غير محدد',
        summary: friendlyError, key_points: ['تحقق من توفر خدمات التفريغ على الخادم.'], words_count: 0, estimated_speed: '0'
      };
      isSuccess = false;
    }

    if (!parsedResult.srt || !parsedResult.srt.trim()) {
      parsedResult.srt = generateSrtFromTranscript(parsedResult.transcript);
    }

    const wordsCount = parsedResult.words_count || (parsedResult.transcript ? parsedResult.transcript.trim().split(/\s+/).filter(Boolean).length : 0);
    const estSpeed = parsedResult.estimated_speed || `~120 كلمة/دقيقة`;

    const textOutput = document.getElementById('transcribe-text-output');
    const srtOutput = document.getElementById('transcribe-srt-output');
    const summaryText = document.getElementById('transcribe-summary-text');
    const keyPointsList = document.getElementById('transcribe-key-points-list');
    const metricDialect = document.getElementById('metric-dialect');
    const metricWords = document.getElementById('metric-words');
    const metricTone = document.getElementById('metric-tone');
    const metricProvider = document.getElementById('metric-provider');

    if (textOutput) textOutput.value = parsedResult.transcript || '';
    if (srtOutput) srtOutput.value = parsedResult.srt || '';
    if (summaryText) summaryText.textContent = parsedResult.summary || 'تم تفريغ الصوت بنجاح.';

    if (keyPointsList) {
      const points = Array.isArray(parsedResult.key_points) ? parsedResult.key_points : [parsedResult.summary || 'تفريغ صوتي'];
      keyPointsList.innerHTML = points.map(pt => `<li class="flex items-start gap-2"><span class="text-indigo-400 mt-0.5">•</span> <span>${pt}</span></li>`).join('');
    }

    if (metricDialect) {
      metricDialect.innerHTML = `<i class="fa-solid fa-language text-zinc-400 text-[11px]"></i> <span>${parsedResult.dialect || dialectLabel}</span>`;
    }
    if (metricWords) {
      metricWords.innerHTML = `<i class="fa-solid fa-align-right text-zinc-400 text-[11px]"></i> <span>${isSuccess ? wordsCount + ' كلمة (' + estSpeed + ')' : '0 كلمة'}</span>`;
    }
    if (metricTone) {
      metricTone.innerHTML = `<i class="fa-solid fa-chart-line text-zinc-400 text-[11px]"></i> <span>${parsedResult.tone || (isSuccess ? 'طبيعية ومتوازنة' : 'غير محدد')}</span>`;
    }
    if (metricProvider) {
      metricProvider.innerHTML = `<i class="fa-solid fa-microchip text-zinc-400 text-[11px]"></i> <span>${providerName}</span>`;
    }

    STATE.transcribe.lastResult = parsedResult;

    if (scanner) scanner.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.remove('hidden');
    if (actionsBar) actionsBar.classList.remove('opacity-0', 'pointer-events-none');

    if (isSuccess) {
      if (statusPill) {
        statusPill.textContent = 'اكتمل التفريغ والتحليل الصوتي بنجاح ✓';
        statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400';
      }
      SFX.playSuccess();
      showToast('تم تفريغ وتحليل الصوت العربي بنجاح!', 'success');
    } else {
      if (statusPill) {
        statusPill.textContent = 'فشلت المعالجة (تحقق من مفتاح API)';
        statusPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400';
      }
      SFX.playClick();
      showToast('تعذر معالجة الملف الصوتي، يرجى فحص المفتاح في الخزنة', 'error');
    }
  }

  function copyTranscribeCurrentText() {
    SFX.playClick();
    let textToCopy = '';
    const tab = STATE.transcribe.outputTab;

    if (tab === 'srt') {
      textToCopy = document.getElementById('transcribe-srt-output')?.value || '';
    } else if (tab === 'insights') {
      const summary = document.getElementById('transcribe-summary-text')?.textContent || '';
      const points = Array.from(document.querySelectorAll('#transcribe-key-points-list li')).map(li => li.textContent).join('\n');
      textToCopy = `الملخص التنفيذي:\n${summary}\n\nالنقاط الرئيسية:\n${points}`;
    } else {
      textToCopy = document.getElementById('transcribe-text-output')?.value || '';
    }

    if (!textToCopy.trim()) {
      showToast('لا يوجد نص لنسخه!', 'warning');
      return;
    }

    navigator.clipboard.writeText(textToCopy)
      .then(() => showToast('تم نسخ المحتوى إلى الحافظة بنجاح!', 'success'))
      .catch(() => showToast('تعذر النسخ تلقائياً', 'error'));
  }

  function downloadTranscribeTxt() {
    const text = document.getElementById('transcribe-text-output')?.value || '';
    if (!text.trim()) {
      showToast('لا يوجد نص للتحميل!', 'warning');
      return;
    }
    SFX.playClick();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `mickey_transcript_${Date.now()}.txt`);
    showToast('جاري تحميل ملف النص TXT...', 'info');
  }

  function downloadTranscribeSrt() {
    const srt = document.getElementById('transcribe-srt-output')?.value || '';
    if (!srt.trim()) {
      showToast('لا يوجد ملف ترجمة SRT للتحميل!', 'warning');
      return;
    }
    SFX.playClick();
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `mickey_subtitles_${Date.now()}.srt`);
    showToast('جاري تحميل ملف ترجمة بريمير SRT...', 'info');
  }

  function transferTranscribeToImageStudio() {
    const text = document.getElementById('transcribe-text-output')?.value || '';
    if (!text.trim()) {
      showToast('يرجى تفريغ الصوت أولاً لنقل النص!', 'warning');
      return;
    }
    SFX.playClick();
    const summary = document.getElementById('transcribe-summary-text')?.textContent;
    const promptInput = document.getElementById('image-prompt-input');
    if (promptInput) {
      promptInput.value = summary || text.slice(0, 160);
    }
    switchTab('image-studio');
    showToast('تم نقل ملخص الصوت كوصف للمشهد في استوديو الصور!', 'success');
  }

  function transferTranscribeToVoiceStudio() {
    const text = document.getElementById('transcribe-text-output')?.value || '';
    if (!text.trim()) {
      showToast('يرجى تفريغ الصوت أولاً لنقل النص!', 'warning');
      return;
    }
    SFX.playClick();
    const voiceInput = document.getElementById('voice-text-input');
    if (voiceInput) {
      voiceInput.value = text;
    }
    switchTab('voice-studio');
    showToast('تم إرسال النص المفرغ إلى استوديو التعليق الصوتي!', 'success');
  }


  const exports = {
    setTranscribeMode,
    handleTranscribeFileUpload,
    clearTranscribeFile,
    loadSampleArabicAudio,
    toggleLiveRecording,
    setTranscribeOutputTab,
    processAudioTranscription,
    copyTranscribeCurrentText,
    downloadTranscribeTxt,
    downloadTranscribeSrt,
    transferTranscribeToImageStudio,
    transferTranscribeToVoiceStudio
  };

  if (typeof window.MickeyStudio !== 'undefined') {
    Object.assign(window.MickeyStudio, exports);
  }

  root.TranscribeStudio = exports;

})(typeof window !== 'undefined' ? window : this);
