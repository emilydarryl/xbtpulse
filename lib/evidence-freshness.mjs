const DAY = 86400000;
function reviewed(value, now) {
  const time = typeof value === 'number' ? value : Date.parse(value);
  if (!value || !Number.isFinite(time) || time > now) return {status:'Not reviewed', reviewedAt:null, dueAt:null};
  return {status:now-time>30*DAY ? 'Review due' : 'Within review period',reviewedAt:new Date(time).toISOString(),dueAt:new Date(time+30*DAY).toISOString()};
}
export function evidenceFreshness({attribution,profile,scorecard,providers=[]},now=Date.now()) {
  const dates = scorecard ? [scorecard.end,...(scorecard.rows || []).map(r=>r.checked)] : [];
  const validDates = dates.map(d=>Date.parse(d));
  const oldest = validDates.length && validDates.every(d=>Number.isFinite(d)&&d<=now) ? Math.min(...validDates) : null;
  return {
    checkedAt:now, reviewPeriodDays:30,
    attribution:reviewed(attribution?.reviewedAt,now),
    profile:reviewed(profile?.reviewedAt,now),
    assessment:scorecard ? reviewed(oldest,now) : {status:'Not assessed',reviewedAt:null,dueAt:null},
    telemetry:providers.map(p=>({
      name:p.name,lastReport:p.lastReport || null,lastWorkReport:p.lastWorkReport || null,
      status:!p.active ? 'Inactive' : !p.lastReport ? 'Awaiting reports' : p.lastReport>now || now-p.lastReport>1800000 ? 'Stale' : !p.lastWorkReport || p.lastWorkReport>now || now-p.lastWorkReport>1800000 ? 'Reporting; no recent positive work' : 'Reporting'
    }))
  };
}
