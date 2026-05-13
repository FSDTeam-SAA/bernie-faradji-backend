# NestJS Production Boilerplate v3

A clean, production-ready NestJS boilerplate with MongoDB, JWT authentication, role-based access control, rate limiting, file uploads, and email support. Built to scale without over-engineering.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| Language | TypeScript 5 |
| Database | MongoDB via Mongoose 8 |
| Auth | JWT (Access + Refresh tokens) |
| Validation | class-validator + class-transformer |
| File Upload | Cloudinary + Multer |
| Email | Nodemailer (SMTP) |
| Rate Limiting | @nestjs/throttler |
| Password Hashing | bcryptjs |

---

## Project Structure

```
src/
│
├── main.ts                           # Bootstrap — global pipes, filters, interceptors
├── app.module.ts                     # Root module — wires everything together
├── app.controller.ts                 # Root routes: GET / and GET /health
├── app.service.ts                    # Root service
│
├── config/                           # Typed, namespaced environment config
│   ├── app.config.ts                 # port, env, frontendUrl, rateLimit
│   ├── auth.config.ts                # JWT secrets, expiry, OTP expiry
│   ├── database.config.ts            # MongoDB URI
│   ├── email.config.ts               # SMTP host, port, credentials
│   ├── cloudinary.config.ts          # Cloudinary credentials
│   └── index.ts                      # Barrel export of all configs
│
├── core/                             # App-wide constants and interfaces
│   ├── constants/
│   │   └── index.ts                  # USER_SELECT_FIELDS, USER_LIST_FIELDS, DEFAULT_PAGE, etc.
│   └── interfaces/
│       ├── index.ts                  # Barrel export
│       ├── jwt-payload.interface.ts  # IJwtPayload
│       └── pagination.interface.ts   # IMeta, IPaginationInfo, IPaginatedResponse
│
├── common/                           # Reusable cross-cutting pieces
│   ├── decorators/
│   │   ├── public.decorator.ts       # @Public() — bypasses JwtAuthGuard
│   │   ├── roles.decorator.ts        # @Roles(RoleType.ADMIN) — sets required roles
│   │   └── current-user.decorator.ts # @CurrentUser() — injects req.user into params
│   ├── enums/
│   │   └── role.enum.ts              # RoleType: USER | ADMIN
│   ├── filters/
│   │   └── global-exception.filter.ts# Catches all exceptions → structured error response
│   ├── guards/
│   │   ├── jwt-auth.guard.ts         # Verifies JWT, attaches user to request (global)
│   │   └── roles.guard.ts            # Checks user role against @Roles() metadata
│   ├── interceptors/
│   │   └── response.interceptor.ts   # Wraps all responses → { statusCode, success, message, data }
│   ├── logger/
│   │   ├── app-logger.service.ts     # Custom structured logger (global)
│   │   └── logger.module.ts          # @Global() module — injectable everywhere
│   └── utils/
│       ├── hash.util.ts              # hashPassword(), comparePassword()
│       ├── otp.util.ts               # generateOtp() — 6-digit OTP
│       └── pagination.util.ts        # createFilter(), createMeta(), createPaginationInfo()
│
├── infrastructure/                   # External service adapters
│   ├── database/
│   │   └── database.module.ts        # MongoDB connection via Mongoose
│   ├── cloudinary/
│   │   ├── cloudinary.module.ts      # Cloudinary module
│   │   └── cloudinary.service.ts     # uploadFile(), deleteFile()
│   └── email/
│       ├── email.module.ts           # Email module
│       └── email.service.ts          # sendOtpEmail(), sendWelcomeEmail()
│
└── modules/                          # Feature modules
    ├── auth/
    │   ├── auth.module.ts            # Wires auth pieces + JwtModule
    │   ├── auth.controller.ts        # POST /auth/* routes
    │   ├── auth.service.ts           # register, login, refresh, OTP flow, logout
    │   ├── dto/
    │   │   └── auth.dto.ts           # RegisterDto, LoginDto, ForgetPasswordDto, etc.
    │   └── schemas/
    │       └── user.schema.ts        # User schema + comparePassword(), token methods
    └── user/
        ├── user.module.ts            # Wires user pieces
        ├── user.controller.ts        # GET/PATCH/DELETE /user/* routes
        ├── user.service.ts           # getProfile, updateProfile, getAllUsers, etc.
        └── dto/
            └── user.dto.ts           # GetUsersQueryDto, UpdateUserDto, AdminUpdateUserDto
```

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd nest-boilerplate-v3
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
# then fill in your values
```

### 3. Run

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

Server starts at: `http://localhost:5000/api/v1`

---

## Environment Variables

Create a `.env` file in the root with the following:

