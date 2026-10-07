/**
 * 在真实游戏窗口里渲染「全部人物立绘对照图」，供肉眼确认形象区分度。
 *
 * 做法：通过 CDP 在页面内动态 import 立绘模块，直接把 41 名武将画到当前
 * 活跃场景的高 depth 图层上，截图后再销毁。这样看到的是**游戏真正使用的
 * 绘制代码**的结果，而不是另写一份渲染。
 *
 * 用法: node scripts/portrait-sheet.mjs [端口] [输出文件]
 */
import { writeFileSync } from 'node:fs';

const port = process.argv[2] || '9500';
const out = process.argv[3] || 'scripts/_portrait-sheet.png';
// 第三个参数可选：头像边长（默认 62 便于肉眼审查；
// 实际面板用的是 30（城市面板）与 20（出征面板），应按这两个尺寸再各看一次）
const SIZE = Number(process.argv[4] || 62);

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

const BUILD = `(async () => {
  const SG = window.__SG3__;
  if (!SG) return JSON.stringify({ err: 'window.__SG3__ 不存在' });
  const game = SG.game;
  const scene = game.scene.getScenes(true)[0];
  if (!scene) return JSON.stringify({ err: '无活跃场景' });

  // 模块路径按 Vite root 解析：vite.config.js 里 root='src'，
  // 因此模块地址是 /core/xxx.js，而不是 /src/core/xxx.js。
  const portraits = await import('./core/portraits.js');
  const cfgMod = await import('./core/config.js');
  const heroesMod = await import('./data/heroes.js');

  const HEROES = heroesMod.HEROES_DATA;
  const COLORS = cfgMod.FACTION_COLORS;
  const SIZE = ${SIZE};
  // 按实际面板尺寸自动排布：小图每行放更多，避免超出 1280 画布
  const COLS = SIZE >= 50 ? 7 : (SIZE >= 26 ? 14 : 21);
  const CELL = SIZE + 30;
  const CELL_H = SIZE + 46;
  const ROWS = Math.ceil(HEROES.length / COLS);

  const layer = scene.add.container(0, 0).setDepth(99999);
  const bg = scene.add.graphics();
  bg.fillStyle(0xf5ecd8, 1);
  bg.fillRect(0, 0, 1280, 720);
  layer.add(bg);

  // 头像批量画进同一个 Graphics：面板里也是这么做的，减少对象数
  const g = scene.add.graphics();
  for (let i = 0; i < HEROES.length; i++) {
    const h = HEROES[i];
    const cx = 42 + (i % COLS) * CELL;
    const cy = 30 + Math.floor(i / COLS) * CELL_H;
    const fc = COLORS[h.faction] || 0x888888;
    g.fillStyle(0xffffff, 0.75);
    g.fillRoundedRect(cx - 3, cy - 3, SIZE + 6, SIZE + 6, 4);
    portraits.drawHeroAvatar(g, cx, cy, SIZE, h, fc);
  }
  layer.add(g);

  for (let i = 0; i < HEROES.length; i++) {
    const h = HEROES[i];
    const cx = 42 + (i % COLS) * CELL;
    const cy = 30 + Math.floor(i / COLS) * CELL_H;
    layer.add(scene.add.text(cx + SIZE / 2, cy + SIZE + 1, h.name, {
      fontSize: '11px', color: '#2a1a0a',
      fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }).setOrigin(0.5, 0));
  }

  window.__SHEET__ = layer;
  return JSON.stringify({ ok: true, count: HEROES.length, size: SIZE, grid: [COLS, ROWS] });
})()`;

const CLEANUP = `(() => {
  if (window.__SHEET__) { window.__SHEET__.destroy(true); window.__SHEET__ = null; }
  return true;
})()`;

ws.addEventListener('open', async () => {
  try {
    const r = await send('Runtime.evaluate', { expression: BUILD, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      console.error('页面异常:', r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
      process.exitCode = 1; ws.close(); return;
    }
    console.log('渲染结果:', r.result.value);
    await new Promise((res) => setTimeout(res, 1500));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log(`已保存: ${out}`);
    // 复原场景，避免影响后续人工操作
    await send('Runtime.evaluate', { expression: CLEANUP, returnByValue: true });
    console.log('已清理临时图层');
  } catch (e) {
    console.error('失败:', e.message);
    process.exitCode = 1;
  } finally { ws.close(); }
});