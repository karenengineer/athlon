import { Locale, SalesChannel } from "../../generated/prisma/client";
import { DateRange } from "../domain/finance.types";

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
export type ReportFilters = {
  productId?: string;
  categoryId?: string;
  supplierId?: string;
  channel?: SalesChannel;
  trainerReferralCode?: string;
  expenseCategoryId?: string;
  stockStatus?: StockStatus;
  q?: string;
  locale?: Locale;
};
export type AccountingExportQuery = DateRange &
  ReportFilters & { sort?: ReportSort };
export type ReportSort =
  | "nameAsc"
  | "nameDesc"
  | "revenueAsc"
  | "revenueDesc"
  | "profitAsc"
  | "profitDesc"
  | "marginAsc"
  | "marginDesc"
  | "unitsSoldAsc"
  | "unitsSoldDesc"
  | "stockAsc"
  | "stockDesc";
export type FinanceProductQuery = AccountingExportQuery & {
  page: number;
  pageSize: number;
  sort?: ReportSort;
};
export type ProfitabilityQuery = FinanceProductQuery;
export type AdminList<T> = {
  items: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};
export type SerializedRange = { from: string; to: string };

export type FinanceTotals = {
  revenue: string;
  costOfGoodsSold: string;
  grossProfit: string;
  operatingExpenses: string;
  recurringExpenses: string;
  totalExpenses: string;
  netProfit: string;
  grossMarginPercent: string;
  netMarginPercent: string;
  unitsSold: number;
  orderCount: number;
  averageOrderValue: string;
};
export type Comparison = {
  previousValue: string;
  comparisonPercent: string | null;
  label: string;
};
export type FinanceDashboard = FinanceTotals & {
  range: SerializedRange;
  previousRange: SerializedRange;
  comparisons: Record<keyof FinanceTotals, Comparison>;
  inventoryValue: string;
  currentStock: number;
  lowStockCount: number;
  outOfStockCount: number;
};
export type FinanceProductRow = {
  productId: string;
  sku: string;
  name: string;
  category: { id: string; name: string };
  suppliers: { id: string; name: string }[];
  defaultSalePrice: string | null;
  weightedAverageBuyPrice: string;
  totalPurchased: number;
  totalSold: number;
  currentStock: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
  profitPerUnit: string | null;
  marginPercent: string | null;
  inventoryValue: string;
  unitsSold: number;
  realizedRevenue: string;
  realizedCostOfGoodsSold: string;
  realizedGrossProfit: string;
  realizedGrossMarginPercent: string;
};
export type ProductProfitabilityRow = {
  productId: string;
  sku: string;
  name: string;
  category: FinanceProductRow["category"];
  unitsSold: number;
  revenue: string;
  costOfGoodsSold: string;
  grossProfit: string;
  grossMarginPercent: string;
  currentStock: number;
  inventoryValue: string;
};
export type MonthlySummaryRow = FinanceTotals & { year: number; month: number };
export type MonthlySummary = {
  year: number;
  month?: number;
  range: SerializedRange;
  months: MonthlySummaryRow[];
  totals: FinanceTotals;
};
export type ExpenseBreakdownRow = {
  categoryId: string;
  categoryName: string;
  amount: string;
  percentage: string | null;
};
export type AccountingSaleRow = {
  saleId: string;
  saleNumber: string;
  date: string;
  orderId: string | null;
  channel: SalesChannel;
  trainerReferralCode: string | null;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  actualUnitPrice: string;
  lineDiscount: string;
  costUnitSnapshot: string;
  revenue: string;
  costOfGoodsSold: string;
  grossProfit: string;
};
export type AccountingPurchaseRow = {
  purchaseId: string;
  purchaseNumber: string;
  date: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  purchaseUnitPrice: string;
  totalCost: string;
};
export type AccountingExpenseRow = {
  id: string;
  date: string;
  categoryId: string;
  categoryName: string;
  description: string;
  amount: string;
  source: string;
  paymentMethod: string | null;
  notes: string | null;
};
export type AccountingDataset = {
  range: SerializedRange;
  summary: FinanceDashboard;
  products: FinanceProductRow[];
  purchases: AccountingPurchaseRow[];
  sales: AccountingSaleRow[];
  expenses: AccountingExpenseRow[];
  monthlySummary: Omit<MonthlySummary, "year" | "month">;
  profitability: ProductProfitabilityRow[];
  expenseBreakdown: ExpenseBreakdownRow[];
};
