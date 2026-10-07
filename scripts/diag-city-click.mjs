/**
 * 诊断某个城池图标为何点不开：打印它在画布上的实际坐标、是否在可视范围内、
 * 以及该点被哪些可交互对象覆盖（遮挡分析）。
 *
 * 用法: node scripts/diag-city-click.mjs [端口] [城池id...]
 */
const port = process.argv[2] || '9500';
const ids = process.argv.slice(3);

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

const EXPR = `(() => {
  const SG = window.__SG3__;
  const gd = SG.GameData;
  const s = SG.game.scene.getScene('MapScene');
  const mc = s._mapContainer;
  const W = s._cw, H = s._ch;
  const out = {
    canvas: { W, H },
    mapContainer: { x: Math.round(mc.x), y: Math.round(mc.y) },
    panelVisible: !!s._panelVisible,
    targetIds: ${JSON.stringify(ids)},
    cities: {}
  };

  // 收集覆盖在某点上的可交互对象
  const blockersAt = (px, py) => {
    const hit = [];
    for (const c of s.children.list) {
      if (!c.input || !c.input.enabled) continue;
      const b = c.getBounds && c.getBounds();
      if (!b) continue;
      if (px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height) {
        hit.push({ type: c.type, depth: c.depth,
          box: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)],
          text: typeof c.text === 'string' ? c.text.slice(0, 30) : undefined,
          name: c.name || undefined });
      }
    }
    hit.sort((a, b) => (b.depth || 0) - (a.depth || 0));
    return hit;
  };

  for (const cid of out.targetIds) {
    const c = gd.cities[cid];
    if (!c) { out.cities[cid] = 'missing'; continue; }
    const px = c.x + mc.x;
    const py = c.y - 6 + mc.y;
    out.cities[cid] = {
      name: c.name,
      faction: c.faction,
      point: [Math.round(px), Math.round(py)],
      onScreen: px >= 0 && px <= W && py >= 0 && py <= H,
      hitTest: s.input.hitTestPointer({ x: px, y: py, worldX: px, worldY: py }) ?
        s.input.hitTestPointer({ x: px, y: py, worldX: px, worldY: py }).map(o => o.type + (o.name ? '#' + o.name : '')) : [],
      blockers: blockersAt(px, py)
    };
  }
  return JSON.stringify(out, null, 2);
})()`;

ws.addEventListener('open', async () => {
  try {
    const r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true });
    if (r.exceptionDetails) {
      console.error('异常:', r.exceptionDetails.exception?.description);
      process.exitCode = 1;
    } else {
      console.log(r.result.value);
    }
  } catch (e) {
    console.error('失败:', e.message);
    process.exitCode = 1;
  } finally { ws.close(); }
});