import {
  Product,
  SearchProductRequest,
} from "../buf/generated/product/v1/product";
import { esClient } from "../config/elasticsearch";
import { getEmbedding } from "../config/model";

/** Generate an embedding and index a published product with its external event version. */
export async function updateProduct(
  product: Product,
  version?: number,
  eventId?: string,
): Promise<void> {
  // semantic search: generate embedding vector for the product and store it in Elasticsearch
  const vector = await getEmbedding(
    `${product.productName} ${product.categoryName} ${product.brandName} ${product.description}`,
  );

  await esClient.index({
    index: "products",
    id: product.productId,
    ...(version !== undefined && {
      version,
      version_type: "external" as const,
    }),
    document: {
      deleted: false,
      eventId,
      productId: product.productId,
      productName: product.productName,
      description: product.description,
      price: product.price,
      categoryName: product.categoryName,
      thumbnailUrl: product.thumbnailUrl,
      brandName: product.brandName,
      slug: product.slug,
      product_vector: vector,
    },
  });
}

export class InvalidProductEventError extends TypeError {}

/** Validate the envelope and apply a monotonically versioned product snapshot. */
export async function applyProductEvent(event: any): Promise<void> {
  if (
    !event ||
    event.aggregateType !== "product" ||
    typeof event.eventId !== "string" ||
    typeof event.aggregateId !== "string" ||
    !Number.isSafeInteger(event.eventVersion) ||
    event.eventVersion <= 0 ||
    event.schemaVersion !== 1 ||
    !["created", "updated", "deleted"].includes(event.eventType)
  ) {
    throw new InvalidProductEventError(
      "Invalid or unsupported product event envelope",
    );
  }
  const p = event.payload;
  const deleted = event.eventType === "deleted";
  if (
    !p ||
    (!deleted &&
      (p.id !== event.aggregateId ||
        typeof p.name !== "string" ||
        (p.is_published !== null && typeof p.is_published !== "boolean") ||
        !Array.isArray(p.product_variants)))
  ) {
    throw new InvalidProductEventError("Invalid product event payload");
  }
  // Avoid embedding work for duplicates. External versioning still protects races
  // between this read and index writes from other consumer instances.
  try {
    const current = await esClient.get({
      index: "products",
      id: event.aggregateId,
    });
    if ((current._version ?? 0) >= event.eventVersion) return;
  } catch (error: any) {
    if (error.meta?.statusCode !== 404) throw error;
  }
  try {
    if (deleted || !p.is_published) {
      // Permanent tombstone: real deletes expire their version metadata in ES.
      await esClient.index({
        index: "products",
        id: event.aggregateId,
        version: event.eventVersion,
        version_type: "external",
        document: {
          productId: event.aggregateId,
          deleted: true,
          eventId: event.eventId,
        },
      });
    } else {
      const prices = p.product_variants
        .map((v: any) => Number(v.price ?? 0))
        .filter((price: number) => Number.isFinite(price) && price > 0);
      await updateProduct(
        {
          productId: p.id,
          productName: p.name,
          description: p.description || "",
          price: prices.length ? Math.min(...prices) : 0,
          categoryName: p.categories?.name || "",
          thumbnailUrl: p.thumbnail_url || "",
          brandName: p.brands?.name || "",
          slug: p.slug || "",
        } as Product,
        event.eventVersion,
        event.eventId,
      );
    }
  } catch (error: any) {
    if (
      error.meta?.statusCode !== 409 ||
      error.meta?.body?.error?.type !== "version_conflict_engine_exception"
    )
      throw error;
  }
}

function parseSort(sort?: string) {
  if (!sort) {
    return undefined;
  }

  return sort.split(",").map((item) => {
    const [field, order] = item.split(":");

    return {
      [field]: order === "desc" ? "desc" : "asc",
    };
  });
}

export async function searchProducts(
  params: SearchProductRequest,
): Promise<Product[]> {
  const {
    keyword,
    categoryName,
    brandName,
    minPrice,
    maxPrice,
    page,
    pageSize,
    sort,
  } = params;

  const pageNumber = page ?? 1;
  const pageSizeNumber = pageSize ?? 20;

  const queryVector = keyword ? await getEmbedding(keyword) : null;

  const filters: any[] = [
    { bool: { must_not: [{ term: { deleted: true } }] } },
  ];

  if (categoryName) {
    filters.push({
      match_phrase: {
        categoryName,
      },
    });
  }

  if (brandName) {
    filters.push({
      match_phrase: {
        brandName,
      },
    });
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filters.push({
      range: {
        price: {
          ...(minPrice !== undefined && { gte: minPrice }),
          ...(maxPrice !== undefined && { lte: maxPrice }),
        },
      },
    });
  }

  const result = await esClient.search<Product>({
    index: "products",

    // Pagination
    from: (pageNumber - 1) * pageSizeNumber,
    size: pageSizeNumber,

    ...(sort && {
      sort: parseSort(sort),
    }),

    query: {
      bool: {
        must: keyword
          ? [
              {
                bool: {
                  should: [
                    {
                      term: {
                        productId: {
                          value: keyword,
                          boost: 10,
                        },
                      },
                    },
                    {
                      multi_match: {
                        query: keyword,
                        fields: [
                          "productName^3",
                          "description",
                          "categoryName^2",
                          "brandName^2",
                        ],
                        operator: "and",
                        fuzziness: "AUTO",
                        prefix_length: 2,
                        max_expansions: 50,
                      },
                    },
                  ],
                  minimum_should_match: 1,
                },
              },
            ]
          : [],
        filter: filters,
      },
    },

    ...(queryVector && {
      knn: {
        field: "product_vector",
        query_vector: queryVector,
        k: 50,
        num_candidates: 100,
        filter: filters,
      },
    }),
  });

  return result.hits.hits
    .map((hit) => hit._source)
    .filter((product): product is Product => product !== undefined);
}
