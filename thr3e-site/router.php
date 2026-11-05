<?php
/*
 * Roteador para o servidor embutido do PHP (uso local):
 *   php -S localhost:8000 router.php
 * Bloqueia o acesso direto ao banco e a arquivos internos e envia
 * os cabeçalhos de segurança nas páginas HTML.
 * No Apache, o .htaccess faz esse papel e este arquivo não é usado.
 */

$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
if ($path === '/') {
    $path = '/index.html';
}
if ($path === '/admin' || $path === '/admin/') {
    $path = '/admin/login.html';
}

if (preg_match('~^/(database/|router\.php|README)~i', $path) || preg_match('~/\.~', $path)) {
    http_response_code(404);
    echo 'Não encontrado.';
    return true;
}

$file = realpath(__DIR__ . $path);
if ($file !== false && str_starts_with($file, __DIR__ . DIRECTORY_SEPARATOR) && str_ends_with($file, '.html')) {
    header('Content-Type: text/html; charset=utf-8');
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    readfile($file);
    return true;
}

return false; // deixa o servidor entregar CSS, JS, imagens e executar os .php
