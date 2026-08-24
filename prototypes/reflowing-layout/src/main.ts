import "./style.css";
import { renderSlide, slides } from "./slides.ts";
import type { PickResult } from "./pick-layout.ts";

const PRESETS = [
  { id: "fill", label: "Fill", width: 0, height: 0 },
  { id: "projector", label: "16:9 1280×720", width: 1280, height: 720 },
  { id: "zoom", label: "Zoom 900×700", width: 900, height: 700 },
  { id: "square", label: "Square 800×800", width: 800, height: 800 },
  { id: "phone", label: "Phone 390×844", width: 390, height: 844 },
  { id: "phone-l", label: "Phone landscape 844×390", width: 844, height: 390 },
] as const;

type PresetId = (typeof PRESETS)[number]["id"];

const app = document.querySelector("#app");
if (!(app instanceof HTMLElement)) throw new Error("#app missing");

let index = 0;
let preset: PresetId = "fill";
let lastPick: PickResult | undefined;

app.innerHTML = `
  <div class="hud" id="hud"></div>
  <div class="presets" id="presets"></div>
  <div class="stage-wrap">
    <div class="stage" id="stage" data-preset="fill"></div>
  </div>
  <div class="switcher" id="switcher"></div>
`;

const hud = must("#hud");
const presetsEl = must("#presets");
const stage = must("#stage");
const switcher = must("#switcher");

presetsEl.innerHTML = PRESETS.map(
  (p) => `<button type="button" data-preset="${p.id}" aria-pressed="${p.id === preset}">${p.label}</button>`,
).join("");

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
}

function writeUrl(): void {
  const q = currentSearch();
  const slide = slides[index];
  if (slide) q.set("slide", slide.id);
  q.set("preset", preset);
  const next = `${window.location.pathname}?${q.toString()}`;
  window.history.replaceState(null, "", next);
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

function boxOverflows(el: HTMLElement): boolean {
  // Headings with text-wrap:balance leak a few px of scrollHeight from
  // half-leading. A real refuse is a whole glyph or line past the box.
  return el.scrollWidth - el.clientWidth > 2 || el.scrollHeight - el.clientHeight > 8;
}

function spills(inner: DOMRect, outer: DOMRect): boolean {
  return (
    inner.right > outer.right + 1 ||
    inner.bottom > outer.bottom + 1 ||
    inner.left < outer.left - 1 ||
    inner.top < outer.top - 1
  );
}

function measureOverflow(slideEl: HTMLElement): boolean {
  const cells = slideEl.querySelector(".cells");
  if (!(cells instanceof HTMLElement)) return false;
  if (boxOverflows(cells)) return true;
  const outer = cells.getBoundingClientRect();
  for (const cell of cells.querySelectorAll(".cell")) {
    if (!(cell instanceof HTMLElement)) continue;
    if (boxOverflows(cell) || spills(cell.getBoundingClientRect(), outer)) return true;
    for (const node of cell.querySelectorAll("h1, h2, h3, h4, p, pre, .embed, img")) {
      if (!(node instanceof HTMLElement)) continue;
      if (boxOverflows(node) || spills(node.getBoundingClientRect(), cell.getBoundingClientRect())) {
        return true;
      }
    }
  }
  return false;
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

function render(): void {
  const slide = slides[index];
  if (slide === undefined) return;
  const painted = renderSlide(slide);
  lastPick = painted.result;
  stage.innerHTML = painted.inner;
  applyPreset();
  refreshChrome();
  const n = slides.length;
  switcher.innerHTML = `
    <button type="button" id="prev" aria-label="Previous">←</button>
    <div class="label">${index + 1}/${n} — ${slide.title}</div>
    <button type="button" id="next" aria-label="Next">→</button>
  `;
  for (const btn of presetsEl.querySelectorAll("button")) {
    btn.setAttribute("aria-pressed", String(btn.getAttribute("data-preset") === preset));
  }
  writeUrl();
}

function refreshChrome(): void {
  const slideEl = stage.querySelector(".slide");
  if (slideEl instanceof HTMLElement) applyHeadingAlign(slideEl);
  paintHud();
}

function paintHud(): void {
  const slideEl = stage.querySelector(".slide");
  const overflow = slideEl instanceof HTMLElement ? measureOverflow(slideEl) : false;
  const box = stage.getBoundingClientRect();
  const align =
    slideEl instanceof HTMLElement
      ? [...slideEl.querySelectorAll("[data-align]")]
          .map((el) => (el instanceof HTMLElement ? el.dataset["align"] : undefined))
          .find((value) => value !== undefined)
      : undefined;
  const pick = lastPick;
  const slide = slides[index];
  hud.dataset["overflow"] = String(overflow);
  hud.dataset["impossible"] = String(pick?.impossible ?? false);
  hud.innerHTML = `
    <span>layout <strong>${pick?.layout ?? "?"}</strong>${
      pick?.overridden ? ` (override, auto ${pick.auto})` : " (auto)"
    }</span>
    <span>cells <strong>${slide?.cells.length ?? "?"}</strong></span>
    <span>stage <strong>${Math.round(box.width)}×${Math.round(box.height)}</strong></span>
    <span>heading <strong>${align ?? "—"}</strong></span>
    <span>overflow <strong>${overflow ? "YES — refuse" : "no"}</strong></span>
    ${pick?.impossible ? `<span>impossible override <strong>lint, fell back</strong></span>` : ""}
  `;
}

function step(delta: number): void {
  index = (index + delta + slides.length) % slides.length;
  render();
}

presetsEl.addEventListener("click", (event) => {
  const btn = event.target;
  if (!(btn instanceof HTMLElement)) return;
  const id = btn.dataset["preset"];
  if (!PRESETS.some((p) => p.id === id) || id === undefined) return;
  preset = id as PresetId;
  render();
});

switcher.addEventListener("click", (event) => {
  const btn = event.target;
  if (!(btn instanceof HTMLButtonElement)) return;
  if (btn.id === "prev") step(-1);
  if (btn.id === "next") step(1);
});

window.addEventListener("keydown", (event) => {
  const t = event.target;
  if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
    return;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    step(-1);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    step(1);
  }
});

new ResizeObserver(() => {
  refreshChrome();
}).observe(stage);

stage.addEventListener("load", () => refreshChrome(), true);

readUrl();
render();
