<?php
require_once __DIR__ . '/../includes/auth.php';
requireAdmin();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $users = array_map(function ($u) {
        unset($u['password']);
        return $u;
    }, $db->getAllUsers());
    jsonResponse($users);
}

if ($method === 'POST') {
    $input = getJsonInput();
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';
    $displayName = trim($input['display_name'] ?? '');

    if (!$username || !$password || !$displayName) {
        jsonResponse(['error' => 'Semua field wajib diisi'], 400);
    }
    if (strlen($password) < 4) {
        jsonResponse(['error' => 'Password minimal 4 karakter'], 400);
    }
    if ($db->findUserByUsername($username)) {
        jsonResponse(['error' => 'Username sudah digunakan'], 409);
    }

    $color = $colors[array_rand($colors)];
    $user = $db->createUser([
        'username' => $username,
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'display_name' => $displayName,
        'avatar_color' => $color
    ]);

    jsonResponse([
        'id' => $user['id'],
        'username' => $user['username'],
        'display_name' => $user['display_name'],
        'avatar_color' => $user['avatar_color']
    ], 201);
}

jsonResponse(['error' => 'Method not allowed'], 405);
