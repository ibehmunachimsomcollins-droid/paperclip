import { useEffect, useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { QueryErrorState, useQueryView } from "@/components/QueryView";
import { Button } from "@/components/ui/button";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useAgentChatNavigation, useOpenAgentChat } from "@/hooks/useAgentChatNavigation";
import { useRecentAgentChats } from "@/lib/recent-agent-chats";
import { Link } from "@/lib/router";

export function AgentChats() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { companyId, userId, enabled, loaded, agents, chats, session } = useAgentChatNavigation();
  useEffect(() => setBreadcrumbs([{ label: "Chat" }]), [setBreadcrumbs]);
  return <AgentChatsContent key={`${companyId}:${userId}`} companyId={companyId} userId={userId}
    enabled={enabled} loaded={loaded} agents={agents} chats={chats} session={session} />;
}

function AgentChatsContent({ companyId, userId, enabled, loaded, agents, chats, session }: Pick<ReturnType<typeof useAgentChatNavigation>, "companyId" | "userId" | "enabled" | "loaded" | "agents" | "chats" | "session">) {
  const openChat = useOpenAgentChat(companyId, userId);
  const recentIds = useRecentAgentChats(companyId ?? "", userId);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [agentSearch, setAgentSearch] = useState("");
  const [openError, setOpenError] = useState<string | null>(null);
  const agentsView = useQueryView(agents);
  const sessionView = useQueryView(session);
  const chatsView = useQueryView(chats);
  const blockingError = agentsView.kind === "error" ? agents.error : sessionView.kind === "error" ? session.error : null;
  const reconnecting = agentsView.kind === "reconnecting" || sessionView.kind === "reconnecting";
  const error = blockingError ?? (recentIds.length > 0 && chatsView.kind === "error" ? chats.error : null);
  const eligibleAgents = (agents.data ?? []).filter(agent => agent.status !== "terminated");
  return <div className="mx-auto flex h-full min-h-[60svh] max-w-4xl flex-col justify-center gap-8 px-4 py-8 sm:px-8 sm:py-12">
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground">
        <MessageCircle className="size-3.5" /> NEXUS WORKSPACE
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What are we working on?</h1>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Choose an agent to plan, investigate, build, or take action. Each agent works with its own tools and permissions.</p>
      </div>
    </div>
    {error ? <QueryErrorState error={error} action="load your chats" onRetry={() => { agentsView.retry(); chatsView.retry(); sessionView.retry(); }} />
      : agents.isPending || session.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading your agents…</p>
      : <div className="space-y-4">
        {recentIds.length > 0 && <section className="space-y-2"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent</h2><div className="flex gap-2 overflow-x-auto pb-1">{recentIds.map(id => { const recentAgent = eligibleAgents.find(agent => agent.id === id); return recentAgent ? <button key={id} type="button" disabled={openingId !== null} onClick={async () => { setOpeningId(id); setOpenError(null); try { await openChat(recentAgent); } catch (error) { setOpenError(error instanceof Error ? error.message : "Couldn’t open chat. Try again."); } finally { setOpeningId(null); } }} className="flex min-w-0 max-w-52 shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:border-primary/40 disabled:opacity-50"><AgentAvatar agent={recentAgent} size={28} /><span className="truncate text-xs font-medium">{recentAgent.name}</span></button> : null; })}</div></section>}
        <div className="space-y-3">
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={agentSearch} onChange={event => setAgentSearch(event.target.value)} placeholder="Search your agents…" aria-label="Search agents" className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" /></label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {eligibleAgents.filter(agent => !agentSearch.trim() || [agent.name, agent.title, agent.role].some(value => typeof value === "string" && value.toLowerCase().includes(agentSearch.trim().toLowerCase()))).slice(0, 12).map(agent => <button key={agent.id} type="button" disabled={openingId !== null}
          onClick={async () => {
            setOpeningId(agent.id); setOpenError(null);
            try { await openChat(agent); } catch (error) { setOpenError(error instanceof Error ? error.message : "Couldn’t open chat. Try again."); } finally { setOpeningId(null); }
          }} className="group flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:bg-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted/70"><AgentAvatar agent={agent} size={36} /></div>
          <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="truncate text-sm font-semibold">{agent.name}</span><span className="line-clamp-2 text-xs leading-5 text-muted-foreground">{openingId === agent.id ? "Opening your conversation…" : agent.title ?? agent.role ?? "AI agent"}</span></span>
          <span aria-hidden="true" className="text-muted-foreground transition-transform group-hover:translate-x-1">→</span>
        </button>)}
        {eligibleAgents.filter(agent => !agentSearch.trim() || [agent.name, agent.title, agent.role].some(value => typeof value === "string" && value.toLowerCase().includes(agentSearch.trim().toLowerCase()))).length === 0 && agentSearch.trim() !== "" && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No agents found for “{agentSearch}”.</p>}
        </div></div>}
    {openError && <p role="alert" className="text-sm text-destructive">{openError}</p>}
    {agents.isSuccess && eligibleAgents.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">No agents yet. Create your first agent to start using NEXUS.</p>}
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
      <Button variant="outline" asChild><Link to="/agents/all">Manage agents</Link></Button>
      <Button variant="ghost" asChild><Link to="/apps">Tools & integrations</Link></Button>
    </div>
  </div>;
}
