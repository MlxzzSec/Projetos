/* Abas da página de serviços. A aba aberta acompanha o endereço (servicos.html#login-e-sessoes). */
(function () {
  'use strict';

  const tabs = Array.from(document.querySelectorAll('.svc-tab'));
  const panels = Array.from(document.querySelectorAll('.svc-panel'));

  function indexFromHash() {
    const id = decodeURIComponent(location.hash.replace('#', ''));
    const i = panels.findIndex(function (p) { return p.id === id; });
    return i === -1 ? 0 : i;
  }

  function select(index, options) {
    const opts = options || {};
    tabs.forEach(function (tab, i) {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[i].hidden = !active;
    });
    if (opts.focus) tabs[index].focus();
    if (opts.updateHash) history.replaceState(null, '', '#' + panels[index].id);
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { select(i, { updateHash: true }); });

    tab.addEventListener('keydown', function (e) {
      let next = null;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      select(next, { focus: true, updateHash: true });
    });
  });

  window.addEventListener('hashchange', function () { select(indexFromHash()); });

  select(indexFromHash());
})();
