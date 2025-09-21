# Bukadita Backend API

Backend RESTful API untuk aplikasi Bukadita (Buku Kandita) - sistem informasi posyandu dengan Express.js dan Supabase.

## 🚀 Fitur

- **Autentikasi & Otorisasi**:
  - Manual registration/login dengan email & password
  - Google OAuth melalui Supabase (opsional)
  - Role-based access control (admin/pengguna)
- **Manajemen Jadwal**: CRUD jadwal posyandu untuk admin
- **Manajemen Materi**: Sistem artikel/materi dengan status publish/draft
- **Sistem Kuis**: Kuis interaktif dengan soal pilihan ganda dan scoring
- **Dashboard Admin**: Statistik dan manajemen pengguna
- **Security**: Helmet, CORS, Rate limiting, dan Row Level Security (RLS)

## 📋 Persyaratan

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

### Health Check

- `GET /health` - Status server

### Authentication

- `POST /api/auth/register` - Registrasi dengan email & password
- `POST /api/auth/login` - Login dengan email & password
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/profile` - Buat/update profil setelah login

### Pengguna (Authenticated Users)

- `GET /api/pengguna/schedules` - Daftar jadwal posyandu
- `GET /api/pengguna/materials` - Daftar materi (published only)
- `GET /api/pengguna/materials/:id` - Detail materi
- `GET /api/pengguna/quizzes` - Daftar kuis
- `GET /api/pengguna/quizzes/:id` - Detail kuis dengan soal
- `POST /api/pengguna/quizzes/:quizId/submit` - Submit jawaban kuis

### Admin (Admin Role Required)

- `POST /api/admin/schedules` - Buat jadwal
- `PUT /api/admin/schedules/:id` - Update jadwal
- `DELETE /api/admin/schedules/:id` - Hapus jadwal
- `POST /api/admin/materials` - Buat materi
- `PUT /api/admin/materials/:id` - Update materi
- `DELETE /api/admin/materials/:id` - Hapus materi
- `POST /api/admin/quizzes` - Buat kuis dengan soal
- `DELETE /api/admin/quizzes/:id` - Hapus kuis
- `GET /api/admin/users` - Daftar semua user
- `PUT /api/admin/users/:id/role` - Update role user
- `GET /api/admin/dashboard/stats` - Statistik dashboard
- `GET /api/admin/quiz-results` - Hasil kuis semua user

## 📝 Contoh Request/Response

### 1. Update Profile

**Request:**

```bash
POST /api/auth/profile
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
POST /api/pengguna/quizzes/quiz-uuid/submit
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
POST /api/admin/materials
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
