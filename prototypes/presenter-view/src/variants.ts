export const VARIANT_IDS = ["A", "B", "C"] as const;
export type VariantId = (typeof VARIANT_IDS)[number];

export const variants: Record<VariantId, { name: string }> = {
  A: { name: "Column" },
  B: { name: "HUD" },
  C: { name: "Filmstrip" },
};

export type PaneModel = {
  speech: readonly string[];
  elapsed: string;
  current: Thumb;
  next?: Thumb;
};

export type Thumb = {
  label: string;
  kicker: string;
  title: string;
  kind: string;
};

export function renderVariant(id: VariantId, model: PaneModel): string {
  if (id === "A") return column(model);
  if (id === "B") return hud(model);
  return filmstrip(model);
}

function speech(paragraphs: readonly string[]): string {
  return paragraphs.map((p) => `<p>${escape(p)}</p>`).join("");
}

function preview(thumb: Thumb, tag: string): string {
  return `
    <article class="preview" data-kind="${escape(thumb.kind)}">
      <span class="preview-tag">${escape(tag)}</span>
      <p class="preview-kicker">${escape(thumb.kicker)}</p>
      <h2>${escape(thumb.title)}</h2>
    </article>`;
}

function clock(elapsed: string): string {
  return `<button type="button" class="clock" title="Reset elapsed">${escape(elapsed)}</button>`;
}

function column(model: PaneModel): string {
  const next = model.next
    ? preview(model.next, "Up next")
    : `<article class="preview preview-end"><span class="preview-tag">Up next</span><p>End</p></article>`;
  return `
    <div class="presenter" data-variant="A">
      <section class="speech" aria-label="Speech">${speech(model.speech)}</section>
      <aside class="rail">
        ${clock(model.elapsed)}
        ${preview(model.current, "Now")}
        ${next}
      </aside>
    </div>`;
}

function hud(model: PaneModel): string {
  const next = model.next
    ? preview(model.next, "Up next")
    : `<article class="preview preview-end"><span class="preview-tag">Up next</span><p>End</p></article>`;
  return `
    <div class="presenter" data-variant="B">
      <header class="chrome">
        ${clock(model.elapsed)}
        <div class="chrome-previews">
          ${preview(model.current, "Now")}
          ${next}
        </div>
      </header>
      <section class="speech" aria-label="Speech">${speech(model.speech)}</section>
    </div>`;
}

function filmstrip(model: PaneModel): string {
  const next = model.next
    ? preview(model.next, "Up next")
    : `<article class="preview preview-end"><span class="preview-tag">Up next</span><p>End</p></article>`;
  return `
    <div class="presenter" data-variant="C">
      <section class="speech" aria-label="Speech">${speech(model.speech)}</section>
      <footer class="strip">
        ${preview(model.current, "Now")}
        ${next}
        ${clock(model.elapsed)}
      </footer>
    </div>`;
}

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
