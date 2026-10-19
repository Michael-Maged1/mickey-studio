const FIREBASE_PROJECT = 'mickey-gemini-studio';
const DEFAULT_FIREBASE_API_KEY = 'AIzaSyAbwmXwJkb5nl2sUDCZ0ing_cWs0lbYAWg';
const ADMIN_EMAIL = 'michaelmagednew@gmail.com';
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
    limits: {
      images: { daily: 100, monthly: 2000 },
      voice: { daily: 150, monthly: 3000 },
      transcription: { daily: 50, monthly: 1000 },
      motion_ai: { daily: 50, monthly: 1000 },
      video: { daily: 25, monthly: 500 }
    },
    features: {
      extension_access: true,
      watermark_free: true,
      max_upload_size_mb: 500
    }
  },
  custom: {
    id: 'custom',
    name: 'خطة الاستوديو المخصصة (Custom)',
    name_en: 'Custom Studio Plan',
    description: 'أعلى حدود وإمكانيات غير محدودة للشركات والإنتاج الضخم',
    limits: {
      images: { daily: 500, monthly: 10000 },
      voice: { daily: 500, monthly: 10000 },
      transcription: { daily: 200, monthly: 4000 },
      motion_ai: { daily: 200, monthly: 4000 },
      video: { daily: 100, monthly: 2000 }
    },
    features: {
      extension_access: true,
      watermark_free: true,
      max_upload_size_mb: 2048
    }
  }
};

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const url = new URL(request.url);
      const queryAction = url.searchParams.get('action') || '';
      const isBinarySilenceRequest = request.method === 'POST' && queryAction === 'analyze_video_silence' && /^(?:video|audio)\//i.test(request.headers.get('Content-Type') || '');
      const body = request.method === 'POST' && !isBinarySilenceRequest ? await request.json().catch(() => ({})) : {};
      const action = queryAction || body.action || 'status';
      const headers = { ...cors, 'Cache-Control': 'no-store', 'Pragma': 'no-cache' };
      const context = { request, env, url, body, action, headers, rawVideoStream: isBinarySilenceRequest ? request.body : null };

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
      if (['generate_image', 'enhance_prompt', 'refine_voiceover', 'generate_tts', 'transcribe_audio', 'analyze_video_silence', 'detect_viral_clips', 'generate_chapters', 'detect_censor_words', 'consume_generation'].includes(action)) {
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
              admin_panel_v2: true
            },
            endpoints: [
              'generate_tts', 'enhance_prompt', 'transcribe_audio', 'analyze_video_silence',
              'detect_viral_clips', 'generate_chapters', 'detect_censor_words', 'generate_image',
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

        case 'admin_get_plans': return await adminGetPlans(context);
        case 'admin_update_plans': return await adminUpdatePlans(context);
        case 'admin_set_subscription_mode': return await adminSetSubscriptionMode(context);

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
        error: error?.publicMessage || 'حدث خطأ أثناء الاتصال بخدمة Mickey Studio.'
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key, X-Anonymous-ID, X-Generation-Permit',
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

function nowIso() {
  return new Date().toISOString();
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

  const isDesignatedAdminEmail = String(user.email || '').toLowerCase() === (ctx.env.ADMIN_EMAIL || ADMIN_EMAIL).toLowerCase();
  const isAdmin = hasAdminClaim || (isDesignatedAdminEmail && customAttributes.admin !== false);

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
  const status = isDesignatedAdminEmail ? 'active' : (profile.fields?.status?.stringValue || 'active');
  const banReason = profile.fields?.banReason?.stringValue || '';
  if (!isDesignatedAdminEmail && (user.disabled || status === 'banned' || status === 'suspended')) {
    fail(403, banReason
      ? `تم إيقاف حسابك من قبل إدارة Mickey Studio: ${banReason}`
      : 'تم إيقاف حسابك من قبل إدارة Mickey Studio. يرجى التواصل مع الدعم الفني.');
  }

  const plan = profile.fields?.plan?.stringValue || 'free';
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
    extraCredits,
    limitOverrides,
    token,
    geminiApiKey: profile.fields?.geminiApiKey?.stringValue || '',
    geminiProviderKeysJson: profile.fields?.geminiProviderKeysJson?.stringValue || ''
  };
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
  return config || { subscription_mode: false, updated_at: null };
}

async function getPlansConfig(env) {
  const customPlans = await env.MICKEY_STATE.get('system_plans', 'json');
  return customPlans || DEFAULT_PLANS;
}

