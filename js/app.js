/* ============================================================
   app.js — enrutado, páginas y toda la interacción
   ============================================================ */
(function (global) {
  'use strict';

  var S = Store;
  var view = document.getElementById('view');
  var currentRoute = 'dashboard';
  // la versión va en tres sitios que deben coincidir: aquí, VERSION en sw.js y data-build en index.html
  var APP_VERSION = '1.0.2';

  /* ---------------- instalar la app ----------------
     Chrome para Android (≤157) dice «ya está instalada» en su menú si hay OTRA
     app instalada en el mismo dominio (alexlobar.github.io: Hábitos, Japón…).
     beforeinstallprompt sí mira la carpeta: se guarda y se ofrece con un botón
     propio, que solo sale cuando el navegador permite instalarla. */
  // el aviso se escucha en index.html (antes del manifiesto); si ya llegó, se recoge aquí
  var installPrompt = window.__installPrompt || null;
  window.__onInstallPrompt = function (ev) {
    installPrompt = ev;
    if (currentRoute === 'dashboard' || currentRoute === 'ajustes') render();
  };
  window.addEventListener('appinstalled', function () {
    installPrompt = null;
    window.__installPrompt = null;
    toast('Mis cuentas instalada. Ya la tienes con las demás apps.', 'good');
    if (currentRoute === 'dashboard' || currentRoute === 'ajustes') render();
  });
  function installApp() {
    if (!installPrompt) return;
    var ev = installPrompt;
    installPrompt = null;            // cada aviso solo se puede usar una vez
    window.__installPrompt = null;
    ev.prompt();
    if (ev.userChoice) ev.userChoice.then(function () { render(); }, function () { render(); });
  }
  function isInstalled() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  /* ---------------- utilidades de UI ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg, kind) {
    var box = document.getElementById('toasts');
    var d = document.createElement('div');
    d.className = 'toast ' + (kind || '');
    d.textContent = msg;
    box.appendChild(d);
    setTimeout(function () { d.remove(); }, 4200);
  }

  function modal(html) {
    var m = document.getElementById('modal');
    document.getElementById('modalBody').innerHTML = html;
    m.showModal();
    return m;
  }
  function closeModal() { document.getElementById('modal').close(); }

  function confirmBox(text, onYes) {
    modal('<h2>' + esc(text) + '</h2><div class="row" style="margin-top:16px;justify-content:flex-end">' +
      '<button class="btn" data-act="modal-cancel">Cancelar</button>' +
      '<button class="btn danger" data-act="modal-yes">Sí, continuar</button></div>');
    pendingConfirm = onYes;
  }
  var pendingConfirm = null;

  /* ---------------- filtros por página ---------------- */
  function makeFilters() {
    return {
      movimientos: { preset: 'all', from: '', to: '', q: '', category: '', type: '', source: '', sort: 'date', dir: 'desc', page: 1 },
      carrefour: { preset: 'all', from: '', to: '', q: '', category: '', type: '', source: 'carrefour', sort: 'date', dir: 'desc', page: 1 },
      // en Personal arranca en el último mes con datos (ver pageDashboardPersonal)
      dashboard: { preset: S.space === 'personal' ? null : 'all', from: '', to: '', source: '' },
      global: { preset: null, from: '', to: '' },
      presupuesto: { month: '' },
      simple: { month: null }      // mes de la vista simple (null = el último con datos)
    };
  }
  var F = makeFilters();

  function resolvePeriod(f) {
    var today = new Date();
    var curMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    var p = f.preset;
    if (/^\d{4}-\d{2}$/.test(p)) { var b = S.monthBounds(p); return { from: b.from, to: b.to }; }
    if (/^\d{4}$/.test(p)) return { from: p + '-01-01', to: p + '-12-31' };
    switch (p) {
      case 'thisMonth': return S.monthBounds(curMonth);
      case 'lastMonth': return S.monthBounds(S.addMonths(curMonth, -1));
      case 'last3': return { from: S.monthBounds(S.addMonths(curMonth, -2)).from, to: S.monthBounds(curMonth).to };
      case 'last6': return { from: S.monthBounds(S.addMonths(curMonth, -5)).from, to: S.monthBounds(curMonth).to };
      case 'last12': return { from: S.monthBounds(S.addMonths(curMonth, -11)).from, to: S.monthBounds(curMonth).to };
      case 'thisYear': return { from: today.getFullYear() + '-01-01', to: today.getFullYear() + '-12-31' };
      case 'custom': return { from: f.from || '', to: f.to || '' };
      default: return { from: '', to: '' };
    }
  }

  function periodSelect(f, source, monthsOverride) {
    var months = monthsOverride || S.monthsAvailable(source);
    var years = {};
    months.forEach(function (m) { years[m.slice(0, 4)] = 1; });
    var o = [];
    o.push(['all', 'Todo el histórico']);
    o.push(['thisMonth', 'Este mes']);
    o.push(['lastMonth', 'Mes anterior']);
    o.push(['last3', 'Últimos 3 meses']);
    o.push(['last6', 'Últimos 6 meses']);
    o.push(['last12', 'Últimos 12 meses']);
    var html = '<label class="field">Periodo<select data-f="preset">';
    o.forEach(function (x) { html += '<option value="' + x[0] + '"' + (f.preset === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; });
    var ys = Object.keys(years).sort().reverse();
    if (ys.length) {
      html += '<optgroup label="Años">';
      ys.forEach(function (y) { html += '<option value="' + y + '"' + (f.preset === y ? ' selected' : '') + '>Año ' + y + '</option>'; });
      html += '</optgroup>';
    }
    if (months.length) {
      html += '<optgroup label="Meses con datos">';
      months.slice().reverse().forEach(function (m) {
        html += '<option value="' + m + '"' + (f.preset === m ? ' selected' : '') + '>' + esc(S.monthLabelLong(m)) + '</option>';
      });
      html += '</optgroup>';
    }
    html += '<option value="custom"' + (f.preset === 'custom' ? ' selected' : '') + '>Personalizado…</option>';
    html += '</select></label>';
    if (f.preset === 'custom') {
      html += '<label class="field">Desde<input type="date" data-f="from" value="' + esc(f.from) + '"></label>';
      html += '<label class="field">Hasta<input type="date" data-f="to" value="' + esc(f.to) + '"></label>';
    }
    return html;
  }

  function categoryOptions(selected, includeAll) {
    var html = includeAll ? '<option value="">Todas las categorías</option>' : '';
    // categoría huérfana (renombrada o importada de una copia antigua)
    if (selected && !S.getCategory(selected)) {
      html += '<option value="' + esc(selected) + '" selected>' + esc(selected) + ' (no existe)</option>';
    } else if (selected == null && !includeAll) {
      html += '<option value="" selected>— sin categoría —</option>';
    }
    var groups = { gasto: [], ingreso: [], traspaso: [] };
    S.state.categories.forEach(function (c) { (groups[c.type] || groups.gasto).push(c); });
    [['gasto', 'Gastos'], ['ingreso', 'Ingresos'], ['traspaso', 'Traspasos']].forEach(function (g) {
      if (!groups[g[0]].length) return;
      html += '<optgroup label="' + g[1] + '">';
      groups[g[0]].forEach(function (c) {
        html += '<option value="' + esc(c.name) + '"' + (selected === c.name ? ' selected' : '') + '>' + esc(c.name) + '</option>';
      });
      html += '</optgroup>';
    });
    return html;
  }

  function sourceBadge(src) {
    var a = S.state.accounts[src] || { label: src, color: '--muted' };
    return '<span class="tag"><span class="srcdot" style="background:var(' + a.color + ')"></span>' + esc(a.label) + '</span>';
  }

  /* ---------------- enrutado ---------------- */
  var ROUTES = {
    dashboard: function () {
      if (vistaSimple()) return S.space === 'personal' ? simplePersonal() : simpleCasa();
      return S.space === 'personal' ? pageDashboardPersonal() : pageDashboard();
    },
    movimientos: function () { return pageMovements('movimientos', null); },
    carrefour: function () { return pageMovements('carrefour', 'carrefour'); },
    cuentas: pageAccounts,
    recurrentes: pageRecurring,
    global: function () { return vistaSimple() ? simpleGlobal() : pageGlobal(); },
    presupuesto: pageBudget,
    categorias: pageCategories,
    importar: pageImport,
    ajustes: pageSettings
  };

  /* Menú de cada espacio: Casa tiene la tarjeta Carrefour; Personal, las cuentas e inversiones. */
  var NAV = {
    casa: [
      ['dashboard', '◧', 'Dashboard'], ['global', '◎', 'Vista global'], ['movimientos', '≡', 'Movimientos'],
      ['carrefour', '▣', 'Tarjeta Carrefour'], ['recurrentes', '↻', 'Suscripciones y recibos'],
      ['presupuesto', '◑', 'Presupuesto'], ['categorias', '⌸', 'Categorías y reglas'], ['importar', '⇪', 'Importar'], ['ajustes', '⚙', 'Ajustes']
    ],
    personal: [
      ['dashboard', '◧', 'Dashboard'], ['global', '◎', 'Vista global'], ['movimientos', '≡', 'Movimientos'],
      ['cuentas', '◈', 'Cuentas e inversiones'], ['recurrentes', '↻', 'Suscripciones y recibos'],
      ['presupuesto', '◑', 'Presupuesto'], ['categorias', '⌸', 'Categorías y reglas'], ['importar', '⇪', 'Importar'], ['ajustes', '⚙', 'Ajustes']
    ]
  };

  function renderNav() {
    document.getElementById('espacio').innerHTML = Object.keys(S.SPACES).map(function (k) {
      return '<button type="button" data-space="' + k + '" class="' + (S.space === k ? 'on' : '') + '" aria-pressed="' + (S.space === k) + '">' +
        S.SPACES[k].icon + ' ' + esc(S.SPACES[k].label) + '</button>';
    }).join('');
    document.getElementById('nav').innerHTML = NAV[S.space].map(function (n) {
      return '<a href="#/' + n[0] + '" data-nav="' + n[0] + '"' + (currentRoute === n[0] ? ' class="active"' : '') + '>' +
        '<span class="ico">' + n[1] + '</span>' + esc(n[2]) +
        (n[0] === 'importar' ? '<span class="nav-badge" id="navBadge" hidden></span>' : '') + '</a>';
    }).join('');
    document.title = 'Mis cuentas · ' + S.SPACES[S.space].label;
    renderTabbar();
    updateNavBadge();
  }

  /* ---------- Móvil: barra de pestañas de abajo ---------- */
  var TABS = {
    casa: [['dashboard', '◧', 'Inicio'], ['movimientos', '≡', 'Movimientos'], ['carrefour', '▣', 'Tarjeta'], ['global', '◎', 'Global']],
    personal: [['dashboard', '◧', 'Inicio'], ['movimientos', '≡', 'Movimientos'], ['cuentas', '◈', 'Cuentas'], ['global', '◎', 'Global']]
  };
  function renderTabbar() {
    var tb = document.getElementById('tabbar');
    if (!tb) return;
    tb.innerHTML = TABS[S.space].map(function (t) {
      return '<a href="#/' + t[0] + '" data-tab="' + t[0] + '"' + (currentRoute === t[0] ? ' class="on" aria-current="page"' : '') + '>' +
        '<span class="ico">' + t[1] + '</span>' + t[2] + '</a>';
    }).join('') +
      '<button type="button" data-tab-menu aria-label="Más opciones"><span class="ico">☰</span>Más<span class="dot-badge" id="tabBadge" hidden></span></button>';
  }
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    var b = document.getElementById('menuBtn');
    if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) window.scrollTo(0, 0);
  }
  document.getElementById('nav').addEventListener('click', function (e) {
    if (e.target.closest('a')) setMenu(false);
  });
  document.getElementById('menuBtn').addEventListener('click', function () {
    setMenu(!document.body.classList.contains('menu-open'));
  });
  document.getElementById('tabbar').addEventListener('click', function (e) {
    if (e.target.closest('[data-tab-menu]')) setMenu(!document.body.classList.contains('menu-open'));
  });

  /* ---------- Recordatorio de importar ---------- */
  function remindersDue() {
    return S.importReminders().filter(function (r) { return r.due && !r.muted; });
  }
  /** El número junto a "Importar": cuántas cuentas piden ponerse al día. */
  function updateNavBadge() {
    var b = document.getElementById('navBadge');
    if (!b) return;
    var n = remindersDue().length;
    b.hidden = !n;
    b.textContent = n || '';
    b.title = n ? n + ' cuenta' + (n > 1 ? 's' : '') + ' sin poner al día' : '';
    var tb = document.getElementById('tabBadge');
    if (tb) tb.hidden = !n;
  }
  function hace(dias) {
    if (dias == null) return '';
    return dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : 'hace ' + dias + ' días';
  }
  function reminderText(r) {
    var h = r.days == null ? '' : ' (' + hace(r.days) + ')';
    if (r.kind === 'valor') return r.last ? 'última valoración el ' + S.fmtDate(r.last) + h : 'aún sin valorar';
    if (r.kind === 'apuntes') {
      if (r.pending > 0) return 'sacaste ' + S.eur(r.pending) + ' del cajero' + (r.last ? ' después de tu último apunte (' + S.fmtDate(r.last) + ')' : '') + ' y no has apuntado en qué';
      return r.last ? 'último apunte el ' + S.fmtDate(r.last) + h : 'sin apuntes';
    }
    return r.last ? 'datos hasta el ' + S.fmtDate(r.last) + h : 'aún no has importado ningún extracto';
  }
  function reminderAction(r) {
    if (r.kind === 'valor') return '<a class="btn sm" href="#/cuentas">Valorar</a>';
    if (r.kind === 'apuntes') {
      return '<button class="btn sm" data-act="manual-new" data-acc="' + r.acc + '">Apuntar</button>' +
        '<a class="btn sm ghost" href="#/importar" data-act="import-for" data-acc="' + r.acc + '">Importar Excel</a>';
    }
    return '<a class="btn sm" href="#/importar" data-act="import-for" data-acc="' + r.acc + '">Importar</a>';
  }
  function isoPlusDays(iso, n) {
    var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /** Aviso del dashboard: qué cuentas llevan tiempo sin datos. */
  function reminderBanner() {
    var snooze = S.state.settings.remindSnooze;
    if (snooze && snooze >= S.todayISO()) return '';
    var due = remindersDue();
    if (!due.length) return '';
    return '<div class="notice warn remind"><div class="remind-head"><b>📥 Toca poner al día ' +
      (due.length === 1 ? 'una cuenta' : due.length + ' cuentas') + '</b>' +
      '<button class="btn sm ghost" data-act="remind-snooze" title="No mostrar este aviso en 7 días">Más tarde</button></div>' +
      '<ul class="remind-list">' + due.map(function (r) {
        return '<li><span><span class="srcdot" style="background:var(' + S.state.accounts[r.acc].color + ')"></span><b>' + esc(r.label) + '</b>: ' +
          esc(reminderText(r)) + '</span><span class="row">' + reminderAction(r) + '</span></li>';
      }).join('') + '</ul></div>';
  }
  /** En Importar: hasta dónde llega cada cuenta. */
  function accountsStatus() {
    var rs = S.importReminders();
    if (!rs.length) return '';
    var dias = S.state.settings.remindDays || 35;
    return '<div class="card"><div class="card-head"><h2>¿Cómo van tus cuentas?</h2>' +
      '<span class="hint">aviso a partir de ' + dias + ' días sin datos · <a href="#/ajustes">cambiar</a></span></div>' +
      '<div class="table-wrap"><table class="status-tbl"><tbody>' + rs.map(function (r) {
        var chip = r.muted ? '<span class="chip">sin avisos</span>'
          : r.due ? '<span class="chip chip-warn">toca</span>' : '<span class="chip chip-good">al día</span>';
        return '<tr><td><span class="srcdot" style="background:var(' + S.state.accounts[r.acc].color + ')"></span>' + esc(r.label) + '</td>' +
          '<td>' + esc(reminderText(r)) + '</td><td class="num">' + chip + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function routeAllowed(r) {
    return NAV[S.space].some(function (n) { return n[0] === r; });
  }

  function router() {
    var hash = (location.hash || '#/dashboard').replace('#/', '').split('?')[0];
    if (!ROUTES[hash] || !routeAllowed(hash)) hash = 'dashboard';
    currentRoute = hash;
    document.querySelectorAll('.nav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-nav') === hash);
    });
    document.querySelectorAll('#tabbar [data-tab]').forEach(function (a) {
      var on = a.getAttribute('data-tab') === hash;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    setMenu(false);
    Charts.hideTip();
    render();
  }

  function switchSpace(sp) {
    if (sp === S.space) return;
    S.setSpace(sp);
    F = makeFilters();
    wiz = null;
    if (!routeAllowed(currentRoute)) currentRoute = 'dashboard';
    renderNav();
    if (location.hash.replace('#/', '') !== currentRoute) location.hash = '#/' + currentRoute;
    else render();
    toast('Estás en ' + S.SPACES[sp].label + '.');
  }

  document.getElementById('espacio').addEventListener('click', function (e) {
    var b = e.target.closest('[data-space]');
    if (b) switchSpace(b.getAttribute('data-space'));
  });

  function render() {
    view.scrollTop = 0;
    ROUTES[currentRoute]();
    pintadaSimple = !!view.querySelector('.simple');
    updateStorageNote();
    updateNavBadge();
  }

  /* ============================================================
     PÁGINA: DASHBOARD
     ============================================================ */
  function pageDashboard() {
    var f = F.dashboard;
    var per = resolvePeriod(f);
    var list = S.filterMovements({ from: per.from, to: per.to, source: f.source || undefined });
    var t = S.totals(list);

    // comparación con el periodo anterior del mismo tamaño
    var prev = null;
    if (per.from && per.to) {
      var days = (new Date(per.to) - new Date(per.from)) / 86400000 + 1;
      var pTo = new Date(new Date(per.from) - 86400000), pFrom = new Date(pTo - (days - 1) * 86400000);
      var iso = function (d) { return d.toISOString().slice(0, 10); };
      prev = S.totals(S.filterMovements({ from: iso(pFrom), to: iso(pTo), source: f.source || undefined }));
    }

    var cats = S.byCategory(list, 'gasto');
    var months = S.byMonth(list);
    var merchants = S.byMerchant(list, 8);
    var hasData = S.state.movements.length > 0;

    var html = '';
    html += '<div class="page-head"><div><h1>Dashboard</h1>' +
      '<div class="sub">' + periodText(per) + (f.source ? ' · ' + esc((S.state.accounts[f.source] || {}).label) : ' · todas las cuentas') + '</div></div>' +
      simpleToggle() + '</div>';

    if (!hasData) {
      html += '<div class="card"><div class="empty">' +
        '<div style="font-size:34px;margin-bottom:8px">🏦</div>' +
        '<h2 style="margin-bottom:6px">Todavía no hay movimientos</h2>' +
        '<p style="max-width:460px;margin:0 auto 14px">Descarga el extracto de ING (o de la tarjeta Carrefour) en CSV o Excel y súbelo. También puedes copiar las celdas desde Excel y pegarlas.</p>' +
        '<a class="btn primary" href="#/importar">Importar movimientos</a></div></div>';
      view.innerHTML = html;
      return;
    }

    html += installBanner() + reminderBanner();
    html += '<div class="toolbar">' + periodSelect(f, f.source) +
      '<label class="field">Cuenta<select data-f="source">' +
      '<option value="">Todas</option>' +
      Object.keys(S.state.accounts).map(function (k) {
        return '<option value="' + k + '"' + (f.source === k ? ' selected' : '') + '>' + esc(S.state.accounts[k].label) + '</option>';
      }).join('') + '</select></label></div>';

    html += '<div class="grid g4">' +
      statTile('Ingresos', S.eur(t.income), prev ? deltaText(t.income, prev.income, true) : t.count + ' movimientos', 'var(--s3)') +
      statTile('Gastos', S.eur(t.expense), prev ? deltaText(t.expense, prev.expense, false) : '', 'var(--s2)') +
      statTile('Balance', S.eur(t.net), t.net >= 0 ? 'has ahorrado' : 'has gastado de más', t.net >= 0 ? 'var(--good-text)' : 'var(--critical)') +
      statTile('Tasa de ahorro', t.income > 0 ? S.pct(t.rate) : '—', 'sobre los ingresos', 'var(--s1)') +
      '</div>';

    html += '<div class="grid g2" style="margin-top:14px">' + fixedCard(list) + cushionCard() + '</div>';

    html += '<div class="grid g2" style="margin-top:14px">' +
      '<div class="card"><div class="card-head"><h2>Ingresos y gastos por mes</h2><span class="hint">traspasos excluidos</span></div><div id="chMonths"></div></div>' +
      '<div class="card"><div class="card-head"><h2>Reparto del gasto</h2><span class="hint">top 7 + resto</span></div><div id="chDonut"></div></div>' +
      '</div>';

    html += '<div class="grid g2" style="margin-top:14px">' +
      '<div class="card"><div class="card-head"><h2>Gasto por categoría</h2><span class="hint">' + cats.length + ' categorías</span></div>' +
      categoryBarList(cats, t.expense) + '</div>' +
      '<div class="card"><div class="card-head"><h2>Dónde más gastas</h2><span class="hint">por comercio</span></div>' +
      merchantList(merchants) + '</div>' +
      '</div>';

    // evolución de saldo si hay columna saldo
    var withBalance = list.filter(function (m) { return m.balance != null && m.source === 'ing'; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    if (withBalance.length > 2) {
      html += '<div class="card" style="margin-top:14px"><div class="card-head"><h2>Evolución del saldo en ING</h2>' +
        '<span class="hint">último saldo de cada día</span></div><div id="chBalance"></div></div>';
    }

    html += '<div class="card" style="margin-top:14px"><div class="card-head"><h2>Últimos movimientos</h2>' +
      '<a class="btn sm ghost" href="#/movimientos">Ver todos →</a></div>' +
      miniTable(list.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 12)) + '</div>';

    view.innerHTML = html;

    Charts.groupedBars(document.getElementById('chMonths'), months.map(function (m) {
      return { label: S.monthLabel(m.key), income: m.income, expense: m.expense };
    }));

    var top = cats.slice(0, 7);
    var rest = cats.slice(7).reduce(function (a, b) { return a + b.value; }, 0);
    // el color sigue a la categoría (el mismo en todos los gráficos), no a su posición;
    // si dos categorías comparten color, la segunda coge el siguiente libre de la paleta
    var usedColors = {};
    var donutItems = top.map(function (c) {
      var cat = S.getCategory(c.name);
      var slot = cat ? cat.color : null;
      if (!slot || usedColors[slot]) {
        for (var i = 0; i < S.SERIES.length; i++) {
          if (!usedColors[S.SERIES[i]]) { slot = S.SERIES[i]; break; }
        }
      }
      usedColors[slot] = true;
      return { name: c.name, value: c.value, color: 'var(' + slot + ')' };
    });
    if (rest > 0) donutItems.push({ name: 'Resto', value: rest, color: 'var(--muted)' });
    Charts.donut(document.getElementById('chDonut'), donutItems, { centerLabel: 'de gasto' });

    if (withBalance.length > 2) {
      // saldo al cierre de cada día (con varios movimientos el mismo día, el último de verdad)
      var pts = S.dailyBalances(withBalance).map(function (d) {
        return { x: S.fmtDate(d.date).slice(0, 5), label: S.fmtDate(d.date), y: d.balance };
      });
      Charts.line(document.getElementById('chBalance'), pts, { valueLabel: 'Saldo' });
    }
  }

  /* ============================================================
     PÁGINA: DASHBOARD PERSONAL
     Dos capas: lo que entra y sale (ING, Revolut, efectivo) y lo que
     tienes (patrimonio: cuentas + inversiones).
     ============================================================ */
  function pageDashboardPersonal() {
    var f = F.dashboard;
    // el último mes con ingresos o gastos (un dividendo en Degiro no cuenta como "mes con datos")
    var meses = S.flowMonths();
    // por defecto sigue al último mes con movimientos, hasta que elijas tú otro periodo
    if (f.preset == null || f.autoPreset) {
      f.preset = meses.length ? meses[meses.length - 1] : 'thisMonth';
      f.autoPreset = true;
    }
    var per = resolvePeriod(f);
    var hay = S.state.movements.length > 0 || (S.state.valuations || []).length > 0;

    var html = '<div class="page-head"><div><h1>Dashboard personal</h1>' +
      '<div class="sub">' + periodText(per) + ' · ' + Object.keys(S.state.accounts).map(S.accountLabel).join(', ') + '</div></div>' +
      '<div class="row">' + simpleToggle() + '<button class="btn sm" data-act="manual-new">＋ Apuntar a mano</button></div></div>';

    if (!hay) {
      html += '<div class="card"><div class="empty">' +
        '<div style="font-size:34px;margin-bottom:8px">👤</div>' +
        '<h2 style="margin-bottom:6px">Tu espacio personal está vacío</h2>' +
        '<p style="max-width:520px;margin:0 auto 14px">Importa el extracto de tu ING personal o de Revolut. El efectivo se apunta a mano, y Degiro y cripto se valoran desde <b>Cuentas e inversiones</b>.</p>' +
        '<div class="row" style="justify-content:center"><a class="btn primary" href="#/importar">Importar extracto</a>' +
        '<a class="btn" href="#/cuentas">Cuentas e inversiones</a></div></div></div>';
      view.innerHTML = html;
      return;
    }

    var list = S.filterMovements({ from: per.from, to: per.to });
    var t = S.totals(list);
    var hoy = S.todayISO();
    var patHoy = S.netWorth();
    // patrimonio a final del mes anterior, para comparar
    var finMesAnt = S.monthBounds(S.addMonths(hoy.slice(0, 7), -1)).to;
    var patAnt = S.netWorth(finMesAnt);
    var dPat = patHoy - patAnt;

    html += installBanner() + reminderBanner();
    html += '<div class="toolbar">' + periodSelect(f) + '</div>';

    html += '<div class="grid g4">' +
      statTile('Patrimonio neto · hoy', S.eur0(patHoy),
        !patAnt ? 'cuentas + inversiones'
          : Math.abs(dPat) < 0.5 ? 'sin cambios desde el ' + S.fmtDate(finMesAnt)
          : '<span class="' + (dPat >= 0 ? 'pos' : 'neg') + '">' + (dPat >= 0 ? '▲ +' : '▼ −') + S.eur0(Math.abs(dPat)) + '</span> desde el ' + S.fmtDate(finMesAnt),
        'var(--s7)') +
      statTile('Ingresos', S.eur(t.income), 'en el periodo', 'var(--s3)') +
      statTile('Gastos', S.eur(t.expense), 'sin traspasos entre tus cuentas', 'var(--s2)') +
      statTile('Ahorrado', S.eur(t.net),
        (t.income > 0 ? S.pct(t.rate) + (t.invested > 0 ? '' : ' de lo ingresado') : '—') + (t.invested > 0 ? ' · ' + S.eur0(t.invested) + ' invertidos' : ''),
        t.net >= 0 ? 'var(--good-text)' : 'var(--critical)') +
      '</div>';

    html += '<div class="grid g2" style="margin-top:14px">' +
      '<div class="card"><div class="card-head"><h2>Patrimonio neto</h2><span class="hint">cierre de cada mes · liquidez + inversiones</span></div><div id="chPat"></div></div>' +
      '<div class="card"><div class="card-head"><h2>Dónde está tu dinero</h2><span class="hint">hoy</span></div>' + accountsBarList() + '</div>' +
      '</div>';

    html += '<div class="grid g2" style="margin-top:14px">' + fixedCard(list) + cushionCard() + '</div>';

    var cats = S.byCategory(list, 'gasto');
    html += '<div class="grid g2" style="margin-top:14px">' +
      '<div class="card"><div class="card-head"><h2>Ingresos y gastos por mes</h2><span class="hint">ING + Revolut + efectivo</span></div><div id="chMes"></div></div>' +
      '<div class="card"><div class="card-head"><h2>Gasto por categoría</h2><span class="hint">' + esc(periodText(per)) + '</span></div>' + categoryBarList(cats, t.expense) + '</div>' +
      '</div>';

    html += '<div class="grid g2" style="margin-top:14px">' +
      '<div class="card"><div class="card-head"><h2>Inversiones</h2><span class="hint">lo que has puesto vs. lo que vale hoy</span></div>' + investmentsTable() + '</div>' +
      '<div class="card"><div class="card-head"><h2>Traspasos entre tus cuentas</h2><span class="hint">no cuentan como gasto</span></div>' + transfersList(list) + '</div>' +
      '</div>';

    view.innerHTML = html;

    var serie = S.netWorthSeries(12);
    Charts.line(document.getElementById('chPat'), serie.map(function (p) {
      return { x: S.MESES_C[+p.key.slice(5, 7) - 1], label: S.monthLabelLong(p.key), y: p.value };
    }), { valueLabel: 'Patrimonio', color: 'var(--s7)', height: 250 });

    // el gráfico mensual va siempre con los últimos 12 meses, no solo el periodo
    var desde = S.monthBounds(S.addMonths(hoy.slice(0, 7), -11)).from;
    Charts.groupedBars(document.getElementById('chMes'), S.byMonth(S.filterMovements({ from: desde })).map(function (m) {
      return { label: S.monthLabel(m.key), income: m.income, expense: m.expense };
    }), { height: 250 });
  }

  /* ---------- Gasto fijo y variable ---------- */
  function fixedCard(list) {
    var fv = S.fixedVariable(list);
    var total = fv.fixed + fv.variable;
    var html = '<div class="card"><div class="card-head"><h2>Gasto fijo y variable</h2>' +
      '<a class="hint" href="#/categorias" title="En Categorías marcas cuáles son fijas">qué cuenta como fijo →</a></div>';
    if (!total) return html + '<div class="empty">Sin gastos en el periodo</div></div>';
    var pf = fv.fixed / total;
    html += '<div class="fv-nums">' +
      '<div><span class="label"><i class="sw" style="background:var(--s1)"></i>Fijo</span><b>' + S.eur(fv.fixed) + '</b><span class="kv">' + S.pct(pf) + ' del gasto</span></div>' +
      '<div><span class="label"><i class="sw" style="background:var(--s2)"></i>Variable</span><b>' + S.eur(fv.variable) + '</b><span class="kv">' + S.pct(1 - pf) + ' del gasto</span></div>' +
      '</div>' +
      '<div class="fv-bar" role="img" aria-label="Fijo ' + S.pct(pf) + ', variable ' + S.pct(1 - pf) + '">' +
      (fv.fixed ? '<span style="width:' + (pf * 100).toFixed(1) + '%;background:var(--s1)"></span>' : '') +
      (fv.variable ? '<span style="width:' + ((1 - pf) * 100).toFixed(1) + '%;background:var(--s2)"></span>' : '') + '</div>';
    if (fv.byCat.length) {
      html += '<div class="fv-list">' + fv.byCat.slice(0, 6).map(function (c) {
        return '<div><span><span class="srcdot" style="background:' + S.categoryColor(c.name) + '"></span>' + esc(c.name) + '</span><span class="num">' + S.eur(c.value) + '</span></div>';
      }).join('') + '</div>';
    } else {
      html += '<div class="kv" style="margin:10px 0">Ninguna categoría fija tiene gastos en este periodo.</div>';
    }
    var avgF = S.monthlyAverage(3, true);
    var subs = S.detectRecurring().filter(function (r) { return r.active && !r.ignored && r.fixedAmount; });
    var subsMes = subs.reduce(function (s, r) { return s + r.perMonth; }, 0);
    html += '<hr class="sep">' +
      (avgF.months.length ? '<div class="kv">Gasto fijo medio: <b>' + S.eur(avgF.value) + ' al mes</b> (' + mesesTexto(avgF.months) + ')</div>' : '') +
      '<div class="kv">Cuotas fijas detectadas (suscripciones, recibos que no cambian): ' + (subs.length
        ? '<b>' + S.eur(subsMes) + ' al mes</b> · ' + S.eur0(subsMes * 12) + ' al año · <a href="#/recurrentes">ver las ' + subs.length + '</a>'
        : 'ninguna todavía (hacen falta 2 meses de movimientos)') + '</div>';
    return html + '</div>';
  }

  function mesesTexto(keys) {
    if (!keys.length) return '';
    if (keys.length === 1) return S.monthLabelLong(keys[0]);
    return 'media de ' + S.monthLabel(keys[0]).toLowerCase() + ' a ' + S.monthLabel(keys[keys.length - 1]).toLowerCase();
  }

  function mesesNum(x) {
    if (x == null) return '—';
    if (x >= 99) return 'más de 99 meses';
    return x.toFixed(1).replace('.', ',') + (Math.abs(x - 1) < 0.05 ? ' mes' : ' meses');
  }

  /* ---------- Colchón de seguridad ---------- */
  function cushionCard() {
    var c = S.cushion();
    var liq = S.balanceAccounts().filter(function (k) { return S.state.accounts[k].kind !== 'inversion'; }).map(S.accountLabel);
    var html = '<div class="card"><div class="card-head"><h2>Colchón de seguridad</h2>' +
      '<span class="hint">cuántos meses aguantas con lo que tienes</span></div>';
    if (!c.avg) {
      return html + '<div class="empty">Hace falta al menos un mes completo de gastos para calcularlo.</div></div>';
    }
    var ok = c.covered >= c.goal;
    var prog = Math.max(0, Math.min(1, c.covered / c.goal));
    var color = ok ? 'var(--good)' : prog >= 0.5 ? 'var(--s1)' : 'var(--warning)';
    html += '<div class="cushion-hero"><b>' + mesesNum(c.covered) + '</b> <span>de gasto cubiertos</span> ' +
      '<span class="chip ' + (ok ? 'chip-good' : 'chip-warn') + '">' + (ok ? '✓ meta cumplida' : '△ por debajo de la meta') + '</span></div>' +
      '<div class="cushion-bar" role="img" aria-label="' + mesesNum(c.covered) + ' de ' + c.goal + '">' +
      '<span style="width:' + (prog * 100).toFixed(1) + '%;background:' + color + '"></span></div>' +
      '<div class="cushion-scale"><span>0</span><span>meta: ' + c.goal + ' meses</span></div>' +
      '<div class="cushion-grid">' +
      '<div><span class="label">Disponible</span><b>' + S.eur(c.available) + '</b></div>' +
      '<div><span class="label">Gasto medio</span><b>' + S.eur(c.avg) + '/mes</b></div>' +
      '<div><span class="label">Meta</span><b><input type="number" min="1" max="36" step="1" id="cushion-goal" data-cushion-goal value="' + c.goal + '" aria-label="Meses de meta"> meses</b></div>' +
      '</div>' +
      '<div class="kv">' + (ok ? 'Te sobran <b>' + S.eur(-c.gap) + '</b> por encima de la meta.' : 'Te faltan <b>' + S.eur(c.gap) + '</b> para llegar a ' + c.goal + ' meses.') + '</div>' +
      (c.avgFixed ? '<div class="kv">Si solo pagaras lo fijo (' + S.eur(c.avgFixed) + '/mes): <b>' + mesesNum(c.coveredFixed) + '</b>.</div>' : '') +
      '<div class="kv">Disponible = ' + esc(liq.join(' + ')) + '. Gasto medio: ' + mesesTexto(c.months) + '.</div>';
    return html + '</div>';
  }

  function kindTag(kind) {
    return kind === 'inversion' ? '<span class="kind inv">inversión</span>' : '<span class="kind liq">liquidez</span>';
  }

  /** Barra por cuenta con su saldo de hoy y de dónde sale la cifra. */
  function accountsBarList() {
    var filas = Object.keys(S.state.accounts).map(function (k) {
      var a = S.state.accounts[k], b = S.accountBalance(k);
      return { k: k, a: a, b: b };
    }).sort(function (x, y) { return y.b.value - x.b.value; });
    var total = filas.reduce(function (s, r) { return s + Math.max(0, r.b.value); }, 0);
    var max = Math.max.apply(null, filas.map(function (r) { return Math.abs(r.b.value); }).concat([1]));
    return '<div class="barlist">' + filas.map(function (r) {
      var color = 'var(' + r.a.color + ')';
      return '<div class="barrow">' +
        '<span class="name"><span class="srcdot" style="background:' + color + '"></span>' + esc(r.a.label) + kindTag(r.a.kind) + '</span>' +
        '<span class="val' + (r.b.value < 0 ? ' neg' : '') + '">' + S.eur(r.b.value) + '</span>' +
        '<span class="track"><span class="fill" style="width:' + (Math.abs(r.b.value) / max * 100).toFixed(1) + '%;background:' + color + '"></span></span>' +
        '<span class="meta">' + (total > 0 && r.b.value > 0 ? S.pct(r.b.value / total) + ' · ' : '') + esc(r.b.how || '') + '</span></div>';
    }).join('') + '</div>';
  }

  function investmentsTable() {
    var inv = Object.keys(S.state.accounts).filter(function (k) { return S.state.accounts[k].kind === 'inversion'; });
    if (!inv.length) return '<div class="empty">No hay cuentas de inversión</div>';
    var tA = 0, tV = 0;
    var filas = inv.map(function (k) {
      var b = S.accountBalance(k), ap = b.invested || 0, res = b.value - ap;
      tA += ap; tV += b.value;
      return '<tr><td><span class="srcdot" style="background:var(' + S.state.accounts[k].color + ')"></span>' + esc(S.accountLabel(k)) + '</td>' +
        '<td class="num">' + S.eur(ap) + '</td>' +
        '<td class="num"><b>' + S.eur(b.value) + '</b></td>' +
        '<td class="num ' + (b.valued ? (res >= 0 ? 'pos' : 'neg') : '') + '">' + (b.valued ? signed(res) : '—') + '</td>' +
        '<td class="num ' + (b.valued ? (res >= 0 ? 'pos' : 'neg') : '') + '">' + (b.valued && ap > 0 ? signedPct(res / ap) : '—') + '</td>' +
        annualCell(S.annualReturn(k)) + '</tr>';
    }).join('');
    var tR = tV - tA;
    var sinValorar = inv.filter(function (k) { return !S.accountBalance(k).valued; });
    return '<div class="table-wrap"><table><thead><tr><th class="nosort">Cuenta</th><th class="nosort num">Aportado</th>' +
      '<th class="nosort num">Valor hoy</th><th class="nosort num">Resultado</th><th class="nosort num">%</th>' +
      '<th class="nosort num" title="Rentabilidad anual (TIR): tiene en cuenta cuándo metiste cada euro">Al año</th></tr></thead><tbody>' + filas +
      '<tr style="background:var(--surface-2)"><td><b>Total</b></td><td class="num"><b>' + S.eur(tA) + '</b></td><td class="num"><b>' + S.eur(tV) + '</b></td>' +
      '<td class="num ' + (tR >= 0 ? 'pos' : 'neg') + '"><b>' + signed(tR) + '</b></td><td class="num ' + (tR >= 0 ? 'pos' : 'neg') + '"><b>' + (tA > 0 ? signedPct(tR / tA) : '—') + '</b></td>' +
      annualCell(S.annualReturn(inv), true) + '</tr>' +
      '</tbody></table></div>' +
      inv.map(function (k) { return incomeLine(k, true); }).join('') +
      '<div class="row" style="margin-top:10px;justify-content:space-between">' +
      '<span class="kv">' + (sinValorar.length ? esc(sinValorar.map(S.accountLabel).join(' y ')) + ' sin valorar: cuenta lo aportado.' : 'Valoraciones al día de su fecha.') + '</span>' +
      '<a class="btn sm" href="#/cuentas">Actualizar valor →</a></div>';
  }

  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + S.eur(Math.abs(n)); }
  function signedPct(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + S.pct(Math.abs(n)); }

  /* ---------- Rentabilidad anual (TIR) ---------- */
  function mesesDe(dias) {
    var m = Math.max(1, Math.round(dias / 30.44));
    return m + (m === 1 ? ' mes' : ' meses');
  }
  function annualCell(r, bold) {
    if (r.reason) return '<td class="num" title="' + esc(returnWhy(r.reason)) + '">—</td>';
    var cls = r.rate >= 0 ? 'pos' : 'neg';
    if (r.confidence === 'baja') {
      // con pocos meses se enseña lo ganado en el periodo, sin anualizar
      return '<td class="num ' + cls + '" title="En ' + mesesDe(r.days) + ': aún es pronto para hablar de «al año»">' +
        (bold ? '<b>' : '') + signedPct(r.period) + (bold ? '</b>' : '') + '<small class="kv"> en ' + mesesDe(r.days) + '</small></td>';
    }
    return '<td class="num ' + cls + '" title="Rentabilidad anual (TIR) desde ' + S.fmtDate(r.from) + '">' + (bold ? '<b>' : '') + signedPct(r.rate) + (bold ? '</b>' : '') + '</td>';
  }
  function returnWhy(reason) {
    return {
      'sin-valor': 'Hace falta una valoración para saber cuánto vale.',
      'sin-aportaciones': 'Hacen falta tus aportaciones (traspasos desde ING o Revolut) o tus operaciones de compra y venta.',
      'mismo-dia': 'Las aportaciones y la valoración son del mismo día: aún no hay tiempo que medir.',
      'no-calculable': 'Con estos datos no sale un resultado razonable. Revisa lo aportado y la valoración.',
      'no-inversion': '', 'sin-datos': 'Sin datos todavía.'
    }[reason] || '';
  }
  /** Línea de la tarjeta de inversión: rentabilidad anual y de dónde sale. */
  function returnLine(k) {
    var r = S.annualReturn(k);
    if (r.reason) {
      var w = returnWhy(r.reason);
      return w ? '<div class="kv ret-line"><span class="label">Rentabilidad anual</span> — · ' + esc(w) + '</div>' : '';
    }
    var cls = r.rate >= 0 ? 'pos' : 'neg';
    var desde = 'desde ' + S.fmtDate(r.from) + ', teniendo en cuenta cuándo metiste cada euro';
    var cifra = r.confidence === 'baja'
      ? '<b class="' + cls + '">' + signedPct(r.period) + '</b> en ' + mesesDe(r.days) + ' · <span title="Anualizar tan poco tiempo exagera">aún no se anualiza (saldría ' + signedPct(r.rate) + ' al año, engañoso)</span>'
      : '<b class="' + cls + '">' + signedPct(r.rate) + '</b> al año' + (r.confidence === 'media' ? ' · orientativa: menos de un año de datos' : '');
    var notas = [];
    if (r.basis.indexOf('operaciones') !== -1) notas.push('calculada con tus compras y ventas');
    if (r.guessedStart) notas.push('pon desde cuándo tenías lo «aportado antes de empezar» para afinarla');
    return '<div class="kv ret-line"><span class="label">Rentabilidad anual</span> ' + cifra + '<br>' + desde +
      (notas.length ? ' · ' + esc(notas.join(' · ')) : '') + '.</div>';
  }

  /** Traspasos del periodo, uno por pareja, con su estado. */
  function transfersList(list) {
    var vistos = {}, filas = [];
    list.forEach(function (m) {
      if (vistos[m.id] || m.excluded) return;
      if (!m.counterpart && S.categoryType(m.category) !== 'traspaso') return;
      if (m.auto && m.pairId && S.byId(m.pairId)) return;      // se enseña desde la punta real
      vistos[m.id] = 1;
      if (m.pairId) vistos[m.pairId] = 1;
      var p = m.pairId ? S.byId(m.pairId) : null;
      var de = m.amount < 0 ? m.source : (m.counterpart || '?');
      var a = m.amount < 0 ? (m.counterpart || '?') : m.source;
      var estado;
      if (p && p.auto) estado = '<span class="ok">✓ sumado a ' + esc(S.accountLabel(p.source)) + '</span>';
      else if (p) estado = '<span class="ok">✓ emparejado</span>';
      else if (m.counterpart && S.account(m.counterpart) && S.account(m.counterpart).importable)
        estado = '<span class="warn">falta importar ' + esc(S.accountLabel(m.counterpart)) + '</span>';
      else estado = '<span class="kv">traspaso</span>';
      filas.push({ date: m.date, html: '<span class="de">' + esc(S.accountLabel(de)) + ' → ' + esc(S.accountLabel(a)) +
        '<span class="kv"> · ' + S.fmtDate(m.date) + '</span></span><span class="num">' + S.eur(Math.abs(m.amount)) + '</span>' + estado });
    });
    if (!filas.length) return '<div class="empty">Sin traspasos en el periodo</div>';
    filas.sort(function (x, y) { return x.date < y.date ? 1 : -1; });
    var mas = filas.length > 8 ? '<div class="kv" style="margin-top:8px">y ' + (filas.length - 8) + ' más en Movimientos (filtro «Solo traspasos»)</div>' : '';
    return '<div class="flujo">' + filas.slice(0, 8).map(function (f) { return f.html; }).join('') + '</div>' + mas +
      '<div class="notice" style="margin-top:12px">Cuando el mismo importe sale de una cuenta tuya y entra en otra en 3 días o menos, se marcan como traspaso solos. Los reintegros de ING suman al efectivo, y lo que mandas a Degiro o al exchange cuenta como aportado.</div>';
  }

  function periodText(per) {
    if (!per.from && !per.to) return 'Todo el histórico';
    if (per.from && per.to) return 'Del ' + S.fmtDate(per.from) + ' al ' + S.fmtDate(per.to);
    return per.from ? 'Desde ' + S.fmtDate(per.from) : 'Hasta ' + S.fmtDate(per.to);
  }

  function statTile(label, value, sub, color) {
    return '<div class="card stat">' +
      '<span class="label">' + esc(label) + '</span>' +
      '<span class="value" style="color:' + (color || 'var(--text)') + '">' + value + '</span>' +
      '<span class="delta">' + (sub || '&nbsp;') + '</span></div>';
  }

  function deltaText(now, before, higherIsBetter) {
    if (!before) return 'sin periodo anterior comparable';
    var d = now - before, p = before ? (d / before) * 100 : 0;
    var good = higherIsBetter ? d >= 0 : d <= 0;
    var arrow = d >= 0 ? '▲' : '▼';
    return '<span class="' + (good ? 'pos' : 'neg') + '">' + arrow + ' ' +
      Math.abs(p).toFixed(1).replace('.', ',') + ' %</span> vs. periodo anterior';
  }

  function categoryBarList(cats, total) {
    if (!cats.length) return '<div class="empty">Sin gastos en el periodo</div>';
    var max = cats[0].value;
    var LIMITE = 8;
    var visibles = cats.slice(0, LIMITE);
    var resto = cats.slice(LIMITE);
    var restoTotal = resto.reduce(function (a, c) { return a + c.value; }, 0);
    var html = '<div class="barlist">' + visibles.map(function (c) {
      return '<div class="barrow">' +
        '<span class="name"><span class="srcdot" style="background:' + S.categoryColor(c.name) + '"></span>' + esc(c.name) + '</span>' +
        '<span class="val">' + S.eur(c.value) + '</span>' +
        '<span class="track"><span class="fill" style="width:' + (c.value / max * 100).toFixed(1) + '%;background:' + S.categoryColor(c.name) + '"></span></span>' +
        '<span class="meta">' + (total ? (c.value / total * 100).toFixed(1).replace('.', ',') + ' % del gasto' : '') + '</span>' +
        '</div>';
    }).join('');

    if (resto.length) {
      html += '<div class="barrow">' +
        '<span class="name" style="color:var(--text-2)">Otras ' + resto.length + ' categorías</span>' +
        '<span class="val">' + S.eur(restoTotal) + '</span>' +
        '<span class="track"><span class="fill" style="width:' + (restoTotal / max * 100).toFixed(1) + '%;background:var(--muted)"></span></span>' +
        '<span class="meta">' + esc(resto.slice(0, 5).map(function (c) { return c.name; }).join(', ')) +
        (resto.length > 5 ? '…' : '') + '</span></div>';
    }
    return html + '</div>';
  }

  function merchantList(ms) {
    if (!ms.length) return '<div class="empty">Sin gastos en el periodo</div>';
    var max = ms[0].value;
    return '<div class="barlist">' + ms.map(function (m) {
      return '<div class="barrow">' +
        '<span class="name">' + esc(m.name) + '</span>' +
        '<span class="val">' + S.eur(m.value) + '</span>' +
        '<span class="track"><span class="fill" style="width:' + (m.value / max * 100).toFixed(1) + '%;background:var(--s1)"></span></span>' +
        '<span class="meta">' + m.count + ' movimiento' + (m.count > 1 ? 's' : '') + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  function miniTable(list) {
    if (!list.length) return '<div class="empty">Sin movimientos</div>';
    return '<div class="table-wrap"><table><thead><tr>' +
      '<th class="nosort">Fecha</th><th class="nosort">Concepto</th><th class="nosort">Categoría</th><th class="nosort num">Importe</th>' +
      '</tr></thead><tbody>' + list.map(function (m) {
        return '<tr><td class="date">' + S.fmtDate(m.date) + '</td>' +
          '<td class="concept">' + sourceBadge(m.source) + ' ' + esc(m.concept) + '</td>' +
          '<td><span class="chip"><span class="dot" style="background:' + S.categoryColor(m.category) + '"></span>' + esc(m.category || '—') + '</span></td>' +
          '<td class="num ' + (m.amount < 0 ? 'neg' : 'pos') + '">' + S.eur(m.amount) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ============================================================
     PÁGINA: MOVIMIENTOS (y Carrefour, que es la misma con filtro)
     ============================================================ */
  function pageMovements(key, forcedSource) {
    var f = F[key];
    if (forcedSource) f.source = forcedSource;
    var per = resolvePeriod(f);
    var list = S.filterMovements({
      from: per.from, to: per.to, q: f.q,
      category: f.category || undefined,
      type: f.type || undefined,
      source: f.source || undefined
    });

    list.sort(function (a, b) {
      var r = 0;
      if (f.sort === 'amount') r = a.amount - b.amount;
      else if (f.sort === 'concept') r = a.concept.localeCompare(b.concept, 'es');
      else if (f.sort === 'category') r = String(a.category).localeCompare(String(b.category), 'es');
      else r = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      return f.dir === 'asc' ? r : -r;
    });

    var t = S.totals(list);
    var pageSize = S.state.settings.pageSize || 50;
    var pages = Math.max(1, Math.ceil(list.length / pageSize));
    if (f.page > pages) f.page = pages;
    var slice = list.slice((f.page - 1) * pageSize, f.page * pageSize);

    var title = forcedSource ? esc(S.state.accounts[forcedSource].label) : 'Movimientos';
    var html = '<div class="page-head"><div><h1>' + title + '</h1>' +
      '<div class="sub">' + list.length + ' movimientos · ' + periodText(per) + '</div></div>' +
      '<div class="row"><button class="btn sm" data-act="manual-new">＋ Apuntar a mano</button>' +
      '<button class="btn sm" data-act="export-csv">⤓ Exportar CSV</button></div></div>';

    if (forcedSource === 'carrefour' && !S.state.movements.some(function (m) { return m.source === 'carrefour'; })) {
      html += '<div class="card"><div class="empty">' +
        '<h2 style="margin-bottom:6px">Aún no hay movimientos de la tarjeta</h2>' +
        '<p style="max-width:480px;margin:0 auto 14px">Cuando tengas el extracto de la tarjeta Carrefour, impórtalo eligiendo <b>Tarjeta Carrefour</b> como origen. Se clasifica con las mismas reglas y se puede ver por separado o junto al banco.</p>' +
        '<a class="btn primary" href="#/importar">Importar extracto de la tarjeta</a></div></div>';
      view.innerHTML = html;
      return;
    }

    html += '<div class="grid g4" style="margin-bottom:14px">' +
      statTile('Gastos', S.eur(t.expense), t.count + ' movimientos', 'var(--s2)') +
      statTile('Ingresos', S.eur(t.income), '', 'var(--s3)') +
      statTile('Balance', S.eur(t.net), '', t.net >= 0 ? 'var(--good-text)' : 'var(--critical)') +
      statTile('Gasto medio', S.eur(t.expense / Math.max(1, list.filter(function (m) {
        return m.amount < 0 && !m.excluded && S.categoryType(m.category) !== 'traspaso';
      }).length)), 'por movimiento de gasto', 'var(--s1)') +
      '</div>';

    html += '<div class="card"><div class="toolbar">' +
      periodSelect(f, f.source) +
      '<label class="field">Buscar<input type="search" data-f="q" value="' + esc(f.q) + '" placeholder="concepto, nota…"></label>' +
      '<label class="field">Categoría<select data-f="category">' + categoryOptions(f.category, true) + '</select></label>' +
      '<label class="field">Tipo<select data-f="type">' +
      ['', 'gasto', 'ingreso', 'traspaso'].map(function (v) {
        var lab = { '': 'Todo', gasto: 'Solo gastos', ingreso: 'Solo ingresos', traspaso: 'Solo traspasos' }[v];
        return '<option value="' + v + '"' + (f.type === v ? ' selected' : '') + '>' + lab + '</option>';
      }).join('') + '</select></label>' +
      (forcedSource ? '' : '<label class="field">Cuenta<select data-f="source"><option value="">Todas</option>' +
        Object.keys(S.state.accounts).map(function (k) {
          return '<option value="' + k + '"' + (f.source === k ? ' selected' : '') + '>' + esc(S.state.accounts[k].label) + '</option>';
        }).join('') + '</select></label>') +
      '<div class="spacer"></div>' +
      '<button class="btn sm ghost" data-act="clear-filters">Limpiar filtros</button>' +
      '</div>';

    html += '<div id="bulkBar" class="row" style="display:none;gap:8px;padding:8px 0 12px">' +
      '<span class="chip" id="bulkCount"></span>' +
      '<select id="bulkCat"><option value="">Asignar categoría…</option>' + categoryOptions('', false) + '</select>' +
      '<button class="btn sm" data-act="bulk-apply">Aplicar</button>' +
      '<button class="btn sm" data-act="bulk-exclude">Excluir del cálculo</button>' +
      '<button class="btn sm" data-act="bulk-include">Volver a incluir</button>' +
      '<button class="btn sm danger" data-act="bulk-delete">Eliminar</button>' +
      '</div>';

    if (!slice.length) {
      html += '<div class="empty">No hay movimientos con estos filtros</div></div>';
      view.innerHTML = html;
      return;
    }

    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th class="nosort" style="width:28px"><input type="checkbox" data-act="sel-all"></th>' +
      th('Fecha', 'date', f) + th('Concepto', 'concept', f) +
      '<th class="nosort">Categoría</th>' + th('Importe', 'amount', f, true) +
      '<th class="nosort num">Saldo</th><th class="nosort" style="width:70px"></th>' +
      '</tr></thead><tbody>' +
      slice.map(function (m) {
        return '<tr data-id="' + m.id + '" class="' + (m.excluded ? 'excluded' : '') + '">' +
          '<td><input type="checkbox" data-sel="' + m.id + '"></td>' +
          '<td class="date">' + S.fmtDate(m.date) + '</td>' +
          '<td class="concept">' + (f.source ? '' : sourceBadge(m.source) + ' ') + esc(m.concept) +
          (m.extra ? ' <span class="tag">' + esc(m.extra) + '</span>' : '') +
          transferTag(m) +
          (m.handEntered ? ' <span class="tag" title="Apuntado a mano">✍ a mano</span>' : '') +
          (m.note ? '<div class="kv">📝 ' + esc(m.note) + '</div>' : '') + '</td>' +
          '<td><select data-cat="' + m.id + '" style="max-width:190px">' + categoryOptions(m.category, false) + '</select>' +
          (m.manual ? ' <span class="tag" title="Categoría puesta a mano">✎</span>' : '') + '</td>' +
          '<td class="num ' + (m.amount < 0 ? 'neg' : 'pos') + '"><b>' + S.eur(m.amount) + '</b></td>' +
          '<td class="num">' + (m.balance != null ? S.eur(m.balance) : '—') + '</td>' +
          '<td class="num"><button class="btn sm ghost" data-act="row-menu" data-id="' + m.id + '" title="Más acciones">⋯</button></td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>';

    html += '<div class="pager">' +
      '<button class="btn sm" data-act="page-prev"' + (f.page <= 1 ? ' disabled' : '') + '>‹</button>' +
      '<span>Página ' + f.page + ' de ' + pages + '</span>' +
      '<button class="btn sm" data-act="page-next"' + (f.page >= pages ? ' disabled' : '') + '>›</button>' +
      '</div></div>';

    view.innerHTML = html;
  }

  /** Etiqueta de traspaso: con quién está emparejado o qué le falta. */
  function transferTag(m) {
    if (!m.counterpart && !m.pairId) return '';
    var otra = S.accountLabel(m.counterpart);
    var flecha = m.amount < 0 ? '→ ' : '← ';
    if (m.auto) return ' <span class="tag" title="Creado solo a partir de la otra cuenta">⚙ automático</span>';
    if (m.pairId) return ' <span class="tag tag-ok" title="Traspaso emparejado: no cuenta como gasto">↔ ' + flecha + esc(otra) + '</span>';
    var acc = S.account(m.counterpart);
    if (acc && acc.importable) return ' <span class="tag tag-warn" title="Cuando importes ' + esc(otra) + ' se emparejará solo">' + flecha + esc(otra) + ' · sin pareja</span>';
    return ' <span class="tag">' + flecha + esc(otra) + '</span>';
  }

  function th(label, key, f, num) {
    var on = f.sort === key;
    return '<th data-sort="' + key + '"' + (num ? ' class="num"' : '') + '>' + label +
      (on ? (f.dir === 'asc' ? ' ↑' : ' ↓') : '') + '</th>';
  }

  /* ============================================================
     PÁGINA: PRESUPUESTO
     ============================================================ */
  function pageBudget() {
    var months = S.monthsAvailable();
    var f = F.presupuesto;
    if (!f.month) f.month = months.length ? months[months.length - 1] : S.todayISO().slice(0, 7);
    var b = S.monthBounds(f.month);
    var list = S.filterMovements({ from: b.from, to: b.to });
    var spentByCat = {};
    S.byCategory(list, 'gasto').forEach(function (c) { spentByCat[c.name] = c.value; });
    var budgets = S.state.budgets || {};
    var gastoCats = S.state.categories.filter(function (c) { return c.type === 'gasto'; });

    var totalBudget = gastoCats.reduce(function (a, c) { return a + (+budgets[c.name] || 0); }, 0);
    // sólo se compara el gasto de las categorías que tienen límite puesto
    var spentInBudgeted = gastoCats.reduce(function (a, c) {
      return a + (budgets[c.name] ? (spentByCat[c.name] || 0) : 0);
    }, 0);
    var t = S.totals(list);

    var html = '<div class="page-head"><div><h1>Presupuesto</h1>' +
      '<div class="sub">Límite mensual por categoría y cómo va el mes</div></div>' +
      '<div class="row"><label class="field">Mes<select data-f="month">' +
      (months.length ? months.slice().reverse() : [f.month]).map(function (m) {
        return '<option value="' + m + '"' + (f.month === m ? ' selected' : '') + '>' + esc(S.monthLabelLong(m)) + '</option>';
      }).join('') + '</select></label></div></div>';

    html += '<div class="grid g4">' +
      statTile('Presupuestado', S.eur(totalBudget), totalBudget ? 'suma de los límites puestos' : 'aún no has puesto límites', 'var(--s1)') +
      statTile('Gastado de eso', S.eur(spentInBudgeted), totalBudget ? S.pct(spentInBudgeted / totalBudget) + ' del presupuesto' : '—', 'var(--s2)') +
      statTile('Disponible', S.eur(totalBudget - spentInBudgeted), totalBudget - spentInBudgeted >= 0 ? 'te queda margen' : 'te has pasado', totalBudget - spentInBudgeted >= 0 ? 'var(--good-text)' : 'var(--critical)') +
      statTile('Ahorro del mes', S.eur(t.net), S.eur(t.expense) + ' gastado sobre ' + S.eur(t.income), t.net >= 0 ? 'var(--good-text)' : 'var(--critical)') +
      '</div>';

    html += '<div class="card" style="margin-top:14px"><div class="card-head"><h2>Límites por categoría</h2>' +
      '<span class="hint">escribe el importe mensual; se guarda solo</span></div>' +
      '<div class="table-wrap"><table><thead><tr>' +
      '<th class="nosort">Categoría</th><th class="nosort num" style="width:140px">Límite / mes</th>' +
      '<th class="nosort num" style="width:110px">Gastado</th><th class="nosort num" style="width:110px">Restante</th>' +
      '<th class="nosort" style="width:220px">Avance</th></tr></thead><tbody>' +
      gastoCats.map(function (c) {
        var lim = +budgets[c.name] || 0;
        var sp = spentByCat[c.name] || 0;
        var pctv = lim ? sp / lim : 0;
        var over = lim && sp > lim;
        var color = !lim ? 'var(--muted)' : over ? 'var(--critical)' : pctv > 0.85 ? 'var(--warning)' : S.categoryColor(c.name);
        return '<tr><td><span class="srcdot" style="background:' + S.categoryColor(c.name) + '"></span>' + esc(c.name) +
          (c.fixed ? ' <span class="tag" title="Gasto fijo">fijo</span>' : '') + '</td>' +
          '<td class="num"><input type="number" step="10" min="0" data-budget="' + esc(c.name) + '" value="' + (lim || '') + '" placeholder="—" style="width:110px;text-align:right"></td>' +
          '<td class="num">' + S.eur(sp) + '</td>' +
          '<td class="num ' + (lim ? (over ? 'neg' : 'pos') : '') + '">' + (lim ? S.eur(lim - sp) : '—') + '</td>' +
          '<td>' + (lim
            ? '<span class="track" style="display:block;height:8px;border-radius:4px;background:var(--surface-2);overflow:hidden">' +
              '<span style="display:block;height:100%;border-radius:4px;width:' + Math.min(100, pctv * 100).toFixed(1) + '%;background:' + color + '"></span></span>' +
              '<span class="meta" style="font-size:11px;color:var(--muted)">' + (pctv * 100).toFixed(0) + ' %' + (over ? ' · pasado ' + S.eur(sp - lim) : '') + '</span>'
            : '<span class="meta" style="font-size:11px;color:var(--muted)">sin límite</span>') + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table></div></div>';

    // Tabla anual: categorías x meses
    var year = f.month.slice(0, 4);
    var yearMonths = [];
    for (var i = 1; i <= 12; i++) yearMonths.push(year + '-' + String(i).padStart(2, '0'));
    var yearList = S.filterMovements({ from: year + '-01-01', to: year + '-12-31' });
    var matrix = {};
    yearList.forEach(function (m) {
      if (m.excluded || S.categoryType(m.category) === 'traspaso' || m.amount >= 0) return;
      var k = m.category || 'Sin categoría';
      matrix[k] = matrix[k] || {};
      matrix[k][S.monthKey(m.date)] = (matrix[k][S.monthKey(m.date)] || 0) + Math.abs(m.amount);
    });
    var catNames = Object.keys(matrix).sort(function (a, b) {
      var sa = sumRow(matrix[a]), sb = sumRow(matrix[b]);
      return sb - sa;
    });

    html += '<div class="card" style="margin-top:14px"><div class="card-head"><h2>Gasto mensual por categoría · ' + year + '</h2>' +
      '<span class="hint">importes en €</span></div>';
    if (!catNames.length) {
      html += '<div class="empty">Sin gastos registrados en ' + year + '</div></div>';
    } else {
      html += '<div class="table-wrap"><table><thead><tr><th class="nosort">Categoría</th>' +
        yearMonths.map(function (m) { return '<th class="nosort num">' + S.MESES_C[+m.slice(5, 7) - 1] + '</th>'; }).join('') +
        '<th class="nosort num">Total</th><th class="nosort num">Media</th></tr></thead><tbody>' +
        catNames.map(function (c) {
          var row = matrix[c], total = sumRow(row);
          var nMonths = Object.keys(row).length || 1;
          return '<tr><td><span class="srcdot" style="background:' + S.categoryColor(c) + '"></span>' + esc(c) + '</td>' +
            yearMonths.map(function (m) {
              var v = row[m] || 0;
              return '<td class="num" style="' + (v ? '' : 'color:var(--muted)') + '">' + (v ? S.num(v) : '·') + '</td>';
            }).join('') +
            '<td class="num"><b>' + S.num(total) + '</b></td>' +
            '<td class="num">' + S.num(total / nMonths) + '</td></tr>';
        }).join('') +
        '<tr style="background:var(--surface-2)"><td><b>Total</b></td>' +
        yearMonths.map(function (m) {
          var v = catNames.reduce(function (a, c) { return a + (matrix[c][m] || 0); }, 0);
          return '<td class="num"><b>' + (v ? S.num(v) : '·') + '</b></td>';
        }).join('') +
        '<td class="num"><b>' + S.num(catNames.reduce(function (a, c) { return a + sumRow(matrix[c]); }, 0)) + '</b></td><td></td></tr>' +
        '</tbody></table></div></div>';
    }

    view.innerHTML = html;
  }

  function sumRow(o) { return Object.keys(o).reduce(function (a, k) { return a + o[k]; }, 0); }

  /* ============================================================
     PÁGINA: SUSCRIPCIONES Y RECIBOS (cargos recurrentes, detectados solos)
     ============================================================ */
  var FREQ_TXT = { mensual: 'cada mes', trimestral: 'cada 3 meses', anual: 'cada año' };

  function pageRecurring() {
    var todos = S.detectRecurring();
    var vis = todos.filter(function (r) { return !r.ignored; });
    var ign = todos.filter(function (r) { return r.ignored; });
    var subs = vis.filter(function (r) { return r.fixedAmount; });
    var recibos = vis.filter(function (r) { return !r.fixedAmount; });
    function suma(l, campo) { return l.filter(function (r) { return r.active; }).reduce(function (s, r) { return s + r[campo]; }, 0); }
    var subsMes = suma(subs, 'perMonth'), recMes = suma(recibos, 'perMonth');
    var bajas = vis.filter(function (r) { return !r.active; });

    var html = '<div class="page-head"><div><h1>Suscripciones y recibos</h1>' +
      '<div class="sub">Detectados solos: el mismo comercio cobrando cada mes, cada 3 meses o cada año</div></div></div>';

    if (!vis.length) {
      html += '<div class="card"><div class="empty"><div style="font-size:30px;margin-bottom:8px">↻</div>' +
        '<h2 style="margin-bottom:6px">Aún no hay cargos que se repitan</h2>' +
        '<p style="max-width:480px;margin:0 auto">Hacen falta al menos dos meses de movimientos. Cuando importes más extractos aparecerán aquí Spotify, Netflix, el gimnasio, los recibos…</p></div></div>' +
        ignoredBlock(ign);
      view.innerHTML = html;
      return;
    }

    html += '<div class="grid g4">' +
      statTile('Suscripciones y cuotas', S.eur(subsMes) + '<small>/mes</small>', S.eur0(subsMes * 12) + ' al año · mismo importe siempre', 'var(--s7)') +
      statTile('Recibos que varían', S.eur(recMes) + '<small>/mes</small>', 'media (luz, agua…)', 'var(--s1)') +
      statTile('Todo lo recurrente', S.eur0((subsMes + recMes) * 12) + '<small>/año</small>', S.eur(subsMes + recMes) + ' al mes', 'var(--s2)') +
      statTile('¿Dadas de baja?', String(bajas.length), bajas.length ? 'ya no se cobran (revísalas)' : 'todas siguen activas', bajas.length ? 'var(--warning)' : 'var(--muted)') +
      '</div>';

    html += recurringTable('Importe fijo', 'Suscripciones, cuotas y recibos que cobran siempre lo mismo', subs, true);
    html += recurringTable('Importe variable', 'Se repiten, pero cada vez cobran algo distinto. Se cuenta la media', recibos, false);
    html += ignoredBlock(ign);
    html += '<div class="notice" style="margin-top:14px">Si algo de la lista no es un cargo recurrente (un comercio donde compras mucho, por ejemplo), pulsa <b>No es recurrente</b> y no volverá a salir.</div>';
    view.innerHTML = html;
  }

  function recurringTable(titulo, sub, lista, fijo) {
    if (!lista.length) return '';
    lista = lista.slice().sort(function (a, b) { return (b.active - a.active) || (b.perYear - a.perYear); });
    return '<div class="card" style="margin-top:14px"><div class="card-head"><h2>' + titulo + ' <span class="kv">' + lista.length + '</span></h2><span class="hint">' + sub + '</span></div>' +
      '<div class="table-wrap"><table><thead><tr>' +
      '<th class="nosort">Comercio</th><th class="nosort">Cada</th><th class="nosort num">' + (fijo ? 'Importe' : 'Media') + '</th>' +
      '<th class="nosort num">Al año</th><th class="nosort">Último</th><th class="nosort">Próximo</th><th class="nosort">Estado</th><th class="nosort"></th>' +
      '</tr></thead><tbody>' + lista.map(function (r) {
        return '<tr' + (r.active ? '' : ' class="excluded"') + '>' +
          '<td class="concept"><b>' + esc(r.name) + '</b><div class="kv">' + sourceBadge(r.source) + ' ' +
          '<span class="chip"><span class="dot" style="background:' + S.categoryColor(r.category) + '"></span>' + esc(r.category || '—') + '</span> · ' + r.count + ' cargos</div></td>' +
          '<td>' + FREQ_TXT[r.freq] + '</td>' +
          '<td class="num"><b>' + (fijo ? '' : '≈ ') + S.eur(r.amount) + '</b></td>' +
          '<td class="num">' + S.eur0(r.perYear) + '</td>' +
          '<td class="date">' + S.fmtDate(r.last) + '</td>' +
          '<td class="date">' + (r.active ? S.fmtDate(r.next) : '—') + '</td>' +
          '<td>' + (r.active ? '<span class="tag tag-ok">✓ activa</span>' : '<span class="tag tag-warn" title="Ya tocaba otro cargo y no ha llegado">△ ¿baja?</span>') + '</td>' +
          '<td class="num" style="white-space:nowrap"><button class="btn sm ghost" data-act="rec-see" data-key="' + esc(r.key) + '">Ver</button>' +
          '<button class="btn sm ghost" data-act="rec-ignore" data-key="' + esc(r.key) + '">No es recurrente</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function ignoredBlock(ign) {
    if (!ign.length) return '';
    return '<details style="margin-top:14px"><summary>Marcados como no recurrentes (' + ign.length + ')</summary><div class="row" style="margin-top:8px">' +
      ign.map(function (r) {
        return '<span class="chip">' + esc(r.name) + ' <button class="btn sm ghost" data-act="rec-unignore" data-key="' + esc(r.key) + '">Volver a incluir</button></span>';
      }).join('') + '</div></details>';
  }

  /* ============================================================
     PÁGINA: VISTA GLOBAL (Casa + Personal juntos, sin mezclar sus datos)
     ============================================================ */
  function pageGlobal() {
    var f = F.global;
    var esp = ['casa', 'personal'];
    var meses = {}, flujo = {};
    esp.forEach(function (sp) {
      S.peekSpace(sp, function () {
        S.monthsAvailable().forEach(function (k) { meses[k] = 1; });
        S.flowMonths().forEach(function (k) { flujo[k] = 1; });
      });
    });
    var mesesU = Object.keys(meses).sort();
    var flujoU = Object.keys(flujo).sort();
    if (f.preset == null || f.autoPreset) {
      f.preset = flujoU.length ? flujoU[flujoU.length - 1] : 'thisMonth';
      f.autoPreset = true;
    }
    var per = resolvePeriod(f);
    var hoy = S.todayISO(), actual = hoy.slice(0, 7);
    var keys = [];
    for (var i = 11; i >= 0; i--) keys.push(S.addMonths(actual, -i));
    if (mesesU.length) keys = keys.filter(function (k) { return k >= mesesU[0]; });

    var R = {};
    esp.forEach(function (sp) {
      R[sp] = S.peekSpace(sp, function () {
        var list = S.filterMovements({ from: per.from, to: per.to });
        var porMes = {};
        if (keys.length) S.byMonth(S.filterMovements({ from: S.monthBounds(keys[0]).from })).forEach(function (m) { porMes[m.key] = m; });
        var nw = {};
        keys.forEach(function (k) { var to = S.monthBounds(k).to; if (to > hoy) to = hoy; nw[k] = S.netWorth(to); });
        return { t: S.totals(list), fv: S.fixedVariable(list), porMes: porMes, nw: nw,
          patrimonio: S.netWorth(), hay: S.state.movements.length > 0 };
      });
    });
    var C = R.casa, P = R.personal;
    var ing = C.t.income + P.t.income, gas = C.t.expense + P.t.expense, net = ing - gas;
    var pat = C.patrimonio + P.patrimonio;

    var html = '<div class="page-head"><div><h1>Vista global</h1>' +
      '<div class="sub">' + periodText(per) + ' · 🏠 Casa + 👤 Personal</div></div>' + simpleToggle() + '</div>';

    if (!C.hay && !P.hay) {
      view.innerHTML = html + '<div class="card"><div class="empty">Todavía no hay datos en ningún espacio.</div></div>';
      return;
    }

    html += '<div class="toolbar">' + periodSelect(f, null, mesesU) + '</div>';
    html += '<div class="grid g4">' +
      statTile('Patrimonio total · hoy', S.eur0(pat), 'Casa ' + S.eur0(C.patrimonio) + ' · Personal ' + S.eur0(P.patrimonio), 'var(--s7)') +
      statTile('Ingresos', S.eur(ing), 'Casa ' + S.eur0(C.t.income) + ' · Personal ' + S.eur0(P.t.income), 'var(--s3)') +
      statTile('Gastos', S.eur(gas), 'Casa ' + S.eur0(C.t.expense) + ' · Personal ' + S.eur0(P.t.expense), 'var(--s2)') +
      statTile('Ahorro', S.eur(net), ing > 0 ? S.pct(net / ing) + ' de lo ingresado' : '—', net >= 0 ? 'var(--good-text)' : 'var(--critical)') +
      '</div>';

    html += '<div class="grid g2" style="margin-top:14px">' +
      '<div class="card"><div class="card-head"><h2>Gasto por mes</h2><span class="hint">cada espacio por su lado</span></div><div id="chGasEsp"></div></div>' +
      '<div class="card"><div class="card-head"><h2>Patrimonio total</h2><span class="hint">cierre de cada mes · Casa + Personal</span></div><div id="chPatTot"></div></div>' +
      '</div>';

    function fila(nom, r) {
      return '<tr><td><b>' + nom + '</b></td><td class="num">' + S.eur(r.t.income) + '</td><td class="num">' + S.eur(r.t.expense) + '</td>' +
        '<td class="num">' + S.eur(r.fv.fixed) + '</td><td class="num ' + (r.t.net >= 0 ? 'pos' : 'neg') + '">' + S.eur(r.t.net) + '</td>' +
        '<td class="num"><b>' + S.eur(r.patrimonio) + '</b></td></tr>';
    }
    var fijoT = C.fv.fixed + P.fv.fixed, varT = C.fv.variable + P.fv.variable, totFV = fijoT + varT;
    html += '<div class="grid g2" style="margin-top:14px">' +
      '<div class="card"><div class="card-head"><h2>Por espacio</h2><span class="hint">' + esc(periodText(per)) + '</span></div>' +
      '<div class="table-wrap"><table><thead><tr><th class="nosort"></th><th class="nosort num">Ingresos</th><th class="nosort num">Gastos</th>' +
      '<th class="nosort num">de ello fijo</th><th class="nosort num">Ahorro</th><th class="nosort num">Patrimonio</th></tr></thead><tbody>' +
      fila('🏠 Casa', C) + fila('👤 Personal', P) +
      '<tr style="background:var(--surface-2)"><td><b>Total</b></td><td class="num"><b>' + S.eur(ing) + '</b></td><td class="num"><b>' + S.eur(gas) + '</b></td>' +
      '<td class="num"><b>' + S.eur(fijoT) + '</b></td><td class="num ' + (net >= 0 ? 'pos' : 'neg') + '"><b>' + S.eur(net) + '</b></td><td class="num"><b>' + S.eur(pat) + '</b></td></tr>' +
      '</tbody></table></div></div>' +
      '<div class="card"><div class="card-head"><h2>Fijo y variable, todo junto</h2><span class="hint">' + esc(periodText(per)) + '</span></div>' +
      (totFV ? '<div class="fv-nums">' +
        '<div><span class="label"><i class="sw" style="background:var(--s1)"></i>Fijo</span><b>' + S.eur(fijoT) + '</b><span class="kv">' + S.pct(fijoT / totFV) + '</span></div>' +
        '<div><span class="label"><i class="sw" style="background:var(--s2)"></i>Variable</span><b>' + S.eur(varT) + '</b><span class="kv">' + S.pct(varT / totFV) + '</span></div></div>' +
        '<div class="fv-bar"><span style="width:' + (fijoT / totFV * 100).toFixed(1) + '%;background:var(--s1)"></span><span style="width:' + (varT / totFV * 100).toFixed(1) + '%;background:var(--s2)"></span></div>' +
        '<div class="fv-list"><div><span>🏠 Casa</span><span class="num">' + S.eur(C.fv.fixed) + ' fijo · ' + S.eur(C.fv.variable) + ' variable</span></div>' +
        '<div><span>👤 Personal</span><span class="num">' + S.eur(P.fv.fixed) + ' fijo · ' + S.eur(P.fv.variable) + ' variable</span></div></div>'
        : '<div class="empty">Sin gastos en el periodo</div>') +
      '</div></div>';

    html += '<div class="notice" style="margin-top:14px">Aquí solo se suman los dos espacios: cada uno sigue con sus datos por separado. ' +
      'Si algún día pasas dinero de Personal a Casa, ponle la categoría <b>Traspaso entre cuentas</b> en los dos lados para que no cuente como gasto en uno e ingreso en el otro.</div>';

    view.innerHTML = html;

    // el gasto, solo hasta el último mes importado: un mes sin importar no es un mes sin gasto
    var ultimoFlujo = flujoU.length ? flujoU[flujoU.length - 1] : actual;
    Charts.groupedBars(document.getElementById('chGasEsp'), keys.filter(function (k) { return k <= ultimoFlujo; }).map(function (k) {
      return { label: S.monthLabel(k), casa: (C.porMes[k] || {}).expense || 0, personal: (P.porMes[k] || {}).expense || 0 };
    }), { height: 250, series: [{ key: 'casa', name: 'Casa', color: 'var(--s1)' }, { key: 'personal', name: 'Personal', color: 'var(--s7)' }] });
    Charts.line(document.getElementById('chPatTot'), keys.map(function (k) {
      return { x: S.MESES_C[+k.slice(5, 7) - 1], label: S.monthLabelLong(k), y: (C.nw[k] || 0) + (P.nw[k] || 0) };
    }), { valueLabel: 'Patrimonio', color: 'var(--s7)', height: 250 });
  }

  /* ============================================================
     VISTA SIMPLE (móvil)
     Lo esencial de cada dashboard de un vistazo: el mes, lo gastado,
     dónde está tu dinero y lo último que se ha movido. Sale sola en
     pantallas estrechas; cada dispositivo recuerda si prefieres la otra.
     ============================================================ */
  var VISTA_KEY = 'mis-cuentas.vista';
  var estrecho = window.matchMedia ? window.matchMedia('(max-width: 700px)') : { matches: false };
  function vistaElegida() { try { return localStorage.getItem(VISTA_KEY); } catch (e) { return null; } }
  function vistaSimple() {
    var v = vistaElegida();
    if (v === 'simple') return true;
    if (v === 'completa') return false;
    return estrecho.matches;
  }
  /** Solo se guarda si es distinta de la que toca por tamaño de pantalla. */
  function setVista(v) {
    var porDefecto = estrecho.matches ? 'simple' : 'completa';
    try { if (v === porDefecto) localStorage.removeItem(VISTA_KEY); else localStorage.setItem(VISTA_KEY, v); } catch (e) { /* noop */ }
    render();
  }
  /* Al girar el móvil o cambiar el tamaño de la ventana, si ahora toca la
     otra vista, se vuelve a pintar (solo en las páginas que tienen las dos). */
  var pintadaSimple = null;
  function revisarVista() {
    if (currentRoute !== 'dashboard' && currentRoute !== 'global') return;
    if (pintadaSimple !== null && pintadaSimple !== vistaSimple()) render();
  }
  if (estrecho.addEventListener) estrecho.addEventListener('change', revisarVista);
  var tRes = null;
  window.addEventListener('resize', function () { clearTimeout(tRes); tRes = setTimeout(revisarVista, 150); });
  /** Botón para pasar a la vista simple (solo se ve en pantallas estrechas). */
  function simpleToggle() {
    return '<button class="btn sm only-narrow" data-act="vista" data-vista="simple">📱 Vista simple</button>';
  }

  /** Mes que se enseña: el último con datos, y se puede ir hacia atrás. */
  function simpleMonths(meses) {
    var actual = S.todayISO().slice(0, 7);
    var ultimo = meses.length ? meses[meses.length - 1] : actual;
    var fin = ultimo > actual ? ultimo : actual;
    var ini = meses.length ? meses[0] : actual;
    var f = F.simple;
    if (!f.month || f.month < ini || f.month > fin) f.month = ultimo;
    return { month: f.month, first: ini, last: fin };
  }
  function monthNav(r) {
    return '<div class="s-month">' +
      '<button type="button" data-act="s-month" data-dir="-1" aria-label="Mes anterior"' + (r.month <= r.first ? ' disabled' : '') + '>‹</button>' +
      '<b>' + esc(S.monthLabelLong(r.month)) + '</b>' +
      '<button type="button" data-act="s-month" data-dir="1" aria-label="Mes siguiente"' + (r.month >= r.last ? ' disabled' : '') + '>›</button></div>';
  }
  function simpleTop(titulo) {
    return '<div class="s-top"><h1>' + titulo + '</h1>' +
      (S.space === 'personal'
        ? '<button class="btn sm" data-act="manual-new">＋ Apuntar</button>'
        : '<a class="btn sm" href="#/importar">⇪ Importar</a>') + '</div>';
  }
  /** Aviso «Instala Mis cuentas», solo cuando el navegador deja instalarla. */
  var installHidden = false;
  function installBanner() {
    if (!installPrompt || installHidden || isInstalled()) return '';
    return '<div class="s-install"><span>📲 <b>Instala Mis cuentas</b> en este dispositivo: se abre como una app y funciona sin conexión.</span>' +
      '<span class="row"><button class="btn sm primary" data-act="install-app">Instalar</button>' +
      '<button class="btn sm ghost" data-act="install-later">Ahora no</button></span></div>';
  }
  function remindMini() {
    var snooze = S.state.settings.remindSnooze;
    if (snooze && snooze >= S.todayISO()) return '';
    var n = remindersDue().length;
    return n ? '<a class="s-remind" href="#/importar"><span>📥 ' + (n === 1 ? '1 cuenta' : n + ' cuentas') + ' por poner al día</span><span aria-hidden="true">›</span></a>' : '';
  }
  /** "▲ 120 € más que en septiembre" (en gasto, más es peor). */
  function vsMesAnterior(ahora, antes, mes, masEsMejor) {
    if (!antes) return '';
    var d = ahora - antes;
    if (Math.abs(d) < 0.5) return 'igual que en ' + S.monthLabelLong(S.addMonths(mes, -1)).split(' ')[0];
    var bien = masEsMejor ? d > 0 : d < 0;
    return '<span class="' + (bien ? 'pos' : 'neg') + '">' + (d > 0 ? '▲ ' : '▼ ') + S.eur0(Math.abs(d)) + (d > 0 ? ' más' : ' menos') + '</span> que en ' +
      S.monthLabelLong(S.addMonths(mes, -1)).split(' ')[0];
  }
  function simpleTrio(items) {
    return '<div class="s-trio">' + items.map(function (x) {
      return '<div><span class="label">' + esc(x[0]) + '</span><b' + (x[2] ? ' class="' + x[2] + '"' : '') + '>' + x[1] + '</b>' +
        (x[3] ? '<span class="kv">' + x[3] + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function simpleCats(cats) {
    if (!cats.length) return '<div class="kv">Sin gastos este mes.</div>';
    var max = cats[0].value, resto = cats.slice(5).reduce(function (s, c) { return s + c.value; }, 0);
    return '<div class="s-list">' + cats.slice(0, 5).map(function (c) {
      var color = S.categoryColor(c.name);
      return '<div><div class="s-row"><span><span class="srcdot" style="background:' + color + '"></span>' + esc(c.name) + '</span><b>' + S.eur(c.value) + '</b></div>' +
        '<div class="s-track"><span style="width:' + (c.value / max * 100).toFixed(1) + '%;background:' + color + '"></span></div></div>';
    }).join('') + (cats.length > 5 ? '<div class="kv">y ' + (cats.length - 5) + ' categorías más: ' + S.eur(resto) + '</div>' : '') + '</div>';
  }
  function simpleMovs(list, conCuenta) {
    var l = list.filter(function (m) { return !m.excluded && !m.auto; })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).slice(0, 6);
    if (!l.length) return '<div class="kv">Sin movimientos este mes.</div>';
    return l.map(function (m) {
      var tras = S.categoryType(m.category) === 'traspaso';
      return '<div class="s-mov"><div><div class="s-concept">' + esc(m.concept) + '</div>' +
        '<div class="kv">' + S.fmtDate(m.date).slice(0, 5) + ' · ' + esc(m.category || '') + (conCuenta ? ' · ' + esc(S.accountLabel(m.source)) : '') + '</div></div>' +
        '<b class="' + (tras ? '' : m.amount > 0 ? 'pos' : '') + '">' + (m.amount > 0 ? '+' : '') + S.eur(m.amount) + '</b></div>';
    }).join('');
  }
  function budgetBar(list) {
    var bud = S.state.budgets || {};
    var cats = Object.keys(bud).filter(function (k) { return bud[k] > 0; });
    if (!cats.length) return '';
    var total = cats.reduce(function (s, k) { return s + bud[k]; }, 0);
    var gastado = S.byCategory(list, 'gasto').filter(function (c) { return cats.indexOf(c.name) !== -1; })
      .reduce(function (s, c) { return s + c.value; }, 0);
    var p = gastado / total;
    var color = p > 1 ? 'var(--critical)' : p > 0.85 ? 'var(--warning)' : 'var(--good)';
    return '<div style="margin-top:12px"><div class="s-row kv"><span>Presupuesto</span><span>' + S.eur0(gastado) + ' de ' + S.eur0(total) +
      (p > 1 ? ' · te has pasado' : '') + '</span></div><div class="s-track"><span style="width:' + Math.min(100, p * 100).toFixed(1) + '%;background:' + color + '"></span></div></div>';
  }
  function cushionMini() {
    var c = S.cushion();
    if (!c.avg) return '';
    var prog = Math.max(0, Math.min(1, c.covered / c.goal));
    var ok = c.covered >= c.goal;
    return '<div class="s-card"><h2>Colchón de seguridad<span class="kv">meta: ' + c.goal + ' meses</span></h2>' +
      '<div class="s-row"><span><b style="font-size:20px">' + mesesNum(c.covered) + '</b> <span class="kv">de gasto cubiertos</span></span>' +
      '<span class="chip ' + (ok ? 'chip-good' : 'chip-warn') + '">' + (ok ? '✓ cumplida' : '△ por debajo') + '</span></div>' +
      '<div class="s-track"><span style="width:' + (prog * 100).toFixed(1) + '%;background:' + (ok ? 'var(--good)' : 'var(--warning)') + '"></span></div></div>';
  }
  function simpleFoot(texto) {
    return '<div class="s-foot"><button class="btn" data-act="vista" data-vista="completa">' + texto + '</button></div>';
  }
  function simpleEmpty(icono, titulo) {
    view.innerHTML = '<div class="simple">' + simpleTop(titulo) + installBanner() +
      '<div class="s-card s-empty"><div style="font-size:34px">' + icono + '</div><h2>Aún no hay datos aquí</h2>' +
      '<p>En el móvil, lo más fácil es cargar la copia que descargas en el PC (<i>Ajustes → Descargar copia</i>).</p>' +
      '<label class="btn primary">⤒ Cargar copia de seguridad<input type="file" accept=".json,application/json" data-restore hidden></label>' +
      '<a class="btn" href="#/importar">⇪ Importar un extracto</a></div>' + simpleFoot('Ver el dashboard completo') + '</div>';
  }

  /* ---------- Casa ---------- */
  function simpleCasa() {
    if (!S.state.movements.length) return simpleEmpty('🏠', '🏠 Casa');
    var r = simpleMonths(S.flowMonths());
    var b = S.monthBounds(r.month), pb = S.monthBounds(S.addMonths(r.month, -1));
    var list = S.filterMovements({ from: b.from, to: b.to });
    var t = S.totals(list), prev = S.totals(S.filterMovements({ from: pb.from, to: pb.to }));

    var html = '<div class="simple">' + simpleTop('🏠 Casa') + installBanner() + remindMini() + monthNav(r);
    html += '<div class="s-hero"><span class="label">Gastado</span><span class="big">' + S.eur(t.expense) + '</span>' +
      '<span class="kv">' + (vsMesAnterior(t.expense, prev.expense, r.month, false) || t.count + ' movimientos') + '</span>' + budgetBar(list) + '</div>';
    html += simpleTrio([
      ['Ingresos', S.eur0(t.income)],
      ['Ahorro', S.eur0(t.net), t.net >= 0 ? 'pos' : 'neg'],
      ['Tasa', t.income > 0 ? S.pct(t.rate) : '—', '', 'de ahorro']
    ]);
    html += '<div class="s-card"><h2>En qué se va</h2>' + simpleCats(S.byCategory(list, 'gasto')) + '</div>';

    // el dinero: saldo de las cuentas y lo que lleva la tarjeta este mes
    var cuentas = Object.keys(S.state.accounts).map(function (k) {
      var a = S.state.accounts[k];
      if (a.noBalance) {
        var g = list.filter(function (m) { return m.source === k && S.countsAsFlow(m) && m.amount < 0; })
          .reduce(function (s, m) { return s - m.amount; }, 0);
        return '<div class="s-row"><span><span class="srcdot" style="background:var(' + a.color + ')"></span>' + esc(a.label) + ' <span class="kv">gastado este mes</span></span><b>' + S.eur(g) + '</b></div>';
      }
      var bal = S.accountBalance(k);
      return '<div class="s-row"><span><span class="srcdot" style="background:var(' + a.color + ')"></span>' + esc(a.label) + ' <span class="kv">' + (bal.date ? 'a ' + S.fmtDate(bal.date).slice(0, 5) : '') + '</span></span>' +
        '<b class="' + (bal.value < 0 ? 'neg' : '') + '">' + S.eur(bal.value) + '</b></div>';
    }).join('');
    html += '<div class="s-card"><h2>Cuentas</h2><div class="s-list">' + cuentas + '</div></div>';
    html += cushionMini();
    html += '<div class="s-card"><h2>Últimos movimientos<a href="#/movimientos" data-act="s-see-month">ver todos</a></h2>' + simpleMovs(list, true) + '</div>';
    html += simpleFoot('Ver el dashboard completo') + '</div>';
    view.innerHTML = html;
  }

  /* ---------- Personal ---------- */
  function simplePersonal() {
    if (!S.state.movements.length && !(S.state.valuations || []).length) return simpleEmpty('👤', '👤 Personal');
    var r = simpleMonths(S.flowMonths());
    var b = S.monthBounds(r.month), pb = S.monthBounds(S.addMonths(r.month, -1));
    var list = S.filterMovements({ from: b.from, to: b.to });
    var t = S.totals(list), prev = S.totals(S.filterMovements({ from: pb.from, to: pb.to }));
    var hoy = S.todayISO();
    var pat = S.netWorth(), finAnt = S.monthBounds(S.addMonths(hoy.slice(0, 7), -1)).to, patAnt = S.netWorth(finAnt), d = pat - patAnt;

    var html = '<div class="simple">' + simpleTop('👤 Personal') + installBanner() + remindMini();
    html += '<div class="s-hero"><span class="label">Patrimonio neto · hoy</span><span class="big">' + S.eur0(pat) + '</span>' +
      '<span class="kv">' + (!patAnt ? 'cuentas + inversiones'
        : Math.abs(d) < 0.5 ? 'sin cambios desde el ' + S.fmtDate(finAnt)
        : '<span class="' + (d >= 0 ? 'pos' : 'neg') + '">' + (d >= 0 ? '▲ +' : '▼ −') + S.eur0(Math.abs(d)) + '</span> desde el ' + S.fmtDate(finAnt)) + '</span></div>';
    html += monthNav(r);
    html += simpleTrio([
      ['Ingresos', S.eur0(t.income)],
      ['Gastos', S.eur0(t.expense), '', vsMesAnterior(t.expense, prev.expense, r.month, false).replace(/ que en .*/, '')],
      ['Ahorrado', S.eur0(t.net), t.net >= 0 ? 'pos' : 'neg', t.invested > 0 ? S.eur0(t.invested) + ' invertidos' : '']
    ]);

    // dónde está tu dinero: cada cuenta con su saldo; las inversiones, con lo que ganan
    var filas = Object.keys(S.state.accounts).map(function (k) { return { k: k, a: S.state.accounts[k], b: S.accountBalance(k) }; })
      .filter(function (x) { return x.b.value || x.a.kind === 'inversion' && x.b.valued; })
      .sort(function (x, y) { return y.b.value - x.b.value; });
    html += '<div class="s-card"><h2>Dónde está tu dinero<a href="#/cuentas">cuentas</a></h2><div class="s-list">' + (filas.length ? filas.map(function (x) {
      var extra = '';
      if (x.a.kind === 'inversion' && x.b.valued) {
        var res = x.b.value - (x.b.invested || 0), ar = S.annualReturn(x.k);
        extra = '<div class="kv"><span class="' + (res >= 0 ? 'pos' : 'neg') + '">' + signed(res) + (x.b.invested > 0 ? ' (' + signedPct(res / x.b.invested) + ')' : '') + '</span>' +
          (!ar.reason && ar.confidence !== 'baja' ? ' · ' + signedPct(ar.rate) + ' al año' : '') + '</div>';
      }
      return '<div><div class="s-row"><span><span class="srcdot" style="background:var(' + x.a.color + ')"></span>' + esc(x.a.label) + '</span>' +
        '<b class="' + (x.b.value < 0 ? 'neg' : '') + '">' + S.eur(x.b.value) + '</b></div>' + extra + '</div>';
    }).join('') : '<div class="kv">Sin saldos todavía.</div>') + '</div></div>';

    html += '<div class="s-card"><h2>En qué se va</h2>' + simpleCats(S.byCategory(list, 'gasto')) + '</div>';
    html += cushionMini();
    html += '<div class="s-card"><h2>Últimos movimientos<a href="#/movimientos" data-act="s-see-month">ver todos</a></h2>' + simpleMovs(list, true) + '</div>';
    html += simpleFoot('Ver el dashboard completo') + '</div>';
    view.innerHTML = html;
  }

  /* ---------- Vista global ---------- */
  function simpleGlobal() {
    var flujo = {};
    ['casa', 'personal'].forEach(function (sp) {
      S.peekSpace(sp, function () { S.flowMonths().forEach(function (k) { flujo[k] = 1; }); });
    });
    var r = simpleMonths(Object.keys(flujo).sort());
    var b = S.monthBounds(r.month);
    var R = {};
    ['casa', 'personal'].forEach(function (sp) {
      R[sp] = S.peekSpace(sp, function () {
        return { t: S.totals(S.filterMovements({ from: b.from, to: b.to })), pat: S.netWorth(), hay: S.state.movements.length > 0 };
      });
    });
    var C = R.casa, P = R.personal;
    if (!C.hay && !P.hay) return simpleEmpty('◎', '◎ Vista global');
    var ing = C.t.income + P.t.income, gas = C.t.expense + P.t.expense, net = ing - gas;

    var html = '<div class="simple"><div class="s-top"><h1>◎ Vista global</h1></div>';
    html += '<div class="s-hero"><span class="label">Patrimonio total · hoy</span><span class="big">' + S.eur0(C.pat + P.pat) + '</span>' +
      '<span class="kv">🏠 Casa ' + S.eur0(C.pat) + ' · 👤 Personal ' + S.eur0(P.pat) + '</span></div>';
    html += monthNav(r);
    html += simpleTrio([['Ingresos', S.eur0(ing)], ['Gastos', S.eur0(gas)], ['Ahorro', S.eur0(net), net >= 0 ? 'pos' : 'neg']]);
    function espacio(nom, x, color) {
      return '<div><div class="s-row"><span>' + nom + '</span><b>' + S.eur(x.t.expense) + '</b></div>' +
        '<div class="s-track"><span style="width:' + (gas ? x.t.expense / gas * 100 : 0).toFixed(1) + '%;background:' + color + '"></span></div>' +
        '<div class="kv">Ingresos ' + S.eur0(x.t.income) + ' · ahorro <span class="' + (x.t.net >= 0 ? 'pos' : 'neg') + '">' + S.eur0(x.t.net) + '</span></div></div>';
    }
    html += '<div class="s-card"><h2>Gasto de cada espacio</h2><div class="s-list">' +
      espacio('🏠 Casa', C, 'var(--s1)') + espacio('👤 Personal', P, 'var(--s7)') + '</div></div>';
    html += simpleFoot('Ver la vista global completa') + '</div>';
    view.innerHTML = html;
  }

  /* ============================================================
     PÁGINA: CUENTAS E INVERSIONES (Personal)
     ============================================================ */
  function pageAccounts() {
    var keys = Object.keys(S.state.accounts);
    var liq = keys.filter(function (k) { return S.state.accounts[k].kind !== 'inversion'; });
    var inv = keys.filter(function (k) { return S.state.accounts[k].kind === 'inversion'; });
    var sinPareja = S.state.movements.filter(function (m) {
      var a = S.account(m.counterpart);
      return m.counterpart && !m.pairId && !m.excluded && a && a.importable;
    });

    var html = '<div class="page-head"><div><h1>Cuentas e inversiones</h1>' +
      '<div class="sub">Patrimonio neto hoy: <b>' + S.eur(S.netWorth()) + '</b></div></div>' +
      '<div class="row"><button class="btn sm" data-act="manual-new">＋ Apuntar a mano</button>' +
      '<button class="btn sm" data-act="pair-now">↔ Emparejar traspasos</button></div></div>';

    if (sinPareja.length) {
      html += '<div class="notice warn" style="margin-bottom:14px"><b>' + sinPareja.length + ' traspaso' + (sinPareja.length > 1 ? 's' : '') +
        ' sin pareja.</b> Van a ' + esc(unique(sinPareja.map(function (m) { return S.accountLabel(m.counterpart); })).join(' y ')) +
        ', pero aún no está importado el extracto de esa cuenta en esas fechas. Se emparejarán solos al importarlo. Mientras tanto no cuentan como gasto.</div>';
    }

    html += '<h2 class="section-title">Liquidez <span class="kv">dinero que entra y sale</span></h2><div class="grid g3">' +
      liq.map(liquidityCard).join('') + '</div>';
    html += '<h2 class="section-title">Inversiones <span class="kv">lo que tienes, no lo que gastas</span></h2><div class="grid g2">' +
      inv.map(investmentCard).join('') + '</div>';

    view.innerHTML = html;
  }

  function unique(arr) { return arr.filter(function (x, i) { return arr.indexOf(x) === i; }); }

  function accHead(k) {
    var a = S.state.accounts[k];
    return '<div class="card-head"><h2><span class="srcdot" style="background:var(' + a.color + ')"></span>' + esc(a.label) + '</h2>' + kindTag(a.kind) + '</div>';
  }

  function liquidityCard(k) {
    var a = S.state.accounts[k], b = S.accountBalance(k);
    var movs = S.state.movements.filter(function (m) { return m.source === k; });
    var html = '<div class="card acc-card">' + accHead(k) +
      '<div class="acc-value' + (b.value < 0 ? ' neg' : '') + '">' + S.eur(b.value) + '</div>' +
      '<div class="kv">' + esc(b.how || 'sin movimientos') + '</div>' +
      '<div class="kv">' + movs.length + ' movimiento' + (movs.length === 1 ? '' : 's') +
      (movs.length ? ' · <a href="#/movimientos" data-act="see-account" data-acc="' + k + '">ver</a>' : '') + '</div><hr class="sep">';
    if (a.importable) {
      html += '<div class="kv" style="margin-bottom:8px">El saldo sale del último extracto que importes.' +
        (a.iban ? ' Cuenta <b>••' + esc(a.iban.slice(-4)) + '</b>: sus extractos van aquí solos.' : '') + '</div>' +
        '<a class="btn sm" href="#/importar" data-act="import-for" data-acc="' + k + '">⇪ Importar extracto</a>';
    } else {
      var mes = S.monthBounds(S.todayISO().slice(0, 7));
      var delMes = movs.filter(function (m) { return m.date >= mes.from && m.date <= mes.to; });
      var entra = delMes.filter(function (m) { return m.amount > 0; }).reduce(function (s, m) { return s + m.amount; }, 0);
      var sale = delMes.filter(function (m) { return m.amount < 0; }).reduce(function (s, m) { return s - m.amount; }, 0);
      html += '<div class="kv" style="margin-bottom:8px">' + (delMes.length
          ? 'Este mes: +' + S.eur(entra) + ' (cajero y traspasos) · −' + S.eur(sale) + ' gastado'
          : 'Sin movimientos este mes.') + '</div>' +
        '<label class="field">Lo que tenías al empezar<input type="number" step="0.01" id="opening-' + k + '" data-acc-opening="' + k + '" value="' + (a.opening || '') + '" placeholder="0,00"></label>' +
        '<div class="row" style="margin-top:10px"><button class="btn sm primary" data-act="manual-new" data-acc="' + k + '">＋ Apuntar gasto en ' + esc(a.label.toLowerCase()) + '</button>' +
        '<a class="btn sm" href="#/importar" data-act="import-for" data-acc="' + k + '" title="Si llevas los gastos en un Excel">⇪ Importar Excel</a></div>';
    }
    return html + '</div>';
  }

  function investmentCard(k) {
    var a = S.state.accounts[k], b = S.accountBalance(k);
    var ap = b.invested || 0, res = b.value - ap;
    var vals = (S.state.valuations || []).filter(function (v) { return v.account === k; })
      .sort(function (x, y) { return x.date < y.date ? 1 : -1; });
    var aport = S.state.movements.filter(function (m) { return m.source === k && S.categoryType(m.category) === 'traspaso'; })
      .sort(function (x, y) { return x.date < y.date ? 1 : -1; });

    var html = '<div class="card acc-card">' + accHead(k) +
      '<div class="mini-stats">' +
      '<div><span class="label">Aportado</span><b>' + S.eur(ap) + '</b></div>' +
      '<div><span class="label">Valor hoy</span><b>' + S.eur(b.value) + '</b></div>' +
      '<div><span class="label">Resultado</span><b class="' + (b.valued ? (res >= 0 ? 'pos' : 'neg') : '') + '">' + (b.valued ? signed(res) : '—') + '</b></div>' +
      '<div><span class="label">%</span><b class="' + (b.valued ? (res >= 0 ? 'pos' : 'neg') : '') + '">' + (b.valued && ap > 0 ? signedPct(res / ap) : '—') + '</b></div>' +
      '</div>' +
      '<div class="kv">' + esc(b.how) + (b.investedFrom === 'operaciones' ? ' · lo aportado sale de tus compras y ventas' : '') + '</div>' +
      returnLine(k) + incomeLine(k) + '<hr class="sep">' +
      '<h3 style="margin-bottom:8px">Actualizar valor</h3>' +
      '<div class="row val-form">' +
      '<label class="field">Fecha<input type="date" id="val-date-' + k + '" value="' + S.todayISO() + '"></label>' +
      '<label class="field">Valor total (€)<input type="number" step="0.01" min="0" id="val-value-' + k + '" placeholder="0,00"></label>' +
      '<label class="field" style="flex:1 1 160px">Nota<input type="text" id="val-note-' + k + '" placeholder="' + (k === 'cripto' ? 'BingX 1.200 · MEXC 950' : 'opcional') + '"></label>' +
      '<button class="btn primary sm" data-act="val-add" data-acc="' + k + '" style="align-self:flex-end">Guardar valor</button></div>';
    if (k === 'degiro') {
      html += '<div class="kv" style="margin-top:8px">…o súbela tal cual: en Degiro, <i>Cartera → Exportar → CSV</i>. ' +
        '<label class="btn sm" style="margin-left:4px">⇪ Leer cartera de Degiro<input type="file" accept=".csv,.txt" data-val-file="' + k + '" hidden></label></div>' +
        '<h3 style="margin:14px 0 6px">Dividendos y comisiones</h3>' +
        '<div class="kv">En Degiro, <i>Actividad → Estado de cuenta → Exportar → CSV</i>. Se cogen los dividendos, su retención, las comisiones y los intereses; ' +
        'las compras, ventas e ingresos se saltan (lo aportado ya sale de ING). ' +
        '<label class="btn sm" style="margin-left:4px">⇪ Leer estado de cuenta<input type="file" accept=".csv,.txt" data-degiro-account="' + k + '" hidden></label></div>';
    }
    html += portfolioBlock(k);
    html += '<div class="row val-form" style="margin-top:12px">' +
      '<label class="field" style="flex:1 1 180px">Aportado antes de empezar a usar la app' +
      '<input type="number" step="0.01" min="0" id="openinv-' + k + '" data-acc-openinv="' + k + '" value="' + (a.openingInvested || '') + '" placeholder="0,00"></label>' +
      '<label class="field">¿Desde cuándo?<input type="date" id="openinvdate-' + k + '" data-acc-openinvdate="' + k + '" value="' + (a.openingInvestedDate || '') + '"></label></div>';

    html += '<details style="margin-top:12px"' + (vals.length ? ' open' : '') + '><summary>Valoraciones (' + vals.length + ')</summary>' +
      (vals.length ? '<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th class="nosort">Fecha</th><th class="nosort num">Valor</th><th class="nosort">Nota</th><th class="nosort"></th></tr></thead><tbody>' +
        vals.slice(0, 12).map(function (v) {
          return '<tr><td class="date">' + S.fmtDate(v.date) + '</td><td class="num">' + S.eur(v.value) + '</td><td>' + esc(v.note || '') + '</td>' +
            '<td class="num"><button class="btn sm ghost danger" data-act="val-del" data-id="' + v.id + '" title="Borrar valoración">✕</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="kv" style="margin-top:6px">Aún no hay ninguna. Sin valoración, se cuenta lo aportado.</div>') +
      '</details>';
    html += '<details style="margin-top:8px"><summary>Aportaciones y retiradas (' + aport.length + ')</summary>' +
      (aport.length ? '<div class="table-wrap" style="margin-top:8px"><table><tbody>' + aport.slice(0, 15).map(function (m) {
        return '<tr><td class="date">' + S.fmtDate(m.date) + '</td><td>' + esc(m.concept) + '</td><td class="num ' + (m.amount < 0 ? 'neg' : 'pos') + '">' + S.eur(m.amount) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="kv" style="margin-top:6px">Se crean solas cuando ING o Revolut mandan dinero a ' + esc(a.label) + '.</div>') +
      '</details>';
    return html + '</div>';
  }

  /* ---------- Compras y ventas: cartera, coste medio y ganancias ---------- */
  function qtyFmt(n) {
    return Number(n).toLocaleString('es-ES', { maximumFractionDigits: 4 });
  }
  function tradesInput(k, label) {
    return '<label class="btn sm">⇪ ' + (label || 'Importar operaciones') + '<input type="file" accept=".xlsx,.csv,.txt,.tsv" data-trades-file="' + k + '" hidden></label>';
  }
  function portfolioBlock(k) {
    var p = S.portfolio(k);
    var html = '<h3 style="margin:14px 0 6px">Compras y ventas</h3>';
    if (!p.trades) {
      return html + '<div class="kv">Sube tu Excel de operaciones (fecha, compra o venta, símbolo, cantidad, comisión, precio…) o el de Degiro ' +
        '(<i>Actividad → Transacciones → Exportar</i>). Verás qué tienes, a qué precio medio y cuánto has ganado o perdido al vender. ' +
        tradesInput(k) + '</div>';
    }
    html += '<div class="kv">' + p.trades + ' operaciones · ' + p.positions.length + ' valor' + (p.positions.length === 1 ? '' : 'es') + ' en cartera' +
      (p.closed.length ? ' · ' + p.closed.length + ' vendido' + (p.closed.length === 1 ? '' : 's') + ' del todo' : '') +
      ' · comisiones de compraventa ' + S.eur(p.fees) + '</div>';
    if (p.positions.length) {
      html += '<div class="table-wrap" style="margin-top:8px"><table class="pf-tbl"><thead><tr><th class="nosort">Valor</th><th class="nosort num">Cantidad</th>' +
        '<th class="nosort num">Precio medio</th><th class="nosort num">Coste</th></tr></thead><tbody>' +
        p.positions.map(function (x) {
          return '<tr><td title="Desde ' + S.fmtDate(x.first) + ' · ' + x.buys + ' compra' + (x.buys === 1 ? '' : 's') + (x.sells ? ', ' + x.sells + ' venta' + (x.sells === 1 ? '' : 's') : '') + '">' + esc(x.symbol) + '</td>' +
            '<td class="num">' + qtyFmt(x.qty) + '</td><td class="num">' + S.eur(x.avg) + '</td><td class="num">' + S.eur(x.cost) + '</td></tr>';
        }).join('') +
        '<tr style="background:var(--surface-2)"><td colspan="3"><b>Coste de lo que tienes</b></td><td class="num"><b>' + S.eur(p.cost) + '</b></td></tr>' +
        '</tbody></table></div>' +
        '<div class="kv" style="margin-top:4px">El precio medio incluye la comisión de compra. El valor de hoy de cada uno no lo sé (no me conecto a internet): la valoración total sale de arriba.</div>';
    }
    if (p.byYear.length) {
      html += '<div class="kv" style="margin-top:8px">Ganancia realizada al vender: <b class="' + (p.realized >= 0 ? 'pos' : 'neg') + '">' + signed(p.realized) + '</b> ' +
        '<span title="Cada venta se casa con las compras más antiguas (FIFO), como hace Hacienda">(FIFO, como Hacienda)</span></div>' +
        '<details style="margin-top:6px"><summary>Por año, para la declaración de la renta</summary><div class="table-wrap" style="margin-top:6px"><table><tbody>' +
        p.byYear.map(function (y) {
          return '<tr><td>' + y.year + '</td><td class="num ' + (y.value >= 0 ? 'pos' : 'neg') + '">' + signed(y.value) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (p.closed.length ? '<div class="kv" style="margin-top:6px">Vendidos del todo: ' + esc(p.closed.map(function (x) { return x.symbol + ' (' + signed(x.realized) + ')'; }).join(', ')) + '</div>' : '') +
        '</details>';
    }
    if (p.incomplete.length) {
      html += '<div class="notice warn" style="margin-top:8px">Vendes más ' + esc(p.incomplete.join(', ')) + ' de lo que consta comprado: falta alguna compra antigua en el fichero. ' +
        'La ganancia de esas ventas solo cuenta la parte que sí tiene compra.</div>';
    }
    html += '<div class="row" style="margin-top:8px">' + tradesInput(k, 'Añadir más operaciones') +
      '<button class="btn sm ghost danger" data-act="trades-clear" data-acc="' + k + '">Borrar operaciones</button></div>';
    return html;
  }

  /** Lee un Excel o CSV de operaciones y pide confirmación. */
  function readTrades(file, k) {
    Parse.readBook(file).then(function (hojas) {
      var r = null, hoja = null;
      hojas.some(function (h) { r = Parse.parseTrades(h.text); hoja = h; return !!r; });
      if (!r) {
        toast('No encuentro operaciones en ese fichero. Hacen falta al menos la fecha, el valor (símbolo) y la cantidad.', 'bad');
        return;
      }
      showTrades(r, k, file.name, hojas.length > 1 ? hoja.name : '');
    }).catch(function (err) { toast(err.message, 'bad'); });
  }
  var pendingTrades = null;

  function showTrades(r, k, nombre, hoja) {
    var a = S.analyzeTrades(k, r.rows);
    pendingTrades = { account: k, list: a.news };
    var compras = a.news.filter(function (t) { return t.side === 'buy'; });
    var ventas = a.news.filter(function (t) { return t.side === 'sell'; });
    var suma = function (l, f) { return l.reduce(function (s, t) { return s + f(t); }, 0); };
    var modo = {
      degiro: 'las columnas del fichero de transacciones de Degiro',
      cabecera: 'el nombre de cada columna',
      posicion: 'el orden de tu Excel (A fecha, B compra/venta, C símbolo, D cantidad, E comisión… H precio en €, J total)'
    }[r.mode];
    var muestra = a.news.concat(a.dups).sort(function (x, y) { return x.date < y.date ? 1 : -1; }).slice(0, 10);
    modal('<h2>Operaciones de ' + esc(S.accountLabel(k)) + '</h2>' +
      '<div class="kv" style="margin:6px 0 12px">' + esc(nombre || 'texto pegado') + (hoja ? ' · hoja «' + esc(hoja) + '»' : '') + ' · leído por ' + esc(modo) + '</div>' +
      '<div class="table-wrap"><table><tbody>' +
      '<tr><td>Compras</td><td class="num">' + compras.length + '</td><td class="num">' + S.eur(suma(compras, function (t) { return t.gross + t.fee; })) + '</td></tr>' +
      '<tr><td>Ventas</td><td class="num">' + ventas.length + '</td><td class="num">' + S.eur(suma(ventas, function (t) { return t.gross - t.fee; })) + '</td></tr>' +
      '<tr><td>Comisiones</td><td class="num"></td><td class="num neg">' + S.eur(-suma(a.news, function (t) { return t.fee; })) + '</td></tr>' +
      '</tbody></table></div>' +
      '<h3 style="margin:14px 0 6px">Las más recientes</h3>' +
      '<div class="table-wrap scroll-y" style="max-height:240px"><table class="preview-tbl"><thead><tr><th class="nosort">Fecha</th><th class="nosort">Operación</th><th class="nosort">Valor</th>' +
      '<th class="nosort num">Cantidad</th><th class="nosort num">Precio €</th><th class="nosort num">Comisión</th></tr></thead><tbody>' +
      muestra.map(function (t) {
        var dup = a.dups.indexOf(t) !== -1;
        return '<tr' + (dup ? ' class="muted-row" title="Ya estaba"' : '') + '><td class="date">' + S.fmtDate(t.date) + '</td>' +
          '<td>' + (t.side === 'buy' ? 'Compra' : 'Venta') + (dup ? ' · ya estaba' : '') + '</td><td>' + esc(t.symbol) + '</td>' +
          '<td class="num">' + qtyFmt(t.qty) + '</td><td class="num">' + S.eur(t.priceEur) + '</td><td class="num">' + S.eur(t.fee) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (a.dups.length ? '<div class="notice" style="margin-top:10px">' + a.dups.length + ' ya estaban de otra vez: no se repiten.</div>' : '') +
      (r.skipped ? '<div class="notice" style="margin-top:10px">' + r.skipped + ' fila' + (r.skipped > 1 ? 's' : '') + ' sin fecha, valor o cantidad (títulos, totales…) se saltan.</div>' : '') +
      (r.sideGuessed ? '<div class="notice warn" style="margin-top:10px">En ' + r.sideGuessed + ' fila' + (r.sideGuessed > 1 ? 's' : '') + ' no ponía si era compra o venta: lo he deducido del signo de la cantidad.</div>' : '') +
      (a.news.some(function (t) { return t.currency; }) ? '<div class="notice" style="margin-top:10px">Los precios en dólares se guardan como referencia; todo se calcula en euros.</div>' : '') +
      '<div class="notice" style="margin-top:10px">No cuenta como gasto. Sirve para ver tu cartera, el precio medio y lo ganado al vender. ' +
      'Si no tienes importados los traspasos desde ING, lo aportado y la rentabilidad salen de estas compras y ventas.</div>' +
      '<div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" data-act="modal-cancel">Cancelar</button>' +
      '<button class="btn primary" data-act="trades-save"' + (a.news.length ? '' : ' disabled') + '>Añadir ' + a.news.length + ' operaci' + (a.news.length === 1 ? 'ón' : 'ones') + '</button></div>');
  }

  /** Dividendos y comisiones de una inversión, si se ha leído su estado de cuenta. */
  function incomeLine(k, conNombre) {
    var r = S.investmentIncome(k);
    if (!r.dividends && !r.fees && !r.interest && !r.other.length) return '';
    var partes = [];
    if (r.dividends) partes.push('Dividendos netos <b class="pos">' + S.eur(r.netDividends) + '</b> (' + S.eur(r.dividends) + ' − ' + S.eur(-r.taxes) + ' de retención)');
    if (r.fees) partes.push('Comisiones <b class="neg">' + S.eur(-r.fees) + '</b>' +
      (r.tradeFees && r.tradeFees !== r.fees ? ' (' + S.eur(-r.tradeFees) + ' de compraventa)' : ''));
    if (r.interest) partes.push('Intereses ' + S.eur(r.interest));
    var otras = {};
    r.other.forEach(function (m) { otras[m.currency] = (otras[m.currency] || 0) + m.amount; });
    Object.keys(otras).forEach(function (c) { partes.push(S.num(otras[c]) + ' ' + c + ' sin pasar a euros'); });
    return '<div class="kv inc-line">' + (conNombre ? '<b>' + esc(S.accountLabel(k)) + ':</b> ' : '') + partes.join(' · ') + '</div>';
  }

  /** Lee el estado de cuenta de Degiro (Account.csv) y pide confirmación. */
  function readDegiroAccount(file, k) {
    Parse.readFile(file).then(function (text) {
      var r = Parse.parseDegiroAccount(text);
      if (!r) { toast('No reconozco ese fichero. ¿Es el estado de cuenta de Degiro (Account.csv)?', 'bad'); return; }
      var fps = {};
      S.state.movements.forEach(function (m) { fps[m.fp] = 1; });
      var nuevos = [], repes = 0;
      var NOMBRE = { dividendo: 'Dividendo', retencion: 'Retención del dividendo', comision: 'Comisión', interes: 'Intereses' };
      r.rows.forEach(function (x) {
        var m = {
          id: S.uid(), source: k, date: x.date, valueDate: null,
          concept: NOMBRE[x.kind] + (x.product ? ' · ' + x.product : ''), extra: x.desc,
          amount: Math.round(x.amount * 100) / 100, balance: null,
          category: x.kind === 'comision' ? 'Comisiones' : 'Rendimientos',
          invKind: x.kind, manual: false, noPair: true, note: '', excluded: false, importedAt: new Date().toISOString()
        };
        if (x.currency !== 'EUR') { m.currency = x.currency; m.note = 'En ' + x.currency; }
        m.fp = S.fingerprint(m);
        if (fps[m.fp]) { repes++; return; }
        fps[m.fp] = 1;
        nuevos.push(m);
      });
      var cuenta = function (t) { return nuevos.filter(function (m) { return m.invKind === t; }); };
      var sum = function (l) { return l.reduce(function (s, m) { return s + (m.currency ? 0 : m.amount); }, 0); };
      pendingDegiro = nuevos;
      modal('<h2>Estado de cuenta de Degiro</h2>' +
        '<div class="kv" style="margin:6px 0 12px">' + r.rows.length + ' líneas útiles · ' + r.skipped + ' saltadas (compras, ventas, ingresos…)' +
        (repes ? ' · ' + repes + ' ya estaban' : '') + '</div>' +
        '<div class="table-wrap"><table><tbody>' +
        '<tr><td>Dividendos</td><td class="num">' + cuenta('dividendo').length + '</td><td class="num pos">' + S.eur(sum(cuenta('dividendo'))) + '</td></tr>' +
        '<tr><td>Retención de dividendos</td><td class="num">' + cuenta('retencion').length + '</td><td class="num neg">' + S.eur(sum(cuenta('retencion'))) + '</td></tr>' +
        '<tr><td>Comisiones</td><td class="num">' + cuenta('comision').length + '</td><td class="num neg">' + S.eur(sum(cuenta('comision'))) + '</td></tr>' +
        '<tr><td>Intereses</td><td class="num">' + cuenta('interes').length + '</td><td class="num">' + S.eur(sum(cuenta('interes'))) + '</td></tr>' +
        '</tbody></table></div>' +
        (nuevos.some(function (m) { return m.currency; }) ? '<div class="notice warn" style="margin-top:10px">Hay líneas en otra moneda: se guardan, pero no suman hasta que Degiro las pase a euros.</div>' : '') +
        '<div class="notice" style="margin-top:10px">No cambian lo aportado ni el valor (eso lo da la valoración): es para saber cuánto te han dado los dividendos y cuánto se ha llevado Degiro en comisiones.</div>' +
        '<div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" data-act="modal-cancel">Cancelar</button>' +
        '<button class="btn primary" data-act="degiro-save"' + (nuevos.length ? '' : ' disabled') + '>Añadir ' + nuevos.length + ' líneas</button></div>');
    }).catch(function (err) { toast(err.message, 'bad'); });
  }
  var pendingDegiro = null;

  /** Lee el Portfolio.csv de Degiro y pide confirmación antes de guardar. */
  function readDegiroPortfolio(file, k) {
    Parse.readFile(file).then(function (text) {
      var r = Parse.parseDegiroPortfolio(text);
      if (!r) { toast('No he encontrado posiciones en ese fichero. ¿Es la exportación de la cartera?', 'bad'); return; }
      pendingValuation = { account: k, value: r.total, note: 'Cartera Degiro · ' + r.lines.length + ' posiciones' };
      modal('<h2>Cartera de Degiro</h2>' +
        '<div class="kv" style="margin:6px 0 12px">' + (r.column ? 'Sumando la columna «' + esc(r.column) + '»' : 'No encontré la columna «Valor en EUR»: uso el último número de cada fila. Revísalo.') + '</div>' +
        '<div class="table-wrap scroll-y" style="max-height:260px"><table><tbody>' + r.lines.map(function (l) {
          return '<tr><td>' + esc(l.product) + '</td><td class="num">' + S.eur(l.value) + '</td></tr>';
        }).join('') + '<tr style="background:var(--surface-2)"><td><b>Total</b></td><td class="num"><b>' + S.eur(r.total) + '</b></td></tr></tbody></table></div>' +
        '<label class="field" style="margin-top:12px">Fecha de la valoración<input type="date" id="pv-date" value="' + S.todayISO() + '"></label>' +
        '<div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" data-act="modal-cancel">Cancelar</button>' +
        '<button class="btn primary" data-act="pv-save">Guardar ' + S.eur(r.total) + ' como valor</button></div>');
    }).catch(function (err) { toast(err.message, 'bad'); });
  }
  var pendingValuation = null;

  /* ---------- Apuntar un movimiento a mano ---------- */
  function openManual(acc) {
    var keys = Object.keys(S.state.accounts);
    acc = acc || (S.state.accounts.efectivo ? 'efectivo' : keys[0]);
    modal('<h2>Apuntar a mano</h2>' +
      '<div class="kv" style="margin:4px 0 14px">Para el efectivo y todo lo que no venga en un extracto.</div>' +
      '<div class="map-grid">' +
      '<label class="field">Cuenta<select id="mn-acc">' + keys.map(function (k) {
        return '<option value="' + k + '"' + (k === acc ? ' selected' : '') + '>' + esc(S.accountLabel(k)) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field">Fecha<input type="date" id="mn-date" value="' + S.todayISO() + '"></label>' +
      '<label class="field">Tipo<select id="mn-type"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option>' +
      '<option value="traspaso">Traspaso a otra cuenta tuya</option></select></label>' +
      '<label class="field">Importe (€)<input type="number" id="mn-amount" step="0.01" min="0" placeholder="0,00"></label>' +
      '<label class="field" style="grid-column:1/-1">Concepto<input type="text" id="mn-concept" placeholder="p. ej. Café con Javier"></label>' +
      '<label class="field" id="mn-cat-wrap">Categoría<select id="mn-cat">' + categoryOptionsOfType('gasto') + '</select></label>' +
      '<label class="field" id="mn-to-wrap" hidden>Hacia la cuenta<select id="mn-to">' + keys.map(function (k) {
        return '<option value="' + k + '">' + esc(S.accountLabel(k)) + '</option>';
      }).join('') + '</select></label>' +
      '</div>' +
      '<div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" data-act="modal-cancel">Cancelar</button>' +
      '<button class="btn primary" data-act="manual-save">Guardar</button></div>');
    var amt = document.getElementById('mn-amount');
    if (amt) amt.focus();
  }

  function counterpartOptions(sel, except) {
    return '<option value="">— ninguna —</option>' + Object.keys(S.state.accounts).filter(function (k) { return k !== except; }).map(function (k) {
      return '<option value="' + k + '"' + (sel === k ? ' selected' : '') + '>' + esc(S.accountLabel(k)) + '</option>';
    }).join('');
  }

  function categoryOptionsOfType(type) {
    return S.state.categories.filter(function (c) { return c.type === type; }).map(function (c) {
      return '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>';
    }).join('');
  }

  function saveManual() {
    var acc = document.getElementById('mn-acc').value;
    var date = document.getElementById('mn-date').value;
    var type = document.getElementById('mn-type').value;
    var amt = Math.abs(parseFloat(String(document.getElementById('mn-amount').value).replace(',', '.')));
    var concept = document.getElementById('mn-concept').value.trim();
    var cat = document.getElementById('mn-cat').value;
    var to = document.getElementById('mn-to').value;
    if (!date) { toast('Pon la fecha.', 'bad'); return; }
    if (!(amt > 0)) { toast('Pon un importe mayor que cero.', 'bad'); return; }
    if (type === 'traspaso' && to === acc) { toast('Elige una cuenta distinta de destino.', 'bad'); return; }
    var m = {
      id: S.uid(), source: acc, date: date, valueDate: null,
      concept: concept || (type === 'traspaso' ? 'Traspaso a ' + S.accountLabel(to) : cat),
      extra: '', amount: type === 'ingreso' ? amt : -amt, balance: null,
      category: cat, manual: true, handEntered: true, note: '', excluded: false, importedAt: new Date().toISOString()
    };
    if (type === 'traspaso') {
      m.counterpart = to;
      var inv = S.account(to).kind === 'inversion' || S.account(acc).kind === 'inversion';
      m.category = inv && S.getCategory('Inversión') ? 'Inversión' : 'Traspaso entre cuentas';
    }
    m.fp = S.fingerprint(m);
    S.state.movements.push(m);
    if (S.space === 'personal') S.pairTransfers();
    S.save();
    closeModal();
    toast('Apuntado: ' + S.eur(m.amount) + ' en ' + S.accountLabel(acc) + '.', 'good');
    render();
  }

  /* ============================================================
     PÁGINA: CATEGORÍAS Y REGLAS
     ============================================================ */
  function pageCategories() {
    var uncategorized = S.state.movements.filter(function (m) {
      return m.category === 'Otros gastos' || m.category === 'Otros ingresos' || !m.category;
    });
    var pending = {};
    uncategorized.forEach(function (m) {
      var k = S.merchantOf(m.concept);
      if (!pending[k]) pending[k] = { name: k, count: 0, total: 0, sample: m.concept };
      pending[k].count++; pending[k].total += Math.abs(m.amount);
    });
    var pendingList = Object.keys(pending).map(function (k) { return pending[k]; })
      .sort(function (a, b) { return b.total - a.total; }).slice(0, 15);

    var html = '<div class="page-head"><div><h1>Categorías y reglas</h1>' +
      '<div class="sub">Las reglas clasifican solas cada movimiento al importarlo</div></div>' +
      '<div class="row"><button class="btn sm" data-act="reapply">↻ Reaplicar a lo ya importado</button>' +
      '<button class="btn sm ghost" data-act="reapply-force" title="También sobrescribe las categorías que has puesto a mano">↻ Reaplicar todo (pisa manuales)</button></div></div>';

    if (pendingList.length) {
      html += '<div class="card"><div class="card-head"><h2>Sin clasificar bien</h2>' +
        '<span class="hint">' + uncategorized.length + ' movimientos en «Otros»</span></div>' +
        '<div class="notice">Asigna una categoría aquí y se creará la regla automáticamente para los próximos extractos.</div>' +
        '<div class="table-wrap" style="margin-top:10px"><table><thead><tr>' +
        '<th class="nosort">Comercio / concepto</th><th class="nosort num">Movs.</th><th class="nosort num">Total</th>' +
        '<th class="nosort" style="width:230px">Categorizar como…</th></tr></thead><tbody>' +
        pendingList.map(function (p) {
          return '<tr><td>' + esc(p.name) + '<div class="kv">' + esc(p.sample.slice(0, 70)) + '</div></td>' +
            '<td class="num">' + p.count + '</td><td class="num">' + S.eur(p.total) + '</td>' +
            '<td><select data-quickcat="' + esc(p.name) + '"><option value="">Elegir…</option>' + categoryOptions('', false) + '</select></td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }

    var rules = S.state.rules.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var conCuentas = S.space === 'personal';
    html += '<div class="card"><div class="card-head"><h2>Reglas de clasificación</h2>' +
      '<span class="hint">se aplican de arriba abajo; gana la primera que casa</span></div>' +
      (conCuentas ? '<div class="notice" style="margin-bottom:10px">«Cuenta de enfrente» convierte el movimiento en un traspaso entre tus cuentas: ' +
        'lo que mandas a <b>Degiro</b> o a un exchange (BingX, MEXC…) cuenta como aportado, y un reintegro suma al <b>efectivo</b>. ' +
        'Si cambias de exchange, añade su nombre a esa regla.</div>' : '') +
      '<div class="row" style="margin-bottom:10px">' +
      '<input type="text" id="newPattern" placeholder="palabra o varias separadas por |  (ej: mercadona|lidl)" style="flex:1;min-width:260px">' +
      '<select id="newCat">' + categoryOptions('', false) + '</select>' +
      (conCuentas ? '<select id="newCp" title="Cuenta de enfrente">' + counterpartOptions('') + '</select>' : '') +
      '<button class="btn primary sm" data-act="add-rule">Añadir regla</button></div>' +
      '<div class="table-wrap scroll-y"><table><thead><tr>' +
      '<th class="nosort" style="width:60px">Orden</th><th class="nosort">Contiene (separa alternativas con |)</th>' +
      '<th class="nosort" style="width:210px">Categoría</th>' +
      (conCuentas ? '<th class="nosort" style="width:150px">Cuenta de enfrente</th>' : '') +
      '<th class="nosort num" style="width:90px">Afecta a</th>' +
      '<th class="nosort" style="width:90px"></th></tr></thead><tbody>' +
      rules.map(function (r, i) {
        var hits = S.state.movements.filter(function (m) {
          var hay = S.normalize(m.concept + ' ' + (m.extra || ''));
          return String(r.pattern).split('|').some(function (p) { p = S.normalize(p); return p && hay.indexOf(p) !== -1; });
        }).length;
        return '<tr data-rule="' + r.id + '">' +
          '<td><button class="btn sm ghost" data-act="rule-up" data-id="' + r.id + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="btn sm ghost" data-act="rule-down" data-id="' + r.id + '"' + (i === rules.length - 1 ? ' disabled' : '') + '>↓</button></td>' +
          '<td><input type="text" data-rulepattern="' + r.id + '" value="' + esc(r.pattern) + '" style="width:100%" class="mono"></td>' +
          '<td><select data-rulecat="' + r.id + '">' + categoryOptions(r.category, false) + '</select></td>' +
          (conCuentas ? '<td><select data-rulecp="' + r.id + '">' + counterpartOptions(r.counterpart || '') + '</select></td>' : '') +
          '<td class="num">' + hits + '</td>' +
          '<td class="num"><button class="btn sm ghost danger" data-act="rule-del" data-id="' + r.id + '">✕</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';

    html += '<div class="card"><div class="card-head"><h2>Categorías</h2>' +
      '<span class="hint">los «traspasos» no cuentan como ingreso ni gasto</span></div>' +
      '<div class="notice" style="margin-bottom:10px"><b>Fijo</b> = lo pagas sí o sí cada mes' +
      (S.space === 'personal' ? ' (la universidad, las suscripciones…)' : ' (vivienda, luz, agua, gas, seguros…)') +
      '. Es lo que separa el gasto fijo del variable en el dashboard y en el colchón de seguridad.</div>' +
      '<div class="row" style="margin-bottom:10px">' +
      '<input type="text" id="newCatName" placeholder="Nombre de la nueva categoría">' +
      '<select id="newCatType"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option><option value="traspaso">Traspaso</option></select>' +
      '<button class="btn primary sm" data-act="add-cat">Añadir categoría</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th class="nosort">Categoría</th><th class="nosort" style="width:130px">Tipo</th>' +
      '<th class="nosort" style="width:90px" title="Gasto fijo: lo pagas sí o sí cada mes">Fijo</th>' +
      '<th class="nosort" style="width:150px">Color</th><th class="nosort num" style="width:100px">Movs.</th>' +
      '<th class="nosort" style="width:70px"></th></tr></thead><tbody>' +
      S.state.categories.map(function (c) {
        var n = S.state.movements.filter(function (m) { return m.category === c.name; }).length;
        return '<tr><td><span class="srcdot" style="background:var(' + c.color + ')"></span>' +
          '<input type="text" data-catname="' + esc(c.name) + '" value="' + esc(c.name) + '" style="width:200px"></td>' +
          '<td><select data-cattype="' + esc(c.name) + '">' +
          ['gasto', 'ingreso', 'traspaso'].map(function (t) {
            return '<option value="' + t + '"' + (c.type === t ? ' selected' : '') + '>' + { gasto: 'Gasto', ingreso: 'Ingreso', traspaso: 'Traspaso' }[t] + '</option>';
          }).join('') + '</select></td>' +
          '<td>' + (c.type === 'gasto'
            ? '<label class="fix-toggle"><input type="checkbox" data-catfixed="' + esc(c.name) + '"' + (c.fixed ? ' checked' : '') + '> fijo</label>'
            : '<span class="kv">—</span>') + '</td>' +
          '<td><select data-catcolor="' + esc(c.name) + '">' +
          S.SERIES.map(function (s, i) {
            return '<option value="' + s + '"' + (c.color === s ? ' selected' : '') + '>Color ' + (i + 1) + '</option>';
          }).join('') + '</select></td>' +
          '<td class="num">' + n + '</td>' +
          '<td class="num"><button class="btn sm ghost danger" data-act="cat-del" data-name="' + esc(c.name) + '">✕</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';

    view.innerHTML = html;
  }

  /* ============================================================
     PÁGINA: IMPORTAR
     ============================================================ */
  var wiz = null;
  function resetWizard() {
    wiz = { step: 1, text: '', fileName: '', table: null, map: null, delim: '', built: null, analysis: null,
      profile: null, repair: null, rows: null,
      opts: { source: 'ing', invert: false, allExpense: false } };
  }

  /** Recalcula filas arregladas + movimientos con el mapeo actual. */
  function applyMap() {
    var t = wiz.table;
    var rep = Parse.repairRows(t.data, wiz.map, t.width);
    wiz.repair = rep;
    wiz.rows = rep.data;
    wiz.built = Parse.buildMovements(wiz.rows, wiz.map, wiz.opts);
    return wiz.built;
  }

  function pageImport() {
    if (!wiz) resetWizard();
    var html = '<div class="page-head"><div><h1>Importar movimientos</h1>' +
      '<div class="sub">Los datos se procesan en tu navegador; el fichero no se sube a ningún sitio</div></div>' +
      (wiz.step > 1 ? '<button class="btn sm" data-act="wiz-reset" title="Olvida este fichero sin importarlo">✕ Descartar y subir otro</button>' : '') +
      '</div>';

    html += '<div class="steps">' +
      [['1', 'Fichero o pegado'], ['2', 'Revisar columnas'], ['3', 'Confirmar']].map(function (s, i) {
        return '<span class="step ' + (wiz.step === i + 1 ? 'on' : '') + '"><span class="n">' + s[0] + '</span>' + s[1] + '</span>';
      }).join('<span style="color:var(--muted)">›</span>') + '</div>';

    if (wiz.step === 1) html += stepFile();
    if (wiz.step === 2) html += stepMap();
    if (wiz.step === 3) html += stepConfirm();

    view.innerHTML = html;

    if (wiz.step === 1) wireDropzone();
  }

  /** Cuentas a las que se puede subir un fichero de movimientos: las del banco
      y el efectivo (tu Excel de gastos). Las inversiones van por su lado. */
  function importableAccounts() {
    return Object.keys(S.state.accounts).filter(function (k) {
      var a = S.state.accounts[k];
      return a.importable !== false || a.kind !== 'inversion';
    });
  }
  /** ¿Cuenta sin extracto del banco, que llevas tú (el efectivo)? */
  function isCash(k) {
    var a = S.state.accounts[k];
    return !!(a && a.importable === false && a.kind !== 'inversion');
  }
  function sourceOptions() {
    var ks = importableAccounts();
    if (ks.indexOf(wiz.opts.source) === -1) wiz.opts.source = ks[0];
    return ks.map(function (k) {
      return '<option value="' + k + '"' + (wiz.opts.source === k ? ' selected' : '') + '>' + esc(S.state.accounts[k].label) + '</option>';
    }).join('');
  }

  function stepFile() {
    var personal = S.space === 'personal';
    return '<div class="card">' +
      '<div class="row" style="margin-bottom:12px"><label class="field">Origen de estos movimientos' +
      '<select data-wiz="source">' + sourceOptions() + '</select></label>' +
      '<span class="kv" style="align-self:flex-end;padding-bottom:6px">Espacio: <b>' + esc(S.SPACES[S.space].label) + '</b>' +
      (personal ? ' · ING y Revolut se reconocen solos' : ' · ING y Carrefour se reconocen solos') + '</span></div>' +
      '<div class="dropzone" id="dz">' +
      '<div style="font-size:30px">⇪</div>' +
      '<p><b>Arrastra aquí el extracto</b> o <label style="color:var(--accent);cursor:pointer;text-decoration:underline">elige un fichero<input type="file" id="fileInput" accept=".csv,.txt,.tsv,.xls,.xlsx,.html" hidden></label></p>' +
      '<p style="font-size:12px;color:var(--muted)">Excel (.xlsx), CSV, TXT o el «Excel» que exporta ING. Solo el .xls del Excel antiguo hay que guardarlo antes como .xlsx o CSV — o copiar las celdas y pegarlas abajo.</p>' +
      '</div>' +
      '<hr class="sep">' +
      '<label class="field">…o pega aquí las celdas copiadas de Excel / del extracto' +
      '<textarea id="pasteArea" rows="7" placeholder="FECHA&#9;DESCRIPCIÓN&#9;IMPORTE&#10;01/01/2026&#9;MERCADONA&#9;-54,30"></textarea></label>' +
      '<div class="row" style="margin-top:10px"><button class="btn primary" data-act="use-paste">Continuar con lo pegado</button>' +
      (S.state.lastImport ? '<span class="hint" style="color:var(--muted);font-size:12px">Última importación: ' +
        esc(S.state.lastImport.fileName || 'pegado') + ' · ' + S.state.lastImport.count + ' movimientos · ' +
        S.fmtDate(S.state.lastImport.at.slice(0, 10)) + '</span>' : '') +
      '</div></div>' +
      '<div class="card"><div class="card-head"><h2>Cómo sacar el extracto</h2></div>' +
      '<div class="notice"><b>ING:</b> banca online → la cuenta → «Movimientos» → elige el rango de fechas (p. ej. 01/01 a 31/01) → botón de descarga → Excel o CSV. ' +
      'Si baja un .xls que Excel abre bien, guárdalo como «CSV (delimitado por puntos y comas)».</div>' +
      (personal
        ? '<div class="notice" style="margin-top:8px"><b>Revolut:</b> en la app, la cuenta en euros → «…» → <i>Extracto</i> → formato <b>Excel/CSV</b> → elige las fechas. ' +
          'Solo se importan los movimientos completados; los revertidos o rechazados se descartan, y si alguno va en otra moneda se guarda fuera de los totales para que lo revises.</div>' +
          '<div class="notice" style="margin-top:8px"><b>Efectivo:</b> si llevas tus gastos en un Excel (fecha, concepto, importe y, si quieres, categoría), elige <b>Origen: Efectivo</b> y súbelo aquí. ' +
          'Los importes en positivo se toman como gastos, y si pones una categoría con el mismo nombre que las de la app, se respeta. ' +
          'Lo que ya creó solo un reintegro de ING no se duplica.</div>' +
          '<div class="notice" style="margin-top:8px"><b>Degiro:</b> tu Excel de compras y ventas (o el de Degiro, <i>Actividad → Transacciones</i>) puedes soltarlo aquí mismo o en <a href="#/cuentas">Cuentas e inversiones</a>: se reconoce solo. ' +
          'Lo que mandes a Degiro, BingX o MEXC desde ING o Revolut se apunta solo en esas cuentas.</div>'
        : '<div class="notice" style="margin-top:8px"><b>Tarjeta Carrefour:</b> área de cliente → movimientos del periodo → exportar. ' +
          'Si solo puedes ver la lista en pantalla, selecciónala, cópiala y pégala en el cuadro de arriba.</div>' +
          '<div class="notice warn" style="margin-top:8px">Si pagas la tarjeta desde ING, ese recibo se clasifica como <b>Pago tarjeta</b> (traspaso) para no contar el gasto dos veces cuando importes también las líneas de la tarjeta.</div>') +
      '</div>' + accountsStatus();
  }

  function stepMap() {
    var t = wiz.table;
    var map = wiz.map;
    applyMap();
    var preview = wiz.built;

    var fields = [
      ['date', 'Fecha *', true],
      ['concept', 'Concepto / descripción *', true],
      ['amount', 'Importe *', true],
      ['debit', 'Debe / cargo (si hay dos columnas)', false],
      ['credit', 'Haber / abono', false],
      ['balance', 'Saldo', false],
      ['valueDate', 'Fecha valor', false],
      ['extra', 'Dato extra (categoría del banco, comentario…)', false],
      ['category', 'Categoría (si usa los nombres de la app)', false]
    ];
    if (map.category === undefined) map.category = -1;

    var otroEspacio = '';
    if (wiz.mismatch) {
      var dondeVa = Object.keys(S.SPACES).filter(function (k) { return k !== S.space; })[0];
      otroEspacio = '<div class="notice warn" style="margin-bottom:12px">Esto parece un extracto de <b>' + esc(wiz.mismatch) + '</b>, ' +
        'que no es una cuenta de ' + esc(S.SPACES[S.space].label) + '. ' +
        '<button class="btn sm" data-space-go="' + dondeVa + '" style="margin-left:6px">Importarlo en ' + esc(S.SPACES[dondeVa].label) + '</button></div>';
    }
    // un Excel propio sin saldo, yendo a una cuenta del banco: ¿no será el del efectivo?
    var efectivo = importableAccounts().filter(isCash)[0];
    if (efectivo && !isCash(wiz.opts.source) && map.balance < 0 && !wiz.mismatch) {
      otroEspacio += '<div class="notice" style="margin-bottom:12px">¿Es tu Excel de gastos en efectivo? Elige abajo <b>Origen: ' + esc(S.accountLabel(efectivo)) + '</b>. ' +
        'Ahora mismo iría a ' + esc(S.accountLabel(wiz.opts.source)) + '.</div>';
    }
    var html = otroEspacio + '<div class="card"><div class="card-head"><h2>Columnas detectadas</h2>' +
      '<span class="hint">' + esc(wiz.fileName || 'texto pegado') + ' · ' + t.data.length + ' filas · ' +
      (wiz.sheet != null ? 'Excel' + (wiz.sheet ? ', hoja «' + esc(wiz.sheet) + '»' : '')
        : 'separador ' + (wiz.table.delimiter === 'html' ? 'tabla HTML' : '«' + (wiz.delim === '\t' ? 'TAB' : wiz.delim) + '»')) + '</span></div>' +
      '<div class="map-grid">' + fields.map(function (fd) {
        return '<label class="field">' + fd[1] + '<select data-map="' + fd[0] + '">' +
          '<option value="-1">— ninguna —</option>' +
          t.headers.map(function (h, i) {
            return '<option value="' + i + '"' + (map[fd[0]] === i ? ' selected' : '') + '>' + esc(h) + '</option>';
          }).join('') + '</select></label>';
      }).join('') + '</div>' +
      '<hr class="sep">' +
      '<div class="row">' +
      '<label class="field">Origen<select data-wiz="source">' + sourceOptions() + '</select></label>' +
      '<label class="field" style="flex-direction:row;align-items:center;gap:7px;padding-top:18px">' +
      '<input type="checkbox" data-wiz="invert"' + (wiz.opts.invert ? ' checked' : '') + '> Invertir el signo de los importes</label>' +
      '<label class="field" style="flex-direction:row;align-items:center;gap:7px;padding-top:18px">' +
      '<input type="checkbox" data-wiz="allExpense"' + (wiz.opts.allExpense ? ' checked' : '') + '> Todos los importes son gastos (típico en extractos de tarjeta)</label>' +
      '<label class="field" style="padding-top:2px">Separador<select data-wiz="delim">' +
      [[';', 'Punto y coma ;'], [',', 'Coma ,'], ['\t', 'Tabulador'], ['|', 'Barra |']].map(function (d) {
        return '<option value="' + (d[0] === '\t' ? 'TAB' : d[0]) + '"' + (wiz.delim === d[0] ? ' selected' : '') + '>' + d[1] + '</option>';
      }).join('') + '</select></label>' +
      '</div>';

    var ok = wiz.built.movements.length;
    html += '<div class="notice ' + (ok ? '' : 'bad') + '" style="margin-top:12px">' +
      (ok ? '<b>' + ok + ' movimientos</b> listos' + (wiz.built.skipped ? ' · ' + wiz.built.skipped + ' filas descartadas (sin fecha o sin importe reconocible)' : '')
        : 'No se ha podido leer ningún movimiento. Revisa qué columna es la fecha y cuál el importe.') + '</div>';
    html += repairNotice();

    if (preview.movements.length) {
      html += '<h3 style="margin:14px 0 8px">Vista previa</h3><div class="table-wrap"><table class="preview-tbl"><thead><tr>' +
        '<th class="nosort">Fecha</th><th class="nosort">Concepto</th><th class="nosort num">Importe</th>' +
        '<th class="nosort num">Saldo</th><th class="nosort">Categoría automática</th></tr></thead><tbody>' +
        preview.movements.slice(0, 8).map(function (m) {
          return '<tr><td class="date">' + S.fmtDate(m.date) + '</td><td>' + esc(m.concept) + '</td>' +
            '<td class="num ' + (m.amount < 0 ? 'neg' : 'pos') + '">' + S.eur(m.amount) + '</td>' +
            '<td class="num">' + (m.balance != null ? S.eur(m.balance) : '—') + '</td>' +
            '<td><span class="chip"><span class="dot" style="background:' + S.categoryColor(m.category) + '"></span>' + esc(m.category) + '</span></td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    html += '<details style="margin-top:12px"><summary style="cursor:pointer;color:var(--text-2)">Ver las primeras filas del fichero tal cual</summary>' +
      '<div class="table-wrap" style="margin-top:8px"><table class="preview-tbl"><thead><tr>' +
      t.headers.map(function (h) { return '<th class="nosort">' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + (wiz.rows || t.data).slice(0, 5).map(function (r) {
        return '<tr>' + r.map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></details>';

    html += '<div class="row" style="margin-top:16px;justify-content:space-between">' +
      '<button class="btn" data-act="wiz-back">← Volver</button>' +
      '<button class="btn primary" data-act="wiz-next"' + (ok ? '' : ' disabled') + '>Continuar →</button></div></div>';
    return html;
  }

  /** Aviso de filas que venían con celdas de más y se han recolocado. */
  function repairNotice() {
    var r = wiz.repair;
    if (!r || (!r.fixed && !r.broken)) return '';
    var html = '';
    if (r.fixed) {
      html += '<div class="notice" style="margin-bottom:10px"><b>' + r.fixed + ' fila' + (r.fixed > 1 ? 's' : '') + '</b> venía' + (r.fixed > 1 ? 'n' : '') +
        ' con columnas de más (suele ser un «;» dentro del concepto) y se ' + (r.fixed > 1 ? 'han' : 'ha') + ' recolocado sola' + (r.fixed > 1 ? 's' : '') +
        ': lo sobrante se junta con el concepto y se comprueba que fecha e importe caigan en su sitio.</div>';
    }
    if (r.broken) {
      html += '<div class="notice bad" style="margin-bottom:10px">' + r.broken + ' fila(s) descuadrada(s) que no se han podido recolocar. ' +
        'Revísalas en el CSV: probablemente les falte una comilla.</div>';
    }
    return html;
  }

  function stepConfirm() {
    var a = wiz.analysis;
    var news = a.news, dups = a.dups;
    var range = news.concat(dups).reduce(function (acc, m) {
      if (!acc.min || m.date < acc.min) acc.min = m.date;
      if (!acc.max || m.date > acc.max) acc.max = m.date;
      return acc;
    }, { min: null, max: null });

    var cats = {};
    news.forEach(function (m) { cats[m.category] = (cats[m.category] || 0) + 1; });

    var html = '<div class="card"><div class="card-head"><h2>Resumen de la importación</h2>' +
      '<span class="hint">' + esc(wiz.fileName || 'texto pegado') + '</span></div>';

    if (wiz.profile) {
      html += '<div class="notice" style="margin-bottom:12px">Reconocido como <b>' + esc(wiz.profile.profile.label) + '</b> ' +
        '(' + esc(wiz.profile.reason) + '), así que las columnas se han asignado solas. ' +
        '<button class="btn sm ghost" data-act="wiz-review" style="margin-left:6px">Revisar columnas</button></div>';
    }
    html += accountChoice();
    html += repairNotice();
    var b = wiz.built || {};
    if (b.skippedState) {
      html += '<div class="notice" style="margin-bottom:10px"><b>' + b.skippedState + '</b> movimiento' + (b.skippedState > 1 ? 's' : '') +
        ' sin completar (revertidos, rechazados o pendientes) no se importan.</div>';
    }
    if (b.otherCurrency) {
      html += '<div class="notice warn" style="margin-bottom:10px"><b>' + b.otherCurrency + '</b> en otra moneda: se guardan, pero fuera de los totales. ' +
        'En Movimientos llevan una nota; cuando corrijas el importe en euros, vuelve a incluirlos.</div>';
    }
    var traspasos = news.filter(function (m) { return m.counterpart; });
    if (traspasos.length) {
      var porCuenta = {};
      traspasos.forEach(function (m) { porCuenta[m.counterpart] = (porCuenta[m.counterpart] || 0) + 1; });
      html += '<div class="notice" style="margin-bottom:10px">↔ <b>' + traspasos.length + ' traspaso' + (traspasos.length > 1 ? 's' : '') + '</b> entre tus cuentas (' +
        Object.keys(porCuenta).map(function (k) { return porCuenta[k] + ' con ' + esc(S.accountLabel(k)); }).join(', ') +
        '): no contarán como gasto, y los de efectivo, Degiro y cripto se apuntarán solos allí.</div>';
    }

    html += '<div class="grid g4">' +
      statTile('Nuevos', String(news.length), 'se añadirán', 'var(--s3)') +
      statTile('Duplicados', String(dups.length), 'ya estaban', 'var(--muted)') +
      statTile('Periodo', range.min ? S.fmtDate(range.min) : '—', range.max ? 'hasta ' + S.fmtDate(range.max) : '', 'var(--s1)') +
      statTile('Origen', esc(S.state.accounts[wiz.opts.source].label), '', 'var(--s2)') +
      '</div>';

    if (dups.length) {
      var porque = { igual: 0, reintegro: 0, mano: 0 };
      dups.forEach(function (m) { porque[m.dupWhy || 'igual']++; });
      var motivos = [];
      if (porque.igual) motivos.push(porque.igual + ' con la misma fecha, importe y concepto');
      if (porque.reintegro) motivos.push(porque.reintegro + ' que ya apuntó solo un reintegro del banco');
      if (porque.mano) motivos.push(porque.mano + ' que ya habías apuntado a mano (mismo día e importe)');
      html += '<div class="notice warn" style="margin-top:12px">Hay ' + dups.length + ' movimiento' + (dups.length > 1 ? 's' : '') + ' que ya tenías: ' +
        motivos.join('; ') + '. Por defecto no se vuelven a añadir.</div>';
    }

    html += '<h3 style="margin:16px 0 8px">Cómo quedan clasificados</h3><div class="row">' +
      Object.keys(cats).sort(function (x, y) { return cats[y] - cats[x]; }).map(function (c) {
        return '<span class="chip"><span class="dot" style="background:' + S.categoryColor(c) + '"></span>' + esc(c) + ' · ' + cats[c] + '</span>';
      }).join('') + '</div>';

    html += '<div class="row" style="margin-top:18px;justify-content:space-between">' +
      '<button class="btn" data-act="wiz-back">← Volver</button>' +
      '<div class="row">' +
      (dups.length ? '<button class="btn" data-act="wiz-import-all">Importar todo (' + (news.length + dups.length) + ')</button>' : '') +
      '<button class="btn primary" data-act="wiz-import"' + (news.length ? '' : ' disabled') + '>Importar ' + news.length + ' movimientos</button>' +
      '</div></div></div>';
    return html;
  }

  function wireDropzone() {
    var dz = document.getElementById('dz');
    var input = document.getElementById('fileInput');
    if (!dz) return;
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('drag'); });
    });
    dz.addEventListener('drop', function (e) {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', function () { if (input.files[0]) handleFile(input.files[0]); });
  }

  function handleFile(file) {
    Parse.readBook(file).then(function (hojas) {
      var h = Parse.bestSheet(hojas);
      wiz.fileName = file.name;
      // de un Excel se recuerda la hoja (vacía si solo tiene una); un CSV no tiene hojas
      var esExcel = hojas.length > 1 || h.name !== '';
      wiz.sheet = esExcel ? (hojas.length > 1 ? h.name : '') : null;
      ingestText(h.text);
    }).catch(function (err) {
      toast(err.message, 'bad');
    });
  }

  /** ¿Son compras y ventas de acciones? Entonces van a su cuenta de inversión. */
  function tradesInText(text) {
    if (S.space !== 'personal') return null;
    var inv = Object.keys(S.state.accounts).filter(function (k) { return S.state.accounts[k].kind === 'inversion'; });
    if (!inv.length) return null;
    var tr = Parse.parseTrades(text);
    // sin cabecera no se adivina: un extracto sin títulos podría parecerlo
    if (!tr || tr.mode === 'posicion') return null;
    var claras = tr.mode === 'degiro' || ['side', 'priceEur', 'priceOrig', 'fx'].some(function (c) { return tr.columns.indexOf(c) !== -1; });
    if (!claras) return null;
    return { trades: tr, account: inv.indexOf('degiro') !== -1 ? 'degiro' : inv[0] };
  }

  function ingestText(text, delim) {
    if (!text || !text.trim()) { toast('No hay nada que leer.', 'bad'); return; }
    wiz.text = text;
    var parsed = Parse.parseText(text, delim);
    wiz.delim = parsed.delimiter === 'html' ? 'html' : parsed.delimiter;
    var t = Parse.tabulate(parsed.rows);
    t.delimiter = parsed.delimiter;
    if (!t.data.length) { toast('No se han encontrado filas de datos.', 'bad'); return; }
    wiz.table = t;

    // ¿es uno de los extractos conocidos? entonces no hay nada que preguntar
    var det = Parse.detectProfile(t.headers, t.data, t.width);
    wiz.mismatch = null;
    wiz.candidates = null;
    wiz.iban = Parse.extractIban(text);
    if (det && !S.accountsForBank(det.profile.source).length) {
      // p. ej. un extracto de Revolut estando en Casa: se avisa y no se adivina
      wiz.mismatch = det.profile.label.split(' · ')[0];
      wiz.profile = null;
      wiz.map = det.map;
      applyMap();
      wiz.step = 2;
      pageImport();
      return;
    }
    if (det) {
      wiz.profile = det;
      wiz.map = det.map;
      wiz.opts.source = chooseAccount(det.profile.source);
      wiz.opts.invert = false;
      wiz.opts.allExpense = false;
      signHeuristic(det.profile);
      applyMap();
      wiz.analysis = analyzeDuplicates(wiz.built.movements);
      wiz.step = 3;
      pageImport();
      return;
    }

    // ¿compras y ventas de acciones? no son movimientos: van a la cartera de Degiro
    var tr = tradesInText(text);
    if (tr) {
      var nombre = wiz.fileName;
      resetWizard();
      pageImport();
      showTrades(tr.trades, tr.account, nombre, '');
      return;
    }

    wiz.profile = null;
    wiz.map = Parse.guessMapping(t.headers, t.data);
    // Extractos de tarjeta y tu Excel del efectivo: suelen traer los gastos en positivo
    if (wiz.opts.source === 'carrefour' || isCash(wiz.opts.source)) signHeuristic({ opts: { invertIfMostlyPositive: true } });
    applyMap();
    wiz.step = 2;
    pageImport();
  }

  /* Con dos cuentas del mismo banco (ING Nómina e ING Ahorro): si el IBAN del
     extracto ya se conoce, va solo a su cuenta; si no, se pregunta en el paso 3
     (y se recuerda para la próxima vez). */
  function chooseAccount(bank) {
    var cands = S.accountsForBank(bank);
    wiz.candidates = cands;
    if (wiz.iban) {
      var hit = cands.filter(function (k) { return S.state.accounts[k].iban === wiz.iban; })[0];
      if (hit) { wiz.accBy = 'iban'; return hit; }
    }
    wiz.accBy = cands.length > 1 ? 'pregunta' : 'unica';
    // lo que tuvieras elegido en "Origen" antes de soltar el fichero
    return cands.indexOf(wiz.opts.source) !== -1 ? wiz.opts.source : cands[0];
  }

  function accountChoice() {
    var c = wiz.candidates;
    if (!c || c.length < 2) return '';
    var fin = wiz.iban ? '••' + wiz.iban.slice(-4) : null;
    var acc = S.state.accounts[wiz.opts.source];
    var txt = wiz.accBy === 'iban'
      ? 'Es la cuenta <b>' + fin + '</b>: va a <b>' + esc(acc.label) + '</b>, como la otra vez.'
      : '<b>¿A qué cuenta va este extracto?</b>' + (fin ? ' Es la cuenta terminada en <b>' + fin + '</b>.' : '');
    var aviso = (wiz.iban && acc.iban && acc.iban !== wiz.iban)
      ? '<div class="kv" style="margin-top:6px;color:var(--critical)">Ojo: ' + esc(acc.label) + ' tiene guardada la cuenta ••' + esc(acc.iban.slice(-4)) + ', y este extracto es de ' + fin + '.</div>' : '';
    return '<div class="notice acc-choice" style="margin-bottom:12px">' + txt +
      '<div class="seg" style="margin-top:8px">' + c.map(function (k) {
        return '<button type="button" data-acc-pick="' + k + '" class="' + (k === wiz.opts.source ? 'on' : '') + '">' + esc(S.accountLabel(k)) + '</button>';
      }).join('') + '</div>' + aviso +
      (wiz.iban && wiz.accBy !== 'iban' ? '<div class="kv" style="margin-top:6px">La próxima vez lo sabré solo por el número de cuenta.</div>' : '') + '</div>';
  }

  /** Si el importe viene como "cargo" en positivo, se le da la vuelta al signo. */
  function signHeuristic(profile) {
    if (!profile.opts || !profile.opts.invertIfMostlyPositive) return;
    if (wiz.map.amount < 0) return;
    var vals = wiz.table.data.slice(0, 60)
      .map(function (r) { return Parse.parseAmount(r[wiz.map.amount]); })
      .filter(function (x) { return x !== null && x !== 0; });
    if (!vals.length) return;
    var positivos = vals.filter(function (v) { return v > 0; }).length;
    if (positivos / vals.length >= 0.7) wiz.opts.invert = true;
  }

  function analyzeDuplicates(movs) {
    var existing = {};
    S.state.movements.forEach(function (m) {
      var fp = m.fp || S.fingerprint(m);
      existing[fp] = (existing[fp] || 0) + 1;
    });
    var seen = {}, news = [], dups = [];
    movs.forEach(function (m) {
      var fp = m.fp;
      seen[fp] = (seen[fp] || 0) + 1;
      if ((existing[fp] || 0) >= seen[fp]) { m.dupWhy = 'igual'; dups.push(m); } else news.push(m);
    });
    /* En el efectivo, lo mismo puede estar con otro concepto: el reintegro que
       ING apuntó solo ("Desde ING Nómina · …") o un gasto que ya apuntaste a mano. */
    var src = movs.length ? movs[0].source : null;
    if (src && isCash(src)) {
      var ya = S.state.movements.filter(function (x) { return x.source === src && (x.auto || x.handEntered); });
      var usado = {};
      news = news.filter(function (m) {
        var hit = ya.filter(function (x) {
          return !usado[x.id] && Math.abs(x.amount - m.amount) < 0.005 && Math.abs(S.dayDiff(x.date, m.date)) <= (x.auto ? 3 : 0);
        })[0];
        if (!hit) return true;
        usado[hit.id] = 1;
        m.dupWhy = hit.auto ? 'reintegro' : 'mano';
        dups.push(m);
        return false;
      });
    }
    return { news: news, dups: dups };
  }

  function doImport(all) {
    var a = wiz.analysis;
    var toAdd = all ? a.news.concat(a.dups) : a.news;
    if (!toAdd.length) { toast('No hay nada nuevo que importar.', 'bad'); return; }
    toAdd.forEach(function (m) { delete m.dupWhy; });
    S.state.movements = S.state.movements.concat(toAdd);
    S.state.lastImport = { at: new Date().toISOString(), count: toAdd.length, fileName: wiz.fileName, source: wiz.opts.source };
    // recordar el número de cuenta para que el próximo extracto vaya solo a su sitio
    var cta = S.state.accounts[wiz.opts.source];
    if (wiz.iban && cta && !cta.iban) {
      var yaEsDeOtra = Object.keys(S.state.accounts).some(function (k) { return k !== wiz.opts.source && S.state.accounts[k].iban === wiz.iban; });
      if (!yaEsDeOtra) cta.iban = wiz.iban;
    }
    var par = S.space === 'personal' ? S.pairTransfers() : { paired: 0, mirrored: 0 };
    S.save();
    toast(toAdd.length + ' movimientos importados' +
      (par.paired ? ' · ' + par.paired + ' traspaso' + (par.paired > 1 ? 's' : '') + ' emparejado' + (par.paired > 1 ? 's' : '') : '') +
      (par.mirrored ? ' · ' + par.mirrored + ' apuntado' + (par.mirrored > 1 ? 's' : '') + ' solo' + (par.mirrored > 1 ? 's' : '') + ' en efectivo/inversiones' : '') + '.', 'good');
    resetWizard();
    location.hash = '#/dashboard';
  }

  /* ============================================================
     PÁGINA: AJUSTES
     ============================================================ */
  function pageSettings() {
    var used = 0;
    try { used = (localStorage.getItem(S.KEY) || '').length; } catch (e) { }
    var r = S.rangeOfData();
    var bySource = {};
    S.state.movements.forEach(function (m) { bySource[m.source] = (bySource[m.source] || 0) + 1; });

    var nombre = S.SPACES[S.space].label;
    var html = '<div class="page-head"><div><h1>Ajustes · ' + esc(nombre) + '</h1>' +
      '<div class="sub">Tus datos viven solo en este navegador y en este equipo</div></div></div>';

    html += '<div class="grid g3">' +
      statTile('Movimientos', String(S.state.movements.length), r ? S.fmtDate(r.from) + ' – ' + S.fmtDate(r.to) : 'sin datos', 'var(--s1)') +
      statTile('Espacio usado', (used / 1024).toFixed(0) + ' KB', 'del límite del navegador (~5 MB)', 'var(--s3)') +
      statTile('Cuentas', String(Object.keys(bySource).length || 0), Object.keys(bySource).map(function (k) {
        return (S.state.accounts[k] ? S.state.accounts[k].label : k) + ': ' + bySource[k];
      }).join(' · ') || '—', 'var(--s2)') +
      '</div>';

    html += '<div class="card" style="margin-top:14px"><div class="card-head"><h2>Copia de seguridad</h2>' +
      '<span class="hint">recomendado: descarga el JSON de vez en cuando</span></div>' +
      '<div class="notice">Si borras los datos del navegador o usas otro equipo, los movimientos se pierden. ' +
      'La copia guarda <b>los dos espacios</b>, Casa y Personal (movimientos, reglas, categorías, presupuestos y valoraciones), y se vuelve a cargar aquí.</div>' +
      '<div class="row" style="margin-top:12px">' +
      '<button class="btn primary" data-act="backup-export">⤓ Descargar copia (JSON)</button>' +
      '<label class="btn">⤒ Restaurar copia<input type="file" id="restoreInput" accept=".json,application/json" data-restore hidden></label>' +
      '<button class="btn" data-act="export-csv-all">⤓ Exportar ' + esc(nombre) + ' a CSV</button>' +
      '</div></div>';

    html += '<div class="card"><div class="card-head"><h2>Nombres de las cuentas</h2></div><div class="row">' +
      Object.keys(S.state.accounts).map(function (k) {
        return '<label class="field">' + esc(k) + '<input type="text" data-account="' + k + '" value="' + esc(S.state.accounts[k].label) + '"></label>';
      }).join('') +
      '<label class="field">Movimientos por página<input type="number" min="10" step="10" data-setting="pageSize" value="' + (S.state.settings.pageSize || 50) + '" style="width:110px"></label>' +
      '</div></div>';

    html += installCard();

    html += '<div class="card"><div class="card-head"><h2>Recordatorio de importar</h2>' +
      '<span class="hint">sale en el dashboard y junto a «Importar»</span></div>' +
      '<label class="field remind-days">Avisarme si una cuenta lleva más de' +
      '<span class="row" style="gap:6px;align-items:center"><input type="number" min="7" max="365" step="1" data-remind-days value="' + (S.state.settings.remindDays || 35) + '" style="width:90px"> días sin datos</span></label>' +
      '<div class="row" style="margin-top:12px">' + Object.keys(S.state.accounts).map(function (k) {
        var a = S.state.accounts[k];
        return '<label class="field" style="flex-direction:row;align-items:center;gap:7px"><input type="checkbox" data-remind="' + k + '"' + (a.noRemind ? '' : ' checked') + '> ' + esc(a.label) + '</label>';
      }).join('') + '</div>' +
      '<div class="kv" style="margin-top:8px">Desmarca las cuentas que no uses. Las inversiones avisan cuando la última valoración es vieja; el efectivo, cuando sacas del cajero y no apuntas en qué.</div></div>';

    html += '<div class="card"><div class="card-head"><h2>Zona peligrosa</h2></div>' +
      '<div class="row">' +
      '<button class="btn danger" data-act="wipe-movements">Borrar los movimientos de ' + esc(nombre) + '</button>' +
      '<button class="btn danger" data-act="wipe-all">Borrar TODO ' + esc(nombre) + ' y empezar de cero</button>' +
      '<button class="btn" data-act="reset-rules">Restaurar reglas por defecto</button>' +
      '</div><div class="kv" style="margin-top:8px">Solo afecta a ' + esc(nombre) + '. El otro espacio no se toca.</div></div>';

    view.innerHTML = html;
  }

  /** Ajustes → Esta instalación: versión, si está instalada y cómo instalarla. */
  var WEB_URL = 'https://alexlobar.github.io/MisCuentas/';
  function installCard() {
    var estado;
    if (isInstalled()) {
      estado = '<span class="chip chip-good">✓ Instalada como app</span>';
    } else if (installPrompt) {
      estado = '<button class="btn primary" data-act="install-app">📲 Instalar la app</button>';
    } else if (location.protocol === 'file:') {
      estado = 'Abierta desde el PC (el acceso directo o <code>index.html</code>). Para el móvil, abre <b>' + esc(WEB_URL) + '</b> en Chrome y pulsa <i>Instalar</i>.';
    } else if (isIOS()) {
      estado = 'En iPhone: en Safari, botón <b>Compartir</b> → <b>Añadir a pantalla de inicio</b>.';
    } else {
      estado = 'Cuando el navegador deje instalarla saldrá aquí el botón <b>Instalar</b>. En el móvil, ábrela en Chrome (no desde otra app) y recarga una vez.';
    }
    var t = sizes();
    return '<div class="card"><div class="card-head"><h2>Esta instalación</h2><span class="hint">versión ' + APP_VERSION + ' · ' + kb(t.app + t.datos) + '</span></div>' +
      '<div class="kv" style="margin-bottom:10px">' + estado + '</div>' +
      '<div class="kv" style="margin-bottom:10px">Ocupa <b>' + kb(t.app + t.datos) + '</b>: ' +
        (t.app ? 'el programa ' + kb(t.app) + ' y ' : '') + 'tus datos en este navegador ' + kb(t.datos) + '.</div>' +
      '<div class="kv">Cada dispositivo guarda sus propios datos. Para pasarlos del PC al móvil: aquí arriba, <i>Descargar copia</i> en el PC y <i>Restaurar copia</i> en el móvil.</div></div>';
  }

  /** Lo que ocupa, en bytes: el programa (lo mide preparar-github.ps1 y lo deja en
      data-size de index.html) y los datos de este navegador (los dos espacios y los ajustes). */
  function sizes() {
    var datos = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^(presupuesto-|mis-cuentas\.)/.test(k)) datos += new Blob([k, localStorage.getItem(k) || '']).size;
      }
    } catch (e) { }
    return { app: Number(document.documentElement.getAttribute('data-size')) || 0, datos: datos };
  }
  function kb(bytes) {
    var n = bytes / 1024;
    return n.toLocaleString('es-ES', { maximumFractionDigits: n < 10 ? 1 : 0 }) + ' KB';
  }

  /** Cargar una copia (JSON): desde Ajustes, o en el móvil desde la vista simple. */
  function restoreFromFile(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var data = JSON.parse(fr.result);
        var resumen = S.describeBackup(data);
        if (!resumen) throw new Error('formato');
        confirmBox('Vas a reemplazar tus datos por los de la copia (' + resumen + '). ¿Seguir?', function () {
          var esp = S.importAll(data);
          F = makeFilters();
          renderNav();
          toast('Copia restaurada: ' + esp.map(function (k) { return S.SPACES[k].label; }).join(' y ') + '.', 'good');
          render();
        });
      } catch (e) { toast('Ese fichero no es una copia válida.', 'bad'); }
    };
    fr.readAsText(file);
  }

  /* ---------------- exportaciones ---------------- */
  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function toCSV(list) {
    var head = ['Fecha', 'Fecha valor', 'Origen', 'Concepto', 'Extra', 'Categoría', 'Tipo', 'Importe', 'Saldo', 'Nota', 'Excluido'];
    var rows = list.map(function (m) {
      return [m.date, m.valueDate || '', (S.state.accounts[m.source] || {}).label || m.source, m.concept, m.extra || '',
        m.category || '', S.categoryType(m.category) || '', String(m.amount).replace('.', ','),
        m.balance != null ? String(m.balance).replace('.', ',') : '', m.note || '', m.excluded ? 'sí' : ''];
    });
    return '﻿' + [head].concat(rows).map(function (r) {
      return r.map(function (v) {
        v = String(v == null ? '' : v);
        return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(';');
    }).join('\r\n');
  }

  /* ---------------- selección en tabla ---------------- */
  function selectedIds() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-sel]:checked'))
      .map(function (c) { return c.getAttribute('data-sel'); });
  }
  function refreshBulk() {
    var bar = document.getElementById('bulkBar');
    if (!bar) return;
    var ids = selectedIds();
    bar.style.display = ids.length ? 'flex' : 'none';
    var c = document.getElementById('bulkCount');
    if (c) c.textContent = ids.length + ' seleccionados';
  }
  function getMov(id) {
    for (var i = 0; i < S.state.movements.length; i++) if (S.state.movements[i].id === id) return S.state.movements[i];
    return null;
  }

  /* ---------------- eventos globales ---------------- */
  view.addEventListener('change', function (e) {
    var el = e.target;
    var f = F[currentRoute] || {};

    // filtros de la página
    var fk = el.getAttribute('data-f');
    if (fk) {
      f[fk] = el.value;
      if (fk === 'preset') f.autoPreset = false;
      if (fk === 'preset' || fk === 'from' || fk === 'to' || fk === 'q' || fk === 'category' || fk === 'type' || fk === 'source') f.page = 1;
      if (fk === 'month') F.presupuesto.month = el.value;
      render();
      return;
    }

    // categoría en línea
    var cid = el.getAttribute('data-cat');
    if (cid) {
      var m = getMov(cid);
      if (m) { m.category = el.value; m.manual = true; S.save(); toast('Categoría actualizada.'); }
      return;
    }

    // presupuesto
    var bcat = el.getAttribute('data-budget');
    if (bcat) {
      var v = parseFloat(el.value);
      if (!v || v <= 0) delete S.state.budgets[bcat]; else S.state.budgets[bcat] = v;
      S.save(); render();
      return;
    }

    // reglas
    var rp = el.getAttribute('data-rulepattern');
    if (rp) { updateRule(rp, { pattern: el.value }); return; }
    var rc = el.getAttribute('data-rulecat');
    if (rc) { updateRule(rc, { category: el.value }); return; }
    var rcp = el.getAttribute('data-rulecp');
    if (rcp) { updateRule(rcp, { counterpart: el.value || undefined }); return; }

    // cuentas e inversiones
    var op = el.getAttribute('data-acc-opening');
    if (op) { S.state.accounts[op].opening = parseFloat(el.value) || 0; S.save(); render(); return; }
    var oi = el.getAttribute('data-acc-openinv');
    if (oi) { S.state.accounts[oi].openingInvested = parseFloat(el.value) || 0; S.save(); render(); return; }
    var oid = el.getAttribute('data-acc-openinvdate');
    if (oid) {
      if (el.value) S.state.accounts[oid].openingInvestedDate = el.value; else delete S.state.accounts[oid].openingInvestedDate;
      S.save(); render(); return;
    }
    if (el.hasAttribute('data-restore') && el.files && el.files[0]) { restoreFromFile(el.files[0]); el.value = ''; return; }
    var tf = el.getAttribute('data-trades-file');
    if (tf && el.files && el.files[0]) { readTrades(el.files[0], tf); el.value = ''; return; }
    if (el.hasAttribute('data-remind-days')) {
      var dd = Math.max(7, Math.min(365, parseInt(el.value, 10) || 35));
      S.state.settings.remindDays = dd; el.value = dd; S.save(); updateNavBadge();
      toast('Te aviso a partir de ' + dd + ' días sin datos.'); return;
    }
    var rmd = el.getAttribute('data-remind');
    if (rmd) {
      if (el.checked) delete S.state.accounts[rmd].noRemind; else S.state.accounts[rmd].noRemind = true;
      S.save(); updateNavBadge(); return;
    }
    var vf = el.getAttribute('data-val-file');
    if (vf && el.files && el.files[0]) { readDegiroPortfolio(el.files[0], vf); el.value = ''; return; }
    var da = el.getAttribute('data-degiro-account');
    if (da && el.files && el.files[0]) { readDegiroAccount(el.files[0], da); el.value = ''; return; }
    if (el.hasAttribute('data-cushion-goal')) {
      var meta = Math.max(1, Math.min(36, parseInt(el.value, 10) || 6));
      S.state.settings.cushionMonths = meta; S.save(); render(); return;
    }
    var cf = el.getAttribute('data-catfixed');
    if (cf) {
      var cat = S.getCategory(cf);
      if (cat) { cat.fixed = el.checked; S.save(); toast(cf + (el.checked ? ' cuenta como gasto fijo.' : ' ya no cuenta como fijo.')); }
      return;
    }

    // categorías
    var cn = el.getAttribute('data-catname');
    if (cn) { renameCategory(cn, el.value.trim()); return; }
    var ct = el.getAttribute('data-cattype');
    if (ct) { var c1 = S.getCategory(ct); if (c1) { c1.type = el.value; S.save(); render(); } return; }
    var cc = el.getAttribute('data-catcolor');
    if (cc) { var c2 = S.getCategory(cc); if (c2) { c2.color = el.value; S.save(); render(); } return; }

    // clasificación rápida desde "sin clasificar"
    var qc = el.getAttribute('data-quickcat');
    if (qc && el.value) { quickClassify(qc, el.value); return; }

    // asistente de importación
    var wk = el.getAttribute('data-wiz');
    if (wk) {
      if (wk === 'source') {
        wiz.opts.source = el.value;
        // al pasar a efectivo o a la tarjeta, los importes en positivo son gastos
        if ((isCash(el.value) || el.value === 'carrefour') && !wiz.opts.invert && wiz.table && !wiz.profile) {
          signHeuristic({ opts: { invertIfMostlyPositive: true } });
        }
      }
      else if (wk === 'invert') wiz.opts.invert = el.checked;
      else if (wk === 'allExpense') wiz.opts.allExpense = el.checked;
      else if (wk === 'delim') { ingestText(wiz.text, el.value === 'TAB' ? '\t' : el.value); return; }
      if (wiz.step === 2) pageImport();
      if (wiz.step === 3) { applyMap(); wiz.analysis = analyzeDuplicates(wiz.built.movements); pageImport(); }
      return;
    }
    var mk = el.getAttribute('data-map');
    if (mk) {
      wiz.map[mk] = parseInt(el.value, 10);
      if (mk === 'extra') wiz.map.extras = null;   // el mapeo a mano manda sobre el del perfil
      pageImport();
      return;
    }

    // ajustes
    var acc = el.getAttribute('data-account');
    if (acc) { S.state.accounts[acc].label = el.value || acc; S.save(); render(); return; }
    var st = el.getAttribute('data-setting');
    if (st) { S.state.settings[st] = parseInt(el.value, 10) || 50; S.save(); return; }

    if (el.getAttribute('data-act') === 'sel-all') {
      document.querySelectorAll('[data-sel]').forEach(function (c) { c.checked = el.checked; });
      refreshBulk(); return;
    }
    if (el.hasAttribute('data-sel')) { refreshBulk(); return; }
  });

  view.addEventListener('input', function (e) {
    var el = e.target;
    if (el.getAttribute('data-f') === 'q') {
      clearTimeout(el._t);
      var val = el.value;
      el._t = setTimeout(function () {
        F[currentRoute].q = val; F[currentRoute].page = 1;
        render();
        var box = view.querySelector('[data-f="q"]');
        if (box) { box.focus(); box.setSelectionRange(val.length, val.length); }
      }, 320);
    }
  });

  view.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    var sortTh = e.target.closest('th[data-sort]');
    var f = F[currentRoute] || {};

    if (sortTh) {
      var k = sortTh.getAttribute('data-sort');
      if (f.sort === k) f.dir = f.dir === 'asc' ? 'desc' : 'asc';
      else { f.sort = k; f.dir = k === 'date' ? 'desc' : 'asc'; }
      render();
      return;
    }
    // a qué cuenta va el extracto (cuando hay dos del mismo banco)
    var pick = e.target.closest('[data-acc-pick]');
    if (pick && wiz) {
      wiz.opts.source = pick.getAttribute('data-acc-pick');
      wiz.accBy = 'elegida';
      applyMap();
      wiz.analysis = analyzeDuplicates(wiz.built.movements);
      pageImport();
      return;
    }
    // "Importarlo en Personal/Casa": cambia de espacio y vuelve a leer lo mismo
    var go = e.target.closest('[data-space-go]');
    if (go) {
      var txt = wiz && wiz.text, nom = wiz && wiz.fileName;
      switchSpace(go.getAttribute('data-space-go'));
      if (txt) { resetWizard(); wiz.fileName = nom; ingestText(txt); }
      return;
    }
    if (!btn) return;
    var act = btn.getAttribute('data-act');

    switch (act) {
      case 'clear-filters':
        F[currentRoute] = Object.assign({}, F[currentRoute], { preset: 'all', from: '', to: '', q: '', category: '', type: '', page: 1 });
        render(); break;

      case 'page-prev': f.page = Math.max(1, f.page - 1); render(); break;
      case 'page-next': f.page = f.page + 1; render(); break;

      case 'export-csv': {
        var per = resolvePeriod(f);
        var list = S.filterMovements({ from: per.from, to: per.to, q: f.q, category: f.category || undefined, type: f.type || undefined, source: f.source || undefined });
        download('movimientos.csv', toCSV(list), 'text/csv;charset=utf-8');
        break;
      }
      case 'export-csv-all':
        download('movimientos-completo.csv', toCSV(S.state.movements), 'text/csv;charset=utf-8'); break;

      case 'bulk-apply': {
        var cat = document.getElementById('bulkCat').value;
        if (!cat) { toast('Elige una categoría.', 'bad'); return; }
        selectedIds().forEach(function (id) { var m = getMov(id); if (m) { m.category = cat; m.manual = true; } });
        S.save(); toast('Categoría aplicada.'); render(); break;
      }
      case 'bulk-exclude':
        selectedIds().forEach(function (id) { var m = getMov(id); if (m) m.excluded = true; });
        S.save(); render(); break;
      case 'bulk-include':
        selectedIds().forEach(function (id) { var m = getMov(id); if (m) m.excluded = false; });
        S.save(); render(); break;
      case 'bulk-delete': {
        var ids = selectedIds();
        confirmBox('Vas a eliminar ' + ids.length + ' movimientos. ¿Seguro?', function () {
          S.removeMovements(ids);
          S.save(); toast('Eliminados.'); render();
        });
        break;
      }
      case 'row-menu': rowMenu(btn.getAttribute('data-id')); break;

      case 'reapply': {
        var n = S.reapplyRules(false);
        toast(n + ' movimientos reclasificados.', 'good'); render(); break;
      }
      case 'reapply-force':
        confirmBox('Se van a reclasificar TODOS los movimientos, incluidos los que cambiaste a mano. ¿Seguir?', function () {
          var n2 = S.reapplyRules(true);
          toast(n2 + ' movimientos reclasificados.', 'good'); render();
        });
        break;

      case 'add-rule': {
        var p = document.getElementById('newPattern').value.trim();
        var c = document.getElementById('newCat').value;
        var cpSel = document.getElementById('newCp');
        if (!p) { toast('Escribe al menos una palabra.', 'bad'); return; }
        S.state.rules.forEach(function (r) { r.order = (r.order || 0) + 1; });
        var regla = { id: S.uid(), pattern: p, category: c, enabled: true, order: 0 };
        if (cpSel && cpSel.value) regla.counterpart = cpSel.value;
        S.state.rules.push(regla);
        S.save(); toast('Regla añadida arriba del todo.'); render(); break;
      }
      case 'rule-up': moveRule(btn.getAttribute('data-id'), -1); break;
      case 'rule-down': moveRule(btn.getAttribute('data-id'), 1); break;
      case 'rule-del':
        S.state.rules = S.state.rules.filter(function (r) { return r.id !== btn.getAttribute('data-id'); });
        S.save(); render(); break;

      case 'add-cat': {
        var name = document.getElementById('newCatName').value.trim();
        var type = document.getElementById('newCatType').value;
        if (!name) { toast('Pon un nombre.', 'bad'); return; }
        if (S.getCategory(name)) { toast('Ya existe esa categoría.', 'bad'); return; }
        S.state.categories.push({ name: name, type: type, color: S.SERIES[S.state.categories.length % 8] });
        S.save(); render(); break;
      }
      case 'cat-del': {
        var cname = btn.getAttribute('data-name');
        var used = S.state.movements.filter(function (m) { return m.category === cname; }).length;
        confirmBox('Eliminar «' + cname + '»' + (used ? ' y mover sus ' + used + ' movimientos a «Otros gastos»' : '') + '?', function () {
          S.state.categories = S.state.categories.filter(function (c) { return c.name !== cname; });
          S.state.movements.forEach(function (m) { if (m.category === cname) m.category = 'Otros gastos'; });
          S.state.rules.forEach(function (r) { if (r.category === cname) r.category = 'Otros gastos'; });
          delete S.state.budgets[cname];
          S.save(); render();
        });
        break;
      }

      case 'use-paste': {
        var ta = document.getElementById('pasteArea');
        wiz.fileName = '';
        wiz.sheet = null;
        ingestText(ta.value);
        break;
      }
      case 'wiz-back':
        wiz.step = wiz.step - 1;
        if (wiz.step < 1) wiz.step = 1;
        pageImport(); break;
      case 'wiz-next':
        applyMap();
        wiz.analysis = analyzeDuplicates(wiz.built.movements);
        wiz.step = 3; pageImport(); break;
      case 'wiz-review':
        wiz.step = 2; pageImport(); break;
      case 'wiz-reset':
        resetWizard(); pageImport(); break;
      case 'wiz-import': doImport(false); break;
      case 'wiz-import-all': doImport(true); break;

      case 'backup-export':
        download('mis-cuentas-' + S.todayISO() + '.json', JSON.stringify(S.exportAll(), null, 1), 'application/json');
        toast('Copia descargada con los dos espacios.', 'good');
        break;

      /* ---------- personal: cuentas, valoraciones y traspasos ---------- */
      case 'manual-new': openManual(btn.getAttribute('data-acc')); break;
      case 'pair-now': {
        var pr = S.pairTransfers();
        S.save();
        toast(pr.paired || pr.mirrored
          ? pr.paired + ' emparejados · ' + pr.mirrored + ' apuntados solos'
          : 'No había traspasos nuevos que emparejar.', pr.paired || pr.mirrored ? 'good' : '');
        render(); break;
      }
      case 'val-add': {
        var ak = btn.getAttribute('data-acc');
        var vd = document.getElementById('val-date-' + ak).value;
        var vv = parseFloat(String(document.getElementById('val-value-' + ak).value).replace(',', '.'));
        var vn = document.getElementById('val-note-' + ak).value.trim();
        if (!vd) { toast('Pon la fecha de la valoración.', 'bad'); return; }
        if (!(vv >= 0)) { toast('Pon el valor total en euros.', 'bad'); return; }
        S.state.valuations.push({ id: S.uid(), account: ak, date: vd, value: S.round2(vv), note: vn });
        S.save();
        toast(S.accountLabel(ak) + ' vale ' + S.eur(vv) + ' a ' + S.fmtDate(vd) + '.', 'good');
        render(); break;
      }
      /* ---------- vista simple (móvil) ---------- */
      case 'vista': setVista(btn.getAttribute('data-vista')); window.scrollTo(0, 0); break;
      case 'install-app': installApp(); break;
      case 'install-later': installHidden = true; render(); break;
      case 's-month':
        F.simple.month = S.addMonths(F.simple.month, +btn.getAttribute('data-dir'));
        render(); break;
      case 's-see-month':
        e.preventDefault();
        F.movimientos = Object.assign(F.movimientos, { preset: F.simple.month, from: '', to: '', q: '', category: '', type: '', source: '', page: 1 });
        location.hash = '#/movimientos'; break;
      case 'remind-snooze':
        S.state.settings.remindSnooze = isoPlusDays(S.todayISO(), 7);
        S.save(); toast('Vale, te lo recuerdo dentro de una semana.'); render(); break;
      case 'trades-clear': {
        var tk = btn.getAttribute('data-acc');
        var nt = S.tradesOf(tk).length;
        confirmBox('Se borrarán las ' + nt + ' operaciones de ' + S.accountLabel(tk) + ' (no toca movimientos ni valoraciones). ¿Seguro?', function () {
          S.state.trades = S.state.trades.filter(function (t) { return t.account !== tk; });
          S.save(); toast('Operaciones borradas.'); render();
        });
        break;
      }
      case 'val-del': {
        var vid = btn.getAttribute('data-id');
        S.state.valuations = S.state.valuations.filter(function (v) { return v.id !== vid; });
        S.save(); toast('Valoración borrada.'); render(); break;
      }
      /* ---------- suscripciones y recibos ---------- */
      case 'rec-ignore': {
        var rk = btn.getAttribute('data-key');
        if (S.state.recurringIgnored.indexOf(rk) === -1) S.state.recurringIgnored.push(rk);
        S.save(); toast('Vale: ya no sale como recurrente.'); render(); break;
      }
      case 'rec-unignore': {
        var uk = btn.getAttribute('data-key');
        S.state.recurringIgnored = S.state.recurringIgnored.filter(function (x) { return x !== uk; });
        S.save(); render(); break;
      }
      case 'rec-see': {
        var sk = btn.getAttribute('data-key'), sp = sk.split('|');
        // se busca por la primera palabra del comercio: el concepto puede llevar números en medio
        var palabra = sp.slice(1).join('|').toLowerCase().split(' ')[0];
        F.movimientos = Object.assign(F.movimientos, { source: sp[0], q: palabra, preset: 'all', category: '', type: '', page: 1 });
        location.hash = '#/movimientos'; break;
      }

      case 'see-account':
        e.preventDefault();
        F.movimientos = Object.assign(F.movimientos, { source: btn.getAttribute('data-acc'), page: 1 });
        location.hash = '#/movimientos'; break;
      case 'import-for':
        e.preventDefault();
        // un fichero nuevo para esa cuenta: lo que hubiera a medias se descarta
        resetWizard();
        wiz.opts.source = btn.getAttribute('data-acc');
        if (location.hash === '#/importar') render(); else location.hash = '#/importar';
        break;
      case 'wipe-movements':
        confirmBox('Se borrarán los ' + S.state.movements.length + ' movimientos (las reglas y categorías se mantienen). ¿Seguro?', function () {
          S.state.movements = []; S.state.lastImport = null; S.save(); toast('Movimientos borrados.'); render();
        });
        break;
      case 'wipe-all':
        confirmBox('Se borrará TODO: movimientos, reglas, categorías y presupuestos. ¿Seguro?', function () {
          S.state = S.defaultState(); S.save(); toast('Todo borrado.'); render();
        });
        break;
      case 'reset-rules':
        confirmBox('Se restauran las reglas por defecto y se pierden las tuyas. ¿Seguir?', function () {
          S.state.rules = S.defaultState().rules; S.save(); toast('Reglas restauradas.'); render();
        });
        break;
    }
  });

  document.getElementById('modal').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    if (act === 'modal-cancel' || act === 'modal-close') { closeModal(); pendingConfirm = null; }
    if (act === 'modal-yes') { closeModal(); var fn = pendingConfirm; pendingConfirm = null; if (fn) fn(); }
    if (act === 'note-save') {
      var id = btn.getAttribute('data-id');
      var m = getMov(id);
      if (m) {
        m.note = document.getElementById('noteText').value;
        m.concept = document.getElementById('conceptText').value || m.concept;
        m.excluded = document.getElementById('exclChk').checked;
        m.fp = S.fingerprint(m);
        // ¿has dicho que es un traspaso con otra cuenta tuya?
        var cpSel = document.getElementById('mvCp');
        if (cpSel && !m.pairId && cpSel.value !== (m.counterpart || '')) {
          if (cpSel.value) {
            m.counterpart = cpSel.value;
            delete m.noPair;
            var esInv = S.account(cpSel.value).kind === 'inversion' || S.account(m.source).kind === 'inversion';
            m.category = esInv && S.getCategory('Inversión') ? 'Inversión' : 'Traspaso entre cuentas';
            m.manual = true;
            S.pairTransfers();
          } else {
            delete m.counterpart;
            m.noPair = true;
          }
        }
        S.save();
      }
      closeModal(); render();
    }
    if (act === 'mov-delete') {
      S.removeMovements([btn.getAttribute('data-id')]);
      S.save(); closeModal(); toast('Movimiento eliminado.'); render();
    }
    if (act === 'mov-unpair') {
      S.unpair(btn.getAttribute('data-id'));
      S.save(); closeModal();
      toast('Separados: ya no cuentan como traspaso entre tus cuentas.');
      render();
    }
    if (act === 'manual-save') saveManual();
    if (act === 'degiro-save' && pendingDegiro) {
      var n = pendingDegiro.length;
      S.state.movements = S.state.movements.concat(pendingDegiro);
      pendingDegiro = null;
      S.save(); closeModal();
      toast(n + ' líneas de Degiro añadidas (dividendos, retenciones y comisiones).', 'good');
      render();
    }
    if (act === 'trades-save' && pendingTrades) {
      var nn = pendingTrades.list.length, cta = pendingTrades.account;
      S.state.trades = S.state.trades.concat(pendingTrades.list);
      pendingTrades = null;
      S.save(); closeModal();
      toast(nn + ' operaci' + (nn === 1 ? 'ón añadida' : 'ones añadidas') + ' a ' + S.accountLabel(cta) + '.', 'good');
      if (currentRoute === 'cuentas') render(); else location.hash = '#/cuentas';
    }
    if (act === 'pv-save' && pendingValuation) {
      var fecha = document.getElementById('pv-date').value || S.todayISO();
      S.state.valuations.push({ id: S.uid(), account: pendingValuation.account, date: fecha, value: pendingValuation.value, note: pendingValuation.note });
      S.save(); closeModal();
      toast(S.accountLabel(pendingValuation.account) + ' vale ' + S.eur(pendingValuation.value) + ' a ' + S.fmtDate(fecha) + '.', 'good');
      pendingValuation = null;
      render();
    }
    if (act === 'rule-from-mov') {
      var id3 = btn.getAttribute('data-id');
      var m3 = getMov(id3);
      if (m3) {
        var word = S.merchantOf(m3.concept).toLowerCase();
        S.state.rules.forEach(function (r) { r.order = (r.order || 0) + 1; });
        S.state.rules.push({ id: S.uid(), pattern: word, category: m3.category, enabled: true, order: 0 });
        S.save(); closeModal();
        toast('Regla creada: «' + word + '» → ' + m3.category, 'good');
      }
    }
  });

  // formulario de apuntar a mano: el tipo decide qué categorías y campos se ven
  document.getElementById('modal').addEventListener('change', function (e) {
    if (e.target.id !== 'mn-type') return;
    var tipo = e.target.value;
    var catWrap = document.getElementById('mn-cat-wrap'), toWrap = document.getElementById('mn-to-wrap');
    catWrap.hidden = tipo === 'traspaso';
    toWrap.hidden = tipo !== 'traspaso';
    if (tipo !== 'traspaso') document.getElementById('mn-cat').innerHTML = categoryOptionsOfType(tipo);
  });
  document.getElementById('modal').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && document.getElementById('mn-amount') && e.target.tagName === 'INPUT') { e.preventDefault(); saveManual(); }
  });

  function rowMenu(id) {
    var m = getMov(id);
    if (!m) return;
    modal('<h2>Movimiento</h2>' +
      '<div class="kv" style="margin:6px 0 14px">' + S.fmtDate(m.date) + ' · ' + esc((S.state.accounts[m.source] || {}).label || m.source) +
      ' · <b class="' + (m.amount < 0 ? 'neg' : 'pos') + '">' + S.eur(m.amount) + '</b></div>' +
      '<label class="field">Concepto<input type="text" id="conceptText" value="' + esc(m.concept) + '"></label>' +
      '<label class="field" style="margin-top:10px">Nota<input type="text" id="noteText" value="' + esc(m.note || '') + '" placeholder="p. ej. regalo cumpleaños"></label>' +
      '<label class="field" style="flex-direction:row;align-items:center;gap:8px;margin-top:12px">' +
      '<input type="checkbox" id="exclChk"' + (m.excluded ? ' checked' : '') + '> Excluir de los totales y gráficos</label>' +
      traspasoBlock(m) +
      '<hr class="sep">' +
      '<div class="row" style="justify-content:space-between">' +
      '<div class="row"><button class="btn sm" data-act="rule-from-mov" data-id="' + m.id + '">＋ Crear regla con este comercio</button>' +
      '<button class="btn sm danger" data-act="mov-delete" data-id="' + m.id + '">Eliminar</button></div>' +
      '<div class="row"><button class="btn" data-act="modal-cancel">Cancelar</button>' +
      '<button class="btn primary" data-act="note-save" data-id="' + m.id + '">Guardar</button></div></div>');
  }

  /** En Personal: ver o cambiar si un movimiento es traspaso entre tus cuentas. */
  function traspasoBlock(m) {
    if (S.space !== 'personal') return '';
    if (m.pairId) {
      var p = S.byId(m.pairId);
      return '<div class="notice" style="margin-top:12px">↔ Traspaso con <b>' + esc(S.accountLabel(m.counterpart)) + '</b>' +
        (p ? ' (' + S.fmtDate(p.date) + ' · ' + S.eur(p.amount) + (p.auto ? ', creado solo' : '') + ')' : '') +
        '. No cuenta como gasto. <button class="btn sm" data-act="mov-unpair" data-id="' + m.id + '" style="margin-left:6px">No es un traspaso: separar</button></div>';
    }
    return '<label class="field" style="margin-top:12px">¿Es un traspaso con otra cuenta tuya?' +
      '<select id="mvCp">' + counterpartOptions(m.counterpart || '', m.source).replace('— ninguna —', 'No, es un gasto o ingreso normal') + '</select></label>' +
      '<div class="kv" style="margin-top:4px">Si eliges una cuenta, deja de contar como gasto. En efectivo, Degiro y cripto se apunta solo el otro lado.</div>';
  }

  function updateRule(id, patch) {
    S.state.rules.forEach(function (r) { if (r.id === id) Object.assign(r, patch); });
    S.save();
    toast('Regla guardada. Usa «Reaplicar» para actualizar lo ya importado.');
  }

  function moveRule(id, dir) {
    var rules = S.state.rules.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var i = rules.findIndex(function (r) { return r.id === id; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= rules.length) return;
    var tmp = rules[i]; rules[i] = rules[j]; rules[j] = tmp;
    rules.forEach(function (r, k) { r.order = k; });
    S.save(); render();
  }

  function renameCategory(oldName, newName) {
    if (!newName || newName === oldName) return;
    if (S.getCategory(newName)) { toast('Ya existe una categoría con ese nombre.', 'bad'); render(); return; }
    var c = S.getCategory(oldName);
    if (!c) return;
    c.name = newName;
    S.state.movements.forEach(function (m) { if (m.category === oldName) m.category = newName; });
    S.state.rules.forEach(function (r) { if (r.category === oldName) r.category = newName; });
    if (S.state.budgets[oldName] != null) { S.state.budgets[newName] = S.state.budgets[oldName]; delete S.state.budgets[oldName]; }
    S.save(); render();
  }

  function quickClassify(merchant, category) {
    var pattern = merchant.toLowerCase();
    S.state.rules.forEach(function (r) { r.order = (r.order || 0) + 1; });
    S.state.rules.push({ id: S.uid(), pattern: pattern, category: category, enabled: true, order: 0 });
    var n = 0;
    S.state.movements.forEach(function (m) {
      if (S.merchantOf(m.concept) === merchant) { m.category = category; n++; }
    });
    S.save();
    toast(n + ' movimientos clasificados como «' + category + '» y regla creada.', 'good');
    render();
  }

  /* ---------------- tema y almacenamiento ---------------- */
  function applyTheme() {
    var t = S.getTheme();
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  document.getElementById('themeToggle').addEventListener('click', function () {
    var order = ['auto', 'light', 'dark'];
    var cur = S.getTheme();
    var next = order[(order.indexOf(cur) + 1) % 3];
    S.setTheme(next);
    applyTheme();
    toast('Tema: ' + { auto: 'automático', light: 'claro', dark: 'oscuro' }[next]);
  });

  function updateStorageNote() {
    var n = document.getElementById('storageNote');
    var count = S.state.movements.length;
    var used = 0;
    try { used = (localStorage.getItem(S.KEY) || '').length; } catch (e) { }
    n.textContent = S.SPACES[S.space].label + ': ' + count + ' movimientos · ' + (used / 1024).toFixed(0) + ' KB';
  }

  /* ---------------- arranque ---------------- */
  // ¿el navegador permite guardar aquí? (ventana privada, permisos bloqueados…)
  var canStore = true;
  try { localStorage.setItem('__test', '1'); localStorage.removeItem('__test'); }
  catch (e) { canStore = false; }

  S.load();
  // completa huellas de versiones anteriores
  var dirty = false;
  S.state.movements.forEach(function (m) { if (!m.fp) { m.fp = S.fingerprint(m); dirty = true; } });
  if (dirty) S.save();
  applyTheme();
  currentRoute = (location.hash || '#/dashboard').replace('#/', '').split('?')[0];
  renderNav();
  window.addEventListener('hashchange', router);
  router();
  if (!canStore) {
    toast('Este navegador no deja guardar datos en esta página: lo que importes se perderá al cerrar. Prueba fuera del modo incógnito.', 'bad');
  }

  // instalada como app (desde una web https): funciona sin conexión
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* sin conexión no pasa nada */ });
  }

  global.App = { toast: toast, render: render, esc: esc };
})(window);
