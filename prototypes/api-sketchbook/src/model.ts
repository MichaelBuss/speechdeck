/**
 * PROTOTYPE — the document model.
 * Shared by every competing shape. The fork is not "what is a Slide";
 * the glossary already answered that. The fork is who owns *now*.
 */

export type Appearance = "light" | "dark" | "auto";
export type Motion = "auto" | "always";
export type Enter = "cut" | "connected";
export type LayoutName =
  | "cover"
  | "section"
  | "solo"
  | "split-2"
  | "split-3"
  | "grid"
  | "caption";
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
  /** Absent when the Theme is still. */
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

/**
 * One or more adjacent audience-visible blocks with no blank line between them.
 * A heading sitting on a fence is one Cell, not two.
 */
export type Cell = {
  blocks: readonly Block[];
};

export type Block =
  | HeadingBlock
  | CodeBlock
  | ImageBlock
  | EmbedBlock
  | TableBlock
  | ProseBlock;

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

/**
 * One paint. Layout, travel, resolved enter, and identity names are decided.
 * Authors never write the names; the adapter stamps them onto the DOM.
 */
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

/**
 * The author's embed module default-exports this.
 * `El` is HTMLElement in a browser adapter; core does not import the DOM.
 */
export type EmbedGuest<El = unknown> = (
  el: El,
  props: Json,
) => {
  dispose: () => void;
  ready: Promise<void>;
};

export const SAMPLE_DECK: Deck = {
  theme: "@speechdeck/themes/harbour",
  tokens: {
    specifier: "@speechdeck/themes/harbour",
    fonts: {
      title: "Newsreader",
      body: "Inter",
      mono: "Iosevka",
    },
    accents: ["#f2c14e", "#e07a5f", "#81b29a", "#9b8c7a"],
    dark: { fg: "#f4f1ea", title: "#fff", muted: "#9a9488", chrome: "#1a1a1a" },
    light: { fg: "#1a1a1a", title: "#0b0b0b", muted: "#5c574f", chrome: "#f4f1ea" },
    stops: ["oklch(0.22 0.04 250)", "oklch(0.28 0.08 20)", "oklch(0.24 0.06 150)"],
  },
  appearance: "dark",
  motion: "auto",
  slides: [
    {
      id: "1",
      enter: "cut",
      speech: { blocks: [{ kind: "paragraph", html: "Welcome. The talk is the API." }] },
      cells: [
        {
          blocks: [
            {
              kind: "heading",
              depth: 1,
              text: "APIs without implementation anxiety",
              html: "APIs without implementation anxiety",
            },
          ],
        },
      ],
    },
    {
      id: "2",
      enter: "connected",
      speech: { blocks: [{ kind: "paragraph", html: "The parse result is TypeScript. The talk is Markdown." }] },
      cells: [
        {
          blocks: [
            { kind: "heading", depth: 3, text: "createDeck", html: "createDeck" },
            {
              kind: "code",
              lang: "ts",
              source: { from: "file", path: "./demos/counter.ts", bytes: "export function createDeck() {}" },
              html: "<span>export function createDeck() {}</span>",
            },
          ],
        },
      ],
    },
    {
      id: "3",
      enter: "connected",
      speech: { blocks: [{ kind: "paragraph", html: "Same bytes as the fence. The Embed runs the file." }] },
      cells: [
        {
          blocks: [
            { kind: "heading", depth: 3, text: "The seam", html: "The seam" },
            {
              kind: "code",
              lang: "ts",
              source: { from: "file", path: "./demos/counter.ts", bytes: "export function createDeck() {}" },
              html: "<span>export function createDeck() {}</span>",
            },
          ],
        },
        {
          blocks: [
            {
              kind: "embed",
              specifier: "./demos/counter.ts",
              props: {},
              fallback: "Counter",
            },
          ],
        },
      ],
    },
    {
      id: "4",
      enter: "connected",
      speech: { blocks: [{ kind: "paragraph", html: "A skip lands here. Connected does not follow." }] },
      cells: [
        {
          blocks: [
            {
              kind: "heading",
              depth: 2,
              text: "The resolver is the API",
              html: "The resolver is the API",
            },
          ],
        },
      ],
    },
  ],
};

export function slideById(deck: Deck, id: string): Slide {
  const found = deck.slides.find((s) => s.id === id);
  if (found === undefined) throw new Error(`unknown slide: ${id}`);
  return found;
}

export function indexOf(deck: Deck, id: string): number {
  const i = deck.slides.findIndex((s) => s.id === id);
  if (i < 0) throw new Error(`unknown slide: ${id}`);
  return i;
}

export function nextId(deck: Deck, id: string): string | undefined {
  const i = indexOf(deck, id);
  return deck.slides[i + 1]?.id;
}

