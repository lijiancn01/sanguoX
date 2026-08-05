window.SG3 = window.SG3 || {};

window.SG3.CONFIG = {
  width: 1280,
  height: 720,
  backgroundColor: '#1a0a00',
  scene: [], // will be set in main.js
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  banner: false
};

window.SG3.FACTION_COLORS = {
  wei: 0x4488cc,
  shu: 0xcc4444,
  wu:  0x44aa44,
  qun: 0xcc8844,
  none: 0x888888
};

window.SG3.FACTION_NAMES = {
  wei: '曹魏',
  shu: '蜀汉',
  wu:  '东吴',
  qun: '群雄',
  none: '在野'
};

window.SG3.FACTION_CSS = {
  wei: '#4488cc',
  shu: '#cc4444',
  wu:  '#44aa44',
  qun: '#cc8844',
  none: '#888888'
};
