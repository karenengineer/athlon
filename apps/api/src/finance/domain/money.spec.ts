import { Prisma } from "../../generated/prisma/client";
import { money, moneySum, roundMoney, safePercent } from "./money";

describe("finance money", () => {
  it("calculates weighted values without binary floating point", () => {
    const total = moneySum([money(10).mul(12_000), money(5).mul(13_000)]);
    expect(roundMoney(total.div(15), 2).toString()).toBe("12333.33");
  });

  it("keeps exact high-value inventory arithmetic", () => {
    expect(money("999999999999.99").mul(2147483647).toString()).toBe(
      "2147483646999978525163.53",
    );
  });

  it("returns null rather than infinity for a zero denominator", () => {
    expect(
      safePercent(new Prisma.Decimal(100), new Prisma.Decimal(0)),
    ).toBeNull();
  });
});
