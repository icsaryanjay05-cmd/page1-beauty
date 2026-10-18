
let initData={services:[],staff:[],months:[]},rowId=0,currentNet=0,dashMode="daily",lastReceiptData=null,lastDashData=null,appointmentMode="day",appointmentDate=null,currentAppointments=[],managerUnlocked=false,staffMonthlyData=null,salonNotifications=null,notificationsToastShown=false;
let authToken=sessionStorage.getItem("PAGE1_AUTH_TOKEN")||"";
let authUser=null;
let authPermissions={newSale:false,appointments:false,dashboard:false,operations:false,manager:false,admin:false,features:{}};
let inactivityTimer=null;
const INACTIVITY_MS=30*60*1000;


function showAppLoading(title,text){
  appLoadingTitle.textContent=title||"Loading PAGE.1";
  appLoadingText.textContent=text||"Preparing salon system...";
  appLoadingScreen.classList.add("show");
}

function updateAppLoading(title,text){
  if(title)appLoadingTitle.textContent=title;
  if(text)appLoadingText.textContent=text;
}

function hideAppLoading(){
  appLoadingScreen.classList.remove("show");
}

bootstrapAuth();

function bootstrapAuth(){
  document.body.classList.add("auth-locked");

  if(!authToken){
    hideAppLoading();
    showLogin();
    return;
  }

  showAppLoading(
    "Welcome Back",
    "Checking your secure session..."
  );

  google.script.run
    .withSuccessHandler(result=>{
      if(!result||!result.success){
        clearAuthState();
        hideAppLoading();
        showLogin(result&&result.message?result.message:"Please sign in.");
        return;
      }
      authUser=result.user;
      authPermissions=result.permissions||authPermissions;
      updateAppLoading(
        "Loading PAGE.1",
        "Preparing your salon workspace..."
      );
      loadAuthenticatedApp();
    })
    .withFailureHandler(()=>{
      clearAuthState();
      hideAppLoading();
      showLogin("Please sign in again.");
    })
    .webAuthResume(authToken);
}

function loadAuthenticatedApp(){
  updateAppLoading(
    "Loading Salon System",
    "Syncing services, staff and reports..."
  );

  google.script.run
    .withSuccessHandler(d=>{
      initData=d;
      authUser=d.user||authUser;
      authPermissions=d.permissions||authPermissions;

      date.value=d.today;
      dashDate.value=d.today;
      dashMonth.innerHTML="";
      d.months.forEach(m=>dashMonth.add(new Option(m.label,m.value)));

      let mm=d.months.find(m=>m.value.slice(0,7)===d.today.slice(0,7));
      if(mm)dashMonth.value=mm.value;

      appointmentDate=new Date(d.today+"T12:00:00");
      setupAppointmentSelectors();

      services.innerHTML="";
      rowId=0;
      addService();

      applyAuthUI();
      updateWorkspaceGreeting_();
      document.body.classList.remove("auth-locked");
      loginMessage.textContent="";
      startInactivityTimer();

      updateAppLoading(
        "Ready",
        "Welcome to PAGE.1 Beauty Salon"
      );

      setTimeout(hideAppLoading,420);
      setTimeout(loadSalonNotifications,650);
    })
    .withFailureHandler(err)
    .webInit(authToken);
}

function loginUser(){
  const username=loginUsername.value.trim();
  const password=loginPassword.value;

  loginMessage.className="login-message";
  loginMessage.textContent="";

  if(!username||!password){
    loginMessage.className="login-message error";
    loginMessage.textContent="Enter your username and password.";
    return;
  }

  loginButton.disabled=true;
  loginButton.textContent="Signing in...";

  showAppLoading(
    "Signing You In",
    "Verifying your PAGE.1 account..."
  );

  google.script.run
    .withSuccessHandler(result=>{
      loginButton.disabled=false;
      loginButton.textContent="Sign In";

      if(!result||!result.success){
        hideAppLoading();
        loginMessage.className="login-message error";
        loginMessage.textContent=result&&result.message?result.message:"Unable to sign in.";
        loginPassword.value="";
        loginPassword.focus();
        return;
      }

      authToken=result.token;
      authUser=result.user;
      authPermissions=result.permissions||authPermissions;

      updateAppLoading(
        "Login Successful",
        "Opening your salon workspace..."
      );
      sessionStorage.setItem("PAGE1_AUTH_TOKEN",authToken);
      loginPassword.value="";
      loadAuthenticatedApp();
    })
    .withFailureHandler(e=>{
      hideAppLoading();
      loginButton.disabled=false;
      loginButton.textContent="Sign In";
      loginMessage.className="login-message error";
      loginMessage.textContent=e&&e.message?e.message:String(e);
    })
    .webAuthLogin(username,password);
}

function logoutUser(reason){
  const oldToken=authToken;
  hideAppLoading();
  clearAuthState();
  showLogin(reason||"");
  if(oldToken)google.script.run.webAuthLogout(oldToken);
}

function clearAuthState(){
  authToken="";
  authUser=null;
  authPermissions={newSale:false,appointments:false,dashboard:false,operations:false,manager:false,admin:false,features:{}};
  managerUnlocked=false;
  sessionStorage.removeItem("PAGE1_AUTH_TOKEN");
  if(inactivityTimer){clearTimeout(inactivityTimer);inactivityTimer=null}
}

function showLogin(message){
  document.body.classList.add("auth-locked");
  if(message){
    loginMessage.className="login-message error";
    loginMessage.textContent=message;
  }else{
    loginMessage.className="login-message";
    loginMessage.textContent="";
  }
  setTimeout(()=>loginUsername.focus(),80);
}

function canFeature(key){
  return Boolean(
    authPermissions &&
    authPermissions.features &&
    authPermissions.features[key]
  );
}

function setFeatureVisible(el,visible){
  if(!el)return;
  el.classList.toggle("feature-hidden",!visible);
}

function applyAuthUI(){
  if(!authUser)return;

  authUserName.textContent=authUser.name||authUser.username;
  authUserRole.textContent=String(authUser.role||"").toLowerCase();
  authAvatar.textContent=(authUser.name||authUser.username||"U")
    .split(/\s+/).map(x=>x[0]||"").join("").slice(0,2).toUpperCase();

  navSale.style.display=canFeature("NEW_SALE")?"":"none";
  navAppointments.style.display=canFeature("APPOINTMENTS")?"":"none";
  navDash.style.display=canFeature("DASHBOARD")?"":"none";
  navOps.style.display=authPermissions.operations?"":"none";
  navManager.style.display=authPermissions.manager?"":"none";
  if(typeof notificationWrap!=="undefined"&&notificationWrap){
    notificationWrap.style.display=(canFeature("INVENTORY")||canFeature("CRM"))?"":"none";
  }

  setFeatureVisible(opsInventoryBtn,canFeature("INVENTORY"));
  setFeatureVisible(opsVoidBtn,canFeature("VOID_RECEIPT"));
  setFeatureVisible(opsStaffBtn,canFeature("MANAGE_STAFF"));
  setFeatureVisible(opsServicesBtn,canFeature("MANAGE_SERVICES"));
  setFeatureVisible(opsScheduleBtn,canFeature("VIEW_SCHEDULE"));
  setFeatureVisible(opsWhatsAppBtn,canFeature("WHATSAPP_REMINDERS"));
  setFeatureVisible(opsCRMBtn,canFeature("CRM"));

  setFeatureVisible(mgrClientBtn,canFeature("CLIENT_HISTORY"));
  setFeatureVisible(mgrTxBtn,canFeature("TRANSACTIONS"));
  setFeatureVisible(mgrStaffBtn,canFeature("MANAGE_STAFF"));
  setFeatureVisible(mgrServicesBtn,canFeature("MANAGE_SERVICES"));
  setFeatureVisible(mgrPayrollBtn,canFeature("VIEW_PAYROLL"));
  setFeatureVisible(mgrPermissionsBtn,canFeature("MANAGE_PERMISSIONS"));

  managerUnlocked=Boolean(authPermissions.manager);

  if(canFeature("NEW_SALE"))showView("sale");
  else if(canFeature("APPOINTMENTS"))showView("appointments");
  else if(authPermissions.operations)showView("ops");
  else if(canFeature("DASHBOARD"))showView("dash");
  else if(authPermissions.manager)showView("manager");
}

function toggleLoginPassword(){
  const hidden=loginPassword.type==="password";
  loginPassword.type=hidden?"text":"password";
  const b=document.querySelector(".show-password");
  if(b)b.textContent=hidden?"Hide":"Show";
}

function startInactivityTimer(){
  resetInactivityTimer();
  ["pointerdown","keydown","touchstart"].forEach(name=>{
    document.addEventListener(name,resetInactivityTimer,{passive:true});
  });
}

function resetInactivityTimer(){
  if(!authToken)return;
  if(inactivityTimer)clearTimeout(inactivityTimer);
  inactivityTimer=setTimeout(()=>{
    logoutUser("You were signed out after 30 minutes of inactivity.");
  },INACTIVITY_MS);
}

function showView(v){
  document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
  const target=document.getElementById(v);
  if(target)target.classList.add("active");

  navSale.classList.toggle("active",v==="sale");
  navAppointments.classList.toggle("active",v==="appointments");
  navDash.classList.toggle("active",v==="dash");
  navOps.classList.toggle("active",v==="ops");
  navManager.classList.toggle("active",v==="manager");

  const meta={
    sale:["POINT OF SALE","New Sale"],
    appointments:["SALON CALENDAR","Appointments"],
    dash:["BUSINESS INSIGHTS","Dashboard"],
    ops:["DAILY TOOLS","Operations"],
    manager:["MANAGEMENT","Manager"]
  };
  if(meta[v]){
    if(typeof pageEyebrow!=="undefined"&&pageEyebrow)pageEyebrow.textContent=meta[v][0];
    if(typeof pageTitle!=="undefined"&&pageTitle)pageTitle.textContent=meta[v][1];
  }
  closeNotificationPanel();
  if(v==="dash")loadDash();
  if(v==="appointments")loadAppointments();
  if(v==="ops")loadOps();
  window.scrollTo({top:0,behavior:"smooth"});
}

function openOpsShortcut(panel){
  showView("ops");
  setTimeout(()=>showOpsPanel(panel),30);
}

function updateWorkspaceGreeting_(){
  if(typeof workspaceGreeting==="undefined"||!workspaceGreeting)return;
  const h=new Date().getHours();
  const greet=h<12?"Good morning":h<18?"Good afternoon":"Good evening";
  const name=authUser&&authUser.name?String(authUser.name).split(/\s+/)[0]:"Team";
  workspaceGreeting.textContent=greet+", "+name;
}

function staffSelect(cls){let s=document.createElement("select");s.className=cls||"";s.add(new Option("Select staff...",""));initData.staff.forEach(x=>s.add(new Option(x,x)));return s}

function serviceCategoryName_(service){
  const value=String(service&&service.category||"").trim();
  return value||"Other";
}

function serviceCategories_(){
  const seen=new Set(),list=[];
  (initData.services||[]).forEach(service=>{
    const category=serviceCategoryName_(service);
    const key=category.toLowerCase();
    if(!seen.has(key)){
      seen.add(key);
      list.push(category);
    }
  });
  return list;
}

function populateCategorySelect_(select){
  select.innerHTML="";
  select.add(new Option("Select category...",""));
  serviceCategories_().forEach(category=>select.add(new Option(category,category)));
}

function populateServiceSelect_(select,category){
  select.innerHTML="";
  select.add(new Option(category?"Select service...":"Select category first...",""));
  select.disabled=!category;
  if(!category)return;
  (initData.services||[])
    .filter(service=>serviceCategoryName_(service)===category)
    .forEach(service=>select.add(new Option(service.name,service.name)));
}

function findSelectedService_(category,name){
  return (initData.services||[]).find(service=>
    serviceCategoryName_(service)===category &&
    String(service.name||"")===String(name||"")
  )||null;
}

function renderServiceQuickGrid_(grid,category,select,priceInput,adjustButton){
  grid.innerHTML="";
  const list=(initData.services||[]).filter(service=>serviceCategoryName_(service)===category);
  grid.classList.toggle("show",Boolean(category&&list.length));
  if(!category||!list.length)return;
  list.forEach(service=>{
    const b=document.createElement("button");
    b.type="button";
    b.className="service-quick-card"+(select.value===service.name?" active":"");
    b.innerHTML=`<span>${esc(service.name)}</span><small>${Number(service.price||0).toFixed(3)} KD</small>`;
    b.onclick=()=>{
      select.value=service.name;
      priceInput.value=Number(service.price||0).toFixed(3);
      priceInput.readOnly=true;
      adjustButton.textContent="✎";
      adjustButton.classList.remove("active");
      grid.querySelectorAll(".service-quick-card").forEach(x=>x.classList.toggle("active",x===b));
      totals();
    };
    grid.append(b);
  });
}

