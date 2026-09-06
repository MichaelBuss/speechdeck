import { readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { jsrPackages } from "./jsr-packages.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("jsrPackages lists every packages/* dir that has a jsr.json, in publish order", () => {
  const found = readdirSync(join(root, "packages")).filter((name) =>
    existsSync(join(root, "packages", name, "jsr.json")),
  );
  expect([...jsrPackages].sort()).toEqual([...found].sort());
  expect(jsrPackages).toEqual(["core", "themes", "vite", "create", "solid"]);
});
