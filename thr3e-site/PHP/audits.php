<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

const AUDIT_TYPES = ['Teste de invasão', 'Auditoria de código', 'Login e sessões', 'Monitoramento contínuo'];

$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET') {
    $user = require_user();
    $stmt = db()->prepare('SELECT id, target, type, details, status, created_at FROM audits WHERE user_id = ? ORDER BY id DESC LIMIT 100');
    $stmt->execute([$user['id']]);
    json_out(200, ['audits' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $in   = require_post_json();
    $user = require_user();

    $target  = clean_text($in['target'] ?? '', 300);
    $type    = clean_text($in['type'] ?? '', 40);
    $details = clean_text($in['details'] ?? '', 1000);

    $errors = [];
    $parts = parse_url($target);
    if (!$parts || !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || empty($parts['host'])) {
        $errors['target'] = 'Informe um endereço completo, como https://meusite.com.br.';
    }
    if (!in_array($type, AUDIT_TYPES, true)) {
        $errors['type'] = 'Escolha um dos serviços da lista.';
    }
    if ($errors) {
        json_out(422, ['error' => 'Revise os campos.', 'fields' => $errors]);
    }

    $stmt = db()->prepare('INSERT INTO audits (user_id, target, type, details) VALUES (?, ?, ?, ?)');
    $stmt->execute([$user['id'], $target, $type, $details]);
    json_out(201, ['ok' => true]);
}

header('Allow: GET, POST');
json_out(405, ['error' => 'Método não permitido.']);
