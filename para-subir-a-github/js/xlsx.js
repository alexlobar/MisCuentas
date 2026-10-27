/* ============================================================
   xlsx.js — lector mínimo de Excel (.xlsx) sin librerías.
   Un .xlsx es un ZIP con XML dentro: se descomprime con el propio
   navegador (DecompressionStream) y se leen las celdas.
   Todo pasa aquí dentro: el fichero no sale del equipo.
   ============================================================ */
(function (global) {
  'use strict';

  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  /* ---------- ZIP ----------
     Se lee el directorio central (al final del fichero): ahí están el nombre,
     el tamaño comprimido y dónde empieza cada fichero de dentro. */
  function zipIndex(buf) {
    var fin = -1;
    for (var i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
      if (u32(buf, i) === 0x06054b50) { fin = i; break; }
    }
    if (fin < 0) throw new Error('El .xlsx parece dañado: no se puede abrir.');
    var n = u16(buf, fin + 10), off = u32(buf, fin + 16), out = {};
    var dec = new TextDecoder('utf-8');
    for (var k = 0; k < n && off + 46 <= buf.length && u32(buf, off) === 0x02014b50; k++) {
      var nl = u16(buf, off + 28), xl = u16(buf, off + 30), cl = u16(buf, off + 32);
      out[dec.decode(buf.subarray(off + 46, off + 46 + nl))] = {
        method: u16(buf, off + 10), size: u32(buf, off + 20), offset: u32(buf, off + 42)
      };
      off += 46 + nl + xl + cl;
    }
    return out;
  }

  function unzip(buf, e) {
    var ini = e.offset + 30 + u16(buf, e.offset + 26) + u16(buf, e.offset + 28);
    var datos = buf.subarray(ini, ini + e.size);
    if (e.method === 0) return Promise.resolve(new TextDecoder('utf-8').decode(datos));
    if (e.method !== 8) return Promise.reject(new Error('Este .xlsx usa una compresión que no sé abrir. Guárdalo como CSV.'));
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('Este navegador no sabe abrir .xlsx. Usa Edge o Chrome actualizados, o guárdalo como CSV.'));
    }
    var flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(flujo).text();
  }

  /* ---------- XML ---------- */
  function xml(text) { return text ? new DOMParser().parseFromString(text, 'application/xml') : null; }
  // por nombre local: hay Excel que escriben <x:row> en vez de <row>
  function tags(node, name) { return node ? Array.prototype.slice.call(node.getElementsByTagNameNS('*', name)) : []; }
  function hijos(node, name) {
    return Array.prototype.filter.call(node.childNodes, function (n) { return n.localName === name; });
  }
  function attrLocal(el, local) {
    for (var i = 0; i < el.attributes.length; i++) if (el.attributes[i].localName === local) return el.attributes[i].value;
    return null;
  }
  /** Texto de una cadena compartida (con o sin formato enriquecido; sin la fonética). */
  function texto(si) {
    return tags(si, 't').filter(function (t) { return !t.parentNode || t.parentNode.localName !== 'rPh'; })
      .map(function (t) { return t.textContent; }).join('');
  }

  /* ---------- Fechas ----------
     En Excel una fecha es un número (días desde 1900) con formato de fecha.
     Se mira el formato de cada estilo para saber qué números son fechas. */
  function estilosFecha(st) {
    if (!st) return [];
    var propios = {};
    tags(st, 'numFmt').forEach(function (f) { propios[f.getAttribute('numFmtId')] = f.getAttribute('formatCode') || ''; });
    var xfs = tags(st, 'cellXfs')[0];
    if (!xfs) return [];
    return hijos(xfs, 'xf').map(function (xf) {
      var id = +xf.getAttribute('numFmtId') || 0;
      if ((id >= 14 && id <= 17) || id === 22 || (id >= 27 && id <= 36) || (id >= 50 && id <= 58)) return true;
      var c = propios[id];
      if (!c) return false;
      c = c.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
      return !/general|standard/i.test(c) && /[dy]/i.test(c);
    });
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function serialToIso(n, base1904) {
    var d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n + (base1904 ? 1462 : 0)) * 86400000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  /* Los números salen con punto decimal. "1.085" (un tipo de cambio) se leería
     como mil ochenta y cinco, así que se le añade un cero: "1.0850". */
  function numStr(n) {
    if (Number.isInteger(n)) return String(n);
    var s = String(Math.round(n * 1e10) / 1e10);
    if (/e/i.test(s)) s = n.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
    if (/^-?\d{1,3}\.\d{3}$/.test(s)) s += '0';
    return s;
  }

  function colIndex(ref) {
    var m = /^([A-Z]+)/i.exec(ref || '');
    if (!m) return -1;
    var n = 0, l = m[1].toUpperCase();
    for (var i = 0; i < l.length; i++) n = n * 26 + (l.charCodeAt(i) - 64);
    return n - 1;
  }

  function valor(c, strings, fechas, base1904) {
    var t = c.getAttribute('t'), vEl = hijos(c, 'v')[0], isEl = hijos(c, 'is')[0];
    var v = vEl ? vEl.textContent : '';
    if (t === 's') return strings[+v] || '';
    if (t === 'inlineStr') return isEl ? texto(isEl) : v;
    if (t === 'str') return v;
    if (t === 'b') return v === '1' ? 'VERDADERO' : 'FALSO';
    if (t === 'e') return '';
    if (t === 'd') return v.slice(0, 10);
    if (v === '') return '';
    var n = +v;
    if (!isFinite(n)) return v;
    if (fechas[+c.getAttribute('s') || 0]) return serialToIso(n, base1904);
    return numStr(n);
  }

  function filas(doc, strings, fechas, base1904) {
    var out = [], ancho = 0;
    tags(doc, 'row').forEach(function (row) {
      var r = [], sig = 0;
      hijos(row, 'c').forEach(function (c) {
        var i = colIndex(c.getAttribute('r'));
        if (i < 0) i = sig;
        sig = i + 1;
        while (r.length < i) r.push('');
        r[i] = String(valor(c, strings, fechas, base1904)).replace(/[\t\r\n]+/g, ' ').trim();
      });
      while (r.length && r[r.length - 1] === '') r.pop();
      if (r.length) { out.push(r); if (r.length > ancho) ancho = r.length; }
    });
    // todas las filas con el mismo ancho: así el separador se detecta sin dudas
    out.forEach(function (r) { while (r.length < ancho) r.push(''); });
    return out;
  }

  /** Lee un .xlsx -> Promise<[{ name, rows }]> (una entrada por hoja). */
  function read(bytes) {
    var buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var idx;
    try { idx = zipIndex(buf); } catch (e) { return Promise.reject(e); }
    if (!idx['xl/workbook.xml']) return Promise.reject(new Error('Ese fichero comprimido no es un Excel (.xlsx).'));
    function get(n) { return idx[n] ? unzip(buf, idx[n]) : Promise.resolve(null); }
    return Promise.all([get('xl/workbook.xml'), get('xl/_rels/workbook.xml.rels'), get('xl/sharedStrings.xml'), get('xl/styles.xml')])
      .then(function (r) {
        var wb = xml(r[0]), rels = xml(r[1]), ss = xml(r[2]), st = xml(r[3]);
        var strings = tags(ss, 'si').map(texto);
        var fechas = estilosFecha(st);
        var base1904 = tags(wb, 'workbookPr').some(function (p) {
          var v = p.getAttribute('date1904'); return v === '1' || v === 'true';
        });
        var destino = {};
        tags(rels, 'Relationship').forEach(function (x) { destino[x.getAttribute('Id')] = x.getAttribute('Target') || ''; });
        var hojas = tags(wb, 'sheet').map(function (s) {
          var t = destino[attrLocal(s, 'id')] || '';
          var ruta = t.charAt(0) === '/' ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
          return { name: s.getAttribute('name') || '', path: ruta };
        }).filter(function (h) { return idx[h.path]; });
        return Promise.all(hojas.map(function (h) { return get(h.path); })).then(function (xs) {
          return hojas.map(function (h, i) { return { name: h.name, rows: filas(xml(xs[i]), strings, fechas, base1904) }; });
        });
      });
  }

  global.Xlsx = { read: read, numStr: numStr, serialToIso: serialToIso };
})(window);
