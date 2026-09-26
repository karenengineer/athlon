import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";
import { SalesChannel } from "../../../generated/prisma/client";
import { FinanceListQueryDto } from "../../common/finance-list-query.dto";

export class SaleListQueryDto extends FinanceListQueryDto {
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
  @IsOptional() @IsEnum(SalesChannel) channel?: SalesChannel;
  @IsOptional()
  @IsString()
  @MaxLength(100)
  trainerReferralCode?: string;
  @IsIn([
    "dateDesc",
    "dateAsc",
    "revenueDesc",
    "revenueAsc",
    "profitDesc",
    "profitAsc",
  ])
  sort:
    | "dateDesc"
    | "dateAsc"
    | "revenueDesc"
    | "revenueAsc"
    | "profitDesc"
    | "profitAsc" = "dateDesc";
}