```env
# App
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/<dbname>

# JWT
ACCESS_TOKEN_SECRET=your-access-secret-change-in-prod
ACCESS_TOKEN_EXPIRES=7d
REFRESH_TOKEN_SECRET=your-refresh-secret-change-in-prod
REFRESH_TOKEN_EXPIRES=10d

# OTP expiry in milliseconds (900000 = 15 minutes)
EMAIL_EXPIRES=900000

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_ADDRESS=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
ADMIN_EMAIL=admin@yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

> **Gmail tip:** Use an App Password, not your account password. Enable 2FA first, then generate at myaccount.google.com/apppasswords.

---

## API Routes

All routes prefixed with `/api/v1`.

### Auth — `/api/v1/auth`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register new user |
| POST | `/auth/login` | Public | Login — returns access + refresh token |
| POST | `/auth/refresh-token` | Public | Issue new access token using refresh token |
| POST | `/auth/forget-password` | Public | Send OTP to email |
| POST | `/auth/verify-code` | Public | Verify OTP code |
| POST | `/auth/reset-password` | Public | Set new password after OTP verified |
| POST | `/auth/change-password` | JWT Required | Change password (old + new) |
| POST | `/auth/logout` | JWT Required | Invalidate refresh token |

### User — `/api/v1/user`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/user/profile` | JWT Required | Get current user profile |
| PATCH | `/user/profile` | JWT Required | Update current user profile |
| GET | `/user/all` | Admin Only | Get all users (paginated + filterable) |
| GET | `/user/:id` | Admin Only | Get user by ID |
| PATCH | `/user/:id` | Admin Only | Admin update any user |
| DELETE | `/user/:id` | Admin Only | Delete user |

### Health — `/api/v1`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | Server running check |
| GET | `/health` | Public | Returns `{ status: 'ok', timestamp }` |

---

## Request & Response Format

### Sending a request

```
POST /api/v1/auth/login
Content-Type: application/json
Authorization: Bearer <accessToken>   ← for protected routes

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Success response

Every successful response is automatically wrapped by `ResponseInterceptor`:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "_id": "...", "name": "John", "email": "..." },
    "accessToken": "eyJhbGci..."
  },
  "responseTime": "14ms"
}
```

### Error response

Every exception is caught by `GlobalExceptionFilter`:

```json
{
  "statusCode": 404,
  "success": false,
  "message": "User not found",
  "errorSources": [
    {
      "path": "/api/v1/user/profile",
      "message": "User not found"
    }
  ],
  "stack": "..."
}
```

> `stack` is only included when `NODE_ENV=development`.

---

## Authentication Flow

```
1. Register / Login
         ↓
   Returns accessToken (7d) + refreshToken (10d)
         ↓
2. Client sends accessToken in every request header:
   Authorization: Bearer <accessToken>
         ↓
3. JwtAuthGuard verifies token + fetches user from DB
         ↓
4. @CurrentUser() injects user into controller params
         ↓
5. When accessToken expires:
   POST /auth/refresh-token  { refreshToken }
         ↓
   Returns new accessToken + new refreshToken (rotating)
         ↓
6. Logout:
   POST /auth/logout
         ↓
   refreshToken set to null in DB — old token invalid immediately
```

---

## Password Reset Flow

```
1. POST /auth/forget-password   { email }
         ↓
   OTP generated → saved to DB → sent to email (15 min expiry)
         ↓
2. POST /auth/verify-code       { email, otp }
         ↓
   OTP cleared → otpVerified: true → 15 min reset window starts
         ↓
3. POST /auth/reset-password    { email, newPassword }
         ↓
   Password hashed by pre-save hook → saved → otpVerified cleared
```

---

## Scripts

```bash
npm run start:dev      # Development with hot reload
npm run start:debug    # Debug mode
npm run build          # Compile TypeScript → dist/
npm run start:prod     # Run compiled production build
npm run lint           # ESLint with auto-fix
npm run format         # Prettier format all files
npm run test           # Run unit tests
npm run test:watch     # Tests in watch mode
npm run test:cov       # Tests with coverage report
npm run test:e2e       # End-to-end tests
```

---

## Architecture Decisions

| Decision | Reason |
|---|---|
| `config/` namespace pattern | All env vars typed in one place — no `process.env.X` scattered across services |
| `common/` for cross-cutting concerns | Guards, decorators, filters are reusable across all modules |
| `infrastructure/` for external adapters | Database, email, cloudinary are isolated — easy to swap |
| `core/` for constants and interfaces | No magic strings or numbers — single source of truth |
| `GlobalExceptionFilter` | Consistent error format across entire app — no try/catch in controllers |
| `ResponseInterceptor` | Consistent success format — controllers just return data |
| `JwtAuthGuard` global + `@Public()` | Secure by default — every route requires auth unless explicitly public |
| `APP_GUARD` for ThrottlerGuard | Rate limiting via DI — can inject services, unlike `useGlobalGuards()` |
| Rotating refresh tokens | Every refresh issues a new token — logout is real, stolen tokens expire |
| `select: false` on password | Password never accidentally included in any query response |

---

## Express vs NestJS — Quick Comparison

| | Express | NestJS (this boilerplate) |
|---|---|---|
| Route definition | `router.post('/login', ...)` | `@Post('login')` decorator |
| Request body | `req.body` | `@Body() dto: LoginDto` |
| Auth middleware | `authMiddleware` per route | `JwtAuthGuard` global + `@Public()` |
| Current user | `req.user` | `@CurrentUser() user` |
| Error handling | `next(new AppError(404, ...))` | `throw new NotFoundException(...)` |
| Response | `res.status(200).json(...)` | `return { message, data }` |
| Config / env | `process.env.JWT_SECRET` | `configService.get('auth.secret')` |
| DB model | `require('../models/User')` | `@InjectModel(User.name)` via DI |
| Validation | Manual `if (!req.body.email)` | `@IsEmail()` on DTO + `ValidationPipe` |
