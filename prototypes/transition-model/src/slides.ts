import type { NamedNode } from "./names.ts";

export type CutKind = "hard" | "connected";

export type DemoSlide = {
  id: string;
  title: string;
  cut: CutKind;
  layout: "cover" | "section" | "solo" | "split-2";
  html: string;
  nodes: readonly NamedNode[];
};

const PHOTO_A =
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=70";
const PHOTO_B =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=70";

function tok(match: string | null, role: string, text: string): string {
  const m = match === null ? "" : ` data-match="${match}"`;
  return `<span class="tok" data-node="c-${match ?? text}" data-kind="code" data-role="code" data-identity="${match ?? ""}" data-shiki="${role}"${m}>${text}</span>`;
}

const CODE_V1 = [
  tok("kw-export", "keyword", "export"),
  " ",
  tok("kw-fn", "keyword", "function"),
  " ",
  tok("fn-create", "function", "createDeck"),
  "(",
  tok("p-source", "parameter", "source"),
  ": ",
  tok("t-string", "constant", "string"),
  "): ",
  tok("t-deck", "constant", "Deck"),
].join("");

const CODE_V2 = [
  tok("kw-export", "keyword", "export"),
  " ",
  tok("kw-fn", "keyword", "function"),
  " ",
  tok("fn-create", "function", "createDeck"),
  "(",
  tok("p-source", "parameter", "source"),
  ": ",
  tok("t-md", "constant", "Markdown"),
  "): ",
  tok("t-deck", "constant", "Deck"),
].join("");

function heading(
  id: string,
  tag: "h1" | "h2" | "h3" | "h4",
  text: string,
  slot: number,
  role: "title" | "code" | "figure" = "title",
): { html: string; node: NamedNode } {
  const identity = text.toLowerCase();
  return {
    html: `<${tag} data-node="${id}" data-kind="heading" data-role="${role}" data-identity="${identity}" data-slot="${slot}">${text}</${tag}>`,
    node: { id, kind: "heading", identity, role, slot },
  };
}

function image(id: string, src: string, slot: number): { html: string; node: NamedNode } {
  return {
    html: `<img data-node="${id}" data-kind="image" data-role="figure" data-identity="${src}" data-slot="${slot}" src="${src}" alt="" />`,
    node: { id, kind: "image", identity: src, role: "figure", slot },
  };
}

function codeNodes(slot: number, matches: readonly string[]): NamedNode[] {
  return matches.map((m) => ({
    id: `c-${m}`,
    kind: "code" as const,
    identity: m,
    role: "code" as const,
    slot,
  }));
}

const cover = heading("h-cover", "h1", "APIs without anxiety", 0);
const seam = heading("h-seam", "h2", "The seam", 0);
const create1 = heading("h-create", "h3", "createDeck", 0);
const create2 = heading("h-create", "h3", "createDeck", 0);
const create3 = heading("h-create", "h3", "createDeck", 0);
const persists = heading("h-persists", "h2", "What persists", 0);
const harbour1 = heading("h-harbour", "h2", "Harbour", 0);
const harbour2 = heading("h-harbour", "h2", "Harbour", 0);
const nyhavn = heading("h-nyhavn", "h2", "Nyhavn", 0);
const photoA1 = image("img-a", PHOTO_A, 1);
const photoB1 = image("img-b", PHOTO_B, 1);
const photoB2 = image("img-b", PHOTO_B, 1);
const dupA = heading("h-dup-a", "h4", "same", 0);
const dupB = heading("h-dup-b", "h4", "same", 1);
const afterDup = heading("h-after-dup", "h2", "After a collision", 0);

const CODE_MATCHES_V1 = ["kw-export", "kw-fn", "fn-create", "p-source", "t-string", "t-deck"];
const CODE_MATCHES_V2 = ["kw-export", "kw-fn", "fn-create", "p-source", "t-md", "t-deck"];

export const slides: DemoSlide[] = [
  {
    id: "cover",
    title: "Cover",
    cut: "hard",
    layout: "cover",
    html: `<div class="cell" data-slot="0">${cover.html}</div>`,
    nodes: [cover.node],
  },
  {
    id: "seam",
    title: "Section — hard cut",
    cut: "hard",
    layout: "section",
    html: `<div class="cell" data-slot="0">${seam.html}</div>`,
    nodes: [seam.node],
  },
  {
    id: "code-v1",
    title: "Solo — code v1",
    cut: "hard",
    layout: "solo",
    html: `<div class="cell" data-slot="0">${create1.html}<pre><code>${CODE_V1}</code></pre></div>`,
    nodes: [create1.node, ...codeNodes(0, CODE_MATCHES_V1)],
  },
  {
    id: "code-v2",
    title: "Solo — code v2 (morph)",
    cut: "connected",
    layout: "solo",
    html: `<div class="cell" data-slot="0">${create2.html}<pre><code>${CODE_V2}</code></pre></div>`,
    nodes: [create2.node, ...codeNodes(0, CODE_MATCHES_V2)],
  },
  {
    id: "code-split",
    title: "Split — title persists, Embed enters",
    cut: "connected",
    layout: "split-2",
    html: `<div class="cell" data-slot="0">${create3.html}<pre><code>${CODE_V2}</code></pre></div><div class="cell" data-slot="1"><div class="embed">Live Embed</div></div>`,
    nodes: [create3.node, ...codeNodes(0, CODE_MATCHES_V2)],
  },
  {
    id: "persists",
    title: "Section — hard cut",
    cut: "hard",
    layout: "section",
    html: `<div class="cell" data-slot="0">${persists.html}</div>`,
    nodes: [persists.node],
  },
  {
    id: "harbour",
    title: "Harbour + photo A",
    cut: "connected",
    layout: "split-2",
    html: `<div class="cell" data-slot="0">${harbour1.html}</div><div class="cell" data-slot="1">${photoA1.html}</div>`,
    nodes: [harbour1.node, photoA1.node],
  },
  {
    id: "harbour-b",
    title: "Harbour + photo B",
    cut: "connected",
    layout: "split-2",
    html: `<div class="cell" data-slot="0">${harbour2.html}</div><div class="cell" data-slot="1">${photoB1.html}</div>`,
    nodes: [harbour2.node, photoB1.node],
  },
  {
    id: "nyhavn",
    title: "Nyhavn + photo B",
    cut: "connected",
    layout: "split-2",
    html: `<div class="cell" data-slot="0">${nyhavn.html}</div><div class="cell" data-slot="1">${photoB2.html}</div>`,
    nodes: [nyhavn.node, photoB2.node],
  },
  {
    id: "collision",
    title: "Collision — two 'same'",
    cut: "connected",
    layout: "split-2",
    html: `<div class="cell" data-slot="0">${dupA.html}</div><div class="cell" data-slot="1">${dupB.html}</div>`,
    nodes: [dupA.node, dupB.node],
  },
  {
    id: "after-collision",
    title: "After collision",
    cut: "connected",
    layout: "section",
    html: `<div class="cell" data-slot="0">${afterDup.html}</div>`,
    nodes: [afterDup.node],
  },
];

export function renderSlide(slide: DemoSlide): string {
  return `
    <div class="slide" data-layout="${slide.layout}" data-cut="${slide.cut}" data-slide="${slide.id}">
      <div class="cells">${slide.html}</div>
    </div>`;
}
