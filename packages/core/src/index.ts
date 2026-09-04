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

function hasImage(cell: Cell): boolean {
  return cell.blocks.some((block) => block.kind === "image");
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

function groupParagraphs(lines: readonly string[]): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

function parseBody(bodyLines: readonly string[]): { cells: Cell[]; speech: Speech } {
  const cells: Cell[] = [];
  const speechBlocks: SpeechBlock[] = [];
  for (const paragraph of groupParagraphs(bodyLines)) {
    const first = paragraph[0] ?? "";
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
    } else {
      const text2 = paragraph.join(" ").trim();
      if (text2 !== "") {
        speechBlocks.push({ kind: "paragraph", html: `<p>${escapeHtml(text2)}</p>` });
      }
    }
  }
  return { cells, speech: { blocks: speechBlocks } };
}

function buildSlide(
  source: SlideSource,
  id: string,
  isFirst: boolean,
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
  const { cells, speech } = parseBody(source.bodyLines);
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
    buildSlide(source, String(i + 1), i === 0, diagnostics),
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
      names.push({ identity: `heading:${heading.text}`, name: heading.text, class: "heading" });
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
