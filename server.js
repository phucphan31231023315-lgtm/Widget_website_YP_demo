// ============================================
//  Dev Server với Proxy tránh CORS cho N8N
//  Chạy: node server.js
// ============================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const N8N_WEBHOOK = 'https://phanphuc.app.n8n.cloud/webhook/6e2b9f1f-f157-4b20-8026-4a6bf0f47146/chat';

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
};

// Poll N8N kết quả async bằng resumeToken
// N8N endpoint: GET /webhook-waiting/[resumeToken]
async function pollN8NResult(resumeToken, maxAttempts = 30, intervalMs = 2000) {
  const baseUrl = 'https://phanphuc.app.n8n.cloud';
  const pollUrl = `${baseUrl}/webhook-waiting/${resumeToken}`;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, i === 0 ? 1000 : intervalMs));
    try {
      console.log(`[Poll] Attempt ${i + 1}/${maxAttempts} → ${pollUrl}`);
      const r = await fetch(pollUrl);
      const text = await r.text();
      console.log(`[Poll] Status: ${r.status} | Body: ${text.substring(0, 200)}`);

      if (r.status === 200) {
        try { return JSON.parse(text); } catch { return { output: text }; }
      }
      // 404 = chưa xong, tiếp tục poll
    } catch (err) {
      console.error(`[Poll] Error: ${err.message}`);
    }
  }
  return { output: 'Xin lỗi, phản hồi mất quá nhiều thời gian. Vui lòng thử lại.' };
}



const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname  = parsedUrl.pathname;

  // ===== CORS headers cho mọi response =====
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ===== Proxy API: POST /api/chat → N8N =====
  if (pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      console.log(`[Proxy] → N8N | payload: ${body}`);
      try {
        // Gửi request đến N8N
        const n8nRes = await fetch(N8N_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
        });
        const rawText = await n8nRes.text();
        console.log(`[Proxy] ← N8N | status: ${n8nRes.status} | raw: ${rawText.substring(0, 300)}`);

        let parsed;
        try { parsed = JSON.parse(rawText); } catch { parsed = null; }

        // Nếu N8N trả về async (executionStarted + resumeToken) → poll lấy kết quả
        if (parsed && parsed.executionStarted && parsed.resumeToken) {
          console.log(`[Proxy] N8N async mode, polling resumeToken: ${parsed.resumeToken}`);
          const result = await pollN8NResult(parsed.resumeToken);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // Nếu N8N trả về đồng bộ → trả thẳng về client
        res.writeHead(n8nRes.status, { 'Content-Type': 'application/json' });
        res.end(rawText);
      } catch (err) {
        console.error('[Proxy] Lỗi kết nối N8N:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
      }
    });
    return;
  }

  // ===== Static File Server =====
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Ngăn directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  🚀 YẾN PHÁT BAO BÌ - Dev Server');
  console.log('  ================================');
  console.log(`  🌐 Website:  http://localhost:${PORT}`);
  console.log(`  🔗 Proxy:    http://localhost:${PORT}/api/chat → N8N`);
  console.log('');
  console.log('  Nhấn Ctrl+C để dừng server');
  console.log('');
});
