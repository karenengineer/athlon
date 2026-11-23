import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

const parseInteger = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" && /^[0-9]+$/.test(value) ? Number(value) : value;

export class AdminReviewQueryDto {
  @IsOptional() @IsIn(["PENDING", "APPROVED", "REJECTED"]) status?:
    | "PENDING"
    | "APPROVED"
    | "REJECTED";
  @Transform(parseInteger) @IsInt() @Min(1) @Max(100_000) page = 1;
  @Transform(parseInteger) @IsInt() @Min(1) @Max(100) pageSize = 24;
}
