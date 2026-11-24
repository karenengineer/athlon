import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BasketBumpDirective, JELLY_KEYFRAMES } from "./basket-bump.directive";

@Component({
  imports: [BasketBumpDirective],
  template: `<a [appBasketBump]="count()" basketBumpBadge=".badge"
    ><span class="badge">{{ count() }}</span></a
  >`,
})
class Host {
  readonly count = signal(0);
}

describe("BasketBumpDirective", () => {
  let reduceMotion = false;

  function setup() {
    const animate = vi.fn<
      (keyframes: Keyframe[], options?: unknown) => unknown
    >(() => ({ cancel: vi.fn() }));
    (HTMLElement.prototype as unknown as { animate: unknown }).animate =
      animate;
    (
      HTMLElement.prototype as unknown as { getAnimations: unknown }
    ).getAnimations = () => [];
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: reduceMotion,
    })) as unknown as typeof window.matchMedia;
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return { fixture, animate };
  }

  afterEach(() => {
    reduceMotion = false;
    TestBed.resetTestingModule();
  });

  it("plays the jelly and badge pop only when the count goes up", () => {
    const { fixture, animate } = setup();
    expect(animate).not.toHaveBeenCalled();

    fixture.componentInstance.count.set(1);
    fixture.detectChanges();
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[0][0]).toBe(JELLY_KEYFRAMES);

    animate.mockClear();
    fixture.componentInstance.count.set(0);
    fixture.detectChanges();
    expect(animate).not.toHaveBeenCalled();
  });

  it("stays still for shoppers who prefer reduced motion", () => {
    reduceMotion = true;
    const { fixture, animate } = setup();
    fixture.componentInstance.count.set(3);
    fixture.detectChanges();
    expect(animate).not.toHaveBeenCalled();
  });
});
