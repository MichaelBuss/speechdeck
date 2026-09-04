// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDeck, type FileMap } from "@speechdeck/core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  DeckProvider,
  Elapsed,
  Rehearse,
  Slide,
  UpNext,
  Inspect,
  Present,
  useAudienceViewport,
  useDeck,
  useElapsed,
  useSlide,
  useSpeech,
  useUpNext,
} from "./index.ts";

const themesRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "themes");

const files: FileMap = {
  read(relative) {
    return readFileSync(join(themesRoot, relative.replace("@speechdeck/themes/", "")), "utf8");
  },
};

function deckFor(markdown: string) {
  return parseDeck(markdown, files).deck;
}

const PRESENTER_VIEW_CHANNEL = "speechdeck-presenter-view";

function waitForMessage(channel: BroadcastChannel): Promise<unknown> {
  return new Promise((resolve) => {
    channel.addEventListener("message", (event: MessageEvent<unknown>) => resolve(event.data), {
      once: true,
    });
  });
}

// Every window starts as the speaker's own; a test opts into being the audience
// popup via becomeAudienceWindow().
beforeEach(() => {
  window.name = "";
  window.innerWidth = 1024;
  window.innerHeight = 768;
});

// happy-dom has no View Transition API; a test that needs one installs this stub and
// this restores the ambient (unsupported) state afterward so other tests keep exercising
// the no-support fallback path.
afterEach(() => {
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  (document as unknown as { activeViewTransition: unknown }).activeViewTransition = null;
  vi.unstubAllGlobals();
});

type FakeViewTransition = {
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  finished: Promise<void>;
  skipTransition: () => void;
};

function stubViewTransition(): {
  start: ReturnType<typeof vi.fn>;
  skipTransition: ReturnType<typeof vi.fn>;
} {
  const skipTransition = vi.fn();
  const vt: FakeViewTransition = {
    ready: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
    finished: Promise.resolve(),
    skipTransition,
  };
  const start = vi.fn((cb?: () => unknown) => {
    cb?.();
    return vt;
  });
  (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
  return { start, skipTransition };
}

function stubReducedMotion(reduced: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion") && reduced,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

test("Present is not implemented", () => {
  expect(typeof Present).toBe("function");
});

test("Rehearse is not implemented", () => {
  expect(typeof Rehearse).toBe("function");
});

test("Rehearse's primitives throw when called before Rehearse mounts", () => {
  expect(() => useSlide()).toThrow(/Rehearse/);
  expect(() => useSpeech()).toThrow(/Rehearse/);
  expect(() => useUpNext()).toThrow(/Rehearse/);
  expect(() => useElapsed()).toThrow(/Rehearse/);
  expect(() => useAudienceViewport()).toThrow(/Rehearse/);
});

test("Inspect renders a Slide on a stage, live, with no Speech", () => {
  window.history.replaceState(null, "", "/");
  const deck = deckFor("---\ntheme: @speechdeck/themes/harbour\n---\n# Talk title\n");

  const root = Inspect({ deck }) as unknown as HTMLElement;
  expect(root.dataset["composition"]).toBe("inspect");
  expect(root.querySelector(".speech")).toBeNull();

  const stage = root.querySelector(".inspect-stage") as HTMLElement;
  const slide = stage.querySelector(".slide");
  expect(slide?.tagName).toBe("MAIN");
  expect(slide?.querySelector("h1")?.textContent).toBe("Talk title");
  expect(root.querySelector('[data-field="heading"] dd')?.textContent).toBe("center");
});

// A click on "Open audience window" makes this window's own Present that popup: it is
// recognized by `window.name`, exactly as window.open(url, "speechdeck-audience") would name it.
function becomeAudienceWindow(): void {
  window.name = "speechdeck-audience";
}

test("Present, opened as the audience window, paints a Cover Slide at / with Harbour tokens on the public DOM", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/");
  const deck = deckFor("---\ntheme: @speechdeck/themes/harbour\n---\n# Talk title\n");

  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.tagName).toBe("MAIN");
  expect(el.className).toBe("slide");
  expect(el.dataset["layout"]).toBe("cover");
  expect(el.style.getPropertyValue("color-scheme")).toBe("dark");
  expect(el.style.getPropertyValue("--sd-font-title")).toBe(deck.tokens.fonts.title);
  expect(el.style.getPropertyValue("--sd-accent-1")).toBe(deck.tokens.accents[0]);
  expect(el.style.getPropertyValue("--sd-bg")).toBe(deck.tokens.stops?.[0]);

  const cell = el.querySelector(".cell");
  expect(cell?.getAttribute("data-kind")).toBe("heading");
  const heading = el.querySelector("h1");
  expect(heading?.textContent).toBe("Talk title");
  expect(heading?.getAttribute("data-align")).toBe("center");
});

test("Present, opened as the audience window, paints a promoted paragraph (with a Mark) as a Solo Cell", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/");
  const deck = deckFor(
    '---\ntheme: @speechdeck/themes/harbour\n---\n<!--on-->\nGo <mark data-mark="circle">now</mark>.\n',
  );

  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.dataset["layout"]).toBe("solo");
  const cell = el.querySelector(".cell");
  expect(cell?.getAttribute("data-kind")).toBe("prose");
  const mark = cell?.querySelector("mark");
  expect(mark?.getAttribute("data-mark")).toBe("circle");
  expect(mark?.textContent).toBe("now");
});

test("Present, opened as the audience window, paints a table as a Solo Cell", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n| a | b |\n| - | - |\n| 1 | 2 |\n",
  );

  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.dataset["layout"]).toBe("solo");
  const cell = el.querySelector(".cell");
  expect(cell?.getAttribute("data-kind")).toBe("table");
  expect(cell?.querySelector("table")).not.toBeNull();
});

