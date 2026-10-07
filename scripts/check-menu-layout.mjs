/**
 * 校验主菜单底部按钮的水平居中与对称性。
 *
 * 背景：_createStyledButton(x, ...) 内部按 x - w/2 绘制，即 x 是中心坐标；
 * 但调用处曾传 `w/2 - 130`（左边缘值），导致按钮整体左移半个身位，
 * 与上方三张势力卡片不对齐。本脚本按真实显示对象包围盒断言位置。
 *
 * 用法: node scripts/check-menu-layout.mjs [端口]
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
  SG.game.scene.start('MenuScene');
  await new Promise(r => setTimeout(r, 600));
  const s = SG.game.scene.getScene('MenuScene');
  // MenuScene 没有 _cw 字段，用相机宽高
  const W = s.cameras.main.width;

  // 取所有可交互 Zone 的包围盒（Zone 覆盖按钮与卡片的真实点击区域）
  const zones = [];
  for (const c of s.children.list) {
    if (c.type !== 'Zone' || !c.input || !c.input.enabled) continue;
    const b = c.getBounds();
    zones.push({
      x: Math.round(b.x), y: Math.round(b.y),
      w: Math.round(b.width), h: Math.round(b.height),
      cx: Math.round(b.x + b.width / 2)
    });
  }

  // 按位置识别：卡片在 y≈340，按钮在 y≈540
  const cards = zones.filter(z => z.y < 450);
  const buttons = zones.filter(z => z.y >= 450);

  // 找「自定义君主」与「继续游戏」：靠文本定位 Zone 的对应文本对象
  const texts = s.children.list
    .filter(c => c.type === 'Text' && typeof c.text === 'string')
    .map(c => ({ text: c.text, cx: Math.round(c.x), cy: Math.round(c.y) }));

  const findText = (label) => texts.find(t => t.text === label) || null;

  return {
    W,
    cardCount: cards.length,
    cards: cards.map(c => ({ cx: c.cx, w: c.w })),
    buttons: buttons.map(b => ({ cx: b.cx, w: b.w, y: b.y })),
    customText: findText('自定义君主'),
    continueText: findText('继续游戏')
  };
})()`;

ws.addEventListener('open', async () => {
  try {
    const r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      console.error('异常:', r.exceptionDetails.exception?.description);
      process.exitCode = 1; ws.close(); return;
    }
    const info = r.result.value;
    console.log('画布宽:', info.W);
    console.log('势力卡片:', info.cardCount, JSON.stringify(info.cards));
    console.log('底部按钮:', JSON.stringify(info.buttons));
    console.log('自定义君主文本中心 x:', info.customText ? info.customText.cx : '(不存在)');
    console.log('继续游戏文本中心 x:', info.continueText ? info.continueText.cx : '(无存档时不存在)');
    console.log('');

    console.log('=== 断言 ===');
    check('三张势力卡片存在', info.cardCount === 3, info.cardCount);

    if (info.cards.length === 3) {
      const cxs = info.cards.map(c => c.cx);
      const mid = (cxs[0] + cxs[2]) / 2;
      check('卡片整体以画布中线对称', Math.abs(mid - info.W / 2) <= 1, { mid, W2: info.W / 2 });
    }

    check('存在底部按钮', info.buttons.length >= 1, info.buttons);

    if (info.customText) {
      const off = info.customText.cx - info.W / 2;
      // 修复前该值为 -130（因为传了左边缘值又按中心绘制，偏了 -220/2 - 130 + 130）
      // 修复后应为 0
      check('自定义君主按钮水平居中', Math.abs(off) <= 1, { center: info.customText.cx, expected: info.W / 2, offset: off });
    } else {
      check('自定义君主按钮存在', false);
    }

    if (info.continueText && info.customText) {
      const a = info.customText.cx, b = info.continueText.cx;
      const mid = (a + b) / 2;
      check('两个底部按钮对称于画布中线', Math.abs(mid - info.W / 2) <= 1, { mid, W2: info.W / 2 });
      check('两个按钮不重叠', Math.abs(a - b) >= 220, { a, b, gap: Math.abs(a - b) });
    }

    console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
    ws.close();
    process.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error('失败:', e.message);
    process.exitCode = 1;
    ws.close();
  }
});