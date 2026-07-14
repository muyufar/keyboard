<?php
/**
 * Endpoint ringan — hanya baca chat.json, tanpa JsonDB/locking.
 * Mencegah hang di shared hosting saat load karakter login.
 */
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/characters.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Access-Control-Allow-Origin: *');

function charsResponse($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $charUsers = [];
    $file = DATA_PATH . '/chat.json';

    if (is_readable($file)) {
        $raw = @file_get_contents($file);
        if ($raw) {
            $db = json_decode($raw, true);
            if (is_array($db)) {
                foreach ((array)($db['users'] ?? []) as $user) {
                    if (!is_array($user)) continue;
                    $cid = $user['character_id'] ?? '';
                    if ($cid) {
                        $charUsers[$cid] = $user;
                    }
                }
            }
        }
    }

    $chars = [];
    foreach (CHARACTERS as $id => $meta) {
        $user = $charUsers[$id] ?? null;
        $chars[] = [
            'id' => $id,
            'name' => $meta['name'],
            'title' => $meta['title'],
            'color' => $meta['color'],
            'available' => $user && !empty($user['is_active']),
            'display_name' => $user ? ($user['display_name'] ?? null) : null
        ];
    }

    charsResponse($chars);
} catch (Throwable $e) {
    charsResponse(['error' => 'Gagal memuat karakter: ' . $e->getMessage()], 500);
}
