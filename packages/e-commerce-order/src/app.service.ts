import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from './prisma.service.js';
import { parseSort } from './utils/parse-sort.js';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  // --- API Gateway methods ---

  async createOrder(data: any): Promise<any> {
    const orderId = randomUUID();
    await this.prisma.orders.create({
      data: {
        id: orderId,
        user_id: data.userId,
        status: 'PENDING',
        total_amount: 0,
        total_discount: 0,
        final_amount: 0,
        created_at: new Date(),
      },
    });
    return { orderId };
  }

  async getOrders(query: any): Promise<any> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const whereClause: Prisma.ordersWhereInput = {
      ...(query.userId && { user_id: query.userId }),
      ...(query.status && { status: query.status }),
    };

    const sort = parseSort(query.orderBy);

    const [result, totalCount] = await Promise.all([
      this.prisma.orders.findMany({
        where: whereClause,
        orderBy: sort.length > 0 ? sort : [{ created_at: 'desc' }],
        take: pageSize,
        skip,
      }),
      this.prisma.orders.count({ where: whereClause }),
    ]);

    const orders = result.map((o) => ({
      orderId: o.id,
      userId: o.user_id,
      status: o.status ?? '',
      totalAmount: Number(o.total_amount ?? 0),
      totalDiscount: Number(o.total_discount ?? 0),
      finalAmount: Number(o.final_amount ?? 0),
      createdAt: o.created_at?.toISOString() ?? '',
    }));

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      orders,
      totalCount,
      totalPages,
    };
  }

  async getOrderById(data: any): Promise<any> {
    const o = await this.prisma.orders.findUnique({
      where: { id: data.orderId },
    });

    if (!o) {
      return { order: null }; // Returning null to indicate not found in gRPC
    }

    return {
      order: {
        orderId: o.id,
        userId: o.user_id,
        status: o.status ?? '',
        totalAmount: Number(o.total_amount ?? 0),
        totalDiscount: Number(o.total_discount ?? 0),
        finalAmount: Number(o.final_amount ?? 0),
        createdAt: o.created_at?.toISOString() ?? '',
      },
    };
  }

  async deleteOrder(data: any): Promise<any> {
    try {
      await this.prisma.orders.delete({
        where: { id: data.orderId },
      });
      return { success: true };
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return { success: false }; // Not found
      }
      throw error;
    }
  }

  // --- AI Assistant methods ---

  async placeOrder(data: any): Promise<any> {
    const orderId = randomUUID();
    
    return this.prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const orderItemsData = [];
      
      for (const item of data.items || []) {
        const quantity = item.quantity || 1;
        let price = 0;
        let productId = item.productId || item.product_id;
        let variantId = null;
        let productName = 'Unknown Product';
        
        if (productId) {
          // First, check if the ID is a product_variant
          const variant = await tx.product_variants.findUnique({
            where: { id: productId },
            include: { products: true }
          });
          
          if (variant) {
            variantId = variant.id;
            productId = variant.product_id;
            price = Number(variant.price || 0);
            productName = variant.products?.name || productName;
          } else {
            // Check if it's a root product ID
            const product = await tx.products.findUnique({
              where: { id: productId }
            });
            if (product) {
              productName = product.name;
              const firstVariant = await tx.product_variants.findFirst({
                where: { product_id: product.id }
              });
              if (firstVariant) {
                variantId = firstVariant.id;
                price = Number(firstVariant.price || 0);
              }
            }
          }
        }
        
        // --- ATOMIC DECREMENT INVENTORY ---
        if (variantId) {
          const updated = await tx.product_variants.updateMany({
            where: {
              id: variantId,
              stock: { gte: quantity }
            },
            data: {
              stock: { decrement: quantity }
            }
          });
          
          if (updated.count === 0) {
            throw new Error(`Sản phẩm ${productName} đã hết hàng hoặc không đủ số lượng để đặt.`);
          }
        }
        
        const itemTotal = price * quantity;
        totalAmount += itemTotal;
        
        orderItemsData.push({
          id: randomUUID(),
          product_id: productId,
          product_variant_id: variantId,
          product_name: productName,
          price: price,
          quantity: quantity,
          total_price: itemTotal
        });
      }
  
      let userId = data.customerId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
  
      if (!isUuid) {
        const defaultUser = await tx.users.findFirst();
        if (defaultUser) {
          userId = defaultUser.uid;
        } else {
          throw new Error('No default user found to place order. Please provide a valid customerId (UUID).');
        }
      }
  
      await tx.orders.create({
        data: {
          id: orderId,
          user_id: userId,
          status: 'CREATED',
          shipping_address: data.shippingAddress,
          payment_method: data.paymentMethod,
          total_amount: totalAmount,
          final_amount: totalAmount,
          created_at: new Date(),
          order_items: {
            create: orderItemsData
          }
        },
      });
      
      return {
        orderId,
        status: 'CREATED',
        message: 'Order created successfully'
      };
    });
  }

  async getOrder(data: any): Promise<any> {
    const order = await this.prisma.orders.findUnique({
      where: { id: data.orderId },
    });
    
    if (!order) {
      return {
        orderId: data.orderId,
        status: 'NOT_FOUND',
        message: 'Order not found'
      };
    }
    
    return {
      orderId: order.id,
      customerId: order.user_id,
      items: [], // Simplified for now
      status: order.status || '',
      totalAmount: Number(order.total_amount || 0)
    };
  }

  async cancelOrder(data: any): Promise<any> {
    const result = await this.prisma.orders.updateMany({
      where: {
        id: data.orderId,
        OR: [
          { status: { equals: 'PENDING', mode: 'insensitive' } },
          { status: { equals: 'CONFIRMED', mode: 'insensitive' } },
        ],
      },
      data: { status: 'CANCELLED' },
    });
    return {
      success: result.count === 1,
      message: result.count === 1
        ? `Order cancelled due to: ${data.reason}`
        : 'Order not found or cannot be cancelled in its current status',
    };
  }
}
