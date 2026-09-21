import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsUUID } from "class-validator";
import { parseAdminBoolean } from "../../../common/dto/admin-list-query.dto";
import { FinanceListQueryDto } from "../../common/finance-list-query.dto";

export class RecurringExpenseListQueryDto extends FinanceListQueryDto {
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @Transform(parseAdminBoolean) @IsBoolean() active?: boolean;
  @IsIn(["name", "startDesc", "updated"])
  sort: "name" | "startDesc" | "updated" = "name";
}
