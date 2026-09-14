import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CsrfGuard } from "./csrf.guard";

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AdminAuthGuard, CsrfGuard],
  exports: [JwtModule, AdminAuthGuard, CsrfGuard],
})
export class AuthModule {}
