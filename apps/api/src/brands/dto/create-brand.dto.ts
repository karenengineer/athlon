import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { BrandTranslationDto } from "./brand-translation.dto";

export class CreateBrandDto {
  @IsString()
  @MaxLength(160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
  @IsString() @MaxLength(180) name!: string;
  @IsOptional() @IsString() @MaxLength(500) logoKey?: string | null;
  @IsOptional() @IsBoolean() published = true;
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BrandTranslationDto)
  translations!: BrandTranslationDto[];
}
