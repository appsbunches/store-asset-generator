// renderer.js — القلب التقني: أدوات مساعدة + موزّع الرسم حسب نوع الـ preset.

import { resolveBackground } from './themes.js';
import { paintBackgroundStyle } from './backgrounds.js';
import { renderScreenshot } from './templates/screenshot.js';
import { renderIcon } from './templates/icon.js';
import { renderFeature } from './templates/feature.js';

// تحميل صورة من File أو رابط، وإرجاع HTMLImageElement جاهز.
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// التأكد من تحميل خط Tajawal قبل الرسم على الكانفاس.
export async function ensureFontsReady() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load("700 48px 'Tajawal'"),
      document.fonts.load("500 48px 'Tajawal'"),
      document.fonts.load("600 48px 'Tajawal'"),
    ]);
    await document.fonts.ready;
  } catch (e) {
    /* تجاهل: سيستخدم خطًا احتياطيًا */
  }
}

// يحسب متوسط سطوع شريط أعلى الصورة لتحديد لون أيقونات شريط الحالة (أسود/أبيض).
// يعيد 'light' (أيقونات بيضاء) للخلفية الداكنة، و'dark' للخلفية الفاتحة.
export function detectTopTint(img, sampleHeightRatio = 0.06) {
  try {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const srcSampleH = Math.max(1, Math.round(srcH * sampleHeightRatio));
    // ارسم شريط أعلى الصورة في كانفاس صغير (100 بكسل عرض) لقراءة سريعة.
    const c = document.createElement('canvas');
    c.width = 100;
    c.height = Math.max(1, Math.round((srcSampleH / srcW) * 100));
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, srcW, srcSampleH, 0, 0, c.width, c.height);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      count++;
    }
    const avg = count ? sum / count : 255;
    return avg < 140 ? 'light' : 'dark';
  } catch (e) {
    return 'dark';
  }
}

// يأخذ متوسط لون صف بكسلات أعلى الصورة (لملء خلفية شريط الحالة بلون مطابق).
export function topBackgroundColor(img) {
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 1, img.naturalWidth || img.width, 1, 0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
  } catch (e) {
    return '#ffffff';
  }
}

// رسم خلفية الثيم على كامل الكانفاس. styleId اختياري (أنماط backgrounds.js)؛
// بدونه يُرسم تدرّج/لون الثيم كما هو (الأيقونات والكفر).
export function paintBackground(ctx, theme, width, height, styleId) {
  if (styleId) {
    paintBackgroundStyle(ctx, theme, width, height, styleId);
    return;
  }
  ctx.fillStyle = resolveBackground(ctx, theme.bg, width, height);
  ctx.fillRect(0, 0, width, height);
}

// رسم عنوان عربي (RTL) ملفوف على عدة أسطر، موسّط أفقيًا.
export function drawTitle(ctx, text, opts) {
  if (!text) return 0;
  const { centerX, top, maxWidth, fontSize, color, lineHeight = 1.3, weight = 700 } = opts;
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.font = `${weight} ${fontSize}px 'Tajawal', system-ui, sans-serif`;

  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  let y = top;
  for (const l of lines) {
    ctx.fillText(l, centerX, y);
    y += fontSize * lineHeight;
  }
  ctx.restore();
  return y - top; // الارتفاع الكلي المستخدم
}

// الموزّع الرئيسي: يرسم preset واحدًا على الكانفاس المعطى (بأبعاده الحقيقية).
export function render(canvas, preset, config) {
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext('2d');
  // أعلى جودة تنعيم عند تصغير السكرينشوت داخل إطار الجوال —
  // الافتراضي 'low' يسبب فقدان حدة واضحًا في المخرجات النهائية.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const helpers = { paintBackground, drawTitle, detectTopTint, topBackgroundColor };

  switch (preset.type) {
    case 'icon':
      renderIcon(ctx, preset, config, helpers);
      break;
    case 'feature':
      renderFeature(ctx, preset, config, helpers);
      break;
    case 'screenshot':
    default:
      renderScreenshot(ctx, preset, config, helpers);
      break;
  }
  return canvas;
}
