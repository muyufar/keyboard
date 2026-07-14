<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/characters.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);

$input = getJsonInput();
$characterId = trim($input['character_id'] ?? '');
$code = trim($input['code'] ?? '');

if ($code !== $db->getLoginCode()) {
    jsonResponse(['error' => 'Kode akses salah'], 401);
}

if (!$characterId || !isValidCharacter($characterId)) {
    jsonResponse(['error' => 'Karakter tidak valid'], 400);
}

$user = $db->findUserByCharacterId($characterId);
if (!$user || !$user['is_active']) {
    jsonResponse(['error' => 'Karakter belum tersedia. Hubungi admin.'], 401);
}

$token = $db->createSession($user['id']);
$db->setOnline($user['id']);

jsonResponse([
    'token' => $token,
    'user' => [
        'id' => $user['id'],
        'username' => $user['username'],
        'display_name' => $user['display_name'],
        'avatar_color' => $user['avatar_color'],
        'character_id' => $user['character_id']
    ]
]);
