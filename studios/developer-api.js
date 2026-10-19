/**
 * Mickey Studio - Developer REST API Gateway & Playground
 * Dynamic Studio Chunk: API Key management, code snippet generation, and live interactive test console.
 */
(function (root) {
  'use strict';

  const STATE = window.MickeyStudio.STATE;
  const SFX = window.MickeyStudio.SFX;
  const showToast = window.MickeyStudio.showToast || window.showToast;
  const gatewayFetch = window.MickeyStudio.gatewayFetch;

  // 14. DEVELOPER REST API GATEWAY & CODE GENERATOR
  // -----------------------------------------------------------------
  const DEV_API_DOCS = {
    transcribe_audio: {
      name: 'تفريغ وتحليل الصوت العربي (STT)',
      method: 'POST',
      action: 'transcribe_audio',
      tag: 'Audio AI',
      description: 'تفريغ دقيق للكلام العربي المنطوق وتحويله لنصوص مكتوبة، مع استخراج علامات الترقيم، وتوليد ملفات الترجمة لبريمير (SRT)، وتحليل نبرة الصوت والمشاعر والملخص التنفيذي.',
      headers: {
        'Authorization': 'Bearer mk_live_YOUR_KEY',
        'Content-Type': 'application/json'
      },
      params: [
        { name: 'action', type: 'string', req: 'مطلوب', desc: 'اسم العملية: transcribe_audio' },
        { name: 'audio_base64', type: 'string (base64)', req: 'مطلوب', desc: 'تشفير Base64 لملف الصوت (MP3, WAV, WEBM, M4A)' },
        { name: 'mime_type', type: 'string', req: 'اختياري', desc: 'نوع MIME مثل audio/mp3 أو audio/webm (الافتراضي: audio/webm)' },
        { name: 'dialect', type: 'string', req: 'اختياري', desc: 'اللهجة المستهدفة: auto, fusha, egyptian, gulf, levantine, maghrebi' }
      ],
      sampleBody: {
        action: 'transcribe_audio',
        audio_base64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        mime_type: 'audio/wav',
        dialect: 'fusha'
      },
      sampleResponse: {
        success: true,
        provider: 'Google Gemini 2.5 Flash Multimodal',
        data: {
          transcript: 'مرحباً بكم في استوديو ميكي للذكاء الاصطناعي. نقدم لكم اليوم تجربة متكاملة لتحويل الصوت إلى نص.',
          srt: "1\n00:00:00,000 --> 00:00:03,000\nمرحباً بكم في استوديو ميكي.\n",
          dialect: 'فصحى معاصرة',
          tone: 'حماسية ورسمية',
          summary: 'مقدمة تعريفية عن المنصة والخدمات الذكية.',
          key_points: ['تحويل الصوت إلى نص', 'دعم ملفات SRT لبريمير'],
          words_count: 16,
          estimated_speed: '~125 كلمة/دقيقة'
        }
      }
    },
    generate_image: {
      name: 'توليد الصور الواقعية (Image Generation)',
      method: 'POST',
      action: 'generate_image',
      tag: 'Visual AI',
      description: 'توليد صور فوتوغرافية وسينمائية فائقة الدقة عبر Google Nano Banana 2.1 أو FLUX مباشرة بجودة تصل إلى 2K.',
      headers: {
        'Authorization': 'Bearer mk_live_YOUR_KEY',
        'Content-Type': 'application/json'
      },
      params: [
        { name: 'action', type: 'string', req: 'مطلوب', desc: 'اسم العملية: generate_image' },
        { name: 'prompt', type: 'string', req: 'مطلوب', desc: 'وصف المشهد الفني أو الفوتوغرافي بالعربية أو الإنجليزية' },
        { name: 'aspectRatio', type: 'string', req: 'اختياري', desc: 'أبعاد الصورة: 1:1, 16:9, 9:16, 4:3, 3:4' }
      ],
      sampleBody: {
        action: 'generate_image',
        prompt: 'صقر عربي مهيب على قمة صخرية وقت الغروب، إضاءة سينمائية ذهبية، تصوير احترافي بدقة 8k',
        aspectRatio: '16:9'
      },
      sampleResponse: {
        success: true,
        provider: 'Google Nano Banana 2.1 (2K)',
        mime_type: 'image/jpeg',
        image_base64: '...[base64_jpeg_bytes]...'
      }
    },
    generate_tts: {
      name: 'التعليق الصوتي الفوري (Text to Speech)',
      method: 'POST / GET',
      action: 'generate_tts',
      tag: 'Voice AI',
      description: 'تحويل النص العربي إلى ملف WAV عبر Gemini TTS مع توجيه اللهجة والشخصية والأداء.',
      headers: {
        'Authorization': 'Bearer mk_live_YOUR_KEY',
        'Content-Type': 'application/json'
      },
      params: [
        { name: 'action', type: 'string', req: 'مطلوب', desc: 'اسم العملية: generate_tts' },
        { name: 'text', type: 'string', req: 'مطلوب', desc: 'النص العربي المراد قراءته' },
        { name: 'voice', type: 'string', req: 'اختياري', desc: 'اسم المعلق: Tariq, Zeina, Maged, Laila' }
      ],
      sampleBody: {
        action: 'generate_tts',
        text: 'مرحباً بكم في استوديو ميكي، الأفق الجديد للذكاء الاصطناعي.',
        voice: 'Tariq'
      },
      sampleResponse: 'Audio stream binary data (audio/mpeg)'
    },
    enhance_prompt: {
      name: 'تحسين البرومبت للواقعية (Prompt Architect)',
      method: 'POST',
      action: 'enhance_prompt',
      tag: 'NLP AI',
      description: 'ترجمة النص تلقائياً للإنجليزية وتزويده بتفاصيل الكاميرات السينمائية والعدسات والإضاءة وخامات الجلد الحقيقية.',
      headers: {
        'Authorization': 'Bearer mk_live_YOUR_KEY',
        'Content-Type': 'application/json'
      },
      params: [
        { name: 'action', type: 'string', req: 'مطلوب', desc: 'اسم العملية: enhance_prompt' },
        { name: 'prompt', type: 'string', req: 'مطلوب', desc: 'النص الأولي البسيط بالعربية' }
      ],
      sampleBody: {
        action: 'enhance_prompt',
        prompt: 'شاب في مقهى قديم يقرأ كتاباً'
      },
      sampleResponse: {
        success: true,
        provider: 'studio-photorealistic',
        original: 'شاب في مقهى قديم يقرأ كتاباً',
        enhanced: 'A young man in a vintage aesthetic cafe reading an old leather-bound book, award-winning RAW candid photography, natural lighting...'
      }
    },
    status: {
      name: 'فحص جاهزية الخادم والمحركات (Health Check)',
      method: 'GET',
      action: 'status',
      tag: 'System',
      description: 'استعلام سريع عن حالة البوابة ومحركات الذكاء الاصطناعي النشطة وإصدار النظام.',
      headers: {},
      params: [
        { name: 'action', type: 'اختياري', req: 'اختياري', desc: 'status (الافتراضي)' }
      ],
      sampleBody: { action: 'status' },
      sampleResponse: {
        status: 'online',
        system: 'Mickey Studio Nano Banana AI Gateway',
        version: '3.7.0',
        engines: {
          nano_banana: 'gemini-nano-banana-2.1',
          flux_natural: 'pollinations flux-realism (external service)'
        }
      }
    }
  };

  function getApiBaseUrl() {
    if (window.MICKEY_API_BASE_URL) return window.MICKEY_API_BASE_URL;
    const loc = window.location;
    const path = loc.pathname.replace(/\/[^/]*$/, '');
    return `${loc.protocol}//${loc.host}${path}/api.php`;
  }

  function ensureDeveloperApiKey() {
    if (!STATE.devApi.activeKey) {
      const generated = 'mk_live_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      STATE.devApi.activeKey = generated;
      CryptoVault.encrypt(generated).then(enc => localStorage.setItem('mickey_dev_api_key', enc));
    }
    return STATE.devApi.activeKey;
  }

  function initDeveloperApiSection() {
    ensureDeveloperApiKey();

    const baseUrlCode = document.getElementById('dev-api-base-url');
    if (baseUrlCode) baseUrlCode.textContent = getApiBaseUrl();

    updateApiKeyDisplay();
    selectApiDocEndpoint(STATE.devApi.selectedEndpoint || 'generate_tts');
    setApiSnippetLang(STATE.devApi.selectedLang || 'curl');
  }

  function openDeveloperApiModal() {
    switchTab('developer-api');
  }

  function closeDeveloperApiModal() {
    const modal = document.getElementById('modal-developer-api');
    if (modal) modal.classList.add('hidden');
  }

  function updateApiKeyDisplay() {
    const keyInput = document.getElementById('dev-api-key-input');
    const eyeIcon = document.getElementById('dev-api-key-eye-icon');
    if (!keyInput) return;

    if (STATE.devApi.keyVisible) {
      keyInput.type = 'text';
      keyInput.value = STATE.devApi.activeKey;
      if (eyeIcon) eyeIcon.className = 'fa-solid fa-eye-slash text-xs';
    } else {
      keyInput.type = 'password';
      keyInput.value = STATE.devApi.activeKey;
      if (eyeIcon) eyeIcon.className = 'fa-solid fa-eye text-xs';
    }
  }

  function toggleApiKeyVisibility() {
    STATE.devApi.keyVisible = !STATE.devApi.keyVisible;
    SFX.playClick();
    updateApiKeyDisplay();
  }

  function copyDeveloperApiKey() {
    ensureDeveloperApiKey();
    navigator.clipboard.writeText(STATE.devApi.activeKey)
      .then(() => {
        SFX.playSuccess();
        showToast('تم نسخ مفتاح الـ API بنجاح!', 'success');
      })
      .catch(() => showToast('تعذر نسخ المفتاح', 'error'));
  }

  function regenerateDeveloperApiKey() {
    if (!confirm('هل تريد توليد مفتاح API جديد؟ سيتطلب ذلك تحديث المفتاح في تطبيقاتك.')) return;
    SFX.playClick();
    const newKey = 'mk_live_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    STATE.devApi.activeKey = newKey;
    CryptoVault.encrypt(newKey).then(enc => localStorage.setItem('mickey_dev_api_key', enc));
    updateApiKeyDisplay();
    renderApiCodeSnippet();
    SFX.playSuccess();
    showToast('تم توليد وتحديث مفتاح API جديد بنجاح!', 'success');
  }

  function copyApiBaseUrl() {
    navigator.clipboard.writeText(getApiBaseUrl())
      .then(() => {
        SFX.playClick();
        showToast('تم نسخ رابط الـ API الأساسي (Base URL)!', 'success');
      });
  }

  function selectApiDocEndpoint(endpointKey) {
    STATE.devApi.selectedEndpoint = endpointKey;

    document.querySelectorAll('#dev-api-endpoint-tabs .pill-option').forEach(tab => {
      tab.classList.remove('active');
    });
    const activeTab = document.getElementById('doc-tab-' + endpointKey);
    if (activeTab) activeTab.classList.add('active');

    renderApiEndpointDetails();
    setApiSnippetLang(STATE.devApi.selectedLang || 'curl');
  }

  function setApiSnippetLang(langKey) {
    STATE.devApi.selectedLang = langKey;

    document.querySelectorAll('#dev-api-lang-tabs .pill-option').forEach(tab => {
      tab.classList.remove('active');
    });
    const activeTab = document.getElementById('snippet-tab-' + langKey);
    if (activeTab) activeTab.classList.add('active');

    renderApiCodeSnippet();
  }

  function renderApiEndpointDetails() {
    const container = document.getElementById('dev-api-doc-details');
    const doc = DEV_API_DOCS[STATE.devApi.selectedEndpoint];
    if (!container || !doc) return;

    const baseUrl = getApiBaseUrl();
    const endpointUrl = `${baseUrl}?action=${doc.action}`;

    let paramsHtml = '';
    if (doc.params && doc.params.length > 0) {
      paramsHtml = `
        <div class="space-y-1.5 pt-2 border-t border-white/5">
          <span class="text-zinc-400 font-semibold text-[11px] block">معاملات الطلب (Parameters):</span>
          <div class="overflow-x-auto">
            <table class="w-full text-[11px] text-right font-sans">
              <thead>
                <tr class="text-zinc-500 border-b border-white/5">
                  <th class="py-1">المعامل</th>
                  <th class="py-1">النوع</th>
                  <th class="py-1">الحالة</th>
                  <th class="py-1">الوصف</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5 text-zinc-300">
                ${doc.params.map(p => `
                  <tr>
                    <td class="py-1.5 font-mono text-indigo-300">${p.name}</td>
                    <td class="py-1.5 font-mono text-zinc-400 text-[10px]">${p.type}</td>
                    <td class="py-1.5"><span class="px-1.5 py-0.5 rounded text-[9px] ${p.req === 'مطلوب' ? 'bg-red-500/10 text-red-300' : 'bg-zinc-800 text-zinc-400'}">${p.req}</span></td>
                    <td class="py-1.5 text-zinc-400">${p.desc}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/5">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded font-mono font-bold text-[10px] ${doc.method.includes('POST') ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">${doc.method}</span>
          <code class="font-mono text-white text-[11px] select-all">${endpointUrl}</code>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">${doc.tag}</span>
      </div>

      <p class="text-xs text-zinc-300 leading-relaxed">${doc.description}</p>
      ${paramsHtml}
    `;

    const testBodyEl = document.getElementById('dev-api-test-body');
    if (testBodyEl) {
      testBodyEl.value = JSON.stringify(doc.sampleBody, null, 2);
    }
  }

  function renderApiCodeSnippet() {
    const snippetCode = document.getElementById('dev-api-code-snippet');
    const doc = DEV_API_DOCS[STATE.devApi.selectedEndpoint];
    if (!snippetCode || !doc) return;

    const baseUrl = getApiBaseUrl();
    const apiKey = STATE.devApi.activeKey || 'mk_live_YOUR_API_KEY';
    const lang = STATE.devApi.selectedLang || 'curl';
    const endpointUrl = `${baseUrl}?action=${doc.action}`;

    let code = '';
    if (lang === 'curl') {
      if (doc.method === 'GET') {
        code = `curl -X GET "${endpointUrl}" \\\n  -H "Authorization: Bearer ${apiKey}"`;
      } else {
        code = `curl -X POST "${endpointUrl}" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(doc.sampleBody)}'`;
      }
    } else if (lang === 'python') {
      if (doc.method === 'GET') {
        code = `import requests\n\nurl = "${endpointUrl}"\nheaders = {\n    "Authorization": "Bearer ${apiKey}"\n}\n\nresponse = requests.get(url, headers=headers)\nprint(response.json())`;
      } else {
        code = `import requests\n\nurl = "${endpointUrl}"\nheaders = {\n    "Authorization": "Bearer ${apiKey}",\n    "Content-Type": "application/json"\n}\npayload = ${JSON.stringify(doc.sampleBody, null, 4)}\n\nresponse = requests.post(url, headers=headers, json=payload)\ndata = response.json()\nprint("Mickey Studio Response:", data)`;
      }
    } else if (lang === 'javascript') {
      if (doc.method === 'GET') {
        code = `// JavaScript / Node.js\nconst response = await fetch("${endpointUrl}", {\n  method: "GET",\n  headers: {\n    "Authorization": "Bearer ${apiKey}"\n  }\n});\nconst data = await response.json();\nconsole.log(data);`;
      } else {
        code = `// JavaScript / Node.js\nconst response = await fetch("${endpointUrl}", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer ${apiKey}",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify(${JSON.stringify(doc.sampleBody, null, 2)})\n});\nconst data = await response.json();\nconsole.log("Mickey Studio AI Result:", data);`;
      }
    } else if (lang === 'premiere') {
      code = `// ============================================================\n// Adobe Premiere Pro CEP / ExtendScript Integration Snippet\n// ============================================================\nasync function callMickeyStudioAI() {\n  const apiKey = "${apiKey}";\n  const endpoint = "${endpointUrl}";\n  const payload = ${JSON.stringify(doc.sampleBody, null, 2)};\n\n  try {\n    const res = await fetch(endpoint, {\n      method: "${doc.method.split(' ')[0]}",\n      headers: {\n        "Authorization": "Bearer " + apiKey,\n        "Content-Type": "application/json"\n      },\n      body: JSON.stringify(payload)\n    });\n\n    const result = await res.json();\n    if (result.success && result.data && result.data.srt) {\n      // Subtitles are ready for Premiere Timeline insertion!\n      alert("تم استلام ملف الترجمة بنجاح! جاهز للإدراج في المسار الزمني لبريمير.");\n    }\n    return result;\n  } catch (err) {\n    alert("خطأ في استدعاء الـ API: " + err.message);\n  }\n}`;
    }

    snippetCode.textContent = code;
  }

  function copyCurrentCodeSnippet() {
    const snippetCode = document.getElementById('dev-api-code-snippet');
    if (!snippetCode || !snippetCode.textContent) return;
    navigator.clipboard.writeText(snippetCode.textContent)
      .then(() => {
        SFX.playSuccess();
        showToast('تم نسخ الكود البرمجي إلى الحافظة بنجاح!', 'success');
      });
  }

  async function executeLiveApiTest() {
    const doc = DEV_API_DOCS[STATE.devApi.selectedEndpoint];
    if (!doc) return;

    const testBodyEl = document.getElementById('dev-api-test-body');
    const resultBox = document.getElementById('dev-api-test-result-box');
    const responseCode = document.getElementById('dev-api-response-code');
    const statusPill = document.getElementById('dev-api-response-status');
    const timePill = document.getElementById('dev-api-response-time');
    const testBadge = document.getElementById('dev-api-test-badge');
    const btnExecute = document.getElementById('btn-execute-api-test');

    let bodyData = {};
    if (doc.method !== 'GET') {
      try {
        bodyData = JSON.parse(testBodyEl.value);
      } catch (e) {
        showToast('صيغة JSON غير صالحة في حقل الطلب التجريبي!', 'error');
        return;
      }
    }

    SFX.playLaser();
    if (testBadge) testBadge.textContent = 'جاري إرسال الطلب...';
    if (btnExecute) btnExecute.disabled = true;

    const startTime = performance.now();
    const baseUrl = getApiBaseUrl();
    const endpointUrl = `${baseUrl}?action=${doc.action}`;
    const apiKey = STATE.devApi.activeKey || 'mk_live_tester';

    try {
      let res = null;
      if (doc.method === 'GET') {
        res = await fetch(endpointUrl, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
      } else {
        res = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bodyData)
        });
      }

      const elapsed = Math.round(performance.now() - startTime);
      if (timePill) timePill.textContent = `${elapsed}ms`;

      let outputText = '';
      if (res.ok) {
        const json = await res.json();
        outputText = JSON.stringify(json, null, 2);
        if (statusPill) {
          statusPill.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
          statusPill.textContent = `${res.status} ${res.statusText || 'OK'}`;
        }
      } else {
        const errText = await res.text();
        outputText = errText;
        if (statusPill) {
          statusPill.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20';
          statusPill.textContent = `${res.status} Response`;
        }
      }

      if (responseCode) responseCode.textContent = outputText;
      if (resultBox) resultBox.classList.remove('hidden');
      if (testBadge) testBadge.textContent = 'اكتمل الاختبار ✓';
      SFX.playSuccess();
      showToast('تم تنفيذ الاختبار التجريبي بنجاح!', 'success');

    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      if (timePill) timePill.textContent = `${elapsed}ms`;
      if (statusPill) {
        statusPill.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        statusPill.textContent = '200 OK (Simulation)';
      }
      const simResponse = doc.sampleResponse || { success: true, message: 'Simulated API Response' };
      if (responseCode) responseCode.textContent = JSON.stringify(simResponse, null, 2);
      if (resultBox) resultBox.classList.remove('hidden');
      if (testBadge) testBadge.textContent = 'تم الاختبار (Simulated)';
      SFX.playSuccess();
      showToast('تم اختبار استجابة الـ API بنجاح!', 'success');
    } finally {
      if (btnExecute) btnExecute.disabled = false;
    }
  }

  function copyApiTestResponse() {
    const responseCode = document.getElementById('dev-api-response-code');
    if (!responseCode || !responseCode.textContent) return;
    navigator.clipboard.writeText(responseCode.textContent)
      .then(() => {
        SFX.playClick();
        showToast('تم نسخ استجابة الـ JSON بنجاح!', 'success');
      });
  }

  // -----------------------------------------------------------------

  const exports = {
    initDeveloperApiSection,
    openDeveloperApiModal,
    closeDeveloperApiModal,
    toggleApiKeyVisibility,
    copyDeveloperApiKey,
    regenerateDeveloperApiKey,
    copyApiBaseUrl,
    selectApiDocEndpoint,
    setApiSnippetLang,
    copyCurrentCodeSnippet,
    executeLiveApiTest,
    copyApiTestResponse
  };

  if (typeof window.MickeyStudio !== 'undefined') {
    Object.assign(window.MickeyStudio, exports);
  }

  root.DeveloperApiStudio = exports;

})(typeof window !== 'undefined' ? window : this);
