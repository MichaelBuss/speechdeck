// @vitest-environment happy-dom
import { parseDeck, type CodeBlock, type EmbedBlock, type FileMap } from "@speechdeck/core";
import { Present, Rehearse } from "@speechdeck/solid";
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

// A scaffolded project reads relative Cells (file-backed code, demos) off the disk it
// just wrote to, next to the Deck; theme reads still come from the workspace's own
// themes package, mirroring what `${theme}/theme.json?raw` resolves to at runtime.
function files(projectDir: string): FileMap {
  return {
    read(relative) {
      if (relative.startsWith("./") || relative.startsWith("../")) {
        return readFileSync(join(projectDir, relative), "utf8");
      }
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
  expect(pkg["scripts"]).toEqual({
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
    inspect: "SPEECHDECK_INSPECT=1 vite",
  });
  expect(pkg["intent"]).toEqual({ skills: ["@speechdeck/*"] });

  const deckSource = readFileSync(join(dir, "deck.md"), "utf8");
  expect(deckSource).toContain("theme: @speechdeck/themes/harbour");

  const { deck } = parseDeck(deckSource, files(dir));
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
  const { deck } = parseDeck(deckSource, files(dir));
  expect(deck.slides.length).toBeGreaterThan(1);
  expect(deck.slides[0]?.cells[0]?.blocks[0]).toMatchObject({ kind: "heading", depth: 1 });
});

test("the skeleton starter's Embed and its code Cell point at the same file next to the Deck, and show the same bytes", async () => {
  await init({ yes: true, directory: dir, starter: "skeleton" });

  const deckSource = readFileSync(join(dir, "deck.md"), "utf8");
  const { deck, diagnostics } = parseDeck(deckSource, files(dir));
  expect(diagnostics).toEqual([]);

  const blocks = deck.slides.flatMap((slide) => slide.cells.flatMap((cell) => cell.blocks));
  const embeds = blocks.filter((block): block is EmbedBlock => block.kind === "embed");
  expect(embeds).toHaveLength(1);
  const embed = embeds[0];
  expect(embed?.specifier.startsWith("./")).toBe(true);

  // The specifier is a path relative to the Deck (ADR 0006): it must resolve on disk
  // right next to deck.md, not to some reserved embeds folder.
  expect(existsSync(join(dir, embed?.specifier ?? ""))).toBe(true);

  const codeBlocks = blocks.filter((block): block is CodeBlock => block.kind === "code");
  const paired = codeBlocks.find(
    (block) => block.source.from === "file" && block.source.path === embed?.specifier,
  );
  expect(paired?.source.from).toBe("file");

  const onDisk = readFileSync(join(dir, embed?.specifier ?? ""), "utf8");
  expect(paired?.source.bytes).toBe(onDisk);
});

test("the scaffolded skeleton talk Presents and Rehearses, mounting its Embed live", async () => {
  await init({ yes: true, directory: dir, starter: "skeleton" });

  const deckSource = readFileSync(join(dir, "deck.md"), "utf8");
  const { deck } = parseDeck(deckSource, files(dir));

  const dispose = vi.fn();
  const guest = vi.fn(() => ({ dispose, ready: Promise.resolve() }));
  const loadEmbed = vi.fn(async (specifier: string) => {
    const onDisk = readFileSync(join(dir, specifier), "utf8");
    expect(onDisk).toContain("export default");
    return guest;
  });

  window.name = "speechdeck-audience";
  window.history.replaceState(null, "", "/2");
  const present = Present({ deck, loadEmbed }) as unknown as HTMLElement;
  await vi.waitFor(() => expect(guest).toHaveBeenCalledTimes(1));
  expect(present.querySelector(".embed")?.getAttribute("data-live")).toBe("true");

  window.name = "";
  const rehearse = Rehearse({
    deck,
    loadEmbed: vi.fn(async () => guest),
  }) as unknown as HTMLElement;
  expect(rehearse.dataset["composition"]).toBe("rehearse");
});

test("a chosen theme is reflected in the Deck's Frontmatter and resolves", async () => {
  await init({ yes: true, directory: dir, theme: "@speechdeck/themes/ink" });

  const deckSource = readFileSync(join(dir, "deck.md"), "utf8");
  const { deck } = parseDeck(deckSource, files(dir));
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

test("scaffolds a gated Inspect entry: pnpm inspect sets SPEECHDECK_INSPECT=1, and vite.config.ts only builds inspect.html then", async () => {
  await init({ yes: true, directory: dir });

  const pkg = readJson(join(dir, "package.json"));
  const scripts = pkg["scripts"] as Record<string, string>;
  expect(scripts["inspect"]).toBe("SPEECHDECK_INSPECT=1 vite");

  expect(existsSync(join(dir, "inspect.html"))).toBe(true);
  expect(existsSync(join(dir, "src", "inspect.ts"))).toBe(true);
  const inspectEntry = readFileSync(join(dir, "src", "inspect.ts"), "utf8");
  expect(inspectEntry).toContain("Inspect");
  expect(inspectEntry).not.toContain("Present");

  const viteConfig = readFileSync(join(dir, "vite.config.ts"), "utf8");
  expect(viteConfig).toContain("process.env.SPEECHDECK_INSPECT");
  expect(viteConfig).toContain('input.inspect = resolve(import.meta.dirname, "inspect.html");');
});

test("writes an AGENTS.md loading block alongside intent.skills", async () => {
  await init({ yes: true, directory: dir });

  const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
  expect(agents).toContain("intent.skills");
  expect(agents).toContain("@speechdeck/*");
});

// #88: an agent without native Intent support previously had nothing to open — "load ...
// via TanStack Intent" named a mechanism, not a path. Naming a literal node_modules path
// instead would be its own bug (wrong under Yarn PnP, which has no node_modules at all), so
// the fix matches how `npx @tanstack/intent@latest install` itself solves this: teach the
// agent to run `intent list` / `intent load`, commands any agent can invoke regardless of
// whether its runtime resolves Intent natively.
test("AGENTS.md tells the agent to run intent list and intent load, not a hardcoded path", async () => {
  await init({ yes: true, directory: dir });

  const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
  expect(agents).toContain("npx @tanstack/intent@latest list");
  expect(agents).toContain("npx @tanstack/intent@latest load <package>#<skill>");
  expect(agents).not.toContain("node_modules");
});

// Mirrors Intent's own managed-block markers exactly (not a speechdeck-specific spelling) so
// a later real `npx @tanstack/intent@latest install` recognizes and updates this block
// instead of adding a duplicate one.
test("AGENTS.md's skill-loading guidance uses TanStack Intent's real managed-block markers", async () => {
  await init({ yes: true, directory: dir });

  const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
  expect(agents).toContain("<!-- intent-skills:start -->");
  expect(agents).toContain("<!-- intent-skills:end -->");
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
  const { deck } = parseDeck(deckSource, files(dir));
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
