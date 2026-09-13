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
if (pool && !["explorer:soveroot", "explorer:lazarus"].includes(pool)) {
  const notice = document.querySelector("#map-context");
  notice.hidden = false;
  notice.textContent =
    "This operator is not mapped yet. Showing the Soveroot–Lazarus example; no relationship is implied for the operator you came from.";
}
select(selected);
