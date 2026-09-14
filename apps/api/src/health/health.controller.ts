import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../database/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("live")
  live(): { status: "ok" } {
    return { status: "ok" };
  }

  @Get("ready")
  async ready(): Promise<{ status: "ok" }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch {
      throw new ServiceUnavailableException("Database is unavailable");
    }
  }
}
