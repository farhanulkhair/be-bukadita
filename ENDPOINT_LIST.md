# Daftar Endpoint API untuk User Biasa

## Authentication Required

Sebagian besar endpoint memerlukan authentication token JWT dalam header:

```
Authorization: Bearer <your_jwt_token>
```

## 1. AUTHENTICATION ENDPOINTS

### POST /api/v1/auth/register

- **Deskripsi**: Registrasi user baru
- **Body**: `{ "email", "password", "full_name", "phone_number" }`
- **Response**: User profile + JWT token

### POST /api/v1/auth/login

- **Deskripsi**: Login user
- **Body**: `{ "email", "password" }`
- **Response**: User profile + JWT token

### POST /api/v1/auth/logout

- **Deskripsi**: Logout user (invalidate token)
- **Auth**: Required

### POST /api/v1/auth/refresh-token

- **Deskripsi**: Refresh JWT token
- **Auth**: Required

## 2. PROFILE MANAGEMENT

### GET /api/v1/users/profile

- **Deskripsi**: Mendapatkan profile user yang sedang login
- **Auth**: Required

### PUT /api/v1/users/profile

- **Deskripsi**: Update profile user
- **Auth**: Required
- **Body**: `{ "full_name", "phone_number", "avatar_url" }`

## 3. MODULES ENDPOINTS

### GET /api/v1/modules

- **Deskripsi**: Mendapatkan daftar semua modules yang published
- **Auth**: Optional (public access)
- **Query params**: `page`, `limit`, `search`, `category`

### GET /api/v1/modules/:id

- **Deskripsi**: Mendapatkan detail module dengan sub-materi
- **Auth**: Optional (public access)

## 4. MATERIALS ENDPOINTS

### GET /api/v1/materials

- **Deskripsi**: Mendapatkan daftar semua materials yang published
- **Auth**: Required
- **Query params**: `page`, `limit`, `search`, `module_id`

### GET /api/v1/materials/public

- **Deskripsi**: Mendapatkan daftar materials public (tanpa auth)
- **Auth**: None
- **Query params**: `page`, `limit`, `module_id`

### GET /api/v1/materials/:id

- **Deskripsi**: Mendapatkan detail material dengan poin-poin pembelajaran
- **Auth**: Required
- **Response**: Material + poin details + user progress

### GET /api/v1/materials/:id/points ✨ NEW

- **Deskripsi**: Mendapatkan semua poin pembelajaran dari suatu material
- **Auth**: Required
- **Response**: List poin dengan user progress

### GET /api/v1/materials/:id/quizzes ✨ NEW

- **Deskripsi**: Mendapatkan semua quiz dari suatu material
- **Auth**: Required
- **Response**: List quiz dengan user attempts

### GET /api/v1/materials/:subMateriId/poins

- **Deskripsi**: Mendapatkan poin details untuk sub materi tertentu
- **Auth**: Required

### GET /api/v1/materials/:subMateriId/quiz

- **Deskripsi**: Mendapatkan quiz untuk sub materi tertentu
- **Auth**: Required

## 5. POIN DETAILS ENDPOINTS

### GET /api/v1/poins/:id

- **Deskripsi**: Mendapatkan detail poin tertentu dengan media
- **Auth**: Required

## 6. PROGRESS TRACKING ENDPOINTS

### GET /api/v1/progress/modules

- **Deskripsi**: Mendapatkan progress semua modules untuk user
- **Auth**: Required

### GET /api/v1/progress/modules/:module_id

- **Deskripsi**: Mendapatkan progress detail untuk module tertentu
- **Auth**: Required

### GET /api/v1/progress/sub-materis/:id ✨ NEW

- **Deskripsi**: Mendapatkan progress user untuk sub materi tertentu
- **Auth**: Required
- **Response**: Sub materi progress + poin progress details

### POST /api/v1/progress/sub-materis/:id/complete ✨ NEW

- **Deskripsi**: Menandai sub materi sebagai selesai
- **Auth**: Required

### GET /api/v1/progress/materials/:sub_materi_id/access

- **Deskripsi**: Mengecek apakah user dapat mengakses sub materi tertentu
- **Auth**: Required

### POST /api/v1/progress/materials/:materi_id/poins/:poin_id/complete

- **Deskripsi**: Menandai poin sebagai selesai
- **Auth**: Required

## 7. QUIZ ENDPOINTS

### GET /api/v1/kuis/module/:moduleId

- **Deskripsi**: Mendapatkan daftar quiz untuk module tertentu
- **Auth**: Required
- **Response**: List quiz dengan user completion status

### GET /api/v1/kuis/:id

- **Deskripsi**: Mendapatkan detail quiz tertentu
- **Auth**: Required
- **Response**: Detail quiz dengan user attempts

### GET /api/v1/kuis

- **Deskripsi**: Mendapatkan semua quiz yang tersedia
- **Auth**: Required
- **Query params**: `page`, `limit`, `module_id`

### GET /api/v1/user-quizzes

- **Deskripsi**: Mendapatkan daftar quiz yang tersedia untuk user
- **Auth**: Required

### POST /api/v1/user-quizzes/:quiz_id/attempt

- **Deskripsi**: Memulai attempt quiz baru
- **Auth**: Required

### GET /api/v1/user-quizzes/:quiz_id/attempt/:attempt_id

