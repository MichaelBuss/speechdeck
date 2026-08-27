# Talk-operable, no conformance badge

v0 does not claim WCAG. It guarantees a keyboard-operable talk: ArrowRight / ArrowLeft drive **Arrivals** (`preventDefault`, they never scroll **Speech**); the **Slide** URL is the jump; Escape blurs an in-document **Embed** and focuses the **Slide**. Reduced motion is already **Motion** `auto`. The audience `.slide` is `main` (heading, or `Slide N`); **Presenter view**’s `main` is **Speech**, and the previews are `aria-hidden`. `<title>` is `N · heading`. An **Arrival** is the URL, not a live region.

Harbour and Ink keep `--sd-title` / `--sd-fg` / `--sd-muted` readable on `--sd-bg` at every stop, both appearances. Signal may miss — that is the P3 look. Accents, **Marks**, **Looks**, and Shiki tokens are not body text. Third-party **Themes** are the author’s.

Rejected: a conformance badge; Space or click-to-advance; a jump overlay or search (parked); auto-focusing an **Embed**; stealing keys from an iframe guest; announcing previews or elapsed; a contrast linter.
