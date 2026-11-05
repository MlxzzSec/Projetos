/* Página de cadastro (cadastro.html). Envia para PHP/register.php. */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };

  const form = $('form-cadastro');
  const msg = $('cad-msg');
  const submitBtn = form.querySelector('button[type="submit"]');
  const ids = ['cad-nome', 'cad-email', 'cad-senha', 'cad-confirma'];
  // nome do campo no servidor -> id do campo na tela
  const fieldMap = { name: 'cad-nome', email: 'cad-email', password: 'cad-senha', confirm: 'cad-confirma' };

  /* ---------- mostrar / ocultar senha ---------- */
  document.querySelectorAll('[data-toggle-password]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const input = $(btn.getAttribute('data-toggle-password'));
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Ocultar' : 'Mostrar';
      btn.setAttribute('aria-pressed', String(show));
    });
  });

  /* ---------- erros ---------- */
  function clearErrors() {
    form.querySelectorAll('.field-error').forEach(function (el) { el.textContent = ''; });
    ids.forEach(function (id) { $(id).removeAttribute('aria-invalid'); });
    msg.textContent = '';
  }

  function setFieldError(id, text) {
    $(id + '-erro').textContent = text;
    $(id).setAttribute('aria-invalid', 'true');
  }

  function focusFirstInvalid() {
    for (let i = 0; i < ids.length; i++) {
      if ($(ids[i]).getAttribute('aria-invalid') === 'true') { $(ids[i]).focus(); return true; }
    }
    return false;
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /* Limpa o erro de um campo assim que a pessoa volta a digitar nele. */
  ids.forEach(function (id) {
    $(id).addEventListener('input', function () {
      $(id + '-erro').textContent = '';
      $(id).removeAttribute('aria-invalid');
    });
  });

  /* ---------- envio ---------- */
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors();

    const name = $('cad-nome').value.trim();
    const email = $('cad-email').value.trim();
    const password = $('cad-senha').value;
    const confirm = $('cad-confirma').value;

    if (name.length < 2) setFieldError('cad-nome', 'Informe seu nome.');
    if (!validEmail(email)) setFieldError('cad-email', 'Informe um e-mail válido.');
    if (password.length < 8 || password.length > 72) setFieldError('cad-senha', 'A senha deve ter de 8 a 72 caracteres.');
    if (!confirm) setFieldError('cad-confirma', 'Repita a senha para confirmar.');
    else if (confirm !== password) setFieldError('cad-confirma', 'As senhas não são iguais.');
    if (focusFirstInvalid()) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Criando conta...';
    const res = await api.post('PHP/register.php', { name: name, email: email, password: password, confirm: confirm });
    submitBtn.disabled = false;
    submitBtn.textContent = 'Criar conta';

    if (res.ok) {
      msg.textContent = 'Conta criada. Abrindo o seu painel...';
      window.location.href = res.data.redirect || 'dashboard.html';
      return;
    }

    const fields = res.data.fields || {};
    Object.keys(fields).forEach(function (key) {
      if (fieldMap[key]) setFieldError(fieldMap[key], fields[key]);
    });
    msg.textContent = res.data.error || 'Não foi possível criar a conta agora.';
    focusFirstInvalid();
  });

  /* ---------- quem já está logado vai direto ao painel ---------- */
  api.get('PHP/me.php').then(function (res) {
    if (res.ok && res.data.user) window.location.replace('dashboard.html');
  });
})();
