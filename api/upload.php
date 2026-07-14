<?php
require_once __DIR__ . '/../includes/auth.php';

$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

// Cek jika POST melebihi post_max_size (PHP kosongkan $_FILES)
if (empty($_FILES) && empty($_POST) && ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    jsonResponse(['error' => 'File terlalu besar untuk batas server (post_max_size)'], 413);
}

if (!isset($_FILES['file'])) {
    jsonResponse(['error' => 'File tidak ditemukan. Pastikan format gambar/video/audio didukung.'], 400);
}

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(['error' => uploadErrorMessage($file['error'])], 400);
}

if ($file['size'] > MAX_FILE_SIZE) {
    jsonResponse(['error' => 'File terlalu besar (maks 50MB)'], 400);
}

$allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a', 'aac'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if (!in_array($ext, $allowed, true)) {
    jsonResponse(['error' => 'Tipe file tidak didukung: .' . $ext], 400);
}

if (!is_dir(UPLOADS_PATH)) {
    if (!@mkdir(UPLOADS_PATH, 0755, true)) {
        jsonResponse(['error' => 'Gagal membuat folder uploads/. Set permission folder keyboard/ ke 755'], 500);
    }
}

if (!is_writable(UPLOADS_PATH)) {
    jsonResponse(['error' => 'Folder uploads/ tidak bisa ditulis. Set permission ke 755 atau 775'], 500);
}

$filename = time() . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
$dest = UPLOADS_PATH . '/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    jsonResponse(['error' => 'Gagal menyimpan file ke uploads/. Cek permission folder'], 500);
}

$mime = detectMime($dest, $ext, $file['type'] ?? '');

jsonResponse([
    'media_type' => getMediaType($mime),
    'media_url'  => mediaUrl($filename),
    'media_name' => $file['name']
]);
