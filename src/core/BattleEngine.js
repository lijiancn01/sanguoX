/**
 * 三国群英传 - 战斗逻辑引擎（引擎无关层，纯逻辑，可单测）
 * @author jian.li
 */

import { SKILLS_DATA } from '../data/skills.js';
import { BATTLE_FORCE_END_ROUNDS } from './config.js';

/** 兵种克制：步兵→弓兵→骑兵→步兵，克制方伤害 ×1.3 */
const TROOP_ADVANTAGE = { infantry: 'archer', archer: 'cavalry', cavalry: 'infantry' };

/** 兵力直接伤害系数 */
const TROOP_DAMAGE_RATIO = 0.1;
/** 兵力伤害保底比例 */
const TROOP_DAMAGE_FLOOR_RATIO = 0.02;
/** 纯武力（无兵）直接伤害系数 */
const HERO_DAMAGE_RATIO = 0.5;
/** 天命觉醒后武力伤害倍率 */
const DESTINY_FORCE_MULTIPLIER = 4;
/** 君主 HP 保护阈值比例 */
const MONARCH_HP_FLOOR_RATIO = 0.1;

let gd = null;

/**
 * 注入 GameData 实例。
 * @param {object} gameData
 */
export function setGameData(gameData) {
  gd = gameData;
}

