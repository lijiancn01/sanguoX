/**
 * 验证从旧版移植的两个功能：地图缩放与出征高亮。
 *
 * 用法: node scripts/check-zoom-highlight.mjs [端口]
 */
const port = process.argv[2] || '9500';

const res = await fetch(`http://127.0.0.1:${port}/json`);
const page = (await res.json()).find((t) => t.type === 'page');
if (!page) { console.error('未找到 page'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const msgId = ++id;
  pending.set(msgId, { resolve, reject });
  ws.send(JSON.stringify({ id: msgId, method, params }));
});
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
});

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
};

const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
  return r.result.value;
};

const SETUP = `(async () => {
  const SG = window.__SG3__;
  const gd = SG.GameData;
  if (!gd.cities || Object.keys(gd.cities).length === 0) gd.init();
  SG.game.scene.start('MapScene');
  const s = SG.game.scene.getScene('MapScene');
  return { ready: !!s._mapContainer, cities: Object.keys(gd.cities).length };
})()`;

// 所有求值与断言都要等 WebSocket 真正连上后才能发，
// 否则 Node 的 WebSocket 会抛 "Sent before connected"。
ws.addEventListener('open', async () => {
try {
console.log('=== 1. 初始化状态 ===');
const setup = await ev(SETUP);
check('MapScene 已就绪', setup.ready, setup);

const initState = await ev(`(() => {
  const s = window.__SG3__.game.scene.getScene('MapScene');
  const GD = window.__SG3__.GameData;
  // 计算城池包围盒，用于验证自适应缩放是否真的把城池铺满视口
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const id in GD.cities) {
    const c = GD.cities[id];
    minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
  }
  const sc = s._mapScale;
  const left = minX * sc + s._mapContainer.x;
  const right = maxX * sc + s._mapContainer.x;
  const top = minY * sc + s._mapContainer.y;
  const bottom = maxY * sc + s._mapContainer.y;
  return {
    mapScale: s._mapScale,
    min: s._mapMinScale, max: s._mapMaxScale,
    defaultScale: s._mapDefaultScale,
    containerScaleX: s._mapContainer.scaleX,
    zoomText: s._zoomText ? s._zoomText.text : null,
    // 城池包围盒在屏幕上的位置
    screen: { left: Math.round(left), right: Math.round(right), top: Math.round(top), bottom: Math.round(bottom) },
    canvas: { w: s._cw, h: s._ch }
  };
})()`);
check('默认缩放已放大（明显大于 1）', initState.mapScale > 1.15, initState.mapScale);
check('缩放值在允许范围内', initState.mapScale >= initState.min && initState.mapScale <= initState.max, initState);
check('容器 scale 与 _mapScale 一致', initState.containerScaleX === initState.mapScale, initState);
check('缩放比例文字存在', initState.zoomText !== null, initState.zoomText);
check('_mapDefaultScale 等于自适应缩放', initState.defaultScale === initState.mapScale, initState);

// 自适应缩放的核心断言：城池应明显放大，左右不再有大片空白
const sv = initState.screen;
const cv = initState.canvas;
const usableH = cv.h - 56 - 46;   // 扣掉 HUD 与底栏
const leftPad = sv.left;
const rightPad = cv.w - sv.right;
const usedW = sv.right - sv.left;
check('城池横向占画布 55% 以上（左右不再大片留白）',
  usedW / cv.w >= 0.55, { usedW, w: cv.w, pct: Math.round(usedW / cv.w * 100) });
check('左右留白对称（居中正确）',
  Math.abs(leftPad - rightPad) <= 2, { leftPad, rightPad });
// 纵向允许有界溢出：地图本就支持拖拽，溢出部分靠拖动查看。
// 这里守住的是"不能溢出太多"，否则放大就失去意义。
const overflow = Math.max(0, -sv.top) + Math.max(0, sv.bottom - cv.h);
check('纵向溢出不超过可用高度的 25%',
  overflow <= usableH * 0.25, { overflow, usableH, pct: Math.round(overflow / usableH * 100) });
check('纵向实际被放大（高度占比 ≥ 95%）',
  (sv.bottom - sv.top) >= usableH * 0.95, { used: sv.bottom - sv.top, usableH });

console.log('\n=== 2. 以指针为中心缩放 ===');
const zoomed = await ev(`(() => {
  const s = window.__SG3__.game.scene.getScene('MapScene');
  // 以画布左上角 (300,200) 为中心放大两次
  s._zoomAroundScreen(300, 200, 1.2);
  s._zoomAroundScreen(300, 200, 1.2);
  return { scale: s._mapScale, x: s._mapContainer.x, y: s._mapContainer.y };
})()`);
check('放大后 _mapScale 上升', zoomed.scale > 1.4, zoomed);
const containerScale = await ev(`(() => {
  const s = window.__SG3__.game.scene.getScene('MapScene');
  return s._mapContainer.scaleX;
})()`);
check('容器实际 scale 已同步', Math.abs(containerScale - zoomed.scale) < 0.001, { containerScale, expect: zoomed.scale });
check('缩放比例文字已更新', (await ev(`window.__SG3__.game.scene.getScene('MapScene')._zoomText.text`)) !== '100%');

// 校验 pivot 不变量：缩放前后，pivot 对应的世界坐标应仍在同一屏幕点
const pivotCheck = await ev(`(() => {
  const s = window.__SG3__.game.scene.getScene('MapScene');
  const before = { x: s._mapContainer.x, y: s._mapContainer.y, s: s._mapScale };
  // 取当前 (300,200) 对应的局部坐标，再放大后应仍落在 (300,200)
  const lx = (300 - before.x) / before.s;
  const ly = (200 - before.y) / before.s;
  s._zoomAroundScreen(300, 200, 1.3);
  const worldScreenX = s._mapContainer.x + lx * s._mapScale;
  const worldScreenY = s._mapContainer.y + ly * s._mapScale;
  return { worldScreenX, worldScreenY };
})()`);
check('pivot 仍锁定在原屏幕点', Math.abs(pivotCheck.worldScreenX - 300) < 0.01 && Math.abs(pivotCheck.worldScreenY - 200) < 0.01, pivotCheck);

console.log('\n=== 3. 缩放上下限 ===');
const clamped = await ev(`(() => {
  const s = window.__SG3__.game.scene.getScene('MapScene');
  for (let i = 0; i < 40; i++) s._zoomAroundScreen(640, 360, 1.3);
  const maxReached = s._mapScale;
  for (let i = 0; i < 60; i++) s._zoomAroundScreen(640, 360, 1 / 1.3);
  const minReached = s._mapScale;
  return { maxReached, minReached, max: s._mapMaxScale, min: s._mapMinScale };
})()`);
check('放大不超过上限', clamped.maxReached <= clamped.max + 1e-9, clamped);
check('缩小不低于下限', clamped.minReached >= clamped.min - 1e-9, clamped);
check('缩放值非 NaN', Number.isFinite(clamped.maxReached) && Number.isFinite(clamped.minReached), clamped);

console.log('\n=== 4. 还原视角 ===');
const reset = await ev(`(() => {
  const s = window.__SG3__.game.scene.getScene('MapScene');
  const def = s._computeFitView();
  // 先回到自适应状态，再明确放大 1.5 倍，否则会受前序用例残留的
  // 缩放值影响（本例实测 zoomedIn 反而比还原后更小，断言误报）。
  s._resetMapView();
  const base = s._mapScale;
  s._zoomAroundScreen(300, 200, 1.5);
  const zoomedIn = s._mapScale;
  s._resetMapView();
  return {
    scale: s._mapScale, fitScale: def.scale, base,
    x: s._mapContainer.x, y: s._mapContainer.y,
    fx: def.x, fy: def.y,
    text: s._zoomText.text,
    zoomedIn
  };
})()`);
// 还原应回到「自适应缩放」，而不是硬编码的 100%：
// 默认倍率由城池包围盒算出，实测约 1.25。
check('还原后回到自适应缩放值', Math.abs(reset.scale - reset.fitScale) < 0.001, reset);
check('还原确实从放大状态回退', reset.zoomedIn > reset.scale, { zoomedIn: reset.zoomedIn, back: reset.scale });
check('还原后位置回到自适应值',
  Math.abs(reset.x - reset.fx) < 0.01 && Math.abs(reset.y - reset.fy) < 0.01, reset);
check('还原后文字与缩放一致',
  reset.text === Math.round(reset.scale * 100) + '%', { text: reset.text, scale: reset.scale });

console.log('\n=== 5. 出征高亮 ===');
const hl = await ev(`(() => {
  const SG = window.__SG3__;
  const gd = SG.GameData;
  const s = SG.game.scene.getScene('MapScene');
  // 找一座有相邻城市的己方城池
  let from = null;
  for (const c of Object.values(gd.cities)) {
    if (c.faction !== gd.playerFaction) continue;
    const t = c.adjacent.map(a => gd.cities[a]).filter(x => x && x.faction !== c.faction);
    if (t.length) { from = { c, t: t[0] }; break; }
  }
  if (!from) return { err: 'no-attackable' };
  s._showDispatchPanel(from.c.id);
  return {
    fromCity: from.c.name, toCity: from.t.name,
    objects: s._dispatchHighlightLayer ? s._dispatchHighlightLayer.length : 0,
    tracked: s._dispatchHighlightObjects.length,
    hasLayer: !!s._dispatchHighlightLayer
  };
})()`);
check('出征面板打开后建立高亮图层', hl.hasLayer, hl);
check('高亮对象数量 > 0', hl.objects > 0, hl);
check('追踪数组与图层一致', hl.tracked === hl.objects, hl);

const tweens = await ev(`(() => {
  const s = window.__SG3__.game.scene.getScene('MapScene');
  return s._dispatchHighlightObjects.filter(o => s.tweens.getTweensOf(o).length > 0).length;
})()`);
check('高亮对象带脉动动画', tweens > 0, { tweens });

const labels = await ev(`(() => {
  const s = window.__SG3__.game.scene.getScene('MapScene');
  return s._dispatchHighlightLayer.list
    .filter(o => o.type === 'Text')
    .map(o => o.text);
})()`);
check('含「我方」标签', labels.includes('我方'), labels);
check('含「目标」标签', labels.includes('目标'), labels);

console.log('\n=== 6. 切换目标更新高亮 ===');
const switched = await ev(`(() => {
  const SG = window.__SG3__;
  const s = SG.game.scene.getScene('MapScene');
  const gd = SG.GameData;
  // 用与首次相同的 (from, to) 组合再调用一次：对象数应保持不变，
  // 即「重复调用不累积」。只给 target 不给 from 是另一种组合，
  // 对象数自然不同，不能用来断言累积与否。
  let pair = null;
  for (const c of Object.values(gd.cities)) {
    if (c.faction !== gd.playerFaction) continue;
    const t = c.adjacent.map(a => gd.cities[a]).filter(x => x && x.faction !== c.faction);
    if (t.length) { pair = { from: c.id, to: t[0].id }; break; }
  }
  s._showDispatchHighlight(pair.from, pair.to);
  const n1 = s._dispatchHighlightObjects.length;
  s._showDispatchHighlight(pair.from, pair.to);
  const n2 = s._dispatchHighlightObjects.length;
  s._showDispatchHighlight(pair.from, pair.to);
  const n3 = s._dispatchHighlightObjects.length;
  return { n1, n2, n3, layerLen: s._dispatchHighlightLayer.length };
})()`);
check('重复调用不累积对象', switched.n1 === switched.n2 && switched.n2 === switched.n3, switched);
check('图层长度与追踪数组一致', switched.n3 === switched.layerLen, switched);

console.log('\n=== 7. 清除高亮（必须停 tween）===');
const cleared = await ev(`(() => {
  const SG = window.__SG3__;
  const s = SG.game.scene.getScene('MapScene');
  const objs = s._dispatchHighlightObjects.slice();
  s._clearDispatchHighlight();
  const aliveTweens = objs.reduce((n, o) => {
    if (!o.active) return n;          // 已销毁的不算
    return n + s.tweens.getTweensOf(o).length;
  }, 0);
  return {
    layerList: s._dispatchHighlightLayer ? s._dispatchHighlightLayer.length : 0,
    tracked: s._dispatchHighlightObjects.length,
    aliveTweens
  };
})()`);
check('图层已清空', cleared.layerList === 0, cleared);
check('追踪数组已清空', cleared.tracked === 0, cleared);
check('没有残留 tween', cleared.aliveTweens === 0, cleared);

console.log('\n=== 8. 打开城市面板会清除出征高亮 ===');
const clearedByCity = await ev(`(() => {
  const SG = window.__SG3__;
  const gd = SG.GameData;
  const s = SG.game.scene.getScene('MapScene');
  const mine = Object.values(gd.cities).find(c => c.faction === gd.playerFaction);
  s._showDispatchPanel(mine.id);
  const afterDispatch = s._dispatchHighlightLayer ? s._dispatchHighlightLayer.length : 0;
  s._showCityPanel(mine.id);
  return { afterDispatch, afterCity: s._dispatchHighlightLayer ? s._dispatchHighlightLayer.length : 0 };
})()`);
check('出征面板有高亮', clearedByCity.afterDispatch > 0, clearedByCity);
check('切到城市面板后高亮清零', clearedByCity.afterCity === 0, clearedByCity);

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
ws.close();
process.exit(fail === 0 ? 0 : 1);
} catch (e) {
  console.error('失败:', e.message);
  try { ws.close(); } catch { /* 已关闭 */ }
  process.exit(1);
}
});