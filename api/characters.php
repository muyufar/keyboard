<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$CHARACTERS = array(
    'librarian' => array('name' => 'Pustakawan', 'title' => 'Ahli buku', 'color' => '#4a90d9'),
    'student'   => array('name' => 'Pelajar', 'title' => 'Pencari ilmu', 'color' => '#22c55e'),
    'merchant'  => array('name' => 'Pedagang', 'title' => 'Jual beli buku', 'color' => '#f97316'),
    'writer'    => array('name' => 'Penulis', 'title' => 'Pena giat', 'color' => '#a855f7'),
    'reader'    => array('name' => 'Pembaca', 'title' => 'Kutu buku', 'color' => '#ec4899'),
    'courier'   => array('name' => 'Kurir', 'title' => 'Antar pesanan', 'color' => '#ef4444'),
);

$charUsers = array();
$root = dirname(__DIR__);
$file = $root . '/data/chat.json';

if (file_exists($file) && is_readable($file)) {
    $raw = @file_get_contents($file);
    if ($raw !== false && $raw !== '') {
        $db = json_decode($raw, true);
        if (is_array($db) && isset($db['users']) && is_array($db['users'])) {
            foreach ($db['users'] as $user) {
                if (!is_array($user)) continue;
                if (!empty($user['character_id'])) {
                    $charUsers[$user['character_id']] = $user;
                }
            }
        }
    }
}

$chars = array();
foreach ($CHARACTERS as $id => $meta) {
    $user = isset($charUsers[$id]) ? $charUsers[$id] : null;
    $chars[] = array(
        'id' => $id,
        'name' => $meta['name'],
        'title' => $meta['title'],
        'color' => $meta['color'],
        'available' => ($user && !empty($user['is_active'])) ? true : false,
        'display_name' => $user ? (isset($user['display_name']) ? $user['display_name'] : null) : null,
    );
}

$json = json_encode($chars);
if ($json === false) {
    header('HTTP/1.1 500 Internal Server Error');
    echo '{"error":"json_encode gagal"}';
} else {
    echo $json;
}
