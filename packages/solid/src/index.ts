import {
  resolveFrame,
  type Appearance,
  type Arrival,
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

type DeckContextValue = { deck: Deck };
let deckContext: DeckContextValue | undefined;

function requireDeckCtx(name: string): DeckContextValue {
  if (deckContext === undefined) throw new Error(`${name} must be called under DeckProvider`);
  return deckContext;
}

export function DeckProvider(props: ParentProps<{ deck: Deck }>): Solid.JSX.Element {
  deckContext = { deck: props.deck };
  return (props.children ?? null) as Solid.JSX.Element;
}

function currentAddress(): string {
  if (typeof window === "undefined") return "1";
  const path = window.location.pathname.replace(/^\/+/, "");
  return path === "" ? "1" : path;
}

function neighbourAddress(deck: Deck, current: string, delta: 1 | -1): string | undefined {
  const index = deck.slides.findIndex((s) => s.id === current);
  return deck.slides[index + delta]?.id;
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
  // A live Embed guest is future scope (no mount hook exists yet); this placeholder is
  // rendered identically in Slide's live and preview modes, so a preview can never
  // become live by accident once mounting ships.
  if (cell.blocks.length === 1 && block?.kind === "embed") {
    cellEl.dataset["kind"] = "embed";
    const embed = document.createElement("div");
    embed.className = "embed";
    embed.dataset["specifier"] = block.specifier;
    embed.textContent = block.fallback ?? "Embed";
    cellEl.appendChild(embed);
  }
  if (cell.blocks.length === 1 && (block?.kind === "prose" || block?.kind === "table")) {
    cellEl.dataset["kind"] = block.kind;
    cellEl.innerHTML = block.html;
  }
  return cellEl;
}

function slideLabel(slide: SlideDoc): string {
  for (const cell of slide.cells) {
    const block = cell.blocks[0];
    if (cell.blocks.length === 1 && block?.kind === "heading") return block.text;
  }
  return `Slide ${slide.id}`;
}

function buildCellsEl(frame: Frame): HTMLElement {
  const cellsEl = document.createElement("div");
  cellsEl.className = "cells";
  cellsEl.dataset["layout"] = frame.layout;
  cellsEl.dataset["items"] = String(frame.slide.cells.length);
  for (const cell of frame.slide.cells) {
    cellsEl.appendChild(renderCell(cell));
  }
  return cellsEl;
}

/** Chrome + Cells only — no document.title side effect, so previews never clobber it. */
function applyFrameChrome(
  slideEl: HTMLElement,
  frame: Frame,
  tokens: ThemeTokens,
  appearance: Appearance,
): void {
  slideEl.dataset["layout"] = frame.layout;
  slideEl.dataset["enter"] = frame.enter;
  slideEl.setAttribute("aria-label", slideLabel(frame.slide));
  paintSlide(slideEl, tokens, appearance, frame.t);
  slideEl.replaceChildren(buildCellsEl(frame));
}

function paintFrame(
  slideEl: HTMLElement,
  frame: Frame,
  tokens: ThemeTokens,
  appearance: Appearance,
): void {
  applyFrameChrome(slideEl, frame, tokens, appearance);
  if (typeof document !== "undefined") {
    document.title = `${frame.slide.id} · ${slideLabel(frame.slide)}`;
  }
}

function renderFrame(frame: Frame, tokens: ThemeTokens, appearance: Appearance): HTMLElement {
  const slideEl = document.createElement("main");
  slideEl.className = "slide";
  paintFrame(slideEl, frame, tokens, appearance);
  return slideEl;
}

const PRESENTER_VIEW_CHANNEL = "speechdeck-presenter-view";
const DEFAULT_AUDIENCE_VIEWPORT: Viewport = { width: 1280, height: 720 };
/** window.open's target name for the popup Present opens; also how a Present instance
 *  recognizes itself as that popup (this window's `name`) rather than the speaker's own. */
const AUDIENCE_WINDOW_NAME = "speechdeck-audience";

type FrameContextValue = {
  frame: () => Frame;
  audienceViewport: () => Viewport;
  elapsedMs: () => number;
  resetElapsed: () => void;
  onChange: (fn: () => void) => () => void;
  addDisposer: (fn: () => void) => void;
};
let frameContext: FrameContextValue | undefined;

function requireFrameCtx(name: string): FrameContextValue {
  if (frameContext === undefined)
    throw new Error(`${name} must be called under Rehearse or Present`);
  return frameContext;
}

function readReportedViewport(data: unknown): Viewport | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  if (!("type" in data) || data.type !== "viewport") return undefined;
  if (!("width" in data) || !("height" in data)) return undefined;
  const width = (data as { width: unknown }).width;
  const height = (data as { height: unknown }).height;
  if (typeof width !== "number" || typeof height !== "number") return undefined;
  if (!(width > 0) || !(height > 0)) return undefined;
  return { width, height };
}

