# Light Chat

Aplikasi chat ringan dengan dukungan media real-time.

## Fitur

- **Chat real-time** menggunakan Socket.io (WebSocket)
- **Kirim gambar, video, dan audio** — langsung diputar di dalam chat
- **Registrasi user** melalui halaman Backoffice (admin panel)
- **Indikator typing** — tahu kapan orang lain sedang mengetik
- **Jumlah user online** — tampil di header chat
- **Database JSON** — ringan, tanpa perlu setup database server

## Instalasi

```bash
npm install
npm start
```

Server berjalan di `http://localhost:3000`

## Cara Pakai

### 1. Backoffice — Daftarkan User

Buka `http://localhost:3000/backoffice/`

Login admin default:
- **Username:** `admin`
- **Password:** `admin123`

Di backoffice Anda bisa:
- Mendaftarkan user baru (username, password, nama tampilan)
- Mengaktifkan / menonaktifkan user
- Menghapus user

### 2. Chat

Buka `http://localhost:3000`

User yang sudah didaftarkan di backoffice bisa login dan langsung chat.

Fitur chat:
- Ketik pesan teks dan tekan Enter atau tombol kirim
- Klik ikon 📎 untuk melampirkan gambar, video, atau audio
- Gambar bisa diklik untuk tampilan fullscreen
- Video dan audio bisa diputar langsung di chat

## Struktur Proyek

```
keyboard/
├── server.js          # Backend (Express + Socket.io + SQLite)
├── package.json
├── data/              # Database JSON (auto-generated)
├── uploads/           # File media yang diunggah
└── public/
    ├── index.html     # Halaman chat
    ├── css/style.css  # Styles
    ├── js/
    │   ├── chat.js    # Logika chat
    │   └── backoffice.js
    └── backoffice/
        └── index.html # Panel admin
```

## Konfigurasi (opsional)

Set environment variables sebelum menjalankan:

| Variable | Default | Keterangan |
|----------|---------|------------|
| `PORT` | `3000` | Port server |
| `JWT_SECRET` | `light-chat-secret-key-2026` | Secret key JWT |
| `ADMIN_USER` | `admin` | Username admin backoffice |
| `ADMIN_PASS` | `admin123` | Password admin backoffice |

## Teknologi

- **Node.js** + Express
- **Socket.io** — real-time messaging
- **JSON file** — penyimpanan data ringan, tanpa native dependency
- **Multer** — upload file
- **bcryptjs** — hash password
- **JWT** — autentikasi
