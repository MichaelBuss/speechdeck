import type { VariantId } from "./scenario.ts";
import * as A from "./shapes/a-snapshot.ts";
import * as B from "./shapes/b-session.ts";
import * as C from "./shapes/c-compiled.ts";

export const VARIANT_IDS = ["A", "B", "C"] as const;
export type { VariantId };

export type Shape = {
  id: VariantId;
  name: string;
  ownsNow: string;
  recommend: boolean;
  packages: readonly string[];
  author: string;
  core: string;
  solid: string;
  vite: string;
  seam: readonly string[];
  cut: readonly string[];
  attack: readonly string[];
};

export const variants: Record<VariantId, Shape> = {
  A: {
    id: "A",
    name: "Snapshot",
    ownsNow: "Nobody in core. Arrival is an argument. The Solid adapter's router is now.",
    recommend: true,
    packages: A.PACKAGES,
    author: A.AUTHOR,
    core: A.CORE,
    solid: A.SOLID,
    vite: A.VITE,
    seam: A.SEAM,
    cut: A.CUT,
    attack: [
      "The core is skinny: parse, resolve, matchCode. CLI and a second adapter still have to invent host, sync, and navigation.",
      "That is the point of an adapter. v0 ships one. A Vue adapter would copy Present's glue, not Session's state.",
      "Authors never import resolveFrame. If we document it as public, someone will call it from a Slide component and fight the router.",
    ],
  },
  B: {
    id: "B",
    name: "Session",
    ownsNow: "Core. createSession. go / next / prev / subscribe.",
    recommend: false,
    packages: B.PACKAGES,
    author: B.AUTHOR,
    core: B.CORE,
    solid: B.SOLID,
    vite: B.VITE,
    seam: B.SEAM,
    cut: B.CUT,
    attack: [
      "Slides are URLs (ADR 0002). View Transitions start from a navigation (ADR 0005). Session.go is a third current.",
      "If the adapter always echoes go() into the router, Session is a write-only facade and resolveFrame was enough.",
      "If it doesn't, mashed arrows call session.next() and the URL / VT / BroadcastChannel lag or disagree.",
      "A headless Session looks like the TanStack QueryClient move. QueryClient owns cache, not the address bar.",
    ],
  },
  C: {
    id: "C",
    name: "Compiled routes",
    ownsNow: "The matched route. Frame.enter is baked at generate time against document order.",
    recommend: false,
    packages: C.PACKAGES,
    author: C.AUTHOR,
    core: C.CORE,
    solid: C.SOLID,
    vite: C.VITE,
    seam: C.SEAM,
    cut: C.CUT,
    attack: [
      "A skip is a real route match. The generated Frame.enter still says connected. Walk the Skip step.",
      "The author app names TanStack Router. v0's only command is init; the scaffolded app should not teach a second framework to give a talk.",
      "Core stops being a library you can call from a test without the plugin. The map wanted a vanilla core for exactly that.",
      "Hiding the router inside Present (A) still uses routes. Generating the tree as the public API is the extra concept.",
    ],
  },
};
