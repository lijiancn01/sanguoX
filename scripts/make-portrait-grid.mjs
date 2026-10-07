/**
 * 生成候选立绘对照网格（用 headless Chrome 截图，因本机 Python 被禁止写文件）。
 *
 * 读取 scripts/_probe-grid/manifest.json，按「人物 × 搜索词」排布候选图，
 * 输出 scripts/_probe-grid/grid.png 供人眼判断搜索相关性。
 */
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const OUT = 'scripts/_probe-grid';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const manifest = JSON.parse(await readFile(`${OUT}/manifest.json`, 'utf8'));
// 搜索词是「按人物名生成的」，每个人的 query 字符串都不同，
// 因此不能按 query 文本分组，只能按 q 序号（文件名里的 _q<N>_）对齐。
const qIndexOf = (f) => {
  const m = /_q(\d+)_/.exec(f);
  return m ? Number(m[1]) : -1;
};
const nQueries = Math.max(...manifest.flatMap((e) => e.cells.map((c) => qIndexOf(c.file)))) + 1;
// 表头用第一个人物的搜索词做样例，并把名字替换成占位符，避免误导
const headers = [];
for (let i = 0; i < nQueries; i++) {
  const sample = manifest[0].cells.find((c) => qIndexOf(c.file) === i);
  headers.push(sample ? sample.query.replace(manifest[0].name, '〈人物〉') : `q${i}`);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 图片必须用绝对 file:// URL：headless 截图时相对路径偶发解析失败
const abs = (f) => 'file:///' + process.cwd().replace(/\\/g, '/') + '/' + f;

const head = headers.map((q) => `<th>${esc(q)}</th>`).join('');
const rows = manifest.map((e) => {
  const byQ = {};
  for (const c of e.cells) (byQ[qIndexOf(c.file)] ||= []).push(c.file);
  const tds = headers.map((_, i) => {
    const imgs = (byQ[i] || []).map((f) => `<img src="${esc(abs(f))}">`).join('');
    return `<td>${imgs}</td>`;
  }).join('');
  return `<tr><th class="row">${esc(e.name)}</th>${tds}</tr>`;
}).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#1c1c1c;font:12px "Microsoft YaHei",sans-serif;color:#ddd}
table{border-collapse:collapse}
th,td{border:1px solid #444;padding:2px;vertical-align:middle;text-align:center}
th{background:#0a3a40;color:#bfefff;font-weight:normal;padding:4px}
th.row{background:#3c2800;color:#ffd700;width:60px}
td{width:300px;height:190px}
img{height:180px;margin:0 1px;object-fit:contain;vertical-align:middle}
</style></head><body><table><tr><th></th>${head}</tr>${rows}</table></body></html>`;

await writeFile(`${OUT}/_grid.html`, html, 'utf8');
const png = `${OUT}/grid.png`;
await run(CHROME, [
  '--headless', '--disable-gpu', '--hide-scrollbars',
  // 等图片解码完成再截图；虚拟时间预算避免截到空白占位
  '--virtual-time-budget=8000',
  `--screenshot=${process.cwd()}\\${png.replace(/\//g, '\\')}`,
  '--window-size=1280,1000',
  `file:///${process.cwd().replace(/\\/g, '/')}/${OUT}/_grid.html`
], { maxBuffer: 1 << 26 });

console.log('生成:', png);
console.log('搜索词顺序:');
headers.forEach((h, i) => console.log(`  q${i} = ${h}`));