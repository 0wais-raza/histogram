/**
 * formatText — Discord-like rich text parser
 *
 * Supports:
 *   **bold**           → <strong>
 *   *italic*           → <em>
 *   __underline__      → <u>
 *   ~~strikethrough~~  → <s>
 *   `inline code`      → <code>
 *   ```code block```   → <pre><code>
 *   # Heading 1        → <h3>
 *   ## Heading 2       → <h4>
 *   ### Heading 3      → <h5>
 *   > quote            → <blockquote>
 *   - list item        → <ul><li>
 *   • list item        → <ul><li>
 *   :emoji_name:       → (left as text)
 *   ||spoiler||        → <span class="spoiler">
 *   \n                  → <br>
 */

// Escape HTML entities to prevent XSS
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Process inline formatting (bold, italic, etc.)
function processInline(text) {
  let result = escapeHtml(text);

  // Code blocks ```...``` — process first to avoid inner formatting
  result = result.replace(/```([\s\S]*?)```/g, (_, code) => {
    return `<pre class="format-code-block"><code>${code.trim()}</code></pre>`;
  });

  // Inline code `...`
  result = result.replace(/`([^`\n]+?)`/g, '<code class="format-inline-code">$1</code>');

  // Bold **...**
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic *...*  (but not inside ** already processed)
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Underline __...__
  result = result.replace(/__(.+?)__/g, '<u>$1</u>');

  // Strikethrough ~~...~~
  result = result.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // Spoiler ||...||
  result = result.replace(/\|\|(.+?)\|\|/g, '<span class="format-spoiler" title="Click to reveal">$1</span>');

  // Auto-link URLs (but not inside already-processed tags)
  result = result.replace(/(\s|^)(https?:\/\/[^\s<]+)/g, (match, pre, url) => {
    return `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer" class="format-link">${url}</a>`;
  });

  return result;
}

/**
 * Parse Discord-like markdown to HTML string.
 * Safe — escapes all HTML first, then applies formatting.
 *
 * @param {string} text - Raw text with markdown
 * @returns {string} HTML string
 */
export function formatText(text) {
  if (!text) return "";

  const lines = text.split("\n");
  let html = "";
  let inList = false;
  let inBlockquote = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block (multi-line) — collect until closing ```
    if (line.trimStart().startsWith("```")) {
      if (inList) { html += "</ul>"; inList = false; }
      if (inBlockquote) { inBlockquote = false; }
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      html += `<pre class="format-code-block"><code>${codeLines.join("\n")}</code></pre>`;
      continue;
    }

    // Heading ###
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      if (inList) { html += "</ul>"; inList = false; }
      if (inBlockquote) { inBlockquote = false; }
      const level = headingMatch[1].length;
      const tag = `h${level + 2}`; // h1→h3, h2→h4, h3→h5
      html += `<${tag} class="format-heading">${processInline(headingMatch[2])}</${tag}>`;
      continue;
    }

    // Blockquote >
    if (line.startsWith("> ")) {
      if (inList) { html += "</ul>"; inList = false; }
      if (!inBlockquote) { html += '<blockquote class="format-blockquote">'; inBlockquote = true; }
      html += `<p>${processInline(line.slice(2))}</p>`;
      // Check if next line is also a blockquote
      if (i + 1 < lines.length && !lines[i + 1].startsWith("> ")) {
        html += "</blockquote>";
        inBlockquote = false;
      }
      continue;
    } else if (inBlockquote) {
      html += "</blockquote>";
      inBlockquote = false;
    }

    // List items - or •
    const listMatch = line.match(/^[\-\•]\s+(.+)/);
    if (listMatch) {
      if (!inList) { html += '<ul class="format-list">'; inList = true; }
      html += `<li>${processInline(listMatch[1])}</li>`;
      // Check if next line is also a list item
      if (i + 1 < lines.length && !lines[i + 1].match(/^[\-\•]\s+/)) {
        html += "</ul>";
        inList = false;
      }
      continue;
    } else if (inList) {
      html += "</ul>";
      inList = false;
    }

    // Empty line
    if (line.trim() === "") {
      html += "<br>";
      continue;
    }

    // Regular line with inline formatting
    html += `<span>${processInline(line)}</span><br>`;
  }

  // Close any open tags
  if (inList) html += "</ul>";
  if (inBlockquote) html += "</blockquote>";

  return html;
}

/**
 * Check if text has any formatting.
 */
export function hasFormatting(text) {
  if (!text) return false;
  return /\*\*|__|~~|\|\||`|#{1,3}\s|^[\-\•]\s|^> /m.test(text);
}
