# SpeechDeck

You write a Markdown document. Headings, figures, code, and live mounts reach the audience. The paragraphs in between are **Speech** — you read them; they don’t.

There is no slide canvas. Each **Slide** reflows to the screen it lands on. If it still cannot fit, that is **Refuse**, not a cue to shrink or scroll.

A **Theme** is type and colour, and may travel as you advance. Two **Slides** are a **hard cut** unless the arriving one opts in with `enter: connected`.

SpeechDeck is a project [`pnpm create @speechdeck`](https://jsr.io/@speechdeck/create) scaffolds. The author’s app depends on `@speechdeck/*`. There is no binary you point at a file.

## A Deck

````md
---
theme: "@speechdeck/themes/harbour"
---

# APIs without implementation anxiety

This paragraph is Speech. Only the speaker sees it.

---

## A live contract

The fence and the Embed share one file. The highlighted code and the running guest cannot drift.

```ts ./demos/counter.ts
```

```embed
./demos/counter.ts
```
````

Untagged prose is **Speech**. Headings, tables, images, fenced code, and **Embeds** appear on the **Slide** by themselves. A paragraph, list, or quote needs `<!--on-->` on the line before it (**Promotion**) to join them. A `---` starts a new **Slide**.

## The locked spec

The public API is the TypeScript in the packages — real signatures, functions still throw. That is deliberate: the skeleton has **no features**.

| Package                                                | Surface                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| [`@speechdeck/core`](./packages/core/src/index.ts)     | `parseDeck`, `resolveFrame`, `matchCode`                                |
| [`@speechdeck/solid`](./packages/solid/src/index.ts)   | `Present`, `Rehearse`, `Inspect`, and the `useX` / component primitives |
| [`@speechdeck/vite`](./packages/vite/src/index.ts)     | `speechdeck()`                                                          |
| [`@speechdeck/create`](./packages/create/src/index.ts) | `init()` — the only command                                             |
| [`@speechdeck/themes`](./packages/themes)              | Harbour, Ink, Signal as `{specifier}/theme.json`                        |

The glossary is [`CONTEXT.md`](./CONTEXT.md). Hard-to-reverse calls live in [`docs/adr/`](./docs/adr/). Throwaway prototypes under `prototypes/` proved the decisions; they are not the product.

`Present` opens an audience window on click. `Rehearse` is one window. `Inspect` is a gated third composition (`pnpm inspect`) so the author can see **Layout** and **Refuse** without putting chrome on the projector.

## Repo

```sh
pnpm install
pnpm check
```

JSR scope [`@speechdeck`](https://jsr.io/@speechdeck). MIT.
