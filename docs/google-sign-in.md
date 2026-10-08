# Đăng nhập Google

Trang `/auth/login` dùng Google Identity Services để nhận ID token, gửi qua server action đến `POST /api/v1/auth/google`. API xác minh chữ ký, audience, issuer và thời hạn bằng `google-auth-library`, sau đó cấp access/refresh token của ứng dụng. Refresh token được frontend giữ trong cookie HTTP-only như đăng nhập mật khẩu.

## Cấu hình

Trong Google Cloud Console, tạo OAuth Client ID loại **Web application**. Cấu hình consent screen và Authorized JavaScript origins gồm origin của frontend, ví dụ `http://localhost:3000` khi phát triển và `https://shop.example.com` khi triển khai. Production cần HTTPS. Luồng popup này không dùng client secret và không cần redirect URI `/api/auth/google`.

Thay giá trị mẫu trong env:

```dotenv
GOOGLE_CLIENT_ID=replace-me.apps.googleusercontent.com
```

Frontend và API phải dùng **cùng một Client ID**. Docker Compose prod/hub truyền biến này vào cả hai container ở runtime. Local: đặt biến trong `packages/e-commerce-api/.env` và `packages/e-commerce-front/.env.local`. Khi chưa thay placeholder, trang hiển thị thông báo chưa cấu hình, không dẫn đến đường dẫn 404.

Chạy migration Liquibase chứa `auth/z_google_accounts.changelog.yaml` trước khi dùng tính năng. Với production build từ source:

```bash
docker compose -f docker-compose.prod.yaml --profile migration run --rm liquibase
docker compose -f docker-compose.prod.yaml up -d --build --no-deps api frontend
```

Nếu Supabase dùng transaction pooler port `6543`, đặt `LIQUIBASE_URL` trong env với tham số `prepareThreshold=0` để tránh lỗi prepared statement của JDBC, ví dụ `jdbc:postgresql://YOUR_DB_HOST:6543/postgres?sslmode=require&prepareThreshold=0`.

Nếu dùng `.env.production`, thêm `--env-file .env.production` trước `-f`. Sau khi chỉ thay Client ID, recreate hai container để nạp env mới:

```bash
docker compose -f docker-compose.prod.yaml up -d --no-deps --force-recreate api frontend
```

## Tài khoản

Google subject (`sub`) được lưu riêng trong `google_accounts` làm khóa định danh ổn định. Lần đầu đăng nhập tạo tài khoản email đã xác thực và quyền USER trong cùng transaction, không yêu cầu OTP. Mật khẩu khởi tạo là giá trị ngẫu nhiên không cung cấp cho người dùng. Những lần sau lấy tài khoản qua Google subject, không qua email. Tài khoản bị khóa hoặc xóa không được đăng nhập.

Email đã thuộc một tài khoản mật khẩu sẽ không được tự động liên kết; giao diện yêu cầu đăng nhập bằng mật khẩu. Chức năng liên kết Google sau khi xác thực tài khoản hiện có chưa nằm trong luồng này.

Hướng dẫn Google: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid và https://developers.google.com/identity/gsi/web/guides/verify-google-id-token.
