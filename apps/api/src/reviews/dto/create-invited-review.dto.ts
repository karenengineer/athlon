import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** A review sent through the buyer's personal review link. */
export class CreateInvitedReviewDto {
  @IsUUID() productId!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) authorName!: string;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(2000) body!: string;
  @IsIn(["hy", "ru", "en", "HY", "RU", "EN"]) locale!: string;
}