test("Present, opened as the audience window, paints a fenced code block as a code Cell", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/");
  const deck = deckFor("---\ntheme: @speechdeck/themes/harbour\n---\n```ts\nlet n = 0;\n```\n");

  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.dataset["layout"]).toBe("solo");
  const cell = el.querySelector(".cell");
  expect(cell?.getAttribute("data-kind")).toBe("code");
  expect(cell?.querySelector("pre code")?.textContent).toBe("let n = 0;");
});

test("Present, opened as the audience window, paints an image Cell with data-fit/data-focus/data-look", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/");
  const deck = deckFor(
    '---\ntheme: @speechdeck/themes/harbour\n---\n![a dog](./dog.jpg "crop top-left dim blur")\n',
  );

  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.dataset["layout"]).toBe("solo");
  const cell = el.querySelector(".cell");
  expect(cell?.getAttribute("data-kind")).toBe("image");
  const img = cell?.querySelector("img");
  expect(img?.getAttribute("src")).toBe("./dog.jpg");
  expect(img?.getAttribute("alt")).toBe("a dog");
  expect(img?.getAttribute("data-fit")).toBe("crop");
  expect(img?.getAttribute("data-focus")).toBe("top-left");
  expect(img?.getAttribute("data-look")).toBe("dim blur");
});

test("Present, opened as the audience window, paints a background title as a full-bleed backdrop, not a Cell", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/");
  const deck = deckFor(
    '---\ntheme: @speechdeck/themes/harbour\n---\n# Talk title\n\n![skyline](./skyline.jpg "background dim")\n',
  );

  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.dataset["layout"]).toBe("cover");
  expect(el.querySelectorAll(".cell")).toHaveLength(1);
  const backdrop = el.querySelector(".backdrop") as HTMLElement;
  expect(backdrop).not.toBeNull();
  expect(backdrop.style.backgroundImage).toContain("skyline.jpg");
  expect(backdrop.getAttribute("data-fit")).toBe("crop");
  expect(backdrop.getAttribute("data-look")).toBe("dim");
});

test("Present, opened as the audience window, sets color-scheme from Appearance: light and dark ignore the environment, auto leaves both", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");

  const dark = deckFor("---\ntheme: @speechdeck/themes/harbour\n---\n# One\n");
  const darkEl = Present({ deck: dark }) as unknown as HTMLElement;
  expect(darkEl.style.getPropertyValue("color-scheme")).toBe("dark");

  const light = deckFor("---\ntheme: @speechdeck/themes/harbour\nappearance: light\n---\n# One\n");
  const lightEl = Present({ deck: light }) as unknown as HTMLElement;
  expect(lightEl.style.getPropertyValue("color-scheme")).toBe("light");

  const auto = deckFor("---\ntheme: @speechdeck/themes/harbour\nappearance: auto\n---\n# One\n");
  const autoEl = Present({ deck: auto }) as unknown as HTMLElement;
  expect(autoEl.style.getPropertyValue("color-scheme")).toBe("light dark");
});

test("Present, opened as the audience window, advances Harbour's stops one per participating Slide and blends between them in oklab", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n# One\n---\n## Two\n---\n## Three\n---\n## Four\n",
  );
  const stops = deck.tokens.stops as readonly string[];
  expect(stops).toHaveLength(4);

  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.style.getPropertyValue("--sd-bg")).toBe(stops[0]);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(el.style.getPropertyValue("--sd-bg")).toBe(stops[1]);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(el.style.getPropertyValue("--sd-bg")).toBe(stops[2]);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(el.style.getPropertyValue("--sd-bg")).toBe(stops[3]);
});

test("Present, opened as the audience window, blends between adjacent stops in oklab when travel lands between them", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n# One\n---\n## Two\n---\n## Three\n",
  );
  const stops = deck.tokens.stops as readonly string[];

  const el = Present({ deck }) as unknown as HTMLElement;
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })); // t = 0.5
  const bg = el.style.getPropertyValue("--sd-bg");
  expect(bg).toContain("color-mix(in oklab");
  expect(bg).toContain(stops[1]);
  expect(bg).toContain(stops[2]);
});

test("Present, opened as the audience window, keeps Ink still: --sd-bg does not change across Slides", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/ink\n---\n# One\n---\n## Two\n---\n## Three\n",
  );
  expect(deck.tokens.stops).toBeUndefined();

  const el = Present({ deck }) as unknown as HTMLElement;
  const first = el.style.getPropertyValue("--sd-bg");

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(el.style.getPropertyValue("--sd-bg")).toBe(first);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(el.style.getPropertyValue("--sd-bg")).toBe(first);
});

test("Present, opened as the audience window, keeps Signal's stops outside sRGB (display-p3) as travel advances", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor("---\ntheme: @speechdeck/themes/signal\n---\n# One\n---\n## Two\n");
  const stops = deck.tokens.stops as readonly string[];
  expect(stops.every((stop) => stop.includes("display-p3"))).toBe(true);

  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.style.getPropertyValue("--sd-bg")).toBe(stops[0]);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(el.style.getPropertyValue("--sd-bg")).toBe(stops[stops.length - 1]);
});

test("Present, opened as the audience window, orders a Caption's media before its H4 text regardless of source order", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n#### A caption\n\n![a dog](./dog.jpg)\n",
  );

  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.dataset["layout"]).toBe("caption");
  const cells = el.querySelectorAll(".cells > .cell");
  expect(cells).toHaveLength(2);
  expect(cells[0]?.getAttribute("data-kind")).toBe("heading");
  expect(cells[0]?.getAttribute("data-caption-order")).toBe("text");
  expect(cells[1]?.getAttribute("data-kind")).toBe("image");
  expect(cells[1]?.getAttribute("data-caption-order")).toBe("media");
});

