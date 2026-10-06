/**
 * 三国群英传 - 公共工具
 * @author jian.li
 */

import { FONT_FAMILY } from './config.js';

export { FONT_FAMILY };

/**
 * 在 Phaser 场景中显示一条短暂的浮动提示。
 * 三个场景共用，避免重复实现。
 * @param {Phaser.Scene} scene
 * @param {string} msg
 * @param {number} duration 毫秒
 */
export function showToast(scene, msg, duration = 2000) {
  if (!scene || !msg) return null;
  const w = scene.cameras.main.width;
  const y = 90;
  const isError = /不足|失败|无效|不存在|不可|已达上限|未发现/.test(msg);

  const bg = scene.add.rectangle(w / 2, y, 0, 40, 0x000000, 0.75).setOrigin(0.5);
  const text = scene.add.text(w / 2, y, msg, {
    fontSize: '18px',
    fontFamily: FONT_FAMILY,
    color: isError ? '#ff6b6b' : '#ffd700',
    stroke: '#3a1a00',
    strokeThickness: 3
  }).setOrigin(0.5);

  const maxWidth = w - 160;
  if (text.width > maxWidth) {
    text.setScale(maxWidth / text.width);
    bg.setSize(maxWidth * text.scaleX + 40, 40);
  } else {
    bg.setSize(text.width + 40, 40);
  }

  const container = scene.add.container(0, 0, [bg, text]);
  // 提示气泡绝不能拦截输入：它位于画布顶部（y=90，深度 9999），
  // 而地图上方的城市（如平原 y≈104）正落在气泡覆盖范围内。
  // 若把气泡设为可交互，上一次操作弹出的提示（例如「出征失败」）
  // 会吞掉下一次对城池的点击，玩家表现为「点不开城市面板」，
  // 且症状总是紧跟一次失败提示出现，极具迷惑性。
  // 气泡只做展示，故显式关闭其交互（含子对象的 hitArea）。
  bg.disableInteractive();
  if (bg.input) bg.input.enabled = false;
  container.setDepth(9999);

  scene.tweens.add({
    targets: container,
    y: -60,
    alpha: 0,
    delay: duration,
    duration: 350,
    onComplete: () => container.destroy()
  });
  return container;
}

/**
 * 深拷贝纯数据（JSON 安全类型）。
 * @param {*} value
 * @returns {*}
 */
export function deepClone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

/**
 * 延时指定毫秒。
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}