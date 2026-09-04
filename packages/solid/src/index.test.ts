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
