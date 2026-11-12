/* ================= Partido: jugadores, reglas, puntaje, saque, golpes e IA ================= */
const DIFF={easy:{err:.95,margin:1.05,pow:.45,react:.34,speed:.86,assist:.32,label:'Fácil'},normal:{err:.6,margin:.7,pow:.68,react:.24,speed:.95,assist:.18,label:'Normal'},hard:{err:.36,margin:.45,pow:.88,react:.16,speed:1.02,assist:.1,label:'Difícil'}};
const NAMES=['M. Ferraro','L. Duarte','T. Ibarra','S. Rinaldi','N. Quiroga','F. Benítez','C. Aguirre','J. Molina','R. Sosa','A. Villalba'];
const OUTFITS=[
  {shirt:0xf4f6f9,shorts:0x1b2b48,socks:0xffffff,shoes:0xf2f2f2,racket:0x101418,accent:0xd9f23a},
  {shirt:0xd8423a,shorts:0xf2f4f7,socks:0xffffff,shoes:0xf2f2f2,racket:0xf2f2f2,accent:0xd8423a},
  {shirt:0x2a78d6,shorts:0x0f1726,socks:0xffffff,shoes:0x222222,racket:0x1d4fa0,accent:0xffffff},
  {shirt:0xf2c230,shorts:0x1d1f24,socks:0xffffff,shoes:0xf2f2f2,racket:0x222222,accent:0xf2c230},
  {shirt:0x16a37a,shorts:0xf2f4f7,socks:0xffffff,shoes:0xf2f2f2,racket:0xffffff,accent:0x16a37a},
  {shirt:0x6b4bc8,shorts:0x1d1f24,socks:0xffffff,shoes:0x222222,racket:0x6b4bc8,accent:0xf4f6f9}
];
const M={cfg:null,teams:[],players:[],human:null,state:'menu',timer:0,score:null,R:null,path:null,lastCall:null,stats:null};
let autoplay=false,diff=DIFF.normal;
/* online: cada compu maneja su equipo y decide lo que pasa en su lado de la cancha */
const NET={on:false,myTeam:0,applying:false,send:()=>{}};
const judgeHere=side=>!NET.on||side===teamSide(NET.myTeam);

function newPlayer(team,slot,name,human,outfit,tone,height){
  const p={team,slot,name,human,pos:new V3(),vel:new V3(),prevPos:new V3(),rpos:new V3(),facing:0,baseFacing:0,rfacing:0,prevFacing:0,want:new V3(),
    swing:null,commit:null,buffer:null,twoHand:human||Math.random()<.6,lane:slot===0?'R':'L',celebT:0,sadT:0,body:null,bodyT:0,jumpY:0,padel:M.cfg.sport==='padel',outfit,tone,height,auto:false,netMode:false,home:new V3()};
  p.rk=makeRacket(outfit.racket,outfit.accent,p.padel);p.rh=1;p.hand=1;p.hitCD=0;
  return p;
}
function clearPlayers(){for(const p of M.players)removeRacket(p.rk);M.players=[];}
function setupMatch(cfg){
  M.cfg=cfg;diff=DIFF[cfg.diff];surfKey=cfg.sport==='padel'?'padel':cfg.surf;
  buildVenue(cfg.sport,cfg.surf);clearPlayers();
  const n=cfg.np||(cfg.sport==='padel'?2:1),outs=[...OUTFITS].sort(()=>Math.random()-.5),names=[...NAMES].sort(()=>Math.random()-.5);
  M.teams=[0,1].map(t=>({idx:t,side:t===0?-1:1,players:[]}));
  for(let t=0;t<2;t++)for(let i=0;i<n;i++){
    const mt=NET.on?NET.myTeam:0,human=t===mt&&i===0,nm=human?'Vos':(NET.on&&i===0?'Rival':names.pop());
    const p=newPlayer(t,i,nm,human,outs[t*n+i]||outs[0],(Math.random()*3)|0,rand(.97,1.04));p.remote=NET.on&&t!==mt;
    M.teams[t].players.push(p);M.players.push(p);}
  const mt=NET.on?NET.myTeam:0;M.human=M.teams[mt].players[0];
  for(let t=0;t<2;t++){const P=M.teams[t].players;M.teams[t].name=n===1?P[0].name:P[0].name+' / '+P[1].name.split(' ').pop();}
  const L=cfg.len;M.score={sets:[],games:[0,0],pts:[0,0],tb:false,setTo:L==='short'?3:6,setsTo:L==='bo3'?2:1,server:{team:cfg.firstServer??(Math.random()<.5?0:1),idx:[0,0]},serveNo:1,totalGames:0,tbFirst:0,tbStartServer:0};
  M.stats={aces:[0,0],winners:[0,0],errors:[0,0],df:[0,0],fastest:0};
  M.state='serve';setupServe();
}
/* ---------- utilidades de lado ---------- */
const teamSide=t=>M.teams[t].side;
function faceOf(side){return side<0?0:Math.PI;}
function inServeBox(x,z,box){return x>=box.x0-BR&&x<=box.x1+BR&&z>=box.z0-BR&&z<=box.z1+BR;}
const doubles=()=>(M.cfg.np||(M.cfg.sport==='padel'?2:1))===2;
function inCourt(x,z,side){const hw=(C.walls||doubles())?C.HWd:C.HWs;return Math.abs(x)<=hw+BR&&z*side>=-BR&&Math.abs(z)<=C.HL+BR;}

