// lightweight keep-alive server for Replit
// listens on process.env.PORT (Replit sets it) and exposes a health route

const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(port, () => {
  console.log(`keep-alive server listening on port ${port}`);
});
