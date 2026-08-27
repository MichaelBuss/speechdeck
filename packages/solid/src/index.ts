import type { Deck, Slide as SlideDoc, Speech as SpeechDoc, Viewport } from "@speechdeck/core";
import type * as Solid from "solid-js";

type ParentProps<P = Record<string, never>> = P & {
  children?: Solid.JSX.Element;
};

export function DeckProvider(_props: ParentProps<{ deck: Deck }>): Solid.JSX.Element {
  throw new Error("not implemented");
}

export function Present(_props: { deck: Deck }): Solid.JSX.Element {
  throw new Error("not implemented");
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