/* ---------- saque ---------- */
function serverPlayer(){const s=M.score.server,T=M.teams[s.team];return T.players[s.idx[s.team]%T.players.length];}
function servingDeuce(){const S=M.score;return S.tb?((S.pts[0]+S.pts[1])%2===0):((S.pts[0]+S.pts[1])%2===0);}
function setupServe(){
  const S=M.score,sv=serverPlayer(),st=sv.team,side=teamSide(st),deuce=servingDeuce(),rt=1-st,rside=teamSide(rt);
  const fc=faceOf(side),Rx=-Math.cos(fc);// x de la derecha del sacador
  const sx=(deuce?1:-1)*Rx;// lado derecho = deuce
  const padel=M.cfg.sport==='padel';
  for(const p of M.players){p.vel.set(0,0,0);p.swing=null;p.commit=null;p.buffer=null;p.auto=false;p.body=null;p.jumpY=0;p.celebT=0;p.sadT=0;p.netMode=false;p.rh=1;p.swingFx=null;p.hitCD=0;p.target=null;}
  sv.pos.set(sx*(padel?1.6:.75),0,side*(padel?C.SL+1.4:C.HL+.25));
  // receptor: el de la diagonal
  const RT=M.teams[rt],rxSign=-sx;
  const rRight=-Math.cos(faceOf(rside));let recv=RT.players[0];if(RT.players.length>1){recv=RT.players.find(p=>(p.lane==='R'?rRight:-rRight)===rxSign)||RT.players[0];}
  for(const p of RT.players){const right=p===recv;const x=right?rxSign*(padel?2.9:C.HWs*.72):-rxSign*2.6;p.pos.set(x,0,right?rside*(padel?C.HL-1.4:C.HL+.9):rside*(C.SL-.4));}
  for(const p of M.teams[st].players)if(p!==sv)p.pos.set(-sx*2.6,0,side*3.6);
  for(const p of M.players){p.baseFacing=p.facing=p.rfacing=faceOf(teamSide(p.team));p.prevPos.copy(p.pos);p.rpos.copy(p.pos);p.prevFacing=p.facing;}
  M.serve={server:sv,receiver:recv,box:{x0:Math.min(0,rxSign*(padel?C.HWd:C.HWs)),x1:Math.max(0,rxSign*(padel?C.HWd:C.HWs)),z0:Math.min(0,rside*C.SL),z1:Math.max(0,rside*C.SL)},phase:'ready',t:0,tossT:0,cord:false,wait:sv.human&&!autoplay?99:rand(.7,1.3)};
  ball.live=false;ball.held=sv;placeBallInHand(sv);
  M.R=null;M.path=null;helpRing.material.opacity=0;
  updateBoard();
}
function placeBallInHand(p){const fc=p.baseFacing,F={x:Math.sin(fc),z:Math.cos(fc)},R={x:-Math.cos(fc),z:Math.sin(fc)};
  ball.pos.set(p.pos.x+F.x*.12-R.x*.55,.9,p.pos.z+F.z*.12-R.z*.55);ball.vel.set(0,0,0);ball.w.set(0,0,0);}
function serveIdealT(){return M.cfg.sport==='padel'?.62:.78;}
function startToss(){const s=M.serve,p=s.server;s.phase='toss';s.tossT=0;ball.held=null;ball.live=true;
  const fc=p.baseFacing,F={x:Math.sin(fc),z:Math.cos(fc)},R={x:-Math.cos(fc),z:Math.sin(fc)};
  if(M.cfg.sport==='padel'){ball.pos.set(p.pos.x+F.x*.12,.95,p.pos.z+F.z*.12);ball.vel.set(0,-.5,0);}
  else{ball.pos.set(p.pos.x+F.x*.12,1.55,p.pos.z+F.z*.12);ball.vel.set(0,5.3,0);}
  ball.w.set(0,0,0);M.tossBall=true;
  sfx('toss');if(!NET.applying)NET.send('toss',{});
}
function hitServe(quality,aimX){
  const s=M.serve,p=s.server,S=M.score,side=teamSide(p.team),rside=-side,padel=M.cfg.sport==='padel';
  const second=S.serveNo===2,q=clamp(quality,0,1);
  const box=s.box,wide=clamp(aimX,-1,1);// -1 al centro (T), 1 abierto
  const sx=Math.sign(box.x0+box.x1)||1;
  let tx=sx*lerp(.45,(padel?C.HWd:C.HWs)-.35,(wide+1)/2),tz=rside*(C.SL-(second?1.1:.55)-(1-q)*.8);
  const err=(p.human&&!autoplay?.18+(1-q)*.75:.14+diff.err*.35)*(second?.6:1)*(q>.97&&!second?1.35:1);
  tx+=gauss()*err;tz+=gauss()*err*.8;
  const [v0,v1]=second?SP.serve2:SP.serve,vh=lerp(v0,v1,q)*(p.human&&!autoplay?1:lerp(.85,1,diff.pow)),spin=second?320:(padel?120:60);
  const from=ball.pos.clone(),sol=solveShot(from,tx,tz,vh,spin,second?.35:.06);
  ball.vel.copy(sol.vel);ball.w.copy(sol.w);M.tossBall=false;
  M.stats.fastest=Math.max(M.stats.fastest,ball.vel.length()*3.6);
  showSpeed(ball.vel.length()*3.6);
  beginFlight(p,true);s.phase='flight';
  sfx('hit',{v:ball.vel.length(),serve:true});netHit(p,true,'serve');
}