function addService(){
  rowId++;
  let r=document.createElement("div");r.className="service-row";r.dataset.mode="single";

  let picker=document.createElement("div");picker.className="service-picker";
  let category=document.createElement("select");category.className="svc-category";category.setAttribute("aria-label","Service category");category.title="Choose a service category";populateCategorySelect_(category);
  let s=document.createElement("select");s.className="svc";s.setAttribute("aria-label","Service");s.title="Choose a service";populateServiceSelect_(s,"");
  let quick=document.createElement("div");quick.className="service-quick-grid";
  picker.append(category,s,quick);

  let p=document.createElement("input");p.type="number";p.value="0.000";p.readOnly=true;p.title="Service price";
  let adj=document.createElement("button");adj.className="smallbtn price-edit";adj.textContent="✎";adj.title="Adjust service price";
  adj.onclick=()=>{p.readOnly=!p.readOnly;adj.classList.toggle("active",!p.readOnly);adj.textContent=p.readOnly?"✎":"Reset";if(!p.readOnly){p.focus();p.select()}else{let x=findSelectedService_(category.value,s.value);p.value=(x?x.price:0).toFixed(3);totals()}};
  let pb=document.createElement("div");pb.className="pricebox";pb.append(p,adj);

  let di=document.createElement("input");di.type="number";di.value=0;di.min=0;di.max=100;di.className="discount-custom";di.style.display="none";
  let chips=document.createElement("div");chips.className="discounts";chips.append(di);
  [0,10,20].forEach(x=>{let b=document.createElement("button");b.className="chip"+(x===0?" active":"");b.dataset.discount=String(x);b.textContent=x?x+"%":"None";b.onclick=()=>{di.value=x;di.style.display="none";chips.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));b.classList.add("active");totals()};chips.append(b)});
  let custom=document.createElement("button");custom.className="chip custom-discount";custom.textContent="Custom";custom.onclick=()=>{chips.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));custom.classList.add("active");di.style.display="block";di.focus();di.select()};chips.append(custom);

  let sw=document.createElement("div");sw.className="staff";let single=document.createElement("div");single.className="staff-single";let tech=staffSelect("tech");let split=document.createElement("button");split.className="smallbtn split-lite";split.textContent="+ Split";split.title="Split this service between staff";single.append(tech,split);
  let panel=document.createElement("div");panel.className="split-panel";panel.innerHTML='<div class="alist"></div><div class="split-actions"><button class="smallbtn addstaff">+ Staff</button><button class="smallbtn even">Split Evenly</button><button class="smallbtn back">Single Staff</button></div><div class="muted astat"></div>';sw.append(single,panel);
  let n=document.createElement("div");n.className="money service-net";n.textContent="0.000";
  let rm=document.createElement("button");rm.className="remove";rm.innerHTML="×";rm.title="Remove service";rm.onclick=()=>{if(document.querySelectorAll(".service-row").length>1){r.remove();totals()}};
  r.append(picker,pb,chips,sw,n,rm);services.append(r);

  category.onchange=()=>{
    populateServiceSelect_(s,category.value);s.value="";p.value="0.000";p.readOnly=true;adj.textContent="✎";adj.classList.remove("active");
    renderServiceQuickGrid_(quick,category.value,s,p,adj);totals();
  };
  s.onchange=()=>{
    let x=findSelectedService_(category.value,s.value);p.value=(x?x.price:0).toFixed(3);p.readOnly=true;adj.textContent="✎";adj.classList.remove("active");
    quick.querySelectorAll(".service-quick-card").forEach(b=>b.classList.toggle("active",b.querySelector("span")&&b.querySelector("span").textContent===s.value));totals();
  };
  p.oninput=di.oninput=totals;tech.onchange=totals;
  split.onclick=()=>{r.dataset.mode="split";single.style.display="none";panel.classList.add("show");if(!panel.querySelector(".alloc")){addAlloc(r,tech.value,0);addAlloc(r,"",0);splitEven(r)};totals()};
  panel.querySelector(".addstaff").onclick=()=>{addAlloc(r,"",0);totals()};panel.querySelector(".even").onclick=()=>splitEven(r);panel.querySelector(".back").onclick=()=>{r.dataset.mode="single";single.style.display="flex";panel.classList.remove("show");totals()};totals();
}
function addAlloc(r,t,a){let d=document.createElement("div");d.className="alloc";let s=staffSelect("atech");s.value=t||"";let i=document.createElement("input");i.type="number";i.className="aamt";i.value=Number(a||0).toFixed(3);let b=document.createElement("button");b.className="remove";b.innerHTML="×";b.onclick=()=>{if(r.querySelectorAll(".alloc").length>2){d.remove();totals()}};s.onchange=i.oninput=totals;d.append(s,i,b);r.querySelector(".alist").append(d)}
function rowNet(r){let p=Number(r.querySelector(".pricebox input").value)||0,d=Number(r.querySelector(".discounts input").value)||0;return p*(1-d/100)}
function splitEven(r){let a=[...r.querySelectorAll(".alloc")],net=rowNet(r),base=Math.floor(net/a.length*1000)/1000,used=0;a.forEach((x,i)=>{let v=i===a.length-1?net-used:base;if(i<a.length-1)used+=v;x.querySelector(".aamt").value=v.toFixed(3)});totals()}
function totals(){let g=0,d=0,n=0,c=0;document.querySelectorAll(".service-row").forEach(r=>{let p=Number(r.querySelector(".pricebox input").value)||0,dp=Number(r.querySelector(".discounts input").value)||0,nn=p*(1-dp/100);if(r.querySelector(".svc").value)c++;g+=p;d+=p*dp/100;n+=nn;r.querySelector(".money").textContent=nn.toFixed(3);if(r.dataset.mode==="split"){let a=[...r.querySelectorAll(".aamt")].reduce((s,x)=>s+(Number(x.value)||0),0);r.querySelector(".astat").textContent="Allocated "+a.toFixed(3)+" / "+nn.toFixed(3)+" KD"}});currentNet=n;gross.textContent=kd(g);disc.textContent=kd(d);net.textContent=kd(n);serviceCount.textContent=c+" service"+(c===1?"":"s");let pd=(Number(cash.value)||0)+(Number(knet.value)||0)+(Number(link.value)||0),df=pd-n;paid.textContent=kd(pd);diff.textContent=kd(df);status.className="status "+(n&&Math.abs(df)<=.005?"good":n?"bad":"");status.textContent=!n?"Add services to begin":Math.abs(df)<=.005?"✓ PAYMENT COMPLETE":df<0?"REMAINING • "+Math.abs(df).toFixed(3)+" KD":"OVERPAID • "+df.toFixed(3)+" KD"}
function payFull(id){cash.value=knet.value=link.value=0;document.getElementById(id).value=currentNet.toFixed(3);totals()}
function fullPhone(){let code=cc.value,num=phone.value.replace(/\D/g,""),cd=code.replace(/\D/g,"");if(num.startsWith(cd)&&num.length>cd.length+4)num=num.slice(cd.length);if(num.startsWith("0"))num=num.slice(1);return num?code+num:""}
function clientLookup(){let p=fullPhone();if(!p)return;google.script.run.withSuccessHandler(x=>{clientInfo.style.display="block";let loyalty=Number(x.loyaltyPoints||0);let reward=Number(x.rewardsAvailable||0);clientInfo.innerHTML=x.found?"<b>Returning Client • "+esc(x.name)+"</b><br>"+x.visits+" visits • "+kd(x.spent)+" • "+loyalty+" loyalty pts"+(reward>0?" • <b>"+reward+" reward available</b>":""):"<b>New Client</b>";if(x.found&&!client.value)client.value=x.name}).webClient(authToken,p)}
function formServices(){return [...document.querySelectorAll(".service-row")].filter(r=>r.querySelector(".svc").value).map(r=>{let x={category:(r.querySelector(".svc-category")?r.querySelector(".svc-category").value:""),service:r.querySelector(".svc").value,price:r.querySelector(".pricebox input").value,discount:r.querySelector(".discounts input").value,staffMode:r.dataset.mode,technician:"",allocations:[]};if(r.dataset.mode==="single")x.technician=r.querySelector(".tech").value;else r.querySelectorAll(".alloc").forEach(a=>x.allocations.push({technician:a.querySelector(".atech").value,amount:a.querySelector(".aamt").value}));return x})}
function saveSale(){let f={date:date.value,name:client.value,phone:fullPhone(),services:formServices(),cash:cash.value,knet:knet.value,link:link.value,note:note.value};overlay.classList.add("show");google.script.run.withSuccessHandler(x=>{overlay.classList.remove("show");lastReceiptData={form:JSON.parse(JSON.stringify(f)),result:x};successTotal.textContent=kd(x.total);successText.textContent=x.client+" • "+x.paymentMethod+" • "+x.saleId;success.classList.add("show")}).withFailureHandler(err).webSave(authToken,f)}
function resetForm(){client.value=phone.value=note.value="";cc.value="+965";cash.value=knet.value=link.value=0;clientInfo.style.display="none";services.innerHTML="";rowId=0;addService()}function newSale(){success.classList.remove("show");resetForm()}
function loadDash(){
  dailyBtn.classList.toggle("active",dashMode==="daily");
  monthlyBtn.classList.toggle("active",dashMode==="monthly");
  dashDate.style.display=dashMode==="daily"?"block":"none";
  dashMonth.style.display=dashMode==="monthly"?"block":"none";
  trendCard.style.display=dashMode==="monthly"?"block":"none";
  staffMonthlyCard.style.display=dashMode==="monthly"?"block":"none";
  overlay.classList.add("show");
  let fn=dashMode==="daily"?"webDashDaily":"webDashMonthly",v=dashMode==="daily"?dashDate.value:dashMonth.value;
  if(dashMode==="monthly")loadStaffMonthlySales(v);
  else staffMonthlyData=null;
  google.script.run.withSuccessHandler(renderDash).withFailureHandler(err)[fn](authToken,v);
}
function renderDash(d){overlay.classList.remove("show");lastDashData=JSON.parse(JSON.stringify(d));if(typeof dashPeriodLabel!=="undefined"&&dashPeriodLabel){dashPeriodLabel.textContent=dashMode==="daily"?"Daily performance • "+dashDate.value:"Monthly performance • "+(dashMonth.options[dashMonth.selectedIndex]?dashMonth.options[dashMonth.selectedIndex].text:dashMonth.value)}dTotal.textContent=kd(d.total);dCount.textContent=d.count;dAvg.textContent=kd(d.average);dCash.textContent=kd(d.cash);dKnet.textContent=kd(d.knet);dLink.textContent=kd(d.link);bars(topStaff,d.topStaff);bars(topServices,d.topServices);if(dashMode==="monthly"){trend.innerHTML="";let max=Math.max(...d.daily.map(x=>x.sales),1);d.daily.forEach(x=>{let b=document.createElement("div");b.className="day";b.style.height=Math.max(2,x.sales/max*140)+"px";b.title=x.date+" "+kd(x.sales);trend.append(b)})}}

function loadStaffMonthlySales(monthValue){
  staffMonthlyResult.innerHTML='<div class="manager-empty">Loading complete staff sales...</div>';
  google.script.run
    .withSuccessHandler(renderStaffMonthlySales)
    .withFailureHandler(e=>{staffMonthlyResult.innerHTML='<div class="manager-empty">'+esc(e&&e.message?e.message:String(e))+'</div>'})
    .webStaffMonthlySales(authToken,monthValue);
}

