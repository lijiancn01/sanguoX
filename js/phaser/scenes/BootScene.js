/**
 * 三国群英传 - 启动场景
 * @author jian.li
 */
window.SG3 = window.SG3 || {};

window.SG3.BootScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function BootScene() {
    Phaser.Scene.call(this, { key: 'BootScene' });
  },

  create: function() {
    // 初始化游戏数据
    window.SG3.GameData.init();

    // 显示加载文字
    var w = this.cameras.main.width;
    var h = this.cameras.main.height;
    var text = this.add.text(w / 2, h / 2, '三国群英传', {
      fontSize: '48px',
      fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#ffd700',
      stroke: '#3a1a00',
      strokeThickness: 4
    }).setOrigin(0.5);

    var sub = this.add.text(w / 2, h / 2 + 60, '逐鹿天下，一统江山', {
      fontSize: '20px',
      fontFamily: '"Microsoft YaHei", "SimHei", serif',
      color: '#c4a882'
    }).setOrigin(0.5);

    // 1.5秒后切换到菜单
    var game = this.game;
    this.time.addEvent({
      delay: 1500,
      callback: function() {
        game.scene.stop('BootScene');
        game.scene.start('MenuScene');
      }
    });
  }
});
