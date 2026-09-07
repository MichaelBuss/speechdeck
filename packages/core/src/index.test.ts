import { expect, test } from "vitest";
import { matchCode, parseDeck, resolveFrame, type CodeBlock, type FileMap } from "./index.ts";

const harbourTheme = JSON.stringify({
  fonts: { title: "serif", body: "sans-serif", mono: "monospace" },
  accents: ["a", "b", "c", "d"],
  dark: { fg: "#fff", title: "#fff", muted: "#ccc", chrome: "#000" },
  light: { fg: "#000", title: "#000", muted: "#333", chrome: "#fff" },
  stops: ["oklch(0.2 0 0)", "oklch(0.3 0 0)"],
});

const files: FileMap = {
  read(relative) {
    if (relative === "@speechdeck/themes/harbour/theme.json") return harbourTheme;
    throw new Error(`no such file: ${relative}`);
  },
};

function filesWith(extra: Record<string, string>): FileMap {
  return {
    read(relative) {
      if (relative in extra) return extra[relative] ?? "";
      return files.read(relative);
    },
  };
}

test("parseDeck: theme + one H1 heading yields a Cover Slide at address 1", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n# Title\n";
  const { deck, diagnostics } = parseDeck(source, files);

  expect(diagnostics).toEqual([]);
  expect(deck.slides).toHaveLength(1);
  expect(deck.slides[0]?.id).toBe("1");
  expect(deck.slides[0]?.layout).toBeUndefined();
  expect(deck.tokens.specifier).toBe("@speechdeck/themes/harbour");
  expect(deck.appearance).toBe("dark");
  expect(deck.motion).toBe("auto");

  const frame = resolveFrame(deck, { to: "1" });
  expect(frame.layout).toBe("cover");
  expect(frame.layoutAuto).toBe("cover");
  expect(frame.layoutSource).toBe("auto");
  expect(frame.enter).toBe("cut");
  expect(frame.upNext).toBeUndefined();
});

test("parseDeck: omitted appearance is dark, omitted motion is auto", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n# Title\n";
  const { deck } = parseDeck(source, files);
  expect(deck.appearance).toBe("dark");
  expect(deck.motion).toBe("auto");
});

test("parseDeck: explicit appearance and motion are honoured", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\nappearance: light\nmotion: always\n---\n# Title\n";
  const { deck } = parseDeck(source, files);
  expect(deck.appearance).toBe("light");
  expect(deck.motion).toBe("always");
});

test("parseDeck: theme is required", () => {
  expect(() => parseDeck("# Title\n", files)).toThrow();
  expect(() => parseDeck("---\n---\n# Title\n", files)).toThrow();
});

test("parseDeck: an unresolvable theme.json does not yield a Deck", () => {
  const source = "---\ntheme: ./missing-theme\n---\n# Title\n";
  expect(() => parseDeck(source, files)).toThrow();
});

test("parseDeck: a --- starts a new Slide; extra blank lines do not", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "## First",
    "",
    "",
    "Speech under first.",
    "",
    "",
    "",
    "---",
    "## Second",
    "",
  ].join("\n");
  const { deck } = parseDeck(source, files);

  expect(deck.slides).toHaveLength(2);
  expect(deck.slides[0]?.cells).toHaveLength(1);
  expect(deck.slides[0]?.speech.blocks).toHaveLength(1);
  expect(deck.slides[1]?.cells).toHaveLength(1);
});

test("parseDeck: untagged prose is Speech, not a Cell on the Slide", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n## Heading\n\nThis is spoken only.\n";
  const { deck } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.cells).toHaveLength(1);
  expect(slide?.cells[0]?.blocks[0]?.kind).toBe("heading");
  expect(slide?.speech.blocks).toHaveLength(1);
  expect(slide?.speech.blocks[0]?.kind).toBe("paragraph");
  expect(slide?.speech.blocks[0]?.html).toContain("This is spoken only.");
});

test("parseDeck: one heading-only Cell at H2+ auto-picks Section", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n## Section heading\n";
  const { deck } = parseDeck(source, files);
  const frame = resolveFrame(deck, { to: "1" });

  expect(frame.layout).toBe("section");
  expect(frame.layoutAuto).toBe("section");
});

test("resolveFrame: first paint, a deep link, and a skip are hard cuts", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n# One\n---\n## Two\n---\nenter: connected\n## Three\n";
  const { deck } = parseDeck(source, files);

  const firstPaint = resolveFrame(deck, { to: "1" });
  expect(firstPaint.enter).toBe("cut");

  const deepLink = resolveFrame(deck, { to: "3" });
  expect(deepLink.enter).toBe("cut");

  const skip = resolveFrame(deck, { to: "3", from: "1" });
  expect(skip.enter).toBe("cut");

  const sequential = resolveFrame(deck, { to: "3", from: "2" });
  expect(sequential.enter).toBe("connected");
});

