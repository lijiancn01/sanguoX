/**
 * 列出页面所有网络请求，定位 404 的具体 URL。
 */
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.argv[2] || 9500);

const res = await fetch(`http://127.0.0.1:${PORT}/json`);
const page = (await res.json()).find((x) => x.type === 'page');
console.log('target:', page.url);

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const requests = [];

ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Network.responseReceived') {
    requests.push({
      url: m.params.response.url,
      status: m.params.response.status,
      type: m.params.type
    });
  }
});

function send(method, params = {}) {
  const i = ++id;
  return new Promise((r, j) => {
    pending.set(i, (m) => (m.error ? j(new Error(JSON.stringify(m.error))) : r(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}

await new Promise((r) => ws.addEventListener('open', r, { once: true }));
await send('Network.enable');
await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await sleep(6000);

console.log('\n=== 非 2xx 响应 ===');
for (const q of requests) {
  if (q.status >= 400) console.log(`  ${q.status}  ${q.type}  ${q.url}`);
}

console.log('\n=== 全部请求（前 25 条）===');
for (const q of requests.slice(0, 25)) {
  console.log(`  ${q.status}  ${q.type}  ${q.url}`);
}

ws.close();
