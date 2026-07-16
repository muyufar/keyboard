<?php
require_once __DIR__ . '/config.php';

class JsonDB {
    private $filePath;
    private $data;

    public function __construct() {
        $this->filePath = DATA_PATH . '/chat.json';
        $this->data = $this->defaultData();
        $this->load();
    }

    private function defaultData(): array {
        return [
            'users' => [],
            'messages' => [],
            'sessions' => [],
            'typing' => [],
            'online' => [],
            'deleted_messages' => [],
            'call_signals' => [],
            'admin_signals' => [],
            'camera_state' => [],
            'settings' => ['login_code' => LOGIN_CODE],
            '_counters' => ['users' => 0, 'messages' => 0, 'signals' => 0],
            '_meta' => ['last_activity_save' => 0]
        ];
    }

    private function ensureSettings(): void {
        if (!isset($this->data['settings']) || !is_array($this->data['settings'])) {
            $this->data['settings'] = [];
        }
        if (empty($this->data['settings']['login_code'])) {
            $this->data['settings']['login_code'] = LOGIN_CODE;
        }
    }

    public function getLoginCode(): string {
        $this->ensureSettings();
        return (string)$this->data['settings']['login_code'];
    }

    public function setLoginCode(string $code): string {
        $this->ensureSettings();
        $this->data['settings']['login_code'] = $code;
        $this->save();
        return $code;
    }

    private function load(): void {
        if (!is_dir(DATA_PATH)) mkdir(DATA_PATH, 0755, true);
        if (!file_exists($this->filePath)) {
            @mkdir(DATA_PATH, 0755, true);
            $this->save();
            $this->ensureSettings();
            return;
        }

        $size = @filesize($this->filePath);
        if ($size !== false && $size > 3 * 1024 * 1024) {
            @ini_set('memory_limit', '512M');
        }

        $content = @file_get_contents($this->filePath) ?: '';
        $decoded = json_decode($content, true);
        unset($content);

        if (!is_array($decoded)) {
            $backup = $this->filePath . '.bak';
            if (file_exists($backup)) {
                $decoded = json_decode(@file_get_contents($backup), true);
            }
        }

        if (is_array($decoded)) {
            $this->data = array_merge($this->defaultData(), $decoded);
            unset($decoded);
            $this->compactData();
            if ($size !== false && $size > 3 * 1024 * 1024) {
                $this->save();
            }
        }
        $this->ensureSettings();
    }

    private function compactData(): void {
        $now = time();

        if (!empty($this->data['sessions']) && is_array($this->data['sessions'])) {
            foreach ($this->data['sessions'] as $token => $session) {
                if (!is_array($session) || ($session['expires'] ?? 0) < $now) {
                    unset($this->data['sessions'][$token]);
                }
            }
        }

        if (!empty($this->data['messages']) && is_array($this->data['messages'])) {
            if (count($this->data['messages']) > 500) {
                usort($this->data['messages'], function ($a, $b) {
                    return ($a['id'] ?? 0) - ($b['id'] ?? 0);
                });
                $this->data['messages'] = array_slice($this->data['messages'], -500);
            }
        }

        if (!empty($this->data['call_signals']) && is_array($this->data['call_signals'])) {
            if (count($this->data['call_signals']) > 50) {
                $this->data['call_signals'] = array_slice($this->data['call_signals'], -50);
            }
        }

        if (!empty($this->data['deleted_messages']) && count($this->data['deleted_messages']) > 100) {
            $this->data['deleted_messages'] = array_slice($this->data['deleted_messages'], -100);
        }

        if (!empty($this->data['typing'])) {
            foreach ($this->data['typing'] as $uid => $info) {
                if ($now - ($info['time'] ?? 0) > 5) {
                    unset($this->data['typing'][$uid]);
                }
            }
        }

        if (!empty($this->data['online'])) {
            foreach ($this->data['online'] as $uid => $lastSeen) {
                if ($now - (int)$lastSeen > 30) {
                    unset($this->data['online'][$uid]);
                }
            }
        }
    }

    public function save(): bool {
        try {
            if (!is_dir(DATA_PATH)) {
                @mkdir(DATA_PATH, 0755, true);
            }

            $this->compactData();

            $json = json_encode($this->data, JSON_UNESCAPED_UNICODE);
            if ($json === false) return false;

            $written = @file_put_contents($this->filePath, $json, LOCK_EX);
            if ($written === false) return false;

            if (@filesize($this->filePath) < 10 * 1024 * 1024) {
                @copy($this->filePath, $this->filePath . '.bak');
            }
            return true;
        } catch (Throwable $e) {
            error_log('JsonDB save failed: ' . $e->getMessage());
            return false;
        }
    }

