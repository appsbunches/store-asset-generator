// export.js — يولّد كل الصور المختارة ويجمعها في ملف ZIP واحد.
// يعتمد على JSZip المحمّل عالميًا (window.JSZip) من lib/jszip.min.js.

import { PRESETS, GOOGLE_MAX_BYTES } from './presets.js';
import { render } from './renderer.js';

// يحوّل الكانفاس إلى Blob بالصيغة المطلوبة. JPEG لا يحمل قناة ألفا إطلاقًا
// (لتجنّب رفض المتاجر للشفافية)، وPNG يُصدَّر معتمًا.
function canvasToBlob(canvas, fmt = 'jpeg') {
  const mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
  const quality = fmt === 'png' ? undefined : 0.95;
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

function extOf(fmt) {
  return fmt === 'png' ? 'png' : 'jpg';
}

// Google Play يرفض الملفات فوق 8MB — نتحقق قبل إدخالها في الـ ZIP.
function assertGoogleSize(preset, blob, path) {
  if (preset.group === 'googleplay' && blob.size > GOOGLE_MAX_BYTES) {
    throw new Error(`الملف ${path} تجاوز حد Google Play (8MB) — حجمه ${(blob.size / 1024 / 1024).toFixed(1)}MB`);
  }
}

// يبني اسم ملف داخل الـ ZIP لكل preset (مع ترقيم السكرينشوتات).
function entryPath(preset, index) {
  if (preset.fileName) {
    return preset.folder ? `${preset.folder}/${preset.fileName}` : preset.fileName;
  }
  const num = String(index + 1).padStart(2, '0');
  const name = `${num}.${extOf(preset.fmt)}`;
  return preset.folder ? `${preset.folder}/${name}` : name;
}

// shots: مصفوفة من configs (واحدة لكل سكرينشوت مرفوع).
// selectedPresetIds: قائمة الأحجام المطلوبة.
// shots: [{ screenshot, title, theme, layoutId }] لكل سكرينشوت إعداداته الخاصة.
// globalConfig: { platform, showFrame, statusBarRatio, logo } مشترك لكل الدفعة.
// iconConfig:   { theme, logo } لخلفية الأيقونات والكفر (منفصلة عن الصور الوصفية).
// onProgress(done, total)
export async function exportAll(shots, selectedPresetIds, globalConfig, iconConfig, onProgress) {
  if (!window.JSZip) throw new Error('JSZip غير محمّلة');
  const zip = new window.JSZip();
  const selected = PRESETS.filter((p) => selectedPresetIds.includes(p.id));
  const canvas = document.createElement('canvas');

  // الأيقونات والكفر تُولَّد مرة واحدة (لا تتكرر لكل سكرينشوت)
  const perShot = selected.filter((p) => p.type === 'screenshot');
  const once = selected.filter((p) => p.type !== 'screenshot');

  const total = perShot.length * Math.max(shots.length, 1) + once.length;
  let done = 0;

  // السكرينشوتات: لكل صورة مرفوعة × كل حجم سكرينشوت (بإعدادات الصورة الخاصة)
  for (let i = 0; i < shots.length; i++) {
    const cfg = { ...globalConfig, ...shots[i] };
    for (const preset of perShot) {
      render(canvas, preset, cfg);
      const blob = await canvasToBlob(canvas, preset.fmt);
      const path = entryPath(preset, i);
      assertGoogleSize(preset, blob, path);
      zip.file(path, blob);
      onProgress && onProgress(++done, total);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // الأيقونات + الكفر (مرة واحدة، بخلفية الأيقونات المنفصلة)
  for (const preset of once) {
    render(canvas, preset, iconConfig);
    const blob = await canvasToBlob(canvas, preset.fmt);
    const path = entryPath(preset, 0);
    assertGoogleSize(preset, blob, path);
    zip.file(path, blob);
    onProgress && onProgress(++done, total);
    await new Promise((r) => setTimeout(r, 0));
  }

  const content = await zip.generateAsync({ type: 'blob' });
  triggerDownload(content, 'store-assets.zip');
}

// تحميل صورة مفردة (للمعاينة الحالية)
export async function exportSingle(canvas, baseName, fmt = 'jpeg') {
  const blob = await canvasToBlob(canvas, fmt);
  triggerDownload(blob, `${baseName}.${extOf(fmt)}`);
}

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
