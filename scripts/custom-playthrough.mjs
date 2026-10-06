/**
 * 三国群英传 - 「自定义君主 → 出征 → 逐城攻占」端到端演练。
 *
 * 与 flow-check.mjs 的区别：本脚本不直接调用业务方法推进流程，而是通过 CDP 向
 * WebView2 派发真实鼠标/键盘事件，驱动 Phaser 的交互对象（Zone / Text / 城池
 * 图标 / 面板按钮）与 platform/dialog 的 DOM 覆盖层。验证的是
 * 「玩家真的能点出来」这条链路，而不是「函数能被调用」。
 *
 * 用法：
 *   node scripts/custom-playthrough.mjs <cdpPort> [--turns N] [--minutes M] [--probe]
 *
 * 前置：桌面进程带
 *   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>
 * @author jian.li
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';

const CDP_PORT = Number(process.argv.find((a) => /^\d+$/.test(a)) || 9500);
const PROBE = process.argv.includes('--probe');
const argOf = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? Number(process.argv[i + 1]) : dflt;
};
const MAX_TURNS = argOf('--turns', 200);
const BUDGET_MS = argOf('--minutes', 25) * 60 * 1000;
const STARTED_AT = Date.now();
const SHOT_PREFIX = 'scripts/playthrough';

// ---------------------------------------------------------------- CDP 客户端

async function getPageTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      const t = (await res.json()).find((x) => x.type === 'page');
      if (t) return t;
    } catch { /* 等待端点就绪 */ }
    await sleep(500);
  }
  throw new Error(`未找到 CDP page 目标（端口 ${CDP_PORT}）`);
}

const page = await getPageTarget();
console.log(`target: ${page.title} ${page.url}`);
const ws = new WebSocket(page.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
const runtimeErrors = [];

ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') {
    runtimeErrors.push('exception: ' + (m.params.exceptionDetails?.exception?.description
      || m.params.exceptionDetails?.text));
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    runtimeErrors.push('log: ' + m.params.entry.text);
  }
});

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await new Promise((r) => ws.addEventListener('open', r, { once: true }));
await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await sleep(800);

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text + ' '
      + (r.exceptionDetails.exception?.description || ''));
  }
  return r.result.value;
}

// ------------------------------------------------------------ 真实输入派发

let rectCache = null;
/** 读取 canvas 视口矩形与逻辑分辨率，用于游戏坐标 → 视口坐标换算 */
async function canvasRect(force) {
  if (rectCache && !force) return rectCache;
  rectCache = await evaluate(`(() => {
    const g = window.__SG3__ && window.__SG3__.game;
    if (!g) return null;
    const r = g.canvas.getBoundingClientRect();
    return {
      left: r.left, top: r.top, width: r.width, height: r.height,
      gw: g.scale.gameSize.width, gh: g.scale.gameSize.height
    };
  })()`);
  return rectCache;
}

async function clickGame(gx, gy) {
  const rect = await canvasRect();
  if (!rect) throw new Error('canvas 不可用');
  const x = rect.left + gx * rect.width / rect.gw;
  const y = rect.top + gy * rect.height / rect.gh;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(15);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
}

/**
 * 列出场景中所有对象（含 Container 内），坐标取 getBounds() 世界包围盒中心。
 * 注意：样式按钮的交互挂在 Zone 上，文本本身不可交互，因此不按 input 过滤，
 * 而是把 interactive 作为标记返回，供点击时优先选择。
 */
async function listObjects(sceneKey) {
  return evaluate(`(() => {
    const g = window.__SG3__ && window.__SG3__.game;
    if (!g) return [];
    const s = g.scene.getScene('${sceneKey}');
    if (!s) return [];
    const out = [];
    const visit = (list) => {
      for (const o of list) {
        let b = null;
        try { b = o.getBounds ? o.getBounds() : null; } catch (e) { b = null; }
        if (b && b.width > 0 && b.height > 0) {
          out.push({
            type: o.type,
            interactive: !!(o.input && o.input.enabled),
            visible: o.visible !== false,
            cx: b.x + b.width / 2,
            cy: b.y + b.height / 2,
            w: Math.round(b.width), h: Math.round(b.height),
            text: (typeof o.text === 'string') ? o.text : null
          });
        }
        if (o.list) visit(o.list);
      }
    };
    visit(s.children.list);
    return out;
  })()`);
}

/** 列出可交互对象（探测用） */
async function listClickables(sceneKey) {
  return (await listObjects(sceneKey)).filter((o) => o.interactive);
}

/**
 * 只枚举城市面板容器内的对象。
 * 面板按钮都在 _panelContainer 里，这样每次点击不必遍历 55 座城池的全部精灵，
 * 显著降低 CDP 往返开销。
 *
 * 注意：Phaser 的 getBounds() 走的是世界变换矩阵，已经包含容器自身的 x/y，
 * 这里绝不能再叠加一次容器偏移，否则所有面板点击都会偏移到面板之外。
 */
