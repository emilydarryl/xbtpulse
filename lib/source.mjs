import {sourceCharacteristics} from './block-characteristics.mjs';
const forkHeight = 961640;
const forkHash =
  "0000000000000050c1e5f69672f459293be14f46e5a494e7a8c8541396f18eeb";
async function get(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!r.ok) throw new Error(`Source HTTP ${r.status}`);
  return r;
}
function textTag(hex) {
  return Buffer.from(hex || "", "hex")
    .toString("utf8")
    .replace(/[^\x20-\x7e]/g, " ")
    .trim();
}
export class ExplorerSource {
  constructor(base) {
    this.supportsCharacteristics = true;
    this.base = base.replace(/\/$/, "");
    this.name = "Public explorer: " + new URL(this.base).hostname;
  }
  async verify() {
    if ((await this.hash(forkHeight)) !== forkHash)
      throw new Error(
        "Source does not match the pinned Blake2b fork checkpoint",
      );
  }
  async hash(height) {
    return (
      await (await get(`${this.base}/block-height/${height}`)).text()
    ).trim();
  }
  async tip() {
    return Number(await (await get(`${this.base}/blocks/tip/height`)).text());
  }
  async range(high, low) {
    const blocks = [];
    for (let height = high; height >= low; ) {
      const batch = await (
        await get(`${this.base}/v1/blocks/${height}`)
      ).json();
      if (!Array.isArray(batch) || !batch.length)
        throw new Error("No source blocks returned");
      const chosen = batch.filter((b) => b.height <= height && b.height >= low);
      if (!chosen.length || chosen[0].height !== height)
        throw new Error("Unexpected source block range");
      for (let i = 0; i < chosen.length; i += 4) {
        blocks.push(
          ...(await Promise.all(
            chosen.slice(i, i + 4).map(async (b) => {
              const txid = (
                await (await get(`${this.base}/block/${b.id}/txid/0`)).text()
              ).trim();
              const tx = await (await get(`${this.base}/tx/${txid}`)).json();
              if (!tx.vin?.[0]?.is_coinbase)
                throw new Error("Expected a coinbase transaction");
              return {
                ...sourceCharacteristics(b),
                height: b.height,
                hash: b.id,
                previousHash: b.previousblockhash,
                time: b.timestamp,
                difficulty: b.difficulty,
                tag: textTag(tx.vin[0].scriptsig),
                source: this.base,
                reportedPool: b.extras?.pool || null,
                outputs: tx.vout
                  .filter((o) => o.value > 0)
                  .map((o) => ({
                    address:
                      o.scriptpubkey_address || `script:${o.scriptpubkey}`,
                    sats: o.value,
                  })),
              };
            }),
          )),
        );
      }
      height = chosen.at(-1).height - 1;
    }
    return blocks;
  }
}
export class RpcSource {
  constructor(url, user, password) {
    this.supportsCharacteristics = true;
    this.url = url;
    this.auth = Buffer.from(`${user}:${password}`).toString("base64");
    this.name = "Dedicated Blake2b node";
  }
  async rpc(method, params = []) {
    const r = await (
      await get(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${this.auth}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "xbtpulse",
          method,
          params,
        }),
      })
    ).json();
    if (r.error) throw new Error(`Node RPC ${method} failed`);
    return r.result;
  }
  async verify() {
    if ((await this.hash(forkHeight)) !== forkHash)
      throw new Error("Node does not match the pinned Blake2b fork checkpoint");
    const info = await this.rpc("getblockchaininfo");
    if (info.initialblockdownload)
      throw new Error("Node is still synchronizing");
  }
  hash(height) {
    return this.rpc("getblockhash", [height]);
  }
  tip() {
    return this.rpc("getblockcount");
  }
  async range(high, low) {
    const result = [];
    for (let height = high; height >= low; height--) {
      const hash = await this.hash(height),
        b = await this.rpc("getblock", [hash, 2]),
        tx = b.tx[0];
      if (!tx.vin?.[0]?.coinbase)
        throw new Error("Expected a coinbase transaction");
      result.push({
        ...sourceCharacteristics(b,true),
        height,
        hash,
        previousHash: b.previousblockhash,
        time: b.time,
        difficulty: b.difficulty,
        tag: textTag(tx.vin[0].coinbase),
        source: "Dedicated node",
        reportedPool: null,
        outputs: tx.vout
          .filter((o) => o.value > 0)
          .map((o) => ({
            address:
              o.scriptPubKey.address ||
              o.scriptPubKey.addresses?.[0] ||
              `script:${o.scriptPubKey.hex}`,
            sats: Math.round(o.value * 1e8),
          })),
      });
    }
    return result;
  }
}
export { forkHeight, forkHash };
