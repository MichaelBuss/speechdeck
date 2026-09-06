import {
  matchCode,
  resolveFrame,
  type Appearance,
  type Arrival,
  type Cell,
  type CodeBlock,
  type Deck,
  type EmbedBlock,
  type EmbedGuest,
  type Frame,
  type Image,
  type Motion,
  type Named,
  type Slide as SlideDoc,
  type Speech as SpeechDoc,
  type ThemeTokens,
  type Viewport,
} from "@speechdeck/core";
import type * as Solid from "solid-js";

type ParentProps<P = Record<string, never>> = P & {
  children?: Solid.JSX.Element;
};

export type LoadEmbed = (specifier: string) => Promise<EmbedGuest<HTMLElement>>;

/** Zero framework adapters: a bare native dynamic import, no bundler-specific resolution
 *  shim in the framework. A specifier that is not import-resolvable is the app's problem
 *  to fix (relative to the Deck, or a dependency it already has), not this hook's. */
const defaultLoadEmbed: LoadEmbed = async (specifier) => {
  const mod = (await import(/* @vite-ignore */ specifier)) as {
    default?: EmbedGuest<HTMLElement>;
  };
  if (typeof mod.default !== "function") {
    throw new Error(`Embed "${specifier}" has no default export guest.`);
  }
  return mod.default;
};

type DeckContextValue = { deck: Deck; loadEmbed: LoadEmbed };
let deckContext: DeckContextValue | undefined;

function requireDeckCtx(name: string): DeckContextValue {
  if (deckContext === undefined) throw new Error(`${name} must be called under DeckProvider`);
  return deckContext;
}

