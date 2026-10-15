#!/usr/bin/env node
// The release script: the one place a version ships. The changesets GitHub
// Action runs it on every push to main that has no pending changesets — i.e.
// right after the Version Packages PR merges — but any other main merge lands
// here too, so everything is idempotent: a version already on a registry is
// skipped, the tag and GitHub Release are only created when missing. Each
// @speechdeck/* package publishes to both registries: npm via trusted
// publishing (OIDC, --provenance) and JSR via OIDC. JSR does not understand
// pnpm's `workspace:*` protocol, and npm refuses to publish it, so sibling
// deps are pinned per registry for the publish (npm: `^x.y.z`; JSR: its
// npm-compat specifier `npm:@jsr/speechdeck__core@x.y.z`) and package.json is
// restored after. The registries ship independently: a failure at one package
// or registry does not block the others, and every failure is reported before
// the run goes red. When npm publishing is not configured yet, the failure is
// instructive: exact human setup steps, never a silent skip, never an opaque
// error. `--bootstrap` publishes the current versions to npm under the local
// npm login (no OIDC) so the packages exist and Trusted Publishing can be
// configured — the one-time human step; `--dry-run` exercises both packing
// paths without publishing anything.

import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { jsrPackages } from "./jsr-packages.ts";

export type JsrMeta = {
  latest?: string;
  versions?: Record<string, unknown>;
};

export type WorkspacePackage = { dir: string; name: string; version: string };

export type ReleasePlan = { npm: boolean; jsr: boolean };

export type RegistryTarget = "npm" | "jsr";

export function publishedVersions(meta: JsrMeta): string[] {
  const versions = new Set(Object.keys(meta.versions ?? {}));
  if (meta.latest !== undefined && meta.latest !== "") {
    versions.add(meta.latest);
  }
  return [...versions];
}

export function planRelease(input: {
  version: string;
  npmVersions: readonly string[];
  jsrVersions: readonly string[];
}): ReleasePlan {
  return {
    npm: !input.npmVersions.includes(input.version),
    jsr: !input.jsrVersions.includes(input.version),
  };
}

export function isNpmSetupError(stderr: string): boolean {
  return /E404|E403|ENEEDAUTH|402 Payment Required|403 Forbidden|404 Not Found|not have permission/.test(
    stderr,
  );
}

export function isNpmAlreadyPublished(stderr: string): boolean {
  return /E409|cannot publish over|previously published/i.test(stderr);
}

export function npmSetupInstructions(name: string, version: string): string {
  return `npm refused to publish ${name}@${version} — trusted publishing is not configured yet. A human needs to:

1. Claim the \`@speechdeck\` scope on npmjs.com (create the org if it does not exist).
2. Publish the package once (\`node scripts/release.ts --bootstrap\` does this for all five from a machine where \`npm login\` has been run) and configure **Trusted Publishing** for it: registry.npmjs.org, GitHub, repository \`MichaelBuss/speechdeck\`, workflow \`.github/workflows/publish.yml\`, with **Allow npm publish** ticked.
3. Re-run the failed release workflow — it skips anything already published and finishes the rest.`;
}

// JSR's npm-compat layer serves packages under `@jsr/speechdeck__core`-style
// names, so a JSR publish pins siblings there; npm takes a caret range.
export function workspaceSpec(name: string, version: string, target: RegistryTarget): string {
  return target === "jsr"
    ? `npm:@jsr/${name.slice(1).replace("/", "__")}@${version}`
    : `^${version}`;
}

export type Deps = Record<string, string>;

export function pinDeps(
  deps: Deps | undefined,
  versionsByName: ReadonlyMap<string, string>,
  target: RegistryTarget,
): { deps: Deps; touched: boolean } {
  const next: Deps = { ...deps };
  let touched = false;
  for (const [name, value] of Object.entries(next)) {
    if (!value.startsWith("workspace:")) {
      continue;
    }
    const version = versionsByName.get(name);
    if (version === undefined) {
      throw new Error(`${name} is pinned via workspace: but no sibling package was found`);
    }
    next[name] = workspaceSpec(name, version, target);
    touched = true;
  }
  return { deps: next, touched };
}

