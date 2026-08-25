/**
 * PROTOTYPE — interruption policy.
 * Pure. The View Transition API skip-to-end is a fact; this decides
 * whether we let the presenter mash into it, drop the input, or queue it.
 */

export const INTERRUPT_IDS = ["skip", "throttle", "queue"] as const;
export type InterruptId = (typeof INTERRUPT_IDS)[number];

export const interruptLabels: Record<InterruptId, string> = {
  skip: "Skip to end",
  throttle: "Throttle",
  queue: "Queue",
};

export const RESIZE_IDS = ["skip", "hold"] as const;
export type ResizeId = (typeof RESIZE_IDS)[number];

export type NavAction = "hard-cut" | "go" | "ignore" | "queue";

export function decideNav(input: {
  connected: boolean;
  reducedMotion: boolean;
  honourReduced: boolean;
  policy: InterruptId;
  active: boolean;
}): NavAction {
  if (!input.connected || (input.reducedMotion && input.honourReduced)) {
    return "hard-cut";
  }
  if (!input.active) return "go";
  if (input.policy === "skip") return "go";
  if (input.policy === "throttle") return "ignore";
  return "queue";
}

export function decideResize(input: {
  active: boolean;
  policy: ResizeId;
}): "apply" | "skip-then-apply" | "defer" {
  if (!input.active) return "apply";
  if (input.policy === "skip") return "skip-then-apply";
  return "defer";
}
