import { Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import type {
  PostGoogleLoginBody,
  PostGoogleLogin200Response,
  GetProfile200Response,
  PostLoginBody,
  PostLogin200Response,
  PostRefreshTokenBody,
  PostRefreshToken200Response,
  PostRegisterBody,
  PostRegister200Response,
  PostVerifyEmailBody,
  PostVerifyEmail200Response,
  PostResendVerificationBody,
  PostResendVerification200Response,
} from '@e-commerce/api-validation/types/auth';
import { BaseAuthControllerInterface } from '@generated-controller/auth/auth/base-auth.controller.interface';

@Injectable()
export class AuthController implements BaseAuthControllerInterface {
  constructor(
    private readonly service: AuthService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  /** POST /auth/google */
  async postGoogleLogin(
    body: PostGoogleLoginBody,
  ): Promise<PostGoogleLogin200Response> {
    return this.googleAuth.postGoogleLogin(body);
  }

  /**
   * GET /auth/profile
   */
  async getProfile(): Promise<GetProfile200Response> {
    return await this.service.getProfile();
  }

  /**
   * POST /auth/login
   */
  async postLogin(body: PostLoginBody): Promise<PostLogin200Response> {
    return await this.service.postLogin(body);
  }

  /**
   * POST /auth/refresh
   */
  async postRefreshToken(
    body: PostRefreshTokenBody,
  ): Promise<PostRefreshToken200Response> {
    return await this.service.postRefreshToken(body);
  }

  /**
   * POST /auth/register
   */
  async postRegister(body: PostRegisterBody): Promise<PostRegister200Response> {
    return await this.service.postRegister(body);
  }

  /**
   * POST /auth/verify-email
   */
  async postVerifyEmail(
    body: PostVerifyEmailBody,
  ): Promise<PostVerifyEmail200Response> {
    return await this.service.postVerifyEmail(body);
  }

  /**
   * POST /auth/resend-verification
   */
  async postResendVerification(
    body: PostResendVerificationBody,
  ): Promise<PostResendVerification200Response> {
    return await this.service.postResendVerification(body);
  }
}
