import "./engine.css";
import "./motion.css";
import {
  decideNav,
  decideResize,
  interruptLabels,
  INTERRUPT_IDS,
  RESIZE_IDS,
  type InterruptId,
  type ResizeId,
} from "./interrupt.ts";
import { mintNames, VARIANT_IDS, variants, type NameAssignment, type VariantId } from "./names.ts";
import { renderSlide, slides } from "./slides.ts";

const PRESETS = [
  { id: "fill", label: "Fill", width: 0, height: 0 },
  { id: "projector", label: "16:9 1280×720", width: 1280, height: 720 },
  { id: "zoom", label: "Zoom 900×700", width: 900, height: 700 },
  { id: "square", label: "Square 800×800", width: 800, height: 800 },
] as const;

type PresetId = (typeof PRESETS)[number]["id"];

const root = document.querySelector("#app");
if (!(root instanceof HTMLElement)) throw new Error("#app missing");
const app: HTMLElement = root;

let index = 0;
let goal = 0;
let preset: PresetId = "fill";
let variant: VariantId = "A";
let interrupt: InterruptId = "skip";
let resizePolicy: ResizeId = "skip";
let honourReduced = true;
let themeMotion = true;
let lastEvent = "idle";
let queued: number[] = [];
let deferredResize = false;
let inflight = false;

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
  const slide = q.get("slide");
  const found = slides.findIndex((s) => s.id === slide);
  index = found >= 0 ? found : 0;
  goal = index;
  const p = q.get("preset");
  if (PRESETS.some((x) => x.id === p)) preset = p as PresetId;
  const v = q.get("variant");
  if (VARIANT_IDS.some((id) => id === v)) variant = v as VariantId;
  const i = q.get("interrupt");
  if (INTERRUPT_IDS.some((id) => id === i)) interrupt = i as InterruptId;
  const r = q.get("resize");
  if (RESIZE_IDS.some((id) => id === r)) resizePolicy = r as ResizeId;
  if (q.get("reduced") === "off") honourReduced = false;
  if (q.get("motion") === "off") themeMotion = false;
}

