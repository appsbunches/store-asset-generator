// presets.js — الأحجام المعتمدة لمتجري App Store و Google Play
// ⚠️ هذا الملف هو المرجع الوحيد للمقاسات في المشروع كله — لا تُعرَّف أبعاد تصدير في ملفات أخرى.
//
// مبدأ الامتثال:
//   - مقاسات أبل قائمة بيضاء حرفية: أي بكسل خارج القيم المقبولة = رفض من App Store Connect.
//     iPhone 6.9" (الأساسي): 1320×2868 (و 2868×1320 landscape) — ويُقبل 1290×2796.
//     iPhone 6.5" (legacy):  1242×2688 / 2688×1242 / 1284×2778 / 2778×1284.
//     iPad 13": 2064×2752 — فقط لو التطبيق يدعم iPad.
//   - مقاسات Google Play مرنة: 320–3840 بكسل، نسبة قصوى 2:1 — الموصى به 1080×1920.
//     استثناء حرفي: الـ Feature Graphic لازم 1024×500 بالضبط.
//   - ملفات Google لازم تكون تحت 8MB (يُتحقق منها عند التصدير في export.js).
//
// 🔁 راجع هذه القيم دوريًا من App Store Connect (screenshot specifications)
//    و Play Console (graphic assets requirements) — المتاجر تغيّرها مع الأجهزة الجديدة.
//
// كل preset يصف مخرجًا واحدًا بأبعاده الحقيقية بالبكسل.
// folder: مسار المجلد داخل الـ ZIP — يطابق هيكل الرفع (apple/... و google/...).
// fmt: صيغة التصدير. نتجنّب شفافية ألفا التي ترفضها المتاجر:
//   jpeg = بدون قناة ألفا إطلاقًا (السكرينشوتات/الكفر/أيقونة آبل).
//   png  = للأيقونات التي تتطلّبها جوجل بلاي (تُرسم معتمة بلا شفافية).

// الحد الأقصى لحجم ملفات Google Play (بالبايت).
export const GOOGLE_MAX_BYTES = 8 * 1024 * 1024;

export const PRESETS = [
  // ---- App Store ----
  {
    id: 'apple-6.9',
    group: 'appstore',
    type: 'screenshot',
    label: 'iPhone 6.9" (1320×2868) — الأساسي',
    folder: 'apple/iphone-6.9',
    width: 1320,
    height: 2868,
    fmt: 'jpeg',
    defaultOn: true,
  },
  {
    id: 'apple-6.9-alt',
    group: 'appstore',
    type: 'screenshot',
    label: 'iPhone 6.9" بديل مقبول (1290×2796)',
    folder: 'apple/iphone-6.9-alt',
    width: 1290,
    height: 2796,
    fmt: 'jpeg',
    defaultOn: false,
  },
  {
    id: 'apple-6.5',
    group: 'appstore',
    type: 'screenshot',
    label: 'iPhone 6.5" قديم (1242×2688)',
    folder: 'apple/iphone-6.5',
    width: 1242,
    height: 2688,
    fmt: 'jpeg',
    defaultOn: false,
  },
  {
    id: 'apple-ipad-13',
    group: 'appstore',
    type: 'screenshot',
    label: 'iPad 13" (2064×2752) — لو التطبيق يدعم iPad',
    folder: 'apple/ipad-13',
    width: 2064,
    height: 2752,
    fmt: 'jpeg',
    defaultOn: false,
  },
  // ---- Google Play ----
  {
    id: 'google-phone',
    group: 'googleplay',
    type: 'screenshot',
    label: 'Google Play Phone (1080×1920)',
    folder: 'google/phone',
    width: 1080,
    height: 1920,
    fmt: 'jpeg',
    defaultOn: true,
  },
  // ---- Feature graphic (الكفر) ----
  {
    id: 'feature-graphic',
    group: 'googleplay',
    type: 'feature',
    label: 'Feature Graphic / الكفر (1024×500 بالضبط)',
    folder: 'google/feature-graphic',
    fileName: 'feature.jpg',
    width: 1024,
    height: 500,
    fmt: 'jpeg',
    defaultOn: true,
  },
  // ---- الأيقونات ----
  {
    id: 'icon-1024',
    group: 'icons',
    type: 'icon',
    label: 'App Icon (1024×1024)',
    folder: 'icons',
    fileName: 'icon-1024.jpg',
    width: 1024,
    height: 1024,
    fmt: 'jpeg', // App Store: بدون ألفا
    defaultOn: true,
  },
  {
    id: 'icon-512',
    group: 'icons',
    type: 'icon',
    label: 'Play Icon (512×512)',
    folder: 'icons',
    fileName: 'icon-512.png',
    width: 512,
    height: 512,
    fmt: 'png', // Google Play: PNG معتمة
    defaultOn: true,
  },
  {
    id: 'icon-540',
    group: 'icons',
    type: 'icon',
    label: 'مربع صغير (540×540)',
    folder: 'icons',
    fileName: 'icon-540.png',
    width: 540,
    height: 540,
    fmt: 'png',
    defaultOn: false,
  },
];

export const GROUPS = [
  { id: 'appstore', label: 'App Store' },
  { id: 'googleplay', label: 'Google Play' },
  { id: 'icons', label: 'الأيقونات واللوجو' },
];

export function presetById(id) {
  return PRESETS.find((p) => p.id === id);
}
