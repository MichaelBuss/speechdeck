# PROTOTYPE — API sketchbook

Throwaway. Answers: *what are the actual type signatures of the vanilla core and the Solid adapter?*

Winner: **A — Snapshot**. Core is `resolveFrame(deck, arrival)`. The Solid adapter's router is *now*. Authors write `<Present deck={deck} />`. B (Session) and C (compiled routes) were the rejected shapes.

Locked signatures: `src/locked-api.ts` (`@speechdeck/core` + vite) and `src/locked-solid.ts` (`@speechdeck/solid`).

```sh
cd prototypes/api-sketchbook
pnpm install
pnpm dev
```

Then open http://localhost:5173/

- Bottom bar cycles **shapes** (also `[` `]`). A is the one that ships.
- Step pills, or left/right arrows, walk **Boot → First paint → Connected → Embed → Present → Skip**.
- **Skip** on C is the compile lie. **Boot** on B is the dual current. **Present** on A is live **Embed** vs `mode: "preview"`.

Not production. No tests. ADR: `docs/adr/0013-resolve-frame-arrival-solid-owns-router.md`.
