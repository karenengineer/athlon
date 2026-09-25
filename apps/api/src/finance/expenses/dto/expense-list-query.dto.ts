import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  IsUUID,
  Matches,
} from "class-validator";
import { ExpenseSource } from "../../../generated/prisma/enums";
import { FinanceListQueryDto } from "../../common/finance-list-query.dto";

export class ExpenseListQueryDto extends FinanceListQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateFrom?: string;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateTo?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsEnum(ExpenseSource) source?: ExpenseSource;
  @IsOptional() @IsString() @MaxLength(100) paymentMethod?: string;
  @IsIn(["dateDesc", "dateAsc", "amountDesc", "amountAsc"])
  sort: "dateDesc" | "dateAsc" | "amountDesc" | "amountAsc" = "dateDesc";
}
