# MoodNote Backend (MoodNote-BE)

![Node.js](https://img.shields.io/badge/Node.js-LTS-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7.4.1-2D3748?logo=prisma&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue.svg)

Backend REST API for the MoodNote ecosystem. This service handles authentication, user profile, mood journal entries, notifications, and admin operations.

---

## Mục lục

- [Tiếng Việt](#tiếng-việt)
- [English](#english)

---

## Tiếng Việt

### 1) Tổng quan

MoodNote-BE là backend Node.js + TypeScript cho ứng dụng nhật ký cảm xúc MoodNote.

Backend này chịu trách nhiệm:

- Xác thực người dùng (JWT + refresh token)
- Quản lý hồ sơ người dùng
- Quản lý mood entries (lưu, sửa, xóa, liệt kê)
- Hệ thống thông báo (in-app + FCM token)
- Chức năng admin (đăng nhập admin, quản lý user, gửi thông báo)

Hệ sinh thái liên quan:

- MoodNote (mobile app)
- MoodNote-Admin (dashboard)
- MoodNote-AI (microservice phân tích cảm xúc)

### 2) Công nghệ chính

- Node.js (LTS)
- Express 5
- TypeScript (strict)
- Prisma + PostgreSQL
- Zod (input validation)
- JWT + bcrypt
- Nodemailer (SMTP)
- Firebase Admin SDK (FCM)
- node-cron (nhắc nhở định kỳ)

### 3) Yêu cầu trước khi chạy

- Node.js LTS
- npm
- PostgreSQL đang chạy
- Tạo file `.env` từ `.env.example`

### 4) Cài đặt nhanh (Local)

1. Cài dependencies

```bash
npm install
```

2. Tạo file môi trường

```bash
cp .env.example .env
```

Windows CMD (không có `cp`):

```bat
copy .env.example .env
```

3. Cập nhật các biến quan trọng trong `.env`

- `DATABASE_URL`
- `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ADMIN_JWT_SECRET`
- `ENCRYPTION_KEY` (64 ký tự hex)
- Cấu hình SMTP nếu cần gửi email

4. Chạy migration

```bash
npm run prisma:migrate
```

5. (Tuỳ chọn) Seed dữ liệu

```bash
npm run prisma:seed
```

6. Chạy server dev

```bash
npm run dev
```

Mặc định server chạy tại `http://localhost:3000`.

### 5) Scripts

- `npm run dev`: chạy môi trường development (nodemon + ts-node)
- `npm run build`: compile TypeScript sang `dist/`
- `npm run start`: chạy bản build production
- `npm run prisma:migrate`: tạo/apply migration
- `npm run prisma:studio`: mở Prisma Studio
- `npm run prisma:seed`: seed dữ liệu
- `npm run prisma:reset`: reset dữ liệu (destructive, dùng cẩn thận)

### 6) Cấu hình môi trường

Nhóm biến trong `.env.example`:

- Server: `PORT`, `NODE_ENV`
- Database: `DATABASE_URL`
- JWT user: `JWT_SECRET`, `JWT_EXPIRES_IN`
- JWT refresh: `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRES_IN`
- JWT admin: `ADMIN_JWT_SECRET`, `ADMIN_JWT_EXPIRES_IN`
- Bcrypt: `BCRYPT_SALT_ROUNDS` (khuyến nghị tối thiểu 12)
- SMTP email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`
- App URLs: `FRONTEND_URL`, `BACKEND_URL`
- Token/session expiry: `EMAIL_VERIFICATION_EXPIRY`, `PASSWORD_RESET_EXPIRY`, `SESSION_TIMEOUT`
- Security: `MAX_LOGIN_ATTEMPTS`, `LOCKOUT_DURATION`, `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX_REQUESTS`
- Encryption: `ENCRYPTION_KEY`

Tạo nhanh `ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 7) Firebase FCM (Tuỳ chọn)

Để bật push notifications qua Firebase:

1. Tạo service account key từ Firebase Console.
2. Lưu file dưới tên `serviceAccountKey.json` tại `src/config/`.

Nếu file không tồn tại, backend vẫn chạy bình thường và tự tắt phần FCM.

### 8) API Overview

Base API: `http://localhost:3000/api`

System routes:

- `GET /` (welcome)
- `GET /health` (health check hiện tại theo code)

User routes:

- `/api/auth`
- `/api/entries`
- `/api/users`
- `/api/notifications`

Admin routes:

- `/api/admin/auth`
- `/api/admin/users`
- `/api/admin/notifications`

Tài liệu API chi tiết:

- `docs/users/api-spec-auth.md`
- `docs/users/api-spec-entries.md`
- `docs/users/api-spec-users.md`
- `docs/users/api-spec-notifications.md`
- `docs/users/api-spec-health.md`
- `docs/admin/api-spec-auth.md`
- `docs/admin/api-spec-users.md`
- `docs/admin/api-spec-notifications.md`

### 9) Kiến trúc thư mục

```text
src/
  config/         # cấu hình (DB, auth, email, firebase)
  controllers/    # xử lý HTTP request/response
  services/       # business logic
  middlewares/    # auth, validate, rate limit, brute force
  validators/     # Zod schemas
  routes/         # định tuyến API
  utils/          # hàm tiện ích (jwt, password, token, encryption, fcm)
  jobs/           # scheduled jobs (reminders)
```

Luồng request chính:

1. Middleware (rate limit, auth, validate...)
2. Route
3. Controller
4. Service
5. Prisma/Utils/External services

### 10) Bảo mật & nguyên tắc

- Không log password/token/OTP/content nhạy cảm.
- Không trả password trong response.
- Hash password với bcrypt.
- Hash token OTP/reset trước khi lưu DB.
- Bật middleware xác thực cho route cần bảo vệ.
- Áp dụng rate limiting và lockout chống brute force.
- Lọc dữ liệu theo đúng user ownership ở mọi truy vấn cá nhân.

### 11) Tích hợp dịch vụ ngoài

- SMTP (Nodemailer): gửi OTP và email thông báo
- Firebase FCM: gửi push notification
- MoodNote-AI: phân tích cảm xúc (nếu service AI lỗi, hệ thống nên degrade gracefully)

### 12) Troubleshooting nhanh

- Lỗi kết nối DB: kiểm tra `DATABASE_URL` và PostgreSQL đang chạy.
- Không gửi được email: kiểm tra `EMAIL_*`, đặc biệt app password khi dùng Gmail.
- Notification push không chạy: kiểm tra `src/config/serviceAccountKey.json`.
- Lỗi JWT: kiểm tra đủ các secret (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ADMIN_JWT_SECRET`).

---

## English

### 1) Overview

MoodNote-BE is the Node.js + TypeScript backend for the MoodNote mood-journaling ecosystem.

It is responsible for:

- User authentication (JWT + refresh token)
- User profile management
- Mood entry management (create, list, update, delete)
- Notification system (in-app + FCM device token)
- Admin capabilities (admin login, user management, broadcast/targeted notifications)

Related ecosystem services:

- MoodNote (mobile app)
- MoodNote-Admin (web dashboard)
- MoodNote-AI (emotion analysis microservice)

### 2) Main Tech Stack

- Node.js (LTS)
- Express 5
- TypeScript (strict)
- Prisma + PostgreSQL
- Zod validation
- JWT + bcrypt
- Nodemailer (SMTP)
- Firebase Admin SDK (FCM)
- node-cron (scheduled reminders)

### 3) Prerequisites

- Node.js LTS
- npm
- Running PostgreSQL instance
- `.env` file copied from `.env.example`

### 4) Quick Start (Local)

1. Install dependencies

```bash
npm install
```

2. Create environment file

```bash
cp .env.example .env
```

Windows CMD alternative:

```bat
copy .env.example .env
```

3. Update critical values in `.env`

- `DATABASE_URL`
- `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ADMIN_JWT_SECRET`
- `ENCRYPTION_KEY` (64-hex string)
- SMTP settings if email features are enabled

4. Run migrations

```bash
npm run prisma:migrate
```

5. (Optional) Seed initial data

```bash
npm run prisma:seed
```

6. Start development server

```bash
npm run dev
```

Default server URL: `http://localhost:3000`.

### 5) Scripts

- `npm run dev`: development mode (nodemon + ts-node)
- `npm run build`: compile TypeScript to `dist/`
- `npm run start`: run compiled production build
- `npm run prisma:migrate`: create/apply Prisma migrations
- `npm run prisma:studio`: open Prisma Studio
- `npm run prisma:seed`: seed database
- `npm run prisma:reset`: reset data (destructive)

### 6) Environment Configuration

Environment groups in `.env.example`:

- Server: `PORT`, `NODE_ENV`
- Database: `DATABASE_URL`
- User JWT: `JWT_SECRET`, `JWT_EXPIRES_IN`
- Refresh JWT: `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRES_IN`
- Admin JWT: `ADMIN_JWT_SECRET`, `ADMIN_JWT_EXPIRES_IN`
- Bcrypt: `BCRYPT_SALT_ROUNDS` (recommended minimum: 12)
- SMTP email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`
- App URLs: `FRONTEND_URL`, `BACKEND_URL`
- Token/session expiry: `EMAIL_VERIFICATION_EXPIRY`, `PASSWORD_RESET_EXPIRY`, `SESSION_TIMEOUT`
- Security controls: `MAX_LOGIN_ATTEMPTS`, `LOCKOUT_DURATION`, `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX_REQUESTS`
- Encryption: `ENCRYPTION_KEY`

Generate an encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 7) Firebase FCM Setup (Optional)

To enable push notifications:

1. Create a Firebase service account key.
2. Save it as `serviceAccountKey.json` in `src/config/`.

If the file is missing, the backend still runs and FCM features are disabled gracefully.

### 8) API Overview

Base API URL: `http://localhost:3000/api`

System routes:

- `GET /` (welcome)
- `GET /health` (currently implemented in code)

User routes:

- `/api/auth`
- `/api/entries`
- `/api/users`
- `/api/notifications`

Admin routes:

- `/api/admin/auth`
- `/api/admin/users`
- `/api/admin/notifications`

Detailed API docs:

- `docs/users/api-spec-auth.md`
- `docs/users/api-spec-entries.md`
- `docs/users/api-spec-users.md`
- `docs/users/api-spec-notifications.md`
- `docs/users/api-spec-health.md`
- `docs/admin/api-spec-auth.md`
- `docs/admin/api-spec-users.md`
- `docs/admin/api-spec-notifications.md`

### 9) Folder Architecture

```text
src/
  config/         # configuration (DB, auth, email, firebase)
  controllers/    # HTTP request/response handlers
  services/       # business logic
  middlewares/    # auth, validation, rate limiting, brute force controls
  validators/     # Zod schemas
  routes/         # API route definitions
  utils/          # helper utilities (jwt, password, token, encryption, fcm)
  jobs/           # scheduled jobs (reminders)
```

Request flow:

1. Middleware
2. Route
3. Controller
4. Service
5. Prisma/Utilities/External services

### 10) Security Notes

- Never log passwords, tokens, OTPs, or sensitive content.
- Never expose password fields in API responses.
- Use bcrypt hashing for passwords.
- Hash OTP/reset tokens before database storage.
- Protect private routes with authentication middleware.
- Use rate limiting and brute-force lockout controls.
- Always enforce per-user ownership filtering for private resources.

### 11) External Integrations

- SMTP (Nodemailer): OTP and transactional emails
- Firebase FCM: push notifications
- MoodNote-AI: emotion analysis (backend should degrade gracefully if AI service is unavailable)

### 12) Quick Troubleshooting

- Database connection failures: verify `DATABASE_URL` and PostgreSQL status.
- Email send failures: verify `EMAIL_*` settings and app password (for Gmail).
- FCM not working: verify `src/config/serviceAccountKey.json`.
- JWT issues: verify all secrets (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ADMIN_JWT_SECRET`).

---

## Notes

- API specification files are available under `docs/users/` and `docs/admin/`.
- Product and system requirements are documented in `docs/MoodNote_SRS.md`.
