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

  // المحتوى بحجم ثابت (مهما زادت التغطية) ويبقى قرب أعلى الشاشة كهاتف حقيقي،
  // والتغطية الإضافية تمتد أسفله فقط لتغطية الشريط الأصلي.
  const bandH = Math.min(h, w * (CONTENT_BASE[platform] || CONTENT_BASE.ios));
  const cy = y + bandH / 2 + w * 0.005;

  if (platform === 'android') {
    drawAndroid(ctx, x, w, bandH, cy, color);
  } else {
    drawIOS(ctx, x, w, bandH, cy, color);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// iOS — يحاكي شريط حالة آبل الفعلي (iPhone بجزيرة ديناميكية):
// الساعة (9:41) بخط النظام في منتصف "الأذن" اليسرى، الجزيرة في الوسط،
// والأيقونات (شبكة، واي‑فاي، بطارية) في منتصف الأذن اليمنى.
function drawIOS(ctx, x, w, bandH, cy, color) {
  const fontSize = Math.round(bandH * 0.5);

  // الجزيرة الديناميكية (Dynamic Island) في الوسط — بحجم ثابت
  const islW = w * 0.3;
  const islH = bandH * 0.64;
  roundRect(ctx, x + w / 2 - islW / 2, cy - islH / 2, islW, islH, islH / 2);
  ctx.fillStyle = '#000000';
  ctx.fill();

  const earW = (w - islW) / 2; // عرض المنطقة على جانبي الجزيرة

  // الساعة في منتصف الأذن اليسرى — بخط النظام (SF على آبل) وليس Tajawal
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = `600 ${fontSize}px -apple-system, system-ui, 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillText('9:41', x + earW * 0.5, cy + fontSize * 0.04);

  // الأيقونات موسّطة في الأذن اليمنى: شبكة ← واي‑فاي ← بطارية
  const iconH = bandH * 0.32;
  const gap1 = iconH * 0.55; // بين الشبكة والواي‑فاي
  const gap2 = iconH * 0.5;  // بين الواي‑فاي والبطارية
  const signalW = iconH * 0.22 * 4 + iconH * 0.22 * 0.55 * 3;
  const wifiW = iconH * 1.25;
  const battW = iconH * 2.0 + iconH * 0.18;
  const iconsW = signalW + gap1 + wifiW + gap2 + battW;

  let rightX = x + w - earW * 0.5 + iconsW / 2;
  rightX = Math.min(rightX, x + w - w * 0.03);
  rightX = drawBattery(ctx, rightX, cy, iconH, color);
  rightX -= gap2;
  rightX = drawWifi(ctx, rightX, cy, iconH, color, false);
  rightX -= gap1;
  drawSignalBars(ctx, rightX, cy, iconH, color);
}

// ---------------------------------------------------------------------------
// Android — نمط Pixel الحديث: الساعة على اليسار، وعلى اليمين بالترتيب
// (من اليسار لليمين): واي‑فاي، شبكة، بطارية. الساعة 12:00 مطابقة لوضع
// demo mode الذي يثبّته pipeline الالتقاط (adb demo clock 1200).
function drawAndroid(ctx, x, w, bandH, cy, color) {
  const padX = w * 0.05;
  const fontSize = Math.round(bandH * 0.5);

  // الساعة (يسار) — Roboto خط نظام أندرويد
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `500 ${fontSize}px Roboto, 'Helvetica Neue', system-ui, Arial, sans-serif`;
  ctx.fillText('12:00', x + padX, cy + fontSize * 0.04);

  // الأيقونات (يمين): البطارية أقصى اليمين، ثم مثلث الشبكة، ثم الواي‑فاي
  const iconH = bandH * 0.4;
  let rightX = x + w - padX;
  rightX = drawAndroidBattery(ctx, rightX, cy, iconH, color);
  rightX -= iconH * 0.5;
  rightX = drawSignalTriangle(ctx, rightX, cy, iconH, color);
  rightX -= iconH * 0.5;
  drawWifi(ctx, rightX, cy, iconH, color, true);
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

// قوس واي‑فاي. آبل: ثلاثة أقواس فقط. أندرويد: أقواس + نقطة سفلية.
function drawWifi(ctx, rightX, cy, h, color, withDot) {
  const w = h * 1.25;
  const cx = rightX - w / 2;
  const baseY = cy + h / 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, h * 0.16);
  ctx.lineCap = 'round';
  const arcs = [0.95, 0.62, 0.3];
  arcs.forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, baseY, (w / 2) * r, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  });
  if (withDot) {
    ctx.beginPath();
    ctx.arc(cx, baseY - h * 0.05, h * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  return rightX - w;
}

// بطارية iOS كما يرسمها النظام: إطار بشفافية ~40% + طرف صغير بنفس الشفافية
// + تعبئة داخلية صلبة كاملة (batteryLevel 100 كما يثبّتها simctl في الالتقاط).
function drawBattery(ctx, rightX, cy, h, color) {
  const bw = h * 2.0;
  const bh = h;
  const left = rightX - bw - h * 0.18;
  const top = cy - bh / 2;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = Math.max(1, h * 0.1);
  roundRect(ctx, left, top, bw, bh, bh * 0.32);
  ctx.stroke();
  // الطرف (نتوء صغير على يمين الإطار)
  ctx.fillStyle = color;
  roundRect(ctx, rightX - h * 0.16, cy - bh * 0.17, h * 0.14, bh * 0.34, h * 0.07);
  ctx.fill();
  ctx.globalAlpha = 1;
  // التعبئة الصلبة (ممتلئة 100%)
  const pad = bh * 0.18;
  roundRect(ctx, left + pad, top + pad, bw - pad * 2, bh - pad * 2, bh * 0.18);
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
