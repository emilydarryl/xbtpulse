import test from "node:test";
import assert from "node:assert/strict";
import {Store} from "../lib/store.mjs";
import {initializeAdmin,digest} from "../lib/admin.mjs";
import {createTokenClaim,inspectTokenClaim,redeemTokenClaim} from "../lib/token-claims.mjs";
test("claim links expire, are scoped and one-use, and never store raw tokens", () => {
  const s=new Store(":memory:"); initializeAdmin(s);
  try {
    s.addApplication({id:"a",name:"Test"});s.approveApplication("a","provider",digest("old"));
    const first=createTokenClaim(s,"provider",1000), secret=first.claimLink.split(":").at(-1);
    assert.equal(s.providerForHash(digest("old")),"provider");
    assert.throws(()=>inspectTokenClaim(s,"other",secret,1001));
    assert.throws(()=>inspectTokenClaim(s,"provider","0".repeat(64),1001));
    assert.throws(()=>inspectTokenClaim(s,"provider",secret,first.expires));
    const replacement=createTokenClaim(s,"provider",2000), next=replacement.claimLink.split(":").at(-1);
    assert.throws(()=>redeemTokenClaim(s,"provider",secret,2001));
    const result=redeemTokenClaim(s,"provider",next,2001);
    assert.equal(s.providerForHash(digest(result.token)),"provider");
    assert.notEqual(s.providerForHash(digest("old")),"provider");
    assert.throws(()=>redeemTokenClaim(s,"provider",next,2002));
    assert.equal(s.db.prepare("SELECT COUNT(*) n FROM token_claims").get().n,0);
    assert.equal(JSON.stringify(s.db.prepare("SELECT * FROM admin_audit").all()).includes(result.token),false);
  } finally {s.close();}
});
test("revocation, rotation and loss of approval invalidate pending claims", () => {
  for(const mutation of [s=>s.revokeProvider("p"),s=>s.db.prepare("UPDATE providers SET token_hash=?").run(digest("replacement")),s=>s.db.prepare("UPDATE applications SET status='declined'").run()]) {
    const s=new Store(":memory:");initializeAdmin(s);
    try {
      s.addApplication({id:"a"});s.approveApplication("a","p",digest("old"));
      const secret=createTokenClaim(s,"p").claimLink.split(":").at(-1);mutation(s);
      assert.throws(()=>redeemTokenClaim(s,"p",secret));
    } finally{s.close();}
  }
});

