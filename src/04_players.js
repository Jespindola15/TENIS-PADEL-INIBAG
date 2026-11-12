/* ================= Raquetas: cada jugador es solo su raqueta flotando ================= */
const RSCALE=2.1;// raquetas agrandadas para que se lean desde la cámara de transmisión
const stringTex=canvasTex(64,64,(g,W,H)=>{g.clearRect(0,0,W,H);g.strokeStyle='rgba(245,245,236,.95)';g.lineWidth=1.6;
  for(let i=4;i<W;i+=7){g.beginPath();g.moveTo(i,0);g.lineTo(i,H);g.stroke();g.beginPath();g.moveTo(0,i);g.lineTo(W,i);g.stroke();}});
function stringsTex(accent){const c=new THREE.Color(accent),col=`rgb(${c.r*255|0},${c.g*255|0},${c.b*255|0})`;
  return canvasTex(128,128,(g,W,H)=>{g.clearRect(0,0,W,H);g.strokeStyle='rgba(246,246,236,.95)';g.lineWidth=1.8;
    for(let i=6;i<W;i+=9){g.beginPath();g.moveTo(i,0);g.lineTo(i,H);g.stroke();g.beginPath();g.moveTo(0,i);g.lineTo(W,i);g.stroke();}
    g.fillStyle=col;g.globalAlpha=.85;g.font='900 70px "Saira Condensed",Impact,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('P',W/2,H/2+4);});}
const gripTex=canvasTex(32,128,(g,W,H)=>{g.fillStyle='#1b1c1f';g.fillRect(0,0,W,H);g.strokeStyle='#33353a';g.lineWidth=3;for(let y=-W;y<H+W;y+=10){g.beginPath();g.moveTo(0,y);g.lineTo(W,y+W*.6);g.stroke();}});
const carbonTex=canvasTex(64,64,(g,W,H)=>{g.fillStyle='#16181c';g.fillRect(0,0,W,H);for(let y=0;y<H;y+=8)for(let x=0;x<W;x+=8){g.fillStyle=((x+y)/8)%2?'#23262c':'#1a1c21';g.fillRect(x,y,8,4);g.fillStyle=((x+y)/8)%2?'#1a1c21':'#23262c';g.fillRect(x,y+4,8,4);}},[3,3]);
function makeRacket(color,accent,padel){
  const R=new THREE.Group(),inner=new THREE.Group();R.add(inner);
  const fm=mat(color,{roughness:.32,metalness:.25}),am=mat(accent,{roughness:.4,emissive:accent,emissiveIntensity:.18});
  let head;
  if(!padel){
    const grip=new THREE.Mesh(new THREE.CylinderGeometry(.017,.015,.2,10),new THREE.MeshStandardMaterial({map:gripTex,roughness:.9}));grip.position.y=.1;inner.add(grip);
    const damp=new THREE.Mesh(new THREE.BoxGeometry(.03,.02,.012),am);damp.position.set(0,.385,0);inner.add(damp);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(.019,.019,.015,10),am);cap.position.y=.005;inner.add(cap);
    for(const s of [-1,1]){const th=new THREE.Mesh(new THREE.CylinderGeometry(.008,.009,.15,6),fm);th.position.set(s*.03,.27,0);th.rotation.z=-s*.28;inner.add(th);}
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.125,.01,8,40),fm);ring.scale.set(1,1.3,1);ring.position.y=.5;inner.add(ring);
    const acc=new THREE.Mesh(new THREE.TorusGeometry(.127,.005,4,40,Math.PI*.6),am);acc.scale.set(1,1.3,1);acc.position.y=.5;acc.rotation.z=Math.PI*.2;inner.add(acc);
    const st=new THREE.Mesh(new THREE.CircleGeometry(.122,30),new THREE.MeshStandardMaterial({map:stringsTex(accent),transparent:true,alphaTest:.3,side:THREE.DoubleSide,roughness:.8}));
    st.scale.set(1,1.3,1);st.position.y=.5;inner.add(st);head=.5;
  }else{
    const grip=new THREE.Mesh(new THREE.CylinderGeometry(.018,.017,.16,10),new THREE.MeshStandardMaterial({map:gripTex,roughness:.9}));grip.position.y=.08;inner.add(grip);
    const sh=new THREE.Shape();sh.absellipse(0,0,.13,.15,0,Math.PI*2);
    for(let i=0;i<22;i++){const a=i*2.4,r=.02+.09*Math.sqrt(i/22),h=new THREE.Path();h.absarc(Math.cos(a)*r,Math.sin(a)*r*1.1,.0065,0,Math.PI*2,true);sh.holes.push(h);}
    const hd=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.036,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:2,curveSegments:16}),[new THREE.MeshStandardMaterial({map:carbonTex,roughness:.35,metalness:.3}),fm]);
    {const uv=hd.geometry.attributes.uv,p=hd.geometry.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,p.getX(i)*4+.5,p.getY(i)*4+.5);}
    const logo=new THREE.Mesh(new THREE.CircleGeometry(.035,20),am);for(const zz of [.025,-.025]){const l=logo.clone();l.position.set(0,.36,zz);if(zz<0)l.rotation.y=Math.PI;inner.add(l);}
    hd.geometry.translate(0,0,-.018);hd.position.y=.33;inner.add(hd);
    const neck=new THREE.Mesh(new THREE.BoxGeometry(.05,.1,.03),fm);neck.position.y=.19;inner.add(neck);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.14,.007,4,40),am);rim.scale.set(.93,1.07,1);rim.position.y=.33;inner.add(rim);head=.33;
  }
  // el origen del grupo queda en el centro de la cabeza
  inner.position.y=-head;inner.scale.setScalar(1);R.scale.setScalar(RSCALE);
  R.traverse(n=>{if(n.isMesh)n.castShadow=true;});scene.add(R);
  // sombra propia y aro de posición en el piso
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,opacity:.55}));sh.rotation.x=-Math.PI/2;sh.renderOrder=2;scene.add(sh);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.3,.36,32),new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.0,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.renderOrder=2;scene.add(ring);
  const ghosts=[];for(let i=0;i<5;i++){const g=new THREE.Mesh(new THREE.RingGeometry(.1,.135,28),new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
    g.scale.set(RSCALE,RSCALE*(padel?1.1:1.3),1);g.renderOrder=3;scene.add(g);ghosts.push(g);}
  R.traverse(n=>{if(n.isMesh&&n.material&&n.material.isMeshStandardMaterial&&window.ENV_TEX){n.material.envMap=ENV_TEX;n.material.envMapIntensity=.9;}});
  return {R,inner,sh,ring,headLen:head,ghosts,hist:[]};
}
function removeRacket(k){if(!k)return;scene.remove(k.R);scene.remove(k.sh);scene.remove(k.ring);for(const g of k.ghosts)scene.remove(g);}

