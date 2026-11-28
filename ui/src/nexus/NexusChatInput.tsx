import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export interface NexusChatInputProps {
  /** Called with the trimmed text when the user sends a message. */
  onSend: (text: string) => void;
  /** Disables the send action (e.g. while a reply is streaming). */
  disabled?: boolean;
  /** Placeholder copy. */
  placeholder?: string;
}

const MAX_FIELD_HEIGHT_PX = 160;

/**
 * Nexus bottom input bar: auto-expanding textarea (capped near five lines),
 * attachment affordance on the left, and a send button that glows the accent
 * color whenever there is text to send.
 */
export function NexusChatInput({ onSend, disabled = false, placeholder = "Message…" }: NexusChatInputProps) {
  const [value, setValue] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const hasText = value.trim().length > 0;
  const canSend = hasText && !disabled;

  const autosize = () => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, MAX_FIELD_HEIGHT_PX)}px`;
  };

  const send = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(() => {
      const field = fieldRef.current;
      if (field) field.style.height = "auto";
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline, matching common chat UX.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="nexus-input">
      <form className="nexus-input-row" onSubmit={onSubmit}>
        <button
          type="button"
          className="nexus-input-attach"
          aria-label="Attach file"
          title="Attach file"
          disabled={disabled}
        >
          ＋
        </button>
        <textarea
          ref={fieldRef}
          className="nexus-input-field"
          rows={1}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Message"
          onChange={event => {
            setValue(event.target.value);
            autosize();
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="submit"
          className={`nexus-input-send${hasText ? " nexus-input-send--active" : ""}`}
          aria-label="Send message"
          title="Send message"
          disabled={!canSend}
        >
          ➤
        </button>
      </form>
    </div>
  );
}