async function listPanelObjects() {
  return evaluate(`(() => {
    const g = window.__SG3__ && window.__SG3__.game;
    if (!g) return [];
    const s = g.scene.getScene('MapScene');
    if (!s || !s._panelContainer) return [];
    const out = [];
    for (const o of s._panelContainer.list) {
      let b = null;
      try { b = o.getBounds ? o.getBounds() : null; } catch (e) { b = null; }
      if (b && b.width > 0 && b.height > 0) {
        out.push({
          type: o.type,
          interactive: !!(o.input && o.input.enabled),
          cx: b.x + b.width / 2,
          cy: b.y + b.height / 2,
          w: Math.round(b.width), h: Math.round(b.height),
          text: (typeof o.text === 'string') ? o.text : null
        });
      }
    }
    return out;
  })()`);
}

/** 在面板内按文本查找并真实点击 */
async function clickPanelText(predicate, label, { required = true } = {}) {
  const objs = await listPanelObjects();
  const hits = objs.filter((o) => o.text !== null && predicate(o.text));
  if (hits.length === 0) {
    if (required) console.log(`  ! 未找到面板对象: ${label}`);
    return false;
  }
  const hit = hits.find((o) => o.interactive) || hits[0];
  await clickGame(hit.cx, hit.cy);
  return true;
}

/**
 * 按文本查找并真实点击（整个场景）。
 * 同一文案可能同时存在「不可交互的文本」与「覆盖其上的 Zone」，
 * 优先点击可交互对象；没有可交互对象时点文本自身（样式按钮即属此类）。
 */
async function clickByText(sceneKey, predicate, label, { required = true } = {}) {
  const objs = await listObjects(sceneKey);
  const hits = objs.filter((o) => o.text !== null && predicate(o.text));
  if (hits.length === 0) {
    if (required) console.log(`  ! 未找到可点击对象: ${label}`);
    return false;
  }
  const hit = hits.find((o) => o.interactive) || hits[0];
  await clickGame(hit.cx, hit.cy);
  return true;
}

async function activeScenes() {
  return evaluate(`(() => {
    const g = window.__SG3__ && window.__SG3__.game;
    if (!g) return [];
    return g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key);
  })()`);
}

async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = `${SHOT_PREFIX}-${name}.png`;
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log(`  screenshot -> ${file}`);
}

// -------------------------------------------------------- DOM 覆盖层文本输入

async function overlayInputVisible() {
  return evaluate(`!!document.querySelector('#sg3-platform-overlay input')`);
}

/** 在 platform/dialog 的输入覆盖层里真实键入文本并回车确认 */
async function typeIntoOverlay(text) {
  for (let i = 0; i < 30; i++) {
    if (await overlayInputVisible()) break;
    await sleep(80);
  }
  if (!(await overlayInputVisible())) return false;
  await evaluate(`(() => {
    const i = document.querySelector('#sg3-platform-overlay input');
    i.focus(); i.select(); return true;
  })()`);
  await send('Input.insertText', { text });
  await sleep(60);
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', {
      type, key: 'Enter', code: 'Enter',
      windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13
    });
  }
  for (let i = 0; i < 30; i++) {
    if (!(await evaluate(`!!document.getElementById('sg3-platform-overlay')`))) return true;
    await sleep(80);
  }
  return false;
}

// ------------------------------------------------------------------ 探测模式

if (PROBE) {
  console.log('canvas:', JSON.stringify(await canvasRect(true)));
  console.log('scenes:', JSON.stringify(await activeScenes()));
  for (const key of ['MenuScene', 'MapScene', 'BattleScene']) {
    const objs = await listClickables(key);
    if (objs.length === 0) continue;
    console.log(`\n[${key}] 可交互对象 ${objs.length} 个:`);
    for (const o of objs.slice(0, 40)) {
      console.log(`  ${o.type} (${Math.round(o.cx)},${Math.round(o.cy)}) ${o.w}x${o.h} ${o.text ? JSON.stringify(o.text) : ''}`);
    }
  }
  ws.close();
  process.exit(0);
}

// ------------------------------------------------------------------ 演练主体

const MONARCH = '赵轩';
const FACTION = '龙吟';
const SKILL = '龙魂破';

const log = [];
const record = (msg) => { log.push(msg); console.log(msg); };

// --- 0. 重载页面，确保拿到最新产物，并等待游戏就绪 ---
await send('Page.reload', { ignoreCache: false });
for (let i = 0; i < 60; i++) {
  await sleep(400);
  try {
    if (await evaluate(`!!(window.__SG3__ && window.__SG3__.game)`)) break;
  } catch { /* 重载期间执行上下文会短暂失效 */ }
}
await sleep(1200);
rectCache = null;

// --- 0.1 回到主菜单 ---
await evaluate(`(() => {
  const g = window.__SG3__.game;
  for (const k of ['MapScene', 'BattleScene']) {
    const s = g.scene.getScene(k);
    if (s && s.scene.isActive()) g.scene.stop(k);
  }
  g.scene.start('MenuScene');
  return true;
})()`);
await sleep(1500);
record(`场景: ${JSON.stringify(await activeScenes())}`);

// --- 1. 真实点击「自定义君主」 ---
const clickedCustom = await clickByText('MenuScene', (t) => t === '自定义君主', '自定义君主按钮');
record(`点击「自定义君主」: ${clickedCustom ? '成功' : '失败'}`);
await sleep(1200);
await screenshot('01-form');

