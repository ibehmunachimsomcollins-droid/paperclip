# NEXUS frontend implementation brief

## Product direction
NEXUS is a multi-agent workspace. Use the supplied three visual references as direction:
1. Primary shell: three-column desktop workspace — agent navigation on the left, active conversation in the center, contextual agent/activity panel on the right. Mobile must become a deliberate single-column experience with fast access to the agent roster.
2. Agent identity editor: each agent needs a distinct visual identity. Provide controls for shape (circle, pebble, squircle, capsule, triangle, hexagon, cloud, droplet), expression/state (neutral, attentive, surprised, excited, happy, laughing, angry, sad, scared, suspicious, confused, curious, proud, shy, unimpressed, sleepy), and colour palette. Show a live preview and persist the chosen identity per agent.
3. Visual quality: crisp high-resolution assets, bold readable typography, precise spacing, strong contrast, restrained futuristic styling. Avoid decorative clutter and low-contrast text.

## Existing frontend facts
- Frontend package: `ui/`, React 19, TypeScript, Vite, Tailwind CSS 4.
- Existing shell: `ui/src/components/Layout.tsx`.
- Existing coordinator-style navigation: `ui/src/components/CoordinatorSidebar.tsx`.
- Existing agent chat pages: `ui/src/pages/AgentChats.tsx` and `ui/src/pages/AgentChat.tsx`.
- Existing avatar renderer: `ui/src/components/AgentAvatar.tsx`. It already reads `agent.appearance` through shared `resolveAgentAppearance` and renders via `agentAvatarUrl`.
- Do not replace the routing, query/cache, auth, plugin, permission, live-update, or existing task/agent behavior with mock implementations.

## Frontend scope
- Rework presentation and responsive layout while preserving existing routes and API calls.
- Make the agent roster visually scannable; retain status, unread/live indicators, and existing navigation actions.
- Make the selected agent conversation the main working surface. Preserve existing conversation/task semantics.
- Use the contextual right panel for information already available from the app (agent status, recent activity, routines, connected context). Hide/collapse it gracefully on narrow screens.
- Add or complete a per-agent appearance editor using existing appearance types/rendering where possible. Do not invent an incompatible appearance schema.
- Keep accessibility: keyboard navigation, visible focus, semantic labels, reduced-motion support, and readable contrast.

## Backend/API coordination required
Before changing backend contracts, inspect current shared types and API endpoints. Report:
1. Existing persisted agent appearance schema and supported shape/expression/colour values.
2. Existing read/update endpoint and authorization rules for agent configuration.
3. Whether appearance is already returned in agent list/detail payloads.
4. Any missing fields/endpoints required for per-agent persistence.
5. A stable API contract and migration plan if schema changes are necessary.

Frontend must not write directly to the database or bypass server authorization. Prefer existing update-agent/configuration endpoints. Keep API changes backward compatible where possible.

## Coordination
- Frontend branch: `nexus/frontend-redesign`.
- Frontend owns files under `ui/` only.
- Backend work by Opus should use a separate branch and avoid editing `ui/`.
- Do not merge either branch until the API contract and integration checks are agreed.
- Preserve upstream Paperclip license and notices.
