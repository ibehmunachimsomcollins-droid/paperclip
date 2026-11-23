import { usePrimaryAgentPresentation } from "@/components/primary-agent/PrimaryAgentPresentation";
import { useEffect, useState } from "react";
import { MessageCircle, Search, Sparkles } from "lucide-react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { QueryErrorState, useQueryView } from "@/components/QueryView";
import { Button } from "@/components/ui/button";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useAgentChatNavigation, useOpenAgentChat } from "@/hooks/useAgentChatNavigation";
import { recordedAgentChatIssueId, useRecentAgentChats } from "@/lib/recent-agent-chats";
import { Link, useNavigate } from "@/lib/router";
import { agentRouteRef } from "@/lib/utils";

export function AgentChats() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { companyId, userId, enabled, loaded, agents, chats, session } = useAgentChatNavigation();
  useEffect(() => setBreadcrumbs([{ label: "Chat" }]), [setBreadcrumbs]);
  return <AgentChatsContent key={`${companyId}:${userId}`} companyId={companyId} userId={userId}
    enabled={enabled} loaded={loaded} agents={agents} chats={chats} session={session} />;
}

function AgentChatsContent({ companyId, userId, enabled, loaded, agents, chats, session }: Pick<ReturnType<typeof useAgentChatNavigation>, "companyId" | "userId" | "enabled" | "loaded" | "agents" | "chats" | "session">) {
  const primary = usePrimaryAgentPresentation(companyId);
  const openChat = useOpenAgentChat(companyId, userId);
  const navigate = useNavigate();
  const recentIds = useRecentAgentChats(companyId ?? "", userId);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [agentSearch, setAgentSearch] = useState("");
  const [openError, setOpenError] = useState<string | null>(null);
  const agentsView = useQueryView(agents);
  const sessionView = useQueryView(session);
  const chatsView = useQueryView(chats);
  // Only a real failure blocks the entry redirect; an outage waits it out below.
  const blockingError = agentsView.kind === "error" ? agents.error : sessionView.kind === "error" ? session.error : null;
  const reconnecting = agentsView.kind === "reconnecting" || sessionView.kind === "reconnecting" || chatsView.kind === "reconnecting";
  const firstId = recentIds[0];
  const firstAgent = agents.data?.find(agent => agent.id === firstId);
  // An empty chat with an active agent can reopen from the roster alone. A
  // missing agent or a saved issue needs history to validate that visit.
  const needsHistory = !!firstId && (!firstAgent || !!recordedAgentChatIssueId(companyId ?? "", userId, firstId));
  const resolvingRecent = recentIds.length > 0 && !blockingError && (!agents.isFetched || !session.isFetched || (needsHistory && !chats.isFetched && !chats.error));
  const recentChatPath = loaded && enabled && companyId && !blockingError && !resolvingRecent
    ? recentIds.map(id => {
      const agent = agents.data?.find(item => item.id === id);
      const historyIssue = chats.data?.find(chat => chat.conversationAgentId === id);
      const savedIssueId = recordedAgentChatIssueId(companyId, userId, id);
      // A deleted or inaccessible issue must not silently reopen as a new chat.
      if (savedIssueId && chats.isSuccess && historyIssue?.id !== savedIssueId) return null;
      if (agent) return `/chats/${encodeURIComponent(agentRouteRef(agent))}`;
      if (historyIssue) return `/chats/${encodeURIComponent(id)}`;
      return null;
    }).find((path): path is string => path !== null)
    : undefined;
  const primaryAgent = agents.data?.find(agent => agent.id === primary?.primaryAgentId
    && agent.status !== "terminated" && agent.status !== "pending_approval");
  const entryPath = recentChatPath ?? (loaded && enabled && !blockingError && !resolvingRecent
    && agents.isFetched && session.isFetched && !primary?.loading && primaryAgent
    ? `/chats/${encodeURIComponent(agentRouteRef(primaryAgent))}` : undefined);
  useEffect(() => {
    if (entryPath) navigate(entryPath, { replace: true });
  }, [navigate, entryPath]);
  if (!loaded) return <p role="status" className="text-sm text-muted-foreground">Loading chat…</p>;
  if (!enabled) return <p className="text-sm text-muted-foreground">Agent Chat is off for this instance. An administrator can enable it in <Link className="underline underline-offset-4" to="/company/settings/instance/experimental#experimental-enableAgentChat">Experimental settings</Link>. Your workspace preference does not change Chat availability.</p>;
  if (!companyId) return <p className="text-sm text-muted-foreground">Select a company to start a conversation.</p>;
  if (reconnecting) return <p role="status" className="text-sm text-muted-foreground">Loading chat…</p>;
  if (resolvingRecent || entryPath || primary?.loading) return <p role="status" className="text-sm text-muted-foreground">Opening chat…</p>;
  const error = blockingError ?? (recentIds.length > 0 && chatsView.kind === "error" ? chats.error : null);
  return <div className="mx-auto flex h-full min-h-[60svh] max-w-4xl flex-col justify-center gap-8 px-4 py-8 sm:px-8 sm:py-12">
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground">
        <MessageCircle className="size-3.5" /> NEXUS WORKSPACE
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What are we working on?</h1>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Start a conversation with one of your agents. They can help plan, investigate, build, and take action using the capabilities configured in Paperclip.</p>
      </div>
    </div>
    {error ? <QueryErrorState error={error} action="load your chats" onRetry={() => { agentsView.retry(); chatsView.retry(); sessionView.retry(); }} />
      : agents.isPending || session.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading your agents…</p>
      : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(agents.data ?? []).slice(0, 6).map(agent => <button key={agent.id} type="button" disabled={openingId !== null}
          onClick={async () => {
            setOpeningId(agent.id); setOpenError(null);
            try { await openChat(agent); } catch (error) { setOpenError(error instanceof Error ? error.message : "Couldn’t open chat. Try again."); } finally { setOpeningId(null); }
          }} className="group flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:bg-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted/70"><AgentAvatar agent={agent} size={36} /></div>
          <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="truncate text-sm font-semibold">{agent.name}</span><span className="line-clamp-2 text-xs leading-5 text-muted-foreground">{openingId === agent.id ? "Opening your conversation…" : agent.title ?? agent.role ?? "AI agent"}</span></span>
          <span aria-hidden="true" className="text-muted-foreground transition-transform group-hover:translate-x-1">→</span>
        </button>)}
      </div>}
    {openError && <p role="alert" className="text-sm text-destructive">{openError}</p>}
    {agents.data?.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">No agents yet. Create your first agent to start using NEXUS.</p>}
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
      <Button variant="outline" asChild><Link to="/agents/all">Manage agents</Link></Button>
      <Button variant="ghost" asChild><Link to="/apps">Tools & integrations</Link></Button>
    </div>
  </div>;
}
