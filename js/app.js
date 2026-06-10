// app.js — نقطة الدخول: إدارة الحالة وربط الواجهة بمحرّك الرسم والتصدير.

import { PRESETS, GROUPS, presetById } from './presets.js';
import { THEMES, themeById, makeCustomTheme } from './themes.js';
import { LAYOUTS } from './layouts.js';
import { BG_STYLES } from './backgrounds.js';
import { render, loadImage, fileToDataURL, ensureFontsReady } from './renderer.js';
import { exportAll, exportSingle } from './export.js';
import {
  validateMerchantConfig, buildExportConfig, downloadConfig,
  listPresets, savePreset, deletePreset, presetByName,
} from './merchantConfig.js';

// ---------- جلب إعدادات المتجر (لون + شعار) عبر بروكسي CORS ----------
// نفس آلية مشروع zid_web_mockup_app.
const PROXY_URL = 'https://zid-mockup-proxy.dev-60c.workers.dev';

function normalizeUrl(raw) {
  let url = (raw || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url.replace(/\/+$/, '');
}
const viaProxy = (target) => `${PROXY_URL}/${target}`;

async function fetchStoreSettings(storeUrl) {
  const res = await fetch(viaProxy(`${storeUrl}/api/v1/settings`), {
    method: 'GET',
    headers: { Accept: 'application/json', 'Accept-Language': 'ar', 'zid-client-platform': 'mobile_app' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
  return res.json();
}

function extractBranding(payload) {
  const root = (payload && payload.data) || payload || {};
  const settings = root.settings || {};
  const branding = settings.branding || {};
  const colors = branding.colors || {};
  const primary = colors.primary || branding.primary_color || null;
  const logo = branding.logo || root.logo || branding.mobile_app_logo || null;
  const name = root.name || branding.name || '';
  return { name, primary, logo };
}

// تحميل صورة من رابط خارجي بأمان للكانفاس (عبر البروكسي + crossOrigin).
function loadImageCors(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ---------- الحالة ----------
// كل سكرينشوت له إعداداته الخاصة (عنوان/ثيم/تخطيط) ليختلف عن بقية الصفحات.
const state = {
  shots: [], // [{ name, img, title, themeId, layoutId, customColor }]
  defaults: { title: '', themeId: 'brown', layoutId: LAYOUTS[0].id, customColor: '#6F008A', bgStyleId: 'gradient' },
  logo: null,
  platform: 'ios',          // مشترك للدفعة
  statusBarRatio: 0.12,     // مشترك (تغطية شريط الحالة)
  showFrame: true,          // مشترك
  showHeaderLogo: false,    // إظهار شعار المتجر أعلى كل الصفحات
  iconThemeId: 'purple',    // خلفية الأيقونات/الكفر (منفصلة عن الصور الوصفية)
  iconCustomColor: '#6F008A',
  bgGradient: true,         // خلفية اللون المخصص: تدرّج أو لون صلب (من إعداد التاجر)
  appName: '',              // اسم التطبيق من إعداد التاجر المستورد
  lastImported: null,       // آخر merchant config مستورد (للحفاظ على round-trip كامل)
  selected: new Set(PRESETS.filter((p) => p.defaultOn).map((p) => p.id)),
  previewShot: 0,
  previewPresetId: PRESETS.find((p) => p.type === 'screenshot').id,
};

// الهدف الذي تعدّله عناصر التحكم (الصورة المحددة، أو الإعدادات الافتراضية إن لم توجد صور).
function activeTarget() {
  return state.shots[state.previewShot] || state.defaults;
}

// ---------- حفظ واستعادة الجلسة (localStorage) ----------
// الإعدادات والشعار يبقيان بعد إغلاق الصفحة — السكرينشوتات لا تُحفظ (حجمها كبير).
const SESSION_KEY = 'sag:lastSession';

// يحوّل صورة الشعار لـ dataURL قابل للحفظ (null لو الكانفاس ملوّث بمصدر خارجي).
function imageToDataURL(img) {
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/png');
  } catch (e) {
    return null;
  }
}

function setLogo(img) {
  state.logo = img;
  state.logoDataURL = img ? imageToDataURL(img) : null;
  updateLogoPreview();
}

function saveSession() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      defaults: state.defaults,
      platform: state.platform,
      statusBarRatio: state.statusBarRatio,
      showFrame: state.showFrame,
      showHeaderLogo: state.showHeaderLogo,
      iconThemeId: state.iconThemeId,
      iconCustomColor: state.iconCustomColor,
      bgGradient: state.bgGradient,
      appName: state.appName,
      lastImported: state.lastImported,
      logoDataURL: state.logoDataURL || null,
    }));
  } catch (e) {
    /* امتلاء localStorage — نتجاهل، الجلسة الحالية لا تتأثر */
  }
}

