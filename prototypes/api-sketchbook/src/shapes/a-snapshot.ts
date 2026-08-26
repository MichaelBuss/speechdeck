/**
 * PROTOTYPE — Shape A: Snapshot.
 * Core is a document plus `resolveFrame`. The router (inside the Solid adapter)
 * owns *now*. Authors never see TanStack.
 */

import * as Solid from "../solid-shim.ts";
import {
  parseDeck,
  resolveFrame,
  matchCode,
  SAMPLE_DECK,
  type CodeMatch,
  type Arrival,
  type Deck,
  type EmbedGuest,
  type FileMap,
  type Frame,
  type Slide,
  type Speech,
  type Viewport,
} from "../model.ts";

export { parseDeck, resolveFrame, matchCode, SAMPLE_DECK };
export type { CodeMatch, Arrival, Deck, EmbedGuest, FileMap, Frame, Viewport };

export const PACKAGES = [
  "@speechdeck/core",
  "@speechdeck/solid",
  "@speechdeck/vite",
  "@speechdeck/create",
  "@speechdeck/themes",
] as const;

export function speechdeck(_options?: { deck?: string }): { name: "speechdeck" } {
  return { name: "speechdeck" };
}

export function DeckProvider(props: Solid.ParentProps<{ deck: Deck }>): Solid.Element {
  return props.children;
}

export function useDeck(): Solid.Accessor<Deck> {
  return () => SAMPLE_DECK;
}

export function useSlide(): Solid.Accessor<Slide> {
  const deck = useDeck();
  return () => {
    const first = deck().slides[0];
    if (first === undefined) throw new Error("empty deck");
    return first;
  };
}

export function useSpeech(): Solid.Accessor<Speech> {
  const slide = useSlide();
  return () => slide().speech;
}

export function useUpNext(): Solid.Accessor<Slide | undefined> {
  return () => SAMPLE_DECK.slides[1];
}

export function useElapsed(): { ms: Solid.Accessor<number>; reset: () => void } {
  return { ms: () => 0, reset: () => undefined };
}

export function useAudienceViewport(): Solid.Accessor<Viewport> {
  return () => ({ width: 1280, height: 720 });
}

export type SlideProps = {
  mode?: "live" | "preview";
  viewport?: Viewport;
};

function SlideView(_props: SlideProps): Solid.Element {
  return null;
}

function SpeechView(): Solid.Element {
  return null;
}

function UpNextView(): Solid.Element {
  return null;
}

function ElapsedView(): Solid.Element {
  return null;
}

function PresentView(_props: { deck: Deck }): Solid.Element {
  return null;
}

function RehearseView(_props: { deck: Deck }): Solid.Element {
  return null;
}

export function Slide(props: SlideProps): Solid.Element {
  return Solid.createComponent(SlideView, props);
}

export function Speech(): Solid.Element {
  return Solid.createComponent(SpeechView, {});
}

export function UpNext(): Solid.Element {
  return Solid.createComponent(UpNextView, {});
}

export function Elapsed(): Solid.Element {
  return Solid.createComponent(ElapsedView, {});
}

export function Present(props: { deck: Deck }): Solid.Element {
  return Solid.createComponent(PresentView, props);
}

export function Rehearse(props: { deck: Deck }): Solid.Element {
  return Solid.createComponent(RehearseView, props);
}

/** Author app. JSX is legal here — this file is the scaffold, not a published package. */
export function AuthorApp(): Solid.Element {
  return Present({ deck: SAMPLE_DECK });
}

export const AUTHOR = `import { Present } from "@speechdeck/solid";
import deck from "../deck.md";

export function App() {
  return <Present deck={deck} />;
}`;

export const CORE = `// @speechdeck/core  — no DOM

parseDeck(markdown: string, files: FileMap): Deck
resolveFrame(deck: Deck, arrival: Arrival): Frame
matchCode(from: CodeBlock, to: CodeBlock): CodeMatch

type Arrival = { to: string; from?: string }
type Named = { identity: string; name: string; class: "heading" | "code" | "figure" }
type Frame = { /* layout, enter, t, speech, upNext, names */ }
type EmbedGuest<El = unknown> = (
  el: El,
  props: Json,
) => { dispose: () => void; ready: Promise<void> }

// NOT exported: pickLayout, mintNames, mixStops`;

export const SOLID = `// @speechdeck/solid  — .ts only, import * as Solid from "solid-js"

DeckProvider(props: ParentProps<{ deck: Deck }>): Solid.JSX.Element
Present(props: { deck: Deck }): Solid.JSX.Element
Rehearse(props: { deck: Deck }): Solid.JSX.Element

useDeck(): Accessor<Deck>
useSlide(): Accessor<Slide>
useSpeech(): Accessor<Speech>
useUpNext(): Accessor<Slide | undefined>
useElapsed(): { ms: Accessor<number>; reset: () => void }
useAudienceViewport(): Accessor<Viewport>

Slide(props: { mode?: "live" | "preview"; viewport?: Viewport }): Solid.JSX.Element
Speech(): Solid.JSX.Element
UpNext(): Solid.JSX.Element
Elapsed(): Solid.JSX.Element

// Adapter internals, not author-facing:
//   createComponent(SlideView, { get frame() { return resolveFrame(...) } })
//   router lives inside Present / Rehearse
//   BroadcastChannel lives inside Present`;

export const VITE = `// @speechdeck/vite
speechdeck(options?: { deck?: string }): Plugin
// default: ./deck.md
// import deck from "./deck.md"  →  Deck`;

export const SEAM = [
  "Call resolveFrame when the URL changes; Arrival.from is the previous Slide or omitted.",
  "Paint the public DOM from Frame. Stamp view-transition-name from Frame.names. Set viewTransition from Frame.enter.",
  "Host each Embed: one element, never reparented. Author modules export EmbedGuest.",
  "Presenter sync is URL + BroadcastChannel inside Present. Primitives read the same Frame.",
];

export const CUT = [
  "useFrame, useRouter, go/next — authors do not own now",
  "exported pickLayout / mintNames",
  "a DeckClient / QueryClient",
  "boolean inert / isPreview / disabled — Slide mode is live | preview",
  "parseDeck in the browser — the Vite plugin calls it",
];
