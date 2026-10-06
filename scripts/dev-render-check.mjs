/**
 * dev 模式渲染检查：目标就是 Vite dev 页面（5173），不做 URL 过滤。
 * 与 render-check.mjs 的区别仅在于此，其余判定逻辑一致。
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';

const PORT = Number(process.argv[2] || 9500);

async function getTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const t = (await res.json()).find((x) => x.type === 'page');
      if (t) return t;
    } catch { /* 等端点 */ }
    await sleep(500);
  }
  throw new Error('未找到 CDP page 目标');
}

const page = await getTarget();
console.log('target:', page.title, page.url);

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const errors = [];

ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push('exception: ' + (m.params.exceptionDetails?.exception?.description
      || m.params.exceptionDetails?.text));
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    errors.push('log: ' + m.params.entry.text);
  }
});

function send(method, params = {}) {
  const i = ++id;
  return new Promise((res, rej) => {
    pending.set(i, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}

await new Promise((r) => ws.addEventListener('open', r, { once: true }));
await send('Runtime.enable');
await send('Log.enable');
await sleep(2500);

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

const checks = [];
const check = (n, c, d) => checks.push({ n, c: !!c, d });

check('Phaser 全局可用', await evaluate('typeof Phaser !== "undefined"'));
const canvas = await evaluate(`(() => {
  const c = document.querySelector('#game canvas');
  return c ? { w: c.width, h: c.height } : null;
})()`);
check('canvas 已创建', canvas, canvas);

const app = await evaluate(`(() => {
  const a = window.__SG3__;
  if (!a) return null;
  return {
    hasGame: !!a.game,
    active: a.game ? a.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key) : [],
    cities: a.GameData ? Object.keys(a.GameData.cities || {}).length : 0,
    heroes: a.GameData ? Object.keys(a.GameData.heroes || {}).length : 0
  };
})()`);
check('__SG3__ 已挂载', app, app);
check('GameData 已初始化', app && app.cities > 0,
  app && `${app.cities} 城 / ${app.heroes} 将`);
check('存在活跃场景', app && app.active.length > 0, app && app.active);
check('已进入 MenuScene 或之后',
  app && app.active.some((k) => ['MenuScene', 'MapScene', 'BattleScene'].includes(k)),
  app && app.active);
check('无运行时错误', errors.length === 0, errors.slice(0, 3));

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('scripts/dev-render.png', Buffer.from(shot.data, 'base64'));

const pass = checks.filter((c) => c.c).length;
console.log(`\ndev-render: ${pass}/${checks.length} passed`);
for (const c of checks) {
  console.log(`  ${c.c ? 'PASS' : 'FAIL'} ${c.n}` + (c.c ? '' : '  -> ' + JSON.stringify(c.d)));
}
ws.close();
process.exit(pass === checks.length ? 0 : 2);
