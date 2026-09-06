import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import {
  bump,
  BumpError,
  extractBaseline,
  higherVersion,
  nextVersion,
  parseBumpSpec,
  replaceVersion,
} from "./bump.ts";
import { jsrPackages } from "./jsr-packages.ts";

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function writeWorkspace(root: string, version: string): Promise<void> {
  for (const name of jsrPackages) {
    const dir = join(root, "packages", name);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "package.json"),
      `${JSON.stringify({ name: `@speechdeck/${name}`, version }, null, 2)}\n`,
    );
    await writeFile(
      join(dir, "jsr.json"),
      `${JSON.stringify({ name: `@speechdeck/${name}`, version }, null, 2)}\n`,
    );
  }
}

async function tmpWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "speechdeck-bump-"));
  tmpDirs.push(root);
  return root;
}

test("nextVersion increments patch, minor, and major", () => {
  expect(nextVersion("0.1.1", "patch")).toBe("0.1.2");
  expect(nextVersion("0.1.1")).toBe("0.1.2");
  expect(nextVersion("0.1.1", "minor")).toBe("0.2.0");
  expect(nextVersion("0.1.1", "major")).toBe("1.0.0");
  expect(nextVersion("0.1.1", "0.3.0")).toBe("0.3.0");
});

test("nextVersion refuses the current version and non-semver", () => {
  expect(() => nextVersion("0.1.1", "0.1.1")).toThrow(BumpError);
  expect(() => nextVersion("0.1.1", "1")).toThrow(BumpError);
  expect(() => nextVersion("v0.1.1", "patch")).toThrow(BumpError);
});

test("parseBumpSpec defaults to patch and accepts flags or an exact version", () => {
  expect(parseBumpSpec([])).toBe("patch");
  expect(parseBumpSpec(["minor"])).toBe("minor");
  expect(parseBumpSpec(["--major"])).toBe("major");
  expect(parseBumpSpec(["0.2.0"])).toBe("0.2.0");
  expect(() => parseBumpSpec(["patch", "minor"])).toThrow(BumpError);
  expect(() => parseBumpSpec(["--help"])).toThrow(BumpError);
});

test("replaceVersion rewrites only the version field, leaving the rest of the file alone", () => {
  const source = `{
  "name": "@speechdeck/core",
  "version": "0.0.0",
  "publish": {
    "include": ["LICENSE", "src/**/*.ts"]
  }
}
`;
  expect(replaceVersion(source, "0.0.0", "0.0.1")).toBe(`{
  "name": "@speechdeck/core",
  "version": "0.0.1",
  "publish": {
    "include": ["LICENSE", "src/**/*.ts"]
  }
}
`);
});

test("bump writes the same version to every package.json and jsr.json", async () => {
  const root = await tmpWorkspace();
  await writeWorkspace(root, "0.1.1");
  const result = await bump(root, "patch");
  expect(result).toEqual({ from: "0.1.1", to: "0.1.2" });
  for (const name of jsrPackages) {
    const pkg = JSON.parse(
      await readFile(join(root, "packages", name, "package.json"), "utf8"),
    ) as {
      version: string;
    };
    const jsr = JSON.parse(await readFile(join(root, "packages", name, "jsr.json"), "utf8")) as {
      version: string;
    };
    expect(pkg.version).toBe("0.1.2");
    expect(jsr.version).toBe("0.1.2");
  }
});

test("extractBaseline pulls --baseline out of argv, leaving the rest untouched", () => {
  expect(extractBaseline([])).toEqual({ rest: [] });
  expect(extractBaseline(["minor"])).toEqual({ rest: ["minor"] });
  expect(extractBaseline(["minor", "--baseline", "0.1.5"])).toEqual({
    rest: ["minor"],
    baseline: "0.1.5",
  });
  expect(extractBaseline(["--baseline", "0.1.5", "minor"])).toEqual({
    rest: ["minor"],
    baseline: "0.1.5",
  });
  expect(() => extractBaseline(["--baseline"])).toThrow(BumpError);
});

test("higherVersion picks the greater of two semvers", () => {
  expect(higherVersion("0.1.1", "0.1.2")).toBe("0.1.2");
  expect(higherVersion("0.2.0", "0.1.9")).toBe("0.2.0");
  expect(higherVersion("1.0.0", "0.9.9")).toBe("1.0.0");
  expect(higherVersion("0.1.1", "0.1.1")).toBe("0.1.1");
});

test("bump uses the baseline when a branch's own version is stale", async () => {
  const root = await tmpWorkspace();
  await writeWorkspace(root, "0.1.1");
  expect(await bump(root, "patch", "0.1.5")).toEqual({ from: "0.1.1", to: "0.1.6" });
});

test("bump ignores a baseline that is behind the branch's own version", async () => {
  const root = await tmpWorkspace();
  await writeWorkspace(root, "0.2.0");
  expect(await bump(root, "patch", "0.1.5")).toEqual({ from: "0.2.0", to: "0.2.1" });
});

test("bump refuses when a package.json and jsr.json already disagree", async () => {
  const root = await tmpWorkspace();
  await writeWorkspace(root, "0.1.1");
  await writeFile(
    join(root, "packages/core/jsr.json"),
    `${JSON.stringify({ name: "@speechdeck/core", version: "0.1.0" }, null, 2)}\n`,
  );
  await expect(bump(root, "patch")).rejects.toThrow(BumpError);
});

test("bump refuses when JSR packages are not lockstep", async () => {
  const root = await tmpWorkspace();
  await writeWorkspace(root, "0.1.1");
  await writeFile(
    join(root, "packages/solid/package.json"),
    `${JSON.stringify({ name: "@speechdeck/solid", version: "0.2.0" }, null, 2)}\n`,
  );
  await writeFile(
    join(root, "packages/solid/jsr.json"),
    `${JSON.stringify({ name: "@speechdeck/solid", version: "0.2.0" }, null, 2)}\n`,
  );
  await expect(bump(root, "patch")).rejects.toThrow(BumpError);
});
