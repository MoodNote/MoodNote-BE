# MoodNote - Kế hoạch Triển khai (Implementation Plan)

**Version:** 1.0
**Last Updated:** 2026-03-05
**Stack:** Node.js + Express + Prisma + PostgreSQL | FastAPI + Python + MongoDB

---

## Tổng quan thứ tự triển khai

```
Phase 1: Nền tảng (Foundation)
  └─> 1.1 Project Setup & Infrastructure
  └─> 1.2 Database & Prisma Setup

Phase 2: Authentication
  └─> 2.1 Register & Email Verification
  └─> 2.2 Login & JWT
  └─> 2.3 Refresh Token & Logout
  └─> 2.4 Forgot Password & Reset Password

Phase 3: Mood Entry (CRUD)
  └─> 3.1 Create Entry
  └─> 3.2 Get / List Entries
  └─> 3.3 Update & Delete Entry

Phase 4: AI Emotion Service (FastAPI)
  └─> 4.1 FastAPI Setup & Health Check
  └─> 4.2 Text Preprocessing (Vietnamese NLP)
  └─> 4.3 Emotion Analysis Endpoint
  └─> 4.4 Keyword Extraction
  └─> 4.5 MongoDB Integration

Phase 5: Emotion Analysis Integration
  └─> 5.1 Backend gọi AI Service khi tạo Entry
  └─> 5.2 Cache kết quả vào PostgreSQL
  └─> 5.3 Retry & Circuit Breaker
  └─> 5.4 Get Analysis API

Phase 6: Music Service
  └─> 6.1 Song Database & Seeding
  └─> 6.2 Music Recommendation Engine
  └─> 6.3 Playlist CRUD

Phase 7: Statistics & Analytics
  └─> 7.1 User Statistics (cá nhân)
  └─> 7.2 Daily Statistics Aggregation (cron job)

Phase 8: Admin Dashboard APIs
  └─> 8.1 User Management
  └─> 8.2 Content Management (Songs)
  └─> 8.3 System Analytics

Phase 9: Non-functional
  └─> 9.1 Rate Limiting
  └─> 9.2 Logging & Monitoring
  └─> 9.3 Testing

Phase 10: Deployment
  └─> 10.1 Docker & Docker Compose
  └─> 10.2 CI/CD Pipeline
```

---

## Phase 1: Nền tảng (Foundation)

> **Trạng thái:** ✅ HOÀN THÀNH

### 1.1 Project Setup

**Backend (Node.js):**

- [x] Khởi tạo project: `npm init`, cấu trúc thư mục
- [x] Cài dependencies: `express@5.2.1`, `prisma@7.4.1`, `@prisma/adapter-pg`, `jsonwebtoken@9.0.3`, `bcrypt@6.0.0`, `nodemailer@8.0.0`, `zod@4.3.6`, `dotenv`, `cors@2.8.5`, `helmet@8.1.0`, `express-rate-limit@8.2.1`, `morgan@1.10.1`
- [x] Cấu trúc thư mục theo MVC (không dùng modules pattern):
    ```
    MoodNote-BE/
    ├── src/
    │   ├── config/           # database.ts, auth.config.ts, email.config.ts
    │   ├── controllers/      # auth.controller.ts
    │   ├── services/         # auth.service.ts, email.service.ts
    │   ├── routes/           # index.ts, auth.routes.ts
    │   ├── middlewares/      # auth, validate, rateLimit, bruteForce
    │   ├── utils/            # jwt.util.ts, password.util.ts, token.util.ts
    │   ├── validators/       # auth.validator.ts (Zod schemas)
    │   ├── app.ts
    │   └── index.ts
    ├── prisma/
    │   ├── schema.prisma
    │   ├── prisma.config.ts
    │   └── migrations/
    ├── docs/
    └── .env
    ```
- [x] Setup Express app: middleware pipeline (cors, helmet, morgan, json parser)
- [x] Global error handler middleware trong `app.ts`
- [x] Health check endpoint `GET /health`
- [x] Welcome endpoint `GET /`

**Ghi chú thực tế:**

