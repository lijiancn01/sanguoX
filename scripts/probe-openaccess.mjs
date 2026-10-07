/**
 * 探测开放许可（CC0）博物馆 API 对三国人物的覆盖情况。
 *
 * 目的：判断「合规素材」能否覆盖游戏中的人物，作为百度图片搜索的替代方案。
 * 只读探测，不下载文件。
 *
 * 用法: node scripts/probe-openaccess.mjs
 */
import { HEROES_DATA } from '../src/data/heroes.js';

const SOURCES = [
  {
    name: 'Cleveland',
    url: (q) => `https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(q)}&limit=10&has_image=1`,
    pick: (j) => (j.data || []).map((a) => ({
      id: a.id,
      title: a.title,
      license: a.share_license_status,
      creators: (a.creators || []).map((c) => c.description).join('; '),
      culture: Array.isArray(a.culture) ? a.culture.join(', ') : (a.culture || ''),
      image: a.images && a.images.web ? a.images.web.url : null,
      type: a.type
    }))
  },
  {
    name: 'AIC',
    url: (q) => `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&limit=10&fields=id,title,image_id,is_public_domain,artist_display,date_display,medium_display`,
    pick: (j) => (j.data || []).map((a) => ({
      id: a.id,
      title: a.title,
      license: a.is_public_domain ? 'CC0' : 'NOT-PD',
      creators: a.artist_display,
      culture: a.date_display,
      image: a.image_id ? `https://www.artic.edu/iiif/2/${a.image_id}/full/400,/0/default.jpg` : null,
      type: a.medium_display
    }))
  }
];

async function fetchJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'sanguox-asset-probe/1.0 (local evaluation)' }
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { json: await res.json() };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(t);
  }
}

// 只探测主要人物，控制请求量
const targets = HEROES_DATA.filter((h) => ['wei', 'shu', 'wu'].includes(h.faction));
console.log(`探测 ${targets.length} 名主要人物 × ${SOURCES.length} 个数据源\n`);

const summary = [];
for (const src of SOURCES) {
  let ok = 0, cc0 = 0, err = 0;
  const hits = [];
  for (const h of targets) {
    const q = h.name;
    const r = await fetchJson(src.url(q));
    if (r.error) { err++; continue; }
    ok++;
    const items = src.pick(r.json).filter((x) => x.image);
    const usable = items.filter((x) => x.license === 'CC0');
    if (usable.length > 0) {
      cc0++;
      hits.push({ hero: h.name, items: usable.slice(0, 3) });
    }
  }
  summary.push({ src: src.name, ok, cc0, err, total: targets.length });
  console.log(`[${src.name}] 请求成功 ${ok}/${targets.length}，有 CC0 命中的人物 ${cc0}，失败 ${err}`);
  for (const h of hits) {
    console.log(`  ${h.hero}:`);
    for (const it of h.items) {
      console.log(`    - ${String(it.title).slice(0, 60)} | ${it.license} | ${String(it.creators || '').slice(0, 40)}`);
    }
  }
  console.log('');
}

console.log('=== 汇总 ===');
for (const s of summary) {
  console.log(`${s.src.padEnd(12)} CC0 覆盖 ${s.cc0}/${s.total} 人物`);
}