import { videoByteRange } from "./video-range";

describe("video byte ranges", () => {
  it("serves full files, bounded, open and suffix ranges", () => {
    expect(videoByteRange(undefined, 100)).toBeNull();
    expect(videoByteRange("bytes=5-12", 100)).toEqual({ start: 5, end: 12 });
    expect(videoByteRange("bytes=95-", 100)).toEqual({ start: 95, end: 99 });
    expect(videoByteRange("bytes=-5", 100)).toEqual({ start: 95, end: 99 });
    expect(videoByteRange("bytes=95-200", 100)).toEqual({ start: 95, end: 99 });
    expect(videoByteRange("bytes=-200", 100)).toEqual({ start: 0, end: 99 });
  });

  it.each([
    "bytes=",
    "bytes=-0",
    "bytes=100-",
    "bytes=9-2",
    "bytes=0-1,5-9",
    "bytes=9007199254740993-",
    "items=0-1",
  ])("rejects malformed or unsatisfiable %s", (header) => {
    expect(videoByteRange(header, 100)).toBe(false);
  });
});
