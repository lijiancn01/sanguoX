// 三国群英传 - 战斗Canvas渲染
window.SG = window.SG || {};

(function() {
  'use strict';

  // 兵种图标绘制函数
  var TROOP_SHAPES = {
    infantry: function(ctx, x, y, size) {
      // 步兵：方形
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    },
    cavalry: function(ctx, x, y, size) {
      // 骑兵：三角形
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x - size / 2, y + size / 2);
      ctx.lineTo(x + size / 2, y + size / 2);
      ctx.closePath();
      ctx.fill();
    },
    archer: function(ctx, x, y, size) {
      // 弓兵：菱形
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x + size / 2, y);
      ctx.lineTo(x, y + size / 2);
      ctx.lineTo(x - size / 2, y);
      ctx.closePath();
      ctx.fill();
    }
  };

  // 势力颜色
  var FACTION_COLORS = {
    wei: '#4488cc',
    shu: '#cc4444',
    wu: '#44aa44',
    qun: '#cc8844',
    none: '#888888'
  };

  // 战斗tick间隔（毫秒）
  var BATTLE_TICK_MS = 800;
  // 单挑tick间隔
  var DUEL_TICK_MS = 600;

  var Scene = {

    canvas: null,
    ctx: null,
    active: false,

    // 动画队列
    animations: [],

    // 战斗状态引用
    _battleState: null,

    // 战斗tick定时器
    _tickTimer: null,

    // 动画帧ID
    _animFrame: null,

    // 动画帧计数
    _frame: 0,

    // 选中的敌方武将索引（用于单挑）
    _selectedDefender: -1,

    // 按钮区域
    _buttons: [],

    // 选中技能的武将索引
    _skillMenuHeroIdx: -1,

    // 初始化
    init: function(canvas) {
      this.canvas = canvas || document.getElementById('gameCanvas');
      if (!this.canvas) {
        console.error('BattleScene: 未找到canvas元素');
        return;
      }
      this.ctx = this.canvas.getContext('2d');
    },

    // 开始战斗
    start: function(battleInfo) {
      var GS = window.SG.GameState;
      // 用BattleEngine初始化战斗
      var state = window.SG.BattleEngine.init(
        battleInfo.attackerHeroIds,
        battleInfo.defenderHeroIds,
        battleInfo.attackerFaction,
        battleInfo.defenderFaction
      );
      this._battleState = state;
      this.active = true;
      this._frame = 0;
      this.animations = [];
      this._selectedDefender = -1;
      this._buttons = [];
      this._skillMenuHeroIdx = -1;

      // 注册鼠标事件
      this._bindEvents();

      // 启动战斗tick
      this._startBattleTick();

      // 启动渲染循环
      this._startRenderLoop();
    },

    // 停止战斗
    stop: function() {
      this.active = false;
      this._battleState = null;
      if (this._tickTimer) {
        clearInterval(this._tickTimer);
        this._tickTimer = null;
      }
      if (this._animFrame) {
        cancelAnimationFrame(this._animFrame);
        this._animFrame = null;
      }
      this._unbindEvents();
    },

    // 更新战斗状态（由外部主循环调用）
    update: function() {
      // tick由内部定时器驱动，这里不做额外处理
    },

    // ===== 渲染 =====

    render: function() {
      if (!this.active || !this.ctx || !this._battleState) return;

      var ctx = this.ctx;
      var w = this.canvas.width;
      var h = this.canvas.height;

      this._frame++;

      // 清屏
      ctx.clearRect(0, 0, w, h);

      // 1. 战场背景
      this._renderBackground(ctx, w, h);

      // 2. 双方武将与兵力
      this._renderAllHeroes(ctx, w, h);

      // 3. 单挑画面
      if (this._battleState.phase === 'duel' && this._battleState.duelState) {
        this._renderDuelOverlay(ctx, w, h);
      }

      // 4. 动画特效
      this._renderAnimations(ctx, w, h);

      // 5. 战斗日志
      this._renderBattleLog(ctx, w, h);

      // 6. 操作按钮
      this._renderControls(ctx, w, h);

      // 7. 战斗结束提示
      if (this._battleState.phase === 'ended') {
        this._renderEndScreen(ctx, w, h);
      }
    },

    // ===== 背景渲染 =====
    _renderBackground: function(ctx, w, h) {
      // 宣纸底色
      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(0, 0, w, h);

      // 战场分割线
      ctx.save();
      ctx.strokeStyle = '#8a7a5a';
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 40);
      ctx.lineTo(w / 2, h - 120);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 远山剪影
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(0, 100);
      ctx.quadraticCurveTo(w * 0.15, 60, w * 0.3, 90);
      ctx.quadraticCurveTo(w * 0.45, 50, w * 0.6, 80);
      ctx.quadraticCurveTo(w * 0.75, 45, w * 0.9, 70);
      ctx.lineTo(w, 60);
      ctx.lineTo(w, 120);
      ctx.lineTo(0, 120);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 回合信息
      var state = this._battleState;
      ctx.save();
      ctx.fillStyle = '#5a4a3a';
      ctx.font = '14px "KaiTi", "STKaiti", "FangSong", serif';
      ctx.textAlign = 'center';
      ctx.fillText('第 ' + state.turn + ' 回合', w / 2, 25);

      // 阶段显示
      var phaseText = { prepare: '战前准备', fighting: '激战中', duel: '单挑', ended: '战斗结束' };
      ctx.font = '12px "KaiTi", "STKaiti", serif';
      ctx.fillText(phaseText[state.phase] || '', w / 2, 42);
      ctx.restore();

      // 攻方/守方标签
      var atkFaction = state.attacker.faction;
      var defFaction = state.defender.faction;
      var atkName = (window.SG.FACTION_NAMES && window.SG.FACTION_NAMES[atkFaction]) || atkFaction;
      var defName = (window.SG.FACTION_NAMES && window.SG.FACTION_NAMES[defFaction]) || defFaction;

      ctx.save();
      ctx.font = 'bold 14px "KaiTi", "STKaiti", serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = FACTION_COLORS[atkFaction] || '#888';
      ctx.fillText('攻方 - ' + atkName, w * 0.25, 25);
      ctx.fillStyle = FACTION_COLORS[defFaction] || '#888';
      ctx.fillText('守方 - ' + defName, w * 0.75, 25);
      ctx.restore();
    },

    // ===== 渲染所有武将 =====
    _renderAllHeroes: function(ctx, w, h) {
      var state = this._battleState;
      var atkHeroes = state.attacker.heroes;
      var defHeroes = state.defender.heroes;
      var maxHeroes = Math.max(atkHeroes.length, defHeroes.length, 1);

      // 每个武将占位区域
      var heroAreaTop = 55;
      var heroAreaBottom = h - 150;
      var heroAreaHeight = heroAreaBottom - heroAreaTop;
      var heroSpacing = heroAreaHeight / maxHeroes;

      for (var i = 0; i < atkHeroes.length; i++) {
        var y = heroAreaTop + heroSpacing * i + heroSpacing / 2;
        this.renderHero(atkHeroes[i], 60, y, 'attacker', i);
        this.renderTroops(atkHeroes[i], 130, y, 'attacker');
      }

      for (var j = 0; j < defHeroes.length; j++) {
        var dy = heroAreaTop + heroSpacing * j + heroSpacing / 2;
        this.renderHero(defHeroes[j], w - 60, dy, 'defender', j);
        this.renderTroops(defHeroes[j], w - 130, dy, 'defender');
      }
    },

    // ===== 渲染单个武将 =====
    renderHero: function(hero, x, y, side, index) {
      var ctx = this.ctx;
      var GS = window.SG.GameState;
      var heroData = GS.heroes[hero.heroId];
      var name = heroData ? heroData.name : hero.heroId;
      var faction = heroData ? heroData.faction : 'none';
      var color = FACTION_COLORS[faction] || '#888';

      var isDead = hero.hp <= 0 && hero.troops <= 0;
      var isSelected = (side === 'defender' && this._selectedDefender === index);

      ctx.save();

      if (isDead) {
        ctx.globalAlpha = 0.35;
      }

      // 选中高亮
      if (isSelected) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 24, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 武将头像（水墨风Canvas头像）
      if (window.SG.HeroPortrait && heroData) {
        var portraitCanvas = window.SG.HeroPortrait.generate(heroData, 40);
        ctx.globalAlpha = isDead ? 0.35 : 1;
        // 圆形裁剪
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(portraitCanvas, x - 20, y - 20, 40, 40);
      } else {
        // 降级：纯色圆
        ctx.fillStyle = color;
        ctx.globalAlpha = isDead ? 0.35 : 0.8;
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // 水墨描边（在clip外绘制）
      ctx.save();
      if (isDead) ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#333';
      ctx.globalAlpha = isDead ? 0.2 : 0.5;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 武将名字
      ctx.save();
      ctx.globalAlpha = isDead ? 0.3 : 0.9;
      ctx.fillStyle = '#2a1a0a';
      ctx.font = 'bold 12px "KaiTi", "STKaiti", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(name, x, y + 22);

      // HP条
      var hpBarW = 40;
      var hpBarH = 5;
      var hpBarX = x - hpBarW / 2;
      var hpBarY = y - 28;

      ctx.globalAlpha = isDead ? 0.2 : 0.6;
      ctx.fillStyle = '#333';
      ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);

      var hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
      var hpColor = hpRatio > 0.5 ? '#44aa44' : (hpRatio > 0.2 ? '#ccaa22' : '#cc3333');
      ctx.fillStyle = hpColor;
      ctx.globalAlpha = isDead ? 0.3 : 0.85;
      ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);

      // HP文字
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = isDead ? 0.2 : 0.8;
      ctx.font = '9px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(hero.hp + '/' + hero.maxHp, x, hpBarY + hpBarH / 2);

      // SP条
      var spBarY = hpBarY - 7;
      ctx.globalAlpha = isDead ? 0.2 : 0.4;
      ctx.fillStyle = '#333';
      ctx.fillRect(hpBarX, spBarY, hpBarW, 4);

      var spRatio = hero.maxSp > 0 ? hero.sp / hero.maxSp : 0;
      ctx.fillStyle = '#4488cc';
      ctx.globalAlpha = isDead ? 0.3 : 0.85;
      ctx.fillRect(hpBarX, spBarY, hpBarW * spRatio, 4);

      // 士气值
      ctx.fillStyle = '#8a7a5a';
      ctx.globalAlpha = isDead ? 0.2 : 0.7;
      ctx.font = '10px "KaiTi", "STKaiti", serif';
      ctx.textBaseline = 'top';
      ctx.fillText('士气' + hero.morale, x, y + 35);

      ctx.restore();
    },

    // ===== 渲染兵力阵型 =====
    renderTroops: function(hero, x, y, side) {
      var ctx = this.ctx;
      if (hero.troops <= 0) return;

      var isDead = hero.hp <= 0;
      ctx.save();
      ctx.globalAlpha = isDead ? 0.15 : 0.7;

      // 兵力数字
      ctx.fillStyle = '#5a4a3a';
      ctx.font = '11px "KaiTi", "STKaiti", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('兵力:' + hero.troops, x, y - 15);

      // 阵型小图标（按兵力数量决定行列）
      var troopCount = Math.min(Math.ceil(hero.troops / 500), 30);
      var cols = 5;
      var rows = Math.ceil(troopCount / cols);
      var dotSize = 4;
      var spacing = 7;

      var startX = x - (cols - 1) * spacing / 2;
      var startY = y - (rows - 1) * spacing / 2 + 5;

      var faction = window.SG.GameState.heroes[hero.heroId] ? window.SG.GameState.heroes[hero.heroId].faction : 'none';
      ctx.fillStyle = FACTION_COLORS[faction] || '#888';

      var shapeFn = TROOP_SHAPES[hero.troopType] || TROOP_SHAPES.infantry;
      var drawn = 0;
      for (var r = 0; r < rows && drawn < troopCount; r++) {
        for (var c = 0; c < cols && drawn < troopCount; c++) {
          var dx = startX + c * spacing;
          var dy = startY + r * spacing;
          shapeFn(ctx, dx, dy, dotSize);
          drawn++;
        }
      }

      ctx.restore();
    },

    // ===== 单挑叠加层 =====
    _renderDuelOverlay: function(ctx, w, h) {
      var duel = this._battleState.duelState;
      if (!duel) return;

      var GS = window.SG.GameState;
      var atkData = GS.heroes[duel.attacker.heroId];
      var defData = GS.heroes[duel.defender.heroId];
      var atkName = atkData ? atkData.name : duel.attacker.heroId;
      var defName = defData ? defData.name : duel.defender.heroId;

      // 半透明遮罩
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, w, h);

      // 单挑标题
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 28px "KaiTi", "STKaiti", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('单挑', w / 2, h / 2 - 80);

      // 攻方
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px "KaiTi", "STKaiti", serif';
      ctx.fillText(atkName, w / 2 - 100, h / 2 - 30);
      ctx.font = '14px "KaiTi", "STKaiti", serif';
      ctx.fillText('HP: ' + duel.attacker.hp + '/' + duel.attacker.maxHp, w / 2 - 100, h / 2);

      // VS
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 24px "KaiTi", "STKaiti", serif';
      ctx.fillText('VS', w / 2, h / 2 - 15);

      // 守方
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px "KaiTi", "STKaiti", serif';
      ctx.fillText(defName, w / 2 + 100, h / 2 - 30);
      ctx.font = '14px "KaiTi", "STKaiti", serif';
      ctx.fillText('HP: ' + duel.defender.hp + '/' + duel.defender.maxHp, w / 2 + 100, h / 2);

      // 闪烁效果
      var pulse = 0.5 + 0.5 * Math.sin(this._frame * 0.15);
      ctx.globalAlpha = pulse * 0.3;
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 120, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    },

    // ===== 动画系统 =====
    addAnimation: function(anim) {
      anim.startTime = Date.now();
      anim.duration = anim.duration || 600;
      this.animations.push(anim);
    },

    _renderAnimations: function(ctx, w, h) {
      var now = Date.now();
      for (var i = this.animations.length - 1; i >= 0; i--) {
        var anim = this.animations[i];
        var elapsed = now - anim.startTime;
        if (elapsed >= anim.duration) {
          this.animations.splice(i, 1);
          continue;
        }
        this.renderSkillEffect(ctx, anim, elapsed / anim.duration, w, h);
      }
    },

    renderSkillEffect: function(ctx, anim, progress, w, h) {
      var type = anim.animation || 'ink';
      var cx = anim.x || w / 2;
      var cy = anim.y || h / 2;

      ctx.save();

      if (type === 'fire') {
        // 火焰特效
        var alpha = 1 - progress;
        ctx.globalAlpha = alpha * 0.8;
        for (var i = 0; i < 8; i++) {
          var angle = (Math.PI * 2 / 8) * i + progress * Math.PI;
          var radius = 20 + progress * 60;
          var fx = cx + Math.cos(angle) * radius;
          var fy = cy + Math.sin(angle) * radius;
          var size = 8 + (1 - progress) * 12;
          ctx.fillStyle = i % 2 === 0 ? '#ff4400' : '#ffaa00';
          ctx.beginPath();
          ctx.arc(fx, fy, size, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === 'lightning') {
        // 雷电特效
        var lAlpha = (1 - progress) * (0.5 + 0.5 * Math.sin(progress * 20));
        ctx.globalAlpha = lAlpha;
        ctx.strokeStyle = '#aaddff';
        ctx.lineWidth = 3;
        for (var j = 0; j < 3; j++) {
          ctx.beginPath();
          var lx = cx + (j - 1) * 40;
          ctx.moveTo(lx, cy - 40);
          var segs = 5;
          for (var s = 1; s <= segs; s++) {
            var sy = cy - 40 + (80 / segs) * s;
            var sx = lx + (Math.random() - 0.5) * 30;
            ctx.lineTo(sx, sy);
          }
          ctx.stroke();
        }
        // 闪光
        ctx.globalAlpha = lAlpha * 0.3;
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 60, cy - 50, 120, 100);
      } else if (type === 'meteor') {
        // 天命之子 - 陨石坠落特效
        var fallProgress = Math.min(progress * 1.5, 1.0); // 前段快速下落
        var explodeProgress = Math.max((progress - 0.4) / 0.6, 0); // 后段爆炸

        // 陨石下落轨迹
        if (progress < 0.5) {
          var meteorY = -50 + (cy + 50) * (progress / 0.5);
          var meteorX = cx + 30 * Math.sin(progress * 8);

          // 拖尾
          ctx.globalAlpha = 0.6 * (1 - progress);
          var grad = ctx.createLinearGradient(meteorX, meteorY - 80, meteorX, meteorY);
          grad.addColorStop(0, 'rgba(255,100,0,0)');
          grad.addColorStop(1, 'rgba(255,200,0,0.8)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(meteorX + 10 * Math.sin(progress * 6), meteorY - 80);
          ctx.lineTo(meteorX, meteorY);
          ctx.stroke();

          // 陨石本体
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#ff4400';
          ctx.beginPath();
          ctx.arc(meteorX, meteorY, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffcc00';
          ctx.beginPath();
          ctx.arc(meteorX, meteorY, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        // 爆炸
        if (explodeProgress > 0) {
          var expAlpha = (1 - explodeProgress);
          // 冲击波
          ctx.globalAlpha = expAlpha * 0.5;
          ctx.strokeStyle = '#ff6600';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(cx, cy, explodeProgress * 150, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = '#ffcc00';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, explodeProgress * 100, 0, Math.PI * 2);
          ctx.stroke();

          // 碎片飞溅
          for (var mi = 0; mi < 16; mi++) {
            var mAngle = (Math.PI * 2 / 16) * mi + explodeProgress * 0.5;
            var mR = explodeProgress * 120;
            var mx2 = cx + Math.cos(mAngle) * mR;
            var my2 = cy + Math.sin(mAngle) * mR;
            var mSize = 4 * (1 - explodeProgress);
            ctx.globalAlpha = expAlpha * 0.7;
            ctx.fillStyle = mi % 2 === 0 ? '#ff4400' : '#ffaa00';
            ctx.beginPath();
            ctx.arc(mx2, my2, mSize, 0, Math.PI * 2);
            ctx.fill();
          }

          // 中心闪光
          ctx.globalAlpha = expAlpha * 0.4;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(cx, cy, (1 - explodeProgress) * 50, 0, Math.PI * 2);
          ctx.fill();
        }

        // "天命之子" 文字
        if (progress > 0.2 && progress < 0.9) {
          var textAlpha = progress < 0.5 ? (progress - 0.2) / 0.3 : (0.9 - progress) / 0.4;
          ctx.globalAlpha = textAlpha;
          ctx.fillStyle = '#ffd700';
          ctx.font = 'bold 28px "KaiTi", "STKaiti", serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('天命之子', cx, cy - 80);
          // 金光
          ctx.globalAlpha = textAlpha * 0.3;
          ctx.fillStyle = '#ffd700';
          ctx.beginPath();
          ctx.arc(cx, cy - 80, 60, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === 'meteor_shockwave') {
        // 陨石冲击波（全屏）
        var swAlpha = 1 - progress;
        ctx.globalAlpha = swAlpha * 0.2;
        ctx.fillStyle = '#ff4400';
        ctx.fillRect(0, 0, w, h);

        // 屏幕震动效果（通过画面抖动模拟）
        if (progress < 0.3) {
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
        }
      } else {
        // 水墨飞溅特效
        var inkAlpha = 1 - progress;
        ctx.globalAlpha = inkAlpha * 0.6;
        var inkRadius = 10 + progress * 80;
        // 墨滴
        for (var k = 0; k < 12; k++) {
          var inkAngle = (Math.PI * 2 / 12) * k + progress * 2;
          var inkR = inkRadius * (0.5 + Math.random() * 0.5);
          var ix = cx + Math.cos(inkAngle) * inkR;
          var iy = cy + Math.sin(inkAngle) * inkR;
          var dotSize = 3 + (1 - progress) * 5;
          ctx.fillStyle = k % 3 === 0 ? '#1a0a00' : '#3a2a1a';
          ctx.beginPath();
          ctx.arc(ix, iy, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
        // 中心晕染
        ctx.globalAlpha = inkAlpha * 0.15;
        ctx.fillStyle = '#1a0a00';
        ctx.beginPath();
        ctx.arc(cx, cy, inkRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },

    // ===== 战斗日志 =====
    _renderBattleLog: function(ctx, w, h) {
      var state = this._battleState;
      if (!state || !state.log || state.log.length === 0) return;

      var logX = 10;
      var logY = h - 130;
      var logW = w - 20;
      var logH = 60;

      ctx.save();

      // 日志背景
      ctx.fillStyle = 'rgba(245,240,232,0.85)';
      ctx.strokeStyle = '#8a7a5a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(logX + 4, logY);
      ctx.lineTo(logX + logW - 4, logY);
      ctx.arcTo(logX + logW, logY, logX + logW, logY + 4, 4);
      ctx.lineTo(logX + logW, logY + logH - 4);
      ctx.arcTo(logX + logW, logY + logH, logX + logW - 4, logY + logH, 4);
      ctx.lineTo(logX + 4, logY + logH);
      ctx.arcTo(logX, logY + logH, logX, logY + logH - 4, 4);
      ctx.lineTo(logX, logY + 4);
      ctx.arcTo(logX, logY, logX + 4, logY, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 日志文字（最近4条）
      ctx.fillStyle = '#2a1a0a';
      ctx.font = '11px "KaiTi", "STKaiti", serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      var startIdx = Math.max(0, state.log.length - 4);
      for (var i = startIdx; i < state.log.length; i++) {
        var line = state.log[i];
        var text = line.msg;
        ctx.fillText(text, logX + 8, logY + 5 + (i - startIdx) * 14);
      }

      ctx.restore();
    },

    // ===== 操作按钮 =====
    _renderControls: function(ctx, w, h) {
      if (this._battleState.phase === 'ended') return;

      var state = this._battleState;
      var GS = window.SG.GameState;
      var playerFaction = GS.playerFaction;
      var playerSide = state.attacker.faction === playerFaction ? 'attacker' : 'defender';
      var playerHeroes = playerSide === 'attacker' ? state.attacker.heroes : state.defender.heroes;

      this._buttons = [];

      var btnY = h - 55;
      var btnW = 65;
      var btnH = 28;
      var gap = 5;
      var startX = 10;

      // 撤退按钮
      this._drawButton(ctx, startX, btnY, btnW, btnH, '撤退', '#aa3333', 'retreat');
      startX += btnW + gap;

      // 技能按钮：每个存活武将一个
      for (var i = 0; i < playerHeroes.length; i++) {
        var hero = playerHeroes[i];
        if (hero.hp <= 0 && hero.troops <= 0) continue;
        var heroData = GS.heroes[hero.heroId];
        if (!heroData || !heroData.skills || heroData.skills.length === 0) continue;

        // 每个技能一个按钮
        for (var s = 0; s < heroData.skills.length; s++) {
          var skillId = heroData.skills[s];
          var skillData = window.SG.SKILLS_DATA[skillId];
          if (!skillData) continue;
          var canUse = hero.sp >= skillData.spCost;
          var label = skillData.name + '(' + skillData.spCost + ')';
          var color = canUse ? '#336699' : '#666666';
          var bw = Math.max(btnW, ctx.measureText(label).width + 16);
          this._drawButton(ctx, startX, btnY, bw, btnH, label, color, 'skill', { heroIdx: i, skillId: skillId, side: playerSide, enabled: canUse });
          startX += bw + gap;
          if (startX > w - 80) break;
        }
        if (startX > w - 80) break;
      }

      // 单挑按钮（选中敌方武将时显示）
      if (this._selectedDefender >= 0 && this._battleState.phase === 'fighting') {
        var defHeroes = state.defender.heroes;
        if (this._selectedDefender < defHeroes.length && defHeroes[this._selectedDefender].hp > 0) {
          // 找到玩家方第一个存活武将
          for (var d = 0; d < playerHeroes.length; d++) {
            if (playerHeroes[d].hp > 0) {
              this._drawButton(ctx, w - 75, btnY, 65, btnH, '单挑', '#996633', 'duel', { atkIdx: d, defIdx: this._selectedDefender });
              break;
            }
          }
        }
      }
    },

    _drawButton: function(ctx, x, y, w, h, label, bgColor, action, data) {
      ctx.save();

      var enabled = !data || data.enabled !== false;

      // 按钮背景
      ctx.fillStyle = bgColor;
      ctx.globalAlpha = enabled ? 0.85 : 0.4;
      ctx.beginPath();
      ctx.moveTo(x + 3, y);
      ctx.lineTo(x + w - 3, y);
      ctx.arcTo(x + w, y, x + w, y + 3, 3);
      ctx.lineTo(x + w, y + h - 3);
      ctx.arcTo(x + w, y + h, x + w - 3, y + h, 3);
      ctx.lineTo(x + 3, y + h);
      ctx.arcTo(x, y + h, x, y + h - 3, 3);
      ctx.lineTo(x, y + 3);
      ctx.arcTo(x, y, x + 3, y, 3);
      ctx.closePath();
      ctx.fill();

      // 按钮描边
      ctx.strokeStyle = '#2a1a0a';
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 按钮文字
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = enabled ? 0.95 : 0.5;
      ctx.font = '11px "KaiTi", "STKaiti", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + h / 2);

      ctx.restore();

      // 注册按钮区域
      this._buttons.push({
        x: x, y: y, w: w, h: h,
        action: action,
        data: data || {}
      });
    },

    // ===== 战斗结束画面 =====
    _renderEndScreen: function(ctx, w, h) {
      var state = this._battleState;
      var result = window.SG.BattleEngine.getResult();

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 32px "KaiTi", "STKaiti", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      var winText = '';
      if (result && result.winner === 'attacker') {
        var atkFaction = state.attacker.faction;
        winText = ((window.SG.FACTION_NAMES && window.SG.FACTION_NAMES[atkFaction]) || atkFaction) + ' 攻方获胜！';
      } else if (result && result.winner === 'defender') {
        var defFaction = state.defender.faction;
        winText = ((window.SG.FACTION_NAMES && window.SG.FACTION_NAMES[defFaction]) || defFaction) + ' 守方获胜！';
      }
      ctx.fillText(winText, w / 2, h / 2 - 40);

      // 战绩摘要
      if (result) {
        ctx.fillStyle = '#ddd';
        ctx.font = '14px "KaiTi", "STKaiti", serif';
        var capturedCount = 0;
        for (var i = 0; i < result.defenderCasualties.length; i++) {
          if (result.defenderCasualties[i].captured) capturedCount++;
        }
        for (var j = 0; j < result.attackerCasualties.length; j++) {
          if (result.attackerCasualties[j].captured) capturedCount++;
        }
        ctx.fillText('被俘武将：' + capturedCount + ' 人', w / 2, h / 2 + 10);
      }

      // 返回按钮
      ctx.fillStyle = '#fff';
      ctx.font = '16px "KaiTi", "STKaiti", serif';
      ctx.fillText('点击任意处返回', w / 2, h / 2 + 50);

      ctx.restore();
    },

    // ===== 事件绑定 =====
    _bindEvents: function() {
      var self = this;
      this._clickHandler = function(e) { self._handleClick(e); };
      this._moveHandler = function(e) { self._handleMouseMove(e); };
      if (this.canvas) {
        this.canvas.addEventListener('click', this._clickHandler);
        this.canvas.addEventListener('mousemove', this._moveHandler);
      }
    },

    _unbindEvents: function() {
      if (this.canvas) {
        if (this._clickHandler) this.canvas.removeEventListener('click', this._clickHandler);
        if (this._moveHandler) this.canvas.removeEventListener('mousemove', this._moveHandler);
      }
      this._clickHandler = null;
      this._moveHandler = null;
    },

    _handleClick: function(e) {
      if (!this.active || !this._battleState) return;

      var rect = this.canvas.getBoundingClientRect();
      var scaleX = this.canvas.width / rect.width;
      var scaleY = this.canvas.height / rect.height;
      var mx = (e.clientX - rect.left) * scaleX;
      var my = (e.clientY - rect.top) * scaleY;

      // 战斗结束：点击任意处返回
      if (this._battleState.phase === 'ended') {
        window.SG.BattleEngine.applyResult();
        this.stop();
        if (window.SG.UIManager && window.SG.UIManager.showBattleResult) {
          window.SG.UIManager.showBattleResult();
        }
        // 返回地图
        var GS = window.SG.GameState;
        GS.phase = 'strategic';
        return;
      }

      // 检查按钮点击
      for (var i = 0; i < this._buttons.length; i++) {
        var btn = this._buttons[i];
        if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
          this._onButtonClick(btn);
          return;
        }
      }

      // 检查是否点击了敌方武将（选中用于单挑）
      var w = this.canvas.width;
      var state = this._battleState;
      var defHeroes = state.defender.heroes;
      var maxHeroes = Math.max(state.attacker.heroes.length, defHeroes.length, 1);
      var heroAreaTop = 55;
      var heroAreaBottom = this.canvas.height - 150;
      var heroAreaHeight = heroAreaBottom - heroAreaTop;
      var heroSpacing = heroAreaHeight / maxHeroes;

      for (var j = 0; j < defHeroes.length; j++) {
        var hy = heroAreaTop + heroSpacing * j + heroSpacing / 2;
        var hx = w - 60;
        var dx = mx - hx;
        var dy = my - hy;
        if (dx * dx + dy * dy < 25 * 25) {
          if (defHeroes[j].hp > 0) {
            this._selectedDefender = j;
          }
          return;
        }
      }

      // 点击空白取消选中
      this._selectedDefender = -1;
    },

    _handleMouseMove: function(e) {
      if (!this.active || !this.canvas) return;
      var rect = this.canvas.getBoundingClientRect();
      var scaleX = this.canvas.width / rect.width;
      var scaleY = this.canvas.height / rect.height;
      var mx = (e.clientX - rect.left) * scaleX;
      var my = (e.clientY - rect.top) * scaleY;

      // 悬停指针
      var isOverButton = false;
      for (var i = 0; i < this._buttons.length; i++) {
        var btn = this._buttons[i];
        if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
          isOverButton = true;
          break;
        }
      }
      this.canvas.style.cursor = isOverButton ? 'pointer' : 'default';
    },

    _onButtonClick: function(btn) {
      if (btn.action === 'retreat') {
        window.SG.BattleEngine.retreat();
      } else if (btn.action === 'skill') {
        if (!btn.data.enabled) return;
        var result = window.SG.BattleEngine.useSkill(btn.data.heroIdx, btn.data.skillId, btn.data.side);
        if (result) {
          // 播放技能动画
          var w = this.canvas.width;
          var h = this.canvas.height;
          var animX = result.range === 'self' ? (result.side === 'attacker' ? w * 0.25 : w * 0.75) : w / 2;
          this.addAnimation({
            x: animX,
            y: h / 2,
            animation: result.animation,
            duration: 600
          });
        }
      } else if (btn.action === 'duel') {
        var duelState = window.SG.BattleEngine.startDuel(btn.data.atkIdx, btn.data.defIdx);
        this._selectedDefender = -1;
        // 打开单挑UI面板
        if (duelState && window.SG.DuelUI && window.SG.DuelSystem) {
          var duelSysState = window.SG.DuelSystem.getState();
          if (duelSysState) {
            window.SG.DuelUI.open(duelSysState, {
              onAction: (function(scene) {
                return function(action, skillId) {
                  scene._handleDuelAction(action, skillId);
                };
              })(this),
              onComplete: (function(scene) {
                return function() {
                  scene._handleDuelComplete();
                };
              })(this)
            });
          }
        }
      }
    },

    // 处理单挑玩家行动
    _handleDuelAction: function(action, skillId) {
      var duelState = window.SG.DuelSystem.getState();
      if (!duelState) return;

      var currentActor = duelState.currentActor;
      var hero = duelState[currentActor];

      // 玩家选择行动
      var ok = window.SG.DuelSystem.chooseAction(currentActor, action, skillId);
      if (!ok) {
        return;
      }

      // 如果是撤退，立即结束
      if (action === 'retreat') {
        var result = window.SG.DuelSystem.getResult();
        if (result) {
          window.SG.DuelUI.close();
          window.SG.BattleEngine.applyDuelResult(result);
          if (window.SG.UIManager && window.SG.UIManager.showToast) {
            window.SG.UIManager.showToast('单挑结束：' + (result.winner === 'attacker' ? duelState.attacker.data.name : duelState.defender.data.name) + ' 获胜！');
          }
        }
        return;
      }

      // 执行这一轮的所有行动
      window.SG.DuelSystem.state.phase = 'acting';
      var events = window.SG.DuelSystem.executeTurn();

      // 重新获取状态
      var newState = window.SG.DuelSystem.getState();

      // 检查单挑是否结束
      if (newState.phase === 'ended') {
        var finalResult = window.SG.DuelSystem.getResult();
        // 显示最后一个事件
        if (events && events.length > 0) {
          window.SG.DuelUI.refresh(newState, events[events.length - 1]);
        }
        setTimeout(function() {
          var r = window.SG.DuelSystem.getResult();
          window.SG.DuelUI.refresh(newState, null);
          setTimeout(function() {
            window.SG.DuelUI.close();
            window.SG.BattleEngine.applyDuelResult(r);
            if (window.SG.UIManager && window.SG.UIManager.showToast) {
              window.SG.UIManager.showToast('单挑结束：' + (r.winner === 'attacker' ? duelState.attacker.data.name : duelState.defender.data.name) + ' 获胜！');
            }
          }, 1500);
        }, 1200);
        return;
      }

      // 显示最后一个事件
      var lastEvt = events && events.length > 0 ? events[events.length - 1] : null;
      window.SG.DuelUI.refresh(newState, lastEvt);

      // 如果下一回合还是AI行动，自动执行
      if (newState.phase === 'choosing' && newState.currentActor) {
        var nextHero = newState[newState.currentActor];
        if (!nextHero.isPlayer) {
          window.SG.DuelUI._pendingAI = true;
          setTimeout((function(state) {
            return function() {
              // AI自动选择行动
              window.SG.DuelSystem._aiChooseAction(state.currentActor);
              // 执行回合
              window.SG.DuelSystem.state.phase = 'acting';
              var aiEvents = window.SG.DuelSystem.executeTurn();
              var newState2 = window.SG.DuelSystem.getState();
              if (newState2.phase === 'ended') {
                var aiLastEvt = aiEvents && aiEvents.length > 0 ? aiEvents[aiEvents.length - 1] : null;
                window.SG.DuelUI.refresh(newState2, aiLastEvt);
                setTimeout(function() {
                  var r2 = window.SG.DuelSystem.getResult();
                  window.SG.DuelUI.close();
                  window.SG.BattleEngine.applyDuelResult(r2);
                  if (window.SG.UIManager && window.SG.UIManager.showToast) {
                    window.SG.UIManager.showToast('单挑结束');
                  }
                }, 1500);
                return;
              }
              var evt = aiEvents && aiEvents.length > 0 ? aiEvents[aiEvents.length - 1] : null;
              window.SG.DuelUI.refresh(newState2, evt);
              window.SG.DuelUI._pendingAI = false;
              // 检查下一回合是否又是AI
              if (newState2.phase === 'choosing' && newState2.currentActor) {
                var nxH = newState2[newState2.currentActor];
                if (!nxH.isPlayer) {
                  window.SG.DuelUI._pendingAI = true;
                  setTimeout(arguments.callee, 1000);
                }
              }
            };
          })(newState), 1000);
        }
      }
    },

    // 单挑完成回调
    _handleDuelComplete: function() {
      // 已经在handleDuelAction里处理了applyDuelResult
    },

    // ===== 战斗tick =====
    _startBattleTick: function() {
      var self = this;
      if (this._tickTimer) clearInterval(this._tickTimer);
      this._tickTimer = setInterval(function() {
        if (!self.active) return;
        var events = window.SG.BattleEngine.step();
        if (events && events.length > 0) {
          self._processEvents(events);
        }
      }, BATTLE_TICK_MS);
    },

    _processEvents: function(events) {
      var w = this.canvas.width;
      var h = this.canvas.height;

      for (var i = 0; i < events.length; i++) {
        var evt = events[i];

        if (evt.type === 'battleEnd') {
          // 战斗结束，停止tick
          if (this._tickTimer) {
            clearInterval(this._tickTimer);
            this._tickTimer = null;
          }
        }

        // 为攻击事件添加动画
        if (evt.type === 'attack') {
          var animX = evt.side === 'attacker' ? w * 0.55 : w * 0.45;
          this.addAnimation({
            x: animX,
            y: h * 0.3 + Math.random() * h * 0.3,
            animation: 'ink',
            duration: 400
          });
        }

        // 技能事件动画
        if (evt.type === 'skill' || evt.type === 'advisorSkill') {
          this.addAnimation({
            x: w / 2,
            y: h / 2,
            animation: evt.animation || 'ink',
            duration: 700
          });
        }

        // 天命之子：陨石动画
        if (evt.destiny) {
          // 全屏震动+陨石坠落效果
          var opposeSide = evt.destiny.side === 'attacker' ? 'defender' : 'attacker';
          var meteorX = opposeSide === 'attacker' ? w * 0.25 : w * 0.75;
          this.addAnimation({
            x: meteorX,
            y: h / 2,
            animation: 'meteor',
            duration: 1500
          });
          // 额外小陨石到每个敌方武将位置
          this.addAnimation({
            x: w / 2,
            y: h * 0.3,
            animation: 'meteor_shockwave',
            duration: 1200
          });
        }
      }
    },

    // ===== 渲染循环 =====
    _startRenderLoop: function() {
      var self = this;
      function loop() {
        if (!self.active) return;
        self.render();
        self._animFrame = requestAnimationFrame(loop);
      }
      loop();
    }
  };

  window.SG.BattleScene = Scene;

})();
