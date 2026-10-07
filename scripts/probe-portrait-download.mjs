/**
 * 探测：百度图片缩略图能否直接下载，以及下载后是不是真图。
 * 仅下载到临时目录，供人眼确认，不写入正式资源目录。
 */
import { writeFile, mkdir } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const OUT = 'scripts/_probe-portraits';

async function search(word, rn = 4) {
  const u = 'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592'
    + '&fp=result&ie=utf-8&pn=0&rn=' + rn + '&word=' + encodeURIComponent(word);
  const res = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); }
  catch { json = JSON.parse(txt.replace(/[\u0000-\u001f]+/g, ' ')); }
  return (json.data || []).filter((d) => d && (d.thumbURL || d.middleURL));
}

await mkdir(OUT, { recursive: true });

for (const name of ['曹操', '关羽', '张飞']) {
  const list = await search(name + ' 三国 立绘');
  const d = list[0];
  const url = d.middleURL || d.thumbURL;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://image.baidu.com/' } });
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = url.includes('f=PNG') || url.includes('.png') ? 'png' : 'jpg';
    const file = `${OUT}/${name}.${ext}`;
    await writeFile(file, buf);
    // 校验魔数，确认不是错误页
    const magic = buf.subarray(0, 4).toString('hex');
    const isJpg = magic.startsWith('ffd8ff');
    const isPng = magic.startsWith('89504e47');
    console.log(`${name}: HTTP ${r.status}  ${buf.length} 字节  魔数=${magic}  真图=${isJpg || isPng}  -> ${file}`);
  } catch (e) {
    console.log(`${name}: 下载失败 ${e.message}`);
  }
}