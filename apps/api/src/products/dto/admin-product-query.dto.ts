import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsUUID } from "class-validator";
import {
  AdminListQueryDto,
  parseAdminBoolean,
} from "../../common/dto/admin-list-query.dto";

export class AdminProductQueryDto extends AdminListQueryDto {
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional()
  @IsIn(["IN_STOCK", "OUT_OF_STOCK", "PREORDER", "ON_REQUEST"])
  availability?: "IN_STOCK" | "OUT_OF_STOCK" | "PREORDER" | "ON_REQUEST";
  @IsOptional() @Transform(parseAdminBoolean) @IsBoolean() featured?: boolean;
  @IsOptional() @Transform(parseAdminBoolean) @IsBoolean() isNew?: boolean;
  @IsIn(["order", "updated", "name", "priceAsc", "priceDesc"])
  override sort: string = "order";
}
