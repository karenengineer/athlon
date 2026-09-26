import {
  IsDateString,
  IsIn,
  IsOptional,
  IsUUID,
  Matches,
} from "class-validator";
import { FinanceListQueryDto } from "../../common/finance-list-query.dto";

export class PurchaseListQueryDto extends FinanceListQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateFrom?: string;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateTo?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsIn(["dateDesc", "dateAsc", "totalDesc", "totalAsc"])
  sort: "dateDesc" | "dateAsc" | "totalDesc" | "totalAsc" = "dateDesc";
}