function netHit(p,serve,type){if(!NET.on||NET.applying)return;const r=v=>[+v.x.toFixed(4),+v.y.toFixed(4),+v.z.toFixed(4)];
  NET.send('hit',{pid:M.players.indexOf(p),serve,type,p:r(ball.pos),v:r(ball.vel),w:r(ball.w),t:Date.now()});}
/* ---------- vuelo de la pelota y reglas ---------- */
function beginFlight(hitter,serve){
  M.R={hitTeam:hitter.team,hitter,bounces:0,serve,cord:false,crossed:false};
  M.path=predictPath(5);
  // asignar quién devuelve en el equipo rival
  const opp=M.teams[1-hitter.team];let best=null;
  for(const p of opp.players){p.commit=null;const c=chooseContact(p,serve);p.plan=c;if(c&&(!best||c.cost<best.c.cost))best={p,c};}
  for(const p of opp.players){p.assigned=best&&best.p===p;p.reactT=simT+(p.human&&!autoplay?0:diff.react*rand(.8,1.25));}
  for(const p of M.teams[hitter.team].players){p.assigned=false;p.plan=null;}
  if(serve){M.serve.receiver.assigned=true;for(const p of opp.players)if(p!==M.serve.receiver)p.assigned=false;}
  // ayuda visual en fácil
  const h=M.human;if(M.cfg.diff==='easy'&&h.team!==hitter.team&&h.assigned&&h.plan&&!autoplay){helpRing.position.set(h.plan.stance.x,.015,h.plan.stance.z);helpRing.material.opacity=.7;}
  else helpRing.material.opacity=0;
}
function onBallEvent(type,d){
  if(M.state!=='rally'&&!(M.state==='serve'&&M.serve.phase==='flight'))return;
  const R=M.R;
  if(!R){// pelota en el aire del lanzamiento del saque
    return;}
  if(type==='cord'){if(R.serve)R.cord=true;sfx('net',{v:3});return;}
  if(type==='net'){sfx('net',{v:hyp(ball.vel.x,ball.vel.z)+4});return;}
  const hs=teamSide(R.hitTeam);
  if(type==='bounce'){
    sfx('bounce',{v:d.v});markMesh.position.set(d.x,.006,d.z);markMesh.material.opacity=M.cfg.sport==='padel'||surfKey!=='clay'?0:.55;markMesh.rotation.z=Math.atan2(ball.vel.x,ball.vel.z);
    const side=Math.sign(d.z)||1;if(!judgeHere(side))return;
    if(R.serve&&R.bounces===0){
      if(side!==hs&&inServeBox(d.x,d.z,M.serve.box)){if(R.cord){return endPoint(null,'LET','Se repite el saque');}R.bounces=1;R.serveIn=true;M.state='rally';return;}
      if(R.cord&&side!==hs){}// red y afuera: falta común
      return fault(side===hs?'RED':'FALTA');
    }
    if(side===hs){// picó del lado de quien pegó
      if(R.bounces>=1)return endPoint(R.hitTeam,'PUNTO');
      return endPoint(1-R.hitTeam,ball.netTouched?'RED':'RED',null,'error');}
    if(R.bounces===0){if(!inCourt(d.x,d.z,side))return endPoint(1-R.hitTeam,'FUERA',null,'error');R.bounces=1;return;}
    return endPoint(R.hitTeam,R.serve?'¡ACE!':'¡GANADOR!',null,'winner');
  }
  if(type==='wall'){sfx(d.glass?'glass':'fence',{v:hyp(ball.vel.x,ball.vel.z)});if(!judgeHere(d.side))return;
    if(R.bounces===0&&d.side!==hs)return R.serve?fault('FALTA'):endPoint(1-R.hitTeam,'PARED',null,'error');
    if(R.serve&&R.bounces>=1&&!d.glass)return endPoint(R.hitTeam,'¡ACE!',null,'winner');
    return;}
  if(type==='gone'){if(!judgeHere(Math.sign(ball.pos.z)||1))return;if(R.bounces>=1)return endPoint(R.hitTeam,'¡AFUERA DE LA PISTA!',null,'winner');return endPoint(1-R.hitTeam,'FUERA',null,'error');}
}
function fault(call){
  if(NET.on&&!NET.applying)NET.send('fault',{call,before:scoreKey()});
  const S=M.score,t=M.serve.server.team;
  if(S.serveNo===1){S.serveNo=2;showCall(call,'Segundo saque');M.state='between';M.timer=1.3;M.after=()=>{M.state='serve';setupServe();};sfx('fault');return;}
  M.stats.df[t]++;endPoint(1-t,'DOBLE FALTA',null,'error');
}

/* ---------- puntaje ---------- */
const scoreKey=()=>JSON.stringify([M.score.sets,M.score.games,M.score.pts,M.score.serveNo]);
const PT=['0','15','30','40'];
function pointText(){const S=M.score,[a,b]=S.pts;
  if(S.tb)return a+' - '+b;
  if(a>=3&&b>=3){if(a===b)return 'IGUALES';return 'VENTAJA '+(a>b?M.teams[0].name:M.teams[1].name).toUpperCase();}
  const sv=M.score.server.team;const x=PT[Math.min(a,3)],y=PT[Math.min(b,3)];return sv===0?x+' - '+y:y+' - '+x;}
