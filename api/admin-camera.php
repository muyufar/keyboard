<?php
require_once __DIR__ . '/../includes/auth.php';

requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$input = getJsonInput();
$action = $input['action'] ?? '';
$userId = (int)($input['user_id'] ?? 0);

if (!$userId) {
    jsonResponse(['error' => 'User tidak valid'], 400);
}

$target = $db->findUserById($userId);
if (!$target || !$target['is_active']) {
    jsonResponse(['error' => 'User tidak ditemukan'], 404);
}

$signalMap = [
    'cam_on' => 'admin-cam-on',
    'cam_off' => 'admin-cam-off',
    'monitor_start' => 'monitor-request',
    'monitor_stop' => 'monitor-stop',
];

if (isset($signalMap[$action])) {
    $db->pushAdminSignal($userId, 0, $signalMap[$action], null);
    jsonResponse(['ok' => true]);
}

if ($action === 'cam_facing') {
    $facing = $input['facing'] ?? 'user';
    if (!in_array($facing, ['user', 'environment'], true)) {
        jsonResponse(['error' => 'Mode kamera tidak valid'], 400);
    }
    $db->pushAdminSignal($userId, 0, 'admin-cam-facing', ['facing' => $facing]);
    jsonResponse(['ok' => true]);
}

if ($action === 'monitor_signal') {
    $type = $input['type'] ?? '';
    $data = $input['data'] ?? null;
    $allowedTypes = ['monitor-offer', 'monitor-answer', 'monitor-ice', 'monitor-stop'];
    if (!in_array($type, $allowedTypes, true)) {
        jsonResponse(['error' => 'Signal tidak valid'], 400);
    }
    $db->pushAdminSignal($userId, 0, $type, $data);
    jsonResponse(['ok' => true]);
}

jsonResponse(['error' => 'Aksi tidak dikenal'], 400);
