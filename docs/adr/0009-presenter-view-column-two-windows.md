# Presenter view is a column of Speech, two windows by click

**Presenter view** is the speaker-facing surface: this **Slide**'s **Speech** (dominant), a preview of this **Slide**, and the next. v0 ships that as public `useX` + component pairs, composed two ways — **Present** (a click opens the audience window on the **Slide**) and **Rehearse** (one window). HUD and Filmstrip layouts were rejected; remaining and per-**Slide** clocks were rejected as Slidev-envy; auto-scroll and mirroring have no current use for JS Copenhagen; a phone is a viewport, not a second device. Navigation is the **Slide** URL plus `BroadcastChannel`, either side leading. A **Comment** never appears.

The audience window posts its `{ width, height }` on that same channel, including resize. Previews letterbox to that size: they lay the **Slide** out at the audience dimensions, then scale down, so wrapping and overflow match the projector. Ratio-only would still lie — a 180px-wide 16:9 box is a narrow **Slide**, not a projector **Slide**. **Embeds** in the preview are inert placeholders; a live mount would run the demo twice. **Rehearse** has no audience window, so previews use their own box until **Present** starts reporting.

Rejected: one locked layout with no primitives; a pane marketplace; auto-opening the audience window (popup blockers); `localStorage` sync; a duration **Frontmatter** key.

Prototype: `prototypes/presenter-view`.
