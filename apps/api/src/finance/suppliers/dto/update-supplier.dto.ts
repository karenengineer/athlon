import { PartialType } from "@nestjs/swagger";
import { CreateSupplierDto } from "./create-supplier.dto";

export class UpdateSupplierDto extends PartialType(CreateSupplierDto, {
  skipNullProperties: false,
}) {
  override active?: boolean = undefined;
}
