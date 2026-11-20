const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DBKEY="duckyTickets_v3";
const SEQ=["yellow","orange","yellow","orange"];
const SECTIONS=[
 {id:"201",type:"green",x:330,y:74,w:42,h:75,rot:-3},{id:"202",type:"green",x:280,y:77,w:45,h:78,rot:-10},
 {id:"203",type:"green",x:380,y:74,w:42,h:75,rot:3},{id:"204",type:"green",x:220,y:90,w:52,h:90,rot:-15},
 {id:"205",type:"green",x:430,y:90,w:52,h:90,rot:15},{id:"206",type:"green",x:145,y:125,w:72,h:105,rot:-27},
 {id:"207",type:"green",x:495,y:125,w:72,h:105,rot:27},
 {id:"107",type:"yellow",x:300,y:160,w:160,h:62,rot:0},{id:"104",type:"yellow",x:294,y:230,w:172,h:70,rot:0},
 {id:"101",type:"yellow",x:302,y:308,w:156,h:60,rot:0},{id:"108",type:"yellow",x:215,y:180,w:68,h:72,rot:-20},
 {id:"109",type:"yellow",x:477,y:180,w:68,h:72,rot:20},{id:"105",type:"yellow",x:240,y:260,w:63,h:75,rot:-13},
 {id:"106",type:"yellow",x:457,y:260,w:63,h:75,rot:13},{id:"102",type:"yellow",x:280,y:340,w:48,h:48,rot:-15},
 {id:"103",type:"yellow",x:432,y:340,w:48,h:48,rot:15},
 {id:"301",type:"blue",x:105,y:255,w:80,h:92,rot:-32},{id:"302",type:"blue",x:575,y:255,w:80,h:92,rot:32},
 {id:"303",type:"blue",x:80,y:170,w:76,h:85,rot:-35},{id:"304",type:"blue",x:604,y:170,w:76,h:85,rot:35},
 {id:"305",type:"blue",x:43,y:260,w:70,h:75,rot:-35},{id:"306",type:"blue",x:647,y:260,w:70,h:75,rot:35},
 {id:"A1",type:"blue",x:185,y:330,w:75,h:66,rot:-25},{id:"A2",type:"blue",x:500,y:330,w:75,h:66,rot:25}
];
const starter={id:"starter-aitana",name:"Cuarto Azul Aitana Roblox Tour",description:"Un homenaje digital realizado por cariño a la artista y sus fans. ¡Ven a disfrutar de una experiencia especial en Roblox!",date:"2026-11-22",cover:"",capacity:20,phase:"general",published:true,createdAt:new Date().toISOString()};
let db=loadDB(),currentEventId=null,selectedSection=null,qty=1,colors=[];
function loadDB(){
 try{
  let d=JSON.parse(localStorage.getItem(DBKEY));
  if(d&&Array.isArray(d.events)&&Array.isArray(d.bookings)){
   if(d.events.length===0) d.events=[{...starter}];
   d.events=d.events.map(e=>({...starter,...e}));
   d.bookings=d.bookings.filter(Boolean).map((b,i)=>({
     id:b.id||("legacy-"+i),
     eventId:b.eventId||"",
     eventName:b.eventName||"Evento anterior",
     username:b.username||"Usuario sin nombre",
     section:b.section||"Sin sección",
     showsAttended:Number(b.showsAttended)||0,
     createdAt:b.createdAt||new Date().toISOString()
   }));
   return d;
  }
 }catch(e){}
 return {events:[{...starter}],bookings:[]};
}
function save(){localStorage.setItem(DBKEY,JSON.stringify(db))}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function dateFmt(d){return d?new Date(d+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"}):"Fecha por confirmar"}
function isVisible(e){return e.published!==false && (e.phase==="presale"||e.phase==="general")}
function available(e,s){return Math.max(0,Number(e.capacity)-db.bookings.filter(b=>b.eventId===e.id&&b.section===s).length)}
function activeEvent(){return db.events.find(e=>e.id===currentEventId)}
function modal(id,on=true){$("#"+id).classList.toggle("hidden",!on)}
function showMarket(){ $("#eventDetail").classList.add("hidden"); document.querySelector("main").classList.remove("hidden");document.querySelector(".searchbar").classList.remove("hidden");document.querySelector(".site-header").classList.remove("hidden");window.scrollTo(0,0)}
function renderMarket(){
 const q=$("#eventSearch").value.trim().toLowerCase();
 const events=db.events.filter(e=>isVisible(e)&&`${e.name} ${e.description}`.toLowerCase().includes(q));
 $("#eventCount").textContent=`${events.length} EVENTO(S) DISPONIBLE(S)`;
 $("#emptyEvents").classList.toggle("hidden",events.length>0);
 $("#emptyEvents").textContent=q?"No encontramos eventos que coincidan. Prueba con otro nombre o limpia la búsqueda.":"No hay eventos visibles en este momento. Vuelve pronto para descubrir los próximos shows.";
 $("#eventGrid").innerHTML=events.map((e,i)=>`<article class="event-card" data-event="${esc(e.id)}"><div class="event-cover">${e.cover?`<img src="${esc(e.cover)}" alt="${esc(e.name)}" onerror="this.style.display='none'">`:`<div class="cover-placeholder">DUCKY LIVE</div>`}</div><div class="event-card-info"><span class="event-category">${e.phase==="presale"?"PREVENTA DE FANS":"ACCESO GENERAL"} · DUCKY PRODUCTIONS</span><h3>${esc(e.name)}</h3><div class="event-date">📅 ${dateFmt(e.date)}</div></div></article>`).join("");
 $$(".event-card").forEach(c=>c.addEventListener("click",()=>openEvent(c.dataset.event)));
}
$("#searchBtn").onclick=renderMarket;
$("#eventSearch").addEventListener("input",renderMarket);
$("#clearSearch").onclick=()=>{$("#eventSearch").value="";renderMarket();$("#eventSearch").focus()};
$("#homeLink").onclick=e=>{e.preventDefault();showMarket()};
function openEvent(id){
 const e=db.events.find(x=>x.id===id);if(!e||!isVisible(e))return;
 currentEventId=id;selectedSection=null;qty=1;
 document.querySelector("main").classList.add("hidden");document.querySelector(".searchbar").classList.add("hidden");document.querySelector(".site-header").classList.add("hidden");$("#eventDetail").classList.remove("hidden");
 $("#detailTitle").textContent=e.name;$("#detailDescription").textContent=e.description;$("#detailDate").textContent="📅 "+dateFmt(e.date);
 $("#detailHero").style.backgroundImage=e.cover?`linear-gradient(90deg,#06152dcc,transparent),url("${e.cover.replace(/"/g,"%22")}")`:"linear-gradient(110deg,#061a39,#12639b)";
 $("#phaseNotice").textContent=e.phase==="presale"?"PREVENTA DE FANS: disponible para asistentes que acrediten más de 10 shows de Ducky Productions.": "VENTA GENERAL: accesos disponibles para todo público.";
 $("#bookingPanel").classList.toggle("hidden",e.phase==="hidden");
 drawMap();updateBooking();window.scrollTo(0,0);
}
$("#backToEvents").onclick=showMarket;
function drawMap(){
 const svg=$("#mapSections");svg.innerHTML=SECTIONS.map(s=>{
  const sold=available(activeEvent(),s.id)===0;
  const x=s.x,y=s.y,w=s.w,h=s.h;
  return `<g class="seat-group" data-section="${s.id}" role="button" tabindex="0" aria-label="Sección ${s.id}"><rect class="seat-shape ${s.type}-seat ${sold?"sold-seat":""}" x="${x}" y="${y}" width="${w}" height="${h}" rx="7" transform="rotate(${s.rot} ${x+w/2} ${y+h/2})"></rect><text class="seat-label" x="${x+w/2}" y="${y+h/2}">${s.id}</text></g>`;
 }).join("");
 $$(".seat-group").forEach(g=>{
  const select=()=>{const s=SECTIONS.find(x=>x.id===g.dataset.section);if(available(activeEvent(),s.id)<=0)return;selectedSection=s.id;qty=1;drawMap();updateBooking()};
  g.addEventListener("click",select);g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select()}});
 });
 if(selectedSection){const g=$(`.seat-group[data-section="${selectedSection}"] .seat-shape`);if(g)g.classList.add("selected-seat")}
}
function updateBooking(){
 const e=activeEvent(),left=selectedSection?available(e,selectedSection):0;
 $("#selectedInfo").textContent=selectedSection?`Sección ${selectedSection} · ${left} acceso(s) disponible(s)`:"Ninguna sección seleccionada";
 qty=Math.max(1,Math.min(4,qty,left||4));$("#qtyValue").textContent=qty;
 $("#startBooking").disabled=!selectedSection||left<1;
}
$("#qtyMinus").onclick=()=>{qty=Math.max(1,qty-1);updateBooking()};
$("#qtyPlus").onclick=()=>{qty=Math.min(4,qty+1,selectedSection?available(activeEvent(),selectedSection):4);updateBooking()};
$("#startBooking").onclick=()=>{
 const e=activeEvent();if(!e||!selectedSection||available(e,selectedSection)<qty)return;
 $("#checkoutSummary").textContent=`${e.name} · Sección ${selectedSection} · ${qty} acceso(s) gratuitos`;
 $("#usernameFields").innerHTML=Array.from({length:qty},(_,i)=>`<label class="username-field">BOLETO ${i+1} · USUARIO DE ROBLOX<input maxlength="20" placeholder="Ej. PatunioG" data-user="${i}"></label>`).join("");
 $("#checkoutError").textContent="";modal("checkoutModal");
};
$("#confirmBooking").onclick=()=>{
 const e=activeEvent(),inputs=$$("#usernameFields input"),users=inputs.map(i=>i.value.trim()),err=$("#checkoutError");
 if(users.some(x=>!x)){err.textContent="Escribe un usuario de Roblox para cada boleto.";return}
 if(users.some(x=>!/^[a-zA-Z0-9_]{3,20}$/.test(x))){err.textContent="Usa de 3 a 20 letras, números o guion bajo, sin espacios.";return}
 if(new Set(users.map(x=>x.toLowerCase())).size!==users.length){err.textContent="Cada boleto debe tener un usuario distinto.";return}
 if(available(e,selectedSection)<users.length){err.textContent="Ya no hay suficientes accesos en esa sección.";return}
 let showsText=prompt("¿A cuántos shows de Ducky Productions has asistido? Escribe 0 si es tu primera vez:","0");if(showsText===null)return;
 let shows=Number(showsText);if(!Number.isInteger(shows)||shows<0){err.textContent="Escribe una cantidad válida de shows.";return}
 if(e.phase==="presale"&&shows<=10){err.textContent="La preventa requiere más de 10 shows asistidos.";return}
 const codes=[];
 users.forEach(username=>{const code="DK-"+Math.random().toString(36).slice(2,8).toUpperCase();codes.push(code);db.bookings.push({id:code,eventId:e.id,eventName:e.name,username,section:selectedSection,showsAttended:shows,createdAt:new Date().toISOString()})});
 save();modal("checkoutModal",false);$("#successMessage").textContent=`Se registraron ${users.length} acceso(s) para ${e.name}.`;
 $("#successCodes").innerHTML=codes.map((c,i)=>`<div><b>${esc(users[i])}</b> · Sección ${esc(selectedSection)} · ${c}</div>`).join("");modal("successModal");renderAdmin();drawMap();updateBooking();
};
$$("[data-close]").forEach(b=>b.onclick=()=>modal(b.dataset.close,false));$$(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)modal(m.id,false)}));
$("#year").textContent=new Date().getFullYear();

