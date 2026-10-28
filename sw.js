/* ============================================================
   sw.js — para que la app instalada funcione sin conexión.
   Guarda los ficheros de la app (no tus datos: esos están en el
   almacenamiento del navegador y nunca pasan por aquí).
   Con conexión coge siempre la versión nueva; sin ella, la guardada.
   ============================================================ */
// la misma versión que APP_VERSION (js/app.js) y data-build (index.html)
var VERSION = 'mis-cuentas-1.0.3';
// todas las apps de alexlobar.github.io comparten el almacén de cachés: al actualizar, sólo se borran las de esta app
var PREFIJO = 'mis-cuentas-';
var FICHEROS = [
  './', 'index.html', 'manifest.webmanifest',
  'css/styles.css',
  'js/store.js', 'js/xlsx.js', 'js/parse.js', 'js/charts.js', 'js/app.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  // 'reload' salta la caché HTTP del navegador (GitHub Pages da 10 min): sin esto, una
  // versión subida poco después de la anterior podía guardar ficheros de la vieja.
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(FICHEROS.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf(PREFIJO) === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    // 'no-cache': pregunta al servidor si el fichero ha cambiado, para no coger
    // uno viejo de la caché HTTP en los 10 minutos después de publicar
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) { var copia = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copia); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
    })
  );
});
