/**
 * 探测：按「人物名 + 三国 立绘」搜索百度图片，看返回的图是否真的是该人物。
 *
 * 目的是在批量下载 41 名武将立绘之前，先量化「自动匹配」的可靠性。
 * 只输出候选图的尺寸与来源，不做任何判定结论——判定需要人眼看图。
 */
const NAMES = process.argv.slice(2);
const targets = NAMES.length ? NAMES : ['曹操', '关羽', '吕布', '赵云'];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function search(word, rn = 6) {
  const u = 'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592'
    + '&fp=result&ie=utf-8&pn=0&rn=' + rn
    + '&word=' + encodeURIComponent(word);
  const res = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const txt = await res.text();
  // 百度返回的 JSON 里偶有未转义控制字符，直接 parse 会抛
  let json;
  try { json = JSON.parse(txt); }
  catch { json = JSON.parse(txt.replace(/[\u0000-\u001f]+/g, ' ')); }
  return (json.data || []).filter((d) => d && (d.thumbURL || d.middleURL || d.objURL));
}

for (const name of targets) {
  console.log('\n===== ' + name + ' =====');
  for (const q of [name + ' 三国 立绘', name + ' 三国志 人物']) {
    let list;
    try { list = await search(q); } catch (e) { console.log(`  [${q}] 搜索失败: ${e.message}`); continue; }
    console.log(`  [${q}] 命中 ${list.length} 条`);
    for (const d of list.slice(0, 3)) {
      const url = d.middleURL || d.thumbURL;
      console.log(`    ${d.width || '?'}x${d.height || '?'}  ${String(d.fromPageTitleEnc || '').slice(0, 40)}`);
      console.log(`      ${url.slice(0, 110)}`);
    }
  }
}
console.log('\n注意：以上仅为候选，是否真的是该人物必须人眼确认。');