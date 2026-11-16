# NEXUS frontend implementation handoff

## Product direction
NEXUS is a multi-agent workspace inspired by the supplied references:
1. Three-pane desktop workspace: agent roster on the left, existing conversation in the center, selected-agent context on the right. Mobile becomes a deliberate single-column experience with the roster in a drawer.
2. Individually recognizable agents: per-agent shape, expression/default state, and colour palette, with a live preview and persistent settings.
3. Crisp, high-resolution visuals, bold readable typography, precise spacing, strong contrast, and restrained futuristic styling.

The reference image shows more avatar shapes and emotions than the current renderer supports. The frontend must expose only working backend values, not display fake controls.

## Verified frontend architecture
- Frontend package: `ui/`, React 19, TypeScript, Vite, Tailwind CSS 4.
- Main shell: `ui/src/components/Layout.tsx`.
- Agent roster and chat navigation: `ui/src/components/AgentConversationSidebar.tsx` and `ui/src/components/AgentConversationsSidebar.tsx`.
- Chat page: `ui/src/pages/AgentChat.tsx`, which reuses Paperclip's existing `TaskDetailSurface` conversation behavior.
- Active-agent context: `ui/src/components/AgentChatContextPanel.tsx`.
- Avatar renderer: `ui/src/components/AgentAvatar.tsx`.
- Animated character renderer: `ui/src/components/AgentCharacter.tsx`.
- Agent appearance settings route: `ui/src/pages/agent-detail/AgentAppearanceSettings.tsx`.

## Backend appearance contract
The implementation is on `nexus/backend-appearance` and documented in `docs/api/agent-appearance.md`.

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
Agent list and detail responses include `appearance`.

Save through the existing authenticated endpoint:
`PATCH /api/agents/{agentId}`

Required permission:
`agent_config:update`

Send the complete editable appearance object:
`{ appearance: { schemaVersion: 1, characterVersion: "cap-v1", paletteId, shape?, expression?, customColors? } }`

Do not send `customAvatarAssetId` through this patch. Uploaded avatar images are managed separately through:
`PUT /api/companies/{companyId}/agents/{agentId}/avatar`

Send `{ imageBase64: null }` to restore the generated animated character.

## Integration invariants
- The NEXUS chat page must reuse Paperclip's existing conversation component, endpoints, auth, task semantics, streaming, attachments, and history. It must not create a parallel chat implementation.
- The normal workspace navigation remains available beside the NEXUS agent roster. The agent roster is a contextual sidebar, not a replacement for global navigation.
- Agent appearance writes use the existing authenticated update API and permission checks; uploaded image assets remain managed by the separate avatar endpoint.
- Avatar URLs are hydrated from the agent projection. Legacy appearance payloads and URLs remain backwards compatible.
- Keep the existing React Query/cache behavior, plugin bridge, live updates, keyboard accessibility, and mobile navigation contracts.
- Frontend must not write directly to the database or bypass server authorization.
- Do not implement unsupported shapes/expressions as presentation-only controls.
- Preserve upstream Paperclip license and notices.

## Branch and pull-request state
- Frontend branch: `nexus/frontend-redesign`.
- Backend/integration branch: `nexus/backend-appearance`.
- Frontend PR #2 has been merged into the backend branch.
- Integration merge commit: `d31914b54d99e1477d060a1398f2828d93c66f6c`.
- Backend PR #1 targets `master` and remains open. No NEXUS implementation has been merged to `master`.
- Merge PR #1 only after a full CI run for the current integrated head passes.

## Validation status
Earlier CI on pre-integration heads exposed portable Runner test fixtures, stale Runner SDK source pins, two UI type errors, and existing-chat navigation/e2e regressions. The current integration branch includes fixes for the identified fixture, registry, typecheck, and sidebar-layout issues.

**The combined implementation has not yet received a completed full CI run on its exact current head.** Do not treat results from older commits as proof. Required verification is a fresh full CI run covering typecheck, static checks, build, server/shared/UI tests, Runner checks, and the e2e shards on the integrated PR #1 head.
