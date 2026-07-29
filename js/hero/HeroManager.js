// 三国群英传 - 武将管理
window.SG = window.SG || {};

(function() {
  'use strict';

  var GS = function() { return window.SG.GameState; };

  var HeroManager = {

    // 获取武将信息
    getHero: function(heroId) {
      var gs = GS();
      return gs.heroes[heroId] || null;
    },

    // 获取武将战斗力评估
    getPower: function(heroId) {
      var hero = this.getHero(heroId);
      if (!hero) return 0;
      return Math.floor(hero.force * 0.3 + hero.intellect * 0.2 + hero.command * 0.3 + hero.troops / 100);
    },

    // 武将升级（增加经验，检查升级）
    addExp: function(heroId, amount) {
      var gs = GS();
      var hero = gs.heroes[heroId];
      if (!hero) return { ok: false, msg: '武将不存在' };
      if (amount <= 0) return { ok: false, msg: '经验值无效' };

      hero.exp += amount;

      // 检查升级
      var expNeeded = hero.level * 100;
      var leveledUp = false;
      while (hero.exp >= expNeeded) {
        hero.exp -= expNeeded;
        hero.level++;
        leveledUp = true;

        // +2 随机属性
        var stats = ['force', 'intellect', 'politics', 'command', 'charisma'];
        for (var i = 0; i < 2; i++) {
          var stat = stats[Math.floor(Math.random() * stats.length)];
          hero[stat] += 1;
        }

        // +500 最大兵力，+10 最大技力，+20 最大HP
        hero.maxTroops += 500;
        hero.maxSp += 10;
        hero.maxHp += 20;

        // 恢复满HP和SP
        hero.hp = hero.maxHp;
        hero.sp = hero.maxSp;

        expNeeded = hero.level * 100;
      }

      if (leveledUp) {
        return { ok: true, msg: hero.name + ' 升级到 ' + hero.level + ' 级！', level: hero.level };
      }
      return { ok: true, msg: hero.name + ' 获得 ' + amount + ' 经验' };
    },

    // 改变武将忠诚度
    changeLoyalty: function(heroId, amount) {
      var gs = GS();
      var hero = gs.heroes[heroId];
      if (!hero) return { ok: false, msg: '武将不存在' };

      hero.loyalty = Math.max(0, Math.min(100, hero.loyalty + amount));

      // 忠诚度过低且在敌方城市，有概率叛变
      if (hero.loyalty < 20 && hero.location) {
        var city = gs.cities[hero.location];
        if (city && city.faction !== hero.faction) {
          var defectChance = (20 - hero.loyalty) * 2;
          if (Math.random() * 100 < defectChance) {
            hero.faction = city.faction;
            hero.loyalty = 50;
            return { ok: true, msg: hero.name + ' 忠诚度过低，叛变至' + (window.SG.FACTION_NAMES[city.faction] || city.faction) + '！' };
          }
        }
      }

      return { ok: true, msg: hero.name + ' 忠诚度变更' + (amount >= 0 ? '+' : '') + amount + '，当前' + hero.loyalty };
    },

    // 策反武将
    persuade: function(heroId, persuaderId) {
      var gs = GS();
      var target = gs.heroes[heroId];
      var persuader = gs.heroes[persuaderId];
      if (!target || !persuader) return { ok: false, msg: '武将不存在' };
      if (target.faction === persuader.faction) return { ok: false, msg: '不能策反己方武将' };

      // 计算策反概率
      var chance = persuader.charisma * 0.6 - target.loyalty * 0.3;
      if (chance < 0) chance = 0;

      if (Math.random() * 100 < chance) {
        // 策反成功
        var oldFaction = target.faction;
        target.faction = persuader.faction;
        target.loyalty = 50;

        // 从原城市移除
        if (target.location) {
          var city = gs.cities[target.location];
          if (city) {
            var idx = city.heroes.indexOf(heroId);
            if (idx !== -1) {
              city.heroes.splice(idx, 1);
            }
            city.troops = gs._getCityTotalTroops(target.location);
          }
          target.location = null;
          target.troops = 0;
        }

        return { ok: true, msg: persuader.name + ' 成功策反了 ' + target.name + '！' };
      }

      return { ok: false, msg: persuader.name + ' 策反 ' + target.name + ' 失败' };
    },

    // 获取武将可用技能
    getSkills: function(heroId) {
      var gs = GS();
      var hero = gs.heroes[heroId];
      if (!hero) return [];

      var result = [];
      if (hero.skills) {
        for (var i = 0; i < hero.skills.length; i++) {
          var skillData = window.SG.SKILLS_DATA[hero.skills[i]];
          if (skillData) {
            result.push(skillData);
          }
        }
      }
      // 军师技
      if (hero.advisorSkill) {
        var advSkill = window.SG.SKILLS_DATA[hero.advisorSkill];
        if (advSkill) {
          result.push(advSkill);
        }
      }
      return result;
    },

    // 改变武将势力
    changeFaction: function(heroId, newFaction) {
      var gs = GS();
      var hero = gs.heroes[heroId];
      if (!hero) return { ok: false, msg: '武将不存在' };

      var oldFaction = hero.faction;
      hero.faction = newFaction;
      hero.loyalty = 50;

      // 从原城市移除
      if (hero.location && oldFaction !== newFaction) {
        var city = gs.cities[hero.location];
        if (city && city.faction !== newFaction) {
          var idx = city.heroes.indexOf(heroId);
          if (idx !== -1) {
            city.heroes.splice(idx, 1);
          }
          city.troops = gs._getCityTotalTroops(hero.location);
          hero.location = null;
          hero.troops = 0;
        }
      }

      return { ok: true, msg: hero.name + ' 势力变更为' + (window.SG.FACTION_NAMES[newFaction] || newFaction) };
    },

    // 移动武将
    moveHero: function(heroId, targetCityId) {
      var gs = GS();
      var hero = gs.heroes[heroId];
      var targetCity = gs.cities[targetCityId];
      if (!hero) return { ok: false, msg: '武将不存在' };
      if (!targetCity) return { ok: false, msg: '目标城市不存在' };
      if (hero.faction !== targetCity.faction) return { ok: false, msg: '目标城市不属于武将势力' };
      if (hero.status !== 'idle') return { ok: false, msg: '武将状态不可移动' };
      if (!hero.location) return { ok: false, msg: '武将没有当前位置' };

      var fromCityId = hero.location;

      // 同城无需移动
      if (fromCityId === targetCityId) return { ok: false, msg: '武将已在该城市' };

      var fromCity = gs.cities[fromCityId];
      if (!fromCity) return { ok: false, msg: '出发城市不存在' };

      // 检查是否相邻或同城市
      if (fromCity.adjacent.indexOf(targetCityId) === -1) {
        return { ok: false, msg: '目标城市不相邻，无法直接移动' };
      }

      // 从原城市移除
      var idx = fromCity.heroes.indexOf(heroId);
      if (idx !== -1) {
        fromCity.heroes.splice(idx, 1);
      }
      fromCity.troops = gs._getCityTotalTroops(fromCityId);

      // 加入目标城市
      hero.location = targetCityId;
      if (targetCity.heroes.indexOf(heroId) === -1) {
        targetCity.heroes.push(heroId);
      }
      targetCity.troops = gs._getCityTotalTroops(targetCityId);

      return { ok: true, msg: hero.name + ' 从' + fromCity.name + '移动到' + targetCity.name };
    }
  };

  window.SG.HeroManager = HeroManager;

})();
