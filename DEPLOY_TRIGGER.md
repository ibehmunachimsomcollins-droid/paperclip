# Render deploy trigger
# This file exists to force a fresh build. The entrypoint now regenerates
# instances/default/config.json from DATABASE_URL on every boot, so this
# deploy switches the service from the expiring Render Postgres to Supabase.
# Last trigger: 2026-11-28 (Supabase cutover)
