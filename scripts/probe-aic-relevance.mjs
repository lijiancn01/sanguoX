/**
 * 判定 AIC 搜索结果是否真的与人物相关。
 *
 * probe-openaccess.mjs 显示 AIC「CC0 覆盖 26/26 人物」，但每个英雄都返回
 * 同一批作品（Walter Shirlaw 的 Self-Portrait 等），疑似搜索引擎在无匹配时
 * 返回通用兜底结果，而不是真的命中。这类假阳性会导致下载一堆无关图片。
 *
 * 做法：对多个人物查询取结果 id 集合，比较重合度；并检查标题是否包含人物名。
 * 用法: node scripts/probe-aic-relevance.mjs
 */
const QUERIES = ['关羽', '张飞', '赵云', '曹操', '周瑜', '陆逊', '黄盖', '太史慈'];

async function search(q) {
  const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}` +
    `&limit=10&fields=id,title,is_public_domain,artist_display`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'sanguox-asset-probe/1.0' } });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const j = await res.json();
    return { items: j.data || [] };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(t); }
}

const results = {};
for (const q of QUERIES) {
  const r = await search(q);
  if (r.error) { console.log(`${q}: ${r.error}`); continue; }
  results[q] = r.items;
  console.log(`\n${q} (${r.items.length} 条):`);
  for (const it of r.items.slice(0, 5)) {
    console.log(`  [${it.id}] ${String(it.title).slice(0, 55)} | PD=${it.is_public_domain} | ${String(it.artist_display || '').slice(0, 35)}`);
  }
}

// 计算各查询结果 id 集合的重合情况
const keys = Object.keys(results);
console.log('\n=== 结果集重合度 ===');
if (keys.length >= 2) {
  const base = new Set(results[keys[0]].map((x) => x.id));
  for (let i = 1; i < keys.length; i++) {
    const cur = new Set(results[keys[i]].map((x) => x.id));
    const inter = [...base].filter((x) => cur.has(x)).length;
    console.log(`  ${keys[0]} vs ${keys[i]}: 重合 ${inter}/${base.size}`);
  }
  // 所有查询的交集
  let common = new Set(results[keys[0]].map((x) => x.id));
  for (const k of keys) {
    const cur = new Set(results[k].map((x) => x.id));
    common = new Set([...common].filter((x) => cur.has(x)));
  }
  console.log(`\n所有查询共有的结果 id: ${[...common].join(', ') || '(无)'}`);
  if (common.size > 0) {
    console.log('→ 这些是兜底结果，与人物无关；说明 AIC 全文检索并未真正命中人物名。');
  }
}

// 标题是否包含查询词（中文人物名）
console.log('\n=== 标题包含人物名的情况 ===');
for (const q of keys) {
  const hit = results[q].filter((x) => String(x.title).includes(q));
  console.log(`  ${q}: ${hit.length}/${results[q].length} 条标题含「${q}」`);
}