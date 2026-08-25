# PROTOTYPE — presenter view

Throwaway. Answers: *what is Presenter view, now that a Note is not a channel?*

Three **layout** variants, switchable via `?variant=`:

- **A — Column** (winner): **Speech** is the left column; current + up-next stack on the right; elapsed above the previews.
- **B — HUD**: **Speech** is the whole frame at teleprompter size; current, up-next, and elapsed sit in a top chrome bar.
- **C — Filmstrip**: **Speech** fills; current + up-next are always a bottom strip, even on a wide screen.

B and C were the rejected shapes.

Locked while grilling (all variants obey these): two compositions over the same panes (**Present** = click to open the audience window; **Rehearse** = don't); **Speech** of *this* **Slide** only; overflow scrolls; not mirrored; no auto-scroll; elapsed only; narrow viewports collapse previews to a strip so **Speech** stays on screen; a **Comment** never appears.

```sh
cd prototypes/presenter-view
pnpm install
pnpm dev
```

Then open http://localhost:5173/

- Bottom bar cycles **variants** (also `[` `]`).
- Left/right arrows change **Slides** — works in both windows.
- Viewport pills, or drag a corner (any preset except Fill). **Phone** is the strip check.
- **Open audience window** is **Present**. Closing it, or never opening it, is **Rehearse**.
- Click the elapsed clock to reset.

The audience window is the **Slide**. Green HUD is prototype chrome, not part of **Presenter view**.

Not production. No tests. The portable piece is `src/sync.ts`.
