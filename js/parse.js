/* ============================================================
   parse.js — lectura de ficheros (CSV/TXT/XLS-HTML) y pegado
   desde Excel, detección de columnas, fechas e importes.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- Lectura del fichero con detección de codificación ----------
     readBook devuelve las hojas: [{ name, text }]. Un CSV es una sola hoja;
     de un .xlsx sale una por pestaña, con las celdas separadas por tabuladores. */
  function readBook(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('No se pudo leer el fichero.')); };
      fr.onload = function () { resolve(new Uint8Array(fr.result)); };
      fr.readAsArrayBuffer(file);
    }).then(bytesToBook);
  }

  function bytesToBook(buf) {
    if (buf[0] === 0x50 && buf[1] === 0x4b) {
      return global.Xlsx.read(buf).then(function (hojas) {
        hojas = hojas.filter(function (h) { return h.rows.length; });
        if (!hojas.length) throw new Error('El Excel no tiene ninguna hoja con datos.');
        return hojas.map(function (h) {
          return { name: h.name, text: h.rows.map(function (r) { return r.join('\t'); }).join('\n') };
        });
      });
    }
    if (buf[0] === 0xd0 && buf[1] === 0xcf) {
      throw new Error('Es un .xls del Excel antiguo. Ábrelo en Excel y guárdalo como .xlsx o CSV, o copia las celdas y pégalas en el cuadro de texto.');
    }
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
      throw new Error('Es un PDF. Exporta el extracto en CSV/Excel desde la web del banco, o copia el texto y pégalo.');
    }
    return [{ name: '', text: decode(buf) }];
  }

  /** Con varias hojas, la que tiene más filas con datos (la tabla, no el resumen). */
  function bestSheet(hojas) {
    var mejor = hojas[0], max = -1;
    hojas.forEach(function (h) {
      var n = h.text.split('\n').filter(function (l) { return l.split('\t').filter(function (v) { return v.trim() !== ''; }).length >= 2; }).length;
      if (n > max) { max = n; mejor = h; }
    });
    return mejor;
  }

  function readFile(file) {
    return readBook(file).then(function (hojas) { return bestSheet(hojas).text; });
  }

  function decode(buf) {
    // UTF-8 con BOM
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      return new TextDecoder('utf-8').decode(buf.subarray(3));
    }
    var utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    // Si aparecen caracteres de reemplazo, casi seguro es Windows-1252 (habitual en bancos)
    if (utf8.indexOf('�') !== -1) {
      try { return new TextDecoder('windows-1252').decode(buf); } catch (e) { /* noop */ }
    }
    return utf8;
  }

  /* ---------- Detección de separador ---------- */
  function detectDelimiter(text) {
    var sample = text.split(/\r?\n/).slice(0, 40).join('\n');
    var cands = [';', '\t', ',', '|'];
    var best = ';', bestScore = -1;
    cands.forEach(function (d) {
      var counts = sample.split(/\r?\n/).map(function (l) { return countOutsideQuotes(l, d); })
        .filter(function (c) { return c > 0; });
      if (!counts.length) return;
      /* Gana el separador que más veces aparece EN LA MISMA CANTIDAD por fila:
         eso es la tabla. (Antes se castigaba la variación, y en un extracto con
         pocos movimientos las filas de título —con un solo ";"— hacían ganar
         a la coma de los importes, "300,00", y el fichero se leía roto.) */
      var veces = {};
      counts.forEach(function (c) { veces[c] = (veces[c] || 0) + 1; });
      var score = 0;
      Object.keys(veces).forEach(function (c) { score = Math.max(score, +c * veces[c]); });
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  }

  function countOutsideQuotes(line, d) {
    var n = 0, q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') q = !q;
      else if (c === d && !q) n++;
    }
    return n;
  }

  /* ---------- Parser CSV/TSV ---------- */
  function parseDelimited(text, delim) {
    delim = delim || detectDelimiter(text);
    var rows = [], row = [], field = '', q = false, i = 0;
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    while (i < text.length) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { q = true; i++; continue; }
      if (c === delim) { row.push(field); field = ''; i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return { rows: rows.map(function (r) { return r.map(function (v) { return String(v).trim(); }); }), delimiter: delim };
  }

  /* ---------- Tablas HTML (algunos "xls" del banco son HTML) ---------- */
  function parseHtmlTable(text) {
    var doc = new DOMParser().parseFromString(text, 'text/html');
    var tables = Array.prototype.slice.call(doc.querySelectorAll('table'));
    if (!tables.length) return null;
    // la tabla con más filas
    tables.sort(function (a, b) { return b.rows.length - a.rows.length; });
    var t = tables[0], rows = [];
    for (var i = 0; i < t.rows.length; i++) {
      var cells = [];
      for (var j = 0; j < t.rows[i].cells.length; j++) {
        cells.push(t.rows[i].cells[j].textContent.replace(/ /g, ' ').trim());
      }
      rows.push(cells);
    }
    return { rows: rows, delimiter: 'html' };
  }

  function looksLikeHtml(text) {
    return /<\s*table/i.test(text.slice(0, 20000));
  }

  /** Punto de entrada: texto -> { rows, delimiter } */
  function parseText(text, delim) {
    if (!delim && looksLikeHtml(text)) {
      var h = parseHtmlTable(text);
      if (h) return h;
    }
    return parseDelimited(text, delim);
  }

  /* ---------- Localizar fila de cabecera ----------
     Los extractos del banco traen filas de título/saldo antes de la tabla. */
  var HEADER_HINTS = ['fecha', 'concepto', 'descripcion', 'descripción', 'importe', 'saldo', 'movimiento',
    'categoria', 'categoría', 'subcategoria', 'subcategoría', 'f. valor', 'valor', 'debe', 'haber',
    'operacion', 'operación', 'comercio', 'detalle', 'referencia', 'divisa',
    // extractos en inglés (Revolut, Degiro)
    'date', 'description', 'amount', 'balance', 'currency', 'state', 'product', 'producto', 'cantidad'];

  function findHeaderRow(rows) {
    var bestIdx = 0, bestScore = -1;
    var limit = Math.min(rows.length, 30);
    for (var i = 0; i < limit; i++) {
      var r = rows[i];
      var nonEmpty = r.filter(function (v) { return v !== ''; }).length;
      if (nonEmpty < 2) continue;
      var hits = 0;
      r.forEach(function (v) {
        var n = Store.normalize(v);
        HEADER_HINTS.forEach(function (h) { if (n && n.indexOf(Store.normalize(h)) !== -1) hits++; });
      });
      // penaliza filas que ya parecen datos (con fechas o importes)
      var dataish = r.filter(function (v) { return parseDate(v) || parseAmount(v) !== null; }).length;
      var score = hits * 3 + nonEmpty - dataish * 2;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    return bestScore >= 3 ? bestIdx : -1; // -1 => no hay cabecera fiable
  }

  /** Divide en { headers, data } saltando filas vacías o de relleno. */
  function tabulate(rows) {
    var hIdx = findHeaderRow(rows);
    var headers, data;
    if (hIdx >= 0) {
      headers = rows[hIdx].map(function (h, i) { return h || 'Columna ' + (i + 1); });
      data = rows.slice(hIdx + 1);
    } else {
      // sin cabecera fiable: el ancho es el que más se repite, no el máximo,
      // porque alguna fila puede traer celdas de más
      var width = moda(rows.map(function (r) { return r.length; }));
      headers = [];
      for (var i = 0; i < width; i++) headers.push('Columna ' + (i + 1));
      data = rows.slice();
    }
    // OJO: aquí no se recortan las filas largas. Las celdas de más se arreglan
    // después, en repairRows(), que ya sabe qué columna es el concepto.
    data = data.filter(function (r) {
      return r.some(function (v) { return v !== ''; });
    });
    return { headers: headers, data: data, headerRow: hIdx, width: headers.length };
  }

  function moda(nums) {
    var c = {}, best = 0, bestN = 0;
    nums.forEach(function (n) { if (n > 1) { c[n] = (c[n] || 0) + 1; } });
    Object.keys(c).forEach(function (k) { if (c[k] > bestN) { bestN = c[k]; best = +k; } });
    return best || Math.max.apply(null, nums.concat([1]));
  }

  /* ---------- Filas descuadradas ----------
     Pasa cuando el concepto lleva un ';' sin comillas: la celda se parte en dos
     y todo lo que viene detrás se corre una columna. Se vuelve a juntar lo
     sobrante y se comprueba que fecha e importe caigan donde deben. */
  function rowLooksValid(r, map) {
    if (map.date >= 0 && !parseDate(r[map.date])) return false;
    if (map.amount >= 0 && parseAmount(r[map.amount]) === null) return false;
    if (map.balance >= 0 && r[map.balance] !== '' && parseAmount(r[map.balance]) === null) return false;
    return true;
  }

  function mergeAt(row, idx, extra, width) {
    var r = row.slice();
    var piezas = r.slice(idx, idx + extra + 1).filter(function (v) { return v !== ''; });
    r.splice(idx, extra + 1, piezas.join(' '));
    return r.slice(0, width);
  }

  /** Devuelve { data, fixed, broken } con todas las filas del ancho correcto. */
  function repairRows(data, map, width) {
    var fixed = 0, broken = 0;
    var out = data.map(function (row) {
      if (row.length === width) return row;
      if (row.length < width) {
        var r = row.slice();
        while (r.length < width) r.push('');
        return r;
      }
      var extra = row.length - width;
      // se prueba a fusionar primero en el concepto, luego en las demás columnas
      var orden = [];
      if (map.concept >= 0) orden.push(map.concept);
      (map.extras || []).forEach(function (i) { if (orden.indexOf(i) === -1) orden.push(i); });
      for (var i = 0; i < width; i++) if (orden.indexOf(i) === -1) orden.push(i);

      for (var k = 0; k < orden.length; k++) {
        var cand = mergeAt(row, orden[k], extra, width);
        if (rowLooksValid(cand, map)) { fixed++; return cand; }
      }
      broken++;
      return mergeAt(row, map.concept >= 0 ? map.concept : 0, extra, width);
    });
    return { data: out, fixed: fixed, broken: broken };
  }

  /* ---------- Importes ---------- */
  function parseAmount(v) {
    if (v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim();
    if (!s) return null;
    s = s.replace(/[€$£\s ]/g, '').replace(/EUR/gi, '');
    if (!/\d/.test(s)) return null;
    if (!/^[\d.,+\-()]+$/.test(s)) return null;
    var neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/-$/.test(s)) { neg = true; s = s.replace(/-+$/, ''); }
    if (/^-/.test(s)) { neg = true; s = s.replace(/^-+/, ''); }
    s = s.replace(/^\+/, '');
    var lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > -1 && ld > -1) {
      if (lc > ld) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (lc > -1) {
      var after = s.length - lc - 1;
      if (after === 3 && /^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
      else s = s.replace(',', '.');
    } else if (ld > -1) {
      var afterD = s.length - ld - 1;
      if (afterD === 3 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    }
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    return neg ? -Math.abs(n) : n;
  }

  /* ---------- Fechas ---------- */
  var MES_TXT = {
    ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
    may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
    sep: 9, sept: 9, septiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11,
    dic: 12, diciembre: 12
  };

  function pad(n) { return String(n).padStart(2, '0'); }

  function parseDate(v) {
    if (v == null) return null;
    if (v instanceof Date) return v.getFullYear() + '-' + pad(v.getMonth() + 1) + '-' + pad(v.getDate());
    var s = String(v).trim();
    if (!s) return null;
    var m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) {
      return iso(+m[1], +m[2], +m[3]);
    }
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))) {
      var y = +m[3]; if (y < 100) y += 2000;
      return iso(y, +m[2], +m[1]);
    }
    if ((m = s.match(/^(\d{1,2})\s*(?:de\s*)?([a-zA-ZáéíóúÁÉÍÓÚ.]+)\.?\s*(?:de\s*)?(\d{2,4})?/))) {
      var mes = MES_TXT[Store.normalize(m[2]).replace('.', '')];
      if (mes) {
        var yy = m[3] ? +m[3] : new Date().getFullYear();
        if (yy < 100) yy += 2000;
        return iso(yy, mes, +m[1]);
      }
    }
    // Número de serie de Excel
    if (/^\d{5}$/.test(s)) {
      var d = new Date(Date.UTC(1899, 11, 30) + (+s) * 86400000);
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    return null;
  }

  function iso(y, m, d) {
    if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return null;
    return y + '-' + pad(m) + '-' + pad(d);
  }

  /* ============================================================
     PERFILES: plantillas de columnas de los extractos conocidos.
     Si el fichero encaja con uno, la importación no pregunta nada.
     ============================================================ */
  var PROFILES = [
    {
      id: 'ing',
      label: 'ING · extracto de cuenta',
      source: 'ing',
      width: 7,
      // A=F.Valor B=Categoría C=Subcategoría D=Descripción E=Comentario F=Importe G=Saldo
      columns: ['Fecha valor', 'Categoría', 'Subcategoría', 'Descripción', 'Comentario', 'Importe', 'Saldo'],
      map: { date: 0, valueDate: 0, concept: 3, extras: [1, 2, 4], extra: -1, amount: 5, debit: -1, credit: -1, balance: 6 },
      opts: {}
    },
    {
      id: 'carrefour',
      label: 'Tarjeta Carrefour · extracto',
      source: 'carrefour',
      width: 5,
      // A=Fecha B=Concepto C=Modo de pago D=Cargo/abono E=Tarjeta
      columns: ['Fecha', 'Concepto', 'Modo de pago', 'Cargo/abono', 'Tarjeta'],
      map: { date: 0, valueDate: -1, concept: 1, extras: [2, 4], extra: -1, amount: 3, debit: -1, credit: -1, balance: -1 },
      // en la tarjeta el cargo viene en positivo: se le da la vuelta al signo
      opts: { invertIfMostlyPositive: true }
    },
    {
      id: 'revolut',
      label: 'Revolut · extracto',
      source: 'revolut',
      /* Revolut cambia el orden y el idioma de las columnas según la versión
         de la app, así que aquí se buscan por nombre y no por posición. */
      byHeader: {
        date:      ['started date', 'fecha de inicio', 'fecha inicio'],
        valueDate: ['completed date', 'fecha de finalizacion', 'fecha de finalización', 'fecha completada', 'fecha de realizacion'],
        concept:   ['description', 'descripcion', 'descripción'],
        amount:    ['amount', 'importe', 'cantidad'],
        fee:       ['fee', 'comision', 'comisión', 'tarifa'],
        currency:  ['currency', 'divisa', 'moneda'],
        state:     ['state', 'estado'],
        balance:   ['balance', 'saldo'],
        type:      ['type', 'tipo'],
        product:   ['product', 'producto']
      },
      need: ['date', 'concept', 'amount', 'state'],
      opts: {}
    }
  ];

  /** Para los perfiles que se leen por nombre de columna (Revolut). */
  function resolveByHeader(p, headers) {
    var norm = headers.map(function (h) { return Store.normalize(h); });
    var map = { date: -1, valueDate: -1, concept: -1, extra: -1, extras: [], amount: -1, debit: -1, credit: -1,
      balance: -1, fee: -1, currency: -1, state: -1 };
    var found = 0;
    Object.keys(p.byHeader).forEach(function (campo) {
      var nombres = p.byHeader[campo].map(function (n) { return Store.normalize(n); });
      var idx = -1;
      norm.forEach(function (h, i) { if (idx < 0 && nombres.indexOf(h) !== -1) idx = i; });
      if (idx < 0) return;
      found++;
      if (campo === 'type' || campo === 'product') map.extras.push(idx);
      else map[campo] = idx;
    });
    var completo = p.need.every(function (c) { return map[c] >= 0; });
    return { map: map, found: found, complete: completo };
  }

  /** ¿El fichero encaja con algún perfil? -> { profile, score, reason, map } o null */
  function detectProfile(headers, data, width) {
    var mejor = null;
    PROFILES.forEach(function (p) {
      var score = 0, motivos = [];

      if (p.byHeader) {
        var res = resolveByHeader(p, headers);
        if (!res.complete) return;
        score = res.found * 2;
        motivos.push(res.found + ' columnas reconocidas por su nombre');
        var mu = data.slice(0, 40), okF = 0, okI = 0;
        mu.forEach(function (r) {
          if (parseDate(r[res.map.date])) okF++;
          if (parseAmount(r[res.map.amount]) !== null) okI++;
        });
        if (mu.length && Math.min(okF, okI) / mu.length >= 0.8) { score += 6; motivos.push('fecha e importe en su sitio'); }
        if (score >= 9 && (!mejor || score > mejor.score)) mejor = { profile: p, score: score, reason: motivos.join(', '), map: res.map };
        return;
      }

      // 1) coincidencia de nombres de cabecera
      var aciertos = 0;
      p.columns.forEach(function (c, i) {
        var h = Store.normalize(headers[i] || '');
        var esperado = Store.normalize(c);
        if (!h) return;
        var corta = esperado.split(' ')[0];
        if (h.indexOf(esperado) !== -1 || esperado.indexOf(h) !== -1 || (corta.length > 3 && h.indexOf(corta) !== -1)) aciertos++;
      });
      if (aciertos >= 3) { score += aciertos * 2; motivos.push(aciertos + ' cabeceras'); }

      // 2) el ancho coincide
      if (width === p.width) { score += 3; motivos.push('7 columnas'.replace('7', p.width)); }

      // 3) el contenido cae donde debe (fecha e importe) en la mayoría de filas
      var muestra = data.filter(function (r) { return r.length >= p.width; }).slice(0, 40);
      if (muestra.length) {
        var okFecha = 0, okImporte = 0;
        muestra.forEach(function (r) {
          if (parseDate(r[p.map.date])) okFecha++;
          if (parseAmount(r[p.map.amount]) !== null) okImporte++;
        });
        var ratio = Math.min(okFecha, okImporte) / muestra.length;
        if (ratio >= 0.8) { score += 6; motivos.push('fecha e importe en su sitio'); }
        else if (ratio >= 0.5) { score += 2; }
        else { score -= 6; }
        if (p.map.balance >= 0) {
          var okSaldo = 0;
          muestra.forEach(function (r) { if (parseAmount(r[p.map.balance]) !== null) okSaldo++; });
          if (okSaldo / muestra.length >= 0.8) { score += 2; motivos.push('columna de saldo'); }
        }
      }

      if (score >= 9 && (!mejor || score > mejor.score)) {
        mejor = { profile: p, score: score, reason: motivos.join(', '), map: profileMap(p) };
      }
    });
    return mejor;
  }

  /** Copia del mapeo del perfil (para no tocar la plantilla al editarlo). */
  function profileMap(p, headers) {
    if (p.byHeader) return resolveByHeader(p, headers || []).map;
    var m = {};
    Object.keys(p.map).forEach(function (k) {
      m[k] = Array.isArray(p.map[k]) ? p.map[k].slice() : p.map[k];
    });
    return m;
  }

  /* ---------- Auto-mapeo de columnas ---------- */
  var FIELD_HINTS = {
    date:    ['fecha', 'fecha operacion', 'fecha operación', 'f. operacion', 'fecha de la operacion', 'fecha compra', 'dia'],
    valueDate: ['f. valor', 'fecha valor', 'valor'],
    concept: ['descripcion', 'descripción', 'concepto', 'movimiento', 'detalle', 'comercio', 'establecimiento', 'operacion', 'operación', 'referencia'],
    extra:   ['comentario', 'observaciones', 'nota', 'mas datos', 'más datos', 'subcategoria', 'subcategoría', 'categoria', 'categoría'],
    amount:  ['importe', 'importe (€)', 'importe eur', 'cantidad', 'cargo/abono', 'importe operacion', 'importe operación'],
    debit:   ['debe', 'cargo', 'gasto', 'pagos'],
    credit:  ['haber', 'abono', 'ingreso', 'cobros'],
    balance: ['saldo', 'saldo (€)', 'saldo posterior']
  };

  /** ¿Qué parte de una columna son nombres de tus categorías? (0 a 1) */
  function categoryRatio(data, i) {
    if (i < 0) return 0;
    var vals = data.slice(0, 60).map(function (r) { return r[i] || ''; }).filter(Boolean);
    if (!vals.length) return 0;
    return vals.filter(function (v) { return !!findCategory(v); }).length / vals.length;
  }
  /** La categoría tuya que se llama así (sin mirar mayúsculas ni tildes). */
  function findCategory(name) {
    var n = Store.normalize(name);
    if (!n) return null;
    var c = Store.state.categories.filter(function (x) { return Store.normalize(x.name) === n; })[0];
    return c ? c.name : null;
  }

  function guessMapping(headers, data) {
    var map = { date: -1, valueDate: -1, concept: -1, extra: -1, extras: null, amount: -1, debit: -1, credit: -1, balance: -1, category: -1 };
    var used = {};

    Object.keys(FIELD_HINTS).forEach(function (field) {
      var best = -1, bestLen = -1;
      headers.forEach(function (h, i) {
        if (used[i]) return;
        var n = Store.normalize(h);
        if (!n) return;
        FIELD_HINTS[field].forEach(function (hint) {
          var hn = Store.normalize(hint);
          if (n === hn || n.indexOf(hn) === 0 || n.indexOf(hn) !== -1) {
            if (hn.length > bestLen) { bestLen = hn.length; best = i; }
          }
        });
      });
      if (best >= 0) { map[field] = best; used[best] = true; }
    });

    var sample = data.slice(0, 25);

    /* El nombre puede mentir (una columna "Valor" que en realidad son importes):
       si el contenido no encaja con lo que se le ha asignado, se suelta. */
    function ratio(i, fn) {
      if (i < 0) return 0;
      var vals = sample.filter(function (r) { return (r[i] || '') !== ''; });
      if (!vals.length) return 0;
      return vals.filter(function (r) { return fn(r[i]); }).length / vals.length;
    }
    var esFecha = function (v) { return !!parseDate(v); };
    var esImporte = function (v) { return parseAmount(v) !== null; };
    if (ratio(map.valueDate, esFecha) < 0.6) { used[map.valueDate] = false; map.valueDate = -1; }
    if (ratio(map.date, esFecha) < 0.6) { used[map.date] = false; map.date = -1; }
    if (ratio(map.amount, esImporte) < 0.6) { used[map.amount] = false; map.amount = -1; }
    if (ratio(map.balance, esImporte) < 0.6) { used[map.balance] = false; map.balance = -1; }

    // Refuerzo por contenido si falta lo esencial
    if (map.date < 0) {
      map.date = bestColumn(headers, sample, function (v) { return parseDate(v) ? 1 : 0; });
    }
    if (map.amount < 0 && map.debit < 0 && map.credit < 0) {
      // columna numérica con más variedad de signo/decimales que no sea saldo
      var cand = -1, candScore = -1;
      headers.forEach(function (h, i) {
        if (i === map.balance || i === map.date || i === map.valueDate) return;
        var vals = sample.map(function (r) { return parseAmount(r[i]); }).filter(function (x) { return x !== null; });
        if (vals.length < Math.max(2, sample.length * 0.6)) return;
        var negs = vals.filter(function (x) { return x < 0; }).length;
        var score = vals.length + negs * 2;
        if (score > candScore) { candScore = score; cand = i; }
      });
      if (cand >= 0) map.amount = cand;
    }
    if (map.concept < 0) {
      map.concept = bestColumn(headers, sample, function (v) {
        return (v && isNaN(parseFloat(v)) && !parseDate(v) && v.length > 4) ? v.length : 0;
      });
    }
    /* Una columna "Categoría" con tus mismas categorías (típico de un Excel
       propio, como el del efectivo) se respeta tal cual en vez de adivinar. */
    var mejorCat = -1, mejorRatio = 0;
    headers.forEach(function (h, i) {
      if (i === map.date || i === map.amount || i === map.concept) return;
      var r = categoryRatio(data, i);
      if (r > mejorRatio) { mejorRatio = r; mejorCat = i; }
    });
    if (mejorRatio >= 0.5) {
      map.category = mejorCat;
      if (map.extra === mejorCat) map.extra = -1;
    }
    return map;
  }

  function bestColumn(headers, sample, scorer) {
    var best = -1, bestScore = 0;
    headers.forEach(function (h, i) {
      var s = 0;
      sample.forEach(function (r) { s += scorer(r[i] || ''); });
      if (s > bestScore) { bestScore = s; best = i; }
    });
    return best;
  }

  /** Construye los movimientos a partir de datos + mapeo. */
  var ESTADOS_OK = ['completed', 'completado', 'completada', 'completa', 'realizado', 'realizada'];

  function buildMovements(data, map, opts) {
    opts = opts || {};
    var out = [], skipped = 0, skippedState = 0, otraDivisa = 0;
    data.forEach(function (r) {
      var date = parseDate(r[map.date]);
      if (!date) { skipped++; return; }
      // Revolut: solo cuenta lo completado (no lo revertido, rechazado ni pendiente)
      if (map.state >= 0) {
        var st = Store.normalize(r[map.state]);
        if (st && ESTADOS_OK.indexOf(st) === -1) { skippedState++; return; }
      }
      var amount = null;
      if (map.amount >= 0) amount = parseAmount(r[map.amount]);
      if (amount === null && (map.debit >= 0 || map.credit >= 0)) {
        var d = map.debit >= 0 ? parseAmount(r[map.debit]) : null;
        var c = map.credit >= 0 ? parseAmount(r[map.credit]) : null;
        if (d !== null && d !== 0) amount = -Math.abs(d);
        else if (c !== null && c !== 0) amount = Math.abs(c);
      }
      if (amount === null) { skipped++; return; }
      /* La comisión va como gasto aparte: así un reintegro de 40 € con 1,50 € de
         comisión suma 40 € al efectivo, y los 1,50 € cuentan como comisión. */
      var fee = map.fee >= 0 ? Math.abs(parseAmount(r[map.fee]) || 0) : 0;
      if (opts.invert) amount = -amount;
      if (opts.allExpense) amount = -Math.abs(amount);

      var concept = map.concept >= 0 ? String(r[map.concept] || '').replace(/\s+/g, ' ').trim() : '';
      var extraParts = [];
      var extraCols = (map.extras && map.extras.length) ? map.extras : (map.extra >= 0 ? [map.extra] : []);
      extraCols.forEach(function (i) {
        var v = i >= 0 && r[i] ? String(r[i]).replace(/\s+/g, ' ').trim() : '';
        if (v && extraParts.indexOf(v) === -1) extraParts.push(v);
      });
      var m = {
        id: Store.uid(),
        source: opts.source || 'ing',
        date: date,
        valueDate: map.valueDate >= 0 ? parseDate(r[map.valueDate]) : null,
        concept: concept || '(sin concepto)',
        extra: extraParts.join(' · '),
        amount: Math.round(amount * 100) / 100,
        balance: map.balance >= 0 ? parseAmount(r[map.balance]) : null,
        category: null,
        manual: false,
        note: '',
        excluded: false,
        importedAt: new Date().toISOString()
      };
      // en otra moneda: se guarda, pero fuera de los totales hasta que lo revises
      if (map.currency >= 0) {
        var cur = String(r[map.currency] || '').trim().toUpperCase();
        if (cur && cur !== 'EUR') {
          m.currency = cur;
          m.excluded = true;
          m.note = 'En ' + cur + ': revisa el importe en euros antes de incluirlo';
          otraDivisa++;
        }
      }
      Store.classify(m);
      // la categoría que traiga el propio fichero manda (si es una de las tuyas)
      if (map.category >= 0) {
        var propia = findCategory(r[map.category]);
        if (propia) {
          m.category = propia;
          m.manual = true;
          if (Store.categoryType(propia) !== 'traspaso') delete m.counterpart;
        }
      }
      if (fee > 0) {
        // el saldo del extracto ya lleva la comisión restada: el movimiento
        // principal queda con el saldo de antes de cobrarla
        var saldo = m.balance;
        if (saldo != null) m.balance = Math.round((saldo + fee) * 100) / 100;
        var com = Object.assign({}, m, {
          id: Store.uid(), concept: 'Comisión', extra: m.extra, amount: -Math.round(fee * 100) / 100,
          balance: saldo, note: 'De: ' + m.concept
        });
        delete com.counterpart;
        com.category = Store.getCategory('Comisiones') ? 'Comisiones' : (Store.getCategory('Comisiones bancarias') ? 'Comisiones bancarias' : 'Otros gastos');
        com.fp = Store.fingerprint(com);
        m.fp = Store.fingerprint(m);
        out.push(m, com);
        return;
      }
      m.fp = Store.fingerprint(m);
      out.push(m);
    });
    return { movements: out, skipped: skipped, skippedState: skippedState, otherCurrency: otraDivisa };
  }

  /* ---------- IBAN de la cabecera del extracto ----------
     Sirve para saber, con dos cuentas del mismo banco, a cuál va el fichero. */
  function extractIban(text) {
    var m = String(text || '').slice(0, 4000).match(/\bES\d{2}(?:[ -]?\d{4}){5}\b/i);
    return m ? m[0].replace(/[ -]/g, '').toUpperCase() : null;
  }

  /* ---------- Estado de cuenta de Degiro (Account.csv) ----------
     Solo interesa lo que no son aportaciones: dividendos, su retención,
     comisiones e intereses. Compras, ventas e ingresos se saltan (lo aportado
     ya sale de ING/Revolut). */
  function clasificaDegiro(desc) {
    var d = Store.normalize(desc);
    if (/retencion|impuesto sobre (el )?dividendo|dividend tax|withholding/.test(d)) return 'retencion';
    if (/dividendo|dividend/.test(d)) return 'dividendo';
    if (/cambio de divisa|fx (credit|debit|withdrawal|deposit)|currency exchange/.test(d)) return null;
    if (/coste|comision|fee|conectividad|connection/.test(d)) return 'comision';
    if (/interes|interest/.test(d)) return 'interes';
    return null;    // compra, venta, ingreso, retirada, traspasos de efectivo…
  }

  function parseDegiroAccount(text) {
    var filas = parseText(text).rows.filter(function (r) { return r.some(function (v) { return v !== ''; }); });
    if (filas.length < 2) return null;
    var cab = filas[0].map(function (h) { return Store.normalize(h); });
    function col(re) { for (var i = 0; i < cab.length; i++) if (re.test(cab[i])) return i; return -1; }
    var cFecha = col(/^fecha$|^date$/), cProd = col(/^producto$|^product$/), cDesc = col(/descripcion|description/);
    var cVar = col(/variacion|change/);
    if (cFecha < 0 || cDesc < 0 || cVar < 0) return null;
    var out = [], saltadas = 0;
    filas.slice(1).forEach(function (r) {
      var tipo = clasificaDegiro(r[cDesc]);
      var fecha = parseDate(r[cFecha]);
      if (!tipo || !fecha) { saltadas++; return; }
      // "Variación" ocupa dos columnas: la moneda y el importe
      var importe = null, moneda = 'EUR';
      [r[cVar], r[cVar + 1]].forEach(function (v) {
        var n = parseAmount(v);
        if (n !== null && importe === null) importe = n;
        else if (v && /^[A-Z]{3}$/.test(String(v).trim())) moneda = String(v).trim();
      });
      if (importe === null) { saltadas++; return; }
      out.push({ date: fecha, product: cProd >= 0 ? r[cProd] : '', desc: r[cDesc], amount: importe, currency: moneda, kind: tipo });
    });
    return { rows: out, skipped: saltadas };
  }

  /* ---------- Cartera de Degiro (Portfolio.csv) ----------
     Suma la columna "Valor en EUR" (incluye el efectivo que tengas dentro de
     Degiro). Si no la encuentra, usa el último número de cada fila. */
  function parseDegiroPortfolio(text) {
    var filas = parseText(text).rows.filter(function (r) { return r.some(function (v) { return v !== ''; }); });
    if (filas.length < 2) return null;
    var cab = filas[0].map(function (h) { return Store.normalize(h); });
    var col = -1;
    cab.forEach(function (h, i) { if (/valor en eur|value in eur|valor eur|eur value/.test(h)) col = i; });
    var lineas = [], total = 0;
    filas.slice(1).forEach(function (r) {
      var v = col >= 0 ? parseAmount(r[col]) : null;
      if (v === null) {
        for (var i = r.length - 1; i >= 1; i--) { var x = parseAmount(r[i]); if (x !== null) { v = x; break; } }
      }
      if (v === null) return;
      lineas.push({ product: r[0] || '(sin nombre)', value: v });
      total += v;
    });
    if (!lineas.length) return null;
    return { total: Math.round(total * 100) / 100, lines: lineas, column: col >= 0 ? filas[0][col] : null };
  }

  /* ---------- Operaciones de compra y venta (Degiro) ----------
     Vale tu Excel (Fecha, Compra/Venta, Símbolo, Cantidad, Comisiones, %,
     Tipo de cambio, Precio en €, Precio en $, Total) y también el
     Transactions.csv que exporta Degiro. Las columnas se buscan por su nombre;
     si no hay cabecera, se leen en ese orden (A a J). */
  var TRADE_POS = { date: 0, side: 1, symbol: 2, qty: 3, fee: 4, pct: 5, fx: 6, priceEur: 7, priceOrig: 8, total: 9 };

  function tradeColumn(h) {
    var n = Store.normalize(h);
    if (!n) return null;
    if (/^fecha|^date$|^dia$/.test(n)) return 'date';
    if (/^hora$|^time$/.test(n)) return null;
    if (/%|porcentaje/.test(n)) return 'pct';
    if (/tipo de cambio|^cambio|exchange rate|^fx|^t\/?c$/.test(n)) return 'fx';
    if (/comisi|gastos|costes|fees?\b|corretaje/.test(n)) return 'fee';
    if (/valor local|local value/.test(n)) return null;
    if (/precio|price|cotizacion/.test(n)) {
      if (/usd|\$|dolar|dollar|origen|divisa|local/.test(n)) return 'priceOrig';
      if (/eur|€/.test(n)) return 'priceEur';
      return 'price';
    }
    if (/^valor$|^value$|valor en eur|value in eur/.test(n)) return 'value';
    if (/total|importe|amount/.test(n)) return 'total';
    if (/cantidad|acciones|^numero$|^number$|titulos|participaciones|unidades|shares|quantity|^qty$/.test(n)) return 'qty';
    if (/compra|venta|operacion|^tipo|c\/v|^movimiento|^side$|buy|sell/.test(n)) return 'side';
    if (/simbolo|ticker|accion|empresa|producto|product|nombre|activo|isin|stock|^valor /.test(n)) return 'symbol';
    return null;
  }

  function tradeHeader(rows) {
    var best = null;
    rows.slice(0, 30).forEach(function (r, i) {
      var cols = {};
      r.forEach(function (h, j) {
        var t = tradeColumn(h);
        if (t && cols[t] === undefined) cols[t] = j;
      });
      var n = Object.keys(cols).length;
      if (cols.date === undefined || cols.qty === undefined || cols.symbol === undefined) return;
      if (!best || n > best.n) best = { row: i, cols: cols, n: n };
    });
    if (!best) return null;
    var c = best.cols;
    // un "Precio" sin moneda: en euros si no hay otro en euros ni columna de valor en euros
    if (c.price !== undefined) {
      if (c.priceEur === undefined && c.value === undefined) c.priceEur = c.price;
      else if (c.priceOrig === undefined) c.priceOrig = c.price;
      delete c.price;
    }
    return best;
  }

  function parseTrades(text) {
    var filas = parseText(text).rows.filter(function (r) { return r.some(function (v) { return v !== ''; }); });
    if (!filas.length) return null;
    var cab = tradeHeader(filas), cols, datos, modo, cabecera = null;
    if (cab) {
      cols = cab.cols; datos = filas.slice(cab.row + 1); cabecera = filas[cab.row];
      modo = cols.value !== undefined && cols.side === undefined ? 'degiro' : 'cabecera';
    } else {
      // sin cabecera: el orden que usas en tu Excel, si fecha y cantidad caen en su sitio
      var ok = filas.slice(0, 20).filter(function (r) { return parseDate(r[0]) && parseAmount(r[3]) !== null; }).length;
      if (ok < Math.max(1, Math.min(20, filas.length) * 0.6)) return null;
      cols = TRADE_POS; datos = filas; modo = 'posicion';
    }
    function cell(r, k) { return cols[k] === undefined ? '' : r[cols[k]]; }
    function num(r, k) { var v = parseAmount(cell(r, k)); return v === null ? null : v; }
    var monedaCab = cabecera && cols.priceOrig !== undefined && /usd|\$|dolar|dollar/.test(Store.normalize(cabecera[cols.priceOrig])) ? 'USD' : null;

    var out = [], saltadas = 0, ladoAdivinado = 0;
    datos.forEach(function (r) {
      var date = parseDate(cell(r, 'date'));
      var qtyRaw = num(r, 'qty');
      var symbol = String(cell(r, 'symbol') || '').replace(/\s+/g, ' ').trim();
      if (!date || !qtyRaw || !symbol) { saltadas++; return; }
      var value = num(r, 'value'), total = num(r, 'total');
      var lado = Store.normalize(cell(r, 'side')), side = null;
      if (/compra|buy|^c$|^b$/.test(lado)) side = 'buy';
      else if (/venta|sell|^v$|^s$/.test(lado)) side = 'sell';
      if (!side) {
        // sin columna de compra/venta: lo dice el signo (en Degiro, la venta va en negativo)
        side = qtyRaw < 0 || (value !== null && value > 0) ? 'sell' : 'buy';
        if (modo !== 'degiro') ladoAdivinado++;
      }
      var qty = Math.abs(qtyRaw);
      var fee = Math.abs(num(r, 'fee') || 0);
      var pEur = num(r, 'priceEur'), pOrig = num(r, 'priceOrig'), fx = num(r, 'fx');
      var gross = null;
      if (value !== null && value !== 0) gross = Math.abs(value);
      else if (pEur) gross = qty * Math.abs(pEur);
      else if (pOrig && fx) gross = qty * Math.abs(pOrig) / (fx >= 1 ? fx : 1 / fx);
      // solo el total: se entiende que ya lleva la comisión (lo que salió o entró de verdad)
      else if (total) gross = Math.abs(total) + (side === 'buy' ? -fee : fee);
      if (!(gross > 0)) { saltadas++; return; }
      var moneda = monedaCab;
      if (!moneda && cols.priceOrig !== undefined) {
        var junto = String(r[cols.priceOrig + 1] || '').trim();
        if (/^[A-Z]{3}$/.test(junto)) moneda = junto;
      }
      out.push({
        date: date, side: side, symbol: symbol, qty: qty,
        gross: Math.round(gross * 100) / 100, fee: Math.round(fee * 100) / 100,
        priceEur: gross / qty, priceOrig: pOrig !== null ? Math.abs(pOrig) : null,
        currency: pOrig !== null && moneda && moneda !== 'EUR' ? moneda : null, fx: fx
      });
    });
    if (!out.length) return null;
    return { rows: out, skipped: saltadas, mode: modo, sideGuessed: ladoAdivinado,
      columns: Object.keys(cols).filter(function (k) { return k !== 'pct'; }) };
  }

  global.Parse = {
    readFile: readFile,
    readBook: readBook,
    bytesToBook: bytesToBook,
    bestSheet: bestSheet,
    parseTrades: parseTrades,
    findCategory: findCategory,
    parseText: parseText,
    parseDelimited: parseDelimited,
    detectDelimiter: detectDelimiter,
    tabulate: tabulate,
    parseAmount: parseAmount,
    parseDate: parseDate,
    guessMapping: guessMapping,
    buildMovements: buildMovements,
    PROFILES: PROFILES,
    detectProfile: detectProfile,
    profileMap: profileMap,
    repairRows: repairRows,
    parseDegiroPortfolio: parseDegiroPortfolio,
    parseDegiroAccount: parseDegiroAccount,
    extractIban: extractIban
  };
})(window);
