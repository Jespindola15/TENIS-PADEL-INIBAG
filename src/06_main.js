/* ================= Entrada, cámara, interfaz, sonido y bucle ================= */
const keys=new Set(),tapped=new Set(),prevB={};let edgeCarry={};
addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);tapped.add(e.code);audioInit();});
addEventListener('keyup',e=>keys.delete(e.code));
const mouse={nx:0,ny:0,L:false,R:false,clicks:0,seen:false};
renderer.domElement.addEventListener('pointermove',e=>{const r=renderer.domElement.getBoundingClientRect();mouse.nx=(e.clientX-r.left)/r.width*2-1;mouse.ny=-((e.clientY-r.top)/r.height*2-1);mouse.seen=true;});
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===0)mouse.L=true;if(e.button===2)mouse.R=true;mouse.clicks++;audioInit();});
addEventListener('pointerup',e=>{if(e.button===0)mouse.L=false;if(e.button===2)mouse.R=false;});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
const _ray=new THREE.Raycaster(),_plane=new THREE.Plane(new V3(0,1,0),-1),_hit=new V3();
/* estela de la pelota */
const trail=[];for(let i=0;i<7;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(BR*(1-i*.1),10,8),new THREE.MeshBasicMaterial({color:0xe6ff5a,transparent:true,opacity:0,depthWrite:false}));scene.add(m);trail.push(m);}
const trailPos=[];
function updateTrail(dt){trailPos.unshift(ball.rpos.clone());if(trailPos.length>14)trailPos.pop();
  const sp=ball.vel.length(),a=ballMesh.visible?clamp((sp-9)/25,0,1):0;
  for(let i=0;i<trail.length;i++){const p=trailPos[i*2+1];const m=trail[i];if(!p||a<=0){m.visible=false;continue;}m.visible=true;m.position.copy(p);m.material.opacity=a*.45*(1-i/trail.length);}}
function getPad(){const ps=navigator.getGamepads?navigator.getGamepads():[];for(const p of ps)if(p&&p.connected)return p;return null;}
const cam={pos:new V3(0,7,-20),look:new V3(0,0,0),right:new V3(-1,0,0),fwd:new V3(0,0,1),cut:true};
function readInput(){
  const has=c=>keys.has(c)||tapped.has(c),gp=getPad(),inp={mx:0,mz:0,A:false,B:false,X:false,Y:false,start:false};
  if(gp){const ax=gp.axes;let x=ax[0]||0,z=ax[1]||0;if(hyp(x,z)<.2){x=0;z=0;}inp.mx=x;inp.mz=z;
    const b=i=>!!gp.buttons[i]&&(gp.buttons[i].pressed||gp.buttons[i].value>.35);
    inp.A=b(0);inp.B=b(1);inp.X=b(2);inp.Y=b(3);inp.start=b(9);
    if(b(12))inp.mz=-1;if(b(13))inp.mz=1;if(b(14))inp.mx=-1;if(b(15))inp.mx=1;if(gp.buttons.some(x=>x&&x.pressed))audioInit();}
  const kx=(has('KeyD')||has('ArrowRight')?1:0)-(has('KeyA')||has('ArrowLeft')?1:0),kz=(has('KeyS')||has('ArrowDown')?1:0)-(has('KeyW')||has('ArrowUp')?1:0);
  if(kx||kz){const l=hyp(kx,kz);inp.mx=kx/l;inp.mz=kz/l;}
  if(has('Space')||has('KeyJ'))inp.A=true;if(has('KeyK'))inp.X=true;if(has('KeyL'))inp.B=true;if(has('KeyI'))inp.Y=true;
  if(has('Escape')||has('KeyP'))inp.start=true;inp.mute=has('KeyM');
  for(const k of ['A','B','X','Y','start','mute']){inp[k+'p']=inp[k]&&!prevB[k];prevB[k]=inp[k];}
  inp.wx=cam.right.x*inp.mx-cam.fwd.x*inp.mz;inp.wz=cam.right.z*inp.mx-cam.fwd.z*inp.mz;
  // mouse: punto de la cancha bajo el cursor
  inp.nx=mouse.nx;inp.ny=mouse.ny;inp.mL=mouse.L||has('Space');inp.mR=mouse.R||has('ShiftLeft');
  inp.clickp=mouse.clicks>0||inp.Ap;mouse.clicks=0;
  if(mouse.seen){_ray.setFromCamera({x:mouse.nx,y:mouse.ny},camera);if(_ray.ray.intersectPlane(_plane,_hit))inp.mw={x:_hit.x,z:_hit.z};}
  tapped.clear();return inp;
}

