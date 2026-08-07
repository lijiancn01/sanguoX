/**
 * 三国群英传 - 战斗逻辑引擎
 * @author jian.li
 */
window.SG3 = window.SG3 || {};

(function() {
  'use strict';

  var TROOP_ADVANTAGE = { infantry: 'archer', archer: 'cavalry', cavalry: 'infantry' };

  function getTypeMultiplier(attackerType, defenderType) {
    return TROOP_ADVANTAGE[attackerType] === defenderType ? 1.3 : 1.0;
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  var Engine = {
    state: null,

    init: function(attackerHeroes, defenderHeroes, attackerFaction, defenderFaction) {
      var GD = window.SG3.GameData;
      this.state = {
        attacker: { faction: attackerFaction, heroes: [] },
        defender: { faction: defenderFaction, heroes: [] },
        turn: 0, phase: 'prepare', log: [],
        winner: null, duelState: null, destinyTriggered: { attacker: false, defender: false }
      };

      for (var i = 0; i < attackerHeroes.length && i < 5; i++) {
        var heroId = attackerHeroes[i];
        var hero = GD.heroes[heroId];
        if (!hero) continue;
        this.state.attacker.heroes.push({
          heroId: heroId, troops: hero.troops, troopType: hero.troopType,
          hp: 100 + hero.level * 10, maxHp: 100 + hero.level * 10,
          sp: hero.sp, maxSp: hero.maxSp, morale: 100, maxTroops: hero.maxTroops,
          skills: hero.skills ? hero.skills.slice() : [],
          advisorSkill: hero.advisorSkill || null
        });
      }

      for (var j = 0; j < defenderHeroes.length && j < 5; j++) {
        var dHeroId = defenderHeroes[j];
        var dHero = GD.heroes[dHeroId];
        if (!dHero) continue;
        this.state.defender.heroes.push({
          heroId: dHeroId, troops: dHero.troops, troopType: dHero.troopType,
          hp: 100 + dHero.level * 10, maxHp: 100 + dHero.level * 10,
          sp: dHero.sp, maxSp: dHero.maxSp, morale: 100, maxTroops: dHero.maxTroops,
          skills: dHero.skills ? dHero.skills.slice() : [],
          advisorSkill: dHero.advisorSkill || null
        });
      }

      return this.state;
    },

    step: function() {
      if (!this.state || this.state.phase === 'ended') return [];
      var events = [];
      if (this.state.phase === 'prepare') {
        events = events.concat(this._applyAdvisorSkills());
        this.state.phase = 'fighting';
        this._addLog('战斗开始！');
      }
      if (this.state.phase === 'fighting') {
        this.state.turn++;
        events = events.concat(this._fightStep());
      }
      if (this._checkWinCondition()) {
        this.state.phase = 'ended';
        events.push({ type: 'battleEnd', winner: this.state.winner });
      } else if (this.state.turn >= 200) {
        // 超时兜底：按剩余战力判定胜负，防止战斗无限循环
        this._forceEndByTimeout();
        events.push({ type: 'battleEnd', winner: this.state.winner });
      }
      return events;
    },

    _fightStep: function() {
      var events = [];
      var atkHeroes = this.state.attacker.heroes;
      var defHeroes = this.state.defender.heroes;
      var maxPairs = Math.max(atkHeroes.length, defHeroes.length);

      for (var i = 0; i < maxPairs; i++) {
        var atkHero = i < atkHeroes.length ? atkHeroes[i] : null;
        var defHero = i < defHeroes.length ? defHeroes[i] : null;
        if (atkHero && (atkHero.hp > 0 || atkHero.troops > 0)) {
          var target = this._findTarget(defHeroes, i);
          if (target) events.push(this._heroAttack(atkHero, target, 'attacker'));
        }
        if (defHero && (defHero.hp > 0 || defHero.troops > 0)) {
          var atkTarget = this._findTarget(atkHeroes, i);
          if (atkTarget) events.push(this._heroAttack(defHero, atkTarget, 'defender'));
        }
      }
      this._decayMorale(atkHeroes);
      this._decayMorale(defHeroes);
      return events;
    },

    _findTarget: function(heroes, preferIdx) {
      if (preferIdx < heroes.length) {
        var pref = heroes[preferIdx];
        if (pref.hp > 0 || pref.troops > 0) return pref;
      }
      for (var i = 0; i < heroes.length; i++) {
        if (heroes[i].hp > 0 || heroes[i].troops > 0) return heroes[i];
      }
      return null;
    },

    _heroAttack: function(attacker, defender, side) {
      var GD = window.SG3.GameData;
      var atkData = GD.heroes[attacker.heroId];
      var defData = GD.heroes[defender.heroId];
      var atkName = atkData ? atkData.name : attacker.heroId;
      var defName = defData ? defData.name : defender.heroId;
      var defenderSide = (side === 'attacker') ? 'defender' : 'attacker';
      var isPlayerMonarch = defData && defData.isMonarch && this.state[defenderSide].faction === GD.playerFaction;
      var event = { type: 'attack', attacker: attacker.heroId, attackerName: atkName, defender: defender.heroId, defenderName: defName, side: side, troopDamage: 0, hpDamage: 0 };

      if (attacker.troops > 0 && (defender.troops > 0 || defender.hp > 0)) {
        var typeMultiplier = getTypeMultiplier(attacker.troopType, defender.troopType);
        var moraleFactor = attacker.morale / 100;
        var baseDmg = attacker.troops * 0.1 * randRange(0.8, 1.2) * typeMultiplier * moraleFactor;
        var dmg = Math.max(Math.floor(baseDmg), Math.floor(attacker.troops * 0.02));
        if (defender.troops > 0) {
          var troopLoss = Math.min(defender.troops, dmg);
          defender.troops -= troopLoss;
          dmg -= troopLoss;
          event.troopDamage = troopLoss;
        }
        if (dmg > 0 && defender.hp > 0) {
          // 天命锁血：已触发天命觉醒的君主不再扣HP
          if (defender.destinyLocked) {
            event.hpDamage = 0;
          } else {
            var hpLoss = Math.min(defender.hp, dmg);
            // 预判：玩家君主HP保护，不扣到10%阈值以下（AI君主不受保护）
            var threshold = Math.floor(defender.maxHp * 0.1);
            if (isPlayerMonarch && !this.state.destinyTriggered[defenderSide] && (defender.hp - hpLoss) <= threshold) {
              hpLoss = Math.max(0, defender.hp - threshold);
            }
            defender.hp -= hpLoss;
            event.hpDamage = hpLoss;
          }
        }
      }

      if (attacker.troops <= 0 && attacker.hp > 0 && defender.hp > 0) {
        var force = atkData ? atkData.force : 50;
        // 天命全属性提升：攻击者已触发天命，武力伤害×4
        if (attacker.destinyLocked) force = Math.floor(force * 4);
        var heroDmg = Math.floor(force * 0.5 * randRange(0.8, 1.2));
        // 天命锁血：防守者已触发天命，不扣HP
        if (defender.destinyLocked) {
          event.hpDamage += 0;
        } else {
          var actualDmg = Math.min(defender.hp, heroDmg);
          // 预判：玩家君主HP保护，不扣到10%阈值以下
          var threshold2 = Math.floor(defender.maxHp * 0.1);
          if (isPlayerMonarch && !this.state.destinyTriggered[defenderSide] && (defender.hp - actualDmg) <= threshold2) {
            actualDmg = Math.max(0, defender.hp - threshold2);
          }
          defender.hp -= actualDmg;
          event.hpDamage += actualDmg;
        }
      }

      // 天命之子：在防守方HP可能被打到10%以下时触发（包括HP已<=0的情况）
      // defenderSide已在函数开头计算
      var destinyEvent = this._checkDestiny(defender, defData, defName, defenderSide);
      if (destinyEvent) event.destiny = destinyEvent;

      this._addLog(atkName + ' 攻击 ' + defName + '，兵力损失' + event.troopDamage + '，HP损失' + event.hpDamage);
      return event;
    },

    _decayMorale: function(heroes) {
      for (var i = 0; i < heroes.length; i++) {
        if (heroes[i].hp > 0 || heroes[i].troops > 0) {
          heroes[i].morale = Math.max(30, heroes[i].morale - 1);
        }
      }
    },

    useSkill: function(heroIndex, skillId, side) {
      if (!this.state || this.state.phase === 'ended') return null;
      var heroes = side === 'attacker' ? this.state.attacker.heroes : this.state.defender.heroes;
      var hero = heroes[heroIndex];
      if (!hero || (hero.hp <= 0 && hero.troops <= 0)) return null;
      var skillData = window.SG3.SKILLS_DATA[skillId];
      if (!skillData) return null;
      if (hero.sp < skillData.spCost) return null;
      hero.sp -= skillData.spCost;

      var opposeHeroes = side === 'attacker' ? this.state.defender.heroes : this.state.attacker.heroes;
      var targets;
      if (skillData.range === 'single') {
        var target = this._findTarget(opposeHeroes, heroIndex);
        targets = target ? [target] : [];
      } else if (skillData.range === 'area') {
        targets = [];
        for (var i = 0; i < opposeHeroes.length; i++) {
          if (opposeHeroes[i].hp > 0 || opposeHeroes[i].troops > 0) targets.push(opposeHeroes[i]);
        }
      } else {
        targets = [];
        for (var j = 0; j < heroes.length; j++) {
          if (heroes[j].hp > 0) targets.push(heroes[j]);
        }
      }

      var result = this._executeSkill(skillId, hero, targets, side);
      if (result) {
        var heroData = window.SG3.GameData.heroes[hero.heroId];
        var name = heroData ? heroData.name : hero.heroId;
        this._addLog(name + ' 使用了 ' + skillData.name + '！');
        result.side = side;
        result.sourceIndex = heroIndex;
      }
      return result;
    },

    _executeSkill: function(skillId, source, targets, side) {
      var skill = window.SG3.SKILLS_DATA[skillId];
      if (!skill) return null;
      var result = { type: 'skill', skillId: skillId, skillName: skill.name, element: skill.element, targets: [] };
      
      for (var i = 0; i < targets.length; i++) {
        var target = targets[i];
        var targetResult = { heroId: target.heroId, effects: [] };
        
        if (skill.effectType === 'damage') {
          var dmg = Math.floor(skill.power * randRange(0.9, 1.1));
          if (target.troops > 0) {
            var troopLoss = Math.min(target.troops, dmg);
            target.troops -= troopLoss;
            dmg -= troopLoss;
            targetResult.effects.push({ type: 'troopDamage', value: troopLoss });
          }
          if (dmg > 0 && target.hp > 0) {
            var hpLoss = Math.min(target.hp, dmg);
            target.hp -= hpLoss;
            targetResult.effects.push({ type: 'hpDamage', value: hpLoss });
          }
        } else if (skill.effectType === 'heal_troops') {
          var heal = Math.floor(skill.power * randRange(0.8, 1.2));
          target.troops = Math.min(target.maxTroops, target.troops + heal);
          targetResult.effects.push({ type: 'healTroops', value: heal });
        } else if (skill.effectType === 'heal_hp') {
          var hpHeal = Math.floor(skill.power * randRange(0.8, 1.2));
          target.hp = Math.min(target.maxHp, target.hp + hpHeal);
          targetResult.effects.push({ type: 'healHp', value: hpHeal });
        } else if (skill.effectType === 'restore_sp') {
          var spRestore = Math.floor(skill.power * randRange(0.8, 1.2));
          target.sp = Math.min(target.maxSp, target.sp + spRestore);
          targetResult.effects.push({ type: 'restoreSp', value: spRestore });
        } else if (skill.effectType === 'morale_up') {
          target.morale = Math.min(200, target.morale + skill.power);
          targetResult.effects.push({ type: 'moraleUp', value: skill.power });
        } else if (skill.effectType === 'morale_down') {
          target.morale = Math.max(10, target.morale - skill.power);
          targetResult.effects.push({ type: 'moraleDown', value: skill.power });
        } else if (skill.effectType === 'buff_attack' || skill.effectType === 'buff_defense') {
          target.morale = Math.min(200, target.morale + skill.power);
          targetResult.effects.push({ type: skill.effectType, value: skill.power });
        } else if (skill.effectType === 'debuff_attack' || skill.effectType === 'debuff_defense') {
          target.morale = Math.max(10, target.morale - skill.power);
          targetResult.effects.push({ type: skill.effectType, value: skill.power });
        }
        
        result.targets.push(targetResult);
      }

      if (skill.selfDamage && source.hp > 0) {
        source.hp = Math.max(0, source.hp - skill.selfDamage);
        result.selfDamage = skill.selfDamage;
      }

      return result;
    },

    retreat: function() {
      if (!this.state || this.state.phase === 'ended') return;
      this.state.winner = 'defender';
      this.state.phase = 'ended';
    },

    isOver: function() {
      return !this.state || this.state.phase === 'ended';
    },

    getResult: function() {
      if (!this.state || this.state.phase !== 'ended') return null;
      var result = { winner: this.state.winner, attackerCasualties: [], defenderCasualties: [] };
      for (var i = 0; i < this.state.attacker.heroes.length; i++) {
        var ah = this.state.attacker.heroes[i];
        result.attackerCasualties.push({ heroId: ah.heroId, hp: ah.hp, troops: ah.troops, captured: ah.hp <= 0 });
      }
      for (var j = 0; j < this.state.defender.heroes.length; j++) {
        var dh = this.state.defender.heroes[j];
        result.defenderCasualties.push({ heroId: dh.heroId, hp: dh.hp, troops: dh.troops, captured: dh.hp <= 0 });
      }
      return result;
    },

    applyResult: function() {
      if (!this.state) return;
      var GD = window.SG3.GameData;
      var result = this.getResult();
      if (!result) return;
      var winnerFaction = result.winner === 'attacker' ? this.state.attacker.faction : this.state.defender.faction;

      // 更新攻方武将
      for (var i = 0; i < result.attackerCasualties.length; i++) {
        var ac = result.attackerCasualties[i];
        var aHero = GD.heroes[ac.heroId];
        if (!aHero) continue;
        aHero.hp = ac.hp; aHero.troops = ac.troops;
        if (ac.captured) { aHero.faction = winnerFaction; aHero.loyalty = Math.floor(aHero.loyalty * 0.3); }
      }

      // 更新守方武将
      for (var j = 0; j < result.defenderCasualties.length; j++) {
        var dc = result.defenderCasualties[j];
        var dHero = GD.heroes[dc.heroId];
        if (!dHero) continue;
        dHero.hp = dc.hp; dHero.troops = dc.troops;
        if (dc.captured) { dHero.faction = winnerFaction; dHero.loyalty = Math.floor(dHero.loyalty * 0.3); }
      }

      // 攻方获胜，占领城市
      if (result.winner === 'attacker' && GD.battle && GD.battle.targetCity) {
        var cityId = GD.battle.targetCity;
        var city = GD.cities[cityId];
        if (city) {
          city.faction = this.state.attacker.faction;
          var newHeroIds = [];
          for (var k = 0; k < this.state.attacker.heroes.length; k++) {
            var aliveHero = this.state.attacker.heroes[k];
            if (aliveHero.hp > 0) {
              newHeroIds.push(aliveHero.heroId);
              var gsHero = GD.heroes[aliveHero.heroId];
              if (gsHero) { gsHero.location = cityId; gsHero.status = 'idle'; }
            }
          }
          // 被俘守方武将
          for (var m = 0; m < this.state.defender.heroes.length; m++) {
            var defHero = this.state.defender.heroes[m];
            if (defHero.hp <= 0) {
              var gsDefHero = GD.heroes[defHero.heroId];
              if (gsDefHero) { gsDefHero.location = cityId; gsDefHero.status = 'idle'; gsDefHero.hp = 10; newHeroIds.push(defHero.heroId); }
            }
          }
          city.heroes = newHeroIds;
          city.troops = GD.getCityTotalTroops(cityId);
        }
      } else if (result.winner === 'defender' && GD.battle && GD.battle.fromCity) {
        var fromCityId = GD.battle.fromCity;
        var fromCity = GD.cities[fromCityId];
        if (fromCity) {
          // 存活攻方武将撤退回出发城市
          for (var n = 0; n < this.state.attacker.heroes.length; n++) {
            var retHero = this.state.attacker.heroes[n];
            if (retHero.hp > 0) {
              var gsRetHero = GD.heroes[retHero.heroId];
              if (gsRetHero) {
                gsRetHero.location = fromCityId; gsRetHero.status = 'idle';
                if (fromCity.heroes.indexOf(retHero.heroId) === -1) fromCity.heroes.push(retHero.heroId);
              }
            }
          }
        }
        // 被俘攻方武将（hp<=0，faction已改为获胜方）安置到目标城市
        var defCityId = GD.battle.targetCity;
        var defCity = GD.cities[defCityId];
        if (defCity) {
          for (var p = 0; p < this.state.attacker.heroes.length; p++) {
            var capHero = this.state.attacker.heroes[p];
            if (capHero.hp <= 0) {
              var gsCapHero = GD.heroes[capHero.heroId];
              if (gsCapHero) {
                gsCapHero.location = defCityId; gsCapHero.status = 'idle'; gsCapHero.hp = 10; gsCapHero.troops = 0;
                if (defCity.heroes.indexOf(capHero.heroId) === -1) defCity.heroes.push(capHero.heroId);
              }
            }
          }
          defCity.troops = GD.getCityTotalTroops(defCityId);
        }
      }

      GD.battle = null;
      GD.phase = 'strategic';
    },

    _applyAdvisorSkills: function() {
      var events = [];
      var atkHeroes = this.state.attacker.heroes;
      var defHeroes = this.state.defender.heroes;
      var sides = [{ heroes: atkHeroes, opponent: defHeroes, label: 'attacker' }, { heroes: defHeroes, opponent: atkHeroes, label: 'defender' }];

      for (var s = 0; s < sides.length; s++) {
        var side = sides[s];
        for (var i = 0; i < side.heroes.length; i++) {
          var hero = side.heroes[i];
          if (!hero.advisorSkill) continue;
          var skillData = window.SG3.SKILLS_DATA[hero.advisorSkill];
          if (!skillData || skillData.type !== 'advisor') continue;
          var heroData = window.SG3.GameData.heroes[hero.heroId];
          var name = heroData ? heroData.name : hero.heroId;

          if (hero.advisorSkill === 'jimou') {
            for (var j = 0; j < side.heroes.length; j++) side.heroes[j].morale = Math.min(200, side.heroes[j].morale + 10);
          } else if (hero.advisorSkill === 'guwu') {
            for (var k = 0; k < side.heroes.length; k++) side.heroes[k].morale = Math.min(200, side.heroes[k].morale + 15);
          } else if (hero.advisorSkill === 'yaohuo') {
            for (var l = 0; l < side.opponent.length; l++) side.opponent[l].morale = Math.max(10, side.opponent[l].morale - 10);
          }

          events.push({ type: 'advisorSkill', skillId: hero.advisorSkill, skillName: skillData.name, side: side.label, sourceName: name });
        }
      }
      return events;
    },

    _checkWinCondition: function() {
      var atkAllDead = true, defAllDead = true;
      for (var i = 0; i < this.state.attacker.heroes.length; i++) {
        var h = this.state.attacker.heroes[i];
        if (h.hp > 0 || h.troops > 0) { atkAllDead = false; break; }
      }
      for (var j = 0; j < this.state.defender.heroes.length; j++) {
        var h2 = this.state.defender.heroes[j];
        if (h2.hp > 0 || h2.troops > 0) { defAllDead = false; break; }
      }
      if (atkAllDead) { this.state.winner = 'defender'; return true; }
      if (defAllDead) { this.state.winner = 'attacker'; return true; }
      return false;
    },

    _forceEndByTimeout: function() {
      var atkScore = 0, defScore = 0;
      for (var i = 0; i < this.state.attacker.heroes.length; i++) {
        var h = this.state.attacker.heroes[i];
        if (h.hp > 0 || h.troops > 0) atkScore += h.hp + h.troops;
      }
      for (var j = 0; j < this.state.defender.heroes.length; j++) {
        var h2 = this.state.defender.heroes[j];
        if (h2.hp > 0 || h2.troops > 0) defScore += h2.hp + h2.troops;
      }
      this.state.winner = (atkScore >= defScore) ? 'attacker' : 'defender';
      this.state.phase = 'ended';
      this._addLog('战斗超时，按剩余战力判定胜负！');
    },

    _checkDestiny: function(hero, heroData, heroName, side) {
      if (this.state.destinyTriggered[side]) return null;
      if (!heroData || !heroData.isMonarch) return null;
      if (hero.maxHp <= 0) return null;
      var threshold = Math.floor(hero.maxHp * 0.1);
      // HP <= 10%阈值时触发（包括HP已被打到0或负数的情况）
      if (hero.hp > threshold) return null;

      // 1. 锁血：HP固定在10%阈值，标记锁血状态（持续到战斗结束）
      hero.hp = threshold;
      hero.destinyLocked = true;

      // 2. 全属性提升300%：士气400%（100+300），兵力上限×4并回满
      hero.morale = 400;
      hero.maxTroops = Math.floor(hero.maxTroops * 4);
      hero.troops = hero.maxTroops;

      // 3. 天降陨石：砸死所有敌军士兵（troops清零）
      var opposeHeroes = side === 'attacker' ? this.state.defender.heroes : this.state.attacker.heroes;
      var meteorTargets = [];
      for (var i = 0; i < opposeHeroes.length; i++) {
        var enemy = opposeHeroes[i];
        if (enemy.hp <= 0 && enemy.troops <= 0) continue;
        var killedTroops = enemy.troops;
        enemy.troops = 0;
        meteorTargets.push({
          heroId: enemy.heroId,
          name: (window.SG3.GameData.heroes[enemy.heroId] || {}).name || enemy.heroId,
          killedTroops: killedTroops
        });
      }

      // 友军士气提升
      var allyHeroes = side === 'attacker' ? this.state.attacker.heroes : this.state.defender.heroes;
      for (var j = 0; j < allyHeroes.length; j++) {
        if (allyHeroes[j] !== hero) allyHeroes[j].morale = Math.min(400, allyHeroes[j].morale + 100);
      }

      this.state.destinyTriggered[side] = true;
      this._addLog('【天命觉醒】' + heroName + ' HP锁血至' + threshold + '（持续到战斗结束），天降陨石砸死所有敌军士兵，全属性提升300%！');
      return {
        type: 'destiny',
        heroName: heroName,
        side: side,
        lockedHp: threshold,
        meteorTargets: meteorTargets,
        statBoost: '300%'
      };
    },

    _addLog: function(msg) {
      if (!this.state) return;
      this.state.log.push({ turn: this.state.turn, msg: msg });
      if (this.state.log.length > 50) this.state.log.shift();
    }
  };

  window.SG3.BattleEngine = Engine;
})();
