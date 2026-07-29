// 三国群英传 - 水墨风大地图渲染器
window.SG = window.SG || {};

(function() {
  'use strict';

  // 水墨风装饰元素（静态山水）
  var INK_MOUNTAINS = [
    // 秦岭山脉
    { points: [{x:200,y:240},{x:260,y:190},{x:320,y:210},{x:380,y:180},{x:440,y:200},{x:500,y:170}], alpha: 0.12 },
    // 太行山脉
    { points: [{x:440,y:120},{x:480,y:80},{x:530,y:100},{x:560,y:70}], alpha: 0.10 },
    // 南方丘陵
    { points: [{x:220,y:380},{x:280,y:350},{x:340,y:370},{x:400,y:340},{x:460,y:360}], alpha: 0.08 },
    // 武夷山脉
    { points: [{x:520,y:360},{x:560,y:330},{x:600,y:350},{x:620,y:320}], alpha: 0.09 }
  ];

  // 河流
  var INK_RIVERS = [
    // 长江
    { points: [{x:260,y:330},{x:320,y:350},{x:380,y:370},{x:440,y:360},{x:500,y:370},{x:560,y:380},{x:600,y:400}], width: 3, alpha: 0.18 },
    // 黄河
    { points: [{x:220,y:180},{x:300,y:210},{x:380,y:195},{x:440,y:220},{x:500,y:200},{x:540,y:180}], width: 2.5, alpha: 0.15 }
  ];

  var Renderer = {

    canvas: null,
    ctx: null,
    width: 0,
    height: 0,

    // 选中城市ID
    selectedCity: null,

    // 动画帧计数
    _frame: 0,

    // 缩放与偏移（将地图坐标映射到画布）
    _scale: 1,
    _offsetX: 0,
    _offsetY: 0,

    // 离屏缓存（静态山水背景）
    _bgCache: null,
    _bgDirty: true,

    // ===== 初始化 =====
    init: function(canvas) {
      if (!canvas) {
        canvas = document.getElementById('gameCanvas');
      }
      this.canvas = canvas;
      if (!this.canvas) {
        console.error('MapRenderer: 未找到canvas元素');
        return;
      }
      this.ctx = this.canvas.getContext('2d');
      this._resize();
      this._bgDirty = true;

      // 监听窗口大小变化
      var self = this;
      window.addEventListener('resize', function() {
        self._resize();
        self._bgDirty = true;
      });
    },

    // 响应式调整画布尺寸
    _resize: function() {
      // 使用canvas自身的CSS显示尺寸，而非容器尺寸
      var rect = this.canvas.getBoundingClientRect();
      this.width = Math.floor(rect.width) || 800;
      this.height = Math.floor(rect.height) || 600;
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this._calcTransform();
    },

    // 计算坐标映射：地图坐标(x:200~600, y:80~550) → 画布坐标
    _calcTransform: function() {
      var pad = 40; // 边距
      var mapMinX = 180, mapMaxX = 640;
      var mapMinY = 50, mapMaxY = 560;
      var mapW = mapMaxX - mapMinX;
      var mapH = mapMaxY - mapMinY;
      var availW = this.width - pad * 2;
      var availH = this.height - pad * 2;
      this._scale = Math.min(availW / mapW, availH / mapH);
      this._offsetX = pad + (availW - mapW * this._scale) / 2 - mapMinX * this._scale;
      this._offsetY = pad + (availH - mapH * this._scale) / 2 - mapMinY * this._scale;
    },

    // 地图坐标 → 画布坐标
    mapToScreen: function(mx, my) {
      return {
        x: mx * this._scale + this._offsetX,
        y: my * this._scale + this._offsetY
      };
    },

    // 画布坐标 → 地图坐标
    screenToMap: function(sx, sy) {
      return {
        x: (sx - this._offsetX) / this._scale,
        y: (sy - this._offsetY) / this._scale
      };
    },

    // ===== 主渲染 =====
    render: function() {
      if (!this.ctx) return;
      this._frame++;

      var ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      // 1. 宣纸背景
      this._drawBackground(ctx);

      // 2. 水墨山水装饰
      this._drawInkDecorations(ctx);

      // 3. 城市连线
      this._drawCityConnections(ctx);

      // 4. 行军军队
      this._drawArmies(ctx);

      // 5. 城市节点
      this._drawCities(ctx);

      // 6. 选中城市高亮
      this._drawSelectedHighlight(ctx);

      // 7. 悬停提示
      this._drawHoverTooltip(ctx);
    },

    // ===== 宣纸背景 =====
    _drawBackground: function(ctx) {
      // 基底色
      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(0, 0, this.width, this.height);

      // 细微纹理：用细线模拟宣纸纤维
      ctx.save();
      ctx.globalAlpha = 0.03;
      ctx.strokeStyle = '#8a7a5a';
      ctx.lineWidth = 0.5;
      // 伪随机纹理，基于画布尺寸
      var seed = 12345;
      for (var i = 0; i < 60; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        var y = (seed % this.height);
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        var x1 = (seed % (this.width * 0.3));
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        var x2 = x1 + (seed % (this.width * 0.5)) + this.width * 0.2;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        // 轻微弯曲
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        var cy = y + ((seed % 20) - 10);
        ctx.quadraticCurveTo((x1 + x2) / 2, cy, x2, y);
        ctx.stroke();
      }
      ctx.restore();
    },

    // ===== 水墨山水装饰 =====
    _drawInkDecorations: function(ctx) {
      // 山脉
      for (var m = 0; m < INK_MOUNTAINS.length; m++) {
        var mt = INK_MOUNTAINS[m];
        ctx.save();
        ctx.globalAlpha = mt.alpha;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        var sp = this.mapToScreen(mt.points[0].x, mt.points[0].y);
        ctx.moveTo(sp.x, sp.y);
        for (var p = 1; p < mt.points.length; p++) {
          var prev = mt.points[p - 1];
          var curr = mt.points[p];
          var cpx = (prev.x + curr.x) / 2;
          var cpy = Math.min(prev.y, curr.y) - 15;
          var cp = this.mapToScreen(cpx, cpy);
          var ep = this.mapToScreen(curr.x, curr.y);
          ctx.quadraticCurveTo(cp.x, cp.y, ep.x, ep.y);
        }
        ctx.stroke();

        // 山体填充（水墨晕染感）
        ctx.globalAlpha = mt.alpha * 0.4;
        ctx.fillStyle = '#555';
        ctx.lineTo(sp.x, sp.y + 60);
        for (var p2 = mt.points.length - 1; p2 >= 0; p2--) {
          var pt = this.mapToScreen(mt.points[p2].x, mt.points[p2].y);
          ctx.lineTo(pt.x, pt.y + 60);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 河流
      for (var r = 0; r < INK_RIVERS.length; r++) {
        var rv = INK_RIVERS[r];
        ctx.save();
        ctx.globalAlpha = rv.alpha;
        ctx.strokeStyle = '#4a6a8a';
        ctx.lineWidth = rv.width * this._scale * 0.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        var rp0 = this.mapToScreen(rv.points[0].x, rv.points[0].y);
        ctx.moveTo(rp0.x, rp0.y);
        for (var rp = 1; rp < rv.points.length; rp++) {
          var rprev = rv.points[rp - 1];
          var rcurr = rv.points[rp];
          // 平滑曲线
          var rcpx = (rprev.x + rcurr.x) / 2;
          var rcpy = (rprev.y + rcurr.y) / 2;
          var rcp = this.mapToScreen(rcpx, rcpy);
          var rep = this.mapToScreen(rcurr.x, rcurr.y);
          ctx.quadraticCurveTo(rcp.x, rcp.y, rep.x, rep.y);
        }
        ctx.stroke();

        // 河流宽度渐变（水墨晕染）
        ctx.globalAlpha = rv.alpha * 0.3;
        ctx.lineWidth = rv.width * this._scale * 2;
        ctx.stroke();
        ctx.restore();
      }
    },

    // ===== 城市连线 =====
    _drawCityConnections: function(ctx) {
      var GS = window.SG.GameState;
      if (!GS || !GS.cities) return;

      ctx.save();
      ctx.strokeStyle = '#8a7a5a';
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      var drawn = {};
      for (var id in GS.cities) {
        if (!GS.cities.hasOwnProperty(id)) continue;
        var city = GS.cities[id];
        var adjacent = city.adjacent || [];
        for (var a = 0; a < adjacent.length; a++) {
          var otherId = adjacent[a];
          // 避免重复绘制
          var key = id < otherId ? id + '-' + otherId : otherId + '-' + id;
          if (drawn[key]) continue;
          drawn[key] = true;

          var other = GS.cities[otherId];
          if (!other) continue;

          var p1 = this.mapToScreen(city.x, city.y);
          var p2 = this.mapToScreen(other.x, other.y);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      ctx.restore();
    },

    // ===== 行军军队 =====
    _drawArmies: function(ctx) {
      var GS = window.SG.GameState;
      if (!GS || !GS.armies) return;

      for (var i = 0; i < GS.armies.length; i++) {
        var army = GS.armies[i];
        var from = GS.cities[army.fromCity];
        var to = GS.cities[army.targetCity];
        if (!from || !to) continue;

        // 计算行军进度（0~1）
        var totalTurns = army.totalTurns || (army.turnsLeft + 1);
        var progress = 1 - (army.turnsLeft / totalTurns);

        var p1 = this.mapToScreen(from.x, from.y);
        var p2 = this.mapToScreen(to.x, to.y);
        var ax = p1.x + (p2.x - p1.x) * progress;
        var ay = p1.y + (p2.y - p1.y) * progress;

        // 势力颜色
        var color = '#cc8844';
        if (window.SG.FACTION_COLORS && window.SG.FACTION_COLORS[army.faction]) {
          color = window.SG.FACTION_COLORS[army.faction];
        }

        // 行军路径虚线
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 行军动画圆点（脉动效果）
        var pulse = 1 + 0.3 * Math.sin(this._frame * 0.1 + i);
        var radius = 6 * pulse;
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(ax, ay, radius, 0, Math.PI * 2);
        ctx.fill();

        // 外圈光晕
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(ax, ay, radius + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },

    // ===== 城市节点 =====
    _drawCities: function(ctx) {
      var GS = window.SG.GameState;
      if (!GS || !GS.cities) return;

      var playerFaction = GS.playerFaction;
      var radius = 18;

      for (var id in GS.cities) {
        if (!GS.cities.hasOwnProperty(id)) continue;
        var city = GS.cities[id];
        var pos = this.mapToScreen(city.x, city.y);

        // 势力颜色
        var color = '#888888';
        if (window.SG.FACTION_COLORS && window.SG.FACTION_COLORS[city.faction]) {
          color = window.SG.FACTION_COLORS[city.faction];
        }

        // 玩家城市内发光
        if (city.faction === playerFaction) {
          ctx.save();
          var glow = ctx.createRadialGradient(pos.x, pos.y, radius * 0.3, pos.x, pos.y, radius * 1.5);
          glow.addColorStop(0, color);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 城市圆点底色（水墨边缘）
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // 水墨风描边
        ctx.strokeStyle = '#333';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // 城市名称（书法风格）
        ctx.save();
        ctx.fillStyle = '#2a1a0a';
        ctx.font = 'bold 13px "KaiTi", "STKaiti", "FangSong", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(city.name, pos.x, pos.y - radius - 4);
        ctx.restore();

        // 兵力数字
        var troops = this._getCityTroopCount(city);
        ctx.save();
        ctx.fillStyle = '#5a4a3a';
        ctx.font = '10px "KaiTi", "STKaiti", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(troops, pos.x, pos.y + radius + 3);
        ctx.restore();
      }
    },

    // 获取城市总兵力
    _getCityTroopCount: function(city) {
      var GS = window.SG.GameState;
      if (!GS) return city.troops || 0;
      // 优先统计武将兵力之和
      if (city.heroes && city.heroes.length > 0) {
        var total = 0;
        for (var i = 0; i < city.heroes.length; i++) {
          var hero = GS.heroes[city.heroes[i]];
          if (hero) total += hero.troops;
        }
        return total;
      }
      return city.troops || 0;
    },

    // ===== 选中城市高亮 =====
    _drawSelectedHighlight: function(ctx) {
      if (!this.selectedCity) return;
      var GS = window.SG.GameState;
      if (!GS || !GS.cities) return;
      var city = GS.cities[this.selectedCity];
      if (!city) return;

      var pos = this.mapToScreen(city.x, city.y);
      var baseRadius = 18;

      // 势力颜色
      var color = '#888888';
      if (window.SG.FACTION_COLORS && window.SG.FACTION_COLORS[city.faction]) {
        color = window.SG.FACTION_COLORS[city.faction];
      }

      // 呼吸光圈动画
      var pulse = 1 + 0.15 * Math.sin(this._frame * 0.06);
      var ringRadius = (baseRadius + 6) * pulse;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 外层光晕
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ringRadius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },

    // ===== 悬停提示 =====
    _drawHoverTooltip: function(ctx) {
      var ctrl = window.SG.MapController;
      if (!ctrl || !ctrl.hoveredCity) return;
      var GS = window.SG.GameState;
      if (!GS || !GS.cities) return;
      var city = GS.cities[ctrl.hoveredCity];
      if (!city) return;

      var pos = this.mapToScreen(city.x, city.y);

      // 提示内容
      var factionName = city.faction;
      if (window.SG.FACTION_NAMES && window.SG.FACTION_NAMES[city.faction]) {
        factionName = window.SG.FACTION_NAMES[city.faction];
      }
      var troops = this._getCityTroopCount(city);
      var lines = [
        city.name + '（' + factionName + '）',
        '兵力：' + troops,
        '农业：' + city.agriculture + '  商业：' + city.commerce,
        '民心：' + city.morale + '  城防：' + city.defense
      ];

      // 提示框位置
      var tipW = 180;
      var tipH = lines.length * 18 + 12;
      var tipX = pos.x + 24;
      var tipY = pos.y - tipH / 2;

      // 防止超出画布
      if (tipX + tipW > this.width - 10) tipX = pos.x - tipW - 24;
      if (tipY < 10) tipY = 10;
      if (tipY + tipH > this.height - 10) tipY = this.height - tipH - 10;

      // 背景
      ctx.save();
      ctx.fillStyle = 'rgba(245,240,232,0.92)';
      ctx.strokeStyle = '#8a7a5a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      this._roundRect(ctx, tipX, tipY, tipW, tipH, 4);
      ctx.fill();
      ctx.stroke();

      // 文字
      ctx.fillStyle = '#2a1a0a';
      ctx.font = '12px "KaiTi", "STKaiti", serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (var l = 0; l < lines.length; l++) {
        ctx.fillText(lines[l], tipX + 8, tipY + 6 + l * 18);
      }
      ctx.restore();
    },

    // 圆角矩形辅助
    _roundRect: function(ctx, x, y, w, h, r) {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }
  };

  window.SG.MapRenderer = Renderer;

})();
