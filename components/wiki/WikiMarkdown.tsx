"use client";

import React, { ReactNode, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface WikiMarkdownProps {
  children: string;
  enableMath?: boolean;
}

export function WikiMarkdown({
  children,
  enableMath = true,
}: WikiMarkdownProps) {
  const parsed = useMemo(() => {
    return parseContent(children, enableMath);
  }, [children, enableMath]);
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">{parsed}</div>
  );
}

/* ==================== TYPES ==================== */

type Token =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "bolditalic"; content: string }
  | { type: "link"; url: string; text: string }
  | { type: "wikilink"; page: string; text?: string }
  | { type: "code"; content: string }
  | { type: "math"; content: string; display?: boolean };

type MathMap = Map<string, { content: string; display: boolean }>;

/* ==================== KATEX HELPERS (HTML ONLY, NO MATHML) ==================== */

function renderKatexHTML(latex: string, display: boolean) {
  const html = katex.renderToString(latex, {
    displayMode: display,
    output: "html",
    throwOnError: false,
    strict: "warn",
    trust: false,
    macros: {},
  });
  return html;
}

function DisplayMath({ latex, enable }: { latex: string; enable: boolean }) {
  if (!enable) {
    return (
      <code className="not-prose bg-muted px-2 py-1 rounded text-sm border border-border/50">
        {latex}
      </code>
    );
  }
  const html = renderKatexHTML(latex, true);
  return (
    <div
      className="not-prose my-6 flex justify-center"
      dangerouslySetInnerHTML={{ __html: html }}
      suppressHydrationWarning
    />
  );
}

function InlineMathHTML({ latex, enable }: { latex: string; enable: boolean }) {
  if (!enable) {
    return (
      <code className="not-prose bg-muted px-1 rounded text-sm border border-border/50">
        {latex}
      </code>
    );
  }
  const html = renderKatexHTML(latex, false);
  return (
    <span
      className="not-prose align-middle"
      dangerouslySetInnerHTML={{ __html: html }}
      suppressHydrationWarning
    />
  );
}

/* ==================== MAIN PARSER ==================== */

function parseContent(text: string, enableMath: boolean): ReactNode[] {
  const { processed, mathBlocks } = extractMathBlocks(text);

  const elements: ReactNode[] = [];
  const lines = processed.split("\n");
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) {
      i++;
      continue;
    }

    // Headings: == Heading ==
    if (trimmed.startsWith("==") && trimmed.endsWith("==")) {
      const { element, consumed } = parseHeading(raw, i, mathBlocks);
      if (element) elements.push(element);
      i += consumed;
      continue;
    }

    // Unordered lists: * item
    if (/^[*]\s/.test(trimmed)) {
      const { element, consumed } = parseList(lines, i, "ul", mathBlocks);
      if (element) elements.push(element);
      i += consumed;
      continue;
    }

    // Ordered lists: # item
    if (/^#\s/.test(trimmed)) {
      const { element, consumed } = parseList(lines, i, "ol", mathBlocks);
      if (element) elements.push(element);
      i += consumed;
      continue;
    }

    // Horizontal rule
    if (/^-{4,}$/.test(trimmed)) {
      elements.push(<hr key={i} className="my-6 border-border" />);
      i++;
      continue;
    }

    // Paragraphs (smart display-math splitting, no <div> inside <p>)
    const { elements: paraEls, consumed } = parseParagraph(
      lines,
      i,
      mathBlocks,
      enableMath,
    );
    elements.push(...paraEls);
    i += consumed;
  }

  return elements;
}

/* ==================== MATH EXTRACTION ==================== */

// Normalize LaTeX: remove spaces just inside {}
function cleanLatex(latex: string): string {
  return latex.replace(/\{\s+/g, "{").replace(/\s+\}/g, "}");
}

