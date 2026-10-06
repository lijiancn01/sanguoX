/**
 * 验证假设：提示气泡（toast）会吞掉其下方城池的点击。
 *
 * src/core/utils.js 的 showToast 把气泡放在画布顶部 y=90 居中，
 * 并调用 bg.setInteractive()，深度 9999。而地图上方的城市（例如平原
 * 画布坐标 y≈104）恰好落在气泡覆盖范围内 —— 只要上一个操作刚弹过提示，
 * 下一次点击城池就会打在气泡上，城市面板打不开。
 *
 * 演练中「平原 城市面板未打开」总是紧跟在「出征失败: 平原 → 邺」之后，
 * 正是这个顺序特征。
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

// 确保在地图场景
const ready = await ev(`(() => { const ms = window.__SG3__.game.scene.getScene('MapScene'); return !!(ms && ms.scene.isActive()); })()`);
if (!ready) {
  await ev(`(() => { const g = window.__SG3__.game; const GD = window.__SG3__.GameData;
    GD.initCustomFaction('赵轩','龙吟',0xd4a017,{force:95,intellect:88,politics:80,command:92,charisma:90},'changan',
      {name:'龙魂破',desc:'x',power:1.5,spCost:40});
    for (const k of ['MenuScene','BattleScene']) { const s = g.scene.getScene(k); if (s && s.scene.isActive()) g.scene.stop(k); }
    g.scene.start('MapScene'); return true; })()`);
  await sleep(2000);
}

const rect = await ev(`(() => { const g = window.__SG3__.game; const r = g.canvas.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, gw: g.scale.gameSize.width, gh: g.scale.gameSize.height }; })()`);
const vp = (gx, gy) => ({ x: rect.left + gx * rect.width / rect.gw, y: rect.top + gy * rect.height / rect.gh });

const cityPos = () => ev(`(() => { const GD = window.__SG3__.GameData; const ms = window.__SG3__.game.scene.getScene('MapScene');
  const c = Object.values(GD.cities).find(x => x.name === ${JSON.stringify(NAME)});
  return { gx: c.x + ms._mapContainer.x, gy: c.y - 6 + ms._mapContainer.y, mapX: ms._mapContainer.x, mapY: ms._mapContainer.y }; })()`);

const reset = () => ev(`(() => { const ms = window.__SG3__.game.scene.getScene('MapScene');
  ms._panelContainer.removeAll(true); ms._panelVisible = false; ms._dragging = false;
  // 清掉所有残留 toast 容器
  for (const o of ms.children.list.slice()) {
    if (o.type === 'Container' && o.depth === 9999) o.destroy();
  }
  return true; })()`);

async function clickCity() {
  const p = await cityPos();
  const v = vp(p.gx, p.gy);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: v.x, y: v.y, button: 'none', buttons: 0 });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: v.x, y: v.y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(15);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: v.x, y: v.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(300);
  return ev(`window.__SG3__.game.scene.getScene('MapScene')._panelVisible`);
}

let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) fails++; };

// --- 1. 干净状态点击 ---
await reset();
const clean = await clickCity();
check(clean, `无 toast 时点击「${NAME}」打开面板`);

// --- 2. 先弹一个 toast（模拟「出征失败」提示），再点击同一城池 ---
await reset();
const toastInfo = await ev(`(() => {
  const ms = window.__SG3__.game.scene.getScene('MapScene');
  ms._showToast('出征失败: ${NAME} → 邺');
  const toasts = ms.children.list.filter(o => o.type === 'Container' && o.depth === 9999);
  const info = toasts.map(c => { const b = c.getBounds ? c.getBounds() : null;
    return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height),
      interactiveChildren: c.list.filter(o => o.input && o.input.enabled).length } : null; });
  return info; })()`);
console.log(`\n  弹出的 toast: ${JSON.stringify(toastInfo)}`);
await sleep(120);
const withToast = await clickCity();
check(withToast, `刚弹过 toast 后点击「${NAME}」仍能打开面板`);

// --- 3. 报告 toast 是否覆盖该城 ---
const overlap = await ev(`(() => {
  const GD = window.__SG3__.GameData; const ms = window.__SG3__.game.scene.getScene('MapScene');
  const c = Object.values(GD.cities).find(x => x.name === ${JSON.stringify(NAME)});
  const gx = c.x + ms._mapContainer.x, gy = c.y - 6 + ms._mapContainer.y;
  const covering = [];
  for (const o of ms.children.list) {
    let b = null; try { b = o.getBounds ? o.getBounds() : null; } catch (e) {}
    if (b && b.width > 0 && gx >= b.x && gx <= b.x + b.width && gy >= b.y && gy <= b.y + b.height) {
      covering.push({ type: o.type, depth: o.depth, text: typeof o.text === 'string' ? o.text.slice(0,16) : null,
        bounds: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)],
        hasInteractiveChild: !!(o.list && o.list.some(k => k.input && k.input.enabled)) });
    }
  }
  return { gx, gy, covering }; })()`);
console.log(`\n  ${NAME} 画布坐标=(${overlap.gx},${overlap.gy})，覆盖它的顶层对象:`);
for (const o of overlap.covering) {
  console.log(`    depth=${o.depth} ${o.type} ${o.text || ''} bounds=${JSON.stringify(o.bounds)} 含可交互子对象=${o.hasInteractiveChild}`);
}

console.log(`\n结论: ${fails === 0 ? '✓ toast 未吞掉点击' : `✗ ${fails} 项失败 —— toast 吞掉了城池点击`}`);
ws.close(); await sleep(50);