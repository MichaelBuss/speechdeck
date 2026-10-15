## Agent skills

### Issue tracker

GitHub Issues in this repo (via `gh`). See `docs/agents/issue-tracker.md`.

### Release

Releases run through Changesets: behavior-changing PRs add a changeset (`pnpm changeset`); version fields, tags, and publish runs are never touched by hand. See `docs/agents/release.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
