const CACHE = "page1-v10-static-1";

const CORE = [
  "./",
  "./index.html",
  "./book/",
  "./book/index.html",
  "./staff/",
  "./staff/index.html",
  "./assets/css/site.css",
  "./assets/css/booking.css",
  "./assets/css/staff.css",
  "./assets/js/config.js",
  "./assets/js/api.js",
  "./assets/js/site.js",
  "./assets/js/booking.js",
  "./assets/js/staff.js",
  "./assets/images/page1-logo.png",
  "./assets/images/icon-192.png",
  "./assets/images/icon-512.png",
  "./manifest.json"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(CORE))
  );
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>
      Promise.all(
        keys
          .filter(key=>key!==CACHE)
          .map(key=>caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  const request = event.request;

  if(request.method !== "GET") return;

  const url = new URL(request.url);

  if(url.origin !== location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,copy));
        return response;
      })
      .catch(()=>caches.match(request))
  );
});
