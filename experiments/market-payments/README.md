# XBT Market payments lab — October 22, 2026

**Later October 22 milestones:** an isolated, private on-chain XBTPay deployment uses the owner's locked wallet through a watch-only receiving account and restricted home-to-VPS connection. An owner-sent 10,000-sat payment was detected, confirmed and automatically settled. The received output and locked-wallet credit matched; payment database copies were restored and matched across 87 tables, and the private services restarted successfully. Receipt fee-breakdown labeling is now corrected and the private store adds no network surcharge. A separate private marketplace pilot now creates exact 2% seller-fee invoices and persists reconciliation; its real API test invoice remains unpaid. Public fee collection, escrow and Lightning remain disabled. See [receiving operations](receiving-operations.md) and [fee operations](../../docs/marketplace-fees.md). The original experiments and historical results below remain separate from those deployments.

This is an isolated prototype, outside the production server. It does not sign, broadcast, receive or custody funds. No production fee, escrow requirement or Lightning option was enabled by these experiments.

## Run and inspect

- `node --test test/market-payment-prototype.test.mjs` runs six regression tests, including a real loopback HTTP exchange against a mocked checkout server.
- `node experiments/market-payments/prototype-server.mjs` opens the loopback-only simulation at http://127.0.0.1:4332. Reset lets you try release or dispute/refund paths. Approvals are simulation events, not cryptographic signatures. The simulated funding observer does not query any chain.
- `run-xbtpay-lab.sh` reproduces the pinned upstream checks in disposable, resource-limited Docker containers. It needs an empty `/tmp/xbtpay-lab.*` path, Linux, Docker, Python and Git. It starts no payment daemon and exposes no ports. The SDK digest is pinned.

## What was actually verified

XBTPay source: `connorslab/paperclip-btcpay-xbt` revision `2302618c428ca697c237572593694e4f0d639271`. Its manifest pins BTCPay `2d5a0d8077bb33af080e949031da33d84b80638d` and NBXplorer `702ec61324cad76c81b14a9e181a5a6f60798146`.

The original pinned build passed 10 CLN gateway tests, one LND connection helper test, four NBXplorer XBT tests and 31 BTCPay XBT tests. These are targeted regressions, not a paid merchant checkout. The LND helper uses a mocked node; no real macaroon was created. Windows cannot import the Unix-socket gateway, so the upstream suite ran in the isolated Linux lab instead.

Package restore flagged `System.Security.Cryptography.Pkcs 10.0.0`. The lab added a direct reference to `10.0.13`, the patched version listed for CVE-2026-84008 / GHSA-846f-f764-76mx and CVE-2026-70162 / GHSA-2fmv-rv2c-59x7. The 31 BTCPay tests passed again. `dotnet list ... package --vulnerable --include-transitive` then reported no vulnerable packages given its current configured sources. This is not an audit or a guarantee that every dependency is safe. The override is kept in the disposable lab and reproducible runner, not published to the upstream project.

One additional C# test compared the prototype's sorted 2-of-3 witness script and P2WSH output with NBitcoin's script builder using public test keys. It passed. This does not validate an XBT signature, funding transaction, timelock, PSBT or recovery path.

## Fee and checkout design

The approved trial uses a 2% success-fee quote, rounded upward to whole satoshis. For a 1 XBT order, the proposed seller payout is 0.98 XBT and marketplace fee 0.02 XBT. A separately identified example network reserve is added to the buyer deposit, with unused reserve returned. Real fee estimates and dust checks are still required.

`xbtpay-trial.mjs` follows the pinned Greenfield model: create/search under `/api/v1/stores/{storeId}/invoices`; retrieve under `/api/v1/invoices/{invoiceId}?includePaymentMethods=true`. It uses an XBT-only invoice, metadata binding the order and contract hash, zero payment tolerance, a chosen `XBT-LN` or `XBT-CHAIN` method, and a store-scoped API token. Exact decimal strings are used throughout. Callback authentication uses HMAC-SHA256 over the original bytes. A signed callback prompts an authenticated invoice lookup; an order metadata mismatch, wrong currency/method, manual status, partial payment or incorrect settled amount fails closed. A browser redirect cannot credit a fee.

The callback replay set is memory-only. Production needs a transactional, persistent invoice/order/credit ledger and reconciliation for downtime, reorgs, duplicate creation and exceptional payments. This client deliberately requires `mode: isolated-trial` and is not imported by `server.mjs`.

The fee invoice harness and split escrow payout are **alternative collection experiments**, not two charges to apply together. A basic 2-of-3 script does not force a marketplace fee output: two holders can construct a different payout outside the app. Resolve the collection policy (for example a separately paid service invoice with explicit cancellation/refund terms) before claiming an unavoidable success fee. Direct trades arranged outside checkout can also bypass fees.

## Proposed escrow shipping policy

- Every physical shipment uses tracking. Initial escrow shipments also require a delivery signature; no buyer waiver in the pilot. Low-value direct-pay shipments may leave signature optional.
- The parties choose a supported courier and service, shipping deadline, inspection period, shipping charges and refund/return terms before funding. The example inspection window is 72 hours; it is a product proposal, not a live promise.
- Signature-required does not mean adult-signature or ID-restricted delivery. Carrier rules differ by service/destination; an unsupported route cannot be treated as signature-protected. Carrier ID requirements do not imply that XBT Market collects KYC documents.
- Confirm the specific XBT output, value, script and required confirmations before permitting shipment. A transaction ID alone is insufficient. The prototype only simulates these checks.
- Signed proof of delivery must match the agreed shipment and destination. A signature can be from another person at the address and does not establish correct parcel contents. It opens inspection, not automatic payout.
- Missing, damaged or wrong items, suspected misdelivery, returns and a silent participant go to a documented dispute process. Tracking or a timer alone never automatically pays the seller. The mediator's evidence rules, response times, return costs and appeals/recovery still need operational approval.
- Buyer and seller normally authorize release. A disputed payout requires the agreed resolver plus a participant. The resolver cannot spend alone, but collusion with one participant is still a risk of this model.
- A full cancellation in this simulation waives the success fee; actual network costs remain. Partial payouts must conserve the deposit and explicitly state treatment of the fee.
- Public test keys are used. No address is generated for funding, and no customer funds may be sent to derived test scripts.

## Requirements before a funded trial or production

Dedicated XBT Knots backend; verified XBT chain identity and replay-protected signer interoperability; backed-up merchant/Lightning wallet; outbound and inbound channel liquidity as appropriate; least-privilege invoice credentials and TLS; persistent accounting; complete recovery and unresponsive-party rules; real fee/dust estimation; private shipping evidence and dispute tooling; named resolver and secure independent signing setup. XBTPay's receiving integration does not implement shared-control escrow or seller payouts/refunds.

Next milestone is an operator-controlled paid invoice test against an XBT node with inbound liquidity. No credentials, wallet seeds, funding requests, payments, channel openings or production configuration changes were part of this run.

## Primary references checked

- [XBTPay source and requirements](https://github.com/connorslab/paperclip-btcpay-xbt)
- [XBT Lightning fork and chain identity](https://github.com/paulscode/lightning-fork)
- [Shrike multisig/replay-protection notes](https://github.com/privkeyio/shrike/blob/master/README.md)
- [USPS signature service distinctions](https://faq.usps.com/articles/Knowledge/Adult-Signature-Required-and-Adult-Signature-Restricted-Delivery-Services)
- [FedEx signature and declared-value policy](https://www.fedex.com/en-us/shipping/declared-value.html)
- [Microsoft high-severity package advisory](https://github.com/advisories/GHSA-846f-f764-76mx)
