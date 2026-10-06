# 架构说明

三国群英传 Windows 单机版，Tauri v2 + Phaser 3 + Vite。

## 分层

```
src/
  index.html          页面壳，仅挂载 #game
  main.js             入口：装配依赖 → 创建 Phaser.Game
  scenes/             表现层（Phaser.Scene），只做渲染与输入
    BootScene         资源与初始化
    MenuScene         主菜单、势力选择、自定义君主
    MapScene          战略地图、内政、行军
    BattleScene       战斗演出
  core/               规则层，不依赖 Phaser / DOM
    GameData          全局状态与回合规则
    BattleEngine      战斗结算
    AIController      AI 决策
    config.js         常量与势力配置
    utils.js          通用工具（showToast 等）
  data/               静态数据表（城池 / 武将 / 技能）
  platform/           平台能力，隔离运行环境差异
    storage.js        存档：Tauri→SQLite，浏览器→localStorage
    dialog.js         对话框：DOM 覆盖层（WebView2 无 prompt）
src-tauri/            桌面外壳（Rust）
  src/storage.rs      rusqlite 存档命令
  tauri.conf.json     窗口、CSP、构建钩子
```

## 依赖方向

`main → scenes → core/data`，`scenes → platform`。

`core` 不反向依赖 `scenes`，也不依赖 Phaser。`GameData` 与两个引擎
互相需要，用后期注入打破循环：

```js
setAIData(GameData);      // AIController 拿到状态
setBattleData(GameData);  // BattleEngine 拿到状态
registerEngine({ ai: AIController, battle: BattleEngine });  // GameData 拿到引擎
```

注意 `registerEngine` 是 `GameData.js` 的**具名导出**，不是 `GameData` 对象的方法。

## 存档链路

```
场景 → platform/storage.js → invoke('save_game', { slot, payloadJson })
     → Rust storage.rs → SQLite (app_data_dir/sanguox.db)
```

参数名按 Tauri 约定用 camelCase（`payloadJson`），返回体字段同名。
CSP 必须放行 IPC，否则 `invoke` 被浏览器拦截：

```
connect-src ipc: http://ipc.localhost
```

## 构建与验证

```bash
npm run build          # 前端 → dist/
npm run tauri:build    # 打包桌面应用
npm run tauri:dev      # 开发（自动起 Vite，支持热更新）
npm test               # 前端装配冒烟测试（14 项）
```

`tauri.conf.json` 的 `devUrl` 仅在 debug 构建生效，release 走 `frontendDist`。
故验证生产产物必须用 release 二进制。

端到端验证脚本通过 WebView2 的 CDP 驱动真实窗口：

```bash
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9444" \
  ./target/release/sanguox.exe &
node scripts/render-check.mjs 9444   # 渲染与场景（9 项）
node scripts/flow-check.mjs 9444     # 完整流程与存档往返（10 项）
```

## 已知遗留

见 `CODE_REVIEW.md`。要点：仅单存档槽（存储层已支持 6 槽）、
无音效、无地图缩放、AI 无防守逻辑。
