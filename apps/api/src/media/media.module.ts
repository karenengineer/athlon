import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { MediaController } from "./media.controller";
import { VideoProcessor } from "./video-processor";
import { ProductVideoService } from "./product-video.service";
import { MediaService } from "./media.service";

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [MediaController],
  providers: [MediaService, ProductVideoService, VideoProcessor],
})
export class MediaModule {}
