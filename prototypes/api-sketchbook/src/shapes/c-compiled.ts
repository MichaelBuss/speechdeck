/**
 * PROTOTYPE — Shape C: Compiled routes.
 * The Vite plugin emits a TanStack route tree. There is no runtime parse
 * and no resolveFrame call. Current Slide is the matched route.
 */

import * as Solid from "../solid-shim.ts";
import {
  SAMPLE_DECK,
  matchCode,
  resolveFrame,
  type Deck,
  type EmbedGuest,
  type Frame,
  type Slide,
  type Speech,
  type Viewport,
} from "../model.ts";

export { matchCode, SAMPLE_DECK };
export type { Deck, EmbedGuest, Frame, Viewport };

export const PACKAGES = [
  "@speechdeck/core",
  "@speechdeck/solid",
  "@speechdeck/vite",
  "@speechdeck/create",
  "@speechdeck/themes",
] as const;

export type SlideModule = {
  id: string;
  path: `/${string}`;
  slide: Slide;
  frame: Frame;
};

export type RouteTree = {
  slides: readonly SlideModule[];
};

export function compileDeck(deck: Deck): RouteTree {
  return {
    slides: deck.slides.map((slide, i, all) => {
      const from = i === 0 ? undefined : all[i - 1]?.id;
      const cursor = from === undefined ? { to: slide.id } : { from, to: slide.id };
      return {
        id: slide.id,
        path: `/${slide.id}`,
        slide,
        frame: resolveFrame(deck, cursor),
      };
    }),
  };
}

export function createRouter(tree: RouteTree): { tree: RouteTree } {
  return { tree };
}

export function DeckProvider(
  props: Solid.ParentProps<{ router: { tree: RouteTree } }>,
): Solid.Element {
  return props.children;
}

export function useDeck(): Solid.Accessor<Deck> {
  return () => SAMPLE_DECK;
}

export function useSlide(): Solid.Accessor<Slide> {
  return () => {
    const first = SAMPLE_DECK.slides[0];
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

function PresentView(_props: { router: { tree: RouteTree } }): Solid.Element {
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

export function Present(props: { router: { tree: RouteTree } }): Solid.Element {
  return Solid.createComponent(PresentView, props);
}

export function Rehearse(props: { router: { tree: RouteTree } }): Solid.Element {
  return Solid.createComponent(PresentView, props);
}

export function AuthorApp(): Solid.Element {
  const tree = compileDeck(SAMPLE_DECK);
  const router = createRouter(tree);
  return Present({ router });
}

export const AUTHOR = `import { RouterProvider, createRouter } from "@tanstack/solid-router";
import { Present } from "@speechdeck/solid";
import { routeTree } from "./routeTree.gen";

const router = createRouter({
  routeTree,
  defaultViewTransition: false,
});

export function App() {
  return (
    <RouterProvider router={router}>
      <Present />
    </RouterProvider>
  );
}`;

export const CORE = `// @speechdeck/core  — types + compile-time resolvers. No runtime Deck handle.

matchCode(from: CodeBlock, to: CodeBlock): CodeMatch
// pickLayout, resolveFrame, mintNames run inside the Vite plugin

type SlideModule = {
  id: string
  path: \`/\${string}\`
  slide: Slide
  frame: Frame  // pre-resolved against document-order previous
}

// Generated:
export const deck: Deck
export const routeTree: RouteTree`;

export const SOLID = `// @speechdeck/solid  — .ts only
// useSlide is useParams plus the generated module.

Present(): Solid.JSX.Element
Rehearse(): Solid.JSX.Element
useSlide(): Accessor<Slide>
useSpeech(): Accessor<Speech>
useUpNext(): Accessor<Slide | undefined>
useElapsed(): { ms: Accessor<number>; reset: () => void }

Slide(props: { mode?: "live" | "preview"; viewport?: Viewport }): Solid.JSX.Element
Speech(): Solid.JSX.Element
UpNext(): Solid.JSX.Element
Elapsed(): Solid.JSX.Element

// Deep links and skips are real route matches.
// Pre-resolved Frame.enter is wrong on a skip — the plugin assumed document order.`;

export const VITE = `// @speechdeck/vite
speechdeck(options?: { deck?: string }): Plugin
// emits routeTree.gen.ts — one route per Slide, plus the Deck module`;

export const SEAM = [
  "A second adapter consumes the generated route tree or reimplements the compiler.",
  "Core is not a library you call at runtime. Tests target the plugin.",
  "Skip-then-reflow and mashed arrows are router concerns; Frame.enter baked at compile is a lie for skips.",
  "Host embeds the same as A, but the host is a route component.",
];

export const CUT = [
  "parseDeck / createSession / resolveFrame as runtime calls",
  "A vanilla CLI that is not Vite",
  "Hiding TanStack from the author — the generated tree is the product",
  "exported pickLayout — still internal, now to the plugin",
];
