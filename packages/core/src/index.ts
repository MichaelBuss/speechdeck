export type Appearance = "light" | "dark" | "auto";
export type Motion = "auto" | "always";
export type Enter = "cut" | "connected";
export type LayoutName = "cover" | "section" | "solo" | "split-2" | "split-3" | "grid" | "caption";
export type Fit = "contain" | "crop";
export type Focus =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";
export type Look = "dim" | "blur";

export type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };

export type FileMap = {
  read(relative: string): string;
};

export type ThemeTokens = {
  specifier: string;
  fonts: { title: string; body: string; mono: string };
  accents: readonly [string, string, string, string];
  dark: Palette;
  light: Palette;
  stops?: readonly string[];
};

export type Palette = {
  fg: string;
  title: string;
  muted: string;
  chrome: string;
};

export type Deck = {
  theme: string;
  tokens: ThemeTokens;
  appearance: Appearance;
  motion: Motion;
  slides: readonly Slide[];
};

export type Slide = {
  /** 1-based place in the Deck, as a string. URL `/1`. */
  id: string;
  enter: Enter;
  cells: readonly Cell[];
  speech: Speech;
  background?: Image;
  layout?: LayoutName;
};

export type Speech = {
  blocks: readonly SpeechBlock[];
};

export type SpeechBlock =
  | { kind: "paragraph"; html: string }
  | { kind: "list"; html: string }
  | { kind: "quote"; html: string };

export type Cell = {
  blocks: readonly Block[];
};

export type Block = HeadingBlock | CodeBlock | ImageBlock | EmbedBlock | TableBlock | ProseBlock;

export type HeadingBlock = {
  kind: "heading";
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  html: string;
};

export type CodeSource =
  | { from: "fence"; bytes: string }
  | { from: "file"; path: string; region?: string; bytes: string };

export type CodeBlock = {
  kind: "code";
  lang: string;
  source: CodeSource;
  html: string;
};

export type Image = {
  src: string;
  alt: string;
  fit: Fit;
  focus: Focus;
  looks: readonly Look[];
};

export type ImageBlock = Image & { kind: "image" };

export type EmbedBlock = {
  kind: "embed";
  specifier: string;
  props: Json;
  fallback?: string;
};

export type TableBlock = { kind: "table"; html: string };
export type ProseBlock = { kind: "prose"; html: string };

export type Arrival = {
  to: string;
  from?: string;
};

export type Viewport = {
  width: number;
  height: number;
};

export type Named = {
  identity: string;
  name: string;
  class: "heading" | "code" | "figure";
};

export type Frame = {
  slide: Slide;
  layout: LayoutName;
  layoutAuto: LayoutName;
  layoutSource: "auto" | "override";
  enter: Enter;
  t: number;
  stop: "consumed" | "skipped";
  speech: Speech;
  upNext: Slide | undefined;
  names: readonly Named[];
};

export type CodeMatch = {
  key: string;
  pairing: "morph" | "none";
};

export type EmbedGuest<El = unknown> = (
  el: El,
  props: Json,
) => {
  dispose: () => void;
  ready: Promise<void>;
};

export type DiagnosticKind =
  | "connected-on-first"
  | "duplicate-region"
  | "body-and-path"
  | "impossible-layout"
  | "unknown-image-token";

export type Diagnostic = {
  kind: DiagnosticKind;
  /** 1-based Slide id when the problem belongs to one Slide. */
  slide?: string;
  message: string;
};

const LAYOUT_NAMES: readonly LayoutName[] = [
  "cover",
  "section",
  "solo",
  "split-2",
  "split-3",
  "grid",
  "caption",
];

function isLayoutName(value: string): value is LayoutName {
  return (LAYOUT_NAMES as readonly string[]).includes(value);
}

function soleHeading(cell: Cell): HeadingBlock | undefined {
  const block = cell.blocks[0];
  return cell.blocks.length === 1 && block?.kind === "heading" ? block : undefined;
}

function soleImage(cell: Cell): ImageBlock | undefined {
  const block = cell.blocks[0];
  return cell.blocks.length === 1 && block?.kind === "image" ? block : undefined;
}

function hasImage(cell: Cell): boolean {
  return cell.blocks.some((block) => block.kind === "image");
}

