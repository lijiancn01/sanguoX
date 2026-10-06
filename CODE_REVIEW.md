# 三国群英传 - 代码审查报告（第二轮）

> 审查日期：2026-08-07
> 审查范围：全部源码（index.html, server.js, js/phaser/*）
> 上一轮：2026-08-06（6项P0/P1已修复，19个死代码文件已清理）

---

## 一、修复状态回顾

| 上轮问题 | 级别 | 状态 |
|----------|------|------|
| server.js 路径穿越 | P0 | ✅ 已修复 |
| 自动结算战斗无限循环 | P0 | ✅ 已修复（200回合超时兜底 + `_forceEndByTimeout`） |
| 存档恢复自定义势力丢失 | P0 | ✅ 已修复（toJSON/fromJSON 保存恢复名称颜色） |
| 天命觉醒全局唯一死锁 | P1 | ✅ 已修复（改为 `{attacker:false, defender:false}`） |
| 君主HP保护对全部君主生效 | P1 | ✅ 已修复（仅 `isPlayerMonarch` 受保护） |
| 无胜负判定 | P1 | ✅ 已修复（`_checkGameEnd` + `_showGameOver`） |
| 19个死代码文件 | P2 | ✅ 已清理 |

---

## 二、新发现问题

### P1 — 逻辑/视觉缺陷（全部已修复 ✅）

#### 2.1 地图区域标签被背景遮挡（不可见）✅ 已修复

**文件**: `MapScene.js:95-191` — `_drawTerrain()`

```
执行顺序:
1. 创建 Graphics g，绘制不透明背景填充 (alpha=1)
2. 创建区域文字（西北/河北/中原/蜀地/荆州/江东/交州），add 到 _mapContainer
3. 将 g add 到 _mapContainer（最后加入 = 渲染在最上层）
```

Phaser Container 按插入顺序渲染，后插入的在上方。`g` 包含 `fillGradientStyle(..., 1)` 的不透明底色，完全覆盖先插入的文字标签。**7 个区域标注全部不可见。**

**修复** ✅：调整 `_drawTerrain()` 中 `this._mapContainer.add(g)` 的位置，移到文字标签之前，确保文字渲染在 Graphics 上层。

---

#### 2.2 战斗攻击动画只移动卡片背景，内容不动 ✅ 已修复

**文件**: `BattleScene.js:365-434` — `_showAttackAnimation()`

```js
// 只 tween 了 cardBg 和 nameText
this.tweens.add({ targets: attackerDisp.cardBg, x: rushX, y: rushY, ... });
this.tweens.add({ targets: d.nameText, x: rushX, y: rushY, ... });
```

武将头像、HP条、SP条、兵力文字、士气文字、技能按钮 — 全部不跟随移动。冲刺时卡片背景滑出，内容原地不动，视觉断裂。

**修复** ✅：在 `_drawHeroCard()` 中创建 `Phaser.Container`，将卡片所有元素（背景、头像、名称、HP/SP条、兵力/士气文字、技能按钮）加入容器。`_showAttackAnimation()` 对 `attackerDisp.container` 做 tween，所有元素整体移动。

---

#### 2.3 技能伤害不触发天命觉醒 ✅ 已修复

**文件**: `BattleEngine.js:193-229` — `useSkill()` → `_executeSkill()`

`_checkDestiny()` 仅在 `_heroAttack()` 末尾调用。`useSkill()` 对目标造成伤害后**不检查天命触发条件**。技能可以把君主 HP 打到 10% 以下甚至击杀，天命永远不触发。

**修复** ✅：在 `_executeSkill()` 伤害分支中添加天命锁血检查和玩家君主HP保护（与 `_heroAttack` 逻辑一致）；在伤害循环结束后，对每个目标调用 `_checkDestiny()`。触发时将 destiny 事件附加到 `result.destiny`，BattleScene 按钮处理器检测后显示天命特效。

---

#### 2.4 技能击杀后不检查胜负 ✅ 已修复

**文件**: `BattleEngine.js:193-229` — `useSkill()`

`step()` 末尾调用 `_checkWinCondition()`，但 `useSkill()` 不调用。技能击杀最后一名敌将后，战斗不会立即结束，需等到下一次 `step()`（1.5秒后）。玩家可能看到"已全灭但战斗继续"的错觉。

**修复** ✅：在 `useSkill()` 末尾添加 `if (this._checkWinCondition()) { this.state.phase = 'ended'; }`。BattleScene 按钮处理器在 `useSkill` 返回后检查 `self._be.isOver()`，若战斗结束则停止定时器并延迟结束战斗。

---

### P2 — 代码质量

#### 2.5 `_lastEvent` 含函数引用，序列化后丢失

**文件**: `GameData.js:320-350, 483`

```js
this._lastEvent = event; // event.apply 是函数
// toJSON:
lastEvent: this._lastEvent || null  // JSON.stringify 丢弃函数
```

`_processRandomEvents` 中事件的 `apply` 是闭包函数，`toJSON` 序列化时丢失。存档后 `_lastEvent` 变成残缺对象。

**修复**：toJSON 中只保存 `event.name` 和 `event.desc`，不保存整个 event 对象。

---

#### 2.6 `toJSON` 四次 `JSON.parse(JSON.stringify())` 效率低

**文件**: `GameData.js:478-481`

```js
factions: JSON.parse(JSON.stringify(this.factions)),
cities: JSON.parse(JSON.stringify(this.cities)),
heroes: JSON.parse(JSON.stringify(this.heroes)),
armies: JSON.parse(JSON.stringify(this.armies)),
```

4 次完整的序列化+反序列化。由于数据都是纯值类型，可直接 `JSON.stringify(this)` 一次完成，或用 `structuredClone`。

---

#### 2.7 征兵士气惩罚几乎无效

**文件**: `GameData.js:661`

```js
city.morale = Math.max(0, city.morale - Math.floor(amount * 0.001));
```

征兵 999 人 → 扣 0 士气；征兵 5000 人 → 扣 5 士气。征兵几乎无代价。

**修复**：改为 `Math.floor(amount * 0.01)` 或 `Math.floor(amount / 100)`。

---

#### 2.8 `_redrawCities` 每回合销毁重建 55 城 × 3 对象

**文件**: `MapScene.js:320-333`

每次 `_refreshAll()` 调用 `_redrawCities()`，销毁 55 个 Graphics + 55 个 Text + 55 个 Text = 165 个对象，再重建 165 个。每回合执行一次。

**优化方向**：Graphics 不支持改色，但可以按势力缓存预绘制的 Texture，切换时替换 texture 而非重建。或仅重建势力发生变化的城池。

---

#### 2.9 拖拽与城池点击可能冲突

**文件**: `MapScene.js:65-86`

场景级 `pointerdown` 无条件设置 `_dragging = true`（只要 y 在工具栏之间）。城池 `pointerdown` 调用 `stopPropagation()`，但 Phaser 的事件传播顺序不保证场景处理器在游戏对象之后执行。

**修复**：在 `pointermove` 中添加移动距离阈值（>5px 才开始拖拽），或用 `pointerup` 时的位移判断点击 vs 拖拽。

---

#### 2.10 阵亡武将技能按钮仍可点击

**文件**: `BattleScene.js:215-243, 568-619`

武将阵亡后，`_updateHeroDisplays` 灰化了卡片背景并添加"阵亡"标记，但技能按钮的 `setInteractive` 未被移除。点击时 `useSkill` 会返回 null（有 hp/troops 检查），但 UI 无反馈。

**修复**：阵亡时 `sb.btn.disableInteractive()` 或 `sb.btn.setVisible(false)`。

---

#### 2.11 AI 不攻击空城（在野城市）

**文件**: `AIController.js:99`

```js
if (!adj || adj.faction === faction || adj.faction === 'none') continue;
```

AI 跳过 `faction === 'none'` 的在野城市，错失无防守的空城。空城应是最优先的扩张目标。

**修复**：移除 `adj.faction === 'none'` 过滤，或对空城降低出兵门槛。

---

#### 2.12 AI 只进攻不防守

**文件**: `AIController.js:14-51`

`takeTurn` 中没有：检测敌方行军军队 approaching → 调兵防守、向薄弱城市调兵增援等防御逻辑。AI 是纯进攻型，一旦被多线攻击就会逐个失守。

---

#### 2.13 重复代码：`_showToast` 三处几乎相同

**文件**: `MenuScene.js:770`, `MapScene.js:1246`, `BattleScene.js:636`

三个场景各有一份 `_showToast`，逻辑完全相同。

**✅ 已修复**：提取为 `src/core/utils.js` 的 `showToast(scene, msg)` 公共函数，各场景的 `_showToast` 改为委托调用。

---

#### 2.14 CDN 无降级 + 无本地 Phaser

**文件**: `index.html:15`

CDN 不可用时游戏完全无法启动。

**✅ 已修复**：迁移到 Vite + npm 依赖，Phaser 由打包器从 `node_modules` 打入产物，不再依赖 CDN；桌面版为完全离线运行。

---

#### 2.15 魔法数字未抽取常量

散布在多个文件中：

| 位置 | 代码 | 含义 |
|------|------|------|
| `BattleEngine.js:131` | `attacker.troops * 0.1` | 兵力伤害系数 |
| `BattleEngine.js:132` | `attacker.troops * 0.02` | 最低伤害保底 |
| `BattleEngine.js:160` | `force * 0.5` | 武力直伤系数 |
| `GameData.js:260` | `city.maxTroops * 0.05` | 兵力恢复率 |
| `GameData.js:630` | `amount * 0.5` | 征兵金币单价 |
| `GameData.js:631` | `amount * 0.3` | 征兵粮食单价 |
| `GameData.js:676` | `hero.charisma * 0.5 + 10` | 搜索成功率 |
| `AIController.js:81` | `5000` | 进攻最低兵力门槛 |
| `AIController.js:104` | `1.5` | 进攻兵力优势倍数 |

**🟡 部分修复**：战斗与 AI 相关数值已抽到 `src/core/config.js`
（`TROOP_DAMAGE_RATIO`、`HERO_DAMAGE_RATIO`、`AI_MIN_ATTACK_TROOPS`、
`AI_ATTACK_ADVANTAGE` 等）；征兵与搜索成功率仍是内联字面量。

---

#### 2.16 `window.prompt` 作为输入方式

**文件**: `MenuScene.js:618-630`

自定义君主表单使用 `window.prompt` 获取文本输入。体验差，部分环境会阻止。

**✅ 已修复**：WebView2 不实现 `window.prompt`，故在 `src/platform/dialog.js`
用 DOM 覆盖层实现了 `promptText`/`confirmDialog`/`notify`，支持 Enter 确认与 Escape 取消。

---

### P3 — 缺失功能建议

| 功能 | 说明 |
|------|------|
| 音效系统 | 完全无音频，战斗/点击/回合切换均无声效 |
| 地图缩放 | 1200×900 地图在 1280×720 视口中需要拖拽查看，无缩放支持 |
| 多存档槽 | 仅支持 slot 0 |
| 战斗回放 | `state.log` 保留 50 条但无回看界面 |
| 武将详情面板 | 无法查看完整属性和技能描述 |
| 新手教程 | 无引导 |
| 设置选项 | 无战斗速度/音量调节 |

---

## 三、总结

| 级别 | 数量 | 关键项 |
|------|------|--------|
| P0 严重 | 0 | 上轮 3 项已全部修复 |
| P1 重要 | 0 | 本轮 4 项已全部修复（区域标签、攻击动画、技能天命、技能胜负） |
| P2 质量 | 12 | 序列化函数丢失、征兵无代价、AI不攻空城/不防守、重复代码等 |
| P3 建议 | 7 | 音效、缩放、多存档等 |

### 优先修复建议

1. ~~**P1-2.1**: 地图区域标签不可见~~ ✅ 已修复
2. ~~**P1-2.3**: 技能不触发天命~~ ✅ 已修复
3. ~~**P1-2.4**: 技能不检查胜负~~ ✅ 已修复
4. ~~**P1-2.2**: 攻击动画断裂~~ ✅ 已修复
5. **P2-2.7**: 征兵士气惩罚 — 改系数
6. **P2-2.11**: AI 不攻空城 — 移除 none 过滤
