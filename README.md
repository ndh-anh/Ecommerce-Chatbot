# E-Commerce Chatbot

Ứng dụng thương mại điện tử tích hợp chatbot AI, giúp khách hàng tìm sản phẩm, kiểm tra tồn kho, đặt hàng và theo dõi đơn hàng bằng hội thoại tiếng Việt. Chatbot kết nối với các dịch vụ nghiệp vụ để tra cứu dữ liệu và thực hiện thao tác ngay trong giao diện mua sắm.

Dự án gồm website bán hàng, trang quản trị và các dịch vụ backend trong cùng một monorepo. API-first là phương pháp phát triển hỗ trợ đồng bộ contract giữa frontend và backend; trọng tâm sản phẩm là trải nghiệm mua sắm với chatbot.

## Chatbot làm được gì?

| Nhóm tác vụ       | Chức năng trong code hiện tại                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Tư vấn sản phẩm   | Tìm theo từ khóa, danh mục, thương hiệu, khoảng giá và thứ tự sắp xếp; trả dữ liệu để giao diện hiển thị thẻ sản phẩm. |
| Kiểm tra tồn kho  | Tra cứu biến thể, SKU và số lượng tồn của sản phẩm.                                                                    |
| Xử lý đơn hàng    | Thu thập thông tin đặt hàng, tạo đơn, tra cứu trạng thái và hủy đơn qua dịch vụ đơn hàng.                              |
| Hỗ trợ khách hàng | Giải đáp chính sách đổi trả, bảo hành và giao hàng. Công cụ tra cứu hiện dùng nội dung mẫu cố định.                    |
| Duy trì hội thoại | Lưu trạng thái bằng LangGraph checkpoint trên PostgreSQL và tải lại lịch sử chat.                                      |
| Xác nhận thao tác | Tạm dừng trước khi tạo hoặc hủy đơn để người dùng kiểm tra thông tin, xác nhận hoặc từ chối.                           |

Ví dụ yêu cầu có thể gửi cho chatbot:

- “Tìm giúp tôi áo polo dưới 500.000 đồng.”
- “Sản phẩm này còn những phân loại nào?”
- “Tôi muốn đặt 2 sản phẩm này.”
- “Kiểm tra trạng thái đơn hàng của tôi.”
- “Chính sách đổi trả như thế nào?”

Kết quả phụ thuộc vào dữ liệu sản phẩm, tồn kho, đơn hàng và các dịch vụ đã cấu hình. Khi đặt hàng, chatbot cần thu thập sản phẩm, số lượng, người nhận, địa chỉ, số điện thoại và phương thức thanh toán trước bước xác nhận.

## Website và trang quản trị

Website có các trang danh sách và chi tiết sản phẩm, tìm kiếm, giỏ hàng, danh sách yêu thích, tài khoản và đơn hàng cá nhân. Chat widget được tích hợp trong layout mua sắm.

Trang quản trị hỗ trợ quản lý sản phẩm, biến thể, danh mục, thương hiệu, thuộc tính, kho, tồn kho và đơn hàng. Backend cung cấp xác thực, phân quyền và các API nghiệp vụ phục vụ những giao diện này.

## Kiến trúc hệ thống

```mermaid
flowchart TD
    Web[Website Next.js và Chat Widget] -->|HTTP| API[API NestJS]
    API -->|gRPC| AI[AI Assistant: Python và LangGraph]
    AI --> Supervisor[Supervisor]
    Supervisor --> Product[Product Agent]
    Supervisor --> Order[Order Agent]
    Supervisor --> Support[Support Agent]
    Product -->|gRPC: tìm sản phẩm| Search[Search Service]
    Product -->|gRPC: tồn kho| API
    Order -->|gRPC: tồn kho| API
    Order -->|gRPC: đơn hàng| Orders[Order Service]
    Support --> Policy[Chính sách mẫu]
    Search --> ES[(Elasticsearch)]
    AI -->|Checkpoint hội thoại| DB[(PostgreSQL)]
    API --> DB
    Orders --> DB
    API -->|Sự kiện sản phẩm qua outbox| MQ[RabbitMQ]
    MQ -->|Đồng bộ chỉ mục| Search
```

1. Chat widget gửi tin nhắn đến API, sau đó API chuyển yêu cầu sang AI Assistant qua gRPC.
2. Supervisor trong LangGraph điều phối Product Agent, Order Agent hoặc Support Agent dựa trên hội thoại. Một yêu cầu có thể cần nhiều nhóm tác vụ.
3. Agent gọi công cụ tương ứng để lấy dữ liệu hoặc xử lý nghiệp vụ. Thao tác tạo và hủy đơn đi qua bước xác nhận của người dùng.
4. AI Assistant trả lời kèm dữ liệu có cấu trúc để frontend hiển thị nội dung chat, sản phẩm hoặc yêu cầu xác nhận.

