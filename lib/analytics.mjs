export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n,
    z2 = z * z,
    d = 1 + z2 / n,
    c = (p + z2 / (2 * n)) / d,
    s = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / d;
  return [Math.max(0, c - s), Math.min(1, c + s)];
}
export function attribute(block, registry = []) {
  const hits = registry.filter(
    (p) =>
      (p.tags || []).some((t) => t.length >= 3 && block.tag.includes(t)) ||
      (p.addresses || []).some(
        (a) =>
          ["collection", "fee"].includes(a.role) &&
          a.source &&
          block.outputs.some((o) => o.address === a.address && o.sats > 0) &&
          (!a.soleRecipient || block.outputs.filter((o) => o.sats > 0).length === 1),
      ),
  );
  if (hits.length > 1)
    return {
      id: "unknown",
      name: "Unknown",
      unknown: true,
      evidence: "Conflicting evidence",
    };
  if (hits.length === 1)
    return {
      id: hits[0].id,
      name: hits[0].name,
      unknown: false,
      evidence: "Local evidence registry",
      source: hits[0].source,
    };
  if (
    block.reportedPool &&
    block.reportedPool.slug !== "unknown" &&
    block.reportedPool.name.toLowerCase() !== "unknown"
  )
    return {
      id: `explorer:${block.reportedPool.slug}`,
      name: block.reportedPool.name,
      unknown: false,
      evidence: "Explorer attribution",
      source: block.source,
    };
  return {
    id: "unknown",
    name: "Unknown",
    unknown: true,
    evidence: "Unattributed",
  };
}
export function summarizeTags(blocks) {
  const counts = new Map();
  for (const b of blocks) {
    const tag = typeof b.tag === "string" ? b.tag : "";
    counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts].map(([tag, count]) => ({
    id: "tag:" + tag, name: tag || "No recorded tag", tag,
    blocks: count, share: count / blocks.length, unknown: tag === "",
  })).sort((a,b) => b.blocks-a.blocks || a.name.localeCompare(b.name));
}
export function summarize(blocks, registry = []) {
  const pools = new Map(),
    addresses = new Map();
  const enriched = blocks.map((block) => {
    const group = attribute(block, registry);
    if (!pools.has(group.id)) pools.set(group.id, { ...group, blocks: 0 });
    pools.get(group.id).blocks++;
    const seen = new Set();
    for (const output of block.outputs) {
      if (output.sats <= 0) continue;
      if (!addresses.has(output.address)) {
        const documented = registry
          .flatMap((p) => p.addresses || [])
          .find((a) => a.address === output.address && a.source);
        addresses.set(output.address, {
          address: output.address,
          blocks: 0,
          sats: 0,
          role: documented?.role || "Unclassified recipient",
        });
      }
      const r = addresses.get(output.address);
      r.sats += output.sats;
      if (!seen.has(output.address)) {
        r.blocks++;
        seen.add(output.address);
      }
    }
    return {
      ...block,
      pool: group.name,
      attribution: group,
      outputs: block.outputs.map((o) => ({ ...o, value: o.sats / 1e8 })),
    };
  });
  return {
    sample: blocks.length,
    pools: [...pools.values()]
      .map((p) => ({
        ...p,
        share: p.blocks / blocks.length,
        interval: wilson(p.blocks, blocks.length),
      }))
      .sort((a, b) => b.share - a.share),
    addresses: [...addresses.values()]
      .sort((a, b) => b.blocks - a.blocks || b.sats - a.sats)
      .map((a) => ({ ...a, amount: a.sats / 1e8 })),
    tags: summarizeTags(blocks),
    blocks: enriched.slice(0, 24),
  };
}
export function validateTelemetry(body, now = Date.now()) {
  const bad = () => {
    throw new Error(
      "Invalid telemetry: require an id, a recent interval, and difficulty-weighted work segments.",
    );
  };
  if (
    !body ||
    typeof body !== "object" ||
    typeof body.id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(body.id)
  )
    bad();
  const { start, end, segments, found } = body;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    end <= start ||
    end - start > 900000 ||
    end > now + 30000 ||
    start < now - 7 * 86400000
  )
    bad();
  if (
    !Array.isArray(segments) ||
    !segments.length ||
    segments.length > 100 ||
    (found !== null &&
      (!Number.isSafeInteger(found) || found < 0 || found > 10000))
  )
    bad();
  let expected = 0,
    work = 0;
  for (const s of segments) {
    if (
      !s ||
      !Number.isFinite(s.shareDifficultySum) ||
      s.shareDifficultySum < 0 ||
      s.shareDifficultySum > 1e30 ||
      !Number.isFinite(s.networkDifficulty) ||
      s.networkDifficulty <= 0 ||
      s.networkDifficulty > 1e30
    )
      bad();
    work += s.shareDifficultySum;
    expected += s.shareDifficultySum / s.networkDifficulty;
  }
  if (!Number.isFinite(expected) || expected > 1e9) bad();
  return { id: body.id, start, end, found, expected, work };
}
// An incomplete outcome window must never look like measured zero blocks.
export function sumFound(records) {
  return records.length && records.every((r) => Number.isSafeInteger(r.found))
    ? records.reduce((n, r) => n + r.found, 0)
    : null;
}
export function summarizeTelemetry(records, now = Date.now()) {
  const groups = new Map();
  const intervals = new Map();
  for (const r of records) {
    if (r.start < now - 86400000 || r.end > now) continue;
    if (!groups.has(r.provider))
      groups.set(r.provider, {
        name: r.provider,
        expected: 0,
        found: 0,
        work: 0,
        lastReport: r.end,
        lastWorkReport: 0,
      });
    const p = groups.get(r.provider);
    if (!intervals.has(r.provider)) intervals.set(r.provider, []);
    intervals.get(r.provider).push([r.start, r.end]);
    p.expected += r.expected;
    p.found = p.found === null || r.found == null ? null : p.found + r.found;
    p.work += r.work;
    p.lastReport = Math.max(p.lastReport, r.end);
    if (r.work > 0) p.lastWorkReport = Math.max(p.lastWorkReport, r.end);
  }
  const total = [...groups.values()].reduce((n, p) => n + p.work, 0);
  return {
    scope: "Reporting providers only; not network-wide coverage",
    windowStart: now - 86400000,
    windowEnd: now,
    providers: [...groups.values()].map((p) => {
      const spans = intervals.get(p.name).sort((a, b) => a[0] - b[0]);
      let coveredMs = 0, end = now - 86400000;
      for (const [start, stop] of spans) {
        coveredMs += Math.max(0, stop - Math.max(start, end));
        end = Math.max(end, stop);
      }
      return {
        ...p,
        reportCount: spans.length,
        coverage: coveredMs / 86400000,
        coveredMs,
        windowStart: now - 86400000,
        windowEnd: now,
        workShare: total ? p.work / total : 0,
        stale: now - p.lastReport > 1800000,
      };
    }),
  };
}
