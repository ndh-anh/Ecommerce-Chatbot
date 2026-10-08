import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { PrismaService } from '@/common/services/prisma.service';
import { JwtService } from '@/api/v1/auth/services/jwt-service/jwt.service';
import type {
  PostGoogleLoginBody,
  PostGoogleLogin200Response,
} from '@e-commerce/api-validation/types/auth';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class GoogleAuthService {
  private readonly client = new OAuth2Client();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Verify Google's signed identity token before resolving an account and issuing application tokens. */
  async postGoogleLogin(
    body: PostGoogleLoginBody,
  ): Promise<PostGoogleLogin200Response> {
    const audience = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!audience || audience.startsWith('replace-me')) {
      throw new BadRequestException('Đăng nhập Google chưa được cấu hình.');
    }
    let identity: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: body.idToken,
        audience,
      });
      identity = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(
        'Thông tin đăng nhập Google không hợp lệ hoặc đã hết hạn.',
      );
    }
    if (!identity?.sub || !identity.email || identity.email_verified !== true) {
      throw new UnauthorizedException('Tài khoản Google chưa xác thực email.');
    }
    const user = await this.resolveAccount(identity);
    if (user.is_active !== true || user.is_deleted === true) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa.');
    }
    const payload = {
      sub: user.uid,
      email: user.email,
      roles: user.user_roles.map((role) => String(role.role_id)),
    };
    return {
      accessToken: await this.jwt.generateAccessToken(payload),
      refreshToken: await this.jwt.generateRefreshToken(payload),
    };
  }

  /** Keep Google subject as the identity key; never silently link an existing password account by email. */
  private async resolveAccount(
    identity: TokenPayload,
  ): Promise<NonNullable<typeof existing>['users']> {
    const existing = await this.prisma.google_accounts.findUnique({
      where: { google_sub: identity.sub },
      include: { users: { include: { user_roles: true } } },
    });
    if (existing) return existing.users;
    const email = identity.email!.toLowerCase();
    const password = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const duplicate = await tx.users.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });
        if (duplicate)
          throw new BadRequestException(
            'Email này đã có tài khoản. Vui lòng đăng nhập bằng mật khẩu.',
          );
        const role = await tx.roles.findUnique({
          where: { role_name: 'USER' },
        });
        if (!role)
          throw new InternalServerErrorException('Default role not found');
        return tx.users.create({
          data: {
            uid: randomUUID(),
            email,
            username: `google_${randomUUID()}`,
            password,
            full_name: identity.name?.slice(0, 255),
            is_email_verified: true,
            is_active: true,
            is_deleted: false,
            created_at: new Date(),
            google_account: { create: { google_sub: identity.sub } },
            user_roles: { create: { role_id: role.role_id } },
          },
          include: { user_roles: true },
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        // Concurrent first sign-ins may both try to create the same identity.
        const winner = await this.prisma.google_accounts.findUnique({
          where: { google_sub: identity.sub },
          include: { users: { include: { user_roles: true } } },
        });
        if (winner) return winner.users;
        throw new BadRequestException(
          'Email này đã có tài khoản. Vui lòng đăng nhập bằng mật khẩu.',
        );
      }
      throw error;
    }
  }
}
