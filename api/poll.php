<?php
require_once __DIR__ . '/../includes/auth.php';

$user = requireAuth();

$since = (int)($_GET['since'] ?? 0);
$typing = $db->getTypingUsers($user['id']);

$newMessages = [];
if ($since > 0) {
    $msgs = $db->getMessages(50, null, $since);
    foreach ($msgs as $msg) {
        $u = $db->findUserById($msg['user_id']);
        $newMessages[] = array_merge($msg, [
            'display_name' => $u['display_name'] ?? '',
            'avatar_color' => $u['avatar_color'] ?? '#6366f1',
            'username' => $u['username'] ?? ''
        ]);
    }
}

jsonResponse([
    'messages' => $newMessages,
    'typing' => $typing,
    'online' => $db->getOnlineCount()
]);