async function restoreSession() {
  let s;
  try {
    s = JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch (e) { return; }
  if (!s) return;
  Object.assign(state.defaults, s.defaults || {});
  if (s.platform) state.platform = s.platform;
  if (typeof s.statusBarRatio === 'number') state.statusBarRatio = s.statusBarRatio;
  if (typeof s.showFrame === 'boolean') state.showFrame = s.showFrame;
  if (typeof s.showHeaderLogo === 'boolean') state.showHeaderLogo = s.showHeaderLogo;
  if (s.iconThemeId) state.iconThemeId = s.iconThemeId;
  if (s.iconCustomColor) state.iconCustomColor = s.iconCustomColor;
  if (typeof s.bgGradient === 'boolean') state.bgGradient = s.bgGradient;
  state.appName = s.appName || '';
  state.lastImported = s.lastImported || null;
  if (s.logoDataURL) {
    try { setLogo(await loadImage(s.logoDataURL)); } catch (e) { /* شعار تالف — نتجاهله */ }
  }
  // مزامنة عناصر التحكم مع الحالة المستعادة
  els.frameToggle.checked = state.showFrame;
  els.headerLogoToggle.checked = state.showHeaderLogo;
  const radio = els.platformGroup.querySelector(`input[value="${state.platform}"]`);
  if (radio) radio.checked = true;
}

function updateLogoPreview() {
  if (!els.logoPreview) return;
  if (state.logo) {
    els.logoPreview.src = state.logo.src;
    els.logoPreviewRow.hidden = false;
  } else {
    els.logoPreviewRow.hidden = true;
  }
}

// ---------- عناصر DOM ----------
const $ = (id) => document.getElementById(id);
const els = {
  storeUrlInput: $('storeUrlInput'),
  fetchStoreBtn: $('fetchStoreBtn'),
  fetchSpinner: $('fetchSpinner'),
  storeInfo: $('storeInfo'),
  storeName: $('storeName'),
  storeColorHex: $('storeColorHex'),
  storeColorSwatch: $('storeColorSwatch'),
  headerLogoToggle: $('headerLogoToggle'),
  merchantConfigInput: $('merchantConfigInput'),
  importConfigBtn: $('importConfigBtn'),
  exportConfigBtn: $('exportConfigBtn'),
  presetSelect: $('presetSelect'),
  savePresetBtn: $('savePresetBtn'),
  deletePresetBtn: $('deletePresetBtn'),
  shotsInput: $('shotsInput'),
  logoInput: $('logoInput'),
  logoPreviewRow: $('logoPreviewRow'),
  logoPreview: $('logoPreview'),
  titleInput: $('titleInput'),
  themeSwatches: $('themeSwatches'),
  iconThemeSwatches: $('iconThemeSwatches'),
  layoutChips: $('layoutChips'),
  bgStyleChips: $('bgStyleChips'),
  statusBarRange: $('statusBarRange'),
  statusBarVal: $('statusBarVal'),
  frameToggle: $('frameToggle'),
  presetsList: $('presetsList'),
  platformGroup: $('platformGroup'),
  exportBtn: $('exportBtn'),
  downloadCurrentBtn: $('downloadCurrentBtn'),
  spinner: $('spinner'),
  progress: $('progress'),
  errorBox: $('error-box'),
  previewCanvas: $('previewCanvas'),
  previewPreset: $('previewPreset'),
  emptyHint: $('emptyHint'),
  thumbs: $('thumbs'),
};

// ---------- بناة الواجهة الديناميكية ----------
// opts: { currentId(), onPick(id), customColor(), onCustom(hex) }
function buildSwatches(container, opts) {
  container.innerHTML = '';
  const active = opts.currentId();
  THEMES.forEach((t) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (t.id === active ? ' is-active' : '');
    b.title = t.label;
    b.style.background = t.swatch;
    b.addEventListener('click', () => {
      opts.onPick(t.id);
      buildSwatches(container, opts);
      renderPreview();
    });
    container.appendChild(b);
  });

  // لون مخصص (color picker)
  const label = document.createElement('label');
  label.className = 'swatch swatch--custom' + (active === 'custom' ? ' is-active' : '');
  label.title = 'لون مخصص';
  label.style.background = active === 'custom' ? opts.customColor() : '';
  const input = document.createElement('input');
  input.type = 'color';
  input.value = opts.customColor();
  input.addEventListener('input', (e) => {
    opts.onCustom(e.target.value);
    buildSwatches(container, opts);
    renderPreview();
  });
  label.appendChild(input);
  container.appendChild(label);
}