test("Present, opened as the audience window, reflows two/three/four+ Cells as Split-2/Split-3/Grid", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(
    [
      "---",
      "theme: @speechdeck/themes/harbour",
      "---",
      "<!--on-->",
      "One.",
      "",
      "<!--on-->",
      "Two.",
      "---",
      "<!--on-->",
      "One.",
      "",
      "<!--on-->",
      "Two.",
      "",
      "<!--on-->",
      "Three.",
      "---",
      "<!--on-->",
      "One.",
      "",
      "<!--on-->",
      "Two.",
      "",
      "<!--on-->",
      "Three.",
      "",
      "<!--on-->",
      "Four.",
    ].join("\n"),
  );

  const el = Present({ deck }) as unknown as HTMLElement;
  const cells = () => el.querySelector(".cells") as HTMLElement;

  expect(cells().dataset["layout"]).toBe("split-2");
  expect(cells().dataset["items"]).toBe("2");
  expect(cells().querySelectorAll(".cell")).toHaveLength(2);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(cells().dataset["layout"]).toBe("split-3");
  expect(cells().dataset["items"]).toBe("3");

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(cells().dataset["layout"]).toBe("grid");
  expect(cells().dataset["items"]).toBe("4");
});

test("Present, opened as the audience window, honours an impossible layout: override by rendering the auto pick", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const { deck, diagnostics } = parseDeck(
    "---\ntheme: @speechdeck/themes/harbour\n---\nlayout: grid\n<!--on-->\nOne.\n\n<!--on-->\nTwo.\n",
    files,
  );

  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]?.kind).toBe("impossible-layout");

  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.dataset["layout"]).toBe("split-2");
});

test("Present, opened as the audience window, never paints Speech onto the Slide", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n## Heading\n\nThis is spoken only, never shown.\n",
  );

  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.textContent).not.toContain("spoken only");
});

test("Present, opened as the audience window: ArrowRight/ArrowLeft hard-cut to the next/previous Slide and update the URL", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n# One\n---\n## Two\n---\n## Three\n",
  );

  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.dataset["layout"]).toBe("cover");

  const right = new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true });
  window.dispatchEvent(right);
  expect(right.defaultPrevented).toBe(true);
  expect(window.location.pathname).toBe("/2");
  expect(el.dataset["layout"]).toBe("section");
  expect(el.querySelector("h2")?.textContent).toBe("Two");

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(window.location.pathname).toBe("/3");
  expect(el.querySelector("h2")?.textContent).toBe("Three");

  const left = new KeyboardEvent("keydown", { key: "ArrowLeft", cancelable: true });
  window.dispatchEvent(left);
  expect(left.defaultPrevented).toBe(true);
  expect(window.location.pathname).toBe("/2");

  // ArrowLeft at the first Slide has no target and does not move.
  window.history.replaceState(null, "", "/1");
  Present({ deck });
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  expect(window.location.pathname).toBe("/1");
});

test("Present, opened as the audience window: a deep link and a skip via popstate are hard cuts; a sequential back/forward connects", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/3");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n# One\n---\n## Two\n---\nenter: connected\n## Three\n",
  );

  // Deep link straight to Slide 3: no prior Arrival, still a hard cut.
  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.dataset["enter"]).toBe("cut");

  // A skip from 1 to 3 (jumping over 2) is also a hard cut, even though
  // Slide 3 declares enter: connected.
  window.history.replaceState(null, "", "/1");
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.history.replaceState(null, "", "/3");
  window.dispatchEvent(new PopStateEvent("popstate"));
  expect(el.dataset["enter"]).toBe("cut");

  // Sequential back from 3 to 2, then forward to 3, is the connected edge.
  window.history.replaceState(null, "", "/2");
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.history.replaceState(null, "", "/3");
  window.dispatchEvent(new PopStateEvent("popstate"));
  expect(el.dataset["enter"]).toBe("connected");
});

const SAME_HEADING_DECK =
  "---\ntheme: @speechdeck/themes/harbour\n---\n## Same\n---\nenter: connected\n## Same\n";

test("Present, opened as the audience window: a connected sequential Arrival runs a View Transition naming the persisting heading", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(SAME_HEADING_DECK);
  const el = Present({ deck }) as unknown as HTMLElement;

  let beforeName: string | undefined;
  const { start } = stubViewTransition();
  start.mockImplementationOnce((cb?: () => unknown) => {
    beforeName = el.querySelector("h2")?.style.getPropertyValue("view-transition-name");
    cb?.();
    return {
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      finished: Promise.resolve(),
      skipTransition: vi.fn(),
    };
  });

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

  expect(start).toHaveBeenCalledTimes(1);
  expect(beforeName).toBeTruthy();
  const heading = el.querySelector("h2");
  expect(heading?.textContent).toBe("Same");
  expect(heading?.style.getPropertyValue("view-transition-name")).toBe(beforeName);
  expect(heading?.style.getPropertyValue("view-transition-class")).toBe("heading");
});

const SAME_INDEX_CODE_DECK =
  "---\ntheme: @speechdeck/themes/harbour\n---\n```ts\nlet n = 0;\n```\n---\nenter: connected\n```ts\nlet n = 1;\n```\n";

