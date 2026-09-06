import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { afterEach, expect, test } from "vitest";
import { build } from "vite";
import { init } from "./index.ts";

const BUDGET_BYTES = 50 * 1024;
const thisDir = dirname(fileURLToPath(import.meta.url));

let fixtureDir: string | undefined;

afterEach(() => {
  if (fixtureDir !== undefined) rmSync(fixtureDir, { recursive: true, force: true });
  fixtureDir = undefined;
});

/** Every JS a page's own `<script>` / `<link rel="modulepreload">` tags load — the whole
 *  graph Vite emits for that entry, not just its own chunk (ADR 0017). */
function pageScriptGzipBytes(distDir: string, html: string): number {
  const content = readFileSync(join(distDir, html), "utf8");
  const scripts = [...content.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]!);
  return scripts.reduce((total, src) => {
    const bytes = readFileSync(join(distDir, src.replace(/^\//, "")));
    return total + gzipSync(bytes).length;
  }, 0);
}

test("the empty starter's production Present and Rehearse are each at or under 50 kB gzip of client JS", async () => {
  // A sibling of this package's own node_modules — workspace-linked @speechdeck/vite,
  // @speechdeck/themes, and vite itself resolve from here exactly as a real install would.
  fixtureDir = mkdtempSync(join(thisDir, "..", ".budget-"));
  await init({ yes: true, directory: fixtureDir });

  await build({
    root: fixtureDir,
    configFile: join(fixtureDir, "vite.config.ts"),
    logLevel: "silent",
  });

  const distDir = join(fixtureDir, "dist");
  // Inspect is a second gated entry with no budget (ADR 0017): a default build never emits it.
  expect(existsSync(join(distDir, "inspect.html"))).toBe(false);

  expect(pageScriptGzipBytes(distDir, "index.html")).toBeLessThanOrEqual(BUDGET_BYTES);
  expect(pageScriptGzipBytes(distDir, "rehearse.html")).toBeLessThanOrEqual(BUDGET_BYTES);
}, 30_000);
