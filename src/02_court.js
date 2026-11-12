/* ================= Canchas: tenis (3 superficies) y pádel con paredes de vidrio ================= */
let venue=null,crowd=null,netMesh=null;
const SURF={
  hard:{inner:0x1f55a6,outer:0x2f6e4a,line:0xffffff,name:'Cemento'},
  clay:{inner:0xc2552c,outer:0xb44f29,line:0xf4efe6,name:'Polvo de ladrillo'},
  grass:{inner:0x43902f,outer:0x3c852a,line:0xffffff,name:'Césped'},
  padel:{inner:0x1f58b0,outer:0x36507a,line:0xffffff,name:'Pádel'}
};
function disposeVenue(){if(!venue)return;scene.remove(venue);venue.traverse(n=>{if(n.geometry)n.geometry.dispose();});venue=null;crowd=null;}

function surfaceTex(kind,color,w,h,rep){
  const c=new THREE.Color(color);const base=`rgb(${c.r*255|0},${c.g*255|0},${c.b*255|0})`;
  return canvasTex(256,256,(g,W,H)=>{g.fillStyle=base;g.fillRect(0,0,W,H);
    const n=kind==='clay'?5200:kind==='grass'?2600:kind==='padel'?6000:3800;
    for(let i=0;i<n;i++){const v=Math.random();g.fillStyle=v<.5?`rgba(0,0,0,${kind==='clay'?.07:.05})`:`rgba(255,255,255,${kind==='padel'?.08:.045})`;
      const s=kind==='grass'?1+Math.random()*2:1;g.fillRect(Math.random()*W,Math.random()*H,s,kind==='grass'?s*3:s);}
    if(kind==='clay'){g.strokeStyle='rgba(120,40,15,.08)';g.lineWidth=2;for(let i=0;i<26;i++){g.beginPath();const y=Math.random()*H;g.moveTo(0,y);g.bezierCurveTo(W*.3,y+rand(-12,12),W*.7,y+rand(-12,12),W,y+rand(-6,6));g.stroke();}}
  },rep||[w/4,h/4]);
}
function addLine(grp,x0,z0,x1,z1,wid,color){
  const L=hyp(x1-x0,z1-z0),m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({color,roughness:.7,polygonOffset:true,polygonOffsetFactor:-2}));
  m.rotation.x=-Math.PI/2;m.position.set((x0+x1)/2,.004,(z0+z1)/2);
  if(Math.abs(x1-x0)>Math.abs(z1-z0))m.scale.set(L+wid,wid,1);else m.scale.set(wid,L+wid,1);
  m.receiveShadow=true;grp.add(m);
}
function buildNet(grp){
  const half=C.postX,N=40,geo=new THREE.BufferGeometry(),pos=[],uv=[],idx=[];
  for(let i=0;i<=N;i++){const x=-half+2*half*i/N,h=netH(x);pos.push(x,h,0, x,.02,0);uv.push(i/N*half*2/.04,h/.04, i/N*half*2/.04,0);}
  for(let i=0;i<N;i++){const a=i*2;idx.push(a,a+1,a+2, a+1,a+3,a+2);}
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  const tex=canvasTex(32,32,(g,W,H)=>{g.clearRect(0,0,W,H);g.strokeStyle='rgba(20,22,26,.95)';g.lineWidth=3;g.strokeRect(0,0,W,H);});
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(1/32*1.1,1/32*1.1);
  const net=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:tex,transparent:true,alphaTest:.25,side:THREE.DoubleSide,roughness:1}));
  // la textura repite por unidad de uv; uv ya está en celdas de 4 cm
  tex.repeat.set(1,1);net.castShadow=true;grp.add(net);netMesh=net;
  // faja blanca superior
  const tp=[],ti=[];for(let i=0;i<=N;i++){const x=-half+2*half*i/N,h=netH(x);tp.push(x,h+.03,.006, x,h-.035,.006, x,h+.03,-.006, x,h-.035,-.006);}
  for(let i=0;i<N;i++){const a=i*4;ti.push(a,a+1,a+4,a+1,a+5,a+4, a+2,a+6,a+3,a+3,a+6,a+7, a,a+4,a+2,a+2,a+4,a+6);}
  const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.Float32BufferAttribute(tp,3));tg.setIndex(ti);tg.computeVertexNormals();
  const tape=new THREE.Mesh(tg,new THREE.MeshStandardMaterial({color:0xf6f6f2,roughness:.6,side:THREE.DoubleSide}));tape.castShadow=true;grp.add(tape);
  const strap=new THREE.Mesh(new THREE.BoxGeometry(.05,C.netC,.012),mat(0xf6f6f2));strap.position.set(0,C.netC/2,0);grp.add(strap);
  for(const s of [-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,C.netP+.07,12),mat(0x1b2a3a,{metalness:.4,roughness:.5}));post.position.set(s*half,(C.netP+.07)/2,0);post.castShadow=true;grp.add(post);}
}
/* público: personas dibujadas (8 variantes) sobre asientos de estadio */
const PEOPLE=(()=>{const shirts=['#e8ecf2','#2a78d6','#d8423a','#f2c230','#1d1f24','#3fae6a','#f08a3c','#7a56c8','#ffffff','#9fb3c8','#e05a8a','#28a6b8'];
  const skins=['#f1d3bf','#d8a47f','#a8714f','#6e4a33'],hairs=['#2a1d14','#5a3a22','#c9a24b','#111','#8b8b8b'];
  const out=[];
  for(let v=0;v<8;v++){out.push(canvasTex(128,128,(g,W,H)=>{g.clearRect(0,0,W,H);
    for(let k=0;k<4;k++){const ox=(k%2)*64,oy=(k>>1)*64,sh=pick(shirts),sk=pick(skins),hr=pick(hairs);
      g.fillStyle=sh;g.beginPath();g.moveTo(ox+14,oy+64);g.quadraticCurveTo(ox+14,oy+34,ox+32,oy+33);g.quadraticCurveTo(ox+50,oy+34,ox+50,oy+64);g.fill();
      if(Math.random()<.35){g.fillStyle=sk;g.fillRect(ox+(Math.random()<.5?8:50),oy+20,6,22);}// brazo levantado
      g.fillStyle=sk;g.beginPath();g.arc(ox+32,oy+24,9.5,0,Math.PI*2);g.fill();
      g.fillStyle=hr;g.beginPath();g.arc(ox+32,oy+21,9.8,Math.PI*1.05,Math.PI*1.95);g.fill();
      if(Math.random()<.25){g.fillStyle=pick(shirts);g.fillRect(ox+21,oy+12,22,6);g.fillRect(ox+30,oy+15,16,3);}// gorra
      if(Math.random()<.2){g.fillStyle='rgba(20,20,20,.85)';g.fillRect(ox+25,oy+22,6,3);g.fillRect(ox+33,oy+22,6,3);}// anteojos
    }}));}
  return out;})();