test("parseDeck: enter: connected on the first Slide is a Lint; the Arrival is still a hard cut", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\nenter: connected\n# One\n";
  const { deck, diagnostics } = parseDeck(source, files);

  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toMatchObject({ kind: "connected-on-first", slide: "1" });

  const frame = resolveFrame(deck, { to: "1" });
  expect(frame.enter).toBe("cut");
});

test("resolveFrame: a heading with the same text mints the same identity name on both sides of a connected edge", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n## Same\n---\nenter: connected\n## Same\n---\n## Different\n";
  const { deck } = parseDeck(source, files);

  const from = resolveFrame(deck, { to: "1" });
  const to = resolveFrame(deck, { to: "2", from: "1" });
  const other = resolveFrame(deck, { to: "3", from: "2" });

  expect(from.names).toHaveLength(1);
  expect(to.names).toHaveLength(1);
  expect(from.names[0]).toMatchObject({ class: "heading" });
  expect(to.names[0]?.name).toBe(from.names[0]?.name);
  expect(other.names[0]?.name).not.toBe(to.names[0]?.name);
});

test("resolveFrame: an image with the same src mints the same identity name; authors do not name the pairing", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n![](./a.jpg)\n---\nenter: connected\n![](./a.jpg)\n---\n![](./b.jpg)\n";
  const { deck } = parseDeck(source, files);

  const from = resolveFrame(deck, { to: "1" });
  const to = resolveFrame(deck, { to: "2", from: "1" });
  const other = resolveFrame(deck, { to: "3", from: "2" });

  expect(from.names[0]).toMatchObject({ class: "figure" });
  expect(to.names[0]?.name).toBe(from.names[0]?.name);
  expect(other.names[0]?.name).not.toBe(to.names[0]?.name);
  // No id on either the Markdown or the Frame: the name is minted from the src alone.
  expect(to.names[0]?.name).not.toContain("a.jpg");
});

test("resolveFrame: identity names are valid view-transition-name idents", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n## A heading, with punctuation!\n";
  const { deck } = parseDeck(source, files);
  const frame = resolveFrame(deck, { to: "1" });
  expect(frame.names[0]?.name).toMatch(/^sd-h-[0-9a-z]+$/);
});

test("parseDeck: two headings with the same text on one Slide fail the build; runtime does not suffix", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n### Same\n\n#### Same\n";
  expect(() => parseDeck(source, files)).toThrow();
});

test("parseDeck: two images with the same src on one Slide fail the build", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n![](./a.jpg)\n\n![](./a.jpg)\n";
  expect(() => parseDeck(source, files)).toThrow();
});

test("parseDeck: two Slides sharing a heading is not a same-Slide collision", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n## Same\n---\n## Same\n";
  expect(() => parseDeck(source, files)).not.toThrow();
});

test("core has no mintNames export and no public transition API (ADR 0005, ADR 0013)", async () => {
  const core = await import("./index.ts");
  expect((core as Record<string, unknown>)["mintNames"]).toBeUndefined();
});

test("parseDeck: two Slides may share a heading; they do not share an address", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n## Same\n---\n## Same\n";
  const { deck } = parseDeck(source, files);

  expect(deck.slides).toHaveLength(2);
  expect(deck.slides[0]?.id).toBe("1");
  expect(deck.slides[1]?.id).toBe("2");
  expect(deck.slides[0]?.cells[0]?.blocks[0]).toMatchObject({ kind: "heading", text: "Same" });
  expect(deck.slides[1]?.cells[0]?.blocks[0]).toMatchObject({ kind: "heading", text: "Same" });
});

test("parseDeck: <!--on--> immediately before a paragraph puts it on the Slide as a Cell, no Lint", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n<!--on-->\nThis is promoted.\n";
  const { deck, diagnostics } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.speech.blocks).toHaveLength(0);
  expect(slide?.cells).toHaveLength(1);
  expect(slide?.cells[0]?.blocks[0]).toMatchObject({
    kind: "prose",
    html: "<p>This is promoted.</p>",
  });
  expect(resolveFrame(deck, { to: "1" }).layout).toBe("solo");
  expect(diagnostics).toEqual([]);
});

test("parseDeck: <!--on--> immediately before a list or quote promotes it too, no Lint", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "<!--on-->",
    "- one",
    "- two",
    "",
    "<!--on-->",
    "> quoted",
  ].join("\n");
  const { deck, diagnostics } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.cells).toHaveLength(2);
  expect(slide?.cells[0]?.blocks[0]).toMatchObject({
    kind: "prose",
    html: "<ul><li>one</li><li>two</li></ul>",
  });
  expect(slide?.cells[1]?.blocks[0]).toMatchObject({
    kind: "prose",
    html: "<blockquote><p>quoted</p></blockquote>",
  });
  expect(diagnostics).toEqual([]);
});

