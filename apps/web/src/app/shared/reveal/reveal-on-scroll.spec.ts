import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  REVEAL_MAX_DELAY_MS,
  REVEAL_STAGGER_MS,
  RevealCoordinator,
  RevealOnScroll,
} from "./reveal-on-scroll";

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

class FakeObserver {
  static last: FakeObserver | null = null;
  readonly observed = new Set<Element>();
  constructor(readonly callback: Callback) {
    FakeObserver.last = this;
  }
  observe(element: Element) {
    this.observed.add(element);
  }
  unobserve(element: Element) {
    this.observed.delete(element);
  }
  disconnect() {
    this.observed.clear();
  }
  /** Simulate these elements scrolling into view together. */
  enter(elements: Element[]) {
    this.callback(elements.map((target) => ({ target, isIntersecting: true })));
  }
}

@Component({
  imports: [RevealOnScroll],
  template: `
    @for (card of cards(); track card) {
      <div appRevealOnScroll class="card" [attr.data-card]="card"></div>
    }
  `,
})
class Host {
  readonly cards = signal([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
}

describe("RevealOnScroll", () => {
  let onScreen: (element: Element) => boolean;

  beforeEach(() => {
    FakeObserver.last = null;
    onScreen = () => false;
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: false }) as MediaQueryList,
    });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const index = Number(this.getAttribute("data-card") ?? 0);
        const top = onScreen(this) ? 10 : 2000 + Math.floor(index / 2) * 300;
        const left = (index % 2) * 200;
        return {
          top,
          bottom: top + 280,
          left,
          right: left + 180,
          width: 180,
          height: 280,
        } as DOMRect;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  const cards = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLElement>(".card"));

  it("leaves cards already on screen at first paint untouched", async () => {
    onScreen = (element) => Number(element.getAttribute("data-card")) < 4;
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const [first, , , fourth, fifth] = cards(fixture.nativeElement);
    expect(first.classList.contains("reveal-pending")).toBe(false);
    expect(fourth.classList.contains("reveal-pending")).toBe(false);
    expect(fifth.classList.contains("reveal-pending")).toBe(true);
    expect(FakeObserver.last?.observed.has(first)).toBe(false);
  });

  it("reveals cards in reading order with a capped stagger", async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const all = cards(fixture.nativeElement);
    expect(all.every((card) => card.classList.contains("reveal-pending"))).toBe(
      true,
    );

    // Arrive out of DOM order: the coordinator sorts by position.
    FakeObserver.last!.enter([...all].reverse());
    all.forEach((card, index) => {
      expect(card.classList.contains("reveal-pending")).toBe(false);
      expect(card.classList.contains("reveal-in")).toBe(true);
      expect(card.style.transitionDelay).toBe(
        `${Math.min(index * REVEAL_STAGGER_MS, REVEAL_MAX_DELAY_MS)}ms`,
      );
    });
    expect(FakeObserver.last!.observed.size).toBe(0);

    // Afterwards the card's own styles take over again.
    all[0].dispatchEvent(new Event("transitionend"));
    expect(all[0].classList.contains("reveal-in")).toBe(false);
    expect(all[0].style.transitionDelay).toBe("");
  });

  it("animates new cards after the first paint even when on screen", async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    onScreen = () => true;
    fixture.componentInstance.cards.set([10, 11]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      cards(fixture.nativeElement).every((card) =>
        card.classList.contains("reveal-pending"),
      ),
    ).toBe(true);
  });

  it("does nothing when the visitor prefers reduced motion", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }) as MediaQueryList,
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(TestBed.inject(RevealCoordinator).enabled).toBe(false);
    expect(
      cards(fixture.nativeElement).some((card) =>
        card.classList.contains("reveal-pending"),
      ),
    ).toBe(false);
  });

  it("stops watching cards that are removed", async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(FakeObserver.last!.observed.size).toBe(10);
    fixture.componentInstance.cards.set([]);
    fixture.detectChanges();
    expect(FakeObserver.last!.observed.size).toBe(0);
  });
});
