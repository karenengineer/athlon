import { localizeCharacteristicValue } from "./characteristic-values";

describe("localizeCharacteristicValue", () => {
  it("translates known flavors, colors and materials", () => {
    expect(localizeCharacteristicValue("Vanilla Ice Cream", "hy")).toBe(
      "Վանիլային պաղպաղակ",
    );
    expect(localizeCharacteristicValue("Double Rich Chocolate", "ru")).toBe(
      "Двойной шоколад",
    );
    expect(localizeCharacteristicValue("Yellow", "hy")).toBe("Դեղին");
    expect(localizeCharacteristicValue("Rubber", "ru")).toBe("Резина");
    expect(localizeCharacteristicValue("powder", "hy")).toBe("Փոշի");
  });

  it("localizes units and known substances", () => {
    expect(localizeCharacteristicValue("907 g", "hy")).toBe("907 գ");
    expect(localizeCharacteristicValue("5.5 g", "ru")).toBe("5.5 г");
    expect(localizeCharacteristicValue("5 g creatine monohydrate", "hy")).toBe(
      "5 գ կրեատին մոնոհիդրատ",
    );
  });

  it("keeps English and unknown values unchanged", () => {
    expect(localizeCharacteristicValue("Vanilla Ice Cream", "en")).toBe(
      "Vanilla Ice Cream",
    );
    expect(localizeCharacteristicValue("unflavoured", "en")).toBe("Unflavored");
    expect(localizeCharacteristicValue("Cookies & Cream", "hy")).toBe(
      "Cookies & Cream",
    );
    expect(localizeCharacteristicValue("5 g something else", "ru")).toBe(
      "5 g something else",
    );
  });
});
