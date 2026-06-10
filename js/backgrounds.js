// backgrounds.js — أنماط خلفيات متعددة للصور الوصفية، تُشتق كلها من لون الثيم
// المختار (theme.swatch) فتتناسق مع أي لون براند تلقائيًا.
// كل نمط: { id, label, paint(ctx, theme, w, h) } — يملأ الكانفاس كاملًا.

import { resolveBackground, shade } from './themes.js';

// اللون الأساس للاشتقاق (موجود على كل الثيمات بما فيها المخصصة).
const base = (theme) => theme.swatch;

export const BG_STYLES = [
  {
    id: 'gradient',
    label: 'تدرّج',
    paint(ctx, theme, w, h) {
      // السلوك الأصلي: تدرّج الثيم نفسه (أو لونه الصلب للثيم الأبيض)
      ctx.fillStyle = resolveBackground(ctx, theme.bg, w, h);
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'solid',
    label: 'صلب',
    paint(ctx, theme, w, h) {
      ctx.fillStyle = base(theme);
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'vertical',
    label: 'رأسي',
    paint(ctx, theme, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, shade(base(theme), 0.12));
      g.addColorStop(1, shade(base(theme), -0.22));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'radial',
    label: 'إشعاعي',
    paint(ctx, theme, w, h) {
      const g = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, Math.max(w, h) * 0.85);
      g.addColorStop(0, shade(base(theme), 0.16));
      g.addColorStop(1, shade(base(theme), -0.25));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'duo',
    label: 'قطري',
    paint(ctx, theme, w, h) {
      ctx.fillStyle = base(theme);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = shade(base(theme), -0.18);
      ctx.beginPath();
      ctx.moveTo(0, h * 0.55);
      ctx.lineTo(w, h * 0.25);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'bubbles',
    label: 'فقاعات',
    paint(ctx, theme, w, h) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, base(theme));
      g.addColorStop(1, shade(base(theme), -0.2));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const circles = [
        [w * 0.85, h * 0.12, w * 0.3, 0.14],
        [w * 0.08, h * 0.3, w * 0.18, 0.1],
        [w * 0.15, h * 0.85, w * 0.34, 0.12],
        [w * 0.92, h * 0.7, w * 0.2, 0.08],
      ];
      circles.forEach(([cx, cy, r, a]) => {
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });
    },
  },
  {
    id: 'blob',
    label: 'كتلة',
    paint(ctx, theme, w, h) {
      ctx.fillStyle = shade(base(theme), 0.08);
      ctx.fillRect(0, 0, w, h);
      // كتلة عضوية داكنة تحتل الزاوية السفلية
      ctx.fillStyle = shade(base(theme), -0.2);
      ctx.beginPath();
      ctx.moveTo(0, h * 0.45);
      ctx.bezierCurveTo(w * 0.4, h * 0.3, w * 0.75, h * 0.55, w, h * 0.4);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'wave',
    label: 'موجة',
    paint(ctx, theme, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, shade(base(theme), 0.14));
      g.addColorStop(1, base(theme));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // موجتان متراكبتان أسفل الصورة
      const wave = (baseY, amp, alpha) => {
        ctx.fillStyle = `rgba(0,0,0,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        ctx.bezierCurveTo(w * 0.25, baseY - amp, w * 0.6, baseY + amp, w, baseY - amp * 0.4);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();
      };
      wave(h * 0.62, h * 0.06, 0.1);
      wave(h * 0.72, h * 0.05, 0.14);
    },
  },
];

export function bgStyleById(id) {
  return BG_STYLES.find((s) => s.id === id) || BG_STYLES[0];
}

export function paintBackgroundStyle(ctx, theme, w, h, styleId) {
  bgStyleById(styleId).paint(ctx, theme, w, h);
}
