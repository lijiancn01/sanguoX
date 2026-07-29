// 三国群英传 - 地图交互控制器
window.SG = window.SG || {};

(function() {
  'use strict';

  // 城市点击判定半径（地图坐标系）
  var HIT_RADIUS = 22;

  var Controller = {

    canvas: null,

    // 当前选中城市ID
    selectedCity: null,

    // 当前悬停城市ID
    hoveredCity: null,

    // ===== 初始化 =====
    init: function(canvas) {
      if (!canvas) {
        canvas = document.getElementById('gameCanvas');
      }
      this.canvas = canvas;
      if (!this.canvas) {
        console.error('MapController: 未找到canvas元素');
        return;
      }

      var self = this;
      this.canvas.addEventListener('click', function(e) {
        self.handleClick(e);
      });
      this.canvas.addEventListener('mousemove', function(e) {
        self.handleMouseMove(e);
      });
      // 鼠标离开画布时清除悬停
      this.canvas.addEventListener('mouseleave', function() {
        self.hoveredCity = null;
        self.canvas.style.cursor = 'default';
      });
    },

    // ===== 点击处理 =====
    handleClick: function(e) {
      var coords = this.getMapCoords(e);
      if (!coords) return;

      var cityId = this.findCityAt(coords.x, coords.y);
      if (!cityId) {
        // 点击空白处取消选中
        this.selectedCity = null;
        if (window.SG.MapRenderer) {
          window.SG.MapRenderer.selectedCity = null;
        }
        return;
      }

      var GS = window.SG.GameState;
      if (!GS || !GS.cities) return;
      var city = GS.cities[cityId];
      if (!city) return;

      // 设置选中城市
      this.selectedCity = cityId;
      if (window.SG.MapRenderer) {
        window.SG.MapRenderer.selectedCity = cityId;
      }

      // 根据城市归属判断操作
      if (city.faction === GS.playerFaction) {
        // 玩家城市：打开城市面板
        if (window.SG.UIManager && window.SG.UIManager.showCityPanel) {
          window.SG.UIManager.showCityPanel(cityId);
        }
      } else {
        // 敌方/在野城市
        // 检查玩家是否有军队正在行军前往该城市
        var hasMarchingArmy = false;
        if (GS.armies) {
          for (var i = 0; i < GS.armies.length; i++) {
            if (GS.armies[i].targetCity === cityId && GS.armies[i].faction === GS.playerFaction) {
              hasMarchingArmy = true;
              break;
            }
          }
        }
        if (hasMarchingArmy) {
          // 有行军军队：显示攻击信息
          if (window.SG.UIManager && window.SG.UIManager.showAttackInfo) {
            window.SG.UIManager.showAttackInfo(cityId);
          }
        } else {
          // 仅显示城市信息
          if (window.SG.UIManager && window.SG.UIManager.showCityInfo) {
            window.SG.UIManager.showCityInfo(cityId);
          }
        }
      }
    },

    // ===== 鼠标移动处理 =====
    handleMouseMove: function(e) {
      var coords = this.getMapCoords(e);
      if (!coords) return;

      var cityId = this.findCityAt(coords.x, coords.y);
      this.hoveredCity = cityId;

      // 鼠标样式
      if (cityId) {
        this.canvas.style.cursor = 'pointer';
      } else {
        this.canvas.style.cursor = 'default';
      }
    },

    // ===== 查找点击位置的城市 =====
    findCityAt: function(x, y) {
      var GS = window.SG.GameState;
      if (!GS || !GS.cities) return null;

      var closest = null;
      var closestDist = HIT_RADIUS;

      for (var id in GS.cities) {
        if (!GS.cities.hasOwnProperty(id)) continue;
        var city = GS.cities[id];
        var dx = city.x - x;
        var dy = city.y - y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closest = id;
        }
      }

      return closest;
    },

    // ===== 鼠标事件坐标转地图坐标 =====
    getMapCoords: function(e) {
      var renderer = window.SG.MapRenderer;
      if (!renderer || !renderer.screenToMap) return null;

      var rect = this.canvas.getBoundingClientRect();
      // 考虑canvas的CSS缩放
      var scaleX = this.canvas.width / rect.width;
      var scaleY = this.canvas.height / rect.height;
      var screenX = (e.clientX - rect.left) * scaleX;
      var screenY = (e.clientY - rect.top) * scaleY;

      return renderer.screenToMap(screenX, screenY);
    }
  };

  window.SG.MapController = Controller;

})();
