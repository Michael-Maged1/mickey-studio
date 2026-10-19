/**
 * Mickey Studio - Video & 3D Motion Studio Module
 * Dynamic Studio Chunk: 3D parallax canvas rendering, LTX Gradio client, camera motions, and job queue integration.
 */
(function (root) {
  'use strict';

  function setVideoEngine(engine) {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    if (STATE?.video) STATE.video.engine = engine;
    const btnCanvas = document.getElementById('btn-engine-canvas');
    const btnGradio = document.getElementById('btn-engine-gradio');
    const promptWrap = document.getElementById('video-prompt-wrap');
    if (btnCanvas) btnCanvas.classList.toggle('active', engine === 'canvas');
    if (btnGradio) btnGradio.classList.toggle('active', engine === 'gradio');
    if (promptWrap) promptWrap.classList.toggle('hidden', engine !== 'gradio');

    if (SFX?.playClick) SFX.playClick();
    if (showToast) {
      if (engine === 'gradio') {
        showToast('وضع LTX AI السحابي نشط. اكتب وصف الحركة قبل الإنتاج.', 'info');
      } else {
        showToast('محرك الحركة اللحظي نشط (مضمون 100% وبدون طوابير انتطار)', 'success');
      }
    }
  }

  function useLastGeneratedImageForVideo() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    if (!STATE?.image?.lastGeneratedUrl) {
      if (showToast) showToast('لا توجد صورة مولدة سابقة بعد!', 'warning');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      STATE.video.sourceImage = img;
      STATE.video.sourceImageUrl = STATE.image.lastGeneratedUrl;
      const previewImg = document.getElementById('video-source-img');
      const previewBox = document.getElementById('video-source-preview');
      const emptyBox = document.getElementById('video-source-empty');
      if (previewImg) previewImg.src = STATE.image.lastGeneratedUrl;
      if (previewBox) previewBox.classList.remove('hidden');
      if (emptyBox) emptyBox.classList.add('hidden');
      if (SFX?.playClick) SFX.playClick();
    };
    img.src = STATE.image.lastGeneratedUrl;
  }

  function handleVideoImageUpload(fileInput) {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        STATE.video.sourceImage = img;
        STATE.video.sourceImageUrl = e.target.result;
        const previewImg = document.getElementById('video-source-img');
        const previewBox = document.getElementById('video-source-preview');
        const emptyBox = document.getElementById('video-source-empty');
        if (previewImg) previewImg.src = e.target.result;
        if (previewBox) previewBox.classList.remove('hidden');
        if (emptyBox) emptyBox.classList.add('hidden');
        if (SFX?.playSuccess) SFX.playSuccess();
        if (showToast) showToast('تم تحميل الصورة بنجاح!', 'success');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function selectCameraMotion(btnEl, motionType) {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    if (STATE?.video) STATE.video.cameraMotion = motionType;
    document.querySelectorAll('#camera-motion-selector .cam-motion-btn').forEach(b => {
      b.classList.remove('active');
    });
    if (btnEl) btnEl.classList.add('active');
    if (SFX?.playClick) SFX.playClick();
  }

  function setVideoDuration(btnOrSec, maybeSec) {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    let seconds = typeof btnOrSec === 'number' ? btnOrSec : (maybeSec || 3);
    let btnEl = (btnOrSec && btnOrSec.nodeType) ? btnOrSec : (window.event && window.event.currentTarget) || null;
    if (STATE?.video) STATE.video.duration = seconds;
    document.querySelectorAll('.video-dur-btn').forEach(btn => {
      btn.classList.remove('active', 'bg-cyan-500/20', 'text-cyan-neon', 'border-cyan-500/40');
      btn.classList.add('bg-white/5', 'text-slate-300', 'border-white/10');
    });
    if (btnEl) {
      btnEl.classList.add('active', 'bg-cyan-500/20', 'text-cyan-neon', 'border-cyan-500/40');
      btnEl.classList.remove('bg-white/5', 'text-slate-300', 'border-white/10');
    }
    if (SFX?.playClick) SFX.playClick();
  }

  async function renderVideo() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;

    if (!STATE?.video?.sourceImage) {
      if (showToast) showToast('يرجى اختيار صورة مصدر لإنتاج الفيديو أولاً!', 'warning');
      return;
    }
    if (STATE.video.engine === 'gradio' && !document.getElementById('video-prompt-input')?.value.trim()) {
      if (showToast) showToast('اكتب وصف الحركة المطلوبة أولاً.', 'warning');
      document.getElementById('video-prompt-input')?.focus();
      return;
    }
    if (window.MickeyStudio.authorizeAndConsume) {
      if (!await window.MickeyStudio.authorizeAndConsume('video')) return;
    }

    if (STATE.video.engine === 'gradio') {
      renderGradioVideo();
      return;
    }

    if (SFX?.playLaser) SFX.playLaser();
    STATE.video.isRendering = true;

    // Track in Background Job Queue
    let activeJob = null;
    if (window.MickeyJobQueue) {
      activeJob = await window.MickeyJobQueue.addJob({
        type: 'video',
        title: `إنتاج فيديو 3D: حركة ${STATE.video.cameraMotion}`,
        params: { motion: STATE.video.cameraMotion, duration: STATE.video.duration }
      });
    }

    const canvas = document.getElementById('motion-render-canvas');
    const videoEl = document.getElementById('final-rendered-video');
    const emptyState = document.getElementById('video-empty-state');
    const scanner = document.getElementById('video-laser-scanner');
    const actionsBar = document.getElementById('video-actions-bar');
    const renderCounter = document.getElementById('video-render-counter');
    const progressPill = document.getElementById('video-render-progress');

    if (scanner) scanner.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (videoEl) videoEl.classList.add('hidden');
    if (canvas) canvas.classList.remove('hidden');
    if (actionsBar) actionsBar.classList.add('opacity-0', 'pointer-events-none');
    if (progressPill) {
      progressPill.textContent = 'جاري إنتاج الفيديو...';
      progressPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-400';
    }

    const W = 1280;
    const H = 720;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const durationSec = STATE.video.duration || 3;
    const fps = 30;
    const totalFrames = durationSec * fps;
    const motionType = STATE.video.cameraMotion || 'zoom-in';
    const particleType = document.getElementById('video-particles-select')?.value || 'neon-sparks';

    const particles = [];
    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() * 3.5 + 1,
        speedX: (Math.random() - 0.5) * 1.5,
        speedY: (Math.random() - 0.5) * 1.8 - 0.8,
        alpha: Math.random() * 0.7 + 0.3,
        hue: Math.random() > 0.5 ? 185 : 280
      });
    }

    const canvasStream = canvas.captureStream(fps);
    let recordedChunks = [];
    let mediaRecorder = null;
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

    try {
      mediaRecorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 6000000 });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.start();
    } catch (e) {
      mediaRecorder = new MediaRecorder(canvasStream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.start();
    }

    const img = STATE.video.sourceImage;
    let currentFrame = 0;

    function renderLoop() {
      if (currentFrame >= totalFrames) {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }

        mediaRecorder.onstop = async () => {
          const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
          STATE.video.renderedVideoBlob = videoBlob;
          STATE.video.renderedVideoUrl = URL.createObjectURL(videoBlob);

          if (videoEl) {
            videoEl.src = STATE.video.renderedVideoUrl;
            videoEl.classList.remove('hidden');
            videoEl.play();
          }
          if (canvas) canvas.classList.add('hidden');
          if (scanner) scanner.classList.add('hidden');
          if (actionsBar) actionsBar.classList.remove('opacity-0', 'pointer-events-none');
          if (progressPill) {
            progressPill.textContent = 'تم إنتاج الفيديو بنجاح ✓';
            progressPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-emerald-400';
          }

          if (activeJob && window.MickeyJobQueue) {
            await window.MickeyJobQueue.updateJob(activeJob.id, {
              status: 'completed',
              progress: 100,
              progressText: 'اكتمل إنتاج الفيديو',
              resultUrl: STATE.video.renderedVideoUrl
            });
          }

          if (SFX?.playSuccess) SFX.playSuccess();
          if (showToast) showToast('تم تصدير الفيديو السينمائي بنجاح وبدقة فائقة!', 'success');
          STATE.video.isRendering = false;
        };
        return;
      }

      const progress = currentFrame / totalFrames;
      if (renderCounter) renderCounter.textContent = `RENDERING: ${Math.round(progress * 100)}%`;

      if (activeJob && window.MickeyJobQueue && currentFrame % 15 === 0) {
        window.MickeyJobQueue.updateJob(activeJob.id, {
          progress: Math.round(progress * 100),
          progressText: `جارٍ رندرة إطارات الحركة (${Math.round(progress * 100)}%)...`
        });
      }

      // Draw 3D transformation
      ctx.fillStyle = '#05050A';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      let scale = 1.0;
      let transX = 0;
      let transY = 0;
      let rot = 0;

      if (motionType === 'zoom-in') scale = 1.0 + progress * 0.28;
      else if (motionType === 'zoom-out') scale = 1.28 - progress * 0.28;
      else if (motionType === 'pan-horizontal') {
        scale = 1.15;
        transX = (progress - 0.5) * 120;
      } else if (motionType === 'shake-3d') {
        scale = 1.1;
        transX = Math.sin(progress * 25) * 8;
        transY = Math.cos(progress * 20) * 6;
        rot = (Math.sin(progress * 15) * 0.015);
      }

      ctx.translate(W / 2 + transX, H / 2 + transY);
      ctx.rotate(rot);
      ctx.scale(scale, scale);

      const imgAspect = img.width / img.height;
      const canvasAspect = W / H;
      let drawW, drawH;
      if (imgAspect > canvasAspect) {
        drawH = H;
        drawW = H * imgAspect;
      } else {
        drawW = W;
        drawH = W / imgAspect;
      }

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // Atmospheric Particles
      if (particleType !== 'none') {
        particles.forEach(p => {
          ctx.save();
          if (particleType === 'neon-sparks') {
            ctx.fillStyle = p.hue === 185 ? `rgba(0, 240, 255, ${p.alpha})` : `rgba(112, 0, 255, ${p.alpha})`;
            ctx.shadowColor = p.hue === 185 ? '#00F0FF' : '#7000FF';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            p.y += p.speedY * 1.5;
            p.x += p.speedX;
            if (p.y < 0) p.y = H;
            if (p.x < 0) p.x = W;
            if (p.x > W) p.x = 0;
          }
          ctx.restore();
        });
      }

      currentFrame++;
      requestAnimationFrame(renderLoop);
    }

    renderLoop();
  }

  async function renderGradioVideo() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    if (STATE.video.isRendering) return;
    const prompt = document.getElementById('video-prompt-input')?.value.trim() || '';
    if (!prompt) {
      if (showToast) showToast('اكتب وصف الحركة المطلوبة أولاً.', 'warning');
      document.getElementById('video-prompt-input')?.focus();
      return;
    }
    const scanner = document.getElementById('video-laser-scanner');
    const emptyState = document.getElementById('video-empty-state');
    const videoEl = document.getElementById('final-rendered-video');
    const canvas = document.getElementById('motion-render-canvas');
    const actionsBar = document.getElementById('video-actions-bar');
    const progressPill = document.getElementById('video-render-progress');
    STATE.video.isRendering = true;
    if (scanner) scanner.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (videoEl) videoEl.classList.add('hidden');
    if (canvas) canvas.classList.add('hidden');
    if (actionsBar) actionsBar.classList.add('opacity-0', 'pointer-events-none');
    if (progressPill) {
      progressPill.textContent = 'جاري توليد الفيديو بنموذج LTX…';
      progressPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-400';
    }
    try {
      const savedSpace = String(STATE.settings?.gradioSpace || '').trim();
      const spaceId = !savedSpace || savedSpace.toLowerCase() === 'lightricks/ltx-video'
        ? 'Lightricks/ltx-video-distilled' : savedSpace;
      const { Client, handle_file } = await import('https://cdn.jsdelivr.net/npm/@gradio/client@latest/dist/index.min.js');
      const client = await Client.connect(spaceId);
      const sourceResponse = await fetch(STATE.video.sourceImageUrl);
      if (!sourceResponse.ok) throw new Error('تعذر قراءة ملف الصورة لإرساله إلى LTX AI.');
      const sourceBlob = await sourceResponse.blob();
      const imageFile = new File([sourceBlob], 'mickey-source.png', { type: sourceBlob.type || 'image/png' });
      if (progressPill) progressPill.textContent = 'يرسل الصورة إلى LTX AI…';
      const duration = Math.min(8.5, Math.max(0.3, Number(STATE.video.duration) || 3));
      const result = await client.predict('/image_to_video', [
        prompt, 'worst quality, inconsistent motion, blurry, jittery, distorted', await handle_file(imageFile), '',
        512, 704, 'image-to-video', duration, 9, Math.floor(Math.random() * 2 ** 32), true, 1, true
      ]);
      const findGradioFile = window.MickeyStudio.findGradioFile || (d => typeof d === 'string' ? d : d?.url || d?.path);
      const videoUrl = findGradioFile(result?.data?.[0]);
      if (!videoUrl) throw new Error('لم يُرجع نموذج LTX ملف فيديو.');
      const spaceHost = `https://${spaceId.toLowerCase().replace('/', '-')}.hf.space/`;
      const response = await fetch(new URL(videoUrl, spaceHost).href);
      if (!response.ok) throw new Error('تعذر تنزيل الفيديو الناتج من Hugging Face.');
      const videoBlob = await response.blob();
      if (!videoBlob.type.startsWith('video/') || videoBlob.size < 1000) throw new Error('أعاد نموذج LTX ملف فيديو غير صالح.');
      if (STATE.video.renderedVideoUrl) URL.revokeObjectURL(STATE.video.renderedVideoUrl);
      STATE.video.renderedVideoBlob = videoBlob;
      STATE.video.renderedVideoUrl = URL.createObjectURL(videoBlob);
      if (videoEl) {
        videoEl.src = STATE.video.renderedVideoUrl;
        videoEl.classList.remove('hidden');
        videoEl.load();
      }
      if (actionsBar) actionsBar.classList.remove('opacity-0', 'pointer-events-none');
      if (progressPill) {
        progressPill.textContent = 'اكتمل توليد الفيديو عبر LTX AI';
        progressPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-emerald-500/30 text-emerald-400';
      }
      if (SFX?.playSuccess) SFX.playSuccess();
      if (showToast) showToast('اكتمل توليد الفيديو بالذكاء الاصطناعي ويمكن تنزيله الآن.', 'success');
    } catch (error) {
      console.error('[LTX video generation]', error);
      if (progressPill) {
        progressPill.textContent = 'تعذر توليد الفيديو عبر LTX AI';
        progressPill.className = 'text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-rose-500/30 text-rose-400';
      }
      if (emptyState) emptyState.classList.remove('hidden');
      if (showToast) showToast(error?.message || 'خدمة LTX AI مشغولة حالياً. حاول مجدداً بعد قليل.', 'error');
    } finally {
      if (scanner) scanner.classList.add('hidden');
      STATE.video.isRendering = false;
    }
  }

  function downloadCurrentVideo() {
    const STATE = window.MickeyStudio.STATE;
    const SFX = window.MickeyStudio.SFX;
    const showToast = window.MickeyStudio.showToast || window.showToast;
    if (!STATE?.video?.renderedVideoBlob) return;
    if (SFX?.playClick) SFX.playClick();
    const extension = STATE.video.renderedVideoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    if (window.MickeyStudio.downloadBlob) {
      window.MickeyStudio.downloadBlob(STATE.video.renderedVideoBlob, `mickey_cinema_${Date.now()}.${extension}`);
    }
    if (showToast) showToast('جاري تحميل ملف الفيديو السينمائي...', 'info');
  }

  function toggleVideoPlayback() {
    const videoEl = document.getElementById('final-rendered-video');
    if (!videoEl) return;
    if (window.MickeyStudio.SFX?.playClick) window.MickeyStudio.SFX.playClick();
    if (videoEl.paused) videoEl.play();
    else videoEl.pause();
  }

  const exports = {
    setVideoEngine,
    useLastGeneratedImageForVideo,
    handleVideoImageUpload,
    selectCameraMotion,
    setVideoDuration,
    renderVideo,
    renderGradioVideo,
    downloadCurrentVideo,
    toggleVideoPlayback
  };

  if (typeof window.MickeyStudio !== 'undefined') {
    Object.assign(window.MickeyStudio, exports);
  }

  root.VideoStudio = exports;

})(typeof window !== 'undefined' ? window : this);
