# Scaffolded project, not a file-pointed tool

v0 is a project `init` scaffolds: the author's app depends on `@speechdeck/*`, pinned in the lockfile. A binary pointed at a lone Markdown file cannot host the **Embed** seam — a module specifier has nowhere to resolve, and neither does `react`. Hybrid (tool until you need code) is two products; the JS Copenhagen talk is one caller, the project half.

There is no `speechdeck.config.*`. **Deck** facts stay in **Frontmatter**; project facts stay in `package.json` and `vite.config.ts`. Author modules and a custom **Theme** are ordinary specifiers: relative from the **Deck** file, bare through the project. Distribution is the JSR libraries plus an `init` create-package. A runtime binary that owns the build was rejected — that is the tool shape again. Whether `dev` / `build` wrap Vite is the init-wizard ticket.
