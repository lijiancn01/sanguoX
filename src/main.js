/**
 * 三国群英传 - 应用入口（桌面单机版）
 *
 * 职责：
 *   1. 装配依赖：把 GameData 注入 AI 与战斗引擎（打破 ESM 循环依赖）
 *   2. 把引擎注册回 GameData，供回合推进与自动结算调用
 *   3. 创建 Phaser.Game 实例并挂载四个场景
 *
 * 依赖方向（单向，无环）：
 *   main → scenes → GameData → data / config
 *                    GameData ⇄ AIController / BattleEngine（仅通过 setGameData 注入）
 * @author jian.li
 */

import Phaser from 'phaser';

import GameData, { registerEngine } from './core/GameData.js';
import AIController, { setGameData as setAIData } from './core/AIController.js';
import BattleEngine, { setGameData as setBattleData } from './core/BattleEngine.js';
import { CONFIG, FONT_FAMILY } from './core/config.js';

import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import MapScene from './scenes/MapScene.js';
import BattleScene from './scenes/BattleScene.js';

// --- 依赖装配 ---
// GameData 与两个引擎互相需要：引擎通过 setGameData 拿到状态容器，
// GameData 通过 registerEngine 拿到引擎实现，用后期注入打破循环依赖。
setAIData(GameData);
setBattleData(GameData);
registerEngine({ ai: AIController, battle: BattleEngine });

// --- Phaser 配置 ---
const gameConfig = {
  type: Phaser.AUTO,
  width: CONFIG.width,
  height: CONFIG.height,
  backgroundColor: CONFIG.backgroundColor,
  parent: 'game',
  banner: CONFIG.banner,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  // 桌面单机版：禁用右键菜单与文本选择干扰
  disableContextMenu: true,
  scene: [BootScene, MenuScene, MapScene, BattleScene]
};

const game = new Phaser.Game(gameConfig);

// 便于在 WebView 开发者工具中调试
if (typeof window !== 'undefined') {
  window.__SG3__ = { game, GameData, AIController, BattleEngine, FONT_FAMILY };
}

// 存档 IPC 契约自检（可选，默认关闭）。
// 启用：VITE_IPC_VERIFY=1 npm run build
// 它会真实调用 save_game/load_game 等命令，并把结果写入槽位 42，
// 用于在无 WebView 调试器时核验前后端字段契约，故不随 dev 默认执行。
if (import.meta.env.VITE_IPC_VERIFY === '1') {
  import('./verify-ipc.js');
}

export default game;
