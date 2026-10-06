//! 存档持久化：基于 rusqlite 的 SQLite 单文件存储。
//!
//! 数据库位于应用数据目录（`%APPDATA%\<identifier>\sanguox.db`），
//! 与 WebView 的 localStorage 相比，独立于浏览器缓存清理，更适合单机存档。
//!
//! 前端 `src/platform/storage.js` 通过 IPC 调用本模块暴露的命令，
//! 契约（字段名）必须与前端保持一致：
//!   - save_game(slot, payloadJson) -> { ok, msg }
//!   - load_game(slot)              -> { ok, msg, payloadJson }
//!   - has_save(slot)               -> bool
//!   - list_saves()                 -> Vec<i64>
//!   - delete_save(slot)            -> { ok, msg }

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

/// 存档操作结果，与前端 `{ ok, msg }` 约定一致。
#[derive(Debug, Serialize)]
pub struct SaveResult {
    pub ok: bool,
    pub msg: String,
    /// 仅 load_game 返回；其余命令为 None，序列化为 null。
    #[serde(rename = "payloadJson", skip_serializing_if = "Option::is_none")]
    pub payload_json: Option<String>,
}

impl SaveResult {
    fn ok() -> Self {
        Self { ok: true, msg: String::new(), payload_json: None }
    }

    fn err(msg: impl Into<String>) -> Self {
        Self { ok: false, msg: msg.into(), payload_json: None }
    }
}

/// 被 Tauri 托管的数据库句柄。
pub struct Db(pub Mutex<Connection>);

/// 打开（必要时创建）数据库并建表。
///
/// # Errors
/// 应用数据目录不可用、或 SQLite 打开/建表失败时返回错误字符串。
pub fn init(app: &AppHandle) -> Result<Db, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位应用数据目录：{e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("无法创建数据目录 {dir:?}：{e}"))?;

    let db_path: PathBuf = dir.join("sanguox.db");
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("无法打开数据库 {db_path:?}：{e}"))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS saves (
             slot       INTEGER PRIMARY KEY,
             payload    TEXT    NOT NULL,
             updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
         )",
        [],
    )
    .map_err(|e| format!("建表失败：{e}"))?;

    Ok(Db(Mutex::new(conn)))
}

/// 取得数据库连接的互斥锁，锁中毒时给出可读错误。
fn lock<'a>(
    db: &'a State<'_, Db>,
) -> Result<std::sync::MutexGuard<'a, Connection>, String> {
    db.0.lock().map_err(|e| format!("数据库连接不可用：{e}"))
}

/// 保存存档到指定槽位（存在则覆盖）。
#[tauri::command]
pub fn save_game(
    db: State<'_, Db>,
    slot: i64,
    payload_json: String,
) -> SaveResult {
    let conn = match lock(&db) {
        Ok(c) => c,
        Err(e) => return SaveResult::err(e),
    };

    let res = conn.execute(
        "INSERT INTO saves (slot, payload, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(slot) DO UPDATE SET
             payload    = excluded.payload,
             updated_at = excluded.updated_at",
        params![slot, payload_json],
    );

    match res {
        Ok(_) => SaveResult::ok(),
        Err(e) => SaveResult::err(format!("写入存档失败：{e}")),
    }
}

/// 读取指定槽位存档。
#[tauri::command]
pub fn load_game(db: State<'_, Db>, slot: i64) -> SaveResult {
    let conn = match lock(&db) {
        Ok(c) => c,
        Err(e) => return SaveResult::err(e),
    };

    let row: Result<String, _> = conn.query_row(
        "SELECT payload FROM saves WHERE slot = ?1",
        params![slot],
        |r| r.get(0),
    );

    match row {
        Ok(payload) => SaveResult {
            ok: true,
            msg: String::new(),
            payload_json: Some(payload),
        },
        Err(rusqlite::Error::QueryReturnedNoRows) => SaveResult::err("存档不存在"),
        Err(e) => SaveResult::err(format!("读取存档失败：{e}")),
    }
}

/// 判断槽位是否存在存档。
#[tauri::command]
pub fn has_save(db: State<'_, Db>, slot: i64) -> Result<bool, String> {
    let conn = lock(&db)?;
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM saves WHERE slot = ?1",
            params![slot],
            |r| r.get(0),
        )
        .map_err(|e| format!("查询存档失败：{e}"))?;
    Ok(count > 0)
}

/// 列出所有已占用槽位（升序）。
#[tauri::command]
pub fn list_saves(db: State<'_, Db>) -> Result<Vec<i64>, String> {
    let conn = lock(&db)?;
    let mut stmt = conn
        .prepare("SELECT slot FROM saves ORDER BY slot ASC")
        .map_err(|e| format!("查询存档列表失败：{e}"))?;
    let rows = stmt
        .query_map([], |r| r.get::<_, i64>(0))
        .map_err(|e| format!("查询存档列表失败：{e}"))?;

    let mut slots = Vec::new();
    for s in rows {
        slots.push(s.map_err(|e| format!("读取存档槽位失败：{e}"))?);
    }
    Ok(slots)
}

/// 删除槽位存档。
#[tauri::command]
pub fn delete_save(db: State<'_, Db>, slot: i64) -> SaveResult {
    let conn = match lock(&db) {
        Ok(c) => c,
        Err(e) => return SaveResult::err(e),
    };

    match conn.execute("DELETE FROM saves WHERE slot = ?1", params![slot]) {
        Ok(0) => SaveResult::err("存档不存在"),
        Ok(_) => SaveResult::ok(),
        Err(e) => SaveResult::err(format!("删除存档失败：{e}")),
    }
}
