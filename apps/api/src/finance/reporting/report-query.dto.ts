import { BadRequestException } from "@nestjs/common";
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Locale, SalesChannel } from "../../generated/prisma/client";
import { parseFinanceInteger } from "../common/finance-list-query.dto";
import { DateRange } from "../domain/finance.types";
import { ReportSort, StockStatus } from "./finance-reporting.types";

export type ReportPeriod =
  | "today"
  | "thisMonth"
  | "previousMonth"
  | "thisYear"
  | "custom";
type RangeInput = { period?: ReportPeriod; dateFrom?: string; dateTo?: string };

export class ReportFiltersDto {
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsUUID() expenseCategoryId?: string;
  @IsOptional() @IsEnum(SalesChannel) channel?: SalesChannel;
  @IsOptional() @IsString() @MaxLength(100) trainerReferralCode?: string;
  @IsOptional() @IsEnum(Locale) locale?: Locale;
  @IsOptional()
  @IsIn(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"])
  stockStatus?: StockStatus;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
}

export class ReportQueryDto extends ReportFiltersDto implements RangeInput {
  @IsOptional()
  @IsIn(["today", "thisMonth", "previousMonth", "thisYear", "custom"])
  period?: ReportPeriod;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateFrom?: string;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateTo?: string;
}

export class FinanceProductQueryDto extends ReportQueryDto {
  @Transform(parseFinanceInteger)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page = 1;
  @Transform(parseFinanceInteger) @IsInt() @Min(1) @Max(100) pageSize = 24;
  @IsIn([
    "nameAsc",
    "nameDesc",
    "revenueAsc",
    "revenueDesc",
    "profitAsc",
    "profitDesc",
    "marginAsc",
    "marginDesc",
    "unitsSoldAsc",
    "unitsSoldDesc",
    "stockAsc",
    "stockDesc",
  ])
  sort: ReportSort = "nameAsc";
}
export class ProfitabilityQueryDto extends FinanceProductQueryDto {
  override sort: ReportSort = "profitDesc";
}
export class MonthlySummaryQueryDto extends ReportFiltersDto {
  @Transform(parseFinanceInteger) @IsInt() @Min(1000) @Max(9999) year!: number;
  @IsOptional()
  @Transform(parseFinanceInteger)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

export function calendarRange(year: number, month?: number): DateRange {
  if (
    !Number.isInteger(year) ||
    year < 1000 ||
    year > 9999 ||
    (month !== undefined &&
      (!Number.isInteger(month) || month < 1 || month > 12))
  )
    throw new BadRequestException("Invalid reporting year or month");
  return {
    from: new Date(Date.UTC(year, month === undefined ? 0 : month - 1, 1)),
    to: new Date(Date.UTC(year, month ?? 12, 1) - 1),
  };
}

export function normalizeReportRange(
  query: RangeInput,
  now = new Date(),
): DateRange {
  if (query.dateFrom || query.dateTo || query.period === "custom") {
    if (!query.dateFrom || !query.dateTo)
      throw new BadRequestException("Both dateFrom and dateTo are required");
    if (query.period && query.period !== "custom")
      throw new BadRequestException(
        "Custom dates cannot be combined with a preset period",
      );
    const from = new Date(`${query.dateFrom}T00:00:00.000Z`);
    const to = new Date(`${query.dateTo}T23:59:59.999Z`);
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      from.toISOString().slice(0, 10) !== query.dateFrom ||
      to.toISOString().slice(0, 10) !== query.dateTo
    )
      throw new BadRequestException("Invalid calendar date");
    assertReportRange({ from, to });
    return { from, to };
  }
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  switch (query.period ?? "thisMonth") {
    case "today": {
      const from = new Date(Date.UTC(year, month - 1, now.getUTCDate()));
      return { from, to: new Date(from.getTime() + 86_400_000 - 1) };
    }
    case "thisMonth":
      return calendarRange(year, month);
    case "previousMonth":
      return month === 1
        ? calendarRange(year - 1, 12)
        : calendarRange(year, month - 1);
    case "thisYear":
      return calendarRange(year);
    default:
      throw new BadRequestException("Invalid reporting period");
  }
}

export function assertReportRange(range: DateRange): void {
  if (
    !Number.isFinite(range.from.getTime()) ||
    !Number.isFinite(range.to.getTime()) ||
    range.from > range.to ||
    range.from.getUTCFullYear() < 1000 ||
    range.to.getUTCFullYear() > 9999
  )
    throw new BadRequestException("Invalid reporting range");
}

export function previousReportRange(range: DateRange): DateRange {
  assertReportRange(range);
  const year = range.from.getUTCFullYear();
  const month = range.from.getUTCMonth() + 1;
  const fullYear = calendarRange(year);
  if (+range.from === +fullYear.from && +range.to === +fullYear.to)
    return calendarRange(year - 1);
  const fullMonth = calendarRange(year, month);
  if (+range.from === +fullMonth.from && +range.to === +fullMonth.to)
    return month === 1
      ? calendarRange(year - 1, 12)
      : calendarRange(year, month - 1);
  return {
    from: new Date(+range.from - (+range.to - +range.from + 1)),
    to: new Date(+range.from - 1),
  };
}
