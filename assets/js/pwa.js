(function(){
  if(!("serviceWorker" in navigator)) return;

  window.addEventListener("load",()=>{
    const sw =
      document.documentElement.dataset.sw ||
      "./service-worker.js";

    navigator.serviceWorker
      .register(sw)
      .catch(error=>{
        console.warn(
          "PAGE.1 service worker was not registered:",
          error
        );
      });
  });
})();