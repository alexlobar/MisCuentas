/* ============================================================
   charts.js — gráficos en SVG, sin librerías externas
   ============================================================ */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var tipEl = null;

  function tip() { if (!tipEl) tipEl = document.getElementById('tooltip'); return tipEl; }

  function showTip(evt, html) {
    var t = tip();
    t.innerHTML = html;
    t.hidden = false;
    var pad = 14, r = t.getBoundingClientRect();
    var x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  }
  function hideTip() { if (tipEl) tipEl.hidden = true; }

  function el(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function rootSvg(w, h) {
    // viewBox + width:100% => escala proporcional, el texto no se deforma
    var s = el('svg', { viewBox: '0 0 ' + w + ' ' + h, class: 'chart', preserveAspectRatio: 'xMidYMid meet' });
    s.style.width = '100%';
    s.style.height = 'auto';
    return s;
  }

  /* Ancho real del hueco donde va el gráfico. Dibujando a ese tamaño la escala
     es 1:1 y las etiquetas de los ejes salen al tamaño que les toca, no encogidas. */
  function anchoDe(container) {
    var w = container.clientWidth || (container.parentNode && container.parentNode.clientWidth) || 900;
    return Math.max(320, Math.round(w));
  }

  /* Camino de barra con extremo redondeado (4px) apoyada en la línea base */
  function barPath(x, y, w, h, r, up) {
    r = Math.min(r, w / 2, Math.abs(h));
    if (h <= 0.5) return '';
    if (up) {
      return 'M' + x + ',' + (y + h) + ' L' + x + ',' + (y + r) +
        ' Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
        ' L' + (x + w - r) + ',' + y + ' Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
        ' L' + (x + w) + ',' + (y + h) + ' Z';
    }
    return 'M' + x + ',' + y + ' L' + x + ',' + (y + h - r) +
      ' Q' + x + ',' + (y + h) + ' ' + (x + r) + ',' + (y + h) +
      ' L' + (x + w - r) + ',' + (y + h) + ' Q' + (x + w) + ',' + (y + h) + ' ' + (x + w) + ',' + (y + h - r) +
      ' L' + (x + w) + ',' + y + ' Z';
  }

  /** Paso "bonito" para un eje: 1, 2, 2,5 o 5 por potencia de 10. */
  function niceStep(raw) {
    if (!(raw > 0)) return 1;
    var exp = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / exp;
    var pasos = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < pasos.length; i++) if (f <= pasos[i]) return pasos[i] * exp;
    return 10 * exp;
  }

  function niceMax(v) {
    if (v <= 0) return 10;
    var exp = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / exp;
    var steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < steps.length; i++) if (f <= steps[i]) return steps[i] * exp;
    return 10 * exp;
  }

  /* ============================================================
     Barras agrupadas por mes. Por defecto ingresos vs gastos:
     data: [{label, income, expense}]. Con opts.series se eligen otras
     series: [{key, name, color}] (p. ej. gasto de Casa vs Personal).
     ============================================================ */
  var SERIES_DEF = [
    { key: 'income', name: 'Ingresos', color: 'var(--s3)' },
    { key: 'expense', name: 'Gastos', color: 'var(--s2)' }
  ];

  function groupedBars(container, data, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!data.length) { container.innerHTML = '<div class="empty">Sin datos en el periodo</div>'; return; }
    var series = opts.series || SERIES_DEF;
    var porDefecto = !opts.series;

    var W = anchoDe(container), H = opts.height || 280;
    var m = { t: 16, r: 12, b: 30, l: 64 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = niceMax(Math.max.apply(null, data.map(function (d) {
      return Math.max.apply(null, series.map(function (s) { return d[s.key] || 0; }));
    })) || 1);
    var svg = rootSvg(W, H);

    // rejilla + eje
    var ticks = 4;
    for (var i = 0; i <= ticks; i++) {
      var v = max * i / ticks, y = m.t + ih - (v / max) * ih;
      svg.appendChild(el('line', { x1: m.l, x2: m.l + iw, y1: y, y2: y, class: i === 0 ? 'baseline' : 'grid-line' }));
      svg.appendChild(el('text', { x: m.l - 8, y: y + 4, class: 'axis-label', 'text-anchor': 'end' }, Store.eur0(v)));
    }

    var slot = iw / data.length;
    var gap = 2;                       // separación de 2px entre barras adyacentes
    var n = series.length;
    // con pocos meses las barras se ensanchan para no perderse en el hueco
    var bw = Math.max(8, Math.min(52, (slot - 24 - gap * (n - 1)) / n));

    data.forEach(function (d, idx) {
      var cx = m.l + slot * idx + slot / 2;
      var x0 = cx - (bw * n + gap * (n - 1)) / 2;
      var tip = '<div class="t-title">' + esc(d.label) + '</div>' + series.map(function (s) {
        return '<div class="t-row"><span>' + esc(s.name) + '</span><b>' + Store.eur(d[s.key] || 0) + '</b></div>';
      }).join('') + (porDefecto ? '<div class="t-row"><span>Balance</span><b>' + Store.eur(d.income - d.expense) + '</b></div>' : '');
      series.forEach(function (s, si) {
        var p = { v: d[s.key] || 0, color: s.color, x: x0 + si * (bw + gap) };
        var h = (p.v / max) * ih;
        if (h > 0.5) {
          var path = el('path', { d: barPath(p.x, m.t + ih - h, bw, h, 4, true), fill: p.color });
          path.style.cursor = 'default';
          path.addEventListener('mousemove', function (e) { showTip(e, tip); });
          path.addEventListener('mouseleave', hideTip);
          svg.appendChild(path);
        }
      });
      // con muchos meses no cabe "Ene 2026": se queda en "Ene", y si aún así
      // se pisan, se pone una etiqueta sí y otra no
      var etiqueta = d.label;
      if (slot < 62) etiqueta = String(d.label).split(' ')[0];
      if (slot < 26 && idx % 2) etiqueta = '';
      if (etiqueta) {
        svg.appendChild(el('text', { x: cx, y: H - 10, class: 'axis-label', 'text-anchor': 'middle' }, etiqueta));
      }
    });

    container.appendChild(svg);
    container.appendChild(legend(series.map(function (s) { return { name: s.name, color: s.color }; })));
  }

  /* ============================================================
     Donut por categoría. items: [{name, value, color}]
     ============================================================ */
  function donut(container, items, opts) {
    opts = opts || {};
    container.innerHTML = '';
    var total = items.reduce(function (a, b) { return a + b.value; }, 0);
    if (!total) { container.innerHTML = '<div class="empty">Sin gastos en el periodo</div>'; return; }

    var size = 230, r = 96, thick = 26, cx = size / 2, cy = size / 2;
    var svg = rootSvg(size, size);
    svg.style.margin = '0 auto';
    svg.style.maxWidth = size + 'px';

    var ang = -Math.PI / 2;
    items.forEach(function (it) {
      var frac = it.value / total;
      var sweep = frac * Math.PI * 2;
      // hueco de 2px entre segmentos (en radianes según el radio)
      var gapA = Math.min(sweep * 0.25, 2 / r);
      var a0 = ang + gapA / 2, a1 = ang + sweep - gapA / 2;
      if (a1 > a0) {
        var p = el('path', {
          d: arcPath(cx, cy, r, r - thick, a0, a1),
          fill: it.color
        });
        p.addEventListener('mousemove', function (e) {
          showTip(e, '<div class="t-title">' + esc(it.name) + '</div>' +
            '<div class="t-row"><span>Importe</span><b>' + Store.eur(it.value) + '</b></div>' +
            '<div class="t-row"><span>Del total</span><b>' + (frac * 100).toFixed(1).replace('.', ',') + ' %</b></div>');
        });
        p.addEventListener('mouseleave', hideTip);
        svg.appendChild(p);
      }
      ang += sweep;
    });

    svg.appendChild(el('text', { x: cx, y: cy - 4, 'text-anchor': 'middle', fill: 'var(--text)', 'font-size': 22, 'font-weight': 660 }, Store.eur0(total)));
    svg.appendChild(el('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 11 }, opts.centerLabel || 'total'));

    container.appendChild(svg);
    container.appendChild(legend(items.map(function (i) {
      return { name: i.name + ' · ' + Store.eur0(i.value), color: i.color };
    })));
  }

  function arcPath(cx, cy, rOut, rIn, a0, a1) {
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    var x0 = cx + rOut * Math.cos(a0), y0 = cy + rOut * Math.sin(a0);
    var x1 = cx + rOut * Math.cos(a1), y1 = cy + rOut * Math.sin(a1);
    var x2 = cx + rIn * Math.cos(a1), y2 = cy + rIn * Math.sin(a1);
    var x3 = cx + rIn * Math.cos(a0), y3 = cy + rIn * Math.sin(a0);
    return 'M' + x0 + ',' + y0 +
      ' A' + rOut + ',' + rOut + ' 0 ' + large + ' 1 ' + x1 + ',' + y1 +
      ' L' + x2 + ',' + y2 +
      ' A' + rIn + ',' + rIn + ' 0 ' + large + ' 0 ' + x3 + ',' + y3 + ' Z';
  }

  /* ============================================================
     Línea (evolución de saldo o de gasto acumulado)
     points: [{x: 'etiqueta', y: número, sub: 'texto'}]
     ============================================================ */
  function line(container, points, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (points.length < 2) { container.innerHTML = '<div class="empty">Hacen falta al menos dos puntos</div>'; return; }

    var W = anchoDe(container), H = opts.height || 240;
    var m = { t: 16, r: 14, b: 28, l: 64 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var ys = points.map(function (p) { return p.y; });
    var maxV = Math.max.apply(null, ys), minV = Math.min.apply(null, ys);
    // Eje en cifras redondas que envuelven los datos (1.000, 2.000…) en vez de
    // valores raros como 15.484 €. Una línea no necesita empezar en cero, y así
    // se ve la evolución; solo si los datos cruzan el cero, el cero entra en el eje.
    var step = niceStep(((maxV - minV) || Math.abs(maxV) || 1) / 4);
    var bot = Math.floor(minV / step) * step, top = Math.ceil(maxV / step) * step;
    if (top === bot) top = bot + step;

    var svg = rootSvg(W, H);

    function Y(v) { return m.t + ih - ((v - bot) / (top - bot)) * ih; }
    function X(i) { return m.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw); }

    for (var v = bot; v <= top + step / 2; v += step) {
      var y = Y(v);
      svg.appendChild(el('line', { x1: m.l, x2: m.l + iw, y1: y, y2: y, class: 'grid-line' }));
      svg.appendChild(el('text', { x: m.l - 8, y: y + 4, class: 'axis-label', 'text-anchor': 'end' }, Store.eur0(v)));
    }
    if (bot < 0 && top > 0) {
      svg.appendChild(el('line', { x1: m.l, x2: m.l + iw, y1: Y(0), y2: Y(0), class: 'baseline' }));
    }

    var d = points.map(function (p, i) { return (i ? 'L' : 'M') + X(i) + ',' + Y(p.y); }).join(' ');
    var area = d + ' L' + X(points.length - 1) + ',' + Y(Math.max(bot, 0)) + ' L' + X(0) + ',' + Y(Math.max(bot, 0)) + ' Z';
    var color = opts.color || 'var(--s1)';

    var grad = el('linearGradient', { id: 'lg' + Math.random().toString(36).slice(2, 7), x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(el('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': .18 }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }));
    var defs = el('defs'); defs.appendChild(grad); svg.appendChild(defs);

    svg.appendChild(el('path', { d: area, fill: 'url(#' + grad.getAttribute('id') + ')' }));
    svg.appendChild(el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

    // etiquetas del eje X: las que quepan sin pisarse (unos 52px cada una)
    var caben = Math.max(3, Math.floor(iw / 52));
    var every = Math.ceil(points.length / caben);
    points.forEach(function (p, i) {
      if (i % every === 0 || i === points.length - 1) {
        svg.appendChild(el('text', { x: X(i), y: H - 7, class: 'axis-label', 'text-anchor': 'middle' }, p.x));
      }
    });

    // capa de hover con línea guía
    var cross = el('line', { y1: m.t, y2: m.t + ih, class: 'grid-line', stroke: 'var(--axis)' });
    cross.style.display = 'none';
    svg.appendChild(cross);
    var dot = el('circle', { r: 4.5, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 });
    dot.style.display = 'none';
    svg.appendChild(dot);

    var hit = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' });
    hit.addEventListener('mousemove', function (e) {
      var box = svg.getBoundingClientRect();
      var px = (e.clientX - box.left) / box.width * W;
      var idx = Math.round((px - m.l) / (iw / (points.length - 1)));
      idx = Math.max(0, Math.min(points.length - 1, idx));
      var p = points[idx];
      cross.setAttribute('x1', X(idx)); cross.setAttribute('x2', X(idx));
      cross.style.display = '';
      dot.setAttribute('cx', X(idx)); dot.setAttribute('cy', Y(p.y));
      dot.style.display = '';
      showTip(e, '<div class="t-title">' + esc(p.label || p.x) + '</div>' +
        '<div class="t-row"><span>' + (opts.valueLabel || 'Saldo') + '</span><b>' + Store.eur(p.y) + '</b></div>' +
        (p.sub ? '<div class="t-row"><span>' + esc(p.sub) + '</span></div>' : ''));
    });
    hit.addEventListener('mouseleave', function () { hideTip(); cross.style.display = 'none'; dot.style.display = 'none'; });
    svg.appendChild(hit);

    container.appendChild(svg);
  }

  function legend(items) {
    var d = document.createElement('div');
    d.className = 'legend';
    items.forEach(function (i) {
      var s = document.createElement('span');
      s.className = 'item';
      s.innerHTML = '<span class="swatch" style="background:' + i.color + '"></span>' + esc(i.name);
      d.appendChild(s);
    });
    return d;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  global.Charts = { groupedBars: groupedBars, donut: donut, line: line, legend: legend, hideTip: hideTip };
})(window);