/** FNV-1a: deterministic and dependency-free, so the same heading text or image src
 *  always mints the same view-transition-name — on either side of a connected edge,
 *  in any Deck. */
function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** A view-transition-name is a CSS custom-ident: raw heading text or an image src
 *  cannot serve directly, so identity is hashed into one instead of slugged (a slug
 *  can collide across different identities; a hash of the full identity does not). */
function mintName(kind: "heading" | "figure", identity: string): string {
  return `sd-${kind === "heading" ? "h" : "f"}-${fnv1a32(identity)}`;
}

/** Duplicate identity fail the build (ADR 0005): the runtime never suffixes a name,
 *  so two headings with the same text, or two images with the same src, on one Slide
 *  could not both keep it. */
function assertUniqueIdentities(cells: readonly Cell[], slideId: string): void {
  const headingTexts = new Set<string>();
  const imageSrcs = new Set<string>();
  for (const cell of cells) {
    const heading = soleHeading(cell);
    if (heading !== undefined) {
      if (headingTexts.has(heading.text)) {
        throw new Error(
          `Slide ${slideId} has two headings with the text "${heading.text}"; identity names cannot repeat within a Slide.`,
        );
      }
      headingTexts.add(heading.text);
      continue;
    }
    const image = soleImage(cell);
    if (image !== undefined) {
      if (imageSrcs.has(image.src)) {
        throw new Error(
          `Slide ${slideId} has two images with the src "${image.src}"; identity names cannot repeat within a Slide.`,
        );
      }
      imageSrcs.add(image.src);
    }
  }
}

function isH4Only(cell: Cell): boolean {
  return soleHeading(cell)?.depth === 4;
}

function isCaption(cells: readonly Cell[]): boolean {
  const [a, b] = cells;
  if (a === undefined || b === undefined) return false;
  return (isH4Only(a) && hasImage(b)) || (hasImage(a) && isH4Only(b));
}

function autoLayout(cells: readonly Cell[]): LayoutName {
  const n = cells.length;
  if (n <= 1) {
    const cell = cells[0];
    if (cell === undefined) return "solo";
    const heading = soleHeading(cell);
    if (heading?.depth === 1) return "cover";
    if (heading !== undefined && heading.depth >= 2) return "section";
    return "solo";
  }
  if (n === 2) return isCaption(cells) ? "caption" : "split-2";
  if (n === 3) return "split-3";
  return "grid";
}

function isPossible(layout: LayoutName, cells: readonly Cell[]): boolean {
  switch (layout) {
    case "cover":
    case "section":
    case "solo":
      return cells.length === 1;
    case "split-2":
      return cells.length === 2;
    case "split-3":
      return cells.length === 3;
    case "grid":
      return cells.length >= 4;
    case "caption":
      return isCaption(cells);
  }
}

function toAppearance(value: string | undefined): Appearance {
  return value === "light" || value === "auto" ? value : "dark";
}

function toMotion(value: string | undefined): Motion {
  return value === "always" ? "always" : "auto";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseFrontmatterFields(
  lines: readonly string[],
  openAt: number,
): { fields: Record<string, string>; next: number } {
  const fields: Record<string, string> = {};
  let i = openAt + 1;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && line.trim() === "---") {
      i++;
      break;
    }
    const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line ?? "");
    const key = match?.[1];
    const value = match?.[2];
    if (key !== undefined && value !== undefined) fields[key] = value.trim();
  }
  return { fields, next: i };
}

type SlideSource = { fields: Record<string, string>; bodyLines: readonly string[] };

function splitSlideSources(bodyLines: readonly string[]): SlideSource[] {
  const chunks: string[][] = [[]];
  for (const line of bodyLines) {
    if (line.trim() === "---") chunks.push([]);
    else chunks[chunks.length - 1]?.push(line);
  }
  return chunks.map((chunkLines): SlideSource => {
    const fields: Record<string, string> = {};
    let i = 0;
    while (i < chunkLines.length) {
      const line = chunkLines[i];
      if (line === undefined) break;
      const trimmed = line.trim();
      if (trimmed === "") {
        i++;
        break;
      }
      const match = /^(layout|enter):\s*(.*)$/.exec(trimmed);
      if (!match?.[1] || match[2] === undefined) break;
      fields[match[1]] = match[2].trim();
      i++;
    }
    return { fields, bodyLines: chunkLines.slice(i) };
  });
}

