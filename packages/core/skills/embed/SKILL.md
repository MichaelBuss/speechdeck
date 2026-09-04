---
name: embed
description: >
  How to write a SpeechDeck Embed guest and wire it onto a Slide: the
  ```embed <specifier>``` fence syntax with an optional YAML props body, the
  `EmbedGuest<El>` contract (`(el, props) => { dispose, ready }`) a guest's
  default export must satisfy, host/guest DOM ownership (the guest may put
  an iframe inside the host element; the framework never does), specifier
  resolution (a relative path next to the Deck, or a package name), and
  pairing a runnable file to its code Cell so the shown bytes cannot drift.
  Load when writing an Embed guest module, authoring an `embed` fence, or
  wiring a custom `loadEmbed` host adapter.
metadata:
  type: core
  library: "@speechdeck/core"
  library_version: "0.0.0"
---

# Writing an Embed guest

An **Embed** is a live web mount on a Slide: a fenced block with info string
`embed` and a module specifier, optionally followed by a YAML props body.
The module the specifier resolves to exports a guest matching
`EmbedGuest<El>`.

## Setup

````markdown
```embed ./demos/counter.ts

```
````

```ts
// demos/counter.ts
import type { EmbedGuest } from "@speechdeck/core";

const counter: EmbedGuest<HTMLElement> = (el) => {
  let count = 0;
  const button = document.createElement("button");
  const render = () => {
    button.textContent = `Clicked ${count} time${count === 1 ? "" : "s"}`;
  };
  render();
  button.addEventListener("click", () => {
    count++;
    render();
  });
  el.replaceChildren(button);

  return {
    dispose: () => el.replaceChildren(),
    ready: Promise.resolve(),
  };
};

export default counter;
```

## Core Patterns

### 1. The `EmbedGuest` contract

```ts
export type EmbedGuest<El = unknown> = (
  el: El,
  props: Json,
) => {
  dispose: () => void;
  ready: Promise<void>;
};
```

The framework creates exactly one host element per Embed and hands it to
your guest once; it never reparents that element. Your default export:

- Mounts synchronously into `el` (append children, or put an iframe inside
  it — the framework itself never inserts an iframe, only a guest does).
- Returns `dispose()`, which the framework calls once, before the host
  element is discarded (a hard cut away, or the Slide's Cells rebuilding).
  Release everything you attached — timers, listeners, subscriptions — here.
- Returns a `ready` promise the framework awaits for its own bookkeeping;
  it does not gate whether your guest is already visibly mounted, so don't
  defer the initial DOM mount until `ready` resolves.

### 2. The `embed` fence and its specifier

````markdown
```embed <specifier>
key: value
```
````

- `<specifier>` is the same kind of value as a Theme specifier: a relative
  path (`./demos/counter.ts`) resolved next to the Deck file, or a package
  name the host project already depends on. There is no reserved embeds
  folder and no URL form.
- An optional YAML body is a flat `key: value` map — becomes the `props`
  argument (`null` for empty/`~`, booleans, numbers, or strings). Nesting
  and multi-line scalars are out of scope; keep props flat and serializable.
- Do not put a fragment (`#name`) on an Embed specifier — `#region` naming
  belongs only on a code Cell's fence, never on the Embed pointing at that
  same file.

### 3. Pairing an Embed to its code Cell without drift

Show the guest's own source next to the running Embed by pointing a code
Cell at the _same path_, with an empty body, instead of retyping the file
into a fence:

````markdown
```embed ./demos/counter.ts

```

```ts ./demos/counter.ts

```
````

Both Cells now read the same bytes off disk — editing the file updates both
at once. There is no "embed manifest" or match id linking the two; they
agree because they name the same relative path.

### 4. How a specifier becomes a guest

A host project's `loadEmbed(specifier)` resolves the specifier to an
`EmbedGuest` and is the thing the composition (Present, Rehearse, Inspect)
calls before mounting. A minimal host adapter is a bare dynamic import:

```ts
const loadEmbed = async (specifier: string) => {
  const mod = await import(/* @vite-ignore */ specifier);
  if (typeof mod.default !== "function") {
    throw new Error(`Embed "${specifier}" has no default export guest.`);
  }
  return mod.default;
};
```

A specifier that is not import-resolvable at runtime (wrong relative path,
missing dependency) is the host project's problem to fix — core and the
guest contract do not validate resolvability ahead of time.

## Common Mistakes

### [HIGH] Retaining the host element past `dispose()`

Wrong:

```ts
const guest: EmbedGuest<HTMLElement> = (el) => {
  window.addEventListener("resize", () => paint(el));
  return { dispose: () => {}, ready: Promise.resolve() };
};
```

Correct:

```ts
const guest: EmbedGuest<HTMLElement> = (el) => {
  const onResize = () => paint(el);
  window.addEventListener("resize", onResize);
  return {
    dispose: () => window.removeEventListener("resize", onResize),
    ready: Promise.resolve(),
  };
};
```

The host element is discarded on the next hard cut or rebuild; an
unreleased listener keeps firing against a detached element and leaks.

### [MEDIUM] Blocking the visible mount on `ready`

Wrong: deferring `el.replaceChildren(...)` until some internal readiness
flips, then resolving `ready` first.

Correct: mount synchronously in the guest function body; use `ready` only
to signal completion for the caller's own bookkeeping, not as a gate the
framework waits on before showing anything.

### [MEDIUM] Typing the guest's source into the `embed` fence body

Wrong: a bare ` ```embed ./demos/counter.ts ` fence with no matching code
Cell, and the source pasted into a separate fenced code block by hand.

Correct: add a second fence, `ts ./demos/counter.ts`, with an empty body, so
the shown code and the running code are the same file.

An `embed` fence never carries a code body itself — its body, if any, is
YAML props, not source.

### [MEDIUM] Giving an Embed a URL or bare fragment as its specifier

Wrong: ` ```embed https://example.com/widget.js ` or
` ```embed ./demos/counter.ts#setup `.

Correct: use a relative path or a package name only; if you need to point
at a specific span for readers, put the `#region` marker on the paired code
Cell's fence, not on the Embed.
