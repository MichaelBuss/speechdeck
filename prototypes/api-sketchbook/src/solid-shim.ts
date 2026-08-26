/**
 * PROTOTYPE stand-in for `solid-js`.
 * The real adapter does `import * as Solid from "solid-js"` and never a `.tsx`.
 */

export type Element = unknown;
export type Accessor<T> = () => T;
export type ParentProps<P = Record<string, never>> = P & { children?: Element };

export function createComponent<P>(
  Comp: (props: P) => Element,
  props: P,
): Element {
  return Comp(props);
}
