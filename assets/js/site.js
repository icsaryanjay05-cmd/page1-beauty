let siteData={services:[],staff:[],settings:{}};
let activeCategory="All";

const $=id=>document.getElementById(id);

window.addEventListener("DOMContentLoaded",()=>{
  initNavigation();
  initScrollEffects();
  initRevealObserver();
  initHeroParallax();
});

window.addEventListener("load",()=>{
  google.script.run
    .withSuccessHandler(data=>{
      siteData=data||siteData;
      renderSite();
      window.setTimeout(()=>$("loading")?.classList.add("hide"),220);
    })
    .withFailureHandler(e=>{
      $("loading")?.classList.add("hide");
      alert(e&&e.message?e.message:String(e));
    })
    .publicWebsiteInit();
});

function initNavigation(){
  const btn=$("menuToggle");
  const links=$("navLinks");
  if(!btn||!links)return;

  btn.addEventListener("click",()=>{
    const open=!links.classList.contains("open");
    links.classList.toggle("open",open);
    btn.classList.toggle("active",open);
    btn.setAttribute("aria-expanded",String(open));
    document.body.classList.toggle("menu-open",open);
  });

  links.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{
    links.classList.remove("open");
    btn.classList.remove("active");
    btn.setAttribute("aria-expanded","false");
    document.body.classList.remove("menu-open");
  }));
}

function initScrollEffects(){
  const header=$("siteHeader");
  const progress=$("scrollProgress");

  const update=()=>{
    const y=window.scrollY||0;
    header?.classList.toggle("scrolled",y>22);

    if(progress){
      const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
      progress.style.width=Math.min(100,(y/max)*100)+"%";
    }
  };

  update();
  window.addEventListener("scroll",update,{passive:true});
}

function initRevealObserver(){
  if(!("IntersectionObserver" in window)){
    document.querySelectorAll(".reveal").forEach(x=>x.classList.add("is-visible"));
    return;
  }

  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },{threshold:.12,rootMargin:"0px 0px -35px 0px"});

  document.querySelectorAll(".reveal").forEach(el=>{
    const delay=Number(el.dataset.delay||0);
    el.style.setProperty("--delay",delay+"ms");
    observer.observe(el);
  });

  window.page1RevealObserver=observer;
}

function observeDynamicReveals(scope=document){
  const items=scope.querySelectorAll?.(".reveal:not(.is-visible)")||[];
  items.forEach((el,index)=>{
    if(!el.dataset.delay)el.style.setProperty("--delay",Math.min(index*55,330)+"ms");
    if(window.page1RevealObserver)window.page1RevealObserver.observe(el);
    else el.classList.add("is-visible");
  });
}

function initHeroParallax(){
  if(!window.matchMedia("(pointer:fine)").matches)return;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;

  const visual=$("heroVisual");
  if(!visual)return;

  visual.addEventListener("mousemove",e=>{
    const r=visual.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width-.5;
    const y=(e.clientY-r.top)/r.height-.5;
    visual.style.transform=`perspective(1000px) rotateY(${x*3.2}deg) rotateX(${-y*3.2}deg)`;
  });

  visual.addEventListener("mouseleave",()=>{
    visual.style.transform="";
  });
}

function renderSite(){
  const s=siteData.settings||{};

  $("tagline").textContent=s.TAGLINE||"Beauty, Defined Your Way.";
  $("subtitle").textContent=s.SUBTITLE||"Premium hair, nails and beauty services.";
  $("heroNote").textContent=s.HERO_NOTE||"";
  $("aboutText").textContent=s.ABOUT_TEXT||"PAGE.1 is designed around personal care, detail and an experience that feels beautifully considered from booking to finish.";
  $("location").textContent=s.LOCATION||"Kuwait";
  $("hours").textContent=s.OPENING_HOURS||"Contact us for opening hours";
  $("footerCopy").textContent=(s.SALON_NAME||"PAGE.1 Beauty Salon")+" • "+(s.LOCATION||"Kuwait");

  animateNumber($("serviceCount"),(siteData.services||[]).length);
  animateNumber($("teamCount"),(siteData.staff||[]).length);

  renderServices();
  renderTeam();
  renderContact();
  renderGallery();
}

