/**
 * 校验势力数据的一致性。
 *
 * 拆分「群雄」后势力变多，最容易出的问题是「空壳势力」（有颜色有金粮但没有任何城池）
 * 与「武将/城池势力不一致」（武将 faction 与其所在城池 faction 不同）。
 * 这两类问题在游戏里表现为：该势力永远不出手、或武将一开局就被判为在野。
 *
 * 用法: node scripts/check-factions.mjs
 */
import { CITIES_DATA } from '../src/data/cities.js';
import { HEROES_DATA } from '../src/data/heroes.js';
import { FACTION_COLORS, FACTION_NAMES, BUILTIN_FACTION_IDS, INITIAL_FACTION_TREASURY } from '../src/core/config.js';

let fail = 0;
const err = (m) => { console.log('  ✗ ' + m); fail++; };

// ===== 1. 配置完整性：每个内置势力都要有色、有名、有初始金粮 =====
console.log('1. 势力配置完整性');
for (const id of BUILTIN_FACTION_IDS) {
  if (FACTION_COLORS[id] === undefined) err(`势力 ${id} 缺少 FACTION_COLORS`);
  if (FACTION_NAMES[id] === undefined) err(`势力 ${id} 缺少 FACTION_NAMES`);
  if (!INITIAL_FACTION_TREASURY[id]) err(`势力 ${id} 缺少 INITIAL_FACTION_TREASURY`);
}
console.log(`  内置势力 ${BUILTIN_FACTION_IDS.length} 个: ${BUILTIN_FACTION_IDS.join(', ')}`);
if (fail === 0) console.log('  ✓ 配置完整');

// ===== 2. 每个内置势力至少拥有一座城 =====
console.log('\n2. 空壳势力检查（有势力无城池）');
const cityByFaction = {};
for (const c of CITIES_DATA) {
  cityByFaction[c.faction] = (cityByFaction[c.faction] || 0) + 1;
}
for (const id of BUILTIN_FACTION_IDS) {
  const n = cityByFaction[id] || 0;
  if (n === 0) err(`势力 ${id}(${FACTION_NAMES[id]}) 没有任何城池 —— 会成为永不行动的空壳势力`);
  else console.log(`  ${id.padEnd(10)} ${String(FACTION_NAMES[id]).padEnd(6)} ${n} 城`);
}

// ===== 3. 武将 faction 必须与其所在地城池一致 =====
console.log('\n3. 武将 / 城池势力一致性');
const heroLoc = {};
for (const c of CITIES_DATA) {
  for (const hid of (c.heroes || [])) {
    if (heroLoc[hid]) err(`武将 ${hid} 同时出现在 ${heroLoc[hid]} 与 ${c.id}`);
    heroLoc[hid] = c.id;
  }
}
for (const h of HEROES_DATA) {
  const loc = heroLoc[h.id];
  if (!loc) {
    // 无城池的武将必须是「在野」，否则永远无法被招募（search 只找 faction==='none'）
    if (h.faction !== 'none') {
      err(`武将 ${h.name}(${h.id}) 势力为 ${h.faction} 但不属于任何城池 —— 永远无法登场`);
    } else {
      console.log(`  ${h.name} 为在野无城（可被搜索招募）`);
    }
    continue;
  }
  const city = CITIES_DATA.find((c) => c.id === loc);
  if (city.faction !== h.faction) {
    err(`武将 ${h.name}(${h.id}) 势力=${h.faction}，但所在城池 ${city.name} 势力=${city.faction}`);
  }
}
if (fail === 0) console.log('  ✓ 全部一致');

// ===== 4. 势力初始金粮合计（便于核对平衡性） =====
console.log('\n4. 各势力初始资源');
for (const id of BUILTIN_FACTION_IDS) {
  const t = INITIAL_FACTION_TREASURY[id];
  const cities = cityByFaction[id] || 0;
  const goldIncome = CITIES_DATA.filter((c) => c.faction === id)
    .reduce((s, c) => s + Math.floor(c.commerce / 10), 0);
  const foodIncome = CITIES_DATA.filter((c) => c.faction === id)
    .reduce((s, c) => s + Math.floor(c.agriculture / 10), 0);
  console.log(`  ${id.padEnd(10)} 城${String(cities).padStart(2)}  初始金${String(t.gold).padStart(4)} 粮${String(t.food).padStart(4)}` +
    `  每回合 +${goldIncome}金 +${foodIncome}粮`);
}

console.log(`\n在野城市 ${cityByFaction['none'] || 0} 座`);
console.log(fail === 0 ? '\n结论: 势力数据一致，无空壳势力、无错位武将。' : `\n结论: 发现 ${fail} 个问题。`);
process.exit(fail === 0 ? 0 : 1);