- Dùng `bcrypt` (không phải `bcryptjs`), salt rounds = **12**
- Dùng `Zod` (không phải `joi`) cho toàn bộ validation
- TypeScript strict mode, output → `dist/`
- URL prefix: `/api/` (không phải `/v1/`)
- Express 5 — async errors tự propagate, không cần wrap `next(err)`

**AI Service (FastAPI):** — repo riêng (`MoodNote-AI`), chưa khởi tạo trong sprint này

### 1.2 Database & Prisma Setup

- [x] Tạo PostgreSQL database `moodnote`
- [x] Cấu hình `schema.prisma` với adapter `@prisma/adapter-pg`
- [x] Cấu hình `DATABASE_URL` trong `.env`
- [x] Chạy migrations, tạo các bảng ban đầu
- [x] Prisma client singleton tại `src/config/database.ts`
- [ ] Tạo `prisma/seed.ts` cho dữ liệu mẫu — chưa cần (thực hiện ở Phase 6)

**Models đã có:**

| Model               | Table                 | Mô tả                                                                               |
| ------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| `User`              | `users`               | Tài khoản người dùng (có `username`, `name`, `failedLoginAttempts`, `lockoutUntil`) |
| `EmailVerification` | `email_verifications` | OTP 6 chữ số xác thực email, TTL 24h                                                |
| `PasswordReset`     | `password_resets`     | OTP 6 chữ số reset mật khẩu, TTL 1h, có `isVerified`                                |
| `RefreshToken`      | `refresh_tokens`      | JWT refresh token lưu DB, có thể revoke                                             |

**Conventions DB:** tất cả field dùng `@map("snake_case")`, table dùng `@@map("snake_case")`, cascade delete theo user.

---

## Phase 2: Authentication

> **Trạng thái:** ✅ HOÀN THÀNH
>
> **File liên quan:** `src/controllers/auth.controller.ts`, `src/services/auth.service.ts`, `src/routes/auth.routes.ts`, `src/validators/auth.validator.ts`
>
> **Models:** User, EmailVerification, PasswordReset, RefreshToken

### 2.1 Register & Email Verification

**Endpoints:**

