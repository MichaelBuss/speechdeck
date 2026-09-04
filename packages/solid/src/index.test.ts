// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDeck, type FileMap } from "@speechdeck/core";
import { expect, test, vi } from "vitest";
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

test("Inspect is not implemented", () => {
  expect(typeof Inspect).toBe("function");
});

test("Present paints a Cover Slide at / with Harbour tokens on the public DOM", () => {
  window.history.replaceState(null, "", "/");
  const deck = deckFor("---\ntheme: @speechdeck/themes/harbour\n---\n# Talk title\n");

  const el = Present({ deck }) as unknown as HTMLElement;
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

test("Present never paints Speech onto the Slide", () => {
  window.history.replaceState(null, "", "/");
  const deck = deckFor(
    "---\ntheme: @speechdeck/themes/harbour\n---\n## Heading\n\nThis is spoken only, never shown.\n",
  );

  const el = Present({ deck }) as unknown as HTMLElement;
  expect(el.textContent).not.toContain("spoken only");
});

test("Present: ArrowRight/ArrowLeft hard-cut to the next/previous Slide and update the URL", () => {
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

test("Present: a deep link and a skip via popstate are hard cuts; a sequential back/forward connects", () => {
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
