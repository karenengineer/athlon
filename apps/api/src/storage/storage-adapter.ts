import { Readable } from "node:stream";

export const STORAGE_ADAPTER = Symbol("STORAGE_ADAPTER");

export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  stat(key: string): Promise<{ size: number }>;
  stream(key: string, range?: { start: number; end: number }): Readable;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}
