# Event và carousel

## Các trang

- `/admin/event`: danh sách, tìm theo tiêu đề, sắp xếp, phân trang.
- `/admin/event/new`: tạo event.
- `/admin/event/[eventId]`: chỉnh sửa hoặc xóa, có xác nhận trước khi xóa.
- `/event`: danh sách event đã xuất bản.
- `/event/[slug]`: chi tiết event công khai và metadata SEO.

Các API quản lý `/api/v1/events` yêu cầu quyền Event của ADMIN. API `/api/v1/public/events`, `/api/v1/public/events/carousel` và `/api/v1/public/events/[slug]` cho phép khách truy cập. Không tự cấp quyền quản lý event cho USER.

## Các field

| Field | Ý nghĩa |
| --- | --- |
| `title` | Tiêu đề bắt buộc, tối đa 200 ký tự |
| `slug` | Đường dẫn duy nhất, chữ thường/số/gạch nối, tối đa 200 ký tự |
| `thumbnailUrl` | Ảnh thumbnail/banner HTTP hoặc HTTPS; dùng upload giống product, nên dùng ảnh ngang 16:9 |
| `description` | Rich text bằng editor của product, hỗ trợ ảnh; API lọc HTML nguy hiểm trước khi lưu |
| `summary` | Tóm tắt ngắn xuất hiện trên carousel, tối đa 500 ký tự |
| `startsAt`, `endsAt` | Ngày giờ bắt đầu và kết thúc, kết thúc phải sau bắt đầu |
| `isPublished` | Mặc định bản nháp; xuất bản yêu cầu nội dung có chữ hoặc ảnh |
| `showOnCarousel` | Cho phép event xuất hiện trên carousel, mặc định bật |
| `sortOrder` | Số không âm, số nhỏ hiển thị trước |
| `createdAt`, `updatedAt` | Hệ thống tự ghi nhận |
| `status` | Tự tính: draft, upcoming, active, ended |

Form admin nhập theo múi giờ của thiết bị, gửi UTC ISO về API. PostgreSQL lưu `timestamptz`. Trang chi tiết công khai hiển thị giờ Việt Nam. Không tự cộng thêm 7 giờ vào giá trị đã chuyển UTC.

## Quy tắc hiển thị

Carousel lấy tối đa 20 event có `isPublished=true`, `showOnCarousel=true`, `startsAt <= now < endsAt`. Thứ tự: `sortOrder` tăng dần, ngày bắt đầu mới hơn, ID làm tiêu chí phụ. Poll API mỗi 30 giây để nhận event mới bắt đầu; event đã tải sẽ được gỡ đúng thời điểm hết hạn trên trình duyệt. Đổi tab/quay lại cũng kích hoạt refetch theo cấu hình query hiện có.

Không có event phù hợp thì carousel ẩn, không còn slide demo gán cứng. Một event không có nút điều hướng hay tự chuyển. Carousel dừng tự chuyển khi hover/focus và tôn trọng tùy chọn giảm chuyển động của thiết bị.

Trang danh sách và chi tiết vẫn hiển thị event đã xuất bản sau khi kết thúc, giúp liên kết chia sẻ còn truy cập được; ngày giờ và trạng thái cho biết event đã hết hạn. Bỏ xuất bản sẽ ẩn khỏi trang công khai. Event chưa xuất bản trả 404 khi truy cập bằng slug. Cache trình duyệt được cập nhật khi lưu/xóa; người xem khác nhận thay đổi carousel ở lần polling kế tiếp.

## Migration và triển khai

Migration `system/z_events.changelog.yaml` (`events-v1`) được master changelog include tự động. Nó tạo bảng events, ràng buộc ngày/slug/thứ tự, chỉ mục carousel và bốn quyền Event cho ADMIN. Không sửa changelog seed quyền cũ.

Sau khi migration đã được áp dụng trên database đích, cập nhật source lên VPS rồi rebuild API và frontend:

```bash
docker compose -f docker-compose.prod.yaml up -d --build --no-deps api frontend
```

Nếu database khác chưa có migration:

```bash
docker compose -f docker-compose.prod.yaml --profile migration run --rm liquibase
```

Supabase transaction pooler port 6543 cần JDBC `prepareThreshold=0` trong `LIQUIBASE_URL`, ví dụ `jdbc:postgresql://YOUR_DB_HOST:6543/postgres?sslmode=require&prepareThreshold=0`.

## Đề xuất cho bước tiếp theo

Nếu cần chiến dịch khuyến mãi thực tế, bổ sung liên kết sản phẩm/danh mục và voucher gắn với event. Có thể thêm ảnh riêng cho mobile và thống kê lượt xem/click khi đã có nhu cầu. Event hiện tại là nội dung truyền thông; ngày event không tự thay giá sản phẩm hay áp voucher.