// --- 2. 真实填写输入框（走 platform/dialog 覆盖层） ---
const inputs = (await listObjects('MenuScene'))
  .filter((o) => o.text !== null && o.w === 200)
  .sort((a, b) => a.cy - b.cy);
record(`表单输入框数量: ${inputs.length}`);
const values = [MONARCH, FACTION, SKILL];
for (let i = 0; i < inputs.length && i < values.length; i++) {
  await clickGame(inputs[i].cx + 40, inputs[i].cy + 8);
  const ok = await typeIntoOverlay(values[i]);
  record(`  填写「${values[i]}」: ${ok ? '成功' : '失败'}`);
  await sleep(150);
}
record(`表单当前值: ${JSON.stringify(await evaluate(`(() => {
  const s = window.__SG3__.game.scene.getScene('MenuScene');
  return s.children.list.filter(o => typeof o.text === 'string' && o.input && o.input.enabled)
    .map(o => o.text);
})()`))}`);
await screenshot('02-form-filled');

// --- 3. 真实点击「开始游戏」 ---
const clickedStart = await clickByText('MenuScene', (t) => t === '开始游戏', '开始游戏按钮');
record(`点击「开始游戏」: ${clickedStart ? '成功' : '失败'}`);
await sleep(2000);
let scenes = await activeScenes();
record(`场景: ${JSON.stringify(scenes)}`);
if (!scenes.includes('MapScene')) {
  record('未进入战略地图，演练中止');
  await screenshot('99-abort');
  ws.close();
  process.exit(3);
}
await screenshot('03-map-start');

const startState = await evaluate(`(() => {
  const GD = window.__SG3__.GameData;
  const mine = Object.values(GD.cities).filter(c => c.faction === GD.playerFaction);
  const heroes = Object.values(GD.heroes).filter(h => h.faction === GD.playerFaction);
  let free = 0;
  for (const id in GD.heroes) { const h = GD.heroes[id]; if (h.faction === 'none' && !h.location) free++; }
  return {
    playerFaction: GD.playerFaction, turn: GD.turn,
    cities: mine.map(c => ({ id: c.id, name: c.name, troops: GD.getCityTotalTroops(c.id) })),
    heroes: heroes.map(h => ({ name: h.name, troops: h.troops, isMonarch: !!h.isMonarch, maxTroops: h.maxTroops })),
    gold: GD.factions[GD.playerFaction].gold,
    food: GD.factions[GD.playerFaction].food,
    totalCities: Object.keys(GD.cities).length, freeHeroes: free
  };
})()`);
record(`开局: 势力=${startState.playerFaction} 回合=${startState.turn} 城=${JSON.stringify(startState.cities)}`);
record(`开局武将: ${JSON.stringify(startState.heroes)} 金=${startState.gold} 粮=${startState.food}`);
record(`总城=${startState.totalCities} 可搜索的在野武将=${startState.freeHeroes}`);

// ---------------------------------------------------------------- 战斗驱动

async function driveBattle() {
  for (let i = 0; i < 120; i++) {
    const st = await evaluate(`(() => {
      const g = window.__SG3__.game;
      const s = g.scene.getScene('BattleScene');
      if (!s || !s.scene.isActive()) return { active: false };
      const BE = window.__SG3__.BattleEngine;
      if (!BE.isOver()) {
        for (let k = 0; k < 20; k++) { if (BE.isOver()) break; s._doStep(); }
      }
      return { active: true, over: BE.isOver(), winner: BE.state ? BE.state.winner : null };
    })()`);
    if (!st.active) return 'left';
    if (st.over) {
      await sleep(2700); // 等 BattleScene 自己的 2500ms 收尾定时器
      const s2 = await activeScenes();
      if (!s2.includes('BattleScene')) return st.winner;
      await evaluate(`window.__SG3__.game.scene.getScene('BattleScene')._endBattle()`);
      await sleep(600);
      return 'forced:' + st.winner;
    }
    await sleep(30);
  }
  return 'timeout';
}

// ---------------------------------------------------------------- 决策查询

