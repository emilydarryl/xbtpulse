const $ = (s) => document.querySelector(s),
  params = new URL(location.href).searchParams;
const application = params.get("application");
let csrf = "",
  rules = [],
  saved = null;
const add = (parent, tag, value) => {
  const e = document.createElement(tag);
  e.textContent = value;
  parent.append(e);
  return e;
};
async function api(path, body) {
  const r = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: body
      ? { "Content-Type": "application/json", "X-CSRF-Token": csrf }
      : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Request failed");
  return d;
}
function totals(card) {
  return Object.fromEntries(
    ["decentralization", "transparency"].map((axis) => {
      const cs = rules.filter((c) => c.axis === axis);
      return [
        axis,
        cs.every((c) => card.rows.find((r) => r.id === c.id)?.percent != null)
          ? Math.round(
              cs.reduce(
                (n, c) =>
                  n +
                  (c.weight * card.rows.find((r) => r.id === c.id).percent) /
                    100,
                0,
              ) * 10,
            ) / 10
          : null,
      ];
    }),
  );
}
function preview(card) {
  const box = $("#score-preview");
  box.hidden = false;
  box.replaceChildren();
  const scores = totals(card);
  add(
    box,
    "p",
    `${card.rubric} · ${card.publishedAt ? "Published " + new Date(card.publishedAt).toLocaleString() : "Private draft preview"}`,
  );
  add(
    box,
    "h2",
    `Decentralization: ${scores.decentralization ?? "Not assessed"}${scores.decentralization === null ? "" : " / 100"} · Transparency: ${scores.transparency ?? "Not assessed"}${scores.transparency === null ? "" : " / 100"}`,
  );
  add(
    box,
    "p",
    `Reviewer: ${card.reviewer || "Not supplied"} · ${card.start} to ${card.end} UTC`,
  );
  add(box, "p", card.scope);
  add(box, "p", "Change reason: " + card.reason);
  if (card.publishedAt && Date.now() - Date.parse(card.end) > 30 * 86400000)
    add(
      box,
      "p",
      "Historical assessment — observation period is older than 30 days. Re-review is due.",
    );
  for (const c of rules) {
    const r = card.rows.find((r) => r.id === c.id);
    add(
      box,
      "h3",
      `${c.label}: ${r.percent === null ? "Not assessed" : ((r.percent * c.weight) / 100).toFixed(1) + " / " + c.weight}`,
    );
    add(box, "p", r.evidence || "Evidence not supplied.");
    add(box, "p", "Evidence checked: " + (r.checked || "Not reviewed"));
  }
  add(
    box,
    "p",
    "Pilot rubric. These are scoped reviewer assessments, not a guarantee or an automatically awarded higher tier. To request a correction, contact XBT Pulse through the operator contribution program.",
  );
}
function readCard() {
  const f = $("#score-form").elements;
  return {
    reviewer: f.reviewer.value,
    start: f.start.value,
    end: f.end.value,
    scope: f.scope.value,
    reason: f.reason.value,
    rows: rules.map((c) => ({
      id: c.id,
      percent:
        f[c.id + "-percent"].value === ""
          ? null
          : Number(f[c.id + "-percent"].value),
      evidence: f[c.id + "-evidence"].value,
      checked: f[c.id + "-checked"].value,
    })),
  };
}
function populate(d) {
  rules = d.criteria;
  saved = d.draft;
  $("#operator-name").textContent = d.name;
  $("#score-admin").hidden = false;
  const today = new Date().toISOString().slice(0, 10),
    card = saved || {
      reviewer: "",
      start: today,
      end: today,
      scope: "",
      reason: "",
      rows: rules.map((c) => ({
        id: c.id,
        percent: null,
        evidence: "",
        checked: "",
      })),
    };
  if (!saved && d.name.toLowerCase() === "soveroot") {
    card.scope =
      "Private DATUM gateway connected to Lazarus. Reporting covers the gateway; independent template control and ownership review remain incomplete.";
    card.reason = "Initial Soveroot example; evidence gaps retained.";
    const r = card.rows.find((r) => r.id === "ownership");
    r.evidence =
      "Owner-authorized gateway status inspection on 2026-09-13 identified Lazarus as the connected upstream pool. This establishes a dated connection snapshot only. Identity corroboration, common ownership and template responsibility remain unassessed.";
    r.checked = "2026-09-13";
  }
  for (const key of ["reviewer", "start", "end", "scope", "reason"])
    $("#score-form").elements[key].value = card[key];
  const fields = $("#score-fields");
  for (const c of rules) {
    const r = card.rows.find((r) => r.id === c.id);
    const section = add(fields, "section", "");
    add(section, "h3", `${c.label} · ${c.weight} points`);
    add(section, "p", c.rule);
    for (const [suffix, label, type] of [
      ["percent", "Verified result (0–100%; blank = Not assessed)", "number"],
      ["checked", "Evidence checked (UTC)", "date"],
      [
        "evidence",
        "Public evidence, method, calculations and limitations",
        "textarea",
      ],
    ]) {
      const l = add(section, "label", label);
      const input = document.createElement(
        type === "textarea" ? "textarea" : "input",
      );
      if (type !== "textarea") input.type = type;
      input.name = c.id + "-" + suffix;
      if (type === "number") {
        input.min = 0;
        input.max = 100;
        input.step = "0.01";
      }
      if (type === "textarea") input.maxLength = 2500;
      input.value = r[suffix] ?? "";
      l.append(input);
    }
  }
  for (const p of d.profiles) {
    const o = add($("#score-profile"), "option", p.name);
    o.value = p.id;
  }
  if (saved) {
    preview(saved);
    $("#publish-controls").hidden = false;
  }
  if (d.history.length) {
    $("#score-history").hidden = false;
    for (const h of d.history)
      add(
        $("#score-history div"),
        "p",
        `${new Date(h.publishedAt).toLocaleString()} · D ${h.totals.decentralization}/100 · T ${h.totals.transparency}/100 · ${h.reviewer}: ${h.reason}`,
      );
  }
  if (d.checks) renderChecks(d.checks);
}
function prefillBlankFields(result) {
  const f = $('#score-form').elements;
  if(Date.parse(f.start.value)!==result.start || f.end.value!==result.endDate) {
    $('#checks-status').textContent='Observation dates changed. Run checks for the current dates first.';
    return;
  }
  let count=0;
  for(const suggestion of result.suggestions) {
    const field=f[suggestion.criterion+'-evidence'];
    if(field.value.trim() || suggestion.evidence.length>2500)continue;
    field.value=suggestion.evidence;
    count++;
  }
  if(!f.scope.value.trim()) {
    f.scope.value=`Evidence preparation for ${f.start.value} through ${f.end.value} UTC. ${result.metrics.length} linked reporting provider(s). ${result.historyComplete?'Retained telemetry covers the requested period.':'Retained history is incomplete; observed coverage is a lower bound.'} Reporting scope, template control, ownership and accounting still require reviewer confirmation.`;
    count++;
  }
  if(!f.reason.value.trim()) {f.reason.value='Assessment prepared from automated checks; reviewer verification pending.';count++;}
  if(count){$('#publish-controls').hidden=true;$('#score-confirm').checked=false;}
  $('#checks-status').textContent=`Prefilled ${count} empty fields below. Existing entries, scores and review dates were preserved. Review and edit the form, then Save draft & preview.`;
}
function renderChecks(result) {
  const box = $("#checks-results");
  box.replaceChildren();
  const prefill=add(box,'button','Prefill blank form fields ↓');
  prefill.type='button';prefill.className='primary-button';
  prefill.addEventListener('click',()=>prefillBlankFields(result));
  add(
    box,
    "p",
    `Checked ${new Date(result.checkedAt).toLocaleString()} · ${result.historyComplete ? "History retained for this period" : "Incomplete retained history; coverage is a lower bound"}`,
  );
  for (const p of result.metrics)
    add(
      box,
      "p",
      `${p.id}: ${p.coverage.toFixed(2)}% observed time coverage · ${p.reports} reports · ${p.gaps} uncovered ranges (not necessarily downtime) · largest ${p.largestGapMinutes} minutes. ${p.overlap || p.inconsistent ? "Consistency concerns require review." : ""}`,
    );
  add(box, "h3", "Changes since previous check");
  for (const change of result.differences.length
    ? result.differences
    : ["No detected changes in checked metrics or source hashes."])
    add(box, "p", change);
  const apply = (suggestion, withScore = false) => {
    const form = $("#score-form").elements;
    if (
      Date.parse(form.start.value) !== result.start ||
      form.end.value !== result.endDate
    ) {
      $("#checks-status").textContent =
        "Observation dates changed. Run checks again before accepting suggestions.";
      return;
    }
    const field = form[suggestion.criterion + "-evidence"];
    const text = field.value
      ? field.value + "\n\n" + suggestion.evidence
      : suggestion.evidence;
    if (text.length > 2500) {
      $("#checks-status").textContent =
        "This would exceed the evidence limit. Review and shorten the existing evidence first.";
      return;
    }
    field.value = text;
    if (withScore) {
      form[suggestion.criterion + "-percent"].value =
        suggestion.candidatePercent;
      form[suggestion.criterion + "-checked"].value = new Date()
        .toISOString()
        .slice(0, 10);
    }
    $("#publish-controls").hidden = true;
    $("#score-confirm").checked = false;
    $("#checks-status").textContent =
      "Accepted into the unsaved form. Review, then Save draft & preview.";
  };
  add(box, "h3", "Suggested evidence and gaps");
  for (const suggestion of result.suggestions) {
    const panel = add(box, "section", "");
    const rule = rules.find((c) => c.id === suggestion.criterion);
    add(panel, "h4", rule.label);
    add(panel, "p", suggestion.evidence);
    const button = add(panel, "button", "Add note to unsaved draft");
    button.type = "button";
    button.className = "quiet-button";
    button.addEventListener("click", () => {
      apply(suggestion);
    });
    if (suggestion.candidatePercent !== null) {
      add(
        panel,
        "p",
        `Conditional telemetry suggestion: ${suggestion.candidatePercent}% × ${rule.weight} points. Time coverage is not proof of representative work or correct accounting.`,
      );
      const label = add(panel, "label", "");
      const check = document.createElement("input");
      check.type = "checkbox";
      label.append(
        check,
        document.createTextNode(
          " I independently checked the complete reporting scope, units, resets, overlap and block accounting.",
        ),
      );
      const accept = add(panel, "button", "Accept reviewed score suggestion");
      accept.type = "button";
      accept.className = "quiet-button";
      accept.addEventListener("click", () => {
        if (!check.checked) {
          $("#checks-status").textContent =
            "Confirm the required evidence review first.";
          return;
        }
        apply(suggestion, true);
      });
    }
  }
  add(box, "h3", "Public source snapshots");
  for (const source of result.sources) {
    const panel = add(box, "section", "");
    add(panel, "p", source.url);
    add(panel, "p", source.status);
    if (source.hash) add(panel, "p", "Content SHA-256: " + source.hash);
    for (const excerpt of source.snippets) add(panel, "blockquote", excerpt);
    if (source.snippets.length) {
      const button = add(
        panel,
        "button",
        "Add source excerpts to payout evidence",
      );
      button.type = "button";
      button.className = "quiet-button";
      button.addEventListener("click", () =>
        apply({
          criterion: "payout",
          evidence: `Unverified public source retrieved ${new Date(source.checkedAt).toISOString()}: ${source.url}. SHA-256 ${source.hash}. Excerpts (may include navigation or unrelated text): ${source.snippets.join(" / ")}. Reviewer must confirm applicability and current terms.`,
        }),
      );
    }
  }
  add(box, "h3", "Draft follow-up · not sent");
  const draft = document.createElement("textarea");
  draft.value = result.followup;
  draft.rows = 10;
  draft.style.width = "100%";
  box.append(draft);
  const copy = add(box, "button", "Copy follow-up draft");
  copy.type = "button";
  copy.className = "quiet-button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(draft.value);
      $("#checks-status").textContent = "Copied. Nothing has been sent.";
    } catch {
      draft.select();
      $("#checks-status").textContent = "Select and copy the draft manually.";
    }
  });
}
$("#run-checks").addEventListener("click", async () => {
  const button = $("#run-checks");
  button.disabled = true;
  $("#checks-status").textContent =
    "Checking retained telemetry and public sources…";
  try {
    const f = $("#score-form").elements;
    const result = await api("admin/assessment-checks", {
      application,
      start: f.start.value,
      end: f.end.value,
    });
    renderChecks(result);
    prefillBlankFields(result);
  } catch (e) {
    $("#checks-status").textContent = e.message;
  } finally {
    button.disabled = false;
  }
});
$("#score-form").addEventListener("input", () => {
  $("#publish-controls").hidden = true;
  $("#score-confirm").checked = false;
});
$("#score-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    saved = await api("admin/save-scorecard", {
      application,
      version: saved?.version || 0,
      card: readCard(),
    });
    preview(saved);
    $("#publish-controls").hidden = false;
    $("#score-confirm").checked = false;
    $("#score-status").textContent =
      "Draft saved. Review the preview before publishing.";
  } catch (e) {
    $("#score-status").textContent = e.message;
  }
});
$("#score-publish").addEventListener("click", async () => {
  if (!$("#score-confirm").checked) {
    $("#score-status").textContent =
      "Review the preview and confirm before publishing.";
    return;
  }
  const button = $("#score-publish");
  button.disabled = true;
  try {
    const card = await api("admin/publish-scorecard", {
      application,
      version: saved.version,
      poolId: $("#score-profile").value,
      reviewed: true,
    });
    preview(card);
    $("#score-status").textContent = "Scorecard published. ";
    const a = add($("#score-status"), "a", "Open public scorecard →");
    a.href = "/scorecard?pool=" + encodeURIComponent(card.poolId);
  } catch (e) {
    $("#score-status").textContent = e.message;
  } finally {
    button.disabled = false;
  }
});
async function load() {
  try {
    if (location.pathname === "/scoring-rules") {
      const d = await api("scoring-rules");
      document.querySelector("h1").textContent = "Scoring rules · pilot v0.2";
      document.title = "Scoring rules · XBT Pulse";
      const box = document.querySelector("#score-preview");
      box.hidden = false;
      add(
        box,
        "p",
        "Two scores out of 100. Each criterion earns its weight multiplied by the verified result percentage. Missing evidence leaves an axis Not assessed; it is never rescaled. Publication requires all criteria, at least 30 calendar days of observation, evidence reviewed within 30 days, a named reviewer, scope and change reason. Scores are manual assessments under this pilot rubric, not higher tiers.",
      );
      for (const c of d.criteria) {
        add(box, "h2", c.label + " · " + c.weight + " points (" + c.axis + ")");
        add(box, "p", c.rule);
      }
      add(
        box,
        "p",
        "Re-review every 30 days and after material ownership, routing or policy changes. Older assessments remain dated history. Operators can request corrections through the contribution form or their private conversation link; revisions must record the reason and retain prior publication history.",
      );
      document.querySelector("#score-status").textContent =
        "Published pilot rules · September 13, 2026";
      return;
    }
    if (application) {
      const s = await api("admin/session");
      if (!s.authenticated) {
        $("#score-status").textContent = "Admin login required. ";
        const a = add($("#score-status"), "a", "Sign in →");
        a.href = "/admin";
        return;
      }
      csrf = s.csrf;
      populate(
        await api(
          "admin/scorecard?application=" + encodeURIComponent(application),
        ),
      );
      $("#score-status").textContent =
        "Private assessment workspace · pilot rubric v0.2";
    } else {
      const d = await api(
        "scorecard?pool=" + encodeURIComponent(params.get("pool") || ""),
      );
      rules = d.criteria;
      preview(d.card);
      $("#score-status").textContent = "Published reviewer assessment";
    }
  } catch (e) {
    $("#score-status").textContent = e.message;
  }
}
load();
