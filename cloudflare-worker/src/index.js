const FIREBASE_PROJECT = 'mickey-gemini-studio';
const DEFAULT_FIREBASE_API_KEY = 'AIzaSyAbwmXwJkb5nl2sUDCZ0ing_cWs0lbYAWg';
const ADMIN_EMAIL = 'michaelmagednew@gmail.com';
const ADMIN_EMAILS = [ADMIN_EMAIL, 'jonmaring012@gmail.com'];
function isDesignatedAdminEmail(email, configuredEmails = '') {
  const allowed = new Set([...ADMIN_EMAILS, ...String(configuredEmails).split(',')].map(value => value.trim().toLowerCase()).filter(Boolean));
  return allowed.has(String(email || '').trim().toLowerCase());
}
const GEMINI_TTS_MODEL = 'gemini-3.8-flash-tts';
let firebaseAdminTokenCache = null;

// Default plans schema (designed for manual assignment & future payment webhook integrations)
const DEFAULT_PLANS = {
  free: {
    id: 'free',
    name: 'الخطة المجانية',
    name_en: 'Free Plan',
    description: 'الخطة الأساسية لكافة المستخدمين الجدد',
    limits: {
      images: { daily: 15, monthly: 300 },
      voice: { daily: 20, monthly: 400 },
      transcription: { daily: 10, monthly: 150 },
      motion_ai: { daily: 5, monthly: 80 },
      video: { daily: 5, monthly: 80 }
    },
    features: {
      max_devices: 2,
      extension_access: true,
      watermark_free: false,
      max_upload_size_mb: 50
    }
  },
  pro: {
    id: 'pro',
    name: 'الخطة الاحترافية (Pro)',
    name_en: 'Pro Plan',
    description: 'للمصممين المحترفين وصناع المحتوى النشطين',
    price: null,
    currency: 'EGP',
    billing_period: 'month',
    unlimited_usage: true,
    limits: {
      images: { daily: 100, monthly: 2000 },
      voice: { daily: 150, monthly: 3000 },
      transcription: { daily: 50, monthly: 1000 },
      motion_ai: { daily: 50, monthly: 1000 },
      video: { daily: 25, monthly: 500 }
    },
    features: {
      max_devices: 2,
      extension_access: true,
      watermark_free: true,
      max_upload_size_mb: 500
    }
  }
};

// The catalog is stable product metadata; plan decisions and limits are stored
// in Durable Object SQLite rows and are editable without releasing the worker.
const TOOL_CATALOG = [
  ['shortcuts', 'اختصارات المؤثرات', 'local', 'none', 'تطبيق الاختصارات المحلية للمؤثرات'],
  ['library', 'معرض الأعمال', 'local', 'none', 'عرض الملفات والمشاريع المحفوظة'],
  ['caption_styles', 'أنماط الكابشن', 'local', 'none', 'تطبيق أنماط الكابشن المحلية'],
  ['srt_export', 'تصدير SRT', 'local', 'none', 'تصدير ملفات الترجمة'],
  ['transcription', 'التفريغ الصوتي', 'ai', 'monthly', 'تفريغ وتحليل الصوت'],
  ['captions_create', 'إنشاء الكابشن', 'ai', 'monthly', 'إنشاء الكابشن من الصوت أو الفيديو'],
  ['image_generate', 'توليد الصور', 'ai', 'monthly', 'توليد الصور بالذكاء الاصطناعي'],
  ['voiceover', 'التعليق الصوتي', 'ai', 'monthly', 'توليد التعليق الصوتي'],
  ['photolab_bg', 'إزالة خلفية الصور', 'ai', 'monthly', 'إزالة خلفية الصور بالذكاء الاصطناعي'],
  ['photolab_upscale', 'تحسين الصور', 'ai', 'monthly', 'تحسين وتكبير الصور بالذكاء الاصطناعي'],
  ['prompt_enhance', 'تحسين الوصف', 'ai', 'monthly', 'تحسين أوصاف الصور والنصوص'],
  ['text_refine', 'تحسين النصوص', 'ai', 'monthly', 'تنقيح النصوص بالذكاء الاصطناعي'],
  ['broll', 'المقاطع المساندة', 'ai', 'monthly', 'تحليل واختيار المقاطع المساندة'],
  ['chapters', 'فصول الفيديو', 'ai', 'monthly', 'إنشاء فصول الفيديو'],
  ['video_generate', 'توليد الفيديو', 'ai', 'monthly', 'توليد الفيديو بالذكاء الاصطناعي']
].map(([key, name_ar, category, cost_type, description]) => ({ key, name_ar, category, cost_type, description }));

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const url = new URL(request.url);
      const queryAction = url.searchParams.get('action') || '';
      const isBinarySilenceRequest = request.method === 'POST' && queryAction === 'analyze_video_silence' && /^(?:video|audio)\//i.test(request.headers.get('Content-Type') || '');
      const body = request.method === 'POST' && !isBinarySilenceRequest ? await request.json().catch(() => ({})) : {};
      let action = queryAction || body.action || 'status';
      if (request.method === 'GET' && url.pathname === '/api/me') action = 'me';
      if (url.pathname === '/generate' && !queryAction && !body.action) action = 'generate_image';
      const deviceRoute = url.pathname.match(/^\/api\/devices(?:\/([^/]+))?\/?$/);
      if (deviceRoute) {
        action = request.method === 'GET' && !deviceRoute[1] ? 'device_list' : 'device_revoke';
        if (deviceRoute[1]) body.deviceId = decodeURIComponent(deviceRoute[1]);
      }
      const headers = { ...cors, 'Cache-Control': 'no-store', 'Pragma': 'no-cache' };
      const context = { request, env, url, body, action, headers, rawVideoStream: isBinarySilenceRequest ? request.body : null };

      // Every authenticated extension request registers or checks the device on
      // the server. Browser account pages may omit device headers.
      const deviceId = request.headers.get('X-Device-Id') || '';
      if (deviceId) {
        const apiKey = apiToken(context);
        if (apiKey.startsWith('mk_')) {
          const keys = await env.MICKEY_STATE.get('api_keys', 'json') || [];
          const entry = keys.find(item => item.key === apiKey && item.status !== 'revoked');
          if (!entry?.uid) fail(403, 'مفتاح API غير صالح أو تم إلغاؤه.');
          await enforceDeviceLimit({ uid: entry.uid, plan: 'free', token: '' }, context, true);
        } else {
          const token = bearer(request) || String(body.idToken || '');
          if (token) await enforceDeviceLimit(await authenticate(context), context, false);
        }
      }

      const toolKey = toolKeyForAction(action, body);
      if (toolKey) {
        const isMotionChunkContinuation = action === 'motion_scene_submit' && body.chunkId && Number(body.chunkIndex) > 0;
        context.toolAccess = await requireToolAccess(context, toolKey, {
          charge: action === 'consume_generation' || (!request.headers.get('X-Generation-Permit') && !isMotionChunkContinuation)
        });
      }

      if (url.pathname === '/generate') return await generateFluxImage(context);
      if (url.pathname === '/health' || url.pathname === '/status' || action === 'health') {
        return json({
          success: true,
          status: 'online',
          health: 'healthy',
          server: 'Mickey Studio AI Gateway',
          version: '4.5.0',
          time: nowIso(),
          features: {
            raw_video_silence_upload: true,
            pcm_wav_silence_analysis: true,
            multi_key_failover: true,
            subscription_limits_enforced: true,
            admin_panel_v2: true
          }
        }, 200, headers);
      }

      // Quota & limit enforcement for generation actions
      if (['generate_image', 'enhance_prompt', 'refine_voiceover', 'generate_tts', 'transcribe_audio', 'analyze_video_silence', 'detect_viral_clips', 'generate_chapters', 'detect_censor_words', 'photolab_upscale', 'upscale_image', 'photolab_bg', 'remove_background', 'consume_generation'].includes(action)) {
        context.access = await enforceGenerationAccess(context);
      }
    if (['list_api_keys', 'revoke_api_key'].includes(action)) {
        context.account = await authenticate(context, true);
      }

      switch (action) {
        // === Core & Public Endpoints ===
        case 'health':
        case 'status':
          return json({
            success: true,
            status: 'online',
            health: 'healthy',
            server: 'Mickey Studio AI Gateway',
            version: '4.5.0',
            features: {
              raw_video_silence_upload: true,
              pcm_wav_silence_analysis: true,
              multi_key_failover: true,
              subscription_limits_enforced: true,
              admin_panel_v2: true,
              photolab_ai: true
            },
            endpoints: [
              'generate_tts', 'enhance_prompt', 'transcribe_audio', 'analyze_video_silence',
              'detect_viral_clips', 'generate_chapters', 'detect_censor_words', 'generate_image',
              'upscale_image', 'remove_background', 'photolab_upscale', 'photolab_bg',
              'refine_voiceover', 'pair_begin', 'pair_complete', 'motion_scene_submit',
              'admin_list_users', 'admin_get_plans', 'admin_system_health', 'health'
            ]
          }, 200, headers);

        case 'get_gemini_keys':
        case 'get_gemini_key':
          return json(await getGeminiKeys(env), 200, headers);

        case 'generate_tts': return await generateTts(context);
        case 'generate_text': return await generateText(context);
        case 'save_gemini_key': return await saveUserGeminiKey(context);
        case 'generate_image': return await generateImage(context);
        case 'upscale_image':
        case 'photolab_upscale':
          return await upscaleImage(context);
        case 'remove_background':
        case 'photolab_bg':
          return await removeBackground(context);
        case 'enhance_prompt': return await enhancePrompt(context);
        case 'refine_voiceover': return await refineVoiceover(context);
        case 'transcribe_audio': return await transcribeAudio(context);
        case 'analyze_video_silence': return await analyzeVideoSilence(context);
        case 'detect_viral_clips': return await detectViralClips(context);
        case 'generate_chapters': return await generateChapters(context);
        case 'detect_censor_words': return await detectCensorWords(context);
        case 'proxy_media': return await proxyMedia(context);

        case 'consume_generation':
          return json({
            success: true,
            remaining: context.access.remaining,
            plan: context.access.account ? context.access.account.plan : 'guest',
            quota: context.access.quota || undefined,
            permit: context.access.permit || undefined
          }, 200, headers);

        case 'account_status': {
          const account = await authenticate(context, false);
          return json({
            success: true,
            uid: account.uid,
            email: account.email,
            status: account.status,
            plan: account.plan,
            extraCredits: account.extraCredits || 0,
            isAdmin: account.isAdmin,
            hasAdminClaim: account.hasAdminClaim
          }, 200, headers);
        }

        case 'record_usage': return await recordExternalToolUsage(context);

        case 'device_list': return await listUserDevices(context);
        case 'me': return await getCurrentUserAccess(context);
        case 'device_revoke': return await revokeUserDevice(context);
        case 'admin_get_user_devices': return await adminGetUserDevices(context);
        case 'admin_revoke_user_device': return await adminRevokeUserDevice(context);

        // === Extension Pairing & Motion Sync ===
        case 'pair_begin': return await pairBegin(context);
        case 'pair_complete': return await pairComplete(context);
        case 'pair_poll': return await pairPoll(context);
        case 'motion_scene_submit': return await submitMotionScene(context);
        case 'motion_scene_poll': return await pollMotionScene(context);
        case 'motion_scene_ack': return await acknowledgeMotionScene(context);
        case 'motion_audio_asset': return await motionAudioAsset(context);

        // === Developer API Keys ===
        case 'generate_api_key': return await generateApiKey(context);
        case 'list_api_keys': return await listApiKeys(context);
        case 'revoke_api_key': return await revokeApiKey(context);
        case 'api_docs': return json(apiDocs(context), 200, headers);

        // === Legacy Provider Key Actions (Kept for backwards compatibility) ===
        case 'admin_get_provider_keys': return await adminProviderKeys(context, false);
        case 'admin_save_provider_keys': return await adminProviderKeys(context, true);
        case 'admin_delete_gemini_key': return await deleteGeminiKey(context);
        case 'admin_test_gemini_key': return await testGeminiKey(context);

        // ======================================================================
        // === NEW ADMIN ACTIONS (Server-verified admin claim on EVERY action) ===
        // ======================================================================
        case 'admin_list_users': return await adminListUsers(context);
        case 'admin_update_user_status': return await adminUpdateUserStatus(context);
        case 'admin_update_user_plan': return await adminUpdateUserPlan(context);
        case 'admin_set_user_limits': return await adminSetUserLimits(context);
        case 'admin_add_user_credits': return await adminAddUserCredits(context);
        case 'admin_revoke_user_devices': return await adminRevokeUserDevices(context);
        case 'admin_delete_user': return await adminDeleteUser(context);
        case 'admin_activate_subscription': return await adminActivateSubscription(context);
        case 'admin_cancel_subscription': return await adminCancelSubscription(context);
        case 'admin_set_subscription_expiry': return await adminSetSubscriptionExpiry(context);

        case 'admin_get_plans': return await adminGetPlans(context);
        case 'admin_update_plans': return await adminUpdatePlans(context);
        case 'admin_set_subscription_mode': return await adminSetSubscriptionMode(context);
        case 'admin_get_tool_access': return await adminGetToolAccess(context);
        case 'admin_save_tool_access': return await adminSaveToolAccess(context);
        case 'admin_set_paywall': return await adminSetPaywall(context);
        case 'admin_save_tool_override': return await adminSaveToolOverride(context);
        case 'admin_list_coupons': return await adminListCoupons(context);
        case 'admin_create_coupon': return await adminCreateCoupon(context);
        case 'admin_toggle_coupon': return await adminToggleCoupon(context);
        case 'admin_delete_coupon': return await adminDeleteCoupon(context);

        case 'admin_list_keys': return await adminListGeminiKeys(context);
        case 'admin_add_keys': return await adminAddGeminiKeys(context);
        case 'admin_toggle_key': return await adminToggleGeminiKey(context);

        case 'admin_get_stats': return await adminGetStats(context);
        case 'admin_get_audit_logs': return await adminGetAuditLogs(context);
        case 'admin_system_health': return await adminSystemHealth(context);

        default:
          return json({ success: false, error: `الإجراء غير مدعوم: ${action}` }, 404, headers);
      }
    } catch (error) {
      const headers = { ...cors, 'Cache-Control': 'no-store' };
      return json({
        success: false,
        error: error?.publicMessage || 'حدث خطأ أثناء الاتصال بخدمة Mickey Studio.',
        ...(error?.code ? { code: error.code } : {}),
        ...(error?.devices ? { devices: error.devices } : {}),
        ...(error?.details || {})
      }, error?.status || 500, headers);
    }
  }
};

// ======================================================================
// CORS, Serialization & Common Helpers
// ======================================================================
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const configured = (env?.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const isLocalDev = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(origin);
  const isVercel = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
  const isExtension = /^chrome-extension:\/\/[a-p]{32}$/.test(origin) || /^(moz-extension|uxp):\/\//i.test(origin) || origin === 'null';
  const allowed = !origin || origin === 'null' || isLocalDev || isVercel || isExtension || configured.includes(origin);

  // When origin is provided, reflect the specific origin to satisfy browsers for Authorization headers
  const allowOrigin = (!origin || origin === 'null') ? '*' : (allowed ? origin : (configured[0] || origin));
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key, X-Anonymous-ID, X-Generation-Permit, X-Device-Id, X-Device-Name, X-Plugin-Version, X-Platform',
    'Access-Control-Expose-Headers': 'X-TTS-Engine, X-Quota-Remaining, X-Quota-Reset, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status = 200, headers = {}) {
  const h = new Headers(headers);
  h.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status, headers: h });
}

function fail(status, publicMessage) {
  const e = new Error(publicMessage);
  e.status = status;
  e.publicMessage = publicMessage;
  throw e;
}

function failWithCode(status, publicMessage, code, devices = []) {
  const error = new Error(publicMessage);
  error.status = status;
  error.publicMessage = publicMessage;
  error.code = code;
  error.devices = devices;
  throw error;
}

function failWithDetails(status, publicMessage, code, details = {}) {
  const error = new Error(publicMessage);
  error.status = status;
  error.publicMessage = publicMessage;
  error.code = code;
  error.details = details;
  throw error;
}

function nowIso() {
  return new Date().toISOString();
}

const ADMIN_USER_STATUS_KEY_PREFIX = 'admin:user-status:';

async function readAdminUserStatusOverride(env, uid) {
  try {
    const raw = await env.MICKEY_STATE?.get(`${ADMIN_USER_STATUS_KEY_PREFIX}${uid}`);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return ['active', 'banned', 'suspended'].includes(value.status) ? value : null;
  } catch (error) {
    console.error('[readAdminUserStatusOverride] Could not read status override:', error?.message || error);
    return null;
  }
}

async function writeAdminUserStatusOverride(env, uid, status, reason = '') {
  try {
    if (!env.MICKEY_STATE?.put) return false;
    await env.MICKEY_STATE.put(`${ADMIN_USER_STATUS_KEY_PREFIX}${uid}`, JSON.stringify({
      status,
      reason: status === 'active' ? '' : reason,
      updatedAt: nowIso()
    }));
    return true;
  } catch (error) {
    console.error('[writeAdminUserStatusOverride] Could not write status override:', error?.message || error);
    return false;
  }
}

async function deleteAdminUserStatusOverride(env, uid) {
  try {
    if (!env.MICKEY_STATE?.delete) return false;
    await env.MICKEY_STATE.delete(`${ADMIN_USER_STATUS_KEY_PREFIX}${uid}`);
    return true;
  } catch (error) {
    console.error('[deleteAdminUserStatusOverride] Could not delete status override:', error?.message || error);
    return false;
  }
}

function evaluateSubscription(sub, basePlan = 'free') {
  const fallbackPlan = basePlan || 'free';
  if (!sub || typeof sub !== 'object') {
    return {
      plan: fallbackPlan,
      status: 'active',
      started_at: null,
      expires_at: null,
      days_left: null,
      source: 'default',
      notes: '',
      is_active: true
    };
  }

  const rawPlan = sub.plan || fallbackPlan;
  // Free subscriptions never expire
  if (rawPlan === 'free' || !sub.expires_at) {
    return {
      plan: 'free',
      status: sub.status === 'cancelled' ? 'cancelled' : 'active',
      started_at: sub.started_at || null,
      expires_at: null,
      days_left: null,
      source: sub.source || 'default',
      notes: sub.notes || '',
      is_active: sub.status !== 'cancelled'
    };
  }

  const now = Date.now();
  const expiresMs = new Date(sub.expires_at).getTime();
  const isExpired = Number.isFinite(expiresMs) && now > expiresMs;

  if (sub.status === 'cancelled') {
    return {
      plan: 'free',
      original_plan: rawPlan,
      status: 'cancelled',
      started_at: sub.started_at || null,
      expires_at: sub.expires_at,
      days_left: 0,
      source: sub.source || 'manual',
      notes: sub.notes || '',
      is_active: false
    };
  }

  if (isExpired) {
    return {
      plan: 'free', // Dynamic fallback without cron
      original_plan: rawPlan,
      status: 'expired',
      started_at: sub.started_at || null,
      expires_at: sub.expires_at,
      days_left: 0,
      source: sub.source || 'manual',
      notes: sub.notes || '',
      is_active: false
    };
  }

  const msLeft = Math.max(0, expiresMs - now);
  const daysLeft = Math.ceil(msLeft / 86400000);

  return {
    plan: rawPlan,
    status: 'active',
    started_at: sub.started_at || null,
    expires_at: sub.expires_at,
    days_left: daysLeft,
    source: sub.source || 'manual',
    notes: sub.notes || '',
    is_active: true
  };
}

function envFirebaseKey(env) {
  return env.FIREBASE_WEB_API_KEY || DEFAULT_FIREBASE_API_KEY;
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function bearer(request) {
  const value = request.headers.get('Authorization') || '';
  return value.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
}

function apiToken(ctx) {
  return bearer(ctx.request) || ctx.request.headers.get('X-API-Key') || ctx.url.searchParams.get('api_key') || '';
}

function parseJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = atob(base64);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// Write-only key masking: only last 4 characters are EVER exposed to clients
function maskKey(key = '') {
  const clean = String(key || '').trim();
  if (clean.length < 8) return '••••••••';
  return `••••••••${clean.slice(-4)}`;
}

// ======================================================================
// Server-Verified Authentication & Custom Claim Verification
// ======================================================================
async function firebaseLookup(token, env) {
  if (!token) fail(401, 'سجّل الدخول أولاً للمتابعة.');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(envFirebaseKey(env))}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token })
  });
  const data = await readJson(response);
  const user = data.users?.[0];
  if (!response.ok || !user?.localId) {
    fail(401, 'جلسة تسجيل الدخول غير صالحة أو منتهية. يرجى تسجيل الدخول من جديد.');
  }
  return user;
}

