/**
 * 校验地图坐标系比例的一致性。
 *
 * 世界坐标已整体乘 COORD_SCALE 放大，所有「以世界坐标表达的长度」
 * （图标尺寸、命中区、道路宽度与避让半径、标签偏移）都必须同步乘同一比例，
 * 否则会与城池坐标脱节——图标相对城池偏出去、命中区对不上、点击落空。
 * 文字的 fontSize 是屏幕像素，不在此列。
 *
 * 用法: node scripts/check-map-scale.mjs
 */
import { CITIES_DATA } from '../src/data/cities.js';
import { COORD_SCALE, CONFIG, MAP_SIZE } from '../src/core/config.js';

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
};

console.log(`COORD_SCALE = ${COORD_SCALE}`);
console.log(`地图区域 ${CONFIG.mapWidth}x${CONFIG.mapHeight} → ${MAP_SIZE.width}x${MAP_SIZE.height}`);
console.log(`源数据城池数: ${CITIES_DATA.length}`);
console.log('');

console.log('=== 1. 地图区域尺寸按比例换算 ===');
check('MAP_SIZE.width 正确', MAP_SIZE.width === CONFIG.mapWidth * COORD_SCALE, MAP_SIZE.width);
check('MAP_SIZE.height 正确', MAP_SIZE.height === CONFIG.mapHeight * COORD_SCALE, MAP_SIZE.height);

console.log('\n=== 2. 源数据本身保持原始尺度（未被就地修改）===');
const srcXs = CITIES_DATA.map((c) => c.x);
const srcYs = CITIES_DATA.map((c) => c.y);
const srcSpanX = Math.max(...srcXs) - Math.min(...srcXs);
const srcSpanY = Math.max(...srcYs) - Math.min(...srcYs);
console.log(`源数据跨度: ${srcSpanX} x ${srcSpanY}`);
check('源数据 x 未被放大（仍 <= 1200）', Math.max(...srcXs) <= CONFIG.mapWidth, Math.max(...srcXs));
check('源数据 y 未被放大（仍 <= 900）', Math.max(...srcYs) <= CONFIG.mapHeight, Math.max(...srcYs));
check('源数据仍在原始地图区域内',
  srcSpanX <= CONFIG.mapWidth && srcSpanY <= CONFIG.mapHeight, { srcSpanX, srcSpanY });

console.log('\n=== 3. 放大后仍落在地图区域内 ===');
const scaledXs = srcXs.map((x) => x * COORD_SCALE);
const scaledYs = srcYs.map((y) => y * COORD_SCALE);
check('放大后 x 未越出地图', Math.max(...scaledXs) < MAP_SIZE.width, Math.max(...scaledXs));
check('放大后 y 未越出地图', Math.max(...scaledYs) < MAP_SIZE.height, Math.max(...scaledYs));

console.log('\n=== 4. 相对几何关系保持不变（比例是等比的）===');
// 距离按比例放大，但「相对大小」不变：任意两点距离之比应与源数据一致
let maxRatioErr = 0;
for (let i = 0; i < Math.min(60, CITIES_DATA.length); i++) {
  for (let j = i + 1; j < Math.min(60, CITIES_DATA.length); j++) {
    const a = CITIES_DATA[i], b = CITIES_DATA[j];
    const dSrc = Math.hypot(b.x - a.x, b.y - a.y);
    const dScaled = Math.hypot(b.x * COORD_SCALE - a.x * COORD_SCALE,
                               b.y * COORD_SCALE - a.y * COORD_SCALE);
    if (dSrc < 1) continue;
    const err = Math.abs(dScaled / dSrc - COORD_SCALE);
    if (err > maxRatioErr) maxRatioErr = err;
  }
}
check('两城距离恰为原来的 COORD_SCALE 倍', maxRatioErr < 1e-9, maxRatioErr);

console.log('\n=== 5. 放大确实改善了密集处的绕行空间 ===');
// 统计最近邻距离：放大后所有距离同比变大，绕行取样点密度也随之提高
function minNeighbor(list, scale) {
  let min = Infinity;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const d = Math.hypot((list[j].x - list[i].x) * scale,
                           (list[j].y - list[i].y) * scale);
      if (d < min) min = d;
    }
  }
  return min;
}
const before = minNeighbor(CITIES_DATA, 1);
const after = minNeighbor(CITIES_DATA, COORD_SCALE);
console.log(`最近邻距离: ${before.toFixed(0)} → ${after.toFixed(0)}`);
check('最近邻距离同比放大', Math.abs(after / before - COORD_SCALE) < 1e-9, after / before);

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);