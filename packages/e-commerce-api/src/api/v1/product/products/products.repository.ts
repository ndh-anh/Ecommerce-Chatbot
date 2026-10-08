import { PrismaService } from '@/common/services/prisma.service';
import {
  GetProducts200Response,
  GetProductsQueryParams,
  GetProductByProductId200Response,
  GetProductBySlug200Response,
  PatchProductBody,
  PostProductBody,
} from '@e-commerce/api-validation/types/product';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { Prisma } from 'generated/prisma/client';

@Injectable()
export class ProductsRepository {
  private logger = new Logger(ProductsRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.products.delete({
          where: { id: productId },
        });
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Product not found');
      }
      throw error;
    }
  }

  async getProducts(
    query: GetProductsQueryParams,
  ): Promise<GetProducts200Response> {
    return this.findProducts(query);
  }

  async getUserProducts(
    query: GetProductsQueryParams,
  ): Promise<GetProducts200Response> {
    return this.findProducts(query, { onlyPublished: true });
  }

  private async findProducts(
    query: GetProductsQueryParams,
    options: { onlyPublished?: boolean } = {},
  ): Promise<GetProducts200Response> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const brandIdList = query.brandIds
      ? query.brandIds.split(',').filter(Boolean)
      : [];

    const categoryIdList = query.categoryIds
      ? query.categoryIds.split(',').filter(Boolean)
      : [];

    const whereClause: Record<string, any> = {
      ...(query.productName && {
        name: {
          contains: query.productName,
          mode: 'insensitive',
        },
      }),
      id: query.productId,
      ...(categoryIdList.length > 0 && {
        category_id: {
          in: categoryIdList,
        },
      }),
      ...(brandIdList.length > 0 && {
        brand_id: {
          in: brandIdList,
        },
      }),
      ...(options.onlyPublished && { is_published: true }),
    };

    // Khoảng giá (minPrice, maxPrice) dựa trên giá của variants
    const priceCondition: Record<string, number> = {};
    if (query.minPrice !== undefined) {
      priceCondition.gte = query.minPrice;
    }
    if (query.maxPrice !== undefined) {
      priceCondition.lte = query.maxPrice;
    }

    if (Object.keys(priceCondition).length > 0) {
      whereClause.product_variants = {
        some: {
          price: priceCondition,
        },
      };
    }

    // Kiểm tra xem có yêu cầu sắp xếp theo giá không
    const isPriceSort = query.sortBy === 'price';

    type ProductWithRelations = Prisma.productsGetPayload<{
      include: {
        categories: true;
        product_variants: {
          include: {
            warehouse_inventory: {
              include: {
                warehouses: true;
              };
            };
          };
        };
      };
    }>;

    let productsResult: ProductWithRelations[] = [];
    let totalCount = 0;

    if (isPriceSort) {
      // 1. Lấy toàn bộ sản phẩm khớp bộ lọc cùng với giá của variant
      const allMatchingProducts = await this.prisma.products.findMany({
        where: whereClause,
        select: {
          id: true,
          product_variants: {
            select: {
              price: true,
            },
          },
        },
      });

      // 2. Tính toán giá nhỏ nhất (minPrice) của từng sản phẩm để sắp xếp
      const productsWithPrices = allMatchingProducts.map((p) => {
        const prices = p.product_variants
          .map((v) => Number(v.price ?? 0))
          .filter((price) => price > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        return { id: p.id, minPrice };
      });

      // 3. Sắp xếp trong bộ nhớ
      const order = query.sortOrder === 'desc' ? -1 : 1;
      productsWithPrices.sort((a, b) => (a.minPrice - b.minPrice) * order);

      // 4. Phân trang
      totalCount = productsWithPrices.length;
      const pageIds = productsWithPrices
        .slice(pageSize * (page - 1), pageSize * page)
        .map((p) => p.id);

      // 5. Lấy dữ liệu chi tiết cho trang hiện tại
      const details = await this.prisma.products.findMany({
        where: {
          id: { in: pageIds },
        },
        include: {
          categories: true,
          product_variants: {
            include: {
              warehouse_inventory: {
                include: {
                  warehouses: true,
                },
              },
            },
          },
        },
      });

      // Đảm bảo kết quả trả về đúng theo thứ tự đã sắp xếp của pageIds
      const detailsMap = new Map(details.map((d) => [d.id, d]));
      productsResult = pageIds
        .map((id) => detailsMap.get(id))
        .filter((d): d is NonNullable<typeof d> => d !== undefined);
    } else {
      // Sắp xếp ở Database Level (createdAt, productName, vv.)
      const orderByClause: any = {};
      if (query.sortBy === 'productName') {
        orderByClause.name = query.sortOrder === 'desc' ? 'desc' : 'asc';
      } else if (query.sortBy === 'createdAt') {
        orderByClause.created_at = query.sortOrder === 'desc' ? 'desc' : 'asc';
      } else {
        // Mặc định sắp xếp theo ngày tạo giảm dần (mới nhất trước)
        orderByClause.created_at = 'desc';
      }

      productsResult = await this.prisma.products.findMany({
        where: whereClause,
        include: {
          categories: true,
          product_variants: {
            include: {
              warehouse_inventory: {
                include: {
                  warehouses: true,
                },
              },
            },
          },
        },
        orderBy: orderByClause,
        take: pageSize,
        skip: pageSize * (page - 1),
      });

      totalCount = await this.prisma.products.count({
        where: whereClause,
      });
    }

    const products = productsResult.map((product) => {
      const variantPrices = product.product_variants
        .map((variant) => Number(variant.price ?? 0))
        .filter((price) => price > 0);

      const warehouseName = product.product_variants
        .flatMap((variant) => variant.warehouse_inventory)
        .find((inventory) => inventory.warehouses?.name)?.warehouses?.name;

      return {
        productId: product.id,
        productName: product.name,
        categoryName: product.categories?.name || 'Uncategorized',
        thumbnailUrl: product.thumbnail_url || '',
        location: warehouseName || 'Online',
        price: variantPrices.length > 0 ? Math.min(...variantPrices) : 0,
        slug: product.slug || '',
        isPublished: product.is_published ?? false,
      };
    });

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      totalCount,
      products,
      totalPages,
    };
  }

  async getProductById(
    productId: string,
  ): Promise<GetProductByProductId200Response> {
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      include: {
        categories: true,
        brands: true,
        product_images: true,
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return {
      productId: product.id,
      productName: product.name,
      categoryId: product.categories?.id || '',
      thumbnailUrl: product.thumbnail_url || '',
      brandId: product.brand_id || undefined,
      description: product.description || '',
      images:
        product.product_images.map((img) => ({
          url: img.url ?? '',
        })) || [],
      slug: product.slug || '',
      isPublished: product.is_published ?? false,
    };
  }

  async getProductBySlug(slug: string): Promise<GetProductBySlug200Response> {
    const product = await this.prisma.products.findFirst({
      where: { slug, is_published: true },
      include: {
        categories: true,
        brands: true,
        product_images: true,
        product_variants: {
          include: {
            variant_attribute_values: {
              include: {
                attributes: true,
              },
            },
            warehouse_inventory: true,
          },
        },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return {
      productId: product.id,
      productName: product.name,
      categoryId: product.categories?.id || '',
      thumbnailUrl: product.thumbnail_url || '',
      brandId: product.brand_id || undefined,
      description: product.description || '',
      images:
        product.product_images.map((img) => ({
          url: img.url ?? '',
        })) || [],
      slug: product.slug || '',
      isPublished: product.is_published ?? false,
      category: product.categories
        ? {
            categoryId: product.categories.id,
            categoryName: product.categories.name,
            slug: product.categories.slug || '',
            parentId: product.categories.parent_id || undefined,
          }
        : undefined,
      brand: product.brands
        ? {
            brandId: product.brands.id,
            brandName: product.brands.name,
            slug: product.brands.slug || '',
          }
        : undefined,
      variants: product.product_variants.map((v) => ({
        productVariantId: v.id,
        productId: v.product_id,
        sku: v.sku || '',
        thumbnailUrl: v.thumbnail_url || '',
        price: Number(v.price),
        comparePrice: Number(v.compare_price),
        stock:
          v.warehouse_inventory?.reduce(
            (sum, item) => sum + (item.stock || 0),
            0,
          ) || 0,
        variantAttributes: v.variant_attribute_values.map((attr) => ({
          attributeId: attr.attribute_id,
          attributeName: attr.attributes.name,
          attributeValue: attr.value,
        })),
      })),
    };
  }

  async updateProduct(
    productId: string,
    data: PatchProductBody,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Kiểm tra product tồn tại
      const existing = await tx.products.findUnique({
        where: { id: productId },
        include: { product_images: true },
      });

      if (!existing) {
        throw new NotFoundException('Product not found');
      }

      // 2. Update các field của product
      await tx.products.update({
        where: { id: productId },
        data: {
          ...(data.productName != null && { name: data.productName }),
          ...(data.description != null && { description: data.description }),
          ...(data.categoryId != null && { category_id: data.categoryId }),
          ...(data.brandId != null && { brand_id: data.brandId }),
          ...(data.slug != null && { slug: data.slug }),
          ...(data.thumbnailUrl != null && {
            thumbnail_url: data.thumbnailUrl,
          }),
          ...(data.isPublished != null && { is_published: data.isPublished }),
        },
      });

      // 3. Xử lý images theo diff (chỉ xóa/thêm những gì thay đổi)
      if (data.images != null) {
        const newUrls = new Set(data.images.map((img) => img.url));
        const oldImages = existing.product_images;
        const oldUrls = new Set(oldImages.map((img) => img.url));

        // Ảnh cần xóa: có trong DB nhưng không có trong danh sách mới
        const toDelete = oldImages.filter((img) => !newUrls.has(img.url ?? ''));

        // Ảnh cần thêm: có trong danh sách mới nhưng chưa có trong DB
        const toInsert = data.images.filter((img) => !oldUrls.has(img.url));

        if (toDelete.length > 0) {
          await tx.product_images.deleteMany({
            where: { id: { in: toDelete.map((img) => img.id) } },
          });
        }

        if (toInsert.length > 0) {
          await tx.product_images.createMany({
            data: toInsert.map((img) => ({
              id: crypto.randomUUID(),
              product_id: productId,
              url: img.url,
            })),
          });
        }
      }
    });
  }

  async createProduct(data: PostProductBody): Promise<string> {
    this.logger.log('Start save product');

    const productId = crypto.randomUUID();

    await this.prisma.$transaction(async (tx) => {
      this.logger.log('Start transaction');

      const duplicateCount = await tx.products.count({
        where: { slug: data.slug },
      });

      if (duplicateCount > 0) {
        throw new ConflictException('Product already exists');
      }

      await tx.products.create({
        data: {
          id: productId,
          brand_id: data.brandId,
          name: data.productName,
          description: data.description,
          category_id: data.categoryId,
          thumbnail_url: data.thumbnailUrl,
          slug: data.slug,
          is_published: data.isPublished ?? false,
        },
      });

      this.logger.log('Save product success');

      if (data?.images && data.images.length > 0) {
        await tx.product_images.createMany({
          data: data.images.map((image) => ({
            id: crypto.randomUUID(),
            product_id: productId,
            url: image.url,
          })),
        });

        this.logger.log('Save product images success');
      }
    });

    this.logger.log('End save product');

    return productId;
  }
}
