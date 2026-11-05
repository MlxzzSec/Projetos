<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$in = require_post_json();

$name     = clean_text($in['name'] ?? '', 80);
$email    = strtolower(clean_text($in['email'] ?? '', 254));
$password = is_string($in['password'] ?? null) ? $in['password'] : '';
$confirm  = is_string($in['confirm'] ?? null) ? $in['confirm'] : '';

$errors = [];
if (text_len($name) < 2) {
    $errors['name'] = 'Informe seu nome.';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Informe um e-mail válido.';
}
// bcrypt só considera os primeiros 72 bytes, por isso o teto
if (strlen($password) < 8 || strlen($password) > 72) {
    $errors['password'] = 'A senha deve ter de 8 a 72 caracteres.';
}
if ($password !== $confirm) {
    $errors['confirm'] = 'As senhas não são iguais.';
}
if ($errors) {
    json_out(422, ['error' => 'Revise os campos.', 'fields' => $errors]);
}

$pdo = db();

$exists = $pdo->prepare('SELECT 1 FROM users WHERE email = ?');
$exists->execute([$email]);
if ($exists->fetchColumn()) {
    json_out(409, ['error' => 'Já existe uma conta com esse e-mail.', 'fields' => ['email' => 'E-mail já cadastrado.']]);
}

$insert = $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
$insert->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
$uid = (int)$pdo->lastInsertId();

start_session();
session_regenerate_id(true);
$_SESSION['uid'] = $uid;

json_out(201, ['ok' => true, 'redirect' => 'dashboard.html']);