function extractMathBlocks(text: string): {
  processed: string;
  mathBlocks: MathMap;
} {
  const mathBlocks: MathMap = new Map();
  let processed = text;
  let blockIndex = 0;

  // PREPROCESSING: Remove all fallback content before {\displaystyle and {\textstyle
  // Wikipedia content has plain text fallback formulas before the LaTeX
  // Strategy: Find all {\displaystyle or {\textstyle, look back for the last sentence-ending
  // punctuation, and remove everything between that and the {\

  // Remove all <img> tags (they are math fallbacks)
  processed = processed.replace(/<img[^>]*>/gi, "");

  // Process each {\displaystyle and {\textstyle occurrence
  // Find all matches in the ORIGINAL text first before making any changes
  const stylePattern = /\{\\(display|text)style/g;
  let match;
  const matches: Array<{ index: number; type: string }> = [];

  // Collect all match positions first
  while ((match = stylePattern.exec(processed)) !== null) {
    matches.push({ index: match.index, type: match[1] });
  }

  // Process from end to beginning to maintain indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const styleStart = matches[i].index;

    // Look backwards from {\ but don't cross a previous {\displaystyle or {\textstyle
    // Find the start position - either the previous math block or up to 300 chars back
    let lookbackStart = Math.max(0, styleStart - 300);

    // Don't cross a previous {\displaystyle or {\textstyle
    if (i > 0) {
      const prevMatch = matches[i - 1];
      // Find the end of the previous match by looking for the closing }
      let depth = 0;
      let prevEnd = prevMatch.index;
      for (let j = prevMatch.index; j < processed.length; j++) {
        if (processed[j] === "{") depth++;
        else if (processed[j] === "}") {
          depth--;
          if (depth === 0) {
            prevEnd = j + 1;
            break;
          }
        }
      }
      lookbackStart = Math.max(lookbackStart, prevEnd);
    }

    const textBefore = processed.substring(lookbackStart, styleStart);

    // Find the last sentence ending or double newline in the lookback text
    const lastSentenceMatch = textBefore.match(/[.!?]\s+[A-Z]|[.!?]\s*$|\n\n/g);
    let fallbackStart;

    if (lastSentenceMatch) {
      const lastMatch = lastSentenceMatch[lastSentenceMatch.length - 1];
      const lastMatchIndex = textBefore.lastIndexOf(lastMatch);
      fallbackStart = lookbackStart + lastMatchIndex + lastMatch.length;
    } else {
      fallbackStart = lookbackStart;
    }

    // Check if the text between fallbackStart and styleStart is just fallback
    const betweenText = processed.substring(fallbackStart, styleStart);
    const realWords = betweenText.match(/\b[a-z]{4,}\b/gi);

    // Remove if it doesn't contain real prose (less than 3 words with 4+ letters)
    if (!realWords || realWords.length < 3) {
      processed =
        processed.substring(0, fallbackStart) +
        "\n\n" +
        processed.substring(styleStart);
    }
  }

  // Helper function to extract displaystyle/textstyle from content
  function extractStyleFromContent(content: string): {
    latex: string;
    display: boolean;
  } {
    const trimmed = content.trim();

    // Check for {\displaystyle ...}
    if (trimmed.startsWith("{\\displaystyle")) {
      let depth = 0;
      let end = -1;
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === "{") depth++;
        else if (trimmed[i] === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end > 0) {
        // Extract content inside {\displaystyle ...}
        let start = "\\displaystyle".length + 1;
        while (start < end && /\s/.test(trimmed[start])) start++;
        return { latex: trimmed.slice(start, end).trim(), display: true };
      }
    }

    // Check for {\textstyle ...}
    if (trimmed.startsWith("{\\textstyle")) {
      let depth = 0;
      let end = -1;
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === "{") depth++;
        else if (trimmed[i] === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end > 0) {
        // Extract content inside {\textstyle ...}
        let start = "\\textstyle".length + 1;
        while (start < end && /\s/.test(trimmed[start])) start++;
        return { latex: trimmed.slice(start, end).trim(), display: false };
      }
    }

    // No style wrapper, return as-is
    return { latex: trimmed, display: false };
  }

  // FIRST: Extract <math>...</math> tags (which may contain {\displaystyle} or {\textstyle})
  processed = processed.replace(
    /<math([^>]*)>([\s\S]*?)<\/math>/gi,
    (_, attrs, content) => {
      // Check if display="block" attribute is present
      const hasDisplayBlock =
        attrs.includes('display="block"') || attrs.includes("display='block'");

      // Extract the actual LaTeX content (removing displaystyle/textstyle wrappers)
      const { latex, display: isDisplayStyle } =
        extractStyleFromContent(content);

      // Use display="block" attribute OR {\displaystyle} to determine if it's display math
      const isDisplay = hasDisplayBlock || isDisplayStyle;

      const placeholder = `__MATH_${blockIndex}__`;
      mathBlocks.set(placeholder, {
        content: cleanLatex(latex),
        display: isDisplay,
      });
      blockIndex++;
      return placeholder;
    },
  );

  // SECOND: Extract any remaining {\displaystyle ...} and {\textstyle ...} that are NOT inside <math> tags
  let pos = 0;
  let out = "";

  while (pos < processed.length) {
    const dispIdx = processed.indexOf("{\\displaystyle", pos);
    const txtIdx = processed.indexOf("{\\textstyle", pos);

    let matchPos = -1;
    let isDisplay = false;
    let delimiter = "";

    if (dispIdx !== -1 && (txtIdx === -1 || dispIdx < txtIdx)) {
      matchPos = dispIdx;
      isDisplay = true;
      delimiter = "\\displaystyle";
    } else if (txtIdx !== -1) {
      matchPos = txtIdx;
      isDisplay = false;
      delimiter = "\\textstyle";
    }

    if (matchPos === -1) {
      out += processed.slice(pos);
      break;
    }

    out += processed.slice(pos, matchPos);

    // Find matching closing brace
    let depth = 0;
    let end = -1;
    for (let j = matchPos; j < processed.length; j++) {
      if (processed[j] === "{") depth++;
      else if (processed[j] === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) {
      // unmatched, emit char and move on
      out += processed[matchPos];
      pos = matchPos + 1;
      continue;
    }

    // Skip "{\delimiter"
    let start = matchPos + delimiter.length + 1;
    while (start < end && /\s/.test(processed[start])) start++;

    const content = cleanLatex(processed.slice(start, end).trim());
    const placeholder = `__MATH_${blockIndex}__`;
    mathBlocks.set(placeholder, { content, display: isDisplay });
    out += placeholder;

    blockIndex++;
    pos = end + 1;
  }
  processed = out;

  return { processed, mathBlocks };
}

