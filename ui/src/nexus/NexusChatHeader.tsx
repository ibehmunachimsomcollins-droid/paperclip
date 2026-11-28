import type { Agent } from "@paperclipai/shared";
import { NexusModelSelector } from "./NexusModelSelector";
import { AgentAvatar } from "@/components/AgentAvatar";

interface Props { agent: Agent; }

export function NexusChatHeader({ agent }: Props) {
  return (
    <div className="nexus-chat-header">
      <div className="nexus-chat-header-identity">
        <AgentAvatar agent={agent} size={32} className="nexus-chat-header-avatar" />
        <span className="nexus-chat-header-name">{agent.name}</span>
      </div>
      <div className="nexus-chat-header-actions">
        <NexusModelSelector agent={agent} />
      </div>
    </div>
  );
}