/** Any HTML comment other than the exact `<!--on-->` line is a Comment: dropped before
 *  grouping so it never opens a Cell boundary and never surfaces in Speech or a Cell. */
type LogicalLine = { text: string } | { promote: true };

function preprocessLines(bodyLines: readonly string[]): LogicalLine[] {
  const out: LogicalLine[] = [];
  for (const raw of bodyLines) {
    if (raw.trim() === "<!--on-->") {
      out.push({ promote: true });
      continue;
    }
    const stripped = raw.replace(/<!--[\s\S]*?-->/g, "");
    if (raw.trim() !== "" && stripped.trim() === "") continue;
    out.push({ text: stripped });
  }
  return out;
}

type RawGroup = { lines: string[]; promoted: boolean };

/** A blank line starts a new Cell; a dangling `<!--on-->` with no adjacent block is a no-op. */
function groupLogicalLines(entries: readonly LogicalLine[]): RawGroup[] {
  const groups: RawGroup[] = [];
  let current: string[] = [];
  let currentPromoted = false;
  let pendingPromote = false;
  for (const entry of entries) {
    if ("promote" in entry) {
      pendingPromote = true;
      continue;
    }
    if (entry.text.trim() === "") {
      if (current.length > 0) {
        groups.push({ lines: current, promoted: currentPromoted });
        current = [];
        currentPromoted = false;
      }
      pendingPromote = false;
      continue;
    }
    if (current.length === 0) currentPromoted = pendingPromote;
    pendingPromote = false;
    current.push(entry.text);
  }
  if (current.length > 0) groups.push({ lines: current, promoted: currentPromoted });
  return groups;
}

const FIT_VALUES: readonly Fit[] = ["contain", "crop"];
const FOCUS_VALUES: readonly Focus[] = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
];
const LOOK_VALUES: readonly Look[] = ["dim", "blur"];
const IMAGE_RE = /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"([^"]*)")?\s*\)$/;

function parseImageLine(line: string): { alt: string; src: string; title: string } | undefined {
  const match = IMAGE_RE.exec(line.trim());
  const src = match?.[2];
  if (src === undefined) return undefined;
  return { alt: match?.[1] ?? "", src, title: match?.[3] ?? "" };
}

/** Tokens are order-sensitive but each optional: background, then contain|crop, then a
 *  Focus, then any Looks. A token that does not match its position falls through to the
 *  Looks check, so an out-of-order or unknown token is flagged rather than silently moving
 *  a later slot earlier. */
function parseImageTitle(
  title: string,
  slideId: string,
  diagnostics: Diagnostic[],
): { background: boolean; fit: Fit; focus: Focus; looks: Look[] } {
  const tokens = title.split(/\s+/).filter((token) => token.length > 0);
  let i = 0;

  const background = tokens[i] === "background";
  if (background) i++;

  let fit: Fit | undefined;
  const fitToken = tokens[i];
  if (fitToken !== undefined && (FIT_VALUES as readonly string[]).includes(fitToken)) {
    fit = fitToken as Fit;
    i++;
  }

  let focus: Focus = "center";
  const focusToken = tokens[i];
  if (focusToken !== undefined && (FOCUS_VALUES as readonly string[]).includes(focusToken)) {
    focus = focusToken as Focus;
    i++;
  }

  const looks: Look[] = [];
  for (; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === undefined) continue;
    if ((LOOK_VALUES as readonly string[]).includes(token)) {
      looks.push(token as Look);
    } else {
      diagnostics.push({
        kind: "unknown-image-token",
        slide: slideId,
        message: `Unrecognized image title token "${token}".`,
      });
    }
  }

  return { background, fit: fit ?? (background ? "crop" : "contain"), focus, looks };
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const LIST_ITEM_RE = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/;
const ORDERED_ITEM_RE = /^\s*\d+\.\s+/;
const QUOTE_LINE_RE = /^\s*>\s?(.*)$/;
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const MARK_RE = /<mark(?: data-mark="([a-z-]+)")?>([\s\S]*?)<\/mark>/g;
const MARK_TYPES = new Set(["underline", "circle", "highlight", "box", "strike-through"]);

