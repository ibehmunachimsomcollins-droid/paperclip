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
  /** Bottom input bar, e.g. <NexusChatInput />. Omitted on mobile-only layouts. */
  input?: ReactNode;
}

function activeLink(pathname: string, to: string): boolean {
  const base = to.split("/").filter(Boolean);
  const path = pathname.split("/").filter(Boolean);
  // Compare company-relative segments: skip a leading company prefix segment.
  const relative = path.length > 1 && path[0] === path[0]?.toUpperCase() && path.length && base[0] && path.includes(base[0])
    ? path.slice(path.indexOf(base[0]))
    : path;
  if (!relative.length) return false;
  return base.every((segment, index) => relative[index]?.toLowerCase() === segment.toLowerCase());
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
            className={`nexus-sidebar-item${activeLink(pathname, link.to) ? " nexus-sidebar-item--active" : ""}`}
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
