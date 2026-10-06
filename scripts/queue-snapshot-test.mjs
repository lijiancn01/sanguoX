/**
 * 无头验证：同一回合两波攻方先后抵达同一目标时，
 * 第二波面对的是「第一波打残后的守军」还是「入队时快照的满编守军」。
 */
import GD from '../src/core/GameData.js';
import Engine, { setGameData } from '../src/core/BattleEngine.js';

GD.init();
setGameData(GD);

const TARGET = 'xuchang';
const target = GD.cities[TARGET];
function fill(cityId, total) {
  const c = GD.cities[cityId];
  let budget = total;
  for (const hid of c.heroes) {
    const h = GD.heroes[hid];
    const give = Math.min(h.maxTroops, budget);
    h.troops = give; h.hp = 100; budget -= give;
  }
  c.troops = GD.getCityTotalTroops(cityId);
}
fill(TARGET, 12000);

const pool = Object.values(GD.heroes).filter((h) => h.maxTroops >= 5000).slice(0, 6);
if (pool.length < 6) { console.log('可用武将不足 6 名，实际', pool.length); }
const wave1 = pool.slice(0, 3).map((h) => h.id);
const wave2 = pool.slice(3, 6).map((h) => h.id);
for (const h of pool) { h.troops = h.maxTroops; h.hp = 100; }

// 模拟 GameData._armyArrive 对两波军队入队（关键：入队时快照守将）
GD.playerFaction = 'test';
GD.battleQueue = [];
for (const w of [wave1, wave2]) {
  GD.battleQueue.push({
    attackerFaction: 'test', defenderFaction: target.faction,
    attackerHeroIds: w.slice(),
    defenderHeroIds: GD.cities[TARGET].heroes.slice(),  // ← 入队时快照
    targetCity: TARGET, fromCity: 'shouchun'
  });
}
console.log('入队两波，守将快照:',
  GD.battleQueue.map((b) => b.defenderHeroIds.map((h) => GD.heroes[h].name + '/' + GD.heroes[h].troops).join('+')).join(' | '));

GD._syncBattleHead();
let n = 0;
while (GD.battle) {
  const b = GD.battle;
  n++;
  const atkTroops = b.attackerHeroIds.reduce((s, h) => s + GD.heroes[h].troops, 0);
  const defTroops = b.defenderHeroIds.reduce((s, h) => s + GD.heroes[h].troops, 0);
  console.log(`\n第${n}场: 攻${atkTroops}(${b.attackerHeroIds.map((h) => GD.heroes[h].name).join('+')})` +
    ` vs 守${defTroops}(${b.defenderHeroIds.map((h) => GD.heroes[h].name + '/' + GD.heroes[h].troops).join('+')})` +
    ` 实际城守军=${GD.getCityTotalTroops(TARGET)}`);

  Engine.init(b.attackerHeroIds, b.defenderHeroIds, b.attackerFaction, b.defenderFaction);
  let g = 0;
  while (Engine.state.phase !== 'ended' && g++ < 500) Engine.step();
  const r = Engine.getResult();
  Engine.applyResult();
  console.log(`  → ${r.winner}，城归属 ${GD.cities[TARGET].faction}` +
    ` 实际城守军=${GD.getCityTotalTroops(TARGET)}`);
  if (n > 4) break;
}