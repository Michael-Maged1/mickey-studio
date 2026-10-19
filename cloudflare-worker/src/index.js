const FIREBASE_PROJECT = 'mickey-gemini-studio';
const DEFAULT_FIREBASE_API_KEY = 'AIzaSyAbwmXwJkb5nl2sUDCZ0ing_cWs0lbYAWg';
const ADMIN_EMAIL = 'michaelmagednew@gmail.com';
const GEMINI_TTS_MODEL = 'gemini-3.8-flash-tts';
const API_VERSION = 'v1.1.0';

const MAX_JSON_BODY_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_SCENE_BODY_SIZE = 6 * 1024 * 1024; // 6 MB for motion scene payloads
const MAX_BINARY_BODY_SIZE = 50 * 1024 * 1024; // 50 MB

// Explicit public actions that do not require an authenticated user session
const PUBLIC_ACTIONS = new Set([
  'status',
  'health',
  'api_docs',
  'pair_begin',
  'pair_poll',
  'pair2_start',
  'pair2_poll',
  'motion_audio_asset',
  'client_error',
  'client_log'
]);

// Generation actions protected by enforceGenerationAccess (Token, API Key, or Guest permit)
const GENERATION_ACTIONS = new Set([
  'generate_image',
  'generate_text',
  'enhance_prompt',
  'refine_voiceover',
  'generate_tts',
  'transcribe_audio',
  'analyze_video_silence',
  'detect_viral_clips',
  'generate_chapters',
  'detect_censor_words',
  'motion_scene_submit',
  'motion_ai_generate',
  'motion_ai_edit',
  'motion_ai_suggest',
  'consume_generation'
]);

// Admin-only actions strictly requiring server-verified custom claim
const ADMIN_ACTIONS = new Set([
  'admin_get_provider_keys',
  'admin_save_provider_keys',
  'admin_delete_gemini_key',
  'admin_test_gemini_key',
  'admin_reset_gemini_key_cooldown',
  'admin_verify',
  'generate_api_key',
  'list_api_keys',
  'revoke_api_key'
]);

// Free Plan Tool Daily Limits (configurable via Cloudflare Dashboard env vars)
const DEFAULT_FREE_TOOL_LIMITS = {
  images: 20,         // 20 image generations per day
  voice: 30,          // 30 TTS voice generations per day
  transcription: 15,  // 15 transcription & audio/video analyses per day
  motion: 10          // 10 motion AI scene submissions per day
};

function getToolLimits(env = {}) {
  return {
    images: Number(env.LIMIT_IMAGES) || DEFAULT_FREE_TOOL_LIMITS.images,
    voice: Number(env.LIMIT_VOICE) || DEFAULT_FREE_TOOL_LIMITS.voice,
    transcription: Number(env.LIMIT_TRANSCRIPTION) || DEFAULT_FREE_TOOL_LIMITS.transcription,
    motion: Number(env.LIMIT_MOTION) || DEFAULT_FREE_TOOL_LIMITS.motion
  };
}

function actionToTool(action) {
  if (action === 'generate_image' || action === 'generate_flux') return 'images';
  if (action === 'generate_tts' || action === 'refine_voiceover') return 'voice';
  if (['transcribe_audio', 'analyze_video_silence', 'detect_viral_clips', 'generate_chapters', 'detect_censor_words'].includes(action)) return 'transcription';
  if (['motion_scene_submit', 'motion_ai_generate', 'motion_ai_edit', 'motion_ai_suggest'].includes(action)) return 'motion';
  if (action === 'generate_text' || action === 'enhance_prompt') return 'images';
  return null;
}

export default {
  async fetch(request, env) {
    const requestId = request.headers.get('cf-ray') || crypto.randomUUID();
    const origin = request.headers.get('Origin') || '';
    const isOptions = request.method === 'OPTIONS';

    const cors = corsHeaders(request, env);
    const originAllowed = isOriginAllowed(origin, env);

    // Preflight handling: reject unauthorized origins with 403
    if (isOptions) {
      if (origin && !originAllowed) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const url = new URL(request.url);

      // 1. Dedicated /health endpoint (Requirement 4)
      if (url.pathname === '/health') {
        return json({
          success: true,
          status: 'healthy',
          service: 'Mickey Studio AI Gateway',
          api_version: API_VERSION,
          timestamp: nowIso(),
          uptime: 'ok'
        }, 200, cors, requestId);
      }

      // 2. Request body size guard (Requirement 1)
      const contentLength = Number(request.headers.get('Content-Length') || 0);
      const queryAction = url.searchParams.get('action') || '';
      const isBinarySilenceRequest = request.method === 'POST' && queryAction === 'analyze_video_silence' && /^(?:video|audio)\//i.test(request.headers.get('Content-Type') || '');
      const maxLimit = isBinarySilenceRequest
        ? MAX_BINARY_BODY_SIZE
        : (queryAction === 'motion_scene_submit' ? MAX_SCENE_BODY_SIZE : MAX_JSON_BODY_SIZE);

      if (contentLength > maxLimit) {
        fail(413, `حجم الطلب (${Math.round(contentLength / 1024)}KB) يتجاوز الحد المسموح به (${Math.round(maxLimit / 1024)}KB).`, 'PAYLOAD_TOO_LARGE');
      }

      const body = request.method === 'POST' && !isBinarySilenceRequest
        ? await request.json().catch(() => ({}))
        : {};

      const rawAction = queryAction || body.action || (url.pathname === '/generate' ? 'generate_flux' : 'status');
      const action = String(rawAction || 'status').trim();

      // Input validation on action name
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(action)) {
        fail(400, 'اسم الإجراء المطلوب غير صالح.', 'INVALID_ACTION');
      }

      const headers = { ...cors, 'Cache-Control': 'no-store', 'Pragma': 'no-cache' };
      const context = { request, env, url, body, action, headers, requestId, rawVideoStream: isBinarySilenceRequest ? request.body : null };

      if (url.pathname === '/generate' || action === 'generate_flux') {
        context.access = await enforceGenerationAccess(context);
        return await generateFluxImage(context);
      }

      // 3. Enforce Authentication on non-public actions (Requirement 1 & 3)
      if (!PUBLIC_ACTIONS.has(action)) {
        if (GENERATION_ACTIONS.has(action)) {
          context.access = await enforceGenerationAccess(context);
        } else if (ADMIN_ACTIONS.has(action)) {
          context.account = await authenticate(context, true);
        } else {
          context.account = await authenticate(context, false);
        }
      }

      switch (action) {
        case 'health':
          return json({
            success: true,
            status: 'healthy',
            service: 'Mickey Studio AI Gateway',
            api_version: API_VERSION,
            timestamp: nowIso(),
            uptime: 'ok'
          }, 200, headers, requestId);

        case 'status':
          return json({
            success: true,
            status: 'online',
            server: 'Mickey Studio AI Gateway',
            version: '4.3.0',
            api_version: API_VERSION,
            features: {
              raw_video_silence_upload: true,
              pcm_wav_silence_analysis: true,
              server_verified_admin: true,
              strict_cors: true
            },
            endpoints: [
              'health', 'status', 'generate_tts', 'enhance_prompt', 'transcribe_audio',
              'analyze_video_silence', 'detect_viral_clips', 'generate_chapters',
              'detect_censor_words', 'generate_image', 'refine_voiceover', 'admin_verify'
            ]
          }, 200, headers, requestId);

        case 'get_gemini_keys':
        case 'get_gemini_key':
          return json(await getGeminiKeys(env), 200, headers, requestId);

        case 'generate_tts': return await generateTts(context);
        case 'generate_text': return await generateText(context);
        case 'save_gemini_key': return await saveUserGeminiKey(context);
        case 'generate_image': return await generateImage(context);
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
            remaining: context.access?.remaining,
            plan: context.access?.account ? 'free' : 'guest',
            permit: context.access?.permit || undefined
          }, 200, headers, requestId);

        case 'account_status':
          return json({
            success: true,
            uid: context.account.uid,
            email: context.account.email,
            status: context.account.status,
            deviceId: context.account.deviceId || null,
            isAdmin: Boolean(context.account.isAdmin),
            plan: 'free'
          }, 200, headers, requestId);

        case 'pair_begin': return await pairBegin(context);
        case 'pair_complete': return await pairComplete(context);
        case 'pair_poll': return await pairPoll(context);
        case 'pair2_start': return await pair2Start(context);
        case 'pair2_complete': return await pair2Complete(context);
        case 'pair2_poll': return await pair2Poll(context);
        case 'device_list': return await listDevices(context);
        case 'device_revoke': return await revokeDevice(context);
        case 'motion_scene_submit': return await submitMotionScene(context);
        case 'motion_scene_poll': return await pollMotionScene(context);
        case 'motion_scene_ack': return await acknowledgeMotionScene(context);
        case 'motion_scene_extend_ttl': return await extendMotionSceneTtl(context);
        case 'user_recent_assets': return await handleUserRecentAssets(context);
        case 'motion_audio_asset': return await motionAudioAsset(context);
        case 'motion_ai_generate': return await motionAiGenerate(context);
        case 'motion_ai_edit': return await motionAiEdit(context);
        case 'motion_ai_suggest': return await motionAiSuggest(context);
        case 'client_error':
        case 'client_log': return await handleClientErrorLog(context);

        case 'get_user_quotas': return await getUserQuotas(context);
        case 'admin_reset_gemini_key_cooldown': return await resetGeminiKeyCooldown(context);

        case 'admin_verify':
          return json({
            success: true,
            verified: true,
            admin: true,
            uid: context.account.uid,
            email: context.account.email,
            claims: { admin: true }
          }, 200, headers, requestId);

        case 'admin_get_provider_keys': return await adminProviderKeys(context, false);
        case 'admin_save_provider_keys': return await adminProviderKeys(context, true);
        case 'admin_delete_gemini_key': return await deleteGeminiKey(context);
        case 'admin_test_gemini_key': return await testGeminiKey(context);
        case 'generate_api_key': return await generateApiKey(context);
        case 'list_api_keys': return await listApiKeys(context);
        case 'revoke_api_key': return await revokeApiKey(context);
        case 'api_docs': return json(apiDocs(context), 200, headers, requestId);
        default: return json({ success: false, error: `الإجراء غير مدعوم: ${action}`, code: 'UNKNOWN_ACTION' }, 404, headers, requestId);
      }
    } catch (error) {
      const headers = { ...cors, 'Cache-Control': 'no-store' };
      const rawMsg = error?.publicMessage || (error?.status ? error.message : 'حدث خطأ أثناء الاتصال بخدمة Mickey Studio.');
      // Never leak stack traces, internal URLs, or API keys
      const safeMsg = String(rawMsg || '')
        .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]')
        .replace(/https:\/\/[^\s]+/g, '[REDACTED_ENDPOINT]');

      const statusCode = Number(error?.status) || 500;
      const errorCode = error?.code || (
        statusCode === 400 ? 'INVALID_INPUT' :
        statusCode === 401 ? 'UNAUTHORIZED' :
        statusCode === 403 ? 'FORBIDDEN' :
        statusCode === 404 ? 'NOT_FOUND' :
        statusCode === 413 ? 'PAYLOAD_TOO_LARGE' :
        statusCode === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR'
      );

      return json({
        success: false,
        error: safeMsg,
        code: errorCode,
        requestId,
        api_version: API_VERSION,
        ...(error?.quota ? { quota: error.quota, remaining: 0 } : {})
      }, statusCode, headers, requestId);
    }
  }
};

function isOriginAllowed(origin, env) {
  if (!origin) return false;
  if (origin === 'null') return true; // file:// / local CEP panel iframe

  // 1. Configured origins
  const configured = (env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || 'https://mickey-studio-eta.vercel.app')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return true;

  // 2. Dev localhost origins
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin)) return true;

  // 3. Vercel deployment preview origins
  if (/^https:\/\/[a-z0-9-]+(?:\.vercel\.app)$/i.test(origin)) return true;

  // 4. Adobe CEP & browser extension schemes
  if (/^chrome-extension:\/\/[a-p]{32}$/i.test(origin)) return true;
  if (/^moz-extension:\/\//i.test(origin)) return true;
  if (/^uxp:\/\//i.test(origin)) return true;

  return false;
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin, env);

  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key, X-Anonymous-ID, X-Generation-Permit',
    'Access-Control-Expose-Headers': 'X-TTS-Engine, X-Request-ID, X-API-Version, X-Quota-Remaining, X-Quota-Limit',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };

  if (allowed) {
    headers['Access-Control-Allow-Origin'] = origin === 'null' ? '*' : origin;
  }
  // Notice: If NOT allowed, Access-Control-Allow-Origin is omitted, strictly disallowing cross-origin access.

  return headers;
}

function json(data, status = 200, headers = {}, requestId = '', ctx = null) {
  const h = new Headers(headers || {});
  h.set('Content-Type', 'application/json; charset=utf-8');
  if (requestId) h.set('X-Request-ID', requestId);
  h.set('X-API-Version', API_VERSION);

  let payload = data;
  if (data && typeof data === 'object') {
    const quota = data.quota || ctx?.access?.quota || ctx?.quota;
    const remaining = data.remaining !== undefined
      ? data.remaining
      : (quota?.remaining !== undefined ? quota.remaining : ctx?.access?.remaining);

    if (quota && quota.remaining !== undefined) {
      h.set('X-Quota-Remaining', String(quota.remaining));
      h.set('X-Quota-Limit', String(quota.limit || 0));
    }

    payload = {
      api_version: API_VERSION,
      ...(requestId ? { requestId } : {}),
      ...(quota ? { quota } : {}),
      ...(remaining !== undefined ? { remaining } : {}),
      ...data
    };
  }
  return new Response(JSON.stringify(payload), { status, headers: h });
}

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
    return json({ error: 'ربط Workers AI غير موجود في النسخة المنشورة. أعد نشر العامل مع AI binding.' }, 503, ctx.headers);
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
      return json({ error: 'لم يُرجع نموذج FLUX صورة. أعد المحاولة.' }, 502, ctx.headers);
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
    const isQuota = /quota|neuron|daily limit|exceed/i.test(message);
    console.error('[Workers AI FLUX] Inference failed:', message.slice(0, 500));
    return json({ error: isQuota
      ? 'تم استهلاك الحصة اليومية المجانية في Cloudflare Workers AI.'
      : `تعذر الاتصال بنموذج Cloudflare AI: ${message.slice(0, 220) || 'خطأ غير معروف'}`
    }, isQuota ? 429 : 502, ctx.headers);
  }
}

function fail(status, publicMessage) { const e = new Error(publicMessage); e.status = status; e.publicMessage = publicMessage; throw e; }
function nowIso() { return new Date().toISOString(); }
function envFirebaseKey(env) { return env.FIREBASE_WEB_API_KEY || DEFAULT_FIREBASE_API_KEY; }

