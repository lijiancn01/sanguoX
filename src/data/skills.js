/**
 * 三国群英传 - 技能数据（引擎无关纯数据）
 * @author jian.li
 */

export const SKILLS_DATA = {
  // ===== 伤害型 =====
  jianxiong: { id:'jianxiong', name:'奸雄', type:'combat', effectType:'damage', spCost:30, power:90, range:'area', element:'ink', desc:'以奸雄之姿压制敌军，对敌方全体造成伤害' },
  ganglie: { id:'ganglie', name:'刚烈', type:'combat', effectType:'damage', spCost:20, power:75, range:'single', element:'ink', desc:'以刚烈之气猛攻敌将' },
  tuci: { id:'tuci', name:'突刺', type:'combat', effectType:'damage', spCost:15, power:60, range:'single', element:'ink', desc:'迅猛突刺敌将' },
  shenjian: { id:'shenjian', name:'神箭', type:'combat', effectType:'damage', spCost:20, power:80, range:'single', element:'ink', desc:'百步穿杨，精准射杀敌将' },
  xuanfengzhan: { id:'xuanfengzhan', name:'旋风斩', type:'combat', effectType:'damage', spCost:25, power:85, range:'area', element:'ink', desc:'旋风斩敌，对周围敌军造成伤害' },
  xiaoyaojin: { id:'xiaoyaojin', name:'逍遥津', type:'combat', effectType:'damage', spCost:35, power:100, range:'area', element:'ink', desc:'威震逍遥津，大范围杀伤敌军' },
  luoren: { id:'luoren', name:'裸衣', type:'combat', effectType:'damage', spCost:20, power:80, range:'single', element:'ink', desc:'裸衣力战，以命搏命', selfDamage:10 },
  nuji: { id:'nuji', name:'怒击', type:'combat', effectType:'damage', spCost:15, power:65, range:'single', element:'ink', desc:'怒气爆发猛击敌将' },
  tianguan: { id:'tianguan', name:'天妒', type:'combat', effectType:'damage', spCost:30, power:95, range:'single', element:'ink', desc:'天妒英才，对敌将造成毁灭打击' },
  wusheng: { id:'wusheng', name:'武圣', type:'combat', effectType:'damage', spCost:35, power:100, range:'single', element:'ink', desc:'武圣降临，斩杀敌将', critBonus:30 },
  qinglongyanyue: { id:'qinglongyanyue', name:'青龙偃月', type:'combat', effectType:'damage', spCost:40, power:120, range:'single', element:'ink', desc:'青龙偃月刀横扫千军' },
  paoxiao: { id:'paoxiao', name:'咆哮', type:'combat', effectType:'damage', spCost:25, power:85, range:'area', element:'ink', desc:'猛将咆哮，震慑敌军' },
  longdan: { id:'longdan', name:'龙胆', type:'combat', effectType:'damage', spCost:30, power:95, range:'single', element:'ink', desc:'龙胆虎威，一骑当千' },
  guanxing: { id:'guanxing', name:'观星', type:'combat', effectType:'damage', spCost:25, power:70, range:'area', element:'ink', desc:'夜观天象，借天势攻敌' },
  huoshao: { id:'huoshao', name:'火烧', type:'combat', effectType:'damage', spCost:35, power:100, range:'area', element:'fire', desc:'火烧连营，大范围灼烧敌军', statusEffect:'burn', statusDuration:3 },
  fenghuo: { id:'fenghuo', name:'凤火', type:'combat', effectType:'damage', spCost:30, power:90, range:'area', element:'fire', desc:'凤火燎原，焚尽敌军' },
  tieqi: { id:'tieqi', name:'铁骑', type:'combat', effectType:'damage', spCost:25, power:80, range:'area', element:'ink', desc:'铁骑冲锋，横扫敌阵' },
  qixi: { id:'qixi', name:'奇袭', type:'combat', effectType:'damage', spCost:25, power:85, range:'single', element:'ink', desc:'出奇不意袭击敌将' },
  kurou: { id:'kurou', name:'苦肉', type:'combat', effectType:'damage', spCost:20, power:75, range:'single', element:'ink', desc:'苦肉计，以伤换命', selfDamage:15 },
  wushuang: { id:'wushuang', name:'无双', type:'combat', effectType:'damage', spCost:40, power:130, range:'area', element:'ink', desc:'天下无双，横扫千军' },
  feijiang: { id:'feijiang', name:'飞将', type:'combat', effectType:'damage', spCost:30, power:90, range:'single', element:'ink', desc:'飞将突袭，直取敌将' },
  leiji: { id:'leiji', name:'雷击', type:'combat', effectType:'damage', spCost:35, power:100, range:'area', element:'lightning', desc:'天雷降世，轰击敌军', statusEffect:'stun', statusChance:20, statusDuration:1 },
  xiang: { id:'xiang', name:'象阵', type:'combat', effectType:'damage', spCost:25, power:80, range:'area', element:'ink', desc:'驱象冲阵，践踏敌军' },
  guli: { id:'guli', name:'孤立', type:'combat', effectType:'damage', spCost:20, power:70, range:'single', element:'ink', desc:'孤军奋战，猛攻敌将' },
  mengjin: { id:'mengjin', name:'猛进', type:'combat', effectType:'damage', spCost:20, power:70, range:'area', element:'ink', desc:'猛力突进，冲击敌阵' },

  // ===== 恢复/辅助型 =====
  yingzi: { id:'yingzi', name:'英姿', type:'combat', effectType:'restore_sp', spCost:20, power:40, range:'self', element:'ink', desc:'英姿飒爽，恢复自身技力' },
  keji: { id:'keji', name:'克己', type:'combat', effectType:'restore_sp', spCost:0, power:30, range:'self', element:'ink', desc:'克己复礼，恢复技力' },
  rende: { id:'rende', name:'仁德', type:'combat', effectType:'heal_troops', spCost:20, power:50, range:'self', element:'ink', desc:'仁德广施，恢复己方兵力' },
  buxiu: { id:'buxiu', name:'不屈', type:'combat', effectType:'heal_hp', spCost:15, power:40, range:'self', element:'ink', desc:'不屈意志，恢复HP' },
  tuntian: { id:'tuntian', name:'屯田', type:'combat', effectType:'heal_troops', spCost:15, power:50, range:'self', element:'ink', desc:'屯田蓄力，恢复兵力' },
  jiyi: { id:'jiyi', name:'结义', type:'combat', effectType:'morale_up', spCost:25, power:25, range:'ally', element:'ink', desc:'桃园结义，提升全军士气' },
  guohe: { id:'guohe', name:'鬼谋', type:'combat', effectType:'debuff_attack', spCost:25, power:20, range:'area', element:'ink', desc:'运筹帷幄，降低敌军攻击', buffDuration:3 },
  zhiheng: { id:'zhiheng', name:'制衡', type:'combat', effectType:'debuff_defense', spCost:25, power:30, range:'area', element:'ink', desc:'制衡天下，削弱敌军防御', buffDuration:3 },
  lijian: { id:'lijian', name:'离间', type:'combat', effectType:'morale_down', spCost:25, power:20, range:'area', element:'ink', desc:'离间敌军，降低敌方士气' },

  // ===== 军师技 =====
  jimou: { id:'jimou', name:'计谋', type:'advisor', effectType:'morale_up', spCost:0, power:10, range:'ally', element:'ink', desc:'战前计谋，提升全军士气10点' },
  guwu: { id:'guwu', name:'鼓舞', type:'advisor', effectType:'buff_attack', spCost:0, power:15, range:'ally', element:'ink', desc:'战前鼓舞，提升全军攻击力15%', buffDuration:99 },
  yaohuo: { id:'yaohuo', name:'妖惑', type:'advisor', effectType:'morale_down', spCost:0, power:10, range:'enemy', element:'ink', desc:'战前妖惑，降低敌军士气10点' }
};

