// 三国群英传 - 游戏入口和主循环
window.SG = window.SG || {};

(function() {
  'use strict';

  var Main = {

    // 游戏循环定时器
    _loopTimer: null,

    // 是否正在运行
    _running: false,

    // ===== 初始化 =====
    init: function() {
      // 1. 初始化游戏状态
      window.SG.GameState.init();

      // 2. 创建地图渲染器和控制器
      if (window.SG.MapRenderer) {
        window.SG.MapRenderer.init();
      }
      var canvas = document.getElementById('gameCanvas');
      if (canvas && window.SG.MapController) {
        window.SG.MapController.init(canvas);
      }

      // 3. 创建UI管理器
      if (window.SG.UIManager) {
        window.SG.UIManager.init();
      }

      // 4. 显示开始画面
      this._showStartScreen();
    },

    // ===== 开始画面 =====
    _showStartScreen: function() {
      var container = document.getElementById('gameContainer') || document.body;

      var overlay = document.createElement('div');
      overlay.id = 'startScreen';
      overlay.style.cssText = [
        'position: fixed',
        'top: 0; left: 0',
        'width: 100%; height: 100%',
        'background: linear-gradient(135deg, #1a0a00 0%, #3d1a00 50%, #1a0a00 100%)',
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'justify-content: center',
        'z-index: 9999',
        'font-family: "Microsoft YaHei", "SimHei", sans-serif',
        'color: #e8d4b0'
      ].join(';');

      // 标题
      var title = document.createElement('h1');
      title.textContent = '三国群英传';
      title.style.cssText = [
        'font-size: 56px',
        'margin: 0 0 10px 0',
        'text-shadow: 0 0 20px #ff6600, 0 0 40px #cc3300',
        'letter-spacing: 12px',
        'color: #ffd700'
      ].join(';');
      overlay.appendChild(title);

      // 副标题
      var subtitle = document.createElement('p');
      subtitle.textContent = '选择你的势力，逐鹿天下';
      subtitle.style.cssText = [
        'font-size: 18px',
        'margin: 0 0 40px 0',
        'color: #c4a882'
      ].join(';');
      overlay.appendChild(subtitle);

      // 势力选择
      var factions = [
        { id: 'wei', name: '曹魏', color: '#4488cc', desc: '挟天子以令诸侯，雄踞中原' },
        { id: 'shu', name: '蜀汉', color: '#cc4444', desc: '兴复汉室，还于旧都' },
        { id: 'wu',  name: '东吴', color: '#44aa44', desc: '据江东之固，虎视天下' }
      ];

      var factionArea = document.createElement('div');
      factionArea.style.cssText = 'display: flex; gap: 30px; margin-bottom: 30px; flex-wrap: wrap; justify-content: center;';

      for (var i = 0; i < factions.length; i++) {
        (function(f) {
          var btn = document.createElement('div');
          btn.style.cssText = [
            'width: 180px',
            'padding: 20px',
            'border: 2px solid ' + f.color,
            'border-radius: 8px',
            'text-align: center',
            'cursor: pointer',
            'background: rgba(0,0,0,0.5)',
            'transition: all 0.3s'
          ].join(';');

          var nameEl = document.createElement('div');
          nameEl.textContent = f.name;
          nameEl.style.cssText = 'font-size: 28px; color: ' + f.color + '; margin-bottom: 8px; font-weight: bold;';
          btn.appendChild(nameEl);

          var descEl = document.createElement('div');
          descEl.textContent = f.desc;
          descEl.style.cssText = 'font-size: 13px; color: #b0a080; line-height: 1.5;';
          btn.appendChild(descEl);

          btn.onmouseover = function() {
            btn.style.background = f.color + '33';
            btn.style.transform = 'scale(1.05)';
          };
          btn.onmouseout = function() {
            btn.style.background = 'rgba(0,0,0,0.5)';
            btn.style.transform = 'scale(1)';
          };
          btn.onclick = function() {
            Main._selectFaction(f.id);
          };

          factionArea.appendChild(btn);
        })(factions[i]);
      }
      overlay.appendChild(factionArea);

      // 自定义君主按钮
      var customBtn = document.createElement('div');
      customBtn.textContent = '自定义君主';
      customBtn.style.cssText = [
        'padding: 12px 40px',
        'border: 1px solid #ffd700',
        'border-radius: 6px',
        'cursor: pointer',
        'font-size: 18px',
        'color: #ffd700',
        'background: rgba(0,0,0,0.4)',
        'transition: all 0.3s',
        'margin-bottom: 20px'
      ].join(';');
      customBtn.onmouseover = function() {
        customBtn.style.background = 'rgba(255,215,0,0.2)';
      };
      customBtn.onmouseout = function() {
        customBtn.style.background = 'rgba(0,0,0,0.4)';
      };
      customBtn.onclick = function() {
        Main._showCustomMonarchScreen(overlay);
      };
      overlay.appendChild(customBtn);

      // 继续游戏按钮
      var hasSave = false;
      try {
        hasSave = !!localStorage.getItem('sg_save_0');
      } catch(e) {}

      if (hasSave) {
        var loadBtn = document.createElement('div');
        loadBtn.textContent = '继续游戏';
        loadBtn.style.cssText = [
          'padding: 12px 40px',
          'border: 1px solid #8a7a5a',
          'border-radius: 6px',
          'cursor: pointer',
          'font-size: 18px',
          'color: #c4a882',
          'background: rgba(0,0,0,0.4)',
          'transition: all 0.3s'
        ].join(';');
        loadBtn.onmouseover = function() {
          loadBtn.style.background = 'rgba(100,80,50,0.4)';
        };
        loadBtn.onmouseout = function() {
          loadBtn.style.background = 'rgba(0,0,0,0.4)';
        };
        loadBtn.onclick = function() {
          if (window.SG.GameState.load(0)) {
            Main._closeStartScreen(overlay);
            Main._startGame();
          }
        };
        overlay.appendChild(loadBtn);
      }

      container.appendChild(overlay);
    },

    // 自定义君主表单
    _showCustomMonarchScreen: function(startOverlay) {
      var overlay = document.createElement('div');
      overlay.style.cssText = [
        'position: fixed',
        'top: 0; left: 0',
        'width: 100%; height: 100%',
        'background: rgba(0,0,0,0.95)',
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'justify-content: center',
        'z-index: 10000',
        'font-family: "Microsoft YaHei", "SimHei", sans-serif',
        'color: #e8d4b0',
        'overflow-y: auto',
        'padding: 20px 0'
      ].join(';');

      // 标题
      var title = document.createElement('h2');
      title.textContent = '自定义君主';
      title.style.cssText = 'font-size: 32px; color: #ffd700; margin: 0 0 20px 0; text-shadow: 0 0 10px #ff6600;';
      overlay.appendChild(title);

      // 表单容器
      var form = document.createElement('div');
      form.style.cssText = [
        'width: 520px',
        'background: rgba(20,10,0,0.8)',
        'border: 2px solid #8a7a5a',
        'border-radius: 10px',
        'padding: 20px 30px',
        'max-height: 80vh',
        'overflow-y: auto'
      ].join(';');

      // 君主姓名
      form.appendChild(this._createFormRow('君主姓名', this._createInput('cm_name', '请输入姓名', '')));
      // 势力名称
      form.appendChild(this._createFormRow('势力名称', this._createInput('cm_faction', '请输入势力名', '')));

      // 势力颜色
      var colorOptions = [
        { val: '#cc4444', label: '赤红' },
        { val: '#4488cc', label: '深蓝' },
        { val: '#44aa44', label: '翠绿' },
        { val: '#cc8844', label: '橙黄' },
        { val: '#9944cc', label: '紫罗' },
        { val: '#44cccc', label: '青碧' }
      ];
      var colorRow = document.createElement('div');
      colorRow.style.cssText = 'display: flex; align-items: center; margin-bottom: 12px;';
      var colorLabel = document.createElement('span');
      colorLabel.textContent = '势力颜色：';
      colorLabel.style.cssText = 'width: 90px; color: #c4a882; font-size: 14px;';
      colorRow.appendChild(colorLabel);
      var colorBtns = document.createElement('div');
      colorBtns.style.cssText = 'display: flex; gap: 8px;';
      var selectedColor = '#cc4444';
      for (var ci = 0; ci < colorOptions.length; ci++) {
        (function(cOpt) {
          var cb = document.createElement('div');
          cb.style.cssText = 'width:28px;height:28px;border-radius:50%;background:' + cOpt.val + ';cursor:pointer;border:2px solid transparent;transition:all 0.2s;';
          if (cOpt.val === selectedColor) cb.style.borderColor = '#ffd700';
          cb.onclick = function() {
            selectedColor = cOpt.val;
            var all = colorBtns.querySelectorAll('div');
            for (var j = 0; j < all.length; j++) all[j].style.borderColor = 'transparent';
            cb.style.borderColor = '#ffd700';
          };
          colorBtns.appendChild(cb);
        })(colorOptions[ci]);
      }
      colorRow.appendChild(colorBtns);
      form.appendChild(colorRow);

      // 起始城市（仅可选在野空城，不可夺取已占领城）
      var citySelect = this._createSelect('cm_city', []);
      var cityOptions = [];
      var citiesData = window.SG.CITIES_DATA;
      for (var ci2 = 0; ci2 < citiesData.length; ci2++) {
        if (citiesData[ci2].faction === 'none') {
          cityOptions.push({ val: citiesData[ci2].id, label: citiesData[ci2].name });
        }
      }
      citySelect.innerHTML = '';
      if (cityOptions.length === 0) {
        // 没有在野空城时给出提示，避免下拉框为空
        var emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '（暂无在野空城）';
        emptyOpt.disabled = true;
        citySelect.appendChild(emptyOpt);
      } else {
        for (var k = 0; k < cityOptions.length; k++) {
          var opt = document.createElement('option');
          opt.value = cityOptions[k].val;
          opt.textContent = cityOptions[k].label;
          citySelect.appendChild(opt);
        }
      }
      form.appendChild(this._createFormRow('起始城市', citySelect));

      // 兵种选择
      var troopSelect = this._createSelect('cm_troop', [
        { val: 'infantry', label: '步兵' },
        { val: 'cavalry', label: '骑兵' },
        { val: 'archer', label: '弓兵' }
      ]);
      form.appendChild(this._createFormRow('君主兵种', troopSelect));

      // 属性分配
      var attrPoints = 350;
      var attrs = { force: 70, intellect: 70, politics: 70, command: 70, charisma: 70 };
      var attrNames = [
        { key: 'force', label: '武力' },
        { key: 'intellect', label: '智力' },
        { key: 'politics', label: '政治' },
        { key: 'command', label: '统率' },
        { key: 'charisma', label: '魅力' }
      ];

      var attrTitle = document.createElement('div');
      attrTitle.textContent = '属性分配（剩余点数：' + attrPoints + '）';
      attrTitle.style.cssText = 'color: #ffd700; font-size: 16px; margin: 15px 0 10px 0;';
      form.appendChild(attrTitle);

      var attrContainer = document.createElement('div');
      attrContainer.style.cssText = 'margin-bottom: 15px;';

      function updateAttrPoints() {
        var used = 0;
        for (var ak in attrs) used += attrs[ak];
        var remain = 350 - used;
        attrTitle.textContent = '属性分配（剩余点数：' + remain + '）';
      }

      for (var ai = 0; ai < attrNames.length; ai++) {
        (function(attrInfo) {
          var row = document.createElement('div');
          row.style.cssText = 'display: flex; align-items: center; margin-bottom: 10px; gap: 4px;';

          var label = document.createElement('span');
          label.textContent = attrInfo.label;
          label.style.cssText = 'width: 36px; color: #c4a882; font-size: 13px; flex-shrink: 0;';
          row.appendChild(label);

          // -10 按钮
          var minus10Btn = document.createElement('button');
          minus10Btn.textContent = '-10';
          minus10Btn.style.cssText = 'width:36px;height:26px;cursor:pointer;background:#3a1a1a;color:#ff9090;border:1px solid #664040;border-radius:4px;font-size:11px;padding:0;';
          minus10Btn.onclick = function() {
            adjustAttr(attrInfo.key, -10);
          };
          row.appendChild(minus10Btn);

          // -1 按钮
          var minusBtn = document.createElement('button');
          minusBtn.textContent = '-';
          minusBtn.style.cssText = 'width:24px;height:26px;cursor:pointer;background:#333;color:#e8d4b0;border:1px solid #666;border-radius:4px;padding:0;';
          minusBtn.onclick = function() {
            adjustAttr(attrInfo.key, -1);
          };
          row.appendChild(minusBtn);

          // 数值显示
          var valEl = document.createElement('span');
          valEl.textContent = attrs[attrInfo.key];
          valEl.style.cssText = 'width: 34px; text-align: center; color: #ffd700; font-weight: bold; flex-shrink: 0;';
          row.appendChild(valEl);

          // 滑块（拖动调整）
          var slider = document.createElement('input');
          slider.type = 'range';
          slider.min = '20';
          slider.max = '100';
          slider.step = '1';
          slider.value = attrs[attrInfo.key];
          slider.style.cssText = 'flex: 1; min-width: 80px; cursor: pointer; accent-color: #ffd700;';
          slider.oninput = function() {
            var newVal = parseInt(slider.value, 10);
            var oldVal = attrs[attrInfo.key];
            var delta = newVal - oldVal;
            if (delta === 0) return;
            // 检查总点数约束（增加时受 350 上限限制，减少时只受 20 下限限制）
            if (delta > 0) {
              var used = 0;
              for (var ak in attrs) used += attrs[ak];
              var remain = 350 - used;
              if (remain <= 0) {
                // 无剩余点数，回滚滑块
                slider.value = oldVal;
                return;
              }
              // 限制增量不超过剩余点数
              if (delta > remain) {
                delta = remain;
                newVal = oldVal + delta;
                slider.value = newVal;
              }
            }
            attrs[attrInfo.key] = newVal;
            valEl.textContent = newVal;
            updateAttrPoints();
          };
          row.appendChild(slider);

          // +1 按钮
          var plusBtn = document.createElement('button');
          plusBtn.textContent = '+';
          plusBtn.style.cssText = 'width:24px;height:26px;cursor:pointer;background:#333;color:#e8d4b0;border:1px solid #666;border-radius:4px;padding:0;';
          plusBtn.onclick = function() {
            adjustAttr(attrInfo.key, 1);
          };
          row.appendChild(plusBtn);

          // +10 按钮
          var plus10Btn = document.createElement('button');
          plus10Btn.textContent = '+10';
          plus10Btn.style.cssText = 'width:36px;height:26px;cursor:pointer;background:#1a3a1a;color:#90ff90;border:1px solid #406640;border-radius:4px;font-size:11px;padding:0;';
          plus10Btn.onclick = function() {
            adjustAttr(attrInfo.key, 10);
          };
          row.appendChild(plus10Btn);

          // 统一调整函数：处理边界与剩余点数，同步滑块和数值
          function adjustAttr(key, delta) {
            var oldVal = attrs[key];
            var newVal = oldVal + delta;
            // 下限 20
            if (newVal < 20) newVal = 20;
            // 上限 100
            if (newVal > 100) newVal = 100;
            var realDelta = newVal - oldVal;
            if (realDelta === 0) return;
            // 增加时受 350 总点数上限约束
            if (realDelta > 0) {
              var used = 0;
              for (var ak in attrs) used += attrs[ak];
              var remain = 350 - used;
              if (remain <= 0) return;
              if (realDelta > remain) {
                newVal = oldVal + remain;
                realDelta = remain;
              }
            }
            attrs[key] = newVal;
            valEl.textContent = newVal;
            slider.value = newVal;
            updateAttrPoints();
          }

          attrContainer.appendChild(row);
        })(attrNames[ai]);
      }
      form.appendChild(attrContainer);

      // 专属武将技
      var skillTitle = document.createElement('div');
      skillTitle.textContent = '专属武将技设计';
      skillTitle.style.cssText = 'color: #ffd700; font-size: 16px; margin: 15px 0 10px 0;';
      form.appendChild(skillTitle);

      form.appendChild(this._createFormRow('技能名称', this._createInput('cm_skill_name', '请输入技能名', '')));

      // 技能效果类型
      var effectOptions = [
        { val: 'damage', label: '伤害' },
        { val: 'heal_troops', label: '恢复兵力' },
        { val: 'heal_hp', label: '恢复HP' },
        { val: 'restore_sp', label: '恢复技力' },
        { val: 'buff_attack', label: '攻击增益' },
        { val: 'buff_defense', label: '防御增益' },
        { val: 'debuff_attack', label: '攻击减益' },
        { val: 'debuff_defense', label: '防御减益' },
        { val: 'morale_up', label: '士气提升' },
        { val: 'morale_down', label: '士气降低' },
        { val: 'burn', label: '灼烧' },
        { val: 'stun', label: '眩晕' }
      ];
      var effectSelect = this._createSelect('cm_effect', effectOptions);
      form.appendChild(this._createFormRow('效果类型', effectSelect));

      // 技能范围
      var rangeOptions = [
        { val: 'single', label: '单体' },
        { val: 'area', label: '群体' },
        { val: 'self', label: '自身' },
        { val: 'ally', label: '我方全体' }
      ];
      var rangeSelect = this._createSelect('cm_range', rangeOptions);
      form.appendChild(this._createFormRow('技能范围', rangeSelect));

      // 技能威力
      var powerRow = document.createElement('div');
      powerRow.style.cssText = 'display: flex; align-items: center; margin-bottom: 12px;';
      var powerLabel = document.createElement('span');
      powerLabel.textContent = '技能威力：';
      powerLabel.style.cssText = 'width: 90px; color: #c4a882; font-size: 14px;';
      powerRow.appendChild(powerLabel);
      var powerSlider = document.createElement('input');
      powerSlider.type = 'range';
      powerSlider.min = '30';
      powerSlider.max = '150';
      powerSlider.value = '80';
      powerSlider.style.cssText = 'flex: 1;';
      var powerVal = document.createElement('span');
      powerVal.textContent = '80';
      powerVal.style.cssText = 'width: 40px; text-align: right; color: #ffd700;';
      powerSlider.oninput = function() { powerVal.textContent = powerSlider.value; };
      powerRow.appendChild(powerSlider);
      powerRow.appendChild(powerVal);
      form.appendChild(powerRow);

      // 技力消耗
      var costRow = document.createElement('div');
      costRow.style.cssText = 'display: flex; align-items: center; margin-bottom: 12px;';
      var costLabel = document.createElement('span');
      costLabel.textContent = '技力消耗：';
      costLabel.style.cssText = 'width: 90px; color: #c4a882; font-size: 14px;';
      costRow.appendChild(costLabel);
      var costSlider = document.createElement('input');
      costSlider.type = 'range';
      costSlider.min = '10';
      costSlider.max = '60';
      costSlider.value = '35';
      costSlider.style.cssText = 'flex: 1;';
      var costVal = document.createElement('span');
      costVal.textContent = '35';
      costVal.style.cssText = 'width: 40px; text-align: right; color: #ffd700;';
      costSlider.oninput = function() { costVal.textContent = costSlider.value; };
      costRow.appendChild(costSlider);
      costRow.appendChild(costVal);
      form.appendChild(costRow);

      // 技能元素
      var elementOptions = [
        { val: 'ink', label: '墨系' },
        { val: 'fire', label: '火系' },
        { val: 'lightning', label: '雷系' }
      ];
      var elementSelect = this._createSelect('cm_element', elementOptions);
      form.appendChild(this._createFormRow('技能元素', elementSelect));

      // 技能描述
      var descInput = this._createInput('cm_desc', '描述你的专属技能', '');
      form.appendChild(this._createFormRow('技能描述', descInput));

      // 按钮区域
      var btnArea = document.createElement('div');
      btnArea.style.cssText = 'display: flex; gap: 20px; justify-content: center; margin-top: 20px;';

      var backBtn = document.createElement('button');
      backBtn.textContent = '返回';
      backBtn.style.cssText = 'padding: 10px 30px; cursor: pointer; background: #333; color: #c4a882; border: 1px solid #666; border-radius: 6px; font-size: 16px;';
      backBtn.onclick = function() {
        overlay.parentNode.removeChild(overlay);
      };
      btnArea.appendChild(backBtn);

      var startBtn = document.createElement('button');
      startBtn.textContent = '开始游戏';
      startBtn.style.cssText = 'padding: 10px 30px; cursor: pointer; background: #8b4513; color: #ffd700; border: 1px solid #ffd700; border-radius: 6px; font-size: 16px; font-weight: bold;';
      startBtn.onclick = function() {
        var name = document.getElementById('cm_name').value.trim();
        var factionName = document.getElementById('cm_faction').value.trim();
        var cityId = citySelect.value;
        var troopType = troopSelect.value;
        var skillName = document.getElementById('cm_skill_name').value.trim() || '专属技';
        var effectType = effectSelect.value;
        var range = rangeSelect.value;
        var power = parseInt(powerSlider.value, 10);
        var spCost = parseInt(costSlider.value, 10);
        var element = elementSelect.value;
        var desc = document.getElementById('cm_desc').value.trim() || '专属武将技';

        if (!name) { alert('请输入君主姓名'); return; }
        if (!factionName) { alert('请输入势力名称'); return; }
        if (!cityId) { alert('请选择起始城市（当前无在野空城可用）'); return; }

        var customSkillData = {
          name: skillName,
          effectType: effectType,
          spCost: spCost,
          power: power,
          range: range,
          element: element,
          desc: desc,
          heroId: null
        };

        var result = window.SG.GameState.initCustomFaction(
          name, factionName, selectedColor,
          { force: attrs.force, intellect: attrs.intellect, politics: attrs.politics, command: attrs.command, charisma: attrs.charisma, troopType: troopType },
          cityId,
          customSkillData
        );

        // 设置专属技能的归属
        if (window.SG.CUSTOM_SKILLS) {
          for (var sk in window.SG.CUSTOM_SKILLS) {
            if (window.SG.CUSTOM_SKILLS.hasOwnProperty(sk) && !window.SG.CUSTOM_SKILLS[sk].exclusiveHero) {
              window.SG.CUSTOM_SKILLS[sk].exclusiveHero = result.monarchId;
              if (window.SG.SKILLS_DATA[sk]) {
                window.SG.SKILLS_DATA[sk].exclusiveHero = result.monarchId;
              }
            }
          }
        }

        // 移除所有开始画面
        var startScr = document.getElementById('startScreen');
        if (startScr && startScr.parentNode) startScr.parentNode.removeChild(startScr);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);

        Main._startGame();
      };
      btnArea.appendChild(startBtn);
      form.appendChild(btnArea);

      overlay.appendChild(form);
      startOverlay.appendChild(overlay);
    },

    _createFormRow: function(label, inputEl) {
      var row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; margin-bottom: 12px;';
      var labelEl = document.createElement('span');
      labelEl.textContent = label + '：';
      labelEl.style.cssText = 'width: 90px; color: #c4a882; font-size: 14px; flex-shrink: 0;';
      row.appendChild(labelEl);
      if (typeof inputEl === 'string') {
        var span = document.createElement('span');
        span.innerHTML = inputEl;
        row.appendChild(span);
      } else {
        inputEl.style.flex = '1';
        row.appendChild(inputEl);
      }
      return row;
    },

    _createInput: function(id, placeholder, value) {
      var input = document.createElement('input');
      input.type = 'text';
      input.id = id;
      input.placeholder = placeholder;
      input.value = value || '';
      input.style.cssText = 'padding: 6px 10px; background: #1a1a1a; color: #e8d4b0; border: 1px solid #666; border-radius: 4px; font-size: 14px; flex: 1;';
      return input;
    },

    _createSelect: function(id, options) {
      var select = document.createElement('select');
      select.id = id;
      select.style.cssText = 'padding: 6px 10px; background: #1a1a1a; color: #e8d4b0; border: 1px solid #666; border-radius: 4px; font-size: 14px; flex: 1;';
      for (var i = 0; i < options.length; i++) {
        var opt = document.createElement('option');
        opt.value = options[i].val;
        opt.textContent = options[i].label;
        select.appendChild(opt);
      }
      return select;
    },

    // 选择势力
    _selectFaction: function(factionId) {
      window.SG.GameState.playerFaction = factionId;
      window.SG.GameState.init();
      window.SG.GameState.playerFaction = factionId;

      // 关闭开始画面，启动游戏
      var overlay = document.getElementById('startScreen');
      this._closeStartScreen(overlay);
      this._startGame();
    },

    // 关闭开始画面
    _closeStartScreen: function(overlay) {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    },

    // ===== 启动游戏 =====
    _startGame: function() {
      // 重新初始化地图尺寸（开始画面移除后布局变化）
      if (window.SG.MapRenderer) {
        window.SG.MapRenderer._resize();
        window.SG.MapRenderer._bgDirty = true;
        window.SG.MapRenderer.render();
      }

      // 初始化战斗场景（绑定canvas，否则AI触发战斗时canvas为null导致崩溃）
      if (window.SG.BattleScene) {
        window.SG.BattleScene.init();
      }

      // 更新UI
      if (window.SG.UIManager) {
        window.SG.UIManager.updateAll();
      }

      // 启动游戏主循环
      this._running = true;
      this._gameLoop();
    },

    // ===== 游戏主循环 =====
    _gameLoop: function() {
      if (!this._running) return;

      var GS = window.SG.GameState;

      // 战斗阶段由 BattleScene 自行驱动
      if (GS.phase === 'battle' && window.SG.BattleScene) {
        window.SG.BattleScene.update();
        window.SG.BattleScene.render();
      }

      // 战略阶段：等待玩家操作，由事件驱动，循环只做少量轮询
      if (GS.phase === 'strategic') {
        // 地图动画、UI刷新等
        if (window.SG.MapRenderer) {
          window.SG.MapRenderer.render();
        }
      }

      // 行军阶段：推进动画
      if (GS.phase === 'marching') {
        if (window.SG.MapRenderer) {
          window.SG.MapRenderer.render();
        }
      }

      this._loopTimer = requestAnimationFrame(function() {
        Main._gameLoop();
      });
    },

    // ===== 停止游戏 =====
    stop: function() {
      this._running = false;
      if (this._loopTimer) {
        cancelAnimationFrame(this._loopTimer);
        this._loopTimer = null;
      }
    }
  };

  window.SG.Main = Main;

  // 页面加载后自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { Main.init(); });
  } else {
    Main.init();
  }

})();
