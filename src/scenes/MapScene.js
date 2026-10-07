/**
 * 三国群英传 - 战略地图场景
 * @author jian.li
 */

import Phaser from 'phaser';
import GameData from '../core/GameData.js';
import { FACTION_COLORS, FACTION_NAMES, FACTION_CSS } from '../core/config.js';
import { drawHeroAvatar } from '../core/portraits.js';
import { saveGame, loadGame } from '../platform/storage.js';
import { showToast } from '../core/utils.js';

class MapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MapScene' });
  }

  create() {
    var GD = GameData;
    this._gd = GD;
    this._gameEnded = false;

    var cam = this.cameras.main;
    this._cw = cam.width;
    this._ch = cam.height;

    // 地图容器（可拖拽平移）
    this._mapContainer = this.add.container(0, 0);

    // 绘制地图背景
    this._mapW = 1200;
    this._mapH = 900;
    this._drawTerrain();

    // 绘制相邻连线（道路）
    this._drawAdjacentLines();

    // 绘制城市节点
    this._citySprites = {};
    this._cityLabels = {};
    this._drawCities();

    // 绘制行军军队
    this._armySprites = [];
    this._drawArmies();

    // 地图缩放状态：必须在 _createHUD 之前就绪，
    // 因为 HUD 上的 ＋/－/⟲ 按钮一被创建就可能收到点击，
    // 若此时 _mapScale 还是 undefined，缩放会算出 NaN 并让地图彻底消失。
    this._mapHomeX = 0;
    this._mapHomeY = 0;
    this._mapMinScale = 0.5;
    this._mapMaxScale = 2.2;
    this._mapDefaultScale = 1;
    this._mapScale = 1;
    this._dispatchHighlightLayer = null;
    this._dispatchHighlightObjects = [];

    // HUD
    this._createHUD();

    // 城市信息面板容器
    this._panelContainer = this.add.container(0, 0);
    this._panelContainer.setDepth(10);
    this._panelVisible = false;

    // 拖拽平移
    this._dragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._mapStartX = 0;
    this._mapStartY = 0;

    // 设置地图初始位置（居中）
    var initX = (this._cw - this._mapW) / 2;
    var initY = (this._ch - this._mapH) / 2 + 20;
    this._mapContainer.x = Math.min(10, initX);
    this._mapContainer.y = Math.min(50, initY);
    // 记录归位坐标（缩放状态本身已在 _createHUD 之前初始化完毕）
    this._mapHomeX = this._mapContainer.x;
    this._mapHomeY = this._mapContainer.y;

    // 滚轮缩放
    this.input.on('wheel', function(pointer, gameObjects, deltaX, deltaY, deltaZ) {
      if (pointer.y <= 50 || pointer.y >= this._ch - 40) return;   // 不在 HUD/底栏上滚
      // Phaser 的 wheel 事件 delta 方向随平台而异，这里按绝对值判断方向，
      // 再统一乘以衰减系数，避免某些环境滚轮完全无响应。
      var factor = 1.1;
      if (deltaY < 0) factor = 1 / 1.1;
      this._zoomAroundScreen(pointer.x, pointer.y, factor);
    }, this);

    // 拖拽事件
    // 关键：拖拽只能在「空白地图区域」按下时启动。城池图标、面板按钮等
    // 可交互对象自身的 pointerdown 同样会冒泡到场景级监听器，若不加判断，
    // 点击城池也会把 _dragging 置为 true。此后只要再到达一个 pointermove
    // （例如 CDP 点击前先派发 mouseMoved，或真实鼠标的轻微抖动），
    // 地图就会整体平移（实测偏移 (581,15)），等 mousePressed 落下时
    // 图标已从光标下移走，城市面板便不会打开 —— 表现为「有时点得开、
    // 有时点不开」的间歇性失败。这里用 hitTestPointer 排除「按在可交互
    // 对象上」的情形，使点击与拖拽彻底分离。
    this.input.on('pointerdown', function(pointer) {
      if (pointer.y <= 50 || pointer.y >= this._ch - 40) return;
      var hits = this.input.hitTestPointer(pointer) || [];
      if (hits.length > 0) return;
      this._dragging = true;
      this._dragStartX = pointer.x;
      this._dragStartY = pointer.y;
      this._mapStartX = this._mapContainer.x;
      this._mapStartY = this._mapContainer.y;
    }, this);

    this.input.on('pointermove', function(pointer) {
      if (!this._dragging) return;
      // 兜底：只有按键仍处于按下状态才平移。若 _dragging 因某种原因残留
      // （例如 pointerup 事件丢失），一个「未按键的移动」就会把地图平移出去，
      // 使随后的点击全部落空。这里用 pointer.isDown 直接判定物理按键状态，
      // 一旦发现按键已松开就顺手复位，彻底消除残留状态的影响。
      if (!pointer.isDown) { this._dragging = false; return; }
      var dx = pointer.x - this._dragStartX;
      var dy = pointer.y - this._dragStartY;
      this._mapContainer.x = this._mapStartX + dx;
      this._mapContainer.y = this._mapStartY + dy;
      // 缩放后地图尺寸会变，拖拽范围必须跟着重算，
      // 否则放大状态下仍按未缩放的范围限位，地图会被拖到看不见的位置。
      this._clampMapPosition();
    }, this);

    // 抬起 / 移出画布 / 指针被取消时都要复位，避免 _dragging 残留到下一次点击
    this.input.on('pointerup', function() {
      this._dragging = false;
    }, this);
    this.input.on('pointerupoutside', function() {
      this._dragging = false;
    }, this);
    this.input.on('gameout', function() {
      this._dragging = false;
    }, this);

    // 检查是否从战斗场景返回
    if (GD.phase === 'battle' && GD.battle) {
      // 上一场战斗结算后队列里仍有待处理战斗：立即接续，不要静默丢弃
      this.game.scene.stop('MapScene');
      this.game.scene.start('BattleScene');
      return;
    }
    if (GD.phase === 'strategic') {
      this._refreshAll();
    }
  }

  /**
   * 以屏幕上 (sx, sy) 点为中心缩放地图（factor 1.1 放大 10%；1/1.1 缩小 10%）。
   *
   * 做法：先反解 pivot 在地图容器内的局部坐标（容器已有缩放，故要除以当前
   * scale），套用新缩放后回写容器位置，使该世界坐标仍落在同一个屏幕点上。
   * 不做这步反解的话，缩放会连同容器原点一起漂移，视觉上像是「地图朝
   * 左上角缩」，而不是以光标为中心。
   */
  _zoomAroundScreen(sx, sy, factor) {
    var target = this._mapScale * factor;
    target = Math.min(this._mapMaxScale, Math.max(this._mapMinScale, target));
    if (Math.abs(target - this._mapScale) < 0.001) return;

    // pivot 的容器局部坐标
    var lx = (sx - this._mapContainer.x) / this._mapScale;
    var ly = (sy - this._mapContainer.y) / this._mapScale;

    this._mapScale = target;
    this._mapContainer.setScale(target);
    this._mapContainer.x = sx - lx * this._mapScale;
    this._mapContainer.y = sy - ly * this._mapScale;

    this._clampMapPosition();
    this._updateZoomText();
  }

  /**
   * 约束地图平移，防止把地图拖出可视区域过多（缩放后同样适用）。
   * 放大后地图大于画布时，两端都要允许露出空白，否则无法把角落拖进来。
   */
  _clampMapPosition() {
    var s = this._mapScale;
    var mapW = this._mapW * s;
    var mapH = this._mapH * s;
    var minX = Math.min(0, this._cw - mapW + 40);
    var maxX = this._cw - 40;
    var minY = Math.min(0, this._ch - mapH + 60);
    var maxY = this._ch - 80;
    if (this._mapContainer.x < minX) this._mapContainer.x = minX;
    if (this._mapContainer.x > maxX) this._mapContainer.x = maxX;
    if (this._mapContainer.y < minY) this._mapContainer.y = minY;
    if (this._mapContainer.y > maxY) this._mapContainer.y = maxY;
  }

  /** 还原默认视角：缩放 100% + 初始位置 */
  _resetMapView() {
    this._mapScale = this._mapDefaultScale;
    this._mapContainer.setScale(this._mapDefaultScale);
    this._mapContainer.x = this._mapHomeX;
    this._mapContainer.y = this._mapHomeY;
    this._updateZoomText();
  }

  _updateZoomText() {
    if (this._zoomText && this._zoomText.setText) {
      this._zoomText.setText(Math.round(this._mapScale * 100) + '%');
    }
  }

  /**
   * 出征高亮：己方城市绿色脉动光环、目标城市红色脉动光环、
   * 以及两者之间的行军路线与进攻方向箭头。
   *
   * 全部挂到 _mapContainer 之下，因此随地图一起平移与缩放，坐标直接用
   * 城池的地图坐标即可，不必换算。
   */
  _showDispatchHighlight(fromCityId, targetCityId) {
    this._clearDispatchHighlight();
    if (!this._dispatchHighlightLayer) {
      this._dispatchHighlightLayer = this.add.container(0, 0);
      this._mapContainer.add(this._dispatchHighlightLayer);
    }
    this._dispatchHighlightObjects = [];
    if (fromCityId) this._addCityHighlight(fromCityId, 0x33cc55, 'rgba(40,160,60,0.9)', '我方');
    if (targetCityId) this._addCityHighlight(targetCityId, 0xff3322, 'rgba(200,40,30,0.9)', '目标');
    if (fromCityId && targetCityId) this._addMarchLine(fromCityId, targetCityId);
  }

  /** 为单个城市添加脉动光环与标签 */
  _addCityHighlight(cityId, colorInt, cssColor, label) {
    var city = this._gd.cities[cityId];
    if (!city || !this._dispatchHighlightLayer) return;

    // 把 Graphics 的原点挪到圆心，缩放动画才会绕圆心而不是绕 (0,0) 晃动
    var ring = this.add.graphics();
    ring.setPosition(city.x, city.y);
    ring.lineStyle(3, colorInt, 1);
    ring.strokeCircle(0, 0, 26);
    ring.lineStyle(1, colorInt, 0.5);
    ring.strokeCircle(0, 0, 33);
    this._dispatchHighlightLayer.add(ring);
    this._dispatchHighlightObjects.push(ring);
    this.tweens.add({
      targets: ring, scaleX: 1.18, scaleY: 1.18,
      duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    var tag = this.add.text(city.x, city.y - 42, label, {
      fontSize: '12px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffffff', backgroundColor: cssColor,
      padding: { x: 6, y: 2 }, fontStyle: 'bold'
    }).setOrigin(0.5);
    this._dispatchHighlightLayer.add(tag);
    this._dispatchHighlightObjects.push(tag);
  }

  /** 行军路线：闪烁实线 + 指向目标的箭头 */
  _addMarchLine(fromCityId, targetCityId) {
    var fromCity = this._gd.cities[fromCityId];
    var toCity = this._gd.cities[targetCityId];
    if (!fromCity || !toCity || !this._dispatchHighlightLayer) return;

    var line = this.add.graphics();
    line.lineStyle(3, 0xff6633, 0.85);
    line.beginPath();
    line.moveTo(fromCity.x, fromCity.y);
    line.lineTo(toCity.x, toCity.y);
    line.strokePath();
    this._dispatchHighlightLayer.add(line);
    this._dispatchHighlightObjects.push(line);
    this.tweens.add({
      targets: line, alpha: 0.25,
      duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    var angle = Math.atan2(toCity.y - fromCity.y, toCity.x - fromCity.x);
    var arrowDist = 30;
    var ax = toCity.x - Math.cos(angle) * arrowDist;
    var ay = toCity.y - Math.sin(angle) * arrowDist;
    var arrow = this.add.graphics();
    arrow.fillStyle(0xff5533, 1);
    arrow.beginPath();
    arrow.moveTo(ax, ay);
    arrow.lineTo(ax - Math.cos(angle - 0.5) * 12, ay - Math.sin(angle - 0.5) * 12);
    arrow.lineTo(ax - Math.cos(angle + 0.5) * 12, ay - Math.sin(angle + 0.5) * 12);
    arrow.closePath();
    arrow.fillPath();
    this._dispatchHighlightLayer.add(arrow);
    this._dispatchHighlightObjects.push(arrow);
  }

  /** 清除出征高亮：必须同时停掉 tween，否则会对已销毁对象持续补间 */
  _clearDispatchHighlight() {
    if (this._dispatchHighlightObjects) {
      for (var i = 0; i < this._dispatchHighlightObjects.length; i++) {
        this.tweens.killTweensOf(this._dispatchHighlightObjects[i]);
      }
      this._dispatchHighlightObjects = [];
    }
    if (this._dispatchHighlightLayer) {
      this._dispatchHighlightLayer.removeAll(true);
    }
  }

  // 绘制地形背景
  _drawTerrain() {
    var mw = this._mapW, mh = this._mapH;
    var g = this.add.graphics();

    // 底色：古地图羊皮纸渐变
    g.fillGradientStyle(0xf2e8d5, 0xf2e8d5, 0xe8dcc4, 0xe8dcc4, 1);
    g.fillRect(0, 0, mw, mh);

    // 区域底色（淡淡的区域区分）
    var regions = [
      { x: 0, y: 0, w: 400, h: 280, color: 0xede0c8 }, // 西北
      { x: 400, y: 0, w: 400, h: 280, color: 0xf0e4cc }, // 关中/中原北
      { x: 0, y: 280, w: 350, h: 350, color: 0xe8e0c8 }, // 蜀地
      { x: 400, y: 280, w: 400, h: 200, color: 0xeee2ca }, // 中原南/荆州北
      { x: 400, y: 480, w: 300, h: 200, color: 0xeae0c8 }, // 荆州南
      { x: 700, y: 280, w: 300, h: 250, color: 0xe0e8d0 }, // 江东
      { x: 300, y: 520, w: 300, h: 200, color: 0xe0d8c0 }, // 交州
    ];
    for (var i = 0; i < regions.length; i++) {
      var r = regions[i];
      g.fillStyle(r.color, 0.4);
      g.fillRect(r.x, r.y, r.w, r.h);
    }

    // 黄河（从西到东，大约 y=235-255）
    g.lineStyle(14, 0xb8c8d8, 0.5);
    g.beginPath();
    g.moveTo(200, 230);
    g.lineTo(380, 245);
    g.lineTo(500, 240);
    g.lineTo(640, 250);
    g.lineTo(820, 240);
    g.lineTo(950, 225);
    g.strokePath();
    // 黄河内层
    g.lineStyle(8, 0xa8b8d0, 0.6);
    g.beginPath();
    g.moveTo(200, 230);
    g.lineTo(380, 245);
    g.lineTo(500, 240);
    g.lineTo(640, 250);
    g.lineTo(820, 240);
    g.lineTo(950, 225);
    g.strokePath();

    // 长江（从西到东，大约 y=450-470）
    g.lineStyle(14, 0xb8c8d8, 0.5);
    g.beginPath();
    g.moveTo(380, 445);
    g.lineTo(470, 460);
    g.lineTo(590, 470);
    g.lineTo(720, 450);
    g.lineTo(850, 440);
    g.strokePath();
    g.lineStyle(8, 0xa8b8d0, 0.6);
    g.beginPath();
    g.moveTo(380, 445);
    g.lineTo(470, 460);
    g.lineTo(590, 470);
    g.lineTo(720, 450);
    g.lineTo(850, 440);
    g.strokePath();

    // 山脉（秦岭 - 横亘关中与蜀地之间）
    this._drawMountains(g, 320, 290, 420, 310, 0xc8b898);
    // 太行山（河北与中原之间）
    this._drawMountains(g, 480, 180, 560, 220, 0xc8b898);
    // 大别山（荆州与江东之间）
    this._drawMountains(g, 580, 400, 680, 430, 0xc8b898);
    // 南方山脉
    this._drawMountains(g, 250, 530, 350, 580, 0xc8b898);
    this._drawMountains(g, 440, 550, 530, 590, 0xc8b898);

    // 外边框
    g.lineStyle(3, 0x8a7a5a, 0.6);
    g.strokeRect(0, 0, mw, mh);

    // 先将地形Graphics加入容器，再添加文字标签（确保文字渲染在上层）
    this._mapContainer.add(g);

    // 区域文字标注
    var regionLabels = [
      { x: 200, y: 60, text: '西  北', size: '18px', color: '#a89878' },
      { x: 600, y: 50, text: '河  北', size: '18px', color: '#a89878' },
      { x: 470, y: 300, text: '中  原', size: '20px', color: '#988868' },
      { x: 280, y: 400, text: '蜀  地', size: '20px', color: '#988868' },
      { x: 510, y: 500, text: '荆  州', size: '20px', color: '#988868' },
      { x: 780, y: 360, text: '江  东', size: '20px', color: '#988868' },
      { x: 400, y: 650, text: '交  州', size: '16px', color: '#a89878' }
    ];
    for (var ri = 0; ri < regionLabels.length; ri++) {
      var rl = regionLabels[ri];
      this._mapContainer.add(this.add.text(rl.x, rl.y, rl.text, {
        fontSize: rl.size, fontFamily: '"Microsoft YaHei", "SimHei", serif',
        color: rl.color, fontStyle: 'bold'
      }).setOrigin(0.5).setAlpha(0.3));
    }
  }

  // 绘制山脉
  _drawMountains(g, x1, y1, x2, y2, color) {
    var dx = x2 - x1, dy = y2 - y1;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.floor(dist / 30);
    var angle = Math.atan2(dy, dx);
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var mx = x1 + dx * t + Math.sin(i * 1.7) * 8;
      var my = y1 + dy * t + Math.cos(i * 1.3) * 6;
      // 画小三角山
      g.fillStyle(color, 0.5);
      g.fillTriangle(mx, my - 12, mx - 10, my + 6, mx + 10, my + 6);
      g.fillStyle(0xd8c8a8, 0.4);
      g.fillTriangle(mx, my - 8, mx - 6, my + 4, mx + 6, my + 4);
    }
  }

  // 绘制相邻连线（道路）
  _drawAdjacentLines() {
    var GD = this._gd;
    var line = this.add.graphics();
    var drawn = {};
    for (var cityId in GD.cities) {
      if (!GD.cities.hasOwnProperty(cityId)) continue;
      var city = GD.cities[cityId];
      for (var i = 0; i < city.adjacent.length; i++) {
        var adjId = city.adjacent[i];
        var key = cityId < adjId ? cityId + '-' + adjId : adjId + '-' + cityId;
        if (drawn[key]) continue;
        drawn[key] = true;
        var adj = GD.cities[adjId];
        if (!adj) continue;
        // 道路：虚线效果
        line.lineStyle(2, 0xb8a888, 0.5);
        line.beginPath();
        line.moveTo(city.x, city.y);
        line.lineTo(adj.x, adj.y);
        line.strokePath();
      }
    }
    this._mapContainer.add(line);
  }

  // 绘制城市
  _drawCities() {
    var GD = this._gd;
    var scene = this;

    for (var cityId in GD.cities) {
      if (!GD.cities.hasOwnProperty(cityId)) continue;
      var city = GD.cities[cityId];
      var color = (FACTION_COLORS[city.faction] || 0x888888);
      var isPass = city.type === 'pass';

      // 城池图标
      // 注意：图标必须以「自身原点」绘制，再用 icon.x/icon.y 定位到城池坐标。
      // 若改用 city.x/city.y 这样的绝对坐标绘制，Graphics 的原点仍停在 (0,0)，
      // 那么 pointerover 的 setScale(1.15) 会绕容器原点放大，把图标连同命中区
      // 一起甩出去（实测云南偏移 (+42,+89) 像素，玩家悬停后必然点不中城池）。
      var icon;
      if (isPass) {
        // 关隘：画城门图标（以 (0,0) 为中心，向下 33px 为命中区）
        icon = this.add.graphics();
        icon.fillStyle(0x6a5a3a, 1);
        icon.fillRect(-14, -10, 28, 20);
        icon.fillStyle(color, 1);
        icon.fillRect(-10, -6, 20, 16);
        // 城门洞
        icon.fillStyle(0x3a2a1a, 1);
        icon.fillRect(-4, -2, 8, 12);
        // 城墙垛口
        icon.fillStyle(0x5a4a2a, 1);
        icon.fillRect(-14, -13, 6, 4);
        icon.fillRect(-3, -13, 6, 4);
        icon.fillRect(8, -13, 6, 4);
        icon.setPosition(city.x, city.y);
        icon.setInteractive(new Phaser.Geom.Rectangle(-14, -13, 28, 33), Phaser.Geom.Rectangle.Contains);
      } else {
        // 城池：画城楼图标
        icon = this.add.graphics();
        // 底座
        icon.fillStyle(0x8a7a5a, 1);
        icon.fillRoundedRect(-16, -8, 32, 20, 2);
        // 城墙色
        icon.fillStyle(color, 1);
        icon.fillRoundedRect(-13, -5, 26, 16, 2);
        // 屋顶
        icon.fillStyle(0x5a3a1a, 1);
        icon.fillTriangle(0, -18, -14, -6, 14, -6);
        // 旗杆
        icon.fillStyle(0x4a3a2a, 1);
        icon.fillRect(-1, -24, 2, 8);
        // 旗帜
        icon.fillStyle(color, 1);
        icon.fillTriangle(1, -24, 10, -21, 1, -18);
        icon.setPosition(city.x, city.y);
        icon.setInteractive(new Phaser.Geom.Rectangle(-16, -24, 32, 36), Phaser.Geom.Rectangle.Contains);
      }
      icon.useHandCursor = true;

      // 城市名称
      var nameColor = isPass ? '#6a4a1a' : '#3a2a1a';
      var label = this.add.text(city.x, city.y + 18, city.name, {
        fontSize: isPass ? '11px' : '13px',
        fontFamily: '"Microsoft YaHei", "SimHei", serif',
        color: nameColor, stroke: '#f5f0e8', strokeThickness: 3,
        fontStyle: isPass ? 'normal' : 'bold'
      }).setOrigin(0.5);

      // 兵力
      var troops = this.add.text(city.x, city.y + 32, '', {
        fontSize: '10px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
        color: '#7a6a5a', stroke: '#f5f0e8', strokeThickness: 2
      }).setOrigin(0.5);

      this._mapContainer.add([icon, label, troops]);
      this._citySprites[cityId] = icon;
      this._cityLabels[cityId] = { label: label, troops: troops, icon: icon };

      // 点击事件
      (function(cid) {
        icon.on('pointerdown', function(pointer) {
          pointer.event.stopPropagation();
          scene._showCityPanel(cid);
        });
        icon.on('pointerover', function() { icon.setScale(1.15); });
        icon.on('pointerout', function() { icon.setScale(1); });
      })(cityId);
    }
  }

  // 重绘城池图标（势力变更时调用）
  _redrawCities() {
    var GD = this._gd;
    for (var cityId in this._citySprites) {
      if (!this._citySprites.hasOwnProperty(cityId)) continue;
      this._citySprites[cityId].destroy();
      if (this._cityLabels[cityId]) {
        if (this._cityLabels[cityId].label) this._cityLabels[cityId].label.destroy();
        if (this._cityLabels[cityId].troops) this._cityLabels[cityId].troops.destroy();
      }
    }
    this._citySprites = {};
    this._cityLabels = {};
    this._drawCities();
  }

  // 绘制行军军队
  _drawArmies() {
    for (var i = 0; i < this._armySprites.length; i++) {
      this._armySprites[i].destroy();
    }
    this._armySprites = [];

    var GD = this._gd;
    for (var j = 0; j < GD.armies.length; j++) {
      var army = GD.armies[j];
      var fromCity = GD.cities[army.fromCity];
      var toCity = GD.cities[army.targetCity];
      if (!fromCity || !toCity) continue;

      var mx = (fromCity.x + toCity.x) / 2;
      var my = (fromCity.y + toCity.y) / 2;
      var armyColor = FACTION_COLORS[army.faction] || 0x888888;

      // 军旗
      var flag = this.add.graphics();
      // 旗杆
      flag.fillStyle(0x4a3a2a, 1);
      flag.fillRect(mx - 1, my - 16, 2, 20);
      // 旗面
      flag.fillStyle(armyColor, 1);
      flag.fillTriangle(mx + 1, my - 16, mx + 16, my - 12, mx + 1, my - 8);
      flag.lineStyle(1, 0x3a2a1a, 1);
      flag.strokeTriangle(mx + 1, my - 16, mx + 16, my - 12, mx + 1, my - 8);

      var flagLabel = this.add.text(mx, my + 6, army.heroIds.length + '将', {
        fontSize: '10px', color: '#3a2a1a', stroke: '#f5f0e8', strokeThickness: 2,
        fontFamily: '"Microsoft YaHei", "SimHei", serif'
      }).setOrigin(0.5);

      this._mapContainer.add([flag, flagLabel]);
      this._armySprites.push(flag);
      this._armySprites.push(flagLabel);
    }
  }

  // 创建HUD
  _createHUD() {
    var GD = this._gd;
    var w = this._cw;

    // 顶部栏背景 - 古风深色木纹
    var topbar = this.add.graphics().setDepth(20);
    topbar.fillGradientStyle(0x2a1a0a, 0x3a2a1a, 0x1a0a00, 0x2a1a0a, 1);
    topbar.fillRect(0, 0, w, 46);
    topbar.lineStyle(2, 0x6a4a1a, 1);
    topbar.beginPath(); topbar.moveTo(0, 46); topbar.lineTo(w, 46); topbar.strokePath();
    // 顶部装饰线
    topbar.lineStyle(1, 0x8a6a2a, 0.5);
    topbar.beginPath(); topbar.moveTo(0, 44); topbar.lineTo(w, 44); topbar.strokePath();

    // 信息文本
    this._turnText = this.add.text(16, 10, '', {
      fontSize: '15px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif', fontStyle: 'bold'
    }).setDepth(21);
    this._factionText = this.add.text(130, 10, '', {
      fontSize: '15px', color: '#ff9944', fontFamily: '"Microsoft YaHei", "SimHei", serif', fontStyle: 'bold'
    }).setDepth(21);
    this._goldText = this.add.text(280, 10, '', {
      fontSize: '14px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }).setDepth(21);
    this._foodText = this.add.text(390, 10, '', {
      fontSize: '14px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }).setDepth(21);

    // 按钮
    var scene = this;
    this._createHUDButton(w - 480, '我的城池', function() { scene._showMyCitiesPanel(); }).setDepth(21);
    this._createHUDButton(w - 370, '结束回合', function() { scene._onEndTurn(); }).setDepth(21);
    this._createHUDButton(w - 270, '存档', function() {
      saveGame(0, GD.toJSON()).then(function(r) {
        scene._showToast(r.ok ? '存档成功' : r.msg);
      });
    }).setDepth(21);
    this._createHUDButton(w - 195, '读档', function() {
      loadGame(0).then(function(r) {
        if (!r.ok) { scene._showToast(r.msg || '读档失败'); return; }
        var res = GD.fromJSON(r.data);
        if (!res.ok) { scene._showToast(res.msg); return; }
        scene._refreshAll();
        scene._showToast('读档成功');
      });
    }).setDepth(21);

    // 地图缩放控件（右上角）。滚轮已可缩放，这里提供按钮与百分比显示，
    // 便于没有滚轮或不知道快捷操作的玩家使用。
    this._createHUDButton(w - 110, '＋', function() {
      scene._zoomAroundScreen(scene._cw / 2, scene._ch / 2, 1.2);
    }).setDepth(21);
    this._createHUDButton(w - 80, '－', function() {
      scene._zoomAroundScreen(scene._cw / 2, scene._ch / 2, 1 / 1.2);
    }).setDepth(21);
    this._createHUDButton(w - 50, '⟲', function() {
      scene._resetMapView();
    }).setDepth(21);
    this._zoomText = this.add.text(w - 80, 39, '100%', {
      fontSize: '10px', color: '#e8d4b0',
      fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }).setOrigin(0.5).setDepth(21);

    // 底部栏
    var bottombar = this.add.graphics().setDepth(20);
    bottombar.fillGradientStyle(0x2a1a0a, 0x3a2a1a, 0x1a0a00, 0x2a1a0a, 1);
    bottombar.fillRect(0, this._ch - 36, w, 36);
    bottombar.lineStyle(2, 0x6a4a1a, 1);
    bottombar.beginPath(); bottombar.moveTo(0, this._ch - 36); bottombar.lineTo(w, this._ch - 36); bottombar.strokePath();

    // 底部提示文字
    this.add.text(w / 2, this._ch - 18, '拖拽地图移动视角  |  点击城池查看详情', {
      fontSize: '12px', color: '#8a7a5a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }).setOrigin(0.5).setDepth(21);

    this._updateHUD();
  }

  _createHUDButton(x, label, callback) {
    var bg = this.add.graphics();
    bg.fillStyle(0x4a2a0a, 1);
    bg.fillRoundedRect(x, 8, 80, 30, 4);
    bg.lineStyle(1, 0x8a5a2a, 1);
    bg.strokeRoundedRect(x, 8, 80, 30, 4);
    bg.setDepth(20);

    var text = this.add.text(x + 40, 23, label, {
      fontSize: '13px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(21);

    text.on('pointerover', function() {
      bg.clear();
      bg.fillStyle(0x6a3a0a, 1);
      bg.fillRoundedRect(x, 8, 80, 30, 4);
      bg.lineStyle(1, 0xaa6a2a, 1);
      bg.strokeRoundedRect(x, 8, 80, 30, 4);
      bg.setDepth(20);
    });
    text.on('pointerout', function() {
      bg.clear();
      bg.fillStyle(0x4a2a0a, 1);
      bg.fillRoundedRect(x, 8, 80, 30, 4);
      bg.lineStyle(1, 0x8a5a2a, 1);
      bg.strokeRoundedRect(x, 8, 80, 30, 4);
      bg.setDepth(20);
    });
    text.on('pointerdown', callback);
    return text;
  }

  _updateHUD() {
    var GD = this._gd;
    var pf = GD.playerFaction;
    var fac = GD.factions[pf];
    var factionName = (FACTION_NAMES && FACTION_NAMES[pf]) || pf;

    if (this._turnText) this._turnText.setText('第 ' + GD.turn + ' 回合');
    if (this._factionText) this._factionText.setText('势力：' + factionName);
    if (this._goldText) this._goldText.setText('金币：' + (fac ? fac.gold : 0));
    if (this._foodText) this._foodText.setText('粮食：' + (fac ? fac.food : 0));
  }

  _showCityPanel(cityId) {
    var GD = this._gd;
    var city = GD.cities[cityId];
    if (!city) return;

    this._panelContainer.removeAll(true);
    this._panelVisible = true;
    // 打开城市面板意味着出征已结束/取消，清掉出征高亮
    this._clearDispatchHighlight();

    var panelW = 340;
    var panelH = this._ch - 100;
    var scene = this;

    // 面板背景 - 古风卷轴样式
    var panelBg = this.add.graphics();
    panelBg.fillGradientStyle(0xfaf3e6, 0xfaf3e6, 0xf0e6d0, 0xf0e6d0, 1);
    panelBg.fillRect(0, 0, panelW, panelH);
    // 左侧装饰条
    panelBg.fillStyle(0x8a6a2a, 1);
    panelBg.fillRect(0, 0, 4, panelH);
    panelBg.fillRect(panelW - 4, 0, 4, panelH);
    // 边框
    panelBg.lineStyle(2, 0xaa8a4a, 1);
    panelBg.strokeRect(0, 0, panelW, panelH);

    this._panelContainer.add(panelBg);
    this._panelContainer.x = this._cw - panelW - 10;
    this._panelContainer.y = 50;

    var y = 15;
    var isPass = city.type === 'pass';
    var factionName = (FACTION_NAMES && FACTION_NAMES[city.faction]) || city.faction;
    var factionCss = (FACTION_CSS && FACTION_CSS[city.faction]) || '#888';

    // 标题栏背景
    var titleBg = this.add.graphics();
    titleBg.fillStyle(0x4a2a0a, 0.1);
    titleBg.fillRect(10, y - 5, panelW - 20, 32);
    this._panelContainer.add(titleBg);

    // 标题
    this._panelContainer.add(this.add.text(panelW / 2, y + 10, (isPass ? '关卡 · ' : '') + city.name, {
      fontSize: '20px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#3a2a1a', fontStyle: 'bold'
    }).setOrigin(0.5));
    y += 35;

    // 势力标注
    this._panelContainer.add(this.add.text(panelW / 2, y, '势力：' + factionName, {
      fontSize: '13px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: factionCss, fontStyle: 'bold'
    }).setOrigin(0.5));
    y += 25;

    // 属性条
    if (!isPass) {
      var stats = [
        { label: '农业', value: city.agriculture, color: '#6b8e23' },
        { label: '商业', value: city.commerce, color: '#daa520' },
        { label: '士气', value: city.morale, color: '#cd853f' },
        { label: '防御', value: city.defense, color: '#708090' }
      ];

      for (var si = 0; si < stats.length; si++) {
        var s = stats[si];
        this._panelContainer.add(this.add.text(20, y, s.label, {
          fontSize: '13px', color: '#5a4a3a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
        }));
        var barBg2 = this.add.graphics();
        barBg2.fillStyle(0xe0d8c8, 1);
        barBg2.fillRoundedRect(65, y + 2, 180, 12, 3);
        var barFill2 = this.add.graphics();
        barFill2.fillStyle(Phaser.Display.Color.HexStringToColor(s.color).color, 1);
        barFill2.fillRoundedRect(65, y + 2, Math.min(180, s.value * 1.8), 12, 3);
        this._panelContainer.add([barBg2, barFill2]);
        this._panelContainer.add(this.add.text(255, y, '' + s.value, {
          fontSize: '13px', color: '#3a2a1a', fontStyle: 'bold',
          fontFamily: '"Microsoft YaHei", "SimHei", serif'
        }));
        y += 22;
      }
    } else {
      // 关隘只显示防御
      this._panelContainer.add(this.add.text(20, y, '防御', {
        fontSize: '13px', color: '#5a4a3a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
      }));
      var passDefBg = this.add.graphics();
      passDefBg.fillStyle(0xe0d8c8, 1);
      passDefBg.fillRoundedRect(65, y + 2, 180, 12, 3);
      var passDefFill = this.add.graphics();
      passDefFill.fillStyle(0x708090, 1);
      passDefFill.fillRoundedRect(65, y + 2, Math.min(180, city.defense * 1.8), 12, 3);
      this._panelContainer.add([passDefBg, passDefFill]);
      this._panelContainer.add(this.add.text(255, y, '' + city.defense, {
        fontSize: '13px', color: '#3a2a1a', fontStyle: 'bold',
        fontFamily: '"Microsoft YaHei", "SimHei", serif'
      }));
      y += 22;
      this._panelContainer.add(this.add.text(20, y, '（关隘，防御加成极高）', {
        fontSize: '12px', color: '#8a7a5a', fontFamily: '"Microsoft YaHei", "SimHei", serif', fontStyle: 'italic'
      }));
      y += 22;
    }

    // 兵力
    var currentTroops = GD.getCityTotalTroops(cityId);
    this._panelContainer.add(this.add.text(20, y, '兵力：' + currentTroops + ' / ' + city.maxTroops, {
      fontSize: '14px', color: '#3a2a1a', fontStyle: 'bold',
      fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }));
    y += 28;

    // 驻守武将
    this._panelContainer.add(this.add.text(20, y, '驻守武将', {
      fontSize: '15px', color: '#4a3a2a', fontStyle: 'bold',
      fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }));
    y += 24;

    // 武将列表必须限高：每名武将占 36px，而面板高度只有 _ch-100。
    // 后期一座城可能聚集 20+ 名武将（实测寿春 22 名），若全部平铺，
    // 「征兵 / 搜索 / 出兵 / 关闭」等按钮会被推到画布之外（实测 y≈1158，
    // 画布仅 720 高），玩家将完全无法操作该城。
    // 这里按剩余高度裁剪列表，并提示还有多少名未显示。
    var isMyCity = city.faction === GD.playerFaction;
    // 列表之后要预留的空间：操作按钮 3 行 + 关闭按钮（非己方城市无按钮）
    var reservedBelow = isMyCity ? (3 * (30 + 8) + 15 + 30) : (15 + 30);
    var maxHeroRows = Math.max(1, Math.floor((panelH - y - reservedBelow) / 36));
    var shownHeroes = Math.min(city.heroes.length, maxHeroRows);

    for (var hi = 0; hi < shownHeroes; hi++) {
      var hero = GD.heroes[city.heroes[hi]];
      if (!hero) continue;
      var statusText = { idle: '待命', developing: '内政', marches: '行军' }[hero.status] || hero.status;
      var heroColor = hero.isMonarch ? '#cc6600' : '#3a2a1a';
      var heroPrefix = hero.isMonarch ? '★ ' : '';

      // 武将头像
      this._drawHeroPortraitInPanel(20, y - 2, hero);

      this._panelContainer.add(this.add.text(55, y, heroPrefix + hero.name, {
        fontSize: '14px', color: heroColor, fontStyle: 'bold',
        fontFamily: '"Microsoft YaHei", "SimHei", serif'
      }));
      this._panelContainer.add(this.add.text(55, y + 16, statusText + '  兵' + hero.troops, {
        fontSize: '11px', color: '#7a6a5a',
        fontFamily: '"Microsoft YaHei", "SimHei", serif'
      }));
      y += 36;
    }

    if (city.heroes.length > shownHeroes) {
      this._panelContainer.add(this.add.text(25, y, '…另有 ' + (city.heroes.length - shownHeroes) + ' 名武将未显示', {
        fontSize: '12px', color: '#9a8a7a',
        fontFamily: '"Microsoft YaHei", "SimHei", serif', fontStyle: 'italic'
      }));
      y += 20;
    }

    if (city.heroes.length === 0) {
      this._panelContainer.add(this.add.text(25, y, '无驻守武将', {
        fontSize: '13px', color: '#9a8a7a',
        fontFamily: '"Microsoft YaHei", "SimHei", serif'
      }));
      y += 20;
    }

    y += 10;

    // 操作按钮 - 仅己方城市
    if (city.faction === GD.playerFaction) {
      var btnW = 95, btnH = 30, btnGap = 8;
      var btnX = 15;

      this._createPanelBtn(btnX, y, btnW, btnH, '开发农业', function() {
        scene._showHeroSelectForAction(cityId, 'agriculture');
      });
      btnX += btnW + btnGap;

      this._createPanelBtn(btnX, y, btnW, btnH, '开发商业', function() {
        scene._showHeroSelectForAction(cityId, 'commerce');
      });
      y += btnH + btnGap;
      btnX = 15;

      this._createPanelBtn(btnX, y, btnW, btnH, '征兵', function() {
        var faction = GD.factions[city.faction];
        var currentTroops2 = GD.getCityTotalTroops(cityId);
        var amount = Math.min(city.maxTroops - currentTroops2, Math.floor((faction ? faction.gold : 0) / 0.5), 2000);
        if (amount <= 0) { scene._showToast('无法征兵'); return; }
        var result = GD.recruit(cityId, amount);
        scene._showToast(result.msg);
        scene._refreshAll();
      });
      btnX += btnW + btnGap;

      this._createPanelBtn(btnX, y, btnW, btnH, '搜索', function() {
        var idleHeroes = [];
        for (var ii = 0; ii < city.heroes.length; ii++) {
          var h = GD.heroes[city.heroes[ii]];
          if (h && h.status === 'idle') idleHeroes.push(h);
        }
        if (idleHeroes.length === 0) { scene._showToast('无空闲武将'); return; }
        var best = idleHeroes[0];
        for (var jj = 1; jj < idleHeroes.length; jj++) {
          if (idleHeroes[jj].charisma > best.charisma) best = idleHeroes[jj];
        }
        var result = GD.search(cityId, best.id);
        scene._showToast(result.msg);
        scene._refreshAll();
      });
      y += btnH + btnGap;
      btnX = 15;

      this._createPanelBtn(btnX, y, btnW, btnH, '训练', function() {
        var idleHeroes2 = [];
        for (var ii2 = 0; ii2 < city.heroes.length; ii2++) {
          var h2 = GD.heroes[city.heroes[ii2]];
          if (h2 && h2.status === 'idle') idleHeroes2.push(h2);
        }
        if (idleHeroes2.length === 0) { scene._showToast('无空闲武将'); return; }
        var best2 = idleHeroes2[0];
        for (var jj2 = 1; jj2 < idleHeroes2.length; jj2++) {
          if (idleHeroes2[jj2].command > best2.command) best2 = idleHeroes2[jj2];
        }
        var result2 = GD.train(cityId, best2.id);
        scene._showToast(result2.msg);
        scene._refreshAll();
      });
      btnX += btnW + btnGap;

      this._createPanelBtn(btnX, y, btnW, btnH, '出兵', function() {
        scene._showDispatchPanel(cityId);
      });
      y += btnH + btnGap;
    }

    // 关闭按钮
    y += 5;
    this._createPanelBtn(panelW / 2 - 45, y, 90, 30, '关闭', function() {
      scene._panelContainer.removeAll(true);
      scene._panelVisible = false;
    });
  }

  // 在面板中绘制武将头像。
  // 形象由 core/portraits.js 按人物特征现场绘制：著名人物有手工设定的
  // 标志性特征（关羽长髯绿袍、夏侯惇独眼、吕布盔插雉翎等），其余人物按
  // 稳定哈希从调色板派生，保证同一人物每次一致、不同人物互不相同。
  // size 可调，坐标按比例缩放，故 30/40 都适用。
  _drawHeroPortraitInPanel(x, y, hero, size) {
    var g = this.add.graphics();
    var factionColor = (FACTION_COLORS[hero.faction] || 0x888888);
    drawHeroAvatar(g, x, y, size || 30, hero, factionColor);
    this._panelContainer.add(g);
  }

  _createPanelBtn(x, y, w, h, label, callback) {
    var bg = this.add.graphics();
    bg.fillStyle(0x5a2a0a, 1);
    bg.fillRoundedRect(x, y, w, h, 4);
    bg.lineStyle(1, 0x8a5a2a, 1);
    bg.strokeRoundedRect(x, y, w, h, 4);

    var text = this.add.text(x + w / 2, y + h / 2, label, {
      fontSize: '13px', color: '#ffd700', fontStyle: 'bold',
      fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    text.on('pointerover', function() {
      bg.clear();
      bg.fillStyle(0x7a3a0a, 1);
      bg.fillRoundedRect(x, y, w, h, 4);
      bg.lineStyle(1, 0xaa6a2a, 1);
      bg.strokeRoundedRect(x, y, w, h, 4);
    });
    text.on('pointerout', function() {
      bg.clear();
      bg.fillStyle(0x5a2a0a, 1);
      bg.fillRoundedRect(x, y, w, h, 4);
      bg.lineStyle(1, 0x8a5a2a, 1);
      bg.strokeRoundedRect(x, y, w, h, 4);
    });
    text.on('pointerdown', callback);

    this._panelContainer.add([bg, text]);
  }

  _showHeroSelectForAction(cityId, target) {
    var GD = this._gd;
    var city = GD.cities[cityId];
    var idleHeroes = [];
    for (var i = 0; i < city.heroes.length; i++) {
      var hero = GD.heroes[city.heroes[i]];
      if (hero && hero.status === 'idle') idleHeroes.push(hero);
    }
    if (idleHeroes.length === 0) { this._showToast('无空闲武将'); return; }

    idleHeroes.sort(function(a, b) { return b.politics - a.politics; });
    var result = GD.develop(cityId, idleHeroes[0].id, target);
    this._showToast(result.msg);
    this._refreshAll();
  }

  _showDispatchPanel(fromCityId) {
    var GD = this._gd;
    var fromCity = GD.cities[fromCityId];
    if (!fromCity) return;
    var scene = this;

    var allHeroes = [];
    var availableHeroes = [];
    for (var i = 0; i < fromCity.heroes.length; i++) {
      var hero = GD.heroes[fromCity.heroes[i]];
      if (!hero) continue;
      allHeroes.push(hero);
      if ((hero.status === 'idle' || hero.status === 'developing') && hero.troops > 0) {
        availableHeroes.push(hero);
      }
    }

    // 按兵力降序排列：BattleEngine.init 每方只取「前 5 名」参战，
    // 因此把兵力最多的排在最前，能保证参战的确实是本城最强的 5 名武将。
    // 若沿用城池内部的武将数组顺序，可能出现「兵力最高的排在后面而不参战」，
    // 导致玩家看到的总兵力与实际参战兵力不符（实测寿春 22 名武将时偏差极大）。
    availableHeroes.sort(function(a, b) { return b.troops - a.troops; });

    if (availableHeroes.length === 0) {
      var reason = '没有可出征的武将';
      if (allHeroes.length === 0) {
        reason = '城中无武将';
      } else {
        var noTroopsCount = 0;
        var developingCount = 0;
        for (var si = 0; si < allHeroes.length; si++) {
          if (allHeroes[si].troops <= 0) noTroopsCount++;
          if (allHeroes[si].status === 'developing') developingCount++;
        }
        if (noTroopsCount === allHeroes.length) {
          reason = '武将均无兵力，请先征兵';
        } else if (developingCount === allHeroes.length) {
          reason = '武将都在内政，请先结束回合或等待内政完成';
        } else {
          reason = '武将状态或兵力不满足出征条件';
        }
      }
      this._showToast(reason);
      return;
    }

    // 目标城市：既包括可进攻的敌对城市，也包括可增援的己方城市。
    // 后端 _armyArrive 本就支持友方城市进驻，若这里只列敌对城，
    // 后方武将将永远无法调往前线，中后期会陷入无法推进的死局。
    var targetCities = [];
    for (var j = 0; j < fromCity.adjacent.length; j++) {
      var adj = GD.cities[fromCity.adjacent[j]];
      if (adj) targetCities.push(adj);
    }
    if (targetCities.length === 0) { this._showToast('没有相邻城市'); return; }

    // 出征面板
    this._panelContainer.removeAll(true);
    this._panelVisible = true;
    // 清掉上一次出征遗留的高亮（可能来自上一次打开面板后直接取消）
    this._clearDispatchHighlight();

    var panelW = 360;
    var panelH = this._ch - 100;
    var panelBg = this.add.graphics();
    panelBg.fillGradientStyle(0xfaf3e6, 0xfaf3e6, 0xf0e6d0, 0xf0e6d0, 1);
    panelBg.fillRect(0, 0, panelW, panelH);
    panelBg.fillStyle(0x8a6a2a, 1);
    panelBg.fillRect(0, 0, 4, panelH);
    panelBg.fillRect(panelW - 4, 0, 4, panelH);
    panelBg.lineStyle(2, 0xaa8a4a, 1);
    panelBg.strokeRect(0, 0, panelW, panelH);
    this._panelContainer.add(panelBg);
    this._panelContainer.x = this._cw - panelW - 10;
    this._panelContainer.y = 50;

    var y = 15;
    this._panelContainer.add(this.add.text(panelW / 2, y + 10, '出征 - ' + fromCity.name, {
      fontSize: '18px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#3a2a1a', fontStyle: 'bold'
    }).setOrigin(0.5));
    y += 35;

    this._panelContainer.add(this.add.text(15, y, '选择出征武将（可多选）', {
      fontSize: '14px', color: '#5a4a3a', fontStyle: 'bold',
      fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }));
    y += 22;

    var selectedHeroIds = {};
    for (var sh = 0; sh < availableHeroes.length; sh++) {
      selectedHeroIds[availableHeroes[sh].id] = true;
    }

    var heroCheckboxes = [];
    // 武将勾选列表必须限高：与城市面板同理，后期一座城可能聚集 20+ 名武将，
    // 若全部平铺会把「选择目标城市」和「确认出征」按钮推出画布（实测 22 名武将时
    // 「出兵」按钮已在 y≈1158，而画布仅 720 高），玩家将无法出征。
    // 这里为「目标城市列表 + 确认/取消按钮」预留固定高度后再裁剪武将列表。
    var reservedForTargets = Math.max(1, targetCities.length) * 22 + 10 + 44;
    var maxHeroRows = Math.max(1, Math.floor((panelH - y - reservedForTargets) / 22));
    var shownHeroes = Math.min(availableHeroes.length, maxHeroRows);

    for (var hi = 0; hi < shownHeroes; hi++) {
      (function(hero) {
        var statusLabel = hero.status === 'developing' ? '(内政)' : '';
        var isMonarch = hero.isMonarch;
        var heroPrefix = isMonarch ? '★【君主】' : '';
        var heroText = heroPrefix + hero.name + '  兵' + hero.troops + statusLabel;
        var heroColor = isMonarch ? '#cc6600' : '#3a2a1a';
        var heroFontStyle = isMonarch ? 'bold' : 'normal';
        var heroFontSize = isMonarch ? '14px' : '13px';
        var heroCheckedBg = isMonarch ? 'rgba(255,215,0,0.35)' : 'rgba(255,215,0,0.2)';
        var heroUncheckedBg = isMonarch ? 'rgba(255,140,0,0.15)' : 'rgba(0,0,0,0)';

        // 头像：行高只有 22/24px，故用 20px 小图；文字相应右移到 x=44。
        scene._drawHeroPortraitInPanel(18, y - 1, hero, 20);

        var cb = scene.add.text(44, y, '[✓] ' + heroText, {
          fontSize: heroFontSize, color: heroColor, fontStyle: heroFontStyle,
          fontFamily: '"Microsoft YaHei", "SimHei", serif',
          backgroundColor: selectedHeroIds[hero.id] ? heroCheckedBg : heroUncheckedBg,
          padding: { x: 4, y: 2 }
        }).setInteractive({ useHandCursor: true });

        cb.on('pointerdown', function() {
          selectedHeroIds[hero.id] = !selectedHeroIds[hero.id];
          cb.setText('[' + (selectedHeroIds[hero.id] ? '✓' : ' ') + '] ' + heroText);
          cb.setBackgroundColor(selectedHeroIds[hero.id] ? heroCheckedBg : heroUncheckedBg);
        });

        scene._panelContainer.add(cb);
        heroCheckboxes.push(cb);
        y += isMonarch ? 24 : 22;
      })(availableHeroes[hi]);
    }
    if (availableHeroes.length > shownHeroes) {
      this._panelContainer.add(this.add.text(20, y, '…另有 ' + (availableHeroes.length - shownHeroes) + ' 名武将未显示', {
        fontSize: '12px', color: '#9a8a7a',
        fontFamily: '"Microsoft YaHei", "SimHei", serif', fontStyle: 'italic'
      }));
      y += 20;
    }
    y += 8;

    this._panelContainer.add(this.add.text(15, y, '选择目标城市', {
      fontSize: '14px', color: '#5a4a3a', fontStyle: 'bold',
      fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }));
    y += 22;

    // 默认选中：优先「可进攻的敌对城市」里最弱的一座；全是友方时才默认增援
    var weakest = null;
    var weakestTroops = Infinity;
    for (var m = 0; m < targetCities.length; m++) {
      if (targetCities[m].faction === fromCity.faction) continue;
      var mTroops = GD.getCityTotalTroops(targetCities[m].id);
      if (mTroops < weakestTroops) { weakest = targetCities[m]; weakestTroops = mTroops; }
    }
    if (!weakest) weakest = targetCities[0];
    var selectedTargetId = weakest.id;

    // 初始即高亮：我方城池绿环 + 默认目标红环 + 行军路线
    this._showDispatchHighlight(fromCityId, selectedTargetId);

    var targetRadios = [];
    var targetTexts = [];
    // 目标城市列表同样限高：寿春有 9 个相邻城市，若武将列表已占满，
    // 这里仍会把「确认出征」按钮推出画布。
    var reservedForButtons = 10 + 44;
    var maxTargetRows = Math.max(1, Math.floor((panelH - y - reservedForButtons) / 22));
    var shownTargets = Math.min(targetCities.length, maxTargetRows);
    for (var ti = 0; ti < shownTargets; ti++) {
      (function(targetCity) {
        var targetTroops = GD.getCityTotalTroops(targetCity.id);
        var targetFactionName = (FACTION_NAMES && FACTION_NAMES[targetCity.faction]) || targetCity.faction;
        var passLabel = targetCity.type === 'pass' ? '[关] ' : '';
        var isFriendly = targetCity.faction === fromCity.faction;
        var actionLabel = isFriendly ? '[增援] ' : '';
        var targetText = passLabel + actionLabel + targetCity.name + '(' + targetFactionName + ',兵' + targetTroops + ')';
        targetTexts.push(targetText);
        var radio = scene.add.text(20, y, '(' + (targetCity.id === selectedTargetId ? '●' : '○') + ') ' + targetText, {
          fontSize: '13px', color: isFriendly ? '#2a5a2a' : '#3a2a1a',
          fontFamily: '"Microsoft YaHei", "SimHei", serif',
          backgroundColor: targetCity.id === selectedTargetId ? 'rgba(255,215,0,0.2)' : 'rgba(0,0,0,0)',
          padding: { x: 4, y: 2 }
        }).setInteractive({ useHandCursor: true });

        radio.on('pointerdown', function() {
          selectedTargetId = targetCity.id;
          for (var r = 0; r < targetRadios.length; r++) {
            var rCity = targetCities[r];
            var rText = targetTexts[r];
            targetRadios[r].setText('(' + (rCity.id === selectedTargetId ? '●' : '○') + ') ' + rText);
            targetRadios[r].setBackgroundColor(rCity.id === selectedTargetId ? 'rgba(255,215,0,0.2)' : 'rgba(0,0,0,0)');
          }
          // 切换目标后立即更新地图上的红环与路线，避免面板显示的目标
          // 与地图高亮不一致（曾出现面板选 A、地图亮 B 的错觉）
          scene._showDispatchHighlight(fromCityId, selectedTargetId);
        });

        scene._panelContainer.add(radio);
        targetRadios.push(radio);
        y += 22;
      })(targetCities[ti]);
    }
    if (targetCities.length > shownTargets) {
      this._panelContainer.add(this.add.text(20, y, '…另有 ' + (targetCities.length - shownTargets) + ' 座相邻城市未显示', {
        fontSize: '12px', color: '#9a8a7a',
        fontFamily: '"Microsoft YaHei", "SimHei", serif', fontStyle: 'italic'
      }));
      y += 20;
    }
    y += 10;

    var confirmBtn = this.add.text(panelW / 2 - 90, y, '确认出征', {
      fontSize: '15px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', backgroundColor: '#5a2a0a',
      padding: { x: 18, y: 8 }, fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true });

    confirmBtn.on('pointerdown', function() {
      var heroIds = [];
      for (var hid in selectedHeroIds) {
        if (selectedHeroIds[hid]) heroIds.push(hid);
      }
      if (heroIds.length === 0) {
        scene._showToast('请至少选择一名武将');
        return;
      }
      var result = GD.dispatchArmy(fromCityId, heroIds, selectedTargetId);
      scene._showToast(result.msg);
      scene._panelContainer.removeAll(true);
      scene._panelVisible = false;
      scene._refreshAll();
    });

    var cancelBtn = this.add.text(panelW / 2 + 30, y, '取消', {
      fontSize: '15px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#c4a882', backgroundColor: '#3a2a1a',
      padding: { x: 18, y: 8 }
    }).setInteractive({ useHandCursor: true });

    cancelBtn.on('pointerdown', function() {
      scene._panelContainer.removeAll(true);
      scene._panelVisible = false;
    });

    this._panelContainer.add([confirmBtn, cancelBtn]);
  }

  _onEndTurn() {
    var GD = this._gd;
    GD.endTurn();

    if (GD.phase === 'battle' && GD.battle) {
      this.game.scene.stop('MapScene');
      this.game.scene.start('BattleScene');
      return;
    }

    this._refreshAll();
    this._showToast('第 ' + GD.turn + ' 回合');
  }

  _refreshAll() {
    var GD = this._gd;

    this._updateHUD();

    // 重绘城池图标（势力可能变更）
    this._redrawCities();

    this._drawArmies();

    if (this._panelVisible) {
      this._panelContainer.removeAll(true);
      this._panelVisible = false;
    }

    this._checkGameEnd();
  }

  _checkGameEnd() {
    if (this._gameEnded) return;
    var GD = this._gd;
    var myCities = GD.getFactionCities(GD.playerFaction);
    var totalCities = 0;
    for (var id in GD.cities) {
      if (GD.cities.hasOwnProperty(id)) totalCities++;
    }
    if (myCities.length === 0) {
      this._showGameOver(false);
    } else if (myCities.length === totalCities) {
      this._showGameOver(true);
    }
  }

  _showGameOver(isVictory) {
    this._gameEnded = true;
    var w = this._cw, h = this._ch;
    var overlay = this.add.container(0, 0).setDepth(200);

    var bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(0, 0, w, h);
    var blocker = this.add.zone(0, 0, w, h).setOrigin(0).setInteractive();
    overlay.add([bg, blocker]);

    var title = isVictory ? '一统天下！' : '国破家亡...';
    var color = isVictory ? '#ffd700' : '#cc4444';

    overlay.add(this.add.text(w / 2, h / 2 - 60, title, {
      fontSize: '48px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: color, stroke: '#3a1a00', strokeThickness: 4
    }).setOrigin(0.5));

    overlay.add(this.add.text(w / 2, h / 2, '第 ' + this._gd.turn + ' 回合', {
      fontSize: '20px', color: '#c4a882', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }).setOrigin(0.5));

    var scene = this;
    var btn = this.add.text(w / 2, h / 2 + 80, '回到主菜单', {
      fontSize: '20px', color: '#ffd700', backgroundColor: '#6a3a0a',
      padding: { x: 30, y: 12 }, fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', function() {
      scene.game.scene.stop('MapScene');
      scene.game.scene.start('MenuScene');
    });
    overlay.add(btn);
  }

  _showMyCitiesPanel() {
    var GD = this._gd;
    var scene = this;

    this._panelContainer.removeAll(true);
    this._panelVisible = true;

    var panelW = 340;
    var panelH = this._ch - 100;
    this._panelContainer.x = this._cw - panelW - 10;
    this._panelContainer.y = 50;

    var panelBg = this.add.graphics();
    panelBg.fillGradientStyle(0xfaf3e6, 0xfaf3e6, 0xf0e6d0, 0xf0e6d0, 1);
    panelBg.fillRect(0, 0, panelW, panelH);
    panelBg.fillStyle(0x8a6a2a, 1);
    panelBg.fillRect(0, 0, 4, panelH);
    panelBg.fillRect(panelW - 4, 0, 4, panelH);
    panelBg.lineStyle(2, 0xaa8a4a, 1);
    panelBg.strokeRect(0, 0, panelW, panelH);
    this._panelContainer.add(panelBg);

    this._panelContainer.add(this.add.text(panelW / 2, 18, '我的城池', {
      fontSize: '18px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#3a2a1a', fontStyle: 'bold'
    }).setOrigin(0.5));

    var myCities = [];
    for (var cid in GD.cities) {
      if (!GD.cities.hasOwnProperty(cid)) continue;
      if (GD.cities[cid].faction === GD.playerFaction) {
        myCities.push(GD.cities[cid]);
      }
    }

    var statusMap = { 'idle': '待命', 'developing': '内政', 'marching': '行军' };
    var statusColorMap = { 'idle': '#5a8a5a', 'developing': '#daa520', 'marching': '#cc4444' };

    var contentY = 45;
    var expandedCities = {};

    var renderList = function() {
      var toRemove = [];
      var children = scene._panelContainer.list;
      for (var i = 0; i < children.length; i++) {
        if (children[i] === panelBg) continue;
        if (children[i].text === '我的城池') continue;
        toRemove.push(children[i]);
      }
      for (var j = 0; j < toRemove.length; j++) {
        scene._panelContainer.remove(toRemove[j], true);
      }

      var y = contentY;

      for (var k = 0; k < myCities.length; k++) {
        var city = myCities[k];
        var troops = GD.getCityTotalTroops(city.id);
        var heroCount = city.heroes.length;
        var isExpanded = !!expandedCities[city.id];

        var expandMark = isExpanded ? '▼' : '▶';
        var cityRow = scene.add.text(10, y, expandMark + ' ' + city.name + '  兵' + troops + '  将' + heroCount, {
          fontSize: '14px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
          color: '#3a2a1a', fontStyle: 'bold',
          backgroundColor: 'rgba(138,106,42,0.12)',
          padding: { x: 4, y: 3 }
        }).setInteractive({ useHandCursor: true });

        (function(c) {
          cityRow.on('pointerdown', function() {
            expandedCities[c.id] = !expandedCities[c.id];
            renderList();
          });
        })(city);
        scene._panelContainer.add(cityRow);
        y += 24;

        if (isExpanded) {
          if (city.heroes.length === 0) {
            scene._panelContainer.add(scene.add.text(20, y, '（无武将）', {
              fontSize: '12px', color: '#9a8a7a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
            }));
            y += 18;
          } else {
            for (var h = 0; h < city.heroes.length; h++) {
              var hero = GD.heroes[city.heroes[h]];
              if (!hero) continue;
              var statusText = statusMap[hero.status] || hero.status;
              var statusColor = statusColorMap[hero.status] || '#3a2a1a';
              var devTargetText = '';
              if (hero.status === 'developing' && hero.developTarget) {
                var devName = hero.developTarget === 'agriculture' ? '农业' : '商业';
                devTargetText = '(' + devName + ')';
              }
              var isMonarch = hero.isMonarch;
              var heroPrefix = isMonarch ? '★【君主】' : '';
              var heroNameColor = isMonarch ? '#cc6600' : '#3a2a1a';
              var heroBgColor = isMonarch ? 'rgba(255,215,0,0.25)' : null;
              var heroFontStyle = isMonarch ? 'bold' : 'normal';

              // 头像
              scene._drawHeroPortraitInPanel(20, y - 2, hero);

              var heroLine = scene.add.text(55, y,
                heroPrefix + hero.name + '  兵' + hero.troops + '/' + hero.maxTroops +
                '  HP' + hero.hp + '/' + hero.maxHp +
                '  ' + statusText + devTargetText,
                {
                  fontSize: isMonarch ? '13px' : '12px',
                  fontFamily: '"Microsoft YaHei", "SimHei", serif',
                  color: heroNameColor,
                  fontStyle: heroFontStyle,
                  backgroundColor: heroBgColor,
                  padding: isMonarch ? { x: 4, y: 2 } : { x: 0, y: 0 }
                });
              scene._panelContainer.add(heroLine);
              y += 16;

              var attrLine = scene.add.text(63, y,
                '武' + hero.force + ' 智' + hero.intellect + ' 统' + hero.command +
                ' 政' + hero.politics + ' 魅' + hero.charisma +
                ' 士气' + (hero.morale || 0),
                {
                  fontSize: '10px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
                  color: isMonarch ? '#8a5a00' : '#7a6a5a',
                  fontStyle: isMonarch ? 'bold' : 'normal'
                });
              scene._panelContainer.add(attrLine);
              y += 14;

              var statusDot = scene.add.text(14, y - 30, '●', {
                fontSize: '10px', color: statusColor, fontFamily: '"Microsoft YaHei", "SimHei", serif'
              });
              scene._panelContainer.add(statusDot);
            }
          }
          var enterBtn = scene.add.text(20, y, '进入城市操作 ▶', {
            fontSize: '12px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
            color: '#ffffff', backgroundColor: '#5a2a0a',
            padding: { x: 8, y: 3 }
          }).setInteractive({ useHandCursor: true });
          (function(c) {
            enterBtn.on('pointerdown', function() {
              var targetX = scene._cw / 2 - c.x;
              var targetY = scene._ch / 2 - c.y;
              scene._mapContainer.x = targetX;
              scene._mapContainer.y = targetY;
              scene._panelContainer.removeAll(true);
              scene._panelVisible = false;
              scene._showCityPanel(c.id);
            });
          })(city);
          scene._panelContainer.add(enterBtn);
          y += 24;
          y += 4;
        }
      }

      if (myCities.length === 0) {
        scene._panelContainer.add(scene.add.text(panelW / 2, y + 10, '暂无城池', {
          fontSize: '14px', color: '#9a8a7a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
        }).setOrigin(0.5));
      }

      var closeBtn = scene.add.text(panelW / 2, panelH - 30, '关闭', {
        fontSize: '14px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
        color: '#cc4444', backgroundColor: 'rgba(0,0,0,0.1)', padding: { x: 16, y: 6 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      closeBtn.on('pointerdown', function() {
        scene._panelContainer.removeAll(true);
        scene._panelVisible = false;
      });
      scene._panelContainer.add(closeBtn);
    };

    renderList();
  }

  /**
   * 浮动提示，统一委托给共享工具，避免三个场景各写一份。
   * @param {string} msg
   */
  _showToast(msg) {
    showToast(this, msg);
  }
}

export default MapScene;
