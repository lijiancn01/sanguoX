// 三国群英传 - 单挑UI面板
window.SG = window.SG || {};

(function() {
  'use strict';

  var DuelUI = {
    overlay: null,
    onAction: null,        // 玩家选择行动回调
    _pendingAI: false,     // AI回合等待中
    _pendingCallback: null,// AI回合执行后回调
    _lastEvent: null,      // 上一次事件（用于动画）

    // 打开单挑面板
    open: function(duelState, options) {
      options = options || {};
      this.onAction = options.onAction || null;
      this._pendingCallback = options.onComplete || null;
      this._pendingAI = false;
      this._lastEvent = null;

      // 创建遮罩
      this.overlay = document.createElement('div');
      this.overlay.className = 'sg-duel-overlay';
      this.overlay.innerHTML = this._buildHTML(duelState);
      document.body.appendChild(this.overlay);

      this._bindEvents();

      // 如果当前是AI行动，自动执行
      if (duelState.currentActor) {
        var hero = duelState[duelState.currentActor];
        if (!hero.isPlayer) {
          this._pendingAI = true;
          this._showAIThinking();
        }
      }
    },

    // 关闭单挑面板
    close: function() {
      if (this.overlay) {
        this.overlay.remove();
        this.overlay = null;
      }
      this._unbindEvents();
    },

    // 刷新单挑状态
    refresh: function(duelState, lastEvent) {
      if (!this.overlay) return;
      this._lastEvent = lastEvent || null;
      this.overlay.innerHTML = this._buildHTML(duelState);
      this._bindEvents();
    },

    // 构建HTML
    _buildHTML: function(state) {
      if (!state) return '';
      var atk = state.attacker;
      var def = state.defender;
      var currentActor = state.currentActor;
      var lastEvent = this._lastEvent;

      // 上次事件动画/描述
      var eventDesc = '';
      if (lastEvent) {
        eventDesc = this._renderEventDesc(lastEvent);
      }

      // 当前行动者
      var currentHero = state[currentActor];
      var currentName = currentHero.data.name;
      var isPlayerTurn = currentHero.isPlayer && !this._pendingAI;

      // 玩家可选行动按钮
      var actionsHTML = '';
      if (isPlayerTurn && state.phase === 'choosing') {
        actionsHTML = this._renderActionButtons(state, currentActor);
      } else if (state.phase === 'ended') {
        actionsHTML = '<div class="sg-duel-ended">' + this._renderEndInfo(state) + '<button class="sg-btn sg-btn-primary" id="duel_close">确认</button></div>';
      } else if (this._pendingAI || !isPlayerTurn) {
        actionsHTML = '<div class="sg-duel-ai-thinking">对手思考中...</div>';
      }

      // 双方武将卡
      var attackerCard = this._renderHeroCard(atk, 'attacker', state, lastEvent);
      var defenderCard = this._renderHeroCard(def, 'defender', state, lastEvent);

      // 战斗日志
      var logHTML = this._renderLog(state.log);

      // 回合信息
      var turnInfo = '第 ' + state.turn + ' 回合';
      if (state.phase === 'choosing') turnInfo += ' · 请选择行动';
      else if (state.phase === 'acting') turnInfo += ' · 行动中';
      else if (state.phase === 'ended') turnInfo += ' · 单挑结束';

      return '' +
        '<div class="sg-duel-panel">' +
          '<div class="sg-duel-header">' +
            '<h2>⚔ 武将单挑 ⚔</h2>' +
            '<div class="sg-duel-turn">' + turnInfo + '</div>' +
          '</div>' +

          '<div class="sg-duel-stage">' +
            '<div class="sg-duel-hero sg-duel-left ' + (lastEvent && lastEvent.actor === 'attacker' ? 'sg-duel-flash' : '') + '">' +
              attackerCard +
            '</div>' +

            '<div class="sg-duel-vs">VS</div>' +

            '<div class="sg-duel-hero sg-duel-right ' + (lastEvent && lastEvent.actor === 'defender' ? 'sg-duel-flash' : '') + '">' +
              defenderCard +
            '</div>' +
          '</div>' +

          '<div class="sg-duel-event">' + eventDesc + '</div>' +

          '<div class="sg-duel-actions">' + actionsHTML + '</div>' +

          '<div class="sg-duel-log">' + logHTML + '</div>' +
        '</div>';
    },

    // 渲染武将卡
    _renderHeroCard: function(hero, side, state, lastEvent) {
      var hpRatio = Math.max(0, hero.hp / hero.maxHp);
      var moraleRatio = Math.max(0, Math.min(1, hero.morale / 150));
      var hpColor = hpRatio > 0.5 ? '#4a8' : (hpRatio > 0.2 ? '#da4' : '#d44');

      var statusText = '';
      if (hero.status === 'defending') statusText = '防御';
      else if (hero.status === 'stunned') statusText = '眩晕';
      else if (hero.status === 'attack_buffed') statusText = '蓄力';
      else if (hero.status === 'attack_debuffed') statusText = '虚弱';

      // 武将头像
      var portraitHTML = '';
      if (window.SG.HeroPortrait && hero.data) {
        var dataURL = window.SG.HeroPortrait.toDataURL(hero.data, 80);
        portraitHTML = '<div class="sg-duel-portrait"><img src="' + dataURL + '" alt="' + hero.data.name + '"></div>';
      }

      var skillList = '';
      if (hero.data && hero.data.skills && hero.data.skills.length > 0) {
        skillList = '<div class="sg-duel-skills">';
        for (var i = 0; i < hero.data.skills.length; i++) {
          var sData = window.SG.SKILLS_DATA[hero.data.skills[i]];
          if (sData) {
            skillList += '<span class="sg-duel-skill-tag" title="' + (sData.desc || sData.name) + '">' + sData.name + '(' + sData.spCost + ')</span>';
          }
        }
        skillList += '</div>';
      }

      var isCurrent = state.currentActor === side;
      var isDead = hero.hp <= 0;

      return '' +
        '<div class="sg-duel-hero-card ' + (isCurrent ? 'sg-duel-current' : '') + ' ' + (isDead ? 'sg-duel-dead' : '') + '">' +
          portraitHTML +
          '<div class="sg-duel-hero-name">' + hero.data.name +
            (statusText ? '<span class="sg-duel-status">' + statusText + '</span>' : '') +
          '</div>' +
          '<div class="sg-duel-hero-info">' +
            '<span>武力 ' + (hero.data.force || 0) + '</span>' +
            '<span>统率 ' + (hero.data.leadership || 0) + '</span>' +
            '<span>智力 ' + (hero.data.intellect || 0) + '</span>' +
            '<span>魅力 ' + (hero.data.charisma || 50) + '</span>' +
          '</div>' +
          '<div class="sg-duel-bar">' +
            '<div class="sg-duel-bar-label">HP</div>' +
            '<div class="sg-duel-bar-bg">' +
              '<div class="sg-duel-bar-fill" style="width:' + (hpRatio * 100) + '%; background:' + hpColor + ';"></div>' +
            '</div>' +
            '<div class="sg-duel-bar-val">' + hero.hp + '/' + hero.maxHp + '</div>' +
          '</div>' +
          '<div class="sg-duel-bar">' +
            '<div class="sg-duel-bar-label">气势</div>' +
            '<div class="sg-duel-bar-bg">' +
              '<div class="sg-duel-bar-fill" style="width:' + (moraleRatio * 100) + '%; background:#48c;"></div>' +
            '</div>' +
            '<div class="sg-duel-bar-val">' + hero.morale + '</div>' +
          '</div>' +
          skillList +
        '</div>';
    },

    // 渲染事件描述
    _renderEventDesc: function(evt) {
      if (!evt) return '';
      if (evt.type === 'attack') {
        if (evt.dodged) {
          return '<div class="sg-duel-evt sg-duel-evt-dodge">' + evt.defenderName + ' 闪避了 ' + evt.attackerName + ' 的攻击！</div>';
        }
        return '<div class="sg-duel-evt sg-duel-evt-attack">' + evt.attackerName + ' 攻击 ' + evt.defenderName + '，造成 <b>' + evt.damage + '</b> 点伤害' + (evt.crit ? ' <span class="sg-duel-crit">暴击！</span>' : '') + '</div>';
      }
      if (evt.type === 'defend') {
        return '<div class="sg-duel-evt sg-duel-evt-defend">' + evt.heroName + ' 摆出防御架势</div>';
      }
      if (evt.type === 'skill') {
        var dmg = 0;
        for (var i = 0; i < evt.effects.length; i++) {
          if (evt.effects[i].type === 'damage') dmg = evt.effects[i].value;
        }
        return '<div class="sg-duel-evt sg-duel-evt-skill sg-duel-evt-' + evt.element + '">' + evt.casterName + ' 施展「' + evt.skillName + '」' + (dmg > 0 ? '，对 ' + evt.targetName + ' 造成 <b>' + dmg + '</b> 点伤害' : '') + '</div>';
      }
      if (evt.type === 'retreat') {
        return '<div class="sg-duel-evt sg-duel-evt-retreat">' + evt.heroName + ' 撤退了！</div>';
      }
      if (evt.type === 'skip') {
        return '<div class="sg-duel-evt sg-duel-evt-skip">眩晕中，跳过行动</div>';
      }
      return '';
    },

    // 渲染行动按钮
    _renderActionButtons: function(state, actor) {
      var hero = state[actor];
      var html = '<div class="sg-duel-action-btns">';

      html += '<button class="sg-btn sg-btn-attack" data-action="attack">' +
                '<span class="sg-action-icon">⚔</span>攻击' +
              '</button>';

      html += '<button class="sg-btn sg-btn-defend" data-action="defend">' +
                '<span class="sg-action-icon">🛡</span>防御' +
              '</button>';

      // 技能按钮
      if (hero.data && hero.data.skills && hero.data.skills.length > 0) {
        html += '<div class="sg-duel-skill-btns">';
        for (var i = 0; i < hero.data.skills.length; i++) {
          var sId = hero.data.skills[i];
          var sData = window.SG.SKILLS_DATA[sId];
          if (!sData) continue;
          var canUse = hero.morale >= sData.spCost;
          html += '<button class="sg-btn sg-btn-skill ' + (canUse ? '' : 'sg-btn-disabled') + '" data-action="skill" data-skill="' + sId + '" ' + (canUse ? '' : 'disabled') + '>' +
                    sData.name + '(' + sData.spCost + ')' +
                  '</button>';
        }
        html += '</div>';
      }

      // 撤退
      html += '<button class="sg-btn sg-btn-retreat" data-action="retreat">撤退</button>';

      html += '</div>';
      return html;
    },

    // 渲染日志
    _renderLog: function(log) {
      if (!log || log.length === 0) return '<div class="sg-duel-log-empty">暂无记录</div>';
      var html = '';
      var start = Math.max(0, log.length - 5);
      for (var i = start; i < log.length; i++) {
        html += '<div class="sg-duel-log-item">' + log[i].msg + '</div>';
      }
      return html;
    },

    // 渲染结束信息
    _renderEndInfo: function(state) {
      if (!state.winner) return '';
      var winnerName = state.winner === 'attacker' ? state.attacker.data.name : state.defender.data.name;
      var loserName = state.winner === 'attacker' ? state.defender.data.name : state.attacker.data.name;
      var reason = '';
      if (state.endReason === 'ko') reason = '被击败';
      else if (state.endReason === 'retreat') reason = '撤退';

      return '<div class="sg-duel-result">' +
        '<div class="sg-duel-result-icon">🏆</div>' +
        '<div class="sg-duel-result-text"><b>' + winnerName + '</b> 获胜！</div>' +
        '<div class="sg-duel-result-sub">' + loserName + ' ' + reason + '</div>' +
      '</div>';
    },

    // AI思考提示
    _showAIThinking: function() {
      if (!this.overlay) return;
      var actionArea = this.overlay.querySelector('.sg-duel-actions');
      if (actionArea) {
        actionArea.innerHTML = '<div class="sg-duel-ai-thinking">对手思考中...</div>';
      }
    },

    // 绑定事件
    _bindEvents: function() {
      var self = this;
      if (!this.overlay) return;

      // 行动按钮
      var actionBtns = this.overlay.querySelectorAll('.sg-duel-action-btns [data-action]');
      for (var i = 0; i < actionBtns.length; i++) {
        actionBtns[i].onclick = (function(btn) {
          return function(e) {
            e.preventDefault();
            e.stopPropagation();
            var action = btn.getAttribute('data-action');
            var skillId = btn.getAttribute('data-skill') || null;
            if (self.onAction) {
              self.onAction(action, skillId);
            }
          };
        })(actionBtns[i]);
      }

      // 关闭按钮
      var closeBtn = this.overlay.querySelector('#duel_close');
      if (closeBtn) {
        closeBtn.onclick = function() {
          self.close();
          if (self._pendingCallback) {
            self._pendingCallback();
            self._pendingCallback = null;
          }
        };
      }
    },

    _unbindEvents: function() {
      // 事件绑定在overlay内，移除overlay时自动失效
    }
  };

  window.SG.DuelUI = DuelUI;

})();
