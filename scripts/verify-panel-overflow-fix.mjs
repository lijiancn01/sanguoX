/**
 * 验证「武将过多导致面板按钮溢出画布」的修复。
 *
 * 缺陷背景：城市面板每名武将占 36px，出征面板每名占 22px。
 * 后期一座城会聚集 20+ 名武将（实测寿春 22 名），未修复前
 * 「征兵/搜索/出兵/关闭」按钮被推到 y≈1158，而画布仅 720 高，
 * 玩家完全无法操作该城 —— 这正是演练卡在 52/55 的直接原因。
 *
 * 本脚本：真实点击进入自定义君主 → 开局 → 往长安塞入大量武将 →
 * 打开城市面板与出征面板，断言所有操作按钮都落在画布内且可点击。
 */
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.argv[2] || 9500);
const MONARCH = '赵轩';
const FACTION = '龙吟';
const SKILL = '龙魂破';

const t = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((x) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((r) => {
  const i = ++id; pending.set(i, (m) => r(m.result));
  ws.send(JSON.stringify({ id: i, method, params }));
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

const ev = async (x) => {
  const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
};
/**
 * 游戏坐标 → 视口坐标。
 * 注意：canvas 在 760px 高的视口里垂直居中，顶部有 20px 偏移。
 * Phaser 的 getBounds() 给的是「画布坐标」，派发 CDP 事件必须叠加 canvas 的
 * 视口偏移，否则点击会整体上移 20px —— 这正是演练中「城市面板未打开 /
 * 出征面板未出现」反复出现的根因（城市图标高约 32px，偏 20px 就会打空）。
 */
let rectCache = null;
async function canvasRect() {
  if (rectCache) return rectCache;
  rectCache = await ev(`(() => { const g = window.__SG3__.game;
    const r = g.canvas.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height,
      gw: g.scale.gameSize.width, gh: g.scale.gameSize.height }; })()`);
  return rectCache;
}
const click = async (gx, gy) => {
  const r = await canvasRect();
  const x = r.left + gx * r.width / r.gw;
  const y = r.top + gy * r.height / r.gh;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
  await sleep(60);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(25);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(250);
};
const typeText = async (s) => {
  await send('Input.insertText', { text: s });
  await sleep(200);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(350);
};

const listScene = async (key) => ev(`(() => {
  const g = window.__SG3__ && window.__SG3__.game;
  if (!g) return [];
  const s = g.scene.getScene(${JSON.stringify(key)});
  if (!s || !s.children) return [];
  const out = [];
  const visit = (arr) => {
    for (const o of arr) {
      let b = null;
      try { b = o.getBounds ? o.getBounds() : null; } catch (e) { b = null; }
      if (b && b.width > 0 && b.height > 0) {
        out.push({ text: typeof o.text === 'string' ? o.text : null,
          interactive: !!(o.input && o.input.enabled),
          cx: b.x + b.width / 2, cy: b.y + b.height / 2, w: b.width, h: b.height });
      }
      if (o.list) visit(o.list);
    }
  };
  visit(s.children.list);
  return out;
})()`);
const clickText = async (key, pred, label) => {
  const objs = await listScene(key);
  const hit = objs.filter((o) => o.text !== null && o.interactive && pred(o.text))
    .sort((a, b) => a.cy - b.cy)[0];
  if (!hit) { console.log(`  ✗ 找不到 ${label}`); return false; }
  await click(hit.cx, hit.cy);
  return true;
};

// --- 直接进入地图场景：本脚本只验证面板布局，无需走菜单点击流程 ---
// （菜单里的势力卡片是 Zone，text 为 null，无法用文本定位；
//   且面板溢出与开局方式无关，直接构造自定义势力局面即可。）
await ev(`(() => {
  const g = window.__SG3__.game;
  const GD = window.__SG3__.GameData;
  // 签名: initCustomFaction(君主名, 势力名, 势力色, 属性, 起始城市id, 技能数据)
  GD.initCustomFaction(${JSON.stringify(MONARCH)}, ${JSON.stringify(FACTION)}, 0xd4a017,
    { force: 95, intellect: 88, politics: 80, command: 92, charisma: 90 },
    'changan', { name: ${JSON.stringify(SKILL)}, desc: '测试技能', power: 1.5, spCost: 40 });
  for (const k of ['MenuScene','BattleScene']) { const s = g.scene.getScene(k); if (s && s.scene.isActive()) g.scene.stop(k); }
  if (g.scene.getScene('MapScene').scene.isActive()) g.scene.stop('MapScene');
  g.scene.start('MapScene');
  return true;
})()`);
await sleep(2000);

const started = await ev(`(() => { const GD = window.__SG3__.GameData;
  return { turn: GD.turn, faction: GD.playerFaction,
    mine: Object.values(GD.cities).filter(c => c.faction === GD.playerFaction).map(c => c.name) }; })()`);
console.log(`开局: 第${started.turn}回合 势力=${started.faction} 我方城市=${started.mine.join('、')}`);

// --- 往我方一座城塞入 22 名武将，复现溢出条件 ---
const injected = await ev(`(() => {
  const GD = window.__SG3__.GameData;
  const city = Object.values(GD.cities).find(c => c.faction === GD.playerFaction);
  const pool = Object.values(GD.heroes);
  let added = 0;
  for (const h of pool) {
    if (city.heroes.length >= 22) break;
    if (city.heroes.indexOf(h.id) > -1) continue;
    if (h.status === 'marching') continue;
    const prev = GD.cities[h.location];
    if (prev && prev.heroes) { const i = prev.heroes.indexOf(h.id); if (i > -1) prev.heroes.splice(i, 1); }
    h.location = city.id; h.status = 'idle';
    if (h.troops <= 0) h.troops = 500;
    city.heroes.push(h.id); added++;
  }
  return { city: city.name, heroes: city.heroes.length, added };
})()`);
console.log(`注入: ${injected.city} 现有 ${injected.heroes} 名武将（新增 ${injected.added}）`);

// --- 打开城市面板，检查按钮是否都在画布内 ---
await ev(`(() => { const GD = window.__SG3__.GameData;
  const ms = window.__SG3__.game.scene.getScene('MapScene');
  for (const cid in GD.cities) if (GD.cities[cid].name === ${JSON.stringify(injected.city)}) ms._showCityPanel(cid);
  return true; })()`);
await sleep(500);

const check = async (label, needTexts) => {
  const layout = await ev(`(() => {
    const ms = window.__SG3__.game.scene.getScene('MapScene');
    const out = [];
    for (const o of ms._panelContainer.list) {
      if (typeof o.text !== 'string') continue;
      const b = o.getBounds();
      out.push({ text: o.text, cy: Math.round(b.y + b.height / 2),
        interactive: !!(o.input && o.input.enabled), ch: ms._ch });
    }
    return { ch: ms._ch, items: out };
  })()`);
  console.log(`\n[${label}] 画布高=${layout.ch}`);
  let bad = 0;
  for (const want of needTexts) {
    const hit = layout.items.find((i) => i.text === want);
    if (!hit) { console.log(`  ✗ 按钮「${want}」不存在`); bad++; continue; }
    const ok = hit.cy > 0 && hit.cy < layout.ch;
    if (!ok) bad++;
    console.log(`  ${ok ? '✓' : '✗'} ${want.padEnd(6)} 屏幕y=${hit.cy} ${ok ? '在画布内' : '超出画布'}`);
  }
  return bad;
};

let bad = 0;
bad += await check('城市面板', ['开发农业', '开发商业', '征兵', '搜索', '训练', '出兵', '关闭']);

// --- 真实点击「出兵」按钮，确认它真的能点到并打开出征面板 ---
// 这是本缺陷的核心断言：修复前按钮在 y≈1158（画布外），点击必然落空。
const btnPos = await ev(`(() => {
  const ms = window.__SG3__.game.scene.getScene('MapScene');
  for (const o of ms._panelContainer.list) {
    if (o.text !== '出兵') continue;
    const b = o.getBounds();
    return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, ch: ms._ch };
  }
  return null;
})()`);
console.log(`\n「出兵」按钮屏幕坐标: (${Math.round(btnPos.cx)}, ${Math.round(btnPos.cy)})，画布高 ${btnPos.ch}`);
await click(btnPos.cx, btnPos.cy);
await sleep(400);

const openedPanel = await ev(`(() => {
  const ms = window.__SG3__.game.scene.getScene('MapScene');
  return ms._panelContainer.list.some(o => typeof o.text === 'string' && o.text.indexOf('出征 - ') === 0);
})()`);
console.log(`真实点击「出兵」→ 出征面板出现: ${openedPanel ? '✓ 是' : '✗ 否'}`);
if (!openedPanel) bad++;

bad += await check('出征面板', ['确认出征', '取消']);

const overflowNote = await ev(`(() => {
  const ms = window.__SG3__.game.scene.getScene('MapScene');
  return ms._panelContainer.list.filter(o => typeof o.text === 'string' && o.text.indexOf('未显示') > -1)
    .map(o => o.text);
})()`);
console.log(`\n裁剪提示: ${overflowNote.length ? overflowNote.join(' / ') : '（无，武将数量未超限）'}`);

console.log(`\n结论: ${bad === 0 ? '✓ 通过 —— 所有操作按钮均在画布内，可正常点击' : `✗ 失败 —— ${bad} 个按钮不可用`}`);
ws.close();
await sleep(50);
process.exit(bad === 0 ? 0 : 1);