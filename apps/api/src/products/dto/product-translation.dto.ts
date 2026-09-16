import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  MinLength,
} from "class-validator";

export class ProductTranslationDto {
  @IsIn(["HY", "RU", "EN"])
  locale!: "HY" | "RU" | "EN";

  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(220)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescription?: string | null;
}
