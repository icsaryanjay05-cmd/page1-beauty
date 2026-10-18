const CACHE = "page1-v10-5-4-container-layout";

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
  "./assets/css/v10-3.css",
  "./assets/css/v10-4.css",
  "./assets/css/v10-5.css",
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
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;

  const url=new URL(request.url);
  if(url.origin!==location.origin)return;

  // Never cache the API configuration. This prevents an old Apps Script URL
  // from being trapped in the PWA cache after the user edits config.js.
  if(url.pathname.endsWith("/assets/js/config.js")){
    event.respondWith(fetch(request,{cache:"no-store"}));
    return;
  }

  // HTML and JavaScript are network-first so GitHub updates appear quickly.
  const dynamic = request.mode==="navigate" || /\.(?:js|html)$/.test(url.pathname);
  if(dynamic){
    event.respondWith(
      fetch(request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(request,copy));
          return response;
        })
        .catch(()=>caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached=>cached||fetch(request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(request,copy));
      return response;
    }))
  );
});
