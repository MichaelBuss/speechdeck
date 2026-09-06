import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { jsrPackages } from "./jsr-packages.ts";
import { shouldPublish, shouldPublishWorkspace } from "./should-publish.ts";

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tmpRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "speechdeck-should-publish-"));
  tmpDirs.push(root);
  return root;
}

test("shouldPublish is true when the local version is not on JSR yet", async () => {
  const root = await tmpRoot();
  const jsrPath = join(root, "jsr.json");
  const metaPath = join(root, "meta.json");
  await writeFile(jsrPath, JSON.stringify({ version: "0.1.2" }));
  await writeFile(metaPath, JSON.stringify({ latest: "0.1.1", versions: { "0.1.1": {} } }));
  expect(await shouldPublish(jsrPath, metaPath)).toEqual({
    version: "0.1.2",
    alreadyPublished: false,
  });
});

test("shouldPublish is false when the local version is already on JSR", async () => {
  const root = await tmpRoot();
  const jsrPath = join(root, "jsr.json");
  const metaPath = join(root, "meta.json");
  await writeFile(jsrPath, JSON.stringify({ version: "0.1.1" }));
  await writeFile(metaPath, JSON.stringify({ latest: "0.1.1", versions: { "0.1.1": {} } }));
  expect(await shouldPublish(jsrPath, metaPath)).toEqual({
    version: "0.1.1",
    alreadyPublished: true,
  });
});

test("shouldPublishWorkspace is true when any package version is not on JSR yet", async () => {
  const root = await tmpRoot();
  const metaDir = join(root, "meta");
  await mkdir(metaDir);
  for (const name of jsrPackages) {
    await mkdir(join(root, "packages", name), { recursive: true });
    await writeFile(
      join(root, "packages", name, "jsr.json"),
      JSON.stringify({ name: `@speechdeck/${name}`, version: "0.0.1" }),
    );
    await writeFile(
      join(metaDir, `${name}.json`),
      JSON.stringify({ latest: "0.0.0", versions: { "0.0.0": {} } }),
    );
  }
  expect(await shouldPublishWorkspace(root, metaDir)).toEqual({
    version: "0.0.1",
    alreadyPublished: false,
    toPublish: [...jsrPackages],
  });
});

test("shouldPublishWorkspace skips packages already on JSR and still publishes the rest", async () => {
  const root = await tmpRoot();
  const metaDir = join(root, "meta");
  await mkdir(metaDir);
  for (const name of jsrPackages) {
    await mkdir(join(root, "packages", name), { recursive: true });
    await writeFile(
      join(root, "packages", name, "jsr.json"),
      JSON.stringify({ name: `@speechdeck/${name}`, version: "0.0.1" }),
    );
    const onJsr = name === "core";
    await writeFile(
      join(metaDir, `${name}.json`),
      JSON.stringify(
        onJsr
          ? { latest: "0.0.1", versions: { "0.0.1": {} } }
          : { latest: "0.0.0", versions: { "0.0.0": {} } },
      ),
    );
  }
  const result = await shouldPublishWorkspace(root, metaDir);
  expect(result.alreadyPublished).toBe(false);
  expect(result.toPublish).toEqual(jsrPackages.filter((name) => name !== "core"));
});
