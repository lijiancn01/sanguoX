// 三国群英传 - 武将单挑系统
window.SG = window.SG || {};

(function() {
  'use strict';

  // 单挑动作类型
  var ACTION = {
    ATTACK: 'attack',      // 攻击
    DEFEND: 'defend',      // 防御
    SKILL: 'skill',        // 释放技能
    RETREAT: 'retreat'     // 逃跑
  };

  // 单挑状态效果
  var STATUS = {
    NORMAL: 'normal',
    DEFENDING: 'defending', // 防御姿态（下回合减伤50%）
    STUNNED: 'stunned'      // 眩晕（下回合跳过）
  };

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  // 计算武将"速度"（决定先手）
  // 速度 = 武力 * 0.5 + 统率 * 0.3 + 随机值
  function calcSpeed(heroData) {
    if (!heroData) return 50;
    return heroData.force * 0.5 + heroData.leadership * 0.3 + rand(0, 20);
  }

  // 计算单挑攻击力（基础伤害公式）
  // 武力 * 0.8 + 武器加成 + 随机波动
  function calcAttackDamage(attackerData, defenderData, defenderStatus) {
    if (!attackerData) return 0;
    var baseDmg = attackerData.force * 0.8 + rand(0, attackerData.force * 0.2);

    // 暴击：15%概率2倍伤害
    var crit = Math.random() < 0.15;
    if (crit) baseDmg *= 2;

    // 防御姿态减伤50%
    if (defenderStatus === STATUS.DEFENDING) {
      baseDmg *= 0.5;
    }

    // 智力影响闪避（智力差距大则有机会闪避）
    if (defenderData && attackerData) {
      var diff = defenderData.intellect - attackerData.intellect;
      if (diff > 20 && Math.random() < (diff / 200)) {
        return { damage: 0, dodged: true, crit: crit };
      }
    }

    return { damage: Math.floor(baseDmg), dodged: false, crit: crit };
  }

  // 计算单挑防御收益（主动防御时回复少量HP/士气）
  function calcDefendEffect(heroData) {
    if (!heroData) return { morale: 0 };
    return { morale: 5 }; // 防御回复5士气
  }

  var Duel = {
    state: null,           // 当前单挑状态
    onUpdate: null,        // 状态变化回调
    onEnd: null,           // 单挑结束回调

    // 初始化单挑
    init: function(attackerHeroId, defenderHeroId, attackerIsPlayer) {
      var GS = window.SG.GameState;
      var atkData = GS.heroes[attackerHeroId];
      var defData = GS.heroes[defenderHeroId];
      if (!atkData || !defData) return null;

      // 计算最大HP（基础100 + 等级 * 10 + 武力 * 2）
      var atkMaxHp = 100 + (atkData.level || 1) * 10 + (atkData.force || 50) * 2;
      var defMaxHp = 100 + (defData.level || 1) * 10 + (defData.force || 50) * 2;

      // 初始士气（统率高+魅力高则初始士气高）
      var atkMorale = 80 + Math.floor((atkData.charisma || 50) * 0.3);
      var defMorale = 80 + Math.floor((defData.charisma || 50) * 0.3);

      // 谁先手：比较速度
      var atkSpeed = calcSpeed(atkData);
      var defSpeed = calcSpeed(defData);
      var firstActor = atkSpeed >= defSpeed ? 'attacker' : 'defender';

      this.state = {
        phase: 'choosing',       // choosing | acting | animating | ended
        turn: 1,
        firstActor: firstActor,  // 攻方或守方先手
        currentActor: firstActor,
        attacker: {
          heroId: attackerHeroId,
          data: atkData,
          maxHp: atkMaxHp,
          hp: atkMaxHp,
          morale: atkMorale,
          status: STATUS.NORMAL,
          chosenAction: null,
          chosenSkillId: null,
          isPlayer: attackerIsPlayer
        },
        defender: {
          heroId: defenderHeroId,
          data: defData,
          maxHp: defMaxHp,
          hp: defMaxHp,
          morale: defMorale,
          status: STATUS.NORMAL,
          chosenAction: null,
          chosenSkillId: null,
          isPlayer: !attackerIsPlayer
        },
        log: [],
        aiPending: false,
        lastAction: null,
        destinyTriggered: false  // 天命之子是否已触发
      };

      this._addLog('单挑开始：' + atkData.name + ' VS ' + defData.name + '！');
      this._addLog((firstActor === 'attacker' ? atkData.name : defData.name) + ' 速度占优，率先行动！');
      return this.state;
    },

    // 玩家选择行动
    chooseAction: function(actor, action, skillId) {
      if (!this.state || this.state.phase !== 'choosing') return false;
      if (this.state.currentActor !== actor) return false;

      var hero = this.state[actor];
      if (hero.status === STATUS.STUNNED) {
        this._addLog(hero.data.name + ' 处于眩晕状态，跳过行动！');
        this.state.phase = 'acting';
        this.state.lastAction = { type: 'skip', actor: actor };
        return true;
      }

      if (action === ACTION.RETREAT) {
        return this._doRetreat(actor);
      }

      if (action === ACTION.SKILL) {
        if (!skillId) return false;
        var skillData = window.SG.SKILLS_DATA[skillId];
        if (!skillData) return false;
        // 消耗士气代替SP
        var cost = skillData.spCost || 30;
        if (hero.morale < cost) {
          this._addLog(hero.data.name + ' 士气不足，无法使用 ' + skillData.name + '！');
          return false;
        }
        hero.morale -= cost;
      }

      hero.chosenAction = action;
      hero.chosenSkillId = skillId || null;
      this._addLog(hero.data.name + ' 蓄势待发...');
      return true;
    },

    // 执行单挑回合
    executeTurn: function() {
      if (!this.state || this.state.phase === 'ended') return null;
      if (this.state.phase === 'choosing') return null;

      var firstActor = this.state.firstActor;
      var secondActor = firstActor === 'attacker' ? 'defender' : 'attacker';

      // 第一个行动者执行
      var events = [];
      var firstEvent = this._executeAction(firstActor);
      if (firstEvent) events.push(firstEvent);

      // 检查是否结束
      if (this._isDuelOver()) {
        this._endDuel();
        return events;
      }

      // 第二个行动者执行
      var secondEvent = this._executeAction(secondActor);
      if (secondEvent) events.push(secondEvent);

      // 再次检查
      if (this._isDuelOver()) {
        this._endDuel();
        return events;
      }

      // 回合结束：清空状态、回合+1
      this._endRound();

      return events;
    },

    // 执行单个行动
    _executeAction: function(actor) {
      var hero = this.state[actor];
      var enemy = actor === 'attacker' ? this.state.defender : this.state.attacker;

      // 跳过（眩晕）
      if (hero.status === STATUS.STUNNED) {
        hero.status = STATUS.NORMAL;
        this._addLog(hero.data.name + ' 眩晕中，跳过本回合！');
        return { type: 'skip', actor: actor };
      }

      // AI 自动决策（如果是AI控制）
      if (!hero.isPlayer && !hero.chosenAction) {
        this._aiChooseAction(actor);
      }

      var action = hero.chosenAction;
      var event = null;

      if (action === ACTION.ATTACK) {
        event = this._doAttack(actor);
      } else if (action === ACTION.DEFEND) {
        event = this._doDefend(actor);
      } else if (action === ACTION.SKILL) {
        event = this._doSkill(actor);
      } else if (action === ACTION.RETREAT) {
        // 逃跑已在chooseAction中处理
        event = { type: 'retreat', actor: actor };
      } else {
        // 默认攻击
        event = this._doAttack(actor);
      }

      // 清除选择
      hero.chosenAction = null;
      hero.chosenSkillId = null;

      return event;
    },

    // 攻击
    _doAttack: function(actor) {
      var hero = this.state[actor];
      var enemy = actor === 'attacker' ? this.state.defender : this.state.attacker;

      var result = calcAttackDamage(hero.data, enemy.data, enemy.status);
      var dmg = result.damage;

      if (result.dodged) {
        this._addLog(enemy.data.name + ' 灵巧地闪避了 ' + hero.data.name + ' 的攻击！');
      } else {
        enemy.hp = Math.max(0, enemy.hp - dmg);
        var critTxt = result.crit ? '（暴击！）' : '';
        this._addLog(hero.data.name + ' 出招攻击 ' + enemy.data.name + '，造成 ' + dmg + ' 点伤害' + critTxt);
      }

      // 天命之子：受击方是自定义君主且HP<=10%时触发
      var destinyEvent = this._checkDestiny(enemy, actor);

      // 攻击方小幅掉士气
      hero.morale = Math.max(0, hero.morale - 2);
      // 受击方士气降低
      enemy.morale = Math.max(0, enemy.morale - 3);

      var event = {
        type: 'attack',
        actor: actor,
        attackerName: hero.data.name,
        defenderName: enemy.data.name,
        damage: dmg,
        dodged: result.dodged,
        crit: result.crit,
        targetHp: enemy.hp,
        targetMaxHp: enemy.maxHp
      };
      if (destinyEvent) {
        event.destiny = destinyEvent;
      }
      return event;
    },

    // 防御
    _doDefend: function(actor) {
      var hero = this.state[actor];
      hero.status = STATUS.DEFENDING;
      var eff = calcDefendEffect(hero.data);
      hero.morale = Math.min(100, hero.morale + eff.morale);
      this._addLog(hero.data.name + ' 摆出防御架势，蓄势待发！');
      return {
        type: 'defend',
        actor: actor,
        heroName: hero.data.name
      };
    },

    // 技能
    _doSkill: function(actor) {
      var hero = this.state[actor];
      var enemy = actor === 'attacker' ? this.state.defender : this.state.attacker;

      var skillId = hero.chosenSkillId;
      if (!skillId) {
        // 默认普通攻击
        return this._doAttack(actor);
      }

      var skillData = window.SG.SKILLS_DATA[skillId];
      if (!skillData) return this._doAttack(actor);

      // 根据技能效果类型计算效果
      var power = skillData.power || 80;
      var event = {
        type: 'skill',
        actor: actor,
        skillId: skillId,
        skillName: skillData.name,
        casterName: hero.data.name,
        targetName: enemy.data.name,
        element: skillData.element || 'ink',
        animation: skillData.element === 'fire' ? 'fire' : (skillData.element === 'thunder' ? 'lightning' : 'ink'),
        effects: []
      };

      var effType = skillData.effectType || 'damage';

      if (effType === 'damage' || effType === 'burn' || effType === 'stun') {
        // 伤害型技能
        var intelBonus = (hero.data.intellect || 50) * 0.3;
        var dmg = Math.floor(power + intelBonus + rand(0, 20));
        if (effType === 'burn') {
          dmg = Math.floor(dmg * 0.7); // 灼烧分两部分
        }
        enemy.hp = Math.max(0, enemy.hp - dmg);
        event.effects.push({ type: 'damage', value: dmg });
        event.targetHp = enemy.hp;
        event.targetMaxHp = enemy.maxHp;
        this._addLog(hero.data.name + ' 施展「' + skillData.name + '」对 ' + enemy.data.name + ' 造成 ' + dmg + ' 点伤害！');

        // 天命之子检查
        var destinyEvent = this._checkDestiny(enemy, actor);
        if (destinyEvent) {
          event.destiny = destinyEvent;
        }
        enemy.morale = Math.max(0, enemy.morale - 5);

        // 灼烧：附加持续伤害
        if (effType === 'burn') {
          event.effects.push({ type: 'burn', value: Math.floor(power * 0.3) });
          this._addLog(enemy.data.name + ' 身陷灼烧之中！');
        }

        // 眩晕：30%概率
        if (effType === 'stun' && Math.random() < 0.3 && enemy.status !== STATUS.STUNNED) {
          enemy.status = STATUS.STUNNED;
          event.effects.push({ type: 'stun' });
          this._addLog(enemy.data.name + ' 被眩晕！');
        }
      } else if (effType === 'buff_attack') {
        // 攻击增益：下次攻击伤害+50%
        event.effects.push({ type: 'buff_attack' });
        this._addLog(hero.data.name + ' 施展「' + skillData.name + '」蓄势待发，下回合攻击大幅提升！');
        hero.status = 'attack_buffed';
      } else if (effType === 'buff_defense') {
        // 防御增益：变成防御姿态并减伤更高
        event.effects.push({ type: 'buff_defense' });
        hero.status = STATUS.DEFENDING;
        this._addLog(hero.data.name + ' 施展「' + skillData.name + '」稳如磐石！');
      } else if (effType === 'debuff_attack') {
        // 攻击减益：敌方下次攻击伤害-30%
        event.effects.push({ type: 'debuff_attack' });
        enemy.status = 'attack_debuffed';
        this._addLog(hero.data.name + ' 施展「' + skillData.name + '」削弱 ' + enemy.data.name + ' 的攻击！');
      } else if (effType === 'debuff_defense') {
        // 防御减益：敌方防御姿态失效
        event.effects.push({ type: 'debuff_defense' });
        enemy.status = 'defense_broken';
        this._addLog(hero.data.name + ' 识破 ' + enemy.data.name + ' 的防御！');
      } else if (effType === 'morale_up') {
        hero.morale = Math.min(150, hero.morale + power);
        event.effects.push({ type: 'morale_up', value: power });
        this._addLog(hero.data.name + ' 施展「' + skillData.name + '」士气大振！');
      } else if (effType === 'morale_down') {
        enemy.morale = Math.max(0, enemy.morale - power);
        event.effects.push({ type: 'morale_down', value: power });
        this._addLog(hero.data.name + ' 施展「' + skillData.name + '」使 ' + enemy.data.name + ' 士气低落！');
      } else if (effType === 'heal_troops' || effType === 'heal_hp') {
        // 单挑中没有兵力，恢复HP
        var heal = Math.floor(power * 0.5);
        hero.hp = Math.min(hero.maxHp, hero.hp + heal);
        event.effects.push({ type: 'heal', value: heal });
        event.targetHp = hero.hp;
        event.targetMaxHp = hero.maxHp;
        this._addLog(hero.data.name + ' 施展「' + skillData.name + '」恢复 ' + heal + ' 点体力！');
      } else if (effType === 'restore_sp') {
        // 恢复士气代替SP
        var gain = Math.floor(power * 0.5);
        hero.morale = Math.min(150, hero.morale + gain);
        event.effects.push({ type: 'restore_sp', value: gain });
        this._addLog(hero.data.name + ' 施展「' + skillData.name + '」恢复 ' + gain + ' 点气势！');
      } else {
        // 默认按伤害处理
        var fallbackDmg = Math.floor(power + rand(0, 20));
        enemy.hp = Math.max(0, enemy.hp - fallbackDmg);
        event.effects.push({ type: 'damage', value: fallbackDmg });
        this._addLog(hero.data.name + ' 施展「' + skillData.name + '」！');
      }

      return event;
    },

    // 逃跑
    _doRetreat: function(actor) {
      var hero = this.state[actor];
      this._addLog(hero.data.name + ' 转身撤离战场！');
      this.state.winner = actor === 'attacker' ? 'defender' : 'attacker';
      this.state.loser = actor;
      this.state.endReason = 'retreat';
      this.state.phase = 'ended';
      return { type: 'retreat', actor: actor, heroName: hero.data.name };
    },

    // AI决策
    _aiChooseAction: function(actor) {
      var hero = this.state[actor];
      var enemy = actor === 'attacker' ? this.state.defender : this.state.attacker;

      // AI策略：HP高则攻击，HP低则防御，气势高则放技能
      var hpRatio = hero.hp / hero.maxHp;

      // 30%概率防御（如果血量低于50%）
      if (hpRatio < 0.5 && Math.random() < 0.3) {
        hero.chosenAction = ACTION.DEFEND;
        return;
      }

      // 30%概率放技能（如果有技能且气势足够）
      var skills = (hero.data && hero.data.skills) || [];
      if (skills.length > 0 && hero.morale > 40 && Math.random() < 0.3) {
        // 找一个能负担的技能
        for (var i = 0; i < skills.length; i++) {
          var sData = window.SG.SKILLS_DATA[skills[i]];
          if (sData && hero.morale >= sData.spCost) {
            hero.chosenAction = ACTION.SKILL;
            hero.chosenSkillId = skills[i];
            return;
          }
        }
      }

      // 默认攻击
      hero.chosenAction = ACTION.ATTACK;
    },

    // 回合结束
    _endRound: function() {
      // 清除临时状态（防御姿态只持续1回合）
      this.state.attacker.status = STATUS.NORMAL;
      this.state.defender.status = STATUS.NORMAL;

      this.state.turn++;
      this.state.firstActor = this.state.firstActor === 'attacker' ? 'defender' : 'attacker';
      this.state.currentActor = this.state.firstActor;
      this.state.phase = 'choosing';

      this._addLog('--- 第 ' + this.state.turn + ' 回合 ---');
    },

    // 检查单挑是否结束
    _isDuelOver: function() {
      if (this.state.attacker.hp <= 0) {
        this.state.winner = 'defender';
        this.state.loser = 'attacker';
        this.state.endReason = 'ko';
        return true;
      }
      if (this.state.defender.hp <= 0) {
        this.state.winner = 'attacker';
        this.state.loser = 'defender';
        this.state.endReason = 'ko';
        return true;
      }
      if (this.state.phase === 'ended') return true;
      return false;
    },

    // 结束单挑
    _endDuel: function() {
      this.state.phase = 'ended';
      var winnerName = this.state.winner === 'attacker' ? this.state.attacker.data.name : this.state.defender.data.name;
      var loserName = this.state.winner === 'attacker' ? this.state.defender.data.name : this.state.attacker.data.name;
      this._addLog('单挑结束！' + winnerName + ' 击败 ' + loserName + '！');
    },

    // 添加日志
    _addLog: function(msg) {
      if (!this.state) return;
      this.state.log.push({ turn: this.state.turn, msg: msg });
      if (this.state.log.length > 50) this.state.log.shift();
    },

    // 天命之子：自定义君主单挑中HP<=10%时锁血+爆发
    _checkDestiny: function(hero, attackerActor) {
      if (this.state.destinyTriggered) return null;
      if (!hero.data || !hero.data.isMonarch || !hero.data.isCustom) return null;
      if (hero.hp <= 0 || hero.maxHp <= 0) return null;

      var threshold = Math.floor(hero.maxHp * 0.1);
      if (hero.hp > threshold) return null;

      // 锁血到10%
      hero.hp = threshold;

      // 天命爆发：对敌方造成巨额伤害
      var enemy = hero === this.state.attacker ? this.state.defender : this.state.attacker;
      var burstDamage = Math.floor(hero.maxHp * 1.5);
      enemy.hp = Math.max(0, enemy.hp - burstDamage);
      hero.morale = Math.min(200, hero.morale + 80);

      this.state.destinyTriggered = true;
      this._addLog('★ 天命之子！' + hero.data.name + ' 气血将尽之际爆发天命之力！雷霆万钧！');

      return {
        type: 'destiny',
        heroName: hero.data.name,
        heroId: hero.data.id,
        damage: burstDamage,
        targetName: enemy.data.name,
        targetHp: enemy.hp,
        targetMaxHp: enemy.maxHp
      };
    },

    // 获取当前单挑状态
    getState: function() {
      return this.state;
    },

    // 获取结果
    getResult: function() {
      if (!this.state) return null;
      return {
        winner: this.state.winner,
        loser: this.state.loser,
        endReason: this.state.endReason,
        attacker: {
          heroId: this.state.attacker.heroId,
          hp: this.state.attacker.hp,
          maxHp: this.state.attacker.maxHp
        },
        defender: {
          heroId: this.state.defender.heroId,
          hp: this.state.defender.hp,
          maxHp: this.state.defender.maxHp
        }
      };
    },

    // 清理单挑
    clear: function() {
      this.state = null;
    }
  };

  // 导出动作常量
  window.SG.DuelAction = ACTION;
  window.SG.DuelStatus = STATUS;
  window.SG.DuelSystem = Duel;

})();