/** 所有可执行的进攻方案 */
async function attackPlans() {
  return evaluate(`(() => {
    const GD = window.__SG3__.GameData;
    const out = [];
    for (const id in GD.cities) {
      const c = GD.cities[id];
      if (c.faction !== GD.playerFaction) continue;
      const avail = [];
      for (const hid of c.heroes) {
        const h = GD.heroes[hid];
        if (h && h.status !== 'marching' && h.troops > 0) avail.push(h);
      }
      if (avail.length === 0) continue;
      // 本城是否会遭到真实势力进攻（在野城市不会主动出兵）
      const threatened = c.adjacent.some(a => {
        const n = GD.cities[a];
        return n && n.faction !== c.faction && n.faction !== 'none';
      });
      for (const aid of c.adjacent) {
        const t = GD.cities[aid];
        if (!t || t.faction === c.faction) continue;
        // 只有「武将富余」时才留人守城。若城池仅 1~2 名武将却强制留守，
        // 玩家会彻底无法出兵而永久停摆——这比偶尔丢一座空城更糟。
        const needGarrison = (threatened || t.heroes.length > 0) && avail.length >= 3;
        // 出征武将上限 5 名：BattleEngine.init 每方只取前 5 名参战，
        // 多派的武将会「在途但不参战」。这里直接按兵力取前 5 名出征，
        // 保证「计划里的兵力」与「实际参战兵力」完全一致。
        const ranked = avail.slice().sort((a, b) => b.troops - a.troops);
        const marching = needGarrison
          ? ranked.slice(0, Math.max(1, Math.min(5, ranked.length - 1)))
          : ranked.slice(0, 5);
        // BattleEngine.init 每方最多只用 5 名武将（超出部分不参战），
        // 因此评估战力必须按「参战的前 5 名」计算。若按全部武将求和，
        // 会把不参战的兵力算进优势里，导致出兵后实际打不过
        // （曾出现寿春 13 名武将、报 6571 兵，实际参战兵力远低于此）。
        const fighting = marching;
        // 同理，守方参战上限也是 5 名武将；按最强 5 名估算守军兵力，
        // 与战斗引擎实际投入的兵力保持一致。
        const defHeroes = t.heroes.map(hid => GD.heroes[hid]).filter(Boolean)
          .sort((a, b) => b.troops - a.troops).slice(0, 5);
        const defTroops = defHeroes.reduce((s, h) => s + h.troops, 0);
        out.push({
          fromCity: c.id, fromName: c.name,
          target: t.id, targetName: t.name,
          targetFaction: t.faction, targetHeroes: t.heroes.length,
          targetTroops: defTroops,
          myTroops: fighting.reduce((s, h) => s + h.troops, 0),
          heroIds: marching.map(h => h.id),
          heroNames: marching.map(h => h.name),
          keepName: needGarrison
            ? avail.slice().sort((a, b) => a.troops - b.troops)[0].name : null,
          threatened
        });
      }
    }
    return out;
  })()`);
}

/**
 * 武将/兵力调度：沿友方城市网络，把所有富余兵力向前线「枢纽」汇聚。
 *
 * 本作的核心运营手法：出征要求单城兵力超过目标，而武将平均分散时每座城都
 * 只有几千兵，永远打不动 8000+ 的目标（曾连续 40 回合无法出征）。
 *
 * 实现要点：
 * 1. 枢纽 = 前线城市中兵力最多的一座（前线 = 与非在野敌方相邻）。
 * 2. 用 BFS 求每座己方城市到枢纽的最短路径，只派往路径上的「下一跳」。
 *    由于方向恒指向枢纽，不存在两城互送兵力的来回横跳。
 * 3. 单回合只能走一跳，所以兵力是逐回合向前线流动的流水线。
 */
async function reinforcePlans() {
  return evaluate(`(() => {
    const GD = window.__SG3__.GameData;
    const mine = Object.values(GD.cities).filter(c => c.faction === GD.playerFaction);
    if (mine.length < 2) return [];
    const isFrontline = (c) => c.adjacent.some(a => {
      const n = GD.cities[a];
      return n && n.faction !== c.faction && n.faction !== 'none';
    });
    const fronts = mine.filter(isFrontline);
    if (fronts.length === 0) return [];

    // 先挑「最值得打的目标」，再选紧邻它的城市作枢纽。
    // 若只按城市容量选枢纽（例如容量 14000 的长安），兵力会堆在一座
    // 并不与弱城相邻的城市里，永远打不到人——曾因此连续 40 回合停摆。
    // 目标优先级：无守将城市 > 守军最少城市。
    let best = null;
    for (const c of mine) {
      for (const a of c.adjacent) {
        const t = GD.cities[a];
        if (!t || t.faction === c.faction) continue;
        const tt = GD.getCityTotalTroops(t.id);
        const score = t.heroes.length === 0 ? -1 : tt;
        if (!best || score < best.score) {
          best = { score, targetId: t.id, targetName: t.name, fromCity: c.id };
        }
      }
    }
    if (!best) return [];

    // 枢纽 = 与目标相邻的己方城市中「当前兵力最多」者。
    // 必须按当前兵力而非容量选择：容量大但兵力空的城（例如只有 504 兵的
    // 下邳）会把兵力引向一座攒不起攻势的城市，攻势永远打不出去。
    // 兵力只会向枢纽流入，因此枢纽一旦选定就持续领先，不会来回更换。
    const hub = mine.filter(c => c.adjacent.indexOf(best.targetId) > -1)
      .sort((a, b) => {
        const ta = GD.getCityTotalTroops(a.id), tb = GD.getCityTotalTroops(b.id);
        if (tb !== ta) return tb - ta;
        return b.maxTroops - a.maxTroops;
      })[0];
    if (!hub) return [];

    // BFS：求每座己方城市到枢纽的下一跳
    const nextHop = {};
    nextHop[hub.id] = null;
    const queue = [hub.id];
    while (queue.length > 0) {
      const cur = queue.shift();
      for (const a of GD.cities[cur].adjacent) {
        const n = GD.cities[a];
        if (!n || n.faction !== GD.playerFaction) continue;
        if (nextHop[a] !== undefined) continue;
        nextHop[a] = cur;
        queue.push(a);
      }
    }

    const out = [];
    for (const c of mine) {
      if (c.id === hub.id) continue;
      const hop = nextHop[c.id];
      if (hop === undefined || hop === null) continue;   // 与枢纽不连通
      const avail = c.heroes.map(hid => GD.heroes[hid])
        .filter(h => h && h.status === 'idle' && h.troops > 0);
      if (avail.length === 0) continue;
      // 保留 1 人守城；只有 1 人时也允许调走。
      // 这是必要的妥协：武将池总共只有 6~9 人，若坚持「每城至少留 1 人」，
      // 3 名武将分散在 3 座城时任何城都无法调兵，兵力永远凑不到
      // 8000 以上，玩家会陷入永久停摆（曾连续 40 回合无法出征）。
      // 抽空的城市可能被 AI 夺走，但那是可恢复的损失，停摆不是。
      const sorted = avail.slice().sort((a, b) => a.troops - b.troops);
      const spare = avail.length >= 2 ? sorted.slice(0, avail.length - 1) : sorted;
      out.push({
        fromCity: c.id, fromName: c.name,
        target: hop, targetName: GD.cities[hop].name,
        heroNames: spare.map(h => h.name),
        heroIds: spare.map(h => h.id),
        keepName: avail.length >= 2 ? sorted[sorted.length - 1].name : null,
        friendly: true, hub: hub.name
      });
    }
    // 与枢纽距离越远的越先出发（后方先清空，为前线腾出兵力）
    out.sort((x, y) => (y.heroIds.length - x.heroIds.length));
    return out;
  })()`);
}

