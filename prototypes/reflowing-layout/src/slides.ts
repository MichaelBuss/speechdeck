import { captionOrder, pickLayout, type Cell, type LayoutName } from "./pick-layout.ts";

const PHOTO =
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=70";
const CODE_PHOTO =
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1400&q=70";
const FACE_PHOTO =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=70";

export type DemoSlide = {
  id: string;
  title: string;
  cells: readonly Cell[];
  override?: LayoutName;
  html: string;
  background?: {
    src: string;
    fit: "contain" | "crop";
    focus: string;
    looks: string;
  };
};

const API = `export function createDeck(source: string): Deck

export function pickLayout(slide: Slide): LayoutName
`;

export const slides: DemoSlide[] = [
  {
    id: "cover",
    title: "Cover",
    cells: [{ firstHeading: 1 }],
    html: `
      <div class="cell">
        <p class="kicker">JS Copenhagen</p>
        <h1>APIs without implementation anxiety</h1>
      </div>`,
  },
  {
    id: "cover-bg",
    title: "Cover + Background dim blur",
    cells: [{ firstHeading: 1 }],
    background: { src: PHOTO, fit: "crop", focus: "top", looks: "dim blur" },
    html: `
      <div class="cell">
        <p class="kicker">JS Copenhagen</p>
        <h1>APIs without implementation anxiety</h1>
      </div>`,
  },
  {
    id: "section",
    title: "Section",
    cells: [{ firstHeading: 2 }],
    html: `<div class="cell"><h2>The resolver is the API</h2></div>`,
  },
  {
    id: "solo-code",
    title: "Solo — heading + fence, one Cell",
    cells: [{ firstHeading: 3, hasCode: true }],
    html: `
      <div class="cell">
        <h3>createDeck</h3>
        <pre>${API}</pre>
      </div>`,
  },
  {
    id: "split-2",
    title: "Split-2 — code | Embed",
    cells: [{ firstHeading: 3, hasCode: true }, { hasEmbed: true }],
    html: `
      <div class="cell">
        <h3>The seam</h3>
        <pre>mount(el, props) => ({ dispose, ready })</pre>
      </div>
      <div class="cell"><div class="embed">Live Embed</div></div>`,
  },
  {
    id: "split-3",
    title: "Split-3 — three APIs",
    cells: [{ firstHeading: 4 }, { firstHeading: 4 }, { firstHeading: 4 }],
    html: `
      <div class="cell card"><h4>parse</h4><p class="kicker">document → Deck</p></div>
      <div class="cell card"><h4>pickLayout</h4><p class="kicker">Slide → name</p></div>
      <div class="cell card"><h4>mount</h4><p class="kicker">el + props</p></div>`,
  },
  {
    id: "grid",
    title: "Grid — four Cells",
    cells: [
      { firstHeading: 4 },
      { firstHeading: 4 },
      { firstHeading: 4 },
      { firstHeading: 4 },
    ],
    html: `
      <div class="cell card"><h4>string literals</h4></div>
      <div class="cell card"><h4>no boolean soup</h4></div>
      <div class="cell card"><h4>no disableWhatever</h4></div>
      <div class="cell card"><h4>concrete current use</h4></div>`,
  },
  {
    id: "caption-title-first",
    title: "Caption — H4 then image",
    cells: [{ firstHeading: 4 }, { hasImage: true }],
    html: `
      <div class="cell"><h4>The photo is not the talk</h4></div>
      <div class="cell"><img src="${CODE_PHOTO}" alt="" data-fit="contain" data-focus="center" /></div>`,
  },
  {
    id: "caption-image-first",
    title: "Caption — image then H4",
    cells: [{ hasImage: true }, { firstHeading: 4 }],
    html: `
      <div class="cell"><img src="${CODE_PHOTO}" alt="" data-fit="crop" data-focus="center" /></div>
      <div class="cell"><h4>Crop fills the box</h4></div>`,
  },
  {
    id: "focus",
    title: "Crop + Focus top-left vs bottom-right",
    cells: [{ hasImage: true }, { hasImage: true }],
    html: `
      <div class="cell">
        <p class="kicker">crop top-left</p>
        <img src="${FACE_PHOTO}" alt="" data-fit="crop" data-focus="top-left" />
      </div>
      <div class="cell">
        <p class="kicker">crop bottom-right</p>
        <img src="${FACE_PHOTO}" alt="" data-fit="crop" data-focus="bottom-right" />
      </div>`,
  },
  {
    id: "contain",
    title: "Contain vs Crop on the same file",
    cells: [{ hasImage: true }, { hasImage: true }],
    html: `
      <div class="cell">
        <p class="kicker">contain center</p>
        <img src="${PHOTO}" alt="" data-fit="contain" data-focus="center" />
      </div>
      <div class="cell">
        <p class="kicker">crop center</p>
        <img src="${PHOTO}" alt="" data-fit="crop" data-focus="center" />
      </div>`,
  },
  {
    id: "overflow",
    title: "Refuse — this Slide does not fit",
    cells: [
      { firstHeading: 2 },
      { firstHeading: 2 },
      { firstHeading: 2 },
      { firstHeading: 2 },
      { firstHeading: 2 },
      { firstHeading: 2 },
    ],
    html: `
      <div class="cell card overflow-bait"><h2>One</h2><p>A Cell that will not yield.</p></div>
      <div class="cell card overflow-bait"><h2>Two</h2><p>A Cell that will not yield.</p></div>
      <div class="cell card overflow-bait"><h2>Three</h2><p>A Cell that will not yield.</p></div>
      <div class="cell card overflow-bait"><h2>Four</h2><p>A Cell that will not yield.</p></div>
      <div class="cell card overflow-bait"><h2>Five</h2><p>A Cell that will not yield.</p></div>
      <div class="cell card overflow-bait"><h2>Six</h2><p>A Cell that will not yield.</p></div>`,
  },
  {
    id: "impossible",
    title: "Impossible override — layout: split-2 on one Cell",
    cells: [{ firstHeading: 1 }],
    override: "split-2",
    html: `
      <div class="cell">
        <h1>This asked for Split-2</h1>
      </div>`,
  },
];

export function renderSlide(slide: DemoSlide): { inner: string; result: ReturnType<typeof pickLayout>; order?: ReturnType<typeof captionOrder> } {
  const result = pickLayout({ cells: slide.cells, ...(slide.override !== undefined ? { override: slide.override } : {}) });
  const order = captionOrder(slide.cells);
  const backdrop = slide.background
    ? `<div class="backdrop" data-look="${slide.background.looks}">
        <img src="${slide.background.src}" alt="" data-fit="${slide.background.fit}" data-focus="${slide.background.focus}" />
      </div>`
    : "";
  const inner = `
    <div class="slide">
      ${backdrop}
      <div class="cells" data-layout="${result.layout}" data-items="${slide.cells.length}"${order ? ` data-caption-order="${order}"` : ""}>${slide.html}</div>
    </div>`;
  return { inner, result, ...(order !== undefined ? { order } : {}) };
}