/** Preserves valid `<mark>` / `<mark data-mark="...">` spans verbatim; everything else,
 *  including an unrecognized data-mark value, is escaped as plain text. */
function inlineHtml(text: string): string {
  let result = "";
  let lastIndex = 0;
  for (const match of text.matchAll(MARK_RE)) {
    const type = match[1];
    if (type !== undefined && !MARK_TYPES.has(type)) continue;
    const start = match.index;
    result += escapeHtml(text.slice(lastIndex, start));
    const openTag = type === undefined ? "<mark>" : `<mark data-mark="${type}">`;
    result += `${openTag}${escapeHtml(match[2] ?? "")}</mark>`;
    lastIndex = start + match[0].length;
  }
  result += escapeHtml(text.slice(lastIndex));
  return result;
}

function isTableGroup(lines: readonly string[]): boolean {
  const header = lines[0];
  const separator = lines[1];
  if (header === undefined || separator === undefined) return false;
  return header.includes("|") && separator.includes("-") && TABLE_SEPARATOR_RE.test(separator);
}

function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

function buildTableHtml(lines: readonly string[]): string {
  const header = splitTableRow(lines[0] ?? "");
  const rows = lines.slice(2).map(splitTableRow);
  const thead = `<thead><tr>${header.map((cell) => `<th>${inlineHtml(cell)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${inlineHtml(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

function isListGroup(lines: readonly string[]): boolean {
  return lines.every((line) => LIST_ITEM_RE.test(line));
}

function buildListHtml(lines: readonly string[]): string {
  const tag = ORDERED_ITEM_RE.test(lines[0] ?? "") ? "ol" : "ul";
  const items = lines
    .map((line) => (LIST_ITEM_RE.exec(line)?.[1] ?? "").trim())
    .map((item) => `<li>${inlineHtml(item)}</li>`)
    .join("");
  return `<${tag}>${items}</${tag}>`;
}

function isQuoteGroup(lines: readonly string[]): boolean {
  return lines.every((line) => QUOTE_LINE_RE.test(line));
}

function buildQuoteHtml(lines: readonly string[]): string {
  const text = lines
    .map((line) => QUOTE_LINE_RE.exec(line)?.[1] ?? "")
    .join(" ")
    .trim();
  return `<blockquote><p>${inlineHtml(text)}</p></blockquote>`;
}

function buildParagraphHtml(lines: readonly string[]): string {
  return `<p>${inlineHtml(lines.join(" ").trim())}</p>`;
}

const FENCE_OPEN_RE = /^(`{3,})(.*)$/;

type BodySegment =
  | { kind: "text"; lines: readonly string[] }
  | { kind: "fence"; info: string; lines: readonly string[] };

/** A fenced code block is a Cell that stands on its own even when its body has blank lines,
 *  so fences are pulled out before the blank-line Cell-boundary rule runs on the rest. */
function splitFenceSegments(bodyLines: readonly string[]): BodySegment[] {
  const segments: BodySegment[] = [];
  let text: string[] = [];
  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i] ?? "";
    const open = FENCE_OPEN_RE.exec(line);
    if (open?.[1] === undefined) {
      text.push(line);
      i++;
      continue;
    }
    if (text.length > 0) {
      segments.push({ kind: "text", lines: text });
      text = [];
    }
    const fenceLen = open[1].length;
    const info = (open[2] ?? "").trim();
    const codeLines: string[] = [];
    i++;
    for (; i < bodyLines.length; i++) {
      const line2 = bodyLines[i] ?? "";
      const closeTrim = line2.trim();
      if (/^`+$/.test(closeTrim) && closeTrim.length >= fenceLen) {
        i++;
        break;
      }
      codeLines.push(line2);
    }
    segments.push({ kind: "fence", info, lines: codeLines });
  }
  if (text.length > 0) segments.push({ kind: "text", lines: text });
  return segments;
}

const REGION_START_RE = /#region\s+(\S+)/;
const REGION_END_RE = /#endregion\b/;

type RegionSpan = { name: string; lines: readonly string[] };

/** `#region name` … `#endregion`; a line range is not a Region, so this only ever
 *  recognizes those exact markers, never numeric spans. */
function findRegions(content: string): RegionSpan[] {
  const lines = content.split(/\r?\n/);
  const stack: { name: string; start: number }[] = [];
  const spans: RegionSpan[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const start = REGION_START_RE.exec(line);
    if (start?.[1] !== undefined) {
      stack.push({ name: start[1], start: i + 1 });
      continue;
    }
    if (REGION_END_RE.test(line)) {
      const top = stack.pop();
      if (top !== undefined) spans.push({ name: top.name, lines: lines.slice(top.start, i) });
    }
  }
  return spans;
}

function duplicateRegionNames(spans: readonly RegionSpan[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const span of spans) {
    if (seen.has(span.name)) duplicates.add(span.name);
    seen.add(span.name);
  }
  return [...duplicates];
}

/** A code Cell path is a path relative to the Deck, never a package name or a URL —
 *  those are something you run, not something to read bytes from. */
function isCodeFilePath(path: string): boolean {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(path)) return false;
  return path.startsWith("./") || path.startsWith("../");
}

