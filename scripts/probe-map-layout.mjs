/**
 * 统计城池坐标分布与连线重叠情况，用于评估地图缩放与连线改线的必要性。
 *
 * 用法: node scripts/probe-map-layout.mjs
 */
import { CITIES_DATA } from '../src/data/cities.js';

// CITIES_DATA 是数组；Object.entries 会给出「下标」而非城池 id，
// 这里显式构造 [id, city] 列表，否则 byId 查不到、统计恒为 0。
const list = CITIES_DATA.map((c) => [c.id, c]);
const byId = {};
for (const [id, c] of list) byId[id] = c;
const xs = list.map(([, c]) => c.x);
const ys = list.map(([, c]) => c.y);
const minX = Math.min(...xs), maxX = Math.max(...xs);
const minY = Math.min(...ys), maxY = Math.max(...ys);

console.log(`城池数: ${list.length}`);
console.log(`x 范围: ${minX} ~ ${maxX}  (跨度 ${maxX - minX})`);
console.log(`y 范围: ${minY} ~ ${maxY}  (跨度 ${maxY - minY})`);
console.log(`地图区域 1200x900，画布 1280x720`);
console.log(`地图占画布比例: x ${((maxX - minX) / 1280 * 100).toFixed(0)}%, y ${((maxY - minY) / 720 * 100).toFixed(0)}%`);
console.log(`若要填满画布高度(720)，需缩放: ${(720 / (maxY - minY)).toFixed(2)}`);
console.log(`若要填满画布宽度(1280)，需缩放: ${(1280 / (maxX - minX)).toFixed(2)}`);

// 统计最近邻间距，判断城池是否拥挤
const dists = [];
for (let i = 0; i < list.length; i++) {
  let best = Infinity;
  for (let j = 0; j < list.length; j++) {
    if (i === j) continue;
    const dx = list[i][1].x - list[j][1].x;
    const dy = list[i][1].y - list[j][1].y;
    best = Math.min(best, Math.hypot(dx, dy));
  }
  dists.push({ id: list[i][0], name: list[i][1].name, d: best });
}
dists.sort((a, b) => a.d - b.d);
console.log(`\n最近邻间距最小 10 个:`);
for (const d of dists.slice(0, 10)) console.log(`  ${d.name}(${d.id}): ${d.d.toFixed(0)}px`);
const avg = dists.reduce((s, d) => s + d.d, 0) / dists.length;
console.log(`平均最近邻间距: ${avg.toFixed(0)}px`);

// 连线总长与「被城池压住」的比例估算
let totalLen = 0, shortEdges = 0;
const drawn = new Set();
for (const [id, c] of list) {
  for (const a of c.adjacent) {
    const key = id < a ? id + '-' + a : a + '-' + id;
    if (drawn.has(key)) continue;
    drawn.add(key);
    const t = byId[a];
    if (!t) continue;
    const len = Math.hypot(c.x - t.x, c.y - t.y);
    totalLen += len;
    if (len < 90) shortEdges++;
  }
}
console.log(`\n连线总数: ${drawn.size}`);
console.log(`连线总长: ${totalLen.toFixed(0)}px，平均 ${(totalLen / drawn.size).toFixed(0)}px`);
console.log(`长度 < 90px 的连线: ${shortEdges} 条（这些最容易完全被城池图标盖住）`);

// 统计「近共线」的三城关系：这条边无法靠弧线绕开，只能靠数据层解决
console.log('\n=== 近共线阻塞（弧线无法绕开的硬阻塞）===');
let collinear = 0;
const collinearList = [];
for (const [id, c] of list) {
  for (const a of c.adjacent) {
    const t = byId[a];
    if (!t) continue;
    const key = id < a ? id + '|' + a : a + '|' + id;
    if (drawn.has(key + '@c')) continue;
    drawn.add(key + '@c');
    const len = Math.hypot(t.x - c.x, t.y - c.y);
    if (len < 1) continue;
    const ux = (t.x - c.x) / len, uy = (t.y - c.y) / len;
    // 各阻塞城市到直线的垂距
    let minPerp = Infinity, blocker = null;
    for (const [oid, o] of list) {
      if (oid === id || oid === a) continue;
      const mx = (c.x + t.x) / 2, my = (c.y + t.y) / 2;
      // 点到线段的垂距
      let vx = o.x - c.x, vy = o.y - c.y;
      let proj = vx * ux + vy * uy;
      proj = Math.max(0, Math.min(len, proj));
      const px = c.x + ux * proj, py = c.y + uy * proj;
      const perp = Math.hypot(o.x - px, o.y - py);
      // 阻塞城市半径 26，垂距小于它就必然压住
      if (perp < 26 && perp < minPerp) { minPerp = perp; blocker = o.name; }
    }
    if (blocker) {
      collinear++;
      collinearList.push(`${c.name}-${t.name}(${blocker} 垂距${minPerp.toFixed(0)}px)`);
    }
  }
}
console.log(`硬阻塞道路: ${collinear} 条`);
if (collinearList.length) console.log('  ' + collinearList.join('\n  '));