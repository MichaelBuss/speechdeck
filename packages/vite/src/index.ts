import { parseDeck, type CodeBlock, type Deck, type FileMap } from "@speechdeck/core";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { codeToHtml, createCssVariablesTheme } from "shiki";
import type { Plugin } from "vite";

const DEFAULT_DECK = "deck.md";
const INSPECT_ENTRY = "/inspect.html";

/** Highlighting is not in core: Shiki runs here, at build, with a CSS-variables theme so a
 *  Theme package paints tokens rather than Shiki baking in fixed colours. */
const CSS_VARIABLES_THEME = createCssVariablesTheme({
  name: "speechdeck-css-variables",
  variablePrefix: "--shiki-",
});

function createFileMap(baseDir: string): FileMap {
  const require = createRequire(resolvePath(baseDir, "package.json"));
  return {
    read(relative) {
      const path =
        relative.startsWith("./") || relative.startsWith("../")
          ? resolvePath(baseDir, relative)
          : require.resolve(relative);
      return readFileSync(path, "utf8");
    },
  };
}

function* codeBlocks(deck: Deck): Generator<CodeBlock> {
  for (const slide of deck.slides) {
    for (const cell of slide.cells) {
      for (const block of cell.blocks) {
        if (block.kind === "code") yield block;
      }
    }
  }
}

async function highlightCode(deck: Deck): Promise<void> {
  for (const block of codeBlocks(deck)) {
    try {
      block.html = await codeToHtml(block.source.bytes, {
        lang: block.lang === "" ? "text" : block.lang,
        theme: CSS_VARIABLES_THEME,
      });
    } catch {
      // An unrecognized language keeps core's escaped fallback rather than failing the build.
    }
  }
}

/**
 * Transforms the Deck markdown file into a JS module exporting its parsed, Shiki-highlighted
 * Deck. The presenter edits the Deck and any file-backed code in their editor; `vite dev`
 * HMR picks up both because every referenced file is a watched dependency of this transform.
 */
export function speechdeck(options: { deck?: string } = {}): Plugin {
  const deckOption = options.deck ?? DEFAULT_DECK;
  let root = process.cwd();

  return {
    name: "speechdeck",
    configResolved(config) {
      root = config.root;
    },
    /** Inspect is gated (ADR 0014): the dev server otherwise serves inspect.html like any
     *  other static file, so a default `vite dev` must 404 it. The gate reads the same
     *  process env var `pnpm inspect` sets — there is no plugin `inspect: true` option,
     *  which would bake the gate open in config instead. */
    configureServer(server) {
      if (process.env["SPEECHDECK_INSPECT"] === "1") return;
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] === INSPECT_ENTRY) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }
        next();
      });
    },
    async transform(code, id) {
      const target = resolvePath(root, deckOption);
      const [idPath] = id.split("?");
      if (idPath === undefined || resolvePath(idPath) !== target) return;

      const deckDir = dirname(target);
      const files = createFileMap(deckDir);
      const { deck, diagnostics } = parseDeck(code, files);

      this.addWatchFile(target);
      for (const block of codeBlocks(deck)) {
        if (block.source.from === "file")
          this.addWatchFile(resolvePath(deckDir, block.source.path));
      }
      for (const diagnostic of diagnostics) this.warn(diagnostic.message);

      await highlightCode(deck);

      return {
        code: `export const deck = ${JSON.stringify(deck)};\nexport const diagnostics = ${JSON.stringify(diagnostics)};\n`,
        map: null,
      };
    },
  };
}