/** 自定义技能注册表 */
export const CUSTOM_SKILLS = Object.create(null);

let customSkillSeq = 0;

/**
 * 注册自定义（自定义君主专属）技能，返回生成的技能 id。
 * @param {object} skillData
 * @returns {string} skillId
 */
export function registerCustomSkill(skillData = {}) {
  customSkillSeq += 1;
  const id = `custom_skill_${Date.now()}_${customSkillSeq}`;
  const skill = {
    id,
    name: skillData.name || '无名技',
    type: 'combat',
    effectType: skillData.effectType || 'damage',
    spCost: skillData.spCost || 30,
    power: skillData.power || 80,
    range: skillData.range || 'single',
    element: skillData.element || 'ink',
    desc: skillData.desc || '专属武将技',
    isExclusive: true,
    exclusiveHero: skillData.heroId || null
  };
  CUSTOM_SKILLS[id] = skill;
  SKILLS_DATA[id] = skill;
  return id;
}

/**
 * 序列化自定义技能，供存档使用（函数等不可序列化内容不落盘）。
 * @returns {object}
 */
export function exportCustomSkills() {
  const out = {};
  for (const id in CUSTOM_SKILLS) {
    if (Object.prototype.hasOwnProperty.call(CUSTOM_SKILLS, id)) {
      out[id] = { ...CUSTOM_SKILLS[id] };
    }
  }
  return out;
}

/**
 * 从存档恢复自定义技能。
 * @param {object} skills
 */
export function importCustomSkills(skills) {
  if (!skills || typeof skills !== 'object') return;
  for (const id in skills) {
    if (!Object.prototype.hasOwnProperty.call(skills, id)) continue;
    CUSTOM_SKILLS[id] = { ...skills[id] };
    SKILLS_DATA[id] = { ...skills[id] };
  }
}