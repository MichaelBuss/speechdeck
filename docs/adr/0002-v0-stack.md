# The v0 stack

v0 is Solid, Vite, TanStack Router 1.x (no Start), Tailwind v4, TypeScript 7, Oxlint + Oxfmt, pnpm workspaces, and Vitest. Each of those has a caller today; Start, `cva`, `tailwind-merge`, Turbo, and a Deno-native workspace do not.

Slides are same-document URLs, so the router we already need as the view-transition driver is also the address of a **Slide**. Start's remaining surface (SSR, server functions) has no caller in a deck presented from a laptop; Router plus the Vite plugin is the documented path without it.

The toolchain is npm-shaped: Vite and its plugins resolve `package.json` / `node_modules`. Deno 2 can emulate that (`nodeModulesDir: "auto"`), but then we debug two resolvers for nicer `deno publish` workspace rewriting. Publishing stays `jsr publish` from a pnpm workspace; Deno is not the repo runtime.

Oxlint loads `eslint-plugin-solid` and `@tanstack/eslint-plugin-router` as JS plugins. `typescript-eslint` still needs the TypeScript 6 library API; Oxlint's type-aware engine tracks TypeScript 7.
