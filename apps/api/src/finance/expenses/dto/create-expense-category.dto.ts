import {
  IsBoolean,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class CreateExpenseCategoryDto {
  @IsString() @MaxLength(180) @Matches(/\S/) name!: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active = true;
}
