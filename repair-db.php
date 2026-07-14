<?php
/**
 * Jalankan sekali untuk memperkecil chat.json yang membengkak.
 * Akses: /keyboard/repair-db.php?key=repair0505
 * HAPUS file ini setelah selesai!
 */
require_once __DIR__ . '/includes/config.php';

$key = isset($_GET['key']) ? $_GET['key'] : '';
if ($key !== 'repair0505') {
    http_response_code(403);
    echo 'Forbidden';
    exit;
}

$file = DATA_PATH . '/chat.json';
if (!file_exists($file)) {
    echo 'chat.json tidak ditemukan';
    exit;
}

$before = filesize($file);
@ini_set('memory_limit', '512M');

$raw = file_get_contents($file);
$data = json_decode($raw, true);

if (!is_array($data)) {
    echo 'chat.json rusak, tidak bisa di-parse';
    exit;
}

$data['call_signals'] = array();
$data['typing'] = array();
$data['online'] = array();

if (!empty($data['sessions'])) {
    $now = time();
    foreach ($data['sessions'] as $token => $session) {
        if (($session['expires'] ?? 0) < $now) {
            unset($data['sessions'][$token]);
        }
    }
}

if (!empty($data['messages']) && count($data['messages']) > 300) {
    usort($data['messages'], function ($a, $b) {
        return ($a['id'] ?? 0) - ($b['id'] ?? 0);
    });
    $data['messages'] = array_slice($data['messages'], -300);
}

if (!empty($data['deleted_messages']) && count($data['deleted_messages']) > 50) {
    $data['deleted_messages'] = array_slice($data['deleted_messages'], -50);
}

$json = json_encode($data, JSON_UNESCAPED_UNICODE);
file_put_contents($file, $json, LOCK_EX);
@copy($file, $file . '.bak');

$after = filesize($file);
header('Content-Type: text/plain; charset=utf-8');
echo "Repair selesai!\n";
echo "Ukuran sebelum: " . round($before / 1024 / 1024, 2) . " MB\n";
echo "Ukuran sesudah: " . round($after / 1024 / 1024, 2) . " MB\n";
echo "Users: " . count($data['users'] ?? []) . "\n";
echo "Messages: " . count($data['messages'] ?? []) . "\n";
echo "\nHapus file repair-db.php sekarang untuk keamanan.";
