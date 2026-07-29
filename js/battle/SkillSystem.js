// 三国群英传 - 技能执行系统
window.SG = window.SG || {};

(function() {
  'use strict';

  var SkillSystem = {

    execute: function(skillId, caster, targets, side) {
      var skillData = window.SG.SKILLS_DATA[skillId];
      if (!skillData) return null;

      var GS = window.SG.GameState;
      var heroData = GS.heroes[caster.heroId];
      if (!heroData) return null;

      var result = {
        type: skillData.type,
        skillId: skillId,
        skillName: skillData.name,
        source: caster.heroId,
        sourceName: heroData.name,
        side: side,
        range: skillData.range,
        effectType: skillData.effectType,
        targets: [],
        damage: 0,
        heal: 0,
        animation: this._getAnimationType(skillData),
        isExclusive: skillData.isExclusive || false,
        selfDamage: 0
      };

      var effectType = skillData.effectType || 'damage';
      var i, target, targetHero, dmg, healAmt;

      // 自伤效果
      if (skillData.selfDamage && skillData.selfDamage > 0) {
        var selfDmg = Math.floor(skillData.selfDamage * (heroData.force / 50));
        caster.hp = Math.max(1, caster.hp - selfDmg);
        result.selfDamage = selfDmg;
      }

      // 自身效果
      if (skillData.range === 'self') {
        this._applyEffect(effectType, skillData, caster, caster, heroData, result, side);
        return result;
      }

      // 我方全体
      if (skillData.range === 'ally') {
        for (i = 0; i < targets.length; i++) {
          target = targets[i];
          if (target.hp <= 0 && target.troops <= 0) continue;
          this._applyEffect(effectType, skillData, target, caster, heroData, result, side);
        }
        return result;
      }

      // 单体攻击
      if (skillData.range === 'single' && targets.length > 0) {
        target = targets[0];
        this._applyEffect(effectType, skillData, target, caster, heroData, result, side);
        return result;
      }

      // 群体攻击
      if (skillData.range === 'area') {
        var basePower = skillData.power || 0;
        var isDamageType = (effectType === 'damage' || effectType === 'burn');
        var statKey = isDamageType ? (skillData.range === 'area' ? 'intellect' : 'force') : 'intellect';
        var baseValue = Math.floor(basePower * (heroData[statKey] / 50) * (0.9 + Math.random() * 0.2));

        for (i = 0; i < targets.length; i++) {
          target = targets[i];
          if (target.hp <= 0 && target.troops <= 0) continue;
          this._applyEffect(effectType, skillData, target, caster, heroData, result, side, baseValue);
        }
        return result;
      }

      return result;
    },

    _applyEffect: function(effectType, skillData, target, caster, casterHeroData, result, side, baseValue) {
      var GS = window.SG.GameState;
      var targetHero = GS.heroes[target.heroId];
      var targetName = targetHero ? targetHero.name : '';
      var power = skillData.power || 0;

      // 计算基础值（如果未传入）
      if (baseValue === undefined) {
        var statKey = this._getStatKey(effectType, skillData);
        var statVal = casterHeroData[statKey] || 50;
        baseValue = Math.floor(power * (statVal / 50) * (0.9 + Math.random() * 0.2));
      }

      var entry = { heroId: target.heroId, name: targetName, damage: 0, heal: 0, effects: [] };

      switch (effectType) {
        case 'damage':
          this._applyDamage(target, baseValue, skillData, entry);
          result.damage += entry.damage;
          // 状态效果
          if (skillData.statusEffect) {
            this._applyStatusEffect(target, skillData, entry);
          }
          break;

        case 'heal_troops':
          var healTroops = Math.floor(baseValue * (casterHeroData.charisma / 50));
          var oldTroops = target.troops;
          target.troops = Math.min(target.maxTroops, target.troops + healTroops);
          var actualHeal = target.troops - oldTroops;
          entry.heal = actualHeal;
          entry.troopRestore = actualHeal;
          entry.effects.push({ type: 'heal_troops', value: actualHeal });
          result.heal += actualHeal;
          // 附带士气提升
          if (skillData.bonusEffect === 'morale_up') {
            var moraleGain = skillData.bonusPower || 10;
            target.morale = Math.min(200, (target.morale || 100) + moraleGain);
            entry.effects.push({ type: 'morale_up', value: moraleGain });
          }
          break;

        case 'heal_hp':
          var healHp = Math.floor(baseValue * 0.8);
          var oldHp = target.hp;
          target.hp = Math.min(target.maxHp, target.hp + healHp);
          var actualHpHeal = target.hp - oldHp;
          entry.heal = actualHpHeal;
          entry.hpRestore = actualHpHeal;
          entry.effects.push({ type: 'heal_hp', value: actualHpHeal });
          result.heal += actualHpHeal;
          break;

        case 'restore_sp':
          var spRestore = Math.floor(baseValue * 0.8);
          var oldSp = target.sp;
          target.sp = Math.min(target.maxSp, target.sp + spRestore);
          var actualSp = target.sp - oldSp;
          entry.spRestore = actualSp;
          entry.effects.push({ type: 'restore_sp', value: actualSp });
          result.heal += actualSp;
          break;

        case 'buff_attack':
          var atkBuff = baseValue;
          target.attackBuff = (target.attackBuff || 0) + atkBuff;
          target.attackBuffTurns = skillData.buffDuration || 3;
          entry.effects.push({ type: 'buff_attack', value: atkBuff, turns: skillData.buffDuration || 3 });
          break;

        case 'buff_defense':
          var defBuff = baseValue;
          target.defenseBuff = (target.defenseBuff || 0) + defBuff;
          target.defenseBuffTurns = skillData.buffDuration || 3;
          entry.effects.push({ type: 'buff_defense', value: defBuff, turns: skillData.buffDuration || 3 });
          break;

        case 'debuff_attack':
          var atkDebuff = baseValue;
          target.attackDebuff = (target.attackDebuff || 0) + atkDebuff;
          target.attackDebuffTurns = skillData.buffDuration || 3;
          entry.effects.push({ type: 'debuff_attack', value: atkDebuff, turns: skillData.buffDuration || 3 });
          break;

        case 'debuff_defense':
          var defDebuff = baseValue;
          target.defenseDebuff = (target.defenseDebuff || 0) + defDebuff;
          target.defenseDebuffTurns = skillData.buffDuration || 3;
          entry.effects.push({ type: 'debuff_defense', value: defDebuff, turns: skillData.buffDuration || 3 });
          break;

        case 'morale_up':
          var moraleUp = baseValue;
          target.morale = Math.min(200, (target.morale || 100) + moraleUp);
          entry.effects.push({ type: 'morale_up', value: moraleUp });
          break;

        case 'morale_down':
          var moraleDown = baseValue;
          target.morale = Math.max(0, (target.morale || 100) - moraleDown);
          entry.effects.push({ type: 'morale_down', value: moraleDown });
          break;

        case 'burn':
          // 灼烧：造成伤害并附加灼烧状态
          this._applyDamage(target, baseValue, skillData, entry);
          result.damage += entry.damage;
          target.burnDamage = Math.floor(baseValue * 0.3);
          target.burnTurns = skillData.statusDuration || 3;
          entry.effects.push({ type: 'burn', value: target.burnDamage, turns: target.burnTurns });
          break;

        case 'stun':
          // 眩晕
          this._applyDamage(target, baseValue, skillData, entry);
          result.damage += entry.damage;
          if (Math.random() * 100 < (skillData.statusChance || 50)) {
            target.stunTurns = skillData.statusDuration || 1;
            entry.effects.push({ type: 'stun', turns: target.stunTurns });
          }
          break;
      }

      result.targets.push(entry);
    },

    _applyDamage: function(target, baseDmg, skillData, entry) {
      var dmg = baseDmg;

      // 防御减伤
      if (target.defenseBuff) {
        dmg = Math.floor(dmg * (1 - target.defenseBuff / 200));
      }
      if (target.defenseDebuff) {
        dmg = Math.floor(dmg * (1 + target.defenseDebuff / 200));
      }

      // 暴击计算
      var isCrit = false;
      var critChance = 5 + (skillData.critBonus || 0);
      if (Math.random() * 100 < critChance) {
        dmg = Math.floor(dmg * 1.5);
        isCrit = true;
      }

      var troopLoss = 0;
      var hpLoss = 0;

      if (target.troops > 0) {
        troopLoss = Math.min(target.troops, dmg);
        target.troops -= troopLoss;
        dmg -= troopLoss;
      }
      if (dmg > 0) {
        hpLoss = dmg;
        target.hp = Math.max(0, target.hp - dmg);
      }

      entry.damage = troopLoss + hpLoss;
      entry.troopLoss = troopLoss;
      entry.hpLoss = hpLoss;
      entry.isCrit = isCrit;
    },

    _applyStatusEffect: function(target, skillData, entry) {
      if (!skillData.statusEffect) return;
      var chance = skillData.statusChance || 100;
      if (Math.random() * 100 > chance) return;

      var duration = skillData.statusDuration || 2;
      switch (skillData.statusEffect) {
        case 'burn':
          target.burnTurns = duration;
          target.burnDamage = Math.floor(skillData.power * 0.2);
          entry.effects.push({ type: 'burn', value: target.burnDamage, turns: duration });
          break;
        case 'stun':
          target.stunTurns = duration;
          entry.effects.push({ type: 'stun', turns: duration });
          break;
      }
    },

    _getStatKey: function(effectType, skillData) {
      if (effectType === 'damage' || effectType === 'burn' || effectType === 'stun') {
        return skillData.range === 'area' ? 'intellect' : 'force';
      }
      if (effectType === 'heal_troops') return 'charisma';
      return 'intellect';
    },

    // 获取武将当前可用的技能列表
    getAvailableSkills: function(hero) {
      if (!hero || !hero.skills) return [];
      var available = [];
      for (var i = 0; i < hero.skills.length; i++) {
        var skillId = hero.skills[i];
        var skillData = window.SG.SKILLS_DATA[skillId];
        if (skillData && skillData.type === 'combat' && hero.sp >= skillData.spCost) {
          available.push(skillData);
        }
      }
      return available;
    },

    // 获取技能消耗
    getSkillCost: function(skillId) {
      var skillData = window.SG.SKILLS_DATA[skillId];
      return skillData ? skillData.spCost : 0;
    },

    // 获取技能动画类型
    _getAnimationType: function(skillData) {
      if (!skillData) return 'ink';
      if (skillData.element === 'fire') return 'fire';
      if (skillData.element === 'lightning') return 'lightning';
      return 'ink';
    },

    // 回合开始：处理持续效果（灼烧、buff/debuff衰减等）
    processTurnStart: function(hero) {
      var effects = [];

      // 灼烧伤害
      if (hero.burnTurns && hero.burnTurns > 0) {
        var burnDmg = hero.burnDamage || 10;
        if (hero.troops > 0) {
          var tLoss = Math.min(hero.troops, burnDmg);
          hero.troops -= tLoss;
          burnDmg -= tLoss;
        }
        if (burnDmg > 0) {
          hero.hp = Math.max(0, hero.hp - burnDmg);
        }
        hero.burnTurns--;
        effects.push({ type: 'burn', damage: hero.burnDamage });
      }

      // 眩晕倒计时
      if (hero.stunTurns && hero.stunTurns > 0) {
        hero.stunTurns--;
        effects.push({ type: 'stun' });
      }

      // 攻击增益衰减
      if (hero.attackBuffTurns && hero.attackBuffTurns > 0) {
        hero.attackBuffTurns--;
        if (hero.attackBuffTurns <= 0) {
          hero.attackBuff = 0;
        }
      }

      // 防御增益衰减
      if (hero.defenseBuffTurns && hero.defenseBuffTurns > 0) {
        hero.defenseBuffTurns--;
        if (hero.defenseBuffTurns <= 0) {
          hero.defenseBuff = 0;
        }
      }

      // 攻击减益衰减
      if (hero.attackDebuffTurns && hero.attackDebuffTurns > 0) {
        hero.attackDebuffTurns--;
        if (hero.attackDebuffTurns <= 0) {
          hero.attackDebuff = 0;
        }
      }

      // 防御减益衰减
      if (hero.defenseDebuffTurns && hero.defenseDebuffTurns > 0) {
        hero.defenseDebuffTurns--;
        if (hero.defenseDebuffTurns <= 0) {
          hero.defenseDebuff = 0;
        }
      }

      return effects;
    },

    // 获取武将当前有效攻击力（含buff）
    getEffectiveAttack: function(hero, baseAttack) {
      var atk = baseAttack;
      if (hero.attackBuff) atk = Math.floor(atk * (1 + hero.attackBuff / 100));
      if (hero.attackDebuff) atk = Math.floor(atk * (1 - hero.attackDebuff / 100));
      return atk;
    },

    // 检查是否被眩晕
    isStunned: function(hero) {
      return hero.stunTurns && hero.stunTurns > 0;
    }
  };

  window.SG.SkillSystem = SkillSystem;

})();
