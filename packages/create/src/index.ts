import { cancel, intro, isCancel, outro, select, text } from "@clack/prompts";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export type Starter = "skeleton" | "empty";
export type Existing = "fail" | "overwrite";

export type InitOptions = {
  directory?: string;
  starter?: Starter;
  theme?: string;
  yes?: boolean;
  existing?: Existing;
};

const DEFAULT_DIRECTORY = ".";
const DEFAULT_STARTER: Starter = "empty";
const DEFAULT_THEME = "@speechdeck/themes/harbour";
const DEFAULT_EXISTING: Existing = "fail";

const SPEECHDECK_VERSION = "0.0.0";
const SOLID_VERSION = "^1.9.15";
const VITE_VERSION = "^8.2.2";
const TYPESCRIPT_VERSION = "^7.0.2";

const THEME_OPTIONS = [
  { value: "@speechdeck/themes/harbour", label: "Harbour" },
  { value: "@speechdeck/themes/ink", label: "Ink" },
  { value: "@speechdeck/themes/signal", label: "Signal" },
] as const;

const STARTER_OPTIONS = [
  { value: "skeleton", label: "Skeleton" },
  { value: "empty", label: "Empty" },
] as const;

class CancelledError extends Error {
  constructor() {
    super("Cancelled.");
  }
}

type Resolved = {
  directory: string;
  starter: Starter;
  theme: string;
  existing: Existing;
};

function isInteractive(options: InitOptions): boolean {
  if (options.yes === true) return false;
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

function applyDefaults(options: InitOptions): Resolved {
  return {
    directory: options.directory ?? DEFAULT_DIRECTORY,
    starter: options.starter ?? DEFAULT_STARTER,
    theme: options.theme ?? DEFAULT_THEME,
    existing: options.existing ?? DEFAULT_EXISTING,
  };
}

async function promptMissing(options: InitOptions): Promise<Resolved> {
  intro("@speechdeck/create");

  let directory = options.directory;
  if (directory === undefined) {
    const answer = await text({
      message: "Directory",
      placeholder: DEFAULT_DIRECTORY,
      defaultValue: DEFAULT_DIRECTORY,
    });
    if (isCancel(answer)) {
      cancel("Cancelled.");
      throw new CancelledError();
    }
    directory = answer;
  }

  let starter = options.starter;
  if (starter === undefined) {
    const answer = await select({ message: "Starter", options: [...STARTER_OPTIONS] });
    if (isCancel(answer)) {
      cancel("Cancelled.");
      throw new CancelledError();
    }
    starter = answer;
  }

  let theme = options.theme;
  if (theme === undefined) {
    const answer = await select({
      message: "Theme",
      options: [...THEME_OPTIONS],
      initialValue: DEFAULT_THEME,
    });
    if (isCancel(answer)) {
      cancel("Cancelled.");
      throw new CancelledError();
    }
    theme = answer;
  }

  outro("Scaffolding your Deck...");

  return { directory, starter, theme, existing: options.existing ?? DEFAULT_EXISTING };
}

function projectName(directory: string): string {
  const name = basename(resolve(directory));
  return name === "" || name === "." ? "speechdeck-app" : name;
}

type ScaffoldFile = { path: string; content: string };

function packageJsonFile(name: string): ScaffoldFile {
  const json = {
    name,
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
      inspect: "SPEECHDECK_INSPECT=1 vite",
    },
    dependencies: {
      "@speechdeck/core": SPEECHDECK_VERSION,
      "@speechdeck/solid": SPEECHDECK_VERSION,
      "@speechdeck/themes": SPEECHDECK_VERSION,
      "solid-js": SOLID_VERSION,
    },
    devDependencies: {
      vite: VITE_VERSION,
      typescript: TYPESCRIPT_VERSION,
    },
    intent: {
      skills: ["@speechdeck/*"],
    },
  };
  return { path: "package.json", content: `${JSON.stringify(json, null, 2)}\n` };
}

function viteConfigFile(): ScaffoldFile {
  return {
    path: "vite.config.ts",
    content: `import { resolve } from "node:path";
import { defineConfig } from "vite";

// Inspect is gated (ADR 0014): \`pnpm inspect\` sets SPEECHDECK_INSPECT=1, so only that
// build (or that dev server) ever registers inspect.html. Default \`pnpm dev\` / \`vite
// build\` omit it.
const input: Record<string, string> = {
  main: resolve(import.meta.dirname, "index.html"),
  rehearse: resolve(import.meta.dirname, "rehearse.html"),
};
if (process.env.SPEECHDECK_INSPECT === "1") {
  input.inspect = resolve(import.meta.dirname, "inspect.html");
}

export default defineConfig({
  build: {
    rollupOptions: {
      input,
    },
  },
});
`,
  };
}

