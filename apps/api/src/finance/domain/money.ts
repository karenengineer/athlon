import { Prisma } from "../../generated/prisma/client";

export const money = (
  value: ConstructorParameters<typeof Prisma.Decimal>[0],
): Prisma.Decimal =>
  new Prisma.Decimal(value);

export const moneySum = (values: Prisma.Decimal[]): Prisma.Decimal =>
  values.reduce((sum, value) => sum.add(value), new Prisma.Decimal(0));

export const roundMoney = (value: Prisma.Decimal, scale = 2): Prisma.Decimal =>
  value.toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP);

export const safePercent = (
  numerator: Prisma.Decimal,
  denominator: Prisma.Decimal,
): Prisma.Decimal | null =>
  denominator.isZero()
    ? null
    : numerator.div(denominator).mul(100).toDecimalPlaces(2);
