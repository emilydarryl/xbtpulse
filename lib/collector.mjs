import { forkHeight } from "./source.mjs";
export function validateChain(blocks) {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (
      !Number.isSafeInteger(b.height) ||
      !Number.isFinite(b.time) ||
      !Number.isFinite(b.difficulty) ||
      b.difficulty <= 0 ||
      !/^[a-f0-9]{64}$/.test(b.hash) ||
      !b.outputs.every((o) => Number.isSafeInteger(o.sats) && o.sats >= 0)
    )
      throw new Error("Malformed block observation");
    if (
      i &&
      (blocks[i - 1].height !== b.height + 1 ||
        blocks[i - 1].previousHash !== b.hash)
    )
      throw new Error("Non-contiguous canonical block window");
  }
}
export class Collector {
  constructor(store, source, { retention = 2016, batch = 24 } = {}) {
    this.store = store;
    this.source = source;
    this.retention = retention;
    this.batch = batch;
    this.busy = false;
  }
  async poll() {
    if (this.busy || !this.source) return;
    this.busy = true;
    try {
      await this.source.verify();
      const tip = await this.source.tip();
      if (!Number.isSafeInteger(tip) || tip < forkHeight)
        throw new Error("Invalid chain tip");
      let stored = this.store.blocks(this.retention),
        head = stored[0];
      if (
        head &&
        (head.height > tip ||
          (await this.source.hash(head.height)) !== head.hash)
      ) {
        this.store.reset({
          oldTip: head.hash,
          oldHeight: head.height,
          newHeight: tip,
          depth: null,
          note: "Canonical mismatch; retained window rebuilt. Reorg depth not established.",
        });
        stored = [];
        head = null;
      }
      const min = Math.max(forkHeight, tip - this.retention + 1);
      let fetched = [];
      if (!head || tip > head.height) {
        if (head && tip - head.height > this.batch) {
          this.store.reset({
            note: "Collector catch-up gap; not a reorg claim",
            oldHeight: head.height,
            newHeight: tip,
          });
          stored = [];
          head = null;
        }
        fetched = await this.source.range(
          tip,
          head
            ? Math.max(min, head.height + 1)
            : Math.max(min, tip - this.batch + 1),
        );
      } else if (stored.at(-1).height > min) {
        const high = stored.at(-1).height - 1;
        fetched = await this.source.range(
          high,
          Math.max(min, high - this.batch + 1),
        );
      }
      const combined = [...stored, ...fetched]
        .sort((a, b) => b.height - a.height)
        .slice(0, this.retention);
      validateChain(combined);
      if (
        combined.length &&
        (await this.source.hash(combined[0].height)) !== combined[0].hash
      )
        throw new Error("Chain changed during collection; retrying next poll");
      this.store.saveBlocks(fetched, this.retention);
      this.store.set("lastSuccess", Date.now());
      this.store.set("lastError", null);
      this.store.set("source", this.source.name);
      this.store.set("tip", tip);
    } catch (error) {
      this.store.set("lastError", String(error.message).slice(0, 180));
      console.error("Collector:", error.message);
    } finally {
      this.busy = false;
    }
  }
}
