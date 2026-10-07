/**
 * 人物程序化立绘
 *
 * 背景：本项目不使用任何外部图片素材（授权无法逐件核实），人物形象全部由
 * Phaser Graphics 现场绘制。此前只有一个「按能力值猜职业」的通用图标
 * （君主皇冠 / 谋士羽扇 / 武将刀剑 / 其余剪影），同一职业的人长得完全一样，
 * 玩家无法从形象上分辨武将。
 *
 * 本模块把形象拆成一组可组合的**外观特征**，并按人物给出：
 *   1. 著名人物：手工设定（关羽长髯绿袍、夏侯惇独眼眼罩、吕布盔插雉翎、
 *      孙权紫髯碧眼、貂蝉女相、刘备大耳等），保证一眼可辨；
 *   2. 其余人物：用稳定哈希从调色板派生，保证「同一人物每次一致」且
 *      「不同人物互不相同」，无需为每个人物写死数据。
 *
 * 依赖约定：本模块是**纯数据 + 绘图**，不 import Phaser、不碰 DOM。
 * `drawHeroAvatar` 只调用传入 Graphics 对象的方法，因此可在 Node 中用桩对象
 * 无头测试（见 scripts/check-portraits.mjs）。
 *
 * @author jian.li
 */

// --- 稳定哈希：同一 id 永远得到同一结果（不依赖 Math.random） ---
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// --- 颜色工具：f>1 提亮，f<1 压暗 ---
function shadeColor(color, f) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const to = f > 1 ? 255 : 0;
  const k = f > 1 ? f - 1 : 1 - f;
  const mix = (v) => Math.max(0, Math.min(255, Math.round(v + (to - v) * k)));
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

// --- 兜底调色板（未手工设定的人物从这里派生） ---
const SKINS = [0xf5d0a8, 0xefc49a, 0xe0b088, 0xd0a070, 0xbe8f60, 0xac7f54];
const HAIRS = [0x1a1a1a, 0x2a1a12, 0x3a2418, 0x4a3a2a, 0x6a6a6a, 0x9a9a9a];
const BEARDS = ['none', 'mustache', 'goatee', 'full', 'long'];
const HEADS = ['topknot', 'band', 'helmet', 'scholar', 'straw'];
const EYES = ['calm', 'sharp', 'fierce'];

// 非著名人物的袍色从这组高区分度颜色里派生（势力归属由外框体现），
// 避免同一势力的人因为袍色相近而糊成一片。
const ROBES = [
  0xb03a3a, 0x2f6a4a, 0x2a4a8a, 0x8a5a2a, 0x6a3a7a, 0x3a7a7a,
  0xa85a1a, 0x4a4a8a, 0x7a6a2a, 0x8a3a5a, 0x2a6a5a, 0x5a5a5a
];

// 头盔金属色。此前头盔默认取发色（近黑），导致同一势力的武将
// （实测曹操帐下夏侯渊/张辽/许褚/典韦）头盔胡须全是深色、糊成一片，
// 在 30px 面板里几乎无法分辨。改为按哈希取金属色，拉开明度差。
const HELMETS = [0xb8bcc4, 0x9aa0a8, 0xc8b070, 0xa8845a, 0x7a8290, 0xd0d4d8];
const PLUMES = [0xcc2222, 0xe8c020, 0x2a7acc, 0xdddddd, 0x7a3fd1];

/**
 * 著名人物的手工形象设定。
 *
 * 字段：
 *   skin/hair/beardColor  肤色、发色、须色
 *   beard                 none | mustache | goatee | full | long
 *   head                  crown | scholar | helmet | band | straw | topknot | bun
 *   headwearColor         头饰颜色（缺省用发色）
 *   eye                   calm | sharp | fierce
 *   robe                  袍色（缺省由势力色派生，保持势力识别度）
 *   gender                'female' 时改为女相（发髻、无须）
 *   eyepatch/bigEars/plumes/scar/bells  标志性特征
 *   accessory             fan | sword | bow | staff | plume | none
 */
