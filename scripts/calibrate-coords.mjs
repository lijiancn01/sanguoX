/**
 * 校准 CDP 坐标 → Phaser 画布坐标 的映射。
 *
 * 背景：在 (1095.5, 602) 处派发鼠标点击，Phaser 的 pointerdown 收到的却是 y=582，
 * 相差 20px，导致按钮命中测试为空。若存在系统性偏移，所有 CDP 点击都会
 * 「偏上 20px」——城市图标高约 32px，因此有时命中、有时落空，
 * 正好解释演练中反复出现的「城市面板未打开 / 出征面板未出现」。
 */
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = Number(process.argv[2] || 9500);
const t = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((x) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, (m) => r(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };

// 页面与画布的几何信息
console.log('页面几何:', JSON.stringify(await ev(`(() => {
  const c = document.querySelector('canvas');
  const r = c ? c.getBoundingClientRect() : null;
  const g = window.__SG3__.game;
  const sm = g.scale;
  return {
    dpr: window.devicePixelRatio,
    scrollX: window.scrollX, scrollY: window.scrollY,
    innerW: window.innerWidth, innerH: window.innerHeight,
    canvasRect: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
    canvasAttr: c ? { w: c.width, h: c.height } : null,
    gameSize: { w: sm.gameSize.width, h: sm.gameSize.height },
    displaySize: { w: sm.displaySize.width, h: sm.displaySize.height },
    scaleMode: sm.scaleMode, zoom: sm.zoom,
    bodyMargin: getComputedStyle(document.body).margin,
    htmlOverflow: getComputedStyle(document.documentElement).overflow
  };
})()`), null, 1));

// 安装探针，记录 Phaser 收到的指针坐标
await ev(`(() => {
  const g = window.__SG3__.game;
  window.__CAL__ = [];
  const orig = g.input.manager;
  g.events.on('step', () => {});
  // 直接监听 DOM 层，拿到浏览器真实给的 clientX/clientY
  window.__DOMCAL__ = [];
  window.addEventListener('mousemove', (e) => {
    window.__DOMCAL__.push({ clientX: e.clientX, clientY: e.clientY, offsetX: e.offsetX, offsetY: e.offsetY });
  }, true);
  const scene = g.scene.getScene('MapScene');
  if (scene && scene.input) {
    scene.input.on('pointermove', (p) => { window.__CAL__.push({ x: p.x, y: p.y }); });
  }
  return true; })()`);
await sleep(200);

for (const y of [100, 300, 500, 602, 700]) {
  await ev('window.__CAL__ = []; window.__DOMCAL__ = [];');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 400, y, button: 'none', clickCount: 0 });
  await sleep(120);
  const phaser = await ev('window.__CAL__');
  const dom = await ev('window.__DOMCAL__');
  const p = phaser[phaser.length - 1];
  const d = dom[dom.length - 1];
  console.log(`CDP y=${String(y).padStart(3)} → DOM clientY=${d ? d.clientY : '?'} offsetY=${d ? d.offsetY : '?'} → Phaser y=${p ? p.y : '(无事件)'}`);
}
console.log('\nCDP x 校准:');
for (const x of [200, 640, 1095]) {
  await ev('window.__CAL__ = []; window.__DOMCAL__ = [];');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: 400, button: 'none', clickCount: 0 });
  await sleep(120);
  const p = (await ev('window.__CAL__')).slice(-1)[0];
  const d = (await ev('window.__DOMCAL__')).slice(-1)[0];
  console.log(`CDP x=${String(x).padStart(4)} → DOM clientX=${d ? d.clientX : '?'} offsetX=${d ? d.offsetX : '?'} → Phaser x=${p ? p.x : '(无事件)'}`);
}
ws.close(); await sleep(50);