export function DeckProvider(
  props: ParentProps<{ deck: Deck; loadEmbed?: LoadEmbed }>,
): Solid.JSX.Element {
  deckContext = { deck: props.deck, loadEmbed: props.loadEmbed ?? defaultLoadEmbed };
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

function renderImage(image: Image): HTMLImageElement {
  const img = document.createElement("img");
  img.src = image.src;
  img.alt = image.alt;
  img.dataset["fit"] = image.fit;
  img.dataset["focus"] = image.focus;
  if (image.looks.length > 0) img.dataset["look"] = image.looks.join(" ");
  return img;
}

/** The Background is not a Cell: painted as a full-bleed backdrop behind `.cells`,
 *  never counted toward layout pick or reflow. */
function renderBackdrop(image: Image): HTMLElement {
  const backdrop = document.createElement("div");
  backdrop.className = "backdrop";
  backdrop.style.backgroundImage = `url("${image.src}")`;
  backdrop.dataset["fit"] = image.fit;
  backdrop.dataset["focus"] = image.focus;
  if (image.looks.length > 0) backdrop.dataset["look"] = image.looks.join(" ");
  return backdrop;
}

const EMBED_DISPOSE = Symbol("sd-embed-dispose");
type EmbedHost = HTMLElement & { [EMBED_DISPOSE]?: () => void };

/** The framework owns exactly one element per Embed and never reparents it: `host` is
 *  created once by renderCell and handed to the guest; only dispose() ever touches it
 *  again, and only to tear the guest down before the host itself is discarded. */
function mountEmbedLive(host: HTMLElement, block: EmbedBlock, loadEmbed: LoadEmbed): void {
  host.dataset["live"] = "true";
  let torn = false;
  let disposeGuest: (() => void) | undefined;
  (host as EmbedHost)[EMBED_DISPOSE] = () => {
    torn = true;
    disposeGuest?.();
  };
  loadEmbed(block.specifier)
    .then((mount) => {
      if (torn) return;
      const guest = mount(host, block.props);
      disposeGuest = guest.dispose;
      void guest.ready;
    })
    .catch(() => {
      // A guest that fails to load leaves the host empty rather than failing the Slide.
    });
}

/** Called before a live `.slide` discards its Cells (on repaint or teardown) so a running
 *  guest is disposed rather than orphaned. Preview hosts never carry a dispose, so this
 *  is a no-op for `.embed` elements rendered inert. */
function disposeEmbedsWithin(root: HTMLElement): void {
  for (const host of root.querySelectorAll<HTMLElement>(".embed[data-live]")) {
    const embedHost = host as EmbedHost;
    embedHost[EMBED_DISPOSE]?.();
    delete embedHost[EMBED_DISPOSE];
  }
}

function renderCell(cell: Cell, mode: "live" | "preview", loadEmbed: LoadEmbed): HTMLElement {
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
  if (cell.blocks.length === 1 && block?.kind === "image") {
    cellEl.dataset["kind"] = "image";
    cellEl.appendChild(renderImage(block));
  }
  if (cell.blocks.length === 1 && block?.kind === "embed") {
    cellEl.dataset["kind"] = "embed";
    const embed = document.createElement("div");
    embed.className = "embed";
    embed.dataset["specifier"] = block.specifier;
    // A preview is never a live mount — running the guest there would run it twice.
    if (mode === "live") mountEmbedLive(embed, block, loadEmbed);
    else embed.textContent = block.fallback ?? "Embed";
    cellEl.appendChild(embed);
  }
  if (cell.blocks.length === 1 && (block?.kind === "prose" || block?.kind === "table")) {
    cellEl.dataset["kind"] = block.kind;
    cellEl.innerHTML = block.html;
  }
  if (cell.blocks.length === 1 && block?.kind === "code") {
    cellEl.dataset["kind"] = "code";
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

/** Caption pairs an H4 Cell with an image Cell in either source order; data-caption-order
 *  fixes media-then-text visually via CSS `order`, independent of which came first. */
function buildCellsEl(frame: Frame, mode: "live" | "preview", loadEmbed: LoadEmbed): HTMLElement {
  const cellsEl = document.createElement("div");
  cellsEl.className = "cells";
  cellsEl.dataset["layout"] = frame.layout;
  cellsEl.dataset["items"] = String(frame.slide.cells.length);
  for (const cell of frame.slide.cells) {
    const cellEl = renderCell(cell, mode, loadEmbed);
    if (frame.layout === "caption") {
      const block = cell.blocks[0];
      cellEl.dataset["captionOrder"] =
        cell.blocks.length === 1 && block?.kind === "image" ? "media" : "text";
    }
    cellsEl.appendChild(cellEl);
  }
  return cellsEl;
}

/** Chrome + Cells only — no document.title side effect, so previews never clobber it. */
function applyFrameChrome(
  slideEl: HTMLElement,
  frame: Frame,
  tokens: ThemeTokens,
  appearance: Appearance,
  mode: "live" | "preview",
  loadEmbed: LoadEmbed = defaultLoadEmbed,
): void {
  disposeEmbedsWithin(slideEl);
  slideEl.dataset["layout"] = frame.layout;
  slideEl.dataset["enter"] = frame.enter;
  slideEl.setAttribute("aria-label", slideLabel(frame.slide));
  paintSlide(slideEl, tokens, appearance, frame.t);
  const children: HTMLElement[] = [];
  if (frame.slide.background !== undefined) children.push(renderBackdrop(frame.slide.background));
  children.push(buildCellsEl(frame, mode, loadEmbed));
  slideEl.replaceChildren(...children);
}

function paintFrame(
  slideEl: HTMLElement,
  frame: Frame,
  tokens: ThemeTokens,
  appearance: Appearance,
  loadEmbed: LoadEmbed,
): void {
  applyFrameChrome(slideEl, frame, tokens, appearance, "live", loadEmbed);
  if (typeof document !== "undefined") {
    document.title = `${frame.slide.id} · ${slideLabel(frame.slide)}`;
  }
}

/** Escape blurs an in-document Embed and focuses the Slide (ADR 0016); `tabIndex = -1` makes
 *  that focus programmatically reachable without adding the Slide to the natural tab order. */
function focusSlideOnEscape(slideEl: HTMLElement): () => void {
  slideEl.tabIndex = -1;
  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    const active = document.activeElement;
    if (active === null || active === slideEl || !slideEl.contains(active)) return;
    (active as HTMLElement).blur();
    slideEl.focus();
  }
  document.addEventListener("keydown", onKeydown);
  return () => document.removeEventListener("keydown", onKeydown);
}

/** A mid-transition resize skips to the end state rather than animating toward a
 *  moving target; the browser has no native resize hook for this, so it is watched
 *  explicitly. Ordinary reflow (container queries) then applies on its own. */
function watchResizeSkipsTransition(slideEl: HTMLElement): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  const observer = new ResizeObserver(() => {
    document.activeViewTransition?.skipTransition();
  });
  observer.observe(slideEl);
  return () => observer.disconnect();
}

function renderFrame(
  frame: Frame,
  tokens: ThemeTokens,
  appearance: Appearance,
  loadEmbed: LoadEmbed,
): { el: HTMLElement; dispose: () => void } {
  const slideEl = document.createElement("main");
  slideEl.className = "slide";
  paintFrame(slideEl, frame, tokens, appearance, loadEmbed);
  const disposeEscape = focusSlideOnEscape(slideEl);
  const disposeResize = watchResizeSkipsTransition(slideEl);
  return {
    el: slideEl,
    dispose: () => {
      disposeEscape();
      disposeResize();
      disposeEmbedsWithin(slideEl);
    },
  };
}

/** A heading Cell or an image Cell renders as a single child under `.cell`; identity
 *  names line up with Frame.names positionally because core mints both from the same
 *  document-order walk over the Slide's Cells (ADR 0005). */
function namedTargets(slideEl: HTMLElement): HTMLElement[] {
  const targets: HTMLElement[] = [];
  for (const cellEl of slideEl.querySelectorAll<HTMLElement>(
    '.cell[data-kind="heading"], .cell[data-kind="image"]',
  )) {
    const target = cellEl.firstElementChild;
    if (target instanceof HTMLElement) targets.push(target);
  }
  return targets;
}

/** The browser pairs an outgoing and incoming element by a matching
 *  view-transition-name; since core mints that name from content identity alone, this
 *  never needs to compare `from` and `to` against each other. `view-transition-class`
 *  carries only the kind, never the name, so a Theme cannot single out one Cell. */
function applyNames(slideEl: HTMLElement, names: readonly Named[]): void {
  const targets = namedTargets(slideEl);
  names.forEach((named, i) => {
    const target = targets[i];
    if (target === undefined) return;
    target.style.setProperty("view-transition-name", named.name);
    target.style.setProperty("view-transition-class", named.class);
  });
}

/** A code Cell in Slide-cell order — unlike a heading or an image, code has no content
 *  identity to name it by, so pairing across a connected edge is positional. */
function codeCells(slide: SlideDoc): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  for (const cell of slide.cells) {
    const block = cell.blocks[0];
    if (cell.blocks.length === 1 && block?.kind === "code") blocks.push(block);
  }
  return blocks;
}

