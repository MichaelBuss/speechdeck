/**
 * PROTOTYPE — portable sync for Presenter view.
 * Same-origin windows share the current Slide id and the audience viewport.
 * Either side may navigate; the other follows. The sender never hears itself.
 */
const CHANNEL = "speechdeck-presenter-view";

export type Viewport = { width: number; height: number };

export type SlideSync = {
  postSlide(id: string): void;
  postViewport(viewport: Viewport): void;
  close(): void;
};

export function openSlideSync(handlers: {
  onSlide: (id: string) => void;
  onViewport: (viewport: Viewport) => void;
}): SlideSync {
  const channel = new BroadcastChannel(CHANNEL);
  channel.addEventListener("message", (event: MessageEvent<unknown>) => {
    const slide = readSlide(event.data);
    if (slide !== undefined) handlers.onSlide(slide);
    const viewport = readViewport(event.data);
    if (viewport !== undefined) handlers.onViewport(viewport);
  });
  return {
    postSlide(id: string) {
      channel.postMessage({ type: "slide", slide: id });
    },
    postViewport(viewport: Viewport) {
      channel.postMessage({ type: "viewport", ...viewport });
    },
    close() {
      channel.close();
    },
  };
}

function readSlide(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  if (!("slide" in data)) return undefined;
  const slide = data.slide;
  return typeof slide === "string" ? slide : undefined;
}

function readViewport(data: unknown): Viewport | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  if (!("type" in data) || data.type !== "viewport") return undefined;
  if (!("width" in data) || !("height" in data)) return undefined;
  const width = data.width;
  const height = data.height;
  if (typeof width !== "number" || typeof height !== "number") return undefined;
  if (!(width > 0) || !(height > 0)) return undefined;
  return { width, height };
}
