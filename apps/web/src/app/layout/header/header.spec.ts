import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { Header } from "./header";

describe("Header logo presentation", () => {
  it("renders a circular 64px logo without stretching its image", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
    const image: HTMLImageElement =
      fixture.nativeElement.querySelector(".brand img");
    const style = getComputedStyle(image);
    expect(style.width).toBe("64px");
    expect(style.height).toBe("64px");
    expect(style.borderRadius).toBe("50%");
    expect(style.objectFit).toBe("cover");
    expect(image.width).toBe(64);
    expect(image.height).toBe(64);
  });
});
