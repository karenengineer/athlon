import {
  Controller,
  Get,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { AdminAuthGuard } from "../../auth/admin-auth.guard";
import { ExpenseListQueryDto } from "../expenses/dto/expense-list-query.dto";
import { PurchaseListQueryDto } from "../purchases/dto/purchase-list-query.dto";
import {
  AccountingDataset,
  AccountingExpenseRow,
  AccountingExportQuery,
  AccountingPurchaseRow,
  AccountingSaleRow,
} from "../reporting/finance-reporting.types";
import { FinanceReportingService } from "../reporting/finance-reporting.service";
import {
  calendarRange,
  FinanceProductQueryDto,
  MonthlySummaryQueryDto,
  normalizeReportRange,
  ProfitabilityQueryDto,
  ReportQueryDto,
} from "../reporting/report-query.dto";
import { SaleListQueryDto } from "../sales/dto/sale-list-query.dto";
import { CsvCell, toCsv } from "./csv-export";
import { ExcelExportService } from "./excel-export.service";

type ExportKind =
  | "products"
  | "purchases"
  | "sales"
  | "expenses"
  | "monthly-summary"
  | "profitability";

type CsvDefinition = { headers: string[]; rows: CsvCell[][] };

const money = (value: string): string => value;

function csvDefinition(
  kind: ExportKind,
  dataset: AccountingDataset,
): CsvDefinition {
  switch (kind) {
    case "products":
      return {
        headers: [
          "SKU",
          "Product",
          "Category",
          "Suppliers",
          "Stock Status",
          "Current Stock",
          "Units Sold",
          "Weighted Buy Price AMD",
          "Sale Price AMD",
          "Revenue AMD",
          "COGS AMD",
          "Gross Profit AMD",
          "Inventory Value AMD",
        ],
        rows: dataset.products.map((row) => [
          row.sku,
          row.name,
          row.category.name,
          row.suppliers.map(({ name }) => name).join(", "),
          row.stockStatus,
          row.currentStock,
          row.unitsSold,
          money(row.weightedAverageBuyPrice),
          row.defaultSalePrice === null ? null : money(row.defaultSalePrice),
          money(row.realizedRevenue),
          money(row.realizedCostOfGoodsSold),
          money(row.realizedGrossProfit),
          money(row.inventoryValue),
        ]),
      };
    case "purchases":
      return purchaseCsv(dataset.purchases);
    case "sales":
      return saleCsv(dataset.sales);
    case "expenses":
      return expenseCsv(dataset.expenses);
    case "monthly-summary":
      return {
        headers: [
          "Period",
          "Revenue AMD",
          "COGS AMD",
          "Gross Profit AMD",
          "Operating Expenses AMD",
          "Recurring Expenses AMD",
          "Total Expenses AMD",
          "Net Profit AMD",
          "Units Sold",
          "Orders",
          "Average Order AMD",
        ],
        rows: dataset.monthlySummary.months.map((row) => [
          `${row.year}-${String(row.month).padStart(2, "0")}`,
          money(row.revenue),
          money(row.costOfGoodsSold),
          money(row.grossProfit),
          money(row.operatingExpenses),
          money(row.recurringExpenses),
          money(row.totalExpenses),
          money(row.netProfit),
          row.unitsSold,
          row.orderCount,
          money(row.averageOrderValue),
        ]),
      };
    case "profitability":
      return {
        headers: [
          "SKU",
          "Product",
          "Category",
          "Units Sold",
          "Revenue AMD",
          "COGS AMD",
          "Gross Profit AMD",
          "Gross Margin %",
          "Current Stock",
          "Inventory Value AMD",
        ],
        rows: dataset.profitability.map((row) => [
          row.sku,
          row.name,
          row.category.name,
          row.unitsSold,
          money(row.revenue),
          money(row.costOfGoodsSold),
          money(row.grossProfit),
          money(row.grossMarginPercent),
          row.currentStock,
          money(row.inventoryValue),
        ]),
      };
  }
}

function purchaseCsv(rows: AccountingPurchaseRow[]): CsvDefinition {
  return {
    headers: [
      "Date",
      "Purchase",
      "Supplier",
      "SKU",
      "Product",
      "Quantity",
      "Unit Cost AMD",
      "Total Cost AMD",
    ],
    rows: rows.map((row) => [
      row.date,
      row.purchaseNumber,
      row.supplierName,
      row.sku,
      row.name,
      row.quantity,
      money(row.purchaseUnitPrice),
      money(row.totalCost),
    ]),
  };
}

function saleCsv(rows: AccountingSaleRow[]): CsvDefinition {
  return {
    headers: [
      "Date",
      "Sale",
      "Order",
      "Channel",
      "Trainer Referral",
      "SKU",
      "Product",
      "Quantity",
      "Unit Price AMD",
      "Discount AMD",
      "Revenue AMD",
      "COGS AMD",
      "Gross Profit AMD",
    ],
    rows: rows.map((row) => [
      row.date,
      row.saleNumber,
      row.orderId,
      row.channel,
      row.trainerReferralCode,
      row.sku,
      row.name,
      row.quantity,
      money(row.actualUnitPrice),
      money(row.lineDiscount),
      money(row.revenue),
      money(row.costOfGoodsSold),
      money(row.grossProfit),
    ]),
  };
}

function expenseCsv(rows: AccountingExpenseRow[]): CsvDefinition {
  return {
    headers: [
      "Date",
      "Category",
      "Description",
      "Source",
      "Payment Method",
      "Notes",
      "Amount AMD",
    ],
    rows: rows.map((row) => [
      row.date,
      row.categoryName,
      row.description,
      row.source,
      row.paymentMethod,
      row.notes,
      money(row.amount),
    ]),
  };
}

function periodLabel(range: AccountingDataset["range"]): string {
  const from = range.from.slice(0, 10);
  const to = range.to.slice(0, 10);
  const year = from.slice(0, 4);
  if (from === `${year}-01-01` && to === `${year}-12-31`) return year;
  if (from.slice(0, 7) === to.slice(0, 7) && from.endsWith("-01")) {
    const lastDay = new Date(
      Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)), 0),
    )
      .toISOString()
      .slice(0, 10);
    if (to === lastDay) return from.slice(0, 7);
  }
  return `${from}-to-${to}`;
}

