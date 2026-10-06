/** 校验城市邻接表：单向边、孤立城、连通性 */
import { CITIES_DATA } from '../src/data/cities.js';

const adj = {};
const ids = [];
const list = Array.isArray(CITIES_DATA) ? CITIES_DATA : Object.values(CITIES_DATA);
for (const c of list) {
  ids.push(c.id);
  adj[c.id] = (c.adjacent || []).slice();
}
console.log('城市数:', ids.length);

let asym = 0;
for (const id of ids) {
  for (const a of adj[id]) {
    if (!adj[a]) { console.log(`  ! ${id} 指向不存在的城市 ${a}`); asym++; continue; }
    if (!adj[a].includes(id)) { console.log(`  单向边: ${id} -> ${a}`); asym++; }
  }
}
console.log('单向边/无效边:', asym);

const isolated = ids.filter((id) => adj[id].length === 0);
console.log('孤立城市:', isolated.length ? isolated.join(',') : '无');

// 连通性：从长安 BFS
const seen = new Set(['changan']);
const q = ['changan'];
while (q.length) {
  const cur = q.shift();
  for (const a of adj[cur] || []) if (!seen.has(a)) { seen.add(a); q.push(a); }
}
const unreachable = ids.filter((id) => !seen.has(id));
console.log('从长安不可达:', unreachable.length ? unreachable.join(',') : '无');

// 江东片区：谁与建业/会稽/吴相连
for (const id of ['jianye', 'kuaiji', 'wu', 'shouchun', 'chaisang', 'lujiang']) {
  if (adj[id]) console.log(`  ${id} 相邻: ${adj[id].join(',') || '（无）'}`);
}