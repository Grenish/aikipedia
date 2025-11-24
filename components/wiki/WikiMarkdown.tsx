"use client";

import React, { ReactNode, useMemo, useState, useEffect, useRef } from "react";
import katex from "katex";
import { useInView } from "react-intersection-observer";

// Ensure 'katex/dist/katex.min.css' is imported in layout

interface WikiMarkdownProps {
  children?: string | null | Record<string, any>;
}

const CHUNK_SIZE = 50; // Number of elements to render per chunk

export const WikiMarkdown = React.memo(function WikiMarkdown({
  children,
}: WikiMarkdownProps) {
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const { ref, inView } = useInView({
    threshold: 0.1,
    rootMargin: "400px", // Load more before reaching bottom
  });

  const allElements = useMemo(() => {
    if (!children) return null;

    let textContent = "";

    // Extract text safely
    if (typeof children === "object") {
      if ("wikitext" in children) textContent = children.wikitext as string;
      else if ("*" in children) textContent = children["*"] as string;
      else if ("content" in children) textContent = children.content as string;

      // Fallback
      if (!textContent && Object.keys(children).length > 0) {
        const values = Object.values(children);
        if (values.every((v) => typeof v === "string")) {
          textContent = Object.entries(children)
            .map(([k, v]) => `== ${k} ==\n${v}`)
            .join("\n\n");
        }
      }
    } else {
      textContent = String(children);
    }

    if (!textContent?.trim()) return null;

    // 1. O(N) Cleaner: Removes templates/metadata without array splitting
    const cleanedText = cleanWikiText(textContent);

    // 2. Linear Parser
    return parseContent(cleanedText);
  }, [children]);

  useEffect(() => {
    if (inView && allElements && visibleCount < allElements.length) {
      setVisibleCount((prev) => Math.min(prev + CHUNK_SIZE, allElements.length));
    }
  }, [inView, allElements, visibleCount]);

  // Reset visible count when content changes
  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [children]);

  if (!allElements || allElements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        No renderable content found.
      </div>
    );
  }

  const visibleElements = allElements.slice(0, visibleCount);

  // content-visibility: auto helps browser skip rendering off-screen content
  return (
    <div
      className="prose prose-sm sm:prose-base max-w-none dark:prose-invert warp-break-words"
      style={{ contentVisibility: "auto" }}
    >
      {visibleElements}
      {visibleCount < allElements.length && (
        <div ref={ref} className="h-20 w-full flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Loading more...</span>
        </div>
      )}
    </div>
  );
});

// --- 1. MEMORY OPTIMIZED CLEANER ---

function cleanWikiText(text: string): string {
  if (!text) return "";

  // 1. Fast Regex Removals
  // Removing these first simplifies the stack parser's job
  let out = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/<ref\b[^>]*\/>/g, "");

  // 2. Stack-Based Range Exclusion (Zero-Copy)
  return removeBalancedBlocks(out);
}

