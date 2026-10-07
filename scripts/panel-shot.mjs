/**
 * 在真实局面里打开一座武将较多的城池面板，截图验证立绘在面板中的实际效果。
 *
 * 用法: node scripts/panel-shot.mjs [端口] [城池id] [输出文件]
 * 默认城池 changan（长安），默认输出 scripts/_panel.png。
 */
import { writeFileSync } from 'node:fs';

const port = process.argv[2] || '9500';
const cityId = process.argv[3] || 'changan';
const out = process.argv[4] || 'scripts/_panel.png';

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
  if (!gd.cities || !gd.cities['${cityId}']) {
    // 没有存档时先建一局，保证 MapScene 处于已 create 的活跃状态
    gd.init();
  }
  if (!gd.cities['${cityId}']) {
    return 'city-missing;available=' + Object.keys(gd.cities).slice(0, 12).join(',');
  }
  // MapScene 只有在 create() 跑过之后才有 _panelContainer，
  // 因此必须让它成为活跃场景，否则取面板会抛 undefined.removeAll。
  SG.game.scene.start('MapScene');
  const scene = SG.game.scene.getScene('MapScene');
  if (!scene._panelContainer) {
    return 'panel-container-not-ready';
  }
  scene._panelContainer.removeAll(true);
  scene._panelVisible = true;
  scene._showCityPanel('${cityId}');
  const city = gd.cities['${cityId}'];
  return 'ok heroes=' + (city.heroes || []).length + ' city=' + city.name;
})()`;

ws.addEventListener('open', async () => {
  try {
    const r = await send('Runtime.evaluate', { expression: OPEN, returnByValue: true });
    if (r.exceptionDetails) {
      console.error('异常:', r.exceptionDetails.exception?.description);
      process.exitCode = 1; ws.close(); return;
    }
    console.log('打开面板:', r.result.value);
    await new Promise((res) => setTimeout(res, 800));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log(`已保存: ${out}`);
  } catch (e) {
    console.error('失败:', e.message);
    process.exitCode = 1;
  } finally { ws.close(); }
});