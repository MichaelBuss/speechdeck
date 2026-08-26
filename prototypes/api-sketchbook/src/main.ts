import "./style.css";
import {
  inspect,
  STEP_IDS,
  STEPS,
  type StepId,
  type VariantId,
} from "./scenario.ts";
import { VARIANT_IDS, variants } from "./variants.ts";

const root = document.querySelector("#app");
if (!(root instanceof HTMLElement)) throw new Error("#app missing");
const app: HTMLElement = root;

let variant: VariantId = "A";
let step: StepId = "cover";

app.innerHTML = `
  <div class="hud" id="hud"></div>
  <div class="contract" id="contract"></div>
  <div class="stage-wrap">
    <div class="stage" id="stage"></div>
  </div>
  <div class="steps" id="steps"></div>
  <div class="switcher" id="switcher"></div>
`;

const hud = must("#hud");
const contract = must("#contract");
const stage = must("#stage");
const stepsEl = must("#steps");
const switcher = must("#switcher");

function must(sel: string): HTMLElement {
  const el = app.querySelector(sel);
  if (!(el instanceof HTMLElement)) throw new Error(sel);
  return el;
}

function currentSearch(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function isVariant(v: string | null | undefined): v is VariantId {
  return v === "A" || v === "B" || v === "C";
}

function isStep(v: string | null | undefined): v is StepId {
  return STEP_IDS.some((id) => id === v);
}

function readUrl(): void {
  const q = currentSearch();
  const v = q.get("variant");
  if (isVariant(v)) variant = v;
  const s = q.get("step");
  if (isStep(s)) step = s;
}

function writeUrl(): void {
  const q = currentSearch();
  q.set("variant", variant);
  q.set("step", step);
  window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
}

function pre(code: string): string {
  return `<pre>${escape(code)}</pre>`;
}

function escape(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function list(items: readonly string[], className: string): string {
  return `<ul class="${className}">${items.map((x) => `<li>${escape(x)}</li>`).join("")}</ul>`;
}

function render(): void {
  writeUrl();
  document.documentElement.dataset["variant"] = variant;
  const shape = variants[variant];
  const dump = inspect(variant, step);
  const current = STEPS[step];

  hud.innerHTML = `
    <span><strong>${escape(shape.name)}</strong> owns now: ${escape(shape.ownsNow)}</span>
    <span>${shape.recommend ? "<strong>recommend</strong>" : "challenger"}</span>
    <span>${shape.packages.map(escape).join(" · ")}</span>
  `;

  contract.innerHTML = `
    <kbd>←</kbd><kbd>→</kbd> walk the talk
    <kbd>[</kbd><kbd>]</kbd> shape
    <span>green HUD is prototype chrome, not an API</span>
  `;

  const warn = dump.warning
    ? `<p class="warn">${escape(dump.warning)}</p>`
    : "";

  stage.innerHTML = `
    <section class="panel">
      <h2>Author app</h2>
      ${pre(shape.author)}
      <h2>Vite</h2>
      ${pre(shape.vite)}
    </section>
    <section class="panel">
      <h2>Core</h2>
      ${pre(shape.core)}
      <h2>Solid adapter <span class="note">.ts only</span></h2>
      ${pre(shape.solid)}
    </section>
    <section class="panel dump">
      <h2>${escape(current.title)}</h2>
      <p class="what">${escape(current.what)}</p>
      ${warn}
      <dl>
        <dt>author</dt><dd>${escape(dump.author)}</dd>
        <dt>cursor</dt><dd>${escape(dump.cursor)}</dd>
        <dt>enter</dt><dd>${escape(dump.enter)}</dd>
        <dt>layout</dt><dd>${escape(dump.layout)}</dd>
        <dt>travel</dt><dd>${escape(dump.t)}</dd>
        <dt>motion</dt><dd>${escape(dump.motion)}</dd>
        <dt>embed</dt><dd>${escape(dump.embed)}</dd>
        <dt>presenter</dt><dd>${escape(dump.presenter)}</dd>
      </dl>
      <h2>Attack</h2>
      ${list(shape.attack, "attack")}
      <h2>Second adapter</h2>
      ${list(shape.seam, "seam")}
      <h2>Cut</h2>
      ${list(shape.cut, "cut")}
    </section>
  `;

  stepsEl.innerHTML = STEP_IDS.map((id) => {
    const s = STEPS[id];
    return `<button type="button" data-step="${id}" aria-pressed="${id === step}">${escape(s.title)}</button>`;
  }).join("");

  switcher.innerHTML = VARIANT_IDS.map((id) => {
    const v = variants[id];
    const rec = v.recommend ? " · rec" : "";
    return `<button type="button" data-variant="${id}" aria-pressed="${id === variant}">${id} ${escape(v.name)}${rec}</button>`;
  }).join("");
}

stepsEl.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const id = t.dataset["step"];
  if (isStep(id)) {
    step = id;
    render();
  }
});

switcher.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const id = t.dataset["variant"];
  if (isVariant(id)) {
    variant = id;
    render();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") {
    const i = STEP_IDS.indexOf(step);
    const next = STEP_IDS[i + 1];
    if (next !== undefined) {
      step = next;
      render();
    }
  }
  if (e.key === "ArrowLeft") {
    const i = STEP_IDS.indexOf(step);
    const prev = STEP_IDS[i - 1];
    if (prev !== undefined) {
      step = prev;
      render();
    }
  }
  if (e.key === "]") {
    const i = VARIANT_IDS.indexOf(variant);
    variant = VARIANT_IDS[(i + 1) % VARIANT_IDS.length] ?? "A";
    render();
  }
  if (e.key === "[") {
    const i = VARIANT_IDS.indexOf(variant);
    variant = VARIANT_IDS[(i + VARIANT_IDS.length - 1) % VARIANT_IDS.length] ?? "A";
    render();
  }
});

readUrl();
render();
