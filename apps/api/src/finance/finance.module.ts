import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import {
  ExpenseCategoriesController,
  ExpensesController,
} from "./expenses/expenses.controller";
import { ExpensesService } from "./expenses/expenses.service";
import { ExcelExportService } from "./export/excel-export.service";
import { FinanceExportController } from "./export/finance-export.controller";
import { InventoryLedgerService } from "./inventory/inventory-ledger.service";
import { PurchasesController } from "./purchases/purchases.controller";
import { PurchasesService } from "./purchases/purchases.service";
import { RecurringExpensesController } from "./recurring/recurring-expenses.controller";
import { RecurringExpensesService } from "./recurring/recurring-expenses.service";
import { FinanceReportingController } from "./reporting/finance-reporting.controller";
import { FinanceReportingService } from "./reporting/finance-reporting.service";
import { SalesController } from "./sales/sales.controller";
import { SalesService } from "./sales/sales.service";
import { SuppliersController } from "./suppliers/suppliers.controller";
import { SuppliersService } from "./suppliers/suppliers.service";

@Module({
  imports: [AuthModule],
  controllers: [
    SuppliersController,
    PurchasesController,
    SalesController,
    ExpenseCategoriesController,
    ExpensesController,
    RecurringExpensesController,
    FinanceReportingController,
    FinanceExportController,
  ],
  providers: [
    SuppliersService,
    PurchasesService,
    SalesService,
    ExpensesService,
    RecurringExpensesService,
    InventoryLedgerService,
    FinanceReportingService,
    ExcelExportService,
  ],
  exports: [
    InventoryLedgerService,
    RecurringExpensesService,
    FinanceReportingService,
  ],
})
export class FinanceModule {}
