export type FinanceMoney = string;
export type FinanceIsoDate = string;
export type FinanceDate = string;
export type FinanceLocale = "HY" | "RU" | "EN";
export type FinanceReportPeriod =
  | "today"
  | "thisMonth"
  | "previousMonth"
  | "thisYear"
  | "custom";
export type SalesChannel =
  | "WEBSITE"
  | "INSTAGRAM"
  | "GYM"
  | "TRAINER"
  | "DIRECT"
  | "MARKETPLACE"
  | "OTHER";
export type SaleSourceType = "MANUAL" | "WEBSITE_ORDER";
export type ExpenseSource = "ONE_TIME" | "RECURRING_OCCURRENCE";
export type Recurrence = "MONTHLY";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface FinanceListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FinanceList<T> {
  items: T[];
  meta: FinanceListMeta;
}

export interface FinanceListQuery {
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface FinanceAdminReference {
  id: string;
  email: string;
}

export interface FinanceCategoryReference {
  id: string;
  name: string;
}

export interface FinanceCategoryTranslation {
  id: string;
  categoryId: string;
  locale: FinanceLocale;
  name: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface FinanceProductTranslation {
  id: string;
  productId: string;
  locale: FinanceLocale;
  name: string;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface FinanceCatalogCategoryReference {
  id: string;
  code: string;
  slug: string;
  parentId: string | null;
  published: boolean;
  displayOrder: number;
  createdAt: FinanceIsoDate;
  updatedAt: FinanceIsoDate;
  translations: FinanceCategoryTranslation[];
}

export interface FinanceProductReference {
  id: string;
  sku: string;
  slug: string;
  categoryId: string;
  brandId: string | null;
  price: FinanceMoney | null;
  currency: string;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "PREORDER" | "ON_REQUEST";
  characteristics: Record<string, unknown>;
  featured: boolean;
  isNew: boolean;
  published: boolean;
  displayOrder: number;
  lowStockThreshold: number;
  createdAt: FinanceIsoDate;
  updatedAt: FinanceIsoDate;
  translations: FinanceProductTranslation[];
  category: FinanceCatalogCategoryReference;
}

export interface SupplierInput {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  active?: boolean;
}

export interface Supplier extends SupplierInput {
  id: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  createdAt: FinanceIsoDate;
  updatedAt: FinanceIsoDate;
}

export interface SupplierQuery extends FinanceListQuery {
  active?: boolean;
  sort?: "name" | "updated";
}

export interface PurchaseItemInput {
  productId: string;
  quantity: number;
  purchaseUnitPrice: FinanceMoney;
}

export interface PurchaseInput {
  date: FinanceDate;
  supplierId: string;
  notes?: string | null;
  items: PurchaseItemInput[];
}

export interface PurchaseItem extends PurchaseItemInput {
  id: string;
  purchaseId: string;
  product: FinanceProductReference;
  totalPurchaseCost: FinanceMoney;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  date: FinanceIsoDate;
  supplierId: string;
  supplier: Supplier;
  notes: string | null;
  createdByAdminId: string;
  createdByAdmin: FinanceAdminReference;
  importKey: string | null;
  items: PurchaseItem[];
  totalPurchaseCost: FinanceMoney;
  createdAt: FinanceIsoDate;
  updatedAt: FinanceIsoDate;
}

export interface PurchaseQuery extends FinanceListQuery {
  dateFrom?: FinanceDate;
  dateTo?: FinanceDate;
  productId?: string;
  categoryId?: string;
  supplierId?: string;
  sort?: "dateDesc" | "dateAsc" | "totalDesc" | "totalAsc";
}

export interface SaleItemInput {
  productId: string;
  quantity: number;
  actualUnitPrice: FinanceMoney;
  lineDiscount?: FinanceMoney;
}

export interface SaleInput {
  date: FinanceDate;
  orderId?: string | null;
  channel: SalesChannel;
  trainerReferralCode?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  items: SaleItemInput[];
}

export interface SaleItem extends Omit<SaleItemInput, "lineDiscount"> {
  id: string;
  saleId: string;
  lineDiscount: FinanceMoney;
  costUnitSnapshot: FinanceMoney;
  netRevenue: FinanceMoney;
  costOfGoodsSold: FinanceMoney;
  grossProfit: FinanceMoney;
  grossMarginPercent: FinanceMoney;
  product: FinanceProductReference;
}

export interface Sale {
  id: string;
  saleNumber: string;
  date: FinanceIsoDate;
  orderId: string | null;
  sourceType: SaleSourceType;
  sourceId: string | null;
  channel: SalesChannel;
  trainerReferralCode: string | null;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  createdByAdminId: string;
  createdByAdmin: FinanceAdminReference;
  importKey: string | null;
  items: SaleItem[];
  totalNetRevenue: FinanceMoney;
  totalCostOfGoodsSold: FinanceMoney;
  totalGrossProfit: FinanceMoney;
  grossMarginPercent: FinanceMoney;
  createdAt: FinanceIsoDate;
  updatedAt: FinanceIsoDate;
}

export interface SaleQuery extends FinanceListQuery {
  dateFrom?: FinanceDate;
  dateTo?: FinanceDate;
  productId?: string;
  categoryId?: string;
  channel?: SalesChannel;
  trainerReferralCode?: string;
  sort?:
    | "dateDesc"
    | "dateAsc"
    | "revenueDesc"
    | "revenueAsc"
    | "profitDesc"
    | "profitAsc";
}

export interface ExpenseCategoryInput {
  name: string;
  active?: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  active: boolean;
  createdAt: FinanceIsoDate;
  updatedAt: FinanceIsoDate;
}

export interface ExpenseCategoryQuery extends FinanceListQuery {
  active?: boolean;
  sort?: "name" | "updated";
}

export interface ExpenseInput {
  date: FinanceDate;
  categoryId: string;
  description: string;
  amount: FinanceMoney;
  paymentMethod?: string | null;
  notes?: string | null;
}

export interface Expense extends Omit<ExpenseInput, "paymentMethod" | "notes"> {
  id: string;
  date: FinanceIsoDate;
  paymentMethod: string | null;
  notes: string | null;
  source: ExpenseSource;
  category: ExpenseCategory;
  createdByAdminId: string;
  createdByAdmin: FinanceAdminReference;
  createdAt: FinanceIsoDate;
  updatedAt: FinanceIsoDate;
}

export interface ExpenseQuery extends FinanceListQuery {
  paymentMethod?: string;
  dateFrom?: FinanceDate;
  dateTo?: FinanceDate;
  categoryId?: string;
  source?: ExpenseSource;
  sort?: "dateDesc" | "dateAsc" | "amountDesc" | "amountAsc";
}

export interface RecurringExpenseInput {
  name: string;
  categoryId: string;
  amount: FinanceMoney;
  startDate: FinanceDate;
  endDate?: FinanceDate | null;
  active?: boolean;
  paymentMethod?: string | null;
  notes?: string | null;
}

export interface RecurringExpense
  extends Omit<
    RecurringExpenseInput,
    "endDate" | "active" | "paymentMethod" | "notes"
  > {
  id: string;
  startDate: FinanceIsoDate;
  endDate: FinanceIsoDate | null;
  active: boolean;
  paymentMethod: string | null;
  notes: string | null;
  recurrence: Recurrence;
  category: ExpenseCategory;
  createdAt: FinanceIsoDate;
  updatedAt: FinanceIsoDate;
}

export interface RecurringExpenseQuery extends FinanceListQuery {
  paymentMethod?: string;
  categoryId?: string;
  active?: boolean;
  sort?: "name" | "startDesc" | "updated";
}

export interface ReportFilters {
  productId?: string;
  categoryId?: string;
  supplierId?: string;
  expenseCategoryId?: string;
  channel?: SalesChannel;
  trainerReferralCode?: string;
  locale?: FinanceLocale;
  stockStatus?: StockStatus;
  q?: string;
}

export interface ReportQuery extends ReportFilters {
  period?: FinanceReportPeriod;
  dateFrom?: FinanceDate;
  dateTo?: FinanceDate;
}

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

export interface FinanceProductQuery extends ReportQuery {
  page?: number;
  pageSize?: number;
  sort?: ReportSort;
}

export type ProfitabilityQuery = FinanceProductQuery;

export interface MonthlySummaryQuery extends ReportFilters {
  year: number;
  month?: number;
}

export interface SerializedRange {
  from: FinanceIsoDate;
  to: FinanceIsoDate;
}

export interface FinanceTotals {
  revenue: FinanceMoney;
  costOfGoodsSold: FinanceMoney;
  grossProfit: FinanceMoney;
  operatingExpenses: FinanceMoney;
  recurringExpenses: FinanceMoney;
  totalExpenses: FinanceMoney;
  netProfit: FinanceMoney;
  grossMarginPercent: FinanceMoney;
  netMarginPercent: FinanceMoney;
  unitsSold: number;
  orderCount: number;
  averageOrderValue: FinanceMoney;
}

export interface FinanceComparison {
  previousValue: FinanceMoney;
  comparisonPercent: FinanceMoney | null;
  label: string;
}

export interface FinanceDashboard extends FinanceTotals {
  range: SerializedRange;
  previousRange: SerializedRange;
  comparisons: Record<keyof FinanceTotals, FinanceComparison>;
  inventoryValue: FinanceMoney;
  currentStock: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface FinanceProductRow {
  productId: string;
  sku: string;
  name: string;
  category: FinanceCategoryReference;
  suppliers: { id: string; name: string }[];
  defaultSalePrice: FinanceMoney | null;
  weightedAverageBuyPrice: FinanceMoney;
  totalPurchased: number;
  totalSold: number;
  currentStock: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
  profitPerUnit: FinanceMoney | null;
  marginPercent: FinanceMoney | null;
  inventoryValue: FinanceMoney;
  unitsSold: number;
  realizedRevenue: FinanceMoney;
  realizedCostOfGoodsSold: FinanceMoney;
  realizedGrossProfit: FinanceMoney;
  realizedGrossMarginPercent: FinanceMoney;
}

export interface ProductProfitabilityRow {
  productId: string;
  sku: string;
  name: string;
  category: FinanceCategoryReference;
  unitsSold: number;
  revenue: FinanceMoney;
  costOfGoodsSold: FinanceMoney;
  grossProfit: FinanceMoney;
  grossMarginPercent: FinanceMoney;
  currentStock: number;
  inventoryValue: FinanceMoney;
}

export interface MonthlySummaryRow extends FinanceTotals {
  year: number;
  month: number;
}

export interface MonthlySummary {
  year: number;
  month?: number;
  range: SerializedRange;
  months: MonthlySummaryRow[];
  totals: FinanceTotals;
}

export interface ExpenseBreakdownRow {
  categoryId: string;
  categoryName: string;
  amount: FinanceMoney;
  percentage: FinanceMoney | null;
}

export type FinanceExportEndpoint =
  | "products.csv"
  | "purchases.csv"
  | "sales.csv"
  | "expenses.csv"
  | "monthly-summary.csv"
  | "profitability.csv"
  | "accounting.xlsx";

export type FinanceExportQuery =
  | FinanceProductQuery
  | PurchaseQuery
  | SaleQuery
  | ExpenseQuery
  | MonthlySummaryQuery
  | ProfitabilityQuery
  | ReportQuery;

export interface FinanceDownload {
  blob: Blob;
  filename: string;
}