/* ADMIN LOGIN: autenticación segura gestionada por supabase-integration.js */
const adminLoginButton = document.getElementById("openAdmin");
const adminLoginModal = document.getElementById("adminLoginModal");
const adminAppElement = document.getElementById("adminApp");
const adminExitButton=document.getElementById("exitAdmin");
if(adminExitButton){
  adminExitButton.addEventListener("click",()=>{
    if(adminAppElement){adminAppElement.classList.add("hidden");adminAppElement.style.display="none";}
  });
}
function tab(t){
  document.querySelectorAll(".admin-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===t));
  document.querySelectorAll(".admin-page").forEach(p=>p.classList.toggle("active",p.id==="tab-"+t));
  const title=document.getElementById("adminTitle");
  if(title) title.textContent=({dashboard:"Resumen",events:"Eventos",attendees:"Asistentes",settings:"Configuración"})[t] || "Administración";
}
function phaseName(p){return({hidden:"Sin liberar",presale:"Preventa de fans",general:"Venta general"})[p]||p}
function renderAdmin(){
 const total=db.bookings.length,users=new Set(db.bookings.map(b=>b.username.toLowerCase())).size;
 $("#stats").innerHTML=[["EVENTOS TOTALES",db.events.length],["EVENTOS VISIBLES",db.events.filter(isVisible).length],["ACCESOS REGISTRADOS",total],["USUARIOS ROBLOX",users]].map(x=>`<div class="stat-card"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join("");
 const recent=[...db.bookings].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);
 $("#recentRows").innerHTML=recent.length?recent.map(b=>`<div class="event-admin-row"><div><h3>${esc(b.username)}</h3><p>${esc(b.eventName)} · ${new Date(b.createdAt).toLocaleString("es-MX")}</p></div><span class="state live">Sección ${esc(b.section)}</span></div>`).join(""):'<div class="empty-row">Aún no hay registros.</div>';
 $("#adminEventList").innerHTML=db.events.length?db.events.map(e=>`<div class="event-admin-row"><div><h3>${esc(e.name)} <span class="state ${isVisible(e)?"live":""}">${e.published===false?"Oculto · "+phaseName(e.phase):phaseName(e.phase)}</span></h3><p>${dateFmt(e.date)} · ${db.bookings.filter(b=>b.eventId===e.id).length} accesos registrados · ${e.capacity} por sección</p></div><div class="event-actions"><button class="mini" data-edit="${esc(e.id)}">Editar</button><button class="mini" data-hide="${esc(e.id)}">${e.published===false?"Mostrar":"Ocultar"}</button><button class="mini publish" data-presale="${esc(e.id)}">Liberar preventa</button><button class="mini general" data-general="${esc(e.id)}">Liberar general</button><button class="mini delete" data-delete="${esc(e.id)}">Eliminar</button></div></div>`).join(""):'<div class="empty-row">No hay eventos. Crea el primero arriba.</div>';
 $$("[data-edit]").forEach(b=>b.onclick=()=>editEvent(b.dataset.edit));
 $$("[data-hide]").forEach(b=>b.onclick=()=>{
  const e=db.events.find(x=>x.id===b.dataset.hide);if(!e)return;
  e.published=e.published===false;
  save();renderAdmin();renderMarket();
  if(currentEventId===e.id&&!isVisible(e))showMarket();
 });
 $$("[data-presale]").forEach(b=>b.onclick=()=>changePhase(b.dataset.presale,"presale"));
 $$("[data-general]").forEach(b=>b.onclick=()=>changePhase(b.dataset.general,"general"));
 $$("[data-delete]").forEach(b=>b.onclick=()=>deleteEvent(b.dataset.delete));
 renderAttendees();
}
function changePhase(id,phase){const e=db.events.find(x=>x.id===id);if(!e)return;e.phase=phase;e.published=true;save();renderAdmin();renderMarket();if(currentEventId===id){$("#phaseNotice").textContent=phase==="presale"?"PREVENTA DE FANS: disponible para asistentes que acrediten más de 10 shows.":"VENTA GENERAL: accesos disponibles para todo público.";$("#bookingPanel").classList.remove("hidden")}}
function editEvent(id){
 const e=db.events.find(x=>x.id===id);if(!e)return;const f=$("#eventForm");
 f.elements.id.value=e.id;f.elements.name.value=e.name;f.elements.date.value=e.date;f.elements.description.value=e.description;f.elements.cover.value=e.cover||"";f.elements.capacity.value=e.capacity;f.elements.phase.value=e.phase;
 $("#eventFormTitle").textContent="Editar evento";$("#saveEventBtn").textContent="GUARDAR CAMBIOS";$("#cancelEdit").classList.remove("hidden");f.scrollIntoView({behavior:"smooth",block:"center"});
}
function resetEventForm(){const f=$("#eventForm");f.reset();f.elements.id.value="";f.elements.capacity.value=20;$("#eventFormTitle").textContent="Crear evento";$("#saveEventBtn").textContent="GUARDAR EVENTO";$("#cancelEdit").classList.add("hidden")}
$("#cancelEdit").onclick=resetEventForm;
$("#eventForm").onsubmit=e=>{
 e.preventDefault();const f=e.currentTarget,d=new FormData(f),id=d.get("id");
 const obj={id:id||crypto.randomUUID(),name:d.get("name").trim(),date:d.get("date"),description:d.get("description").trim(),cover:d.get("cover").trim(),capacity:Number(d.get("capacity")),phase:d.get("phase"),published:d.get("phase")!=="hidden"};
 if(!obj.name||!obj.date||!obj.description||!Number.isInteger(obj.capacity)||obj.capacity<1)return;
 if(id){const idx=db.events.findIndex(x=>x.id===id);if(idx>=0)db.events[idx]={...db.events[idx],...obj,published:obj.phase==="hidden"?false:(db.events[idx].published!==false)}}
 else db.events.unshift({...obj,createdAt:new Date().toISOString()});
 save();resetEventForm();renderAdmin();renderMarket();if(currentEventId===obj.id&&isVisible(obj))openEvent(obj.id);
};
function deleteEvent(id){
 const e=db.events.find(x=>x.id===id);if(!e)return;
 if(!confirm(`¿Eliminar "${e.name}"? También se eliminarán sus registros de esta demostración.`))return;
 db.events=db.events.filter(x=>x.id!==id);db.bookings=db.bookings.filter(b=>b.eventId!==id);save();if(currentEventId===id){currentEventId=null;showMarket()}renderAdmin();renderMarket();
}
function renderAttendees(){
 const q=($("#attendeeSearch")?.value||"").toLowerCase();
 const rows=[...db.bookings].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).filter(b=>[b.username,b.eventName,b.section].some(x=>String(x).toLowerCase().includes(q)));
 $("#attendeeCount").textContent=`${rows.length} registro(s)`;
 $("#attendeeTable").innerHTML=rows.length?rows.map(b=>`<tr><td>${esc(b.username)}</td><td>${esc(b.eventName)}</td><td>${esc(b.section)}</td><td>${new Date(b.createdAt).toLocaleString("es-MX")}</td><td>${b.showsAttended}</td></tr>`).join(""):'<tr><td colspan="5" class="empty-row">No hay registros coincidentes.</td></tr>';
}
$("#attendeeSearch").addEventListener("input",renderAttendees);
$("#exportCsv").onclick=()=>{const data=[["Usuario Roblox","Evento","Seccion","Registro","Shows","Codigo"],...db.bookings.map(b=>[b.username,b.eventName,b.section,new Date(b.createdAt).toLocaleString("es-MX"),b.showsAttended,b.id])];const csv=data.map(r=>r.map(x=>`"${String(x??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="ducky-asistentes.csv";a.click();URL.revokeObjectURL(url)};
$("#resetDemo").onclick=()=>{if(confirm("¿Borrar todos los eventos y registros guardados en este navegador?")){db={events:[{...starter,published:true}],bookings:[]};save();renderAdmin();renderMarket();resetEventForm()}};
renderMarket();renderAdmin();
