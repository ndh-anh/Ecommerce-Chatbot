import * as grpc from "@grpc/grpc-js";

import {
  Product,
  ProductResponse,
  ProductServiceServer,
  ProductServiceService,
  SearchProductRequest,
} from "./buf/generated/product/v1/product";
import { searchProducts } from "./handlers/product";
import { esClient } from "./config/elasticsearch"; // Import esClient của bạn
import { initRabbitMQConsumer, stopRabbitMQConsumer } from "./rabbitmq";

// 1. Hàm kiểm tra kết nối và chuẩn bị Index Elasticsearch
async function initElasticsearch(): Promise<void> {
  console.log("Checking Elasticsearch connection...");

  // Ping thử cluster
  const isHealthy = await esClient.ping();
  if (!isHealthy) {
    throw new Error("Elasticsearch ping failed - cluster is unreachable.");
  }

  // Tùy chọn: Tự động kiểm tra và tạo mapping nếu index 'products' chưa có
  const indexExists = await esClient.indices.exists({ index: "products" });
  if (!indexExists) {
    console.log("Index 'products' does not exist. Creating...");
    await esClient.indices.create({
      index: "products",
      mappings: {
        properties: {
          deleted: { type: "boolean" },
          eventId: { type: "keyword" },
          productId: { type: "keyword" },
          productName: {
            type: "text",
            fields: { keyword: { type: "keyword", ignore_above: 256 } },
          },
          description: { type: "text" },
          price: { type: "double" },
          categoryName: {
            type: "text",
            fields: { keyword: { type: "keyword" } },
          },
          brandName: {
            type: "text",
            fields: { keyword: { type: "keyword" } },
          },
          thumbnailUrl: { type: "keyword", index: false },
          slug: { type: "keyword" },
          product_vector: {
            type: "dense_vector",
            dims: 1024,
            index: true,
            similarity: "cosine",
          },
        },
      },
    });
    console.log("Index 'products' created successfully.");
  }

  await esClient.indices.putMapping({
    index: "products",
    properties: { deleted: { type: "boolean" }, eventId: { type: "keyword" } },
  });
  console.log("Elasticsearch is ready.");
}

// 2. Định nghĩa gRPC server implementation
const serverImpl: ProductServiceServer = {
  searchProduct: async (
    call: grpc.ServerUnaryCall<SearchProductRequest, ProductResponse>,
    callback: grpc.sendUnaryData<ProductResponse>,
  ) => {
    try {
      const products = await searchProducts(call.request);
      callback(null, { products });
    } catch (error: any) {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message || "Failed to search products",
      });
    }
  },
};

// 3. Hàm bootstrap khởi chạy hệ thống
async function bootstrap() {
  try {
    // Bước 1: Chờ Elasticsearch sẵn sàng trước
    await initElasticsearch();

    // Bước 1.5: Khởi tạo RabbitMQ Consumer
    await initRabbitMQConsumer();

    // Bước 2: Khởi tạo và bind gRPC server
    const server = new grpc.Server();
    server.addService(ProductServiceService, serverImpl);

    const PORT = "0.0.0.0:50053";
    server.bindAsync(
      PORT,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) {
          console.error("Failed to bind gRPC server:", err);
          process.exit(1);
        }
        console.log(`gRPC Server running on port ${port}`);
      },
    );
  } catch (error) {
    console.error(
      "Bootstrap failure (cannot connect to Elasticsearch):",
      error,
    );
    process.exit(1); // Dừng app ngay lập tức nếu Elasticsearch lỗi
  }
}

// Kích hoạt server
bootstrap();

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void stopRabbitMQConsumer().finally(() => process.exit(0));
  });
}
