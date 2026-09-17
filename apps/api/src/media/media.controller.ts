import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { CsrfGuard } from "../auth/csrf.guard";
import { ReorderImagesDto } from "./dto/reorder-images.dto";
import { UpdateImageDto } from "./dto/update-image.dto";
import { UploadImageFieldsDto } from "./dto/upload-image-fields.dto";
import { MediaService } from "./media.service";

@ApiTags("media")
@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get("media/:filename")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", "public, max-age=31536000, immutable")
  async read(@Param("filename") filename: string): Promise<StreamableFile> {
    return new StreamableFile(await this.media.read(filename));
  }

  @Post("admin/products/:productId/images")
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5_242_880, files: 1 } }),
  )
  @ApiConsumes("multipart/form-data")
  upload(
    @Param("productId", ParseUUIDPipe) productId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() fields: UploadImageFieldsDto,
  ): Promise<unknown> {
    return this.media.upload(productId, file, fields);
  }

  @Patch("admin/products/:productId/images/order")
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @HttpCode(204)
  reorder(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() input: ReorderImagesDto,
  ): Promise<void> {
    return this.media.reorder(productId, input);
  }

  @Patch("admin/products/:productId/images/:imageId")
  @UseGuards(AdminAuthGuard, CsrfGuard)
  update(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @Body() input: UpdateImageDto,
  ): Promise<unknown> {
    return this.media.update(productId, imageId, input);
  }

  @Delete("admin/products/:productId/images/:imageId")
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @HttpCode(204)
  delete(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    return this.media.delete(productId, imageId);
  }
}
