/* ============================================================
   sw.js — para que la app instalada funcione sin conexión.
   Guarda los ficheros de la app (no tus datos: esos están en el
   almacenamiento del navegador y nunca pasan por aquí).
   Con conexión coge siempre la versión nueva; sin ella, la guardada.
   ============================================================ */
// la misma versión que APP_VERSION (js/app.js) y data-build (index.html)
var VERSION = 'mis-cuentas-1.0.1';
var FICHEROS = [
  './', 'index.html', 'manifest.webmanifest',
  'css/styles.css',
  'js/store.js', 'js/xlsx.js', 'js/parse.js', 'js/charts.js', 'js/app.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FICHEROS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) { var copia = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copia); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
    })
  );
});
