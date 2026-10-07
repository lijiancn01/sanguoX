/**
 * 校验程序化人物立绘的特征分配。
 *
 * 立绘全部现场绘制、没有图片文件，因此不能用「文件是否存在」来验证。
 * 真正要保证的是两件事：
 *   1. 确定性：同一人物每次得到同一套特征（否则玩家每次开局面孔都在变）；
 *   2. 区分度：不同人物不能长得一样（否则等于没做立绘）。
 * 本脚本用 Graphics 桩对象无头执行绘制，并统计特征分布。
 *
 * 用法: node scripts/check-portraits.mjs
 */
import { HEROES_DATA } from '../src/data/heroes.js';
import { FACTION_COLORS } from '../src/core/config.js';
import { getHeroAppearance, describeAppearance, drawHeroAvatar } from '../src/core/portraits.js';

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

// --- Graphics 桩：只记录调用，不依赖 Phaser ---
function makeStub() {
  const calls = [];
  const rec = (m) => (...a) => { calls.push({ m, a }); return undefined; };
  return {
    calls,
    fillStyle: rec('fillStyle'),
    fillRect: rec('fillRect'),
    fillRoundedRect: rec('fillRoundedRect'),
    fillEllipse: rec('fillEllipse'),
    fillCircle: rec('fillCircle'),
    fillTriangle: rec('fillTriangle'),
    lineStyle: rec('lineStyle'),
    beginPath: rec('beginPath'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    arc: rec('arc'),
    strokePath: rec('strokePath')
  };
}

console.log('=== 1. 绘制不抛异常且确实画了东西 ===');
let drawOk = 0;
for (const h of HEROES_DATA) {
  const g = makeStub();
  try {
    drawHeroAvatar(g, 0, 0, 30, h, FACTION_COLORS[h.faction] || 0x888888);
    if (g.calls.length > 0) drawOk++;
  } catch (e) {
    console.log(`    ${h.name} 绘制抛异常: ${e.message}`);
  }
}
check(`全部 ${HEROES_DATA.length} 名武将绘制成功`, drawOk === HEROES_DATA.length, `成功 ${drawOk}`);

// 不同尺寸都要成立（30 城市面板 / 20 出征面板）
let sizeOk = true;
for (const size of [20, 30, 40]) {
  const g = makeStub();
  try { drawHeroAvatar(g, 0, 0, size, HEROES_DATA[0], 0x4488cc); }
  catch (e) { sizeOk = false; console.log(`    size=${size} 失败: ${e.message}`); }
}
check('20/30/40 三种尺寸均可绘制', sizeOk);

console.log('\n=== 2. 确定性：同一人物两次结果一致 ===');
let detOk = true;
for (const h of HEROES_DATA) {
  const a = describeAppearance(h, FACTION_COLORS[h.faction] || 0x888888);
  const b = describeAppearance(h, FACTION_COLORS[h.faction] || 0x888888);
  if (a !== b) { detOk = false; console.log(`    ${h.name} 两次不一致`); }
}
check('全部武将外观可复现', detOk);

// 与 hero 对象的其他字段无关：只依赖 id
const probe = { ...HEROES_DATA[0], troops: 99999, hp: 1, status: 'marches' };
check('外观不受运行时状态影响',
  describeAppearance(HEROES_DATA[0], 0x4488cc) === describeAppearance(probe, 0x4488cc));

console.log('\n=== 3. 区分度：外观指纹不能重复 ===');
const seen = new Map();
let dup = 0;
for (const h of HEROES_DATA) {
  const sig = describeAppearance(h, FACTION_COLORS[h.faction] || 0x888888);
  if (seen.has(sig)) {
    dup++;
    console.log(`    重复: ${seen.get(sig)} 与 ${h.name}`);
  } else {
    seen.set(sig, h.name);
  }
}
check(`无外观完全相同的人物（共 ${HEROES_DATA.length} 人，唯一 ${seen.size}）`, dup === 0, `${dup} 组重复`);

console.log('\n=== 4. 著名人物的标志性特征 ===');
const expect = {
  guanyu:    (a) => a.beard === 'long',
  xiahoudun: (a) => a.eyepatch === true,
  lvbu:      (a) => a.plumes === true,
  diaochan:  (a) => a.gender === 'female' && a.beard === 'none',
  liubei:    (a) => a.bigEars === true,
  sunquan:   (a) => a.beardColor === 0x7a3a8a,   // 紫髯
  zhangjiao: (a) => a.head === 'straw',
  menghuo:   (a) => a.accessory === 'plume',
  zhugeliang:(a) => a.accessory === 'fan',
  ganning:   (a) => a.bells === true,
  huangzhong:(a) => a.hair === 0x9a9a9a        // 老将白发
};
for (const [id, fn] of Object.entries(expect)) {
  const h = HEROES_DATA.find((x) => x.id === id);
  if (!h) { check(`${id} 存在`, false); continue; }
  const a = getHeroAppearance(h, FACTION_COLORS[h.faction] || 0x888888);
  check(`${h.name} 标志性特征`, fn(a), JSON.stringify(a));
}

console.log('\n=== 5. 势力色参与形象（可看出归属） ===');
const caocao = HEROES_DATA.find((h) => h.id === 'caocao');
const asWei = getHeroAppearance(caocao, FACTION_COLORS.wei);
const asWu = getHeroAppearance(caocao, FACTION_COLORS.wu);
check('同一人物换势力色时底色随之改变', asWei.factionTint !== asWu.factionTint);

console.log('\n=== 6. 自定义君主也有冠冕 ===');
const monarch = { id: 'custom_test', name: '测试君主', faction: 'custom_x', isMonarch: true, force: 50, intellect: 50 };
const ma = getHeroAppearance(monarch, 0xe8c020);
check('自定义君主戴冠', ma.head === 'crown', ma.head);
const plain = { id: 'custom_test2', name: '普通武将', faction: 'custom_x', isMonarch: false, force: 50, intellect: 50 };
check('非君主不强制戴冠', getHeroAppearance(plain, 0xe8c020).head !== 'crown');

console.log('\n=== 7. 女相不画胡须 ===');
let femaleOk = true;
for (const h of HEROES_DATA) {
  const a = getHeroAppearance(h, FACTION_COLORS[h.faction] || 0x888888);
  if (a.gender === 'female' && a.beard !== 'none') { femaleOk = false; console.log(`    ${h.name}`); }
}
check('女相均无须', femaleOk);

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);