function renderStaffMonthlySales(data){
  staffMonthlyData=data||{rows:[]};
  const rows=(staffMonthlyData.rows||[]).map((x,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><span class="staff-sales-name">${esc(x.name)}</span></td>
      <td>${Number(x.transactions||0)}</td>
      <td>${Number(x.serviceLines||0)}</td>
      <td>${Number(x.clients||0)}</td>
      <td class="money">${Number(x.gross||0).toFixed(3)} KD</td>
      <td class="money">${Number(x.discount||0).toFixed(3)} KD</td>
      <td class="money"><b>${Number(x.net||0).toFixed(3)} KD</b></td>
      <td>${Number(x.target||0)>0?Number(x.target||0).toFixed(3)+" KD":"—"}</td>
      <td class="staff-sales-progress">
        ${Number(x.target||0)>0?`<span class="${Number(x.targetPct||0)>=100?"staff-target-hit":""}">${Number(x.targetPct||0).toFixed(1)}%</span><div class="staff-progress-track"><div class="staff-progress-fill" style="width:${Math.min(100,Math.max(0,Number(x.targetPct||0)))}%"></div></div>`:"—"}
      </td>
    </tr>`).join("");
  staffMonthlySummary.innerHTML=`${esc(staffMonthlyData.month||"")} • <span class="staff-monthly-total">Net ${kd(staffMonthlyData.totalNet||0)}</span> • Gross ${kd(staffMonthlyData.totalGross||0)} • Discounts ${kd(staffMonthlyData.totalDiscount||0)}`;
  staffMonthlyResult.innerHTML=`<table class="manager-table"><thead><tr><th>#</th><th>Staff</th><th>Transactions</th><th>Services</th><th>Clients</th><th>Gross</th><th>Discount</th><th>Net Sales</th><th>Target</th><th>Target %</th></tr></thead><tbody>${rows||'<tr><td colspan="10" class="manager-empty">No staff sales for this month.</td></tr>'}</tbody></table>`;
}

function bars(el,a){el.innerHTML="";if(!a.length){el.innerHTML='<div class="muted">No data yet.</div>';return}let m=Math.max(...a.map(x=>x.sales),1);a.forEach(x=>{let r=document.createElement("div");r.className="bar";r.innerHTML='<b>'+esc(x.name)+'</b><div class="track"><div class="fill" style="width:'+Math.max(2,x.sales/m*100)+'%"></div></div><b>'+Number(x.sales).toFixed(3)+'</b>';el.append(r)})}

function printableLogo(){return new URL("../assets/images/page1-logo.png",location.href).href}

function printWindow(title,content){
  const w=window.open("","_blank","width=920,height=940");
  if(!w){alert("Please allow pop-ups to print or save PDF.");return}
  const logo=printableLogo();
  w.document.write(`<!DOCTYPE html><html><head><title>${esc(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  @page{size:A4;margin:13mm}
  *{box-sizing:border-box}
  :root{--ink:#1D1D1B;--cream:#E9E2D0;--taupe:#CABAAD;--paper:#FFFEFB;--muted:#756E65;--line:#DED4C8}
  body{font-family:Arial,Helvetica,sans-serif;color:var(--ink);margin:0;background:#fff;font-size:11.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding:0 0 16px;margin-bottom:18px}.logo{width:175px;max-height:62px;object-fit:contain}.doc-title{text-align:right}.doc-title h1{font-size:16px;margin:0 0 5px}.muted{color:var(--muted)}
  .box{border:1px solid var(--line);border-radius:13px;padding:13px;margin-bottom:12px;background:#fff}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}.kpi{background:#F6F0E6;border-radius:10px;padding:11px}.kpi small{display:block;color:var(--muted);text-transform:uppercase;font-size:8px;font-weight:bold;letter-spacing:.08em}.kpi b{display:block;font-size:16px;margin-top:4px}
  table{width:100%;border-collapse:separate;border-spacing:0;margin-top:8px;overflow:hidden;border-radius:9px}th{background:var(--ink);color:var(--cream);text-align:left;padding:8px;font-size:9px}td{padding:8px;border-bottom:1px solid #EEE7DF;vertical-align:top}.right{text-align:right}.total{font-size:18px;font-weight:bold}.summary-row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed #E7DED5}.summary-row:last-child{border-bottom:0}.ar{font-family:Tahoma,Arial,sans-serif;font-weight:650;line-height:1.5}.foot{margin-top:18px;padding-top:10px;border-top:1px solid var(--line);text-align:center;color:var(--muted);font-size:9px}
  .receipt-shell{border:1px solid var(--line);border-radius:18px;overflow:hidden;background:var(--paper)}.receipt-hero{background:var(--ink);color:var(--cream);padding:20px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}.receipt-hero span{font-size:9px;letter-spacing:.16em;text-transform:uppercase;opacity:.72}.receipt-hero strong{display:block;font-size:28px;margin-top:5px}.receipt-id{text-align:right}.receipt-id b{font-size:13px;display:block}.receipt-id small{opacity:.72}.receipt-body{padding:16px}.receipt-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.receipt-meta div{background:#F6F0E6;border-radius:10px;padding:10px}.receipt-meta small{display:block;color:var(--muted);font-size:8px;text-transform:uppercase;letter-spacing:.06em}.receipt-meta b{display:block;margin-top:4px;font-size:11px}.receipt-section-title{display:flex;justify-content:space-between;align-items:flex-end;margin:17px 0 7px}.receipt-section-title b{font-size:12px}.receipt-section-title span{font-family:Tahoma,Arial,sans-serif;color:var(--muted);direction:rtl}.service-sub{display:block;color:var(--muted);font-size:8px;margin-top:2px}.receipt-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.receipt-total-card{background:var(--ink);color:var(--cream);border-radius:12px;padding:13px}.receipt-total-card .summary-row{border-color:rgba(255,255,255,.14)}.receipt-total-card .grand{font-size:21px;padding-top:10px}.receipt-thanks{text-align:center;margin-top:14px;padding:14px;border:1px dashed var(--taupe);border-radius:12px}.receipt-thanks b{font-size:12px}.receipt-thanks .ar{display:block;margin-top:5px;font-size:13px}
  @media(max-width:700px){.grid,.receipt-summary,.receipt-meta{grid-template-columns:1fr}.receipt-hero{align-items:flex-start;flex-direction:column}.receipt-id{text-align:left}}
  @media print{button{display:none!important}.receipt-shell{break-inside:avoid}}
  </style></head><body><div class="head"><img class="logo" src="${logo}"><div class="doc-title"><h1>${esc(title)}</h1><div class="muted">PAGE.1 BEAUTY SALON</div></div></div>${content}<div class="foot">PAGE.1 Beauty Salon • Generated from PAGE.1 Salon System</div><script>window.onload=function(){setTimeout(function(){window.print()},250)};<\/script></body></html>`);
  w.document.close();
}

function printReceipt(){
  if(!lastReceiptData){alert("Save a sale first before printing a receipt.");return}
  const f=lastReceiptData.form,r=lastReceiptData.result;
  const bi=(en,ar)=>`${en}<br><span class="ar" dir="rtl">${ar}</span>`;
  const paymentAr={Cash:"نقداً",Knet:"كي نت",Link:"رابط الدفع",Split:"دفع مختلط","No Charge":"بدون رسوم"};
  const paymentLabel=esc(r.paymentMethod)+(paymentAr[r.paymentMethod]?`<br><span class="ar" dir="rtl">${paymentAr[r.paymentMethod]}</span>`:"");
  const serviceRows=(f.services||[]).map(s=>{
    const price=Number(s.price)||0,discount=Number(s.discount)||0,net=price*(1-discount/100);
    let staff="";
    if(s.staffMode==="split")staff=(s.allocations||[]).map(a=>esc(a.technician)+" ("+Number(a.amount||0).toFixed(3)+" KD)").join("<br>");
    else staff=esc(s.technician||"");
    const serviceLabel=`<b>${esc(s.service)}</b>${s.category?`<span class="service-sub">${esc(s.category)}</span>`:""}`;
    return `<tr><td>${serviceLabel}</td><td>${staff}</td><td class="right">${price.toFixed(3)}</td><td class="right">${discount.toFixed(2)}%</td><td class="right"><b>${net.toFixed(3)}</b></td></tr>`;
  }).join("");
  const gross=(f.services||[]).reduce((x,s)=>x+(Number(s.price)||0),0);
  const totalDiscount=(f.services||[]).reduce((x,s)=>{let p=Number(s.price)||0,d=Number(s.discount)||0;return x+p*d/100},0);
  const body=`<div class="receipt-shell"><div class="receipt-hero"><div><span>PAGE.1 BEAUTY SALON • SALES RECEIPT</span><strong>${Number(r.total||0).toFixed(3)} KD</strong></div><div class="receipt-id"><small>Transaction / رقم العملية</small><b>${esc(r.saleId)}</b></div></div><div class="receipt-body">
  <div class="receipt-meta"><div><small>${bi("Client","العميل")}</small><b>${esc(f.name)}</b></div><div><small>${bi("Mobile","الهاتف")}</small><b>${esc(f.phone)}</b></div><div><small>${bi("Date","التاريخ")}</small><b>${esc(f.date)}</b></div><div><small>${bi("Payment","الدفع")}</small><b>${paymentLabel}</b></div></div>
  <div class="receipt-section-title"><b>Services</b><span>الخدمات</span></div><table><thead><tr><th>${bi("Service","الخدمة")}</th><th>${bi("Technician","الفني")}</th><th class="right">${bi("Price","السعر")}</th><th class="right">${bi("Discount","الخصم")}</th><th class="right">${bi("Net","الصافي")}</th></tr></thead><tbody>${serviceRows}</tbody></table>
  <div class="receipt-summary"><div class="box"><b>${bi("Payment Breakdown","تفاصيل الدفع")}</b><div class="summary-row"><span>${bi("Cash","نقداً")}</span><b>${Number(f.cash||0).toFixed(3)} KD</b></div><div class="summary-row"><span>${bi("Knet","كي نت")}</span><b>${Number(f.knet||0).toFixed(3)} KD</b></div><div class="summary-row"><span>${bi("Link","رابط الدفع")}</span><b>${Number(f.link||0).toFixed(3)} KD</b></div></div>
  <div class="receipt-total-card"><b>${bi("Summary","الملخص")}</b><div class="summary-row"><span>${bi("Gross","قبل الخصم")}</span><b>${gross.toFixed(3)} KD</b></div><div class="summary-row"><span>${bi("Discount","الخصم")}</span><b>${totalDiscount.toFixed(3)} KD</b></div><div class="summary-row grand"><span>${bi("Total","الإجمالي")}</span><b>${Number(r.total||0).toFixed(3)} KD</b></div></div></div>
  ${f.note?`<div class="box"><b>${bi("Note","ملاحظة")}</b><br>${esc(f.note)}</div>`:""}
  <div class="receipt-thanks"><b>Thank you for visiting PAGE.1</b><span class="ar" dir="rtl">شكراً لزيارتكم صالون PAGE.1</span></div></div></div>`;
  printWindow("Sales Receipt | إيصال المبيعات",body);
}

function printDashboard(){
  if(!lastDashData){alert("Open the dashboard and wait for it to load first.");return}
  const d=lastDashData;
  const period=dashMode==="daily"?dashDate.value:(dashMonth.options[dashMonth.selectedIndex]?dashMonth.options[dashMonth.selectedIndex].text:dashMonth.value);
  const topStaff=(d.topStaff||[]).map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.name)}</td><td class="right"><b>${Number(x.sales||0).toFixed(3)} KD</b></td></tr>`).join("");
  const topServices=(d.topServices||[]).map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.name)}</td><td class="right"><b>${Number(x.sales||0).toFixed(3)} KD</b></td></tr>`).join("");
  let staffFull="";
  if(dashMode==="monthly"&&staffMonthlyData&&Array.isArray(staffMonthlyData.rows)){
    const staffRows=staffMonthlyData.rows.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.name)}</td><td class="right">${Number(x.transactions||0)}</td><td class="right">${Number(x.serviceLines||0)}</td><td class="right">${Number(x.gross||0).toFixed(3)} KD</td><td class="right">${Number(x.discount||0).toFixed(3)} KD</td><td class="right"><b>${Number(x.net||0).toFixed(3)} KD</b></td><td class="right">${Number(x.target||0)>0?Number(x.targetPct||0).toFixed(1)+"%":"—"}</td></tr>`).join("");
    staffFull=`<div class="box"><b>Full Staff Monthly Sales</b><table><thead><tr><th>#</th><th>Staff</th><th class="right">Transactions</th><th class="right">Services</th><th class="right">Gross</th><th class="right">Discount</th><th class="right">Net</th><th class="right">Target %</th></tr></thead><tbody>${staffRows||'<tr><td colspan="8">No staff sales</td></tr>'}</tbody></table></div>`;
  }
  let daily="";
  if(dashMode==="monthly"&&d.daily){
    daily=`<div class="box"><b>Daily Sales</b><table><thead><tr><th>Date</th><th class="right">Sales</th></tr></thead><tbody>${d.daily.map(x=>`<tr><td>${esc(x.date)}</td><td class="right">${Number(x.sales||0).toFixed(3)} KD</td></tr>`).join("")}</tbody></table></div>`;
  }
  const body=`<div class="box"><b>Report Period</b><br>${esc(period)}</div>
  <div class="kpis"><div class="kpi"><small>Total Sales</small><b>${kd(d.total)}</b></div><div class="kpi"><small>Transactions</small><b>${Number(d.count||0)}</b></div><div class="kpi"><small>Average Sale</small><b>${kd(d.average)}</b></div><div class="kpi"><small>Cash</small><b>${kd(d.cash)}</b></div><div class="kpi"><small>Knet</small><b>${kd(d.knet)}</b></div><div class="kpi"><small>Link</small><b>${kd(d.link)}</b></div></div>
  <div class="grid"><div class="box"><b>Top Staff</b><table><thead><tr><th>#</th><th>Staff</th><th class="right">Sales</th></tr></thead><tbody>${topStaff||'<tr><td colspan="3">No data</td></tr>'}</tbody></table></div><div class="box"><b>Top Services</b><table><thead><tr><th>#</th><th>Service</th><th class="right">Sales</th></tr></thead><tbody>${topServices||'<tr><td colspan="3">No data</td></tr>'}</tbody></table></div></div>${staffFull}${daily}`;
  printWindow(dashMode==="daily"?"Daily Sales Report":"Monthly Sales Report",body);
}