- `POST /api/auth/register`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`

**Logic:**

- [x] Validate input bằng Zod: `email`, `username`, `name`, `password` (strength check)
- [x] Kiểm tra email và username đã tồn tại chưa (throw lỗi riêng biệt cho từng trường)
- [x] Hash password bằng `bcrypt` (salt rounds = 12)
- [x] Tạo User với `isEmailVerified = false`
- [x] Tạo `EmailVerification` record — token là **OTP 6 chữ số**, hash SHA256 trước khi lưu DB, TTL 24h
- [x] Gửi email xác nhận HTML template qua `nodemailer`
- [x] Endpoint `verify-email`: tìm token (so sánh SHA256 hash), check hết hạn, check `isUsed`, set `isEmailVerified = true`, mark `isUsed = true`
- [x] Endpoint `resend-verification`: invalidate OTP cũ, tạo OTP mới, gửi lại email (rate limited)

**Ghi chú thực tế:**

- Token lưu DB là **SHA256(OTP)**, không phải raw OTP → bảo mật nếu DB bị lộ
- Dùng `prisma.$transaction()` cho các thao tác multi-step

### 2.2 Login & JWT

**Endpoints:**

- `POST /api/auth/login`

**Logic:**

- [x] Validate email + password bằng Zod
- [x] Kiểm tra `isEmailVerified` (trả lỗi cụ thể nếu chưa verify)
- [x] Kiểm tra `isActive`
- [x] Kiểm tra `lockoutUntil` (account lockout) — middleware `checkAccountLockout` chạy trước controller
- [x] So sánh password với `bcrypt.compare()`
- [x] Nếu sai: tăng `failedLoginAttempts`, lockout 15 phút sau **5** lần thất bại
- [x] Nếu đúng: reset `failedLoginAttempts = 0`, cập nhật `lastLoginAt`
- [x] Tạo Access Token (JWT, **24h**), ký bằng `JWT_SECRET`
- [x] Tạo Refresh Token (JWT, **7 ngày**), ký bằng `REFRESH_TOKEN_SECRET`, lưu vào `RefreshToken` table
- [x] Response: `{ success, message, data: { accessToken, refreshToken, user } }`

**JWT Payload (Access Token):**

```json
{ "userId": "uuid", "email": "...", "iat": ..., "exp": ... }
```

**Security config** (từ `src/config/auth.config.ts` + env):

- Access token: 24h (`JWT_EXPIRES_IN`)
- Refresh token: 7d (`REFRESH_TOKEN_EXPIRES_IN`)
- Max failed attempts: 5 (`MAX_LOGIN_ATTEMPTS`)
- Lockout duration: 15 phút / 900000ms (`LOCKOUT_DURATION`)

### 2.3 Refresh Token & Logout

**Endpoints:**

- `POST /api/auth/refresh`
- `POST /api/auth/logout`

**Logic:**

- [x] Refresh: verify JWT refresh token → tìm record trong DB, kiểm tra `isRevoked` và `expiresAt` → cấp Access Token mới
- [x] Logout: set `isRevoked = true` cho refresh token record
- [x] Middleware `authenticate` (`src/middlewares/auth.middleware.ts`): verify JWT access token, gắn `req.user = { userId, email }`

### 2.4 Forgot Password & Reset Password

**Endpoints:**

- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-reset-otp`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password` _(yêu cầu auth)_

**Logic:**

- [x] `forgot-password`: **không tiết lộ email có tồn tại không** (luôn trả 200 generic), tạo `PasswordReset` record (OTP 6 chữ số, hash SHA256, TTL 1h), gửi email HTML
- [x] `verify-reset-otp`: tìm OTP (so sánh SHA256 hash), kiểm tra hết hạn + `isUsed`, set `isVerified = true`
- [x] `reset-password`: tìm `PasswordReset` record có `isVerified = true` và chưa `isUsed`, hash password mới, update User, mark token `isUsed = true`, thu hồi **toàn bộ** refresh token của user
- [x] `change-password` (authenticated): xác nhận `currentPassword`, kiểm tra password mới không trùng cũ, hash + update, gửi email thông báo, thu hồi refresh token

**Middleware chain trên auth routes:**

```
authRateLimiter → validate(zodSchema) → controller
loginRateLimiter → checkAccountLockout → validate(zodSchema) → controller  (chỉ /login)
authenticate → validate(zodSchema) → controller                             (chỉ protected routes)
```

---

## Phase 3: Mood Entry (CRUD)

> **Trạng thái:** ⏳ CHƯA BẮT ĐẦU
>
> **Phụ thuộc:** Phase 2 hoàn thành (cần `authenticate` middleware)
>
> **File cần tạo:** `src/controllers/entry.controller.ts`, `src/services/entry.service.ts`, `src/routes/entry.routes.ts`, `src/validators/entry.validator.ts`, `src/utils/encryption.util.ts`
>
> **Models:** MoodEntry

### 3.0 Content Format

Nội dung nhật ký được lưu dưới dạng **Quill Delta JSON** — một mảng `ops` mô tả các block nội dung có định dạng. Đây là format chuẩn của Quill.js editor, phổ biến trên React Native.

**Cấu trúc Delta:**

```json
{
	"ops": [
		{ "insert": "Tiêu đề nhật ký\n", "attributes": { "header": 1 } },
		{
			"insert": "Đoạn văn căn giữa\n",
			"attributes": { "align": "center" }
		},
		{ "insert": "• Mục danh sách 1\n", "attributes": { "list": "bullet" } },
		{ "insert": "• Mục danh sách 2\n", "attributes": { "list": "bullet" } },
		{ "insert": "Nội dung thường, mặc định căn trái..." }
	]
}
```

**Các format được hỗ trợ:**

| Loại           | Attribute | Giá trị                                   |
| -------------- | --------- | ----------------------------------------- |
| Tiêu đề        | `header`  | `1` (H1), `2` (H2)                        |
| Căn lề         | `align`   | `"left"` (default), `"center"`, `"right"` |
| Danh sách chấm | `list`    | `"bullet"`                                |
| Danh sách số   | `list`    | `"ordered"`                               |
| In đậm         | `bold`    | `true`                                    |
| In nghiêng     | `italic`  | `true`                                    |

**Plain text extraction** (cho AI analysis ở Phase 5):

```ts
// Trích xuất plain text từ Delta để gửi AI
const extractPlainText = (delta: Delta): string =>
	delta.ops
		.filter((op) => typeof op.insert === "string")
		.map((op) => op.insert)
		.join("")
		.trim();
