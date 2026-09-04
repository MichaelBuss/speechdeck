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

test("engine CSS arranges Split-2, Split-3, and Grid without needing theme.css", () => {
  for (const layout of ["split-2", "split-3", "grid"]) {
    expect(css).toContain(`.cells[data-layout="${layout}"]`);
  }
});

test("engine CSS reflows Split/Grid at a narrow container without changing the Layout name", () => {
  expect(css).toContain("@container slide (max-width:");
});

test("engine CSS paints Contain/Crop and every Focus on a foreground image without needing theme.css", () => {
  expect(css).toContain('img[data-fit="contain"]');
  expect(css).toContain('img[data-fit="crop"]');
  for (const focus of [
    "top-left",
    "top",
    "top-right",
    "left",
    "center",
    "right",
    "bottom-left",
    "bottom",
    "bottom-right",
  ]) {
    expect(css).toContain(`img[data-focus="${focus}"]`);
  }
});

test("engine CSS paints a full-bleed Background backdrop, not a Cell", () => {
  expect(css).toContain(".backdrop");
  expect(css).toContain('.backdrop[data-fit="crop"]');
});

test("engine CSS paints combinable Looks (dim, blur) without needing theme.css", () => {
  expect(css).toContain('[data-look~="dim"]');
  expect(css).toContain('[data-look~="blur"]');
  expect(css).toContain('[data-look~="dim"][data-look~="blur"]');
});

test("engine CSS arranges Caption without needing theme.css", () => {
  expect(css).toContain('.cells[data-layout="caption"]');
  expect(css).toContain('[data-caption-order="media"]');
  expect(css).toContain('[data-caption-order="text"]');
});

test("engine CSS gives Inspect a stage, a drag handle, and a readout", () => {
  expect(css).toContain(".inspect-stage");
  expect(css).toContain(".inspect-handle");
  expect(css).toContain(".inspect-readout");
  expect(css).toContain(".readout-row");
});

test("engine CSS paints the travelling background and the fg/title/font handles without needing theme.css", () => {
  expect(css).toContain("background: var(--sd-bg)");
  expect(css).toContain("color: var(--sd-fg)");
  expect(css).toContain("font-family: var(--sd-font-body)");
  expect(css).toContain("color: var(--sd-title)");
  expect(css).toContain("font-family: var(--sd-font-title)");
});
