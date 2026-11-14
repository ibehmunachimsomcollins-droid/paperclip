import {
  Activity,
  ArrowUpRight,
  Bot,
  CalendarClock,
  Cpu,
  Gauge,
  Palette,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Agent } from "@paperclipai/shared";
import { AgentCharacter } from "@/components/AgentCharacter";
import { Link } from "@/lib/router";
import { agentDetailHref } from "@/pages/agent-detail-navigation";
import { agentRouteRef } from "@/lib/utils";

function readableDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(date);
}

function ContextRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 py-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

/** Read-only context for the active agent. Actions stay on the existing agent routes. */
export function AgentChatContextPanel({ agent }: { agent: Agent }) {
  const agentRef = agentRouteRef(agent);
  const latestActivity = agent.lastHeartbeatAt ?? agent.updatedAt ?? null;
  const activityLabel = agent.lastHeartbeatAt ? "Last heartbeat" : "Last updated";
  const adapter = agent.adapterType.replace(/_/g, " ");
  const isLive = agent.status === "running" || agent.status === "active";
  const statusTone = isLive ? "is-live" : agent.status === "error" ? "is-error" : "is-idle";

  return (
    <aside className="nexus-chat-context-panel" aria-label={`${agent.name} context`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Agent context</p>
        <span className={`nexus-context-live-dot ${statusTone}`} aria-hidden />
      </div>
      <div className="nexus-context-identity">
        <AgentCharacter
          agent={agent}
          size={128}
          state={agent.status === "running" ? "working" : agent.status === "error" ? "confused" : undefined}
          motion="auto"
          followCursor
          trackingScope="region"
          className="nexus-context-character"
        />
        <h2 className="mt-3 max-w-full truncate text-lg font-semibold tracking-tight text-foreground">{agent.name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{agent.title ?? agent.role}</p>
        <span className={`nexus-context-status ${statusTone}`}>
          <span aria-hidden />{agent.status.replace(/_/g, " ")}
        </span>
      </div>

      <section className="nexus-context-section" aria-label="Agent details">
        <h3>Overview</h3>
        <ContextRow icon={Cpu} label="Runtime" value={adapter || "Not configured"} />
        <ContextRow icon={Activity} label={activityLabel} value={readableDate(latestActivity)} />
        <ContextRow icon={Gauge} label="Role" value={agent.role.replace(/_/g, " ")} />
      </section>

      <section className="nexus-context-section" aria-label="Quick access">
        <h3>Quick access</h3>
        <Link to={agentDetailHref(agentRef, "overview")} className="nexus-context-link">
          <Bot className="size-4" />Agent overview<ArrowUpRight className="ml-auto size-3.5" />
        </Link>
        <Link to={agentDetailHref(agentRef, "appearance")} className="nexus-context-link">
          <Palette className="size-4" />Customize identity<ArrowUpRight className="ml-auto size-3.5" />
        </Link>
        <Link to={agentDetailHref(agentRef, "runs")} className="nexus-context-link">
          <Activity className="size-4" />Execution history<ArrowUpRight className="ml-auto size-3.5" />
        </Link>
        <Link to="/routines" className="nexus-context-link">
          <CalendarClock className="size-4" />Routines<ArrowUpRight className="ml-auto size-3.5" />
        </Link>
        <Link to={agentDetailHref(agentRef, "permissions")} className="nexus-context-link">
          <ShieldCheck className="size-4" />Permissions<ArrowUpRight className="ml-auto size-3.5" />
        </Link>
      </section>

      <div className="nexus-context-footer">
        Context for the selected agent.
      </div>
    </aside>
  );
}
