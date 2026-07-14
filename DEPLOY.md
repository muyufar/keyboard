# Light Chat - Panduan Deploy ke Shared Hosting (cPanel)

## Masalah
Hosting shared (cPanel) **tidak punya Node.js/npm**, sehingga `npm install` gagal.

## Solusi
Gunakan **versi PHP** yang sudah disertakan. Tidak perlu npm, cukup upload file ke hosting.

## Langkah Upload

1. Upload semua file ke `public_html/nusa-pro.com/keyboard/`
2. Set permission `data/` dan `uploads/` ke **755** atau **775**
3. Buka https://nusa-pro.com/keyboard/
4. Backoffice: https://nusa-pro.com/keyboard/backoffice/
5. Login admin: `admin` / `admin123`

**Tidak perlu upload:** `node_modules/`, `server.js`, `package.json`
