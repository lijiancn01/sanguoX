/**
 * 截图取证：地图放大状态 + 出征高亮（绿环/红环/路线箭头）。
 *
 * 用法: node scripts/shot-zoom-hl.mjs [端口] [前缀]
 */
import { writeFileSync } from 'node:fs';

const port = process.argv[2] || '9500';
const prefix = process.argv[3] || 'scripts/_zoomhl';

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

const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
  return r.result.value;
};
const shot = async (file) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(s.data, 'base64'));
  console.log(`已保存 ${file}`);
};

const PREP = `(async () => {
  const SG = window.__SG3__;
  const gd = SG.GameData;
  if (!gd.cities || Object.keys(gd.cities).length === 0) gd.init();
  SG.game.scene.start('MapScene');
  return true;
})()`;

const ZOOM = `(() => {
  const s = window.__SG3__.game.scene.getScene('MapScene');
  s._panelContainer.removeAll(true); s._panelVisible = false;
  s._resetMapView();
  s._zoomAroundScreen(s._cw / 2, s._ch / 2, 1.2);
  s._zoomAroundScreen(s._cw / 2, s._ch / 2, 1.2);
  return { scale: s._mapScale };
})()`;

const DISPATCH = `(() => {
  const SG = window.__SG3__;
  const gd = SG.GameData;
  const s = SG.game.scene.getScene('MapScene');
  s._resetMapView();
  // 找一座有敌对相邻城池的己方城池
  let found = null;
  for (const c of Object.values(gd.cities)) {
    if (c.faction !== gd.playerFaction) continue;
    const t = c.adjacent.map(a => gd.cities[a]).filter(x => x && x.faction !== c.faction);
    if (t.length) { found = c; break; }
  }
  if (!found) return 'none';
  s._showDispatchPanel(found.id);
  // 把地图移到能同时看见出发城与目标城的位置
  const targets = found.adjacent.map(a => gd.cities[a]).filter(x => x && x.faction !== found.faction);
  const midX = (found.x + targets[0].x) / 2;
  const midY = (found.y + targets[0].y) / 2;
  s._mapContainer.x = s._cw / 2 - midX;
  s._mapContainer.y = s._ch / 2 - midY;
  return { from: found.name, to: targets[0].name, objects: s._dispatchHighlightObjects.length };
})()`;

ws.addEventListener('open', async () => {
  try {
    await ev(PREP);
    await new Promise((r) => setTimeout(r, 700));
    console.log('放大:', JSON.stringify(await ev(ZOOM)));
    await new Promise((r) => setTimeout(r, 500));
    await shot(`${prefix}-1-zoomed.png`);

    console.log('出征高亮:', JSON.stringify(await ev(DISPATCH)));
    await new Promise((r) => setTimeout(r, 700));
    await shot(`${prefix}-2-highlight.png`);
  } catch (e) {
    console.error('失败:', e.message);
    process.exitCode = 1;
  } finally { ws.close(); }
});