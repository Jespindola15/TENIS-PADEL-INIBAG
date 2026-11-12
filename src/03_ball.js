/* ================= Pelota: gravedad, aire, efecto (Magnus), piques con fricción y paredes ================= */
const KD=.0195,KM=1.55e-3,BDT=1/120;
const MU={hard:.55,clay:.78,grass:.38,padel:.6};
let surfKey='hard';
const ball={pos:new V3(0,1,0),vel:new V3(),w:new V3(),live:false,prev:new V3(),rpos:new V3()};

// un paso de física; ev(tipo,datos) recibe los eventos (pique, red, pared, sale)
const _t=new V3();
function ballStep(b,dt,ev){
  const p=b.pos,v=b.vel,w=b.w,sp=v.length();
  // aceleraciones
  const ax=-KD*sp*v.x+KM*(w.y*v.z-w.z*v.y),ay=-G-KD*sp*v.y+KM*(w.z*v.x-w.x*v.z),az=-KD*sp*v.z+KM*(w.x*v.y-w.y*v.x);
  v.x+=ax*dt;v.y+=ay*dt;v.z+=az*dt;w.multiplyScalar(1-.12*dt);
  const ox=p.x,oy=p.y,oz=p.z;p.x+=v.x*dt;p.y+=v.y*dt;p.z+=v.z*dt;
  // red
  if((oz<0)!==(p.z<0)&&oz!==0){const u=oz/(oz-p.z),x=ox+(p.x-ox)*u,y=oy+(p.y-oy)*u,h=netH(x);
    if(Math.abs(x)<C.postX+(C.walls?.1:0)&&y-BR<h){
      if(y>h-.02&&Math.abs(v.z)>4){// roce en la faja: pasa frenada
        v.multiplyScalar(.5);v.y=Math.abs(v.y)*.4+1.2+(Math.abs(Math.sin(x*37))*.8);ev&&ev('cord',{x});}
      else{const s=Math.sign(oz)||1;p.z=s*(BR+.005);v.z=-v.z*.1;v.x*=.35;v.y=Math.min(v.y,0)*.3;w.multiplyScalar(.2);ev&&ev('net',{x,y});}}}
  // piso
  if(p.y<BR&&v.y<0){
    const e=(SP.cor[surfKey]||.75)*(Math.abs(v.y)>12?.94:1),mu=MU[surfKey]||.55;
    const vyIn=-v.y;p.y=BR;v.y=vyIn*e;
    const sx=v.x+BR*w.z,sz=v.z-BR*w.x,sl=hyp(sx,sz);
    if(sl>1e-4){const J=Math.min(mu*(1+e)*vyIn,.4*sl),dvx=-J*sx/sl,dvz=-J*sz/sl;v.x+=dvx;v.z+=dvz;
      w.x+=1.5/BR*(-dvz)*.6;w.z+=1.5/BR*(dvx)*.6;}
    w.multiplyScalar(.7);
    if(v.y<.35)v.y=0;
    ev&&ev('bounce',{x:p.x,z:p.z,v:vyIn});
  }
  if(p.y<=BR&&v.y===0){const h=hyp(v.x,v.z);if(h>0){const k=Math.max(0,h-3.2*dt)/h;v.x*=k;v.z*=k;}}
  // paredes de pádel
  if(C.walls){
    if(Math.abs(p.z)>C.HL-BR&&p.z*v.z>0){const top=4;
      if(p.y<top){const glassH=3,glass=p.y<glassH;p.z=Math.sign(p.z)*(C.HL-BR);const e=glass?.74:.32;v.z=-v.z*e;v.x*=glass?.92:.6;v.y*=glass?.92:.6;w.multiplyScalar(.5);
        if(!glass){v.x+=Math.sin(p.x*13+p.y*7)*1.2;}ev&&ev('wall',{glass,side:Math.sign(p.z),back:true,x:p.x,y:p.y,z:p.z});}
      else ev&&ev('gone',{});}
    if(Math.abs(p.x)>C.HWd-BR&&p.x*v.x>0){const az=Math.abs(p.z),top=az>C.HL-4?(az>C.HL-2?4:3):3,glassH=az>C.HL-2?3:az>C.HL-4?2:0;
      if(p.y<top){const glass=p.y<glassH;p.x=Math.sign(p.x)*(C.HWd-BR);const e=glass?.74:.3;v.x=-v.x*e;v.z*=glass?.92:.6;v.y*=glass?.92:.6;w.multiplyScalar(.5);
        if(!glass)v.z+=Math.sin(p.z*11+p.y*5)*1.2;ev&&ev('wall',{glass,side:Math.sign(p.z),back:false,x:p.x,y:p.y,z:p.z});}
      else ev&&ev('gone',{});}
  }
}

