#!/usr/bin/env node
// The version-sync invariant: each package's package.json is its version's
// single source of truth; its jsr.json always carries the identical version
// after this script runs. Changesets only writes package.json, so `pnpm run
// version` chains this after `changeset version`. The pnpm lockfile needs no
// sync: workspace deps use `workspace:*`, which no version bump invalidates.

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

export type SyncResult = {
  jsr: Map<string, Versioned>;
  changed: readonly string[];
};

export function syncVersions(
  packages: readonly { name: string; pkg: Versioned; jsr: Versioned }[],
): SyncResult {
  const jsr = new Map<string, Versioned>();
  const changed: string[] = [];
  for (const item of packages) {
    const next = { ...item.jsr };
    if (item.jsr.version !== item.pkg.version) {
      next.version = item.pkg.version;
      changed.push(`packages/${item.name}/jsr.json`);
    }
    jsr.set(item.name, next);
  }
  return { jsr, changed };
}

export async function syncVersionsCli(): Promise<number> {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const packages: { name: string; pkg: Versioned; jsr: Versioned }[] = [];
  for (const name of jsrPackages) {
    const pkg = JSON.parse(
      await readFile(join(root, "packages", name, "package.json"), "utf8"),
    ) as Versioned;
    const jsr = JSON.parse(
      await readFile(join(root, "packages", name, "jsr.json"), "utf8"),
    ) as Versioned;
    packages.push({ name, pkg, jsr });
  }
  const result = syncVersions(packages);
  for (const name of jsrPackages) {
    const next = result.jsr.get(name);
    if (next === undefined) {
      continue;
    }
    await writeFile(join(root, "packages", name, "jsr.json"), `${JSON.stringify(next, null, 2)}\n`);
  }
  process.stdout.write(
    result.changed.length === 0
      ? `All jsr.json manifests agree with their package.json\n`
      : `Synced ${result.changed.join(", ")} to their package.json versions\n`,
  );
  return 0;
}

if (isCliEntry()) {
  process.exitCode = await syncVersionsCli();
}
