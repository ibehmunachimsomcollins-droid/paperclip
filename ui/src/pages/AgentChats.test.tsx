// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@paperclipai/shared";
import { recordAgentChatVisit } from "@/lib/recent-agent-chats";
import { AgentChats } from "./AgentChats";

const state = vi.hoisted(() => ({
  primaryAgentId: null as string | null,
  primaryLoading: false,
  companyId: "company-a",
  userId: "user-a",
  agents: [] as Agent[],
  chats: [] as { id: string; conversationAgentId: string }[],
  chatsFetched: true,
  chatsError: null as Error | null,
  sessionError: null as Error | null,
  navigate: vi.fn(),
}));


vi.mock("@/context/BreadcrumbContext", () => ({ useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }) }));
vi.mock("@/hooks/useAgentChatNavigation", () => ({
  useAgentChatNavigation: () => ({
    companyId: state.companyId,
    userId: state.userId,
    enabled: true,
    loaded: true,
    agents: { data: state.agents, isFetched: true, isPending: false, error: null },
    chats: { data: state.chats, isFetched: state.chatsFetched, isSuccess: state.chatsFetched && !state.chatsError, error: state.chatsError },
    session: { isFetched: !state.sessionError, isPending: false, error: state.sessionError },
  }),
  useOpenAgentChat: () => vi.fn(),
}));
vi.mock("@/lib/router", () => ({
  useNavigate: () => state.navigate,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("@/components/AgentAvatar", () => ({ AgentAvatar: () => null }));

let root: Root;
let container: HTMLDivElement;
const agent = (id: string, companyId = "company-a") => ({
  id, companyId, name: id, urlKey: `${id}-slug`, role: "engineer", status: "idle",
} as Agent);

async function render() {
  await act(async () => root.render(<AgentChats />));
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.primaryAgentId = null;
  state.primaryLoading = false;
  state.companyId = "company-a";
  state.userId = "user-a";
  state.agents = [agent("alice"), agent("bob")];
  state.chats = [];
  state.chatsFetched = true;
  state.chatsError = null;
  state.sessionError = null;
  state.navigate.mockReset();
  for (const id of ["alice", "bob", "removed", "retired-id"])
    recordAgentChatVisit("company-a", "user-a", id, null);
  localStorage.setItem("paperclip.recentAgentChats:company-a:user-a", "[]");
  localStorage.setItem("paperclip.recentAgentChats:company-b:user-a", "[]");
  localStorage.setItem("paperclip.recentAgentChats:company-a:user-b", "[]");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("NEXUS chat landing", () => {
  it("always presents the agent chooser instead of auto-opening a primary agent", async () => {
    state.primaryAgentId = "alice";
    await render();
    expect(state.navigate).not.toHaveBeenCalled();
    expect(container.textContent).toContain("What are we working on?");
    expect(container.querySelector('[aria-label="Search agents"]')).not.toBeNull();
  });

  it("lists agents and provides the roster search field", async () => {
    state.agents = [agent("alice"), agent("bob"), agent("charlie")];
    await render();
    expect(container.textContent).toContain("alice");
    expect(container.textContent).toContain("bob");
    expect(container.textContent).toContain("charlie");
    expect(container.querySelector('input[placeholder="Search your agents…"]')).not.toBeNull();
  });

  it("shows recent agent shortcuts without auto-navigation", async () => {
    recordAgentChatVisit("company-a", "user-a", "alice");
    recordAgentChatVisit("company-a", "user-a", "removed");
    await render();
    expect(container.textContent).toContain("Recent");
    expect(container.textContent).toContain("alice");
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it("keeps recent agent shortcuts scoped to company and user", async () => {
    recordAgentChatVisit("company-b", "user-a", "other-company-agent");
    recordAgentChatVisit("company-a", "user-b", "other-user-agent");
    await render();
    expect(container.textContent).not.toContain("other-company-agent");
    expect(container.textContent).not.toContain("other-user-agent");
  });

  it("shows retry state when identity loading fails", async () => {
    state.sessionError = new Error("Session unavailable");
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/Couldn[’']t load your chats/);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Retry");
  });
});