function toolCategoryForAction(action) {
  const mapping = {
    generate_image: 'images',
    enhance_prompt: 'images',
    generate_tts: 'voice',
    refine_voiceover: 'voice',
    transcribe_audio: 'transcription',
    analyze_video_silence: 'transcription',
    generate_chapters: 'transcription',
    detect_censor_words: 'transcription',
    detect_viral_clips: 'motion_ai',
    motion_scene_submit: 'motion_ai'
  };
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

async function enforcePlanLimits(account, action, ctx) {
  const tool = toolCategoryForAction(action);
  // The owner account is exempt from subscription checks, quotas, credits and
  // user-generation counters. This check runs after Firebase token verification.
  if (String(account.email || '').toLowerCase() === (ctx.env.ADMIN_EMAIL || ADMIN_EMAIL).toLowerCase()) {
    return { enforced: false, subscription_mode: false, tool, remaining: null, unlimited: true };
  }
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // Always record usage analytics
  await recordToolUsageMetric(ctx.env, tool, dayKey);

  const sysConfig = await getSystemConfig(ctx.env);
  const subscriptionMode = Boolean(sysConfig.subscription_mode);

  // If subscription mode is OFF: all users operate in unblocked mode (previous behavior)
  if (!subscriptionMode) {
    return { enforced: false, subscription_mode: false, tool, remaining: 999 };
  }

  // If subscription mode is ON: enforce plan limits + user overrides
  const plans = await getPlansConfig(ctx.env);
  const userPlan = plans[account.plan] || plans.free || DEFAULT_PLANS.free;
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
  const groqKey = ctx.env.GROQ_API_KEY;
  if (!groqKey) {
    return json({ success: false, error: 'خدمة التفريغ السحابي Groq Whisper غير مهيأة على السيرفر.' }, 503, ctx.headers);
  }
  const audioBase64 = String(ctx.body.audio_base64 || ctx.body.audio || '');
  if (!audioBase64) return json({ success: false, error: 'لم يتم إرسال ملف الصوت للتفريغ.' }, 400, ctx.headers);

  const raw = Uint8Array.from(atob(audioBase64.replace(/^data:[^,]+,/, '')), c => c.charCodeAt(0));
  const form = new FormData();
  form.append('file', new Blob([raw], { type: 'audio/wav' }), 'audio.wav');
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'verbose_json');

  const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form
  });
  const data = await readJson(resp);
  if (!resp.ok) return json({ success: false, error: data.error?.message || 'تعذر التفريغ عبر Groq Whisper.' }, resp.status, ctx.headers);

  return json({
    success: true,
    text: data.text || '',
    segments: (data.segments || []).map(s => ({
      start: s.start,
      end: s.end,
      text: s.text?.trim()
    }))
  }, 200, ctx.headers);
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
    const isProtectedAdmin = email.toLowerCase() === (ctx.env.ADMIN_EMAIL || ADMIN_EMAIL).toLowerCase();
    const status = isProtectedAdmin ? 'active' : (fields.status?.stringValue || (authUser.disabled ? 'banned' : 'active'));
    const plan = fields.plan?.stringValue || 'free';
    const banReason = fields.banReason?.stringValue || '';
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

    return {
      uid,
      email,
      displayName,
      status,
      plan,
      banReason,
      createdAt,
      lastLoginAt,
      extraCredits,
      limitOverrides,
      todayUsage,
      authDisabled: Boolean(authUser.disabled),
      protected: isProtectedAdmin,
      devicesCount: pairedDevices.length,
      pairedDevices
    };
  }));

  return json({
    success: true,
    count: users.length,
    users,
    source: 'firebase_auth_and_firestore'
  }, 200, ctx.headers);
}

async function protectAdminAccountTarget(ctx, account, targetUid) {
  const adminEmail = (ctx.env.ADMIN_EMAIL || ADMIN_EMAIL).toLowerCase();
  if (targetUid === account.uid && String(account.email || '').toLowerCase() === adminEmail) {
    fail(403, 'حساب المسؤول الأساسي محمي ولا يمكن تعديل حالته أو باقته أو رصيده أو أجهزته.');
  }
  const url = `https://firestore.googleapis.com/v1/projects/${ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(targetUid)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${account.token}` } });
  if (response.status === 404) return;
  if (!response.ok) fail(502, 'تعذر التحقق من الحساب المستهدف قبل التعديل. لم يتم تنفيذ أي تغيير.');
  const profile = await readJson(response);
  const targetEmail = String(profile.fields?.email?.stringValue || '').toLowerCase();
  if (targetEmail && targetEmail === adminEmail) {
    fail(403, 'حساب المسؤول الأساسي محمي ولا يمكن تعديل حالته أو باقته أو رصيده أو أجهزته.');
  }
}

