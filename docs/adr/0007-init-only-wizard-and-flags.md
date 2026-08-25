# Init is the only command

`@speechdeck/create` (`pnpm create @speechdeck`) is the only binary. Scaffolded `package.json` scripts call Vite; there is no `speechdeck dev` / `build` / `present`. Wrapping Vite is a nicer name we would then maintain, and a runtime binary that owns the build was already the tool shape ADR 0006 rejected.

`init()` never prompts. Clack is one client: on a TTY it asks directory (if omitted), starter (`skeleton` | `empty`), and theme (built-in select). No customize-gate — two questions do not need a third. Flags map 1:1 onto the options object. `--yes` / `-y` (and no TTY) skip prompts and apply defaults; they do not overwrite. Overwrite is `--existing overwrite`. `init` writes files only: no install, no network, no resume on partial write.

Rejected: a silent wizard (humans would never discover starter/theme), `template` as the flag name (glossary already killed that word), install-and-start inside `init` (offline would die, and we do not own Vite).
