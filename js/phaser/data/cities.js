window.SG3 = window.SG3 || {};

window.SG3.CITIES_DATA = [
  // 中原
  { id:'luoyang', name:'洛阳', x:420, y:220, faction:'wei', agriculture:80, commerce:90, morale:65, defense:70, troops:8000, maxTroops:15000, heroes:['caocao','xiahoudun','xuchu','simayi','xunyu'], adjacent:['xuchang','changan','ye','puyang','wan'], region:'zhongyuan' },
  { id:'xuchang', name:'许昌', x:440, y:270, faction:'wei', agriculture:75, commerce:85, morale:70, defense:60, troops:6000, maxTroops:12000, heroes:['xiahouyuan','guojia'], adjacent:['luoyang','runan','shouchun','puyang','xiaopei','wan'], region:'zhongyuan' },
  { id:'ye', name:'邺', x:440, y:150, faction:'wei', agriculture:70, commerce:75, morale:60, defense:65, troops:5000, maxTroops:10000, heroes:['zhangliao','dianwei'], adjacent:['luoyang','beiping','ji','jinyang','beihai','puyang'], region:'zhongyuan' },
  { id:'runan', name:'汝南', x:460, y:320, faction:'wei', agriculture:65, commerce:60, morale:55, defense:50, troops:3000, maxTroops:8000, heroes:[], adjacent:['xuchang','shouchun','xiangyang'], region:'zhongyuan' },
  { id:'shouchun', name:'寿春', x:510, y:290, faction:'wei', agriculture:70, commerce:65, morale:58, defense:55, troops:4000, maxTroops:9000, heroes:[], adjacent:['xuchang','runan','jianye','xiaopei','xiapi','lujiang','xiangyang'], region:'zhongyuan' },

  // 西北
  { id:'changan', name:'长安', x:340, y:220, faction:'wei', agriculture:85, commerce:80, morale:60, defense:75, troops:7000, maxTroops:14000, heroes:[], adjacent:['luoyang','hanzhong','tianshui','anding'], region:'xibei' },
  { id:'tianshui', name:'天水', x:280, y:190, faction:'qun', agriculture:55, commerce:45, morale:45, defense:50, troops:3000, maxTroops:8000, heroes:['yuanshao'], adjacent:['changan','xiliang','anding','wuwei'], region:'xibei' },
  { id:'xiliang', name:'西凉', x:220, y:170, faction:'qun', agriculture:40, commerce:35, morale:40, defense:45, troops:4000, maxTroops:8000, heroes:['lvbu','yanliang','wenchou'], adjacent:['tianshui','wuwei'], region:'xibei' },

  // 河北
  { id:'beiping', name:'北平', x:500, y:90, faction:'qun', agriculture:50, commerce:45, morale:50, defense:40, troops:2000, maxTroops:6000, heroes:[], adjacent:['ye','ji','youzhou','pingyuan','zhuojun'], region:'hebei' },
  { id:'ji', name:'冀', x:460, y:100, faction:'qun', agriculture:60, commerce:55, morale:50, defense:50, troops:3000, maxTroops:8000, heroes:['zhangjiao'], adjacent:['ye','beiping','jinyang','pingyuan'], region:'hebei' },

  // 蜀地
  { id:'hanzhong', name:'汉中', x:300, y:290, faction:'shu', agriculture:70, commerce:60, morale:70, defense:65, troops:6000, maxTroops:12000, heroes:['zhugeliang','zhaoyun'], adjacent:['changan','chengdu','shangyong'], region:'shu' },
  { id:'chengdu', name:'成都', x:260, y:350, faction:'shu', agriculture:90, commerce:85, morale:80, defense:70, troops:8000, maxTroops:15000, heroes:['liubei','guanyu','zhangfei','pangtong'], adjacent:['hanzhong','jiangzhou','nanzhong'], region:'shu' },
  { id:'jiangzhou', name:'江州', x:310, y:380, faction:'shu', agriculture:65, commerce:55, morale:60, defense:50, troops:3000, maxTroops:8000, heroes:['machao'], adjacent:['chengdu','nanzhong',"yong'an"], region:'shu' },
  { id:'nanzhong', name:'南中', x:250, y:420, faction:'qun', agriculture:50, commerce:35, morale:40, defense:35, troops:2000, maxTroops:6000, heroes:['menghuo'], adjacent:['chengdu','jiangzhou','lingling','jiaozhou'], region:'shu' },
  { id:'shangyong', name:'上庸', x:370, y:280, faction:'shu', agriculture:55, commerce:45, morale:55, defense:45, troops:2000, maxTroops:6000, heroes:['weiyan'], adjacent:['hanzhong','xiangyang','xinye'], region:'shu' },
  { id:"yong'an", name:"永安", x:360, y:380, faction:'shu', agriculture:55, commerce:50, morale:60, defense:55, troops:2500, maxTroops:7000, heroes:['huangzhong'], adjacent:['jiangzhou','jiangling'], region:'shu' },

  // 荆州
  { id:'xiangyang', name:'襄阳', x:420, y:340, faction:'wu', agriculture:80, commerce:75, morale:65, defense:60, troops:5000, maxTroops:12000, heroes:['zhouyu','lvmeng'], adjacent:['runan','shangyong','jiangling','shouchun','xinye','jiangxia','wan'], region:'jingzhou' },
  { id:'jiangling', name:'江陵', x:390, y:390, faction:'wu', agriculture:75, commerce:70, morale:62, defense:55, troops:4000, maxTroops:10000, heroes:['luxun'], adjacent:["yong'an",'xiangyang','chaisang','changsha','xinye','jiangxia'], region:'jingzhou' },
  { id:'changsha', name:'长沙', x:420, y:430, faction:'wu', agriculture:70, commerce:65, morale:58, defense:45, troops:3000, maxTroops:8000, heroes:['huanggai'], adjacent:['jiangling','chaisang','lingling'], region:'jingzhou' },
  { id:'lingling', name:'零陵', x:380, y:470, faction:'wu', agriculture:55, commerce:45, morale:50, defense:35, troops:1500, maxTroops:5000, heroes:[], adjacent:['changsha','nanzhong','jiaozhou'], region:'jingzhou' },

  // 江东
  { id:'jianye', name:'建业', x:550, y:350, faction:'wu', agriculture:85, commerce:90, morale:75, defense:70, troops:8000, maxTroops:15000, heroes:['sunquan','ganning','taishici','zhoutai'], adjacent:['shouchun','chaisang','lujiang','kuaiji'], region:'jiangdong' },
  { id:'chaisang', name:'柴桑', x:480, y:390, faction:'wu', agriculture:65, commerce:60, morale:60, defense:50, troops:3000, maxTroops:8000, heroes:[], adjacent:['jiangling','changsha','jianye','jiangxia','lujiang'], region:'jiangdong' },
  { id:'kuaiji', name:'会稽', x:590, y:400, faction:'wu', agriculture:70, commerce:70, morale:62, defense:40, troops:2500, maxTroops:7000, heroes:[], adjacent:['jianye'], region:'jiangdong' },

  // 交州
  { id:'jiaozhou', name:'交州', x:380, y:520, faction:'none', agriculture:45, commerce:30, morale:35, defense:25, troops:1000, maxTroops:4000, heroes:['diaochan'], adjacent:['lingling','nanzhong'], region:'jiaozhou' },

  // 河北补充
  { id:'zhuojun', name:'涿郡', x:530, y:60, faction:'none', agriculture:50, commerce:40, morale:50, defense:35, troops:1500, maxTroops:5000, heroes:[], adjacent:['youzhou','beiping'], region:'hebei' },
  { id:'jinyang', name:'晋阳', x:430, y:60, faction:'none', agriculture:55, commerce:45, morale:50, defense:50, troops:2000, maxTroops:6000, heroes:[], adjacent:['ye','ji','youzhou'], region:'hebei' },
  { id:'youzhou', name:'幽州', x:480, y:50, faction:'none', agriculture:45, commerce:40, morale:45, defense:40, troops:1500, maxTroops:5000, heroes:[], adjacent:['beiping','jinyang','zhuojun'], region:'hebei' },
  { id:'pingyuan', name:'平原', x:490, y:120, faction:'none', agriculture:55, commerce:50, morale:55, defense:40, troops:1800, maxTroops:5500, heroes:[], adjacent:['beiping','ji','beihai'], region:'hebei' },
  { id:'beihai', name:'北海', x:520, y:170, faction:'none', agriculture:60, commerce:55, morale:55, defense:40, troops:2000, maxTroops:6000, heroes:[], adjacent:['pingyuan','xiapi','ye'], region:'hebei' },

  // 中原补充
  { id:'puyang', name:'濮阳', x:475, y:200, faction:'none', agriculture:55, commerce:50, morale:50, defense:45, troops:2000, maxTroops:6000, heroes:[], adjacent:['ye','xuchang','luoyang','xiaopei'], region:'zhongyuan' },
  { id:'xiaopei', name:'小沛', x:500, y:230, faction:'none', agriculture:55, commerce:50, morale:55, defense:40, troops:1800, maxTroops:5500, heroes:[], adjacent:['puyang','xuchang','xiapi','shouchun'], region:'zhongyuan' },
  { id:'xiapi', name:'下邳', x:530, y:250, faction:'none', agriculture:60, commerce:55, morale:55, defense:45, troops:2200, maxTroops:6500, heroes:[], adjacent:['xiaopei','beihai','shouchun'], region:'zhongyuan' },
  { id:'wan', name:'宛', x:370, y:290, faction:'none', agriculture:60, commerce:55, morale:55, defense:50, troops:2500, maxTroops:7000, heroes:[], adjacent:['luoyang','xuchang','xiangyang','xinye'], region:'zhongyuan' },

  // 荆州补充
  { id:'xinye', name:'新野', x:385, y:360, faction:'none', agriculture:55, commerce:45, morale:55, defense:40, troops:1800, maxTroops:5500, heroes:[], adjacent:['wan','xiangyang','shangyong','jiangxia','jiangling'], region:'jingzhou' },
  { id:'jiangxia', name:'江夏', x:450, y:380, faction:'none', agriculture:60, commerce:50, morale:55, defense:45, troops:2200, maxTroops:6500, heroes:[], adjacent:['xiangyang','jiangling','chaisang','xinye'], region:'jingzhou' },

  // 扬州补充
  { id:'lujiang', name:'庐江', x:520, y:330, faction:'none', agriculture:60, commerce:55, morale:55, defense:45, troops:2000, maxTroops:6000, heroes:[], adjacent:['shouchun','chaisang','jianye'], region:'jiangdong' },

  // 西北补充
  { id:'anding', name:'安定', x:320, y:195, faction:'none', agriculture:50, commerce:40, morale:45, defense:45, troops:1800, maxTroops:5500, heroes:[], adjacent:['changan','tianshui'], region:'xibei' },
  { id:'wuwei', name:'武威', x:235, y:145, faction:'none', agriculture:45, commerce:35, morale:40, defense:45, troops:2000, maxTroops:6000, heroes:[], adjacent:['xiliang','tianshui'], region:'xibei' }
];
