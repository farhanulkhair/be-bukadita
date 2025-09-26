# Bukadita Backend API Documentation

## Base URL

```
Development: http://localhost:4000
Production: https://your-api-domain.com
```

## Authentication

All protected endpoints require Bearer token in Authorization header:

```
Authorization: Bearer <access_token>
```

## Response Format (Standardized)

All responses now use a unified envelope:

```json
{
  "error": false,
  "code": "MATERIAL_FETCH_SUCCESS",
  "message": "Materials retrieved successfully",
  "data": {
    "items": [{ "id": "uuid", "title": "..." }],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

Error example:

```json
{
  "error": true,
  "code": "MATERIAL_NOT_FOUND",
  "message": "Material not found"
}
```

Key rules:

- `error`: boolean (false on success, true on failure)
- `code`: MACHINE_READABLE_CODE in UPPER_SNAKE_CASE (e.g. `AUTH_LOGIN_SUCCESS`, `QUIZ_ATTEMPT_SUCCESS`, `ADMIN_USER_CREATE_ERROR`)
- `message`: Human-readable description
- `data`: Optional payload (object). For list endpoints includes `items` + optional `pagination` and `filters`.
- Pagination object keys are now: `page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPrevPage`.

Legacy documentation sections below may still show the old shape (`message`, nested `error` object). These will be updated progressively; backend already emits the new format.

---

## Authentication Endpoints

### POST /api/v1/auth/register

Register new user with email and password.

**Headers:**

- `Content-Type: application/json`

**Request Body:**

```json
{
  "email": "string (required, valid email)",
  "password": "string (required, min 6 chars)",
  "full_name": "string (required, 2-100 chars)",
  "phone": "string (optional, valid phone format)"
}
```

**Response (201) - With Email Confirmation Disabled:**

```json
{
  "message": "Registration successful",
  "data": {
    "access_token": "jwt_token_here",
    "refresh_token": "refresh_token_here",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "profile": {
        "id": "uuid",
        "full_name": "John Doe",
        "phone": "+6281234567890",
        "role": "pengguna",
        "created_at": "2024-01-01T00:00:00Z"
      }
    }
  }
}
```

**Response (201) - With Email Confirmation Enabled:**

```json
{
  "message": "Registration successful. Please check your email to confirm your account.",
  "data": {
    "user_id": "uuid",
    "email": "user@example.com",
    "confirmation_sent": true
  }
}
```

### POST /api/v1/auth/login

Login with email and password.

**Headers:**

- `Content-Type: application/json`

**Request Body:**

```json
{
  "email": "string (required, valid email)",
  "password": "string (required, min 6 chars)"
}
```

**Response (200):**

```json
{
  "message": "Login successful",
  "data": {
    "access_token": "jwt_token_here",
    "refresh_token": "refresh_token_here",
    "expires_at": 1705485000,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "email_confirmed_at": "2024-01-01T00:00:00Z",
      "profile": {
        "id": "uuid",
        "full_name": "John Doe",
        "phone": "+6281234567890",
        "role": "pengguna",
        "created_at": "2024-01-01T00:00:00Z"
      }
    }
  }
}
```

### POST /api/v1/auth/logout

Logout user and invalidate token.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Request Body:**

- None (empty body)

**Response (200):**

```json
{
  "message": "Logout successful"
}
```

### POST /api/v1/auth/create-missing-profile

Create profile for authenticated user if missing (useful for users created via other methods).

**Headers:**

- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Request Body:**

```json
{
  "full_name": "string (optional, 2-100 chars)",
  "phone": "string (optional, valid phone format)"
}
```

**Response (201):**

```json
{
  "message": "Profile created successfully",
  "data": {
    "id": "uuid",
    "full_name": "John Doe",
    "phone": "+6281234567890",
    "role": "pengguna",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Response (200) - If profile already exists:**

```json
{
  "message": "Profile already exists",
  "data": {
    "id": "uuid",
    "full_name": "John Doe",
    "phone": "+6281234567890",
    "role": "pengguna",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### POST /api/v1/auth/profile

Create or update user profile after Google sign-in (legacy endpoint for OAuth).

**Headers:**

- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Request Body:**

```json
{
  "full_name": "string (required, 2-100 chars)",
  "phone": "string (optional, valid phone format)",
  "role": "string (optional, 'pengguna'|'admin', default: 'pengguna')"
}
```

**Response (200):**

```json
{
  "message": "Profile created/updated successfully",
  "data": {
    "id": "uuid",
    "full_name": "John Doe",
    "phone": "+628123456789",
    "role": "pengguna",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## Authentication Flow Options

### Option 1: Manual Email/Password Authentication

1. **Register**: `POST /api/v1/auth/register` with email, password, full_name
2. **Login**: `POST /api/v1/auth/login` with email, password
3. **Use Token**: Include access_token in Authorization header for protected endpoints
4. **Logout**: `POST /api/v1/auth/logout` to invalidate token

### Option 2: Google OAuth Authentication (Legacy)

1. **Frontend**: User signs in with Google via Supabase client
2. **Frontend**: Obtains access_token from Supabase
3. **Backend**: Call `POST /api/v1/auth/profile` to create/update profile
4. **Frontend**: Use token for subsequent requests

### Error Responses for Authentication

**Registration Errors:**

```json
// Email already exists
{
  "error": {
    "message": "Email already registered",
    "code": "EMAIL_EXISTS"
  }
}

// Invalid email format
{
  "error": {
    "message": "The email address format is invalid. Please check and try again.",
    "code": "INVALID_EMAIL_FORMAT"
  }
}

// Weak password
{
  "error": {
    "message": "Password is too weak. Please use a stronger password.",
    "code": "WEAK_PASSWORD"
  }
}
```

**Login Errors:**

```json
// Invalid credentials
{
  "error": {
    "message": "Invalid email or password",
    "code": "INVALID_CREDENTIALS"
  }
}

// Email not confirmed
{
  "error": {
    "message": "Please confirm your email before logging in",
    "code": "EMAIL_NOT_CONFIRMED"
  }
}
```

---

## Pengguna Endpoints

### GET /api/v1/schedules

Get all posyandu schedules (public access).

**Headers:**

- None required (public endpoint)

**Query Parameters:**

- None

**Response (200):**

```json
{
  "message": "Schedules retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "title": "Posyandu Rutin Januari",
      "description": "Pemeriksaan kesehatan rutin",
      "location": "Balai Desa",
      "date": "2024-01-15T09:00:00Z",
      "created_at": "2024-01-01T00:00:00Z",
      "profiles": {
        "full_name": "Admin User"
      }
    }
  ]
}
```

### GET /api/v1/materials

Get all published materials.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Query Parameters:**

- `published`: boolean (admin only, filter by published status)

**Response (200):**

```json
{
  "message": "Materials retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "title": "Tips Nutrisi Ibu Hamil",
      "slug": "tips-nutrisi-ibu-hamil",
      "content": "Article content...",
      "published": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "profiles": {
        "full_name": "Author Name"
      }
    }
  ]
}
```

### GET /api/v1/materials/:id

Get material by ID.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Parameters:**

- `id`: Material UUID

**Response (200):**

```json
{
  "message": "Material retrieved successfully",
  "data": {
    "id": "uuid",
    "title": "Tips Nutrisi Ibu Hamil",
    "slug": "tips-nutrisi-ibu-hamil",
    "content": "Full article content...",
    "published": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "profiles": {
      "full_name": "Author Name"
    }
  }
}
```

### GET /api/v1/quizzes

Get all quizzes.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Response (200):**

```json
{
  "message": "Quizzes retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "title": "Kuis Nutrisi Ibu Hamil",
      "description": "Test your knowledge...",
      "created_at": "2024-01-01T00:00:00Z",
      "materials": {
        "id": "uuid",
        "title": "Related Material"
      },
      "profiles": {
        "full_name": "Creator Name"
      }
    }
  ]
}
```

### GET /api/v1/quizzes/:id

Get quiz with questions and choices.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Parameters:**

- `id`: Quiz UUID

**Response (200):**

```json
{
  "message": "Quiz retrieved successfully",
  "data": {
    "id": "uuid",
    "title": "Kuis Nutrisi Ibu Hamil",
    "description": "Test your knowledge...",
    "created_at": "2024-01-01T00:00:00Z",
    "questions": [
      {
        "id": "uuid",
        "question": "Berapa gelas air yang direkomendasikan?",
        "quiz_choices": [
          {
            "id": "uuid",
            "choice_text": "8-10 gelas"
            // is_correct hidden for non-admin users
          }
        ]
      }
    ]
  }
}
```

### POST /api/v1/quizzes/:quizId/submit

Submit quiz answers.

**Headers:**

- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Parameters:**

- `quizId`: Quiz UUID

**Request Body:**

```json
{
  "answers": [
    {
      "question_id": "uuid",
      "choice_id": "uuid"
    }
  ]
}
```

**Response (200):**

```json
{
  "message": "Quiz submitted successfully",
  "data": {
    "id": "uuid",
    "score": 85.5,
    "taken_at": "2024-01-01T00:00:00Z",
    "total_questions": 2,
    "correct_answers": 1,
    "percentage": 86,
    "quizzes": {
      "title": "Quiz Title"
    }
  }
}
```

---

## Admin Endpoints

All admin endpoints require `role: 'admin'` in user profile.

### GET /api/v1/admin/dashboard/stats

Get dashboard statistics.

**Headers:**

- `Authorization: Bearer <token>` (required, admin role)

**Response (200):**

```json
{
  "message": "Dashboard statistics retrieved successfully",
  "data": {
    "users": {
      "total": 150,
      "admin": 5,
      "regular": 145
    },
    "materials": {
      "total": 25,
      "published": 20,
      "draft": 5
    },
    "quizzes": {
      "total": 10,
      "submissions": 300
    },
    "schedules": {
      "total": 12
    }
  }
}
```

### GET /api/v1/admin/users

Get all user profiles with pagination.

**Headers:**

- `Authorization: Bearer <token>` (required, admin role)

**Query Parameters:**

- `page`: number (default: 1)
- `limit`: number (default: 10)
- `role`: string ('pengguna'|'admin')
- `search`: string (search by name or phone)

**Response (200):**

```json
{
  "message": "Users retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "full_name": "John Doe",
      "phone": "+628123456789",
      "role": "pengguna",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 150,
    "limit": 10,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

### PUT /api/v1/admin/users/:id/role

Update user role.

**Headers:**

- `Authorization: Bearer <token>` (required, admin role)
- `Content-Type: application/json`

**Parameters:**

- `id`: User UUID

**Request Body:**

```json
{
  "role": "admin" // or "pengguna"
}
```

**Response (200):**

```json
{
  "message": "User role updated successfully",
  "data": {
    "id": "uuid",
    "full_name": "John Doe",
    "phone": "+628123456789",
    "role": "admin",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### POST /api/v1/admin/schedules

Create new schedule.

**Headers:**

- `Authorization: Bearer <token>` (required, admin role)
- `Content-Type: application/json`

**Request Body:**

```json
{
  "title": "string (required, 3-200 chars)",
  "description": "string (optional, max 1000 chars)",
  "location": "string (optional, max 200 chars)",
  "date": "string (required, ISO date format)"
}
```

**Response (201):**

```json
{
  "message": "Schedule created successfully",
  "data": {
    "id": "uuid",
    "title": "Posyandu Rutin Februari",
    "description": "Pemeriksaan kesehatan rutin",
    "location": "Balai Desa",
    "date": "2024-02-15T09:00:00Z",
    "created_at": "2024-01-01T00:00:00Z",
    "profiles": {
      "full_name": "Admin User"
    }
  }
}
```

### PUT /api/v1/admin/schedules/:id

Update schedule.

**Headers:**

- `Authorization: Bearer <token>` (required, admin role)
- `Content-Type: application/json`

**Parameters:**

- `id`: Schedule UUID

**Request Body:**

```json
{
  "title": "string (optional, 3-200 chars)",
  "description": "string (optional, max 1000 chars)",
  "location": "string (optional, max 200 chars)",
  "date": "string (optional, ISO date format)"
}
```

**Response (200):**

```json
{
  "message": "Schedule updated successfully",
  "data": {
    // Updated schedule object
  }
}
```

### DELETE /api/v1/admin/schedules/:id

Delete schedule.

**Headers:**

- `Authorization: Bearer <token>` (required, admin role)

**Parameters:**

- `id`: Schedule UUID

**Response (200):**

```json
{
  "message": "Schedule deleted successfully"
}
```

### POST /api/v1/admin/materials

Create new material.

**Headers:**

- `Authorization: Bearer <token>` (required, admin role)
- `Content-Type: application/json`

**Request Body:**

```json
{
  "title": "string (required, 3-200 chars)",
  "slug": "string (optional, URL-friendly)",
  "content": "string (required, min 10 chars)",
  "published": "boolean (optional, default: false)"
}
```

**Response (201):**

```json
{
  "message": "Material created successfully",
  "data": {
    "id": "uuid",
    "title": "Tips Nutrisi Ibu Hamil",
    "slug": "tips-nutrisi-ibu-hamil",
    "content": "Article content...",
    "published": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "profiles": {
      "full_name": "Author Name"
    }
  }
}
```

### PUT /api/v1/admin/materials/:id

Update material.

**Headers:**

- `Authorization: Bearer <token>` (required, admin role)
- `Content-Type: application/json`

**Parameters:**

- `id`: Material UUID

**Request Body:**

```json
{
  "title": "string (optional, 3-200 chars)",
  "slug": "string (optional, URL-friendly)",
  "content": "string (optional, min 10 chars)",
  "published": "boolean (optional)"
}
```

**Response (200):**

```json
{
  "message": "Material updated successfully",
  "data": {
    // Updated material object
  }
}
```

### DELETE /api/v1/admin/materials/:id

Delete material.

**Headers:**

- `Authorization: Bearer <token>` (required, admin role)

**Parameters:**

- `id`: Material UUID

**Response (200):**

```json
{
  "message": "Material deleted successfully"
}
```

### POST /api/v1/admin/quizzes

Create quiz with questions.

**Headers:**

- `Authorization: Bearer <token>` (required, admin role)
- `Content-Type: application/json`

**Request Body:**

```json
{
  "title": "string (required, 3-200 chars)",
  "description": "string (optional, max 1000 chars)",
  "material_id": "string (optional, UUID)",
  "questions": [
    {
      "question": "string (required, min 5 chars)",
      "choices": [
        {
          "choice_text": "string (required)",
          "is_correct": "boolean (required)"
        }
      ]
    }
  ]
}
```

**Response (201):**

```json
{
  "message": "Quiz created successfully",
  "data": {
    "id": "uuid",
    "title": "Kuis Nutrisi",
    "description": "Test knowledge...",
    "created_at": "2024-01-01T00:00:00Z",
    "questions": [
      {
        "id": "uuid",
        "question": "Question text",
        "choices": [
          {
            "id": "uuid",
            "choice_text": "Choice A",
            "is_correct": false
          }
        ]
      }
    ]
  }
}
```

### DELETE /api/v1/admin/quizzes/:id

Delete quiz.

**Headers:**

- `Authorization: Bearer <token>` (required, admin role)

**Parameters:**

- `id`: Quiz UUID

**Response (200):**

```json
{
  "message": "Quiz deleted successfully"
}
```

### GET /api/v1/admin/quiz-results

Get all quiz results with pagination.

**Headers:**

- `Authorization: Bearer <token>` (required, admin role)

**Query Parameters:**

- `page`: number (default: 1)
- `limit`: number (default: 10)
- `quiz_id`: string (filter by quiz)
- `user_id`: string (filter by user)

**Response (200):**

```json
{
  "message": "Quiz results retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "score": 85.5,
      "taken_at": "2024-01-01T00:00:00Z",
      "profiles": {
        "id": "uuid",
        "full_name": "John Doe"
      },
      "quizzes": {
        "id": "uuid",
        "title": "Quiz Title"
      }
    }
  ],
  "pagination": {
    // Pagination metadata
  }
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "error": {
    "message": "Validation error message",
    "code": "VALIDATION_ERROR"
  }
}
```

### 401 Unauthorized

```json
{
  "error": {
    "message": "Access token is required",
    "code": "UNAUTHORIZED"
  }
}
```

### 403 Forbidden

```json
{
  "error": {
    "message": "Access denied. Required role: admin",
    "code": "FORBIDDEN"
  }
}
```

### 404 Not Found

```json
{
  "error": {
    "message": "Resource not found",
    "code": "NOT_FOUND"
  }
}
```

### 500 Internal Server Error

```json
{
  "error": {
    "message": "Internal server error",
    "code": "INTERNAL_ERROR"
  }
}
```

---

## Rate Limiting

- No rate limiting implemented in current version
- Consider implementing in production with express-rate-limit

## Data Validation

All input data is validated using Joi schemas:

- String length limits
- Required fields
- Email/phone format validation
- UUID format validation
- Enum value validation

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin request handling
- **JWT Validation**: Supabase token verification
- **RLS**: Database-level security policies
- **Input Sanitization**: Joi validation
- **Error Handling**: Consistent error responses
