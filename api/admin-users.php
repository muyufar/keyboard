<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/characters.php';
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
    $characterId = trim($input['character_id'] ?? '');
    $displayName = trim($input['display_name'] ?? '');

    if (!$characterId || !$displayName) {
        jsonResponse(['error' => 'Karakter dan nama tampilan wajib diisi'], 400);
    }
    if (!isValidCharacter($characterId)) {
        jsonResponse(['error' => 'Karakter tidak valid'], 400);
    }
    if ($db->findUserByCharacterId($characterId)) {
        jsonResponse(['error' => 'Karakter sudah digunakan'], 409);
    }

    $meta = CHARACTERS[$characterId];
    $user = $db->createUser([
        'username' => $characterId,
        'password' => password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT),
        'display_name' => $displayName,
        'avatar_color' => $meta['color'],
        'character_id' => $characterId
    ]);

    jsonResponse([
        'id' => $user['id'],
        'username' => $user['username'],
        'display_name' => $user['display_name'],
        'avatar_color' => $user['avatar_color'],
        'character_id' => $user['character_id']
    ], 201);
}

jsonResponse(['error' => 'Method not allowed'], 405);