const FAMOUS = {
  // ===== 曹魏 =====
  caocao:    { skin: 0xe8c49a, hair: 0x1a1a1a, beard: 'full',  head: 'crown',   eye: 'sharp',  robe: 0x2a4a7a },
  xiahoudun: { skin: 0xd0a070, hair: 0x1a1a1a, beard: 'goatee', head: 'helmet', eye: 'fierce', robe: 0x3a5a8a, eyepatch: true, scar: true, headwearColor: 0xb8bcc4, plumeColor: 0xcc2222 },
  xiahouyuan:{ skin: 0xe0b088, hair: 0x1a1a1a, beard: 'mustache', head: 'helmet', eye: 'sharp', robe: 0x3a5a8a, headwearColor: 0xc8b070, plumeColor: 0xe8c020 },
  zhangliao: { skin: 0xf5d0a8, hair: 0x1a1a1a, beard: 'none', head: 'helmet', eye: 'sharp',  robe: 0x2f5080, headwearColor: 0xd0d4d8, plumeColor: 0x2a7acc },
  xuchu:     { skin: 0xbe8f60, hair: 0x120c08, beard: 'full',   head: 'band',   eye: 'fierce', robe: 0x5a5a5a, headwearColor: 0x8a3a3a },
  dianwei:   { skin: 0xac7f54, hair: 0x120c08, beard: 'full',   head: 'helmet', eye: 'fierce', robe: 0x3a3a3a, scar: true, headwearColor: 0x7a8290, plumeColor: 0xdddddd },
  simayi:    { skin: 0xe8c49a, hair: 0x2a1a12, beard: 'goatee', head: 'scholar', eye: 'sharp', robe: 0x2a3a5a },
  xunyu:     { skin: 0xf0c8a0, hair: 0x1a1a1a, beard: 'none',   head: 'scholar', eye: 'calm',  robe: 0x3a5a7a },
  guojia:    { skin: 0xf0c8a0, hair: 0x1a1a1a, beard: 'none',   head: 'scholar', eye: 'calm',  robe: 0x4a6a8a },

  // ===== 蜀汉 =====
  liubei:    { skin: 0xe8c49a, hair: 0x1a1a1a, beard: 'full',   head: 'crown',   eye: 'calm',   robe: 0x8a3a3a, bigEars: true },
  guanyu:    { skin: 0xc86a4a, hair: 0x2a1a12, beard: 'long',   head: 'band',    eye: 'calm',   robe: 0x2f7a4a, beardColor: 0x3a2418 },
  zhangfei:  { skin: 0x8a5a3a, hair: 0x120c08, beard: 'full',   head: 'helmet',  eye: 'fierce', robe: 0x4a2a2a, beardColor: 0x120c08 },
  zhaoyun:   { skin: 0xf0c8a0, hair: 0x1a1a1a, beard: 'none',   head: 'helmet',  eye: 'sharp',  robe: 0xc8c8d0, headwearColor: 0xd8d8e0 },
  zhugeliang:{ skin: 0xf0c8a0, hair: 0x1a1a1a, beard: 'goatee', head: 'scholar', eye: 'calm',   robe: 0xd8d8c8, headwearColor: 0xe8e8e0, accessory: 'fan' },
  pangtong:  { skin: 0xa8764e, hair: 0x1a1a1a, beard: 'goatee', head: 'scholar', eye: 'sharp',  robe: 0x6a5a4a },
  machao:    { skin: 0xe8c49a, hair: 0x1a1a1a, beard: 'none',   head: 'helmet',  eye: 'sharp',  robe: 0xd0d0d8, headwearColor: 0xe0e0e8 },
  huangzhong:{ skin: 0xd9a878, hair: 0x9a9a9a, beard: 'full',   head: 'helmet',  eye: 'sharp',  robe: 0x7a6a3a, beardColor: 0xb0b0b0, accessory: 'bow' },
  weiyan:    { skin: 0xd9a878, hair: 0x1a1a1a, beard: 'goatee', head: 'helmet',  eye: 'fierce', robe: 0x5a3a3a },

  // ===== 东吴 =====
  sunquan:   { skin: 0xe8c49a, hair: 0x3a2418, beard: 'full',   head: 'crown',   eye: 'sharp',  robe: 0x2f6a4a, beardColor: 0x7a3a8a },
  zhouyu:    { skin: 0xf0c8a0, hair: 0x1a1a1a, beard: 'none',   head: 'scholar', eye: 'calm',   robe: 0x3a7a5a, accessory: 'sword' },
  lvmeng:    { skin: 0xe0b088, hair: 0x1a1a1a, beard: 'goatee', head: 'helmet',  eye: 'sharp',  robe: 0x2f6a4a },
  luxun:     { skin: 0xf0c8a0, hair: 0x1a1a1a, beard: 'none',   head: 'scholar', eye: 'calm',   robe: 0x4a8a6a, accessory: 'fan' },
  ganning:   { skin: 0xd9a878, hair: 0x1a1a1a, beard: 'goatee', head: 'helmet',  eye: 'fierce', robe: 0x3a7a5a, bells: true },
  taishici:  { skin: 0xe8c49a, hair: 0x1a1a1a, beard: 'mustache', head: 'helmet', eye: 'sharp', robe: 0x2f6a4a, accessory: 'bow' },
  huanggai:  { skin: 0xd9a878, hair: 0x9a9a9a, beard: 'full',   head: 'helmet',  eye: 'calm',   robe: 0x5a7a4a, beardColor: 0xc0c0c0 },
  zhoutai:   { skin: 0xc89868, hair: 0x1a1a1a, beard: 'goatee', head: 'helmet',  eye: 'fierce', robe: 0x2f5a4a, scar: true },

  // ===== 其他势力 =====
  lvbu:      { skin: 0xe8c49a, hair: 0x1a1a1a, beard: 'goatee', head: 'helmet',  eye: 'fierce', robe: 0x8a3fd1, headwearColor: 0xb0b0c0, plumes: true, plumeColor: 0xe8c020, accessory: 'sword' },
  diaochan:  { skin: 0xf8d8b8, hair: 0x120c08, beard: 'none',   head: 'bun',     eye: 'calm',   robe: 0xd94f9e, gender: 'female' },
  yuanshao:  { skin: 0xe8c49a, hair: 0x1a1a1a, beard: 'full',   head: 'crown',   eye: 'calm',   robe: 0xe8862b },
  yanliang:  { skin: 0xd9a878, hair: 0x1a1a1a, beard: 'full',   head: 'helmet',  eye: 'fierce', robe: 0xb06a1a },
  wenchou:   { skin: 0xb8865a, hair: 0x120c08, beard: 'full',   head: 'helmet',  eye: 'fierce', robe: 0xb06a1a, scar: true },
  zhangjiao: { skin: 0xd9a878, hair: 0x9a9a9a, beard: 'long',   head: 'straw',   eye: 'calm',   robe: 0xa89040, beardColor: 0xd0d0d0, accessory: 'staff' },
  menghuo:   { skin: 0x8a5a3a, hair: 0x120c08, beard: 'full',   head: 'band',    eye: 'fierce', robe: 0x22b0c4, beardColor: 0x120c08, accessory: 'plume' }
};

