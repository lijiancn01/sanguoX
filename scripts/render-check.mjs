/**
 * 通过 WebView2 的 CDP（Chrome DevTools Protocol）验证真实渲染状态。
 *
 * 用 Node 内置 WebSocket 连接调试端点，执行 JS 并截图，
 * 判定依据：Phaser canvas 是否创建、场景是否切换、控制台是否有错误。
 */
import { setTimeout as sleep } from 'node:timers/promises';

const CDP_PORT = Number(process.argv[2] || 9222);

async function getPageTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      const targets = await res.json();
      // 只认生产包页面，避免误连到残留的 dev(5173) 页面
      const page = targets.find((t) => t.type === 'page' && !t.url.includes('5173'));
      if (page) return page;
    } catch { /* 端点尚未就绪 */ }
    await sleep(500);
  }
  throw new Error('未找到 CDP page 目标');
}

const page = await getPageTarget();
console.log('target:', page.title, page.url);
if (page.url.includes('5173')) {
  console.error('目标指向 dev 服务器而非打包产物，判定失败');
  process.exit(3);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await new Promise((r) => ws.addEventListener('open', r, { once: true }));

// 收集控制台错误
const consoleErrors = [];
await send('Runtime.enable');
await send('Log.enable');
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrors.push('exception: ' + (m.params.exceptionDetails?.exception?.description
      || m.params.exceptionDetails?.text));
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    consoleErrors.push('log: ' + m.params.entry.text);
  }
});

await sleep(1500);

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' +
    (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
};

const checks = [];
const check = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });

// 1. Phaser 是否加载
const hasPhaser = await evaluate('typeof Phaser !== "undefined"');
check('Phaser 全局可用', hasPhaser);

// 2. canvas 是否创建
const canvasInfo = await evaluate(`(() => {
  const c = document.querySelector('#game canvas');
  return c ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight } : null;
})()`);
check('canvas 已创建', canvasInfo !== null, canvasInfo);

// 3. 应用是否挂载
const appInfo = await evaluate(`(() => {
  const a = window.__SG3__;
  if (!a) return null;
  return {
    hasGame: !!a.game,
    scenes: a.game ? a.game.scene.scenes.map(s => ({
      key: s.scene.key, active: s.scene.isActive()
    })) : [],
    cityCount: a.GameData ? Object.keys(a.GameData.cities || {}).length : 0,
    heroCount: a.GameData ? Object.keys(a.GameData.heroes || {}).length : 0
  };
})()`);
check('__SG3__ 已挂载', appInfo !== null, appInfo);
check('Phaser.Game 实例存在', appInfo && appInfo.hasGame);
check('GameData 已初始化', appInfo && appInfo.cityCount > 0,
  appInfo && `${appInfo.cityCount} 城 / ${appInfo.heroCount} 将`);

// 4. 当前活跃场景（BootScene 1.5s 后应切到 MenuScene）
const activeScenes = appInfo ? appInfo.scenes.filter((s) => s.active).map((s) => s.key) : [];
check('存在活跃场景', activeScenes.length > 0, activeScenes);
check('已进入 MenuScene 或之后', activeScenes.includes('MenuScene') ||
  activeScenes.includes('MapScene') || activeScenes.includes('BattleScene'), activeScenes);

// 5. canvas 是否真的画了东西（取样非背景色像素）
const rendered = await evaluate(`(() => {
  const c = document.querySelector('#game canvas');
  if (!c) return null;
  try {
    const gl = c.getContext('webgl') || c.getContext('webgl2');
    if (gl) {
      const px = new Uint8Array(4);
      // 取中心像素
      gl.readPixels(Math.floor(c.width/2), Math.floor(c.height/2), 1, 1,
        gl.RGBA, gl.UNSIGNED_BYTE, px);
      return { type: 'webgl', px: Array.from(px) };
    }
    const ctx = c.getContext('2d');
    if (ctx) {
      const d = ctx.getImageData(Math.floor(c.width/2), Math.floor(c.height/2), 1, 1).data;
      return { type: '2d', px: Array.from(d) };
    }
  } catch (e) { return { error: String(e) }; }
  return null;
})()`);
check('canvas 上下文可读取', rendered !== null, rendered);

// 6. 截图存证
const shot = await send('Page.captureScreenshot', { format: 'png' });
const { writeFileSync } = await import('node:fs');
writeFileSync('scripts/render-check.png', Buffer.from(shot.data, 'base64'));
console.log('screenshot -> scripts/render-check.png');

check('无运行时错误', consoleErrors.length === 0, consoleErrors);

const pass = checks.filter((c) => c.pass).length;
console.log(`\nrender-check: ${pass}/${checks.length} passed`);
for (const c of checks) {
  console.log(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.name}` +
    (c.pass ? '' : '  -> ' + JSON.stringify(c.detail)));
}
ws.close();
process.exit(pass === checks.length ? 0 : 2);
