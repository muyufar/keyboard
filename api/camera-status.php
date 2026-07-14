<?php
require_once __DIR__ . '/../includes/auth.php';

$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$input = getJsonInput();
$active = !empty($input['active']);
$permission = $input['permission'] ?? 'granted';
$facing = $input['facing'] ?? 'user';
$allowed = ['granted', 'denied', 'prompt', 'admin_off', 'unknown'];
if (!in_array($permission, $allowed, true)) {
    $permission = 'unknown';
}
if (!in_array($facing, ['user', 'environment'], true)) {
    $facing = 'user';
}

$db->setCameraState($user['id'], $active, $permission, $facing);
jsonResponse(['ok' => true]);
