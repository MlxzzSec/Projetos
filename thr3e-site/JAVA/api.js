/*
 * Cliente da API. Todas as chamadas vão para o mesmo domínio (CSP: connect-src 'self')
 * e levam o cabeçalho X-Requested-With, que o backend exige.
 * Devolve sempre { ok, status, data } e nunca lança erro de rede para a tela.
 *
 * Quando a resposta não vem do PHP (site aberto sem servidor PHP, por exemplo),
 * devolve uma mensagem que explica o que fazer, em vez de um erro genérico.
 */
(function () {
  'use strict';

  const RUN_HINT = 'Rode na pasta do projeto: php -S localhost:8000 router.php e abra http://localhost:8000';

  function fail(status, message) {
    return { ok: false, status: status, data: { error: message } };
  }

  async function request(path, options) {
    const opts = options || {};

    if (location.protocol === 'file:') {
      return fail(0, 'O site foi aberto direto do arquivo, e assim o PHP não roda. ' + RUN_HINT);
    }

    const headers = { 'Accept': 'application/json', 'X-Requested-With': 'fetch' };
    const init = { method: opts.method || 'GET', headers: headers, credentials: 'same-origin' };

    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }

    let res;
    try {
      res = await fetch(path, init);
    } catch (e) {
      return fail(0, 'Não foi possível conectar ao servidor. Confira se ele está ligado. ' + RUN_HINT);
    }

    const type = res.headers.get('content-type') || '';
    if (type.indexOf('application/json') === -1) {
      // A resposta não veio dos nossos arquivos PHP: servidor sem PHP, rota errada ou erro fatal.
      return fail(res.status, 'O servidor respondeu algo inesperado (código ' + res.status + '), sem passar pelo PHP. ' + RUN_HINT);
    }

    let data = {};
    try { data = await res.json(); } catch (e) { /* JSON quebrado */ }
    return { ok: res.ok, status: res.status, data: data };
  }

  window.api = {
    get: function (path) { return request(path); },
    post: function (path, body) { return request(path, { method: 'POST', body: body || {} }); }
  };
})();
