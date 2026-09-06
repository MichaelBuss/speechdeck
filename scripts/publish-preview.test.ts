import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { jsrPackages } from "./jsr-packages.ts";
import {
  globMatch,
  isPublishedPath,
  previewPublish,
  previewWorkspace,
  publishedVersions,
  type JsrPublish,
  type PackageInput,
} from "./publish-preview.ts";

const corePublish = JSON.parse(
  await readFile(new URL("../packages/core/jsr.json", import.meta.url), "utf8"),
) as { name: string; publish: JsrPublish };

const solidPublish = JSON.parse(
  await readFile(new URL("../packages/solid/jsr.json", import.meta.url), "utf8"),
) as { name: string; publish: JsrPublish };

test("jsr.json include/exclude decide which PR files are the published package", () => {
  expect(isPublishedPath("src/index.ts", corePublish.publish)).toBe(true);
  expect(isPublishedPath("skills/deck/SKILL.md", corePublish.publish)).toBe(true);
  expect(isPublishedPath("LICENSE", corePublish.publish)).toBe(true);
  expect(isPublishedPath("src/index.test.ts", corePublish.publish)).toBe(false);
  expect(isPublishedPath("docs/adr/0002-v0-stack.md", corePublish.publish)).toBe(false);
  expect(isPublishedPath(".github/workflows/ci.yml", corePublish.publish)).toBe(false);
});

test("globMatch handles jsr.json include and exclude patterns", () => {
  expect(globMatch("src/**/*.ts", "src/index.ts")).toBe(true);
  expect(globMatch("src/**/*.ts", "src/nested/index.ts")).toBe(true);
  expect(globMatch("**/*.test.ts", "src/index.test.ts")).toBe(true);
  expect(globMatch("**/*.test.ts", "foo.test.ts")).toBe(true);
  expect(globMatch("LICENSE", "LICENSE")).toBe(true);
  expect(globMatch("LICENSE", "src/LICENSE")).toBe(false);
});

test("a new version on a package-file PR is ready to ship", () => {
  const result = previewPublish({
    name: "@speechdeck/core",
    localVersion: "0.1.2",
    publishedVersions: ["0.0.0", "0.1.1"],
    changedFiles: ["src/index.ts", "src/index.test.ts"],
    publish: corePublish.publish,
  });
  expect(result.willPublish).toBe(true);
  expect(result.kind).toBe("ready");
  expect(result.headline).toBe("Ready to ship 0.1.2");
  expect(result.markdown).toMatch(/Ready to ship/);
});

test("the same version with only test or docs changes has no package changes", () => {
  const result = previewPublish({
    name: "@speechdeck/core",
    localVersion: "0.0.0",
    publishedVersions: ["0.0.0"],
    changedFiles: ["src/index.test.ts", "docs/adr/0021-bump-via-pr-comment-not-merge-gate.md"],
    publish: corePublish.publish,
  });
  expect(result.willPublish).toBe(false);
  expect(result.kind).toBe("no-changes");
  expect(result.headline).toBe("No package changes");
  expect(result.markdown).toMatch(/\/bump/);
});

test("the same version with published file changes will not publish until bumped", () => {
  const result = previewPublish({
    name: "@speechdeck/core",
    localVersion: "0.0.0",
    publishedVersions: ["0.0.0"],
    changedFiles: ["src/index.ts", "LICENSE"],
    publish: corePublish.publish,
  });
  expect(result.willPublish).toBe(false);
  expect(result.kind).toBe("needs-bump");
  expect(result.headline).toBe("Will not publish until bumped");
  expect(result.markdown).toMatch(/\/bump/);
  expect(result.detail).toMatch(/src\/index\.ts/);
});

test("publishedVersions includes latest even if versions is empty", () => {
  expect(publishedVersions({ latest: "0.1.1" })).toEqual(["0.1.1"]);
  expect([...publishedVersions({ versions: { "0.1.0": {}, "0.1.1": {} } })].sort()).toEqual([
    "0.1.0",
    "0.1.1",
  ]);
});

function workspaceAt(version: string, published: readonly string[]): PackageInput[] {
  return jsrPackages.map((name) => ({
    dir: `packages/${name}`,
    name: `@speechdeck/${name}`,
    localVersion: version,
    publishedVersions: published,
    publish: name === "solid" ? solidPublish.publish : corePublish.publish,
  }));
}

test("workspace preview: docs-only PR mentions /bump even when nothing ships", () => {
  const result = previewWorkspace(workspaceAt("0.0.0", ["0.0.0"]), [
    "AGENTS.md",
    "docs/agents/issue-tracker.md",
  ]);
  expect(result.kind).toBe("no-changes");
  expect(result.willPublish).toBe(false);
  expect(result.markdown).toMatch(/\/bump/);
});

test("workspace preview: a published-file change in one package waits on /bump", () => {
  const result = previewWorkspace(workspaceAt("0.0.0", ["0.0.0"]), [
    "packages/core/src/index.ts",
    "packages/core/src/index.test.ts",
    "README.md",
  ]);
  expect(result.kind).toBe("needs-bump");
  expect(result.willPublish).toBe(false);
  expect(result.headline).toBe("Will not publish until bumped");
  expect(result.markdown).toMatch(/\/bump/);
  expect(result.detail).toMatch(/packages\/core\/src\/index\.ts/);
});

test("workspace preview: a new lockstep version is ready to ship", () => {
  const result = previewWorkspace(workspaceAt("0.0.1", ["0.0.0"]), ["packages/core/src/index.ts"]);
  expect(result.kind).toBe("ready");
  expect(result.willPublish).toBe(true);
  expect(result.headline).toBe("Ready to ship 0.0.1");
});