```

**Giới hạn nội dung:**

- Plain text sau khi extract: min **10** ký tự, max **5000** ký tự
- Validate plain text length (không validate JSON length)

### 3.1 Encryption Strategy

Mã hóa **AES-256-GCM** server-side cho toàn bộ nội dung nhạy cảm (`title` + `content` Delta JSON). Mỗi entry có một IV ngẫu nhiên riêng.

**Dữ liệu được mã hóa:**

```ts
// Payload trước khi mã hóa
interface EntryPayload {
	title: string | null;
	content: Delta; // Quill Delta object
}

// Encrypt → lưu vào DB
const { ciphertext, iv } = encrypt(JSON.stringify(payload), ENCRYPTION_KEY);
```

**Lưu trữ:**

- `encryptedContent` — ciphertext (base64)
- `contentIv` — IV (hex, 32 ký tự = 16 bytes)

**Dữ liệu KHÔNG mã hóa** (metadata, cần để query/filter):

- `wordCount`, `entryDate`, `tags`, `isPrivate`, `analysisStatus`, `inputMethod`

**Key management:**

- Key lấy từ env: `ENCRYPTION_KEY` — 64 hex chars (32 bytes)
- Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **Không bao giờ** commit key vào git

**Utility `encryption.util.ts`:**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

export function encrypt(plaintext: string, keyHex: string) {
	const key = Buffer.from(keyHex, "hex");
	const iv = randomBytes(16);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();
	// Store: authTag + encrypted together in ciphertext
	const ciphertext = Buffer.concat([authTag, encrypted]).toString("base64");
	return { ciphertext, iv: iv.toString("hex") };
}

export function decrypt(
	ciphertext: string,
	ivHex: string,
	keyHex: string,
): string {
	const key = Buffer.from(keyHex, "hex");
	const iv = Buffer.from(ivHex, "hex");
	const buf = Buffer.from(ciphertext, "base64");
	const authTag = buf.subarray(0, 16);
	const encrypted = buf.subarray(16);
	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);
	return decipher.update(encrypted) + decipher.final("utf8");
}
```

### 3.2 Schema Migration

Thêm enums và model `MoodEntry` vào `prisma/schema.prisma`, thêm relation `moodEntries MoodEntry[]` vào `User`.

```prisma
enum InputMethod {
  TEXT
  VOICE
}

enum AnalysisStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model MoodEntry {
  id               String         @id @default(uuid())
  userId           String
  // Encrypted fields
  encryptedContent String         @db.Text   // base64: authTag + AES-256-GCM(title + content)
  contentIv        String                    // hex-encoded IV (32 chars)
  // Plaintext metadata (for filtering/querying)
  wordCount        Int            @default(0)
  entryDate        DateTime                  // user-specified date (validated: <= now)
  inputMethod      InputMethod    @default(TEXT)
  tags             String[]       @default([])
  isPrivate        Boolean        @default(false)
  analysisStatus   AnalysisStatus @default(PENDING)
  aiAnalysisId     String?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, entryDate])
  @@index([userId, createdAt])
  @@index([analysisStatus])
  @@map("mood_entries")
}
```

Chạy: `npx prisma migrate dev --name add_mood_entries`

### 3.3 Create Entry

**Endpoint:** `POST /api/entries`

**Middleware chain:** `authenticate → validate(createEntrySchema) → controller`

**Request body:**

```json
{
	"title": "Ngày đặc biệt",
	"content": {
		"ops": [
			{
				"insert": "Hôm nay tôi rất vui...\n",
				"attributes": { "align": "left" }
			},
			{
				"insert": "• Hoàn thành dự án\n",
				"attributes": { "list": "bullet" }
			}
		]
	},
	"entryDate": "2026-03-04",
	"inputMethod": "TEXT",
	"tags": ["work", "happy"],
	"isPrivate": false
}
```