/* ---------- cámara estilo transmisión, detrás de tu jugador ---------- */
function updateCamera(dt){
  const h=M.human;if(!h)return;const side=teamSide(h.team),padel=M.cfg.sport==='padel';
  const hx=(h.rpos||h.pos).x,bx=ball.rpos.x;
  const tx=hx*.22+bx*.08,ty=padel?7.4:7.4,tz=side*(C.HL+(padel?5.2:11));
  const lx=hx*.12+bx*.1,lz=side*(padel?2.6:4);
  const k=cam.cut?1:1-Math.exp(-dt*3);
  cam.pos.x+=(tx-cam.pos.x)*k;cam.pos.y+=(ty-cam.pos.y)*k;cam.pos.z+=(tz-cam.pos.z)*k;
  cam.look.x+=(lx-cam.look.x)*k;cam.look.y+=(.3-cam.look.y)*k;cam.look.z+=(lz-cam.look.z)*k;cam.cut=false;
  camera.position.copy(cam.pos);camera.lookAt(cam.look);
  const portrait=camera.aspect<1;camera.fov=portrait?62:(padel?50:40);camera.updateProjectionMatrix();
  cam.fwd.set(cam.look.x-cam.pos.x,0,cam.look.z-cam.pos.z).normalize();cam.right.set(-cam.fwd.z,0,cam.fwd.x);
}

/* ---------- interfaz ---------- */
const $=id=>document.getElementById(id);
let callT=0,subT=0,speedT=0;
function showCall(txt,sub){if(txt==null||txt==='null')return;$('call').innerHTML=txt+(sub?'<small>'+sub+'</small>':'');$('call').classList.add('on');callT=1.9;}
function showSub(txt){$('sub').textContent=txt;$('sub').classList.add('on');subT=1.6;}
function showSpeed(kmh){$('spv').textContent=Math.round(kmh);$('speed').classList.add('on');speedT=2.6;}
function meterSet(v){$('meter').classList.add('on');$('mfill').style.width=clamp(v,0,1.05)*100+'%';}
function meterShow(on){$('meter').classList.toggle('on',!!on);}
function updateBoard(){
  const S=M.score;if(!S)return;
  for(let t=0;t<2;t++){
    $('n'+t).textContent=M.teams[t].name;$('c'+t).style.background='#'+new THREE.Color(M.teams[t].players[0].outfit.shirt).getHexString();
    const cells=S.sets.map(s=>'<span>'+s[t]+'</span>').join('')+'<span class="cur">'+S.games[t]+'</span>';$('s'+t).innerHTML=cells;
    let pt;if(S.tb)pt=S.pts[t];else{const a=S.pts[t],b=S.pts[1-t];pt=a>=3&&b>=3?(a>b?'AD':a===b?'40':'40'):PT[Math.min(a,3)];}
    $('p'+t).textContent=pt;
    $('r'+t).classList.toggle('serving',S.server.team===t);}
}
let fadeEl=null;
function fade(v){if(!fadeEl){fadeEl=document.createElement('div');Object.assign(fadeEl.style,{position:'fixed',inset:'0',background:'#06101c',opacity:'0',transition:'opacity .45s',pointerEvents:'none'});document.body.appendChild(fadeEl);}
  fadeEl.style.opacity=v;cam.cut=true;}
