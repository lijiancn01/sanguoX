// 三国群英传 - 全局游戏状态管理
window.SG = window.SG || {};

(function() {
  'use strict';

  var SAVE_PREFIX = 'sg_save_';

  var GS = {

    // ===== 状态 =====
    turn: 1,
    phase: 'strategic',  // strategic, marching, battle, event
    playerFaction: 'shu',
    factions: {
      wei:  { gold: 500, food: 500 },
      shu:  { gold: 400, food: 400 },
      wu:   { gold: 400, food: 400 },
      qun:  { gold: 200, food: 200 }
    },
    cities: {},    // 以城市id为键
    heroes: {},    // 以武将id为键
    armies: [],    // 行军中的军队
    battle: null,  // 当前战斗状态

    // ===== 初始化 =====
    init: function() {
      this.turn = 1;
      this.phase = 'strategic';
      this.armies = [];
      this.battle = null;
      this.customFactionId = null;

      // 初始化势力资源
      this.factions = {
        wei:  { gold: 500, food: 500 },
        shu:  { gold: 400, food: 400 },
        wu:   { gold: 400, food: 400 },
        qun:  { gold: 200, food: 200 }
      };

      // 深拷贝城市数据，添加运行时字段
      this.cities = {};
      for (var i = 0; i < window.SG.CITIES_DATA.length; i++) {
        var cd = window.SG.CITIES_DATA[i];
        var city = {};
        for (var key in cd) {
          if (cd.hasOwnProperty(key)) {
            // heroes 数组需要拷贝，但先保留原始hero id列表
            if (key === 'heroes') {
              city[key] = cd[key].slice();
            } else {
              city[key] = cd[key];
            }
          }
        }
        // 运行时字段
        city.developAssign = { agriculture: null, commerce: null };
        this.cities[city.id] = city;
      }

      // 深拷贝武将数据，添加运行时字段
      this.heroes = {};
      for (var j = 0; j < window.SG.HEROES_DATA.length; j++) {
        var hd = window.SG.HEROES_DATA[j];
        var hero = {};
        for (var hKey in hd) {
          if (hd.hasOwnProperty(hKey)) {
            if (hKey === 'skills') {
              hero[hKey] = hd[hKey].slice();
            } else {
              hero[hKey] = hd[hKey];
            }
          }
        }
        // 运行时字段
        hero.troops = 0;
        hero.location = null;
        hero.status = 'idle';
        hero.hp = 100;
        hero.maxHp = 100;
        hero.developTarget = null;
        this.heroes[hero.id] = hero;
      }

      // 分配武将到城市：设置location和troops
      this._assignHeroesToCities();
    },

    // 将武将分配到城市，并分配兵力
    _assignHeroesToCities: function() {
      var cityId, city, heroIds, heroId, hero;
      // 先将所有武将location置空
      for (heroId in this.heroes) {
        if (this.heroes.hasOwnProperty(heroId)) {
          this.heroes[heroId].location = null;
        }
      }

      // 遍历城市，将城内武将分配到对应城市
      for (cityId in this.cities) {
        if (!this.cities.hasOwnProperty(cityId)) continue;
        city = this.cities[cityId];
        heroIds = city.heroes;

        if (heroIds.length === 0) continue;

        // 按武将maxTroops比例分配城市兵力
        var totalMaxTroops = 0;
        var validHeroes = [];
        for (var i = 0; i < heroIds.length; i++) {
          hero = this.heroes[heroIds[i]];
          if (hero) {
            totalMaxTroops += hero.maxTroops;
            validHeroes.push(hero);
          }
        }

        var totalTroops = city.troops;
        var distributed = 0;
        for (var k = 0; k < validHeroes.length; k++) {
          hero = validHeroes[k];
          hero.location = cityId;
          hero.status = 'idle';
          if (totalMaxTroops > 0) {
            // 按maxTroops比例分配，取整
            var share = Math.floor(totalTroops * hero.maxTroops / totalMaxTroops);
            hero.troops = Math.min(share, hero.maxTroops);
            distributed += hero.troops;
          } else {
            // 平均分配
            hero.troops = Math.floor(totalTroops / validHeroes.length);
            distributed += hero.troops;
          }
        }

        // 余数分配给第一个武将，避免兵力丢失
        var remainder = totalTroops - distributed;
        if (remainder > 0 && validHeroes.length > 0) {
          validHeroes[0].troops += remainder;
          if (validHeroes[0].troops > validHeroes[0].maxTroops) {
            validHeroes[0].troops = validHeroes[0].maxTroops;
          }
        }
      }

      // faction为none且不在任何城市中的武将，标记为在野
      for (heroId in this.heroes) {
        if (!this.heroes.hasOwnProperty(heroId)) continue;
        hero = this.heroes[heroId];
        if (!hero.location) {
          hero.status = 'idle';
          hero.troops = 0;
        }
      }
    },

    // ===== 查询方法 =====

    // 获取某势力所有城市
    getFactionCities: function(faction) {
      var result = [];
      for (var id in this.cities) {
        if (this.cities.hasOwnProperty(id) && this.cities[id].faction === faction) {
          result.push(this.cities[id]);
        }
      }
      return result;
    },

    // 获取某势力所有武将
    getFactionHeroes: function(faction) {
      var result = [];
      for (var id in this.heroes) {
        if (this.heroes.hasOwnProperty(id) && this.heroes[id].faction === faction) {
          result.push(this.heroes[id]);
        }
      }
      return result;
    },

    // 查找武将所在城市
    getHeroLocation: function(heroId) {
      var hero = this.heroes[heroId];
      if (!hero || !hero.location) return null;
      return this.cities[hero.location] || null;
    },

    // 获取某势力金收入（商业值/10之和）
    getFactionGold: function(faction) {
      var cities = this.getFactionCities(faction);
      var total = 0;
      for (var i = 0; i < cities.length; i++) {
        total += Math.floor(cities[i].commerce / 10);
      }
      return total;
    },

    // 获取某势力粮收入（农业值/10之和）
    getFactionFood: function(faction) {
      var cities = this.getFactionCities(faction);
      var total = 0;
      for (var i = 0; i < cities.length; i++) {
        total += Math.floor(cities[i].agriculture / 10);
      }
      return total;
    },

    // ===== 回合结束 =====
    endTurn: function() {
      // 1. 收集各势力资源
      var factionIds = ['wei', 'shu', 'wu', 'qun'];
      for (var i = 0; i < factionIds.length; i++) {
        var fId = factionIds[i];
        var fac = this.factions[fId];
        if (!fac) continue;
        fac.gold += this.getFactionGold(fId);
        fac.food += this.getFactionFood(fId);
      }

      // 2. 城市发展：执行内政开发
      this._processDevelopment();

      // 3. 城市兵力自然恢复
      this._recoverCityTroops();

      // 4. 武将状态恢复
      this._recoverHeroes();

      // 5. AI行动（非玩家势力）
      this._processAITurns();

      // 6. 随机事件
      this._processRandomEvents();

      // 7. 行军中的军队推进
      this._processArmies();

      // 8. 回合数+1
      this.turn++;
      this.phase = 'strategic';
    },

    // 执行内政开发
    _processDevelopment: function() {
      for (var cityId in this.cities) {
        if (!this.cities.hasOwnProperty(cityId)) continue;
        var city = this.cities[cityId];
        var dev = city.developAssign;

        if (dev.agriculture && this.heroes[dev.agriculture]) {
          var hero = this.heroes[dev.agriculture];
          var gain = Math.floor(hero.politics / 5);
          city.agriculture = Math.min(100, city.agriculture + gain);
          hero.exp += 10;
          hero.status = 'idle';
          hero.developTarget = null;
        }
        if (dev.commerce && this.heroes[dev.commerce]) {
          var hero2 = this.heroes[dev.commerce];
          var gain2 = Math.floor(hero2.politics / 5);
          city.commerce = Math.min(100, city.commerce + gain2);
          hero2.exp += 10;
          hero2.status = 'idle';
          hero2.developTarget = null;
        }

        // 重置开发分配
        city.developAssign = { agriculture: null, commerce: null };
      }
    },

    // 城市兵力恢复
    _recoverCityTroops: function() {
      for (var cityId in this.cities) {
        if (!this.cities.hasOwnProperty(cityId)) continue;
        var city = this.cities[cityId];
        if (city.faction === 'none') continue;
        // 每回合恢复maxTroops的5%
        var recovery = Math.floor(city.maxTroops * 0.05);
        // 重新计算城市总兵力（驻守武将兵力之和）
        var currentTotal = this._getCityTotalTroops(cityId);
        var newTotal = Math.min(city.maxTroops, currentTotal + recovery);
        var diff = newTotal - currentTotal;
        if (diff > 0 && city.heroes.length > 0) {
          // 均分给所有驻守武将
          var perHero = Math.floor(diff / city.heroes.length);
          var remainder = diff - perHero * city.heroes.length;
          for (var i = 0; i < city.heroes.length; i++) {
            var hero = this.heroes[city.heroes[i]];
            if (hero) {
              var add = perHero + (i === 0 ? remainder : 0);
              hero.troops = Math.min(hero.maxTroops, hero.troops + add);
            }
          }
          city.troops = this._getCityTotalTroops(cityId);
        }
      }
    },

    // 获取城市总兵力
    _getCityTotalTroops: function(cityId) {
      var city = this.cities[cityId];
      if (!city) return 0;
      var total = 0;
      for (var i = 0; i < city.heroes.length; i++) {
        var hero = this.heroes[city.heroes[i]];
        if (hero) total += hero.troops;
      }
      return total;
    },

    // 武将恢复
    _recoverHeroes: function() {
      for (var id in this.heroes) {
        if (!this.heroes.hasOwnProperty(id)) continue;
        var hero = this.heroes[id];
        // HP恢复
        if (hero.hp < hero.maxHp) {
          hero.hp = Math.min(hero.maxHp, hero.hp + 10);
        }
        // SP恢复
        if (hero.sp < hero.maxSp) {
          hero.sp = Math.min(hero.maxSp, hero.sp + 10);
        }
        // 经验升级检查
        this._checkLevelUp(hero);
      }
    },

    // 检查武将升级
    _checkLevelUp: function(hero) {
      var expNeeded = hero.level * 100;
      while (hero.exp >= expNeeded) {
        hero.exp -= expNeeded;
        hero.level++;
        // 属性提升
        hero.maxHp += 5;
        hero.hp = hero.maxHp;
        hero.maxTroops += 500;
        hero.maxSp += 5;
        hero.sp = hero.maxSp;
        expNeeded = hero.level * 100;
      }
    },

    // AI行动
    _processAITurns: function() {
      var factionIds = ['wei', 'shu', 'wu', 'qun'];
      for (var i = 0; i < factionIds.length; i++) {
        var fId = factionIds[i];
        if (fId === this.playerFaction) continue;
        if (this.factions[fId]) {
          if (window.SG.AIController) {
            window.SG.AIController.takeTurn(fId);
          }
        }
      }
    },

    // 随机事件
    _processRandomEvents: function() {
      // 10%概率触发随机事件
      if (Math.random() > 0.1) return;

      var events = [
        { name: '丰年', desc: '今年丰收，各势力粮食+50', apply: function() {
          for (var f in GS.factions) {
            if (GS.factions.hasOwnProperty(f) && f !== 'none') {
              GS.factions[f].food += 50;
            }
          }
        }},
        { name: '商队来访', desc: '商队来访，各势力金币+30', apply: function() {
          for (var f in GS.factions) {
            if (GS.factions.hasOwnProperty(f) && f !== 'none') {
              GS.factions[f].gold += 30;
            }
          }
        }},
        { name: '瘟疫', desc: '瘟疫蔓延，各城市兵力减少5%', apply: function() {
          for (var cid in GS.cities) {
            if (!GS.cities.hasOwnProperty(cid)) continue;
            var city = GS.cities[cid];
            for (var h = 0; h < city.heroes.length; h++) {
              var hero = GS.heroes[city.heroes[h]];
              if (hero) {
                hero.troops = Math.floor(hero.troops * 0.95);
              }
            }
            city.troops = GS._getCityTotalTroops(cid);
          }
        }},
        { name: '民心不稳', desc: '民心动摇，各城市士气-5', apply: function() {
          for (var cid in GS.cities) {
            if (!GS.cities.hasOwnProperty(cid)) continue;
            GS.cities[cid].morale = Math.max(0, GS.cities[cid].morale - 5);
          }
        }}
      ];

      var event = events[Math.floor(Math.random() * events.length)];
      event.apply();

      // 通过事件系统通知
      if (window.SG.DialogSystem) {
        window.SG.DialogSystem.show({
          title: '随机事件：' + event.name,
          content: event.desc,
          type: 'event'
        });
      }
    },

    // 行军军队推进
    _processArmies: function() {
      for (var i = this.armies.length - 1; i >= 0; i--) {
        var army = this.armies[i];
        army.turnsLeft--;
        if (army.turnsLeft <= 0) {
          // 到达目标城市，触发攻城或进驻
          this._armyArrive(army);
          this.armies.splice(i, 1);
        }
      }
    },

    // 军队到达目标
    _armyArrive: function(army) {
      var targetCity = this.cities[army.targetCity];
      if (!targetCity) return;

      if (targetCity.faction === army.faction) {
        // 友方城市，武将进驻
        for (var i = 0; i < army.heroIds.length; i++) {
          var hero = this.heroes[army.heroIds[i]];
          if (hero) {
            hero.location = army.targetCity;
            hero.status = 'idle';
            targetCity.heroes.push(hero.id);
          }
        }
        targetCity.troops = this._getCityTotalTroops(targetCity.id);
      } else {
        // 敌方城市，触发战斗
        if (window.SG.BattleEngine && window.SG.BattleScene) {
          this.battle = {
            attackerFaction: army.faction,
            defenderFaction: targetCity.faction,
            attackerHeroIds: army.heroIds,
            defenderHeroIds: targetCity.heroes.slice(),
            targetCity: army.targetCity,
            fromCity: army.fromCity
          };
          this.phase = 'battle';
          window.SG.BattleScene.start(this.battle);
        }
      }
    },

    // ===== 存档 =====
    save: function(slot) {
      var data = this.toJSON();
      var key = SAVE_PREFIX + (slot || 0);
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (e) {
        console.error('存档失败:', e);
        return false;
      }
    },

    load: function(slot) {
      var key = SAVE_PREFIX + (slot || 0);
      try {
        var raw = localStorage.getItem(key);
        if (!raw) return false;
        var data = JSON.parse(raw);
        this.fromJSON(data);
        return true;
      } catch (e) {
        console.error('读档失败:', e);
        return false;
      }
    },

    // 序列化状态
    toJSON: function() {
      return {
        turn: this.turn,
        phase: this.phase,
        playerFaction: this.playerFaction,
        factions: JSON.parse(JSON.stringify(this.factions)),
        cities: JSON.parse(JSON.stringify(this.cities)),
        heroes: JSON.parse(JSON.stringify(this.heroes)),
        armies: JSON.parse(JSON.stringify(this.armies)),
        battle: this.battle ? JSON.parse(JSON.stringify(this.battle)) : null
      };
    },

    // 恢复状态
    fromJSON: function(data) {
      this.turn = data.turn;
      this.phase = data.phase;
      this.playerFaction = data.playerFaction;
      this.factions = data.factions;
      this.cities = data.cities;
      this.heroes = data.heroes;
      this.armies = data.armies || [];
      this.battle = data.battle || null;
      this.customFactionId = data.customFactionId || null;

      // 恢复自定义技能
      if (data.customSkills) {
        for (var skId in data.customSkills) {
          if (data.customSkills.hasOwnProperty(skId)) {
            window.SG.SKILLS_DATA[skId] = data.customSkills[skId];
            if (!window.SG.CUSTOM_SKILLS) window.SG.CUSTOM_SKILLS = {};
            window.SG.CUSTOM_SKILLS[skId] = data.customSkills[skId];
          }
        }
      }

      // 恢复势力名称和颜色映射
      if (data.factionNames) {
        if (!window.SG.FACTION_NAMES) window.SG.FACTION_NAMES = {};
        for (var fn in data.factionNames) {
          if (data.factionNames.hasOwnProperty(fn)) {
            window.SG.FACTION_NAMES[fn] = data.factionNames[fn];
          }
        }
      }
      if (data.factionColors) {
        if (!window.SG.FACTION_COLORS) window.SG.FACTION_COLORS = {};
        for (var fc in data.factionColors) {
          if (data.factionColors.hasOwnProperty(fc)) {
            window.SG.FACTION_COLORS[fc] = data.factionColors[fc];
          }
        }
      }
    },

    // 初始化自定义势力（君主）
    initCustomFaction: function(monarchName, factionName, factionColor, attrs, startCityId, customSkillData) {
      this.init();

      var customFactionId = 'custom_' + Date.now();
      this.customFactionId = customFactionId;
      this.playerFaction = customFactionId;

      // 添加势力
      this.factions[customFactionId] = { gold: 500, food: 500 };

      // 注册势力名称和颜色
      if (!window.SG.FACTION_NAMES) window.SG.FACTION_NAMES = {};
      if (!window.SG.FACTION_COLORS) window.SG.FACTION_COLORS = {};
      window.SG.FACTION_NAMES[customFactionId] = factionName;
      window.SG.FACTION_COLORS[customFactionId] = factionColor;

      // 创建君主武将
      var monarchSkillIds = [];
      if (customSkillData) {
        var customSkillId = window.SG.registerCustomSkill(customSkillData);
        monarchSkillIds.push(customSkillId);
      }

      var monarchId = this._createHeroInternal({
        name: monarchName,
        faction: customFactionId,
        force: attrs.force || 70,
        intellect: attrs.intellect || 70,
        politics: attrs.politics || 70,
        command: attrs.command || 70,
        charisma: attrs.charisma || 70,
        loyalty: 100,
        level: 5,
        skills: monarchSkillIds,
        advisorSkill: customSkillData ? null : 'jimou',
        maxTroops: 8000,
        troopType: attrs.troopType || 'infantry',
        sp: 100,
        maxSp: 100,
        isMonarch: true
      });

      // 占领起始城市
      var startCity = this.cities[startCityId];
      if (startCity) {
        // 移除原势力的武将
        if (startCity.faction !== 'none') {
          for (var i = startCity.heroes.length - 1; i >= 0; i--) {
            var h = this.heroes[startCity.heroes[i]];
            if (h) {
              h.location = null;
              h.status = 'idle';
              h.troops = 0;
            }
          }
        }
        startCity.faction = customFactionId;
        startCity.heroes = [monarchId];
        startCity.troops = 3000;

        // 分配兵力
        var monarch = this.heroes[monarchId];
        monarch.location = startCityId;
        monarch.troops = 3000;
        monarch.status = 'idle';
      }

      return { factionId: customFactionId, monarchId: monarchId };
    },

    // 创建自定义武将（招募用）
    createCustomHero: function(name, attrs, troopType, skillIds, advisorSkillId, factionId, cityId) {
      var heroId = this._createHeroInternal({
        name: name,
        faction: factionId,
        force: attrs.force || 50,
        intellect: attrs.intellect || 50,
        politics: attrs.politics || 50,
        command: attrs.command || 50,
        charisma: attrs.charisma || 50,
        loyalty: 100,
        level: attrs.level || 1,
        skills: skillIds || [],
        advisorSkill: advisorSkillId || null,
        maxTroops: 5000 + (attrs.level || 1) * 500,
        troopType: troopType || 'infantry',
        sp: 80,
        maxSp: 80 + (attrs.intellect || 50) * 0.4,
        isCustom: true
      });

      // 放置到城市
      if (cityId && this.cities[cityId]) {
        var city = this.cities[cityId];
        city.heroes.push(heroId);
        var hero = this.heroes[heroId];
        hero.location = cityId;
        hero.troops = 0;
        hero.status = 'idle';
      }

      return heroId;
    },

    // 内部：创建武将对象
    _createHeroInternal: function(config) {
      var id = 'custom_hero_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      var hero = {
        id: id,
        name: config.name || '无名',
        faction: config.faction || 'none',
        force: config.force || 50,
        intellect: config.intellect || 50,
        politics: config.politics || 50,
        command: config.command || 50,
        charisma: config.charisma || 50,
        loyalty: config.loyalty !== undefined ? config.loyalty : 100,
        level: config.level || 1,
        exp: 0,
        skills: (config.skills || []).slice(),
        advisorSkill: config.advisorSkill || null,
        maxTroops: config.maxTroops || 5000,
        troopType: config.troopType || 'infantry',
        sp: config.sp !== undefined ? config.sp : 80,
        maxSp: config.maxSp !== undefined ? config.maxSp : 80,
        isMonarch: config.isMonarch || false,
        isCustom: config.isCustom !== false
      };
      // 运行时字段
      hero.troops = 0;
      hero.location = null;
      hero.status = 'idle';
      hero.hp = 100;
      hero.maxHp = 100;
      hero.developTarget = null;

      this.heroes[id] = hero;
      return id;
    },

    // 序列化状态（增强版，包含自定义数据）
    toJSON: function() {
      var customSkills = {};
      if (window.SG.CUSTOM_SKILLS) {
        for (var sId in window.SG.CUSTOM_SKILLS) {
          if (window.SG.CUSTOM_SKILLS.hasOwnProperty(sId)) {
            customSkills[sId] = window.SG.CUSTOM_SKILLS[sId];
          }
        }
      }

      var factionNames = {};
      var factionColors = {};
      if (window.SG.FACTION_NAMES && this.customFactionId) {
        factionNames[this.customFactionId] = window.SG.FACTION_NAMES[this.customFactionId];
      }
      if (window.SG.FACTION_COLORS && this.customFactionId) {
        factionColors[this.customFactionId] = window.SG.FACTION_COLORS[this.customFactionId];
      }

      return {
        turn: this.turn,
        phase: this.phase,
        playerFaction: this.playerFaction,
        customFactionId: this.customFactionId,
        factions: JSON.parse(JSON.stringify(this.factions)),
        cities: JSON.parse(JSON.stringify(this.cities)),
        heroes: JSON.parse(JSON.stringify(this.heroes)),
        armies: JSON.parse(JSON.stringify(this.armies)),
        battle: this.battle ? JSON.parse(JSON.stringify(this.battle)) : null,
        customSkills: customSkills,
        factionNames: factionNames,
        factionColors: factionColors
      };
    }
  };

  window.SG.GameState = GS;

})();
