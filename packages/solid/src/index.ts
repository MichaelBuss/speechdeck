import {
  resolveFrame,
  type Appearance,
  type Cell,
  type Deck,
  type Frame,
  type Slide as SlideDoc,
  type Speech as SpeechDoc,
  type ThemeTokens,
  type Viewport,
} from "@speechdeck/core";
import type * as Solid from "solid-js";

type ParentProps<P = Record<string, never>> = P & {
  children?: Solid.JSX.Element;
};

export function DeckProvider(_props: ParentProps<{ deck: Deck }>): Solid.JSX.Element {
  throw new Error("not implemented");
}

function currentAddress(): string {
  if (typeof window === "undefined") return "1";
  const path = window.location.pathname.replace(/^\/+/, "");
  return path === "" ? "1" : path;
}

function mixStops(stops: readonly string[], t: number): string {
  const first = stops[0];
  if (first === undefined) return "transparent";
  if (stops.length === 1) return first;
  const clamped = Math.min(1, Math.max(0, t));
  const x = clamped * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const a = stops[i] ?? first;
  const b = stops[i + 1] ?? a;
  const f = x - i;
  if (f <= 0) return a;
  if (f >= 1) return b;
  return `color-mix(in oklab, ${a} ${((1 - f) * 100).toFixed(2)}%, ${b})`;
}

function paintSlide(el: HTMLElement, tokens: ThemeTokens, appearance: Appearance, t: number): void {
  el.style.setProperty("color-scheme", appearance === "auto" ? "light dark" : appearance);
  el.style.setProperty("--sd-t", String(t));
  el.style.setProperty(
    "--sd-bg",
    tokens.stops !== undefined ? mixStops(tokens.stops, t) : "transparent",
  );
  el.style.setProperty("--sd-fg", `light-dark(${tokens.light.fg}, ${tokens.dark.fg})`);
  el.style.setProperty("--sd-title", `light-dark(${tokens.light.title}, ${tokens.dark.title})`);
  el.style.setProperty("--sd-muted", `light-dark(${tokens.light.muted}, ${tokens.dark.muted})`);
  el.style.setProperty("--sd-chrome", `light-dark(${tokens.light.chrome}, ${tokens.dark.chrome})`);
  el.style.setProperty("--sd-accent-1", tokens.accents[0]);
  el.style.setProperty("--sd-accent-2", tokens.accents[1]);
  el.style.setProperty("--sd-accent-3", tokens.accents[2]);
  el.style.setProperty("--sd-accent-4", tokens.accents[3]);
  el.style.setProperty("--sd-font-title", tokens.fonts.title);
  el.style.setProperty("--sd-font-body", tokens.fonts.body);
  el.style.setProperty("--sd-font-mono", tokens.fonts.mono);
}

function watchHeadingAlign(heading: HTMLElement): void {
  const measure = (): void => {
    heading.removeAttribute("data-align");
    const lineHeight = parseFloat(getComputedStyle(heading).lineHeight);
    const lines = lineHeight > 0 ? heading.getBoundingClientRect().height / lineHeight : 1;
    heading.dataset["align"] = lines > 1.35 ? "start" : "center";
  };
  measure();
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(measure).observe(heading);
  }
}

function renderCell(cell: Cell): HTMLElement {
  const cellEl = document.createElement("div");
  cellEl.className = "cell";
  const block = cell.blocks[0];
  if (cell.blocks.length === 1 && block?.kind === "heading") {
    cellEl.dataset["kind"] = "heading";
    const heading = document.createElement(`h${block.depth}`);
    heading.innerHTML = block.html;
    cellEl.appendChild(heading);
    watchHeadingAlign(heading);
  }
  return cellEl;
}

function renderFrame(frame: Frame, tokens: ThemeTokens, appearance: Appearance): HTMLElement {
  const slideEl = document.createElement("div");
  slideEl.className = "slide";
  slideEl.dataset["layout"] = frame.layout;
  paintSlide(slideEl, tokens, appearance, frame.t);

  const cellsEl = document.createElement("div");
  cellsEl.className = "cells";
  cellsEl.dataset["layout"] = frame.layout;
  cellsEl.dataset["items"] = String(frame.slide.cells.length);
  for (const cell of frame.slide.cells) {
    cellsEl.appendChild(renderCell(cell));
  }
  slideEl.appendChild(cellsEl);
  return slideEl;
}

export function Present(props: { deck: Deck }): Solid.JSX.Element {
  const frame = resolveFrame(props.deck, { to: currentAddress() });
  const el = renderFrame(frame, props.deck.tokens, props.deck.appearance);
  return el as unknown as Solid.JSX.Element;
}

export function Rehearse(_props: { deck: Deck }): Solid.JSX.Element {
  throw new Error("not implemented");
}

export function Inspect(_props: { deck: Deck }): Solid.JSX.Element {
  throw new Error("not implemented");
}

export function useDeck(): Solid.Accessor<Deck> {
  throw new Error("not implemented");
}

export function useSlide(): Solid.Accessor<SlideDoc> {
  throw new Error("not implemented");
}

export function useSpeech(): Solid.Accessor<SpeechDoc> {
  throw new Error("not implemented");
}

export function useUpNext(): Solid.Accessor<SlideDoc | undefined> {
  throw new Error("not implemented");
}

export function useElapsed(): {
  ms: Solid.Accessor<number>;
  reset: () => void;
} {
  throw new Error("not implemented");
}

export function useAudienceViewport(): Solid.Accessor<Viewport> {
  throw new Error("not implemented");
}

export function Slide(_props: {
  mode?: "live" | "preview";
  viewport?: Viewport;
}): Solid.JSX.Element {
  throw new Error("not implemented");
}

export function Speech(): Solid.JSX.Element {
  throw new Error("not implemented");
}

export function UpNext(): Solid.JSX.Element {
  throw new Error("not implemented");
}

export function Elapsed(): Solid.JSX.Element {
  throw new Error("not implemented");
}
