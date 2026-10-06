/**
 * 验证假设：残留的 _dragging=true 会让「点击城池」失败。
 *
 * 探针显示，城池图标的 pointerdown 同时也会触发**场景级** pointerdown，
 * 把 _dragging 置为 true（代码审查 2.9「拖拽与城池点击冲突」）。
 * 只要在按下与抬起之间到达一个 pointermove，地图就会平移，
 * 图标从光标下移走，城市面板便不会打开 —— 这正是演练中
 * 「平原 城市面板未打开」反复出现、而孤立复现却成功的状态相关性来源。
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
const toViewport = (gx, gy) => ({ x: rect.left + gx * rect.width / rect.gw, y: rect.top + gy * rect.height / rect.gh });

const cityPos = async () => ev(`(() => {
  const GD = window.__SG3__.GameData; const ms = window.__SG3__.game.scene.getScene('MapScene');
  const c = Object.values(GD.cities).find(x => x.name === ${JSON.stringify(NAME)});
  return { gx: c.x + ms._mapContainer.x, gy: c.y - 6 + ms._mapContainer.y,
    mapX: ms._mapContainer.x, mapY: ms._mapContainer.y, dragging: ms._dragging }; })()`);

const reset = async () => ev(`(() => { const ms = window.__SG3__.game.scene.getScene('MapScene');
  ms._panelContainer.removeAll(true); ms._panelVisible = false; ms._dragging = false; return true; })()`);

async function scenario(label, { jitter }) {
  await reset();
  const p = await cityPos();
  const v = toViewport(p.gx, p.gy);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: v.x, y: v.y, button: 'none', buttons: 0 });
  await sleep(80);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: v.x, y: v.y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(20);
  if (jitter) {
    // 按下后指针轻微抖动（真实鼠标/驱动时序都可能产生）
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: v.x + jitter, y: v.y + jitter, button: 'left', buttons: 1 });
    await sleep(20);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: v.x + (jitter || 0), y: v.y + (jitter || 0), button: 'left', buttons: 0, clickCount: 1 });
  await sleep(350);
  const after = await ev(`(() => { const ms = window.__SG3__.game.scene.getScene('MapScene');
    return { panel: ms._panelVisible, dragging: ms._dragging, mapX: ms._mapContainer.x, mapY: ms._mapContainer.y }; })()`);
  const moved = (after.mapX - p.mapX) !== 0 || (after.mapY - p.mapY) !== 0;
  console.log(`${label}: 面板=${after.panel ? '✓打开' : '✗未打开'} 地图平移=${moved ? `是(${after.mapX - p.mapX},${after.mapY - p.mapY})` : '否'} 残留dragging=${after.dragging}`);
  return after.panel;
}

console.log(`目标城市: ${NAME}\n`);
const a = await scenario('无抖动点击      ', { jitter: 0 });
const b = await scenario('按下后抖动 3px  ', { jitter: 3 });
const c = await scenario('按下后抖动 8px  ', { jitter: 8 });
console.log(`\n结论: 无抖动=${a ? '成功' : '失败'} 抖动3px=${b ? '成功' : '失败'} 抖动8px=${c ? '成功' : '失败'}`);
console.log(!b || !c ? '→ 证实「拖拽与点击冲突」：按下后只要有位移，点击就会落空。' : '→ 未复现该冲突。');
ws.close(); await sleep(50);