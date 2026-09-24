import { FinanceIsoDate, FinanceMoney } from "./finance-api.types";

const emptyDisplay = "—";
const amdFormatter = new Intl.NumberFormat("hy-AM", {
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat("hy-AM", {
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("hy-AM", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function finiteNumber(value: FinanceMoney | number | null): number | null {
  if (value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Display-only formatting. Financial calculations remain server-owned. */
export function formatAmd(value: FinanceMoney | number | null): string {
  const parsed = finiteNumber(value);
  return parsed === null ? emptyDisplay : `${amdFormatter.format(parsed)} AMD`;
}

/** Accepts the API's percentage value (for example, 12.5 means 12.5%). */
export function formatPercent(value: FinanceMoney | number | null): string {
  const parsed = finiteNumber(value);
  return parsed === null ? emptyDisplay : `${percentFormatter.format(parsed)}%`;
}

export function formatFinanceDate(value: FinanceIsoDate | null): string {
  if (!value) return emptyDisplay;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? dateFormatter.format(date)
    : emptyDisplay;
}