function removeBalancedBlocks(text: string): string {
  const len = text.length;
  const rangesToRemove: [number, number][] = [];

  const stackBraces: number[] = []; // {{
  const stackBrackets: number[] = []; // [[

  // Pre-compute lowercase text for faster checks (avoids .toLowerCase() in loop)
  // We only check prefixes, so we can just grab small substrings, but a full lower
  // copy is acceptable for 100k chars (~200kb RAM) vs splitting arrays.
  // Actually, let's just use substring checks to save RAM.

  const noisyPrefixes = new Set([
    "infobox",
    "sidebar",
    "short description",
    "use",
    "pp",
    "authority control",
    "good article",
    "featured article",
    "distinguish",
    "hatnote",
    "reflist",
    "notelist",
    "about",
    "displaytitle",
    "refbegin",
    "refend",
    "cite",
    "citation",
    "portal",
    "taxonbar",
    "coord",
    "s-start",
    "s-end",
    "succession box",
    "navbox",
    "file:",
    "image:",
  ]);

  for (let i = 0; i < len - 1; i++) {
    const code = text.charCodeAt(i);
    const nextCode = text.charCodeAt(i + 1);

    // '{' is 123
    if (code === 123 && nextCode === 123) {
      stackBraces.push(i);
      i++;
    }
    // '[' is 91
    else if (code === 91 && nextCode === 91) {
      stackBrackets.push(i);
      i++;
    }
    // '}' is 125
    else if (code === 125 && nextCode === 125) {
      if (stackBraces.length > 0) {
        const start = stackBraces.pop()!;
        // Check noisy
        if (isNoisyBlock(text, start, i + 2, noisyPrefixes, true)) {
          rangesToRemove.push([start, i + 2]);
        }
      }
      i++;
    }
    // ']' is 93
    else if (code === 93 && nextCode === 93) {
      if (stackBrackets.length > 0) {
        const start = stackBrackets.pop()!;
        if (isNoisyBlock(text, start, i + 2, noisyPrefixes, false)) {
          rangesToRemove.push([start, i + 2]);
        }
      }
      i++;
    }
  }

  if (rangesToRemove.length === 0) return text;

  // Reconstruct string excluding ranges
  // 1. Sort ranges by start
  rangesToRemove.sort((a, b) => a[0] - b[0]);

  // 2. Merge overlapping ranges
  const mergedRanges: [number, number][] = [];
  let currentRange = rangesToRemove[0];

  for (let i = 1; i < rangesToRemove.length; i++) {
    const nextRange = rangesToRemove[i];
    if (nextRange[0] < currentRange[1]) {
      // Overlap, extend end if needed
      currentRange[1] = Math.max(currentRange[1], nextRange[1]);
    } else {
      mergedRanges.push(currentRange);
      currentRange = nextRange;
    }
  }
  mergedRanges.push(currentRange);

  // 3. Build Result
  let result = "";
  let lastCursor = 0;
  for (const [start, end] of mergedRanges) {
    if (start > lastCursor) {
      result += text.slice(lastCursor, start);
    }
    lastCursor = Math.max(lastCursor, end);
  }
  if (lastCursor < len) {
    result += text.slice(lastCursor);
  }

  return result;
}

function isNoisyBlock(
  text: string,
  start: number,
  end: number,
  prefixes: Set<string>,
  isBrace: boolean,
): boolean {
  // Look at first 20 chars inside
  const contentStart = start + 2;
  const checkLen = Math.min(20, end - contentStart);
  if (checkLen <= 0) return false;

  const signature = text
    .slice(contentStart, contentStart + checkLen)
    .toLowerCase()
    .trim();

  // Fast check
  if (!isBrace) {
    // For [[ ]], we only care about File/Image
    return signature.startsWith("file:") || signature.startsWith("image:");
  }

  // For {{ }}, iterate prefixes
  // (Optimization: we could use a Trie here, but loop is fine for short prefixes)
  for (const p of prefixes) {
    if (signature.startsWith(p)) return true;
  }
  return false;
}

// --- 2. OPTIMIZED PARSER ---

