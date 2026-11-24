import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

export class CreateReviewDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) authorName!: string;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(2000) body!: string;
  @IsIn(["hy", "ru", "en", "HY", "RU", "EN"]) locale!: string;
  /** Honeypot: hidden from people, so any value marks the request as spam. */
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}
