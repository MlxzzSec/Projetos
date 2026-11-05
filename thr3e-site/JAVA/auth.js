/* Tela de login / criar conta (login.html). */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };

  /* ---------- abas Entrar / Criar conta ---------- */
  const tabs = [
    { tab: $('aba-entrar'),   panel: $('painel-entrar'),   hash: '' },
    { tab: $('aba-cadastro'), panel: $('painel-cadastro'), hash: '#cadastro' }
  ];

  function selectTab(index, focus) {
    tabs.forEach(function (item, i) {
      const active = i === index;
      item.tab.setAttribute('aria-selected', String(active));
      item.tab.tabIndex = active ? 0 : -1;
      item.panel.hidden = !active;
    });
    if (focus) tabs[index].tab.focus();
  }

  tabs.forEach(function (item, i) {
    item.tab.addEventListener('click', function () {
      selectTab(i, false);
      history.replaceState(null, '', location.pathname + item.hash);
    });
    item.tab.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        selectTab((i + 1) % tabs.length, true);
      }
    });
  });

  selectTab(location.hash === '#cadastro' ? 1 : 0, false);
  window.addEventListener('hashchange', function () {
    selectTab(location.hash === '#cadastro' ? 1 : 0, false);
  });

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

  /* ---------- helpers de erro ---------- */
  function clearErrors(form, msgEl) {
    form.querySelectorAll('.field-error').forEach(function (el) { el.textContent = ''; });
    form.querySelectorAll('.input').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    msgEl.textContent = '';
  }

  function setFieldError(inputId, text) {
    const input = $(inputId);
    const err = $(inputId + '-erro');
    if (err) err.textContent = text;
    if (input) input.setAttribute('aria-invalid', 'true');
  }

  function firstInvalid(ids) {
    for (let i = 0; i < ids.length; i++) {
      if ($(ids[i]).getAttribute('aria-invalid') === 'true') return $(ids[i]);
    }
    return null;
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function setBusy(form, busy, label) {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = busy;
    btn.textContent = busy ? 'Aguarde...' : label;
  }

  /* ---------- entrar ---------- */
  const loginForm = $('painel-entrar');
  const loginIds = ['login-email', 'login-senha'];

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const msg = $('login-msg');
    clearErrors(loginForm, msg);

    const email = $('login-email').value.trim();
    const password = $('login-senha').value;

    if (!validEmail(email)) setFieldError('login-email', 'Informe um e-mail válido.');
    if (!password) setFieldError('login-senha', 'Informe sua senha.');
    const bad = firstInvalid(loginIds);
    if (bad) { bad.focus(); return; }

    setBusy(loginForm, true, 'Entrar');
    const res = await api.post('PHP/login.php', { email: email, password: password });
    setBusy(loginForm, false, 'Entrar');

    if (res.ok) {
      window.location.href = res.data.redirect || 'dashboard.html';
      return;
    }
    msg.textContent = res.data.error || 'Não foi possível entrar agora.';
    if (res.status === 401) $('login-senha').select();
  });

  /* ---------- criar conta ---------- */
  const signupForm = $('painel-cadastro');
  const signupIds = ['cad-nome', 'cad-email', 'cad-senha', 'cad-confirma'];
  const fieldMap = { name: 'cad-nome', email: 'cad-email', password: 'cad-senha', confirm: 'cad-confirma' };

  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const msg = $('cad-msg');
    clearErrors(signupForm, msg);

    const name = $('cad-nome').value.trim();
    const email = $('cad-email').value.trim();
    const password = $('cad-senha').value;
    const confirm = $('cad-confirma').value;

    if (name.length < 2) setFieldError('cad-nome', 'Informe seu nome.');
    if (!validEmail(email)) setFieldError('cad-email', 'Informe um e-mail válido.');
    if (password.length < 8 || password.length > 72) setFieldError('cad-senha', 'A senha deve ter de 8 a 72 caracteres.');
    if (confirm !== password) setFieldError('cad-confirma', 'As senhas não são iguais.');
    const bad = firstInvalid(signupIds);
    if (bad) { bad.focus(); return; }

    setBusy(signupForm, true, 'Criar conta');
    const res = await api.post('PHP/register.php', { name: name, email: email, password: password, confirm: confirm });
    setBusy(signupForm, false, 'Criar conta');

    if (res.ok) {
      window.location.href = res.data.redirect || 'dashboard.html';
      return;
    }
    const fields = res.data.fields || {};
    Object.keys(fields).forEach(function (key) {
      if (fieldMap[key]) setFieldError(fieldMap[key], fields[key]);
    });
    msg.textContent = res.data.error || 'Não foi possível criar a conta agora.';
    const first = firstInvalid(signupIds);
    if (first) first.focus();
  });

  /* ---------- quem já está logado vai direto ao painel ---------- */
  api.get('PHP/me.php').then(function (res) {
    if (res.ok && res.data.user) window.location.replace('dashboard.html');
  });
})();
