<?php
require_once __DIR__ . '/../includes/auth.php';

$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);

$input = getJsonInput();
$action = $input['action'] ?? 'stop';

if ($action === 'start') {
    $db->setTyping($user['id'], $user['display_name']);
} else {
    $db->clearTyping($user['id']);
}

jsonResponse(['ok' => true]);