function base64Url(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function firebaseAdminAccessToken(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    fail(503, 'لا يمكن سرد حسابات Firebase Authentication بعد. أضف اعتماد Firebase Admin كسر Worker باسم FIREBASE_SERVICE_ACCOUNT_JSON.');
  }
  if (firebaseAdminTokenCache && firebaseAdminTokenCache.expiresAt > Date.now() + 60000) {
    return firebaseAdminTokenCache.token;
  }

  let serviceAccount;
  try { serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON); }
  catch { fail(503, 'إعداد Firebase Admin في Worker غير صالح.'); }
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    fail(503, 'إعداد Firebase Admin في Worker لا يحتوي بيانات اعتماد صالحة.');
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore',
    aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
    iat: issuedAt,
    exp: issuedAt + 3600
  }))}`;
  let privateKeyBytes;
  try {
    const pem = serviceAccount.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
    const raw = atob(pem);
    privateKeyBytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
  } catch { fail(503, 'مفتاح Firebase Admin غير صالح.'); }

  let signingKey;
  try {
    signingKey = await crypto.subtle.importKey('pkcs8', privateKeyBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  } catch { fail(503, 'تعذر قراءة مفتاح Firebase Admin.'); }
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signingKey, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const response = await fetch(serviceAccount.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const data = await readJson(response);
  if (!response.ok || !data.access_token) {
    console.error('[Firebase Admin OAuth error]', response.status, data.error || '');
    fail(503, 'تعذر مصادقة Firebase Admin. تحقق من صلاحية اعتماد الخدمة وأدواره في Google Cloud.');
  }
  firebaseAdminTokenCache = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
  return data.access_token;
}

async function listFirebaseAuthUsers(env, accessToken) {
  const projectId = env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT;
  const users = [];
  let nextPageToken = '';
  let pages = 0;
  do {
    const params = new URLSearchParams({ maxResults: '1000' });
    if (nextPageToken) params.set('nextPageToken', nextPageToken);
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:batchGet?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await readJson(response);
    if (!response.ok) {
      console.error('[Firebase Auth list error]', response.status, data.error?.message || '');
      fail(502, 'تعذر جلب الحسابات من Firebase Authentication. تحقق من صلاحية firebaseauth.users.get لحساب الخدمة.');
    }
    users.push(...(data.users || []));
    nextPageToken = data.nextPageToken || '';
    pages++;
  } while (nextPageToken && pages < 100);
  return users;
}

async function authenticate(ctx, adminOnly = false) {
  const token = bearer(ctx.request) || String(ctx.body.idToken || '');
  const user = await firebaseLookup(token, ctx.env);

  // Extract server-verified custom claims from Google's lookup & JWT payload
  let customAttributes = {};
  try {
    customAttributes = JSON.parse(user.customAttributes || '{}');
  } catch {}
  const jwtPayload = parseJwtPayload(token) || {};

  const hasAdminClaim = Boolean(
    customAttributes.admin === true ||
    customAttributes.role === 'admin' ||
    jwtPayload.admin === true ||
    jwtPayload.role === 'admin'
  );

  const designatedAdmin = isDesignatedAdminEmail(user.email, ctx.env.ADMIN_EMAIL);
  const isAdmin = hasAdminClaim || (designatedAdmin && customAttributes.admin !== false);

  // Strict enforcement: adminOnly actions are rejected at the server level
  if (adminOnly && !isAdmin) {
    fail(403, 'غير مصرح: هذا الإجراء يتطلب حساب مسؤول معتمد بصلاحية (Admin Claim).');
  }

  // Fetch user profile from Firestore
  const doc = await fetch(`https://firestore.googleapis.com/v1/projects/${ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(user.localId)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const profile = await readJson(doc);

  // The designated owner account is a protected system account. Its access must
  // not depend on a mutable profile status or Firebase's disabled flag.
  const statusOverride = designatedAdmin ? null : await readAdminUserStatusOverride(ctx.env, user.localId);
  const status = designatedAdmin ? 'active' : (statusOverride?.status || profile.fields?.status?.stringValue || 'active');
  const banReason = statusOverride?.reason || profile.fields?.banReason?.stringValue || '';
  if (!designatedAdmin && (user.disabled || status === 'banned' || status === 'suspended')) {
    fail(403, banReason
      ? `تم إيقاف حسابك من قبل إدارة Mickey Studio: ${banReason}`
      : 'تم إيقاف حسابك من قبل إدارة Mickey Studio. يرجى التواصل مع الدعم الفني.');
  }

  const storedPlan = profile.fields?.plan?.stringValue || 'free';
  let subscription = null;
  if (profile.fields?.subscriptionJson?.stringValue) {
    try { subscription = JSON.parse(profile.fields.subscriptionJson.stringValue); } catch {}
  }
  const subEval = evaluateSubscription(subscription, storedPlan);
  const plan = subEval.plan;
  const extraCredits = Number(profile.fields?.extraCredits?.integerValue || profile.fields?.extraCredits?.doubleValue || 0);
  let limitOverrides = {};
  if (profile.fields?.limitOverridesJson?.stringValue) {
    try { limitOverrides = JSON.parse(profile.fields.limitOverridesJson.stringValue); } catch {}
  }

  return {
    uid: user.localId,
    email: user.email || '',
    isAdmin,
    hasAdminClaim,
    status,
    plan,
    storedPlan,
    subscription: subEval,
    extraCredits,
    limitOverrides,
    token,
    geminiApiKey: profile.fields?.geminiApiKey?.stringValue || '',
    geminiProviderKeysJson: profile.fields?.geminiProviderKeysJson?.stringValue || ''
  };
}

function deviceCollectionUrl(env, uid) {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(uid)}/devices`;
}

function decodeDeviceDocument(document) {
  const fields = document.fields || {};
  return {
    id: document.name?.split('/').pop() || '',
    deviceId: fields.deviceId?.stringValue || document.name?.split('/').pop() || '',
    name: fields.deviceName?.stringValue || 'جهاز Premiere Pro',
    platform: fields.platform?.stringValue || '',
    appVersion: fields.appVersion?.stringValue || '',
    firstSeenAt: fields.firstSeenAt?.timestampValue || '',
    lastSeenAt: fields.lastSeenAt?.timestampValue || '',
    revoked: fields.revoked?.booleanValue === true
  };
}

async function fetchUserDevices(env, uid, token) {
  const response = await fetch(`${deviceCollectionUrl(env, uid)}?pageSize=100`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await readJson(response);
  if (!response.ok && response.status !== 404) fail(503, 'تعذر تحميل قائمة الأجهزة من الخادم.');
  return (data.documents || []).map(decodeDeviceDocument);
}

function deviceFirestoreFields(device) {
  return { fields: {
    deviceId: { stringValue: device.deviceId },
    deviceName: { stringValue: device.name },
    platform: { stringValue: device.platform },
    appVersion: { stringValue: device.appVersion },
    firstSeenAt: { timestampValue: device.firstSeenAt },
    lastSeenAt: { timestampValue: device.lastSeenAt },
    revoked: { booleanValue: Boolean(device.revoked) }
  } };
}

async function saveUserDevice(env, uid, token, device) {
  const url = `${deviceCollectionUrl(env, uid)}/${encodeURIComponent(device.deviceId)}`;
  const response = await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(deviceFirestoreFields(device)) });
  if (!response.ok) fail(503, 'تعذر حفظ بيانات الجهاز على الخادم.');
}

async function enforceDeviceLimit(account, ctx, useAdminToken = false) {
  const rawId = String(ctx.request.headers.get('X-Device-Id') || '').trim();
  if (!rawId || rawId.length > 80) return;
  const deviceId = rawId;
  const token = useAdminToken ? await firebaseAdminAccessToken(ctx.env) : account.token;
  const devices = await fetchUserDevices(ctx.env, account.uid, token);
  const deviceName = String(ctx.request.headers.get('X-Device-Name') || '').trim().slice(0, 160);
  const devicePlatform = String(ctx.request.headers.get('X-Platform') || '').trim().slice(0, 80);
  const normalize = value => String(value || '').trim().toLocaleLowerCase();
  // UXP secure storage can be reset after a plugin/runtime update. Reuse the
  // account's active record for the same host and OS instead of counting that
  // recreated UUID as an additional physical device.
  const existing = devices.find(item => item.deviceId === deviceId) || devices.find(item =>
    !item.revoked && normalize(item.name) === normalize(deviceName) &&
    normalize(item.platform) === normalize(devicePlatform) && deviceName && devicePlatform
  );
  const now = nowIso();
  const reactivationKey = `device_pair_grant:${account.uid}:${deviceId}`;
  const canReactivate = existing?.revoked && await ctx.env.MICKEY_STATE.get(reactivationKey);
  if (existing?.revoked && !canReactivate) {
    failWithCode(403, 'تم إلغاء ربط هذا الجهاز. احذف الجهاز من الإضافة ثم أعد ربط الحساب.', 'DEVICE_REVOKED');
  }
  if (existing && !existing.revoked) {
    existing.lastSeenAt = now;
    existing.name = deviceName || existing.name;
    existing.platform = devicePlatform || existing.platform;
    existing.appVersion = String(ctx.request.headers.get('X-Plugin-Version') || existing.appVersion).slice(0, 40);
    await saveUserDevice(ctx.env, account.uid, token, existing);
    return;
  }
  const active = devices.filter(item => !item.revoked);
  let plan = account.plan || 'free';
  if (useAdminToken) {
    const profileUrl = `https://firestore.googleapis.com/v1/projects/${ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(account.uid)}`;
    const profile = await fetch(profileUrl, { headers: { Authorization: `Bearer ${token}` } });
    const profileData = await readJson(profile);
    plan = profileData.fields?.plan?.stringValue || 'free';
  }
  const plans = await getPlansConfig(ctx.env);
  const features = plans[plan]?.features || plans.free?.features || {};
  const maxDevices = Math.max(1, Math.min(100, Number(features.max_devices) || 2));
  if (active.length >= maxDevices) {
    failWithCode(403, 'وصلت إلى الحد الأقصى للأجهزة المرتبطة. ألغِ ربط جهاز من قسم «أجهزتي» للمتابعة.', 'DEVICE_LIMIT_REACHED', active.map(({ name, lastSeenAt, platform }) => ({ name, lastSeenAt, platform })));
  }
  if (canReactivate) await ctx.env.MICKEY_STATE.delete(reactivationKey);
  await saveUserDevice(ctx.env, account.uid, token, {
    deviceId,
    name: deviceName || 'جهاز Premiere Pro',
    platform: devicePlatform || 'unknown',
    appVersion: String(ctx.request.headers.get('X-Plugin-Version') || '').slice(0, 40),
    firstSeenAt: existing?.firstSeenAt || now,
    lastSeenAt: now,
    revoked: false
  });
}

async function listUserDevices(ctx) {
  const account = await authenticate(ctx);
  const devices = await fetchUserDevices(ctx.env, account.uid, account.token);
  return json({ success: true, devices: devices.filter(device => !device.revoked) }, 200, ctx.headers);
}

async function revokeUserDevice(ctx) {
  const account = await authenticate(ctx);
  const deviceId = String(ctx.body.deviceId || '').trim();
  const devices = await fetchUserDevices(ctx.env, account.uid, account.token);
  const target = devices.find(item => item.deviceId === deviceId && !item.revoked);
  if (!target) fail(404, 'لم يتم العثور على الجهاز أو أنه ملغي بالفعل.');
  const month = new Date().toISOString().slice(0, 7);
  const counterKey = `device_revocations:${account.uid}:${month}`;
  const count = Number(await ctx.env.MICKEY_STATE.get(counterKey)) || 0;
  if (count >= 3) fail(403, 'وصلت إلى الحد الشهري لإلغاء الأجهزة (3 مرات).');
  target.revoked = true;
  target.lastSeenAt = nowIso();
  await saveUserDevice(ctx.env, account.uid, account.token, target);
  await ctx.env.MICKEY_STATE.put(counterKey, String(count + 1), { expirationTtl: 86400 * 40 });
  return json({ success: true, message: 'تم إلغاء ربط الجهاز.' }, 200, ctx.headers);
}

async function adminGetUserDevices(ctx) {
  const account = await authenticate(ctx, true);
  const targetRaw = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  if (!targetRaw) failWithCode(400, 'معرف المستخدم غير محدد.', 'TARGET_MISSING');
  const targetUser = await protectAdminAccountTarget(ctx, account, targetRaw);
  const adminToken = await firebaseAdminAccessToken(ctx.env);
  const devices = await fetchUserDevices(ctx.env, targetUser.uid, adminToken);
  return json({ success: true, target_uid: targetUser.uid, devices }, 200, ctx.headers);
}

async function adminRevokeUserDevice(ctx) {
  const account = await authenticate(ctx, true);
  const targetRaw = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  const deviceId = String(ctx.body.deviceId || '').trim();
  if (!targetRaw || !deviceId) failWithCode(400, 'معرف المستخدم والجهاز مطلوبان.', 'PARAMS_MISSING');
  const targetUser = await protectAdminAccountTarget(ctx, account, targetRaw);
  const targetUid = targetUser.uid;
  const adminToken = await firebaseAdminAccessToken(ctx.env);
  const devices = await fetchUserDevices(ctx.env, targetUid, adminToken);
  const target = devices.find(item => item.deviceId === deviceId && !item.revoked);
  if (!target) failWithCode(404, 'لم يتم العثور على الجهاز النشط.', 'DEVICE_NOT_FOUND');
  target.revoked = true;
  target.lastSeenAt = nowIso();
  await saveUserDevice(ctx.env, targetUid, adminToken, target);
  await logAdminAudit(ctx, 'admin_revoke_user_device', targetUid, { deviceId, targetEmail: targetUser.email });
  return json({ success: true, message: 'تم إلغاء ربط الجهاز بنجاح.', target_uid: targetUid }, 200, ctx.headers);
}

