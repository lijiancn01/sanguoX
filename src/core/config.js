/**
 * 三国群英传 - 全局配置与势力元数据
 * @author jian.li
 */

export const CONFIG = {
  width: 1280,
  height: 720,
  backgroundColor: '#1a0a00',
  mapWidth: 1200,
  mapHeight: 900,
  banner: false
};

/** 数值色（Phaser Graphics 用） */
export const FACTION_COLORS = {
  wei: 0x4488cc,
  shu: 0xcc4444,
  wu:  0x44aa44,
  qun: 0xcc8844,
  none: 0x888888
};

/** 势力中文名（可在运行时追加自定义势力） */
export const FACTION_NAMES = {
  wei: '曹魏',
  shu: '蜀汉',
  wu:  '东吴',
  qun: '群雄',
  none: '在野'
};

/** CSS 色字符串（Phaser Text style 用） */
export const FACTION_CSS = {
  wei: '#4488cc',
  shu: '#cc4444',
  wu:  '#44aa44',
  qun: '#cc8844',
  none: '#888888'
};

export const FONT_FAMILY = '"Microsoft YaHei", "SimHei", "Noto Sans SC", sans-serif';

/** 招募一名士兵的金币单价 */
export const RECRUIT_GOLD_PER = 0.5;
/** 招募一名士兵的粮食单价 */
export const RECRUIT_FOOD_PER = 0.3;
/** 征兵造成的士气损失（每 100 人 1 点） */
export const RECRUIT_MORALE_PER = 100;
/** 每回合城池兵力自然恢复比例 */
export const CITY_TROOP_RECOVER_RATE = 0.05;
/** 武将每回合自然恢复的 HP / SP */
export const HERO_RECOVER = 10;

/** AI 出兵进攻的最低兵力 */
export const AI_MIN_ATTACK_TROOPS = 5000;
/** AI 进攻所需的兵力优势倍数 */
export const AI_ATTACK_ADVANTAGE = 1.5;
/** AI 自动结算战斗的最大回合数（防死循环） */
export const AI_AUTO_BATTLE_MAX_ROUNDS = 200;

/** 战斗引擎超时兜底回合数 */
export const BATTLE_FORCE_END_ROUNDS = 200;

/**
 * 注册自定义势力的显示元数据。
 * @param {string} id
 * @param {string} name
 * @param {string} cssColor
 */
export function registerCustomFaction(id, name, cssColor) {
  FACTION_NAMES[id] = name;
  FACTION_CSS[id] = cssColor;
  FACTION_COLORS[id] = parseInt(String(cssColor).replace('#', ''), 16);
}

/**
 * 取得势力数值色，未知势力回退灰色。
 * @param {string} id
 * @returns {number}
 */
export function factionColor(id) {
  return FACTION_COLORS[id] || 0x888888;
}

/**
 * 取得势力 CSS 色，未知势力回退灰色。
 * @param {string} id
 * @returns {string}
 */
export function factionCss(id) {
  return (FACTION_CSS && FACTION_CSS[id]) || '#888888';
}

/**
 * 取得势力中文名，未知势力回退 id 本身。
 * @param {string} id
 * @returns {string}
 */
export function factionName(id) {
  return (FACTION_NAMES && FACTION_NAMES[id]) || id;
}