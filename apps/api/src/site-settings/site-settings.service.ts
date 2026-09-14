import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

export const PUBLIC_SETTING_KEYS = [
  "phone",
  "email",
  "instagram",
  "facebook",
  "whatsapp",
] as const;

@Injectable()
export class SiteSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async publicSettings(): Promise<Record<string, string>> {
    const settings = await this.prisma.siteSetting.findMany({
      where: {
        public: true,
        key: { in: [...PUBLIC_SETTING_KEYS] },
        value: { not: null },
      },
      select: { key: true, value: true },
    });
    return Object.fromEntries(
      settings
        .filter((setting) => setting.value)
        .map((setting) => [setting.key, setting.value!]),
    );
  }

  async adminSettings(): Promise<Record<string, string | null>> {
    const settings = await this.prisma.siteSetting.findMany({
      where: { key: { in: [...PUBLIC_SETTING_KEYS] } },
      select: { key: true, value: true },
    });
    return Object.fromEntries(
      settings.map((setting) => [setting.key, setting.value]),
    );
  }

  async update(
    settings: Record<string, string | null>,
  ): Promise<Record<string, string | null>> {
    const keys = Object.keys(settings);
    if (
      keys.some(
        (key) => !(PUBLIC_SETTING_KEYS as readonly string[]).includes(key),
      )
    ) {
      throw new BadRequestException("Unknown site-setting key");
    }
    await Promise.all(
      keys.map((key) =>
        this.prisma.siteSetting.upsert({
          where: { key },
          create: { key, value: settings[key] ?? null, public: true },
          update: { value: settings[key] ?? null },
        }),
      ),
    );
    return this.adminSettings();
  }
}