type PackageJson = {
  name: string;
  version: string;
  dependencies?: Deps;
  peerDependencies?: Deps;
  devDependencies?: Deps;
};

// Rewrites every `workspace:*` sibling dep to the registry-appropriate
// specifier. Returns the original text so the caller can restore it after
// publishing — package.json on disk is never left pinned.
export function pinManifest(
  original: string,
  versionsByName: ReadonlyMap<string, string>,
  target: RegistryTarget,
): string {
  const pkg = JSON.parse(original) as PackageJson;
  let touched = false;
  for (const section of ["dependencies", "peerDependencies", "devDependencies"] as const) {
    const result = pinDeps(pkg[section], versionsByName, target);
    if (result.touched) {
      pkg[section] = result.deps;
      touched = true;
    }
  }
  return touched ? `${JSON.stringify(pkg, null, 2)}\n` : original;
}

async function readWorkspacePackages(root: string): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];
  for (const dir of jsrPackages) {
    const path = join(root, "packages", dir, "package.json");
    if (!existsSync(path)) {
      continue;
    }
    const pkg = JSON.parse(await readFile(path, "utf8")) as PackageJson;
    if (typeof pkg.name === "string" && typeof pkg.version === "string") {
      packages.push({ dir: join("packages", dir), name: pkg.name, version: pkg.version });
    }
  }
  return packages;
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

type ShResult = { status: number; stdout: string; stderr: string };

function sh(command: string, args: readonly string[], cwd?: string, interactive = false): ShResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    cwd,
    stdio: interactive ? "inherit" : undefined,
  });
  if (interactive) {
    // With inherited stdio npm drives the 2FA browser flow itself; there is
    // no captured output to return.
    return { status: result.status ?? 1, stdout: "", stderr: "" };
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function npmVersions(name: string): Promise<string[] | undefined> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await sleep(attempt * 2000);
    }
    const result = sh("npm", ["view", name, "versions", "--json"]);
    if (result.status !== 0) {
      if (isNpmSetupError(result.stderr)) {
        return [];
      }
      continue;
    }
    try {
      const parsed = JSON.parse(result.stdout) as string[] | string;
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      continue;
    }
  }
  return undefined;
}