/** 需要征兵的己方城市（兵力低于上限且金币允许） */
async function recruitNeeds() {
  return evaluate(`(() => {
    const GD = window.__SG3__.GameData;
    const fac = GD.factions[GD.playerFaction];
    const out = [];
    for (const id in GD.cities) {
      const c = GD.cities[id];
      if (c.faction !== GD.playerFaction) continue;
      const cur = GD.getCityTotalTroops(id);
      if (cur >= c.maxTroops) continue;
      // 只在城里有武将（能分配兵力）时征兵
      if (c.heroes.length === 0) continue;
      const amount = Math.min(c.maxTroops - cur, Math.floor(fac.gold / 0.5), 3000);
      if (amount < 300) continue;
      out.push({ id, name: c.name, amount, cur, max: c.maxTroops });
    }
    out.sort((a, b) => b.amount - a.amount);
    return out;
  })()`);
}

/** 可执行「搜索」的城市（有 idle 武将，且仍有在野武将） */
async function searchNeeds() {
  return evaluate(`(() => {
    const GD = window.__SG3__.GameData;
    let free = 0;
    for (const id in GD.heroes) { const h = GD.heroes[id]; if (h.faction === 'none' && !h.location) free++; }
    if (free === 0) return { free: 0, cities: [] };
    const cities = [];
    for (const id in GD.cities) {
      const c = GD.cities[id];
      if (c.faction !== GD.playerFaction) continue;
      const idle = c.heroes.filter(hid => GD.heroes[hid] && GD.heroes[hid].status === 'idle');
      if (idle.length > 0) cities.push({ id, name: c.name });
    }
    return { free, cities };
  })()`);
}

// ---------------------------------------------------------------- UI 操作

async function panelVisible() {
  return evaluate(`window.__SG3__.game.scene.getScene('MapScene')._panelVisible`);
}

async function closePanel() {
  if (!(await panelVisible())) return;
  await clickPanelText((t) => t === '关闭', '关闭按钮', { required: false });
  await sleep(150);
  if (await panelVisible()) {
    await evaluate(`(() => {
      const s = window.__SG3__.game.scene.getScene('MapScene');
      s._panelContainer.removeAll(true); s._panelVisible = false; return true;
    })()`);
  }
}

/** 真实点击城池图标，返回城市面板是否打开 */
async function clickCity(cityId) {
  const p = await evaluate(`(() => {
    const GD = window.__SG3__.GameData;
    const ms = window.__SG3__.game.scene.getScene('MapScene');
    const c = GD.cities['${cityId}'];
    if (!c) return null;
    return { x: c.x + ms._mapContainer.x, y: c.y - 6 + ms._mapContainer.y };
  })()`);
  if (!p) return false;
  await clickGame(p.x, p.y);
  await sleep(280);
  return panelVisible();
}

/**
 * 真实执行一次出征：点城池 → 点「出兵」→（可选）取消勾选留守武将
 * → 点目标城市 → 点「确认出征」。
 */
async function doDispatch(plan, keepHeroName) {
  await closePanel();
  if (!(await clickCity(plan.fromCity))) {
    record(`  ! ${plan.fromName} 城市面板未打开`);
    return false;
  }
  if (!(await clickPanelText((t) => t === '出兵', '出兵按钮'))) return false;
  await sleep(250);

  if (!(await evaluate(`(() => {
    const s = window.__SG3__.game.scene.getScene('MapScene');
    return s._panelContainer.list.some(o => typeof o.text === 'string' && o.text.indexOf('确认出征') > -1);
  })()`))) { record('  ! 出征面板未出现'); return false; }

  if (keepHeroName) {
    const unchecked = await clickPanelText(
      (t) => t.indexOf('[✓]') === 0 && t.indexOf(keepHeroName) > -1,
      `取消勾选留守武将 ${keepHeroName}`, { required: false });
    if (unchecked) await sleep(150);
  }

  // 目标城市行形如：「(○) 天水(qun,兵8000)」「(○) [关] 潼关(wei,兵3000)」
  // 友方城市会带「[增援] 」前缀。这里只按城市名匹配，不依赖任何前缀，
  // 否则友方目标永远匹配不上（曾导致增援静默失败）。
  const picked = await clickPanelText(
    (t) => t.indexOf(plan.targetName) > -1 && t.indexOf('(') === 0,
    `目标城市 ${plan.targetName}`);
  if (!picked) return false;
  await sleep(150);

  if (!(await clickPanelText((t) => t === '确认出征', '确认出征按钮'))) return false;
  await sleep(300);
  return evaluate(`window.__SG3__.GameData.armies.length > 0`);
}

