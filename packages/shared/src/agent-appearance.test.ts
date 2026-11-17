import { describe, expect, it } from "vitest";
import { AGENT_PALETTE_IDS, AGENT_CHARACTER_SHAPES, agentAppearanceSchema, appearanceForPalette, legacyAgentAppearance, randomAgentAppearance, resolveAgentAppearance, agentAvatarUrl } from "./agent-appearance.js";
import { renderAgentSvg } from "./cliplab/static.js";
import { SHAPES } from "./cliplab/model.js";

describe("agent appearance", () => {
  it("assigns only the 17 permanent cap palettes", () => {
    for (let i = 0; i < 100; i++) expect(AGENT_PALETTE_IDS).toContain(randomAgentAppearance().paletteId);
    expect(agentAppearanceSchema.safeParse({ schemaVersion: 1, characterVersion: "cap-v1", paletteId: "muted-dream" }).success).toBe(false);
  });
  it("preserves a saved appearance and resolves legacy IDs deterministically", () => {
    const appearance = appearanceForPalette("deep-tide");
    expect(resolveAgentAppearance(appearance, "different-id")).toEqual(appearance);
    expect(resolveAgentAppearance(null, "agent-1")).toEqual(legacyAgentAppearance("agent-1"));
    expect(legacyAgentAppearance("agent-1")).toEqual(legacyAgentAppearance("agent-1"));
    expect(agentAvatarUrl(appearance, 24, 2)).toBe("/api/agent-avatars/cap-v1/deep-tide/rest.png?size=24&scale=2");
  });
  it("uses a private asset URL for custom avatars while retaining the fallback palette", () => {
    const appearance = { ...appearanceForPalette("deep-tide"), customAvatarAssetId: "22222222-2222-4222-8222-222222222222" };
    expect(resolveAgentAppearance(appearance)).toEqual(appearance);
    expect(agentAvatarUrl(appearance, 128, 2, "rest", false, "transparent", "portrait")).toBe("/api/assets/22222222-2222-4222-8222-222222222222/content");
    expect(agentAppearanceSchema.safeParse({ ...appearance, customAvatarAssetId: "https://example.test/image" }).success).toBe(false);
  });
  it("renders without a browser and preserves logical-size detail at high density", () => {
    const appearance = appearanceForPalette("bubblegum-sky");
    // ClipLab v0.2.0 draws an enlarged compact face from 16px; only 12px and
    // below (not a logical size) is body-only.
    const small = renderAgentSvg(appearance, 16, 2);
    expect(small).toContain('width="32"');
    expect(small).toContain('id="agent-face-visible"');
    const eyes = renderAgentSvg(appearance, 24, 2);
    expect(eyes).toContain('width="48"');
    expect(eyes).toContain('id="agent-face-visible"');
    expect(eyes).not.toContain('id="agent-candle-light"');
    expect(renderAgentSvg(appearance, 48, 1)).toContain('id="agent-candle-light"');
    expect(renderAgentSvg(appearance, 24, 2)).toBe(eyes);
  });
  it("renders a deterministic portrait angle with its own URL and keeps front as the default", () => {
    const appearance = appearanceForPalette("coral-mint");
    expect(agentAvatarUrl(appearance, 256, 2, "rest", false, "transparent", "portrait")).toBe("/api/agent-avatars/cap-v1/coral-mint/rest.png?size=256&scale=2&view=portrait");
    const portrait = renderAgentSvg(appearance, 256, 2, "rest", false, "portrait");
    expect(portrait).toContain('width="512"');
    expect(portrait).toBe(renderAgentSvg(appearance, 256, 2, "rest", false, "portrait"));
    expect(portrait).not.toBe(renderAgentSvg(appearance, 256, 2));
    expect(renderAgentSvg(appearance, 256, 2)).toBe(renderAgentSvg(appearance, 256, 2, "rest", false, "front"));
  });
  it("uses a separate URL for opaque Slack exports without changing ordinary portraits", () => {
    const appearance = appearanceForPalette("cherry-pop");
    expect(agentAvatarUrl(appearance, 512, 1, "rest", false, "paperclip-dark")).toBe("/api/agent-avatars/cap-v1/cherry-pop/rest.png?size=512&scale=1&background=paperclip-dark");
    expect(agentAvatarUrl(appearance)).not.toContain("background=");
  });
});

