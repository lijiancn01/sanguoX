/**
 * 验证修复：城池图标改为「以自身原点绘制 + setPosition 定位」后，
 * 悬停放大不再挪走图标与命中区，玩家「先悬停再点击」必定命中。
 */
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.argv[2] || 9500);
const NAMES = process.argv.slice(3).length ? process.argv.slice(3)
  : ['平原', '云南', '邺', '长安', '建业'];

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

// 确保在战略地图上
await ev(`(() => {
  const g = window.__SG3__.game;
  const GD = window.__SG3__.GameData;
  if (!GD.playerFaction || !GD.factions[GD.playerFaction]) {
    GD.initCustomFaction('赵轩', '龙吟', 0xff4444, {}, 'changan', null);
  }
  for (const k of ['MenuScene', 'BattleScene']) {
    const s = g.scene.getScene(k);
    if (s && s.scene.isActive()) g.scene.stop(k);
  }
  g.scene.start('MapScene');
  return true;
})()`);
await sleep(1800);

const rect = await ev(`(() => {
  const g = window.__SG3__.game; const r = g.canvas.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height,
           gw: g.scale.gameSize.width, gh: g.scale.gameSize.height };
})()`);

const probe = async (name) => ev(`(() => {
  const GD = window.__SG3__.GameData;
  const ms = window.__SG3__.game.scene.getScene('MapScene');
  for (const cid in GD.cities) {
    const c = GD.cities[cid];
    if (c.name !== ${JSON.stringify(name)}) continue;
    const icon = ms._citySprites[cid];
    if (!icon) return { missing: true };
    const m = icon.getWorldTransformMatrix();
    const w = m.transformPoint(0, 0); // 图标自身原点在世界中的位置
    return { cid, name: c.name, scale: +icon.scaleX.toFixed(3),
      iconPos: { x: icon.x, y: icon.y },
      worldOrigin: { x: Math.round(w.x), y: Math.round(w.y) },
      expected: { x: Math.round(c.x + ms._mapContainer.x), y: Math.round(c.y + ms._mapContainer.y) },
      panel: ms._panelVisible };
  }
  return null;
})()`);

let pass = 0; let fail = 0;
for (const name of NAMES) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.left + 4, y: rect.top + 300, button: 'none', buttons: 0 });
  await sleep(120);
  const before = await probe(name);
  if (!before || before.missing) { console.log(`? ${name} 未找到或图标缺失`); continue; }

  const p = { x: rect.left + before.expected.x * rect.width / rect.gw,
              y: rect.top + before.expected.y * rect.height / rect.gh };
  // 悬停（这正是玩家点城前的自然动作）
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'none', buttons: 0 });
  await sleep(250);
  const hovered = await probe(name);
  // 悬停状态下点击同一坐标
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(25);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(320);
  const after = await probe(name);

  const drift = Math.abs(hovered.worldOrigin.x - before.expected.x) + Math.abs(hovered.worldOrigin.y - before.expected.y);
  const ok = after.panel === true;
  if (ok) pass++; else fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}  图标定位=(${before.iconPos.x},${before.iconPos.y})` +
    ` 期望=(${before.expected.x},${before.expected.y})  悬停后漂移=${drift}px  scale=${hovered.scale}  点击命中=${after.panel}`);
  await ev(`(() => { const s = window.__SG3__.game.scene.getScene('MapScene');
    s._panelContainer.removeAll(true); s._panelVisible = false; return true; })()`);
}

console.log(`\n结果: ${pass} 命中 / ${fail} 落空`);
ws.close();
await sleep(50);
process.exit(fail === 0 ? 0 : 1);