function parseContent(text: string): ReactNode[] {
  const elements: ReactNode[] = [];
  const lines = text.split(/\r?\n/);
  const len = lines.length;
  let i = 0;

  while (i < len) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const firstChar = trimmed.charCodeAt(0);

    // '{' (123) -> Table
    if (firstChar === 123 && trimmed.startsWith("{|")) {
      const { element, consumed } = parseTable(lines, i);
      elements.push(element);
      i += consumed;
      continue;
    }

    // '`' (96) -> Code
    if (firstChar === 96 && trimmed.startsWith("```")) {
      const { element, consumed } = parseFencedCode(lines, i);
      elements.push(element);
      i += consumed;
      continue;
    }

    // '$' (36) -> Math
    if (firstChar === 36 && trimmed.startsWith("$$")) {
      const { element, consumed } = parseBlockMath(lines, i);
      elements.push(element);
      i += consumed;
      continue;
    }

    // '=' (61) -> Heading
    if (firstChar === 61 && trimmed.endsWith("=")) {
      const { element, consumed } = parseHeading(line, i);
      elements.push(element);
      i += consumed;
      continue;
    }

    // Lists
    if (
      firstChar === 42 ||
      firstChar === 35 ||
      firstChar === 45 ||
      (firstChar >= 49 && firstChar <= 57)
    ) {
      if (/^[\*\-#]/.test(trimmed) || /^\d+\./.test(trimmed)) {
        const type = firstChar === 42 || firstChar === 45 ? "ul" : "ol";
        const { element, consumed } = parseList(lines, i, type);
        if (consumed > 0) {
          elements.push(element);
          i += consumed;
          continue;
        }
      }
    }

    // Indented Code
    if (line.charCodeAt(0) === 32 && !/^[#\*\-=]/.test(trimmed)) {
      const { element, consumed } = parseIndentedCode(lines, i);
      elements.push(element);
      i += consumed;
      continue;
    }

    // Blockquote
    if (firstChar === 62) {
      // >
      const { element, consumed } = parseBlockquote(lines, i);
      elements.push(element);
      i += consumed;
      continue;
    }

    // HR
    if (firstChar === 45 && /^-{4,}$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} className="my-6 border-border" />);
      i++;
      continue;
    }

    // Syntax Highlight (Block)
    if (firstChar === 60 && trimmed.startsWith("<syntaxhighlight")) {
      const { element, consumed } = parseSyntaxHighlight(lines, i);
      elements.push(element);
      i += consumed;
      continue;
    }

    const { element, consumed } = parseParagraph(lines, i);
    elements.push(element);
    i += consumed;
  }

  return elements;
}

// --- 3. BLOCK COMPONENTS ---

function parseTable(lines: string[], startIndex: number) {
  let i = startIndex + 1;
  const rows: ReactNode[][] = [];
  let currentRow: ReactNode[] = [];
  let isHeaderRow = false;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("|}")) {
      i++;
      break;
    }
    if (!line) {
      i++;
      continue;
    }

    if (line.startsWith("|-")) {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [];
      isHeaderRow = false;
      i++;
      continue;
    }

    if (line.startsWith("|") || line.startsWith("!")) {
      // Simple split, careful with huge tables
      const cells = line.substring(1).split(/\|\|/);
      cells.forEach((cellText) => {
        const isHeader = line.startsWith("!") || isHeaderRow;
        const content = processInlineFormatting(cellText.trim());
        const CellTag = isHeader ? "th" : "td";
        const className = isHeader
          ? "border px-4 py-2 font-bold bg-muted/50 text-left"
          : "border px-4 py-2";
        currentRow.push(
          <CellTag key={currentRow.length} className={className}>
            {content}
          </CellTag>,
        );
      });
    }
    i++;
  }
  if (currentRow.length > 0) rows.push(currentRow);

  return {
    element: (
      <div key={`table-${startIndex}`} className="my-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b hover:bg-muted/50">
                {row}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    consumed: i - startIndex,
  };
}

function parseFencedCode(lines: string[], startIndex: number) {
  const lang = lines[startIndex].trim().replace(/^```/, "").trim();
  const codeLines: string[] = [];
  let i = startIndex + 1;
  while (i < lines.length) {
    if (lines[i].trim().startsWith("```")) {
      i++;
      break;
    }
    codeLines.push(lines[i]);
    i++;
  }
  return {
    element: (
      <div key={`code-${startIndex}`} className="my-4 relative group">
        {lang && (
          <span className="absolute right-2 top-2 text-xs text-muted-foreground border px-1 rounded select-none">
            {lang}
          </span>
        )}
        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm font-mono">
          <code>{codeLines.join("\n")}</code>
        </pre>
      </div>
    ),
    consumed: i - startIndex,
  };
}

