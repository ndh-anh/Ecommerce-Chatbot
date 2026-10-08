import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import {
  AUTH_CONTROLLER,
  BaseAuthController,
} from '@generated-controller/auth/auth/base-auth.controller';
import { UsersModule } from '@/api/v1/auth/services/user-service/users.module';
import { MailModule } from '@/common/services/mail/mail.module';
import { PrismaModule } from '@/common/services/prisma.module';

@Module({
  imports: [UsersModule, MailModule, PrismaModule],
  controllers: [BaseAuthController],
  providers: [
    AuthService,
    GoogleAuthService,
    {
      provide: AUTH_CONTROLLER,
      useClass: AuthController,
    },
  ],
})
export class AuthModule {}
