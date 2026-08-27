import { expect, test } from "vitest";
import { matchCode, parseDeck, resolveFrame } from "./index.ts";

test("parseDeck is not implemented", () => {
  expect(() => parseDeck("", { read: () => "" })).toThrow("not implemented");
});

test("resolveFrame is not implemented", () => {
  expect(() =>
    resolveFrame(
      {
        theme: "@speechdeck/themes/harbour",
        tokens: {
          specifier: "@speechdeck/themes/harbour",
          fonts: { title: "serif", body: "sans-serif", mono: "monospace" },
          accents: ["a", "b", "c", "d"],
          dark: { fg: "#fff", title: "#fff", muted: "#ccc", chrome: "#000" },
          light: { fg: "#000", title: "#000", muted: "#333", chrome: "#fff" },
        },
        appearance: "dark",
        motion: "auto",
        slides: [],
      },
      { to: "1" },
    ),
  ).toThrow("not implemented");
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