test("Present, opened as the audience window: a connected sequential Arrival morphs same-index code Cells with a shared, author-invisible name", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(SAME_INDEX_CODE_DECK);
  const el = Present({ deck }) as unknown as HTMLElement;

  let beforeName: string | undefined;
  const { start } = stubViewTransition();
  start.mockImplementationOnce((cb?: () => unknown) => {
    beforeName = (
      el.querySelector('.cell[data-kind="code"]') as HTMLElement
    ).style.getPropertyValue("view-transition-name");
    cb?.();
    return {
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      finished: Promise.resolve(),
      skipTransition: vi.fn(),
    };
  });

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

  expect(start).toHaveBeenCalledTimes(1);
  expect(beforeName).toBeTruthy();
  const codeCell = el.querySelector('.cell[data-kind="code"]') as HTMLElement;
  expect(codeCell.querySelector("code")?.textContent).toBe("let n = 1;");
  expect(codeCell.style.getPropertyValue("view-transition-name")).toBe(beforeName);
  expect(codeCell.style.getPropertyValue("view-transition-class")).toBe("code");
});

test("Present, opened as the audience window: a leftover code Cell with no counterpart at its index does not morph", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n```ts\nlet n = 0;\n```\n---\nenter: connected\n```ts\nlet n = 1;\n```\n\n```ts\nlet m = 0;\n```\n",
  );
  const el = Present({ deck }) as unknown as HTMLElement;
  stubViewTransition();

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

  const codeCells = [...el.querySelectorAll<HTMLElement>('.cell[data-kind="code"]')];
  expect(codeCells).toHaveLength(2);
  expect(codeCells[0]?.style.getPropertyValue("view-transition-name")).toBeTruthy();
  expect(codeCells[1]?.style.getPropertyValue("view-transition-name")).toBe("");
});

test("Present, opened as the audience window: code on a hard cut never gets a view-transition-name", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n```ts\nlet n = 0;\n```\n---\n```ts\nlet n = 1;\n```\n",
  );
  const el = Present({ deck }) as unknown as HTMLElement;
  const { start } = stubViewTransition();

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

  expect(start).not.toHaveBeenCalled();
  const codeCell = el.querySelector('.cell[data-kind="code"]') as HTMLElement;
  expect(codeCell.style.getPropertyValue("view-transition-name")).toBe("");
});

test("Present, opened as the audience window: a hard cut never opens a View Transition, even mid-Deck", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n# One\n---\n## Two\n---\n## Three\n",
  );
  Present({ deck });
  const { start } = stubViewTransition();

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

  expect(start).not.toHaveBeenCalled();
});

test("Present, opened as the audience window: a deep link to a Slide that declares enter: connected is still a hard cut with no View Transition", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/2");
  const deck = deckFor(SAME_HEADING_DECK);
  const { start } = stubViewTransition();

  Present({ deck });

  expect(start).not.toHaveBeenCalled();
});

test("Present, opened as the audience window: Motion auto hard-cuts a connected edge when the environment prefers reduced motion", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(SAME_HEADING_DECK);
  expect(deck.motion).toBe("auto");
  Present({ deck });
  stubReducedMotion(true);
  const { start } = stubViewTransition();

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

  expect(start).not.toHaveBeenCalled();
});

test("Present, opened as the audience window: Motion always still runs connected motion under reduced motion", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\nmotion: always\n---\n## Same\n---\nenter: connected\n## Same\n",
  );
  expect(deck.motion).toBe("always");
  Present({ deck });
  stubReducedMotion(true);
  const { start } = stubViewTransition();

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

  expect(start).toHaveBeenCalledTimes(1);
});

test("Present, opened as the audience window: Motion always does not invent motion on an unconnected Slide", () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\nmotion: always\n---\n# One\n---\n## Two\n",
  );
  Present({ deck });
  const { start } = stubViewTransition();

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

  expect(start).not.toHaveBeenCalled();
});