async function readJson(response) { return response.json().catch(() => ({})); }
async function firebaseLookup(token, env) {
  if (!token) fail(401, 'سجّل الدخول أولاً.');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(envFirebaseKey(env))}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token })
  });
  const data = await readJson(response);
  const user = data.users?.[0];
  if (!response.ok || !user?.localId) fail(401, 'جلسة تسجيل الدخول غير صالحة. سجّل الدخول من جديد.');
  if (user.disabled) fail(403, 'هذا الحساب موقوف من إدارة Mickey Studio.');
  return user;
}
async function authenticate(ctx, adminOnly = false) {
  const token = bearer(ctx.request) || String(ctx.body.idToken || '');
  if (/^msd[2]?[_-][a-f0-9]{64}$/i.test(token) || /^msd_[a-f0-9]{64}$/i.test(token)) {
    const tokenHash = await sha256(token);
    const device = await ctx.env.MICKEY_STATE.get(`device_token:${tokenHash}`, 'json');
    if (!device || device.revokedAt) fail(401, 'تم إلغاء ربط هذا الجهاز. أعد ربط الإضافة من الموقع.');
    if (adminOnly) fail(403, 'هذه العملية متاحة لمسؤول الموقع فقط.');
    const live = await coordinatorRequest(ctx.env, `user:${device.userId}`, 'device_check', { deviceId: device.deviceId, tokenHash });
    if (!live.active) fail(401, 'تم إلغاء ربط هذا الجهاز. أعد ربط الإضافة من الموقع.');
    device.lastUsed = nowIso();
    ctx.env.MICKEY_STATE.put(`device_token:${tokenHash}`, JSON.stringify(device)).catch(() => {});
    return { uid: device.userId, email: device.email || '', isAdmin: false, status: 'active', deviceId: device.deviceId, deviceToken: true, version: device.version || 2 };
  }
  const user = await firebaseLookup(token, ctx.env);
  let customClaims = {};
  if (user.customAttributes) {
    try {
      customClaims = typeof user.customAttributes === 'string'
        ? JSON.parse(user.customAttributes)
        : user.customAttributes;
    } catch (_) {
      customClaims = {};
    }
  }
  const hasAdminClaim = Boolean(
    customClaims.admin === true ||
    customClaims.role === 'admin' ||
    customClaims.isAdmin === true
  );
  const isBootstrapEmail = String(user.email || '').toLowerCase() === (ctx.env.ADMIN_EMAIL || ADMIN_EMAIL).toLowerCase();
  const isAdmin = Boolean(hasAdminClaim || isBootstrapEmail);

  if (adminOnly && !isAdmin) {
    fail(403, 'هذه العملية متاحة لمسؤول الموقع فقط (Admin Custom Claim مطلوب).', 'ADMIN_CLAIM_REQUIRED');
  }

  const doc = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(user.localId)}`, { headers: { Authorization: `Bearer ${token}` } });
  const profile = await readJson(doc);
  if (!doc.ok) {
    if (isAdmin) {
      return {
        uid: user.localId, email: user.email || '', isAdmin: true, hasAdminClaim, status: 'active', token, customClaims,
        geminiApiKey: '', geminiProviderKeysJson: ''
      };
    }
    fail(403, 'تعذر التحقق من ملف الحساب. تأكد من نشر قواعد Firestore ثم أعد تسجيل الدخول.', 'PROFILE_FETCH_FAILED');
  }
  const status = profile.fields?.status?.stringValue || 'active';
  if (status !== 'active') fail(403, 'هذا الحساب موقوف من إدارة Mickey Studio.', 'ACCOUNT_SUSPENDED');
  return {
    uid: user.localId, email: user.email || '', isAdmin, hasAdminClaim, status, token, customClaims,
    geminiApiKey: profile.fields?.geminiApiKey?.stringValue || '',
    geminiProviderKeysJson: profile.fields?.geminiProviderKeysJson?.stringValue || ''
  };
}
function bearer(request) { const value = request.headers.get('Authorization') || ''; return value.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || ''; }
function apiToken(ctx) { return bearer(ctx.request) || ctx.request.headers.get('X-API-Key') || ctx.url.searchParams.get('api_key') || ''; }

const KEY_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown on 429/403

async function enforceGenerationAccess(ctx) {
  const action = ctx.action;
  const apiKey = apiToken(ctx);
  if (apiKey.startsWith('mk_')) {
    const keys = await ctx.env.MICKEY_STATE.get('api_keys', 'json') || [];
    if (keys.some(item => item.key === apiKey && item.status !== 'revoked')) {
      const quota = { tool: 'developer', unlimited: true, limit: 10000, remaining: 9999, used: 0 };
      ctx.quota = quota;
      return { account: { plan: 'api_developer' }, quota, remaining: 9999 };
    }
    fail(403, 'مفتاح API غير صالح أو تم إلغاؤه.');
  }

  const token = bearer(ctx.request) || String(ctx.body.idToken || '');
  if (token) {
    const account = await authenticate(ctx);

    // Admin accounts have unlimited quota
    if (account.isAdmin) {
      const tool = actionToTool(action) || 'general';
      const quota = { tool, unlimited: true, limit: 99999, remaining: 99999, used: 0 };
      ctx.quota = quota;
      return { account, quota, remaining: 99999 };
    }

    // Free plan users: Atomic per-tool daily quota via SQLite Durable Object
    const tool = actionToTool(action);
    let toolQuota = null;

    if (tool) {
      const limits = getToolLimits(ctx.env);
      const limit = limits[tool];
      const quotaRes = await coordinatorRequest(ctx.env, `user:${account.uid}`, 'tool_quota', {
        userId: account.uid,
        tool,
        limit,
        increment: action !== 'consume_generation'
      });

      if (!quotaRes.allowed) {
        const toolNamesAr = {
          images: 'توليد الصور',
          voice: 'التعليق الصوتي',
          transcription: 'التفريغ وتحليل الفيديو',
          motion: 'صناعة مشاهد الموشن'
        };
        const toolName = toolNamesAr[tool] || 'هذه الأداة';
        const hoursAr = quotaRes.resetInHours === 1 ? 'ساعة واحدة' : (quotaRes.resetInHours === 2 ? 'ساعتين' : `${quotaRes.resetInHours} ساعات`);
        const msg = `لقد استهلكت حد ${toolName} اليومي المجاني بالكامل (${quotaRes.limit}/${quotaRes.limit}). يتجدد رصيدك تلقائيًا عند منتصف الليل بتوقيت UTC (خلال ${hoursAr} تقريبًا).`;
        const err = new Error(msg);
        err.status = 429;
        err.code = 'QUOTA_EXCEEDED';
        err.quota = {
          tool,
          limit: quotaRes.limit,
          used: quotaRes.used,
          remaining: 0,
          reset_at: quotaRes.resetAt,
          reset_in_hours: quotaRes.resetInHours
        };
        throw err;
      }

      toolQuota = {
        tool,
        limit: quotaRes.limit,
        used: quotaRes.used,
        remaining: quotaRes.remaining,
        reset_at: quotaRes.resetAt,
        reset_in_hours: quotaRes.resetInHours
      };
      ctx.quota = toolQuota;
    }

    // High-frequency rate limiter guard (applied only to NEW v2 requests with deviceToken)
    if (account.deviceToken || account.version === 2) {
      const rate = await coordinatorRequest(ctx.env, `user:${account.uid}`, 'rate2', { minuteLimit: 60, dayLimit: 2000 });
      if (!rate.allowed) {
        if (rate.window === 'day') {
          fail(429, 'تجاوزت الحد اليومي الأقصى للطلبات (2000 طلب/يوم). يتجدد رصيدك عند منتصف الليل بتوقيت UTC.');
        } else {
          fail(429, 'طلبات كثيرة خلال دقيقة واحدة (أكثر من 60 طلباً في الدقيقة). انتظر قليلًا ثم أعد المحاولة.');
        }
      }
    }

    return { account, quota: toolQuota, remaining: toolQuota?.remaining ?? null };
  }

  // Guest permit logic
  const anonymousId = ctx.request.headers.get('X-Anonymous-ID') || '';
  if (!/^[a-f0-9]{32,96}$/i.test(anonymousId)) fail(400, 'تعذر بدء جلسة الضيف. أعد تحميل الموقع وحاول مرة أخرى.');
  const ip = ctx.request.headers.get('CF-Connecting-IP') || '';
  const digest = await sha256(`${anonymousId}|${ip}`);
  const key = `guest:${digest}`;
  const count = Math.min(20, Math.max(1, Number(ctx.body.count) || 1));
  const tool = ({ generate_image: 'image', generate_tts: 'voiceover', transcribe_audio: 'transcription', analyze_video_silence: 'transcription', enhance_prompt: 'prompt', refine_voiceover: 'voiceover' })[action] || ctx.body.tool || action;
  const permitHeader = ctx.request.headers.get('X-Generation-Permit') || '';
  const permitHash = permitHeader ? await sha256(permitHeader) : '';
  const permitValue = action !== 'consume_generation' ? permitHash : '';
  const result = await coordinatorRequest(ctx.env, key, 'guest', { action, tool, count, permitHash: permitValue });
  if (!result.allowed) fail(429, 'استخدمت محاولات الضيف الخمس بالكامل. أنشئ حسابًا مجانيًا للمتابعة مع حصص يومية متجددة.');
  const guestRemaining = Math.max(0, 5 - result.count);
  const guestQuota = { tool, limit: 5, used: result.count, remaining: guestRemaining };
  ctx.quota = guestQuota;
  return { account: null, quota: guestQuota, remaining: guestRemaining, permit: result.permit };
}

async function getUserQuotas(ctx) {
  const token = bearer(ctx.request) || String(ctx.body?.idToken || '');
  if (!token) {
    const anonymousId = ctx.request.headers.get('X-Anonymous-ID') || '';
    let guestUsed = 0;
    if (/^[a-f0-9]{32,96}$/i.test(anonymousId)) {
      const ip = ctx.request.headers.get('CF-Connecting-IP') || '';
      const digest = await sha256(`${anonymousId}|${ip}`);
      const guestState = await coordinatorRequest(ctx.env, `guest:${digest}`, 'guest_status', {});
      guestUsed = Number(guestState?.count) || 0;
    }
    const guestRemaining = Math.max(0, 5 - guestUsed);
    return json({
      success: true,
      plan: 'guest',
      quotas: {
        images: { limit: 5, used: guestUsed, remaining: guestRemaining },
        voice: { limit: 5, used: guestUsed, remaining: guestRemaining },
        transcription: { limit: 5, used: guestUsed, remaining: guestRemaining },
        motion: { limit: 5, used: guestUsed, remaining: guestRemaining }
      }
    }, 200, ctx.headers, ctx.requestId);
  }

  const account = await authenticate(ctx);
  if (account.isAdmin) {
    return json({
      success: true,
      plan: 'admin',
      unlimited: true,
      quotas: {
        images: { limit: 99999, used: 0, remaining: 99999, unlimited: true },
        voice: { limit: 99999, used: 0, remaining: 99999, unlimited: true },
        transcription: { limit: 99999, used: 0, remaining: 99999, unlimited: true },
        motion: { limit: 99999, used: 0, remaining: 99999, unlimited: true }
      }
    }, 200, ctx.headers, ctx.requestId);
  }

  const limits = getToolLimits(ctx.env);
  const quotas = await coordinatorRequest(ctx.env, `user:${account.uid}`, 'get_all_tool_quotas', {
    userId: account.uid,
    limits
  });

  return json({
    success: true,
    plan: 'free',
    quotas
  }, 200, ctx.headers, ctx.requestId);
}

async function reportKeyResult(env, key, success, errorInfo = {}) {
  if (!key || key.startsWith('mk_')) return;
  try {
    let pool = await env.MICKEY_STATE.get('gemini_pool', 'json') || [];
    const item = pool.find(x => x.key === key);
    if (!item) return;

    item.requests_count = (Number(item.requests_count) || 0) + 1;
    if (success) {
      item.success_count = (Number(item.success_count) || 0) + 1;
      item.last_success_at = nowIso();
      if (item.status === 'cooling_down' && (!item.cooldown_until || Date.now() >= item.cooldown_until)) {
        item.status = 'active';
        item.cooldown_until = 0;
      }
    } else {
      item.error_count = (Number(item.error_count) || 0) + 1;
      const status = Number(errorInfo.status) || 0;
      const message = String(errorInfo.message || `HTTP ${status || 500}`);
      item.last_error = message.slice(0, 200);
      item.last_error_at = nowIso();

      const isQuotaOrAuth = status === 429 || status === 403 || /quota|exhausted|rate limit|resource/i.test(message);
      if (isQuotaOrAuth) {
        item.status = 'cooling_down';
        item.cooldown_until = Date.now() + KEY_COOLDOWN_MS;
      }
    }

    await env.MICKEY_STATE.put('gemini_pool', JSON.stringify(pool));
  } catch (err) {
    console.warn('[reportKeyResult] Failed to save key metrics:', err?.message || err);
  }
}

async function getGeminiKeys(env) {
  let pool = await env.MICKEY_STATE.get('gemini_pool', 'json') || [];
  const now = Date.now();
  let poolDirty = false;

  for (const item of pool) {
    if (item.status === 'cooling_down' && item.cooldown_until && now >= item.cooldown_until) {
      item.status = 'active';
      item.cooldown_until = 0;
      poolDirty = true;
    }
  }
  if (poolDirty) {
    await env.MICKEY_STATE.put('gemini_pool', JSON.stringify(pool)).catch(() => {});
  }

  const activeCount = pool.filter(x => x.status === 'active' && x.key && (!x.cooldown_until || now >= x.cooldown_until)).length;

  return {
    success: true,
    has_key: activeCount > 0 || Boolean(env.GEMINI_API_KEY),
    configured: {
      gemini: activeCount > 0 || Boolean(env.GEMINI_API_KEY),
      groq: Boolean(env.GROQ_API_KEY),
      huggingface: Boolean(env.HUGGINGFACE_TOKEN)
    },
    gemini_pool: pool.map(({ key, ...item }) => ({
      ...item,
      masked_key: maskKey(key),
      cooldown_remaining_sec: item.status === 'cooling_down' && item.cooldown_until && item.cooldown_until > now
        ? Math.ceil((item.cooldown_until - now) / 1000)
        : 0
    })),
    available_models: [
      { id: 'gemini-3.8-flash-tts', name: 'Gemini Flash TTS', type: 'tts' },
      { id: 'gemini-3.8-flash-lite-tts', name: 'Gemini Flash-Lite TTS', type: 'tts' },
      { id: 'gemini-nano-banana-2.1', name: 'Google Nano Banana 2.1', type: 'image' }
    ]
  };
}

async function activeKeys(env) {
  let pool = await env.MICKEY_STATE.get('gemini_pool', 'json') || [];
  const now = Date.now();
  let poolDirty = false;

  for (const item of pool) {
    if (item.status === 'cooling_down' && item.cooldown_until && now >= item.cooldown_until) {
      item.status = 'active';
      item.cooldown_until = 0;
      poolDirty = true;
    }
  }
  if (poolDirty) {
    await env.MICKEY_STATE.put('gemini_pool', JSON.stringify(pool)).catch(() => {});
  }

  const values = pool
    .filter(x => x.status === 'active' && x.key && (!x.cooldown_until || now >= x.cooldown_until))
    .map(x => x.key);

  if (env.GEMINI_API_KEY) values.unshift(env.GEMINI_API_KEY);
  return [...new Set(values)];
}

async function resetGeminiKeyCooldown(ctx) {
  const account = await authenticate(ctx, true);
  const targetId = String(ctx.body.key_id || ctx.body.id || '');
  let pool = await ctx.env.MICKEY_STATE.get('gemini_pool', 'json') || [];
  const item = pool.find(x => x.id === targetId || x.key === targetId);
  if (!item) return json({ success: false, error: 'المفتاح غير موجود.' }, 404, ctx.headers);

  item.status = 'active';
  item.cooldown_until = 0;
  await ctx.env.MICKEY_STATE.put('gemini_pool', JSON.stringify(pool));
  return json({ success: true, message: 'تم إلغاء التبريد وإعادة تفعيل المفتاح بنجاح ✓', gemini_pool: (await getGeminiKeys(ctx.env)).gemini_pool }, 200, ctx.headers);
}
async function getUserGeminiKey(ctx) {
  return String(ctx.access?.account?.geminiApiKey || '');
}
async function keysForRequest(ctx) {
  const personalKey = await getUserGeminiKey(ctx);
  return [...new Set([personalKey, ...await activeKeys(ctx.env)].filter(Boolean))];
}
async function saveUserGeminiKey(ctx) {
  const account = await authenticate(ctx, false);
  const key = String(ctx.body.geminiKey ?? '').trim();
  if (key.length > 256 || (key && !/^[A-Za-z0-9_.-]{30,120}$/.test(key))) {
    return json({ success: false, error: 'صيغة مفتاح Gemini غير صالحة.' }, 400, ctx.headers);
  }
  await updateUserProfileField(account, ctx.env, 'geminiApiKey', key ? { stringValue: key } : null);
  return json({ success: true, message: key ? 'تم حفظ المفتاح بشكل خاص في Firestore.' : 'تم حذف المفتاح من Firestore.', masked_key: key ? maskKey(key) : null }, 200, ctx.headers);
}
async function updateUserProfileField(account, env, field, value) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(account.uid)}?updateMask.fieldPaths=${encodeURIComponent(field)}`;
  const fields = value === null ? {} : { [field]: value };
  const response = await fetch(url, {
    method: 'PATCH', headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!response.ok) fail(502, 'تعذر حفظ بيانات المفاتيح في Firestore. تحقق من صلاحية حسابك على ملف المستخدم.');
}
function maskKey(key = '') { return key.length > 10 ? `${key.slice(0, 6)}••••${key.slice(-4)}` : '••••••••'; }

