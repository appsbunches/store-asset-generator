// app.js — نقطة الدخول: إدارة الحالة وربط الواجهة بمحرّك الرسم والتصدير.

import { PRESETS, GROUPS, presetById } from './presets.js';
import { THEMES, themeById, makeCustomTheme } from './themes.js';
import { LAYOUTS } from './layouts.js';
import { render, loadImage, fileToDataURL, ensureFontsReady } from './renderer.js';
import { exportAll, exportSingle } from './export.js';

// ---------- الحالة ----------
// كل سكرينشوت له إعداداته الخاصة (عنوان/ثيم/تخطيط) ليختلف عن بقية الصفحات.
const state = {
  shots: [], // [{ name, img, title, themeId, layoutId, customColor }]
  defaults: { title: '', themeId: 'brown', layoutId: LAYOUTS[0].id, customColor: '#6F008A' },
  logo: null,
  platform: 'ios',          // مشترك للدفعة
  statusBarRatio: 0.12,     // مشترك (تغطية شريط الحالة)
  showFrame: true,          // مشترك
  iconThemeId: 'purple',    // خلفية الأيقونات/الكفر (منفصلة عن الصور الوصفية)
  iconCustomColor: '#6F008A',
  selected: new Set(PRESETS.filter((p) => p.defaultOn).map((p) => p.id)),
  previewShot: 0,
  previewPresetId: PRESETS.find((p) => p.type === 'screenshot').id,
};

// الهدف الذي تعدّله عناصر التحكم (الصورة المحددة، أو الإعدادات الافتراضية إن لم توجد صور).
function activeTarget() {
  return state.shots[state.previewShot] || state.defaults;
}

// ---------- عناصر DOM ----------
const $ = (id) => document.getElementById(id);
const els = {
  shotsInput: $('shotsInput'),
  logoInput: $('logoInput'),
  titleInput: $('titleInput'),
  themeSwatches: $('themeSwatches'),
  iconThemeSwatches: $('iconThemeSwatches'),
  layoutChips: $('layoutChips'),
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
    els.thumbs.appendChild(d);
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
}

// يحلّ ثيم الصورة الوصفية (مع دعم اللون المخصص).
function shotTheme(t) {
  return t.themeId === 'custom' ? makeCustomTheme(t.customColor) : themeById(t.themeId);
}
function iconTheme() {
  return state.iconThemeId === 'custom' ? makeCustomTheme(state.iconCustomColor) : themeById(state.iconThemeId);
}

// ---------- المعاينة ----------
function configFor(preset) {
  if (preset.type === 'screenshot') {
    const t = activeTarget();
    return {
      title: t.title,
      theme: shotTheme(t),
      layoutId: t.layoutId,
      platform: state.platform,
      statusBarRatio: state.statusBarRatio,
      showFrame: state.showFrame,
      logo: state.logo,
      screenshot: state.shots[state.previewShot] ? state.shots[state.previewShot].img : null,
    };
  }
  // أيقونة / كفر
  return { theme: iconTheme(), logo: state.logo };
}

async function renderPreview() {
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

els.shotsInput.addEventListener('change', async (e) => {
  showError('');
  const files = [...e.target.files];
  for (const f of files) {
    try {
      const url = await fileToDataURL(f);
      const img = await loadImage(url);
      state.shots.push({ name: f.name, img, ...state.defaults });
    } catch (err) {
      showError('تعذّر تحميل إحدى الصور: ' + f.name);
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
    const url = await fileToDataURL(f);
    state.logo = await loadImage(url);
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
  exportSingle(els.previewCanvas, `${preset.id}.png`);
});

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
    }));
    const globalConfig = {
      platform: state.platform,
      statusBarRatio: state.statusBarRatio,
      showFrame: state.showFrame,
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

// ---------- التهيئة ----------
buildPresets();
buildPreviewPresetOptions();
buildThumbs();
buildSwatches(els.iconThemeSwatches, {
  currentId: () => state.iconThemeId,
  onPick: (id) => { state.iconThemeId = id; },
  customColor: () => state.iconCustomColor,
  onCustom: (hex) => { state.iconThemeId = 'custom'; state.iconCustomColor = hex; },
});
syncControls();
els.statusBarRange.value = Math.round(state.statusBarRatio * 100);
els.statusBarVal.textContent = Math.round(state.statusBarRatio * 100) + '%';
renderPreview();
