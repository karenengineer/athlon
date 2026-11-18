import { BadRequestException } from "@nestjs/common";
import {
  MAX_VIDEO_BYTES,
  validateVideoMetadata,
  VideoProcessor,
} from "./video-processor";

const valid = {
  format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "3.0" },
  streams: [{ codec_type: "video", width: 720, height: 720, duration: "3.0" }],
};

describe("video content bounds", () => {
  it("accepts short MP4 and WebM content and the exact duration boundary", () => {
    expect(validateVideoMetadata(valid, "video/mp4")).toBe(3);
    expect(
      validateVideoMetadata(
        {
          ...valid,
          format: { format_name: "matroska,webm", duration: "15.0" },
        },
        "video/webm",
      ),
    ).toBe(15);
  });
  it.each([
    { ...valid, format: { format_name: "hls", duration: "3.0" } },
    { ...valid, format: { ...valid.format, duration: "15.01" } },
    { ...valid, format: { ...valid.format, duration: "NaN" } },
    { ...valid, format: { ...valid.format, duration: "0" } },
    { ...valid, streams: [{ codec_type: "audio" }] },
    { ...valid, streams: [{ ...valid.streams[0]!, width: 8192 }] },
    {
      ...valid,
      streams: [{ ...valid.streams[0]!, width: 4096, height: 4096 }],
    },
    { ...valid, streams: [{ ...valid.streams[0]!, duration: "18" }] },
  ])(
    "rejects untrusted containers, durations, dimensions and non-video inputs",
    (metadata) => {
      expect(() => validateVideoMetadata(metadata, "video/mp4")).toThrow(
        BadRequestException,
      );
    },
  );
  it("rejects missing, unsupported and oversized files before starting a processor", async () => {
    const processor = new VideoProcessor();
    await expect(processor.process(undefined)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      processor.process({
        mimetype: "text/plain",
        buffer: Buffer.from("x"),
      } as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
    await expect(
      processor.process({
        mimetype: "video/mp4",
        buffer: Buffer.alloc(MAX_VIDEO_BYTES + 1),
      } as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
  });
});