test("Present, opened as the audience window: a resize observed on the Slide skips any active View Transition, then reflows", () => {
  // watchHeadingAlign also observes a ResizeObserver on the heading; every observed
  // callback is fired below rather than relying on construction order to find "the" one.
  const observedCallbacks: Array<() => void> = [];
  class FakeResizeObserver {
    constructor(cb: () => void) {
      observedCallbacks.push(cb);
    }
    observe(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);

  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(SAME_HEADING_DECK);
  Present({ deck });

  const skipTransition = vi.fn();
  (document as unknown as { activeViewTransition: { skipTransition: () => void } | null })[
    "activeViewTransition"
  ] = { skipTransition };

  expect(observedCallbacks.length).toBeGreaterThan(0);
  for (const cb of observedCallbacks) cb();

  expect(skipTransition).toHaveBeenCalledTimes(1);
});

const THREE_SLIDE_DECK =
  "---\ntheme: @speechdeck/themes/harbour\n---\n# One\n\nSpeech one.\n---\n## Two\n\nSpeech two.\n---\n## Three\n\nSpeech three.\n";

test("Rehearse is one window: Speech dominant, current + up-next as a side rail", () => {
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(THREE_SLIDE_DECK);

  const root = Rehearse({ deck }) as unknown as HTMLElement;
  expect(root.className).toBe("rehearse");
  expect(root.style.getPropertyValue("container-type")).toBe("inline-size");
  expect(root.style.getPropertyValue("container-name")).toBe("presenter");

  const speech = root.querySelector(".speech");
  expect(speech?.textContent).toBe("Speech one.");
  expect((speech as HTMLElement).style.overflowY).toBe("auto");

  const rail = root.querySelector(".rail");
  expect(rail).not.toBeNull();
  expect(rail?.querySelectorAll("button")).toHaveLength(1);

  const previews = rail?.querySelectorAll(".preview") ?? [];
  expect(previews).toHaveLength(2);

  const now = previews[0] as HTMLElement;
  expect(now.querySelector(".preview-tag")?.textContent).toBe("Now");
  const nowStage = now.querySelector(".preview-stage");
  expect((nowStage as HTMLElement).style.width).toBe("1280px");
  expect((nowStage as HTMLElement).style.height).toBe("720px");
  expect(nowStage?.getAttribute("data-layout")).toBe("cover");
  expect(nowStage?.querySelector("h1")?.textContent).toBe("One");

  const next = previews[1] as HTMLElement;
  expect(next.querySelector(".preview-tag")?.textContent).toBe("Up next");
  const nextStage = next.querySelector(".preview-stage");
  expect(nextStage?.getAttribute("data-layout")).toBe("section");
  expect(nextStage?.querySelector("h2")?.textContent).toBe("Two");
});

test("Rehearse advance replaces Speech and slides the rail forward; overflow scrolls, it is not mirrored", () => {
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(THREE_SLIDE_DECK);
  const root = Rehearse({ deck }) as unknown as HTMLElement;

  const speech = root.querySelector(".speech");
  expect(speech?.textContent).toBe("Speech one.");

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(window.location.pathname).toBe("/2");
  expect(speech?.textContent).toBe("Speech two.");
  expect(speech?.textContent).not.toContain("Speech one.");

  const previews = root.querySelectorAll(".preview");
  const now = previews[0];
  const next = previews[1];
  expect(now?.querySelector(".preview-stage")?.querySelector("h2")?.textContent).toBe("Two");
  expect(next?.querySelector(".preview-stage")?.querySelector("h2")?.textContent).toBe("Three");

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(window.location.pathname).toBe("/3");
  expect(speech?.textContent).toBe("Speech three.");
  // Slide 3 is the last Slide: Up next shows End, not a mirrored/looped preview.
  expect(next?.getAttribute("data-state")).toBe("end");
  expect(next?.textContent).toContain("End");

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  expect(window.location.pathname).toBe("/2");
  expect(speech?.textContent).toBe("Speech two.");
});

test("Rehearse's primitives (Speech, Slide, UpNext, Elapsed) and their useX pairs work once mounted", () => {
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(THREE_SLIDE_DECK);
  Rehearse({ deck });

  expect(useDeck()()).toBe(deck);
  expect(useSlide()().id).toBe("1");
  expect(useSpeech()().blocks[0]).toMatchObject({ html: "<p>Speech one.</p>" });
  expect(useUpNext()()?.id).toBe("2");
  expect(useElapsed().ms()).toBeGreaterThanOrEqual(0);
  expect(useAudienceViewport()()).toEqual({ width: 1280, height: 720 });
});

test("Elapsed time is the only clock; it can be reset", () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(0);
    window.history.replaceState(null, "", "/1");
    const deck = deckFor(THREE_SLIDE_DECK);
    Rehearse({ deck });

    const clock = Elapsed() as unknown as HTMLButtonElement;
    expect(clock.textContent).toBe("0:00");

    vi.setSystemTime(65_000);
    vi.advanceTimersByTime(250);
    expect(clock.textContent).toBe("1:05");

    clock.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clock.textContent).toBe("0:00");
    expect(useElapsed().ms()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

test("A preview lays the Slide out at the audience viewport, not the thumbnail's own size", () => {
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(THREE_SLIDE_DECK);
  Rehearse({ deck });

  expect(useAudienceViewport()()).toEqual({ width: 1280, height: 720 });

  const custom = Slide({
    mode: "preview",
    viewport: { width: 390, height: 844 },
  }) as unknown as HTMLElement;
  const stage = custom.querySelector(".preview-stage") as HTMLElement;
  expect(stage.style.width).toBe("390px");
  expect(stage.style.height).toBe("844px");
});

test("DeckProvider makes useDeck available to its children", () => {
  const deck = deckFor(THREE_SLIDE_DECK);
  DeckProvider({ deck });
  expect(useDeck()()).toBe(deck);
});

test("UpNext shows the next Slide, not the current one", () => {
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(THREE_SLIDE_DECK);
  Rehearse({ deck });

  const upNext = UpNext() as unknown as HTMLElement;
  expect(upNext.querySelector(".preview-tag")?.textContent).toBe("Up next");
  expect(upNext.querySelector(".preview-stage")?.querySelector("h2")?.textContent).toBe("Two");
});

test("Present defaults to the speaker's own composition: Speech dominant, a rail, and an Open audience window button", () => {
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(THREE_SLIDE_DECK);

  const root = Present({ deck }) as unknown as HTMLElement;
  expect(root.className).toBe("present");
  expect(root.dataset["composition"]).toBe("present");

  const speech = root.querySelector(".speech");
  expect(speech?.tagName).toBe("MAIN");
  expect(speech?.textContent).toBe("Speech one.");

  const rail = root.querySelector(".rail");
  const buttons = rail?.querySelectorAll("button") ?? [];
  expect(buttons).toHaveLength(2);
  expect(buttons[0]?.className).toBe("open-audience");
  expect(buttons[0]?.textContent).toBe("Open audience window");
});

test("Present: a click on Open audience window opens the Slide URL; it does not auto-open", () => {
  window.history.replaceState(null, "", "/2");
  const deck = deckFor(THREE_SLIDE_DECK);
  const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

  const root = Present({ deck }) as unknown as HTMLElement;
  expect(openSpy).not.toHaveBeenCalled();

  const button = root.querySelector(".open-audience") as HTMLButtonElement;
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  expect(openSpy).toHaveBeenCalledTimes(1);
  expect(openSpy).toHaveBeenCalledWith(window.location.href, "speechdeck-audience");

  openSpy.mockRestore();
});

test("Present leads: local navigation posts the Slide id on the shared channel", async () => {
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(THREE_SLIDE_DECK);
  const spy = new BroadcastChannel(PRESENTER_VIEW_CHANNEL);
  const received = waitForMessage(spy);

  Present({ deck });
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

  expect(await received).toEqual({ type: "slide", slide: "2" });
  spy.close();
});

test("Present follows: a Slide id from the channel moves this window's URL and Frame", async () => {
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(THREE_SLIDE_DECK);
  Present({ deck });
  expect(useSlide()().id).toBe("1");

  const lead = new BroadcastChannel(PRESENTER_VIEW_CHANNEL);
  lead.postMessage({ type: "slide", slide: "3" });

  await vi.waitFor(() => expect(window.location.pathname).toBe("/3"));
  expect(useSlide()().id).toBe("3");
  lead.close();
});

test("Present, opened as the audience window, posts { width, height } on mount, including on resize; the speaker's previews then match", async () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(THREE_SLIDE_DECK);
  const spy = new BroadcastChannel(PRESENTER_VIEW_CHANNEL);

  const first = waitForMessage(spy);
  Present({ deck });
  expect(await first).toEqual({ type: "viewport", width: 1024, height: 768 });

  const second = waitForMessage(spy);
  window.innerWidth = 390;
  window.innerHeight = 844;
  window.dispatchEvent(new Event("resize"));
  expect(await second).toEqual({ type: "viewport", width: 390, height: 844 });

  spy.close();
});

test("Present, opened as the audience window, leads: ArrowRight posts the Slide id on the shared channel", async () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(THREE_SLIDE_DECK);
  const spy = new BroadcastChannel(PRESENTER_VIEW_CHANNEL);

  const mountedViewport = waitForMessage(spy);
  Present({ deck });
  await mountedViewport;

  const slideMessage = waitForMessage(spy);
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(await slideMessage).toEqual({ type: "slide", slide: "2" });

  spy.close();
});

