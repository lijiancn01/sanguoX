// 三国群英传 - AI势力决策
window.SG = window.SG || {};

(function() {
  'use strict';

  var GS = function() { return window.SG.GameState; };

  var AIController = {

    // AI回合行动
    takeTurn: function(faction) {
      var gs = GS();
      var fac = gs.factions[faction];
      if (!fac) return;

      var cities = gs.getFactionCities(faction);

      // 每座城市的行动
      for (var i = 0; i < cities.length; i++) {
        var city = cities[i];

        // 1. 分配武将开发最弱属性
        this._assignDevelopment(city, faction);

        // 2. 兵力不足时征兵
        var totalTroops = gs._getCityTotalTroops(city.id);
        if (totalTroops < city.maxTroops * 0.5) {
          var recruitAmount = Math.floor(city.maxTroops * 0.2);
          var goldCost = Math.floor(recruitAmount * 0.5);
          var foodCost = Math.floor(recruitAmount * 0.3);
          if (fac.gold >= goldCost && fac.food >= foodCost) {
            window.SG.CityManager.recruit(city.id, recruitAmount);
          }
        }

        // 3. 士气低时训练
        if (city.morale < 70) {
          var trainer = this._findIdleHero(city, 'command');
          if (trainer) {
            window.SG.CityManager.train(city.id, trainer.id);
          }
        }

        // 4. 搜索在野武将
        if (city.heroes.length > 0) {
          var searcher = this._chooseSearchHero(city);
          if (searcher) {
            window.SG.CityManager.search(city.id, searcher.id);
          }
        }
      }

      // 5-7. 进攻决策
      var attackDecision = this._chooseAttackTarget(faction);
      if (attackDecision) {
        window.SG.CityManager.dispatchArmy(
          attackDecision.fromCityId,
          attackDecision.heroIds,
          attackDecision.targetCityId
        );
      }
    },

    // 为城市分配开发武将
    _assignDevelopment: function(city, faction) {
      var gs = GS();
      // 检查是否已有开发分配
      if (city.developAssign.agriculture && city.developAssign.commerce) return;

      // 找出空闲武将中政治最高的
      var idleHeroes = [];
      for (var i = 0; i < city.heroes.length; i++) {
        var h = gs.heroes[city.heroes[i]];
        if (h && h.status === 'idle') {
          idleHeroes.push(h);
        }
      }
      if (idleHeroes.length === 0) return;

      // 按政治值排序
      idleHeroes.sort(function(a, b) { return b.politics - a.politics; });

      // 分配开发最弱属性
      if (!city.developAssign.agriculture && !city.developAssign.commerce) {
        // 两个都空，先开发最弱的
        var target = this._chooseDevelopTarget(city);
        window.SG.CityManager.develop(city.id, idleHeroes[0].id, target);
        idleHeroes.shift();
        if (idleHeroes.length === 0) return;
      }

      if (!city.developAssign.agriculture) {
        window.SG.CityManager.develop(city.id, idleHeroes[0].id, 'agriculture');
        idleHeroes.shift();
      }
      if (idleHeroes.length > 0 && !city.developAssign.commerce) {
        window.SG.CityManager.develop(city.id, idleHeroes[0].id, 'commerce');
      }
    },

    // 评估城市威胁度
    _evaluateCityThreat: function(cityId) {
      var gs = GS();
      var city = gs.cities[cityId];
      if (!city) return 0;

      var threat = 0;
      // 检查相邻城市的敌军兵力
      for (var i = 0; i < city.adjacent.length; i++) {
        var adj = gs.cities[city.adjacent[i]];
        if (!adj) continue;
        if (adj.faction !== city.faction && adj.faction !== 'none') {
          threat += gs._getCityTotalTroops(adj.id);
        }
      }
      return threat;
    },

    // 选择开发目标
    _chooseDevelopTarget: function(city) {
      if (city.agriculture <= city.commerce) {
        return 'agriculture';
      }
      return 'commerce';
    },

    // 选择搜索武将
    _chooseSearchHero: function(city) {
      var gs = GS();
      // 找空闲且魅力最高的武将
      var best = null;
      var bestCharisma = 0;
      for (var i = 0; i < city.heroes.length; i++) {
        var h = gs.heroes[city.heroes[i]];
        if (h && h.status === 'idle' && h.charisma > bestCharisma) {
          bestCharisma = h.charisma;
          best = h;
        }
      }
      return best;
    },

    // 选择进攻目标
    _chooseAttackTarget: function(faction) {
      var gs = GS();
      var fac = gs.factions[faction];
      if (!fac) return null;

      var cities = gs.getFactionCities(faction);

      // 找最强城市（兵力>5000且2+武将）
      var bestCity = null;
      var bestTroops = 5000;
      for (var i = 0; i < cities.length; i++) {
        var city = cities[i];
        var totalTroops = gs._getCityTotalTroops(city.id);
        if (totalTroops > bestTroops && city.heroes.length >= 2) {
          // 排除所有武将都在开发中的情况
          var idleCount = 0;
          var idleHeroes = [];
          for (var j = 0; j < city.heroes.length; j++) {
            var h = gs.heroes[city.heroes[j]];
            if (h && h.status === 'idle') {
              idleCount++;
              idleHeroes.push(h);
            }
          }
          if (idleCount >= 2) {
            bestTroops = totalTroops;
            bestCity = city;
          }
        }
      }

      if (!bestCity) return null;

      // 找最弱的相邻敌方城市
      var weakestTarget = null;
      var weakestDef = Infinity;
      for (var k = 0; k < bestCity.adjacent.length; k++) {
        var adj = gs.cities[bestCity.adjacent[k]];
        if (!adj || adj.faction === faction || adj.faction === 'none') continue;

        var defTroops = gs._getCityTotalTroops(adj.id);
        if (defTroops < weakestDef) {
          weakestDef = defTroops;
          weakestTarget = adj;
        }
      }

      if (!weakestTarget) return null;

      // 判断是否进攻：攻方兵力 > 守方 * 1.5
      if (bestTroops > weakestDef * 1.5) {
        // 选择出征武将（最多选3个空闲的）
        var heroIds = [];
        var selectedTroops = 0;
        for (var m = 0; m < bestCity.heroes.length && heroIds.length < 3; m++) {
          var hero = gs.heroes[bestCity.heroes[m]];
          if (hero && hero.status === 'idle' && hero.troops > 0) {
            heroIds.push(hero.id);
            selectedTroops += hero.troops;
          }
        }

        // 最终确认兵力优势
        if (heroIds.length >= 2 && selectedTroops > weakestDef * 1.5) {
          return {
            fromCityId: bestCity.id,
            heroIds: heroIds,
            targetCityId: weakestTarget.id
          };
        }
      }

      return null;
    },

    // 查找城市中某属性最高的空闲武将
    _findIdleHero: function(city, stat) {
      var gs = GS();
      var best = null;
      var bestVal = 0;
      for (var i = 0; i < city.heroes.length; i++) {
        var h = gs.heroes[city.heroes[i]];
        if (h && h.status === 'idle' && h[stat] > bestVal) {
          bestVal = h[stat];
          best = h;
        }
      }
      return best;
    }
  };

  window.SG.AIController = AIController;

})();