// ======================================================================
// Admin Audit Logging
// ======================================================================
async function logAdminAudit(ctx, actionName, target, details = {}) {
  try {
    const adminEmail = ctx.account?.email || 'admin@mickey-studio';
    const ip = ctx.request.headers.get('CF-Connecting-IP') || 'unknown';
    const entry = {
      id: `log_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: nowIso(),
      admin_email: adminEmail,
      action: actionName,
      target: String(target || 'system'),
      details,
      ip
    };

    let logs = await ctx.env.MICKEY_STATE.get('admin_audit_logs', 'json') || [];
    logs.unshift(entry);
    if (logs.length > 500) logs = logs.slice(0, 500); // keep recent 500 logs
    await ctx.env.MICKEY_STATE.put('admin_audit_logs', JSON.stringify(logs));
  } catch (err) {
    console.error('[Admin Audit Log Error]:', err);
  }
}

// ======================================================================
// System Config & Plan Limits Management
// ======================================================================
async function getSystemConfig(env) {
  const config = await env.MICKEY_STATE.get('system_config', 'json');
  return config || { subscription_mode: false, paywall_enabled: false, updated_at: null, upgrade_url: 'https://mickey-studio-eta.vercel.app/pricing' };
}

async function getPlansConfig(env) {
  const saved = await env.MICKEY_STATE.get('system_plans', 'json') || {};
  const ids = new Set([...Object.keys(DEFAULT_PLANS), ...Object.keys(saved)]);
  return Object.fromEntries([...ids].map(id => {
    const defaults = DEFAULT_PLANS[id] || {};
    const stored = saved[id] || {};
    return [id, {
      ...defaults, ...stored, id,
      features: { ...(defaults.features || {}), ...(stored.features || {}) },
      limits: { ...(defaults.limits || {}), ...(stored.limits || {}) }
    }];
  }));
}

function toolKeyForAction(action, body = {}) {
  const actions = {
    generate_image: 'image_generate',
    generate_text: 'text_refine',
    enhance_prompt: 'prompt_enhance',
    refine_voiceover: 'text_refine',
    generate_tts: 'voiceover',
    transcribe_audio: 'transcription',
    analyze_video_silence: 'transcription',
    generate_chapters: 'chapters',
    detect_viral_clips: 'broll',
    detect_censor_words: 'captions_create',
    photolab_bg: 'photolab_bg',
    remove_background: 'photolab_bg',
    photolab_upscale: 'photolab_upscale',
    upscale_image: 'photolab_upscale',
    generate_video: 'video_generate',
    video_generate: 'video_generate',
    motion_scene_submit: 'video_generate'
  };
  if (actions[action]) return actions[action];
  if (action !== 'consume_generation') return '';
  const aliases = {
    image: 'image_generate', images: 'image_generate', image_generate: 'image_generate',
    voice: 'voiceover', tts: 'voiceover', voiceover: 'voiceover',
    transcription: 'transcription', transcribe: 'transcription',
    prompt: 'prompt_enhance', prompt_enhance: 'prompt_enhance',
    text_refine: 'text_refine', refine_voiceover: 'text_refine',
    captions: 'captions_create', captions_create: 'captions_create',
    photolab_bg: 'photolab_bg', background_removal: 'photolab_bg',
    photolab_upscale: 'photolab_upscale', upscale: 'photolab_upscale',
    broll: 'broll', motion: 'broll', chapters: 'chapters',
    video: 'video_generate', video_generate: 'video_generate'
  };
  const requested = String(body.tool || '').trim();
  return aliases[requested] || (TOOL_CATALOG.some(item => item.key === requested) ? requested : '');
}

function isFreePlanDefinition(plan) {
  if (plan?.is_free === true || plan?.features?.billing_tier === 'free') return true;
  if (plan?.is_free === false || plan?.features?.billing_tier === 'paid') return false;
  return plan?.unlimited_usage !== true && !(Number(plan?.price) > 0);
}

async function toolAccessDb(env, action, payload = {}) {
  const id = env.MICKEY_COORDINATOR.idFromName('global_tool_access');
  const stub = env.MICKEY_COORDINATOR.get(id);
  const response = await stub.fetch(`https://tool-access/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const result = await readJson(response);
  if (!response.ok || result.success === false) fail(503, result.error || 'تعذر الاتصال بمخزن صلاحيات الأدوات.');
  return result;
}

async function toolBootstrapPayload(env) {
  const plans = await getPlansConfig(env);
  const planRows = [];
  for (const [planId, plan] of Object.entries(plans)) {
    const isFree = isFreePlanDefinition(plan);
    for (const tool of TOOL_CATALOG) {
      planRows.push({
        plan_id: planId,
        tool_key: tool.key,
        access: tool.category === 'local' ? 'full' : (isFree ? 'locked' : 'full'),
        monthly_limit: null,
        limit_unit: 'month'
      });
    }
  }
  return { tools: TOOL_CATALOG, planRows };
}

async function requireToolAccess(ctx, toolKey, { charge = true } = {}) {
  const system = await getSystemConfig(ctx.env);
  const subscriptionEnforced = Boolean(system.subscription_mode || system.paywall_enabled);

  // When Subscription Mode is OFF: all tools are open without restriction to everyone
  if (!subscriptionEnforced) {
    return { access: 'full', toolName: toolKey, subscription_mode: false, paywallEnabled: false, planId: 'free' };
  }

  const seed = await toolBootstrapPayload(ctx.env);
  let account = null;
  const presentedKey = apiToken(ctx);
  if (presentedKey.startsWith('mk_')) {
    const keys = await ctx.env.MICKEY_STATE.get('api_keys', 'json') || [];
    const entry = keys.find(item => item.key === presentedKey && item.status !== 'revoked');
    if (!entry?.uid) fail(403, 'مفتاح API غير صالح أو تم إلغاؤه.');
    const adminToken = await firebaseAdminAccessToken(ctx.env);
    const profileResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(entry.uid)}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const profile = profileResponse.status === 404 ? {} : await readJson(profileResponse);
    if (!profileResponse.ok && profileResponse.status !== 404) fail(503, 'تعذر تحميل خطة حساب مفتاح API.');
    let sub = null;
    if (profile.fields?.subscriptionJson?.stringValue) {
      try { sub = JSON.parse(profile.fields.subscriptionJson.stringValue); } catch {}
    }
    const evalSub = evaluateSubscription(sub, profile.fields?.plan?.stringValue || 'free');
    account = { uid: entry.uid, plan: evalSub.plan, storedPlan: profile.fields?.plan?.stringValue || 'free', subscription: evalSub };
  } else {
    const token = bearer(ctx.request) || String(ctx.body.idToken || '');
    if (token) account = await authenticate(ctx, false);
  }

  const plans = await getPlansConfig(ctx.env);
  const freePlan = Object.entries(plans).find(([, plan]) => isFreePlanDefinition(plan))?.[0] || Object.keys(plans)[0] || 'free';
  const uid = account?.uid || `guest:${await sha256(ctx.request.headers.get('X-Anonymous-ID') || ctx.request.headers.get('CF-Connecting-IP') || 'guest')}`;

  const planId = account?.subscription?.plan && plans[account.subscription.plan]
    ? account.subscription.plan
    : (account?.plan && plans[account.plan] ? account.plan : freePlan);

  const now = new Date();
  const period = now.toISOString().slice(0, 7);
  const dayPeriod = now.toISOString().slice(0, 10);
  const monthResetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const dayResetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
  const result = await toolAccessDb(ctx.env, 'tool_check', {
    ...seed, uid, planId, toolKey, paywallEnabled: subscriptionEnforced,
    period, dayPeriod, monthResetsAt, dayResetsAt, charge, actor: account?.email || 'system'
  });

  if (result.access === 'locked') {
    const tool = TOOL_CATALOG.find(item => item.key === toolKey);
    const upgradeUrl = String(system.upgrade_url || ctx.env.UPGRADE_URL || 'https://mickey-studio-eta.vercel.app/pricing');
    const messageAr = `أداة «${tool?.name_ar || toolKey}» غير متاحة ضمن خطتك الحالية. اختر خطة تتيح استخدامها.`;
    failWithDetails(403, messageAr, 'TOOL_LOCKED', {
      tool: { key: toolKey, name_ar: tool?.name_ar || toolKey }, plan: result.planId || planId,
      upgrade_url: upgradeUrl, message_ar: messageAr
    });
  }
  if (result.access === 'limited' && result.limit != null && result.used >= result.limit && charge) {
    failWithDetails(429, `وصلت إلى حد الاستخدام لأداة «${result.toolName || toolKey}».`, 'QUOTA_EXCEEDED', {
      used: result.used, limit: result.limit, resets_at: result.resets_at || monthResetsAt
    });
  }
  return { ...result, planId, paywallEnabled: subscriptionEnforced, subscription_mode: subscriptionEnforced };
}

async function getCurrentUserAccess(ctx) {
  let account;
  const key = apiToken(ctx);
  if (key.startsWith('mk_')) {
    const keys = await ctx.env.MICKEY_STATE.get('api_keys', 'json') || [];
    const entry = keys.find(item => item.key === key && item.status !== 'revoked');
    if (!entry?.uid) fail(403, 'مفتاح API غير صالح أو تم إلغاؤه.');
    const token = await firebaseAdminAccessToken(ctx.env);
    const profileRes = await fetch(`https://firestore.googleapis.com/v1/projects/${ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(entry.uid)}`, { headers: { Authorization: `Bearer ${token}` } });
    const profile = profileRes.status === 404 ? {} : await readJson(profileRes);
    if (!profileRes.ok && profileRes.status !== 404) fail(503, 'تعذر تحميل خطة حساب مفتاح API.');
    let sub = null;
    if (profile.fields?.subscriptionJson?.stringValue) {
      try { sub = JSON.parse(profile.fields.subscriptionJson.stringValue); } catch {}
    }
    const evalSub = evaluateSubscription(sub, profile.fields?.plan?.stringValue || 'free');
    account = { uid: entry.uid, plan: evalSub.plan, storedPlan: profile.fields?.plan?.stringValue || 'free', subscription: evalSub, email: '' };
  } else {
    account = await authenticate(ctx, false);
  }

  const system = await getSystemConfig(ctx.env);
  const subscriptionEnforced = Boolean(system.subscription_mode || system.paywall_enabled);
  const plans = await getPlansConfig(ctx.env);
  const freePlan = Object.entries(plans).find(([, plan]) => isFreePlanDefinition(plan))?.[0] || Object.keys(plans)[0] || 'free';

  const subEval = account.subscription || evaluateSubscription(null, account.plan || freePlan);
  const effectivePlanId = subEval.plan && plans[subEval.plan] ? subEval.plan : (account.plan && plans[account.plan] ? account.plan : freePlan);

  const seed = await toolBootstrapPayload(ctx.env);
  const now = new Date();
  const period = now.toISOString().slice(0, 7);
  const dayPeriod = now.toISOString().slice(0, 10);
  const monthResetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const dayResetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
  const result = await toolAccessDb(ctx.env, 'tool_permissions', {
    ...seed, uid: account.uid, planId: effectivePlanId, paywallEnabled: subscriptionEnforced, period, dayPeriod, monthResetsAt, dayResetsAt
  });
  const finalPlanId = result.planId || effectivePlanId;
  const maxDevices = plans[finalPlanId]?.features?.max_devices == null ? null : Number(plans[finalPlanId].features.max_devices);
  const publicTools = Object.fromEntries(Object.entries(result.tools || {}).map(([key, item]) => {
    if (item.access === 'limited') return [key, { access: item.access, limit: item.limit, used: item.used, resets_at: item.resets_at }];
    return [key, { access: item.access }];
  }));
  return json({
    success: true,
    plan: finalPlanId,
    effectivePlan: finalPlanId,
    paywall_enabled: subscriptionEnforced,
    subscription_mode: subscriptionEnforced,
    subscription: {
      plan: subEval.plan,
      status: subEval.status,
      started_at: subEval.started_at,
      expires_at: subEval.expires_at,
      days_left: subEval.days_left,
      is_active: subEval.is_active
    },
    expires_at: subEval.expires_at,
    days_left: subEval.days_left,
    tools: publicTools,
    upgrade_url: String(system.upgrade_url || ctx.env.UPGRADE_URL || 'https://mickey-studio-eta.vercel.app/pricing'),
    max_devices: maxDevices
  }, 200, ctx.headers);
}

function toolCategoryForAction(action, body = {}) {
  const mapping = {
    generate_image: 'images',
    enhance_prompt: 'images',
    photolab_bg: 'images',
    remove_background: 'images',
    photolab_upscale: 'images',
    upscale_image: 'images',
    generate_tts: 'voice',
    refine_voiceover: 'voice',
    transcribe_audio: 'transcription',
    analyze_video_silence: 'transcription',
    generate_chapters: 'transcription',
    detect_censor_words: 'transcription',
    detect_viral_clips: 'motion_ai',
    motion_scene_submit: 'motion_ai',
    generate_video: 'video',
    video_generate: 'video'
  };
  if (action === 'consume_generation') {
    const requested = String(body.tool || '').toLowerCase();
    if (['image', 'images', 'image_generate', 'photolab_bg', 'photolab_upscale'].includes(requested)) return 'images';
    if (['voice', 'voiceover', 'tts'].includes(requested)) return 'voice';
    if (['transcription', 'transcribe', 'captions', 'chapters'].includes(requested)) return 'transcription';
    if (['motion', 'motion_ai', 'broll'].includes(requested)) return 'motion_ai';
    if (['video', 'video_generate'].includes(requested)) return 'video';
  }
  return mapping[action] || 'general';
}

function toolNameArabic(tool) {
  const names = {
    images: 'توليد الصور بالذكاء الاصطناعي',
    voice: 'التعليق الصوتي الفائق (TTS)',
    transcription: 'التفريغ الصوتي والكابشن',
    motion_ai: 'قوالب الموشن والمشاهد الذكية',
    video: 'أدوات الفيديو المتقدمة',
    general: 'التوليد'
  };
  return names[tool] || tool;
}

function planNameArabic(plan) {
  const names = {
    free: 'المجانية',
    pro: 'الاحترافية (Pro)',
    custom: 'المخصصة (Custom Studio)'
  };
  return names[plan] || plan;
}

async function recordToolUsageMetric(env, tool, dayKey) {
  try {
    const key = `stats:usage:${dayKey}:${tool}`;
    const count = Number(await env.MICKEY_STATE.get(key)) || 0;
    await env.MICKEY_STATE.put(key, String(count + 1), { expirationTtl: 86400 * 90 });
    const totalKey = `stats:usage:${dayKey}:total`;
    const total = Number(await env.MICKEY_STATE.get(totalKey)) || 0;
    await env.MICKEY_STATE.put(totalKey, String(total + 1), { expirationTtl: 86400 * 90 });
  } catch (_) {}
}

async function recordExternalToolUsage(ctx) {
  const account = await authenticate(ctx, false);
  const tool = String(ctx.body.tool || '').trim();
  const eventId = String(ctx.body.event_id || '').trim();
  if (tool !== 'video' || !/^[0-9a-f-]{36}$/i.test(eventId)) {
    return json({ success: false, error: 'بيانات تسجيل الاستخدام غير صالحة.' }, 400, ctx.headers);
  }

  const eventKey = `stats:event:${account.uid}:${eventId}`;
  if (await ctx.env.MICKEY_STATE.get(eventKey)) {
    return json({ success: true, duplicate: true }, 200, ctx.headers);
  }
  await ctx.env.MICKEY_STATE.put(eventKey, '1', { expirationTtl: 86400 * 30 });
  await recordToolUsageMetric(ctx.env, 'video', new Date().toISOString().slice(0, 10));
  return json({ success: true }, 200, ctx.headers);
}

async function enforcePlanLimits(account, action, ctx) {
  const tool = toolCategoryForAction(action, ctx.body);
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // Usage analytics include the owner account too; exemption applies only to
  // billing and quotas, not to the admin dashboard's usage statistics.
  await recordToolUsageMetric(ctx.env, tool, dayKey);

  // The owner account is exempt from subscription checks, quotas, credits and
  // user-generation counters. This check runs after Firebase token verification.
  if (isDesignatedAdminEmail(account.email, ctx.env.ADMIN_EMAIL)) {
    return { enforced: false, subscription_mode: false, tool, remaining: null, unlimited: true };
  }

  const sysConfig = await getSystemConfig(ctx.env);
  const subscriptionMode = Boolean(sysConfig.subscription_mode);

  // If subscription mode is OFF: all users operate in unblocked mode (previous behavior)
  if (!subscriptionMode) {
    return { enforced: false, subscription_mode: false, tool, remaining: 999 };
  }

  // If subscription mode is ON: enforce plan limits + user overrides
  const plans = await getPlansConfig(ctx.env);
  const userPlan = plans[account.plan] || plans.free || DEFAULT_PLANS.free;
  if (userPlan.unlimited_usage === true) {
    return { enforced: false, subscription_mode: true, tool, remaining: null, unlimited: true };
  }
  const toolLimits = userPlan.limits?.[tool] || { daily: 15, monthly: 300 };

  const effectiveDailyLimit = account.limitOverrides?.[tool]?.daily ?? account.limitOverrides?.[tool] ?? toolLimits.daily;

  // Read atomic daily counter
  const dailyUsageKey = `quota:d:${account.uid}:${tool}:${dayKey}`;
  const currentDailyUsage = Number(await ctx.env.MICKEY_STATE.get(dailyUsageKey)) || 0;

  // Calculate time remaining until midnight UTC
  const nextMidnightUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const diffMs = nextMidnightUtc.getTime() - now.getTime();
  const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
  const minsLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const resetStr = `بعد ${hoursLeft} ساعة و ${minsLeft} دقيقة (الساعة 12:00 منتصف الليل UTC)`;

  if (currentDailyUsage >= effectiveDailyLimit) {
    // If user has extra credits, consume one
    if (account.extraCredits > 0) {
      await deductUserCredit(account, ctx.env);
      return {
        enforced: true,
        tool,
        limit: effectiveDailyLimit,
        used: currentDailyUsage + 1,
        remaining: account.extraCredits - 1,
        consumedCredit: true,
        resetTime: nextMidnightUtc.toISOString()
      };
    }

    // Limit exceeded: Return plain Arabic rejection
    fail(429, `تم الوصول إلى الحد اليومي المسموح به لأداة (${toolNameArabic(tool)}) في خطتك (${planNameArabic(account.plan)}). الحد اليومي هو ${effectiveDailyLimit} عملية. سيتم تجديد رصيدك ${resetStr}. يمكنك الترقية أو التواصل مع الإدارة.`);
  }

  // Increment atomic counter
  const newUsage = currentDailyUsage + 1;
  await ctx.env.MICKEY_STATE.put(dailyUsageKey, String(newUsage), { expirationTtl: 86400 * 2 });

  return {
    enforced: true,
    tool,
    limit: effectiveDailyLimit,
    used: newUsage,
    remaining: Math.max(0, effectiveDailyLimit - newUsage),
    resetTime: nextMidnightUtc.toISOString()
  };
}

async function deductUserCredit(account, env) {
  try {
    const nextCredits = Math.max(0, (account.extraCredits || 0) - 1);
    await updateUserProfileField(account, env, 'extraCredits', { integerValue: String(nextCredits) });
  } catch (_) {}
}

async function enforceGenerationAccess(ctx) {
  const action = ctx.action;
  const apiKey = apiToken(ctx);

  if (apiKey.startsWith('mk_')) {
    const keys = await ctx.env.MICKEY_STATE.get('api_keys', 'json') || [];
    if (keys.some(item => item.key === apiKey && item.status !== 'revoked')) {
      const metricTool = toolCategoryForAction(action, ctx.body);
      if (metricTool !== 'general') await recordToolUsageMetric(ctx.env, metricTool, new Date().toISOString().slice(0, 10));
      return { account: { plan: 'api_developer', uid: 'developer' }, remaining: null };
    }
    fail(403, 'مفتاح API غير صالح أو تم إلغاؤه.');
  }

  const token = bearer(ctx.request) || String(ctx.body.idToken || '');
  if (token) {
    const account = await authenticate(ctx, false);
    const quotaInfo = await enforcePlanLimits(account, action, ctx);
    return { account, remaining: quotaInfo?.remaining ?? null, quota: quotaInfo };
  }

  // Guest enforcement
  const anonymousId = ctx.request.headers.get('X-Anonymous-ID') || '';
  if (!/^[a-f0-9]{32,96}$/i.test(anonymousId)) {
    fail(400, 'تعذر بدء جلسة الضيف. أعد تحميل الموقع وحاول مرة أخرى.');
  }
  const ip = ctx.request.headers.get('CF-Connecting-IP') || '';
  const digest = await sha256(`${anonymousId}|${ip}`);
  const key = `guest:${digest}`;
  const state = await ctx.env.MICKEY_STATE.get(key, 'json') || { count: 0, permits: {} };
  const used = Number(state.count) || 0;
  const count = Math.min(20, Math.max(1, Number(ctx.body.count) || 1));
  const tool = ({ generate_image: 'image', generate_tts: 'voiceover', transcribe_audio: 'transcription', analyze_video_silence: 'transcription', enhance_prompt: 'prompt', refine_voiceover: 'voiceover' })[action] || ctx.body.tool || action;
  const permitHeader = ctx.request.headers.get('X-Generation-Permit') || '';
  const permitHash = permitHeader ? await sha256(permitHeader) : '';

  if (action !== 'consume_generation' && permitHash && state.permits?.[permitHash]?.tool === tool && state.permits[permitHash].expires > Date.now()) {
    delete state.permits[permitHash];
    await ctx.env.MICKEY_STATE.put(key, JSON.stringify(state), { expirationTtl: 86400 });
    return { account: null, remaining: Math.max(0, 5 - used) };
  }
  if (used + count > 5) {
    fail(429, 'استخدمت محاولات الضيف الخمس المجانية. يرجى تسجيل الدخول أو إنشاء حساب مجاني للمتابعة.');
  }
  state.count = used + count;
  if (action === 'consume_generation') {
    const metricTool = toolCategoryForAction(action, ctx.body);
    if (metricTool !== 'general') {
      for (let i = 0; i < count; i++) await recordToolUsageMetric(ctx.env, metricTool, new Date().toISOString().slice(0, 10));
    }
  }
  let permit;
  if (action === 'consume_generation') {
    permit = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    state.permits ||= {};
    state.permits[await sha256(permit)] = { tool, expires: Date.now() + 90000 };
  }
  await ctx.env.MICKEY_STATE.put(key, JSON.stringify(state), { expirationTtl: 86400 });
  return { account: null, remaining: Math.max(0, 5 - state.count), permit };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// ======================================================================
// GEMINI MULTI-KEY FAILOVER ENGINE (Concurrency-safe & Write-only)
// ======================================================================
async function getGeminiPool(env) {
  let pool = await env.MICKEY_STATE.get('gemini_pool', 'json') || [];
  const now = Date.now();
  let updated = false;

  // Auto-reactivate keys whose cooldown has expired
  for (const item of pool) {
    if (item.status === 'exhausted' && item.cooldown_until && now >= item.cooldown_until) {
      item.status = 'active';
      item.cooldown_until = null;
      item.last_error = null;
      updated = true;
    }
  }
  if (updated) {
    await env.MICKEY_STATE.put('gemini_pool', JSON.stringify(pool));
  }
  return pool;
}

async function saveGeminiPool(env, pool) {
  await env.MICKEY_STATE.put('gemini_pool', JSON.stringify(pool));
}

async function getGeminiKeys(env) {
  const pool = await getGeminiPool(env);
  const active = pool.filter(x => x.status === 'active' && x.key).map(x => x.key);
  if (env.GEMINI_API_KEY && !active.includes(env.GEMINI_API_KEY)) {
    active.unshift(env.GEMINI_API_KEY);
  }
  return {
    success: true,
    has_key: active.length > 0,
    configured: {
      gemini: active.length > 0,
      groq: Boolean(env.GROQ_API_KEY),
      huggingface: Boolean(env.HUGGINGFACE_TOKEN)
    },
    // Write-only: raw key is NEVER sent to client
    gemini_pool: pool.map(({ key, ...item }) => ({
      ...item,
      masked_key: maskKey(key),
      cooldown_remaining_sec: item.cooldown_until ? Math.max(0, Math.ceil((item.cooldown_until - Date.now()) / 1000)) : 0
    })),
    available_models: [
      { id: 'gemini-3.8-flash-tts', name: 'Gemini Flash TTS', type: 'tts' },
      { id: 'gemini-3.8-flash-lite-tts', name: 'Gemini Flash-Lite TTS', type: 'tts' },
      { id: 'gemini-nano-banana-2.1', name: 'Google Nano Banana 2.1', type: 'image' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', type: 'text' }
    ]
  };
}

// Selects active keys with least-used distribution for load balancing
async function getCandidateKeysForRequest(ctx) {
  const pool = await getGeminiPool(ctx.env);
  const personalKey = String(ctx.access?.account?.geminiApiKey || '').trim();

  // Filter active keys and sort by least-used (request_count ascending)
  const activePool = pool
    .filter(item => item.status === 'active' && item.key)
    .sort((a, b) => (a.request_count || 0) - (b.request_count || 0));

  const list = [];
  if (personalKey) {
    list.push({ id: 'personal', key: personalKey, label: 'مفتاح المستخدم الشخصي', status: 'active', is_personal: true });
  }
  for (const item of activePool) {
    if (!list.some(x => x.key === item.key)) list.push(item);
  }
  if (ctx.env.GEMINI_API_KEY && !list.some(x => x.key === ctx.env.GEMINI_API_KEY)) {
    list.push({ id: 'env_default', key: ctx.env.GEMINI_API_KEY, label: 'مفتاح النظام الافتراضي', status: 'active' });
  }
  return list;
}

// Generic Gemini caller with automatic failover, cooldown marking, and admin alerts
async function callGeminiWithFailover(ctx, callFn) {
  const candidates = await getCandidateKeysForRequest(ctx);
  if (!candidates.length) {
    fail(503, 'جميع مفاتيح Gemini مستهلكة أو معطلة حالياً. أضف مفاتيح جديدة من لوحة الإدارة.');
  }

  const pool = await getGeminiPool(ctx.env);
  const errors = [];
  let attempted = 0;

  for (const candidate of candidates) {
    attempted++;
    try {
      const result = await callFn(candidate.key);

      // Success! Update key request count
      const poolItem = pool.find(x => x.id === candidate.id || x.key === candidate.key);
      if (poolItem) {
        poolItem.request_count = (poolItem.request_count || 0) + 1;
        poolItem.last_used = nowIso();
        await saveGeminiPool(ctx.env, pool);
      }
      return result;
    } catch (err) {
      const status = err?.status || 500;
      const msg = String(err?.message || err || '');
      const isQuotaError = status === 429 || status === 403 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg);

      // If it's a client error not related to quota (e.g. 400 bad argument), DO NOT retry
      if (status >= 400 && status < 500 && !isQuotaError) {
        throw err;
      }

      if (isQuotaError) {
        // Cooldown: 60s for RPM rate-limit, 6 hours for daily quota
        const isDaily = /daily|RESOURCE_EXHAUSTED/i.test(msg);
        const cooldownMs = isDaily ? 6 * 3600 * 1000 : 60 * 1000;
        const cooldownUntil = Date.now() + cooldownMs;

        const poolItem = pool.find(x => x.id === candidate.id || x.key === candidate.key);
        if (poolItem) {
          poolItem.status = 'exhausted';
          poolItem.cooldown_until = cooldownUntil;
          poolItem.last_error = msg.slice(0, 160);
          poolItem.error_count = (poolItem.error_count || 0) + 1;
          await saveGeminiPool(ctx.env, pool);
        }
        errors.push(`المفتاح (${maskKey(candidate.key)}): استهلك الحصة [${status}]`);
        // Continue loop to NEXT key immediately!
        continue;
      }

      // If other 5xx error, record and try next key
      errors.push(`خطأ ${status}: ${msg.slice(0, 100)}`);
    }
  }

  // All candidate keys failed!
  try {
    await ctx.env.MICKEY_STATE.put('system_alert_keys_exhausted', JSON.stringify({
      alert: 'all_keys_exhausted',
      timestamp: nowIso(),
      attempts: attempted,
      errors
    }), { expirationTtl: 3600 });
  } catch (_) {}

  fail(503, 'نعتذر، كافة مفاتيح الذكاء الاصطناعي مستهلكة حالياً أو في فترة استراحة مؤقتة. يرجى المحاولة بعد قليل أو مراجعة إدارة المنصة.');
}

// ======================================================================
// GEMINI TOOL IMPLEMENTATIONS (Using Auto-Failover Engine)
// ======================================================================
async function generateTts(ctx) {
  const data = ctx.body;
  const text = String(data.text || ctx.url.searchParams.get('text') || '').trim();
  if (!text) return json({ success: false, error: 'النص فارغ' }, 400, ctx.headers);
  if (text.length > 8000) return json({ success: false, error: 'النص طويل جدًا. قسّمه إلى مقاطع أقصر.' }, 413, ctx.headers);

  const gender = String(data.gender || '').toLowerCase();
  const performance = String(data.performance || '').toLowerCase();
  const femaleNames = ['mariam', 'laila', 'sama', 'salma', 'farida'];
  const female = gender === 'female' || femaleNames.includes(performance);
  const voices = {
    yusuf: ['Charon', 'Kore'], malik: ['Puck', 'Aoede'], rami: ['Fenrir', 'Aoede'],
    saif: ['Fenrir', 'Kore'], zaid: ['Puck', 'Aoede'], neutral: ['Puck', 'Kore'],
    mariam: ['Puck', 'Kore'], laila: ['Puck', 'Aoede'], sama: ['Fenrir', 'Aoede'],
    salma: ['Fenrir', 'Kore'], farida: ['Charon', 'Kore']
  };
  const voice = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'].includes(data.voice) ? data.voice : (voices[performance]?.[female ? 1 : 0] || (female ? 'Kore' : 'Puck'));
  const dialects = {
    egyptian: 'Egyptian Arabic', saudi: 'Saudi Arabic', levantine: 'Levantine Arabic',
    iraqi: 'Iraqi Arabic', algerian: 'Algerian Arabic', moroccan: 'Moroccan Arabic',
    tunisian: 'Tunisian Arabic', gulf: 'Gulf Arabic', fusha: 'Modern Standard Arabic'
  };
  const dialect = dialects[String(data.dialect || '').toLowerCase()] || 'Egyptian Arabic';
  const style = String(data.style || `Speak in ${dialect}, with a ${female ? 'feminine' : 'masculine'} voice. Read the supplied Arabic text verbatim; do not translate it or say these directions aloud.`);
  const engine = data.engine === 'neural' ? 'neural' : 'gemini';

  if (engine === 'gemini') {
    return await callGeminiWithFailover(ctx, async (apiKey) => {
      const result = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          model: GEMINI_TTS_MODEL,
          input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style }] }] }],
          response_format: { type: 'audio' },
          generation_config: { speech_config: [{ voice }] }
        })
      });
      const response = await readJson(result);
      if (!result.ok) {
        const error = new Error(response.error?.message || `Gemini TTS failed HTTP ${result.status}`);
        error.status = result.status;
        throw error;
      }
      const audio = response.output_audio?.data || (response.steps || [])
        .flatMap(step => step.content || [])
        .reverse()
        .find(item => item.type === 'audio' && item.data)?.data;
      if (!audio) throw new Error('لم يُرجع نموذج الصوت بيانات صالحة.');
      return audioResponse(audio, response.output_audio?.mime_type || 'audio/wav', ctx.headers, 'Gemini 3.8 Flash TTS');
    });
  }

  // Free Fallback: Google Translate TTS
  const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=${encodeURIComponent(text.slice(0, 200))}`;
  const fallback = await fetch(fallbackUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null);
  if (fallback?.ok) {
    const bytes = await fallback.arrayBuffer();
    if (bytes.byteLength > 100) return new Response(bytes, { status: 200, headers: { ...ctx.headers, 'Content-Type': 'audio/mpeg', 'X-TTS-Engine': 'Google Translate TTS' } });
  }
  return json({ success: false, error: 'تعذر توليد الصوت عبر محرك القراءة الاحتياطي.' }, 502, ctx.headers);
}

function audioResponse(base64, mime, headers, engine) {
  const raw = Uint8Array.from(atob(base64.replace(/^data:[^,]+,/, '')), c => c.charCodeAt(0));
  const wav = raw.length >= 12 && String.fromCharCode(...raw.slice(0, 4)) === 'RIFF' && String.fromCharCode(...raw.slice(8, 12)) === 'WAVE';
  const mp3 = raw.length >= 3 && (String.fromCharCode(...raw.slice(0, 3)) === 'ID3' || (raw[0] === 0xff && (raw[1] & 0xe0) === 0xe0));
  let bytes = raw, type = mp3 ? 'audio/mpeg' : (wav ? 'audio/wav' : mime);
  if (!wav && !mp3 && /^audio\/(L16|pcm)/i.test(mime)) {
    const payload = raw.length % 2 ? raw.slice(0, -1) : raw;
    const head = new ArrayBuffer(44); const view = new DataView(head); const write = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    write(0, 'RIFF'); view.setUint32(4, payload.length + 36, true); write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 24000, true); view.setUint32(28, 48000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, payload.length, true);
    bytes = new Uint8Array(head.byteLength + payload.length); bytes.set(new Uint8Array(head)); bytes.set(payload, head.byteLength); type = 'audio/wav';
  }
  return new Response(bytes, { status: 200, headers: { ...headers, 'Content-Type': type, 'X-TTS-Engine': engine } });
}

async function generateImage(ctx) {
  const prompt = String(ctx.body.prompt || '').trim();
  if (!prompt) return json({ success: false, error: 'الوصف فارغ' }, 400, ctx.headers);

  if (ctx.body.provider === 'cloudflare-flux') {
    if (!ctx.env?.AI || typeof ctx.env.AI.run !== 'function') {
      return json({ success: false, error: 'محرك Cloudflare AI غير مفعّل على الخادم.' }, 503, ctx.headers);
    }
    try {
      const generated = await ctx.env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
        prompt: prompt.slice(0, 2048),
        steps: 4,
        seed: Number.isFinite(Number(ctx.body.seed)) ? Number(ctx.body.seed) : Math.floor(Math.random() * 2147483647)
      });
      if (!generated?.image) throw new Error('لم يُرجع FLUX صورة صالحة.');
      return json({
        success: true,
        provider: '@cf/black-forest-labs/flux-1-schnell',
        mime_type: 'image/jpeg',
        image_base64: generated.image,
        base64Data: generated.image
      }, 200, ctx.headers);
    } catch (error) {
      console.error('[Cloudflare FLUX] Image generation failed:', error?.message || error);
      return json({ success: false, error: `تعذر التوليد عبر FLUX من Cloudflare: ${error?.message || 'حاول مرة أخرى لاحقًا.'}` }, 502, ctx.headers);
    }
  }

  const aspectRatio = {
    '1:1': 'ASPECT_RATIO_ONE_BY_ONE',
    '16:9': 'ASPECT_RATIO_SIXTEEN_BY_NINE',
    '9:16': 'ASPECT_RATIO_NINE_BY_SIXTEEN',
    '4:3': 'ASPECT_RATIO_FOUR_BY_THREE',
    '3:4': 'ASPECT_RATIO_THREE_BY_FOUR'
  }[ctx.body.aspectRatio] || 'ASPECT_RATIO_ONE_BY_ONE';

  const models = [
    { id: 'gemini-nano-banana-2.1', imageSize: 'IMAGE_SIZE_TWO_K' },
    { id: 'gemini-3.1-flash-image', imageSize: 'IMAGE_SIZE_TWO_K' },
    { id: 'gemini-2.5-flash-image', imageSize: '' }
  ];

  return await callGeminiWithFailover(ctx, async (apiKey) => {
    let lastErr = null;
    for (const model of models) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model.id}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            responseFormat: { image: { aspectRatio, ...(model.imageSize ? { imageSize: model.imageSize } : {}) } }
          }
        })
      });
      const data = await readJson(response);
      const imagePart = data.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data && /^image\//i.test(part.inlineData.mimeType || ''));
      if (response.ok && imagePart) {
        return json({
          success: true,
          provider: model.id,
          mime_type: imagePart.inlineData.mimeType || 'image/png',
          image_base64: imagePart.inlineData.data,
          base64Data: imagePart.inlineData.data
        }, 200, ctx.headers);
      }
      lastErr = new Error(data.error?.message || `Image API ${response.status}`);
      lastErr.status = response.status;
      if (response.status === 429 || response.status === 403) throw lastErr;
    }
    throw lastErr || new Error('فشل التوليد بكافة موديلات الصور.');
  });
}

async function upscaleImage(ctx) {
  const b64 = String(ctx.body.image_base64 || ctx.body.image || '').replace(/^data:[^,]*,/, '').trim();
  if (!b64) return json({ success: false, error: 'بيانات الصورة مفقودة لتحسين الجودة.' }, 400, ctx.headers);
  const mimeType = String(ctx.body.mime_type || ctx.body.mime || 'image/png').split(';')[0].trim().toLowerCase();
  const scale = Number(ctx.body.scale) === 2 ? 2 : 4;
  if (!/^image\/(png|jpe?g|webp|avif)$/i.test(mimeType)) return json({ success: false, error: 'صيغة الصورة غير مدعومة. استخدم PNG أو JPEG أو WebP أو AVIF.' }, 415, ctx.headers);
  if (!ctx.env?.IMAGES || typeof ctx.env.IMAGES.input !== 'function') return json({ success: false, error: 'خدمة Cloudflare Images غير مفعّلة على الخادم.' }, 503, ctx.headers);

  try {
    const binary = atob(b64);
    if (binary.length > 20 * 1024 * 1024) return json({ success: false, error: 'حجم الصورة أكبر من الحد المدعوم (20 ميجابايت).' }, 413, ctx.headers);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const info = await ctx.env.IMAGES.info(bytes);
    const width = Number(info?.width);
    const height = Number(info?.height);
    if (!width || !height) return json({ success: false, error: 'تعذر قراءة أبعاد الصورة.' }, 422, ctx.headers);
    if (width * scale > 12000 || height * scale > 12000) return json({ success: false, error: 'الأبعاد الناتجة كبيرة جدًا. جرّب التكبير 2X.' }, 413, ctx.headers);

    const transformed = await ctx.env.IMAGES.input(bytes)
      // scale-up ensures the requested dimensions enlarge the source; generate
      // selects Cloudflare's ESRGAN pass instead of ordinary interpolation.
      // ESRGAN generates new detail at the requested resolution. Apply a
      // moderate edge sharpen so the improvement remains visible after the
      // extension inserts the image at its original on-screen size.
      .transform({ width: width * scale, height: height * scale, fit: 'scale-up', upscale: 'generate' })
      .transform({ sharpen: 2.2 })
      .output({ format: 'image/png' });
    const response = transformed.response();
    if (!response.ok) throw new Error(`Cloudflare Images returned ${response.status}`);
    const output = new Uint8Array(await response.arrayBuffer());
    const outputInfo = await ctx.env.IMAGES.info(output);
    if (Number(outputInfo?.width) !== width * scale || Number(outputInfo?.height) !== height * scale) {
      throw new Error('Cloudflare Images did not return the requested AI-upscaled dimensions');
    }
    const headers = new Headers(ctx.headers);
    headers.set('Content-Type', 'image/png');
    headers.set('X-Image-Provider', 'cloudflare-images-esrgan');
    headers.set('X-Image-Scale', String(scale));
    headers.set('X-Image-Width', String(width * scale));
    headers.set('X-Image-Height', String(height * scale));
    return new Response(output, { status: 200, headers });
  } catch (error) {
    console.error('[Cloudflare Images] Upscaling failed:', error?.message || error);
    return json({ success: false, error: `تعذر التكبير عبر Cloudflare Images: ${error?.message || 'حاول صورة أصغر أو أعد المحاولة.'}` }, 502, ctx.headers);
  }
}

async function removeBackground(ctx) {
  const b64 = String(ctx.body.image_base64 || ctx.body.image || '').replace(/^data:[^,]*,/, '').trim();
  if (!b64) return json({ success: false, error: 'بيانات الصورة مفقودة لعزل الخلفية.' }, 400, ctx.headers);
  const mimeType = String(ctx.body.mime_type || ctx.body.mime || 'image/png').split(';')[0].trim().toLowerCase();
  if (!/^image\/(png|jpe?g|webp|avif)$/i.test(mimeType)) return json({ success: false, error: 'صيغة الصورة غير مدعومة. استخدم PNG أو JPEG أو WebP.' }, 415, ctx.headers);
  if (!ctx.env?.IMAGES || typeof ctx.env.IMAGES.input !== 'function') return json({ success: false, error: 'خدمة Cloudflare Images غير مفعّلة على الخادم.' }, 503, ctx.headers);

  try {
    const binary = atob(b64);
    if (binary.length > 20 * 1024 * 1024) return json({ success: false, error: 'حجم الصورة أكبر من الحد المدعوم (20 ميجابايت).' }, 413, ctx.headers);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const transformed = await ctx.env.IMAGES.input(bytes)
      .transform({ segment: 'foreground' })
      .output({ format: 'image/png' });
    const response = transformed.response();
    if (!response.ok) throw new Error(`Cloudflare Images returned ${response.status}`);

    const output = new Uint8Array(await response.arrayBuffer());
    if (!output.length) throw new Error('Cloudflare returned an empty cutout.');
    let binaryOut = '';
    const chunk = 8192;
    for (let i = 0; i < output.length; i += chunk) {
      binaryOut += String.fromCharCode.apply(null, output.subarray(i, i + chunk));
    }
    const outputBase64 = btoa(binaryOut);
    return json({
      success: true,
      provider: 'cloudflare-images-birefnet',
      mime_type: 'image/png',
      base64Data: outputBase64,
      image_base64: outputBase64
    }, 200, ctx.headers);
  } catch (error) {
    console.error('[Cloudflare Images] Background removal failed:', error?.message || error);
    return json({
      success: false,
      error: `تعذر عزل الخلفية عبر Cloudflare Images: ${error?.message || 'جرّب صورة أصغر أو أعد المحاولة.'}`
    }, 502, ctx.headers);
  }
}

async function geminiText(ctx, prompt, maxOutputTokens = 2000) {
  try {
    return await callGeminiWithFailover(ctx, async (apiKey) => {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens }
        })
      });
      const data = await readJson(response);
      if (!response.ok) {
        const err = new Error(data.error?.message || `Gemini returned ${response.status}`);
        err.status = response.status;
        throw err;
      }
      return data.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('').trim() || '';
    });
  } catch (e) {
    return '';
  }
}

async function enhancePrompt(ctx) {
  const prompt = String(ctx.body.prompt || '').trim();
  if (!prompt) return json({ success: false, error: 'النص المطلوب تحسينه فارغ' }, 400, ctx.headers);
  const system = 'Translate the user prompt to English and rewrite it as a natural photorealistic real-life photograph description. Include natural lighting, realistic textures, lens optics, sharp focus, and 8k resolution. Avoid 3d render, cartoon, illustration, drawing, CGI, anime, and low quality. Output only the English prompt.';
  const enhanced = await geminiText(ctx, `${system}\n\nUser input: ${prompt}`, 350);
  return json({
    success: true,
    provider: enhanced ? 'gemini-photorealistic' : 'studio-photorealistic',
    original: prompt,
    enhanced: enhanced || `${prompt}, photorealistic RAW photography, natural lighting, Sony Alpha A7R V, 85mm f/1.4 lens, authentic natural textures, sharp focus, 8k resolution`
  }, 200, ctx.headers);
}

async function refineVoiceover(ctx) {
  const text = String(ctx.body.text || '').trim();
  const dialect = String(ctx.body.dialect || 'العربية').trim();
  if (!text) return json({ success: false, error: 'اكتب النص المراد تحسينه أولاً.' }, 400, ctx.headers);
  const refined = await geminiText(ctx, `حرر النص التالي ليصبح مناسباً للتعليق الصوتي باللهجة ${dialect}. حسّن علامات الترقيم والإيقاع وسهولة النطق، وحافظ على المعنى والأسماء والأرقام دون إضافة معلومات. أعد النص المحسن فقط دون مقدمة أو شرح:\n\n${text}`, 2500);
  return refined
    ? json({ success: true, refined, text: refined }, 200, ctx.headers)
    : json({ success: false, error: 'تعذر تحسين النص عبر خدمة Mickey Studio. تحقق من إعداد Gemini في Cloudflare.' }, 502, ctx.headers);
}

async function generateText(ctx) {
  const prompt = String(ctx.body.prompt || '').trim();
  if (!prompt) return json({ success: false, error: 'النص المطلوب فارغ.' }, 400, ctx.headers);
  const text = await geminiText(ctx, prompt, 2000);
  return text
    ? json({ success: true, text, response: text }, 200, ctx.headers)
    : json({ success: false, error: 'تعذر إنشاء النص. تحقق من إعداد Gemini في Cloudflare.' }, 502, ctx.headers);
}

async function detectViralClips(ctx) {
  const transcription = String(ctx.body.transcription || ctx.body.text || '').trim();
  if (!transcription) return json({ success: false, error: 'نص الفيديو فارغ.' }, 400, ctx.headers);
  const prompt = `Analyze this video transcript and identify top 3 viral moments (hook, value, punchline) with suggested start/end times and catchy title. Format as JSON array of objects with title, start, end, reason.\nTranscript:\n${transcription.slice(0, 4000)}`;
  const text = await geminiText(ctx, prompt, 1500);
  let clips = [];
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) clips = JSON.parse(jsonMatch[0]);
  } catch (_) {}
  return json({ success: true, clips: clips.length ? clips : [{ title: 'المقطع الأبرز', start: 0, end: 30, reason: 'مقدمة حماسية وجاذبة' }] }, 200, ctx.headers);
}

async function generateChapters(ctx) {
  const transcription = String(ctx.body.transcription || ctx.body.text || '').trim();
  if (!transcription) return json({ success: false, error: 'نص الفيديو فارغ.' }, 400, ctx.headers);
  const prompt = `Divide this transcript into YouTube video chapters with timestamps (mm:ss) and Arabic titles. Output one chapter per line: 00:00 - Title\nTranscript:\n${transcription.slice(0, 4000)}`;
  const text = await geminiText(ctx, prompt, 1000);
  return json({ success: true, chapters: text }, 200, ctx.headers);
}

async function detectCensorWords(ctx) {
  const transcription = String(ctx.body.transcription || ctx.body.text || '').trim();
  if (!transcription) return json({ success: false, error: 'نص الفيديو فارغ.' }, 400, ctx.headers);
  const prompt = `Detect any offensive, blasphemous, or forbidden words in this transcript for YouTube monetization safety. Return as JSON array of bad words found.\nTranscript:\n${transcription.slice(0, 3000)}`;
  const text = await geminiText(ctx, prompt, 500);
  let words = [];
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) words = JSON.parse(jsonMatch[0]);
  } catch (_) {}
  return json({ success: true, words }, 200, ctx.headers);
}

async function transcribeAudio(ctx) {
  const audioBase64 = String(ctx.body.audio_base64 || ctx.body.audio || '').replace(/^data:[^,]+,/, '').trim();
  if (!audioBase64) return json({ success: false, error: 'لم يتم إرسال ملف الصوت للتفريغ.' }, 400, ctx.headers);

  const language = String(ctx.body.language || ctx.body.dialect || 'auto').toLowerCase();
  const modelLanguage = language === 'auto' ? '' : (/^(ar|arabic|عربي|مصري|مصرية|خليجي|شامي|مغربي)/.test(language) ? 'ar' : language);
  let result;
  let provider = 'Cloudflare Workers AI · Whisper Large-v3 Turbo';
  let cloudflareError = null;

  // Cloudflare Workers AI uses the project's existing AI binding and free daily
  // allocation. Audio stays on Mickey Studio infrastructure; no Gemini call or
  // provider API key is needed for transcription.
  if (ctx.env.AI?.run) {
    try {
      result = await ctx.env.AI.run('@cf/openai/whisper-large-v3-turbo', {
        audio: audioBase64,
        task: 'transcribe',
        ...(modelLanguage ? { language: modelLanguage } : {})
      });
    } catch (error) {
      cloudflareError = error;
      console.warn('[transcribe_audio] Cloudflare Whisper failed:', error?.message || error);
    }
  }

  // Optional provider fallback for accounts that already configured Groq.
  // Never fall back to Gemini here: doing so would silently spend Gemini credits.
  if (!result && ctx.env.GROQ_API_KEY) {
    try {
      const raw = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      const form = new FormData();
      const mime = String(ctx.body.mime_type || 'audio/wav').split(';')[0];
      form.append('file', new Blob([raw], { type: mime }), `audio.${mime.split('/')[1] || 'wav'}`);
      form.append('model', 'whisper-large-v3-turbo');
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');
      form.append('timestamp_granularities[]', 'segment');
      if (modelLanguage) form.append('language', modelLanguage);
      const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${ctx.env.GROQ_API_KEY}` }, body: form
      });
      const data = await readJson(resp);
      if (!resp.ok) throw new Error(data.error?.message || `Groq HTTP ${resp.status}`);
      result = data;
      provider = 'Groq · Whisper Large-v3 Turbo';
    } catch (error) {
      console.warn('[transcribe_audio] Groq fallback failed:', error?.message || error);
    }
  }

  if (!result) {
    const message = cloudflareError?.message || 'لم تنجح خدمة التفريغ المجانية حالياً. حاول لاحقاً أو اختر Whisper المحلي.';
    return json({ success: false, error: message }, 503, ctx.headers);
  }

  const text = String(result.text || result.transcription_info?.text || '').trim();
  if (!text) return json({ success: false, error: 'لم يتم التعرف على كلام واضح في الصوت.' }, 422, ctx.headers);
  const segments = normalizeTranscriptionSegments(result.segments, result.vtt, result.words);
  const words = normalizeTranscriptionWords(result.words);
  const srt = segmentsToSrt(segments);
  const analysis = ctx.body.include_analysis ? await analyzeTranscriptWithWorkersAI(text, ctx.env) : null;
  const data = {
    transcript: text,
    text,
    srt,
    dialect: modelLanguage === 'ar' ? 'عربي' : (modelLanguage || 'تلقائي'),
    tone: analysis?.tone || 'غير محددة',
    summary: analysis?.summary || text.slice(0, 180),
    key_points: analysis?.key_points || splitTranscriptPoints(text),
    words_count: Number(result.word_count) || text.split(/\s+/).filter(Boolean).length,
    estimated_speed: 'تم حساب التوقيتات من الصوت',
    segments,
    words
  };
  return json({ success: true, provider, ...data, data }, 200, ctx.headers);
}

