const CACHE = "nvc-saga-1"
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", "/index.html"])))
  self.skipWaiting()
})
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/ws") || url.pathname.startsWith("/api")) return
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match("/"))),
  )
})
