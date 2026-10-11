/* TRASA SNAKE V18 — retransmisión estable junto a los motores V13.
   Elige el mismo jugador destacado que el Arcade principal y evita reescribir el resto de los juegos. */
import {drawSnakeScene,SNAKE_CANVAS} from './arcade-snake.js?v=18';
import {loadFirebase,roomPath,isFirebaseConfigured} from './common.js';
const main=document.getElementById('arcadeStage');
const overlay=document.getElementById('snakeFeaturedStage');
const ranking=document.getElementById('arcadeSnakeRank');
const arcade=document.getElementById('arcadeView');
const title=document.getElementById('arcadeFeaturedName');
let live={},display={},currentUid='',canvas=null,info=null;
const safe=(value)=>{try{return JSON.parse(value||'{}')}catch{return {}}};
function feedback(msg){if(ranking)ranking.textContent=msg;console.warn('TRASA Snake V18:',msg)}
function renderRanking(snapshot){
  if(!ranking)return;
  ranking.replaceChildren();
  const rows=Object.entries(snapshot||{}).map(([uid,v])=>({uid,...v})).filter(v=>v&&typeof v.name==='string'&&Number.isFinite(Number(v.score)))
    .sort((a,b)=>Number(b.score)-Number(a.score)).slice(0,5);
  if(!rows.length){ranking.textContent='Todavía no hay récords';return;}
  rows.forEach((p,i)=>{const row=document.createElement('div');row.className='arcade-rank-row';
    const name=document.createElement('span'),points=document.createElement('strong');name.textContent=`${i+1}. ${String(p.name).slice(0,18)}`;
    points.textContent=String(p.score);row.append(name,points);ranking.append(row);
  });
}
function hideSnake(){
  if(main)main.classList.remove('snake-hide');
  if(overlay)overlay.classList.add('hidden');
  if(overlay)overlay.setAttribute('aria-hidden','true');
  currentUid='';canvas=null;info=null;
}
function showSnake(player,uid){
  if(!main||!overlay)return;
  if(currentUid!==uid||!canvas){
    currentUid=uid;overlay.replaceChildren();info=document.createElement('div');info.className='arcade-stage-meta';
    canvas=document.createElement('canvas');canvas.width=canvas.height=SNAKE_CANVAS;canvas.className='snake-projection-canvas';
    overlay.append(info,canvas);
  }
  main.classList.add('snake-hide');overlay.classList.remove('hidden');overlay.setAttribute('aria-hidden','false');
  const state=safe(player.state);
  info.textContent=`${player.name} · ${player.score||0} PUNTOS · ♻ ${state.foods||0}`;
  if(title)title.textContent=`${String(player.name).toUpperCase()} · TRASA SNAKE`;
  try{drawSnakeScene(canvas,state)}catch(e){feedback('Error al dibujar Snake: '+e.message)}
}
function reconcile(){
  if(display.mode!=='arcade'){hideSnake();return;}
  const now=Date.now();
  const active=Object.entries(live).filter(([,p])=>p&&p.status==='playing'&&['snake','zona','memory','run'].includes(p.gameId)
    &&Number(p.updatedAt||0)>now-22000).sort((a,b)=>Number(a[1].startedAt||0)-Number(b[1].startedAt||0));
  // Si el destacado ya no está conectado, la pantalla normal usa el primer jugador activo.
  const chosen=active.find(([uid])=>uid===display.featuredUid)||active[0];
  if(chosen?.[1]?.gameId==='snake'){showSnake(chosen[1],chosen[0]);return;}
  hideSnake();
}
async function init(){
  if(!isFirebaseConfigured()){feedback('Firebase no está configurado en esta instalación.');return;}
  try{
    const fb=await loadFirebase();await fb.authMod.signInAnonymously(fb.auth);
    fb.dbMod.onValue(fb.dbMod.ref(fb.db,roomPath('display')),s=>{display=s.val()||{};reconcile();},e=>feedback('Error de lectura de pantalla: '+e.message));
    fb.dbMod.onValue(fb.dbMod.ref(fb.db,roomPath('arcade/live')),s=>{live=s.val()||{};reconcile();},e=>feedback('No se pueden leer partidas Snake. Revisa los permisos arcade/live: '+e.message));
    fb.dbMod.onValue(fb.dbMod.ref(fb.db,roomPath('arcade/scores/snake')),s=>renderRanking(s.val()),e=>feedback('No se puede leer TOP 5 Snake. Revisa los permisos arcade/scores/snake: '+e.message));
    setInterval(reconcile,3000);
  }catch(e){feedback('Error al iniciar el proyector Snake: '+e.message)}
}
init();
