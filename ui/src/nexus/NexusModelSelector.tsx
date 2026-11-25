import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "@/api/agents";
import { adaptersApi } from "@/api/adapters";
import { useCompany } from "@/context/CompanyContext";
import { useToastActions } from "@/context/ToastContext";
import { describeError } from "@/api/errors";
import type { Agent } from "@paperclipai/shared";

/**
 * Display metadata for the adapters Nexus offers in the model selector.
 * The adapter `type` is the stable identifier the backend expects on
 * `adapterType`; the label and color are purely presentation.
 */
export const NEXUS_ADAPTER_META: Record<string, { label: string; color: string }> = {
  "gemini-local": { label: "Gemini", color: "#1a73e8" },
  "claude-local": { label: "Claude", color: "#d97706" },
  "grok-local": { label: "Grok", color: "#111827" },
  "codex-local": { label: "Codex", color: "#059669" },
  "opencode-local": { label: "OpenCode", color: "#7c3aed" },
  "cursor-local": { label: "Cursor", color: "#0ea5e9" },
  "kimi-local": { label: "Kimi", color: "#db2777" },
  hermes: { label: "Hermes", color: "#f59e0b" },
};

function adapterMeta(type: string): { label: string; color: string } {
  return NEXUS_ADAPTER_META[type] ?? { label: type, color: "#c8c8d0" };
}

export interface NexusModelSelectorProps {
  /** The agent whose adapter is being switched. */
  agent: Agent;
}

/**
 * Pill-shaped model selector for the Nexus header. Lists enabled adapters from
 * the existing adapters endpoint and persists a selection through the existing
 * agent update endpoint.
 */
export function NexusModelSelector({ agent }: NexusModelSelectorProps) {
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToastActions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const adapters = useQuery({
    queryKey: ["nexus", "adapters", selectedCompanyId],
    queryFn: () => adaptersApi.list({ companyId: selectedCompanyId! }),
    enabled: open && !!selectedCompanyId,
    staleTime: 30_000,
  });

  const updateAgent = useMutation({
    mutationFn: (adapterType: string) =>
      agentsApi.update(agent.id, { adapterType }, agent.companyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
      void queryClient.invalidateQueries({ queryKey: ["agent"] });
      void queryClient.invalidateQueries({ queryKey: ["nexus"] });
      setOpen(false);
    },
    onError: cause => {
      pushToast({ title: "Model change failed", body: describeError(cause).body, tone: "error" });
    },
  });

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const current = adapterMeta(agent.adapterType);
  const enabledAdapters = (adapters.data ?? []).filter(adapter => !adapter.disabled);

  return (
    <div ref={rootRef}>
      <button
        type="button"
        className="nexus-model-pill"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(currentOpen => !currentOpen)}
      >
        <span className="nexus-model-dot" style={{ background: current.color }} />
        {current.label}
      </button>
      {open && (
        <div className="nexus-model-menu" role="listbox" aria-label="Model">
          {adapters.isPending && <div className="nexus-model-menu-note">Loading models…</div>}
          {adapters.isError && (
            <div className="nexus-model-menu-note" role="alert">
              {describeError(adapters.error).body}
            </div>
          )}
          {enabledAdapters.map(adapter => {
            const meta = adapterMeta(adapter.type);
            const selected = adapter.type === agent.adapterType;
            return (
              <button
                key={adapter.type}
                type="button"
                role="option"
                aria-selected={selected}
                className="nexus-model-menu-item"
                disabled={updateAgent.isPending}
                onClick={() => updateAgent.mutate(adapter.type)}
              >
                <span className="nexus-model-dot" style={{ background: meta.color }} />
                {meta.label}
                {selected ? <span className="nexus-model-selected-mark">✓</span> : null}
              </button>
            );
          })}
          {!adapters.isPending && !adapters.isError && enabledAdapters.length === 0 && (
            <div className="nexus-model-menu-note">No models available.</div>
          )}
        </div>
      )}
    </div>
  );
}
