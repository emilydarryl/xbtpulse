import { summarizeTelemetry } from "./analytics.mjs";
import { participation } from "./ratings.mjs";
export function onboardingFeed(store, now = Date.now(), limit = 6) {
  const providers = store.db
    .prepare("SELECT id,application,active FROM providers")
    .all();
  const active = new Set(providers.filter((p) => p.active).map((p) => p.id));
  const reports = summarizeTelemetry(store.telemetry(), now).providers;
  const profiles = store.db
    .prepare("SELECT key,value FROM meta WHERE key LIKE 'pool-profile:%'")
    .all()
    .map((r) => ({ id: r.key.slice(13), body: JSON.parse(r.value) }));
  return store
    .applications()
    .filter(
      (a) =>
        a.status !== "declined" &&
        (a.body.listingConsent === true ||
          (a.status === "approved" && a.body.profileConsent === true)),
    )
    .slice(0, limit)
    .map((a) => {
      const linked = providers.filter((p) => p.application === a.id);
      const report = reports.filter((r) => linked.some((p) => p.id === r.name));
      const contributor = report.some((r) => participation(r, active, now));
      const approved = linked.some((p) => p.active);
      const profile = profiles.find((p) => p.body.applicationId === a.id);
      return {
        name: a.body.name,
        poolType: a.body.profile?.poolType || "unspecified",
        submittedAt: a.created,
        status: contributor
          ? "Telemetry Contributor"
          : approved
            ? report.length
              ? "Reporting paused"
              : "Approved for telemetry · awaiting reports"
            : a.status === "approved"
              ? "Reporting access inactive"
              : "Submitted · awaiting review",
        lastReport: report.length
          ? Math.max(...report.map((r) => r.lastReport))
          : null,
        ratingStatus: "Not assessed",
        profileUrl: profile
          ? "/pool?id=" + encodeURIComponent(profile.id)
          : null,
      };
    });
}
