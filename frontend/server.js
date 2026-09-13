/**
 * NEBULA frontend server.
 *
 * Runs Next.js (dev or production) and proxies /api/* and /ws/* to the backend
 * so the browser only ever talks to ONE origin. This matches the production
 * topology (nginx / docker-compose) and avoids CORS and mixed-origin issues.
 *
 *   BACKEND_URL   backend origin       (default http://127.0.0.1:8000)
 *   PORT          frontend port        (default 3000)
 *   NODE_ENV      production → serves the built app
 */
const http = require("http");
const httpProxy = require("http-proxy");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const backend = process.env.BACKEND_URL || process.env.NEBULA_BACKEND_URL || "http://127.0.0.1:8000";

const app = next({ dev, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

const proxy = httpProxy.createProxyServer({ target: backend, changeOrigin: true, ws: true });

proxy.on("error", (err, req, res) => {
  // Backend down: return a clear, machine-readable error instead of hanging.
  console.error("[nebula-proxy] backend unreachable:", err.code || err.message);
  if (res && !res.headersSent && typeof res.writeHead === "function") {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      detail: "NEBULA backend is unreachable. Start it with: uvicorn app.main:app --port 8000",
    }));
  }
});

// /api and /ws are the app's backend; /demo is the built-in demo website
// (also served by the backend) — proxying it keeps everything same-origin.
const isBackendPath = (url = "") =>
  url.startsWith("/api") || url.startsWith("/ws/") || url.startsWith("/demo");

app.prepare().then(() => {
  // In Next 15, getUpgradeHandler() must be called after prepare().
  const upgradeHandler = app.getUpgradeHandler();

  const server = http.createServer((req, res) => {
    if (isBackendPath(req.url)) return proxy.web(req, res);
    return handle(req, res);
  });

  // WebSocket: /ws/* goes to the backend; Next's own HMR socket stays local.
  server.on("upgrade", (req, socket, head) => {
    if (req.url && req.url.startsWith("/ws/")) {
      return proxy.ws(req, socket, head);
    }
    return upgradeHandler(req, socket, head);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`▲ NEBULA frontend ready on http://0.0.0.0:${port} (${dev ? "dev" : "production"})`);
    console.log(`  ↳ /api and /ws proxied to ${backend}`);
  });
});
