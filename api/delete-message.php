<?php
require_once __DIR__ . '/../includes/auth.php';

$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$id = (int)($_GET['id'] ?? getJsonInput()['id'] ?? 0);
if (!$id) jsonResponse(['error' => 'ID pesan tidak valid'], 400);

$msg = $db->findMessageById($id);
if (!$msg) jsonResponse(['error' => 'Pesan tidak ditemukan'], 404);
if ($msg['user_id'] !== $user['id']) jsonResponse(['error' => 'Hanya bisa hapus pesan sendiri'], 403);

deleteMediaFile($msg['media_url'] ?? null);

if (!$db->deleteMessage($id, $user['id'])) {
    jsonResponse(['error' => 'Gagal menghapus pesan'], 500);
}

jsonResponse(['success' => true, 'id' => $id]);
