#!/usr/bin/env node
import { init, type Existing, type InitOptions, type Starter } from "./index.ts";

function parseArgs(argv: readonly string[]): InitOptions {
  const options: InitOptions = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--yes":
      case "-y":
        options.yes = true;
        break;
      case "--starter": {
        const value = argv[++i];
        if (value !== "skeleton" && value !== "empty") {
          throw new Error('--starter must be "skeleton" or "empty"');
        }
        options.starter = value satisfies Starter;
        break;
      }
      case "--theme": {
        const value = argv[++i];
        if (value === undefined) throw new Error("--theme requires a value");
        options.theme = value;
        break;
      }
      case "--existing": {
        const value = argv[++i];
        if (value !== "fail" && value !== "overwrite") {
          throw new Error('--existing must be "fail" or "overwrite"');
        }
        options.existing = value satisfies Existing;
        break;
      }
      default:
        if (arg !== undefined && !arg.startsWith("-")) positionals.push(arg);
    }
  }

  const directory = positionals[0];
  return directory === undefined ? options : { ...options, directory };
}

try {
  await init(parseArgs(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
