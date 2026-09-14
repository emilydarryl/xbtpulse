// Curated, public evidence only. Telemetry freshness never upgrades topology claims.
const items = {
  miners: [
    "Miners",
    "Unknown · illustrative group",
    "Individual devices, worker identities and miner counts are not published on this map.",
    "Mining hardware performs proof of work. Its presence here does not identify an owner, a live connection or who selected the transactions.",
  ],
  "miner-link": [
    "Miners → Soveroot",
    "Context only",
    "This connection illustrates hardware receiving work through a gateway. Individual miner connections have not been mapped.",
    "Do not infer miner counts, ownership or template control from this arrow.",
  ],
  soveroot: [
    "Soveroot",
    "Private gateway · template role under review",
    "The DATUM gateway and its upstream connection were inspected on September 13, 2026. Soveroot participates in numeric work reporting.",
    "Work reports measure activity. They do not independently prove local template construction, common ownership or all upstream dependencies.",
    "/pool?id=explorer%3Asoveroot",
  ],
  upstream: [
    "Soveroot → Lazarus",
    "Reviewed connection snapshot · September 13, 2026",
    "A local inspection of Soveroot’s DATUM gateway status showed it connected and ready, identifying Lazarus as its upstream pool. The inspection was performed with the owner’s authorization.",
    "Scope: the displayed upstream connection at inspection time. Template independence and common ownership were not established. This relationship is not continuously verified.",
    "/pool?id=explorer%3Asoveroot",
  ],
  lazarus: [
    "Lazarus",
    "Identified upstream · broader role under review",
    "Lazarus was identified as Soveroot’s upstream pool in the inspected gateway status. Payout coordination and template construction are separate responsibilities.",
    "The map does not establish Lazarus’s ownership, full gateway population, or who constructs every template.",
    "/pool?id=explorer%3Alazarus",
  ],
  "network-link": [
    "Payout pool → XBT network",
    "Context only",
    "This arrow places the payout pool in the context of blocks and coinbase payouts on the XBT network.",
    "It is not a measured network route, a block attribution claim, or evidence that the pool builds all templates.",
  ],
  network: [
    "XBT network",
    "Shared chain · outside the scope of this topology",
    "The dashboard observes blocks and their available attribution. This map explains a small set of relationships within that wider network.",
    "Node sizes and arrows do not represent network share. Missing operators are not evidence of inactivity.",
    "/",
  ],
};
const panel = document.querySelector("#map-details");
function select(key) {
  const [name, status, evidence, limit, link] = items[key];
  document
    .querySelectorAll("[data-item]")
    .forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.item === key)),
    );
  panel.replaceChildren();
  for (const [tag, text, cls] of [
    ["p", status, "eyebrow"],
    ["h2", name, ""],
    ["p", evidence, ""],
    ["p", limit, "muted"],
  ]) {
    const element = document.createElement(tag);
    element.textContent = text;
    element.className = cls;
    panel.append(element);
  }
  if (link) {
    const a = document.createElement("a");
    a.href = link;
    a.textContent = "Open supporting profile / dashboard →";
    panel.append(a);
  }
}
document
  .querySelectorAll("[data-item]")
  .forEach((button) =>
    button.addEventListener("click", () => select(button.dataset.item)),
  );
const pool = new URL(location.href).searchParams.get("pool");
const selected =
  pool === "explorer:soveroot"
    ? "soveroot"
    : pool === "explorer:lazarus"
      ? "lazarus"
      : "upstream";
async function showPublishedOperator(id) {
  const surface = document.querySelector(".map-surface");
  const notice = document.querySelector("#map-context");
  surface.hidden = true;
  panel.replaceChildren();
  notice.hidden = false;
  notice.textContent = "Loading this operator’s published details…";
  try {
    const response = await fetch("/api/pool?" + new URLSearchParams({id}));
    if (!response.ok) throw Error("Profile unavailable");
    const data = await response.json();
    const profile = data.profile;
    notice.textContent = "Operator view · connections have not been independently mapped.";
    const section = document.createElement("section");
    section.className = "map-surface";
    const heading = document.createElement("h2");
    heading.textContent = data.name;
    section.append(heading);
    const node = document.createElement("button");
    node.className = "map-node";
    node.dataset.item = "published-operator";
    node.setAttribute("aria-pressed", "true");
    for (const text of [data.name, profile?.poolType === "private" ? "Private operator" : "Pool operator", "Connections not yet mapped"]) {
      const line = document.createElement("span");
      line.textContent = text;
      node.append(line);
    }
    section.append(node);
    const explanation = document.createElement("p");
    explanation.className = "small muted";
    explanation.textContent = "No connection arrows are drawn without reviewed relationship evidence. An unmapped connection does not mean the operator is inactive.";
    section.append(explanation);
    surface.after(section);
    const claims = profile
      ? ["Published operator claims", profile.reviewedAt ? "Reviewed for publication: " + new Date(profile.reviewedAt).toLocaleDateString() : "Review date unavailable", "Protocols: " + (profile.protocols || "Not provided"), "Template role: " + (profile.template || "Not provided"), "Payout method: " + (profile.payout || "Not provided")].join(" · ")
      : "No published operator claims are available yet.";
    items["published-operator"] = [data.name, "Operator profile · relationships unverified", claims,
      "These submitted details do not verify template construction, upstream connections or ownership. Telemetry and block attribution are separate evidence.",
      "/pool?" + new URLSearchParams({id})];
    node.addEventListener("click", () => select("published-operator"));
    select("published-operator");
  } catch {
    notice.textContent = "This operator’s details are unavailable. No unrelated example has been selected.";
    const link = document.createElement("a");
    link.href = "/pools";
    link.textContent = "Find an operator in the directory →";
    panel.append(link);
  }
}
if (pool && !["explorer:soveroot", "explorer:lazarus"].includes(pool)) {
  showPublishedOperator(pool);
} else {
  select(selected);
}
