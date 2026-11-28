import { DOCUMENT, isPlatformBrowser } from "@angular/common";
import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Injectable,
  PLATFORM_ID,
} from "@angular/core";

/** Gap between cards that come into view together. */
export const REVEAL_STAGGER_MS = 70;
/** Never make a card wait longer than this for its turn. */
export const REVEAL_MAX_DELAY_MS = 420;

/**
 * Shares one IntersectionObserver between all cards and staggers the cards
 * that enter the viewport together, in reading order.
 */
@Injectable({ providedIn: "root" })
export class RevealCoordinator {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private observer: IntersectionObserver | null = null;
  /**
   * Cards created during the first (server-rendered) paint that are already
   * on screen are left alone, so nothing visible blinks out and back in.
   */
  private firstPaintDone = false;

  constructor() {
    if (!this.browser) return;
    afterNextRender(() => {
      this.document.defaultView?.setTimeout(() => (this.firstPaintDone = true));
    });
  }

  /** Whether animations can run here at all. */
  get enabled(): boolean {
    const view = this.document.defaultView;
    return (
      this.browser &&
      !!view &&
      "IntersectionObserver" in view &&
      view.matchMedia?.("(prefers-reduced-motion: reduce)").matches !== true
    );
  }

  track(element: HTMLElement): () => void {
    const view = this.document.defaultView!;
    if (!this.firstPaintDone && this.onScreen(element, view)) return () => {};
    element.classList.add("reveal-pending");
    this.observer ??= new view.IntersectionObserver(
      (entries) => this.reveal(entries),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    this.observer.observe(element);
    return () => this.observer?.unobserve(element);
  }

  private reveal(entries: IntersectionObserverEntry[]): void {
    const arriving = entries
      .filter((entry) => entry.isIntersecting)
      .map((entry) => entry.target as HTMLElement)
      .sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return Math.round(ra.top - rb.top) || ra.left - rb.left;
      });
    arriving.forEach((element, index) => {
      this.observer?.unobserve(element);
      const delay = Math.min(index * REVEAL_STAGGER_MS, REVEAL_MAX_DELAY_MS);
      element.style.transitionDelay = `${delay}ms`;
      element.classList.add("reveal-in");
      element.classList.remove("reveal-pending");
      const done = () => {
        // Hand the card back to its own hover/press styles.
        element.classList.remove("reveal-in");
        element.style.removeProperty("transition-delay");
      };
      element.addEventListener("transitionend", done, { once: true });
      // Fallback if the transition never fires (background tab, etc.).
      this.document.defaultView?.setTimeout(done, delay + 900);
    });
  }

  private onScreen(element: HTMLElement, view: Window): boolean {
    const rect = element.getBoundingClientRect();
    return rect.top < view.innerHeight && rect.bottom > 0;
  }
}

/**
 * Product cards fade in and slide up as their row scrolls into view, one after
 * another. Server-rendered HTML is always fully visible (search engines, slow
 * JavaScript), and "Reduce Motion" turns the effect off.
 */
@Directive({ selector: "[appRevealOnScroll]" })
export class RevealOnScroll {
  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const coordinator = inject(RevealCoordinator);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (!coordinator.enabled) return;
      const stop = coordinator.track(element);
      destroyRef.onDestroy(stop);
    });
  }
}
