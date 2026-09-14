import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

class ImagePositionDto {
  @IsUUID() id!: string;
  @IsInt() @Min(0) position!: number;
}

export class ReorderImagesDto {
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImagePositionDto)
  images!: ImagePositionDto[];
}