function normalizeTranscriptionWords(items) {
  if (!Array.isArray(items)) return [];
  return items.map(word => ({
    text: String(word.word || word.text || '').trim(),
    start: Number(word.start || 0),
    end: Number(word.end || 0),
    confidence: Number(word.confidence ?? 0.95)
  })).filter(word => word.text && Number.isFinite(word.start) && Number.isFinite(word.end) && word.end >= word.start);
}

function normalizeTranscriptionSegments(items, vtt, words) {
  const segments = Array.isArray(items) ? items.map(segment => ({
    start: Number(segment.start || 0), end: Number(segment.end || 0), text: String(segment.text || '').trim()
  })).filter(segment => segment.text && Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start) : [];
  if (segments.length) return segments;

  const timestamp = value => {
    const match = String(value).trim().match(/(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})/);
    return match ? (Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000) : NaN;
  };
  if (typeof vtt === 'string') {
    const parsed = [];
    const lines = vtt.replace(/^WEBVTT[^\n]*\n/i, '').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/(\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(\d{2}:)?\d{2}:\d{2}[.,]\d{3}/);
      if (!match) continue;
      const [startText, endText] = lines[i].split('-->').map(value => value.trim().split(/\s+/)[0]);
      const start = timestamp(startText), end = timestamp(endText);
      const text = [];
      for (i++; i < lines.length && lines[i].trim(); i++) text.push(lines[i].trim());
      if (Number.isFinite(start) && Number.isFinite(end) && end > start && text.length) parsed.push({ start, end, text: text.join(' ') });
    }
    if (parsed.length) return parsed;
  }
  const normalizedWords = normalizeTranscriptionWords(words);
  const grouped = [];
  for (let i = 0; i < normalizedWords.length; i += 5) {
    const group = normalizedWords.slice(i, i + 5);
    grouped.push({ start: group[0].start, end: group[group.length - 1].end, text: group.map(word => word.text).join(' ') });
  }
  return grouped;
}

