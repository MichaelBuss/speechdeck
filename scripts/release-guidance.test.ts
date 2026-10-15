import { test } from "vitest";
import assert from "node:assert/strict";
import {
  closesIssue,
  globMatch,
  guidance,
  isPublishedPath,
  parseChangeset,
  publishedFilesFor,
  type ChangesetEntry,
  type JsrPublish,
  type PackageInfo,
} from "./release-guidance.ts";

const publish: JsrPublish = {
  include: ["LICENSE", "src/**/*.ts", "skills/**/*.md"],
  exclude: ["src/**/*.test.ts"],
};

const packages: PackageInfo[] = [
  { name: "@speechdeck/core", dir: "packages/core", publish },
  {
    name: "@speechdeck/themes",
    dir: "packages/themes",
    publish: { include: ["LICENSE", "harbour/theme.json"] },
  },
];

test("jsr publish include/exclude decide which PR files are the published package", () => {
  assert.equal(isPublishedPath("src/init.ts", publish), true);
  assert.equal(isPublishedPath("src/adapters/github.ts", publish), true);
  assert.equal(isPublishedPath("skills/talk.md", publish), true);
  assert.equal(isPublishedPath("LICENSE", publish), true);
  assert.equal(isPublishedPath("src/init.test.ts", publish), false);
  assert.equal(
    isPublishedPath("docs/adr/0021-bump-via-pr-comment-not-merge-gate.md", publish),
    false,
  );
  assert.equal(isPublishedPath(".github/workflows/ci.yml", publish), false);
});

test("globMatch handles jsr.json include and exclude patterns", () => {
  assert.equal(globMatch("src/**/*.ts", "src/init.ts"), true);
  assert.equal(globMatch("src/**/*.ts", "src/adapters/github.ts"), true);
  assert.equal(globMatch("src/**/*.test.ts", "src/init.test.ts"), true);
  assert.equal(globMatch("skills/**/*.md", "skills/talk.md"), true);
  assert.equal(globMatch("LICENSE", "LICENSE"), true);
  assert.equal(globMatch("LICENSE", "src/LICENSE"), false);
});

test("publishedFilesFor scopes the changed list to one package's published files", () => {
  assert.deepEqual(
    publishedFilesFor(packages[0]!, [
      "packages/core/src/init.ts",
      "packages/core/src/init.test.ts",
      "packages/themes/harbour/theme.json",
      "packages/core/README.md",
      "docs/adr/0022.md",
    ]),
    ["packages/core/src/init.ts"],
  );
  assert.deepEqual(publishedFilesFor(packages[1]!, ["packages/themes/harbour/theme.json"]), [
    "packages/themes/harbour/theme.json",
  ]);
});

test("parseChangeset reads the standard frontmatter form", () => {
  const entries = parseChangeset(`---
"@speechdeck/core": minor
---
The parser now keeps fence state while splitting slides.
`);
  assert.deepEqual(entries, [
    {
      package: "@speechdeck/core",
      kind: "minor",
      note: "The parser now keeps fence state while splitting slides.",
    } satisfies ChangesetEntry,
  ]);
});

test("parseChangeset accepts an unquoted package name and a multi-line note", () => {
  const entries = parseChangeset(`---
"@speechdeck/themes": patch
"@speechdeck/core": patch
---
First line.

Second line.
`);
  assert.equal(entries.length, 2);
  assert.equal(entries[0]?.kind, "patch");
  assert.equal(entries[1]?.package, "@speechdeck/core");
  assert.match(entries[0]?.note ?? "", /First line\./);
  assert.match(entries[0]?.note ?? "", /Second line\./);
});

test("parseChangeset returns nothing for a file without frontmatter", () => {
  assert.deepEqual(parseChangeset("just some notes"), []);
});

test("closesIssue detects the closing keywords, not mere references", () => {
  assert.equal(closesIssue("Closes #97"), true);
  assert.equal(closesIssue("fixes #12"), true);
  assert.equal(closesIssue("resolves: #7"), true);
  assert.equal(closesIssue("Closed #3 in that PR"), true);
  assert.equal(closesIssue("Fixed #9"), true);
  assert.equal(closesIssue("refs #12"), false);
  assert.equal(closesIssue(""), false);
});

function guidanceMarkdown(input: {
  changedFiles: readonly string[];
  changesets: readonly ChangesetEntry[];
  body: string;
}): string {
  return guidance({
    changedFiles: input.changedFiles,
    packages,
    changesets: input.changesets,
    closesIssue: closesIssue(input.body),
  }).markdown;
}

test("a PR with published changes and a changeset shows the bump and the note", () => {
  const markdown = guidanceMarkdown({
    changedFiles: ["packages/core/src/init.ts"],
    changesets: [
      { package: "@speechdeck/core", kind: "minor", note: "The parser keeps fence state." },
    ],
    body: "Closes #97",
  });
  assert.match(markdown, /packages\/core\/src\/init\.ts/);
  assert.match(markdown, /minor/);
  assert.match(markdown, /The parser keeps fence state\./);
  assert.doesNotMatch(markdown, /No changeset yet/);
  assert.doesNotMatch(markdown, /doesn't close an issue|does not close an issue/i);
});

test("a PR with published changes and no changeset is told what will not ship and how to add one", () => {
  const markdown = guidanceMarkdown({
    changedFiles: ["packages/core/src/mod.ts"],
    changesets: [],
    body: "",
  });
  assert.match(markdown, /No changeset/);
  assert.match(markdown, /pnpm changeset/);
  assert.match(markdown, /Assumed bump.*\*\*patch\*\*/);
});

test("a PR with no published changes needs no changeset and says so", () => {
  const markdown = guidanceMarkdown({
    changedFiles: ["packages/core/src/mod.test.ts", "docs/adr/0022-a-release.md"],
    changesets: [],
    body: "",
  });
  assert.match(markdown, /no published files change/i);
  assert.match(markdown, /No changeset, and none needed\./);
});

test("a PR whose body closes nothing gets a nudge, not a gate", () => {
  const markdown = guidanceMarkdown({
    changedFiles: ["packages/core/src/init.ts"],
    changesets: [{ package: "@speechdeck/core", kind: "patch", note: "Fix." }],
    body: "just a fix",
  });
  assert.match(markdown, /Closes #\d+/);
  assert.match(markdown, /nudge|consider|if it resolves/i);
});

test("a changeset with no published-file changes still reports what will ship", () => {
  const markdown = guidanceMarkdown({
    changedFiles: ["README.md"],
    changesets: [{ package: "@speechdeck/themes", kind: "patch", note: "Tune harbour tokens." }],
    body: "",
  });
  assert.match(markdown, /Tune harbour tokens\./);
  assert.match(markdown, /next release/);
});
