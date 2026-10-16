---
"@speechdeck/core": patch
"@speechdeck/themes": patch
"@speechdeck/create": patch
"@speechdeck/solid": patch
"@speechdeck/vite": patch
---

Every package now declares `repository` (npm trusted publishing verifies it matches) and `files` (the npm tarball mirrors the jsr.json publish config). Local `--bootstrap` publishes run npm with inherited stdio so its 2FA browser flow works.
