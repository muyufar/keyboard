<?php
require_once __DIR__ . '/../includes/auth.php';

$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $limit = min((int)($_GET['limit'] ?? 50), 200);
    $before = isset($_GET['before']) ? (int)$_GET['before'] : null;
    $since = isset($_GET['since']) ? (int)$_GET['since'] : null;

    $messages = $db->getMessages($limit, $before, $since);
    $result = array_map(fn($msg) => $db->enrichMessage($msg), $messages);
    jsonResponse($result);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $content = trim($input['content'] ?? '') ?: null;
    $mediaType = $input['media_type'] ?? null;
    $mediaUrl = $input['media_url'] ?? null;
    $mediaName = $input['media_name'] ?? null;
    $replyToId = isset($input['reply_to_id']) ? (int)$input['reply_to_id'] : null;

    if (!$content && !$mediaUrl) jsonResponse(['error' => 'Pesan kosong'], 400);

    if ($replyToId && !$db->findMessageById($replyToId)) {
        jsonResponse(['error' => 'Pesan yang dibalas tidak ditemukan'], 404);
    }

    $msg = $db->createMessage([
        'user_id' => $user['id'],
        'content' => $content,
        'media_type' => $mediaType,
        'media_url' => $mediaUrl,
        'media_name' => $mediaName,
        'reply_to_id' => $replyToId
    ]);

    jsonResponse($db->getMessageWithUser($msg['id']), 201);
}

jsonResponse(['error' => 'Method not allowed'], 405);