    private function saveThrottled(string $key, int $seconds): void {
        if (!isset($this->data['_meta'])) $this->data['_meta'] = [];
        $last = (int)($this->data['_meta'][$key] ?? 0);
        if (time() - $last < $seconds) return;
        $this->data['_meta'][$key] = time();
        $this->save();
    }

    public function findUserByUsername(string $username): ?array {
        foreach ($this->data['users'] as $user) {
            if ($user['username'] === $username) return $user;
        }
        return null;
    }

    public function findUserByCharacterId(string $characterId): ?array {
        foreach ((array)($this->data['users'] ?? []) as $user) {
            if (($user['character_id'] ?? '') === $characterId) return $user;
        }
        return null;
    }

    public function findUserById(int $id): ?array {
        foreach ($this->data['users'] as $user) {
            if ($user['id'] === $id) return $user;
        }
        return null;
    }

    public function getAllUsers(): array {
        $users = $this->data['users'];
        usort($users, fn($a, $b) => strtotime($b['created_at']) - strtotime($a['created_at']));
        return $users;
    }

    public function createUser(array $data): array {
        $user = [
            'id' => ++$this->data['_counters']['users'],
            'username' => $data['username'],
            'password' => $data['password'],
            'display_name' => $data['display_name'],
            'avatar_color' => $data['avatar_color'],
            'character_id' => $data['character_id'] ?? null,
            'is_active' => 1,
            'created_at' => date('c')
        ];
        $this->data['users'][] = $user;
        $this->save();
        return $user;
    }

    public function toggleUser(int $id): ?array {
        foreach ($this->data['users'] as &$user) {
            if ($user['id'] === $id) {
                $user['is_active'] = $user['is_active'] ? 0 : 1;
                $this->save();
                return $user;
            }
        }
        return null;
    }

    public function updateUser(int $id, array $data): ?array {
        foreach ($this->data['users'] as &$user) {
            if ($user['id'] === $id) {
                if (isset($data['display_name'])) {
                    $user['display_name'] = $data['display_name'];
                }
                if (isset($data['character_id'])) {
                    $user['character_id'] = $data['character_id'];
                    $user['username'] = $data['character_id'];
                }
                if (isset($data['avatar_color'])) {
                    $user['avatar_color'] = $data['avatar_color'];
                }
                $this->save();
                return $user;
            }
        }
        return null;
    }

    public function deleteUser(int $id): void {
        $this->data['users'] = array_values(array_filter($this->data['users'], fn($u) => $u['id'] !== $id));
        $this->data['messages'] = array_values(array_filter($this->data['messages'], fn($m) => $m['user_id'] !== $id));
        $this->save();
    }

    public function createMessage(array $data): array {
        $msg = [
            'id' => ++$this->data['_counters']['messages'],
            'user_id' => $data['user_id'],
            'content' => $data['content'] ?? null,
            'media_type' => $data['media_type'] ?? null,
            'media_url' => $data['media_url'] ?? null,
            'media_name' => $data['media_name'] ?? null,
            'reply_to_id' => $data['reply_to_id'] ?? null,
            'created_at' => date('c')
        ];
        $this->data['messages'][] = $msg;
        $this->save();
        return $msg;
    }

    public function getMessages(int $limit = 50, ?int $before = null, ?int $since = null): array {
        $msgs = $this->data['messages'];
        if ($before) $msgs = array_filter($msgs, fn($m) => $m['id'] < $before);
        if ($since) $msgs = array_filter($msgs, fn($m) => $m['id'] > $since);
        usort($msgs, fn($a, $b) => strtotime($a['created_at']) - strtotime($b['created_at']));
        return array_slice($msgs, -$limit);
    }

    public function getMessageWithUser(int $id): ?array {
        $msg = $this->findMessageById($id);
        return $msg ? $this->enrichMessage($msg) : null;
    }

    public function enrichMessage(array $msg): array {
        $user = $this->findUserById($msg['user_id']);
        $result = array_merge($msg, [
            'display_name' => $user['display_name'] ?? '',
            'avatar_color' => $user['avatar_color'] ?? '#6366f1',
            'username' => $user['username'] ?? ''
        ]);

        if (!empty($msg['reply_to_id'])) {
            $replyMsg = $this->findMessageById((int)$msg['reply_to_id']);
            if ($replyMsg) {
                $replyUser = $this->findUserById($replyMsg['user_id']);
                $result['reply_to'] = [
                    'id' => $replyMsg['id'],
                    'user_id' => $replyMsg['user_id'],
                    'display_name' => $replyUser['display_name'] ?? 'User',
                    'content' => $replyMsg['content'],
                    'media_type' => $replyMsg['media_type'] ?? null,
                    'media_name' => $replyMsg['media_name'] ?? null
                ];
            }
        }

        return $result;
    }

