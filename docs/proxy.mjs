import http from 'node:http';
import https from 'node:https';

const PORT = 9960;
const TARGET = 'https://api.deepseek.com';

// 防止未捕获异常导致进程崩溃
process.on('uncaughtException', (err) => {
  console.error('[proxy uncaughtException]', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[proxy unhandledRejection]', reason);
});

function fixBody(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return raw; }
  if (!parsed.messages) return raw;

  const systemMsgs = parsed.messages.filter(m => m.role === 'system');
  if (systemMsgs.length === 0) return raw;

  parsed.messages = parsed.messages.filter(m => m.role !== 'system');

  const systemText = systemMsgs.map(m => {
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) return m.content.map(c => c.text || '').join('\n');
    return '';
  }).join('\n\n');

  if (parsed.system) {
    if (typeof parsed.system === 'string') {
      parsed.system = parsed.system + '\n\n' + systemText;
    } else if (Array.isArray(parsed.system)) {
      parsed.system.push({ type: 'text', text: systemText });
    }
  } else {
    parsed.system = systemText;
  }

  return JSON.stringify(parsed);
}

const server = http.createServer(async (req, res) => {
  try {
    let body = '';
    for await (const chunk of req) body += chunk;

    body = fixBody(body);

    const url = new URL(req.url, TARGET);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: req.method,
      headers: { ...req.headers, host: url.hostname, 'content-length': Buffer.byteLength(body) },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      console.error('[proxy error]', e.message);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end(JSON.stringify({ error: { message: 'Proxy connection error: ' + e.message } }));
      }
    });

    proxyReq.write(body);
    proxyReq.end();
  } catch (e) {
    console.error('[proxy request error]', e.message);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: { message: 'Internal proxy error: ' + e.message } }));
    }
  }
});

server.on('error', (e) => {
  console.error('[server error]', e.message);
});

server.listen(PORT, () => {
  console.log('[deepseek-proxy] running on port ' + PORT);
});
