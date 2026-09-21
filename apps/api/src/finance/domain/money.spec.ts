import { Prisma } from "../../generated/prisma/client";
import { money, moneySum, roundMoney, safePercent } from "./money";

describe("finance money", () => {
  it("calculates weighted values without binary floating point", () => {
    const total = moneySum([money(10).mul(12_000), money(5).mul(13_000)]);
    expect(roundMoney(total.div(15), 2).toString()).toBe("12333.33");
  });

  it("returns null rather than infinity for a zero denominator", () => {
    expect(
      safePercent(new Prisma.Decimal(100), new Prisma.Decimal(0)),
    ).toBeNull();
  });
});