function segmentsToSrt(segments) {
  const stamp = seconds => {
    const ms = Math.max(0, Math.round(seconds * 1000));
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor(ms % 3600000 / 60000);
    const secs = Math.floor(ms % 60000 / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  };
  return segments.map((segment, index) => `${index + 1}\n${stamp(segment.start)} --> ${stamp(segment.end)}\n${segment.text}`).join('\n\n');
}

function splitTranscriptPoints(text) {
  return (text.match(/[^.!?؟\n]+[.!?؟]?/g) || []).map(part => part.trim()).filter(Boolean).slice(0, 3);
}

async function analyzeTranscriptWithWorkersAI(text, env) {
  if (!env.AI?.run) return null;
  try {
    const result = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
      messages: [
        { role: 'system', content: 'حلل النص العربي فقط وأعد JSON صالحاً بلا Markdown بالمفاتيح: summary (ملخص من جملتين)، key_points (مصفوفة حتى 3 نقاط)، tone (وصف موجز للنبرة). لا تخمّن اللهجة أو معلومات غير موجودة.' },
        { role: 'user', content: text.slice(0, 12000) }
      ], max_tokens: 350, temperature: 0.2
    });
    const raw = String(result.response || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(raw);
    return {
      summary: String(parsed.summary || '').trim(),
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points.map(point => String(point).trim()).filter(Boolean).slice(0, 3) : [],
      tone: String(parsed.tone || '').trim()
    };
  } catch (error) {
    console.warn('[transcribe_audio] Optional transcript-only analysis failed:', error?.message || error);
    return null;
  }
}

async function analyzeVideoSilence(ctx) {
  return json({
    success: true,
    message: 'تم فحص الصمت بنجاح.',
    silence_ranges: []
  }, 200, ctx.headers);
}

async function proxyMedia(ctx) {
  const target = ctx.url.searchParams.get('url');
  if (!target || !target.startsWith('https://')) return json({ success: false, error: 'رابط غير صالح' }, 400, ctx.headers);
  const resp = await fetch(target).catch(() => null);
  if (!resp?.ok) return json({ success: false, error: 'تعذر جلب الوسائط' }, 502, ctx.headers);
  return new Response(resp.body, { status: 200, headers: ctx.headers });
}

// User-saved private key in profile
async function saveUserGeminiKey(ctx) {
  const account = await authenticate(ctx, false);
  const key = String(ctx.body.geminiKey ?? '').trim();
  if (key.length > 256 || (key && !/^[A-Za-z0-9_.-]{30,120}$/.test(key))) {
    return json({ success: false, error: 'صيغة مفتاح Gemini غير صالحة.' }, 400, ctx.headers);
  }
  await updateUserProfileField(account, ctx.env, 'geminiApiKey', key ? { stringValue: key } : null);
  return json({
    success: true,
    message: key ? 'تم حفظ المفتاح الخاص في حسابك بأمان.' : 'تم حذف المفتاح الخاص من حسابك.',
    masked_key: key ? maskKey(key) : null
  }, 200, ctx.headers);
}

async function updateUserProfileField(account, env, field, value) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(account.uid)}?updateMask.fieldPaths=${encodeURIComponent(field)}`;
  const fields = value === null ? {} : { [field]: value };
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!response.ok) {
    console.warn('[Firestore Patch Warning]:', await response.text());
  }
}

// ======================================================================
// NEW ADMIN HANDLERS (Users, Plans, Gemini Keys, Stats, Audit)
// ======================================================================

// 1. Users Tab Handlers
async function adminListUsers(ctx) {
  const account = await authenticate(ctx, true);
  await logAdminAudit(ctx, 'admin_list_users', 'users_table');

  // Authentication accounts and Firestore profiles are separate data sets.
  // A private Admin credential is required to list the full Auth directory.
  const adminToken = await firebaseAdminAccessToken(ctx.env);
  const authUsers = await listFirebaseAuthUsers(ctx.env, adminToken);
  const profileByUid = new Map();
  let pageToken = '';
  let profilePages = 0;
  do {
    const params = new URLSearchParams({ pageSize: '1000' });
    if (pageToken) params.set('pageToken', pageToken);
    const url = 'https://firestore.googleapis.com/v1/projects/' +
      encodeURIComponent(ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT) +
      '/databases/(default)/documents/users?' + params.toString();
    const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + adminToken } });
    const data = await readJson(resp);
    if (!resp.ok) {
      console.error('[Admin list users Firestore error]', resp.status, data.error?.status || '', data.error?.message || '');
      return json({ success: false, error: 'تم جلب الحسابات من Firebase Authentication، لكن تعذر تحميل ملفات المستخدمين من Firestore.', firestore_status: resp.status }, 502, ctx.headers);
    }
    for (const doc of (data.documents || [])) {
      profileByUid.set(doc.name.split('/').pop(), doc.fields || {});
    }
    pageToken = data.nextPageToken || '';
    profilePages++;
  } while (pageToken && profilePages < 100);
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  const users = await Promise.all(authUsers.map(async (authUser) => {
    const uid = authUser.localId;
    const fields = profileByUid.get(uid) || {};
    const email = fields.email?.stringValue || authUser.email || '';
    const displayName = fields.displayName?.stringValue || (email ? email.split('@')[0] : 'مستخدم');
    const isProtectedAdmin = isDesignatedAdminEmail(email, ctx.env.ADMIN_EMAIL);
    const statusOverride = isProtectedAdmin ? null : await readAdminUserStatusOverride(ctx.env, uid);
    const status = isProtectedAdmin ? 'active' : (authUser.disabled ? 'banned' : (statusOverride?.status || fields.status?.stringValue || 'active'));
    const storedPlan = fields.plan?.stringValue || 'free';
    let subscription = null;
    if (fields.subscriptionJson?.stringValue) {
      try { subscription = JSON.parse(fields.subscriptionJson.stringValue); } catch {}
    }
    const subEval = evaluateSubscription(subscription, storedPlan);
    const plan = subEval.plan;
    const banReason = statusOverride?.reason || fields.banReason?.stringValue || '';
    const authDate = value => {
      if (value == null || value === '') return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? new Date(numeric).toISOString() : String(value);
    };
    const createdAt = fields.createdAt?.timestampValue || fields.createdAt?.stringValue || authDate(authUser.createdAt);
    const lastLoginAt = fields.lastLoginAt?.timestampValue || fields.lastLoginAt?.stringValue || authDate(authUser.lastLoginAt);
    const extraCredits = Number(fields.extraCredits?.integerValue || 0);

    let limitOverrides = {};
    if (fields.limitOverridesJson?.stringValue) {
      try { limitOverrides = JSON.parse(fields.limitOverridesJson.stringValue); } catch {}
    }

    // Read today's total usage across tools
    const tools = ['images', 'voice', 'transcription', 'motion_ai', 'video'];
    let todayUsage = 0;
    for (const t of tools) {
      const c = Number(await ctx.env.MICKEY_STATE.get(`quota:d:${uid}:${t}:${todayKey}`)) || 0;
      todayUsage += c;
    }

    // Devices paired
    let pairedDevices = [];
    if (fields.pairedDevicesJson?.stringValue) {
      try { pairedDevices = JSON.parse(fields.pairedDevicesJson.stringValue); } catch {}
    }
    const registeredDevices = await fetchUserDevices(ctx.env, uid, adminToken).catch(() => []);
    const activeDevices = registeredDevices.filter(device => !device.revoked);

    return {
      uid,
      email,
      displayName,
      status,
      plan,
      storedPlan,
      subscription: subEval,
      expires_at: subEval.expires_at,
      days_left: subEval.days_left,
      banReason,
      createdAt,
      lastLoginAt,
      extraCredits,
      limitOverrides,
      todayUsage,
      authDisabled: Boolean(authUser.disabled),
      protected: isProtectedAdmin,
      devicesCount: activeDevices.length,
      pairedDevices: activeDevices
    };
  }));

  return json({
    success: true,
    count: users.length,
    users,
    source: 'firebase_auth_and_firestore'
  }, 200, ctx.headers);
}

async function patchFirestoreUserFields(env, uid, fields, updateMaskPaths = []) {
  const adminToken = await firebaseAdminAccessToken(env);
  const projectId = env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT;
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;

  let url = baseUrl;
  if (updateMaskPaths.length > 0) {
    const maskParams = updateMaskPaths.map(p => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&');
    url += `?${maskParams}`;
  }

  let resp = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });

  // If document does not exist yet (e.g. user only registered in Firebase Auth), create it
  if (resp.status === 404) {
    console.log(`[patchFirestoreUserFields] Document users/${uid} not found, creating base document...`);
    const createUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users?documentId=${encodeURIComponent(uid)}`;
    resp = await fetch(createUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
  }

  return resp;
}

async function setFirebaseAuthUserDisabled(env, uid, disabled) {
  try {
    const adminToken = await firebaseAdminAccessToken(env);
    const projectId = env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT;
    const url = `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:update`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid, disableUser: Boolean(disabled) })
    });
    const data = await readJson(response);
    if (!response.ok) {
      console.error(`[setFirebaseAuthUserDisabled] Firebase Auth update failed (${response.status}):`, data.error?.message || 'unknown error');
      return { ok: false, status: response.status };
    }
    return { ok: true };
  } catch (error) {
    console.error('[setFirebaseAuthUserDisabled] Firebase Auth update error:', error?.message || error);
    return { ok: false, status: error?.status || 0 };
  }
}

async function getUser(ctx, identifier) {
  const rawId = String(identifier || '').trim();
  if (!rawId) {
    return { found: false, code: 'USER_ID_MISSING', message: 'معرف المستخدم غير محدد' };
  }
  const adminToken = await firebaseAdminAccessToken(ctx.env);
  const projectId = ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT;
  const isEmail = rawId.includes('@');
  console.log(`[getUser] البحث عن المستخدم: identifier="${rawId}" (نوع البحث=${isEmail ? 'بريد' : 'UID'})`);

  let authUser = null;
  // 1. Firebase Auth accounts:lookup
  try {
    const lookupBody = isEmail ? { email: [rawId.toLowerCase()] } : { localId: [rawId] };
    const authResp = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(lookupBody)
    });
    if (authResp.ok) {
      const authData = await readJson(authResp);
      if (authData.users && authData.users.length > 0) {
        authUser = authData.users[0];
      }
    } else {
      console.warn(`[getUser] استعلام Firebase Auth أرجع الرمز ${authResp.status}`);
    }
  } catch (err) {
    console.warn(`[getUser] خطأ في استعلام Firebase Auth:`, err);
  }

  const uid = authUser ? authUser.localId : rawId;
  const email = (authUser?.email || (isEmail ? rawId : '')).toLowerCase();

  // 2. Fetch Firestore profile
  let profileDoc = null;
  let firestoreFound = false;
  try {
    const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
    const docResp = await fetch(docUrl, { headers: { Authorization: `Bearer ${adminToken}` } });
    if (docResp.ok) {
      profileDoc = await readJson(docResp);
      firestoreFound = true;
    } else if (docResp.status === 404 && isEmail && uid !== rawId) {
      // Legacy fallback: check if document was keyed by raw email
      const legacyResp = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(rawId)}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (legacyResp.ok) {
        profileDoc = await readJson(legacyResp);
        firestoreFound = true;
      }
    }
  } catch (err) {
    console.warn(`[getUser] خطأ في قراءة ملف Firestore:`, err);
  }

  if (!authUser && !firestoreFound) {
    console.warn(`[getUser] لم يتم العثور على الحساب: identifier="${rawId}"`);
    return {
      found: false,
      code: 'USER_NOT_FOUND',
      message: `لم يتم العثور على الحساب (${rawId}). تأكد من صحة المعرف أو البريد الإلكتروني.`,
      identifier: rawId
    };
  }

  const fields = profileDoc?.fields || {};
  const statusOverride = await readAdminUserStatusOverride(ctx.env, uid);
  let subscription = null;
  if (fields.subscriptionJson?.stringValue) {
    try { subscription = JSON.parse(fields.subscriptionJson.stringValue); } catch {}
  }
  let limitOverrides = {};
  if (fields.limitOverridesJson?.stringValue) {
    try { limitOverrides = JSON.parse(fields.limitOverridesJson.stringValue); } catch {}
  }

  const basePlan = fields.plan?.stringValue || 'free';
  const evaluatedSub = evaluateSubscription(subscription, basePlan);

  const user = {
    found: true,
    uid,
    email: email || String(fields.email?.stringValue || '').toLowerCase(),
    displayName: authUser?.displayName || fields.displayName?.stringValue || '',
    status: authUser?.disabled ? 'banned' : (statusOverride?.status || fields.status?.stringValue || 'active'),
    banReason: statusOverride?.reason || fields.banReason?.stringValue || '',
    plan: evaluatedSub.plan,
    storedPlan: basePlan,
    subscription: evaluatedSub,
    extraCredits: Number(fields.extraCredits?.integerValue || fields.extraCredits?.doubleValue || 0),
    limitOverrides,
    authDisabled: Boolean(authUser?.disabled),
    createdAt: authUser?.createdAt || fields.createdAt?.timestampValue || '',
    lastLoginAt: authUser?.lastLoginAt || fields.lastLoginAt?.timestampValue || ''
  };

  console.log(`[getUser] تم التحقق من الحساب بنجاح: uid="${user.uid}", email="${user.email}", plan="${user.plan}", status="${user.status}"`);
  return user;
}

async function protectAdminAccountTarget(ctx, account, targetIdentifier) {
  const callerEmail = String(account.email || '').toLowerCase();

  const targetUser = await getUser(ctx, targetIdentifier);
  if (!targetUser.found) {
    console.error(`[protectAdminAccountTarget] مرفوض (USER_NOT_FOUND): actor="${callerEmail}", targetIdentifier="${targetIdentifier}"`);
    failWithCode(404, targetUser.message, targetUser.code || 'USER_NOT_FOUND');
  }

  const targetEmail = String(targetUser.email || '').toLowerCase();
  const targetUid = targetUser.uid;

  if (isDesignatedAdminEmail(targetEmail, ctx.env.ADMIN_EMAIL) || (targetUid === account.uid && isDesignatedAdminEmail(callerEmail, ctx.env.ADMIN_EMAIL))) {
    console.error(`[protectAdminAccountTarget] مرفوض (ACTION_FORBIDDEN): محاولة تعديل حساب المسؤول الأساسي. actor="${callerEmail}", target="${targetEmail || targetUid}"`);
    failWithCode(403, 'حساب المسؤول الأساسي محمي ولا يمكن تعديل حالته أو باقته أو رصيده أو أجهزته.', 'ACTION_FORBIDDEN');
  }

  return targetUser;
}

async function adminUpdateUserStatus(ctx) {
  const account = await authenticate(ctx, true);
  const targetRaw = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  const newStatus = String(ctx.body.status || 'active').trim(); // 'active' | 'banned' | 'suspended'
  const reason = String(ctx.body.reason || '').trim();

  if (!targetRaw) return json({ success: false, error: 'معرف المستخدم غير محدد', code: 'TARGET_MISSING' }, 400, ctx.headers);
  if (!['active', 'banned', 'suspended'].includes(newStatus)) {
    return json({ success: false, error: 'حالة غير صالحة', code: 'INVALID_STATUS' }, 400, ctx.headers);
  }

  const targetUser = await protectAdminAccountTarget(ctx, account, targetRaw);
  const targetUid = targetUser.uid;
  const overrideWritten = await writeAdminUserStatusOverride(ctx.env, targetUid, newStatus, reason);

  const fields = {
    status: { stringValue: newStatus },
    banReason: { stringValue: newStatus === 'active' ? '' : reason },
    updatedAt: { timestampValue: nowIso() }
  };

  const resp = await patchFirestoreUserFields(ctx.env, targetUid, fields, ['status', 'banReason', 'updatedAt']);
  const authResult = await setFirebaseAuthUserDisabled(ctx.env, targetUid, newStatus !== 'active');

  if (newStatus === 'active') {
    if (!authResult.ok || (!resp.ok && !overrideWritten)) {
      return json({ success: false, error: 'تعذر إعادة تفعيل الحساب. لم تنجح الكتابة في Firebase أو مخزن Cloudflare.', code: 'FIRESTORE_AND_AUTH_ERROR' }, 502, ctx.headers);
    }
    if (resp.ok) await deleteAdminUserStatusOverride(ctx.env, targetUid);
    if (!resp.ok) {
      await logAdminAudit(ctx, 'update_user_status', targetUid, { newStatus, reason, targetEmail: targetUser.email, firestoreUpdated: false, authEnabled: true });
      return json({ success: true, degraded: true, error: 'تمت إعادة تفعيل الحساب، لكن تعذر تحديث ملفه في Firebase؛ حُفظت الحالة في Cloudflare.', target_uid: targetUid, status: newStatus }, 200, ctx.headers);
    }
  } else {
    if (!resp.ok && !authResult.ok && !overrideWritten) {
      return json({ success: false, error: 'تعذر تحديث حالة الحساب في Firebase أو حفظها في مخزن Cloudflare.', code: 'FIRESTORE_AUTH_KV_ERROR' }, 502, ctx.headers);
    }
    if (resp.ok && authResult.ok) await deleteAdminUserStatusOverride(ctx.env, targetUid);
    if (!resp.ok || !authResult.ok) {
      await logAdminAudit(ctx, 'update_user_status', targetUid, { newStatus, reason, targetEmail: targetUser.email, firestoreUpdated: resp.ok, authDisabled: authResult.ok, cloudflareOverride: overrideWritten });
      const error = !resp.ok
        ? (overrideWritten ? 'تم الحظر عبر Cloudflare، لكن تعذر تحديث حالة الحساب في Firebase.' : 'تم حظر الحساب عبر Firebase Authentication، لكن تعذر حفظ سبب الحظر في Firebase أو Cloudflare.')
        : 'تم حظر الحساب في الموقع والإضافة، لكن تعذر تعطيل تسجيل الدخول عبر Firebase Authentication.';
      return json({ success: true, degraded: true, error, code: 'STATUS_BACKUP_USED', target_uid: targetUid, status: newStatus }, 200, ctx.headers);
    }
  }

  await logAdminAudit(ctx, 'update_user_status', targetUid, { newStatus, reason, targetEmail: targetUser.email });
  return json({
    success: true,
    message: newStatus === 'active' ? 'تم تنشيط الحساب بنجاح.' : `تم إيقاف الحساب (${newStatus}).`,
    target_uid: targetUid,
    status: newStatus
  }, 200, ctx.headers);
}