/* predicción: recorre la trayectoria desde el estado actual y guarda posiciones y eventos */
function predictPath(T){
  const b={pos:ball.pos.clone(),vel:ball.vel.clone(),w:ball.w.clone()},N=Math.ceil(T/BDT),P=new Float32Array(N*3),evs=[];let i=0,stop=N;
  const ev=(type,d)=>{evs.push(Object.assign({type,i},d));if(type==='gone')stop=i;};
  for(i=0;i<N;i++){ballStep(b,BDT,ev);P[i*3]=b.pos.x;P[i*3+1]=b.pos.y;P[i*3+2]=b.pos.z;if(i>=stop)break;
    if(b.pos.y<=BR+1e-4&&b.vel.lengthSq()<.04){stop=i;break;}}
  return {P,evs,n:Math.min(N,stop+1),t0:simT};
}
function pathAt(path,i,out){i=clamp(i,0,path.n-1);return out.set(path.P[i*3],path.P[i*3+1],path.P[i*3+2]);}

/* resolver un golpe: velocidad para que la pelota pique en (tx,tz) con rapidez horizontal vh y efecto s */
function flight2D(x0,y0,vs,vy,s,D,netS){
  // integra en el plano vertical que contiene la dirección del golpe; devuelve distancia del primer pique y altura sobre la red
  let x=0,y=y0,ws=s,clear=99,prevx=0,prevy=y;
  for(let k=0;k<1200;k++){const v=hyp(vs,vy);
    const as=-KD*v*vs+KM*ws*vy,ay=-G-KD*v*vy-KM*ws*vs;vs+=as*BDT;vy+=ay*BDT;ws*=1-.12*BDT;prevx=x;prevy=y;x+=vs*BDT;y+=vy*BDT;
    if(netS!=null&&prevx<netS&&x>=netS){const u=(netS-prevx)/(x-prevx);clear=prevy+(y-prevy)*u;}
    if(y<BR&&vy<0){const u=(prevy-BR)/(prevy-y);return {d:prevx+(x-prevx)*u,clear,t:(k+u)*BDT};}
    if(vs<.2)return {d:x,clear,t:k*BDT};}
  return {d:x,clear,t:10};
}
function solveShot(from,tx,tz,vh,spin,minClear,crossNet=true){
  const dx=tx-from.x,dz=tz-from.z,D=hyp(dx,dz)||.01,dirx=dx/D,dirz=dz/D;
  // distancia hasta la red sobre la línea del golpe
  let netS=null,netX=0;if(crossNet&&Math.abs(dirz)>.05&&from.z*dirz<0){netS=-from.z/dirz;netX=from.x+dirx*netS;}
  const needH=netS!=null?netH(netX)+BR+minClear:-99;
  let best=null;
  for(let it=0;it<14;it++){
    let lo=-25,hi=26,f=null,vy=0;
    for(let k=0;k<26;k++){vy=(lo+hi)/2;f=flight2D(0,from.y,vh,vy,spin,D,netS);if(f.d<D)lo=vy;else hi=vy;}
    best={vy,vh,f};
    if(Math.abs(f.d-D)>.25)vh*=1.12;           // no llega: más fuerte
    else if(f.clear<needH)vh*=.9;             // pega en la red: más arco
    else break;
  }
  // eje del efecto: arriba × dirección (positivo = liftado)
  return {vel:new V3(dirx*best.vh,best.vy,dirz*best.vh),w:new V3(dirz*spin,0,-dirx*spin),t:best.f.t,clear:best.f.clear};
}
