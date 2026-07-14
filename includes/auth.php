<?php
require_once __DIR__ . '/db.php';

$db = new JsonDB();

function jsonResponse($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonInput(): array {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}

function getBearerToken(): ?string {
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? (function_exists('apache_request_headers') ? (apache_request_headers()['Authorization'] ?? '') : '')
        ?? '';

    if (preg_match('/Bearer\s+(\S+)/i', $header, $m)) {
        return $m[1];
    }

    // Fallback: Apache/CGI sering menghapus Authorization header saat multipart upload
    if (!empty($_POST['token'])) return $_POST['token'];
    if (!empty($_GET['token'])) return $_GET['token'];

    return null;
}

function requireAuth(): array {
    global $db;
    $token = getBearerToken();
    if (!$token) jsonResponse(['error' => 'Token tidak ditemukan'], 401);

    $session = $db->getSession($token);
    if (!$session || $session['is_admin']) jsonResponse(['error' => 'Token tidak valid'], 401);

    $user = $db->findUserById($session['user_id']);
    if (!$user || !$user['is_active']) jsonResponse(['error' => 'User tidak aktif'], 401);

    $db->setOnline($user['id']);
    return $user;
}

function requireAdmin(): void {
    global $db;
    $token = getBearerToken();
    if (!$token) jsonResponse(['error' => 'Token tidak ditemukan'], 401);

    $session = $db->getSession($token);
    if (!$session || !$session['is_admin']) jsonResponse(['error' => 'Akses ditolak'], 403);
}

function getMediaType(string $mime): string {
    if (strpos($mime, 'image/') === 0) return 'image';
    if (strpos($mime, 'video/') === 0) return 'video';
    if (strpos($mime, 'audio/') === 0) return 'audio';
    return 'file';
}

function mediaUrl(string $filename): string {
    return BASE_PATH . '/uploads/' . $filename;
}

function deleteMediaFile(?string $mediaUrl): void {
    if (!$mediaUrl) return;
    $prefix = BASE_PATH . '/uploads/';
    if (strpos($mediaUrl, $prefix) !== 0 && strpos($mediaUrl, '/uploads/') === false) return;

    $filename = basename($mediaUrl);
    $path = UPLOADS_PATH . '/' . $filename;
    if (is_file($path)) @unlink($path);
}

function uploadErrorMessage(int $code): string {
    $messages = [
        UPLOAD_ERR_INI_SIZE   => 'File melebihi batas upload server (upload_max_filesize)',
        UPLOAD_ERR_FORM_SIZE  => 'File terlalu besar',
        UPLOAD_ERR_PARTIAL    => 'Upload tidak lengkap, coba lagi',
        UPLOAD_ERR_NO_FILE    => 'Tidak ada file yang diunggah',
        UPLOAD_ERR_NO_TMP_DIR => 'Folder temporary server tidak tersedia',
        UPLOAD_ERR_CANT_WRITE => 'Gagal menulis file. Cek permission folder uploads/ (chmod 755)',
        UPLOAD_ERR_EXTENSION  => 'Upload diblokir oleh server',
    ];
    return $messages[$code] ?? 'Error upload kode ' . $code;
}

function detectMime(string $path, string $ext, string $clientMime = ''): string {
    if (function_exists('finfo_open')) {
        $finfo = @finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $mime = @finfo_file($finfo, $path);
            finfo_close($finfo);
            if ($mime) return $mime;
        }
    }

    $map = [
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
        'gif' => 'image/gif', 'webp' => 'image/webp',
        'mp4' => 'video/mp4', 'webm' => 'video/webm', 'mov' => 'video/quicktime',
        'mp3' => 'audio/mpeg', 'wav' => 'audio/wav', 'ogg' => 'audio/ogg',
        'm4a' => 'audio/mp4', 'aac' => 'audio/aac',
    ];

    return $map[$ext] ?? ($clientMime ?: 'application/octet-stream');
}

$colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4'];