function buildCrowd(grp,stands,seatA,seatB){
  // stands: [{x,z,w,rows,rotY}]
  seatA=seatA||0x2c5f9e;seatB=seatB||0x234f86;
  let n=0;for(const s of stands)n+=Math.ceil(Math.floor(s.w/.56)*s.rows/2)+8;
  const geo=new THREE.PlaneGeometry(1.12,1.12);geo.translate(0,.5,0);
  const groups=PEOPLE.map(t=>{const m=new THREE.MeshLambertMaterial({map:t,transparent:true,alphaTest:.45,side:THREE.DoubleSide});
    const im=new THREE.InstancedMesh(geo,m,n);im.count=0;im.frustumCulled=false;grp.add(im);return {im,base:[]};});
  const Mx=new THREE.Matrix4(),q=new THREE.Quaternion();
  for(const s of stands){const cs=Math.cos(s.rotY),sn=Math.sin(s.rotY);
    for(let r=0;r<s.rows;r++){const hh=(r+1)*.45,lz=r*.85+.42;
      const st=new THREE.Mesh(new THREE.BoxGeometry(s.w+.4,hh,.85),mat(0x8d97a5,{roughness:.9}));st.position.set(s.x+sn*lz,hh/2,s.z+cs*lz);st.rotation.y=s.rotY;st.receiveShadow=true;grp.add(st);
      const seat=new THREE.Mesh(new THREE.BoxGeometry(s.w+.3,.16,.4),mat(r%2?seatA:seatB,{roughness:.6}));seat.position.set(s.x+sn*(lz+.12),hh+.08,s.z+cs*(lz+.12));seat.rotation.y=s.rotY;grp.add(seat);}
    const H=s.rows*.45+2.6,lzb=s.rows*.85+.2;
    const backW=new THREE.Mesh(new THREE.BoxGeometry(s.w+.6,H,.35),mat(0x26303e));backW.position.set(s.x+sn*lzb,H/2,s.z+cs*lzb);backW.rotation.y=s.rotY;grp.add(backW);
    // techo con columnas (solo en los laterales: los fondos tienen la cámara)
    if(s.roof){const roof=new THREE.Mesh(new THREE.BoxGeometry(s.w+1,.25,s.rows*.85*.75),mat(0xe9edf2,{roughness:.5}));const lzr=s.rows*.85*.62;
    roof.position.set(s.x+sn*lzr,H+.9,s.z+cs*lzr);roof.rotation.y=s.rotY;roof.rotation.x=0;roof.castShadow=true;grp.add(roof);
    for(let c=-1;c<=1;c+=2/Math.max(1,Math.round(s.w/14))){const cx=c*s.w/2,col=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,H+.9,8),mat(0xcfd6de));
      col.position.set(s.x+cs*cx+sn*(lzb-.3),(H+.9)/2,s.z-sn*cx+cs*(lzb-.3));grp.add(col);}}
    // gente: dos por sprite
    for(let r=0;r<s.rows;r++)for(let c=0;c<Math.floor(s.w/.56);c+=2){
      if(Math.random()<.08)continue;const lx=-s.w/2+(c+1)*.56+rand(-.05,.05),lz=r*.85+.46,y=(r+1)*.45+.05;
      const x=s.x+cs*lx+sn*lz,z=s.z-sn*lx+cs*lz;q.setFromAxisAngle(new V3(0,1,0),s.rotY+Math.PI);
      const G=groups[(Math.random()*groups.length)|0],sc=rand(.92,1.06);Mx.compose(new V3(x,y,z),q,new V3(sc,sc,1));G.im.setMatrixAt(G.im.count++,Mx);
      G.base.push({x,y,z,q:q.clone(),s:sc,ph:Math.random()*6});}}
  for(const G of groups)G.im.instanceMatrix.needsUpdate=true;
  return {groups,cheer:0};
}
function updateCrowd(dt){
  if(!crowd||crowd.cheer<=0&&!crowd.dirty)return;
  crowd.cheer=Math.max(0,crowd.cheer-dt);const Mx=new THREE.Matrix4(),v=new V3(),sc=new V3();const a=Math.min(1,crowd.cheer);
  for(const G of crowd.groups){for(let i=0;i<G.base.length;i++){const b=G.base[i];v.set(b.x,b.y+Math.max(0,Math.sin(perfT*13+b.ph))*.2*a,b.z);sc.set(b.s,b.s,1);Mx.compose(v,b.q,sc);G.im.setMatrixAt(i,Mx);}
    G.im.instanceMatrix.needsUpdate=true;}
  crowd.dirty=crowd.cheer>0;
}
function adBoard(w,h,text,bg,fg){
  const t=canvasTex(512,64,(g,W,H)=>{g.fillStyle=bg;g.fillRect(0,0,W,H);g.fillStyle=fg;g.font='800 42px "Saira Condensed",Impact,sans-serif';g.textAlign='center';g.textBaseline='middle';
    const words=text.split('|');words.forEach((s,i)=>g.fillText(s,W*(i+.5)/words.length,H/2+2));});
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t}));
}

