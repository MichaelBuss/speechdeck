# SpeechDeck

**SpeechDeck** is a web-based presentation framework built on iA Presenter's mental model — you write a document, the headings reach the audience, the **Speech** stays with the speaker, and the layout reflows to fill whatever screen it lands on. It adds the things a developer talk needs that iA Presenter lacks: live web **Embeds**, code on **Slides**, and inline **Marks**.

This file is the project's glossary and nothing else. No implementation details, no decisions, no plans — those live in `docs/adr/` and in the [wayfinder map](https://github.com/MichaelBuss/speechdeck/issues/1). Terms are added the moment they are resolved, never batched up.

## Language

**SpeechDeck**:
The presentation framework.

**Speech**:
The spoken narrative; untagged prose in the source, not shown to the audience.
_Avoid_: note, speaker notes, notes

**Slide**:
An audience-facing unit of the document; it reflows to the viewport and has no fixed canvas.
_Avoid_: scene, page, beat, card

**Cell**:
The unit the layout engine counts on a **Slide**; one or more adjacent audience-visible Markdown blocks with no blank line between them.
_Avoid_: block, slot

**Deck**:
A presentation; a Markdown source of **Slides**.

**Frontmatter**:
YAML metadata for a **Deck** or a **Slide**; facts that cannot live in the prose without lying.

**Promotion**:
A reserved `<!--on-->` immediately before a paragraph, list or quote, putting that block on the **Slide**.

**Comment**:
Authoring-private text in an HTML comment; never shown on a **Slide** or in presenter view.
_Avoid_: `//`, note

**Mark**:
An inline annotation on audience-visible prose, drawn in the rough-marker style.
_Avoid_: v-mark

**Embed**:
A live web mount on a **Slide**; always a module specifier (a repo path or an importable JS URL) with serializable props. A guest may put an iframe inside the host element; the framework does not.
_Avoid_: island, demo, widget, youtube (as a block type)

## Relationships

- **SpeechDeck** is the framework; a **Deck** is one presentation written in it.
- **Speech** is the only presenter-facing channel; there is no Note.
- A **Deck** is a sequence of **Slides**; each **Slide** carries its **Speech**. A `---` starts a new **Slide**. Extra blank lines do not.
- A **Deck**'s opening **Frontmatter** holds `theme` in v0. The first `#` is the title; there is no `title` key.
- A **Slide** may have **Frontmatter** immediately after its `---`, reserved for overrides later tickets will name. Empty **Frontmatter** is omitted. `theme` is **Deck**-only.
- A **Slide** is made of **Cells**. A blank line starts a new **Cell**. **Speech** and **Comments** do not occupy a **Cell**. "Block" is CommonMark's word, not ours.
- Headings, tables, images, fenced code, block math, and **Embeds** appear on a **Slide** by themselves; paragraphs, lists and quotes remain **Speech** unless **Promotion** precedes them.
- An **Embed** is a fenced block with info string `embed` and a module specifier; optional YAML body for props. It is a **Cell**. YouTube and other framed pages are the same fence, pointing at an iframe guest (typically scaffold-supplied), not a second block type.
- Images and **Embeds** are files in the repo, referenced by path; there is no media library.
- `<!--on-->` is reserved for **Promotion**; any other HTML comment is a **Comment**.
- A **Mark** is spelled `<mark>` or `<mark data-mark="circle">`. Types: `underline`, `circle`, `highlight`, `box`, `strike-through`. Default type is `underline`. **Marks** are not used inside fenced code.
- The source of a **Deck** is CommonMark Markdown with YAML **Frontmatter** — not MDX, and not TypeScript.

## Example dialogue

> **Dev:** "If I write a paragraph, does the audience see it?"
> **Domain expert:** "No — that's **Speech**. Put `<!--on-->` on the line before it; that's **Promotion**. A `<!-- check the demo wifi -->` is a **Comment** and nobody sees it while presenting."

## Flagged ambiguities

- **theme vs template** — iA uses both words for different things; we currently use only "theme", possibly for both. Owned by [Theme model and the DOM contract themes style](https://github.com/MichaelBuss/speechdeck/issues/10).