Search Service kết hợp tìm kiếm văn bản và vector trên Elasticsearch. Embedding được tạo qua DashScope với model `text-embedding-v3`; các thay đổi sản phẩm được chuyển qua RabbitMQ để cập nhật chỉ mục.

## Các luồng xử lý chính

### Hội thoại và điều phối agent

Supervisor đọc ngữ cảnh hội thoại để chọn agent xử lý. Mỗi agent có bộ công cụ riêng và có thể gọi công cụ, đọc kết quả rồi tiếp tục trả lời. Sau khi agent hoàn thành, luồng quay lại Supervisor để xử lý yêu cầu còn lại hoặc kết thúc lượt chat. Khi cần khách hàng cung cấp thêm thông tin, hệ thống kết thúc lượt hiện tại để chờ phản hồi.

```mermaid
flowchart LR
    Input[Tin nhắn và ngữ cảnh] --> Supervisor[Supervisor]
    Supervisor --> Agent[Product / Order / Support]
    Agent --> Decision{Cần gọi công cụ?}
    Decision -->|Có| Tool[Công cụ nghiệp vụ]
    Tool --> Agent
    Decision -->|Không| Supervisor
    Supervisor -->|Hoàn tất hoặc cần hỏi thêm| Response[Phản hồi khách hàng]
```

Trạng thái graph được lưu bằng PostgreSQL checkpointer với khóa kết hợp người dùng đã xác thực và phiên hội thoại. Khóa giao dịch trong PostgreSQL tuần tự hóa các yêu cầu trên cùng hội thoại, kể cả khi có nhiều AI worker. API cũng cung cấp luồng lấy lịch sử để chat widget khôi phục các tin nhắn đã trao đổi.

### Tìm kiếm và kiểm tra tồn kho

1. Product Agent chuyển nhu cầu của khách thành các tham số như từ khóa, thương hiệu, danh mục và khoảng giá.
2. Công cụ `get_products` gọi Search Service qua gRPC. Khi có từ khóa, Search Service tạo embedding và kết hợp truy vấn văn bản với tìm kiếm vector trên Elasticsearch.
3. Kết quả sản phẩm được trả về cùng phản hồi của chatbot để frontend hiển thị thẻ sản phẩm.
4. Khi khách hỏi về phân loại hoặc số lượng còn lại, công cụ `check_inventory_tool` gọi dịch vụ tồn kho trong API để lấy dữ liệu biến thể và tồn kho từ PostgreSQL.

Elasticsearch phục vụ tìm kiếm sản phẩm; thông tin tồn kho được tra cứu qua dịch vụ nghiệp vụ khi cần.

### Tạo và hủy đơn có xác nhận

```mermaid
sequenceDiagram
    actor Customer as Khách hàng
    participant Web as Chat Widget
    participant AI as API / AI Assistant
    participant Graph as LangGraph
    participant Order as Order Service
    Customer->>Web: Yêu cầu đặt hoặc hủy đơn
    Web->>AI: Gửi tin nhắn
    AI->>Graph: Xử lý yêu cầu và thu thập thông tin
    Graph-->>AI: Tạm dừng trước công cụ tạo / hủy đơn
    AI-->>Web: Trả thông tin cần xác nhận
    Web-->>Customer: Hiển thị thao tác dự kiến
    Customer->>Web: Xác nhận hoặc từ chối
    Web->>AI: Gửi lựa chọn
    alt Khách xác nhận
        AI->>Graph: Tiếp tục graph
        Graph->>Order: Gọi công cụ qua gRPC
        Order-->>Graph: Kết quả xử lý
    else Khách từ chối
        AI->>Graph: Ghi nhận từ chối, bỏ qua thao tác
    end
    Graph-->>AI: Phản hồi kết quả
    AI-->>Web: Hiển thị cho khách
```

LangGraph tạm dừng trước nhóm `sensitive_order_tools`, gồm `place_order_tool` và `cancel_order_tool`. Xác nhận gắn với ID của thao tác đang chờ; Order Service kiểm tra chủ sở hữu đơn và chống tạo trùng khi gửi lại cùng yêu cầu. Tạo đơn/trừ kho và hủy đơn/hoàn kho được xử lý trong transaction. Các thao tác tra cứu như kiểm tra đơn hoặc tồn kho không đi qua bước xác nhận này.

### Đồng bộ dữ liệu tìm kiếm

```text
Thay đổi sản phẩm → Outbox trong PostgreSQL → RabbitMQ
                  → Search Service → Tạo embedding → Elasticsearch
```