**Zod schema (`entry.validator.ts`):**

```
title:       string, optional, max 100 ký tự
content:     Delta object (ops array), required
  → extract plainText từ ops → validate min 10, max 5000 ký tự
entryDate:   ISO date string, optional, default today
  → validate: không được là ngày trong tương lai (> today)
inputMethod: enum ["TEXT", "VOICE"], optional, default "TEXT"
tags:        string[], optional, mỗi tag max 30 ký tự, tối đa 10 tags
isPrivate:   boolean, optional, default false
```

**Logic:**

- [ ] Extract `plainText` từ Delta ops để validate độ dài
- [ ] Tính `wordCount` từ `plainText.trim().split(/\s+/).length`
- [ ] Validate `entryDate <= today` (reject nếu là ngày mai trở đi)
- [ ] Gọi `encrypt(JSON.stringify({ title, content }), ENCRYPTION_KEY)` → `{ ciphertext, iv }`
- [ ] Insert `MoodEntry`: lưu `encryptedContent = ciphertext`, `contentIv = iv`, `entryDate`, các metadata plaintext
- [ ] _(Phase 5 sẽ thêm: trigger AI analysis async, truyền `plainText` đã extract)_
- [ ] Response 201

**Response:**

```json
{
  "success": true,
  "message": "Entry created successfully",
  "data": {
    "entry": {
      "id": "uuid",
      "title": "Ngày đặc biệt",
      "content": { "ops": [...] },
      "entryDate": "2026-03-04",
      "inputMethod": "TEXT",
      "tags": ["work", "happy"],
      "wordCount": 12,
      "isPrivate": false,
      "analysisStatus": "PENDING",
      "createdAt": "2026-03-05T10:00:00Z"
    }
  }
}
```

> **Lưu ý:** `encryptedContent` và `contentIv` **không bao giờ** được trả về client. Server luôn decrypt trước khi response.

### 3.4 List Entries

**Endpoint:** `GET /api/entries`

**Middleware chain:** `authenticate → validate(listEntrySchema) → controller`

**Query params (Zod schema):**

```
page:           number, min 1, default 1
limit:          number, min 1, max 100, default 20
startDate:      ISO date string, optional — filter theo entryDate
endDate:        ISO date string, optional — filter theo entryDate
tags:           string (comma-separated), optional
analysisStatus: enum AnalysisStatus, optional
```

**Logic:**

- [ ] Build Prisma `where`: `userId = req.user.userId`, filter theo `entryDate` range, `tags` (`hasSome`), `analysisStatus`
- [ ] `orderBy: { entryDate: 'desc' }`
- [ ] Dùng `prisma.$transaction([findMany, count])` để lấy data + count cùng lúc
- [ ] Với mỗi entry: decrypt `encryptedContent` → parse JSON → lấy `title` + cắt `plainText` preview 150 ký tự đầu
- [ ] Không expose `encryptedContent`, `contentIv`, `aiAnalysisId` ra client

**Ghi chú thực tế:**

- Filter theo `entryDate` (không phải `createdAt`) vì user có thể backdate
- `content` trong list response chỉ trả **preview** dạng plain text 150 ký tự (không trả full Delta)

### 3.5 Get Entry Detail

**Endpoint:** `GET /api/entries/:id`

**Middleware chain:** `authenticate → controller`

**Logic:**

- [ ] Tìm entry theo `id`
- [ ] Kiểm tra ownership: `entry.userId !== req.user.userId` → throw 403
- [ ] Decrypt `encryptedContent` → parse JSON → lấy `{ title, content }` (full Delta)
- [ ] Include `emotionAnalysis` relation (null khi chưa có Phase 5)
- [ ] Response: entry đầy đủ với full Delta content

**Error cases:**
| Tình huống | Status | Error Code |
|-----------|--------|------------|
| `id` không tồn tại | 404 | `ENTRY_NOT_FOUND` |
| Entry của user khác | 403 | `FORBIDDEN` |

