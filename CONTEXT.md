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

**Region**:
A named span inside a source file; a code **Cell** may show one instead of the whole file.
_Avoid_: snippet, excerpt, line range, fold

**Layout**:
A named arrangement of **Cells** on a **Slide**. v0 ships Cover, Section, Solo, Split-2, Split-3, Grid, and Caption.
_Avoid_: template, theme (those are not arrangements)

**Contain**:
An image mode that shows the whole file in the box; the leftover is letterboxed.
_Avoid_: fit, object-fit contain

**Crop**:
An image mode that fills the box; the overflow is clipped.
_Avoid_: cover, fit, fill, object-fit cover

**Focus**:
The 9-cell origin of an image: `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`.
_Avoid_: object-position, anchor, crop origin

**Background**:
An image that is the **Slide**'s backdrop, not a **Cell**.
_Avoid_: background-image layout (it is a role, not a Layout)

**Look**:
A named built-in treatment on an image. v0 ships `dim` and `blur`, combinable.
_Avoid_: style, filter, effect, frost

**Theme**:
The named look of a **Deck**: type, colour, and optional travelling background.
_Avoid_: template

**Appearance**:
Light, dark, or auto. A **Deck** picks one; a **Theme** provides both light and dark. Default is dark. Auto follows the environment; light and dark do not.

**Motion**:
Auto or always. A **Deck** picks one. Default is auto. Auto follows the environment's motion preference; always runs connected motion regardless.
_Avoid_: animation, none, never, full, all, on

## Relationships

- **SpeechDeck** is the framework; a **Deck** is one presentation written in it. A **Deck** lives in a repo that depends on **SpeechDeck**; it is not a file a binary is pointed at.
- **Speech** is the only presenter-facing channel; there is no Note.
- A **Deck** is a sequence of **Slides**; each **Slide** carries its **Speech**. A `---` starts a new **Slide**. Extra blank lines do not.
- A **Deck**'s opening **Frontmatter** holds `theme`, `appearance`, and `motion` in v0. The first `#` is the title; there is no `title` key. `appearance` is `light`, `dark`, or `auto`. Default is dark. `motion` is `auto` or `always`. Default is auto. `always` does not invent motion on a hard cut.
- A **Deck** has one **Theme**. A **Theme** may be a single colour; travelling through a sequence of colours is optional.
- A **Theme** paints through contained handles — colour, type, accents, and how connected motion looks — not by picking a **Layout**. A **Theme** does not turn **Motion** on or off.
- **SpeechDeck** ships built-in **Themes**; at least one uses colours outside sRGB.
- A **Background** does not consume a step of that travel; it keeps the current colour so **Looks** still have something to dim against. A Crop **Cell** still consumes a step.
- A **Slide** may have **Frontmatter** immediately after its `---`. In v0 the only key is `layout`. Empty **Frontmatter** is omitted. `theme`, `appearance`, and `motion` are **Deck**-only.
- A **Slide** is made of **Cells**. A blank line starts a new **Cell**. **Speech** and **Comments** do not occupy a **Cell**. "Block" is CommonMark's word, not ours.
- Headings, tables, images, fenced code, block math, and **Embeds** appear on a **Slide** by themselves; paragraphs, lists and quotes remain **Speech** unless **Promotion** precedes them.
- Fenced code is a **Cell**. When two **Slides** are connected, a heading with the same text persists, an image with the same src persists, and their code **Cells** pair by index; matched code morphs. A leftover **Cell**, and any code on a hard-cut, does not. Authors do not name the pairing. There is no match id on the fence.
- A code **Cell**'s bytes are the fence body, or a path relative to the **Deck** — a file, or a **Region** of one. An **Embed** at that same path runs the file. Those bytes cannot drift. A **Region** is `#region name` … `#endregion` in that file; duplicate names in one file are an authoring error. A line range is not a **Region**. `#name` is only on the code fence; the **Embed** has no fragment.
- A file-backed code **Cell** is spelled with the language, then the path, and an empty body: `ts ./demos/counter.ts` or `ts ./demos/counter.ts#adapter` on the fence info string. A body and a path together is a lint error. The `#region` / `#endregion` lines are not shown. A code **Cell** path is not a package name and not a URL.
- An **Embed** is a fenced block with info string `embed` and a module specifier; optional YAML body for props. It is a **Cell**. YouTube and other framed pages are the same fence, pointing at an iframe guest (typically scaffold-supplied), not a second block type.
- Images are files in the repo, referenced by path relative to the **Deck** file; there is no media library. An **Embed** specifier is the same kind of relative path, or a package name. There is no reserved embeds folder. A custom **Theme** is the same: a relative path from the **Deck**, or a package name.
- A **Slide** has one **Layout**, chosen from **Cell** count and types. Cover is the talk-title **Layout**; **Crop** is an image mode — they are not the same word.
- Auto **Layout**: H1-only → Cover; one heading H2+ → Section; one **Cell** otherwise → Solo; two **Cells** → Split-2, except H4 + image (either order) → Caption; three → Split-3; four or more → Grid. A **Background** is not a **Cell** and does not bump the count.
- A **Slide** **Frontmatter** `layout:` key, when present, wins. Value is one of `cover`, `section`, `solo`, `split-2`, `split-3`, `grid`, `caption`. An impossible override is a lint error; auto still renders. The pick does not change with the viewport — CSS adapts the same **Layout**.
- A heading that fits on one line is centered; a heading that wraps is start-aligned. There is no author override.
- A **Slide** that still cannot fit its **Cells** after reflow is an authoring error: the audience never gets a scaled canvas or a scrolling **Slide**.
- An image is spelled `![alt](./file.jpg)` with an optional title of tokens, in order, all optional: `background`, then `contain | crop`, then a **Focus**, then any **Looks**. Unrecognized tokens are a lint error. Default is **Contain**, **Focus** `center`, no **Look**. A **Background** image defaults to **Crop**. Captions are an H4 **Cell**, never the title string.
- A `background` title makes that image a **Background**: it drops out of the **Cell** count, so a heading on a photo is still Cover or Section, not Split.
- `<!--on-->` is reserved for **Promotion**; any other HTML comment is a **Comment**.
- A **Mark** is spelled `<mark>` or `<mark data-mark="circle">`. Types: `underline`, `circle`, `highlight`, `box`, `strike-through`. Default type is `underline`. **Marks** are not used inside fenced code.
- The source of a **Deck** is CommonMark Markdown with YAML **Frontmatter** — not MDX, and not TypeScript.

