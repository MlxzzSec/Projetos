/* Painel do cliente (dashboard.html): pedidos, reuniões e conversa. */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };

  function fmtDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function fmtLocal(value) {
    // "2026-11-10T14:30" já é horário local, sem conversão de fuso
    const d = new Date(value);
    return isNaN(d) ? value : d.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
  }

  /* Constrói elementos só com textContent: nada vindo do servidor entra como HTML. */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function emptyState(container, text) {
    container.replaceChildren(el('p', 'field-hint', text));
  }

  function clearErrors(form, msgEl) {
    form.querySelectorAll('.field-error').forEach(function (n) { n.textContent = ''; });
    form.querySelectorAll('.input').forEach(function (n) { n.removeAttribute('aria-invalid'); });
    msgEl.textContent = '';
  }

  function setFieldError(inputId, text) {
    const input = $(inputId);
    const err = $(inputId + '-erro');
    if (err) err.textContent = text;
    if (input) input.setAttribute('aria-invalid', 'true');
  }

  function applyServerFields(fields, map) {
    Object.keys(fields || {}).forEach(function (key) {
      if (map[key]) setFieldError(map[key], fields[key]);
    });
  }

  function setBusy(form, busy, label) {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = busy;
    btn.textContent = busy ? 'Enviando...' : label;
  }

  async function sessionExpired(res) {
    if (res.status === 401) {
      window.location.replace('login.html');
      return true;
    }
    return false;
  }

  /* ---------- abas ---------- */
  const tabButtons = Array.from(document.querySelectorAll('.client-tab'));
  const views = Array.from(document.querySelectorAll('.client-view'));
  let chatTimer = null;

  function showTab(name) {
    tabButtons.forEach(function (b) {
      const on = b.getAttribute('data-tab') === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    views.forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });

    clearInterval(chatTimer);
    if (name === 'chat') {
      loadMessages(true);
      chatTimer = setInterval(function () { loadMessages(false); }, 15000);
    }
  }

  tabButtons.forEach(function (b) {
    b.setAttribute('role', 'tab');
    b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
  });

  /* ---------- pedidos ---------- */
  async function loadAudits() {
    const box = $('lista-auditorias');
    const res = await api.get('PHP/audits.php');
    if (await sessionExpired(res)) return;
    if (!res.ok) { emptyState(box, 'Não foi possível carregar seus pedidos.'); return; }

    const list = res.data.audits || [];
    if (!list.length) { emptyState(box, 'Você ainda não fez nenhum pedido.'); return; }

    box.replaceChildren.apply(box, list.map(function (a) {
      const card = el('article', 'client-card');
      card.appendChild(el('h3', '', a.type));
      card.appendChild(el('span', 'status-badge', a.status));
      card.appendChild(el('p', 'client-meta', a.target + ' · enviado em ' + fmtDate(a.created_at)));
      if (a.details) card.appendChild(el('p', 'client-details', a.details));
      return card;
    }));
  }

  const auditForm = $('form-auditoria');
  auditForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const msg = $('aud-msg');
    clearErrors(auditForm, msg);

    const target = $('aud-alvo').value.trim();
    const type = $('aud-tipo').value;
    const details = $('aud-detalhes').value.trim();

    let valid = true;
    try {
      const u = new URL(target);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocolo');
    } catch (err) {
      valid = false;
      setFieldError('aud-alvo', 'Informe o endereço completo, como https://meusite.com.br.');
      $('aud-alvo').focus();
    }
    if (!valid) return;

    setBusy(auditForm, true, 'Enviar pedido');
    const res = await api.post('PHP/audits.php', { target: target, type: type, details: details });
    setBusy(auditForm, false, 'Enviar pedido');
    if (await sessionExpired(res)) return;

    if (res.ok) {
      auditForm.reset();
      msg.textContent = 'Pedido enviado. Você acompanha o andamento ao lado.';
      loadAudits();
      return;
    }
    applyServerFields(res.data.fields, { target: 'aud-alvo', type: 'aud-tipo', details: 'aud-detalhes' });
    msg.textContent = res.data.error || 'Não foi possível enviar o pedido.';
  });

  /* ---------- reuniões ---------- */
  async function loadMeetings() {
    const box = $('lista-reunioes');
    const res = await api.get('PHP/meetings.php');
    if (await sessionExpired(res)) return;
    if (!res.ok) { emptyState(box, 'Não foi possível carregar suas reuniões.'); return; }

    const list = res.data.meetings || [];
    if (!list.length) { emptyState(box, 'Você ainda não solicitou nenhuma reunião.'); return; }

    box.replaceChildren.apply(box, list.map(function (m) {
      const card = el('article', 'client-card');
      card.appendChild(el('h3', '', m.title));
      card.appendChild(el('span', 'status-badge', m.status));
      card.appendChild(el('p', 'client-meta', 'Horário desejado: ' + fmtLocal(m.desired_at)));
      if (m.details) card.appendChild(el('p', 'client-details', m.details));
      return card;
    }));
  }

  const meetingForm = $('form-reuniao');
  meetingForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const msg = $('meeting-msg');
    clearErrors(meetingForm, msg);

    const title = $('meeting-title').value.trim();
    const date = $('meeting-date').value;
    const details = $('meeting-details').value.trim();

    if (title.length < 3) setFieldError('meeting-title', 'Informe o assunto da reunião.');
    if (!date) setFieldError('meeting-date', 'Escolha uma data e horário.');
    else if (new Date(date) < new Date()) setFieldError('meeting-date', 'Escolha uma data futura.');
    const bad = meetingForm.querySelector('[aria-invalid="true"]');
    if (bad) { bad.focus(); return; }

    setBusy(meetingForm, true, 'Solicitar reunião');
    const res = await api.post('PHP/meetings.php', { title: title, date: date, details: details });
    setBusy(meetingForm, false, 'Solicitar reunião');
    if (await sessionExpired(res)) return;

    if (res.ok) {
      meetingForm.reset();
      msg.textContent = 'Reunião solicitada. Vamos confirmar o horário pela conversa.';
      loadMeetings();
      return;
    }
    applyServerFields(res.data.fields, { title: 'meeting-title', date: 'meeting-date', details: 'meeting-details' });
    msg.textContent = res.data.error || 'Não foi possível solicitar a reunião.';
  });

  /* ---------- conversa ---------- */
  let lastMessageId = 0;

  async function loadMessages(forceScroll) {
    const box = $('chat-messages');
    const res = await api.get('PHP/messages.php');
    if (await sessionExpired(res)) return;
    if (!res.ok) return;

    const list = res.data.messages || [];
    const newest = list.length ? list[list.length - 1].id : 0;
    if (newest === lastMessageId && !forceScroll) return;
    lastMessageId = newest;

    if (!list.length) { emptyState(box, 'Nenhuma mensagem ainda. Escreva abaixo para começar.'); return; }

    box.replaceChildren.apply(box, list.map(function (m) {
      const bubble = el('div', 'chat-bubble' + (m.sender === 'client' ? ' mine' : ''));
      bubble.appendChild(document.createTextNode(m.body));
      bubble.appendChild(el('span', 'chat-time', fmtDate(m.created_at)));
      return bubble;
    }));
    box.scrollTop = box.scrollHeight;
  }

  const chatForm = $('chat-form');
  chatForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const msg = $('chat-msg');
    msg.textContent = '';
    const body = $('chat-input').value.trim();
    if (!body) { msg.textContent = 'Escreva uma mensagem antes de enviar.'; return; }

    setBusy(chatForm, true, 'Enviar mensagem');
    const res = await api.post('PHP/messages.php', { body: body });
    setBusy(chatForm, false, 'Enviar mensagem');
    if (await sessionExpired(res)) return;

    if (res.ok) {
      $('chat-input').value = '';
      loadMessages(true);
    } else {
      msg.textContent = res.data.error || 'Não foi possível enviar a mensagem.';
    }
  });

  /* ---------- sair ---------- */
  $('sair').addEventListener('click', async function () {
    await api.post('PHP/logout.php');
    window.location.replace('login.html');
  });

  /* ---------- início: só mostra o painel com sessão válida ---------- */
  (async function init() {
    const res = await api.get('PHP/me.php');
    if (!res.ok || !res.data.user) {
      window.location.replace('login.html');
      return;
    }
    const user = res.data.user;
    const firstName = user.name.split(' ')[0];
    $('saudacao').textContent = 'Olá, ' + firstName;
    $('conta-email').textContent = user.email;
    const since = new Date(user.created_at);
    if (!isNaN(since)) {
      $('conta-desde').textContent = ' · cliente desde ' + since.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    $('painel').hidden = false;
    showTab('jobs');
    loadAudits();
    loadMeetings();
  })();
})();
