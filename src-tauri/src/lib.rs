//! 三国群英传 - Windows 单机版桌面外壳。
//!
//! 前端为 Phaser 3 + Vite（`../dist`），本 crate 只负责：
//!   1. 创建主窗口
//!   2. 提供存档持久化（SQLite，见 `storage` 模块）
//!
//! 文本输入与确认对话框由前端 DOM 覆盖层实现（WebView2 不支持
//! `window.prompt`，且 tauri-plugin-dialog 无文本输入 API），
//! 故此处不注册 dialog 插件。

mod storage;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 初始化存档数据库并托管给 Tauri 状态
            let db = storage::init(app.handle())
                .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            app.manage(db);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            storage::save_game,
            storage::load_game,
            storage::has_save,
            storage::list_saves,
            storage::delete_save,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
