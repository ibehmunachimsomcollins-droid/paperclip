import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { agentChatsApi } from "@/api/agentChats";
import { agentsApi } from "@/api/agents";
import { authApi } from "@/api/auth";
import { QueryErrorState, useQueryView } from "@/components/QueryView";
import { useCompany } from "@/context/CompanyContext";
import { useAgentChatEnabled } from "@/hooks/useAgentChatEnabled";
import { recordAgentChatVisit } from "@/lib/recent-agent-chats";
import { queryKeys } from "@/lib/queryKeys";
import { Link, useParams } from "@/lib/router";
import { agentRouteRef } from "@/lib/utils";
import { TaskDetailSurface } from "./IssueDetail";
import { isUuidLike, type Issue } from "@paperclipai/shared";
import { afterVisibleConversationPaint } from "@/lib/onboarding-chat";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/AgentAvatar";

export function AgentChat() {
  const { agentRef = "" } = useParams<{ agentRef: string }>();
  const { selectedCompanyId } = useCompany();
  const { enabled, loaded } = useAgentChatEnabled();
  const client = useQueryClient();
  const agents = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const session = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const userId =
    session.data?.user?.id ?? session.data?.session?.userId ?? null;
  const agentsView = useQueryView(agents);
  const rosterAgent = agents.data?.find(
    (item) => item.id === agentRef || agentRouteRef(item) === agentRef,
  );
  const historyAgent = useQuery({
    queryKey: queryKeys.agents.detail(agentRef),
    queryFn: () => agentsApi.get(agentRef, selectedCompanyId!),
    enabled: enabled && !!selectedCompanyId && (agentsView.kind === "ready" || agentsView.kind === "stale")
      && !rosterAgent && isUuidLike(agentRef),
  });
  const agent = rosterAgent ?? (historyAgent.data?.companyId === selectedCompanyId ? historyAgent.data : undefined);
  const chatKey = queryKeys.agentChats.detail(selectedCompanyId, userId, agent?.id);
  const chat = useQuery({
    queryKey: chatKey,
    queryFn: () => agentChatsApi.get(selectedCompanyId!, agent!.id),
    initialData: () => enabled && agent && session.isSuccess
      ? client.getQueryData<Issue[]>(queryKeys.agentChats.list(selectedCompanyId, userId))
        ?.find(issue => issue.companyId === selectedCompanyId && issue.conversationAgentId === agent?.id)
      : undefined,
    initialDataUpdatedAt: () => {
      const state = client.getQueryState(queryKeys.agentChats.list(selectedCompanyId, userId));
      return state?.isInvalidated ? 0 : state?.dataUpdatedAt;
    },
    enabled: enabled && !!agent && session.isFetched,
  });
  const sessionView = useQueryView(session);
  const historyView = useQueryView(historyAgent);
  const chatView = useQueryView(chat);
  const creating = useRef<Promise<Issue> | null>(null);
  const [readyIssueId, setReadyIssueId] = useState<string | null>(null);
  const [greetingError, setGreetingError] = useState<string | null>(null);
  const [greetingAttempt, setGreetingAttempt] = useState(0);
  const onReady = useCallback(() => setReadyIssueId(chat.data?.id ?? null), [chat.data?.id]);
  useEffect(() => {
    setGreetingError(null);
    if (!enabled || !agent || !selectedCompanyId || !session.isSuccess
      || readyIssueId !== chat.data?.id || chat.data?.originKind !== "onboarding_chat") return;
    let cancelled = false;
    const cancelPaint = afterVisibleConversationPaint(() => {
      void agentChatsApi.greet(selectedCompanyId, agent.id).then(() => {
        if (!cancelled) void client.invalidateQueries({ queryKey: queryKeys.issues.detail(chat.data!.id) });
      }).catch(error => {
        if (!cancelled) setGreetingError(error instanceof Error ? error.message : "The welcome could not start.");
      });
    });
    return () => { cancelled = true; cancelPaint(); };
  }, [enabled, agent?.id, selectedCompanyId, userId, session.isSuccess, readyIssueId, chat.data?.id, chat.data?.originKind, greetingAttempt, client]);
  useEffect(() => {
    creating.current = null;
  }, [selectedCompanyId, userId, agent?.id]);
  useEffect(() => {
    if (enabled && agent && session.isSuccess && chat.isSuccess)
      recordAgentChatVisit(agent.companyId, userId, agent.id, chat.data?.id ?? null);
  }, [enabled, agent?.id, agent?.companyId, userId, session.isSuccess, chat.isSuccess, chat.data?.id]);
  const ensureIssue = useCallback(async () => {
    if (!agent || !selectedCompanyId) throw new Error("Agent not found");
    if (chat.data) return chat.data;
    const promise = (creating.current ??= agentChatsApi.ensure(
      selectedCompanyId,
      agent.id,
    ));
    try {
      const issue = await promise;
      client.setQueryData(queryKeys.issues.detail(issue.id), issue);
      client.setQueryData(chatKey, issue);
      void client.invalidateQueries({ queryKey: queryKeys.agentChats.list(selectedCompanyId, userId) });
      return issue;
    } catch (error) {
      creating.current = null;
      throw error;
    }
  }, [agent, selectedCompanyId, chat.data, client, userId]);
  // An outage before anything loaded keeps the quiet loading copy; loaded
  // data renders through it.
  const reconnecting = agentsView.kind === "reconnecting" || sessionView.kind === "reconnecting"
    || chatView.kind === "reconnecting" || (!rosterAgent && historyView.kind === "reconnecting");
  if (!loaded || agents.isPending || session.isPending || historyAgent.isFetching && !agent || reconnecting)
    return (
      <p className="text-sm text-muted-foreground">Loading conversation…</p>
    );
  if (!enabled && !chat.data)
    return (
      <p className="text-sm text-muted-foreground">
        Agent Chat is disabled for this instance. An administrator can enable it in{" "}
        <Link className="underline underline-offset-4" to="/company/settings/instance/experimental#experimental-enableAgentChat">Experimental settings</Link>.
        {" "}Your workspace preference does not change Chat availability. Existing history remains available through task links.
      </p>
    );
  const failed = [agentsView, chatView, ...(rosterAgent ? [] : [historyView])].find((view) => view.kind === "error");
  if (failed)
    return (
      <QueryErrorState
        size="page"
        error={failed.error}
        action="load this conversation"
        onRetry={failed.retry}
        retrying={failed.isFetching}
      />
    );
  if (!agent)
    return <p className="text-sm text-destructive">Agent not found.</p>;
  if (chat.isPending)
    return (
      <p className="text-sm text-muted-foreground">Loading conversation…</p>
    );
  return (
    <main className="nexus-chat-page flex h-full min-h-0 flex-col overflow-hidden">
      <header className="nexus-chat-header flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-sm font-bold tracking-tight">N</span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">NEXUS</p>
            <p className="truncate text-sm font-semibold">Agent workspace</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5">
          <AgentAvatar agent={agent} size={24} />
          <span className="truncate text-xs font-medium">{agent.name}</span>
          <span className="hidden max-w-36 truncate text-[10px] text-muted-foreground sm:inline">{agent.title ?? agent.role ?? "Agent"}</span>
        </div>
      </header>
      <section className="min-h-0 flex-1 overflow-hidden">
        {greetingError && <div role="alert" className="mx-auto mt-2 flex max-w-3xl items-center gap-2 px-3 text-sm text-destructive">
          <span>{greetingError}</span>
          <Button variant="outline" size="sm" onClick={() => setGreetingAttempt(attempt => attempt + 1)}>Retry welcome</Button>
        </div>}
        <TaskDetailSurface
          key={`${agent.id}:${userId}`}
          conversation={{ agent, issue: chat.data ?? null, ensureIssue, onReady }}
        />
      </section>
    </main>
  );
}