async function generateTts(ctx) {
  const data = ctx.body;
  const text = String(data.text || ctx.url.searchParams.get('text') || '').trim();
  if (!text) return json({ success: false, error: 'النص فارغ' }, 400, ctx.headers);
  if (text.length > 8000) return json({ success: false, error: 'النص طويل جدًا. قسّمه إلى مقاطع أقصر.' }, 413, ctx.headers);
  const gender = String(data.gender || '').toLowerCase();
  const performance = String(data.performance || '').toLowerCase();
  const femaleNames = ['mariam', 'laila', 'sama', 'salma', 'farida'];
  const female = gender === 'female' || femaleNames.includes(performance);
  const voices = { yusuf: ['Charon', 'Kore'], malik: ['Puck', 'Aoede'], rami: ['Fenrir', 'Aoede'], saif: ['Fenrir', 'Kore'], zaid: ['Puck', 'Aoede'], neutral: ['Puck', 'Kore'], mariam: ['Puck', 'Kore'], laila: ['Puck', 'Aoede'], sama: ['Fenrir', 'Aoede'], salma: ['Fenrir', 'Kore'], farida: ['Charon', 'Kore'] };
  const voice = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'].includes(data.voice) ? data.voice : (voices[performance]?.[female ? 1 : 0] || (female ? 'Kore' : 'Puck'));
  const dialects = { egyptian: 'Egyptian Arabic', saudi: 'Saudi Arabic', levantine: 'Levantine Arabic', iraqi: 'Iraqi Arabic', algerian: 'Algerian Arabic', moroccan: 'Moroccan Arabic', tunisian: 'Tunisian Arabic', gulf: 'Gulf Arabic', fusha: 'Modern Standard Arabic' };
  const dialect = dialects[String(data.dialect || '').toLowerCase()] || 'Egyptian Arabic';
  const style = String(data.style || `Speak in ${dialect}, with a ${female ? 'feminine' : 'masculine'} voice. Read the supplied Arabic text verbatim; do not translate it or say these directions aloud.`);
  const errors = [];
  const engine = data.engine === 'neural' ? 'neural' : 'gemini';
  if (engine === 'gemini') {
    for (const key of await keysForRequest(ctx)) {
      const result = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          model: GEMINI_TTS_MODEL,
          input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style }] }] }],
          response_format: { type: 'audio' },
          generation_config: { speech_config: [{ voice }] }
        })
      });
      const response = await readJson(result);
      const audio = response.output_audio?.data || (response.steps || [])
        .flatMap(step => step.content || [])
        .reverse()
        .find(item => item.type === 'audio' && item.data)?.data;
      if (result.ok && audio) {
        await reportKeyResult(ctx.env, key, true);
        return audioResponse(audio, response.output_audio?.mime_type || 'audio/wav', ctx.headers, 'Gemini 3.8 Flash TTS');
      }
      const errMsg = response.error?.message || `Gemini (${result.status})`;
      await reportKeyResult(ctx.env, key, false, { status: result.status, message: errMsg });
      errors.push(errMsg);
    }
    return json({ success: false, error: errors[0] || 'لا يوجد مفتاح Gemini صالح. أضف مفتاح Gemini API ثم أعد المحاولة.' }, 502, ctx.headers, ctx.requestId, ctx);
  }
  // The free fallback is Google Translate TTS and does not support Gemini voice or gender selection.
  const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=${encodeURIComponent(text.slice(0, 200))}`;
  const fallback = await fetch(fallbackUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null);
  if (fallback?.ok) {
    const bytes = await fallback.arrayBuffer();
    if (bytes.byteLength > 100) return new Response(bytes, { status: 200, headers: { ...ctx.headers, 'Content-Type': 'audio/mpeg', 'X-TTS-Engine': 'Google Translate TTS' } });
  }
  return json({ success: false, error: 'تعذر توليد الصوت عبر Google Translate TTS.' }, 502, ctx.headers, ctx.requestId, ctx);
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
  if (!prompt) return json({ success: false, error: 'الوصف فارغ' }, 400, ctx.headers, ctx.requestId, ctx);
  const keys = await keysForRequest(ctx);
  if (!keys.length) return json({ success: false, error: 'محرك Nano Banana غير مهيأ: أضف مفتاح Gemini صالحًا من إعدادات المنصة.' }, 503, ctx.headers, ctx.requestId, ctx);
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
    { id: 'gemini-2.5-flash-image', imageSize: '' },
  ];
  let lastError = '';
  let lastStatus = 502;
  for (const model of models) {
    for (const key of keys) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model.id}:generateContent?key=${encodeURIComponent(key)}`, {
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
        await reportKeyResult(ctx.env, key, true);
        const mimeType = imagePart.inlineData.mimeType || 'image/png';
        return json({ success: true, provider: model.id, mime_type: mimeType, image_base64: imagePart.inlineData.data, base64Data: imagePart.inlineData.data }, 200, ctx.headers, ctx.requestId, ctx);
      }
      lastStatus = response.status || 502;
      lastError = `${model.id}: ${data.error?.message || data.candidates?.[0]?.finishReason || `Google AI returned HTTP ${lastStatus}`}`;
      await reportKeyResult(ctx.env, key, false, { status: lastStatus, message: lastError });
    }
  }
  return json({ success: false, error: `تعذر التوليد عبر Nano Banana (${lastStatus}): ${String(lastError).slice(0, 240)}` }, 502, ctx.headers, ctx.requestId, ctx);
}

