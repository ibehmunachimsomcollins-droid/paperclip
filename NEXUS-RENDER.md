# NEXUS on Render

This fork has a Render Blueprint for a single-service, web-hosted Paperclip deployment. The existing Paperclip server and UI are retained; Render runs the repository Docker production target and serves the bundled UI from the server.

## Deploy

1. In Render, create a new Blueprint and select this repository.
2. Review the services from `render.yaml` and apply them.
3. Wait for the web service and PostgreSQL database to finish provisioning.
4. Confirm the service's public URL matches `https://nexus-paperclip-web.onrender.com`. If Render assigns a different hostname, update both `PAPERCLIP_PUBLIC_URL` and `PAPERCLIP_AUTH_PUBLIC_BASE_URL` to that URL in the web service environment and redeploy.
5. Open the public service URL and finish the Paperclip account/bootstrap flow. Keep sign-up enabled only while setting up access; once your admin account is created, disable public sign-up from supported Paperclip settings if available.
6. Configure AI provider credentials and agent execution providers through Paperclip's existing settings. Provider secrets are server-side; do not put keys in frontend code.

## Render resources

- Docker web service: builds the existing root `Dockerfile` (production target).
- Render PostgreSQL: stores Paperclip's database data.
- Persistent disk at `/paperclip`: retains Paperclip home, agent workspaces, local storage, secrets-key material and other files across deploys/restarts.

## Important compatibility notes

- The deployment is authenticated and internet-facing. Do not use `local_trusted` mode.
- Render's persistent disk is mounted at `/paperclip`, matching the Docker image's Paperclip home.
- Local/CLI agent adapters may need additional runtime binaries or an isolated runner and will not automatically become cloud-compatible merely because the server is deployed. Test each agent type.
- Render's web service and persistent disk are single-instance oriented. Do not scale this service horizontally while using a single attached disk.
- The blueprint currently pins a default Render hostname. If the service URL differs, update the two public URL settings before relying on OAuth callbacks, secure cookies, or sign-in.
