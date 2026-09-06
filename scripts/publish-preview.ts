#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { jsrPackages } from "./jsr-packages.ts";

export type JsrPublish = {
  include: readonly string[];
  exclude?: readonly string[];
};

export type JsrMeta = {
  latest?: string;
  versions?: Record<string, unknown>;
};

export type PreviewKind = "ready" | "no-changes" | "needs-bump";

export type PublishPreview = {
  kind: PreviewKind;
  willPublish: boolean;
  headline: string;
  detail: string;
  markdown: string;
};

export type PackageInput = {
  dir: string;
  name: string;
  localVersion: string;
  publishedVersions: readonly string[];
  publish: JsrPublish;
};

const bumpFyi: string =
  "(FYI: comment `/bump` (patch, the default), `/bump minor`, or `/bump major` on any PR to bump the version and ship its published-file changes.)";

const bumpInvite: string =
  "No pressure — this is just informational, merging will not fail. Comment `/bump` (patch, the default), `/bump minor`, or `/bump major` on this PR whenever you want these changes to ship, and it will push the version bump to this branch.";

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

export function publishedVersions(meta: JsrMeta): string[] {
  const versions = new Set(Object.keys(meta.versions ?? {}));
  if (meta.latest !== undefined && meta.latest !== "") {
    versions.add(meta.latest);
  }
  return [...versions];
}

