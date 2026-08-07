# 三国群英传 - 代码审查报告

> 审查日期：2026-08-06  
> 审查范围：全部源码（index.html, server.js, js/phaser/*, css/main.css）

---

## 一、项目概览

| 维度 | 说明 |
|------|------|
| 技术栈 | Phaser 3.80.1 + 原生 JavaScript（ES5 风格） |
| 架构 | 全局命名空间 `window.SG3`，4 个 Phaser 场景（Boot/Menu/Map/Battle） |
| 实际加载文件 | `js/phaser/` 下 12 个 JS 文件 + index.html |
| 未加载文件 | `js/` 根目录下 19 个 JS 文件 + `css/main.css`（死代码） |
| 服务端 | `server.js` 原生 http 静态文件服务器 |

---

## 二、严重问题（P0 - 安全/崩溃）

### 2.1 server.js 路径穿越漏洞

**文件**: `server.js:17`

```js
let filePath = path.join(__dirname, url === '/' ? 'index.html' : url);
```

`path.join` 不会阻止 `../` 穿越。攻击者可构造请求 `GET /../../etc/passwd` 读取项目目录外的文件。

**修复建议**：
```js
let filePath = path.resolve(__dirname, url === '/' ? 'index.html' : url);
if (!filePath.startsWith(__dirname)) {
  res.writeHead(403);
  res.end('Forbidden');
  return;
}
```

### 2.2 自动结算战斗无限循环风险

**文件**: `GameData.js:418-421`

```js
var maxRounds = 200;
while (state.phase !== 'ended' && maxRounds-- > 0) {
  window.SG3.BattleEngine.step();
}
```

如果 200 回合后战斗未结束（`state.winner` 为 `null`），后续代码 `if (state.winner === 'attacker')` 和 `else` 分支都不会执行，**出征武将永远卡在 `marching` 状态**，既不占领城市也不撤退。

**修复建议**：增加 `else` 兜底分支，按兵力对比判定胜负或双方撤退。

### 2.3 存档恢复丢失自定义势力信息

**文件**: `GameData.js:490-494`

```js
if (data.customFactionId) {
  if (!window.SG3.FACTION_NAMES) window.SG3.FACTION_NAMES = {};
  if (!window.SG3.FACTION_CSS) window.SG3.FACTION_CSS = {};
}
```

这段代码只创建了空对象，**没有恢复自定义势力的名称和颜色**。读档后自定义势力的名称显示为 `custom_1234567890`，颜色回退为灰色。

**修复建议**：在 `toJSON` 中保存 `factionNames` 和 `factionCss`，在 `fromJSON` 中恢复。

---

## 三、重要问题（P1 - 逻辑缺陷）

### 3.1 无胜负判定 - 游戏可无限继续

**文件**: `GameData.js`

`endTurn()` 中没有检查：
- 玩家是否丢失所有城市（败北）
- 玩家是否占领所有城市（胜利）

游戏可以无限进行，没有任何结局。

### 3.2 `fromJSON` 未恢复 `_lastEvent` 中的函数

**文件**: `GameData.js:320-349, 476`

`_processRandomEvents` 中 `events` 数组每项含 `apply` 函数，存入 `this._lastEvent`。`toJSON` 序列化时函数丢失，`fromJSON` 读取后 `_lastEvent` 为残缺对象。虽然不影响核心逻辑，但属于数据完整性问题。

### 3.3 天命觉醒全局唯一 - 多君主战斗不合理

**文件**: `BattleEngine.js:29, 444`

```js
destinyTriggered: false  // 全局标记
```

`_checkDestiny` 中 `if (this.state.destinyTriggered) return null` — 一旦任何君主触发天命，**其他君主永远无法触发**。在双方都是君主的对决中，先被打到低血量的君主获得巨大优势，另一方完全没有反制机会。

### 3.4 君主 HP 保护对全部君主生效

**文件**: `BattleEngine.js:141-143, 162-164`

```js
if (defData && defData.isMonarch && !this.state.destinyTriggered && (defender.hp - hpLoss) <= threshold) {
  hpLoss = Math.max(0, defender.hp - threshold);
}
```

AI 君主也享有 10% HP 保护，这意味着 AI 君主极难被击杀（必须先触发天命才能继续扣血）。如果天命已被玩家君主触发，AI 君主将**永远无法被杀死**，导致战斗无法结束。

### 3.5 征兵士气惩罚几乎无效

**文件**: `GameData.js:646`

```js
city.morale = Math.max(0, city.morale - Math.floor(amount * 0.001));
```

征兵 999 人只扣 0 点士气，征兵 5000 人也只扣 5 点。征兵几乎没有代价。

### 3.6 地图拖拽与城市点击可能冲突

**文件**: `MapScene.js:68-89`

场景级 `pointerdown` 设置 `_dragging = true`，城市圆圈的 `pointerdown` 调用 `stopPropagation()`。但 Phaser 的事件传播顺序不保证场景级处理器在游戏对象处理器之后执行。如果场景先收到事件，点击城市会同时触发拖拽。

**修复建议**：在 `pointermove` 中加入移动距离阈值（如 > 5px 才视为拖拽），或使用 `pointerup` 判断是否为点击。

---

## 四、代码质量问题（P2）

### 4.1 大量死代码

| 路径 | 文件数 | 状态 |
|------|--------|------|
| `js/ai/`, `js/battle/`, `js/city/`, `js/data/`, `js/hero/`, `js/map/`, `js/ui/` | 15 个 JS | **未被 index.html 加载** |
| `js/main.js`, `js/game.js` | 2 个 JS | **未被加载** |
| `css/main.css` | 1 个 CSS | **未被加载**（index.html 用内联样式） |

这 18 个文件是早期版本的遗留代码，应删除或归档，避免混淆。

### 4.2 CDN 无降级方案

**文件**: `index.html:15`

```html
<script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
```

CDN 不可用时游戏完全无法启动。建议下载 Phaser 到本地 `vendor/` 目录。

### 4.3 `window.prompt` 作为输入方式

**文件**: `MenuScene.js:368-374`

```js
textObj.on('pointerdown', function() {
  var input = window.prompt(placeholder, ...);
```

使用 `window.prompt` 获取用户输入，体验极差，且部分浏览器/环境会阻止。代码注释也承认这是简化处理。

### 4.4 重复代码

| 方法 | 出现位置 |
|------|----------|
| `_showToast` | MenuScene, MapScene, BattleScene（3 处几乎相同） |
| `_createButton` | MenuScene, BattleScene（2 处几乎相同） |

建议提取为公共工具函数或基类。

### 4.5 魔法数字泛滥

典型示例：

```js
var baseDmg = attacker.troops * 0.1 * randRange(0.8, 1.2) * typeMultiplier * moraleFactor;
var recovery = Math.floor(city.maxTroops * 0.05);
var goldCost = Math.floor(amount * 0.5);
var chance = hero.charisma * 0.5 + 10;
```

建议抽取为配置常量（如 `CONFIG.TROOP_DAMAGE_FACTOR`, `CONFIG.RECOVERY_RATE` 等）。

### 4.6 超长函数

| 函数 | 行数 | 问题 |
|------|------|------|
| `MenuScene._showCustomMonarch` | ~255 行 | 单函数承担整个表单创建，应拆分 |
| `MapScene._showCityPanel` | ~170 行 | 混合了面板创建、属性条、武将列表、按钮 |
| `MapScene._showMyCitiesPanel` | ~200 行 | 内嵌 `renderList` 闭包，逻辑复杂 |
| `MapScene._showDispatchPanel` | ~200 行 | 武将选择 + 目标选择 + 确认逻辑混合 |

### 4.7 `remainText` 初始化错误后立即修正

**文件**: `MenuScene.js:207-210`

```js
var remainText = this.add.text(w / 2, formY, '属性分配（剩余点数：' + (attrPoints - 350 + 350) + '）', ...);
// Fix: recalculate remaining
var calcRemain = function() { ... };
remainText.setText('属性分配（剩余点数：' + calcRemain() + '）');
```

`attrPoints - 350 + 350` 等于 `attrPoints`，这个表达式毫无意义。下一行立即用 `calcRemain()` 覆盖。应直接使用 `calcRemain()`。

### 4.8 字符串比较做排序键

**文件**: `MapScene.js:108`

```js
var key = cityId < adjId ? cityId + '-' + adjId : adjId + '-' + cityId;
```

用字符串大小比较做去重 key，对当前 ID 可行但脆弱。如果 ID 前缀相同长度不同，可能产生不一致的 key。

### 4.9 `toJSON` 深拷贝方式低效

**文件**: `GameData.js:471-475`

```js
factions: JSON.parse(JSON.stringify(this.factions)),
cities: JSON.parse(JSON.stringify(this.cities)),
heroes: JSON.parse(JSON.stringify(this.heroes)),
armies: JSON.parse(JSON.stringify(this.armies)),
```

对整个游戏状态做 4 次 `JSON.parse(JSON.stringify())`，性能较差。由于这些数据都是纯值类型（无函数、无循环引用），可以直接 `JSON.stringify(this)` 整体序列化，或使用 `structuredClone`。

### 4.10 BattleScene 阵亡灰化坐标错误

**文件**: `BattleScene.js:264-266`

```js
d.cardBg.clear();
d.cardBg.fillStyle(0x000000, 0.2);
d.cardBg.fillRoundedRect(0, 0, 220, 100, 4);  // 坐标从 (0,0) 开始
```

阵亡灰化时 `fillRoundedRect` 使用 `(0, 0)` 坐标，但原始卡片绘制使用 `(x, y)` 坐标。灰化矩形会画在场景左上角而非卡片位置。

**修复**：应缓存卡片的 `x, y` 坐标并在灰化时使用。

---

## 五、缺失功能（P3 - 建议）

| 功能 | 说明 |
|------|------|
| 胜负判定 | 无游戏结束条件，无法通关或失败 |
| 游戏教程 | 新玩家无引导 |
| 音效系统 | 完全没有音频 |
| 设置选项 | 无法调节音量、战斗速度等 |
| 多存档槽 | 只支持单存档（slot 0） |
| 战斗回放 | 战斗日志只保留 50 条，无法回看 |
| 武将详情面板 | 无法查看武将完整属性和技能描述 |

---

## 六、架构建议

### 6.1 引入模块化

当前所有代码挂在 `window.SG3` 上，文件间通过全局变量通信。建议：
- 使用 ES6 Module（`import/export`），或至少使用 IIFE 模式减少全局污染
- 将数据（cities/heroes/skills）拆为 JSON 文件按需加载

### 6.2 场景间通信规范化

当前场景间通过 `window.SG3.GameData` 共享状态，场景切换时手动 `stop/start`。建议：
- 使用 Phaser 的 `scene.sleep()` / `scene.wake()` 替代 `stop/start`，保留场景状态
- 通过事件系统（`this.events.emit/on`）通信，减少直接耦合

### 6.3 数据与逻辑分离

`cities.js`、`heroes.js`、`skills.js` 将数据混在 JS 中。建议拆为独立 JSON 文件，通过 `this.load.json()` 加载，便于维护和修改。

---

## 七、总结

| 级别 | 数量 | 关键项 |
|------|------|--------|
| P0 严重 | 3 | 路径穿越、自动结算卡死、存档丢失自定义势力 |
| P1 重要 | 6 | 无胜负判定、天命全局唯一、君主保护过度等 |
| P2 质量 | 10 | 死代码、CDN 无降级、重复代码、魔法数字等 |
| P3 建议 | 7 | 胜负判定、教程、音效等缺失功能 |

**优先修复顺序**：
1. server.js 路径穿越（安全）
2. 自动结算战斗兜底（崩溃）
3. 存档恢复自定义势力（数据丢失）
4. 君主保护 + 天命全局唯一（战斗死锁）
5. 胜负判定（游戏完整性）
6. 清理死代码（可维护性）
