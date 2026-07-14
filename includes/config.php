<?php
define('ROOT_PATH', dirname(__DIR__));
define('DATA_PATH', ROOT_PATH . '/data');
define('UPLOADS_PATH', ROOT_PATH . '/uploads');

if (!is_dir(DATA_PATH)) {
    @mkdir(DATA_PATH, 0755, true);
}
if (!is_dir(UPLOADS_PATH)) {
    @mkdir(UPLOADS_PATH, 0755, true);
}

define('JWT_SECRET', getenv('JWT_SECRET') ?: 'light-chat-secret-key-2026');
define('ADMIN_USER', getenv('ADMIN_USER') ?: 'admin');
define('ADMIN_PASS', getenv('ADMIN_PASS') ?: 'admin123');
define('LOGIN_CODE', getenv('LOGIN_CODE') ?: '0505');

define('MAX_FILE_SIZE', 50 * 1024 * 1024);
define('POLL_INTERVAL', 2);

@ini_set('upload_max_filesize', '50M');
@ini_set('post_max_size', '52M');
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');

// Auto-detect base URL path (supports subdirectory like /keyboard/)
$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
$basePath = rtrim($scriptDir, '/');
if (in_array(basename($basePath), ['api', 'backoffice'], true)) {
    $basePath = dirname($basePath);
}
define('BASE_PATH', $basePath === '' || $basePath === '.' ? '' : $basePath);

function jsonError(string $message, int $code = 500): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

set_exception_handler(function (Throwable $e) {
    jsonError('Server error: ' . $e->getMessage(), 500);
});

register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            jsonError('Fatal error: ' . $err['message'], 500);
        }
    }
});
