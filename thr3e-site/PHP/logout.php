<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

require_post_json();
start_session();

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires'  => time() - 3600,
        'path'     => $p['path'],
        'secure'   => $p['secure'],
        'httponly' => $p['httponly'],
        'samesite' => $p['samesite'] ?: 'Strict',
    ]);
}
session_destroy();

json_out(200, ['ok' => true]);
