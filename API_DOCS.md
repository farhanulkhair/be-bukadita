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

### User Profile Management

#### GET /api/v1/users/me

Get current user profile.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Response (200):**

```json
{
  "error": false,
  "code": "USER_PROFILE_FETCH_SUCCESS",
  "message": "Profile fetched",
  "data": {
    "id": "uuid",
    "full_name": "John Doe",
    "phone": "+6281234567890",
    "email": "john@example.com",
    "role": "pengguna",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### PUT /api/v1/users/me

Update current user profile.

**Headers:**

- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Request Body:**

```json
{
  "full_name": "string (optional, 2-100 chars)",
  "phone": "string (optional, valid Indonesian phone format)",
  "email": "string (optional, valid email format)"
}
```

**Response (200):**

```json
{
  "error": false,
  "code": "USER_PROFILE_UPDATE_SUCCESS",
  "message": "Profile updated",
  "data": {
    "id": "uuid",
    "full_name": "John Doe Updated",
    "phone": "+6281234567890",
    "email": "newemail@example.com",
    "role": "pengguna",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-02T00:00:00Z"
  }
}
```

### Modules & Learning Content

#### GET /api/v1/modules

Get all published modules (public access).

**Headers:**

- None required (public endpoint)

**Query Parameters:**

- `page`: number (default: 1)
- `limit`: number (default: 10)

**Response (200):**

```json
{
  "error": false,
  "code": "MODULE_FETCH_SUCCESS",
  "message": "Modules retrieved successfully",
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Nutrisi Ibu Hamil",
        "slug": "nutrisi-ibu-hamil",
        "description": "Panduan lengkap nutrisi untuk ibu hamil",
        "difficulty": "beginner",
        "category": "kesehatan",
        "published": true,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
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

#### GET /api/v1/modules/:id

Get module details by ID (public access).

**Headers:**

- None required (public endpoint)

**Parameters:**

- `id`: Module UUID

**Response (200):**

```json
{
  "error": false,
  "code": "MODULE_FETCH_SUCCESS",
  "message": "Module retrieved successfully",
  "data": {
    "id": "uuid",
    "title": "Nutrisi Ibu Hamil",
    "slug": "nutrisi-ibu-hamil",
    "description": "Panduan lengkap nutrisi untuk ibu hamil",
    "difficulty": "beginner",
    "category": "kesehatan",
    "published": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Materials & Learning Points

#### GET /api/v1/materials/public

Get all published materials (public access).

**Headers:**

- None required (public endpoint)

**Query Parameters:**

- `page`: number (default: 1)
- `limit`: number (default: 10)

**Response (200):**

```json
{
  "error": false,
  "code": "MATERIAL_FETCH_SUCCESS",
  "message": "Materials retrieved successfully",
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Tips Nutrisi Ibu Hamil",
        "slug": "tips-nutrisi-ibu-hamil",
        "content": "Article content...",
        "published": true,
        "module_id": "uuid",
        "order_index": 1,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### GET /api/v1/materials

Get all materials (with access control).

**Headers:**

- `Authorization: Bearer <token>` (optional for public, required for drafts)

**Query Parameters:**

- `page`: number (default: 1)
- `limit`: number (default: 10)

**Response (200):**

```json
{
  "error": false,
  "code": "MATERIAL_FETCH_SUCCESS",
  "message": "Materials retrieved successfully",
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Tips Nutrisi Ibu Hamil",
        "slug": "tips-nutrisi-ibu-hamil",
        "content": "Article content...",
        "published": true,
        "module_id": "uuid",
        "order_index": 1,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### GET /api/v1/materials/:id

Get material detail by ID with poin details.

**Headers:**

- None required (public for published materials)

**Parameters:**

- `id`: Material UUID

**Response (200):**

```json
{
  "error": false,
  "code": "MATERIAL_FETCH_SUCCESS",
  "message": "Material retrieved successfully",
  "data": {
    "id": "uuid",
    "title": "Tips Nutrisi Ibu Hamil",
    "slug": "tips-nutrisi-ibu-hamil",
    "content": "Full article content...",
    "published": true,
    "module_id": "uuid",
    "order_index": 1,
    "created_at": "2024-01-01T00:00:00Z",
    "poin_details": [
      {
        "id": "uuid",
        "judul_poin": "Pentingnya Asam Folat",
        "konten_poin": "Asam folat sangat penting untuk...",
        "order_index": 1,
        "poin_media": [
          {
            "id": "uuid",
            "media_url": "https://...",
            "media_type": "image",
            "caption": "Gambar ilustrasi"
          }
        ]
      }
    ]
  }
}
```

#### GET /api/v1/materials/:subMateriId/poins

Get all poin details for a material.

**Headers:**

- None required (public endpoint)

**Parameters:**

- `subMateriId`: Sub Materi UUID

**Response (200):**

```json
{
  "error": false,
  "code": "POIN_FETCH_SUCCESS",
  "message": "Poin details retrieved successfully",
  "data": {
    "items": [
      {
        "id": "uuid",
        "judul_poin": "Pentingnya Asam Folat",
        "konten_poin": "Detailed content...",
        "order_index": 1,
        "poin_media": []
      }
    ]
  }
}
```

#### GET /api/v1/materials/:subMateriId/quiz

Get quiz for specific sub-materi.

**Headers:**

- `Authorization: Bearer <token>` (optional, for attempt tracking)

**Parameters:**

- `subMateriId`: Sub Materi UUID

**Response (200):**

```json
{
  "error": false,
  "code": "QUIZ_FETCH_SUCCESS",
  "message": "Quiz ditemukan",
  "data": {
    "quiz": {
      "id": "uuid",
      "title": "Kuis Nutrisi Ibu Hamil",
      "description": "Test pengetahuan Anda",
      "time_limit_seconds": 600,
      "passing_score": 70,
      "user_attempt": {
        "id": "uuid",
        "score": 85,
        "is_passed": true,
        "completed_at": "2024-01-01T00:00:00Z"
      }
    }
  }
}
```

### User Quiz Management

#### POST /api/v1/user-quizzes/:quizId/start

Start a new quiz attempt.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Parameters:**

- `quizId`: Quiz UUID

**Response (200):**

```json
{
  "error": false,
  "code": "QUIZ_STARTED",
  "message": "Quiz berhasil dimulai",
  "data": {
    "attempt_id": "uuid",
    "quiz": {
      "id": "uuid",
      "title": "Kuis Nutrisi Ibu Hamil",
      "description": "Test pengetahuan Anda",
      "time_limit_seconds": 600,
      "passing_score": 70
    },
    "started_at": "2024-01-01T10:00:00Z"
  }
}
```

#### GET /api/v1/user-quizzes/:quizId/questions

Get quiz questions for active attempt.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Parameters:**

- `quizId`: Quiz UUID

**Response (200):**

```json
{
  "error": false,
  "code": "QUESTIONS_FETCH_SUCCESS",
  "message": "Soal berhasil diambil",
  "data": {
    "attempt_id": "uuid",
    "questions": [
      {
        "id": "uuid",
        "question_text": "Berapa gelas air yang direkomendasikan untuk ibu hamil per hari?",
        "options": ["6-7 gelas", "8-10 gelas", "11-12 gelas", "13-15 gelas"],
        "order_index": 1,
        "selected_answer": null
      }
    ],
    "started_at": "2024-01-01T10:00:00Z"
  }
}
```

#### POST /api/v1/user-quizzes/:quizId/submit

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
      "selected_option_index": 1
    },
    {
      "question_id": "uuid",
      "selected_option_index": 0
    }
  ]
}
```

**Response (200):**

```json
{
  "error": false,
  "code": "QUIZ_SUBMITTED",
  "message": "Quiz berhasil diselesaikan",
  "data": {
    "attempt": {
      "id": "uuid",
      "score": 80,
      "is_passed": true,
      "started_at": "2024-01-01T10:00:00Z",
      "completed_at": "2024-01-01T10:15:00Z"
    },
    "results": {
      "score": 80,
      "correct_answers": 4,
      "total_questions": 5,
      "is_passed": true,
      "passing_score": 70
    }
  }
}
```

#### GET /api/v1/user-quizzes/:quizId/results

Get quiz results for latest attempt.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Parameters:**

- `quizId`: Quiz UUID

**Query Parameters:**

- `includeAnswers`: boolean (default: false, show detailed answers)

**Response (200):**

```json
{
  "error": false,
  "code": "RESULTS_FETCH_SUCCESS",
  "message": "Hasil quiz berhasil diambil",
  "data": {
    "quiz": {
      "id": "uuid",
      "title": "Kuis Nutrisi Ibu Hamil",
      "passing_score": 70
    },
    "attempt": {
      "id": "uuid",
      "score": 80,
      "is_passed": true,
      "started_at": "2024-01-01T10:00:00Z",
      "completed_at": "2024-01-01T10:15:00Z"
    },
    "answer_details": [
      {
        "question_id": "uuid",
        "selected_option_index": 1,
        "is_correct": true,
        "materis_quiz_questions": {
          "question_text": "Berapa gelas air...?",
          "options": ["6-7 gelas", "8-10 gelas", "11-12 gelas", "13-15 gelas"],
          "correct_answer_index": 1,
          "explanation": "8-10 gelas air per hari direkomendasikan..."
        }
      }
    ]
  }
}
```

#### GET /api/v1/user-quizzes/my-attempts

Get all user's quiz attempts.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Query Parameters:**

- `page`: number (default: 1)
- `limit`: number (default: 10)
- `status`: string ('completed', 'ongoing')

**Response (200):**

```json
{
  "error": false,
  "code": "ATTEMPTS_FETCH_SUCCESS",
  "message": "Riwayat quiz berhasil diambil",
  "data": {
    "attempts": [
      {
        "id": "uuid",
        "score": 80,
        "is_passed": true,
        "started_at": "2024-01-01T10:00:00Z",
        "completed_at": "2024-01-01T10:15:00Z",
        "materis_quizzes": {
          "id": "uuid",
          "title": "Kuis Nutrisi Ibu Hamil",
          "passing_score": 70,
          "sub_materis": {
            "id": "uuid",
            "title": "Nutrisi Dasar",
            "module_id": "uuid"
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Personal Notes Management

#### GET /api/v1/notes

Get all personal notes.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Query Parameters:**

- `page`: number (default: 1)
- `limit`: number (default: 10)
- `search`: string (search in title and content)
- `pinned`: boolean (filter pinned notes)
- `archived`: boolean (filter archived notes)

**Response (200):**

```json
{
  "error": false,
  "code": "NOTES_FETCH_SUCCESS",
  "message": "Notes retrieved successfully",
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Catatan Nutrisi Penting",
        "content": "Isi catatan...",
        "is_pinned": false,
        "is_archived": false,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15,
      "totalPages": 2,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### POST /api/v1/notes

Create new personal note.

**Headers:**

- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Request Body:**

```json
{
  "title": "string (required, 1-200 chars)",
  "content": "string (required, 1-10000 chars)"
}
```

**Response (201):**

```json
{
  "error": false,
  "code": "NOTE_CREATE_SUCCESS",
  "message": "Note created successfully",
  "data": {
    "id": "uuid",
    "title": "Catatan Nutrisi Penting",
    "content": "Isi catatan...",
    "is_pinned": false,
    "is_archived": false,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### PUT /api/v1/notes/:id

Update personal note.

**Headers:**

- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Parameters:**

- `id`: Note UUID

**Request Body:**

```json
{
  "title": "string (optional, 1-200 chars)",
  "content": "string (optional, 1-10000 chars)"
}
```

**Response (200):**

```json
{
  "error": false,
  "code": "NOTE_UPDATE_SUCCESS",
  "message": "Note updated successfully",
  "data": {
    // Updated note object
  }
}
```

#### POST /api/v1/notes/:id/toggle-pin

Toggle pin status of note.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Parameters:**

- `id`: Note UUID

**Response (200):**

```json
{
  "error": false,
  "code": "NOTE_PIN_TOGGLE_SUCCESS",
  "message": "Note pin status updated",
  "data": {
    "id": "uuid",
    "is_pinned": true
  }
}
```

#### POST /api/v1/notes/:id/toggle-archive

Toggle archive status of note.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Parameters:**

- `id`: Note UUID

**Response (200):**

```json
{
  "error": false,
  "code": "NOTE_ARCHIVE_TOGGLE_SUCCESS",
  "message": "Note archive status updated",
  "data": {
    "id": "uuid",
    "is_archived": true
  }
}
```

#### DELETE /api/v1/notes/:id

Delete personal note.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Parameters:**

- `id`: Note UUID

**Response (200):**

```json
{
  "error": false,
  "code": "NOTE_DELETE_SUCCESS",
  "message": "Note deleted successfully",
  "data": {
    "deletedId": "uuid"
  }
}
```

### Learning Progress Tracking

#### POST /api/v1/progress/materials/:materi_id/poins/:poin_id/complete

Mark a poin as completed.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Parameters:**

- `materi_id`: Sub Materi UUID
- `poin_id`: Poin UUID

**Response (200):**

```json
{
  "error": false,
  "code": "POIN_COMPLETED",
  "message": "Poin berhasil diselesaikan",
  "data": {
    "user_id": "uuid",
    "poin_id": "uuid",
    "completed": true,
    "completed_at": "2024-01-01T10:00:00Z"
  }
}
```

#### GET /api/v1/progress/modules/:module_id

Get progress for specific module.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Parameters:**

- `module_id`: Module UUID

**Response (200):**

```json
{
  "error": false,
  "code": "MODULE_PROGRESS_SUCCESS",
  "message": "Progress module berhasil diambil",
  "data": {
    "module_progress": {
      "completed": false,
      "progress_percentage": 60,
      "completed_at": null
    },
    "sub_materi_progress": [
      {
        "sub_materi": {
          "id": "uuid",
          "judul": "Nutrisi Dasar",
          "order_index": 1
        },
        "progress": {
          "completed": true,
          "progress_percentage": 100,
          "completed_at": "2024-01-01T10:00:00Z"
        },
        "poin_details": [
          {
            "id": "uuid",
            "judul_poin": "Pentingnya Protein",
            "order_index": 1,
            "progress": {
              "completed": true,
              "completed_at": "2024-01-01T09:30:00Z"
            }
          }
        ]
      }
    ]
  }
}
```

#### GET /api/v1/progress/modules

Get progress for all modules.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Response (200):**

```json
{
  "error": false,
  "code": "USER_MODULES_PROGRESS_SUCCESS",
  "message": "Progress modules berhasil diambil",
  "data": {
    "modules": [
      {
        "id": "uuid",
        "title": "Nutrisi Ibu Hamil",
        "slug": "nutrisi-ibu-hamil",
        "description": "Panduan lengkap nutrisi",
        "difficulty": "beginner",
        "category": "kesehatan",
        "progress": {
          "completed": false,
          "progress_percentage": 60,
          "completed_at": null
        }
      }
    ]
  }
}
```

#### GET /api/v1/progress/materials/:sub_materi_id/access

Check access permission to sub-materi based on progress.

**Headers:**

- `Authorization: Bearer <token>` (required)

**Parameters:**

- `sub_materi_id`: Sub Materi UUID

**Response (200):**

```json
{
  "error": false,
  "code": "SUB_MATERI_ACCESS_CHECK",
  "message": "Pengecekan akses berhasil",
  "data": {
    "can_access": true,
    "reason": "",
    "sub_materi_id": "uuid"
  }
}
```

**Response (200) - Access Denied:**

```json
{
  "error": false,
  "code": "SUB_MATERI_ACCESS_CHECK",
  "message": "Pengecekan akses berhasil",
  "data": {
    "can_access": false,
    "reason": "Selesaikan 2 materi sebelumnya terlebih dahulu",
    "sub_materi_id": "uuid"
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