test("Present, opened as the audience window, follows: a Slide id from the channel updates the URL and the painted Slide", async () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(THREE_SLIDE_DECK);
  const el = Present({ deck }) as unknown as HTMLElement;

  const lead = new BroadcastChannel(PRESENTER_VIEW_CHANNEL);
  lead.postMessage({ type: "slide", slide: "3" });

  await vi.waitFor(() => expect(window.location.pathname).toBe("/3"));
  expect(el.querySelector("h2")?.textContent).toBe("Three");
  lead.close();
});

test("The audience Slide and Presenter view's Speech are each a named main; previews are hidden from the accessibility tree; there is no live region", () => {
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(THREE_SLIDE_DECK);

  const presentRoot = Present({ deck }) as unknown as HTMLElement;
  const speech = presentRoot.querySelector("main.speech");
  expect(speech?.getAttribute("aria-label")).toBe("Speech");
  expect(presentRoot.querySelectorAll("[aria-live]")).toHaveLength(0);
  const previews = presentRoot.querySelectorAll(".preview");
  expect(previews.length).toBeGreaterThan(0);
  for (const preview of previews) {
    expect(preview.getAttribute("aria-hidden")).toBe("true");
  }

  becomeAudienceWindow();
  const audienceEl = Present({ deck }) as unknown as HTMLElement;
  expect(audienceEl.tagName).toBe("MAIN");
  expect(audienceEl.getAttribute("aria-label")).toBe("One");
  expect(audienceEl.querySelectorAll("[aria-live]")).toHaveLength(0);
});

test("An Embed in a preview is inert: a static placeholder, never a live mount", () => {
  window.history.replaceState(null, "", "/1");
  const base = deckFor("---\ntheme: @speechdeck/themes/harbour\n---\n# One\n");
  const deck = {
    ...base,
    slides: [
      {
        id: "1",
        enter: "cut" as const,
        cells: [
          {
            blocks: [
              {
                kind: "embed" as const,
                specifier: "./demos/counter.ts",
                props: null,
                fallback: "Counter",
              },
            ],
          },
        ],
        speech: { blocks: [] },
      },
    ],
  };

  Present({ deck });
  const preview = Slide({
    mode: "preview",
    viewport: { width: 1280, height: 720 },
  }) as unknown as HTMLElement;
  const embed = preview.querySelector(".embed");
  expect(embed?.textContent).toBe("Counter");
  expect(embed?.getAttribute("data-specifier")).toBe("./demos/counter.ts");
  expect(preview.querySelector("iframe")).toBeNull();
});

test("An Embed on the audience Slide mounts its guest once, handing it the host element and its props", async () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n```embed ./demos/counter.ts\ncount: 3\n```\n",
  );

  const dispose = vi.fn();
  const guest = vi.fn(() => ({ dispose, ready: Promise.resolve() }));
  const loadEmbed = vi.fn(async (specifier: string) => {
    expect(specifier).toBe("./demos/counter.ts");
    return guest;
  });

  const el = Present({ deck, loadEmbed }) as unknown as HTMLElement;
  await vi.waitFor(() => expect(guest).toHaveBeenCalledTimes(1));

  const host = el.querySelector(".embed");
  expect(guest).toHaveBeenCalledWith(host, { count: 3 });
  expect(host?.getAttribute("data-live")).toBe("true");
  expect(dispose).not.toHaveBeenCalled();
});

