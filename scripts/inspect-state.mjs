/**
 * 读取运行中游戏的真实状态，用于验证势力配色与旧存档迁移。
 *
 * 游戏入口 main.js 会把实例挂到 window.__SG3__，直接用它即可。
 * （注意：不要用动态 import('/src/...')，Vite 的 root 不是工程根目录，
 * 该路径会回退成 index.html 并抛出 "Failed to fetch dynamically imported module"。）
 *
 * 用法: node scripts/inspect-state.mjs [端口]
 */
const port = process.argv[2] || '9500';
const res = await fetch(`http://127.0.0.1:${port}/json`);
const page = (await res.json()).find((t) => t.type === 'page');
if (!page) { console.error('未找到 page'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const msgId = ++id;
  pending.set(msgId, { resolve, reject });
  ws.send(JSON.stringify({ id: msgId, method, params }));
});
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
});

const EXPR = `(() => {
  const SG = window.__SG3__;
  if (!SG) return JSON.stringify({ err: 'window.__SG3__ 不存在' });
  const GD = SG.GameData;
  const cfgMod = { factionCss: null, factionName: null };
  const out = {
    scenes: SG.game.scene.getScenes(true).map(s => s.scene.key),
    playerFaction: GD.playerFaction,
    turn: GD.turn,
    migrationNote: GD._migrationNote || null,
    factionKeys: Object.keys(GD.factions || {}),
    byFaction: {},
    legacyQunLeft: 0
  };
  for (const c of Object.values(GD.cities)) {
    out.byFaction[c.faction] = (out.byFaction[c.faction] || 0) + 1;
    if (c.faction === 'qun') out.legacyQunLeft++;
  }
  // 武将归属抽样，确认颜良/文丑/张角/貂蝉已修正
  const probe = ['yanliang','wenchou','zhangjiao','diaochan','lvbu','yuanshao','menghuo'];
  out.heroes = {};
  for (const hid of probe) {
    const h = GD.heroes[hid];
    if (h) out.heroes[hid] = { name: h.name, faction: h.faction, location: h.location || null };
  }
  return JSON.stringify(out, null, 2);
})()`;

ws.addEventListener('open', async () => {
  try {
    const r = await send('Runtime.evaluate', {
      expression: EXPR, returnByValue: true, awaitPromise: true
    });
    if (r.exceptionDetails) {
      console.error('页面异常:', JSON.stringify(r.exceptionDetails, null, 2));
      process.exitCode = 1;
    } else {
      console.log(r.result.value);
    }
  } catch (e) {
    console.error('失败:', e.message);
    process.exitCode = 1;
  } finally { ws.close(); }
});