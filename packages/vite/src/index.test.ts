import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { speechdeck } from "./index.ts";

const harbourTheme = JSON.stringify({
  fonts: { title: "serif", body: "sans-serif", mono: "monospace" },
  accents: ["a", "b", "c", "d"],
  dark: { fg: "#fff", title: "#fff", muted: "#ccc", chrome: "#000" },
  light: { fg: "#000", title: "#000", muted: "#333", chrome: "#fff" },
});

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "speechdeck-vite-"));
  mkdirSync(join(dir, "theme"));
  writeFileSync(join(dir, "theme", "theme.json"), harbourTheme);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function mockContext() {
  return { addWatchFile: vi.fn(), warn: vi.fn() };
}

function plugin(deck = "deck.md") {
  const p = speechdeck({ deck });
  (p as { configResolved: (config: { root: string }) => void }).configResolved({ root: dir });
  return p as {
    transform: (
      this: ReturnType<typeof mockContext>,
      code: string,
      id: string,
    ) => Promise<{ code: string; map: null } | undefined>;
  };
}

test("speechdeck: ignores files other than the configured Deck", async () => {
  const ctx = mockContext();
  const result = await plugin().transform.call(ctx, "irrelevant", join(dir, "README.md"));
  expect(result).toBeUndefined();
  expect(ctx.addWatchFile).not.toHaveBeenCalled();
});

test("speechdeck: transforms the Deck into a module exporting a highlighted Deck", async () => {
  const source = ["---", "theme: ./theme", "---", "```ts", "const x = 1;", "```"].join("\n");
  writeFileSync(join(dir, "deck.md"), source);

  const ctx = mockContext();
  const result = await plugin().transform.call(ctx, source, join(dir, "deck.md"));
  expect(result).toBeDefined();

  const modulePath = join(dir, "deck.transformed.mjs");
  writeFileSync(modulePath, result!.code);
  const { deck, diagnostics } = (await import(pathToFileURL(modulePath).href)) as {
    deck: { slides: unknown[] };
    diagnostics: unknown[];
  };
  expect(diagnostics).toEqual([]);
  const block = (deck as { slides: { cells: { blocks: { kind: string; html: string }[] }[] }[] })
    .slides[0]?.cells[0]?.blocks[0];
  expect(block?.kind).toBe("code");
  expect(block?.html).toContain("<span");
  expect(block?.html).toContain("--shiki-");
  expect(ctx.addWatchFile).toHaveBeenCalledWith(join(dir, "deck.md"));
});

function withInspectEnv(value: string | undefined, fn: () => void): void {
  const original = process.env["SPEECHDECK_INSPECT"];
  if (value === undefined) delete process.env["SPEECHDECK_INSPECT"];
  else process.env["SPEECHDECK_INSPECT"] = value;
  try {
    fn();
  } finally {
    if (original === undefined) delete process.env["SPEECHDECK_INSPECT"];
    else process.env["SPEECHDECK_INSPECT"] = original;
  }
}

function configureServer(p: ReturnType<typeof speechdeck>, server: unknown): void {
  (p as unknown as { configureServer: (s: unknown) => void }).configureServer(server);
}

test("speechdeck: by default, 404s /inspect.html on the dev server and lets everything else through", () => {
  withInspectEnv(undefined, () => {
    const use = vi.fn();
    configureServer(speechdeck(), { middlewares: { use } });
    expect(use).toHaveBeenCalledTimes(1);
    const middleware = use.mock.calls[0]?.[0] as (
      req: { url?: string },
      res: { statusCode?: number; end: (body?: string) => void },
      next: () => void,
    ) => void;

    const blocked = { statusCode: 200, end: vi.fn() };
    const next = vi.fn();
    middleware({ url: "/inspect.html" }, blocked, next);
    expect(blocked.statusCode).toBe(404);
    expect(blocked.end).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();

    const passed = { statusCode: 200, end: vi.fn() };
    const next2 = vi.fn();
    middleware({ url: "/index.html" }, passed, next2);
    expect(next2).toHaveBeenCalledTimes(1);
  });
});

test("speechdeck: SPEECHDECK_INSPECT=1 serves /inspect.html on the dev server", () => {
  withInspectEnv("1", () => {
    const use = vi.fn();
    configureServer(speechdeck(), { middlewares: { use } });
    expect(use).not.toHaveBeenCalled();
  });
});

test("speechdeck: watches a file-backed code Cell's path and forwards Lints as warnings", async () => {
  writeFileSync(join(dir, "counter.ts"), "let n = 0;\n");
  const source = ["---", "theme: ./theme", "---", "layout: grid", "```ts ./counter.ts", "```"].join(
    "\n",
  );
  writeFileSync(join(dir, "deck.md"), source);

  const ctx = mockContext();
  const result = await plugin().transform.call(ctx, source, join(dir, "deck.md"));
  expect(result).toBeDefined();
  expect(ctx.addWatchFile).toHaveBeenCalledWith(join(dir, "counter.ts"));
  expect(ctx.warn).toHaveBeenCalledWith(expect.stringContaining("does not fit"));
});
