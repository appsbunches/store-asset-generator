// templates/screenshot.js — قالب السكرينشوت التسويقي مع تخطيطات متعددة:
// خلفية الثيم + نقش زخرفي + (شعار) + عنوان + إطار جوال (بميلان/موضع حسب التخطيط)
// + السكرينشوت مع شريط حالة موحّد فوقه.

import { drawDeviceFrame, clipScreen, roundRectPath } from '../deviceFrame.js';
import { drawStatusBar } from '../statusBar.js';
import { layoutById, drawPattern } from '../layouts.js';

export function renderScreenshot(ctx, preset, config, helpers) {
  const { width, height } = preset;
  const {
    screenshot, title, theme, platform = 'ios', showFrame = true,
    logo = null, statusBarRatio, layoutId = 'classic', showHeaderLogo = false,
    bgStyleId = 'gradient',
  } = config;
  const layout = layoutById(layoutId);

  // 1) الخلفية (حسب النمط المختار) + النقش الزخرفي
  helpers.paintBackground(ctx, theme, width, height, bgStyleId);
  drawPattern(ctx, layout, theme, width, height);

  // 2) منطقة العنوان (وربما الشعار) أعلى الصورة
  // يظهر الشعار إن كان التخطيط من نوع "استعراض" أو فُعّل خيار "شعار المتجر بالأعلى".
  let headerBottom = height * 0.04;
  const wantLogo = (layout.titleMode === 'logo' || showHeaderLogo) && logo;
  if (wantLogo) {
    const logoH = height * 0.09;
    const lr = (logo.naturalWidth || logo.width) / (logo.naturalHeight || logo.height);
    const logoW = Math.min(logoH * lr, width * 0.5);
    ctx.drawImage(logo, (width - logoW) / 2, height * 0.045, logoW, logoH);
    headerBottom = height * 0.045 + logoH + height * 0.02;
  }

  let titleBlock = 0;
  if (title && layout.titleMode !== 'none') {
    titleBlock = helpers.drawTitle(ctx, title, {
      centerX: width / 2,
      top: headerBottom,
      maxWidth: width * 0.86,
      fontSize: Math.round(width * 0.058),
      color: theme.textColor,
    });
    headerBottom += titleBlock;
  }

  if (!screenshot) return;

  // 3) حساب مستطيل الجوال حسب التخطيط
  const imgRatio = (screenshot.naturalHeight || screenshot.height) / (screenshot.naturalWidth || screenshot.width);
  const topGap = headerBottom + height * 0.03;
  const sideMargin = width * (showFrame ? 0.12 : 0.08);
  const availW = width - sideMargin * 2;

  let frameW, frameH, frameX, frameY;

  if (layout.anchor === 'bottom') {
    // الجوال نازل للأسفل، يُقص جزؤه السفلي (يخرج عن حافة الصورة)
    frameW = availW * layout.scale;
    frameH = frameW * imgRatio;
    frameX = (width - frameW) / 2;
    frameY = Math.max(topGap, height - frameH * 0.82);
  } else {
    // موسّط ضمن المساحة المتاحة
    const bottomGap = height * 0.05;
    const availH = height - topGap - bottomGap;
    frameW = availW;
    frameH = frameW * imgRatio;
    if (frameH > availH) {
      frameH = availH;
      frameW = frameH / imgRatio;
    }
    frameW *= layout.scale;
    frameH *= layout.scale;
    frameX = (width - frameW) / 2;
    frameY = topGap + (availH - frameH) / 2;
  }

  drawPhone(ctx, screenshot, { frameX, frameY, frameW, frameH }, {
    platform, showFrame, statusBarRatio, rotate: layout.rotate,
  }, helpers);
}

// يرسم الجوال (إطار + سكرينشوت + شريط حالة) مع ميلان اختياري حول مركزه.
function drawPhone(ctx, img, rect, opt, helpers) {
  const { frameX, frameY, frameW, frameH } = rect;
  const { platform, showFrame, statusBarRatio, rotate = 0 } = opt;

  ctx.save();
  if (rotate) {
    const cx = frameX + frameW / 2;
    const cy = frameY + frameH / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  if (showFrame) {
    const screen = drawDeviceFrame(ctx, { x: frameX, y: frameY, w: frameW, h: frameH, platform });
    drawScreenshotInto(ctx, img, screen, platform, statusBarRatio, helpers);
  } else {
    const radius = frameW * 0.08;
    ctx.save();
    roundRectPath(ctx, frameX, frameY, frameW, frameH, radius);
    ctx.clip();
    drawCover(ctx, img, frameX, frameY, frameW, frameH);
    overlayStatusBar(ctx, img, frameX, frameY, frameW, platform, statusBarRatio, helpers);
    ctx.restore();
  }
  ctx.restore();
}

function drawScreenshotInto(ctx, img, screen, platform, ratio, helpers) {
  const { screenX, screenY, screenW, screenH, radius } = screen;
  ctx.save();
  clipScreen(ctx, screenX, screenY, screenW, screenH, radius);
  drawCover(ctx, img, screenX, screenY, screenW, screenH);
  const tint = helpers.detectTopTint(img);
  const bgFill = helpers.topBackgroundColor(img);
  drawStatusBar(ctx, { x: screenX, y: screenY, w: screenW, platform, tint, bgFill, ratio });
  ctx.restore();
}

function overlayStatusBar(ctx, img, x, y, w, platform, ratio, helpers) {
  const tint = helpers.detectTopTint(img);
  const bgFill = helpers.topBackgroundColor(img);
  drawStatusBar(ctx, { x, y, w, platform, tint, bgFill, ratio });
}

// يرسم الصورة بأسلوب cover (يملأ المنطقة مع قص الفائض، محافظًا على النسبة).
function drawCover(ctx, img, dx, dy, dw, dh) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}