/** 真实点击「结束回合」 */async function clickEndTurn() {
  await closePanel();
  return clickByText('MapScene', (t) => t === '结束回合', '结束回合按钮');
}

/** 真实点击城池面板里的「征兵」 */
async function doRecruit(cityId) {
  await closePanel();
  if (!(await clickCity(cityId))) return false;
  const ok = await clickPanelText((t) => t === '征兵', '征兵按钮', { required: false });
  await sleep(250);
  await closePanel();
  return ok;
}

/** 真实点击城池面板里的「搜索」（可能一次招不到，由调用方重复） */
async function doSearch(cityId) {
  await closePanel();
  if (!(await clickCity(cityId))) return false;
  const ok = await clickPanelText((t) => t === '搜索', '搜索按钮', { required: false });
  await sleep(250);
  await closePanel();
  return ok;
}

// ---------------------------------------------------------------- 主循环

const owned = new Set(startState.cities.map((c) => c.id));
const conquests = [];
let turn = startState.turn;
let dispatchedTotal = 0;
let battles = 0;
let recruitCount = 0;
let searchCount = 0;
let idleRounds = 0;
let lastMine = startState.cities.length;
const stallTurns = [];
let lastSkip = '';
let stopReason = '达到回合上限';

for (let step = 0; step < MAX_TURNS; step++) {
  if (Date.now() - STARTED_AT > BUDGET_MS) { stopReason = `达到时间预算(${argOf('--minutes', 25)} 分钟)`; break; }

  // --- 战斗优先 ---
  let sc = await activeScenes();
  while (sc.includes('BattleScene')) {
    const winner = await driveBattle();
    battles++;
    const st = await evaluate(`(() => {
      const GD = window.__SG3__.GameData;
      return { mine: Object.values(GD.cities).filter(c => c.faction === GD.playerFaction).length,
               turn: GD.turn, queued: GD.battleQueue ? GD.battleQueue.length : 0 };
    })()`);
    record(`[第${st.turn}回合] 战斗结束(${winner}) 现有城池 ${st.mine} 待战队列 ${st.queued}`);
    if (battles <= 3) await screenshot(`battle-${battles}`);
    sc = await activeScenes();
  }
  if (!sc.includes('MapScene')) { await sleep(300); continue; }
  if (await evaluate(`window.__SG3__.game.scene.getScene('MapScene')._gameEnded`)) {
    stopReason = '游戏结束（统一或灭亡）';
    break;
  }

  // --- 本回合行动 ---
  let dispatchedThisTurn = 0;
  // 同一回合内：同一目标最多 2 波，已出征的城市不再抽走留守武将
  const dispatchedTargets = new Map();
  const dispatchedCities = new Set();

  // 1) 搜索招将：武将池是扩张的真正瓶颈，优先补充。
  // 搜索名额有限（每城每回合 1 次），要多城、多回合反复尝试。
  const knownHeroIds = new Set(await evaluate(`Object.values(window.__SG3__.GameData.heroes)
    .filter(h => h.faction === window.__SG3__.GameData.playerFaction).map(h => h.id)`));
  const searchInfo = await searchNeeds();
  if (searchInfo.free > 0 && searchInfo.cities.length > 0) {
    for (const c of searchInfo.cities.slice(0, 5)) {
      for (let attempt = 0; attempt < 3; attempt++) {
        if ((await searchNeeds()).free === 0) break;
        await doSearch(c.id);
        searchCount++;
        const fresh = await evaluate(`Object.values(window.__SG3__.GameData.heroes)
          .filter(h => h.faction === window.__SG3__.GameData.playerFaction)
          .filter(h => !${JSON.stringify([...knownHeroIds])}.includes(h.id))
          .map(h => ({ id: h.id, name: h.name }))`);
        if (fresh.length > 0) {
          for (const f of fresh) knownHeroIds.add(f.id);
          record(`  ☆ 第${turn}回合 ${c.name} 搜索到在野武将 ${fresh.map(f => f.name).join('、')}`);
          break;
        }
      }
    }
  }

  // 2) 征兵：兵力是攻城的硬门槛，尽量把每座城补到上限。
  // 每回合只补 3 座城会让枢纽长期达不到目标兵力（曾连续 40 回合打不动 8000 兵）。
  const needs = await recruitNeeds();
  for (const n of needs.slice(0, 6)) {
    if (await doRecruit(n.id)) {
      recruitCount++;
      if (recruitCount <= 6) {
        record(`  + 第${turn}回合 ${n.name} 征兵（${n.cur}→上限${n.max}）`);
      }
    }
  }

  // 2.5) 增援移到「出征之后」（见步骤 3.5）。
  // 增援会把前线城市的武将调走；若在出征前执行，本回合的攻城计划就会用被抽空
  // 后的兵力去评估，于是出现「寿春实有 41779 兵，却只报出 6571 兵」的假性兵力不足，
  // 连续 40 回合无法出征。顺序必须严格是：先出征，再增援。

  // 3) 出征：无守将城市最优先，其次战力占优的目标
  // 同一目标允许最多 2 波（来自不同城市）：大城守军上限可能高于任何单城上限，
  // 必须靠第一波打残、第二波补刀才能攻克（已实测有效）。
  const MAX_WAVES_PER_TARGET = 2;
  for (let k = 0; k < 8; k++) {
    const plans = await attackPlans();
    if (plans.length === 0) { lastSkip = '无相邻敌对目标'; break; }
    const waveCount = (t) => dispatchedTargets.get(t) || 0;
    // 同一回合内同一城市只出征一次（避免把一城抽空）
    const fresh = plans.filter((p) => waveCount(p.target) < MAX_WAVES_PER_TARGET
      && !dispatchedCities.has(p.fromCity));
    const pool = fresh.length > 0 ? fresh
      : plans.filter((p) => waveCount(p.target) < MAX_WAVES_PER_TARGET);
    if (pool.length === 0) { lastSkip = '本回合目标已全部出征'; break; }
    // 出兵门槛：优先打「兵力占优」的目标（门槛 1.1，因为守方还有防御加成）。
    // 但对满编大城，单城上限可能低于守军上限（例如许昌 12000，而相邻城市
    // 上限只有 9000），此时永远等不到占优。本作允许同一回合多支军队先后
    // 抵达同一目标，第二波面对的是第一波打残后的实时守军（已实测：
    // 守军 12000 → 第一波后 9802 → 第二波攻克），因此对这类「打不动的大城」
    // 也允许派出敢死波次去消耗守军。
    let winnable = pool.filter((p) => p.myTroops > p.targetTroops * 1.1);
    if (winnable.length === 0) {
      // 消耗战：挑「最接近可胜」的敌方目标（兵力比最高者），用现有兵力去磨。
      // 必须设最低兵力比 0.6：太弱的波次会被全歼，武将被俘反而资敌，
      // 那就不是消耗战而是送人头。
      const grindable = pool
        .filter((p) => p.targetHeroes > 0 && p.myTroops >= p.targetTroops * 0.6)
        .sort((a, b) => (b.myTroops / b.targetTroops) - (a.myTroops / a.targetTroops));
      if (grindable.length > 0) {
        const g0 = grindable[0];
        lastSkip = `消耗战:${g0.fromName}→${g0.targetName}(${g0.myTroops}/${g0.targetTroops})`;
        winnable = [g0];
      } else {
        lastSkip = '兵力不足:' + pool.slice(0, 2)
          .map((p) => `${p.fromName}→${p.targetName}(${p.myTroops}/${p.targetTroops})`).join(' ');
        break;
      }
    }
    const empty = winnable.filter((p) => p.targetHeroes === 0);
    let pick;
    if (empty.length > 0) {
      // 优先打无守将城市：_armyArrive 直接占领，不损兵，适合滚雪球
      pick = empty.sort((a, b) => a.targetTroops - b.targetTroops)[0];
    } else {
      pick = winnable.sort((a, b) => (b.myTroops - b.targetTroops) - (a.myTroops - a.targetTroops))[0];
    }

    // 留守武将已由 attackPlans 决定（兵力最少者），确保城市不会空防
    const keep = pick.keepName;

    if (!(await doDispatch(pick, keep))) {
      record(`  ! 出征失败: ${pick.fromName} → ${pick.targetName}`);
      break;
    }
    dispatchedThisTurn++;
    dispatchedTotal++;
    dispatchedTargets.set(pick.target, waveCount(pick.target) + 1);
    dispatchedCities.add(pick.fromCity);
    record(`[第${turn}回合] 出征 ${pick.fromName} → ${pick.targetName}` +
      `(守将${pick.targetHeroes} 守兵${pick.targetTroops} 我兵${pick.myTroops}` +
      `${keep ? ' 留守:' + keep : ''})`);
    if (dispatchedTotal <= 2) await screenshot('04-first-dispatch');
  }

  // 3.5) 增援：把后方富余武将调往前线薄弱城市。
  // 必须放在出征之后：先增援会抽走前线兵力，导致本回合无法出兵
  // （曾出现「寿春实有 41779 兵，出征计划却只报 6571 兵」的假性兵力不足）。
  const reinf = await reinforcePlans();
  let reinforceCount = 0;
  // 同一城市每回合只增援一次：连续两次会把该城最后一名守将也调走，
  // 让城市变成空防（AI 抵达即直接占领）。
  const reinforcedFrom = new Set();
  for (const r of reinf) {
    if (reinforceCount >= 3) break;
    if (reinforcedFrom.has(r.fromCity)) continue;
    // 出征已用过的城市不再抽人，避免同一回合把一城抽空
    if (dispatchedCities.has(r.fromCity)) continue;
    reinforcedFrom.add(r.fromCity);
    if (await doDispatch(r, r.keepName)) {
      reinforceCount++;
      record(`  → 第${turn}回合 增援 ${r.fromName} → ${r.targetName}(${r.heroNames.join('、')}${r.keepName ? ' 留守:' + r.keepName : ''})`);
    } else {
      record(`  ! 第${turn}回合 增援失败 ${r.fromName} → ${r.targetName}`);
    }
  }

  // 4) 结束回合
  const before = await evaluate(`(() => {
    const GD = window.__SG3__.GameData;
    return { turn: GD.turn, mine: Object.values(GD.cities).filter(c => c.faction === GD.playerFaction).length };
  })()`);
  if (!(await clickEndTurn())) { record('  ! 结束回合按钮点击失败，演练中止'); stopReason = '结束回合不可点击'; break; }
  await sleep(750);

  const after = await evaluate(`(() => {
    const GD = window.__SG3__.GameData;
    const mine = Object.values(GD.cities).filter(c => c.faction === GD.playerFaction);
    return {
      turn: GD.turn, phase: GD.phase, mine: mine.length, mineIds: mine.map(c => c.id),
      gold: GD.factions[GD.playerFaction].gold, food: GD.factions[GD.playerFaction].food,
      armies: GD.armies.length, queued: GD.battleQueue ? GD.battleQueue.length : 0
    };
  })()`);
  turn = after.turn;

  for (const id of after.mineIds) {
    if (!owned.has(id)) {
      owned.add(id);
      const name = await evaluate(`window.__SG3__.GameData.cities['${id}'].name`);
      conquests.push({ turn, id, name });
      record(`  ★ 第${turn}回合 占领 ${name}（累计 ${owned.size} 城）`);
      if (conquests.length === 1 || conquests.length % 10 === 0) await screenshot(`conquest-${conquests.length}`);
    }
  }

  if (dispatchedThisTurn === 0) idleRounds++;
  else idleRounds = 0;
  if (after.mine <= lastMine) stallTurns.push(turn);
  else stallTurns.length = 0;
  lastMine = after.mine;

  if (step % 10 === 0 || after.mine !== before.mine) {
    record(`[第${turn}回合] 城池 ${after.mine}/${startState.totalCities} 金${after.gold} 粮${after.food}` +
      ` 在途${after.armies} 待战${after.queued}`);
  }
  if (step % 30 === 0) await screenshot(`turn-${turn}`);

  if (idleRounds > 40) { stopReason = `连续 40 回合无法出征（最后原因: ${lastSkip || '未知'}）`; break; }
  if (stallTurns.length > 80) { stopReason = '连续 80 回合无新增城池'; break; }
}