test("parseDeck: <!--on--> right after other Speech, then a blank line, still promotes nothing and is a Lint", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\nSome text.\n<!--on-->\n\nNext paragraph.\n";
  const { deck, diagnostics } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.cells).toHaveLength(0);
  expect(slide?.speech.blocks).toMatchObject([
    { kind: "paragraph", html: "<p>Some text.</p>" },
    { kind: "paragraph", html: "<p>Next paragraph.</p>" },
  ]);
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toMatchObject({ kind: "promotion-promotes-nothing", slide: "1" });
});

test("parseDeck: a blank line between <!--on--> and the block cancels the Promotion, and is a Lint", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n<!--on-->\n\nNot promoted.\n";
  const { deck, diagnostics } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.cells).toHaveLength(0);
  expect(slide?.speech.blocks[0]).toMatchObject({
    kind: "paragraph",
    html: "<p>Not promoted.</p>",
  });
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toMatchObject({ kind: "promotion-promotes-nothing", slide: "1" });
});

test("parseDeck: a <!--on--> with nothing after it at all promotes nothing, and is a Lint", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n## Heading\n\n<!--on-->";
  const { deck, diagnostics } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.cells).toHaveLength(1);
  expect(slide?.speech.blocks).toHaveLength(0);
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toMatchObject({ kind: "promotion-promotes-nothing", slide: "1" });
});

test("parseDeck: <!--on--> immediately before a fenced code Cell is redundant, and is a Lint", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "<!--on-->",
    "```ts",
    "const x = 1;",
    "```",
  ].join("\n");
  const { deck, diagnostics } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.cells).toHaveLength(1);
  expect(slide?.cells[0]?.blocks[0]?.kind).toBe("code");
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toMatchObject({ kind: "promotion-redundant", slide: "1" });
});

test("parseDeck: <!--on--> immediately before an Embed is redundant, and is a Lint", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "<!--on-->",
    "```embed ./demo.ts",
    "```",
  ].join("\n");
  const { deck, diagnostics } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.cells).toHaveLength(1);
  expect(slide?.cells[0]?.blocks[0]?.kind).toBe("embed");
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toMatchObject({ kind: "promotion-redundant", slide: "1" });
});

test("parseDeck: <!--on--> immediately before a heading, image, or table is redundant, and is a Lint", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "<!--on-->",
    "## Heading",
    "",
    "<!--on-->",
    "![](./a.jpg)",
    "",
    "<!--on-->",
    "| a | b |",
    "| - | - |",
    "| 1 | 2 |",
  ].join("\n");
  const { deck, diagnostics } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.cells).toHaveLength(3);
  expect(slide?.cells[0]?.blocks[0]?.kind).toBe("heading");
  expect(slide?.cells[1]?.blocks[0]?.kind).toBe("image");
  expect(slide?.cells[2]?.blocks[0]?.kind).toBe("table");
  expect(diagnostics).toHaveLength(3);
  expect(diagnostics.every((d) => d.kind === "promotion-redundant")).toBe(true);
});

test("parseDeck: any other HTML comment is a Comment, never a Cell or Speech, and does not split adjacent lines", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "## Heading",
    "",
    "First line.",
    "<!-- speaker-only note -->",
    "Second line.",
    "",
    "<!-- entirely private -->",
  ].join("\n");
  const { deck } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.cells).toHaveLength(1);
  expect(slide?.speech.blocks).toHaveLength(1);
  expect(slide?.speech.blocks[0]?.html).toBe("<p>First line. Second line.</p>");
  expect(slide?.speech.blocks[0]?.html).not.toContain("speaker-only");
  expect(JSON.stringify(deck)).not.toContain("entirely private");
});

test('parseDeck: a Mark is <mark> or <mark data-mark="circle">; other types render too', () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "<!--on-->",
    'Plain <mark>underlined</mark> and <mark data-mark="circle">circled</mark> and <mark data-mark="highlight">hi</mark> and <mark data-mark="box">boxed</mark> and <mark data-mark="strike-through">gone</mark>.',
  ].join("\n");
  const { deck } = parseDeck(source, files);
  const html = deck.slides[0]?.cells[0]?.blocks[0]?.["html" as never] as unknown as string;

  expect(html).toContain("<mark>underlined</mark>");
  expect(html).toContain('<mark data-mark="circle">circled</mark>');
  expect(html).toContain('<mark data-mark="highlight">hi</mark>');
  expect(html).toContain('<mark data-mark="box">boxed</mark>');
  expect(html).toContain('<mark data-mark="strike-through">gone</mark>');
});

