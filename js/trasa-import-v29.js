/* TRASA V29 · Importar capturas del inventario de GTA.
 * No escribe en Firebase: rellena únicamente los <input id="mat-..."> de CONTROL.
 * Usa patrones locales y recurre a Tesseract solo si hace falta. Los iconos se aprenden localmente
 * para futuras capturas; nunca se envía la captura a ningún servidor de TRASA.
 */
import {MATERIALS} from './materials.js?v=2';
import {gtaQuantityFromImage} from './trasa-quantity-v29.js?v=29';
const $ = id => document.getElementById(id);
const drop=$('trasaImportDrop'), fileInput=$('trasaImportFile'), canvas=$('trasaImportPreview');
const scanBtn=$('trasaImportScan'), applyBtn=$('trasaImportApply'), rowsEl=$('trasaImportRows');
const status=$('trasaImportStatus'), columnsEl=$('trasaImportColumns'), modeEl=$('trasaImportMode');
const clearBtn=$('trasaImportClear'), summary=$('trasaImportSummary'), ocrBtn=$('trasaImportOcr');
const knownIds=new Set(MATERIALS.map(m=>m.id));
const STORE='trasa-inventory-icon-training-v27';
let image=null, tiles=[], templates=[], worker=null, processing=false, pendingFile=null, ocrUnavailable=false;
let learned=[];
try {const saved=JSON.parse(localStorage.getItem(STORE)||'[]');if(Array.isArray(saved)) learned=saved.filter(t=>knownIds.has(t.id)&&Array.isArray(t.f));}catch{}
function note(t,error=false){status.textContent=t;status.classList.toggle('is-error',error);}
function drawBox(ctx,img,x,y,w,h){ctx.drawImage(img,x,y,w,h);}
function cv(w,h){const e=document.createElement('canvas');e.width=w;e.height=h;return e;}
function fingerprint(source){
  const c=cv(48,40),ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#050709';ctx.fillRect(0,0,c.width,c.height);
  ctx.drawImage(source,0,0,c.width,c.height);
  const {data}=ctx.getImageData(0,0,c.width,c.height),hist=new Array(64).fill(0);
  let fg=0,light=0,red=0,green=0,blue=0;
  for(let k=0;k<data.length;k+=4){const r=data[k],g=data[k+1],b=data[k+2];
    const v=Math.max(r,g,b);if(v<38)continue;
    const key=(Math.min(3,r>>6)<<4)|(Math.min(3,g>>6)<<2)|Math.min(3,b>>6);
    hist[key]++;fg++;light+=v/255;red+=r/255;green+=g/255;blue+=b/255;
  }
  const n=Math.max(1,fg),out=hist.map(v=>Math.sqrt(v/n));
  out.push(Math.min(1,fg/1800),light/n,red/n,green/n,blue/n);
  return out.map(n=>Math.round(n*1000)/1000);
}
function distance(a,b){let d=0;for(let i=0;i<Math.min(a.length,b.length);i++){
  const diff=a[i]-b[i];d+=diff*diff*(i<64?1:0.45);
}return Math.sqrt(d);}
function croppedIcon(img,x,y,side){
  // Se descarta el tercio inferior (contiene la cantidad xNNN).
  const c=cv(96,76),ctx=c.getContext('2d');
  ctx.fillStyle='#050709';ctx.fillRect(0,0,96,76);
  const srcX=x+side*.07,srcY=y+side*.055;
  ctx.drawImage(img,srcX,srcY,side*.84,side*.55,0,0,96,76);
  return c;
}
function hasIcon(img,x,y,side){
  const c=cv(40,32),ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,x+side*.14,y+side*.10,side*.73,side*.52,0,0,40,32);
  const {data}=ctx.getImageData(0,0,40,32);let count=0;
  for(let i=0;i<data.length;i+=4){const bright=Math.max(data[i],data[i+1],data[i+2]);if(bright>70)count++;}
  return count>20; // Ignora casillas negras con marco azul
}
function getBest(feature){
  const choices=[...learned.map(v=>({...v,learned:true})),...templates];
  const best=choices.map(t=>({id:t.id,score:distance(feature,t.f),learned:!!t.learned}))
    .sort((a,b)=>a.score-b.score);if(!best.length)return {id:'',hint:''};
  const b=best[0],next=best.find(t=>t.id!==b.id)?.score??9;
  // Sin entrenamiento se exige mucha similitud para evitar falsas asignaciones.
  if(b.learned&&b.score<.24&&(next-b.score)>.014) return{id:b.id,hint:'Aprendido'};
  if(!b.learned&&b.score<.16&&(next-b.score)>.055)return{id:b.id,hint:'Sugerido'};
  return{id:'',hint:best[0]?`Posible: ${MATERIALS.find(m=>m.id===b.id)?.name||''}`:''};
}
async function loadAssets(){
  templates=[];
  await Promise.all(MATERIALS.map(m=>new Promise(resolve=>{
    const img=new Image();img.onload=()=>{const c=cv(96,76),x=c.getContext('2d');
      x.fillStyle='#050709';x.fillRect(0,0,96,76);
      const ratio=Math.min(86/img.naturalWidth,67/img.naturalHeight);
      const w=img.naturalWidth*ratio,h=img.naturalHeight*ratio;
      x.drawImage(img,(96-w)/2,(76-h)/2,w,h);
      templates.push({id:m.id,f:fingerprint(c)});resolve();};
    img.onerror=()=>resolve();img.src=m.image;
  })));
}
function fileToImage(file){return new Promise((resolve,reject)=>{
  if(!file||!file.type.startsWith('image/'))return reject(new Error('Selecciona una imagen PNG, JPG o WebP.'));
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('No se pudo leer la imagen.'));};
  img.src=url;
});}
function preview(){
  const ctx=canvas.getContext('2d');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  ctx.drawImage(image,0,0);canvas.hidden=false;
}
async function setFile(file){
  if(processing)return;
  try{image=await fileToImage(file);pendingFile=file;preview();scanBtn.disabled=false;
    note(`Imagen cargada (${image.naturalWidth} × ${image.naturalHeight}). Pulsa ANALIZAR CAPTURA.`);
    tiles=[];rowsEl.replaceChildren();applyBtn.disabled=true;summary.textContent='';
  }catch(e){note(e.message,true);}}
