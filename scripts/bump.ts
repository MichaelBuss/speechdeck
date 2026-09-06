#!/usr/bin/env node
import { existsSync, realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { jsrPackages } from "./jsr-packages.ts";

export const bumpUsage: string = `Usage: pnpm bump -- [patch | minor | major | <x.y.z>] [--baseline <x.y.z>]

Updates every package's package.json and jsr.json together (lockstep).
--baseline bumps from whichever is higher: the local version, or the
given one (e.g. origin/main's, in case this branch is behind).
Does not commit or tag. Default is patch.
`;

const bumpKinds = ["major", "minor", "patch"] as const;
export type BumpKind = (typeof bumpKinds)[number];

export class BumpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BumpError";
  }
}

function isBumpKind(spec: string): spec is BumpKind {
  return (bumpKinds as readonly string[]).includes(spec);
}

function parseSemver(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match === null) {
    throw new BumpError(`Not a semver x.y.z: ${version}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function higherVersion(a: string, b: string): string {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) {
      return pa[i]! > pb[i]! ? a : b;
    }
  }
  return a;
}

export function parseBumpSpec(argv: readonly string[]): string {
  if (argv.length === 0) {
    return "patch";
  }
  if (argv.length !== 1) {
    throw new BumpError(bumpUsage.trimEnd());
  }
  const [arg] = argv;
  if (arg === undefined) {
    throw new BumpError(bumpUsage.trimEnd());
  }
  if (arg === "-h" || arg === "--help") {
    throw new BumpError(bumpUsage.trimEnd());
  }
  const spec = arg.startsWith("--") ? arg.slice(2) : arg;
  if (isBumpKind(spec)) {
    return spec;
  }
  parseSemver(spec);
  return spec;
}

export function nextVersion(current: string, spec = "patch"): string {
  if (isBumpKind(spec)) {
    const [major, minor, patch] = parseSemver(current);
    if (spec === "major") {
      return `${major + 1}.0.0`;
    }
    if (spec === "minor") {
      return `${major}.${minor + 1}.0`;
    }
    return `${major}.${minor}.${patch + 1}`;
  }
  parseSemver(spec);
  if (spec === current) {
    throw new BumpError(`Already at ${current}`);
  }
  return spec;
}

type Versioned = { version: string };

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export function replaceVersion(source: string, from: string, to: string): string {
  const needle = `"version": "${from}"`;
  const next = `"version": "${to}"`;
  const matches = source.split(needle).length - 1;
  if (matches !== 1) {
    throw new BumpError(
      `Expected exactly one ${needle} in a manifest, found ${matches}; fix that first.`,
    );
  }
  return source.replace(needle, next);
}

export async function bump(
  root: string,
  spec = "patch",
  baseline?: string,
): Promise<{ from: string; to: string }> {
  const manifests: { pkgPath: string; jsrPath: string; pkg: Versioned; jsr: Versioned }[] = [];
  for (const name of jsrPackages) {
    const dir = join(root, "packages", name);
    const pkgPath = join(dir, "package.json");
    const jsrPath = join(dir, "jsr.json");
    if (!existsSync(pkgPath) || !existsSync(jsrPath)) {
      throw new BumpError(`Missing package.json or jsr.json in packages/${name}`);
    }
    const pkg = await readJson<Versioned>(pkgPath);
    const jsr = await readJson<Versioned>(jsrPath);
    if (pkg.version !== jsr.version) {
      throw new BumpError(
        `packages/${name}: package.json (${pkg.version}) and jsr.json (${jsr.version}) disagree; fix that first.`,
      );
    }
    manifests.push({ pkgPath, jsrPath, pkg, jsr });
  }
  const versions = new Set(manifests.map((item) => item.pkg.version));
  if (versions.size !== 1) {
    throw new BumpError(
      `JSR packages are not lockstep (${[...versions].join(", ")}); fix that first.`,
    );
  }
  const from = manifests[0]?.pkg.version;
  if (from === undefined) {
    throw new BumpError("No JSR packages found");
  }
  // A branch's own version can be stale relative to origin/main (e.g. another
  // PR bumped and merged after this branch was cut), so bump from whichever
  // is higher rather than trusting the checked-out files blindly.
  const base = baseline === undefined ? from : higherVersion(from, baseline);
  const to = nextVersion(base, spec);
  for (const item of manifests) {
    await writeFile(item.pkgPath, replaceVersion(await readFile(item.pkgPath, "utf8"), from, to));
    await writeFile(item.jsrPath, replaceVersion(await readFile(item.jsrPath, "utf8"), from, to));
  }
  return { from, to };
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

export function extractBaseline(argv: readonly string[]): {
  rest: string[];
  baseline?: string;
} {
  const index = argv.indexOf("--baseline");
  if (index === -1) {
    return { rest: [...argv] };
  }
  const value = argv[index + 1];
  if (value === undefined) {
    throw new BumpError("--baseline requires a version argument");
  }
  return { rest: [...argv.slice(0, index), ...argv.slice(index + 2)], baseline: value };
}

export async function bumpCli(argv: readonly string[]): Promise<number> {
  const [arg] = argv;
  if (arg === "-h" || arg === "--help") {
    process.stdout.write(bumpUsage);
    return 0;
  }
  try {
    const { rest, baseline } = extractBaseline(argv);
    const spec = parseBumpSpec(rest);
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const { from, to } =
      baseline === undefined ? await bump(root, spec) : await bump(root, spec, baseline);
    process.stdout.write(`${from} → ${to}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

if (isCliEntry()) {
  process.exitCode = await bumpCli(process.argv.slice(2));
}
