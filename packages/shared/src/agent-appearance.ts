import { z } from "zod";

export const AGENT_PALETTE_IDS = ["bubblegum-sky", "pink-lemonade", "orchid-peach", "coral-mint", "lime-lagoon", "arctic-blue", "solar-flare", "violet-ember", "deep-tide", "coral-current", "golden-hour", "tangerine-cobalt", "electric-grove", "flamingo-jade", "cherry-pop", "turquoise-cherry", "ultraviolet-tide"] as const;
export type AgentPaletteId = typeof AGENT_PALETTE_IDS[number];
export type CharacterPaletteId = AgentPaletteId | "muted-dream";
export const AGENT_AVATAR_SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256, 512] as const;
export type AgentAvatarSize = typeof AGENT_AVATAR_SIZES[number];
export type AgentAvatarView = "front" | "portrait";
export type AgentAvatarBackground = "transparent" | "paperclip-dark";
/** sRGB PNG equivalent of index.css .dark --background: oklch(0.205 0 0). */
export const PAPERCLIP_DARK_AVATAR_BACKGROUND = "#171717";
export const CHARACTER_STATES = ["rest", "idle", "listening", "thinking", "working", "success", "confused", "sleepy", "loading"] as const;
export type CharacterState = typeof CHARACTER_STATES[number];
/**
 * Body shapes a persisted appearance may select. These must stay in sync with
 * the vendored ClipLab `Shape` ids; agent-appearance-customization.test.ts
 * fails when this list and the ClipLab model drift apart.
 */
export const AGENT_CHARACTER_SHAPES = ["capsule", "cap", "sphere"] as const;
export type AgentCharacterShape = typeof AGENT_CHARACTER_SHAPES[number];
/** #rrggbb, case-insensitive input; URLs and cache keys normalize to lower-case. */
const agentHexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a #rrggbb hex colour");
/**
 * Per-agent body colour overrides. They replace the palette colours in normal
 * renders; muted (presentation-only) renders keep the palette gray so neutral
 * contexts stay neutral.
 */
export const agentCustomColorsSchema = z.object({ a: agentHexColor, b: agentHexColor }).strict();
export type AgentCustomColors = z.infer<typeof agentCustomColorsSchema>;
export const agentAppearanceSchema = z.object({
  schemaVersion: z.literal(1),
  characterVersion: z.literal("cap-v1"),
  paletteId: z.enum(AGENT_PALETTE_IDS),
  /** Body shape; omitted keeps the studio character's shape (cap). */
  shape: z.enum(AGENT_CHARACTER_SHAPES).optional(),
  /** Persisted default character state (pose) for avatar URLs and live placement; omitted keeps rest. */
  expression: z.enum(CHARACTER_STATES).optional(),
  /** Body colour overrides; omitted keeps the palette colours. */
  customColors: agentCustomColorsSchema.optional(),
  /** Company-scoped normalized image, set through the avatar upload service. */
  customAvatarAssetId: z.uuid().optional(),
}).strict();
export type AgentAppearance = z.infer<typeof agentAppearanceSchema>;

export function appearanceForPalette(paletteId: AgentPaletteId): AgentAppearance {
  return { schemaVersion: 1, characterVersion: "cap-v1", paletteId };
}
/** A persisted choice, never randomize while rendering. */
export function randomAgentAppearance(): AgentAppearance {
  const bytes = new Uint32Array(1);
  // Rejection sampling avoids modulo bias.
  const limit = Math.floor(0x100000000 / AGENT_PALETTE_IDS.length) * AGENT_PALETTE_IDS.length;
  do { globalThis.crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
  return appearanceForPalette(AGENT_PALETTE_IDS[bytes[0] % AGENT_PALETTE_IDS.length]);
}
/** Must match the migration: rolling base-31 hash, modulo 17 at every step. */
export function legacyAgentAppearance(id: string): AgentAppearance {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % AGENT_PALETTE_IDS.length;
  return appearanceForPalette(AGENT_PALETTE_IDS[hash]);
}
export function resolveAgentAppearance(appearance: unknown, id = "agent"): AgentAppearance {
  const parsed = agentAppearanceSchema.safeParse(appearance);
  return parsed.success ? parsed.data : legacyAgentAppearance(id);
}
/**
 * Build the public render URL for an appearance. An explicit `pose` always
 * wins; without one, a saved `expression` becomes the rendered state and
 * `rest` remains the default. The saved shape and custom colours ride as query
 * parameters only when they are present, so URLs for legacy appearances stay
 * byte-identical.
 */
export function agentAvatarUrl(appearance: AgentAppearance, size: AgentAvatarSize = 512, scale: 1 | 2 = 1, pose?: CharacterState, muted = false, background: AgentAvatarBackground = "transparent", view: AgentAvatarView = "front"): string {
  if (appearance.customAvatarAssetId) return `/api/assets/${appearance.customAvatarAssetId}/content`;
  const query = [`size=${size}`, `scale=${scale}`];
  if (appearance.shape) query.push(`shape=${appearance.shape}`);
  if (appearance.customColors) query.push(`ca=${appearance.customColors.a.slice(1).toLowerCase()}`, `cb=${appearance.customColors.b.slice(1).toLowerCase()}`);
  if (background === "paperclip-dark") query.push("background=paperclip-dark");
  if (view === "portrait") query.push("view=portrait");
  return `/api/agent-avatars/${appearance.characterVersion}/${muted ? "muted-dream" : appearance.paletteId}/${pose ?? appearance.expression ?? "rest"}.png?${query.join("&")}`;
}
export function characterStateForAgent(status: string): CharacterState {
  if (status === "running") return "working";
  if (status === "error") return "confused";
  if (status === "paused" || status === "terminated" || status === "pending_approval") return "rest";
  return "idle";
}

/** Hydrate compact agent projections without an additional per-agent request. */
export function withAgentAppearance<T extends { id: string; appearance?: AgentAppearance | null }>(agent: T) {
  const appearance = resolveAgentAppearance(agent.appearance, agent.id);
  return { ...agent, appearance, avatarUrl: agentAvatarUrl(appearance) };
}
