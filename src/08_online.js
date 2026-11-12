/* ================= Online en tiempo real (sala de la página) =================
   Cada compu mueve su raqueta (y su compañero en pádel) sin demora y decide lo que pasa
   en SU lado de la cancha: golpes, piques, faltas y puntos. Todo viaja en la "presencia"
   de una sala con nombre (unas 30 veces por segundo): posiciones y una cola corta de eventos. */
let netCfg=null,ROOM=null,GAME=null,netCode=null,netRole=null,netSeq=0,netEvents=[],netSeen={},netPeer=null,netStarted=false,netStatusT=null;
const onEl=id=>document.getElementById(id);
function netStatus(t){const el=onEl('onStatus');if(el)el.textContent=t;}
function netUI(enabled){for(const id of ['onCreate','onJoin','onCode'])if(onEl(id))onEl(id).disabled=!enabled;}

/* servidor propio en Cloudflare (fuera de claude.ai): misma interfaz que la sala de claude.ai */
function onlineURL(){
  if(window.POTRERO_ONLINE_URL)return String(window.POTRERO_ONLINE_URL).replace(/^http/,'ws').replace(/\/$/,'');
  if(/^https?:$/.test(location.protocol)&&!/claude\.ai|claudeusercontent|anthropic/.test(location.hostname))return (location.protocol==='https:'?'wss://':'ws://')+location.host;
  return null;}
function cfRoom(base){return {join:name=>new Promise((ok,fail)=>{
  let ws;try{ws=new WebSocket(base+'/room/'+name);}catch(e){fail({code:'upstream_error'});return;}
  const handlers=[],peers=new Map(),my={};let myId=null,opened=false;
  const snap=()=>[...peers.values(),{peer:myId||'yo',isMe:true,sameTab:true,kind:'viewer',guest:false,by:null,presence:my}];
  const fire=(joined,left,updated)=>{const ps=snap();for(const h of handlers)try{h({peers:ps,joined,left,updated});}catch(e){console.warn(e);}};
  const mk=(id,d)=>({peer:id,isMe:false,sameTab:false,kind:'viewer',guest:false,by:null,presence:d||{},updatedAt:Date.now()});
  const api={name,presence:async patch=>{for(const k in patch){if(patch[k]===null)delete my[k];else my[k]=patch[k];}if(ws.readyState===1)ws.send(JSON.stringify({t:'p',d:patch}));},
    onPeers:(h)=>{handlers.push(h);setTimeout(()=>h({peers:snap(),joined:snap(),left:[],updated:[]}),0);return()=>{const i=handlers.indexOf(h);if(i>=0)handlers.splice(i,1);};},
    peers:snap,connected:()=>ws.readyState===1,leave:async()=>{try{ws.close();}catch(e){}}};
  ws.onmessage=ev=>{let m;try{m=JSON.parse(ev.data);}catch(e){return;}
    if(m.t==='hello'){myId=m.you;for(const p of m.peers||[])peers.set(p.peer,mk(p.peer,p.d));opened=true;
      if(Object.keys(my).length)ws.send(JSON.stringify({t:'p',d:my}));ok(api);fire([...peers.values()],[],[]);}
    else if(m.t==='j'){const p=mk(m.peer);peers.set(m.peer,p);fire([p],[],[]);if(Object.keys(my).length)ws.send(JSON.stringify({t:'p',d:my}));}
    else if(m.t==='p'){const isNew=!peers.has(m.peer),p=mk(m.peer,m.d);peers.set(m.peer,p);fire(isNew?[p]:[],[],isNew?[]:[p]);}
    else if(m.t==='l'){const p=peers.get(m.peer);peers.delete(m.peer);if(p)fire([],[p],[]);}};
  ws.onclose=()=>{if(!opened){fail({code:'upstream_error'});return;}const gone=[...peers.values()];peers.clear();if(gone.length)fire([],gone,[]);};
  setTimeout(()=>{if(!opened){fail({code:'upstream_error'});try{ws.close();}catch(e){}}},8000);
})};}
let netServer='claude';
(async()=>{
  netUI(false);netStatus('Conectando…');
  let r=null;try{r=window.claude&&await claude.use('room');}catch(e){r=null;}
  if(!r){const u=onlineURL();if(u){r=cfRoom(u);netServer='cloudflare';}}
  if(!r){netStatus('El modo online necesita abrir el juego desde claude.ai o desde tu servidor de Cloudflare.');return;}
  ROOM=r;netUI(true);netStatus('Creá una partida y pasale el código a tu amigo, o escribí su código para unirte.');
})();

