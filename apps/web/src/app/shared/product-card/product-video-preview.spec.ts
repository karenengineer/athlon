import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ProductPreviewVideo } from "../../core/api/catalog.models";
import { ProductVideoPreview } from "./product-video-preview";

const preview: ProductPreviewVideo = {
  url: "/api/v1/media/desktop.mp4",
  mobileUrl: "/api/v1/media/mobile.mp4",
  mimeType: "video/mp4",
  durationSeconds: 4,
  sizeBytes: 10000,
  mobileSizeBytes: 3000,
};
@Component({
  imports: [ProductVideoPreview],
  template: `<article class="product-card">
    <a class="image-well">
      <img src="/cover.webp" alt="Product" />
      <video
        [appProductVideoPreview]="video()"
        poster="/cover.webp"
        muted
        loop
        playsinline
        preload="none"
      ></video>
    </a>
  </article>`,
})
class Host {
  video = signal(preview);
}

describe("product preview playback", () => {
  let touch: EventTarget & { matches: boolean };
  let reduced: EventTarget & { matches: boolean };
  let connection: EventTarget & { saveData: boolean };
  let observers: { callback: IntersectionObserverCallback; target?: Element }[];
  let play: ReturnType<typeof vi.spyOn>;
  let pause: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host] });
    observers = [];
    const query = (matches = false) =>
      Object.assign(new EventTarget(), { matches });
    touch = query();
    reduced = query();
    vi.stubGlobal("matchMedia", (value: string) =>
      value === "(hover: none)" ? touch : reduced,
    );
    connection = Object.assign(new EventTarget(), { saveData: false });
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: connection,
    });
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        entry: { callback: IntersectionObserverCallback; target?: Element };
        constructor(callback: IntersectionObserverCallback) {
          this.entry = { callback };
          observers.push(this.entry);
        }
        observe(target: Element) {
          this.entry.target = target;
        }
        disconnect() {}
      },
    );
    play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (navigator as Navigator & { connection?: EventTarget }).connection;
  });

  async function card() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      fixture,
      video: fixture.nativeElement.querySelector("video") as HTMLVideoElement,
      well: fixture.nativeElement.querySelector("a") as HTMLElement,
    };
  }

  function visibility(index: number, ratio: number) {
    observers[index].callback(
      [
        {
          isIntersecting: ratio > 0,
          intersectionRatio: ratio,
          target: observers[index].target,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
  }

  it("fetches only on hover, then resets and restores the cover on leave", async () => {
    const { well, video } = await card();
    expect(video.hasAttribute("src")).toBe(false);
    expect(play).not.toHaveBeenCalled();
    well.dispatchEvent(new Event("pointerenter"));
    await Promise.resolve();
    expect(video.getAttribute("src")).toBe(preview.url);
    expect(video.classList.contains("preview-playing")).toBe(true);
    expect(video.muted).toBe(true);
    video.currentTime = 2;
    well.dispatchEvent(new Event("pointerleave"));
    expect(video.currentTime).toBe(0);
    expect(video.classList.contains("preview-playing")).toBe(false);
    expect(pause).toHaveBeenCalled();
  });

  it("observes the whole card and waits for 60 percent visibility to settle on touch", async () => {
    touch.matches = true;
    const { video, well } = await card();
    expect(observers[0].target?.matches("article.product-card")).toBe(true);
    vi.useFakeTimers();
    well.dispatchEvent(new Event("pointerenter"));
    visibility(0, 0.59);
    await vi.advanceTimersByTimeAsync(400);
    expect(play).not.toHaveBeenCalled();
    visibility(0, 0.6);
    await vi.advanceTimersByTimeAsync(299);
    expect(play).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(video.getAttribute("src")).toBe(preview.mobileUrl);
    expect(play).toHaveBeenCalledTimes(1);
    visibility(0, 0.5);
    expect(video.classList.contains("preview-playing")).toBe(false);
    expect(video.currentTime).toBe(0);
  });

  it("uses the latest visibility when enter and leave arrive in one observer batch", async () => {
    touch.matches = true;
    const { video } = await card();
    vi.useFakeTimers();
    observers[0].callback(
      [
        {
          isIntersecting: true,
          intersectionRatio: 0.8,
          time: 10,
          target: observers[0].target,
        },
        {
          isIntersecting: false,
          intersectionRatio: 0,
          time: 20,
          target: observers[0].target,
        },
      ] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    await vi.advanceTimersByTimeAsync(300);
    expect(video.hasAttribute("src")).toBe(false);
    expect(play).not.toHaveBeenCalled();
  });

  it("plays only one visible touch card and hands playback to the next eligible card", async () => {
    touch.matches = true;
    const first = await card();
    const second = await card();
    vi.useFakeTimers();
    visibility(0, 0.8);
    visibility(1, 0.9);
    await vi.advanceTimersByTimeAsync(300);
    expect(first.video.classList.contains("preview-playing")).toBe(true);
    expect(second.video.hasAttribute("src")).toBe(false);
    visibility(0, 0);
    await Promise.resolve();
    expect(first.video.classList.contains("preview-playing")).toBe(false);
    expect(second.video.classList.contains("preview-playing")).toBe(true);
  });

  it("keeps the cover when playback is rejected and ignores a late play completion", async () => {
    const { well, video } = await card();
    let resolvePlay!: () => void;
    play.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolvePlay = resolve;
      }),
    );
    well.dispatchEvent(new Event("pointerenter"));
    well.dispatchEvent(new Event("pointerleave"));
    resolvePlay();
    await Promise.resolve();
    expect(video.classList.contains("preview-playing")).toBe(false);
    play.mockRejectedValueOnce(new Error("Autoplay blocked"));
    well.dispatchEvent(new Event("pointerenter"));
    await Promise.resolve();
    await Promise.resolve();
    expect(video.classList.contains("preview-playing")).toBe(false);
  });

  it("does not load video under reduced motion or Data Saver and reacts to changes", async () => {
    reduced.matches = true;
    const { well, video } = await card();
    well.dispatchEvent(new Event("pointerenter"));
    expect(video.hasAttribute("src")).toBe(false);
    reduced.matches = false;
    reduced.dispatchEvent(new Event("change"));
    await Promise.resolve();
    expect(video.hasAttribute("src")).toBe(true);
    connection.saveData = true;
    connection.dispatchEvent(new Event("change"));
    expect(video.hasAttribute("src")).toBe(false);
    expect(video.classList.contains("preview-playing")).toBe(false);
  });

  it("removes the old source and resets when a card is reused for another product", async () => {
    const { fixture, well, video } = await card();
    well.dispatchEvent(new Event("pointerenter"));
    await Promise.resolve();
    fixture.componentInstance.video.set({ ...preview, url: "/new.mp4" });
    fixture.detectChanges();
    await Promise.resolve();
    expect(video.getAttribute("src")).toBe("/new.mp4");
    fixture.destroy();
    expect(video.hasAttribute("src")).toBe(false);
  });
});