function endPoint(winner,call,sub,kind){
  if(M.state==='point'||M.state==='between'||M.state==='over')return;
  if(NET.on&&!NET.applying)NET.send('point',{winner,call,sub:sub||null,kind:kind||null,before:JSON.parse(JSON.stringify(M.score))});
  M.helpOff=true;helpRing.material.opacity=0;
  if(winner===null){M.state='between';M.timer=1.4;showCall(call,sub||'');M.after=()=>{M.state='serve';setupServe();};return;}
  const S=M.score;S.pts[winner]++;
  if(kind==='winner')M.stats.winners[winner]++;if(kind==='error')M.stats.errors[1-winner]++;if(call==='¡ACE!')M.stats.aces[winner]++;
  for(const p of M.players){if(p.team===winner){p.celebT=1.6;}else p.sadT=1.6;}
  crowd&&(crowd.cheer=kind==='winner'||call==='¡ACE!'?2.6:1.4);sfx('crowd',{big:kind==='winner'});
  let gameWon=-1;const [a,b]=S.pts;
  if(S.tb){const tgt=S.tbTo||7;if((a>=tgt||b>=tgt)&&Math.abs(a-b)>=2)gameWon=a>b?0:1;}
  else if((a>=4||b>=4)&&Math.abs(a-b)>=2)gameWon=a>b?0:1;
  let subTxt=pointText(),big=call;
  M.state='point';M.timer=2.3;
  if(gameWon>=0){
    S.games[gameWon]++;S.pts=[0,0];S.totalGames++;S.serveNo=1;
    let setWon=-1;const [g0,g1]=S.games,to=S.setTo;
    if(S.tb)setWon=gameWon;else if((g0>=to||g1>=to)&&Math.abs(g0-g1)>=2)setWon=g0>g1?0:1;
    const wasTb=S.tb;
    if(setWon<0&&g0===to&&g1===to){S.tb=true;S.tbTo=to===3?5:7;S.tbStartServer=1-S.server.team;}
    subTxt=(gameWon===0?'Juego para ':'Juego para ')+M.teams[gameWon].name+' · '+S.games[0]+'-'+S.games[1];
    if(setWon>=0){S.sets.push([...S.games]);S.games=[0,0];S.tb=false;
      const won=S.sets.filter(s=>s[setWon]>s[1-setWon]).length;
      subTxt='Set para '+M.teams[setWon].name;
      if(won>=S.setsTo){M.state='over';M.timer=3;showCall(big,'¡Partido para '+M.teams[setWon].name+'!');M.winner=setWon;
        for(const p of M.teams[setWon].players){p.celebT=6;p.body='celebrate';}sfx('crowd',{big:true});crowd&&(crowd.cheer=5);updateBoard();return;}}
    // rota el saque
    if(wasTb){S.server.team=S.tbStartServer;}
    S.server.idx[S.server.team]++;S.server.team=1-S.server.team;
    if(S.totalGames%2===1||(wasTb))M.changeEnds=true;
  }else if(S.tb){const n=S.pts[0]+S.pts[1];if(n%2===1){S.server.idx[S.server.team]++;S.server.team=1-S.server.team;}}
  else S.serveNo=1;
  if(gameWon<0)S.serveNo=1;
  showCall(big,subTxt);updateBoard();speakScore(gameWon>=0?null:subTxt);
  M.after=()=>{if(M.changeEnds){M.changeEnds=false;M.state='ends';M.timer=1.2;fade(1);M.after=()=>{for(const T of M.teams)T.side*=-1;M.state='serve';setupServe();fade(0);showCall('CAMBIO DE LADO','');};return;}
    M.state='serve';setupServe();};
}

