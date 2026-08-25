/**
 * PROTOTYPE — name authority.
 * Pure. Maps document-model keys to unique CSS names within one snapshot,
 * stable across a connected pair. Authors never write names.
 *
 * Three variants of *what gets a key*:
 *   A Identity — same heading text, same image src, same code match key
 *   B Slots    — Cell index (and match key inside a paired code Cell)
 *   C Roles    — one title, one code, one figure per Slide
 */

export const VARIANT_IDS = ["A", "B", "C"] as const;
export type VariantId = (typeof VARIANT_IDS)[number];

export const variants: Record<VariantId, { name: string }> = {
  A: { name: "Identity" },
  B: { name: "Slots" },
  C: { name: "Roles" },
};

export type NodeKind = "heading" | "code" | "image";

export type NamedNode = {
  id: string;
  kind: NodeKind;
  /** Heading text, image src, or code match key. */
  identity: string;
  role: "title" | "code" | "figure";
  /** Cell index on the Slide. */
  slot: number;
};

export type NameAssignment = {
  name: string;
  className: string;
};

export type Mint = {
  from: Map<string, NameAssignment>;
  to: Map<string, NameAssignment>;
  collisions: string[];
};

function slug(raw: string): string {
  const s = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return s.length > 0 ? s.slice(0, 48) : "x";
}

function classFor(kind: NodeKind): string {
  if (kind === "heading") return "heading";
  if (kind === "code") return "code";
  return "figure";
}

function keyFor(variant: VariantId, node: NamedNode): string {
  if (variant === "A") return `${node.kind}:${node.identity}`;
  if (variant === "B") {
    if (node.kind === "code") return `slot:${node.slot}:code:${node.identity}`;
    return `slot:${node.slot}`;
  }
  return `role:${node.role}`;
}

function group(variant: VariantId, nodes: readonly NamedNode[]): Map<string, NamedNode[]> {
  const map = new Map<string, NamedNode[]>();
  for (const node of nodes) {
    const key = keyFor(variant, node);
    const list = map.get(key) ?? [];
    list.push(node);
    map.set(key, list);
  }
  return map;
}

/**
 * Mint CSS names for a connected pair. A key that appears twice on one side
 * is a collision — the build would fail the deck; runtime must not suffix.
 */
export function mintNames(
  variant: VariantId,
  fromNodes: readonly NamedNode[],
  toNodes: readonly NamedNode[],
): Mint {
  const fromGroups = group(variant, fromNodes);
  const toGroups = group(variant, toNodes);
  const keys = new Set([...fromGroups.keys(), ...toGroups.keys()]);
  const from = new Map<string, NameAssignment>();
  const to = new Map<string, NameAssignment>();
  const collisions: string[] = [];

  for (const key of keys) {
    const a = fromGroups.get(key) ?? [];
    const b = toGroups.get(key) ?? [];
    if (a.length > 1 || b.length > 1) {
      collisions.push(key);
      continue;
    }
    const sample = a[0] ?? b[0];
    if (sample === undefined) continue;
    const assignment: NameAssignment = {
      name: `sd-${slug(key)}`,
      className: classFor(sample.kind),
    };
    const left = a[0];
    const right = b[0];
    if (left) from.set(left.id, assignment);
    if (right) to.set(right.id, assignment);
  }

  return { from, to, collisions };
}
