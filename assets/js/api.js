/*
PAGE.1 Standalone API Client V10

Why this transport exists:
The frontend is hosted as a normal static website, not inside Apps Script.
This module preserves the familiar google.script.run calling style used by
the existing PAGE.1 frontend, but sends requests to the Apps Script backend
through a hidden form/iframe bridge.

This avoids tying the frontend to Apps Script HTML Service and avoids
cross-origin fetch/preflight problems for write operations.
*/

(function(){
  "use strict";

  const pending = new Map();

  function randomId(prefix){
    const c = window.crypto;
    if(c && c.randomUUID){
      return prefix + c.randomUUID().replace(/-/g,"");
    }
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function apiUrl(){
    const configured =
      window.PAGE1_CONFIG &&
      String(window.PAGE1_CONFIG.API_URL || "").trim();

    const saved =
      String(localStorage.getItem("PAGE1_API_URL") || "").trim();

    const url =
      configured &&
      !configured.includes("PASTE_YOUR_")
        ? configured
        : saved;

    if(!url){
      throw new Error(
        "PAGE.1 API URL is not configured. Open setup.html or edit assets/js/config.js."
      );
    }

    if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(url)){
      console.warn("PAGE.1: API URL does not look like a deployed Apps Script /exec URL.");
    }

    return url;
  }

  function cleanup(requestId){
    const p = pending.get(requestId);
    if(!p) return;

    clearTimeout(p.timer);

    try{
      p.form && p.form.remove();
      p.iframe && p.iframe.remove();
    }catch(e){}

    pending.delete(requestId);
  }

  window.addEventListener("message", function(event){
    const data = event.data;

    if(
      !data ||
      data.__page1Api !== true ||
      !data.requestId
    ){
      return;
    }

    const p = pending.get(data.requestId);
    if(!p) return;

    if(data.nonce !== p.nonce){
      return;
    }

    cleanup(data.requestId);

    if(data.ok){
      p.resolve(data.result);
    }else{
      const error = new Error(
        data.error ||
        "PAGE.1 backend request failed."
      );
      error.code = data.code || "API_ERROR";
      p.reject(error);
    }
  });

  function call(action,args){
    return new Promise((resolve,reject)=>{
      let url;

      try{
        url = apiUrl();
      }catch(error){
        reject(error);
        return;
      }

      const requestId = randomId("req_");
      const nonce = randomId("nonce_");
      const frameName = randomId("page1_frame_");

      const iframe = document.createElement("iframe");
      iframe.name = frameName;
      iframe.setAttribute("aria-hidden","true");
      iframe.tabIndex = -1;
      iframe.style.display = "none";

      const form = document.createElement("form");
      form.method = "POST";
      form.action = url;
      form.target = frameName;
      form.style.display = "none";
      form.acceptCharset = "UTF-8";

      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "payload";
      input.value = JSON.stringify({
        action:String(action || ""),
        args:Array.isArray(args) ? args : [],
        requestId,
        nonce,
        origin:location.origin
      });

      form.appendChild(input);

      const timeout =
        Number(
          window.PAGE1_CONFIG &&
          window.PAGE1_CONFIG.API_TIMEOUT_MS
        ) || 60000;

      const timer = setTimeout(()=>{
        cleanup(requestId);
        reject(
          new Error(
            "PAGE.1 server did not respond in time. Check your internet connection and Apps Script deployment."
          )
        );
      },timeout);

      pending.set(requestId,{
        resolve,
        reject,
        iframe,
        form,
        timer,
        nonce
      });

      document.body.appendChild(iframe);
      document.body.appendChild(form);

      try{
        form.submit();
      }catch(error){
        cleanup(requestId);
        reject(error);
      }
    });
  }

  function makeRunner(successHandler,failureHandler){
    return new Proxy({},{
      get(_target,prop){
        if(prop === "withSuccessHandler"){
          return fn =>
            makeRunner(
              typeof fn === "function" ? fn : null,
              failureHandler
            );
        }

        if(prop === "withFailureHandler"){
          return fn =>
            makeRunner(
              successHandler,
              typeof fn === "function" ? fn : null
            );
        }

        if(prop === "then"){
          return undefined;
        }

        return function(...args){
          call(String(prop),args)
            .then(result=>{
              if(successHandler){
                successHandler(result);
              }
            })
            .catch(error=>{
              if(failureHandler){
                failureHandler(error);
              }else{
                console.error(
                  "PAGE.1 API error:",
                  error
                );
              }
            });
        };
      }
    });
  }

  window.PAGE1_API = {
    call,
    getUrl:apiUrl,
    setUrl(url){
      localStorage.setItem(
        "PAGE1_API_URL",
        String(url || "").trim()
      );
    },
    clearSavedUrl(){
      localStorage.removeItem(
        "PAGE1_API_URL"
      );
    }
  };

  window.google = window.google || {};
  window.google.script = window.google.script || {};

  Object.defineProperty(
    window.google.script,
    "run",
    {
      configurable:true,
      get(){
        return makeRunner(null,null);
      }
    }
  );
})();