function codeCellTargets(slideEl: HTMLElement): HTMLElement[] {
  return [...slideEl.querySelectorAll<HTMLElement>('.cell[data-kind="code"]')];
}

type CodePairing = { index: number; key: string };

/** Zips each side's code Cells by index (ADR 0019/glossary: code pairs by index, not
 *  content) and asks core's matchCode to decide the pairing at each shared index. A
 *  leftover Cell past the shorter side's length is never paired, so it is never named
 *  and cannot morph. */
function pairCodeCells(from: SlideDoc, to: SlideDoc): CodePairing[] {
  const fromCode = codeCells(from);
  const toCode = codeCells(to);
  const pairings: CodePairing[] = [];
  const shared = Math.min(fromCode.length, toCode.length);
  for (let i = 0; i < shared; i++) {
    const fromBlock = fromCode[i];
    const toBlock = toCode[i];
    if (fromBlock === undefined || toBlock === undefined) continue;
    const match = matchCode(fromBlock, toBlock);
    if (match.pairing === "morph") pairings.push({ index: i, key: match.key });
  }
  return pairings;
}

/** Stamped on both the outgoing and the incoming DOM from the one `pairCodeCells` call
 *  made for this transition — unlike `applyNames`, the same key has to reach both sides,
 *  since a code Cell's key is minted from the pair, not independently per Frame. */
