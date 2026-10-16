# @speechdeck/create

## 0.0.2

### Patch Changes

- [#98](https://github.com/MichaelBuss/speechdeck/pull/98) [`a124795`](https://github.com/MichaelBuss/speechdeck/commit/a1247956d43e36442423d99f9ce58952199a9fae) Thanks [@MichaelBuss](https://github.com/MichaelBuss)! - Release through Changesets: per-PR changeset files, one Version Packages PR, and every version published to npm (trusted publishing, with provenance) and JSR (OIDC). Packages now carry `repository` and `files` fields so npm tarballs match their JSR publish config.

- [#100](https://github.com/MichaelBuss/speechdeck/pull/100) [`6856447`](https://github.com/MichaelBuss/speechdeck/commit/68564473f056503905d3b2b3ff88928cbbf08e3f) Thanks [@MichaelBuss](https://github.com/MichaelBuss)! - Every package now declares `repository` (npm trusted publishing verifies it matches) and `files` (the npm tarball mirrors the jsr.json publish config). Local `--bootstrap` publishes run npm with inherited stdio so its 2FA browser flow works.
