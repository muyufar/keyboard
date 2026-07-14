<?php
/**
 * Endpoint mandiri untuk daftar karakter login.
 * Tidak memuat config/db agar stabil di shared hosting (cPanel).
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Access-Control-Allow-Origin: *');

$CHARACTERS = [
    'librarian' => ['name' => 'Pustakawan', 'title' => 'Ahli buku', 'color' => '#4a90d9'],
    'student'   => ['name' => 'Pelajar', 'title' => 'Pencari ilmu', 'color' => '#22c55e'],
    'merchant'  => ['name' => 'Pedagang', 'title' => 'Jual beli buku', 'color' => '#f97316'],
    'writer'    => ['name' => 'Penulis', 'title' => 'Pena giat', 'color' => '#a855f7'],
    'reader'    => ['name' => 'Pembaca', 'title' => 'Kutu buku', 'color' => '#ec4899'],
    'courier'   => ['name' => 'Kurir', 'title' => 'Antar pesanan', 'color' => '#ef4444'],
];

function send_characters_json($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $charUsers = [];
    $root = dirname(__DIR__);
    $file = $root . '/data/chat.json';

    if (file_exists($file) && is_readable($file)) {
        $raw = file_get_contents($file);
        if ($raw !== false && $raw !== '') {
            $db = json_decode($raw, true);
            if (is_array($db) && !empty($db['users']) && is_array($db['users'])) {
                foreach ($db['users'] as $user) {
                    if (!is_array($user)) {
                        continue;
                    }
                    $cid = isset($user['character_id']) ? $user['character_id'] : '';
                    if ($cid !== '') {
                        $charUsers[$cid] = $user;
                    }
                }
            }
        }
    }

    $chars = [];
    foreach ($CHARACTERS as $id => $meta) {
        $user = isset($charUsers[$id]) ? $charUsers[$id] : null;
        $active = $user && !empty($user['is_active']);
        $chars[] = [
            'id' => $id,
            'name' => $meta['name'],
            'title' => $meta['title'],
            'color' => $meta['color'],
            'available' => $active,
            'display_name' => $user ? (isset($user['display_name']) ? $user['display_name'] : null) : null,
        ];
    }

    send_characters_json($chars);
} catch (Exception $e) {
    send_characters_json(['error' => 'Gagal memuat karakter: ' . $e->getMessage()], 500);
}
