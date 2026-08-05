// 三国群英传 - 实景地图渲染器
window.SG = window.SG || {};

(function() {
  'use strict';

  // ===== 地理数据 =====

  // 中国海岸线（简化近似，三国时期）
  var COASTLINE = [
    { x: 180, y: 560 },
    { x: 200, y: 545 },
    { x: 220, y: 530 },
    { x: 240, y: 515 },
    { x: 260, y: 500 },
    { x: 280, y: 485 },
    { x: 310, y: 470 },
    { x: 340, y: 460 },
    { x: 370, y: 450 },
    { x: 400, y: 445 },
    { x: 420, y: 455 },
    { x: 435, y: 450 },
    { x: 445, y: 440 },
    { x: 460, y: 425 },
    { x: 480, y: 410 },
    { x: 500, y: 400 },
    { x: 520, y: 395 },
    { x: 540, y: 385 },
    { x: 560, y: 370 },
    { x: 580, y: 355 },
    { x: 600, y: 340 },
    { x: 615, y: 325 },
    { x: 625, y: 310 },
    { x: 635, y: 295 },
    { x: 640, y: 280 }
  ];

  // 海南岛
  var HAINAN = [
    { x: 360, y: 540 }, { x: 375, y: 535 }, { x: 385, y: 540 },
    { x: 385, y: 555 }, { x: 375, y: 560 }, { x: 360, y: 555 }
  ];

  // 台湾岛
  var TAIWAN = [
    { x: 620, y: 370 }, { x: 625, y: 385 }, { x: 622, y: 400 },
    { x: 618, y: 410 }, { x: 615, y: 405 }, { x: 616, y: 390 }
  ];

  // 黄河
  var YELLOW_RIVER = [
    { x: 220, y: 170 }, { x: 260, y: 180 }, { x: 300, y: 195 },
    { x: 340, y: 200 }, { x: 380, y: 195 }, { x: 420, y: 205 },
    { x: 460, y: 220 }, { x: 500, y: 230 }, { x: 540, y: 225 },
    { x: 580, y: 210 }, { x: 620, y: 195 }
  ];

  // 长江
  var YANGTZE_RIVER = [
    { x: 260, y: 350 }, { x: 290, y: 360 }, { x: 320, y: 370 },
    { x: 355, y: 380 }, { x: 390, y: 385 }, { x: 425, y: 380 },
    { x: 460, y: 370 }, { x: 495, y: 365 }, { x: 530, y: 355 },
    { x: 565, y: 345 }, { x: 600, y: 335 }
  ];

  // 淮河
  var HUAI_RIVER = [
    { x: 400, y: 300 }, { x: 430, y: 295 }, { x: 460, y: 290 },
    { x: 490, y: 285 }, { x: 520, y: 280 }, { x: 550, y: 275 }
  ];

  // 汉江
  var HANJIANG_RIVER = [
    { x: 310, y: 330 }, { x: 340, y: 335 }, { x: 370, y: 340 },
    { x: 400, y: 345 }
  ];

  // 珠江
  var ZHUJIANG_RIVER = [
    { x: 380, y: 490 }, { x: 395, y: 500 }, { x: 410, y: 510 },
    { x: 425, y: 520 }
  ];

  // 洞庭湖
  var DONGTING_LAKE = [
    { x: 395, y: 405 }, { x: 410, y: 400 }, { x: 420, y: 410 },
    { x: 415, y: 425 }, { x: 400, y: 425 }, { x: 393, y: 415 }
  ];

  // 鄱阳湖
  var POYANG_LAKE = [
    { x: 470, y: 395 }, { x: 480, y: 390 }, { x: 490, y: 400 },
    { x: 485, y: 415 }, { x: 475, y: 418 }, { x: 468, y: 408 }
  ];

  // 巢湖
  var CHAOHU_LAKE = [
    { x: 490, y: 345 }, { x: 498, y: 343 }, { x: 502, y: 350 },
    { x: 496, y: 355 }, { x: 490, y: 352 }
  ];

  // 秦岭山脉（南北气候分界）
  var QINLING_MOUNTAINS = [
    { x: 250, y: 260 }, { x: 280, y: 258 }, { x: 310, y: 262 },
    { x: 340, y: 265 }, { x: 370, y: 263 }, { x: 400, y: 260 },
    { x: 430, y: 258 }, { x: 460, y: 255 }
  ];

  // 太行山脉
  var TAIHANG_MOUNTAINS = [
    { x: 470, y: 120 }, { x: 465, y: 150 }, { x: 460, y: 180 },
    { x: 458, y: 210 }, { x: 462, y: 240 }, { x: 468, y: 270 }
  ];

  // 南岭山脉
  var NANLING_MOUNTAINS = [
    { x: 350, y: 460 }, { x: 380, y: 455 }, { x: 410, y: 452 },
    { x: 440, y: 455 }, { x: 470, y: 460 }
  ];

  // 天山山脉
  var TIANSHAN_MOUNTAINS = [
    { x: 180, y: 150 }, { x: 220, y: 140 }, { x: 260, y: 135 },
    { x: 300, y: 130 }
  ];

  // 大兴安岭
  var DAXINGANLING = [
    { x: 500, y: 55 }, { x: 520, y: 75 }, { x: 540, y: 95 },
    { x: 560, y: 115 }, { x: 580, y: 135 }
  ];

  // 横断山脉
  var HENGDUAN_MOUNTAINS = [
    { x: 220, y: 340 }, { x: 230, y: 360 }, { x: 240, y: 380 },
    { x: 250, y: 400 }, { x: 245, y: 420 }
  ];

  // 燕山山脉
  var YANSHAN_MOUNTAINS = [
    { x: 500, y: 90 }, { x: 520, y: 85 }, { x: 540, y: 80 },
    { x: 560, y: 85 }, { x: 580, y: 90 }
  ];

  // 长城
  var GREAT_WALL = [
    { x: 180, y: 130 }, { x: 220, y: 120 }, { x: 260, y: 110 },
    { x: 300, y: 105 }, { x: 340, y: 100 }, { x: 380, y: 95 },
    { x: 420, y: 90 }, { x: 460, y: 85 }, { x: 500, y: 80 },
    { x: 540, y: 75 }, { x: 580, y: 70 }, { x: 620, y: 65 }
  ];

  // 主要盆地与平原区域（多边形）
  var REGIONS = [
    // 关中平原
    {
      name: '关中',
      type: 'plain',
      points: [
        { x: 280, y: 210 }, { x: 340, y: 210 },
        { x: 370, y: 260 }, { x: 340, y: 285 },
        { x: 300, y: 275 }, { x: 280, y: 240 }
      ],
      color: '#e8dcc4'
    },
    // 华北平原
    {
      name: '华北',
      type: 'plain',
      points: [
        { x: 380, y: 140 }, { x: 440, y: 135 }, { x: 520, y: 130 },
        { x: 560, y: 160 }, { x: 540, y: 210 }, { x: 500, y: 240 },
        { x: 450, y: 250 }, { x: 400, y: 240 }, { x: 380, y: 200 }
      ],
      color: '#e0d4b8'
    },
    // 长江中下游平原
    {
      name: '江东',
      type: 'plain',
      points: [
        { x: 440, y: 320 }, { x: 500, y: 310 }, { x: 560, y: 315 },
        { x: 600, y: 330 }, { x: 580, y: 370 }, { x: 520, y: 380 },
        { x: 470, y: 370 }, { x: 440, y: 350 }
      ],
      color: '#dcd4b8'
    },
    // 四川盆地
    {
      name: '益州',
      type: 'basin',
      points: [
        { x: 250, y: 310 }, { x: 300, y: 305 }, { x: 340, y: 315 },
        { x: 360, y: 350 }, { x: 340, y: 385 }, { x: 300, y: 390 },
        { x: 260, y: 375 }, { x: 245, y: 345 }
      ],
      color: '#d4c8a8'
    },
    // 江汉平原
    {
      name: '荆州',
      type: 'plain',
      points: [
        { x: 380, y: 340 }, { x: 430, y: 335 }, { x: 460, y: 350 },
        { x: 450, y: 390 }, { x: 410, y: 410 }, { x: 380, y: 395 }
      ],
      color: '#dcd0b4'
    },
    // 河套平原
    {
      name: '朔方',
      type: 'plain',
      points: [
        { x: 280, y: 160 }, { x: 340, y: 155 }, { x: 370, y: 180 },
        { x: 350, y: 210 }, { x: 310, y: 210 }, { x: 280, y: 185 }
      ],
      color: '#d8ccb0'
    },
    // 东北平原
    {
      name: '辽东',
      type: 'plain',
      points: [
        { x: 500, y: 70 }, { x: 560, y: 65 }, { x: 600, y: 80 },
        { x: 610, y: 110 }, { x: 580, y: 130 }, { x: 540, y: 125 },
        { x: 510, y: 110 }
      ],
      color: '#d4ccb4'
    },
    // 云贵高原
    {
      name: '南中',
      type: 'plateau',
      points: [
        { x: 220, y: 390 }, { x: 270, y: 385 }, { x: 320, y: 395 },
        { x: 350, y: 430 }, { x: 330, y: 470 }, { x: 280, y: 480 },
        { x: 230, y: 460 }
      ],
      color: '#c8bca0'
    },
    // 岭南丘陵
    {
      name: '交州',
      type: 'hills',
      points: [
        { x: 350, y: 460 }, { x: 420, y: 455 }, { x: 470, y: 470 },
        { x: 460, y: 510 }, { x: 400, y: 530 }, { x: 360, y: 515 }
      ],
      color: '#c4b898'
    },
    // 西北戈壁
    {
      name: '凉州',
      type: 'desert',
      points: [
        { x: 180, y: 100 }, { x: 250, y: 95 }, { x: 320, y: 100 },
        { x: 350, y: 140 }, { x: 340, y: 190 }, { x: 300, y: 200 },
        { x: 240, y: 195 }, { x: 190, y: 180 }
      ],
      color: '#c0b898'
    },
    // 山东半岛
    {
      name: '青徐',
      type: 'plain',
      points: [
        { x: 500, y: 180 }, { x: 550, y: 175 }, { x: 590, y: 190 },
        { x: 600, y: 220 }, { x: 560, y: 240 }, { x: 520, y: 230 },
        { x: 500, y: 210 }
      ],
      color: '#e2d4b8'
    }
  ];

  // 省份边界线
  var PROVINCE_BORDERS = [
    // 司隶/冀州边界
    [{x: 440, y: 140}, {x: 440, y: 250}],
    // 冀州/兖州边界
    [{x: 500, y: 150}, {x: 500, y: 240}],
    // 兖州/徐州边界
    [{x: 540, y: 180}, {x: 540, y: 260}],
    // 徐州/扬州边界
    [{x: 520, y: 280}, {x: 580, y: 280}],
    // 荆州/扬州边界
    [{x: 460, y: 360}, {x: 520, y: 360}],
    // 荆州/益州边界
    [{x: 350, y: 300}, {x: 350, y: 400}],
    // 益州/凉州边界
    [{x: 290, y: 240}, {x: 290, y: 350}],
    // 豫州/荆州边界
    [{x: 430, y: 290}, {x: 430, y: 380}],
    // 青州/兖州边界
    [{x: 560, y: 160}, {x: 560, y: 220}]
  ];

  // 主要关口/地标
  var LANDMARKS = [
    { name: '函谷关', x: 355, y: 230 },
    { name: '虎牢关', x: 430, y: 245 },
    { name: '剑阁', x: 295, y: 295 },
    { name: '襄阳城', x: 420, y: 340 },
    { name: '夏口', x: 445, y: 355 },
    { name: '赤壁', x: 440, y: 365 },
    { name: '建业', x: 550, y: 350 },
    { name: '许昌', x: 440, y: 270 },
    { name: '洛阳', x: 420, y: 220 },
    { name: '长安', x: 340, y: 220 },
    { name: '成都', x: 260, y: 350 },
    { name: '邺城', x: 440, y: 150 },
    { name: '北平', x: 500, y: 90 },
    { name: '西凉', x: 220, y: 170 },
    { name: '汉中', x: 300, y: 290 }
  ];

  // 渲染器
  var RealisticRenderer = {

    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    _scale: 1,
    _offsetX: 0,
    _offsetY: 0,
    _frame: 0,
    _bgCache: null,
    _bgDirty: true,
    selectedCity: null,
    _showLandmarks: true,
    _showRealistic: true,

    init: function(canvas) {
      if (!canvas) {
        canvas = document.getElementById('gameCanvas');
      }
      this.canvas = canvas;
      if (!this.canvas) {
        console.error('MapRealisticRenderer: canvas not found');
        return;
      }
      this.ctx = this.canvas.getContext('2d');
      this._resize();
      this._bgDirty = true;
    },

    _resize: function() {
      var rect = this.canvas.getBoundingClientRect();
      this.width = Math.floor(rect.width) || 800;
      this.height = Math.floor(rect.height) || 600;
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this._calcTransform();
      this._bgDirty = true;
    },

    _calcTransform: function() {
      var pad = 30;
      var mapMinX = 170, mapMaxX = 650;
      var mapMinY = 40, mapMaxY = 570;
      var mapW = mapMaxX - mapMinX;
      var mapH = mapMaxY - mapMinY;
      var availW = this.width - pad * 2;
      var availH = this.height - pad * 2;
      this._scale = Math.min(availW / mapW, availH / mapH);
      this._offsetX = pad + (availW - mapW * this._scale) / 2 - mapMinX * this._scale;
      this._offsetY = pad + (availH - mapH * this._scale) / 2 - mapMinY * this._scale;
    },

    mapToScreen: function(mx, my) {
      return {
        x: mx * this._scale + this._offsetX,
        y: my * this._scale + this._offsetY
      };
    },

    screenToMap: function(sx, sy) {
      return {
        x: (sx - this._offsetX) / this._scale,
        y: (sy - this._offsetY) / this._scale
      };
    },

    render: function() {
      if (!this.ctx) return;
      this._frame++;
      var ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      // 1. 海洋背景
      this._drawOcean(ctx);

      // 2. 陆地
      this._drawLand(ctx);

      // 3. 地形区域
      if (this._showRealistic) {
        this._drawRegions(ctx);
      }

      // 4. 山脉
      this._drawMountains(ctx);

      // 5. 河流湖泊
      this._drawRivers(ctx);

      // 6. 省份边界
      if (this._showRealistic) {
        this._drawProvinceBorders(ctx);
      }

      // 7. 长城
      if (this._showRealistic) {
        this._drawGreatWall(ctx);
      }

      // 8. 地标
      if (this._showLandmarks) {
        this._drawLandmarks(ctx);
      }

      // 9. 城市连线
      this._drawCityConnections(ctx);

      // 10. 行军军队
      this._drawArmies(ctx);

      // 11. 城市节点
      this._drawCities(ctx);

      // 12. 选中高亮
      this._drawSelectedHighlight(ctx);

      // 13. 悬停提示
      this._drawHoverTooltip(ctx);

      // 14. 图例
      if (this._showRealistic) {
        this._drawLegend(ctx);
      }
    },

    _drawOcean: function(ctx) {
      var grad = ctx.createLinearGradient(0, 0, 0, this.height);
      grad.addColorStop(0, '#1a2a4a');
      grad.addColorStop(0.3, '#2a3a5a');
      grad.addColorStop(0.7, '#1e3050');
      grad.addColorStop(1, '#0e1e3a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = '#5577aa';
      ctx.lineWidth = 1;
      for (var i = 0; i < 15; i++) {
        var y = (i * this.height / 15) + 5;
        ctx.beginPath();
        for (var x = 0; x < this.width; x += 20) {
          var dy = Math.sin((x + i * 30) * 0.02) * 3;
          if (x === 0) ctx.moveTo(x, y + dy);
          else ctx.lineTo(x, y + dy);
        }
        ctx.stroke();
      }
      ctx.restore();
    },

    _drawLand: function(ctx) {
      ctx.save();
      ctx.fillStyle = '#d4c8a8';
      ctx.beginPath();

      var first = this.mapToScreen(COASTLINE[0].x, COASTLINE[0].y);
      ctx.moveTo(first.x, first.y);

      for (var i = 1; i < COASTLINE.length; i++) {
        var p = this.mapToScreen(COASTLINE[i].x, COASTLINE[i].y);
        var prev = this.mapToScreen(COASTLINE[i - 1].x, COASTLINE[i - 1].y);
        var cpx = (prev.x + p.x) / 2;
        var cpy = (prev.y + p.y) / 2 + 8;
        ctx.quadraticCurveTo(cpx, cpy, p.x, p.y);
      }

      ctx.lineTo(this.width, this.height);
      ctx.lineTo(0, this.height);
      ctx.closePath();
      ctx.fill();

      // 陆地边缘阴影
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = '#5a4a3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      var s0 = this.mapToScreen(COASTLINE[0].x, COASTLINE[0].y);
      ctx.moveTo(s0.x, s0.y);
      for (var j = 1; j < COASTLINE.length; j++) {
        var sp = this.mapToScreen(COASTLINE[j].x, COASTLINE[j].y);
        ctx.lineTo(sp.x, sp.y);
      }
      ctx.stroke();
      ctx.restore();

      // 海南岛
      ctx.fillStyle = '#c8bc98';
      ctx.beginPath();
      var h0 = this.mapToScreen(HAINAN[0].x, HAINAN[0].y);
      ctx.moveTo(h0.x, h0.y);
      for (var h = 1; h < HAINAN.length; h++) {
        var hp = this.mapToScreen(HAINAN[h].x, HAINAN[h].y);
        ctx.lineTo(hp.x, hp.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#5a4a3a';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 台湾岛
      ctx.fillStyle = '#c8bc98';
      ctx.beginPath();
      var t0 = this.mapToScreen(TAIWAN[0].x, TAIWAN[0].y);
      ctx.moveTo(t0.x, t0.y);
      for (var t = 1; t < TAIWAN.length; t++) {
        var tp = this.mapToScreen(TAIWAN[t].x, TAIWAN[t].y);
        ctx.lineTo(tp.x, tp.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    },

    _drawRegions: function(ctx) {
      for (var r = 0; r < REGIONS.length; r++) {
        var region = REGIONS[r];
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = region.color;
        ctx.beginPath();
        var p0 = this.mapToScreen(region.points[0].x, region.points[0].y);
        ctx.moveTo(p0.x, p0.y);
        for (var p = 1; p < region.points.length; p++) {
          var pp = this.mapToScreen(region.points[p].x, region.points[p].y);
          ctx.lineTo(pp.x, pp.y);
        }
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#8a7a5a';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      }
    },

    _drawMountains: function(ctx) {
      this._drawMountainRange(ctx, TIANSHAN_MOUNTAINS, '#8a7a5a', 0.35);
      this._drawMountainRange(ctx, DAXINGANLING, '#7a6a4a', 0.30);
      this._drawMountainRange(ctx, YANSHAN_MOUNTAINS, '#8a7a5a', 0.30);
      this._drawMountainRange(ctx, TAIHANG_MOUNTAINS, '#6a5a3a', 0.40);
      this._drawMountainRange(ctx, QINLING_MOUNTAINS, '#7a6a3a', 0.45);
      this._drawMountainRange(ctx, NANLING_MOUNTAINS, '#6a5a3a', 0.30);
      this._drawMountainRange(ctx, HENGDUAN_MOUNTAINS, '#5a4a2a', 0.50);
    },

    _drawMountainRange: function(ctx, points, color, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 绘制山脊线
      ctx.beginPath();
      var p0 = this.mapToScreen(points[0].x, points[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (var i = 1; i < points.length; i++) {
        var prev = points[i - 1];
        var curr = points[i];
        var cpx = (prev.x + curr.x) / 2;
        var cpy = Math.min(prev.y, curr.y) - 20;
        var cp = this.mapToScreen(cpx, cpy);
        var ep = this.mapToScreen(curr.x, curr.y);
        ctx.quadraticCurveTo(cp.x, cp.y, ep.x, ep.y);
      }
      ctx.stroke();

      // 绘制山峰标记
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = color;
      for (var j = 0; j < points.length; j++) {
        var pt = this.mapToScreen(points[j].x, points[j].y);
        var peakH = 8 + Math.sin(j * 1.5) * 4;
        ctx.beginPath();
        ctx.moveTo(pt.x - 5, pt.y + 2);
        ctx.lineTo(pt.x, pt.y - peakH);
        ctx.lineTo(pt.x + 5, pt.y + 2);
        ctx.fill();
      }

      // 阴影
      ctx.globalAlpha = alpha * 0.25;
      ctx.fillStyle = color;
      for (var k = 0; k < points.length - 1; k++) {
        var p1 = this.mapToScreen(points[k].x, points[k].y);
        var p2 = this.mapToScreen(points[k + 1].x, points[k + 1].y);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p2.x, p2.y + 15);
        ctx.lineTo(p1.x, p1.y + 15);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },

    _drawRivers: function(ctx) {
      this._drawRiver(ctx, YELLOW_RIVER, '#b89050', 4, 0.5);
      this._drawRiver(ctx, YANGTZE_RIVER, '#507090', 5, 0.55);
      this._drawRiver(ctx, HUAI_RIVER, '#7090a0', 2.5, 0.35);
      this._drawRiver(ctx, HANJIANG_RIVER, '#608090', 2, 0.35);
      this._drawRiver(ctx, ZHUJIANG_RIVER, '#608090', 2, 0.35);

      // 湖泊
      this._drawLake(ctx, DONGTING_LAKE, '#4a6a8a');
      this._drawLake(ctx, POYANG_LAKE, '#4a6a8a');
      this._drawLake(ctx, CHAOHU_LAKE, '#5a7a9a');
    },

    _drawRiver: function(ctx, points, color, width, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha * 0.3;
      ctx.strokeStyle = color;
      ctx.lineWidth = width * this._scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      var p0 = this.mapToScreen(points[0].x, points[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (var i = 1; i < points.length; i++) {
        var prev = points[i - 1];
        var curr = points[i];
        var cpx = (prev.x + curr.x) / 2;
        var cpy = (prev.y + curr.y) / 2;
        var cp = this.mapToScreen(cpx, cpy);
        var ep = this.mapToScreen(curr.x, curr.y);
        ctx.quadraticCurveTo(cp.x, cp.y, ep.x, ep.y);
      }
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.lineWidth = width * this._scale * 0.5;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
    },

    _drawLake: function(ctx, points, color) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = color;
      ctx.beginPath();
      var p0 = this.mapToScreen(points[0].x, points[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (var i = 1; i < points.length; i++) {
        var pp = this.mapToScreen(points[i].x, points[i].y);
        ctx.lineTo(pp.x, pp.y);
      }
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    },

    _drawProvinceBorders: function(ctx) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#6a5a4a';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);

      for (var i = 0; i < PROVINCE_BORDERS.length; i++) {
        var border = PROVINCE_BORDERS[i];
        var p1 = this.mapToScreen(border[0].x, border[0].y);
        var p2 = this.mapToScreen(border[1].x, border[1].y);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.restore();
    },

    _drawGreatWall: function(ctx) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#3a2a1a';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';

      // 主干
      ctx.beginPath();
      var p0 = this.mapToScreen(GREAT_WALL[0].x, GREAT_WALL[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (var i = 1; i < GREAT_WALL.length; i++) {
        var prev = GREAT_WALL[i - 1];
        var curr = GREAT_WALL[i];
        var cpx = (prev.x + curr.x) / 2;
        var cpy = (prev.y + curr.y) / 2 - 5;
        var cp = this.mapToScreen(cpx, cpy);
        var ep = this.mapToScreen(curr.x, curr.y);
        ctx.quadraticCurveTo(cp.x, cp.y, ep.x, ep.y);
      }
      ctx.stroke();

      // 城垛标记
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#3a2a1a';
      for (var j = 0; j < GREAT_WALL.length; j += 2) {
        var pt = this.mapToScreen(GREAT_WALL[j].x, GREAT_WALL[j].y);
        ctx.fillRect(pt.x - 2, pt.y - 4, 4, 6);
      }
      ctx.restore();
    },

    _drawLandmarks: function(ctx) {
      ctx.save();
      ctx.font = '10px "KaiTi", "STKaiti", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      for (var i = 0; i < LANDMARKS.length; i++) {
        var lm = LANDMARKS[i];
        var pos = this.mapToScreen(lm.x, lm.y);

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#3a2a1a';
        ctx.fillText(lm.name, pos.x, pos.y - 8);

        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = '#5a4a3a';
        ctx.lineWidth = 0.5;
        ctx.strokeText(lm.name, pos.x, pos.y - 8);

        // 标记点
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#5a4a3a';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    _drawCityConnections: function(ctx) {
      var GS = window.SG.GameState;
      if (!GS || !GS.cities) return;

      ctx.save();
      ctx.strokeStyle = '#6a5a4a';
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      var drawn = {};
      for (var id in GS.cities) {
        if (!GS.cities.hasOwnProperty(id)) continue;
        var city = GS.cities[id];
        var adjacent = city.adjacent || [];
        for (var a = 0; a < adjacent.length; a++) {
          var otherId = adjacent[a];
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

    _drawArmies: function(ctx) {
      var GS = window.SG.GameState;
      if (!GS || !GS.armies) return;

      for (var i = 0; i < GS.armies.length; i++) {
        var army = GS.armies[i];
        var from = GS.cities[army.fromCity];
        var to = GS.cities[army.targetCity];
        if (!from || !to) continue;

        var totalTurns = army.totalTurns || (army.turnsLeft + 1);
        var progress = 1 - (army.turnsLeft / totalTurns);

        var p1 = this.mapToScreen(from.x, from.y);
        var p2 = this.mapToScreen(to.x, to.y);
        var ax = p1.x + (p2.x - p1.x) * progress;
        var ay = p1.y + (p2.y - p1.y) * progress;

        var color = '#cc8844';
        if (window.SG.FACTION_COLORS && window.SG.FACTION_COLORS[army.faction]) {
          color = window.SG.FACTION_COLORS[army.faction];
        }

        // 行军路径虚线（加粗醒目）
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // 统计兵力
        var totalTroops = 0;
        if (army.heroIds) {
          for (var h = 0; h < army.heroIds.length; h++) {
            var hero = GS.heroes[army.heroIds[h]];
            if (hero) totalTroops += hero.troops || 0;
          }
        }

        // 绘制军旗（旗杆 + 旗面 + 底座光晕），替换原来的小圆点
        var wave = Math.sin(this._frame * 0.08 + i * 1.3) * 2; // 旗面飘动幅度
        var poleH = 28, flagW = 20, flagH = 13;
        var poleTop = ay - poleH;
        var flagRight = ax + flagW + wave;

        // 旗杆
        ctx.strokeStyle = '#3a2a1a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax, poleTop);
        ctx.stroke();
        // 旗顶金尖
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(ax - 3, poleTop);
        ctx.lineTo(ax + 3, poleTop);
        ctx.lineTo(ax, poleTop - 5);
        ctx.closePath();
        ctx.fill();
        // 旗面（势力色，带飘动）
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.moveTo(ax, poleTop);
        ctx.lineTo(flagRight, poleTop + 1);
        ctx.lineTo(flagRight - 2, poleTop + flagH);
        ctx.lineTo(ax, poleTop + flagH);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // 旗面武将数
        if (army.heroIds && army.heroIds.length > 0) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(army.heroIds.length + '将', ax + flagW / 2 + wave / 2, poleTop + flagH / 2 + 1);
        }
        // 旗杆底座脉动光晕
        var pulse = 1 + 0.3 * Math.sin(this._frame * 0.1 + i);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(ax, ay, 10 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(ax, ay, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // 兵力标注（底座右侧）
        if (totalTroops > 0) {
          ctx.save();
          ctx.fillStyle = '#ffe6b0';
          ctx.font = '11px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          var troopText = totalTroops >= 1000 ? (totalTroops / 1000).toFixed(1) + 'k' : totalTroops;
          ctx.fillText('兵' + troopText, ax + 9, ay);
          ctx.restore();
        }
      }
    },

    _drawCities: function(ctx) {
      var GS = window.SG.GameState;
      if (!GS || !GS.cities) return;

      var playerFaction = GS.playerFaction;
      var radius = 10;

      for (var id in GS.cities) {
        if (!GS.cities.hasOwnProperty(id)) continue;
        var city = GS.cities[id];
        var pos = this.mapToScreen(city.x, city.y);

        var color = '#888888';
        if (window.SG.FACTION_COLORS && window.SG.FACTION_COLORS[city.faction]) {
          color = window.SG.FACTION_COLORS[city.faction];
        }

        // 玩家城市发光
        if (city.faction === playerFaction) {
          ctx.save();
          var glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius * 2.5);
          glow.addColorStop(0, color);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius * 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 城市底座（方形城郭）
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.rect(pos.x - radius, pos.y - radius, radius * 2, radius * 2);
        ctx.fill();

        ctx.strokeStyle = '#2a1a0a';
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 内部十字
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - radius + 2);
        ctx.lineTo(pos.x, pos.y + radius - 2);
        ctx.moveTo(pos.x - radius + 2, pos.y);
        ctx.lineTo(pos.x + radius - 2, pos.y);
        ctx.stroke();
        ctx.restore();

        // 城市名称
        ctx.save();
        ctx.fillStyle = '#1a0a0a';
        ctx.font = 'bold 12px "KaiTi", "STKaiti", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // 背景矩形让文字更清晰
        var nameWidth = ctx.measureText(city.name).width + 8;
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = 'rgba(245,240,225,0.88)';
        this._roundRect(ctx, pos.x - nameWidth / 2, pos.y - radius - 16, nameWidth, 14, 3);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.fillStyle = '#2a1a0a';
        ctx.fillText(city.name, pos.x, pos.y - radius - 4);
        ctx.restore();

        // 兵力
        var troops = this._getCityTroopCount(city);
        ctx.save();
        ctx.fillStyle = '#4a3a2a';
        ctx.font = '9px "KaiTi", "STKaiti", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(troops, pos.x, pos.y + radius + 3);
        ctx.restore();
      }
    },

    _getCityTroopCount: function(city) {
      var GS = window.SG.GameState;
      if (!GS) return city.troops || 0;
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

    _drawSelectedHighlight: function(ctx) {
      if (!this.selectedCity) return;
      var GS = window.SG.GameState;
      if (!GS || !GS.cities) return;
      var city = GS.cities[this.selectedCity];
      if (!city) return;

      var pos = this.mapToScreen(city.x, city.y);
      var color = '#888888';
      if (window.SG.FACTION_COLORS && window.SG.FACTION_COLORS[city.faction]) {
        color = window.SG.FACTION_COLORS[city.faction];
      }

      var pulse = 1 + 0.15 * Math.sin(this._frame * 0.06);
      var ringRadius = (14 + 6) * pulse;

      ctx.save();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ringRadius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },

    _drawHoverTooltip: function(ctx) {
      var ctrl = window.SG.MapController;
      if (!ctrl || !ctrl.hoveredCity) return;
      var GS = window.SG.GameState;
      if (!GS || !GS.cities) return;
      var city = GS.cities[ctrl.hoveredCity];
      if (!city) return;

      var pos = this.mapToScreen(city.x, city.y);
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

      var tipW = 170;
      var tipH = lines.length * 16 + 10;
      var tipX = pos.x + 18;
      var tipY = pos.y - tipH / 2;

      if (tipX + tipW > this.width - 10) tipX = pos.x - tipW - 18;
      if (tipY < 10) tipY = 10;
      if (tipY + tipH > this.height - 10) tipY = this.height - tipH - 10;

      ctx.save();
      ctx.fillStyle = 'rgba(245,240,225,0.94)';
      ctx.strokeStyle = '#8a7a5a';
      ctx.lineWidth = 1;
      this._roundRect(ctx, tipX, tipY, tipW, tipH, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2a1a0a';
      ctx.font = '11px "KaiTi", "STKaiti", serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (var l = 0; l < lines.length; l++) {
        ctx.fillText(lines[l], tipX + 8, tipY + 5 + l * 16);
      }
      ctx.restore();
    },

    _drawLegend: function(ctx) {
      ctx.save();
      var lx = 10;
      var ly = this.height - 90;
      ctx.fillStyle = 'rgba(245,240,225,0.85)';
      ctx.strokeStyle = '#8a7a5a';
      ctx.lineWidth = 1;
      this._roundRect(ctx, lx, ly, 110, 80, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#2a1a0a';
      ctx.font = '10px "KaiTi", "STKaiti", serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      ctx.fillText('图例', lx + 8, ly + 6);
      ctx.fillStyle = '#cc4444';
      ctx.fillRect(lx + 8, ly + 22, 8, 8);
      ctx.fillStyle = '#2a1a0a';
      ctx.fillText('蜀汉', lx + 22, ly + 22);
      ctx.fillStyle = '#4488cc';
      ctx.fillRect(lx + 58, ly + 22, 8, 8);
      ctx.fillStyle = '#2a1a0a';
      ctx.fillText('曹魏', lx + 72, ly + 22);

      ctx.fillStyle = '#44aa44';
      ctx.fillRect(lx + 8, ly + 40, 8, 8);
      ctx.fillStyle = '#2a1a0a';
      ctx.fillText('东吴', lx + 22, ly + 40);
      ctx.fillStyle = '#cc8844';
      ctx.fillRect(lx + 58, ly + 40, 8, 8);
      ctx.fillStyle = '#2a1a0a';
      ctx.fillText('群雄', lx + 72, ly + 40);

      ctx.fillStyle = '#507090';
      ctx.fillRect(lx + 8, ly + 58, 8, 8);
      ctx.fillStyle = '#2a1a0a';
      ctx.fillText('河流', lx + 22, ly + 58);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(lx + 58, ly + 58, 8, 8);
      ctx.fillStyle = '#2a1a0a';
      ctx.fillText('长城', lx + 72, ly + 58);

      ctx.fillStyle = '#6a5a3a';
      ctx.font = '8px "KaiTi", serif';
      ctx.fillText('● 山峰  □ 城池  --- 省界', lx + 8, ly + 74);

      ctx.restore();
    },

    _roundRect: function(ctx, x, y, w, h, r) {
      ctx.beginPath();
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
    },

    setMode: function(realistic) {
      this._showRealistic = realistic;
      this._bgDirty = true;
    },

    setShowLandmarks: function(show) {
      this._showLandmarks = show;
    }
  };

  window.SG.MapRealisticRenderer = RealisticRenderer;
  window.SG.MapRenderer = RealisticRenderer;

})();
