export interface StoredProductVideo {
  desktopKey: string;
  mobileKey: string;
  durationSeconds: number;
  sizeBytes: number;
  mobileSizeBytes: number;
}

export function productVideoMetadata(video?: StoredProductVideo | null) {
  return video
    ? {
        url: `/api/v1/media/${video.desktopKey}`,
        mobileUrl: `/api/v1/media/${video.mobileKey}`,
        mimeType: "video/mp4" as const,
        durationSeconds: video.durationSeconds,
        sizeBytes: video.sizeBytes,
        mobileSizeBytes: video.mobileSizeBytes,
      }
    : null;
}
