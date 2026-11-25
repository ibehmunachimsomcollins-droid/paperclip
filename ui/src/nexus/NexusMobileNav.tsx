import { NavLink } from "@/lib/router";
import type { ReactNode } from "react";

/**
 * Tabs for the fixed bottom bar. `to` values are company-relative; the router's
 * Link/NavLink wrappers apply the active company prefix automatically.
 */
const TABS: Array<{ to: string; label: string; icon: ReactNode; matchEnd: boolean }> = [
  { to: "/chats", label: "Chats", icon: "💬", matchEnd: false },
  { to: "/agents/all", label: "Agents", icon: "🤖", matchEnd: false },
  { to: "/activity", label: "Activity", icon: "⚡", matchEnd: false },
  { to: "/company/settings", label: "Settings", icon: "⚙", matchEnd: false },
];

/**
 * Mobile-only bottom navigation (hidden at >= 768px via nexus.css). Uses the
 * existing company-aware router helpers so hrefs inherit the company prefix.
 */
export function NexusMobileNav() {
  return (
    <nav className="nexus-mobilenav" aria-label="Primary">
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.matchEnd}
          className={({ isActive }) =>
            `nexus-mobilenav-item${isActive ? " nexus-mobilenav-item--active" : ""}`
          }
        >
          <span className="nexus-mobilenav-icon" aria-hidden>{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
