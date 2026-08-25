/**
 * PROTOTYPE — portable sync for Presenter view.
 * Same-origin windows share the current Slide id over BroadcastChannel.
 * Either side may navigate; the other follows. The sender never hears itself.
 */
const CHANNEL = "speechdeck-presenter-view";

export type SlideSync = {
  post(id: string): void;
  close(): void;
};

export function openSlideSync(onSlide: (id: string) => void): SlideSync {
  const channel = new BroadcastChannel(CHANNEL);
  channel.addEventListener("message", (event: MessageEvent<unknown>) => {
    const id = readId(event.data);
    if (id !== undefined) onSlide(id);
  });
  return {
    post(id: string) {
      channel.postMessage({ slide: id });
    },
    close() {
      channel.close();
    },
  };
}

function readId(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  if (!("slide" in data)) return undefined;
  const slide = data.slide;
  return typeof slide === "string" ? slide : undefined;
}