describe("agent appearance customization (NEXUS)", () => {
  it("keeps the persisted shape list in sync with the vendored ClipLab model", () => {
    expect(new Set(AGENT_CHARACTER_SHAPES)).toEqual(new Set(SHAPES.map(shape => shape.id)));
  });
  it("accepts a shape, a default expression, and custom colours together and separately", () => {
    const full = { schemaVersion: 1 as const, characterVersion: "cap-v1" as const, paletteId: "arctic-blue" as const,
      shape: "sphere" as const, expression: "thinking" as const, customColors: { a: "#FF26A8", b: "#fff78a" } };
    expect(agentAppearanceSchema.safeParse(full).success).toBe(true);
    expect(resolveAgentAppearance(full)).toEqual(full);
    expect(agentAppearanceSchema.safeParse({ ...full, shape: "cylinder" }).success).toBe(false);
    expect(agentAppearanceSchema.safeParse({ ...full, expression: "party" }).success).toBe(false);
    expect(agentAppearanceSchema.safeParse({ ...full, customColors: { a: "red", b: "#fff78a" } }).success).toBe(false);
    expect(agentAppearanceSchema.safeParse({ ...full, customColors: { a: "#ff26a8" } }).success).toBe(false);
    expect(agentAppearanceSchema.safeParse({ ...full, customColors: { a: "#ff26a8", b: "#fff78a", c: "#0084ff" } }).success).toBe(false);
  });
  it("keeps legacy appearance payloads and URLs byte-identical", () => {
    const legacy = appearanceForPalette("deep-tide");
    expect(legacy).toEqual({ schemaVersion: 1, characterVersion: "cap-v1", paletteId: "deep-tide" });
    expect(agentAvatarUrl(legacy, 24, 2)).toBe("/api/agent-avatars/cap-v1/deep-tide/rest.png?size=24&scale=2");
    expect(JSON.stringify(agentAppearanceSchema.parse(legacy))).toBe(JSON.stringify(legacy));
  });
  it("puts saved shape, expression and colours into the render URL; lower-case hex; explicit pose wins", () => {
    const customized = { ...appearanceForPalette("arctic-blue"), shape: "sphere" as const, expression: "thinking" as const,
      customColors: { a: "#FF26A8", b: "#fff78a" } };
    expect(agentAvatarUrl(customized, 64, 1)).toBe("/api/agent-avatars/cap-v1/arctic-blue/thinking.png?size=64&scale=1&shape=sphere&ca=ff26a8&cb=fff78a");
    expect(agentAvatarUrl(customized, 64, 1, "working")).toBe("/api/agent-avatars/cap-v1/arctic-blue/working.png?size=64&scale=1&shape=sphere&ca=ff26a8&cb=fff78a");
    expect(agentAvatarUrl({ ...appearanceForPalette("arctic-blue"), shape: "capsule" as const }, 24, 2)).toBe("/api/agent-avatars/cap-v1/arctic-blue/rest.png?size=24&scale=2&shape=capsule");
    expect(agentAvatarUrl({ ...appearanceForPalette("arctic-blue"), customColors: { a: "#0f57ff", b: "#4deaff" } }, 24, 2)).toBe("/api/agent-avatars/cap-v1/arctic-blue/rest.png?size=24&scale=2&ca=0f57ff&cb=4deaff");
  });
  it("renders each persisted shape and honours custom colours in normal renders only", () => {
    const base = appearanceForPalette("bubblegum-sky");
    const byShape = AGENT_CHARACTER_SHAPES.map(shape => renderAgentSvg({ ...base, shape }, 128, 1));
    expect(new Set(byShape).size).toBe(AGENT_CHARACTER_SHAPES.length);
    const recoloured = renderAgentSvg({ ...base, customColors: { a: "#ff26a8", b: "#fff78a" } }, 128, 1);
    expect(recoloured.toLowerCase()).toContain("#ff26a8");
    expect(recoloured.toLowerCase()).toContain("#fff78a");
    // The muted (presentation-only) render ignores custom colours.
    expect(renderAgentSvg({ ...base, customColors: { a: "#ff26a8", b: "#fff78a" } }, 128, 1, "rest", true).toLowerCase()).not.toContain("#ff26a8");
  });
  it("renders every persisted shape with every character state", () => {
    const base = appearanceForPalette("coral-mint");
    for (const shape of AGENT_CHARACTER_SHAPES) {
      for (const state of ["rest", "idle", "listening", "thinking", "working", "success", "confused", "sleepy", "loading"] as const) {
        expect(() => renderAgentSvg({ ...base, shape }, 64, 1, state)).not.toThrow();
      }
    }
  });
});
