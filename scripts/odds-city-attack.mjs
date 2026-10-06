/**
 * 离线推演：指定城市之间能否靠「多波消耗」攻克。
 *
 * 用法: node scripts/odds-city-attack.mjs [端口] [进攻方城市] [防守方城市] [推演次数]
 * 默认: 9500 平原 邺 40
 *
 * 演练中反复出现「消耗战:平原→邺(9959/10000)」——兵力已接近 1:1 却始终拿不下。
 * 本脚本直接用真实 BattleEngine 反复推演，量化胜率，
 * 判断这到底是「需要更多波次」还是「结构性打不动」。
 */
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = Number(process.argv[2] || 9500);
const FROM = process.argv[3] || '平原';
const TO = process.argv[4] || '邺';
const N = Number(process.argv[5] || 40);

const t = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((x) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, (m) => r(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };

// 需要地图场景已就绪
const ready = await ev(`(() => { const g = window.__SG3__.game; const ms = g.scene.getScene('MapScene');
  return !!(ms && ms.scene.isActive()); })()`);
if (!ready) {
  await ev(`(() => { const g = window.__SG3__.game; const GD = window.__SG3__.GameData;
    GD.initCustomFaction('赵轩','龙吟',0xd4a017,{force:95,intellect:88,politics:80,command:92,charisma:90},'changan',
      {name:'龙魂破',desc:'x',power:1.5,spCost:40});
    for (const k of ['MenuScene','BattleScene']) { const s = g.scene.getScene(k); if (s && s.scene.isActive()) g.scene.stop(k); }
    g.scene.start('MapScene'); return true; })()`);
  await sleep(2000);
}

const info = await ev(`(() => {
  const GD = window.__SG3__.GameData;
  const f = Object.values(GD.cities).find(c => c.name === ${JSON.stringify(FROM)});
  const t = Object.values(GD.cities).find(c => c.name === ${JSON.stringify(TO)});
  if (!f || !t) return { error: '找不到城市' };
  const mk = (c) => { const hs = c.heroes.map(h => GD.heroes[h]).filter(Boolean)
      .sort((a,b) => b.troops - a.troops).slice(0,5);
    return { name: c.name, max: c.maxTroops, heroes: c.heroes.length,
      top5: hs.map(h => h.troops), troops: hs.reduce((s,h) => s + h.troops, 0) }; };
  return { from: mk(f), to: mk(t), engineMax: 5 };
})()`);
console.log(`进攻方 ${info.from.name}: 武将${info.from.heroes} 前5兵力=${JSON.stringify(info.from.top5)} 合计=${info.from.troops} 上限=${info.from.max}`);
console.log(`防守方 ${info.to.name}: 武将${info.to.heroes} 前5兵力=${JSON.stringify(info.to.top5)} 合计=${info.to.troops} 上限=${info.to.max}`);
console.log(`兵力比: ${(info.from.troops / Math.max(1, info.to.troops)).toFixed(2)}\n`);

// 用真实引擎反复推演（每轮独立复制武将状态，避免相互污染）
const result = await ev(`(() => {
  const GD = window.__SG3__.GameData;
  const BE = window.__SG3__.BattleEngine;
  const from = Object.values(GD.cities).find(c => c.name === ${JSON.stringify(FROM)});
  const to = Object.values(GD.cities).find(c => c.name === ${JSON.stringify(TO)});
  // 快照
  const snap = {};
  for (const hid in GD.heroes) snap[hid] = { troops: GD.heroes[hid].troops, maxTroops: GD.heroes[hid].maxTroops };
  const restore = () => { for (const hid in snap) { if (GD.heroes[hid]) { GD.heroes[hid].troops = snap[hid].troops; GD.heroes[hid].maxTroops = snap[hid].maxTroops; } } };

  const atkIds = from.heroes.map(h => GD.heroes[h]).filter(Boolean)
    .sort((a,b) => b.troops - a.troops).slice(0,5).map(h => h.id);
  const defIds = to.heroes.map(h => GD.heroes[h]).filter(Boolean)
    .sort((a,b) => b.troops - a.troops).slice(0,5).map(h => h.id);

  let win = 0, rounds = [];
  for (let i = 0; i < ${N}; i++) {
    restore();
    const st = BE.init(atkIds, defIds, from.faction, to.faction);
    let guard = 300;
    while (st.phase !== 'ended' && guard-- > 0) BE.step();
    if (st.phase !== 'ended') BE.forceEndByTimeout();
    if (st.winner === 'attacker') win++;
    rounds.push(st.round || 0);
  }
  restore();
  return { win, total: ${N}, avgRound: (rounds.reduce((s,r)=>s+r,0)/rounds.length).toFixed(1) };
})()`);

console.log(`真实引擎推演 ${result.total} 次: 攻方胜 ${result.win} 次 (${(result.win / result.total * 100).toFixed(0)}%)，平均 ${result.avgRound} 回合`);
console.log(result.win === 0
  ? '→ 结构性打不动：即使兵力接近 1:1，单波也无法取胜，需要更多波次或更高兵力。'
  : result.win / result.total >= 0.5
    ? '→ 有胜算：多试几波即可攻克，属于概率问题而非设计缺陷。'
    : '→ 胜率偏低：需要先削弱守军或提升兵力再攻。');
ws.close(); await sleep(50);