function buildLayouts() {
  els.layoutChips.innerHTML = '';
  LAYOUTS.forEach((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (l.id === activeTarget().layoutId ? ' is-active' : '');
    b.textContent = l.label;
    b.addEventListener('click', () => {
      activeTarget().layoutId = l.id;
      buildLayouts();
      renderPreview();
    });
    els.layoutChips.appendChild(b);
  });
}

function buildBgStyles() {
  els.bgStyleChips.innerHTML = '';
  BG_STYLES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (s.id === activeTarget().bgStyleId ? ' is-active' : '');
    b.textContent = s.label;
    b.addEventListener('click', () => {
      activeTarget().bgStyleId = s.id;
      buildBgStyles();
      renderPreview();
    });
    els.bgStyleChips.appendChild(b);
  });
}

function buildPresets() {
  els.presetsList.innerHTML = '';
  GROUPS.forEach((g) => {
    const groupPresets = PRESETS.filter((p) => p.group === g.id);
    if (!groupPresets.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'presets__group';
    const h = document.createElement('div');
    h.className = 'presets__group-title';
    h.textContent = g.label;
    wrap.appendChild(h);
    groupPresets.forEach((p) => {
      const label = document.createElement('label');
      label.className = 'presets__item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = state.selected.has(p.id);
      cb.addEventListener('change', () => {
        if (cb.checked) state.selected.add(p.id);
        else state.selected.delete(p.id);
      });
      const span = document.createElement('span');
      span.textContent = p.label;
      label.appendChild(cb);
      label.appendChild(span);
      wrap.appendChild(label);
    });
    els.presetsList.appendChild(wrap);
  });
}

function buildPreviewPresetOptions() {
  els.previewPreset.innerHTML = '';
  PRESETS.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label;
    if (p.id === state.previewPresetId) opt.selected = true;
    els.previewPreset.appendChild(opt);
  });
}

