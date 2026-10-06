/**
 * 回归测试：修复「拖拽与点击冲突」（代码审查 2.9）。
 *
 * 缺陷：场景级 pointerdown 不区分「按在城池图标上」还是「按在空白地图上」，
 * 一律把 _dragging 置为 true。于是点击城池后只要再来一个 pointermove，
 * 地图就整体平移（实测 (581,15)），图标从光标下移走，城市面板点不开 ——
 * 演练中表现为反复出现、且与状态相关的「平原 城市面板未打开」。
 *
 * 断言：
 *   1. 在城池上按下时 _dragging 必须保持 false；
 *   2. 点击城池后再派发 pointermove，地图不得平移；
 *   3. 连续两次点击城池都能打开面板；
 *   4. 在空白区域按下并拖动，地图必须正常平移（拖拽功能不能被改坏）。
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

// 确保处于战略地图场景（页面重载后停在主菜单）
const sceneReady = await ev(`(() => { const g = window.__SG3__.game;
  const ms = g.scene.getScene('MapScene');
  if (ms && ms.scene.isActive()) return 'already';
  const GD = window.__SG3__.GameData;
  GD.initCustomFaction('赵轩','龙吟',0xd4a017,{force:95,intellect:88,politics:80,command:92,charisma:90},'changan',
    {name:'龙魂破',desc:'测试技能',power:1.5,spCost:40});
  for (const k of ['MenuScene','BattleScene']) { const s = g.scene.getScene(k); if (s && s.scene.isActive()) g.scene.stop(k); }
  g.scene.start('MapScene');
  return 'started'; })()`);
if (sceneReady === 'started') await sleep(2000);
console.log(`场景: ${sceneReady === 'started' ? '已启动战略地图' : '战略地图已就绪'}\n`);
const vp = (gx, gy) => ({ x: rect.left + gx * rect.width / rect.gw, y: rect.top + gy * rect.height / rect.gh });
const move = (v, buttons = 0) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: v.x, y: v.y, button: buttons ? 'left' : 'none', buttons });
const down = (v) => send('Input.dispatchMouseEvent', { type: 'mousePressed', x: v.x, y: v.y, button: 'left', buttons: 1, clickCount: 1 });
const up = (v) => send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: v.x, y: v.y, button: 'left', buttons: 0, clickCount: 1 });

const st = () => ev(`(() => { const GD = window.__SG3__.GameData;
  const ms = window.__SG3__.game.scene.getScene('MapScene');
  const c = Object.values(GD.cities).find(x => x.name === ${JSON.stringify(NAME)});
  return { gx: c.x + ms._mapContainer.x, gy: c.y - 6 + ms._mapContainer.y,
    mapX: ms._mapContainer.x, mapY: ms._mapContainer.y,
    dragging: ms._dragging, panel: ms._panelVisible }; })()`);
const reset = () => ev(`(() => { const ms = window.__SG3__.game.scene.getScene('MapScene');
  ms._panelContainer.removeAll(true); ms._panelVisible = false; ms._dragging = false; return true; })()`);

let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) fails++; };

// --- 1. 在城池上按下，_dragging 必须为 false ---
await reset();
const p0 = await st();
const v0 = vp(p0.gx, p0.gy);
await move(v0);
await down(v0);
await sleep(60);
const duringDown = await ev(`window.__SG3__.game.scene.getScene('MapScene')._dragging`);
check(duringDown === false, `在城池上按下时 _dragging=${duringDown}（期望 false，修复前为 true）`);
await up(v0);
await sleep(300);
const p1 = await st();
check(p1.panel === true, `点击「${NAME}」打开城市面板`);

// --- 2. 点击后再派发 pointermove，地图不得平移 ---
await reset();
const p2 = await st();
const v2 = vp(p2.gx, p2.gy);
await move(v2);
await down(v2);
await up(v2);
await sleep(250);
const before = await st();
await move({ x: v2.x + 120, y: v2.y + 90 });
await sleep(200);
const after = await st();
const panned = (after.mapX - before.mapX) !== 0 || (after.mapY - before.mapY) !== 0;
check(!panned, `点击后 pointermove 未平移地图（偏移 (${after.mapX - before.mapX},${after.mapY - before.mapY})）`);

// --- 3. 连续两次点击都能打开面板 ---
await reset();
let twice = 0;
for (let i = 0; i < 2; i++) {
  await reset();
  const p = await st();
  const v = vp(p.gx, p.gy);
  await move(v); await down(v); await sleep(15); await up(v);
  await sleep(300);
  if ((await st()).panel) twice++;
}
check(twice === 2, `连续 2 次点击城池均打开面板（${twice}/2）`);

// --- 4. 空白区域拖拽仍须正常工作 ---
await reset();
const b0 = await st();
// 选一个远离该城、且不在面板/HUD 区域内的空白点
const blank = vp(120, 400);
await move(blank);
await down(blank);
await sleep(30);
const draggingOnBlank = await ev(`window.__SG3__.game.scene.getScene('MapScene')._dragging`);
await move({ x: blank.x + 100, y: blank.y + 60 }, 1);
await sleep(120);
await up({ x: blank.x + 100, y: blank.y + 60 });
await sleep(200);
const b1 = await st();
const dragDx = b1.mapX - b0.mapX, dragDy = b1.mapY - b0.mapY;
check(draggingOnBlank === true, `空白区域按下时 _dragging=${draggingOnBlank}（期望 true）`);
check(Math.abs(dragDx - 100) < 3 && Math.abs(dragDy - 60) < 3,
  `空白区域拖拽平移 (${dragDx},${dragDy})（期望约 (100,60)）`);

console.log(`\n结论: ${fails === 0 ? '✓ 全部通过' : `✗ ${fails} 项失败`}`);
ws.close(); await sleep(50);
process.exit(fails === 0 ? 0 : 1);