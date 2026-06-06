// themes.js — ثيمات خلفيات الصور المُصدَّرة (منفصلة عن ثيم واجهة الموقع)
// مستوحاة من مخرجات المصمم: بنّي / ذهبي / أخضر + نسخة بيضاء.
// كل ثيم:
//   bg        : خلفية الصورة (لون صلب أو تدرّج)
//   textColor : لون نص العنوان فوق الخلفية
//   frameColor: لون إطار الجوال (اختياري، الافتراضي داكن)

export const THEMES = [
  {
    id: 'white',
    label: 'أبيض',
    bg: '#ffffff',
    textColor: '#1b1424',
    swatch: '#ffffff',
  },
  {
    id: 'brown',
    label: 'بنّي',
    bg: { type: 'linear', angle: 135, stops: ['#4a2c20', '#7a4a32'] },
    textColor: '#ffffff',
    swatch: '#5e3826',
  },
  {
    id: 'gold',
    label: 'ذهبي',
    bg: { type: 'linear', angle: 135, stops: ['#caa24a', '#e7c66a'] },
    textColor: '#3a2c0a',
    swatch: '#d4af37',
  },
  {
    id: 'green',
    label: 'أخضر',
    bg: { type: 'linear', angle: 135, stops: ['#0f5c46', '#1f8a66'] },
    textColor: '#ffffff',
    swatch: '#1f8a66',
  },
  {
    id: 'purple',
    label: 'بنفسجي',
    bg: { type: 'linear', angle: 135, stops: ['#6F008A', '#8A1FA9'] },
    textColor: '#ffffff',
    swatch: '#6F008A',
  },
];

export function themeById(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

// يبني ثيمًا من لون مخصص يختاره المستخدم، مع حساب لون النص تلقائيًا حسب السطوع.
export function makeCustomTheme(color, gradient = true) {
  const text = pickTextColor(color);
  const bg = gradient ? { type: 'linear', angle: 135, stops: [color, shade(color, -0.18)] } : color;
  return { id: 'custom', label: 'مخصص', bg, textColor: text, swatch: color };
}

// أبيض على الخلفية الداكنة، وداكن على الفاتحة.
export function pickTextColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 150 ? '#ffffff' : '#1b1424';
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

// يفتّح/يغمّق لونًا بنسبة amount (موجبة = أفتح، سالبة = أغمق).
function shade(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const f = (c) => {
    const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

// يبني fillStyle مناسبًا من تعريف الخلفية (لون صلب أو تدرّج) على سياق canvas معيّن.
export function resolveBackground(ctx, bg, width, height) {
  if (typeof bg === 'string') return bg;
  if (bg && bg.type === 'linear') {
    const angle = ((bg.angle || 135) * Math.PI) / 180;
    // اتجاه التدرّج عبر مركز الكانفاس
    const cx = width / 2;
    const cy = height / 2;
    const len = Math.max(width, height);
    const dx = (Math.cos(angle) * len) / 2;
    const dy = (Math.sin(angle) * len) / 2;
    const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    const stops = bg.stops || ['#000', '#333'];
    stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
    return grad;
  }
  return '#ffffff';
}