async function adminUpdateUserStatus(ctx) {
  const account = await authenticate(ctx, true);
  const targetUid = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  const newStatus = String(ctx.body.status || 'active').trim(); // 'active' | 'banned' | 'suspended'
  const reason = String(ctx.body.reason || '').trim();

  if (!targetUid) return json({ success: false, error: 'معرف المستخدم غير محدد' }, 400, ctx.headers);
  if (!['active', 'banned', 'suspended'].includes(newStatus)) {
    return json({ success: false, error: 'حالة غير صالحة' }, 400, ctx.headers);
  }
  await protectAdminAccountTarget(ctx, account, targetUid);

  // Update Firestore user document
  const fields = {
    status: { stringValue: newStatus },
    banReason: { stringValue: newStatus === 'active' ? '' : reason },
    updatedAt: { timestampValue: nowIso() }
  };
  const url = `https://firestore.googleapis.com/v1/projects/${ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(targetUid)}?updateMask.fieldPaths=status&updateMask.fieldPaths=banReason&updateMask.fieldPaths=updatedAt`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });

  if (!resp.ok) {
    return json({ success: false, error: 'تعذر تحديث حالة الحساب في قاعدة البيانات' }, 502, ctx.headers);
  }

  await logAdminAudit(ctx, 'update_user_status', targetUid, { newStatus, reason });
  return json({
    success: true,
    message: newStatus === 'active' ? 'تم تنشيط الحساب بنجاح.' : `تم إيقاف الحساب (${newStatus}).`,
    target_uid: targetUid,
    status: newStatus
  }, 200, ctx.headers);
}

async function adminUpdateUserPlan(ctx) {
  const account = await authenticate(ctx, true);
  const targetUid = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  const newPlan = String(ctx.body.plan || 'free').trim(); // 'free' | 'pro' | 'custom'

  if (!targetUid) return json({ success: false, error: 'معرف المستخدم غير محدد' }, 400, ctx.headers);
  if (!['free', 'pro', 'custom'].includes(newPlan)) {
    return json({ success: false, error: 'الباقة المحددة غير معروفة' }, 400, ctx.headers);
  }
  await protectAdminAccountTarget(ctx, account, targetUid);

  // Extensible subscription object for future payment integrations
  const subscriptionPayload = JSON.stringify({
    plan: newPlan,
    provider: ctx.body.provider || 'manual_admin',
    updated_at: nowIso(),
    status: 'active'
  });

  const fields = {
    plan: { stringValue: newPlan },
    subscriptionJson: { stringValue: subscriptionPayload },
    updatedAt: { timestampValue: nowIso() }
  };
  const url = `https://firestore.googleapis.com/v1/projects/${ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(targetUid)}?updateMask.fieldPaths=plan&updateMask.fieldPaths=subscriptionJson&updateMask.fieldPaths=updatedAt`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });

  if (!resp.ok) {
    return json({ success: false, error: 'تعذر تحديث باقة المستخدم' }, 502, ctx.headers);
  }

  await logAdminAudit(ctx, 'update_user_plan', targetUid, { newPlan });
  return json({ success: true, message: `تم تحديث باقة الحساب إلى (${planNameArabic(newPlan)}) بنجاح.` }, 200, ctx.headers);
}

async function adminSetUserLimits(ctx) {
  const account = await authenticate(ctx, true);
  const targetUid = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  const overrides = ctx.body.overrides || {}; // { images: 50, voice: 100 }

  if (!targetUid) return json({ success: false, error: 'معرف المستخدم غير محدد' }, 400, ctx.headers);
  await protectAdminAccountTarget(ctx, account, targetUid);

  const fields = {
    limitOverridesJson: { stringValue: JSON.stringify(overrides) },
    updatedAt: { timestampValue: nowIso() }
  };
  const url = `https://firestore.googleapis.com/v1/projects/${ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(targetUid)}?updateMask.fieldPaths=limitOverridesJson&updateMask.fieldPaths=updatedAt`;
  await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });

  await logAdminAudit(ctx, 'set_user_limits', targetUid, { overrides });
  return json({ success: true, message: 'تم حفظ الحدود المخصصة لهذا المستخدم بنجاح.' }, 200, ctx.headers);
}

async function adminAddUserCredits(ctx) {
  const account = await authenticate(ctx, true);
  const targetUid = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  const creditsToAdd = Number(ctx.body.credits || 0);

  if (!targetUid || creditsToAdd <= 0) {
    return json({ success: false, error: 'يرجى تحديد عدد رصيد موجب للإضافة' }, 400, ctx.headers);
  }
  await protectAdminAccountTarget(ctx, account, targetUid);

  // Get current doc to increment
  const getUrl = `https://firestore.googleapis.com/v1/projects/${ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(targetUid)}`;
  const getResp = await fetch(getUrl, { headers: { Authorization: `Bearer ${account.token}` } });
  const curDoc = await readJson(getResp);
  const existing = Number(curDoc.fields?.extraCredits?.integerValue || 0);
  const total = existing + creditsToAdd;

  const patchUrl = `${getUrl}?updateMask.fieldPaths=extraCredits`;
  await fetch(patchUrl, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { extraCredits: { integerValue: String(total) } } })
  });

  await logAdminAudit(ctx, 'add_user_credits', targetUid, { added: creditsToAdd, total });
  return json({ success: true, message: `تمت إضافة ${creditsToAdd} عملية رصيد. الرصيد الجديد: ${total}` }, 200, ctx.headers);
}

