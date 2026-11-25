import type { ReactNode } from "react";
import { Link, useLocation } from "@/lib/router";
import { NexusModelSelector } from "./NexusModelSelector";
import type { Agent } from "@paperclipai/shared";

const SIDEBAR_LINKS: Array<{ to: string; label: string }> = [
  { to: "/chats", label: "Chats" },
  { to: "/agents/all", label: "Agents" },
  { to: "/activity", label: "Activity" },
  { to: "/company/settings", label: "Settings" },
];

export interface NexusShellProps {
  /** Bold title shown in the header, typically the agent name. */
  title: string;
  /** The agent driving this conversation; enables the model selector. */
  agent?: Agent;
  /** Main chat area content. */
  children?: ReactNode;
  /** Bottom input bar, e.g. <NexusChatInput />. */
  input?: ReactNode;
}

function isLinkActive(pathname: string, to: string): boolean {
  // Compare the company-relative tail of the current path against the target
  // route, tolerating the optional leading company-prefix segment.
  const target = to.split("/").filter(Boolean);
  const segments = pathname.split("/").filter(Boolean);
  const start = segments.length > target.length ? segments.length - target.length : 0;
  return target.every((segment, index) => segments[start + index]?.toLowerCase() === segment.toLowerCase());
}

/**
 * The Nexus app frame: full screen on mobile with a desktop sidebar at
 * >= 768px. The header carries the agent name and model selector, the main
 * area hosts the conversation (or any wrapped surface), and the optional
 * input bar stays pinned to the bottom.
 */
export function NexusShell({ title, agent, children, input }: NexusShellProps) {
  const { pathname } = useLocation();

  return (
    <div className="nexus-root">
      <aside className="nexus-sidebar" aria-label="Nexus navigation">
        <p className="nexus-sidebar-title">Nexus</p>
        {SIDEBAR_LINKS.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className={`nexus-sidebar-item${isLinkActive(pathname, link.to) ? " nexus-sidebar-item--active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </aside>
      <div className="nexus-shell-column">
        <header className="nexus-header">
          <h1 className="nexus-header-title">{title}</h1>
          <div className="nexus-header-actions">
            {agent ? <NexusModelSelector agent={agent} /> : null}
          </div>
        </header>
        <main className="nexus-main">
          {children}
        </main>
        {input}
      </div>
    </div>
  );
}
