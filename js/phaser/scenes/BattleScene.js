/**
 * 三国群英传 - 战斗场景
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

    // 背景
    var bg = this.add.graphics();
    bg.fillGradientStyle(0x1a0800, 0x1a0800, 0x3a1800, 0x3a1800, 1);
    bg.fillRect(0, 0, w, h);

    // 标题
    var atkName = (window.SG3.FACTION_NAMES && window.SG3.FACTION_NAMES[battle.attackerFaction]) || battle.attackerFaction;
    var defName = (window.SG3.FACTION_NAMES && window.SG3.FACTION_NAMES[battle.defenderFaction]) || battle.defenderFaction;
    this.add.text(w / 2, 20, atkName + ' VS ' + defName, {
      fontSize: '24px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700', stroke: '#3a1a00', strokeThickness: 3
    }).setOrigin(0.5);

    // 初始化战斗引擎
    var BE = window.SG3.BattleEngine;
    BE.init(battle.attackerHeroIds, battle.defenderHeroIds, battle.attackerFaction, battle.defenderFaction);
    this._be = BE;

    // 绘制武将
    this._heroDisplays = { attacker: [], defender: [] };
    this._drawHeroes();

    // 战斗日志
    this._logTexts = [];
    this._logY = h - 140;

    // 操作按钮
    var scene = this;
    this._createButton(w / 2 - 80, h - 45, '撤退', '#ff8866', function() {
      BE.retreat();
      scene._endBattle();
    });

    this._createButton(w / 2 + 80, h - 45, '跳过', '#c4a882', function() {
      scene._doStep();
    });

    // 自动战斗定时器
    this._battleTimer = this.time.addEvent({
      delay: 1200,
      callback: this._doStep,
      callbackScope: this,
      loop: true
    });
  },

  _drawHeroes: function() {
    var BE = this._be;
    var state = BE.state;
    if (!state) return;

    var w = this._w;
    var scene = this;

    // 攻方 - 左侧
    for (var i = 0; i < state.attacker.heroes.length; i++) {
      this._drawHeroCard(state.attacker.heroes[i], 80, 80 + i * 110, 'attacker', i);
    }

    // 守方 - 右侧
    for (var j = 0; j < state.defender.heroes.length; j++) {
      this._drawHeroCard(state.defender.heroes[j], w - 260, 80 + j * 110, 'defender', j);
    }
  },

  _drawHeroCard: function(battleHero, x, y, side, index) {
    var GD = this._gd;
    var heroData = GD.heroes[battleHero.heroId];
    var name = heroData ? heroData.name : battleHero.heroId;
    var faction = heroData ? heroData.faction : 'none';
    var color = (window.SG3.FACTION_CSS && window.SG3.FACTION_CSS[faction]) || '#888';
    var isPlayer = (side === 'attacker' && faction === GD.playerFaction) ||
                   (side === 'defender' && faction === GD.playerFaction);

    // 卡片背景
    var cardBg = this.add.graphics();
    cardBg.fillStyle(0x000000, 0.4);
    cardBg.fillRoundedRect(x, y, 220, 100, 4);
    cardBg.lineStyle(1, Phaser.Display.Color.HexStringToColor(color).color, 1);
    cardBg.strokeRoundedRect(x, y, 220, 100, 4);

    // 名称
    var nameText = this.add.text(x + 10, y + 5, name, {
      fontSize: '14px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: color, fontStyle: 'bold'
    });

    // HP条
    var hpBg = this.add.graphics();
    hpBg.fillStyle(0x333333, 1);
    hpBg.fillRect(x + 10, y + 28, 140, 8);
    var hpFill = this.add.graphics();
    hpFill.fillStyle(0x44aa44, 1);
    var hpPct = battleHero.hp / battleHero.maxHp;
    hpFill.fillRect(x + 10, y + 28, 140 * hpPct, 8);
    var hpText = this.add.text(x + 160, y + 25, 'HP ' + battleHero.hp + '/' + battleHero.maxHp, {
      fontSize: '10px', color: '#88cc44', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    });

    // SP条
    var spBg = this.add.graphics();
    spBg.fillStyle(0x333333, 1);
    spBg.fillRect(x + 10, y + 42, 140, 8);
    var spFill = this.add.graphics();
    spFill.fillStyle(0x4488cc, 1);
    var spPct = battleHero.sp / battleHero.maxSp;
    spFill.fillRect(x + 10, y + 42, 140 * spPct, 8);
    var spText = this.add.text(x + 160, y + 39, 'SP ' + battleHero.sp + '/' + battleHero.maxSp, {
      fontSize: '10px', color: '#66aaff', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    });

    // 兵力 + 士气
    var troopsText = this.add.text(x + 10, y + 58, '兵 ' + battleHero.troops, {
      fontSize: '11px', color: '#e8d4b0', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    });
    var moraleText = this.add.text(x + 80, y + 58, '士气 ' + battleHero.morale, {
      fontSize: '11px', color: '#c4a882', fontFamily: '"Microsoft YaHei", "SimHei", serif'
    });

    // 技能按钮（仅玩家武将）
    var skillBtns = [];
    var self = this;
    if (isPlayer && battleHero.skills.length > 0) {
      for (var si = 0; si < battleHero.skills.length && si < 3; si++) {
        (function(skillId, heroIdx, sideStr) {
          var skillData = window.SG3.SKILLS_DATA[skillId];
          if (!skillData) return;
          var btnX = x + 10 + si * 68;
          var btnY = y + 76;
          var btn = self.add.text(btnX, btnY, skillData.name, {
            fontSize: '10px', color: '#ffd700', backgroundColor: battleHero.sp >= skillData.spCost ? 'rgba(100,50,0,0.6)' : 'rgba(50,50,50,0.6)',
            padding: { x: 4, y: 2 }, fontFamily: '"Microsoft YaHei", "SimHei", serif'
          }).setInteractive({ useHandCursor: true });
          btn.on('pointerdown', function() {
            if (battleHero.sp < skillData.spCost) { self._addLog('技力不足'); return; }
            var result = self._be.useSkill(heroIdx, skillId, sideStr);
            if (result) {
              self._addLog(name + ' 使用了 ' + skillData.name);
              self._updateHeroDisplays();
            }
          });
          skillBtns.push({ btn: btn, spCost: skillData.spCost });
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
      hpBarX: x + 10, hpBarY: y + 28,
      spBarX: x + 10, spBarY: y + 42
    });
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
          this._addLog(evt.attackerName + ' 攻击 ' + evt.defenderName + ' 伤兵' + evt.troopDamage + ' HP' + evt.hpDamage);
        } else if (evt.type === 'advisorSkill') {
          this._addLog(evt.sourceName + ' 施展军师技「' + evt.skillName + '」');
        } else if (evt.type === 'battleEnd') {
          this._addLog(evt.winner === 'attacker' ? '攻方获胜！' : '守方获胜！');
        }
      }
    }

    this._updateHeroDisplays();

    if (BE.isOver()) {
      this._battleTimer.remove();
      var scene = this;
      this.time.addEvent({
        delay: 2000,
        callback: function() { scene._endBattle(); }
      });
    }
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
        d.hpFill.fillStyle(hpPct > 0.3 ? 0x44aa44 : 0xcc4444, 1);
        d.hpFill.fillRect(d.hpBarX, d.hpBarY, 140 * hpPct, 8);

        d.spFill.clear();
        d.spFill.fillStyle(0x4488cc, 1);
        d.spFill.fillRect(d.spBarX, d.spBarY, 140 * spPct, 8);

        d.hpText.setText('HP ' + hero.hp + '/' + hero.maxHp);
        d.spText.setText('SP ' + hero.sp + '/' + hero.maxSp);
        d.troopsText.setText('兵 ' + hero.troops);
        d.moraleText.setText('士气 ' + hero.morale);

        // 更新技能按钮状态
        for (var k = 0; k < d.skillBtns.length; k++) {
          var sb = d.skillBtns[k];
          sb.btn.setBackgroundColor(hero.sp >= sb.spCost ? 'rgba(100,50,0,0.6)' : 'rgba(50,50,50,0.6)');
        }

        // 阵亡灰化
        if (hero.hp <= 0 && hero.troops <= 0) {
          d.nameText.setColor('#666666');
          d.cardBg.clear();
          d.cardBg.fillStyle(0x000000, 0.2);
          d.cardBg.fillRoundedRect(0, 0, 220, 100, 4);
        }
      }
    }
  },

  _endBattle: function() {
    if (this._battleTimer) this._battleTimer.remove();
    var BE = this._be;
    if (BE && !BE.isOver()) {
      // 强制结束
      BE.state.phase = 'ended';
      BE.state.winner = BE.state.attacker.heroes.some(function(h) { return h.hp > 0 || h.troops > 0; }) ? 'attacker' : 'defender';
    }

    // 应用战斗结果
    if (BE) BE.applyResult();

    // 返回战略地图
    this.game.scene.stop('BattleScene');
    this.game.scene.start('MapScene');
  },

  _addLog: function(msg) {
    var logText = this.add.text(20, this._logY, msg, {
      fontSize: '11px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#c4a882', wordWrap: { width: this._w - 40 }
    });
    this._logTexts.push(logText);
    this._logY += 16;

    // 最多显示8行
    if (this._logTexts.length > 8) {
      var old = this._logTexts.shift();
      old.destroy();
      // 上移剩余行
      for (var i = 0; i < this._logTexts.length; i++) {
        this._logTexts[i].y -= 16;
      }
    }
  },

  _createButton: function(x, y, label, color, callback) {
    var text = this.add.text(x, y, label, {
      fontSize: '14px', fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: color, backgroundColor: 'rgba(0,0,0,0.5)',
      padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    text.on('pointerdown', callback);
    return text;
  }
});
