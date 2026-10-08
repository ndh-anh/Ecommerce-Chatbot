import { EventsModule } from '@/api/v1/event/events/events.module';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/services/prisma.module';
import { HealthModule } from './health.module';
import { AuthModule } from './api/v1/auth/auth/auth.module';
import { ClsModule } from './common/services/cls/cls.module';
import { ClsMiddleware } from './common/services/cls/cls.middleware';
import { CategoriesModule } from '@/api/v1/product/categories/categories.module';
import { BrandsModule } from '@/api/v1/product/brands/brands.module';
import { CustomerAddressesModule } from '@/api/v1/customer/customer-addresses/customer-addresses.module';
import { CustomerReviewsModule } from '@/api/v1/customer/customer-reviews/customer-reviews.module';
import { CustomerWishlistItemsModule } from '@/api/v1/customer/customer-wishlist-items/customer-wishlist-items.module';
import { CustomerWishlistsModule } from '@/api/v1/customer/customer-wishlists/customer-wishlists.module';
import { ProductsModule } from '@/api/v1/product/products/products.module';
import { UserProductsModule } from '@/api/v1/product/user-products/user-products.module';
import { ProductVariantsModule } from '@/api/v1/product/product-variants/product-variants.module';
import { WarehouseInventoriesModule } from '@/api/v1/product/warehouse-inventories/warehouse-inventories.module';
import { WarehousesModule } from '@/api/v1/product/warehouses/warehouses.module';
import { FlashSalesModule } from '@/api/v1/voucher/flash-sales/flash-sales.module';
import { OrderVouchersModule } from '@/api/v1/voucher/order-vouchers/order-vouchers.module';
import { VoucherConditionsModule } from '@/api/v1/voucher/voucher-conditions/voucher-conditions.module';
import { VouchersModule } from '@/api/v1/voucher/vouchers/vouchers.module';
import { CartsModule } from '@/api/v1/cart/carts/carts.module';
import { CartItemsModule } from '@/api/v1/cart/cart-items/cart-items.module';
import { OrdersModule } from '@/api/v1/order/orders/orders.module';
import { OrderItemsModule } from '@/api/v1/order/order-items/order-items.module';
import { OrderPaymentsModule } from '@/api/v1/order/order-payments/order-payments.module';
import { JwtModule } from '@/api/v1/auth/services/jwt-service/jwt.module';
import { AuthGuard } from '@/common/guards/auth.guard';
import { CaslAbilityFactory } from '@/common/casl/casl-ability.factory';
import { PoliciesGuard } from '@/common/guards/policies.guard';
import { UploadsModule } from '@/api/v1/system/uploads/uploads.module';
import { AttributesModule } from '@/api/v1/product/attributes/attributes.module';
import { ProductAttributesModule } from '@/api/v1/product/product-attributes/product-attributes.module';
import { OutboxModule } from '@/api/v1/product/outbox/outbox.module';
import { AiModule } from '@/api/v1/system/ai/ai.module';
import { SearchModule } from '@/api/v1/product/search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ClsModule,
    JwtModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    CategoriesModule,
    BrandsModule,
    CustomerAddressesModule,
    CustomerReviewsModule,
    CustomerWishlistItemsModule,
    CustomerWishlistsModule,
    ProductsModule,
    UserProductsModule,
    ProductVariantsModule,
    WarehousesModule,
    WarehouseInventoriesModule,
    FlashSalesModule,
    OrderVouchersModule,
    VoucherConditionsModule,
    VouchersModule,
    CartsModule,
    CartItemsModule,
    OrdersModule,
    OrderItemsModule,
    OrderPaymentsModule,
    UploadsModule,
    AttributesModule,
    ProductAttributesModule,
    OutboxModule,
    AiModule,
    SearchModule,
    EventsModule,
  ],
  providers: [
    CaslAbilityFactory,
    {
      provide: 'APP_GUARD',
      useClass: AuthGuard,
    },
    {
      provide: 'APP_GUARD',
      useClass: PoliciesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClsMiddleware).forRoutes('*');
  }
}