function buildTennis(surf){
  const S=SURF[surf],grp=new THREE.Group();
  const OX=C.HWd+6,OZ=C.HL+8;
  const outer=new THREE.Mesh(new THREE.PlaneGeometry(OX*2,OZ*2),new THREE.MeshStandardMaterial({map:surfaceTex(surf,S.outer,OX*2,OZ*2),roughness:.95}));
  outer.rotation.x=-Math.PI/2;outer.receiveShadow=true;grp.add(outer);
  if(surf==='hard'){const inner=new THREE.Mesh(new THREE.PlaneGeometry(C.HWd*2+2.4,C.HL*2+4.6),new THREE.MeshStandardMaterial({map:surfaceTex(surf,S.inner,12,28),roughness:.9}));
    inner.rotation.x=-Math.PI/2;inner.position.y=.002;inner.receiveShadow=true;grp.add(inner);}
  if(surf==='grass'){// franjas de corte
    for(let i=-6;i<6;i++){const st=new THREE.Mesh(new THREE.PlaneGeometry(OX*2,OZ/6),new THREE.MeshBasicMaterial({color:i%2?0xffffff:0x000000,transparent:true,opacity:i%2?.07:.04,depthWrite:false}));st.rotation.x=-Math.PI/2;st.position.set(0,.003,(i+.5)*OZ/6);grp.add(st);}
    const worn=new THREE.Mesh(new THREE.PlaneGeometry(C.HWs*1.6,3.2),new THREE.MeshStandardMaterial({color:0xb7a77a,transparent:true,opacity:.3,roughness:1,depthWrite:false}));
  }
  const lc=S.line,W=.05;
  for(const s of [-1,1]){addLine(grp,-C.HWd,s*C.HL,C.HWd,s*C.HL,.1,lc);addLine(grp,s*C.HWd,-C.HL,s*C.HWd,C.HL,W,lc);addLine(grp,s*C.HWs,-C.HL,s*C.HWs,C.HL,W,lc);
    addLine(grp,-C.HWs,s*C.SL,C.HWs,s*C.SL,W,lc);addLine(grp,0,s*C.HL,0,s*(C.HL-.1),W,lc);}
  addLine(grp,0,-C.SL,0,C.SL,W,lc);
  buildNet(grp);
  // muros de fondo con carteles y gradas
  const wallC=surf==='clay'?0x1f4d3a:surf==='grass'?0x1c4a2c:0x1b3557;
  for(const s of [-1,1]){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(OX*2,1.2,.3),mat(wallC));wall.position.set(0,.6,s*OZ);grp.add(wall);
    const ad=adBoard(OX*1.6,.9,'POTRERO|SET POINT|RAQUETA','#'+new THREE.Color(wallC).getHexString(),'#e9f2ff');ad.position.set(0,.62,s*(OZ-.16));ad.rotation.y=s>0?Math.PI:0;grp.add(ad);
    const side=new THREE.Mesh(new THREE.BoxGeometry(.3,1.2,OZ*2),mat(wallC));side.position.set(s*OX,.6,0);grp.add(side);
    const ad2=adBoard(OZ*1.4,.9,'ACE|POTRERO|DEUCE','#'+new THREE.Color(wallC).getHexString(),'#d9f23a');ad2.position.set(s*(OX-.16),.62,0);ad2.rotation.y=-s*Math.PI/2;grp.add(ad2);
  }
  crowd=buildCrowd(grp,[{x:0,z:OZ+.5,w:OX*2,rows:9,rotY:0},{x:0,z:-OZ-.5,w:OX*2,rows:9,rotY:Math.PI},{x:OX+.5,z:0,w:OZ*2,rows:11,rotY:Math.PI/2,roof:true},{x:-OX-.5,z:0,w:OZ*2,rows:11,rotY:-Math.PI/2,roof:true}]);
  // silla del juez
  const chair=new THREE.Group();const leg=mat(0x2a3442,{metalness:.3});
  for(const [a,b] of [[-.3,-.3],[.3,-.3],[-.3,.3],[.3,.3]]){const l=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,1.9,8),leg);l.position.set(a,.95,b);chair.add(l);}
  const seat=new THREE.Mesh(new THREE.BoxGeometry(.8,.08,.8),mat(0x1b5e9b));seat.position.y=1.9;chair.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(.08,.6,.8),mat(0x1b5e9b));back.position.set(-.4,2.2,0);chair.add(back);
  chair.position.set(-(C.postX+1.1),0,0);chair.traverse(n=>{if(n.isMesh)n.castShadow=true;});grp.add(chair);
  grp.userData.umpire={x:-(C.postX+1.1),y:1.94,z:0};
  // bancos
  for(const s of [-1,1]){const b=new THREE.Mesh(new THREE.BoxGeometry(.5,.45,1.6),mat(0x2a78d6));b.position.set(-(C.postX+1.4),.22,s*2.2);b.castShadow=true;grp.add(b);}
  return grp;
}

