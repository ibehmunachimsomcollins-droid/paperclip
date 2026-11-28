#!/bin/sh
set -eu

# Render's persistent disk is mounted at /paperclip. Create the initial config
# once so Paperclip selects external PostgreSQL instead of embedded Postgres.
export PAPERCLIP_HOME="${PAPERCLIP_HOME:-/paperclip}"
config_dir="$PAPERCLIP_HOME/instances/default"
config_file="$config_dir/config.json"
mkdir -p "$config_dir"

if [ ! -f "$config_file" ]; then
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
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600, flag: "wx" });
console.log("Render startup: created persistent Paperclip configuration.");
NODE
fi

# Start the server. It must bind PORT before Render's health check window
# closes, so nothing heavy (no npx downloads) may run in parallel with startup.
node server/dist-runtime/index.mjs &
server_pid=$!
trap 'kill -TERM "$server_pid" 2>/dev/null' TERM INT

publicUrl="${PAPERCLIP_AUTH_PUBLIC_BASE_URL:-${PAPERCLIP_PUBLIC_URL:-}}"
if [ -n "$publicUrl" ]; then
  (
    # Wait for the server to accept connections on PORT first. This keeps the
    # 512MB free instance from being starved during Render's port scan.
    i=0
    until node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3100) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" 2>/dev/null; do
      i=$((i + 1))
      [ "$i" -ge 120 ] && { echo "Render startup: server not healthy after 120s; skipping bootstrap invite."; exit 0; }
      sleep 2
    done
    # Mint the first-admin (bootstrap CEO) invite and print the URL to logs.
    # Once an instance admin exists the command refuses, so this is safe on
    # every boot; otherwise it rotates the outstanding one-time invite.
    npx --yes paperclipai@0.3.1 auth bootstrap-ceo \
      -c "$config_file" \
      --base-url "$publicUrl" \
      --expires-hours 168 \
    || echo "Render startup: bootstrap-ceo skipped or failed (an instance admin may already exist)."
  ) &
fi

wait "$server_pid"