function endScreen(){
  const w=M.winner,S=M.score,won=w===(NET.on?NET.myTeam:0);
  $('endT').textContent=won?'¡Ganaste!':'Perdiste';
  $('endS').textContent=M.teams[w].name+' gana '+S.sets.map(s=>s[0]+'-'+s[1]).join(', ')+' · Aces '+M.stats.aces[0]+'-'+M.stats.aces[1]+' · Ganadores '+M.stats.winners[0]+'-'+M.stats.winners[1]+' · Saque más rápido '+Math.round(M.stats.fastest)+' km/h';
  $('end').hidden=false;
}
function tickHud(dt){
  if(callT>0){callT-=dt;if(callT<=0)$('call').classList.remove('on');}
  if(subT>0){subT-=dt;if(subT<=0)$('sub').classList.remove('on');}
  if(speedT>0){speedT-=dt;if(speedT<=0)$('speed').classList.remove('on');}
  if(markMesh.material.opacity>0)markMesh.material.opacity=Math.max(0,markMesh.material.opacity-dt*.12);
  if(M.state==='serve'&&M.serve&&M.serve.server===M.human&&M.serve.phase==='ready'&&!autoplay&&subT<=0)showSub('Clic: tirar la pelota · clic de nuevo arriba para sacar · el mouse elige abierto o a la T');
}

/* ---------- sonido sintetizado ---------- */
let AC=null,master=null,muted=false,noiseBuf=null,volume=.8;
try{const v=JSON.parse(localStorage.getItem('potrero-sonido')||'null');if(v){muted=!!v.muted;volume=clamp(+v.volume,0,1);}}catch(e){}
const ICON_ON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const ICON_OFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
function setSound(m,v){if(m!=null)muted=m;if(v!=null)volume=clamp(v,0,1);
  if(master)master.gain.value=muted?0:volume;if(muted&&window.speechSynthesis)try{speechSynthesis.cancel();}catch(e){}
  const b=document.getElementById('snd');if(b){b.innerHTML=muted?ICON_OFF:ICON_ON;b.classList.toggle('off',muted);}
  const sg=document.getElementById('segSnd');if(sg)for(const x of sg.children)x.classList.toggle('on',(x.dataset.v==='off')===muted);
  const r=document.getElementById('volR'),o=document.getElementById('volO');if(r){r.value=Math.round(volume*100);o.textContent=Math.round(volume*100)+'%';}
  try{localStorage.setItem('potrero-sonido',JSON.stringify({muted,volume}));}catch(e){}}
function audioInit(){if(AC)return;try{AC=new (window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=muted?0:volume;master.connect(AC.destination);
  noiseBuf=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const mur=AC.createBufferSource();mur.buffer=noiseBuf;mur.loop=true;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=420;f.Q.value=.6;const g=AC.createGain();g.gain.value=.025;mur.connect(f);f.connect(g);g.connect(master);mur.start();}catch(e){AC=null;}}
function burst(freq,q,dur,vol,type){if(!AC||muted)return;const t=AC.currentTime,s=AC.createBufferSource();s.buffer=noiseBuf;const f=AC.createBiquadFilter();f.type=type||'bandpass';f.frequency.value=freq;f.Q.value=q;
  const g=AC.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(f);f.connect(g);g.connect(master);s.start(t,Math.random());s.stop(t+dur+.05);}
function tone(freq,dur,vol,type){if(!AC||muted)return;const t=AC.currentTime,o=AC.createOscillator();o.type=type||'sine';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*.55,t+dur);
  const g=AC.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.02);}
function sfx(k,o){o=o||{};const v=o.v||10;
  if(k==='hit'){const pad=M.cfg&&M.cfg.sport==='padel';burst(pad?1300:2100,1.4,.07,clamp(v/40,.25,.9));tone(pad?260:340,.07,clamp(v/60,.15,.5),'triangle');if(o.smash||o.serve)burst(900,.8,.12,.35);}
  else if(k==='bounce')burst(surfKey==='clay'?500:surfKey==='grass'?380:800,1.2,.06,clamp(v/16,.08,.45));
  else if(k==='net'){burst(260,.5,.18,.35,'lowpass');}
  else if(k==='glass'){tone(140,.18,.5,'sine');burst(2400,4,.12,.15);}
  else if(k==='fence'){burst(3000,.7,.25,.28);burst(700,2,.2,.2);}
  else if(k==='toss'){burst(1200,1,.03,.08);}
  else if(k==='fault'){tone(880,.12,.15,'square');}
  else if(k==='crowd'){if(!AC||muted)return;const t=AC.currentTime,dur=o.big?3:1.8,s=AC.createBufferSource();s.buffer=noiseBuf;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=1600;f.Q.value=.4;
    const g=AC.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(o.big?.5:.28,t+.25);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    const lfo=AC.createOscillator();lfo.frequency.value=13;const lg=AC.createGain();lg.gain.value=.12;lfo.connect(lg);lg.connect(g.gain);
    s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+dur);lfo.start(t);lfo.stop(t+dur);}
}
function speakScore(txt){
  if(muted||!txt||!window.speechSynthesis)return;
  try{const t=txt.replace('VENTAJA','ventaja').replace('IGUALES','iguales').replace(/ - /g,' a ').replace(/\b0\b/g,'cero');
    const u=new SpeechSynthesisUtterance(t);u.lang='es-AR';u.rate=1.05;u.volume=.8;speechSynthesis.cancel();speechSynthesis.speak(u);}catch(e){}
}

