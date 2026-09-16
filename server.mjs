import {characterize} from './lib/block-characteristics.mjs';
import {addressDetails} from './lib/address-details.mjs';
import {siteNavigation} from './lib/site-navigation.mjs';
import {initializePoolHistory,capturePoolHistory,poolHistory} from './lib/pool-history.mjs';
import { evidenceFreshness } from "./lib/evidence-freshness.mjs";
import { profileProviderIds } from "./lib/profile-providers.mjs";
import { initializeBlockReports, pruneBlockReports, submitBlockReport, publicBlockReports } from "./lib/block-reports.mjs";
import { onboardingFeed } from "./lib/onboarding-feed.mjs";
import { poolDirectory, directorySearchText } from "./lib/directory.mjs";
import {
  publicScorecard,
  criteria as scoreCriteria,
} from "./lib/scorecards.mjs";
import {
  networkTrends,
  initializeChanges,
  captureChanges,
  changeFeed,
} from "./lib/trends.mjs";
import {
  conversationLink,
  authorizeConversation,
  conversation,
  addMessage,
} from "./lib/messages.mjs";
import { answerChallenge, publicReview } from "./lib/review.mjs";
import { privateProfiles } from "./lib/profiles.mjs";
import { inspectTokenClaim, redeemTokenClaim } from "./lib/token-claims.mjs";
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
import { initializeAdmin, adminRoute } from "./lib/admin.mjs";
import {
  wilson,
  attribute,
  summarize,
  summarizeTelemetry,
  validateTelemetry,
} from "./lib/analytics.mjs";
const root = fileURLToPath(new URL(".", import.meta.url)),
  port = Number(process.env.PORT || 4317);
const dataDir = resolve(root, process.env.DATA_DIR || "data");
await mkdir(dataDir, { recursive: true });
const store = new Store(join(dataDir, "pulse.sqlite"));
initializeBlockReports(store);
store.expireApplications();
initializeAdmin(store);
if (!store.get("assessment-history-start"))
  store.set("assessment-history-start", Date.now());
initializeChanges(store);
initializePoolHistory(store);
const registry = JSON.parse(
  await readFile(join(root, "config/pools.json"), "utf8"),
);
const researchedProfiles = JSON.parse(
  await readFile(join(root, "config/researched-profiles.json"), "utf8"),
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
  Math.min(30000, Number(process.env.RETAIN_BLOCKS) || 30000),
);
const collector = new Collector(store, source, { retention }),
  pollSeconds = Math.max(10, Number(process.env.POLL_SECONDS) || 30);
