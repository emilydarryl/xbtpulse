import { getScorecard } from "./scorecards.mjs";
import { sumFound } from "./analytics.mjs";
import { reviewEvidence } from "./review.mjs";
import { readPublicSource } from "./public-source.mjs";
const DAY = 86400000;
export function intervalMetrics(reports, start, end) {
  const list = reports
    .filter((r) => r.start >= start && r.end <= end)
    .sort((a, b) => a.start - b.start);
  let covered = 0,
    edge = start,
    gaps = 0,
    largestGap = 0,
    overlap = false;
  for (const r of list) {
    if (r.start < edge) overlap = true;
    if (r.start > edge) {
      gaps++;
      largestGap = Math.max(largestGap, r.start - edge);
    }
    covered += Math.max(0, r.end - Math.max(edge, r.start));
    edge = Math.max(edge, r.end);
  }
  if (end > edge) {
    gaps++;
    largestGap = Math.max(largestGap, end - edge);
  }
  return {
    reports: list.length,
    coverage: end > start ? (covered / (end - start)) * 100 : 0,
    gaps,
    largestGapMinutes: Math.round(largestGap / 60000),
    overlap,
    inconsistent: list.some(
      (r) =>
        (r.work === 0 && (r.expected > 0 || r.found > 0)) ||
        (r.work > 0 && r.expected <= 0),
    ),
    work: list.reduce((n, r) => n + r.work, 0),
    expected: list.reduce((n, r) => n + r.expected, 0),
    found: sumFound(list),
    lastPositive: Math.max(
      0,
      ...list.filter((r) => r.work > 0).map((r) => r.end),
    ),
  };
}
const inFlight = new Set();
export async function runAssessmentChecks(
  store,
  body,
  now = Date.now(),
  fetchSource = readPublicSource,
) {
  const id = body.application;
  getScorecard(store, id);
  for (const date of [body.start, body.end])
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw Error("Choose valid observation dates first");
  const start = Date.parse(body.start),
    end = Math.min(now, Date.parse(body.end) + DAY);
  if (start >= end || end - start > 35 * DAY || Date.parse(body.end) > now)
    throw Error("Choose a past/current observation period of at most 35 days");
  const old = store.get("assessment-checks:" + id);
  if (old && now - old.checkedAt < 60000) {
    if (old.start === start && old.endDate === body.end) return old;
    throw Error("Wait one minute before running another period");
  }
  if (inFlight.has(id)) throw Error("Checks are already running");
  inFlight.add(id);
  try {
    const app = store.applications().find((a) => a.id === id),
      providers = store.db
        .prepare("SELECT id,active FROM providers WHERE application=?")
        .all(id);
    const metrics = providers.map((p) => ({
      ...p,
      ...intervalMetrics(
        store.db
          .prepare(
            "SELECT body FROM telemetry WHERE provider=? AND end>? AND start<?",
          )
          .all(p.id, start, end)
          .map((r) => JSON.parse(r.body)),
        start,
        end,
      ),
    }));
    const historyStart = store.get("assessment-history-start");
    const historyComplete = Boolean(
      historyStart && start >= historyStart && start >= now - 35 * DAY,
    );
    const sources = [app.body.website];
    for (const profile of store.db
      .prepare("SELECT value FROM meta WHERE key LIKE 'pool-profile:%'")
      .all()
      .map((r) => JSON.parse(r.value))
      .filter((p) => p?.applicationId === id)) {
      sources.push(
        profile.website,
        ...(profile.sources || []).map((s) => s.url),
      );
    }
    const sourceResults = await Promise.all(
      [...new Set(sources.filter((s) => typeof s === "string" && s))]
        .slice(0, 3)
        .map(async (url) => {
          try {
            return { ...(await fetchSource(url)), checkedAt: now };
          } catch {
            return {
              url,
              status: "Could not retrieve safely; manual source review needed",
              checkedAt: now,
              snippets: [],
            };
          }
        }),
    );
    const summary = metrics
      .map(
        (p) =>
          `${p.id}: ${p.reports} complete intervals; ${p.coverage.toFixed(2)}% of requested time covered; ${p.gaps} uncovered ranges, largest ${p.largestGapMinutes} minutes; ${p.found === null ? "Block outcomes unavailable for all or part of this window; no found/expected comparison" : p.found + " reported found"}; ${p.expected.toFixed(2)} expected from reported work. ${p.lastPositive ? "Last positive work " + new Date(p.lastPositive).toISOString() : "No positive work in this period"}.`,
      )
      .join("\n");
    const candidate =
      historyComplete &&
      metrics.length === 1 &&
      metrics[0].active &&
      metrics[0].reports > 0 &&
      !metrics[0].overlap &&
      !metrics[0].inconsistent &&
      metrics[0].work > 0
        ? Math.round(metrics[0].coverage * 100) / 100
        : null;
    const suggestions = [
      {
        criterion: "telemetry",
        evidence: `Automated observation ${new Date(now).toISOString()}, period ${new Date(start).toISOString()}–${new Date(end).toISOString()}. ${summary || "No reporting provider available."} ${historyComplete ? "Retained history covers the requested period." : "Historical retention is incomplete; observed coverage is a lower bound, not measured downtime."} Counts are operator reports. Units, resets, representativeness, cross-provider overlap and chain outcomes still require review.`,
        candidatePercent: candidate,
      },
    ];
    for (const c of [
      "templates",
      "operators",
      "choice",
      "independence",
      "ownership",
      "incidents",
    ])
      suggestions.push({
        criterion: c,
        evidence:
          "Automated checks cannot establish this criterion. " +
          {
            templates:
              "Request independently checked template/work samples and the controlled-work fraction.",
            operators:
              "Request common ownership grouping and work fractions by controlling operator.",
            choice: "Request results for all four miner-choice tests.",
            independence:
              "Request upstream-switch, solo-continuity and retained-control test results.",
            ownership:
              "Request identity corroboration, related operators, upstreams and template responsibilities.",
            incidents:
              "Request the dated incident/no-known-incident record, reporting policy and discrepancy review.",
          }[c],
        candidatePercent: null,
      });
    suggestions.push({
      criterion: "payout",
      evidence:
        app.body.profile?.poolType === "private"
          ? "Private pool: public fees are not required. Request redacted reward-control and reconciliation evidence."
          : "Request current fee breakdown by mining path, allocation rules, payout conditions and reconciled records. Retrieved web text remains an operator claim.",
      candidatePercent: null,
    });
    const differences = [];
    if (old) {
      for (const p of metrics) {
        const prev = old.metrics.find((x) => x.id === p.id);
        if (!prev) differences.push("Reporting provider added: " + p.id);
        else if (
          prev.coverage.toFixed(2) !== p.coverage.toFixed(2) ||
          prev.lastPositive !== p.lastPositive
        )
          differences.push(
            `${p.id}: prior observed coverage ${prev.coverage.toFixed(2)}%, now ${p.coverage.toFixed(2)}%; reporting evidence updated.`,
          );
      }
      for (const s of sourceResults) {
        const prev = old.sources.find((x) => x.url === s.url);
        if (prev?.hash && s.hash && prev.hash !== s.hash)
          differences.push("Public page content changed: " + s.url);
      }
      if (old.start !== start || old.endDate !== body.end)
        differences.unshift(
          "Observation period changed; percentages are not directly comparable.",
        );
    }
    const result = {
      checkedAt: now,
      start,
      end,
      endDate: body.end,
      historyComplete,
      historyStart,
      metrics,
      sources: sourceResults,
      suggestions,
      readiness: reviewEvidence(store, app, now),
      differences: old ? differences : ["First check; no prior comparison."],
      followup: `Hello ${app.body.name}, we are preparing your XBT Pulse assessment. Please provide evidence for:\n\n${suggestions
        .filter((s) => s.candidatePercent === null)
        .map(
          (s) =>
            "- " +
            s.evidence.replace(
              "Automated checks cannot establish this criterion. ",
              "",
            ),
        )
        .join(
          "\n",
        )}\n\nPlease redact credentials, miner identities and private network details. No SSH access is needed.`,
    };
    store.set("assessment-checks:" + id, result);
    return result;
  } finally {
    inFlight.delete(id);
  }
}
