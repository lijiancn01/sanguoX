/**
 * 无头验证：以劣势兵力（9000）进攻满编大城（12000）能否取胜。
 * 结论决定演练脚本里 `myTroops > targetTroops * 1.1` 这个门槛是否过严。
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

const pool = Object.values(GD.heroes).filter((h) => h.maxTroops >= 7000).slice(0, 3);
const atkIds = pool.map((h) => h.id);
console.log('攻方:', atkIds.map((h) => GD.heroes[h].name + '/' + GD.heroes[h].maxTroops).join(' '));

for (const atkTotal of [6000, 9000, 11000, 13200]) {
  let wins = 0;
  const N = 40;
  for (let i = 0; i < N; i++) {
    // 重置守军
    fill(TARGET, 12000);
    // 攻方按 atkTotal 分配
    let budget = atkTotal;
    for (const id of atkIds) {
      const h = GD.heroes[id];
      const give = Math.min(h.maxTroops, budget);
      h.troops = give; h.hp = 100; budget -= give;
    }
    const real = atkIds.reduce((s, h) => s + GD.heroes[h].troops, 0);
    Engine.init(atkIds, GD.cities[TARGET].heroes.slice(), 'test', target.faction);
    GD.battle = { attackerFaction: 'test', defenderFaction: target.faction,
      attackerHeroIds: atkIds.slice(), defenderHeroIds: GD.cities[TARGET].heroes.slice(),
      targetCity: TARGET, fromCity: 'shouchun' };
    let g = 0;
    while (Engine.state.phase !== 'ended' && g++ < 500) Engine.step();
    const r = Engine.getResult();
    if (r.winner === 'attacker') wins++;
    Engine.applyResult();
    if (i === 0) {
      const defLeft = r.defenderCasualties.reduce((s, c) => s + c.troops, 0);
      console.log(`  攻${real} vs 守12000 → ${r.winner}，守军残存兵力 ${defLeft}` +
        `（门槛要求 > ${Math.ceil(12000 * 1.1)}）`);
    }
  }
  console.log(`攻${atkTotal}: 胜率 ${wins}/${N} = ${(wins / N * 100).toFixed(0)}%\n`);
}