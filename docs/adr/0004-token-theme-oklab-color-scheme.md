# Token theme, oklab travel, color-scheme appearance

A **Theme** is a token file the framework reads, plus optional CSS that only consumes `--sd-*` handles. Who applies those handles is ADR 0010: engine CSS is complete (**Looks**, **Marks**, mapping onto the public DOM); `theme.css` is extras. iA's `template.json` + `presets.json` split exists for a Style Inspector we don't have. CSS-only was rejected: N-stop travel is a **Deck** behaviour, so the framework mixes adjacent stops with `color-mix(in oklab, …)`, and the resolver pattern wants contained handles, not the whole tree.

**Appearance** is `light | dark | auto` in **Deck** Frontmatter, default `dark`. The switch is CSS `light-dark()` driven by `color-scheme` on the slide (`auto` leaves `light dark`; `light` / `dark` force). OS preference does not win unless `auto`. Travel is optional — one colour is a valid **Theme**. A **Background** does not consume a stop. A stop may be `oklch()`, hex, or `color(display-p3 …)`; the browser gamut-maps; there is no second sRGB list. v0 ships three built-in **Themes** (ADR 0011); Signal is the vibrant P3 look.

Public DOM (semver): `.slide[data-layout]`, `color-scheme`, `.cell[data-kind]`, `.backdrop[data-look]`, `img[data-fit][data-focus]`, `mark[data-mark]`. Handles: `--sd-t`, `--sd-bg`, `--sd-fg`, `--sd-title`, `--sd-muted`, `--sd-chrome`, `--sd-accent-1`…`4`, `--sd-font-title`, `--sd-font-body`, `--sd-font-mono`, `--shiki-token-*`. Internal: `.cells`, `data-cut`, `data-items`, `data-caption-order`, `data-align`. Four accents, not iA's six — no caller for a fifth.

Prototype: `prototypes/theme-model`.
