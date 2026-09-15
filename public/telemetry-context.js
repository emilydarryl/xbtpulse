// Reporting coverage describes submitted time intervals, never pool uptime.
export function coverageLabel(provider) {
  if (!Number.isFinite(provider.coverage)) return 'Coverage not available';
  return `${(provider.coverage * 100).toFixed(1)}% of last 24h · ${provider.reportCount} intervals`;
}
export function outcomeLabel(provider) {
  return provider.found == null ? 'Work reported; block outcomes unavailable' : 'Work and block outcomes reported';
}
export const coverageExplanation = 'Coverage is the time covered by retained reporting intervals wholly inside the last 24 hours, not pool uptime or network coverage. Missing time is unknown. Expected blocks use only reported work; they are not a forecast. Reports do not prove who built the templates or that every pool connection is covered.';
