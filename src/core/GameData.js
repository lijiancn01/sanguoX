/**
 * 三国群英传 - 核心游戏数据管理（引擎无关层）
 *
 * 本模块不依赖 Phaser、不依赖 DOM，只负责规则与状态。
 * AI 与战斗引擎通过 registerEngine() 后期注入，避免 ESM 循环依赖。
 * @author jian.li
 */

import { CITIES_DATA } from '../data/cities.js';
import { HEROES_DATA } from '../data/heroes.js';
import { registerCustomSkill, importCustomSkills, exportCustomSkills } from '../data/skills.js';
import {
  registerCustomFaction,
  RECRUIT_GOLD_PER,
  RECRUIT_FOOD_PER,
  RECRUIT_MORALE_PER,
  CITY_TROOP_RECOVER_RATE,
  HERO_RECOVER,
  AI_AUTO_BATTLE_MAX_ROUNDS,
  BUILTIN_FACTION_IDS,
  INITIAL_FACTION_TREASURY,
  LEGACY_FACTION_REMAP,
  factionName,
  factionCss
} from './config.js';

/** 后期注入的引擎（AI / 战斗），由 bootstrap.js 注册 */
const engines = {
  ai: null,
  battle: null
};

/**
 * 注册 AI 与战斗引擎。
 * @param {{ai?: object, battle?: object}} impl
 */
export function registerEngine(impl) {
  if (impl && impl.ai) engines.ai = impl.ai;
  if (impl && impl.battle) engines.battle = impl.battle;
}

