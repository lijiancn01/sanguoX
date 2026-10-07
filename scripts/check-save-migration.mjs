/**
 * 校验旧存档（含已被拆分掉的 'qun' 势力）能被正确迁移。
 *
 * 背景：旧版本把吕布/袁绍/张角/孟获统一记为 'qun'。拆分势力后该 id 不再存在，
 * 若读档时原样保留，这些城池会变成「不产资源、永不出手」的僵尸势力 —— 静默故障，
 * 不会报错，只能靠这种断言测试发现。
 *
 * 用法: node scripts/check-save-migration.mjs
 */
import GameData from '../src/core/GameData.js';
import { CITIES_DATA } from '../src/data/cities.js';
import { BUILTIN_FACTION_IDS, FACTION_NAMES } from '../src/core/config.js';

let fail = 0;
const check = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ ' + msg); fail++; }
};

// ===== 构造一个「旧版存档」：把新版里独立成军的城池重新压回 qun =====
const gd = GameData.init();
const legacyCities = CITIES_DATA.filter((c) => c.faction !== 'none' &&
  !['wei', 'shu', 'wu'].includes(c.faction)).map((c) => c.id);

console.log(`模拟旧存档：把 ${legacyCities.length} 座城压回 'qun'（${legacyCities.join(', ')}）\n`);

const old = gd.toJSON();
for (const cid of legacyCities) old.cities[cid].faction = 'qun';
// 武将同样压回 qun
for (const hid in old.heroes) {
  if (old.heroes[hid].faction !== 'none' && !['wei', 'shu', 'wu'].includes(old.heroes[hid].faction)) {
    old.heroes[hid].faction = 'qun';
  }
}
old.factions.qun = { gold: 200, food: 200 };
for (const f of ['lvbu', 'yuanshao', 'zhangjiao', 'menghuo']) delete old.factions[f];

// ===== 读档并验证 =====
const gd2 = GameData.init();
const res = gd2.fromJSON(old);
console.log('1. 读档');
check(res.ok, '读档成功');

console.log('\n2. 旧势力已清除');
check(!Object.prototype.hasOwnProperty.call(gd2.cities, '__none__'), '城市表结构正常');
const leftoverQun = Object.keys(gd2.cities).filter((c) => gd2.cities[c].faction === 'qun');
check(leftoverQun.length === 0, `没有城池残留 qun（实际 ${leftoverQun.length}）`);
const leftoverQunHero = Object.keys(gd2.heroes).filter((h) => gd2.heroes[h].faction === 'qun');
check(leftoverQunHero.length === 0, `没有武将残留 qun（实际 ${leftoverQunHero.length}）`);
check(!Object.prototype.hasOwnProperty.call(gd2.factions, 'qun'), 'factions 表中已删除 qun');

console.log('\n3. 新势力已补齐且都有城池');
for (const f of BUILTIN_FACTION_IDS) {
  check(!!gd2.factions[f], `factions 含 ${f}(${FACTION_NAMES[f]})`);
  const n = Object.keys(gd2.cities).filter((c) => gd2.cities[c].faction === f).length;
  check(n > 0, `${f}(${FACTION_NAMES[f]}) 有 ${n} 座城`);
}

console.log('\n4. 迁移后势力与数据初始归属一致');
let mismatch = 0;
for (const cid of legacyCities) {
  const expect = CITIES_DATA.find((c) => c.id === cid).faction;
  if (gd2.cities[cid].faction !== expect) {
    console.log(`    ${cid}: 期望 ${expect}，实际 ${gd2.cities[cid].faction}`);
    mismatch++;
  }
}
check(mismatch === 0, '所有被拆分的城池回到正确的势力');

console.log('\n5. 迁移后能正常产出资源（僵尸势力检测）');
for (const f of BUILTIN_FACTION_IDS) {
  const gold = gd2.getFactionGold(f);
  const food = gd2.getFactionFood(f);
  check(gold > 0 || food > 0, `${f}(${FACTION_NAMES[f]}) 每回合 +${gold}金 +${food}粮`);
}

console.log('\n6. 迁移提示已记录');
console.log(`   _migrationNote: ${gd2._migrationNote || '(无)'}`);

// ===== 7. 已被玩家攻占的城池不应被迁移覆盖 =====
console.log('\n7. 已攻占城池不被错误迁移');
const gd3 = GameData.init();
const old2 = gd3.toJSON();
// 模拟：玩家（wei）已攻占原属 qun 的南中
old2.cities['nanzhong'].faction = 'wei';
for (const hid in old2.heroes) {
  if (old2.heroes[hid].faction === 'menghuo') old2.heroes[hid].faction = 'qun';
}
const gd4 = GameData.init();
gd4.fromJSON(old2);
check(gd4.cities['nanzhong'].faction === 'wei', '玩家已攻占的南中仍属 wei（未被迁移改写）');

console.log(fail === 0 ? '\n结论: 旧存档迁移正确。' : `\n结论: 发现 ${fail} 个问题。`);
process.exit(fail === 0 ? 0 : 1);