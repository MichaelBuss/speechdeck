#!/usr/bin/env node
// The version-sync invariant: each package's package.json is its version's
// single source of truth; its jsr.json always carries the identical version
// after this script runs. Changesets only writes package.json, so `pnpm run
// version` chains this after `changeset version`. The pnpm lockfile needs no
// sync: workspace deps use `workspace:*`, which no version bump invalidates.
// The jsr.json update is a targeted text replacement, not a parse→stringify
// round-trip: the round-trip reflows every array onto its own lines, which
// oxfmt rejects and the Version Packages PR's CI would fail on.

import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { jsrPackages } from "./jsr-packages.ts";

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

export type Versioned = { version: string };

export function staleJsrVersions(
  packages: readonly { name: string; pkg: Versioned; jsr: Versioned }[],
): string[] {
  return packages
    .filter(({ pkg, jsr }) => jsr.version !== pkg.version)
    .map(({ name }) => `packages/${name}/jsr.json`);
}

export function replaceVersion(source: string, from: string, to: string): string {
  const needle = `"version": "${from}"`;
  const next = `"version": "${to}"`;
  const matches = source.split(needle).length - 1;
  if (matches !== 1) {
    throw new Error(
      `Expected exactly one ${needle} in a jsr.json manifest, found ${matches}; fix that first.`,
    );
  }
  return source.replace(needle, next);
}

export async function syncVersionsCli(): Promise<number> {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const changed: string[] = [];
  for (const name of jsrPackages) {
    const jsrPath = join(root, "packages", name, "jsr.json");
    const pkg = JSON.parse(
      await readFile(join(root, "packages", name, "package.json"), "utf8"),
    ) as Versioned;
    const jsrText = await readFile(jsrPath, "utf8");
    const jsr = JSON.parse(jsrText) as Versioned;
    if (jsr.version === pkg.version) {
      continue;
    }
    await writeFile(jsrPath, replaceVersion(jsrText, jsr.version, pkg.version));
    changed.push(`packages/${name}/jsr.json`);
  }
  process.stdout.write(
    changed.length === 0
      ? `All jsr.json manifests agree with their package.json\n`
      : `Synced ${changed.join(", ")} to their package.json versions\n`,
  );
  return 0;
}

if (isCliEntry()) {
  process.exitCode = await syncVersionsCli();
}