function toggleNotificationPanel(){
  if(!notificationPanel)return;
  const willOpen=!notificationPanel.classList.contains("show");
  notificationPanel.classList.toggle("show",willOpen);
  document.body.classList.toggle("notifications-open",willOpen);
  if(typeof notificationScrim!=="undefined"&&notificationScrim)notificationScrim.classList.toggle("show",willOpen);
  if(willOpen)loadSalonNotifications();
}

function closeNotificationPanel(){
  if(notificationPanel)notificationPanel.classList.remove("show");
  document.body.classList.remove("notifications-open");
  if(typeof notificationScrim!=="undefined"&&notificationScrim)notificationScrim.classList.remove("show");
}

function loadSalonNotifications(){
  if(!authToken || !(canFeature("INVENTORY")||canFeature("CRM")))return;
  google.script.run
    .withSuccessHandler(renderSalonNotifications)
    .withFailureHandler(e=>{
      if(notificationContent)notificationContent.innerHTML='<div class="notification-empty">'+esc(e&&e.message?e.message:String(e))+'</div>';
    })
    .webSalonNotifications(authToken);
}

function renderSalonNotifications(data){
  salonNotifications=data||{counts:{},expiredProducts:[],birthdaysToday:[],birthdaysUpcoming:[]};
  const c=salonNotifications.counts||{};
  const total=Number(c.total||0), expiredCount=Number(c.expired||0), todayCount=Number(c.birthdayToday||0), upcomingCount=Number(c.birthdayUpcoming||0);
  notificationBadge.textContent=total>99?"99+":String(total);
  notificationBadge.classList.toggle("show",total>0);

  const expired=(salonNotifications.expiredProducts||[]).map(x=>`<div class="notification-item danger"><div class="notification-icon">!</div><div class="notification-copy"><b>${esc(x.itemName)}</b><span>Expired ${esc(x.expiryDate||"")} • ${Number(x.qtyRemaining||0).toFixed(2)} remaining${Number(x.daysExpired||0)>0?" • "+Number(x.daysExpired||0)+" day(s) overdue":""}</span></div></div>`).join("");
  const today=(salonNotifications.birthdaysToday||[]).map(x=>`<div class="notification-item birthday"><div class="notification-icon">🎂</div><div class="notification-copy"><b>${esc(x.name)} — Birthday today</b><span>${esc(x.phone||"")}${x.age?" • Turning "+Number(x.age):""}</span></div></div>`).join("");
  const upcoming=(salonNotifications.birthdaysUpcoming||[]).map(x=>`<div class="notification-item upcoming"><div class="notification-icon">◷</div><div class="notification-copy"><b>${esc(x.name)}</b><span>Birthday in ${Number(x.daysUntil||0)} day(s) • ${esc(x.birthday||"")}${x.phone?" • "+esc(x.phone):""}</span></div></div>`).join("");

  let html=`<div class="notification-overview"><div><strong>${total}</strong><span>Total alerts</span></div><div><strong>${expiredCount}</strong><span>Urgent</span></div><div><strong>${todayCount}</strong><span>Today</span></div></div>`;
  if(expired)html+=`<div class="notification-group urgent-group"><h4><span>Urgent</span><em>${expiredCount}</em></h4>${expired}</div>`;
  if(today)html+=`<div class="notification-group"><h4><span>Today</span><em>${todayCount}</em></h4>${today}</div>`;
  if(upcoming)html+=`<div class="notification-group"><h4><span>Upcoming</span><em>${upcomingCount}</em></h4>${upcoming}</div>`;
  if(!expired&&!today&&!upcoming)html+='<div class="notification-empty notification-all-clear"><span>✓</span><b>Everything looks good</b><small>No expired products or client birthdays due in the next 7 days.</small></div>';
  notificationContent.innerHTML=html;

  if(typeof dashNotificationSummary!=="undefined"&&dashNotificationSummary){
    if(total>0){
      let pieces=[];
      if(expiredCount)pieces.push(expiredCount+" expired product"+(expiredCount===1?"":"s"));
      if(todayCount)pieces.push(todayCount+" birthday"+(todayCount===1?"":"s")+" today");
      if(upcomingCount)pieces.push(upcomingCount+" upcoming birthday"+(upcomingCount===1?"":"s"));
      dashNotificationSummary.innerHTML=`<span class="alert-warning">${total}</span><div><b>${esc(pieces.join(" • "))}</b><small>Open notifications for details</small></div>`;
    }else{
      dashNotificationSummary.innerHTML='<span class="alert-good">✓</span><div><b>No urgent alerts</b><small>Inventory and birthday reminders are clear.</small></div>';
    }
  }

  if(!notificationsToastShown&&total>0){
    notificationsToastShown=true;
    let parts=[];
    if(expiredCount)parts.push(expiredCount+" expired product"+(expiredCount===1?"":"s"));
    if(todayCount)parts.push(todayCount+" birthday"+(todayCount===1?"":"s")+" today");
    if(upcomingCount)parts.push(upcomingCount+" upcoming birthday"+(upcomingCount===1?"":"s"));
    showPage1Toast("Salon alerts",parts.join(" • "));
  }
}

function showPage1Toast(title,text){
  if(!page1Toast)return;
  page1ToastTitle.textContent=title||"PAGE.1";
  page1ToastText.textContent=text||"";
  page1Toast.classList.add("show");
  setTimeout(()=>page1Toast.classList.remove("show"),6500);
}

document.addEventListener("click",e=>{
  if(notificationPanel&&notificationPanel.classList.contains("show")&&notificationWrap&&!notificationWrap.contains(e.target)){
    closeNotificationPanel();
  }
});

let inventoryData={items:[],batches:[],counts:{},settings:{}};

function firstAvailableOpsPanel(){
  if(canFeature("INVENTORY"))return "inventory";
  if(canFeature("VOID_RECEIPT"))return "void";
  if(canFeature("MANAGE_STAFF"))return "staff";
  if(canFeature("MANAGE_SERVICES"))return "services";
  if(canFeature("VIEW_SCHEDULE"))return "schedule";
  if(canFeature("WHATSAPP_REMINDERS"))return "whatsapp";
  if(canFeature("CRM"))return "crm";
  return "";
}

function loadOps(){
  const first=firstAvailableOpsPanel();
  if(first)showOpsPanel(first);
}

function showOpsPanel(panel){
  const permissionMap={
    inventory:"INVENTORY",
    void:"VOID_RECEIPT",
    staff:"MANAGE_STAFF",
    services:"MANAGE_SERVICES",
    schedule:"VIEW_SCHEDULE",
    whatsapp:"WHATSAPP_REMINDERS",
    crm:"CRM"
  };

  if(!canFeature(permissionMap[panel])){
    const fallback=firstAvailableOpsPanel();
    if(fallback&&fallback!==panel)return showOpsPanel(fallback);
    return;
  }

  const map={
    inventory:[opsInventory,opsInventoryBtn],
    void:[opsVoid,opsVoidBtn],
    staff:[opsStaff,opsStaffBtn],
    services:[opsServices,opsServicesBtn],
    schedule:[opsSchedule,opsScheduleBtn],
    whatsapp:[opsWhatsApp,opsWhatsAppBtn],
    crm:[opsCRM,opsCRMBtn]
  };

  Object.entries(map).forEach(([key,[section,button]])=>{
    const active=key===panel;
    section.classList.toggle("active",active);
    button.classList.toggle("active",active);
  });

  if(panel==="inventory")loadInventory();
  if(panel==="staff")loadOpsStaff();
  if(panel==="services")loadOpsServices();
  if(panel==="schedule")loadSchedule();
  if(panel==="whatsapp")loadWhatsAppCenter();
}

function loadInventory(){
  inventoryItemsResult.innerHTML="Loading inventory...";
  inventoryBatchesResult.innerHTML="Loading batches...";

  google.script.run
    .withSuccessHandler(renderInventory)
    .withFailureHandler(err)
    .webInventoryOverview(authToken);
}

