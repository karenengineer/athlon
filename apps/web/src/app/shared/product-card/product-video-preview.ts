import { DOCUMENT } from "@angular/common";
import {
  afterNextRender,
  Directive,
  ElementRef,
  inject,
  Injectable,
  Input,
  OnChanges,
  OnDestroy,
} from "@angular/core";
import { ProductPreviewVideo } from "../../core/api/catalog.models";

interface PreviewCandidate {
  play(): void;
  stop(): void;
}

@Injectable({ providedIn: "root" })
export class ProductVideoPlayback {
  private readonly eligible = new Set<PreviewCandidate>();
  private active?: PreviewCandidate;

  request(candidate: PreviewCandidate): void {
    this.eligible.add(candidate);
    this.select();
  }

  release(candidate: PreviewCandidate): void {
    this.eligible.delete(candidate);
    if (this.active === candidate) {
      this.active = undefined;
      candidate.stop();
    }
    this.select();
  }

  private select(): void {
    if (this.active) return;
    this.active = this.eligible.values().next().value;
    this.active?.play();
  }
}

type SaveDataConnection = EventTarget & { saveData?: boolean };

@Directive({ selector: "video[appProductVideoPreview]" })
export class ProductVideoPreview
  implements OnChanges, OnDestroy, PreviewCandidate
{
  @Input() appProductVideoPreview: ProductPreviewVideo | null | undefined;
  private readonly element = inject(ElementRef<HTMLVideoElement>).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly playback = inject(ProductVideoPlayback);
  private observer?: IntersectionObserver;
  private timer?: ReturnType<typeof setTimeout>;
  private cleanups: (() => void)[] = [];
  private initialized = false;
  private destroyed = false;
  private failed = false;
  private hovering = false;
  private visible = false;
  private generation = 0;
  private mobile?: MediaQueryList;
  private reduced?: MediaQueryList;
  private connection?: SaveDataConnection;

  constructor() {
    afterNextRender(() => this.initialize());
  }

  ngOnChanges(): void {
    this.failed = false;
    this.playback.release(this);
    this.clearSource();
    if (this.initialized) this.updateEligibility();
  }

  private initialize(): void {
    if (this.destroyed) return;
    const view = this.document.defaultView;
    const imageWell = this.element.parentElement;
    if (!view?.matchMedia || !imageWell) return;
    this.initialized = true;
    this.mobile = view.matchMedia("(hover: none)");
    this.reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
    this.connection = (
      view.navigator as Navigator & {
        connection?: SaveDataConnection;
      }
    ).connection;
    const listen = (
      target: EventTarget,
      event: string,
      callback: EventListener,
    ) => {
      target.addEventListener(event, callback);
      this.cleanups.push(() => target.removeEventListener(event, callback));
    };
    listen(imageWell, "pointerenter", (event) => {
      if ((event as PointerEvent).pointerType === "touch") return;
      this.hovering = true;
      this.updateEligibility();
    });
    listen(imageWell, "pointerleave", () => {
      this.hovering = false;
      this.updateEligibility();
    });
    const preferencesChanged = () => {
      this.playback.release(this);
      this.clearSource();
      this.updateEligibility();
    };
    listen(this.mobile, "change", preferencesChanged);
    listen(this.reduced, "change", preferencesChanged);
    if (this.connection) listen(this.connection, "change", preferencesChanged);
    listen(this.document, "visibilitychange", () => this.updateEligibility());
    listen(this.element, "error", () => {
      this.failed = true;
      this.playback.release(this);
      this.clearSource();
    });
    if (view.IntersectionObserver) {
      this.observer = new view.IntersectionObserver(
        (entries) => {
          const entry = entries.at(-1);
          this.visible =
            !!entry?.isIntersecting && entry.intersectionRatio >= 0.6;
          this.updateEligibility();
        },
        { threshold: [0, 0.6] },
      );
      this.observer.observe(
        imageWell.closest("article.product-card") ?? imageWell,
      );
    }
    this.updateEligibility();
  }

  private allowed(): boolean {
    return (
      !!this.appProductVideoPreview &&
      !this.failed &&
      !this.destroyed &&
      !this.document.hidden &&
      !this.reduced?.matches &&
      !this.connection?.saveData
    );
  }

  private updateEligibility(): void {
    clearTimeout(this.timer);
    if (
      !this.allowed() ||
      !(this.mobile?.matches ? this.visible : this.hovering)
    ) {
      this.playback.release(this);
      return;
    }
    if (this.mobile?.matches) {
      this.timer = setTimeout(() => {
        if (this.allowed() && this.visible) this.playback.request(this);
      }, 300);
    } else {
      this.playback.request(this);
    }
  }

  play(): void {
    const video = this.appProductVideoPreview;
    if (!video || !this.allowed()) return;
    const source = this.mobile?.matches ? video.mobileUrl : video.url;
    const generation = ++this.generation;
    this.element.muted = true;
    if (this.element.getAttribute("src") !== source) {
      this.element.src = source;
      this.element.load();
    }
    void this.element
      .play()
      .then(() => {
        if (generation !== this.generation || !this.allowed()) return;
        this.element.classList.add("preview-playing");
      })
      .catch(() => {
        if (generation !== this.generation) return;
        this.failed = true;
        this.playback.release(this);
      });
  }

  stop(): void {
    this.generation++;
    this.element.classList.remove("preview-playing");
    this.element.pause();
    try {
      this.element.currentTime = 0;
    } catch {
      // A source without metadata can remain at its initial position.
    }
  }

  private clearSource(): void {
    if (!this.element.hasAttribute("src")) return;
    this.element.removeAttribute("src");
    this.element.load();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    clearTimeout(this.timer);
    this.observer?.disconnect();
    this.playback.release(this);
    this.clearSource();
    for (const cleanup of this.cleanups) cleanup();
  }
}
