import { parseDeck, type FileMap } from "@speechdeck/core";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { init } from "./index.ts";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  isCancel: (value: unknown) => typeof value === "symbol",
  text: vi.fn(),
  select: vi.fn(),
}));

const { text, select } = await import("@clack/prompts");

const themesRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "themes");

function files(): FileMap {
  return {
    read(relative) {
      return readFileSync(join(themesRoot, relative.replace("@speechdeck/themes/", "")), "utf8");
    },
  };
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "speechdeck-create-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.mocked(text).mockReset();
  vi.mocked(select).mockReset();
  delete (process.stdin as { isTTY?: boolean }).isTTY;
  delete (process.stdout as { isTTY?: boolean }).isTTY;
});

test("--yes writes a Cover-only empty starter with Harbour, files only", async () => {
  await init({ yes: true, directory: dir });

  const pkg = readJson(join(dir, "package.json"));
  expect(pkg["dependencies"]).toMatchObject({
    "@speechdeck/core": expect.any(String),
    "@speechdeck/solid": expect.any(String),
    "@speechdeck/themes": expect.any(String),
  });
  expect(pkg["scripts"]).toEqual({ dev: "vite", build: "vite build", preview: "vite preview" });
  expect(pkg["intent"]).toEqual({ skills: ["@speechdeck/*"] });

  const deckSource = readFileSync(join(dir, "deck.md"), "utf8");
  expect(deckSource).toContain("theme: @speechdeck/themes/harbour");

  const { deck } = parseDeck(deckSource, files());
  expect(deck.slides).toHaveLength(1);
  expect(deck.slides[0]?.cells).toHaveLength(1);
  expect(deck.slides[0]?.cells[0]?.blocks).toEqual([
    expect.objectContaining({ kind: "heading", depth: 1 }),
  ]);

  // No install, no network: nothing beyond the scaffolded files exists.
  expect(existsSync(join(dir, "node_modules"))).toBe(false);
});

test("no TTY skips prompts and applies the same defaults as --yes", async () => {
  await init({ directory: dir });

  const pkg = readJson(join(dir, "package.json"));
  expect(pkg["dependencies"]).toMatchObject({ "@speechdeck/themes": expect.any(String) });
  const deckSource = readFileSync(join(dir, "deck.md"), "utf8");
  expect(deckSource).toContain("theme: @speechdeck/themes/harbour");
  expect(text).not.toHaveBeenCalled();
  expect(select).not.toHaveBeenCalled();
});

test("refuses to write into a non-empty directory by default", async () => {
  writeFileSync(join(dir, "keep.txt"), "mine");

  await expect(init({ yes: true, directory: dir })).rejects.toThrow(/already exists/);
  expect(existsSync(join(dir, "package.json"))).toBe(false);
});

test("--existing overwrite writes into a non-empty directory", async () => {
  writeFileSync(join(dir, "keep.txt"), "mine");

  await init({ yes: true, directory: dir, existing: "overwrite" });

  expect(existsSync(join(dir, "package.json"))).toBe(true);
  expect(existsSync(join(dir, "keep.txt"))).toBe(true);
});

test("the skeleton starter is a Deck of more than one Slide", async () => {
  await init({ yes: true, directory: dir, starter: "skeleton" });

  const deckSource = readFileSync(join(dir, "deck.md"), "utf8");
  const { deck } = parseDeck(deckSource, files());
  expect(deck.slides.length).toBeGreaterThan(1);
  expect(deck.slides[0]?.cells[0]?.blocks[0]).toMatchObject({ kind: "heading", depth: 1 });
});

test("a chosen theme is reflected in the Deck's Frontmatter and resolves", async () => {
  await init({ yes: true, directory: dir, theme: "@speechdeck/themes/ink" });

  const deckSource = readFileSync(join(dir, "deck.md"), "utf8");
  const { deck } = parseDeck(deckSource, files());
  expect(deck.theme).toBe("@speechdeck/themes/ink");
  expect(deck.tokens.specifier).toBe("@speechdeck/themes/ink");
});

test("scaffolded scripts call Vite directly; there is no dev/build/present wrapper", async () => {
  await init({ yes: true, directory: dir });

  const pkg = readJson(join(dir, "package.json"));
  const scripts = pkg["scripts"] as Record<string, string>;
  expect(scripts["dev"]).toBe("vite");
  expect(scripts["build"]).toBe("vite build");
  expect(scripts["present"]).toBeUndefined();
});

test("writes an AGENTS.md loading block alongside intent.skills", async () => {
  await init({ yes: true, directory: dir });

  const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
  expect(agents).toContain("intent.skills");
  expect(agents).toContain("@speechdeck/*");
});

test("on a TTY, Clack asks directory, starter, and theme", async () => {
  (process.stdin as { isTTY?: boolean }).isTTY = true;
  (process.stdout as { isTTY?: boolean }).isTTY = true;
  vi.mocked(text).mockResolvedValueOnce(dir);
  vi.mocked(select)
    .mockResolvedValueOnce("skeleton")
    .mockResolvedValueOnce("@speechdeck/themes/ink");

  await init({});

  expect(text).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenCalledTimes(2);
  const deckSource = readFileSync(join(dir, "deck.md"), "utf8");
  const { deck } = parseDeck(deckSource, files());
  expect(deck.theme).toBe("@speechdeck/themes/ink");
  expect(deck.slides.length).toBeGreaterThan(1);
});

test("cancelling a prompt rejects instead of scaffolding", async () => {
  (process.stdin as { isTTY?: boolean }).isTTY = true;
  (process.stdout as { isTTY?: boolean }).isTTY = true;
  vi.mocked(text).mockResolvedValueOnce(Symbol("cancel"));

  await expect(init({})).rejects.toThrow(/Cancelled/);
  expect(existsSync(join(dir, "package.json"))).toBe(false);
});
