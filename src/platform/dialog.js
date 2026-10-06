/**
 * 三国群英传 - 平台交互抽象层
 *
 * 桌面版（Tauri）与浏览器开发态共用同一套 DOM 覆盖层实现：
 *   - WebView2 不实现 window.prompt / confirm / alert（调用无效或抛错）
 *   - tauri-plugin-dialog 只提供 message/ask/confirm/open/save，没有文本输入
 * 因此在 WebView 内自绘输入与确认覆盖层，两端行为一致、样式可控。
 *
 * 覆盖层使用 fixed 定位，层级高于 Phaser canvas，不影响游戏输入。
 * @author jian.li
 */

/** 覆盖层根节点 id，避免重复创建 */
const OVERLAY_ID = 'sg3-platform-overlay';

/** 与游戏界面一致的字体栈 */
const FONT_STACK = '"Microsoft YaHei", "SimHei", "Noto Sans SC", sans-serif';

/**
 * 建立（或复用）覆盖层容器。
 * @returns {HTMLDivElement}
 */
function ensureOverlay() {
  let root = document.getElementById(OVERLAY_ID);
  if (root) return root;

  root = document.createElement('div');
  root.id = OVERLAY_ID;
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10, 5, 0, 0.6)',
    zIndex: '100000',
    fontFamily: FONT_STACK
  });
  document.body.appendChild(root);
  return root;
}

/**
 * 创建面板容器。
 * @param {HTMLDivElement} root
 * @param {number} width
 * @returns {HTMLDivElement}
 */
function createPanel(root, width) {
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    width: `${width}px`,
    boxSizing: 'border-box',
    padding: '22px 24px',
    background: 'linear-gradient(180deg, #2a1a08 0%, #1a0a02 100%)',
    border: '2px solid #c4a060',
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    color: '#e8d4b0'
  });
  root.appendChild(panel);
  return panel;
}

/**
 * 创建按钮。
 * @param {string} label
 * @param {boolean} primary
 * @returns {HTMLButtonElement}
 */
function createButton(label, primary) {
  const btn = document.createElement('button');
  btn.textContent = label;
  Object.assign(btn.style, {
    minWidth: '88px',
    padding: '8px 18px',
    marginLeft: '10px',
    fontFamily: FONT_STACK,
    fontSize: '14px',
    cursor: 'pointer',
    borderRadius: '4px',
    border: `1px solid ${primary ? '#c4a060' : '#6a5a3a'}`,
    background: primary ? '#5a3a10' : '#2a2010',
    color: primary ? '#ffd700' : '#c4a882'
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.background = primary ? '#7a4a18' : '#3a2a14';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = primary ? '#5a3a10' : '#2a2010';
  });
  return btn;
}

/**
 * 弹出单行文本输入框。
 * @param {string} message 提示文案
 * @param {string} defaultValue 默认值
 * @returns {Promise<string|null>} 取消时返回 null
 */
export function promptText(message, defaultValue = '') {
  return new Promise((resolve) => {
    const root = ensureOverlay();
    const panel = createPanel(root, 420);

    const label = document.createElement('div');
    label.textContent = message;
    Object.assign(label.style, { fontSize: '15px', marginBottom: '14px', color: '#ffd700' });
    panel.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue;
    Object.assign(input.style, {
      width: '100%',
      boxSizing: 'border-box',
      padding: '8px 10px',
      fontFamily: FONT_STACK,
      fontSize: '15px',
      color: '#ffd700',
      background: '#0a0a0a',
      border: '1px solid #5a4a2a',
      borderRadius: '4px',
      outline: 'none'
    });
    panel.appendChild(input);

    const row = document.createElement('div');
    Object.assign(row.style, { marginTop: '18px', textAlign: 'right' });
    panel.appendChild(row);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey, true);
      root.remove();
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(input.value); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(null); }
    };

    const cancelBtn = createButton('取消', false);
    cancelBtn.addEventListener('click', () => finish(null));
    const okBtn = createButton('确定', true);
    okBtn.addEventListener('click', () => finish(input.value));
    row.appendChild(cancelBtn);
    row.appendChild(okBtn);

    document.addEventListener('keydown', onKey, true);
    input.focus();
    input.select();
  });
}

/**
 * 弹出确认对话框。
 * @param {string} message
 * @param {string} okLabel
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, okLabel = '确定') {
  return new Promise((resolve) => {
    const root = ensureOverlay();
    const panel = createPanel(root, 400);

    const label = document.createElement('div');
    label.textContent = message;
    Object.assign(label.style, {
      fontSize: '15px',
      lineHeight: '1.6',
      marginBottom: '18px',
      color: '#e8d4b0',
      whiteSpace: 'pre-wrap'
    });
    panel.appendChild(label);

    const row = document.createElement('div');
    Object.assign(row.style, { textAlign: 'right' });
    panel.appendChild(row);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey, true);
      root.remove();
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    };

    const cancelBtn = createButton('取消', false);
    cancelBtn.addEventListener('click', () => finish(false));
    const okBtn = createButton(okLabel, true);
    okBtn.addEventListener('click', () => finish(true));
    row.appendChild(cancelBtn);
    row.appendChild(okBtn);

    document.addEventListener('keydown', onKey, true);
    okBtn.focus();
  });
}

/**
 * 短暂提示消息（阻塞式确认，用于必须让玩家看到的通知）。
 * @param {string} message
 * @returns {Promise<void>}
 */
export function notify(message) {
  return confirmDialog(message, '知道了').then(() => undefined);
}

/**
 * 当前是否为 Tauri 桌面环境。
 * @returns {boolean}
 */
export function isDesktop() {
  return typeof window !== 'undefined' &&
    (!!window.__TAURI_INTERNALS__ || !!window.__TAURI__);
}
