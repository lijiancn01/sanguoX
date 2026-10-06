/** 盘点剩余敌方城市、相邻我方城市的兵力上限，判断哪些是结构性难攻 */
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
const ev = async (x) => {
  const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
};

const data = await ev(`(() => {
  const GD = window.__SG3__.GameData;
  const mine = GD.playerFaction;
  const out = { turn: GD.turn, mineCount: 0, enemies: [] };
  for (const cid in GD.cities) if (GD.cities[cid].faction === mine) out.mineCount++;
  for (const cid in GD.cities) {
    const c = GD.cities[cid];
    if (c.faction === mine) continue;
    const nbrs = [];
    for (const a of c.adjacent) {
      const n = GD.cities[a];
      if (!n || n.faction !== mine) continue;
      nbrs.push({ name: n.name, cur: GD.getCityTotalTroops(a), max: n.maxTroops, heroes: n.heroes.length });
    }
    nbrs.sort((x, y) => y.cur - x.cur);
    out.enemies.push({
      id: cid, name: c.name, faction: c.faction, max: c.maxTroops,
      heroes: c.heroes.length, troops: GD.getCityTotalTroops(cid),
      bestNbr: nbrs[0] || null, nbrs
    });
  }
  out.enemies.sort((a, b) => a.troops - b.troops);
  return out;
})()`);

console.log(`第 ${data.turn} 回合，我方 ${data.mineCount}/55 城，剩余敌方 ${data.enemies.length} 座\n`);
for (const e of data.enemies) {
  const b = e.bestNbr;
  const ratio = b ? (b.cur / Math.max(1, e.troops)) : 0;
  console.log(`${e.name} (${e.faction}) 守将=${e.heroes} 守军=${e.troops}/${e.max}`);
  if (b) {
    console.log(`   最强相邻我方: ${b.name} 兵力=${b.cur}/${b.max} 武将=${b.heroes}` +
      `  兵力比=${ratio.toFixed(2)}${ratio >= 1.1 ? ' ✓可强攻' : ratio >= 0.6 ? ' ~可消耗' : ' ✗打不动'}`);
  } else {
    console.log('   ✗ 无相邻我方城市');
  }
  if (e.nbrs.length > 1) {
    console.log(`   全部相邻我方: ${e.nbrs.map((n) => `${n.name}(${n.cur}/${n.max})`).join(' ')}`);
  }
}
ws.close();
await sleep(50);