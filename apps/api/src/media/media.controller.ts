import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Inject,
  Put,
  Res,
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
import { Response } from "express";
import { STORAGE_ADAPTER, StorageAdapter } from "../storage/storage-adapter";
import { ProductVideoService } from "./product-video.service";
import { MAX_VIDEO_BYTES } from "./video-processor";
import { videoByteRange } from "./video-range";
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
  constructor(
    private readonly media: MediaService,
    private readonly videos: ProductVideoService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  @Get("media/:filename")
  @Header("Cache-Control", "public, max-age=31536000, immutable")
  async read(
    @Param("filename") filename: string,
    @Headers("range") range: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    if (!filename.endsWith(".mp4"))
      return new StreamableFile(await this.media.read(filename), {
        type: "image/webp",
      });
    const { size } = await this.storage.stat(filename);
    response.setHeader("Accept-Ranges", "bytes");
    const requested = videoByteRange(range, size);
    if (requested === false) {
      response.status(416).setHeader("Content-Range", `bytes */${size}`);
      return new StreamableFile(Buffer.alloc(0), {
        type: "video/mp4",
        length: 0,
      });
    }
    if (requested) {
      response
        .status(206)
        .setHeader(
          "Content-Range",
          `bytes ${requested.start}-${requested.end}/${size}`,
        );
    }
    return new StreamableFile(
      this.storage.stream(filename, requested ?? undefined),
      {
        type: "video/mp4",
        length: requested ? requested.end - requested.start + 1 : size,
      },
    );
  }

  @Put("admin/products/:productId/video")
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_VIDEO_BYTES, files: 1, fields: 0 },
    }),
  )
  @ApiConsumes("multipart/form-data")
  uploadVideo(
    @Param("productId", ParseUUIDPipe) productId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.videos.upload(productId, file);
  }

  @Delete("admin/products/:productId/video")
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @HttpCode(204)
  deleteVideo(@Param("productId", ParseUUIDPipe) productId: string) {
    return this.videos.remove(productId);
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
