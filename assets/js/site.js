
let siteData={services:[],staff:[],settings:{}};
let activeCategory="All";

window.addEventListener("load",()=>{
  google.script.run
    .withSuccessHandler(data=>{
      siteData=data||siteData;
      renderSite();
      loading.classList.add("hide");
    })
    .withFailureHandler(e=>{
      loading.classList.add("hide");
      alert(e&&e.message?e.message:String(e));
    })
    .publicWebsiteInit();
});

function renderSite(){
  const s=siteData.settings||{};

  tagline.textContent=s.TAGLINE||"Beauty, Defined Your Way.";
  subtitle.textContent=s.SUBTITLE||"Premium hair, nails and beauty services.";
  heroNote.textContent=s.HERO_NOTE||"";
  aboutText.textContent=s.ABOUT_TEXT||"";
  location.textContent=s.LOCATION||"Kuwait";
  hours.textContent=s.OPENING_HOURS||"Contact us for opening hours";
  footerCopy.textContent=(s.SALON_NAME||"PAGE.1 Beauty Salon")+" • "+(s.LOCATION||"Kuwait");

  renderServices();
  renderTeam();
  renderContact();
  renderGallery();
}

function renderServices(){
  const categories=["All",...new Set((siteData.services||[]).map(x=>x.category||"Beauty"))];

  categoryFilter.innerHTML=categories.map(c=>`
    <button class="filter ${c===activeCategory?"active":""}" onclick="setCategory('${jsEsc(c)}')">${esc(c)}</button>
  `).join("");

  const list=(siteData.services||[]).filter(x=>activeCategory==="All"||(x.category||"Beauty")===activeCategory);

  serviceGrid.innerHTML=list.length
    ? list.map(s=>`
      <article class="service-card">
        <div class="service-cat">${esc(s.category||"Beauty")}</div>
        <h3>${esc(s.name)}</h3>
        <div class="service-meta">
          <div>
            <div class="service-price">${Number(s.price||0).toFixed(3)} KD</div>
            <div class="service-duration">Approx. ${Number(s.duration||60)} min</div>
          </div>
          <a class="service-book" href="?booking=1" target="_top">BOOK</a>
        </div>
      </article>
    `).join("")
    : '<div style="grid-column:1/-1;color:#756E65">No active services yet.</div>';
}

function setCategory(c){
  activeCategory=c;
  renderServices();
}

function renderTeam(){
  const list=siteData.staff||[];

  teamGrid.innerHTML=list.length
    ? list.map(x=>{
        const initials=String(x.name||"")
          .split(/\s+/)
          .map(p=>p[0]||"")
          .join("")
          .slice(0,2)
          .toUpperCase();

        return `
          <article class="team-card">
            <div class="avatar">${esc(initials||"P1")}</div>
            <h3>${esc(x.name)}</h3>
            <p>PAGE.1 Beauty Professional</p>
          </article>
        `;
      }).join("")
    : '<div style="grid-column:1/-1;color:#AFA59B">Our team will be added soon.</div>';
}

function renderContact(){
  const s=siteData.settings||{};
  const rows=[];

  if(s.PHONE)rows.push(`<div class="contact-row"><small>Phone</small><a href="tel:${attr(s.PHONE)}">${esc(s.PHONE)}</a></div>`);

  if(s.WHATSAPP){
    const digits=String(s.WHATSAPP).replace(/\D/g,"");
    rows.push(`<div class="contact-row"><small>WhatsApp</small><a target="_blank" href="https://wa.me/${digits}">${esc(s.WHATSAPP)}</a></div>`);
  }

  if(s.INSTAGRAM){
    let url=s.INSTAGRAM;
    if(!/^https?:/i.test(url)){
      url="https://instagram.com/"+url.replace(/^@/,"");
    }
    rows.push(`<div class="contact-row"><small>Instagram</small><a target="_blank" href="${attr(url)}">${esc(s.INSTAGRAM)}</a></div>`);
  }

  if(s.EMAIL)rows.push(`<div class="contact-row"><small>Email</small><a href="mailto:${attr(s.EMAIL)}">${esc(s.EMAIL)}</a></div>`);

  if(!rows.length){
    rows.push('<div class="contact-row"><small>Online Booking</small><a href="?booking=1" target="_top">Book your appointment online</a></div>');
  }

  contactList.innerHTML=rows.join("");
}

function renderGallery(){
  const s=siteData.settings||{};

  const images=[
    s.GALLERY_IMAGE_1,
    s.GALLERY_IMAGE_2,
    s.GALLERY_IMAGE_3,
    s.GALLERY_IMAGE_4
  ].filter(Boolean);

  if(!images.length){
    gallerySection.style.display="none";
    return;
  }

  gallerySection.style.display="block";

  gallery.innerHTML=images.map(url=>`
    <div class="gallery-item" style="background-image:url('${attr(url)}')"></div>
  `).join("");
}

function esc(v){
  return String(v||"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function attr(v){
  return esc(v);
}

function jsEsc(v){
  return String(v||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'");
}
