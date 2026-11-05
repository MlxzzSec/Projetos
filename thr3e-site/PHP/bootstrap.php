<?php
/*
 * Base compartilhada pelos endpoints: sessão segura, banco SQLite (PDO),
 * validações de origem e helpers de resposta JSON.
 */

declare(strict_types=1);

// O horário desejado da reunião chega como horário local do cliente (sem fuso).
date_default_timezone_set('America/Sao_Paulo');

// Problemas de instalação (pasta sem permissão, extensão desligada) têm mensagem própria,
// segura para mostrar ao usuário. Qualquer outro erro vira uma mensagem genérica.
class SetupException extends RuntimeException {}

ini_set('display_errors', '0');
ini_set('log_errors', '1');

set_exception_handler(function (Throwable $e): void {
    error_log('[THR3E] ' . get_class($e) . ': ' . $e->getMessage());
    $message = $e instanceof SetupException
        ? $e->getMessage()
        : 'Erro interno no servidor. Tente de novo em instantes.';
    json_out(500, ['error' => $message]);
});

const DB_FILE = __DIR__ . '/../database/app.sqlite';
const MAX_LOGIN_FAILURES = 5;      // tentativas erradas permitidas
const LOGIN_LOCK_MINUTES = 15;     // janela de bloqueio

function json_out(int $status, array $data = [])
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

    session_name('thr3e_sid');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $https,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_start();
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    if (!extension_loaded('pdo_sqlite')) {
        throw new SetupException('O PHP deste servidor está sem a extensão pdo_sqlite. Ative "extension=pdo_sqlite" no php.ini e reinicie o servidor.');
    }
    $dir = dirname(DB_FILE);
    if (!is_dir($dir)) {
        throw new SetupException('A pasta "database" não foi encontrada ao lado da pasta PHP. Copie a pasta "database" do projeto.');
    }
    if (!is_writable($dir) || (file_exists(DB_FILE) && !is_writable(DB_FILE))) {
        throw new SetupException('A pasta "database" não tem permissão de escrita. Libere a escrita nela para o usuário do servidor.');
    }

    $pdo = new PDO('sqlite:' . DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');
    try {
        $pdo->exec('PRAGMA journal_mode = WAL');
    } catch (Throwable $e) {
        // alguns sistemas de arquivos não suportam WAL; o modo padrão funciona igual
    }
    migrate($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TEXT NOT NULL DEFAULT (strftime(\'%Y-%m-%dT%H:%M:%SZ\',\'now\'))
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS login_attempts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        email      TEXT NOT NULL,
        ip         TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_attempts ON login_attempts (email, ip, created_at)');

    $pdo->exec('CREATE TABLE IF NOT EXISTS audits (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target     TEXT NOT NULL,
        type       TEXT NOT NULL,
        details    TEXT NOT NULL DEFAULT \'\',
        status     TEXT NOT NULL DEFAULT \'Recebido\',
        created_at TEXT NOT NULL DEFAULT (strftime(\'%Y-%m-%dT%H:%M:%SZ\',\'now\'))
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS meetings (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title        TEXT NOT NULL,
        desired_at   TEXT NOT NULL,
        details      TEXT NOT NULL DEFAULT \'\',
        status       TEXT NOT NULL DEFAULT \'Solicitada\',
        created_at   TEXT NOT NULL DEFAULT (strftime(\'%Y-%m-%dT%H:%M:%SZ\',\'now\'))
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sender     TEXT NOT NULL CHECK (sender IN (\'client\',\'staff\')),
        body       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime(\'%Y-%m-%dT%H:%M:%SZ\',\'now\'))
    )');
}

/* Só aceita requisições feitas pelo próprio site (fetch same-origin com JSON). */
function require_post_json(): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        json_out(405, ['error' => 'Método não permitido.']);
    }
    require_same_origin();

    $type = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($type, 'application/json') !== 0) {
        json_out(415, ['error' => 'Formato de requisição inválido.']);
    }
    $raw = file_get_contents('php://input', false, null, 0, 65536);
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) {
        json_out(400, ['error' => 'Requisição inválida.']);
    }
    return $data;
}

function require_same_origin(): void
{
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'fetch') {
        json_out(403, ['error' => 'Requisição não autorizada.']);
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $host = parse_url($origin, PHP_URL_HOST);
        $port = parse_url($origin, PHP_URL_PORT);
        $originHost = $host . ($port ? ':' . $port : '');
        if (!hash_equals((string)($_SERVER['HTTP_HOST'] ?? ''), $originHost)) {
            json_out(403, ['error' => 'Origem não permitida.']);
        }
    }
}

function current_user(): ?array
{
    start_session();
    $id = $_SESSION['uid'] ?? null;
    if (!is_int($id)) {
        return null;
    }
    $stmt = db()->prepare('SELECT id, name, email, created_at FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    return $user ?: null;
}

function require_user(): array
{
    $user = current_user();
    if (!$user) {
        json_out(401, ['error' => 'Sessão expirada. Entre novamente.']);
    }
    return $user;
}

function clean_text(mixed $value, int $max): string
{
    $text = is_string($value) ? trim($value) : '';
    // remove caracteres de controle, preservando quebras de linha
    $text = preg_replace('/[^\P{C}\n]/u', '', $text) ?? '';
    return text_cut($text, $max);
}

function text_len(string $text): int
{
    return function_exists('mb_strlen') ? mb_strlen($text) : strlen($text);
}

function text_cut(string $text, int $max): string
{
    return function_exists('mb_substr') ? mb_substr($text, 0, $max) : substr($text, 0, $max);
}

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
