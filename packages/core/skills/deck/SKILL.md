---
name: deck
description: >
  How to author a SpeechDeck Deck: the Markdown source format parsed by
  `parseDeck` — Deck Frontmatter (`theme` required; `appearance`; `motion`),
  Slides split by a bare `---`, Slide Frontmatter (`layout`, `enter`), Cells
  vs Speech, Promotion (`<!--on-->`) vs Comment, the auto Layout pick (cover,
  section, solo, split-2, split-3, grid, caption) and the `layout:` override,
  and reading `parseDeck`'s `diagnostics` (Lint kinds: connected-on-first,
  duplicate-region, body-and-path, impossible-layout, unknown-image-token).
  Load when writing or editing a `deck.md`, choosing or debugging a Slide's
  Layout, or interpreting a Lint. Refuse is not here — it is a paint fact
  only Inspect can show.
metadata:
  type: core
  library: "@speechdeck/core"
  library_version: "0.0.0"
---

# Authoring a Deck

A **Deck** is a single Markdown file with YAML **Frontmatter**, parsed by
`parseDeck`. There is no separate authoring API — read the parsed shape back
to check your work.

## Setup

```ts
import { parseDeck, type FileMap } from "@speechdeck/core";

const files: FileMap = {
  read(relative) {
    // "theme.json" for the Deck's theme specifier, and any file-backed code
    // Cell path or #region — resolve each relative to the Deck file.
    throw new Error(`Cannot resolve "${relative}"`);
  },
};

const { deck, diagnostics } = parseDeck(deckSource, files);
```

`parseDeck` throws only when the result cannot be a Deck at all — no
Frontmatter, no `theme`, or a `theme` specifier whose `theme.json` is missing
or incomplete. Everything else that is wrong but still yields a Deck comes
back as a `diagnostics` entry.

## Core Patterns

### 1. Deck Frontmatter vs Slide Frontmatter

The opening Frontmatter (immediately after the first `---`) is Deck-wide:

```text
---
theme: @speechdeck/themes/harbour
appearance: dark
motion: auto
---
```

- `theme` is a specifier (a relative path or a package name) and is
  required — there is no default and no `theme` id.
- `appearance` is `light`, `dark`, or `auto`; default `dark`.
- `motion` is `auto` or `always`; default `auto`.

A `---` line inside the body starts a new Slide. That Slide may have its own
Frontmatter immediately after its `---`:

```text
---
layout: split-2
enter: connected
---
```

- `layout` and `enter` are Slide-only; `theme`/`appearance`/`motion` never
  appear here.
- `enter` is `cut` (default) or `connected`. `connected` on the first Slide
  is a Lint (`connected-on-first`) — the Arrival still hard-cuts.

### 2. Cells vs Speech vs Comment

A blank line starts a new **Cell**. Headings, tables, images, fenced code,
and Embeds are Cells on their own. Paragraphs, lists, and quotes are
**Speech** by default — they go to Presenter view, not the Slide — unless a
`<!--on-->` line immediately precedes the block (**Promotion**), which puts
it on the Slide as a Cell instead:

```text
<!--on-->
This paragraph is promoted onto the Slide.

This paragraph is not — it stays Speech.

<!-- remind myself to slow down here -->
```

Any other HTML comment is a **Comment**: author-private, never shown
anywhere. Only the exact `<!--on-->` line triggers Promotion.

### 3. Layout: auto pick and override

`parseDeck` (and `resolveFrame`) compute the auto Layout from a Slide's
Cells:

| Cells | Auto Layout                                          | Special case                         |
| ----- | ---------------------------------------------------- | ------------------------------------ |
| 0–1   | `cover` (H1-only), `section` (H2+ only), else `solo` |                                      |
| 2     | `split-2`                                            | H4 + image, either order → `caption` |
| 3     | `split-3`                                            |                                      |
| 4+    | `grid`                                               |                                      |

A `background` image drops out of the Cell count, so a heading over a photo
is still `cover`/`section`, not `split-2`.

A Slide's `layout:` Frontmatter, when present, wins — but if it does not fit
the actual Cell count/shape (e.g. `layout: cover` on two Cells), that is an
`impossible-layout` diagnostic and the auto Layout still renders. Do not
treat this as a hard error: the returned `Frame.layout` is always the Layout
that actually painted, and `Frame.layoutAuto` is always the auto pick, even
when `layoutSource` is `"override"`.

### 4. Reading diagnostics — and where Refuse lives

`parseDeck` returns `{ deck, diagnostics }`. `diagnostics` is a
`readonly Diagnostic[]`, each `{ kind, slide?, message }`. This is the whole
introspection surface — there is no separate lint command, no JSON report
function, and no `console.log` from core. The closed `kind` union is:

- `connected-on-first` — `enter: connected` on Slide 1; the Arrival is still
  a hard cut.
- `duplicate-region` — two `#region name` spans with the same name in one
  file-backed code Cell's source file.
- `body-and-path` — a code fence has both a path token and a non-empty body;
  the file's bytes are used, not the fence body.
- `impossible-layout` — a Slide's `layout:` override does not fit its Cells;
  auto still renders.
- `unknown-image-token` — an image title token that isn't `background`,
  `contain`/`crop`, a Focus, or a Look.

If you need to tell an author their Slide doesn't fit at a given viewport,
that is **Refuse**, and it is not a Lint and never appears in `diagnostics` —
core has no DOM to measure against. Point them at **Inspect**
(`pnpm inspect`, or `SPEECHDECK_INSPECT=1 vite`) to see it.

## Common Mistakes

### [HIGH] Expecting Refuse in `diagnostics`

Wrong:

```ts
const { diagnostics } = parseDeck(deckSource, files);
const refused = diagnostics.filter((d) => d.kind === "refuse"); // no such kind
```

Correct: run Inspect and read its readout — Refuse is measured at a
viewport after layout, not detected while parsing text.

There is no `kind: "refuse"` and no `measureRefuse` export; core cannot know
what a real viewport reflows to.

### [HIGH] Assuming an impossible `layout:` override is fatal or wins

Wrong: treating an `impossible-layout` diagnostic as a reason to stop, or
assuming `resolveFrame(...).layout` equals the Frontmatter value you set.

Correct: `impossible-layout` is a Lint, not a thrown error — the Deck still
parses, and the auto Layout still renders that Slide. Read
`Frame.layoutAuto` for what actually painted; `Frame.layoutSource` just
tells you the override was attempted.

### [MEDIUM] Writing a paragraph and expecting the audience to see it

Wrong:

```text
This is the point I want to make.
```

Correct:

```text
<!--on-->
This is the point I want to make.
```

Without `<!--on-->` immediately before it, a paragraph, list, or quote is
Speech — it renders in Presenter view only, never on the Slide.

### [MEDIUM] Pasting code into the fence when a code Cell should track a file

Wrong:

````markdown
```ts
function counter() {
  /* ... */
}
```
````

If an `embed` Cell already runs `./demos/counter.ts`, a hand-typed fence
body is a second, driftable copy. Point the code Cell at the same path
instead, with an empty body:

````markdown
```ts ./demos/counter.ts

```
````

A body and a path together is a `body-and-path` diagnostic, and the file's
bytes are shown regardless of what the body said.
