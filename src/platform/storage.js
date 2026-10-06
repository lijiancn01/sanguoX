/**
 * 三国群英传 - 存档平台抽象层
 *
 * 桌面版（Tauri）：经 IPC 调用 Rust 侧 rusqlite，数据库文件位于应用数据目录。
 * 浏览器开发态：退化为 localStorage，便于不开 Tauri 窗口调试 UI。
 * 上层只依赖本文件暴露的接口，不感知底层存储。
 * @author jian.li
 */

const IS_TAURI = typeof window !== 'undefined' &&
  (!!window.__TAURI_INTERNALS__ || !!window.__TAURI__);

const LOCAL_KEY_PREFIX = 'sg3_save_';

/** 浏览器回退实现 */
const localBackend = {
  async save(slot, payload) {
    try {
      window.localStorage.setItem(LOCAL_KEY_PREFIX + slot, JSON.stringify(payload));
      return { ok: true, msg: '' };
    } catch (e) {
      return { ok: false, msg: `本地存储写入失败：${e.message}` };
    }
  },
  async load(slot) {
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY_PREFIX + slot);
      return raw ? { ok: true, data: JSON.parse(raw) } : { ok: false, msg: '存档不存在' };
    } catch (e) {
      return { ok: false, msg: `存档解析失败：${e.message}` };
    }
  },
  async hasSave(slot) {
    try {
      return !!window.localStorage.getItem(LOCAL_KEY_PREFIX + slot);
    } catch (e) {
      return false;
    }
  },
  async listSlots() {
    const slots = [];
    for (let i = 0; i < 6; i++) {
      if (window.localStorage.getItem(LOCAL_KEY_PREFIX + i)) slots.push(i);
    }
    return slots;
  },
  async deleteSave(slot) {
    try {
      window.localStorage.removeItem(LOCAL_KEY_PREFIX + slot);
      return { ok: true, msg: '' };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  }
};

/** Tauri + SQLite 实现 */
let tauriBackend = null;
if (IS_TAURI) {
  tauriBackend = {
    async save(slot, payload) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke('save_game', { slot, payloadJson: JSON.stringify(payload) });
    },
    async load(slot) {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke('load_game', { slot });
      if (!res || !res.ok) return { ok: false, msg: (res && res.msg) || '读取存档失败' };
      try {
        return { ok: true, data: JSON.parse(res.payloadJson) };
      } catch (e) {
        return { ok: false, msg: `存档内容损坏：${e.message}` };
      }
    },
    async hasSave(slot) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke('has_save', { slot });
    },
    async listSlots() {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke('list_saves');
    },
    async deleteSave(slot) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke('delete_save', { slot });
    }
  };
}

/** 当前使用的后端 */
const backend = tauriBackend || localBackend;

/**
 * 保存进度到指定槽位。
 * @param {number} slot
 * @param {object} payload GameData.toJSON() 的结果
 * @returns {Promise<{ok: boolean, msg: string}>}
 */
export function saveGame(slot, payload) {
  return backend.save(slot, payload);
}

/**
 * 读取指定槽位的进度。
 * @param {number} slot
 * @returns {Promise<{ok: boolean, data?: object, msg?: string}>}
 */
export function loadGame(slot) {
  return backend.load(slot);
}

/**
 * 判断槽位是否存在存档。
 * @param {number} slot
 * @returns {Promise<boolean>}
 */
export function hasSave(slot) {
  return backend.hasSave(slot);
}

/**
 * 列出所有已占用槽位。
 * @returns {Promise<number[]>}
 */
export function listSaveSlots() {
  return backend.listSlots();
}

/**
 * 删除槽位存档。
 * @param {number} slot
 * @returns {Promise<{ok: boolean, msg: string}>}
 */
export function deleteSave(slot) {
  return backend.deleteSave(slot);
}

/**
 * 当前是否为 Tauri 桌面环境。
 * @returns {boolean}
 */
export function isDesktop() {
  return IS_TAURI;
}

/** 可用存档槽位数 */
export const MAX_SLOTS = 6;