// ---------------------------------------------------------------- 结果汇总

const finalState = await evaluate(`(() => {
  const GD = window.__SG3__.GameData;
  const mine = Object.values(GD.cities).filter(c => c.faction === GD.playerFaction);
  const ms = window.__SG3__.game.scene.getScene('MapScene');
  const byFaction = {};
  for (const id in GD.cities) { const f = GD.cities[id].faction; byFaction[f] = (byFaction[f] || 0) + 1; }
  return {
    turn: GD.turn, mine: mine.length, total: Object.keys(GD.cities).length,
    gameEnded: !!(ms && ms._gameEnded), phase: GD.phase, byFaction,
    mineNames: mine.map(c => c.name),
    stranded: Object.values(GD.heroes).filter(h => h.status === 'marching')
      .map(h => h.name + '@' + (h.location || 'null')),
    heroes: Object.values(GD.heroes).filter(h => h.faction === GD.playerFaction).length,
    gold: GD.factions[GD.playerFaction].gold, food: GD.factions[GD.playerFaction].food
  };
})()`);

await screenshot('05-final');

record('');
record('================ 演练结果 ================');
record(`停止原因: ${stopReason}`);
record(`结束于: 第 ${finalState.turn} 回合`);
record(`占领城池: ${finalState.mine} / ${finalState.total}`);
record(`占领明细(${conquests.length} 座): ${conquests.map((c) => `R${c.turn}·${c.name}`).join('  ')}`);
record(`我方城池: ${finalState.mineNames.join('、')}`);
record(`势力分布: ${JSON.stringify(finalState.byFaction)}`);
record(`我方武将数: ${finalState.heroes}  金=${finalState.gold} 粮=${finalState.food}`);
record(`出征次数: ${dispatchedTotal}  战斗场次: ${battles}  征兵: ${recruitCount}  搜索: ${searchCount}`);
record(`滞留行军武将: ${finalState.stranded.length === 0 ? '无' : finalState.stranded.join(',')}`);
record(`游戏结束标记: ${finalState.gameEnded}`);
record(`运行时错误: ${runtimeErrors.length === 0 ? '无' : JSON.stringify(runtimeErrors.slice(0, 5))}`);

writeFileSync('scripts/playthrough-report.txt', log.join('\n'), 'utf8');

ws.close();
process.exit(runtimeErrors.length === 0 && finalState.stranded.length === 0 ? 0 : 2);