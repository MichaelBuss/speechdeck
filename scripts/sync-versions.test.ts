import assert from "node:assert/strict";
import { test } from "vitest";
import { replaceVersion, staleJsrVersions } from "./sync-versions.ts";

const versioned = (version: string) => ({ version });

test("only manifests whose version disagrees with package.json are stale", () => {
  assert.deepEqual(
    staleJsrVersions([
      { name: "core", pkg: versioned("0.2.0"), jsr: versioned("0.1.5") },
      { name: "themes", pkg: versioned("0.2.0"), jsr: versioned("0.2.0") },
    ]),
    ["packages/core/jsr.json"],
  );
});

// oxfmt keeps short arrays inline; the sync must not reflow them.
const jsrManifest = `{
  "name": "@speechdeck/core",
  "version": "0.1.5",
  "license": "MIT",
  "exports": "./src/index.ts",
  "publish": {
    "include": ["LICENSE", "src/**/*.ts", "skills/**/*.md"],
    "exclude": ["src/**/*.test.ts"]
  }
}
`;

test("the version line changes; every other byte stays as it was", () => {
  const synced = replaceVersion(jsrManifest, "0.1.5", "0.2.0");
  assert.match(synced, /"version": "0\.2\.0"/);
  const lineWith = (text: string, needle: string) =>
    text.split("\n").find((line) => line.includes(needle));
  assert.equal(lineWith(synced, '"include"'), lineWith(jsrManifest, '"include"'));
  assert.equal(lineWith(synced, '"exclude"'), lineWith(jsrManifest, '"exclude"'));
  assert.equal(synced.split("\n").length, jsrManifest.split("\n").length);
});

test("a version string appearing once elsewhere does not match the needle", () => {
  const withPin = jsrManifest.replace(
    '"exports": "./src/index.ts"',
    '"exports": "./src/index.ts",\n  "fallback": "0.1.5"',
  );
  const synced = replaceVersion(withPin, "0.1.5", "0.2.0");
  assert.match(synced, /"fallback": "0\.1\.5"/);
  assert.match(synced, /"version": "0\.2\.0"/);
});

test("zero or multiple version lines refuse to sync instead of guessing", () => {
  assert.throws(() => replaceVersion(jsrManifest, "9.9.9", "0.2.0"), /found 0/);
  const twice = jsrManifest.replace('"exclude"', '"version": "0.1.5",\n    "exclude"');
  assert.equal(twice.split('"version": "0.1.5"').length - 1, 2);
  assert.throws(() => replaceVersion(twice, "0.1.5", "0.2.0"), /found 2/);
});
