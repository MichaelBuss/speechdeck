/**
 * PROTOTYPE — walk one talk through each shape and dump what each layer sees.
 * This is the portable bit: the signatures in the shape files are the
 * proposal; this module is how they feel when a presenter actually moves.
 */

import { createSession } from "./shapes/b-session.ts";
import { compileDeck } from "./shapes/c-compiled.ts";
import {
  SAMPLE_DECK,
  firstCode,
  firstEmbed,
  indexOf,
  matchCode,
  resolveFrame,
  slideById,
  type Arrival,
  type Deck,
  type Frame,
} from "./model.ts";

export const STEP_IDS = [
  "boot",
  "cover",
  "connected",
  "embed",
  "present",
  "skip",
] as const;

export type StepId = (typeof STEP_IDS)[number];

export type Step = {
  id: StepId;
  title: string;
  what: string;
};

export const STEPS: Record<StepId, Step> = {
  boot: {
    id: "boot",
    title: "Boot",
    what: "The Vite plugin has handed the adapter a Deck. Nobody is presenting yet.",
  },
  cover: {
    id: "cover",
    title: "First paint",
    what: "Deep link / first Slide. Always a hard cut — there is no previous Slide.",
  },
  connected: {
    id: "connected",
    title: "Connected next",
    what: "Arrow to createDeck. enter: connected, document-order, so motion runs.",
  },
  embed: {
    id: "embed",
    title: "Code + Embed",
    what: "Next connected Slide. Live host mounts. A Presenter preview must not.",
  },
  present: {
    id: "present",
    title: "Present",
    what: "Click opens the audience window. Same URL, BroadcastChannel, either side leads.",
  },
  skip: {
    id: "skip",
    title: "Skip",
    what: "Jump to The resolver is the API. Destination said connected in C's baked Frame — A/B fold it to a cut.",
  },
};

export type WindowKind = "none" | "rehearse" | "present";

export type Dump = {
  author: string;
  cursor: string;
  enter: string;
  layout: string;
  t: string;
  motion: string;
  embed: string;
  presenter: string;
  warning: string | undefined;
};

export type VariantId = "A" | "B" | "C";

type Moment = {
  cursor: Arrival | undefined;
  window: WindowKind;
};

function moment(step: StepId): Moment {
  const slides = SAMPLE_DECK.slides;
  const cover = slides[0]?.id;
  const code = slides[1]?.id;
  const seam = slides[2]?.id;
  const resolver = slides[3]?.id;
  if (
    cover === undefined ||
    code === undefined ||
    seam === undefined ||
    resolver === undefined
  ) {
    throw new Error("fixture deck too short");
  }
  switch (step) {
    case "boot":
      return { cursor: undefined, window: "none" };
    case "cover":
      return { cursor: { to: cover }, window: "rehearse" };
    case "connected":
      return { cursor: { from: cover, to: code }, window: "rehearse" };
    case "embed":
      return { cursor: { from: code, to: seam }, window: "rehearse" };
    case "present":
      return { cursor: { from: code, to: seam }, window: "present" };
    case "skip":
      return { cursor: { from: cover, to: resolver }, window: "present" };
  }
}

function codeNote(deck: Deck, frame: Frame): string {
  const to = firstCode(frame.slide);
  if (to === undefined) return "no code";
  if (frame.enter === "cut") return `code Cell, pairing none (hard cut)`;
  const fromId = deck.slides[indexOf(deck, frame.slide.id) - 1]?.id;
  if (fromId === undefined) return "code Cell, pairing none";
  const from = firstCode(slideById(deck, fromId));
  if (from === undefined) return "code Cell, unpaired leftover";
  const match = matchCode(from, to);
  return `matchCode → ${match.pairing} (${match.key})`;
}

function embedNote(frame: Frame, window: WindowKind): string {
  const embed = firstEmbed(frame.slide);
  if (embed === undefined) return "no Embed";
  const guest = `${embed.specifier} as EmbedGuest`;
  if (window === "present") {
    return `live: mount ${guest} · preview: mode preview, guest not called`;
  }
  return `rehearse live: mount ${guest} (one window, one host)`;
}

