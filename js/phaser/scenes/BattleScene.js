/**
 * 三国群英传 - 战斗场景
 * 含武将头像、攻击动画、浮动伤害数字、技能特效
 * @author jian.li
 */
window.SG3 = window.SG3 || {};

window.SG3.BattleScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function BattleScene() {
    Phaser.Scene.call(this, { key: 'BattleScene' });
  },

  create: function() {
    var GD = window.SG3.GameData;
    var battle = GD.battle;
    if (!battle) {
      this.game.scene.start('MapScene');
      return;
    }

    this._gd = GD;
    var w = this.cameras.main.width;
    var h = this.cameras.main.height;
    this._w = w;
    this._h = h;

    // 战场背景 - 渐变天空+战场
    this._drawBattlefield();

    // 标题
    var atkName = (window.SG3.FACTION_NAMES && window.SG3.FACTION_NAMES[battle.attackerFaction]) || battle.attackerFaction;
    var defName = (window.SG3.FACTION_NAMES && window.SG3.FACTION_NAMES[battle.defenderFaction]) || battle.defenderFaction;
    var titleBg = this.add.graphics();
    titleBg.fillStyle(0x000000, 0.6);
    titleBg.fillRect(0, 0, w, 50);
    this.add.text(w / 2, 25, atkName + '  VS  ' + defName, {
      fontSize: '26px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', stroke: '#3a1a00', strokeThickness: 3, fontStyle: 'bold'
    }).setOrigin(0.5);

    // 初始化战斗引擎
    var BE = window.SG3.BattleEngine;
    BE.init(battle.attackerHeroIds, battle.defenderHeroIds, battle.attackerFaction, battle.defenderFaction);
    this._be = BE;

    // 绘制武将
    this._heroDisplays = { attacker: [], defender: [] };
    this._drawHeroes();

    // 战斗日志区域背景
    var logBg = this.add.graphics();
    logBg.fillStyle(0x000000, 0.5);
    logBg.fillRect(0, h - 150, w, 150);
    logBg.lineStyle(2, 0x6a4a1a, 1);
    logBg.beginPath(); logBg.moveTo(0, h - 150); logBg.lineTo(w, h - 150); logBg.strokePath();

    this._logTexts = [];
    this._logY = h - 140;

    // 操作按钮
    var scene = this;
    this._createBattleButton(w / 2 - 100, h - 40, '撤退', '#ff6644', function() {
      BE.retreat();
      scene._endBattle();
    });
    this._createBattleButton(w / 2 + 100, h - 40, '跳过', '#c4a882', function() {
      scene._doStep();
    });

    // 自动战斗定时器
    this._battleTimer = this.time.addEvent({
      delay: 1500,
      callback: this._doStep,
      callbackScope: this,
      loop: true
    });
  },

  // 绘制战场背景
  _drawBattlefield: function() {
    var w = this._w, h = this._h;
    var bg = this.add.graphics();
    // 天空渐变
    bg.fillGradientStyle(0x2a1a0a, 0x3a2a1a, 0x5a3a1a, 0x4a2a1a, 1);
    bg.fillRect(0, 0, w, h);

    // 远山
    bg.fillStyle(0x3a2a1a, 0.6);
    bg.fillTriangle(0, 200, 200, 100, 400, 200);
    bg.fillTriangle(300, 200, 500, 80, 700, 200);
    bg.fillTriangle(600, 200, 800, 120, 1000, 200);
    bg.fillTriangle(800, 200, 1000, 100, 1280, 200);

    // 地面
    bg.fillGradientStyle(0x4a3a1a, 0x4a3a1a, 0x3a2a0a, 0x3a2a0a, 1);
    bg.fillRect(0, 200, w, h - 200);

    // 战场分割线（中线）
    bg.lineStyle(2, 0x6a4a2a, 0.3);
    bg.beginPath(); bg.moveTo(w / 2, 50); bg.lineTo(w / 2, h - 150); bg.strokePath();

    // 旗帜装饰（左右各一）
    var atkColor = window.SG3.FACTION_COLORS[window.SG3.GameData.battle.attackerFaction] || 0x888888;
    var defColor = window.SG3.FACTION_COLORS[window.SG3.GameData.battle.defenderFaction] || 0x888888;
    // 左旗
    bg.fillStyle(0x4a3a2a, 1); bg.fillRect(30, 55, 3, 50);
    bg.fillStyle(atkColor, 1); bg.fillTriangle(33, 55, 70, 65, 33, 75);
    // 右旗
    bg.fillStyle(0x4a3a2a, 1); bg.fillRect(w - 33, 55, 3, 50);
    bg.fillStyle(defColor, 1); bg.fillTriangle(w - 33, 55, w - 70, 65, w - 33, 75);
  },

  _drawHeroes: function() {
    var BE = this._be;
    var state = BE.state;
    if (!state) return;

    var w = this._w;
    var h = this._h;

    // 攻方 - 左侧
    var atkCount = state.attacker.heroes.length;
    var atkSpacing = Math.min(120, (h - 220) / Math.max(atkCount, 1));
    var atkStartY = 80 + (h - 220 - atkSpacing * (atkCount - 1)) / 2;
    for (var i = 0; i < atkCount; i++) {
      this._drawHeroCard(state.attacker.heroes[i], 60, atkStartY + i * atkSpacing, 'attacker', i);
    }

    // 守方 - 右侧
    var defCount = state.defender.heroes.length;
    var defSpacing = Math.min(120, (h - 220) / Math.max(defCount, 1));
    var defStartY = 80 + (h - 220 - defSpacing * (defCount - 1)) / 2;
    for (var j = 0; j < defCount; j++) {
      this._drawHeroCard(state.defender.heroes[j], w - 280, defStartY + j * defSpacing, 'defender', j);
    }
  },

  _drawHeroCard: function(battleHero, x, y, side, index) {
    var GD = this._gd;
    var heroData = GD.heroes[battleHero.heroId];
    var name = heroData ? heroData.name : battleHero.heroId;
    var faction = heroData ? heroData.faction : 'none';
    var factionColor = (window.SG3.FACTION_COLORS[faction] || 0x888888);
    var factionCss = (window.SG3.FACTION_CSS && window.SG3.FACTION_CSS[faction]) || '#888';
    var isPlayer = (side === 'attacker' && faction === GD.playerFaction) ||
                   (side === 'defender' && faction === GD.playerFaction);

    var cardW = 220, cardH = 105;

    // 卡片背景
    var cardBg = this.add.graphics();
    cardBg.fillStyle(0x000000, 0.5);
    cardBg.fillRoundedRect(x, y, cardW, cardH, 6);
    cardBg.lineStyle(2, factionColor, 1);
    cardBg.strokeRoundedRect(x, y, cardW, cardH, 6);

    // 武将头像
    this._drawHeroPortrait(x + 5, y + 5, heroData, 44);

    // 名称
    var nameColor = heroData && heroData.isMonarch ? '#ffd700' : factionCss;
    var nameText = this.add.text(x + 55, y + 5, name, {
      fontSize: '15px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: nameColor, fontStyle: 'bold'
    });
    if (heroData && heroData.isMonarch) {
      nameText.setText('★ ' + name);
    }

    // 兵种标识
    var troopTypeName = { infantry: '步', cavalry: '骑', archer: '弓' }[battleHero.troopType] || '?';
    this.add.text(x + 55 + nameText.width + 8, y + 7, '[' + troopTypeName + ']', {
      fontSize: '12px', color: '#aaa', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    });

    // HP条
    var hpBarX = x + 55, hpBarY = y + 28, barW = 130;
    var hpBg = this.add.graphics();
    hpBg.fillStyle(0x333333, 1);
    hpBg.fillRoundedRect(hpBarX, hpBarY, barW, 10, 3);
    var hpFill = this.add.graphics();
    var hpPct = battleHero.hp / battleHero.maxHp;
    hpFill.fillStyle(hpPct > 0.3 ? 0x44cc44 : 0xcc4444, 1);
    hpFill.fillRoundedRect(hpBarX, hpBarY, barW * hpPct, 10, 3);
    var hpText = this.add.text(hpBarX + barW + 5, hpBarY - 2, battleHero.hp + '/' + battleHero.maxHp, {
      fontSize: '10px', color: '#88cc44', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    });

    // SP条
    var spBarY = y + 42;
    var spBg = this.add.graphics();
    spBg.fillStyle(0x333333, 1);
    spBg.fillRoundedRect(hpBarX, spBarY, barW, 10, 3);
    var spFill = this.add.graphics();
    var spPct = battleHero.sp / battleHero.maxSp;
    spFill.fillStyle(0x4488ff, 1);
    spFill.fillRoundedRect(hpBarX, spBarY, barW * spPct, 10, 3);
    var spText = this.add.text(hpBarX + barW + 5, spBarY - 2, battleHero.sp + '/' + battleHero.maxSp, {
      fontSize: '10px', color: '#66aaff', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    });

    // 兵力 + 士气
    var troopsText = this.add.text(x + 55, y + 58, '兵 ' + battleHero.troops, {
      fontSize: '12px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif', fontStyle: 'bold'
    });
    var moraleText = this.add.text(x + 120, y + 58, '士气 ' + battleHero.morale, {
      fontSize: '12px', color: '#c4a882', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    });

    // 技能按钮（仅玩家武将）
    var skillBtns = [];
    var self = this;
    if (isPlayer && battleHero.skills.length > 0) {
      for (var si = 0; si < battleHero.skills.length && si < 3; si++) {
        (function(skillId, heroIdx, sideStr) {
          var skillData = window.SG3.SKILLS_DATA[skillId];
          if (!skillData) return;
          var btnX = x + 55 + si * 55;
          var btnY = y + 78;
          var btnBg = self.add.graphics();
          var canUse = battleHero.sp >= skillData.spCost;
          btnBg.fillStyle(canUse ? 0x6a3a0a : 0x333333, 0.8);
          btnBg.fillRoundedRect(btnX, btnY, 50, 20, 3);
          btnBg.lineStyle(1, canUse ? 0xaa6a2a : 0x555555, 1);
          btnBg.strokeRoundedRect(btnX, btnY, 50, 20, 3);
          var btn = self.add.text(btnX + 25, btnY + 10, skillData.name, {
            fontSize: '10px', color: canUse ? '#ffd700' : '#666',
            fontFamily: '"Microsoft YaHei", "SimHei", serif'
          }).setOrigin(0.5).setInteractive({ useHandCursor: true });
          btn.on('pointerdown', function() {
            if (battleHero.sp < skillData.spCost) { self._addLog('技力不足'); return; }
            var result = self._be.useSkill(heroIdx, skillId, sideStr);
            if (result) {
              self._addLog(name + ' 使用了 ' + skillData.name + '！');
              self._showSkillEffect(sideStr, heroIdx, skillData);
              self._updateHeroDisplays();
            }
          });
          skillBtns.push({ btn: btn, bg: btnBg, spCost: skillData.spCost, x: btnX, y: btnY });
        })(battleHero.skills[si], index, side);
      }
    }

    this._heroDisplays[side].push({
      battleHero: battleHero,
      cardBg: cardBg, nameText: nameText,
      hpFill: hpFill, hpText: hpText,
      spFill: spFill, spText: spText,
      troopsText: troopsText, moraleText: moraleText,
      skillBtns: skillBtns,
      hpBarX: hpBarX, hpBarY: hpBarY, barW: barW,
      spBarX: hpBarX, spBarY: spBarY,
      cardX: x, cardY: y, cardW: cardW, cardH: cardH,
      side: side
    });
  },

  // 绘制武将头像（战斗场景用，大尺寸）
  _drawHeroPortrait: function(x, y, heroData, size) {
    if (!heroData) return;
    var g = this.add.graphics();
    var factionColor = (window.SG3.FACTION_COLORS[heroData.faction] || 0x888888);

    // 头像框
    g.fillStyle(0x2a1a0a, 1);
    g.fillRoundedRect(x, y, size, size, 4);
    g.fillStyle(factionColor, 0.6);
    g.fillRoundedRect(x + 1, y + 1, size - 2, size - 2, 3);

    var cx = x + size / 2, cy = y + size / 2;
    var isWarrior = heroData.force >= 80;
    var isStrategist = heroData.intellect >= 85;
    var isMonarch = heroData.isMonarch;

    // 人物剪影
    g.fillStyle(0xe8d8c0, 0.9);
    // 头
    g.fillCircle(cx, cy - size * 0.15, size * 0.18);
    // 身体
    g.fillRect(cx - size * 0.15, cy + size * 0.02, size * 0.3, size * 0.3);

    // 类型标识
    if (isMonarch) {
      // 皇冠
      g.fillStyle(0xffd700, 1);
      g.fillTriangle(cx, cy - size * 0.35, cx - size * 0.18, cy - size * 0.2, cx + size * 0.18, cy - size * 0.2);
      g.fillStyle(0xcc8800, 1);
      g.fillRect(cx - size * 0.18, cy - size * 0.22, size * 0.36, size * 0.04);
    } else if (isStrategist) {
      // 纶巾（谋士帽）
      g.fillStyle(0xe8e0d0, 1);
      g.fillTriangle(cx, cy - size * 0.35, cx - size * 0.2, cy - size * 0.2, cx + size * 0.2, cy - size * 0.2);
      g.fillStyle(0x4488cc, 0.8);
      g.fillRect(cx - size * 0.05, cy - size * 0.32, size * 0.1, size * 0.05);
    } else if (isWarrior) {
      // 头盔
      g.fillStyle(0x8a6a3a, 1);
      g.fillCircle(cx, cy - size * 0.22, size * 0.2);
      g.fillStyle(0xaa3333, 1);
      g.fillTriangle(cx, cy - size * 0.42, cx - size * 0.05, cy - size * 0.28, cx + size * 0.05, cy - size * 0.28);
    }

    // 武器标识
    if (isWarrior && !isMonarch) {
      g.fillStyle(0xe8e0d0, 0.7);
      g.fillRect(cx + size * 0.22, cy - size * 0.1, 2, size * 0.4);
      g.fillStyle(0xaa6a2a, 0.7);
      g.fillRect(cx + size * 0.18, cy + size * 0.25, size * 0.1, 3);
    }

    return g;
  },

  _doStep: function() {
    var BE = this._be;
    if (BE.isOver()) {
      this._endBattle();
      return;
    }

    var events = BE.step();
    if (events.length > 0) {
      for (var i = 0; i < events.length; i++) {
        var evt = events[i];
        if (evt.type === 'attack') {
          // 显示攻击动画
          this._showAttackAnimation(evt);
          this._addLog(evt.attackerName + ' 攻击 ' + evt.defenderName + '  伤兵' + evt.troopDamage + ' HP' + evt.hpDamage);

          if (evt.destiny) {
            var d = evt.destiny;
            this._showDestinyEffect(d);
            this._addLog('【天命觉醒】' + d.heroName + ' HP锁血！全属性提升' + d.statBoost + '！');
            for (var mi = 0; mi < d.meteorTargets.length; mi++) {
              this._addLog('  陨石砸中 ' + d.meteorTargets[mi].name + '，消灭士兵' + d.meteorTargets[mi].killedTroops);
            }
          }
        } else if (evt.type === 'advisorSkill') {
          this._addLog(evt.sourceName + ' 施展军师技「' + evt.skillName + '」');
        } else if (evt.type === 'destiny') {
          this._showDestinyEffect(evt);
          this._addLog('【天命觉醒】' + evt.heroName + ' HP锁血！全属性提升' + evt.statBoost + '！');
        } else if (evt.type === 'battleEnd') {
          this._showBattleEnd(evt.winner);
          this._addLog(evt.winner === 'attacker' ? '★ 攻方获胜！' : '★ 守方获胜！');
        }
      }
    }

    this._updateHeroDisplays();

    if (BE.isOver()) {
      this._battleTimer.remove();
      var scene = this;
      this.time.addEvent({
        delay: 2500,
        callback: function() { scene._endBattle(); }
      });
    }
  },

  // 攻击动画
  _showAttackAnimation: function(evt) {
    var side = evt.side;
    var displays = this._heroDisplays[side];
    var targetSide = side === 'attacker' ? 'defender' : 'attacker';
    var targetDisplays = this._heroDisplays[targetSide];

    // 找到攻击者
    var attackerDisp = null;
    for (var i = 0; i < displays.length; i++) {
      if (displays[i].battleHero.heroId === evt.attacker) {
        attackerDisp = displays[i];
        break;
      }
    }
    // 找到防守者
    var defenderDisp = null;
    for (var j = 0; j < targetDisplays.length; j++) {
      if (targetDisplays[j].battleHero.heroId === evt.defender) {
        defenderDisp = targetDisplays[j];
        break;
      }
    }

    if (!attackerDisp || !defenderDisp) return;

    var scene = this;
    var ax = attackerDisp.cardX + attackerDisp.cardW / 2;
    var ay = attackerDisp.cardY + attackerDisp.cardH / 2;
    var dx = defenderDisp.cardX + defenderDisp.cardW / 2;
    var dy = defenderDisp.cardY + defenderDisp.cardH / 2;

    // 攻击者前冲动画
    var rushX = (dx - ax) * 0.3;
    var rushY = (dy - ay) * 0.3;
    this.tweens.add({
      targets: attackerDisp.cardBg,
      x: rushX, y: rushY,
      duration: 200, yoyo: true, ease: 'Power2'
    });
    // 同时移动其他卡片元素
    for (var k = 0; k < this._heroDisplays[side].length; k++) {
      var d = this._heroDisplays[side][k];
      if (d === attackerDisp) {
        this.tweens.add({ targets: d.nameText, x: rushX, y: rushY, duration: 200, yoyo: true, ease: 'Power2' });
      }
    }

    // 命中闪光
    this.time.delayedCall(200, function() {
      // 闪光圆
      var flash = scene.add.circle(dx, dy, 40, 0xffffff, 0.8);
      flash.setDepth(50);
      scene.tweens.add({
        targets: flash, scaleX: 2, scaleY: 2, alpha: 0,
        duration: 300, ease: 'Power2',
        onComplete: function() { flash.destroy(); }
      });

      // 屏幕震动
      scene.cameras.main.shake(150, 0.005);

      // 浮动伤害数字
      if (evt.troopDamage > 0) {
        scene._showDamageNumber(dx - 30, dy - 20, '-' + evt.troopDamage, '#ff4444', 20);
      }
      if (evt.hpDamage > 0) {
        scene._showDamageNumber(dx + 30, dy - 20, '-' + evt.hpDamage + 'HP', '#ff6666', 18);
      }
    });
  },

  // 浮动伤害数字
  _showDamageNumber: function(x, y, text, color, size) {
    var dmg = this.add.text(x, y, text, {
      fontSize: size + 'px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: color, stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(60);

    this.tweens.add({
      targets: dmg,
      y: y - 40, alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 800, ease: 'Power2',
      onComplete: function() { dmg.destroy(); }
    });
  },

  // 技能特效
  _showSkillEffect: function(side, heroIndex, skillData) {
    var displays = this._heroDisplays[side];
    if (!displays[heroIndex]) return;
    var disp = displays[heroIndex];
    var cx = disp.cardX + disp.cardW / 2;
    var cy = disp.cardY + disp.cardH / 2;

    // 元素颜色
    var elementColors = {
      fire: 0xff6600, lightning: 0xffff00, ink: 0x88aaff
    };
    var particleColor = elementColors[skillData.element] || 0x88aaff;

    // 发光圈
    var glow = this.add.circle(cx, cy, 50, particleColor, 0.5);
    glow.setDepth(45);
    this.tweens.add({
      targets: glow, scaleX: 2.5, scaleY: 2.5, alpha: 0,
      duration: 600, ease: 'Power2',
      onComplete: function() { glow.destroy(); }
    });

    // 粒子效果
    for (var i = 0; i < 12; i++) {
      var angle = (i / 12) * Math.PI * 2;
      var particle = this.add.circle(cx, cy, 4, particleColor, 1);
      particle.setDepth(46);
      this.tweens.add({
        targets: particle,
        x: cx + Math.cos(angle) * 60,
        y: cy + Math.sin(angle) * 60,
        alpha: 0, scaleX: 0.3, scaleY: 0.3,
        duration: 500, ease: 'Power2',
        onComplete: function() { this.targets[0].destroy(); }
      });
    }

    // 技能名称显示
    var skillText = this.add.text(cx, cy - 40, skillData.name + '！', {
      fontSize: '24px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', stroke: '#3a1a00', strokeThickness: 4, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(55);

    this.tweens.add({
      targets: skillText,
      y: cy - 80, scaleX: 1.3, scaleY: 1.3,
      duration: 400, ease: 'Back.easeOut',
      onComplete: function() {
        scene_tween_fade(skillText);
      }
    });

    function scene_tween_fade(obj) {
      obj.scene.tweens.add({
        targets: obj, alpha: 0, y: obj.y - 20,
        duration: 400, delay: 300,
        onComplete: function() { obj.destroy(); }
      });
    }
  },

  // 天命觉醒特效
  _showDestinyEffect: function(d) {
    var w = this._w, h = this._h;

    // 全屏闪光
    var flash = this.add.rectangle(0, 0, w, h, 0xffd700, 0.4);
    flash.setOrigin(0).setDepth(80);
    this.tweens.add({
      targets: flash, alpha: 0,
      duration: 500,
      onComplete: function() { flash.destroy(); }
    });

    // 天命文字
    var text = this.add.text(w / 2, h / 2, '天命觉醒', {
      fontSize: '64px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', stroke: '#cc4400', strokeThickness: 6, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(81).setAlpha(0);

    this.tweens.add({
      targets: text, alpha: 1, scaleX: 1.2, scaleY: 1.2,
      duration: 400, ease: 'Back.easeOut',
      onComplete: function() {
        text.scene.tweens.add({
          targets: text, alpha: 0, y: text.y - 50,
          duration: 1000, delay: 800,
          onComplete: function() { text.destroy(); }
        });
      }
    });

    // 屏幕震动
    this.cameras.main.shake(400, 0.01);
  },

  // 战斗结束特效
  _showBattleEnd: function(winner) {
    var w = this._w, h = this._h;
    var text = winner === 'attacker' ? '攻方大胜！' : '守方坚守！';
    var color = winner === 'attacker' ? '#ff6644' : '#44aaff';

    var bg = this.add.rectangle(0, 0, w, h, 0x000000, 0.3);
    bg.setOrigin(0).setDepth(70);

    var title = this.add.text(w / 2, h / 2, text, {
      fontSize: '48px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: color, stroke: '#3a1a00', strokeThickness: 5, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(71).setAlpha(0);

    this.tweens.add({
      targets: title, alpha: 1, scaleX: 1.1, scaleY: 1.1,
      duration: 500, ease: 'Back.easeOut'
    });
  },

  _updateHeroDisplays: function() {
    var sides = ['attacker', 'defender'];
    for (var s = 0; s < sides.length; s++) {
      var side = sides[s];
      var displays = this._heroDisplays[side];
      for (var i = 0; i < displays.length; i++) {
        var d = displays[i];
        var hero = d.battleHero;
        var hpPct = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
        var spPct = hero.maxSp > 0 ? hero.sp / hero.maxSp : 0;

        d.hpFill.clear();
        d.hpFill.fillStyle(hpPct > 0.3 ? 0x44cc44 : 0xcc4444, 1);
        d.hpFill.fillRoundedRect(d.hpBarX, d.hpBarY, d.barW * hpPct, 10, 3);

        d.spFill.clear();
        d.spFill.fillStyle(0x4488ff, 1);
        d.spFill.fillRoundedRect(d.spBarX, d.spBarY, d.barW * spPct, 10, 3);

        d.hpText.setText(hero.hp + '/' + hero.maxHp);
        d.spText.setText(hero.sp + '/' + hero.maxSp);
        d.troopsText.setText('兵 ' + hero.troops);
        d.moraleText.setText('士气 ' + hero.morale);

        // 更新技能按钮状态
        for (var k = 0; k < d.skillBtns.length; k++) {
          var sb = d.skillBtns[k];
          var canUse = hero.sp >= sb.spCost;
          sb.bg.clear();
          sb.bg.fillStyle(canUse ? 0x6a3a0a : 0x333333, 0.8);
          sb.bg.fillRoundedRect(sb.x, sb.y, 50, 20, 3);
          sb.bg.lineStyle(1, canUse ? 0xaa6a2a : 0x555555, 1);
          sb.bg.strokeRoundedRect(sb.x, sb.y, 50, 20, 3);
          sb.btn.setColor(canUse ? '#ffd700' : '#666');
        }

        // 阵亡灰化
        if (hero.hp <= 0 && hero.troops <= 0) {
          d.nameText.setColor('#666666');
          d.cardBg.clear();
          d.cardBg.fillStyle(0x222222, 0.3);
          d.cardBg.fillRoundedRect(d.cardX, d.cardY, d.cardW, d.cardH, 6);
          // 阵亡标记
          if (!d._deadMark) {
            d._deadMark = this.add.text(d.cardX + d.cardW / 2, d.cardY + d.cardH / 2, '阵亡', {
              fontSize: '24px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
              color: '#cc4444', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
            }).setOrigin(0.5).setRotation(-0.3);
          }
        }
      }
    }
  },

  _endBattle: function() {
    if (this._battleTimer) this._battleTimer.remove();
    var BE = this._be;
    if (BE && !BE.isOver()) {
      BE.state.phase = 'ended';
      BE.state.winner = BE.state.attacker.heroes.some(function(h) { return h.hp > 0 || h.troops > 0; }) ? 'attacker' : 'defender';
    }

    if (BE) BE.applyResult();

    this.game.scene.stop('BattleScene');
    this.game.scene.start('MapScene');
  },

  _addLog: function(msg) {
    var logText = this.add.text(20, this._logY, msg, {
      fontSize: '13px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#e8d4b0', stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: this._w - 40 }
    });
    this._logTexts.push(logText);
    this._logY += 18;

    if (this._logTexts.length > 6) {
      var old = this._logTexts.shift();
      old.destroy();
      for (var i = 0; i < this._logTexts.length; i++) {
        this._logTexts[i].y -= 18;
      }
    }
  },

  _createBattleButton: function(x, y, label, color, callback) {
    var bg = this.add.graphics();
    bg.fillStyle(0x3a1a0a, 0.9);
    bg.fillRoundedRect(x - 50, y - 14, 100, 28, 4);
    bg.lineStyle(1, 0x8a5a2a, 1);
    bg.strokeRoundedRect(x - 50, y - 14, 100, 28, 4);

    var text = this.add.text(x, y, label, {
      fontSize: '15px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: color, fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    text.on('pointerover', function() {
      bg.clear();
      bg.fillStyle(0x5a2a0a, 0.9);
      bg.fillRoundedRect(x - 50, y - 14, 100, 28, 4);
      bg.lineStyle(1, 0xaa6a2a, 1);
      bg.strokeRoundedRect(x - 50, y - 14, 100, 28, 4);
    });
    text.on('pointerout', function() {
      bg.clear();
      bg.fillStyle(0x3a1a0a, 0.9);
      bg.fillRoundedRect(x - 50, y - 14, 100, 28, 4);
      bg.lineStyle(1, 0x8a5a2a, 1);
      bg.strokeRoundedRect(x - 50, y - 14, 100, 28, 4);
    });
    text.on('pointerdown', callback);
    return text;
  }
});
