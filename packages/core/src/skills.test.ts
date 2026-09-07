import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import type { DiagnosticKind } from "./index.ts";

const skillsRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");

function readSkill(name: string): string {
  return readFileSync(join(skillsRoot, name, "SKILL.md"), "utf8");
}

function frontmatterField(content: string, field: string): string | undefined {
  const match = new RegExp(`^${field}:\\s*(.+)$`, "m").exec(content);
  return match?.[1]?.trim();
}

// ADR 0015: exactly two skills ship in @speechdeck/core — authoring a Deck and writing
// an Embed guest. A Theme, presenting, or writing-taste skill is explicitly rejected.
test("core ships exactly the Deck and Embed skills, nothing else", () => {
  const entries = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  expect(entries).toEqual(["deck", "embed"]);
});

test.each(["deck", "embed"])("the %s skill's frontmatter name matches its directory", (name) => {
  const content = readSkill(name);
  expect(frontmatterField(content, "name")).toBe(name);
  expect(content).toMatch(/^description: >/m);
});

const DIAGNOSTIC_KINDS: readonly DiagnosticKind[] = [
  "connected-on-first",
  "duplicate-region",
  "body-and-path",
  "impossible-layout",
  "unknown-image-token",
  "frontmatter-only-slide",
];

// The skill must read parseDeck's actual diagnostic kinds, not invent its own list — this
// fails the moment core's DiagnosticKind union changes without the skill being updated.
test("the Deck skill documents every parseDeck DiagnosticKind and points Refuse at Inspect", () => {
  const content = readSkill("deck");
  for (const kind of DIAGNOSTIC_KINDS) {
    expect(content).toContain(kind);
  }
  expect(content).toMatch(/Refuse/);
  expect(content).toMatch(/Inspect/);
});

test("the Embed skill documents the EmbedGuest contract", () => {
  const content = readSkill("embed");
  expect(content).toContain("EmbedGuest");
  expect(content).toContain("dispose");
  expect(content).toContain("ready");
});
