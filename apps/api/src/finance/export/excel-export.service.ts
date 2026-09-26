import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import {
  AccountingDataset,
  FinanceTotals,
} from "../reporting/finance-reporting.types";

const BLACK = "FF0A0A0A";
const RED = "FFE30613";
const WHITE = "FFFFFFFF";
const AMD_FORMAT = '#,##0 "AMD"';
const DATE_FORMAT = "yyyy-mm-dd";

type Column = {
  header: string;
  key: string;
  width: number;
  format?: "amd" | "date" | "percent";
};

const amount = (value: string): ExcelJS.CellValue => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (Number.isInteger(numeric))
    return Number.isSafeInteger(numeric) ? numeric : value;
  return Math.abs(numeric) <= Number.MAX_SAFE_INTEGER ? numeric : value;
};
const date = (value: string): Date =>
  new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.alignment = { vertical: "middle" };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  };
  sheet.properties.tabColor = { argb: RED };
}

function styleFormats(
  sheet: ExcelJS.Worksheet,
  columns: readonly Column[],
): void {
  columns.forEach((column, index) => {
    const worksheetColumn = sheet.getColumn(index + 1);
    if (column.format === "amd") worksheetColumn.numFmt = AMD_FORMAT;
    if (column.format === "date") worksheetColumn.numFmt = DATE_FORMAT;
    if (column.format === "percent") worksheetColumn.numFmt = '0.00"%"';
  });
}

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: readonly Column[],
  rows: readonly Record<string, ExcelJS.CellValue>[],
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));
  sheet.addRows([...rows]);
  styleHeader(sheet);
  styleFormats(sheet, columns);
  return sheet;
}

function styleTotal(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED } };
    cell.font = { bold: true, color: { argb: WHITE } };
  });
}

function dashboardRows(
  summary: AccountingDataset["summary"],
): Record<string, ExcelJS.CellValue>[] {
  const rows: Array<[string, ExcelJS.CellValue]> = [
    ["Period Start", date(summary.range.from)],
    ["Period End", date(summary.range.to)],
    ["Revenue", amount(summary.revenue)],
    ["Cost of Goods Sold", amount(summary.costOfGoodsSold)],
    ["Gross Profit", amount(summary.grossProfit)],
    ["Operating Expenses", amount(summary.operatingExpenses)],
    ["Recurring Expenses", amount(summary.recurringExpenses)],
    ["Total Expenses", amount(summary.totalExpenses)],
    ["Net Profit", amount(summary.netProfit)],
    ["Gross Margin %", amount(summary.grossMarginPercent)],
    ["Net Margin %", amount(summary.netMarginPercent)],
    ["Units Sold", summary.unitsSold],
    ["Order Count", summary.orderCount],
    ["Average Order Value", amount(summary.averageOrderValue)],
    ["Inventory Value", amount(summary.inventoryValue)],
    ["Current Stock", summary.currentStock],
    ["Low Stock Count", summary.lowStockCount],
    ["Out of Stock Count", summary.outOfStockCount],
  ];
  return rows.map(([metric, value]) => ({ metric, value }));
}

function totalRow(totals: FinanceTotals): Record<string, ExcelJS.CellValue> {
  return {
    period: "TOTAL",
    revenue: amount(totals.revenue),
    costOfGoodsSold: amount(totals.costOfGoodsSold),
    grossProfit: amount(totals.grossProfit),
    operatingExpenses: amount(totals.operatingExpenses),
    recurringExpenses: amount(totals.recurringExpenses),
    totalExpenses: amount(totals.totalExpenses),
    netProfit: amount(totals.netProfit),
    unitsSold: totals.unitsSold,
    orderCount: totals.orderCount,
    averageOrderValue: amount(totals.averageOrderValue),
  };
}