function buildThumbs() {
  els.thumbs.innerHTML = '';
  state.shots.forEach((shot, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'thumb-wrap';
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'thumb' + (i === state.previewShot ? ' is-active' : '');
    const img = document.createElement('img');
    img.src = shot.img.src;
    d.appendChild(img);
    d.addEventListener('click', () => {
      state.previewShot = i;
      buildThumbs();
      syncControls();
      renderPreview();
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'thumb-del';
    del.title = 'حذف الصورة';
    del.textContent = '✕';
    del.addEventListener('click', (ev) => {
      ev.stopPropagation();
      state.shots.splice(i, 1);
      if (state.previewShot >= state.shots.length) state.previewShot = Math.max(0, state.shots.length - 1);
      buildThumbs();
      syncControls();
      renderPreview();
    });
    wrap.appendChild(d);
    wrap.appendChild(del);
    els.thumbs.appendChild(wrap);
  });
}

// مزامنة عناصر التحكم (عنوان/ثيم/تخطيط) مع إعدادات الصورة المحددة.
function syncControls() {
  const t = activeTarget();
  els.titleInput.value = t.title || '';
  buildSwatches(els.themeSwatches, {
    currentId: () => activeTarget().themeId,
    onPick: (id) => { activeTarget().themeId = id; },
    customColor: () => activeTarget().customColor,
    onCustom: (hex) => { const a = activeTarget(); a.themeId = 'custom'; a.customColor = hex; },
  });
  buildLayouts();
  buildBgStyles();
}

// يحلّ ثيم الصورة الوصفية (مع دعم اللون المخصص).
function shotTheme(t) {
  return t.themeId === 'custom' ? makeCustomTheme(t.customColor, state.bgGradient) : themeById(t.themeId);
}
function iconTheme() {
  return state.iconThemeId === 'custom' ? makeCustomTheme(state.iconCustomColor, state.bgGradient) : themeById(state.iconThemeId);
}

// ---------- المعاينة ----------
function configFor(preset) {
  if (preset.type === 'screenshot') {
    const t = activeTarget();
    return {
      title: t.title,
      theme: shotTheme(t),
      layoutId: t.layoutId,
      bgStyleId: t.bgStyleId,
      platform: state.platform,
      statusBarRatio: state.statusBarRatio,
      showFrame: state.showFrame,
      showHeaderLogo: state.showHeaderLogo,
      logo: state.logo,
      screenshot: state.shots[state.previewShot] ? state.shots[state.previewShot].img : null,
    };
  }
  // أيقونة / كفر
  return { theme: iconTheme(), logo: state.logo };
}

async function renderPreview() {
  saveSession(); // كل تغيير يمر من هنا — أرخص نقطة حفظ تلقائي
  await ensureFontsReady();
  const preset = presetById(state.previewPresetId);
  const cfg = configFor(preset);
  const hasContent =
    (preset.type === 'screenshot' && cfg.screenshot) ||
    (preset.type !== 'screenshot' && state.logo);
  els.emptyHint.hidden = hasContent;
  els.previewCanvas.style.visibility = hasContent ? 'visible' : 'hidden';
  if (!hasContent) return;
  render(els.previewCanvas, preset, cfg);
}

// ---------- الأحداث ----------
function showError(msg) {
  els.errorBox.textContent = msg;
  els.errorBox.hidden = !msg;
}

// صور الآيفون كثيرًا ما تصل بصيغة HEIC التي لا تفكّها المتصفحات —
// نحوّلها لـ JPEG عبر heic-to (libheif حديثة تدعم صور HDR 10-bit من الآيفونات الجديدة).
// تُحمَّل عند الحاجة فقط (الملف ~3MB).
let heicToModule = null;
function isHeic(file) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

async function fileToImage(f) {
  let blob = f;
  if (isHeic(f)) {
    try {
      if (!heicToModule) heicToModule = await import('../lib/heic-to.min.js');
      blob = await heicToModule.heicTo({ blob: f, type: 'image/jpeg', quality: 0.95 });
    } catch (e) {
      blob = f; // بعض المتصفحات (Safari) تفك HEIC مباشرة — نجرب التحميل المباشر قبل الاستسلام
    }
  }
  const url = await fileToDataURL(blob);
  return loadImage(url);
}

els.shotsInput.addEventListener('change', async (e) => {
  showError('');
  // الترتيب حسب اسم الملف (الصور المُلتقطة مرقمة: 01-home.png…) = ترتيب الرفع النهائي في الـ ZIP.
  const files = [...e.target.files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );
  for (const f of files) {
    try {
      const img = await fileToImage(f);
      state.shots.push({ name: f.name, img, ...state.defaults });
    } catch (err) {
      showError('تعذّر تحميل إحدى الصور: ' + f.name + (isHeic(f) ? ' — فشل تحويل HEIC، حوّلها يدويًا لـ PNG/JPG' : ' — تأكد أنها PNG أو JPG'));
    }
  }
  state.previewShot = state.shots.length ? state.shots.length - files.length : 0;
  buildThumbs();
  syncControls();
  renderPreview();
});

els.logoInput.addEventListener('change', async (e) => {
  showError('');
  const f = e.target.files[0];
  if (!f) return;
  try {
    setLogo(await fileToImage(f));
    renderPreview();
  } catch (err) {
    showError('تعذّر تحميل اللوجو.');
  }
});

els.titleInput.addEventListener('input', (e) => {
  activeTarget().title = e.target.value;
  renderPreview();
});

els.platformGroup.addEventListener('change', (e) => {
  if (e.target.name === 'platform') {
    state.platform = e.target.value;
    renderPreview();
  }
});

els.statusBarRange.addEventListener('input', (e) => {
  state.statusBarRatio = Number(e.target.value) / 100;
  els.statusBarVal.textContent = e.target.value + '%';
  renderPreview();
});

els.frameToggle.addEventListener('change', (e) => {
  state.showFrame = e.target.checked;
  renderPreview();
});

els.previewPreset.addEventListener('change', (e) => {
  state.previewPresetId = e.target.value;
  renderPreview();
});

els.downloadCurrentBtn.addEventListener('click', () => {
  const preset = presetById(state.previewPresetId);
  exportSingle(els.previewCanvas, preset.id, preset.fmt);
});

els.headerLogoToggle.addEventListener('change', (e) => {
  state.showHeaderLogo = e.target.checked;
  renderPreview();
});

// ---------- إعداد التاجر (استيراد/تصدير/presets) ----------
// يطبّق merchant config (صيغة merchants/<id>.json المشتركة) على حالة الأداة.
async function applyMerchantConfig(cfg) {
  const hex = cfg.brand && cfg.brand.primaryColor;
  if (hex) {
    state.defaults.themeId = 'custom';
    state.defaults.customColor = hex;
    state.shots.forEach((s) => { s.themeId = 'custom'; s.customColor = hex; });
    state.iconThemeId = 'custom';
    state.iconCustomColor = hex;
  }

  const ag = cfg.assetGenerator || {};
  if (typeof ag.statusBarCoverage === 'number') {
    state.statusBarRatio = ag.statusBarCoverage / 100;
    els.statusBarRange.value = ag.statusBarCoverage;
    els.statusBarVal.textContent = ag.statusBarCoverage + '%';
  }
  if (typeof ag.showDeviceFrame === 'boolean') {
    state.showFrame = ag.showDeviceFrame;
    els.frameToggle.checked = ag.showDeviceFrame;
  }
  if (ag.background && ag.background.type) {
    state.bgGradient = ag.background.type !== 'solid';
    if (BG_STYLES.some((s) => s.id === ag.background.type)) {
      state.defaults.bgStyleId = ag.background.type;
      state.shots.forEach((s) => { s.bgStyleId = ag.background.type; });
    }
  }
  if (ag.template) {
    const layoutId = ag.template === 'default' ? 'classic' : ag.template;
    if (LAYOUTS.some((l) => l.id === layoutId)) {
      state.defaults.layoutId = layoutId;
      state.shots.forEach((s) => { s.layoutId = layoutId; });
    }
  }

  // الويب لا يقرأ مسارات محلية (brand.logo) — البديل: logoBase64 أو رفع يدوي.
  if (cfg.logoBase64) {
    const src = cfg.logoBase64.startsWith('data:')
      ? cfg.logoBase64
      : 'data:image/png;base64,' + cfg.logoBase64;
    try { setLogo(await loadImage(src)); }
    catch (e) { showError('تعذّر تحميل الشعار من logoBase64 — ارفعه يدويًا.'); }
  }

  state.appName = cfg.appName || '';
  state.lastImported = cfg;
  showStoreInfo(cfg.appName || cfg.id, hex || null);
  syncControls();
  rebuildIconSwatches();
  renderPreview();
}

// القيم الحالية للأداة بصيغة تصلح للتصدير/الحفظ كـ preset.
function currentToolSettings() {
  const d = state.defaults;
  return {
    appName: state.appName,
    primaryColor: d.themeId === 'custom' ? d.customColor : themeById(d.themeId).swatch,
    template: d.layoutId,
    statusBarCoverage: Math.round(state.statusBarRatio * 100),
    showDeviceFrame: state.showFrame,
    backgroundType: state.defaults.bgStyleId || (state.bgGradient ? 'gradient' : 'solid'),
  };
}

function rebuildPresetSelect(selected) {
  els.presetSelect.innerHTML = '<option value="">— الإعدادات المحفوظة —</option>';
  listPresets().forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    if (p.name === selected) opt.selected = true;
    els.presetSelect.appendChild(opt);
  });
}