function parseSyntaxHighlight(lines: string[], startIndex: number) {
  let i = startIndex;
  const contentLines: string[] = [];

  while (i < lines.length) {
    const line = lines[i];
    contentLines.push(line);
    if (line.toLowerCase().includes("</syntaxhighlight>")) {
      i++;
      break;
    }
    i++;
  }

  const fullBlock = contentLines.join("\n");
  const match =
    /<syntaxhighlight\s*(?:lang="([^"]*)")?[^>]*>([\s\S]*?)<\/syntaxhighlight>/i.exec(
      fullBlock,
    );

  let lang = "";
  let code = "";

  if (match) {
    lang = match[1] || "";
    code = match[2];
  } else {
    code = fullBlock
      .replace(/<syntaxhighlight[^>]*>/i, "")
      .replace(/<\/syntaxhighlight>/i, "");
  }

  return {
    element: (
      <div key={`syntax-${startIndex}`} className="my-4 relative group">
        {lang && (
          <span className="absolute right-2 top-2 text-xs text-muted-foreground border px-1 rounded select-none">
            {lang}
          </span>
        )}
        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm font-mono">
          <code>{code.trim()}</code>
        </pre>
      </div>
    ),
    consumed: i - startIndex,
  };
}

function parseBlockMath(lines: string[], startIndex: number) {
  let mathContent = "";
  let i = startIndex;
  if (lines[i].trim().endsWith("$$") && lines[i].trim().length > 2) {
    mathContent = lines[i].trim().slice(2, -2);
    i++;
  } else {
    i++;
    const contentLines = [];
    while (i < lines.length && !lines[i].trim().endsWith("$$")) {
      contentLines.push(lines[i]);
      i++;
    }
    mathContent = contentLines.join("\n");
    if (i < lines.length) i++;
  }

  let rendered;
  try {
    rendered = katex.renderToString(mathContent, {
      displayMode: true,
      throwOnError: false,
    });
  } catch {
    rendered = `<span class="text-red-500 font-mono text-xs">Math Error</span>`;
  }

  return {
    element: (
      <div
        key={`math-${startIndex}`}
        className="my-4 text-center overflow-x-auto py-2"
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    ),
    consumed: i - startIndex,
  };
}

