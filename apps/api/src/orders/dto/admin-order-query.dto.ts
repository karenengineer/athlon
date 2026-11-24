import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

const parseInteger = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" && /^[0-9]+$/.test(value) ? Number(value) : value;

export const ADMIN_ORDER_FILTERS = ["TO_DELIVER", "DELIVERED", "ALL"] as const;
export type AdminOrderFilter = (typeof ADMIN_ORDER_FILTERS)[number];

export class AdminOrderQueryDto {
  @IsOptional() @IsIn(ADMIN_ORDER_FILTERS) filter: AdminOrderFilter =
    "TO_DELIVER";
  @Transform(parseInteger) @IsInt() @Min(1) @Max(100_000) page = 1;
  @Transform(parseInteger) @IsInt() @Min(1) @Max(100) pageSize = 25;
}
