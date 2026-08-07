/**
 * 三国群英传 - 主菜单场景
 * @author jian.li
 */
window.SG3 = window.SG3 || {};

window.SG3.MenuScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function MenuScene() {
    Phaser.Scene.call(this, { key: 'MenuScene' });
  },

  create: function() {
    var scene = this;
    var w = this.cameras.main.width;
    var h = this.cameras.main.height;
    this._w = w;
    this._h = h;

    this._drawBackground(w, h);
    this._drawDecorativeBorder(w, h);
    this._drawTitle(w, h);

    // 副标题
    this.add.text(w / 2, 165, '选择你的势力，逐鹿天下', {
      fontSize: '20px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#8a6d3b', fontStyle: 'italic'
    }).setOrigin(0.5);

    // 势力卡片
    var factions = [
      { id: 'wei', name: '曹魏', color: '#4488cc', bgColor: 0x1a3a5a, desc: '挟天子以令诸侯\n雄踞中原沃土', leader: '曹操', cities: '十二城' },
      { id: 'shu', name: '蜀汉', color: '#cc4444', bgColor: 0x5a1a1a, desc: '兴复汉室\n还于旧都长安', leader: '刘备', cities: '八城' },
      { id: 'wu',  name: '东吴', color: '#44aa44', bgColor: 0x1a3a1a, desc: '据江东之天险\n虎视荆扬九州', leader: '孙权', cities: '十城' }
    ];

    var cardWidth = 220, cardHeight = 280, gap = 50;
    var totalWidth = factions.length * cardWidth + (factions.length - 1) * gap;
    var startX = (w - totalWidth) / 2 + cardWidth / 2;
    var cardY = 340;

    for (var i = 0; i < factions.length; i++) {
      (function(f, idx) {
        var cx = startX + idx * (cardWidth + gap);
        scene._drawFactionCard(cx, cardY, cardWidth, cardHeight, f);
      })(factions[i], i);
    }

    // 底部按钮区
    var btnY = 540;

    // 自定义君主按钮
    this._createStyledButton(w / 2 - 130, btnY, 220, 44, '自定义君主', '#ffd700', 0x3a2a00, function() {
      scene._showCustomMonarch();
    });

    // 继续游戏
    var hasSave = false;
    try { hasSave = !!localStorage.getItem('sg3_save_0'); } catch(e) {}
    if (hasSave) {
      this._createStyledButton(w / 2 + 130, btnY, 220, 44, '继续游戏', '#c4a882', 0x2a2010, function() {
        if (window.SG3.GameData.load(0)) {
          scene.game.scene.stop('MenuScene');
          scene.game.scene.start('MapScene');
        }
      });
    }

    // 底部装饰
    this._drawBottomDecor(w, h);
  },

  // ===== 背景绘制 =====

  _drawBackground: function(w, h) {
    var g = this.add.graphics();

    // 深色底
    g.fillGradientStyle(0x2a1a08, 0x2a1a08, 0x1a0a02, 0x1a0a02, 1);
    g.fillRect(0, 0, w, h);

    // 羊皮纸纹理叠加
    for (var i = 0; i < 80; i++) {
      var rx = Math.random() * w;
      var ry = Math.random() * h;
      var rs = Math.random() * 3 + 1;
      g.fillStyle(0xc4a060, Math.random() * 0.06 + 0.02);
      g.fillCircle(rx, ry, rs);
    }

    // 顶部和底部暗角
    g.fillGradientStyle(0x000000, 0x000000, 0x2a1a08, 0x2a1a08, 0.5);
    g.fillRect(0, 0, w, 100);
    g.fillGradientStyle(0x2a1a08, 0x2a1a08, 0x000000, 0x000000, 0.5);
    g.fillRect(0, h - 80, w, 80);
  },

  _drawDecorativeBorder: function(w, h) {
    var g = this.add.graphics();
    var margin = 20;

    // 外边框
    g.lineStyle(3, 0x8a6d3b, 1);
    g.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

    // 内边框
    g.lineStyle(1, 0xc4a060, 0.6);
    g.strokeRect(margin + 6, margin + 6, w - (margin + 6) * 2, h - (margin + 6) * 2);

    // 四角装饰
    var corners = [
      { x: margin, y: margin },
      { x: w - margin, y: margin },
      { x: margin, y: h - margin },
      { x: w - margin, y: h - margin }
    ];
    for (var c = 0; c < corners.length; c++) {
      var cn = corners[c];
      g.lineStyle(2, 0xc4a060, 0.8);
      var cs = 15;
      var dx = cn.x === margin ? 1 : -1;
      var dy = cn.y === margin ? 1 : -1;
      g.lineBetween(cn.x, cn.y, cn.x + dx * cs, cn.y);
      g.lineBetween(cn.x, cn.y, cn.x, cn.y + dy * cs);
      g.fillStyle(0xc4a060, 0.8);
      g.fillCircle(cn.x + dx * 3, cn.y + dy * 3, 3);
    }
  },

  _drawTitle: function(w, h) {
    // 标题横幅背景
    var banner = this.add.graphics();
    banner.fillStyle(0x1a0a02, 0.7);
    banner.fillRect(w / 2 - 260, 45, 520, 90);
    banner.lineStyle(2, 0xc4a060, 0.8);
    banner.strokeRect(w / 2 - 260, 45, 520, 90);
    banner.lineStyle(1, 0x8a6d3b, 0.5);
    banner.strokeRect(w / 2 - 254, 51, 508, 78);

    // 横幅装饰 - 两侧云纹
    var cloudG = this.add.graphics();
    cloudG.lineStyle(2, 0xc4a060, 0.6);
    // 左侧云纹
    cloudG.beginPath();
    cloudG.arc(w / 2 - 240, 90, 12, 0, Math.PI * 2);
    cloudG.strokePath();
    cloudG.beginPath();
    cloudG.arc(w / 2 - 225, 90, 8, 0, Math.PI * 2);
    cloudG.strokePath();
    // 右侧云纹
    cloudG.beginPath();
    cloudG.arc(w / 2 + 240, 90, 12, 0, Math.PI * 2);
    cloudG.strokePath();
    cloudG.beginPath();
    cloudG.arc(w / 2 + 225, 90, 8, 0, Math.PI * 2);
    cloudG.strokePath();

    // 主标题
    this.add.text(w / 2, 78, '三 国 群 英 传', {
      fontSize: '48px', fontFamily: '"Microsoft YaHei", "SimHei", "STKaiti", serif',
      color: '#ffd700', stroke: '#3a1a00', strokeThickness: 6,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(w / 2, 115, '— 群雄逐鹿 · 天下大势 —', {
      fontSize: '14px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#c4a060'
    }).setOrigin(0.5);
  },

  _drawBottomDecor: function(w, h) {
    // 底部印章风格装饰
    var seal = this.add.graphics();
    seal.fillStyle(0x8a6d3b, 0.3);
    seal.lineStyle(1, 0xc4a060, 0.4);
    seal.strokeRect(w - 80, h - 65, 40, 40);
    this.add.text(w - 60, h - 45, '三\n国', {
      fontSize: '12px', fontFamily: '"SimHei", serif',
      color: '#c4a060', align: 'center', lineSpacing: 2
    }).setOrigin(0.5);

    // 版本信息
    this.add.text(40, h - 30, 'v1.0  ·  Phaser 3', {
      fontSize: '11px', fontFamily: '"Microsoft YaHei", serif',
      color: '#5a4a2a'
    });
  },

  // ===== 势力卡片 =====

  _drawFactionCard: function(cx, cy, cw, ch, f) {
    var scene = this;
    var colorVal = Phaser.Display.Color.HexStringToColor(f.color).color;

    // 卡片背景
    var cardBg = this.add.graphics();
    this._drawCardBg(cardBg, cx, cy, cw, ch, f.bgColor, colorVal, false);

    // 势力旗帜图标
    this._drawFactionEmblem(cx, cy - 85, f.id, colorVal);

    // 势力名称
    this.add.text(cx, cy - 30, f.name, {
      fontSize: '28px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: f.color, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    // 分隔线
    var sep = this.add.graphics();
    sep.lineStyle(1, colorVal, 0.5);
    sep.lineBetween(cx - 70, cy - 10, cx + 70, cy - 10);

    // 描述
    this.add.text(cx, cy + 20, f.desc, {
      fontSize: '14px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#c4a882', align: 'center', lineSpacing: 6
    }).setOrigin(0.5);

    // 领袖信息
    this.add.text(cx, cy + 80, '君主：' + f.leader, {
      fontSize: '14px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#e8d4b0'
    }).setOrigin(0.5);

    this.add.text(cx, cy + 102, '疆域：' + f.cities, {
      fontSize: '13px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#8a7a5a'
    }).setOrigin(0.5);

    // 交互区域
    var zone = this.add.zone(cx, cy, cw, ch).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function() {
      scene._drawCardBg(cardBg, cx, cy, cw, ch, f.bgColor, colorVal, true);
    });
    zone.on('pointerout', function() {
      scene._drawCardBg(cardBg, cx, cy, cw, ch, f.bgColor, colorVal, false);
    });
    zone.on('pointerdown', function() { scene._selectFaction(f.id); });
  },

  _drawCardBg: function(g, cx, cy, cw, ch, bgColor, borderColor, hover) {
    g.clear();
    var alpha = hover ? 0.85 : 0.6;
    g.fillStyle(bgColor, alpha);
    g.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 10);

    if (hover) {
      g.fillStyle(borderColor, 0.08);
      g.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 10);
    }

    // 外边框
    g.lineStyle(hover ? 3 : 2, borderColor, 1);
    g.strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 10);

    // 内边框
    g.lineStyle(1, 0xc4a060, hover ? 0.4 : 0.2);
    g.strokeRoundedRect(cx - cw / 2 + 5, cy - ch / 2 + 5, cw - 10, ch - 10, 6);

    // 顶部装饰条
    g.fillStyle(borderColor, hover ? 0.4 : 0.2);
    g.fillRect(cx - cw / 2 + 10, cy - ch / 2 + 6, cw - 20, 3);
    g.fillRect(cx - cw / 2 + 10, cy + ch / 2 - 9, cw - 20, 3);
  },

  _drawFactionEmblem: function(cx, cy, factionId, color) {
    var g = this.add.graphics();
    var r = 28;

    // 外圈
    g.lineStyle(3, color, 1);
    g.fillStyle(0x1a0a02, 0.8);
    g.fillCircle(cx, cy, r);
    g.strokeCircle(cx, cy, r);

    // 内圈
    g.lineStyle(1, 0xc4a060, 0.5);
    g.strokeCircle(cx, cy, r - 5);

    // 势力标识文字
    var emblemChar = { wei: '魏', shu: '蜀', wu: '吴' }[factionId] || '?';
    this.add.text(cx, cy, emblemChar, {
      fontSize: '24px', fontFamily: '"SimHei", "STKaiti", serif',
      color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);

    // 旗帜杆
    g.lineStyle(2, 0x8a6d3b, 0.8);
    g.lineBetween(cx + r + 2, cy - r, cx + r + 2, cy + r);
  },

  // ===== 自定义君主界面 =====

  _showCustomMonarch: function() {
    this.children.removeAll(true);
    var w = this._w, h = this._h;
    var scene = this;

    this._drawBackground(w, h);
    this._drawDecorativeBorder(w, h);

    // 标题
    var titleBg = this.add.graphics();
    titleBg.fillStyle(0x1a0a02, 0.7);
    titleBg.fillRect(w / 2 - 180, 25, 360, 50);
    titleBg.lineStyle(2, 0xc4a060, 0.8);
    titleBg.strokeRect(w / 2 - 180, 25, 360, 50);

    this.add.text(w / 2, 50, '自定义君主', {
      fontSize: '28px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', stroke: '#3a1a00', strokeThickness: 3,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 表单容器背景
    var formBg = this.add.graphics();
    formBg.fillStyle(0x1a0a02, 0.5);
    formBg.fillRoundedRect(180, 90, w - 360, h - 140, 8);
    formBg.lineStyle(1, 0x8a6d3b, 0.5);
    formBg.strokeRoundedRect(180, 90, w - 360, h - 140, 8);

    var formX = w / 2 - 220;
    var formY = 115;
    var lineH = 36;

    // === 基本信息区 ===
    this._drawSectionHeader(w / 2, formY, '基本信息');
    formY += 30;

    // 君主姓名
    this._drawFormLabel(formX, formY, '君主姓名：');
    var defaultNames = ['赵轩', '李昊', '王霆', '陈渊', '林策', '苏珩', '周瑾', '楚锋', '萧然', '韩烨'];
    var nameInput = this._createInputField(formX + 100, formY - 4, defaultNames[Math.floor(Math.random() * defaultNames.length)]);
    this._createRandomBtn(formX + 320, formY, function() {
      var n = defaultNames[Math.floor(Math.random() * defaultNames.length)];
      nameInput.setText(n);
      nameInput.text = n;
    });
    formY += lineH;

    // 势力名称
    this._drawFormLabel(formX, formY, '势力名称：');
    var defaultFactions = ['龙吟', '凤鸣', '虎啸', '鹰扬', '麒麟', '玄武', '朱雀', '青龙', '白虎', '天策'];
    var factionInput = this._createInputField(formX + 100, formY - 4, defaultFactions[Math.floor(Math.random() * defaultFactions.length)]);
    this._createRandomBtn(formX + 320, formY, function() {
      var n = defaultFactions[Math.floor(Math.random() * defaultFactions.length)];
      factionInput.setText(n);
      factionInput.text = n;
    });
    formY += lineH;

    // 势力颜色
    this._drawFormLabel(formX, formY, '势力颜色：');
    var colors = ['#cc4444', '#4488cc', '#44aa44', '#cc8844', '#9944cc', '#44cccc'];
    var colorLabels = ['赤红', '深蓝', '翠绿', '橙黄', '紫罗', '青碧'];
    var selectedColor = '#cc4444';
    var colorBtns = [];
    for (var ci = 0; ci < colors.length; ci++) {
      (function(color, label, idx) {
        var cx = formX + 110 + idx * 42;
        var circle = scene.add.circle(cx, formY + 8, 15, Phaser.Display.Color.HexStringToColor(color).color);
        circle.setStrokeStyle(idx === 0 ? 3 : 1, 0xffd700);
        circle.setInteractive({ useHandCursor: true });
        // 颜色名称提示
        var labelTxt = scene.add.text(cx, formY + 28, label, {
          fontSize: '10px', fontFamily: '"Microsoft YaHei", serif',
          color: '#8a7a5a'
        }).setOrigin(0.5);
        circle.on('pointerdown', function() {
          selectedColor = color;
          for (var k = 0; k < colorBtns.length; k++) colorBtns[k].setStrokeStyle(1, 0xffd700);
          circle.setStrokeStyle(3, 0xffd700);
        });
        colorBtns.push(circle);
      })(colors[ci], colorLabels[ci], ci);
    }
    formY += lineH + 8;

    // 起始城市
    this._drawFormLabel(formX, formY, '起始城市：');
    var noneCities = [];
    for (var c = 0; c < window.SG3.CITIES_DATA.length; c++) {
      if (window.SG3.CITIES_DATA[c].faction === 'none') noneCities.push(window.SG3.CITIES_DATA[c]);
    }
    var cityIdx = 0;
    var cityText = this.add.text(formX + 100, formY, noneCities.length > 0 ? noneCities[0].name : '（无在野空城）', {
      fontSize: '16px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    });
    if (noneCities.length > 0) {
      this._createArrowBtn(formX + 210, formY, '<', function() {
        cityIdx = (cityIdx - 1 + noneCities.length) % noneCities.length;
        cityText.setText(noneCities[cityIdx].name);
      });
      this._createArrowBtn(formX + 240, formY, '>', function() {
        cityIdx = (cityIdx + 1) % noneCities.length;
        cityText.setText(noneCities[cityIdx].name);
      });
    }
    formY += lineH;

    // 君主兵种
    this._drawFormLabel(formX, formY, '君主兵种：');
    var troopTypes = [{ val: 'infantry', label: '步兵' }, { val: 'cavalry', label: '骑兵' }, { val: 'archer', label: '弓兵' }];
    var troopIdx = 0;
    var troopText = this.add.text(formX + 100, formY, '步兵', {
      fontSize: '16px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    });
    this._createArrowBtn(formX + 160, formY, '<', function() {
      troopIdx = (troopIdx - 1 + troopTypes.length) % troopTypes.length;
      troopText.setText(troopTypes[troopIdx].label);
    });
    this._createArrowBtn(formX + 190, formY, '>', function() {
      troopIdx = (troopIdx + 1) % troopTypes.length;
      troopText.setText(troopTypes[troopIdx].label);
    });
    formY += lineH + 5;

    // === 属性分配区 ===
    this._drawSectionHeader(w / 2, formY, '属性分配');
    formY += 28;

    var attrPoints = 350;
    var attrs = { force: 70, intellect: 70, politics: 70, command: 70, charisma: 70 };
    var attrNames = [
      { key: 'force', label: '武力', color: '#cc4444' },
      { key: 'intellect', label: '智力', color: '#4488cc' },
      { key: 'politics', label: '政治', color: '#daa520' },
      { key: 'command', label: '统率', color: '#44aa44' },
      { key: 'charisma', label: '魅力', color: '#cc8844' }
    ];

    var calcRemain = function() { var used = 0; for (var k in attrs) used += attrs[k]; return attrPoints - used; };
    var remainText = this.add.text(w / 2, formY, '剩余点数：' + calcRemain(), {
      fontSize: '15px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    formY += 26;

    var attrValTexts = {};
    for (var ai = 0; ai < attrNames.length; ai++) {
      (function(attrInfo) {
        var y = formY + ai * 30;
        scene._drawFormLabel(formX, y, attrInfo.label, attrInfo.color);

        // -10 按钮
        scene._createAdjustBtn(formX + 55, y, '-10', '#ff9090', 0x3a1a1a, function() { adjustAttr(attrInfo.key, -10); });
        // -1 按钮
        scene._createAdjustBtn(formX + 100, y, '-', '#e8d4b0', 0x333333, function() { adjustAttr(attrInfo.key, -1); });

        // 数值
        var valText = scene.add.text(formX + 128, y, '' + attrs[attrInfo.key], {
          fontSize: '16px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif',
          fontStyle: 'bold', fixedWidth: 30
        });
        attrValTexts[attrInfo.key] = valText;

        // +1 按钮
        scene._createAdjustBtn(formX + 168, y, '+', '#e8d4b0', 0x333333, function() { adjustAttr(attrInfo.key, 1); });
        // +10 按钮
        scene._createAdjustBtn(formX + 200, y, '+10', '#90ff90', 0x1a3a1a, function() { adjustAttr(attrInfo.key, 10); });

        // 属性条
        var barBg = scene.add.graphics();
        barBg.fillStyle(0x222222, 1);
        barBg.fillRoundedRect(formX + 245, y + 3, 120, 10, 3);
        var barFill = scene.add.graphics();

        function updateBar() {
          barFill.clear();
          barFill.fillStyle(Phaser.Display.Color.HexStringToColor(attrInfo.color).color, 1);
          barFill.fillRoundedRect(formX + 245, y + 3, attrs[attrInfo.key], 10, 3);
        }
        updateBar();

        function adjustAttr(key, delta) {
          var oldVal = attrs[key];
          var newVal = oldVal + delta;
          if (newVal < 20) newVal = 20;
          if (newVal > 100) newVal = 100;
          var realDelta = newVal - oldVal;
          if (realDelta === 0) return;
          if (realDelta > 0) {
            var remain = calcRemain();
            if (remain <= 0) return;
            if (realDelta > remain) { newVal = oldVal + remain; realDelta = remain; }
          }
          attrs[key] = newVal;
          valText.setText('' + newVal);
          remainText.setText('剩余点数：' + calcRemain());
          updateBar();
        }
      })(attrNames[ai]);
    }

    formY += attrNames.length * 30 + 12;

    // === 专属武将技区 ===
    this._drawSectionHeader(w / 2, formY, '专属武将技');
    formY += 28;

    this._drawFormLabel(formX, formY, '技能名称：', null, 14);
    var defaultSkills = ['霸王斩', '龙魂破', '凤舞九天', '虎啸山林', '玄武护体', '雷霆万钧', '烈焰焚天', '冰封万里', '星辰陨落', '天命所归'];
    var skillInput = this._createInputField(formX + 100, formY - 3, defaultSkills[Math.floor(Math.random() * defaultSkills.length)], 150);
    this._createRandomBtn(formX + 270, formY, function() {
      var n = defaultSkills[Math.floor(Math.random() * defaultSkills.length)];
      skillInput.setText(n);
      skillInput.text = n;
    });
    formY += 28;

    // 效果类型
    this._drawFormLabel(formX, formY, '效果类型：', null, 14);
    var effectTypes = ['damage', 'heal_troops', 'heal_hp', 'buff_attack', 'morale_up'];
    var effectLabels = ['伤害', '恢复兵力', '恢复HP', '攻击增益', '士气提升'];
    var effectIdx = 0;
    var effectText = this.add.text(formX + 100, formY, '伤害', {
      fontSize: '14px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    });
    this._createArrowBtn(formX + 155, formY, '<', function() {
      effectIdx = (effectIdx - 1 + effectTypes.length) % effectTypes.length;
      effectText.setText(effectLabels[effectIdx]);
    });
    this._createArrowBtn(formX + 180, formY, '>', function() {
      effectIdx = (effectIdx + 1) % effectTypes.length;
      effectText.setText(effectLabels[effectIdx]);
    });
    formY += 28;

    // 技能威力
    this._drawFormLabel(formX, formY, '技能威力：', null, 14);
    var powerVal = 80;
    var powerText = this.add.text(formX + 100, formY, '80', {
      fontSize: '14px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    });
    this._createAdjustBtn(formX + 135, formY, '-', '#e8d4b0', 0x333333, function() {
      powerVal = Math.max(30, powerVal - 10); powerText.setText('' + powerVal);
    });
    this._createAdjustBtn(formX + 160, formY, '+', '#e8d4b0', 0x333333, function() {
      powerVal = Math.min(150, powerVal + 10); powerText.setText('' + powerVal);
    });
    formY += 28;

    // 技力消耗
    this._drawFormLabel(formX, formY, '技力消耗：', null, 14);
    var costVal = 35;
    var costText = this.add.text(formX + 100, formY, '35', {
      fontSize: '14px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    });
    this._createAdjustBtn(formX + 135, formY, '-', '#e8d4b0', 0x333333, function() {
      costVal = Math.max(10, costVal - 5); costText.setText('' + costVal);
    });
    this._createAdjustBtn(formX + 160, formY, '+', '#e8d4b0', 0x333333, function() {
      costVal = Math.min(60, costVal + 5); costText.setText('' + costVal);
    });
    formY += 38;

    // 按钮
    this._createStyledButton(w / 2 - 110, formY, 180, 42, '开始游戏', '#ffd700', 0x3a2a00, function() {
      var name = nameInput.text;
      var factionName = factionInput.text;
      if (!name || !name.trim()) { scene._showToast('请输入君主姓名'); return; }
      if (!factionName || !factionName.trim()) { scene._showToast('请输入势力名称'); return; }
      if (noneCities.length === 0) { scene._showToast('无在野空城可用'); return; }

      var skillName = (skillInput.text && skillInput.text.trim()) ? skillInput.text.trim() : '专属技';
      var customSkillData = {
        name: skillName,
        effectType: effectTypes[effectIdx],
        spCost: costVal,
        power: powerVal,
        range: 'single',
        element: 'ink',
        desc: '专属武将技',
        heroId: null
      };

      window.SG3.GameData.initCustomFaction(
        name, factionName, selectedColor,
        { force: attrs.force, intellect: attrs.intellect, politics: attrs.politics, command: attrs.command, charisma: attrs.charisma, troopType: troopTypes[troopIdx].val },
        noneCities[cityIdx].id,
        customSkillData
      );

      scene.game.scene.stop('MenuScene');
      scene.game.scene.start('MapScene');
    });

    this._createStyledButton(w / 2 + 110, formY, 180, 42, '返回主菜单', '#c4a882', 0x2a2010, function() {
      scene.scene.restart();
    });
  },

  // ===== UI 组件 =====

  _drawSectionHeader: function(cx, y, title) {
    var g = this.add.graphics();
    var w = 300;
    // 背景条
    g.fillStyle(0x3a2a10, 0.6);
    g.fillRoundedRect(cx - w / 2, y - 12, w, 24, 4);
    g.lineStyle(1, 0xc4a060, 0.4);
    g.strokeRoundedRect(cx - w / 2, y - 12, w, 24, 4);
    // 两侧装饰线
    g.lineStyle(1, 0x8a6d3b, 0.5);
    g.lineBetween(cx - w / 2 - 30, y, cx - w / 2, y);
    g.lineBetween(cx + w / 2, y, cx + w / 2 + 30, y);
    // 文字
    this.add.text(cx, y, title, {
      fontSize: '16px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', fontStyle: 'bold'
    }).setOrigin(0.5);
  },

  _drawFormLabel: function(x, y, label, color, size) {
    this.add.text(x, y, label, {
      fontSize: (size || 16) + 'px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: color || '#c4a882'
    });
  },

  _createInputField: function(x, y, placeholder, width) {
    var scene = this;
    var bg = this.add.graphics();
    var fw = width || 200;
    bg.fillStyle(0x0a0a0a, 0.8);
    bg.fillRoundedRect(x - 4, y - 2, fw + 8, 26, 4);
    bg.lineStyle(1, 0x5a4a2a, 0.6);
    bg.strokeRoundedRect(x - 4, y - 2, fw + 8, 26, 4);

    var textObj = this.add.text(x, y, placeholder, {
      fontSize: '16px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#e8d4b0', fixedWidth: fw
    });

    textObj.text = placeholder;
    textObj.setInteractive({ useHandCursor: true });
    textObj.on('pointerover', function() {
      bg.clear();
      bg.fillStyle(0x0a0a0a, 0.8);
      bg.fillRoundedRect(x - 4, y - 2, fw + 8, 26, 4);
      bg.lineStyle(1, 0xc4a060, 0.8);
      bg.strokeRoundedRect(x - 4, y - 2, fw + 8, 26, 4);
    });
    textObj.on('pointerout', function() {
      bg.clear();
      bg.fillStyle(0x0a0a0a, 0.8);
      bg.fillRoundedRect(x - 4, y - 2, fw + 8, 26, 4);
      bg.lineStyle(1, 0x5a4a2a, 0.6);
      bg.strokeRoundedRect(x - 4, y - 2, fw + 8, 26, 4);
    });
    textObj.on('pointerdown', function() {
      var input = window.prompt(placeholder, textObj.text === placeholder ? '' : textObj.text);
      if (input !== null && input.trim()) {
        textObj.setText(input.trim());
        textObj.text = input.trim();
      }
    });

    return textObj;
  },

  _createRandomBtn: function(x, y, callback) {
    var txt = this.add.text(x, y - 2, '\uD83C\uDFB2', {
      fontSize: '18px'
    }).setInteractive({ useHandCursor: true });
    txt.on('pointerover', function() { txt.setScale(1.2); });
    txt.on('pointerout', function() { txt.setScale(1); });
    txt.on('pointerdown', callback);
    return txt;
  },

  _createArrowBtn: function(x, y, label, callback) {
    var txt = this.add.text(x, y, label, {
      fontSize: '18px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      backgroundColor: '#2a2010', padding: { x: 6, y: 2 }
    }).setInteractive({ useHandCursor: true });
    txt.on('pointerover', function() { txt.setColor('#ffd700'); });
    txt.on('pointerout', function() { txt.setColor('#e8d4b0'); });
    txt.on('pointerdown', callback);
    return txt;
  },

  _createAdjustBtn: function(x, y, label, color, bgColor, callback) {
    var txt = this.add.text(x, y, label, {
      fontSize: '13px', color: color, fontFamily: '"Microsoft YaHei", "SimHei", serif',
      backgroundColor: Phaser.Display.Color.RGBToString(
        (bgColor >> 16) & 0xff,
        (bgColor >> 8) & 0xff,
        bgColor & 0xff,
        1
      ),
      padding: { x: 5, y: 2 }
    }).setInteractive({ useHandCursor: true });
    txt.on('pointerover', function() { txt.setScale(1.15); });
    txt.on('pointerout', function() { txt.setScale(1); });
    txt.on('pointerdown', callback);
    return txt;
  },

  _createStyledButton: function(x, y, w, h, label, textColor, bgColor, callback) {
    var scene = this;
    var g = this.add.graphics();
    var colorVal = Phaser.Display.Color.HexStringToColor(textColor).color;

    function drawBtn(hover) {
      g.clear();
      g.fillStyle(bgColor, hover ? 0.95 : 0.75);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
      if (hover) {
        g.fillStyle(colorVal, 0.1);
        g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
      }
      g.lineStyle(hover ? 2 : 1, colorVal, 1);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 6);
      // 顶部高光
      g.lineStyle(1, 0xc4a060, 0.3);
      g.lineBetween(x - w / 2 + 8, y - h / 2 + 3, x + w / 2 - 8, y - h / 2 + 3);
    }

    drawBtn(false);

    var txt = this.add.text(x, y, label, {
      fontSize: '17px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: textColor, fontStyle: 'bold'
    }).setOrigin(0.5);

    var zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', function() { drawBtn(true); txt.setScale(1.05); });
    zone.on('pointerout', function() { drawBtn(false); txt.setScale(1); });
    zone.on('pointerdown', callback);

    return { graphics: g, text: txt, zone: zone };
  },

  // ===== 功能方法 =====

  _selectFaction: function(factionId) {
    window.SG3.GameData.init();
    window.SG3.GameData.playerFaction = factionId;
    this.game.scene.stop('MenuScene');
    this.game.scene.start('MapScene');
  },

  _showToast: function(msg) {
    var toast = this.add.text(this._w / 2, 50, msg, {
      fontSize: '16px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', backgroundColor: 'rgba(0,0,0,0.85)',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setDepth(999);

    this.tweens.add({
      targets: toast, alpha: 0, y: toast.y - 30,
      duration: 2000, ease: 'Power2',
      onComplete: function() { toast.destroy(); }
    });
  }
});
