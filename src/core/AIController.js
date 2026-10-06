/**
 * 三国群英传 - AI 势力决策（引擎无关层）
 *
 * 通过 setGameData() 注入状态容器，避免与 GameData 的 ESM 循环依赖。
 * @author jian.li
 */

import {
  RECRUIT_GOLD_PER,
  RECRUIT_FOOD_PER,
  AI_MIN_ATTACK_TROOPS,
  AI_ATTACK_ADVANTAGE
} from './config.js';

let gd = null;

/**
 * 注入 GameData 实例。
 * @param {object} gameData
 */
export function setGameData(gameData) {
  gd = gameData;
}

const AIController = {
  takeTurn(faction) {
    if (!gd) return;
    const fac = gd.factions[faction];
    if (!fac) return;
    const cities = gd.getFactionCities(faction);

    for (const city of cities) {
      // 内政开发
      this._assignDevelopment(city);

      // 征兵：兵力低于半数时补足两成
      const totalTroops = gd.getCityTotalTroops(city.id);
      if (totalTroops < city.maxTroops * 0.5) {
        const recruitAmount = Math.floor(city.maxTroops * 0.2);
        const goldCost = Math.floor(recruitAmount * RECRUIT_GOLD_PER);
        const foodCost = Math.floor(recruitAmount * RECRUIT_FOOD_PER);
        if (fac.gold >= goldCost && fac.food >= foodCost) {
          gd.recruit(city.id, recruitAmount);
        }
      }

      // 训练：士气不足时由指挥值最高的闲置武将练兵
      if (city.morale < 70) {
        const trainer = this._findIdleHero(city, 'command');
        if (trainer) gd.train(city.id, trainer.id);
      }

      // 搜索在野武将
      if (city.heroes.length > 0) {
        const searcher = this._chooseSearchHero(city);
        if (searcher) gd.search(city.id, searcher.id);
      }
    }

    // 进攻
    const attackDecision = this._chooseAttackTarget(faction);
    if (attackDecision) {
      gd.dispatchArmy(attackDecision.fromCityId, attackDecision.heroIds, attackDecision.targetCityId);
    }
  },

  _assignDevelopment(city) {
    if (city.developAssign.agriculture && city.developAssign.commerce) return;
    const idleHeroes = [];
    for (const hid of city.heroes) {
      const h = gd.heroes[hid];
      if (h && h.status === 'idle') idleHeroes.push(h);
    }
    if (idleHeroes.length === 0) return;
    idleHeroes.sort((a, b) => b.politics - a.politics);

    if (!city.developAssign.agriculture && !city.developAssign.commerce) {
      const target = city.agriculture <= city.commerce ? 'agriculture' : 'commerce';
      gd.develop(city.id, idleHeroes[0].id, target);
      idleHeroes.shift();
      if (idleHeroes.length === 0) return;
    }
    if (!city.developAssign.agriculture) {
      gd.develop(city.id, idleHeroes[0].id, 'agriculture');
      idleHeroes.shift();
    }
    if (idleHeroes.length > 0 && !city.developAssign.commerce) {
      gd.develop(city.id, idleHeroes[0].id, 'commerce');
    }
  },

  /**
   * 选择进攻目标：优先空城（在野），其次兵力最少的敌城。
   * 空城无需战斗即可占领，因此不再被过滤掉。
   */
  _chooseAttackTarget(faction) {
    const cities = gd.getFactionCities(faction);
    let bestCity = null;
    let bestTroops = AI_MIN_ATTACK_TROOPS;
    for (const city of cities) {
      const totalTroops = gd.getCityTotalTroops(city.id);
      if (totalTroops <= bestTroops || city.heroes.length < 2) continue;
      const idleHeroes = city.heroes
        .map((hid) => gd.heroes[hid])
        .filter((h) => h && h.status === 'idle' && h.troops > 0);
      if (idleHeroes.length >= 2) {
        bestTroops = totalTroops;
        bestCity = city;
      }
    }
    if (!bestCity) return null;

    let weakestTarget = null;
    let weakestDef = Infinity;
    for (const adjId of bestCity.adjacent) {
      const adj = gd.cities[adjId];
      if (!adj || adj.faction === faction) continue;
      // 空城守军为 0，是最优先的扩张目标
      const defTroops = gd.getCityTotalTroops(adj.id);
      if (defTroops < weakestDef) {
        weakestDef = defTroops;
        weakestTarget = adj;
      }
    }
    if (!weakestTarget) return null;

    // 空城无需兵力优势；有守城时要求 1.5 倍兵力优势
    const requiredAdvantage = weakestTarget.heroes.length === 0 ? 0 : AI_ATTACK_ADVANTAGE;
    if (bestTroops <= weakestDef * requiredAdvantage) return null;

    const heroIds = [];
    let selectedTroops = 0;
    for (const hid of bestCity.heroes) {
      if (heroIds.length >= 3) break;
      const hero = gd.heroes[hid];
      if (hero && hero.status === 'idle' && hero.troops > 0) {
        heroIds.push(hero.id);
        selectedTroops += hero.troops;
      }
    }
    if (heroIds.length < 2) return null;
    if (selectedTroops <= weakestDef * requiredAdvantage) return null;

    return { fromCityId: bestCity.id, heroIds, targetCityId: weakestTarget.id };
  },

  _chooseSearchHero(city) {
    let best = null;
    let bestCharisma = 0;
    for (const hid of city.heroes) {
      const h = gd.heroes[hid];
      if (h && h.status === 'idle' && h.charisma > bestCharisma) {
        bestCharisma = h.charisma;
        best = h;
      }
    }
    return best;
  },

  _findIdleHero(city, stat) {
    let best = null;
    let bestVal = 0;
    for (const hid of city.heroes) {
      const h = gd.heroes[hid];
      if (h && h.status === 'idle' && h[stat] > bestVal) {
        bestVal = h[stat];
        best = h;
      }
    }
    return best;
  }
};

export default AIController;