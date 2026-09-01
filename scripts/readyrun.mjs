#!/usr/bin/env node
// JSR does not put a `readyrun` binary on PATH for npm/pnpm/yarn consumers
// (its README only documents `deno run -A jsr:@readyrun/readyrun/cli`).
// This wrapper is the pnpm-workspace equivalent: it imports the published
// "./cli" export and drives it the same way Deno would.
import { cli } from "@readyrun/readyrun/cli";

process.exitCode = await cli({ argv: process.argv.slice(2) });
