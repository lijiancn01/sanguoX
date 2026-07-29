// 三国群英传 - 城市治理管理
window.SG = window.SG || {};

(function() {
  'use strict';

  var GS = function() { return window.SG.GameState; };

  var CityManager = {

    // 开发：分配武将开发农业或商业
    // target: 'agriculture' 或 'commerce'
    develop: function(cityId, heroId, target) {
      var gs = GS();
      var city = gs.cities[cityId];
      var hero = gs.heroes[heroId];
      if (!city || !hero) return { ok: false, msg: '城市或武将不存在' };
      if (hero.faction !== city.faction) return { ok: false, msg: '武将不属于该城市势力' };
      if (hero.location !== cityId) return { ok: false, msg: '武将不在该城市' };
      if (hero.status !== 'idle') return { ok: false, msg: '武将状态不可用' };
      if (target !== 'agriculture' && target !== 'commerce') return { ok: false, msg: '开发类型无效' };

      // 如果该位置已有人，先取消
      if (city.developAssign[target]) {
        var oldHero = gs.heroes[city.developAssign[target]];
        if (oldHero) {
          oldHero.status = 'idle';
          oldHero.developTarget = null;
        }
      }

      hero.status = 'developing';
      hero.developTarget = target;
      city.developAssign[target] = heroId;
      return { ok: true, msg: hero.name + ' 开始开发' + (target === 'agriculture' ? '农业' : '商业') };
    },

    // 取消开发
    cancelDevelop: function(cityId, target) {
      var gs = GS();
      var city = gs.cities[cityId];
      if (!city) return { ok: false, msg: '城市不存在' };
      if (target !== 'agriculture' && target !== 'commerce') return { ok: false, msg: '开发类型无效' };

      var heroId = city.developAssign[target];
      if (!heroId) return { ok: false, msg: '该方向无开发武将' };

      var hero = gs.heroes[heroId];
      if (hero) {
        hero.status = 'idle';
        hero.developTarget = null;
      }
      city.developAssign[target] = null;
      return { ok: true, msg: '已取消开发' };
    },

    // 征兵
    recruit: function(cityId, amount) {
      var gs = GS();
      var city = gs.cities[cityId];
      if (!city) return { ok: false, msg: '城市不存在' };
      if (city.faction === 'none') return { ok: false, msg: '在野城市无法征兵' };
      if (amount <= 0) return { ok: false, msg: '征兵数量必须大于0' };

      var faction = gs.factions[city.faction];
      if (!faction) return { ok: false, msg: '势力不存在' };

      // 计算消耗
      var goldCost = Math.floor(amount * 0.5);
      var foodCost = Math.floor(amount * 0.3);
      if (faction.gold < goldCost) return { ok: false, msg: '金币不足，需要' + goldCost };
      if (faction.food < foodCost) return { ok: false, msg: '粮食不足，需要' + foodCost };

      // 检查兵力上限
      var currentTroops = gs._getCityTotalTroops(cityId);
      if (currentTroops + amount > city.maxTroops) {
        amount = city.maxTroops - currentTroops;
        if (amount <= 0) return { ok: false, msg: '城市兵力已达上限' };
        // 重新计算消耗
        goldCost = Math.floor(amount * 0.5);
        foodCost = Math.floor(amount * 0.3);
      }

      // 扣除资源
      faction.gold -= goldCost;
      faction.food -= foodCost;

      // 将兵力分配给城内空闲武将
      var idleHeroes = [];
      for (var i = 0; i < city.heroes.length; i++) {
        var h = gs.heroes[city.heroes[i]];
        if (h && h.troops < h.maxTroops) {
          idleHeroes.push(h);
        }
      }

      if (idleHeroes.length === 0) {
        // 没有可分配武将，退还资源
        faction.gold += goldCost;
        faction.food += foodCost;
        return { ok: false, msg: '没有可分配兵力的武将' };
      }

      var remaining = amount;
      for (var j = 0; j < idleHeroes.length && remaining > 0; j++) {
        var hero = idleHeroes[j];
        var canAdd = hero.maxTroops - hero.troops;
        var add = Math.min(remaining, canAdd);
        hero.troops += add;
        remaining -= add;
      }

      // 更新城市兵力
      city.troops = gs._getCityTotalTroops(cityId);

      // 降低士气
      city.morale = Math.max(0, city.morale - Math.floor(amount * 0.001));

      return { ok: true, msg: '征兵' + (amount - remaining) + '人，消耗金币' + goldCost + '，粮食' + foodCost };
    },

    // 搜索在野武将
    search: function(cityId, heroId) {
      var gs = GS();
      var city = gs.cities[cityId];
      var hero = gs.heroes[heroId];
      if (!city || !hero) return { ok: false, msg: '城市或武将不存在' };
      if (hero.faction !== city.faction) return { ok: false, msg: '武将不属于该城市势力' };
      if (hero.location !== cityId) return { ok: false, msg: '武将不在该城市' };
      if (hero.status !== 'idle') return { ok: false, msg: '武将状态不可用' };

      // 查找在野武将（faction='none' 且 location=null）
      var available = [];
      for (var id in gs.heroes) {
        if (!gs.heroes.hasOwnProperty(id)) continue;
        var h = gs.heroes[id];
        if (h.faction === 'none' && !h.location) {
          available.push(h);
        }
      }

      if (available.length === 0) {
        return { ok: false, msg: '附近没有在野武将' };
      }

      // 计算搜索概率
      var chance = hero.charisma * 0.5 + 10;
      if (Math.random() * 100 > chance) {
        hero.exp += 5;
        return { ok: false, msg: hero.name + ' 搜索未发现武将' };
      }

      // 随机选一个在野武将
      var found = available[Math.floor(Math.random() * available.length)];
      found.faction = city.faction;
      found.location = cityId;
      found.status = 'idle';
      found.loyalty = 50;
      city.heroes.push(found.id);

      hero.exp += 10;
      return { ok: true, msg: hero.name + ' 发现了在野武将 ' + found.name + '！' };
    },

    // 训练：提升城市士气
    train: function(cityId, heroId) {
      var gs = GS();
      var city = gs.cities[cityId];
      var hero = gs.heroes[heroId];
      if (!city || !hero) return { ok: false, msg: '城市或武将不存在' };
      if (hero.faction !== city.faction) return { ok: false, msg: '武将不属于该城市势力' };
      if (hero.location !== cityId) return { ok: false, msg: '武将不在该城市' };
      if (hero.status !== 'idle') return { ok: false, msg: '武将状态不可用' };

      var increase = Math.floor(hero.command * 0.3);
      if (increase <= 0) increase = 1;
      var oldMorale = city.morale;
      city.morale = Math.min(100, city.morale + increase);
      var actual = city.morale - oldMorale;

      hero.exp += 5;
      return { ok: true, msg: hero.name + ' 训练部队，士气提升' + actual };
    },

    // 出兵：从城市派兵进攻目标城市
    dispatchArmy: function(fromCityId, heroIds, targetCityId) {
      var gs = GS();
      var fromCity = gs.cities[fromCityId];
      var toCity = gs.cities[targetCityId];
      if (!fromCity) return { ok: false, msg: '出发城市不存在' };
      if (!toCity) return { ok: false, msg: '目标城市不存在' };

      // 检查是否相邻
      if (fromCity.adjacent.indexOf(targetCityId) === -1) {
        return { ok: false, msg: '目标城市不相邻，无法出兵' };
      }

      // 检查不能进攻己方城市
      if (toCity.faction === fromCity.faction) {
        return { ok: false, msg: '不能进攻友方城市' };
      }

      if (!heroIds || heroIds.length === 0) return { ok: false, msg: '未选择出征武将' };

      // 验证武将
      var validHeroIds = [];
      var totalTroops = 0;
      for (var i = 0; i < heroIds.length; i++) {
        var hero = gs.heroes[heroIds[i]];
        if (!hero) continue;
        if (hero.location !== fromCityId) continue;
        if (hero.faction !== fromCity.faction) continue;
        if (hero.status !== 'idle') continue;
        if (hero.troops <= 0) continue;
        validHeroIds.push(heroIds[i]);
        totalTroops += hero.troops;
      }

      if (validHeroIds.length === 0) return { ok: false, msg: '没有可出征的武将' };
      if (totalTroops <= 0) return { ok: false, msg: '出征兵力不足' };

      // 从出发城市移除武将
      for (var j = 0; j < validHeroIds.length; j++) {
        var hid = validHeroIds[j];
        var h = gs.heroes[hid];
        h.status = 'marching';
        h.location = null;
        var idx = fromCity.heroes.indexOf(hid);
        if (idx !== -1) {
          fromCity.heroes.splice(idx, 1);
        }
      }

      // 更新出发城市兵力
      fromCity.troops = gs._getCityTotalTroops(fromCityId);

      // 创建行军军队
      var army = {
        id: 'army_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        faction: fromCity.faction,
        heroIds: validHeroIds,
        fromCity: fromCityId,
        targetCity: targetCityId,
        turnsLeft: 1,
        speed: 1
      };
      gs.armies.push(army);

      return { ok: true, msg: '出兵' + validHeroIds.length + '名武将，兵力' + totalTroops + '，进攻' + toCity.name };
    },

    // 获取城市详情
    getCityDetail: function(cityId) {
      var gs = GS();
      var city = gs.cities[cityId];
      if (!city) return null;

      // 驻守武将信息
      var stationedHeroes = [];
      for (var i = 0; i < city.heroes.length; i++) {
        var hero = gs.heroes[city.heroes[i]];
        if (hero) {
          stationedHeroes.push({
            id: hero.id,
            name: hero.name,
            status: hero.status,
            troops: hero.troops,
            maxTroops: hero.maxTroops
          });
        }
      }

      // 开发分配信息
      var devAssign = {};
      for (var target in city.developAssign) {
        if (!city.developAssign.hasOwnProperty(target)) continue;
        var devHeroId = city.developAssign[target];
        if (devHeroId && gs.heroes[devHeroId]) {
          devAssign[target] = { id: devHeroId, name: gs.heroes[devHeroId].name };
        } else {
          devAssign[target] = null;
        }
      }

      // 可用操作
      var actions = [];
      if (city.faction !== 'none') {
        actions.push('develop', 'recruit', 'train', 'search');
        // 检查是否有相邻敌方城市可出兵
        for (var k = 0; k < city.adjacent.length; k++) {
          var adjCity = gs.cities[city.adjacent[k]];
          if (adjCity && adjCity.faction !== city.faction) {
            actions.push('dispatch');
            break;
          }
        }
      }

      return {
        id: city.id,
        name: city.name,
        faction: city.faction,
        agriculture: city.agriculture,
        commerce: city.commerce,
        morale: city.morale,
        defense: city.defense,
        troops: gs._getCityTotalTroops(cityId),
        maxTroops: city.maxTroops,
        adjacent: city.adjacent,
        region: city.region,
        developAssign: devAssign,
        heroes: stationedHeroes,
        actions: actions
      };
    }
  };

  window.SG.CityManager = CityManager;

})();
