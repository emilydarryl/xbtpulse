// Launch policy: participation can be recognized; decentralization is not scored yet.
export function participation(provider, activeIds, now = Date.now()) {
  return (
    activeIds.has(provider.name) &&
    provider.work > 0 &&
    provider.lastReport <= now &&
    now - provider.lastReport <= 30 * 60 * 1000
  );
}
export function poolRating(pool, registry, contributors) {
  const entry = registry.find((item) => item.id === pool.id);
  const linked =
    !pool.unknown &&
    (entry?.providerIds || []).some((id) => contributors.has(id));
  return {
    framework: "draft-v0.1",
    status: linked ? "Telemetry Contributor" : "Not assessed",
    decentralizationScore: null,
    transparencyScore: null,
    evidence: linked
      ? "Reviewed provider link with recent operator-reported work. Participation is not a decentralization rating."
      : "No completed rating assessment. This is not a failing grade.",
  };
}
