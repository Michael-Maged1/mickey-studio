/**
 * storage.js — Mickey Gemini Studio for Adobe Premiere Pro
 *
 * Lightweight persistent preferences storage using UXP localStorage.
 */

'use strict';

const StudioStorage = (() => {
  const KEYS = {
    RECENT_FILES:    'mickey_recent_files',
    AUTO_CLEAR:      'mickey_auto_clear',
    DOWNLOADS_TOKEN: 'mickey_downloads_token',
    DOWNLOADS_PATH:  'mickey_downloads_path',
    LAST_OP_TIME:    'mickey_last_op_time',
    AUTO_DROP:       'mickey_auto_drop',
    MICKEY_REFRESH_TOKEN: 'mickey_studio_firebase_refresh_token',
    MICKEY_ACCOUNT_EMAIL: 'mickey_studio_account_email',
    MICKEY_API_URL:       'mickey_studio_api_url',
    MICKEY_DEV_API_KEY:   'mickey_studio_dev_api_key',
    PROMPT_TEMPLATES: 'mickey_prompt_templates_v1',
  };

  function getDeveloperApiKey() {
    try { return localStorage.getItem(KEYS.MICKEY_DEV_API_KEY) || ''; } catch (_) { return ''; }
  }
  function setDeveloperApiKey(key) {
    try {
      if (key && typeof key === 'string' && key.trim()) {
        localStorage.setItem(KEYS.MICKEY_DEV_API_KEY, key.trim());
      } else {
        localStorage.removeItem(KEYS.MICKEY_DEV_API_KEY);
      }
    } catch (err) { console.warn('[StudioStorage] setDeveloperApiKey error:', err); }
  }

  function getApiKey() { return getDeveloperApiKey(); }
  function setApiKey(k) { setDeveloperApiKey(k); }
  function getMickeyApiKey() { return getDeveloperApiKey(); }
  function setMickeyApiKey(k) { setDeveloperApiKey(k); }

  async function getAccountRefreshToken() {
    try {
      const secureStorage = require('uxp').storage.secureStorage;
      const value = await secureStorage.getItem(KEYS.MICKEY_REFRESH_TOKEN);
      if (value) return new TextDecoder().decode(value);
    } catch (_) {}
    try { return localStorage.getItem(KEYS.MICKEY_REFRESH_TOKEN) || ''; } catch (_) { return ''; }
  }

  async function setAccountSession(refreshToken, email = '') {
    try {
      const secureStorage = require('uxp').storage.secureStorage;
      if (refreshToken) await secureStorage.setItem(KEYS.MICKEY_REFRESH_TOKEN, refreshToken);
      else { try { await secureStorage.removeItem(KEYS.MICKEY_REFRESH_TOKEN); } catch (_) {} }
    } catch (_) {}
    try {
      if (refreshToken) localStorage.setItem(KEYS.MICKEY_REFRESH_TOKEN, refreshToken);
      else localStorage.removeItem(KEYS.MICKEY_REFRESH_TOKEN);
      if (email) localStorage.setItem(KEYS.MICKEY_ACCOUNT_EMAIL, email);
      else localStorage.removeItem(KEYS.MICKEY_ACCOUNT_EMAIL);
    } catch (err) { console.warn('[StudioStorage] setAccountSession error:', err); }
  }

  async function clearAccountSession() { await setAccountSession('', ''); }
  function getAccountEmail() { try { return localStorage.getItem(KEYS.MICKEY_ACCOUNT_EMAIL) || ''; } catch (_) { return ''; } }

  function getApiUrl() {
    try { return localStorage.getItem(KEYS.MICKEY_API_URL) || ''; } catch (_) { return ''; }
  }
  function setApiUrl(url) {
    try {
      if (url && typeof url === 'string' && url.trim()) {
        localStorage.setItem(KEYS.MICKEY_API_URL, url.trim());
      } else {
        localStorage.removeItem(KEYS.MICKEY_API_URL);
      }
    } catch (err) { console.warn('[StudioStorage] setApiUrl error:', err); }
  }

  function getRecentFiles() {
    try {
      const data = localStorage.getItem(KEYS.RECENT_FILES);
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  function addRecentFile(fileInfo) {
    try {
      if (!fileInfo || !fileInfo.name) return;
      const list = getRecentFiles().filter(item => item.nativePath !== fileInfo.nativePath);
      list.unshift({
        name: fileInfo.name,
        nativePath: fileInfo.nativePath,
        type: fileInfo.type || 'media',
        timestamp: Date.now(),
      });
      // Keep up to 20 recent files
      localStorage.setItem(KEYS.RECENT_FILES, JSON.stringify(list.slice(0, 20)));
    } catch (err) {
      console.warn('[StudioStorage] addRecentFile error:', err);
    }
  }

  function clearRecentFiles() {
    try {
      localStorage.removeItem(KEYS.RECENT_FILES);
    } catch (_) {}
  }

  function getDownloadsToken() {
    try {
      return localStorage.getItem(KEYS.DOWNLOADS_TOKEN) || null;
    } catch (_) {
      return null;
    }
  }

  function setDownloadsToken(token) {
    try {
      if (token) localStorage.setItem(KEYS.DOWNLOADS_TOKEN, token);
      else localStorage.removeItem(KEYS.DOWNLOADS_TOKEN);
    } catch (err) {
      console.warn('[StudioStorage] setDownloadsToken error:', err);
    }
  }

  function getDownloadsPath() {
    try {
      return localStorage.getItem(KEYS.DOWNLOADS_PATH) || null;
    } catch (_) {
      return null;
    }
  }

  function setDownloadsPath(path) {
    try {
      if (path) localStorage.setItem(KEYS.DOWNLOADS_PATH, path);
      else localStorage.removeItem(KEYS.DOWNLOADS_PATH);
    } catch (err) {
      console.warn('[StudioStorage] setDownloadsPath error:', err);
    }
  }

  function getLastOperationTime() {
    try {
      const t = localStorage.getItem(KEYS.LAST_OP_TIME);
      return t ? parseInt(t, 10) : 0;
    } catch (_) {
      return 0;
    }
  }

  function setLastOperationTime(ts = Date.now()) {
    try {
      localStorage.setItem(KEYS.LAST_OP_TIME, String(ts));
    } catch (_) {}
  }

  function getAutoDropEnabled() {
    try {
      const val = localStorage.getItem(KEYS.AUTO_DROP);
      return val !== null ? val === 'true' : true; // Default: Enabled
    } catch (_) {
      return true;
    }
  }

  function setAutoDropEnabled(enabled) {
    try {
      localStorage.setItem(KEYS.AUTO_DROP, String(!!enabled));
    } catch (_) {}
  }

  function getPromptTemplates() {
    try {
      const value = localStorage.getItem(KEYS.PROMPT_TEMPLATES);
      const templates = value ? JSON.parse(value) : [];
      return Array.isArray(templates) ? templates.filter(item => item && item.name && item.prompt) : [];
    } catch (_) { return []; }
  }

  function setPromptTemplates(templates) {
    try {
      localStorage.setItem(KEYS.PROMPT_TEMPLATES, JSON.stringify((templates || []).slice(0, 30)));
    } catch (err) { console.warn('[StudioStorage] setPromptTemplates error:', err); }
  }

  function get(key, defaultValue = '') {
    try {
      const val = localStorage.getItem(key);
      return val !== null && val !== undefined ? val : defaultValue;
    } catch (_) {
      return defaultValue;
    }
  }

  function set(key, value) {
    try {
      if (value !== undefined && value !== null) {
        localStorage.setItem(key, String(value));
      } else {
        localStorage.removeItem(key);
      }
    } catch (err) {
      console.warn('[StudioStorage] set error:', err);
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }

  function getGeminiKey() {
    return get('mickey_gemini_key', '');
  }

  function setGeminiKey(key) {
    set('mickey_gemini_key', key || '');
  }

  function getVoiceoverEngine() {
    return get('mickey_voiceover_engine', 'gemini');
  }

  function setVoiceoverEngine(engine) {
    set('mickey_voiceover_engine', engine || 'gemini');
  }

  return {
    get,
    set,
    remove,
    getGeminiKey,
    setGeminiKey,
    getVoiceoverEngine,
    setVoiceoverEngine,
    getRecentFiles,
    addRecentFile,
    clearRecentFiles,
    getDownloadsToken,
    setDownloadsToken,
    getDownloadsPath,
    setDownloadsPath,
    getLastOperationTime,
    setLastOperationTime,
    getAutoDropEnabled,
    setAutoDropEnabled,
    getApiKey,
    setApiKey,
    getMickeyApiKey,
    setMickeyApiKey,
    getAccountRefreshToken,
    getAccountEmail,
    getDeveloperApiKey,
    setDeveloperApiKey,
    getApiUrl,
    setApiUrl,
    setAccountSession,
    clearAccountSession,
    getPromptTemplates,
    setPromptTemplates,
  };
})();