- **Deskripsi**: Mendapatkan detail attempt quiz
- **Auth**: Required

### POST /api/v1/user-quizzes/:quiz_id/attempt/:attempt_id/submit

- **Deskripsi**: Submit jawaban quiz
- **Auth**: Required

## 8. SCHEDULES ENDPOINTS

### GET /api/v1/schedules

- **Deskripsi**: Mendapatkan jadwal kegiatan (public access)
- **Auth**: None

## 9. NOTES ENDPOINTS

### GET /api/v1/notes

- **Deskripsi**: Mendapatkan catatan user
- **Auth**: Required

### POST /api/v1/notes

- **Deskripsi**: Membuat catatan baru
- **Auth**: Required

### PUT /api/v1/notes/:id

- **Deskripsi**: Update catatan
- **Auth**: Required

### DELETE /api/v1/notes/:id

- **Deskripsi**: Hapus catatan
- **Auth**: Required

---

## ✨ ENDPOINT BARU YANG DITAMBAHKAN

Endpoint berikut ini telah berhasil ditambahkan untuk mengatasi error 404:

1. **GET /api/v1/materials/:id/points** ✅ FIXED

   - Mengambil semua poin pembelajaran dari material tertentu
   - Format: `{ data: Array<PoinDetail> }` sesuai requirements
   - Dilengkapi dengan progress user jika login

2. **GET /api/v1/materials/:id/quizzes** ✅ FIXED

   - Mengambil semua quiz dari material tertentu
   - Format: `{ data: Array<Quiz> }` sesuai requirements
   - Dilengkapi dengan informasi attempt user jika login

3. **GET /api/v1/progress/sub-materis/:id** ✅ FIXED

   - Mengambil detail progress user untuk sub materi tertentu
   - Format: `{ data: ProgressRecord }` sesuai requirements
   - Auto-create progress record jika belum ada

4. **POST /api/v1/progress/sub-materis/:id/complete**
   - Menandai sub materi sebagai selesai setelah semua poin completed

## Response Format

Semua endpoint menggunakan format response yang konsisten:

```json
{
  "success": true,
  "code": "SUCCESS_CODE",
  "message": "Success message",
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Untuk error:

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "Error message",
  "details": "Additional error details",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Base URL

```
http://localhost:3000/api/v1
```

## Troubleshooting Error 401 Unauthorized

Jika frontend mendapat error **401 Unauthorized**, solusinya adalah:

### **Frontend Harus Mengirim JWT Token:**

Semua endpoint quiz dan material memerlukan authentication. Frontend harus mengirim JWT token di header Authorization:

```typescript
// Contoh implementasi di apiClient.ts
const getToken = () => {
  return (
    localStorage.getItem("authToken") || sessionStorage.getItem("authToken")
  );
};

const apiRequest = async (url: string, options: RequestInit = {}) => {
  const token = getToken();

  if (!token) {
    throw new Error("No authentication token found");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  return fetch(url, { ...options, headers });
};

// Penggunaan:
// GET quiz by module
const getQuizzesByModule = (moduleId: string) => {
  return apiRequest(`/api/v1/kuis/module/${moduleId}`).then((res) =>
    res.json()
  );
};

// GET materials
const getMaterials = () => {
  return apiRequest("/api/v1/materials").then((res) => res.json());
};
```

### **Endpoint yang Memerlukan Auth:**

- `GET /api/v1/kuis/module/:moduleId` ← **Ini yang error 401**
- `GET /api/v1/materials`
- `GET /api/v1/progress/*`
- Semua endpoint user data lainnya

### **Endpoint Publik (Tanpa Auth):**

- `GET /api/v1/modules` (daftar module)
- `GET /api/v1/modules/:id` (detail module)
- `GET /api/v1/materials/public` (daftar material publik)
- `GET /api/v1/materials/:id` (detail material - read only)
- `GET /api/v1/schedules` (jadwal kegiatan)

## 🔧 Perbaikan API Sesuai Requirements

### ✅ Progress API (Priority 1) - FIXED

- **Problem**: 500 Internal Server Error
- **Solution**: Auto-create progress record jika belum ada
- **Format**: Response `{ data: ProgressRecord }` sesuai requirements
- **Logging**: Ditambah logging untuk debugging

### ✅ Points API (Priority 2) - FIXED

- **Problem**: Response format tidak sesuai requirements
- **Solution**: Return `{ data: Array<PoinDetail> }` langsung
- **Fields**: Semua field required sudah included (sub_materi_id, dll)

### ✅ Quiz API (Priority 3) - FIXED

- **Problem**: Response format tidak sesuai requirements
- **Solution**: Return `{ data: Array<Quiz> }` langsung
- **Fields**: Semua field required sudah included (module_id, quiz_type, dll)

### 🧪 Testing Commands

```bash
# Test Progress API
curl -X GET "http://localhost:4000/api/v1/progress/sub-materis/YOUR_SUB_MATERI_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test Points API
curl -X GET "http://localhost:4000/api/v1/materials/YOUR_MATERIAL_ID/points" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test Quizzes API
curl -X GET "http://localhost:4000/api/v1/materials/YOUR_MATERIAL_ID/quizzes" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Semua endpoint sekarang sudah tersedia dan siap digunakan oleh frontend untuk mengakses semua fitur yang diperlukan.
