# Release: per-PR changesets, one Version Packages PR, npm + JSR

Releases run through [Changesets](https://github.com/changesets/changesets). Version intent travels inside each PR as a changeset file; one **Version Packages PR** accumulates them and is the only publish lever; merging it publishes all five `@speechdeck/*` packages to npm and JSR (same version, lockstep via the `fixed` group), tags `vX.Y.Z`, and cuts a GitHub Release. The decision lives in ADR 0022.

## The rules

- **Every PR that changes published behavior adds a changeset** (`pnpm changeset`): pick the bump kind — `patch` for fixes (the usual default), `minor` for new features, `major` for breaking — and write a note worth reading in a changelog. Docs-only, test-only, CI-only, and chore PRs need no changeset.
- **Every PR that resolves an issue writes `Closes #N` in its body**, so the release notes link the tracker. The PR template and the release-guidance comment both nudge this; nothing hard-fails.
- **Version fields are never edited by hand** — not `package.json`, not `jsr.json`. The Version Packages PR writes them (`pnpm run version` runs `changeset version`, then `scripts/sync-versions.ts` keeps every `jsr.json` in lockstep with its `package.json`).
- **Tags are never pushed by hand.** `scripts/release.ts` creates `vX.Y.Z` after a successful publish.
- **Publishing is never triggered by hand.** No manual `npm publish`, no manual `jsr publish`, no `workflow_dispatch` button — merging the Version Packages PR is the whole ceremony.

## How a release happens

1. PRs land on `main`, each carrying zero or more `.changeset/*.md` files.
2. On any push to `main` with pending changesets, `.github/workflows/publish.yml` (via `changesets/action`) opens or updates the Version Packages PR: bump kinds summed, manifests + `CHANGELOG.md` written.
3. Merging that PR is the release: the workflow runs `scripts/release.ts`, which publishes each package to npm (trusted publishing: OIDC, `--provenance`) and JSR (OIDC), tags, and creates the GitHub Release. A version already on a registry is skipped, so re-runs and docs-only merges stay green.
4. If npm publishing is not configured yet (unclaimed `@speechdeck` scope, no trusted publisher), the npm step fails **instructively**: exact setup steps appear in the workflow summary and as a comment on the merged PR. Fix them and re-run the workflow — the JSR half ships regardless.

## One-time setup already done (for the record)

- **Trusted publishing** on npmjs.com: each of `@speechdeck/core`, `@speechdeck/themes`, `@speechdeck/vite`, `@speechdeck/create`, `@speechdeck/solid` → Settings → Trusted publishing → GitHub Actions (`MichaelBuss` / `speechdeck` / `publish.yml`), with **Allow npm publish** ticked (new configs default to stage-only, which would force a human 2FA approval on every release). The config expires if its first publish doesn't happen within 2 days.
- **Workflow permissions**: repo Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests" is on — without it the changesets action cannot open the Version Packages PR.
- The release-guidance comment skips bot-authored PRs: the Version Packages PR *is* the release; lecturing it about changesets is noise.

## What an agent checks on its own PRs

The release-guidance comment (one per PR, updated in place) reports: which packages' published files change, the changesets' bump kinds and notes (or how to add one), and whether the body closes an issue. Read it before asking for review; act on its nudges.
