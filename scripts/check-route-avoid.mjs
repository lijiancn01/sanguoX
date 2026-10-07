/**
 * 校验道路绕行效果：对比「直线」与「当前曲线实现」被城池覆盖的比例。
 *
 * 复用 MapScene 的实际路由算法（通过页面内的场景实例），
 * 不另写一份实现，避免测出来的结论与游戏里跑的不是同一套代码。
 *
 * 用法: node scripts/check-route-avoid.mjs [端口]
 */
const port = process.argv[2] || '9500';

const res = await fetch(`http://127.0.0.1:${port}/json`);
const page = (await res.json()).find((t) => t.type === 'page');
if (!page) { console.error('未找到 page'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const msgId = ++id;
  pending.set(msgId, { resolve, reject });
  ws.send(JSON.stringify({ id: msgId, method, params }));
});
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
});

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
};

const EXPR = `(async () => {
  const SG = window.__SG3__;
  const gd = SG.GameData;
  if (!gd.cities || Object.keys(gd.cities).length === 0) gd.init();
  SG.game.scene.start('MapScene');
  await new Promise(r => setTimeout(r, 500));
  const s = SG.game.scene.getScene('MapScene');

  const R = 26;              // 城池图标半径
  const CLEAR = 30;          // 道路端点收缩距离
  const ids = Object.keys(gd.cities);

  // 采样一条折线，统计落入「非端点城池」覆盖圆的点数比例
  function occludeRatio(pts, a, b) {
    let inside = 0, total = 0;
    for (const p of pts) {
      total++;
      for (const id of ids) {
        const c = gd.cities[id];
        if (c === a || c === b) continue;
        if (Math.hypot(p.x - c.x, p.y - c.y) < R) { inside++; break; }
      }
    }
    return total ? inside / total : 0;
  }

  // 旧的直线实现：两端点直接连到城池中心
  function straightLine(a, b) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) return [];
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    const t = Math.min(CLEAR, len * 0.35);
    return [
      { x: a.x + ux * t, y: a.y + uy * t },
      { x: b.x - ux * t, y: b.y - uy * t }
    ];
  }

  const drawn = new Set();
  const results = [];
  for (const id of ids) {
    const a = gd.cities[id];
    for (const adj of a.adjacent) {
      const b = gd.cities[adj];
      if (!b) continue;
      const key = id < adj ? id + '|' + adj : adj + '|' + id;
      if (drawn.has(key)) continue;
      drawn.add(key);
      const pts = s._routeBetween(a, b, CLEAR);
      results.push({
        name: a.name + '-' + b.name,
        len: Math.hypot(b.x - a.x, b.y - a.y),
        straightRatio: occludeRatio(straightLine(a, b), a, b),
        curvedRatio: occludeRatio(pts, a, b),
        segs: pts.length
      });
    }
  }
  return { count: results.length, results };
})()`;

ws.addEventListener('open', async () => {
  try {
    const r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      console.error('异常:', r.exceptionDetails.exception?.description);
      process.exitCode = 1; ws.close(); return;
    }
    const { count, results } = r.result.value;
    console.log(`道路总数: ${count}`);
    console.log('');

    const badStraight = results.filter(x => x.straightRatio > 0);
    const badCurved = results.filter(x => x.curvedRatio > 0);
    const straightHits = badStraight.reduce((s, x) => s + x.straightRatio, 0);
    const curvedHits = badCurved.reduce((s, x) => s + x.curvedRatio, 0);

    console.log(`直线方案：${badStraight.length}/${count} 条被覆盖，累计覆盖度 ${straightHits.toFixed(1)}`);
    console.log(`曲线方案：${badCurved.length}/${count} 条被覆盖，累计覆盖度 ${curvedHits.toFixed(1)}`);
    console.log('');

    if (badCurved.length) {
      console.log('仍被覆盖的道路（按覆盖度排序）:');
      badCurved.sort((a, b) => b.curvedRatio - a.curvedRatio);
      for (const x of badCurved.slice(0, 12)) {
        console.log(`  ${x.name} 长度${x.len.toFixed(0)}px 直线${(x.straightRatio * 100).toFixed(0)}% → 曲线${(x.curvedRatio * 100).toFixed(0)}%`);
      }
      console.log('');
    }

    console.log('=== 断言 ===');
    check('所有道路都生成了折线', results.every(x => x.segs >= 2), results.filter(x => x.segs < 2).map(x => x.name));
    check('曲线方案覆盖度不高于直线', curvedHits <= straightHits + 1e-9, { straightHits, curvedHits });
    check('累计覆盖度至少减少 70%', curvedHits <= straightHits * 0.3, { straightHits: +straightHits.toFixed(1), curvedHits: +curvedHits.toFixed(1) });
    // 不要求"条数"下降：短边两端本身就挤在阻挡城池的覆盖圆内，
    // 避让只能压低覆盖比例，无法让这类道路变成 0 覆盖。
    // 真正该守住的上限是：没有道路被完全盖住。
    const fully = badCurved.filter(x => x.curvedRatio >= 0.95);
    check('没有道路被完全盖住', fully.length === 0, fully.map(x => `${x.name} ${(x.curvedRatio * 100).toFixed(0)}%`));
    check('单条道路覆盖度均低于 40%', badCurved.every(x => x.curvedRatio < 0.4),
      badCurved.filter(x => x.curvedRatio >= 0.4).map(x => `${x.name} ${(x.curvedRatio * 100).toFixed(0)}%`));

    console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
    ws.close();
    process.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error('失败:', e.message);
    process.exitCode = 1;
    ws.close();
  }
});