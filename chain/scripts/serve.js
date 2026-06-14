// Tiny static server for the casino root. MetaMask does not inject into
// file:// pages, so the on-chain flow needs the demo served over http:
//
//   node scripts/serve.js        (from chain/)   ->   http://localhost:8080/Volt%20Casino.html
//
// Plain node, no deps, no hardhat needed.

const fs = require("fs");
const path = require("path");
const http = require("http");

const PORT = 8080;
const ROOT = path.resolve(__dirname, "..", "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/Volt Casino.html";
    const file = path.join(ROOT, urlPath);
    if (!file.startsWith(ROOT)) {
      res.statusCode = 403;
      return res.end("forbidden");
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.statusCode = 404;
        return res.end("not found");
      }
      res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] || "application/octet-stream");
      res.end(data);
    });
  })
  .listen(PORT, () => {
    console.log(`VOLT served at http://localhost:${PORT}/Volt%20Casino.html`);
  });
