import { attribute, wilson } from "./analytics.mjs";
import { onboardingFeed } from "./onboarding-feed.mjs";
const DAY = 86400000;
export function networkTrends(blocks, registry, now = Date.now()) {
  const valid = blocks.filter((b) => b.time * 1000 <= now);
  const oldest = valid.length
    ? Math.min(...valid.map((b) => b.time * 1000))
    : null;
  const rows = valid.map((b) => ({
    time: b.time * 1000,
    pool: attribute(b, registry),
  }));
  function bucket(start, end) {
    const selected = rows.filter((b) => b.time >= start && b.time < end);
    const groups = new Map();
    for (const b of selected) {
      if (!groups.has(b.pool.id))
        groups.set(b.pool.id, {
          id: b.pool.id,
          name: b.pool.name,
          unknown: b.pool.unknown,
          blocks: 0,
        });
      groups.get(b.pool.id).blocks++;
    }
    return {
      start,
      end,
      complete: oldest !== null && oldest <= start,
      blocks: selected.length,
      pools: [...groups.values()]
        .map((p) => ({
          ...p,
          share: p.blocks / selected.length,
          interval: wilson(p.blocks, selected.length),
        }))
        .sort((a, b) => b.blocks - a.blocks),
    };
  }
  const midnight = Math.floor(now / DAY) * DAY;
  return {
    oldest,
    windows: [1, 7, 30].map((days) => ({
      days,
      ...bucket(now - days * DAY, now),
    })),
    daily: Array.from({ length: 30 }, (_, i) =>
      bucket(
        midnight - (29 - i) * DAY,
        Math.min(now, midnight - (28 - i) * DAY),
      ),
    ),
  };
}
export function initializeChanges(store) {
  store.db.exec(
    "CREATE TABLE IF NOT EXISTS public_changes(id INTEGER PRIMARY KEY, time INTEGER NOT NULL, operator TEXT NOT NULL, previous TEXT, current TEXT NOT NULL)",
  );
  if (!store.get("changesStarted")) store.set("changesStarted", Date.now());
}
const key = (r) => JSON.stringify([r.name, r.submittedAt]);
export function captureChanges(store, now = Date.now()) {
  const rows = onboardingFeed(store, now, Infinity),
    previous = store.get("publicChangeState") || {},
    next = {};
  store.db.exec("BEGIN IMMEDIATE");
  try {
    for (const row of rows) {
      const id = key(row);
      next[id] = row.status;
      if (previous[id] !== row.status)
        store.db
          .prepare(
            "INSERT INTO public_changes(time,operator,previous,current) VALUES (?,?,?,?)",
          )
          .run(now, id, previous[id] || null, row.status);
    }
    store.set("publicChangeState", next);
    store.db
      .prepare("DELETE FROM public_changes WHERE time < ?")
      .run(now - 90 * DAY);
    store.db.exec("COMMIT");
  } catch (e) {
    store.db.exec("ROLLBACK");
    throw e;
  }
}
export function changeFeed(store, now = Date.now()) {
  const visible = new Map(
    onboardingFeed(store, now, Infinity).map((r) => [key(r), r]),
  );
  return store.db
    .prepare(
      "SELECT time,operator,previous,current FROM public_changes ORDER BY id DESC LIMIT 500",
    )
    .all()
    .filter((r) => visible.has(r.operator))
    .slice(0, 30)
    .map((r) => ({
      time: r.time,
      name: visible.get(r.operator).name,
      profileUrl: visible.get(r.operator).profileUrl,
      previous: r.previous,
      status: r.current,
    }));
}
