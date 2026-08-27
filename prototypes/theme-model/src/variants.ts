import type { LayoutName } from "./pick-layout.ts";
import type { CutKind } from "./travel.ts";
import { mixStops, runT, travelT } from "./travel.ts";
import harbour from "./themes/harbour.json";

export const VARIANT_IDS = ["A", "B", "C"] as const;
export type VariantId = (typeof VARIANT_IDS)[number];

export type Appearance = "light" | "dark";

export type ThemeManifest = {
  name: string;
  fontTitle: string;
  fontBody: string;
  fontMono: string;
  accents: Record<string, string>;
  dark: Palette;
  light: Palette;
  layouts: Partial<Record<LayoutName, Appearance>>;
};

type Palette = {
  fg: string;
  title: string;
  muted: string;
  chrome: string;
  gradient: string[];
};

export const manifest = harbour as ThemeManifest;

export const variants: Record<
  VariantId,
  {
    name: string;
    disk: string;
    onDisk: string;
    travel: "deck" | "run" | "css";
    layoutForcesAppearance: boolean;
  }
> = {
  A: {
    name: "Manifest tokens",
    disk: "theme.json + theme.css",
    onDisk: "JSON owns colours, fonts, stops. CSS reads only --sd-* handles. No layout selectors.",
    travel: "deck",
    layoutForcesAppearance: false,
  },
  B: {
    name: "CSS is the theme",
    disk: "theme.css",
    onDisk:
      "No JSON. Framework sets --sd-t and data-*. CSS keyframes interpolate --sd-bg. Designer selects data-layout.",
    travel: "css",
    layoutForcesAppearance: false,
  },
  C: {
    name: "Layout resolver handles",
    disk: "theme.json + theme.css",
    onDisk:
      "JSON layouts map forces Cover/Section dark, Caption light. Travel t resets at each hard cut.",
    travel: "run",
    layoutForcesAppearance: true,
  },
};

export type ResolvedPaint = {
  t: number;
  skipped: boolean;
  appearance: Appearance;
  appearanceSource: "deck" | "layout" | "slide";
  bg: string;
  fg: string;
  title: string;
  muted: string;
  chrome: string;
};

export function resolvePaint(input: {
  variant: VariantId;
  index: number;
  cuts: readonly CutKind[];
  participate: readonly boolean[];
  layout: LayoutName;
  deckAppearance: Appearance;
  slideOverride?: Appearance;
}): ResolvedPaint {
  const spec = variants[input.variant];
  let appearance = input.deckAppearance;
  let appearanceSource: ResolvedPaint["appearanceSource"] = "deck";

  if (spec.layoutForcesAppearance) {
    const forced = manifest.layouts[input.layout];
    if (forced !== undefined) {
      appearance = forced;
      appearanceSource = "layout";
    }
  }

  if (input.slideOverride !== undefined) {
    appearance = input.slideOverride;
    appearanceSource = "slide";
  }

  const travelled = travelT(input.index, input.participate);
  const t = spec.travel === "run" ? runT(input.index, input.cuts) : travelled.t;
  const skipped = spec.travel === "run" ? false : travelled.skipped;
  const bg = spec.travel === "css" ? "css @property" : mixStops(palette.gradient, t);

  return {
    t,
    skipped,
    appearance,
    appearanceSource,
    bg,
    fg: palette.fg,
    title: palette.title,
    muted: palette.muted,
    chrome: palette.chrome,
  };
}

export function tokenStyle(paint: ResolvedPaint, variant: VariantId): string {
  const a = manifest.accents;
  const parts = [
    `--sd-t: ${paint.t}`,
    `--sd-font-title: ${manifest.fontTitle}`,
    `--sd-font-body: ${manifest.fontBody}`,
    `--sd-font-mono: ${manifest.fontMono}`,
    `--sd-accent-1: ${a["1"] ?? ""}`,
    `--sd-accent-2: ${a["2"] ?? ""}`,
    `--sd-accent-3: ${a["3"] ?? ""}`,
    `--sd-accent-4: ${a["4"] ?? ""}`,
  ];
  if (variants[variant].travel !== "css") {
    parts.push(
      `--sd-bg: ${paint.bg}`,
      `--sd-fg: ${paint.fg}`,
      `--sd-title: ${paint.title}`,
      `--sd-muted: ${paint.muted}`,
      `--sd-chrome: ${paint.chrome}`,
    );
  }
  return parts.join("; ");
}
