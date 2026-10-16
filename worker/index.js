const FIREBASE_PROJECT = 'mickey-gemini-studio';
const DEFAULT_FIREBASE_API_KEY = 'AIzaSyAbwmXwJkb5nl2sUDCZ0ing_cWs0lbYAWg';
const ADMIN_EMAIL = 'michaelmagednew@gmail.com';
const GEMINI_TTS_MODEL = 'gemini-3.8-flash-tts';

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const url = new URL(request.url);
      const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
      const action = url.searchParams.get('action') || body.action || 'status';
      const headers = { ...cors, 'Cache-Control': 'no-store', 'Pragma': 'no-cache' };
      const context = { request, env, url, body, action, headers };

      if (url.pathname === '/generate') return await generateFluxImage(context);

      if (['generate_image', 'enhance_prompt', 'refine_voiceover', 'generate_tts', 'transcribe_audio', 'analyze_video_silence', 'consume_generation'].includes(action)) {
        context.access = await enforceGenerationAccess(context);
      }
      if (['list_api_keys', 'revoke_api_key'].includes(action)) context.account = await authenticate(context, true);

      switch (action) {
        case 'status': return json({ success: true, status: 'online', server: 'Mickey Studio AI Gateway', version: '4.0.0', endpoints: ['generate_tts', 'enhance_prompt', 'transcribe_audio', 'analyze_video_silence', 'generate_image', 'refine_voiceover'] }, 200, headers);
        case 'get_gemini_keys': case 'get_gemini_key': return json(await getGeminiKeys(env), 200, headers);
        case 'generate_tts': return await generateTts(context);
        case 'generate_text': return await generateText(context);
        case 'save_gemini_key': return await saveUserGeminiKey(context);
        case 'generate_image': return await generateImage(context);
        case 'enhance_prompt': return await enhancePrompt(context);
        case 'refine_voiceover': return await refineVoiceover(context);
        case 'transcribe_audio': return await transcribeAudio(context);
        case 'analyze_video_silence': return await analyzeVideoSilence(context);
        case 'proxy_media': return await proxyMedia(context);
        case 'consume_generation': return json({ success: true, remaining: context.access.remaining, plan: context.access.account ? 'free' : 'guest', permit: context.access.permit || undefined }, 200, headers);
        case 'account_status': {
          const account = await authenticate(context, false);
          return json({ success: true, uid: account.uid, email: account.email, status: account.status, plan: 'free' }, 200, headers);
        }
        case 'pair_begin': return await pairBegin(context);
        case 'pair_complete': return await pairComplete(context);
        case 'pair_poll': return await pairPoll(context);
        case 'motion_scene_submit': return await submitMotionScene(context);
        case 'motion_scene_poll': return await pollMotionScene(context);
        case 'motion_scene_ack': return await acknowledgeMotionScene(context);
        case 'motion_audio_asset': return await motionAudioAsset(context);
        case 'admin_get_provider_keys': return await adminProviderKeys(context, false);
        case 'admin_save_provider_keys': return await adminProviderKeys(context, true);
        case 'admin_delete_gemini_key': return await deleteGeminiKey(context);
        case 'admin_test_gemini_key': return await testGeminiKey(context);
        case 'generate_api_key': return await generateApiKey(context);
        case 'list_api_keys': return await listApiKeys(context);
        case 'revoke_api_key': return await revokeApiKey(context);
        case 'api_docs': return json(apiDocs(context), 200, headers);
        default: return json({ success: false, error: `الإجراء غير مدعوم: ${action}` }, 404, headers);
      }
    } catch (error) {
      const headers = { ...cors, 'Cache-Control': 'no-store' };
      return json({ success: false, error: error?.publicMessage || 'حدث خطأ أثناء الاتصال بخدمة Mickey Studio.' }, error?.status || 500, headers);
    }
  }
};

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const configured = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const isVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
  const allowed = configured.includes(origin) || isVercelPreview || /^chrome-extension:\/\/[a-p]{32}$/.test(origin) || /^moz-extension:\/\//.test(origin) || /^uxp:\/\//i.test(origin) || origin === 'null';
  const allowOrigin = origin === 'null' ? '*' : (allowed ? origin : (origin ? '' : '*'));
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key, X-Anonymous-ID, X-Generation-Permit',
    'Access-Control-Expose-Headers': 'X-TTS-Engine',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status, headers) {
  const h = new Headers(headers || {});
  h.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status, headers: h });
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
  const user = await firebaseLookup(token, ctx.env);
  const isAdmin = String(user.email || '').toLowerCase() === (ctx.env.ADMIN_EMAIL || ADMIN_EMAIL).toLowerCase();
  if (adminOnly && !isAdmin) fail(403, 'هذه العملية متاحة لمسؤول الموقع فقط.');
  const doc = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${encodeURIComponent(user.localId)}`, { headers: { Authorization: `Bearer ${token}` } });
  const profile = await readJson(doc);
  if (!doc.ok) fail(403, 'تعذر التحقق من ملف الحساب. تأكد من نشر قواعد Firestore ثم أعد تسجيل الدخول.');
  const status = profile.fields?.status?.stringValue || 'active';
  if (status !== 'active') fail(403, 'هذا الحساب موقوف من إدارة Mickey Studio.');
  return {
    uid: user.localId, email: user.email || '', isAdmin, status, token,
    geminiApiKey: profile.fields?.geminiApiKey?.stringValue || '',
    geminiProviderKeysJson: profile.fields?.geminiProviderKeysJson?.stringValue || ''
  };
}
function bearer(request) { const value = request.headers.get('Authorization') || ''; return value.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || ''; }
function apiToken(ctx) { return bearer(ctx.request) || ctx.request.headers.get('X-API-Key') || ctx.url.searchParams.get('api_key') || ''; }

async function enforceGenerationAccess(ctx) {
  const action = ctx.action;
  const apiKey = apiToken(ctx);
  if (apiKey.startsWith('mk_')) {
    const keys = await ctx.env.MICKEY_STATE.get('api_keys', 'json') || [];
    if (keys.some(item => item.key === apiKey && item.status !== 'revoked')) return { account: { plan: 'api_developer' }, remaining: null };
    fail(403, 'مفتاح API غير صالح أو تم إلغاؤه.');
  }
  const token = bearer(ctx.request) || String(ctx.body.idToken || '');
  if (token) return { account: await authenticate(ctx), remaining: null };
  const anonymousId = ctx.request.headers.get('X-Anonymous-ID') || '';
  if (!/^[a-f0-9]{32,96}$/i.test(anonymousId)) fail(400, 'تعذر بدء جلسة الضيف. أعد تحميل الموقع وحاول مرة أخرى.');
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
  if (used + count > 5) fail(429, 'استخدمت محاولات الضيف الخمس. أنشئ حسابًا مجانيًا للمتابعة.');
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
async function sha256(value) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join(''); }

async function getGeminiKeys(env) {
  const pool = await env.MICKEY_STATE.get('gemini_pool', 'json') || [];
  const active = pool.filter(x => x.status === 'active' && x.key).map(x => x.key);
  if (env.GEMINI_API_KEY && !active.includes(env.GEMINI_API_KEY)) active.unshift(env.GEMINI_API_KEY);
  return {
    success: true, has_key: active.length > 0,
    configured: { gemini: active.length > 0, groq: Boolean(env.GROQ_API_KEY), huggingface: Boolean(env.HUGGINGFACE_TOKEN) },
    gemini_pool: pool.map(({ key, ...item }) => ({ ...item, masked_key: maskKey(key) })),
    available_models: [
      { id: 'gemini-3.8-flash-tts', name: 'Gemini Flash TTS', type: 'tts' },
      { id: 'gemini-3.8-flash-lite-tts', name: 'Gemini Flash-Lite TTS', type: 'tts' },
      { id: 'gemini-nano-banana-2.1', name: 'Google Nano Banana 2.1', type: 'image' }
    ]
  };
}
async function activeKeys(env) {
  const pool = await env.MICKEY_STATE.get('gemini_pool', 'json') || [];
  const values = pool.filter(x => x.status === 'active').map(x => x.key).filter(Boolean);
  if (env.GEMINI_API_KEY) values.unshift(env.GEMINI_API_KEY);
  return [...new Set(values)];
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
      if (result.ok && audio) return audioResponse(audio, response.output_audio?.mime_type || 'audio/wav', ctx.headers, 'Gemini 3.8 Flash TTS');
      errors.push(response.error?.message || `Gemini (${result.status})`);
    }
    return json({ success: false, error: errors[0] || 'لا يوجد مفتاح Gemini صالح. أضف مفتاح Gemini API ثم أعد المحاولة.' }, 502, ctx.headers);
  }
  // The free fallback is Google Translate TTS and does not support Gemini voice or gender selection.
  const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=${encodeURIComponent(text.slice(0, 200))}`;
  const fallback = await fetch(fallbackUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null);
  if (fallback?.ok) {
    const bytes = await fallback.arrayBuffer();
    if (bytes.byteLength > 100) return new Response(bytes, { status: 200, headers: { ...ctx.headers, 'Content-Type': 'audio/mpeg', 'X-TTS-Engine': 'Google Translate TTS' } });
  }
  return json({ success: false, error: 'تعذر توليد الصوت عبر Google Translate TTS.' }, 502, ctx.headers);
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
  const keys = await keysForRequest(ctx);
  if (!keys.length) return json({ success: false, error: 'محرك Nano Banana غير مهيأ: أضف مفتاح Gemini صالحًا من إعدادات المنصة.' }, 503, ctx.headers);
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
        const mimeType = imagePart.inlineData.mimeType || 'image/png';
        return json({ success: true, provider: model.id, mime_type: mimeType, image_base64: imagePart.inlineData.data, base64Data: imagePart.inlineData.data }, 200, ctx.headers);
      }
      lastStatus = response.status || 502;
      lastError = `${model.id}: ${data.error?.message || data.candidates?.[0]?.finishReason || `Google AI returned HTTP ${lastStatus}`}`;
    }
  }
  return json({ success: false, error: `تعذر التوليد عبر Nano Banana (${lastStatus}): ${String(lastError).slice(0, 240)}` }, 502, ctx.headers);
}

