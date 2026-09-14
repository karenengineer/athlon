import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

  async delete(key: string): Promise<void> {
    await rm(this.safePath(key), { force: true });
  }

  publicUrl(key: string): string {
    this.safePath(key);
    return `/api/v1/media/${key}`;
  }

  private safePath(key: string): string {
    if (!/^[0-9a-f-]+-(original|thumbnail|card|detail)\.webp$/.test(key)) {
      throw new BadRequestException("Invalid storage key");
    }
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}${sep}`))
      throw new BadRequestException("Invalid storage key");
    return path;
  }
}
