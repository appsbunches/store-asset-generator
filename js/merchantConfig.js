// merchantConfig.js — استيراد/تصدير إعداد التاجر بصيغة merchants/<id>.json المشتركة
// مع pipeline الالتقاط (appshot-capture)، وحفظ presets مسماة في localStorage.
//
// الأداة تقرأ فقط: id, appName, brand.*, assetGenerator.*, logoBase64 (اختياري).
// مفاتيح capture.* و builds.* تخص الـ CLI وتُتجاهل هنا — لكنها تُحفظ كما هي
// ويعاد إخراجها عند التصدير (round-trip كامل).
//
// ملاحظة: التحقق هنا تحقق محلي مطابق لصيغة §A3. عند توفر JSON Schema المصدَّر
// من appshot-capture يُستبدل به (نفس الحقول).

import { BG_STYLES } from './backgrounds.js';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const STORAGE_KEY = 'sag:merchantPresets';

// ---------- التحقق ----------
// يعيد قائمة أخطاء، كل خطأ يسمّي الحقل المخالف. قائمة فارغة = صالح.
export function validateMerchantConfig(cfg) {
  const errors = [];
  const err = (field, msg) => errors.push(`${field}: ${msg}`);

  if (typeof cfg !== 'object' || cfg === null || Array.isArray(cfg)) {
    return ['الملف ليس كائن JSON صالحًا'];
  }
  if (cfg.id !== undefined && typeof cfg.id !== 'string') err('id', 'يجب أن يكون نصًا');
  if (cfg.appName !== undefined && typeof cfg.appName !== 'string') err('appName', 'يجب أن يكون نصًا');

  const brand = cfg.brand;
  if (brand !== undefined) {
    if (typeof brand !== 'object' || brand === null) {
      err('brand', 'يجب أن يكون كائنًا');
    } else {
      for (const key of ['primaryColor', 'secondaryColor']) {
        if (brand[key] !== undefined && !HEX_RE.test(brand[key])) {
          err(`brand.${key}`, 'لون hex بصيغة ‎#RRGGBB');
        }
      }
    }
  }

  const ag = cfg.assetGenerator;
  if (ag !== undefined) {
    if (typeof ag !== 'object' || ag === null) {
      err('assetGenerator', 'يجب أن يكون كائنًا');
    } else {
      if (ag.template !== undefined && typeof ag.template !== 'string') {
        err('assetGenerator.template', 'يجب أن يكون نصًا');
      }
      if (ag.statusBarCoverage !== undefined) {
        const v = ag.statusBarCoverage;
        if (typeof v !== 'number' || v < 5 || v > 20) {
          err('assetGenerator.statusBarCoverage', 'رقم بين 5 و 20 (نسبة مئوية)');
        }
      }
      if (ag.showDeviceFrame !== undefined && typeof ag.showDeviceFrame !== 'boolean') {
        err('assetGenerator.showDeviceFrame', 'قيمة منطقية true/false');
      }
      if (ag.background !== undefined) {
        const bg = ag.background;
        if (typeof bg !== 'object' || bg === null) {
          err('assetGenerator.background', 'يجب أن يكون كائنًا');
        } else if (bg.type !== undefined && !BG_STYLES.some((s) => s.id === bg.type)) {
          err('assetGenerator.background.type', 'أحد الأنماط: ' + BG_STYLES.map((s) => s.id).join(', '));
        }
      }
    }
  }

  if (cfg.logoBase64 !== undefined && typeof cfg.logoBase64 !== 'string') {
    err('logoBase64', 'يجب أن يكون نصًا (data URL أو base64)');
  }

  return errors;
}

// ---------- التصدير (round-trip) ----------
// يدمج القيم الحالية للأداة فوق آخر config مستورد (إن وُجد) كي لا تضيع
// مفاتيح capture/builds التي لا تخص الأداة.
export function buildExportConfig(current, lastImported) {
  const base = lastImported || {};
  return {
    ...base,
    id: base.id || 'store',
    appName: current.appName || base.appName || '',
    brand: {
      ...(base.brand || {}),
      primaryColor: current.primaryColor,
    },
    assetGenerator: {
      ...(base.assetGenerator || {}),
      template: current.template,
      statusBarCoverage: current.statusBarCoverage,
      showDeviceFrame: current.showDeviceFrame,
      background: { type: current.backgroundType },
    },
  };
}

export function downloadConfig(cfg) {
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cfg.id || 'merchant'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- presets مسماة في localStorage ----------
// أداة client-side بلا خادم: localStorage هو خيار التخزين الوحيد،
// والـ JSON المصدَّر يبقى النسخة الموثوقة.
export function listPresets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

export function savePreset(name, config) {
  const presets = listPresets().filter((p) => p.name !== name);
  presets.push({ name, config });
  presets.sort((a, b) => a.name.localeCompare(b.name));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  return presets;
}

export function deletePreset(name) {
  const presets = listPresets().filter((p) => p.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  return presets;
}

export function presetByName(name) {
  return listPresets().find((p) => p.name === name) || null;
}
