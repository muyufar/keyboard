<?php
require_once __DIR__ . '/characters.php';

define('CHAT_JSON_MAX_READ', 524288); // 512KB cukup untuk baca daftar users

function read_users_from_chat_file($file) {
    $charUsers = array();
    if (!file_exists($file) || !is_readable($file)) {
        return $charUsers;
    }

    $size = @filesize($file);
    if ($size === false || $size === 0) {
        return $charUsers;
    }

    // File kecil: parse normal
    if ($size <= CHAT_JSON_MAX_READ) {
        $raw = @file_get_contents($file);
        if ($raw) {
            $db = json_decode($raw, true);
            if (is_array($db) && !empty($db['users']) && is_array($db['users'])) {
                foreach ($db['users'] as $user) {
                    if (!is_array($user) || empty($user['character_id'])) continue;
                    $charUsers[$user['character_id']] = $user;
                }
            }
        }
        return $charUsers;
    }

    // File besar: baca hanya bagian "users" di awal file (hemat memory)
    $chunk = @file_get_contents($file, false, null, 0, CHAT_JSON_MAX_READ);
    if ($chunk && preg_match('/"users"\s*:\s*(\[[^\]]*\])/s', $chunk, $m)) {
        $users = json_decode($m[1], true);
        if (is_array($users)) {
            foreach ($users as $user) {
                if (!is_array($user) || empty($user['character_id'])) continue;
                $charUsers[$user['character_id']] = $user;
            }
            return $charUsers;
        }
    }

    // Fallback: coba file backup yang lebih kecil
    $bak = $file . '.bak';
    if (file_exists($bak) && @filesize($bak) <= CHAT_JSON_MAX_READ) {
        return read_users_from_chat_file($bak);
    }

    return $charUsers;
}

function build_login_characters() {
    $charUsers = read_users_from_chat_file(DATA_PATH . '/chat.json');

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
