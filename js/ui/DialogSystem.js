// 三国群英传 - 对话框/事件系统
window.SG = window.SG || {};

(function() {
  'use strict';

  // 通知类型对应的样式
  var NOTIFICATION_CLASSES = {
    info: 'sg-notification-info',
    success: 'sg-notification-success',
    warning: 'sg-notification-warning',
    error: 'sg-notification-error'
  };

  var DialogSystem = {

    // 当前对话框DOM引用
    _currentDialog: null,

    // 通知计数器（用于唯一ID）
    _notifyId: 0,

    // ===== 显示模态对话框 =====
    // title: 标题文字
    // content: HTML内容字符串
    // buttons: [{text, onClick, className}] 按钮配置数组
    show: function(title, content, buttons) {
      // 先关闭已有对话框
      this.hide();

      // 遮罩层
      var overlay = document.createElement('div');
      overlay.className = 'sg-dialog-overlay';
      overlay.id = 'sgDialogOverlay';

      // 对话框主体
      var dialog = document.createElement('div');
      dialog.className = 'sg-dialog';
      dialog.id = 'sgDialog';

      // 标题栏
      var titleEl = document.createElement('div');
      titleEl.className = 'sg-dialog-title';
      titleEl.textContent = title;
      dialog.appendChild(titleEl);

      // 内容区域
      var contentEl = document.createElement('div');
      contentEl.className = 'sg-dialog-content';
      if (typeof content === 'string') {
        contentEl.innerHTML = content;
      }
      dialog.appendChild(contentEl);

      // 按钮区域
      if (buttons && buttons.length > 0) {
        var btnArea = document.createElement('div');
        btnArea.className = 'sg-dialog-buttons';
        for (var i = 0; i < buttons.length; i++) {
          var btnCfg = buttons[i];
          var btn = document.createElement('button');
          btn.className = btnCfg.className || 'sg-btn';
          btn.textContent = btnCfg.text;
          // 闭包绑定点击事件
          (function(handler) {
            btn.onclick = function() {
              if (handler) handler();
            };
          })(btnCfg.onClick);
          btnArea.appendChild(btn);
        }
        dialog.appendChild(btnArea);
      }

      // 点击遮罩关闭（可选）
      overlay.onclick = function(e) {
        if (e.target === overlay) {
          DialogSystem.hide();
        }
      };

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      this._currentDialog = overlay;
    },

    // ===== 关闭当前对话框 =====
    hide: function() {
      if (this._currentDialog) {
        if (this._currentDialog.parentNode) {
          this._currentDialog.parentNode.removeChild(this._currentDialog);
        }
        this._currentDialog = null;
      }
      // 兜底：直接查找并移除
      var overlay = document.getElementById('sgDialogOverlay');
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    },

    // ===== 显示随机事件对话框 =====
    // eventData: { title, description, choices: [{text, effect}] }
    showEvent: function(eventData) {
      if (!eventData) return;

      var content = '<div class="sg-event-content">';
      content += '<div class="sg-event-desc">' + (eventData.description || '') + '</div>';

      if (eventData.choices && eventData.choices.length > 0) {
        content += '<div class="sg-event-choices">';
        for (var i = 0; i < eventData.choices.length; i++) {
          var choice = eventData.choices[i];
          content += '<button class="sg-btn sg-btn-primary sg-event-choice" data-choice-idx="' + i + '">' + choice.text + '</button>';
        }
        content += '</div>';
      } else {
        // 无选项时显示确认按钮
        content += '<button class="sg-btn sg-event-confirm">确定</button>';
      }
      content += '</div>';

      var buttons = []; // 不使用通用按钮区，选项内嵌在content中

      this.show(eventData.title || '事件', content, buttons);

      // 绑定选项点击事件
      var choiceBtns = document.querySelectorAll('.sg-event-choice');
      for (var j = 0; j < choiceBtns.length; j++) {
        (function(btn) {
          btn.onclick = function() {
            var idx = parseInt(btn.getAttribute('data-choice-idx'), 10);
            if (eventData.choices && eventData.choices[idx] && typeof eventData.choices[idx].effect === 'function') {
              eventData.choices[idx].effect();
            }
            DialogSystem.hide();
          };
        })(choiceBtns[j]);
      }

      // 绑定确定按钮
      var confirmBtn = document.querySelector('.sg-event-confirm');
      if (confirmBtn) {
        confirmBtn.onclick = function() {
          DialogSystem.hide();
        };
      }
    },

    // ===== 简单确认对话框 =====
    showConfirm: function(message, onConfirm) {
      var content = '<div class="sg-confirm-message">' + message + '</div>';

      var buttons = [
        {
          text: '确定',
          onClick: function() {
            DialogSystem.hide();
            if (onConfirm) onConfirm();
          },
          className: 'sg-btn sg-btn-primary'
        },
        {
          text: '取消',
          onClick: function() {
            DialogSystem.hide();
          },
          className: 'sg-btn'
        }
      ];

      this.show('确认', content, buttons);
    },

    // ===== 浮动通知 =====
    // type: 'info', 'success', 'warning', 'error'
    // 3秒后自动消失
    showNotification: function(text, type) {
      var notifyType = type || 'info';
      var cls = NOTIFICATION_CLASSES[notifyType] || NOTIFICATION_CLASSES.info;

      // 查找或创建通知容器
      var container = document.getElementById('sgNotifyContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'sgNotifyContainer';
        container.style.cssText = 'position:fixed;top:50px;right:20px;z-index:10001;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
        document.body.appendChild(container);
      }

      var notify = document.createElement('div');
      notify.className = 'sg-notification ' + cls;
      notify.id = 'sgNotify_' + (++this._notifyId);
      notify.textContent = text;
      notify.style.pointerEvents = 'auto';
      container.appendChild(notify);

      // 3秒后自动消失
      var notifyId = notify.id;
      setTimeout(function() {
        var el = document.getElementById(notifyId);
        if (el) {
          el.style.opacity = '0';
          el.style.transition = 'opacity 0.4s';
          setTimeout(function() {
            if (el.parentNode) el.parentNode.removeChild(el);
          }, 400);
        }
      }, 3000);
    }
  };

  window.SG.DialogSystem = DialogSystem;

})();
