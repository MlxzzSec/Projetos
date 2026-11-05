<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET') {
    $user = require_user();
    $stmt = db()->prepare('SELECT id, sender, body, created_at FROM messages WHERE user_id = ? ORDER BY id ASC LIMIT 500');
    $stmt->execute([$user['id']]);
    json_out(200, ['messages' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $in   = require_post_json();
    $user = require_user();

    $body = clean_text($in['body'] ?? '', 3000);
    if ($body === '') {
        json_out(422, ['error' => 'Escreva uma mensagem antes de enviar.']);
    }

    $stmt = db()->prepare('INSERT INTO messages (user_id, sender, body) VALUES (?, \'client\', ?)');
    $stmt->execute([$user['id'], $body]);
    json_out(201, ['ok' => true]);
}

header('Allow: GET, POST');
json_out(405, ['error' => 'Método não permitido.']);