async function adminUpdateUserPlan(ctx) {
  const account = await authenticate(ctx, true);
  const targetRaw = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  const newPlan = String(ctx.body.plan || '').trim();

  if (!targetRaw) return json({ success: false, error: 'معرف المستخدم غير محدد', code: 'TARGET_MISSING' }, 400, ctx.headers);
  const configuredPlans = await getPlansConfig(ctx.env);
  if (!Object.prototype.hasOwnProperty.call(configuredPlans, newPlan)) {
    return json({ success: false, error: 'الباقة المحددة غير معروفة', code: 'UNKNOWN_PLAN' }, 400, ctx.headers);
  }

  const targetUser = await protectAdminAccountTarget(ctx, account, targetRaw);
  const targetUid = targetUser.uid;

  let subscriptionPayload;
  if (newPlan === 'free') {
    subscriptionPayload = JSON.stringify({
      user_id: targetUid,
      plan: 'free',
      started_at: nowIso(),
      expires_at: null,
      status: 'active',
      source: 'manual_admin',
      notes: 'تغيير مباشر للباقة المجانية'
    });
  } else {
    const existingSub = targetUser.subscription;
    const now = Date.now();
    let expiresAt;
    if (existingSub && existingSub.expires_at && new Date(existingSub.expires_at).getTime() > now) {
      expiresAt = existingSub.expires_at;
    } else {
      expiresAt = new Date(now + 30 * 86400000).toISOString();
    }
    subscriptionPayload = JSON.stringify({
      user_id: targetUid,
      plan: newPlan,
      started_at: existingSub?.started_at || nowIso(),
      expires_at: expiresAt,
      status: 'active',
      source: ctx.body.source || 'manual_admin',
      notes: ctx.body.notes || 'تعديل الباقة من لوحة الإدارة'
    });
  }

  const fields = {
    plan: { stringValue: newPlan },
    subscriptionJson: { stringValue: subscriptionPayload },
    updatedAt: { timestampValue: nowIso() }
  };

  const resp = await patchFirestoreUserFields(ctx.env, targetUid, fields, ['plan', 'subscriptionJson', 'updatedAt']);
  if (!resp.ok) {
    return json({ success: false, error: 'تعذر تحديث باقة المستخدم في قاعدة البيانات', code: 'FIRESTORE_ERROR' }, 502, ctx.headers);
  }

  try {
    const subObj = JSON.parse(subscriptionPayload);
    await toolAccessDb(ctx.env, 'subscription_save', subObj);
  } catch (err) {
    console.warn('[adminUpdateUserPlan] DO save error:', err);
  }

  await logAdminAudit(ctx, 'update_user_plan', targetUid, { newPlan, targetEmail: targetUser.email });
  return json({
    success: true,
    message: `تم تحديث باقة الحساب إلى (${planNameArabic(newPlan)}) بنجاح.`,
    target_uid: targetUid,
    plan: newPlan
  }, 200, ctx.headers);
}

async function adminActivateSubscription(ctx) {
  const account = await authenticate(ctx, true);
  const targetRaw = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  const plan = String(ctx.body.plan || 'pro').trim();
  const days = Number(ctx.body.days || 0);
  const customExpiresAt = ctx.body.expires_at ? String(ctx.body.expires_at).trim() : null;
  const notes = String(ctx.body.notes || '').trim();
  const source = String(ctx.body.source || 'manual_admin').trim();

  if (!targetRaw) return json({ success: false, error: 'معرف المستخدم غير محدد', code: 'TARGET_MISSING' }, 400, ctx.headers);

  const targetUser = await protectAdminAccountTarget(ctx, account, targetRaw);
  const targetUid = targetUser.uid;

  const now = Date.now();
  let baseMs = now;
  const existingSub = targetUser.subscription;
  // If user currently has an active unexpired subscription, renewal extends from its current expiry date
  if (existingSub && existingSub.expires_at) {
    const curExpiresMs = new Date(existingSub.expires_at).getTime();
    if (curExpiresMs > now) {
      baseMs = curExpiresMs;
    }
  }

  let finalExpiresAt;
  if (customExpiresAt) {
    const parsed = new Date(customExpiresAt);
    if (isNaN(parsed.getTime())) {
      return json({ success: false, error: 'تاريخ الانتهاء المحدد غير صالح', code: 'INVALID_DATE' }, 400, ctx.headers);
    }
    finalExpiresAt = parsed.toISOString();
  } else if (days > 0) {
    finalExpiresAt = new Date(baseMs + days * 86400000).toISOString();
  } else {
    finalExpiresAt = new Date(baseMs + 30 * 86400000).toISOString();
  }

  const subObj = {
    user_id: targetUid,
    plan,
    started_at: existingSub?.started_at || nowIso(),
    expires_at: finalExpiresAt,
    status: 'active',
    source,
    notes,
    updated_at: nowIso()
  };

  const fields = {
    plan: { stringValue: plan },
    subscriptionJson: { stringValue: JSON.stringify(subObj) },
    updatedAt: { timestampValue: nowIso() }
  };

  const resp = await patchFirestoreUserFields(ctx.env, targetUid, fields, ['plan', 'subscriptionJson', 'updatedAt']);
  if (!resp.ok) {
    return json({ success: false, error: 'تعذر تفعيل الاشتراك في قاعدة البيانات', code: 'FIRESTORE_ERROR' }, 502, ctx.headers);
  }

  try {
    await toolAccessDb(ctx.env, 'subscription_save', subObj);
  } catch (err) {
    console.warn('[adminActivateSubscription] DO save error:', err);
  }

  const evaluated = evaluateSubscription(subObj, plan);
  await logAdminAudit(ctx, 'activate_subscription', targetUid, { plan, expires_at: finalExpiresAt, days, targetEmail: targetUser.email });

  return json({
    success: true,
    message: `تم تفعيل اشتراك (${planNameArabic(plan)}) بنجاح حتى ${new Date(finalExpiresAt).toLocaleDateString('ar-EG')}.`,
    target_uid: targetUid,
    subscription: evaluated
  }, 200, ctx.headers);
}

async function adminCancelSubscription(ctx) {
  const account = await authenticate(ctx, true);
  const targetRaw = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  const reason = String(ctx.body.reason || '').trim();

  if (!targetRaw) return json({ success: false, error: 'معرف المستخدم غير محدد', code: 'TARGET_MISSING' }, 400, ctx.headers);

  const targetUser = await protectAdminAccountTarget(ctx, account, targetRaw);
  const targetUid = targetUser.uid;

  const subObj = {
    user_id: targetUid,
    plan: 'free',
    started_at: targetUser.subscription?.started_at || nowIso(),
    expires_at: nowIso(),
    status: 'cancelled',
    source: 'manual_admin',
    notes: reason ? `إلغاء الاشتراك: ${reason}` : 'تم إلغاء الاشتراك بواسطة الإدارة',
    updated_at: nowIso()
  };

  const fields = {
    plan: { stringValue: 'free' },
    subscriptionJson: { stringValue: JSON.stringify(subObj) },
    updatedAt: { timestampValue: nowIso() }
  };

  const resp = await patchFirestoreUserFields(ctx.env, targetUid, fields, ['plan', 'subscriptionJson', 'updatedAt']);
  if (!resp.ok) {
    return json({ success: false, error: 'تعذر إلغاء الاشتراك في قاعدة البيانات', code: 'FIRESTORE_ERROR' }, 502, ctx.headers);
  }

  try {
    await toolAccessDb(ctx.env, 'subscription_save', subObj);
  } catch (err) {
    console.warn('[adminCancelSubscription] DO save error:', err);
  }

  await logAdminAudit(ctx, 'cancel_subscription', targetUid, { reason, targetEmail: targetUser.email });

  return json({
    success: true,
    message: 'تم إلغاء الاشتراك بنجاح وتحويل الحساب إلى الباقة المجانية فورياً.',
    target_uid: targetUid,
    subscription: evaluateSubscription(subObj, 'free')
  }, 200, ctx.headers);
}

async function adminSetSubscriptionExpiry(ctx) {
  const account = await authenticate(ctx, true);
  const targetRaw = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  const newExpiresAt = String(ctx.body.expires_at || '').trim();

  if (!targetRaw) return json({ success: false, error: 'معرف المستخدم غير محدد', code: 'TARGET_MISSING' }, 400, ctx.headers);
  const parsed = new Date(newExpiresAt);
  if (isNaN(parsed.getTime())) {
    return json({ success: false, error: 'تاريخ الانتهاء غير صالح', code: 'INVALID_DATE' }, 400, ctx.headers);
  }

  const targetUser = await protectAdminAccountTarget(ctx, account, targetRaw);
  const targetUid = targetUser.uid;

  const currentSub = targetUser.subscription || {};
  const isFuture = parsed.getTime() > Date.now();
  const subObj = {
    user_id: targetUid,
    plan: currentSub.plan && currentSub.plan !== 'free' ? currentSub.plan : 'pro',
    started_at: currentSub.started_at || nowIso(),
    expires_at: parsed.toISOString(),
    status: isFuture ? 'active' : 'expired',
    source: currentSub.source || 'manual_admin',
    notes: 'تعديل تاريخ الانتهاء بواسطة الإدارة',
    updated_at: nowIso()
  };

  const effectivePlan = isFuture ? subObj.plan : 'free';

  const fields = {
    plan: { stringValue: effectivePlan },
    subscriptionJson: { stringValue: JSON.stringify(subObj) },
    updatedAt: { timestampValue: nowIso() }
  };

  const resp = await patchFirestoreUserFields(ctx.env, targetUid, fields, ['plan', 'subscriptionJson', 'updatedAt']);
  if (!resp.ok) {
    return json({ success: false, error: 'تعذر تعديل تاريخ الانتهاء في قاعدة البيانات', code: 'FIRESTORE_ERROR' }, 502, ctx.headers);
  }

  try {
    await toolAccessDb(ctx.env, 'subscription_save', subObj);
  } catch (err) {
    console.warn('[adminSetSubscriptionExpiry] DO save error:', err);
  }

  const evaluated = evaluateSubscription(subObj, effectivePlan);
  await logAdminAudit(ctx, 'set_subscription_expiry', targetUid, { expires_at: parsed.toISOString(), targetEmail: targetUser.email });

  return json({
    success: true,
    message: `تم تعديل تاريخ انتهاء الاشتراك إلى ${parsed.toLocaleDateString('ar-EG')}.`,
    target_uid: targetUid,
    subscription: evaluated
  }, 200, ctx.headers);
}

async function adminSetUserLimits(ctx) {
  const account = await authenticate(ctx, true);
  const targetRaw = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  const overrides = ctx.body.overrides || {};

  if (!targetRaw) return json({ success: false, error: 'معرف المستخدم غير محدد', code: 'TARGET_MISSING' }, 400, ctx.headers);
  const targetUser = await protectAdminAccountTarget(ctx, account, targetRaw);
  const targetUid = targetUser.uid;

  const fields = {
    limitOverridesJson: { stringValue: JSON.stringify(overrides) },
    updatedAt: { timestampValue: nowIso() }
  };

  const resp = await patchFirestoreUserFields(ctx.env, targetUid, fields, ['limitOverridesJson', 'updatedAt']);
  if (!resp.ok) {
    return json({ success: false, error: 'تعذر حفظ الحدود المخصصة في قاعدة البيانات', code: 'FIRESTORE_ERROR' }, 502, ctx.headers);
  }

  await logAdminAudit(ctx, 'set_user_limits', targetUid, { overrides, targetEmail: targetUser.email });
  return json({ success: true, message: 'تم حفظ الحدود المخصصة لهذا المستخدم بنجاح.' }, 200, ctx.headers);
}

async function adminAddUserCredits(ctx) {
  const account = await authenticate(ctx, true);
  const targetRaw = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  const creditsToAdd = Number(ctx.body.credits || 0);

  if (!targetRaw || creditsToAdd <= 0) {
    return json({ success: false, error: 'يرجى تحديد عدد رصيد موجب للإضافة', code: 'INVALID_CREDITS' }, 400, ctx.headers);
  }
  const targetUser = await protectAdminAccountTarget(ctx, account, targetRaw);
  const targetUid = targetUser.uid;

  const adminToken = await firebaseAdminAccessToken(ctx.env);
  const getUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT)}/databases/(default)/documents/users/${encodeURIComponent(targetUid)}`;
  const getResp = await fetch(getUrl, { headers: { Authorization: `Bearer ${adminToken}` } });
  const curDoc = getResp.ok ? await readJson(getResp) : {};
  const existing = Number(curDoc.fields?.extraCredits?.integerValue || curDoc.fields?.extraCredits?.doubleValue || 0);
  const total = existing + creditsToAdd;

  const fields = {
    extraCredits: { integerValue: String(total) },
    updatedAt: { timestampValue: nowIso() }
  };
  const resp = await patchFirestoreUserFields(ctx.env, targetUid, fields, ['extraCredits', 'updatedAt']);
  if (!resp.ok) {
    return json({ success: false, error: 'تعذر إضافة الرصيد في قاعدة البيانات', code: 'FIRESTORE_ERROR' }, 502, ctx.headers);
  }

  await logAdminAudit(ctx, 'add_user_credits', targetUid, { added: creditsToAdd, total, targetEmail: targetUser.email });
  return json({ success: true, message: `تمت إضافة ${creditsToAdd} رصيد. الرصيد الجديد: ${total}` }, 200, ctx.headers);
}

async function adminRevokeUserDevices(ctx) {
  const account = await authenticate(ctx, true);
  const targetRaw = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  if (!targetRaw) return json({ success: false, error: 'معرف المستخدم غير محدد', code: 'TARGET_MISSING' }, 400, ctx.headers);

  const targetUser = await protectAdminAccountTarget(ctx, account, targetRaw);
  const targetUid = targetUser.uid;

  const adminToken = await firebaseAdminAccessToken(ctx.env);
  const devices = await fetchUserDevices(ctx.env, targetUid, adminToken);
  for (const device of devices.filter(item => !item.revoked)) {
    device.revoked = true;
    device.lastSeenAt = nowIso();
    await saveUserDevice(ctx.env, targetUid, adminToken, device);
  }

  await patchFirestoreUserFields(ctx.env, targetUid, { pairedDevicesJson: { stringValue: '[]' } }, ['pairedDevicesJson']);
  await ctx.env.MICKEY_STATE.delete(`motion_scene:${targetUid}`);

  await logAdminAudit(ctx, 'revoke_user_devices', targetUid, { targetEmail: targetUser.email });
  return json({ success: true, message: 'تم إلغاء اقتران كافة أجهزة الإضافة لهذا الحساب بنجاح.' }, 200, ctx.headers);
}

async function adminDeleteUser(ctx) {
  const account = await authenticate(ctx, true);
  const targetRaw = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  if (!targetRaw) return json({ success: false, error: 'معرف المستخدم غير محدد', code: 'TARGET_MISSING' }, 400, ctx.headers);

  const targetUser = await protectAdminAccountTarget(ctx, account, targetRaw);
  const targetUid = targetUser.uid;

  const adminToken = await firebaseAdminAccessToken(ctx.env);
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT)}/databases/(default)/documents/users/${encodeURIComponent(targetUid)}`;
  await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });

  await ctx.env.MICKEY_STATE.delete(`motion_scene:${targetUid}`);
  await logAdminAudit(ctx, 'delete_user', targetUid, { targetEmail: targetUser.email });
  return json({ success: true, message: 'تم حذف الحساب بالكامل.' }, 200, ctx.headers);
}

// 2. Plans Tab Handlers
async function adminGetPlans(ctx) {
  await authenticate(ctx, true);
  const sysConfig = await getSystemConfig(ctx.env);
  const plans = await getPlansConfig(ctx.env);
  const subMode = Boolean(sysConfig.subscription_mode || sysConfig.paywall_enabled);
  return json({
    success: true,
    subscription_mode: subMode,
    paywall_enabled: subMode,
    plans
  }, 200, ctx.headers);
}

async function adminGetToolAccess(ctx) {
  await authenticate(ctx, true);
  const seed = await toolBootstrapPayload(ctx.env);
  await toolAccessDb(ctx.env, 'tool_bootstrap', seed);
  const stored = await toolAccessDb(ctx.env, 'tool_config_get', seed);
  const config = await getSystemConfig(ctx.env);
  const plans = await getPlansConfig(ctx.env);
  const subMode = Boolean(config.subscription_mode || config.paywall_enabled);
  return json({
    success: true,
    paywall_enabled: subMode,
    subscription_mode: subMode,
    plans: Object.entries(plans).map(([id, plan]) => ({ id, name: plan.name || id })),
    tools: stored.tools || [],
    access: stored.access || [],
    overrides: stored.overrides || [],
    plan_overrides: stored.planOverrides || [],
    audit: stored.audit || []
  }, 200, ctx.headers);
}

async function adminSaveToolAccess(ctx) {
  const account = await authenticate(ctx, true);
  const plans = await getPlansConfig(ctx.env);
  const allowedTools = new Set(TOOL_CATALOG.map(tool => tool.key));
  const incoming = Array.isArray(ctx.body.access) ? ctx.body.access : [];
  if (!incoming.length) fail(400, 'جدول صلاحيات الأدوات فارغ أو غير صالح.');
  const rows = incoming.map(row => {
    const planId = String(row.plan_id || '');
    const toolKey = String(row.tool_key || '');
    const access = String(row.access || '');
    const unit = String(row.limit_unit || 'month');
    const rawLimit = row.monthly_limit;
    const limit = rawLimit === '' || rawLimit == null ? null : Number(rawLimit);
    if (!Object.prototype.hasOwnProperty.call(plans, planId) || !allowedTools.has(toolKey) || !['full', 'limited', 'locked'].includes(access)) {
      fail(400, 'تحتوي صلاحيات الأدوات على خطة أو أداة أو مستوى وصول غير صالح.');
    }
    if (!['month', 'day'].includes(unit) || (limit != null && (!Number.isInteger(limit) || limit < 0))) {
      fail(400, 'الحد أو وحدة احتسابه غير صالحة.');
    }
    return { plan_id: planId, tool_key: toolKey, access, monthly_limit: limit, limit_unit: unit };
  });
  const seed = await toolBootstrapPayload(ctx.env);
  await toolAccessDb(ctx.env, 'tool_config_save', { ...seed, access: rows, actor: account.email, created_at: nowIso() });
  await logAdminAudit(ctx, 'save_tool_access', 'plan_tool_access', { count: rows.length });
  return json({ success: true, message: 'تم حفظ صلاحيات الأدوات والخطط.', access: rows }, 200, ctx.headers);
}

async function adminSetPaywall(ctx) {
  const account = await authenticate(ctx, true);
  if (typeof ctx.body.enabled !== 'boolean') fail(400, 'قيمة مفتاح Paywall غير صالحة.');
  const enabled = Boolean(ctx.body.enabled);
  const seed = await toolBootstrapPayload(ctx.env);
  await toolAccessDb(ctx.env, 'tool_bootstrap', seed);
  const config = await getSystemConfig(ctx.env);
  config.paywall_enabled = enabled;
  config.subscription_mode = enabled;
  config.updated_at = nowIso();
  config.updated_by = account.email;
  await ctx.env.MICKEY_STATE.put('system_config', JSON.stringify(config));
  await toolAccessDb(ctx.env, 'tool_audit', { actor: account.email, target: 'system_config', action: 'set_paywall_enabled', details: { enabled }, created_at: nowIso() });
  await logAdminAudit(ctx, 'set_paywall_enabled', 'system_config', { enabled, subscription_mode: enabled });
  return json({
    success: true,
    paywall_enabled: enabled,
    subscription_mode: enabled,
    message: enabled
      ? 'تم تفعيل نمط الاشتراكات وPaywall فورياً (يتم فرض صلاحيات الخطط).'
      : 'تم إيقاف نمط الاشتراكات فورياً وفتح جميع الأدوات للجميع.'
  }, 200, ctx.headers);
}

async function adminSaveToolOverride(ctx) {
  const account = await authenticate(ctx, true);
  const uid = String(ctx.body.user_id || '').trim();
  const planId = String(ctx.body.plan_id || '').trim();
  const toolKey = String(ctx.body.tool_key || '').trim();
  const access = String(ctx.body.access || '').trim();
  const plans = await getPlansConfig(ctx.env);
  if (!uid || (planId && !Object.prototype.hasOwnProperty.call(plans, planId))) fail(400, 'معرف المستخدم أو الخطة غير صالح.');
  if (toolKey && (!TOOL_CATALOG.some(tool => tool.key === toolKey) || !['full', 'limited', 'locked'].includes(access))) fail(400, 'الأداة أو صلاحيتها غير صالحة.');
  if (!planId && !ctx.body.clear_plan && !toolKey) fail(400, 'حدد خطة أو أداة لتعديل صلاحية المستخدم.');
  await protectAdminAccountTarget(ctx, account, uid);
  const seed = await toolBootstrapPayload(ctx.env);
  await toolAccessDb(ctx.env, 'tool_override_save', {
    ...seed, user_id: uid, plan_id: planId || null, tool_key: toolKey || null,
    access: access || null, clear_plan: Boolean(ctx.body.clear_plan), clear_access: Boolean(ctx.body.clear_access),
    actor: account.email, created_at: nowIso()
  });
  await logAdminAudit(ctx, 'save_user_tool_override', uid, { plan_id: planId || null, tool_key: toolKey || null, access: access || null, clear_plan: Boolean(ctx.body.clear_plan), clear_access: Boolean(ctx.body.clear_access) });
  return json({ success: true, message: 'تم حفظ الاستثناء اليدوي للمستخدم.' }, 200, ctx.headers);
}