function getTypeMultiplier(attackerType, defenderType) {
  return TROOP_ADVANTAGE[attackerType] === defenderType ? 1.3 : 1.0;
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

const Engine = {
  state: null,

  init(attackerHeroes, defenderHeroes, attackerFaction, defenderFaction) {
    this.state = {
      attacker: { faction: attackerFaction, heroes: [] },
      defender: { faction: defenderFaction, heroes: [] },
      turn: 0,
      phase: 'prepare',
      log: [],
      winner: null,
      duelState: null,
      destinyTriggered: { attacker: false, defender: false }
    };

    const buildUnit = (heroId) => {
      const hero = gd.heroes[heroId];
      if (!hero) return null;
      const maxHp = 100 + hero.level * 10;
      return {
        heroId,
        troops: hero.troops,
        troopType: hero.troopType,
        hp: maxHp,
        maxHp,
        sp: hero.sp,
        maxSp: hero.maxSp,
        morale: 100,
        maxTroops: hero.maxTroops,
        skills: hero.skills ? hero.skills.slice() : [],
        advisorSkill: hero.advisorSkill || null
      };
    };

    for (let i = 0; i < attackerHeroes.length && i < 5; i++) {
      const unit = buildUnit(attackerHeroes[i]);
      if (unit) this.state.attacker.heroes.push(unit);
    }
    for (let j = 0; j < defenderHeroes.length && j < 5; j++) {
      const unit = buildUnit(defenderHeroes[j]);
      if (unit) this.state.defender.heroes.push(unit);
    }

    return this.state;
  },

  step() {
    if (!this.state || this.state.phase === 'ended') return [];
    let events = [];
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
    } else if (this.state.turn >= BATTLE_FORCE_END_ROUNDS) {
      // 超时兜底：按剩余战力判定，防止战斗无限循环
      this.forceEndByTimeout();
      events.push({ type: 'battleEnd', winner: this.state.winner });
    }
    return events;
  },

  _fightStep() {
    const events = [];
    const atkHeroes = this.state.attacker.heroes;
    const defHeroes = this.state.defender.heroes;
    const maxPairs = Math.max(atkHeroes.length, defHeroes.length);

    for (let i = 0; i < maxPairs; i++) {
      const atkHero = i < atkHeroes.length ? atkHeroes[i] : null;
      const defHero = i < defHeroes.length ? defHeroes[i] : null;
      if (atkHero && (atkHero.hp > 0 || atkHero.troops > 0)) {
        const target = this._findTarget(defHeroes, i);
        if (target) events.push(this._heroAttack(atkHero, target, 'attacker'));
      }
      if (defHero && (defHero.hp > 0 || defHero.troops > 0)) {
        const atkTarget = this._findTarget(atkHeroes, i);
        if (atkTarget) events.push(this._heroAttack(defHero, atkTarget, 'defender'));
      }
    }
    this._decayMorale(atkHeroes);
    this._decayMorale(defHeroes);
    return events;
  },

  _findTarget(heroes, preferIdx) {
    if (preferIdx < heroes.length) {
      const pref = heroes[preferIdx];
      if (pref.hp > 0 || pref.troops > 0) return pref;
    }
    for (const hero of heroes) {
      if (hero.hp > 0 || hero.troops > 0) return hero;
    }
    return null;
  },

  _heroAttack(attacker, defender, side) {
    const atkData = gd.heroes[attacker.heroId];
    const defData = gd.heroes[defender.heroId];
    const atkName = atkData ? atkData.name : attacker.heroId;
    const defName = defData ? defData.name : defender.heroId;
    const defenderSide = side === 'attacker' ? 'defender' : 'attacker';
    const isPlayerMonarch = !!(defData && defData.isMonarch &&
      this.state[defenderSide].faction === gd.playerFaction);
    const event = {
      type: 'attack',
      attacker: attacker.heroId,
      attackerName: atkName,
      defender: defender.heroId,
      defenderName: defName,
      side,
      troopDamage: 0,
      hpDamage: 0
    };

    if (attacker.troops > 0 && (defender.troops > 0 || defender.hp > 0)) {
      const typeMultiplier = getTypeMultiplier(attacker.troopType, defender.troopType);
      const moraleFactor = attacker.morale / 100;
      const baseDmg = attacker.troops * TROOP_DAMAGE_RATIO *
        randRange(0.8, 1.2) * typeMultiplier * moraleFactor;
      let dmg = Math.max(Math.floor(baseDmg), Math.floor(attacker.troops * TROOP_DAMAGE_FLOOR_RATIO));
      if (defender.troops > 0) {
        const troopLoss = Math.min(defender.troops, dmg);
        defender.troops -= troopLoss;
        dmg -= troopLoss;
        event.troopDamage = troopLoss;
      }
      if (dmg > 0 && defender.hp > 0) {
        // 天命锁血：已触发天命觉醒的君主不再扣 HP
        if (!defender.destinyLocked) {
          let hpLoss = Math.min(defender.hp, dmg);
          // 预判：玩家君主 HP 保护，不扣到 10% 阈值以下（AI 君主不受保护）
          const threshold = Math.floor(defender.maxHp * MONARCH_HP_FLOOR_RATIO);
          if (isPlayerMonarch && !this.state.destinyTriggered[defenderSide] &&
              (defender.hp - hpLoss) <= threshold) {
            hpLoss = Math.max(0, defender.hp - threshold);
          }
          defender.hp -= hpLoss;
          event.hpDamage = hpLoss;
        }
      }
    }

    if (attacker.troops <= 0 && attacker.hp > 0 && defender.hp > 0) {
      const force = atkData ? atkData.force : 50;
      // 天命全属性提升：已觉醒的攻击者武力伤害 ×4
      const effectiveForce = attacker.destinyLocked
        ? Math.floor(force * DESTINY_FORCE_MULTIPLIER)
        : force;
      const heroDmg = Math.floor(effectiveForce * HERO_DAMAGE_RATIO * randRange(0.8, 1.2));
      // 天命锁血：防守者已觉醒则不扣 HP
      if (!defender.destinyLocked) {
        let actualDmg = Math.min(defender.hp, heroDmg);
        const threshold = Math.floor(defender.maxHp * MONARCH_HP_FLOOR_RATIO);
        if (isPlayerMonarch && !this.state.destinyTriggered[defenderSide] &&
            (defender.hp - actualDmg) <= threshold) {
          actualDmg = Math.max(0, defender.hp - threshold);
        }
        defender.hp -= actualDmg;
        event.hpDamage += actualDmg;
      }
    }

    // 天命觉醒判定（含 HP 已被打到 0 的情况）
    const destinyEvent = this._checkDestiny(defender, defData, defName, defenderSide);
    if (destinyEvent) event.destiny = destinyEvent;

    this._addLog(`${atkName} 攻击 ${defName}，兵力损失${event.troopDamage}，HP损失${event.hpDamage}`);
    return event;
  },

  _decayMorale(heroes) {
    for (const hero of heroes) {
      if (hero.hp > 0 || hero.troops > 0) {
        hero.morale = Math.max(30, hero.morale - 1);
      }
    }
  },

  useSkill(heroIndex, skillId, side) {
    if (!this.state || this.state.phase === 'ended') return null;
    const heroes = side === 'attacker' ? this.state.attacker.heroes : this.state.defender.heroes;
    const hero = heroes[heroIndex];
    if (!hero || (hero.hp <= 0 && hero.troops <= 0)) return null;
    const skillData = SKILLS_DATA[skillId];
    if (!skillData) return null;
    if (hero.sp < skillData.spCost) return null;
    hero.sp -= skillData.spCost;

    const opposeHeroes = side === 'attacker' ? this.state.defender.heroes : this.state.attacker.heroes;
    let targets;
    if (skillData.range === 'single') {
      const target = this._findTarget(opposeHeroes, heroIndex);
      targets = target ? [target] : [];
    } else if (skillData.range === 'area') {
      targets = opposeHeroes.filter((h) => h.hp > 0 || h.troops > 0);
    } else {
      targets = heroes.filter((h) => h.hp > 0);
    }

    const result = this._executeSkill(skillId, hero, targets, side);
    if (result) {
      const heroData = gd.heroes[hero.heroId];
      this._addLog(`${heroData ? heroData.name : hero.heroId} 使用了 ${skillData.name}！`);
      result.side = side;
      result.sourceIndex = heroIndex;
      // 技能可能造成击杀，立即判定胜负
      if (this._checkWinCondition()) {
        this.state.phase = 'ended';
      }
    }
    return result;
  },

  _executeSkill(skillId, source, targets, side) {
    const skill = SKILLS_DATA[skillId];
    if (!skill) return null;
    const result = { type: 'skill', skillId, skillName: skill.name, element: skill.element, targets: [] };

    for (const target of targets) {
      const targetResult = { heroId: target.heroId, effects: [] };

      switch (skill.effectType) {
        case 'damage': {
          let dmg = Math.floor(skill.power * randRange(0.9, 1.1));
          if (target.troops > 0) {
            const troopLoss = Math.min(target.troops, dmg);
            target.troops -= troopLoss;
            dmg -= troopLoss;
            targetResult.effects.push({ type: 'troopDamage', value: troopLoss });
          }
          if (dmg > 0 && target.hp > 0 && !target.destinyLocked) {
            let hpLoss = Math.min(target.hp, dmg);
            const tgtHeroData = gd.heroes[target.heroId];
            const opposingSide = side === 'attacker' ? 'defender' : 'attacker';
            const isPlayerMonarch = !!(tgtHeroData && tgtHeroData.isMonarch &&
              this.state[opposingSide].faction === gd.playerFaction);
            const threshold = Math.floor(target.maxHp * MONARCH_HP_FLOOR_RATIO);
            if (isPlayerMonarch && !this.state.destinyTriggered[opposingSide] &&
                (target.hp - hpLoss) <= threshold) {
              hpLoss = Math.max(0, target.hp - threshold);
            }
            target.hp -= hpLoss;
            targetResult.effects.push({ type: 'hpDamage', value: hpLoss });
          }
          break;
        }
        case 'heal_troops': {
          const heal = Math.floor(skill.power * randRange(0.8, 1.2));
          target.troops = Math.min(target.maxTroops, target.troops + heal);
          targetResult.effects.push({ type: 'healTroops', value: heal });
          break;
        }
        case 'heal_hp': {
          const hpHeal = Math.floor(skill.power * randRange(0.8, 1.2));
          target.hp = Math.min(target.maxHp, target.hp + hpHeal);
          targetResult.effects.push({ type: 'healHp', value: hpHeal });
          break;
        }
        case 'restore_sp': {
          const spRestore = Math.floor(skill.power * randRange(0.8, 1.2));
          target.sp = Math.min(target.maxSp, target.sp + spRestore);
          targetResult.effects.push({ type: 'restoreSp', value: spRestore });
          break;
        }
        case 'morale_up': {
          target.morale = Math.min(200, target.morale + skill.power);
          targetResult.effects.push({ type: 'moraleUp', value: skill.power });
          break;
        }
        case 'morale_down': {
          target.morale = Math.max(10, target.morale - skill.power);
          targetResult.effects.push({ type: 'moraleDown', value: skill.power });
          break;
        }
        case 'buff_attack':
        case 'buff_defense': {
          target.morale = Math.min(200, target.morale + skill.power);
          targetResult.effects.push({ type: skill.effectType, value: skill.power });
          break;
        }
        case 'debuff_attack':
        case 'debuff_defense': {
          target.morale = Math.max(10, target.morale - skill.power);
          targetResult.effects.push({ type: skill.effectType, value: skill.power });
          break;
        }
        default:
          break;
      }

      result.targets.push(targetResult);
    }

    // 检查天命觉醒（技能伤害也可能触发）
    const opposingSide = side === 'attacker' ? 'defender' : 'attacker';
    for (const destinyTarget of targets) {
      const destinyHeroData = gd.heroes[destinyTarget.heroId];
      const destinyName = destinyHeroData ? destinyHeroData.name : destinyTarget.heroId;
      const destinyEvent = this._checkDestiny(destinyTarget, destinyHeroData, destinyName, opposingSide);
      if (destinyEvent && !result.destiny) {
        result.destiny = destinyEvent;
      }
    }

    if (skill.selfDamage && source.hp > 0) {
      source.hp = Math.max(0, source.hp - skill.selfDamage);
      result.selfDamage = skill.selfDamage;
    }

    return result;
  },

  retreat() {
    if (!this.state || this.state.phase === 'ended') return;
    this.state.winner = 'defender';
    this.state.phase = 'ended';
  },

  isOver() {
    return !this.state || this.state.phase === 'ended';
  },

  getResult() {
    if (!this.state || this.state.phase !== 'ended') return null;
    const result = { winner: this.state.winner, attackerCasualties: [], defenderCasualties: [] };
    for (const ah of this.state.attacker.heroes) {
      result.attackerCasualties.push({ heroId: ah.heroId, hp: ah.hp, troops: ah.troops, captured: ah.hp <= 0 });
    }
    for (const dh of this.state.defender.heroes) {
      result.defenderCasualties.push({ heroId: dh.heroId, hp: dh.hp, troops: dh.troops, captured: dh.hp <= 0 });
    }
    return result;
  },

  applyResult() {
    if (!this.state) return;
    const result = this.getResult();
    if (!result) return;
    const winnerFaction = result.winner === 'attacker'
      ? this.state.attacker.faction
      : this.state.defender.faction;

    // 回写双方武将的 HP / 兵力，被俘者易主
    const casualties = result.attackerCasualties.concat(result.defenderCasualties);
    for (const c of casualties) {
      const hero = gd.heroes[c.heroId];
      if (!hero) continue;
      hero.hp = c.hp;
      hero.troops = c.troops;
      if (c.captured) {
        hero.faction = winnerFaction;
        hero.loyalty = Math.floor(hero.loyalty * 0.3);
      }
    }

    if (result.winner === 'attacker' && gd.battle && gd.battle.targetCity) {
      const cityId = gd.battle.targetCity;
      const city = gd.cities[cityId];
      if (city) {
        city.faction = this.state.attacker.faction;
        const newHeroIds = [];
        for (const aliveHero of this.state.attacker.heroes) {
          if (aliveHero.hp > 0) {
            newHeroIds.push(aliveHero.heroId);
            const gsHero = gd.heroes[aliveHero.heroId];
            if (gsHero) { gsHero.location = cityId; gsHero.status = 'idle'; }
          }
        }
        // 被俘守方武将
        for (const defHero of this.state.defender.heroes) {
          if (defHero.hp <= 0) {
            const gsDefHero = gd.heroes[defHero.heroId];
            if (gsDefHero) {
              gsDefHero.location = cityId;
              gsDefHero.status = 'idle';
              gsDefHero.hp = 10;
            }
            if (newHeroIds.indexOf(defHero.heroId) === -1) newHeroIds.push(defHero.heroId);
          }
        }
        city.heroes = newHeroIds;
        city.troops = gd.getCityTotalTroops(cityId);
      }
    } else if (result.winner === 'defender' && gd.battle && gd.battle.fromCity) {
      const fromCityId = gd.battle.fromCity;
      const fromCity = gd.cities[fromCityId];
      if (fromCity) {
        // 存活攻方撤回出发城市
        for (const retHero of this.state.attacker.heroes) {
          if (retHero.hp <= 0) continue;
          const gsRetHero = gd.heroes[retHero.heroId];
          if (gsRetHero) {
            gsRetHero.location = fromCityId;
            gsRetHero.status = 'idle';
            if (fromCity.heroes.indexOf(retHero.heroId) === -1) fromCity.heroes.push(retHero.heroId);
          }
        }
      }
      // 被俘攻方武将安置到目标城市
      const defCityId = gd.battle.targetCity;
      const defCity = gd.cities[defCityId];
      if (defCity) {
        for (const capHero of this.state.attacker.heroes) {
          if (capHero.hp > 0) continue;
          const gsCapHero = gd.heroes[capHero.heroId];
          if (gsCapHero) {
            gsCapHero.location = defCityId;
            gsCapHero.status = 'idle';
            gsCapHero.hp = 10;
            gsCapHero.troops = 0;
            if (defCity.heroes.indexOf(capHero.heroId) === -1) defCity.heroes.push(capHero.heroId);
          }
        }
        defCity.troops = gd.getCityTotalTroops(defCityId);
      }
    }

    gd.battle = null;
    gd.phase = 'strategic';
  },

  _applyAdvisorSkills() {
    const events = [];
    const sides = [
      { heroes: this.state.attacker.heroes, opponent: this.state.defender.heroes, label: 'attacker' },
      { heroes: this.state.defender.heroes, opponent: this.state.attacker.heroes, label: 'defender' }
    ];

    for (const side of sides) {
      for (const hero of side.heroes) {
        if (!hero.advisorSkill) continue;
        const skillData = SKILLS_DATA[hero.advisorSkill];
        if (!skillData || skillData.type !== 'advisor') continue;
        const heroData = gd.heroes[hero.heroId];
        const name = heroData ? heroData.name : hero.heroId;

        if (hero.advisorSkill === 'jimou') {
          for (const h of side.heroes) h.morale = Math.min(200, h.morale + 10);
        } else if (hero.advisorSkill === 'guwu') {
          for (const h of side.heroes) h.morale = Math.min(200, h.morale + 15);
        } else if (hero.advisorSkill === 'yaohuo') {
          for (const h of side.opponent) h.morale = Math.max(10, h.morale - 10);
        }

        events.push({
          type: 'advisorSkill',
          skillId: hero.advisorSkill,
          skillName: skillData.name,
          side: side.label,
          sourceName: name
        });
      }
    }
    return events;
  },

  _checkWinCondition() {
    const alive = (list) => list.some((h) => h.hp > 0 || h.troops > 0);
    const atkAllDead = !alive(this.state.attacker.heroes);
    const defAllDead = !alive(this.state.defender.heroes);
    if (atkAllDead) { this.state.winner = 'defender'; return true; }
    if (defAllDead) { this.state.winner = 'attacker'; return true; }
    return false;
  },

  forceEndByTimeout() {
    const score = (list) => list.reduce(
      (sum, h) => sum + (h.hp > 0 || h.troops > 0 ? h.hp + h.troops : 0), 0);
    const atkScore = score(this.state.attacker.heroes);
    const defScore = score(this.state.defender.heroes);
    this.state.winner = atkScore >= defScore ? 'attacker' : 'defender';
    this.state.phase = 'ended';
    this._addLog('战斗超时，按剩余战力判定胜负！');
  },

  _checkDestiny(hero, heroData, heroName, side) {
    if (this.state.destinyTriggered[side]) return null;
    if (!heroData || !heroData.isMonarch) return null;
    if (hero.maxHp <= 0) return null;
    const threshold = Math.floor(hero.maxHp * MONARCH_HP_FLOOR_RATIO);
    // HP <= 10% 阈值时触发（含 HP 已被打到 0 的情况）
    if (hero.hp > threshold) return null;

    // 1. 锁血：HP 固定在 10% 阈值，持续到战斗结束
    hero.hp = threshold;
    hero.destinyLocked = true;

    // 2. 全属性提升 300%：士气 400%，兵力上限 ×4 并回满
    hero.morale = 400;
    hero.maxTroops = Math.floor(hero.maxTroops * 4);
    hero.troops = hero.maxTroops;

    // 3. 天降陨石：清空所有敌军士兵
    const opposeHeroes = side === 'attacker' ? this.state.defender.heroes : this.state.attacker.heroes;
    const meteorTargets = [];
    for (const enemy of opposeHeroes) {
      if (enemy.hp <= 0 && enemy.troops <= 0) continue;
      const killedTroops = enemy.troops;
      enemy.troops = 0;
      meteorTargets.push({
        heroId: enemy.heroId,
        name: (gd.heroes[enemy.heroId] || {}).name || enemy.heroId,
        killedTroops
      });
    }

    // 友军士气提升
    const allyHeroes = side === 'attacker' ? this.state.attacker.heroes : this.state.defender.heroes;
    for (const ally of allyHeroes) {
      if (ally !== hero) ally.morale = Math.min(400, ally.morale + 100);
    }

    this.state.destinyTriggered[side] = true;
    this._addLog(`【天命觉醒】${heroName} HP锁血至${threshold}（持续到战斗结束），天降陨石砸死所有敌军士兵，全属性提升300%！`);
    return {
      type: 'destiny',
      heroName,
      side,
      lockedHp: threshold,
      meteorTargets,
      statBoost: '300%'
    };
  },

  _addLog(msg) {
    if (!this.state) return;
    this.state.log.push({ turn: this.state.turn, msg });
    // 只保留最近 50 条，避免存档体积膨胀
    if (this.state.log.length > 50) this.state.log.shift();
  }
};

export default Engine;