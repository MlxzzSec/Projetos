<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET') {
    $user = require_user();
    $stmt = db()->prepare('SELECT id, title, desired_at, details, status, created_at FROM meetings WHERE user_id = ? ORDER BY id DESC LIMIT 100');
    $stmt->execute([$user['id']]);
    json_out(200, ['meetings' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $in   = require_post_json();
    $user = require_user();

    $title   = clean_text($in['title'] ?? '', 120);
    $date    = clean_text($in['date'] ?? '', 16);   // formato datetime-local: 2026-11-10T14:30
    $details = clean_text($in['details'] ?? '', 1000);

    $errors = [];
    if (text_len($title) < 3) {
        $errors['title'] = 'Informe o assunto da reunião.';
    }
    $when = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', $date);
    if (!$when || $when->format('Y-m-d\TH:i') !== $date) {
        $errors['date'] = 'Escolha uma data e horário válidos.';
    } elseif ($when < new DateTimeImmutable('now')) {
        $errors['date'] = 'Escolha uma data futura.';
    }
    if ($errors) {
        json_out(422, ['error' => 'Revise os campos.', 'fields' => $errors]);
    }

    $stmt = db()->prepare('INSERT INTO meetings (user_id, title, desired_at, details) VALUES (?, ?, ?, ?)');
    $stmt->execute([$user['id'], $title, $date, $details]);
    json_out(201, ['ok' => true]);
}

header('Allow: GET, POST');
json_out(405, ['error' => 'Método não permitido.']);
