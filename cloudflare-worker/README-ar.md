# Mickey Studio API Worker

هذا الـWorker يشغّل واجهات الموقع والإضافة، بما فيها إدارة الحسابات والربط وتوليد الصور عبر Workers AI.

## النشر

- اسم الخدمة: `mickey-studio-api`.
- مجلد Worker: `cloudflare-worker`، ويحتوي إعدادات Wrangler وملف `src/index.js`.
- تحديثات فرع `main` تُنشر من Cloudflare Workers Builds. للنشر اليدوي، افتح الطرفية داخل هذا المجلد وشغّل `npx wrangler deploy`.
- رابط الخدمة: `https://mickey-studio-api.kma279500.workers.dev`.
- إعداد `ALLOWED_ORIGINS` في `wrangler.toml` يحدد المواقع المسموح لها بالاتصال.

لا تضع رموز Cloudflare أو مفاتيح Gemini السرية في ملفات الواجهة أو المستودع. أضفها كـSecrets في إعدادات Cloudflare عند الحاجة.
