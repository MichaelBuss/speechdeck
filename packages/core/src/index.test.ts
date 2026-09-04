import { expect, test } from "vitest";
import { matchCode, parseDeck, resolveFrame, type FileMap } from "./index.ts";

const harbourTheme = JSON.stringify({
  fonts: { title: "serif", body: "sans-serif", mono: "monospace" },
  accents: ["a", "b", "c", "d"],
  dark: { fg: "#fff", title: "#fff", muted: "#ccc", chrome: "#000" },
  light: { fg: "#000", title: "#000", muted: "#333", chrome: "#fff" },
  stops: ["oklch(0.2 0 0)", "oklch(0.3 0 0)"],
});

const files: FileMap = {
  read(relative) {
    if (relative === "@speechdeck/themes/harbour/theme.json") return harbourTheme;
    throw new Error(`no such file: ${relative}`);
  },
};

test("parseDeck: theme + one H1 heading yields a Cover Slide at address 1", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n# Title\n";
  const { deck, diagnostics } = parseDeck(source, files);

  expect(diagnostics).toEqual([]);
  expect(deck.slides).toHaveLength(1);
  expect(deck.slides[0]?.id).toBe("1");
  expect(deck.slides[0]?.layout).toBeUndefined();
  expect(deck.tokens.specifier).toBe("@speechdeck/themes/harbour");
  expect(deck.appearance).toBe("dark");
  expect(deck.motion).toBe("auto");

  const frame = resolveFrame(deck, { to: "1" });
  expect(frame.layout).toBe("cover");
  expect(frame.layoutAuto).toBe("cover");
  expect(frame.layoutSource).toBe("auto");
  expect(frame.enter).toBe("cut");
  expect(frame.upNext).toBeUndefined();
});

test("parseDeck: omitted appearance is dark, omitted motion is auto", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n# Title\n";
  const { deck } = parseDeck(source, files);
  expect(deck.appearance).toBe("dark");
  expect(deck.motion).toBe("auto");
});

test("parseDeck: explicit appearance and motion are honoured", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\nappearance: light\nmotion: always\n---\n# Title\n";
  const { deck } = parseDeck(source, files);
  expect(deck.appearance).toBe("light");
  expect(deck.motion).toBe("always");
});

test("parseDeck: theme is required", () => {
  expect(() => parseDeck("# Title\n", files)).toThrow();
  expect(() => parseDeck("---\n---\n# Title\n", files)).toThrow();
});

test("parseDeck: an unresolvable theme.json does not yield a Deck", () => {
  const source = "---\ntheme: ./missing-theme\n---\n# Title\n";
  expect(() => parseDeck(source, files)).toThrow();
});

test("matchCode is not implemented", () => {
  const block = {
    kind: "code" as const,
    lang: "ts",
    source: { from: "fence" as const, bytes: "" },
    html: "",
  };
  expect(() => matchCode(block, block)).toThrow("not implemented");
});
