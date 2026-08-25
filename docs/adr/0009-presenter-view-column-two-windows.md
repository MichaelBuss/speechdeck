# Presenter view is a column of Speech, two windows by click

**Presenter view** is the speaker-facing surface: this **Slide**'s **Speech** (dominant), a preview of this **Slide**, and the next. v0 ships that as public `useX` + component pairs, composed two ways — **Present** (a click opens the audience window on the **Slide**) and **Rehearse** (one window). HUD and Filmstrip layouts were rejected; remaining and per-**Slide** clocks were rejected as Slidev-envy; auto-scroll and mirroring have no current use for JS Copenhagen; a phone is a viewport, not a second device. Navigation is the **Slide** URL plus `BroadcastChannel`, either side leading. A **Comment** never appears.

The audience window posts its `{ width, height }` on that same channel, including resize. Preview slots in **Presenter view** are not **Slide** viewports — they can be any leftover rectangle as the speaker window is dragged. They always contain-fit: lay the **Slide** out at the audience dimensions, then scale down so wrapping and overflow match the projector. Until the audience window reports, that size is 16:9 (1280×720). Ratio-only, or laying out at the thumbnail's own size, would still lie. **Embeds** in the preview are inert placeholders; a live mount would run the demo twice.

Rejected: one locked layout with no primitives; a pane marketplace; auto-opening the audience window (popup blockers); `localStorage` sync; a duration **Frontmatter** key.

Prototype: `prototypes/presenter-view`.