/* ---------- calidad automática ---------- */
const QUAL=[{name:'Alta',dpr:()=>Math.min(window.devicePixelRatio||1,1.75),shadow:2048},{name:'Media',dpr:()=>1,shadow:1024},{name:'Baja',dpr:()=>.75,shadow:0}];
let qLevel=0,qMode='auto',qEma=16,qSlowT=0;
function applyQuality(l){qLevel=l;const Q=QUAL[l];renderer.setPixelRatio(Q.dpr());resize();sun.castShadow=Q.shadow>0;
  if(Q.shadow&&sun.shadow.mapSize.x!==Q.shadow){sun.shadow.mapSize.set(Q.shadow,Q.shadow);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}}
function autoQuality(ms){if(qMode!=='auto')return;qEma+=(ms-qEma)*.05;if(qEma>21)qSlowT+=ms/1000;else qSlowT=Math.max(0,qSlowT-ms/2000);
  if(qSlowT>1.5&&qLevel<2){applyQuality(qLevel+1);qSlowT=0;qEma=16;}}

/* ---------- bucle ---------- */
const STEP=1/60;let simAcc=0,lastT=0,fpsN=0,fpsT=0;
function savePrev(){for(const p of M.players){p.prevPos.copy(p.pos);p.prevFacing=p.facing;p.prevRh=p.rh;}ball.prev.copy(ball.pos);}
function lerpRender(a){for(const p of M.players){p.rpos.lerpVectors(p.prevPos,p.pos,a);p.rfacing=p.prevFacing+wrapAng(p.facing-p.prevFacing)*a;p.rhR=lerp(p.prevRh??p.rh,p.rh,a);}ball.rpos.lerpVectors(ball.prev,ball.pos,a);}
function frame(now){
  requestAnimationFrame(frame);
  const raw=Math.min(.1,(now-(lastT||now))/1000);lastT=now;perfT+=raw;
  fpsN++;fpsT+=raw;if(fpsT>.5){$('fps').textContent=Math.round(fpsN/fpsT);fpsN=0;fpsT=0;}autoQuality(raw*1000);
  const inp=readInput();for(const k in edgeCarry)if(edgeCarry[k])inp[k]=true;edgeCarry={};
  if(inp.mutep){setSound(!muted);showSub(muted?'Sonido apagado':'Sonido encendido');}
  if(inp.startp&&M.state!=='menu'&&M.state!=='done'){togglePause();}
  if(M.state==='menu'||M.state==='paused'||M.state==='done'){renderer.render(scene,camera);menuCam(raw);return;}
  simAcc+=raw;let n=0;
  while(simAcc>=STEP&&n<6){savePrev();stepSim(STEP,inp);for(const k of ['Ap','Bp','Xp','Yp','startp','mutep','clickp'])inp[k]=false;simAcc-=STEP;n++;}
  if(n===0)for(const k of ['Ap','Bp','Xp','Yp','clickp'])if(inp[k])edgeCarry[k]=true;
  if(n===6)simAcc=0;
  lerpRender(simAcc/STEP);
  // tu raqueta se dibuja donde está el mouse en este mismo cuadro
  const me=M.human;if(me&&!autoplay&&mouse.seen&&M.state!=='done'){_ray.setFromCamera({x:mouse.nx,y:mouse.ny},camera);
    if(_ray.ray.intersectPlane(_plane,_hit)){const t=(M.state==='serve'&&M.serve&&M.serve.server===me)?{x:me.pos.x,z:me.pos.z}:clampMine(me,_hit.x,_hit.z);me.rpos.set(t.x,0,t.z);}}
  for(const p of M.players)animateRacket(p,raw);

  ballMesh.position.copy(ball.rpos);ballMesh.rotation.x+=raw*hyp(ball.vel.x,ball.vel.z)*3;ballMesh.visible=ball.live||!!ball.held;
  const bh=Math.max(0,ball.rpos.y-BR);ballShadow.position.set(ball.rpos.x,.012,ball.rpos.z);const s=.2+bh*.04;ballShadow.scale.set(s,s,1);ballShadow.material.opacity=.75/(1+bh*.6);ballShadow.visible=ballMesh.visible;
  updateCrowd(raw);updateCamera(raw);tickHud(raw);
  sun.target.position.set(cam.look.x,0,cam.look.z*.4);sun.position.set(sun.target.position.x-18,40,sun.target.position.z+14);
  renderer.render(scene,camera);
}
let menuA=0;
function menuCam(dt){menuA+=dt*.08;camera.position.set(Math.sin(menuA)*22,9,Math.cos(menuA)*22);camera.lookAt(0,0,0);}