test("parseDeck: an unrecognized data-mark value is escaped as plain text, not rendered as a live Mark", () => {
  const source =
    '---\ntheme: @speechdeck/themes/harbour\n---\n<!--on-->\nA <mark data-mark="rainbow">nope</mark> mark.\n';
  const { deck } = parseDeck(source, files);
  const html = deck.slides[0]?.cells[0]?.blocks[0]?.["html" as never] as unknown as string;

  expect(html).not.toContain("<mark");
  expect(html).toContain("&lt;mark data-mark=&quot;rainbow&quot;&gt;nope&lt;/mark&gt;");
});

test("parseDeck: a table is a Cell and auto-picks Solo", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "| a | b |",
    "| - | - |",
    "| 1 | 2 |",
  ].join("\n");
  const { deck } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.cells).toHaveLength(1);
  expect(slide?.cells[0]?.blocks[0]?.kind).toBe("table");
  expect(slide?.cells[0]?.blocks[0]).toMatchObject({
    html: "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>",
  });
  expect(resolveFrame(deck, { to: "1" }).layout).toBe("solo");
});

test("parseDeck: two Cells auto-pick Split-2", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n<!--on-->\nOne.\n\n<!--on-->\nTwo.\n";
  const { deck } = parseDeck(source, files);
  expect(deck.slides[0]?.cells).toHaveLength(2);
  const frame = resolveFrame(deck, { to: "1" });
  expect(frame.layout).toBe("split-2");
  expect(frame.layoutAuto).toBe("split-2");
});

test("parseDeck: three Cells auto-pick Split-3", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n<!--on-->\nOne.\n\n<!--on-->\nTwo.\n\n<!--on-->\nThree.\n";
  const { deck } = parseDeck(source, files);
  expect(deck.slides[0]?.cells).toHaveLength(3);
  const frame = resolveFrame(deck, { to: "1" });
  expect(frame.layout).toBe("split-3");
  expect(frame.layoutAuto).toBe("split-3");
});

test("parseDeck: four or more Cells auto-pick Grid", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n<!--on-->\nOne.\n\n<!--on-->\nTwo.\n\n<!--on-->\nThree.\n\n<!--on-->\nFour.\n";
  const { deck } = parseDeck(source, files);
  expect(deck.slides[0]?.cells).toHaveLength(4);
  const frame = resolveFrame(deck, { to: "1" });
  expect(frame.layout).toBe("grid");
  expect(frame.layoutAuto).toBe("grid");
});

test("parseDeck: a Slide layout: override wins when possible; layoutAuto still names the auto pick", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\nlayout: cover\n## Section heading\n";
  const { deck, diagnostics } = parseDeck(source, files);

  expect(diagnostics).toEqual([]);
  expect(deck.slides[0]?.layout).toBe("cover");
  const frame = resolveFrame(deck, { to: "1" });
  expect(frame.layout).toBe("cover");
  expect(frame.layoutAuto).toBe("section");
  expect(frame.layoutSource).toBe("override");
});

test("parseDeck: an impossible layout override is a Lint; auto still renders; layoutSource stays override", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\nlayout: grid\n<!--on-->\nOne.\n\n<!--on-->\nTwo.\n";
  const { deck, diagnostics } = parseDeck(source, files);

  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toMatchObject({ kind: "impossible-layout", slide: "1" });
  expect(deck.slides[0]?.layout).toBe("grid");

  const frame = resolveFrame(deck, { to: "1" });
  expect(frame.layout).toBe("split-2");
  expect(frame.layoutAuto).toBe("split-2");
  expect(frame.layoutSource).toBe("override");
});

test("parseDeck: Slide Frontmatter followed directly by another --- is a Lint — the fields belong to a phantom, empty Slide", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n# Cover\n\n---\nlayout: split-2\nenter: connected\n---\n## Two\n";
  const { deck, diagnostics } = parseDeck(source, files);

  expect(deck.slides).toHaveLength(3);
  expect(deck.slides[1]).toMatchObject({ layout: "split-2", enter: "connected", cells: [] });
  expect(diagnostics).toContainEqual(
    expect.objectContaining({ kind: "frontmatter-only-slide", slide: "2" }),
  );
});

test("parseDeck: frontmatter-only-slide fires even when only enter: is set (no impossible-layout to piggyback on)", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n# Cover\n\n---\nenter: connected\n---\n## Two\n";
  const { deck, diagnostics } = parseDeck(source, files);

  expect(deck.slides).toHaveLength(3);
  expect(diagnostics).toContainEqual(
    expect.objectContaining({ kind: "frontmatter-only-slide", slide: "2" }),
  );
});

test("parseDeck: frontmatter-only-slide does not fire for a Slide with no Frontmatter fields at all", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n# One\n---\n---\n## Three\n";
  const { deck, diagnostics } = parseDeck(source, files);

  expect(deck.slides).toHaveLength(3);
  expect(deck.slides[1]).toMatchObject({ cells: [] });
  expect(diagnostics.filter((d) => d.kind === "frontmatter-only-slide")).toEqual([]);
});