function buildPadel(){
  const S=SURF.padel,grp=new THREE.Group(),OX=C.HWd+5,OZ=C.HL+8;
  const outer=new THREE.Mesh(new THREE.PlaneGeometry(OX*2,OZ*2),new THREE.MeshStandardMaterial({map:surfaceTex('hard',0x3e4b5c,OX*2,OZ*2),roughness:.95}));outer.rotation.x=-Math.PI/2;outer.receiveShadow=true;grp.add(outer);
  const inner=new THREE.Mesh(new THREE.PlaneGeometry(C.HWd*2,C.HL*2),new THREE.MeshStandardMaterial({map:surfaceTex('padel',S.inner,10,20),roughness:.95}));inner.rotation.x=-Math.PI/2;inner.position.y=.002;inner.receiveShadow=true;grp.add(inner);
  for(const s of [-1,1])addLine(grp,-C.HWd,s*C.SL,C.HWd,s*C.SL,.05,S.line);
  addLine(grp,0,-C.SL-.2,0,C.SL+.2,.05,S.line);
  buildNet(grp);
  // vidrios y malla
  const glass=new THREE.MeshStandardMaterial({color:0xcfe9ff,transparent:true,opacity:.13,roughness:.05,metalness:.1,depthWrite:false,side:THREE.DoubleSide});
  const meshTex=canvasTex(32,32,(g,W,H)=>{g.clearRect(0,0,W,H);g.strokeStyle='rgba(18,22,28,1)';g.lineWidth=2;g.beginPath();g.moveTo(0,0);g.lineTo(W,H);g.moveTo(W,0);g.lineTo(0,H);g.stroke();},[1,1]);
  const meshMat=h=>{const t=meshTex.clone();t.needsUpdate=true;t.wrapS=t.wrapT=THREE.RepeatWrapping;return new THREE.MeshStandardMaterial({map:t,transparent:true,alphaTest:.3,side:THREE.DoubleSide,roughness:1});};
  const frame=mat(0x161b22,{metalness:.5,roughness:.4});
  const panel=(w,h,x,y,z,ry,m)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);p.position.set(x,y,z);p.rotation.y=ry;grp.add(p);if(m.map){m.map.repeat.set(w/.1,h/.1);}return p;};
  const post=(x,z,h)=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.08,h,.08),frame);p.position.set(x,h/2,z);p.castShadow=true;grp.add(p);};
  for(const s of [-1,1]){
    panel(C.HWd*2,3,0,1.5,s*C.HL,0,glass);panel(C.HWd*2,1,0,3.5,s*C.HL,0,meshMat());
    for(let x=-C.HWd;x<=C.HWd+.01;x+=2)post(x,s*C.HL,4);
    for(const sx of [-1,1]){
      panel(2,3,sx*C.HWd,1.5,s*(C.HL-1),Math.PI/2,glass);panel(2,1,sx*C.HWd,3.5,s*(C.HL-1),Math.PI/2,meshMat());
      panel(2,2,sx*C.HWd,1,s*(C.HL-3),Math.PI/2,glass);panel(2,1,sx*C.HWd,2.5,s*(C.HL-3),Math.PI/2,meshMat());
      post(sx*C.HWd,s*(C.HL-2),4);post(sx*C.HWd,s*(C.HL-4),3);post(sx*C.HWd,s*(C.HL-6),3);post(sx*C.HWd,s*(C.HL-8),3);
    }
  }
  for(const sx of [-1,1])panel(12,3,sx*C.HWd,1.5,0,Math.PI/2,meshMat());
  // ambiente de club: gradas bajas, techo de chapa, carteles
  crowd=buildCrowd(grp,[{x:OX-1.6,z:0,w:16,rows:5,rotY:Math.PI/2,roof:true},{x:-OX+1.6,z:0,w:16,rows:5,rotY:-Math.PI/2,roof:true}],0x2b8a5a,0x237049);
  for(const s of [-1,1]){const ad=adBoard(10,.8,'PÁDEL|POTRERO','#0d2a52','#d9f23a');ad.position.set(0,4.5,s*(C.HL+.05));ad.rotation.y=s>0?Math.PI:0;grp.add(ad);
    const bw=new THREE.Mesh(new THREE.BoxGeometry(OX*2,7,.4),mat(0xe8e2d6));bw.position.set(0,3.5,s*(OZ+6));grp.add(bw);}
  const roof=new THREE.Mesh(new THREE.BoxGeometry(OX*2,.3,OZ*2),mat(0xdfe6ee));roof.position.set(0,9.5,0);roof.visible=false;grp.add(roof);
  grp.userData.umpire=null;
  return grp;
}