/* ---------- elegir dónde y cuándo pegarle ---------- */
const _pc=new V3();
function chooseContact(p,mustBounce){
  const path=M.path;if(!path)return null;const side=teamSide(p.team),i0=Math.max(0,Math.round((simT-path.t0)/BDT)+12);
  const bnc=[],walls=[];for(const e of path.evs){if(e.type==='bounce')bnc.push(e);else if(e.type==='net'&&false)walls.push(e);}
  const fc=faceOf(side),bR={x:-Math.cos(fc),z:Math.sin(fc)},bF={x:Math.sin(fc),z:Math.cos(fc)},h=p.height;
  let best=null,fall=null;
  for(let i=i0;i<path.n;i+=2){
    const x=path.P[i*3],y=path.P[i*3+1],z=path.P[i*3+2];if(z*side<.4)continue;
    let nb=0;for(const e of bnc)if(e.i<i&&Math.sign(e.z)===side)nb++;
    const bOpp=bnc.some(e=>e.i<i&&Math.sign(e.z)!==side);
    if(nb>=2)break;if(mustBounce&&nb<1)continue;
    if(nb===0&&bOpp&&!C.walls)continue;
    let kind=nb===0?'volley':'ground';
    if(y>1.95&&y<3.05&&(nb===0||y>2.1))kind='smash';else if(y<.18||y>2.05)continue;
    if(kind==='smash'&&mustBounce)continue;
    const rel=(x-p.pos.x)*bR.x+(z-p.pos.z)*bR.z,sd=kind==='smash'?1:(rel>-.25?1:-1);
    const sx=x-bF.x*.05,sz=z-bF.z*.05;
    const ti=(i+1)*BDT-(simT-path.t0),d=hyp(sx-p.pos.x,sz-p.pos.z),spd=SP.run*(p.human&&!autoplay?1:diff.speed),need=d/spd+.1+(d>1.5?.12:0);
    let cost=Math.abs(y-(kind==='smash'?2.4:1.0))*1.1+ti*.35;
    if(kind==='volley'){const az=Math.abs(z);cost+=az>6.5?2.4:az>4.5?.6:-.4;}
    if(kind==='smash')cost-=.3;
    if(C.walls&&nb===1&&Math.abs(z)>C.HL-1.2)cost+=.5;
    const c={i,t:path.t0+(i+1)*BDT,ball:new V3(x,y,z),side:sd,kind,stance:new V3(sx,0,sz),cost,feasible:need<=ti,need,ti};
    if(c.feasible){if(!best||cost<best.cost)best=c;}
    else{const def=need-ti;if(!fall||def<fall.def){c.def=def;fall=c;}}
  }
  return best||fall;
}
function commitSwing(p,c,type,pressT){
  const kind=c.kind==='smash'?'smash':c.kind;
  p.swing={kind:kind==='ground'?'ground':kind,side:c.side,type,tc:c.t,t0:simT,ball:c.ball.clone(),pressT,twoHand:p.twoHand,aim:null,done:false};
  p.commit=c;p.auto=true;
}

/* ---------- golpe: dirección, fuerza y efecto ---------- */
function shotTarget(p,type,ax,ay,q){
  const opp=-teamSide(p.team),fc=faceOf(teamSide(p.team)),Rx=-Math.cos(fc),hw=(C.walls||doubles()?C.HWd:C.HWs),HL=C.HL;
  const marg=p.human&&!autoplay?.45:diff.margin;
  let depth;
  if(type==='drop')depth=lerp(1.6,3.2,(ay+1)/2);
  else if(type==='lob')depth=HL-lerp(2.6,.9,(ay+1)/2)-(M.cfg.sport==='padel'?1.2:0);
  else if(type==='smash')depth=lerp(5,HL-1.2,(ay+1)/2);
  else depth=ay<0?lerp(5.2,HL-2.4,ay+1):lerp(HL-2.4,HL-.55,ay);
  const angled=depth<7?1.08:1;
  const tx=Rx*ax*(hw-marg)*angled,tz=opp*Math.min(depth,HL-marg*.6-(M.cfg.sport==='padel'?.9:0));
  return {x:tx,z:tz};
}
function executeHit(p){// IA (y piloto automático): golpe planificado
  const sw=p.swing;let type=sw.kind==='smash'?'smash':sw.type;
  const off=hyp(ball.pos.x-p.pos.x,ball.pos.z-p.pos.z),comfy=clamp(1-(off-.15)/.5,0,1);
  const q=clamp(diff.pow*rand(.85,1.1)*lerp(.75,1,comfy),.2,1);
  const ai=aiAim(p,type);type=ai.type||type;if(sw.kind==='volley'&&type==='top')type='volley';
  sw.done=true;p.commit=null;p.auto=false;
  doShot(p,type,ai.x,ai.y,q,comfy,sw.kind==='volley');
}
function executeHitMouse(p,inp){// tu raqueta: el movimiento del mouse define el golpe
  const fc=faceOf(teamSide(p.team)),bF={x:Math.sin(fc),z:Math.cos(fc)},bR={x:-Math.cos(fc),z:Math.sin(fc)};
  const vf=p.vel.x*bF.x+p.vel.z*bF.z,vl=p.vel.x*bR.x+p.vel.z*bR.z,R=M.R,volley=R.bounces===0;
  let type=inp.mR?(vf<1.5?'drop':'slice'):(vf<-1.4?'lob':'top');
  if(ball.pos.y>1.85&&type==='top')type='smash';else if(volley&&type==='top')type='volley';
  const oL=(ball.pos.x-p.pos.x)*bR.x+(ball.pos.z-p.pos.z)*bR.z,oV=ball.pos.y-p.rh,off=hyp(oL,oV);
  const comfy=clamp(1-Math.max(0,off-.2)/.4,0,1);
  let q;
  if(type==='top'||type==='volley')q=clamp(.38+vf/7+(inp.mL?.25:0),.2,1);
  else if(type==='smash')q=clamp(.65+vf/10+(inp.mL?.2:0),.4,1);
  else if(type==='slice')q=clamp(.4+vf/10,.25,.85);else if(type==='lob')q=.62;else q=.5;
  const ax=clamp(vl/4.2+oL*1.6,-1,1),ay=type==='lob'?.4:type==='drop'?clamp(vf/3-.5,-1,1):clamp(q*2-1,-1,1);
  doShot(p,type,ax,ay,q,comfy,volley);
}
function doShot(p,type,ax,ay,q,comfy,volley){
  const human=p.human&&!autoplay;
  const tgt=shotTarget(p,type,ax,ay,q);
  const errBase=human?(.12+(1-q)*.3+(1-comfy)*.45):diff.err*(1.15-q*.3)*(1.4-comfy*.4);
  const k=type==='drop'?.55:type==='lob'?.9:1;
  tgt.x+=gauss()*errBase*k;tgt.z+=gauss()*errBase*k*.9;
  const S=SP.shot,key=type in S?type:'volley';
  const vh=lerp(S[key][0],S[key][1],q);
  const spin={top:lerp(160,360,q),slice:-140,lob:150,drop:-260,smash:40,volley:-60}[key];
  const clear={top:.32,slice:.16,lob:1.6,drop:.25,smash:.05,volley:.12}[key];
  const sol=solveShot(ball.pos.clone(),tgt.x,tgt.z,vh,spin,clear);
  ball.vel.copy(sol.vel);ball.w.copy(sol.w);
  p.lastShot=type;p.hitCD=.3;
  const fc=faceOf(teamSide(p.team));p.swingFx={t:0,dur:.38,dir:Math.sign((tgt.x-ball.pos.x)*-Math.cos(fc))||1,type};
  beginFlight(p,false);M.R.hitCount=1;
  sfx('hit',{v:ball.vel.length(),smash:type==='smash'});netHit(p,false,type);
  if(!human){const deep=Math.abs(tgt.z)>C.HL-3;p.netMode=(type==='smash'||volley)?true:(deep&&Math.random()<(M.cfg.sport==='padel'?.55:.14));}
  for(const t of M.teams[p.team].players)if(t!==p&&doubles()&&!(t.human&&!autoplay))t.netMode=p.netMode||type==='lob';
  for(const t of M.teams[1-p.team].players)if(type==='lob'&&doubles())t.netMode=false;
}

