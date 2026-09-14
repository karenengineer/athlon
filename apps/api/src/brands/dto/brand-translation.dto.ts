import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class BrandTranslationDto {
  @IsIn(["HY", "RU", "EN"]) locale!: "HY" | "RU" | "EN";
  @IsString() @MinLength(1) @MaxLength(180) name!: string;
  @IsOptional() @IsString() description?: string | null;
}