/** A flat `key: value` map only — nesting and multi-line scalars are out of v0 scope, matching
 *  Frontmatter's own line-at-a-time parsing rather than pulling in a YAML library. */
function coerceYamlScalar(raw: string): Json {
  if (raw === "" || raw === "null" || raw === "~") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const doubleQuoted = /^"(.*)"$/.exec(raw);
  if (doubleQuoted?.[1] !== undefined) return doubleQuoted[1];
  const singleQuoted = /^'(.*)'$/.exec(raw);
  if (singleQuoted?.[1] !== undefined) return singleQuoted[1];
  return raw;
}

function parseEmbedProps(bodyLines: readonly string[]): Json {
  const props: Record<string, Json> = {};
  let any = false;
  for (const line of bodyLines) {
    const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    const key = match?.[1];
    const raw = match?.[2];
    if (key === undefined || raw === undefined) continue;
    props[key] = coerceYamlScalar(raw.trim());
    any = true;
  }
  return any ? props : null;
}

/** A specifier is a path relative to the Deck, or a package name — unlike a code Cell's
 *  path, a bare package name is exactly what an Embed is allowed to be, so no path shape
 *  is enforced here. */
function buildEmbedCell(info: string, fenceLines: readonly string[]): Cell {
  const tokens = info.split(/\s+/).filter((token) => token.length > 0);
  const specifier = tokens[1];
  if (specifier === undefined) {
    throw new Error("An Embed fence needs a module specifier: ```embed <specifier>.");
  }
  const props = parseEmbedProps(fenceLines);
  return { blocks: [{ kind: "embed", specifier, props }] };
}

function buildCodeCell(
  info: string,
  fenceLines: readonly string[],
  slideId: string,
  files: FileMap,
  diagnostics: Diagnostic[],
): Cell {
  const tokens = info.split(/\s+/).filter((token) => token.length > 0);
  const lang = tokens[0] ?? "";
  const pathToken = tokens[1];
  const body = fenceLines.join("\n");

  if (pathToken === undefined) {
    const source: CodeSource = { from: "fence", bytes: body };
    return {
      blocks: [{ kind: "code", lang, source, html: `<pre><code>${escapeHtml(body)}</code></pre>` }],
    };
  }

  if (!isCodeFilePath(pathToken)) {
    throw new Error(
      `Code Cell path "${pathToken}" is not a path relative to the Deck; a package name or a URL is not a code path.`,
    );
  }

  if (body.trim() !== "") {
    diagnostics.push({
      kind: "body-and-path",
      slide: slideId,
      message: `Code Cell has both a body and a path "${pathToken}"; a file-backed Cell has an empty body.`,
    });
  }

  const hashIndex = pathToken.indexOf("#");
  const path = hashIndex === -1 ? pathToken : pathToken.slice(0, hashIndex);
  const region = hashIndex === -1 ? undefined : pathToken.slice(hashIndex + 1);

  const fileContent = files.read(path);
  const regions = findRegions(fileContent);
  const duplicates = duplicateRegionNames(regions);
  if (duplicates.length > 0) {
    diagnostics.push({
      kind: "duplicate-region",
      slide: slideId,
      message: `Duplicate #region name(s) ${duplicates.join(", ")} in "${path}".`,
    });
  }

  let bytes: string;
  if (region === undefined) {
    bytes = fileContent;
  } else {
    const match = regions.find((span) => span.name === region);
    if (match === undefined) throw new Error(`No #region "${region}" in "${path}".`);
    bytes = match.lines.join("\n");
  }

  const source: CodeSource =
    region === undefined ? { from: "file", path, bytes } : { from: "file", path, region, bytes };
  return {
    blocks: [{ kind: "code", lang, source, html: `<pre><code>${escapeHtml(bytes)}</code></pre>` }],
  };
}

