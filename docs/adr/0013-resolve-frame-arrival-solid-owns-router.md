# resolveFrame(Arrival); Solid owns the router

Core is a document plus `resolveFrame(deck, arrival): Frame`. Nobody in core stores *now*. The Solid adapter's router is the current **Slide**; authors write `<Present deck={deck} />` and never see TanStack. A Session that owns navigation is a second current next to the URL, and view transitions only start from a navigation. Compiled routes bake `Frame.enter` against document order, so a skip lies.

v0 ships five packages: `@speechdeck/core`, `@speechdeck/solid`, `@speechdeck/vite`, `@speechdeck/create`, `@speechdeck/themes`. The parse result is HTML, not a Markdown AST. A **Slide** is addressed by its 1-based place in the **Deck**. **Frame** carries identity names; there is no `mintNames` export and no `Adapter` interface.

Prototype: `prototypes/api-sketchbook` (winner A — Snapshot).
