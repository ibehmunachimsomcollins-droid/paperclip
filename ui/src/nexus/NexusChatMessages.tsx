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
      <div className="nexus-chat nexus-chat--empty" ref={scrollRef}>
        <div className="nexus-empty">
          <p className="nexus-empty-title">Nothing here yet.</p>
          <p className="nexus-empty-body">Say hello to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="nexus-chat" ref={scrollRef}>
      {messages.map(message => (
        <div
          key={message.id}
          className={[
            "nexus-message",
            message.author === "user" ? "nexus-message--user" : "nexus-message--agent",
            message.streaming ? "nexus-message--streaming" : "",
          ].filter(Boolean).join(" ")}
        >
          <div className="nexus-message-body">{message.text}</div>
          <time className="nexus-message-time" dateTime={message.createdAt}>
            {formatTime(message.createdAt)}
          </time>
        </div>
      ))}
    </div>
  );
}
