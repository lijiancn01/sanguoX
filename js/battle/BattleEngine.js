// 三国群英传 - 战斗逻辑引擎
window.SG = window.SG || {};

(function() {
  'use strict';

  // 兵种相克关系：infantry > archer > cavalry > infantry
  var TROOP_ADVANTAGE = {
    infantry: 'archer',
    archer: 'cavalry',
    cavalry: 'infantry'
  };

  // 获取兵种相克倍率
  function getTypeMultiplier(attackerType, defenderType) {
    if (TROOP_ADVANTAGE[attackerType] === defenderType) return 1.3;
    return 1.0;
  }

  // 随机范围
  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  var Engine = {

    state: null, // 当前战斗状态

    // 初始化战斗
    // attackerHeroes: 攻方武将ID数组
    // defenderHeroes: 守方武将ID数组
    // attackerFaction: 攻方势力
    // defenderFaction: 守方势力
    init: function(attackerHeroes, defenderHeroes, attackerFaction, defenderFaction) {
      var GS = window.SG.GameState;
      this.state = {
        attacker: {
          faction: attackerFaction,
          heroes: []
        },
        defender: {
          faction: defenderFaction,
          heroes: []
        },
        turn: 0,
        phase: 'prepare', // prepare, fighting, duel, ended
        log: [],
        attackerAdvSkills: [],
        defenderAdvSkills: [],
        winner: null,
        duelState: null,
        destinyTriggered: false  // 天命之子是否已触发（每场战斗仅一次）
      };

      // 构建攻方武将战斗数据
      for (var i = 0; i < attackerHeroes.length && i < 5; i++) {
        var heroId = attackerHeroes[i];
        var hero = GS.heroes[heroId];
        if (!hero) continue;
        this.state.attacker.heroes.push({
          heroId: heroId,
          troops: hero.troops,
          troopType: hero.troopType,
          hp: 100 + hero.level * 10,
          maxHp: 100 + hero.level * 10,
          sp: hero.sp,
          maxSp: hero.maxSp,
          morale: 100,
          maxTroops: hero.maxTroops,
          skills: hero.skills ? hero.skills.slice() : [],
          advisorSkill: hero.advisorSkill || null
        });
      }

      // 构建守方武将战斗数据
      for (var j = 0; j < defenderHeroes.length && j < 5; j++) {
        var dHeroId = defenderHeroes[j];
        var dHero = GS.heroes[dHeroId];
        if (!dHero) continue;
        this.state.defender.heroes.push({
          heroId: dHeroId,
          troops: dHero.troops,
          troopType: dHero.troopType,
          hp: 100 + dHero.level * 10,
          maxHp: 100 + dHero.level * 10,
          sp: dHero.sp,
          maxSp: dHero.maxSp,
          morale: 100,
          maxTroops: dHero.maxTroops,
          skills: dHero.skills ? dHero.skills.slice() : [],
          advisorSkill: dHero.advisorSkill || null
        });
      }

      return this.state;
    },

    // 执行一个战斗tick
    step: function() {
      if (!this.state || this.state.phase === 'ended') return [];

      var events = [];

      if (this.state.phase === 'prepare') {
        // 战前阶段：应用军师技
        events = events.concat(this._applyAdvisorSkills());
        this.state.phase = 'fighting';
        this._addLog('战斗开始！');
      }

      if (this.state.phase === 'fighting') {
        this.state.turn++;
        events = events.concat(this._fightStep());
      }

      if (this.state.phase === 'duel' && this.state.duelState) {
        events = events.concat(this.duelStep());
      }

      // 检查胜负
      if (this._checkWinCondition()) {
        this.state.phase = 'ended';
        events.push({ type: 'battleEnd', winner: this.state.winner });
      }

      return events;
    },

    // 战斗tick核心逻辑
    _fightStep: function() {
      var events = [];
      var atkHeroes = this.state.attacker.heroes;
      var defHeroes = this.state.defender.heroes;
      var maxPairs = Math.max(atkHeroes.length, defHeroes.length);

      for (var i = 0; i < maxPairs; i++) {
        var atkHero = i < atkHeroes.length ? atkHeroes[i] : null;
        var defHero = i < defHeroes.length ? defHeroes[i] : null;

        // 攻方武将攻击（有兵或HP>0即可战斗）
        if (atkHero && (atkHero.hp > 0 || atkHero.troops > 0)) {
          var target = this._findTarget(defHeroes, i);
          if (target) {
            var atkEvent = this._heroAttack(atkHero, target, 'attacker');
            events.push(atkEvent);
          }
        }

        // 守方武将攻击
        if (defHero && (defHero.hp > 0 || defHero.troops > 0)) {
          var atkTarget = this._findTarget(atkHeroes, i);
          if (atkTarget) {
            var defEvent = this._heroAttack(defHero, atkTarget, 'defender');
            events.push(defEvent);
          }
        }
      }

      // 士气衰减：每回合双方士气微降
      this._decayMorale(atkHeroes);
      this._decayMorale(defHeroes);

      return events;
    },

    // 查找目标：优先对位，否则找最近存活武将
    _findTarget: function(heroes, preferIdx) {
      // 优先对位
      if (preferIdx < heroes.length) {
        var pref = heroes[preferIdx];
        if (pref.hp > 0 || pref.troops > 0) return pref;
      }
      // 找第一个存活的
      for (var i = 0; i < heroes.length; i++) {
        if (heroes[i].hp > 0 || heroes[i].troops > 0) return heroes[i];
      }
      return null;
    },

    // 武将攻击逻辑
    _heroAttack: function(attacker, defender, side) {
      var GS = window.SG.GameState;
      var atkData = GS.heroes[attacker.heroId];
      var defData = GS.heroes[defender.heroId];
      var atkName = atkData ? atkData.name : attacker.heroId;
      var defName = defData ? defData.name : defender.heroId;

      var event = { type: 'attack', attacker: attacker.heroId, attackerName: atkName, defender: defender.heroId, defenderName: defName, side: side, troopDamage: 0, hpDamage: 0 };

      // 士兵交战
      if (attacker.troops > 0 && (defender.troops > 0 || defender.hp > 0)) {
        var typeMultiplier = getTypeMultiplier(attacker.troopType, defender.troopType);
        var moraleFactor = attacker.morale / 100;
        var baseDmg = attacker.troops * 0.01 * randRange(0.8, 1.2) * typeMultiplier * moraleFactor;
        var dmg = Math.floor(baseDmg);

        if (defender.troops > 0) {
          var troopLoss = Math.min(defender.troops, dmg);
          defender.troops -= troopLoss;
          dmg -= troopLoss;
          event.troopDamage = troopLoss;
        }
        if (dmg > 0 && defender.hp > 0) {
          var hpLoss = Math.min(defender.hp, dmg);
          defender.hp -= hpLoss;
          event.hpDamage = hpLoss;
        }
      }

      // 武将自动攻击（无兵时直接打HP）
      if (attacker.troops <= 0 && attacker.hp > 0 && defender.hp > 0) {
        var force = atkData ? atkData.force : 50;
        var heroDmg = Math.floor(force * 0.5 * randRange(0.8, 1.2));
        var actualDmg = Math.min(defender.hp, heroDmg);
        defender.hp -= actualDmg;
        event.hpDamage += actualDmg;
      }

      // 天命之子：自定义君主HP降到10%以下时锁血并触发天降陨石
      var destinyEvent = this._checkDestiny(defender, defData, defName, side);
      if (destinyEvent) {
        event.destiny = destinyEvent;
      }

      this._addLog(atkName + ' 攻击 ' + defName + '，兵力损失' + event.troopDamage + '，HP损失' + event.hpDamage);

      return event;
    },

    // 士气衰减
    _decayMorale: function(heroes) {
      for (var i = 0; i < heroes.length; i++) {
        if (heroes[i].hp > 0 || heroes[i].troops > 0) {
          heroes[i].morale = Math.max(10, heroes[i].morale - 1);
        }
      }
    },

    // 玩家使用技能
    useSkill: function(heroIndex, skillId, side) {
      if (!this.state || this.state.phase === 'ended') return null;

      var heroes = side === 'attacker' ? this.state.attacker.heroes : this.state.defender.heroes;
      var hero = heroes[heroIndex];
      if (!hero || (hero.hp <= 0 && hero.troops <= 0)) return null;

      var skillData = window.SG.SKILLS_DATA[skillId];
      if (!skillData) return null;
      if (hero.sp < skillData.spCost) return null;

      // 消耗SP
      hero.sp -= skillData.spCost;

      // 确定目标
      var targets;
      var opposeHeroes = side === 'attacker' ? this.state.defender.heroes : this.state.attacker.heroes;
      var allies = heroes;

      if (skillData.range === 'single') {
        // 单体：选择对位或第一个存活敌人
        var target = this._findTarget(opposeHeroes, heroIndex);
        targets = target ? [target] : [];
      } else if (skillData.range === 'area') {
        // 群体：所有存活敌人
        targets = [];
        for (var i = 0; i < opposeHeroes.length; i++) {
          if (opposeHeroes[i].hp > 0 || opposeHeroes[i].troops > 0) {
            targets.push(opposeHeroes[i]);
          }
        }
      } else {
        // self：己方全体
        targets = [];
        for (var j = 0; j < allies.length; j++) {
          if (allies[j].hp > 0) {
            targets.push(allies[j]);
          }
        }
      }

      var result = window.SG.SkillSystem.execute(skillId, hero, targets, side);
      if (result) {
        var heroData = window.SG.GameState.heroes[hero.heroId];
        var name = heroData ? heroData.name : hero.heroId;
        this._addLog(name + ' 使用了 ' + skillData.name + '！');
        result.side = side;
        result.sourceIndex = heroIndex;
      }

      return result;
    },

    // 检查单挑是否可行
    checkDuel: function(attackerIdx, defenderIdx) {
      if (!this.state) return false;
      var atkHero = this.state.attacker.heroes[attackerIdx];
      var defHero = this.state.defender.heroes[defenderIdx];
      if (!atkHero || !defHero) return false;
      if (atkHero.hp <= 0 || defHero.hp <= 0) return false;
      if (this.state.phase === 'duel' || this.state.phase === 'ended') return false;
      return true;
    },

    // 发起单挑
    startDuel: function(attackerIdx, defenderIdx) {
      if (!this.checkDuel(attackerIdx, defenderIdx)) return null;

      var GS = window.SG.GameState;
      var atkHero = this.state.attacker.heroes[attackerIdx];
      var defHero = this.state.defender.heroes[defenderIdx];
      var atkData = GS.heroes[atkHero.heroId];
      var defData = GS.heroes[defHero.heroId];

      this.state.phase = 'duel';
      this.state.duelState = {
        attackerIdx: attackerIdx,
        defenderIdx: defenderIdx,
        attacker: atkHero,
        defender: defHero,
        turn: 0,
        mode: 'classic'  // 标记使用新单挑系统
      };

      var atkName = atkData ? atkData.name : atkHero.heroId;
      var defName = defData ? defData.name : defHero.heroId;
      this._addLog(atkName + ' 向 ' + defName + ' 发起单挑！');

      // 初始化DuelSystem
      var playerFaction = GS.playerFaction;
      var attackerIsPlayer = this.state.attacker.faction === playerFaction;
      window.SG.DuelSystem.init(atkHero.heroId, defHero.heroId, attackerIsPlayer);

      return this.state.duelState;
    },

    // 单挑tick（兼容旧调用）
    duelStep: function() {
      if (!this.state || !this.state.duelState) return [];
      // 旧版简单单挑逻辑（保留作为兜底）
      var events = [];
      var duel = this.state.duelState;
      duel.turn++;

      var GS = window.SG.GameState;
      var atkData = GS.heroes[duel.attacker.heroId];
      var defData = GS.heroes[duel.defender.heroId];
      var atkName = atkData ? atkData.name : duel.attacker.heroId;
      var defName = defData ? defData.name : duel.defender.heroId;

      // 攻方攻击
      var atkForce = atkData ? atkData.force : 50;
      var atkDmg = Math.floor(atkForce * 0.8 * (0.8 + Math.random() * 0.4));
      duel.defender.hp = Math.max(0, duel.defender.hp - atkDmg);
      events.push({ type: 'duelAttack', attacker: duel.attacker.heroId, attackerName: atkName, defender: duel.defender.heroId, defenderName: defName, damage: atkDmg });
      this._addLog(atkName + ' 单挑攻击 ' + defName + '，造成 ' + atkDmg + ' 点伤害');

      // 守方反击（如果还活着）
      if (duel.defender.hp > 0) {
        var defForce = defData ? defData.force : 50;
        var defDmg = Math.floor(defForce * 0.8 * (0.8 + Math.random() * 0.4));
        duel.attacker.hp = Math.max(0, duel.attacker.hp - defDmg);
        events.push({ type: 'duelAttack', attacker: duel.defender.heroId, attackerName: defName, defender: duel.attacker.heroId, defenderName: atkName, damage: defDmg });
        this._addLog(defName + ' 反击 ' + atkName + '，造成 ' + defDmg + ' 点伤害');
      }

      // 检查单挑结束
      if (duel.attacker.hp <= 0 || duel.defender.hp <= 0) {
        var winner = duel.attacker.hp > 0 ? atkName : defName;
        this._addLog('单挑结束！' + winner + ' 获胜！');
        events.push({ type: 'duelEnd', winner: duel.attacker.hp > 0 ? 'attacker' : 'defender' });
        this.state.duelState = null;
        this.state.phase = 'fighting';
      }

      return events;
    },

    // 应用单挑结果到战斗状态
    applyDuelResult: function(duelResult) {
      if (!duelResult || !this.state || !this.state.duelState) return;

      var duel = this.state.duelState;
      var winnerSide = duelResult.winner;
      var loserSide = duelResult.loser;

      // 更新战斗状态中的武将HP
      if (duel.attacker) {
        duel.attacker.hp = duelResult.attacker.hp;
      }
      if (duel.defender) {
        duel.defender.hp = duelResult.defender.hp;
      }

      // 单挑败方：HP归零（视为退出战斗）
      if (loserSide === 'attacker' && duel.attacker) {
        duel.attacker.hp = 0;
      }
      if (loserSide === 'defender' && duel.defender) {
        duel.defender.hp = 0;
      }

      // 清理单挑状态
      this.state.duelState = null;
      this.state.phase = 'fighting';

      // 添加战斗日志
      var winnerName = winnerSide === 'attacker' ?
        (window.SG.GameState.heroes[duel.attacker.heroId] || {}).name :
        (window.SG.GameState.heroes[duel.defender.heroId] || {}).name;
      var loserName = loserSide === 'attacker' ?
        (window.SG.GameState.heroes[duel.attacker.heroId] || {}).name :
        (window.SG.GameState.heroes[duel.defender.heroId] || {}).name;
      this._addLog(winnerName + ' 在单挑中击败了 ' + loserName + '！');
    },

    // 检查战斗是否结束
    isOver: function() {
      return !this.state || this.state.phase === 'ended';
    },

    // 获取战斗结果
    getResult: function() {
      if (!this.state || this.state.phase !== 'ended') return null;

      var result = {
        winner: this.state.winner,
        attackerCasualties: [],
        defenderCasualties: []
      };

      // 统计攻方伤亡
      for (var i = 0; i < this.state.attacker.heroes.length; i++) {
        var ah = this.state.attacker.heroes[i];
        result.attackerCasualties.push({
          heroId: ah.heroId,
          hp: ah.hp,
          troops: ah.troops,
          captured: ah.hp <= 0
        });
      }

      // 统计守方伤亡
      for (var j = 0; j < this.state.defender.heroes.length; j++) {
        var dh = this.state.defender.heroes[j];
        result.defenderCasualties.push({
          heroId: dh.heroId,
          hp: dh.hp,
          troops: dh.troops,
          captured: dh.hp <= 0
        });
      }

      return result;
    },

    // 撤退（攻方撤退，守方获胜）
    retreat: function() {
      if (!this.state || this.state.phase === 'ended') return;
      this.state.winner = 'defender';
      this.state.phase = 'ended';
      this._addLog('攻方撤退！守方获胜！');
    },

    // 应用战斗结果到GameState
    applyResult: function() {
      if (!this.state) return;

      var GS = window.SG.GameState;
      var result = this.getResult();
      if (!result) return;

      var winnerFaction = result.winner === 'attacker' ? this.state.attacker.faction : this.state.defender.faction;

      // 更新攻方武将状态
      for (var i = 0; i < result.attackerCasualties.length; i++) {
        var ac = result.attackerCasualties[i];
        var aHero = GS.heroes[ac.heroId];
        if (!aHero) continue;
        aHero.hp = ac.hp;
        aHero.troops = ac.troops;
        if (ac.captured) {
          // 被俘武将换势力
          aHero.faction = winnerFaction;
          aHero.loyalty = Math.floor(aHero.loyalty * 0.3);
        }
      }

      // 更新守方武将状态
      for (var j = 0; j < result.defenderCasualties.length; j++) {
        var dc = result.defenderCasualties[j];
        var dHero = GS.heroes[dc.heroId];
        if (!dHero) continue;
        dHero.hp = dc.hp;
        dHero.troops = dc.troops;
        if (dc.captured) {
          dHero.faction = winnerFaction;
          dHero.loyalty = Math.floor(dHero.loyalty * 0.3);
        }
      }

      // 如果攻方获胜，攻占目标城市
      if (result.winner === 'attacker' && GS.battle && GS.battle.targetCity) {
        var cityId = GS.battle.targetCity;
        var city = GS.cities[cityId];
        if (city) {
          var oldFaction = city.faction;
          city.faction = this.state.attacker.faction;

          // 移除旧势力武将，加入新势力武将
          var newHeroIds = [];
          for (var k = 0; k < this.state.attacker.heroes.length; k++) {
            var aliveHero = this.state.attacker.heroes[k];
            if (aliveHero.hp > 0) {
              newHeroIds.push(aliveHero.heroId);
              var gsHero = GS.heroes[aliveHero.heroId];
              if (gsHero) {
                gsHero.location = cityId;
                gsHero.status = 'idle';
              }
            }
          }

          // 被俘守方武将也加入城市
          for (var m = 0; m < this.state.defender.heroes.length; m++) {
            var defHero2 = this.state.defender.heroes[m];
            if (defHero2.hp <= 0) {
              // 被俘，已换势力
              var gsDefHero = GS.heroes[defHero2.heroId];
              if (gsDefHero) {
                gsDefHero.location = cityId;
                gsDefHero.status = 'idle';
                gsDefHero.hp = 10; // 被俘后少量HP
                newHeroIds.push(defHero2.heroId);
              }
            } else {
              // 存活守方武将，如果同势力则保留
              var gsDefHero2 = GS.heroes[defHero2.heroId];
              if (gsDefHero2 && gsDefHero2.faction === this.state.attacker.faction) {
                gsDefHero2.location = cityId;
                gsDefHero2.status = 'idle';
                newHeroIds.push(defHero2.heroId);
              }
            }
          }

          city.heroes = newHeroIds;
          city.troops = GS._getCityTotalTroops(cityId);
        }
      } else if (result.winner === 'defender') {
        // 守方获胜，攻方武将返回出发城市
        if (GS.battle && GS.battle.fromCity) {
          var fromCityId = GS.battle.fromCity;
          var fromCity = GS.cities[fromCityId];
          if (fromCity) {
            for (var n = 0; n < this.state.attacker.heroes.length; n++) {
              var retHero = this.state.attacker.heroes[n];
              if (retHero.hp > 0) {
                var gsRetHero = GS.heroes[retHero.heroId];
                if (gsRetHero) {
                  gsRetHero.location = fromCityId;
                  gsRetHero.status = 'idle';
                  if (fromCity.heroes.indexOf(retHero.heroId) === -1) {
                    fromCity.heroes.push(retHero.heroId);
                  }
                }
              }
            }
          }
        }
      }

      // 被俘攻方武将处理
      for (var p = 0; p < result.attackerCasualties.length; p++) {
        var capturedAttacker = result.attackerCasualties[p];
        if (capturedAttacker.captured) {
          var capHero = GS.heroes[capturedAttacker.heroId];
          if (capHero && GS.battle && GS.battle.targetCity) {
            capHero.location = GS.battle.targetCity;
            capHero.status = 'idle';
            capHero.hp = 10;
          }
        }
      }

      // 清除战斗状态
      GS.battle = null;
      GS.phase = 'strategic';
    },

    // 应用军师技
    _applyAdvisorSkills: function() {
      var events = [];
      var atkHeroes = this.state.attacker.heroes;
      var defHeroes = this.state.defender.heroes;

      // 攻方军师技
      for (var i = 0; i < atkHeroes.length; i++) {
        var hero = atkHeroes[i];
        if (hero.advisorSkill) {
          var skillData = window.SG.SKILLS_DATA[hero.advisorSkill];
          if (skillData && skillData.type === 'advisor') {
            var GS = window.SG.GameState;
            var heroData = GS.heroes[hero.heroId];
            var name = heroData ? heroData.name : hero.heroId;
            if (hero.advisorSkill === 'jimou') {
              // 计谋：提升全军士气10
              for (var j = 0; j < atkHeroes.length; j++) {
                atkHeroes[j].morale = Math.min(200, atkHeroes[j].morale + 10);
              }
              this._addLog(name + ' 施展军师技「计谋」，全军士气提升！');
            } else if (hero.advisorSkill === 'guwu') {
              // 鼓舞：提升全军攻击力15%（以士气方式体现）
              for (var k = 0; k < atkHeroes.length; k++) {
                atkHeroes[k].morale = Math.min(200, atkHeroes[k].morale + 15);
              }
              this._addLog(name + ' 施展军师技「鼓舞」，全军士气大振！');
            } else if (hero.advisorSkill === 'yaohuo') {
              // 妖惑：降低敌军士气10
              for (var l = 0; l < defHeroes.length; l++) {
                defHeroes[l].morale = Math.max(10, defHeroes[l].morale - 10);
              }
              this._addLog(name + ' 施展军师技「妖惑」，敌军士气下降！');
            }
            this.state.attackerAdvSkills.push(hero.advisorSkill);
            events.push({ type: 'advisorSkill', skillId: hero.advisorSkill, skillName: skillData.name, side: 'attacker', sourceName: name });
          }
        }
      }

      // 守方军师技
      for (var m = 0; m < defHeroes.length; m++) {
        var dHero = defHeroes[m];
        if (dHero.advisorSkill) {
          var dSkillData = window.SG.SKILLS_DATA[dHero.advisorSkill];
          if (dSkillData && dSkillData.type === 'advisor') {
            var GS2 = window.SG.GameState;
            var dHeroData = GS2.heroes[dHero.heroId];
            var dName = dHeroData ? dHeroData.name : dHero.heroId;
            if (dHero.advisorSkill === 'jimou') {
              for (var n = 0; n < defHeroes.length; n++) {
                defHeroes[n].morale = Math.min(200, defHeroes[n].morale + 10);
              }
              this._addLog(dName + ' 施展军师技「计谋」，全军士气提升！');
            } else if (dHero.advisorSkill === 'guwu') {
              for (var o = 0; o < defHeroes.length; o++) {
                defHeroes[o].morale = Math.min(200, defHeroes[o].morale + 15);
              }
              this._addLog(dName + ' 施展军师技「鼓舞」，全军士气大振！');
            } else if (dHero.advisorSkill === 'yaohuo') {
              for (var q = 0; q < atkHeroes.length; q++) {
                atkHeroes[q].morale = Math.max(10, atkHeroes[q].morale - 10);
              }
              this._addLog(dName + ' 施展军师技「妖惑」，敌军士气下降！');
            }
            this.state.defenderAdvSkills.push(dHero.advisorSkill);
            events.push({ type: 'advisorSkill', skillId: dHero.advisorSkill, skillName: dSkillData.name, side: 'defender', sourceName: dName });
          }
        }
      }

      return events;
    },

    // 检查胜负条件
    _checkWinCondition: function() {
      var atkAllDead = true;
      var defAllDead = true;

      for (var i = 0; i < this.state.attacker.heroes.length; i++) {
        var h = this.state.attacker.heroes[i];
        if (h.hp > 0 || h.troops > 0) {
          atkAllDead = false;
          break;
        }
      }

      for (var j = 0; j < this.state.defender.heroes.length; j++) {
        var h2 = this.state.defender.heroes[j];
        if (h2.hp > 0 || h2.troops > 0) {
          defAllDead = false;
          break;
        }
      }

      if (atkAllDead) {
        this.state.winner = 'defender';
        return true;
      }
      if (defAllDead) {
        this.state.winner = 'attacker';
        return true;
      }
      return false;
    },

    // 天命之子：自定义君主HP<=10%时锁血+天降陨石
    _checkDestiny: function(hero, heroData, heroName, side) {
      if (this.state.destinyTriggered) return null;
      if (!heroData || !heroData.isMonarch || !heroData.isCustom) return null;
      if (hero.hp <= 0 || hero.maxHp <= 0) return null;

      var threshold = Math.floor(hero.maxHp * 0.1);
      if (hero.hp > threshold) return null;

      // 锁血到10%
      hero.hp = threshold;

      // 天降陨石：对敌方全体造成毁灭性伤害
      var opposeHeroes = side === 'attacker' ? this.state.defender.heroes : this.state.attacker.heroes;
      var meteorDamage = Math.floor(hero.maxHp * 0.8);
      var targets = [];

      for (var i = 0; i < opposeHeroes.length; i++) {
        var enemy = opposeHeroes[i];
        if (enemy.hp <= 0 && enemy.troops <= 0) continue;

        var totalDamage = meteorDamage;
        if (enemy.troops > 0) {
          var troopLoss = Math.min(enemy.troops, totalDamage);
          enemy.troops -= troopLoss;
          totalDamage -= troopLoss;
        }
        if (totalDamage > 0 && enemy.hp > 0) {
          enemy.hp = Math.max(0, enemy.hp - totalDamage);
        }
        targets.push({ heroId: enemy.heroId, name: (window.SG.GameState.heroes[enemy.heroId] || {}).name || enemy.heroId });
      }

      // 全军士气暴涨
      var allyHeroes = side === 'attacker' ? this.state.attacker.heroes : this.state.defender.heroes;
      for (var j = 0; j < allyHeroes.length; j++) {
        allyHeroes[j].morale = Math.min(200, allyHeroes[j].morale + 50);
      }

      this.state.destinyTriggered = true;
      this._addLog('★ 天命之子！' + heroName + ' 气血将尽之际，天降陨石！敌方全军覆灭！');

      return {
        type: 'destiny',
        heroName: heroName,
        heroId: heroData.id,
        side: side,
        damage: meteorDamage,
        targets: targets
      };
    },

    // 添加战斗日志
    _addLog: function(msg) {
      if (!this.state) return;
      this.state.log.push({ turn: this.state.turn, msg: msg });
      // 只保留最近50条
      if (this.state.log.length > 50) {
        this.state.log.shift();
      }
    }
  };

  window.SG.BattleEngine = Engine;

})();
