const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  let filePath = path.join(__dirname, url === '/' ? 'index.html' : url);
  let ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found: ' + url);
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const PORT = parseInt(process.env.PORT || process.argv[2] || 8080, 10);
server.listen(PORT, '0.0.0.0', () => {
  console.log('Server running at http://localhost:' + PORT);
});