function dumpA(step: StepId): Dump {
  const { cursor, window } = moment(step);
  if (cursor === undefined) {
    return {
      author: "import deck from \"../deck.md\"",
      cursor: "—",
      enter: "—",
      layout: "—",
      t: "—",
      motion: "router defaultViewTransition false",
      embed: "—",
      presenter: "nothing mounted",
      warning: undefined,
    };
  }
  const frame = resolveFrame(SAMPLE_DECK, cursor);
  const viewTransition = frame.enter === "connected" ? "true (this navigation)" : "false";
  return {
    author: window === "present" ? "<Present deck={deck} />" : "<Rehearse deck={deck} />",
    cursor: cursor.from === undefined ? `{ to: "${cursor.to}" }` : `{ from: "${cursor.from}", to: "${cursor.to}" }`,
    enter: `resolveFrame → enter: ${frame.enter}`,
    layout: `${frame.layout} (${frame.layoutSource})`,
    t: `--sd-t: ${frame.t.toFixed(2)} · stop ${frame.stop}`,
    motion: `adapter sets viewTransition: ${viewTransition}`,
    embed: embedNote(frame, window),
    presenter: `${window} · ${codeNote(SAMPLE_DECK, frame)}`,
    warning: undefined,
  };
}

function playB(step: StepId) {
  const session = createSession(SAMPLE_DECK);
  if (step === "connected") session.next();
  if (step === "embed" || step === "present") {
    session.next();
    session.next();
  }
  if (step === "skip") {
    const resolver = SAMPLE_DECK.slides[3];
    if (resolver === undefined) throw new Error("fixture deck too short");
    session.go(resolver.id);
  }
  return session;
}

function dumpB(step: StepId): Dump {
  const { window } = moment(step);
  const session = playB(step);
  if (step === "boot") {
    return {
      author: "const session = createSession(deck)",
      cursor: `{ to: "${session.cursor().to}" }  ← already at first Slide`,
      enter: "session constructed a now before anyone navigated",
      layout: session.frame().layout,
      t: "—",
      motion: "router still required for View Transitions",
      embed: "—",
      presenter: "session exists; window does not",
      warning: "Two currents the moment the URL disagrees with session.cursor().",
    };
  }
  const frame = session.frame();
  const dual =
    step === "skip"
      ? "session.go(\"4\") vs router.navigate('/4'): who fires startViewTransition?"
      : undefined;
  return {
    author: window === "present" ? "<Present session={session} />" : "<Rehearse session={session} />",
    cursor: `session.cursor() → { from: ${session.cursor().from === undefined ? "∅" : `"${session.cursor().from}"`}, to: "${session.cursor().to}" }`,
    enter: `session.frame().enter: ${frame.enter}`,
    layout: `${frame.layout} (${frame.layoutSource})`,
    t: `--sd-t: ${frame.t.toFixed(2)} · stop ${frame.stop}`,
    motion: "go() is not a navigation. Adapter must echo it into the router or VT never runs.",
    embed: embedNote(frame, window),
    presenter: `${window} · ${codeNote(SAMPLE_DECK, frame)}`,
    warning: dual,
  };
}

function dumpC(step: StepId): Dump {
  const { cursor, window } = moment(step);
  const tree = compileDeck(SAMPLE_DECK);
  if (cursor === undefined) {
    return {
      author: "createRouter({ routeTree })",
      cursor: "no match",
      enter: "each SlideModule.frame assumed document-order previous",
      layout: "—",
      t: "—",
      motion: "defaultViewTransition: false on the generated router",
      embed: "—",
      presenter: "author owns RouterProvider",
      warning: undefined,
    };
  }
  const mod = tree.slides.find((s) => s.id === cursor.to);
  if (mod === undefined) throw new Error("missing generated slide");
  const baked = mod.frame;
  const live = resolveFrame(SAMPLE_DECK, cursor);
  const lie = baked.enter !== live.enter;
  return {
    author: "<RouterProvider router={router}><Present /></RouterProvider>",
    cursor: `matched route /${cursor.to}`,
    enter: lie
      ? `baked enter: ${baked.enter} · live skip is ${live.enter} — COMPILE LIED`
      : `baked enter: ${baked.enter} (matches live)`,
    layout: `${baked.layout} (${baked.layoutSource})`,
    t: `--sd-t: ${baked.t.toFixed(2)}`,
    motion: "route options.viewTransition from the generated module",
    embed: embedNote(live, window),
    presenter: `${window} · up-next is the next route`,
    warning: lie
      ? "A skip still matches the destination route. Frame.enter was frozen against the previous Slide in the Deck."
      : undefined,
  };
}

export function inspect(variant: VariantId, step: StepId): Dump {
  if (variant === "A") return dumpA(step);
  if (variant === "B") return dumpB(step);
  return dumpC(step);
}
