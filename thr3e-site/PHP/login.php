<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$in = require_post_json();

$email    = strtolower(clean_text($in['email'] ?? '', 254));
$password = is_string($in['password'] ?? null) ? $in['password'] : '';

if ($email === '' || $password === '') {
    json_out(422, ['error' => 'Informe e-mail e senha.']);
}

$pdo = db();
$ip  = client_ip();
$now = time();
$windowStart = $now - LOGIN_LOCK_MINUTES * 60;

// limpa tentativas antigas e confere o bloqueio por e-mail + IP
$pdo->prepare('DELETE FROM login_attempts WHERE created_at < ?')->execute([$windowStart]);

$count = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE email = ? AND ip = ? AND created_at >= ?');
$count->execute([$email, $ip, $windowStart]);
if ((int)$count->fetchColumn() >= MAX_LOGIN_FAILURES) {
    json_out(429, ['error' => 'Muitas tentativas. Aguarde ' . LOGIN_LOCK_MINUTES . ' minutos e tente de novo.']);
}

$stmt = $pdo->prepare('SELECT id, password_hash FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

// Sempre roda password_verify, mesmo sem usuário, para o tempo de resposta
// não revelar se o e-mail existe.
$dummy = '$2y$10$4PlnIQ1IebCVcbENG0.YC.wBPi72Z6Nk5j05HTlPXXbg0iYucSytm';
$ok = password_verify($password, $user['password_hash'] ?? $dummy) && $user;

if (!$ok) {
    $pdo->prepare('INSERT INTO login_attempts (email, ip, created_at) VALUES (?, ?, ?)')->execute([$email, $ip, $now]);
    json_out(401, ['error' => 'E-mail ou senha incorretos.']);
}

// sucesso: zera as falhas e troca o ID de sessão (evita fixação de sessão)
$pdo->prepare('DELETE FROM login_attempts WHERE email = ? AND ip = ?')->execute([$email, $ip]);

if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        ->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
}

start_session();
session_regenerate_id(true);
$_SESSION['uid'] = (int)$user['id'];

json_out(200, ['ok' => true, 'redirect' => 'dashboard.html']);