const GD = {
  // ===== 状态 =====
  turn: 1,
  phase: 'strategic', // strategic, marching, battle, event
  playerFaction: 'shu',
  factions: null,
  cities: {},
  heroes: {},
  armies: [],
  battle: null,
  // 同一回合可能有多支军队抵达有守将的城市，若共用一个 battle 字段，
  // 后到的会覆盖先到的，导致先到军队的武将永远停在 marching。
  // 因此用队列暂存待玩家处理的战斗，battle 只暴露队首。
  battleQueue: [],
  customFactionId: null,
  _lastEvent: null,

  // ===== 初始化 =====
  init() {
    this.turn = 1;
    this.phase = 'strategic';
    this.armies = [];
    this.battle = null;
    this.battleQueue = [];
    this.customFactionId = null;
    this._lastEvent = null;
    this._migrationNote = null;

    // 各势力初始金粮来自 config，避免与配色表分处两地各自维护
    this.factions = {};
    for (const fId of BUILTIN_FACTION_IDS) {
      const t = INITIAL_FACTION_TREASURY[fId] || { gold: 200, food: 200 };
      this.factions[fId] = { gold: t.gold, food: t.food };
    }

    // 深拷贝城市数据
    this.cities = {};
    for (const cd of CITIES_DATA) {
      const city = { ...cd, heroes: cd.heroes.slice() };
      city.developAssign = { agriculture: null, commerce: null };
      this.cities[city.id] = city;
    }

    // 深拷贝武将数据
    this.heroes = {};
    for (const hd of HEROES_DATA) {
      const hero = { ...hd, skills: hd.skills.slice() };
      hero.troops = 0;
      hero.location = null;
      hero.status = 'idle';
      hero.hp = 100;
      hero.maxHp = 100;
      hero.developTarget = null;
      this.heroes[hero.id] = hero;
    }

    this._assignHeroesToCities();
    return this;
  },

  // 分配武将到城市
  _assignHeroesToCities() {
    for (const heroId in this.heroes) {
      if (Object.prototype.hasOwnProperty.call(this.heroes, heroId)) {
        this.heroes[heroId].location = null;
      }
    }

    for (const cityId in this.cities) {
      if (!Object.prototype.hasOwnProperty.call(this.cities, cityId)) continue;
      const city = this.cities[cityId];
      if (city.heroes.length === 0) continue;

      let totalMaxTroops = 0;
      const validHeroes = [];
      for (const hid of city.heroes) {
        const hero = this.heroes[hid];
        if (hero) {
          totalMaxTroops += hero.maxTroops;
          validHeroes.push(hero);
        }
      }
      if (validHeroes.length === 0) continue;

      const totalTroops = city.troops;
      let distributed = 0;
      for (const hero of validHeroes) {
        hero.location = cityId;
        hero.status = 'idle';
        if (totalMaxTroops > 0) {
          const share = Math.floor(totalTroops * hero.maxTroops / totalMaxTroops);
          hero.troops = Math.min(share, hero.maxTroops);
        } else {
          hero.troops = Math.floor(totalTroops / validHeroes.length);
        }
        distributed += hero.troops;
      }

      const remainder = totalTroops - distributed;
      if (remainder > 0) {
        validHeroes[0].troops = Math.min(
          validHeroes[0].maxTroops,
          validHeroes[0].troops + remainder
        );
      }
    }

    // 在野武将
    for (const heroId in this.heroes) {
      if (!Object.prototype.hasOwnProperty.call(this.heroes, heroId)) continue;
      const hero = this.heroes[heroId];
      if (!hero.location) {
        hero.status = 'idle';
        hero.troops = 0;
      }
    }
  },

  // ===== 查询 =====
  getFactionCities(faction) {
    const result = [];
    for (const id in this.cities) {
      if (Object.prototype.hasOwnProperty.call(this.cities, id) && this.cities[id].faction === faction) {
        result.push(this.cities[id]);
      }
    }
    return result;
  },

  getFactionHeroes(faction) {
    const result = [];
    for (const id in this.heroes) {
      if (Object.prototype.hasOwnProperty.call(this.heroes, id) && this.heroes[id].faction === faction) {
        result.push(this.heroes[id]);
      }
    }
    return result;
  },

  getCityTotalTroops(cityId) {
    const city = this.cities[cityId];
    if (!city) return 0;
    let total = 0;
    for (const hid of city.heroes) {
      const hero = this.heroes[hid];
      if (hero) total += hero.troops;
    }
    return total;
  },

  getFactionGold(faction) {
    let total = 0;
    for (const city of this.getFactionCities(faction)) {
      total += Math.floor(city.commerce / 10);
    }
    return total;
  },

  getFactionFood(faction) {
    let total = 0;
    for (const city of this.getFactionCities(faction)) {
      total += Math.floor(city.agriculture / 10);
    }
    return total;
  },

  // ===== 回合结束 =====
  endTurn() {
    // 1. 收集资源
    const factionIds = BUILTIN_FACTION_IDS.slice();
    if (this.customFactionId && this.factions[this.customFactionId]) {
      factionIds.push(this.customFactionId);
    }
    for (const fId of factionIds) {
      const fac = this.factions[fId];
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
    // 5. AI 行动
    this._processAITurns();
    // 6. 随机事件
    this._processRandomEvents();
    // 7. 行军推进
    this._processArmies();
    // 7.1 清理异常滞留的行军武将（历史上会被多支军队共用 battle 字段而卡死）
    this._rescueStrandedHeroes();

    // 8. 回合 +1
    this.turn++;
    // 若本回合产生了待玩家处理的战斗，保持 battle 阶段（队首即当前战斗）
    if (this.battleQueue.length > 0) {
      this._syncBattleHead();
    } else if (this.phase !== 'battle') {
      this.phase = 'strategic';
    }
  },

  _processDevelopment() {
    for (const cityId in this.cities) {
      if (!Object.prototype.hasOwnProperty.call(this.cities, cityId)) continue;
      const city = this.cities[cityId];
      const dev = city.developAssign;
      if (dev.agriculture && this.heroes[dev.agriculture]) {
        const hero = this.heroes[dev.agriculture];
        city.agriculture = Math.min(100, city.agriculture + Math.floor(hero.politics / 5));
        hero.exp += 10;
        hero.status = 'idle';
        hero.developTarget = null;
      }
      if (dev.commerce && this.heroes[dev.commerce]) {
        const hero = this.heroes[dev.commerce];
        city.commerce = Math.min(100, city.commerce + Math.floor(hero.politics / 5));
        hero.exp += 10;
        hero.status = 'idle';
        hero.developTarget = null;
      }
      city.developAssign = { agriculture: null, commerce: null };
    }
  },

  _recoverCityTroops() {
    for (const cityId in this.cities) {
      if (!Object.prototype.hasOwnProperty.call(this.cities, cityId)) continue;
      const city = this.cities[cityId];
      if (city.faction === 'none') continue;
      const recovery = Math.floor(city.maxTroops * CITY_TROOP_RECOVER_RATE);
      const currentTotal = this.getCityTotalTroops(cityId);
      const newTotal = Math.min(city.maxTroops, currentTotal + recovery);
      const diff = newTotal - currentTotal;
      if (diff > 0 && city.heroes.length > 0) {
        const perHero = Math.floor(diff / city.heroes.length);
        const remainder = diff - perHero * city.heroes.length;
        city.heroes.forEach((hid, i) => {
          const hero = this.heroes[hid];
          if (!hero) return;
          const add = perHero + (i === 0 ? remainder : 0);
          hero.troops = Math.min(hero.maxTroops, hero.troops + add);
        });
        city.troops = this.getCityTotalTroops(cityId);
      }
    }
  },

  _recoverHeroes() {
    for (const id in this.heroes) {
      if (!Object.prototype.hasOwnProperty.call(this.heroes, id)) continue;
      const hero = this.heroes[id];
      if (hero.hp < hero.maxHp) hero.hp = Math.min(hero.maxHp, hero.hp + HERO_RECOVER);
      if (hero.sp < hero.maxSp) hero.sp = Math.min(hero.maxSp, hero.sp + HERO_RECOVER);
      this._checkLevelUp(hero);
    }
  },

  _checkLevelUp(hero) {
    let expNeeded = hero.level * 100;
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

  _processAITurns() {
    const factionIds = BUILTIN_FACTION_IDS;
    for (const fId of factionIds) {
      if (fId === this.playerFaction) continue;
      if (this.factions[fId] && engines.ai) {
        engines.ai.takeTurn(fId);
      }
    }
    if (this.customFactionId && this.customFactionId !== this.playerFaction) {
      if (this.factions[this.customFactionId] && engines.ai) {
        engines.ai.takeTurn(this.customFactionId);
      }
    }
  },

  _processRandomEvents() {
    if (Math.random() > 0.1) return;
    const events = [
      { name: '丰年', desc: '今年丰收，各势力粮食+50', apply() {
        for (const f in this.factions) {
          if (Object.prototype.hasOwnProperty.call(this.factions, f) && f !== 'none') this.factions[f].food += 50;
        }
      }},
      { name: '商队来访', desc: '商队来访，各势力金币+30', apply() {
        for (const f in this.factions) {
          if (Object.prototype.hasOwnProperty.call(this.factions, f) && f !== 'none') this.factions[f].gold += 30;
        }
      }},
      { name: '瘟疫', desc: '瘟疫蔓延，各城市兵力减少5%', apply() {
        for (const cid in this.cities) {
          if (!Object.prototype.hasOwnProperty.call(this.cities, cid)) continue;
          const city = this.cities[cid];
          for (const hid of city.heroes) {
            const hero = this.heroes[hid];
            if (hero) hero.troops = Math.floor(hero.troops * 0.95);
          }
          city.troops = this.getCityTotalTroops(cid);
        }
      }},
      { name: '民心不稳', desc: '民心动摇，各城市士气-5', apply() {
        for (const cid in this.cities) {
          if (!Object.prototype.hasOwnProperty.call(this.cities, cid)) continue;
          this.cities[cid].morale = Math.max(0, this.cities[cid].morale - 5);
        }
      }}
    ];
    const event = events[Math.floor(Math.random() * events.length)];
    event.apply.call(this);
    // 只保存可序列化字段，避免闭包函数污染存档
    this._lastEvent = { name: event.name, desc: event.desc };
  },

  _processArmies() {
    for (let i = this.armies.length - 1; i >= 0; i--) {
      const army = this.armies[i];
      army.turnsLeft--;
      if (army.turnsLeft <= 0) {
        this._armyArrive(army);
        this.armies.splice(i, 1);
      }
    }
  },

  _armyArrive(army) {
    const targetCity = this.cities[army.targetCity];
    if (!targetCity) return;

    if (targetCity.faction === army.faction) {
      // 友方城市，进驻
      for (const hid of army.heroIds) {
        const hero = this.heroes[hid];
        if (!hero) continue;
        hero.location = army.targetCity;
        hero.status = 'idle';
        if (targetCity.heroes.indexOf(hero.id) === -1) targetCity.heroes.push(hero.id);
      }
      targetCity.troops = this.getCityTotalTroops(targetCity.id);
      return;
    }

    if (targetCity.heroes.length === 0) {
      // 空城直接占领
      this._occupyCity(army, targetCity);
      return;
    }

    // 有守将：玩家相关则进入战斗场景，否则 AI 自动结算
    const isPlayerInvolved = (army.faction === this.playerFaction) ||
                            (targetCity.faction === this.playerFaction);
    if (isPlayerInvolved) {
      this.battleQueue.push({
        attackerFaction: army.faction,
        defenderFaction: targetCity.faction,
        attackerHeroIds: army.heroIds.slice(),
        defenderHeroIds: targetCity.heroes.slice(),
        targetCity: army.targetCity,
        fromCity: army.fromCity
      });
      this._syncBattleHead();
    } else {
      this._autoResolveBattle(army, targetCity);
    }
  },

  /**
   * 让 this.battle 始终指向队列中第一场尚未结算的战斗。
   * 战斗引擎在 applyResult() 中会把 gd.battle 置空，这里负责补位；
   * 队列清空后回到 strategic，让玩家继续回合。
   */
  _syncBattleHead() {
    this.battle = this.battleQueue.length > 0 ? this.battleQueue[0] : null;
    this.phase = this.battle ? 'battle' : 'strategic';
  },

  /**
   * 一场战斗结算完毕：把它移出队列，再让 battle 指向下一场。
   * 正常情况下传入的就是队首（BattleScene 始终用 gd.battle 初始化引擎）；
   * 若因存档反序列化导致对象引用不一致，则退化为移除队首。
   */
  _completeBattle(battle) {
    if (battle) {
      const idx = this.battleQueue.indexOf(battle);
      if (idx !== -1) this.battleQueue.splice(idx, 1);
      else if (this.battleQueue.length > 0) this.battleQueue.shift();
    }
    this._syncBattleHead();
  },

  /**
   * 兜底清理：任何仍处于 marching 但没有对应在途军队的武将，
   * 一律退回其所属势力的首座城市，避免其永久卡死（既不能出征也不能回城）。
   */
  _rescueStrandedHeroes() {
    const marchingIds = new Set();
    for (const army of this.armies) {
      for (const hid of army.heroIds) marchingIds.add(hid);
    }
    // 正在队列中等待结算的战斗，其攻方武将同样属于「在途」，不能拉回城
    for (const pending of this.battleQueue) {
      for (const hid of pending.attackerHeroIds) marchingIds.add(hid);
    }
    for (const hid in this.heroes) {
      if (!Object.prototype.hasOwnProperty.call(this.heroes, hid)) continue;
      const hero = this.heroes[hid];
      if (hero.status !== 'marching') continue;
      if (marchingIds.has(hid)) continue;
      let fallbackCity = null;
      for (const cid in this.cities) {
        if (this.cities[cid].faction === hero.faction) { fallbackCity = cid; break; }
      }
      hero.status = 'idle';
      if (fallbackCity) {
        hero.location = fallbackCity;
        const city = this.cities[fallbackCity];
        if (city.heroes.indexOf(hid) === -1) city.heroes.push(hid);
        city.troops = this.getCityTotalTroops(fallbackCity);
      } else {
        // 该势力已无城池：按被俘处理，转为在野
        hero.location = null;
        hero.faction = 'none';
        hero.troops = 0;
      }
    }
  },

  _occupyCity(army, targetCity) {
    targetCity.faction = army.faction;
    targetCity.morale = 50;
    for (const hid of army.heroIds) {
      const hero = this.heroes[hid];
      if (!hero) continue;
      hero.location = army.targetCity;
      hero.status = 'idle';
      targetCity.heroes.push(hero.id);
    }
    targetCity.troops = this.getCityTotalTroops(targetCity.id);
  },

  _autoResolveBattle(army, targetCity) {
    if (!engines.battle) return;
    const state = engines.battle.init(
      army.heroIds, targetCity.heroes.slice(), army.faction, targetCity.faction
    );
    let maxRounds = AI_AUTO_BATTLE_MAX_ROUNDS;
    while (state.phase !== 'ended' && maxRounds-- > 0) {
      engines.battle.step();
    }
    // 兜底：引擎未自然结束时按剩余战力判定
    if (state.phase !== 'ended') {
      engines.battle.forceEndByTimeout();
    }
    const winner = state.winner || 'defender';
    if (winner === 'attacker') {
      this._occupyCity(army, targetCity);
    } else {
      // 防守方存活：进攻方返回原城
      for (const hid of army.heroIds) {
        const hero = this.heroes[hid];
        if (!hero) continue;
        hero.location = army.fromCity;
        hero.status = 'idle';
        const from = this.cities[army.fromCity];
        if (from && from.heroes.indexOf(hero.id) === -1) from.heroes.push(hero.id);
      }
      const from = this.cities[army.fromCity];
      if (from) from.troops = this.getCityTotalTroops(from.id);
    }
  },

  // ===== 存档（纯序列化，不含平台 IO） =====
  toJSON() {
    return {
      version: 2,
      turn: this.turn,
      phase: this.phase,
      playerFaction: this.playerFaction,
      customFactionId: this.customFactionId,
      customFactionName: this.customFactionId ? factionName(this.customFactionId) : null,
      customFactionColor: this.customFactionId ? factionCss(this.customFactionId) : null,
      customSkills: exportCustomSkills(),
      factions: JSON.parse(JSON.stringify(this.factions)),
      cities: JSON.parse(JSON.stringify(this.cities)),
      heroes: JSON.parse(JSON.stringify(this.heroes)),
      armies: JSON.parse(JSON.stringify(this.armies)),
      battle: this.battle ? JSON.parse(JSON.stringify(this.battle)) : null,
      battleQueue: JSON.parse(JSON.stringify(this.battleQueue)),
      lastEvent: this._lastEvent ? { name: this._lastEvent.name, desc: this._lastEvent.desc } : null
    };
  },

  fromJSON(data) {
    if (!data || typeof data !== 'object') {
      return { ok: false, msg: '存档数据无效' };
    }
    this.turn = data.turn ?? 1;
    this.phase = data.phase || 'strategic';
    this.playerFaction = data.playerFaction;
    this.customFactionId = data.customFactionId || null;
    this.factions = data.factions;
    this.cities = data.cities;
    this.heroes = data.heroes;
    this.armies = Array.isArray(data.armies) ? data.armies : [];
    this.battle = data.battle || null;
    // 旧存档没有 battleQueue 字段，用当前 battle 补成单元素队列
    this.battleQueue = Array.isArray(data.battleQueue)
      ? data.battleQueue
      : (this.battle ? [this.battle] : []);
    this._lastEvent = data.lastEvent || null;

    // 恢复自定义势力的名称与颜色，以及专属技能
    if (this.customFactionId && data.customFactionName && data.customFactionColor) {
      registerCustomFaction(this.customFactionId, data.customFactionName, data.customFactionColor);
    }
    if (data.customSkills) importCustomSkills(data.customSkills);

    this._migrateLegacyFactions();
    return { ok: true, msg: '' };
  },

  /**
   * 迁移旧存档中已被拆分掉的势力 id。
   *
   * 旧版本把吕布/袁绍/张角/孟获等诸侯统一记为 'qun'（群雄）。这些 id 在新版
   * 已不存在，若原样保留，对应城池不会产出资源、AI 也不会行动（僵尸势力）。
   *
   * 这里不按固定映射一刀切，而是查「该城在当前数据里的初始归属」：
   * 城池仍属旧势力（说明未被玩家攻占）才改写，已被攻占的城池保持玩家/新势力不变。
   * 武将同理，按其所在城池或自身初始归属改写。
   */
  _migrateLegacyFactions() {
    const legacyIds = Object.keys(LEGACY_FACTION_REMAP);
    if (legacyIds.length === 0) return;

    const initialCityFaction = {};
    for (const cd of CITIES_DATA) initialCityFaction[cd.id] = cd.faction;
    const initialHeroFaction = {};
    for (const hd of HEROES_DATA) initialHeroFaction[hd.id] = hd.faction;

    const isLegacy = (f) => legacyIds.indexOf(f) !== -1;
    let migratedCities = 0, migratedHeroes = 0;

    for (const cid in this.cities) {
      if (!Object.prototype.hasOwnProperty.call(this.cities, cid)) continue;
      const city = this.cities[cid];
      if (!isLegacy(city.faction)) continue;
      const target = initialCityFaction[cid];
      // 目标势力必须真实存在，否则保持原样交由后续逻辑兜底
      if (!target || isLegacy(target)) continue;
      city.faction = target;
      migratedCities++;
    }

    for (const hid in this.heroes) {
      if (!Object.prototype.hasOwnProperty.call(this.heroes, hid)) continue;
      const hero = this.heroes[hid];
      if (!isLegacy(hero.faction)) continue;
      // 优先跟随所在城池，其次用初始归属
      const loc = hero.location && this.cities[hero.location];
      let target = loc ? loc.faction : initialHeroFaction[hid];
      if (!target || isLegacy(target) || target === 'none') continue;
      hero.faction = target;
      migratedHeroes++;
    }

    // 势力金粮表：补上新势力、清掉已废弃的旧势力
    if (this.factions) {
      for (const legacy of legacyIds) {
        if (!Object.prototype.hasOwnProperty.call(this.factions, legacy)) continue;
        const t = INITIAL_FACTION_TREASURY[LEGACY_FACTION_REMAP[legacy]];
        if (t && !this.factions[LEGACY_FACTION_REMAP[legacy]]) {
          this.factions[LEGACY_FACTION_REMAP[legacy]] = { gold: t.gold, food: t.food };
        }
        delete this.factions[legacy];
      }
      for (const fId of BUILTIN_FACTION_IDS) {
        if (!this.factions[fId]) {
          const t = INITIAL_FACTION_TREASURY[fId] || { gold: 200, food: 200 };
          this.factions[fId] = { gold: t.gold, food: t.food };
        }
      }
    }

    this._migrationNote = (migratedCities || migratedHeroes)
      ? `已迁移旧存档势力：${migratedCities} 城 / ${migratedHeroes} 武将`
      : null;
  },

  // ===== 自定义君主 =====
  initCustomFaction(monarchName, factionNameStr, factionColor, attrs = {}, startCityId, customSkillData) {
    this.init();
    const customFactionId = `custom_${Date.now()}`;
    this.customFactionId = customFactionId;
    this.playerFaction = customFactionId;
    this.factions[customFactionId] = { gold: 500, food: 500 };

    registerCustomFaction(customFactionId, factionNameStr, factionColor);

    const monarchSkillIds = [];
    if (customSkillData) {
      monarchSkillIds.push(registerCustomSkill(customSkillData));
    }

    const monarchId = this._createHeroInternal({
      name: monarchName, faction: customFactionId,
      force: attrs.force || 70, intellect: attrs.intellect || 70,
      politics: attrs.politics || 70, command: attrs.command || 70,
      charisma: attrs.charisma || 70, loyalty: 100, level: 5,
      skills: monarchSkillIds, advisorSkill: customSkillData ? null : 'jimou',
      maxTroops: 8000, troopType: attrs.troopType || 'infantry',
      sp: 100, maxSp: 100, isMonarch: true
    });

    const startCity = this.cities[startCityId];
    if (startCity) {
      if (startCity.faction !== 'none') {
        for (let i = startCity.heroes.length - 1; i >= 0; i--) {
          const h = this.heroes[startCity.heroes[i]];
          if (h) { h.location = null; h.status = 'idle'; h.troops = 0; }
        }
      }
      startCity.faction = customFactionId;
      startCity.heroes = [monarchId];
      const monarch = this.heroes[monarchId];
      monarch.location = startCityId;
      monarch.troops = 3000;
      monarch.status = 'idle';

      // 分配 2 名初始部将，避免君主做内政时无人可出征
      const freeHeroes = [];
      for (const fhId in this.heroes) {
        if (!Object.prototype.hasOwnProperty.call(this.heroes, fhId)) continue;
        const fh = this.heroes[fhId];
        if (fh.faction === 'none' && !fh.location) freeHeroes.push(fh);
      }
      const generalCount = Math.min(2, freeHeroes.length);
      for (let gi = 0; gi < generalCount; gi++) {
        const pickIdx = Math.floor(Math.random() * freeHeroes.length);
        const general = freeHeroes.splice(pickIdx, 1)[0];
        general.faction = customFactionId;
        general.location = startCityId;
        general.status = 'idle';
        general.loyalty = 80;
        general.troops = 1000;
        startCity.heroes.push(general.id);
      }
      startCity.troops = this.getCityTotalTroops(startCityId);
    }

    return { factionId: customFactionId, monarchId };
  },

  _createHeroInternal(config) {
    const id = `custom_hero_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const hero = {
      id,
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
      troops: 0, location: null, status: 'idle',
      hp: 100, maxHp: 100, developTarget: null
    };
    this.heroes[id] = hero;
    return id;
  },

  // ===== 城市操作 =====
  develop(cityId, heroId, target) {
    const city = this.cities[cityId];
    const hero = this.heroes[heroId];
    if (!city || !hero) return { ok: false, msg: '城市或武将不存在' };
    if (hero.faction !== city.faction) return { ok: false, msg: '武将不属于该城市势力' };
    if (hero.location !== cityId) return { ok: false, msg: '武将不在该城市' };
    if (hero.status !== 'idle') return { ok: false, msg: '武将状态不可用' };
    if (target !== 'agriculture' && target !== 'commerce') return { ok: false, msg: '开发类型无效' };
    if (city.developAssign[target]) {
      const oldHero = this.heroes[city.developAssign[target]];
      if (oldHero) { oldHero.status = 'idle'; oldHero.developTarget = null; }
    }
    hero.status = 'developing';
    hero.developTarget = target;
    city.developAssign[target] = heroId;
    return { ok: true, msg: `${hero.name} 开始开发${target === 'agriculture' ? '农业' : '商业'}` };
  },

  recruit(cityId, amount) {
    const city = this.cities[cityId];
    if (!city) return { ok: false, msg: '城市不存在' };
    if (city.faction === 'none') return { ok: false, msg: '在野城市无法征兵' };
    const faction = this.factions[city.faction];
    if (!faction) return { ok: false, msg: '势力不存在' };

    amount = Math.floor(amount);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, msg: '征兵数量无效' };

    let goldCost = Math.floor(amount * RECRUIT_GOLD_PER);
    let foodCost = Math.floor(amount * RECRUIT_FOOD_PER);
    if (faction.gold < goldCost) return { ok: false, msg: '金币不足' };
    if (faction.food < foodCost) return { ok: false, msg: '粮食不足' };

    const currentTroops = this.getCityTotalTroops(cityId);
    if (currentTroops + amount > city.maxTroops) {
      amount = city.maxTroops - currentTroops;
      if (amount <= 0) return { ok: false, msg: '兵力已达上限' };
      goldCost = Math.floor(amount * RECRUIT_GOLD_PER);
      foodCost = Math.floor(amount * RECRUIT_FOOD_PER);
    }

    const idleHeroes = [];
    for (const hid of city.heroes) {
      const h = this.heroes[hid];
      if (h && h.troops < h.maxTroops) idleHeroes.push(h);
    }
    if (idleHeroes.length === 0) return { ok: false, msg: '没有可分配兵力的武将' };

    faction.gold -= goldCost;
    faction.food -= foodCost;
    let remaining = amount;
    for (const hero of idleHeroes) {
      if (remaining <= 0) break;
      const add = Math.min(remaining, hero.maxTroops - hero.troops);
      hero.troops += add;
      remaining -= add;
    }
    city.troops = this.getCityTotalTroops(cityId);
    city.morale = Math.max(0, city.morale - Math.floor(amount / RECRUIT_MORALE_PER));
    return { ok: true, msg: `征兵${amount - remaining}人` };
  },

  search(cityId, heroId) {
    const city = this.cities[cityId];
    const hero = this.heroes[heroId];
    if (!city || !hero) return { ok: false, msg: '城市或武将不存在' };
    const available = [];
    for (const id in this.heroes) {
      if (!Object.prototype.hasOwnProperty.call(this.heroes, id)) continue;
      const h = this.heroes[id];
      if (h.faction === 'none' && !h.location) available.push(h);
    }
    if (available.length === 0) return { ok: false, msg: '附近没有在野武将' };
    const chance = hero.charisma * 0.5 + 10;
    if (Math.random() * 100 > chance) {
      hero.exp += 5;
      return { ok: false, msg: `${hero.name} 搜索未发现武将` };
    }
    const found = available[Math.floor(Math.random() * available.length)];
    found.faction = city.faction;
    found.location = cityId;
    found.status = 'idle';
    found.loyalty = 50;
    found.troops = 800; // 搜索招募的武将自带初始兵力，确保可出征
    if (city.heroes.indexOf(found.id) === -1) city.heroes.push(found.id);
    hero.exp += 10;
    return { ok: true, msg: `${hero.name} 发现了在野武将 ${found.name}！` };
  },

  train(cityId, heroId) {
    const city = this.cities[cityId];
    const hero = this.heroes[heroId];
    if (!city || !hero) return { ok: false, msg: '城市或武将不存在' };
    const increase = Math.floor(hero.command * 0.3) || 1;
    city.morale = Math.min(100, city.morale + increase);
    hero.exp += 5;
    return { ok: true, msg: `${hero.name} 训练部队，士气提升${increase}` };
  },

  dispatchArmy(fromCityId, heroIds, targetCityId) {
    const fromCity = this.cities[fromCityId];
    const toCity = this.cities[targetCityId];
    if (!fromCity || !toCity) return { ok: false, msg: '城市不存在' };
    if (fromCity.adjacent.indexOf(targetCityId) === -1) return { ok: false, msg: '目标城市不相邻' };
    if (!heroIds || heroIds.length === 0) return { ok: false, msg: '未选择出征武将' };

    // 友方城市是「增援」而非「进攻」：_armyArrive 对友方城市会直接把部队并入，
    // 这里不能像以前那样直接拒绝，否则出征面板列出的友方目标点了必然失败。
    const isReinforce = toCity.faction === fromCity.faction;

    const validHeroIds = [];
    for (const hid of heroIds) {
      const hero = this.heroes[hid];
      if (!hero) continue;
      if (hero.location !== fromCityId) continue;
      if (hero.faction !== fromCity.faction) continue;
      // 允许 idle 与 developing 武将出征，marching 除外
      if (hero.status === 'marching') continue;
      if (hero.troops <= 0) continue;
      validHeroIds.push(hid);
    }
    if (validHeroIds.length === 0) return { ok: false, msg: '没有可出征的武将' };

    for (const hid of validHeroIds) {
      const h = this.heroes[hid];
      // 若在做内政，自动取消内政任务
      if (h.status === 'developing' && fromCity.developAssign) {
        if (fromCity.developAssign.agriculture === hid) fromCity.developAssign.agriculture = null;
        if (fromCity.developAssign.commerce === hid) fromCity.developAssign.commerce = null;
        h.developTarget = null;
      }
      h.status = 'marching';
      h.location = null;
      const idx = fromCity.heroes.indexOf(hid);
      if (idx !== -1) fromCity.heroes.splice(idx, 1);
    }
    fromCity.troops = this.getCityTotalTroops(fromCityId);
    this.armies.push({
      id: `army_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      faction: fromCity.faction,
      heroIds: validHeroIds.slice(),
      fromCity: fromCityId,
      targetCity: targetCityId,
      turnsLeft: 1,
      speed: 1
    });
    return {
      ok: true,
      msg: isReinforce
        ? `派出${validHeroIds.length}名武将，增援${toCity.name}`
        : `出兵${validHeroIds.length}名武将，进攻${toCity.name}`
    };
  }
};

export default GD;