/* ---------- IA ---------- */
function aiAim(p,type){
  const opp=M.teams[1-p.team].players,fc=p.baseFacing,Rx=-Math.cos(fc);
  const near=opp.reduce((a,b)=>Math.abs(b.pos.z)<Math.abs(a.pos.z)?b:a,opp[0]);
  const oppAtNet=Math.abs(near.pos.z)<5.2;
  let t=type,ax,ay=rand(.1,1);
  const r=Math.random();
  if(p.swing.kind==='smash')t='smash';
  else if(p.swing.kind==='volley')t='volley';
  else if(oppAtNet&&r<.38)t='lob';
  else if(M.cfg.sport==='padel'&&r<.22)t='lob';
  else if(Math.abs(ball.pos.y)<.45||r<.2)t='slice';
  else if(r<.27&&Math.abs(near.pos.z)>C.HL-.5)t='drop';
  else t='top';
  // apuntar lejos del rival más cercano
  const ox=opp.length>1?(opp[0].pos.x+opp[1].pos.x)/2:near.pos.x,sideAway=-Math.sign(ox*Rx||rand(-1,1));
  ax=sideAway*rand(.35,1);if(Math.random()<.15)ax=-ax*.6;
  if(t==='volley'||t==='smash'){ax=sideAway*rand(.5,1);ay=rand(-.6,.6);}
  if(t==='top'&&oppAtNet)ay=rand(-.2,.6);
  return {x:ax,y:ay,type:t};
}
function aiThink(p,dt){
  const R=M.R;
  // golpe asignado: comprometerse tras el tiempo de reacción
  if(R&&R.hitTeam!==p.team&&p.assigned&&!p.commit&&(!p.swing||p.swing.done)&&simT>=p.reactT){
    const c=chooseContact(p,R.serve&&R.bounces===0);
    if(c){commitSwing(p,c,'top',simT-rand(0,.2));}
  }
  if(p.commit){p.want.set(0,0,0);return;}
  // recuperar posición
  const side=teamSide(p.team),padel=M.cfg.sport==='padel';let hx=0,hz;
  if(doubles()){hx=(p.lane==='R'?1:-1)*(-Math.cos(p.baseFacing))*(padel?2.45:2.7)+ball.pos.x*.25;hz=side*(p.netMode?(padel?3.4:3.3):(padel?C.HL-2.4:C.HL+.3));
    if(R&&R.hitTeam===p.team&&!p.netMode)hz=side*(padel?C.HL-2.6:C.HL+.2);}
  else{hz=side*(p.netMode?3.2:(padel?C.HL-2.3:C.HL+.7));
    // ponerse en la bisectriz del posible golpe rival
    hx=clamp(ball.pos.x*.45,-2.6,2.6);
    if(R&&R.hitTeam===p.team&&M.path){const lp=M.path.evs.find(e=>e.type==='bounce');if(lp)hx=clamp(lp.x*.35,-2.2,2.2);}}
  // si el rival tira un globo por encima, volver
  if(p.netMode&&R&&R.hitTeam!==p.team&&ball.vel.y>3&&Math.abs(ball.vel.z)<14)p.netMode=false;
  const dx=hx-p.pos.x,dz=hz-p.pos.z,d=hyp(dx,dz);
  if(d<.25)p.want.set(0,0,0);else{const s=Math.min(1,d/1.2)*(d<2?.55:.85);p.want.set(dx/d*s,0,dz/d*s);}
}

/* ---------- control humano: la raqueta sigue al mouse ---------- */
let lastInp=null;
function clampMine(p,x,z){const side=teamSide(p.team),padel=M.cfg.sport==='padel',zl=padel?C.HL-.3:C.HL+5.5,xl=padel?C.HWd-.3:C.HWd+4;
  return {x:clamp(x,-xl,xl),z:side*clamp(z*side,.45,zl)};}