export function fileInPackage(pkgDir: string, file: string): string | undefined {
  const dir = pkgDir.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
  const normalized = file.replaceAll("\\", "/").replace(/^\.\//, "");
  if (normalized === dir) {
    return "";
  }
  const prefix = `${dir}/`;
  if (!normalized.startsWith(prefix)) {
    return undefined;
  }
  return normalized.slice(prefix.length);
}

function formatFiles(files: readonly string[]): string {
  if (files.length <= 8) {
    return files.join(", ");
  }
  const shown = files.slice(0, 8).join(", ");
  return `${shown}, and ${files.length - 8} more`;
}

export function previewPublish(input: {
  name: string;
  localVersion: string;
  publishedVersions: readonly string[];
  changedFiles: readonly string[];
  publish: JsrPublish;
}): PublishPreview {
  const packageFiles = input.changedFiles.filter((file) => isPublishedPath(file, input.publish));
  const alreadyPublished = input.publishedVersions.includes(input.localVersion);
  const pkg = `${input.name}@${input.localVersion}`;
  const fileList = formatFiles(packageFiles);

  if (!alreadyPublished) {
    const headline = `Ready to ship ${input.localVersion}`;
    const detail = `${pkg} is not on JSR yet; merging this PR will publish it.`;
    return {
      kind: "ready",
      willPublish: true,
      headline,
      detail,
      markdown: `**Ready to ship.** \`${pkg}\` is not on JSR yet; merging this PR will publish it.`,
    };
  }

  if (packageFiles.length === 0) {
    const headline = "No package changes";
    const detail = `${pkg} is already on JSR, and this PR does not change published files.`;
    return {
      kind: "no-changes",
      willPublish: false,
      headline,
      detail,
      markdown: `**No package changes.** \`${pkg}\` is already on JSR, and this PR does not change published files.

${bumpFyi}`,
    };
  }

  const headline = "Will not publish until bumped";
  const detail = `${pkg} is already on JSR. Published files changed (${fileList}); merging as-is will not publish them.`;
  return {
    kind: "needs-bump",
    willPublish: false,
    headline,
    detail,
    markdown: `**Will not publish until bumped.** \`${pkg}\` is already on JSR.

Published files in this PR: ${fileList}.

${bumpInvite}`,
  };
}

function previewPackage(
  pkg: PackageInput,
  changedFiles: readonly string[],
): PublishPreview & { name: string; files: string[] } {
  const relative: string[] = [];
  const repoPaths: string[] = [];
  for (const file of changedFiles) {
    const inner = fileInPackage(pkg.dir, file);
    if (inner === undefined || inner === "") {
      continue;
    }
    relative.push(inner);
    if (isPublishedPath(inner, pkg.publish)) {
      repoPaths.push(file.replaceAll("\\", "/").replace(/^\.\//, ""));
    }
  }
  const result = previewPublish({
    name: pkg.name,
    localVersion: pkg.localVersion,
    publishedVersions: pkg.publishedVersions,
    changedFiles: relative,
    publish: pkg.publish,
  });
  return { ...result, name: pkg.name, files: repoPaths };
}

export function previewWorkspace(
  packages: readonly PackageInput[],
  changedFiles: readonly string[],
): PublishPreview {
  const previews = packages.map((pkg) => previewPackage(pkg, changedFiles));
  const waiting = previews.filter((item) => item.kind === "needs-bump");
  const ready = previews.filter((item) => item.kind === "ready");
  if (waiting.length > 0) {
    const files = waiting.flatMap((item) => item.files);
    const names = waiting.map(
      (item) => `\`${item.name}@${packages.find((pkg) => pkg.name === item.name)?.localVersion}\``,
    );
    const pkgList = names.join(", ");
    const fileList = formatFiles(files);
    const readyNote =
      ready.length === 0
        ? ""
        : `\n\nAlso ready to ship (new version, not on JSR yet): ${ready.map((item) => `\`${item.name}\``).join(", ")}.`;
    return {
      kind: "needs-bump",
      willPublish: ready.length > 0,
      headline: "Will not publish until bumped",
      detail: `${pkgList} already on JSR. Published files changed (${fileList}); merging as-is will not publish them.`,
      markdown: `**Will not publish until bumped.** ${pkgList} ${waiting.length === 1 ? "is" : "are"} already on JSR.

Published files in this PR: ${fileList}.${readyNote}

${bumpInvite}`,
    };
  }
  if (ready.length > 0) {
    const version = packages.find((pkg) => pkg.name === ready[0]?.name)?.localVersion ?? "";
    const names = ready.map((item) => `\`${item.name}@${version}\``).join(", ");
    const headline = `Ready to ship ${version}`;
    const detail = `${names} ${ready.length === 1 ? "is" : "are"} not on JSR yet; merging this PR will publish ${ready.length === 1 ? "it" : "them"}.`;
    return {
      kind: "ready",
      willPublish: true,
      headline,
      detail,
      markdown: `**Ready to ship.** ${names} ${ready.length === 1 ? "is" : "are"} not on JSR yet; merging this PR will publish ${ready.length === 1 ? "it" : "them"}.`,
    };
  }
  const version = packages[0]?.localVersion ?? "";
  const pkg = `@speechdeck/*@${version}`;
  return {
    kind: "no-changes",
    willPublish: false,
    headline: "No package changes",
    detail: `${pkg} is already on JSR, and this PR does not change published files.`,
    markdown: `**No package changes.** \`${pkg}\` is already on JSR, and this PR does not change published files.

${bumpFyi}`,
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

async function writeGithubOutput(result: PublishPreview): Promise<void> {
  const path = process.env.GITHUB_OUTPUT;
  if (path === undefined) {
    return;
  }
  const block = [
    `headline=${result.headline}`,
    `willPublish=${result.willPublish}`,
    "detail<<EOF",
    result.detail,
    "EOF",
    "markdown<<EOF",
    result.markdown,
    "EOF",
    "",
  ].join("\n");
  await writeFile(path, block, { flag: "a" });
}

export async function publishPreviewCli(argv: readonly string[]): Promise<number> {
  const root = flag(argv, "--root") ?? ".";
  const metaDir = flag(argv, "--meta-dir");
  const changedPath = flag(argv, "--changed-files");
  if (metaDir === undefined || changedPath === undefined) {
    process.stderr.write(
      "Usage: node scripts/publish-preview.ts --changed-files changed.txt --meta-dir /tmp/jsr-meta [--root .]\n",
    );
    return 1;
  }
  const changedFiles = (await readFile(changedPath, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const packages: PackageInput[] = [];
  for (const dirName of jsrPackages) {
    const dir = join("packages", dirName);
    const jsr = JSON.parse(await readFile(join(root, dir, "jsr.json"), "utf8")) as {
      name: string;
      version: string;
      publish: JsrPublish;
    };
    const meta = JSON.parse(await readFile(join(metaDir, `${dirName}.json`), "utf8")) as JsrMeta;
    packages.push({
      dir,
      name: jsr.name,
      localVersion: jsr.version,
      publishedVersions: publishedVersions(meta),
      publish: jsr.publish,
    });
  }
  const result = previewWorkspace(packages, changedFiles);
  await writeGithubOutput(result);
  process.stdout.write(`${result.markdown}\n`);
  return 0;
}

if (isCliEntry()) {
  process.exitCode = await publishPreviewCli(process.argv.slice(2));
}