async function geminiText(ctx, prompt, maxOutputTokens = 2000) {
  for (const key of await keysForRequest(ctx)) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens } })
    });
    const data = await readJson(response); const text = data.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('').trim();
    if (response.ok && text) return text;
  }
  return '';
}
async function enhancePrompt(ctx) {
  const prompt = String(ctx.body.prompt || '').trim();
  if (!prompt) return json({ success: false, error: 'النص المطلوب تحسينه فارغ' }, 400, ctx.headers);
  const system = 'Translate the user prompt to English and rewrite it as a natural photorealistic real-life photograph description. Include natural lighting, realistic textures, lens optics, sharp focus, and 8k resolution. Avoid 3d render, cartoon, illustration, drawing, CGI, anime, and low quality. Output only the English prompt.';
  const enhanced = await geminiText(ctx, `${system}\n\nUser input: ${prompt}`, 350);
  return json({ success: true, provider: enhanced ? 'gemini-photorealistic' : 'studio-photorealistic', original: prompt, enhanced: enhanced || `${prompt}, photorealistic RAW photography, natural lighting, Sony Alpha A7R V, 85mm f/1.4 lens, authentic natural textures, sharp focus, 8k resolution` }, 200, ctx.headers);
}
async function refineVoiceover(ctx) {
  const text = String(ctx.body.text || '').trim(); const dialect = String(ctx.body.dialect || 'العربية').trim();
  if (!text) return json({ success: false, error: 'اكتب النص المراد تحسينه أولاً.' }, 400, ctx.headers);
  const refined = await geminiText(ctx, `حرر النص التالي ليصبح مناسباً للتعليق الصوتي باللهجة ${dialect}. حسّن علامات الترقيم والإيقاع وسهولة النطق، وحافظ على المعنى والأسماء والأرقام والحقائق دون إضافة معلومات. أعد النص المحسن فقط دون مقدمة أو شرح:\n\n${text}`, 2500);
  return refined ? json({ success: true, refined, text: refined }, 200, ctx.headers) : json({ success: false, error: 'تعذر تحسين النص عبر خدمة Mickey Studio. تحقق من إعداد Gemini في Cloudflare.' }, 502, ctx.headers);
}
async function generateText(ctx) {
  const prompt = String(ctx.body.prompt || '').trim();
  if (!prompt) return json({ success: false, error: 'النص المطلوب فارغ.' }, 400, ctx.headers);
  const text = await geminiText(ctx, prompt, 2000);
  return text ? json({ success: true, text, response: text }, 200, ctx.headers) : json({ success: false, error: 'تعذر إنشاء النص. تحقق من إعداد Gemini في Cloudflare.' }, 502, ctx.headers);
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
  const mimeType = String(ctx.body.mime_type || '').split(';')[0].trim().toLowerCase();
  if (!video) return json({ success: false, error: 'ملف الفيديو غير موجود.' }, 400, ctx.headers);
  if (video.length > 16_800_000) return json({ success: false, error: 'حجم الفيديو أكبر من حد الإرسال الآمن (12 ميجابايت).' }, 413, ctx.headers);
  if (!/^video\/(?:mp4|quicktime|mov|webm|x-matroska|avi|mpeg|mpg|x-msvideo|x-ms-wmv|wmv|3gpp)$/.test(mimeType)) {
    return json({ success: false, error: 'صيغة الفيديو غير مدعومة لتحليل الصمت.' }, 415, ctx.headers);
  }
  const start = Number(ctx.body.start_seconds);
  const end = Number(ctx.body.end_seconds);
  const threshold = Number(ctx.body.threshold_db);
  const minimum = Number(ctx.body.minimum_seconds);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end - start > 360) {
    return json({ success: false, error: 'نطاق الفيديو المحدد غير صالح أو أطول من 6 دقائق.' }, 400, ctx.headers);
  }
  const minDuration = Number.isFinite(minimum) ? Math.min(5, Math.max(0.2, minimum)) : 0.5;
  const thresholdDb = Number.isFinite(threshold) ? Math.min(-18, Math.max(-65, threshold)) : -38;
  const prompt = `حلل المسار الصوتي داخل الفيديو المرفق فقط، ولا تحلل الصورة أو المحتوى البصري. ابحث عن فترات الصمت أو الانخفاض الواضح جدًا في الصوت، بحد تقريبي ${thresholdDb} dB ولمدة لا تقل عن ${minDuration} ثانية. افحص فقط المجال من ${start.toFixed(3)} إلى ${end.toFixed(3)} ثانية من بداية الملف. أرجع الأوقات بالثواني نسبة إلى بداية المجال المحدد (أي يبدأ المجال عند 0). لا تعتبر الوقفات التعبيرية القصيرة صمتًا، ولا تقطع الكلام الهادئ. أخرج JSON فقط بالشكل {"silences":[{"start_seconds":1.25,"end_seconds":2.10}]}. إذا لم توجد فترات مناسبة أرجع {"silences":[]}. لا تضف أي شرح.`;
  for (const key of await keysForRequest(ctx)) {
    for (const model of ['gemini-3.8-flash', 'gemini-3.6-flash']) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: video } }, { text: prompt }] }],
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
      return json({ success: true, data: { silences }, provider: model }, 200, ctx.headers);
    }
  }
  return json({ success: false, error: 'تعذر تحليل صوت الفيديو. تحقق من مفتاح Gemini أو جرّب مقطعًا أقصر.' }, 502, ctx.headers);
}
async function proxyMedia(ctx) {
  const target = ctx.url.searchParams.get('url');
  let parsed; try { parsed = new URL(target); } catch { return json({ error: 'رابط غير صالح' }, 400, ctx.headers); }
  if (!['https:', 'http:'].includes(parsed.protocol) || ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) return json({ error: 'رابط غير صالح' }, 400, ctx.headers);
  const response = await fetch(parsed.href, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
  if (!response.ok) return json({ error: 'تعذر جلب الوسائط' }, 502, ctx.headers);
  const h = new Headers(ctx.headers); h.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
  return new Response(response.body, { status: 200, headers: h });
}

async function firestoreUrl(code, env, collection = 'auth_sessions') {
  const id = await sha256(code);
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/${collection}/${id}?key=${encodeURIComponent(envFirebaseKey(env))}`;
}
async function firestoreCreatePair(code, pair, env, ignoreConflict = false) {
  const id = await sha256(code);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT}/databases/(default)/documents/auth_sessions?documentId=${id}&key=${encodeURIComponent(envFirebaseKey(env))}`;
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pairFirestoreFields(pair)) });
  if (response.ok || (ignoreConflict && response.status === 409)) return;
  fail(502, 'تعذر إنشاء جلسة الربط في Firestore.');
}
function pairFirestoreFields(pair) {
  const fields = { status: { stringValue: pair.status }, expiresAt: { integerValue: String(pair.expiresAt) } };
  if (pair.status === 'complete') fields.payload = { stringValue: pair.payload };
  return { fields };
}
async function encryptPair(code, values) {
  const keyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify({ uid: values.uid || '', email: values.email || '', refreshToken: values.refreshToken || '' }));
  const cipherAndTag = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode('mickey-pairing-v1'), tagLength: 128 }, key, plaintext));
  const tagAt = cipherAndTag.length - 16;
  const combined = new Uint8Array(nonce.length + cipherAndTag.length);
  combined.set(nonce); combined.set(cipherAndTag.slice(tagAt), nonce.length); combined.set(cipherAndTag.slice(0, tagAt), nonce.length + 16);
  return btoa(String.fromCharCode(...combined));
}
async function decryptPair(code, payload) {
  try {
    const all = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
    const keyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const cipherAndTag = new Uint8Array(all.length - 12); cipherAndTag.set(all.slice(28)); cipherAndTag.set(all.slice(12, 28), all.length - 28);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12), additionalData: new TextEncoder().encode('mickey-pairing-v1'), tagLength: 128 }, key, cipherAndTag);
    return JSON.parse(new TextDecoder().decode(plain));
  } catch { return null; }
}
async function pairBegin(ctx) {
  const code = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  await firestoreCreatePair(code, { status: 'pending', expiresAt: Math.floor(Date.now() / 1000) + 600 }, ctx.env);
  return json({ success: true, code, expiresIn: 600 }, 200, ctx.headers);
}
async function pairComplete(ctx) {
  const code = String(ctx.body.code || '');
  if (!/^[a-f0-9]{64}$/i.test(code)) return json({ success: false, error: 'رمز الربط غير صالح.' }, 400, ctx.headers);
  const account = await authenticate(ctx);
  const refreshToken = String(ctx.body.refreshToken || '');
  if (refreshToken.length < 20 || refreshToken.length > 4096) return json({ success: false, error: 'تعذر تأمين جلسة الإضافة. أعد تسجيل الدخول ثم حاول مرة أخرى.' }, 400, ctx.headers);
  const url = await firestoreUrl(code, ctx.env);
  let response = await fetch(url);
  if (response.status === 404) { await firestoreCreatePair(code, { status: 'pending', expiresAt: Math.floor(Date.now() / 1000) + 600 }, ctx.env, true); response = await fetch(url); }
  const doc = await readJson(response); const fields = doc.fields || {};
  if (!response.ok) fail(502, 'تعذر قراءة حالة الربط من Firestore.');
  if (fields.status?.stringValue !== 'pending' || Number(fields.expiresAt?.integerValue || 0) < Date.now() / 1000) fail(410, 'انتهت صلاحية طلب الربط. ابدأ الربط من الإضافة مجددًا.');
  const payload = await encryptPair(code, { uid: account.uid, email: account.email, refreshToken });
  const updated = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pairFirestoreFields({ status: 'complete', expiresAt: Math.floor(Date.now() / 1000) + 600, payload })) });
  if (!updated.ok) fail(502, 'تعذر حفظ اكتمال الربط في Firestore.');
  return json({ success: true }, 200, ctx.headers);
}
async function pairPoll(ctx) {
  const code = String(ctx.body.code || ctx.url.searchParams.get('code') || '');
  if (!/^[a-f0-9]{64}$/i.test(code)) return json({ success: false, error: 'رمز الربط غير صالح.' }, 400, ctx.headers);
  const url = await firestoreUrl(code, ctx.env); let response = await fetch(url);
  if (response.status === 404) { await firestoreCreatePair(code, { status: 'pending', expiresAt: Math.floor(Date.now() / 1000) + 600 }, ctx.env, true); return json({ success: true, status: 'pending' }, 200, ctx.headers); }
  const doc = await readJson(response); if (!response.ok) fail(502, 'تعذر قراءة حالة الربط من Firestore.');
  const fields = doc.fields || {}; const expiry = Number(fields.expiresAt?.integerValue || 0);
  if (expiry < Date.now() / 1000) { await fetch(url, { method: 'DELETE' }); return json({ success: false, error: 'انتهت صلاحية طلب الربط.' }, 410, ctx.headers); }
  if (fields.status?.stringValue !== 'complete') return json({ success: true, status: 'pending' }, 200, ctx.headers);
  const pair = await decryptPair(code, fields.payload?.stringValue || '');
  await fetch(url, { method: 'DELETE' });
  if (!pair) return json({ success: false, error: 'تعذر فك تشفير جلسة الربط.' }, 502, ctx.headers);
  return json({ success: true, status: 'complete', email: pair.email, refreshToken: pair.refreshToken }, 200, ctx.headers);
}