/**
 * 取得某个人物的外观特征（纯函数、确定性）。
 *
 * @param {object} hero  运行时武将对象（用 hero.id 作哈希键）
 * @param {number} factionColor  势力色，用于派生袍色与底色
 * @returns {object} 完整特征
 */
export function getHeroAppearance(hero, factionColor) {
  const id = (hero && hero.id) || 'unknown';
  const base = factionColor || 0x888888;
  const h = hashStr(id);

  const preset = FAMOUS[id] || {};
  const pick = (arr, shift) => arr[(h >>> shift) % arr.length];

  const appearance = {
    skin: preset.skin !== undefined ? preset.skin : pick(SKINS, 0),
    hair: preset.hair !== undefined ? preset.hair : pick(HAIRS, 3),
    beard: preset.beard !== undefined ? preset.beard : pick(BEARDS, 6),
    head: preset.head !== undefined ? preset.head : pick(HEADS, 9),
    eye: preset.eye !== undefined ? preset.eye : pick(EYES, 12),
    headwearColor: preset.headwearColor,
    beardColor: preset.beardColor,
    robe: preset.robe !== undefined ? preset.robe : pick(ROBES, 18),
    gender: preset.gender || 'male',
    eyepatch: !!preset.eyepatch,
    bigEars: !!preset.bigEars,
    plumes: !!preset.plumes,
    plumeColor: preset.plumeColor,
    scar: !!preset.scar,
    bells: !!preset.bells,
    accessory: preset.accessory || 'none',
    // 势力色本身也参与：底色用势力色，保证一眼看出归属
    factionTint: shadeColor(base, 0.72)
  };

  // 头盔颜色：手工指定优先，否则按哈希取金属色（不要退回近黑的发色）
  if (appearance.head === 'helmet' && appearance.headwearColor === undefined) {
    appearance.headwearColor = pick(HELMETS, 21);
  }
  // 盔缨颜色：手工指定优先，否则按哈希取高饱和色
  if (appearance.plumeColor === undefined && appearance.head === 'helmet') {
    appearance.plumeColor = pick(PLUMES, 24);
  }

  // 自定义君主（无 id 预设）按君主处理：戴冠
  if (hero && hero.isMonarch && !preset.head) {
    appearance.head = 'crown';
    appearance.beard = 'full';
  }
  // 女相不画胡须
  if (appearance.gender === 'female') appearance.beard = 'none';

  return appearance;
}

