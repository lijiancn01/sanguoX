/**
 * 量化「按人物名搜索百度图片」的准确率。
 *
 * 对每个武将用多种搜索词各取 top-N 候选，下载后拼成一张对照网格，
 * 供人眼一次性判断「哪种搜索词更准」以及「自动匹配到底能不能用」。
 *
 * 输出: scripts/_probe-grid/<人物>.jpg
 * 用法: node scripts/probe-portrait-grid.mjs [人物名...]
 */
import { writeFile, mkdir } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const OUT = 'scripts/_probe-grid';

/** 候选搜索词模板，按直觉从"最可能准"到"最可能偏"排列 */
const QUERIES = [
  (n) => `${n} 三国志 立绘 全身`,
  (n) => `三国杀 ${n}`,
  (n) => `${n} 三国 立绘`,
  (n) => `${n} 真三国无双`
];

const names = process.argv.slice(2).length ? process.argv.slice(2) : ['曹操', '张飞', '吕布', '赵云'];

async function search(word, rn) {
  const u = 'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592'
    + '&fp=result&ie=utf-8&pn=0&rn=' + rn + '&word=' + encodeURIComponent(word);
  const res = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); }
  catch { json = JSON.parse(txt.replace(/[\u0000-\u001f]+/g, ' ')); }
  return (json.data || []).filter((d) => d && (d.thumbURL || d.middleURL));
}

async function grab(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const m = buf.subarray(0, 4).toString('hex');
  if (!m.startsWith('ffd8ff') && !m.startsWith('89504e47')) throw new Error('非图片');
  return buf;
}

await mkdir(OUT, { recursive: true });
const manifest = [];

for (const name of names) {
  const cells = [];
  for (let qi = 0; qi < QUERIES.length; qi++) {
    const q = QUERIES[qi](name);
    let list = [];
    try { list = await search(q, 2); } catch (e) { /* 搜索失败留空 */ }
    for (const d of list.slice(0, 2)) {
      const url = d.middleURL || d.thumbURL;
      try {
        const buf = await grab(url);
        const ext = url.includes('f=PNG') || url.includes('.png') ? 'png' : 'jpg';
        const f = `${OUT}/${name}_q${qi}_${cells.length}.${ext}`;
        await writeFile(f, buf);
        cells.push({ file: f, query: q });
      } catch (e) { /* 单张失败不影响整体 */ }
    }
  }
  manifest.push({ name, cells });
  console.log(`${name}: 抓到 ${cells.length} 张候选`);
}

await writeFile(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log('\n搜索词顺序:');
QUERIES.forEach((f, i) => console.log(`  q${i} = ${f('X')}`));
console.log(`\n下一步: python scripts/make-portrait-grid.py 生成对照图`);