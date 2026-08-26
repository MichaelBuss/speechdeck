/**
 * LOCKED — @speechdeck/solid. Import type { Slide } from core;
 * function Slide lives here, so the names do not collide.
 *
 * Authored `import * as Solid from "solid-js"` in `.ts` only.
 */

import type {
  Deck,
  Slide as SlideDoc,
  Speech as SpeechDoc,
  Viewport,
} from "./locked-api.ts";

type Element = unknown;
type Accessor<T> = () => T;
type ParentProps<P = Record<string, never>> = P & { children?: Element };

export declare function DeckProvider(
  props: ParentProps<{ deck: Deck }>,
): Element;
export declare function Present(props: { deck: Deck }): Element;
export declare function Rehearse(props: { deck: Deck }): Element;

export declare function useDeck(): Accessor<Deck>;
export declare function useSlide(): Accessor<SlideDoc>;
export declare function useSpeech(): Accessor<SpeechDoc>;
export declare function useUpNext(): Accessor<SlideDoc | undefined>;
export declare function useElapsed(): { ms: Accessor<number>; reset: () => void };
export declare function useAudienceViewport(): Accessor<Viewport>;

export declare function Slide(props: {
  mode?: "live" | "preview";
  viewport?: Viewport;
}): Element;
export declare function Speech(): Element;
export declare function UpNext(): Element;
export declare function Elapsed(): Element;