export function prevId(deck: Deck, id: string): string | undefined {
  const i = indexOf(deck, id);
  if (i === 0) return undefined;
  return deck.slides[i - 1]?.id;
}

function firstHeading(cell: Cell): 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  for (const b of cell.blocks) {
    if (b.kind === "heading") return b.depth;
  }
  return undefined;
}

function hasKind(cell: Cell, kind: Block["kind"]): boolean {
  return cell.blocks.some((b) => b.kind === kind);
}

function isHeadingOnly(cell: Cell): boolean {
  return cell.blocks.every((b) => b.kind === "heading");
}

function isCaption(cells: readonly Cell[]): boolean {
  if (cells.length !== 2) return false;
  const a = cells[0];
  const b = cells[1];
  if (a === undefined || b === undefined) return false;
  const h4Image = (x: Cell, y: Cell) =>
    firstHeading(x) === 4 && !hasKind(x, "image") && hasKind(y, "image");
  return h4Image(a, b) || h4Image(b, a);
}

function autoLayout(cells: readonly Cell[]): LayoutName {
  const n = cells.length;
  if (n === 1) {
    const cell = cells[0];
    if (cell === undefined) return "solo";
    if (firstHeading(cell) === 1 && isHeadingOnly(cell)) return "cover";
    const depth = firstHeading(cell);
    if (depth !== undefined && depth >= 2 && isHeadingOnly(cell)) return "section";
    return "solo";
  }
  if (n === 2) return isCaption(cells) ? "caption" : "split-2";
  if (n === 3) return "split-3";
  if (n >= 4) return "grid";
  return "solo";
}

function isPossible(layout: LayoutName, cells: readonly Cell[]): boolean {
  const n = cells.length;
  switch (layout) {
    case "cover":
    case "section":
    case "solo":
      return n === 1;
    case "split-2":
      return n === 2;
    case "split-3":
      return n === 3;
    case "grid":
      return n >= 4;
    case "caption":
      return isCaption(cells);
  }
}

/**
 * INTERNAL. Renderers ask resolveFrame; they do not import this.
 */
export function pickLayout(slide: Slide): {
  layout: LayoutName;
  layoutAuto: LayoutName;
  layoutSource: "auto" | "override";
} {
  const auto = autoLayout(slide.cells);
  const override = slide.layout;
  if (override === undefined) return { layout: auto, layoutAuto: auto, layoutSource: "auto" };
  if (!isPossible(override, slide.cells)) {
    return { layout: auto, layoutAuto: auto, layoutSource: "auto" };
  }
  return { layout: override, layoutAuto: auto, layoutSource: "override" };
}

function adjacent(deck: Deck, from: string, to: string): boolean {
  return nextId(deck, from) === to || prevId(deck, from) === to;
}

/**
 * INTERNAL. The Solid adapter calls this; authors do not.
 * `from` omitted, or a skip, folds to a hard cut even if the Slide said connected.
 */
export function resolveFrame(deck: Deck, arrival: Arrival): Frame {
  const slide = slideById(deck, arrival.to);
  const { layout, layoutAuto, layoutSource } = pickLayout(slide);
  const sequential =
    arrival.from !== undefined &&
    adjacent(deck, arrival.from, arrival.to) &&
    slide.enter === "connected";
  const enter: Enter = sequential ? "connected" : "cut";
  const i = indexOf(deck, arrival.to);
  const skipped = slide.background !== undefined;
  return {
    slide,
    layout,
    layoutAuto,
    layoutSource,
    enter,
    t: deck.slides.length <= 1 ? 0 : i / (deck.slides.length - 1),
    stop: skipped ? "skipped" : "consumed",
    speech: slide.speech,
    upNext: deck.slides[i + 1],
    names: [],
  };
}

export function matchCode(from: CodeBlock, to: CodeBlock): CodeMatch {
  const a = from.source.from === "file" ? from.source.path : from.source.bytes;
  const b = to.source.from === "file" ? to.source.path : to.source.bytes;
  return {
    key: `${from.lang}:${a}->${to.lang}:${b}`,
    pairing: from.lang === to.lang ? "morph" : "none",
  };
}

export function parseDeck(_markdown: string, _files: FileMap): Deck {
  return SAMPLE_DECK;
}

export function firstCode(slide: Slide): CodeBlock | undefined {
  for (const cell of slide.cells) {
    for (const block of cell.blocks) {
      if (block.kind === "code") return block;
    }
  }
  return undefined;
}

export function firstEmbed(slide: Slide): EmbedBlock | undefined {
  for (const cell of slide.cells) {
    for (const block of cell.blocks) {
      if (block.kind === "embed") return block;
    }
  }
  return undefined;
}
