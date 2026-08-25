export type DemoSlide = {
  id: string;
  kicker: string;
  title: string;
  kind: "cover" | "section" | "code" | "split" | "end";
  speech: readonly string[];
  comment?: string;
};

export const slides: DemoSlide[] = [
  {
    id: "cover",
    kicker: "JS Copenhagen",
    title: "APIs without implementation anxiety",
    kind: "cover",
    speech: [
      "Good evening. This talk is about the kind of API you can hold in your head — and the kind you can't.",
      "The slides will stay sparse. What you're reading now is Speech. The audience never sees it.",
    ],
  },
  {
    id: "resolver",
    kicker: "The bet",
    title: "The resolver is the API",
    kind: "section",
    speech: [
      "A resolver gives people contained handles. Colour, type, motion — not the engine.",
      "If I do this well tonight, you should want to steal the pattern, not the framework.",
    ],
  },
  {
    id: "seam",
    kicker: "Embed",
    title: "One function, zero adapters",
    kind: "code",
    comment: "check the demo wifi",
    speech: [
      "The seam is one function: mount an element, pass serializable props, get dispose and ready.",
      "No React adapter in v0. No Vue. The guest owns everything inside the host.",
      "That's why this Speech is long — so you can feel overflow. Scroll it. Advance replaces it. It does not auto-scroll, and it is not mirrored.",
      "A Comment lives in the source of this Slide. It is not here. It is not on the Slide. It is for you in the editor, before you walk on stage.",
      "If you can still read this paragraph, the teleprompter scrolled instead of shrinking the type to fit. That is the point on a phone as well as on a laptop.",
    ],
  },
  {
    id: "live",
    kicker: "The demo",
    title: "Same bytes on both sides",
    kind: "split",
    speech: [
      "The code on the Slide is the file the Embed runs. They cannot drift.",
      "Glance up-next. That's the closer. Don't read it yet.",
    ],
  },
  {
    id: "close",
    kicker: "JS Copenhagen",
    title: "Go write the boring version",
    kind: "end",
    speech: [
      "That's the talk. Questions — or come find me after.",
    ],
  },
];
