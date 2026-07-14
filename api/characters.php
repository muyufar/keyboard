<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/characters.php';

try {
    $chars = [];
    foreach (CHARACTERS as $id => $meta) {
        $user = $db->findUserByCharacterId($id);
        $chars[] = [
            'id' => $id,
            'name' => $meta['name'],
            'title' => $meta['title'],
            'color' => $meta['color'],
            'available' => $user && !empty($user['is_active']),
            'display_name' => $user ? $user['display_name'] : null
        ];
    }

    jsonResponse($chars);
} catch (Throwable $e) {
    jsonResponse(['error' => 'Gagal memuat karakter: ' . $e->getMessage()], 500);
}
