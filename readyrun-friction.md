# ReadyRun (`@readyrun/readyrun@0.1.1`) setup notes — friction log

Consumer: this repo (speechdeck), a pnpm workspace, Node 24. Setup goal: install from
JSR, get `readyrun doctor` green, and exercise `readyrun run` against the real
GitHub tracker without letting a live agent touch the repo. All of the below was
reproduced first-hand today. Scratch file — paste into the ReadyRun tracker and
delete.

## Verdict

The library itself works correctly once wired up: config typechecks, GitHub tracker
auth/labels/blocking all resolved cleanly, and a `run` against the real Frontier
correctly created a worktree+branch, invoked the worker, and hard-stopped without
mutating the tracker when the worker failed. The friction is entirely in
**"getting from `pnpm add` to a working CLI invocation,"** not in the runtime logic.

## Friction, highest impact first

### 1. There is no way to run the CLI from a pnpm/npm project — confirms your own suspicion

The JSR page's only documented invocation is:

```bash
deno run -A jsr:@readyrun/readyrun/cli init
```

For an npm-ecosystem consumer this doesn't work at all, and the natural things
someone reaches for both fail in confusing ways I reproduced verbatim:

```
$ pnpm exec readyrun init
undefined
[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "readyrun" not found

$ npx readyrun init
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/readyrun - Not found
```

The `npx` failure is the worst one: it silently goes to `registry.npmjs.org`
looking for a package literally called `readyrun` (not `@readyrun/readyrun`, and
not looking at JSR at all), and the 404 gives zero hint that the fix is "this is a
JSR package, JSR packages don't get a `bin` shim from npm/pnpm/yarn." A
newcomer has no path from that error message back to your README.

Root cause: the published `package.json` (npm-compat layer) has no `"bin"` field,
so npm/pnpm/yarn never link anything onto `PATH` or `node_modules/.bin`, even
though the JSR manifest exports `"./cli"`.

**Workaround I used** (this is exactly the kind of thing that should ship in your
docs, or better, not be necessary):

```js
// scripts/readyrun.mjs
import { cli } from "@readyrun/readyrun/cli";
process.exitCode = await cli({ argv: process.argv.slice(2) });
```

```json
// package.json
"scripts": { "readyrun": "node scripts/readyrun.mjs" }
```

Then `pnpm readyrun doctor` / `pnpm readyrun run --max 1` works. This is a
one-time, per-consumer chore that every pnpm/npm user of this package will have to
independently discover and reinvent.

