# Private on-chain receiving evaluation — October 22, 2026

An isolated XBTPay installation now runs under `/opt/xbtpulse-payments` on the existing VPS. It is **not connected to the public marketplace order workflow**. One owner-funded 10,000-sat on-chain receiving test settled successfully. No channel, escrow funding or marketplace fee was collected. Lightning is disabled in the store.

## Verified state

- The owner's dedicated `xbtpulse` descriptor wallet is encrypted and locked on the synced XBT mainnet Knots 29.4.2 node. Spending keys were not exported. The owner created the wallet and the private XBTPay administrator account.
- The VPS holds only the merchant account's public receiving information and a separate read-proxy capability. Three derived receiving addresses matched the node, the indexer and the store's import confirmation.
- NBXplorer connected through authenticated RPC and P2P, verified the XBT fork checkpoint, reached Ready and observed new mainnet blocks. Observation starts at height **978511** for this new wallet; this is not a historical wallet rescan.
- The private **XBT Pulse** store uses XBT as its default currency. On-chain XBT is enabled; Lightning is explicitly disabled. An unpaid `0.00010000 XBT` invoice labeled `SETUP TEST - DO NOT PAY` generated the matching destination and an on-chain checkout. It was archived unpaid. Archiving hides an invoice; it does not cancel monitoring or make its address unusable.
- After reporting that the wallet backup was saved, the owner sent a separate 10,000-sat XBT test payment. The indexer detected the exact output in the mempool; the node wallet recorded the same credit while remaining locked. After one confirmation at height 978518, the invoice and payment record automatically became Settled, and the checkout displayed Invoice Paid. The receiving output was still unspent for the full 10,000 sats. No signing, broadcasting or manual Paid action was performed by the agent.
- The payment receipt displayed Total Price 9,900 sats plus Network Cost 100 sats and Amount Paid 10,000 sats, although the invoice's stored amount was 10,000 sats. No platform fee output or deduction from the receiving output occurred. The server displays `accounting.TotalDue - (PaymentMethodFee - TweakFee)` as OrderAmount; review the prompt's fee mode and this breakdown before merchant checkout integration. Its accounting/display interpretation is not yet resolved.
- Refunds, spending-wallet recovery, induced reorgs, complete VPS loss and Lightning recovery remain untested. A successful receive does not verify those flows.

## Connection and access boundaries

The home gateway runs two user services: `xbtpulse-node-read-proxy.service` and `xbtpulse-payments-tunnel.service`. Both are enabled; user lingering is enabled so they can start without an interactive login. A dedicated SSH key stays on the gateway. Its VPS account permits only remote TCP forwards to `127.0.0.1:18332` (read RPC) and `127.0.0.1:18333` (P2P); shell sessions, extra listeners, local forwarding, Unix-socket forwarding and agent forwarding are denied. The VPS host key is pinned. A tunnel restart recovered and the checkpoint passed again; a full VM reboot was not performed.

The proxy listens on gateway loopback only, reads the existing node credential locally, pins the expected upstream endpoint and exposes an explicit read-method allowlist. Wallet creation/import/unlock, descriptors, private-key export, signing, broadcasting and node shutdown RPCs are unavailable. Mixed batches are filtered per call. Tests cover authentication, wallet-path rejection, forbidden methods, malformed parameters and batch limits. The VPS never receives the mining node's RPC password.

The database, indexer and web containers use host networking with **explicit loopback binds**, dedicated data and resource limits. Verified listeners: `18332`, `18333`, `23000`, `24444` and `25432`, all `127.0.0.1` only. Do not change these to wildcard binds or attach the checkout to the public proxy during evaluation. Existing marketplace/Caddy containers, mining services and node configuration were preserved.

Operator access uses a separate local SSH forward, for example:

```powershell
ssh -NT -i "$env:USERPROFILE\.ssh\emilygaming_multiplayer_ed25519" -o BatchMode=yes -o StrictHostKeyChecking=yes -o ExitOnForwardFailure=yes -L 127.0.0.1:23300:127.0.0.1:23000 root@2.25.153.143
```

