/* ================= Pulido visual: luz, reflejos, efectos y cámara ================= */
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
hemi.intensity=.85;sun.intensity=1.35;
// reflejos para las raquetas (ambiente de estudio)
window.ENV_TEX=null;
try{if(THREE.RoomEnvironment){const pm=new THREE.PMREMGenerator(renderer);window.ENV_TEX=pm.fromScene(new THREE.RoomEnvironment(),.04).texture;}}catch(e){}

/* ---------- torres de luz y detalles del estadio ---------- */
function venueExtras(){
  if(!venue)return;const padel=M.cfg?M.cfg.sport==='padel':CFG.sport==='padel';
  const g=new THREE.Group();venue.add(g);
  const pole=mat(0xc9d1da,{metalness:.5,roughness:.4}),lamp=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xfff6dd,emissiveIntensity:1.2});
  if(!padel){const X=C.HWd+19,Z=C.HL+20;
    for(const sx of [-1,1])for(const sz of [-1,1]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.35,.55,30,10),pole);p.position.set(sx*X,15,sz*Z);g.add(p);
      const head=new THREE.Group();for(let r=0;r<3;r++)for(let c=0;c<4;c++){const l=new THREE.Mesh(new THREE.BoxGeometry(.9,.7,.25),lamp);l.position.set((c-1.5)*1.05,r*.85,0);head.add(l);}
      const frame=new THREE.Mesh(new THREE.BoxGeometry(4.6,2.8,.2),mat(0x3a4552));frame.position.set(0,.85,-.2);head.add(frame);
      head.position.set(sx*X,30.5,sz*Z);head.lookAt(0,0,0);g.add(head);}
  }else{
    for(const sx of [-1,1])for(const sz of [-1,1]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,7,8),pole);p.position.set(sx*(C.HWd+.4),3.5,sz*(C.HL+.4));g.add(p);
      const l=new THREE.Mesh(new THREE.BoxGeometry(.9,.12,.5),lamp);l.position.set(sx*(C.HWd+.1),7,sz*(C.HL+.1));l.lookAt(0,0,0);g.add(l);}
    // pared del club con ladrillo y cartel
    const brick=canvasTex(256,128,(c,W,H)=>{c.fillStyle='#b5654a';c.fillRect(0,0,W,H);c.fillStyle='#d9cbb8';for(let y=0;y<H;y+=16){c.fillRect(0,y,W,2);for(let x=(y/16)%2?0:16;x<W;x+=32)c.fillRect(x,y,2,16);}
      for(let i=0;i<500;i++){c.fillStyle=`rgba(0,0,0,${Math.random()*.08})`;c.fillRect(Math.random()*W,Math.random()*H,6,4);}},[6,2]);
    for(const s of [-1,1]){const w=new THREE.Mesh(new THREE.PlaneGeometry(C.HWd*2+14,7),new THREE.MeshStandardMaterial({map:brick,roughness:.95}));w.position.set(0,3.5,s*(C.HL+13.6));if(s<0)w.rotation.y=0;else w.rotation.y=Math.PI;
      w.position.z=s*(C.HL+13.75);g.add(w);
      const tree=(x,z)=>{const t=new THREE.Mesh(new THREE.CylinderGeometry(.15,.2,2.4,6),mat(0x6b4a2f));t.position.set(x,1.2,z);g.add(t);
        const c=new THREE.Mesh(new THREE.IcosahedronGeometry(1.5,0),mat(0x3f8a3d,{flatShading:true}));c.position.set(x,3.2,z);c.castShadow=true;g.add(c);};
      for(const tx of [-11,-8,8,11])tree(tx,s*(C.HL+11));}
  }
}
const _bv=buildVenue;buildVenue=function(a,b){_bv(a,b);venueExtras();};