const files = {
  "/token-claim": "token-claim.html",
  "/token-claim.js": "token-claim.js",
  "/": "index.html",
  "/about": "about.html",
  "/endpoint-checks": "endpoint-checks.html",
  "/endpoint-checks.js": "endpoint-checks.js",
  "/endpoint-report.json": "endpoint-report.json",
  "/chain-evidence.json": "chain-evidence.json",
  "/chain-evidence.js": "chain-evidence.js",
  "/app.js": "app.js",
  "/telemetry-context.js": "telemetry-context.js",
  "/style.css": "style.css",
  "/favicon.svg": "favicon.svg",
  "/collector": "collector.html",
  "/adapter": "adapter.html",
  "/verify-downloads": "verify-downloads.html",
  "/downloads/release-signing-key.pub": "downloads/release-signing-key.pub",
  "/downloads/allowed_signers": "downloads/allowed_signers",
  "/downloads/SHA256SUMS.txt.sig": "downloads/SHA256SUMS.txt.sig",
  "/downloads/ADAPTER-SHA256SUMS.txt.sig": "downloads/ADAPTER-SHA256SUMS.txt.sig",
  "/downloads/xbtpulse-adapter-kit-0.1.0.zip": "downloads/xbtpulse-adapter-kit-0.1.0.zip",
  "/downloads/ADAPTER-SHA256SUMS.txt": "downloads/ADAPTER-SHA256SUMS.txt",
  "/downloads/xbtpulse-datum-collector-1.0.0.zip":
    "downloads/xbtpulse-datum-collector-1.0.0.zip",
  "/downloads/SHA256SUMS.txt": "downloads/SHA256SUMS.txt",
  "/conversation": "conversation.html",
  "/conversation.js": "conversation.js",
  "/contribute": "contribute.html",
  "/contribute.js": "contribute.js",
  "/report-blocks": "report-blocks.html",
  "/report-blocks.js": "report-blocks.js",
  "/block-report-view.js": "block-report-view.js",
  "/downloads/xbtpulse-block-reporter.py": "downloads/xbtpulse-block-reporter.py",
  "/ratings": "ratings.html",
  "/pools": "pools.html",
  "/site-navigation.js": "site-navigation.js",
  "/simulator": "simulator.html",
  "/simulator.js": "simulator.js",
  "/simulator-model.js": "simulator-model.js",
  "/miner-checker": "miner-checker.html",
  "/miner-checker.js": "miner-checker.js",
  "/miner-checker-model.js": "miner-checker-model.js",
  "/watchlist": "watchlist.html",
  "/watchlist.js": "watchlist.js",
  "/watch-store.js": "watch-store.js",
  "/compare": "compare.html",
  "/compare.js": "compare.js",
  "/share-card.js": "share-card.js",
  "/pools.js": "pools.js",
  "/scorecard": "scorecard.html",
  "/scoring-rules": "scorecard.html",
  "/scorecard.js": "scorecard.js",
  "/trends": "trends.html",
  "/trends.js": "trends.js",
  "/trends.css": "trends.css",
  "/mining-map": "mining-map.html",
  "/mining-map.js": "mining-map.js",
  "/mining-map.css": "mining-map.css",
  "/pool": "pool.html",
  "/pool.js": "pool.js",
  "/admin": "admin.html",
  "/admin.js": "admin.js",
};
const mime = {
  json: "application/json; charset=utf-8",
  py: "text/plain; charset=utf-8",
  zip: "application/zip",
  txt: "text/plain; charset=utf-8",
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
  try {
    const url = new URL(req.url, "http://localhost");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action " + (url.pathname === "/" ? "'self'" : "'none'"),
    );
    if (url.pathname.startsWith("/api/admin/")) {
      try {
        await adminRoute({
          knownPoolIds: new Set(
            store
              .blocks(retention)
              .map((b) => attribute(b, registry))
              .filter((p) => !p.unknown)
              .map((p) => p.id),
          ),
          req,
          res,
          url,
          store,
          send,
          jsonBody,
          cache,
          origin: process.env.ADMIN_ORIGIN || "https://xbtpulse.tech",
        });
      } catch (error) {
        send(res, 400, {
          error: error.message.includes("UNIQUE")
            ? "That provider ID is already in use."
            : error.message,
        });
      }
      return;
    }
    if (url.pathname === "/api/token-claim") {
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      if (!["GET", "POST"].includes(req.method)) return send(res, 405, {error:"Method not allowed"});
      if (req.method === "POST" && req.headers.origin !== (process.env.ADMIN_ORIGIN || "https://xbtpulse.tech"))
        return send(res, 403, {error:"Origin not allowed"});
      const provider = url.searchParams.get("provider"), secret = req.headers.authorization?.replace(/^Bearer /, "");
      try {
        if (req.method === "GET") return send(res, 200, inspectTokenClaim(store, provider, secret));
        const body = await jsonBody(req);
        if (body.confirm !== true) return send(res, 400, {error:"Confirm token replacement first."});
        const result = redeemTokenClaim(store, provider, secret);
        cache.clear();
        return send(res, 200, result);
      } catch { return send(res, 400, {error:"Link unavailable. It may be expired, used or superseded. Ask XBT Pulse for a new claim link."}); }
    }
    if (url.pathname === "/api/conversation") {
      const id = url.searchParams.get("application"),
        token = req.headers.authorization?.replace(/^Bearer /, "");
      if (!authorizeConversation(store, id, token))
        return send(res, 401, {
          error:
            "Private link is invalid or has been replaced. Contact the administrator.",
        });
      if (req.method === "GET") return send(res, 200, conversation(store, id));
      if (req.method === "POST") {
        if (
          req.headers.origin !==
          (process.env.ADMIN_ORIGIN || "https://xbtpulse.tech")
        )
          return send(res, 403, { error: "Origin not allowed" });
        try {
          const b = await jsonBody(req);
          addMessage(store, id, "operator", b.id, b.message);
          return send(res, 200, { ok: true });
        } catch (e) {
          return send(res, 400, { error: e.message });
        }
      }
      return send(res, 405, { error: "Method not allowed" });
    }
    if (url.pathname === "/api/telemetry/challenge" && req.method === "POST") {
      const provider = authenticate(req);
      if (!provider)
        return send(res, 401, { error: "Provider token required" });
      try {
        const body = await jsonBody(req);
        return send(res, 200, answerChallenge(store, provider, body.code));
      } catch (error) {
        return send(res, 400, { error: error.message });
      }
    }
    if (url.pathname === "/admin" || url.pathname === "/admin.js")
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (
      url.pathname === "/api/operator-applications" &&
      req.method === "POST"
    ) {
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return send(res, 415, { error: "Use application/json" });
      try {
        const submitted = await jsonBody(req);
        if (
          submitted.conversationToken !== undefined &&
          !/^[a-f0-9]{64}$/.test(submitted.conversationToken)
        )
          throw Error("Invalid private conversation token");
        const application = validateApplication(submitted);
        const created = store.addApplication(application);
        if (created && submitted.conversationToken)
          conversationLink(store, application.id, submitted.conversationToken);
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
    if (url.pathname === "/api/block-reports" && req.method === "POST") {
      const provider = authenticate(req);
      if (!provider) return send(res, 401, { error: "Provider token required" });
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return send(res, 415, { error: "Use application/json" });
      try {
        const result = submitBlockReport(store, registry, provider, await jsonBody(req));
        cache.clear();
        return send(res, result.duplicate ? 200 : 201, result);
      } catch (e) {
        if (e.status === 429) res.setHeader("Retry-After", "3600");
        return send(res, e.status || 400, { error: e.message });
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
    if (url.pathname === "/api/pools") {
      const q = directorySearchText((url.searchParams.get("q") || "")
          .trim()
          .slice(0, 100)),
        type = url.searchParams.get("type") || "all";
      const page = Math.max(
        1,
        Math.min(10000, parseInt(url.searchParams.get("page") || "1", 10) || 1),
      );
      let snapshot = cache.get("directory");
      if (!snapshot || Date.now() - snapshot.time > 10000) {
        snapshot = {
          time: Date.now(),
          rows: poolDirectory(store, registry, retention, Date.now(), researchedProfiles),
        };
        cache.set("directory", snapshot);
      }
      const rows = snapshot.rows.filter(
        (p) =>
          (!q || directorySearchText(p.name).includes(q)) &&
          (type === "all" || p.poolType === type),
      );
      return send(res, 200, {
        rows: rows.slice((page - 1) * 30, page * 30),
        total: rows.length,
        page,
        pages: Math.ceil(rows.length / 30),
        lastSuccess: store.get("lastSuccess"),
      });
    }
    if (url.pathname === "/api/scoring-rules")
      return send(res, 200, { criteria: scoreCriteria, rubric: "pilot-v0.2" });
    if (url.pathname === "/api/scorecard") {
      const card = publicScorecard(store, url.searchParams.get("pool"));
      return send(
        res,
        card ? 200 : 404,
        card
          ? { card, criteria: scoreCriteria }
          : { error: "No published scorecard" },
      );
    }
    if (url.pathname === "/api/trends") {
      const old = cache.get("trends");
      if (old && Date.now() - old.time < 10000) return send(res, 200, old.body);
      const body = {
        ...networkTrends(store.blocks(retention), registry),
        lastSuccess: store.get("lastSuccess"),
        stale:
          !store.get("lastSuccess") ||
          Date.now() - store.get("lastSuccess") > 120000 ||
          Boolean(store.get("lastError")),
        changesStarted: store.get("changesStarted"),
        changes: changeFeed(store),
      };
      cache.set("trends", { time: Date.now(), body });
      return send(res, 200, body);
    }
    if (url.pathname === "/readyz") {
      const last = store.get("lastSuccess"),
        ready = Boolean(
          last &&
            Date.now() - last < Math.max(120000, pollSeconds * 3000) &&
            !store.get("lastError"),
        );
      return send(res, ready ? 200 : 503, { ready });
    }
    if(url.pathname==='/api/address'){
      const address=url.searchParams.get('address'),window=Number(url.searchParams.get('window')||144);
      if(!address||address.length>20000||![144,576,2016].includes(window))return send(res,400,{error:'Provide a recipient and a supported observation window.'});
      const details=addressDetails(store.blocks(retention),address,registry,window);
      if(!details)return send(res,404,{error:'Recipient not found in retained observations.'});
      const last=store.get('lastSuccess');
      return send(res,200,{...details,updatedAt:last?new Date(last).toISOString():null,source:store.get('source')||null,stale:!last||Date.now()-last>Math.max(120000,pollSeconds*3000)||!!store.get('lastError')});
    }
    if (["/api/dashboard", "/api/pool"].includes(url.pathname)) {
      const window = Number(url.searchParams.get("window") || 144);
      if (![144, 576, 2016].includes(window))
        return send(res, 400, { error: "Window must be 144, 576, or 2016" });
      const old = cache.get(window);
      if (
        url.pathname === "/api/dashboard" &&
        old &&
        Date.now() - old.time < 5000
      )
        return send(res, 200, old.body);
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
        privatePools: privateProfiles(store),
        onboarding: onboardingFeed(store),
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
      if (url.pathname === "/api/pool") {
        const id = url.searchParams.get("id");
        let published = store.get("pool-profile:" + id);
        if (published?.applicationId) {
          const owner = store.applications().find(a => a.id === published.applicationId);
          if (!owner || owner.status === "declined" || owner.body.profileConsent !== true) published = null;
        }
        const visibleProfile = published
          ? { ...published }
          : researchedProfiles[id] || null;
        if (visibleProfile) delete visibleProfile.applicationId;
        const observed = summarize(
          store.blocks(retention),
          registry,
        ).pools.find((p) => p.id === id && !p.unknown);
        const known =
          observed ||
          (published
            ? {
                id,
                name: published.name || id,
                evidence: "Published profile; block attribution not linked",
              }
            : researchedProfiles[id]?.name
              ? { id, name: researchedProfiles[id].name, evidence: "Researched public profile; block attribution not linked" }
              : null);
        const attributed = !!observed || registry.some((p) => p.id === id);
        if (!known)
          return send(res, 404, {
            error: "Pool not found in retained observations.",
          });
        const measured = store
            .blocks(window)
            .filter((b) => attribute(b, registry).id === id),
          details = summarize(measured, registry);
        const review = registry.find((p) => p.id === id)?.attributionReview || null;
        const card = publicScorecard(store, id);
        const providerIds = profileProviderIds(store, registry, id);
        const linkedProviders = providerIds.map(name => {
          const row = store.db.prepare("SELECT MAX(end) AS lastReport, MAX(CASE WHEN json_extract(body, '$.work') > 0 THEN end END) AS lastWorkReport FROM telemetry WHERE provider = ?").get(name);
          return {name,active:activeIds.has(name),...row};
        });
        return send(res, 200, {
          characteristics: {pool:characterize(measured),network:characterize(store.blocks(window))},
          history: poolHistory(store,id,researchedProfiles),
          freshness: evidenceFreshness({attribution:review,profile:visibleProfile,scorecard:card,providers:linkedProviders}),
          id,
          name: known.name,
          sample: summary.sample,
          requested: window,
          blocks: attributed ? measured.length : null,
          share:
            attributed && summary.sample
              ? measured.length / summary.sample
              : null,
          interval:
            attributed && summary.sample
              ? wilson(measured.length, summary.sample)
              : null,
          recent: details.blocks,
          addresses: details.addresses,
          status: body.status,
          updatedAt: body.updatedAt,
          evidence: known.evidence,
          attributionReview: registry.find((p) => p.id === id)?.attributionReview || null,
          rating: poolRating(known, [{ id, providerIds }], contributors),
          profile: visibleProfile,
          assessment: publicReview(store, published),
          scorecard: publicScorecard(store, id),
          telemetry: telemetry.providers.filter((p) =>
            providerIds.includes(p.name),
          ),
          blockReports: publicBlockReports(store, registry, id),
        });
      }
      cache.set(window, { time: Date.now(), body });
      return send(res, 200, body);
    }
    if (url.pathname === "/conversation")
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    const file = files[url.pathname];
    if (!file) return send(res, 404, { error: "Not found" });
    res.setHeader("Content-Type", mime[file.split(".").pop()] || "text/plain; charset=utf-8");
    if (file.endsWith(".zip"))
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${file.split("/").pop()}"`,
      );
    res.setHeader("Cache-Control", "no-cache");
    res.end(
      req.method === "HEAD"
        ? undefined
        : file.endsWith(".html") ? siteNavigation(await readFile(join(root,"public",file),"utf8"),url.pathname) : await readFile(join(root, "public", file)),
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
captureChanges(store);
capturePoolHistory(store,registry,researchedProfiles,Date.now(),Math.max(180000,pollSeconds*3000));
const timer = setInterval(async () => {
  store.expireApplications();
  pruneBlockReports(store);
  await collector.poll();
  captureChanges(store);
capturePoolHistory(store,registry,researchedProfiles,Date.now(),Math.max(180000,pollSeconds*3000));
  cache.clear();
}, pollSeconds * 1000);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    clearInterval(timer);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
