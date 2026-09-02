import { defineConfig, github, claude } from "@readyrun/readyrun";

export default defineConfig({
  tracker: github({
    repo: "MichaelBuss/speechdeck",
    ready: "unblocked",
    labels: ["ready-for-agent"],
  }),
  worker: claude(),
  model: "sonnet",
  effort: "high",
  contextFile: "CONTEXT.md",
  permissions: "unattended",
});
