/**
 * 端到端验证：通过 Tauri IPC 实际调用存档命令，
 * 校验参数名（camelCase）与返回字段名是否与前端 storage.js 契约一致。
 *
 * 结果通过 save_game 自身写回数据库（槽位 42），
 * 便于在无 WebView 调试器的情况下用外部工具读取验证报告。
 */
import { invoke } from '@tauri-apps/api/core';

const REPORT_SLOT = 42;
const RT_SLOT = 43;

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
}

async function main() {
  if (!window.__TAURI_INTERNALS__) {
    console.log('[verify] 非 Tauri 环境，跳过 IPC 验证');
    return;
  }

  try {
    // 1. list_saves（无参数）
    const before = await invoke('list_saves');
    check('list_saves 返回数组', Array.isArray(before), before);

    // 2. has_save(slot) —— 校验 slot 参数
    const has0 = await invoke('has_save', { slot: RT_SLOT });
    check('has_save 返回布尔', typeof has0 === 'boolean', has0);

    // 3. save_game(slot, payloadJson) —— 校验 camelCase 参数名 payloadJson
    const payload = { version: 2, turn: 7, playerFaction: 'shu', note: 'IPC 往返验证' };
    const saveRes = await invoke('save_game', {
      slot: RT_SLOT,
      payloadJson: JSON.stringify(payload)
    });
    check('save_game 返回 ok=true', saveRes && saveRes.ok === true, saveRes);

    // 4. has_save 应为 true
    const has1 = await invoke('has_save', { slot: RT_SLOT });
    check('保存后 has_save=true', has1 === true, has1);

    // 5. load_game —— 校验返回字段名 payloadJson
    const loadRes = await invoke('load_game', { slot: RT_SLOT });
    check('load_game 返回 ok=true', loadRes && loadRes.ok === true,
      loadRes && { ok: loadRes.ok });
    check('load_game 含 payloadJson 字段',
      loadRes && typeof loadRes.payloadJson === 'string',
      loadRes && Object.keys(loadRes));
    if (loadRes && loadRes.payloadJson) {
      const parsed = JSON.parse(loadRes.payloadJson);
      check('往返数据一致',
        parsed.turn === 7 && parsed.playerFaction === 'shu', parsed);
    }

    // 6. list_saves 应包含该槽位
    const listRes = await invoke('list_saves');
    check('list_saves 含新槽位', listRes.includes(RT_SLOT), listRes);

    // 7. 读取不存在槽位应返回 ok=false 而非抛错
    const missRes = await invoke('load_game', { slot: 999 });
    check('读取不存在槽位 ok=false', missRes && missRes.ok === false, missRes);

    // 8. delete_save
    const delRes = await invoke('delete_save', { slot: RT_SLOT });
    check('delete_save 返回 ok=true', delRes && delRes.ok === true, delRes);

    // 9. 删除后不存在
    const has2 = await invoke('has_save', { slot: RT_SLOT });
    check('删除后 has_save=false', has2 === false, has2);

    // 10. 删除不存在槽位应返回 ok=false
    const delMiss = await invoke('delete_save', { slot: 999 });
    check('删除不存在槽位 ok=false', delMiss && delMiss.ok === false, delMiss);
  } catch (e) {
    check('执行过程无异常', false, String(e));
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;
  const report = { pass, fail, total: results.length, results, ts: new Date().toISOString() };

  // 用被测命令自身落盘报告，便于外部读取
  try {
    await invoke('save_game', {
      slot: REPORT_SLOT,
      payloadJson: JSON.stringify(report)
    });
  } catch (e) {
    console.error('[verify] 报告落盘失败:', e);
  }

  console.log(`[verify] ${pass}/${results.length} 通过`);
  for (const r of results) {
    console.log(`[verify] ${r.pass ? 'PASS' : 'FAIL'} ${r.name}`, r.detail);
  }
}

main();
