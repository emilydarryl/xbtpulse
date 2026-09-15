const form = document.querySelector('#block-report-form');
const result = document.querySelector('#block-report-result');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  result.textContent = 'Submitting…';
  try {
    const response = await fetch('/api/block-reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + form.elements.token.value.trim() },
      body: JSON.stringify({ height: Number(form.elements.height.value), hash: form.elements.hash.value.trim(), action: form.elements.action.value }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to submit this report.');
    result.textContent = body.action === 'withdraw' ? 'Your report is withdrawn from the public list.' : body.duplicate ? 'This report was already received. No duplicate was added.' : 'Report received. The profile shows the separate chain check.';
    for (const profile of body.profiles) {
      const link = document.createElement('a');
      link.href = '/pool?id=' + encodeURIComponent(profile.id) + '#reported-blocks';
      link.textContent = 'View ' + profile.name;
      result.append(document.createElement('br'), link);
    }
    form.elements.confirm.checked = false;
  } catch (error) {
    result.textContent = error.name === 'TimeoutError' || error.message === 'Failed to fetch' ? 'No acknowledgment received. Retry the same report; duplicates are safe.' : error.message;
  } finally {
    form.elements.token.value = '';
    button.disabled = false;
    result.focus();
  }
});
