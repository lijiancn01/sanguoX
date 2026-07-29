// 三国群英传 - UI面板管理器
window.SG = window.SG || {};

(function() {
  'use strict';

  var GS = function() { return window.SG.GameState; };
  var DS = function() { return window.SG.DialogSystem; };

  var UIManager = {

    // 当前显示的面板ID
    activePanel: null,

    // DOM引用缓存
    _dom: {
      topbar: null,
      sidePanel: null,
      bottomBar: null,
      centerOverlay: null,
      notification: null
    },

    // ===== 初始化：创建基础DOM结构 =====
    init: function() {
      var container = document.getElementById('gameContainer') || document.body;

      // 顶部信息栏
      this._dom.topbar = this._createTopbar();
      container.appendChild(this._dom.topbar);

      // 右侧面板容器（320px宽）
      this._dom.sidePanel = document.createElement('div');
      this._dom.sidePanel.className = 'sg-panel';
      this._dom.sidePanel.id = 'sgSidePanel';
      this._dom.sidePanel.style.display = 'none';
      container.appendChild(this._dom.sidePanel);

      // 底部操作栏
      this._dom.bottomBar = document.createElement('div');
      this._dom.bottomBar.className = 'sg-bottombar';
      this._dom.bottomBar.id = 'sgBottomBar';
      container.appendChild(this._dom.bottomBar);

      // 中央覆盖层（战斗、事件等）
      this._dom.centerOverlay = document.createElement('div');
      this._dom.centerOverlay.className = 'sg-overlay';
      this._dom.centerOverlay.id = 'sgCenterOverlay';
      this._dom.centerOverlay.style.display = 'none';
      container.appendChild(this._dom.centerOverlay);

      // 浮动消息容器
      this._dom.notification = document.createElement('div');
      this._dom.notification.id = 'sgNotificationContainer';
      this._dom.notification.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:10000;pointer-events:none;';
      container.appendChild(this._dom.notification);

      this.updateAll();
    },

    // ===== 创建顶部信息栏 =====
    _createTopbar: function() {
      var bar = document.createElement('div');
      bar.className = 'sg-topbar';
      bar.id = 'sgTopbar';

      // 回合信息
      var turnInfo = document.createElement('span');
      turnInfo.className = 'sg-topbar-item';
      turnInfo.id = 'sgTurnInfo';
      bar.appendChild(turnInfo);

      // 势力名称
      var factionInfo = document.createElement('span');
      factionInfo.className = 'sg-topbar-item';
      factionInfo.id = 'sgFactionInfo';
      bar.appendChild(factionInfo);

      // 金币
      var goldInfo = document.createElement('span');
      goldInfo.className = 'sg-topbar-item';
      goldInfo.id = 'sgGoldInfo';
      bar.appendChild(goldInfo);

      // 粮食
      var foodInfo = document.createElement('span');
      foodInfo.className = 'sg-topbar-item';
      foodInfo.id = 'sgFoodInfo';
      bar.appendChild(foodInfo);

      // 按钮区域
      var btnArea = document.createElement('span');
      btnArea.className = 'sg-topbar-btns';

      // 招募武将按钮
      btnArea.appendChild(this._createButton('招募武将', function() {
        UIManager.showRecruitHeroDialog();
      }, 'sg-btn'));

      // 结束回合按钮
      btnArea.appendChild(this._createButton('结束回合', function() {
        UIManager._onEndTurn();
      }, 'sg-btn sg-btn-primary'));

      // 存档按钮
      btnArea.appendChild(this._createButton('存档', function() {
        UIManager.showSaveLoadDialog('save');
      }, 'sg-btn'));

      // 读档按钮
      btnArea.appendChild(this._createButton('读档', function() {
        UIManager.showSaveLoadDialog('load');
      }, 'sg-btn'));

      bar.appendChild(btnArea);
      return bar;
    },

    // ===== 结束回合 =====
    _onEndTurn: function() {
      var gs = GS();
      // 1. 执行回合结束
      gs.endTurn();

      // 2. 处理AI结果（已在endTurn中执行）

      // 3. 检查军队到达（已在endTurn中处理）
      // 如果触发了战斗，BattleScene会自行启动
      if (gs.phase === 'battle') {
        this.showMessage('战斗开始！');
        // 隐藏侧面板，显示战斗界面
        this.hidePanel();
      }

      // 4. 更新UI
      this.updateAll();
      this.showMessage('第 ' + gs.turn + ' 回合');
    },

    // ===== 刷新所有显示数据 =====
    updateAll: function() {
      var gs = GS();
      var pf = gs.playerFaction;
      var faction = gs.factions[pf];
      var factionName = (window.SG.FACTION_NAMES && window.SG.FACTION_NAMES[pf]) || pf;

      // 顶部栏数据
      var turnEl = document.getElementById('sgTurnInfo');
      var factionEl = document.getElementById('sgFactionInfo');
      var goldEl = document.getElementById('sgGoldInfo');
      var foodEl = document.getElementById('sgFoodInfo');

      if (turnEl) turnEl.textContent = '第 ' + gs.turn + ' 回合';
      if (factionEl) factionEl.textContent = '势力：' + factionName;
      if (goldEl) goldEl.textContent = '金币：' + (faction ? faction.gold : 0);
      if (foodEl) foodEl.textContent = '粮食：' + (faction ? faction.food : 0);
    },

    // ===== 显示城市管理面板 =====
    showCityPanel: function(cityId) {
      var gs = GS();
      var city = gs.cities[cityId];
      if (!city) return;

      this.activePanel = 'city_' + cityId;
      var panel = this._dom.sidePanel;
      panel.style.display = 'block';
      panel.innerHTML = '';

      // 城市名称和势力
      var factionName = (window.SG.FACTION_NAMES && window.SG.FACTION_NAMES[city.faction]) || city.faction;
      var factionColor = (window.SG.FACTION_COLORS && window.SG.FACTION_COLORS[city.faction]) || '#888';
      var header = this._createPanel('sgCityPanel', city.name + '（' + factionName + '）', '');
      header.querySelector('.sg-panel-title').style.borderColor = factionColor;
      panel.appendChild(header);

      var content = header.querySelector('.sg-panel-content');
      if (!content) { content = document.createElement('div'); content.className = 'sg-panel-content'; header.appendChild(content); }

      // 城市属性
      var statsDiv = document.createElement('div');
      statsDiv.className = 'sg-city-info';
      statsDiv.innerHTML = [
        this._createBar('农业', city.agriculture, 100, '#6b8e23') ,
        this._createBar('商业', city.commerce, 100, '#daa520') ,
        this._createBar('士气', city.morale, 100, '#cd853f') ,
        this._createBar('防御', city.defense, 100, '#708090')
      ].join('');
      // 兵力
      var currentTroops = gs._getCityTotalTroops(cityId);
      statsDiv.innerHTML += '<div class="sg-stat-row">兵力：' + currentTroops + ' / ' + city.maxTroops + '</div>';
      content.appendChild(statsDiv);

      // 开发分配
      var devDiv = document.createElement('div');
      devDiv.className = 'sg-city-info';
      devDiv.innerHTML = '<div class="sg-section-title">开发分配</div>';

      // 农业开发
      var agriHero = city.developAssign.agriculture ? gs.heroes[city.developAssign.agriculture] : null;
      var agriText = agriHero ? agriHero.name + '（开发中）' : '未指派';
      devDiv.innerHTML += '<div class="sg-assign-row"><span>农业：</span><span class="sg-assign-name">' + agriText + '</span></div>';

      // 商业开发
      var commHero = city.developAssign.commerce ? gs.heroes[city.developAssign.commerce] : null;
      var commText = commHero ? commHero.name + '（开发中）' : '未指派';
      devDiv.innerHTML += '<div class="sg-assign-row"><span>商业：</span><span class="sg-assign-name">' + commText + '</span></div>';

      content.appendChild(devDiv);

      // 驻守武将列表
      var heroDiv = document.createElement('div');
      heroDiv.className = 'sg-hero-list';
      heroDiv.innerHTML = '<div class="sg-section-title">驻守武将</div>';

      for (var i = 0; i < city.heroes.length; i++) {
        var hero = gs.heroes[city.heroes[i]];
        if (!hero) continue;
        // 武将头像
        var portraitImg = '';
        if (window.SG.HeroPortrait) {
          portraitImg = '<img class="sg-hero-portrait" src="' + window.SG.HeroPortrait.toDataURL(hero, 36) + '" alt="' + hero.name + '">';
        }
        var card = document.createElement('div');
        card.className = 'sg-hero-card';
        card.innerHTML = portraitImg +
          '<span class="sg-hero-name">' + hero.name + '</span>' +
          '<span class="sg-hero-status">' + this._heroStatusText(hero) + '</span>' +
          '<span class="sg-hero-troops">兵' + hero.troops + '</span>';
        // 点击显示武将详情
        (function(hid) {
          card.onclick = function() { UIManager.showHeroPanel(hid); };
          card.style.cursor = 'pointer';
        })(hero.id);
        heroDiv.appendChild(card);
      }

      if (city.heroes.length === 0) {
        heroDiv.innerHTML += '<div class="sg-empty">无驻守武将</div>';
      }
      content.appendChild(heroDiv);

      // 相邻城市
      var adjDiv = document.createElement('div');
      adjDiv.className = 'sg-city-info';
      adjDiv.innerHTML = '<div class="sg-section-title">相邻城市</div>';
      var adjNames = [];
      for (var j = 0; j < city.adjacent.length; j++) {
        var adjCity = gs.cities[city.adjacent[j]];
        if (adjCity) {
          var adjColor = (window.SG.FACTION_COLORS && window.SG.FACTION_COLORS[adjCity.faction]) || '#888';
          adjNames.push('<span style="color:' + adjColor + '">' + adjCity.name + '</span>');
        }
      }
      adjDiv.innerHTML += '<div>' + adjNames.join('、') + '</div>';
      content.appendChild(adjDiv);

      // 操作按钮
      var actionsDiv = document.createElement('div');
      actionsDiv.className = 'sg-action-buttons';

      // 开发农业
      actionsDiv.appendChild(this._createButton('开发农业', function() {
        UIManager._showDevelopHeroSelect(cityId, 'agriculture');
      }, 'sg-btn sg-btn-primary'));

      // 开发商业
      actionsDiv.appendChild(this._createButton('开发商业', function() {
        UIManager._showDevelopHeroSelect(cityId, 'commerce');
      }, 'sg-btn sg-btn-primary'));

      // 征兵
      actionsDiv.appendChild(this._createButton('征兵', function() {
        UIManager.showRecruitDialog(cityId);
      }, 'sg-btn sg-btn-primary'));

      // 搜索
      actionsDiv.appendChild(this._createButton('搜索', function() {
        UIManager._showSearchHeroSelect(cityId);
      }, 'sg-btn sg-btn-primary'));

      // 训练
      actionsDiv.appendChild(this._createButton('训练', function() {
        UIManager._showTrainHeroSelect(cityId);
      }, 'sg-btn sg-btn-primary'));

      // 出兵
      actionsDiv.appendChild(this._createButton('出兵', function() {
        UIManager.showDispatchDialog(cityId);
      }, 'sg-btn sg-btn-danger'));

      // 取消农业开发
      if (city.developAssign.agriculture) {
        actionsDiv.appendChild(this._createButton('取消农业开发', function() {
          var result = window.SG.CityManager.cancelDevelop(cityId, 'agriculture');
          UIManager.showMessage(result.msg);
          UIManager.showCityPanel(cityId);
        }, 'sg-btn'));
      }

      // 取消商业开发
      if (city.developAssign.commerce) {
        actionsDiv.appendChild(this._createButton('取消商业开发', function() {
          var result = window.SG.CityManager.cancelDevelop(cityId, 'commerce');
          UIManager.showMessage(result.msg);
          UIManager.showCityPanel(cityId);
        }, 'sg-btn'));
      }

      content.appendChild(actionsDiv);

      // 关闭按钮
      var closeBtn = this._createButton('关闭', function() {
        UIManager.hidePanel();
      }, 'sg-btn');
      content.appendChild(closeBtn);
    },

    // 武将状态文字
    _heroStatusText: function(hero) {
      var map = { idle: '空闲', developing: '开发中', marching: '行军中', battling: '战斗中' };
      return map[hero.status] || hero.status;
    },

    // 显示开发武将选择
    _showDevelopHeroSelect: function(cityId, target) {
      var gs = GS();
      var city = gs.cities[cityId];
      if (!city) return;

      // 筛选空闲武将
      var heroIds = [];
      for (var i = 0; i < city.heroes.length; i++) {
        var hero = gs.heroes[city.heroes[i]];
        if (hero && hero.status === 'idle') {
          heroIds.push(hero.id);
        }
      }

      this.showHeroSelect(heroIds, function(selectedHeroId) {
        var result = window.SG.CityManager.develop(cityId, selectedHeroId, target);
        UIManager.showMessage(result.msg);
        UIManager.showCityPanel(cityId);
        UIManager.updateAll();
      });
    },

    // 显示搜索武将选择
    _showSearchHeroSelect: function(cityId) {
      var gs = GS();
      var city = gs.cities[cityId];
      if (!city) return;

      var heroIds = [];
      for (var i = 0; i < city.heroes.length; i++) {
        var hero = gs.heroes[city.heroes[i]];
        if (hero && hero.status === 'idle') {
          heroIds.push(hero.id);
        }
      }

      this.showHeroSelect(heroIds, function(selectedHeroId) {
        var result = window.SG.CityManager.search(cityId, selectedHeroId);
        if (result.ok) {
          DS().showNotification(result.msg, 'success');
        } else {
          DS().showNotification(result.msg, 'warning');
        }
        UIManager.showCityPanel(cityId);
        UIManager.updateAll();
      });
    },

    // 显示训练武将选择
    _showTrainHeroSelect: function(cityId) {
      var gs = GS();
      var city = gs.cities[cityId];
      if (!city) return;

      var heroIds = [];
      for (var i = 0; i < city.heroes.length; i++) {
        var hero = gs.heroes[city.heroes[i]];
        if (hero && hero.status === 'idle') {
          heroIds.push(hero.id);
        }
      }

      this.showHeroSelect(heroIds, function(selectedHeroId) {
        var result = window.SG.CityManager.train(cityId, selectedHeroId);
        UIManager.showMessage(result.msg);
        UIManager.showCityPanel(cityId);
        UIManager.updateAll();
      });
    },

    // ===== 显示武将详情面板 =====
    showHeroPanel: function(heroId) {
      var gs = GS();
      var hero = gs.heroes[heroId];
      if (!hero) return;

      this.activePanel = 'hero_' + heroId;
      var panel = this._dom.sidePanel;
      panel.style.display = 'block';
      panel.innerHTML = '';

      var factionColor = (window.SG.FACTION_COLORS && window.SG.FACTION_COLORS[hero.faction]) || '#888';
      var factionName = (window.SG.FACTION_NAMES && window.SG.FACTION_NAMES[hero.faction]) || hero.faction;

      var header = this._createPanel('sgHeroPanel', hero.name, '');
      header.querySelector('.sg-panel-title').style.borderColor = factionColor;
      panel.appendChild(header);

      var content = header.querySelector('.sg-panel-content');
      if (!content) { content = document.createElement('div'); content.className = 'sg-panel-content'; header.appendChild(content); }

      // 武将头像
      var portraitDiv = document.createElement('div');
      portraitDiv.style.textAlign = 'center';
      portraitDiv.style.marginBottom = '10px';
      if (window.SG.HeroPortrait) {
        var dataURL = window.SG.HeroPortrait.toDataURL(hero, 80);
        portraitDiv.innerHTML = '<img src="' + dataURL + '" alt="' + hero.name + '" style="width:80px;height:80px;border-radius:50%;border:2px solid ' + factionColor + ';">';
      }
      content.appendChild(portraitDiv);

      // 基本信息
      var infoDiv = document.createElement('div');
      infoDiv.className = 'sg-hero-card';
      infoDiv.innerHTML = '<div>势力：<span style="color:' + factionColor + '">' + factionName + '</span></div>' +
        '<div>等级：' + hero.level + '　经验：' + hero.exp + '/' + (hero.level * 100) + '</div>';
      content.appendChild(infoDiv);

      // 属性条
      var statsDiv = document.createElement('div');
      statsDiv.className = 'sg-hero-stats';
      statsDiv.innerHTML =
        this._createBar('武力', hero.force, 100, '#cc4444') +
        this._createBar('智力', hero.intellect, 100, '#4488cc') +
        this._createBar('政治', hero.politics, 100, '#daa520') +
        this._createBar('统率', hero.command, 100, '#44aa44') +
        this._createBar('魅力', hero.charisma, 100, '#cc8844') +
        this._createBar('忠诚', hero.loyalty, 100, '#cd853f');
      content.appendChild(statsDiv);

      // 技能列表
      var skillsDiv = document.createElement('div');
      skillsDiv.className = 'sg-hero-skills';
      skillsDiv.innerHTML = '<div class="sg-section-title">武将技</div>';

      var skills = window.SG.HeroManager ? window.SG.HeroManager.getSkills(heroId) : [];
      for (var i = 0; i < skills.length; i++) {
        var skill = skills[i];
        skillsDiv.innerHTML += '<div class="sg-skill-item"><span class="sg-skill-name">' + skill.name + '</span>' +
          '<span class="sg-skill-cost">技力' + skill.spCost + '</span>' +
          '<div class="sg-skill-desc">' + skill.desc + '</div></div>';
      }
      if (skills.length === 0) {
        skillsDiv.innerHTML += '<div class="sg-empty">无技能</div>';
      }
      content.appendChild(skillsDiv);

      // 军师技
      if (hero.advisorSkill) {
        var advSkill = window.SG.SKILLS_DATA ? window.SG.SKILLS_DATA[hero.advisorSkill] : null;
        if (advSkill) {
          var advDiv = document.createElement('div');
          advDiv.className = 'sg-hero-skills';
          advDiv.innerHTML = '<div class="sg-section-title">军师技</div>' +
            '<div class="sg-skill-item"><span class="sg-skill-name">' + advSkill.name + '</span>' +
            '<div class="sg-skill-desc">' + advSkill.desc + '</div></div>';
          content.appendChild(advDiv);
        }
      }

      // 当前状态
      var statusDiv = document.createElement('div');
      statusDiv.className = 'sg-hero-card';
      var locationName = '未知';
      if (hero.location && gs.cities[hero.location]) {
        locationName = gs.cities[hero.location].name;
      }
      statusDiv.innerHTML = '<div>兵力：' + hero.troops + '/' + hero.maxTroops + '</div>' +
        '<div>位置：' + locationName + '</div>' +
        '<div>状态：' + this._heroStatusText(hero) + '</div>' +
        '<div>HP：' + hero.hp + '/' + hero.maxHp + '　SP：' + hero.sp + '/' + hero.maxSp + '</div>';
      content.appendChild(statusDiv);

      // 关闭按钮
      content.appendChild(this._createButton('关闭', function() {
        UIManager.hidePanel();
      }, 'sg-btn'));
    },

    // ===== 武将选择弹窗 =====
    showHeroSelect: function(heroIds, callback) {
      var gs = GS();

      var content = '<div class="sg-hero-select-list">';
      for (var i = 0; i < heroIds.length; i++) {
        var hero = gs.heroes[heroIds[i]];
        if (!hero) continue;
        var factionColor = (window.SG.FACTION_COLORS && window.SG.FACTION_COLORS[hero.faction]) || '#888';
        content += '<div class="sg-hero-card sg-hero-select-item" data-hero-id="' + hero.id + '">' +
          '<span class="sg-hero-name" style="color:' + factionColor + '">' + hero.name + '</span>' +
          '<span class="sg-hero-stat">武' + hero.force + ' 智' + hero.intellect + ' 统' + hero.command + '</span>' +
          '<span class="sg-hero-troops">兵' + hero.troops + '</span>' +
          '</div>';
      }
      if (heroIds.length === 0) {
        content += '<div class="sg-empty">没有可选武将</div>';
      }
      content += '</div>';

      var buttons = [];
      if (heroIds.length === 0) {
        buttons.push({ text: '关闭', onClick: function() { DS().hide(); }, className: 'sg-btn' });
      }

      DS().show('选择武将', content, buttons);

      // 绑定点击事件
      var items = document.querySelectorAll('.sg-hero-select-item');
      for (var j = 0; j < items.length; j++) {
        (function(item) {
          item.onclick = function() {
            var hid = item.getAttribute('data-hero-id');
            DS().hide();
            if (callback && hid) callback(hid);
          };
          item.style.cursor = 'pointer';
        })(items[j]);
      }
    },

    // ===== 征兵对话框 =====
    showRecruitDialog: function(cityId) {
      var gs = GS();
      var city = gs.cities[cityId];
      if (!city) return;

      var faction = gs.factions[city.faction];
      if (!faction) { this.showMessage('城市无势力'); return; }

      var currentTroops = gs._getCityTotalTroops(cityId);
      var availableCapacity = city.maxTroops - currentTroops;
      if (availableCapacity <= 0) {
        this.showMessage('兵力已达上限');
        return;
      }

      var maxAmount = Math.min(availableCapacity, Math.floor(faction.gold / 0.5), Math.floor(faction.food / 0.3));
      if (maxAmount <= 0) {
        this.showMessage('资源不足，无法征兵');
        return;
      }

      var content = '<div class="sg-recruit-dialog">' +
        '<div class="sg-recruit-info">可用容量：' + availableCapacity + '</div>' +
        '<div class="sg-recruit-info">金币：' + faction.gold + '　粮食：' + faction.food + '</div>' +
        '<div class="sg-slider-row">' +
        '<label>征兵数量：</label>' +
        '<input type="range" id="sgRecruitSlider" min="1" max="' + maxAmount + '" value="1" class="sg-slider">' +
        '<span id="sgRecruitAmount">1</span>' +
        '</div>' +
        '<div id="sgRecruitCost" class="sg-recruit-cost">消耗：金币1，粮食1</div>' +
        '</div>';

      var self = this;
      var buttons = [
        {
          text: '确认征兵',
          onClick: function() {
            var slider = document.getElementById('sgRecruitSlider');
            var amount = slider ? parseInt(slider.value, 10) : 0;
            if (amount <= 0) return;
            var result = window.SG.CityManager.recruit(cityId, amount);
            DS().hide();
            UIManager.showMessage(result.msg);
            UIManager.showCityPanel(cityId);
            UIManager.updateAll();
          },
          className: 'sg-btn sg-btn-primary'
        },
        {
          text: '取消',
          onClick: function() { DS().hide(); },
          className: 'sg-btn'
        }
      ];

      DS().show('征兵', content, buttons);

      // 绑定滑块事件
      var slider = document.getElementById('sgRecruitSlider');
      var amountEl = document.getElementById('sgRecruitAmount');
      var costEl = document.getElementById('sgRecruitCost');
      if (slider) {
        slider.oninput = function() {
          var val = parseInt(slider.value, 10);
          if (amountEl) amountEl.textContent = val;
          if (costEl) costEl.textContent = '消耗：金币' + Math.floor(val * 0.5) + '，粮食' + Math.floor(val * 0.3);
        };
      }
    },

    // ===== 出兵对话框 =====
    showDispatchDialog: function(fromCityId) {
      var gs = GS();
      var fromCity = gs.cities[fromCityId];
      if (!fromCity) return;

      // 可选武将（空闲且有兵）
      var heroContent = '<div class="sg-dispatch-heroes">';
      heroContent += '<div class="sg-section-title">选择出征武将</div>';
      var availableHeroes = [];
      for (var i = 0; i < fromCity.heroes.length; i++) {
        var hero = gs.heroes[fromCity.heroes[i]];
        if (hero && hero.status === 'idle' && hero.troops > 0) {
          availableHeroes.push(hero);
          heroContent += '<div class="sg-hero-card sg-dispatch-hero-item">' +
            '<label><input type="checkbox" class="sg-dispatch-check" data-hero-id="' + hero.id + '" checked> ' +
            hero.name + '（兵' + hero.troops + '）</label></div>';
        }
      }
      heroContent += '</div>';

      if (availableHeroes.length === 0) {
        DS().show('出兵', '<div class="sg-empty">没有可出征的武将</div>', [
          { text: '关闭', onClick: function() { DS().hide(); }, className: 'sg-btn' }
        ]);
        return;
      }

      // 目标城市（相邻非己方城市）
      var targetContent = '<div class="sg-dispatch-targets">';
      targetContent += '<div class="sg-section-title">选择目标城市</div>';
      var targetCities = [];
      for (var j = 0; j < fromCity.adjacent.length; j++) {
        var adjCity = gs.cities[fromCity.adjacent[j]];
        if (adjCity && adjCity.faction !== fromCity.faction) {
          targetCities.push(adjCity);
          var adjColor = (window.SG.FACTION_COLORS && window.SG.FACTION_COLORS[adjCity.faction]) || '#888';
          targetContent += '<div class="sg-dispatch-target-item">' +
            '<label><input type="radio" name="sgDispatchTarget" value="' + adjCity.id + '"> ' +
            '<span style="color:' + adjColor + '">' + adjCity.name + '</span>（兵' + (gs._getCityTotalTroops(adjCity.id)) + '）</label></div>';
        }
      }
      targetContent += '</div>';

      if (targetCities.length === 0) {
        DS().show('出兵', '<div class="sg-empty">没有可进攻的相邻城市</div>', [
          { text: '关闭', onClick: function() { DS().hide(); }, className: 'sg-btn' }
        ]);
        return;
      }

      var summaryContent = '<div id="sgDispatchSummary" class="sg-dispatch-summary">出征兵力：0</div>';

      var fullContent = heroContent + targetContent + summaryContent;

      var buttons = [
        {
          text: '确认出兵',
          onClick: function() {
            // 获取选中的武将
            var checks = document.querySelectorAll('.sg-dispatch-check:checked');
            var selectedHeroIds = [];
            for (var k = 0; k < checks.length; k++) {
              selectedHeroIds.push(checks[k].getAttribute('data-hero-id'));
            }

            // 获取目标城市
            var radio = document.querySelector('input[name="sgDispatchTarget"]:checked');
            var targetCityId = radio ? radio.value : null;

            if (selectedHeroIds.length === 0) {
              UIManager.showMessage('请选择出征武将');
              return;
            }
            if (!targetCityId) {
              UIManager.showMessage('请选择目标城市');
              return;
            }

            var result = window.SG.CityManager.dispatchArmy(fromCityId, selectedHeroIds, targetCityId);
            DS().hide();
            UIManager.showMessage(result.msg);
            UIManager.showCityPanel(fromCityId);
            UIManager.updateAll();
          },
          className: 'sg-btn sg-btn-danger'
        },
        {
          text: '取消',
          onClick: function() { DS().hide(); },
          className: 'sg-btn'
        }
      ];

      DS().show('出兵 - ' + fromCity.name, fullContent, buttons);

      // 绑定checkbox事件更新总兵力
      var checks = document.querySelectorAll('.sg-dispatch-check');
      for (var m = 0; m < checks.length; m++) {
        checks[m].onchange = function() {
          UIManager._updateDispatchSummary();
        };
      }
      // 初始更新
      this._updateDispatchSummary();
    },

    // 更新出兵兵力汇总
    _updateDispatchSummary: function() {
      var gs = GS();
      var checks = document.querySelectorAll('.sg-dispatch-check:checked');
      var total = 0;
      for (var i = 0; i < checks.length; i++) {
        var hid = checks[i].getAttribute('data-hero-id');
        var hero = gs.heroes[hid];
        if (hero) total += hero.troops;
      }
      var summary = document.getElementById('sgDispatchSummary');
      if (summary) summary.textContent = '出征兵力：' + total;
    },

    // ===== 战斗结果面板 =====
    showBattleResult: function(result) {
      if (!result) return;

      var gs = GS();
      var winnerText = result.winner === 'attacker' ? '攻方获胜' : '守方获胜';

      var content = '<div class="sg-battle-result">' +
        '<div class="sg-result-winner">' + winnerText + '</div>';

      // 攻方伤亡
      content += '<div class="sg-section-title">攻方伤亡</div>';
      for (var i = 0; i < result.attackerCasualties.length; i++) {
        var ac = result.attackerCasualties[i];
        var hero = gs.heroes[ac.heroId];
        var name = hero ? hero.name : ac.heroId;
        var statusText = ac.captured ? '（被俘）' : '';
        content += '<div class="sg-casualty-item">' + name + '：兵' + ac.troops + ' HP' + ac.hp + statusText + '</div>';
      }

      // 守方伤亡
      content += '<div class="sg-section-title">守方伤亡</div>';
      for (var j = 0; j < result.defenderCasualties.length; j++) {
        var dc = result.defenderCasualties[j];
        var dHero = gs.heroes[dc.heroId];
        var dName = dHero ? dHero.name : dc.heroId;
        var dStatusText = dc.captured ? '（被俘）' : '';
        content += '<div class="sg-casualty-item">' + dName + '：兵' + dc.troops + ' HP' + dc.hp + dStatusText + '</div>';
      }

      content += '</div>';

      var buttons = [
        {
          text: '返回',
          onClick: function() {
            DS().hide();
            // 应用战斗结果
            if (window.SG.BattleEngine) {
              window.SG.BattleEngine.applyResult();
            }
            // 停止战斗场景
            if (window.SG.BattleScene) {
              window.SG.BattleScene.stop();
            }
            UIManager.updateAll();
          },
          className: 'sg-btn sg-btn-primary'
        }
      ];

      DS().show('战斗结束', content, buttons);
    },

    // ===== 存档/读档对话框 =====
    showSaveLoadDialog: function(mode) {
      var content = '<div class="sg-saveload">';
      for (var slot = 0; slot < 3; slot++) {
        var info = this._getSaveInfo(slot);
        content += '<div class="sg-save-slot">' +
          '<div class="sg-slot-label">档位 ' + (slot + 1) + '</div>' +
          '<div class="sg-slot-info">' + (info || '空') + '</div>' +
          '<div class="sg-slot-actions">';

        if (mode === 'save') {
          content += '<button class="sg-btn sg-btn-primary sg-slot-save" data-slot="' + slot + '">保存</button>';
        } else {
          if (info) {
            content += '<button class="sg-btn sg-btn-primary sg-slot-load" data-slot="' + slot + '">读取</button>';
          }
        }

        if (info) {
          content += ' <button class="sg-btn sg-btn-danger sg-slot-delete" data-slot="' + slot + '">删除</button>';
        }

        content += '</div></div>';
      }
      content += '</div>';

      var buttons = [
        { text: '关闭', onClick: function() { DS().hide(); }, className: 'sg-btn' }
      ];

      var title = mode === 'save' ? '存档' : '读档';
      DS().show(title, content, buttons);

      // 绑定按钮事件
      var self = this;
      var saveBtns = document.querySelectorAll('.sg-slot-save');
      for (var i = 0; i < saveBtns.length; i++) {
        (function(btn) {
          btn.onclick = function() {
            var s = parseInt(btn.getAttribute('data-slot'), 10);
            var ok = GS().save(s);
            DS().hide();
            self.showMessage(ok ? '存档成功' : '存档失败');
          };
        })(saveBtns[i]);
      }

      var loadBtns = document.querySelectorAll('.sg-slot-load');
      for (var j = 0; j < loadBtns.length; j++) {
        (function(btn) {
          btn.onclick = function() {
            var s = parseInt(btn.getAttribute('data-slot'), 10);
            var ok = GS().load(s);
            DS().hide();
            self.showMessage(ok ? '读档成功' : '读档失败');
            if (ok) self.updateAll();
          };
        })(loadBtns[j]);
      }

      var delBtns = document.querySelectorAll('.sg-slot-delete');
      for (var k = 0; k < delBtns.length; k++) {
        (function(btn) {
          btn.onclick = function() {
            var s = parseInt(btn.getAttribute('data-slot'), 10);
            try { localStorage.removeItem('sg_save_' + s); } catch(e) {}
            DS().hide();
            self.showMessage('存档已删除');
            self.showSaveLoadDialog(mode);
          };
        })(delBtns[k]);
      }
    },

    // 获取存档信息
    _getSaveInfo: function(slot) {
      try {
        var raw = localStorage.getItem('sg_save_' + slot);
        if (!raw) return null;
        var data = JSON.parse(raw);
        var factionName = (window.SG.FACTION_NAMES && window.SG.FACTION_NAMES[data.playerFaction]) || data.playerFaction;
        return '第' + data.turn + '回合 ' + factionName;
      } catch(e) {
        return null;
      }
    },

    // ===== 关闭面板 =====
    hidePanel: function() {
      this.activePanel = null;
      this._dom.sidePanel.style.display = 'none';
      this._dom.sidePanel.innerHTML = '';
    },

    // ===== 浮动消息 =====
    showMessage: function(text) {
      var container = this._dom.notification;
      if (!container) return;

      var msg = document.createElement('div');
      msg.className = 'sg-notification sg-notification-info';
      msg.textContent = text;
      container.appendChild(msg);

      // 3秒后淡出移除
      setTimeout(function() {
        msg.style.opacity = '0';
        msg.style.transition = 'opacity 0.5s';
        setTimeout(function() {
          if (msg.parentNode) msg.parentNode.removeChild(msg);
        }, 500);
      }, 2500);
    },

    // ===== 内部：创建面板DOM =====
    _createPanel: function(id, title, content) {
      var panel = document.createElement('div');
      panel.className = 'sg-panel-inner';
      panel.id = id;

      var titleEl = document.createElement('div');
      titleEl.className = 'sg-panel-title';
      titleEl.textContent = title;
      panel.appendChild(titleEl);

      var contentEl = document.createElement('div');
      contentEl.className = 'sg-panel-content';
      if (typeof content === 'string') {
        contentEl.innerHTML = content;
      }
      panel.appendChild(contentEl);

      return panel;
    },

    // ===== 内部：创建按钮 =====
    _createButton: function(text, onclick, className) {
      var btn = document.createElement('button');
      btn.className = className || 'sg-btn';
      btn.textContent = text;
      btn.onclick = onclick;
      return btn;
    },

    // ===== 招募武将对话框 =====
    showRecruitHeroDialog: function() {
      var gs = GS();
      var playerCities = gs.getFactionCities(gs.playerFaction);
      if (playerCities.length === 0) {
        this.showMessage('没有己方城市，无法招募');
        return;
      }

      var content = '<div class="sg-recruit-hero">';
      content += '<div class="sg-form-row"><label>武将姓名：</label><input type="text" id="rh_name" placeholder="请输入武将姓名" class="sg-form-input"></div>';

      // 兵种选择
      content += '<div class="sg-form-row"><label>兵种：</label>';
      content += '<select id="rh_troop" class="sg-form-select">';
      content += '<option value="infantry">步兵</option>';
      content += '<option value="cavalry">骑兵</option>';
      content += '<option value="archer">弓兵</option>';
      content += '</select></div>';

      // 驻扎城市
      content += '<div class="sg-form-row"><label>驻扎城市：</label>';
      content += '<select id="rh_city" class="sg-form-select">';
      for (var i = 0; i < playerCities.length; i++) {
        content += '<option value="' + playerCities[i].id + '">' + playerCities[i].name + '</option>';
      }
      content += '</select></div>';

      // 属性分配
      content += '<div class="sg-section-title">属性分配（总点数：250）</div>';
      content += '<div class="sg-attr-total">剩余点数：<span id="rh_remain">250</span></div>';

      var attrs = [
        { key: 'force', label: '武力', val: 50 },
        { key: 'intellect', label: '智力', val: 50 },
        { key: 'politics', label: '政治', val: 50 },
        { key: 'command', label: '统率', val: 50 },
        { key: 'charisma', label: '魅力', val: 50 }
      ];

      for (var a = 0; a < attrs.length; a++) {
        content += '<div class="sg-attr-row" data-attr="' + attrs[a].key + '">' +
          '<span class="sg-attr-label">' + attrs[a].label + '</span>' +
          '<button class="sg-attr-btn sg-attr-minus" data-attr="' + attrs[a].key + '">-</button>' +
          '<span class="sg-attr-val" id="rh_val_' + attrs[a].key + '">' + attrs[a].val + '</span>' +
          '<button class="sg-attr-btn sg-attr-plus" data-attr="' + attrs[a].key + '">+</button>' +
          '</div>';
      }

      // 技能选择
      content += '<div class="sg-section-title">选择武将技（最多2个）</div>';
      content += '<div class="sg-skill-select" id="rh_skills">';
      var selectable = window.SG.getSelectableSkills ? window.SG.getSelectableSkills() : [];
      for (var s = 0; s < selectable.length; s++) {
        var sk = selectable[s];
        content += '<label class="sg-skill-option"><input type="checkbox" value="' + sk.id + '" data-power="' + sk.power + '"> ' +
          '<span class="sg-skill-name">' + sk.name + '</span>' +
          '<span class="sg-skill-cost">技力' + sk.spCost + '</span>' +
          '</label>';
      }
      content += '</div>';

      // 设计专属技能按钮
      content += '<div class="sg-exclusive-section">';
      content += '<button class="sg-btn sg-btn-primary" id="rh_design_skill">设计专属武将技</button>';
      content += '<div class="sg-exclusive-info" id="rh_exclusive_info">未设计专属技能</div>';
      content += '</div>';

      content += '</div>';

      var buttons = [
        { text: '取消', onClick: function() { DS().hide(); }, className: 'sg-btn' },
        { text: '招募（花费200金）', onClick: function() {
            var name = document.getElementById('rh_name').value.trim();
            if (!name) { UIManager.showMessage('请输入武将姓名'); return; }

            var faction = gs.factions[gs.playerFaction];
            if (!faction || faction.gold < 200) {
              UIManager.showMessage('金币不足');
              return;
            }

            var troopType = document.getElementById('rh_troop').value;
            var cityId = document.getElementById('rh_city').value;

            var heroAttrs = {};
            var totalAttr = 0;
            for (var ai = 0; ai < attrs.length; ai++) {
              var k = attrs[ai].key;
              var v = parseInt(document.getElementById('rh_val_' + k).textContent, 10);
              heroAttrs[k] = v;
              totalAttr += v;
            }

            var skillIds = [];
            var checks = document.querySelectorAll('#rh_skills input:checked');
            for (var ci = 0; ci < checks.length; ci++) {
              skillIds.push(checks[ci].value);
            }

            // 添加专属技能
            if (UIManager._exclusiveSkillData) {
              var exSkillId = window.SG.registerCustomSkill(UIManager._exclusiveSkillData);
              skillIds.push(exSkillId);
            }

            if (skillIds.length === 0) {
              UIManager.showMessage('请至少选择一个技能');
              return;
            }

            faction.gold -= 200;

            var heroId = gs.createCustomHero(
              name, heroAttrs, troopType, skillIds, null, gs.playerFaction, cityId
            );

            // 设置专属技能归属
            if (UIManager._exclusiveSkillData) {
              for (var sk2 in window.SG.CUSTOM_SKILLS) {
                if (window.SG.CUSTOM_SKILLS.hasOwnProperty(sk2) &&
                    window.SG.CUSTOM_SKILLS[sk2].name === UIManager._exclusiveSkillData.name &&
                    !window.SG.CUSTOM_SKILLS[sk2].exclusiveHero) {
                  window.SG.CUSTOM_SKILLS[sk2].exclusiveHero = heroId;
                  window.SG.SKILLS_DATA[sk2].exclusiveHero = heroId;
                }
              }
            }

            UIManager._exclusiveSkillData = null;
            DS().hide();
            UIManager.showMessage('成功招募武将：' + name);
            UIManager.updateAll();
          }, className: 'sg-btn sg-btn-primary'
        }
      ];

      DS().show('招募武将', content, buttons);

      // 属性分配逻辑
      var attrState = { force: 50, intellect: 50, politics: 50, command: 50, charisma: 50 };
      var totalPoints = 250;

      function updateRemain() {
        var used = 0;
        for (var k in attrState) used += attrState[k];
        var remainEl = document.getElementById('rh_remain');
        if (remainEl) remainEl.textContent = totalPoints - used;
      }

      function bindAttrBtns() {
        var minusBtns = document.querySelectorAll('.sg-attr-minus');
        var plusBtns = document.querySelectorAll('.sg-attr-plus');
        for (var i = 0; i < minusBtns.length; i++) {
          minusBtns[i].onclick = function() {
            var key = this.getAttribute('data-attr');
            if (attrState[key] > 20) {
              attrState[key]--;
              var valEl = document.getElementById('rh_val_' + key);
              if (valEl) valEl.textContent = attrState[key];
              updateRemain();
            }
          };
        }
        for (var j = 0; j < plusBtns.length; j++) {
          plusBtns[j].onclick = function() {
            var key = this.getAttribute('data-attr');
            var used = 0;
            for (var k in attrState) used += attrState[k];
            if (used < totalPoints && attrState[key] < 100) {
              attrState[key]++;
              var valEl = document.getElementById('rh_val_' + key);
              if (valEl) valEl.textContent = attrState[key];
              updateRemain();
            }
          };
        }
      }

      // 技能选择限制2个
      function bindSkillChecks() {
        var checks = document.querySelectorAll('#rh_skills input[type="checkbox"]');
        for (var i = 0; i < checks.length; i++) {
          checks[i].onchange = function() {
            var checked = document.querySelectorAll('#rh_skills input:checked');
            if (checked.length > 2) {
              this.checked = false;
              UIManager.showMessage('最多选择2个武将技');
            }
          };
        }
      }

      // 设计专属技能按钮
      var designBtn = document.getElementById('rh_design_skill');
      if (designBtn) {
        designBtn.onclick = function() {
          UIManager.showSkillDesigner(function(skillData) {
            UIManager._exclusiveSkillData = skillData;
            var info = document.getElementById('rh_exclusive_info');
            if (info) info.textContent = '专属技能：' + skillData.name + '（' + (window.SG.EFFECT_TYPE_NAMES && window.SG.EFFECT_TYPE_NAMES[skillData.effectType] || skillData.effectType) + '）';
          });
        };
      }

      setTimeout(function() {
        bindAttrBtns();
        bindSkillChecks();
      }, 10);
    },

    _exclusiveSkillData: null,

    // ===== 专属技能设计器 =====
    showSkillDesigner: function(callback) {
      var content = '<div class="sg-skill-designer">';

      content += '<div class="sg-form-row"><label>技能名称：</label><input type="text" id="sd_name" placeholder="请输入技能名" class="sg-form-input"></div>';

      // 效果类型
      content += '<div class="sg-form-row"><label>效果类型：</label><select id="sd_effect" class="sg-form-select">';
      var effectTypes = [
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
        { val: 'burn', label: '灼烧（伤害+持续伤害）' },
        { val: 'stun', label: '眩晕（伤害+概率眩晕）' }
      ];
      for (var e = 0; e < effectTypes.length; e++) {
        content += '<option value="' + effectTypes[e].val + '">' + effectTypes[e].label + '</option>';
      }
      content += '</select></div>';

      // 技能范围
      content += '<div class="sg-form-row"><label>技能范围：</label><select id="sd_range" class="sg-form-select">';
      content += '<option value="single">单体</option>';
      content += '<option value="area">群体</option>';
      content += '<option value="self">自身</option>';
      content += '<option value="ally">我方全体</option>';
      content += '</select></div>';

      // 技能元素
      content += '<div class="sg-form-row"><label>技能元素：</label><select id="sd_element" class="sg-form-select">';
      content += '<option value="ink">墨系</option>';
      content += '<option value="fire">火系</option>';
      content += '<option value="lightning">雷系</option>';
      content += '</select></div>';

      // 威力
      content += '<div class="sg-form-row"><label>技能威力：</label>';
      content += '<input type="range" id="sd_power" min="30" max="150" value="80" class="sg-slider">';
      content += '<span id="sd_power_val" class="sg-slider-val">80</span></div>';

      // 消耗
      content += '<div class="sg-form-row"><label>技力消耗：</label>';
      content += '<input type="range" id="sd_cost" min="10" max="60" value="35" class="sg-slider">';
      content += '<span id="sd_cost_val" class="sg-slider-val">35</span></div>';

      // 描述
      content += '<div class="sg-form-row"><label>技能描述：</label><input type="text" id="sd_desc" placeholder="描述你的专属技能" class="sg-form-input"></div>';

      // 威力预估
      content += '<div class="sg-skill-preview">';
      content += '<div class="sg-preview-title">技能预览</div>';
      content += '<div id="sd_preview">调整参数查看效果</div>';
      content += '</div>';

      content += '</div>';

      var buttons = [
        { text: '取消', onClick: function() { DS().hide(); }, className: 'sg-btn' },
        { text: '确认设计', onClick: function() {
            var name = document.getElementById('sd_name').value.trim();
            if (!name) { UIManager.showMessage('请输入技能名称'); return; }

            var effectType = document.getElementById('sd_effect').value;
            var range = document.getElementById('sd_range').value;
            var element = document.getElementById('sd_element').value;
            var power = parseInt(document.getElementById('sd_power').value, 10);
            var spCost = parseInt(document.getElementById('sd_cost').value, 10);
            var desc = document.getElementById('sd_desc').value.trim() || name;

            var skillData = {
              name: name,
              effectType: effectType,
              spCost: spCost,
              power: power,
              range: range,
              element: element,
              desc: desc,
              heroId: null
            };

            DS().hide();
            if (callback) callback(skillData);
          }, className: 'sg-btn sg-btn-primary'
        }
      ];

      DS().show('设计专属武将技', content, buttons);

      setTimeout(function() {
        var powerSlider = document.getElementById('sd_power');
        var powerVal = document.getElementById('sd_power_val');
        var costSlider = document.getElementById('sd_cost');
        var costVal = document.getElementById('sd_cost_val');
        var effectSel = document.getElementById('sd_effect');
        var rangeSel = document.getElementById('sd_range');
        var preview = document.getElementById('sd_preview');

        function updatePreview() {
          if (!preview) return;
          var p = parseInt(powerSlider.value, 10);
          var c = parseInt(costSlider.value, 10);
          var eff = effectSel.value;
          var rng = rangeSel.value;
          var effName = window.SG.EFFECT_TYPE_NAMES ? (window.SG.EFFECT_TYPE_NAMES[eff] || eff) : eff;
          var rngName = window.SG.RANGE_NAMES ? (window.SG.RANGE_NAMES[rng] || rng) : rng;
          preview.innerHTML = '效果：' + effName + '　|　范围：' + rngName + '<br>威力：' + p + '　|　消耗：' + c + ' 技力';
        }

        if (powerSlider) powerSlider.oninput = function() { powerVal.textContent = powerSlider.value; updatePreview(); };
        if (costSlider) costSlider.oninput = function() { costVal.textContent = costSlider.value; updatePreview(); };
        if (effectSel) effectSel.onchange = updatePreview;
        if (rangeSel) rangeSel.onchange = updatePreview;
        updatePreview();
      }, 10);
    },

    // ===== 内部：创建属性条HTML =====
    _createBar: function(label, value, max, color) {
      var percent = max > 0 ? Math.floor(value / max * 100) : 0;
      return '<div class="sg-stat-bar">' +
        '<span class="sg-stat-label">' + label + '</span>' +
        '<div class="sg-stat-track"><div class="sg-stat-fill" style="width:' + percent + '%;background:' + color + '"></div></div>' +
        '<span class="sg-stat-value">' + value + '</span>' +
        '</div>';
    },

    // 显示轻量级提示
    showToast: function(msg, duration) {
      var toast = document.createElement('div');
      toast.className = 'sg-toast';
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(function() {
        toast.classList.add('sg-toast-out');
        setTimeout(function() {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }, duration || 2500);
    }
  };

  window.SG.UIManager = UIManager;

})();
