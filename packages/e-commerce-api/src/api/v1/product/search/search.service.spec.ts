import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProductServiceClient } from '@/buf/generated/product/v1/product';
import { SearchService } from './search.service';
import type { PrismaService } from '@/common/services/prisma.service';

jest.mock('@/buf/generated/product/v1/product', () => ({
  ProductServiceClient: jest.fn(),
}));
jest.mock('@/common/services/prisma.service', () => ({
  PrismaService: class {},
}));

describe('Keyword suggestions', () => {
  let service: SearchService;
  const rpc = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    (ProductServiceClient as unknown as jest.Mock).mockImplementation(() => ({
      suggestSearchKeywords: rpc,
    }));
    service = new SearchService({} as PrismaService);
  });

  it('forwards the prefix and limit with a deadline and returns only keywords', async () => {
    rpc.mockImplementation((request, metadata, options, callback) => {
      callback(null, { suggestions: ['Áo polo', 'Áo thun'] });
    });
    expect(
      await service.suggestSearchKeywords({ keyword: '  ao  ', limit: 6 }),
    ).toEqual({ suggestions: ['Áo polo', 'Áo thun'] });
    expect(rpc.mock.calls[0][0]).toEqual({ keyword: 'ao', limit: 6 });
    expect(rpc.mock.calls[0][2].deadline).toBeGreaterThan(Date.now());
  });

  it('rejects whitespace before starting an RPC', async () => {
    await expect(
      service.suggestSearchKeywords({ keyword: '  ', limit: 6 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('bounds unavailable search service requests with a friendly error', async () => {
    rpc.mockImplementation((request, metadata, options, callback) => {
      callback(new Error('deadline'));
    });
    await expect(
      service.suggestSearchKeywords({ keyword: 'ao', limit: 6 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