**Suggested fixes, roughly in order of how much they'd help:**
- Publish to npm too (as you're already considering) with a real `"bin"` entry —
  this is the actual fix, and probably worth doing before anyone else tries this.
- Short of that, add the pnpm/npm wrapper-script snippet to the JSR README right
  next to the Deno one-liner, since Deno users are clearly not your only audience
  (your own `cursor()`/`claude()` worker adapters are npm-ecosystem tools).
- `jsr.json` `exports` already has `"./cli"` — consider also shipping a tiny
  actual `bin/readyrun.js` file in the package itself (with the same 3 lines
  above) so JSR's npm-compat `package.json` generation could pick it up as
  `"bin"` automatically or with minimal extra JSR config.

### 2. `readyrun init` cannot be scripted or run non-interactively at all

The CLI's `init` command always calls the interactive `@clack/prompts` flow —
`CliOptions.answers` (which *would* make it non-interactive) exists in the JS API
but is never populated from `process.argv`, so there's no `--tracker github
--repo owner/name --labels foo --worker cursor --model x` escape hatch from the
command line. Piping stdin doesn't work either; it just hangs until the process
gets killed by Node's "unsettled top-level await" watchdog:

```
$ echo | node scripts/readyrun.mjs init
┌  ReadyRun
◆  Tracker
│  ● GitHub
...
Warning: Detected unsettled top-level await
```

This means: no CI bootstrap, no "add to a template repo and let a setup script
answer the prompts," and no easy way for a tool like Cursor/an agent to run init
on a user's behalf without a live human at a TTY. Given the whole premise of
ReadyRun is agent automation, it's a little ironic that its own setup step is the
one thing an agent can't drive.

**Suggested fix:** accept the same shape `InitAnswers` already has via flags
(`--tracker`, `--repo`, `--labels`, `--worker`, `--model`, etc.) or a
`--answers ./answers.json` flag, and keep the interactive flow as the default when
no flags are given.

### 3. `doctor` checks the worker binary exists, but not that it's usable

`doctor` calls `existsSync` (via PATH search) for `config.worker.bin` and stops
there. It doesn't (and probably can't cheaply) verify the worker is authenticated.
In practice: `agent` was on PATH but not logged in, `doctor` reported success, and
the *first* real `readyrun run` would still hard-stop at the `worker` stage with a
generic "Hard stop: Ticket N failed at worker" — no hint that the actual problem
is "run `agent login`," just a swallowed exit code. This isn't necessarily wrong
(checking auth is worker-specific), but the hard-stop message on failure is
identical whether the worker binary is missing, unauthenticated, crashed, or
legitimately decided not to finish — you get zero diagnostic signal back, and the
underlying worker's stderr from `spawn(..., { stdio: "inherit" })` scrolls by
without being clearly attributed to "this is why it hard-stopped."

**Suggested fix:** on non-zero exit, echo the worker's exit code (not just
"failed at worker"), and consider a `doctor` step that does a trivial
`bin --version`/`bin auth status` style probe per adapter where one exists.

### 4. No escape hatch for a custom Tracker (only Worker has `custom()`)

`WorkerAdapter` has an exported `custom()` factory, so anyone can wire up a new
coding agent. `TrackerAdapter` has no equivalent — only `github()` and `linear()`
are exported from `mod.ts`. Worse, the object shape genuinely can't be
hand-rolled outside the package: `TrackerAdapter`/`WorkerAdapter` are branded
with a `const brand = Symbol(...)` that's private to `tracker-adapter.ts` /
`worker-adapter.ts` and never re-exported, and the npm-compat `package.json`
`"exports"` map only defines `"."` and `"./cli"` — so `import
"@readyrun/readyrun/tracker-adapter"` is flatly rejected by Node
(`ERR_PACKAGE_PATH_NOT_EXPORTED`), you can't even reach the symbol by deep
import. This is what forced today's "does the run loop actually work" test to go
through the real GitHub tracker (safely, using a `custom()` worker that exits
non-zero before anything mutates) instead of a fully offline fake tracker — a
library like this seems like it very much wants to be testable/mockable by
consumers (and by ReadyRun's own CI-adjacent tooling in other repos), and right
now it isn't.

**Suggested fix:** export `createTrackerAdapter` (mirroring `custom()` for
workers), or ship an actual `custom()` tracker adapter (e.g. backed by a static
ticket list or a user-supplied `frontier()` function) for tests and for trackers
you don't support yet (Jira, GitLab, etc.).

### 5. Minor / environmental, worth a one-line README callout each

- **`cursor()` worker requires the Cursor CLI (`agent`) pre-installed and
  authenticated** — not mentioned anywhere in the README. Same is presumably true
  for `claude()`. A one-liner ("this worker shells out to `agent`/`claude`; make
  sure it's installed and logged in") would've saved a round trip.
- **`npm.jsr.io` is a separate domain from `registry.npmjs.org`.** In a sandboxed
  test environment here, `pnpm install`/`pnpm typecheck` failed outright against
  the default network allowlist (`ERR_PNPM_META_FETCH_FAIL` against
  `npm.jsr.io`) until network access was widened. Anyone on a corporate proxy or
  allowlisted CI runner who's already special-cased `registry.npmjs.org` will hit
  this and it won't be obvious why, since nothing in their own config mentions
  JSR.
- **`.readyrun/worktrees/**` isn't gitignored by anything ReadyRun ships**, and
  `run` will happily create it inside the consumer's repo root. Consumers have to
  know to add `.readyrun/` to `.gitignore` themselves (I did, for this repo).
  `init` could write/append that line for you.
- The README's `pnpm add jsr:@readyrun/readyrun` line **is the one thing that
  already works great** — pnpm's native `jsr:` protocol support meant install
  and typecheck (once network was open) needed zero extra config, no `.npmrc`
  registry mapping required. Worth keeping front and center if you do add npm
  publishing, since it's currently your best pnpm-native story.

## What was actually verified working

- `pnpm add jsr:@readyrun/readyrun` + `readyrun.config.ts` typechecks against the
  real `_dist/*.d.ts` types, no `tsc` errors.
- `doctor`: GitHub GraphQL auth via `gh auth token`, label existence check
  (`ready-for-agent`), and the `blockedBy` schema probe (GitHub's issue
  dependencies GA) all passed against the real `MichaelBuss/speechdeck` repo.
- `run --max 1` against the real Frontier: picked ticket #52 (lowest-numbered,
  correctly filtered by label + no open blockers), created
  `.readyrun/worktrees/readyrun-52` on branch `readyrun/52`, invoked the worker,
  and on non-zero exit printed `Hard stop: Ticket 52 failed at worker` and
  stopped — **without** removing the label or posting the "left the Frontier"
  comment, i.e. the no-mutation-on-failure guarantee holds. Worktree/branch were
  local-only and were cleaned up afterward; the live issue was confirmed
  untouched (`gh issue view 52` showed the original labels and zero comments).
