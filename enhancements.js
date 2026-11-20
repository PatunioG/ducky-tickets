
/* DUCKY TICKETS 4.0 — horarios, fila virtual, recintos y mapas editables */
(function(){
  const VENUE_KEY = "duckyTickets_venues_v4";
  let venues = [];
  try { venues = JSON.parse(localStorage.getItem(VENUE_KEY) || "[]"); } catch(e) { venues=[]; }
  let queueTimer = null, queuePassed = {}, queueSeconds = 12, queueState = "idle";
  let venueDraft = null, paintMode = "available", staffSession = false, selectedSeats = [];
  const palette = {
    available:"#efc34f", occupied:"#ed8a43", stage:"#111827",
    staff:"#9aa3ad", blocked:"#5d6672"
  };
  const oldSave = ()=>save();
  function persistVenues(){ localStorage.setItem(VENUE_KEY, JSON.stringify(venues)); if(window.duckyCloudSync) window.duckyCloudSync(); }
  function venueById(id){ return venues.find(v=>v.id===id); }
  function salePhase(e){
    const now=Date.now(), pre=e.presaleAt?new Date(e.presaleAt).getTime():null, gen=e.generalAt?new Date(e.generalAt).getTime():null;
    if(e.phase==="hidden" || e.published===false) return "hidden";
    if(pre && now<pre) return "scheduled";
    if(gen && now<gen) return "presale";
    if(e.phase==="presale" && !pre) return "presale";
    return "general";
  }
  function nextSaleAt(e){
    const phase=salePhase(e);
    if(phase==="scheduled" && e.presaleAt) return e.presaleAt;
    if(phase==="presale" && e.generalAt) return e.generalAt;
    return null;
  }
  function countdownText(iso){
    if(!iso) return "La venta aún no está programada";
    const ms=Math.max(0,new Date(iso).getTime()-Date.now());
    const total=Math.floor(ms/1000), d=Math.floor(total/86400), h=Math.floor(total%86400/3600), m=Math.floor(total%3600/60), s=total%60;
    return `${d?d+"d ":""}${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }
  function phaseLabel(e){
    const p=salePhase(e);
    return ({hidden:"NO PUBLICADO",scheduled:"PRÓXIMAMENTE · HORARIOS PROGRAMADOS",presale:"PREVENTA DE FANS",general:"VENTA GENERAL"})[p];
  }
  function venueStatusLabel(s){return ({active:"Activo",renovation:"En remodelación",closed:"Cerrado permanentemente"})[s]||s;}
  function eventVenue(e){return venueById(e.venueId);}
  function updateVenueSelect(selected=""){
    const select=document.getElementById("eventVenueSelect");
    if(!select)return;
    select.innerHTML='<option value="">Mapa estándar Ducky</option>'+venues.map(v=>`<option value="${esc(v.id)}">${esc(v.name)} · ${esc(venueStatusLabel(v.status))}</option>`).join("");
    select.value=selected||"";
  }
  function visibleEvent(e){return e.published!==false && e.phase!=="hidden";}
  renderMarket = function(){
    const q=$("#eventSearch").value.trim().toLowerCase();
    const list=db.events.filter(e=>visibleEvent(e)&&`${e.name} ${e.description}`.toLowerCase().includes(q));
    $("#eventCount").textContent=`${list.length} EVENTO(S) DISPONIBLE(S)`;
    $("#emptyEvents").classList.toggle("hidden",list.length>0);
    $("#emptyEvents").textContent=q?"No encontramos eventos que coincidan.":"No hay eventos visibles en este momento.";
    $("#eventGrid").innerHTML=list.map(e=>{
      const phase=salePhase(e), label=phaseLabel(e);
      return `<article class="event-card" data-event="${esc(e.id)}"><div class="event-cover">${e.cover?`<img src="${esc(e.cover)}" alt="${esc(e.name)}" onerror="this.style.display='none'">`:`<div class="cover-placeholder">DUCKY LIVE</div>`}<span class="event-card-badge">${esc(label)}</span></div><div class="event-card-info"><span class="event-category">DUCKY PRODUCTIONS</span><h3>${esc(e.name)}</h3><div class="event-date">📅 ${dateFmt(e.date)}</div>${phase==="scheduled"?`<small class="card-countdown">Preventa en ${countdownText(e.presaleAt)}</small>`:""}</div></article>`;
    }).join("");
    $$(".event-card").forEach(c=>c.addEventListener("click",()=>openEvent(c.dataset.event)));
  };
  const coreOpenEvent=openEvent;
  openEvent=function(id){
    const e=db.events.find(x=>x.id===id);if(!e||!visibleEvent(e))return;
    if(queueTimer){clearInterval(queueTimer);queueTimer=null;}currentEventId=id;selectedSection=null;qty=1;staffSession=false;selectedSeats=[];
    document.querySelector("main").classList.add("hidden");
    document.querySelector(".searchbar").classList.add("hidden");
    document.querySelector(".site-header").classList.add("hidden");
    $("#eventDetail").classList.remove("hidden");
    $("#detailTitle").textContent=e.name;$("#detailDescription").textContent=e.description;$("#detailDate").textContent="📅 "+dateFmt(e.date);
    $("#detailHero").style.backgroundImage=e.cover?`linear-gradient(90deg,#06152dcc,transparent),url("${e.cover.replace(/"/g,"%22")}")`:"linear-gradient(110deg,#061a39,#12639b)";
    const v=eventVenue(e);
    $("#phaseNotice").textContent=`${phaseLabel(e)}${v?" · "+v.name+" · "+venueStatusLabel(v.status):""}`;
    $("#bookingPanel").classList.add("hidden");
    drawQueueGate();
    drawMap();
    updateBooking();
    window.scrollTo(0,0);
  };
  function drawQueueGate(){
    const e=activeEvent(), gate=$("#queueGate");
    if(!e||!gate)return;
    const phase=salePhase(e), target=nextSaleAt(e), venue=eventVenue(e);
    gate.classList.remove("hidden");
    if(venue && venue.status!=="active"){
      gate.innerHTML=`<span class="eyebrow">RECINTO NO DISPONIBLE</span><h2>${esc(venueStatusLabel(venue.status))}</h2><p>Este evento no puede habilitar reservas mientras el recinto no esté activo.</p>`;
      $("#bookingPanel").classList.add("hidden");return;
    }
    if(phase==="hidden"){gate.innerHTML="<h2>Evento no disponible</h2><p>Este evento todavía no está publicado.</p>";return;}
    if(phase==="scheduled"){
      gate.innerHTML=`<span class="eyebrow">PRÓXIMA APERTURA</span><h2>PREVENTA DE FANS</h2><p>El evento ya está publicado. La compra se habilitará cuando el contador llegue a cero; después podrás entrar a la fila virtual de prueba.</p><div class="big-countdown" id="saleCountdown">${countdownText(target)}</div><small>La hora se calcula con el reloj de este dispositivo.</small>`;
      $("#bookingPanel").classList.add("hidden");
      return;
    }
    const key=e.id+":"+phase;
    if(queuePassed[key]){
      gate.classList.add("hidden");$("#bookingPanel").classList.remove("hidden");return;
    }
    gate.innerHTML=`<span class="eyebrow">DUCKY VIRTUAL QUEUE</span><h2>La venta está abierta</h2><p>Entra a la fila virtual. Te mostraremos tu posición y el avance mientras esperas.</p><button class="cta" id="joinQueueBtn">ENTRAR A LA FILA VIRTUAL</button><div id="queueProgress" class="queue-progress hidden"><div class="queue-position-card"><strong id="queueNumber">50</strong><span>PERSONAS DELANTE DE TI</span></div><div class="queue-track"><i id="queueBar"></i></div><strong id="queueStatus">Preparando tu lugar…</strong><small id="queuePosition">Tu turno llegará en aproximadamente 1 minuto.</small></div>`;
    $("#bookingPanel").classList.add("hidden");
    $("#joinQueueBtn").onclick=()=>{
      const btn=$("#joinQueueBtn");if(queueTimer)return;btn.disabled=true;btn.textContent="YA ESTÁS EN LA FILA";
      $("#queueProgress").classList.remove("hidden");
      let remaining=50;
      const total=50;
      $("#queueNumber").textContent=remaining;
      $("#queueStatus").textContent="Estás en la fila virtual…";
      $("#queuePosition").textContent="Estamos preparando tu acceso. No cierres esta ventana.";
      $("#queueBar").style.width="0%";
      // 50 posiciones avanzan cada 1.5 segundos: espera aproximada de 75 segundos.
      queueTimer=setInterval(()=>{
        remaining--;
        const pct=((total-remaining)/total)*100;
        $("#queueBar").style.width=pct+"%";
        $("#queueNumber").textContent=String(Math.max(remaining,0)).padStart(2,"0");
        $("#queuePosition").textContent=remaining>0
          ? `Tu fila está avanzando · ${Math.round(pct)}% completado`
          : "Ya no hay personas delante de ti.";
        if(remaining<=0){
          clearInterval(queueTimer);queueTimer=null;queuePassed[key]=true;
          $("#queueNumber").textContent="00";
          $("#queueStatus").textContent="¡TU TURNO HA LLEGADO!";
          $("#queuePosition").textContent="Ya puedes elegir tus accesos.";
          setTimeout(()=>{gate.classList.add("hidden");$("#bookingPanel").classList.remove("hidden");},1200);
        }
      },1500);
    };
  }
  // Refresh countdowns and transition to virtual queue at exact sale opening.
  setInterval(()=>{
    if(!currentEventId || $("#eventDetail").classList.contains("hidden"))return;
    const e=activeEvent();if(!e)return;
    const phase=salePhase(e), target=nextSaleAt(e);
    const countdown=$("#saleCountdown");
    if(countdown)countdown.textContent=countdownText(target);
    if((phase==="presale" || phase==="general") && $("#bookingPanel").classList.contains("hidden")){
      drawQueueGate();
    }
    $("#phaseNotice").textContent=`${phaseLabel(e)}${eventVenue(e)?" · "+eventVenue(e).name:""}`;
    renderMarket();
  },1000);

  // Venue custom grid: every row is a purchasable section; cells encode seats/areas.
  function defaultCells(rows,cols){
    return Array.from({length:rows*cols},(_,i)=>"blocked");
  }
  function ensureVenueCells(v){
    const n=Number(v.rows)*Number(v.cols);
    if(!Array.isArray(v.cells)||v.cells.length!==n)v.cells=defaultCells(v.rows,v.cols);
  }
  function venueRows(v){
    const rows=[];
    for(let r=0;r<v.rows;r++){
      const cells=v.cells.slice(r*v.cols,(r+1)*v.cols);
      rows.push({id:String.fromCharCode(65+r),cells,available:cells.filter(c=>c==="available").length,staff:cells.filter(c=>c==="staff").length});
    }
    return rows;
  }
  const coreDrawMap=drawMap;
  drawMap=function(){
    const e=activeEvent(),v=e&&eventVenue(e);
    if(!v){$("#seatMap").classList.remove("custom-map");coreDrawMap();return;}
    ensureVenueCells(v);
    const svg=$("#mapSections");
    svg.innerHTML="";
    const map=$("#seatMap");
    map.classList.add("custom-map");
    const cellW=25,cellH=23,gap=4,margin=18;
    const width=margin*2+v.cols*(cellW+gap), height=70+v.rows*(cellH+gap);
    map.setAttribute("viewBox",`0 0 ${width} ${height}`);
    let markup=`<text x="${width/2}" y="24" text-anchor="middle" class="stage-label">${esc(v.name)}</text>`;
    for(let r=0;r<v.rows;r++){
      const y=42+r*(cellH+gap);
      const rowId=String.fromCharCode(65+r);
      markup+=`<text x="9" y="${y+16}" class="custom-row-label">${rowId}</text>`;
      for(let c=0;c<v.cols;c++){
        const i=r*v.cols+c,type=v.cells[i],x=margin+c*(cellW+gap),seatId=`${rowId}${c+1}`;
        const seatType=type==="staff"?"staff":"regular";
        const sold=(type==="available"||type==="staff") && db.bookings.some(b=>b.eventId===e.id&&b.section===seatId&&(b.seatType||"regular")===seatType);
        let fill=palette[type]||palette.blocked;
        if(sold)fill="#b7c0cb";
        const canClick=(type==="available"&&!sold) || (type==="staff"&&staffSession&&!sold);
        const chosen=selectedSeats.includes(seatId);
        markup+=`<g class="custom-seat ${canClick?"clickable":""} ${chosen?"chosen":""}" data-seat="${seatId}" data-type="${type}" role="button" tabindex="${canClick?0:-1}" aria-label="Asiento ${seatId}"><rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="4" fill="${fill}" stroke="${chosen?"#0754dc":"#fff"}" stroke-width="${chosen?3:1.5}" opacity="${canClick?1:.72}"></rect></g>`;
      }
    }
    markup+=`<rect x="${width/2-70}" y="${height-16}" width="140" height="28" rx="4" fill="#111827"/><text x="${width/2}" y="${height+3}" text-anchor="middle" fill="white" font-size="11" font-weight="800">ESCENARIO</text>`;
    map.setAttribute("viewBox",`0 0 ${width} ${height+20}`);
    svg.innerHTML=markup;
    $$(".custom-seat.clickable").forEach(g=>g.addEventListener("click",()=>{
      const seat=g.dataset.seat, type=g.dataset.type;
      if(type==="staff"&&!staffSession)return;
      if(selectedSeats.includes(seat)) selectedSeats=selectedSeats.filter(x=>x!==seat);
      else if(selectedSeats.length<4) selectedSeats.push(seat);
      else { $("#selectedInfo").textContent="Máximo 4 asientos por reserva."; return; }
      selectedSection=selectedSeats.length?("SEATS:"+selectedSeats.join(",")):null;
      qty=selectedSeats.length||1;
      drawMap();updateBooking();
    }));
  };
  const coreAvailable=available;
  available=function(e,s){
    const v=eventVenue(e);
    if(!v)return coreAvailable(e,s);
    if(String(s||"").startsWith("SEATS:")){
      return selectedSeats.filter(seat=>!db.bookings.some(b=>b.eventId===e.id&&b.section===seat&&(b.seatType||"regular")===(staffSession?"staff":"regular"))).length;
    }
    const row=venueRows(v).find(x=>x.id===s);
    if(!row)return 0;
    const staffType=staffSession;
    const capacity=staffType?row.staff:row.available;
    const used=db.bookings.filter(b=>b.eventId===e.id&&b.section===s&&(b.seatType||"regular")===(staffType?"staff":"regular")).length;
    return Math.max(0,capacity-used);
  };
  updateBooking=function(){
    const e=activeEvent(),v=e&&eventVenue(e),left=selectedSection?available(e,selectedSection):0;
    if(v){
      qty=selectedSeats.length||1;
      $("#selectedInfo").textContent=selectedSeats.length?`Asientos seleccionados: ${selectedSeats.join(", ")} · ${selectedSeats.length}/4${staffSession?" · Sesión Staff":""}`:"Selecciona hasta 4 asientos amarillos"+(staffSession+"") ;
      $("#bookingPanel .quantity-control").classList.add("hidden");
    }else{
      $("#selectedInfo").textContent=selectedSection?`Sección ${selectedSection} · ${left} acceso(s) disponible(s)`:"Ninguna sección seleccionada";
      qty=Math.max(1,Math.min(4,qty,left||4));
      $("#bookingPanel .quantity-control").classList.remove("hidden");
    }
    $("#qtyValue").textContent=qty;
    $("#startBooking").disabled=!selectedSection||left<1;
    const total=$("#bookingPanel .free-total strong");
    if(total){
      const price=staffSession&&v?Number(v.staffPrice||0):0;
      total.innerHTML=`$${(price*qty).toFixed(2)} <small>MXN${staffSession?" · STAFF":""}</small>`;
    }
    const totalLabel=$("#bookingPanel .free-total span");
    if(totalLabel)totalLabel.textContent=staffSession?"PRECIO ESPECIAL":"TOTAL";
  };
  // Reopen a row map after reservations and keep the current venue.
  const oldConfirm=$("#confirmBooking").onclick;
  const coreStartBooking=$("#startBooking").onclick;
  $("#startBooking").onclick=function(){
    coreStartBooking.call(this);
    if(eventVenue(activeEvent())){
      const v=eventVenue(activeEvent());
      $("#checkoutSummary").textContent=`${activeEvent().name} · Asientos ${selectedSeats.join(", ")} · ${qty} acceso(s)${staffSession?` Staff · Precio especial $${(Number(v?.staffPrice||0)*qty).toFixed(2)} MXN`:" gratuitos"}`;
      $("#confirmBooking").textContent=staffSession?"CONFIRMAR SOLICITUD STAFF":"CONFIRMAR ACCESOS GRATUITOS";
    }else if(staffSession){
      const v=eventVenue(activeEvent());
      $("#checkoutSummary").textContent=`${activeEvent().name} · Sección ${selectedSection} · ${qty} acceso(s) Staff · Precio especial $${(Number(v?.staffPrice||0)*qty).toFixed(2)} MXN`;
      $("#confirmBooking").textContent="CONFIRMAR SOLICITUD STAFF";
    }else $("#confirmBooking").textContent="CONFIRMAR ACCESOS GRATUITOS";
  };
  $("#confirmBooking").onclick=function(){
    const e=activeEvent(),v=e&&eventVenue(e);
    if(!v){
      const before=db.bookings.length;oldConfirm.call(this);
      if(staffSession && db.bookings.length>before){
        db.bookings.slice(before).forEach(b=>{b.seatType="staff";b.price=Number(v?.staffPrice||0);});
        oldSave();
      }
      return;
    }
    const inputs=$$("#usernameFields input"),users=inputs.map(i=>i.value.trim()),err=$("#checkoutError");
    if(users.some(x=>!x)){err.textContent="Escribe un usuario de Roblox para cada boleto.";return;}
    if(users.some(x=>!/^[a-zA-Z0-9_]{3,20}$/.test(x))){err.textContent="Usa de 3 a 20 letras, números o guion bajo, sin espacios.";return;}
    if(new Set(users.map(x=>x.toLowerCase())).size!==users.length){err.textContent="Cada boleto debe tener un usuario distinto.";return;}
    if(users.length!==selectedSeats.length){err.textContent="Selecciona exactamente un asiento por usuario.";return;}
    const seatType=staffSession?"staff":"regular";
    if(selectedSeats.some(seat=>db.bookings.some(b=>b.eventId===e.id&&b.section===seat&&(b.seatType||"regular")===seatType))){err.textContent="Uno de los asientos acaba de ocuparse. Vuelve a elegir.";return;}
    let showsText=prompt("¿A cuántos shows de Ducky Productions has asistido? Escribe 0 si es tu primera vez:","0");
    if(showsText===null)return;
    const shows=Number(showsText);
    if(!Number.isInteger(shows)||shows<0){err.textContent="Escribe una cantidad válida de shows.";return;}
    if(salePhase(e)==="presale"&&shows<=10&&!staffSession){err.textContent="La preventa requiere más de 10 shows asistidos.";return;}
    const codes=[];
    users.forEach((username,i)=>{
      const code="DK-"+Math.random().toString(36).slice(2,8).toUpperCase();codes.push(code);
      db.bookings.push({id:code,eventId:e.id,eventName:e.name,username,section:selectedSeats[i],seatType,price:staffSession?Number(v.staffPrice||0):0,showsAttended:shows,createdAt:new Date().toISOString()});
    });
    oldSave();
    modal("checkoutModal",false);
    $("#successMessage").textContent=staffSession?`Se registró tu solicitud Staff. Precio especial configurado: $${(Number(v.staffPrice||0)*users.length).toFixed(2)} MXN. Esta demo no procesa pagos.`:`Se registraron ${users.length} acceso(s) gratuitos para ${e.name}.`;
    $("#successCodes").innerHTML=codes.map((c,i)=>`<div><b>${esc(users[i])}</b> · Asiento ${esc(selectedSeats[i])} · ${c}</div>`).join("");
    modal("successModal");selectedSeats=[];selectedSection=null;qty=1;
    renderAdmin();drawMap();updateBooking();
  };

  // Staff-only login is distinct from customer registration.
  $("#staffLoginTrigger").addEventListener("click",()=>{
    const v=eventVenue(activeEvent());
    if(!v){alert("Este evento usa el mapa estándar y no tiene zonas Staff configuradas.");return;}
    $("#staffAccessCode").value="";$("#staffLoginError").textContent="";modal("staffLoginModal");
  });
  $("#staffLoginSubmit").addEventListener("click",()=>{
    $("#staffLoginError").textContent="El acceso Staff compartido requiere cuentas autenticadas independientes. Por seguridad, no se aceptan claves guardadas en el navegador en esta versión conectada.";
  });

  // Admin: extend navigation, scheduled event editor and CRUD.
  const oldTab=tab;
  tab=function(t){
    document.querySelectorAll(".admin-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===t));
    document.querySelectorAll(".admin-page").forEach(p=>p.classList.toggle("active",p.id==="tab-"+t));
    const titles={dashboard:"Resumen",events:"Eventos",attendees:"Asistentes",venues:"Recintos",settings:"Configuración"};
    $("#adminTitle").textContent=titles[t]||"Administración";
    if(t==="venues")renderVenues();
  };
  document.querySelectorAll(".admin-tab").forEach(b=>b.addEventListener("click",()=>tab(b.dataset.tab)));
  document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>tab(b.dataset.goto)));

  const oldEditEvent=editEvent;
  editEvent=function(id){
    const e=db.events.find(x=>x.id===id);if(!e)return;
    oldEditEvent(id);
    const f=$("#eventForm");
    f.elements.presaleAt.value=e.presaleAt||"";
    f.elements.generalAt.value=e.generalAt||"";
    updateVenueSelect(e.venueId||"");
    f.elements.phase.value=e.phase||"hidden";
  };
  const oldResetEvent=resetEventForm;
  resetEventForm=function(){
    oldResetEvent();
    const f=$("#eventForm");
    f.elements.presaleAt.value="";f.elements.generalAt.value="";
    updateVenueSelect("");
  };
  $("#eventForm").onsubmit=function(ev){
    ev.preventDefault();
    const f=ev.currentTarget,d=new FormData(f),id=d.get("id");
    const phase=d.get("phase"),presaleAt=d.get("presaleAt"),generalAt=d.get("generalAt");
    if(phase==="scheduled" && (!presaleAt||!generalAt)){alert("Para programar el evento debes indicar fecha y hora de preventa y venta general.");return;}
    if(presaleAt&&generalAt&&new Date(generalAt)<=new Date(presaleAt)){alert("La venta general debe comenzar después de la preventa.");return;}
    const obj={id:id||crypto.randomUUID(),name:d.get("name").trim(),date:d.get("date"),description:d.get("description").trim(),cover:d.get("cover").trim(),capacity:Number(d.get("capacity")),phase,published:phase!=="hidden",presaleAt:presaleAt||"",generalAt:generalAt||"",venueId:d.get("venueId")||""};
    if(!obj.name||!obj.date||!obj.description||!Number.isInteger(obj.capacity)||obj.capacity<1)return;
    if(id){const idx=db.events.findIndex(x=>x.id===id);if(idx>=0)db.events[idx]={...db.events[idx],...obj};}
    else db.events.unshift({...obj,createdAt:new Date().toISOString()});
    oldSave();resetEventForm();renderAdmin();renderMarket();
  };

  function createVenueDraft(){
    const f=$("#venueForm"),rows=Math.max(4,Math.min(30,Number(f.elements.rows.value)||12)),cols=Math.max(4,Math.min(36,Number(f.elements.cols.value)||20));
    return {id:f.elements.id.value||crypto.randomUUID(),name:f.elements.name.value.trim(),promoter:f.elements.promoter.value.trim(),status:f.elements.status.value,capacity:Number(f.elements.capacity.value)||rows*cols,gameLink:f.elements.gameLink.value.trim(),description:f.elements.description.value.trim(),staffCode:f.elements.staffCode.value.trim(),staffPrice:Number(f.elements.staffPrice.value)||0,rows,cols,cells:venueDraft&&venueDraft.rows===rows&&venueDraft.cols===cols?venueDraft.cells.slice():defaultCells(rows,cols)};
  }
  function drawVenueEditor(){
    if(!venueDraft)return;
    ensureVenueCells(venueDraft);
    $("#venueGridEditor").style.gridTemplateColumns=`repeat(${venueDraft.cols}, minmax(16px,1fr))`;
    $("#venueGridEditor").innerHTML=venueDraft.cells.map((type,i)=>`<button type="button" class="venue-cell ${type}" data-cell="${i}" title="Fila ${String.fromCharCode(65+Math.floor(i/venueDraft.cols))} · Asiento ${i%venueDraft.cols+1}" style="background:${palette[type]}"></button>`).join("");
    $$(".venue-cell").forEach(b=>b.addEventListener("click",()=>{
      venueDraft.cells[Number(b.dataset.cell)]=paintMode;drawVenueEditor();
    }));
  }
  function beginVenueDraft(){
    const f=$("#venueForm");
    venueDraft=createVenueDraft();
    $("#venueMapEditor").classList.remove("hidden");
    drawVenueEditor();
  }
  $("#openVenueEditor").onclick=beginVenueDraft;
  $$(".paint-tool").forEach(b=>b.onclick=()=>{
    paintMode=b.dataset.paint;
    $$(".paint-tool").forEach(x=>x.classList.toggle("active",x===b));
  });
  $("#venueForm").onsubmit=function(ev){
    ev.preventDefault();
    const f=ev.currentTarget;
    if(!f.elements.name.value.trim()||!f.elements.promoter.value.trim()){alert("Escribe el nombre y la promotora del recinto.");return;}
    const v=createVenueDraft();
    if(v.status==="active" && !v.cells.includes("available")){if(!confirm("El mapa no tiene asientos amarillos disponibles. ¿Guardar de todos modos?"))return;}
    const idx=venues.findIndex(x=>x.id===v.id);
    if(idx>=0)venues[idx]=v;else venues.unshift(v);
    persistVenues();venueDraft=v;renderVenues();updateVenueSelect(v.id);
    $("#venueFormTitle").textContent="Recinto guardado";
    alert("Recinto guardado correctamente. Ya puedes asignarlo a un evento.");
  };
  function editVenue(id){
    const v=venueById(id);if(!v)return;
    venueDraft=JSON.parse(JSON.stringify(v));
    const f=$("#venueForm");
    Object.entries(v).forEach(([k,val])=>{if(f.elements[k])f.elements[k].value=val;});
    $("#venueFormTitle").textContent="Editar recinto";
    $("#venueMapEditor").classList.remove("hidden");
    drawVenueEditor();
    f.scrollIntoView({behavior:"smooth",block:"center"});
  }
  function deleteVenue(id){
    const v=venueById(id);if(!v)return;
    if(!confirm(`¿Eliminar el recinto "${v.name}"? Los eventos asociados volverán al mapa estándar.`))return;
    venues=venues.filter(x=>x.id!==id);
    db.events.forEach(e=>{if(e.venueId===id)e.venueId="";});
    persistVenues();oldSave();renderVenues();updateVenueSelect("");
  }
  function renderVenues(){
    $("#venueList").innerHTML=venues.length?venues.map(v=>`<div class="event-admin-row"><div><h3>${esc(v.name)} <span class="state ${v.status==="active"?"live":""}">${esc(venueStatusLabel(v.status))}</span></h3><p>${esc(v.promoter)} · Capacidad ${v.capacity} · ${v.rows} × ${v.cols} · Staff $${Number(v.staffPrice||0).toFixed(2)}</p><p>${esc(v.description||"Sin descripción")}</p></div><div class="event-actions"><button class="mini" data-venue-edit="${esc(v.id)}">Editar</button><button class="mini delete" data-venue-delete="${esc(v.id)}">Eliminar</button></div></div>`).join(""):'<div class="empty-row">Todavía no hay recintos. Crea el primero.</div>';
    $$("[data-venue-edit]").forEach(b=>b.onclick=()=>editVenue(b.dataset.venueEdit));
    $$("[data-venue-delete]").forEach(b=>b.onclick=()=>deleteVenue(b.dataset.venueDelete));
    updateVenueSelect($("#eventVenueSelect")?.value||"");
  }
  $("#cancelVenueEdit").onclick=()=>{
    $("#venueForm").reset();$("#venueForm").elements.id.value="";$("#venueMapEditor").classList.add("hidden");venueDraft=null;$("#venueFormTitle").textContent="Crear recinto";
  };
  // Update phase labels in admin and keep existing CRUD actions intact.
  const oldRenderAdmin=renderAdmin;
  renderAdmin=function(){
    oldRenderAdmin();
    $$("[data-presale]").forEach(b=>b.textContent="Liberar preventa ahora");
    $$("[data-general]").forEach(b=>b.textContent="Liberar general ahora");
    updateVenueSelect($("#eventVenueSelect")?.value||"");
    renderVenues();
    $("#adminEventList").innerHTML=db.events.length?db.events.map(e=>{
      const v=eventVenue(e),p=salePhase(e);
      return `<div class="event-admin-row"><div><h3>${esc(e.name)} <span class="state ${p==="general"||p==="presale"?"live":""}">${esc(phaseLabel(e))}</span></h3><p>${dateFmt(e.date)} · ${v?esc(v.name):"Mapa estándar"} · ${db.bookings.filter(b=>b.eventId===e.id).length} accesos · ${e.capacity} por sección</p>${e.presaleAt?`<p>Preventa: ${new Date(e.presaleAt).toLocaleString("es-MX")} · General: ${e.generalAt?new Date(e.generalAt).toLocaleString("es-MX"):"No programada"}</p>`:""}</div><div class="event-actions"><button class="mini" data-edit="${esc(e.id)}">Editar</button><button class="mini" data-hide="${esc(e.id)}">${e.published===false?"Mostrar":"Ocultar"}</button><button class="mini publish" data-presale="${esc(e.id)}">Liberar preventa ahora</button><button class="mini general" data-general="${esc(e.id)}">Liberar general ahora</button><button class="mini delete" data-delete="${esc(e.id)}">Eliminar</button></div></div>`;
    }).join(""):'<div class="empty-row">No hay eventos.</div>';
    $$("[data-edit]").forEach(b=>b.onclick=()=>editEvent(b.dataset.edit));
    $$("[data-hide]").forEach(b=>b.onclick=()=>{
      const e=db.events.find(x=>x.id===b.dataset.hide);if(!e)return;
      if(e.published===false){
        e.published=true;
        if(e.phase==="hidden")e.phase=e.presaleAt&&new Date(e.presaleAt)>new Date()?"scheduled":"general";
      }else e.published=false;
      oldSave();renderAdmin();renderMarket();
    });
    $$("[data-presale]").forEach(b=>b.onclick=()=>{const e=db.events.find(x=>x.id===b.dataset.presale);if(e){e.phase="presale";e.published=true;e.presaleAt="";oldSave();renderAdmin();renderMarket();}});
    $$("[data-general]").forEach(b=>b.onclick=()=>{const e=db.events.find(x=>x.id===b.dataset.general);if(e){e.phase="general";e.published=true;e.presaleAt="";e.generalAt="";oldSave();renderAdmin();renderMarket();}});
    $$("[data-delete]").forEach(b=>b.onclick=()=>deleteEvent(b.dataset.delete));
  };
  // Load and show all stored data.
  updateVenueSelect();
  renderVenues();
  renderMarket();
  renderAdmin();
  window.duckyGetVenues=()=>venues;
  window.duckySetVenues=(next)=>{venues=Array.isArray(next)?next:[];localStorage.setItem(VENUE_KEY,JSON.stringify(venues));renderVenues();updateVenueSelect();};
  window.duckyGetSelectedSeats=()=>selectedSeats.slice();
  window.duckyClearSelectedSeats=()=>{selectedSeats=[];selectedSection=null;qty=1;};
  window.duckyIsStaffSession=()=>staffSession;
  window.duckySalePhase=salePhase;
})();