function humanControl(p,inp,dt){
  lastInp=inp;const side=teamSide(p.team);
  if(inp.mw)p.target=clampMine(p,inp.mw.x,inp.mw.z);
  if(M.state==='serve'&&M.serve.server===p){
    const s=M.serve;
    if(s.phase==='ready'){
      const lim=M.cfg.sport==='padel'?[.4,C.HWd-.6]:[.25,C.HWs-.3],sgn=Math.sign(p.pos.x)||1;
      if(p.target){const tx=sgn*clamp(Math.abs(p.target.x)*(Math.sign(p.target.x)===sgn?1:0),lim[0],lim[1]);p.pos.x+=clamp(tx-p.pos.x,-6*dt,6*dt);}
      placeBallInHand(p);if(inp.clickp)startToss();
    }else if(s.phase==='toss'){if(inp.clickp)swingServe(p,inp.nx||0);}
    return;
  }
}
function swingServe(p,aimX){
  const s=M.serve;if(s.phase!=='toss')return;s.phase='swing';
  const Tsw=.2,tc=simT+Tsw;
  const ideal=serveIdealT(),tt=s.tossT+Tsw,q=clamp(1-Math.abs(tt-ideal)/(ideal*.5),0,1);
  s.q=q;s.aimRaw=p.human&&!autoplay?aimX:rand(-1,1);s.hitAt=tc;meterShow(false);
}
function serveUpdate(dt){
  const s=M.serve,p=s.server;
  if(s.phase==='ready'){
    if(!p.human||autoplay){s.wait-=dt;if(s.wait<=0)startToss();}
    else meterShow(false);
    return;}
  if(s.phase==='toss'||s.phase==='swing'){
    s.tossT+=dt;
    const ideal=serveIdealT();
    if(s.phase==='toss'){
      if(p.human&&!autoplay)meterSet(s.tossT/ideal*.885);
      if(!p.human||autoplay){const want=ideal-.2+gauss()*(.22-diff.pow*.17);if(s.tossT>=want)swingServe(p,0);}
      if(M.cfg.sport==='padel'?s.tossT>1.5:ball.pos.y<.5){
        s.phase='ready';ball.live=false;ball.held=p;placeBallInHand(p);meterShow(false);showSub('Lanzá de nuevo');s.wait=.8;NET.send('retoss',{});}
    }
    if(s.phase==='swing'&&simT>=s.hitAt-1e-6){
      const fc=p.baseFacing,Rx=-Math.cos(fc),bx=Math.sign(s.box.x0+s.box.x1);
      const wide=clamp(s.aimRaw*Rx*bx,-1,1);
      p.swingFx={t:0,dur:.38,dir:1,type:M.cfg.sport==='padel'?'slice':'smash'};
      hitServe(s.q,wide);
    }
  }
}

/* ---------- movimiento de las raquetas ---------- */
// altura a la que va a pasar la pelota cerca de la raqueta
function ballHeightNear(p){
  const path=M.path,R=M.R;if(!path||!R||R.hitTeam===p.team)return null;
  const side=teamSide(p.team),i0=Math.max(0,Math.round((simT-path.t0)/BDT));let best=null,bd=1e9;
  for(let i=i0;i<Math.min(path.n,i0+240);i+=2){const x=path.P[i*3],y=path.P[i*3+1],z=path.P[i*3+2];if(z*side<.3)continue;
    const d=hyp(x-p.pos.x,z-p.pos.z);if(d<bd){bd=d;best=y;}}
  return bd<4?best:null;
}
function movePlayer(p,dt){
  const side=teamSide(p.team),padel=M.cfg.sport==='padel',human=p.human&&!autoplay;
  let tvx,tvz,hT=1.0;
  if(human){
    // sin demora: la raqueta va exactamente al mouse; la velocidad se mide para el golpe
    const serving=M.state==='serve'&&M.serve&&M.serve.server===p,t=(!serving&&p.target)||p.pos,ivx=(t.x-p.pos.x)/dt,ivz=(t.z-p.pos.z)/dt;
    p.vel.x+=(ivx-p.vel.x)*.5;p.vel.z+=(ivz-p.vel.z)*.5;p.pos.x=t.x;p.pos.z=t.z;tvx=p.vel.x;tvz=p.vel.z;
    const bh=ballHeightNear(p);if(bh!=null)hT=clamp(bh,.3,2.7);
    if(M.state==='serve'&&M.serve.server===p&&M.serve.phase!=='ready')hT=clamp(ball.pos.y,.5,2.9);
  }else if(p.auto&&p.commit){
    const c=p.commit,T=c.t-simT,dx=c.stance.x-p.pos.x,dz=c.stance.z-p.pos.z,d=hyp(dx,dz);
    const vmax=SP.run*diff.speed*1.2;
    const v=d<.03?0:Math.min(vmax,d/Math.max(.05,T-.03));
    tvx=d>1e-3?dx/d*v:0;tvz=d>1e-3?dz/d*v:0;
    hT=lerp(1,c.ball.y,sstep(1.1,.15,T));
  }else{const vmax=SP.run*diff.speed;tvx=p.want.x*vmax;tvz=p.want.z*vmax;
    if(M.state==='serve'&&M.serve.server===p&&M.serve.phase!=='ready')hT=clamp(ball.pos.y,.5,2.9);}
  if(!human){const acc=SP.acc*(p.auto?1.8:1.2)*dt,ddx=tvx-p.vel.x,ddz=tvz-p.vel.z,dl=hyp(ddx,ddz);
    if(dl>acc){p.vel.x+=ddx/dl*acc;p.vel.z+=ddz/dl*acc;}else{p.vel.x=tvx;p.vel.z=tvz;}
    p.pos.x+=p.vel.x*dt;p.pos.z+=p.vel.z*dt;}
  const xl=padel?C.HWd-.3:C.HWd+4,zl=padel?C.HL-.3:C.HL+5.5;
  p.pos.x=clamp(p.pos.x,-xl,xl);const zz=clamp(p.pos.z*side,.45,zl);p.pos.z=zz*side;
  for(const q of M.teams[p.team].players)if(q!==p){const dx=p.pos.x-q.pos.x,dz=p.pos.z-q.pos.z,d=hyp(dx,dz);if(d<.7&&d>1e-3&&!(q.human&&!autoplay)){p.pos.x+=dx/d*(.7-d)*.5;p.pos.z+=dz/d*(.7-d)*.5;}}
  p.rh+=(hT-p.rh)*Math.min(1,dt*(human?22:9));
  p.baseFacing=p.facing=faceOf(side);
  if(p.celebT>0)p.celebT-=dt;if(p.sadT>0)p.sadT-=dt;if(p.hitCD>0)p.hitCD-=dt;
}
// distancia de un punto a un segmento (para que la pelota rápida no atraviese la raqueta)
function segDist(a,b,p){const abx=b.x-a.x,aby=b.y-a.y,abz=b.z-a.z,L=abx*abx+aby*aby+abz*abz||1e-9;
  const t=clamp(((p.x-a.x)*abx+(p.y-a.y)*aby+(p.z-a.z)*abz)/L,0,1);return hyp(a.x+abx*t-p.x,a.y+aby*t-p.y,a.z+abz*t-p.z);}
