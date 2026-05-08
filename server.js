const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3001);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon'
};

function send(response, statusCode, body, contentType) {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

function resolveFilePath(requestUrl) {
  const parsedUrl = new URL(requestUrl, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const relativePath = safePath === '/' ? '/index.html' : safePath;
  const filePath = path.join(PUBLIC_DIR, relativePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return null;
  }

  return filePath;
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET') {
    send(response, 405, 'Method Not Allowed', 'text/plain; charset=utf-8');
    return;
  }

  const filePath = resolveFilePath(request.url);
  if (!filePath) {
    send(response, 403, 'Forbidden', 'text/plain; charset=utf-8');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(response, 404, 'Not Found', 'text/plain; charset=utf-8');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    send(response, 200, data, MIME_TYPES[extension] || 'application/octet-stream');
  });
});

server.listen(PORT, () => {
  console.log(`KTX 빈자리 확인 도우미가 실행 중입니다: http://localhost:${PORT}`);
  console.log('종료하려면 터미널에서 Ctrl+C를 누르세요.');
});
