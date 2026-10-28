/* TRASA V26: Control de materiales e imágenes de inicio. */
import { MATERIALS } from './materials.js?v=2';
import { loadFirebase, roomPath, isFirebaseConfigured } from './common.js';
const $ = id => document.getElementById(id);
const inputs = $('materialInputs');
const showBtn = $('showResultsBtn');
const updateBtn = $('updateResultsBtn');
const homeBtn = $('homeBtn');
const clearBtn = $('clearBtn');
const dot = $('statusDot');
const statusText = $('statusText');
const uidBox = $('uidBox');
const cfg = $('configError');
const msg = $('message');
const slideCount = $('homeSlidesCount');
const slideSeconds = $('homeSlidesSeconds');
const slideSave = $('homeSlidesSave');
const slideFiles = $('homeSlidesFiles');
const slideStatus = $('homeSlidesStatus');
let db, dbMod, timer;
let latestSlidesKey = '';

function flash(text, type='') {
  clearTimeout(timer);
  msg.textContent = text;
  msg.className = `notice ${type}`.trim();
  msg.classList.remove('hidden');
  timer = setTimeout(() => msg.classList.add('hidden'), 3500);
}
function build() {
  for (const material of MATERIALS) {
    const row = document.createElement('div'); row.className = 'material-row';
    const image = document.createElement('img'); image.src = material.image; image.alt = material.name;
    const label = document.createElement('label'); label.htmlFor = `mat-${material.id}`; label.textContent = material.name;
    const input = document.createElement('input'); input.type='number'; input.min='0'; input.step='1'; input.value='0'; input.id=`mat-${material.id}`;
    row.append(image,label,input); inputs.append(row);
  }
}
function values() {
  const result = {};
  for (const m of MATERIALS) result[m.id] = Math.max(0,Number($(`mat-${m.id}`).value)||0);
  return result;
}
async function publish() {
  if (!db) return;
  const materialValues=values();
  if (!Object.values(materialValues).some(n => n>0)) return flash('Introduce al menos una cantidad mayor que 0.','error');
  try {
    // UPDATE en lugar de SET para conservar la configuración de inicio.
    await dbMod.update(dbMod.ref(db,roomPath('display')),
      { mode:'results', materials:materialValues, updatedAt:dbMod.serverTimestamp() });
    flash('Resultado mostrado en pantalla.','success');
  } catch(e) { flash('No se pudo actualizar: '+e.message,'error'); }
}
async function home() {
  if (!db) return;
  try {
    await dbMod.update(dbMod.ref(db,roomPath('display')),
      { mode:'home', featuredUid:'', updatedAt:dbMod.serverTimestamp() });
    flash('Pantalla principal restaurada.','success');
  } catch(e) { flash('Error al volver al inicio: '+e.message,'error'); }
}
function clearAll() {
  for (const m of MATERIALS) $(`mat-${m.id}`).value = '0';
  flash('Cantidades limpiadas.','success');
}
function renderStatus(status={}) {
  const online=status.online===true && Date.now()-(Number(status.updatedAt)||0)<8000;
  dot.className=`dot ${online?'ok':'bad'}`;
  statusText.textContent=online?'Pantalla GTA conectada':'Pantalla desconectada';
}
function slideNames(count) {
  return Array.from({length:count},(_,i)=>`assets/inicio${i||''}.png`);
}
function updateSlideFiles() {
  const count=Number(slideCount.value)||1;
  slideFiles.replaceChildren();
  for (const path of slideNames(count)) {
    const item=document.createElement('code'); item.textContent=path; slideFiles.append(item);
  }
  slideSeconds.disabled=count===1;
}
function readSlideConfig(value) {
  const n=Number(value?.count);
  const seconds=Number(value?.seconds);
  return {count:Number.isInteger(n)&&n>=1&&n<=4?n:1,
    seconds:Number.isInteger(seconds)&&seconds>=2&&seconds<=3600?seconds:10};
}
async function saveSlides() {
  if (!db) {slideStatus.textContent='No hay conexión con Firebase.';return;}
  const count=Number(slideCount.value), seconds=Number(slideSeconds.value);
  if (!Number.isInteger(count)||count<1||count>4||!Number.isInteger(seconds)||seconds<2||seconds>3600) {
    slideStatus.textContent='Selecciona 1–4 imágenes y un intervalo entero de 2–3600 segundos.';return;
  }
  slideSave.disabled=true;
  slideStatus.textContent='Guardando en Firebase…';
  try {
    const newValue={count,seconds,revision:Date.now()};
    await dbMod.update(dbMod.ref(db,roomPath('display')),{homeSlides:newValue});
    latestSlidesKey=JSON.stringify(newValue);
    slideStatus.textContent=`Guardado: ${count} ${count===1?'imagen':'imágenes'} · ${seconds} s. Aparecerán al volver a INICIO.`;
  } catch(e) {slideStatus.textContent='No se pudo guardar: '+e.message;}
  finally {slideSave.disabled=false;}
}
async function init() {
  build();
  showBtn.onclick=publish; updateBtn.onclick=publish; homeBtn.onclick=home; clearBtn.onclick=clearAll;
  slideCount.addEventListener('change',updateSlideFiles);
  slideSave.addEventListener('click',saveSlides);
  updateSlideFiles();
  if (!isFirebaseConfigured()) {
    cfg.textContent='Configura Firebase en js/firebase-config.js y vuelve a cargar.';
    cfg.classList.remove('hidden'); uidBox.textContent='Firebase todavía no está configurado.';
    slideStatus.textContent='Firebase no configurado.';
    return;
  }
  try {
    const f=await loadFirebase(); db=f.db; dbMod=f.dbMod;
    const credential=await f.authMod.signInAnonymously(f.auth);
    uidBox.textContent=credential.user.uid;
    dbMod.onValue(dbMod.ref(db,roomPath('status')),snap=>renderStatus(snap.val()||{}),e=>{
      statusText.textContent='Error de conexión: '+e.message;
    });
    dbMod.onValue(dbMod.ref(db,roomPath('display')),snap=>{
      const val=snap.val()||{};
      const config=readSlideConfig(val.homeSlides);
      const key=JSON.stringify(val.homeSlides||{});
      if (key!==latestSlidesKey && document.activeElement!==slideCount && document.activeElement!==slideSeconds) {
        slideCount.value=String(config.count); slideSeconds.value=String(config.seconds); updateSlideFiles();
        latestSlidesKey=key;
      }
      if (!val.homeSlides) slideStatus.textContent='Sin configuración guardada: se muestra solo inicio.png. Selecciona las imágenes y pulsa GUARDAR.';
      else if(!slideSave.disabled) slideStatus.textContent=`Configuración actual: ${config.count} ${config.count===1?'imagen':'imágenes'} · ${config.seconds} s.`;
    },e=>{slideStatus.textContent='No se pudieron leer los ajustes: '+e.message;});
  } catch(e) {
    cfg.textContent='Error Firebase: '+e.message; cfg.classList.remove('hidden');
    uidBox.textContent='No se pudo iniciar Firebase.';
    slideStatus.textContent='No se pudo conectar Firebase.';
  }
}
init();
