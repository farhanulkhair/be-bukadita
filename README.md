# Bukadita Backend API

Backend RESTful API untuk aplikasi Bukadita (Buku Kandita) - sistem informasi posyandu dengan Express.js dan Supabase.

## ⚡ Recent Updates (Refactoring)

**Backend telah direfactor untuk struktur yang lebih bersih dan konsisten!**

- ✅ **Menghilangkan duplikasi routes** - 5 file duplicate dihapus, ~800 lines code reduced
- ✅ **Struktur yang konsisten** - Semua routes di `/api/v1/` dengan pattern yang jelas
- ✅ **Endpoint terpadu** - FE dan Backoffice pakai endpoint sama, middleware yang membedakan
- ✅ **Better organization** - Satu resource = satu file route

📖 **Dokumentasi Migrasi**: Lihat [`MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md) untuk detail perubahan endpoint.

## 🚀 Fitur

- **Autentikasi & Otorisasi**:
  - Manual registration/login dengan email & password
  - Google OAuth melalui Supabase (opsional)
  - Role-based access control (superadmin/admin/user)
- **Manajemen Module & Material**: Sistem modul pembelajaran dengan sub-materi dan poin-poin pembahasan
- **Sistem Quiz**: Quiz interaktif dengan soal pilihan ganda, scoring, dan tracking progress
- **Sistem Notes**: Catatan pribadi user untuk setiap modul
- **Progress Tracking**: Tracking progress pembelajaran user per module dan sub-materi
- **Dashboard Admin**: Statistik dan manajemen pengguna lengkap
- **Security**: Helmet, CORS, Rate limiting, dan Row Level Security (RLS)

## � Format Response Standar

Semua endpoint kini menggunakan envelope konsisten:

```json
{
  "error": false,
  "code": "AUTH_LOGIN_SUCCESS",
  "message": "Login successful",
  "data": {
    /* payload */
  }
}
```

Error:

```json
{
  "error": true,
  "code": "AUTH_LOGIN_INVALID_CREDENTIALS",
  "message": "Invalid email or password"
}
```

List + pagination:

```json
{
  "error": false,
  "code": "MATERIAL_FETCH_SUCCESS",
  "message": "Materials retrieved successfully",
  "data": {
    "items": [
      /* array */
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

Konvensi kode: `DOMAIN_ACTION_STATUS` (contoh: `QUIZ_ATTEMPT_SUCCESS`, `ADMIN_USER_CREATE_ERROR`).

## �📋 Persyaratan

- Node.js 16+ dan npm
- Akun Supabase
- Project Supabase dengan konfigurasi Google OAuth

## 🛠 Setup dan Instalasi

### 1. Clone dan Install Dependencies

```bash
git clone <repository-url>
cd be-bukadita
npm install
```

### 2. Konfigurasi Environment Variables

```bash
# Copy file environment example
cp .env.example .env

# Edit .env dan isi dengan nilai yang sesuai
```

Isi file `.env`:

```env
PORT=4000
NODE_ENV=development
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### 3. Setup Database Supabase

1. Buka Supabase dashboard project Anda
2. Pergi ke SQL Editor
3. Copy seluruh isi file `migrations/supabase_schema.sql`
4. Paste dan jalankan query tersebut
5. Verifikasi bahwa semua tabel dan policies telah dibuat

### 4. Konfigurasi Google OAuth di Supabase

1. Buka **Authentication > Providers** di Supabase dashboard
2. Aktifkan Google provider
3. Isi **Client ID** dan **Client Secret** dari Google Console
4. Tambahkan **Redirect URLs**:
   - Development: `http://localhost:3000`
   - Production: `https://your-frontend-domain.com`

### 5. Jalankan Server

```bash
# Development mode dengan hot reload
npm run dev

# Production mode
npm start
```

Server akan berjalan di `http://localhost:4000`

## 🔌 API Endpoints

> **Note**: Backend telah direfactor! Lihat [`MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md) untuk detail lengkap perubahan endpoint.

### Struktur API v1

```
/api/v1/
├── /auth          → Authentication & Authorization
├── /modules       → Module Management (public read, admin CRUD)
├── /materials     → Material & Poin Management (public read, admin CRUD)
├── /quizzes       → Quiz System (user quiz taking + admin management)
├── /users         → User Management (self-management + admin)
├── /notes         → Personal Notes (authenticated users)
├── /progress      → Progress Tracking (authenticated users)
└── /admin         → Admin Dashboard & Stats
```

### Quick Reference

#### 🔓 Public Endpoints (No Auth)
```
GET  /health
GET  /api/v1
GET  /api/v1/modules
GET  /api/v1/modules/:id
GET  /api/v1/materials/public
GET  /api/v1/materials/:id
```

#### 🔐 User Endpoints (Auth Required)
```
# Auth
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout

# Profile
GET  /api/v1/users/me
PUT  /api/v1/users/me
POST /api/v1/users/me/profile-photo
POST /api/v1/users/me/change-password

# Quizzes
GET  /api/v1/quizzes
GET  /api/v1/quizzes/module/:moduleId
GET  /api/v1/quizzes/:id
POST /api/v1/quizzes/:quizId/start
GET  /api/v1/quizzes/:quizId/questions
POST /api/v1/quizzes/:quizId/submit
GET  /api/v1/quizzes/:quizId/results

# Notes
GET  /api/v1/notes
POST /api/v1/notes
PUT  /api/v1/notes/:id
DELETE /api/v1/notes/:id

# Progress
GET  /api/v1/progress/modules
GET  /api/v1/progress/modules/:module_id
POST /api/v1/progress/materials/:id/poins/:poin_id/complete
```

#### 👑 Admin Endpoints (Admin Auth Required)
```
# Modules
POST   /api/v1/modules
PUT    /api/v1/modules/:id
DELETE /api/v1/modules/:id

# Materials & Poins
POST   /api/v1/materials
PUT    /api/v1/materials/:id
DELETE /api/v1/materials/:id
POST   /api/v1/materials/:subMateriId/poins
PUT    /api/v1/materials/poins/:id
DELETE /api/v1/materials/poins/:id

# Quizzes
GET    /api/v1/quizzes/admin/all
POST   /api/v1/quizzes/admin
PUT    /api/v1/quizzes/admin/:id
DELETE /api/v1/quizzes/admin/:id
POST   /api/v1/quizzes/admin/:quizId/questions

# Users
GET    /api/v1/users
POST   /api/v1/users
PUT    /api/v1/users/:id
DELETE /api/v1/users/:id

# Dashboard
GET    /api/v1/admin/dashboard/stats
GET    /api/v1/admin/quiz-results
```

📖 **Full Documentation**: 
- [`ENDPOINT_LIST.md`](./ENDPOINT_LIST.md) - Complete endpoint list
- [`API_DOCS.md`](./API_DOCS.md) - Detailed API documentation
- [`API_USER_GUIDE.md`](./API_USER_GUIDE.md) - User guide
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) - Testing guide

## 📝 Contoh Request/Response

### 1. Update Profile

**Request:**

```bash
POST /api/v1/auth/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "full_name": "John Doe",
  "phone": "+628123456789"
}
```

**Response:**

```json
{
  "message": "Profile created successfully",
  "data": {
    "id": "uuid",
    "full_name": "John Doe",
    "phone": "+628123456789",
    "role": "pengguna",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 2. Submit Quiz

**Request:**

```bash
POST /api/v1/quizzes/quiz-uuid/submit
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "answers": [
    {
      "question_id": "question-uuid-1",
      "choice_id": "choice-uuid-1"
    },
    {
      "question_id": "question-uuid-2",
      "choice_id": "choice-uuid-2"
    }
  ]
}
```

**Response:**

```json
{
  "message": "Quiz submitted successfully",
  "data": {
    "id": "result-uuid",
    "score": 85.5,
    "taken_at": "2024-01-01T00:00:00Z",
    "total_questions": 2,
    "correct_answers": 1,
    "percentage": 86,
    "quizzes": {
      "title": "Kuis Nutrisi Ibu Hamil"
    }
  }
}
```

### 3. Create Material (Admin)

**Request:**

```bash
POST /api/v1/admin/materials
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "title": "Tips Nutrisi untuk Ibu Hamil",
  "content": "Artikel lengkap mengenai nutrisi...",
  "published": true
}
```

**Response:**

```json
{
  "message": "Material created successfully",
  "data": {
    "id": "material-uuid",
    "title": "Tips Nutrisi untuk Ibu Hamil",
    "slug": "tips-nutrisi-untuk-ibu-hamil",
    "content": "Artikel lengkap mengenai nutrisi...",
    "published": true,
    "created_at": "2024-01-01T00:00:00Z",
    "profiles": {
      "full_name": "Admin User"
    }
  }
}
```

## 🔐 Autentikasi

## 🔐 Autentikasi

### Flow Autentikasi

**Option 1: Manual Registration/Login**

1. **Frontend**: User mendaftar dengan `POST /api/auth/register` (email, password, full_name)
2. **Frontend**: User login dengan `POST /api/auth/login` (email, password)
3. **Frontend**: Mendapat `access_token` dari response
4. **Frontend**: Gunakan token untuk semua request selanjutnya

**Option 2: Google OAuth (Optional)**

1. **Frontend**: User melakukan sign-in dengan Google melalui Supabase client
2. **Frontend**: Mendapat `access_token` dari Supabase
3. **Frontend**: Kirim `POST /api/auth/profile` dengan token untuk buat/update profil
4. **Frontend**: Gunakan token untuk semua request selanjutnya

### Header Authorization

Semua endpoint yang memerlukan autentikasi harus menyertakan header:

```
Authorization: Bearer <access_token>
```

### Role-based Access

- **pengguna**: Akses read-only ke konten publik, submit kuis
- **admin**: Full akses CRUD untuk semua resource + dashboard

## 🗂 Struktur Database

### Tabel Utama

- **profiles**: Profil pengguna (extends auth.users)
- **posyandu_schedules**: Jadwal kegiatan posyandu
- **materials**: Artikel/materi edukasi
- **quizzes**: Data kuis
- **quiz_questions**: Soal-soal kuis
- **quiz_choices**: Pilihan jawaban
- **quiz_results**: Hasil pengerjaan kuis

### Row Level Security (RLS)

Semua tabel dilindungi dengan RLS policies:

- Users hanya bisa akses data mereka sendiri
- Admin bisa akses semua data
- Konten public (jadwal, materi published) bisa diakses semua user

## 🚀 Deployment

### Vercel/Netlify

1. Set environment variables di dashboard platform
2. Deploy dari repository Git

### Traditional Server

1. Clone repository di server
2. Install dependencies: `npm install`
3. Set environment variables
4. Start dengan PM2: `pm2 start src/server.js --name bukadita-api`

### Docker

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
```

## 🧪 Testing

```bash
# Install dependencies termasuk dev
npm install

# Test endpoints dengan curl atau tools lain
curl http://localhost:4000/health
```

### Seeding Data

Tersedia script untuk membuat superadmin dan sample data (development).

1. Tambahkan variabel berikut ke `.env` (service role wajib):

```env
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PASSWORD=Password123
SUPERADMIN_NAME=Super Admin
```

2. Jalankan seed superadmin:

```bash
npm run seed:superadmin
```

3. (Opsional) Seed data sample (materi, kuis, jadwal, user demo):

```bash
npm run seed:sample
```

Script:

- `scripts/seed_superadmin.js`: Membuat / update user superadmin + profile
- `scripts/seed_sample_data.js`: Membuat user demo, lokasi posyandu, jadwal contoh, materi & kuis contoh

### Smoke Tests

Gunakan script shell sederhana untuk memastikan endpoint utama hidup.

```bash
npm run smoke
```

Script `scripts/smoke_tests.sh` akan:

1. Cek `/health`
2. Register user baru (email acak)
3. Ambil daftar materials & schedules (publik)
4. Hit endpoint profil user

### Postman Collection

Import file `postman_collection.json` ke Postman. Variable `baseUrl` default `http://localhost:4000`.

### CI Smoke

Workflow GitHub Actions `ci-smoke.yml` menjalankan:

1. Instal dependency
2. Seed superadmin & sample data
3. Start server
4. Jalankan smoke tests

Pastikan menambahkan secrets di repository:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PASSWORD`

## 📚 Tools Pengembangan

Gunakan file `examples/requests.http` untuk testing API dengan REST Client extension di VS Code.

## ⚠️ Keamanan

- **Jangan commit**: File `.env` dengan credentials asli
- **Service Role Key**: Hanya untuk server-side, jangan expose ke client
- **Token Validation**: Semua request divalidasi melalui Supabase
- **RLS**: Database dilindungi dengan Row Level Security
- **HTTPS**: Gunakan HTTPS di production

## 🤝 Kontribusi

1. Fork repository
2. Buat feature branch
3. Commit perubahan
4. Push ke branch
5. Buat Pull Request

## 📄 Lisensi

MIT License - see LICENSE file for details

---

**Bukadita Backend API** - Sistem informasi posyandu modern dengan teknologi terkini.
