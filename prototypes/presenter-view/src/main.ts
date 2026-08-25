import { slides, type DemoSlide } from "./slides.ts";
import { openSlideSync } from "./sync.ts";
import { renderVariant, VARIANT_IDS, variants, type VariantId } from "./variants.ts";
import "./style.css";

const PRESETS = [
  { id: "fill", label: "Fill", width: 0, height: 0 },
  { id: "laptop", label: "Laptop 1280×800", width: 1280, height: 800 },
  { id: "projector", label: "16:9 1280×720", width: 1280, height: 720 },
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
let view: "presenter" | "audience" = "presenter";
let origin = Date.now();
let applyingRemote = false;
let audience: Window | null = null;

const sync = openSlideSync((id) => {
  const found = slides.findIndex((s) => s.id === id);
  if (found < 0 || found === index) return;
  applyingRemote = true;
  index = found;
  render();
  applyingRemote = false;
});

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
  view = q.get("view") === "audience" ? "audience" : "presenter";
  const slide = q.get("slide");
  const found = slides.findIndex((s) => s.id === slide);
  index = found >= 0 ? found : 0;
  const p = q.get("preset");
  if (PRESETS.some((x) => x.id === p)) preset = p as PresetId;
  const v = q.get("variant");
  if (VARIANT_IDS.some((id) => id === v)) variant = v as VariantId;
}

function writeUrl(): void {
  const q = currentSearch();
  const slide = slides[index];
  if (slide) q.set("slide", slide.id);
  if (view === "audience") q.set("view", "audience");
  else q.delete("view");
  q.set("preset", preset);
  q.set("variant", variant);
  const path = window.location.pathname;
  window.history.replaceState(null, "", `${path}?${q.toString()}`);
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

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m)}:${String(s).padStart(2, "0")}`;
}

function thumbOf(slide: DemoSlide) {
  return { label: slide.id, kicker: slide.kicker, title: slide.title, kind: slide.kind };
}

function renderAudience(slide: DemoSlide): string {
  return `
    <div class="audience" data-kind="${slide.kind}">
      <p class="kicker">${slide.kicker}</p>
      <h1>${slide.title}</h1>
    </div>`;
}

function render(): void {
  const slide = slides[index];
  if (slide === undefined) return;
  const next = slides[index + 1];
  applyPreset();
  writeUrl();
  if (!applyingRemote) sync.post(slide.id);

  document.documentElement.dataset["view"] = view;
  document.title = view === "audience" ? "Audience — Slide" : "PROTOTYPE — presenter view";

  if (view === "audience") {
    hud.innerHTML = `<span>audience <strong>${slide.title}</strong></span><span>slide <strong>${index + 1}/${slides.length}</strong></span>`;
    contract.innerHTML = `<span><kbd>audience</kbd> the Slide only · Speech is in the other window · ←→ navigates both</span>`;
    presetsEl.innerHTML = "";
    switcher.innerHTML = "";
    stage.innerHTML = renderAudience(slide);
    return;
  }

  const elapsed = formatElapsed(Date.now() - origin);
  stage.innerHTML = renderVariant(variant, {
    speech: slide.speech,
    elapsed,
    current: thumbOf(slide),
    ...(next !== undefined ? { next: thumbOf(next) } : {}),
  });

  const spec = variants[variant];
  const comment = slide.comment === undefined ? "none on this Slide" : "hidden (not in Presenter view)";
  hud.innerHTML = `
    <span>variant <strong>${variant} — ${spec.name}</strong></span>
    <span>slide <strong>${index + 1}/${slides.length} ${slide.title}</strong></span>
    <span>elapsed <strong id="hud-elapsed">${elapsed}</strong></span>
    <span>comment <strong>${comment}</strong></span>
    <span>mirror <strong>no</strong></span>
    <span>audience <strong>${audience && !audience.closed ? "open" : "rehearse"}</strong></span>
  `;
  contract.innerHTML = `
    <span><kbd>present</kbd> Open audience window · <kbd>rehearse</kbd> this window only</span>
    <span><kbd>keys</kbd> ←→ slides · [ ] variants · click clock to reset</span>
    <span><kbd>narrow</kbd> Phone preset — Speech stays, previews become a strip</span>
  `;
  presetsEl.innerHTML = [
    ...PRESETS.map(
      (p) => `<button type="button" data-preset="${p.id}" aria-pressed="${p.id === preset}">${p.label}</button>`,
    ),
    `<button type="button" data-open-audience="1">Open audience window</button>`,
  ].join("");
  switcher.innerHTML = `
    <button type="button" id="prev-variant" aria-label="Previous variant">←</button>
    <div class="label">${variant} — ${spec.name}</div>
    <button type="button" id="next-variant" aria-label="Next variant">→</button>
  `;
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

function openAudience(): void {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "audience");
  url.searchParams.set("slide", slides[index]?.id ?? "cover");
  url.searchParams.set("preset", "fill");
  audience = window.open(url.toString(), "speechdeck-audience");
  render();
}

function tickClock(): void {
  if (view === "audience") return;
  const elapsed = formatElapsed(Date.now() - origin);
  const hudElapsed = hud.querySelector("#hud-elapsed");
  if (hudElapsed) hudElapsed.textContent = elapsed;
  const clock = stage.querySelector(".clock");
  if (clock) clock.textContent = elapsed;
}

presetsEl.addEventListener("click", (event) => {
  const btn = event.target;
  if (!(btn instanceof HTMLElement)) return;
  if (btn.dataset["openAudience"] === "1") {
    openAudience();
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

stage.addEventListener("click", (event) => {
  const btn = event.target;
  if (!(btn instanceof HTMLElement) || !btn.classList.contains("clock")) return;
  origin = Date.now();
  tickClock();
});

window.addEventListener("keydown", (event) => {
  const t = event.target;
  if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
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
  if (view === "audience") return;
  if (event.key === "[") {
    event.preventDefault();
    stepVariant(-1);
  }
  if (event.key === "]") {
    event.preventDefault();
    stepVariant(1);
  }
});

window.addEventListener("beforeunload", () => sync.close());

readUrl();
render();
window.setInterval(tickClock, 250);
