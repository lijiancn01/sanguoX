// 城市数据
window.SG = window.SG || {};

window.SG.CITIES_DATA = [
  // 中原
  { id:'luoyang', name:'洛阳', x:420, y:220, faction:'wei', agriculture:80, commerce:90, morale:65, defense:70, troops:8000, maxTroops:15000, heroes:['caocao','xiahoudun','xuchu','simayi','xunyu'], adjacent:['xuchang','changan','ye'], region:'zhongyuan' },
  { id:'xuchang', name:'许昌', x:440, y:270, faction:'wei', agriculture:75, commerce:85, morale:70, defense:60, troops:6000, maxTroops:12000, heroes:['xiahouyuan','guojia'], adjacent:['luoyang','runan','shouchun'], region:'zhongyuan' },
  { id:'ye', name:'邺', x:440, y:150, faction:'wei', agriculture:70, commerce:75, morale:60, defense:65, troops:5000, maxTroops:10000, heroes:['zhangliao','dianwei'], adjacent:['luoyang','beiping','ji'], region:'zhongyuan' },
  { id:'runan', name:'汝南', x:460, y:320, faction:'wei', agriculture:65, commerce:60, morale:55, defense:50, troops:3000, maxTroops:8000, heroes:[], adjacent:['xuchang','shouchun','xiangyang'], region:'zhongyuan' },
  { id:'shouchun', name:'寿春', x:510, y:290, faction:'wei', agriculture:70, commerce:65, morale:58, defense:55, troops:4000, maxTroops:9000, heroes:[], adjacent:['xuchang','runan','jianye'], region:'zhongyuan' },

  // 西北
  { id:'changan', name:'长安', x:340, y:220, faction:'wei', agriculture:85, commerce:80, morale:60, defense:75, troops:7000, maxTroops:14000, heroes:[], adjacent:['luoyang','hanzhong','tianshui'], region:'xibei' },
  { id:'tianshui', name:'天水', x:280, y:190, faction:'qun', agriculture:55, commerce:45, morale:45, defense:50, troops:3000, maxTroops:8000, heroes:['yuanshao'], adjacent:['changan','xiliang'], region:'xibei' },
  { id:'xiliang', name:'西凉', x:220, y:170, faction:'qun', agriculture:40, commerce:35, morale:40, defense:45, troops:4000, maxTroops:8000, heroes:['lvbu','yanliang','wenchou'], adjacent:['tianshui'], region:'xibei' },

  // 河北
  { id:'beiping', name:'北平', x:500, y:90, faction:'qun', agriculture:50, commerce:45, morale:50, defense:40, troops:2000, maxTroops:6000, heroes:[], adjacent:['ye','ji'], region:'hebei' },
  { id:'ji', name:'冀', x:460, y:100, faction:'qun', agriculture:60, commerce:55, morale:50, defense:50, troops:3000, maxTroops:8000, heroes:['zhangjiao'], adjacent:['ye','beiping'], region:'hebei' },

  // 蜀地
  { id:'hanzhong', name:'汉中', x:300, y:290, faction:'shu', agriculture:70, commerce:60, morale:70, defense:65, troops:6000, maxTroops:12000, heroes:['zhugeliang','zhaoyun'], adjacent:['changan','chengdu','shangyong'], region:'shu' },
  { id:'chengdu', name:'成都', x:260, y:350, faction:'shu', agriculture:90, commerce:85, morale:80, defense:70, troops:8000, maxTroops:15000, heroes:['liubei','guanyu','zhangfei','pangtong'], adjacent:['hanzhong','jiangzhou','nanzhong'], region:'shu' },
  { id:'jiangzhou', name:'江州', x:310, y:380, faction:'shu', agriculture:65, commerce:55, morale:60, defense:50, troops:3000, maxTroops:8000, heroes:['machao'], adjacent:['chengdu','nanzhong',"yong'an"], region:'shu' },
  { id:'nanzhong', name:'南中', x:250, y:420, faction:'qun', agriculture:50, commerce:35, morale:40, defense:35, troops:2000, maxTroops:6000, heroes:['menghuo'], adjacent:['chengdu','jiangzhou'], region:'shu' },
  { id:'shangyong', name:'上庸', x:370, y:280, faction:'shu', agriculture:55, commerce:45, morale:55, defense:45, troops:2000, maxTroops:6000, heroes:['weiyan'], adjacent:['hanzhong','xiangyang'], region:'shu' },
  { id:"yong'an", name:"永安", x:360, y:380, faction:'shu', agriculture:55, commerce:50, morale:60, defense:55, troops:2500, maxTroops:7000, heroes:['huangzhong'], adjacent:['jiangzhou','jiangling'], region:'shu' },

  // 荆州
  { id:'xiangyang', name:'襄阳', x:420, y:340, faction:'wu', agriculture:80, commerce:75, morale:65, defense:60, troops:5000, maxTroops:12000, heroes:['zhouyu','lvmeng'], adjacent:['runan','shangyong','jiangling','shouchun'], region:'jingzhou' },
  { id:'jiangling', name:'江陵', x:390, y:390, faction:'wu', agriculture:75, commerce:70, morale:62, defense:55, troops:4000, maxTroops:10000, heroes:['luxun'], adjacent:["yong'an",'xiangyang','chaisang','changsha'], region:'jingzhou' },
  { id:'changsha', name:'长沙', x:420, y:430, faction:'wu', agriculture:70, commerce:65, morale:58, defense:45, troops:3000, maxTroops:8000, heroes:['huanggai'], adjacent:['jiangling','chaisang','lingling'], region:'jingzhou' },
  { id:'lingling', name:'零陵', x:380, y:470, faction:'wu', agriculture:55, commerce:45, morale:50, defense:35, troops:1500, maxTroops:5000, heroes:[], adjacent:['changsha','nanzhong'], region:'jingzhou' },

  // 江东
  { id:'jianye', name:'建业', x:550, y:350, faction:'wu', agriculture:85, commerce:90, morale:75, defense:70, troops:8000, maxTroops:15000, heroes:['sunquan','ganning','taishici','zhoutai'], adjacent:['shouchun','chaisang'], region:'jiangdong' },
  { id:'chaisang', name:'柴桑', x:480, y:390, faction:'wu', agriculture:65, commerce:60, morale:60, defense:50, troops:3000, maxTroops:8000, heroes:[], adjacent:['jiangling','changsha','jianye'], region:'jiangdong' },
  { id:'kuaiji', name:'会稽', x:590, y:400, faction:'wu', agriculture:70, commerce:70, morale:62, defense:40, troops:2500, maxTroops:7000, heroes:[], adjacent:['jianye'], region:'jiangdong' },

  // 交州
  { id:'jiaozhou', name:'交州', x:380, y:520, faction:'none', agriculture:45, commerce:30, morale:35, defense:25, troops:1000, maxTroops:4000, heroes:['diaochan'], adjacent:['lingling','nanzhong'], region:'jiaozhou' },
];

// 势力颜色
window.SG.FACTION_COLORS = {
  wei: '#4488cc',   // 魏 - 蓝
  shu: '#cc4444',   // 蜀 - 红
  wu: '#44aa44',    // 吴 - 绿
  qun: '#cc8844',   // 群 - 橙
  none: '#888888',  // 在野 - 灰
};

// 势力名称
window.SG.FACTION_NAMES = {
  wei: '曹魏',
  shu: '蜀汉',
  wu: '东吴',
  qun: '群雄',
  none: '在野',
};