test("A hard cut away from a live Embed disposes its guest before the Cells are rebuilt", async () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n```embed ./demos/counter.ts\n```\n\n---\n\n# Two\n",
  );

  const dispose = vi.fn();
  const guest = vi.fn(() => ({ dispose, ready: Promise.resolve() }));
  const loadEmbed = vi.fn(async () => guest);

  Present({ deck, loadEmbed });
  await vi.waitFor(() => expect(guest).toHaveBeenCalledTimes(1));

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(dispose).toHaveBeenCalledTimes(1);
});

test("Escape blurs an in-document Embed and returns focus to the Slide", async () => {
  becomeAudienceWindow();
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n```embed ./demos/counter.ts\n```\n",
  );

  const guest = vi.fn(() => ({ dispose: vi.fn(), ready: Promise.resolve() }));
  const loadEmbed = vi.fn(async () => guest);

  const el = Present({ deck, loadEmbed }) as unknown as HTMLElement;
  document.body.appendChild(el);
  await vi.waitFor(() => expect(guest).toHaveBeenCalledTimes(1));

  const host = el.querySelector(".embed") as HTMLElement;
  host.tabIndex = 0;
  host.focus();
  expect(document.activeElement).toBe(host);

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(document.activeElement).toBe(el);

  document.body.removeChild(el);
});

const TWO_CELL_DECK =
  "---\ntheme: @speechdeck/themes/harbour\n---\n<!--on-->\nOne.\n\n<!--on-->\nTwo.\n";

test("Inspect shows all seven named viewports; Fill is the default and is the window, not dragged", () => {
  window.history.replaceState(null, "", "/");
  const deck = deckFor(TWO_CELL_DECK);

  const root = Inspect({ deck }) as unknown as HTMLElement;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>(".inspect-preset")];
  expect(buttons.map((b) => b.dataset["preset"])).toEqual([
    "fill",
    "16-9",
    "zoom",
    "square",
    "phone",
    "phone-l",
    "freeform",
  ]);
  expect(buttons.map((b) => b.textContent)).toEqual([
    "Fill",
    "16:9 1280×720",
    "Zoom 900×700",
    "Square 800×800",
    "Phone 390×844",
    "Phone landscape 844×390",
    "Freeform",
  ]);

  const stage = root.querySelector(".inspect-stage") as HTMLElement;
  expect(stage.dataset["preset"]).toBe("fill");
  expect(stage.style.width).toBe("100%");
  expect(stage.style.height).toBe("100%");
  expect(root.querySelector('[data-field="stage"] dd')?.textContent).toBe("1024×768");

  const handle = root.querySelector(".inspect-handle") as HTMLElement;
  expect(handle.style.display).toBe("none");
});

test("Clicking a named preset sizes the stage exactly and stores the preset id in the URL", () => {
  window.history.replaceState(null, "", "/");
  const deck = deckFor(TWO_CELL_DECK);
  const root = Inspect({ deck }) as unknown as HTMLElement;

  const zoomBtn = root.querySelector<HTMLButtonElement>('[data-preset="zoom"]');
  zoomBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  const stage = root.querySelector(".inspect-stage") as HTMLElement;
  expect(stage.dataset["preset"]).toBe("zoom");
  expect(stage.style.width).toBe("900px");
  expect(stage.style.height).toBe("700px");
  expect(zoomBtn?.getAttribute("aria-pressed")).toBe("true");
  expect(new URLSearchParams(window.location.search).get("preset")).toBe("zoom");
  expect(new URLSearchParams(window.location.search).has("width")).toBe(false);
});

test("Reload of a named preset from the URL is exact", () => {
  window.history.replaceState(null, "", "/?preset=phone");
  const deck = deckFor(TWO_CELL_DECK);
  const root = Inspect({ deck }) as unknown as HTMLElement;

  const stage = root.querySelector(".inspect-stage") as HTMLElement;
  expect(stage.dataset["preset"]).toBe("phone");
  expect(stage.style.width).toBe("390px");
  expect(stage.style.height).toBe("844px");
});

test("Clicking Freeform with no history opens 1280×720", () => {
  window.history.replaceState(null, "", "/");
  const deck = deckFor(TWO_CELL_DECK);
  const root = Inspect({ deck }) as unknown as HTMLElement;

  const freeformBtn = root.querySelector<HTMLButtonElement>('[data-preset="freeform"]');
  freeformBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  const stage = root.querySelector(".inspect-stage") as HTMLElement;
  expect(stage.style.width).toBe("1280px");
  expect(stage.style.height).toBe("720px");
  const params = new URLSearchParams(window.location.search);
  expect(params.get("preset")).toBe("freeform");
  expect(params.get("width")).toBe("1280");
  expect(params.get("height")).toBe("720");
});

test("Freeform round-trips the box: reloading a stored Freeform size is exact", () => {
  window.history.replaceState(null, "", "/?preset=freeform&width=950&height=720");
  const deck = deckFor(TWO_CELL_DECK);
  const root = Inspect({ deck }) as unknown as HTMLElement;

  const stage = root.querySelector(".inspect-stage") as HTMLElement;
  expect(stage.style.width).toBe("950px");
  expect(stage.style.height).toBe("720px");
});

test("Dragging a named box selects Freeform and keeps that size", () => {
  window.history.replaceState(null, "", "/?preset=zoom");
  const deck = deckFor(TWO_CELL_DECK);
  const root = Inspect({ deck }) as unknown as HTMLElement;
  const stage = root.querySelector(".inspect-stage") as HTMLElement;
  const handle = root.querySelector(".inspect-handle") as HTMLElement;

  handle.dispatchEvent(
    new PointerEvent("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 }),
  );
  // The very first move, even with no delta, already reads as Freeform at the box's
  // current size — it must not jump before the drag actually moves anything.
  handle.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 100, clientY: 100 }),
  );
  expect(stage.dataset["preset"]).toBe("freeform");
  expect(stage.style.width).toBe("900px");
  expect(stage.style.height).toBe("700px");

  handle.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 150, clientY: 120 }),
  );
  expect(stage.style.width).toBe("950px");
  expect(stage.style.height).toBe("720px");

  handle.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  const params = new URLSearchParams(window.location.search);
  expect(params.get("preset")).toBe("freeform");
  expect(params.get("width")).toBe("950");
  expect(params.get("height")).toBe("720");
});

