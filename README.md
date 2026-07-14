# Pemesanan Buku

Aplikasi pemesanan buku dengan komunikasi real-time antara pelanggan dan admin.

## Fitur

- **Komunikasi real-time** menggunakan Socket.io (WebSocket) / polling PHP
- **Kirim gambar, video, dan audio** — bukti transfer, sampel buku, dll.
- **Registrasi user** melalui halaman Backoffice (admin panel)
- **Reply pesan** — balas pesan tertentu
- **Notifikasi browser** — dengan persetujuan pengguna
- **Video call** — komunikasi langsung 1-on-1
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
- Mendaftarkan pelanggan baru (username, password, nama tampilan)
- Mengaktifkan / menonaktifkan user
- Menghapus user

### 2. Aplikasi Pemesanan

Buka `http://localhost:3000`

User yang sudah didaftarkan di backoffice bisa login dan berkomunikasi.

Fitur:
- Ketik pesan pemesanan dan tekan Enter atau tombol kirim
- Klik ikon 📎 untuk melampirkan gambar, video, atau audio
- Balas pesan dengan tombol ↩
- Aktifkan notifikasi lewat banner atau tombol 🔔
- Video call lewat tombol 📹

## Struktur Proyek

```
keyboard/
├── index.php          # Halaman utama (PHP / hosting)
├── server.js          # Backend Node.js (development)
├── package.json
├── data/              # Database JSON (auto-generated)
├── uploads/           # File media yang diunggah
└── public/
    ├── css/style.css
    ├── js/
    └── backoffice/
```

## Konfigurasi (opsional)

| Variable | Default | Keterangan |
|----------|---------|------------|
| `PORT` | `3000` | Port server |
| `JWT_SECRET` | `light-chat-secret-key-2026` | Secret key JWT |
| `ADMIN_USER` | `admin` | Username admin backoffice |
| `ADMIN_PASS` | `admin123` | Password admin backoffice |

## Teknologi

- **PHP** — untuk shared hosting (cPanel)
- **Node.js** + Express — development lokal
- **Socket.io** — real-time messaging
- **WebRTC** — video call
- **JSON file** — penyimpanan data ringan
