<?php
require_once __DIR__ . '/../includes/auth.php';
requireAdmin();

$method = $_SERVER['REQUEST_METHOD'];
$id = (int)($_GET['id'] ?? 0);

if (!$id) jsonResponse(['error' => 'ID tidak valid'], 400);

if ($method === 'PATCH') {
    $user = $db->toggleUser($id);
    if (!$user) jsonResponse(['error' => 'User tidak ditemukan'], 404);
    jsonResponse(['id' => $user['id'], 'is_active' => $user['is_active']]);
}

if ($method === 'DELETE') {
    $db->deleteUser($id);
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Method not allowed'], 405);
