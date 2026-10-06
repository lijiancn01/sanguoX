/** 列出 MenuScene 的可交互文本，确认实际菜单项 */
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = Number(process.argv[2] || 9500);
const t = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((x) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, (m) => r(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };

console.log('活动场景:', JSON.stringify(await ev(`(() => { const g = window.__SG3__.game;
  return ['BootScene','MenuScene','MapScene','BattleScene'].filter(k => { const s = g.scene.getScene(k); return s && s.scene.isActive(); }); })()`)));

console.log('GameData:', JSON.stringify(await ev(`(() => { const GD = window.__SG3__.GameData;
  return GD ? { turn: GD.turn, faction: GD.playerFaction, hasCustom: !!GD.customFactionId } : null; })()`)));

const items = await ev(`(() => {
  const g = window.__SG3__.game; const s = g.scene.getScene('MenuScene');
  if (!s || !s.children) return [];
  const out = [];
  const visit = (arr) => { for (const o of arr) {
    let b = null; try { b = o.getBounds ? o.getBounds() : null; } catch (e) {}
    if (b && b.width > 0) out.push({ text: typeof o.text === 'string' ? o.text : null,
      interactive: !!(o.input && o.input.enabled), cx: Math.round(b.x + b.width/2), cy: Math.round(b.y + b.height/2), w: Math.round(b.width) });
    if (o.list) visit(o.list); } };
  visit(s.children.list); return out; })()`);
console.log(`\nMenuScene 对象 ${items.length} 个：`);
for (const i of items.filter((x) => x.interactive || x.text)) {
  console.log(`  ${i.interactive ? '[可点]' : '      '} ${String(i.text).slice(0, 24).padEnd(26)} (${i.cx},${i.cy}) w=${i.w}`);
}
ws.close(); await sleep(50);