<?php
require_once __DIR__ . '/../includes/auth.php';

$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$limit = min((int)($_GET['limit'] ?? 40), 100);
$before = isset($_GET['before']) ? (int)$_GET['before'] : null;
$type = $_GET['type'] ?? null;
if ($type === 'all' || $type === '') $type = null;

$items = $db->getGalleryItems($limit, $before, $type);

jsonResponse([
    'items' => $items,
    'has_more' => count($items) >= $limit
]);
