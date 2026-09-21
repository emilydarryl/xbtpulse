const $ = id => document.getElementById(id);
const date = value => new Date(value).toLocaleString();
function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
}
function render(data) {
  const s = data.snapshot;
  $('node-results').hidden = !s;
  if (!s) {
    $('node-status').textContent = data.status === 'disabled' ? 'Node collection is disabled. No observations available.' : 'Node observations are not available yet. No count is inferred.';
    return;
  }
  const warning = data.status === 'unavailable' ? 'Source refresh failed. Showing the last saved scan; current reachability is unknown.'
    : data.status === 'disabled' ? 'Collection is disabled. Showing the last saved scan.'
    : data.status === 'stale' ? 'Stale source scan. Current reachability is unknown.'
    : data.status === 'partial' ? 'Partial or degraded source scan. This count may understate reachability.'
    : 'Latest source scan available.';
  $('node-status').textContent = `${warning} Observed ${date(s.observedAt)}.${s.resummarisedOnly ? ' The source regenerated its summary without running new probes; the observation time is unchanged.' : ''}${s.partial && data.status !== 'partial' ? ' This scan was partial or degraded.' : ''}`;
  $('node-count').textContent = s.reachable.toLocaleString();
  $('node-scan-time').textContent = `In the scan ending ${date(s.scanFinishedAt)}`;
  $('node-version-count').textContent = s.versions.filter(v => v.version.startsWith('Knots ')).length;
  $('node-network-count').textContent = `${s.networks.ipv4} IPv4 · ${s.networks.tor} Tor`;
  $('node-network-detail').textContent = `${s.networks.ipv6} IPv6 endpoints observed`;
  $('node-scan-scope').textContent = `${s.candidatesAttempted.toLocaleString()} candidates attempted; ${s.handshakes.toLocaleString()} completed handshakes across candidate networks. Only the ${s.reachable.toLocaleString()} advertising BLAKE2b are included above. ${s.candidateLimitReached ? 'The source reached its candidate limit; this is a bounded scan, not a full network census.' : 'Discovery is limited to endpoints known to the source crawler.'}`;
  const rows = s.versions.map(v => {
    const row = element('tr');
    row.append(element('td', v.version), element('td', v.count.toLocaleString()));
    const cell = element('td'), percent = s.reachable ? v.count / s.reachable * 100 : 0;
    cell.append(element('span', `${percent.toFixed(1)}%`));
    const bar = element('div', undefined, 'node-version-bar');
    bar.style.width = `${percent}%`;
    bar.setAttribute('aria-hidden', 'true');
    cell.append(bar); row.append(cell); return row;
  });
  if (!rows.length) { const row=element('tr'), cell=element('td','No reachable endpoints in this source scan.'); cell.colSpan=3; row.append(cell); rows.push(row); }
  $('node-version-rows').replaceChildren(...rows);
  $('node-user-agents').replaceChildren(...s.versions.flatMap(v => v.userAgents.map(agent => element('li', agent))));
  const max = Math.max(1,...data.history.map(h => h.reachable));
  $('node-history').replaceChildren(...data.history.map(h => {
    const row = element('div', undefined, 'node-history-row');
    row.append(element('span',h.day));
    const track=element('div',undefined,'node-history-track'), bar=element('div',undefined,'node-history-bar');
    bar.style.width = `${h.reachable/max*100}%`; bar.setAttribute('aria-hidden','true'); track.append(bar); row.append(track);
    row.append(element('span',`${h.reachable}${h.partial ? ' · partial' : ''}${h.candidateLimitReached ? ' · capped' : ''}`));
    return row;
  }));
  $('node-history-note').textContent = data.history.length < 2
    ? 'History is building. A trend needs observations on at least two UTC days; no earlier counts are invented.'
    : 'Each bar is the last captured source snapshot for that UTC day. Counts are not added together across scans.';
}
async function refresh() {
  try {
    const response=await fetch('/api/nodes',{signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw Error();
    render(await response.json());
  } catch {
    $('node-results').hidden=true;
    $('node-status').textContent='Unable to load node observations. Please try again shortly; no count is inferred.';
  }
}
refresh();
setInterval(() => {if (!document.hidden) refresh();},60000);