function parseHeading(line: string, index: number) {
  const trimmed = line.trim();
  let start = 0;
  while (trimmed[start] === "=") start++;
  let end = 0;
  while (trimmed[trimmed.length - 1 - end] === "=") end++;
  const level = Math.min(start, end);

  const text = trimmed.slice(start, trimmed.length - end).trim();
  const Tag = `h${Math.max(1, Math.min(6, level))}` as React.ElementType;
  const sizes = [
    "text-3xl",
    "text-2xl",
    "text-xl",
    "text-lg",
    "text-base",
    "text-sm",
  ];
  const className = `${sizes[level - 1] || "text-base"} font-bold mt-6 mb-3 text-foreground scroll-m-20 border-b pb-2`;

  return {
    element: (
      <Tag
        id={text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
        key={`h-${index}`}
        className={className}
      >
        {processInlineFormatting(text)}
      </Tag>
    ),
    consumed: 1,
  };
}

function parseList(lines: string[], startIndex: number, type: "ul" | "ol") {
  const items: ReactNode[] = [];
  let i = startIndex;
  const regex = type === "ul" ? /^[\*\-]\s+(.+)/ : /^(#|\d+\.)\s+(.+)/;

  while (i < lines.length) {
    const match = lines[i].trim().match(regex);
    if (!match) break;
    items.push(
      <li key={i} className="ml-2 pl-1">
        {processInlineFormatting(match[type === "ul" ? 1 : 2])}
      </li>,
    );
    i++;
  }
  const Tag = type;
  return {
    element: (
      <Tag
        key={`list-${startIndex}`}
        className={`${type === "ul" ? "list-disc" : "list-decimal"} mb-4 ml-6 space-y-1`}
      >
        {items}
      </Tag>
    ),
    consumed: i - startIndex,
  };
}

function parseIndentedCode(lines: string[], startIndex: number) {
  const codeLines: string[] = [];
  let i = startIndex;
  while (i < lines.length && (lines[i].startsWith(" ") || !lines[i].trim())) {
    codeLines.push(lines[i].replace(/^ /, ""));
    i++;
  }
  return {
    element: (
      <pre
        key={`indent-${startIndex}`}
        className="bg-muted p-4 rounded-md mb-4 text-sm"
      >
        <code>{codeLines.join("\n")}</code>
      </pre>
    ),
    consumed: i - startIndex,
  };
}

function parseBlockquote(lines: string[], startIndex: number) {
  const content: string[] = [];
  let i = startIndex;
  while (i < lines.length && lines[i].trim().startsWith(">")) {
    content.push(lines[i].trim().substring(1).trim());
    i++;
  }
  return {
    element: (
      <blockquote
        key={`quote-${startIndex}`}
        className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground"
      >
        {processInlineFormatting(content.join(" "))}
      </blockquote>
    ),
    consumed: i - startIndex,
  };
}

function parseParagraph(lines: string[], startIndex: number) {
  const content: string[] = [];
  let i = startIndex;
  while (i < lines.length) {
    const trim = lines[i].trim();
    if (!trim) {
      i++;
      break;
    }
    const c = trim.charCodeAt(0);
    if (
      c === 61 ||
      c === 96 ||
      c === 123 ||
      c === 36 ||
      c === 35 ||
      c === 42 ||
      c === 45 ||
      c === 62
    )
      break;
    content.push(trim);
    i++;
  }
  if (content.length === 0) return { element: null, consumed: 1 };

  return {
    element: (
      <p key={`p-${startIndex}`} className="mb-4 leading-7">
        {processInlineFormatting(content.join(" "))}
      </p>
    ),
    consumed: i - startIndex,
  };
}

// --- 4. ZERO-COPY INLINE TOKENIZER ---

function processInlineFormatting(text: string): ReactNode[] {
  const elements: ReactNode[] = [];
  let lastIndex = 0;

  const tokenRegex = /(\[\[|''|\$|`|\[http|<math|<sup|<sub|{{|<syntaxhighlight|<code)/g;

  let match;
  while ((match = tokenRegex.exec(text)) !== null) {
    const idx = match.index;

    // Push preceding text
    if (idx > lastIndex) {
      elements.push(text.slice(lastIndex, idx));
    }

    const tokenStart = match[0];
    let handled = false;

    // We search the ORIGINAL text string to avoid creating slices
    // A. Wiki Link [[...]]
    if (tokenStart === "[[") {
      const end = text.indexOf("]]", idx + 2);
      if (end !== -1) {
        const content = text.slice(idx + 2, end);
        const pipeIdx = content.indexOf("|");
        const target = pipeIdx === -1 ? content : content.slice(0, pipeIdx);
        const label = pipeIdx === -1 ? content : content.slice(pipeIdx + 1);

        const href = `/search/${encodeURIComponent(target.trim().replace(/ /g, "_"))}`;
        elements.push(
          <a
            key={idx}
            href={href}
            className="text-primary hover:underline font-medium"
          >
            {label || target}
          </a>,
        );

        lastIndex = end + 2;
        tokenRegex.lastIndex = lastIndex;
        handled = true;
      }
    }
    // B. Code `...`
    else if (tokenStart === "`") {
      const end = text.indexOf("`", idx + 1);
      if (end !== -1) {
        elements.push(
          <code key={idx} className="bg-muted px-1 rounded text-sm font-mono">
            {text.slice(idx + 1, end)}
          </code>,
        );
        lastIndex = end + 1;
        tokenRegex.lastIndex = lastIndex;
        handled = true;
      }
    }
    // C. Bold/Italic
    else if (tokenStart.startsWith("''")) {
      if (text.startsWith("'''", idx)) {
        const end = text.indexOf("'''", idx + 3);
        if (end !== -1) {
          elements.push(<strong key={idx}>{text.slice(idx + 3, end)}</strong>);
          lastIndex = end + 3;
          tokenRegex.lastIndex = lastIndex;
          handled = true;
        }
      }
      if (!handled && text.startsWith("''", idx)) {
        const end = text.indexOf("''", idx + 2);
        if (end !== -1) {
          elements.push(<em key={idx}>{text.slice(idx + 2, end)}</em>);
          lastIndex = end + 2;
          tokenRegex.lastIndex = lastIndex;
          handled = true;
        }
      }
    }
    // D. Math $...$
    else if (tokenStart === "$") {
      const end = text.indexOf("$", idx + 1);
      if (end !== -1) {
        try {
          const html = katex.renderToString(text.slice(idx + 1, end), {
            throwOnError: false,
          });
          elements.push(
            <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />,
          );
        } catch {
          elements.push("$");
        }
        lastIndex = end + 1;
        tokenRegex.lastIndex = lastIndex;
        handled = true;
      }
    }
    // E. <math> tags
    else if (tokenStart === "<math") {
      const end = text.indexOf("</math>", idx);
      if (end !== -1) {
        const fullTag = text.slice(idx, end + 7);
        const contentStart = fullTag.indexOf(">");
        if (contentStart !== -1) {
          const mathContent = fullTag.slice(contentStart + 1, -7);
          try {
            const html = katex.renderToString(mathContent, {
              throwOnError: false,
              displayMode: fullTag.includes('display="block"'),
            });
            elements.push(
              <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />,
            );
          } catch {
            elements.push(fullTag);
          }
          lastIndex = end + 7;
          tokenRegex.lastIndex = lastIndex;
          handled = true;
        }
      }
    }
    // F. Superscript
    else if (tokenStart === "<sup") {
      const end = text.indexOf("</sup>", idx);
      if (end !== -1) {
        const tagEnd = text.indexOf(">", idx);
        if (tagEnd !== -1 && tagEnd < end) {
          elements.push(
            <sup key={idx}>
              {processInlineFormatting(text.slice(tagEnd + 1, end))}
            </sup>,
          );
          lastIndex = end + 6;
          tokenRegex.lastIndex = lastIndex;
          handled = true;
        }
      }
    }
    // G. Subscript
    else if (tokenStart === "<sub") {
      const end = text.indexOf("</sub>", idx);
      if (end !== -1) {
        const tagEnd = text.indexOf(">", idx);
        if (tagEnd !== -1 && tagEnd < end) {
          elements.push(
            <sub key={idx}>
              {processInlineFormatting(text.slice(tagEnd + 1, end))}
            </sub>,
          );
          lastIndex = end + 6;
          tokenRegex.lastIndex = lastIndex;
          handled = true;
        }
      }
    }
    // H. Templates {{...}}
    else if (tokenStart === "{{") {
      const end = text.indexOf("}}", idx + 2);
      if (end !== -1) {
        const content = text.slice(idx + 2, end);
        const parts = content.split("|");
        const type = parts[0].trim().toLowerCase();

        if (type === "annotated link" && parts[1]) {
          const target = parts[1].trim();
          const href = `/search/${encodeURIComponent(target.replace(/ /g, "_"))}`;
          elements.push(
            <a
              key={idx}
              href={href}
              className="text-primary hover:underline font-medium"
            >
              {target}
            </a>,
          );
          lastIndex = end + 2;
          tokenRegex.lastIndex = lastIndex;
          handled = true;
        } else if (type === "ipac-en") {
          const ipa = parts
            .slice(1)
            .filter((p) => !p.includes("="))
            .join("");
          elements.push(
            <span
              key={idx}
              className="font-sans text-sm bg-muted/50 px-1 rounded mx-1"
              title="IPA Pronunciation"
            >
              /{ipa}/
            </span>,
          );
          lastIndex = end + 2;
          tokenRegex.lastIndex = lastIndex;
          handled = true;
        } else if (type === "respell") {
          const respell = parts.slice(1).join("-");
          elements.push(
            <span key={idx} className="text-sm text-muted-foreground mx-1">
              ({respell})
            </span>,
          );
          lastIndex = end + 2;
          tokenRegex.lastIndex = lastIndex;
          handled = true;
        } else if (type === "lisp2" || type === "code") {
          const content = parts.slice(1).join("|");
          elements.push(
            <code
              key={idx}
              className="bg-muted px-1 rounded text-sm font-mono text-primary"
            >
              {content}
            </code>,
          );
          lastIndex = end + 2;
          tokenRegex.lastIndex = lastIndex;
          handled = true;
        } else if (type === "webarchive") {
          const params: Record<string, string> = {};
          parts.slice(1).forEach((part) => {
            const eqIdx = part.indexOf("=");
            if (eqIdx !== -1) {
              const key = part.slice(0, eqIdx).trim().toLowerCase();
              const val = part.slice(eqIdx + 1).trim();
              params[key] = val.replace(/^"|"$/g, "");
            }
          });

          if (params.url) {
            elements.push(
              <span key={idx}>
                <a
                  href={params.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {params.title || "Archived Link"}
                </a>
                {params.date && (
                  <span className="text-muted-foreground text-sm ml-1">
                    (archived {params.date})
                  </span>
                )}
              </span>,
            );
            lastIndex = end + 2;
            tokenRegex.lastIndex = lastIndex;
            handled = true;
          }
        }
      }
    }
    // I. External Links [http...]
    else if (tokenStart === "[http") {
      const end = text.indexOf("]", idx);
      if (end !== -1) {
        const content = text.slice(idx + 1, end); // "http... label"
        const spaceIdx = content.indexOf(" ");
        let url = content;
        let label = content;

        if (spaceIdx !== -1) {
          url = content.slice(0, spaceIdx);
          label = content.slice(spaceIdx + 1);
        }

        elements.push(
          <a
            key={idx}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all"
          >
            {label}
            <span className="inline-block ml-1 text-[10px]">↗</span>
          </a>,
        );
        lastIndex = end + 1;
        tokenRegex.lastIndex = lastIndex;
        handled = true;
      }
    }
    // J. Syntax Highlight
    else if (tokenStart === "<syntaxhighlight") {
      const end = text.indexOf("</syntaxhighlight>", idx);
      if (end !== -1) {
        const fullTag = text.slice(idx, end + 18);
        const contentStart = fullTag.indexOf(">");
        if (contentStart !== -1) {
          const codeContent = fullTag.slice(contentStart + 1, -18);
          elements.push(
            <code
              key={idx}
              className="bg-muted px-1 rounded text-sm font-mono text-primary"
            >
              {codeContent}
            </code>,
          );
          lastIndex = end + 18;
          tokenRegex.lastIndex = lastIndex;
          handled = true;
        }
      }
    }
    // K. Code tag
    else if (tokenStart === "<code") {
      const end = text.indexOf("</code>", idx);
      if (end !== -1) {
        const tagEnd = text.indexOf(">", idx);
        if (tagEnd !== -1 && tagEnd < end) {
          elements.push(
            <code
              key={idx}
              className="bg-muted px-1 rounded text-sm font-mono text-primary"
            >
              {text.slice(tagEnd + 1, end)}
            </code>,
          );
          lastIndex = end + 7;
          tokenRegex.lastIndex = lastIndex;
          handled = true;
        }
      }
    }

    if (!handled) {
      elements.push(tokenStart);
      lastIndex = idx + tokenStart.length;
    }
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}
