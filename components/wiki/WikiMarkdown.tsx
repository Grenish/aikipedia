"use client";

import { ReactNode, useMemo } from "react";

interface WikiMarkdownProps {
  children: string;
}

export function WikiMarkdown({ children }: WikiMarkdownProps) {
  const parsedContent = useMemo(() => parseContent(children), [children]);

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      {parsedContent}
    </div>
  );
}

// Main parser
function parseContent(text: string): ReactNode[] {
  const elements: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Headings: == Heading ==
    if (trimmed.startsWith("==") && trimmed.endsWith("==")) {
      const { element, consumed } = parseHeading(line, i);
      elements.push(element);
      i += consumed;
      continue;
    }

    // Unordered lists: * item or - item
    if (/^[\*\-]\s/.test(trimmed)) {
      const { element, consumed } = parseList(lines, i, "ul");
      elements.push(element);
      i += consumed;
      continue;
    }

    // Ordered lists: # item or 1. item
    if (/^(#|\d+\.)\s/.test(trimmed)) {
      const { element, consumed } = parseList(lines, i, "ol");
      elements.push(element);
      i += consumed;
      continue;
    }

    // Code blocks: lines starting with space
    if (
      line.startsWith(" ") &&
      !trimmed.startsWith("*") &&
      !trimmed.startsWith("#")
    ) {
      const { element, consumed } = parseCodeBlock(lines, i);
      elements.push(element);
      i += consumed;
      continue;
    }

    // Blockquotes: lines starting with >
    if (trimmed.startsWith(">")) {
      const { element, consumed } = parseBlockquote(lines, i);
      elements.push(element);
      i += consumed;
      continue;
    }

    // Horizontal rule: ----
    if (/^-{4,}$/.test(trimmed)) {
      elements.push(<hr key={i} className="my-6 border-border" />);
      i++;
      continue;
    }

    // Regular paragraph: collect consecutive non-empty lines
    const { element, consumed } = parseParagraph(lines, i);
    elements.push(element);
    i += consumed;
  }

  return elements;
}

// Parse headings
function parseHeading(
  line: string,
  index: number,
): { element: ReactNode; consumed: number } {
  const trimmed = line.trim();
  const startEquals = trimmed.match(/^=+/)?.[0] || "";
  const endEquals = trimmed.match(/=+$/)?.[0] || "";

  // Both sides should have equals signs
  if (!startEquals || !endEquals) {
    return parseParagraph([line], index);
  }

  const level = Math.min(startEquals.length, endEquals.length);
  const headingText = trimmed
    .slice(startEquals.length, -endEquals.length)
    .trim();

  const processedText = processInlineFormatting(headingText);

  let element: ReactNode;
  switch (level) {
    case 2: // == Heading ==
      element = (
        <h2
          key={index}
          className="text-2xl font-bold mt-8 mb-4 text-foreground"
        >
          {processedText}
        </h2>
      );
      break;
    case 3: // === Heading ===
      element = (
        <h3
          key={index}
          className="text-xl font-semibold mt-6 mb-3 text-foreground"
        >
          {processedText}
        </h3>
      );
      break;
    case 4: // ==== Heading ====
      element = (
        <h4
          key={index}
          className="text-lg font-medium mt-4 mb-2 text-foreground"
        >
          {processedText}
        </h4>
      );
      break;
    case 5: // ===== Heading =====
      element = (
        <h5
          key={index}
          className="text-base font-medium mt-3 mb-2 text-foreground"
        >
          {processedText}
        </h5>
      );
      break;
    default:
      element = (
        <h6
          key={index}
          className="text-sm font-medium mt-2 mb-1 text-foreground"
        >
          {processedText}
        </h6>
      );
  }

  return { element, consumed: 1 };
}

// Parse lists (both ordered and unordered)
function parseList(
  lines: string[],
  startIndex: number,
  type: "ul" | "ol",
): { element: ReactNode; consumed: number } {
  const items: ReactNode[] = [];
  let i = startIndex;
  const pattern = type === "ul" ? /^[\*\-]\s+(.+)/ : /^(#|\d+\.)\s+(.+)/;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) break;

    const match = trimmed.match(pattern);
    if (!match) break;

    const itemText = type === "ul" ? match[1] : match[2];
    items.push(
      <li key={i} className="ml-4">
        {processInlineFormatting(itemText)}
      </li>,
    );
    i++;
  }

  const element =
    type === "ul" ? (
      <ul
        key={startIndex}
        className="list-disc list-outside mb-4 space-y-1 pl-4"
      >
        {items}
      </ul>
    ) : (
      <ol
        key={startIndex}
        className="list-decimal list-outside mb-4 space-y-1 pl-4"
      >
        {items}
      </ol>
    );

  return { element, consumed: i - startIndex };
}

// Parse code blocks
function parseCodeBlock(
  lines: string[],
  startIndex: number,
): { element: ReactNode; consumed: number } {
  const codeLines: string[] = [];
  let i = startIndex;

  while (i < lines.length && (lines[i].startsWith(" ") || !lines[i].trim())) {
    if (lines[i].trim()) {
      codeLines.push(lines[i].slice(1)); // Remove leading space
    }
    i++;
  }

  const element = (
    <pre
      key={startIndex}
      className="bg-muted p-4 rounded-md overflow-x-auto mb-4"
    >
      <code className="text-sm">{codeLines.join("\n")}</code>
    </pre>
  );

  return { element, consumed: i - startIndex };
}

