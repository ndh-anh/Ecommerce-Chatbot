import { describe, expect, it, vi } from 'vitest';
import { AppService } from './app.service.js';
import type { PrismaService } from './prisma.service.js';

describe('placeOrder recipient details', () => {
  it('persists the recipient address and selected payment method', async () => {
    const create = vi.fn().mockResolvedValue({});
    const tx = {
      product_variants: {
        findUnique: vi.fn().mockResolvedValue({ id: 'v1', price: 100, products: { name: 'Áo' } }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orders: { create },
    };
    const service = new AppService({ $transaction: (run: (client: unknown) => Promise<unknown>) => run(tx) } as unknown as PrismaService);
    await service.placeOrder({
      customerId: '123e4567-e89b-12d3-a456-426614174000',
      items: [{ productId: 'v1', quantity: 2 }],
      shippingAddress: 'Người nhận: Nguyễn Văn A - 123 Nguyễn Trãi - SĐT: 0912345678',
      paymentMethod: 'COD',
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      shipping_address: 'Người nhận: Nguyễn Văn A - 123 Nguyễn Trãi - SĐT: 0912345678',
      payment_method: 'COD',
    }) }));
  });
});

describe('cancelOrder', () => {
  it('updates only eligible orders in one atomic operation', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new AppService({ orders: { updateMany } } as unknown as PrismaService);
    const result = await service.cancelOrder({ orderId: 'order-id', reason: 'Customer requested' });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-id',
        OR: [
          { status: { equals: 'PENDING', mode: 'insensitive' } },
          { status: { equals: 'CONFIRMED', mode: 'insensitive' } },
        ],
      },
      data: { status: 'CANCELLED' },
    });
    expect(result.success).toBe(true);
  });

  it('does not report success when the order is missing or no longer eligible', async () => {
    const service = new AppService({ orders: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } } as unknown as PrismaService);
    expect(await service.cancelOrder({ orderId: 'order-id' })).toMatchObject({ success: false });
  });

  it('propagates database failures', async () => {
    const service = new AppService({ orders: { updateMany: vi.fn().mockRejectedValue(new Error('database unavailable')) } } as unknown as PrismaService);
    await expect(service.cancelOrder({ orderId: 'order-id' })).rejects.toThrow('database unavailable');
  });
});