/* ---------- menú ---------- */
const CFG={sport:'tennis',surf:'hard',diff:'normal',len:'short',np:1};
function seg(id,key,cb){const el=$(id);el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;for(const x of el.children)x.classList.toggle('on',x===b);CFG[key]=b.dataset.v;cb&&cb(b.dataset.v);});}
seg('segSport','sport',v=>{$('optSurf').hidden=v==='padel';buildVenue(CFG.sport,CFG.surf);
  CFG.np=v==='padel'?2:1;for(const b of $('segNp').children)b.classList.toggle('on',+b.dataset.v===CFG.np);});
seg('segNp','np',v=>{CFG.np=+v;});
seg('segSurf','surf',()=>buildVenue(CFG.sport,CFG.surf));seg('segDiff','diff');seg('segLen','len');
seg('segQ','q',v=>{qMode=v==='auto'?'auto':'fixed';applyQuality(v==='auto'?0:+v);});
function startGame(){audioInit();renderer.domElement.style.cursor='none';$('menu').hidden=true;$('end').hidden=true;$('pause').hidden=true;$('hud').hidden=false;setupMatch(Object.assign({},arguments[0]&&arguments[0].sport?arguments[0]:CFG));cam.cut=true;}
$('play').addEventListener('click',()=>startGame());$('again').addEventListener('click',()=>{if(NET.on)netRematch();else startGame();});
$('toMenu').addEventListener('click',()=>{netLeave&&netLeave();renderer.domElement.style.cursor='';$('end').hidden=true;$('hud').hidden=true;$('menu').hidden=false;M.state='menu';});
function togglePause(){if(NET.on){$('pause').hidden=!$('pause').hidden;return;}if(M.state==='paused'){M.state=M.prevState;$('pause').hidden=true;}else{M.prevState=M.state;M.state='paused';$('pause').hidden=false;}}
$('resume').addEventListener('click',()=>togglePause());
$('quit').addEventListener('click',()=>{netLeave&&netLeave();$('pause').hidden=true;$('hud').hidden=true;$('menu').hidden=false;M.state='menu';});

/* ---------- sonido: botón en el partido, opción y volumen en el menú ---------- */
$('snd').addEventListener('click',e=>{e.stopPropagation();audioInit();setSound(!muted);});
$('snd').addEventListener('pointerdown',e=>e.stopPropagation());
$('segSnd').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;audioInit();setSound(b.dataset.v==='off');});
$('volR').addEventListener('input',e=>{audioInit();setSound(+e.target.value===0?true:false,+e.target.value/100);});
setSound();
/* ---------- arranque ---------- */
buildVenue('tennis','hard');
(function boot(){
  const btn=$('play'),done=()=>{btn.disabled=false;btn.textContent='Jugar';};
  done();
})();
requestAnimationFrame(frame);