function animateNumber(el,target){
  if(!el)return;
  const end=Math.max(0,Number(target||0));
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){el.textContent=end;return;}
  const duration=700;
  const start=performance.now();
  const tick=now=>{
    const t=Math.min(1,(now-start)/duration);
    const eased=1-Math.pow(1-t,3);
    el.textContent=Math.round(end*eased);
    if(t<1)requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderServices(){
  const categories=["All",...new Set((siteData.services||[]).map(x=>x.category||"Beauty"))];

  $("categoryFilter").innerHTML=categories.map(c=>`
    <button class="filter ${c===activeCategory?"active":""}" onclick="setCategory('${jsEsc(c)}')">${esc(c)}</button>
  `).join("");

  const list=(siteData.services||[]).filter(x=>activeCategory==="All"||(x.category||"Beauty")===activeCategory);

  $("serviceGrid").innerHTML=list.length
    ? list.map((s,i)=>`
      <article class="service-card reveal" data-delay="${Math.min(i*55,330)}">
        <div class="service-top">
          <div class="service-cat">${esc(s.category||"Beauty")}</div>
          <div class="service-index">${String(i+1).padStart(2,"0")}</div>
        </div>
        <h3>${esc(s.name)}</h3>
        <div class="service-meta">
          <div>
            <div class="service-price">${Number(s.price||0).toFixed(3)} KD</div>
            <div class="service-duration">Approx. ${Number(s.duration||60)} min</div>
          </div>
          <a class="service-book" href="./book/" aria-label="Book ${attr(s.name)}">↗</a>
        </div>
      </article>
    `).join("")
    : '<div style="grid-column:1/-1;color:#756E65;padding:30px 0">No active services yet.</div>';

  observeDynamicReveals($("serviceGrid"));
}

function setCategory(c){
  activeCategory=c;
  renderServices();
}

function renderTeam(){
  const list=siteData.staff||[];

  $("teamGrid").innerHTML=list.length
    ? list.map((x,i)=>{
        const initials=String(x.name||"")
          .split(/\s+/)
          .map(p=>p[0]||"")
          .join("")
          .slice(0,2)
          .toUpperCase();

        return `
          <article class="team-card reveal" data-delay="${Math.min(i*65,300)}">
            <div class="avatar">${esc(initials||"P1")}</div>
            <h3>${esc(x.name)}</h3>
            <p>PAGE.1 Beauty Professional</p>
          </article>
        `;
      }).join("")
    : '<div style="grid-column:1/-1;color:#AFA59B;padding:28px 0">Our team will be added soon.</div>';

  observeDynamicReveals($("teamGrid"));
}

function renderContact(){
  const s=siteData.settings||{};
  const rows=[];

  if(s.PHONE)rows.push(`<div class="contact-row"><small>Phone</small><a href="tel:${attr(s.PHONE)}">${esc(s.PHONE)}</a></div>`);

  if(s.WHATSAPP){
    const digits=String(s.WHATSAPP).replace(/\D/g,"");
    rows.push(`<div class="contact-row"><small>WhatsApp</small><a target="_blank" rel="noopener" href="https://wa.me/${digits}">${esc(s.WHATSAPP)}</a></div>`);
  }

  if(s.INSTAGRAM){
    let url=s.INSTAGRAM;
    if(!/^https?:/i.test(url))url="https://instagram.com/"+url.replace(/^@/,"");
    rows.push(`<div class="contact-row"><small>Instagram</small><a target="_blank" rel="noopener" href="${attr(url)}">${esc(s.INSTAGRAM)}</a></div>`);
  }

  if(s.EMAIL)rows.push(`<div class="contact-row"><small>Email</small><a href="mailto:${attr(s.EMAIL)}">${esc(s.EMAIL)}</a></div>`);

  if(!rows.length){
    rows.push('<div class="contact-row"><small>Online Booking</small><a href="./book/">Book your appointment online</a></div>');
  }

  $("contactList").innerHTML=rows.join("");
}

function renderGallery(){
  const s=siteData.settings||{};
  const images=[s.GALLERY_IMAGE_1,s.GALLERY_IMAGE_2,s.GALLERY_IMAGE_3,s.GALLERY_IMAGE_4].filter(Boolean);

  if(!images.length){
    $("gallerySection").style.display="none";
    return;
  }

  $("gallerySection").style.display="block";
  $("gallery").innerHTML=images.map((url,i)=>`
    <div class="gallery-item reveal" data-delay="${i*70}" style="background-image:url('${attr(url)}')"></div>
  `).join("");
  observeDynamicReveals($("gallery"));
}

function esc(v){
  return String(v||"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function attr(v){return esc(v)}
function jsEsc(v){return String(v||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'")}
