/* DUCKY TICKETS 5.0 — Supabase cloud persistence + Auth */
(function(){
  const cfg=window.DUCKY_SUPABASE_CONFIG||{};
  const statusEl=()=>document.getElementById('cloudStatus');
  const setStatus=(msg,ok=true)=>{const el=statusEl();if(el){el.textContent=(ok?'● ':'● ')+msg;el.style.color=ok?'#26975c':'#b45309';}};
  if(!window.supabase||!cfg.url||!cfg.publishableKey){setStatus('SUPABASE NO DISPONIBLE',false);return;}
  const client=window.supabase.createClient(cfg.url,cfg.publishableKey);
  window.duckySupabase=client;
  let isAdmin=false, syncing=false, initialized=false;
  const uuid=()=>crypto.randomUUID();
  const isUuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(x||''));
  const localSave=save;
  function normalizeLocalIds(){
    const eventMap=new Map();
    db.events.forEach(e=>{if(!isUuid(e.id)){const old=e.id;e.id=uuid();eventMap.set(old,e.id);}});
    db.bookings.forEach(b=>{if(eventMap.has(b.eventId))b.eventId=eventMap.get(b.eventId);});
    let vs=window.duckyGetVenues?window.duckyGetVenues():[];
    const venueMap=new Map();
    vs.forEach(v=>{if(!isUuid(v.id)){const old=v.id;v.id=uuid();venueMap.set(old,v.id);}});
    db.events.forEach(e=>{if(venueMap.has(e.venueId))e.venueId=venueMap.get(e.venueId);});
    if(window.duckySetVenues)window.duckySetVenues(vs);
    localSave();
  }
  function toIso(v){return v?new Date(v).toISOString():null;}
  function fromIso(v){if(!v)return '';const d=new Date(v);const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;}
  function eventToRow(e){return {id:e.id,name:e.name,description:e.description||'',event_date:e.date||null,cover_url:e.cover||'',published:e.published!==false,status:e.phase||'hidden',phase:e.phase||'hidden',presale_at:toIso(e.presaleAt),general_at:toIso(e.generalAt),tickets_per_section:Number(e.capacity)||20,venue_id:e.venueId||null,updated_at:new Date().toISOString()};}
  function rowToEvent(r){return {id:r.id,name:r.name,description:r.description||'',date:r.event_date?String(r.event_date).slice(0,10):'',cover:r.cover_url||'',published:!!r.published,phase:r.phase||r.status||'hidden',presaleAt:fromIso(r.presale_at),generalAt:fromIso(r.general_at),capacity:r.tickets_per_section||20,venueId:r.venue_id||'',createdAt:r.created_at||new Date().toISOString()};}
  function venueToRow(v){return {id:v.id,name:v.name,promoter:v.promoter||'',status:v.status||'active',capacity:Number(v.capacity)||0,game_url:v.gameLink||'',description:v.description||'',staff_price:Number(v.staffPrice)||0};}
  function rowToVenue(r,map){return {id:r.id,name:r.name,promoter:r.promoter||'',status:r.status||'active',capacity:r.capacity||0,gameLink:r.game_url||'',description:r.description||'',staffPrice:Number(r.staff_price)||0,staffCode:'',rows:map?.rows_count||12,cols:map?.cols_count||20,cells:Array.isArray(map?.cells)?map.cells:[]};}
  function bookingToRow(b){b.cloudId=b.cloudId||uuid();return {id:b.cloudId,event_id:b.eventId,event_name:b.eventName||'',username:b.username,section:b.section,seat_id:b.seatId||null,seat_type:b.seatType||'regular',ticket_code:b.ticketCode||b.id,status:b.status||'registered',price:Number(b.price)||0,shows_attended:Number(b.showsAttended)||0,created_at:b.createdAt||new Date().toISOString()};}
  function rowToBooking(r){return {id:r.ticket_code||r.id,ticketCode:r.ticket_code,cloudId:r.id,eventId:r.event_id,eventName:r.event_name||'',username:r.username,section:r.section,seatId:r.seat_id||'',seatType:r.seat_type||'regular',price:Number(r.price)||0,showsAttended:Number(r.shows_attended)||0,createdAt:r.created_at};}
  async function fetchCloud(admin){
    const evQ=client.from('events').select('*').order('event_date',{ascending:true});
    if(!admin)evQ.eq('published',true);
    const {data:ev,error:ee}=await evQ;if(ee)throw ee;
    let venueQ=client.from('venues').select('*');
    const {data:venueRows,error:ve}=await venueQ;if(ve)throw ve;
    const ids=(venueRows||[]).map(v=>v.id);let maps=[];
    if(ids.length){const {data,error}=await client.from('venue_maps').select('*').in('venue_id',ids);if(error)throw error;maps=data||[];}
    const mapByVenue=new Map(maps.map(m=>[m.venue_id,m]));
    const mappedVenues=(venueRows||[]).map(v=>rowToVenue(v,mapByVenue.get(v.id)));
    const hasCloudData=(ev||[]).length>0 || (venueRows||[]).length>0;
    if(admin){const {data:br,error:be}=await client.from('bookings').select('*').order('created_at',{ascending:false});if(be)throw be;db.bookings=(br||[]).map(rowToBooking);}
    if(admin || hasCloudData){
      if(!admin)db.bookings=[];
      db.events=(ev||[]).map(rowToEvent);
      if(window.duckySetVenues)window.duckySetVenues(mappedVenues);
      localSave();
    }
    renderMarket();if(admin&&typeof renderAdmin==='function')renderAdmin();
  }
  async function deleteMissing(table,ids){
    const {data,error}=await client.from(table).select('id');if(error)throw error;
    const keep=new Set(ids);const stale=(data||[]).map(x=>x.id).filter(id=>!keep.has(id));
    if(stale.length){const {error:de}=await client.from(table).delete().in('id',stale);if(de)throw de;}
  }
  async function syncAll(){
    if(!isAdmin||syncing)return;syncing=true;setStatus('GUARDANDO EN LA NUBE…');
    try{
      normalizeLocalIds();
      const events=db.events.map(eventToRow);const rawVenues=window.duckyGetVenues?window.duckyGetVenues():[];const venues=rawVenues.map(venueToRow);
      if(venues.length){const {error}=await client.from('venues').upsert(venues,{onConflict:'id'});if(error)throw error;}
      if(events.length){const {error}=await client.from('events').upsert(events,{onConflict:'id'});if(error)throw error;}
      await deleteMissing('events',events.map(x=>x.id));
      await deleteMissing('venues',venues.map(x=>x.id));
      const maps=rawVenues.map(v=>({venue_id:v.id,rows_count:Number(v.rows)||12,cols_count:Number(v.cols)||20,cells:Array.isArray(v.cells)?v.cells:[],updated_at:new Date().toISOString()}));
      if(maps.length){const {error}=await client.from('venue_maps').upsert(maps,{onConflict:'venue_id'});if(error)throw error;}
      const bookings=db.bookings.filter(b=>b.eventId&&b.username&&(b.ticketCode||b.id)).map(bookingToRow);
      if(bookings.length){const {error}=await client.from('bookings').upsert(bookings,{onConflict:'ticket_code'});if(error)throw error;}
      setStatus('SUPABASE SINCRONIZADO');
    }catch(err){console.error('Ducky cloud sync:',err);setStatus('ERROR AL GUARDAR · '+(err.message||'revisa SQL/RLS'),false);}
    finally{syncing=false;}
  }
  window.duckyCloudSync=syncAll;
  save=function(){localSave();if(isAdmin)syncAll();};
  function openAdmin(){const m=document.getElementById('adminLoginModal'),a=document.getElementById('adminApp');m.classList.add('hidden');m.style.display='none';m.setAttribute('aria-hidden','true');a.classList.remove('hidden');a.style.display='grid';renderAdmin();}
  async function adminLogin(){
    const email=document.getElementById('adminEmail').value.trim(),password=document.getElementById('adminPassword').value,err=document.getElementById('adminError'),btn=document.getElementById('adminLoginSubmit');
    err.textContent='';if(!email||!password){err.textContent='Escribe tu correo y contraseña.';return;}
    btn.disabled=true;btn.textContent='VERIFICANDO…';
    try{
      const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;
      const {data:membership,error:me}=await client.from('admins').select('role').eq('user_id',data.user.id).maybeSingle();
      if(me)throw me;
      if(!membership){await client.auth.signOut();throw new Error('Esta cuenta no está autorizada como administradora.');}
      isAdmin=true;openAdmin();normalizeLocalIds();
      const {data:cloudEvents,error:ce}=await client.from('events').select('id');if(ce)throw ce;
      const {data:cloudVenues,error:cv}=await client.from('venues').select('id');if(cv)throw cv;
      if((cloudEvents||[]).length===0 && (cloudVenues||[]).length===0){await syncAll();}
      else await fetchCloud(true);
      setStatus('ADMINISTRACIÓN AUTORIZADA · NUBE ACTIVA');
    }catch(e){console.error(e);err.textContent=e.message||'No se pudo iniciar sesión.';isAdmin=false;}
    finally{btn.disabled=false;btn.textContent='INICIAR SESIÓN';}
  }
  document.getElementById('adminLoginSubmit').addEventListener('click',adminLogin);
  document.getElementById('adminPassword').addEventListener('keydown',e=>{if(e.key==='Enter')adminLogin();});
  document.getElementById('adminEmail').addEventListener('keydown',e=>{if(e.key==='Enter')adminLogin();});
  document.getElementById('exitAdmin').addEventListener('click',async()=>{if(isAdmin){await client.auth.signOut();isAdmin=false;setStatus('SUPABASE CONECTADO · SESIÓN CERRADA');}});

  // Public ticket registration is performed by a database function so seats/capacity
  // are checked transactionally on the server, not only in this browser.
  document.getElementById('confirmBooking').onclick=async function(){
    const e=activeEvent(),inputs=[...document.querySelectorAll('#usernameFields input')],users=inputs.map(x=>x.value.trim()),err=document.getElementById('checkoutError');
    if(!e||users.length<1||users.length>4){err.textContent='La reserva no es válida.';return;}
    if(users.some(x=>!x)){err.textContent='Escribe un usuario de Roblox para cada boleto.';return;}
    if(users.some(x=>!/^[A-Za-z0-9_]{3,20}$/.test(x))){err.textContent='Usa de 3 a 20 letras, números o guion bajo.';return;}
    if(new Set(users.map(x=>x.toLowerCase())).size!==users.length){err.textContent='Cada boleto debe tener un usuario diferente.';return;}
    if(window.duckyIsStaffSession&&window.duckyIsStaffSession()){err.textContent='Las reservas Staff aún no están habilitadas en la base de datos compartida.';return;}
    const phase=window.duckySalePhase?window.duckySalePhase(e):e.phase;
    let showsText=prompt('¿A cuántos shows de Ducky Productions has asistido? Escribe 0 si es tu primera vez:','0');if(showsText===null)return;
    const shows=Number(showsText);if(!Number.isInteger(shows)||shows<0){err.textContent='Escribe una cantidad válida de shows.';return;}
    if(phase==='presale'&&shows<=10){err.textContent='La preventa requiere más de 10 shows asistidos.';return;}
    const seats=window.duckyGetSelectedSeats?window.duckyGetSelectedSeats():[];
    const custom=!!(e.venueId&&seats.length);
    if(custom&&users.length!==seats.length){err.textContent='Selecciona un asiento por cada usuario.';return;}
    if(!custom&&(!selectedSection||users.length!==qty)){err.textContent='La cantidad de usuarios no coincide con los accesos seleccionados.';return;}
    const ticketCode=()=> 'DK-'+crypto.randomUUID().replace(/-/g,'').slice(0,10).toUpperCase();
    const tickets=users.map((username,i)=>({username,section:custom?seats[i]:selectedSection,seat_id:custom?seats[i]:null,seat_type:'regular',shows_attended:shows,ticket_code:ticketCode()}));
    const btn=document.getElementById('confirmBooking');btn.disabled=true;btn.textContent='REGISTRANDO…';
    try{
      const {data,error}=await client.rpc('create_public_bookings',{p_event_id:e.id,p_tickets:tickets});if(error)throw error;
      const records=(data||[]).map(rowToBooking);db.bookings.push(...records);localSave();
      modal('checkoutModal',false);document.getElementById('successMessage').textContent=`Se registraron ${records.length} acceso(s) para ${e.name}.`;
      document.getElementById('successCodes').innerHTML=records.map(b=>`<div><b>${esc(b.username)}</b> · ${esc(b.section)} · ${esc(b.ticketCode)}</div>`).join('');modal('successModal');
      if(window.duckyClearSelectedSeats)window.duckyClearSelectedSeats();selectedSection=null;qty=1;
      if(isAdmin)renderAdmin();drawMap();updateBooking();
    }catch(ex){console.error(ex);err.textContent=ex.message||'No se pudo registrar. Intenta nuevamente.';}
    finally{btn.disabled=false;btn.textContent='CONFIRMAR ACCESOS GRATUITOS';}
  };

  async function initialize(){
    setStatus('CONECTANDO CON SUPABASE…');
    try{normalizeLocalIds();await fetchCloud(false);setStatus('SUPABASE CONECTADO · EVENTOS ACTUALIZADOS');initialized=true;}
    catch(e){console.error('Supabase init:',e);setStatus('SIN CONEXIÓN · MOSTRANDO CACHÉ LOCAL',false);}
  }
  initialize();
})();
