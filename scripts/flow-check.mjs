/**
 * 通过 CDP 驱动真实游戏流程，验证端到端可用性。
 *
 * 覆盖：
 *   1. 主菜单 → 选择势力 → 进入战略地图
 *   2. 地图上执行结束回合（触发 AI 与回合推进）
 *   3. 存档 → 读档往返（走真实 SQLite IPC）
 *   4. 全程无运行时错误
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';

const CDP_PORT = Number(process.argv[2] || 9222);

async function getPageTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      // 只认打包产物页面，避免误连残留的 dev(5173) 页面
      const t = (await res.json()).find(
        (x) => x.type === 'page' && !x.url.includes('5173')
      );
      if (t) return t;
    } catch { /* 等待端点 */ }
    await sleep(500);
  }
  throw new Error('未找到 CDP page 目标');
}

const page = await getPageTarget();
console.log('target:', page.title, page.url);
const ws = new WebSocket(page.webSocketDebuggerUrl);
let msgId = 0;
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
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await new Promise((r) => ws.addEventListener('open', r, { once: true }));
await send('Runtime.enable');
await send('Log.enable');
await sleep(1200);

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text + ' ' +
      (r.exceptionDetails.exception?.description || ''));
  }
  return r.result.value;
};

const checks = [];
const check = (name, cond, detail) => {
  checks.push({ name, pass: !!cond, detail });
  console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name}` + (cond ? '' : '  -> ' + JSON.stringify(detail)));
};

const activeScene = () => evaluate(`(() => {
  const g = window.__SG3__ && window.__SG3__.game;
  if (!g) return null;
  const a = g.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key);
  return a;
})()`);

// --- 1. 等待 BootScene 切到 MenuScene ---
for (let i = 0; i < 20; i++) {
  const s = await activeScene();
  if (s && s.includes('MenuScene')) break;
  await sleep(400);
}
check('进入主菜单', (await activeScene()).includes('MenuScene'), await activeScene());

// --- 2. 选择「曹魏」势力（调用场景方法，等价于点击卡片） ---
await evaluate(`(() => {
  const g = window.__SG3__.game;
  const menu = g.scene.getScene('MenuScene');
  menu._selectFaction('wei');
  return true;
})()`);
await sleep(2500);

let scenes = await activeScene();
check('进入战略地图', scenes.includes('MapScene'), scenes);

const mapState = await evaluate(`(() => {
  const GD = window.__SG3__.GameData;
  const myCities = Object.values(GD.cities).filter(c => c.faction === GD.playerFaction);
  return {
    playerFaction: GD.playerFaction,
    turn: GD.turn,
    myCityCount: myCities.length,
    totalCities: Object.keys(GD.cities).length,
    armies: GD.armies.length
  };
})()`);
check('玩家势力为 wei', mapState.playerFaction === 'wei', mapState);
check('玩家拥有城池', mapState.myCityCount > 0, mapState.myCityCount + ' 城');
check('初始回合为 1', mapState.turn === 1, mapState.turn);

// --- 3. 结束回合（触发内政/AI/回合推进） ---
const turnBefore = mapState.turn;
await evaluate(`(() => {
  const g = window.__SG3__.game;
  g.scene.getScene('MapScene')._onEndTurn();
  return true;
})()`);
await sleep(3000);

const afterTurn = await evaluate(`(() => {
  const GD = window.__SG3__.GameData;
  return {
    turn: GD.turn,
    aiCities: Object.values(GD.cities).filter(c => c.faction !== GD.playerFaction && c.faction !== 'none').length,
    log: GD._lastEvent ? GD._lastEvent.name : null
  };
})()`);
check('回合已推进', afterTurn.turn > turnBefore,
  `${turnBefore} -> ${afterTurn.turn}`);

// --- 4. 存档 → 读档往返（真实 SQLite IPC） ---
// 直接走 Tauri IPC，验证前端序列化 → SQLite 落盘 → 反序列化恢复的完整链路
const roundTrip = await evaluate(`(async () => {
  const inv = window.__TAURI_INTERNALS__.invoke;
  const GD = window.__SG3__.GameData;
  const slot = 5;

  const payload = GD.toJSON();
  const saveRes = await inv('save_game', { slot, payloadJson: JSON.stringify(payload) });
  if (!saveRes || !saveRes.ok) return { stage: 'save', res: saveRes };

  const loadRes = await inv('load_game', { slot });
  if (!loadRes || !loadRes.ok) return { stage: 'load', res: loadRes };

  const before = { turn: GD.turn, playerFaction: GD.playerFaction };
  const parsed = JSON.parse(loadRes.payloadJson);
  const fromRes = GD.fromJSON(parsed);
  const after = { turn: GD.turn, playerFaction: GD.playerFaction, fromOk: fromRes.ok };

  await inv('delete_save', { slot });
  const cleaned = await inv('has_save', { slot });

  return { stage: 'done', before, after, cleaned };
})()`);

check('存档写入成功', roundTrip && roundTrip.stage === 'done', roundTrip);
check('读档恢复状态一致',
  roundTrip && roundTrip.after && roundTrip.before &&
  roundTrip.after.turn === roundTrip.before.turn &&
  roundTrip.after.playerFaction === roundTrip.before.playerFaction,
  roundTrip && { before: roundTrip.before, after: roundTrip.after });
check('清理测试存档', roundTrip && roundTrip.cleaned === false, roundTrip && roundTrip.cleaned);

// --- 5. 截图存证 ---
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('scripts/flow-map.png', Buffer.from(shot.data, 'base64'));
console.log('  screenshot -> scripts/flow-map.png');

check('全程无运行时错误', errors.length === 0, errors.slice(0, 5));

const pass = checks.filter((c) => c.pass).length;
console.log(`\nflow-check: ${pass}/${checks.length} passed`);
ws.close();
process.exit(pass === checks.length ? 0 : 2);