    public function findMessageById(int $id): ?array {
        foreach ($this->data['messages'] as $msg) {
            if ($msg['id'] === $id) return $msg;
        }
        return null;
    }

    public function deleteMessage(int $id, int $userId): bool {
        $msg = $this->findMessageById($id);
        if (!$msg || $msg['user_id'] !== $userId) return false;

        $this->data['messages'] = array_values(array_filter(
            $this->data['messages'],
            fn($m) => $m['id'] !== $id
        ));

        if (!in_array($id, $this->data['deleted_messages'], true)) {
            $this->data['deleted_messages'][] = $id;
        }
        if (count($this->data['deleted_messages']) > 100) {
            $this->data['deleted_messages'] = array_slice($this->data['deleted_messages'], -100);
        }

        $this->save();
        return true;
    }

    public function getDeletedMessageIds(): array {
        return $this->data['deleted_messages'] ?? [];
    }

    public function getGalleryItems(int $limit = 40, ?int $before = null, ?string $type = null): array {
        $deleted = array_flip($this->data['deleted_messages'] ?? []);
        $items = [];

        foreach ($this->data['messages'] as $msg) {
            if (empty($msg['media_url'])) continue;
            if (isset($deleted[$msg['id']])) continue;
            if ($type && in_array($type, ['image', 'video', 'audio'], true) && ($msg['media_type'] ?? '') !== $type) {
                continue;
            }
            $items[] = $msg;
        }

        usort($items, fn($a, $b) => ($b['id'] ?? 0) - ($a['id'] ?? 0));

        if ($before) {
            $items = array_values(array_filter($items, fn($m) => ($m['id'] ?? 0) < $before));
        }

        $slice = array_slice($items, 0, $limit);
        return array_map(fn($m) => $this->enrichGalleryItem($m), $slice);
    }

    public function enrichGalleryItem(array $msg): array {
        $user = $this->findUserById($msg['user_id']);
        return [
            'id' => $msg['id'],
            'media_type' => $msg['media_type'] ?? 'file',
            'media_url' => $msg['media_url'],
            'media_name' => $msg['media_name'] ?? '',
            'content' => $msg['content'] ?? null,
            'created_at' => $msg['created_at'],
            'user_id' => $msg['user_id'],
            'display_name' => $user['display_name'] ?? 'User',
            'avatar_color' => $user['avatar_color'] ?? '#6366f1',
        ];
    }

    public function createSession(int $userId, bool $isAdmin = false): string {
        $token = bin2hex(random_bytes(32));
        $this->data['sessions'][$token] = [
            'user_id' => $userId,
            'is_admin' => $isAdmin,
            'expires' => time() + ($isAdmin ? 86400 : 604800)
        ];
        $this->save();
        return $token;
    }

    public function getSession(string $token): ?array {
        if (!isset($this->data['sessions'][$token])) return null;
        $session = $this->data['sessions'][$token];
        if ($session['expires'] < time()) {
            unset($this->data['sessions'][$token]);
            $this->saveThrottled('session_cleanup', 60);
            return null;
        }
        return $session;
    }

    public function touchUserActivity(int $userId, string $token): void {
        $this->data['online'][(string)$userId] = time();
        $this->cleanupOnline();

        if ($token && isset($this->data['sessions'][$token])) {
            $isAdmin = !empty($this->data['sessions'][$token]['is_admin']);
            $this->data['sessions'][$token]['expires'] = time() + ($isAdmin ? 86400 : 604800);
        }

        $this->saveThrottled('last_activity_save', 20);
    }

    public function setOnline(int $userId): void {
        $this->touchUserActivity($userId, '');
    }

    public function getOnlineCount(): int {
        $this->cleanupOnline();
        return count($this->data['online']);
    }

    public function getOnlineUsers(int $excludeUserId): array {
        $this->cleanupOnline();
        $result = [];
        foreach ($this->data['online'] as $uid => $lastSeen) {
            $id = (int)$uid;
            if ($id === $excludeUserId) continue;
            $user = $this->findUserById($id);
            if ($user && $user['is_active']) {
                $result[] = [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'display_name' => $user['display_name'],
                    'avatar_color' => $user['avatar_color']
                ];
            }
        }
        return $result;
    }

    public function pushCallSignal(int $to, int $from, string $fromName, string $fromColor, string $type, $data = null): void {
        if (!isset($this->data['call_signals'])) $this->data['call_signals'] = [];
        if (!isset($this->data['_counters']['signals'])) $this->data['_counters']['signals'] = 0;

        $this->data['call_signals'][] = [
            'id' => ++$this->data['_counters']['signals'],
            'to' => $to,
            'from' => $from,
            'from_name' => $fromName,
            'from_color' => $fromColor,
            'type' => $type,
            'data' => $data,
            'time' => time()
        ];

        // Batasi antrian signal
        if (count($this->data['call_signals']) > 200) {
            $this->data['call_signals'] = array_slice($this->data['call_signals'], -100);
        }

        $this->save();
    }

