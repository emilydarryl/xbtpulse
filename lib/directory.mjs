import { attribute } from "./analytics.mjs";
import { onboardingFeed } from "./onboarding-feed.mjs";
// Normalize for search only; displayed names and opaque pool IDs stay intact.
export function directorySearchText(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
export function poolDirectory(
  store,
  registry,
  retention = 30000,
  now = Date.now(),
  researchedProfiles = {},
) {
  const latestById = new Map();
  const entries = new Map(),
    blocks = store.blocks(retention);
  for (const [index, b] of blocks.entries()) {
    const p = attribute(b, registry);
    if (p.unknown) continue;
    if (!latestById.has(p.id)) latestById.set(p.id, b);
    if (!entries.has(p.id))
      entries.set(p.id, {
        id: p.id,
        name: p.name,
        poolType: "unspecified",
        profileUrl: "/pool?id=" + encodeURIComponent(p.id),
        participation: "No linked public participation",
        lastObserved: null,
        retainedBlocks: 0,
        recentBlocks: 0,
      });
    const row = entries.get(p.id);
    row.retainedBlocks++;
    if (index < 144) row.recentBlocks++;
    row.lastObserved = Math.max(row.lastObserved || 0, b.time * 1000);
  }
  // Research-only listings carry no invented chain attribution or participation.
  for (const [id, profile] of Object.entries(researchedProfiles)) {
    if (!profile.name || entries.has(id)) continue;
    entries.set(id, {
      id, name: profile.name, poolType: profile.poolType || "unspecified",
      profileUrl: "/pool?id=" + encodeURIComponent(id),
      participation: "Researched public data · Not operator-confirmed or assessed",
      lastObserved: null, retainedBlocks: null, recentBlocks: null,
    });
  }
  const apps = store.applications();
  for (const record of store.db
    .prepare("SELECT key,value FROM meta WHERE key LIKE 'pool-profile:%'")
    .all()) {
    const profile = JSON.parse(record.value);
    if (!profile) continue;
    const a = apps.find((a) => a.id === profile.applicationId);
    if (
      profile.applicationId &&
      (!a || a.body.profileConsent !== true || a.status === "declined")
    )
      continue;
    const id = record.key.slice(13),
      row = entries.get(id) || {
        id,
        retainedBlocks: 0,
        recentBlocks: 0,
        lastObserved: null,
        participation: "No linked public participation",
      };
    entries.set(id, {
      ...row,
      name: profile.name || row.name || id,
      poolType: profile.poolType || "unspecified",
      profileUrl: "/pool?id=" + encodeURIComponent(id),
    });
  }
  const approved = apps.filter((a) => a.status === "approved");
  for (const item of onboardingFeed(store, now, Infinity)) {
    if (
      !approved.some(
        (a) => a.body.name === item.name && a.created === item.submittedAt,
      )
    )
      continue;
    const linked = [...entries.values()].find(
      (r) => r.profileUrl === item.profileUrl && item.profileUrl,
    );
    if (linked) {
      linked.participation = item.status;
      continue;
    }
    // No heuristic name merging: shared names do not establish common ownership.
    const id = "listing:" + item.name + ":" + item.submittedAt;
    entries.set(id, {
      id,
      name: item.name,
      poolType: item.poolType,
      profileUrl: null,
      participation: item.status,
      lastObserved: null,
      retainedBlocks: 0,
      recentBlocks: 0,
    });
  }
  const sample = Math.min(144, blocks.length);
  for (const row of entries.values()) {
    const latest = latestById.get(row.id);
    row.status = {
      observedShare: latest && sample ? row.recentBlocks / sample : null,
      sample,
      latestBlock: latest ? {height: latest.height, hash: latest.hash, time: latest.time} : null,
      reportedHashrate: null,
      reportedTip: null,
      protocols: researchedProfiles[row.id]?.protocols || null,
      source: researchedProfiles[row.id]?.sources?.[0] || null,
      reviewedAt: researchedProfiles[row.id]?.reviewedAt || null,
    };
  }
  return [...entries.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}
