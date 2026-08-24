/**
 * PROTOTYPE — the internal layout resolver.
 * Pure. Not exported from any package. The only function renderers ask.
 */

export type LayoutName =
  | "cover"
  | "section"
  | "solo"
  | "split-2"
  | "split-3"
  | "grid"
  | "caption";

export type Cell = {
  firstHeading?: 1 | 2 | 3 | 4 | 5 | 6;
  hasImage?: boolean;
  hasCode?: boolean;
  hasEmbed?: boolean;
};

export type SlideModel = {
  cells: readonly Cell[];
  override?: LayoutName;
};

export type PickResult = {
  layout: LayoutName;
  auto: LayoutName;
  overridden: boolean;
  impossible: boolean;
};

export function pickLayout(slide: SlideModel): PickResult {
  const auto = autoLayout(slide.cells);
  const override = slide.override;
  if (override === undefined) {
    return { layout: auto, auto, overridden: false, impossible: false };
  }
  if (!isPossible(override, slide.cells)) {
    return { layout: auto, auto, overridden: true, impossible: true };
  }
  return { layout: override, auto, overridden: true, impossible: false };
}

export function autoLayout(cells: readonly Cell[]): LayoutName {
  const n = cells.length;
  if (n === 1) {
    const cell = cells[0];
    if (cell?.firstHeading === 1) return "cover";
    if (cell?.firstHeading !== undefined && cell.firstHeading >= 2 && isHeadingOnly(cell)) {
      return "section";
    }
    return "solo";
  }
  if (n === 2) return isCaption(cells) ? "caption" : "split-2";
  if (n === 3) return "split-3";
  if (n >= 4) return "grid";
  return "solo";
}

function isHeadingOnly(cell: Cell): boolean {
  return !cell.hasImage && !cell.hasCode && !cell.hasEmbed;
}

function isCaption(cells: readonly Cell[]): boolean {
  if (cells.length !== 2) return false;
  const a = cells[0];
  const b = cells[1];
  if (a === undefined || b === undefined) return false;
  return isH4Cell(a) && isImageCell(b) || isImageCell(a) && isH4Cell(b);
}

function isH4Cell(cell: Cell): boolean {
  return cell.firstHeading === 4 && !cell.hasImage;
}

function isImageCell(cell: Cell): boolean {
  return cell.hasImage === true;
}

function isPossible(layout: LayoutName, cells: readonly Cell[]): boolean {
  const n = cells.length;
  switch (layout) {
    case "cover":
    case "section":
    case "solo":
      return n === 1;
    case "split-2":
      return n === 2;
    case "split-3":
      return n === 3;
    case "grid":
      return n >= 4;
    case "caption":
      return isCaption(cells);
  }
}

export function captionOrder(cells: readonly Cell[]): "title-first" | "image-first" | undefined {
  if (!isCaption(cells)) return undefined;
  return cells[0]?.hasImage === true ? "image-first" : "title-first";
}