test("parseDeck: frontmatter-only-slide does not fire for a legitimate background-only Slide", () => {
  const source =
    '---\ntheme: @speechdeck/themes/harbour\n---\nenter: connected\n![skyline](./skyline.jpg "background")\n';
  const { deck, diagnostics } = parseDeck(source, files);

  expect(deck.slides[0]).toMatchObject({ cells: [], enter: "connected" });
  expect(deck.slides[0]?.background).toBeDefined();
  expect(diagnostics.filter((d) => d.kind === "frontmatter-only-slide")).toEqual([]);
});

test("parseDeck: frontmatter-only-slide and impossible-layout coexist when the phantom Slide also carries a layout: override", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n# Cover\n\n---\nlayout: split-2\n---\n## Two\n";
  const { deck, diagnostics } = parseDeck(source, files);

  expect(deck.slides).toHaveLength(3);
  expect(diagnostics).toContainEqual(
    expect.objectContaining({ kind: "frontmatter-only-slide", slide: "2" }),
  );
  expect(diagnostics).toContainEqual(
    expect.objectContaining({ kind: "impossible-layout", slide: "2" }),
  );
});

test("parseDeck: frontmatter-only-slide also fires when the phantom Slide is the last one in the Deck (Frontmatter with nothing after it, no trailing ---)", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n# Cover\n\n---\nenter: connected\n";
  const { deck, diagnostics } = parseDeck(source, files);

  expect(deck.slides).toHaveLength(2);
  expect(deck.slides[1]).toMatchObject({ enter: "connected", cells: [] });
  expect(diagnostics).toContainEqual(
    expect.objectContaining({ kind: "frontmatter-only-slide", slide: "2" }),
  );
});

test("parseDeck: a Slide with no layout: field has no layout key at all — empty Frontmatter is omitted", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n# Title\n";
  const { deck } = parseDeck(source, files);
  expect("layout" in (deck.slides[0] ?? {})).toBe(false);
});

test("parseDeck: theme, appearance, and motion are Deck-only — a Slide cannot set them", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\ntheme: @speechdeck/themes/ink\n\n# Title\n";
  const { deck } = parseDeck(source, files);
  expect(deck.theme).toBe("@speechdeck/themes/harbour");
  expect(deck.slides[0]?.cells).toHaveLength(1);
  expect(deck.slides[0]?.cells[0]).toMatchObject({
    blocks: [{ kind: "heading", text: "Title" }],
  });
  expect(deck.slides[0]?.speech.blocks[0]?.html).toContain("@speechdeck/themes/ink");
});

test("parseDeck: an image with no title defaults to Contain, Focus center, no Look", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n![a dog](./dog.jpg)\n";
  const { deck, diagnostics } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(diagnostics).toEqual([]);
  expect(slide?.cells).toHaveLength(1);
  expect(slide?.cells[0]?.blocks[0]).toMatchObject({
    kind: "image",
    src: "./dog.jpg",
    alt: "a dog",
    fit: "contain",
    focus: "center",
    looks: [],
  });
  expect(resolveFrame(deck, { to: "1" }).layout).toBe("solo");
});

test("parseDeck: an image title is ordered tokens — fit, Focus, then combinable Looks", () => {
  const source =
    '---\ntheme: @speechdeck/themes/harbour\n---\n![a dog](./dog.jpg "crop top-left dim blur")\n';
  const { deck, diagnostics } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(diagnostics).toEqual([]);
  expect(slide?.cells[0]?.blocks[0]).toMatchObject({
    kind: "image",
    fit: "crop",
    focus: "top-left",
    looks: ["dim", "blur"],
  });
});

test("parseDeck: an unrecognized image title token is a Lint; the image still parses", () => {
  const source =
    '---\ntheme: @speechdeck/themes/harbour\n---\n![a dog](./dog.jpg "crop sideways")\n';
  const { deck, diagnostics } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toMatchObject({ kind: "unknown-image-token", slide: "1" });
  expect(slide?.cells[0]?.blocks[0]).toMatchObject({ kind: "image", fit: "crop", looks: [] });
});

test("parseDeck: a background title drops the image out of the Cell count and defaults to Crop", () => {
  const source =
    '---\ntheme: @speechdeck/themes/harbour\n---\n# Talk title\n\n![skyline](./skyline.jpg "background")\n';
  const { deck, diagnostics } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(diagnostics).toEqual([]);
  expect(slide?.cells).toHaveLength(1);
  expect(slide?.cells[0]?.blocks[0]).toMatchObject({ kind: "heading", text: "Talk title" });
  expect(slide?.background).toMatchObject({ src: "./skyline.jpg", fit: "crop", focus: "center" });
  expect(resolveFrame(deck, { to: "1" }).layout).toBe("cover");
});

test("parseDeck: a background title honours an explicit fit instead of defaulting to Crop", () => {
  const source =
    '---\ntheme: @speechdeck/themes/harbour\n---\n## Section\n\n![skyline](./skyline.jpg "background contain")\n';
  const { deck } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.background).toMatchObject({ fit: "contain" });
});

