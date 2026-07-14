<?php
require_once __DIR__ . '/../includes/auth.php';

requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

jsonResponse([
    'signals' => $db->pullAdminSignals(0),
    'users' => $db->getAdminMonitorUsers()
]);
