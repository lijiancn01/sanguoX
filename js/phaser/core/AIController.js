/**
 * 三国群英传 - AI势力决策
 * @author jian.li
 */
window.SG3 = window.SG3 || {};

(function() {
  'use strict';

  var GD = function() { return window.SG3.GameData; };

  var AIController = {

    takeTurn: function(faction) {
      var gd = GD();
      var fac = gd.factions[faction];
      if (!fac) return;
      var cities = gd.getFactionCities(faction);

      for (var i = 0; i < cities.length; i++) {
        var city = cities[i];
        // 开发
        this._assignDevelopment(city, faction);
        // 征兵
        var totalTroops = gd.getCityTotalTroops(city.id);
        if (totalTroops < city.maxTroops * 0.5) {
          var recruitAmount = Math.floor(city.maxTroops * 0.2);
          var goldCost = Math.floor(recruitAmount * 0.5);
          var foodCost = Math.floor(recruitAmount * 0.3);
          if (fac.gold >= goldCost && fac.food >= foodCost) {
            gd.recruit(city.id, recruitAmount);
          }
        }
        // 训练
        if (city.morale < 70) {
          var trainer = this._findIdleHero(city, 'command');
          if (trainer) gd.train(city.id, trainer.id);
        }
        // 搜索
        if (city.heroes.length > 0) {
          var searcher = this._chooseSearchHero(city);
          if (searcher) gd.search(city.id, searcher.id);
        }
      }

      // 进攻
      var attackDecision = this._chooseAttackTarget(faction);
      if (attackDecision) {
        gd.dispatchArmy(attackDecision.fromCityId, attackDecision.heroIds, attackDecision.targetCityId);
      }
    },

    _assignDevelopment: function(city, faction) {
      var gd = GD();
      if (city.developAssign.agriculture && city.developAssign.commerce) return;
      var idleHeroes = [];
      for (var i = 0; i < city.heroes.length; i++) {
        var h = gd.heroes[city.heroes[i]];
        if (h && h.status === 'idle') idleHeroes.push(h);
      }
      if (idleHeroes.length === 0) return;
      idleHeroes.sort(function(a, b) { return b.politics - a.politics; });
      if (!city.developAssign.agriculture && !city.developAssign.commerce) {
        var target = city.agriculture <= city.commerce ? 'agriculture' : 'commerce';
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

    _chooseAttackTarget: function(faction) {
      var gd = GD();
      var cities = gd.getFactionCities(faction);
      var bestCity = null, bestTroops = 5000;
      for (var i = 0; i < cities.length; i++) {
        var city = cities[i];
        var totalTroops = gd.getCityTotalTroops(city.id);
        if (totalTroops > bestTroops && city.heroes.length >= 2) {
          var idleHeroes = [];
          for (var j = 0; j < city.heroes.length; j++) {
            var h = gd.heroes[city.heroes[j]];
            if (h && h.status === 'idle' && h.troops > 0) idleHeroes.push(h);
          }
          if (idleHeroes.length >= 2) { bestTroops = totalTroops; bestCity = city; }
        }
      }
      if (!bestCity) return null;

      var weakestTarget = null, weakestDef = Infinity;
      for (var k = 0; k < bestCity.adjacent.length; k++) {
        var adj = gd.cities[bestCity.adjacent[k]];
        if (!adj || adj.faction === faction || adj.faction === 'none') continue;
        var defTroops = gd.getCityTotalTroops(adj.id);
        if (defTroops < weakestDef) { weakestDef = defTroops; weakestTarget = adj; }
      }
      if (!weakestTarget) return null;
      if (bestTroops > weakestDef * 1.5) {
        var heroIds = [], selectedTroops = 0;
        for (var m = 0; m < bestCity.heroes.length && heroIds.length < 3; m++) {
          var hero = gd.heroes[bestCity.heroes[m]];
          if (hero && hero.status === 'idle' && hero.troops > 0) {
            heroIds.push(hero.id); selectedTroops += hero.troops;
          }
        }
        if (heroIds.length >= 2 && selectedTroops > weakestDef * 1.5) {
          return { fromCityId: bestCity.id, heroIds: heroIds, targetCityId: weakestTarget.id };
        }
      }
      return null;
    },

    _chooseSearchHero: function(city) {
      var gd = GD();
      var best = null, bestCharisma = 0;
      for (var i = 0; i < city.heroes.length; i++) {
        var h = gd.heroes[city.heroes[i]];
        if (h && h.status === 'idle' && h.charisma > bestCharisma) { bestCharisma = h.charisma; best = h; }
      }
      return best;
    },

    _findIdleHero: function(city, stat) {
      var gd = GD();
      var best = null, bestVal = 0;
      for (var i = 0; i < city.heroes.length; i++) {
        var h = gd.heroes[city.heroes[i]];
        if (h && h.status === 'idle' && h[stat] > bestVal) { bestVal = h[stat]; best = h; }
      }
      return best;
    }
  };

  window.SG3.AIController = AIController;
})();
