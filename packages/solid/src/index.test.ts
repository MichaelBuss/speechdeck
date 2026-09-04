// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDeck, type FileMap } from "@speechdeck/core";
import { expect, test } from "vitest";
import { Inspect, Present, Rehearse } from "./index.ts";

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
