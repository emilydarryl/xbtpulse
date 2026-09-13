import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, timingSafeEqual } from "node:crypto";
import { Store } from "./lib/store.mjs";
import { ExplorerSource, RpcSource } from "./lib/source.mjs";
import { Collector } from "./lib/collector.mjs";
import { validateApplication } from "./lib/onboarding.mjs";
import { participation, poolRating } from "./lib/ratings.mjs";
import {
  summarize,
  summarizeTelemetry,
  validateTelemetry,
} from "./lib/analytics.mjs";
const root = fileURLToPath(new URL(".", import.meta.url)),
  port = Number(process.env.PORT || 4317);
const dataDir = resolve(root, process.env.DATA_DIR || "data");
await mkdir(dataDir, { recursive: true });
const store = new Store(join(dataDir, "pulse.sqlite"));
store.expireApplications();
const registry = JSON.parse(
  await readFile(join(root, "config/pools.json"), "utf8"),
);
const keys = JSON.parse(process.env.TELEMETRY_KEYS_JSON || "{}");
for (const [name, hash] of Object.entries(keys))
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(name) || !/^[a-f0-9]{64}$/.test(hash))
    throw new Error("Invalid telemetry provider configuration");
const source = process.env.RPC_URL
  ? new RpcSource(
      process.env.RPC_URL,
      process.env.RPC_USER || "",
      process.env.RPC_PASSWORD || "",
    )
  : process.env.EXPLORER_API
    ? new ExplorerSource(process.env.EXPLORER_API)
    : null;
const retention = Math.max(
  144,
  Math.min(10080, Number(process.env.RETAIN_BLOCKS) || 2016),
);
const collector = new Collector(store, source, { retention }),
  pollSeconds = Math.max(10, Number(process.env.POLL_SECONDS) || 30);
const files = {
  "/": "index.html",
  "/app.js": "app.js",
  "/style.css": "style.css",
  "/favicon.svg": "favicon.svg",
  "/contribute": "contribute.html",
  "/contribute.js": "contribute.js",
  "/ratings": "ratings.html",
};
const mime = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
};
function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}
function authenticate(req) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!token || token.length > 512) return null;
  const digest = createHash("sha256").update(token).digest();
  for (const [provider, hash] of Object.entries(keys))
    if (timingSafeEqual(digest, Buffer.from(hash, "hex"))) return provider;
  return store.providerForHash(digest.toString("hex"));
}
async function jsonBody(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 32768) throw new Error("Request too large");
  }
  return JSON.parse(text);
}
let cache = new Map();
const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  );
  try {
    const url = new URL(req.url, "http://localhost");
    if (
      url.pathname === "/api/operator-applications" &&
      req.method === "POST"
    ) {
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return send(res, 415, { error: "Use application/json" });
      try {
        const application = validateApplication(await jsonBody(req));
        const created = store.addApplication(application);
        return send(res, created ? 201 : 200, {
          accepted: true,
          reference: application.id,
          status: "pending",
        });
      } catch (e) {
        return send(res, e.message.includes("busy") ? 429 : 400, {
          error: e.message,
        });
      }
    }
    if (url.pathname === "/api/telemetry" && req.method === "POST") {
      const provider = authenticate(req);
      if (!provider)
        return send(res, 401, { error: "Authentication required" });
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return send(res, 415, { error: "Use application/json" });
      try {
        const parsed = validateTelemetry(await jsonBody(req));
        const created = store.addTelemetry({ ...parsed, provider });
        cache.clear();
        return send(res, created ? 201 : 200, {
          accepted: true,
          duplicate: !created,
        });
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.setHeader("Allow", "GET, HEAD");
      return send(res, 405, { error: "Method not allowed" });
    }
    if (url.pathname === "/healthz") return send(res, 200, { ok: true });
    if (url.pathname === "/readyz") {
      const last = store.get("lastSuccess"),
        ready = Boolean(
          last &&
            Date.now() - last < Math.max(120000, pollSeconds * 3000) &&
            !store.get("lastError"),
        );
      return send(res, ready ? 200 : 503, { ready });
    }
    if (url.pathname === "/api/dashboard") {
      const window = Number(url.searchParams.get("window") || 144);
      if (![144, 576, 2016].includes(window))
        return send(res, 400, { error: "Window must be 144, 576, or 2016" });
      const old = cache.get(window);
      if (old && Date.now() - old.time < 5000) return send(res, 200, old.body);
      const last = store.get("lastSuccess"),
        fresh =
          last &&
          Date.now() - last < Math.max(120000, pollSeconds * 3000) &&
          !store.get("lastError");
      const telemetry = summarizeTelemetry(store.telemetry());
      const activeIds = new Set([
        ...Object.keys(keys),
        ...store.activeProviderIds(),
      ]);
      const contributors = new Set(
        telemetry.providers
          .filter((p) => participation(p, activeIds))
          .map((p) => p.name),
      );
      telemetry.providers = telemetry.providers.map((p) => ({
        ...p,
        participationBadge: contributors.has(p.name)
          ? "Telemetry Contributor"
          : "Reporting paused",
      }));
      const summary = summarize(store.blocks(window), registry);
      const body = {
        ...summary,
        pools: summary.pools.map((p) => ({
          ...p,
          rating: poolRating(p, registry, contributors),
        })),
        status: !source
          ? "unconfigured"
          : fresh
            ? "live"
            : last
              ? "stale"
              : "connecting",
        updatedAt: last ? new Date(last).toISOString() : null,
        source: store.get("source") || source?.name || null,
        tip: store.get("tip"),
        telemetry,
        events: store.events(),
        retention,
      };
      cache.set(window, { time: Date.now(), body });
      return send(res, 200, body);
    }
    const file = files[url.pathname];
    if (!file) return send(res, 404, { error: "Not found" });
    res.setHeader("Content-Type", mime[file.split(".").pop()]);
    res.setHeader("Cache-Control", "no-cache");
    res.end(
      req.method === "HEAD"
        ? undefined
        : await readFile(join(root, "public", file)),
    );
  } catch (e) {
    console.error("Request failed:", e.message);
    if (!res.headersSent)
      send(res, 500, { error: "Unable to complete request" });
    else res.end();
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.maxHeadersCount = 40;
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`XBT Pulse: http://127.0.0.1:${port}`),
);
await collector.poll();
const timer = setInterval(async () => {
  store.expireApplications();
  await collector.poll();
  cache.clear();
}, pollSeconds * 1000);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    clearInterval(timer);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