/* ==================== PARSERS ==================== */

function parseHeading(
  line: string,
  index: number,
  mathBlocks: MathMap,
): { element: ReactNode | null; consumed: number } {
  const trimmed = line.trim();
  const startEq = trimmed.match(/^=+/)?.[0] || "";
  const endEq = trimmed.match(/=+$/)?.[0] || "";
  if (!startEq || !endEq || startEq.length < 2)
    return { element: null, consumed: 1 };

  const level = Math.min(startEq.length, endEq.length);
  const text = trimmed.slice(startEq.length, -endEq.length).trim();
  if (!text) return { element: null, consumed: 1 };

  const content = processInlineFormatting(text, mathBlocks);
  const cls = "text-foreground scroll-mt-20";

  const el =
    level === 2 ? (
      <h2 key={index} className={`text-2xl font-bold mt-8 mb-4 ${cls}`}>
        {content}
      </h2>
    ) : level === 3 ? (
      <h3 key={index} className={`text-xl font-semibold mt-6 mb-3 ${cls}`}>
        {content}
      </h3>
    ) : level === 4 ? (
      <h4 key={index} className={`text-lg font-medium mt-5 mb-2 ${cls}`}>
        {content}
      </h4>
    ) : level === 5 ? (
      <h5 key={index} className={`text-base font-medium mt-4 mb-2 ${cls}`}>
        {content}
      </h5>
    ) : (
      <h6 key={index} className={`text-sm font-medium mt-3 mb-1 ${cls}`}>
        {content}
      </h6>
    );

  return { element: el, consumed: 1 };
}