test("parseDeck: H4 + image, either order, auto-picks Caption; the Caption text is the H4 Cell, not the title string", () => {
  const firstOrder =
    '---\ntheme: @speechdeck/themes/harbour\n---\n#### A caption\n\n![a dog](./dog.jpg "dim")\n';
  const { deck: deckA } = parseDeck(firstOrder, files);
  expect(deckA.slides[0]?.cells).toHaveLength(2);
  expect(resolveFrame(deckA, { to: "1" }).layout).toBe("caption");
  expect(deckA.slides[0]?.cells[0]).toMatchObject({
    blocks: [{ kind: "heading", depth: 4, text: "A caption" }],
  });

  const secondOrder =
    "---\ntheme: @speechdeck/themes/harbour\n---\n![a dog](./dog.jpg)\n\n#### A caption\n";
  const { deck: deckB } = parseDeck(secondOrder, files);
  expect(resolveFrame(deckB, { to: "1" }).layout).toBe("caption");
});

test("resolveFrame: travel t advances across participating Slides and does not reset on a hard cut", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n# One\n---\n## Two\n---\n## Three\n---\n## Four\n";
  const { deck } = parseDeck(source, files);

  // Every enter defaults to cut, so every Arrival below is a hard cut; t still climbs
  // to 1 instead of resetting to 0 at each Slide.
  expect(resolveFrame(deck, { to: "1" }).t).toBe(0);
  expect(resolveFrame(deck, { to: "2" }).t).toBeCloseTo(1 / 3);
  expect(resolveFrame(deck, { to: "3" }).t).toBeCloseTo(2 / 3);
  expect(resolveFrame(deck, { to: "4" }).t).toBe(1);

  // t is a fact about the destination Slide alone; the Arrival's origin does not shift it.
  expect(resolveFrame(deck, { to: "3", from: "2" }).t).toBe(resolveFrame(deck, { to: "3" }).t);
});

test("resolveFrame: a Background Slide does not consume a step of travel; a Crop Cell still does", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "# One",
    "---",
    "## Two",
    "",
    '![skyline](./skyline.jpg "background")',
    "---",
    '![a dog](./dog.jpg "crop")',
    "---",
    "## Four",
  ].join("\n");
  const { deck } = parseDeck(source, files);

  const one = resolveFrame(deck, { to: "1" });
  const two = resolveFrame(deck, { to: "2" });
  const three = resolveFrame(deck, { to: "3" });
  const four = resolveFrame(deck, { to: "4" });

  expect(one.stop).toBe("consumed");
  expect(two.stop).toBe("skipped");
  expect(two.t).toBe(one.t);
  expect(three.stop).toBe("consumed");
  expect(three.t).toBeGreaterThan(two.t);
  expect(four.t).toBe(1);
});

test("parseDeck: an inline fence is a code Cell whose bytes come from the fence body", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "```ts",
    "const x = 1;",
    "",
    "const y = 2;",
    "```",
  ].join("\n");
  const { deck, diagnostics } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(diagnostics).toEqual([]);
  expect(slide?.cells).toHaveLength(1);
  expect(slide?.cells[0]?.blocks[0]).toMatchObject({
    kind: "code",
    lang: "ts",
    source: { from: "fence", bytes: "const x = 1;\n\nconst y = 2;" },
  });
  expect(resolveFrame(deck, { to: "1" }).layout).toBe("solo");
});

test("parseDeck: a fence with no info string is a code Cell with an empty language", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n```\nplain\n```\n";
  const { deck } = parseDeck(source, files);
  expect(deck.slides[0]?.cells[0]?.blocks[0]).toMatchObject({
    kind: "code",
    lang: "",
    source: { from: "fence", bytes: "plain" },
  });
});

test("parseDeck: a file-backed code Cell is spelled lang, path, empty body", () => {
  const codeFiles = filesWith({ "./demos/counter.ts": "let n = 0;\nexport { n };\n" });
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n```ts ./demos/counter.ts\n```\n";
  const { deck, diagnostics } = parseDeck(source, codeFiles);
  const slide = deck.slides[0];

  expect(diagnostics).toEqual([]);
  expect(slide?.cells[0]?.blocks[0]).toMatchObject({
    kind: "code",
    lang: "ts",
    source: { from: "file", path: "./demos/counter.ts", bytes: "let n = 0;\nexport { n };\n" },
  });
});

