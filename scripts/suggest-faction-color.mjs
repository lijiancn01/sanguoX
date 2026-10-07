/**
 * 为新增势力/自定义君主搜索「不撞色」的候选配色。
 *
 * 背景：势力颜色是身份标识，玩家要在地图上一眼分辨。人工挑色容易撞色
 * （上一版自定义配色里「靛蓝 #4b3fd0」与吕布军紫 #8a3fd1 的 ΔE 只有 16.1，肉眼几乎一样）。
 *
 * 做法：在 RGB 空间按固定步长扫描候选色，计算它与所有「已占用颜色」的最小 ΔE，
 * 取该值最大的若干候选作为建议。已占用颜色包含固定势力色与 CUSTOM_COLOR_PALETTE。
 *
 * 用法:
 *   node scripts/suggest-faction-color.mjs               # 默认排除灰阶，找高辨识度色
 *   node scripts/suggest-faction-color.mjs --top 20
 */
import { FACTION_COLORS, FACTION_NAMES, CUSTOM_COLOR_PALETTE } from '../src/core/config.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

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

// ===== 已占用颜色 =====
// 玩家只会选一个自定义色，所以自定义选项之间不需要互相拉开差距；
// 真正要避开的是「固定势力色」。--factions-only 用于只按固定势力评估。
const FACTIONS_ONLY = process.argv.includes('--factions-only');

const occupied = [];
for (const id of Object.keys(FACTION_COLORS)) {
  if (id === 'none') continue; // 灰色是「在野」保留色，不作为常规建议参照
  const n = FACTION_COLORS[id];
  occupied.push({ label: `${id}(${FACTION_NAMES[id] || id})`, lab: toLab([(n >> 16) & 255, (n >> 8) & 255, n & 255]) });
}
if (!FACTIONS_ONLY) {
  for (const opt of CUSTOM_COLOR_PALETTE) {
    const m = /^#?([0-9a-f]{6})$/i.exec(opt.color);
    if (!m) continue;
    const n = parseInt(m[1], 16);
    occupied.push({ label: `自定义-${opt.label}`, lab: toLab([(n >> 16) & 255, (n >> 8) & 255, n & 255]) });
  }
}

const topN = (() => {
  const i = process.argv.indexOf('--top');
  return i >= 0 ? Math.max(1, parseInt(process.argv[i + 1], 10) || 12) : 12;
})();

// --test "#aabbcc,#ddeeff": 直接评估指定候选色，便于人工挑色后核对
const testArg = (() => {
  const i = process.argv.indexOf('--test');
  return i >= 0 ? process.argv[i + 1] : null;
})();

if (testArg) {
  const cands = testArg.split(',').map((s) => s.trim()).filter(Boolean);
  console.log(`评估候选色（已占用 ${occupied.length} 个）:\n`);
  for (const css of cands) {
    const m = /^#?([0-9a-f]{6})$/i.exec(css);
    if (!m) { console.log(`  ${css}  无法解析`); continue; }
    const n = parseInt(m[1], 16);
    const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const lab = toLab(rgb);
    let minDe = Infinity, nearest = null;
    for (const o of occupied) {
      const de = deltaE(lab, o.lab);
      if (de < minDe) { minDe = de; nearest = o; }
    }
    const mx = Math.max(...rgb), mn = Math.min(...rgb);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    const lum = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
    const warn = [];
    if (minDe < 25) warn.push('与已占用色撞色');
    if (sat < 0.35) warn.push('饱和度低(近似在野灰)');
    if (lum < 70) warn.push('过暗(小图标不可辨)');
    console.log(`  ${hex(n)}  ΔE=${minDe.toFixed(1).padStart(5)}  最近: ${nearest.label.padEnd(14)}` +
      `  饱和=${sat.toFixed(2)} 亮度=${lum.toFixed(0)}${warn.length ? '  ← ' + warn.join('、') : ''}`);
  }
  process.exit(0);
}

const STEP = 17; // 255/17 = 15 档，共 3375 个候选
const results = [];
for (let r = 0; r <= 255; r += STEP) {
  for (let g = 0; g <= 255; g += STEP) {
    for (let b = 0; b <= 255; b += STEP) {
      const rgb = [r, g, b];
      // 排除近灰阶（饱和度太低，在地图上会与「在野」灰混淆）
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx === 0 || (mx - mn) / mx < 0.35) continue;
      // 排除过暗色（小图标在深色地图上不可辨）
      if ((r * 0.299 + g * 0.587 + b * 0.114) < 70) continue;

      const lab = toLab(rgb);
      let minDe = Infinity, nearest = null;
      for (const o of occupied) {
        const de = deltaE(lab, o.lab);
        if (de < minDe) { minDe = de; nearest = o; }
      }
      results.push({ hex: hex((r << 16) | (g << 8) | b), rgb, minDe, nearest: nearest.label });
    }
  }
}

// 去掉与已入选建议过于接近的重复色
results.sort((a, b) => b.minDe - a.minDe);
const picked = [];
for (const c of results) {
  if (picked.some((p) => deltaE(toLab(p.rgb), toLab(c.rgb)) < 30)) continue;
  picked.push(c);
  if (picked.length >= topN) break;
}

console.log(`已占用颜色 ${occupied.length} 个，扫描候选 ${results.length} 个（已排除灰阶与暗色）\n`);
console.log(`建议配色（按「与最近已占用色的 ΔE」降序，ΔE 越大越安全）:`);
for (const c of picked) {
  console.log(`  ${c.hex}  ΔE=${c.minDe.toFixed(1).padStart(5)}  最近: ${c.nearest}`);
}
console.log('\n选取时优先挑色相差异明显的（不要都选同一色系），以便玩家区分。');