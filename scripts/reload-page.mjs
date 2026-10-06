/** 重载页面并等待游戏就绪（确保加载最新模块） */
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.argv[2] || 9500);
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

await send('Page.reload', { ignoreCache: true });
for (let i = 0; i < 60; i++) {
  await sleep(400);
  try {
    const r = await send('Runtime.evaluate', {
      expression: '!!(window.__SG3__ && window.__SG3__.game)', returnByValue: true
    });
    if (r.result && r.result.value) { console.log('游戏已就绪（第', i, '次探测）'); break; }
  } catch { /* 重载期间上下文短暂失效 */ }
}
await sleep(1500);
const chk = await send('Runtime.evaluate', {
  expression: `(() => {
    const ms = window.__SG3__.game.scene.getScene('MapScene');
    return { active: ms ? ms.scene.isActive() : false };
  })()`, returnByValue: true
});
console.log('MapScene:', JSON.stringify(chk.result.value));
ws.close();
await sleep(50);