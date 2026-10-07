/**
 * 以「默认自适应视角」截图：重置场景并触发一次 refit，
 * 保证截到的是玩家实际打开游戏时看到的画面（而非测试脚本手动平移后的状态）。
 *
 * 用法: node scripts/shot-default-view.mjs [端口] [输出]
 */
import { writeFileSync } from 'node:fs';

const port = process.argv[2] || '9500';
const out = process.argv[3] || 'scripts/_shot-default.png';

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

const EXPR = `(async () => {
  const SG = window.__SG3__;
  const gd = SG.GameData;
  if (!gd.cities || Object.keys(gd.cities).length === 0) gd.init();
  // 完全重建场景，模拟玩家打开地图的第一帧
  SG.game.scene.stop('MapScene');
  SG.game.scene.start('MapScene');
  await new Promise(r => setTimeout(r, 800));
  const s = SG.game.scene.getScene('MapScene');
  return JSON.stringify({
    scale: +s._mapScale.toFixed(3),
    text: s._zoomText ? s._zoomText.text : null,
    canvas: { w: s._cw, h: s._ch }
  });
})()`;

ws.addEventListener('open', async () => {
  try {
    const r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      console.error('异常:', r.exceptionDetails.exception?.description);
      process.exitCode = 1; ws.close(); return;
    }
    console.log('默认视角:', r.result.value);
    await new Promise((res) => setTimeout(res, 500));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log(`已保存 ${out}`);
  } catch (e) {
    console.error('失败:', e.message);
    process.exitCode = 1;
  } finally { ws.close(); }
});