### 3.6 Update Entry

**Endpoint:** `PUT /api/entries/:id`

**Middleware chain:** `authenticate → validate(updateEntrySchema) → controller`

**Zod schema:** partial update, tất cả optional

```
title:     string, max 100 ký tự (nếu có)
content:   Delta object (nếu có) → validate plain text 10–5000 ký tự
tags:      string[], optional
isPrivate: boolean, optional
```

> `inputMethod` và `entryDate` **không** cho phép thay đổi sau khi tạo.

**Logic:**

- [ ] Tìm entry, kiểm tra ownership
- [ ] Nếu `title` hoặc `content` thay đổi:
    - Decrypt entry hiện tại → merge với data mới
    - Re-encrypt merged payload → ciphertext + iv mới
    - Nếu `content` thay đổi: tính lại `wordCount`, reset `analysisStatus = PENDING`, `aiAnalysisId = null`
    - _(Phase 5 sẽ thêm: xóa `EmotionAnalysisCache`, trigger re-analyze với plainText mới)_
- [ ] Nếu request body không chứa field nào hợp lệ → 400 `NO_FIELDS_TO_UPDATE`
- [ ] Response: entry đã update (đã decrypt)

### 3.7 Delete Entry

**Endpoint:** `DELETE /api/entries/:id`

**Middleware chain:** `authenticate → controller`

**Logic:**

- [ ] Tìm entry, kiểm tra ownership
- [ ] `prisma.moodEntry.delete({ where: { id } })` — cascade xóa relations liên quan (Phase 5, 6)
- [ ] Response: `{ success, message: "Entry deleted successfully" }`

### 3.8 Đăng ký routes

Trong `src/routes/index.ts`:

```ts
app.use("/api/entries", entryRouter);
```

**Tái dụng từ Phase 2:**

- `authenticate` middleware — `src/middlewares/auth.middleware.ts`
- `validate` middleware — `src/middlewares/validate.middleware.ts`
- Global error handler và response format

**Thêm mới:**

- `src/utils/encryption.util.ts` — `encrypt()` / `decrypt()`
- Env var: `ENCRYPTION_KEY` (64 hex chars)

---

## Phase 4: AI Emotion Service (FastAPI)

> **File liên quan:** `ai-service/app/`
> **Database:** MongoDB

### 4.1 FastAPI Setup & Health Check

- [ ] Setup FastAPI app với middleware (CORS, API Key validation)
- [ ] `GET /health` endpoint
- [ ] API Key middleware: validate `X-API-Key` header

### 4.2 Text Preprocessing

- [ ] Làm sạch text tiếng Việt (normalize unicode, remove noise)
- [ ] Tokenize (underthesea hoặc VnCoreNLP)
- [ ] Stopword removal (tiếng Việt)

### 4.3 Emotion Analysis Endpoint

**Endpoint:** `POST /v1/analyze`

- [ ] Load PhoBERT model khi startup
- [ ] Phân loại 6 cảm xúc: Vui vẻ, Buồn, Tức giận, Lo lắng, Sợ hãi, Bình thường
- [ ] Tính sentiment score (-1.0 đến 1.0)
- [ ] Tính intensity (0–100)
- [ ] Lưu full analysis vào MongoDB
- [ ] Response: summary (primary emotion, confidence, sentiment, intensity, keywords, analysisId)

### 4.4 Keyword Extraction

- [ ] TF-IDF hoặc KeyBERT để extract keywords
- [ ] Trả về top N keywords với relevance score và part-of-speech

### 4.5 MongoDB Integration

- [ ] Kết nối MongoDB với PyMongo
- [ ] Collection `emotion_analyses`: lưu full analysis với schema đầy đủ
- [ ] Collection `feedbacks`: lưu feedback người dùng
- [ ] `POST /v1/feedback` — nhận feedback để cải thiện model
- [ ] `GET /v1/analysis/:id` — lấy full analysis từ MongoDB
- [ ] `GET /v1/stats` — thống kê cho admin

---

## Phase 5: Emotion Analysis Integration

> **File liên quan:** `src/modules/emotions/`
> **Models:** EmotionAnalysisCache

