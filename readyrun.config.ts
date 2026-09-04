import { defineConfig, github, claude } from "@readyrun/readyrun";

export default defineConfig({
  tracker: github({
    repo: "MichaelBuss/speechdeck",
    ready: "unblocked",
    labels: ["ready-for-agent"],
    account: "MichaelBuss",
  }),
  worker: claude(),
  model: "sonnet",
  permissions: "unattended",
  effort: "high",
  contextFile: "CONTEXT.md",
});
