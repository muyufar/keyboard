<?php
require_once __DIR__ . '/../includes/auth.php';

$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$input = getJsonInput();
$to = (int)($input['to'] ?? 0);
$type = $input['type'] ?? '';
$data = $input['data'] ?? null;

$allowedTypes = ['call-request', 'call-accept', 'call-reject', 'call-offer', 'call-answer', 'call-ice', 'call-hangup'];
if (!$to || !in_array($type, $allowedTypes, true)) {
    jsonResponse(['error' => 'Signal tidak valid'], 400);
}

$target = $db->findUserById($to);
if (!$target || !$target['is_active']) {
    jsonResponse(['error' => 'User tidak ditemukan atau offline'], 404);
}

$db->pushCallSignal(
    $to,
    $user['id'],
    $user['display_name'],
    $user['avatar_color'],
    $type,
    $data
);

jsonResponse(['ok' => true]);
