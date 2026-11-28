#!/bin/sh
set -eu

# Render's persistent disk is mounted at /paperclip. Regenerate the config on
# every boot (not just the first) from the environment so a DATABASE_URL change
# takes effect on the next restart — the config is fully derived from env vars,
# so this is idempotent.
export PAPERCLIP_HOME="${PAPERCLIP_HOME:-/paperclip}"
config_dir="$PAPERCLIP_HOME/instances/default"
config_file="$config_dir/config.json"
mkdir -p "$config_dir"

node --input-type=module <<'NODE'
import fs from "node:fs";
import path from "node:path";

const home = process.env.PAPERCLIP_HOME || "/paperclip";
const configPath = path.join(home, "instances", "default", "config.json");
const publicUrl = process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL || process.env.PAPERCLIP_PUBLIC_URL;
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Render startup: DATABASE_URL is required for the hosted PostgreSQL deployment.");
  process.exit(1);
}
if (!publicUrl) {
  console.error("Render startup: set PAPERCLIP_AUTH_PUBLIC_BASE_URL or PAPERCLIP_PUBLIC_URL to the service's https URL.");
  process.exit(1);
}
const config = {
  $meta: { version: 1, updatedAt: new Date().toISOString(), source: "configure" },
  database: {
    mode: "postgres",
    connectionString: dbUrl,
    embeddedPostgresDataDir: path.join(home, "instances", "default", "db"),
    embeddedPostgresPort: 54329,
    backup: { enabled: false, intervalMinutes: 60, retentionDays: 7, dir: path.join(home, "instances", "default", "data", "backups") }
  },
  logging: { mode: "file", logDir: path.join(home, "instances", "default", "logs") },
  server: {
    deploymentMode: "authenticated",
    exposure: "public",
    bind: "lan",
    host: "0.0.0.0",
    port: Number(process.env.PORT || 3100),
    allowedHostnames: [],
    serveUi: true
  },
  auth: { baseUrlMode: "explicit", publicBaseUrl: publicUrl, disableSignUp: false },
  telemetry: { enabled: true },
  storage: { provider: "local_disk", localDisk: { baseDir: path.join(home, "instances", "default", "data", "storage") }, s3: { bucket: "paperclip", region: "us-east-1", prefix: "", forcePathStyle: false } },
  secrets: { provider: "local_encrypted", strictMode: true, localEncrypted: { keyFilePath: path.join(home, "instances", "default", "secrets", "master.key") } }
};
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
console.log("Render startup: wrote persistent Paperclip configuration from environment.");
NODE

# One-time first-admin (bootstrap CEO) invite, opt-in via PAPERCLIP_BOOTSTRAP_ADMIN=1.
# Mints the invite row directly in PostgreSQL with a small Node process that uses
# the postgres driver already bundled in the image — no npx download, ~2 seconds,
# and it exits BEFORE the server starts so the free instance's 512MB of RAM is
# never contended. Mirrors `paperclipai auth bootstrap-ceo` (cli/src/commands/
# auth-bootstrap-ceo.ts): refuses once an instance_admin exists, revokes any
# outstanding bootstrap invites first. On a brand-new database the tables do not
# exist yet (the server applies migrations on boot), so a failed mint is logged
# and the next restart mints successfully.
if [ "${PAPERCLIP_BOOTSTRAP_ADMIN:-0}" = "1" ]; then
  echo "Render startup: checking first-admin bootstrap invite (PAPERCLIP_BOOTSTRAP_ADMIN=1)..."
  node --input-type=module <<'NODE'
import { createHash, randomBytes } from "node:crypto";

let postgres;
try {
  postgres = (await import("postgres")).default;
} catch {
  console.error("Render bootstrap: postgres driver not resolvable in this image; skipping invite mint.");
  process.exit(0);
}
const dbUrl = process.env.DATABASE_URL;
const publicUrl = (process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL || process.env.PAPERCLIP_PUBLIC_URL || "").replace(/\/+$/, "");
if (!dbUrl || !publicUrl) {
  console.error("Render bootstrap: DATABASE_URL or public URL missing; skipping invite mint.");
  process.exit(0);
}
const sql = postgres(dbUrl, { max: 1, idle_timeout: 5, connect_timeout: 10, prepare: false });
try {
  const admins = await sql`select count(*)::int as n from instance_user_roles where role = 'instance_admin'`;
  if ((admins[0]?.n ?? 0) > 0) {
    console.log("Render bootstrap: instance admin already exists; no invite minted.");
    process.exit(0);
  }
  const now = new Date();
  await sql`update invites
              set revoked_at = ${now}, updated_at = ${now}
            where invite_type = 'bootstrap_ceo'
              and revoked_at is null
              and accepted_at is null
              and expires_at > ${now}`;
  const token = `pcp_bootstrap_${randomBytes(24).toString("hex")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 168 * 60 * 60 * 1000);
  await sql`insert into invites (invite_type, token_hash, allowed_join_types, expires_at, invited_by_user_id)
            values ('bootstrap_ceo', ${tokenHash}, 'human', ${expiresAt}, 'system')`;
  console.log(`Render bootstrap: FIRST-ADMIN INVITE URL: ${publicUrl}/invite/${token}`);
  console.log(`Render bootstrap: invite expires at ${expiresAt.toISOString()} — open the URL and claim it to create the admin account.`);
} catch (err) {
  console.error(`Render bootstrap: invite mint did not complete (a brand-new database applies migrations on first boot; a restart mints it): ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
NODE
fi

exec node server/dist-runtime/index.mjs
