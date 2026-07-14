<?php
require_once __DIR__ . '/../includes/auth.php';
requireAdmin();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    jsonResponse(['login_code' => $db->getLoginCode()]);
}

if ($method === 'PUT') {
    $input = getJsonInput();
    $code = trim($input['login_code'] ?? '');

    if (!preg_match('/^\d{4}$/', $code)) {
        jsonResponse(['error' => 'Kode harus 4 digit angka'], 400);
    }

    $db->setLoginCode($code);
    jsonResponse(['login_code' => $code]);
}

jsonResponse(['error' => 'Method not allowed'], 405);