async function jsrVersions(name: string): Promise<string[] | undefined> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await sleep(attempt * 2000);
    }
    try {
      const response = await fetch(`https://jsr.io/${name}/meta.json`);
      if (response.status === 404) {
        return [];
      }
      if (response.ok) {
        return publishedVersions((await response.json()) as JsrMeta);
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

async function appendSummary(text: string): Promise<void> {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (path === undefined) {
    return;
  }
  await appendFile(path, text);
}

const SETUP_COMMENT_MARKER = "<!-- speechdeck-npm-setup -->";

async function commentOnMergedPr(instructions: string): Promise<void> {
  const repo = process.env.GITHUB_REPOSITORY;
  const sha = process.env.GITHUB_SHA;
  if (repo === undefined || sha === undefined) {
    return;
  }
  const pr = sh("gh", ["api", `repos/${repo}/commits/${sha}/pulls`, "--jq", ".[0].number"]);
  const number = pr.stdout.trim();
  if (pr.status !== 0 || number === "") {
    return;
  }
  const body = `${SETUP_COMMENT_MARKER}\n\n${instructions}`;
  const existing = sh("gh", [
    "api",
    "--paginate",
    `repos/${repo}/issues/${number}/comments`,
    "--jq",
    `[.[] | select(.body | contains("${SETUP_COMMENT_MARKER}"))][0].id`,
  ]);
  const id = existing.stdout.trim();
  if (existing.status === 0 && id !== "" && id !== "null") {
    sh("gh", [
      "api",
      "--method",
      "PATCH",
      `repos/${repo}/issues/comments/${id}`,
      "-F",
      `body=${body}`,
    ]);
    return;
  }
  sh("gh", ["pr", "comment", number, "--repo", repo, "--body", body]);
}

function ensureTag(version: string): boolean {
  const tag = `v${version}`;
  // Push unconditionally: a prior run may have tagged locally without
  // pushing, and pushing an existing tag is a harmless no-op.
  if (sh("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`]).status !== 0) {
    if (sh("git", ["tag", tag]).status !== 0) {
      return false;
    }
  }
  return sh("git", ["push", "origin", tag]).status === 0;
}

async function ensureGithubRelease(version: string): Promise<boolean> {
  const tag = `v${version}`;
  if (sh("gh", ["release", "view", tag]).status === 0) {
    return true;
  }
  const withNotes = sh("gh", ["release", "create", tag, "--generate-notes", "--title", tag]);
  if (withNotes.status === 0) {
    return true;
  }
  return sh("gh", ["release", "create", tag]).status === 0;
}

async function publishOne(
  pkg: WorkspacePackage,
  target: RegistryTarget,
  versionsByName: ReadonlyMap<string, string>,
  dryRun: boolean,
  local = false,
  interactive = false,
): Promise<ShResult> {
  const manifestPath = join(pkg.dir, "package.json");
  const original = await readFile(manifestPath, "utf8");
  await writeFile(manifestPath, pinManifest(original, versionsByName, target));
  try {
    if (target === "npm") {
      const args = ["publish", "--access", "public"];
      if (dryRun) {
        args.push("--dry-run");
      } else if (!local) {
        // Provenance requires OIDC; a local bootstrap publish (no OIDC)
        // publishes under the human's own npm login instead.
        args.push("--provenance");
      }
      return sh("npm", args, pkg.dir, interactive);
    }
    const extra = dryRun ? ["--dry-run"] : [];
    return sh("pnpm", ["dlx", "jsr", "publish", "--allow-dirty", ...extra], pkg.dir);
  } finally {
    await writeFile(manifestPath, original);
  }
}

const releaseUsage = `Usage: node scripts/release.ts [--dry-run | --bootstrap]

  (no flags)   the real release: publish npm + JSR, tag, GitHub Release.
  --dry-run    pack every package for both registries; publish nothing.
  --bootstrap  first publish to npm under the local npm login so Trusted
               Publishing can be configured; touches nothing else.
`;

export async function releaseCli(argv: readonly string[]): Promise<number> {
  const dryRun = argv.includes("--dry-run");
  const bootstrap = argv.includes("--bootstrap");
  const known = ["--dry-run", "--bootstrap"];
  const unknown = argv.filter((arg) => !known.includes(arg));
  if (unknown.length > 0 || (dryRun && bootstrap)) {
    process.stderr.write(`Unknown arguments: ${unknown.join(" ")}\n\n${releaseUsage}`);
    return 1;
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const packages = await readWorkspacePackages(root);
  if (packages.length === 0) {
    process.stderr.write("No publishable packages found under packages/*.\n");
    return 1;
  }
  const versionsByName = new Map(packages.map((pkg) => [pkg.name, pkg.version]));

  if (bootstrap) {
    // First publish: a package must exist on npm before npmjs.com lets a
    // human configure Trusted Publishing for it. This creates the five at
    // their current versions under the local npm login (run `npm login`
    // first), pinning workspace deps like CI does. npm runs with inherited
    // stdio so its 2FA browser authentication works — expect one browser
    // round per package. JSR, tags, and GitHub Releases are untouched;
    // re-run safely — a version already on npm is skipped.
    const failures: string[] = [];
    for (const pkg of packages) {
      const result = await publishOne(pkg, "npm", versionsByName, false, true, true);
      if (result.status !== 0 && isNpmAlreadyPublished(result.stderr)) {
        process.stdout.write(`npm already has ${pkg.name}@${pkg.version}; skipping.\n`);
        continue;
      }
      if (result.status !== 0) {
        failures.push(`${pkg.name}: bootstrap publish failed`);
        continue;
      }
      process.stdout.write(`Published ${pkg.name}@${pkg.version} to npm.\n`);
    }
    if (failures.length > 0) {
      process.stderr.write(`${failures.join("; ")}; fix and re-run the bootstrap.\n`);
      return 1;
    }
    process.stdout.write("All packages exist on npm; configure Trusted Publishing next.\n");
    return 0;
  }

  if (dryRun) {
    // CI's packaging check: exercise both registries' packing paths without
    // contacting either for a version decision. No npm pack errors, no JSR
    // module-graph surprises — that is what this run exists to catch.
    const failures: string[] = [];
    for (const pkg of packages) {
      for (const target of ["npm", "jsr"] as const) {
        const result = await publishOne(pkg, target, versionsByName, true);
        if (result.status !== 0) {
          process.stderr.write(result.stderr);
          failures.push(`${pkg.name} (${target} dry-run)`);
        }
      }
    }
    if (failures.length > 0) {
      process.stderr.write(`Dry run failed for: ${failures.join("; ")}\n`);
      return 1;
    }
    process.stdout.write("Every package packs cleanly for npm and JSR.\n");
    return 0;
  }

  // What each registry already has, per package. A registry we cannot read is
  // a hard stop: publishing blind risks a double publish.
  const plans = new Map<string, ReleasePlan>();
  for (const pkg of packages) {
    const onNpm = await npmVersions(pkg.name);
    if (onNpm === undefined) {
      process.stderr.write(
        `Cannot determine what npm already has for ${pkg.name}; not risking a double publish.\n`,
      );
      return 1;
    }
    const onJsr = await jsrVersions(pkg.name);
    if (onJsr === undefined) {
      process.stderr.write(
        `Cannot fetch jsr.io metadata for ${pkg.name}; not risking a double publish.\n`,
      );
      return 1;
    }
    plans.set(
      pkg.name,
      planRelease({ version: pkg.version, npmVersions: onNpm, jsrVersions: onJsr }),
    );
  }

  const failures: string[] = [];
  let setupCommented = false;
  for (const pkg of packages) {
    const plan = plans.get(pkg.name);
    if (plan === undefined) {
      continue;
    }
    if (plan.npm) {
      process.stdout.write(`Publishing ${pkg.name}@${pkg.version} to npm with provenance.\n`);
      const publish = await publishOne(pkg, "npm", versionsByName, false);
      if (publish.status !== 0 && isNpmAlreadyPublished(publish.stderr)) {
        process.stdout.write(
          `npm already has ${pkg.name}@${pkg.version} (a prior run got there first); skipping.\n`,
        );
      } else if (publish.status !== 0) {
        process.stderr.write(publish.stderr);
        failures.push(`${pkg.name}: npm publish failed`);
        if (isNpmSetupError(publish.stderr)) {
          const instructions = npmSetupInstructions(pkg.name, pkg.version);
          process.stdout.write(`\n${instructions}\n`);
          await appendSummary(`## npm publish needs human setup\n\n${instructions}\n`);
          if (!setupCommented) {
            // Every @speechdeck/* package shares one fix: claim the scope,
            // configure trusted publishing. One comment, not five.
            await commentOnMergedPr(instructions);
            setupCommented = true;
          }
        }
      }
    }
    if (plan.jsr) {
      process.stdout.write(`Publishing ${pkg.name}@${pkg.version} to JSR.\n`);
      const publish = await publishOne(pkg, "jsr", versionsByName, false);
      if (publish.status !== 0) {
        process.stderr.write(publish.stderr);
        failures.push(`${pkg.name}: JSR publish failed`);
      }
    }
  }

  if (failures.length > 0) {
    process.stderr.write(`${failures.join("; ")}; the workspace is not fully released.\n`);
    return 1;
  }

  // The fixed changesets group keeps the five in lockstep, but a tag is
  // cheap and lying is expensive: tag each distinct version that shipped.
  const versions = [...new Set(packages.map((pkg) => pkg.version))];
  for (const version of versions) {
    const tagged = ensureTag(version);
    if (!tagged) {
      process.stderr.write(`Published, but the v${version} tag could not be created or pushed.\n`);
      return 1;
    }
    const released = await ensureGithubRelease(version);
    if (!released) {
      process.stderr.write(
        `Published and tagged, but the GitHub Release for v${version} could not be created.\n`,
      );
      return 1;
    }
  }
  process.stdout.write(
    `Released ${versions.map((version) => `v${version}`).join(", ")}: npm, JSR, tags, GitHub Releases.\n`,
  );
  return 0;
}

if (isCliEntry()) {
  process.exitCode = await releaseCli(process.argv.slice(2));
}
