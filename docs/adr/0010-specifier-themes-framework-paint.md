# Specifier themes, one package, framework paint

A **Deck** names its **Theme** with a specifier (`@speechdeck/themes/harbour`, `./themes/mine`, `@alice/noir`), never an id. Built-ins are subpaths of one JSR package so `init` writes one dependency and the loader is one `{specifier}/theme.json` (and optional `{specifier}/theme.css`). Third parties are any package with that token file; there is no `@speechdeck/theme-*` rule.

`theme:` is required. `theme.json` is required. `theme.css` is not: engine CSS already maps `--sd-*` onto the public DOM and implements **Looks** and **Marks**, so a JSON-only **Theme** still looks like a **Deck**. `theme.css` is optional extras. A JS entry is refused. No second command scaffolds a **Theme** — the complete engine CSS is the skeleton.

Rejected: registered ids, one package per built-in, requiring `theme.css`, a `theme` CLI.
