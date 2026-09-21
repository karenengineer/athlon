import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional } from "class-validator";
import { parseAdminBoolean } from "../../../common/dto/admin-list-query.dto";
import { FinanceListQueryDto } from "../../common/finance-list-query.dto";

export class SupplierListQueryDto extends FinanceListQueryDto {
  @IsOptional() @Transform(parseAdminBoolean) @IsBoolean() active?: boolean;
  @IsIn(["name", "updated"]) sort: "name" | "updated" = "name";
}
