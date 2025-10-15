# API Guide untuk Frontend User (Non-Admin)

Dokumentasi lengkap API endpoints untuk user biasa (pengguna) di sistem Posyandu. Semua endpoint menggunakan base URL: `http://localhost:4000` atau sesuai server deployment.

## 📋 Daftar Isi

- [Authentication](#authentication)
- [User Profile Management](#user-profile-management)
- [Materials & Learning](#materials--learning)
- [Notes Management](#notes-management)
- [Quiz System](#quiz-system)
- [Progress Tracking](#progress-tracking)
- [Schedules](#schedules)

---

## 🔐 Authentication

### 1. Register User Baru

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "Nama Lengkap",
  "phone": "081234567890"
}
```

**Response Success (201):**

```json
{
  "success": true,
  "code": "AUTH_REGISTER_SUCCESS",
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "full_name": "Nama Lengkap"
    },
    "token": "jwt-token-here"
  }
}
```

### 2. Login User

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "AUTH_LOGIN_SUCCESS",
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "full_name": "Nama Lengkap",
      "phone": "081234567890",
      "role": "pengguna"
    },
    "token": "jwt-token-here"
  }
}
```

### 3. Logout User

```http
POST /api/auth/logout
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "AUTH_LOGOUT_SUCCESS",
  "message": "Logout successful"
}
```

---

## 👤 User Profile Management

### 1. Get Profile Sendiri

```http
GET /api/v1/users/me
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "USER_PROFILE_FETCH_SUCCESS",
  "message": "Profile fetched",
  "data": {
    "id": "uuid-here",
    "full_name": "Nama Lengkap",
    "phone": "081234567890",
    "email": "user@example.com",
    "address": "Jl. Contoh No. 123",
    "profil_url": "https://storage-url/photo.jpg",
    "date_of_birth": "1990-01-15",
    "role": "pengguna",
    "created_at": "2025-10-12T10:00:00Z",
    "updated_at": "2025-10-12T15:30:00Z"
  }
}
```

### 2. Update Profile Sendiri (Field Baru)

```http
PUT /api/v1/users/me
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "full_name": "Nama Baru",
  "phone": "081987654321",
  "email": "newemail@example.com",
  "address": "Jl. Alamat Baru No. 456",
  "profil_url": "https://example.com/photo-baru.jpg",
  "date_of_birth": "1992-05-20"
}
```

**Field Rules:**

- `full_name`: String, min 2 chars, max 100 chars
- `phone`: Indonesian phone format (08xxxxxxxxxx or +628xxxxxxxxxx)
- `email`: Valid email format
- `address`: Optional, max 500 chars
- `profil_url`: Optional, valid URL format
- `date_of_birth`: Optional, ISO date format (YYYY-MM-DD), tidak boleh future date

**Response Success (200):**

```json
{
  "success": true,
  "code": "USER_PROFILE_UPDATE_SUCCESS",
  "message": "Profile updated",
  "data": {
    "id": "uuid-here",
    "full_name": "Nama Baru",
    "phone": "081987654321",
    "email": "newemail@example.com",
    "address": "Jl. Alamat Baru No. 456",
    "profil_url": "https://example.com/photo-baru.jpg",
    "date_of_birth": "1992-05-20",
    "role": "pengguna",
    "created_at": "2025-10-12T10:00:00Z",
    "updated_at": "2025-10-12T16:00:00Z"
  }
}
```

### 3. Upload Foto Profil

```http
POST /api/v1/users/me/profile-photo
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data

Form Data:
- photo: [file] (JPG, PNG, WebP, max 5MB)
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "PROFILE_PHOTO_UPLOAD_SUCCESS",
  "message": "Foto profil berhasil diupload",
  "data": {
    "profile": {
      "id": "uuid-here",
      "profil_url": "https://storage-url/new-photo.jpg"
      // ... other profile fields
    },
    "photo_url": "https://storage-url/new-photo.jpg",
    "filename": "user-id-timestamp.jpg"
  }
}
```

### 4. Hapus Foto Profil

```http
DELETE /api/v1/users/me/profile-photo
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "PROFILE_PHOTO_DELETE_SUCCESS",
  "message": "Foto profil berhasil dihapus",
  "data": {
    "profile": {
      "id": "uuid-here",
      "profil_url": null
      // ... other profile fields
    }
  }
}
```

---

## 📚 Materials & Learning

### 1. Get Semua Modules (Published)

```http
GET /api/v1/modules
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "MODULES_FETCH_SUCCESS",
  "message": "Modules retrieved successfully",
  "data": [
    {
      "id": "uuid-here",
      "title": "Modul Kesehatan Ibu",
      "description": "Panduan kesehatan untuk ibu hamil dan menyusui",
      "published": true,
      "created_at": "2025-10-12T10:00:00Z"
    }
  ]
}
```

### 2. Get Detail Module

```http
GET /api/v1/modules/{module_id}
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "MODULE_FETCH_SUCCESS",
  "message": "Module retrieved successfully",
  "data": {
    "id": "uuid-here",
    "title": "Modul Kesehatan Ibu",
    "description": "Panduan kesehatan untuk ibu hamil dan menyusui",
    "published": true,
    "sub_materis": [
      {
        "id": "sub-uuid-here",
        "title": "Nutrisi Ibu Hamil",
        "description": "Panduan nutrisi yang tepat",
        "published": true
      }
    ]
  }
}
```

### 3. Get Semua Sub-Materials (Published)

```http
GET /api/v1/materials/public?page=1&limit=10&module_id=uuid-here
```

**Query Parameters:**

- `page`: Halaman (default: 1)
- `limit`: Items per page (default: 10, max: 50)
- `module_id`: Filter by module ID (optional)

**Response Success (200):**

```json
{
  "success": true,
  "code": "MATERIALS_FETCH_SUCCESS",
  "message": "Materials retrieved successfully",
  "data": {
    "materials": [
      {
        "id": "uuid-here",
        "title": "Nutrisi Ibu Hamil",
        "description": "Panduan nutrisi yang tepat untuk ibu hamil",
        "published": true,
        "module": {
          "id": "module-uuid",
          "title": "Modul Kesehatan Ibu"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### 4. Get Detail Sub-Material dengan Poin

```http
GET /api/v1/materials/{sub_materi_id}
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "MATERIAL_FETCH_SUCCESS",
  "message": "Material retrieved successfully",
  "data": {
    "id": "uuid-here",
    "title": "Nutrisi Ibu Hamil",
    "description": "Panduan nutrisi yang tepat untuk ibu hamil",
    "published": true,
    "module": {
      "id": "module-uuid",
      "title": "Modul Kesehatan Ibu"
    },
    "poin_details": [
      {
        "id": "poin-uuid",
        "title": "Vitamin Penting",
        "content": "Vitamin A, B, C sangat penting...",
        "order_index": 1,
        "is_completed": false
      }
    ]
  }
}
```

### 5. Get Poin dalam Sub-Material

```http
GET /api/v1/materials/{sub_materi_id}/poins
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "POINS_FETCH_SUCCESS",
  "message": "Poins retrieved successfully",
  "data": [
    {
      "id": "poin-uuid",
      "title": "Vitamin Penting",
      "content": "Content detail vitamin...",
      "order_index": 1,
      "is_completed": false,
      "media": [
        {
          "id": "media-uuid",
          "file_url": "https://storage-url/image.jpg",
          "file_type": "image",
          "caption": "Contoh makanan vitamin A"
        }
      ]
    }
  ]
}
```

---

## 📝 Notes Management

### 1. Get Semua Notes Pribadi

```http
GET /api/v1/notes?page=1&limit=10&q=search&pinned=true&archived=false
Authorization: Bearer <jwt-token>
```

**Query Parameters:**

- `page`: Halaman (default: 1)
- `limit`: Items per page (default: 10, max: 50)
- `q`: Search text in title/content (optional)
- `pinned`: Filter pinned notes (true/false, optional)
- `archived`: Filter archived notes (true/false, default: false)

**Response Success (200):**

```json
{
  "success": true,
  "code": "NOTES_FETCH_SUCCESS",
  "message": "Notes berhasil diambil",
  "data": {
    "notes": [
      {
        "id": "note-uuid",
        "title": "Catatan Penting",
        "content": "Isi catatan yang panjang...",
        "pinned": true,
        "archived": false,
        "created_at": "2025-10-12T10:00:00Z",
        "updated_at": "2025-10-12T15:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    },
    "filters": {
      "search": "search",
      "pinned": true,
      "archived": false
    }
  }
}
```

### 2. Get Detail Note

```http
GET /api/v1/notes/{note_id}
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "NOTE_FETCH_SUCCESS",
  "message": "Note berhasil diambil",
  "data": {
    "id": "note-uuid",
    "title": "Catatan Penting",
    "content": "Isi catatan yang panjang...",
    "pinned": true,
    "archived": false,
    "created_at": "2025-10-12T10:00:00Z",
    "updated_at": "2025-10-12T15:30:00Z"
  }
}
```

### 3. Buat Note Baru

```http
POST /api/v1/notes
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "title": "Judul Catatan",
  "content": "Isi catatan yang akan disimpan...",
  "pinned": false
}
```

**Field Rules:**

- `title`: Optional, max 200 chars
- `content`: Required, min 1 char, max 10000 chars
- `pinned`: Optional, boolean (default: false)

**Response Success (201):**

```json
{
  "success": true,
  "code": "NOTE_CREATE_SUCCESS",
  "message": "Note berhasil dibuat",
  "data": {
    "id": "new-note-uuid",
    "title": "Judul Catatan",
    "content": "Isi catatan yang akan disimpan...",
    "pinned": false,
    "archived": false,
    "created_at": "2025-10-12T16:00:00Z",
    "updated_at": "2025-10-12T16:00:00Z"
  }
}
```

### 4. Update Note

```http
PUT /api/v1/notes/{note_id}
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "title": "Judul Diperbarui",
  "content": "Isi catatan yang diperbarui...",
  "pinned": true,
  "archived": false
}
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "NOTE_UPDATE_SUCCESS",
  "message": "Note berhasil diperbarui",
  "data": {
    "id": "note-uuid",
    "title": "Judul Diperbarui",
    "content": "Isi catatan yang diperbarui...",
    "pinned": true,
    "archived": false,
    "created_at": "2025-10-12T10:00:00Z",
    "updated_at": "2025-10-12T16:00:00Z"
  }
}
```

### 5. Hapus Note

```http
DELETE /api/v1/notes/{note_id}
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "NOTE_DELETE_SUCCESS",
  "message": "Note berhasil dihapus",
  "data": {
    "deletedId": "note-uuid",
    "title": "Judul Catatan"
  }
}
```

### 6. Toggle Pin Note

```http
POST /api/v1/notes/{note_id}/toggle-pin
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "NOTE_PIN_SUCCESS",
  "message": "Note berhasil di-pin",
  "data": {
    "id": "note-uuid",
    "pinned": true
    // ... other note fields
  }
}
```

### 7. Toggle Archive Note

```http
POST /api/v1/notes/{note_id}/toggle-archive
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "NOTE_ARCHIVE_SUCCESS",
  "message": "Note berhasil diarsipkan",
  "data": {
    "id": "note-uuid",
    "archived": true
    // ... other note fields
  }
}
```

---

## 🎯 Quiz System

### 1. Get Quiz untuk Sub-Material

```http
GET /api/v1/materials/{sub_materi_id}/quiz
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "QUIZ_FETCH_SUCCESS",
  "message": "Quiz ditemukan",
  "data": {
    "quiz": {
      "id": "quiz-uuid",
      "title": "Quiz Nutrisi Ibu Hamil",
      "description": "Test pemahaman tentang nutrisi",
      "time_limit_seconds": 600,
      "passing_score": 70,
      "user_attempt": {
        "id": "attempt-uuid",
        "score": 85,
        "is_passed": true,
        "completed_at": "2025-10-12T15:00:00Z"
      }
    }
  }
}
```

### 2. Mulai Quiz Attempt

```http
POST /api/v1/user-quizzes/{quiz_id}/start
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "QUIZ_STARTED",
  "message": "Quiz berhasil dimulai",
  "data": {
    "attempt_id": "attempt-uuid",
    "quiz": {
      "id": "quiz-uuid",
      "title": "Quiz Nutrisi Ibu Hamil",
      "description": "Test pemahaman tentang nutrisi",
      "time_limit_seconds": 600,
      "passing_score": 70
    },
    "started_at": "2025-10-12T16:00:00Z"
  }
}
```

### 3. Get Soal Quiz

```http
GET /api/v1/user-quizzes/{quiz_id}/questions
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "QUESTIONS_FETCH_SUCCESS",
  "message": "Soal berhasil diambil",
  "data": {
    "attempt_id": "attempt-uuid",
    "questions": [
      {
        "id": "question-uuid",
        "question_text": "Vitamin apa yang penting untuk ibu hamil?",
        "options": ["Vitamin A", "Vitamin B12", "Asam Folat", "Semua benar"],
        "order_index": 1,
        "selected_answer": null
      }
    ],
    "started_at": "2025-10-12T16:00:00Z"
  }
}
```

### 4. Submit Jawaban Quiz

```http
POST /api/v1/user-quizzes/{quiz_id}/submit
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "answers": [
    {
      "question_id": "question-uuid-1",
      "selected_option_index": 3
    },
    {
      "question_id": "question-uuid-2",
      "selected_option_index": 1
    }
  ]
}
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "QUIZ_SUBMITTED",
  "message": "Quiz berhasil diselesaikan",
  "data": {
    "attempt": {
      "id": "attempt-uuid",
      "score": 85,
      "is_passed": true,
      "completed_at": "2025-10-12T16:15:00Z",
      "started_at": "2025-10-12T16:00:00Z"
    },
    "results": {
      "score": 85,
      "correct_answers": 17,
      "total_questions": 20,
      "is_passed": true,
      "passing_score": 70
    }
  }
}
```

### 5. Get Hasil Quiz

```http
GET /api/v1/user-quizzes/{quiz_id}/results?includeAnswers=true
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "RESULTS_FETCH_SUCCESS",
  "message": "Hasil quiz berhasil diambil",
  "data": {
    "quiz": {
      "id": "quiz-uuid",
      "title": "Quiz Nutrisi Ibu Hamil",
      "passing_score": 70
    },
    "attempt": {
      "id": "attempt-uuid",
      "score": 85,
      "is_passed": true,
      "started_at": "2025-10-12T16:00:00Z",
      "completed_at": "2025-10-12T16:15:00Z"
    },
    "answer_details": [
      {
        "question_id": "question-uuid",
        "selected_option_index": 3,
        "is_correct": true,
        "materis_quiz_questions": {
          "question_text": "Vitamin apa yang penting?",
          "options": ["A", "B", "C", "Semua benar"],
          "correct_answer_index": 3,
          "explanation": "Semua vitamin tersebut penting untuk ibu hamil"
        }
      }
    ]
  }
}
```

### 6. Get Riwayat Quiz Attempts

```http
GET /api/v1/user-quizzes/my-attempts?page=1&limit=10&status=completed
Authorization: Bearer <jwt-token>
```

**Query Parameters:**

- `page`: Halaman (default: 1)
- `limit`: Items per page (default: 10)
- `status`: Filter status (completed/ongoing, optional)

**Response Success (200):**

```json
{
  "success": true,
  "code": "ATTEMPTS_FETCH_SUCCESS",
  "message": "Riwayat quiz berhasil diambil",
  "data": {
    "attempts": [
      {
        "id": "attempt-uuid",
        "score": 85,
        "is_passed": true,
        "started_at": "2025-10-12T16:00:00Z",
        "completed_at": "2025-10-12T16:15:00Z",
        "materis_quizzes": {
          "id": "quiz-uuid",
          "title": "Quiz Nutrisi Ibu Hamil",
          "passing_score": 70,
          "sub_materis": {
            "id": "sub-uuid",
            "title": "Nutrisi Ibu Hamil",
            "module_id": "module-uuid"
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

---

## 📊 Progress Tracking

### 1. Complete Poin dalam Sub-Material

```http
POST /api/v1/progress/materials/{sub_materi_id}/poins/{poin_id}/complete
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "POIN_COMPLETE_SUCCESS",
  "message": "Poin berhasil diselesaikan",
  "data": {
    "poin_id": "poin-uuid",
    "completed_at": "2025-10-12T16:00:00Z",
    "sub_materi_progress": {
      "completed_poins": 5,
      "total_poins": 10,
      "percentage": 50
    }
  }
}
```

### 2. Get Progress Module

```http
GET /api/v1/progress/modules/{module_id}
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "MODULE_PROGRESS_SUCCESS",
  "message": "Progress modul berhasil diambil",
  "data": {
    "module": {
      "id": "module-uuid",
      "title": "Modul Kesehatan Ibu"
    },
    "progress": {
      "completed_sub_materis": 2,
      "total_sub_materis": 5,
      "percentage": 40,
      "completed_poins": 15,
      "total_poins": 35
    },
    "sub_materis": [
      {
        "id": "sub-uuid",
        "title": "Nutrisi Ibu Hamil",
        "progress": {
          "completed_poins": 8,
          "total_poins": 10,
          "percentage": 80,
          "is_completed": false
        }
      }
    ]
  }
}
```

### 3. Get Progress Semua Modules

```http
GET /api/v1/progress/modules
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "USER_PROGRESS_SUCCESS",
  "message": "Progress pengguna berhasil diambil",
  "data": {
    "modules": [
      {
        "id": "module-uuid",
        "title": "Modul Kesehatan Ibu",
        "progress": {
          "completed_sub_materis": 2,
          "total_sub_materis": 5,
          "percentage": 40
        }
      }
    ],
    "overall_progress": {
      "completed_modules": 0,
      "total_modules": 3,
      "percentage": 0
    }
  }
}
```

### 4. Check Access Sub-Material

```http
GET /api/v1/progress/materials/{sub_materi_id}/access
Authorization: Bearer <jwt-token>
```

**Response Success (200):**

```json
{
  "success": true,
  "code": "ACCESS_CHECK_SUCCESS",
  "message": "Akses berhasil diperiksa",
  "data": {
    "has_access": true,
    "sub_materi": {
      "id": "sub-uuid",
      "title": "Nutrisi Ibu Hamil",
      "order_index": 2
    },
    "prerequisite": {
      "id": "prev-sub-uuid",
      "title": "Pengantar Kesehatan",
      "is_completed": true
    }
  }
}
```

---

## 📅 Schedules

### 1. Get Jadwal Posyandu (Public)

```http
GET /api/pengguna/schedules?page=1&limit=10&date=2025-10-15
```

**Query Parameters:**

- `page`: Halaman (default: 1)
- `limit`: Items per page (default: 10)
- `date`: Filter by date (YYYY-MM-DD, optional)

**Response Success (200):**

```json
{
  "success": true,
  "code": "SCHEDULES_FETCH_SUCCESS",
  "message": "Schedules retrieved successfully",
  "data": {
    "schedules": [
      {
        "id": "schedule-uuid",
        "title": "Pemeriksaan Ibu Hamil",
        "description": "Pemeriksaan rutin untuk ibu hamil",
        "date": "2025-10-15",
        "time": "08:00:00",
        "location": "Posyandu Melati",
        "category": "kesehatan_ibu"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

## ⚠️ Error Responses

Semua endpoint dapat mengembalikan error responses dengan format standar:

**400 Bad Request:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Field validation failed",
  "error": {
    "details": "Email format is invalid"
  }
}
```

**401 Unauthorized:**

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication required"
}
```

**403 Forbidden:**

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Access denied"
}
```

**404 Not Found:**

```json
{
  "success": false,
  "code": "NOT_FOUND",
  "message": "Resource not found"
}
```

**422 Validation Error:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Field validation failed",
  "error": {
    "details": "Full name must be at least 2 characters long"
  }
}
```

**500 Internal Server Error:**

```json
{
  "success": false,
  "code": "INTERNAL_ERROR",
  "message": "Internal server error"
}
```

---

## 🔧 Implementation Tips

### 1. Authentication Header

Semua protected endpoints memerlukan JWT token:

```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### 2. File Upload

Untuk upload foto profil:

```javascript
const formData = new FormData();
formData.append("photo", fileInput.files[0]);

fetch("/api/v1/users/me/profile-photo", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});
```

### 3. Date Format

Gunakan ISO 8601 format untuk tanggal:

- `date_of_birth`: "1990-01-15" (YYYY-MM-DD)
- `created_at`: "2025-10-12T16:00:00Z" (ISO datetime)

### 4. Phone Number Format

Format nomor telepon Indonesia:

- "081234567890" (dengan 08)
- "+6281234567890" (dengan +62)

### 5. Pagination

Semua list endpoints mendukung pagination:

```javascript
const url = `/api/v1/notes?page=${page}&limit=${limit}&q=${search}`;
```

---

## 📱 Frontend Integration Example

### React/Next.js Implementation:

```javascript
// utils/api.js
const API_BASE = "http://localhost:4000";

const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || "API Error");
  }

  return data.data;
};

// Profile management
export const profileAPI = {
  getProfile: () => apiCall("/api/v1/users/me"),
  updateProfile: (data) =>
    apiCall("/api/v1/users/me", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  uploadPhoto: (file) => {
    const formData = new FormData();
    formData.append("photo", file);
    return apiCall("/api/v1/users/me/profile-photo", {
      method: "POST",
      headers: {}, // Remove Content-Type for FormData
      body: formData,
    });
  },
};

// Notes management
export const notesAPI = {
  getNotes: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiCall(`/api/v1/notes?${query}`);
  },
  createNote: (data) =>
    apiCall("/api/v1/notes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNote: (id, data) =>
    apiCall(`/api/v1/notes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteNote: (id) =>
    apiCall(`/api/v1/notes/${id}`, {
      method: "DELETE",
    }),
};
```

---

**Last Updated:** October 12, 2025  
**API Version:** v1  
**Base URL:** http://localhost:4000 (development)