API ghi nhận sự kiện sản phẩm qua outbox. Bộ xử lý outbox chuyển sự kiện sang RabbitMQ; Search Service nhận sự kiện và cập nhật chỉ mục tìm kiếm. Outbox chỉ đánh dấu hoàn tất sau xác nhận từ broker. Search Service dùng phiên bản sự kiện để loại cập nhật cũ, giữ dấu xóa sản phẩm và chuyển lỗi qua retry/dead-letter queue. Đây là luồng đồng bộ bất đồng bộ, nên kết quả tìm kiếm có thể cập nhật sau dữ liệu nghiệp vụ.

## Công nghệ và cấu trúc

| Thành phần              | Công nghệ chính                                  |
| ----------------------- | ------------------------------------------------ |
| Website và quản trị     | Next.js, React, Material UI, TanStack Query      |
| Chatbot                 | Python, LangGraph, LangChain, Qwen qua DashScope |
| API và dịch vụ đơn hàng | NestJS, Prisma, gRPC                             |
| Tìm kiếm                | TypeScript, Elasticsearch, DashScope embeddings  |
| Dữ liệu và sự kiện      | PostgreSQL, Liquibase, RabbitMQ                  |
| Contract và sinh code   | TypeSpec, OpenAPI, Orval, Protocol Buffers, Buf  |
| Công cụ phát triển      | pnpm workspace, Docker Compose, GitHub Actions   |

```text
packages/
├── ai-assistant/          # Chatbot, LangGraph, agents và tools (Python)
├── e-commerce-front/      # Website, trang quản trị và chat widget
├── e-commerce-api/        # HTTP API, xác thực, nghiệp vụ và gRPC tồn kho
├── e-commerce-order/      # Dịch vụ đơn hàng qua gRPC
├── e-commerce-search/     # Tìm kiếm và đồng bộ chỉ mục Elasticsearch
├── e-commerce-db/         # Database changelog và migration Liquibase
├── proto/                 # Contract gRPC và cấu hình sinh code
├── openapi-typespec/       # Contract HTTP API bằng TypeSpec
├── openapi-generator/      # Công cụ sinh base controller NestJS
├── custom/                # Template tùy chỉnh cho generator
├── api-client/            # API client và TanStack Query hooks
└── api-validation/        # Types và Zod schemas dùng chung
```

Các package JavaScript/TypeScript được quản lý bằng pnpm workspace. AI Assistant có môi trường Python và dependencies riêng.

## API-first trong quy trình phát triển

API-first giúp giảm phần code lặp và giữ frontend, backend thống nhất khi bổ sung tính năng thương mại điện tử hoặc chatbot.

```text
TypeSpec → OpenAPI ─┬→ Base controllers NestJS
                   ├→ API client và TanStack Query hooks
                   └→ Types và Zod schemas

Protocol Buffers → Buf → gRPC code cho TypeScript và Python
```

Khi thay đổi HTTP API, cập nhật contract trong `packages/openapi-typespec` rồi sinh lại code. Khi thay đổi giao tiếp gRPC, cập nhật `packages/proto`. Business logic được triển khai trong service, repository và các công cụ của chatbot.

## Chạy chatbot với Docker Compose

### Phát triển local

`docker-compose.yaml` cung cấp PostgreSQL, RabbitMQ, Elasticsearch và Kibana.
Các ứng dụng và dịch vụ chatbot chạy trực tiếp trên host trong môi trường phát triển.
Sau khi thiết lập môi trường theo [`SETUP.md`](SETUP.md), khởi động hạ tầng:

```bash
docker compose up -d postgres-db rabbitmq elasticsearch
```

Search Service đọc `packages/e-commerce-search/.env`; dùng
[`packages/e-commerce-search/.env.example`](packages/e-commerce-search/.env.example)
làm mẫu. Khi chạy service trên host, cấu hình:

```dotenv
ELASTICSEARCH_NODE=http://localhost:9200
ELASTIC_CLOUD_ID=
ELASTIC_API_KEY=
ELASTIC_USERNAME=
ELASTIC_PASSWORD=
RABBITMQ_URL=amqp://guest:guest@localhost:5672
DASHSCOPE_API_KEY=YOUR_DASHSCOPE_API_KEY
```

`DASHSCOPE_API_KEY` được dùng để tạo embedding cho tìm kiếm văn bản kết hợp vector.
Elasticsearch local mở cổng `9200` trên `127.0.0.1`. Nếu cần xem chỉ mục bằng Kibana,
chạy `docker compose up -d kibana` và truy cập `http://localhost:5601`.

### Triển khai production

`docker-compose.prod.yaml` chạy sáu service: `frontend`, `api`, `order`, `search`,
`ai-assistant` và `elasticsearch`. PostgreSQL dùng Supabase; RabbitMQ dùng cloud.
AI Assistant lưu checkpoint hội thoại vào PostgreSQL qua `DB_URI`.

