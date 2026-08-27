# PROTOTYPE — theme model and DOM contract

Throwaway. Answers: _what is a theme on disk, and which rendered DOM is public API a theme may rely on?_

Winner: **A — Manifest tokens**, with optional travel, **Background** skip, oklab mix, `light-dark()` + `color-scheme` for **Appearance**. B and C were the rejected shapes.

```sh
cd prototypes/theme-model
pnpm install
pnpm dev
```

Then open http://localhost:5173/

- Bottom bar cycles **variants** (also `?variant=A|B|C`).
- Left/right arrows change **Slides** — gradient travel is the thing to feel.
- `D` toggles deck appearance (where the variant allows it).

Not production. No tests. The portable piece is `src/travel.ts`.
