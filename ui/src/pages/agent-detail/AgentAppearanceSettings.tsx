import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AGENT_PALETTE_IDS,
  CHARACTER_STATES,
  resolveAgentAppearance,
  type Agent,
  type AgentAppearance,
  type AgentPaletteId,
  type CharacterState,
} from "@paperclipai/shared";
import { agentsApi } from "@/api/agents";
import { useToastActions } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AgentPanel } from "@/components/agent-detail/AgentPanels";
import { Check, Palette, RotateCcw, Save, Shapes, Sparkles } from "lucide-react";

type AgentShape = "capsule" | "cap" | "sphere";
type NexusAppearance = AgentAppearance & {
  shape?: AgentShape;
  expression?: CharacterState;
  customColors?: { a: string; b: string };
};

const PALETTE_COLORS: Record<AgentPaletteId, { a: string; b: string }> = {
  "bubblegum-sky": { a: "#8bd4ff", b: "#ff51bf" },
  "pink-lemonade": { a: "#ff26a8", b: "#fff78a" },
  "orchid-peach": { a: "#e771ff", b: "#ffd87c" },
  "coral-mint": { a: "#beffe8", b: "#ff797b" },
  "lime-lagoon": { a: "#b4ffa4", b: "#26dfff" },
  "arctic-blue": { a: "#97fff3", b: "#0084ff" },
  "solar-flare": { a: "#ecca5c", b: "#fe3c3f" },
  "violet-ember": { a: "#ff5c43", b: "#6262ff" },
  "deep-tide": { a: "#003d60", b: "#32fffc" },
  "coral-current": { a: "#26e2ff", b: "#ff6666" },
  "golden-hour": { a: "#ffcd4f", b: "#fde5ba" },
  "tangerine-cobalt": { a: "#ffad32", b: "#4169ff" },
  "electric-grove": { a: "#b4ff32", b: "#008d58" },
  "flamingo-jade": { a: "#ff4f9a", b: "#36edaa" },
  "cherry-pop": { a: "#ff69db", b: "#d51c46" },
  "turquoise-cherry": { a: "#37f0db", b: "#ff4f64" },
  "ultraviolet-tide": { a: "#7516cf", b: "#00e8d1" },
};

const SHAPES: { value: AgentShape; label: string; helper: string }[] = [
  { value: "capsule", label: "Capsule", helper: "Soft and compact" },
  { value: "cap", label: "Cap", helper: "Signature character" },
  { value: "sphere", label: "Sphere", helper: "Simple and rounded" },
];

const EXPRESSION_LABELS: Record<CharacterState, string> = {
  rest: "Neutral",
  idle: "Idle",
  listening: "Attentive",
  thinking: "Thinking",
  working: "Working",
  success: "Happy",
  confused: "Confused",
  sleepy: "Sleepy",
  loading: "Loading",
};

function appearanceFor(agent: Agent): NexusAppearance {
  return resolveAgentAppearance(agent.appearance, agent.id) as NexusAppearance;
}

function previewUrl(appearance: NexusAppearance) {
  if (appearance.customAvatarAssetId) return `/api/assets/${appearance.customAvatarAssetId}/content`;
  const params = new URLSearchParams({ size: "256", scale: "2" });
  if (appearance.shape) params.set("shape", appearance.shape);
  if (appearance.customColors) {
    params.set("ca", appearance.customColors.a.slice(1).toLowerCase());
    params.set("cb", appearance.customColors.b.slice(1).toLowerCase());
  }
  return `/api/agent-avatars/${appearance.characterVersion}/${appearance.paletteId}/${appearance.expression ?? "rest"}.png?${params.toString()}`;
}

