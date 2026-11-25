/**
 * Mickey Studio - Free Zero-Data Error Telemetry & Health Monitoring
 * Captures uncaught frontend exceptions & unhandled promise rejections.
 * Strictly strips all personal data, user prompts, tokens, and credentials.
 */
(function (root) {
  'use strict';

  const MAX_ERRORS_PER_SESSION = 6;
  const reportedSignatures = new Set();
  let errorCount = 0;

  function getApiEndpoint() {
    // Check if worker URL configured or relative route
    if (typeof window !== 'undefined' && window.MICKEY_WORKER_URL) {
      return `${window.MICKEY_WORKER_URL}?action=client_error`;
    }
    return 'api.php?action=client_error';
  }

  function sanitizeString(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/(?:key|token|bearer|secret|auth|password|cred)=[^&\s]+/gi, '$1=REDACTED')
      .replace(/AIza[0-9A-Za-z-_]{35}/g, 'API_KEY_REDACTED')
      .replace(/eyJ[0-9A-Za-z-_]+\.[0-9A-Za-z-_]+/g, 'JWT_REDACTED');
  }

  function reportError(details) {
    if (errorCount >= MAX_ERRORS_PER_SESSION) return;

    const signature = `${details.source || ''}:${details.lineno || 0}:${(details.message || '').slice(0, 50)}`;
    if (reportedSignatures.has(signature)) return;
    reportedSignatures.add(signature);
    errorCount++;

    const payload = {
      message: sanitizeString(details.message || 'Unknown error'),
      source: (details.source || 'inline').split('/').pop().split('?')[0],
      lineno: Number(details.lineno) || 0,
      colno: Number(details.colno) || 0,
      stack: sanitizeString((details.stack || '').slice(0, 1000)),
      userAgent: (navigator.userAgent || '').slice(0, 150),
      timestamp: new Date().toISOString()
    };

    const endpoint = getApiEndpoint();
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      }
    } catch (_) {
      // Telemetry must never crash the host application
    }
  }

  // Global uncaught error listener
  window.addEventListener('error', function (event) {
    // Ignore harmless cross-origin resize / script error events
    if (event.message === 'Script error.' && !event.filename) return;

    reportError({
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error ? event.error.stack : ''
    });
  });

  // Global unhandled promise rejection listener
  window.addEventListener('unhandledrejection', function (event) {
    const reason = event.reason;
    reportError({
      message: reason ? (reason.message || String(reason)) : 'Unhandled Promise Rejection',
      source: 'Promise',
      stack: reason && reason.stack ? reason.stack : ''
    });
  });

  root.MickeyTelemetry = {
    reportError,
    getErrorCount: () => errorCount
  };

})(typeof window !== 'undefined' ? window : this);
