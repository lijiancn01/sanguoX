/**
 * 打开出征面板并截图，验证新增的 20px 头像在紧凑行高（22/24px）下
 * 不与文字重叠、也不把按钮挤出画布。
 *
 * 用法: node scripts/dispatch-shot.mjs [端口] [出发城池] [输出文件]
 */
import { writeFileSync } from 'node:fs';

const port = process.argv[2] || '9500';
const fromCity = process.argv[3] || 'luoyang';
const out = process.argv[4] || 'scripts/_dispatch.png';

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

const OPEN = `(() => {
  const SG = window.__SG3__;
  const gd = SG.GameData;
  if (!gd.cities || !gd.cities['${fromCity}']) gd.init();
  SG.game.scene.start('MapScene');
  const scene = SG.game.scene.getScene('MapScene');
  if (!scene._panelContainer) return 'panel-container-not-ready';
  scene._panelContainer.removeAll(true);
  scene._panelVisible = true;
  scene._showDispatchPanel('${fromCity}');
  // 检查是否有元素越出画布底部（这是历史上真实发生过的 bug）
  const H = 720, W = 1280;
  let overflow = [];
  for (const c of scene._panelContainer.list) {
    const b = c.getBounds ? c.getBounds() : null;
    if (b && b.y + b.height > H + 1) overflow.push({ type: c.type, bottom: Math.round(b.y + b.height) });
    if (b && b.x + b.width > W + 1) overflow.push({ type: c.type, right: Math.round(b.x + b.width) });
  }
  const city = gd.cities['${fromCity}'];
  return JSON.stringify({
    city: city.name,
    heroes: (city.heroes || []).length,
    panelChildren: scene._panelContainer.list.length,
    overflow
  });
})()`;

ws.addEventListener('open', async () => {
  try {
    const r = await send('Runtime.evaluate', { expression: OPEN, returnByValue: true });
    if (r.exceptionDetails) {
      console.error('异常:', r.exceptionDetails.exception?.description);
      process.exitCode = 1; ws.close(); return;
    }
    const info = JSON.parse(r.result.value);
    console.log('出征面板:', JSON.stringify(info, null, 2));
    if (info.overflow.length === 0) console.log('  → 无元素越出画布');
    await new Promise((res) => setTimeout(res, 800));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log(`已保存: ${out}`);
  } catch (e) {
    console.error('失败:', e.message);
    process.exitCode = 1;
  } finally { ws.close(); }
});