function prettyName(value: string) {
  return value.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function AgentAppearanceSettings({ agent }: { agent: Agent }) {
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const persisted = useMemo(() => appearanceFor(agent), [agent.id, agent.appearance]);
  const [draft, setDraft] = useState<NexusAppearance>(persisted);
  useEffect(() => setDraft(persisted), [persisted]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(persisted);

  const save = useMutation({
    mutationFn: () => {
      // The image asset is owned by the separate avatar-upload route. Send the
      // complete editable character configuration without changing that asset.
      const appearance = {
        schemaVersion: draft.schemaVersion,
        characterVersion: draft.characterVersion,
        paletteId: draft.paletteId,
        ...(draft.shape ? { shape: draft.shape } : {}),
        ...(draft.expression ? { expression: draft.expression } : {}),
        ...(draft.customColors ? { customColors: draft.customColors } : {}),
      };
      return agentsApi.update(agent.id, { appearance }, agent.companyId);
    },
    onSuccess: updated => {
      queryClient.setQueryData(queryKeys.agents.detail(agent.id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(agent.companyId) });
      setDraft(appearanceFor(updated as Agent));
      pushToast({ title: "Agent appearance saved", body: `${agent.name}'s visual identity has been updated.`, tone: "success" });
    },
    onError: error => {
      pushToast({
        title: "Appearance could not be saved",
        body: error instanceof Error ? error.message : "Check your connection and try again.",
        tone: "error",
      });
    },
  });

  const updateColor = (key: "a" | "b", value: string) => {
    setDraft(current => ({
      ...current,
      customColors: { ...(current.customColors ?? PALETTE_COLORS[current.paletteId]), [key]: value },
    }));
  };

  const discardChanges = () => setDraft(persisted);

  const restoreCharacter = useMutation({
    mutationFn: () => agentsApi.setAvatar(agent.companyId, agent.id, null),
    onSuccess: result => {
      const appearance = result.appearance as NexusAppearance;
      setDraft(appearance);
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(agent.companyId) });
      pushToast({ title: "Generated character restored", body: `${agent.name}'s animated identity is active again.`, tone: "success" });
    },
    onError: error => pushToast({
      title: "Could not restore character",
      body: error instanceof Error ? error.message : "Try again.",
      tone: "error",
    }),
  });

  const imageIsCustom = Boolean(draft.customAvatarAssetId);
  const expression = draft.expression ?? "rest";
  const colors = draft.customColors ?? PALETTE_COLORS[draft.paletteId];

  return (
    <div className="nexus-appearance-page space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Personalize agent</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Appearance</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Give {agent.name} a visual identity that is easy to recognize across your workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={reset} disabled={!dirty || save.isPending}>
            <RotateCcw className="mr-1.5 size-4" />Reset draft
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending || imageIsCustom || restoreCharacter.isPending}>
            <Save className="mr-1.5 size-4" />{save.isPending ? "Saving…" : "Save appearance"}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <AgentPanel title={<><Shapes className="size-4 text-muted-foreground" />Shape</>} meta="3 styles">
            <div className="grid grid-cols-1 gap-2 px-4 pb-4 sm:grid-cols-3">
              {SHAPES.map(item => (
                <button key={item.value} type="button" aria-pressed={(draft.shape ?? "cap") === item.value}
                  onClick={() => setDraft(current => ({ ...current, shape: item.value }))}
                  className={cn("nexus-shape-choice", (draft.shape ?? "cap") === item.value && "is-selected")}>
                  <span className={cn("nexus-shape-sample", `shape-${item.value}`)} aria-hidden />
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.helper}</span>
                </button>
              ))}
            </div>
          </AgentPanel>

          <AgentPanel title={<><Sparkles className="size-4 text-muted-foreground" />Expression</>} meta="Default character state">
            <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3">
              {CHARACTER_STATES.map(state => (
                <button key={state} type="button" aria-pressed={expression === state}
                  onClick={() => setDraft(current => ({ ...current, expression: state }))}
                  className={cn("nexus-expression-choice", expression === state && "is-selected")}>
                  <span className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground" aria-hidden>
                    {state === "rest" ? "—" : state === "listening" ? "◉" : state === "thinking" ? "…" : state === "working" ? "↗" : state === "success" ? "✓" : state === "confused" ? "?" : state === "sleepy" ? "z" : state === "loading" ? "◌" : "·"}
                  </span>
                  <span className="text-sm font-medium">{EXPRESSION_LABELS[state]}</span>
                </button>
              ))}
            </div>
          </AgentPanel>

          <AgentPanel title={<><Palette className="size-4 text-muted-foreground" />Colour identity</>} meta="17 palettes">
            <div className="grid grid-cols-3 gap-2 px-4 pb-4 sm:grid-cols-4 lg:grid-cols-5">
              {AGENT_PALETTE_IDS.map(id => {
                const active = draft.paletteId === id && !draft.customColors;
                return (
                  <button key={id} type="button" aria-label={prettyName(id)} aria-pressed={active}
                    onClick={() => setDraft(current => ({ ...current, paletteId: id, customColors: undefined }))}
                    className={cn("nexus-palette-choice", active && "is-selected")}>
                    <span className="flex h-7 w-full overflow-hidden rounded-md">
                      <span className="flex-1" style={{ background: PALETTE_COLORS[id].a }} />
                      <span className="flex-1" style={{ background: PALETTE_COLORS[id].b }} />
                    </span>
                    <span className="truncate text-[11px] font-medium">{prettyName(id)}</span>
                  </button>
                );
              })}
            </div>
            <div className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Custom colours</p>
                <p className="text-xs text-muted-foreground">Choose the two tones used to render this agent.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="nexus-color-field">
                  <span>Primary</span>
                  <input type="color" aria-label="Primary character colour" value={colors.a} onChange={event => updateColor("a", event.target.value)} />
                </label>
                <label className="nexus-color-field">
                  <span>Secondary</span>
                  <input type="color" aria-label="Secondary character colour" value={colors.b} onChange={event => updateColor("b", event.target.value)} />
                </label>
                {draft.customColors && <Button variant="ghost" size="sm" onClick={() => setDraft(current => ({ ...current, customColors: undefined }))}>Use palette</Button>}
              </div>
            </div>
          </AgentPanel>
          {imageIsCustom && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/20 dark:text-amber-100">
              <span>This agent is using an uploaded avatar. Restore its generated character to apply shape, expression and colour settings.</span>
              <Button variant="outline" size="sm" onClick={() => restoreCharacter.mutate()} disabled={restoreCharacter.isPending}>
                {restoreCharacter.isPending ? "Restoring…" : "Use animated character"}
              </Button>
            </div>
          )}
        </div>

        <aside className="nexus-appearance-preview">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Live preview</p>
              <h3 className="mt-1 text-lg font-semibold">{agent.name}</h3>
            </div>
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">256px</span>
          </div>
          <div className="nexus-appearance-stage">
            <div className="nexus-appearance-glow" style={{ background: `radial-gradient(circle, ${colors.a}45, transparent 68%)` }} />
            <img src={previewUrl(draft)} alt={`${agent.name} character preview`} className="relative z-10 size-56 max-w-full object-contain drop-shadow-[0_18px_24px_rgba(20,35,55,0.14)]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-background p-3">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Shape</span>
              <p className="mt-1 text-sm font-semibold">{prettyName(draft.shape ?? "cap")}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Expression</span>
              <p className="mt-1 text-sm font-semibold">{EXPRESSION_LABELS[expression]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: colors.a }} />
            <span className="size-2 rounded-full" style={{ background: colors.b }} />
            <span>{draft.customColors ? "Custom colour pair" : prettyName(draft.paletteId)}</span>
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">Changes apply to this agent everywhere its avatar appears.</p>
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending || imageIsCustom}>
          <Check className="mr-1.5 size-4" />{save.isPending ? "Saving…" : "Apply changes"}
        </Button>
      </div>
    </div>
  );
}