function renderInventory(data){
  inventoryData=data||{items:[],batches:[],counts:{},settings:{}};

  const c=inventoryData.counts||{};
  invCountItems.textContent=Number(c.items||0);
  invCountOpened.textContent=Number(c.opened||0);
  invCountExpiring.textContent=Number(c.expiring||0);
  invCountExpired.textContent=Number(c.expired||0);
  invCountLow.textContent=Number(c.lowStock||0);

  const settings=inventoryData.settings||{};
  invWarningText.textContent=
    "Warning: "+Number(settings.warningDays||30)+
    " days • Critical: "+Number(settings.criticalDays||7)+" days";

  invReceiveItem.innerHTML='<option value="">Select item...</option>';

  (inventoryData.items||[])
    .filter(x=>String(x.status).toLowerCase()==="active")
    .forEach(x=>{
      invReceiveItem.add(
        new Option(
          (x.category?x.category+" — ":"")+x.name,
          x.itemId
        )
      );
    });

  const itemRows=(inventoryData.items||[]).map(x=>`
    <tr>
      <td>
        <b>${esc(x.name)}</b>
        <br><span class="muted">${esc(x.category||"")}</span>
      </td>
      <td>${esc(x.unit||"")}</td>
      <td class="${x.lowStock?"inv-low":"money"}">
        ${Number(x.stock||0).toFixed(2)}
        ${x.lowStock?'<br><span class="muted">LOW STOCK</span>':""}
      </td>
      <td>${Number(x.lowStockLevel||0).toFixed(2)}</td>
      <td>${Number(x.batchCount||0)}</td>
      <td><span class="inv-warning ${esc((x.warning||{}).level||"none")}">${esc((x.warning||{}).label||"—")}</span></td>
      <td><span class="manager-badge ${String(x.status).toLowerCase()==="active"?"active":"voided"}">${esc(x.status)}</span></td>
      <td>
        <div class="manager-row-actions">
          <button class="manager-action-btn" onclick="editInventoryItem('${jsString(x.itemId)}')">Edit</button>
          <button class="manager-action-btn ${String(x.status).toLowerCase()==="active"?"danger":"activate"}"
            onclick="setInventoryItemActive('${jsString(x.itemId)}',${String(x.status).toLowerCase()!=="active"})">
            ${String(x.status).toLowerCase()==="active"?"Deactivate":"Activate"}
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  inventoryItemsResult.innerHTML=`
    <div class="manager-table-wrap">
      <table class="manager-table">
        <thead>
          <tr>
            <th>Item</th><th>Unit</th><th>Stock</th><th>Low Level</th>
            <th>Batches</th><th>Expiry</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${itemRows||'<tr><td colspan="8" class="manager-empty">No inventory items yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  const batchRows=(inventoryData.batches||[]).map(b=>`
    <tr>
      <td><b>${esc(b.itemName)}</b><br><span class="muted">${esc(b.batchId)}</span></td>
      <td>${Number(b.qtyRemaining||0).toFixed(2)} / ${Number(b.qtyReceived||0).toFixed(2)}</td>
      <td>${esc(b.receivedDate||"—")}</td>
      <td>${esc(b.expiryDate||"—")}</td>
      <td>
        ${b.opened
          ? `<span class="inv-opened">Opened</span>${b.openedDate?`<br><span class="muted">${esc(b.openedDate)}</span>`:""}`
          : `<span class="muted">Unopened</span>`
        }
      </td>
      <td><span class="inv-warning ${esc((b.warning||{}).level||"none")}">${esc((b.warning||{}).label||"—")}</span></td>
      <td>${esc(b.status||"")}</td>
      <td>
        <div class="manager-row-actions">
          ${!b.opened && Number(b.qtyRemaining||0)>0
            ? `<button class="manager-action-btn activate" onclick="openInventoryBatch('${jsString(b.batchId)}')">Mark Opened</button>`
            : ""
          }
          <button class="manager-action-btn" onclick="adjustInventoryBatch('${jsString(b.batchId)}',${Number(b.qtyRemaining||0)})">Adjust Qty</button>
        </div>
      </td>
    </tr>
  `).join("");

  inventoryBatchesResult.innerHTML=`
    <div class="manager-table-wrap">
      <table class="manager-table">
        <thead>
          <tr>
            <th>Item / Batch</th><th>Remaining / Received</th><th>Received</th>
            <th>Expiry</th><th>Opened</th><th>Warning</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${batchRows||'<tr><td colspan="8" class="manager-empty">No stock batches yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  if(!invReceivedDate.value){
    invReceivedDate.value=initData.today||"";
  }
  setTimeout(loadSalonNotifications,120);
}

function editInventoryItem(itemId){
  const x=(inventoryData.items||[]).find(i=>i.itemId===itemId);
  if(!x)return;

  invOldItemId.value=x.itemId;
  invItemCategory.value=x.category||"";
  invItemName.value=x.name||"";
  invItemUnit.value=x.unit||"pcs";
  invItemLow.value=Number(x.lowStockLevel||0);
  invItemName.focus();
}

function clearInventoryItemForm(){
  invOldItemId.value="";
  invItemCategory.value="";
  invItemName.value="";
  invItemUnit.value="pcs";
  invItemLow.value=1;
}

function saveInventoryItem(){
  const payload={
    oldItemId:invOldItemId.value,
    category:invItemCategory.value.trim(),
    name:invItemName.value.trim(),
    unit:invItemUnit.value.trim(),
    lowStock:invItemLow.value
  };

  if(!payload.name){
    alert("Enter the item name.");
    return;
  }

  google.script.run
    .withSuccessHandler(()=>{
      clearInventoryItemForm();
      loadInventory();
    })
    .withFailureHandler(err)
    .webInventorySaveItem(authToken,payload);
}

function setInventoryItemActive(itemId,active){
  if(!confirm((active?"Activate":"Deactivate")+" this inventory item?"))return;

  google.script.run
    .withSuccessHandler(loadInventory)
    .withFailureHandler(err)
    .webInventorySetItemActive(authToken,itemId,active);
}

function receiveInventoryItem(){
  const payload={
    itemId:invReceiveItem.value,
    qty:invReceiveQty.value,
    receivedDate:invReceivedDate.value,
    expiryDate:invExpiryDate.value,
    note:invReceiveNote.value.trim()
  };

  if(!payload.itemId){
    alert("Select an inventory item.");
    return;
  }

  google.script.run
    .withSuccessHandler(result=>{
      invReceiveQty.value=1;
      invExpiryDate.value="";
      invReceiveNote.value="";
      alert("Item received. Batch: "+result.batchId);
      loadInventory();
    })
    .withFailureHandler(err)
    .webInventoryReceiveItem(authToken,payload);
}

function openInventoryBatch(batchId){
  if(!confirm("Mark this stock batch as Opened today?"))return;

  google.script.run
    .withSuccessHandler(loadInventory)
    .withFailureHandler(err)
    .webInventoryOpenBatch(authToken,batchId);
}

function adjustInventoryBatch(batchId,currentQty){
  const value=prompt(
    "Enter the NEW remaining quantity for this batch:",
    Number(currentQty||0)
  );

  if(value===null)return;

  const qty=Number(value);

  if(!Number.isFinite(qty)||qty<0){
    alert("Enter a valid quantity.");
    return;
  }

  const note=prompt(
    "Reason / note (optional):",
    "Used / stock count correction"
  );

  if(note===null)return;

  google.script.run
    .withSuccessHandler(loadInventory)
    .withFailureHandler(err)
    .webInventoryAdjustBatch(authToken,batchId,qty,note);
}


// ---------------- STAFF RECEIPT CORRECTION ----------------

function searchOpsTransactions(){
  const q=opsTxSearch.value.trim();

  if(!q){
    alert("Enter a Sale ID, client, phone, or date.");
    return;
  }

  opsTxResult.innerHTML="Searching...";

  google.script.run
    .withSuccessHandler(data=>{
      const rows=(data||[]).map(t=>`
        <tr>
          <td>${esc(t.date)}</td>
          <td>${esc(t.saleId)}</td>
          <td><b>${esc(t.client)}</b><br><span class="muted">${esc(t.phone)}</span></td>
          <td>${esc(t.paymentMethod)}</td>
          <td class="money">${Number(t.total||0).toFixed(3)}</td>
          <td><span class="manager-badge ${String(t.status).toLowerCase()==="active"?"active":"voided"}">${esc(t.status)}</span></td>
          <td>${esc(t.services||"")}</td>
          <td>
            ${String(t.status).toLowerCase()==="active"
              ? `<button class="manager-action-btn danger" onclick="openVoidModal('${jsString(t.saleId)}','ops')">Void Receipt</button>`
              : `<span class="muted">${esc(t.voidReason||"")}</span>`
            }
          </td>
        </tr>
      `).join("");

      opsTxResult.innerHTML=`
        <div class="manager-table-wrap">
          <table class="manager-table">
            <thead>
              <tr>
                <th>Date</th><th>Sale ID</th><th>Client</th><th>Payment</th>
                <th>Total KD</th><th>Status</th><th>Services</th><th>Action</th>
              </tr>
            </thead>
            <tbody>${rows||'<tr><td colspan="8" class="manager-empty">No matching transactions.</td></tr>'}</tbody>
          </table>
        </div>
      `;
    })
    .withFailureHandler(err)
    .webOpsSearchTransactions(authToken,q);
}


// ---------------- STAFF ENCODING: STAFF ----------------

function loadOpsStaff(){
  opsStaffResult.innerHTML="Loading staff...";

  google.script.run
    .withSuccessHandler(data=>{
      const rows=(data||[]).map(x=>`
        <tr>
          <td><b>${esc(x.name)}</b></td>
          <td class="money">${Number(x.target||0).toFixed(3)}</td>
          <td><span class="manager-badge ${String(x.status).toLowerCase()==="active"?"active":"voided"}">${esc(x.status)}</span></td>
          <td>
            <div class="manager-row-actions">
              <button class="manager-action-btn" onclick="editOpsStaff('${jsString(x.name)}',${Number(x.target||0)})">Edit</button>
              <button class="manager-action-btn ${String(x.status).toLowerCase()==="active"?"danger":"activate"}"
                onclick="setOpsStaffActive('${jsString(x.name)}',${String(x.status).toLowerCase()!=="active"})">
                ${String(x.status).toLowerCase()==="active"?"Deactivate":"Activate"}
              </button>
            </div>
          </td>
        </tr>
      `).join("");

      opsStaffResult.innerHTML=`
        <div class="manager-table-wrap">
          <table class="manager-table">
            <thead><tr><th>Staff</th><th>Monthly Target KD</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="4" class="manager-empty">No staff yet.</td></tr>'}</tbody>
          </table>
        </div>
      `;
    })
    .withFailureHandler(err)
    .webManagerGetStaff(authToken);
}

function editOpsStaff(name,target){
  opsStaffOldName.value=name;
  opsStaffName.value=name;
  opsStaffTarget.value=Number(target||0);
  opsStaffName.focus();
}

function clearOpsStaffForm(){
  opsStaffOldName.value="";
  opsStaffName.value="";
  opsStaffTarget.value=0;
}

function saveOpsStaff(){
  const payload={
    oldName:opsStaffOldName.value,
    name:opsStaffName.value.trim(),
    target:opsStaffTarget.value
  };

  if(!payload.name){
    alert("Enter the staff name.");
    return;
  }

  google.script.run
    .withSuccessHandler(()=>{
      clearOpsStaffForm();
      loadOpsStaff();
      refreshMasterData();
    })
    .withFailureHandler(err)
    .webManagerSaveStaff(authToken,payload);
}

function setOpsStaffActive(name,active){
  if(!confirm((active?"Activate ":"Deactivate ")+name+"?"))return;

  google.script.run
    .withSuccessHandler(()=>{
      loadOpsStaff();
      refreshMasterData();
    })
    .withFailureHandler(err)
    .webManagerSetStaffActive(authToken,name,active);
}


// ---------------- STAFF ENCODING: SERVICES ----------------

function loadOpsServices(){
  opsServicesResult.innerHTML="Loading services...";

  google.script.run
    .withSuccessHandler(data=>{
      const rows=(data||[]).map(x=>`
        <tr>
          <td>${esc(x.category||"")}</td>
          <td><b>${esc(x.name)}</b></td>
          <td class="money">${Number(x.price||0).toFixed(3)}</td>
          <td>${Number(x.duration||60)} min</td>
          <td><span class="manager-badge ${String(x.status).toLowerCase()==="active"?"active":"voided"}">${esc(x.status)}</span></td>
          <td>
            <div class="manager-row-actions">
              <button class="manager-action-btn"
                onclick="editOpsService('${jsString(x.category)}','${jsString(x.name)}',${Number(x.price||0)},${Number(x.duration||60)})">Edit</button>
              <button class="manager-action-btn ${String(x.status).toLowerCase()==="active"?"danger":"activate"}"
                onclick="setOpsServiceActive('${jsString(x.name)}',${String(x.status).toLowerCase()!=="active"})">
                ${String(x.status).toLowerCase()==="active"?"Deactivate":"Activate"}
              </button>
            </div>
          </td>
        </tr>
      `).join("");

      opsServicesResult.innerHTML=`
        <div class="manager-table-wrap">
          <table class="manager-table">
            <thead><tr><th>Category</th><th>Service</th><th>Price KD</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="6" class="manager-empty">No services yet.</td></tr>'}</tbody>
          </table>
        </div>
      `;
    })
    .withFailureHandler(err)
    .webManagerGetServices(authToken);
}

function editOpsService(category,name,price,duration){
  opsServiceOldName.value=name;
  opsServiceCategory.value=category;
  opsServiceName.value=name;
  opsServicePrice.value=Number(price||0);
  opsServiceDuration.value=Number(duration||60);
  opsServiceName.focus();
}

function clearOpsServiceForm(){
  opsServiceOldName.value="";
  opsServiceCategory.value="";
  opsServiceName.value="";
  opsServicePrice.value=0;
  opsServiceDuration.value=60;
}

function saveOpsService(){
  const payload={
    oldName:opsServiceOldName.value,
    category:opsServiceCategory.value.trim(),
    name:opsServiceName.value.trim(),
    price:opsServicePrice.value,
    duration:opsServiceDuration.value
  };

  if(!payload.name){
    alert("Enter the service name.");
    return;
  }

  google.script.run
    .withSuccessHandler(()=>{
      clearOpsServiceForm();
      loadOpsServices();
      refreshMasterData();
    })
    .withFailureHandler(err)
    .webManagerSaveService(authToken,payload);
}

function setOpsServiceActive(name,active){
  if(!confirm((active?"Activate ":"Deactivate ")+name+"?"))return;

  google.script.run
    .withSuccessHandler(()=>{
      loadOpsServices();
      refreshMasterData();
    })
    .withFailureHandler(err)
    .webManagerSetServiceActive(authToken,name,active);
}


// =========================================================
// V9 STAFF SCHEDULE
// =========================================================

let scheduleData={staff:[],days:[],schedule:[],timeOff:[]};

function loadSchedule(){
  scheduleResult.innerHTML="Loading schedule...";
  timeOffResult.innerHTML="Loading time off...";

  document.querySelectorAll(".schedule-manage").forEach(el=>{
    el.style.display=canFeature("MANAGE_SCHEDULE")?"":"none";
  });

  google.script.run
    .withSuccessHandler(renderSchedule)
    .withFailureHandler(err)
    .webScheduleOverview(authToken);
}

function renderSchedule(data){
  scheduleData=data||scheduleData;

  const staff=scheduleData.staff||[];

  [scheduleStaff,timeOffStaff].forEach(sel=>{
    sel.innerHTML="";
    staff.forEach(name=>sel.add(new Option(name,name)));
  });

  if(!timeOffDate.value){
    timeOffDate.value=initData.today||"";
  }

  const dayOrder={
    Monday:1,Tuesday:2,Wednesday:3,Thursday:4,
    Friday:5,Saturday:6,Sunday:7
  };

  const rows=(scheduleData.schedule||[])
    .slice()
    .sort((a,b)=>
      a.staff.localeCompare(b.staff)||
      (dayOrder[a.day]||9)-(dayOrder[b.day]||9)
    )
    .map(x=>`
      <tr>
        <td><b>${esc(x.staff)}</b></td>
        <td class="schedule-table-day">${esc(x.day)}</td>
        <td>${x.working?'<span class="manager-badge active">Working</span>':'<span class="manager-badge voided">Off</span>'}</td>
        <td>${x.working?esc(x.start||"—")+" – "+esc(x.end||"—"):"—"}</td>
        <td>${x.breakStart&&x.breakEnd?esc(x.breakStart)+" – "+esc(x.breakEnd):"—"}</td>
        <td>
          ${canFeature("MANAGE_SCHEDULE")
            ? `<button class="manager-action-btn" onclick="editSchedule('${jsString(x.staff)}','${jsString(x.day)}')">Edit</button>`
            : ""
          }
        </td>
      </tr>
    `).join("");

  scheduleResult.innerHTML=`
    <div class="manager-table-wrap">
      <table class="manager-table">
        <thead><tr><th>Staff</th><th>Day</th><th>Status</th><th>Shift</th><th>Break</th><th>Action</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="6" class="manager-empty">No schedule rows yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  const offRows=(scheduleData.timeOff||[]).map(x=>`
    <tr>
      <td><b>${esc(x.staff)}</b></td>
      <td>${esc(x.dateLabel||x.date)}</td>
      <td>${x.allDay?"All day":esc(x.start||"")+" – "+esc(x.end||"")}</td>
      <td>${esc(x.reason||"—")}</td>
      <td>
        ${canFeature("MANAGE_SCHEDULE")
          ? `<button class="manager-action-btn danger" onclick="cancelStaffTimeOff('${jsString(x.id)}')">Remove</button>`
          : ""
        }
      </td>
    </tr>
  `).join("");

  timeOffResult.innerHTML=`
    <div class="manager-table-wrap">
      <table class="manager-table">
        <thead><tr><th>Staff</th><th>Date</th><th>Time</th><th>Reason</th><th>Action</th></tr></thead>
        <tbody>${offRows||'<tr><td colspan="5" class="manager-empty">No upcoming time off.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function editSchedule(staff,day){
  const x=(scheduleData.schedule||[]).find(
    r=>r.staff===staff&&r.day===day
  );

  if(!x)return;

  scheduleStaff.value=staff;
  scheduleDay.value=day;
  scheduleWorking.checked=Boolean(x.working);
  scheduleStart.value=x.start||"09:00";
  scheduleEnd.value=x.end||"20:00";
  scheduleBreakStart.value=x.breakStart||"";
  scheduleBreakEnd.value=x.breakEnd||"";
  scheduleStaff.scrollIntoView({behavior:"smooth",block:"center"});
}

function saveStaffSchedule(){
  const payload={
    staff:scheduleStaff.value,
    day:scheduleDay.value,
    working:scheduleWorking.checked,
    start:scheduleStart.value,
    end:scheduleEnd.value,
    breakStart:scheduleBreakStart.value,
    breakEnd:scheduleBreakEnd.value
  };

  google.script.run
    .withSuccessHandler(loadSchedule)
    .withFailureHandler(err)
    .webScheduleSave(authToken,payload);
}

function toggleTimeOffTimes(){
  const disabled=timeOffAllDay.checked;
  timeOffStart.disabled=disabled;
  timeOffEnd.disabled=disabled;
  if(disabled){
    timeOffStart.value="";
    timeOffEnd.value="";
  }
}

function addStaffTimeOff(){
  const payload={
    staff:timeOffStaff.value,
    date:timeOffDate.value,
    allDay:timeOffAllDay.checked,
    start:timeOffStart.value,
    end:timeOffEnd.value,
    reason:timeOffReason.value.trim()
  };

  google.script.run
    .withSuccessHandler(()=>{
      timeOffReason.value="";
      loadSchedule();
    })
    .withFailureHandler(err)
    .webScheduleAddTimeOff(authToken,payload);
}

function cancelStaffTimeOff(id){
  if(!confirm("Remove this time-off block?"))return;

  google.script.run
    .withSuccessHandler(loadSchedule)
    .withFailureHandler(err)
    .webScheduleCancelTimeOff(authToken,id);
}


// =========================================================
// V9 WHATSAPP REMINDER CENTER
// =========================================================

function loadWhatsAppCenter(){
  whatsappResult.innerHTML="Loading reminders...";

  google.script.run
    .withSuccessHandler(data=>{
      const items=(data&&data.items)||[];
      waDueCount.textContent=items.length;

      const rows=items.map(x=>`
        <tr>
          <td>
            <b>${esc(x.typeLabel)}</b>
            <br><span class="muted">in ${Number(x.hoursUntil||0).toFixed(1)}h</span>
          </td>
          <td><b>${esc(x.client)}</b><br><span class="muted">${esc(x.phone)}</span></td>
          <td>${esc(x.date)}<br>${esc(x.time)}</td>
          <td>${esc(x.service)}<br><span class="muted">${esc(x.staff)}</span></td>
          <td class="wa-message">${esc(x.message)}</td>
          <td>
            <div class="manager-row-actions">
              ${x.url?`<button class="manager-action-btn activate" onclick="openWhatsApp('${jsString(x.url)}')">Open WhatsApp</button>`:""}
              <button class="manager-action-btn" onclick="markWhatsAppDone('${jsString(x.appointmentId)}','${jsString(x.type)}')">Mark Done</button>
            </div>
          </td>
        </tr>
      `).join("");

      whatsappResult.innerHTML=`
        <div class="manager-table-wrap">
          <table class="manager-table">
            <thead><tr><th>Reminder</th><th>Client</th><th>Appointment</th><th>Service</th><th>Message</th><th>Action</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="6" class="manager-empty">No WhatsApp confirmations or reminders are due.</td></tr>'}</tbody>
          </table>
        </div>
      `;
    })
    .withFailureHandler(err)
    .webWhatsAppReminderCenter(authToken);
}

function openWhatsApp(url){
  window.open(url,"_blank","noopener");
}

function markWhatsAppDone(appointmentId,type){
  google.script.run
    .withSuccessHandler(loadWhatsAppCenter)
    .withFailureHandler(err)
    .webWhatsAppMarkDone(authToken,appointmentId,type);
}


// =========================================================
// V9 CRM / LOYALTY
// =========================================================

function searchCRM(){
  const q=crmSearch.value.trim();

  if(!q){
    alert("Enter a client name or mobile number.");
    return;
  }

  crmSearchResult.innerHTML='<div class="manager-empty">Searching...</div>';

  google.script.run
    .withSuccessHandler(data=>{
      const rows=(data||[]).map(x=>`
        <tr>
          <td><b>${esc(x.name||"Unnamed Client")}</b></td>
          <td>${esc(x.phone)}</td>
          <td>${Number(x.visits||0)}</td>
          <td class="money">${Number(x.spent||0).toFixed(3)}</td>
          <td>${Number(x.points||0)}</td>
          <td>${esc(x.lastVisit||"—")}</td>
          <td><button class="manager-action-btn" onclick="openCRMClient('${jsString(x.phone)}')">Open</button></td>
        </tr>
      `).join("");

      crmSearchResult.innerHTML=`
        <div class="manager-table-wrap">
          <table class="manager-table">
            <thead><tr><th>Client</th><th>Phone</th><th>Visits</th><th>Spend KD</th><th>Points</th><th>Last Visit</th><th></th></tr></thead>
            <tbody>${rows||'<tr><td colspan="7" class="manager-empty">No matching clients.</td></tr>'}</tbody>
          </table>
        </div>
      `;
    })
    .withFailureHandler(err)
    .webCRMSearch(authToken,q);
}

function openCRMClient(phoneValue){
  google.script.run
    .withSuccessHandler(renderCRMClient)
    .withFailureHandler(err)
    .webCRMClient(authToken,phoneValue);
}

function renderCRMClient(x){
  crmProfileCard.style.display="block";
  crmPhone.value=x.phone||"";
  crmName.value=x.name||"";
  crmBirthday.value=x.birthday||"";
  crmNotes.value=x.notes||"";

  crmPreferredStaff.innerHTML='<option value="">No preference</option>';
  (initData.staff||[]).forEach(name=>crmPreferredStaff.add(new Option(name,name)));
  crmPreferredStaff.value=x.preferredStaff||"";

  crmPoints.textContent=Number(x.points||0);
  crmVisits.textContent=Number(x.visits||0);
  crmSpend.textContent=Number(x.spend||0).toFixed(3)+" KD";
  crmRewards.textContent=Number(x.rewardsAvailable||0);
  crmProfileStats.textContent=
    (x.lastVisit?"Last visit "+x.lastVisit+" • ":"")+
    "Reward: "+Number(x.rewardThreshold||100)+" pts = "+Number(x.rewardValueKD||0).toFixed(3)+" KD";

  const rows=(x.recent||[]).map(r=>`
    <tr>
      <td>${esc(r.date)}</td>
      <td>${esc(r.saleId)}</td>
      <td>${esc(r.payment)}</td>
      <td class="money">${Number(r.total||0).toFixed(3)}</td>
    </tr>
  `).join("");

  crmRecent.innerHTML=`
    <div class="manager-table-wrap">
      <table class="manager-table">
        <thead><tr><th>Date</th><th>Sale ID</th><th>Payment</th><th>Total KD</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="4" class="manager-empty">No active visits yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function saveCRMClient(){
  const payload={
    phone:crmPhone.value,
    name:crmName.value.trim(),
    birthday:crmBirthday.value,
    preferredStaff:crmPreferredStaff.value,
    notes:crmNotes.value.trim()
  };

  google.script.run
    .withSuccessHandler(()=>{
      alert("CRM profile saved.");
      openCRMClient(payload.phone);
    })
    .withFailureHandler(err)
    .webCRMSave(authToken,payload);
}

function adjustCRMPoints(){
  if(!crmPhone.value)return;

  const value=prompt(
    "Enter points to add or subtract. Example: 10 or -10",
    "10"
  );

  if(value===null)return;

  const delta=Number(value);

  if(!Number.isFinite(delta)||delta===0){
    alert("Enter a valid non-zero points adjustment.");
    return;
  }

  const note=prompt(
    "Reason for points adjustment:",
    "Loyalty adjustment"
  );

  if(note===null)return;

  google.script.run
    .withSuccessHandler(()=>{
      openCRMClient(crmPhone.value);
    })
    .withFailureHandler(err)
    .webCRMAdjustPoints(authToken,crmPhone.value,delta,note);
}


// =========================================================
// V9 PAYROLL
// =========================================================

function loadPayroll(){
  if(!payrollMonth.value && initData.today){
    payrollMonth.value=initData.today.slice(0,7);
  }

  payrollRuleCard.style.display=
    canFeature("MANAGE_PAYROLL")?"":"none";

  google.script.run
    .withSuccessHandler(rules=>{
      payrollStaff.innerHTML="";
      (rules||[]).forEach(x=>{
        const option=new Option(x.staff,x.staff);
        option.dataset.commission=x.commissionRate;
        option.dataset.base=x.baseSalary;
        payrollStaff.add(option);
      });

      payrollStaff.onchange=()=>{
        const o=payrollStaff.options[payrollStaff.selectedIndex];
        payrollCommission.value=o?Number(o.dataset.commission||0):0;
        payrollBase.value=o?Number(o.dataset.base||0):0;
      };

      if(payrollStaff.options.length){
        payrollStaff.dispatchEvent(new Event("change"));
      }
    })
    .withFailureHandler(err)
    .webPayrollRules(authToken);

  loadPayrollReport();
}

function loadPayrollReport(){
  if(!payrollMonth.value)return;

  payrollResult.innerHTML="Loading payroll...";

  google.script.run
    .withSuccessHandler(data=>{
      const t=data.totals||{};
      payrollSalesTotal.textContent=Number(t.sales||0).toFixed(3);
      payrollCommissionTotal.textContent=Number(t.commission||0).toFixed(3);
      payrollBaseTotal.textContent=Number(t.baseSalary||0).toFixed(3);
      payrollGrandTotal.textContent=Number(t.estimatedPay||0).toFixed(3);

      const rows=(data.rows||[]).map(x=>`
        <tr>
          <td><b>${esc(x.staff)}</b></td>
          <td class="money">${Number(x.sales||0).toFixed(3)}</td>
          <td>${Number(x.target||0).toFixed(3)}</td>
          <td>${Number(x.targetPercent||0).toFixed(1)}%</td>
          <td>${Number(x.commissionRate||0).toFixed(2)}%</td>
          <td class="money">${Number(x.commissionAmount||0).toFixed(3)}</td>
          <td class="money">${Number(x.baseSalary||0).toFixed(3)}</td>
          <td class="money"><b>${Number(x.estimatedPay||0).toFixed(3)}</b></td>
        </tr>
      `).join("");

      payrollResult.innerHTML=`
        <div class="title"><h2>${esc(data.month||"Payroll")}</h2></div>
        <div class="manager-table-wrap">
          <table class="manager-table">
            <thead><tr><th>Staff</th><th>Sales</th><th>Target</th><th>Target %</th><th>Commission %</th><th>Commission KD</th><th>Base KD</th><th>Estimated Pay KD</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="8" class="manager-empty">No staff data for this month.</td></tr>'}</tbody>
          </table>
        </div>
      `;
    })
    .withFailureHandler(err)
    .webPayrollReport(authToken,payrollMonth.value);
}

function savePayrollRule(){
  const payload={
    staff:payrollStaff.value,
    commission:payrollCommission.value,
    baseSalary:payrollBase.value
  };

  google.script.run
    .withSuccessHandler(()=>{
      alert("Payroll rule saved.");
      loadPayroll();
    })
    .withFailureHandler(err)
    .webPayrollSaveRule(authToken,payload);
}


// =========================================================
// V9 GRANULAR PERMISSIONS
// =========================================================

let permissionData=null;

function loadPermissions(){
  permissionResult.innerHTML="Loading permissions...";

  google.script.run
    .withSuccessHandler(data=>{
      permissionData=data;
      renderPermissions();
    })
    .withFailureHandler(err)
    .webPermissionMatrix(authToken);
}

function renderPermissions(){
  if(!permissionData)return;

  const roles=permissionData.roles||[];
  const defs=permissionData.definitions||[];
  const matrix=permissionData.matrix||{};

  const headers=roles.map(r=>`<th>${esc(r)}</th>`).join("");

  const rows=defs.map(def=>`
    <tr>
      <td>
        <b>${esc(def.label)}</b>
        <div class="permission-desc">${esc(def.description||"")}</div>
      </td>
      ${roles.map(role=>{
        const checked=Boolean(matrix[role]&&matrix[role][def.key]);
        const disabled=role==="ADMIN"||!permissionData.canEdit;
        return `<td class="${checked?"permission-yes":"permission-no"}"><input type="checkbox" data-role="${esc(role)}" data-key="${esc(def.key)}" ${checked?"checked":""} ${disabled?"disabled":""}></td>`;
      }).join("")}
    </tr>
  `).join("");

  permissionResult.innerHTML=`
    <div class="manager-table-wrap">
      <table class="manager-table permission-table">
        <thead><tr><th>Feature</th>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  savePermissionsBtn.style.display=permissionData.canEdit?"":"none";
}

function savePermissions(){
  if(!permissionData||!permissionData.canEdit)return;

  const matrix=JSON.parse(JSON.stringify(permissionData.matrix||{}));

  permissionResult.querySelectorAll('input[type="checkbox"][data-role]').forEach(cb=>{
    const role=cb.dataset.role;
    const key=cb.dataset.key;
    matrix[role]=matrix[role]||{};
    matrix[role][key]=cb.checked;
  });

  google.script.run
    .withSuccessHandler(()=>{
      alert("Permissions saved. Users will receive the new permissions on their next request/login.");
      loadPermissions();
    })
    .withFailureHandler(err)
    .webSavePermissionMatrix(authToken,{matrix});
}

function openManagerConsole(){
  if(!authPermissions.manager){
    alert("Manager access is restricted to MANAGER and ADMIN accounts.");
    return;
  }
  managerUnlocked=true;
  showView("manager");
  const first=firstAvailableManagerPanel();
  if(first)showManagerPanel(first);
}

function closeManagerLogin(){
  managerLoginModal.classList.remove("show");
}

function managerLogin(){
  openManagerConsole();
}

function managerLogout(){
  showView("sale");
}

function managerPanelPermission(panel){
  return {
    clients:"CLIENT_HISTORY",
    transactions:"TRANSACTIONS",
    staff:"MANAGE_STAFF",
    services:"MANAGE_SERVICES",
    payroll:"VIEW_PAYROLL",
    permissions:"MANAGE_PERMISSIONS"
  }[panel]||"";
}

function firstAvailableManagerPanel(){
  for(const panel of ["clients","transactions","staff","services","payroll","permissions"]){
    if(canFeature(managerPanelPermission(panel)))return panel;
  }
  return "";
}

function showManagerPanel(panel){
  if(!canFeature(managerPanelPermission(panel))){
    const fallback=firstAvailableManagerPanel();
    if(fallback&&fallback!==panel)return showManagerPanel(fallback);
    return;
  }

  const map={
    clients:[managerClients,mgrClientBtn],
    transactions:[managerTransactions,mgrTxBtn],
    staff:[managerStaff,mgrStaffBtn],
    services:[managerServices,mgrServicesBtn],
    payroll:[managerPayroll,mgrPayrollBtn],
    permissions:[managerPermissions,mgrPermissionsBtn]
  };

  Object.entries(map).forEach(([key,[section,button]])=>{
    const active=key===panel;
    section.classList.toggle("active",active);
    button.classList.toggle("active",active);
  });

  if(panel==="staff")loadManagerStaff();
  if(panel==="services")loadManagerServices();
  if(panel==="payroll")loadPayroll();
  if(panel==="permissions")loadPermissions();
}

function searchManagerClient(){
  if(!managerUnlocked)return openManagerConsole();

  const q=managerClientSearch.value.trim();

  if(!q){
    alert("Enter a client name or mobile number.");
    return;
  }

  managerClientResult.innerHTML='<div class="card manager-empty">Searching...</div>';

  google.script.run
    .withSuccessHandler(renderManagerClient)
    .withFailureHandler(err)
    .webManagerClientHistory(authToken,q);
}

function renderManagerClient(data){
  if(!data || !data.found){
    managerClientResult.innerHTML='<div class="card manager-empty">No matching client found.</div>';
    return;
  }

  const services=(data.topServices||[]).map(x=>esc(x.name)+" ("+x.count+")").join(", ")||"—";
  const staff=(data.topStaff||[]).map(x=>esc(x.name)+" ("+x.count+")").join(", ")||"—";

  const rows=(data.transactions||[]).map(t=>`
    <tr>
      <td>${esc(t.date)}</td>
      <td>${esc(t.saleId)}</td>
      <td>${esc(t.paymentMethod)}</td>
      <td class="money">${Number(t.total||0).toFixed(3)}</td>
      <td><span class="manager-badge ${String(t.status).toLowerCase()==="active"?"active":"voided"}">${esc(t.status)}</span></td>
      <td>${esc(t.services||"")}</td>
    </tr>
  `).join("");

  managerClientResult.innerHTML=`
    <div class="card">
      <div class="client-profile-head">
        <div>
          <div class="client-profile-name">${esc(data.name)}</div>
          <div class="client-profile-phone">${esc(data.phone)}</div>
        </div>
        <span class="manager-badge active">Client Profile</span>
      </div>

      <div class="manager-kpis">
        <div class="manager-kpi"><small>Total Visits</small><strong>${Number(data.visits||0)}</strong></div>
        <div class="manager-kpi"><small>Lifetime Spend</small><strong>${kd(data.lifetimeSpend)}</strong></div>
        <div class="manager-kpi"><small>Average Spend</small><strong>${kd(data.averageSpend)}</strong></div>
        <div class="manager-kpi"><small>Last Visit</small><strong>${esc(data.lastVisit||"—")}</strong></div>
      </div>

      <div class="manager-highlight">
        <b>Top Services:</b> ${services}<br>
        <b>Preferred Staff:</b> ${staff}
      </div>
    </div>

    <div class="card">
      <div class="title">
        <h2>Visit History</h2>
        <span class="muted">${Number(data.transactions?.length||0)} transaction(s)</span>
      </div>

      <div class="manager-table-wrap">
        <table class="manager-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Sale ID</th>
              <th>Payment</th>
              <th>Total KD</th>
              <th>Status</th>
              <th>Services</th>
            </tr>
          </thead>
          <tbody>${rows||'<tr><td colspan="6" class="manager-empty">No transactions.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

function searchManagerTransactions(){
  if(!managerUnlocked)return openManagerConsole();

  const q=managerTxSearch.value.trim();

  if(!q){
    alert("Enter a Sale ID, client, phone, or date.");
    return;
  }

  managerTransactionsResult.innerHTML='Searching...';

  google.script.run
    .withSuccessHandler(data=>{
      const rows=(data||[]).map(t=>`
        <tr>
          <td>${esc(t.date)}</td>
          <td>${esc(t.saleId)}</td>
          <td><b>${esc(t.client)}</b><br><span class="muted">${esc(t.phone)}</span></td>
          <td>${esc(t.paymentMethod)}</td>
          <td class="money">${Number(t.total||0).toFixed(3)}</td>
          <td><span class="manager-badge ${String(t.status).toLowerCase()==="active"?"active":"voided"}">${esc(t.status)}</span></td>
          <td>${esc(t.services||"")}</td>
          <td>
            ${String(t.status).toLowerCase()==="active"
              ? `<button class="manager-action-btn danger" onclick="openVoidModal('${jsString(t.saleId)}')">Void</button>`
              : `<span class="muted">${esc(t.voidReason||"")}</span>`
            }
          </td>
        </tr>
      `).join("");

      managerTransactionsResult.innerHTML=`
        <div class="manager-table-wrap">
          <table class="manager-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Sale ID</th>
                <th>Client</th>
                <th>Payment</th>
                <th>Total KD</th>
                <th>Status</th>
                <th>Services</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>${rows||'<tr><td colspan="8" class="manager-empty">No matching transactions.</td></tr>'}</tbody>
          </table>
        </div>
      `;
    })
    .withFailureHandler(err)
    .webManagerSearchTransactions(authToken,q);
}


let pendingVoidSaleId="";
let pendingVoidSource="manager";

function jsString(v){
  return String(v||"")
    .replace(/\\/g,"\\\\")
    .replace(/'/g,"\\'");
}

function openVoidModal(saleId,source){
  pendingVoidSaleId=saleId;
  pendingVoidSource=source||"manager";
  voidSaleText.textContent="Sale ID: "+saleId;
  voidReasonSelect.value="";
  voidReasonNote.value="";
  voidModal.classList.add("show");
}

function closeVoidModal(){
  voidModal.classList.remove("show");
  pendingVoidSaleId="";
  pendingVoidSource="manager";
}

function confirmVoidTransaction(){
  if(!pendingVoidSaleId)return;

  const base=voidReasonSelect.value;
  const note=voidReasonNote.value.trim();

  if(!base){
    alert("Please select a void reason.");
    return;
  }

  const reason=base+(note?" • "+note:"");

  if(!confirm("Void transaction "+pendingVoidSaleId+"? This will remove it from active sales reports.")){
    return;
  }

  overlay.classList.add("show");

  google.script.run
    .withSuccessHandler(()=>{
      overlay.classList.remove("show");
      const old=pendingVoidSaleId;
      const source=pendingVoidSource;
      closeVoidModal();
      alert("Transaction "+old+" has been voided.");
      if(source==="ops")searchOpsTransactions();
      else searchManagerTransactions();
    })
    .withFailureHandler(err)
    .webManagerVoidTransaction(
      authToken,
      pendingVoidSaleId,
      reason
    );
}


function loadManagerStaff(){
  managerStaffResult.innerHTML="Loading staff...";

  google.script.run
    .withSuccessHandler(renderManagerStaff)
    .withFailureHandler(err)
    .webManagerGetStaff(authToken);
}

function renderManagerStaff(data){
  const rows=(data||[]).map(x=>`
    <tr>
      <td><b>${esc(x.name)}</b></td>
      <td class="money">${Number(x.target||0).toFixed(3)}</td>
      <td><span class="manager-badge ${String(x.status).toLowerCase()==="active"?"active":"voided"}">${esc(x.status)}</span></td>
      <td>
        <div class="manager-row-actions">
          <button class="manager-action-btn" onclick="editManagerStaff('${jsString(x.name)}',${Number(x.target||0)})">Edit</button>
          <button class="manager-action-btn ${String(x.status).toLowerCase()==="active"?"danger":"activate"}"
            onclick="setManagerStaffActive('${jsString(x.name)}',${String(x.status).toLowerCase()!=="active"})">
            ${String(x.status).toLowerCase()==="active"?"Deactivate":"Activate"}
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  managerStaffResult.innerHTML=`
    <div class="manager-table-wrap">
      <table class="manager-table">
        <thead><tr><th>Staff</th><th>Monthly Target KD</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="4" class="manager-empty">No staff yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function editManagerStaff(name,target){
  mgrStaffOldName.value=name;
  mgrStaffName.value=name;
  mgrStaffTarget.value=Number(target||0);
  mgrStaffName.focus();
}

function clearManagerStaffForm(){
  mgrStaffOldName.value="";
  mgrStaffName.value="";
  mgrStaffTarget.value=0;
}

function saveManagerStaff(){
  const payload={
    oldName:mgrStaffOldName.value,
    name:mgrStaffName.value.trim(),
    target:mgrStaffTarget.value
  };

  if(!payload.name){
    alert("Enter the staff name.");
    return;
  }

  google.script.run
    .withSuccessHandler(()=>{
      clearManagerStaffForm();
      loadManagerStaff();
      refreshMasterData();
    })
    .withFailureHandler(err)
    .webManagerSaveStaff(authToken,payload);
}

function setManagerStaffActive(name,active){
  if(!confirm((active?"Activate ":"Deactivate ")+name+"?"))return;

  google.script.run
    .withSuccessHandler(()=>{
      loadManagerStaff();
      refreshMasterData();
    })
    .withFailureHandler(err)
    .webManagerSetStaffActive(authToken,name,active);
}


function loadManagerServices(){
  managerServicesResult.innerHTML="Loading services...";

  google.script.run
    .withSuccessHandler(renderManagerServices)
    .withFailureHandler(err)
    .webManagerGetServices(authToken);
}

function renderManagerServices(data){
  const rows=(data||[]).map(x=>`
    <tr>
      <td>${esc(x.category||"")}</td>
      <td><b>${esc(x.name)}</b></td>
      <td class="money">${Number(x.price||0).toFixed(3)}</td>
      <td>${Number(x.duration||60)} min</td>
      <td><span class="manager-badge ${String(x.status).toLowerCase()==="active"?"active":"voided"}">${esc(x.status)}</span></td>
      <td>
        <div class="manager-row-actions">
          <button class="manager-action-btn"
            onclick="editManagerService('${jsString(x.category)}','${jsString(x.name)}',${Number(x.price||0)},${Number(x.duration||60)})">Edit</button>
          <button class="manager-action-btn ${String(x.status).toLowerCase()==="active"?"danger":"activate"}"
            onclick="setManagerServiceActive('${jsString(x.name)}',${String(x.status).toLowerCase()!=="active"})">
            ${String(x.status).toLowerCase()==="active"?"Deactivate":"Activate"}
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  managerServicesResult.innerHTML=`
    <div class="manager-table-wrap">
      <table class="manager-table">
        <thead><tr><th>Category</th><th>Service</th><th>Price KD</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="6" class="manager-empty">No services yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function editManagerService(category,name,price,duration){
  mgrServiceOldName.value=name;
  mgrServiceCategory.value=category;
  mgrServiceName.value=name;
  mgrServicePrice.value=Number(price||0);
  mgrServiceDuration.value=Number(duration||60);
  mgrServiceName.focus();
}

function clearManagerServiceForm(){
  mgrServiceOldName.value="";
  mgrServiceCategory.value="";
  mgrServiceName.value="";
  mgrServicePrice.value=0;
  mgrServiceDuration.value=60;
}

function saveManagerService(){
  const payload={
    oldName:mgrServiceOldName.value,
    category:mgrServiceCategory.value.trim(),
    name:mgrServiceName.value.trim(),
    price:mgrServicePrice.value,
    duration:mgrServiceDuration.value
  };

  if(!payload.name){
    alert("Enter the service name.");
    return;
  }

  google.script.run
    .withSuccessHandler(()=>{
      clearManagerServiceForm();
      loadManagerServices();
      refreshMasterData();
    })
    .withFailureHandler(err)
    .webManagerSaveService(authToken,payload);
}

function setManagerServiceActive(name,active){
  if(!confirm((active?"Activate ":"Deactivate ")+name+"?"))return;

  google.script.run
    .withSuccessHandler(()=>{
      loadManagerServices();
      refreshMasterData();
    })
    .withFailureHandler(err)
    .webManagerSetServiceActive(authToken,name,active);
}


function refreshMasterData(){
  google.script.run
    .withSuccessHandler(d=>{
      initData=d;
      setupAppointmentSelectors();

      // Rebuild blank/new sale rows so master lists refresh.
      if(!client.value && Number(currentNet||0)===0){
        services.innerHTML="";
        rowId=0;
        addService();
      }
    })
    .withFailureHandler(err)
    .webInit(authToken);
}

function setupAppointmentSelectors(){
  apptCountryCode.innerHTML=cc.innerHTML;

  apptStaff.innerHTML="";
  apptStaff.add(new Option("Select technician...",""));
  initData.staff.forEach(x=>apptStaff.add(new Option(x,x)));

  apptService.innerHTML="";
  apptService.add(new Option("Select service...",""));
  initData.services.forEach(x=>{
    apptService.add(new Option((x.category?x.category+" — ":"")+x.name,x.name));
  });
}

function appointmentDateKey(d){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+day;
}

function appointmentLabel(d){
  return d.toLocaleDateString(undefined,{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
}

function goAppointmentToday(){
  appointmentDate=new Date();
  appointmentDate.setHours(12,0,0,0);
  loadAppointments();
}

function changeAppointmentDate(direction){
  if(!appointmentDate)appointmentDate=new Date();
  appointmentDate.setDate(appointmentDate.getDate()+(appointmentMode==="week"?7:1)*direction);
  loadAppointments();
}

function setAppointmentMode(mode){
  appointmentMode=mode;
  apptDayBtn.classList.toggle("active",mode==="day");
  apptWeekBtn.classList.toggle("active",mode==="week");
  loadAppointments();
}

function loadAppointments(){
  if(!appointmentDate)appointmentDate=new Date();

  appointmentDateLabel.textContent=appointmentMode==="day"
    ? appointmentLabel(appointmentDate)
    : weekRangeLabel(appointmentDate);

  overlay.classList.add("show");

  google.script.run
    .withSuccessHandler(data=>{
      overlay.classList.remove("show");
      currentAppointments=data.appointments||[];
      if(appointmentMode==="day")renderDayAppointments(data);
      else renderWeekAppointments(data);
    })
    .withFailureHandler(err)
    .webGetAppointments(authToken,appointmentDateKey(appointmentDate),appointmentMode);
}

function weekStart(d){
  const x=new Date(d);
  const day=x.getDay();
  const diff=(day+6)%7;
  x.setDate(x.getDate()-diff);
  x.setHours(12,0,0,0);
  return x;
}

function weekRangeLabel(d){
  const s=weekStart(d),e=new Date(s);e.setDate(e.getDate()+6);
  const left=s.toLocaleDateString(undefined,{day:"2-digit",month:"short"});
  const right=e.toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"});
  return left+" – "+right;
}

const appointmentColors=["#E6EAFB","#F7E5D3","#E8DDF6","#DDF3E8","#F6DCEF","#F7F1B9","#DDEEF7"];

function renderDayAppointments(data){
  const staff=data.staff||initData.staff;
  const startHour=8,endHour=21,totalMinutes=(endHour-startHour)*60;

  let head='<div class="calendar-head" style="--staff-count:'+Math.max(staff.length,1)+'"><div class="corner"></div>';
  staff.forEach(s=>{
    const initials=s.split(/\s+/).map(x=>x[0]||"").join("").slice(0,2).toUpperCase();
    head+='<div class="staff-head"><span class="staff-avatar">'+esc(initials)+'</span>'+esc(s)+'</div>';
  });
  head+='</div>';

  let time='<div class="time-axis">';
  for(let h=startHour;h<endHour;h++){
    const label=new Date(2000,0,1,h).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
    time+='<div class="time-label">'+esc(label)+'</div>';
  }
  time+='</div>';

  let grid='<div class="staff-grid" style="--staff-count:'+Math.max(staff.length,1)+'">';
  staff.forEach((s,si)=>{
    grid+='<div class="staff-day-column" data-staff="'+esc(s)+'">';
    (data.appointments||[]).filter(a=>a.staff===s && a.status!=="Cancelled").forEach(a=>{
      const sm=timeMinutes(a.startTime),em=timeMinutes(a.endTime);
      const top=Math.max(0,(sm-startHour*60)/totalMinutes*780);
      const height=Math.max(34,(em-sm)/totalMinutes*780);
      const color=appointmentColors[si%appointmentColors.length];
      grid+='<div class="appointment-card" style="top:'+top+'px;height:'+height+'px;background:'+color+'" onclick="openAppointmentDetails(\''+jsq(a.id)+'\')">'+
        '<div class="appointment-time">'+esc(a.startTime)+'–'+esc(a.endTime)+'</div>'+
        '<div class="appointment-client">'+esc(a.client)+'</div>'+
        '<div class="appointment-service">'+esc(a.service)+'</div>'+
        '<div class="appointment-status">'+esc(a.status)+'</div>'+
      '</div>';
    });
    grid+='</div>';
  });
  grid+='</div>';

  appointmentCalendar.innerHTML='<div class="day-calendar">'+head+'<div class="calendar-body">'+time+grid+'</div></div>';
}

function renderWeekAppointments(data){
  const staff=data.staff||initData.staff;
  const dates=data.dates||[];
  let html='<div class="week-calendar"><div class="week-head"><div class="week-day-head">Staff</div>';
  dates.forEach(d=>{
    const x=new Date(d+"T12:00:00");
    html+='<div class="week-day-head">'+esc(x.toLocaleDateString(undefined,{weekday:"short",day:"2-digit",month:"short"}))+'</div>';
  });
  html+='</div>';

  staff.forEach((s,si)=>{
    html+='<div class="week-row"><div class="week-staff">'+esc(s)+'</div>';
    dates.forEach(date=>{
      html+='<div class="week-cell">';
      (data.appointments||[]).filter(a=>a.staff===s&&a.date===date&&a.status!=="Cancelled").forEach(a=>{
        html+='<div class="week-appt" style="background:'+appointmentColors[si%appointmentColors.length]+'" onclick="openAppointmentDetails(\''+jsq(a.id)+'\')"><b>'+esc(a.startTime)+'</b><br>'+esc(a.client)+'<br><span class="muted">'+esc(a.service)+'</span></div>';
      });
      html+='</div>';
    });
    html+='</div>';
  });
  html+='</div>';
  appointmentCalendar.innerHTML=html;
}

function timeMinutes(t){
  const p=String(t||"00:00").split(":");
  return Number(p[0])*60+Number(p[1]||0);
}

function jsq(v){
  return String(v||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'");
}

function openAppointmentModal(){
  appointmentModalTitle.textContent="New Appointment";
  appointmentModalStatus.textContent="";
  appointmentId.value="";
  apptClient.value="";
  apptCountryCode.value="+965";
  apptPhone.value="";
  apptDate.value=appointmentDateKey(appointmentDate||new Date());
  apptStaff.value="";
  apptService.value="";
  apptStart.value="09:00";
  apptEnd.value="10:00";
  apptNote.value="";
  apptStatus.value="Booked";
  apptDeleteBtn.style.display="none";
  apptStartSaleBtn.style.display="none";
  appointmentModal.classList.add("show");
}

function openAppointmentDetails(id){
  const a=currentAppointments.find(x=>String(x.id)===String(id));
  if(!a)return;

  appointmentModalTitle.textContent="Appointment";
  appointmentModalStatus.innerHTML='<span class="status-pill">'+esc(a.status)+'</span>';
  appointmentId.value=a.id;
  apptClient.value=a.client;
  splitAppointmentPhone(a.phone);
  apptDate.value=a.date;
  apptStaff.value=a.staff;
  apptService.value=a.service;
  apptStart.value=a.startTime;
  apptEnd.value=a.endTime;
  apptNote.value=a.note||"";
  apptStatus.value=a.status||"Booked";
  apptDeleteBtn.style.display=a.status==="Cancelled"?"none":"inline-flex";
  apptStartSaleBtn.style.display=a.status==="Cancelled"?"none":"inline-flex";
  appointmentModal.classList.add("show");
}

function splitAppointmentPhone(phoneValue){
  const p=String(phoneValue||"");
  let best="+965";
  [...apptCountryCode.options].forEach(o=>{
    if(p.startsWith(o.value)&&o.value.length>best.length)best=o.value;
  });
  apptCountryCode.value=best;
  apptPhone.value=p.startsWith(best)?p.slice(best.length):p.replace(/\D/g,"");
}

function closeAppointmentModal(){
  appointmentModal.classList.remove("show");
}

function appointmentFullPhone(){
  let code=apptCountryCode.value,num=apptPhone.value.replace(/\D/g,""),cd=code.replace(/\D/g,"");
  if(num.startsWith(cd)&&num.length>cd.length+4)num=num.slice(cd.length);
  if(num.startsWith("0"))num=num.slice(1);
  return num?code+num:"";
}

function saveAppointment(){
  const payload={
    id:appointmentId.value,
    client:apptClient.value.trim(),
    phone:appointmentFullPhone(),
    date:apptDate.value,
    startTime:apptStart.value,
    endTime:apptEnd.value,
    staff:apptStaff.value,
    service:apptService.value,
    note:apptNote.value.trim(),
    status:apptStatus.value
  };

  if(!payload.client){alert("Enter client name.");return}
  if(!payload.phone){alert("Enter mobile number.");return}
  if(!payload.date||!payload.startTime||!payload.endTime){alert("Select date and time.");return}
  if(!payload.staff){alert("Select technician.");return}
  if(!payload.service){alert("Select service.");return}
  if(timeMinutes(payload.endTime)<=timeMinutes(payload.startTime)){alert("End time must be after start time.");return}

  overlay.classList.add("show");
  google.script.run
    .withSuccessHandler(()=>{
      overlay.classList.remove("show");
      closeAppointmentModal();
      appointmentDate=new Date(payload.date+"T12:00:00");
      loadAppointments();
    })
    .withFailureHandler(err)
    .webSaveAppointment(authToken,payload);
}

function cancelAppointment(){
  const id=appointmentId.value;
  if(!id)return;
  if(!confirm("Cancel this appointment?"))return;
  overlay.classList.add("show");
  google.script.run
    .withSuccessHandler(()=>{
      overlay.classList.remove("show");
      closeAppointmentModal();
      loadAppointments();
    })
    .withFailureHandler(err)
    .webCancelAppointment(authToken,id);
}

function startSaleFromAppointment(){
  const id=appointmentId.value;
  const a=currentAppointments.find(x=>String(x.id)===String(id));
  if(!a)return;

  closeAppointmentModal();
  showView("sale");
  client.value=a.client;
  splitSalePhone(a.phone);

  services.innerHTML="";
  rowId=0;
  addService();

  const row=document.querySelector(".service-row");
  if(row){
    const svc=row.querySelector(".svc");
    svc.value=a.service;
    svc.dispatchEvent(new Event("change"));
    const tech=row.querySelector(".tech");
    if(tech)tech.value=a.staff;
  }

  note.value="Appointment "+a.startTime+"–"+a.endTime+(a.note?" • "+a.note:"");
  totals();

  google.script.run.webMarkAppointmentArrived(authToken,id);
}

function splitSalePhone(phoneValue){
  const p=String(phoneValue||"");
  let best="+965";
  [...cc.options].forEach(o=>{
    if(p.startsWith(o.value)&&o.value.length>best.length)best=o.value;
  });
  cc.value=best;
  phone.value=p.startsWith(best)?p.slice(best.length):p.replace(/\D/g,"");
}

function kd(v){return Number(v||0).toFixed(3)+" KD"}function esc(v){return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function err(e){
  overlay.classList.remove("show");
  const message=e&&e.message?e.message:String(e);

  if(message.includes("AUTH_REQUIRED")||message.includes("SESSION_EXPIRED")){
    logoutUser("Your session expired. Please sign in again.");
    return;
  }

  alert(message.replace("ACCESS_DENIED: ",""));
}
