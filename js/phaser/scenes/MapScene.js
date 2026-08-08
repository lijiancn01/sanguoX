/**
 * 三国群英传 - 战略地图场景
 * @author jian.li
 */
window.SG3 = window.SG3 || {};

window.SG3.MapScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function MapScene() {
    Phaser.Scene.call(this, { key: 'MapScene' });
  },

  create: function() {
    var GD = window.SG3.GameData;
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

    // 地图缩放（必须在 _createHUD 之前初始化，HUD 会读取 _mapScale 显示比例）
    this._mapMinScale = 0.5;
    this._mapMaxScale = 2.2;
    this._mapDefaultScale = 1.1;
    this._mapScale = 1.1;
    this._mapContainer.setScale(this._mapScale);

    // 初始位置：把地图中心放到画布中心，让中原/荆州核心区域居中显示
    this._mapContainer.x = this._cw / 2 - (this._mapW / 2) * this._mapScale;
    this._mapContainer.y = this._ch / 2 - (this._mapH / 2) * this._mapScale;
    this._clampMapPosition();
    this._mapHomeX = this._mapContainer.x;
    this._mapHomeY = this._mapContainer.y;

    // 拖拽平移
    this._dragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._mapStartX = 0;
    this._mapStartY = 0;

    // HUD
    this._createHUD();

    // 城市信息面板容器
    this._panelContainer = this.add.container(0, 0);
    this._panelContainer.setDepth(10);
    this._panelVisible = false;

    // 滚轮缩放（以鼠标指针为中心）
    var scene = this;
    this.input.on('wheel', function(pointer, gameObjects, deltaX, deltaY, deltaZ) {
      // 只在 HUD 允许区域内（避开顶栏底栏）才缩放地图
      if (pointer.y <= 50 || pointer.y >= scene._ch - 36) return;
      var factor = deltaY > 0 ? 0.9 : 1.1;
      scene._zoomAroundScreen(pointer.x, pointer.y, factor);
    });

    // 拖拽事件
    this.input.on('pointerdown', function(pointer) {
      if (pointer.y > 50 && pointer.y < this._ch - 40) {
        this._dragging = true;
        this._dragStartX = pointer.x;
        this._dragStartY = pointer.y;
        this._mapStartX = this._mapContainer.x;
        this._mapStartY = this._mapContainer.y;
      }
    }, this);

    this.input.on('pointermove', function(pointer) {
      if (this._dragging) {
        var dx = pointer.x - this._dragStartX;
        var dy = pointer.y - this._dragStartY;
        this._mapContainer.x = this._mapStartX + dx;
        this._mapContainer.y = this._mapStartY + dy;
        this._clampMapPosition();
      }
    }, this);

    this.input.on('pointerup', function() {
      this._dragging = false;
    }, this);

    // 检查是否从战斗场景返回
    if (GD.phase === 'strategic') {
      this._refreshAll();
    }
  },

  // 绘制地形背景
  _drawTerrain: function() {
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

    // 外边框
    g.lineStyle(3, 0x8a7a5a, 0.6);
    g.strokeRect(0, 0, mw, mh);

    this._mapContainer.add(g);
  },

  // 绘制山脉
  _drawMountains: function(g, x1, y1, x2, y2, color) {
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
  },

  // 绘制相邻连线（道路）
  _drawAdjacentLines: function() {
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
  },

  // 绘制城市
  _drawCities: function() {
    var GD = this._gd;
    var scene = this;

    for (var cityId in GD.cities) {
      if (!GD.cities.hasOwnProperty(cityId)) continue;
      var city = GD.cities[cityId];
      var color = (window.SG3.FACTION_COLORS[city.faction] || 0x888888);
      var isPass = city.type === 'pass';

      // 势力色的半透明底托（缩小尺寸，避免相邻城市重叠）
      var palette = icon = this.add.graphics();
      if (isPass) {
        palette.fillStyle(color, 0.28);
        palette.fillRoundedRect(city.x - 15, city.y - 13, 30, 26, 3);
        palette.lineStyle(2, color, 0.75);
        palette.strokeRoundedRect(city.x - 15, city.y - 13, 30, 26, 3);

        // 关隘：画城门图标（缩小）
        icon = this.add.graphics();
        icon.lineStyle(2, color, 1);
        icon.fillStyle(0x6a5a3a, 1);
        icon.fillRect(city.x - 12, city.y - 8, 24, 17);
        icon.strokeRect(city.x - 12, city.y - 8, 24, 17);
        // 势力色城墙
        icon.fillStyle(color, 1);
        icon.fillRect(city.x - 10, city.y - 6, 20, 15);
        icon.lineStyle(1, 0x3a2a1a, 0.6);
        icon.strokeRect(city.x - 10, city.y - 6, 20, 15);
        // 城门洞
        icon.fillStyle(0x2a1a0a, 1);
        icon.fillRect(city.x - 4, city.y - 1, 8, 10);
        // 城墙垛口（势力色）
        icon.fillStyle(color, 1);
        icon.fillRect(city.x - 12, city.y - 12, 5, 4);
        icon.fillRect(city.x - 2, city.y - 12, 5, 4);
        icon.fillRect(city.x + 7, city.y - 12, 5, 4);
        icon.lineStyle(1, 0x3a2a1a, 0.8);
        icon.strokeRect(city.x - 12, city.y - 12, 5, 4);
        icon.strokeRect(city.x - 2, city.y - 12, 5, 4);
        icon.strokeRect(city.x + 7, city.y - 12, 5, 4);
        // 旗帜
        icon.fillStyle(0x4a3a2a, 1);
        icon.fillRect(city.x - 1, city.y - 20, 2, 8);
        icon.fillStyle(color, 1);
        icon.fillTriangle(city.x + 1, city.y - 20, city.x + 10, city.y - 17, city.x + 1, city.y - 13);
        icon.lineStyle(1, 0x3a2a1a, 1);
        icon.strokeTriangle(city.x + 1, city.y - 20, city.x + 10, city.y - 17, city.x + 1, city.y - 13);
        icon.setInteractive(new Phaser.Geom.Rectangle(city.x - 15, city.y - 20, 30, 39), Phaser.Geom.Rectangle.Contains);
      } else {
        // 势力色底托 + 描边（缩小）
        palette.fillStyle(color, 0.28);
        palette.fillRoundedRect(city.x - 17, city.y - 23, 34, 36, 3);
        palette.lineStyle(2, color, 0.75);
        palette.strokeRoundedRect(city.x - 17, city.y - 23, 34, 36, 3);

        // 城池：画城楼图标（缩小）
        icon = this.add.graphics();
        // 底座
        icon.lineStyle(2, color, 1);
        icon.fillStyle(0x8a7a5a, 1);
        icon.fillRoundedRect(city.x - 14, city.y - 6, 28, 17, 2);
        icon.strokeRoundedRect(city.x - 14, city.y - 6, 28, 17, 2);
        // 势力色城墙
        icon.fillStyle(color, 1);
        icon.fillRoundedRect(city.x - 12, city.y - 4, 24, 14, 2);
        icon.lineStyle(1, 0x3a2a1a, 0.55);
        icon.strokeRoundedRect(city.x - 12, city.y - 4, 24, 14, 2);
        // 屋顶
        icon.fillStyle(0x5a3a1a, 1);
        icon.fillTriangle(city.x, city.y - 17, city.x - 13, city.y - 4, city.x + 13, city.y - 4);
        icon.lineStyle(2, color, 1);
        icon.strokeTriangle(city.x, city.y - 17, city.x - 13, city.y - 4, city.x + 13, city.y - 4);
        // 屋顶檐角
        icon.fillStyle(color, 1);
        icon.fillRect(city.x - 14, city.y - 6, 3, 3);
        icon.fillRect(city.x + 11, city.y - 6, 3, 3);
        // 旗杆 + 旗帜
        icon.fillStyle(0x4a3a2a, 1);
        icon.fillRect(city.x - 1, city.y - 25, 2, 8);
        icon.fillStyle(color, 1);
        icon.fillTriangle(city.x + 1, city.y - 25, city.x + 11, city.y - 22, city.x + 1, city.y - 18);
        icon.lineStyle(1, 0x3a2a1a, 1);
        icon.strokeTriangle(city.x + 1, city.y - 25, city.x + 11, city.y - 22, city.x + 1, city.y - 18);
        icon.setInteractive(new Phaser.Geom.Rectangle(city.x - 17, city.y - 25, 34, 41), Phaser.Geom.Rectangle.Contains);
      }
      icon.useHandCursor = true;

      // 城市名称（位置上移，适配缩小后的图标）
      var nameColor = isPass ? '#6a4a1a' : '#3a2a1a';
      var label = this.add.text(city.x, city.y + 15, city.name, {
        fontSize: isPass ? '10px' : '12px',
        fontFamily: '"Microsoft YaHei", "SimHei", serif',
        color: nameColor, stroke: '#f5f0e8', strokeThickness: 3,
        fontStyle: isPass ? 'normal' : 'bold'
      }).setOrigin(0.5);

      // 兵力
      var troops = this.add.text(city.x, city.y + 28, '', {
        fontSize: '10px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
        color: '#7a6a5a', stroke: '#f5f0e8', strokeThickness: 2
      }).setOrigin(0.5);

      this._mapContainer.add([palette, icon, label, troops]);
      this._citySprites[cityId] = icon;
      this._cityLabels[cityId] = { label: label, troops: troops, icon: icon, palette: palette };

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
  },

  // 重绘城池图标（势力变更时调用）
  _redrawCities: function() {
    var GD = this._gd;
    for (var cityId in this._citySprites) {
      if (!this._citySprites.hasOwnProperty(cityId)) continue;
      this._citySprites[cityId].destroy();
      if (this._cityLabels[cityId]) {
        if (this._cityLabels[cityId].palette) this._cityLabels[cityId].palette.destroy();
        if (this._cityLabels[cityId].label) this._cityLabels[cityId].label.destroy();
        if (this._cityLabels[cityId].troops) this._cityLabels[cityId].troops.destroy();
      }
    }
    this._citySprites = {};
    this._cityLabels = {};
    this._drawCities();
  },

  // 绘制行军军队
  _drawArmies: function() {
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
      var armyColor = window.SG3.FACTION_COLORS[army.faction] || 0x888888;

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
  },

  // 创建HUD
  _createHUD: function() {
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

    // 信息文本（右移，给左侧「势力总览」按钮腾出空间）
    this._turnText = this.add.text(100, 10, '', {
      fontSize: '15px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif', fontStyle: 'bold'
    }).setDepth(21);
    this._factionText = this.add.text(215, 10, '', {
      fontSize: '15px', color: '#ff9944', fontFamily: '"Microsoft YaHei", "SimHei", serif', fontStyle: 'bold'
    }).setDepth(21);
    this._goldText = this.add.text(360, 10, '', {
      fontSize: '14px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }).setDepth(21);
    this._foodText = this.add.text(470, 10, '', {
      fontSize: '14px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }).setDepth(21);

    // 按钮（depth 22/23，盖在信息文本上方，避免遮挡）
    var scene = this;
    this._createHUDButton(10, '势力总览', function() { scene._showFactionPanel(); }, 23);
    this._createHUDButton(w - 480, '我的城池', function() { scene._showMyCitiesPanel(); }, 22);
    this._createHUDButton(w - 370, '结束回合', function() { scene._onEndTurn(); }).setDepth(21);
    this._createHUDButton(w - 270, '存档', function() { GD.save(0); scene._showToast('存档成功'); }).setDepth(21);
    this._createHUDButton(w - 195, '读档', function() { if (GD.load(0)) { scene._refreshAll(); scene._showToast('读档成功'); } }).setDepth(21);

    // 地图缩放按钮（右上角，小尺寸）
    this._createZoomButton(w - 110, '＋', function() {
      scene._zoomAroundScreen(scene._cw / 2, scene._ch / 2, 1.2);
    }).setDepth(21);
    this._createZoomButton(w - 80, '－', function() {
      scene._zoomAroundScreen(scene._cw / 2, scene._ch / 2, 0.83);
    }).setDepth(21);
    this._createZoomButton(w - 50, '⟲', function() {
      scene._resetMapView();
    }).setDepth(21);
    // 缩放比例显示
    this._zoomText = this.add.text(w - 120, 39, '100%', {
      fontSize: '10px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }).setOrigin(0.5).setDepth(21);

    // 底部栏
    var bottombar = this.add.graphics().setDepth(20);
    bottombar.fillGradientStyle(0x2a1a0a, 0x3a2a1a, 0x1a0a00, 0x2a1a0a, 1);
    bottombar.fillRect(0, this._ch - 36, w, 36);
    bottombar.lineStyle(2, 0x6a4a1a, 1);
    bottombar.beginPath(); bottombar.moveTo(0, this._ch - 36); bottombar.lineTo(w, this._ch - 36); bottombar.strokePath();

    // 底部提示文字
    this.add.text(w / 2, this._ch - 18, '拖拽地图 · 滚轮缩放 · 点击城池查看详情 · 右上角＋－⟲ 控制缩放', {
      fontSize: '12px', color: '#8a7a5a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }).setOrigin(0.5).setDepth(21);

    this._updateHUD();
    this._updateZoomText();
  },

  _createZoomButton: function(x, label, callback) {
    var bg = this.add.graphics();
    bg.fillStyle(0x4a2a0a, 1);
    bg.fillRoundedRect(x, 8, 26, 26, 4);
    bg.lineStyle(1, 0x8a5a2a, 1);
    bg.strokeRoundedRect(x, 8, 26, 26, 4);
    bg.setDepth(20);

    var text = this.add.text(x + 13, 21, label, {
      fontSize: '18px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(21);

    text.on('pointerover', function() {
      bg.clear();
      bg.fillStyle(0x6a3a0a, 1);
      bg.fillRoundedRect(x, 8, 26, 26, 4);
      bg.lineStyle(1, 0xaa6a2a, 1);
      bg.strokeRoundedRect(x, 8, 26, 26, 4);
      bg.setDepth(20);
    });
    text.on('pointerout', function() {
      bg.clear();
      bg.fillStyle(0x4a2a0a, 1);
      bg.fillRoundedRect(x, 8, 26, 26, 4);
      bg.lineStyle(1, 0x8a5a2a, 1);
      bg.strokeRoundedRect(x, 8, 26, 26, 4);
      bg.setDepth(20);
    });
    text.on('pointerdown', callback);
    return text;
  },

  _createHUDButton: function(x, label, callback, depth) {
    var d = depth || 21;
    var bg = this.add.graphics();
    bg.fillStyle(0x4a2a0a, 1);
    bg.fillRoundedRect(x, 8, 80, 30, 4);
    bg.lineStyle(1, 0x8a5a2a, 1);
    bg.strokeRoundedRect(x, 8, 80, 30, 4);
    bg.setDepth(d - 1);

    var text = this.add.text(x + 40, 23, label, {
      fontSize: '13px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(d);

    text.on('pointerover', function() {
      bg.clear();
      bg.fillStyle(0x6a3a0a, 1);
      bg.fillRoundedRect(x, 8, 80, 30, 4);
      bg.lineStyle(1, 0xaa6a2a, 1);
      bg.strokeRoundedRect(x, 8, 80, 30, 4);
      bg.setDepth(d - 1);
    });
    text.on('pointerout', function() {
      bg.clear();
      bg.fillStyle(0x4a2a0a, 1);
      bg.fillRoundedRect(x, 8, 80, 30, 4);
      bg.lineStyle(1, 0x8a5a2a, 1);
      bg.strokeRoundedRect(x, 8, 80, 30, 4);
      bg.setDepth(d - 1);
    });
    text.on('pointerdown', callback);
    return text;
  },

  _updateHUD: function() {
    var GD = this._gd;
    var pf = GD.playerFaction;
    var fac = GD.factions[pf];
    var factionName = (window.SG3.FACTION_NAMES && window.SG3.FACTION_NAMES[pf]) || pf;

    if (this._turnText) this._turnText.setText('第 ' + GD.turn + ' 回合');
    if (this._factionText) this._factionText.setText('势力：' + factionName);
    if (this._goldText) this._goldText.setText('金币：' + (fac ? fac.gold : 0));
    if (this._foodText) this._foodText.setText('粮食：' + (fac ? fac.food : 0));
  },

  // 更新缩放比例显示
  _updateZoomText: function() {
    if (this._zoomText) {
      var pct = Math.round(this._mapScale * 100);
      this._zoomText.setText(pct + '%');
    }
  },

  // 以屏幕上 (sx, sy) 点为中心缩放地图（factor 1.1 放大 10%；0.9 缩小 10%）
  _zoomAroundScreen: function(sx, sy, factor) {
    var targetScale = this._mapScale * factor;
    // 夹到允许范围
    targetScale = Math.min(this._mapMaxScale, Math.max(this._mapMinScale, targetScale));
    if (Math.abs(targetScale - this._mapScale) < 0.001) return;

    // pivot 点当前在地图里的世界坐标：( (sx - cx) / s, (sy - cy) / s )
    var wx = (sx - this._mapContainer.x) / this._mapScale;
    var wy = (sy - this._mapContainer.y) / this._mapScale;

    // 应用新缩放
    this._mapScale = targetScale;
    this._mapContainer.setScale(targetScale);

    // 调整容器位置，使 pivot 世界坐标仍对应该屏幕点
    // cx' = sx - wx * s' ; cy' = sy - wy * s'
    this._mapContainer.x = sx - wx * this._mapScale;
    this._mapContainer.y = sy - wy * this._mapScale;

    // 约束平移范围，避免把地图拖出屏幕太远
    this._clampMapPosition();
    this._updateZoomText();
  },

  // 约束地图平移，防止拖出可视区域过多（缩放后也适用）
  _clampMapPosition: function() {
    var s = this._mapScale;
    var mapW = this._mapW * s;
    var mapH = this._mapH * s;

    // 允许地图左边最多露出空白 = min(0, this._cw - mapW)
    var minX = Math.min(0, this._cw - mapW + 40);
    var maxX = this._cw - 40;
    var minY = Math.min(0, this._ch - mapH + 60);
    var maxY = this._ch - 80;

    if (this._mapContainer.x < minX) this._mapContainer.x = minX;
    if (this._mapContainer.x > maxX) this._mapContainer.x = maxX;
    if (this._mapContainer.y < minY) this._mapContainer.y = minY;
    if (this._mapContainer.y > maxY) this._mapContainer.y = maxY;
  },

  // 还原默认视角（缩放 100% + 初始位置）
  _resetMapView: function() {
    this._mapScale = this._mapDefaultScale;
    this._mapContainer.setScale(this._mapDefaultScale);
    this._mapContainer.x = this._mapHomeX;
    this._mapContainer.y = this._mapHomeY;
    this._updateZoomText();
  },

  _showCityPanel: function(cityId) {
    var GD = this._gd;
    var city = GD.cities[cityId];
    if (!city) return;

    this._panelContainer.removeAll(true);
    this._clearDispatchHighlight();
    this._panelVisible = true;

    var panelW = 340;
    var panelH = this._ch - 100;
    var scene = this;

    // 在地图上标识被选中的城市（蓝色光环 + "选中"标签）
    this._showCitySelectHighlight(cityId);

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
    var factionName = (window.SG3.FACTION_NAMES && window.SG3.FACTION_NAMES[city.faction]) || city.faction;
    var factionCss = (window.SG3.FACTION_CSS && window.SG3.FACTION_CSS[city.faction]) || '#888';

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

    for (var hi = 0; hi < city.heroes.length; hi++) {
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
      scene._clearCitySelectHighlight();
    });
  },

  // 在面板中绘制武将头像
  _drawHeroPortraitInPanel: function(x, y, hero) {
    var g = this.add.graphics();
    var factionColor = (window.SG3.FACTION_COLORS[hero.faction] || 0x888888);

    // 头像框
    g.fillStyle(0x3a2a1a, 1);
    g.fillRoundedRect(x, y, 30, 30, 4);
    g.fillStyle(factionColor, 0.8);
    g.fillRoundedRect(x + 1, y + 1, 28, 28, 3);

    // 根据武将类型画不同图标
    var isWarrior = hero.force >= 80;
    var isStrategist = hero.intellect >= 85;
    var isMonarch = hero.isMonarch;

    if (isMonarch) {
      // 君主：皇冠
      g.fillStyle(0xffd700, 1);
      g.fillTriangle(x + 15, y + 6, x + 8, y + 14, x + 22, y + 14);
      g.fillRect(x + 9, y + 14, 12, 3);
    } else if (isStrategist) {
      // 谋士：羽扇
      g.fillStyle(0xe8e0d0, 1);
      g.fillCircle(x + 15, y + 15, 7);
      g.fillStyle(0x4a3a2a, 1);
      g.fillRect(x + 14, y + 15, 2, 8);
    } else if (isWarrior) {
      // 武将：刀剑
      g.fillStyle(0xe8e0d0, 1);
      g.fillRect(x + 14, y + 8, 2, 14);
      g.fillRect(x + 10, y + 20, 10, 2);
      g.fillStyle(0xaa6a2a, 1);
      g.fillRect(x + 13, y + 22, 4, 3);
    } else {
      // 普通：人物剪影
      g.fillStyle(0xe8e0d0, 0.8);
      g.fillCircle(x + 15, y + 12, 4);
      g.fillRect(x + 11, y + 16, 8, 8);
    }

    this._panelContainer.add(g);
  },

  _createPanelBtn: function(x, y, w, h, label, callback) {
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
  },

  _showHeroSelectForAction: function(cityId, target) {
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
  },

  _showDispatchPanel: function(fromCityId) {
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

    var targetCities = [];
    for (var j = 0; j < fromCity.adjacent.length; j++) {
      var adj = GD.cities[fromCity.adjacent[j]];
      if (adj && adj.faction !== fromCity.faction) targetCities.push(adj);
    }
    if (targetCities.length === 0) { this._showToast('没有可进攻的相邻城市'); return; }

    // 出征面板
    this._panelContainer.removeAll(true);
    // 进入出征面板：先清除普通选中高亮，再由出征专属高亮负责标识我方/目标
    this._clearCitySelectHighlight();
    this._panelVisible = true;

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
    for (var hi = 0; hi < availableHeroes.length; hi++) {
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
        var cb = scene.add.text(20, y, '[✓] ' + heroText, {
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
    y += 8;

    this._panelContainer.add(this.add.text(15, y, '选择目标城市', {
      fontSize: '14px', color: '#5a4a3a', fontStyle: 'bold',
      fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }));
    y += 22;

    var weakest = targetCities[0];
    var weakestTroops = GD.getCityTotalTroops(weakest.id);
    for (var m = 1; m < targetCities.length; m++) {
      var tTroops = GD.getCityTotalTroops(targetCities[m].id);
      if (tTroops < weakestTroops) { weakest = targetCities[m]; weakestTroops = tTroops; }
    }
    var selectedTargetId = weakest.id;

    // 在地图上高亮显示己方城市和默认目标城市
    this._showDispatchHighlight(fromCityId, selectedTargetId);

    var targetRadios = [];
    var targetTexts = [];
    for (var ti = 0; ti < targetCities.length; ti++) {
      (function(targetCity) {
        var targetTroops = GD.getCityTotalTroops(targetCity.id);
        var targetFactionName = (window.SG3.FACTION_NAMES && window.SG3.FACTION_NAMES[targetCity.faction]) || targetCity.faction;
        var passLabel = targetCity.type === 'pass' ? '[关] ' : '';
        var targetText = passLabel + targetCity.name + '(' + targetFactionName + ',兵' + targetTroops + ')';
        targetTexts.push(targetText);
        var radio = scene.add.text(20, y, '(' + (targetCity.id === selectedTargetId ? '●' : '○') + ') ' + targetText, {
          fontSize: '13px', color: '#3a2a1a',
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
          // 切换目标城市时更新地图高亮
          scene._showDispatchHighlight(fromCityId, selectedTargetId);
        });

        scene._panelContainer.add(radio);
        targetRadios.push(radio);
        y += 22;
      })(targetCities[ti]);
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
      scene._clearDispatchHighlight();
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
      scene._clearDispatchHighlight();
    });

    this._panelContainer.add([confirmBtn, cancelBtn]);
  },

  _onEndTurn: function() {
    var GD = this._gd;
    GD.endTurn();

    if (GD.phase === 'battle' && GD.battle) {
      this.game.scene.stop('MapScene');
      this.game.scene.start('BattleScene');
      return;
    }

    this._refreshAll();
    this._showToast('第 ' + GD.turn + ' 回合');
  },

  _refreshAll: function() {
    var GD = this._gd;

    this._updateHUD();
    this._clearDispatchHighlight();
    this._clearCitySelectHighlight();

    // 重绘城池图标（势力可能变更）
    this._redrawCities();

    this._drawArmies();

    if (this._panelVisible) {
      this._panelContainer.removeAll(true);
      this._panelVisible = false;
    }

    this._checkGameEnd();
  },

  _checkGameEnd: function() {
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
  },

  _showGameOver: function(isVictory) {
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
  },

  _showMyCitiesPanel: function() {
    var GD = this._gd;
    var scene = this;

    this._panelContainer.removeAll(true);
    this._clearCitySelectHighlight();
    this._clearDispatchHighlight();
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
        scene._clearCitySelectHighlight();
      });
      scene._panelContainer.add(closeBtn);
    };

    renderList();
  },

  // 势力总览左侧面板（三级：势力列表 → 城市列表 → 武将明细）
  _showFactionPanel: function() {
    var GD = this._gd;
    var scene = this;

    this._panelContainer.removeAll(true);
    this._clearCitySelectHighlight();
    this._clearDispatchHighlight();
    this._panelVisible = true;

    var panelW = 310;
    var panelH = this._ch - 100;
    this._panelContainer.x = 10;
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

    // 找每个势力的君主：优先 isMonarch，否则取魅力最高武将
    var findMonarch = function(factionId) {
      var list = GD.getFactionHeroes(factionId);
      if (list.length === 0) return null;
      var monarch = null;
      for (var m = 0; m < list.length; m++) {
        if (list[m].isMonarch) { monarch = list[m]; break; }
      }
      if (monarch) return monarch;
      var best = list[0];
      for (var m2 = 1; m2 < list.length; m2++) {
        if (list[m2].charisma > best.charisma) best = list[m2];
      }
      return best;
    };

    var getFactionTroops = function(factionId) {
      var cities = GD.getFactionCities(factionId);
      var t = 0;
      for (var ci = 0; ci < cities.length; ci++) {
        t += GD.getCityTotalTroops(cities[ci].id);
      }
      return t;
    };

    var stack = []; // 下钻历史：'faction' / {type:'cities', factionId} / {type:'heroes', cityId}

    var titleText = scene.add.text(panelW / 2, 20, '势力总览', {
      fontSize: '19px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#3a2a1a', fontStyle: 'bold'
    }).setOrigin(0.5);
    scene._panelContainer.add(titleText);

    var backBtn = scene.add.text(28, 20, '◀ 返回', {
      fontSize: '12px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#8a5a2a', backgroundColor: 'rgba(138,106,42,0.12)',
      padding: { x: 5, y: 2 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);

    var closeBtn = scene.add.text(panelW - 28, 20, '✕ 关闭', {
      fontSize: '12px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#cc4444', backgroundColor: 'rgba(204,68,68,0.1)',
      padding: { x: 5, y: 2 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // 重要：panel 内所有“下钻/返回/关闭”动作都会在下一帧才清理/重绘，
    // 避免在 Phaser 派发 pointerdown 过程中销毁正在接收事件的对象，卡死输入系统。
    var schedule = function(fn) { scene.time.delayedCall(0, fn); };

    closeBtn.on('pointerdown', function() {
      schedule(function() {
        scene._panelContainer.removeAll(true);
        scene._panelVisible = false;
        scene._clearCitySelectHighlight();
      });
    });
    scene._panelContainer.add([backBtn, closeBtn]);

    var render = function() {
      // 清理非装饰内容（保留 panelBg + 顶栏标题/返回/关闭）
      var toRemove = [];
      var children = scene._panelContainer.list;
      var keepers = new Set();
      keepers.add(panelBg);
      keepers.add(titleText);
      keepers.add(backBtn);
      keepers.add(closeBtn);
      for (var k = 0; k < children.length; k++) {
        if (!keepers.has(children[k])) toRemove.push(children[k]);
      }
      for (var r = 0; r < toRemove.length; r++) {
        scene._panelContainer.remove(toRemove[r], true);
      }

      backBtn.setVisible(stack.length > 0);

      var viewState = stack.length === 0 ? 'faction' : stack[stack.length - 1].type;
      var contentY = 50;
      var contentH = panelH - 75;

      if (viewState === 'faction') {
        titleText.setText('势力总览');

        // 统计所有势力
        var factionIds = [];
        for (var fId in GD.factions) {
          if (GD.factions.hasOwnProperty(fId)) factionIds.push(fId);
        }
        for (var cId in GD.cities) {
          if (!GD.cities.hasOwnProperty(cId)) continue;
          var fid = GD.cities[cId].faction;
          if (factionIds.indexOf(fid) === -1) factionIds.push(fid);
        }

        var factionRows = [];
        for (var fi = 0; fi < factionIds.length; fi++) {
          var fid2 = factionIds[fi];
          var facCities = GD.getFactionCities(fid2);
          var facHeroes = GD.getFactionHeroes(fid2);
          if (facCities.length === 0 && facHeroes.length === 0 && fid2 !== 'none') continue;
          var monarch = findMonarch(fid2);
          var facTroops = getFactionTroops(fid2);
          factionRows.push({
            factionId: fid2,
            cityCount: facCities.length,
            heroCount: facHeroes.length,
            troops: facTroops,
            monarch: monarch
          });
        }
        factionRows.sort(function(a, b) { return b.cityCount - a.cityCount; });

        for (var ri = 0; ri < factionRows.length; ri++) {
          var row = factionRows[ri];
          var facColor = (window.SG3.FACTION_COLORS[row.factionId] || 0x888888);
          var facCss = (window.SG3.FACTION_CSS && window.SG3.FACTION_CSS[row.factionId]) || '#888888';
          var facName = (window.SG3.FACTION_NAMES && window.SG3.FACTION_NAMES[row.factionId]) || row.factionId;
          var monarchName = row.monarch ? (row.monarch.isMonarch ? '★' : '') + row.monarch.name : '（无代表）';
          var isPlayer = row.factionId === GD.playerFaction;

          // 行背景（整行唯一可点击对象，其他元素均不设 interactive，指针穿透到此）
          var rowBg = scene.add.graphics();
          rowBg.fillStyle(facColor, 0.12);
          rowBg.fillRoundedRect(12, contentY, panelW - 24, 60, 4);
          rowBg.lineStyle(1, facColor, 0.65);
          rowBg.strokeRoundedRect(12, contentY, panelW - 24, 60, 4);
          if (isPlayer) {
            rowBg.lineStyle(2, 0xffd700, 1);
            rowBg.strokeRoundedRect(12, contentY, panelW - 24, 60, 4);
          }
          scene._panelContainer.add(rowBg);

          // 势力色块（22x22）
          var colorBox = scene.add.graphics();
          colorBox.fillStyle(facColor, 1);
          colorBox.fillRoundedRect(22, contentY + 19, 22, 22, 3);
          colorBox.lineStyle(1, 0x3a2a1a, 0.7);
          colorBox.strokeRoundedRect(22, contentY + 19, 22, 22, 3);
          scene._panelContainer.add(colorBox);

          // 势力名（君主）
          scene._panelContainer.add(scene.add.text(54, contentY + 8, facName + (isPlayer ? '（我方）' : ''), {
            fontSize: '15px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
            color: '#3a2a1a', fontStyle: 'bold'
          }));

          scene._panelContainer.add(scene.add.text(54, contentY + 29, '君主：' + monarchName, {
            fontSize: '12px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
            color: row.monarch && row.monarch.isMonarch ? '#cc6600' : facCss,
            fontStyle: row.monarch && row.monarch.isMonarch ? 'bold' : 'normal'
          }));

          // 统计项（右侧对齐）
          var statStr = '城 ' + row.cityCount + '  将 ' + row.heroCount + '  兵 ' + row.troops;
          scene._panelContainer.add(scene.add.text(panelW - 42, contentY + 41, statStr, {
            fontSize: '12px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
            color: '#5a4a3a', fontStyle: 'bold'
          }).setOrigin(1, 0));

          // 右侧下钻 ▶ 提示
          scene._panelContainer.add(scene.add.text(panelW - 22, contentY + 28, '▶', {
            fontSize: '11px', color: '#aa7a2a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
          }).setOrigin(0.5));

          // 整行仅 rowBg 接收点击，下一帧重绘
          (function(factionData, cy) {
            rowBg.setInteractive(
              new Phaser.Geom.Rectangle(12, cy, panelW - 24, 60),
              Phaser.Geom.Rectangle.Contains
            ).once('pointerdown', function() {
              stack.push({ type: 'cities', factionId: factionData.factionId });
              schedule(render);
            });
            // pointerover 时显示小手型（用户移到 rowBg 上就提示可点击）
            rowBg.on('pointerover', function() { scene.input.setDefaultCursor('pointer'); });
            rowBg.on('pointerout',  function() { scene.input.setDefaultCursor('default'); });
          })(row, contentY);

          contentY += 70;
          if (contentY > contentH) break;
        }

      } else if (viewState === 'cities') {
        var cur = stack[stack.length - 1];
        var curFacId = cur.factionId;
        var curFacName = (window.SG3.FACTION_NAMES && window.SG3.FACTION_NAMES[curFacId]) || curFacId;
        titleText.setText(curFacName + ' · 城市列表');
        var curFacColor = (window.SG3.FACTION_COLORS[curFacId] || 0x888888);

        var facCities = GD.getFactionCities(curFacId);
        if (facCities.length === 0) {
          scene._panelContainer.add(scene.add.text(panelW / 2, 80, '该势力暂无占领城市', {
            fontSize: '13px', color: '#9a8a7a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
          }).setOrigin(0.5));
        }

        for (var ci2 = 0; ci2 < facCities.length; ci2++) {
          var ct = facCities[ci2];
          var isPass = ct.type === 'pass';
          var cTroops = GD.getCityTotalTroops(ct.id);
          var heroCount = ct.heroes.length;

          // 行背景（整行唯一可点击区域，除定位按钮外）
          var rowBg2 = scene.add.graphics();
          rowBg2.fillStyle(curFacColor, 0.1);
          rowBg2.fillRoundedRect(12, contentY, panelW - 24, 50, 4);
          rowBg2.lineStyle(1, curFacColor, 0.55);
          rowBg2.strokeRoundedRect(12, contentY, panelW - 24, 50, 4);
          scene._panelContainer.add(rowBg2);

          // 左侧小色块
          var cb2 = scene.add.graphics();
          cb2.fillStyle(curFacColor, 1);
          cb2.fillRoundedRect(20, contentY + 14, 14, 22, 3);
          scene._panelContainer.add(cb2);

          var nameLine = (isPass ? '关 · ' : '') + ct.name;
          scene._panelContainer.add(scene.add.text(44, contentY + 6, nameLine, {
            fontSize: '14px', color: '#3a2a1a', fontStyle: 'bold',
            fontFamily: '"Microsoft YaHei", "SimHei", serif'
          }));

          var statLine = '武将 ' + heroCount + ' 人  ·  兵力 ' + cTroops + ' / ' + ct.maxTroops;
          scene._panelContainer.add(scene.add.text(44, contentY + 28, statLine, {
            fontSize: '12px', color: '#5a4a3a',
            fontFamily: '"Microsoft YaHei", "SimHei", serif'
          }));

          // 右侧：定位按钮（独立可点击，不影响下钻）
          var gotoBtn = scene.add.text(panelW - 52, contentY + 13, '定位', {
            fontSize: '11px', color: '#4488cc', backgroundColor: 'rgba(68,136,204,0.12)',
            padding: { x: 5, y: 2 }, fontFamily: '"Microsoft YaHei", "SimHei", serif'
          }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
          scene._panelContainer.add(gotoBtn);

          // 下钻 ▶ 提示
          scene._panelContainer.add(scene.add.text(panelW - 22, contentY + 25, '▶', {
            fontSize: '11px', color: '#aa7a2a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
          }).setOrigin(0.5));

          (function(cityObj, cy, gBtn) {
            // 定位按钮（只定位，不进下钻）
            gBtn.on('pointerdown', function() {
              var tx = scene._cw / 2 - cityObj.x * scene._mapScale;
              var ty = scene._ch / 2 - cityObj.y * scene._mapScale;
              scene._mapContainer.x = tx;
              scene._mapContainer.y = ty;
              scene._clampMapPosition();
              scene._showCitySelectHighlight(cityObj.id);
            });

            // 行背景点击：下钻到武将明细（下一帧重绘）
            rowBg2.setInteractive(
              new Phaser.Geom.Rectangle(12, cy, panelW - 24, 50),
              Phaser.Geom.Rectangle.Contains
            ).once('pointerdown', function() {
              stack.push({ type: 'heroes', cityId: cityObj.id });
              scene._showCitySelectHighlight(cityObj.id);
              schedule(render);
            });
            rowBg2.on('pointerover', function() { scene.input.setDefaultCursor('pointer'); });
            rowBg2.on('pointerout',  function() { scene.input.setDefaultCursor('default'); });
          })(ct, contentY, gotoBtn);

          contentY += 58;
          if (contentY > contentH) break;
        }

      } else if (viewState === 'heroes') {
        var cur2 = stack[stack.length - 1];
        var city2 = GD.cities[cur2.cityId];
        if (!city2) { stack.pop(); schedule(render); return; }
        titleText.setText(city2.name + ' · 武将详情');
        scene._showCitySelectHighlight(city2.id);

        var cTroops2 = GD.getCityTotalTroops(city2.id);
        var curFacCss2 = (window.SG3.FACTION_CSS && window.SG3.FACTION_CSS[city2.faction]) || '#888888';
        var summaryText = '所属：' + ((window.SG3.FACTION_NAMES && window.SG3.FACTION_NAMES[city2.faction]) || city2.faction) +
                          '  ·  总兵力 ' + cTroops2 + ' / ' + city2.maxTroops;
        scene._panelContainer.add(scene.add.text(15, contentY, summaryText, {
          fontSize: '12px', color: curFacCss2, fontFamily: '"Microsoft YaHei", "SimHei", serif'
        }));
        contentY += 20;

        if (city2.heroes.length === 0) {
          scene._panelContainer.add(scene.add.text(panelW / 2, contentY + 20, '该城无驻守武将', {
            fontSize: '13px', color: '#9a8a7a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
          }).setOrigin(0.5));
        }

        for (var hi2 = 0; hi2 < city2.heroes.length; hi2++) {
          var hero2 = GD.heroes[city2.heroes[hi2]];
          if (!hero2) continue;
          var isMono = hero2.isMonarch;
          var heroColor2 = isMono ? '#cc6600' : '#3a2a1a';
          var statusMap = { idle: '待命', developing: '内政中', marching: '行军中' };
          var statusTxt = statusMap[hero2.status] || hero2.status;
          var hpPct = Math.max(0, Math.round((hero2.hp / (hero2.maxHp || 100)) * 100));

          var rowBg3 = scene.add.graphics();
          rowBg3.fillStyle(isMono ? 0xffd700 : 0x8a6a2a, isMono ? 0.18 : 0.08);
          rowBg3.fillRoundedRect(12, contentY, panelW - 24, 46, 3);
          rowBg3.lineStyle(1, isMono ? 0xffd700 : 0xaa8a4a, isMono ? 0.8 : 0.5);
          rowBg3.strokeRoundedRect(12, contentY, panelW - 24, 46, 3);
          scene._panelContainer.add(rowBg3);

          var headG = scene.add.graphics();
          var headColor = (window.SG3.FACTION_COLORS[hero2.faction] || 0x888888);
          headG.fillStyle(0x3a2a1a, 1);
          headG.fillRoundedRect(20, contentY + 8, 30, 30, 4);
          headG.fillStyle(headColor, 0.9);
          headG.fillRoundedRect(21, contentY + 9, 28, 28, 3);
          headG.fillStyle(0xfaf3e6, 1);
          headG.fillCircle(35, contentY + 20, 4);
          headG.fillRect(31, contentY + 24, 8, 8);
          scene._panelContainer.add(headG);

          var heroName = (isMono ? '★ ' : '') + hero2.name;
          var heroFontSize = isMono ? '14px' : '13px';
          scene._panelContainer.add(scene.add.text(58, contentY + 6, heroName, {
            fontSize: heroFontSize, color: heroColor2, fontStyle: isMono ? 'bold' : 'normal',
            fontFamily: '"Microsoft YaHei", "SimHei", serif'
          }));

          var heroAttr = '武' + hero2.force + ' 智' + hero2.intellect + ' 统' + hero2.command +
                         ' 政' + hero2.politics + '  HP' + hpPct + '%';
          scene._panelContainer.add(scene.add.text(58, contentY + 24, heroAttr, {
            fontSize: '11px', color: '#7a6a5a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
          }));

          var rightStr = '兵 ' + hero2.troops + '/' + hero2.maxTroops + '  ' + statusTxt;
          scene._panelContainer.add(scene.add.text(panelW - 20, contentY + 23, rightStr, {
            fontSize: '12px', color: '#3a2a1a', fontStyle: 'bold',
            fontFamily: '"Microsoft YaHei", "SimHei", serif'
          }).setOrigin(1, 0));

          contentY += 54;
          if (contentY > contentH) break;
        }
      }

      var hintLine = scene.add.graphics();
      hintLine.lineStyle(1, 0xccb888, 0.5);
      hintLine.beginPath();
      hintLine.moveTo(12, panelH - 42);
      hintLine.lineTo(panelW - 12, panelH - 42);
      hintLine.strokePath();
      scene._panelContainer.add(hintLine);

      var tip = (viewState === 'faction')
        ? '点击任意势力行查看该势力所有城市'
        : (viewState === 'cities'
            ? '点击城市行查看武将明细 · 点「定位」居中该城 · 右上角返回上级'
            : '武将明细：君主★标记 · 五维 · HP · 带兵 · 状态');
      scene._panelContainer.add(scene.add.text(panelW / 2, panelH - 28, tip, {
        fontSize: '11px', color: '#8a7a5a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
      }).setOrigin(0.5));
    };

    backBtn.on('pointerdown', function() {
      schedule(function() {
        if (stack.length > 0) {
          stack.pop();
          if (stack.length === 0) scene._clearCitySelectHighlight();
          else {
            var top = stack[stack.length - 1];
            if (top.type === 'cities') scene._clearCitySelectHighlight();
          }
          render();
        }
      });
    });

    render();
  },

  // 选中城市高亮：点击城市查看详情时，在地图上标识该城市（蓝色光环 + "选中"标签）
  _showCitySelectHighlight: function(cityId) {
    this._clearCitySelectHighlight();
    if (!this._citySelectHighlightLayer) {
      this._citySelectHighlightLayer = this.add.container(0, 0);
      this._mapContainer.add(this._citySelectHighlightLayer);
    }
    this._citySelectHighlightObjects = [];

    var city = this._gd.cities[cityId];
    if (!city) return;

    var ring = this.add.graphics();
    // 关键：把 Graphics 定位到圆心，再以本地 (0,0) 画圆 —— 缩放中心 = 圆心，不会晃动
    ring.setPosition(city.x, city.y);
    ring.lineStyle(3, 0x3388ff, 1);
    ring.strokeCircle(0, 0, 28);
    ring.lineStyle(1, 0x3388ff, 0.45);
    ring.strokeCircle(0, 0, 36);
    this._citySelectHighlightLayer.add(ring);
    this.tweens.add({
      targets: ring,
      scaleX: 1.15, scaleY: 1.15,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    this._citySelectHighlightObjects.push(ring);

    var tag = this.add.text(city.x, city.y - 44, '选中', {
      fontSize: '12px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffffff', backgroundColor: 'rgba(40,110,220,0.92)',
      padding: { x: 6, y: 2 }, fontStyle: 'bold'
    }).setOrigin(0.5);
    this._citySelectHighlightLayer.add(tag);
    this._citySelectHighlightObjects.push(tag);
  },

  // 清除选中城市高亮
  _clearCitySelectHighlight: function() {
    if (this._citySelectHighlightObjects) {
      for (var k = 0; k < this._citySelectHighlightObjects.length; k++) {
        this.tweens.killTweensOf(this._citySelectHighlightObjects[k]);
      }
      this._citySelectHighlightObjects = [];
    }
    if (this._citySelectHighlightLayer) {
      this._citySelectHighlightLayer.removeAll(true);
    }
  },

  // 出征高亮：在地图上高亮显示己方城市和目标城市，并绘制行军路线预览
  _showDispatchHighlight: function(fromCityId, targetCityId) {
    this._clearDispatchHighlight();
    if (!this._dispatchHighlightLayer) {
      this._dispatchHighlightLayer = this.add.container(0, 0);
      this._mapContainer.add(this._dispatchHighlightLayer);
    }
    this._dispatchHighlightObjects = [];
    // 己方城市：绿色脉动光环
    if (fromCityId) {
      this._addCityHighlight(fromCityId, 0x33cc55, 'rgba(40,160,60,0.9)', '我方');
    }
    // 目标城市：红色脉动光环
    if (targetCityId) {
      this._addCityHighlight(targetCityId, 0xff3322, 'rgba(200,40,30,0.9)', '目标');
    }
    // 行军路线预览
    if (fromCityId && targetCityId) {
      this._addMarchLine(fromCityId, targetCityId);
    }
  },

  // 为单个城市添加脉动光环与标签
  _addCityHighlight: function(cityId, colorInt, cssColor, label) {
    var city = this._gd.cities[cityId];
    if (!city) return;
    var ring = this.add.graphics();
    // 关键：把 Graphics 定位到圆心，缩放中心 = 圆心，不会晃动
    ring.setPosition(city.x, city.y);
    ring.lineStyle(3, colorInt, 1);
    ring.strokeCircle(0, 0, 26);
    ring.lineStyle(1, colorInt, 0.5);
    ring.strokeCircle(0, 0, 33);
    this._dispatchHighlightLayer.add(ring);
    // 脉动动画
    this.tweens.add({
      targets: ring,
      scaleX: 1.18, scaleY: 1.18,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    this._dispatchHighlightObjects.push(ring);

    var tag = this.add.text(city.x, city.y - 42, label, {
      fontSize: '12px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffffff', backgroundColor: cssColor,
      padding: { x: 6, y: 2 }, fontStyle: 'bold'
    }).setOrigin(0.5);
    this._dispatchHighlightLayer.add(tag);
    this._dispatchHighlightObjects.push(tag);
  },

  // 绘制从己方城市到目标城市的行军路线（闪烁虚线 + 箭头）
  _addMarchLine: function(fromCityId, targetCityId) {
    var fromCity = this._gd.cities[fromCityId];
    var toCity = this._gd.cities[targetCityId];
    if (!fromCity || !toCity) return;

    var line = this.add.graphics();
    // 闪烁实线作为路线
    line.lineStyle(3, 0xff6633, 0.85);
    line.beginPath();
    line.moveTo(fromCity.x, fromCity.y);
    line.lineTo(toCity.x, toCity.y);
    line.strokePath();
    this._dispatchHighlightLayer.add(line);
    this._dispatchHighlightObjects.push(line);
    this.tweens.add({
      targets: line,
      alpha: 0.25,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 在目标城市附近画箭头，指示进攻方向
    var angle = Math.atan2(toCity.y - fromCity.y, toCity.x - fromCity.x);
    var arrowDist = 30;
    var ax = toCity.x - Math.cos(angle) * arrowDist;
    var ay = toCity.y - Math.sin(angle) * arrowDist;
    var arrow = this.add.graphics();
    arrow.fillStyle(0xff5533, 1);
    arrow.beginPath();
    arrow.moveTo(ax, ay);
    arrow.lineTo(
      ax - Math.cos(angle - 0.5) * 12,
      ay - Math.sin(angle - 0.5) * 12
    );
    arrow.lineTo(
      ax - Math.cos(angle + 0.5) * 12,
      ay - Math.sin(angle + 0.5) * 12
    );
    arrow.closePath();
    arrow.fillPath();
    this._dispatchHighlightLayer.add(arrow);
    this._dispatchHighlightObjects.push(arrow);
  },

  // 清除出征高亮
  _clearDispatchHighlight: function() {
    if (this._dispatchHighlightObjects) {
      for (var i = 0; i < this._dispatchHighlightObjects.length; i++) {
        this.tweens.killTweensOf(this._dispatchHighlightObjects[i]);
      }
      this._dispatchHighlightObjects = [];
    }
    if (this._dispatchHighlightLayer) {
      this._dispatchHighlightLayer.removeAll(true);
    }
  },

  _showToast: function(msg) {
    var toast = this.add.text(this._cw / 2, 60, msg, {
      fontSize: '16px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', backgroundColor: 'rgba(0,0,0,0.8)',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: toast, alpha: 0, y: toast.y - 30,
      duration: 2000, ease: 'Power2',
      onComplete: function() { toast.destroy(); }
    });
  }
});