els.importConfigBtn.addEventListener('click', () => els.merchantConfigInput.click());

els.merchantConfigInput.addEventListener('change', async (e) => {
  showError('');
  const f = e.target.files[0];
  e.target.value = ''; // يسمح بإعادة استيراد نفس الملف
  if (!f) return;
  let cfg;
  try {
    cfg = JSON.parse(await f.text());
  } catch (err) {
    showError('الملف ليس JSON صالحًا: ' + (err.message || err));
    return;
  }
  const errors = validateMerchantConfig(cfg);
  if (errors.length) {
    showError('إعداد التاجر غير صالح — ' + errors.join(' • '));
    return;
  }
  await applyMerchantConfig(cfg);
});

els.exportConfigBtn.addEventListener('click', () => {
  downloadConfig(buildExportConfig(currentToolSettings(), state.lastImported));
});

els.presetSelect.addEventListener('change', async (e) => {
  const p = presetByName(e.target.value);
  if (p) await applyMerchantConfig(p.config);
});

els.savePresetBtn.addEventListener('click', () => {
  const suggested = state.appName || (state.lastImported && state.lastImported.id) || '';
  const name = (window.prompt('اسم الإعداد المحفوظ:', suggested) || '').trim();
  if (!name) return;
  savePreset(name, buildExportConfig(currentToolSettings(), state.lastImported));
  rebuildPresetSelect(name);
});

els.deletePresetBtn.addEventListener('click', () => {
  const name = els.presetSelect.value;
  if (!name) return;
  deletePreset(name);
  rebuildPresetSelect('');
});

