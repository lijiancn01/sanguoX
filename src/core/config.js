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

/**
 * 地图坐标系比例。
 *
 * `cities.js` 里的坐标是为「1200×900 的地图区域」手工排布的（实测跨度
 * 700×535，最近两座城池仅隔 22px）。这个尺度下密集区的绕行计算精度不足，
 * 因此把世界坐标整体放大 COORD_SCALE 倍，给路点留出更细的取值空间。
 *
 * 关键约束：**所有以世界坐标表达的长度都必须乘同一个比例**，否则图标、
 * 命中区、道路避让半径会与城池坐标脱节（图标会相对城池偏出去）。
 * 文字标签的 `fontSize` 是屏幕像素，不在此列——放大坐标后仍用同一字号，
 * 因此屏幕观感基本不变，只是密集处有了更多可绕行的余地。
 *
 * 改这个值后必须跑：
 *   node scripts/check-map-scale.mjs     坐标/比例一致性
 *   node scripts/check-route-avoid.mjs   道路绕行覆盖率
 */
export const COORD_SCALE = 5;

/** 地图区域尺寸（世界坐标，已按 COORD_SCALE 换算） */
export const MAP_SIZE = {
  width: CONFIG.mapWidth * COORD_SCALE,
  height: CONFIG.mapHeight * COORD_SCALE
};

/**
 * 势力数值色（Phaser Graphics 用）。
 *
 * 固定势力的颜色是「势力身份」的一部分：魏=蓝、蜀=红、吴=绿、自定义=黄 为约定，
 * 其余著名诸侯各占一个互不相近的色相，便于在地图上一眼分辨。
 * 改动任何色值后必须跑 `node scripts/check-faction-colors.mjs` 确认两两可辨。
 */
export const FACTION_COLORS = {
  wei: 0x4488cc,        // 曹魏 - 蓝
  shu: 0xcc4444,        // 蜀汉 - 红
  wu:  0x44aa44,        // 东吴 - 绿
  lvbu: 0x8a3fd1,       // 吕布军 - 紫
  yuanshao: 0xe8862b,   // 袁绍军 - 橙
  zhangjiao: 0xa89040,  // 黄巾军 - 土黄
  menghuo: 0x22b0c4,    // 南蛮 - 青
  none: 0x888888        // 在野 - 灰
};

/** 势力中文名（可在运行时追加自定义势力） */
export const FACTION_NAMES = {
  wei: '曹魏',
  shu: '蜀汉',
  wu:  '东吴',
  lvbu: '吕布军',
  yuanshao: '袁绍军',
  zhangjiao: '黄巾军',
  menghuo: '南蛮',
  none: '在野'
};

/** CSS 色字符串（Phaser Text style 用） */
export const FACTION_CSS = {
  wei: '#4488cc',
  shu: '#cc4444',
  wu:  '#44aa44',
  lvbu: '#8a3fd1',
  yuanshao: '#e8862b',
  zhangjiao: '#a89040',
  menghuo: '#22b0c4',
  none: '#888888'
};

/** 内置（非自定义）势力 id；回合结算与 AI 行动均以此为准，不再散落硬编码 */
export const BUILTIN_FACTION_IDS = ['wei', 'shu', 'wu', 'lvbu', 'yuanshao', 'zhangjiao', 'menghuo'];

/**
 * 旧存档势力 id 迁移表。
 *
 * v2 存档把整个 factions/cities/heroes 原样存盘，而旧版本里所有非魏蜀吴的诸侯
 * 共用一个 'qun'（群雄）势力。若不迁移，读档后这些城池的势力 id 不在
 * BUILTIN_FACTION_IDS 中，会变成「不产资源、永不出手」的僵尸势力。
 *
 * 迁移策略：按城池的初始归属把它分派给对应的新势力；城池若已被玩家攻占
 * （faction 不是 qun）则保持原样。这样老存档能继续玩，且势力边界与新版一致。
 */
export const LEGACY_FACTION_REMAP = {
  qun: 'lvbu'
};

/** 各内置势力的初始金币 / 粮草 */
export const INITIAL_FACTION_TREASURY = {
  wei: { gold: 500, food: 500 },
  shu: { gold: 400, food: 400 },
  wu:  { gold: 400, food: 400 },
  lvbu: { gold: 300, food: 300 },
  yuanshao: { gold: 300, food: 300 },
  zhangjiao: { gold: 250, food: 250 },
  menghuo: { gold: 200, food: 200 }
};

/** 自定义君主默认色（黄，用户约定：自定义君主保持黄色） */
export const CUSTOM_DEFAULT_COLOR = '#e8c020';

/**
 * 自定义君主的可选配色。
 *
 * 每个颜色都由 check-faction-colors.mjs 验证过与所有固定势力色差异足够大，
 * 因此玩家无论选哪个都不会与既有势力撞色（此前 6 个选项里有 4 个与魏/蜀/吴/群雄完全相同）。
 */
export const CUSTOM_COLOR_PALETTE = [
  { color: '#e8c020', label: '金黄' },
  { color: '#d94f9e', label: '品红' },
  { color: '#0f7a5a', label: '墨绿' },
  { color: '#e6e6e6', label: '银白' },
  { color: '#2f2f2f', label: '墨黑' }
];

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