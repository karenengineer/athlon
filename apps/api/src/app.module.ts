import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { environmentSchema } from "./config/environment.schema";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { CategoriesModule } from "./categories/categories.module";
import { BrandsModule } from "./brands/brands.module";
import { ProductsModule } from "./products/products.module";
import { SiteSettingsModule } from "./site-settings/site-settings.module";
import { AuthModule } from "./auth/auth.module";
import { MediaModule } from "./media/media.module";
import { FinanceModule } from "./finance/finance.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
      validationSchema: environmentSchema,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    HealthModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    SiteSettingsModule,
    AuthModule,
    MediaModule,
    FinanceModule,
  ],
})
export class AppModule {}