function htmlFile(path: string, title: string, entry: string): ScaffoldFile {
  return {
    path,
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/${entry}"></script>
  </body>
</html>
`,
  };
}

function viteEnvFile(): ScaffoldFile {
  return { path: "src/vite-env.d.ts", content: `/// <reference types="vite/client" />\n` };
}

function tsconfigFile(): ScaffoldFile {
  const json = {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      noEmit: true,
      verbatimModuleSyntax: true,
      noUncheckedIndexedAccess: true,
      skipLibCheck: true,
      allowImportingTsExtensions: true,
    },
    include: ["src"],
  };
  return { path: "tsconfig.json", content: `${JSON.stringify(json, null, 2)}\n` };
}

function deckModuleFile(theme: string): ScaffoldFile {
  return {
    path: "src/deck.ts",
    content: `import { parseDeck, type FileMap } from "@speechdeck/core";
import deckSource from "../deck.md?raw";
import themeJson from "${theme}/theme.json?raw";

const files: FileMap = {
  read(relative) {
    if (relative === "${theme}/theme.json") return themeJson;
    throw new Error(\`Cannot resolve "\${relative}"\`);
  },
};

export const { deck } = parseDeck(deckSource, files);
`,
  };
}

function mainFile(): ScaffoldFile {
  return {
    path: "src/main.ts",
    content: `import "@speechdeck/solid/style.css";
import { Present } from "@speechdeck/solid";
import { deck } from "./deck.ts";

const app = document.querySelector<HTMLDivElement>("#app");
if (app === null) throw new Error("Missing #app element");
app.replaceChildren(Present({ deck }) as unknown as Node);
`,
  };
}

function rehearseFile(): ScaffoldFile {
  return {
    path: "src/rehearse.ts",
    content: `import "@speechdeck/solid/style.css";
import { Rehearse } from "@speechdeck/solid";
import { deck } from "./deck.ts";

const app = document.querySelector<HTMLDivElement>("#app");
if (app === null) throw new Error("Missing #app element");
app.replaceChildren(Rehearse({ deck }) as unknown as Node);
`,
  };
}

function inspectFile(): ScaffoldFile {
  return {
    path: "src/inspect.ts",
    content: `import "@speechdeck/solid/style.css";
import { Inspect } from "@speechdeck/solid";
import { deck } from "./deck.ts";

const app = document.querySelector<HTMLDivElement>("#app");
if (app === null) throw new Error("Missing #app element");
app.replaceChildren(Inspect({ deck }) as unknown as Node);
`,
  };
}

function deckMarkdownFile(theme: string, starter: Starter): ScaffoldFile {
  const cover = `# My Talk

This is your Speech — it stays with you. The audience only sees the heading above.`;
  const section = `## Thanks for listening

Say something here before you take questions.`;
  const body = starter === "skeleton" ? `${cover}\n\n---\n\n${section}` : cover;
  return {
    path: "deck.md",
    content: `---
theme: ${theme}
---

${body}
`,
  };
}

function agentsFile(): ScaffoldFile {
  return {
    path: "AGENTS.md",
    content: `# AGENTS

<!-- speechdeck:intent-skills -->
This project's Agent Skills are declared in \`package.json\` (\`intent.skills: ["@speechdeck/*"]\`)
and load from each matching package's \`skills/\` directory in \`node_modules\` via TanStack Intent.
<!-- /speechdeck:intent-skills -->
`,
  };
}

function gitignoreFile(): ScaffoldFile {
  return { path: ".gitignore", content: `node_modules\ndist\n` };
}

function scaffoldFiles(resolved: Resolved): readonly ScaffoldFile[] {
  return [
    packageJsonFile(projectName(resolved.directory)),
    viteConfigFile(),
    tsconfigFile(),
    htmlFile("index.html", "My Talk", "src/main.ts"),
    htmlFile("rehearse.html", "My Talk — Rehearse", "src/rehearse.ts"),
    htmlFile("inspect.html", "My Talk — Inspect", "src/inspect.ts"),
    viteEnvFile(),
    deckModuleFile(resolved.theme),
    mainFile(),
    rehearseFile(),
    inspectFile(),
    deckMarkdownFile(resolved.theme, resolved.starter),
    agentsFile(),
    gitignoreFile(),
  ];
}

function assertWritable(dir: string, existing: Existing): void {
  if (!existsSync(dir)) return;
  if (readdirSync(dir).length === 0) return;
  if (existing === "overwrite") return;
  throw new Error(
    `"${dir}" already exists and is not empty; pass --existing overwrite to overwrite it.`,
  );
}

export async function init(options: InitOptions = {}): Promise<void> {
  const resolved = isInteractive(options) ? await promptMissing(options) : applyDefaults(options);

  const dir = resolve(resolved.directory);
  assertWritable(dir, resolved.existing);

  for (const file of scaffoldFiles(resolved)) {
    const target = join(dir, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content);
  }
}