### 5.1 Backend gọi AI Service

- [ ] `aiService.analyze(entryId, userId, content)` — gọi `POST /v1/analyze`
- [ ] Gọi async sau khi tạo entry (không block response)
- [ ] Update `analysisStatus = PROCESSING` trước khi gọi

### 5.2 Cache kết quả

- [ ] Nhận response từ AI Service
- [ ] Insert/Update `EmotionAnalysisCache`
- [ ] Update `MoodEntry.analysisStatus = COMPLETED` và `aiAnalysisId`

### 5.3 Retry & Circuit Breaker

- [ ] Retry 3 lần với exponential backoff (1s, 2s, 4s)
- [ ] Nếu fail: set `analysisStatus = FAILED`
- [ ] Background job (cron): retry các entry `FAILED` mỗi 5 phút (max 24h)
- [ ] Circuit breaker: mở sau 5 lần fail liên tiếp, thử lại sau 1 phút

### 5.4 Get Analysis API

**Endpoint:** `GET /v1/entries/:id/analysis`

- [ ] Kiểm tra cache trong `EmotionAnalysisCache`
- [ ] Nếu cache miss: gọi AI Service `GET /v1/analysis/:aiAnalysisId`
- [ ] Lưu vào cache sau khi fetch
- [ ] Response kèm `source: "cache" | "ai_service"`

---

## Phase 6: Music Service

> **File liên quan:** `src/modules/music/`
> **Models:** Song, Playlist, PlaylistSong, MusicRecommendation, RecommendationSong

### 6.1 Song Database & Seeding

- [ ] Tạo seed data: ~200 bài nhạc Việt với `moodTags`, `energyLevel`, `valence`
- [ ] Admin API để thêm/sửa/xóa bài hát (Phase 8)

### 6.2 Music Recommendation Engine

**Endpoint:** `POST /v1/recommendations/generate`

**Logic:**

- [ ] Lấy emotion analysis của entry từ cache
- [ ] Mode `MIRROR`: query songs có `moodTags` chứa primaryEmotion
- [ ] Mode `SHIFT`: nếu emotion tiêu cực → query songs có moodTag HAPPY/NEUTRAL
- [ ] Sắp xếp theo relevance (valence, energy phù hợp với sentiment score)
- [ ] Lưu vào `MusicRecommendation` + `RecommendationSong`
- [ ] Response: danh sách bài hát với relevanceScore

**Endpoint:** `GET /v1/recommendations/:id` — lấy recommendation đã tạo

### 6.3 Playlist CRUD

**Endpoints:**

- `POST /v1/playlists` — tạo playlist
- `GET /v1/playlists` — danh sách playlist của user
- `GET /v1/playlists/:id` — chi tiết playlist kèm songs
- `PUT /v1/playlists/:id` — cập nhật tên/mô tả
- `DELETE /v1/playlists/:id` — xóa playlist
- `POST /v1/playlists/:id/songs` — thêm bài vào playlist
- `DELETE /v1/playlists/:id/songs/:songId` — xóa bài khỏi playlist

---

## Phase 7: Statistics & Analytics

> **File liên quan:** `src/modules/stats/`
> **Models:** EmotionAnalysisCache, DailyStatistic

### 7.1 User Statistics

**Endpoint:** `GET /v1/users/me/statistics`

**Query params:** `period=7d|30d|90d`

**Response:**

- Biểu đồ sentiment theo ngày (line chart data)
- Phân phối cảm xúc (pie chart data)
- Top keywords trong kỳ
- Tổng số entries, average sentiment

**Logic:**

- [ ] Query `EmotionAnalysisCache` theo userId + date range
- [ ] Aggregate theo ngày: avg sentiment, count by emotion
- [ ] Extract top keywords từ JSON field

### 7.2 Daily Statistics Aggregation

- [ ] Cron job chạy lúc 00:05 mỗi ngày
- [ ] Aggregate dữ liệu ngày hôm trước
- [ ] Insert/Update `DailyStatistic`
- [ ] Tính: totalUsers, newUsers, activeUsers, totalEntries, avgSentiment, emotionDistribution, topKeywords

