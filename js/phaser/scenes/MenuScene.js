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

    // 背景
    var bg = this.add.graphics();
    bg.fillGradientStyle(0x1a0a00, 0x1a0a00, 0x3d1a00, 0x3d1a00, 1);
    bg.fillRect(0, 0, w, h);

    // 标题
    this.add.text(w / 2, 80, '三国群英传', {
      fontSize: '56px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', stroke: '#3a1a00', strokeThickness: 6
    }).setOrigin(0.5);

    this.add.text(w / 2, 130, '选择你的势力，逐鹿天下', {
      fontSize: '18px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#c4a882'
    }).setOrigin(0.5);

    // 势力卡片
    var factions = [
      { id: 'wei', name: '曹魏', color: '#4488cc', desc: '挟天子以令诸侯\n雄踞中原' },
      { id: 'shu', name: '蜀汉', color: '#cc4444', desc: '兴复汉室\n还于旧都' },
      { id: 'wu',  name: '东吴', color: '#44aa44', desc: '据江东之固\n虎视天下' }
    ];

    var cardWidth = 200, cardHeight = 200, gap = 40;
    var totalWidth = factions.length * cardWidth + (factions.length - 1) * gap;
    var startX = (w - totalWidth) / 2 + cardWidth / 2;
    var cardY = 290;

    for (var i = 0; i < factions.length; i++) {
      (function(f, idx) {
        var cx = startX + idx * (cardWidth + gap);
        var cardBg = scene.add.graphics();
        cardBg.fillStyle(0x000000, 0.5);
        cardBg.fillRoundedRect(cx - cardWidth/2, cardY - cardHeight/2, cardWidth, cardHeight, 8);
        cardBg.lineStyle(2, Phaser.Display.Color.HexStringToColor(f.color).color, 1);
        cardBg.strokeRoundedRect(cx - cardWidth/2, cardY - cardHeight/2, cardWidth, cardHeight, 8);

        scene.add.text(cx, cardY - 50, f.name, {
          fontSize: '32px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
          color: f.color, fontStyle: 'bold'
        }).setOrigin(0.5);

        scene.add.text(cx, cardY + 20, f.desc, {
          fontSize: '14px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
          color: '#b0a080', align: 'center', lineSpacing: 6
        }).setOrigin(0.5);

        // 点击区域
        var zone = scene.add.zone(cx, cardY, cardWidth, cardHeight).setInteractive({ useHandCursor: true });
        zone.on('pointerover', function() { cardBg.clear(); cardBg.fillStyle(Phaser.Display.Color.HexStringToColor(f.color).color, 0.15); cardBg.fillRoundedRect(cx - cardWidth/2, cardY - cardHeight/2, cardWidth, cardHeight, 8); cardBg.lineStyle(2, Phaser.Display.Color.HexStringToColor(f.color).color, 1); cardBg.strokeRoundedRect(cx - cardWidth/2, cardY - cardHeight/2, cardWidth, cardHeight, 8); });
        zone.on('pointerout', function() { cardBg.clear(); cardBg.fillStyle(0x000000, 0.5); cardBg.fillRoundedRect(cx - cardWidth/2, cardY - cardHeight/2, cardWidth, cardHeight, 8); cardBg.lineStyle(2, Phaser.Display.Color.HexStringToColor(f.color).color, 1); cardBg.strokeRoundedRect(cx - cardWidth/2, cardY - cardHeight/2, cardWidth, cardHeight, 8); });
        zone.on('pointerdown', function() { scene._selectFaction(f.id); });
      })(factions[i], i);
    }

    // 自定义君主按钮
    this._createButton(w / 2, 440, '自定义君主', '#ffd700', function() {
      scene._showCustomMonarch();
    });

    // 继续游戏
    var hasSave = false;
    try { hasSave = !!localStorage.getItem('sg3_save_0'); } catch(e) {}
    if (hasSave) {
      this._createButton(w / 2, 490, '继续游戏', '#c4a882', function() {
        if (window.SG3.GameData.load(0)) {
          scene.game.scene.stop('MenuScene');
          scene.game.scene.start('MapScene');
        }
      });
    }
  },

  _selectFaction: function(factionId) {
    window.SG3.GameData.init();
    window.SG3.GameData.playerFaction = factionId;
    this.game.scene.stop('MenuScene');
    this.game.scene.start('MapScene');
  },

  _showCustomMonarch: function() {
    // 清除当前场景内容，显示自定义君主界面
    this.children.removeAll(true);
    var w = this._w, h = this._h;
    var scene = this;

    var bg = this.add.graphics();
    bg.fillStyle(0x0a0500, 1);
    bg.fillRect(0, 0, w, h);

    this.add.text(w / 2, 30, '自定义君主', {
      fontSize: '32px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', stroke: '#3a1a00', strokeThickness: 3
    }).setOrigin(0.5);

    // 表单区域 - 使用 Phaser 文本和交互区域
    var formX = w / 2 - 200;
    var formY = 65;
    var lineH = 38;

    // 君主姓名
    this.add.text(formX, formY, '君主姓名：', { fontSize: '16px', color: '#c4a882', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    var defaultNames = ['赵轩', '李昊', '王霆', '陈渊', '林策', '苏珩', '周瑾', '楚锋', '萧然', '韩烨'];
    var nameInput = this._createInputField(formX + 100, formY - 5, defaultNames[Math.floor(Math.random() * defaultNames.length)]);
    // 随机姓名按钮
    var nameRandomBtn = scene.add.text(formX + 320, formY - 2, '🎲', { fontSize: '18px' }).setInteractive({ useHandCursor: true });
    nameRandomBtn.on('pointerdown', function() {
      var randName = defaultNames[Math.floor(Math.random() * defaultNames.length)];
      nameInput.setText(randName);
      nameInput.text = randName;
    });
    formY += lineH;

    // 势力名称
    this.add.text(formX, formY, '势力名称：', { fontSize: '16px', color: '#c4a882', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    var defaultFactions = ['龙吟', '凤鸣', '虎啸', '鹰扬', '麒麟', '玄武', '朱雀', '青龙', '白虎', '天策'];
    var factionInput = this._createInputField(formX + 100, formY - 5, defaultFactions[Math.floor(Math.random() * defaultFactions.length)]);
    // 随机势力名按钮
    var factionRandomBtn = scene.add.text(formX + 320, formY - 2, '🎲', { fontSize: '18px' }).setInteractive({ useHandCursor: true });
    factionRandomBtn.on('pointerdown', function() {
      var randFaction = defaultFactions[Math.floor(Math.random() * defaultFactions.length)];
      factionInput.setText(randFaction);
      factionInput.text = randFaction;
    });
    formY += lineH;

    // 势力颜色选择
    this.add.text(formX, formY, '势力颜色：', { fontSize: '16px', color: '#c4a882', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    var colors = ['#cc4444', '#4488cc', '#44aa44', '#cc8844', '#9944cc', '#44cccc'];
    var colorLabels = ['赤红', '深蓝', '翠绿', '橙黄', '紫罗', '青碧'];
    var selectedColor = '#cc4444';
    var colorBtns = [];
    for (var ci = 0; ci < colors.length; ci++) {
      (function(color, idx) {
        var cx = formX + 110 + idx * 38;
        var circle = scene.add.circle(cx, formY + 10, 14, Phaser.Display.Color.HexStringToColor(color).color);
        circle.setStrokeStyle(idx === 0 ? 3 : 1, 0xffd700);
        circle.setInteractive({ useHandCursor: true });
        circle.on('pointerdown', function() {
          selectedColor = color;
          for (var k = 0; k < colorBtns.length; k++) colorBtns[k].setStrokeStyle(1, 0xffd700);
          circle.setStrokeStyle(3, 0xffd700);
        });
        colorBtns.push(circle);
      })(colors[ci], ci);
    }
    formY += lineH;

    // 起始城市
    this.add.text(formX, formY, '起始城市：', { fontSize: '16px', color: '#c4a882', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    var noneCities = [];
    for (var c = 0; c < window.SG3.CITIES_DATA.length; c++) {
      if (window.SG3.CITIES_DATA[c].faction === 'none') noneCities.push(window.SG3.CITIES_DATA[c]);
    }
    var cityIdx = 0;
    var cityText = this.add.text(formX + 100, formY, noneCities.length > 0 ? noneCities[0].name : '（无在野空城）', { fontSize: '16px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    if (noneCities.length > 0) {
      var prevBtn = this.add.text(formX + 200, formY, '<', { fontSize: '20px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif' }).setInteractive({ useHandCursor: true });
      var nextBtn = this.add.text(formX + 230, formY, '>', { fontSize: '20px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif' }).setInteractive({ useHandCursor: true });
      prevBtn.on('pointerdown', function() { cityIdx = (cityIdx - 1 + noneCities.length) % noneCities.length; cityText.setText(noneCities[cityIdx].name); });
      nextBtn.on('pointerdown', function() { cityIdx = (cityIdx + 1) % noneCities.length; cityText.setText(noneCities[cityIdx].name); });
    }
    formY += lineH;

    // 兵种选择
    this.add.text(formX, formY, '君主兵种：', { fontSize: '16px', color: '#c4a882', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    var troopTypes = [{ val: 'infantry', label: '步兵' }, { val: 'cavalry', label: '骑兵' }, { val: 'archer', label: '弓兵' }];
    var troopIdx = 0;
    var troopText = this.add.text(formX + 100, formY, '步兵', { fontSize: '16px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    var tPrev = this.add.text(formX + 160, formY, '<', { fontSize: '20px', color: '#e8d4b0' }).setInteractive({ useHandCursor: true });
    var tNext = this.add.text(formX + 190, formY, '>', { fontSize: '20px', color: '#e8d4b0' }).setInteractive({ useHandCursor: true });
    tPrev.on('pointerdown', function() { troopIdx = (troopIdx - 1 + troopTypes.length) % troopTypes.length; troopText.setText(troopTypes[troopIdx].label); });
    tNext.on('pointerdown', function() { troopIdx = (troopIdx + 1) % troopTypes.length; troopText.setText(troopTypes[troopIdx].label); });
    formY += lineH + 5;

    // 属性分配
    var attrPoints = 350;
    var attrs = { force: 70, intellect: 70, politics: 70, command: 70, charisma: 70 };
    var attrNames = [
      { key: 'force', label: '武力', color: '#cc4444' },
      { key: 'intellect', label: '智力', color: '#4488cc' },
      { key: 'politics', label: '政治', color: '#daa520' },
      { key: 'command', label: '统率', color: '#44aa44' },
      { key: 'charisma', label: '魅力', color: '#cc8844' }
    ];

    var remainText = this.add.text(w / 2, formY, '属性分配（剩余点数：' + (attrPoints - 350 + 350) + '）', { fontSize: '16px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif' }).setOrigin(0.5);
    // Fix: recalculate remaining
    var calcRemain = function() { var used = 0; for (var k in attrs) used += attrs[k]; return attrPoints - used; };
    remainText.setText('属性分配（剩余点数：' + calcRemain() + '）');
    formY += 28;

    var attrValTexts = {};
    for (var ai = 0; ai < attrNames.length; ai++) {
      (function(attrInfo) {
        var y = formY + ai * 34;
        scene.add.text(formX, y, attrInfo.label, { fontSize: '15px', color: attrInfo.color, fontFamily: '"Microsoft YaHei", "SimHei", serif' });

        // -10
        var m10 = scene.add.text(formX + 50, y, '-10', { fontSize: '14px', color: '#ff9090', fontFamily: '"Microsoft YaHei", "SimHei", serif', backgroundColor: '#3a1a1a', padding: { x: 4, y: 2 } }).setInteractive({ useHandCursor: true });
        m10.on('pointerdown', function() { adjustAttr(attrInfo.key, -10); });

        // -1
        var m1 = scene.add.text(formX + 95, y, '-', { fontSize: '16px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif', backgroundColor: '#333', padding: { x: 6, y: 2 } }).setInteractive({ useHandCursor: true });
        m1.on('pointerdown', function() { adjustAttr(attrInfo.key, -1); });

        // 数值
        var valText = scene.add.text(formX + 125, y, '' + attrs[attrInfo.key], { fontSize: '16px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
        attrValTexts[attrInfo.key] = valText;

        // +1
        var p1 = scene.add.text(formX + 165, y, '+', { fontSize: '16px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif', backgroundColor: '#333', padding: { x: 6, y: 2 } }).setInteractive({ useHandCursor: true });
        p1.on('pointerdown', function() { adjustAttr(attrInfo.key, 1); });

        // +10
        var p10 = scene.add.text(formX + 195, y, '+10', { fontSize: '14px', color: '#90ff90', fontFamily: '"Microsoft YaHei", "SimHei", serif', backgroundColor: '#1a3a1a', padding: { x: 4, y: 2 } }).setInteractive({ useHandCursor: true });
        p10.on('pointerdown', function() { adjustAttr(attrInfo.key, 10); });

        // 属性条
        var barBg = scene.add.graphics();
        barBg.fillStyle(0x222222, 1);
        barBg.fillRect(formX + 240, y + 4, 100, 12);
        var barFill = scene.add.graphics();

        function updateBar() {
          barFill.clear();
          barFill.fillStyle(Phaser.Display.Color.HexStringToColor(attrInfo.color).color, 1);
          barFill.fillRect(formX + 240, y + 4, attrs[attrInfo.key], 12);
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
          remainText.setText('属性分配（剩余点数：' + calcRemain() + '）');
          updateBar();
        }
      })(attrNames[ai]);
    }

    formY += attrNames.length * 34 + 15;

    // 专属武将技设计 - 简化版
    this.add.text(w / 2, formY, '专属武将技', { fontSize: '16px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif' }).setOrigin(0.5);
    formY += 25;

    this.add.text(formX, formY, '技能名称：', { fontSize: '14px', color: '#c4a882', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    var defaultSkills = ['霸王斩', '龙魂破', '凤舞九天', '虎啸山林', '玄武护体', '雷霆万钧', '烈焰焚天', '冰封万里', '星辰陨落', '天命所归'];
    var skillInput = this._createInputField(formX + 100, formY - 3, defaultSkills[Math.floor(Math.random() * defaultSkills.length)], 150);
    // 随机技能名按钮
    var skillRandomBtn = scene.add.text(formX + 270, formY - 2, '🎲', { fontSize: '16px' }).setInteractive({ useHandCursor: true });
    skillRandomBtn.on('pointerdown', function() {
      var randSkill = defaultSkills[Math.floor(Math.random() * defaultSkills.length)];
      skillInput.setText(randSkill);
      skillInput.text = randSkill;
    });
    formY += 30;

    // 效果类型
    this.add.text(formX, formY, '效果类型：', { fontSize: '14px', color: '#c4a882', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    var effectTypes = ['damage', 'heal_troops', 'heal_hp', 'buff_attack', 'morale_up'];
    var effectLabels = ['伤害', '恢复兵力', '恢复HP', '攻击增益', '士气提升'];
    var effectIdx = 0;
    var effectText = this.add.text(formX + 100, formY, '伤害', { fontSize: '14px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    var ePrev = scene.add.text(formX + 150, formY, '<', { fontSize: '16px', color: '#e8d4b0' }).setInteractive({ useHandCursor: true });
    var eNext = scene.add.text(formX + 175, formY, '>', { fontSize: '16px', color: '#e8d4b0' }).setInteractive({ useHandCursor: true });
    ePrev.on('pointerdown', function() { effectIdx = (effectIdx - 1 + effectTypes.length) % effectTypes.length; effectText.setText(effectLabels[effectIdx]); });
    eNext.on('pointerdown', function() { effectIdx = (effectIdx + 1) % effectTypes.length; effectText.setText(effectLabels[effectIdx]); });
    formY += 30;

    // 技能威力
    this.add.text(formX, formY, '技能威力：', { fontSize: '14px', color: '#c4a882', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    var powerVal = 80;
    var powerText = this.add.text(formX + 100, formY, '80', { fontSize: '14px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    var pwrM = scene.add.text(formX + 140, formY, '-', { fontSize: '16px', color: '#e8d4b0', backgroundColor: '#333', padding: {x:4,y:2} }).setInteractive({ useHandCursor: true });
    var pwrP = scene.add.text(formX + 165, formY, '+', { fontSize: '16px', color: '#e8d4b0', backgroundColor: '#333', padding: {x:4,y:2} }).setInteractive({ useHandCursor: true });
    pwrM.on('pointerdown', function() { powerVal = Math.max(30, powerVal - 10); powerText.setText('' + powerVal); });
    pwrP.on('pointerdown', function() { powerVal = Math.min(150, powerVal + 10); powerText.setText('' + powerVal); });
    formY += 30;

    // 技力消耗
    this.add.text(formX, formY, '技力消耗：', { fontSize: '14px', color: '#c4a882', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    var costVal = 35;
    var costText = this.add.text(formX + 100, formY, '35', { fontSize: '14px', color: '#ffd700', fontFamily: '"Microsoft YaHei", "SimHei", serif' });
    var cstM = scene.add.text(formX + 140, formY, '-', { fontSize: '16px', color: '#e8d4b0', backgroundColor: '#333', padding: {x:4,y:2} }).setInteractive({ useHandCursor: true });
    var cstP = scene.add.text(formX + 165, formY, '+', { fontSize: '16px', color: '#e8d4b0', backgroundColor: '#333', padding: {x:4,y:2} }).setInteractive({ useHandCursor: true });
    cstM.on('pointerdown', function() { costVal = Math.max(10, costVal - 5); costText.setText('' + costVal); });
    cstP.on('pointerdown', function() { costVal = Math.min(60, costVal + 5); costText.setText('' + costVal); });
    formY += 45;

    // 按钮
    this._createButton(w / 2 - 100, formY, '开始游戏', '#ffd700', function() {
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

    this._createButton(w / 2 + 100, formY, '返回', '#c4a882', function() {
      scene.scene.restart();
    });
  },

  _createInputField: function(x, y, placeholder, width) {
    // 使用 Phaser 文本模拟输入框（实际游戏中需要键盘输入支持）
    // 这里简化处理：点击后通过 prompt 获取输入
    var textObj = this.add.text(x, y, placeholder, {
      fontSize: '16px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#e8d4b0', backgroundColor: '#1a1a1a', padding: { x: 8, y: 4 },
      fixedWidth: width || 200
    }).setInteractive({ useHandCursor: true });

    textObj.text = placeholder;
    textObj.on('pointerdown', function() {
      var input = window.prompt(placeholder, textObj.text === placeholder ? '' : textObj.text);
      if (input !== null && input.trim()) {
        textObj.setText(input.trim());
        textObj.text = input.trim();
      }
    });

    return textObj;
  },

  _createButton: function(x, y, label, color, callback) {
    var text = this.add.text(x, y, label, {
      fontSize: '18px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: color, backgroundColor: 'rgba(0,0,0,0.4)',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    text.on('pointerover', function() { text.setScale(1.05); });
    text.on('pointerout', function() { text.setScale(1); });
    text.on('pointerdown', callback);

    return text;
  },

  _showToast: function(msg) {
    var toast = this.add.text(this._w / 2, 50, msg, {
      fontSize: '16px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', backgroundColor: 'rgba(0,0,0,0.8)',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setDepth(999);

    this.tweens.add({
      targets: toast, alpha: 0, y: toast.y - 30,
      duration: 2000, ease: 'Power2',
      onComplete: function() { toast.destroy(); }
    });
  }
});
