# PROTOTYPE — transition model

Throwaway. Answers: *when two Slides are connected, what gets a `view-transition-name`, and what happens when the presenter interrupts?*

Three **name-authority** variants, switchable via `?variant=`:

- **A — Identity** (recommended): a heading with the same text, an image with the same src, a code match key. Everything else rides the root crossfade.
- **B — Slots**: Cell index is the identity. Slot 0 morphs into slot 0 even if a heading becomes a photo.
- **C — Roles**: one title, one code, one figure per Slide. Extras unnamed.

Interruption and resize are independent HUD controls so they can be felt without confounding the naming question.

```sh
cd prototypes/transition-model
pnpm install
pnpm dev
```

Then open http://localhost:5173/

- Left/right arrows change **Slides**. Mash them. That's the point.
- Bottom bar cycles **variants** (also `[` `]`).
- `I` cycles interrupt: skip-to-end / throttle / queue.
- Non-Fill presets are resizable — drag a corner mid-transition. `R` toggles skip vs hold.
- `P` toggles honouring `prefers-reduced-motion`. `M` toggles theme-owned `view-transition-class` motion.

Green outlines are assigned names, not part of the Slide. Hard cuts have none.

Not production. No tests. The portable pieces are `src/names.ts` and `src/interrupt.ts`.
