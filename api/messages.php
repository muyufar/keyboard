<?php
require_once __DIR__ . '/../includes/auth.php';

$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $limit = min((int)($_GET['limit'] ?? 50), 200);
    $before = isset($_GET['before']) ? (int)$_GET['before'] : null;
    $since = isset($_GET['since']) ? (int)$_GET['since'] : null;

    $messages = $db->getMessages($limit, $before, $since);
    $result = [];

    foreach ($messages as $msg) {
        $u = $db->findUserById($msg['user_id']);
        $result[] = array_merge($msg, [
            'display_name' => $u['display_name'] ?? '',
            'avatar_color' => $u['avatar_color'] ?? '#6366f1',
            'username' => $u['username'] ?? ''
        ]);
    }

    jsonResponse($result);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $content = trim($input['content'] ?? '') ?: null;
    $mediaType = $input['media_type'] ?? null;
    $mediaUrl = $input['media_url'] ?? null;
    $mediaName = $input['media_name'] ?? null;

    if (!$content && !$mediaUrl) jsonResponse(['error' => 'Pesan kosong'], 400);

    $msg = $db->createMessage([
        'user_id' => $user['id'],
        'content' => $content,
        'media_type' => $mediaType,
        'media_url' => $mediaUrl,
        'media_name' => $mediaName
    ]);

    jsonResponse($db->getMessageWithUser($msg['id']), 201);
}

jsonResponse(['error' => 'Method not allowed'], 405);
