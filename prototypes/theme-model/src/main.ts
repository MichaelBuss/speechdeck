import "./engine.css";
import "./themes/a.css";
import "./themes/b.css";
import "./themes/c.css";
import { renderSlide, slides } from "./slides.ts";
import {
  resolvePaint,
  tokenStyle,
  VARIANT_IDS,
  variants,
  type Appearance,
  type VariantId,
} from "./variants.ts";

const PRESETS = [
  { id: "fill", label: "Fill", width: 0, height: 0 },
  { id: "projector", label: "16:9 1280×720", width: 1280, height: 720 },
  { id: "zoom", label: "Zoom 900×700", width: 900, height: 700 },
  { id: "square", label: "Square 800×800", width: 800, height: 800 },
  { id: "phone", label: "Phone 390×844", width: 390, height: 844 },
] as const;

type PresetId = (typeof PRESETS)[number]["id"];

const root = document.querySelector("#app");
if (!(root instanceof HTMLElement)) throw new Error("#app missing");
const app: HTMLElement = root;

let index = 0;
let preset: PresetId = "fill";
let variant: VariantId = "A";
let deckAppearance: Appearance = "dark";

app.innerHTML = `
  <div class="hud" id="hud"></div>
  <div class="contract" id="contract"></div>
  <div class="presets" id="presets"></div>
  <div class="stage-wrap">
    <div class="stage" id="stage" data-preset="fill"></div>
  </div>
  <div class="switcher" id="switcher"></div>
`;

const hud = must("#hud");
const contract = must("#contract");
const presetsEl = must("#presets");
const stage = must("#stage");
const switcher = must("#switcher");

presetsEl.innerHTML = [
  ...PRESETS.map(
    (p) =>
      `<button type="button" data-preset="${p.id}" aria-pressed="${p.id === preset}">${p.label}</button>`,
  ),
  `<button type="button" data-appearance-toggle="1">Appearance</button>`,
].join("");

function must(sel: string): HTMLElement {
  const el = app.querySelector(sel);
  if (!(el instanceof HTMLElement)) throw new Error(sel);
  return el;
}

function currentSearch(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function readUrl(): void {
  const q = currentSearch();
  const slide = q.get("slide");
  const found = slides.findIndex((s) => s.id === slide);
  index = found >= 0 ? found : 0;
  const p = q.get("preset");
  if (PRESETS.some((x) => x.id === p)) preset = p as PresetId;
  const v = q.get("variant");
  if (VARIANT_IDS.some((id) => id === v)) variant = v as VariantId;
  const a = q.get("appearance");
  if (a === "light" || a === "dark") deckAppearance = a;
}

function writeUrl(): void {
  const q = currentSearch();
  const slide = slides[index];
  if (slide) q.set("slide", slide.id);
  q.set("preset", preset);
  q.set("variant", variant);
  q.set("appearance", deckAppearance);
  window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
}

function applyPreset(): void {
  const spec = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];
  stage.dataset["preset"] = spec.id;
  if (spec.id === "fill") {
    stage.style.width = "100%";
    stage.style.height = "100%";
    return;
  }
  stage.style.width = `${spec.width}px`;
  stage.style.height = `${spec.height}px`;
}

function applyHeadingAlign(slideEl: HTMLElement): void {
  for (const heading of slideEl.querySelectorAll("h1, h2, h3, h4")) {
    if (!(heading instanceof HTMLElement)) continue;
    heading.removeAttribute("data-align");
    const lh = parseFloat(getComputedStyle(heading).lineHeight);
    const lines = lh > 0 ? heading.getBoundingClientRect().height / lh : 1;
    heading.dataset["align"] = lines > 1.35 ? "start" : "center";
  }
}

function loadTheme(id: VariantId): void {
  document.documentElement.setAttribute("data-variant", id);
}

function p3(): boolean {
  return window.matchMedia("(color-gamut: p3)").matches;
}

