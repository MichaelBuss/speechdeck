/**
 * LOCKED — winner of the API sketchbook (shape A, Snapshot).
 * This is the TypeScript the spec is made of. Throwaway scaffolding
 * around it lives in model.ts / shapes / main.ts.
 *
 * Packages: @speechdeck/core, @speechdeck/solid, @speechdeck/vite,
 * @speechdeck/create, @speechdeck/themes.
 *
 * @speechdeck/solid is authored `import * as Solid from "solid-js"` in `.ts` only.
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

export type Named = {
  identity: string;
  name: string;
  class: "heading" | "code" | "figure";
};

export type Frame = {
  slide: Slide;
  layout: LayoutName;
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

export declare function parseDeck(markdown: string, files: FileMap): Deck;
export declare function resolveFrame(deck: Deck, arrival: Arrival): Frame;
export declare function matchCode(from: CodeBlock, to: CodeBlock): CodeMatch;

export declare function speechdeck(options?: { deck?: string }): unknown;
