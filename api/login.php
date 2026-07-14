<?php
require_once __DIR__ . '/../includes/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);

$input = getJsonInput();
$username = trim($input['username'] ?? '');
$password = $input['password'] ?? '';

if (!$username || !$password) jsonResponse(['error' => 'Username dan password wajib diisi'], 400);

$user = $db->findUserByUsername($username);
if (!$user || !$user['is_active'] || !password_verify($password, $user['password'])) {
    jsonResponse(['error' => 'Username atau password salah'], 401);
}

$token = $db->createSession($user['id']);
$db->setOnline($user['id']);

jsonResponse([
    'token' => $token,
    'user' => [
        'id' => $user['id'],
        'username' => $user['username'],
        'display_name' => $user['display_name'],
        'avatar_color' => $user['avatar_color']
    ]
]);