// جلب لون وشعار المتجر من الرابط
els.fetchStoreBtn.addEventListener('click', async () => {
  showError('');
  const url = normalizeUrl(els.storeUrlInput.value);
  if (!url) { showError('أدخل رابط المتجر أولًا.'); return; }
  els.fetchStoreBtn.disabled = true;
  els.fetchSpinner.hidden = false;
  try {
    const payload = await fetchStoreSettings(url);
    const { name, primary, logo } = extractBranding(payload);
    const hex = primary ? (primary.startsWith('#') ? primary : '#' + primary) : null;

    // تطبيق اللون على خلفيات الصور الوصفية والأيقونة (مع إبقاء إمكانية التغيير يدويًا)
    if (hex) {
      state.defaults.themeId = 'custom';
      state.defaults.customColor = hex;
      state.shots.forEach((s) => { s.themeId = 'custom'; s.customColor = hex; });
      state.iconThemeId = 'custom';
      state.iconCustomColor = hex;
    }
    // تحميل شعار المتجر (يبقى رفع لوجو آخر متاحًا ويستبدله)
    if (logo) {
      try { setLogo(await loadImageCors(viaProxy(logo))); }
      catch (e) { showError('تم جلب اللون، لكن تعذّر تحميل الشعار (يمكنك رفعه يدويًا).'); }
    }
    showStoreInfo(name, hex);
    syncControls();
    rebuildIconSwatches();
    renderPreview();
  } catch (err) {
    showError('تعذّر جلب إعدادات المتجر: ' + (err.message || err));
  } finally {
    els.fetchStoreBtn.disabled = false;
    els.fetchSpinner.hidden = true;
  }
});

function showStoreInfo(name, hex) {
  els.storeName.textContent = name || '—';
  els.storeColorHex.textContent = hex || '—';
  els.storeColorSwatch.style.background = hex || 'transparent';
  els.storeInfo.hidden = false;
}

els.exportBtn.addEventListener('click', async () => {
  showError('');
  if (!state.selected.size) {
    showError('اختر حجمًا واحدًا على الأقل.');
    return;
  }
  const needsShots = [...state.selected].some((id) => presetById(id).type === 'screenshot');
  const needsLogo = [...state.selected].some((id) => presetById(id).type !== 'screenshot');
  if (needsShots && !state.shots.length) {
    showError('ارفع سكرينشوت واحدًا على الأقل لأحجام السكرينشوت.');
    return;
  }
  if (needsLogo && !state.logo) {
    showError('ارفع اللوجو لتوليد الأيقونات/الكفر، أو ألغِ اختيارها.');
    return;
  }

  await ensureFontsReady();
  setBusy(true);
  try {
    const shotsConfig = state.shots.map((s) => ({
      screenshot: s.img,
      title: s.title,
      theme: shotTheme(s),
      layoutId: s.layoutId,
      bgStyleId: s.bgStyleId,
    }));
    const globalConfig = {
      platform: state.platform,
      statusBarRatio: state.statusBarRatio,
      showFrame: state.showFrame,
      showHeaderLogo: state.showHeaderLogo,
      logo: state.logo,
    };
    const iconConfig = { theme: iconTheme(), logo: state.logo };
    await exportAll(shotsConfig, [...state.selected], globalConfig, iconConfig, (done, total) => {
      els.progress.hidden = false;
      els.progress.textContent = `جارٍ التصدير… ${done}/${total}`;
    });
    els.progress.textContent = 'تم! تم تنزيل الملف store-assets.zip';
  } catch (err) {
    showError('فشل التصدير: ' + (err.message || err));
  } finally {
    setBusy(false);
  }
});

function setBusy(busy) {
  els.exportBtn.disabled = busy;
  els.spinner.hidden = !busy;
}

function rebuildIconSwatches() {
  buildSwatches(els.iconThemeSwatches, {
    currentId: () => state.iconThemeId,
    onPick: (id) => { state.iconThemeId = id; },
    customColor: () => state.iconCustomColor,
    onCustom: (hex) => { state.iconThemeId = 'custom'; state.iconCustomColor = hex; },
  });
}

// ---------- التهيئة ----------
(async () => {
  await restoreSession();
  buildPresets();
  buildPreviewPresetOptions();
  rebuildPresetSelect('');
  buildThumbs();
  rebuildIconSwatches();
  syncControls();
  updateLogoPreview();
  els.statusBarRange.value = Math.round(state.statusBarRatio * 100);
  els.statusBarVal.textContent = Math.round(state.statusBarRatio * 100) + '%';
  renderPreview();
})();