Then open `http://127.0.0.1:23300/`. HTTP travels only over loopback and the authenticated SSH tunnel. No public DNS or TLS route was added. The local forward is a session convenience and must be reopened after the PC restarts. The home-to-VPS service is independently supervised.

## Build and runtime

The XBTPay source remains pinned to `2302618c428ca697c237572593694e4f0d639271`, using the existing BTCPay/NBXplorer pins in the lab README. Prepared source and published outputs are stored under the private VPS directory. No generated source or credential files belong in this repository.

The receiving build retains the Pkcs `10.0.13` override. Release-only SourceLink pulled `Microsoft.Build.Tasks.Git 8.0.0`; the private build overrides it to `10.0.303` with `PrivateAssets=All`, following [Microsoft's advisory](https://github.com/advisories/GHSA-23fw-v26w-5fgq). Targeted XBT Release tests passed and the resulting dependency audit reported no vulnerable packages against its configured sources. The SDK is the pinned digest recorded in the lab runner.

Runtime ASP.NET `10.0.13-noble` is pinned to `mcr.microsoft.com/dotnet/aspnet@sha256:8af87eba5e7cdafb1514d7388be287365da97c132509e84dfe252ffd552398ca`. PostgreSQL is pinned to `postgres@sha256:858bb5e98eed02eb8cafbcdc007f9a65d1b613972028944a8ec2133ccaf80d27`. The public [receiving Compose template](receiving-compose.yaml) requires those deployment values and dedicated private credentials through a mode-0600 `.env`.

## Recovery and stop procedure

The private deployment has `receiving-verification.json`, build/audit logs and a pre-funding PostgreSQL cluster dump under `backups/`. The original dump's compression and completion were checked. After the real test receipt, web/indexer services were stopped and both databases were separately dumped in custom format. Each dump was restored into a disposable database; every public table's row count and sorted row-content fingerprint matched the paused source (68 BTCPay tables; 19 NBXplorer tables). The exact invoice, payment method, amount, currency and Settled statuses also matched. Temporary restore databases were removed, the private services restarted, and checkout still displayed Invoice Paid. Results and dump paths are recorded privately in `funded-test-db-recovery.json`; transaction/output observations are in `funded-test-observation.json`.

This was database restoration inside the existing database host, not complete-machine disaster recovery. Preserve the dedicated `.env` and app configuration separately; the original cluster dump omits role passwords. No copy of the spending wallet or seed was made. The owner reported making a wallet backup, but its restore has not been tested. An encrypted off-server payment/configuration backup remains outstanding. Never publish the private transaction/invoice records or wallet account information with these public operation notes.

To stop just this evaluation on the VPS:

```sh
cd /opt/xbtpulse-payments
docker compose stop
```

To stop its home gateway connection, run as the gateway user:

```sh
systemctl --user disable --now xbtpulse-payments-tunnel.service xbtpulse-node-read-proxy.service
```

Do not delete wallet files, data directories, `.env`, backups, existing mining configuration or unrelated Lightning configuration. For credential revocation, remove the dedicated tunnel key from its VPS account and rotate the proxy capability together with its private indexer environment; never rotate the mining RPC password as a shortcut.

## Next bounded milestone

The first real receive, confirmation, settlement and payment-database recovery checks are complete. Resolve the receipt fee-breakdown discrepancy before public checkout. Then build and test store-scoped invoice creation, durable order/invoice/payment accounting, authenticated callbacks with authoritative rechecks, duplicate prevention, downtime reconciliation and exceptional-payment handling in the marketplace. Do not enable checkout merely because this isolated store can receive. Finish off-server backup and compatible wallet restore testing separately. A manual Paid action is not proof of receipt.

The node has no reported txindex and NBXplorer warns that its P2P connection is not whitelisted. Forward indexing reached Ready without either change. Do not restart/reindex the mining node or add broad permissions merely to suppress the warning; evaluate historical recovery and disconnection behavior separately. Lightning requires a separate compatible node wallet and funded channel with inbound liquidity. Shared-control shipping escrow and the final fee policy remain separate work.
