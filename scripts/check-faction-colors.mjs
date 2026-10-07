/**
 * 校验势力配色的相互区分度。
 *
 * 用户要求「一眼能看出颜色不一致」，所以不能凭感觉选色：
 * 这里把候选色转成 CIE Lab 并计算两两 ΔE76，报告最小色差与最接近的色对。
 * ΔE 越大越容易分辨；经验上 ΔE < 25 就偏难区分，< 15 基本会认错。
 *
 * 用法: node scripts/check-faction-colors.mjs
 */
import { FACTION_COLORS, FACTION_NAMES, CUSTOM_COLOR_PALETTE, CUSTOM_DEFAULT_COLOR } from '../src/core/config.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

/** sRGB -> 线性 -> XYZ(D65) -> Lab */
function toLab(rgb) {
  const f = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = f(rgb[0]), g = f(rgb[1]), b = f(rgb[2]);
  const X = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const Y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / 1.00000;
  const Z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
  const k = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = k(X), fy = k(Y), fz = k(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const deltaE = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));

const ids = Object.keys(FACTION_COLORS);
const labs = {};
for (const id of ids) {
  const n = FACTION_COLORS[id];
  labs[id] = toLab([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}

const pairs = [];
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    pairs.push({ a: ids[i], b: ids[j], de: deltaE(labs[ids[i]], labs[ids[j]]) });
  }
}
pairs.sort((x, y) => x.de - y.de);

console.log('势力配色区分度（ΔE76，越大越易分辨）\n');
console.log('色板:');
for (const id of ids) {
  console.log(`  ${id.padEnd(12)} ${hex(FACTION_COLORS[id])}  ${(FACTION_NAMES[id] || id).padEnd(8)}`);
}

console.log('\n最接近的 10 对:');
for (const p of pairs.slice(0, 10)) {
  const flag = p.de < 15 ? '  ← 极易混淆' : (p.de < 25 ? '  ← 偏难分辨' : '');
  console.log(`  ΔE=${p.de.toFixed(1).padStart(5)}  ${p.a} vs ${p.b}${flag}`);
}

const min = pairs[0];
console.log(`\n最小色差: ΔE=${min.de.toFixed(1)} (${min.a} vs ${min.b})`);
const bad = pairs.filter((p) => p.de < 25);
console.log(`ΔE<25 的色对: ${bad.length} 对`);
if (bad.length === 0) console.log('结论: 所有势力两两可辨。');
else console.log('结论: 存在偏难分辨的色对，需要调整。');

// ===== 自定义君主配色：不得与任何固定势力色相近 =====
const cssToRgb = (css) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(css.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

console.log('\n自定义君主配色 vs 固定势力:');
let worstCustom = Infinity;
for (const opt of CUSTOM_COLOR_PALETTE) {
  const rgb = cssToRgb(opt.color);
  if (!rgb) { console.log(`  ${opt.color} 无法解析`); continue; }
  const lab = toLab(rgb);
  const nearest = ids
    .filter((id) => id !== 'none')
    .map((id) => ({ id, de: deltaE(lab, labs[id]) }))
    .sort((x, y) => x.de - y.de)[0];
  worstCustom = Math.min(worstCustom, nearest.de);
  const flag = nearest.de < 25 ? '  ← 与固定势力撞色' : '';
  console.log(`  ${opt.label.padEnd(4)} ${opt.color}  最近势力 ${nearest.id} ΔE=${nearest.de.toFixed(1)}${flag}`);
}
console.log(`自定义配色最小 ΔE=${worstCustom.toFixed(1)}`);
console.log(`默认自定义色 ${CUSTOM_DEFAULT_COLOR} 是否为黄色系: ${/^#e8c020$/i.test(CUSTOM_DEFAULT_COLOR) ? '是' : '否'}`);