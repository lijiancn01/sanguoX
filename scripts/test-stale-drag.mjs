/**
 * 验证假设：残留的 _dragging=true 会破坏后续「点击城池」。
 *
 * 机制：clickGame 先派发 mouseMoved，再 mousePressed。
 * 若 _dragging 仍为 true（上一次交互未正常收尾），这个 mouseMoved
 * 会触发场景级 pointermove → 平移地图，等 mousePressed 到达时
 * 城池图标已经从光标下移走，于是城市面板不会打开。
 *
 * 这解释了「平原 城市面板未打开」为何反复出现、而孤立复现却成功。
 */
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = Number(process.argv[2] || 9500);
const NAME = process.argv[3] || '平原';
const t = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((x) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, (m) => r(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };

const rect = await ev(`(() => { const g = window.__SG3__.game; const r = g.canvas.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, gw: g.scale.gameSize.width, gh: g.scale.gameSize.height }; })()`);
const vp = (gx, gy) => ({ x: rect.left + gx * rect.width / rect.gw, y: rect.top + gy * rect.height / rect.gh });

const state = async () => ev(`(() => { const GD = window.__SG3__.GameData;
  const ms = window.__SG3__.game.scene.getScene('MapScene');
  const c = Object.values(GD.cities).find(x => x.name === ${JSON.stringify(NAME)});
  return { gx: c.x + ms._mapContainer.x, gy: c.y - 6 + ms._mapContainer.y,
    mapX: ms._mapContainer.x, mapY: ms._mapContainer.y,
    dragging: ms._dragging, panel: ms._panelVisible,
    dragStartX: ms._dragStartX, dragStartY: ms._dragStartY }; })()`);

const reset = (staleDrag) => ev(`(() => { const ms = window.__SG3__.game.scene.getScene('MapScene');
  ms._panelContainer.removeAll(true); ms._panelVisible = false;
  ${staleDrag ? 'ms._dragging = true; ms._dragStartX = 100; ms._dragStartY = 100; ms._mapStartX = ms._mapContainer.x; ms._mapStartY = ms._mapContainer.y;'
    : 'ms._dragging = false;'}
  return true; })()`);

async function trial(label, staleDrag) {
  await reset(staleDrag);
  const before = await state();
  const v = vp(before.gx, before.gy);
  // 完全复刻驱动的 clickGame 时序
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: v.x, y: v.y, button: 'none', buttons: 0 });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: v.x, y: v.y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(15);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: v.x, y: v.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(350);
  const after = await state();
  const dx = after.mapX - before.mapX, dy = after.mapY - before.mapY;
  console.log(`${label}: 面板=${after.panel ? '✓打开' : '✗未打开'}  地图平移=(${dx},${dy})  残留dragging=${after.dragging}`);
  return after.panel;
}

console.log(`目标城市: ${NAME}\n`);
const ok1 = await trial('干净状态          ', false);
const ok2 = await trial('残留 _dragging=true', true);
const ok3 = await trial('再次干净状态      ', false);
console.log(`\n结论: 干净=${ok1 ? '成功' : '失败'}  残留dragging=${ok2 ? '成功' : '失败'}  恢复后=${ok3 ? '成功' : '失败'}`);
if (ok1 && !ok2) {
  console.log('→ 证实：残留 _dragging=true 会让下一次点击城池落空（真实缺陷，代码审查 2.9）。');
} else if (ok2) {
  console.log('→ 未复现：残留 _dragging 未破坏点击。');
}
ws.close(); await sleep(50);