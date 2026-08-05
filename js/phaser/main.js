(function() {
  'use strict';

  var config = Object.assign({}, window.SG3.CONFIG, {
    parent: 'game',
    scene: [
      window.SG3.BootScene,
      window.SG3.MenuScene,
      window.SG3.MapScene,
      window.SG3.BattleScene
    ]
  });

  window.SG3.game = new Phaser.Game(config);
})();
