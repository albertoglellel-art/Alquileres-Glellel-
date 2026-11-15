var CACHE_NAME = 'alquileres-v12';
var ASSETS = [
  './',
  './index.html',
  './style.css?v=12',
  './app.js?v=12',
  './firebase-config.js?v=12',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  // No interceptar pedidos a otros dominios (ej. api.github.com con el token, o los datos de Firestore).
  // Excepcion: las librerias de Firebase, para que la app abra aunque no haya senal.
  var origen = new URL(event.request.url).origin;
  if (origen !== self.location.origin && origen !== 'https://www.gstatic.com') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).then(function (response) {
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
      }
      return response;
    }).catch(function () {
      return caches.match(event.request);
    })
  );
});