test("parseDeck: a #region on the path shows only that named span; the marker lines are not shown", () => {
  const content = [
    "const before = 1;",
    "// #region adapter",
    "function adapter() {}",
    "// #endregion",
    "const after = 2;",
  ].join("\n");
  const codeFiles = filesWith({ "./demos/counter.ts": content });
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n```ts ./demos/counter.ts#adapter\n```\n";
  const { deck, diagnostics } = parseDeck(source, codeFiles);
  const slide = deck.slides[0];

  expect(diagnostics).toEqual([]);
  expect(slide?.cells[0]?.blocks[0]).toMatchObject({
    kind: "code",
    source: {
      from: "file",
      path: "./demos/counter.ts",
      region: "adapter",
      bytes: "function adapter() {}",
    },
  });
});

test("parseDeck: a body and a path together is a Lint; the path still wins", () => {
  const codeFiles = filesWith({ "./demos/counter.ts": "let n = 0;" });
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n```ts ./demos/counter.ts\nconst stray = true;\n```\n";
  const { deck, diagnostics } = parseDeck(source, codeFiles);

  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toMatchObject({ kind: "body-and-path", slide: "1" });
  expect(deck.slides[0]?.cells[0]?.blocks[0]).toMatchObject({
    source: { from: "file", path: "./demos/counter.ts", bytes: "let n = 0;" },
  });
});

test("parseDeck: duplicate Region names in one file are a Lint", () => {
  const content = [
    "// #region adapter",
    "const a = 1;",
    "// #endregion",
    "// #region adapter",
    "const b = 2;",
    "// #endregion",
  ].join("\n");
  const codeFiles = filesWith({ "./demos/dupes.ts": content });
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n```ts ./demos/dupes.ts#adapter\n```\n";
  const { diagnostics } = parseDeck(source, codeFiles);

  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toMatchObject({ kind: "duplicate-region", slide: "1" });
});

test("parseDeck: a line range is not a Region — an unmatched name throws instead of yielding a Deck", () => {
  const codeFiles = filesWith({ "./demos/counter.ts": "const x = 1;\nconst y = 2;\n" });
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n```ts ./demos/counter.ts#1-2\n```\n";
  expect(() => parseDeck(source, codeFiles)).toThrow();
});

test("parseDeck: a code Cell path that is a package name does not yield a Deck", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n```ts lodash\n```\n";
  expect(() => parseDeck(source, files)).toThrow();
});

test("parseDeck: a code Cell path that is a URL does not yield a Deck", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n```ts https://example.com/counter.ts\n```\n";
  expect(() => parseDeck(source, files)).toThrow();
});

test("parseDeck: a blank line inside a fence does not split the code Cell in two", () => {
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n## Heading\n\n```ts\none\n\ntwo\n```\n";
  const { deck } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.cells).toHaveLength(2);
  expect(slide?.cells[1]?.blocks[0]).toMatchObject({
    kind: "code",
    source: { from: "fence", bytes: "one\n\ntwo" },
  });
});

test("parseDeck: an `embed` fence is an Embed Cell carrying a specifier, not a code Cell", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n```embed ./demos/counter.ts\n```\n";
  const { deck, diagnostics } = parseDeck(source, files);

  expect(diagnostics).toEqual([]);
  expect(deck.slides[0]?.cells[0]?.blocks[0]).toEqual({
    kind: "embed",
    specifier: "./demos/counter.ts",
    props: null,
  });
});

test("parseDeck: an Embed's YAML body becomes its props", () => {
  const source =
    '---\ntheme: @speechdeck/themes/harbour\n---\n```embed ./demos/counter.ts\ncount: 3\nlabel: "Starting count"\nenabled: true\n```\n';
  const { deck } = parseDeck(source, files);

  expect(deck.slides[0]?.cells[0]?.blocks[0]).toMatchObject({
    kind: "embed",
    specifier: "./demos/counter.ts",
    props: { count: 3, label: "Starting count", enabled: true },
  });
});

test("parseDeck: an Embed specifier may be a package name — there is no reserved embeds folder", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n```embed some-widget\n```\n";
  const { deck } = parseDeck(source, files);

  expect(deck.slides[0]?.cells[0]?.blocks[0]).toMatchObject({
    kind: "embed",
    specifier: "some-widget",
  });
});

test("parseDeck: an Embed at the same path as a file-backed code Cell carries only the path — the code Cell alone holds the bytes, so they cannot drift apart", () => {
  const codeFiles = filesWith({ "./demos/counter.ts": "let n = 0;\nexport { n };\n" });
  const source =
    "---\ntheme: @speechdeck/themes/harbour\n---\n```ts ./demos/counter.ts\n```\n\n```embed ./demos/counter.ts\n```\n";
  const { deck, diagnostics } = parseDeck(source, codeFiles);
  const [codeCell, embedCell] = deck.slides[0]?.cells ?? [];

  expect(diagnostics).toEqual([]);
  expect(codeCell?.blocks[0]).toMatchObject({
    kind: "code",
    source: { from: "file", path: "./demos/counter.ts", bytes: "let n = 0;\nexport { n };\n" },
  });
  expect(embedCell?.blocks[0]).toEqual({
    kind: "embed",
    specifier: "./demos/counter.ts",
    props: null,
  });
});