function writeUrl(): void {
  const q = currentSearch();
  const slide = slides[index];
  if (slide) q.set("slide", slide.id);
  q.set("preset", preset);
  q.set("variant", variant);
  q.set("interrupt", interrupt);
  q.set("resize", resizePolicy);
  q.set("reduced", honourReduced ? "on" : "off");
  q.set("motion", themeMotion ? "on" : "off");
  window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function activeVt(): ViewTransition | null {
  const doc = document as Document & { activeViewTransition?: ViewTransition | null };
  return doc.activeViewTransition ?? null;
}

function wrap(i: number): number {
  return ((i % slides.length) + slides.length) % slides.length;
}

function pairFor(fromIndex: number, toIndex: number) {
  const from = slides[fromIndex];
  const to = slides[toIndex];
  if (from === undefined || to === undefined) return undefined;
  return mintNames(variant, from.nodes, to.nodes);
}

function previewNames(): void {
  const slide = slides[index];
  const next = slides[wrap(index + 1)];
  if (slide === undefined || next === undefined || next.cut !== "connected") return;
  applyNames(mintNames(variant, slide.nodes, next.nodes).from);
}

function applyNames(map: Map<string, NameAssignment>): string[] {
  const assigned: string[] = [];
  for (const [id, assignment] of map) {
    const el = stage.querySelector(`[data-node="${id}"]`);
    if (!(el instanceof HTMLElement)) continue;
    el.style.setProperty("view-transition-name", assignment.name);
    el.style.setProperty("view-transition-class", assignment.className);
    el.dataset["vt"] = assignment.name;
    assigned.push(`${id}→${assignment.name}`);
  }
  return assigned;
}

function paintSlide(): void {
  const slide = slides[index];
  if (slide === undefined) return;
  stage.innerHTML = renderSlide(slide);
  applyPreset();
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

function namesOnStage(): string {
  const named = [...stage.querySelectorAll("[data-vt]")].map((el) => {
    if (!(el instanceof HTMLElement)) return "";
    return el.dataset["vt"] ?? "";
  });
  return named.filter(Boolean).join(" · ") || "none";
}

function nextCut(): string {
  const next = slides[wrap(index + 1)];
  return next?.cut ?? "hard";
}

function renderHud(): void {
  const slide = slides[index];
  if (slide === undefined) return;
  const n = slides.length;
  const next = slides[wrap(index + 1)];
  const mint = next ? mintNames(variant, slide.nodes, next.nodes) : undefined;
  const collisions = mint?.collisions ?? [];
  document.documentElement.dataset["themeMotion"] = themeMotion ? "on" : "off";

  hud.innerHTML = `
    <span>variant <strong>${variant} — ${variants[variant].name}</strong></span>
    <span>slide <strong>${index + 1}/${n} ${slide.title}</strong></span>
    <span>cut in <strong>${slide.cut}</strong> · next <strong>${nextCut()}</strong></span>
    <span>names <strong>${namesOnStage()}</strong></span>
    <span>interrupt <strong>${interruptLabels[interrupt]}</strong></span>
    <span>resize <strong>${resizePolicy}</strong></span>
    <span>reduced-motion <strong>${reducedMotion() ? "prefers" : "no"}</strong> honour <strong>${honourReduced ? "on" : "off"}</strong></span>
    <span>queue <strong>${queued.length}</strong></span>
    <span>last <strong>${lastEvent}</strong></span>
    <span class="${collisions.length > 0 ? "warn" : ""}">next collisions <strong>${collisions.join(", ") || "none"}</strong></span>
  `;

  contract.innerHTML = `
    <span><kbd>feel</kbd> ←→ at presenting speed · mash arrows · drag the stage corner on a non-Fill preset</span>
    <span><kbd>A</kbd> Identity — heading text, image src, code match key</span>
    <span><kbd>B</kbd> Slots — Cell index morphs even when the content kind changes</span>
    <span><kbd>C</kbd> Roles — one title, one code, one figure; extras unnamed</span>
    <span><kbd>keys</kbd> [ ] variants · I interrupt · R resize · M theme motion · P reduced honour</span>
  `;

  switcher.innerHTML = `
    <button type="button" id="prev-variant" aria-label="Previous variant">←</button>
    <div class="label">${variant} — ${variants[variant].name}</div>
    <button type="button" id="next-variant" aria-label="Next variant">→</button>
  `;

  presetsEl.innerHTML = `
    <div class="group">
      ${PRESETS.map(
        (p) =>
          `<button type="button" data-preset="${p.id}" aria-pressed="${p.id === preset}">${p.label}</button>`,
      ).join("")}
    </div>
    <div class="group">
      <span class="group-label">interrupt</span>
      ${INTERRUPT_IDS.map(
        (id) =>
          `<button type="button" data-interrupt="${id}" aria-pressed="${id === interrupt}">${interruptLabels[id]}</button>`,
      ).join("")}
    </div>
    <div class="group">
      <span class="group-label">resize</span>
      ${RESIZE_IDS.map(
        (id) =>
          `<button type="button" data-resize="${id}" aria-pressed="${id === resizePolicy}">${id}</button>`,
      ).join("")}
    </div>
    <div class="group">
      <button type="button" data-reduced="1" aria-pressed="${honourReduced}">honour reduced-motion</button>
      <button type="button" data-motion="1" aria-pressed="${themeMotion}">theme motion</button>
    </div>
  `;

  writeUrl();
}

function paintIdle(): void {
  paintSlide();
  previewNames();
  renderHud();
}

function isActive(): boolean {
  return inflight || activeVt() !== null;
}

function runTo(toIndex: number, action: "hard-cut" | "go"): void {
  const fromIndex = index;
  const to = slides[toIndex];
  if (to === undefined) return;
  const connected = to.cut === "connected";

  if (action === "hard-cut") {
    index = toIndex;
    lastEvent = connected ? "hard-cut (reduced-motion)" : "hard-cut";
    inflight = false;
    paintIdle();
    drainQueue();
    return;
  }

  const mint = pairFor(fromIndex, toIndex);
  if (mint) applyNames(mint.from);
  lastEvent = mint && mint.collisions.length > 0 ? `go (collisions: ${mint.collisions.join(", ")})` : "go";
  inflight = true;
  renderHud();

  const go = () => {
    index = toIndex;
    paintSlide();
    if (mint) applyNames(mint.to);
  };

  if (typeof document.startViewTransition !== "function") {
    go();
    lastEvent = "no View Transition API";
    inflight = false;
    previewNames();
    renderHud();
    drainQueue();
    return;
  }

  const vt = document.startViewTransition(go);
  vt.ready.then(
    () => {
      lastEvent = lastEvent.startsWith("go") ? `${lastEvent} · ready` : "ready";
      renderHud();
    },
    (err: unknown) => {
      lastEvent = `ready rejected (${err instanceof Error ? err.name : "error"})`;
      renderHud();
    },
  );
  vt.finished.then(
    () => {
      lastEvent = "finished";
      inflight = false;
      previewNames();
      renderHud();
      drainQueue();
    },
    (err: unknown) => {
      lastEvent = `skipped (${err instanceof Error ? err.name : "error"})`;
      inflight = false;
      previewNames();
      renderHud();
      drainQueue();
    },
  );
}

function drainQueue(): void {
  if (interrupt !== "queue" || queued.length === 0) {
    if (interrupt !== "queue") queued = [];
    return;
  }
  const target = queued.shift();
  if (target === undefined) return;
  const to = slides[target];
  if (to === undefined) return;
  const reduced = reducedMotion() && honourReduced;
  const action = to.cut === "connected" && !reduced ? "go" : "hard-cut";
  runTo(target, action);
}

function stepSlide(delta: number): void {
  const target = wrap(goal + delta);
  const to = slides[target];
  if (to === undefined) return;
  const action = decideNav({
    connected: to.cut === "connected",
    reducedMotion: reducedMotion(),
    honourReduced,
    policy: interrupt,
    active: isActive(),
  });
  if (action === "ignore") {
    lastEvent = "throttled";
    renderHud();
    return;
  }
  if (action === "queue") {
    queued.push(target);
    goal = target;
    lastEvent = `queued (${queued.length})`;
    renderHud();
    return;
  }
  goal = target;
  runTo(target, action);
}

function stepVariant(delta: number): void {
  const i = VARIANT_IDS.indexOf(variant);
  variant = VARIANT_IDS[(i + delta + VARIANT_IDS.length) % VARIANT_IDS.length] ?? "A";
  lastEvent = "variant";
  paintIdle();
}

presetsEl.addEventListener("click", (event) => {
  const btn = event.target;
  if (!(btn instanceof HTMLElement)) return;
  const presetId = btn.dataset["preset"];
  if (PRESETS.some((x) => x.id === presetId) && presetId !== undefined) {
    preset = presetId as PresetId;
    applyPreset();
    renderHud();
    return;
  }
  const interruptId = btn.dataset["interrupt"];
  if (INTERRUPT_IDS.some((id) => id === interruptId) && interruptId !== undefined) {
    interrupt = interruptId as InterruptId;
    queued = [];
    renderHud();
    return;
  }
  const resizeId = btn.dataset["resize"];
  if (RESIZE_IDS.some((id) => id === resizeId) && resizeId !== undefined) {
    resizePolicy = resizeId as ResizeId;
    renderHud();
    return;
  }
  if (btn.dataset["reduced"] === "1") {
    honourReduced = !honourReduced;
    renderHud();
    return;
  }
  if (btn.dataset["motion"] === "1") {
    themeMotion = !themeMotion;
    renderHud();
  }
});

switcher.addEventListener("click", (event) => {
  const btn = event.target;
  if (!(btn instanceof HTMLButtonElement)) return;
  if (btn.id === "prev-variant") stepVariant(-1);
  if (btn.id === "next-variant") stepVariant(1);
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
  if (event.key === "[") {
    event.preventDefault();
    stepVariant(-1);
  }
  if (event.key === "]") {
    event.preventDefault();
    stepVariant(1);
  }
  if (event.key === "i" || event.key === "I") {
    event.preventDefault();
    const i = INTERRUPT_IDS.indexOf(interrupt);
    interrupt = INTERRUPT_IDS[(i + 1) % INTERRUPT_IDS.length] ?? "skip";
    queued = [];
    renderHud();
  }
  if (event.key === "r" || event.key === "R") {
    event.preventDefault();
    resizePolicy = resizePolicy === "skip" ? "hold" : "skip";
    renderHud();
  }
  if (event.key === "m" || event.key === "M") {
    event.preventDefault();
    themeMotion = !themeMotion;
    renderHud();
  }
  if (event.key === "p" || event.key === "P") {
    event.preventDefault();
    honourReduced = !honourReduced;
    renderHud();
  }
});

new ResizeObserver(() => {
  const decision = decideResize({ active: activeVt() !== null, policy: resizePolicy });
  if (decision === "apply") {
    if (deferredResize) {
      deferredResize = false;
      lastEvent = "resize applied (held)";
      renderHud();
    }
    return;
  }
  if (decision === "defer") {
    deferredResize = true;
    lastEvent = "resize deferred";
    renderHud();
    return;
  }
  const vt = activeVt();
  vt?.skipTransition();
  lastEvent = "resize skipped transition";
  renderHud();
}).observe(stage);

readUrl();
paintIdle();
