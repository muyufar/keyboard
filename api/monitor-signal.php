<?php
require_once __DIR__ . '/../includes/auth.php';

$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$input = getJsonInput();
$type = $input['type'] ?? '';
$data = $input['data'] ?? null;

$allowedTypes = ['monitor-offer', 'monitor-answer', 'monitor-ice', 'monitor-stop'];
if (!in_array($type, $allowedTypes, true)) {
    jsonResponse(['error' => 'Signal tidak valid'], 400);
}

$db->pushAdminSignal(0, $user['id'], $type, $data, $user['display_name']);
jsonResponse(['ok' => true]);
