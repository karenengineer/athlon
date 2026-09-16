import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  MinLength,
} from "class-validator";

export class BrandTranslationDto {
  @IsIn(["HY", "RU", "EN"]) locale!: "HY" | "RU" | "EN";
  @IsString() @MinLength(1) @MaxLength(180) @Matches(/\S/) name!: string;
  @IsOptional() @IsString() description?: string | null;
}