function applyCodePairings(slideEl: HTMLElement, pairings: readonly CodePairing[]): void {
  const targets = codeCellTargets(slideEl);
  for (const pairing of pairings) {
    const target = targets[pairing.index];
    if (target === undefined) continue;
    target.style.setProperty("view-transition-name", pairing.key);
    target.style.setProperty("view-transition-class", "code");
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** `always` still runs connected motion regardless of the environment; `auto` (default)
 *  honours prefers-reduced-motion. A hard cut never runs it either way. */
function shouldRunConnectedMotion(frame: Frame, motion: Motion): boolean {
  if (frame.enter !== "connected") return false;
  return motion === "always" || !prefersReducedMotion();
}

/** Repaints a live Slide for an Arrival. A hard cut (or no View Transition support, or
 *  reduced motion under `auto`) repaints directly and skips any transition still in
 *  flight so it cannot keep animating over content that already hard-cut. A connected
 *  edge wraps the repaint in a same-document View Transition; starting a new one while
 *  one is in flight skips the previous one to its end state natively — a mashed arrow
 *  always wins, with no interruption policy to configure. */
function repaintFrame(
  slideEl: HTMLElement,
  from: Frame,
  to: Frame,
  tokens: ThemeTokens,
  appearance: Appearance,
  motion: Motion,
  loadEmbed: LoadEmbed,
): void {
  if (
    from.slide.id === to.slide.id ||
    !shouldRunConnectedMotion(to, motion) ||
    typeof document.startViewTransition !== "function"
  ) {
    document.activeViewTransition?.skipTransition();
    paintFrame(slideEl, to, tokens, appearance, loadEmbed);
    return;
  }
  applyNames(slideEl, from.names);
  const codePairings = pairCodeCells(from.slide, to.slide);
  applyCodePairings(slideEl, codePairings);
  document.startViewTransition(() => {
    paintFrame(slideEl, to, tokens, appearance, loadEmbed);
    applyNames(slideEl, to.names);
    applyCodePairings(slideEl, codePairings);
  });
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
  onChange: (fn: (from: Frame, to: Frame) => void) => () => void;
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
    applyFrameChrome(stage, frame, tokens, appearance, "preview");
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
  loadEmbed: LoadEmbed = defaultLoadEmbed,
): { root: HTMLElement; dispose: () => void } {
  DeckProvider({ deck, loadEmbed });

  let current = currentAddress();
  let frame = resolveFrame(deck, { to: current });
  let origin = Date.now();
  let viewport: Viewport = DEFAULT_AUDIENCE_VIEWPORT;
  const listeners = new Set<(from: Frame, to: Frame) => void>();
  const disposers: Array<() => void> = [];

  function notify(from: Frame, to: Frame): void {
    for (const fn of listeners) fn(from, to);
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
    const from = frame;
    frame = resolveFrame(deck, { to, from: current });
    current = to;
    notify(from, frame);
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
        notify(frame, frame);
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

export function Rehearse(props: { deck: Deck; loadEmbed?: LoadEmbed }): Solid.JSX.Element {
  disposeRehearse?.();
  const { root, dispose } = mountPresenterSession(
    props.deck,
    {
      className: "rehearse",
      composition: "rehearse",
      lead: false,
    },
    props.loadEmbed,
  );
  disposeRehearse = dispose;
  return root as unknown as Solid.JSX.Element;
}

let disposePresent: (() => void) | undefined;

/**
 * The speaker's side, until a click opens the audience window (this Present, mounted in that
 * popup — recognized by `window.name`) — then it is that Slide: keyboard-operable, the URL
 * plus BroadcastChannel is the sync, and either side may lead.
 */
export function Present(props: { deck: Deck; loadEmbed?: LoadEmbed }): Solid.JSX.Element {
  disposePresent?.();

  const isAudience = typeof window !== "undefined" && window.name === AUDIENCE_WINDOW_NAME;
  if (!isAudience) {
    const { root, dispose } = mountPresenterSession(
      props.deck,
      {
        className: "present",
        composition: "present",
        lead: true,
      },
      props.loadEmbed,
    );
    disposePresent = dispose;
    return root as unknown as Solid.JSX.Element;
  }

  const loadEmbed = props.loadEmbed ?? defaultLoadEmbed;
  let current = currentAddress();
  const frame = resolveFrame(props.deck, { to: current });
  const { el, dispose: disposeFrame } = renderFrame(
    frame,
    props.deck.tokens,
    props.deck.appearance,
    loadEmbed,
  );

  function arrive(to: string): void {
    const from = resolveFrame(props.deck, { to: current });
    const arrival: Arrival = { to, from: current };
    const next = resolveFrame(props.deck, arrival);
    repaintFrame(
      el,
      from,
      next,
      props.deck.tokens,
      props.deck.appearance,
      props.deck.motion,
      loadEmbed,
    );
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
    disposeFrame();
  };

  reportViewport();

  return el as unknown as Solid.JSX.Element;
}

export type InspectPresetId =
  | "fill"
  | "16-9"
  | "zoom"
  | "square"
  | "phone"
  | "phone-l"
  | "freeform";

type InspectPresetSpec = { id: InspectPresetId; label: string; size?: Viewport };

/** Seven named viewports (ADR 0014). Fill has no size of its own — it is the window,
 *  never dragged. Freeform has no fixed size either — it holds whatever the author last
 *  dragged into it, or the first-ever Freeform size, 1280×720, until something is. */
const INSPECT_PRESETS: readonly InspectPresetSpec[] = [
  { id: "fill", label: "Fill" },
  { id: "16-9", label: "16:9 1280×720", size: { width: 1280, height: 720 } },
  { id: "zoom", label: "Zoom 900×700", size: { width: 900, height: 700 } },
  { id: "square", label: "Square 800×800", size: { width: 800, height: 800 } },
  { id: "phone", label: "Phone 390×844", size: { width: 390, height: 844 } },
  { id: "phone-l", label: "Phone landscape 844×390", size: { width: 844, height: 390 } },
  { id: "freeform", label: "Freeform" },
];

const INSPECT_DEFAULT_FREEFORM: Viewport = { width: 1280, height: 720 };

function isInspectPresetId(value: string | null): value is InspectPresetId {
  return INSPECT_PRESETS.some((preset) => preset.id === value);
}

function readInspectViewportFromUrl(): { preset: InspectPresetId; freeform: Viewport } {
  const params = new URLSearchParams(window.location.search);
  const presetParam = params.get("preset");
  const preset = isInspectPresetId(presetParam) ? presetParam : "fill";
  const width = Number(params.get("width"));
  const height = Number(params.get("height"));
  const hasStoredFreeform =
    Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
  return { preset, freeform: hasStoredFreeform ? { width, height } : INSPECT_DEFAULT_FREEFORM };
}

/** Only Freeform round-trips a size on the URL; a named preset's size lives in
 *  INSPECT_PRESETS, so reloading it is exact without the URL ever carrying its pixels. */
function writeInspectViewportToUrl(preset: InspectPresetId, freeform: Viewport): void {
  const params = new URLSearchParams(window.location.search);
  params.set("preset", preset);
  if (preset === "freeform") {
    params.set("width", String(Math.round(freeform.width)));
    params.set("height", String(Math.round(freeform.height)));
  } else {
    params.delete("width");
    params.delete("height");
  }
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
}

function inspectViewport(preset: InspectPresetId, freeform: Viewport): Viewport {
  if (preset === "fill") {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  if (preset === "freeform") return freeform;
  return INSPECT_PRESETS.find((p) => p.id === preset)?.size ?? INSPECT_DEFAULT_FREEFORM;
}

function elementRefuses(el: HTMLElement): boolean {
  return el.scrollWidth - el.clientWidth > 2 || el.scrollHeight - el.clientHeight > 8;
}

function spillsOutside(inner: DOMRect, outer: DOMRect): boolean {
  return (
    inner.right > outer.right + 1 ||
    inner.bottom > outer.bottom + 1 ||
    inner.left < outer.left - 1 ||
    inner.top < outer.top - 1
  );
}

/** Refuse is measured at this viewport, from the DOM the Slide actually laid out into —
 *  never derived from Cell counts, and never a reason to scale or scroll the stage. */
function measureRefuse(slideEl: HTMLElement): boolean {
  const cells = slideEl.querySelector<HTMLElement>(".cells");
  if (cells === null) return false;
  if (elementRefuses(cells)) return true;
  const outer = cells.getBoundingClientRect();
  for (const cell of cells.querySelectorAll<HTMLElement>(".cell")) {
    const cellBox = cell.getBoundingClientRect();
    if (elementRefuses(cell) || spillsOutside(cellBox, outer)) return true;
    for (const node of cell.querySelectorAll<HTMLElement>(
      "h1, h2, h3, h4, h5, h6, p, pre, .embed, img",
    )) {
      if (elementRefuses(node) || spillsOutside(node.getBoundingClientRect(), cellBox)) return true;
    }
  }
  return false;
}

let disposeInspect: (() => void) | undefined;

/**
 * The author-facing composition (ADR 0014): a Slide on a stage at a named viewport, with
 * a readout of Layout, Cells, and Refuse always on. Not Presenter view — there is no
 * Speech here. Its own Arrival is local: it never opens or joins Present's
 * BroadcastChannel, so advancing here never moves the audience Slide. Embeds are live —
 * the stage is a Slide viewport, not a preview.
 */
export function Inspect(props: { deck: Deck; loadEmbed?: LoadEmbed }): Solid.JSX.Element {
  disposeInspect?.();
  const { deck } = props;
  const loadEmbed = props.loadEmbed ?? defaultLoadEmbed;
  DeckProvider({ deck, loadEmbed });

  let current = deck.slides[0]?.id ?? "1";
  let frame = resolveFrame(deck, { to: current });
  let { preset, freeform } = readInspectViewportFromUrl();
  let slideHandle: { el: HTMLElement; dispose: () => void } | undefined;
  let dragging:
    | { pointerId: number; startX: number; startY: number; startW: number; startH: number }
    | undefined;

  const root = document.createElement("div");
  root.className = "inspect";
  root.dataset["composition"] = "inspect";

  const presetsEl = document.createElement("div");
  presetsEl.className = "inspect-presets";
  const presetButtons = new Map<InspectPresetId, HTMLButtonElement>();
  for (const spec of INSPECT_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inspect-preset";
    button.dataset["preset"] = spec.id;
    button.textContent = spec.label;
    button.addEventListener("click", () => selectPreset(spec.id));
    presetsEl.appendChild(button);
    presetButtons.set(spec.id, button);
  }

  const stageWrap = document.createElement("div");
  stageWrap.className = "inspect-stage-wrap";
  const stage = document.createElement("div");
  stage.className = "inspect-stage";
  stageWrap.appendChild(stage);

  const handle = document.createElement("div");
  handle.className = "inspect-handle";

  const readout = document.createElement("dl");
  readout.className = "inspect-readout";
  readout.setAttribute("aria-label", "Inspect readout");

  function readoutRow(field: string, term: string): HTMLElement {
    const rowEl = document.createElement("div");
    rowEl.className = "readout-row";
    rowEl.dataset["field"] = field;
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    rowEl.append(dt, dd);
    readout.appendChild(rowEl);
    return dd;
  }

  const layoutDd = readoutRow("layout", "Layout");
  const impossibleDd = readoutRow("impossible", "Impossible override");
  const cellsDd = readoutRow("cells", "Cells");
  const stageDd = readoutRow("stage", "Stage");
  const headingDd = readoutRow("heading", "Heading align");
  const refuseDd = readoutRow("refuse", "Refuse");

  root.append(presetsEl, stageWrap, readout);

  function applyStageSize(): void {
    stage.dataset["preset"] = preset;
    handle.style.display = preset === "fill" ? "none" : "block";
    if (preset === "fill") {
      stage.style.width = "100%";
      stage.style.height = "100%";
    } else {
      const size = inspectViewport(preset, freeform);
      stage.style.width = `${size.width}px`;
      stage.style.height = `${size.height}px`;
    }
    for (const [id, button] of presetButtons) {
      button.setAttribute("aria-pressed", String(id === preset));
    }
  }

  function paintStage(): void {
    slideHandle?.dispose();
    const rendered = renderFrame(frame, deck.tokens, deck.appearance, loadEmbed);
    rendered.el.style.width = "100%";
    rendered.el.style.height = "100%";
    slideHandle = rendered;
    stage.replaceChildren(rendered.el, handle);
    applyStageSize();
  }

  /** Layout, Cells, stage size, heading align, and Refuse are always on here (ADR 0014).
   *  Travel, identity names, `enter`, Speech, and Embed readiness never appear. */
  function repaintReadout(): void {
    layoutDd.textContent =
      frame.layoutSource === "auto"
        ? `${frame.layout} (auto)`
        : `${frame.layout} (override, auto ${frame.layoutAuto})`;
    const impossible = frame.layoutSource === "override" && frame.layout !== frame.slide.layout;
    impossibleDd.textContent = impossible ? "yes — lint, auto rendered" : "no";
    cellsDd.textContent = String(frame.slide.cells.length);
    const size = inspectViewport(preset, freeform);
    stageDd.textContent = `${Math.round(size.width)}×${Math.round(size.height)}`;
    const headingEl = slideHandle?.el.querySelector<HTMLElement>(
      '.cell[data-kind="heading"] [data-align]',
    );
    headingDd.textContent = headingEl?.dataset["align"] ?? "—";
    refuseDd.textContent =
      slideHandle !== undefined && measureRefuse(slideHandle.el) ? "yes" : "no";
  }

  function repaint(): void {
    paintStage();
    repaintReadout();
  }

  function selectPreset(next: InspectPresetId): void {
    preset = next;
    writeInspectViewportToUrl(preset, freeform);
    applyStageSize();
    repaintReadout();
  }

  function arrive(to: string): void {
    frame = resolveFrame(deck, { to, from: current });
    current = to;
    repaint();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const target = neighbourAddress(deck, current, event.key === "ArrowRight" ? 1 : -1);
    if (target === undefined) return;
    event.preventDefault();
    arrive(target);
  }

  /** Dragging any named box selects Freeform and keeps that size (ADR 0014): the switch
   *  happens on the first pointermove, starting from the size the box already had, so the
   *  box never jumps before the author's drag has moved it anywhere. */
  function onPointerDown(event: PointerEvent): void {
    const size = inspectViewport(preset, freeform);
    dragging = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startW: size.width,
      startH: size.height,
    };
    handle.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent): void {
    if (dragging === undefined || dragging.pointerId !== event.pointerId) return;
    const width = Math.max(100, Math.round(dragging.startW + (event.clientX - dragging.startX)));
    const height = Math.max(100, Math.round(dragging.startH + (event.clientY - dragging.startY)));
    freeform = { width, height };
    preset = "freeform";
    applyStageSize();
    repaintReadout();
  }

  function endDrag(event: PointerEvent): void {
    if (dragging === undefined || dragging.pointerId !== event.pointerId) return;
    dragging = undefined;
    writeInspectViewportToUrl(preset, freeform);
  }

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
  window.addEventListener("keydown", onKeydown);

  disposeInspect = () => {
    window.removeEventListener("keydown", onKeydown);
    slideHandle?.dispose();
  };

  repaint();

  return root as unknown as Solid.JSX.Element;
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
  const deckCtx = requireDeckCtx("Slide");
  const deck = deckCtx.deck;
  const ctx = requireFrameCtx("Slide");
  const mode = props.mode ?? "live";

  if (mode === "live") {
    const { el, dispose } = renderFrame(
      ctx.frame(),
      deck.tokens,
      deck.appearance,
      deckCtx.loadEmbed,
    );
    el.style.width = "100%";
    el.style.height = "100%";
    ctx.addDisposer(dispose);
    ctx.addDisposer(
      ctx.onChange((from, to) =>
        repaintFrame(el, from, to, deck.tokens, deck.appearance, deck.motion, deckCtx.loadEmbed),
      ),
    );
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
