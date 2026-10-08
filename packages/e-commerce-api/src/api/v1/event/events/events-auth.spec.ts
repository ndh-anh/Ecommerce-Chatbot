import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@/common/guards/auth.guard';
import { PoliciesGuard } from '@/common/guards/policies.guard';
import { CaslAbilityFactory } from '@/common/casl/casl-ability.factory';
import { ClsService } from '@/common/services/cls/cls.service';
import { JwtService } from '@/api/v1/auth/services/jwt-service/jwt.service';
import { PrismaService } from '@/common/services/prisma.service';
import { BaseEventsController } from '../../../../../generated-controller/event/events/base-events.controller';
jest.mock('@e-commerce/api-validation/zod/event', () => ({}));
const adminMethods = [
  'getEvents',
  'getEventById',
  'postEvent',
  'patchEvent',
  'deleteEvent',
] as const;
const publicMethods = [
  'getPublicEvents',
  'getCarouselEvents',
  'getEventBySlug',
] as const;
function context(
  method: (typeof adminMethods)[number] | (typeof publicMethods)[number],
  roles: string[] = [],
): ExecutionContext {
  return {
    getHandler: () => BaseEventsController.prototype[method],
    getClass: () => BaseEventsController,
    switchToHttp: () => ({
      getRequest: () => ({ headers: {}, payload: { roles } }),
    }),
  } as unknown as ExecutionContext;
}
describe('Event endpoint authorization', () => {
  const reflector = new Reflector();
  const jwt = { extractAccessTokenPayload: jest.fn() };
  const auth = new AuthGuard(
    jwt as unknown as JwtService,
    reflector,
    new ClsService(),
  );
  const prisma = {
    permissions: {
      findMany: jest.fn(
        ({
          where,
        }: {
          where: { role_permissions: { some: { role_id: { in: string[] } } } };
        }) =>
          Promise.resolve(
            where.role_permissions.some.role_id.in.includes('admin')
              ? ['read', 'create', 'update', 'delete'].map((action) => ({
                  action,
                  subject: 'Event',
                }))
              : [{ action: 'read', subject: 'Product' }],
          ),
      ),
    },
  };
  const policies = new PoliciesGuard(
    reflector,
    new CaslAbilityFactory(prisma as unknown as PrismaService),
  );
  it.each(publicMethods)('%s allows guests without a token', async (method) => {
    await expect(auth.canActivate(context(method))).resolves.toBe(true);
  });
  it.each(adminMethods)('%s requires authentication', async (method) => {
    await expect(auth.canActivate(context(method))).rejects.toThrow(
      UnauthorizedException,
    );
  });
  it.each(adminMethods)('%s rejects ordinary users', async (method) => {
    await expect(policies.canActivate(context(method, ['user']))).resolves.toBe(
      false,
    );
  });
  it.each(adminMethods)(
    '%s accepts administrators with Event permissions',
    async (method) => {
      await expect(
        policies.canActivate(context(method, ['admin'])),
      ).resolves.toBe(true);
    },
  );
});
