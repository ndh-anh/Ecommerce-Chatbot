import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@/common/guards/auth.guard';
import { ClsService } from '@/common/services/cls/cls.service';
import { JwtService } from '@/api/v1/auth/services/jwt-service/jwt.service';
import { BaseSearchController } from '../../../../../generated-controller/product/search/base-search.controller';
import { BaseProductsController } from '../../../../../generated-controller/product/products/base-products.controller';

jest.mock('@/api/v1/auth/services/jwt-service/jwt.service', () => ({
  JwtService: jest.fn(),
}));
// Schema validation is independent of this authorization regression test.
jest.mock('@e-commerce/api-validation/zod/product', () => ({}));

describe('Search endpoint authorization', () => {
  const jwt = { extractAccessTokenPayload: jest.fn() };
  const guard = new AuthGuard(
    jwt as unknown as JwtService,
    new Reflector(),
    new ClsService(),
  );

  function context(
    controller: typeof BaseSearchController | typeof BaseProductsController,
    handler:
      | typeof BaseSearchController.prototype.searchProducts
      | typeof BaseProductsController.prototype.getProducts,
    headers = {},
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => jest.clearAllMocks());

  it('allows guests to search without attempting token verification', async () => {
    await expect(
      guard.canActivate(
        context(
          BaseSearchController,
          BaseSearchController.prototype.searchProducts,
        ),
      ),
    ).resolves.toBe(true);
    expect(jwt.extractAccessTokenPayload).not.toHaveBeenCalled();
  });

  it('keeps public search accessible with a stale browser token', async () => {
    jwt.extractAccessTokenPayload.mockRejectedValue(
      new UnauthorizedException('Expired token'),
    );
    await expect(
      guard.canActivate(
        context(
          BaseSearchController,
          BaseSearchController.prototype.searchProducts,
          { authorization: 'Bearer expired' },
        ),
      ),
    ).resolves.toBe(true);
    expect(jwt.extractAccessTokenPayload).not.toHaveBeenCalled();
  });

  it('continues to require authentication for the administrative product list', async () => {
    await expect(
      guard.canActivate(
        context(
          BaseProductsController,
          BaseProductsController.prototype.getProducts,
        ),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('continues to reject an invalid token on a protected endpoint', async () => {
    jwt.extractAccessTokenPayload.mockRejectedValue(
      new UnauthorizedException('Expired token'),
    );
    await expect(
      guard.canActivate(
        context(
          BaseProductsController,
          BaseProductsController.prototype.getProducts,
          { authorization: 'Bearer expired' },
        ),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(jwt.extractAccessTokenPayload).toHaveBeenCalledWith('expired');
  });
});
