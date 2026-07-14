<?php
require_once __DIR__ . '/includes/config.php';

header('Content-Type: application/manifest+json; charset=utf-8');
header('Cache-Control: public, max-age=86400');

$base = BASE_PATH;
$iconBase = $base . '/public/icons';

echo json_encode([
    'name' => 'Pemesanan Buku',
    'short_name' => 'Pemesanan',
    'description' => 'Aplikasi komunikasi pemesanan buku',
    'start_url' => $base . '/',
    'scope' => $base . '/',
    'display' => 'standalone',
    'display_override' => ['standalone', 'fullscreen'],
    'orientation' => 'any',
    'background_color' => '#0f1117',
    'theme_color' => '#6366f1',
    'lang' => 'id',
    'icons' => [
        [
            'src' => $iconBase . '/icon-192.png',
            'sizes' => '192x192',
            'type' => 'image/png',
            'purpose' => 'any'
        ],
        [
            'src' => $iconBase . '/icon-512.png',
            'sizes' => '512x512',
            'type' => 'image/png',
            'purpose' => 'any'
        ],
        [
            'src' => $iconBase . '/icon-512.png',
            'sizes' => '512x512',
            'type' => 'image/png',
            'purpose' => 'maskable'
        ]
    ]
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
