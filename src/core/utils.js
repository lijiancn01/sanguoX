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
  bg.setInteractive();
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