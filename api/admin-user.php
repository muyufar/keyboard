<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/characters.php';
requireAdmin();

$method = $_SERVER['REQUEST_METHOD'];
$id = (int)($_GET['id'] ?? 0);

if (!$id) jsonResponse(['error' => 'ID tidak valid'], 400);

if ($method === 'PUT') {
    $input = getJsonInput();
    $characterId = trim($input['character_id'] ?? '');
    $displayName = trim($input['display_name'] ?? '');

    if (!$characterId || !$displayName) {
        jsonResponse(['error' => 'Karakter dan nama tampilan wajib diisi'], 400);
    }
    if (!isValidCharacter($characterId)) {
        jsonResponse(['error' => 'Karakter tidak valid'], 400);
    }

    $user = $db->findUserById($id);
    if (!$user) jsonResponse(['error' => 'User tidak ditemukan'], 404);

    $existing = $db->findUserByCharacterId($characterId);
    if ($existing && $existing['id'] !== $id) {
        jsonResponse(['error' => 'Karakter sudah digunakan user lain'], 409);
    }

    $meta = CHARACTERS[$characterId];
    $updated = $db->updateUser($id, [
        'character_id' => $characterId,
        'display_name' => $displayName,
        'avatar_color' => $meta['color']
    ]);

    unset($updated['password']);
    jsonResponse($updated);
}

if ($method === 'PATCH') {
    $input = getJsonInput();
    if (($input['action'] ?? '') === 'toggle') {
        $user = $db->toggleUser($id);
        if (!$user) jsonResponse(['error' => 'User tidak ditemukan'], 404);
        jsonResponse(['id' => $user['id'], 'is_active' => $user['is_active']]);
    }
    jsonResponse(['error' => 'Aksi tidak valid'], 400);
}

if ($method === 'DELETE') {
    $db->deleteUser($id);
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Method not allowed'], 405);
