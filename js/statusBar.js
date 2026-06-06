// statusBar.js — يرسم شريط حالة مثالي (iOS / Android) فوق منطقة أعلى السكرينشوت.
// الهدف: تغطية/استبدال شريط الحالة الحقيقي في الصورة المرفوعة بشريط نظيف موحّد.
//
// المدخلات:
//   ctx       : سياق الكانفاس
//   x, y, w   : إحداثيات وعرض منطقة الشاشة (يُرسم الشريط أعلاها)
//   platform  : 'ios' | 'android'
//   tint      : 'dark' | 'light' (لون الأيقونات والنص) — يُحدَّد تلقائيًا من الخلفية
//   bgFill    : لون يُملأ به الشريط لتغطية الشريط الأصلي (عادة لون أعلى السكرينشوت)
//
// الأبعاد تُشتق من عرض الشاشة w لتكون متناسبة مع أي حجم مخرج.

// نسبة الارتفاع الافتراضية لكل منصّة (من عرض الشاشة). تُغطّي شريط الحالة الأصلي
// كاملًا في الأجهزة الحديثة. يمكن تجاوزها بتمرير ratio (من شريط التحكم).
export const DEFAULT_RATIO = { ios: 0.12, android: 0.085 };

export function statusBarHeight(w, platform, ratio) {
  const r = ratio || DEFAULT_RATIO[platform] || DEFAULT_RATIO.ios;
  return Math.round(w * r);
}

// حجم محتوى الشريط (الساعة/الأيقونات) ثابت ولا يكبر مع زيادة التغطية —
// نسبة من عرض الشاشة تعطي مظهرًا واقعيًا كهاتف حقيقي.
const CONTENT_BASE = { ios: 0.082, android: 0.072 };

