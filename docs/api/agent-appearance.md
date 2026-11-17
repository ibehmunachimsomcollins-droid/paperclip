---
title: Agent Appearance (NEXUS)
summary: Per-agent character customization - shape, expression, colours, and rendered avatar URLs
---

# Agent Appearance (NEXUS)

Each agent has a persisted `appearance` object that drives its character
rendering. NEXUS extends it with three optional per-agent fields:
`shape`, `expression`, and `customColors`. All are optional and additive:
existing agents and stored payloads are unchanged, and legacy URLs stay
byte-identical.

## Appearance object

```json
{
  "schemaVersion": 1,
  "characterVersion": "cap-v1",
  "paletteId": "arctic-blue",
  "shape": "sphere",
  "expression": "thinking",
  "customColors": { "a": "#ff26a8", "b": "#fff78a" },
  "customAvatarAssetId": "22222222-2222-4222-8222-222222222222"
}
```

| Field | Type | Values | Notes |
|---|---|---|---|
| `paletteId` | required enum | One of the 17 cap palettes | Drives both body colours when `customColors` is absent |
| `shape` | optional enum | `capsule`, `cap`, `sphere` | Absent keeps the studio character silhouette (`cap`) |
| `expression` | optional enum | `rest`, `idle`, `listening`, `thinking`, `working`, `success`, `confused`, `sleepy`, `loading` | Persisted default pose; absent keeps `rest`. A transient pose (e.g. from agent status) still overrides it |
| `customColors` | optional object | `{ "a": "#rrggbb", "b": "#rrggbb" }` | Both keys required, 6-digit hex. Overrides the palette colours in normal renders; muted renders ignore them |
| `customAvatarAssetId` | optional uuid | Set only by the avatar upload service | When present, `avatarUrl` points at the private asset instead of the character render |

Palette ids: `bubblegum-sky`, `pink-lemonade`, `orchid-peach`, `coral-mint`,
`lime-lagoon`, `arctic-blue`, `solar-flare`, `violet-ember`, `deep-tide`,
`coral-current`, `golden-hour`, `tangerine-cobalt`, `electric-grove`,
`flamingo-jade`, `cherry-pop`, `turquoise-cherry`, `ultraviolet-tide`.

## Reading appearance

Every agent projection already returns `appearance` and a hydrated
`avatarUrl`:

```
GET /api/agents/{agentId}
GET /api/agents/me
GET /api/companies/{companyId}/agents
```

`avatarUrl` automatically includes the persisted shape, default expression,
and custom colours, so the frontend needs no extra requests:

```json
{
  "appearance": { "schemaVersion": 1, "characterVersion": "cap-v1", "paletteId": "arctic-blue", "shape": "sphere", "expression": "thinking", "customColors": { "a": "#ff26a8", "b": "#fff78a" } },
  "avatarUrl": "/api/agent-avatars/cap-v1/arctic-blue/thinking.png?size=512&scale=1&shape=sphere&ca=ff26a8&cb=fff78a"
}
```

## Saving appearance

Appearance is part of agent configuration, so it is saved through the same
authenticated PATCH route with the same permission (`agent_config:update`):

```
PATCH /api/agents/{agentId}
{
  "appearance": {
    "schemaVersion": 1,
    "characterVersion": "cap-v1",
    "paletteId": "arctic-blue",
    "shape": "sphere",
    "expression": "thinking",
    "customColors": { "a": "#ff26a8", "b": "#fff78a" }
  }
}
```

The server validates the whole `appearance` object with `agentAppearanceSchema`
(`strict()`), so send the complete object including `schemaVersion` and
`characterVersion`. Omit `shape`, `expression`, or `customColors` to clear
them; omit `customAvatarAssetId` (it is managed by the upload route below).
Invalid values return `422`. Changes are recorded as a configuration
revision, appear in `GET /api/agents/{agentId}/config-revisions`, and roll
back with the usual revision rollback route.

## Custom image avatar

```
PUT /api/companies/{companyId}/agents/{agentId}/avatar
{ "imageBase64": "..." }   // PNG/JPEG/WebP, <= 512 KiB, re-encoded server-side
{ "imageBase64": null }    // restore the Paperclip character
```

Setting an image makes `avatarUrl` point at `/api/assets/{assetId}/content`
(private); sending `null` restores the character render with the persisted
palette, shape, expression, and colours intact.

## Avatar render endpoint (public, no auth)

```
GET /api/agent-avatars/cap-v1/{paletteId}/{pose}.png
  ?size={16|20|24|32|40|48|64|96|128|256|512}
  &scale={1|2}
  &shape={capsule|cap|sphere}        // optional
  &ca={rrggbb}&cb={rrggbb}            // optional, must both be present, lower-case hex
  &background=paperclip-dark          // optional, opaque Slack export
  &view=portrait                      // optional, angled portrait crop
```

- Responses are immutable PNGs (`Cache-Control: public, max-age=31536000,
  immutable`) with content ETags; use `If-None-Match` for revalidation.
- Unknown or malformed query parameters return `400` (strict query space).
- `ca` and `cb` must arrive together; a lone colour returns `400`.
- Rendered pixels (and the cache identity) include the shape and colours,
  so different customizations never share ETags.

## Frontend rules of thumb

- Never build avatar URLs by hand: read `avatarUrl` from the agent
  projection. Use `characterStateForAgent(agent.status)` to pick a transient
  pose, then append the same `shape`/`ca`/`cb` query parameters from the
  persisted appearance when constructing variant URLs.
- Send the full appearance object on PATCH; partial appearance objects fail
  validation.
- `customColors` hex values are case-insensitive on input, but URLs and
  caches normalize to lower-case, so compare colours case-insensitively.
- Muted (gray) renders are presentation-only; they ignore custom colours by
  design.
