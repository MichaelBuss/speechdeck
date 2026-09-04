import { expect, test } from "vitest";
import { matchCode, parseDeck, resolveFrame, type FileMap } from "./index.ts";

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

test("parseDeck: two Slides may share a heading; they do not share an address", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n## Same\n---\n## Same\n";
  const { deck } = parseDeck(source, files);

  expect(deck.slides).toHaveLength(2);
  expect(deck.slides[0]?.id).toBe("1");
  expect(deck.slides[1]?.id).toBe("2");
  expect(deck.slides[0]?.cells[0]?.blocks[0]).toMatchObject({ kind: "heading", text: "Same" });
  expect(deck.slides[1]?.cells[0]?.blocks[0]).toMatchObject({ kind: "heading", text: "Same" });
});

test("parseDeck: <!--on--> immediately before a paragraph puts it on the Slide as a Cell", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n<!--on-->\nThis is promoted.\n";
  const { deck } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.speech.blocks).toHaveLength(0);
  expect(slide?.cells).toHaveLength(1);
  expect(slide?.cells[0]?.blocks[0]).toMatchObject({
    kind: "prose",
    html: "<p>This is promoted.</p>",
  });
  expect(resolveFrame(deck, { to: "1" }).layout).toBe("solo");
});

test("parseDeck: <!--on--> immediately before a list or quote promotes it too", () => {
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
  const { deck } = parseDeck(source, files);
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
});

test("parseDeck: a blank line between <!--on--> and the block cancels the Promotion", () => {
  const source = "---\ntheme: @speechdeck/themes/harbour\n---\n<!--on-->\n\nNot promoted.\n";
  const { deck } = parseDeck(source, files);
  const slide = deck.slides[0];

  expect(slide?.cells).toHaveLength(0);
  expect(slide?.speech.blocks[0]).toMatchObject({
    kind: "paragraph",
    html: "<p>Not promoted.</p>",
  });
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

test("matchCode is not implemented", () => {
  const block = {
    kind: "code" as const,
    lang: "ts",
    source: { from: "fence" as const, bytes: "" },
    html: "",
  };
  expect(() => matchCode(block, block)).toThrow("not implemented");
});
