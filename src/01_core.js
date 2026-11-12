"use strict";
/* ================= Utilidades ================= */
const V3=THREE.Vector3;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,rand=(a,b)=>a+Math.random()*(b-a),hyp=Math.hypot,lerp=(a,b,t)=>a+(b-a)*t;
const pick=a=>a[(Math.random()*a.length)|0];
const wrapAng=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;};
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const gauss=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
let perfT=0,simT=0;

/* ================= Medidas oficiales ================= */
// eje Z: largo de la cancha (la red está en z=0), eje X: ancho
const GEO={
  tennis:{HL:11.885,HWs:4.115,HWd:5.485,SL:6.40,netC:.914,netP:1.07,postX:6.4,walls:false},
  padel:{HL:10,HWs:5,HWd:5,SL:6.95,netC:.88,netP:.92,postX:5.0,walls:true}
};
let C=GEO.tennis;
const BR=.0335,G=9.81;
function netH(x){const u=Math.min(1,Math.abs(x)/C.postX);return C.netC+(C.netP-C.netC)*u*u;}

/* velocidades y efectos por deporte (m/s y rad/s) */
const SPORT={
  tennis:{run:6.6,acc:22,reach:1.25,serveH:2.72,shot:{top:[23,34],slice:[18,24],lob:[11,15],drop:[9,12],smash:[30,38],volley:[18,26]},serve:[40,57],serve2:[32,40],cor:{hard:.76,clay:.8,grass:.7},keep:{hard:.74,clay:.62,grass:.84}},
  padel:{run:5.8,acc:20,reach:1.15,serveH:.85,shot:{top:[17,24],slice:[14,19],lob:[9.5,12.5],drop:[7,9],smash:[22,29],volley:[14,20]},serve:[17,22],serve2:[15,18],cor:{hard:.72},keep:{hard:.7}}
};
let SP=SPORT.tennis;

/* ================= Render ================= */
const wrap=document.getElementById('game');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
wrap.appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xb9d3ec,90,260);
const camera=new THREE.PerspectiveCamera(40,1,.2,600);
function resize(){const w=wrap.clientWidth||innerWidth,h=wrap.clientHeight||innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();

const hemi=new THREE.HemisphereLight(0xdfeeff,0x5d6b4a,.75);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff3dc,1.15);sun.position.set(-18,40,14);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:5,far:90});sun.shadow.bias=-.0006;sun.shadow.normalBias=.02;
scene.add(sun);scene.add(sun.target);

/* cielo */
const skyMesh=(()=>{const c=document.createElement('canvas');c.width=16;c.height=256;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,'#2f6fc4');gr.addColorStop(.42,'#7fb4ea');gr.addColorStop(.5,'#d4e6f6');gr.addColorStop(1,'#a8c3a0');g.fillStyle=gr;g.fillRect(0,0,16,256);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;
  const m=new THREE.Mesh(new THREE.SphereGeometry(400,24,16),new THREE.MeshBasicMaterial({map:t,side:THREE.BackSide,fog:false,depthWrite:false}));scene.add(m);return m;})();

/* helpers de materiales */
const matCache={};
function mat(color,o){const k=color+JSON.stringify(o||{});return matCache[k]||(matCache[k]=new THREE.MeshStandardMaterial(Object.assign({color,roughness:.85,metalness:0},o||{})));}
function canvasTex(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;
  if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep[0],rep[1]);}return t;}
