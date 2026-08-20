import {
  Bold, Italic, Underline, Strikethrough, Code,
  Heading1, Heading2, Heading3, Quote, List,
  EyeOff, Minus,
} from "lucide-react";

/**
 * Discord-like rich text formatting toolbar.
 * Inserts markdown syntax around selected text or at cursor.
 */
export default function RichTextToolbar({ textareaRef, value, onChange }) {
  function wrap(before, after) {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    const replacement = before + (selected || "text") + after;

    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    // Restore selection to wrapped text
    setTimeout(() => {
      ta.focus();
      if (selected) {
        ta.selectionStart = start + before.length;
        ta.selectionEnd = start + before.length + selected.length;
      } else {
        // Select the placeholder "text"
        ta.selectionStart = start + before.length;
        ta.selectionEnd = start + before.length + 4;
      }
    }, 0);
  }

  function insertLine(prefix) {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const beforeCursor = value.substring(0, start);
    const afterCursor = value.substring(start);

    // Add newline if not at start of line
    const needNewline = beforeCursor.length > 0 && !beforeCursor.endsWith("\n");
    const insertion = (needNewline ? "\n" : "") + prefix;

    const newValue = beforeCursor + insertion + afterCursor;
    onChange(newValue);

    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + insertion.length;
    }, 0);
  }

  function insertAtCursor(text) {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const newValue = value.substring(0, start) + text + value.substring(ta.selectionEnd);
    onChange(newValue);

    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    }, 0);
  }

  const buttons = [
    { icon: Bold, title: "Bold (**text**)", action: () => wrap("**", "**") },
    { icon: Italic, title: "Italic (*text*)", action: () => wrap("*", "*") },
    { icon: Underline, title: "Underline (__text__)", action: () => wrap("__", "__") },
    { icon: Strikethrough, title: "Strikethrough (~~text~~)", action: () => wrap("~~", "~~") },
    { icon: Code, title: "Code (`text`)", action: () => wrap("`", "`") },
    { type: "divider" },
    { icon: Heading1, title: "Heading 1 (# text)", action: () => insertLine("# ") },
    { icon: Heading2, title: "Heading 2 (## text)", action: () => insertLine("## ") },
    { icon: Heading3, title: "Heading 3 (### text)", action: () => insertLine("### ") },
    { type: "divider" },
    { icon: Quote, title: "Quote (> text)", action: () => insertLine("> ") },
    { icon: List, title: "List (- text)", action: () => insertLine("- ") },
    { icon: EyeOff, title: "Spoiler (||text||)", action: () => wrap("||", "||") },
    { icon: Minus, title: "Divider", action: () => insertAtCursor("\n---\n") },
  ];

  return (
    <div className="richtext-toolbar">
      {buttons.map((btn, i) => {
        if (btn.type === "divider") {
          return <div key={i} className="richtext-divider" />;
        }
        const Icon = btn.icon;
        return (
          <button
            key={i}
            type="button"
            className="richtext-btn"
            title={btn.title}
            onClick={btn.action}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
