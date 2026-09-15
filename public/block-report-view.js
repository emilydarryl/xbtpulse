const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const statuses = {
  observed: 'Observed on chain',
  'different-block': 'Different block at this height',
  'outside-history': 'Outside retained chain history',
  'awaiting-data': 'Awaiting chain data',
};
export function blockReportSection(feed) {
  if (!feed) return '';
  return `<section class="panel intake-panel" id="reported-blocks" aria-labelledby="reported-blocks-title">
    <p class="eyebrow">OPTIONAL OPERATOR REPORTS</p><h2 id="reported-blocks-title">Operator-reported block finds</h2>
    <p>These operators report finding the blocks below. A chain match confirms the block appears in our collected chain data; it does not verify who found it.</p>
    ${feed.chainStale ? '<p class="freshness-due">Chain data is delayed or unavailable. Statuses reflect the last collected data.</p>' : ''}
    ${feed.reports.length ? `<p class="small muted">${feed.total} reports · newest ${Math.min(feed.total, feed.limit)} shown · reports retained for ${feed.retentionDays} days. Reports can overlap across operators and are not added to attributed block totals or found/expected calculations.</p>
    <div class="table-scroll profile-activity-scroll" role="region" aria-labelledby="reported-blocks-title" tabindex="0"><table><thead><tr><th>Reported block</th><th>Operator</th><th>Chain check</th><th>Chain attribution</th></tr></thead><tbody>${feed.reports.map(r => `<tr>
      <td><strong>#${esc(r.height)}</strong><details><summary>Block hash</summary><code class="block-report-hash">${esc(r.hash)}</code></details><span class="small muted">Reported ${esc(new Date(r.reported).toLocaleString())}</span></td>
      <td>${esc(r.provider)}<br><span class="small muted">Finder: operator-reported</span></td>
      <td>${esc(statuses[r.chainStatus] || 'Awaiting chain data')}${r.blockTime ? `<br><span class="small muted">Block time: ${esc(new Date(r.blockTime * 1000).toLocaleString())}</span>` : ''}</td>
      <td>${r.attribution ? `${esc(r.attribution.name)}<br><span class="small muted">${esc(r.attribution.evidence)}</span>` : 'Not available'}</td></tr>`).join('')}</tbody></table></div>` : '<p><strong>Not reported.</strong> No public block-find reports are available here. This does not mean the operator found zero blocks.</p>'}
    <p><a href="/report-blocks">Report a block or connect an optional feed →</a></p>
  </section>`;
}
