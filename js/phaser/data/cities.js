window.SG3 = window.SG3 || {};

/**
 * 三国群英传 - 城市与关隘数据
 * 坐标基于真实三国地理，地图画布 1200x900
 * type: 'city' 普通城池 | 'pass' 关隘(防御加成)
 */
window.SG3.CITIES_DATA = [
  // ===== 西北 =====
  { id:'wuwei', name:'武威', x:180, y:130, faction:'qun', agriculture:45, commerce:35, morale:40, defense:45, troops:2000, maxTroops:6000, heroes:[], adjacent:['xiliang','tianshui'], region:'xibei' },
  { id:'xiliang', name:'西凉', x:230, y:185, faction:'qun', agriculture:40, commerce:35, morale:40, defense:45, troops:4000, maxTroops:8000, heroes:['lvbu','yanliang','wenchou'], adjacent:['wuwei','tianshui','anding'], region:'xibei' },
  { id:'tianshui', name:'天水', x:310, y:195, faction:'qun', agriculture:55, commerce:45, morale:45, defense:50, troops:3000, maxTroops:8000, heroes:['yuanshao'], adjacent:['wuwei','xiliang','anding','changan','jieting'], region:'xibei' },
  { id:'anding', name:'安定', x:370, y:170, faction:'none', agriculture:50, commerce:40, morale:45, defense:45, troops:1800, maxTroops:5500, heroes:[], adjacent:['xiliang','tianshui','changan'], region:'xibei' },
  { id:'jieting', name:'街亭', x:360, y:250, faction:'none', agriculture:40, commerce:30, morale:40, defense:40, troops:1500, maxTroops:5000, heroes:[], adjacent:['tianshui','changan','hanzhong'], region:'xibei' },

  // ===== 关中 =====
  { id:'changan', name:'长安', x:430, y:265, faction:'wei', agriculture:85, commerce:80, morale:60, defense:75, troops:7000, maxTroops:14000, heroes:[], adjacent:['tianshui','anding','jieting','tongguan','hanzhong'], region:'guanzhong' },
  { id:'tongguan', name:'潼关', x:500, y:250, faction:'wei', type:'pass', agriculture:20, commerce:10, morale:60, defense:90, troops:3000, maxTroops:6000, heroes:[], adjacent:['changan','luoyang'], region:'guanzhong' },

  // ===== 中原 =====
  { id:'luoyang', name:'洛阳', x:570, y:260, faction:'wei', agriculture:80, commerce:90, morale:65, defense:70, troops:8000, maxTroops:15000, heroes:['caocao','xiahoudun','xuchu','simayi','xunyu'], adjacent:['tongguan','hulaoguan','wan','huguan','huayin'], region:'zhongyuan' },
  { id:'huayin', name:'华阴', x:530, y:290, faction:'none', agriculture:45, commerce:35, morale:45, defense:40, troops:1500, maxTroops:5000, heroes:[], adjacent:['luoyang','tongguan','wan'], region:'zhongyuan' },
  { id:'hulaoguan', name:'虎牢关', x:640, y:255, faction:'wei', type:'pass', agriculture:20, commerce:10, morale:60, defense:90, troops:3000, maxTroops:6000, heroes:[], adjacent:['luoyang','xuchang','sishuiguan','puyang'], region:'zhongyuan' },
  { id:'sishuiguan', name:'汜水关', x:680, y:280, faction:'none', type:'pass', agriculture:15, commerce:8, morale:55, defense:85, troops:2000, maxTroops:5000, heroes:[], adjacent:['hulaoguan','xuchang','xiaopei'], region:'zhongyuan' },
  { id:'xuchang', name:'许昌', x:630, y:335, faction:'wei', agriculture:75, commerce:85, morale:70, defense:60, troops:6000, maxTroops:12000, heroes:['xiahouyuan','guojia'], adjacent:['hulaoguan','sishuiguan','runan','shouchun','puyang','xiaopei','wan','chenliu'], region:'zhongyuan' },
  { id:'chenliu', name:'陈留', x:580, y:310, faction:'none', agriculture:55, commerce:50, morale:50, defense:45, troops:1800, maxTroops:5500, heroes:[], adjacent:['xuchang','puyang','luoyang'], region:'zhongyuan' },
  { id:'wan', name:'宛', x:500, y:335, faction:'none', agriculture:60, commerce:55, morale:55, defense:50, troops:2500, maxTroops:7000, heroes:[], adjacent:['luoyang','huayin','xuchang','runan','xinye','shangyong'], region:'zhongyuan' },
  { id:'runan', name:'汝南', x:620, y:385, faction:'wei', agriculture:65, commerce:60, morale:55, defense:50, troops:3000, maxTroops:8000, heroes:[], adjacent:['xuchang','shouchun','wan','xiangyang'], region:'zhongyuan' },
  { id:'puyang', name:'濮阳', x:660, y:230, faction:'none', agriculture:55, commerce:50, morale:50, defense:45, troops:2000, maxTroops:6000, heroes:[], adjacent:['hulaoguan','ye','xuchang','chenliu','xiaopei'], region:'zhongyuan' },
  { id:'xiaopei', name:'小沛', x:730, y:275, faction:'none', agriculture:55, commerce:50, morale:55, defense:40, troops:1800, maxTroops:5500, heroes:[], adjacent:['sishuiguan','puyang','xuchang','xiapi','shouchun'], region:'zhongyuan' },
  { id:'xiapi', name:'下邳', x:790, y:295, faction:'none', agriculture:60, commerce:55, morale:55, defense:45, troops:2200, maxTroops:6500, heroes:[], adjacent:['xiaopei','beihai','shouchun'], region:'zhongyuan' },
  { id:'shouchun', name:'寿春', x:730, y:370, faction:'wei', agriculture:70, commerce:65, morale:58, defense:55, troops:4000, maxTroops:9000, heroes:[], adjacent:['xuchang','runan','xiaopei','xiapi','lujiang','xiangyang','jianye'], region:'zhongyuan' },

  // ===== 河北 =====
  { id:'yanmenguan', name:'雁门关', x:500, y:85, faction:'none', type:'pass', agriculture:15, commerce:8, morale:50, defense:85, troops:2000, maxTroops:5000, heroes:[], adjacent:['jinyang','daixun','zhuojun'], region:'hebei' },
  { id:'daixun', name:'代郡', x:570, y:110, faction:'none', agriculture:45, commerce:35, morale:45, defense:40, troops:1800, maxTroops:5500, heroes:[], adjacent:['yanmenguan','jinyang','beiping','ji'], region:'hebei' },
  { id:'jinyang', name:'晋阳', x:480, y:145, faction:'none', agriculture:55, commerce:45, morale:50, defense:50, troops:2000, maxTroops:6000, heroes:[], adjacent:['yanmenguan','daixun','ye','huguan','ji'], region:'hebei' },
  { id:'ji', name:'蓟', x:560, y:90, faction:'none', agriculture:50, commerce:45, morale:50, defense:50, troops:2500, maxTroops:7000, heroes:[], adjacent:['daixun','jinyang','beiping','zhuojun'], region:'hebei' },
  { id:'beiping', name:'北平', x:680, y:85, faction:'qun', agriculture:50, commerce:45, morale:50, defense:40, troops:2000, maxTroops:6000, heroes:[], adjacent:['ji','daixun','pingyuan','zhuojun'], region:'hebei' },
  { id:'zhuojun', name:'涿郡', x:610, y:120, faction:'none', agriculture:50, commerce:40, morale:50, defense:35, troops:1500, maxTroops:5000, heroes:[], adjacent:['beiping','ji','yanmenguan','pingyuan'], region:'hebei' },
  { id:'huguan', name:'壶关', x:540, y:210, faction:'none', type:'pass', agriculture:15, commerce:8, morale:55, defense:85, troops:2000, maxTroops:5000, heroes:[], adjacent:['ye','jinyang','luoyang','puyang'], region:'hebei' },
  { id:'ye', name:'邺', x:580, y:190, faction:'wei', agriculture:70, commerce:75, morale:60, defense:65, troops:5000, maxTroops:10000, heroes:['zhangliao','dianwei'], adjacent:['huguan','jinyang','beiping','pingyuan','beihai','puyang'], region:'hebei' },
  { id:'pingyuan', name:'平原', x:660, y:180, faction:'none', agriculture:55, commerce:50, morale:55, defense:40, troops:1800, maxTroops:5500, heroes:[], adjacent:['beiping','ye','beihai','zhuojun'], region:'hebei' },
  { id:'beihai', name:'北海', x:740, y:210, faction:'none', agriculture:60, commerce:55, morale:55, defense:40, troops:2000, maxTroops:6000, heroes:[], adjacent:['pingyuan','xiapi','ye'], region:'hebei' },

  // ===== 蜀地 =====
  { id:'hanzhong', name:'汉中', x:340, y:325, faction:'shu', agriculture:70, commerce:60, morale:70, defense:65, troops:6000, maxTroops:12000, heroes:['zhugeliang','zhaoyun'], adjacent:['jieting','changan','jiange','shangyong','yangpingguan'], region:'shu' },
  { id:'yangpingguan', name:'阳平关', x:300, y:300, faction:'shu', type:'pass', agriculture:15, commerce:8, morale:60, defense:88, troops:2000, maxTroops:5000, heroes:[], adjacent:['hanzhong','jiange'], region:'shu' },
  { id:'jiange', name:'剑阁', x:285, y:365, faction:'shu', type:'pass', agriculture:15, commerce:8, morale:60, defense:92, troops:2500, maxTroops:6000, heroes:[], adjacent:['hanzhong','yangpingguan','zitong','chengdu'], region:'shu' },
  { id:'zitong', name:'梓潼', x:260, y:400, faction:'shu', agriculture:55, commerce:45, morale:55, defense:50, troops:2000, maxTroops:6000, heroes:[], adjacent:['jiange','chengdu'], region:'shu' },
  { id:'chengdu', name:'成都', x:250, y:445, faction:'shu', agriculture:90, commerce:85, morale:80, defense:70, troops:8000, maxTroops:15000, heroes:['liubei','guanyu','zhangfei','pangtong'], adjacent:['jiange','zitong','jiangzhou','nanzhong'], region:'shu' },
  { id:'jiangzhou', name:'江州', x:330, y:460, faction:'shu', agriculture:65, commerce:55, morale:60, defense:50, troops:3000, maxTroops:8000, heroes:['machao'], adjacent:['chengdu','nanzhong','yongan'], region:'shu' },
  { id:"yongan", name:"永安", x:410, y:450, faction:'shu', agriculture:55, commerce:50, morale:60, defense:55, troops:2500, maxTroops:7000, heroes:['huangzhong'], adjacent:['jiangzhou','jiangling'], region:'shu' },
  { id:'nanzhong', name:'南中', x:250, y:515, faction:'qun', agriculture:50, commerce:35, morale:40, defense:35, troops:2000, maxTroops:6000, heroes:['menghuo'], adjacent:['chengdu','jiangzhou','lingling','jiaozhou','jianning'], region:'shu' },
  { id:'shangyong', name:'上庸', x:430, y:315, faction:'shu', agriculture:55, commerce:45, morale:55, defense:45, troops:2000, maxTroops:6000, heroes:['weiyan'], adjacent:['hanzhong','xiangyang','xinye','wan'], region:'shu' },

  // ===== 荆州 =====
  { id:'xiangyang', name:'襄阳', x:520, y:415, faction:'wu', agriculture:80, commerce:75, morale:65, defense:60, troops:5000, maxTroops:12000, heroes:['zhouyu','lvmeng'], adjacent:['runan','shangyong','wan','jiangling','shouchun','xinye','jiangxia'], region:'jingzhou' },
  { id:'xinye', name:'新野', x:500, y:380, faction:'none', agriculture:55, commerce:45, morale:55, defense:40, troops:1800, maxTroops:5500, heroes:[], adjacent:['wan','xiangyang','shangyong','jiangxia','jiangling'], region:'jingzhou' },
  { id:'jiangling', name:'江陵', x:480, y:465, faction:'wu', agriculture:75, commerce:70, morale:62, defense:55, troops:4000, maxTroops:10000, heroes:['luxun'], adjacent:["yongan",'xiangyang','chaisang','changsha','xinye','jiangxia','wuling'], region:'jingzhou' },
  { id:'jiangxia', name:'江夏', x:590, y:425, faction:'none', agriculture:60, commerce:50, morale:55, defense:45, troops:2200, maxTroops:6500, heroes:[], adjacent:['xiangyang','jiangling','chaisang','xinye','shouchun'], region:'jingzhou' },
  { id:'changsha', name:'长沙', x:520, y:525, faction:'wu', agriculture:70, commerce:65, morale:58, defense:45, troops:3000, maxTroops:8000, heroes:['huanggai'], adjacent:['jiangling','chaisang','lingling','guiyang','wuling'], region:'jingzhou' },
  { id:'lingling', name:'零陵', x:470, y:565, faction:'wu', agriculture:55, commerce:45, morale:50, defense:35, troops:1500, maxTroops:5000, heroes:[], adjacent:['changsha','nanzhong','jiaozhou','wuling','guiyang'], region:'jingzhou' },
  { id:'wuling', name:'武陵', x:430, y:520, faction:'none', agriculture:50, commerce:40, morale:50, defense:35, troops:1500, maxTroops:5000, heroes:[], adjacent:['jiangling','changsha','lingling'], region:'jingzhou' },
  { id:'guiyang', name:'桂阳', x:550, y:565, faction:'none', agriculture:50, commerce:40, morale:50, defense:35, troops:1500, maxTroops:5000, heroes:[], adjacent:['changsha','lingling'], region:'jingzhou' },

  // ===== 江东 =====
  { id:'lujiang', name:'庐江', x:690, y:405, faction:'none', agriculture:60, commerce:55, morale:55, defense:45, troops:2000, maxTroops:6000, heroes:[], adjacent:['shouchun','chaisang','jianye','jiangxia','hefei'], region:'jiangdong' },
  { id:'hefei', name:'合肥', x:730, y:430, faction:'wu', agriculture:60, commerce:55, morale:60, defense:55, troops:3500, maxTroops:8000, heroes:[], adjacent:['lujiang','shouchun','jianye'], region:'jiangdong' },
  { id:'jianye', name:'建业', x:800, y:405, faction:'wu', agriculture:85, commerce:90, morale:75, defense:70, troops:8000, maxTroops:15000, heroes:['sunquan','ganning','taishici','zhoutai'], adjacent:['shouchun','chaisang','lujiang','kuaiji','hefei'], region:'jiangdong' },
  { id:'chaisang', name:'柴桑', x:630, y:475, faction:'wu', agriculture:65, commerce:60, morale:60, defense:50, troops:3000, maxTroops:8000, heroes:[], adjacent:['jiangling','changsha','jianye','jiangxia','lujiang'], region:'jiangdong' },
  { id:'kuaiji', name:'会稽', x:880, y:465, faction:'wu', agriculture:70, commerce:70, morale:62, defense:40, troops:2500, maxTroops:7000, heroes:[], adjacent:['jianye','wu'], region:'jiangdong' },
  { id:'wu', name:'吴', x:840, y:440, faction:'none', agriculture:65, commerce:65, morale:55, defense:40, troops:2000, maxTroops:6000, heroes:[], adjacent:['jianye','kuaiji'], region:'jiangdong' },

  // ===== 交州/南中 =====
  { id:'jiaozhou', name:'交州', x:490, y:620, faction:'none', agriculture:45, commerce:30, morale:35, defense:25, troops:1000, maxTroops:4000, heroes:['diaochan'], adjacent:['lingling','nanzhong','jianning'], region:'jiaozhou' },
  { id:'jianning', name:'建宁', x:330, y:560, faction:'none', agriculture:50, commerce:35, morale:40, defense:35, troops:1500, maxTroops:5000, heroes:[], adjacent:['nanzhong','jiaozhou','yunnan'], region:'jiaozhou' },
  { id:'yunnan', name:'云南', x:280, y:600, faction:'none', agriculture:45, commerce:30, morale:35, defense:30, troops:1500, maxTroops:5000, heroes:[], adjacent:['jianning','nanzhong'], region:'jiaozhou' }
];