test("parseDeck: an Embed fence with no specifier does not yield a Deck", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n```embed\n```\n";
  expect(() => parseDeck(source, files)).toThrow();
});

test("parseDeck: a bare --- inside a fenced code block does not split the Deck (issue #84)", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "# One",
    "",
    "```yaml",
    "a: 1",
    "---",
    "b: 2",
    "```",
  ].join("\n");
  const { deck, diagnostics } = parseDeck(source, files);

  expect(diagnostics).toEqual([]);
  expect(deck.slides).toHaveLength(1);
  expect(deck.slides[0]?.cells).toHaveLength(2);
  expect(deck.slides[0]?.cells[1]?.blocks[0]).toMatchObject({
    kind: "code",
    lang: "yaml",
    source: { from: "fence", bytes: "a: 1\n---\nb: 2" },
  });
});

test("parseDeck: a bare --- inside a ~~~ fence does not split the Deck either", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "~~~yaml",
    "a: 1",
    "---",
    "b: 2",
    "~~~",
  ].join("\n");
  const { deck } = parseDeck(source, files);

  expect(deck.slides).toHaveLength(1);
  expect(deck.slides[0]?.cells[0]?.blocks[0]).toMatchObject({
    kind: "code",
    lang: "yaml",
    source: { from: "fence", bytes: "a: 1\n---\nb: 2" },
  });
});

test("parseDeck: a longer outer fence protects a shorter fence-looking line inside it, including one that looks like a Slide separator", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "````md",
    "```yaml",
    "a: 1",
    "---",
    "b: 2",
    "```",
    "````",
  ].join("\n");
  const { deck } = parseDeck(source, files);

  expect(deck.slides).toHaveLength(1);
  expect(deck.slides[0]?.cells[0]?.blocks[0]).toMatchObject({
    kind: "code",
    lang: "md",
    source: { from: "fence", bytes: "```yaml\na: 1\n---\nb: 2\n```" },
  });
});

test("parseDeck: a --- outside any fence still starts a new Slide, unchanged", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "```yaml",
    "a: 1",
    "```",
    "---",
    "## Second",
  ].join("\n");
  const { deck } = parseDeck(source, files);

  expect(deck.slides).toHaveLength(2);
  expect(deck.slides[1]?.cells[0]?.blocks[0]).toMatchObject({ kind: "heading", text: "Second" });
});

test("parseDeck: *** and ___ are never Slide separators, inside or outside a fence", () => {
  const source = [
    "---",
    "theme: @speechdeck/themes/harbour",
    "---",
    "# One",
    "",
    "***",
    "",
    "___",
    "",
    "```txt",
    "***",
    "___",
    "```",
  ].join("\n");
  const { deck } = parseDeck(source, files);

  expect(deck.slides).toHaveLength(1);
});

function codeBlock(lang: string, bytes: string): CodeBlock {
  return { kind: "code", lang, source: { from: "fence", bytes }, html: "" };
}

test("matchCode: same-language code Cells pair to morph, with a deterministic key", () => {
  const from = codeBlock("ts", "let n = 0;");
  const to = codeBlock("ts", "let n = 1;");

  const match = matchCode(from, to);

  expect(match.pairing).toBe("morph");
  expect(matchCode(from, to)).toEqual(match);
});

test("matchCode: a language swap does not pair — it is not the same Cell persisting", () => {
  const from = codeBlock("ts", "let n = 0;");
  const to = codeBlock("py", "n = 0");

  expect(matchCode(from, to).pairing).toBe("none");
});

test("matchCode: a different pairing mints a different key — the key only has to agree between this transition's two elements, not across the Deck", () => {
  const from = codeBlock("ts", "let n = 0;");
  const toA = codeBlock("ts", "let n = 1;");
  const toB = codeBlock("ts", "let n = 2;");

  expect(matchCode(from, toA).key).not.toBe(matchCode(from, toB).key);
});

test("matchCode: a file-backed Cell keys off its path — an Embed at the same path runs the same bytes, so the path alone already identifies it", () => {
  const from: CodeBlock = {
    kind: "code",
    lang: "ts",
    source: { from: "file", path: "./demos/counter.ts", bytes: "let n = 0;" },
    html: "",
  };
  const to: CodeBlock = {
    kind: "code",
    lang: "ts",
    source: { from: "file", path: "./demos/counter.ts", bytes: "let n = 1;" },
    html: "",
  };
  const toOtherFile: CodeBlock = {
    kind: "code",
    lang: "ts",
    source: { from: "file", path: "./demos/other.ts", bytes: "let n = 0;" },
    html: "",
  };

  expect(matchCode(from, to).pairing).toBe("morph");
  expect(matchCode(from, to).key).not.toBe(matchCode(from, toOtherFile).key);
});