// Parse blockquotes
function parseBlockquote(
  lines: string[],
  startIndex: number,
): { element: ReactNode; consumed: number } {
  const quoteLines: string[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith(">")) break;
    quoteLines.push(trimmed.slice(1).trim());
    i++;
  }

  const element = (
    <blockquote
      key={startIndex}
      className="border-l-4 border-primary pl-4 italic mb-4 text-muted-foreground"
    >
      {processInlineFormatting(quoteLines.join(" "))}
    </blockquote>
  );

  return { element, consumed: i - startIndex };
}

// Parse regular paragraphs
function parseParagraph(
  lines: string[],
  startIndex: number,
): { element: ReactNode; consumed: number } {
  const paragraphLines: string[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Stop at empty line or special syntax
    if (
      !trimmed ||
      trimmed.startsWith("==") ||
      /^[\*\-#]/.test(trimmed) ||
      /^\d+\./.test(trimmed) ||
      line.startsWith(" ") ||
      trimmed.startsWith(">") ||
      /^-{4,}$/.test(trimmed)
    ) {
      break;
    }

    paragraphLines.push(trimmed);
    i++;
  }

  if (paragraphLines.length === 0) {
    return { element: null, consumed: 1 };
  }

  const element = (
    <p key={startIndex} className="mb-4 leading-relaxed text-foreground/90">
      {processInlineFormatting(paragraphLines.join(" "))}
    </p>
  );

  return { element, consumed: i - startIndex };
}

// Process inline formatting
function processInlineFormatting(text: string): ReactNode[] {
  const tokens = tokenizeInline(text);
  return tokens.map((token, i) => renderToken(token, i));
}

type Token =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "bolditalic"; content: string }
  | { type: "link"; url: string; text: string }
  | { type: "wikilink"; page: string; text?: string }
  | { type: "code"; content: string };

// Tokenizer for inline elements
function tokenizeInline(text: string): Token[] {
  const tokens: Token[] = [];
  let remaining = text;
  let pos = 0;

  while (remaining.length > 0) {
    // Bold + Italic: '''''text'''''
    let match = remaining.match(/^'''''(.+?)'''''/);
    if (match) {
      tokens.push({ type: "bolditalic", content: match[1] });
      remaining = remaining.slice(match[0].length);
      pos += match[0].length;
      continue;
    }

    // Bold: '''text'''
    match = remaining.match(/^'''(.+?)'''/);
    if (match) {
      tokens.push({ type: "bold", content: match[1] });
      remaining = remaining.slice(match[0].length);
      pos += match[0].length;
      continue;
    }

    // Italic: ''text''
    match = remaining.match(/^''(.+?)''/);
    if (match) {
      tokens.push({ type: "italic", content: match[1] });
      remaining = remaining.slice(match[0].length);
      pos += match[0].length;
      continue;
    }

    // Wiki links: [[Page]] or [[Page|Display Text]]
    match = remaining.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (match) {
      tokens.push({
        type: "wikilink",
        page: match[1],
        text: match[2] || match[1],
      });
      remaining = remaining.slice(match[0].length);
      pos += match[0].length;
      continue;
    }

    // External links: [http://url text] or [http://url]
    match = remaining.match(/^\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]+))?\]/);
    if (match) {
      tokens.push({
        type: "link",
        url: match[1],
        text: match[2] || match[1],
      });
      remaining = remaining.slice(match[0].length);
      pos += match[0].length;
      continue;
    }

    // Inline code: `code`
    match = remaining.match(/^`([^`]+)`/);
    if (match) {
      tokens.push({ type: "code", content: match[1] });
      remaining = remaining.slice(match[0].length);
      pos += match[0].length;
      continue;
    }

    // Plain text: consume until next special character
    match = remaining.match(/^[^'\[`]+/);
    if (match) {
      tokens.push({ type: "text", content: match[0] });
      remaining = remaining.slice(match[0].length);
      pos += match[0].length;
      continue;
    }

    // Single character (probably a stray quote or bracket)
    tokens.push({ type: "text", content: remaining[0] });
    remaining = remaining.slice(1);
    pos += 1;
  }

  return tokens;
}

// Render individual tokens
function renderToken(token: Token, key: number): ReactNode {
  switch (token.type) {
    case "text":
      return token.content;

    case "bold":
      return (
        <strong key={key} className="font-bold">
          {token.content}
        </strong>
      );

    case "italic":
      return (
        <em key={key} className="italic">
          {token.content}
        </em>
      );

    case "bolditalic":
      return (
        <strong key={key} className="font-bold italic">
          {token.content}
        </strong>
      );

    case "code":
      return (
        <code
          key={key}
          className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
        >
          {token.content}
        </code>
      );

    case "link":
      return (
        <a
          key={key}
          href={token.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {token.text}
        </a>
      );

    case "wikilink":
      return (
        <a
          key={key}
          href={`/wiki/${encodeURIComponent(token.page)}`}
          className="text-primary hover:underline"
        >
          {token.text}
        </a>
      );

    default:
      return null;
  }
}