async function geminiText(ctx, prompt, maxOutputTokens = 2000) {
  for (const key of await keysForRequest(ctx)) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens } })
    });
    const data = await readJson(response); const text = data.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('').trim();
    if (response.ok && text) {
      await reportKeyResult(ctx.env, key, true);
      return text;
    }
    const errMsg = data.error?.message || `Google AI returned HTTP ${response.status}`;
    await reportKeyResult(ctx.env, key, false, { status: response.status, message: errMsg });
  }
  return '';
}
async function enhancePrompt(ctx) {
  const prompt = String(ctx.body.prompt || '').trim();
  if (!prompt) return json({ success: false, error: 'النص المطلوب تحسينه فارغ' }, 400, ctx.headers);
  if (prompt.length > 5000) return json({ success: false, error: 'النص المطلوب تحسينه يتجاوز الحد الأقصى (5000 حرف).' }, 400, ctx.headers);
  const system = 'Translate the user prompt to English and rewrite it as a natural photorealistic real-life photograph description. Include natural lighting, realistic textures, lens optics, sharp focus, and 8k resolution. Avoid 3d render, cartoon, illustration, drawing, CGI, anime, and low quality. Output only the English prompt.';
  const enhanced = await geminiText(ctx, `${system}\n\nUser input: ${prompt}`, 350);
  return json({ success: true, provider: enhanced ? 'gemini-photorealistic' : 'studio-photorealistic', original: prompt, enhanced: enhanced || `${prompt}, photorealistic RAW photography, natural lighting, Sony Alpha A7R V, 85mm f/1.4 lens, authentic natural textures, sharp focus, 8k resolution` }, 200, ctx.headers);
}
async function refineVoiceover(ctx) {
  const text = String(ctx.body.text || '').trim(); const dialect = String(ctx.body.dialect || 'العربية').trim();
  if (!text) return json({ success: false, error: 'اكتب النص المراد تحسينه أولاً.' }, 400, ctx.headers);
  if (text.length > 15000) return json({ success: false, error: 'نص التعليق يتجاوز الحد الأقصى (15000 حرف).' }, 400, ctx.headers);
  const refined = await geminiText(ctx, `حرر النص التالي ليصبح مناسباً للتعليق الصوتي باللهجة ${dialect}. حسّن علامات الترقيم والإيقاع وسهولة النطق، وحافظ على المعنى والأسماء والأرقام والحقائق دون إضافة معلومات. أعد النص المحسن فقط دون مقدمة أو شرح:\n\n${text}`, 2500);
  return refined ? json({ success: true, refined, text: refined }, 200, ctx.headers) : json({ success: false, error: 'تعذر تحسين النص عبر خدمة Mickey Studio. تحقق من إعداد Gemini في Cloudflare.' }, 502, ctx.headers);
}
async function generateText(ctx) {
  const prompt = String(ctx.body.prompt || '').trim();
  if (!prompt) return json({ success: false, error: 'النص المطلوب فارغ.' }, 400, ctx.headers);
  if (prompt.length > 25000) return json({ success: false, error: 'النص المطلوب يتجاوز الحد الأقصى (25000 حرف).' }, 400, ctx.headers);
  const text = await geminiText(ctx, prompt, 2000);
  return text ? json({ success: true, text, response: text }, 200, ctx.headers) : json({ success: false, error: 'تعذر إنشاء النص. تحقق من إعداد Gemini في Cloudflare.' }, 502, ctx.headers);
}
async function detectViralClips(ctx) {
  const transcript = String(ctx.body.transcript || ctx.body.text || '').trim();
  const durationPref = String(ctx.body.duration_pref || '60-90');
  if (!transcript) return json({ success: false, error: 'نص الفيديو أو التفريغ فارغ' }, 400, ctx.headers);
  if (transcript.length > 100000) return json({ success: false, error: 'نص الفيديو يتجاوز الحد الأقصى (100 ألف حرف).' }, 400, ctx.headers);
  const prompt = `أنت خبير مونتاج وتسويق فيديو محترف متخصص في استخراج المقاطع الأكثر انتشاراً وفيروسية (Viral Shorts & Reels). قم بتحليل نص الفيديو المرفق، وحدد أفضل المقاطع القصيرة الصالحة لتكون ريلز أو شورتس. أخرج كائن JSON فقط بدون markdown:\n{"clips":[{"title":"عنوان جذاب","hook":"الخطاف","startTime":12.0,"endTime":62.0,"duration":50.0,"viralityScore":95,"category":"تعليمي","reason":"سبب التقييم"}]}\n\nمدة المقطع المفضلة: ${durationPref} ثانية.\n\nنص وتفريغ الفيديو:\n${transcript}`;
  const rawText = await geminiText(ctx, prompt, 2000);
  let parsed;
  try { parsed = JSON.parse(String(rawText || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim()); }
  catch (_) { return json({ success: false, error: 'تعذر تحليل رد الذكاء الاصطناعي. أعد المحاولة.' }, 502, ctx.headers); }
  const clips = Array.isArray(parsed?.clips) ? parsed.clips.filter(c => Number.isFinite(Number(c.startTime)) && Number(c.endTime) > Number(c.startTime)) : [];
  if (!clips.length) return json({ success: false, error: 'لم يتمكن الذكاء الاصطناعي من استخراج مقاطع صالحة من هذا النص.' }, 502, ctx.headers);
  return json({ success: true, clips, count: clips.length }, 200, ctx.headers);
}
async function generateChapters(ctx) {
  const transcript = String(ctx.body.transcript || ctx.body.text || '').trim();
  if (!transcript) return json({ success: false, error: 'نص وتفريغ الفيديو فارغ' }, 400, ctx.headers);
  if (transcript.length > 100000) return json({ success: false, error: 'نص الفيديو يتجاوز الحد الأقصى (100 ألف حرف).' }, 400, ctx.headers);
  const prompt = `أنت خبير يوتيوب ومونتاج. قم بتقسيم نص الفيديو المرفق إلى فصول ومواضيع واضحة (YouTube Chapters). يجب أن يبدأ الفصل الأول عند 00:00 (المقدمة). أخرج كائن JSON فقط بدون markdown:\n{"chapters":[{"seconds":0,"timestamp":"00:00","title":"المقدمة"},{"seconds":45,"timestamp":"00:45","title":"عنوان الفصل"}],"formattedText":"00:00 المقدمة\\n00:45 عنوان الفصل"}\n\nنص وتفريغ الفيديو:\n${transcript}`;
  const rawText = await geminiText(ctx, prompt, 2000);
  let parsed;
  try { parsed = JSON.parse(String(rawText || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim()); }
  catch (_) { return json({ success: false, error: 'تعذر تحليل رد الذكاء الاصطناعي. أعد المحاولة.' }, 502, ctx.headers); }
  const chapters = Array.isArray(parsed?.chapters) ? parsed.chapters.filter(c => Number.isFinite(Number(c.seconds)) && String(c.title || '').trim()) : [];
  if (!chapters.length) return json({ success: false, error: 'لم يتمكن الذكاء الاصطناعي من استخراج فصول صالحة من هذا النص.' }, 502, ctx.headers);
  let formattedText = String(parsed.formattedText || '');
  if (!formattedText && chapters.length) {
    formattedText = chapters.map(c => `${c.timestamp || '00:00'} ${c.title || 'فصل'}`).join('\n');
  }
  return json({ success: true, chapters, formattedText, count: chapters.length }, 200, ctx.headers);
}
async function detectCensorWords(ctx) {
  const transcript = String(ctx.body.transcript || ctx.body.text || '').trim();
  const customWords = String(ctx.body.custom_words || ctx.body.words || '').trim();
  if (!transcript) return json({ success: false, error: 'نص وتفريغ الفيديو فارغ' }, 400, ctx.headers);
  if (transcript.length > 100000) return json({ success: false, error: 'نص الفيديو يتجاوز الحد الأقصى (100 ألف حرف).' }, 400, ctx.headers);
  if (customWords.length > 2000) return json({ success: false, error: 'قائمة الكلمات المخصصة طويلة جداً.' }, 400, ctx.headers);
  const prompt = `أنت خبير في مراجعة المحتوى والرقابة الصوتية (Content Moderation & Censor Bleep). قم بفحص النص المرفق واكتشاف أي كلمات مسيئة، شتائم، ألفاظ نابية، أو الكلمات المخصصة التالية: (${customWords}). أخرج كائن JSON فقط بدون markdown:\n{"matches":[{"word":"الكلمة المحظورة","start":14.5,"end":15.2,"reason":"لفظ غير لائق"}]}\n\nنص وتفريغ الفيديو:\n${transcript}`;
  const rawText = await geminiText(ctx, prompt, 2000);
  let parsed;
  try { parsed = JSON.parse(String(rawText || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim()); }
  catch (_) { return json({ success: false, error: 'تعذر تحليل رد الذكاء الاصطناعي. أعد المحاولة.' }, 502, ctx.headers); }
  const matches = Array.isArray(parsed?.matches) ? parsed.matches.filter(m => Number.isFinite(Number(m.start)) && Number(m.end) > Number(m.start) && String(m.word || '').trim()) : [];
  return json({ success: true, matches, count: matches.length }, 200, ctx.headers);
}
async function transcribeAudio(ctx) {
  const audio = String(ctx.body.audio_base64 || '').replace(/^data:[^,]+,/, '');
  if (!audio) return json({ success: false, error: 'ملف الصوت غير موجود.' }, 400, ctx.headers);
  if (audio.length > 18_000_000) return json({ success: false, error: 'حجم ملف الصوت أكبر من الحد المسموح.' }, 413, ctx.headers);
  const mimeType = String(ctx.body.mime_type || 'audio/webm').split(';')[0];
  const startSeconds = Number(ctx.body.start_seconds);
  const endSeconds = Number(ctx.body.end_seconds);
  const rangeInstruction = Number.isFinite(startSeconds) && startSeconds >= 0 && Number.isFinite(endSeconds) && endSeconds > startSeconds
    ? ` فرّغ الكلام الواقع فقط بين ${startSeconds.toFixed(2)} و${endSeconds.toFixed(2)} ثانية من بداية الملف، وتجاهل ما قبل هذا النطاق وما بعده. اجعل توقيتات SRT نسبية إلى بداية هذا النطاق.`
    : '';
  const prompt = `حلل الصوت المرفق، سواء أُرسل كملف صوتي أو كفيديو يحتوي على صوت، وفرّغ الكلام العربي بدقة باللهجة ${ctx.body.dialect || 'المسموعة'}، مع علامات الترقيم.${rangeInstruction} أخرج JSON صالحاً فقط بهذه الحقول: {"transcript":"النص الكامل","srt":"ترجمة SRT بتوقيتات تقديرية","dialect":"اللهجة المكتشفة","tone":"النبرة","summary":"ملخص قصير","key_points":[],"words_count":0,"estimated_speed":"معتدلة"}. لا تضف كلمات غير موجودة في التسجيل.`;
  for (const key of await keysForRequest(ctx)) {
    for (const model of ['gemini-3.8-flash', 'gemini-3.6-flash']) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: audio } }, { text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: 8192 } })
      });
      const data = await readJson(response); const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
      if (response.ok && text) {
        let parsed; try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { parsed = { transcript: text }; }
        const transcript = parsed.transcript || text;
        return json({ success: true, data: { transcript, text: transcript, srt: parsed.srt || '', dialect: parsed.dialect || ctx.body.dialect || '', tone: parsed.tone || '', summary: parsed.summary || transcript.slice(0, 180), key_points: parsed.key_points || [], words_count: parsed.words_count || transcript.trim().split(/\s+/).filter(Boolean).length, estimated_speed: parsed.estimated_speed || '' }, provider: model }, 200, ctx.headers);
      }
    }
  }
  return json({ success: false, error: 'تعذر تفريغ الصوت. تحقق من مفتاح Gemini API في Cloudflare.' }, 502, ctx.headers);
}
async function analyzeVideoSilence(ctx) {
  const video = String(ctx.body.video_base64 || '').replace(/^data:[^,]+,/, '');
  const mimeType = String(ctx.rawVideoStream ? ctx.request.headers.get('Content-Type') : ctx.body.mime_type || '').split(';')[0].trim().toLowerCase();
  const videoSize = ctx.rawVideoStream ? Number(ctx.url.searchParams.get('size')) : Math.floor(video.length * 3 / 4);
  if (!ctx.rawVideoStream && !video) return json({ success: false, error: 'ملف الفيديو غير موجود.' }, 400, ctx.headers);
  if (ctx.rawVideoStream ? (!Number.isFinite(videoSize) || videoSize <= 0 || videoSize > 50 * 1024 * 1024) : video.length > 26_700_000) {
    return json({ success: false, error: 'حجم الفيديو أكبر من حد الإرسال الآمن (50 ميجابايت).' }, 413, ctx.headers);
  }
  if (!/^(?:video\/(?:mp4|quicktime|mov|webm|x-matroska|avi|mpeg|mpg|x-msvideo|x-ms-wmv|wmv|3gpp)|audio\/(?:wav|x-wav|wave|mpeg|mp3|mp4|m4a|aac|flac|ogg|webm))$/.test(mimeType)) {
    return json({ success: false, error: 'صيغة الملف غير مدعومة لتحليل الصمت.' }, 415, ctx.headers);
  }
  const start = Number(ctx.rawVideoStream ? ctx.url.searchParams.get('start_seconds') : ctx.body.start_seconds);
  const end = Number(ctx.rawVideoStream ? ctx.url.searchParams.get('end_seconds') : ctx.body.end_seconds);
  const threshold = Number(ctx.rawVideoStream ? ctx.url.searchParams.get('threshold_db') : ctx.body.threshold_db);
  const minimum = Number(ctx.rawVideoStream ? ctx.url.searchParams.get('minimum_seconds') : ctx.body.minimum_seconds);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end - start > 360) {
    return json({ success: false, error: 'نطاق الفيديو المحدد غير صالح أو أطول من 6 دقائق.' }, 400, ctx.headers);
  }
  const minDuration = Number.isFinite(minimum) ? Math.min(5, Math.max(0.2, minimum)) : 0.5;
  const thresholdDb = Number.isFinite(threshold) ? Math.min(-18, Math.max(-65, threshold)) : -38;
  const directVideoBytes = ctx.rawVideoStream ? new Uint8Array(await ctx.request.arrayBuffer()) : null;
  if (directVideoBytes && directVideoBytes.byteLength !== videoSize) return json({ success: false, error: 'حجم الفيديو المرسل لا يطابق الحجم المعلن.' }, 400, ctx.headers);
  if (directVideoBytes && /^audio\/(?:wav|x-wav|wave)$/i.test(mimeType)) {
    const measured = analyzePcmWavSilence(directVideoBytes, start, end, thresholdDb, minDuration);
    if (measured) return json({ success: true, data: measured, provider: 'Mickey Studio Cloud PCM Analyzer' }, 200, ctx.headers);
  }
  const prompt = `حلل المسار الصوتي داخل الفيديو المرفق فقط، ولا تحلل الصورة أو المحتوى البصري. ابحث عن فترات الصمت أو الانخفاض الواضح جدًا في الصوت، بحد تقريبي ${thresholdDb} dB ولمدة لا تقل عن ${minDuration} ثانية. افحص فقط المجال من ${start.toFixed(3)} إلى ${end.toFixed(3)} ثانية من بداية الملف. أرجع الأوقات بالثواني نسبة إلى بداية المجال المحدد (أي يبدأ المجال عند 0). لا تعتبر الوقفات التعبيرية القصيرة صمتًا، ولا تقطع الكلام الهادئ. أخرج JSON فقط بالشكل {"silences":[{"start_seconds":1.25,"end_seconds":2.10}]}. إذا لم توجد فترات مناسبة أرجع {"silences":[]}. لا تضف أي شرح.`;
  const apiKeys = await keysForRequest(ctx);
  for (const key of apiKeys) {
    let uploadedFile = null;
    if (ctx.rawVideoStream || video.length > 16_800_000) {
      try {
        uploadedFile = ctx.rawVideoStream
          ? await uploadGeminiVideoBytes(directVideoBytes, mimeType, key)
          : await uploadGeminiVideo(video, mimeType, key);
      } catch (error) {
        console.warn('[analyze_video_silence] Gemini Files upload failed:', error?.message || error);
        continue;
      }
    }
    for (const model of ['gemini-3.8-flash', 'gemini-3.6-flash']) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [uploadedFile ? { fileData: { mimeType, fileUri: uploadedFile.uri } } : { inlineData: { mimeType, data: video } }, { text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 3000 }
        })
      });
      const result = await readJson(response);
      const text = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
      if (!response.ok || !text) continue;
      let parsed;
      try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { continue; }
      if (!Array.isArray(parsed.silences)) continue;
      const duration = end - start;
      const silences = parsed.silences.map(item => ({
        start_seconds: Math.max(0, Math.min(duration, Number(item.start_seconds))),
        end_seconds: Math.max(0, Math.min(duration, Number(item.end_seconds)))
      })).filter(item => Number.isFinite(item.start_seconds) && Number.isFinite(item.end_seconds)
        && item.end_seconds - item.start_seconds >= minDuration);
      if (uploadedFile) await deleteGeminiFile(uploadedFile.name, key);
      return json({ success: true, data: { silences }, provider: model }, 200, ctx.headers);
    }
    if (uploadedFile) await deleteGeminiFile(uploadedFile.name, key);
  }
  return json({ success: false, error: 'تعذر تحليل صوت الفيديو. تحقق من مفتاح Gemini أو جرّب مقطعًا أقصر.' }, 502, ctx.headers);
}
function analyzePcmWavSilence(bytes, startSeconds, endSeconds, thresholdDb, minimumSeconds) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readTag = offset => String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
  if (bytes.byteLength < 44 || readTag(0) !== 'RIFF' || readTag(8) !== 'WAVE') return null;
  let format = 0, channels = 0, sampleRate = 0, blockAlign = 0, bitsPerSample = 0, dataOffset = -1, dataLength = 0;
  for (let offset = 12; offset + 8 <= bytes.byteLength;) {
    const tag = readTag(offset);
    const length = view.getUint32(offset + 4, true);
    const content = offset + 8;
    if (content + length > bytes.byteLength) return null;
    if (tag === 'fmt ' && length >= 16) {
      format = view.getUint16(content, true);
      channels = view.getUint16(content + 2, true);
      sampleRate = view.getUint32(content + 4, true);
      blockAlign = view.getUint16(content + 12, true);
      bitsPerSample = view.getUint16(content + 14, true);
    } else if (tag === 'data') {
      dataOffset = content;
      dataLength = length;
    }
    offset = content + length + (length & 1);
  }
  if (![1, 3].includes(format) || channels < 1 || channels > 8 || !sampleRate || !blockAlign || dataOffset < 0) return null;
  const bytesPerSample = bitsPerSample / 8;
  if ((format === 1 && ![8, 16, 24, 32].includes(bitsPerSample))
    || (format === 3 && ![32, 64].includes(bitsPerSample))
    || blockAlign < channels * bytesPerSample) return null;
  const totalFrames = Math.floor(dataLength / blockAlign);
  const firstFrame = Math.max(0, Math.min(totalFrames, Math.floor(startSeconds * sampleRate)));
  const lastFrame = Math.max(firstFrame, Math.min(totalFrames, Math.ceil(endSeconds * sampleRate)));
  if (lastFrame <= firstFrame) return { silences: [], waveform_db: [], waveform_rate: 50 };
  const rate = 50;
  const framesPerBin = Math.max(1, Math.round(sampleRate / rate));
  const bins = Math.ceil((lastFrame - firstFrame) / framesPerBin);
  const waveformDb = new Array(bins);
  const readSample = (offset) => {
    if (format === 3 && bitsPerSample === 32) return view.getFloat32(offset, true);
    if (format === 3 && bitsPerSample === 64) return view.getFloat64(offset, true);
    if (bitsPerSample === 8) return (view.getUint8(offset) - 128) / 128;
    if (bitsPerSample === 16) return view.getInt16(offset, true) / 32768;
    if (bitsPerSample === 24) {
      let value = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
      if (value & 0x800000) value |= 0xff000000;
      return value / 8388608;
    }
    if (bitsPerSample === 32) return view.getInt32(offset, true) / 2147483648;
    return 0;
  };
  for (let bin = 0; bin < bins; bin++) {
    const from = firstFrame + bin * framesPerBin;
    const to = Math.min(lastFrame, from + framesPerBin);
    let energy = 0, count = 0;
    for (let frame = from; frame < to; frame++) {
      const base = dataOffset + frame * blockAlign;
      for (let channel = 0; channel < channels; channel++) {
        const sample = readSample(base + channel * bytesPerSample);
        const value = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
        energy += value * value;
        count++;
      }
    }
    const rms = count ? Math.sqrt(energy / count) : 0;
    waveformDb[bin] = Math.max(-90, Math.round(20 * Math.log10(Math.max(rms, 1e-5)) * 10) / 10);
  }
  const silences = [];
  let quietStart = -1;
  for (let bin = 0; bin <= bins; bin++) {
    const quiet = bin < bins && waveformDb[bin] <= thresholdDb;
    if (quiet && quietStart < 0) quietStart = bin;
    else if (!quiet && quietStart >= 0) {
      const start = quietStart * framesPerBin / sampleRate;
      const end = Math.min(lastFrame - firstFrame, bin * framesPerBin) / sampleRate;
      if (end - start >= minimumSeconds) silences.push({ start_seconds: start, end_seconds: end });
      quietStart = -1;
    }
  }
  return { silences, waveform_db: waveformDb, waveform_rate: rate };
}
async function uploadGeminiVideo(base64, mimeType, apiKey) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array(Math.floor(base64.length * 3 / 4) - padding);
  let byteOffset = 0;
  for (let offset = 0; offset < base64.length; offset += 65_536) {
    const binary = atob(base64.slice(offset, Math.min(offset + 65_536, base64.length)));
    for (let index = 0; index < binary.length; index++) bytes[byteOffset++] = binary.charCodeAt(index);
  }
  return uploadGeminiVideoBytes(bytes, mimeType, apiKey);
}
async function uploadGeminiVideoBytes(bytes, mimeType, apiKey) {
  const start = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': mimeType
    },
    body: JSON.stringify({ file: { display_name: `mickey-quickcut-${Date.now()}` } })
  });
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!start.ok || !uploadUrl) throw new Error(`Gemini upload initialization failed (${start.status}).`);
  const parsedUploadUrl = new URL(uploadUrl);
  if (parsedUploadUrl.origin !== 'https://generativelanguage.googleapis.com' || !parsedUploadUrl.pathname.startsWith('/upload/v1beta/files/')) {
    throw new Error('Gemini returned an unexpected video upload URL.');
  }
  const uploaded = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: bytes
  });
  const uploadedData = await readJson(uploaded);
  let file = uploadedData.file || uploadedData;
  if (!uploaded.ok || !file.name || !file.uri) throw new Error(`Gemini video upload failed (${uploaded.status}).`);
  for (let attempt = 0; file.state === 'PROCESSING' && attempt < 20; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const status = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}?key=${encodeURIComponent(apiKey)}`);
    const statusData = await readJson(status);
    if (!status.ok) throw new Error(`Gemini video processing check failed (${status.status}).`);
    file = statusData.file || statusData;
  }
  if (file.state !== 'ACTIVE') throw new Error(file.state === 'FAILED' ? 'Gemini could not process the uploaded video.' : 'Gemini video processing timed out.');
  return { name: file.name, uri: file.uri };
}
async function deleteGeminiFile(name, apiKey) {
  try {
    await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}?key=${encodeURIComponent(apiKey)}`, { method: 'DELETE' });
  } catch (_) {}
}
async function proxyMedia(ctx) {
  const target = ctx.url.searchParams.get('url');
  let parsed; try { parsed = new URL(target); } catch { return json({ error: 'رابط غير صالح' }, 400, ctx.headers); }
  const hostname = parsed.hostname.toLowerCase();
  if (
    !['https:', 'http:'].includes(parsed.protocol) ||
    ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(hostname) ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local') ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    /^169\.254\./.test(hostname)
  ) {
    return json({ error: 'رابط غير مسموح به لأسباب أمنية.' }, 400, ctx.headers);
  }
  const response = await fetch(parsed.href, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
  if (!response.ok) return json({ error: 'تعذر جلب الوسائط' }, 502, ctx.headers);
  const h = new Headers(ctx.headers); h.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
  return new Response(response.body, { status: 200, headers: h });
}

async function pairBegin(ctx) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const code = base64Url(bytes);
  const key = `pair:${await sha256(code)}`;
  await ctx.env.MICKEY_STATE.put(key, JSON.stringify({ status: 'pending', createdAt: Date.now() }), { expirationTtl: 120 });
  return json({ success: true, code, expiresIn: 120 }, 200, ctx.headers);
}
async function pairComplete(ctx) {
  const code = String(ctx.body.code || '').trim().replace(/^MKP[2]?_/, '');
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(code)) return json({ success: false, error: 'رمز الربط غير صالح.' }, 400, ctx.headers);
  const account = await authenticate(ctx);
  if (account.deviceToken) fail(403, 'أكمل الربط من جلسة الموقع المسجلة الدخول.');
  const hash = await sha256(code);
  const pairKey = `pair:${hash}`;
  const pending = await ctx.env.MICKEY_STATE.get(pairKey, 'json');
  if (!pending || pending.status !== 'pending' || Date.now() - pending.createdAt > 120000) fail(410, 'انتهت صلاحية طلب الربط. ابدأ الربط من الإضافة مجددًا.');
  const deviceToken = `msd_${hex(crypto.getRandomValues(new Uint8Array(32)))}`;
  const deviceId = crypto.randomUUID();
  const createdAt = nowIso();
  const device = { deviceId, userId: account.uid, email: account.email, createdAt, name: String(ctx.body.deviceName || 'Mickey Studio · Premiere Pro').slice(0, 80) };
  const staged = await coordinatorRequest(ctx.env, `pair:${hash}`, 'stage', { deviceToken, device });
  if (!staged.staged) fail(409, 'تم استخدام طلب الربط بالفعل. ابدأ طلبًا جديدًا.');
  await ctx.env.MICKEY_STATE.put(`device_token:${await sha256(deviceToken)}`, JSON.stringify(device));
  await coordinatorRequest(ctx.env, `user:${account.uid}`, 'device_add', { ...device, tokenHash: await sha256(deviceToken) });
  await ctx.env.MICKEY_STATE.put(pairKey, JSON.stringify({ ...pending, status: 'complete', completedAt: Date.now() }), { expirationTtl: 120 });
  return json({ success: true, deviceId, createdAt }, 200, ctx.headers);
}
async function pairPoll(ctx) {
  const code = String(ctx.body.code || ctx.url.searchParams.get('code') || '').trim().replace(/^MKP[2]?_/, '');
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(code)) return json({ success: false, error: 'رمز الربط غير صالح.' }, 400, ctx.headers);
  const hash = await sha256(code);
  const key = `pair:${hash}`;
  const pending = await ctx.env.MICKEY_STATE.get(key, 'json');
  if (!pending || Date.now() - pending.createdAt > 120000) { if (pending) await ctx.env.MICKEY_STATE.delete(key); return json({ success: false, error: 'انتهت صلاحية طلب الربط.' }, 410, ctx.headers); }
  if (pending.status !== 'complete') return json({ success: true, status: 'pending' }, 200, ctx.headers);
  const result = await coordinatorRequest(ctx.env, `pair:${hash}`, 'consume', {});
  if (!result.consumed || !result.deviceToken) return json({ success: false, error: 'تم استخدام كود الربط أو انتهت صلاحيته.' }, 410, ctx.headers);
  await ctx.env.MICKEY_STATE.delete(key);
  return json({ success: true, status: 'complete', email: result.device.email, deviceToken: result.deviceToken, deviceId: result.device.deviceId }, 200, ctx.headers);
}

