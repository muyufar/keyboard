<?php
require_once __DIR__ . '/characters.php';

function build_login_characters() {
    $charUsers = array();
    $file = DATA_PATH . '/chat.json';

    if (file_exists($file) && is_readable($file)) {
        $raw = @file_get_contents($file);
        if ($raw !== false && $raw !== '') {
            $db = json_decode($raw, true);
            if (is_array($db) && isset($db['users']) && is_array($db['users'])) {
                foreach ($db['users'] as $user) {
                    if (!is_array($user) || empty($user['character_id'])) {
                        continue;
                    }
                    $charUsers[$user['character_id']] = $user;
                }
            }
        }
    }

    $chars = array();
    foreach (CHARACTERS as $id => $meta) {
        $user = isset($charUsers[$id]) ? $charUsers[$id] : null;
        $chars[] = array(
            'id' => $id,
            'name' => $meta['name'],
            'title' => $meta['title'],
            'color' => $meta['color'],
            'available' => ($user && !empty($user['is_active'])) ? true : false,
            'display_name' => $user ? (isset($user['display_name']) ? $user['display_name'] : null) : null,
        );
    }

    return $chars;
}
