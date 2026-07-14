<?php
require_once __DIR__ . '/../includes/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);

$input = getJsonInput();
$username = trim($input['username'] ?? '');
$password = $input['password'] ?? '';

if ($username === ADMIN_USER && $password === ADMIN_PASS) {
    $token = $db->createSession(0, true);
    jsonResponse(['token' => $token, 'username' => $username]);
}

jsonResponse(['error' => 'Kredensial admin salah'], 401);