async function pair2Start(ctx) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const code = base64Url(bytes);
  const hash = await sha256(code);
  const key = `pair2:${hash}`;
  await ctx.env.MICKEY_STATE.put(key, JSON.stringify({ status: 'pending', createdAt: Date.now(), version: 2 }), { expirationTtl: 120 });
  return json({ success: true, code, expiresIn: 120, version: 2 }, 200, ctx.headers);
}

async function pair2Complete(ctx) {
  const code = String(ctx.body.code || ctx.url.searchParams.get('code') || '').trim().replace(/^MKP[2]?_/, '');
  if (!code || code.length < 8 || code.length > 64) {
    return json({ success: false, error: 'رمز الاقتران غير صالح.' }, 400, ctx.headers);
  }
  const account = await authenticate(ctx);
  if (account.deviceToken) {
    fail(403, 'أكمل عملية الاقتران من جلسة الموقع المسجلة الدخول.');
  }
  const hash = await sha256(code);
  const pairKey = `pair2:${hash}`;
  const pending = await ctx.env.MICKEY_STATE.get(pairKey, 'json');
  if (!pending || pending.status !== 'pending' || (Date.now() - pending.createdAt > 120000)) {
    fail(410, 'انتهت صلاحية طلب الاقتران (صالح لدقيقتين فقط). ابدأ طلب اقتران جديد من الإضافة.');
  }

  const deviceToken = `msd_${hex(crypto.getRandomValues(new Uint8Array(32)))}`;
  const deviceId = crypto.randomUUID();
  const createdAt = nowIso();
  const device = {
    deviceId,
    userId: account.uid,
    email: account.email,
    name: String(ctx.body.deviceName || 'Mickey Studio · Premiere Pro').slice(0, 80),
    createdAt,
    lastUsed: createdAt,
    version: 2
  };

  const staged = await coordinatorRequest(ctx.env, `pair2:${hash}`, 'stage', { deviceToken, device });
  if (!staged.staged) {
    fail(409, 'تم استخدام طلب الاقتران مسبقاً أو انتهت صلاحيته.');
  }

  const tokenHash = await sha256(deviceToken);
  await ctx.env.MICKEY_STATE.put(`device_token:${tokenHash}`, JSON.stringify(device));
  await coordinatorRequest(ctx.env, `user:${account.uid}`, 'device_add', { ...device, tokenHash });
  await ctx.env.MICKEY_STATE.put(pairKey, JSON.stringify({ ...pending, status: 'complete', completedAt: Date.now() }), { expirationTtl: 120 });

  return json({ success: true, deviceId, createdAt }, 200, ctx.headers);
}

async function pair2Poll(ctx) {
  const code = String(ctx.body.code || ctx.url.searchParams.get('code') || '').trim().replace(/^MKP[2]?_/, '');
  if (!code || code.length < 8 || code.length > 64) {
    return json({ success: false, error: 'رمز الاقتران غير صالح.' }, 400, ctx.headers);
  }
  const hash = await sha256(code);
  const key = `pair2:${hash}`;
  const pending = await ctx.env.MICKEY_STATE.get(key, 'json');
  if (!pending || (Date.now() - pending.createdAt > 120000)) {
    if (pending) await ctx.env.MICKEY_STATE.delete(key);
    return json({ success: false, error: 'انتهت صلاحية جلسة الاقتران.' }, 410, ctx.headers);
  }
  if (pending.status !== 'complete') {
    return json({ success: true, status: 'pending' }, 200, ctx.headers);
  }

  const result = await coordinatorRequest(ctx.env, `pair2:${hash}`, 'consume', {});
  if (!result.consumed || !result.deviceToken) {
    await ctx.env.MICKEY_STATE.delete(key);
    return json({ success: false, error: 'تم استهلاك رمز الاقتران مسبقاً (استخدام لمرة واحدة فقط).' }, 410, ctx.headers);
  }

  await ctx.env.MICKEY_STATE.delete(key);

  return json({
    success: true,
    status: 'complete',
    email: result.device.email,
    deviceToken: result.deviceToken,
    deviceId: result.device.deviceId,
    version: 2
  }, 200, ctx.headers);
}

async function listDevices(ctx) {
  const account = await authenticate(ctx);
  if (account.deviceToken) fail(403, 'إدارة الأجهزة متاحة من الموقع بعد تسجيل الدخول.');
  const result = await coordinatorRequest(ctx.env, `user:${account.uid}`, 'device_list');
  return json({ success: true, devices: result.devices || [] }, 200, ctx.headers);
}
async function revokeDevice(ctx) {
  const account = await authenticate(ctx);
  if (account.deviceToken) fail(403, 'إدارة الأجهزة متاحة من الموقع بعد تسجيل الدخول.');
  const deviceId = String(ctx.body.deviceId || '');
  if (!deviceId || deviceId.length > 80) return json({ success: false, error: 'معرّف الجهاز غير صالح.' }, 400, ctx.headers);
  const result = await coordinatorRequest(ctx.env, `user:${account.uid}`, 'device_revoke', { deviceId });
  if (!result.revoked) return json({ success: false, error: 'الجهاز غير موجود أو تم إلغاؤه مسبقًا.' }, 404, ctx.headers);
  await ctx.env.MICKEY_STATE.delete(`device_token:${result.tokenHash}`);
  return json({ success: true }, 200, ctx.headers);
}
function hex(bytes) { return [...bytes].map(value => value.toString(16).padStart(2, '0')).join(''); }
function base64Url(bytes) { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }

function validateMotionScene(scene) {
  if (!scene || typeof scene !== 'object') {
    fail(400, 'بيانات المشهد غير صالحة.');
  }

  // Branch A: Scene v2 with layers (Motion Scene Engine schema)
  if (Array.isArray(scene.layers)) {
    if (scene.layers.length < 1 || scene.layers.length > 50) {
      fail(400, 'المشهد يجب أن يحتوي من طبقة واحدة إلى 50 طبقة.');
    }
    const duration = Number(scene.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 180) {
      fail(400, 'مدة المشهد غير صالحة (يجب أن تكون بين 0.1 و 180 ثانية).');
    }
    const fps = Number(scene.fps);
    if (scene.fps != null && (!Number.isFinite(fps) || fps < 10 || fps > 120)) {
      fail(400, 'معدل الإطارات (fps) غير صالح.');
    }
    const validLayerTypes = new Set(['text', 'shape', 'image', 'group', 'counter', 'chart', 'graphic', 'mogrt', 'color_matte', 'sfx']);
    for (const [index, layer] of scene.layers.entries()) {
      if (!layer || typeof layer !== 'object') fail(400, `الطبقة ${index + 1} غير صالحة.`);
      if (!validLayerTypes.has(String(layer.type || ''))) {
        fail(400, `نوع الطبقة ${index + 1} (${layer.type}) غير مدعوم.`);
      }
      const start = Number(layer.start != null ? layer.start : layer.startTime);
      const dur = Number(layer.duration);
      if (!Number.isFinite(start) || start < 0) {
        fail(400, `وقت بدء الطبقة ${index + 1} غير صالح.`);
      }
      if (!Number.isFinite(dur) || dur <= 0) {
        fail(400, `مدة عرض الطبقة ${index + 1} غير صالحة.`);
      }
      if (start + dur > duration + 10) {
        fail(400, `الطبقة ${index + 1} تتجاوز مدة المشهد.`);
      }
    }
    const serialized = JSON.stringify(scene);
    if (serialized.length > 18 * 1024 * 1024) {
      fail(413, 'حجم المشهد كبير جداً (أكبر من 18 ميجابايت).');
    }
    return scene;
  }

  // Branch B: Scene with elements (v1 flat or transitional elements schema)
  if (Array.isArray(scene.elements)) {
    if (scene.elements.length < 1 || scene.elements.length > 50) {
      fail(400, 'المشهد يجب أن يحتوي من عنصر إلى 50 عنصراً.');
    }
    const isV2 = Number(scene.version) === 2;
    const idPattern = /^[A-Za-z0-9_-]{1,80}$/;
    const mogrtIds = new Set(['bg_aurora', 'bg_grid', 'text_kinetic', 'text_badge', 'widget_counter', 'widget_donut_ring', 'widget_social_card', 'logo_outro', 'color_matte']);
    const sfxIds = new Set(['whoosh', 'pop', 'click', 'riser']);
    const musicIds = new Set(['social_upbeat', 'kids_playful', 'tech_corporate', 'luxury_ambient', 'cyber_drive', 'cinematic_inspire', 'stats_pulse']);
    const extendedSfxIds = new Set(['impact', 'sparkle', 'soft_whoosh', 'swipe', 'bass_hit', 'notification']);
    for (const [index, item] of scene.elements.entries()) {
      if (!item) fail(400, `العنصر ${index + 1} غير صالح.`);
      if (isV2) {
        if (!['text', 'shape', 'image', 'graphic', 'mogrt', 'color_matte', 'sfx'].includes(item.type)) {
          fail(400, `نوع العنصر ${index + 1} (${item.type}) غير مدعوم في المشهد v2.`);
        }
        if (item.type === 'sfx') {
          const sfxId = String(item.sfxId || '');
          if (!sfxIds.has(sfxId) && !extendedSfxIds.has(sfxId)) fail(400, `مؤثر صوتي غير معروف في العنصر ${index + 1}.`);
        }
        if (item.type === 'image' && item.imageData) {
          if (!/^data:image\/(webp|jpeg|png|jpg);base64,[A-Za-z0-9+/=]+$/.test(item.imageData)) {
            fail(400, `بيانات الصورة في العنصر ${index + 1} غير صالحة.`);
          }
        }
      } else {
        if (!['graphic', 'mogrt', 'color_matte', 'sfx'].includes(item.type)) fail(400, `نوع العنصر ${index + 1} غير مدعوم.`);
        const assetId = item.type === 'sfx' ? item.sfxId : (item.type === 'mogrt' || item.type === 'graphic' ? item.templateId : 'color_matte');
        if (!idPattern.test(String(assetId || ''))) fail(400, `معرّف الأصل في العنصر ${index + 1} غير صالح.`);
        if ((item.type === 'mogrt' || item.type === 'graphic') && !mogrtIds.has(assetId)) fail(400, `قالب غير معروف في العنصر ${index + 1}.`);
        if (item.type === 'sfx' && !sfxIds.has(assetId) && !extendedSfxIds.has(assetId)) fail(400, `مؤثر صوتي غير معروف في العنصر ${index + 1}.`);
        if (['graphic', 'mogrt', 'color_matte'].includes(item.type)) {
          const png = String(item.renderedPng || '');
          if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(png)) fail(400, `الصورة الجاهزة للطبقة ${index + 1} غير موجودة. أعد إرسال المشهد من الموقع بعد تحديثه.`);
          if (png.length > 6 * 1024 * 1024) fail(413, `الصورة الجاهزة للطبقة ${index + 1} كبيرة جداً.`);
        }
      }
      for (const key of ['trackIndex', 'startTime', 'duration']) {
        const value = Number(item[key]);
        if (!Number.isFinite(value) || value < 0 || (key === 'duration' && value === 0)) fail(400, `قيمة ${key} في العنصر ${index + 1} غير صالحة.`);
      }
      if (Number(item.startTime) + Number(item.duration) > 180) fail(400, `العنصر ${index + 1} يتجاوز حد مدة المشهد.`);
    }
    if (scene.music != null) {
      if (!scene.music || !musicIds.has(String(scene.music.musicId || ''))) fail(400, 'اختيار موسيقى الخلفية غير معروف.');
      const volume = Number(scene.music.volume);
      if (!Number.isFinite(volume) || volume < 0.05 || volume > 0.8) fail(400, 'مستوى موسيقى الخلفية غير صالح.');
      const duration = Number(scene.music.duration);
      if (!Number.isFinite(duration) || duration < 1 || duration > 180) fail(400, 'مدة موسيقى الخلفية غير صالحة.');
    }
    const serialized = JSON.stringify(scene);
    if (serialized.length > 18 * 1024 * 1024) fail(413, 'حجم ملفات المشهد أكبر من الحد المسموح. قلل عدد الطبقات الرسومية.');
    return scene;
  }

  fail(400, 'المشهد يجب أن يحتوي على قائمة طبقات صالحة (layers أو elements).');
}

