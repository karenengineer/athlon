import { imageAlt } from "./image-alt";

describe("imageAlt", () => {
  it("keeps alt text written in the page language", () => {
    expect(imageAlt("Շիճուկային պրոտեին", "ON Whey", "hy")).toBe(
      "Շիճուկային պրոտեին",
    );
    expect(imageAlt("Сывороточный протеин", "ON Whey", "ru")).toBe(
      "Сывороточный протеин",
    );
    expect(imageAlt("Whey protein tub", "ON Whey", "en")).toBe(
      "Whey protein tub",
    );
  });

  it("falls back to the localized name for missing or foreign-script alt text", () => {
    expect(imageAlt("Whey protein tub", "ON Whey՝ վանիլի համով", "hy")).toBe(
      "ON Whey՝ վանիլի համով",
    );
    expect(imageAlt("Whey protein tub", "ON Whey, ваниль", "ru")).toBe(
      "ON Whey, ваниль",
    );
    expect(imageAlt("  ", "ON Whey", "en")).toBe("ON Whey");
    expect(imageAlt(undefined, "ON Whey", "hy")).toBe("ON Whey");
  });
});
