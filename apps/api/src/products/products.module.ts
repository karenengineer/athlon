import { Module } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { PublicProductsController } from "./public-products.controller";
import { AdminProductsController } from "./admin-products.controller";
import { AdminProductsService } from "./admin-products.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [PublicProductsController, AdminProductsController],
  providers: [ProductsService, AdminProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