const _bp=new V3(),_rk=new V3();
function canHit(p){const R=M.R;return R&&R.hitTeam!==p.team&&!(R.serve&&R.bounces===0)&&Math.sign(ball.pos.z)===teamSide(p.team)&&p.hitCD<=0&&ball.pos.y<3.2;}

/* ---------- paso de simulación ---------- */
function stepSim(dt,inp){
  simT+=dt;
  if(M.state==='menu'||M.state==='paused')return;
  if(M.state==='point'||M.state==='between'||M.state==='ends'||M.state==='over'){
    M.timer-=dt;
    if(ball.live)for(let k=0;k<2;k++)ballStep(ball,BDT,null);
    for(const p of M.players){if(p.remote)continue;p.want.set(0,0,0);p.auto=false;p.commit=null;if(p.human&&!autoplay)humanControl(p,inp,dt);movePlayer(p,dt);}
    if(M.timer<=0){if(M.state==='over'){endScreen();M.state='done';return;}const f=M.after;M.after=null;f&&f();}
    return;}
  for(const p of M.players){if(p.remote)continue;if(p.human&&!autoplay)humanControl(p,inp,dt);else aiThink(p,dt);}
  if(M.state==='serve'&&!M.serve.server.remote)serveUpdate(dt);
  // IA: golpe en el instante planificado
  for(const p of M.players){const sw=p.swing;if(!sw||sw.done||p.remote)continue;
    if(simT>=sw.tc-BDT*.5){
      _rk.set(p.pos.x,p.rh,p.pos.z);const miss=_rk.distanceTo(ball.pos);
      if(canHit(p)&&miss<=.55+(sw.kind==='smash'?.2:0))executeHit(p);else{sw.done=true;p.commit=null;p.auto=false;}
    }}
  for(const p of M.players)if(!p.remote)movePlayer(p,dt);
  // pelota, y tu raqueta le pega cuando la toca
  if(ball.live){
    const me=M.players.filter(p=>p.human&&!autoplay);
    for(let k=0;k<2;k++){_bp.copy(ball.pos);ballStep(ball,BDT,onBallEvent);if(M.state!=='rally'&&M.state!=='serve')break;
      for(const p of me){if(!canHit(p))continue;const u=(k+1)/2;
        // la raqueta también se mueve dentro del paso: se prueba su recorrido
        let hit=false;for(const w of [u-.5,u]){_rk.set(lerp(p.prevPos.x,p.pos.x,w),p.rh,lerp(p.prevPos.z,p.pos.z,w));if(segDist(_bp,ball.pos,_rk)<.36+diff.assist*.5)hit=true;}
        if(hit){executeHitMouse(p,inp);break;}}}}
  else if(ball.held)placeBallInHand(ball.held);
  if(M.state==='rally'&&ball.pos.y<=BR+1e-3&&ball.vel.lengthSq()<.05&&judgeHere(Math.sign(ball.pos.z)||1)){const R=M.R;endPoint(R.bounces>=1?R.hitTeam:1-R.hitTeam,R.bounces>=1?'PUNTO':'RED');}
  if(M.state==='serve'&&M.serve.phase==='flight'&&M.R){M.state='rally';}
}
