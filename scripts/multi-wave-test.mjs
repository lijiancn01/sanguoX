/**
 * 无头验证：单城上限不足时，「同回合多波次攻击」能否通过消耗战破墙。
 * 场景取自真实卡点：许昌 maxTroops=12000，相邻城市上限仅 9000/7000。
 */
import { setTimeout as sleep } from 'node:timers/promises';
import GD from '../src/core/GameData.js';
import Engine, { setGameData } from '../src/core/BattleEngine.js';

GD.init();
setGameData(GD);

const TARGET = 'xuchang';
const target = GD.cities[TARGET];

/** 把某城守军补满到 maxTroops */
function fillCity(cityId, total) {
  const c = GD.cities[cityId];
  let budget = total;
  for (const hid of c.heroes) {
    const h = GD.heroes[hid];
    const give = Math.min(h.maxTroops, budget);
    h.troops = give; h.hp = 100;
    budget -= give;
  }
  c.troops = GD.getCityTotalTroops(cityId);
}

/** 执行一场战斗并按真实流程结算 */
function fight(atkIds, defIds, atkFaction, fromCity) {
  Engine.init(atkIds, defIds, atkFaction, target.faction);
  GD.battle = { attackerFaction: atkFaction, defenderFaction: target.faction,
    attackerHeroIds: atkIds.slice(), defenderHeroIds: defIds.slice(),
    targetCity: TARGET, fromCity };
  let guard = 0;
  while (Engine.state.phase !== 'ended' && guard++ < 500) Engine.step();
  const res = Engine.getResult();
  Engine.applyResult();
  return res;
}

const atkFaction = 'test';
// 攻方武将：直接选三名高上限武将充当两波攻方（模拟两座已方城市）
const pool = Object.values(GD.heroes).filter((h) => h.maxTroops >= 6000).slice(0, 4);
const wave1 = pool.slice(0, 2).map((h) => h.id);
const wave2 = pool.slice(2, 4).map((h) => h.id);
for (const id of wave1) { GD.heroes[id].troops = GD.heroes[id].maxTroops; GD.heroes[id].hp = 100; }
for (const id of wave2) { GD.heroes[id].troops = GD.heroes[id].maxTroops; GD.heroes[id].hp = 100; }
console.log('波次1 武将:', wave1.map((h) => GD.heroes[h].name + '/' + GD.heroes[h].troops).join(' '));
console.log('波次2 武将:', wave2.map((h) => GD.heroes[h].name + '/' + GD.heroes[h].troops).join(' '));

fillCity(TARGET, 12000);
console.log('\n许昌守军补满 =', GD.getCityTotalTroops(TARGET), '（maxTroops', target.maxTroops, '）');
console.log('许昌守将:', target.heroes.map((h) => GD.heroes[h].name + '/' + GD.heroes[h].maxTroops).join(' '));

for (let round = 1; round <= 3; round++) {
  console.log(`\n===== 第 ${round} 回合 =====`);
  const before = GD.getCityTotalTroops(TARGET);
  const defIds = GD.cities[TARGET].heroes.slice();

  // 波次 1
  if (GD.cities[TARGET].faction !== atkFaction && wave1.some((h) => GD.heroes[h].troops > 0)) {
    const my1 = wave1.reduce((s, h) => s + GD.heroes[h].troops, 0);
    const r1 = fight(wave1, defIds, atkFaction, 'shouchun');
    console.log(`  波1 攻${my1} vs 守${before} → ${r1.winner}` +
      ` 守军剩 ${GD.getCityTotalTroops(TARGET)} 归属 ${GD.cities[TARGET].faction}`);
  }

  // 波次 2（若第一波未能占领）
  if (GD.cities[TARGET].faction !== atkFaction && wave2.some((h) => GD.heroes[h].troops > 0)) {
    const my2 = wave2.reduce((s, h) => s + GD.heroes[h].troops, 0);
    const def2 = GD.cities[TARGET].heroes.slice();
    const r2 = fight(wave2, def2, atkFaction, 'xiaopei');
    console.log(`  波2 攻${my2} vs 守${GD.getCityTotalTroops(TARGET) + my2 * 0} → ${r2.winner}` +
      ` 守军剩 ${GD.getCityTotalTroops(TARGET)} 归属 ${GD.cities[TARGET].faction}`);
  }

  if (GD.cities[TARGET].faction === atkFaction) { console.log('  ✓ 许昌已被攻克'); break; }

  // 回合恢复：5% of maxTroops 分配给城内武将
  const rec = Math.floor(target.maxTroops * 0.05);
  const alive = GD.cities[TARGET].heroes.map((h) => GD.heroes[h]);
  for (const h of alive) h.troops = Math.min(h.maxTroops, h.troops + Math.ceil(rec / alive.length));
  console.log(`  回合恢复 +${rec} → 守军 ${GD.getCityTotalTroops(TARGET)}`);
  // 攻方也恢复（代表重新征兵）
  for (const id of wave1.concat(wave2)) {
    GD.heroes[id].troops = GD.heroes[id].maxTroops;
    GD.heroes[id].hp = 100;
  }
}