function downloadHeaders(
  response: Response,
  filename: string,
  contentType: string,
): void {
  response.set({
    "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Type": contentType,
  });
}

function listPeriodLabel(query: {
  dateFrom?: string;
  dateTo?: string;
}): string {
  if (query.dateFrom && query.dateTo)
    return periodLabel({ from: query.dateFrom, to: query.dateTo });
  if (query.dateFrom) return `from-${query.dateFrom}`;
  if (query.dateTo) return `through-${query.dateTo}`;
  return "all";
}

@ApiTags("admin-finance-exports")
@Controller("admin/finance/exports")
@UseGuards(AdminAuthGuard)
export class FinanceExportController {
  constructor(
    private readonly reporting: FinanceReportingService,
    private readonly excel: ExcelExportService,
  ) {}

  private reportQuery(input: ReportQueryDto): AccountingExportQuery {
    return { ...input, ...normalizeReportRange(input) };
  }

  private async csv(
    kind: ExportKind,
    query: AccountingExportQuery,
    response: Response,
  ): Promise<StreamableFile> {
    const dataset = await this.reporting.getExportDataset(query);
    const definition = csvDefinition(kind, dataset);
    downloadHeaders(
      response,
      `athlon-${kind}-${periodLabel(dataset.range)}.csv`,
      "text/csv; charset=utf-8",
    );
    return new StreamableFile(toCsv(definition.headers, definition.rows));
  }

  private csvRows(
    kind: ExportKind,
    period: string,
    definition: CsvDefinition,
    response: Response,
  ): StreamableFile {
    downloadHeaders(
      response,
      `athlon-${kind}-${period}.csv`,
      "text/csv; charset=utf-8",
    );
    return new StreamableFile(toCsv(definition.headers, definition.rows));
  }

  @Get("products.csv")
  products(
    @Query() query: FinanceProductQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.csv("products", this.reportQuery(query), response);
  }

  @Get("purchases.csv")
  async purchases(
    @Query() query: PurchaseListQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.csvRows(
      "purchases",
      listPeriodLabel(query),
      purchaseCsv(await this.reporting.getPurchaseExportRows(query)),
      response,
    );
  }

  @Get("sales.csv")
  async sales(
    @Query() query: SaleListQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.csvRows(
      "sales",
      listPeriodLabel(query),
      saleCsv(await this.reporting.getSaleExportRows(query)),
      response,
    );
  }

  @Get("expenses.csv")
  async expenses(
    @Query() query: ExpenseListQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.csvRows(
      "expenses",
      listPeriodLabel(query),
      expenseCsv(await this.reporting.getExpenseExportRows(query)),
      response,
    );
  }

  @Get("monthly-summary.csv")
  monthlySummary(
    @Query() query: MonthlySummaryQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.csv(
      "monthly-summary",
      { ...query, ...calendarRange(query.year, query.month) },
      response,
    );
  }

  @Get("profitability.csv")
  profitability(
    @Query() query: ProfitabilityQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.csv("profitability", this.reportQuery(query), response);
  }

  @Get("accounting.xlsx")
  async accounting(
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const dataset = await this.reporting.getExportDataset(
      this.reportQuery(query),
    );
    const period = periodLabel(dataset.range);
    downloadHeaders(
      response,
      `athlon-accounting-${period}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    return new StreamableFile(
      await this.excel.accountingWorkbook(dataset, period),
    );
  }
}
