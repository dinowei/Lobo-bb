// Service worker mínimo: deixa o app instalável e abrir sem internet (a casca do site).
// Páginas: rede primeiro, cópia guardada se cair. /api nunca passa pelo cache (dados sempre frescos;
// respostas offline vão para a fila do próprio app).
const CACHE = "lobo-v2"; // v2: ícone novo (Lobo Binho)

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icones/icone-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // arquivos com hash no nome (/assets/): cache primeiro; o resto: rede primeiro
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => guardar(e.request, resp))));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((resp) => guardar(e.request, resp))
      .catch(() => caches.match(e.request).then((r) => r || (e.request.mode === "navigate" ? caches.match("/") : undefined)))
  );
});

function guardar(req, resp) {
  if (resp.ok) {
    const copia = resp.clone();
    caches.open(CACHE).then((c) => c.put(req, copia));
  }
  return resp;
}
