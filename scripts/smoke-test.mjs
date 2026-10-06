/**
 * 前端模块装配冒烟测试（不依赖浏览器与 WebView）。
 *
 * 目的：在真实运行时之前，验证 ESM 依赖图能完整解析、
 * 无循环依赖导致的 undefined、且 GameData 与两个引擎的注入契约成立。
 *
 * Phaser 依赖 window/document，故用最小 DOM 桩替代。
 */
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// 本脚本位于 <repo>/scripts/，源码根为 <repo>/src
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

// --- 最小 DOM / 浏览器桩，仅为让 Phaser 能被 import ---
const noop = () => {};
const fakeEl = () => ({
  style: {}, appendChild: noop, removeChild: noop, addEventListener: noop,
  removeEventListener: noop, setAttribute: noop, getContext: () => null,
  querySelector: () => null, querySelectorAll: () => [], remove: noop,
  classList: { add: noop, remove: noop, contains: () => false }
});
globalThis.window = globalThis;
globalThis.document = {
  createElement: fakeEl, createElementNS: fakeEl,
  getElementById: () => null, querySelector: () => null,
  querySelectorAll: () => [], addEventListener: noop,
  removeEventListener: noop, body: fakeEl(), head: fakeEl(),
  documentElement: fakeEl(), readyState: 'complete'
};
// Node 18+ 内置只读的 navigator，需用 defineProperty 覆盖
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'node', maxTouchPoints: 0 },
  configurable: true, writable: true
});
globalThis.location = { href: 'http://localhost/', protocol: 'http:' };
globalThis.HTMLCanvasElement = class {};
globalThis.Image = class {};
globalThis.URL.createObjectURL = () => 'blob:x';
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.performance = globalThis.performance || { now: () => Date.now() };

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
}

// --- 1. 逐个导入引擎无关层模块 ---
const load = async (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

let GameData, AIController, BattleEngine, configMod, storageMod, dialogMod;
try {
  configMod = await load('core/config.js');
  GameData = (await load('core/GameData.js')).default;
  AIController = (await load('core/AIController.js')).default;
  BattleEngine = (await load('core/BattleEngine.js')).default;
  storageMod = await load('platform/storage.js');
  dialogMod = await load('platform/dialog.js');
  check('核心模块全部导入成功', true, Object.keys(configMod).length + ' 个导出');
} catch (e) {
  check('核心模块全部导入成功', false, String(e));
  console.log(JSON.stringify({ results }, null, 2));
  process.exit(1);
}

// --- 2. 校验平台层契约 ---
check('storage 暴露 saveGame/loadGame/hasSave', 
  typeof storageMod.saveGame === 'function' &&
  typeof storageMod.loadGame === 'function' &&
  typeof storageMod.hasSave === 'function');
check('dialog 暴露 promptText/confirmDialog/notify',
  typeof dialogMod.promptText === 'function' &&
  typeof dialogMod.confirmDialog === 'function' &&
  typeof dialogMod.notify === 'function');
check('config 暴露 registerCustomFaction', typeof configMod.registerCustomFaction === 'function');

// --- 3. 装配依赖（与 main.js 同序）---
try {
  const { setGameData: setAI } = await load('core/AIController.js');
  const { setGameData: setBE } = await load('core/BattleEngine.js');
  const { registerEngine } = await load('core/GameData.js');
  check('registerEngine 为具名导出', typeof registerEngine === 'function');
  setAI(GameData);
  setBE(GameData);
  registerEngine({ ai: AIController, battle: BattleEngine });
  check('依赖注入完成', true);
} catch (e) {
  check('依赖注入完成', false, String(e));
}

// --- 4. GameData 初始化与数据完整性 ---
try {
  GameData.init();
  const cityCount = Object.keys(GameData.cities).length;
  const heroCount = Object.keys(GameData.heroes).length;
  check('GameData.init 生成城市', cityCount > 0, cityCount + ' 城');
  check('GameData.init 生成武将', heroCount > 0, heroCount + ' 将');

  // 邻接引用完整性（历史上出过悬空引用）
  let dangling = 0;
  for (const id of Object.keys(GameData.cities)) {
    for (const adj of (GameData.cities[id].adjacent || [])) {
      if (!GameData.cities[adj]) dangling++;
    }
  }
  check('城池邻接无悬空引用', dangling === 0, dangling + ' 处悬空');

  // 城池武将引用完整性
  let badHero = 0;
  for (const id of Object.keys(GameData.cities)) {
    for (const hid of (GameData.cities[id].heroes || [])) {
      if (!GameData.heroes[hid]) badHero++;
    }
  }
  check('城池武将引用有效', badHero === 0, badHero + ' 处无效');
} catch (e) {
  check('GameData.init 正常', false, String(e));
}

// --- 5. 序列化往返（存档核心路径）---
try {
  const json = GameData.toJSON();
  const round = GameData.fromJSON(JSON.parse(JSON.stringify(json)));
  check('toJSON/fromJSON 往返成功', round && round.ok === true, round && round.msg);
} catch (e) {
  check('toJSON/fromJSON 往返成功', false, String(e));
}

// --- 6. 战斗引擎可初始化并可推进 ---
try {
  GameData.init();
  const myCity = Object.values(GameData.cities).find(
    (c) => c.faction === GameData.playerFaction && c.heroes.length > 0
  );
  const enemyCity = Object.values(GameData.cities).find(
    (c) => c.faction !== GameData.playerFaction && c.faction !== 'none' && c.heroes.length > 0
  );
  if (myCity && enemyCity) {
    BattleEngine.init(myCity.heroes, enemyCity.heroes, myCity.faction, enemyCity.faction);
    const st = BattleEngine.state;
    check('BattleEngine.init 建立双方部队',
      st.attacker.heroes.length > 0 && st.defender.heroes.length > 0,
      st.attacker.heroes.length + ' vs ' + st.defender.heroes.length);

    // 推进若干回合，确认不抛错且有日志
    let steps = 0;
    for (let i = 0; i < 30 && !BattleEngine.isOver(); i++) {
      BattleEngine.step();
      steps++;
    }
    check('BattleEngine.step 可推进', steps > 0, steps + ' 回合');
  } else {
    check('找到可用于战斗的城池', false, '未找到合适城池');
  }
} catch (e) {
  check('BattleEngine 战斗流程', false, String(e));
}

// --- 7. AI 回合可执行 ---
try {
  GameData.init();
  const aiFaction = Object.keys(GameData.factions).find(
    (f) => f !== GameData.playerFaction
  );
  AIController.takeTurn(aiFaction);
  check('AIController.takeTurn 无异常', true, aiFaction);
} catch (e) {
  check('AIController.takeTurn 无异常', false, String(e));
}

// --- 输出 ---
const pass = results.filter((r) => r.pass).length;
const fail = results.length - pass;
console.log('smoke: %d/%d passed, %d failed', pass, results.length, fail);
for (const r of results) {
  console.log('  %s %s%s', r.pass ? 'PASS' : 'FAIL', r.name,
    r.pass ? '' : '  -> ' + r.detail);
}
process.exit(fail === 0 ? 0 : 2);