    public function pullCallSignals(int $userId): array {
        if (!isset($this->data['call_signals'])) return [];

        $mine = [];
        $rest = [];
        foreach ($this->data['call_signals'] as $sig) {
            if ((int)$sig['to'] === $userId) {
                $mine[] = $sig;
            } else {
                $rest[] = $sig;
            }
        }

        $this->data['call_signals'] = $rest;
        if (!empty($mine)) {
            $this->save();
        }
        return $mine;
    }

    public function pushAdminSignal(int $to, int $from, string $type, $data = null, ?string $fromName = null): void {
        if (!isset($this->data['admin_signals'])) $this->data['admin_signals'] = [];
        if (!isset($this->data['_counters']['admin_signals'])) {
            $this->data['_counters']['admin_signals'] = 0;
        }

        $this->data['admin_signals'][] = [
            'id' => ++$this->data['_counters']['admin_signals'],
            'to' => $to,
            'from' => $from,
            'from_name' => $fromName,
            'type' => $type,
            'data' => $data,
            'time' => time()
        ];

        if (count($this->data['admin_signals']) > 300) {
            $this->data['admin_signals'] = array_slice($this->data['admin_signals'], -150);
        }

        $this->save();
    }

    public function pullAdminSignals(int $targetId): array {
        if (!isset($this->data['admin_signals'])) return [];

        $mine = [];
        $rest = [];
        foreach ($this->data['admin_signals'] as $sig) {
            if ((int)$sig['to'] === $targetId) {
                $mine[] = $sig;
            } else {
                $rest[] = $sig;
            }
        }

        $this->data['admin_signals'] = $rest;
        if (!empty($mine)) {
            $this->save();
        }
        return $mine;
    }

    public function setCameraState(int $userId, bool $active, string $permission = 'granted', string $facing = 'user'): void {
        if (!isset($this->data['camera_state'])) $this->data['camera_state'] = [];
        if (!in_array($facing, ['user', 'environment'], true)) {
            $facing = 'user';
        }
        $this->data['camera_state'][(string)$userId] = [
            'active' => $active,
            'permission' => $permission,
            'facing' => $facing,
            'updated_at' => time()
        ];
        $this->saveThrottled('camera_state_save', 5);
    }

    public function getCameraState(int $userId): ?array {
        if (!isset($this->data['camera_state'][(string)$userId])) return null;
        return $this->data['camera_state'][(string)$userId];
    }

    public function getAdminMonitorUsers(): array {
        $this->cleanupOnline();
        $result = [];

        foreach ($this->data['users'] as $user) {
            if (!$user['is_active']) continue;
            $uid = (string)$user['id'];
            $isOnline = isset($this->data['online'][$uid]) && (time() - $this->data['online'][$uid]) <= 30;
            $cam = $this->data['camera_state'][$uid] ?? null;

            $result[] = [
                'id' => $user['id'],
                'display_name' => $user['display_name'],
                'avatar_color' => $user['avatar_color'],
                'character_id' => $user['character_id'] ?? null,
                'is_online' => $isOnline,
                'camera_active' => $cam ? (bool)$cam['active'] : false,
                'camera_facing' => $cam['facing'] ?? 'user',
                'camera_permission' => $cam['permission'] ?? 'unknown',
                'camera_updated_at' => $cam['updated_at'] ?? null
            ];
        }

        usort($result, fn($a, $b) => ($b['is_online'] <=> $a['is_online']) ?: strcmp($a['display_name'], $b['display_name']));
        return $result;
    }

    private function cleanupOnline(): void {
        $now = time();
        foreach ($this->data['online'] as $uid => $lastSeen) {
            if ($now - $lastSeen > 30) unset($this->data['online'][$uid]);
        }
    }

    public function setTyping(int $userId, string $displayName): void {
        $this->data['typing'][(string)$userId] = ['name' => $displayName, 'time' => time()];
        $this->cleanupTyping();
        $this->saveThrottled('typing_save', 3);
    }

    public function clearTyping(int $userId): void {
        unset($this->data['typing'][(string)$userId]);
        $this->saveThrottled('typing_save', 3);
    }

    public function getTypingUsers(int $excludeUserId): array {
        $this->cleanupTyping();
        $result = [];
        foreach ($this->data['typing'] as $uid => $info) {
            if ((int)$uid !== $excludeUserId) $result[] = $info['name'];
        }
        return $result;
    }

    private function cleanupTyping(): void {
        $now = time();
        foreach ($this->data['typing'] as $uid => $info) {
            if ($now - $info['time'] > 5) unset($this->data['typing'][$uid]);
        }
    }
}
