import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/services/prisma.service';
import { JwtService } from '@/api/v1/auth/services/jwt-service/jwt.service';

const verifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken })),
}));
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('random-password-hash'),
}));

const identity = {
  sub: 'google-123',
  email: 'User@gmail.com',
  email_verified: true,
  name: 'Google User',
};
const user = {
  uid: 'uid',
  email: 'user@gmail.com',
  is_active: true,
  is_deleted: false,
  user_roles: [{ role_id: 'user-role' }],
};

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let prisma: any;
  let jwt: any;
  let config: any;
  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      google_accounts: { findUnique: jest.fn().mockResolvedValue(null) },
      users: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(user),
      },
      roles: {
        findUnique: jest.fn().mockResolvedValue({ role_id: 'user-role' }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    jwt = {
      generateAccessToken: jest.fn().mockResolvedValue('access'),
      generateRefreshToken: jest.fn().mockResolvedValue('refresh'),
    };
    config = {
      get: jest.fn().mockReturnValue('client.apps.googleusercontent.com'),
    };
    service = new GoogleAuthService(
      config as ConfigService,
      prisma as PrismaService,
      jwt as JwtService,
    );
    verifyIdToken.mockResolvedValue({ getPayload: () => identity });
  });
  it('validates the configured audience and creates a verified USER account atomically', async () => {
    await expect(
      service.postGoogleLogin({ idToken: 'credential' }),
    ).resolves.toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'credential',
      audience: 'client.apps.googleusercontent.com',
    });
    expect(prisma.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'user@gmail.com',
          is_email_verified: true,
          password: 'random-password-hash',
          google_account: { create: { google_sub: 'google-123' } },
          user_roles: { create: { role_id: 'user-role' } },
        }),
      }),
    );
    expect(jwt.generateAccessToken).toHaveBeenCalledWith({
      sub: 'uid',
      email: user.email,
      roles: ['user-role'],
    });
  });
  it('uses the Google subject even when Google changes the email', async () => {
    prisma.google_accounts.findUnique.mockResolvedValue({ users: user });
    await service.postGoogleLogin({ idToken: 'credential' });
    expect(prisma.google_accounts.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { google_sub: identity.sub } }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects invalid, expired or wrong-audience tokens before any database operation', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));
    await expect(
      service.postGoogleLogin({ idToken: 'invalid' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.google_accounts.findUnique).not.toHaveBeenCalled();
    expect(jwt.generateAccessToken).not.toHaveBeenCalled();
  });
  it.each([
    { ...identity, email_verified: false },
    { ...identity, sub: '' },
    { ...identity, email: undefined },
  ])('rejects incomplete or unverified identities', async (payload) => {
    verifyIdToken.mockResolvedValue({ getPayload: () => payload });
    await expect(
      service.postGoogleLogin({ idToken: 'credential' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('does not silently link an existing password account by email', async () => {
    prisma.users.findFirst.mockResolvedValue(user);
    await expect(
      service.postGoogleLogin({ idToken: 'credential' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.users.create).not.toHaveBeenCalled();
    expect(jwt.generateAccessToken).not.toHaveBeenCalled();
  });
  it.each([
    { ...user, is_active: false },
    { ...user, is_deleted: true },
  ])('rejects disabled and deleted accounts', async (blocked) => {
    prisma.google_accounts.findUnique.mockResolvedValue({ users: blocked });
    await expect(
      service.postGoogleLogin({ idToken: 'credential' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(jwt.generateAccessToken).not.toHaveBeenCalled();
  });
  it('reuses the identity created by a concurrent first sign-in', async () => {
    prisma.google_accounts.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ users: user });
    prisma.users.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.postGoogleLogin({ idToken: 'credential' }),
    ).resolves.toEqual({ accessToken: 'access', refreshToken: 'refresh' });
  });
  it('does not fall back to an email match after a unique-key conflict', async () => {
    prisma.users.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.postGoogleLogin({ idToken: 'credential' }),
    ).rejects.toThrow(BadRequestException);
    expect(jwt.generateAccessToken).not.toHaveBeenCalled();
  });
  it('fails clearly when only a placeholder client ID is configured', async () => {
    config.get.mockReturnValue('replace-me.apps.googleusercontent.com');
    await expect(
      service.postGoogleLogin({ idToken: 'credential' }),
    ).rejects.toThrow(BadRequestException);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});