```bash
cp .env.production.example .env.production
# Điền Supabase, RabbitMQ, JWT, DashScope và các dịch vụ tích hợp đang sử dụng.
docker compose --env-file .env.production -f docker-compose.prod.yaml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yaml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yaml ps
```

Giữ `.env.production` trên máy triển khai, không commit. `FRONTEND_URL` là origin
website; `NEXT_PUBLIC_API_URL` là URL API công khai được nhúng lúc build frontend.
Các khóa `DASHSCOPE_API_KEY`, `DASHSCOPE_API_KEY_AGENT_1` và
`DASHSCOPE_API_KEY_AGENT_2` phục vụ search và các agent chatbot.

Compose đặt `ELASTICSEARCH_NODE=http://elasticsearch:9200` cho Search Service và
chờ ES healthy trước khi khởi động search. Elasticsearch production tắt authentication,
chỉ mở cổng trong mạng Docker; các cổng gRPC cũng chỉ dùng trong mạng Docker.
Mặc định frontend mở cổng `80` (map vào cổng `3000` trong container), API mở cổng `8080`; cấu hình domain HTTPS qua
reverse proxy của máy triển khai.

### Build/push Docker Hub và chạy trên VPS

`docker-compose.hub.yaml` dùng image đã publish, không build và không cần source
code trên VPS. Hạ tầng và biến môi trường giống compose production: PostgreSQL
trên Supabase, RabbitMQ cloud, Elasticsearch chạy trên VPS. Hai compose production
dùng cùng project name `e-commerce-prod`, nên có thể chuyển sang image mà giữ volume ES.

Trên máy build đã cài Docker/Buildx, đăng nhập Docker Hub bằng access token rồi push
một tag cho toàn bộ năm ứng dụng và image migration:

```bash
docker login --username YOUR_DOCKERHUB_USERNAME
bash scripts/push-dockerhub.sh YOUR_DOCKERHUB_USERNAME v1.0.0 https://api.example.com
```

Script mặc định build `linux/amd64`; với VPS ARM64, đặt `IMAGE_PLATFORM=linux/arm64`
trước lệnh chạy script. `NEXT_PUBLIC_API_URL` được nhúng vào frontend lúc build;
URL truyền vào script phải trùng với URL API công khai trong `.env.production`.
Đổi URL này cần build/push lại frontend. Script dừng khi một image thất bại;
chỉ triển khai tag sau khi tất cả image đã push thành công.

Chỉ cần copy `docker-compose.hub.yaml` và `.env.production.example` lên VPS, sau đó:

```bash
cp .env.production.example .env.production
# Điền các cấu hình production, DOCKERHUB_NAMESPACE và IMAGE_TAG=v1.0.0.
chmod 600 .env.production
# Đăng nhập Docker Hub trên VPS nếu repository image là private.
docker compose --env-file .env.production -f docker-compose.hub.yaml config --quiet
docker compose --env-file .env.production -f docker-compose.hub.yaml pull
# Với database mới, điền ADMIN_PASSWORD và chạy migration trước khi khởi động:
docker compose --env-file .env.production -f docker-compose.hub.yaml --profile migration run --rm liquibase
docker compose --env-file .env.production -f docker-compose.hub.yaml up -d --no-build --wait
docker compose --env-file .env.production -f docker-compose.hub.yaml ps
```

Image `e-commerce-migrations` chứa sẵn changelog; migration là bước chạy riêng,
không tự chạy khi khởi động ứng dụng. Khi cập nhật, đổi `IMAGE_TAG` trong
`.env.production`, chạy lại `pull`, migration nếu release có thay đổi database,
rồi `up -d --no-build --wait`. Dùng tag release mới cho mỗi lần publish để có thể
chọn lại tag cũ khi cần. Rollback image không tự rollback database.

Các workflow CD hiện có push image ứng dụng khi publish GitHub Release; script
trên cho phép push thủ công và thêm image migration. Workflow `cd-deploy-vps.yml`
hiện dùng compose local; luồng triển khai VPS bằng Docker Hub này dùng các lệnh ở trên.

## Tài liệu và triển khai

- [`SETUP.md`](SETUP.md): hướng dẫn thiết lập môi trường Windows/WSL và VS Code.
- [`docker-compose.yaml`](docker-compose.yaml): hạ tầng dùng khi phát triển local.
- [`docker-compose.prod.yaml`](docker-compose.prod.yaml): cấu hình Compose cho môi trường production.
- [`docker-compose.hub.yaml`](docker-compose.hub.yaml): chạy trên VPS bằng image Docker Hub.
- [`scripts/push-dockerhub.sh`](scripts/push-dockerhub.sh): build/push bộ image cho một release.
- [`.github/workflows`](.github/workflows): các workflow build, kiểm tra và triển khai dịch vụ.
- [`docs/openapi`](docs/openapi): tài liệu contract OpenAPI trong repository.