async function submitMotionScene(ctx) {
  const account = await authenticate(ctx);
  const ttlSeconds = Math.max(300, Math.min(86400 * 7, Number(ctx.body?.ttl) || 86400)); // Default 24 hours (86400s)

  // Support chunked payloads under KV limits
  if (ctx.body && ctx.body.chunkId && Number.isInteger(ctx.body.chunkIndex) && Number.isInteger(ctx.body.totalChunks)) {
    const { chunkId, chunkIndex, totalChunks, chunkData } = ctx.body;
    if (totalChunks < 1 || totalChunks > 50 || chunkIndex < 0 || chunkIndex >= totalChunks) {
      fail(400, 'بيانات الجزء غير صالحة.');
    }
    const chunkKey = `motion_chunk:${account.uid}:${chunkId}:${chunkIndex}`;
    await ctx.env.MICKEY_STATE.put(chunkKey, String(chunkData || ''), { expirationTtl: 900 });

    if (chunkIndex === totalChunks - 1) {
      let fullJson = '';
      for (let i = 0; i < totalChunks; i++) {
        const part = await ctx.env.MICKEY_STATE.get(`motion_chunk:${account.uid}:${chunkId}:${i}`);
        if (!part) fail(400, `تعذر استلام الجزء ${i + 1} من ${totalChunks}. أعد إرسال المشهد.`);
        fullJson += part;
      }
      for (let i = 0; i < totalChunks; i++) {
        const cleanupKey = `motion_chunk:${account.uid}:${chunkId}:${i}`;
        if (ctx.waitUntil) ctx.waitUntil(ctx.env.MICKEY_STATE.delete(cleanupKey));
        else ctx.env.MICKEY_STATE.delete(cleanupKey).catch(() => {});
      }
      const parsed = JSON.parse(fullJson);
      const scene = validateMotionScene(parsed.scene || parsed);
      const version = Number(parsed.version) || Number(scene.version) || 2;
      scene.version = version;
      const assetsBaseUrl = String(parsed.assetsBaseUrl || ctx.body.assetsBaseUrl || '').replace(/\/$/, '');
      const contentHash = String(parsed.contentHash || ctx.body.contentHash || '');
      const mode = String(parsed.mode || ctx.body.mode || 'editable');
      const target = String(parsed.target || ctx.body.target || 'playhead');
      const createNestedSequence = Boolean(parsed.createNestedSequence || ctx.body.createNestedSequence);
      const isUpdate = Boolean(parsed.isUpdate || ctx.body.isUpdate);
      const versionNumber = Number(parsed.versionNumber || ctx.body.versionNumber || version);
      const diffSummary = parsed.diffSummary || ctx.body.diffSummary || null;
      const jobId = crypto.randomUUID();
      const sceneId = String(scene.id || jobId);
      const record = {
        jobId,
        sceneId,
        scene,
        version,
        isUpdate,
        versionNumber,
        diffSummary,
        contentHash,
        mode,
        target,
        createNestedSequence,
        assetsBaseUrl,
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlSeconds * 1000
      };
      const recordStr = JSON.stringify(record);
      await ctx.env.MICKEY_STATE.put(`motion_scene:${account.uid}`, recordStr, { expirationTtl: ttlSeconds });
      await ctx.env.MICKEY_STATE.put(`motion_scene_by_id:${sceneId}`, recordStr, { expirationTtl: ttlSeconds });
      if (jobId !== sceneId) {
        await ctx.env.MICKEY_STATE.put(`motion_scene_by_id:${jobId}`, recordStr, { expirationTtl: ttlSeconds });
      }

      // Offline queue for disconnected/unpaired extension delivery
      try {
        let queue = await ctx.env.MICKEY_STATE.get(`motion_queue:${account.uid}`, 'json') || [];
        queue = queue.filter(q => q.jobId !== jobId && q.expiresAt > Date.now());
        queue.push({
          jobId,
          sceneId,
          isUpdate,
          versionNumber,
          createdAt: record.createdAt,
          expiresAt: record.expiresAt
        });
        if (queue.length > 20) queue = queue.slice(-20);
        await ctx.env.MICKEY_STATE.put(`motion_queue:${account.uid}`, JSON.stringify(queue), { expirationTtl: ttlSeconds });
      } catch (_) {}

      // Update user recent works list
      try {
        let recent = await ctx.env.MICKEY_STATE.get(`user_recent_assets:${account.uid}`, 'json') || [];
        recent = recent.filter(item => item.id !== sceneId);
        recent.unshift({
          id: sceneId,
          type: 'scene',
          title: scene.name || 'Motion Scene',
          versionNumber: versionNumber,
          isUpdate: isUpdate,
          duration: scene.duration || 5,
          layersCount: (scene.layers && scene.layers.length) || 0,
          createdAt: Date.now()
        });
        if (recent.length > 20) recent = recent.slice(0, 20);
        await ctx.env.MICKEY_STATE.put(`user_recent_assets:${account.uid}`, JSON.stringify(recent), { expirationTtl: 86400 * 30 });
      } catch (_) {}

      return json({
        success: true,
        jobId,
        sceneId,
        status: 'pending',
        version,
        isUpdate,
        versionNumber,
        contentHash,
        expiresAt: record.expiresAt,
        message: 'المشهد القابل للتعديل جاهز للاستلام من إضافة Premiere.'
      }, 200, ctx.headers);
    }
    return json({ success: true, status: 'chunk_received', chunkIndex, totalChunks }, 200, ctx.headers);
  }

  // Standard non-chunked submission
  const scene = validateMotionScene(ctx.body.scene);
  const version = Number(ctx.body.version) || Number(scene.version) || 2;
  scene.version = version;
  const assetsBaseUrl = String(ctx.body.assetsBaseUrl || '').replace(/\/$/, '');
  const contentHash = String(ctx.body.contentHash || '');
  const mode = String(ctx.body.mode || 'editable');
  const target = String(ctx.body.target || 'playhead');
  const createNestedSequence = Boolean(ctx.body.createNestedSequence);
  const isUpdate = Boolean(ctx.body.isUpdate);
  const versionNumber = Number(ctx.body.versionNumber || version);
  const diffSummary = ctx.body.diffSummary || null;
  const jobId = crypto.randomUUID();
  const sceneId = String(scene.id || jobId);
  const record = {
    jobId,
    sceneId,
    scene,
    version,
    isUpdate,
    versionNumber,
    diffSummary,
    contentHash,
    mode,
    target,
    createNestedSequence,
    assetsBaseUrl,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlSeconds * 1000
  };
  const recordStr = JSON.stringify(record);
  await ctx.env.MICKEY_STATE.put(`motion_scene:${account.uid}`, recordStr, { expirationTtl: ttlSeconds });
  await ctx.env.MICKEY_STATE.put(`motion_scene_by_id:${sceneId}`, recordStr, { expirationTtl: ttlSeconds });
  if (jobId !== sceneId) {
    await ctx.env.MICKEY_STATE.put(`motion_scene_by_id:${jobId}`, recordStr, { expirationTtl: ttlSeconds });
  }

  // Offline queue for disconnected/unpaired extension delivery
  try {
    let queue = await ctx.env.MICKEY_STATE.get(`motion_queue:${account.uid}`, 'json') || [];
    queue = queue.filter(q => q.jobId !== jobId && q.expiresAt > Date.now());
    queue.push({
      jobId,
      sceneId,
      isUpdate,
      versionNumber,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt
    });
    if (queue.length > 20) queue = queue.slice(-20);
    await ctx.env.MICKEY_STATE.put(`motion_queue:${account.uid}`, JSON.stringify(queue), { expirationTtl: ttlSeconds });
  } catch (_) {}

  // Update user recent works list
  try {
    let recent = await ctx.env.MICKEY_STATE.get(`user_recent_assets:${account.uid}`, 'json') || [];
    recent = recent.filter(item => item.id !== sceneId);
    recent.unshift({
      id: sceneId,
      type: 'scene',
      title: scene.name || 'Motion Scene',
      versionNumber: versionNumber,
      isUpdate: isUpdate,
      duration: scene.duration || 5,
      layersCount: (scene.layers && scene.layers.length) || 0,
      createdAt: Date.now()
    });
    if (recent.length > 20) recent = recent.slice(0, 20);
    await ctx.env.MICKEY_STATE.put(`user_recent_assets:${account.uid}`, JSON.stringify(recent), { expirationTtl: 86400 * 30 });
  } catch (_) {}

  return json({
    success: true,
    jobId,
    sceneId,
    status: 'pending',
    version,
    isUpdate,
    versionNumber,
    contentHash,
    expiresAt: record.expiresAt,
    message: 'المشهد جاهز للاستلام من إضافة Premiere.'
  }, 200, ctx.headers);
}

async function pollMotionScene(ctx) {
  const account = await authenticate(ctx);
  const requestedSceneId = String(ctx.url.searchParams.get('sceneId') || ctx.body?.sceneId || '').trim();
  let record = null;
  let key = '';
  if (requestedSceneId) {
    key = `motion_scene_by_id:${requestedSceneId}`;
    record = await ctx.env.MICKEY_STATE.get(key, 'json');
  } else {
    key = `motion_scene:${account.uid}`;
    record = await ctx.env.MICKEY_STATE.get(key, 'json');

    // Offline queue fallback: if main pending scene is empty, pop from motion_queue
    if (!record) {
      try {
        let queue = await ctx.env.MICKEY_STATE.get(`motion_queue:${account.uid}`, 'json') || [];
        queue = queue.filter(q => q.expiresAt > Date.now());
        if (queue.length > 0) {
          const nextItem = queue[0];
          record = await ctx.env.MICKEY_STATE.get(`motion_scene_by_id:${nextItem.jobId}`, 'json');
          if (!record && nextItem.sceneId) {
            record = await ctx.env.MICKEY_STATE.get(`motion_scene_by_id:${nextItem.sceneId}`, 'json');
          }
        }
      } catch (_) {}
    }
  }

  if (!record || record.expiresAt < Date.now()) {
    if (record) await ctx.env.MICKEY_STATE.delete(key);
    return json({ success: true, status: 'empty' }, 200, ctx.headers);
  }
  return json({
    success: true,
    status: 'pending',
    jobId: record.jobId,
    sceneId: record.sceneId || record.scene?.id || record.jobId,
    scene: record.scene,
    version: record.version || record.scene?.version || 2,
    isUpdate: Boolean(record.isUpdate),
    versionNumber: record.versionNumber || record.version || 2,
    diffSummary: record.diffSummary || null,
    contentHash: record.contentHash || '',
    mode: record.mode || 'editable',
    target: record.target || 'playhead',
    createNestedSequence: !!record.createNestedSequence,
    assetsBaseUrl: record.assetsBaseUrl || '',
    audioAssetEndpoint: `${ctx.url.origin}${ctx.url.pathname}`,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt
  }, 200, ctx.headers);
}

async function extendMotionSceneTtl(ctx) {
  const account = await authenticate(ctx);
  const sceneId = String(ctx.body?.sceneId || ctx.url.searchParams.get('sceneId') || '').trim();
  const jobId = String(ctx.body?.jobId || ctx.url.searchParams.get('jobId') || '').trim();
  let key = sceneId ? `motion_scene_by_id:${sceneId}` : (jobId ? `motion_scene_by_id:${jobId}` : `motion_scene:${account.uid}`);
  let record = await ctx.env.MICKEY_STATE.get(key, 'json');
  if (!record && !sceneId && !jobId) {
    record = await ctx.env.MICKEY_STATE.get(`motion_scene:${account.uid}`, 'json');
  }
  if (!record) {
    return json({ success: false, error: 'المشهد غير موجود أو انتهت صلاحيته.' }, 404, ctx.headers);
  }
  const additionalTtl = 86400; // 24 hours
  record.expiresAt = Date.now() + additionalTtl * 1000;
  const serialized = JSON.stringify(record);
  await ctx.env.MICKEY_STATE.put(`motion_scene:${account.uid}`, serialized, { expirationTtl: additionalTtl });
  if (record.sceneId) {
    await ctx.env.MICKEY_STATE.put(`motion_scene_by_id:${record.sceneId}`, serialized, { expirationTtl: additionalTtl });
  }
  if (record.jobId) {
    await ctx.env.MICKEY_STATE.put(`motion_scene_by_id:${record.jobId}`, serialized, { expirationTtl: additionalTtl });
  }
  return json({
    success: true,
    message: 'تم تمديد صلاحية المشهد بنجاح لـ 24 ساعة إضافية.',
    expiresAt: record.expiresAt
  }, 200, ctx.headers);
}

async function motionAudioAsset(ctx) {
  const kind = String(ctx.url.searchParams.get('kind') || '');
  const id = String(ctx.url.searchParams.get('id') || '');
  const musicIds = new Set(['social_upbeat', 'kids_playful', 'tech_corporate', 'luxury_ambient', 'cyber_drive', 'cinematic_inspire', 'stats_pulse']);
  const sfxIds = new Set(['whoosh', 'pop', 'click', 'riser', 'impact', 'sparkle', 'soft_whoosh', 'swipe', 'bass_hit', 'notification']);
  if (!['music', 'sfx'].includes(kind) || !(kind === 'music' ? musicIds : sfxIds).has(id)) return json({ success: false, error: 'ملف صوتي غير معروف.' }, 404, ctx.headers);
  const base = String(ctx.env.MOTION_AUDIO_BASE_URL || 'https://mickey-studio-eta.vercel.app/assets/motion-audio').replace(/\/+$/, '');
  let parsed;
  try { parsed = new URL(base); } catch { return json({ success: false, error: 'رابط مكتبة الصوت غير مضبوط على الخادم.' }, 503, ctx.headers); }
  if (parsed.protocol !== 'https:') return json({ success: false, error: 'يجب أن يكون مصدر ملفات الصوت HTTPS.' }, 503, ctx.headers);
  const upstream = await fetch(`${base}/${kind}/${encodeURIComponent(id)}.wav`, { cf: { cacheTtl: 86400, cacheEverything: true } }).catch(() => null);
  if (!upstream?.ok) return json({ success: false, error: `ملف الصوت ${id} غير متاح حالياً.` }, 404, ctx.headers);
  const headers = new Headers(ctx.headers);
  headers.set('Content-Type', 'audio/wav');
  headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return new Response(await upstream.arrayBuffer(), { status: 200, headers });
}

async function acknowledgeMotionScene(ctx) {
  const account = await authenticate(ctx);
  const jobId = String(ctx.body?.jobId || '');
  const key = `motion_scene:${account.uid}`;
  const record = await ctx.env.MICKEY_STATE.get(key, 'json');
  if (record && record.jobId === jobId) {
    await ctx.env.MICKEY_STATE.delete(key);
  }

  // Advance the offline queue
  try {
    let queue = await ctx.env.MICKEY_STATE.get(`motion_queue:${account.uid}`, 'json') || [];
    queue = queue.filter(q => q.jobId !== jobId && q.expiresAt > Date.now());
    if (queue.length > 0) {
      await ctx.env.MICKEY_STATE.put(`motion_queue:${account.uid}`, JSON.stringify(queue), { expirationTtl: 86400 });
      // Preload next queued item into motion_scene:${account.uid}
      const nextItem = queue[0];
      const nextRecordStr = await ctx.env.MICKEY_STATE.get(`motion_scene_by_id:${nextItem.jobId}`);
      if (nextRecordStr) {
        await ctx.env.MICKEY_STATE.put(`motion_scene:${account.uid}`, nextRecordStr, { expirationTtl: 86400 });
      }
    } else {
      await ctx.env.MICKEY_STATE.delete(`motion_queue:${account.uid}`);
    }
  } catch (_) {}

  return json({ success: true, status: 'complete' }, 200, ctx.headers);
}

async function handleUserRecentAssets(ctx) {
  const account = await authenticate(ctx);
  const key = `user_recent_assets:${account.uid}`;
  let recent = await ctx.env.MICKEY_STATE.get(key, 'json') || [];

  if (ctx.request.method === 'POST') {
    const asset = ctx.body?.asset || ctx.body;
    if (asset && (asset.id || asset.title)) {
      const assetId = String(asset.id || ('ast_' + Date.now().toString(36)));
      recent = recent.filter(item => item.id !== assetId);
      recent.unshift({
        id: assetId,
        type: String(asset.type || 'image'),
        title: String(asset.title || 'عنصر جديد'),
        url: String(asset.url || ''),
        versionNumber: Number(asset.versionNumber) || 1,
        duration: Number(asset.duration) || 0,
        createdAt: Date.now()
      });
      if (recent.length > 20) recent = recent.slice(0, 20);
      await ctx.env.MICKEY_STATE.put(key, JSON.stringify(recent), { expirationTtl: 86400 * 30 });
    }
  }

  return json({
    success: true,
    assets: recent
  }, 200, ctx.headers);
}

