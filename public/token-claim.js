const $ = s => document.querySelector(s);
const [encodedProvider, secret] = location.hash.slice(1).split(":");
let provider = "", issued = "";
try { provider = decodeURIComponent(encodedProvider || ""); } catch {}
// The secret is never placed in query strings, storage, messages or DOM text.
history.replaceState(null, "", location.pathname);
async function request(confirm = false) {
  const response = await fetch("/api/token-claim?" + new URLSearchParams({provider}), {
    method: confirm ? "POST" : "GET", cache: "no-store",
    headers: {Authorization: "Bearer " + (secret || ""), ...(confirm ? {"Content-Type":"application/json"} : {})},
    body: confirm ? JSON.stringify({confirm:true}) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "Request failed");
  return result;
}
$("#claim-confirm").addEventListener("change", () => { $("#claim-create").disabled = !$("#claim-confirm").checked; });
$("#claim-create").addEventListener("click", async () => {
  if (!$("#claim-confirm").checked) return;
  $("#claim-create").disabled = true;
  $("#claim-controls").hidden = true;
  try {
    const result = await request(true); issued = result.token;
    $("#claim-result").hidden = false;
    $("#claim-status").textContent = "Token generated. Save token.txt before leaving this page.";
  } catch {
    $("#claim-status").textContent = "Token claim could not be confirmed. It may already have been used. Ask XBT Pulse for a new claim link; do not assume the old token still works.";
  }
});
$("#claim-download").addEventListener("click", () => {
  if (!issued) return;
  const url = URL.createObjectURL(new Blob([issued + "\n"], {type:"text/plain"}));
  const a = document.createElement("a"); a.href = url; a.download = "token.txt"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("#claim-clear").addEventListener("click", () => {
  issued = ""; $("#claim-result").hidden = true;
  $("#claim-status").textContent = "Token cleared from this page. Keep your downloaded file private.";
});
window.addEventListener("pagehide", () => {issued = "";});
request().then(result => {
  $("#claim-provider").textContent = "Provider: " + result.provider;
  $("#claim-status").textContent = "Link valid until " + new Date(result.expires).toLocaleString();
  $("#claim-controls").hidden = false;
}).catch(() => {$("#claim-status").textContent = "Link unavailable. Ask XBT Pulse for a new private claim link.";});