export function drawStatusBar(ctx, opts) {
  const { x, y, w, platform = 'ios', tint = 'dark', bgFill = '#ffffff', ratio } = opts;
  const h = statusBarHeight(w, platform, ratio); // ارتفاع التغطية (يغطّي الشريط الأصلي)
  const color = tint === 'light' ? '#ffffff' : '#000000';

  ctx.save();

  // تغطية منطقة الشريط الأصلي بالكامل
  ctx.fillStyle = bgFill;
  ctx.fillRect(x, y, w, h);

  // المحتوى بحجم ثابت (مهما زادت التغطية) ويوضع قرب أعلى الشريط كما في الهاتف.
  const bandH = Math.min(h, w * (CONTENT_BASE[platform] || CONTENT_BASE.ios));
  const cy = y + bandH / 2 + (h - bandH) * 0.3;

  if (platform === 'android') {
    drawAndroid(ctx, x, w, bandH, cy, color);
  } else {
    drawIOS(ctx, x, w, bandH, cy, color);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// iOS: الساعة (9:41) على اليسار، الجزيرة في الوسط، الأيقونات على اليمين.
// bandH = حجم المحتوى الثابت، cy = المركز الرأسي للصف.
function drawIOS(ctx, x, w, bandH, cy, color) {
  const padX = w * 0.06;
  const fontSize = Math.round(bandH * 0.46);

  // الساعة (يسار)
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `600 ${fontSize}px 'Tajawal', system-ui, sans-serif`;
  ctx.fillText('9:41', x + padX, cy + fontSize * 0.04);

  // الأيقونات (يمين): شبكة، واي‑فاي، بطارية
  const iconH = bandH * 0.32;
  let rightX = x + w - padX;
  rightX = drawBattery(ctx, rightX, cy, iconH, color, true);
  rightX -= iconH * 0.7;
  rightX = drawWifi(ctx, rightX, cy, iconH, color);
  rightX -= iconH * 0.55;
  drawSignalBars(ctx, rightX, cy, iconH, color);
}

// ---------------------------------------------------------------------------
// Android: الساعة على اليسار، الأيقونات على اليمين (بأشكال أبسط/مختلفة).
function drawAndroid(ctx, x, w, bandH, cy, color) {
  const padX = w * 0.05;
  const fontSize = Math.round(bandH * 0.5);

  // الساعة (يسار) — أندرويد يميل لخط أنحف
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `500 ${fontSize}px 'Tajawal', system-ui, sans-serif`;
  ctx.fillText('9:41', x + padX, cy + fontSize * 0.04);

  // الأيقونات (يمين): شبكة، واي‑فاي، بطارية (نمط أندرويد)
  const iconH = bandH * 0.4;
  let rightX = x + w - padX;
  rightX = drawAndroidBattery(ctx, rightX, cy, iconH, color);
  rightX -= iconH * 0.55;
  rightX = drawWifi(ctx, rightX, cy, iconH, color);
  rightX -= iconH * 0.5;
  drawSignalTriangle(ctx, rightX, cy, iconH, color);
}

// ---------------------------------------------------------------------------
// رسومات الأيقونات (كلها تنتهي عند rightX وترجع الـ X الأيسر الجديد)

// أعمدة الشبكة بنمط iOS (4 أعمدة متدرّجة الارتفاع)
function drawSignalBars(ctx, rightX, cy, h, color) {
  const barW = h * 0.22;
  const gap = barW * 0.55;
  const totalW = barW * 4 + gap * 3;
  let bx = rightX - totalW;
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    const bh = h * (0.45 + i * 0.18);
    roundRect(ctx, bx, cy + h / 2 - bh, barW, bh, barW * 0.3);
    ctx.fill();
    bx += barW + gap;
  }
  return rightX - totalW;
}

// مثلث الشبكة بنمط أندرويد
function drawSignalTriangle(ctx, rightX, cy, h, color) {
  const size = h;
  const left = rightX - size;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(left, cy + size / 2);
  ctx.lineTo(rightX, cy + size / 2);
  ctx.lineTo(rightX, cy - size / 2);
  ctx.closePath();
  ctx.fill();
  return left;
}

// قوس واي‑فاي (مشترك بين المنصّتين بتقريب بسيط)
function drawWifi(ctx, rightX, cy, h, color) {
  const w = h * 1.25;
  const cx = rightX - w / 2;
  const baseY = cy + h / 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, h * 0.12);
  ctx.lineCap = 'round';
  const arcs = [0.95, 0.62, 0.3];
  arcs.forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, baseY, (w / 2) * r, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  });
  // النقطة
  ctx.beginPath();
  ctx.arc(cx, baseY - h * 0.05, h * 0.08, 0, Math.PI * 2);
  ctx.fill();
  return rightX - w;
}

// بطارية iOS (مستطيل بزوايا + طرف صغير + تعبئة)
function drawBattery(ctx, rightX, cy, h, color) {
  const bw = h * 2.0;
  const bh = h;
  const left = rightX - bw - h * 0.18;
  const top = cy - bh / 2;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = Math.max(1, h * 0.1);
  roundRect(ctx, left, top, bw, bh, bh * 0.28);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // الطرف
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.65;
  roundRect(ctx, rightX - h * 0.16, cy - bh * 0.18, h * 0.16, bh * 0.36, h * 0.08);
  ctx.fill();
  ctx.globalAlpha = 1;
  // التعبئة
  const pad = bh * 0.16;
  roundRect(ctx, left + pad, top + pad, bw - pad * 2, bh - pad * 2, bh * 0.16);
  ctx.fill();
  return left;
}

// بطارية أندرويد (شكل عمودي بسيط مع طرف علوي)
function drawAndroidBattery(ctx, rightX, cy, h, color) {
  const bw = h * 0.62;
  const bh = h * 1.05;
  const left = rightX - bw;
  const top = cy - bh / 2;
  ctx.fillStyle = color;
  // الطرف العلوي
  roundRect(ctx, left + bw * 0.3, top, bw * 0.4, bh * 0.1, bw * 0.1);
  ctx.fill();
  // الجسم
  roundRect(ctx, left, top + bh * 0.1, bw, bh * 0.9, bw * 0.18);
  ctx.fill();
  return left;
}

// مستطيل بزوايا دائرية (أداة مساعدة)
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
