# Present is 50 kB gzip, no time SLA

v0’s performance budget is the runtime JS **Present** and **Rehearse** load, not milliseconds. The number is 50 kB gzip, measured on the `empty` starter’s production build — all client JS Vite emits for that entry. TanStack’s `solid-router.minimal` is already ~33 kB gzip; 50 kB is the fence that still fits our code and fails if a JS animation library, a runtime highlighter, or `parseDeck` lands on the client.

Out of the number: a live **Embed** (the author’s module; `ready` is not first paint), **Theme** fonts, engine / `theme.css`, and the **Deck**’s highlighted HTML. **Inspect** is a second gated entry and has no budget. An **Arrival** has no timer — hard cut is a URL swap, connected is the View Transition, skip-to-end is already ADR 0005.

Rejected: a first-paint or **Arrival** millisecond SLA (localhost on a laptop is not the bottleneck); putting guest **Embeds** in the same number; a Lighthouse score; a CSS or font budget; a size check on the throwing skeleton.