/* ---------- animación: la raqueta mira a la red, se inclina con el movimiento y hace el swing ---------- */
const _q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_e=new THREE.Euler(),UPV=new V3(0,1,0);
function animateRacket(p,dt){
  const k=p.rk;if(!k)return;
  const pos=p.rpos||p.pos,h=p.rhR??p.rh??1;
  k.R.position.set(pos.x,h,pos.z);
  // velocidad suavizada para inclinarla
  const side=teamSide(p.team),fc=faceOf(side);
  const vl=(p.vel.x*-Math.cos(fc)+p.vel.z*Math.sin(fc)),vf=(p.vel.x*Math.sin(fc)+p.vel.z*Math.cos(fc));
  p.tiltL=(p.tiltL||0)+(clamp(vl*.07,-.5,.5)-(p.tiltL||0))*Math.min(1,dt*10);
  p.tiltF=(p.tiltF||0)+(clamp(vf*.05,-.35,.35)-(p.tiltF||0))*Math.min(1,dt*10);
  // swing: giro rápido alrededor del eje vertical + barrido
  let yaw=0,roll=0,pitch=0;const s=p.swingFx;
  if(s){s.t+=dt;const u=s.t/s.dur;
    if(u>=1)p.swingFx=null;
    else{const e=u<.35?-Math.sin(u/.35*Math.PI/2)*.9:Math.sin((u-.35)/.65*Math.PI/2)*1.3-.9*(1-(u-.35)/.65);
      yaw=e*s.dir*1.0;pitch=s.type==='slice'||s.type==='drop'?-e*.5:s.type==='lob'?e*.5:s.type==='smash'?-e*1.1:e*.25;roll=e*s.dir*.4;}}
  if(p.celebT>0){yaw+=Math.min(1,p.celebT)*perfT*14%(Math.PI*2);}
  // orientación base: cara hacia la red, mango hacia abajo-atrás del lado del jugador
  _e.set(-.25+p.tiltF+pitch,fc+yaw,-.35*p.hand+p.tiltL+roll,'YXZ');k.R.quaternion.setFromEuler(_e);
  // estela: las últimas posiciones del aro mientras barre
  k.hist.unshift({p:k.R.position.clone(),q:k.R.quaternion.clone()});if(k.hist.length>10)k.hist.pop();
  const spd=hyp(p.vel.x,p.vel.z),ga=clamp(s?1-s.t/s.dur:0,0,1)*.4+clamp((spd-7)/14,0,.15);
  for(let i=0;i<k.ghosts.length;i++){const g=k.ghosts[i],hh=k.hist[i*2+1];if(!hh||ga<=.02){g.visible=false;continue;}g.visible=true;
    g.position.copy(hh.p);g.quaternion.copy(hh.q);g.material.opacity=ga*(1-i/k.ghosts.length)*.5;}
  // sombra y aro
  k.sh.position.set(pos.x,.013,pos.z);const sc=.55+h*.12;k.sh.scale.set(sc,sc*.8,1);k.sh.material.opacity=clamp(.62-h*.12,.18,.6);
  k.ring.position.set(pos.x,.016,pos.z);k.ring.material.opacity=p.human&&!autoplay?.85:0;
}
