# Presentation Stack

A web-based presentation framework built on iA Presenter's mental model — you write a document, the headings reach the audience, the prose stays with the speaker, and the layout reflows to fill whatever screen it lands on. It adds the things a developer talk needs that iA Presenter lacks: live web embeds, code on slides, and inline marks.

This file is the project's glossary and nothing else. No implementation details, no decisions, no plans — those live in `docs/adr/` and in the [wayfinder map](https://github.com/MichaelBuss/presenter-wayfinder/issues/1). Terms are added the moment they are resolved, never batched up.

## Language

Deliberately empty. The vocabulary is decided in [The authoring model](https://github.com/MichaelBuss/presenter-wayfinder/issues/8) and sharpened by the tickets that follow it. Writing terms here before that ticket runs would pre-empt the decision it exists to make.

## Relationships

Added as terms are resolved.

## Flagged ambiguities

Terms already known to be in tension. These are open questions for the authoring-model ticket, not resolutions:

- **cell vs block** — iA Presenter calls the unit its layout engine counts a *cell*; *block* is the ordinary word in Markdown tooling, and the layout resolver reads "number of blocks". One of them has to win.
- **speech vs note** — iA separates *speech*, the spoken narrative that is the default for untagged prose, from *speaker notes*. This project has so far used "note" loosely for both, which hides the distinction that makes the whole model work.
- **slide vs scene** — if the deck reflows and has no fixed canvas, *slide* may be importing exactly the mental model we are trying to escape.
- **theme vs template** — iA uses both words for different things; we currently use only "theme", possibly for both.
- **embed** — the seam is settled, but the noun for the thing it mounts is not.
- **mark** — borrowed from Slidev's `v-mark` for inline annotation; needs a definition that does not lean on Vue.