function randCode(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ';let s='';for(let i=0;i<4;i++)s+=A[(Math.random()*A.length)|0];return s;}
async function netJoin(code,role){
  if(!ROOM)return;netUI(false);
  try{GAME=await ROOM.join('tp-'+code.toLowerCase());}catch(e){netStatus(netServer==='cloudflare'?'No me pude conectar al servidor online. Revisá que el Worker de Cloudflare esté publicado.':'No se pudo entrar a la sala ('+(e&&e.code||'error')+').');netUI(true);return;}
  netCode=code;netRole=role;netSeq=0;netEvents=[];netSeen={};netPeer=null;netStarted=false;
  GAME.onPeers(onNetPeers,e=>{netStatus('Se cortó la conexión.');});
  if(role==='host'){
    const cfg=Object.assign({},CFG,{firstServer:Math.random()<.5?0:1});netCfg=cfg;
    GAME.presence({role:'host',cfg,go:false});
    netStatus('Código: '+code+' · esperando a tu rival…');
  }else{
    GAME.presence({role:'guest'});netStatus('Buscando la partida '+code+'…');
    clearTimeout(netStatusT);netStatusT=setTimeout(()=>{if(!netStarted)netStatus('No encontré la partida '+code+'. Revisá el código.');},9000);
  }
}
function onNetPeers(ch){
  const others=ch.peers.filter(p=>!p.isMe&&p.kind==='viewer');
  // inicio de la partida
  if(!netStarted){
    if(netRole==='host'){const g=others.find(p=>p.presence&&p.presence.role==='guest');
      if(g){netPeer=g.peer;GAME.presence({go:true});netStart(netCfg,0);}}
    else{const h=others.find(p=>p.presence&&p.presence.role==='host'&&p.presence.go&&p.presence.cfg);
      if(h){netPeer=h.peer;netStart(h.presence.cfg,1);}}
    return;}
  // rival se fue
  if(ch.left.some(p=>p.peer===netPeer)&&NET.on){showCall('TU RIVAL SE FUE','Volvés al menú');setTimeout(()=>{netLeave();$('hud').hidden=true;$('end').hidden=true;$('menu').hidden=false;M.state='menu';},2600);return;}
  const peer=others.find(p=>p.peer===netPeer);if(peer)netReceive(peer.presence);
}
function netStart(cfg,team){
  if(!cfg)return;netStarted=true;clearTimeout(netStatusT);
  NET.on=true;NET.myTeam=team;autoplay=false;
  netStatus('¡Partida en juego!');
  startGame(cfg);
}
function netLeave(){NET.on=false;netStarted=false;if(GAME){try{GAME.leave();}catch(e){}}GAME=null;netUI(!!ROOM);if(ROOM)netStatus('Creá una partida o unite con un código.');}
function netRematch(){// revancha: el anfitrión arranca de nuevo con la misma sala
  $('end').hidden=true;const cfg=Object.assign({},M.cfg,{firstServer:Math.random()<.5?0:1});
  if(netRole==='host'){GAME&&GAME.presence({cfg,go:true,rematch:Date.now()});startGame(cfg);}else showSub('Esperando que tu rival pida la revancha…');}

/* ---------- envío: eventos en cola + estado continuo ---------- */
NET.send=(k,d)=>{if(!NET.on||!GAME)return;netEvents.push(Object.assign({s:++netSeq,k},d));if(netEvents.length>8)netEvents.shift();netPush(true);};
let netLastPush=0;
function netPush(force){
  if(!NET.on||!GAME)return;const now=performance.now();if(!force&&now-netLastPush<30)return;netLastPush=now;
  const f=v=>Math.round(v*1000)/1000;
  const pl=M.teams[NET.myTeam].players.map(p=>[f(p.pos.x),f(p.pos.z),f(p.rh),f(p.vel.x),f(p.vel.z)]);
  const o={pl,ev:netEvents};
  if(ball.live&&judgeHere(Math.sign(ball.pos.z)||1))o.b=[f(ball.pos.x),f(ball.pos.y),f(ball.pos.z),f(ball.vel.x),f(ball.vel.y),f(ball.vel.z),Date.now()];else o.b=null;
  GAME.presence(o).catch(()=>{});
}

/* ---------- recepción ---------- */
function netReceive(pr){
  if(!pr||!NET.on)return;
  if(pr.rematch&&pr.rematch!==netSeen.rematch&&netRole==='guest'&&pr.cfg){netSeen.rematch=pr.rematch;$('end').hidden=true;startGame(pr.cfg);return;}
  // raquetas del rival
  const T=M.teams[1-NET.myTeam];if(Array.isArray(pr.pl))pr.pl.forEach((a,i)=>{const p=T.players[i];if(!p||!Array.isArray(a))return;
    p.netT={x:+a[0]||0,z:+a[1]||0,h:+a[2]||1};p.pos.x=p.netT.x;p.pos.z=p.netT.z;p.rh=p.netT.h;p.vel.x=+a[3]||0;p.vel.z=+a[4]||0;});
  // eventos nuevos, en orden
  if(Array.isArray(pr.ev))for(const e of pr.ev){if(!e||typeof e.s!=='number'||e.s<=(netSeen.s||0))continue;netSeen.s=e.s;netApply(e);}
  // corrección suave de la pelota desde quien la tiene de su lado
  if(Array.isArray(pr.b)&&ball.live&&!judgeHere(Math.sign(pr.b[2])||1)){
    const dt=clamp((Date.now()-pr.b[6])/1000,0,.25),b={pos:new V3(pr.b[0],pr.b[1],pr.b[2]),vel:new V3(pr.b[3],pr.b[4],pr.b[5]),w:ball.w.clone()};
    for(let t=0;t<dt;t+=BDT)ballStep(b,BDT,null);
    const err=b.pos.distanceTo(ball.pos);if(err>.6){ball.pos.copy(b.pos);ball.vel.copy(b.vel);}else if(err>.04){ball.pos.lerp(b.pos,.25);ball.vel.lerp(b.vel,.25);}
  }
}
function netApply(e){
  NET.applying=true;
  try{
    if(e.k==='hit'){const p=M.players[e.pid];if(!p||!Array.isArray(e.p))return;
      ball.pos.set(...e.p);ball.vel.set(...e.v);ball.w.set(...e.w);ball.live=true;ball.held=null;M.tossBall=false;
      if(e.serve&&M.serve){M.serve.phase='flight';showSpeed(ball.vel.length()*3.6);M.stats.fastest=Math.max(M.stats.fastest,ball.vel.length()*3.6);}
      p.swingFx={t:0,dur:.38,dir:1,type:e.type};p.hitCD=.3;
      if(M.state==='serve'&&!e.serve){}
      beginFlight(p,!!e.serve);M.R.hitCount=1;sfx('hit',{v:ball.vel.length(),serve:e.serve,smash:e.type==='smash'});
      // adelantar la pelota lo que tardó el mensaje
      const dt=clamp((Date.now()-e.t)/1000,0,.3);let n=Math.round(dt/BDT);
      NET.applying=false;
      for(let k=0;k<n;k++){ballStep(ball,BDT,onBallEvent);if(M.state!=='rally'&&M.state!=='serve')break;}
      if(M.path)M.path.t0-=n*BDT;
      if(M.state==='serve'&&M.serve.phase==='flight')M.state='rally';
    }
    else if(e.k==='toss'){if(M.state==='serve'&&M.serve&&M.serve.server.remote)startToss();}
    else if(e.k==='retoss'){if(M.serve&&M.serve.server.remote){M.serve.phase='ready';ball.live=false;ball.held=M.serve.server;}}
    else if(e.k==='fault'){if(typeof e.before==='string'&&e.before!==scoreKey()){/* desfasado: se respeta al juez */}
      if(M.state==='rally'||M.state==='serve')fault(String(e.call||'FALTA'));}
    else if(e.k==='point'){
      if(e.before&&typeof e.before==='object'&&JSON.stringify(e.before)!==JSON.stringify(M.score))M.score=JSON.parse(JSON.stringify(e.before));
      if(M.state==='point'||M.state==='between'){M.state='rally';}
      endPoint(e.winner===0||e.winner===1?e.winner:null,String(e.call||''),e.sub?String(e.sub):null,e.kind||undefined);
    }
  }finally{NET.applying=false;}
}

/* ---------- integrar al bucle ---------- */
const _lr=lerpRender;lerpRender=function(a){_lr(a);
  if(!NET.on)return;
  for(const p of M.players){if(!p.remote||!p.netT)continue;const k=.35;
    if(!p.sm)p.sm={x:p.netT.x,z:p.netT.z,h:p.netT.h};
    p.sm.x+=(p.netT.x-p.sm.x)*k;p.sm.z+=(p.netT.z-p.sm.z)*k;p.sm.h+=(p.netT.h-p.sm.h)*k;
    p.rpos.set(p.sm.x,0,p.sm.z);p.rhR=p.sm.h;}
  netPush(false);
};

/* ---------- botones del menú ---------- */
onEl('onCreate')&&onEl('onCreate').addEventListener('click',()=>{audioInit();netJoin(randCode(),'host');});
onEl('onJoin')&&onEl('onJoin').addEventListener('click',()=>{audioInit();const c=(onEl('onCode').value||'').toUpperCase().replace(/[^A-Z]/g,'');if(c.length!==4){netStatus('El código tiene 4 letras.');return;}netJoin(c,'guest');});
onEl('onCode')&&onEl('onCode').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')onEl('onJoin').click();});
