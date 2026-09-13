import https from "node:https";
import { resolve4 } from "node:dns/promises";
import { createHash } from "node:crypto";
export function publicIPv4(ip) {
  const a = ip.split(".").map(Number);
  if (a.length !== 4 || a.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return false;
  return !(
    a[0] === 0 ||
    a[0] === 10 ||
    a[0] === 127 ||
    a[0] >= 224 ||
    (a[0] === 169 && a[1] === 254) ||
    (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
    (a[0] === 192 && a[1] === 168) ||
    (a[0] === 100 && a[1] >= 64 && a[1] <= 127) ||
    (a[0] === 198 && (a[1] === 18 || a[1] === 19)) ||
    (a[0] === 192 && a[1] === 0) ||
    (a[0] === 198 && a[1] === 51 && a[2] === 100) ||
    (a[0] === 203 && a[1] === 0 && a[2] === 113)
  );
}
export function sourceURL(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.search ||
    url.hostname.includes(":")
  )
    throw Error(
      "Only public HTTPS pages without credentials or query strings are checked",
    );
  url.hash = "";
  return url;
}
export async function readPublicSource(value, redirects = 0) {
  const url = sourceURL(value);
  let dnsTimer;
  const addresses = await Promise.race([
    resolve4(url.hostname),
    new Promise((_, reject) => {
      dnsTimer = setTimeout(() => reject(Error("DNS timeout")), 5000);
    }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some((ip) => !publicIPv4(ip)))
    throw Error("Non-public destination");
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "XBTPulse-Assessment/1.0",
          Accept: "text/html,text/plain,application/json",
          "Accept-Encoding": "identity",
        },
        lookup: (_host, options, cb) =>
          options?.all
            ? cb(null, [{ address: addresses[0], family: 4 }])
            : cb(null, addresses[0], 4),
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume();
          if (redirects >= 2 || !res.headers.location) {
            reject(Error("Redirect limit"));
            return;
          }
          readPublicSource(
            new URL(res.headers.location, url).href,
            redirects + 1,
          ).then(resolve, reject);
          return;
        }
        if (
          res.statusCode !== 200 ||
          !/(text\/html|text\/plain|application\/json)/.test(
            res.headers["content-type"] || "",
          )
        ) {
          res.resume();
          reject(Error("Unsupported public page response"));
          return;
        }
        let bytes = 0;
        const chunks = [];
        res.on("data", (c) => {
          bytes += c.length;
          if (bytes > 350000) {
            res.destroy(Error("Page exceeds size limit"));
            return;
          }
          chunks.push(c);
        });
        res.on("error", reject);
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          const clean = raw
            .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const snippets = [];
          const pattern =
            /\b(fee[s]?|payout[s]?|ownership|incident[s]?|template[s]?|datum|ratum)\b/gi;
          let match;
          while ((match = pattern.exec(clean)) && snippets.length < 6) {
            const excerpt = clean
              .slice(Math.max(0, match.index - 40), match.index + 160)
              .replace(/[A-Za-z0-9_-]{40,}/g, "[long identifier omitted]");
            if (!snippets.includes(excerpt)) snippets.push(excerpt);
            pattern.lastIndex = match.index + 160;
          }
          resolve({
            url: url.href,
            hash: createHash("sha256").update(raw).digest("hex"),
            snippets,
            status: "Retrieved · operator claims, not verified facts",
          });
        });
      },
    );
    req.setTimeout(6000, () => req.destroy(Error("Source timeout")));
    const deadline = setTimeout(
      () => req.destroy(Error("Source timeout")),
      8000,
    );
    req.on("close", () => clearTimeout(deadline));
    req.on("error", reject);
  });
}
