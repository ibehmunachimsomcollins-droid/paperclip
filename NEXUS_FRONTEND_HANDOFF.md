# NEXUS frontend implementation handoff

## Product direction
NEXUS is a multi-agent workspace inspired by the supplied references:
1. Three-pane desktop workspace: agent roster on the left, conversation in the center, selected-agent context on the right. Mobile becomes a deliberate single-column experience with the roster in a drawer.
2. Individually recognizable agents: per-agent shape, expression/default state, and colour palette, with a live preview and persistent settings.
3. Crisp, high-resolution visuals, bold readable typography, precise spacing, strong contrast, and restrained futuristic styling.

The reference image shows more avatar shapes and emotions than the current renderer supports. The frontend must expose only working backend values, not display fake controls.

## Verified frontend architecture
- Frontend package: `ui/`, React 19, TypeScript, Vite, Tailwind CSS 4.
- Main shell: `ui/src/components/Layout.tsx`.
- Agent roster and chat navigation: `ui/src/components/AgentConversationSidebar.tsx` and `ui/src/components/AgentConversationsSidebar.tsx`.
- Chat page: `ui/src/pages/AgentChat.tsx`, which reuses Paperclip's existing `TaskDetailSurface` conversation behavior.
- Avatar renderer: `ui/src/components/AgentAvatar.tsx`.
- Animated character renderer: `ui/src/components/AgentCharacter.tsx`.
- Agent appearance settings route: `ui/src/pages/agent-detail/AgentAppearanceSettings.tsx`.

## Verified backend appearance contract
Backend work is on `nexus/backend-appearance` and documented in `docs/api/agent-appearance.md`.

Supported shapes:
- `capsule`
- `cap`
- `sphere`

Supported character expressions/default states:
- `rest`
- `idle`
- `listening`
- `thinking`
- `working`
- `success`
- `confused`
- `sleepy`
- `loading`

The API also supports 17 named palettes and custom two-tone colours (`customColors.a` and `customColors.b`, each a hex colour). The frontend editor uses these supported values.

### Read and save
Agent list and detail responses already include `appearance`.

Save through the existing authenticated endpoint:
`PATCH /api/agents/{agentId}`

Required permission:
`agent_config:update`

Send the complete editable appearance object:
`{ appearance: { schemaVersion: 1, characterVersion: "cap-v1", paletteId, shape?, expression?, customColors? } }`

Do not send `customAvatarAssetId` through this patch. Uploaded avatar images are managed separately through:
`PUT /api/companies/{companyId}/agents/{agentId}/avatar`

Send `{ imageBase64: null }` to restore the generated animated character.

## Implementation boundaries
- Preserve existing routes, auth, permissions, React Query/cache behavior, plugin bridge, live updates, and task/agent conversation semantics.
- Frontend must not write directly to the database or bypass server authorization.
- Do not implement unsupported shapes/expressions as presentation-only controls.
- Frontend owns files under `ui/`; backend owns server/shared/database changes.
- Preserve upstream Paperclip license and notices.

## Branch and merge coordination
- Frontend branch: `nexus/frontend-redesign`.
- Backend branch: `nexus/backend-appearance`.
- Frontend PR: `#2`, targeting the backend branch.
- Backend PR: `#1`, targeting `master`.
- Integrate the frontend PR into the backend branch only after checks pass. Then merge the combined backend PR into `master` after the combined checks pass.

## Validation status
The frontend changes are committed, but the monorepo build and tests have not been executed in this environment. Do not mark the implementation verified until CI or a local Node 24.11+ / pnpm 9.15.4 environment runs the relevant tests, typecheck, and build successfully.
