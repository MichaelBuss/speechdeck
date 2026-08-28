# Intent skills in core, not create

v0 ships two Agent Skills as procedures — authoring a **Deck**, writing an **Embed** — inside `@speechdeck/core` (`skills/deck`, `skills/embed`). Distribution is TanStack Intent: they version with the package and are discovered from `node_modules`. `init` writes `intent.skills: ["@speechdeck/*"]` and an `AGENTS.md` loading block; it does not run the Intent CLI (ADR 0007: files only, no network).

Rejected: a **Theme**, presenting, or writing-taste skill; a sixth `@speechdeck/skills` package; skills in `@speechdeck/create` (not a runtime dep, so Intent would not find them after `init`); copying `SKILL.md` into the scaffold; restating the README or inventing a debug API. The **Deck** skill reads `parseDeck`'s diagnostics and points **Refuse** at **Inspect** (ADR 0018) — that is the types, not a dump.
