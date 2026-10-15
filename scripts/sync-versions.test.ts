import assert from "node:assert/strict";
import { test } from "vitest";
import { syncVersions } from "./sync-versions.ts";

const versioned = (version: string) => ({ version });

test("a jsr.json behind its package.json is dragged to the same version", () => {
  const result = syncVersions([{ name: "core", pkg: versioned("0.2.0"), jsr: versioned("0.1.5") }]);
  assert.deepEqual(result.changed, ["packages/core/jsr.json"]);
  assert.equal(result.jsr.get("core")?.version, "0.2.0");
});

test("an already-synced manifest is left alone and reports no change", () => {
  const result = syncVersions([{ name: "core", pkg: versioned("0.2.0"), jsr: versioned("0.2.0") }]);
  assert.deepEqual(result.changed, []);
  assert.equal(result.jsr.get("core")?.version, "0.2.0");
});

test("syncing preserves every other jsr.json field and the other packages", () => {
  const result = syncVersions([
    {
      name: "core",
      pkg: versioned("0.2.0"),
      jsr: { version: "0.1.5", name: "@speechdeck/core", exports: "./src/index.ts" } as {
        version: string;
      },
    },
    { name: "themes", pkg: versioned("0.2.0"), jsr: versioned("0.2.0") },
  ]);
  const core = result.jsr.get("core") as { version: string; name: string; exports: string };
  assert.equal(core.name, "@speechdeck/core");
  assert.equal(core.exports, "./src/index.ts");
  assert.deepEqual(result.changed, ["packages/core/jsr.json"]);
});
