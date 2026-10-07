/**
 * 截取当前 Tauri WebView2 窗口画面，用于确认渲染状态（非白屏）。
 *
 * 用法: node scripts/shot.mjs [端口] [输出文件]
 * 默认端口 9500，输出 scripts/_shot.png
 */
import { writeFileSync } from 'node:fs';

const port = process.argv[2] || '9500';
const out = process.argv[3] || 'scripts/_shot.png';

const res = await fetch(`http://127.0.0.1:${port}/json`);
const targets = await res.json();
const page = targets.find((t) => t.type === 'page');
if (!page) { console.error('未找到 page 目标'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

function send(method, params = {}) {
  const msgId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(JSON.stringify(m.error)));
    else resolve(m.result);
  }
});

ws.addEventListener('open', async () => {
  try {
    // 顺便取一下运行时错误与场景状态，作为「真的跑起来了」的证据
    const diag = await send('Runtime.evaluate', {
      expression: `JSON.stringify({
        canvas: !!document.querySelector('canvas'),
        w: document.querySelector('canvas')?.width || 0,
        h: document.querySelector('canvas')?.height || 0,
        scene: window.__g?.scene?.getScenes(true).map(s=>s.scene.key) || null
      })`,
      returnByValue: true
    });
    console.log('页面诊断:', diag.result.value);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log(`已保存截图: ${out}`);
  } catch (e) {
    console.error('失败:', e.message);
    process.exitCode = 1;
  } finally {
    ws.close();
  }
});