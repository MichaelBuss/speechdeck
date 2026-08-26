/**
 * PROTOTYPE — Shape B: Session.
 * Core owns *now*. Subscribe, go, next, prev. The adapter wraps a machine
 * and also has a router, because slides are URLs and view transitions
 * only start from a navigation.
 */

import * as Solid from "../solid-shim.ts";
import {
  SAMPLE_DECK,
  nextId,
  parseDeck,
  prevId,
  resolveFrame,
  matchCode,
  type Arrival,
  type Deck,
  type EmbedGuest,
  type FileMap,
  type Frame,
  type Slide,
  type Speech,
  type Viewport,
} from "../model.ts";

export { parseDeck, matchCode, SAMPLE_DECK };
export type { Arrival, Deck, EmbedGuest, FileMap, Frame, Viewport };

export const PACKAGES = [
  "@speechdeck/core",
  "@speechdeck/solid",
  "@speechdeck/vite",
  "@speechdeck/create",
  "@speechdeck/themes",
] as const;

export type Session = {
  readonly deck: Deck;
  cursor(): Arrival;
  frame(): Frame;
  go(to: string): void;
  next(): void;
  prev(): void;
  subscribe(listener: () => void): () => void;
};

export function createSession(deck: Deck, start?: string): Session {
  const first = deck.slides[0];
  if (first === undefined) throw new Error("empty deck");
  let current: Arrival = { to: start ?? first.id };
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const fn of listeners) fn();
  };

  return {
    deck,
    cursor: () => current,
    frame: () => resolveFrame(deck, current),
    go(to: string) {
      current = { from: current.to, to };
      notify();
    },
    next() {
      const id = nextId(deck, current.to);
      if (id === undefined) return;
      current = { from: current.to, to: id };
      notify();
    },
    prev() {
      const id = prevId(deck, current.to);
      if (id === undefined) return;
      current = { from: current.to, to: id };
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function DeckProvider(
  props: Solid.ParentProps<{ session: Session }>,
): Solid.Element {
  return props.children;
}

export function useSession(): Solid.Accessor<Session> {
  const session = createSession(SAMPLE_DECK);
  return () => session;
}

export function useDeck(): Solid.Accessor<Deck> {
  const session = useSession();
  return () => session().deck;
}

export function useSlide(): Solid.Accessor<Slide> {
  const session = useSession();
  return () => session().frame().slide;
}

export function useSpeech(): Solid.Accessor<Speech> {
  const slide = useSlide();
  return () => slide().speech;
}

export function useUpNext(): Solid.Accessor<Slide | undefined> {
  const session = useSession();
  return () => session().frame().upNext;
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

function PresentView(_props: { session: Session }): Solid.Element {
  return null;
}

function RehearseView(_props: { session: Session }): Solid.Element {
  return null;
}

export function Slide(props: SlideProps): Solid.Element {
  return Solid.createComponent(SlideView, props);
}

export function Speech(): Solid.Element {
  return null;
}

export function UpNext(): Solid.Element {
  return null;
}

export function Elapsed(): Solid.Element {
  return null;
}

export function Present(props: { session: Session }): Solid.Element {
  return Solid.createComponent(PresentView, props);
}

export function Rehearse(props: { session: Session }): Solid.Element {
  return Solid.createComponent(RehearseView, props);
}

export function AuthorApp(): Solid.Element {
  const session = createSession(SAMPLE_DECK);
  return Present({ session });
}

export const AUTHOR = `import { createSession } from "@speechdeck/core";
import { Present } from "@speechdeck/solid";
import deck from "../deck.md";

const session = createSession(deck);

export function App() {
  return <Present session={session} />;
}`;

export const CORE = `// @speechdeck/core  — still no DOM, but it owns now

parseDeck(markdown: string, files: FileMap): Deck
createSession(deck: Deck, start?: string): Session
matchCode(from: CodeBlock, to: CodeBlock): CodeMatch

type Session = {
  readonly deck: Deck
  cursor(): Cursor
  frame(): Frame
  go(to: string): void
  next(): void
  prev(): void
  subscribe(listener: () => void): () => void
}`;

export const SOLID = `// @speechdeck/solid  — .ts only

DeckProvider(props: ParentProps<{ session: Session }>): Solid.JSX.Element
Present(props: { session: Session }): Solid.JSX.Element
Rehearse(props: { session: Session }): Solid.JSX.Element

useSession(): Accessor<Session>
useDeck(): Accessor<Deck>
useSlide(): Accessor<Slide>
useSpeech(): Accessor<Speech>
useUpNext(): Accessor<Slide | undefined>
useElapsed(): { ms: Accessor<number>; reset: () => void }

Slide(props: { mode?: "live" | "preview"; viewport?: Viewport }): Solid.JSX.Element
Speech(): Solid.JSX.Element
UpNext(): Solid.JSX.Element
Elapsed(): Solid.JSX.Element

// Adapter still creates a TanStack router so view transitions fire.
// session.go and router.navigate must not drift.`;

export const VITE = `// @speechdeck/vite — same as A
speechdeck(options?: { deck?: string }): Plugin`;

export const SEAM = [
  "createSession in core. Subscribe in the adapter.",
  "Also bind TanStack Router: slides are URLs, and startViewTransition only runs on a navigation.",
  "Decide who wins when session.next() and router.navigate() both happen — arrow keys, presenter click, deep link.",
  "Host embeds and Presenter BroadcastChannel the same as A.",
];

export const CUT = [
  "resolveFrame as the author-facing call — Session.frame wraps it",
  "exported pickLayout / mintNames",
  "boolean inert / isPreview",
  "A public transition API — still forbidden; go() is navigation, not motion",
];