@Injectable()
export class ExcelExportService {
  async accountingWorkbook(
    dataset: AccountingDataset,
    period: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ATHLON";
    workbook.title = `ATHLON Accounting ${period}`;
    workbook.subject = `${dataset.range.from} to ${dataset.range.to}`;

    const dashboard = addSheet(
      workbook,
      "Dashboard",
      [
        { header: "Metric", key: "metric", width: 28 },
        { header: "Value", key: "value", width: 22 },
      ],
      dashboardRows(dataset.summary),
    );
    dashboard.getCell("B2").numFmt = DATE_FORMAT;
    dashboard.getCell("B3").numFmt = DATE_FORMAT;
    [4, 5, 6, 7, 8, 9, 10, 15, 16].forEach((row) => {
      dashboard.getCell(row, 2).numFmt = AMD_FORMAT;
    });
    dashboard.getCell("B11").numFmt = '0.00"%"';
    dashboard.getCell("B12").numFmt = '0.00"%"';
    styleTotal(dashboard.getRow(10));

    const products = addSheet(
      workbook,
      "Products",
      [
        { header: "SKU", key: "sku", width: 16 },
        { header: "Product", key: "name", width: 30 },
        { header: "Category", key: "category", width: 22 },
        { header: "Suppliers", key: "suppliers", width: 30 },
        { header: "Stock Status", key: "stockStatus", width: 16 },
        { header: "Current Stock", key: "currentStock", width: 15 },
        { header: "Units Sold", key: "unitsSold", width: 13 },
        {
          header: "Weighted Buy Price",
          key: "weightedBuyPrice",
          width: 20,
          format: "amd",
        },
        { header: "Sale Price", key: "salePrice", width: 16, format: "amd" },
        { header: "Revenue", key: "revenue", width: 18, format: "amd" },
        { header: "COGS", key: "cogs", width: 18, format: "amd" },
        {
          header: "Gross Profit",
          key: "grossProfit",
          width: 18,
          format: "amd",
        },
        {
          header: "Inventory Value",
          key: "inventoryValue",
          width: 19,
          format: "amd",
        },
      ],
      dataset.products.map((row) => ({
        sku: row.sku,
        name: row.name,
        category: row.category.name,
        suppliers: row.suppliers.map(({ name }) => name).join(", "),
        stockStatus: row.stockStatus,
        currentStock: row.currentStock,
        unitsSold: row.unitsSold,
        weightedBuyPrice: amount(row.weightedAverageBuyPrice),
        salePrice:
          row.defaultSalePrice === null ? null : amount(row.defaultSalePrice),
        revenue: amount(row.realizedRevenue),
        cogs: amount(row.realizedCostOfGoodsSold),
        grossProfit: amount(row.realizedGrossProfit),
        inventoryValue: amount(row.inventoryValue),
      })),
    );
    const productTotal = products.addRow({
      sku: "TOTAL",
      inventoryValue: amount(dataset.summary.inventoryValue),
    });
    styleTotal(productTotal);

    addSheet(
      workbook,
      "Purchases",
      [
        { header: "Date", key: "date", width: 13, format: "date" },
        { header: "Purchase", key: "purchaseNumber", width: 18 },
        { header: "Supplier", key: "supplierName", width: 28 },
        { header: "SKU", key: "sku", width: 16 },
        { header: "Product", key: "name", width: 30 },
        { header: "Quantity", key: "quantity", width: 12 },
        { header: "Unit Cost", key: "unitCost", width: 18, format: "amd" },
        { header: "Total Cost", key: "totalCost", width: 18, format: "amd" },
      ],
      dataset.purchases.map((row) => ({
        date: date(row.date),
        purchaseNumber: row.purchaseNumber,
        supplierName: row.supplierName,
        sku: row.sku,
        name: row.name,
        quantity: row.quantity,
        unitCost: amount(row.purchaseUnitPrice),
        totalCost: amount(row.totalCost),
      })),
    );

    const sales = addSheet(
      workbook,
      "Sales",
      [
        { header: "Date", key: "date", width: 13, format: "date" },
        { header: "Sale", key: "saleNumber", width: 18 },
        { header: "Order", key: "orderId", width: 18 },
        { header: "Channel", key: "channel", width: 16 },
        { header: "Referral", key: "referral", width: 20 },
        { header: "SKU", key: "sku", width: 16 },
        { header: "Product", key: "name", width: 30 },
        { header: "Quantity", key: "quantity", width: 12 },
        { header: "Unit Price", key: "unitPrice", width: 18, format: "amd" },
        { header: "Discount", key: "discount", width: 16, format: "amd" },
        { header: "Revenue", key: "revenue", width: 18, format: "amd" },
        { header: "COGS", key: "cogs", width: 18, format: "amd" },
        {
          header: "Gross Profit",
          key: "grossProfit",
          width: 18,
          format: "amd",
        },
      ],
      dataset.sales.map((row) => ({
        date: date(row.date),
        saleNumber: row.saleNumber,
        orderId: row.orderId,
        channel: row.channel,
        referral: row.trainerReferralCode,
        sku: row.sku,
        name: row.name,
        quantity: row.quantity,
        unitPrice: amount(row.actualUnitPrice),
        discount: amount(row.lineDiscount),
        revenue: amount(row.revenue),
        cogs: amount(row.costOfGoodsSold),
        grossProfit: amount(row.grossProfit),
      })),
    );
    styleTotal(
      sales.addRow({
        saleNumber: "TOTAL",
        revenue: amount(dataset.summary.revenue),
        cogs: amount(dataset.summary.costOfGoodsSold),
        grossProfit: amount(dataset.summary.grossProfit),
      }),
    );

    const expenses = addSheet(
      workbook,
      "Expenses",
      [
        { header: "Date", key: "date", width: 13, format: "date" },
        { header: "Category", key: "category", width: 24 },
        { header: "Description", key: "description", width: 36 },
        { header: "Source", key: "source", width: 24 },
        { header: "Payment Method", key: "paymentMethod", width: 20 },
        { header: "Notes", key: "notes", width: 32 },
        { header: "Amount", key: "amount", width: 18, format: "amd" },
      ],
      dataset.expenses.map((row) => ({
        date: date(row.date),
        category: row.categoryName,
        description: row.description,
        source: row.source,
        paymentMethod: row.paymentMethod,
        notes: row.notes,
        amount: amount(row.amount),
      })),
    );
    styleTotal(
      expenses.addRow({
        description: "TOTAL",
        amount: amount(dataset.summary.totalExpenses),
      }),
    );

    const expensesByCategory = addSheet(
      workbook,
      "Expenses by Category",
      [
        { header: "Category", key: "category", width: 30 },
        { header: "Amount", key: "amount", width: 18, format: "amd" },
        {
          header: "Percentage",
          key: "percentage",
          width: 16,
          format: "percent",
        },
      ],
      dataset.expenseBreakdown.map((row) => ({
        category: row.categoryName,
        amount: amount(row.amount),
        percentage: row.percentage === null ? null : amount(row.percentage),
      })),
    );
    styleTotal(
      expensesByCategory.addRow({
        category: "TOTAL",
        amount: amount(dataset.summary.totalExpenses),
        percentage: null,
      }),
    );

    const monthly = addSheet(
      workbook,
      "Monthly Summary",
      [
        { header: "Period", key: "period", width: 14 },
        { header: "Revenue", key: "revenue", width: 18, format: "amd" },
        { header: "COGS", key: "costOfGoodsSold", width: 18, format: "amd" },
        {
          header: "Gross Profit",
          key: "grossProfit",
          width: 18,
          format: "amd",
        },
        {
          header: "Operating Expenses",
          key: "operatingExpenses",
          width: 21,
          format: "amd",
        },
        {
          header: "Recurring Expenses",
          key: "recurringExpenses",
          width: 21,
          format: "amd",
        },
        {
          header: "Total Expenses",
          key: "totalExpenses",
          width: 19,
          format: "amd",
        },
        { header: "Net Profit", key: "netProfit", width: 18, format: "amd" },
        { header: "Units Sold", key: "unitsSold", width: 13 },
        { header: "Orders", key: "orderCount", width: 11 },
        {
          header: "Average Order",
          key: "averageOrderValue",
          width: 18,
          format: "amd",
        },
      ],
      dataset.monthlySummary.months.map((row) => ({
        ...totalRow(row),
        period: `${row.year}-${String(row.month).padStart(2, "0")}`,
      })),
    );
    styleTotal(monthly.addRow(totalRow(dataset.monthlySummary.totals)));

    const output = await workbook.xlsx.writeBuffer();
    return Buffer.from(output);
  }
}