/* ---------- partículas: impacto, polvo del pique y red ---------- */
const FX=[];
const sparkTex=canvasTex(64,64,(g,W,H)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,240,1)');gr.addColorStop(.35,'rgba(240,255,120,.8)');gr.addColorStop(1,'rgba(240,255,120,0)');g.fillStyle=gr;g.fillRect(0,0,W,H);});
const dustTex=canvasTex(64,64,(g,W,H)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,.9)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,W,H);});
function spawnSprite(tex,pos,color,size,grow,life,add){
  const m=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending}));
  m.position.copy(pos);m.scale.setScalar(size);scene.add(m);FX.push({m,t:0,life,size,grow});
}
function fxHit(pos,speed){return;const k=clamp(speed/40,.3,1.2);
  spawnSprite(sparkTex,pos,0xffffff,.35*k,2.2,.16,true);
  const n=10,g=new THREE.BufferGeometry(),P=new Float32Array(n*3),V=[];for(let i=0;i<n;i++){P[i*3]=pos.x;P[i*3+1]=pos.y;P[i*3+2]=pos.z;V.push(new V3(rand(-1,1),rand(-.2,1),rand(-1,1)).normalize().multiplyScalar(rand(2,5)*k));}
  g.setAttribute('position',new THREE.BufferAttribute(P,3));
  const pts=new THREE.Points(g,new THREE.PointsMaterial({color:0xf4ffb0,size:.06,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(pts);FX.push({pts,V,t:0,life:.3});
}
function fxBounce(x,z,v){return;
  spawnSprite(dustTex,new V3(x,.08,z),clay?0xc8724a:0xffffff,clay?.5:.25,clay?2.6:1.6,clay?.7:.25,false);}
let netShake=0;
function updateFx(dt){
  for(let i=FX.length-1;i>=0;i--){const f=FX[i];f.t+=dt;const u=f.t/f.life;
    if(u>=1){scene.remove(f.m||f.pts);(f.m||f.pts).material.dispose();if(f.pts)f.pts.geometry.dispose();FX.splice(i,1);continue;}
    if(f.m){f.m.scale.setScalar(f.size*(1+f.grow*u));f.m.material.opacity=(1-u)*(f.m.material.blending===THREE.AdditiveBlending?1:.55);f.m.position.y+=dt*.15;}
    else{const P=f.pts.geometry.attributes.position;for(let k=0;k<f.V.length;k++){f.V[k].y-=9*dt;P.setXYZ(k,P.getX(k)+f.V[k].x*dt,P.getY(k)+f.V[k].y*dt,P.getZ(k)+f.V[k].z*dt);}P.needsUpdate=true;f.pts.material.opacity=1-u;}}
  if(netMesh){netShake=Math.max(0,netShake-dt*2.5);netMesh.position.z=Math.sin(perfT*45)*.035*netShake;}
}
// enganchar efectos a los eventos del juego
const _obe=onBallEvent;onBallEvent=function(type,d){
  if(type==='bounce')fxBounce(d.x,d.z,d.v);if(type==='net')netShake=1;if(type==='cord')netShake=.5;
  return _obe(type,d);};
const _ds=doShot;doShot=function(p,...a){const pos=ball.pos.clone();const r=_ds(p,...a);fxHit(pos,ball.vel.length());if(a[0]==='smash')cam.shake=.35;return r;};
const _hs=hitServe;hitServe=function(...a){const pos=ball.pos.clone();const r=_hs(...a);fxHit(pos,ball.vel.length());return r;};

/* ---------- cámara: entrada al partido y temblor en los remates ---------- */
cam.introT=0;cam.shake=0;
const _uc=updateCamera;updateCamera=function(dt){
  _uc(dt);
  if(cam.introT>0){cam.introT=Math.max(0,cam.introT-dt);const u=1-cam.introT/2.6,e=u*u*(3-2*u),side=M.human?teamSide(M.human.team):-1;
    const a=(1-e)*.6;const ip=new V3(Math.sin(a)*14,24,side*(C.HL+30));
    camera.position.lerpVectors(ip,cam.pos,e);const lk=new V3().lerpVectors(new V3(0,0,0),cam.look,e);camera.lookAt(lk);}
  if(cam.shake>0){cam.shake=Math.max(0,cam.shake-dt);const s=cam.shake*.12;camera.position.x+=rand(-s,s);camera.position.y+=rand(-s,s);}
};
const _sm=setupMatch;setupMatch=function(c){_sm(c);cam.introT=2.6;if(M.serve)M.serve.wait+=2.2;};
