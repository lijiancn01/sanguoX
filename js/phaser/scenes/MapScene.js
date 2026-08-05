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

    var cam = this.cameras.main;
    this._cw = cam.width;
    this._ch = cam.height;

    // 地图容器（可拖拽平移）
    this._mapContainer = this.add.container(0, 0);

    // 绘制地图背景 - 古风纸张色
    var mapW = 700, mapH = 600;
    var mapBg = this.add.graphics();
    mapBg.fillGradientStyle(0xf5f0e8, 0xf5f0e8, 0xe8e0d0, 0xe8e0d0, 1);
    mapBg.fillRect(0, 0, mapW, mapH);
    // 网格线
    mapBg.lineStyle(1, 0xd8d0c0, 0.5);
    for (var gx = 0; gx < mapW; gx += 50) { mapBg.beginPath(); mapBg.moveTo(gx, 0); mapBg.lineTo(gx, mapH); mapBg.strokePath(); }
    for (var gy = 0; gy < mapH; gy += 50) { mapBg.beginPath(); mapBg.moveTo(0, gy); mapBg.lineTo(mapW, gy); mapBg.strokePath(); }
    this._mapContainer.add(mapBg);

    // 绘制相邻连线
    this._drawAdjacentLines();

    // 绘制城市节点
    this._citySprites = {};
    this._cityLabels = {};
    this._drawCities();

    // 绘制行军军队
    this._armySprites = [];
    this._drawArmies();

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

    // 设置地图初始位置（居中偏左，给右侧面板留空）
    this._mapContainer.x = 20;
    this._mapContainer.y = 50;

    // 拖拽事件
    this.input.on('pointerdown', function(pointer) {
      if (pointer.y > 50 && pointer.y < this._ch - 50) {
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

  // 绘制相邻连线
  _drawAdjacentLines: function() {
    var GD = this._gd;
    var line = this.add.graphics();
    line.lineStyle(1, 0xc0b090, 0.6);
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

      // 城市圆圈
      var circle = this.add.circle(city.x, city.y, 18, color);
      circle.setStrokeStyle(2, 0x5a3a1a);
      circle.setInteractive({ useHandCursor: true });

      // 城市名称
      var label = this.add.text(city.x, city.y - 28, city.name, {
        fontSize: '12px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
        color: '#3a2a1a', stroke: '#f5f0e8', strokeThickness: 2
      }).setOrigin(0.5);

      // 兵力
      var troops = this.add.text(city.x, city.y + 24, '' + GD.getCityTotalTroops(cityId), {
        fontSize: '10px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
        color: '#6a5a4a'
      }).setOrigin(0.5);

      this._mapContainer.add([circle, label, troops]);
      this._citySprites[cityId] = circle;
      this._cityLabels[cityId] = { label: label, troops: troops };

      // 点击事件
      (function(cid) {
        circle.on('pointerdown', function(pointer) {
          pointer.event.stopPropagation();
          scene._showCityPanel(cid);
        });
        circle.on('pointerover', function() { circle.setScale(1.3); });
        circle.on('pointerout', function() { circle.setScale(1); });
      })(cityId);
    }
  },

  // 绘制行军军队
  _drawArmies: function() {
    // 清除旧的
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

      // 在路径中间绘制军旗
      var mx = (fromCity.x + toCity.x) / 2;
      var my = (fromCity.y + toCity.y) / 2;
      var armyColor = window.SG3.FACTION_COLORS[army.faction] || 0x888888;

      var flag = this.add.polygon(mx, my - 10, [0, 0, 16, 8, 0, 16], armyColor);
      flag.setStrokeStyle(1, 0x3a2a1a);
      var flagLabel = this.add.text(mx, my + 10, army.heroIds.length + '将', {
        fontSize: '10px', color: '#3a2a1a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
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

    // 顶部栏背景
    var topbar = this.add.graphics().setDepth(20);
    topbar.fillGradientStyle(0x2a1a0a, 0x2a1a0a, 0x1a0a00, 0x1a0a00, 1);
    topbar.fillRect(0, 0, w, 44);
    topbar.lineStyle(1, 0x5a3a1a, 1);
    topbar.beginPath(); topbar.moveTo(0, 44); topbar.lineTo(w, 44); topbar.strokePath();

    // 信息文本
    this._turnText = this.add.text(16, 12, '', { fontSize: '14px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif' }).setDepth(21);
    this._factionText = this.add.text(120, 12, '', { fontSize: '14px', color: '#ff8844', fontFamily: '"Microsoft YaHei", "SimHei", serif' }).setDepth(21);
    this._goldText = this.add.text(250, 12, '', { fontSize: '14px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif' }).setDepth(21);
    this._foodText = this.add.text(350, 12, '', { fontSize: '14px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif' }).setDepth(21);

    // 按钮
    var scene = this;
    this._createHUDButton(w - 400, '结束回合', '#ffd700', function() { scene._onEndTurn(); }).setDepth(21);
    this._createHUDButton(w - 300, '存档', '#c4a882', function() { GD.save(0); scene._showToast('存档成功'); }).setDepth(21);
    this._createHUDButton(w - 220, '读档', '#c4a882', function() { if (GD.load(0)) { scene._refreshAll(); scene._showToast('读档成功'); } }).setDepth(21);

    // 底部栏
    var bottombar = this.add.graphics().setDepth(20);
    bottombar.fillGradientStyle(0x2a1a0a, 0x2a1a0a, 0x1a0a00, 0x1a0a00, 1);
    bottombar.fillRect(0, this._ch - 44, w, 44);

    this._updateHUD();
  },

  _createHUDButton: function(x, label, color, callback) {
    var btn = this.add.text(x, 12, label, {
      fontSize: '13px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: color, backgroundColor: 'rgba(0,0,0,0.5)',
      padding: { x: 12, y: 4 }
    }).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', callback);
    return btn;
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

  _showCityPanel: function(cityId) {
    var GD = this._gd;
    var city = GD.cities[cityId];
    if (!city) return;

    // 清除旧面板
    this._panelContainer.removeAll(true);
    this._panelVisible = true;

    var panelX = this._cw - 340;
    var panelY = 50;
    var panelW = 330;
    var panelH = this._ch - 100;
    var scene = this;

    // 面板背景
    var panelBg = this.add.graphics();
    panelBg.fillGradientStyle(0xf8f3ea, 0xf8f3ea, 0xf0e8d8, 0xf0e8d8, 1);
    panelBg.fillRect(0, 0, panelW, panelH);
    panelBg.lineStyle(2, 0x8a7a5a, 1);
    panelBg.strokeRect(0, 0, panelW, panelH);

    this._panelContainer.add(panelBg);
    this._panelContainer.x = panelX;
    this._panelContainer.y = panelY;

    var y = 15;
    var factionName = (window.SG3.FACTION_NAMES && window.SG3.FACTION_NAMES[city.faction]) || city.faction;
    var factionCss = (window.SG3.FACTION_CSS && window.SG3.FACTION_CSS[city.faction]) || '#888';

    // 标题
    this._panelContainer.add(this.add.text(panelW / 2, y, city.name + '（' + factionName + '）', {
      fontSize: '18px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: factionCss, fontStyle: 'bold'
    }).setOrigin(0.5));
    y += 30;

    // 属性条
    var stats = [
      { label: '农业', value: city.agriculture, color: '#6b8e23' },
      { label: '商业', value: city.commerce, color: '#daa520' },
      { label: '士气', value: city.morale, color: '#cd853f' },
      { label: '防御', value: city.defense, color: '#708090' }
    ];

    for (var si = 0; si < stats.length; si++) {
      var s = stats[si];
      this._panelContainer.add(this.add.text(15, y, s.label, { fontSize: '12px', color: '#6a5a4a', fontFamily: '"Microsoft YaHei", "SimHei", serif' }));
      var barBg2 = this.add.graphics();
      barBg2.fillStyle(0xd8d0c0, 1);
      barBg2.fillRect(60, y + 2, 150, 10);
      var barFill2 = this.add.graphics();
      barFill2.fillStyle(Phaser.Display.Color.HexStringToColor(s.color).color, 1);
      barFill2.fillRect(60, y + 2, s.value * 1.5, 10);
      this._panelContainer.add([barBg2, barFill2]);
      this._panelContainer.add(this.add.text(220, y, '' + s.value, { fontSize: '12px', color: '#3a2a1a', fontFamily: '"Microsoft YaHei", "SimHei", serif' }));
      y += 20;
    }

    // 兵力
    var currentTroops = GD.getCityTotalTroops(cityId);
    this._panelContainer.add(this.add.text(15, y, '兵力：' + currentTroops + ' / ' + city.maxTroops, {
      fontSize: '13px', color: '#3a2a1a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }));
    y += 25;

    // 驻守武将
    this._panelContainer.add(this.add.text(15, y, '驻守武将', {
      fontSize: '14px', color: '#5a4a3a', fontStyle: 'bold', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }));
    y += 22;

    for (var hi = 0; hi < city.heroes.length; hi++) {
      var hero = GD.heroes[city.heroes[hi]];
      if (!hero) continue;
      var statusText = { idle: '空闲', developing: '开发中', marching: '行军中' }[hero.status] || hero.status;
      this._panelContainer.add(this.add.text(20, y, hero.name + '  ' + statusText + '  兵' + hero.troops, {
        fontSize: '12px', color: '#3a2a1a', fontFamily: '"Microsoft YaHei", "SimHei", serif'
      }));
      y += 18;
    }

    if (city.heroes.length === 0) {
      this._panelContainer.add(this.add.text(20, y, '无驻守武将', { fontSize: '12px', color: '#9a8a7a', fontFamily: '"Microsoft YaHei", "SimHei", serif' }));
      y += 18;
    }

    y += 15;

    // 操作按钮 - 仅己方城市
    if (city.faction === GD.playerFaction) {
      var btnW = 90, btnH = 28, btnGap = 8;
      var btnX = 15;

      // 开发农业
      this._createPanelBtn(btnX, y, btnW, btnH, '开发农业', function() {
        scene._showHeroSelectForAction(cityId, 'agriculture');
      });
      btnX += btnW + btnGap;

      // 开发商业
      this._createPanelBtn(btnX, y, btnW, btnH, '开发商业', function() {
        scene._showHeroSelectForAction(cityId, 'commerce');
      });
      y += btnH + btnGap;
      btnX = 15;

      // 征兵
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

      // 搜索
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

      // 训练
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

      // 出兵
      this._createPanelBtn(btnX, y, btnW, btnH, '出兵', function() {
        scene._showDispatchPanel(cityId);
      });
      y += btnH + btnGap;
    }

    // 关闭按钮
    y += 10;
    this._createPanelBtn(panelW / 2 - 40, y, 80, 28, '关闭', function() {
      scene._panelContainer.removeAll(true);
      scene._panelVisible = false;
    });
  },

  _createPanelBtn: function(x, y, w, h, label, callback) {
    var bg = this.add.graphics();
    bg.fillStyle(0x6a3a0a, 1);
    bg.fillRoundedRect(x, y, w, h, 3);
    bg.lineStyle(1, 0xaa6a2a, 1);
    bg.strokeRoundedRect(x, y, w, h, 3);

    var text = this.add.text(x + w / 2, y + h / 2, label, {
      fontSize: '12px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
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

    // 简化：自动选政治最高的
    idleHeroes.sort(function(a, b) { return b.politics - a.politics; });
    var result = GD.develop(cityId, idleHeroes[0].id, target);
    this._showToast(result.msg);
    this._refreshAll();
  },

  _showDispatchPanel: function(fromCityId) {
    var GD = this._gd;
    var fromCity = GD.cities[fromCityId];
    if (!fromCity) return;

    // 可选武将
    var availableHeroes = [];
    for (var i = 0; i < fromCity.heroes.length; i++) {
      var hero = GD.heroes[fromCity.heroes[i]];
      if (hero && hero.status === 'idle' && hero.troops > 0) availableHeroes.push(hero);
    }
    if (availableHeroes.length === 0) { this._showToast('没有可出征的武将'); return; }

    // 目标城市
    var targetCities = [];
    for (var j = 0; j < fromCity.adjacent.length; j++) {
      var adj = GD.cities[fromCity.adjacent[j]];
      if (adj && adj.faction !== fromCity.faction) targetCities.push(adj);
    }
    if (targetCities.length === 0) { this._showToast('没有可进攻的相邻城市'); return; }

    // 简化：自动选前3个空闲武将，攻击最弱目标
    var selectedHeroes = availableHeroes.slice(0, Math.min(3, availableHeroes.length));
    var heroIds = [];
    for (var k = 0; k < selectedHeroes.length; k++) heroIds.push(selectedHeroes[k].id);

    var weakest = targetCities[0];
    var weakestTroops = GD.getCityTotalTroops(weakest.id);
    for (var m = 1; m < targetCities.length; m++) {
      var tTroops = GD.getCityTotalTroops(targetCities[m].id);
      if (tTroops < weakestTroops) { weakest = targetCities[m]; weakestTroops = tTroops; }
    }

    var result = GD.dispatchArmy(fromCityId, heroIds, weakest.id);
    this._showToast(result.msg);
    this._refreshAll();
  },

  _onEndTurn: function() {
    var GD = this._gd;
    GD.endTurn();

    // 检查是否触发战斗
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

    // 更新HUD
    this._updateHUD();

    // 更新城市显示
    for (var cityId in GD.cities) {
      if (!GD.cities.hasOwnProperty(cityId)) continue;
      var city = GD.cities[cityId];
      var color = (window.SG3.FACTION_COLORS[city.faction] || 0x888888);
      if (this._citySprites[cityId]) {
        this._citySprites[cityId].fillColor = color;
      }
      if (this._cityLabels[cityId]) {
        this._cityLabels[cityId].troops.setText('' + GD.getCityTotalTroops(cityId));
      }
    }

    // 更新行军显示
    this._drawArmies();

    // 刷新城市面板（如果正在显示）
    if (this._panelVisible) {
      // 简化：关闭面板
      this._panelContainer.removeAll(true);
      this._panelVisible = false;
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
