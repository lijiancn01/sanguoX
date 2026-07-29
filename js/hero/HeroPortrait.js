// 三国群英传 - 水墨风武将头像生成器
window.SG = window.SG || {};

(function() {
  'use strict';

  // 缓存已生成的头像
  var _cache = {};

  // 势力主色
  var FACTION_COLORS = {
    wei:  { primary: '#4488cc', bg: '#1a2a3a', accent: '#6ab0ff' },
    shu:  { primary: '#cc4444', bg: '#3a1a1a', accent: '#ff6a6a' },
    wu:   { primary: '#44aa44', bg: '#1a3a1a', accent: '#6aff6a' },
    qun:  { primary: '#cc8844', bg: '#3a2a1a', accent: '#ffaa6a' },
    none: { primary: '#888888', bg: '#2a2a2a', accent: '#aaaaaa' }
  };

  // 武将类型判定（根据属性分布）
  function getHeroType(heroData) {
    var f = heroData.force || 50;
    var i = heroData.intellect || 50;
    if (f >= 85 && i < 60) return 'warrior';   // 猛将
    if (i >= 85 && f < 60) return 'strategist'; // 谋士
    if (f >= 75 && i >= 70) return 'general';   // 儒将
    if (f >= 80) return 'fighter';              // 勇将
    return 'advisor';                            // 文官
  }

  // 伪随机（基于种子）
  function seededRandom(seed) {
    var x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  }

  // 基于字符串生成种子
  function hashStr(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * 生成武将头像
   * @param {Object} heroData - 武将数据 { id, name, faction, force, intellect, ... }
   * @param {number} size - 头像尺寸（像素）
   * @returns {HTMLCanvasElement}
   */
  function generate(heroData, size) {
    size = size || 80;
    if (!heroData) return _generatePlaceholder(size);

    var cacheKey = heroData.id + '_' + size;
    if (_cache[cacheKey]) return _cache[cacheKey];

    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    var seed = hashStr(heroData.id || heroData.name || 'unknown');
    var rng = function(i) { return seededRandom(seed + i); };

    var faction = heroData.faction || 'none';
    var colors = FACTION_COLORS[faction] || FACTION_COLORS.none;
    var heroType = getHeroType(heroData);

    // 1. 背景
    _drawBackground(ctx, size, colors, rng);

    // 2. 墨晕效果
    _drawInkWash(ctx, size, rng);

    // 3. 武将剪影
    _drawSilhouette(ctx, size, heroType, colors, rng);

    // 4. 属性纹饰
    _drawAttributeMarks(ctx, size, heroData, heroType, rng);

    // 5. 边框
    _drawBorder(ctx, size, colors);

    _cache[cacheKey] = canvas;
    return canvas;
  }

  // 生成头像的dataURL
  function toDataURL(heroData, size) {
    var canvas = generate(heroData, size);
    return canvas.toDataURL('image/png');
  }

  // 占位头像
  function _generatePlaceholder(size) {
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#666';
    ctx.font = (size * 0.4) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', size / 2, size / 2);
    return canvas;
  }

  // 背景
  function _drawBackground(ctx, size, colors, rng) {
    // 宣纸底色渐变
    var grad = ctx.createRadialGradient(size * 0.5, size * 0.4, 0, size * 0.5, size * 0.5, size * 0.7);
    grad.addColorStop(0, '#3a2a1a');
    grad.addColorStop(0.6, colors.bg);
    grad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // 纹理颗粒
    ctx.save();
    ctx.globalAlpha = 0.04;
    for (var i = 0; i < 40; i++) {
      var x = rng(i * 3) * size;
      var y = rng(i * 3 + 1) * size;
      var r = rng(i * 3 + 2) * size * 0.05 + 1;
      ctx.fillStyle = rng(i) > 0.5 ? '#fff' : '#000';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 墨晕效果
  function _drawInkWash(ctx, size, rng) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (var i = 0; i < 5; i++) {
      var x = size * (0.3 + rng(i * 7) * 0.4);
      var y = size * (0.2 + rng(i * 7 + 1) * 0.5);
      var r = size * (0.1 + rng(i * 7 + 2) * 0.2);
      var grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.3)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 武将剪影
  function _drawSilhouette(ctx, size, heroType, colors, rng) {
    ctx.save();
    var cx = size * 0.5;
    var cy = size * 0.48;

    if (heroType === 'warrior' || heroType === 'fighter') {
      // 猛将/勇将：宽肩壮硕，戴盔
      _drawWarriorBody(ctx, cx, cy, size, colors, rng);
    } else if (heroType === 'strategist') {
      // 谋士：瘦削，持扇/书
      _drawStrategistBody(ctx, cx, cy, size, colors, rng);
    } else if (heroType === 'general') {
      // 儒将：英挺，佩剑
      _drawGeneralBody(ctx, cx, cy, size, colors, rng);
    } else {
      // 文官：端庄
      _drawAdvisorBody(ctx, cx, cy, size, colors, rng);
    }

    ctx.restore();
  }

  // 猛将剪影
  function _drawWarriorBody(ctx, cx, cy, size, colors, rng) {
    var s = size * 0.01;

    // 头盔
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - 10 * s, cy - 14 * s);
    ctx.quadraticCurveTo(cx, cy - 28 * s, cx + 10 * s, cy - 14 * s);
    ctx.closePath();
    ctx.fill();

    // 盔顶缨
    ctx.fillStyle = colors.accent;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy - 25 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();

    // 脸
    ctx.fillStyle = '#d4a878';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8 * s, 8 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#222';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(cx - 3 * s, cy - 9 * s, 1.5 * s, 1 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 3 * s, cy - 9 * s, 1.5 * s, 1 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 肩甲
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(cx - 12 * s, cy + 4 * s, 7 * s, 5 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 12 * s, cy + 4 * s, 7 * s, 5 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 身体铠甲
    ctx.fillStyle = colors.bg;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - 10 * s, cy + 2 * s);
    ctx.lineTo(cx - 14 * s, cy + 25 * s);
    ctx.lineTo(cx + 14 * s, cy + 25 * s);
    ctx.lineTo(cx + 10 * s, cy + 2 * s);
    ctx.closePath();
    ctx.fill();

    // 铠甲纹路
    ctx.strokeStyle = colors.primary;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = s;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 2 * s);
    ctx.lineTo(cx, cy + 22 * s);
    ctx.stroke();
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 10 * s, cy + (8 + i * 5) * s);
      ctx.lineTo(cx + 10 * s, cy + (8 + i * 5) * s);
      ctx.stroke();
    }
  }

  // 谋士剪影
  function _drawStrategistBody(ctx, cx, cy, size, colors, rng) {
    var s = size * 0.01;

    // 纶巾
    ctx.fillStyle = '#e8d8c0';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - 9 * s, cy - 13 * s);
    ctx.lineTo(cx + 9 * s, cy - 13 * s);
    ctx.lineTo(cx + 7 * s, cy - 18 * s);
    ctx.lineTo(cx - 7 * s, cy - 18 * s);
    ctx.closePath();
    ctx.fill();

    // 脸
    ctx.fillStyle = '#d4a878';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 6 * s, 7 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#222';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(cx - 3 * s, cy - 7 * s, 1.2 * s, 0.8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 3 * s, cy - 7 * s, 1.2 * s, 0.8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 胡须
    ctx.strokeStyle = '#555';
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 0.8 * s;
    for (var b = -1; b <= 1; b++) {
      ctx.beginPath();
      ctx.moveTo(cx + b * 3 * s, cy - 1 * s);
      ctx.quadraticCurveTo(cx + b * 5 * s, cy + 6 * s, cx + b * 4 * s, cy + 12 * s);
      ctx.stroke();
    }

    // 长袍
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - 8 * s, cy + 2 * s);
    ctx.lineTo(cx - 12 * s, cy + 25 * s);
    ctx.lineTo(cx + 12 * s, cy + 25 * s);
    ctx.lineTo(cx + 8 * s, cy + 2 * s);
    ctx.closePath();
    ctx.fill();

    // 羽扇
    ctx.fillStyle = '#ddd';
    ctx.globalAlpha = 0.6;
    ctx.save();
    ctx.translate(cx + 14 * s, cy + 5 * s);
    ctx.rotate(0.3);
    ctx.beginPath();
    ctx.ellipse(0, -4 * s, 4 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 儒将剪影
  function _drawGeneralBody(ctx, cx, cy, size, colors, rng) {
    var s = size * 0.01;

    // 头冠
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - 8 * s, cy - 13 * s);
    ctx.lineTo(cx, cy - 20 * s);
    ctx.lineTo(cx + 8 * s, cy - 13 * s);
    ctx.closePath();
    ctx.fill();

    // 脸
    ctx.fillStyle = '#d4a878';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 6 * s, 7.5 * s, 8.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#222';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(cx - 3 * s, cy - 7 * s, 1.3 * s, 1 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 3 * s, cy - 7 * s, 1.3 * s, 1 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 短须
    ctx.strokeStyle = '#444';
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = s;
    for (var b = -1; b <= 1; b++) {
      ctx.beginPath();
      ctx.moveTo(cx + b * 2 * s, cy - 1 * s);
      ctx.quadraticCurveTo(cx + b * 4 * s, cy + 4 * s, cx + b * 3 * s, cy + 7 * s);
      ctx.stroke();
    }

    // 战袍
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(cx - 9 * s, cy + 2 * s);
    ctx.lineTo(cx - 13 * s, cy + 25 * s);
    ctx.lineTo(cx + 13 * s, cy + 25 * s);
    ctx.lineTo(cx + 9 * s, cy + 2 * s);
    ctx.closePath();
    ctx.fill();

    // 佩剑
    ctx.strokeStyle = '#ccc';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 10 * s, cy + 8 * s);
    ctx.lineTo(cx - 15 * s, cy + 24 * s);
    ctx.stroke();

    // 剑柄
    ctx.strokeStyle = colors.accent;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 8 * s, cy + 6 * s);
    ctx.lineTo(cx - 11 * s, cy + 10 * s);
    ctx.stroke();
  }

  // 文官剪影
  function _drawAdvisorBody(ctx, cx, cy, size, colors, rng) {
    var s = size * 0.01;

    // 官帽
    ctx.fillStyle = '#1a1a1a';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(cx - 9 * s, cy - 17 * s, 18 * s, 4 * s);
    ctx.fillRect(cx - 6 * s, cy - 20 * s, 12 * s, 4 * s);

    // 脸
    ctx.fillStyle = '#d4a878';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 6 * s, 7 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#222';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(cx - 2.5 * s, cy - 7 * s, 1 * s, 0.7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 2.5 * s, cy - 7 * s, 1 * s, 0.7 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 长袍
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(cx - 7 * s, cy + 2 * s);
    ctx.lineTo(cx - 11 * s, cy + 25 * s);
    ctx.lineTo(cx + 11 * s, cy + 25 * s);
    ctx.lineTo(cx + 7 * s, cy + 2 * s);
    ctx.closePath();
    ctx.fill();

    // 书卷
    ctx.fillStyle = '#ddd';
    ctx.globalAlpha = 0.5;
    ctx.save();
    ctx.translate(cx - 12 * s, cy + 10 * s);
    ctx.rotate(-0.15);
    ctx.fillRect(0, 0, 6 * s, 8 * s);
    ctx.restore();
  }

  // 属性纹饰（四角小标记）
  function _drawAttributeMarks(ctx, size, heroData, heroType, rng) {
    ctx.save();
    var s = size * 0.01;
    var f = heroData.force || 50;
    var i = heroData.intellect || 50;

    // 武力标记（左下角）
    if (f >= 90) {
      ctx.fillStyle = '#ff4444';
      ctx.globalAlpha = 0.7;
      ctx.font = 'bold ' + (8 * s) + 'px serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('武', 3 * s, size - 2 * s);
    }

    // 智力标记（右下角）
    if (i >= 90) {
      ctx.fillStyle = '#4488ff';
      ctx.globalAlpha = 0.7;
      ctx.font = 'bold ' + (8 * s) + 'px serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('智', size - 3 * s, size - 2 * s);
    }

    // 类型标识（左上角）
    ctx.fillStyle = '#ffd700';
    ctx.globalAlpha = 0.5;
    ctx.font = (6 * s) + 'px serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    var typeLabels = { warrior: '猛', fighter: '勇', general: '儒', strategist: '谋', advisor: '文' };
    ctx.fillText(typeLabels[heroType] || '', 3 * s, 3 * s);

    ctx.restore();
  }

  // 边框
  function _drawBorder(ctx, size, colors) {
    ctx.save();

    // 外圈
    ctx.strokeStyle = colors.primary;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();

    // 内圈淡金
    ctx.strokeStyle = '#ffd700';
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // 清除缓存
  function clearCache() {
    _cache = {};
  }

  window.SG.HeroPortrait = {
    generate: generate,
    toDataURL: toDataURL,
    clearCache: clearCache
  };

})();
