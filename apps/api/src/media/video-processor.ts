import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 15;

@Injectable()
export class VideoProcessor {
  private processing = false;

  async process(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("Video file is required");
    if (!["video/mp4", "video/webm"].includes(file.mimetype))
      throw new BadRequestException("Upload an MP4 or WebM video");
    if (!file.buffer?.length || file.buffer.length > MAX_VIDEO_BYTES)
      throw new BadRequestException("Video must be at most 20 MiB");
    if (this.processing)
      throw new ServiceUnavailableException(
        "Another video is processing; retry shortly",
      );
    this.processing = true;
    let directory: string | undefined;
    try {
      directory = await mkdtemp(join(tmpdir(), "athlon-video-"));
      const input = join(directory, "input");
      await writeFile(input, file.buffer, { mode: 0o600 });
      const { stdout } = await execute(
        "ffprobe",
        [
          "-v",
          "error",
          "-protocol_whitelist",
          "file",
          "-format_whitelist",
          "mov,matroska,webm",
          "-show_entries",
          "format=format_name,duration:stream=codec_type,width,height,duration",
          "-of",
          "json",
          input,
        ],
        { timeout: 10_000, maxBuffer: 128 * 1024 },
      );
      const durationSeconds = validateVideoMetadata(
        JSON.parse(stdout),
        file.mimetype,
      );
      const desktop = await this.encode(
        input,
        join(directory, "desktop.mp4"),
        720,
        25,
      );
      const mobile = await this.encode(
        input,
        join(directory, "mobile.mp4"),
        360,
        31,
      );
      return { desktop, mobile, durationSeconds };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
        throw new ServiceUnavailableException(
          "Video processing is temporarily unavailable",
        );
      throw new BadRequestException(
        "Video could not be processed; upload a valid MP4 or WebM up to 15 seconds",
      );
    } finally {
      try {
        if (directory) await rm(directory, { recursive: true, force: true });
      } finally {
        this.processing = false;
      }
    }
  }

  private async encode(
    input: string,
    output: string,
    size: number,
    quality: number,
  ) {
    await execute(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-xerror",
        "-max_alloc",
        "67108864",
        "-threads",
        "1",
        "-protocol_whitelist",
        "file",
        "-format_whitelist",
        "mov,matroska,webm",
        "-i",
        input,
        "-t",
        String(MAX_VIDEO_SECONDS),
        "-map",
        "0:v:0",
        "-an",
        "-sn",
        "-dn",
        "-map_metadata",
        "-1",
        "-vf",
        `scale=w='min(${size},iw)':h='min(${size},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1`,
        "-r",
        "24",
        "-c:v",
        "libx264",
        "-threads",
        "1",
        "-filter_threads",
        "1",
        "-preset",
        "veryfast",
        "-crf",
        String(quality),
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-fs",
        String(MAX_VIDEO_BYTES + 1),
        output,
      ],
      { timeout: 45_000, maxBuffer: 128 * 1024 },
    );
    const { size: bytes } = await stat(output);
    if (!bytes || bytes >= MAX_VIDEO_BYTES)
      throw new BadRequestException("Encoded video is too large");
    return readFile(output);
  }
}

type VideoProbe = {
  format?: { format_name?: string; duration?: string };
  streams?: Array<{
    codec_type?: string;
    width?: number;
    height?: number;
    duration?: string;
  }>;
};

export function validateVideoMetadata(
  metadata: VideoProbe,
  mimeType: string,
): number {
  const durationSeconds = Number(metadata.format?.duration);
  const stream = metadata.streams?.find((item) => item.codec_type === "video");
  const durationValues = [
    durationSeconds,
    ...(metadata.streams ?? []).flatMap((item) =>
      item.duration ? [Number(item.duration)] : [],
    ),
  ];
  const format = metadata.format?.format_name ?? "";
  const validContainer =
    mimeType === "video/mp4"
      ? format.split(",").includes("mp4")
      : format.split(",").includes("webm");
  if (
    !validContainer ||
    !stream ||
    !stream.width ||
    !stream.height ||
    stream.width < 2 ||
    stream.height < 2 ||
    stream.width > 4096 ||
    stream.height > 4096 ||
    stream.width * stream.height > 8_294_400 ||
    durationValues.some(
      (duration) =>
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > MAX_VIDEO_SECONDS,
    )
  ) {
    throw new BadRequestException(
      "Video must contain valid video content lasting at most 15 seconds",
    );
  }

  return durationSeconds;
}