async function ensureOCR(){
  if(worker)return worker;
  if(ocrUnavailable)throw new Error('OCR no disponible');
  if(!window.Tesseract){
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      s.onload=resolve;s.onerror=()=>reject(new Error('No se ha podido cargar el motor OCR (comprueba tu conexión).'));
      document.head.appendChild(s);});
  }
  worker=await window.Tesseract.createWorker('eng',1,{logger:()=>{}});
  await worker.setParameters({tessedit_char_whitelist:'xX0123456789',tessedit_pageseg_mode:'7'});
  return worker;
}
function quantityCrop(img,x,y,side,contrast=false){
  const c=cv(460,160),ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=false;
  const a=cv(78,27),ac=a.getContext('2d',{willReadFrequently:true});
  ac.drawImage(img,x+side*.32,y+side*.58,side*.62,side*.26,0,0,78,27);
  if(contrast){
    const raw=ac.getImageData(0,0,78,27),px=raw.data;
    for(let i=0;i<px.length;i+=4){const min=Math.min(px[i],px[i+1],px[i+2]);const max=Math.max(px[i],px[i+1],px[i+2]);
      const white=min>130&&max-min<68?255:0;px[i]=px[i+1]=px[i+2]=white;}
    ac.putImageData(raw,0,0);
  }
  ctx.fillStyle='#060606';ctx.fillRect(0,0,c.width,c.height);
  ctx.drawImage(a,0,0,460,160);return c;
}
function parseQuantity(raw){
  const txt=String(raw||'').replace(/\s/g,'');
  const match=txt.match(/[xX](\d{1,4})/);if(match)return{q:Number(match[1]),exact:true};
  const numbers=txt.match(/(\d{1,4})$/);
  return numbers?{q:Number(numbers[1]),exact:false}:{q:null,exact:false};
}
async function readQuantity(t){
  // V29: dos lectores LOCALES. Nunca dependemos de que cargue Tesseract.
  const local=gtaQuantityFromImage(image,t.x,t.y,t.side);
  if(local.quantity!==null && Number.isSafeInteger(local.quantity)){
    return {q:local.quantity,hint:local.reliable
      ?'Cantidad leída · confirma visualmente'
      :'Cantidad estimada · comprueba el recorte'};
  }
  // La cantidad se puede introducir sin volver a analizar todos los iconos.
  return {q:'',hint:'No se detectó la cantidad · escribe la que ves en el recorte'};
}
/** Muestra la zona de número AMPLIADA para corregir casos que no reconozca. */
function quantityPreview(t){
  if(!image)return '';
  const c=cv(180,76),ctx=c.getContext('2d');
  ctx.fillStyle='#000';ctx.fillRect(0,0,c.width,c.height);
  // Incluye el texto xNNN y un poco de contexto por si está desplazado.
  const px=t.x+t.side*.26,py=t.y+t.side*.44;
  const pw=t.side*.70,ph=t.side*.48;
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,px,py,pw,ph,0,0,c.width,c.height);
  return c.toDataURL('image/png');
}
function summaryUpdate(){
  const valid=tiles.filter(t=>knownIds.has(t.material)&&Number(t.quantity)>0),pending=tiles.filter(t=>!knownIds.has(t.material)||!Number(t.quantity));
  const groups=new Map();for(const t of valid)groups.set(t.material,(groups.get(t.material)||0)+Number(t.quantity));
  summary.textContent=`${tiles.length} casillas ocupadas · ${valid.length} completas · ${pending.length} pendientes · ${groups.size} materiales diferentes · ${[...groups.values()].reduce((a,b)=>a+b,0)} unidades listas`; 
  applyBtn.disabled=!valid.length||processing;
  if(ocrBtn)ocrBtn.disabled=processing||!pending.length;
  if(pending.length)applyBtn.title='Solo se aplicarán las casillas completas; revisa las pendientes.';
  else applyBtn.title='Aplicar los materiales confirmados al formulario superior.';
}
function propagate(t){
  if(!knownIds.has(t.material))return;
  for(const other of tiles){if(other===t||other.material)continue;
    if(distance(other.feature,t.feature)<.18){other.material=t.material;other.hint='Icono repetido';}
  }
}
function optionSelect(t){
  const select=document.createElement('select');select.setAttribute('aria-label','Material de casilla '+t.label);
  select.append(new Option('— Elegir material —',''));
  for(const m of MATERIALS)select.add(new Option(m.name,m.id));select.value=t.material;
  select.onchange=()=>{t.material=select.value;t.hint='Confirmado';propagate(t);renderRows();};
  return select;
}
function renderRows(){
  rowsEl.replaceChildren();for(const t of tiles){
    const row=document.createElement('div');row.className='trasa-import-row';
    const img=document.createElement('img');img.src=t.icon.toDataURL('image/png');img.alt='Icono casilla '+t.label;
    const detail=document.createElement('div');detail.className='trasa-import-row-data';
    const title=document.createElement('div');title.className='trasa-import-cell-name';title.textContent='Casilla '+t.label;
    const sel=optionSelect(t);
    detail.append(title,sel);
    const group=document.createElement('div');group.className='trasa-import-quantity';
    const input=document.createElement('input');input.type='number';input.min='1';input.max='9999';input.step='1';input.value=t.quantity;
    input.setAttribute('aria-label','Cantidad de casilla '+t.label);
    input.oninput=()=>{t.quantity=input.value;summaryUpdate();};
    const hint=document.createElement('span');hint.textContent=t.hint||'Revisar';hint.className='trasa-import-hint';
    const preview=document.createElement('img');preview.className='trasa-import-quantity-preview';
    preview.src=quantityPreview(t);preview.alt='Número original ampliado de casilla '+t.label;
    group.append(preview,input,hint);row.append(img,detail,group);rowsEl.append(row);
  }
  summaryUpdate();
}
async function scan(){
  if(processing||!image)return;processing=true;scanBtn.disabled=true;applyBtn.disabled=true;
  note('Buscando casillas de inventario…');rowsEl.replaceChildren();tiles=[];if(ocrBtn)ocrBtn.disabled=true;
  await loadAssets();
  const cols=Math.max(3,Math.min(8,Number(columnsEl.value)||5)),side=image.naturalWidth/cols;
  const totalRows=Math.min(15,Math.ceil(image.naturalHeight/side));
  for(let row=0;row<totalRows;row++)for(let col=0;col<cols;col++){
    const x=col*side,y=row*side;if(y+side*.68>image.naturalHeight)continue;
    if(!hasIcon(image,x,y,side))continue;
    const icon=croppedIcon(image,x,y,side),feature=fingerprint(icon),guess=getBest(feature);
    tiles.push({x,y,side,icon,feature,material:guess.id,quantity:'',hint:guess.hint||'Revisar',label:`${row+1}.${col+1}`});
  }
  if(!tiles.length){processing=false;scanBtn.disabled=false;note('No se detectaron iconos. Recorta la captura para dejar solo la cuadrícula y selecciona las columnas correctas.',true);return;}
  note(`Detectadas ${tiles.length} casillas. Preparando lectura de cantidades…`);
  renderRows();
  // Leer la cantidad de cada pila. Nunca publicar automáticamente.
  for(let i=0;i<tiles.length;i++){
    const t=tiles[i];note(`Leyendo cantidades ${i+1}/${tiles.length}…`);
    const out=await readQuantity(t);t.quantity=out.q;t.hint=(t.hint?`${t.hint} · `:'')+out.hint;
    renderRows();
  }
  // Si el usuario identificó un icono previamente, aplica también a duplicados.
  for(const t of tiles)propagate(t);
  processing=false;scanBtn.disabled=false;renderRows();
  const missing=tiles.filter(t=>!t.material||!Number(t.quantity)).length;
  note(`Análisis terminado: ${tiles.length} pilas. ${missing?`Hay ${missing} casillas por revisar.`:'Comprueba las cantidades y pulsa RELLENAR FORMULARIO.'}`);
}
async function retryOCR(){
  if(processing||!image||!tiles.length)return;
  processing=true;scanBtn.disabled=true;applyBtn.disabled=true;if(ocrBtn)ocrBtn.disabled=true;
  try{
    note('Cargando OCR alternativo…');
    const w=await ensureOCR();
    let found=0;
    for(const [i,t] of tiles.entries()){
      if(Number(t.quantity)>0)continue;
      note(`OCR alternativo: ${i+1}/${tiles.length}…`);
      const shots=[quantityCrop(image,t.x,t.y,t.side,false),quantityCrop(image,t.x,t.y,t.side,true)];
      const options=[];
      for(const crop of shots){
        const response=await w.recognize(crop);
        const parsed=parseQuantity(response.data?.text);
        if(parsed.q!==null&&Number.isInteger(parsed.q)&&parsed.q>0&&parsed.q<=9999)
          options.push({...parsed,conf:Number(response.data?.confidence)||0});
      }
      options.sort((a,b)=>Number(b.exact)-Number(a.exact)||b.conf-a.conf);
      if(options.length){t.quantity=options[0].q;t.hint+=' · OCR (revisar)';found++;}
    }
    note(`OCR alternativo finalizado: ${found} cantidades adicionales. Revisa los números.`);
  }catch(err){note(`OCR externo no disponible (${err.message}). Puedes escribir los números ampliados.`,true);}
  finally{processing=false;scanBtn.disabled=false;renderRows();}
}
function apply(){
  if(processing)return;
  const groups=new Map(),selected=tiles.filter(t=>knownIds.has(t.material)&&Number.isInteger(Number(t.quantity))&&Number(t.quantity)>0);
  const pending=tiles.length-selected.length;
  if(pending&&!confirm(`Quedan ${pending} casillas sin identificar o sin cantidad. ¿Quieres aplicar SOLO las ${selected.length} casillas completas?`))return;
  for(const t of selected)groups.set(t.material,(groups.get(t.material)||0)+Number(t.quantity));
  if(!groups.size){note('No hay materiales completos para importar. Revisa los números y el material asignado a cada casilla.',true);return;}
  if([...groups.keys()].some(id=>!$('mat-'+id))){note('No encuentro los campos de materiales. Recarga CONTROL y vuelve a intentarlo.',true);return;}
  // Memoriza solo patrones de los iconos asignados; no conserva la imagen original.
  for(const t of selected){
    const old=learned.find(x=>x.id===t.material&&distance(x.f,t.feature)<.05);
    if(!old)learned.push({id:t.material,f:t.feature});
  }
  learned=learned.slice(-200);try{localStorage.setItem(STORE,JSON.stringify(learned));}catch{}
  const additive=modeEl.value==='sum';
  if(!additive){for(const m of MATERIALS){const target=$('mat-'+m.id);if(target)target.value='0';}}
  let total=0;for(const [id,n] of groups){const target=$('mat-'+id);if(!target)continue;
    target.value=String((additive?Math.max(0,Number(target.value)||0):0)+n);total+=n;
    target.dispatchEvent(new Event('input',{bubbles:true}));}
  const checked=[...groups].every(([id,n])=>Number($('mat-'+id)?.value)>=(additive?n:n));
  if(!checked){note('Error al comprobar las cantidades del formulario. Revisa los campos antes de publicar.',true);return;}
  note(`IMPORTACIÓN CONFIRMADA: ${groups.size} materiales, ${total} unidades ${additive?'sumadas':'rellenadas'}. Ya puedes pulsar MOSTRAR MATERIALES.`);
  document.getElementById('materialInputs')?.scrollIntoView({behavior:'smooth',block:'start'});
}
fileInput?.addEventListener('change',()=>{if(fileInput.files?.[0])setFile(fileInput.files[0]);});
scanBtn?.addEventListener('click',scan);applyBtn?.addEventListener('click',apply);ocrBtn?.addEventListener('click',retryOCR);
clearBtn?.addEventListener('click',()=>{tiles=[];image=null;pendingFile=null;fileInput.value='';canvas.hidden=true;rowsEl.replaceChildren();applyBtn.disabled=true;scanBtn.disabled=true;if(ocrBtn)ocrBtn.disabled=true;summary.textContent='';note('Preparado para importar otra captura.');});
drop?.addEventListener('click',event=>{if(event.target===drop||event.target.closest('.trasa-import-drop-label'))fileInput.click();});
drop?.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target===drop){event.preventDefault();fileInput.click();}});
drop?.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag-over');});
drop?.addEventListener('dragleave',()=>drop.classList.remove('drag-over'));
drop?.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag-over');const f=[...(e.dataTransfer?.files||[])].find(t=>t.type.startsWith('image/'));if(f)setFile(f);});
document.addEventListener('paste',e=>{const f=[...(e.clipboardData?.items||[])].find(t=>t.type.startsWith('image/'))?.getAsFile();if(f){e.preventDefault();setFile(f);}});
note('Pega una captura con Ctrl + V, arrástrala aquí o selecciona un archivo.');
