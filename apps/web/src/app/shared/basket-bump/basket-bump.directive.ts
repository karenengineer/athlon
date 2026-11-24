import {
  Directive,
  ElementRef,
  PLATFORM_ID,
  effect,
  inject,
  input,
} from "@angular/core";
import { isPlatformBrowser } from "@angular/common";

/** Squash-and-stretch "jelly" when an item is added to the basket. */
export const JELLY_KEYFRAMES: Keyframe[] = [
  { transform: "scale(1, 1)" },
  { transform: "scale(1.25, 0.78)" },
  { transform: "scale(0.85, 1.18)" },
  { transform: "scale(1.08, 0.94)" },
  { transform: "scale(0.97, 1.03)" },
  { transform: "scale(1, 1)" },
];

const BADGE_KEYFRAMES: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.45)" },
  { transform: "scale(1)" },
];

/**
 * Plays the jelly animation on the host whenever `appBasketBump` (the basket
 * item count) goes up. It never plays on first render, on removals, on the
 * server, or for shoppers who ask the system to reduce motion.
 */
@Directive({ selector: "[appBasketBump]" })
export class BasketBumpDirective {
  readonly appBasketBump = input.required<number>();
  /** Optional selector of the count badge inside the host to pop as well. */
  readonly basketBumpBadge = input<string>("");

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private previous: number | undefined;

  constructor() {
    effect(() => {
      const count = this.appBasketBump();
      const previous = this.previous;
      this.previous = count;
      if (previous === undefined || count <= previous) return;
      this.play();
    });
  }

  private play(): void {
    const element = this.host.nativeElement;
    if (!this.browser || typeof element.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    element.getAnimations?.().forEach((animation) => animation.cancel());
    element.animate(JELLY_KEYFRAMES, { duration: 650, easing: "ease-out" });
    const badgeSelector = this.basketBumpBadge();
    const badge = badgeSelector
      ? element.querySelector<HTMLElement>(badgeSelector)
      : null;
    badge?.animate(BADGE_KEYFRAMES, {
      duration: 420,
      delay: 200,
      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    });
  }
}
