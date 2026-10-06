/**
 * 无头验证：反复以「较弱兵力」进攻同一座大城，守军是否会被真正削弱。
 * 结论用于判断「单城兵力上限不足」是硬墙，还是可用消耗战突破。
 */
import { setTimeout as sleep } from 'node:timers/promises';
import GD from '../src/core/GameData.js';
import Engine, { setGameData } from '../src/core/BattleEngine.js';

GD.init();
setGameData(GD);

const TARGET = 'xuchang';
const target = GD.cities[TARGET];
console.log('目标:', target.name, 'maxTroops=', target.maxTroops, '守将=', target.heroes);
for (const hid of target.heroes) {
  const h = GD.heroes[hid];
  console.log('   ', h.name, 'maxTroops=', h.maxTroops, 'troops=', h.troops, 'hp=', h.hp);
}
console.log('守军总兵力:', GD.getCityTotalTroops(TARGET));

// 攻方：模拟一座 maxTroops=9000 的城市，用 3 名武将凑满
const atkIds = ['dianwei', 'zhangliao', 'xuchu'].filter((h) => GD.heroes[h]);
console.log('\n攻方武将:', atkIds.map((h) => GD.heroes[h].name + '(' + GD.heroes[h].maxTroops + ')').join(' '));

for (let wave = 1; wave <= 5; wave++) {
  const before = GD.getCityTotalTroops(TARGET);
  // 攻方兵力 = min(9000, ΣmaxTroops)
  let budget = 9000;
  for (const hid of atkIds) {
    const h = GD.heroes[hid];
    const give = Math.min(h.maxTroops, budget);
    h.troops = give; h.hp = 100; budget -= give;
  }
  const atkTroops = atkIds.reduce((s, h) => s + GD.heroes[h].troops, 0);

  // Engine.init 接收的是「武将 ID 数组」（BattleScene 亦如此），不是武将对象
  Engine.init(atkIds, target.heroes.slice(), 'test', target.faction);
  // applyResult 依赖 gd.battle 定位目标城市，这里按真实流程补上
  GD.battle = { attackerFaction: 'test', defenderFaction: target.faction,
    attackerHeroIds: atkIds.slice(), defenderHeroIds: target.heroes.slice(),
    targetCity: TARGET, fromCity: 'shouchun' };
  let guard = 0;
  while (Engine.state.phase !== 'ended' && guard++ < 500) {
    Engine.step();
    await sleep(0);
  }
  const res = Engine.getResult();
  console.log('    [调试] winner=' + (res && res.winner)
    + ' atk伤亡=' + JSON.stringify(res && res.attackerCasualties)
    + ' def伤亡=' + JSON.stringify(res && res.defenderCasualties));
  Engine.applyResult();
  const after = GD.getCityTotalTroops(TARGET);
  console.log(`第${wave}波 攻${atkTroops} vs 守${before} → 胜者=${res ? res.winner : '?'}` +
    ` 守军剩余=${after} (净减 ${before - after}) 城归属=${GD.cities[TARGET].faction}`);
  if (GD.cities[TARGET].faction === 'test') { console.log('  已攻克，消耗战可行'); break; }
  if (after === 0) { console.log('  守军已被打空'); break; }
}

// 每回合恢复量
const recover = Math.floor(target.maxTroops * 0.05);
console.log(`\n目标城每回合恢复上限 = ${recover}（maxTroops ${target.maxTroops} × 5%）`);