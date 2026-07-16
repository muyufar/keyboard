<?php
require_once __DIR__ . '/../includes/auth.php';

$user = requireAuth();

$since = (int)($_GET['since'] ?? 0);
$typing = $db->getTypingUsers($user['id']);

$newMessages = [];
if ($since > 0) {
    $msgs = $db->getMessages(50, null, $since);
    foreach ($msgs as $msg) {
        $newMessages[] = $db->enrichMessage($msg);
    }
}

jsonResponse([
    'messages' => $newMessages,
    'deleted' => $db->getDeletedMessageIds(),
    'typing' => $typing,
    'online' => $db->getOnlineCount(),
    'online_users' => $db->getOnlineUsers($user['id']),
    'call_signals' => $db->pullCallSignals($user['id']),
    'admin_signals' => (!empty($_GET['skip_admin_signals']) && $_GET['skip_admin_signals'] !== '0')
        ? []
        : $db->pullAdminSignals($user['id'])
]);
