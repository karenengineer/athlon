import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InventoryLedgerService } from "./inventory/inventory-ledger.service";
import { PurchasesController } from "./purchases/purchases.controller";
import { PurchasesService } from "./purchases/purchases.service";
import { SalesController } from "./sales/sales.controller";
import { SalesService } from "./sales/sales.service";
import { SuppliersController } from "./suppliers/suppliers.controller";
import { SuppliersService } from "./suppliers/suppliers.service";

@Module({
  imports: [AuthModule],
  controllers: [SuppliersController, PurchasesController, SalesController],
  providers: [
    SuppliersService,
    PurchasesService,
    SalesService,
    InventoryLedgerService,
  ],
  exports: [InventoryLedgerService],
})
export class FinanceModule {}
