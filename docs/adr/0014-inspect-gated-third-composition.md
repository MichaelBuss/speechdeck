# Inspect is a gated third composition, not audience chrome

v0 ships **Inspect** in `@speechdeck/solid` — `Inspect({ deck })`, same shape as `Present` / `Rehearse`, no extra primitives (only those two share `Speech` / `Slide` / `UpNext`). It is not **Presenter view**, not a query-param on the **Slide** URL, not scaffold-only copy-paste, and not a sixth `@speechdeck/debug`. The audience never mounts it, so “off by default” is structural.

The authoring entry is a second scaffolded HTML file on the same Vite server, registered only when `SPEECHDECK_INSPECT=1`. Default `pnpm dev` / `vite build` omit it. The scaffold exposes `pnpm inspect`. Vite already owns `--debug`; there is no plugin `inspect: true` (that bakes the gate open in config). t3-env is for app env schemas, not this process switch.

The stage has seven named viewports: Fill (the window, not dragged), 16:9 1280×720, Zoom 900×700, Square 800×800, Phone 390×844, Phone landscape 844×390, Freeform. Dragging a named box selects Freeform and keeps that size. Clicking Freeform with no history opens 1280×720. The URL stores the preset id (`fill`, `16-9`, `zoom`, `square`, `phone`, `phone-l`, `freeform`); Freeform also stores `width` and `height`. Reload of a named preset is exact; Freeform round-trips the box.

The readout is chrome of **Inspect**, always on there: **Layout** (auto vs override, and the auto pick when overridden), impossible override, **Cell** count, stage size, heading align, refuse. Travel, identity names, `enter`, **Speech**, and **Embed** readiness stay out. **Frame** grows `layoutAuto` so **Inspect** does not export `pickLayout`. **Inspect** does not join Present's `BroadcastChannel`. **Embeds** on the stage are live. **Speech** is not shown.

Rejected: a mode of `Present` / `Rehearse`; `@speechdeck/debug`; serving `inspect.html` on every `dev`; Vite `--debug` as the gate.

Prototype that proved the hunger: `prototypes/reflowing-layout`.
