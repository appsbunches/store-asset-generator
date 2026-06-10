// layouts.js — تخطيطات (قوالب) متعددة للصور الوصفية، بحيث تختلف كل صفحة عن الأخرى
// كما كان يفعل المصمم (جوال مستقيم/مائل، شعار أعلى، نقوش خلفية…).
//
// كل تخطيط:
//   titleMode : 'top' (عنوان أعلى) | 'logo' (شعار + عنوان أعلى) | 'none'
//   anchor    : 'center' (الجوال موسّط) | 'bottom' (الجوال نازل للأسفل، يُقص جزؤه السفلي)
//   rotate    : زاوية ميلان الجوال بالدرجات (0 = مستقيم)
//   scale     : تكبير الجوال داخل المساحة المتاحة
//   pattern   : 'none' | 'chevron' | 'dots' — نقش زخرفي على الخلفية

export const LAYOUTS = [
  { id: 'classic',   label: 'كلاسيكي',  titleMode: 'top',  anchor: 'center', rotate: 0,   scale: 1.0,  pattern: 'none' },
  { id: 'chevron',   label: 'مائل',     titleMode: 'top',  anchor: 'center', rotate: -8,  scale: 1.04, pattern: 'chevron' },
  { id: 'showcase',  label: 'استعراض',  titleMode: 'logo', anchor: 'bottom', rotate: -7,  scale: 1.12, pattern: 'dots' },
  { id: 'bottom',    label: 'سفلي',     titleMode: 'top',  anchor: 'bottom', rotate: 0,   scale: 1.18, pattern: 'none' },
  { id: 'spotlight', label: 'إشعاع',    titleMode: 'top',  anchor: 'center', rotate: 0,   scale: 0.98, pattern: 'spotlight' },
  { id: 'rings',     label: 'حلقات',    titleMode: 'top',  anchor: 'center', rotate: 0,   scale: 1.0,  pattern: 'rings' },
  { id: 'waves',     label: 'موجات',    titleMode: 'top',  anchor: 'bottom', rotate: 0,   scale: 1.12, pattern: 'waves' },
  { id: 'stripes',   label: 'خطوط',     titleMode: 'top',  anchor: 'center', rotate: 6,   scale: 1.02, pattern: 'stripes' },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

// لون النقش الزخرفي مشتق من لون النص (فاتح على الداكن، داكن على الفاتح).
function decoColor(theme, alpha) {
  const light = (theme.textColor || '#000').toLowerCase();
  const isLightText = light === '#fff' || light === '#ffffff' || light === 'white';
  return isLightText ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
}

// رسم النقش الزخرفي حسب نوع التخطيط (يُستدعى بعد الخلفية وقبل الجوال).
export function drawPattern(ctx, layout, theme, width, height) {
  switch (layout.pattern) {
    case 'chevron':
      drawChevrons(ctx, theme, width, height);
      break;
    case 'dots':
      drawDots(ctx, theme, width, height);
      break;
    case 'spotlight':
      drawSpotlight(ctx, theme, width, height);
      break;
    case 'rings':
      drawRings(ctx, theme, width, height);
      break;
    case 'waves':
      drawWaves(ctx, theme, width, height);
      break;
    case 'stripes':
      drawStripes(ctx, theme, width, height);
      break;
    default:
      break;
  }
}

// شيفرونات (أسهم زاويّة) على الجانبين تشير للداخل.
function drawChevrons(ctx, theme, width, height) {
  ctx.save();
  ctx.strokeStyle = decoColor(theme, 0.1);
  ctx.lineWidth = width * 0.02;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const cy = height * 0.5;
  const armW = width * 0.12;
  const armH = height * 0.1;
  for (let i = 0; i < 3; i++) {
    const off = i * width * 0.06;
    // يمين
    chevron(ctx, width - width * 0.04 - off, cy, -armW, armH);
    // يسار
    chevron(ctx, width * 0.04 + off, cy, armW, armH);
  }
  ctx.restore();
}

function chevron(ctx, x, y, dx, dy) {
  ctx.beginPath();
  ctx.moveTo(x - dx, y - dy);
  ctx.lineTo(x, y);
  ctx.lineTo(x - dx, y + dy);
  ctx.stroke();
}

// شبكة نقاط في الزوايا السفلية.
function drawDots(ctx, theme, width, height) {
  ctx.save();
  ctx.fillStyle = decoColor(theme, 0.12);
  const r = width * 0.006;
  const gap = width * 0.045;
  const cols = 6;
  const rows = 5;
  for (let c = 0; c < cols; c++) {
    for (let row = 0; row < rows; row++) {
      // أسفل اليسار
      dot(ctx, width * 0.05 + c * gap, height * 0.72 + row * gap, r);
      // أعلى اليمين
      dot(ctx, width * 0.6 + c * gap, height * 0.06 + row * gap, r);
    }
  }
  ctx.restore();
}

function dot(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// هالة ضوئية ناعمة خلف موضع الجوال (منتصف الصورة) تبرز المحتوى.
function drawSpotlight(ctx, theme, width, height) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.55;
  const r = Math.max(width, height) * 0.55;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  const c = decoColor(theme, 0.16).replace(/[\d.]+\)$/, '');
  g.addColorStop(0, c + '0.16)');
  g.addColorStop(0.55, c + '0.06)');
  g.addColorStop(1, c + '0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// حلقات (دوائر مفرغة متراكزة) في زاويتين متقابلتين.
function drawRings(ctx, theme, width, height) {
  ctx.save();
  ctx.strokeStyle = decoColor(theme, 0.1);
  ctx.lineWidth = width * 0.008;
  const ring = (cx, cy, base) => {
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, base * i, 0, Math.PI * 2);
      ctx.stroke();
    }
  };
  ring(width * 0.04, height * 0.13, width * 0.05);   // أعلى اليسار
  ring(width * 0.96, height * 0.87, width * 0.06);   // أسفل اليمين
  ctx.restore();
}

// موجات (منحنيات جيبية) خلف النصف السفلي حيث يجلس الجوال.
function drawWaves(ctx, theme, width, height) {
  ctx.save();
  ctx.strokeStyle = decoColor(theme, 0.12);
  ctx.lineWidth = width * 0.006;
  const amp = height * 0.012;
  const waveLen = width / 2.5;
  for (let w = 0; w < 4; w++) {
    const baseY = height * (0.3 + w * 0.045);
    ctx.beginPath();
    for (let x = 0; x <= width; x += 8) {
      const y = baseY + Math.sin((x / waveLen) * Math.PI * 2 + w) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// خطوط قطرية عريضة شفافة تقطع الخلفية (تتناسق مع ميلان الجوال).
function drawStripes(ctx, theme, width, height) {
  ctx.save();
  ctx.fillStyle = decoColor(theme, 0.06);
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-24 * Math.PI) / 180);
  const stripeW = width * 0.16;
  const span = Math.max(width, height) * 1.6;
  for (let i = -3; i <= 3; i += 2) {
    ctx.fillRect(i * stripeW * 1.7 - stripeW / 2, -span / 2, stripeW, span);
  }
  ctx.restore();
}