async function handleClientErrorLog(ctx) {
  const { env, body, headers, requestId } = ctx;
  const message = typeof body?.message === 'string' ? body.message.slice(0, 500) : 'Unknown error';
  const source = typeof body?.source === 'string' ? body.source.slice(0, 200) : 'unknown';
  const lineno = Number(body?.lineno) || 0;
  const colno = Number(body?.colno) || 0;
  const stack = typeof body?.stack === 'string' ? body.stack.slice(0, 1500) : '';
  const userAgent = typeof body?.userAgent === 'string' ? body.userAgent.slice(0, 200) : 'unknown';
  const timestamp = body?.timestamp || nowIso();

  // Strip any accidental keys, tokens or secrets (Strict Privacy: Zero personal data)
  const sanitizedMsg = message.replace(/(key|token|bearer|password|auth|secret)=[^\s&]+/gi, '$1=REDACTED');
  const sanitizedStack = stack.replace(/(key|token|bearer|password|auth|secret)=[^\s&]+/gi, '$1=REDACTED');

  const logEntry = {
    message: sanitizedMsg,
    source,
    lineno,
    colno,
    stack: sanitizedStack,
    userAgent,
    timestamp,
    requestId
  };

  const kv = env.MICKEY_STATE || env.MICKEY_KV;
  if (kv) {
    try {
      const key = `error_log:${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await kv.put(key, JSON.stringify(logEntry), { expirationTtl: 7 * 86400 });
    } catch (_) {}
  }

  return json({ success: true, logged: true }, 200, headers, requestId);
}

async function motionAiGenerate(ctx) {
  const prompt = String(ctx.body.prompt || '').trim();
  if (!prompt) return json({ success: false, error: 'اكتب فكرة أو وصف المشهد أولاً.', code: 'EMPTY_PROMPT' }, 400, ctx.headers, ctx.requestId, ctx);
  if (prompt.length > 3000) return json({ success: false, error: 'وصف المشهد يتجاوز الحد الأقصى (3000 حرف).', code: 'PROMPT_TOO_LONG' }, 400, ctx.headers, ctx.requestId, ctx);

  const aspectRatio = String(ctx.body.aspectRatio || '16:9').trim();
  const dimensions = {
    '16:9': { w: 1920, h: 1080 },
    '9:16': { w: 1080, h: 1920 },
    '1:1': { w: 1080, h: 1080 },
    '4:5': { w: 1080, h: 1350 }
  }[aspectRatio] || { w: 1920, h: 1080 };

  const brand = ctx.body.brandKit || {};
  const brandPrimary = brand.colors?.primary || '#6366f1';
  const brandSecondary = brand.colors?.secondary || '#06b6d4';
  const brandAccent = brand.colors?.accent || '#f59e0b';
  const brandDark = brand.colors?.dark || '#0b0d14';
  const brandFontHeading = brand.fonts?.heading || 'Readex Pro';
  const brandFontBody = brand.fonts?.body || 'Tajawal';

  const systemInstructions = `You are an expert motion graphics designer generating a deterministic Motion Scene JSON v2 for Mickey Studio.
Return STRICT RAW JSON ONLY. No markdown, no triple backticks, no explanations.

SCENE SCHEMA V2 REQUIREMENTS:
- version: 2 (MUST BE EXACTLY 2)
- id: unique string starting with "sc_ai_"
- name: concise Arabic title
- width: ${dimensions.w}
- height: ${dimensions.h}
- fps: 30
- duration: number in seconds (between 3.0 and 8.0)
- background: { "type": "color" | "gradient", "color": "#hex", "colors": ["#hex1", "#hex2"], "angle": 135 }
- layers: Array of layer objects, ordered back-to-front (first layer rendered on bottom, last on top).
  Every layer MUST have:
  - id: unique string (e.g. "layer_bg", "layer_title", "layer_sub")
  - type: "text" | "shape" | "counter"
  - name: descriptive Arabic name
  - start: number in seconds (e.g. 0.0, 0.3)
  - duration: number in seconds (<= scene duration)
  - transform: { "x": number, "y": number, "w": number, "h": number, "rotation": 0, "scaleX": 1, "scaleY": 1, "anchorX": 0.5, "anchorY": 0.5, "opacity": 1 }
  - style:
    For text: { "fill": "#hex" | "brand.primary", "font": "${brandFontHeading}" | "${brandFontBody}" | "Cairo" | "Almarai" | "Inter", "fontSize": number (28-90), "fontWeight": "700"|"500"|"400", "align": "center"|"right"|"left", "direction": "rtl"|"ltr" }
    For shape: { "fill": "#hex", "stroke": "#hex", "strokeWidth": number, "radius": number }
    For counter: { "fill": "#hex", "font": "Inter", "fontSize": number, "fontWeight": "900", "align": "center", "direction": "ltr" }
  - content:
    For text: { "text": "العنوان أو النص العربي" }
    For shape: { "shape": "rounded-rect" | "circle" | "rect" | "donut" | "arrow" }
    For counter: { "startVal": 0, "endVal": number, "prefix": "", "suffix": "", "decimals": 0, "separator": "," }
  - presets: (OPTIONAL animations)
    in: { "name": "fade" | "slideUp" | "slideDown" | "slideLeft" | "slideRight" | "pop" | "rotate" | "blur" | "typewriter" | "wordByWord" | "cascade" | "bounce" | "elastic", "dur": 0.5 }
    out: { "name": "fade" | "slideUp" | "slideDown" | "pop", "dur": 0.4 }
    loop: { "name": "float" | "pulse" | "shake", "dur": 2.0 }

FEW-SHOT EXAMPLES:

Example 1 (Title/Intro, 16:9):
{
  "version": 2,
  "id": "sc_ai_title",
  "name": "مقدمة احترافية",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "duration": 5.0,
  "background": { "type": "color", "color": "${brandDark}" },
  "layers": [
    {
      "id": "bg_glow",
      "type": "shape",
      "name": "وهج خلفي",
      "start": 0,
      "duration": 5.0,
      "transform": { "x": 960, "y": 540, "w": 800, "h": 400, "rotation": 0, "scaleX": 1, "scaleY": 1, "anchorX": 0.5, "anchorY": 0.5, "opacity": 0.3 },
      "style": { "fill": "${brandPrimary}", "radius": 40 },
      "content": { "shape": "rounded-rect" },
      "presets": { "in": { "name": "pop", "dur": 0.8 }, "loop": { "name": "pulse", "dur": 3.0 } }
    },
    {
      "id": "title_main",
      "type": "text",
      "name": "العنوان الرئيسي",
      "start": 0.3,
      "duration": 4.7,
      "transform": { "x": 960, "y": 500, "w": 1400, "h": 120, "rotation": 0, "scaleX": 1, "scaleY": 1, "anchorX": 0.5, "anchorY": 0.5, "opacity": 1 },
      "style": { "fill": "#ffffff", "font": "${brandFontHeading}", "fontSize": 68, "fontWeight": "700", "align": "center", "direction": "rtl" },
      "content": { "text": "استوديو ميكي لإنتاج الموشن جرافيك" },
      "presets": { "in": { "name": "fade", "dur": 0.6 } }
    },
    {
      "id": "title_sub",
      "type": "text",
      "name": "العنوان الفرعي",
      "start": 0.6,
      "duration": 4.4,
      "transform": { "x": 960, "y": 620, "w": 1200, "h": 60, "rotation": 0, "scaleX": 1, "scaleY": 1, "anchorX": 0.5, "anchorY": 0.5, "opacity": 1 },
      "style": { "fill": "${brandSecondary}", "font": "${brandFontBody}", "fontSize": 32, "fontWeight": "500", "align": "center", "direction": "rtl" },
      "content": { "text": "سرعة، دقة، وهوية بصرية متكاملة" },
      "presets": { "in": { "name": "slideUp", "dur": 0.5 } }
    }
  ]
}

Example 2 (Lower Third, 16:9):
{
  "version": 2,
  "id": "sc_ai_lt",
  "name": "شريط تعريفي أنيق",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "duration": 6.0,
  "background": { "type": "transparent" },
  "layers": [
    {
      "id": "lt_card",
      "type": "shape",
      "name": "بطاقة الشريط",
      "start": 0.2,
      "duration": 5.6,
      "transform": { "x": 480, "y": 920, "w": 720, "h": 100, "rotation": 0, "scaleX": 1, "scaleY": 1, "anchorX": 0.5, "anchorY": 0.5, "opacity": 0.95 },
      "style": { "fill": "${brandDark}", "stroke": "${brandPrimary}", "strokeWidth": 2, "radius": 16 },
      "content": { "shape": "rounded-rect" },
      "presets": { "in": { "name": "slideUp", "dur": 0.4 }, "out": { "name": "slideDown", "dur": 0.4 } }
    },
    {
      "id": "lt_name",
      "type": "text",
      "name": "اسم الضيف",
      "start": 0.4,
      "duration": 5.3,
      "transform": { "x": 480, "y": 895, "w": 660, "h": 40, "rotation": 0, "scaleX": 1, "scaleY": 1, "anchorX": 0.5, "anchorY": 0.5, "opacity": 1 },
      "style": { "fill": "#ffffff", "font": "${brandFontHeading}", "fontSize": 34, "fontWeight": "700", "align": "right", "direction": "rtl" },
      "content": { "text": "د. أحمد خليل" },
      "presets": { "in": { "name": "fade", "dur": 0.3 }, "out": { "name": "fade", "dur": 0.3 } }
    },
    {
      "id": "lt_title",
      "type": "text",
      "name": "الوصف والصفة",
      "start": 0.6,
      "duration": 5.1,
      "transform": { "x": 480, "y": 945, "w": 660, "h": 30, "rotation": 0, "scaleX": 1, "scaleY": 1, "anchorX": 0.5, "anchorY": 0.5, "opacity": 1 },
      "style": { "fill": "${brandAccent}", "font": "${brandFontBody}", "fontSize": 20, "fontWeight": "500", "align": "right", "direction": "rtl" },
      "content": { "text": "استشاري الذكاء الاصطناعي وصناعة المحتوى" },
      "presets": { "in": { "name": "fade", "dur": 0.3 }, "out": { "name": "fade", "dur": 0.3 } }
    }
  ]
}

Example 3 (Social Card, 1:1):
{
  "version": 2,
  "id": "sc_ai_social",
  "name": "كارت تفاعل وإنستغرام",
  "width": 1080,
  "height": 1080,
  "fps": 30,
  "duration": 5.0,
  "background": { "type": "color", "color": "${brandDark}" },
  "layers": [
    {
      "id": "card_bg",
      "type": "shape",
      "name": "خلفية الكارت",
      "start": 0.1,
      "duration": 4.8,
      "transform": { "x": 540, "y": 540, "w": 860, "h": 600, "rotation": 0, "scaleX": 1, "scaleY": 1, "anchorX": 0.5, "anchorY": 0.5, "opacity": 0.96 },
      "style": { "fill": "#141724", "stroke": "${brandPrimary}", "strokeWidth": 2, "radius": 24 },
      "content": { "shape": "rounded-rect" },
      "presets": { "in": { "name": "pop", "dur": 0.5 } }
    },
    {
      "id": "quote_text",
      "type": "text",
      "name": "نص الاقتباس",
      "start": 0.4,
      "duration": 4.5,
      "transform": { "x": 540, "y": 510, "w": 740, "h": 220, "rotation": 0, "scaleX": 1, "scaleY": 1, "anchorX": 0.5, "anchorY": 0.5, "opacity": 1 },
      "style": { "fill": "#ffffff", "font": "${brandFontHeading}", "fontSize": 40, "fontWeight": "700", "align": "center", "direction": "rtl" },
      "content": { "text": "النجاح يبدأ بخطوة إصرار واحدة." },
      "presets": { "in": { "name": "fade", "dur": 0.4 } }
    },
    {
      "id": "quote_author",
      "type": "text",
      "name": "قائل العبارة",
      "start": 0.7,
      "duration": 4.2,
      "transform": { "x": 540, "y": 660, "w": 700, "h": 50, "rotation": 0, "scaleX": 1, "scaleY": 1, "anchorX": 0.5, "anchorY": 0.5, "opacity": 1 },
      "style": { "fill": "${brandSecondary}", "font": "${brandFontBody}", "fontSize": 24, "fontWeight": "500", "align": "center", "direction": "rtl" },
      "content": { "text": "— حكمة اليوم" },
      "presets": { "in": { "name": "slideUp", "dur": 0.4 } }
    }
  ]
}`;

  const promptText = `${systemInstructions}\n\nUSER SCENE PROMPT:\n${prompt}\n\nStrictly output the Scene JSON v2 only:`;
  const rawResponse = await geminiText(ctx, promptText, 3200);

  if (!rawResponse) {
    return json({
      success: false,
      error: 'تعذر توليد المشهد من خدمة الذكاء الاصطناعي. تأكد من تفعيل مفتاح Gemini في إعدادات المنصة.',
      code: 'GEMINI_EMPTY_RESPONSE'
    }, 502, ctx.headers, ctx.requestId, ctx);
  }

  const cleaned = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_) {
    return json({
      success: true,
      raw: cleaned,
      parsed: null,
      provider: 'gemini-1.5-flash',
      quota: ctx.quota
    }, 200, ctx.headers, ctx.requestId, ctx);
  }

  return json({
    success: true,
    scene: parsed,
    raw: cleaned,
    provider: 'gemini-1.5-flash',
    quota: ctx.quota
  }, 200, ctx.headers, ctx.requestId, ctx);
}

async function motionAiEdit(ctx) {
  const instruction = String(ctx.body.instruction || '').trim();
  if (!instruction) return json({ success: false, error: 'اكتب التعديل المطلوب أولاً.', code: 'EMPTY_INSTRUCTION' }, 400, ctx.headers, ctx.requestId, ctx);
  if (instruction.length > 1500) return json({ success: false, error: 'وصف التعديل يتجاوز الحد الأقصى (1500 حرف).', code: 'INSTRUCTION_TOO_LONG' }, 400, ctx.headers, ctx.requestId, ctx);

  const scene = ctx.body.scene;
  if (!scene || typeof scene !== 'object') {
    return json({ success: false, error: 'بيانات المشهد الحالي غير صالحة للتعديل.', code: 'INVALID_SCENE' }, 400, ctx.headers, ctx.requestId, ctx);
  }

  // Sanitize scene to remove heavy image base64 data to protect privacy & keep payload tiny
  const sanitizedLayers = Array.isArray(scene.layers) ? scene.layers.map(l => {
    const copy = { ...l };
    if (copy.content && typeof copy.content === 'object' && copy.content.src) {
      copy.content = { ...copy.content, src: '[image_asset]' };
    }
    return copy;
  }) : [];

  const compactScene = {
    version: scene.version || 2,
    name: scene.name,
    width: scene.width,
    height: scene.height,
    duration: scene.duration,
    background: scene.background,
    layers: sanitizedLayers
  };

  const systemInstructions = `You are a motion graphics assistant modifying an existing Scene JSON v2.
Given the current scene and the user's edit instruction, return a STRICT JSON array of PATCH operations to apply.
Return RAW JSON ARRAY ONLY. No markdown backticks, no explanations.

ALLOWED OPERATIONS:
1. "set": Modify a specific path in the scene.
   {"op": "set", "path": "background.color", "value": "#1e3a8a"}
   {"op": "set", "path": "layers[0].style.fontSize", "value": 72}
   {"op": "set", "path": "layers[0].style.fill", "value": "#f59e0b"}
   {"op": "set", "path": "layers[0].content.text", "value": "نص جديد"}
   {"op": "set", "path": "layers[0].transform.y", "value": 600}
   {"op": "set", "path": "duration", "value": 8.0}
2. "merge": Merge an object into a target property.
   {"op": "merge", "path": "layers[0].transform", "value": {"scaleX": 1.2, "scaleY": 1.2}}
3. "add_layer": Add a new layer to the scene.
   {"op": "add_layer", "layer": { "id": "layer_new", "type": "shape", "name": "شريط إضافي", "start": 0.5, "duration": 4.0, "transform": {...}, "style": {...}, "content": {...} }}
4. "remove_layer": Remove a layer by its ID.
   {"op": "remove_layer", "id": "layer_id"}

EXAMPLE:
User instruction: "خلي العنوان أكبر وغيّر الخلفية للأزرق الداكن"
Output:
[
  { "op": "set", "path": "background.color", "value": "#0f172a" },
  { "op": "set", "path": "layers[0].style.fontSize", "value": 76 }
]`;

  const promptText = `${systemInstructions}\n\nCURRENT SCENE JSON:\n${JSON.stringify(compactScene)}\n\nUSER EDIT INSTRUCTION:\n${instruction}\n\nStrictly output the JSON array of patch operations:`;
  const rawResponse = await geminiText(ctx, promptText, 2000);

  if (!rawResponse) {
    return json({
      success: false,
      error: 'تعذر تطبيق التعديل بالذكاء الاصطناعي. أعد المحاولة بعد لحظات.',
      code: 'GEMINI_EMPTY_RESPONSE'
    }, 502, ctx.headers, ctx.requestId, ctx);
  }

  const cleaned = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let patches = null;
  try {
    patches = JSON.parse(cleaned);
    if (!Array.isArray(patches)) {
      if (patches && typeof patches === 'object' && Array.isArray(patches.patches)) {
        patches = patches.patches;
      } else if (patches && patches.op) {
        patches = [patches];
      }
    }
  } catch (_) {
    return json({
      success: false,
      error: 'أعاد الذكاء الاصطناعي صياغة غير صالحة لعمليات التعديل. أعد المحاولة بعبارة أخرى.',
      code: 'INVALID_PATCH_JSON',
      raw: cleaned
    }, 502, ctx.headers, ctx.requestId, ctx);
  }

  return json({
    success: true,
    patches: Array.isArray(patches) ? patches : [],
    message: 'تم استخراج التعديلات بنجاح',
    provider: 'gemini-1.5-flash',
    quota: ctx.quota
  }, 200, ctx.headers, ctx.requestId, ctx);
}

async function motionAiSuggest(ctx) {
  const scene = ctx.body.scene;
  const issues = Array.isArray(ctx.body.issues) ? ctx.body.issues : [];

  if (!scene || typeof scene !== 'object') {
    return json({ success: false, error: 'بيانات المشهد مطلوبة لتقديم الاقتراحات.', code: 'INVALID_SCENE' }, 400, ctx.headers, ctx.requestId, ctx);
  }

  const summary = {
    name: scene.name || 'المشهد',
    aspect: `${scene.width}x${scene.height}`,
    duration: scene.duration,
    bg: scene.background?.color || scene.background?.type || 'transparent',
    layersCount: scene.layers?.length || 0,
    textLayers: (scene.layers || []).filter(l => l.type === 'text').map(l => ({
      id: l.id,
      text: l.content?.text || '',
      fontSize: l.style?.fontSize,
      fill: l.style?.fill,
      duration: l.duration
    }))
  };

  const promptText = `You are a creative motion design director in Mickey Studio.
Analyze the following scene summary and detected design issues:
Scene: ${JSON.stringify(summary)}
Detected issues by code: ${JSON.stringify(issues)}

Provide 2-4 professional, friendly Arabic suggestions for visual improvement and polish (e.g. contrast, pacing, typography, layout, or animations).
Return a STRICT JSON array of objects:
[
  {
    "id": "sug_1",
    "type": "contrast" | "typography" | "animation" | "pacing" | "layout",
    "title": "عنوان موجز باللغة العربية",
    "description": "شرح لطيف واحترافي لكيفية تحسين العنصر",
    "autoFixAvailable": true,
    "patch": []
  }
]
STRICT RAW JSON ARRAY ONLY:`;

  const rawResponse = await geminiText(ctx, promptText, 1800);
  let suggestions = [];
  if (rawResponse) {
    const cleaned = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || []);
    } catch (_) {}
  }

  return json({
    success: true,
    suggestions,
    provider: 'gemini-1.5-flash',
    quota: ctx.quota
  }, 200, ctx.headers, ctx.requestId, ctx);
}

async function adminProviderKeys(ctx, save) {
  const account = await authenticate(ctx, true);
  let pool = await ctx.env.MICKEY_STATE.get('gemini_pool', 'json') || [];
  const firestorePool = parseProviderKeys(account.geminiProviderKeysJson);
  if (!pool.length && firestorePool.length) {
    pool = firestorePool;
    await ctx.env.MICKEY_STATE.put('gemini_pool', JSON.stringify(pool));
  }
  if (!save) {
    if (pool.length && account.geminiProviderKeysJson !== JSON.stringify(pool)) {
      await updateUserProfileField(account, ctx.env, 'geminiProviderKeysJson', { stringValue: JSON.stringify(pool) });
    }
    return json(await getGeminiKeys(ctx.env), 200, ctx.headers);
  }
  if (ctx.body.clearGemini) pool = [];
  const raw = ctx.body.geminiKeys ?? ctx.body.geminiKey ?? ctx.body.key ?? ctx.body.apiKey ?? '';
  const incoming = Array.isArray(raw) ? raw : String(raw).split(/[\r\n,;]+/);
  const existing = new Set(pool.map(item => item.key)); let added = 0;
  for (const candidateValue of incoming) {
    const candidate = String(candidateValue || '').trim();
    if (!/^[A-Za-z0-9_.-]{30,120}$/.test(candidate) || candidate.startsWith('mk_') || existing.has(candidate)) continue;
    existing.add(candidate);
    added++;
    pool.push({
      id: `key_${crypto.randomUUID()}`,
      key: candidate,
      label: ctx.body.label || `مفتاح #${pool.length + 1}`,
      status: 'active',
      added_at: nowIso(),
      requests_count: 0,
      success_count: 0,
      error_count: 0,
      last_error: null,
      last_error_at: null,
      last_success_at: null,
      cooldown_until: 0
    });
  }
  await updateUserProfileField(account, ctx.env, 'geminiProviderKeysJson', { stringValue: JSON.stringify(pool) });
  await ctx.env.MICKEY_STATE.put('gemini_pool', JSON.stringify(pool));
  const result = await getGeminiKeys(ctx.env);
  return json({ ...result, added_count: added }, 200, ctx.headers);
}
function parseProviderKeys(serialized) {
  try {
    const value = JSON.parse(serialized || '[]');
    return Array.isArray(value) ? value.filter(item => item && typeof item.key === 'string') : [];
  } catch { return []; }
}
async function deleteGeminiKey(ctx) {
  const account = await authenticate(ctx, true);
  const target = String(ctx.body.key_id || ctx.body.id || ctx.body.key || '');
  let pool = await ctx.env.MICKEY_STATE.get('gemini_pool', 'json') || [];
  if (!pool.length) pool = parseProviderKeys(account.geminiProviderKeysJson);
  const next = pool.filter(item => item.id !== target && item.key !== target);
  if (next.length === pool.length) return json({ success: false, message: 'لم يتم العثور على المفتاح المطلوب', gemini_pool: (await getGeminiKeys(ctx.env)).gemini_pool }, 200, ctx.headers);
  await updateUserProfileField(account, ctx.env, 'geminiProviderKeysJson', { stringValue: JSON.stringify(next) });
  await ctx.env.MICKEY_STATE.put('gemini_pool', JSON.stringify(next));
  return json({ success: true, message: 'تم حذف المفتاح من حوض التدوير بنجاح', gemini_pool: (await getGeminiKeys(ctx.env)).gemini_pool }, 200, ctx.headers);
}
async function testGeminiKey(ctx) {
  const account = await authenticate(ctx, true);
  const pool = await ctx.env.MICKEY_STATE.get('gemini_pool', 'json') || [];
  const item = pool.find(x => x.id === (ctx.body.key_id || ctx.body.id));
  const key = String(ctx.body.key || item?.key || '');
  if (!key) return json({ success: false, error: 'لم يتم تحديد مفتاح للفحص' }, 400, ctx.headers);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 5 } }) });
  const data = await readJson(response);
  if (item) {
    item.requests_count = (Number(item.requests_count) || 0) + 1;
    item.last_tested = nowIso();
    if (response.ok) {
      item.status = 'active';
      item.cooldown_until = 0;
      item.success_count = (Number(item.success_count) || 0) + 1;
      item.last_success_at = nowIso();
    } else {
      item.error_count = (Number(item.error_count) || 0) + 1;
      item.last_error = data.error?.message || `HTTP ${response.status}`;
      item.last_error_at = nowIso();
      if (response.status === 429 || response.status === 403) {
        item.status = 'cooling_down';
        item.cooldown_until = Date.now() + KEY_COOLDOWN_MS;
      } else {
        item.status = 'invalid';
      }
    }
    await updateUserProfileField(account, ctx.env, 'geminiProviderKeysJson', { stringValue: JSON.stringify(pool) });
    await ctx.env.MICKEY_STATE.put('gemini_pool', JSON.stringify(pool));
  }
  return json({
    success: response.ok,
    message: response.ok ? 'المفتاح يعمل بنجاح والصلاحية نشطة ✓' : undefined,
    error: response.ok ? undefined : (response.status === 429 ? 'تم استهلاك حصة هذا المفتاح (تم تفعيله في وضع التبريد المؤقت 15 دقيقة)' : 'مفتاح غير صالح أو معطل'),
    http_code: response.status,
    gemini_pool: (await getGeminiKeys(ctx.env)).gemini_pool
  }, 200, ctx.headers);
}
async function generateApiKey(ctx) {
  const account = await authenticate(ctx, true);
  const keys = await ctx.env.MICKEY_STATE.get('api_keys', 'json') || [];
  const entry = { id: `key_${Date.now()}`, key: `mk_live_${crypto.randomUUID().replaceAll('-', '')}`, name: String(ctx.body.name || 'مفتاح مطور جديد').slice(0, 100), created_at: nowIso(), last_used: null, requests_count: 0, status: 'active', uid: account.uid };
  keys.push(entry); await ctx.env.MICKEY_STATE.put('api_keys', JSON.stringify(keys));
  return json({ success: true, message: 'تم إنشاء مفتاح API بنجاح', key: entry }, 200, ctx.headers);
}
async function listApiKeys(ctx) { const keys = await ctx.env.MICKEY_STATE.get('api_keys', 'json') || []; return json({ success: true, keys }, 200, ctx.headers); }
async function revokeApiKey(ctx) {
  const target = ctx.body.key || ctx.body.id; const keys = await ctx.env.MICKEY_STATE.get('api_keys', 'json') || []; let changed = false;
  for (const item of keys) if (item.key === target || item.id === target) { item.status = 'revoked'; changed = true; }
  if (changed) await ctx.env.MICKEY_STATE.put('api_keys', JSON.stringify(keys));
  return json({ success: changed, message: changed ? 'تم إيقاف صلاحية المفتاح بنجاح' : 'لم يتم العثور على المفتاح' }, 200, ctx.headers);
}
function apiDocs(ctx) { return { title: 'Mickey Studio AI Gateway REST API', version: '4.0.0', description: 'واجهة برمجة تطبيقات للصور والصوت والتعليق الصوتي.', base_url: `${ctx.url.origin}/api.php`, auth_format: 'Authorization: Bearer mk_live_YOUR_KEY', endpoints: ['transcribe_audio', 'generate_image', 'generate_tts', 'enhance_prompt', 'refine_voiceover', 'status'] }; }

