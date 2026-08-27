#!/usr/bin/env node
/**
 * JSR does not understand pnpm's `workspace:*` protocol — it rewrites
 * `@speechdeck/core` to `npm:@speechdeck/core` with no version and refuses
 * to publish. Pin sibling workspace deps to the npm-compat JSR specifier
 * (`npm:@jsr/speechdeck__core@0.0.0`) for the publish, then restore
 * package.json.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const order = ["core", "themes", "vite", "create", "solid"];
const extra = process.argv.slice(2);

const versionsByName = new Map();
for (const dir of readdirSync(join(root, "packages"))) {
  const manifest = join(root, "packages", dir, "package.json");
  if (!existsSync(manifest)) continue;
  const pkg = JSON.parse(readFileSync(manifest, "utf8"));
  if (typeof pkg.name === "string" && typeof pkg.version === "string") {
    versionsByName.set(pkg.name, pkg.version);
  }
}

function pinWorkspaceDeps(pkgDir) {
  const path = join(pkgDir, "package.json");
  const original = readFileSync(path, "utf8");
  const json = JSON.parse(original);
  let touched = false;
  for (const section of ["dependencies", "peerDependencies", "devDependencies"]) {
    const deps = json[section];
    if (!deps) continue;
    for (const [name, value] of Object.entries(deps)) {
      if (typeof value !== "string" || !value.startsWith("workspace:")) continue;
      const version = versionsByName.get(name);
      if (!version) {
        throw new Error(
          `${json.name} depends on ${name} via workspace: but no sibling package was found`,
        );
      }
      deps[name] = `npm:@jsr/${name.slice(1).replace("/", "__")}@${version}`;
      touched = true;
    }
  }
  if (touched) {
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  }
  return original;
}

for (const pkg of order) {
  const pkgDir = join(root, "packages", pkg);
  console.log(`==== @speechdeck/${pkg} ====`);
  const original = pinWorkspaceDeps(pkgDir);
  try {
    const result = spawnSync("pnpm", ["dlx", "jsr", "publish", "--allow-dirty", ...extra], {
      cwd: pkgDir,
      stdio: "inherit",
    });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  } finally {
    writeFileSync(join(pkgDir, "package.json"), original);
  }
}
