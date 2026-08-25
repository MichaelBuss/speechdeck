# Identity names, skip-to-end, no public transition API

Connected motion is a same-document View Transition. Names are minted from identity (same heading text, same image src, code match keys), never authored. Duplicate names on one side fail the build; runtime does not suffix. A **Theme** styles motion through `view-transition-class` by kind (`heading`, `code`, `figure`), not through names, and cannot turn **Motion** on or off.

Interruption is skip-to-end on a mashed arrow and skip-then-reflow on a resize. `prefers-reduced-motion` is honoured when **Motion** is `auto`; `always` still runs connected transitions. There is no public JS transition surface: the router owns the opt-in, CSS owns the motion, the name authority is internal.

Slots (cell index) and roles (title/code/figure) were rejected — they morph things that are not the same thing. Throttle and queue were rejected — a presenter mashing arrows wants the next **Slide**. A `never` **Motion** value was rejected — a hard cut is already the default.

Prototype: `prototypes/transition-model`.