function render(): void {
  const slide = slides[index];
  if (slide === undefined) return;
  const painted = renderSlide(slide);
  const cuts = slides.map((s) => s.cut);
  const participate = slides.map((s) => s.background === undefined);
  const paint = resolvePaint({
    variant,
    index,
    cuts,
    participate,
    layout: painted.layout,
    deckAppearance,
    ...(slide.appearanceOverride !== undefined ? { slideOverride: slide.appearanceOverride } : {}),
  });

  loadTheme(variant);
  stage.innerHTML = painted.inner;
  const slideEl = stage.querySelector(".slide");
  if (slideEl instanceof HTMLElement) {
    slideEl.dataset["appearance"] = paint.appearance;
    slideEl.setAttribute("style", tokenStyle(paint, variant));
  }
  applyPreset();
  if (slideEl instanceof HTMLElement) applyHeadingAlign(slideEl);

  const spec = variants[variant];
  const n = slides.length;
  let shownBg = paint.bg;
  if (spec.travel === "css" && slideEl instanceof HTMLElement) {
    shownBg = getComputedStyle(slideEl).backgroundColor;
  }
  hud.innerHTML = `
    <span>variant <strong>${variant} — ${spec.name}</strong></span>
    <span>slide <strong>${index + 1}/${n} ${slide.title}</strong></span>
    <span>layout <strong>${painted.layout}</strong></span>
    <span>cut <strong>${slide.cut}</strong></span>
    <span>t <strong>${paint.t.toFixed(2)}</strong> (${spec.travel}${paint.skipped ? ", skip" : ""})</span>
    <span>bg <i class="swatch"></i> <strong>${shownBg}</strong></span>
    <span>appearance <strong>${paint.appearance}</strong> (${paint.appearanceSource})</span>
    <span>p3 <strong>${p3() ? "yes" : "no"}</strong></span>
  `;
  const swatch = hud.querySelector(".swatch");
  if (swatch instanceof HTMLElement) {
    swatch.style.background = shownBg === "css @property" ? "var(--sd-bg)" : shownBg;
  }

  contract.innerHTML = `
    <span><kbd>public</kbd> .slide[data-layout][data-appearance][data-cut] —sd-t —sd-bg —sd-fg —sd-title —sd-muted —sd-accent-* —sd-font-*</span>
    <span><kbd>public</kbd> .cell[data-kind] · img[data-fit][data-focus] · .backdrop[data-look] · mark[data-mark] · —shiki-token-*</span>
    <span><kbd>disk</kbd> ${spec.disk} — ${spec.onDisk}</span>
    <span><kbd>keys</kbd> ←→ slides · D appearance · bottom bar variants</span>
  `;

  switcher.innerHTML = `
    <button type="button" id="prev-variant" aria-label="Previous variant">←</button>
    <div class="label">${variant} — ${spec.name}</div>
    <button type="button" id="next-variant" aria-label="Next variant">→</button>
  `;

  for (const btn of presetsEl.querySelectorAll("button[data-preset]")) {
    btn.setAttribute("aria-pressed", String(btn.getAttribute("data-preset") === preset));
  }
  writeUrl();
}

function stepSlide(delta: number): void {
  index = (index + delta + slides.length) % slides.length;
  render();
}

function stepVariant(delta: number): void {
  const i = VARIANT_IDS.indexOf(variant);
  variant = VARIANT_IDS[(i + delta + VARIANT_IDS.length) % VARIANT_IDS.length] ?? "A";
  render();
}

presetsEl.addEventListener("click", (event) => {
  const btn = event.target;
  if (!(btn instanceof HTMLElement)) return;
  if (btn.dataset["appearanceToggle"] === "1") {
    deckAppearance = deckAppearance === "dark" ? "light" : "dark";
    render();
    return;
  }
  const id = btn.dataset["preset"];
  if (!PRESETS.some((x) => x.id === id) || id === undefined) return;
  preset = id as PresetId;
  render();
});

switcher.addEventListener("click", (event) => {
  const btn = event.target;
  if (!(btn instanceof HTMLButtonElement)) return;
  if (btn.id === "prev-variant") stepVariant(-1);
  if (btn.id === "next-variant") stepVariant(1);
});

window.addEventListener("keydown", (event) => {
  const t = event.target;
  if (
    t instanceof HTMLElement &&
    (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
  ) {
    return;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    stepSlide(-1);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    stepSlide(1);
  }
  if (event.key === "d" || event.key === "D") {
    event.preventDefault();
    deckAppearance = deckAppearance === "dark" ? "light" : "dark";
    render();
  }
  if (event.key === "[") {
    event.preventDefault();
    stepVariant(-1);
  }
  if (event.key === "]") {
    event.preventDefault();
    stepVariant(1);
  }
});

new ResizeObserver(() => {
  const slideEl = stage.querySelector(".slide");
  if (slideEl instanceof HTMLElement) applyHeadingAlign(slideEl);
}).observe(stage);

readUrl();
render();
