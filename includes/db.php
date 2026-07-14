<?php
require_once __DIR__ . '/config.php';

class JsonDB {
    private string $filePath;
    private array $data;

    public function __construct() {
        $this->filePath = DATA_PATH . '/chat.json';
        $this->data = ['users' => [], 'messages' => [], 'sessions' => [], 'typing' => [], 'online' => [], 'deleted_messages' => [], '_counters' => ['users' => 0, 'messages' => 0]];
        $this->load();
    }

    private function load(): void {
        if (!is_dir(DATA_PATH)) mkdir(DATA_PATH, 0755, true);
        if (file_exists($this->filePath)) {
            $content = file_get_contents($this->filePath);
            $decoded = json_decode($content, true);
            if (is_array($decoded)) {
                $this->data = array_merge($this->data, $decoded);
            }
        } else {
            $this->save();
        }
    }

    public function save(): void {
        file_put_contents($this->filePath, json_encode($this->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }

    public function findUserByUsername(string $username): ?array {
        foreach ($this->data['users'] as $user) {
            if ($user['username'] === $username) return $user;
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
        foreach ($this->data['messages'] as $msg) {
            if ($msg['id'] === $id) {
                $user = $this->findUserById($msg['user_id']);
                return array_merge($msg, [
                    'display_name' => $user['display_name'] ?? '',
                    'avatar_color' => $user['avatar_color'] ?? '#6366f1',
                    'username' => $user['username'] ?? ''
                ]);
            }
        }
        return null;
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

        $this->save();
        return true;
    }

    public function getDeletedMessageIds(): array {
        return $this->data['deleted_messages'] ?? [];
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
            $this->save();
            return null;
        }
        return $session;
    }

    public function setOnline(int $userId): void {
        $this->data['online'][(string)$userId] = time();
        $this->cleanupOnline();
        $this->save();
    }

    public function getOnlineCount(): int {
        $this->cleanupOnline();
        return count($this->data['online']);
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
        $this->save();
    }

    public function clearTyping(int $userId): void {
        unset($this->data['typing'][(string)$userId]);
        $this->save();
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