export class MickeyCoordinatorDO {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const action = new URL(request.url).pathname.slice(1);
    const body = await request.json().catch(() => ({}));
    try {
      let result;
      if (action === 'stage') {
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
      } else if (action === 'tool_quota') {
        const now = Date.now();
        const userId = String(body.userId || '');
        const tool = String(body.tool || 'images');
        const limit = Number(body.limit) || 20;
        const increment = body.increment !== false;
        const today = new Date(now).toISOString().slice(0, 10);

        const tomorrowUtc = new Date(Date.UTC(
          new Date(now).getUTCFullYear(),
          new Date(now).getUTCMonth(),
          new Date(now).getUTCDate() + 1
        ));
        const resetAt = tomorrowUtc.toISOString();
        const resetInHours = Math.max(1, Math.ceil((tomorrowUtc.getTime() - now) / 3600000));

        let used = 0;
        if (this.state.storage.sql) {
          try {
            this.state.storage.sql.exec(`
              CREATE TABLE IF NOT EXISTS user_tool_quotas (
                user_id TEXT,
                tool TEXT,
                day TEXT,
                count INTEGER,
                updated_at INTEGER,
                PRIMARY KEY (user_id, tool, day)
              );
            `);
            this.state.storage.sql.exec(`DELETE FROM user_tool_quotas WHERE updated_at < ?;`, now - 7 * 86400000);

            const row = this.state.storage.sql.exec(
              `SELECT count FROM user_tool_quotas WHERE user_id = ? AND tool = ? AND day = ?;`,
              userId, tool, today
            ).toArray()[0];

            used = row ? Number(row.count) : 0;

            if (increment) {
              if (used >= limit) {
                result = { allowed: false, tool, limit, used, remaining: 0, resetAt, resetInHours };
              } else {
                const newCount = used + 1;
                this.state.storage.sql.exec(
                  `INSERT OR REPLACE INTO user_tool_quotas (user_id, tool, day, count, updated_at) VALUES (?, ?, ?, ?, ?);`,
                  userId, tool, today, newCount, now
                );
                result = { allowed: true, tool, limit, used: newCount, remaining: Math.max(0, limit - newCount), resetAt, resetInHours };
              }
            } else {
              result = { allowed: used < limit, tool, limit, used, remaining: Math.max(0, limit - used), resetAt, resetInHours };
            }
          } catch (sqlErr) {
            console.warn('[CoordinatorDO:tool_quota] SQL fallback:', sqlErr);
          }
        }
        if (!result) {
          result = await this.state.storage.transaction(async txn => {
            const quotaKey = `q:${userId}:${tool}:${today}`;
            used = Number(await txn.get(quotaKey) || 0);
            if (increment) {
              if (used >= limit) {
                return { allowed: false, tool, limit, used, remaining: 0, resetAt, resetInHours };
              }
              const newCount = used + 1;
              await txn.put(quotaKey, newCount);
              return { allowed: true, tool, limit, used: newCount, remaining: Math.max(0, limit - newCount), resetAt, resetInHours };
            }
            return { allowed: used < limit, tool, limit, used, remaining: Math.max(0, limit - used), resetAt, resetInHours };
          });
        }
      } else if (action === 'get_all_tool_quotas') {
        const now = Date.now();
        const userId = String(body.userId || '');
        const limits = body.limits || { images: 20, voice: 30, transcription: 15, motion: 10 };
        const today = new Date(now).toISOString().slice(0, 10);
        const tomorrowUtc = new Date(Date.UTC(
          new Date(now).getUTCFullYear(),
          new Date(now).getUTCMonth(),
          new Date(now).getUTCDate() + 1
        ));
        const resetAt = tomorrowUtc.toISOString();
        const resetInHours = Math.max(1, Math.ceil((tomorrowUtc.getTime() - now) / 3600000));

        const quotas = {};
        for (const tool of ['images', 'voice', 'transcription', 'motion']) {
          const limit = Number(limits[tool]) || 20;
          let used = 0;
          if (this.state.storage.sql) {
            try {
              const row = this.state.storage.sql.exec(
                `SELECT count FROM user_tool_quotas WHERE user_id = ? AND tool = ? AND day = ?;`,
                userId, tool, today
              ).toArray()[0];
              used = row ? Number(row.count) : 0;
            } catch (_) {}
          } else {
            used = Number(await this.state.storage.get(`q:${userId}:${tool}:${today}`) || 0);
          }
          quotas[tool] = {
            limit,
            used,
            remaining: Math.max(0, limit - used),
            resetAt,
            resetInHours
          };
        }
        result = quotas;
      } else if (action === 'guest_status') {
        const now = Date.now();
        const today = new Date(now).toISOString().slice(0, 10);
        const state = await this.state.storage.get('guest') || { count: 0, day: today };
        const used = state.day === today ? (Number(state.count) || 0) : 0;
        result = { count: used };
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