function parseList(
  lines: string[],
  startIndex: number,
  type: "ul" | "ol",
  mathBlocks: MathMap,
): { element: ReactNode | null; consumed: number } {
  const items: ReactNode[] = [];
  let i = startIndex;
  const pattern = type === "ul" ? /^[*]\s+(.*)/ : /^#\s+(.*)/;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) break;

    const match = trimmed.match(pattern);
    if (!match) break;

    const itemText = match[1];
    items.push(
      <li key={i} className="ml-4 my-1">
        {processInlineFormatting(itemText, mathBlocks)}
      </li>,
    );
    i++;
  }

  if (!items.length) return { element: null, consumed: 1 };

  const el =
    type === "ul" ? (
      <ul
        key={startIndex}
        className="list-disc list-outside mb-4 space-y-0.5 pl-4"
      >
        {items}
      </ul>
    ) : (
      <ol
        key={startIndex}
        className="list-decimal list-outside mb-4 space-y-0.5 pl-4"
      >
        {items}
      </ol>
    );

  return { element: el, consumed: i - startIndex };
}

// Pull trailing "x =" or similar into the following display-math
function takeLhsTailForMath(text: string): {
  before: string;
  lhsForMath: string | null;
} {
  const trimmedRight = text.replace(/\s+$/, "");
  const tailMatch = trimmedRight.match(
    /([A-Za-z0-9\\()\[\]{}+\-*/^_\s]+?)(\s*(?:=|≡|≈|:=|≤|≥)\s*)$/,
  );
  if (!tailMatch) return { before: text, lhsForMath: null };

  const fullTail = tailMatch[0];
  const before = trimmedRight.slice(0, trimmedRight.length - fullTail.length);
  const lhsForMath = (tailMatch[1] + tailMatch[2]).replace(/\s+/g, ""); // "x =" -> "x="
  return { before, lhsForMath };
}

function parseParagraph(
  lines: string[],
  startIndex: number,
  mathBlocks: MathMap,
  enableMath: boolean,
): { elements: ReactNode[]; consumed: number } {
  const paragraphLines: string[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (
      !trimmed ||
      trimmed.startsWith("==") ||
      /^[*]/.test(trimmed) ||
      /^#\s/.test(trimmed) ||
      /^-{4,}$/.test(trimmed)
    ) {
      break;
    }

    paragraphLines.push(trimmed);
    i++;
  }

  if (!paragraphLines.length) return { elements: [], consumed: 1 };

  const fullText = paragraphLines.join(" ");

  // Split ONLY around display-math placeholders to avoid <div> inside <p>
  // Find all math placeholders and check which are display math
  const displayMatches: Array<{
    index: number;
    placeholder: string;
    math: { content: string; display: boolean };
  }> = [];
  const displayRegex = /__MATH_(\d+)__/g;
  let m: RegExpExecArray | null;

  while ((m = displayRegex.exec(fullText)) !== null) {
    const ph = m[0];
    const math = mathBlocks.get(ph);
    // Only collect actual display math
    if (math && math.display) {
      displayMatches.push({ index: m.index, placeholder: ph, math });
    }
  }

  const parts: ReactNode[] = [];
  let lastIdx = 0;

  // Process each display math block
  for (const match of displayMatches) {
    const beforeTextRaw = fullText.slice(lastIdx, match.index);
    const { before, lhsForMath } = takeLhsTailForMath(beforeTextRaw);

    if (before.trim()) {
      parts.push(
        <p
          key={`${startIndex}-t-${lastIdx}`}
          className="mb-4 leading-relaxed text-foreground/90"
        >
          {processInlineFormatting(before, mathBlocks)}
        </p>,
      );
    }

    const mathContent = lhsForMath
      ? `${lhsForMath}${match.math.content}`
      : match.math.content;

    parts.push(
      <DisplayMath
        key={`${startIndex}-m-${match.index}`}
        latex={mathContent}
        enable={enableMath}
      />,
    );

    lastIdx = match.index + match.placeholder.length;
  }

  const tail = fullText.slice(lastIdx);
  if (tail.trim()) {
    parts.push(
      <p
        key={`${startIndex}-t-end`}
        className="mb-4 leading-relaxed text-foreground/90"
      >
        {processInlineFormatting(tail, mathBlocks)}
      </p>,
    );
  }

  if (!parts.length) {
    return {
      elements: [
        <p key={startIndex} className="mb-4 leading-relaxed text-foreground/90">
          {processInlineFormatting(fullText, mathBlocks)}
        </p>,
      ],
      consumed: i - startIndex,
    };
  }

  return { elements: parts, consumed: i - startIndex };
}

