# Mickey Studio API Worker

هذا الـWorker يشغّل واجهات الموقع والإضافة، بما فيها إدارة الحسابات والربط وتوليد الصور عبر Workers AI.

## النشر

- اسم الخدمة: `mickey-studio-api`.
- مجلد Worker: `cloudflare-worker`، ويحتوي إعدادات Wrangler وملف `src/index.js`.
- تحديثات فرع `main` تُنشر من Cloudflare Workers Builds. للنشر اليدوي، افتح الطرفية داخل هذا المجلد وشغّل `npx wrangler deploy`.
- رابط الخدمة: `https://mickey-studio-api.kma279500.workers.dev`.
- إعداد `ALLOWED_ORIGINS` في `wrangler.toml` يحدد المواقع المسموح لها بالاتصال.

لا تضع رموز Cloudflare أو مفاتيح Gemini السرية في ملفات الواجهة أو المستودع. أضفها كـSecrets في إعدادات Cloudflare عند الحاجة.

## عرض حسابات Firebase في لوحة الإدارة

قائمة الحسابات تجمع بين Firebase Authentication وملفات المستخدمين في Firestore. يحتاج الـWorker إلى اعتماد خدمة Firebase Admin للقراءة:

1. أنشئ مفتاح Service Account للمشروع `mickey-gemini-studio` من Firebase Console، وامنح الحساب صلاحية قراءة حسابات Authentication (`firebaseauth.users.get`) وقراءة مستندات Firestore.
2. في إعدادات Worker `mickey-studio-api` أضف Secret باسم `FIREBASE_SERVICE_ACCOUNT_JSON` وضع فيه محتوى ملف JSON كاملًا.
3. لا ترفع ملف JSON إلى GitHub ولا ترسله في المحادثات. بعد حفظ الـSecret، أعد نشر Worker.
