import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import { StorageAdapter } from "./storage-adapter";

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly root: string;

  constructor(config: ConfigService) {
    const configured = config.get<string>("UPLOAD_DIR", "./uploads");
    this.root = isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.safePath(key);
    await mkdir(this.root, { recursive: true });
    await writeFile(path, data, { flag: "wx" });
  }

  async read(key: string): Promise<Buffer> {
    try {
      return await readFile(this.safePath(key));
    } catch {
      throw new NotFoundException("Media not found");
    }
  }

  async stat(key: string): Promise<{ size: number }> {
    const path = this.safePath(key);
    try {
      const file = await stat(path);
      if (!file.isFile()) throw new Error("Not a file");
      return { size: file.size };
    } catch {
      throw new NotFoundException("Media not found");
    }
  }

  stream(key: string, range?: { start: number; end: number }) {
    return createReadStream(this.safePath(key), range);
  }

  async delete(key: string): Promise<void> {
    await rm(this.safePath(key), { force: true });
  }

  publicUrl(key: string): string {
    this.safePath(key);
    return `/api/v1/media/${key}`;
  }

  private safePath(key: string): string {
    if (
      !/^[0-9a-f-]+-(original|thumbnail|card|detail)\.webp$/.test(key) &&
      !/^[0-9a-f-]+-preview-(desktop|mobile)\.mp4$/.test(key)
    ) {
      throw new BadRequestException("Invalid storage key");
    }
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}${sep}`))
      throw new BadRequestException("Invalid storage key");
    return path;
  }
}