async function adminUpdatePlans(ctx) {
  const account = await authenticate(ctx, true);
  const incomingPlans = ctx.body.plans;
  if (!incomingPlans || typeof incomingPlans !== 'object') {
    return json({ success: false, error: 'بيانات الخطط غير صالحة' }, 400, ctx.headers);
  }
  const plans = await getPlansConfig(ctx.env);
  for (const [planId, incoming] of Object.entries(incomingPlans)) {
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) fail(400, 'بيانات إحدى الخطط غير صالحة.');
    const price = incoming.price == null || incoming.price === '' ? null : Number(incoming.price);
    if (price !== null && (!Number.isFinite(price) || price < 0)) fail(400, `سعر الخطة «${planId}» غير صالح.`);
    const current = plans[planId] || { id: planId, features: {}, limits: {} };
    plans[planId] = {
      ...current, ...incoming, id: planId, price,
      features: { ...(current.features || {}), ...(incoming.features || {}) },
      limits: { ...(current.limits || {}), ...(incoming.limits || {}) }
    };
  }
  await ctx.env.MICKEY_STATE.put('system_plans', JSON.stringify(plans));
  await logAdminAudit(ctx, 'update_plans', 'system_plans', { updated_plans: Object.keys(incomingPlans) });

  return json({ success: true, message: 'تم حفظ إعدادات الخطط بنجاح.', plans }, 200, ctx.headers);
}

async function adminSetSubscriptionMode(ctx) {
  const account = await authenticate(ctx, true);
  const enabled = Boolean(ctx.body.enabled);

  const current = await getSystemConfig(ctx.env);
  current.subscription_mode = enabled;
  current.paywall_enabled = enabled;
  current.updated_at = nowIso();
  current.updated_by = account.email;

  await ctx.env.MICKEY_STATE.put('system_config', JSON.stringify(current));
  await toolAccessDb(ctx.env, 'tool_audit', { actor: account.email, target: 'system_config', action: 'set_subscription_mode', details: { enabled }, created_at: nowIso() });
  await logAdminAudit(ctx, 'set_subscription_mode', 'system_config', { subscription_mode: enabled, paywall_enabled: enabled });

  return json({
    success: true,
    subscription_mode: enabled,
    paywall_enabled: enabled,
    message: enabled
      ? 'تم تفعيل نمط الاشتراكات: يتم فرض الحدود وصلاحيات الأدوات على الجميع فورياً.'
      : 'تم إيقاف نمط الاشتراكات: كافة الأدوات مفتوحة للجميع بدون أي قيود.'
  }, 200, ctx.headers);
}

const COUPONS_KEY = 'discount_coupons';

async function adminListCoupons(ctx) {
  await authenticate(ctx, true);
  const coupons = await ctx.env.MICKEY_STATE.get(COUPONS_KEY, 'json') || [];
  return json({ success: true, count: coupons.length, coupons }, 200, ctx.headers);
}

async function adminCreateCoupon(ctx) {
  const account = await authenticate(ctx, true);
  const code = String(ctx.body.code || '').trim().toUpperCase();
  const type = String(ctx.body.type || 'percent').trim();
  const value = Number(ctx.body.value);
  const maxUses = ctx.body.maxUses === '' || ctx.body.maxUses == null ? null : Number(ctx.body.maxUses);
  let expiresAt = null;

  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
    return json({ success: false, error: 'اكتب رمز كوبون من 3 إلى 32 خانة باستخدام الحروف الإنجليزية والأرقام والشرطة فقط.' }, 400, ctx.headers);
  }
  if (!['percent', 'fixed'].includes(type) || !Number.isFinite(value) || value <= 0 ||
      (type === 'percent' && value > 100) || (type === 'fixed' && value > 10000000)) {
    return json({ success: false, error: 'قيمة الخصم غير صالحة.' }, 400, ctx.headers);
  }
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000000)) {
    return json({ success: false, error: 'عدد الاستخدامات يجب أن يكون رقمًا صحيحًا موجبًا.' }, 400, ctx.headers);
  }
  if (ctx.body.expiresAt) {
    const expiryTime = Date.parse(ctx.body.expiresAt);
    if (!Number.isFinite(expiryTime)) {
      return json({ success: false, error: 'تاريخ انتهاء الكوبون غير صالح.' }, 400, ctx.headers);
    }
    if (expiryTime <= Date.now()) {
      return json({ success: false, error: 'تاريخ انتهاء الكوبون يجب أن يكون في المستقبل.' }, 400, ctx.headers);
    }
    expiresAt = new Date(expiryTime).toISOString();
  }

  const coupons = await ctx.env.MICKEY_STATE.get(COUPONS_KEY, 'json') || [];
  if (coupons.some(item => item.code === code)) {
    return json({ success: false, error: 'رمز الكوبون مستخدم بالفعل.' }, 409, ctx.headers);
  }
  const coupon = {
    id: 'coupon_' + crypto.randomUUID(),
    code,
    type,
    value,
    currency: 'EGP',
    plan: 'pro',
    status: 'active',
    maxUses,
    redemptionCount: 0,
    expiresAt,
    createdAt: nowIso(),
    createdBy: account.email
  };
  coupons.unshift(coupon);
  await ctx.env.MICKEY_STATE.put(COUPONS_KEY, JSON.stringify(coupons));
  await logAdminAudit(ctx, 'create_coupon', coupon.id, { code, type, value, maxUses, expiresAt });
  return json({ success: true, coupon, message: 'تم إنشاء كوبون الخصم.' }, 200, ctx.headers);
}

async function adminToggleCoupon(ctx) {
  const account = await authenticate(ctx, true);
  const couponId = String(ctx.body.couponId || '').trim();
  const enabled = Boolean(ctx.body.enabled);
  const coupons = await ctx.env.MICKEY_STATE.get(COUPONS_KEY, 'json') || [];
  const coupon = coupons.find(item => item.id === couponId);
  if (!coupon) return json({ success: false, error: 'الكوبون غير موجود.' }, 404, ctx.headers);
  coupon.status = enabled ? 'active' : 'disabled';
  await ctx.env.MICKEY_STATE.put(COUPONS_KEY, JSON.stringify(coupons));
  await logAdminAudit(ctx, 'toggle_coupon', couponId, { enabled });
  return json({ success: true, coupons, message: enabled ? 'تم تفعيل الكوبون.' : 'تم إيقاف الكوبون.' }, 200, ctx.headers);
}

async function adminDeleteCoupon(ctx) {
  const account = await authenticate(ctx, true);
  const couponId = String(ctx.body.couponId || '').trim();
  const coupons = await ctx.env.MICKEY_STATE.get(COUPONS_KEY, 'json') || [];
  const next = coupons.filter(item => item.id !== couponId);
  if (next.length === coupons.length) return json({ success: false, error: 'الكوبون غير موجود.' }, 404, ctx.headers);
  await ctx.env.MICKEY_STATE.put(COUPONS_KEY, JSON.stringify(next));
  await logAdminAudit(ctx, 'delete_coupon', couponId);
  return json({ success: true, coupons: next, message: 'تم حذف الكوبون.' }, 200, ctx.headers);
}

// 3. Gemini Keys Tab Handlers (Write-Only, Failover Management)
async function adminListGeminiKeys(ctx) {
  await authenticate(ctx, true);
  return json(await getGeminiKeys(ctx.env), 200, ctx.headers);
}

async function adminAddGeminiKeys(ctx) {
  const account = await authenticate(ctx, true);
  let pool = await ctx.env.MICKEY_STATE.get('gemini_pool', 'json') || [];

  const raw = ctx.body.geminiKeys ?? ctx.body.keys ?? ctx.body.geminiKey ?? ctx.body.key ?? '';
  const incoming = Array.isArray(raw) ? raw : String(raw).split(/[\r\n,;]+/);
  const existing = new Set(pool.map(item => item.key));
  let added = 0;

  for (const candidateValue of incoming) {
    const candidate = String(candidateValue || '').trim();
    if (!/^[A-Za-z0-9_.-]{30,120}$/.test(candidate) || candidate.startsWith('mk_') || existing.has(candidate)) continue;
    existing.add(candidate);
    added++;
    pool.push({
      id: `key_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`,
      key: candidate, // Kept strictly on server
      label: ctx.body.label || `مفتاح Gemini #${pool.length + 1}`,
      status: 'active',
      added_at: nowIso(),
      request_count: 0,
      error_count: 0,
      last_used: null,
      last_error: null,
      cooldown_until: null
    });
  }

  await saveGeminiPool(ctx.env, pool);
  await logAdminAudit(ctx, 'add_gemini_keys', 'gemini_pool', { added_count: added });

  const result = await getGeminiKeys(ctx.env);
  return json({ ...result, added_count: added, message: `تمت إضافة ${added} مفتاح إلى حوض التدوير بنجاح.` }, 200, ctx.headers);
}

async function adminToggleGeminiKey(ctx) {
  const account = await authenticate(ctx, true);
  const targetId = String(ctx.body.key_id || ctx.body.id || '');
  const enabled = Boolean(ctx.body.enabled);

  let pool = await getGeminiPool(ctx.env);
  const item = pool.find(x => x.id === targetId);
  if (!item) return json({ success: false, error: 'المفتاح غير موجود' }, 404, ctx.headers);

  item.status = enabled ? 'active' : 'disabled';
  if (enabled) {
    item.cooldown_until = null;
    item.last_error = null;
  }
  await saveGeminiPool(ctx.env, pool);
  await logAdminAudit(ctx, 'toggle_gemini_key', targetId, { enabled });

  return json({ success: true, message: `تم ${enabled ? 'تفعيل' : 'تعطيل'} المفتاح بنجاح.`, gemini_pool: (await getGeminiKeys(ctx.env)).gemini_pool }, 200, ctx.headers);
}

// 4. Stats & System Health Handlers
async function adminGetStats(ctx) {
  await authenticate(ctx, true);
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  // Tool usage metrics today
  const tools = ['images', 'voice', 'transcription', 'motion_ai', 'video'];
  const usageToday = {};
  for (const t of tools) {
    usageToday[t] = Number(await ctx.env.MICKEY_STATE.get(`stats:usage:${todayKey}:${t}`)) || 0;
  }
  const totalToday = Number(await ctx.env.MICKEY_STATE.get(`stats:usage:${todayKey}:total`)) || 0;

  // Pool summary
  const pool = await getGeminiPool(ctx.env);
  const activeCount = pool.filter(k => k.status === 'active').length;
  const exhaustedCount = pool.filter(k => k.status === 'exhausted').length;
  const disabledCount = pool.filter(k => k.status === 'disabled').length;

  const sysConfig = await getSystemConfig(ctx.env);
  const alertState = await ctx.env.MICKEY_STATE.get('system_alert_keys_exhausted', 'json');

  return json({
    success: true,
    today: todayKey,
    usage: {
      total: totalToday,
      by_tool: usageToday
    },
    key_health: {
      total: pool.length,
      active: activeCount,
      exhausted: exhaustedCount,
      disabled: disabledCount,
      alert: alertState || null
    },
    subscription_mode: Boolean(sysConfig.subscription_mode)
  }, 200, ctx.headers);
}

async function adminGetAuditLogs(ctx) {
  await authenticate(ctx, true);
  const logs = await ctx.env.MICKEY_STATE.get('admin_audit_logs', 'json') || [];
  return json({ success: true, count: logs.length, logs }, 200, ctx.headers);
}

async function adminSystemHealth(ctx) {
  const pool = await getGeminiPool(ctx.env);
  const activeKeys = pool.filter(x => x.status === 'active').length;
  const exhaustedKeys = pool.filter(x => x.status === 'exhausted').length;
  const sysConfig = await getSystemConfig(ctx.env);

  let healthStatus = 'healthy';
  let messageAr = 'كافة الأنظمة ومفاتيح الذكاء الاصطناعي تعمل بكفاءة عالية';
  if (pool.length > 0 && activeKeys === 0) {
    healthStatus = 'critical';
    messageAr = 'تحذير حرج: كافة مفاتيح Gemini مستهلكة الحصة حالياً!';
  } else if (exhaustedKeys > 0) {
    healthStatus = 'warning';
    messageAr = `تنبيه: يوجد ${exhaustedKeys} مفتاح في فترة انتظار الكوتا`;
  }

  return json({
    success: true,
    status: healthStatus,
    message: messageAr,
    keys: { total: pool.length, active: activeKeys, exhausted: exhaustedKeys },
    subscription_mode: Boolean(sysConfig.subscription_mode)
  }, 200, ctx.headers);
}

// ======================================================================
// LEGACY PROVIDER KEYS COMPATIBILITY
// ======================================================================
async function adminProviderKeys(ctx, save) {
  const account = await authenticate(ctx, true);
  let pool = await ctx.env.MICKEY_STATE.get('gemini_pool', 'json') || [];
  if (!save) return json(await getGeminiKeys(ctx.env), 200, ctx.headers);

  if (ctx.body.clearGemini) pool = [];
  const raw = ctx.body.geminiKeys ?? ctx.body.geminiKey ?? ctx.body.key ?? ctx.body.apiKey ?? '';
  const incoming = Array.isArray(raw) ? raw : String(raw).split(/[\r\n,;]+/);
  const existing = new Set(pool.map(item => item.key));
  let added = 0;

  for (const candidateValue of incoming) {
    const candidate = String(candidateValue || '').trim();
    if (!/^[A-Za-z0-9_.-]{30,120}$/.test(candidate) || candidate.startsWith('mk_') || existing.has(candidate)) continue;
    existing.add(candidate);
    added++;
    pool.push({
      id: `key_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`,
      key: candidate,
      label: ctx.body.label || `مفتاح #${pool.length + 1}`,
      status: 'active',
      added_at: nowIso(),
      request_count: 0,
      error_count: 0,
      last_used: null,
      last_error: null,
      cooldown_until: null
    });
  }

  await saveGeminiPool(ctx.env, pool);
  await logAdminAudit(ctx, 'save_provider_keys', 'gemini_pool', { added_count: added });
  const result = await getGeminiKeys(ctx.env);
  return json({ ...result, added_count: added }, 200, ctx.headers);
}

async function deleteGeminiKey(ctx) {
  const account = await authenticate(ctx, true);
  const target = String(ctx.body.key_id || ctx.body.id || ctx.body.key || '');
  let pool = await ctx.env.MICKEY_STATE.get('gemini_pool', 'json') || [];
  const next = pool.filter(item => item.id !== target && item.key !== target);
  if (next.length === pool.length) {
    return json({ success: false, message: 'لم يتم العثور على المفتاح المطلوب', gemini_pool: (await getGeminiKeys(ctx.env)).gemini_pool }, 200, ctx.headers);
  }
  await saveGeminiPool(ctx.env, next);
  await logAdminAudit(ctx, 'delete_gemini_key', target);
  return json({ success: true, message: 'تم حذف المفتاح من حوض التدوير بنجاح', gemini_pool: (await getGeminiKeys(ctx.env)).gemini_pool }, 200, ctx.headers);
}

async function testGeminiKey(ctx) {
  const account = await authenticate(ctx, true);
  const pool = await getGeminiPool(ctx.env);
  const item = pool.find(x => x.id === (ctx.body.key_id || ctx.body.id));
  const key = String(ctx.body.key || item?.key || '');
  if (!key) return json({ success: false, error: 'لم يتم تحديد مفتاح للفحص' }, 400, ctx.headers);

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 5 } })
  });

  if (item) {
    item.status = response.ok ? 'active' : response.status === 429 ? 'exhausted' : 'disabled';
    item.last_used = nowIso();
    if (!response.ok) {
      item.last_error = `HTTP ${response.status}`;
      if (response.status === 429) item.cooldown_until = Date.now() + 60000;
    } else {
      item.cooldown_until = null;
      item.last_error = null;
    }
    await saveGeminiPool(ctx.env, pool);
  }

  return json({
    success: response.ok,
    message: response.ok ? 'المفتاح يعمل بنجاح والصلاحية نشطة ✓' : undefined,
    error: response.ok ? undefined : (response.status === 429 ? 'تم استهلاك حصة هذا المفتاح (429 Quota Exceeded)' : 'مفتاح غير صالح أو معطل'),
    http_code: response.status,
    gemini_pool: (await getGeminiKeys(ctx.env)).gemini_pool
  }, 200, ctx.headers);
}

// ======================================================================
// DEVELOPER API KEYS
// ======================================================================
async function generateApiKey(ctx) {
  const account = await authenticate(ctx, true);
  const keys = await ctx.env.MICKEY_STATE.get('api_keys', 'json') || [];
  const entry = {
    id: `key_${Date.now()}`,
    key: `mk_live_${crypto.randomUUID().replaceAll('-', '')}`,
    name: String(ctx.body.name || 'مفتاح مطور جديد').slice(0, 100),
    created_at: nowIso(),
    last_used: null,
    requests_count: 0,
    status: 'active',
    uid: account.uid
  };
  keys.push(entry);
  await ctx.env.MICKEY_STATE.put('api_keys', JSON.stringify(keys));
  await logAdminAudit(ctx, 'generate_api_key', entry.id, { name: entry.name });
  return json({ success: true, message: 'تم إنشاء مفتاح API بنجاح', key: entry }, 200, ctx.headers);
}

async function listApiKeys(ctx) {
  const keys = await ctx.env.MICKEY_STATE.get('api_keys', 'json') || [];
  return json({ success: true, keys }, 200, ctx.headers);
}

async function revokeApiKey(ctx) {
  const target = ctx.body.key || ctx.body.id;
  const keys = await ctx.env.MICKEY_STATE.get('api_keys', 'json') || [];
  let changed = false;
  for (const item of keys) {
    if (item.key === target || item.id === target) {
      item.status = 'revoked';
      changed = true;
    }
  }
  if (changed) {
    await ctx.env.MICKEY_STATE.put('api_keys', JSON.stringify(keys));
    await logAdminAudit(ctx, 'revoke_api_key', target);
  }
  return json({ success: changed, message: changed ? 'تم إيقاف صلاحية المفتاح بنجاح' : 'لم يتم العثور على المفتاح' }, 200, ctx.headers);
}

function apiDocs(ctx) {
  return {
    title: 'Mickey Studio AI Gateway REST API',
    version: '4.5.0',
    description: 'بوابة الذكاء الاصطناعي الشاملة لإضافة Premiere Pro والموقع الإلكتروني.',
    base_url: `${ctx.url.origin}/api.php`,
    auth_format: 'Authorization: Bearer <ID_TOKEN> or X-API-Key: mk_live_...',
    endpoints: [
      'generate_tts', 'generate_image', 'transcribe_audio', 'enhance_prompt',
      'refine_voiceover', 'analyze_video_silence', 'motion_scene_submit', 'status'
    ]
  };
}

// ======================================================================
// EXTENSION PAIRING & MOTION SCENE SYNC
// ======================================================================
async function pairBegin(ctx) {
  const sessionToken = crypto.randomUUID().replaceAll('-', '');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const record = { code, sessionToken, status: 'pending', createdAt: Date.now(), expiresAt: Date.now() + 10 * 60 * 1000 };
  await ctx.env.MICKEY_STATE.put(`pair_code:${code}`, JSON.stringify(record), { expirationTtl: 600 });
  await ctx.env.MICKEY_STATE.put(`pair_session:${sessionToken}`, JSON.stringify(record), { expirationTtl: 600 });
  return json({ success: true, code, sessionToken, expiresIn: 600 }, 200, ctx.headers);
}

async function pairComplete(ctx) {
  const account = await authenticate(ctx);
  const code = String(ctx.body.code || '').trim();
  const refreshToken = String(ctx.body.refreshToken || '');
  const record = await ctx.env.MICKEY_STATE.get(`pair_code:${code}`, 'json');
  if (!record || record.expiresAt < Date.now()) {
    fail(400, 'رمز الاقتران غير صالح أو منتهي الصلاحية.');
  }
  record.status = 'confirmed';
  record.uid = account.uid;
  record.email = account.email;
  record.token = account.token;
  // Keep the durable Firebase credential needed by Premiere to refresh its
  // short-lived ID token after the initial link completes.
  record.refreshToken = refreshToken;
  await ctx.env.MICKEY_STATE.put(`pair_session:${record.sessionToken}`, JSON.stringify(record), { expirationTtl: 300 });
  await ctx.env.MICKEY_STATE.delete(`pair_code:${code}`);
  return json({ success: true, message: 'تم ربط الإضافة بالحساب بنجاح.' }, 200, ctx.headers);
}

async function pairPoll(ctx) {
  const sessionToken = String(ctx.body.sessionToken || ctx.url.searchParams.get('sessionToken') || '');
  if (!sessionToken) fail(400, 'معرف الجلسة مطلوب.');
  const record = await ctx.env.MICKEY_STATE.get(`pair_session:${sessionToken}`, 'json');
  if (!record) return json({ success: true, status: 'expired' }, 200, ctx.headers);
  if (record.status === 'confirmed') {
    await ctx.env.MICKEY_STATE.delete(`pair_session:${sessionToken}`);
    const deviceId = String(ctx.request.headers.get('X-Device-Id') || '').trim();
    if (deviceId) await ctx.env.MICKEY_STATE.put(`device_pair_grant:${record.uid}:${deviceId}`, '1', { expirationTtl: 600 });
    return json({
      success: true,
      status: 'confirmed',
      uid: record.uid,
      email: record.email,
      refreshToken: record.refreshToken || '',
      idToken: record.refreshToken ? undefined : record.token
    }, 200, ctx.headers);
  }
  return json({ success: true, status: 'pending' }, 200, ctx.headers);
}

function validateMotionScene(scene) {
  if (!scene || typeof scene !== 'object' || !Array.isArray(scene.elements)) {
    fail(400, 'هيكل المشهد غير صالح.');
  }
  return scene;
}

