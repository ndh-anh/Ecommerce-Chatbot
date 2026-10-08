import { PrismaService } from '@/common/services/prisma.service';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';

export type Subjects =
  | 'Event'
  | 'Product'
  | 'Brand'
  | 'Cart'
  | 'Order'
  | 'Voucher'
  | 'Address'
  | 'Review'
  | 'Wishlist'
  | 'all';

export const Action = {
  Manage: 'manage',
  Create: 'create',
  Read: 'read',
  Update: 'update',
  Delete: 'delete',
  Approve: 'approve',
  Reject: 'reject',
  Checkout: 'checkout',
  Cancel: 'cancel',
} as const;

export type Action = (typeof Action)[keyof typeof Action];

export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  constructor(private readonly prisma: PrismaService) {}

  async createAppAbility(roleIds: string[]): Promise<AppAbility> {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (roleIds.length === 0) {
      return build();
    }

    const permissions = await this.prisma.permissions.findMany({
      where: {
        role_permissions: {
          some: {
            role_id: {
              in: roleIds,
            },
          },
        },
      },
      select: {
        action: true,
        subject: true,
      },
    });

    for (const permission of permissions) {
      can(permission.action as Action, permission.subject as Subjects);
    }

    return build();
  }
}
