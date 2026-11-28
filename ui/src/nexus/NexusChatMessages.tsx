import { useEffect, useRef } from "react";

export interface NexusMessage {
  id: string;
  /** Who authored the message. */
  author: "user" | "agent";
  text: string;
  /** ISO timestamp. */
  createdAt: string;
  /** True while the text is still arriving; renders the streaming caret. */
  streaming?: boolean;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export interface NexusChatMessagesProps {
  messages: NexusMessage[];
}

/**
 * Renders a Nexus conversation: user bubbles on the right with a surface card,
 * agent text on the left with no background, faint timestamps below each
 * message, and a blinking caret on the message that is still streaming.
 */
export function NexusChatMessages({ messages }: NexusChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message visible as content streams in.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  if (!messages.length) {
    return (
      <div className="nexus-empty">
        <p className="nexus-empty-title">Start a conversation</p>
        <p className="nexus-empty-hint">Send a message to begin working with this agent.</p>
      </div>
    );
  }

  return (
    <div className="nexus-messages" ref={scrollRef}>
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`nexus-msg nexus-msg--${msg.author}${msg.streaming ? " nexus-msg--streaming" : ""}`}
        >
          <div className="nexus-msg-body">
            {msg.text}
            {msg.streaming ? <span className="nexus-caret" aria-hidden /> : null}
          </div>
          <time className="nexus-msg-time" dateTime={msg.createdAt}>
            {formatTime(msg.createdAt)}
          </time>
        </div>
      ))}
    </div>
  );
}