function buildVenue(sport,surf){
  disposeVenue();C=GEO[sport];SP=SPORT[sport];
  venue=sport==='padel'?buildPadel():buildTennis(surf);scene.add(venue);
  
  scene.fog.color.setHex(sport==='padel'?0xc9d6e4:0xb9d3ec);
}

/* pelota de tenis: amarillo flúor con costura */
const ballTex=canvasTex(256,128,(g,W,H)=>{g.fillStyle='#d7ef3a';g.fillRect(0,0,W,H);
  for(let i=0;i<3500;i++){g.fillStyle=Math.random()<.5?'rgba(255,255,255,.12)':'rgba(90,110,0,.12)';g.fillRect(Math.random()*W,Math.random()*H,1.5,1.5);}
  g.strokeStyle='rgba(255,255,255,.95)';g.lineWidth=5;g.beginPath();
  for(let i=0;i<=200;i++){const u=i/200,x=u*W,y=H/2+Math.sin(u*Math.PI*4)*H*.26;i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();});
const ballMesh=new THREE.Mesh(new THREE.SphereGeometry(BR,20,14),new THREE.MeshStandardMaterial({map:ballTex,roughness:.9}));
ballMesh.castShadow=true;ballMesh.scale.setScalar(2.1);scene.add(ballMesh);// más grande a la vista para que se lea desde la cámara
const blobTex=canvasTex(64,64,(g,W,H)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(.55,'rgba(0,0,0,.55)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,W,H);});
const ballShadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,opacity:.8}));
ballShadow.rotation.x=-Math.PI/2;ballShadow.renderOrder=2;scene.add(ballShadow);
// marca del pique (como el "ojo de halcón")
const markMesh=new THREE.Mesh(new THREE.CircleGeometry(.06,20),new THREE.MeshBasicMaterial({color:0x6b4a2a,transparent:true,opacity:0,depthWrite:false}));
markMesh.rotation.x=-Math.PI/2;markMesh.scale.set(1,1.6,1);markMesh.renderOrder=1;scene.add(markMesh);
// anillo de ayuda (dificultad fácil): dónde pararse
const helpRing=new THREE.Mesh(new THREE.RingGeometry(.32,.4,28),new THREE.MeshBasicMaterial({color:0xd9f23a,transparent:true,opacity:0,depthWrite:false}));
helpRing.rotation.x=-Math.PI/2;helpRing.renderOrder=2;scene.add(helpRing);
