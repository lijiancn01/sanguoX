/**
 * 三国群英传 - 核心游戏数据管理
 * @author jian.li
 */
window.SG3 = window.SG3 || {};

(function() {
  'use strict';

  var SAVE_PREFIX = 'sg3_save_';

  var GD = {

    // ===== 状态 =====
    turn: 1,
    phase: 'strategic', // strategic, marching, battle, event
    playerFaction: 'shu',
    factions: {
      wei: { gold: 500, food: 500 },
      shu: { gold: 400, food: 400 },
      wu:  { gold: 400, food: 400 },
      qun: { gold: 200, food: 200 }
    },
    cities: {},
    heroes: {},
    armies: [],
    battle: null,
    customFactionId: null,

    // ===== 初始化 =====
    init: function() {
      this.turn = 1;
      this.phase = 'strategic';
      this.armies = [];
      this.battle = null;
      this.customFactionId = null;

      // 初始化势力资源
      this.factions = {
        wei: { gold: 500, food: 500 },
        shu: { gold: 400, food: 400 },
        wu:  { gold: 400, food: 400 },
        qun: { gold: 200, food: 200 }
      };

      // 深拷贝城市数据
      this.cities = {};
      for (var i = 0; i < window.SG3.CITIES_DATA.length; i++) {
        var cd = window.SG3.CITIES_DATA[i];
        var city = {};
        for (var key in cd) {
          if (cd.hasOwnProperty(key)) {
            city[key] = key === 'heroes' ? cd[key].slice() : cd[key];
          }
        }
        city.developAssign = { agriculture: null, commerce: null };
        this.cities[city.id] = city;
      }

      // 深拷贝武将数据
      this.heroes = {};
      for (var j = 0; j < window.SG3.HEROES_DATA.length; j++) {
        var hd = window.SG3.HEROES_DATA[j];
        var hero = {};
        for (var hKey in hd) {
          if (hd.hasOwnProperty(hKey)) {
            hero[hKey] = hKey === 'skills' ? hd[hKey].slice() : hd[hKey];
          }
        }
        hero.troops = 0;
        hero.location = null;
        hero.status = 'idle';
        hero.hp = 100;
        hero.maxHp = 100;
        hero.developTarget = null;
        this.heroes[hero.id] = hero;
      }

      this._assignHeroesToCities();
    },

    // 分配武将到城市
    _assignHeroesToCities: function() {
      var cityId, city, heroIds, heroId, hero;
      // 先清空所有武将location
      for (heroId in this.heroes) {
        if (this.heroes.hasOwnProperty(heroId)) {
          this.heroes[heroId].location = null;
        }
      }

      for (cityId in this.cities) {
        if (!this.cities.hasOwnProperty(cityId)) continue;
        city = this.cities[cityId];
        heroIds = city.heroes;
        if (heroIds.length === 0) continue;

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
            var share = Math.floor(totalTroops * hero.maxTroops / totalMaxTroops);
            hero.troops = Math.min(share, hero.maxTroops);
            distributed += hero.troops;
          } else {
            hero.troops = Math.floor(totalTroops / validHeroes.length);
            distributed += hero.troops;
          }
        }

        // 余数分配给第一个武将
        var remainder = totalTroops - distributed;
        if (remainder > 0 && validHeroes.length > 0) {
          validHeroes[0].troops += remainder;
          if (validHeroes[0].troops > validHeroes[0].maxTroops) {
            validHeroes[0].troops = validHeroes[0].maxTroops;
          }
        }
      }

      // 在野武将
      for (heroId in this.heroes) {
        if (!this.heroes.hasOwnProperty(heroId)) continue;
        hero = this.heroes[heroId];
        if (!hero.location) {
          hero.status = 'idle';
          hero.troops = 0;
        }
      }
    },

    // ===== 查询 =====
    getFactionCities: function(faction) {
      var result = [];
      for (var id in this.cities) {
        if (this.cities.hasOwnProperty(id) && this.cities[id].faction === faction) {
          result.push(this.cities[id]);
        }
      }
      return result;
    },

    getFactionHeroes: function(faction) {
      var result = [];
      for (var id in this.heroes) {
        if (this.heroes.hasOwnProperty(id) && this.heroes[id].faction === faction) {
          result.push(this.heroes[id]);
        }
      }
      return result;
    },

    getCityTotalTroops: function(cityId) {
      var city = this.cities[cityId];
      if (!city) return 0;
      var total = 0;
      for (var i = 0; i < city.heroes.length; i++) {
        var hero = this.heroes[city.heroes[i]];
        if (hero) total += hero.troops;
      }
      return total;
    },

    getFactionGold: function(faction) {
      var cities = this.getFactionCities(faction);
      var total = 0;
      for (var i = 0; i < cities.length; i++) {
        total += Math.floor(cities[i].commerce / 10);
      }
      return total;
    },

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
      // 1. 收集资源
      var factionIds = ['wei', 'shu', 'wu', 'qun'];
      if (this.customFactionId && this.factions[this.customFactionId]) {
        factionIds.push(this.customFactionId);
      }
      for (var i = 0; i < factionIds.length; i++) {
        var fId = factionIds[i];
        var fac = this.factions[fId];
        if (!fac) continue;
        fac.gold += this.getFactionGold(fId);
        fac.food += this.getFactionFood(fId);
      }

      // 2. 内政开发
      this._processDevelopment();
      // 3. 兵力恢复
      this._recoverCityTroops();
      // 4. 武将恢复
      this._recoverHeroes();
      // 5. AI行动
      this._processAITurns();
      // 6. 随机事件
      this._processRandomEvents();
      // 7. 行军推进
      this._processArmies();

      // 8. 回合+1
      this.turn++;
      if (this.phase !== 'battle') {
        this.phase = 'strategic';
      }
    },

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
        city.developAssign = { agriculture: null, commerce: null };
      }
    },

    _recoverCityTroops: function() {
      for (var cityId in this.cities) {
        if (!this.cities.hasOwnProperty(cityId)) continue;
        var city = this.cities[cityId];
        if (city.faction === 'none') continue;
        var recovery = Math.floor(city.maxTroops * 0.05);
        var currentTotal = this.getCityTotalTroops(cityId);
        var newTotal = Math.min(city.maxTroops, currentTotal + recovery);
        var diff = newTotal - currentTotal;
        if (diff > 0 && city.heroes.length > 0) {
          var perHero = Math.floor(diff / city.heroes.length);
          var remainder = diff - perHero * city.heroes.length;
          for (var i = 0; i < city.heroes.length; i++) {
            var hero = this.heroes[city.heroes[i]];
            if (hero) {
              var add = perHero + (i === 0 ? remainder : 0);
              hero.troops = Math.min(hero.maxTroops, hero.troops + add);
            }
          }
          city.troops = this.getCityTotalTroops(cityId);
        }
      }
    },

    _recoverHeroes: function() {
      for (var id in this.heroes) {
        if (!this.heroes.hasOwnProperty(id)) continue;
        var hero = this.heroes[id];
        if (hero.hp < hero.maxHp) hero.hp = Math.min(hero.maxHp, hero.hp + 10);
        if (hero.sp < hero.maxSp) hero.sp = Math.min(hero.maxSp, hero.sp + 10);
        this._checkLevelUp(hero);
      }
    },

    _checkLevelUp: function(hero) {
      var expNeeded = hero.level * 100;
      while (hero.exp >= expNeeded) {
        hero.exp -= expNeeded;
        hero.level++;
        hero.maxHp += 5;
        hero.hp = hero.maxHp;
        hero.maxTroops += 500;
        hero.maxSp += 5;
        hero.sp = hero.maxSp;
        expNeeded = hero.level * 100;
      }
    },

    _processAITurns: function() {
      var factionIds = ['wei', 'shu', 'wu', 'qun'];
      for (var i = 0; i < factionIds.length; i++) {
        var fId = factionIds[i];
        if (fId === this.playerFaction) continue;
        if (this.factions[fId] && window.SG3.AIController) {
          window.SG3.AIController.takeTurn(fId);
        }
      }
      // 自定义AI势力
      if (this.customFactionId && this.customFactionId !== this.playerFaction) {
        if (this.factions[this.customFactionId] && window.SG3.AIController) {
          window.SG3.AIController.takeTurn(this.customFactionId);
        }
      }
    },

    _processRandomEvents: function() {
      if (Math.random() > 0.1) return;
      var events = [
        { name: '丰年', desc: '今年丰收，各势力粮食+50', apply: function() {
          for (var f in GD.factions) { if (GD.factions.hasOwnProperty(f) && f !== 'none') GD.factions[f].food += 50; }
        }},
        { name: '商队来访', desc: '商队来访，各势力金币+30', apply: function() {
          for (var f in GD.factions) { if (GD.factions.hasOwnProperty(f) && f !== 'none') GD.factions[f].gold += 30; }
        }},
        { name: '瘟疫', desc: '瘟疫蔓延，各城市兵力减少5%', apply: function() {
          for (var cid in GD.cities) {
            if (!GD.cities.hasOwnProperty(cid)) continue;
            var city = GD.cities[cid];
            for (var h = 0; h < city.heroes.length; h++) {
              var hero = GD.heroes[city.heroes[h]];
              if (hero) hero.troops = Math.floor(hero.troops * 0.95);
            }
            city.troops = GD.getCityTotalTroops(cid);
          }
        }},
        { name: '民心不稳', desc: '民心动摇，各城市士气-5', apply: function() {
          for (var cid in GD.cities) {
            if (!GD.cities.hasOwnProperty(cid)) continue;
            GD.cities[cid].morale = Math.max(0, GD.cities[cid].morale - 5);
          }
        }}
      ];
      var event = events[Math.floor(Math.random() * events.length)];
      event.apply();
      this._lastEvent = event;
    },

    _processArmies: function() {
      for (var i = this.armies.length - 1; i >= 0; i--) {
        var army = this.armies[i];
        army.turnsLeft--;
        if (army.turnsLeft <= 0) {
          this._armyArrive(army);
          this.armies.splice(i, 1);
        }
      }
    },

    _armyArrive: function(army) {
      var targetCity = this.cities[army.targetCity];
      if (!targetCity) return;

      if (targetCity.faction === army.faction) {
        // 友方城市，进驻
        for (var i = 0; i < army.heroIds.length; i++) {
          var hero = this.heroes[army.heroIds[i]];
          if (hero) {
            hero.location = army.targetCity;
            hero.status = 'idle';
            targetCity.heroes.push(hero.id);
          }
        }
        targetCity.troops = this.getCityTotalTroops(targetCity.id);
      } else if (targetCity.heroes.length === 0) {
        // 空城直接占领
        targetCity.faction = army.faction;
        targetCity.morale = 50;
        for (var k = 0; k < army.heroIds.length; k++) {
          var atkHero = this.heroes[army.heroIds[k]];
          if (atkHero) {
            atkHero.location = army.targetCity;
            atkHero.status = 'idle';
            targetCity.heroes.push(atkHero.id);
          }
        }
        targetCity.troops = this.getCityTotalTroops(targetCity.id);
      } else {
        // 有守将，判断是否玩家参与
        var isPlayerInvolved = (army.faction === this.playerFaction) ||
                               (targetCity.faction === this.playerFaction);
        if (isPlayerInvolved) {
          // 设置战斗状态，由场景系统接管
          this.battle = {
            attackerFaction: army.faction,
            defenderFaction: targetCity.faction,
            attackerHeroIds: army.heroIds,
            defenderHeroIds: targetCity.heroes.slice(),
            targetCity: army.targetCity,
            fromCity: army.fromCity
          };
          this.phase = 'battle';
        } else {
          // AI之间自动结算
          this._autoResolveBattle(army, targetCity);
        }
      }
    },

    _autoResolveBattle: function(army, targetCity) {
      if (!window.SG3.BattleEngine) return;
      var state = window.SG3.BattleEngine.init(
        army.heroIds, targetCity.heroes.slice(), army.faction, targetCity.faction
      );
      var maxRounds = 200;
      while (state.phase !== 'ended' && maxRounds-- > 0) {
        window.SG3.BattleEngine.step();
      }
      if (state.winner === 'attacker') {
        targetCity.faction = army.faction;
        targetCity.morale = 50;
        targetCity.heroes = [];
        for (var i = 0; i < army.heroIds.length; i++) {
          var atkHero = this.heroes[army.heroIds[i]];
          if (atkHero) {
            atkHero.location = army.targetCity;
            atkHero.status = 'idle';
            targetCity.heroes.push(atkHero.id);
          }
        }
        targetCity.troops = this.getCityTotalTroops(targetCity.id);
      } else {
        for (var j = 0; j < army.heroIds.length; j++) {
          var retHero = this.heroes[army.heroIds[j]];
          if (retHero) {
            retHero.location = army.fromCity;
            retHero.status = 'idle';
            var fromCity = this.cities[army.fromCity];
            if (fromCity && fromCity.heroes.indexOf(retHero.id) === -1) {
              fromCity.heroes.push(retHero.id);
            }
          }
        }
      }
    },

    // ===== 存档 =====
    save: function(slot) {
      try {
        localStorage.setItem(SAVE_PREFIX + (slot || 0), JSON.stringify(this.toJSON()));
        return true;
      } catch (e) { return false; }
    },

    load: function(slot) {
      try {
        var raw = localStorage.getItem(SAVE_PREFIX + (slot || 0));
        if (!raw) return false;
        this.fromJSON(JSON.parse(raw));
        return true;
      } catch (e) { return false; }
    },

    toJSON: function() {
      return {
        turn: this.turn, phase: this.phase, playerFaction: this.playerFaction,
        customFactionId: this.customFactionId,
        factions: JSON.parse(JSON.stringify(this.factions)),
        cities: JSON.parse(JSON.stringify(this.cities)),
        heroes: JSON.parse(JSON.stringify(this.heroes)),
        armies: JSON.parse(JSON.stringify(this.armies)),
        battle: this.battle ? JSON.parse(JSON.stringify(this.battle)) : null,
        lastEvent: this._lastEvent || null
      };
    },

    fromJSON: function(data) {
      this.turn = data.turn;
      this.phase = data.phase;
      this.playerFaction = data.playerFaction;
      this.customFactionId = data.customFactionId || null;
      this.factions = data.factions;
      this.cities = data.cities;
      this.heroes = data.heroes;
      this.armies = data.armies || [];
      this.battle = data.battle || null;
      // 恢复自定义势力的名称和颜色
      if (data.customFactionId) {
        if (!window.SG3.FACTION_NAMES) window.SG3.FACTION_NAMES = {};
        if (!window.SG3.FACTION_CSS) window.SG3.FACTION_CSS = {};
      }
    },

    // ===== 自定义君主 =====
    initCustomFaction: function(monarchName, factionName, factionColor, attrs, startCityId, customSkillData) {
      this.init();
      var customFactionId = 'custom_' + Date.now();
      this.customFactionId = customFactionId;
      this.playerFaction = customFactionId;

      this.factions[customFactionId] = { gold: 500, food: 500 };

      // 注册势力名称和颜色
      window.SG3.FACTION_NAMES[customFactionId] = factionName;
      window.SG3.FACTION_CSS[customFactionId] = factionColor;
      window.SG3.FACTION_COLORS[customFactionId] = parseInt(factionColor.replace('#', ''), 16);

      var monarchSkillIds = [];
      if (customSkillData) {
        var customSkillId = window.SG3.registerCustomSkill(customSkillData);
        monarchSkillIds.push(customSkillId);
      }

      var monarchId = this._createHeroInternal({
        name: monarchName, faction: customFactionId,
        force: attrs.force || 70, intellect: attrs.intellect || 70,
        politics: attrs.politics || 70, command: attrs.command || 70,
        charisma: attrs.charisma || 70, loyalty: 100, level: 5,
        skills: monarchSkillIds, advisorSkill: customSkillData ? null : 'jimou',
        maxTroops: 8000, troopType: attrs.troopType || 'infantry',
        sp: 100, maxSp: 100, isMonarch: true
      });

      var startCity = this.cities[startCityId];
      if (startCity) {
        if (startCity.faction !== 'none') {
          for (var i = startCity.heroes.length - 1; i >= 0; i--) {
            var h = this.heroes[startCity.heroes[i]];
            if (h) { h.location = null; h.status = 'idle'; h.troops = 0; }
          }
        }
        startCity.faction = customFactionId;
        startCity.heroes = [monarchId];
        startCity.troops = 3000;
        var monarch = this.heroes[monarchId];
        monarch.location = startCityId;
        monarch.troops = 3000;
        monarch.status = 'idle';
      }

      return { factionId: customFactionId, monarchId: monarchId };
    },

    _createHeroInternal: function(config) {
      var id = 'custom_hero_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      var hero = {
        id: id, name: config.name || '无名', faction: config.faction || 'none',
        force: config.force || 50, intellect: config.intellect || 50,
        politics: config.politics || 50, command: config.command || 50,
        charisma: config.charisma || 50,
        loyalty: config.loyalty !== undefined ? config.loyalty : 100,
        level: config.level || 1, exp: 0,
        skills: (config.skills || []).slice(),
        advisorSkill: config.advisorSkill || null,
        maxTroops: config.maxTroops || 5000,
        troopType: config.troopType || 'infantry',
        sp: config.sp !== undefined ? config.sp : 80,
        maxSp: config.maxSp !== undefined ? config.maxSp : 80,
        isMonarch: config.isMonarch || false,
        troops: 0, location: null, status: 'idle',
        hp: 100, maxHp: 100, developTarget: null
      };
      this.heroes[id] = hero;
      return id;
    },

    // ===== 城市操作 =====
    develop: function(cityId, heroId, target) {
      var city = this.cities[cityId];
      var hero = this.heroes[heroId];
      if (!city || !hero) return { ok: false, msg: '城市或武将不存在' };
      if (hero.faction !== city.faction) return { ok: false, msg: '武将不属于该城市势力' };
      if (hero.location !== cityId) return { ok: false, msg: '武将不在该城市' };
      if (hero.status !== 'idle') return { ok: false, msg: '武将状态不可用' };
      if (target !== 'agriculture' && target !== 'commerce') return { ok: false, msg: '开发类型无效' };
      if (city.developAssign[target]) {
        var oldHero = this.heroes[city.developAssign[target]];
        if (oldHero) { oldHero.status = 'idle'; oldHero.developTarget = null; }
      }
      hero.status = 'developing';
      hero.developTarget = target;
      city.developAssign[target] = heroId;
      return { ok: true, msg: hero.name + ' 开始开发' + (target === 'agriculture' ? '农业' : '商业') };
    },

    recruit: function(cityId, amount) {
      var city = this.cities[cityId];
      if (!city) return { ok: false, msg: '城市不存在' };
      if (city.faction === 'none') return { ok: false, msg: '在野城市无法征兵' };
      var faction = this.factions[city.faction];
      if (!faction) return { ok: false, msg: '势力不存在' };
      var goldCost = Math.floor(amount * 0.5);
      var foodCost = Math.floor(amount * 0.3);
      if (faction.gold < goldCost) return { ok: false, msg: '金币不足' };
      if (faction.food < foodCost) return { ok: false, msg: '粮食不足' };
      var currentTroops = this.getCityTotalTroops(cityId);
      if (currentTroops + amount > city.maxTroops) {
        amount = city.maxTroops - currentTroops;
        if (amount <= 0) return { ok: false, msg: '兵力已达上限' };
        goldCost = Math.floor(amount * 0.5);
        foodCost = Math.floor(amount * 0.3);
      }
      faction.gold -= goldCost;
      faction.food -= foodCost;
      var idleHeroes = [];
      for (var i = 0; i < city.heroes.length; i++) {
        var h = this.heroes[city.heroes[i]];
        if (h && h.troops < h.maxTroops) idleHeroes.push(h);
      }
      if (idleHeroes.length === 0) {
        faction.gold += goldCost; faction.food += foodCost;
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
      city.troops = this.getCityTotalTroops(cityId);
      city.morale = Math.max(0, city.morale - Math.floor(amount * 0.001));
      return { ok: true, msg: '征兵' + (amount - remaining) + '人' };
    },

    search: function(cityId, heroId) {
      var city = this.cities[cityId];
      var hero = this.heroes[heroId];
      if (!city || !hero) return { ok: false, msg: '城市或武将不存在' };
      var available = [];
      for (var id in this.heroes) {
        if (!this.heroes.hasOwnProperty(id)) continue;
        var h = this.heroes[id];
        if (h.faction === 'none' && !h.location) available.push(h);
      }
      if (available.length === 0) return { ok: false, msg: '附近没有在野武将' };
      var chance = hero.charisma * 0.5 + 10;
      if (Math.random() * 100 > chance) {
        hero.exp += 5;
        return { ok: false, msg: hero.name + ' 搜索未发现武将' };
      }
      var found = available[Math.floor(Math.random() * available.length)];
      found.faction = city.faction;
      found.location = cityId;
      found.status = 'idle';
      found.loyalty = 50;
      city.heroes.push(found.id);
      hero.exp += 10;
      return { ok: true, msg: hero.name + ' 发现了在野武将 ' + found.name + '！' };
    },

    train: function(cityId, heroId) {
      var city = this.cities[cityId];
      var hero = this.heroes[heroId];
      if (!city || !hero) return { ok: false, msg: '城市或武将不存在' };
      var increase = Math.floor(hero.command * 0.3) || 1;
      city.morale = Math.min(100, city.morale + increase);
      hero.exp += 5;
      return { ok: true, msg: hero.name + ' 训练部队，士气提升' + increase };
    },

    dispatchArmy: function(fromCityId, heroIds, targetCityId) {
      var fromCity = this.cities[fromCityId];
      var toCity = this.cities[targetCityId];
      if (!fromCity || !toCity) return { ok: false, msg: '城市不存在' };
      if (fromCity.adjacent.indexOf(targetCityId) === -1) return { ok: false, msg: '目标城市不相邻' };
      if (toCity.faction === fromCity.faction) return { ok: false, msg: '不能进攻友方城市' };
      if (!heroIds || heroIds.length === 0) return { ok: false, msg: '未选择出征武将' };
      var validHeroIds = [];
      var totalTroops = 0;
      for (var i = 0; i < heroIds.length; i++) {
        var hero = this.heroes[heroIds[i]];
        if (!hero) continue;
        if (hero.location !== fromCityId) continue;
        if (hero.faction !== fromCity.faction) continue;
        if (hero.status !== 'idle') continue;
        if (hero.troops <= 0) continue;
        validHeroIds.push(heroIds[i]);
        totalTroops += hero.troops;
      }
      if (validHeroIds.length === 0) return { ok: false, msg: '没有可出征的武将' };
      for (var j = 0; j < validHeroIds.length; j++) {
        var hid = validHeroIds[j];
        var h = this.heroes[hid];
        h.status = 'marching';
        h.location = null;
        var idx = fromCity.heroes.indexOf(hid);
        if (idx !== -1) fromCity.heroes.splice(idx, 1);
      }
      fromCity.troops = this.getCityTotalTroops(fromCityId);
      this.armies.push({
        id: 'army_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        faction: fromCity.faction, heroIds: validHeroIds,
        fromCity: fromCityId, targetCity: targetCityId,
        turnsLeft: 1, speed: 1
      });
      return { ok: true, msg: '出兵' + validHeroIds.length + '名武将，进攻' + toCity.name };
    }
  };

  window.SG3.GameData = GD;
})();
