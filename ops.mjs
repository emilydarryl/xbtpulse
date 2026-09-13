import { randomBytes, createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { Store } from "./lib/store.mjs";
import { initializeAdmin, bootstrap } from "./lib/admin.mjs";
const store = new Store(
  join(resolve(process.env.DATA_DIR || "./data"), "pulse.sqlite"),
);
const [command, id, provider] = process.argv.slice(2);
initializeAdmin(store);
try {
  if (command === "admin-bootstrap") {
    console.log(
      "Visit https://xbtpulse.tech/admin and enter this setup code within 30 minutes:\n" +
        bootstrap(store),
    );
  } else if (command === "admin-reset") {
    store.set("admin-password", null);
    store.set("admin-login-limit", null);
    store.db.exec("DELETE FROM admin_sessions");
    console.log(
      "Admin access reset. New setup code (30 minutes):\n" + bootstrap(store),
    );
  } else if (command === "list")
    console.log(JSON.stringify(store.applications(), null, 2));
  else if (command === "approve" && id && provider) {
    const token = randomBytes(32).toString("hex");
    store.approveApplication(
      id,
      provider,
      createHash("sha256").update(token).digest("hex"),
    );
    console.log(
      JSON.stringify({
        provider,
        token,
        note: "Shown once. Deliver privately to the reviewed operator. Never post publicly.",
      }),
    );
  } else if (command === "revoke" && id) {
    store.revokeProvider(id);
    console.log("Provider revoked.");
  } else if (command === "reject" && id) {
    store.rejectApplication(id);
    console.log("Pending application removed.");
  } else
    throw new Error(
      "Usage: node ops.mjs admin-bootstrap | admin-reset | list | approve APPLICATION_ID PROVIDER_ID | revoke PROVIDER_ID | reject APPLICATION_ID",
    );
} finally {
  store.close();
}