function parseBody(
  bodyLines: readonly string[],
  slideId: string,
  files: FileMap,
  diagnostics: Diagnostic[],
): { cells: Cell[]; speech: Speech; background?: Image } {
  const cells: Cell[] = [];
  const speechBlocks: SpeechBlock[] = [];
  let background: Image | undefined;
  for (const segment of splitFenceSegments(bodyLines)) {
    if (segment.kind === "fence") {
      const fenceLang = segment.info.split(/\s+/, 1)[0];
      cells.push(
        fenceLang === "embed"
          ? buildEmbedCell(segment.info, segment.lines)
          : buildCodeCell(segment.info, segment.lines, slideId, files, diagnostics),
      );
      continue;
    }
    for (const group of groupLogicalLines(preprocessLines(segment.lines))) {
      const first = group.lines[0] ?? "";
      const heading = HEADING_RE.exec(first);
      const depth = heading?.[1]?.length;
      const text = heading?.[2];
      if (depth !== undefined && text !== undefined) {
        cells.push({
          blocks: [
            {
              kind: "heading",
              depth: depth as 1 | 2 | 3 | 4 | 5 | 6,
              text: text.trim(),
              html: escapeHtml(text.trim()),
            },
          ],
        });
        continue;
      }
      const imageMatch = parseImageLine(first);
      if (imageMatch !== undefined) {
        const {
          background: isBackground,
          fit,
          focus,
          looks,
        } = parseImageTitle(imageMatch.title, slideId, diagnostics);
        const image: Image = { src: imageMatch.src, alt: imageMatch.alt, fit, focus, looks };
        if (isBackground) background = image;
        else cells.push({ blocks: [{ kind: "image", ...image }] });
        continue;
      }
      if (isTableGroup(group.lines)) {
        cells.push({ blocks: [{ kind: "table", html: buildTableHtml(group.lines) }] });
        continue;
      }
      if (isListGroup(group.lines)) {
        const html = buildListHtml(group.lines);
        if (group.promoted) cells.push({ blocks: [{ kind: "prose", html }] });
        else speechBlocks.push({ kind: "list", html });
        continue;
      }
      if (isQuoteGroup(group.lines)) {
        const html = buildQuoteHtml(group.lines);
        if (group.promoted) cells.push({ blocks: [{ kind: "prose", html }] });
        else speechBlocks.push({ kind: "quote", html });
        continue;
      }
      if (group.lines.join(" ").trim() === "") continue;
      const html = buildParagraphHtml(group.lines);
      if (group.promoted) cells.push({ blocks: [{ kind: "prose", html }] });
      else speechBlocks.push({ kind: "paragraph", html });
    }
  }
  return {
    cells,
    speech: { blocks: speechBlocks },
    ...(background !== undefined ? { background } : {}),
  };
}

function buildSlide(
  source: SlideSource,
  id: string,
  isFirst: boolean,
  files: FileMap,
  diagnostics: Diagnostic[],
): Slide {
  const enter: Enter = source.fields["enter"] === "connected" ? "connected" : "cut";
  if (enter === "connected" && isFirst) {
    diagnostics.push({
      kind: "connected-on-first",
      slide: id,
      message:
        "enter: connected on the first Slide has no origin; the Arrival is still a hard cut.",
    });
  }
  const { cells, speech, background } = parseBody(source.bodyLines, id, files, diagnostics);
  assertUniqueIdentities(cells, id);
  const auto = autoLayout(cells);
  const layoutField = source.fields["layout"];
  let layout: LayoutName | undefined;
  if (layoutField !== undefined && isLayoutName(layoutField)) {
    layout = layoutField;
    if (!isPossible(layout, cells)) {
      diagnostics.push({
        kind: "impossible-layout",
        slide: id,
        message: `layout: ${layout} does not fit ${cells.length} Cell(s); auto (${auto}) still renders.`,
      });
    }
  }
  return {
    id,
    enter,
    cells,
    speech,
    ...(background !== undefined ? { background } : {}),
    ...(layout !== undefined ? { layout } : {}),
  };
}