function readReportedSlide(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  if (!("type" in data) || data.type !== "slide") return undefined;
  if (!("slide" in data)) return undefined;
  const slide = (data as { slide: unknown }).slide;
  return typeof slide === "string" ? slide : undefined;
}

function postSlideMessage(channel: BroadcastChannel | undefined, id: string): void {
  channel?.postMessage({ type: "slide", slide: id });
}

function postViewportMessage(channel: BroadcastChannel | undefined, viewport: Viewport): void {
  channel?.postMessage({ type: "viewport", width: viewport.width, height: viewport.height });
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m)}:${String(s).padStart(2, "0")}`;
}

/** A Slide as the audience viewport sees it, laid out at that size then scaled to fit its slot. */
function renderPreview(
  tag: string,
  getFrame: () => Frame | undefined,
  viewport: () => Viewport,
  tokens: ThemeTokens,
  appearance: Appearance,
): { el: HTMLElement; repaint: () => void } {
  const article = document.createElement("article");
  article.className = "preview";
  // Not a Slide viewport: hidden from the accessibility tree, not a second announcement of the Slide.
  article.setAttribute("aria-hidden", "true");

  const tagEl = document.createElement("span");
  tagEl.className = "preview-tag";
  tagEl.textContent = tag;

  const frameEl = document.createElement("div");
  frameEl.className = "preview-frame";

  const sizer = document.createElement("div");
  sizer.className = "preview-sizer";

  const stage = document.createElement("main");
  stage.className = "preview-stage slide";
  stage.style.position = "absolute";
  stage.style.top = "0";
  stage.style.left = "0";
  stage.style.transformOrigin = "top left";
  stage.style.pointerEvents = "none";

  sizer.appendChild(stage);
  article.appendChild(tagEl);

  function fit(vp: Viewport): void {
    const fw = frameEl.clientWidth;
    const fh = frameEl.clientHeight;
    if (fw < 1 || fh < 1 || !(vp.width > 0) || !(vp.height > 0)) return;
    const scale = Math.min(fw / vp.width, fh / vp.height);
    sizer.style.width = `${vp.width * scale}px`;
    sizer.style.height = `${vp.height * scale}px`;
    stage.style.transform = `scale(${scale})`;
  }

  function repaint(): void {
    const frame = getFrame();
    if (frame === undefined) {
      article.dataset["state"] = "end";
      const end = document.createElement("p");
      end.className = "preview-end";
      end.textContent = "End";
      frameEl.replaceChildren(end);
      return;
    }
    delete article.dataset["state"];
    const vp = viewport();
    stage.style.width = `${vp.width}px`;
    stage.style.height = `${vp.height}px`;
    applyFrameChrome(stage, frame, tokens, appearance);
    frameEl.replaceChildren(sizer);
    fit(vp);
  }

  repaint();
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => repaint()).observe(frameEl);
  }
  article.appendChild(frameEl);

  return { el: article, repaint };
}

type PresenterSessionOptions = {
  className: string;
  composition: string;
  /** Present: leads/follows the audience window over BroadcastChannel and can open it.
   *  Rehearse: solo — it only reads a viewport already being reported, it does not lead. */
  lead: boolean;
};

/**
 * Speech (dominant) + a Now/Up-next preview rail + Elapsed, shared by Rehearse (one window)
 * and Present's speaker-facing side (which additionally leads/follows the audience window).
 */
function mountPresenterSession(
  deck: Deck,
  options: PresenterSessionOptions,
): { root: HTMLElement; dispose: () => void } {
  DeckProvider({ deck });

  let current = currentAddress();
  let frame = resolveFrame(deck, { to: current });
  let origin = Date.now();
  let viewport: Viewport = DEFAULT_AUDIENCE_VIEWPORT;
  const listeners = new Set<() => void>();
  const disposers: Array<() => void> = [];

  function notify(): void {
    for (const fn of listeners) fn();
  }

  const ctx: FrameContextValue = {
    frame: () => frame,
    audienceViewport: () => viewport,
    elapsedMs: () => Date.now() - origin,
    resetElapsed: () => {
      origin = Date.now();
    },
    onChange: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    addDisposer: (fn) => disposers.push(fn),
  };
  frameContext = ctx;

  function arrive(to: string): void {
    frame = resolveFrame(deck, { to, from: current });
    current = to;
    notify();
  }

  /** A local Arrival — this window is the one leading, so the audience window is told. */
  function go(to: string): void {
    if (to === current) return;
    window.history.pushState(null, "", `/${to}`);
    arrive(to);
    if (options.lead) postSlideMessage(channel, to);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const target = neighbourAddress(deck, current, event.key === "ArrowRight" ? 1 : -1);
    if (target === undefined) return;
    event.preventDefault();
    go(target);
  }

  function onPopstate(): void {
    const to = currentAddress();
    arrive(to);
    if (options.lead) postSlideMessage(channel, to);
  }

  let channel: BroadcastChannel | undefined;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(PRESENTER_VIEW_CHANNEL);
    channel.addEventListener("message", (event: MessageEvent<unknown>) => {
      const reportedViewport = readReportedViewport(event.data);
      if (reportedViewport !== undefined) {
        if (
          reportedViewport.width === viewport.width &&
          reportedViewport.height === viewport.height
        ) {
          return;
        }
        viewport = reportedViewport;
        notify();
        return;
      }
      if (!options.lead) return;
      const slideId = readReportedSlide(event.data);
      if (slideId === undefined || slideId === current) return;
      if (!deck.slides.some((s) => s.id === slideId)) return;
      // The audience window led; follow without echoing it back.
      window.history.pushState(null, "", `/${slideId}`);
      arrive(slideId);
    });
  }

  function openAudience(): void {
    window.open(window.location.href, AUDIENCE_WINDOW_NAME);
  }

  window.addEventListener("keydown", onKeydown);
  window.addEventListener("popstate", onPopstate);
  const dispose = () => {
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("popstate", onPopstate);
    channel?.close();
    for (const fn of disposers) fn();
    listeners.clear();
    frameContext = undefined;
  };

  const root = document.createElement("div");
  root.className = options.className;
  root.dataset["composition"] = options.composition;
  root.style.setProperty("container-type", "inline-size");
  root.style.setProperty("container-name", "presenter");

  const speechEl = Speech() as unknown as HTMLElement;

  const rail = document.createElement("aside");
  rail.className = "rail";
  const clockEl = Elapsed() as unknown as HTMLElement;
  const nowEl = Slide({ mode: "preview" }) as unknown as HTMLElement;
  const nextEl = UpNext() as unknown as HTMLElement;
  if (options.lead) {
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "open-audience";
    openBtn.textContent = "Open audience window";
    openBtn.addEventListener("click", () => openAudience());
    rail.append(openBtn, clockEl, nowEl, nextEl);
  } else {
    rail.append(clockEl, nowEl, nextEl);
  }

  root.append(speechEl, rail);

  return { root, dispose };
}

let disposeRehearse: (() => void) | undefined;

export function Rehearse(props: { deck: Deck }): Solid.JSX.Element {
  disposeRehearse?.();
  const { root, dispose } = mountPresenterSession(props.deck, {
    className: "rehearse",
    composition: "rehearse",
    lead: false,
  });
  disposeRehearse = dispose;
  return root as unknown as Solid.JSX.Element;
}

let disposePresent: (() => void) | undefined;

/**
 * The speaker's side, until a click opens the audience window (this Present, mounted in that
 * popup — recognized by `window.name`) — then it is that Slide: keyboard-operable, the URL
 * plus BroadcastChannel is the sync, and either side may lead.
 */
export function Present(props: { deck: Deck }): Solid.JSX.Element {
  disposePresent?.();

  const isAudience = typeof window !== "undefined" && window.name === AUDIENCE_WINDOW_NAME;
  if (!isAudience) {
    const { root, dispose } = mountPresenterSession(props.deck, {
      className: "present",
      composition: "present",
      lead: true,
    });
    disposePresent = dispose;
    return root as unknown as Solid.JSX.Element;
  }

  let current = currentAddress();
  const frame = resolveFrame(props.deck, { to: current });
  const el = renderFrame(frame, props.deck.tokens, props.deck.appearance);

  function arrive(to: string): void {
    const arrival: Arrival = { to, from: current };
    const next = resolveFrame(props.deck, arrival);
    paintFrame(el, next, props.deck.tokens, props.deck.appearance);
    current = to;
  }

  function go(to: string): void {
    if (to === current) return;
    window.history.pushState(null, "", `/${to}`);
    arrive(to);
    postSlideMessage(channel, to);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const target = neighbourAddress(props.deck, current, event.key === "ArrowRight" ? 1 : -1);
    if (target === undefined) return;
    event.preventDefault();
    go(target);
  }

  function onPopstate(): void {
    const to = currentAddress();
    arrive(to);
    postSlideMessage(channel, to);
  }

  function reportViewport(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (!(width > 0) || !(height > 0)) return;
    postViewportMessage(channel, { width, height });
  }

  function onResize(): void {
    reportViewport();
  }

  let channel: BroadcastChannel | undefined;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(PRESENTER_VIEW_CHANNEL);
    channel.addEventListener("message", (event: MessageEvent<unknown>) => {
      const slideId = readReportedSlide(event.data);
      if (slideId === undefined || slideId === current) return;
      if (!props.deck.slides.some((s) => s.id === slideId)) return;
      // The speaker's window led; follow without echoing it back.
      window.history.pushState(null, "", `/${slideId}`);
      arrive(slideId);
    });
  }

  window.addEventListener("keydown", onKeydown);
  window.addEventListener("popstate", onPopstate);
  window.addEventListener("resize", onResize);
  disposePresent = () => {
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("popstate", onPopstate);
    window.removeEventListener("resize", onResize);
    channel?.close();
  };

  reportViewport();

  return el as unknown as Solid.JSX.Element;
}

export function Inspect(_props: { deck: Deck }): Solid.JSX.Element {
  throw new Error("not implemented");
}

export function useDeck(): Solid.Accessor<Deck> {
  const ctx = requireDeckCtx("useDeck");
  return () => ctx.deck;
}

export function useSlide(): Solid.Accessor<SlideDoc> {
  const ctx = requireFrameCtx("useSlide");
  return () => ctx.frame().slide;
}

export function useSpeech(): Solid.Accessor<SpeechDoc> {
  const ctx = requireFrameCtx("useSpeech");
  return () => ctx.frame().speech;
}

export function useUpNext(): Solid.Accessor<SlideDoc | undefined> {
  const ctx = requireFrameCtx("useUpNext");
  return () => ctx.frame().upNext;
}

export function useElapsed(): {
  ms: Solid.Accessor<number>;
  reset: () => void;
} {
  const ctx = requireFrameCtx("useElapsed");
  return { ms: () => ctx.elapsedMs(), reset: () => ctx.resetElapsed() };
}

export function useAudienceViewport(): Solid.Accessor<Viewport> {
  const ctx = requireFrameCtx("useAudienceViewport");
  return () => ctx.audienceViewport();
}

export function Slide(props: {
  mode?: "live" | "preview";
  viewport?: Viewport;
}): Solid.JSX.Element {
  const deck = requireDeckCtx("Slide").deck;
  const ctx = requireFrameCtx("Slide");
  const mode = props.mode ?? "live";

  if (mode === "live") {
    const el = renderFrame(ctx.frame(), deck.tokens, deck.appearance);
    el.style.width = "100%";
    el.style.height = "100%";
    ctx.addDisposer(ctx.onChange(() => paintFrame(el, ctx.frame(), deck.tokens, deck.appearance)));
    return el as unknown as Solid.JSX.Element;
  }

  const viewportOf = () => props.viewport ?? ctx.audienceViewport();
  const { el, repaint } = renderPreview(
    "Now",
    () => ctx.frame(),
    viewportOf,
    deck.tokens,
    deck.appearance,
  );
  ctx.addDisposer(ctx.onChange(repaint));
  return el as unknown as Solid.JSX.Element;
}

export function Speech(): Solid.JSX.Element {
  const ctx = requireFrameCtx("Speech");
  // Presenter view's main: the primary content of this window, distinct from the audience's.
  const section = document.createElement("main");
  section.className = "speech";
  section.setAttribute("aria-label", "Speech");
  section.style.overflowY = "auto";
  section.style.minHeight = "0";

  function repaint(): void {
    section.innerHTML = ctx
      .frame()
      .speech.blocks.map((block) => block.html)
      .join("");
  }

  repaint();
  ctx.addDisposer(ctx.onChange(repaint));
  return section as unknown as Solid.JSX.Element;
}

export function UpNext(): Solid.JSX.Element {
  const deck = requireDeckCtx("UpNext").deck;
  const ctx = requireFrameCtx("UpNext");

  function getFrame(): Frame | undefined {
    const upNext = ctx.frame().upNext;
    return upNext === undefined ? undefined : resolveFrame(deck, { to: upNext.id });
  }

  const { el, repaint } = renderPreview(
    "Up next",
    getFrame,
    () => ctx.audienceViewport(),
    deck.tokens,
    deck.appearance,
  );
  ctx.addDisposer(ctx.onChange(repaint));
  return el as unknown as Solid.JSX.Element;
}

export function Elapsed(): Solid.JSX.Element {
  const ctx = requireFrameCtx("Elapsed");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "clock";
  button.title = "Reset elapsed";

  function repaint(): void {
    button.textContent = formatElapsed(ctx.elapsedMs());
  }

  repaint();
  const interval = typeof window === "undefined" ? undefined : window.setInterval(repaint, 250);
  button.addEventListener("click", () => {
    ctx.resetElapsed();
    repaint();
  });
  ctx.addDisposer(() => {
    if (interval !== undefined) window.clearInterval(interval);
  });
  return button as unknown as Solid.JSX.Element;
}