/* ==================== INLINE ==================== */

function processInlineFormatting(
  text: string,
  mathBlocks: MathMap,
): ReactNode[] {
  const tokens = tokenizeInline(text, mathBlocks);
  return tokens.map((t, i) => renderToken(t, i));
}

function tokenizeInline(text: string, mathBlocks: MathMap): Token[] {
  const tokens: Token[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Look for any math placeholder
    const phMatch = remaining.match(/^__MATH_\d+__/);
    if (phMatch) {
      const ph = phMatch[0];
      const info = mathBlocks.get(ph);
      // Emit only inline math here; display math handled at paragraph-level
      if (info && !info.display) {
        tokens.push({ type: "math", content: info.content, display: false });
      }
      remaining = remaining.slice(ph.length);
      continue;
    }
    const nextPhIndex = remaining.search(/__MATH_\d+__/);
    if (nextPhIndex > 0) {
      tokens.push({ type: "text", content: remaining.slice(0, nextPhIndex) });
      remaining = remaining.slice(nextPhIndex);
      continue;
    }

    // Bold + Italic: '''''text'''''
    let m = remaining.match(/^'''''(.+?)'''''/);
    if (m) {
      tokens.push({ type: "bolditalic", content: m[1] });
      remaining = remaining.slice(m[0].length);
      continue;
    }

    // Bold: '''text'''
    m = remaining.match(/^'''(.+?)'''/);
    if (m) {
      tokens.push({ type: "bold", content: m[1] });
      remaining = remaining.slice(m[0].length);
      continue;
    }

    // Italic: ''text''
    m = remaining.match(/^''(.+?)''/);
    if (m) {
      tokens.push({ type: "italic", content: m[1] });
      remaining = remaining.slice(m[0].length);
      continue;
    }

    // Wiki link: [[Page]] or [[Page|Text]]
    m = remaining.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (m) {
      tokens.push({
        type: "wikilink",
        page: m[1].trim(),
        text: m[2]?.trim() || m[1].trim(),
      });
      remaining = remaining.slice(m[0].length);
      continue;
    }

    // External link: [http://url text]
    m = remaining.match(/^\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]+))?\]/);
    if (m) {
      tokens.push({ type: "link", url: m[1], text: m[2] || m[1] });
      remaining = remaining.slice(m[0].length);
      continue;
    }

    // Inline code: `code`
    m = remaining.match(/^`([^`]+)`/);
    if (m) {
      tokens.push({ type: "code", content: m[1] });
      remaining = remaining.slice(m[0].length);
      continue;
    }

    // Plain text until special char or end
    m = remaining.match(/^[^'`\[_]+/);
    if (m) {
      tokens.push({ type: "text", content: m[0] });
      remaining = remaining.slice(m[0].length);
      continue;
    }

    // Fallback: single char
    tokens.push({ type: "text", content: remaining[0] });
    remaining = remaining.slice(1);
  }

  return tokens;
}

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
          className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono border border-border/50"
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
    case "math":
      return <InlineMathHTML key={key} latex={token.content} enable={true} />;
    default:
      return null;
  }
}
