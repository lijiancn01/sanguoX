// 三国群英传 - 技能数据
window.SG = window.SG || {};

// 技能效果类型枚举
window.SG.SKILL_EFFECT_TYPE = {
  DAMAGE: 'damage',           // 伤害
  HEAL_TROOPS: 'heal_troops',  // 恢复兵力
  HEAL_HP: 'heal_hp',          // 恢复HP
  RESTORE_SP: 'restore_sp',    // 恢复技力
  BUFF_ATTACK: 'buff_attack',  // 攻击增益
  BUFF_DEFENSE: 'buff_defense',// 防御增益
  DEBUFF_ATTACK: 'debuff_attack',// 攻击减益
  DEBUFF_DEFENSE: 'debuff_defense',// 防御减益
  MORALE_UP: 'morale_up',      // 士气提升
  MORALE_DOWN: 'morale_down',  // 士气降低
  BURN: 'burn',                // 灼烧（持续伤害）
  STUN: 'stun',                // 眩晕（跳过回合）
  STEAL_SP: 'steal_sp',        // 吸取技力
  DOUBLE_STRIKE: 'double_strike',// 双击
  CRITICAL: 'critical'         // 暴击提升
};

window.SG.SKILLS_DATA = {
  // ===== 武将技 - 伤害型 =====
  jianxiong: { id:'jianxiong', name:'奸雄', type:'combat', effectType:'damage', spCost:30, power:90, range:'area', element:'ink', desc:'以奸雄之姿压制敌军，对敌方全体造成伤害', isExclusive:false, exclusiveHero:null },
  ganglie: { id:'ganglie', name:'刚烈', type:'combat', effectType:'damage', spCost:20, power:75, range:'single', element:'ink', desc:'以刚烈之气猛攻敌将', isExclusive:false, exclusiveHero:null },
  tuci: { id:'tuci', name:'突刺', type:'combat', effectType:'damage', spCost:15, power:60, range:'single', element:'ink', desc:'迅猛突刺敌将', isExclusive:false, exclusiveHero:null },
  shenjian: { id:'shenjian', name:'神箭', type:'combat', effectType:'damage', spCost:20, power:80, range:'single', element:'ink', desc:'百步穿杨，精准射杀敌将', isExclusive:false, exclusiveHero:null },
  xuanfengzhan: { id:'xuanfengzhan', name:'旋风斩', type:'combat', effectType:'damage', spCost:25, power:85, range:'area', element:'ink', desc:'旋风斩敌，对周围敌军造成伤害', isExclusive:false, exclusiveHero:null },
  xiaoyaojin: { id:'xiaoyaojin', name:'逍遥津', type:'combat', effectType:'damage', spCost:35, power:100, range:'area', element:'ink', desc:'威震逍遥津，大范围杀伤敌军', isExclusive:false, exclusiveHero:null },
  luoren: { id:'luoren', name:'裸衣', type:'combat', effectType:'damage', spCost:20, power:80, range:'single', element:'ink', desc:'裸衣力战，以命搏命（自身受到少量伤害）', isExclusive:false, exclusiveHero:null, selfDamage:10 },
  nuji: { id:'nuji', name:'怒击', type:'combat', effectType:'damage', spCost:15, power:65, range:'single', element:'ink', desc:'怒气爆发猛击敌将', isExclusive:false, exclusiveHero:null },
  tianguan: { id:'tianguan', name:'天妒', type:'combat', effectType:'damage', spCost:30, power:95, range:'single', element:'ink', desc:'天妒英才，对敌将造成毁灭打击', isExclusive:false, exclusiveHero:null },
  wusheng: { id:'wusheng', name:'武圣', type:'combat', effectType:'damage', spCost:35, power:100, range:'single', element:'ink', desc:'武圣降临，斩杀敌将（高暴击率）', isExclusive:false, exclusiveHero:null, critBonus:30 },
  qinglongyanyue: { id:'qinglongyanyue', name:'青龙偃月', type:'combat', effectType:'damage', spCost:40, power:120, range:'single', element:'ink', desc:'青龙偃月刀横扫千军', isExclusive:false, exclusiveHero:null },
  paoxiao: { id:'paoxiao', name:'咆哮', type:'combat', effectType:'damage', spCost:25, power:85, range:'area', element:'ink', desc:'猛将咆哮，震慑敌军', isExclusive:false, exclusiveHero:null },
  longdan: { id:'longdan', name:'龙胆', type:'combat', effectType:'damage', spCost:30, power:95, range:'single', element:'ink', desc:'龙胆虎威，一骑当千', isExclusive:false, exclusiveHero:null },
  guanxing: { id:'guanxing', name:'观星', type:'combat', effectType:'damage', spCost:25, power:70, range:'area', element:'ink', desc:'夜观天象，借天势攻敌', isExclusive:false, exclusiveHero:null },
  huoshao: { id:'huoshao', name:'火烧', type:'combat', effectType:'damage', spCost:35, power:100, range:'area', element:'fire', desc:'火烧连营，大范围灼烧敌军（附加灼烧效果）', isExclusive:false, exclusiveHero:null, statusEffect:'burn', statusDuration:3 },
  fenghuo: { id:'fenghuo', name:'凤火', type:'combat', effectType:'damage', spCost:30, power:90, range:'area', element:'fire', desc:'凤火燎原，焚尽敌军', isExclusive:false, exclusiveHero:null },
  tieqi: { id:'tieqi', name:'铁骑', type:'combat', effectType:'damage', spCost:25, power:80, range:'area', element:'ink', desc:'铁骑冲锋，横扫敌阵', isExclusive:false, exclusiveHero:null },
  qixi: { id:'qixi', name:'奇袭', type:'combat', effectType:'damage', spCost:25, power:85, range:'single', element:'ink', desc:'出奇不意袭击敌将（必中）', isExclusive:false, exclusiveHero:null },
  kurou: { id:'kurou', name:'苦肉', type:'combat', effectType:'damage', spCost:20, power:75, range:'single', element:'ink', desc:'苦肉计，以伤换伤（自伤换高伤害）', isExclusive:false, exclusiveHero:null, selfDamage:15 },
  zhiheng: { id:'zhiheng', name:'制衡', type:'combat', effectType:'debuff_defense', spCost:25, power:30, range:'area', element:'ink', desc:'制衡天下，削弱敌军防御', isExclusive:false, exclusiveHero:null, buffDuration:3 },
  wushuang: { id:'wushuang', name:'无双', type:'combat', effectType:'damage', spCost:40, power:130, range:'area', element:'ink', desc:'天下无双，横扫千军', isExclusive:false, exclusiveHero:null },
  feijiang: { id:'feijiang', name:'飞将', type:'combat', effectType:'damage', spCost:30, power:90, range:'single', element:'ink', desc:'飞将突袭，直取敌将', isExclusive:false, exclusiveHero:null },
  lijian: { id:'lijian', name:'离间', type:'combat', effectType:'morale_down', spCost:25, power:20, range:'area', element:'ink', desc:'离间敌军，降低敌方士气', isExclusive:false, exclusiveHero:null },
  mengjin: { id:'mengjin', name:'猛进', type:'combat', effectType:'damage', spCost:20, power:70, range:'area', element:'ink', desc:'猛力突进，冲击敌阵', isExclusive:false, exclusiveHero:null },
  leiji: { id:'leiji', name:'雷击', type:'combat', effectType:'damage', spCost:35, power:100, range:'area', element:'lightning', desc:'天雷降世，轰击敌军（有几率眩晕）', isExclusive:false, exclusiveHero:null, statusEffect:'stun', statusChance:20, statusDuration:1 },
  xiang: { id:'xiang', name:'象阵', type:'combat', effectType:'damage', spCost:25, power:80, range:'area', element:'ink', desc:'驱象冲阵，践踏敌军', isExclusive:false, exclusiveHero:null },
  guli: { id:'guli', name:'孤立', type:'combat', effectType:'damage', spCost:20, power:70, range:'single', element:'ink', desc:'孤军奋战，猛攻敌将', isExclusive:false, exclusiveHero:null },

  // ===== 武将技 - 恢复/辅助型 =====
  yingzi: { id:'yingzi', name:'英姿', type:'combat', effectType:'restore_sp', spCost:20, power:40, range:'self', element:'ink', desc:'英姿飒爽，恢复自身技力', isExclusive:false, exclusiveHero:null },
  keji: { id:'keji', name:'克己', type:'combat', effectType:'restore_sp', spCost:0, power:30, range:'self', element:'ink', desc:'克己复礼，恢复技力', isExclusive:false, exclusiveHero:null },
  rende: { id:'rende', name:'仁德', type:'combat', effectType:'heal_troops', spCost:20, power:50, range:'self', element:'ink', desc:'仁德广施，恢复己方兵力', isExclusive:false, exclusiveHero:null },
  buxiu: { id:'buxiu', name:'不屈', type:'combat', effectType:'heal_hp', spCost:15, power:40, range:'self', element:'ink', desc:'不屈意志，恢复HP', isExclusive:false, exclusiveHero:null },
  tuntian: { id:'tuntian', name:'屯田', type:'combat', effectType:'heal_troops', spCost:15, power:50, range:'self', element:'ink', desc:'屯田蓄力，恢复兵力', isExclusive:false, exclusiveHero:null },
  jiyi: { id:'jiyi', name:'结义', type:'combat', effectType:'morale_up', spCost:25, power:25, range:'ally', element:'ink', desc:'桃园结义，提升全军士气', isExclusive:false, exclusiveHero:null },
  guohe: { id:'guohe', name:'鬼谋', type:'combat', effectType:'debuff_attack', spCost:25, power:20, range:'area', element:'ink', desc:'运筹帷幄，鬼神莫测，降低敌军攻击', isExclusive:false, exclusiveHero:null, buffDuration:3 },

  // ===== 武将技 - 专属技能 =====
  // （历史名将的专属技能，玩家自定义武将也可设计自己的专属技能）
  bawang: { id:'bawang', name:'霸王', type:'combat', effectType:'damage', spCost:50, power:150, range:'area', element:'ink', desc:'西楚霸王再世，毁灭一切敌人', isExclusive:true, exclusiveHero:'custom', isCustomTemplate:true },
  longteng: { id:'longteng', name:'龙腾', type:'combat', effectType:'damage', spCost:45, power:140, range:'single', element:'lightning', desc:'龙腾九霄，雷霆万钧', isExclusive:true, exclusiveHero:'custom', isCustomTemplate:true },
  fengming: { id:'fengming', name:'凤鸣', type:'combat', effectType:'heal_troops', spCost:40, power:100, range:'ally', element:'fire', desc:'凤鸣九天，全军兵力恢复并提升士气', isExclusive:true, exclusiveHero:'custom', isCustomTemplate:true, bonusEffect:'morale_up', bonusPower:20 },
  tianxia: { id:'tianxia', name:'天下', type:'combat', effectType:'damage', spCost:50, power:160, range:'area', element:'ink', desc:'天下布武，唯我独尊', isExclusive:true, exclusiveHero:'custom', isCustomTemplate:true },
  qilin: { id:'qilin', name:'麒麟', type:'combat', effectType:'buff_attack', spCost:35, power:40, range:'ally', element:'ink', desc:'麒麟降世，全军攻击大幅提升', isExclusive:true, exclusiveHero:'custom', isCustomTemplate:true, buffDuration:4 },
  shenwei: { id:'shenwei', name:'神威', type:'combat', effectType:'damage', spCost:45, power:130, range:'single', element:'ink', desc:'神威如狱，一击必杀（高暴击）', isExclusive:true, exclusiveHero:'custom', isCustomTemplate:true, critBonus:50 },

  // ===== 军师技 =====
  jimou: { id:'jimou', name:'计谋', type:'advisor', effectType:'morale_up', spCost:0, power:10, range:'ally', element:'ink', desc:'战前计谋，提升全军士气10点', isExclusive:false, exclusiveHero:null },
  guwu: { id:'guwu', name:'鼓舞', type:'advisor', effectType:'buff_attack', spCost:0, power:15, range:'ally', element:'ink', desc:'战前鼓舞，提升全军攻击力15%', isExclusive:false, exclusiveHero:null, buffDuration:99 },
  yaohuo: { id:'yaohuo', name:'妖惑', type:'advisor', effectType:'morale_down', spCost:0, power:10, range:'enemy', element:'ink', desc:'战前妖惑，降低敌军士气10点', isExclusive:false, exclusiveHero:null },
  lianzhen: { id:'lianzhen', name:'连阵', type:'advisor', effectType:'buff_defense', spCost:0, power:15, range:'ally', element:'ink', desc:'战前布阵，提升全军防御力15%', isExclusive:false, exclusiveHero:null, buffDuration:99 },
};