## Example dialogue

> **Dev:** "If I write a paragraph, does the audience see it?"
> **Domain expert:** "No — that's **Speech**. Put `<!--on-->` on the line before it; that's **Promotion**. A `<!-- check the demo wifi -->` is a **Comment** and nobody sees it while presenting."
>
> **Dev:** "If I change the function on the next **Slide**, does the code morph?"
> **Domain expert:** "If those **Slides** are connected, the first code **Cell** morphs into the first. There is no id on the fence."
>
> **Dev:** "Does every **Theme** travel through colours as I advance?"
> **Domain expert:** "No. A **Theme** can be one colour for the whole **Deck**. Travel is optional."
>
> **Dev:** "If the **Slide** is a photo with a heading on it, does the colour still move?"
> **Domain expert:** "That's a **Background**. The photo is the paint, so it keeps the current colour and doesn't spend a stop. A Crop **Cell** still spends one — you can see the travelling colour around it."
>
> **Dev:** "My laptop is in light mode. Does the talk follow that?"
> **Domain expert:** "Only if the **Deck** set `appearance: auto`. Default is dark. `light` and `dark` ignore the laptop. A **Slide** does not override it."
>
> **Dev:** "My laptop asks for less motion. Does the talk go still?"
> **Domain expert:** "Only if **Motion** is `auto`. `always` still runs connected motion. Unconnected **Slides** still hard-cut. A **Slide** does not override it."
>
> **Dev:** "Can I point SpeechDeck at a Markdown file and present?"
> **Domain expert:** "No — the **Deck** is a document, but it lives in a repo that depends on **SpeechDeck**. An **Embed** is a module; a lone file has nowhere for that module to live."
>
> **Dev:** "Where do I put the demo the **Embed** loads?"
> **Domain expert:** "Next to the **Deck**, like an image — `./demos/counter.ts`. Or a package the repo already depends on. There is no special folder."
>
> **Dev:** "If I show that file's code next to the running **Embed**, and I edit the file, do they drift?"
> **Domain expert:** "No — that's the file, not a second copy. A **Region** is a named span in that file, not line numbers. A package name is something you run, not something you highlight."

## Flagged ambiguities

- **theme vs template** — resolved: there is no Template. **Theme** is the word. iA's `template.json` was inspector metadata we do not have.
