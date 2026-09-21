import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import {
  ExpenseCategoriesController,
  ExpensesController,
} from "./expenses/expenses.controller";
import { ExpensesService } from "./expenses/expenses.service";
import { InventoryLedgerService } from "./inventory/inventory-ledger.service";
import { PurchasesController } from "./purchases/purchases.controller";
import { PurchasesService } from "./purchases/purchases.service";
import { RecurringExpensesController } from "./recurring/recurring-expenses.controller";
import { RecurringExpensesService } from "./recurring/recurring-expenses.service";
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
  ],
  providers: [
    SuppliersService,
    PurchasesService,
    SalesService,
    ExpensesService,
    RecurringExpensesService,
    InventoryLedgerService,
  ],
  exports: [InventoryLedgerService, RecurringExpensesService],
})
export class FinanceModule {}
