/**
 * 关键验证：同一回合第一波进攻「失败」后，
 * 第二波面对的是被削弱的守军（实时数据），还是满编守军。
 * 这决定「单城兵力上限不足」能否用同回合多波合击突破。
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

// 攻方全部取自许昌以外、且不与守将重叠的武将
const defIds = target.heroes.slice();
const pool = Object.values(GD.heroes)
  .filter((h) => h.maxTroops >= 4000 && defIds.indexOf(h.id) === -1)
  .slice(0, 8);
const wave1 = pool.slice(0, 3).map((h) => h.id);
const wave2 = pool.slice(3, 6).map((h) => h.id);
// 第一波刻意压低兵力，确保失败
for (const id of wave1) { GD.heroes[id].troops = 2000; GD.heroes[id].hp = 100; }
for (const id of wave2) { GD.heroes[id].troops = GD.heroes[id].maxTroops; GD.heroes[id].hp = 100; }

function run(ids, label) {
  const atk = ids.reduce((s, h) => s + GD.heroes[h].troops, 0);
  const defBefore = GD.getCityTotalTroops(TARGET);
  Engine.init(ids, GD.cities[TARGET].heroes.slice(), 'test', target.faction);
  GD.battle = { attackerFaction: 'test', defenderFaction: target.faction,
    attackerHeroIds: ids.slice(), defenderHeroIds: GD.cities[TARGET].heroes.slice(),
    targetCity: TARGET, fromCity: 'shouchun' };
  let g = 0;
  while (Engine.state.phase !== 'ended' && g++ < 500) Engine.step();
  const r = Engine.getResult();
  Engine.applyResult();
  console.log(`${label}: 攻${atk} vs 守${defBefore} → ${r.winner}` +
    ` | 守军 ${defBefore} → ${GD.getCityTotalTroops(TARGET)}` +
    ` | 城归属 ${GD.cities[TARGET].faction}`);
  return r.winner;
}

console.log('守将:', defIds.map((h) => GD.heroes[h].name + '/' + GD.heroes[h].troops).join(' '));
run(wave1, '第1波(弱)');
if (GD.cities[TARGET].faction !== 'test') run(wave2, '第2波(强)');
else console.log('第1波已攻克，无需第2波');