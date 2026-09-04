// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDeck, type FileMap } from "@speechdeck/core";
import { beforeEach, expect, test, vi } from "vitest";
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
