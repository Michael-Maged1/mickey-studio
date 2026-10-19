/**
 * Mickey Studio - Persistent Background Job Queue Manager
 * Keeps track of long-running operations (image, video, voice, upscale).
 * Safe to close tab or reload; automatically commits completed outputs to Vault.
 */
(function (root) {
  'use strict';

  const DB_NAME = 'MickeyStudioVaultDB';
  const STORE_JOBS = 'jobs';
  let dbPromise = null;
  const activeListeners = new Set();

  function getDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 3);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval');
        }
        if (!db.objectStoreNames.contains(STORE_JOBS)) {
          db.createObjectStore(STORE_JOBS, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function getAllJobs() {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_JOBS, 'readonly');
        const store = tx.objectStore(STORE_JOBS);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch (_) {
      try {
        const raw = localStorage.getItem('mickey_jobs_fallback');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }
  }

  async function saveJob(job) {
    try {
      const db = await getDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_JOBS, 'readwrite');
        const store = tx.objectStore(STORE_JOBS);
        const req = store.put(job);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (_) {
      try {
        const jobs = await getAllJobs();
        const idx = jobs.findIndex(j => j.id === job.id);
        if (idx >= 0) jobs[idx] = job;
        else jobs.unshift(job);
        localStorage.setItem('mickey_jobs_fallback', JSON.stringify(jobs.slice(0, 30)));
      } catch (e) {}
    }
    notifyListeners();
  }

  async function addJob({ type, title, params }) {
    const job = {
      id: 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type: type || 'job',
      title: title || 'مهمة قيد المعالجة',
      params: params || {},
      status: 'running', // 'queued' | 'running' | 'completed' | 'failed'
      progress: 5,
      progressText: 'بدء المعالجة...',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      resultUrl: null,
      error: null
    };
    await saveJob(job);
    updateBadge();
    return job;
  }

  async function updateJob(id, updates) {
    const jobs = await getAllJobs();
    const job = jobs.find(j => j.id === id);
    if (!job) return null;

    Object.assign(job, updates, { updatedAt: Date.now() });
    await saveJob(job);
    updateBadge();

    // If job just completed with a valid result, ensure it is in the Vault Gallery
    if (job.status === 'completed' && job.resultUrl && !job.savedToVault) {
      job.savedToVault = true;
      await saveJob(job);
      if (typeof window.MickeyStudio !== 'undefined' && typeof window.MickeyStudio.saveAssetToDB === 'function') {
        try {
          await window.MickeyStudio.saveAssetToDB({
            type: job.type === 'upscale' || job.type === 'bg_remove' ? 'image' : job.type,
            title: job.title,
            prompt: job.params?.prompt || job.title,
            url: job.resultUrl,
            timestamp: Date.now()
          });
          if (typeof window.showToast === 'function') {
            window.showToast(`تم إكمال وحفظ: "${job.title}" في المعرض تلقائياً!`, 'success');
          }
        } catch (e) {
          console.warn('[MickeyJobQueue] Failed to auto-commit asset to DB:', e);
        }
      }
    }

    return job;
  }

  async function removeJob(id) {
    try {
      const db = await getDB();
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_JOBS, 'readwrite');
        const store = tx.objectStore(STORE_JOBS);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch (_) {}
    notifyListeners();
    updateBadge();
  }

  async function clearCompleted() {
    const jobs = await getAllJobs();
    for (const j of jobs) {
      if (j.status === 'completed' || j.status === 'failed') {
        await removeJob(j.id);
      }
    }
    renderQueueModal();
  }

  function subscribe(fn) {
    activeListeners.add(fn);
    return () => activeListeners.delete(fn);
  }

  function notifyListeners() {
    activeListeners.forEach(fn => {
      try { fn(); } catch (_) {}
    });
  }

  async function updateBadge() {
    const badge = document.getElementById('queue-badge');
    const jobs = await getAllJobs();
    const running = jobs.filter(j => j.status === 'running' || j.status === 'queued').length;
    if (badge) {
      if (running > 0) {
        badge.textContent = String(running);
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  async function renderQueueModal() {
    const listEl = document.getElementById('jobs-queue-list');
    const emptyEl = document.getElementById('jobs-queue-empty');
    if (!listEl) return;

    const jobs = await getAllJobs();
    if (jobs.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    listEl.innerHTML = '';

    jobs.forEach(job => {
      const card = document.createElement('div');
      card.className = 'p-3.5 rounded-xl border border-white/5 bg-zinc-900/90 space-y-2.5 transition-all';

      let statusBadge = '';
      if (job.status === 'running') {
        statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5"><i class="fa-solid fa-circle-notch fa-spin text-[9px]"></i> قيد المعالجة</span>';
      } else if (job.status === 'completed') {
        statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><i class="fa-solid fa-check text-[9px]"></i> مكتملة</span>';
      } else if (job.status === 'failed') {
        statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation text-[9px]"></i> تعذرت</span>';
      }

      const progress = Math.max(0, Math.min(100, Number(job.progress) || 0));

      let actionHtml = '';
      if (job.status === 'completed' && job.resultUrl) {
        actionHtml = `
          <div class="flex items-center gap-2 pt-1 border-t border-white/5">
            <button onclick="MickeyStudio.switchTab('vault-gallery'); MickeyJobQueue.closeModal();" class="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
              <i class="fa-regular fa-folder-open"></i> عرض في المعرض
            </button>
            <a href="${job.resultUrl}" download="job_${job.id}" class="text-xs text-zinc-400 hover:text-white flex items-center gap-1 ms-auto">
              <i class="fa-solid fa-download"></i> تحميل
            </a>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-bolt text-indigo-400 text-xs"></i>
            <h4 class="text-xs font-bold text-white truncate max-w-[200px]" title="${job.title}">${job.title}</h4>
          </div>
          ${statusBadge}
        </div>

        <div class="space-y-1">
          <div class="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div class="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-300" style="width: ${progress}%;"></div>
          </div>
          <div class="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
            <span>${job.progressText || ''}</span>
            <span>${progress}%</span>
          </div>
        </div>

        ${actionHtml}
      `;
      listEl.appendChild(card);
    });
  }

  function openModal() {
    const modal = document.getElementById('modal-jobs-queue');
    if (modal) {
      modal.classList.remove('hidden');
      renderQueueModal();
    }
  }

  function closeModal() {
    const modal = document.getElementById('modal-jobs-queue');
    if (modal) modal.classList.add('hidden');
  }

  // Auto-init on boot
  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      updateBadge();
      subscribe(() => {
        updateBadge();
        const modal = document.getElementById('modal-jobs-queue');
        if (modal && !modal.classList.contains('hidden')) {
          renderQueueModal();
        }
      });
    });
  }

  root.MickeyJobQueue = {
    addJob,
    updateJob,
    removeJob,
    getAllJobs,
    clearCompleted,
    openModal,
    closeModal,
    renderQueueModal,
    updateBadge,
    subscribe
  };

})(typeof window !== 'undefined' ? window : this);
