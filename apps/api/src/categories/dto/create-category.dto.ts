import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { CategoryTranslationDto } from "./category-translation.dto";

export class CreateCategoryDto {
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  code!: string;
  @IsString()
  @MaxLength(160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsBoolean() published = true;
  @IsOptional() @IsInt() displayOrder = 0;
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationDto)
  translations!: CategoryTranslationDto[];
}