test("Inspect's readout is exactly Layout, Impossible override, Cells, Stage, Heading align, and Refuse — Travel, identity names, enter, Speech, and Embed readiness stay out", () => {
  window.history.replaceState(null, "", "/");
  const deck = deckFor(TWO_CELL_DECK);
  const root = Inspect({ deck }) as unknown as HTMLElement;

  const terms = [...root.querySelectorAll(".readout-row > dt")].map((dt) => dt.textContent);
  expect(terms).toEqual([
    "Layout",
    "Impossible override",
    "Cells",
    "Stage",
    "Heading align",
    "Refuse",
  ]);
  expect(root.textContent).not.toMatch(/enter|speech|embed ready|identity/i);

  expect(root.querySelector('[data-field="layout"] dd')?.textContent).toBe("split-2 (auto)");
  expect(root.querySelector('[data-field="impossible"] dd')?.textContent).toBe("no");
  expect(root.querySelector('[data-field="cells"] dd')?.textContent).toBe("2");
  expect(root.querySelector('[data-field="heading"] dd')?.textContent).toBe("—");
  expect(root.querySelector('[data-field="refuse"] dd')?.textContent).toBe("no");
});

test("Inspect names the auto pick when an override wins, and flags an impossible override", () => {
  window.history.replaceState(null, "", "/");
  const captionDeck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\nlayout: split-2\n#### Caption\n\n![alt](./photo.jpg)\n",
  );
  const overriddenRoot = Inspect({ deck: captionDeck }) as unknown as HTMLElement;
  expect(overriddenRoot.querySelector('[data-field="layout"] dd')?.textContent).toBe(
    "split-2 (override, auto caption)",
  );
  expect(overriddenRoot.querySelector('[data-field="impossible"] dd')?.textContent).toBe("no");

  const { deck: impossibleDeck } = parseDeck(
    "---\ntheme: @speechdeck/themes/harbour\n---\nlayout: grid\n<!--on-->\nOne.\n\n<!--on-->\nTwo.\n",
    files,
  );
  const impossibleRoot = Inspect({ deck: impossibleDeck }) as unknown as HTMLElement;
  expect(impossibleRoot.querySelector('[data-field="layout"] dd')?.textContent).toBe(
    "split-2 (override, auto split-2)",
  );
  expect(impossibleRoot.querySelector('[data-field="impossible"] dd')?.textContent).toBe(
    "yes — lint, auto rendered",
  );
});

test("Refuse is measured at the stage's viewport, from the laid-out DOM", () => {
  window.history.replaceState(null, "", "/");
  const deck = deckFor(TWO_CELL_DECK);
  const root = Inspect({ deck }) as unknown as HTMLElement;
  expect(root.querySelector('[data-field="refuse"] dd')?.textContent).toBe("no");

  const cells = root.querySelector(".cells") as HTMLElement;
  Object.defineProperty(cells, "scrollHeight", { value: 5000, configurable: true });
  Object.defineProperty(cells, "clientHeight", { value: 200, configurable: true });

  // Re-measure by reselecting the current preset; the stage's content did not change.
  root
    .querySelector<HTMLButtonElement>('[data-preset="fill"]')
    ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(root.querySelector('[data-field="refuse"] dd')?.textContent).toBe("yes");
});

test("Inspect never joins Present's BroadcastChannel", () => {
  window.history.replaceState(null, "", "/");
  const deck = deckFor(TWO_CELL_DECK);
  const Native = BroadcastChannel;
  let created = 0;
  class Counting extends Native {
    constructor(name: string) {
      created++;
      super(name);
    }
  }
  vi.stubGlobal("BroadcastChannel", Counting);

  Inspect({ deck });

  expect(created).toBe(0);
});

test("Inspect's own Arrival is local: advancing here never posts to Present's channel and never moves the audience Slide", () => {
  window.history.replaceState(null, "", "/1");
  const deck = deckFor(THREE_SLIDE_DECK);
  const spy = new BroadcastChannel(PRESENTER_VIEW_CHANNEL);
  const messages: unknown[] = [];
  spy.addEventListener("message", (event: MessageEvent<unknown>) => messages.push(event.data));

  const root = Inspect({ deck }) as unknown as HTMLElement;
  expect(root.querySelector(".slide h1")?.textContent).toBe("One");

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(root.querySelector(".slide h2")?.textContent).toBe("Two");

  expect(messages).toEqual([]);
  expect(window.location.pathname).toBe("/1");
  spy.close();
});

test("Embeds on the Inspect stage are live, not inert previews", async () => {
  window.history.replaceState(null, "", "/");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n```embed ./demos/counter.ts\ncount: 3\n```\n",
  );
  const dispose = vi.fn();
  const guest = vi.fn(() => ({ dispose, ready: Promise.resolve() }));
  const loadEmbed = vi.fn(async () => guest);

  const root = Inspect({ deck, loadEmbed }) as unknown as HTMLElement;
  await vi.waitFor(() => expect(guest).toHaveBeenCalledTimes(1));

  const host = root.querySelector(".embed");
  expect(guest).toHaveBeenCalledWith(host, { count: 3 });
  expect(host?.getAttribute("data-live")).toBe("true");
});