---

## Phase 8: Admin Dashboard APIs

> **File liên quan:** `src/modules/admin/`
> **Middleware:** `requireAdmin` (role = ADMIN)

### 8.1 User Management

**Endpoints:**

- `GET /v1/admin/users` — danh sách users (pagination, search, filter)
- `GET /v1/admin/users/:id` — chi tiết user
- `PUT /v1/admin/users/:id/status` — activate/deactivate user
- `PUT /v1/admin/users/:id/role` — thay đổi role

### 8.2 Content Management (Songs)

**Endpoints:**

- `GET /v1/admin/songs` — danh sách bài hát
- `POST /v1/admin/songs` — thêm bài hát
- `PUT /v1/admin/songs/:id` — cập nhật bài hát
- `DELETE /v1/admin/songs/:id` — xóa bài hát (soft delete: `isActive = false`)

### 8.3 System Analytics

**Endpoints:**

- `GET /v1/admin/analytics` — tổng quan hệ thống
- `GET /v1/admin/analytics/daily` — thống kê theo ngày (từ `DailyStatistic`)
- `GET /v1/admin/analytics/ai` — proxy đến AI Service `GET /v1/stats`

---

## Phase 9: Non-functional Requirements

### 9.1 Rate Limiting

- [ ] Global: 100 req/phút cho USER
- [ ] Global: 500 req/phút cho ADMIN
- [ ] Strict: 10 req/phút cho auth endpoints (login, register)
- [ ] Dùng `express-rate-limit` + `rate-limit-redis` (nếu có Redis)

### 9.2 Logging & Monitoring

- [ ] Structured logging với `winston`
- [ ] Log mỗi request: method, path, userId, duration, statusCode
- [ ] Log riêng AI service calls: duration, status
- [ ] Request ID middleware (gắn `x-request-id` vào mỗi request)

### 9.3 Testing

**Unit Tests:**

- [ ] Auth service: register, login, token logic
- [ ] Emotion cache service
- [ ] Recommendation engine logic

**Integration Tests:**

- [ ] Auth flow end-to-end
- [ ] Create entry → AI analysis flow
- [ ] Recommendation generation

**Tools:** Jest (Node.js), Pytest (Python)

---

## Phase 10: Deployment

### 10.1 Docker & Docker Compose

- [ ] `Dockerfile` cho backend Node.js
- [ ] `Dockerfile` cho AI Service FastAPI
- [ ] `docker-compose.yml` cho local dev:
    - postgres, mongodb, redis
    - backend, ai-service
- [ ] `.env.example` cho mỗi service

### 10.2 CI/CD

- [ ] GitHub Actions workflow:
    - Chạy tests khi push/PR
    - Build Docker images khi merge vào main
    - Deploy lên server

---

## Dependency Map

```
Phase 1 ──────────────────────────────► Tất cả các phase còn lại
Phase 2 (Auth) ────────────────────────► Phase 3, 6, 7, 8
Phase 3 (Entry) ───────────────────────► Phase 5
Phase 4 (AI Service) ──────────────────► Phase 5
Phase 5 (Integration) ─────────────────► Phase 6, 7
Phase 6 (Music) ───────────────────────► Phase 7, 8
Phase 7 (Stats) ───────────────────────► Phase 8
Phase 8 (Admin) ───────────────────────► Phase 9
Phase 9 ───────────────────────────────► Phase 10
```

---

## Checklist tóm tắt

| Phase | Mô tả              | Ưu tiên            |
| ----- | ------------------ | ------------------ |
| 1     | Foundation & Setup | 🔴 Critical        |
| 2     | Authentication     | 🔴 Critical        |
| 3     | Mood Entry CRUD    | 🔴 Critical        |
| 4     | AI Emotion Service | 🔴 Critical        |
| 5     | AI Integration     | 🔴 Critical        |
| 6     | Music Service      | 🟡 High            |
| 7     | Statistics         | 🟡 High            |
| 8     | Admin Dashboard    | 🟠 Medium          |
| 9     | Non-functional     | 🟠 Medium          |
| 10    | Deployment         | 🟢 Low (MVP local) |
