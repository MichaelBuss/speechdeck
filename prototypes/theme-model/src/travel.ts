/**
 * PROTOTYPE — gradient travel.
 * Pure. The liftable piece: where t comes from, and how stops become one colour.
 *
 * Arriving at a Slide tagged "hard" starts a new run. Index 0 is always a run start.
 * A non-participating index (Background) keeps the current t and does not advance it.
 */

export type CutKind = "hard" | "connected";

export function travelT(
  index: number,
  participate: readonly boolean[],
): { t: number; skipped: boolean } {
  const skipped = participate[index] === false;
  const participants: number[] = [];
  for (let i = 0; i < participate.length; i++) {
    if (participate[i] === true) participants.push(i);
  }
  if (participants.length <= 1) return { t: 0, skipped };
  let pos = 0;
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    if (p === undefined) continue;
    if (p <= index) pos = i;
    else break;
  }
  return { t: pos / (participants.length - 1), skipped };
}

export function runBounds(
  index: number,
  kinds: readonly CutKind[],
): { start: number; end: number } {
  let start = index;
  while (start > 0 && kinds[start] !== "hard") start -= 1;
  let end = index;
  while (end + 1 < kinds.length && kinds[end + 1] !== "hard") end += 1;
  return { start, end };
}

export function runT(index: number, kinds: readonly CutKind[]): number {
  const { start, end } = runBounds(index, kinds);
  const span = end - start;
  if (span <= 0) return 0;
  return (index - start) / span;
}

export function mixStops(stops: readonly string[], t: number): string {
  if (stops.length === 0) return "transparent";
  const first = stops[0];
  if (first === undefined) return "transparent";
  if (stops.length === 1) return first;
  const clamped = Math.min(1, Math.max(0, t));
  const x = clamped * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const a = stops[i] ?? first;
  const b = stops[i + 1] ?? a;
  const f = x - i;
  if (f <= 0) return a;
  if (f >= 1) return b;
  return `color-mix(in oklab, ${a} ${((1 - f) * 100).toFixed(2)}%, ${b})`;
}
