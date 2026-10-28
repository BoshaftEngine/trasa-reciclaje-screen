/* TRASA V26 — Pantalla de resultados + presentación configurable de inicio. */
import { MATERIALS } from './materials.js?v=2';
import { loadFirebase, roomPath, isFirebaseConfigured } from './common.js';
const home=document.getElementById('homeView');
const results=document.getElementById('resultsView');
const grid=document.getElementById('materialGrid');
let db,dbMod;

/* CAPAS de presentación: no se toca el visor de Arcade, que utiliza arcadeView. */
const layers=[];
for(let i=0;i<2;i++){
  const layer=document.createElement('div');
  layer.className='trasa-home-layer';
  layer.setAttribute('aria-hidden','true');
  home.append(layer);layers.push(layer);
}
let slideUrls=[]; let intervalSeconds=10; let slideIndex=-1; let visibleLayer=-1;
let slideTimer=null; let slideSequence=0; let slideConfigKey=null;
let activeHome=false,screenMode=null;
function clearSlideTimer(){if(slideTimer!==null)clearInterval(slideTimer);slideTimer=null;}
function firstSlide(){
  if(!slideUrls.length)return;
  slideIndex=0;
  // Primer cambio inmediato, sin superponer dos fondos antiguos.
  layers.forEach(el=>el.classList.remove('is-visible'));
  visibleLayer=-1;
  renderSlide(slideUrls[0]);
}
function renderSlide(url){
  if(!url)return;
  const next=visibleLayer===0?1:0;
  const el=layers[next];
  el.style.backgroundImage=`url(${JSON.stringify(url)})`;
  el.classList.add('is-visible');
  if(visibleLayer!==-1)layers[visibleLayer].classList.remove('is-visible');
  visibleLayer=next;
}
function startSlideTimer(){
  clearSlideTimer();
  if(!activeHome||slideUrls.length<2)return;
  slideTimer=setInterval(()=>{
    if(!activeHome||slideUrls.length<2)return;
    slideIndex=(slideIndex+1)%slideUrls.length;
    renderSlide(slideUrls[slideIndex]);
  },intervalSeconds*1000);
}
function setScreenMode(mode){
  screenMode=mode;
  const nextActive=mode==='home'||mode===undefined||mode===null;
  if(!nextActive){activeHome=false;clearSlideTimer();return;}
  if(!activeHome){activeHome=true;firstSlide();startSlideTimer();}
}
function normalizeSlides(raw){
  const n=Number(raw?.count),s=Number(raw?.seconds);
  return {
    count:Number.isInteger(n)&&n>=1&&n<=4?n:1,
    seconds:Number.isInteger(s)&&s>=2&&s<=3600?s:10,
    revision:Number.isFinite(Number(raw?.revision))?Number(raw.revision):0
  };
}
function loadImage(url){
  return new Promise(resolve=>{
    const img=new Image();let done=false;
    const complete=ok=>{if(done)return;done=true;img.onload=null;img.onerror=null;resolve(ok?url:null);};
    img.onload=()=>complete(true);img.onerror=()=>complete(false);
    img.src=url;
    // En conexiones lentas no dejar colgada una actualización de configuración.
    setTimeout(()=>complete(false),12000);
  });
}
async function applySlides(raw){
  const c=normalizeSlides(raw),key=`${c.count}:${c.seconds}:${c.revision}`;
  if(key===slideConfigKey)return;
  slideConfigKey=key;
  const token=++slideSequence;
  const urls=Array.from({length:c.count},(_,i)=>`assets/inicio${i||''}.png${c.revision?'?rev='+c.revision:''}`);
  const loaded=(await Promise.all(urls.map(loadImage))).filter(Boolean);
  if(token!==slideSequence)return;
  if(loaded.length<c.count)console.warn(`TRASA V26: ${c.count-loaded.length} imágenes de inicio no están disponibles. Comprueba assets/inicio*.png.`);
  slideUrls=loaded;
  intervalSeconds=c.seconds;
  if(activeHome){firstSlide();startSlideTimer();}
  else clearSlideTimer();
}
function showHome(){
  home.classList.remove('hidden');
  results.classList.add('hidden');
  results.classList.remove('compact-results');
}
function showResults(values={}){
  grid.replaceChildren();
  const visible=MATERIALS.filter(m=>Number(values[m.id]||0)>0);
  if(!visible.length){showHome();return;}
  results.classList.toggle('compact-results',visible.length>12);
  for(const m of visible){
    const card=document.createElement('div');card.className='material-card';
    const img=document.createElement('img');img.src=m.image;img.alt=m.name;
    const name=document.createElement('div');name.className='material-name';name.textContent=m.name;
    const qty=document.createElement('div');qty.className='material-qty';qty.textContent=Number(values[m.id]);
    card.append(img,name,qty);grid.append(card);
  }
  home.classList.add('hidden');results.classList.remove('hidden');
}
async function heartbeat(){
  if(!db)return;
  try{await dbMod.update(dbMod.ref(db,roomPath('status')),{online:true,updatedAt:dbMod.serverTimestamp()});}
  catch(e){console.warn('TRASA: fallo de heartbeat',e);}
}
async function init(){
  showHome();
  if(!isFirebaseConfigured()){applySlides(null);return;}
  try{
    const f=await loadFirebase();db=f.db;dbMod=f.dbMod;
    await f.authMod.signInAnonymously(f.auth);
    dbMod.onValue(dbMod.ref(db,roomPath('display')),snapshot=>{
      const val=snapshot.val()||{};
      applySlides(val.homeSlides);
      if(val.mode==='results')showResults(val.materials||{});
      else showHome();
      setScreenMode(val.mode);
    },error=>console.error('TRASA: no se puede leer display',error));
    setInterval(heartbeat,3000);heartbeat();
  }catch(error){console.error('TRASA: error inicializando pantalla',error);applySlides(null);}
}
init();
