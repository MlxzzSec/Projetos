<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    json_out(405, ['error' => 'Método não permitido.']);
}

// Sem sessão não é erro: responde 200 com user = null.
// (Um 401 aqui aparecia em vermelho no console toda vez que alguém abria a tela de login.)
json_out(200, ['user' => current_user()]);