function validateMotionScene(scene) {
  if (!scene || typeof scene !== 'object' || !Array.isArray(scene.elements) || scene.elements.length < 1 || scene.elements.length > 30) {
    fail(400, 'المشهد يجب أن يحتوي من عنصر إلى 30 عنصراً.');
  }
  const idPattern = /^[A-Za-z0-9_-]{1,80}$/;
  const mogrtIds = new Set(['bg_aurora', 'bg_grid', 'text_kinetic', 'text_badge', 'widget_counter', 'widget_donut_ring', 'widget_social_card', 'logo_outro', 'color_matte']);
  const sfxIds = new Set(['whoosh', 'pop', 'click', 'riser']);
  const musicIds = new Set(['social_upbeat', 'kids_playful', 'tech_corporate', 'luxury_ambient', 'cyber_drive', 'cinematic_inspire', 'stats_pulse']);
  const extendedSfxIds = new Set(['impact', 'sparkle', 'soft_whoosh', 'swipe', 'bass_hit', 'notification']);
  for (const [index, item] of scene.elements.entries()) {
    if (!item || !['graphic', 'mogrt', 'color_matte', 'sfx'].includes(item.type)) fail(400, `نوع العنصر ${index + 1} غير مدعوم.`);
    const assetId = item.type === 'sfx' ? item.sfxId : (item.type === 'mogrt' || item.type === 'graphic' ? item.templateId : 'color_matte');
    if (!idPattern.test(String(assetId || ''))) fail(400, `معرّف الأصل في العنصر ${index + 1} غير صالح.`);
    if ((item.type === 'mogrt' || item.type === 'graphic') && !mogrtIds.has(assetId)) fail(400, `قالب غير معروف في العنصر ${index + 1}.`);
    if (item.type === 'sfx' && !sfxIds.has(assetId) && !extendedSfxIds.has(assetId)) fail(400, `مؤثر صوتي غير معروف في العنصر ${index + 1}.`);
    if (['graphic', 'mogrt', 'color_matte'].includes(item.type)) {
      const png = String(item.renderedPng || '');
      if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(png)) fail(400, `الصورة الجاهزة للطبقة ${index + 1} غير موجودة. أعد إرسال المشهد من الموقع بعد تحديثه.`);
      if (png.length > 6 * 1024 * 1024) fail(413, `الصورة الجاهزة للطبقة ${index + 1} كبيرة جداً.`);
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
  return json({ success: true, status: 'pending', jobId: record.jobId, scene: record.scene, assetsBaseUrl: record.assetsBaseUrl || '', audioAssetEndpoint: `${ctx.url.origin}${ctx.url.pathname}`, createdAt: record.createdAt }, 200, ctx.headers);
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
  const key = `motion_scene:${account.uid}`;
  const record = await ctx.env.MICKEY_STATE.get(key, 'json');
  if (!record || record.jobId !== String(ctx.body.jobId || '')) return json({ success: false, error: 'المشهد غير موجود أو تم استلامه مسبقاً.' }, 404, ctx.headers);
  await ctx.env.MICKEY_STATE.delete(key);
  return json({ success: true, status: 'complete' }, 200, ctx.headers);
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
    existing.add(candidate); added++; pool.push({ id: `key_${crypto.randomUUID()}`, key: candidate, label: ctx.body.label || `مفتاح #${pool.length + 1}`, status: 'active', added_at: nowIso() });
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
  if (item) {
    item.status = response.ok ? 'active' : response.status === 429 ? 'quota_exceeded' : 'invalid'; item.last_tested = nowIso();
    await updateUserProfileField(account, ctx.env, 'geminiProviderKeysJson', { stringValue: JSON.stringify(pool) });
    await ctx.env.MICKEY_STATE.put('gemini_pool', JSON.stringify(pool));
  }
  return json({ success: response.ok, message: response.ok ? 'المفتاح يعمل بنجاح والصلاحية نشطة ✓' : undefined, error: response.ok ? undefined : (response.status === 429 ? 'تم استهلاك حصة هذا المفتاح' : 'مفتاح غير صالح أو معطل'), http_code: response.status, gemini_pool: (await getGeminiKeys(ctx.env)).gemini_pool }, 200, ctx.headers);
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