// 自定义专属技能存储（运行时动态添加）
window.SG.CUSTOM_SKILLS = {};

// 注册自定义专属技能
window.SG.registerCustomSkill = function(skillData) {
  var id = 'custom_skill_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  var skill = {
    id: id,
    name: skillData.name || '无名技',
    type: 'combat',
    effectType: skillData.effectType || 'damage',
    spCost: skillData.spCost || 30,
    power: skillData.power || 80,
    range: skillData.range || 'single',
    element: skillData.element || 'ink',
    desc: skillData.desc || '专属武将技',
    isExclusive: true,
    exclusiveHero: skillData.heroId || null,
    isCustom: true,
    statusEffect: skillData.statusEffect || null,
    statusChance: skillData.statusChance || 0,
    statusDuration: skillData.statusDuration || 0,
    critBonus: skillData.critBonus || 0,
    selfDamage: skillData.selfDamage || 0,
    buffDuration: skillData.buffDuration || 3
  };
  window.SG.CUSTOM_SKILLS[id] = skill;
  window.SG.SKILLS_DATA[id] = skill;
  return id;
};

// 获取所有可选技能（不含自定义模板，供普通选择用）
window.SG.getSelectableSkills = function() {
  var result = [];
  var data = window.SG.SKILLS_DATA;
  for (var id in data) {
    if (data.hasOwnProperty(id) && !data[id].isCustomTemplate && data[id].type === 'combat') {
      result.push(data[id]);
    }
  }
  return result;
};

// 获取所有军师技
window.SG.getAdvisorSkills = function() {
  var result = [];
  var data = window.SG.SKILLS_DATA;
  for (var id in data) {
    if (data.hasOwnProperty(id) && data[id].type === 'advisor') {
      result.push(data[id]);
    }
  }
  return result;
};

// 技能效果类型中文名称映射
window.SG.EFFECT_TYPE_NAMES = {
  damage: '伤害',
  heal_troops: '恢复兵力',
  heal_hp: '恢复HP',
  restore_sp: '恢复技力',
  buff_attack: '攻击增益',
  buff_defense: '防御增益',
  debuff_attack: '攻击减益',
  debuff_defense: '防御减益',
  morale_up: '士气提升',
  morale_down: '士气降低',
  burn: '灼烧',
  stun: '眩晕'
};

// 技能范围中文名称映射
window.SG.RANGE_NAMES = {
  single: '单体',
  area: '群体',
  self: '自身',
  ally: '我方全体',
  enemy: '敌方全体'
};

// 技能元素类型
window.SG.ELEMENT_NAMES = {
  ink: '墨系',
  fire: '火系',
  lightning: '雷系'
};
