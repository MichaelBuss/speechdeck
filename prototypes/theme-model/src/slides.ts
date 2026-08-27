import { captionOrder, pickLayout, type Cell, type LayoutName } from "./pick-layout.ts";
import type { CutKind } from "./travel.ts";

const PHOTO =
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=70";
const FACE_PHOTO =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=70";

export type CellKind = "heading" | "code" | "image" | "embed" | "prose";

export type DemoSlide = {
  id: string;
  title: string;
  cut: CutKind;
  cells: readonly Cell[];
  kinds: readonly CellKind[];
  html: string;
  appearanceOverride?: "light" | "dark";
  background?: {
    src: string;
    fit: "contain" | "crop";
    focus: string;
    looks: string;
  };
};

const MOUNT = `mount(el, props) => ({ dispose, ready })`;

const CREATE = `<span style="color: var(--shiki-token-keyword)">export function</span> <span style="color: var(--shiki-token-function)">createDeck</span>(<span style="color: var(--shiki-token-parameter)">source</span>: <span style="color: var(--shiki-token-constant)">string</span>): <span style="color: var(--shiki-token-constant)">Deck</span>`;

export const slides: DemoSlide[] = [
  {
    id: "cover",
    title: "Cover",
    cut: "hard",
    cells: [{ firstHeading: 1 }],
    kinds: ["heading"],
    html: `
      <div class="cell" data-kind="heading">
        <p>JS Copenhagen</p>
        <h1>APIs without <mark data-mark="underline">implementation anxiety</mark></h1>
      </div>`,
  },
  {
    id: "cover-bg",
    title: "Cover + Background",
    cut: "connected",
    cells: [{ firstHeading: 1 }],
    kinds: ["heading"],
    background: { src: PHOTO, fit: "crop", focus: "top", looks: "dim blur" },
    html: `
      <div class="cell" data-kind="heading">
        <p>JS Copenhagen</p>
        <h1>The slide is a document</h1>
      </div>`,
  },
  {
    id: "section-seam",
    title: "Section — hard cut",
    cut: "hard",
    cells: [{ firstHeading: 2 }],
    kinds: ["heading"],
    html: `<div class="cell" data-kind="heading"><h2>The seam</h2></div>`,
  },
  {
    id: "solo-code",
    title: "Solo — code",
    cut: "connected",
    cells: [{ firstHeading: 3, hasCode: true }],
    kinds: ["code"],
    html: `
      <div class="cell" data-kind="code">
        <h3>createDeck</h3>
        <pre><code>${CREATE}</code></pre>
      </div>`,
  },
  {
    id: "split-2",
    title: "Split-2 — code | Embed",
    cut: "connected",
    cells: [{ firstHeading: 3, hasCode: true }, { hasEmbed: true }],
    kinds: ["code", "embed"],
    html: `
      <div class="cell" data-kind="code">
        <h3>The seam</h3>
        <pre><code>${MOUNT}</code></pre>
      </div>
      <div class="cell" data-kind="embed"><div class="embed">Live Embed</div></div>`,
  },
  {
    id: "grid",
    title: "Grid",
    cut: "connected",
    cells: [{ firstHeading: 4 }, { firstHeading: 4 }, { firstHeading: 4 }, { firstHeading: 4 }],
    kinds: ["prose", "prose", "prose", "prose"],
    html: `
      <div class="cell" data-kind="prose"><h4>tokens, not classes</h4></div>
      <div class="cell" data-kind="prose"><h4>or classes, not tokens</h4></div>
      <div class="cell" data-kind="prose"><h4>or layout forces paint</h4></div>
      <div class="cell" data-kind="prose"><h4>that is the variant</h4></div>`,
  },
  {
    id: "caption",
    title: "Caption",
    cut: "connected",
    cells: [{ firstHeading: 4 }, { hasImage: true }],
    kinds: ["heading", "image"],
    html: `
      <div class="cell" data-kind="heading"><h4>A caption is still a Slide</h4></div>
      <div class="cell" data-kind="image"><img src="${FACE_PHOTO}" alt="" data-fit="contain" data-focus="center" /></div>`,
  },
  {
    id: "section-end",
    title: "Section — second hard cut",
    cut: "hard",
    cells: [{ firstHeading: 2 }],
    kinds: ["heading"],
    html: `<div class="cell" data-kind="heading"><h2>What a theme is</h2></div>`,
  },
  {
    id: "solo-force-light",
    title: "Solo — author appearance: light",
    cut: "connected",
    cells: [{ firstHeading: 3 }],
    kinds: ["heading"],
    appearanceOverride: "light",
    html: `
      <div class="cell" data-kind="heading">
        <h3>This Slide asked for light</h3>
      </div>`,
  },
];

export function renderSlide(slide: DemoSlide): {
  inner: string;
  result: ReturnType<typeof pickLayout>;
  layout: LayoutName;
} {
  const result = pickLayout({ cells: slide.cells });
  const order = captionOrder(slide.cells);
  const backdrop = slide.background
    ? `<div class="backdrop" data-look="${slide.background.looks}">
        <img src="${slide.background.src}" alt="" data-fit="${slide.background.fit}" data-focus="${slide.background.focus}" />
      </div>`
    : "";
  const inner = `
    <div
      class="slide"
      data-layout="${result.layout}"
      data-cut="${slide.cut}"
      data-items="${slide.cells.length}"
      ${order ? `data-caption-order="${order}"` : ""}
    >
      ${backdrop}
      <div class="cells" data-layout="${result.layout}" data-items="${slide.cells.length}"${order ? ` data-caption-order="${order}"` : ""}>${slide.html}</div>
    </div>`;
  return { inner, result, layout: result.layout };
}
