window.SG3 = window.SG3 || {};

window.SG3.HEROES_DATA = [
  // ===== 曹魏 =====
  { id:'caocao', name:'曹操', faction:'wei', force:72, intellect:92, politics:96, command:88, charisma:85, loyalty:100, level:8, exp:0, skills:['jianxiong','guohe'], advisorSkill:'jimou', maxTroops:10000, troopType:'cavalry', sp:120, maxSp:120 },
  { id:'xiahoudun', name:'夏侯惇', faction:'wei', force:90, intellect:44, politics:28, command:82, charisma:60, loyalty:100, level:6, exp:0, skills:['ganglie','tuci'], advisorSkill:null, maxTroops:8000, troopType:'infantry', sp:100, maxSp:100 },
  { id:'xiahouyuan', name:'夏侯渊', faction:'wei', force:88, intellect:52, politics:34, command:80, charisma:58, loyalty:100, level:6, exp:0, skills:['shenjian','tuci'], advisorSkill:null, maxTroops:8000, troopType:'cavalry', sp:100, maxSp:100 },
  { id:'zhangliao', name:'张辽', faction:'wei', force:88, intellect:68, politics:50, command:90, charisma:72, loyalty:95, level:7, exp:0, skills:['xiaoyaojin','xuanfengzhan'], advisorSkill:null, maxTroops:9000, troopType:'cavalry', sp:110, maxSp:110 },
  { id:'xuchu', name:'许褚', faction:'wei', force:96, intellect:26, politics:18, command:62, charisma:42, loyalty:100, level:5, exp:0, skills:['luoren','ganglie'], advisorSkill:null, maxTroops:7000, troopType:'infantry', sp:100, maxSp:100 },
  { id:'dianwei', name:'典韦', faction:'wei', force:97, intellect:20, politics:12, command:55, charisma:38, loyalty:100, level:5, exp:0, skills:['luoren','nuji'], advisorSkill:null, maxTroops:7000, troopType:'infantry', sp:100, maxSp:100 },
  { id:'simayi', name:'司马懿', faction:'wei', force:48, intellect:96, politics:92, command:86, charisma:72, loyalty:80, level:7, exp:0, skills:['yingzi','guohe'], advisorSkill:'jimou', maxTroops:8000, troopType:'infantry', sp:130, maxSp:130 },
  { id:'xunyu', name:'荀彧', faction:'wei', force:28, intellect:94, politics:98, command:70, charisma:82, loyalty:95, level:5, exp:0, skills:['guohe'], advisorSkill:'guwu', maxTroops:6000, troopType:'archer', sp:110, maxSp:110 },
  { id:'guojia', name:'郭嘉', faction:'wei', force:22, intellect:98, politics:86, command:72, charisma:78, loyalty:90, level:5, exp:0, skills:['tianguan'], advisorSkill:'jimou', maxTroops:6000, troopType:'archer', sp:110, maxSp:110 },

  // ===== 蜀汉 =====
  { id:'liubei', name:'刘备', faction:'shu', force:68, intellect:72, politics:82, command:78, charisma:98, loyalty:100, level:7, exp:0, skills:['rende','jiyi'], advisorSkill:'guwu', maxTroops:9000, troopType:'infantry', sp:110, maxSp:110 },
  { id:'guanyu', name:'关羽', faction:'shu', force:97, intellect:68, politics:52, command:92, charisma:80, loyalty:100, level:7, exp:0, skills:['wusheng','qinglongyanyue'], advisorSkill:null, maxTroops:9000, troopType:'cavalry', sp:110, maxSp:110 },
  { id:'zhangfei', name:'张飞', faction:'shu', force:98, intellect:30, politics:18, command:68, charisma:48, loyalty:100, level:6, exp:0, skills:['paoxiao','xuanfengzhan'], advisorSkill:null, maxTroops:8000, troopType:'cavalry', sp:100, maxSp:100 },
  { id:'zhaoyun', name:'赵云', faction:'shu', force:96, intellect:72, politics:60, command:88, charisma:86, loyalty:100, level:7, exp:0, skills:['longdan','tuci'], advisorSkill:null, maxTroops:9000, troopType:'cavalry', sp:110, maxSp:110 },
  { id:'zhugeliang', name:'诸葛亮', faction:'shu', force:38, intellect:100, politics:98, command:94, charisma:92, loyalty:100, level:8, exp:0, skills:['guanxing','huoshao'], advisorSkill:'jimou', maxTroops:8000, troopType:'archer', sp:140, maxSp:140 },
  { id:'pangtong', name:'庞统', faction:'shu', force:32, intellect:98, politics:88, command:80, charisma:62, loyalty:90, level:6, exp:0, skills:['fenghuo','huoshao'], advisorSkill:'jimou', maxTroops:7000, troopType:'archer', sp:120, maxSp:120 },
  { id:'machao', name:'马超', faction:'shu', force:96, intellect:40, politics:28, command:82, charisma:70, loyalty:85, level:6, exp:0, skills:['tieqi','tuci'], advisorSkill:null, maxTroops:8000, troopType:'cavalry', sp:100, maxSp:100 },
  { id:'huangzhong', name:'黄忠', faction:'shu', force:95, intellect:52, politics:40, command:78, charisma:66, loyalty:95, level:6, exp:0, skills:['shenjian','nuji'], advisorSkill:null, maxTroops:7000, troopType:'archer', sp:100, maxSp:100 },
  { id:'weiyan', name:'魏延', faction:'shu', force:90, intellect:52, politics:36, command:80, charisma:48, loyalty:70, level:5, exp:0, skills:['guli','xuanfengzhan'], advisorSkill:null, maxTroops:7000, troopType:'infantry', sp:90, maxSp:90 },

  // ===== 东吴 =====
  { id:'sunquan', name:'孙权', faction:'wu', force:68, intellect:78, politics:86, command:76, charisma:88, loyalty:100, level:6, exp:0, skills:['zhiheng','jiyi'], advisorSkill:'guwu', maxTroops:8000, troopType:'infantry', sp:100, maxSp:100 },
  { id:'zhouyu', name:'周瑜', faction:'wu', force:70, intellect:97, politics:86, command:94, charisma:90, loyalty:100, level:7, exp:0, skills:['huoshao','yingzi'], advisorSkill:'jimou', maxTroops:9000, troopType:'archer', sp:130, maxSp:130 },
  { id:'lvmeng', name:'吕蒙', faction:'wu', force:78, intellect:88, politics:72, command:86, charisma:62, loyalty:95, level:6, exp:0, skills:['keji','guohe'], advisorSkill:null, maxTroops:8000, troopType:'infantry', sp:100, maxSp:100 },
  { id:'luxun', name:'陆逊', faction:'wu', force:62, intellect:96, politics:88, command:90, charisma:78, loyalty:95, level:6, exp:0, skills:['huoshao','yingzi'], advisorSkill:'jimou', maxTroops:8000, troopType:'archer', sp:120, maxSp:120 },
  { id:'ganning', name:'甘宁', faction:'wu', force:92, intellect:48, politics:32, command:78, charisma:62, loyalty:88, level:5, exp:0, skills:['qixi','xuanfengzhan'], advisorSkill:null, maxTroops:7000, troopType:'cavalry', sp:90, maxSp:90 },
  { id:'taishici', name:'太史慈', faction:'wu', force:90, intellect:52, politics:38, command:80, charisma:68, loyalty:90, level:5, exp:0, skills:['shenjian','tuci'], advisorSkill:null, maxTroops:7000, troopType:'archer', sp:90, maxSp:90 },
  { id:'huanggai', name:'黄盖', faction:'wu', force:86, intellect:56, politics:50, command:76, charisma:58, loyalty:100, level:5, exp:0, skills:['kurou','nuji'], advisorSkill:null, maxTroops:7000, troopType:'infantry', sp:80, maxSp:80 },
  { id:'zhoutai', name:'周泰', faction:'wu', force:90, intellect:34, politics:24, command:70, charisma:52, loyalty:100, level:5, exp:0, skills:['buxiu','ganglie'], advisorSkill:null, maxTroops:7000, troopType:'infantry', sp:90, maxSp:90 },

  // ===== 其他势力 =====
  { id:'lvbu', name:'吕布', faction:'qun', force:100, intellect:26, politics:16, command:82, charisma:42, loyalty:40, level:8, exp:0, skills:['wushuang','feijiang'], advisorSkill:null, maxTroops:10000, troopType:'cavalry', sp:120, maxSp:120 },
  { id:'diaochan', name:'貂蝉', faction:'qun', force:30, intellect:82, politics:72, command:40, charisma:98, loyalty:70, level:4, exp:0, skills:['lijian'], advisorSkill:'yaohuo', maxTroops:4000, troopType:'archer', sp:80, maxSp:80 },
  { id:'yuanshao', name:'袁绍', faction:'qun', force:62, intellect:58, politics:72, command:70, charisma:78, loyalty:60, level:6, exp:0, skills:['mengjin','jiyi'], advisorSkill:'guwu', maxTroops:9000, troopType:'infantry', sp:100, maxSp:100 },
  { id:'yanliang', name:'颜良', faction:'qun', force:90, intellect:34, politics:26, command:72, charisma:48, loyalty:80, level:5, exp:0, skills:['xuanfengzhan','nuji'], advisorSkill:null, maxTroops:7000, troopType:'cavalry', sp:90, maxSp:90 },
  { id:'wenchou', name:'文丑', faction:'qun', force:90, intellect:30, politics:22, command:70, charisma:44, loyalty:80, level:5, exp:0, skills:['xuanfengzhan','ganglie'], advisorSkill:null, maxTroops:7000, troopType:'cavalry', sp:90, maxSp:90 },
  { id:'zhangjiao', name:'张角', faction:'qun', force:48, intellect:86, politics:68, command:72, charisma:88, loyalty:60, level:6, exp:0, skills:['leiji','huoshao'], advisorSkill:'jimou', maxTroops:8000, troopType:'infantry', sp:120, maxSp:120 },
  { id:'menghuo', name:'孟获', faction:'qun', force:86, intellect:28, politics:32, command:66, charisma:56, loyalty:50, level:5, exp:0, skills:['xiang','nuji'], advisorSkill:null, maxTroops:7000, troopType:'infantry', sp:80, maxSp:80 },

  // ===== 在野武将 =====
  { id:'jiangwei', name:'姜维', faction:'none', force:88, intellect:86, politics:68, command:90, charisma:72, loyalty:0, level:4, exp:0, skills:['guanxing','tuci'], advisorSkill:'jimou', maxTroops:7000, troopType:'cavalry', sp:100, maxSp:100 },
  { id:'dengai', name:'邓艾', faction:'none', force:84, intellect:86, politics:72, command:88, charisma:58, loyalty:0, level:4, exp:0, skills:['tuntian','qixi'], advisorSkill:null, maxTroops:7000, troopType:'infantry', sp:90, maxSp:90 },
  { id:'zhonghui', name:'钟会', faction:'none', force:56, intellect:90, politics:78, command:82, charisma:52, loyalty:0, level:4, exp:0, skills:['guohe','yingzi'], advisorSkill:'jimou', maxTroops:6000, troopType:'archer', sp:100, maxSp:100 },
  { id:'xiahoubax', name:'夏侯霸', faction:'none', force:82, intellect:52, politics:38, command:72, charisma:50, loyalty:0, level:3, exp:0, skills:['tuci'], advisorSkill:null, maxTroops:5000, troopType:'cavalry', sp:80, maxSp:80 },
  { id:'liaohua', name:'廖化', faction:'none', force:72, intellect:56, politics:42, command:62, charisma:52, loyalty:0, level:3, exp:0, skills:['xuanfengzhan'], advisorSkill:null, maxTroops:5000, troopType:'infantry', sp:70, maxSp:70 },
  { id:'guanping', name:'关平', faction:'none', force:82, intellect:48, politics:36, command:68, charisma:58, loyalty:0, level:3, exp:0, skills:['tuci','nuji'], advisorSkill:null, maxTroops:5000, troopType:'cavalry', sp:80, maxSp:80 },
  { id:'guanxing', name:'关兴', faction:'none', force:80, intellect:54, politics:40, command:70, charisma:60, loyalty:0, level:3, exp:0, skills:['qinglongyanyue'], advisorSkill:null, maxTroops:5000, troopType:'cavalry', sp:80, maxSp:80 },
  { id:'zhangbao', name:'张苞', faction:'none', force:84, intellect:36, politics:24, command:66, charisma:50, loyalty:0, level:3, exp:0, skills:['paoxiao'], advisorSkill:null, maxTroops:5000, troopType:'cavalry', sp:80, maxSp:80 }
];