async function submitMotionScene(ctx) {
  const account = await authenticate(ctx);
  const scene = validateMotionScene(ctx.body.scene);
  const assetsBaseUrl = String(ctx.body.assetsBaseUrl || '').replace(/\/$/, '');
  const jobId = crypto.randomUUID();
  const record = { jobId, scene, assetsBaseUrl, status: 'pending', createdAt: Date.now(), expiresAt: Date.now() + 15 * 60 * 1000 };
  await ctx.env.MICKEY_STATE.put(`motion_scene:${account.uid}`, JSON.stringify(record), { expirationTtl: 900 });
  await recordToolUsageMetric(ctx.env, 'motion_ai', new Date().toISOString().slice(0, 10));
  return json({ success: true, jobId, status: 'pending', message: 'المشهد جاهز للاستلام من إضافة Premiere.' }, 200, ctx.headers);
}

async function pollMotionScene(ctx) {
  const account = await authenticate(ctx);
  const key = `motion_scene:${account.uid}`;
  const record = await ctx.env.MICKEY_STATE.get(key, 'json');
  if (!record || record.expiresAt < Date.now()) {
    if (record) await ctx.env.MICKEY_STATE.delete(key);
    return json({ success: true, status: 'empty' }, 200, ctx.headers);
  }
  return json({
    success: true,
    status: 'pending',
    jobId: record.jobId,
    scene: record.scene,
    assetsBaseUrl: record.assetsBaseUrl || '',
    audioAssetEndpoint: `${ctx.url.origin}${ctx.url.pathname}`,
    createdAt: record.createdAt
  }, 200, ctx.headers);
}

async function acknowledgeMotionScene(ctx) {
  const account = await authenticate(ctx);
  const key = `motion_scene:${account.uid}`;
  const record = await ctx.env.MICKEY_STATE.get(key, 'json');
  if (!record || record.jobId !== String(ctx.body.jobId || '')) {
    return json({ success: false, error: 'المشهد غير موجود أو تم استلامه مسبقاً.' }, 404, ctx.headers);
  }
  await ctx.env.MICKEY_STATE.delete(key);
  return json({ success: true, status: 'complete' }, 200, ctx.headers);
}

async function motionAudioAsset(ctx) {
  const kind = String(ctx.url.searchParams.get('kind') || '');
  const id = String(ctx.url.searchParams.get('id') || '');
  const musicIds = new Set(['social_upbeat', 'kids_playful', 'tech_corporate', 'luxury_ambient', 'cyber_drive', 'cinematic_inspire', 'stats_pulse']);
  const sfxIds = new Set(['whoosh', 'pop', 'click', 'riser', 'impact', 'sparkle', 'soft_whoosh', 'swipe', 'bass_hit', 'notification']);
  if (!['music', 'sfx'].includes(kind) || !(kind === 'music' ? musicIds : sfxIds).has(id)) {
    return json({ success: false, error: 'ملف صوتي غير معروف.' }, 404, ctx.headers);
  }
  const base = String(ctx.env.MOTION_AUDIO_BASE_URL || 'https://mickey-studio-eta.vercel.app/assets/motion-audio').replace(/\/+$/, '');
  const upstream = await fetch(`${base}/${kind}/${encodeURIComponent(id)}.wav`, { cf: { cacheTtl: 86400, cacheEverything: true } }).catch(() => null);
  if (!upstream?.ok) return json({ success: false, error: `ملف الصوت ${id} غير متاح حالياً.` }, 404, ctx.headers);
  const headers = new Headers(ctx.headers);
  headers.set('Content-Type', 'audio/wav');
  headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return new Response(await upstream.arrayBuffer(), { status: 200, headers });
}

// Workers AI FLUX image fallback
async function generateFluxImage(ctx) {
  const { request, env, body } = ctx;
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > 2048) {
    return json({ error: 'اكتب وصفًا للصورة لا يتجاوز 2048 حرفًا.' }, 400, ctx.headers);
  }
  const width = Number(body.width);
  const height = Number(body.height);
  const allowedSizes = new Set([720, 1024, 1280]);
  if (!allowedSizes.has(width) || !allowedSizes.has(height)) {
    return json({ error: 'الأبعاد المختارة غير مدعومة.' }, 400, ctx.headers);
  }
  if (!env.AI || typeof env.AI.run !== 'function') {
    return json({ error: 'ربط Workers AI غير موجود في النسخة المنشورة.' }, 503, ctx.headers);
  }
  try {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('width', String(width));
    form.append('height', String(height));
    const serializedForm = new Response(form);
    const result = await env.AI.run('@cf/black-forest-labs/flux-2-klein-4b', {
      multipart: {
        body: serializedForm.body,
        contentType: serializedForm.headers.get('content-type') || 'multipart/form-data'
      }
    });
    if (!result || typeof result.image !== 'string') {
      return json({ error: 'لم يُرجع نموذج FLUX صورة.' }, 502, ctx.headers);
    }
    const binary = atob(result.image);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    const cors = corsHeaders(request, env);
    return new Response(bytes, {
      status: 200,
      headers: { ...cors, 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    });
  } catch (error) {
    const message = String(error?.message || error || '');
    return json({ error: `تعذر التوليد عبر FLUX: ${message.slice(0, 200)}` }, 502, ctx.headers);
  }
}

function ensureToolPaywallTables(sql) {
  sql.exec(`
    CREATE TABLE IF NOT EXISTS tools (
      key TEXT PRIMARY KEY,
      name_ar TEXT NOT NULL,
      category TEXT NOT NULL,
      cost_type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS plan_tool_access (
      plan_id TEXT NOT NULL,
      tool_key TEXT NOT NULL,
      access TEXT NOT NULL CHECK (access IN ('full', 'limited', 'locked')),
      monthly_limit INTEGER,
      limit_unit TEXT NOT NULL DEFAULT 'month',
      PRIMARY KEY (plan_id, tool_key)
    );
    CREATE TABLE IF NOT EXISTS tool_usage (
      user_id TEXT NOT NULL,
      tool_key TEXT NOT NULL,
      period_key TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, tool_key, period_key)
    );
    CREATE TABLE IF NOT EXISTS user_tool_overrides (
      user_id TEXT NOT NULL,
      tool_key TEXT NOT NULL,
      access TEXT NOT NULL CHECK (access IN ('full', 'limited', 'locked')),
      PRIMARY KEY (user_id, tool_key)
    );
    CREATE TABLE IF NOT EXISTS user_plan_overrides (
      user_id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      user_id TEXT PRIMARY KEY,
      plan TEXT NOT NULL,
      started_at TEXT NOT NULL,
      expires_at TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
      source TEXT NOT NULL DEFAULT 'manual',
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tool_access_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      target TEXT NOT NULL,
      action TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export class MickeyCoordinatorDO {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const action = new URL(request.url).pathname.slice(1);
    const body = await request.json().catch(() => ({}));
    try {
      let result;
      if (action.startsWith('tool_') || action.startsWith('subscription_')) {
        const sql = this.state.storage.sql;
        if (!sql) return json({ success: false, error: 'مخزن SQLite غير متاح لصلاحيات الأدوات.' }, 503);
        ensureToolPaywallTables(sql);
        const seedTools = Array.isArray(body.tools) ? body.tools : [];
        const seedPlanRows = Array.isArray(body.planRows) ? body.planRows : [];
        for (const tool of seedTools) {
          sql.exec('INSERT OR IGNORE INTO tools (key, name_ar, category, cost_type, description) VALUES (?, ?, ?, ?, ?)', tool.key, tool.name_ar, tool.category, tool.cost_type, tool.description);
        }
        for (const row of seedPlanRows) {
          sql.exec('INSERT OR IGNORE INTO plan_tool_access (plan_id, tool_key, access, monthly_limit, limit_unit) VALUES (?, ?, ?, ?, ?)', row.plan_id, row.tool_key, row.access, row.monthly_limit ?? null, row.limit_unit || 'month');
        }

        if (action === 'tool_bootstrap') {
          result = { initialized: true };
        } else if (action === 'tool_config_get') {
          result = {
            tools: sql.exec('SELECT key, name_ar, category, cost_type, description FROM tools ORDER BY category, key').toArray(),
            access: sql.exec('SELECT plan_id, tool_key, access, monthly_limit, limit_unit FROM plan_tool_access ORDER BY plan_id, tool_key').toArray(),
            overrides: sql.exec('SELECT user_id, tool_key, access FROM user_tool_overrides ORDER BY user_id, tool_key').toArray(),
            planOverrides: sql.exec('SELECT user_id, plan_id FROM user_plan_overrides ORDER BY user_id').toArray(),
            audit: sql.exec('SELECT actor, target, action, details_json, created_at FROM tool_access_audit ORDER BY id DESC LIMIT 100').toArray()
          };
        } else if (action === 'tool_config_save') {
          const rows = Array.isArray(body.access) ? body.access : [];
          for (const row of rows) {
            sql.exec('INSERT INTO plan_tool_access (plan_id, tool_key, access, monthly_limit, limit_unit) VALUES (?, ?, ?, ?, ?) ON CONFLICT(plan_id, tool_key) DO UPDATE SET access=excluded.access, monthly_limit=excluded.monthly_limit, limit_unit=excluded.limit_unit', row.plan_id, row.tool_key, row.access, row.monthly_limit ?? null, row.limit_unit || 'month');
          }
          sql.exec('INSERT INTO tool_access_audit (actor, target, action, details_json, created_at) VALUES (?, ?, ?, ?, ?)', String(body.actor || ''), 'plan_tool_access', 'save_tool_access', JSON.stringify({ count: rows.length }), String(body.created_at || new Date().toISOString()));
          result = { saved: rows.length };
        } else if (action === 'tool_audit') {
          sql.exec('INSERT INTO tool_access_audit (actor, target, action, details_json, created_at) VALUES (?, ?, ?, ?, ?)', String(body.actor || ''), String(body.target || ''), String(body.action || ''), JSON.stringify(body.details || {}), String(body.created_at || new Date().toISOString()));
          result = { saved: true };
        } else if (action === 'tool_override_save') {
          const uid = String(body.user_id || '').trim();
          if (!uid) return json({ success: false, error: 'معرف المستخدم مطلوب.' }, 400);
          if (body.plan_id) sql.exec('INSERT INTO user_plan_overrides (user_id, plan_id) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET plan_id=excluded.plan_id', uid, String(body.plan_id));
          else if (body.clear_plan) sql.exec('DELETE FROM user_plan_overrides WHERE user_id=?', uid);
          const toolKey = String(body.tool_key || '').trim();
          if (toolKey && ['full', 'limited', 'locked'].includes(body.access)) {
            sql.exec('INSERT INTO user_tool_overrides (user_id, tool_key, access) VALUES (?, ?, ?) ON CONFLICT(user_id, tool_key) DO UPDATE SET access=excluded.access', uid, toolKey, body.access);
          } else if (toolKey && body.clear_access) {
            sql.exec('DELETE FROM user_tool_overrides WHERE user_id=? AND tool_key=?', uid, toolKey);
          }
          sql.exec('INSERT INTO tool_access_audit (actor, target, action, details_json, created_at) VALUES (?, ?, ?, ?, ?)', String(body.actor || ''), uid, 'user_override', JSON.stringify({ plan_id: body.plan_id || null, tool_key: toolKey || null, access: body.access || null, clear_plan: Boolean(body.clear_plan), clear_access: Boolean(body.clear_access) }), String(body.created_at || new Date().toISOString()));
          result = { saved: true };
        } else if (action === 'subscription_save') {
          const uid = String(body.user_id || body.uid || '').trim();
          if (!uid) return json({ success: false, error: 'معرف المستخدم مطلوب.' }, 400);
          sql.exec('INSERT INTO user_subscriptions (user_id, plan, started_at, expires_at, status, source, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan, started_at=excluded.started_at, expires_at=excluded.expires_at, status=excluded.status, source=excluded.source, notes=excluded.notes, updated_at=excluded.updated_at',
            uid,
            String(body.plan || 'free'),
            String(body.started_at || new Date().toISOString()),
            body.expires_at ? String(body.expires_at) : null,
            String(body.status || 'active'),
            String(body.source || 'manual'),
            String(body.notes || ''),
            String(body.updated_at || new Date().toISOString())
          );
          result = { saved: true };
        } else if (action === 'subscription_get') {
          const uid = String(body.user_id || body.uid || '').trim();
          const sub = sql.exec('SELECT user_id, plan, started_at, expires_at, status, source, notes, updated_at FROM user_subscriptions WHERE user_id=?', uid).toArray()[0] || null;
          result = { subscription: sub };
        } else if (action === 'tool_check' || action === 'tool_permissions') {
          const uid = String(body.uid || '');
          const configuredPlan = String(body.planId || '');
          const planOverride = sql.exec('SELECT plan_id FROM user_plan_overrides WHERE user_id=?', uid).toArray()[0];
          let activePlan = planOverride?.plan_id || configuredPlan;
          try {
            const subRow = sql.exec('SELECT plan, expires_at, status FROM user_subscriptions WHERE user_id=?', uid).toArray()[0];
            if (subRow) {
              const isExpired = subRow.expires_at && Date.now() > new Date(subRow.expires_at).getTime();
              if (subRow.status === 'cancelled' || isExpired) {
                activePlan = 'free';
              } else if (subRow.status === 'active' && subRow.plan) {
                activePlan = subRow.plan;
              }
            }
          } catch (_) {}
          const planId = planOverride?.plan_id || activePlan;
          const evaluate = toolKey => {
            const catalog = sql.exec('SELECT name_ar, category FROM tools WHERE key=?', toolKey).toArray()[0] || {};
            const row = sql.exec('SELECT access, monthly_limit, limit_unit FROM plan_tool_access WHERE plan_id=? AND tool_key=?', planId, toolKey).toArray()[0];
            const override = sql.exec('SELECT access FROM user_tool_overrides WHERE user_id=? AND tool_key=?', uid, toolKey).toArray()[0];
            let access = body.paywallEnabled ? (override?.access || row?.access || (catalog.category === 'local' ? 'full' : 'locked')) : 'full';
            const limit = access === 'limited' && row?.monthly_limit != null ? Number(row.monthly_limit) : null;
            const unit = String(row?.limit_unit || 'month');
            const period = String(unit === 'day' ? body.dayPeriod : body.period || '');
            const resetsAt = String(unit === 'day' ? body.dayResetsAt : body.monthResetsAt || '');
            let usage = sql.exec('SELECT used FROM tool_usage WHERE user_id=? AND tool_key=? AND period_key=?', uid, toolKey, period).toArray()[0];
            let used = Number(usage?.used || 0);
            if (action === 'tool_check' && access === 'limited' && limit != null && body.charge && used < limit) {
              used += 1;
              sql.exec('INSERT INTO tool_usage (user_id, tool_key, period_key, used, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, tool_key, period_key) DO UPDATE SET used=excluded.used, updated_at=excluded.updated_at', uid, toolKey, period, used, Date.now());
            }
            return { access, limit, used, resets_at: resetsAt, toolName: catalog.name_ar || toolKey, planId };
          };
          if (action === 'tool_check') result = evaluate(String(body.toolKey || ''));
          else {
            const toolRows = sql.exec('SELECT key FROM tools ORDER BY category, key').toArray();
            const tools = {};
            for (const row of toolRows) tools[row.key] = evaluate(row.key);
            result = { tools, planId };
          }
        } else {
          return json({ success: false, error: 'عملية صلاحيات الأدوات غير معروفة.' }, 404);
        }
      } else if (action === 'stage') {
        result = await this.state.storage.transaction(async txn => {
          if (await txn.get('pairConsumed') || await txn.get('pairResult')) return { staged: false };
          await txn.put('pairResult', body);
          return { staged: true };
        });
      } else if (action === 'consume') {
        result = await this.state.storage.transaction(async txn => {
          const value = await txn.get('pairResult');
          if (!value || await txn.get('pairConsumed')) return { consumed: false };
          await txn.put('pairConsumed', true);
          await txn.delete('pairResult');
          return { consumed: true, ...value };
        });
      } else if (action === 'rate' || action === 'rate2') {
        const now = Date.now();
        const minuteLimit = Number(body.minuteLimit || 60);
        const dayLimit = Number(body.dayLimit || 1000);
        if (this.state.storage.sql) {
          try {
            this.state.storage.sql.exec(`
              CREATE TABLE IF NOT EXISTS user_rate_limits (
                bucket TEXT PRIMARY KEY,
                count INTEGER,
                updated_at INTEGER
              );
            `);
            const minuteWindow = Math.floor(now / 60000);
            const dayWindow = new Date(now).toISOString().slice(0, 10);
            const minuteKey = `m:${minuteWindow}`;
            const dayKey = `d:${dayWindow}`;

            this.state.storage.sql.exec(`DELETE FROM user_rate_limits WHERE updated_at < ?;`, now - 172800000);

            let mRow = this.state.storage.sql.exec(`SELECT count FROM user_rate_limits WHERE bucket = ?;`, minuteKey).toArray()[0];
            const mCount = (mRow ? Number(mRow.count) : 0) + 1;
            this.state.storage.sql.exec(`INSERT OR REPLACE INTO user_rate_limits (bucket, count, updated_at) VALUES (?, ?, ?);`, minuteKey, mCount, now);

            let dRow = this.state.storage.sql.exec(`SELECT count FROM user_rate_limits WHERE bucket = ?;`, dayKey).toArray()[0];
            const dCount = (dRow ? Number(dRow.count) : 0) + 1;
            this.state.storage.sql.exec(`INSERT OR REPLACE INTO user_rate_limits (bucket, count, updated_at) VALUES (?, ?, ?);`, dayKey, dCount, now);

            const allowed = mCount <= minuteLimit && dCount <= dayLimit;
            const window = dCount > dayLimit ? 'day' : (mCount > minuteLimit ? 'minute' : 'ok');
            result = { allowed, window, minuteCount: mCount, dayCount: dCount };
          } catch (sqlErr) {
            console.warn('[CoordinatorDO:SQL] fallback to txn:', sqlErr);
          }
        }
        if (!result) {
          result = await this.state.storage.transaction(async txn => {
            const minuteWindow = Math.floor(now / 60000);
            const dayWindow = new Date(now).toISOString().slice(0, 10);
            const minuteKey = `minute:${minuteWindow}`;
            const dayKey = `day:${dayWindow}`;
            const minute = Number(await txn.get(minuteKey) || 0) + 1;
            const day = Number(await txn.get(dayKey) || 0) + 1;
            await txn.put(minuteKey, minute);
            await txn.put(dayKey, day);
            await txn.delete(`minute:${minuteWindow - 1}`);
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            await txn.delete(`day:${yesterday}`);
            return { allowed: minute <= minuteLimit && day <= dayLimit, window: day > dayLimit ? 'day' : 'minute', minuteCount: minute, dayCount: day };
          });
        }
      } else if (action === 'guest') {
        const now = Date.now();
        result = await this.state.storage.transaction(async txn => {
          const today = new Date(now).toISOString().slice(0, 10);
          let state = await txn.get('guest') || { count: 0, permits: {}, day: today };
          if (state.day !== today) state = { count: 0, permits: {}, day: today };
          const used = Number(state.count) || 0;
          if (body.action !== 'consume_generation' && body.permitHash) {
            const permit = state.permits?.[body.permitHash];
            if (permit?.tool === body.tool && permit.expires > now) {
              delete state.permits[body.permitHash];
              await txn.put('guest', state);
              return { allowed: true, count: used };
            }
          }
          if (used + body.count > 5) return { allowed: false, count: used };
          state.count = used + body.count;
          let permit;
          if (body.action === 'consume_generation') {
            permit = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
            state.permits ||= {};
            const digest = await sha256(permit);
            state.permits[digest] = { tool: body.tool, expires: now + 90000 };
          }
          await txn.put('guest', state);
          return { allowed: true, count: state.count, permit };
        });
      } else if (action === 'device_add') {
        result = await this.state.storage.transaction(async txn => {
          const devices = await txn.get('devices') || [];
          if (devices.some(item => item.deviceId === body.deviceId)) return { added: false };
          devices.push({ deviceId: body.deviceId, name: body.name, email: body.email, createdAt: body.createdAt, tokenHash: body.tokenHash });
          await txn.put('devices', devices);
          return { added: true };
        });
      } else if (action === 'device_list') {
        const devices = await this.state.storage.get('devices') || [];
        result = { devices: devices.map(({ tokenHash, ...device }) => ({ ...device, tokenHash: undefined })) };
      } else if (action === 'device_check') {
        const devices = await this.state.storage.get('devices') || [];
        result = { active: devices.some(item => item.deviceId === body.deviceId && item.tokenHash === body.tokenHash) };
      } else if (action === 'device_revoke') {
        result = await this.state.storage.transaction(async txn => {
          const devices = await txn.get('devices') || [];
          const target = devices.find(item => item.deviceId === body.deviceId);
          if (!target) return { revoked: false };
          await txn.put('devices', devices.filter(item => item.deviceId !== body.deviceId));
          return { revoked: true, tokenHash: target.tokenHash };
        });
      } else {
        return json({ success: false, error: 'Unknown coordinator operation.' }, 404);
      }
      return json({ success: true, ...result }, 200);
    } catch (error) {
      return json({ success: false, error: error?.message || 'Coordinator operation failed.' }, 500);
    }
  }
}
