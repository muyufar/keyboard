<?php
// Definisi karakter pixel art
define('CHARACTERS', [
    'librarian' => ['name' => 'Pustakawan', 'title' => 'Ahli buku', 'color' => '#4a90d9'],
    'student'   => ['name' => 'Pelajar', 'title' => 'Pencari ilmu', 'color' => '#22c55e'],
    'merchant'  => ['name' => 'Pedagang', 'title' => 'Jual beli buku', 'color' => '#f97316'],
    'writer'    => ['name' => 'Penulis', 'title' => 'Pena giat', 'color' => '#a855f7'],
    'reader'    => ['name' => 'Pembaca', 'title' => 'Kutu buku', 'color' => '#ec4899'],
    'courier'   => ['name' => 'Kurir', 'title' => 'Antar pesanan', 'color' => '#ef4444'],
]);

function getCharacterList(): array {
    return CHARACTERS;
}

function isValidCharacter(string $id): bool {
    return isset(CHARACTERS[$id]);
}
