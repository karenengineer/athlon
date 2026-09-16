import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  MinLength,
} from "class-validator";

export class CategoryTranslationDto {
  @IsIn(["HY", "RU", "EN"])
  locale!: "HY" | "RU" | "EN";
  @IsString() @MinLength(1) @MaxLength(180) @Matches(/\S/) name!: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() @MaxLength(180) seoTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(320) seoDescription?: string | null;
}
