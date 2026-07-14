<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/login_characters.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo json_encode(build_login_characters(), JSON_UNESCAPED_UNICODE);
