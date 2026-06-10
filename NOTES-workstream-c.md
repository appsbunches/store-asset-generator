# Workstream C — تقييم قابلية فصل منطق التركيب عن الـ DOM

> تدوين فقط (بلا تنفيذ) — كُتب أثناء العمل على Workstream B بعد قراءة الكود كاملاً.

## الخلاصة

**الخيار 1 (استخراج منطق التركيب لوحدة headless في Node) قابل للتنفيذ بجهد متوسط.**
المعمارية الحالية نظيفة: `cli/`-style فصل موجود أصلاً — `app.js` هو الطبقة الوحيدة
المرتبطة بالواجهة، وكل منطق الرسم في وحدات مستقلة تستقبل `ctx` كمعامل.

## جرد الارتباطات بالـ DOM/المتصفح

| الوحدة | الارتباط | الخطورة |
|--------|----------|---------|
| `templates/*.js`, `layouts.js`, `deviceFrame.js`, `statusBar.js` | **صفر** — ترسم على `ctx` ممرَّر فقط | لا شيء |
| `themes.js` | `resolveBackground` يستخدم `ctx.createLinearGradient` (ممرَّر) | لا شيء |
| `renderer.js` | `document.createElement('canvas')` في `render` و `detectTopTint` و `topBackgroundColor`؛ `document.fonts` في `ensureFontsReady`؛ `Image`/`FileReader` في `loadImage`/`fileToDataURL` | منخفضة — كلها قابلة للحقن (canvas factory) |
| `export.js` | `window.JSZip`، `canvas.toBlob`، `document.createElement('a')` للتنزيل | منخفضة — في Node: `jszip` npm + `canvas.toBuffer` + `fs` |
| `app.js`, `merchantConfig.js` (UI/localStorage) | كامل — لكنها طبقة الواجهة، لا تُستخرج أصلاً | لا شيء |

## المخاطر الفعلية عند النقل لـ Node

1. **رسم النص العربي (RTL + تشكيل الحروف):** `drawTitle` يعتمد على
   `ctx.direction = 'rtl'` و `ctx.textAlign = 'center'` وخط Tajawal من Google Fonts.
   - `node-canvas` (Cairo/Pango): يدعم تشكيل العربية، لكن `ctx.direction` غير مدعوم —
     يحتاج اختبار فعلي لاتجاه النص الملفوف متعدد الأسطر.
   - `skia-canvas`: أقرب لسلوك المتصفح (يدعم direction) — **المرشح الأول**.
   - الخط يلزم تسجيله محلياً (`registerFont`/`FontLibrary.use` بملف Tajawal ttf).
   هذا هو الاختبار الحاسم قبل الالتزام بالخيار 1.
2. **`canvas.toBlob` بجودة JPEG 0.95:** في Node تصبح `toBuffer('image/jpeg', {quality: 0.95})` — تكافؤ مباشر.
3. **`detectTopTint`/`topBackgroundColor`:** تنشئ كانفاس داخلياً — تحتاج حقن
   `createCanvas` بدل `document.createElement('canvas')` (تغيير سطرين لكل دالة).

## خطة الاستخراج المقترحة (عند اعتماد C)

1. نقل `templates/`, `layouts.js`, `themes.js`, `deviceFrame.js`, `statusBar.js`,
   وأغلب `renderer.js` إلى وحدة مشتركة (مثلاً `core/compose/`) تستقبل
   `{ createCanvas, loadImage }` كاعتماديات محقونة.
2. غلاف ويب رقيق (يبقي السلوك الحالي حرفياً) + غلاف Node (`skia-canvas` + `jszip`).
3. اختبار قبول: مطابقة بكسلية (أو شبه بكسلية) بين مخرجات الويب و Node لنفس المدخلات.

## الخيار 2 (Playwright headless يقود الأداة نفسها)

غير مُوصى به إلا كحل مؤقت: الأداة الآن تعتمد على تفاعلات ملفات (file inputs)
يمكن قيادتها بـ Playwright بسهولة، لكن أي تغيير في الواجهة يكسر الأتمتة،
وتشغيل متصفح كامل لكل تاجر أبطأ وأهش من استدعاء دوال الرسم مباشرة.
نظافة الكود الحالية تجعل الخيار 1 أرخص مما يبدو.
