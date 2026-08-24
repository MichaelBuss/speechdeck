# PROTOTYPE — reflowing layout engine

Throwaway. Answers: *does a Slide fill any viewport without a canvas, with seven Layouts, CSS-only type, and refuse-on-overflow?*

```sh
cd prototypes/reflowing-layout
pnpm install
pnpm exec vite
```

Then open http://localhost:5173/

Drag the stage corner (any preset except Fill), or use the viewport pills. Left/right arrows change slides. The green HUD is the resolver’s output, not part of the Slide.

Not production. No tests. The only piece meant to be lifted later is `src/pick-layout.ts`.