function resolveTheme(specifier: string, files: FileMap): ThemeTokens {
  const raw = files.read(`${specifier}/theme.json`);
  const json = JSON.parse(raw) as Record<string, unknown>;
  const fonts = json["fonts"] as ThemeTokens["fonts"] | undefined;
  const accents = json["accents"] as ThemeTokens["accents"] | undefined;
  const dark = json["dark"] as Palette | undefined;
  const light = json["light"] as Palette | undefined;
  if (fonts === undefined || accents?.length !== 4 || dark === undefined || light === undefined) {
    throw new Error(`Theme "${specifier}" has an incomplete theme.json`);
  }
  const stops = json["stops"] as readonly string[] | undefined;
  return {
    specifier,
    fonts,
    accents,
    dark,
    light,
    ...(stops !== undefined ? { stops } : {}),
  };
}

export function parseDeck(
  markdown: string,
  files: FileMap,
): { deck: Deck; diagnostics: readonly Diagnostic[] } {
  const lines = markdown.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    throw new Error("theme is required in Deck Frontmatter");
  }
  const { fields: deckFields, next } = parseFrontmatterFields(lines, 0);
  const theme = deckFields["theme"]?.trim();
  if (theme === undefined || theme === "") {
    throw new Error("theme is required in Deck Frontmatter");
  }
  const tokens = resolveTheme(theme, files);
  const appearance = toAppearance(deckFields["appearance"]);
  const motion = toMotion(deckFields["motion"]);

  const diagnostics: Diagnostic[] = [];
  const slides = splitSlideSources(lines.slice(next)).map((source, i) =>
    buildSlide(source, String(i + 1), i === 0, files, diagnostics),
  );

  return {
    deck: { theme, tokens, appearance, motion, slides },
    diagnostics,
  };
}

function travelT(index: number, participate: readonly boolean[]): { t: number; skipped: boolean } {
  const skipped = participate[index] === false;
  const participants: number[] = [];
  for (let i = 0; i < participate.length; i++) {
    if (participate[i] === true) participants.push(i);
  }
  if (participants.length <= 1) return { t: 0, skipped };
  let pos = 0;
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    if (p === undefined) continue;
    if (p <= index) pos = i;
    else break;
  }
  return { t: pos / (participants.length - 1), skipped };
}

export function resolveFrame(deck: Deck, arrival: Arrival): Frame {
  const index = deck.slides.findIndex((s) => s.id === arrival.to);
  const slide = deck.slides[index];
  if (slide === undefined) {
    throw new Error(`No Slide at address "${arrival.to}"`);
  }

  const auto = autoLayout(slide.cells);
  const layoutSource: "auto" | "override" = slide.layout === undefined ? "auto" : "override";
  const layout =
    slide.layout !== undefined && isPossible(slide.layout, slide.cells) ? slide.layout : auto;

  const fromIndex =
    arrival.from === undefined ? -1 : deck.slides.findIndex((s) => s.id === arrival.from);
  const sequential = fromIndex !== -1 && fromIndex === index - 1;
  const enter: Enter = sequential && slide.enter === "connected" ? "connected" : "cut";

  const participate = deck.slides.map((s) => s.background === undefined);
  const { t, skipped } = travelT(index, participate);

  const names: Named[] = [];
  for (const cell of slide.cells) {
    const heading = soleHeading(cell);
    if (heading !== undefined) {
      const identity = `heading:${heading.text}`;
      names.push({ identity, name: mintName("heading", identity), class: "heading" });
      continue;
    }
    const image = soleImage(cell);
    if (image !== undefined) {
      const identity = `image:${image.src}`;
      names.push({ identity, name: mintName("figure", identity), class: "figure" });
    }
  }

  return {
    slide,
    layout,
    layoutAuto: auto,
    layoutSource,
    enter,
    t,
    stop: skipped ? "skipped" : "consumed",
    speech: slide.speech,
    upNext: deck.slides[index + 1],
    names,
  };
}

export function matchCode(_from: CodeBlock, _to: CodeBlock): CodeMatch {
  throw new Error("not implemented");
}
