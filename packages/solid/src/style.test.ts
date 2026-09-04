import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "style.css"), "utf8");

test("engine CSS paints every Mark type without needing theme.css", () => {
  expect(css).toContain("mark:not([data-mark])");
  for (const type of ["underline", "circle", "highlight", "box", "strike-through"]) {
    expect(css).toContain(`mark[data-mark="${type}"]`);
  }
});