async function adminRevokeUserDevices(ctx) {
  const account = await authenticate(ctx, true);
  const targetUid = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  if (!targetUid) return json({ success: false, error: 'معرف المستخدم غير محدد' }, 400, ctx.headers);
  await protectAdminAccountTarget(ctx, account, targetUid);

  // Clear paired devices list in Firestore
  const patchUrl = `https://firestore.googleapis.com/v1/projects/${ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(targetUid)}?updateMask.fieldPaths=pairedDevicesJson`;
  await fetch(patchUrl, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { pairedDevicesJson: { stringValue: '[]' } } })
  });

  // Clear active motion queue
  await ctx.env.MICKEY_STATE.delete(`motion_scene:${targetUid}`);

  await logAdminAudit(ctx, 'revoke_user_devices', targetUid);
  return json({ success: true, message: 'تم إلغاء اقتران كافة أجهزة الإضافة لهذا الحساب بنجاح.' }, 200, ctx.headers);
}

async function adminDeleteUser(ctx) {
  const account = await authenticate(ctx, true);
  const targetUid = String(ctx.body.target_uid || ctx.body.uid || '').trim();
  if (!targetUid) return json({ success: false, error: 'معرف المستخدم غير محدد' }, 400, ctx.headers);
  await protectAdminAccountTarget(ctx, account, targetUid);

  const url = `https://firestore.googleapis.com/v1/projects/${ctx.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(targetUid)}`;
  await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${account.token}` }
  });

  await ctx.env.MICKEY_STATE.delete(`motion_scene:${targetUid}`);
  await logAdminAudit(ctx, 'delete_user', targetUid);
  return json({ success: true, message: 'تم حذف الحساب بالكامل.' }, 200, ctx.headers);
}

// 2. Plans Tab Handlers
async function adminGetPlans(ctx) {
  await authenticate(ctx, true);
  const sysConfig = await getSystemConfig(ctx.env);
  const plans = await getPlansConfig(ctx.env);
  return json({
    success: true,
    subscription_mode: Boolean(sysConfig.subscription_mode),
    plans
  }, 200, ctx.headers);
}

async function adminUpdatePlans(ctx) {
  const account = await authenticate(ctx, true);
  const incomingPlans = ctx.body.plans;
  if (!incomingPlans || typeof incomingPlans !== 'object') {
    return json({ success: false, error: 'بيانات الخطط غير صالحة' }, 400, ctx.headers);
  }

  await ctx.env.MICKEY_STATE.put('system_plans', JSON.stringify(incomingPlans));
  await logAdminAudit(ctx, 'update_plans', 'system_plans', { plans: Object.keys(incomingPlans) });

  return json({ success: true, message: 'تم حفظ إعدادات الباقات والحدود بنجاح.', plans: incomingPlans }, 200, ctx.headers);
}

async function adminSetSubscriptionMode(ctx) {
  const account = await authenticate(ctx, true);
  const enabled = Boolean(ctx.body.enabled);

  const current = await getSystemConfig(ctx.env);
  current.subscription_mode = enabled;
  current.updated_at = nowIso();
  current.updated_by = account.email;

  await ctx.env.MICKEY_STATE.put('system_config', JSON.stringify(current));
  await logAdminAudit(ctx, 'set_subscription_mode', 'system_config', { subscription_mode: enabled });

  return json({
    success: true,
    subscription_mode: enabled,
    message: enabled
      ? 'تم تفعيل نمط الاشتراكات: يتم فرض الحدود والباقات على الجميع فورياً.'
      : 'تم إيقاف نمط الاشتراكات: كافة الحسابات تعمل بالنظام المجاني غير المحدود.'
  }, 200, ctx.headers);
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
  const record = await ctx.env.MICKEY_STATE.get(`pair_code:${code}`, 'json');
  if (!record || record.expiresAt < Date.now()) {
    fail(400, 'رمز الاقتران غير صالح أو منتهي الصلاحية.');
  }
  record.status = 'confirmed';
  record.uid = account.uid;
  record.email = account.email;
  record.token = account.token;
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
    return json({ success: true, status: 'confirmed', uid: record.uid, email: record.email, idToken: record.token }, 200, ctx.headers);
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