/** 供测试与调试使用的可读摘要 */
export function describeAppearance(hero, factionColor) {
  const a = getHeroAppearance(hero, factionColor);
  return [
    a.skin.toString(16), a.hair.toString(16), a.beard, a.head, a.eye,
    a.robe.toString(16), a.gender,
    a.eyepatch ? 'eyepatch' : '', a.bigEars ? 'bigEars' : '',
    a.plumes ? 'plumes' : '', a.scar ? 'scar' : '', a.bells ? 'bells' : '',
    a.accessory
  ].join('|');
}

/**
 * 在 Graphics 上绘制人物立绘。
 *
 * 所有坐标都按 size 的比例计算，因此同一份代码在 30px 与 40px 下都成立。
 * 只调用 g 的绘图方法，不读取任何全局状态。
 *
 * @param {object} g  Phaser.GameObjects.Graphics（或测试桩）
 * @param {number} x  左上角 x
 * @param {number} y  左上角 y
 * @param {number} size 边长
 * @param {object} hero 武将对象
 * @param {number} factionColor 势力色
 */
export function drawHeroAvatar(g, x, y, size, hero, factionColor) {
  const a = getHeroAppearance(hero, factionColor);
  const s = size;
  const X = (f) => x + f * s;
  const Y = (f) => y + f * s;
  const W = (f) => f * s;

  // 1. 外框与势力底色
  g.fillStyle(0x3a2a1a, 1);
  g.fillRoundedRect(x, y, s, s, W(0.13));
  g.fillStyle(a.factionTint, 1);
  g.fillRoundedRect(x + 1, y + 1, s - 2, s - 2, W(0.11));
  g.fillStyle(shadeColor(a.factionTint, 1.3), 0.5);
  g.fillRoundedRect(x + 1, y + 1, s - 2, W(0.42), W(0.11));

  // 2. 肩与袍
  g.fillStyle(a.robe, 1);
  g.fillEllipse(X(0.5), Y(0.98), W(0.8), W(0.52));
  g.fillStyle(shadeColor(a.robe, 0.72), 1);
  g.fillTriangle(X(0.5), Y(0.76), X(0.36), Y(0.96), X(0.64), Y(0.96));

  // 3. 脖子
  g.fillStyle(shadeColor(a.skin, 0.85), 1);
  g.fillRect(X(0.44), Y(0.6), W(0.12), W(0.16));

  // 4. 后发（戴盔、戴巾时不画，避免与头饰重叠）
  if (a.head !== 'helmet' && a.head !== 'scholar' && a.head !== 'crown') {
    g.fillStyle(a.hair, 1);
    g.fillEllipse(X(0.5), Y(0.42), W(0.58), W(0.5));
  }

  // 5. 脸
  g.fillStyle(a.skin, 1);
  g.fillEllipse(X(0.5), Y(0.44), W(0.46), W(0.5));

  // 大耳（刘备）
  if (a.bigEars) {
    g.fillStyle(shadeColor(a.skin, 0.92), 1);
    g.fillEllipse(X(0.255), Y(0.46), W(0.11), W(0.17));
    g.fillEllipse(X(0.745), Y(0.46), W(0.11), W(0.17));
  }

  // 6. 眉眼
  const eyeY = Y(0.44);
  const eyeDx = W(0.115);
  const browY = Y(0.35);
  const browTilt = a.eye === 'fierce' ? W(0.075) : (a.eye === 'sharp' ? W(0.05) : W(0.022));

  // 眉毛（先画，压在眼上方）
  g.lineStyle(Math.max(1, W(0.05)), a.hair, 1);
  g.beginPath();
  g.moveTo(X(0.5) - eyeDx - W(0.075), browY + browTilt);
  g.lineTo(X(0.5) - eyeDx + W(0.065), browY - browTilt * 0.35);
  g.strokePath();
  g.beginPath();
  g.moveTo(X(0.5) + eyeDx - W(0.065), browY - browTilt * 0.35);
  g.lineTo(X(0.5) + eyeDx + W(0.075), browY + browTilt);
  g.strokePath();

  // 眼睛
  g.fillStyle(0x141414, 1);
  const eyeW = a.eye === 'fierce' ? W(0.1) : W(0.075);
  const eyeH = a.eye === 'calm' ? W(0.05) : W(0.075);
  if (!a.eyepatch) g.fillEllipse(X(0.5) - eyeDx, eyeY, eyeW, eyeH);
  g.fillEllipse(X(0.5) + eyeDx, eyeY, eyeW, eyeH);

  // 独眼眼罩（夏侯惇）：盖住左眼并斜跨额头
  if (a.eyepatch) {
    g.fillStyle(0x24242a, 1);
    g.fillEllipse(X(0.5) - eyeDx, eyeY, W(0.19), W(0.19));
    g.fillRect(X(0.3), Y(0.32), W(0.44), W(0.05));
  }

  // 伤疤（周泰、典韦、文丑）
  if (a.scar) {
    g.lineStyle(Math.max(1, W(0.035)), 0x8a3a3a, 1);
    g.beginPath();
    g.moveTo(X(0.62), Y(0.4));
    g.lineTo(X(0.72), Y(0.56));
    g.strokePath();
  }

  // 7. 鼻子
  g.fillStyle(shadeColor(a.skin, 0.78), 0.9);
  g.fillRect(X(0.485), Y(0.46), W(0.03), W(0.06));

  // 8. 胡须
  if (a.gender !== 'female') {
    const bc = a.beardColor !== undefined ? a.beardColor : a.hair;
    g.fillStyle(bc, 1);
    if (a.beard === 'mustache') {
      g.fillRect(X(0.42), Y(0.525), W(0.16), W(0.032));
    } else if (a.beard === 'goatee') {
      g.fillRect(X(0.42), Y(0.525), W(0.16), W(0.028));
      g.fillEllipse(X(0.5), Y(0.615), W(0.11), W(0.09));
    } else if (a.beard === 'full') {
      g.fillRect(X(0.42), Y(0.525), W(0.16), W(0.028));
      // 收窄胡须面积：过宽会让整张脸变成一团深色，30px 下无法分辨五官
      g.fillEllipse(X(0.5), Y(0.585), W(0.34), W(0.19));
    } else if (a.beard === 'long') {
      g.fillRect(X(0.42), Y(0.525), W(0.16), W(0.028));
      g.fillEllipse(X(0.5), Y(0.58), W(0.34), W(0.17));
      g.fillEllipse(X(0.5), Y(0.78), W(0.22), W(0.26));
    }
  }

  // 9. 头饰
  // 所有头饰都控制在 [0, 1] 的方格内：早期版本把盔缨画到 Y(0) 以上，
  // 在 30px 面板里会被面板边框裁掉一截，看起来像"头顶被切了"。
  const hw = a.headwearColor !== undefined ? a.headwearColor : a.hair;
  if (a.head === 'crown') {
    g.fillStyle(0xffd700, 1);
    g.fillRect(X(0.3), Y(0.18), W(0.4), W(0.1));
    g.fillTriangle(X(0.5), Y(0.07), X(0.36), Y(0.2), X(0.64), Y(0.2));
    g.fillTriangle(X(0.35), Y(0.11), X(0.28), Y(0.2), X(0.43), Y(0.2));
    g.fillTriangle(X(0.65), Y(0.11), X(0.57), Y(0.2), X(0.72), Y(0.2));
    g.fillStyle(0xcc2222, 1);
    g.fillCircle(X(0.5), Y(0.175), W(0.038));
  } else if (a.head === 'scholar') {
    g.fillStyle(hw, 1);
    g.fillRoundedRect(X(0.27), Y(0.15), W(0.46), W(0.18), W(0.07));
    g.fillRect(X(0.33), Y(0.29), W(0.34), W(0.05));
  } else if (a.head === 'helmet') {
    g.fillStyle(hw, 1);
    g.fillEllipse(X(0.5), Y(0.31), W(0.54), W(0.34));
    g.fillRect(X(0.3), Y(0.31), W(0.4), W(0.075));
    g.fillStyle(shadeColor(hw, 0.68), 1);
    g.fillRect(X(0.3), Y(0.335), W(0.4), W(0.032));
    // 盔缨 / 雉鸡翎：从 Y(0.03) 起画，避免超出方格顶部
    g.fillStyle(a.plumeColor !== undefined ? a.plumeColor : 0xcc2222, 1);
    if (a.plumes) {
      g.fillRect(X(0.36), Y(0.04), W(0.032), W(0.16));
      g.fillRect(X(0.61), Y(0.04), W(0.032), W(0.16));
      g.fillEllipse(X(0.376), Y(0.05), W(0.07), W(0.06));
      g.fillEllipse(X(0.626), Y(0.05), W(0.07), W(0.06));
    } else {
      g.fillTriangle(X(0.5), Y(0.04), X(0.42), Y(0.16), X(0.58), Y(0.16));
    }
  } else if (a.head === 'band') {
    g.fillStyle(hw, 1);
    g.fillRoundedRect(X(0.28), Y(0.18), W(0.44), W(0.12), W(0.05));
    g.fillRect(X(0.62), Y(0.215), W(0.14), W(0.038));
  } else if (a.head === 'straw') {
    g.fillStyle(0xc8a860, 1);
    g.fillEllipse(X(0.5), Y(0.27), W(0.62), W(0.17));
    g.fillTriangle(X(0.5), Y(0.08), X(0.34), Y(0.28), X(0.66), Y(0.28));
  } else if (a.head === 'bun') {
    // 女相：发髻 + 发簪
    g.fillStyle(a.hair, 1);
    g.fillEllipse(X(0.5), Y(0.2), W(0.32), W(0.2));
    g.fillEllipse(X(0.5), Y(0.42), W(0.58), W(0.48));
    g.fillStyle(0xffd700, 1);
    g.fillRect(X(0.31), Y(0.185), W(0.38), W(0.026));
  } else {
    g.fillStyle(a.hair, 1);
    g.fillEllipse(X(0.5), Y(0.22), W(0.24), W(0.16));
  }

  // 10. 随身器物（右下角小标记，不遮挡面部）
  const ax = X(0.8);
  const ay = Y(0.82);
  if (a.accessory === 'fan') {
    g.fillStyle(0xf0ead8, 1);
    g.fillEllipse(ax, ay, W(0.22), W(0.16));
    g.fillStyle(0x8a7a5a, 1);
    g.fillRect(ax - W(0.012), ay, W(0.024), W(0.14));
  } else if (a.accessory === 'sword') {
    g.fillStyle(0xd8d8e0, 1);
    g.fillRect(ax - W(0.02), ay - W(0.1), W(0.04), W(0.2));
    g.fillStyle(0x8a5a2a, 1);
    g.fillRect(ax - W(0.055), ay + W(0.06), W(0.11), W(0.035));
  } else if (a.accessory === 'bow') {
    g.lineStyle(Math.max(1, W(0.04)), 0x8a5a2a, 1);
    g.beginPath();
    g.arc(ax, ay, W(0.11), -Math.PI * 0.6, Math.PI * 0.6);
    g.strokePath();
    g.lineStyle(Math.max(1, W(0.02)), 0xe8e0d0, 1);
    g.beginPath();
    g.moveTo(ax + W(0.09), ay - W(0.09));
    g.lineTo(ax + W(0.09), ay + W(0.09));
    g.strokePath();
  } else if (a.accessory === 'staff') {
    g.fillStyle(0x8a6a3a, 1);
    g.fillRect(ax - W(0.02), ay - W(0.14), W(0.04), W(0.28));
    g.fillStyle(0xd8c060, 1);
    g.fillCircle(ax, ay - W(0.15), W(0.05));
  } else if (a.accessory === 'plume') {
    g.fillStyle(0xe8c020, 1);
    g.fillRect(ax - W(0.015), ay - W(0.14), W(0.03), W(0.24));
    g.fillEllipse(ax, ay - W(0.15), W(0.1), W(0.08));
  }
  if (a.bells) {
    g.fillStyle(0xd8c060, 1);
    g.fillCircle(X(0.16), Y(0.86), W(0.05));
    g.fillCircle(X(0.26), Y(0.9), W(0.04));
  }
}

export { FAMOUS as FAMOUS_APPEARANCE, hashStr as _hashStr };