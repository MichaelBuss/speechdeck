#!/usr/bin/env node
// The release-guidance comment: one comment per PR, updated in place, that
// tells a human (or an AFK agent) what will ship: per @speechdeck/* package,
// which published files change, and what the PR's changesets say will ship,
// at which bump kind — plus a nudge when the body closes no issue.
// Informational only — it never fails a PR, the same philosophy that retired
// the /bump machinery (ADR 0022).

import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { jsrPackages } from "./jsr-packages.ts";

export type JsrPublish = {
  include: readonly string[];
  exclude?: readonly string[];
};

export type BumpKind = "patch" | "minor" | "major";

export type ChangesetEntry = {
  package: string;
  kind: BumpKind;
  note: string;
};

export type PackageInfo = {
  name: string;
  dir: string;
  publish: JsrPublish;
};

export function globMatch(pattern: string, file: string): boolean {
  const normalized = file.replaceAll("\\", "/").replace(/^\.\//, "");
  let rest = pattern;
  let source = "^";
  while (rest.length > 0) {
    if (rest.startsWith("**/")) {
      source += "(?:.*/)?";
      rest = rest.slice(3);
      continue;
    }
    if (rest === "**") {
      source += ".*";
      rest = "";
      continue;
    }
    if (rest.startsWith("**")) {
      source += ".*";
      rest = rest.slice(2);
      continue;
    }
    if (rest.startsWith("*")) {
      source += "[^/]*";
      rest = rest.slice(1);
      continue;
    }
    const ch = rest.at(0);
    if (ch === undefined) {
      break;
    }
    source += /[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
    rest = rest.slice(1);
  }
  return new RegExp(`${source}$`).test(normalized);
}

export function isPublishedPath(file: string, publish: JsrPublish): boolean {
  const normalized = file.replaceAll("\\", "/").replace(/^\.\//, "");
  const included = publish.include.some((pattern) => globMatch(pattern, normalized));
  if (!included) {
    return false;
  }
  return !(publish.exclude ?? []).some((pattern) => globMatch(pattern, normalized));
}

export function parseChangeset(content: string): ChangesetEntry[] {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content);
  if (match === null) {
    return [];
  }
  const [, frontmatter = "", body = ""] = match;
  const entries: ChangesetEntry[] = [];
  for (const line of frontmatter.split(/\r?\n/)) {
    const entry = /^\s*["']?([^"':]+)["']?:\s*(patch|minor|major)\s*$/.exec(line);
    if (entry !== null) {
      entries.push({
        package: entry[1]!.trim(),
        kind: entry[2] as BumpKind,
        note: body.trim(),
      });
    }
  }
  return entries;
}

export function closesIssue(body: string): boolean {
  return /\b(closes?|closed|fixes?|fixed|resolves?|resolved)\s*:?\s+#\d+/i.test(body);
}

function formatFiles(files: readonly string[]): string {
  if (files.length <= 8) {
    return files.join(", ");
  }
  const shown = files.slice(0, 8).join(", ");
  return `${shown}, and ${files.length - 8} more`;
}

// Files in the changed list that live inside a package and match its publish
// config, returned as repo-relative paths.
export function publishedFilesFor(pkg: PackageInfo, changedFiles: readonly string[]): string[] {
  const files: string[] = [];
  for (const file of changedFiles) {
    const normalized = file.replaceAll("\\", "/").replace(/^\.\//, "");
    const prefix = `${pkg.dir}/`;
    if (!normalized.startsWith(prefix)) {
      continue;
    }
    if (isPublishedPath(normalized.slice(prefix.length), pkg.publish)) {
      files.push(normalized);
    }
  }
  return files;
}

export type Guidance = {
  headline: string;
  markdown: string;
};

export function guidance(input: {
  changedFiles: readonly string[];
  packages: readonly PackageInfo[];
  changesets: readonly ChangesetEntry[];
  closesIssue: boolean;
}): Guidance {
  const lines: string[] = [];
  const headlines: string[] = [];
  let anyPublished = false;
  let anyChangeset = false;

  for (const pkg of input.packages) {
    const files = publishedFilesFor(pkg, input.changedFiles);
    const own = input.changesets.filter((entry) => entry.package === pkg.name);
    anyPublished = anyPublished || files.length > 0;
    anyChangeset = anyChangeset || own.length > 0;

    const parts: string[] = [`**${pkg.name}**`];
    if (files.length > 0) {
      parts.push(`published files change: ${formatFiles(files)}`);
    } else {
      parts.push("no published files change");
    }
    lines.push(parts.join(" — "));

    if (own.length > 0) {
      for (const entry of own) {
        lines.push(`  - Changeset: **${entry.kind}** — ${entry.note}`);
      }
    } else if (files.length > 0) {
      lines.push(
        `  - **No changeset yet — none of these changes will ship when this merges.** Add one with \`pnpm changeset\`, and write a note worth reading in a changelog. Assumed bump for a fix-shaped PR is **patch**; set it explicitly: \`patch\` for fixes, \`minor\` for new features, \`major\` for breaking changes.`,
      );
    } else {
      lines.push("  - No changeset, and none needed.");
    }
    if (own.length > 0 && files.length === 0) {
      lines.push("  - The changeset ships with the next release that touches published files.");
    }
  }

  if (anyChangeset) {
    const kinds = input.changesets.map((entry) => `${entry.kind} (${entry.package})`);
    headlines.push(`Changesets: ${kinds.join(", ")}`);
  }
  const withoutChangeset = input.packages
    .map((pkg) => ({
      pkg,
      files: publishedFilesFor(pkg, input.changedFiles),
    }))
    .filter(
      ({ pkg, files }) =>
        files.length > 0 && !input.changesets.some((entry) => entry.package === pkg.name),
    );
  if (withoutChangeset.length > 0) {
    headlines.push(
      `Published files change without a changeset in ${withoutChangeset.map(({ pkg }) => pkg.name).join(", ")}`,
    );
  }
  if (!anyPublished && !anyChangeset) {
    headlines.push("No published files change in this PR");
  }

  if (!input.closesIssue) {
    lines.push("");
    lines.push(
      "Nudge: the body doesn't close an issue. If this PR resolves one, adding `Closes #123` (its real number) links the release notes and the tracker together — never a gate, just a kindness to future readers.",
    );
  }

  return {
    headline: headlines.join("; "),
    markdown: lines.join("\n"),
  };
}

function isCliEntry(): boolean {
  const argv1 = process.argv[1];
  if (argv1 === undefined) {
    return false;
  }
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(argv1);
  } catch {
    return import.meta.url === pathToFileURL(resolve(argv1)).href;
  }
}

function flag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

async function writeGithubOutput(result: Guidance): Promise<void> {
  const path = process.env.GITHUB_OUTPUT;
  if (path === undefined) {
    return;
  }
  const block = [
    `headline=${result.headline}`,
    "detail<<EOF",
    result.headline,
    "EOF",
    "markdown<<EOF",
    result.markdown,
    "EOF",
    "",
  ].join("\n");
  await writeFile(path, block, { flag: "a" });
}

export async function releaseGuidanceCli(argv: readonly string[]): Promise<number> {
  const root = flag(argv, "--root") ?? ".";
  const changedPath = flag(argv, "--changed-files");
  const body = flag(argv, "--pr-body") ?? process.env.PR_BODY ?? "";
  if (changedPath === undefined) {
    process.stderr.write(
      "Usage: node scripts/release-guidance.ts --changed-files changed.txt [--root .] [--pr-body body.md]\n",
    );
    return 1;
  }
  const changedFiles = (await readFile(changedPath, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const packages: PackageInfo[] = [];
  for (const dirName of jsrPackages) {
    const jsrPath = join(root, "packages", dirName, "jsr.json");
    try {
      const jsr = JSON.parse(await readFile(jsrPath, "utf8")) as {
        name: string;
        publish: JsrPublish;
      };
      packages.push({ name: jsr.name, dir: `packages/${dirName}`, publish: jsr.publish });
    } catch {
      continue;
    }
  }
  const changesets: ChangesetEntry[] = [];
  for (const file of changedFiles) {
    if (!/^\.changeset\/[^/]+\.md$/.test(file) || file.endsWith("README.md")) {
      continue;
    }
    let content: string;
    try {
      content = await readFile(join(root, file), "utf8");
    } catch {
      continue;
    }
    changesets.push(...parseChangeset(content));
  }
  const result = guidance({
    changedFiles,
    packages,
    changesets,
    closesIssue: closesIssue(body),
  });
  await writeGithubOutput(result);
  process.stdout.write(`${result.markdown}\n`);
  return 0;
}

if (isCliEntry()) {
  process.exitCode = await releaseGuidanceCli(process.argv.slice(2));
}
