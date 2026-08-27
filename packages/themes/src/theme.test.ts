import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function load(name: string): {
  accents: unknown[];
  stops?: unknown[];
} {
  return JSON.parse(readFileSync(join(root, name, "theme.json"), "utf8")) as {
    accents: unknown[];
    stops?: unknown[];
  };
}

test("Harbour travels and has four accents", () => {
  const theme = load("harbour");
  expect(theme.accents).toHaveLength(4);
  expect(theme.stops?.length).toBeGreaterThan(1);
});

test("Ink is still and has four accents", () => {
  const theme = load("ink");
  expect(theme.accents).toHaveLength(4);
  expect(theme.stops).toBeUndefined();
});

test("Signal travels in P3 and has four accents", () => {
  const theme = load("signal");
  expect(theme.accents).toHaveLength(4);
  expect(theme.stops?.length).toBeGreaterThan(1);
});
