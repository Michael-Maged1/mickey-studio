/**
 * Mickey Studio REST gateway client.
 * All service requests are authorized through the linked Mickey Studio account.
 */
'use strict';

const MickeyStudioAPI = (() => {
  const FIREBASE_WEB_API_KEY = 'AIzaSyAbwmXwJkb5nl2sUDCZ0ing_cWs0lbYAWg';
  const FIREBASE_PROJECT_ID = 'mickey-gemini-studio';
  const ONLINE_DEFAULT_API_URL = 'https://mickey-studio-api.kma279500.workers.dev/api.php';
  const PAIR_API_URL = 'https://mickey-studio-api.kma279500.workers.dev/api.php';
  const PLATFORM_SITE_URL = 'https://mickey-studio-eta.vercel.app/';

  function getBaseUrl() {
    const saved = StudioStorage.getApiUrl();
    if (saved && typeof saved === 'string' && saved.trim()) {
      try {
        if (new URL(saved.trim()).hostname.toLowerCase() !== 'mickeystudio.rf.gd') return saved.trim();
      } catch (_) { return saved.trim(); }
    }
    return ONLINE_DEFAULT_API_URL;
  }

  function setBaseUrl(url) {
    if (StudioStorage.setApiUrl) StudioStorage.setApiUrl(url);
  }

  let cachedInfinityCookie = '2f312d304562ccae42675f89848424b1';
  try {
    const savedCookie = localStorage.getItem('mickey_infinity_cookie');
    if (savedCookie) cachedInfinityCookie = savedCookie;
  } catch (_) {}

  function xhrRequest(method, url, payload = null, headers = {}) {
    return new Promise(resolve => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.withCredentials = true;
        for (const [k, v] of Object.entries(headers)) {
          try { xhr.setRequestHeader(k, v); } catch (_) {}
        }
        xhr.onload = () => {
          const ct = (xhr.getResponseHeader('content-type') || '').toLowerCase();
          let data = null;
          try { data = JSON.parse(xhr.responseText); } catch (_) {}
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            contentType: ct,
            text: xhr.responseText,
            data: data
          });
        };
        xhr.onerror = () => resolve({ ok: false, status: 0, text: '', error: 'XHR Network Error' });
        xhr.ontimeout = () => resolve({ ok: false, status: 0, text: '', error: 'XHR Timeout' });
        xhr.timeout = 25000;
        xhr.send(payload ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) : null);
      } catch (e) {
        resolve({ ok: false, status: 0, text: '', error: e.message });
      }
    });
  }

  function getAesEngine() {
    if (typeof slowAES !== 'undefined' && slowAES && slowAES.decrypt) return slowAES;
    if (typeof window !== 'undefined' && window.slowAES && window.slowAES.decrypt) return window.slowAES;
    if (typeof globalThis !== 'undefined' && globalThis.slowAES && globalThis.slowAES.decrypt) return globalThis.slowAES;
    if (typeof self !== 'undefined' && self.slowAES && self.slowAES.decrypt) return self.slowAES;
    return null;
  }

  function solveInfinityFreeChallenge(html) {
    try {
      const ma = html.match(/(?:var\s+)?a\s*=\s*toNumbers\(["']([a-f0-9]+)["']\)/i) || html.match(/toNumbers\(["']([a-f0-9]+)["']\)/i);
      const mb = html.match(/(?:,|\b)b\s*=\s*toNumbers\(["']([a-f0-9]+)["']\)/i);
      const mc = html.match(/(?:,|\b)c\s*=\s*toNumbers\(["']([a-f0-9]+)["']\)/i);
      if (!ma || !mb || !mc) return null;

      const aesEngine = getAesEngine();
      if (!aesEngine) {
        console.warn('[InfinityFreeSolver] slowAES is undefined');
        return null;
      }
      function toNumbers(d) {
        const e = [];
        d.replace(/(..)/g, function(d) { e.push(parseInt(d, 16)); });
        return e;
      }
      function toHex(arr) {
        const d = 1 === arguments.length && arguments[0].constructor === Array ? arguments[0] : arguments;
        let e = '';
        for (let f = 0; f < d.length; f++) e += (16 > d[f] ? '0' : '') + d[f].toString(16);
        return e.toLowerCase();
      }
      const a = toNumbers(ma[1]);
      const b = toNumbers(mb[1]);
      const c = toNumbers(mc[1]);
      const decrypted = aesEngine.decrypt(c, 2, a, b);
      const cookieVal = toHex(decrypted);
      console.log('[InfinityFreeSolver] Solved __test cookie:', cookieVal);
      return cookieVal;
    } catch (err) {
      console.error('[InfinityFreeSolver] Decryption error:', err);
      return null;
    }
  }

  async function testApiConnection(targetUrl = null) {
    let url = (targetUrl || getBaseUrl()).trim();
    if (!url.endsWith('.php') && !url.includes('/api')) {
      url = url.replace(/\/+$/, '') + '/api.php';
    }
    const cleanUrl = url.replace(/\/+$/, '');
    const pingUrl = cleanUrl.includes('?') ? `${cleanUrl}&action=status` : `${cleanUrl}?action=status`;
    try {
      const reqHeaders = {};
      if (cachedInfinityCookie) {
        reqHeaders['Cookie'] = `__test=${cachedInfinityCookie}`;
      }
      let resp = null;
      let contentType = '';
      let htmlText = '';
      try {
        resp = await fetch(pingUrl, { method: 'GET', cache: 'no-store', headers: reqHeaders, credentials: 'include' });
        contentType = (resp.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('text/html')) {
          htmlText = await resp.text();
        }
      } catch (_) {}

      // If response is HTML or contains challenge
      if (htmlText && (htmlText.includes('toNumbers') || htmlText.includes('slowAES') || htmlText.includes('__test'))) {
        const cookie = solveInfinityFreeChallenge(htmlText);
        if (cookie) {
          cachedInfinityCookie = cookie;
          try { localStorage.setItem('mickey_infinity_cookie', cookie); } catch (_) {}
          try { document.cookie = `__test=${cookie}; path=/; max-age=31536000`; } catch (_) {}
          reqHeaders['Cookie'] = `__test=${cookie}`;

          try {
            resp = await fetch(pingUrl, { method: 'GET', cache: 'no-store', headers: reqHeaders, credentials: 'include' });
            contentType = (resp.headers.get('content-type') || '').toLowerCase();
            if (contentType.includes('text/html')) {
              htmlText = await resp.text();
            } else {
              htmlText = '';
            }
          } catch (_) {}

          // If fetch still gets challenge, fallback to XMLHttpRequest
          if (htmlText && typeof XMLHttpRequest !== 'undefined') {
            const xhrRes = await xhrRequest('GET', pingUrl, null, reqHeaders);
            if (xhrRes.ok && xhrRes.data && (xhrRes.data.success || xhrRes.data.status === 'online' || xhrRes.data.server)) {
              return { ok: true, url, server: xhrRes.data.server || 'Mickey Studio AI Gateway', version: xhrRes.data.version || '3.8.0' };
            }
          }
        }
      }

      if (resp && resp.ok && !htmlText) {
        const data = await resp.json().catch(() => null);
        if (data && (data.success || data.status === 'online' || data.server)) {
          return { ok: true, url, server: data.server || 'Mickey Studio AI Gateway', version: data.version || '3.8.0' };
        }
      }

      // Final fallback to XMLHttpRequest
      if (typeof XMLHttpRequest !== 'undefined') {
        const xhrRes = await xhrRequest('GET', pingUrl, null, reqHeaders);
        if (xhrRes.ok && xhrRes.data && (xhrRes.data.success || xhrRes.data.status === 'online' || xhrRes.data.server)) {
          return { ok: true, url, server: xhrRes.data.server || 'Mickey Studio AI Gateway', version: xhrRes.data.version || '3.8.0' };
        }
      }

      if (htmlText && (htmlText.includes('aes.js') || htmlText.includes('toNumbers') || htmlText.includes('JavaScript to work'))) {
        return {
          ok: false,
          url,
          error: 'الاستضافة أعادت صفحة حماية HTML بدل JSON. يلزم السماح بطلبات API إلى /api.php أو استضافة الـ API على خدمة لا تستبدل ردوده بصفحة حماية.'
        };
      }

      return { ok: false, url, error: `الخادم لم يُرجع استجابة صالحة (HTTP ${resp?.status || 'Error'})` };
    } catch (e) {
      return { ok: false, url, error: e.message || 'تعذر الاتصال بالخادم' };
    }
  }


  function sha256Pure(ascii) {
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    const words = [];
    const asciiBitLength = ascii.length * 8;
    const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    let i, j;
    for (i = 0; i < ascii.length; i++) words[i >> 2] |= (ascii.charCodeAt(i) & 255) << (8 * (3 - (i % 4)));
    words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
    words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;
    for (i = 0; i < words.length; i += 16) {
      const w = words.slice(i, i + 16);
      const oldHash = hash.slice(0);
      for (j = 0; j < 64; j++) {
        const s0 = j >= 16 ? rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10) : 0;
        const s1 = j >= 16 ? rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3) : 0;
        if (j >= 16) w[j] = (w[j - 16] + s1 + w[j - 7] + s0) | 0;
        const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
        const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
        const S0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
        const S1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
        const temp1 = (hash[7] + S1 + ch + k[j] + w[j]) | 0;
        const temp2 = (S0 + maj) | 0;
        hash[7] = hash[6]; hash[6] = hash[5]; hash[5] = hash[4];
        hash[4] = (hash[3] + temp1) | 0;
        hash[3] = hash[2]; hash[2] = hash[1]; hash[1] = hash[0];
        hash[0] = (temp1 + temp2) | 0;
      }
      for (j = 0; j < 8; j++) hash[j] = (hash[j] + oldHash[j]) | 0;
    }
    let result = '';
    for (i = 0; i < 8; i++) {
      for (j = 3; j >= 0; j--) {
        const b = (hash[i] >> (8 * j)) & 255;
        result += (b < 16 ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  async function computeSha256Hex(str) {
    try {
      if (globalThis.crypto?.subtle?.digest) {
        const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (_) {}
    return sha256Pure(str);
  }

  async function decryptPairingPayload(code, base64Payload) {
    try {
      const raw = atob(base64Payload);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      if (bytes.length < 28) return null;
      const nonce = bytes.slice(0, 12);
      const tag = bytes.slice(12, 28);
      const ciphertext = bytes.slice(28);
      const combined = new Uint8Array(ciphertext.length + tag.length);
      combined.set(ciphertext, 0);
      combined.set(tag, ciphertext.length);

      const codeBytes = new TextEncoder().encode(code);
      const keyHash = await crypto.subtle.digest('SHA-256', codeBytes);
      const cryptoKey = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM' }, false, ['decrypt']);
      const decrypted = await crypto.subtle.decrypt({
        name: 'AES-GCM',
        iv: nonce,
        additionalData: new TextEncoder().encode('mickey-pairing-v1')
      }, cryptoKey, combined);
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
      console.warn('[DecryptPairingPayload] fallback:', e);
      return null;
    }
  }

  async function applyManualPairToken(rawToken) {
    const clean = String(rawToken || '').trim();
    if (!clean) throw new Error('يرجى لصق كود الربط أولاً.');
    let data = null;
    if (clean.startsWith('MKP_')) {
      try {
        const jsonStr = decodeURIComponent(escape(atob(clean.substring(4))));
        data = JSON.parse(jsonStr);
      } catch (_) {
        throw new Error('كود الربط غير صالح أو تالف.');
      }
    } else {
      try { data = JSON.parse(clean); } catch (_) {}
      if (!data) data = { refreshToken: clean };
    }
    if (!data?.refreshToken) throw new Error('كود الربط لا يحتوي على جلسة صالحة.');
    await StudioStorage.setAccountSession(data.refreshToken, data.email || '');
    cachedIdToken = ''; cachedIdTokenUntil = 0;
    await ensureAccountAccess();
    updateAccountLinkStatus(data.email || StudioStorage.getAccountEmail(), true);
    return data;
  }

  function toBase64(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
    }
    return btoa(binary);
  }

  function bytesToText(bytes) {
    try { return new TextDecoder().decode(bytes); }
    catch (_) { return String.fromCharCode(...bytes); }
  }

  let cachedIdToken = '';
  let cachedIdTokenUntil = 0;
  async function getAuthToken(forceRefresh = false) {
    if (!forceRefresh && cachedIdToken && Date.now() < cachedIdTokenUntil) return cachedIdToken;
    const refreshToken = await StudioStorage.getAccountRefreshToken();
    if (!refreshToken) throw new Error('اربط الإضافة بحساب Mickey Studio أولاً من إعدادات API.');
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.id_token) {
      if (data.error?.message === 'TOKEN_EXPIRED' || data.error?.message === 'INVALID_REFRESH_TOKEN') await StudioStorage.clearAccountSession();
      throw new Error('انتهت جلسة الحساب أو تم إلغاؤها. أعد ربط الإضافة بالموقع.');
    }
    if (data.refresh_token && data.refresh_token !== refreshToken) {
      await StudioStorage.setAccountSession(data.refresh_token, StudioStorage.getAccountEmail());
    }
    cachedIdToken = data.id_token;
    cachedIdTokenUntil = Date.now() + (Math.max(60, Number(data.expires_in) - 60) * 1000);
    return cachedIdToken;
  }


  function updateAccountLinkStatus(email = '', isActive = true, errorMsg = '') {
    const status = document.getElementById('account-link-status');
    const emailEl = document.getElementById('account-link-email');
    const connectSec = document.getElementById('account-connect-section');
    const disconnect = document.getElementById('disconnect-account');
    const accountButton = document.getElementById('settings-open');
    
    // Top workspace banners
    const unlinkedBanner = document.getElementById('app-unlinked-banner');
    const suspendedBanner = document.getElementById('app-suspended-banner');
    const suspendedText = document.getElementById('suspended-banner-text');

    if (email) {
      if (isActive) {
        if (status) status.textContent = 'الإضافة مرتبطة بحساب المنصة نشط ✓';
        if (unlinkedBanner) unlinkedBanner.classList.add('hidden');
        if (suspendedBanner) suspendedBanner.classList.add('hidden');
      } else {
        if (status) status.textContent = '⚠️ الحساب موقوف من إدارة المنصة';
        if (unlinkedBanner) unlinkedBanner.classList.add('hidden');
        if (suspendedBanner) {
          suspendedBanner.classList.remove('hidden');
          if (suspendedText && errorMsg) suspendedText.textContent = errorMsg;
        }
      }
      if (emailEl) emailEl.textContent = email;
      if (connectSec) connectSec.classList.add('hidden');
      if (disconnect) disconnect.classList.remove('hidden');
    } else {
      if (status) status.textContent = 'الإضافة غير مرتبطة بحساب (وضع الضيف)';
      if (emailEl) emailEl.textContent = 'اربط حسابك لتفعيل الصلاحيات الكاملة ومزامنة بياناتك';
      if (unlinkedBanner) unlinkedBanner.classList.remove('hidden');
      if (suspendedBanner) suspendedBanner.classList.add('hidden');
      if (connectSec) connectSec.classList.remove('hidden');
      if (disconnect) disconnect.classList.add('hidden');
    }

    if (accountButton) {
      const label = accountButton.querySelector('span:last-child');
      if (label) label.textContent = email ? 'حسابي' : 'حساب المنصة';
      accountButton.setAttribute('aria-label', email ? 'إعدادات الحساب المرتبط' : 'ربط حساب المنصة');
      accountButton.setAttribute('title', email ? `حساب المنصة المرتبط: ${email}` : 'إعدادات حساب المنصة');
    }
  }

  function showAccountDialog() {
    const dialog = document.getElementById('settings-dialog');
    if (!dialog) return;
    document.body.classList.add('modal-open');
    updateAccountLinkStatus(StudioStorage.getAccountEmail(), true);
    const inputPlatformUrl = document.getElementById('input-platform-url');
    if (inputPlatformUrl) {
      inputPlatformUrl.value = getBaseUrl();
    }
    dialog.classList.remove('hidden');
  }

  function hideAccountDialog() {
    document.body.classList.remove('modal-open');
    const dialog = document.getElementById('settings-dialog');
    if (!dialog) return;
    dialog.classList.add('hidden');
  }

  function accountToast(message, type = '') {
    const toast = document.getElementById('toast');
    if (!toast) { console.info(`[MickeyStudio] ${message}`); return; }
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => { toast.className = 'toast'; }, 4000);
  }

  let accountActionRunning = false;
  function bindAccountControls() {
    document.addEventListener('click', async event => {
      // Backdrop click closes modal
      const dialog = document.getElementById('settings-dialog');
      if (dialog && !dialog.classList.contains('hidden') && event.target === dialog) {
        hideAccountDialog();
        return;
      }

      const target = event.target?.closest?.('#settings-open, #btn-quick-connect, #connect-account, #settings-close, #disconnect-account, #btn-apply-manual-token, #btn-save-platform-url, #btn-test-platform-url, #btn-toggle-server-settings');
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      if (target.id === 'settings-open' || target.id === 'btn-quick-connect') {
        showAccountDialog();
        return;
      }
      if (target.id === 'settings-close') {
        hideAccountDialog();
        return;
      }
      if (target.id === 'btn-toggle-server-settings' || target.closest?.('#btn-toggle-server-settings')) {
        const content = document.getElementById('server-settings-content');
        const arrow = document.getElementById('server-settings-arrow');
        if (content) {
          const isHidden = content.classList.toggle('hidden');
          if (arrow) arrow.textContent = isHidden ? '▼' : '▲';
        }
        return;
      }
      if (target.id === 'btn-save-platform-url') {
        const input = document.getElementById('input-platform-url');
        const urlVal = input ? input.value.trim() : '';
        setBaseUrl(urlVal);
        accountToast(urlVal ? 'تم حفظ رابط خادم المنصة بنجاح ✓' : 'تم استعادة الرابط الافتراضي.', 'success');
        return;
      }
      if (target.id === 'btn-test-platform-url') {
        const input = document.getElementById('input-platform-url');
        const urlVal = (input ? input.value.trim() : '') || getBaseUrl();
        const statusEl = document.getElementById('platform-url-status');
        if (statusEl) {
          statusEl.textContent = '⏳ جاري فحص الاتصال بالخادم...';
          statusEl.style.color = '#5da7eb';
        }
        accountToast('جاري فحص الاتصال بالخادم...', 'info');
        const testRes = await testApiConnection(urlVal);
        if (testRes.ok) {
          if (statusEl) {
            statusEl.textContent = `✓ متصل بنجاح: ${testRes.server} (${testRes.version})`;
            statusEl.style.color = '#66ddc5';
          }
          accountToast(`✓ الاتصال ناجح: ${testRes.server}`, 'success');
        } else {
          if (statusEl) {
            statusEl.textContent = `⚠️ تعذر الاتصال: ${testRes.error}`;
            statusEl.style.color = '#fca5a5';
          }
          accountToast(`تعذر الاتصال بالخادم: ${testRes.error}`, 'error');
        }
        return;
      }
      if (target.id === 'btn-apply-manual-token') {
        const input = document.getElementById('input-manual-pair-token');
        const tokenVal = input ? input.value.trim() : '';
        if (!tokenVal) {
          accountToast('يرجى لصق كود الربط من الموقع أولاً.', 'error');
          return;
        }
        try {
          accountToast('جاري تفعيل كود الربط وتأكيد الحساب…', 'info');
          const res = await applyManualPairToken(tokenVal);
          accountToast(`تم ربط الإضافة بنجاح بالحساب: ${res.email || ''}`, 'success');
          hideAccountDialog();
        } catch (err) {
          accountToast(err.message || 'فشل تفعيل كود الربط.', 'error');
        }
        return;
      }
      if (accountActionRunning) return;
      accountActionRunning = true;
      try {
        if (target.id === 'disconnect-account') {
          await disconnectAccount();
          accountToast('تم إلغاء ربط الحساب من الإضافة بنجاح.', 'info');
        } else if (target.id === 'connect-account') {
          accountToast('جاري فتح المتصفح لربط حساب المنصة…', 'info');
          await connectAccount();
          updateAccountLinkStatus(StudioStorage.getAccountEmail(), true);
          accountToast('تم ربط الإضافة بنجاح بحساب المنصة!', 'success');
        }
      } catch (error) {
        accountToast(error?.message || 'تعذر إتمام ربط الحساب.', 'error');
      } finally { accountActionRunning = false; }
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        hideAccountDialog();
      }
    });

    try { updateAccountLinkStatus(StudioStorage.getAccountEmail(), true); } catch (error) { console.warn('[MickeyStudio] Account UI initialization:', error); }
  }
  bindAccountControls();

  async function ensureAccountAccess() {
    const devKey = StudioStorage.getDeveloperApiKey ? StudioStorage.getDeveloperApiKey() : '';
    if (devKey) {
      updateAccountLinkStatus('مفتاح API: ' + devKey.slice(0, 12) + '...', true);
      return { status: 'active', email: 'api-developer' };
    }
    const refreshToken = await StudioStorage.getAccountRefreshToken();
    if (!refreshToken) {
      updateAccountLinkStatus('', true);
      return { status: 'active', email: 'guest' };
    }

    try {
      const token = await getAuthToken();
      // Verify account directly with Google Identity Toolkit REST API (always open and fast)
      const reqUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`;
      const response = await fetch(reqUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      });
      const data = await response.json().catch(() => ({}));
      const user = data.users?.[0];
      if (user) {
        if (user.disabled) {
          const errorMsg = '⚠️ تم إيقاف هذا الحساب من قبل إدارة المنصة.';
          updateAccountLinkStatus(StudioStorage.getAccountEmail() || user.email, false, errorMsg);
          throw new Error(errorMsg);
        }
        const email = user.email || StudioStorage.getAccountEmail();
        if (email) await StudioStorage.setAccountSession(refreshToken, email);
        updateAccountLinkStatus(email, true);
        return { status: 'active', email, uid: user.localId };
      }
      updateAccountLinkStatus(StudioStorage.getAccountEmail(), true);
      return { status: 'active', email: StudioStorage.getAccountEmail() };
    } catch (err) {
      if (err.message && err.message.includes('موقوف')) throw err;
      console.warn('[MickeyStudioAPI] Status check network warning:', err);
      updateAccountLinkStatus(StudioStorage.getAccountEmail(), true);
      return { status: 'active', email: StudioStorage.getAccountEmail() };
    }
  }

  async function connectAccount() {
    if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
      throw new Error('تعذر إنشاء رمز ربط آمن على هذا الإصدار من Premiere. حدّث Premiere ثم حاول مجددًا.');
    }
    const codeBytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const pairCode = Array.from(codeBytes, value => value.toString(16).padStart(2, '0')).join('');
    // The platform site and API Worker are hosted separately.
    const siteUrl = new URL(PLATFORM_SITE_URL);
    siteUrl.searchParams.set('extension_pair', pairCode);

    try {
      const launchResult = await require('uxp').shell.openExternal(
        siteUrl.href,
        'فتح المتصفح لتسجيل الدخول وربط حساب Mickey Studio'
      );
      if (launchResult) throw new Error(launchResult);
    } catch (error) {
      throw new Error(`تعذر فتح المتصفح. وافق على نافذة صلاحية Adobe لفتح الرابط ثم أعد المحاولة. ${error && error.message ? error.message : ''}`.trim());
    }

    const deadline = Date.now() + 10 * 60 * 1000;
    let lastPollError = '';
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        const response = await fetch(`${PAIR_API_URL}?action=pair_poll`, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ action: 'pair_poll', code: pairCode })
        });
        const result = await response.json().catch(() => ({}));
        if (response.status === 410) throw new Error(result.error || 'انتهت صلاحية جلسة الربط. أعد المحاولة.');
        if (!response.ok || result.success === false) {
          throw new Error(result.error || `تعذر فحص جلسة الربط (${response.status}).`);
        }
        if (result.status === 'complete' && result.refreshToken) {
          const email = result.email || '';
          await StudioStorage.setAccountSession(result.refreshToken, email);
          cachedIdToken = ''; cachedIdTokenUntil = 0;
          await ensureAccountAccess();
          return { status: 'complete', email, refreshToken: result.refreshToken };
        }
        lastPollError = '';
      } catch (pollError) {
        lastPollError = pollError?.message || String(pollError);
        console.warn('[PairingPoll]', lastPollError);
      }
    }

    const manualHint = 'انتهت مهلة الربط التلقائي. يمكنك استخدام كود الربط اليدوي من الموقع في الحقل الموجود هنا.';
    throw new Error(lastPollError ? `${manualHint} آخر خطأ: ${lastPollError}` : manualHint);
  }

  async function disconnectAccount() {
    await StudioStorage.clearAccountSession();
    cachedIdToken = ''; cachedIdTokenUntil = 0;
    updateAccountLinkStatus('');
  }

  function getOrCreateAnonymousId() {
    let id = '';
    try { id = localStorage.getItem('mickey_anon_id') || ''; } catch (_) {}
    if (!id || id.length < 32) {
      const bytes = new Uint8Array(20);
      if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(bytes);
      } else {
        for (let i = 0; i < 20; i++) bytes[i] = Math.floor(Math.random() * 256);
      }
      id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      try { localStorage.setItem('mickey_anon_id', id); } catch (_) {}
    }
    return id;
  }

  async function executeSingleUrlRequest(baseUrl, action, payload, headers, isRetry = false) {
    const fullPayload = { action, ...payload };
    const requestUrl = `${baseUrl}?action=${encodeURIComponent(action)}`;

    const reqHeaders = { ...headers };
    if (cachedInfinityCookie) {
      reqHeaders['Cookie'] = `__test=${cachedInfinityCookie}`;
    }

    let response;
    try {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, audio/*, image/*',
          ...reqHeaders,
        },
        credentials: 'include',
        body: JSON.stringify(fullPayload),
      });
    } catch (fetchErr) {
      if (typeof XMLHttpRequest !== 'undefined') {
        const xhrRes = await xhrRequest('POST', requestUrl, fullPayload, {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...reqHeaders
        });
        if (xhrRes.ok && xhrRes.data && xhrRes.data.success !== false) {
          return xhrRes.data;
        }
      }
      throw fetchErr;
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (response.ok && (contentType.startsWith('image/') || contentType.startsWith('audio/'))) {
      const arrayBuf = await response.arrayBuffer();
      const b64 = typeof Buffer !== 'undefined' ? Buffer.from(arrayBuf).toString('base64') : toBase64(arrayBuf);
      return { _media_base64: b64, _mime_type: contentType.split(';')[0] };
    }

    if (contentType.includes('text/html')) {
      const htmlText = await response.text();
      if (!isRetry && (htmlText.includes('toNumbers') || htmlText.includes('slowAES') || htmlText.includes('__test'))) {
        const solved = solveInfinityFreeChallenge(htmlText);
        if (solved) {
          cachedInfinityCookie = solved;
          try { localStorage.setItem('mickey_infinity_cookie', solved); } catch (_) {}
          try { document.cookie = `__test=${solved}; path=/; max-age=31536000`; } catch (_) {}
          return await executeSingleUrlRequest(baseUrl, action, payload, headers, true);
        }
      }
      // If fetch returned HTML, fallback to XMLHttpRequest with the cookie
      if (typeof XMLHttpRequest !== 'undefined') {
        const xhrReqHeaders = { ...headers };
        if (cachedInfinityCookie) xhrReqHeaders['Cookie'] = `__test=${cachedInfinityCookie}`;
        const xhrRes = await xhrRequest('POST', requestUrl, fullPayload, {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...xhrReqHeaders
        });
        if (xhrRes.ok && xhrRes.data && xhrRes.data.success !== false) {
          return xhrRes.data;
        }
      }
      throw new Error(`أعادت بوابة Mickey Studio صفحة HTML بدلاً من استجابة البيانات (HTTP ${response.status}).`);
    }

    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success === false || data?.error) {
      throw new Error(data?.message || data?.error?.message || (typeof data?.error === 'string' ? data.error : '') || `تعذر تنفيذ خدمة Mickey Studio (${response.status}).`);
    }
    if (!data) {
      throw new Error(`أعاد خادم Mickey Studio استجابة غير مفهومة (${contentType || 'نوع محتوى غير معروف'}، HTTP ${response.status}).`);
    }
    return data;
  }

  async function request(action, payload = {}) {
    let idToken = '';
    try {
      idToken = await getAuthToken();
    } catch (error) {
      if (['motion_scene_poll', 'motion_scene_ack'].includes(action)) throw error;
    }

    const devApiKey = StudioStorage.getDeveloperApiKey ? StudioStorage.getDeveloperApiKey() : '';
    const headers = {
      'Content-Type': 'application/json',
      'X-Anonymous-ID': getOrCreateAnonymousId()
    };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    if (devApiKey && !['motion_scene_poll', 'motion_scene_ack'].includes(action)) {
      headers['X-API-Key'] = devApiKey;
      headers.Authorization = `Bearer ${devApiKey}`;
    }

    const primaryUrl = ['motion_scene_poll', 'motion_scene_ack'].includes(action) ? ONLINE_DEFAULT_API_URL : getBaseUrl();
    const requestPayload = { ...payload };
    if (idToken) requestPayload.idToken = idToken;

    try {
      return await executeSingleUrlRequest(primaryUrl, action, requestPayload, headers);
    } catch (primaryErr) {
      const pMsg = primaryErr?.message || '';
      // Older panel settings may still point at the Vercel site (which can
      // return its HTML page for /api.php). Recover through the live Worker,
      // then replace that stale saved endpoint for future requests.
      if (pMsg.includes('صفحة HTML') && primaryUrl !== ONLINE_DEFAULT_API_URL) {
        try {
          const data = await executeSingleUrlRequest(ONLINE_DEFAULT_API_URL, action, requestPayload, headers);
          setBaseUrl(ONLINE_DEFAULT_API_URL);
          console.info('[MickeyStudioAPI] Recovered from a stale API URL; using the Mickey Studio Worker.');
          return data;
        } catch (fallbackErr) {
          console.warn('[MickeyStudioAPI] Worker fallback failed:', fallbackErr?.message || fallbackErr);
        }
      }
      if (pMsg.includes('Google Gemini') || pMsg.includes('Gemini') || pMsg.includes('Neural') || pMsg.includes('حصة') || pMsg.includes('مفتاح')) {
        throw primaryErr;
      }
      console.warn(`[MickeyStudioAPI] Endpoint (${primaryUrl}) error:`, pMsg);
      throw new Error(`تعذر الاتصال بخادم المنصة (${pMsg}). تأكد من إعدادات الربط أو رفع الموقع إلى الاستضافة.`);
    }
  }

  function findText(value, depth = 0) {
    if (depth > 4 || value == null) return '';
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) return value.map(item => findText(item, depth + 1)).filter(Boolean).join('\n');
    if (typeof value === 'object') {
      for (const key of ['transcript', 'transcription', 'text', 'enhanced_prompt', 'result', 'content', 'output', 'data']) {
        if (value[key] != null) {
          const found = findText(value[key], depth + 1);
          if (found) return found;
        }
      }
    }
    return '';
  }

  function findField(value, names, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 5) return null;
    for (const name of names) if (typeof value[name] === 'string' && value[name]) return value[name];
    for (const child of Object.values(value)) {
      const found = findField(child, names, depth + 1);
      if (found) return found;
    }
    return null;
  }

  function looksLikeAudio(bytes) {
    if (!bytes || bytes.length < 4) return false;
    // MP3 (ID3 or MPEG frame), WAV, Ogg, FLAC, and MP4/M4A signatures.
    const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
    return ascii(0, 3) === 'ID3' || ascii(0, 4) === 'RIFF' || ascii(0, 4) === 'OggS'
      || ascii(0, 4) === 'fLaC' || ascii(4, 8) === 'ftyp'
      || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  }

  async function generateImage(prompt, aspectRatio = '16:9', model = 'nano-banana') {
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) throw new Error('اكتب وصف الصورة أولًا.');
    if (model === 'cloudflare-flux') {
      const savedApiUrl = new URL(getBaseUrl());
      const workerOrigin = /\.workers\.dev$/i.test(savedApiUrl.hostname)
        ? savedApiUrl.origin : new URL(ONLINE_DEFAULT_API_URL).origin;
      const dimensions = { '16:9': [1280, 720], '1:1': [1024, 1024], '9:16': [720, 1280] }[aspectRatio] || [1280, 720];
      const response = await fetch(`${workerOrigin}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: cleanPrompt, width: dimensions[0], height: dimensions[1] })
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        const message = String(details.error || '');
        if (response.status === 429 || /quota|neuron|daily limit/i.test(message)) {
          throw new Error('انتهت الحصة المجانية اليومية لـ Cloudflare FLUX. جرّب FLUX.1 أو أعد المحاولة لاحقًا.');
        }
        throw new Error(message || `تعذر التوليد عبر Cloudflare (HTTP ${response.status}).`);
      }
      const mimeType = response.headers.get('content-type') || '';
      if (!mimeType.startsWith('image/')) throw new Error('أعاد Cloudflare استجابة غير صالحة كصورة.');
      return { base64Data: toBase64(await response.arrayBuffer()), mimeType };
    }
    if (model === 'flux') {
      const dimensions = { '16:9': [1280, 720], '1:1': [1024, 1024], '9:16': [720, 1280] }[aspectRatio] || [1280, 720];
      const baseUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt.replace(/\//g, ' '))}?width=${dimensions[0]}&height=${dimensions[1]}&seed=${Math.floor(Math.random() * 999999999)}`;
      for (const imageUrl of [`${baseUrl}&model=flux&nologo=true`, `${baseUrl}&nologo=true`]) {
        try {
          const response = await fetch(imageUrl);
          const mimeType = response.headers.get('content-type') || '';
          if (response.ok && mimeType.startsWith('image/')) return { base64Data: toBase64(await response.arrayBuffer()), mimeType };
        } catch (error) { console.warn('[MickeyStudioAPI] FLUX.1 route failed:', error?.message || error); }
      }
      throw new Error('خدمة FLUX.1 مشغولة أو لم تُرجع صورة. جرّب FLUX.2 أو أعد المحاولة بعد قليل.');
    }

    let data;
    try {
      data = await request('generate_image', { prompt: cleanPrompt, aspectRatio });
    } catch (error) {
      const message = String(error?.message || error);
      if (/429|quota|current usage|billing|exceeded your current/i.test(message)) {
        throw new Error('انتهت حصة Gemini أو تم بلوغ حد الاستخدام الحالي. اختر FLUX.1 أو FLUX.2 من محرك التوليد، أو راجع حصة وفوترة Gemini.');
      }
      throw error;
    }
    const encoded = findField(data, ['_media_base64', 'image_base64', 'image_data', 'base64Data', 'base64', 'image', 'data']);
    if (encoded) {
      const match = encoded.match(/^data:([^;]+);base64,(.*)$/s);
      return { base64Data: (match ? match[2] : encoded).trim(), mimeType: match?.[1] || findField(data, ['_mime_type', 'mime_type', 'mimeType']) || 'image/png' };
    }
    const imageUrl = findField(data, ['image_url', 'imageUrl', 'url']);
    if (imageUrl) {
      const parsedUrl = new URL(imageUrl, getBaseUrl());
      if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') throw new Error('رابط الصورة الناتجة غير آمن.');
      const imageHeaders = parsedUrl.hostname === new URL(getBaseUrl()).hostname
        ? { Authorization: `Bearer ${await getAuthToken()}` } : {};
      const imageResponse = await fetch(parsedUrl.href, { headers: imageHeaders });
      if (!imageResponse.ok) throw new Error(`تعذر تنزيل الصورة الناتجة (${imageResponse.status}).`);
      return { base64Data: toBase64(await imageResponse.arrayBuffer()), mimeType: imageResponse.headers.get('content-type') || 'image/png' };
    }
    throw new Error('لم تُرجع خدمة Mickey Studio بيانات الصورة.');
  }

  function fileMimeType(filePath) {
    const extension = String(filePath || '').split('.').pop().toLowerCase();
    return ({
      mp3: 'audio/mp3', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
      ogg: 'audio/ogg', webm: 'audio/webm', mp4: 'video/mp4', mov: 'video/quicktime',
      m4v: 'video/mp4', mpga: 'audio/mpeg', flac: 'audio/flac',
    })[extension] || '';
  }

  async function transcribeFile(filePath, dialect = 'auto') {
    const fs = require('fs');
    if (!fileMimeType(filePath)) throw new Error('صيغة الملف غير مدعومة لتفريغ الصوت العربي.');
    // Premiere's UXP fs module exposes lstat/readFile as Promise APIs on some
    // versions and may not implement Node's statSync/readFileSync methods.
    let stat = null;
    if (typeof fs.lstatSync === 'function') stat = fs.lstatSync(filePath);
    else if (typeof fs.lstat === 'function') stat = await fs.lstat(filePath);
    else if (typeof fs.statSync === 'function') stat = fs.statSync(filePath);
    else if (typeof fs.stat === 'function') stat = await fs.stat(filePath);
    if (stat?.size > 13_000_000) throw new Error('الجزء المحدد أكبر من الحد المسموح للتفريغ. قلّص In/Out ثم أعد المحاولة.');
    const mimeType = fileMimeType(filePath);
    const fileBytes = typeof fs.readFileSync === 'function'
      ? fs.readFileSync(filePath)
      : await fs.readFile(filePath);
    const fileSize = fileBytes?.byteLength ?? fileBytes?.length ?? 0;
    if (fileSize > 13_000_000) throw new Error('الجزء المحدد أكبر من الحد المسموح للتفريغ. قلّص In/Out ثم أعد المحاولة.');
    const audioBase64 = toBase64(fileBytes);
    const data = await request('transcribe_audio', { audio_base64: audioBase64, mime_type: mimeType, dialect });
    const transcript = findText(data);
    if (!transcript) throw new Error('لم تُرجع خدمة Mickey Studio نصًا. تحقق من حالة حسابك وحاول مجددًا.');
    return { transcript, raw: data };
  }

  async function transcribeBytes(audioBytes, mimeType = 'audio/wav', dialect = 'auto') {
    const bytes = audioBytes instanceof Uint8Array ? audioBytes : new Uint8Array(audioBytes || []);
    if (!bytes.length) throw new Error('لا توجد بيانات صوت لإرسالها للتفريغ.');
    if (bytes.byteLength > 13_000_000) throw new Error('الجزء المحدد أكبر من الحد المسموح للتفريغ. قلّص In/Out ثم أعد المحاولة.');
    const data = await request('transcribe_audio', { audio_base64: toBase64(bytes), mime_type: mimeType, dialect });
    const transcript = findText(data);
    if (!transcript) throw new Error('لم تُرجع خدمة Mickey Studio نصًا. تحقق من حالة حسابك وحاول مجددًا.');
    return { transcript, raw: data };
  }

  async function enhancePrompt(prompt) {
    const data = await request('enhance_prompt', { prompt: String(prompt || '').trim() });
    const enhanced = findText(data);
    if (!enhanced) throw new Error('لم تُرجع خدمة تحسين الوصف نصًا.');
    return enhanced;
  }



  async function synthesizeDirectFallback(text) {
    const words = String(text || '').trim().split(/\s+/);
    const chunks = [];
    let current = '';
    for (const w of words) {
      if ((current + ' ' + w).length > 140) {
        if (current) chunks.push(current.trim());
        current = w;
      } else {
        current = current ? current + ' ' + w : w;
      }
    }
    if (current.trim()) chunks.push(current.trim());

    const audioBuffers = [];
    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Google TTS status: ${res.status}`);
      const ab = await res.arrayBuffer();
      const buf = new Uint8Array(ab);
      audioBuffers.push(buf);
    }

    const totalLen = audioBuffers.reduce((sum, b) => sum + b.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const b of audioBuffers) {
      combined.set(b, offset);
      offset += b.length;
    }
    return combined;
  }

  async function generateVoiceover(text, settings = {}) {
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new Error('اكتب نص التعليق الصوتي أولاً.');
    if (cleanText.length > 6000) throw new Error('النص طويل جدًا. الحد الأقصى 6000 حرف لكل ملف صوتي.');
    if (typeof settings === 'string') settings = { voice: settings };
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
    const dialects = {
      egyptian: 'Egyptian Arabic', saudi: 'Saudi Arabic', levantine: 'Levantine Arabic',
      iraqi: 'Iraqi Arabic', algerian: 'Algerian Arabic', moroccan: 'Moroccan Arabic',
      tunisian: 'Tunisian Arabic', gulf: 'Gulf Arabic', fusha: 'Modern Standard Arabic',
    };
    const performanceInfo = voices[settings.performance] || voices.neutral;
    const gender = settings.gender === 'female' ? 'female' : 'male';
    const age = ({ adult: 'adult', senior: 'older adult', cartoon: 'animated character' })[settings.age] || 'adult';
    const warmth = ({ cool: 'cool and composed', balanced: 'balanced warmth', warm: 'warm and human' })[settings.warmth] || 'balanced warmth';
    const emotion = ({ calm: 'calm and restrained', medium: 'moderately expressive', strong: 'highly expressive' })[settings.emotion] || 'moderately expressive';
    const intensity = ({ light: 'subtle dramatic intensity', medium: 'moderate dramatic intensity', strong: 'strong dramatic intensity' })[settings.intensity] || 'moderate dramatic intensity';
    const dialect = settings.dialect || 'egyptian';
    const rate = Math.max(0.7, Math.min(1.3, Number(settings.rate) || 1));
    const pitch = Math.max(0.7, Math.min(1.3, Number(settings.pitch) || 1));
    const voice = gender === 'female' ? performanceInfo[1] : performanceInfo[0];
    const style = `Speak in ${dialects[dialect] || dialects.egyptian}, with a ${gender === 'female' ? 'feminine' : 'masculine'} ${age} voice. Use ${performanceInfo[2]}; be ${warmth} and ${emotion}, with ${intensity}. Pace ${rate < 0.9 ? 'slowly' : rate > 1.1 ? 'briskly' : 'at a natural pace'} (${rate.toFixed(2)}x), with a ${pitch < 0.9 ? 'lower' : pitch > 1.1 ? 'higher' : 'natural'} pitch. Read the supplied Arabic text verbatim; do not translate it or say these directions aloud.`;

    const engine = settings.engine || (typeof StudioStorage?.getVoiceoverEngine === 'function' ? StudioStorage.getVoiceoverEngine() : (typeof StudioStorage?.get === 'function' ? StudioStorage.get('mickey_voiceover_engine') : '')) || 'gemini';

    const requestBody = {
      text: cleanText,
      voice,
      style,
      rate,
      pitch,
      dialect,
      gender,
      performance: settings.performance || 'neutral',
      age: settings.age || 'adult',
      warmth: settings.warmth || 'balanced',
      emotion: settings.emotion || 'medium',
      intensity: settings.intensity || 'medium',
      engine,
      model: 'gemini-3.8-flash-tts',
      input: [{ type: 'user_input', content: [{ type: 'text', text: cleanText, annotations: [{ type: 'speech_metadata', style }] }] }],
      response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
      generation_config: { speech_config: [{ voice }] },
      return_json: true,
    };

    let data = null;
    try {
      data = await request('generate_tts', requestBody);
    } catch (netErr) {
      console.error('[MickeyStudioAPI] TTS call failed:', netErr);
      const errMsg = netErr && netErr.message ? netErr.message : String(netErr);
      if (errMsg.includes('Google Gemini') || errMsg.includes('Gemini') || errMsg.includes('Neural') || errMsg.includes('مفتاح')) {
        throw new Error(errMsg);
      }
      throw new Error(`تعذر توليد الصوت من المنصة: ${errMsg}. تحقق من أن رابط API على الاستضافة يعيد JSON وليس صفحة HTML.`);
    }

    const b64 = data?._media_base64 || data?.base64Data || data?.audio_base64;
    if (!b64) {
      throw new Error('لم تُرجع خدمة Mickey Studio ملفًا صوتيًا صالحًا. تأكد من تشغيل خادم المنصة.');
    }

    const mimeType = String(data._mime_type || data.mimeType || 'audio/mpeg').split(';')[0].toLowerCase();
    let audioBytes;
    try {
      if (typeof Buffer !== 'undefined') {
        audioBytes = Buffer.from(b64, 'base64');
      } else {
        const binary = atob(b64);
        audioBytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) audioBytes[i] = binary.charCodeAt(i);
      }
    } catch (_) {
      throw new Error('وصل ملف التعليق الصوتي بترميز غير صالح.');
    }

    if (!looksLikeAudio(audioBytes)) {
      throw new Error('الملف الناتج ليس ملف صوت صالحًا.');
    }

    const isWav = audioBytes.length > 12 && String.fromCharCode(...audioBytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...audioBytes.subarray(8, 12)) === 'WAVE';
    const detectedMime = isWav ? 'audio/wav' : (mimeType.includes('wav') ? 'audio/wav' : 'audio/mpeg');
    const engineUsed = data?.engine_used || data?.engine || (isWav ? 'gemini' : 'neural');
    const note = data?.note || '';

    return { base64Data: b64, mimeType: detectedMime, engineUsed, note, isWav, voiceUsed: data?.voice || voice };
  }

  async function removeBackground(imageBase64, mimeType = 'image/png') {
    try {
      const { Client, handle_file } = await import('https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js');
      const client = await Client.connect('ZhengPeng7/BiRefNet_demo');
      const binary = atob(imageBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType });
      const result = await client.predict('/image', [await handle_file(blob), '1024x1024', 'General']);
      const outputData = result?.data?.[0];
      const resUrl = typeof outputData === 'string' ? outputData : (outputData?.url || outputData?.path);
      if (resUrl) {
        const res = await fetch(resUrl);
        const resBytes = new Uint8Array(await res.arrayBuffer());
        return { base64Data: toBase64(resBytes), mimeType: 'image/png' };
      }
    } catch (e) {
      console.warn('[MickeyStudioAPI] BiRefNet direct error:', e);
    }
    throw new Error('تعذر عزل الخلفية حالياً. تحقق من الاتصال بالإنترنت.');
  }

  async function upscaleImage(imageBase64, mimeType = 'image/png', scale = 2) {
    try {
      const { Client, handle_file } = await import('https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js');
      const client = await Client.connect('guetLzy/Real-ESRGAN-Demo');
      const binary = atob(imageBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType });
      const result = await client.predict('/enhance', [await handle_file(blob), 'RealESRGAN_x4plus', scale, false]);
      const outputData = result?.data?.[0];
      const resUrl = typeof outputData === 'string' ? outputData : (outputData?.url || outputData?.path);
      if (resUrl) {
        const res = await fetch(resUrl);
        const resBytes = new Uint8Array(await res.arrayBuffer());
        return { base64Data: toBase64(resBytes), mimeType: 'image/png' };
      }
    } catch (e) {
      console.warn('[MickeyStudioAPI] RealESRGAN direct error:', e);
    }
    throw new Error('تعذر تكبير الصورة. تحقق من الاتصال بالإنترنت.');
  }

  return {
    getBaseUrl,
    setBaseUrl,
    testApiConnection,
    getAuthToken,
    connectAccount,
    disconnectAccount,
    ensureAccountAccess,
    updateAccountLinkStatus,
    request,
    transcribeFile,
    transcribeBytes,
    enhancePrompt,
    generateImage,
    generateVoiceover,
    removeBackground,
    upscaleImage,
    showAccountDialog,
    hideAccountDialog,
  };
})();

if (typeof window !== 'undefined') {
  window.MickeyStudioAPI = MickeyStudioAPI;
  window.showAccountDialog = MickeyStudioAPI.showAccountDialog;
  window.hideAccountDialog = MickeyStudioAPI.hideAccountDialog;
}
if (typeof globalThis !== 'undefined') {
  globalThis.MickeyStudioAPI = MickeyStudioAPI;
}
